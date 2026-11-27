import assert from 'node:assert/strict';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';

const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { calculateFortuneFacts, factPolicies } = await import('./control/fortune-facts.ts');
const { ziweiPalaceConditions } = await import('./control/ziwei-conditions.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const natal = astro.withOptions({ dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, config });
const chart = { timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal.toJSON()] } };
const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai' };
const time = buildFactTimeContext(input, Date.parse('2026-11-18T02:00:00Z'), 'server');
let baseline;
const realRun = () => baseline ??= calculateFortuneFacts(input, time, 'ziwei-test-run', { snapshotId: 'test-snapshot', chart });
const rule = n => fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.includes('expansion-p' + String(n).padStart(3, '0') + '-'));
const result = (run, n) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === rule(n).knowledgeId);

function scenario() {
  const run = structuredClone(realRun());
  run.facts = []; run.rawFacts = [];
  run.methods.ziwei = { status: 'completed', warnings: [] };
  function add(payload, { scope = 'decadal', factType = 'palace_condition', from, to } = {}) {
    const factId = 'fact-' + run.facts.length, rawFactId = 'raw-' + run.rawFacts.length;
    const policy = factPolicies.ziwei;
    run.rawFacts.push({ method: 'ziwei', rawFactId, payload });
    run.facts.push({ method: 'ziwei', factType, scope, factId, calculationRunId: run.calculationRunId,
      natalChartSnapshotId: run.natalChartSnapshotId, periodType: 'year', subjectIds: ['ziwei:candidate:0'],
      activeFrom: from ?? time.displayWindow.instantRange.startInstant, activeTo: to ?? time.displayWindow.instantRange.endInstantExclusive,
      completeness: 'complete', timePrecision: 'range', timeZone: policy.timeZone, sourceEngine: policy.engine,
      engineVersion: policy.version, rulesetVersion: policy.rules, sourceFactIds: [rawFactId], warnings: [], normalizedPayload: payload });
    return run.facts.at(-1);
  }
  return { run, add };
}
const palace = (localStarNames, more = {}) => ({ palaceIndex: 0, flowName: '命宫', natalName: '官禄', branch: '午',
  localStarNames, natalStarNames: localStarNames, movingStarNames: [], oppositeStarNames: [], surroundingStarNames: localStarNames, ...more });

test('palace summaries preserve same-palace, opposite and triad boundaries and moving-star provenance', () => {
  const base = index => ({ index, flowName: index === 0 ? '命宫' : '财帛', natalName: '官禄', branch: '子',
    oppositeIndex: (index + 6) % 12, triadIndices: [(index + 4) % 12, (index + 8) % 12], natalStars: [], movingStarIds: [] });
  const rows = Array.from({ length: 12 }, (_, index) => base(index));
  rows[0].natalStars = [{ name: '七杀', brightness: '旺' }];
  rows[0].movingStarIds = ['流马'];
  rows[6].natalStars = [{ name: '天府', brightness: '庙' }];
  rows[1].natalStars = [{ name: '破军' }];
  const summary = ziweiPalaceConditions(rows[0], rows, [{ star: '七杀', kind: '权', natalPalaceIndices: [0] }]);
  assert.deepEqual(summary.localStarNames, ['七杀', '天马']);
  assert.deepEqual(summary.natalStarNames, ['七杀']);
  assert.deepEqual(summary.movingStarNames, ['流马']);
  assert.deepEqual(summary.oppositeStarNames, ['天府']);
  assert.ok(!summary.surroundingStarNames.includes('破军'));
  assert.deepEqual(summary.localFlowTransformations, ['权:七杀']);
  assert.equal(summary.yearlySuiqianStar, undefined);
});

test('real calculations expose annual sui-qian stars at their exact palaces without confusing natal or minor-limit stars', () => {
  const run = realRun();
  assert.notEqual(run.methods.ziwei.status, 'failed');
  const annual = run.facts.filter(row => row.factType === 'palace_condition' && row.scope === 'yearly');
  const segments = new Map();
  for (const row of annual) segments.set(row.activeFrom, (segments.get(row.activeFrom) ?? 0) + 1);
  assert.equal(segments.size, 2, 'the calendar year crosses the lunar new-year boundary');
  assert.ok([...segments.values()].every(count => count === 12));
  for (const row of annual) {
    const p = row.normalizedPayload;
    const date = new Date(Date.parse(row.activeFrom) + 8 * 3_600_000).toISOString().slice(0, 10);
    const engine = natal.horoscope(date, 6).yearly;
    assert.equal(engine.yearlyDecStar.suiqian12[engine.index], '岁建');
    assert.equal(p.yearlySuiqianStar, engine.yearlyDecStar.suiqian12[p.palaceIndex]);
    assert.equal(p.yearlyJiangqianStar, engine.yearlyDecStar.jiangqian12[p.palaceIndex]);
    assert.ok(row.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  }
  assert.ok(run.facts.filter(row => row.factType === 'palace_condition' && row.scope !== 'yearly')
    .every(row => row.normalizedPayload.yearlySuiqianStar === undefined));
});

test('Wuqu and Pojun must share one actual limit palace; unrelated palaces and monthly charts cannot complete the mapping', () => {
  const { run, add } = scenario();
  add(palace(['武曲'])); add(palace(['破军'], { palaceIndex: 1 }));
  assert.notEqual(result(run, 2).status, 'matched');
  add(palace(['武曲', '破军']), { scope: 'monthly' });
  assert.notEqual(result(run, 2).status, 'matched');
  const positive = add(palace(['武曲', '破军']), { scope: 'minor' });
  const match = result(run, 2);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [positive.factId]);
  const { input: prompt } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'new-mapping'));
  assert.ok(prompt.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === rule(2).knowledgeId));
  const outgoing = formatFortuneFactAudit(prompt);
  assert.match(outgoing, /若與破軍同位，更臨二限之中/u);
  assert.match(outgoing, /本命同宫星曜：武曲、破军/u);
  assert.ok(!outgoing.includes('palace_condition'));
});

test('generic war-horse and opposite-Tianfu palace facts cannot replace source-specific matches', () => {
  const a = scenario();
  a.add(palace(['天马']), { scope: 'yearly' }); a.add(palace(['火星'], { palaceIndex: 1 }), { scope: 'yearly' });
  assert.notEqual(result(a.run, 12).status, 'matched');
  a.add(palace(['天马', '火星']), { scope: 'yearly' });
  assert.equal(result(a.run, 12).status, 'unknown');
  const b = scenario();
  b.add(palace(['七杀', '天府']));
  assert.equal(result(b.run, 33).status, 'unknown');
  b.add(palace(['七杀'], { oppositeStarNames: ['天府'] }));
  assert.equal(result(b.run, 33).status, 'unknown');
  const source = { profile: 'quanshu-limit-branches-v1', ready: true };
  const missingSha = b.add({ ...source, qishaTianfuAtLimitCandidate: false }, { factType: 'quanshu_limit_branches', scope: 'yearly' });
  b.add({ ...source, qishaTianfuAtLimitCandidate: true }, { factType: 'quanshu_limit_branches', scope: 'monthly' });
  assert.equal(result(b.run, 33).status, 'unknown');
  missingSha.normalizedPayload.qishaAdverseAtLimitCandidate = false;
  assert.equal(result(b.run, 33).status, 'not_matched');
  const witness = b.add({ ...source, qishaTianfuAtLimitCandidate: true }, { factType: 'quanshu_limit_branches', scope: 'yearly' });
  assert.equal(result(b.run, 33).status, 'unknown');
  const timing = b.add({ profile: 'quanshu-north-south-limit-halves-v1', qishaPhaseCandidate: true },
    { factType: 'quanshu_limit_star_timing', scope: 'yearly' });
  assert.equal(result(b.run, 33).status, 'partial');
  assert.deepEqual(result(b.run, 33).sourceFactIds, [witness.factId, timing.factId]);
});

test('generic Lianzhen annual/minor overlap cannot replace the atomic source White-Tiger layer', () => {
  const { run, add } = scenario();
  add(palace(['廉贞'], { yearlySuiqianStar: '白虎' }), { scope: 'yearly' });
  const overlap = add({ firstScope: 'minor', secondScope: 'yearly', samePalace: false }, { factType: 'layer_overlap', scope: 'minor' });
  assert.notEqual(result(run, 46).status, 'matched');
  overlap.normalizedPayload.samePalace = true;
  // The real atomic positive is covered in quanshu-tiger-layers.test.mjs.
  // Generic palace and overlap records cannot supply its source identity.
  assert.equal(result(run, 46).status, 'unknown');
  const middle = new Date((time.window.start + time.window.end) / 2).toISOString();
  run.facts[0].activeTo = middle; overlap.activeFrom = middle;
  assert.notEqual(result(run, 46).status, 'matched');
});

test('generic White Tiger and natal or moving star names cannot replace the source-specific fire/bell context', () => {
  const { run, add } = scenario();
  const fact = add(palace(['擎羊', '铃星'], { natalName: '命宫', natalStarNames: [], yearlySuiqianStar: '白虎' }), { scope: 'yearly' });
  assert.notEqual(result(run, 49).status, 'matched');
  fact.normalizedPayload.natalStarNames = ['擎羊', '铃星'];
  assert.equal(result(run, 49).status, 'unknown');
  fact.normalizedPayload.yearlySuiqianStar = '天德';
  fact.normalizedPayload.natalStarNames.push('白虎');
  assert.notEqual(result(run, 49).status, 'matched');
});

test('unresolved source branches stay partial and ambiguous or incompatible input never becomes a full match', () => {
  const { run, add } = scenario();
  const fact = add(palace(['天机']));
  assert.equal(result(run, 1).status, 'unknown');
  add({ profile: 'quanshu-firebell-anchor-archive-v1', ready: true, localMainStars: ['天机'] }, { factType: 'quanshu_firebell_context' });
  assert.equal(result(run, 1).status, 'unknown');
  const annualContact = add({ profile: 'quanshu-tong-yin-bell-verse-contacts-v1', ready: true, jiBaseCandidate: true },
    { factType: 'quanshu_limit_verse_contacts', scope: 'yearly' });
  const jiMatch = result(run, 1);
  assert.equal(jiMatch.status, 'partial');
  assert.deepEqual(jiMatch.sourceFactIds, [annualContact.factId]);
  fact.normalizedPayload.localStarNames = ['武曲', '破军'];
  assert.equal(result(run, 2).status, 'matched');
  run.methods.ziwei.warnings = ['候选盘分别保留'];
  assert.equal(result(run, 2).status, 'unknown');
  run.methods.ziwei.warnings = [];
  fact.rulesetVersion = 'incompatible';
  assert.equal(result(run, 2).status, 'unknown');
});

test('all 52 reviewed rows record source provenance and only fully verified conditions are admitted as complete', () => {
  const reviewed = fortuneKnowledge.ziwei.rules.filter(row => row.knowledgeId.includes('interpretation-expansion'));
  assert.equal(reviewed.length, 52);
  assert.ok(reviewed.every(row => row.review?.sourcePassageId && /^[a-f0-9]{64}$/u.test(row.review.sourceHash) && row.queries.length));
  assert.deepEqual(reviewed.filter(row => !row.unresolved.length).map(row => Number(row.knowledgeId.match(/expansion-p(\d+)/u)[1])), [2, 18]);
});

test('real chart mappings reach the natural-language prompt with evidence appropriate to their status', () => {
  const fixtures = [
    [2, '1990-01-30', 6, '男', '2026-11-18', 'matched'],
    [33, '1990-01-01', 6, '男', '2026-11-18', 'partial'],
  ];
  for (const [n, dateStr, timeIndex, gender, query, status] of fixtures) {
    const snapshot = structuredClone(chart);
    snapshot.ziwei.rawResult = [astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }).toJSON()];
    const clock = buildFactTimeContext(input, Date.parse(query + 'T02:00:00Z'), 'server');
    const run = calculateFortuneFacts(input, clock, 'real-mapping-' + n, { snapshotId: 'real-chart-' + n, chart: snapshot });
    const match = result(run, n);
    assert.equal(match.status, status, 'real source mapping ' + n);
    assert.ok(match.sourceFactIds.length);
    assert.ok(match.windows.every(window => clock.displayWindow.instantRange.startInstant <= window.start
      && window.endExclusive <= clock.displayWindow.instantRange.endInstantExclusive));
    const report = interpretFortune(run, requestForFortuneRun(run), 'real-report-' + n);
    const context = buildFortuneModelContext(run, report);
    const finding = context.input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === rule(n).knowledgeId);
    const prompt = formatFortuneFactAudit(context.input);
    if (status === 'matched') {
      assert.ok(finding, 'mapping must reach the model context: ' + n);
      assert.ok(prompt.includes(finding.originalText), 'source must reach the actual prompt: ' + n);
    } else {
      assert.equal(finding, undefined);
      assert.match(prompt, /七杀在[子丑寅卯辰巳午未申酉戌亥]宫[^。\n]*对宫[子丑寅卯辰巳午未申酉戌亥]有天府/u);
    }
  }
});
