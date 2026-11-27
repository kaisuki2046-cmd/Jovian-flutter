import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createFortuneRepository } from './server/fact-service.mjs';
import { createFortuneInterpretationHandler } from './server/interpretation-service.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
import { maxReportSectionLength } from '../../shared/content-limits.mjs';

const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { calculateFortuneFacts, factPolicies } = await import('./control/fortune-facts.ts');
const { luMonthDayTwist } = await import('./control/bazi-source-context.ts');
const { interpretFortune, requestForFortuneRun, validateInterpretation } =
  await import('./control/fortune-interpretation.ts');
const { readRulebook } = await import('./control/interpretation-registry.ts');
const { topicTitles } = await import('./model/interpretation.ts');
const { builtinFortuneRulebook } = await import('./control/interpretation-rules.ts');
const { buildFortuneModelContext, parseFortuneModelSections, publishFortuneReport } = await import('./control/fortune-model-context.ts');

const owner = '00000000-0000-0000-0000-000000000001';
const stranger = '00000000-0000-0000-0000-000000000002';
const calculationRunId = 'b'.repeat(64);
const snapshotId = 'a'.repeat(64);
const iso = time => new Date(time).toISOString();
const hour = 3_600_000;

test('accepts expanded report paragraphs and attaches local evidence without truncation', () => {
  const factIds = ['fact-1', 'fact-2'];
  const evidence = new Map([['overall', factIds]]);
  const summary = '盘面依据需要结合实际情况理解。'.repeat(100) + '\n\n完整保留这段说明。';
  const sections = ['overall', 'wealth', 'romance'].map(sectionId =>
    ({ sectionId, summary }));
  const parsed = parseFortuneModelSections({ sections }, evidence);
  assert.equal(parsed[0].summary, summary);
  assert.deepEqual(parsed[0].factIds, factIds);
  assert.deepEqual(parsed[1].factIds, []);
  assert.throws(() => parseFortuneModelSections({ sections: sections.map(section =>
    ({ ...section, summary: '字'.repeat(maxReportSectionLength + 1) })) }, evidence));
  assert.throws(() => parseFortuneModelSections({ sections: sections.map(section =>
    ({ ...section, factRefs: [] })) }, evidence));
  for (const marker of ['F1', '[F2]', '（F12、F23）', 'f3', 'F1F2']) {
    assert.equal(parseFortuneModelSections({ sections: sections.map(section =>
      ({ ...section, summary: summary + marker })) }, evidence)[0].summary, summary + marker);
  }
  assert.equal(publishFortuneReport({ generationMode: 'cloud_llm', modelSections: [
    { sectionId: 'overall', summary: summary + '（F1）', factIds: [] },
  ] }).sections[0].summary, summary + '（F1）');
});

function fixture(periodType = 'day') {
  const input = { periodType, displayTimezone: 'UTC' };
  const time = buildFactTimeContext(input, Date.parse('2026-11-02T00:00:00Z') + hour, 'server');
  const run = { ...calculateFortuneFacts(input, time, calculationRunId, { snapshotId }), facts: [], rawFacts: [] };
  const start = time.window.start;
  const end = time.window.end;
  run.methods.bazi = { status: 'partial', warnings: ['正式起运口径待确认'] };
  run.methods.ziwei = { status: 'completed', warnings: [] };
  run.methods.western = { status: 'completed', warnings: [] };
  function add(method, factType, subjectIds, normalizedPayload, extras = {}) {
    const policy = factPolicies[method];
    const factId = 'fact:' + run.rawFacts.length;
    const rawFactId = 'raw:' + run.rawFacts.length;
    run.rawFacts.push({ rawFactId, method, payload: normalizedPayload });
    run.facts.push({ factId, calculationRunId, natalChartSnapshotId: method === 'almanac' ? undefined : snapshotId,
      periodType, method, factType, scope: 'daily', activeFrom: iso(start), activeTo: iso(end), subjectIds,
      timePrecision: 'range', timeZone: policy.timeZone, sourceEngine: policy.engine, engineVersion: policy.version,
      rulesetVersion: policy.rules, completeness: 'complete', warnings: [], normalizedPayload,
      sourceFactIds: [rawFactId], ...extras });
    return factId;
  }
  const p = ['bazi:candidate:0', 'natal:day', 'flow:day'];
  const primary = add('bazi', 'ten_god', p, { tenGod: '正财' });
  const hidden = add('bazi', 'hidden_stem_ten_god', p, { tenGod: '正财' });
  const ziwei = ['ziwei:candidate:0', 'palace:5'];
  const palace = add('ziwei', 'palace_mapping', ziwei,
    { flowName: '命宫', natalName: '官禄', index: 5, triadIndices: [1, 9] });
  const transformation = add('ziwei', 'transformation', ziwei, { kind: '权', placements: [{}], natalPalaceIndices: [5] });
  const house = add('western', 'house_interval', ['western:candidate:0', 'Venus'], { natalHouse: 7 }, { scope: 'transit' });
  const body = ['Venus', 'Moon'];
  const val = { transitBody: 'Venus', natalTargetId: 'Moon', natalTargetType: 'planet', orb: 2, aspectType: 'trine' };
  const band = add('western', 'aspect_interval', body, val, { scope: 'transit', parentSignalId: 'venus-contact' });
  add('western', 'aspect_interval', body, val, { scope: 'transit', parentSignalId: 'venus-contact' });
  add('western', 'aspect_exact', body, { ...val, passIndex: 1 },
    { scope: 'transit', parentSignalId: 'venus-contact', exactInstant: iso(start + 3 * hour) });
  add('western', 'aspect_exact', body, { ...val, passIndex: 2 },
    { scope: 'transit', parentSignalId: 'venus-contact', exactInstant: iso(start + 6 * hour) });
  const almanac = add('almanac', 'general_almanac', ['2026-11-02'], { yi: ['通用活动'] }, { scope: 'almanac' });
  return { run, add, start, end, primary, hidden, palace, transformation, house, band, almanac, val };
}

function preview(run, preferences) {
  return interpretFortune(run, requestForFortuneRun(run, preferences), 'interpretation-preview', { mode: 'preview' });
}

function reviewedBook() {
  const book = structuredClone(builtinFortuneRulebook);
  book.version = 'synthetic-review-fixture-v1';
  for (const source of book.sources) {
    source.licenseStatus = 'licensed';
    source.allowedUse = 'rule_derivation';
  }
  for (const item of [...book.rules, ...book.mappings, ...book.actions, ...book.catalog]) {
    item.reviewStatus = 'approved';
    item.reviewer = 'Automated test fixture';
    item.reviewedAt = '2026-11-01T00:00:00.000Z';
  }
  return book;
}

test('production uses built-in rules and still validates independently supplied rulebooks', () => {
  assert.equal(readRulebook(builtinFortuneRulebook, Object.keys(topicTitles)), builtinFortuneRulebook);
  const bad = structuredClone(builtinFortuneRulebook);
  bad.rules[0].trigger = [{ field: 'normalizedPayload.tenGod', eval: 'return true' }];
  assert.throws(() => readRulebook(bad, Object.keys(topicTitles)));
  const { run } = fixture();
  const result = interpretFortune(run, requestForFortuneRun(run), 'default-report');
  assert.equal(result.ruleMode, 'production');
  assert.ok(result.topics.length > 0 && result.remedies.length > 0);
  assert.equal(result.generalAlmanac.length, 1);
  assert.deepEqual(interpretFortune(run, requestForFortuneRun(run), 'external-draft',
    { book: structuredClone(builtinFortuneRulebook) }).topics, []);
  const unsupported = reviewedBook();
  unsupported.sources.forEach(source => { source.licenseStatus = 'unknown'; });
  assert.equal(interpretFortune(run, requestForFortuneRun(run), 'unlicensed', { book: unsupported }).topics.length, 0);
});

test('interprets all three methods through conditions and retains sources without modifying facts', () => {
  const { run, primary, hidden, palace, transformation, house, band, almanac } = fixture();
  const before = structuredClone(run);
  const result = preview(run);
  assert.deepEqual(run, before);
  assert.ok(result.overall && result.wealth && result.romance);
  assert.ok(result.evidence.some(item => item.topicId === 'wealth' && item.sourceFactIds.includes(primary)
    && item.sourceFactIds.includes(hidden) && item.method === 'bazi'));
  assert.ok(result.evidence.some(item => item.topicId === 'career' && item.sourceFactIds.includes(palace)
    && item.sourceFactIds.includes(transformation) && item.method === 'ziwei'));
  const romance = result.evidence.filter(item => item.topicId === 'romance' && item.strength === 'direct'
    && item.sourceFactIds.includes(band));
  assert.equal(romance.length, 1);
  assert.ok(romance[0].sourceFactIds.includes(house));
  assert.deepEqual(result.keyTimeEvents.filter(item => item.parentSignalId === 'venus-contact').map(item => item.passIndex), [1, 2]);
  assert.ok(result.evidence.every(item => !item.sourceFactIds.includes(almanac)));
  assert.ok(result.personalYi.every(item => item.evidenceIds.length && item.ruleId));
  assert.ok(result.remedies.every(item => ['behavior', 'environment', 'ritual'].includes(item.item.category)));
  assert.ok(!result.personalYi.find(item => item.topicId === 'romance').text.includes('已有伴侣'));
  assert.match(preview(run, { relationshipStatus: 'relationship' }).personalYi.find(item => item.topicId === 'romance').text, /已有伴侣/u);
  validateInterpretation(result, run);
});

test('missing condition, unavailable method, incompatible version and ambiguous candidates suppress personal claims', () => {
  const sample = fixture();
  const { run } = sample;
  run.facts = run.facts.filter(item => item.factId !== sample.house && item.factId !== sample.transformation);
  const result = preview(run);
  assert.equal(result.romance, undefined);
  assert.ok(result.candidates.some(item => item.excluded && item.exclusionReasons.some(reason => reason.includes('related-house'))));
  assert.ok(!result.topics.some(item => item.topicId === 'career'));
  sample.add('bazi', 'ten_god', ['bazi:candidate:1'], { tenGod: '偏财' });
  assert.equal(preview(run).wealth, undefined);
  run.methods.western.status = 'failed';
  assert.ok(preview(run).candidates.every(item => item.method !== 'western'));
  run.facts.find(item => item.factId === sample.palace).engineVersion = 'mismatch';
  assert.ok(preview(run).limitations.some(item => item.includes('版本')));
});

test('local audit retains verified library findings and the parser validates all three report sections', () => {
  const { run, add, val } = fixture();
  const publicFact = add('western', 'aspect_interval', ['Venus', 'Moon'], { ...val, natalTargetType: 'sky' });
  const report = interpretFortune(run, requestForFortuneRun(run), 'prompt');
  const { input, references } = buildFortuneModelContext(run, report);
  assert.deepEqual(input.sections.map(item => item.id), ['overall', 'wealth', 'romance']);
  assert.ok(input.sections.every(item => Array.isArray(item.findings) && !('summary' in item)));
  assert.ok(input.facts.some(item => item.data.tenGod === '正财'));
  assert.ok(input.facts.some(item => item.data.natalTargetId === 'Moon'));
  assert.ok(![...references.values()].includes(publicFact));
  assert.ok(!JSON.stringify(input).includes('fact:'));
  const sections = [
    { sectionId: 'overall', summary: '本期的整体关注点偏向已经明确的职责与安排。' },
    { sectionId: 'wealth', summary: '已确定的进账与付款安排是本期财务的主要关注点。' },
    { sectionId: 'romance', summary: '本期的感情依据有限，暂时看不出关系发展的明确趋势。' },
  ];
  const evidence = new Map();
  const wrong = sections.map(item => ({ ...item, factRefs: ['F999'] }));
  assert.throws(() => parseFortuneModelSections({ sections: wrong }, evidence), /Invalid/u);
  assert.throws(() => parseFortuneModelSections({ sections: sections.slice(1) }, evidence), /Invalid/u);
  assert.deepEqual(parseFortuneModelSections({ sections: [...sections].reverse() }, evidence).map(item => item.sectionId),
    sections.map(item => item.sectionId));
  const empty = fixture().run;
  empty.facts = empty.facts.filter(item => item.method === 'almanac');
  const emptyReport = interpretFortune(empty, requestForFortuneRun(empty), 'empty');
  const emptyInput = buildFortuneModelContext(empty, emptyReport).input;
  assert.deepEqual(emptyInput.facts, []);
  assert.ok(emptyInput.sections.every(item => item.findings.length === 0));
});

test('preserves overlapping and disjoint directions and limits exact events to valid intervals', () => {
  const sample = fixture();
  const { run, add, start, end, val } = sample;
  const challenging = add('western', 'aspect_interval', ['Venus', 'Moon'], { ...val, aspectType: 'square' },
    { scope: 'transit', parentSignalId: 'venus-tension' });
  let result = preview(run);
  assert.equal(result.romance.consensus, 'conflicted');
  assert.ok(result.conflicts.some(item => item.topicId === 'romance' && item.conflictType === 'direction'));
  for (const fact of run.facts) {
    if (fact.parentSignalId === 'venus-contact') fact.activeTo = iso(start + 12 * hour);
    if (fact.factId === challenging) { fact.activeFrom = iso(start + 13 * hour); fact.activeTo = iso(end); }
  }
  result = preview(run);
  assert.ok(result.conflicts.some(item => item.topicId === 'romance' && item.conflictType === 'time'));
  add('western', 'station', ['Venus'], {}, { scope: 'transit', exactInstant: iso(start + 3 * hour) });
  result = preview(run);
  assert.ok(result.conflicts.some(item => item.topicId === 'romance' && item.conflictType === 'condition'));
});

test('a conditional mapping applies only where its separate evidence holds and cites that fact', () => {
  const { run, add, start } = fixture();
  const book = structuredClone(builtinFortuneRulebook);
  const mapping = book.mappings.find(item => item.mappingId === 'bazi.regular-income:wealth');
  mapping.required = [{ id: 'month-support', factType: 'generating', sharedSubject: 'candidate',
    where: [{ field: 'subjectIds', includes: 'natal:month' }] }];
  assert.equal(interpretFortune(run, requestForFortuneRun(run), 'unmatched-mapping', { mode: 'preview', book })
    .topics.some(item => item.topicId === 'wealth'), false);
  const support = add('bazi', 'generating', ['bazi:candidate:0', 'natal:month', 'flow:day'], {},
    { activeFrom: iso(start + 4 * hour), activeTo: iso(start + 8 * hour) });
  const report = interpretFortune(run, requestForFortuneRun(run), 'matched-mapping', { mode: 'preview', book });
  const evidence = report.evidence.find(item => item.topicId === 'wealth' && item.sourceFactIds.includes(support));
  assert.equal(evidence.activeWindow.start, iso(start + 4 * hour));
  assert.equal(evidence.activeWindow.endExclusive, iso(start + 8 * hour));
});

test('four periods consume only their own snapshot, grouping historical nodes and actions at the matching scale', () => {
  for (const period of ['year', 'month', 'week', 'day']) {
    const { run } = fixture(period);
    const report = preview(run, { enabledTopics: ['romance'] });
    assert.deepEqual(report.topics.map(item => item.topicId), ['romance']);
    assert.ok(report.keyTimeEvents.length);
    assert.equal(report.keyTimeEvents.every(item => period === 'year' ? /^\d{4}-\d{2}$/u.test(item.phase)
      : period === 'month' ? ['上旬', '中旬', '下旬'].includes(item.phase) : /^\d{4}-\d{2}-\d{2}$/u.test(item.phase)), true);
    assert.equal(report.personalYi.length, 1);
    if (period === 'week') {
      assert.ok(report.evidence.every(item => item.method === 'western'));
      assert.equal(report.generalAlmanac.length, 0);
      const { input } = buildFortuneModelContext(run, report);
      assert.deepEqual(Object.keys(input.methods), ['western']);
      assert.ok(input.facts.length && input.facts.every(fact => fact.method === 'western'));
      assert.ok(input.sections.every(section => section.findings.every(finding => finding.method === 'western')));
    }
    assert.throws(() => interpretFortune(run, { ...requestForFortuneRun(run), calculationRunId: 'other' }, 'bad'));
  }
});

function call(handler, url, method = 'GET', body, authorized = true) {
  const request = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]),
    { url, method, headers: authorized ? { authorization: 'Bearer fixture' } : {} });
  return new Promise(resolve => {
    let status;
    const response = { setHeader() {}, writeHead(next) { status = next; return response; },
      end(text) { resolve({ status, body: text ? JSON.parse(text) : undefined }); } };
    void handler(request, response);
  });
}

test('production uses its current rule catalog and reopens authorized interpretations without regenerating', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-fortune-interpretation-'));
  try {
    const repository = createFortuneRepository(directory);
    const { run, add } = fixture('day');
    run.facts = run.facts.filter(fact => fact.factType !== 'aspect_interval');
    add('bazi', 'calendar_pattern', ['flow:month', 'flow:day'], luMonthDayTwist('庚申', '辛未'));
    await repository.put({ ...run, ownerId: owner, input: { snapshotId, periodType: 'day', displayTimezone: 'UTC' }, outputHash: 'fixture' });
    const service = ({ headers }) => {
      if (!headers.authorization) throw Object.assign(new Error('Denied'), { status: 401 });
      return { snapshotId };
    };
    const params = { calculationRunId, expectedOwnerId: owner };
    const unconfigured = createFortuneInterpretationHandler({ repository, loadArchive: service });
    assert.equal((await call(unconfigured, '/fortune/interpret', 'POST', { ...params, mode: 'preview' })).status, 400);
    assert.equal((await call(unconfigured, '/fortune/interpret', 'POST', { ...params, book: { version: 'alternate' } })).status, 400);
    assert.equal((await call(unconfigured, '/fortune/interpret', 'POST', params)).status, 503);
    const apiText = [
      { sectionId: 'overall', summary: '本期整体节奏偏向落实已经明确的工作与安排。' },
      { sectionId: 'wealth', summary: '固定收支是本期财务关注点，已有的付款安排更值得留意。' },
      { sectionId: 'romance', summary: '已有的交流有继续了解的空间，具体进展取决于双方回应。' },
    ];
    let modelCalls = 0;
    const expression = createFortuneDeepSeek({ apiKey: 'fixture-key', transport: async (url, options) => {
      modelCalls += 1;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer fixture-key');
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      const prompt = body.messages[1].content;
      assert.throws(() => JSON.parse(prompt));
      for (const label of ['综合运势参考资料', '财运参考资料', '桃花运参考资料', '命中条件：', '原文：', '现代释义：']) assert.ok(prompt.includes(label));
      assert.doesNotMatch(prompt, /knowledgeId|passage_id|normalizedPayload|evidenceGroup|"facts"|\b[FE]\d+\b|天干十神为正财|事件时间轴/u);
      assert.ok(!options.body.includes(snapshotId) && !options.body.includes(calculationRunId));
      assert.ok(!options.body.includes(owner));
      if (modelCalls === 1) return new Response(null, { status: 503 });
      if (modelCalls === 3) {
        assert.deepEqual(body.messages.map(message => message.role), ['system', 'user', 'user']);
        assert.match(body.messages[2].content, /重新生成/u);
        assert.ok(!options.body.includes('private-invalid-output'));
      }
      const sections = modelCalls <= 3 ? apiText.map(item => ({ ...item, factRefs: ['private-invalid-output'] })) : apiText;
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sections }) } }] });
    } });
    let modelAllowed = false;
    let permissionChecks = 0;
    const handler = createFortuneInterpretationHandler({
      repository, loadArchive: service, expression,
      readPermission(headers, purpose) {
        assert.equal(headers.authorization, 'Bearer fixture');
        assert.equal(purpose, 'fortune.cloud_interpretation');
        permissionChecks += 1;
        return { allowed: modelAllowed, identity: { kind: 'member', id: owner } };
      },
    });
    assert.equal((await call(handler, '/fortune/interpret', 'POST', params)).status, 428);
    assert.equal(modelCalls, 0);
    modelAllowed = true;
    const rulesStatus = await call(handler, '/fortune/rules/status');
    assert.equal(rulesStatus.status, 200);
    assert.equal(rulesStatus.body.version, builtinFortuneRulebook.version);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const failed = await call(handler, '/fortune/interpret', 'POST', params);
      assert.equal(failed.status, 502);
      assert.deepEqual(failed.body, { error: 'fortune_interpretation_failed' });
    }
    const [first, concurrent] = await Promise.all([
      call(handler, '/fortune/interpret', 'POST', params), call(handler, '/fortune/interpret', 'POST', params),
    ]);
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(first.body).sort(), ['calculationRunId', 'natalChartSnapshotId', 'periodType', 'reportId', 'sections']);
    assert.deepEqual(concurrent.body, first.body);
    const persisted = await repository.getInterpretation(first.body.reportId);
    assert.equal(persisted.modelInput.sections.find(section => section.id === 'romance').findings.length, 0);
    assert.deepEqual(first.body.sections, [
      apiText[0],
      { sectionId: 'wealth', summary: '本期暂无足够资料判断财运趋势。' },
      { sectionId: 'romance', summary: '本期暂无足够资料判断桃花运。' },
    ]);
    assert.ok(persisted.modelInput.events.length > 0);
    assert.equal(persisted.modelInput.timelineVersion, 'fortune-event-timeline-v1');
    assert.ok(Object.keys(persisted.modelReferences).length > 0);
    assert.ok(persisted.report.modelSections.some(section => section.factIds.length > 0));
    for (const section of persisted.report.modelSections) {
      const matches = Object.values(persisted.report.knowledgeMatches.byMethod).flat()
        .filter(item => item.status === 'matched' && item.sectionId === section.sectionId);
      const evidence = new Set(matches.flatMap(match => match.sourceFactIds));
      assert.deepEqual(section.factIds, [...evidence]);
    }
    assert.ok(!('modelInput' in first.body) && !('modelReferences' in first.body));
    assert.deepEqual((await call(handler, '/fortune/interpret', 'POST', params)).body, first.body);
    assert.equal(modelCalls, 4);
    assert.equal(permissionChecks, modelCalls + 1);
    const latestQuery = '?expectedOwnerId=' + owner + '&snapshotId=' + snapshotId
      + '&periodType=day&displayTimezone=UTC&windowStart=' + run.time.window.start;
    const saved = await call(handler, '/fortune/reports/latest' + latestQuery);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, first.body);
    assert.equal(modelCalls, 4, 'reopening a report must not call the model');
    assert.equal((await call(handler, '/fortune/reports/latest' + latestQuery, 'GET', undefined, false)).status, 401);
    const route = '/fortune/reports/' + first.body.reportId + '?expectedOwnerId=';
    assert.equal((await call(handler, route + stranger)).status, 404);
    assert.equal((await call(handler, route + owner, 'GET', undefined, false)).status, 401);
    assert.deepEqual((await call(handler, route + owner)).body, first.body);
    assert.equal(modelCalls, 4, 'reading a historical report must not call the model');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('empty reports skip the model and stale reports remain available by ID', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-fortune-weekly-'));
  try {
    const repository = createFortuneRepository(directory);
    const { run } = fixture('week');
    await repository.put({ ...run, facts: [], rawFacts: [], ownerId: owner,
      input: { snapshotId, periodType: 'week', displayTimezone: 'UTC' }, outputHash: 'weekly-fixture' });
    const oldId = 'c'.repeat(64);
    await repository.putInterpretation({ interpretationRunId: oldId, ownerId: owner, calculationRunId,
      policyHash: 'previous-matching-policy', report: { reportId: oldId, calculationRunId, natalChartSnapshotId: snapshotId,
        periodType: 'week', generationMode: 'cloud_llm',
        modelSections: ['overall', 'wealth', 'romance'].map(sectionId => ({ sectionId, summary: '此前报告', factIds: [] })),
      } });
    const handler = createFortuneInterpretationHandler({
      repository, loadArchive: () => ({ snapshotId }),
      readPermission: () => assert.fail('An unmatched weekly report should not request cloud permission'),
    });
    const latest = '/fortune/reports/latest?expectedOwnerId=' + owner + '&snapshotId=' + snapshotId
      + '&periodType=week&displayTimezone=UTC&windowStart=' + run.time.window.start;
    assert.deepEqual(await call(handler, latest), { status: 200, body: null });

    const params = { calculationRunId, expectedOwnerId: owner };
    const result = await call(handler, '/fortune/interpret', 'POST', params);
    assert.equal(result.status, 200);
    assert.equal(result.body.periodType, 'week');
    assert.notEqual(result.body.reportId, oldId);
    assert.equal(result.body.sections.length, 3);
    assert.ok(result.body.sections.every(({ summary }) => /本期暂无足够资料/u.test(summary)));
    const saved = await repository.getInterpretation(result.body.reportId);
    assert.equal(saved.report.generationMode, 'no_matching_knowledge');
    assert.deepEqual(await call(handler, latest), result);
    assert.deepEqual(await call(handler, '/fortune/interpret', 'POST', params), result);
    const old = await call(handler, '/fortune/reports/' + oldId + '?expectedOwnerId=' + owner);
    assert.equal(old.body.reportId, oldId);

    const { run: daily } = fixture('day');
    const dailyId = 'd'.repeat(64);
    await repository.put({ ...daily, calculationRunId: dailyId, facts: [], rawFacts: [], ownerId: owner,
      input: { snapshotId, periodType: 'day', displayTimezone: 'UTC' }, outputHash: 'empty-day-fixture' });
    const oldDaily = 'e'.repeat(64);
    await repository.putInterpretation({ interpretationRunId: oldDaily, ownerId: owner, calculationRunId: dailyId,
      policyHash: 'previous-matching-policy', report: { reportId: oldDaily, calculationRunId: dailyId,
        natalChartSnapshotId: snapshotId, periodType: 'day', generationMode: 'cloud_llm',
        modelSections: ['overall', 'wealth', 'romance'].map(sectionId => ({ sectionId, summary: '此前报告', factIds: [] })) } });
    const latestDay = '/fortune/reports/latest?expectedOwnerId=' + owner + '&snapshotId=' + snapshotId
      + '&periodType=day&displayTimezone=UTC&windowStart=' + daily.time.window.start;
    assert.deepEqual(await call(handler, latestDay), { status: 200, body: null });
    assert.equal((await call(handler, '/fortune/reports/' + oldDaily + '?expectedOwnerId=' + owner)).body.reportId, oldDaily);
    const day = await call(handler, '/fortune/interpret', 'POST', { ...params, calculationRunId: dailyId });
    assert.equal(day.status, 200);
    assert.equal(day.body.periodType, 'day');
    assert.deepEqual(day.body.sections, result.body.sections);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
