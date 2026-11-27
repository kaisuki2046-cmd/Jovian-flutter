import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, calculateZiwei, chartFacts, chartVersions, describeBaZiPillars } from '../control/charts.ts';
import { analyzeBaZi } from '../control/bazi-analysis.ts';
import { createDestinyServer } from './index.mjs';
import { catalogFile, lookupInterpretations } from './knowledge/database.mjs';
import { createReportLookup, parseChartQueries } from './knowledge/report-lookup.mjs';
import { claimForPrompt, claimInventory, explainClaim, lookupClaims, pendingClaimConditions, structuredClaimMappings } from './knowledge/claims.mjs';
import { daozangChartFacts } from './knowledge/daozang-claims.mjs';
import { chartContext } from './knowledge/matching.mjs';
import { createDeepSeek, generateReport, parseInput, selectPromptMaterials } from './report.mjs';
import { buildReportMaterials, renderReportMaterials } from './report-materials.mjs';

function materialGroup() {
  return { topicId: 'overall', topic: '综合', personality: [{ id: 'test-text', method: 'western', topic: '综合', layer: 'personality',
    source: { title: '测试书籍', locator: '第一章' }, basis: '测试原文', reading: '现代释义测试', keywords: [],
    matchedConditions: { required: [{ kind: 'planet_sign', planet: 'Sun', sign: '白羊座' }], absent: [], alternatives: [], relations: [], measurements: [] } }], events: [] };
}


const signal = () => new AbortController().signal;
const sample = { timeKnown: true, sections: [{ topicId: 'client-controlled' }] };
const natalChart = calculateBaZi(Date.UTC(2000, 7, 13, 16), Date.UTC(2000, 7, 14));
const query = { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: chartFacts.bazi(natalChart) };

test('model receives each selected interpretation with its matching conditions and reasoning instructions', async () => {
  let sent;
  const complete = createDeepSeek({ apiKey: 'test-only', transport: async (url, request) => {
    sent = JSON.parse(request.body);
    return Response.json({ choices: [{ message: { content: '模型正文' } }] });
  } });
  const chartQueries = [query,
    { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
      confirmedFacts: [{ kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' }] },
    { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: [
      { kind: 'planet_sign', planet: 'Sun', sign: '白羊座' }, { kind: 'planet_house', planet: 'Moon', house: 4 },
    ] },
  ];
  const group = materialGroup();
  group.personality[0].limit = '本地规则注记';
  group.caseReferences = [{ id: 'test-case', matchedConditions: { required: [] },
    reportEvidence: { originalText: '命例测试原文', modernInterpretation: '原文记载：“命例测试原文”。可回顾原例所载情境。' } }];
  group.tieban = { profile: 'trial', libraryEdition: 'trial', results: [
    { axis: 'earlier', clauseId: 42, status: 'matched', claim: {
      id: 'test-tieban', category: { topic: '综合' }, source: { book: '铁板神数' },
      evidence: { original_text: '铁板测试原文' },
      interpretation: { classical_meaning: '所附条文在其编号及性别、年龄语境下记述：铁板测试原文。', limitations: ['本地铁板注记'] },
    } },
  ] };
  await generateReport(parseInput({ timeKnown: true, chartQueries }), {
    lookup: () => [group], complete, signal: signal(), expressionMode: 'off',
  });
  assert.equal(sent.model, 'deepseek-v4-pro');
  const text = sent.messages[1].content;
  assert.match(text, /^原文：测试原文$/mu);
  assert.match(text, /^原文：命例测试原文$/mu);
  assert.match(text, /^原文：铁板测试原文$/mu);
  assert.equal([...text.matchAll(/铁板测试原文/gu)].length, 1);
  assert.equal([...text.matchAll(/命例测试原文/gu)].length, 1);
  assert.match(text, /^现代解读：可回顾原例所载情境。$/mu);
  assert.doesNotMatch(text, /原文\/依据：|使用边界：|本地规则注记|本地铁板注记/u);
  assert.match(text, /^命中条件：太阳位于白羊座$/mu);
  assert.match(text, /^命中条件：四柱与原例相符/mu);
  assert.match(text, /^命中条件：本地起数命中/mu);
  assert.doesNotMatch(text, /盘面事实|日柱为甲辰|命宫有紫微|月亮落在第4宫|先天基数/u);
  assert.match(text, /现代解读：现代释义测试/u);
  assert.match(text, /原文性质：资料库规则编写依据/u);
  const prompt = sent.messages[0].content;
  assert.match(prompt, /综合、事业、爱情、学业、财富的顺序各写一次/u);
  assert.match(prompt, /一步联想或有逻辑的推理/u);
  assert.match(prompt, /用同一条的命中条件理解原文和解读为何适用/u);
  assert.match(prompt, /推演限于原解读的含义、适用范围和具体程度/u);
  assert.match(prompt, /禁止把上一步推测当作新的前提/u);
  assert.match(prompt, /当前资料不足以判断/u);
  assert.doesNotMatch(sent.messages.map(m => m.content).join('\n'), /出处|测试书籍|第一章/u);
  assert.doesNotMatch(sent.messages.map(m => m.content).join('\n'), /BLOCK|ALLOW|CAUTION|心理共鸣|psychologicalResonance|baziAnalysis|chartFacts|matchedConditions|rulesetVersion|confirmedFacts|planet_sign|palace_star|\{"/u);
});

test('model text pairs a matched branch with its confirmed conditions and keeps computed period details local', () => {
  const group = materialGroup();
  group.personality[0] = { ...group.personality[0], matchScope: 'passage_branch',
    claim: { source: { book: '分句书' }, evidence: { original_text: '未命中的整段原文', context: '无关章节' },
      interpretation: { classical_meaning: '未命中条件的整段现代解释' } },
    matchedBranches: [{ text: '仅此句命中', modernInterpretation: '该句按已经核对的盘面配置来说明。', matchedConditions: {
      required: [{ kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' }],
      absent: [{ kind: 'palace_star', palace: '命宫', star: '火星', scope: 'origin' }],
      decadalPeriod: { palace: '命宫', startAge: 12, endAge: 21 },
    } }],
  };
  const text = buildReportMaterials([group]);
  assert.match(text, /仅此句命中/u);
  assert.match(text, /原文\/依据：仅此句命中\n现代解读：该句按已经核对的盘面配置来说明。/u);
  assert.match(text, /命宫有紫微/u);
  assert.match(text, /不见：命宫有火星/u);
  assert.match(text, /12至21虚岁/u);
  assert.doesNotMatch(text, /未命中|无关章节|palace_star|decadalPeriod/u);
  const branch = group.personality[0].matchedBranches[0];
  branch.interpretationOrigin = 'derived';
  branch.modernInterpretation += '相关盘面包括命宫有紫微。八字日柱为乙亥。';
  branch.matchedConditions.decadalPeriod = { ganZhi: '甲子', startAge: 12, endAge: 21,
    applicableAgeRange: { startAge: 12, endAge: 16 } };
  const prompt = renderReportMaterials(selectPromptMaterials([group]));
  assert.match(prompt, /现代解读：该句按已经核对的盘面配置来说明。\n命中条件：命宫有紫微；不见：命宫有火星\n原条目适用范围：仅适用于所匹配的大运阶段。/u);
  assert.doesNotMatch(prompt, /相关盘面|甲子|乙亥|12|16|21|未命中|计算口径：/u);
});

test('skips the model when no interpretations are available', async () => {
  for (const input of [
    parseInput(sample),
    parseInput({ timeKnown: false, chartQueries: [{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
      confirmedFacts: [{ kind: 'planet_house', planet: 'Sun', house: 1 }] }] }),
  ]) {
    const result = await generateReport(input, { lookup: () => [], signal: signal(),
      complete: async () => assert.fail('The model should not be called without confirmed material.'),
    });
    assert.deepEqual(result, { report: null });
  }
  assert.equal(parseInput({ ...sample, chartQueries: [{ ...query, rulesetVersion: 'unknown' }] }), null);
});

test('confirmed facts in every supported chart are used by local lookup only', async () => {
  const queries = [query,
    { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
      confirmedFacts: [{ kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' }] },
    { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
      confirmedFacts: [{ kind: 'planet_sign', planet: 'Sun', sign: '白羊座' }] },
  ];
  for (const chartQuery of queries) {
    const parsed = parseInput({ timeKnown: true, chartQueries: [chartQuery] });
    const result = await generateReport(parsed, {
      lookup: chartQueries => { assert.equal(chartQueries, parsed.chartQueries); return []; },
      signal: signal(), complete: async () => assert.fail('Facts alone cannot start a model request.'),
    });
    assert.deepEqual(result, { report: null });
  }
});

test('standalone calculations and unmatched Tieban numbers stay out of the provider while keeping the local response', async () => {
  const tieban = { profile: 'trial', libraryEdition: 'trial', results: [
    { axis: 'base', clauseId: 42, status: 'unmatched', reason: 'not_in_catalog' },
  ] };
  const result = await generateReport(parseInput({ ...sample, chartQueries: [query] }), {
    lookup: () => [{ topicId: 'overall', topic: '综合', personality: [], events: [], tieban, calculationReferences: [
      { role: 'term_ruler_lookup', profile: 'ptolemy-robbins-1940-terms-v1', reportEvidence: [
        { id: 'lookup-table', originalText: '仅作计算', modernInterpretation: '仅供查表' },
      ] },
    ] }],
    signal: signal(),
    complete: async () => assert.fail('Standalone calculations cannot start a model request.'),
  });
  assert.deepEqual(result, { report: null, tieban });
});

test('lets a provider failure reach the caller without a second generation', async () => {
  let calls = 0;
  await assert.rejects(generateReport(parseInput({ ...sample, chartQueries: [query] }), {
    lookup: () => [materialGroup()], signal: signal(), complete: async () => { calls++; throw new Error('upstream unavailable'); },
  }), /upstream unavailable/u);
  assert.equal(calls, 1);
});

test('report HTTP route sends ranked matches and returns raw model text once per request', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-report-rules-'));
  context.after(() => { rmSync(join(directory, catalogFile), { force: true }); rmdirSync(directory); });
  const rawReport = '\n# 事业\n' + '这段模型文字会完整保留。'.repeat(110) + '\n\n模型自行组织事件文字。 \n';
  const received = [];
  const complete = createDeepSeek({
    apiKey: 'test-only', model: 'deepseek-v4-pro',
    transport: async (url, request) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(request.headers.Authorization, 'Bearer test-only');
      const body = JSON.parse(request.body);
      assert.equal(body.model, 'deepseek-v4-pro');
      assert.equal(body.response_format, undefined);
      assert.match(body.messages[0].content, /一步联想或有逻辑的推理/u);
      received.push(body.messages[1].content);
      return Response.json({ choices: [{ message: { content: rawReport } }] });
    },
  });
  let allowed = false;
  const server = createDestinyServer({
    complete, lookup: createReportLookup(directory),
    readPermission(headers, purpose) {
      assert.equal(headers.origin, 'http://localhost:8081');
      assert.equal(purpose, 'destiny.cloud_interpretation');
      return { allowed, identity: { kind: 'guest', id: '00000000-0000-0000-0000-000000000001' } };
    },
  }).listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const request = () => fetch('http://127.0.0.1:' + server.address().port + '/destiny/report', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
    body: JSON.stringify({ ...sample, chartQueries: [query], accountId: 'private-account', birthDate: '2000-01-01' }),
  });
  const denied = await request();
  assert.equal(denied.status, 428);
  assert.deepEqual(await denied.json(), { error: 'ai_permission_required' });
  assert.equal(received.length, 0);
  allowed = true;
  for (let count = 1; count <= 2; count++) {
    const response = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { report: rawReport });
    assert.equal(received.length, count);
  }
  const [payload] = received;
  const parsed = parseInput({ ...sample, chartQueries: [query] }).chartQueries;
  const selected = selectPromptMaterials(createReportLookup(directory)(parsed));
  assert.ok(selected.every(({ entries }) => entries.length <= 40));
  const expected = renderReportMaterials(selected);
  assert.equal(payload, expected);
  assert.doesNotMatch(payload, /^(?:出处|复排出处|同文出处)：/mu);
  assert.match(payload, /^命中条件：/mu);
  assert.doesNotMatch(payload, /盘面事实】|^计算口径：/mu);
  assert.match(payload, /^原文：/mu);
  assert.doesNotMatch(payload, /原文\/依据：|使用边界：/u);
  assert.match(payload, /现代解读：/u);
  assert.doesNotMatch(payload, /private-account|2000-01-01|client-controlled|chartQueries|matchedConditions|psychologicalResonance|BLOCK|ALLOW|CAUTION/u);
});

test('the app report endpoint uses birth facts only for Tieban, even with an older request', async context => {
  const wallTime = Date.UTC(1950, 8, 8, 14);
  const facts = chartFacts.bazi(calculateBaZi(wallTime - 8 * 3600000, wallTime, 'male'));
  const bazi = { ...query, birthYear: 1950, confirmedFacts: [...facts, { kind: 'natal_gender', gender: '男' }] };
  const prompts = [];
  const server = createDestinyServer({ complete: async ({ promptMaterials }) => {
    prompts.push(promptMaterials);
    return '测试正文';
  } }).listen(0, '127.0.0.1');
  context.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const request = async (chartQuery, timeKnown = true) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/destiny/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeKnown, chartQueries: [chartQuery] }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  const standard = await request(bazi);
  const older = await request({ ...bazi,
    tiebanFourteenTable: { lunarMonth: 7, lunarDay: 26, leap: false, queryTimePillar: '己巳', age: 20 },
    tiebanBookAnnualAge: 24,
    tiebanChenHuangjiKe: { dayHour: 0 },
    tiebanChenKinshipSequence: { series: 1, baseStep: 0, steps: [{ offset: 1327, multiplier: 1 }] },
    tiebanKunjiFacts: 'ignored even if malformed',
  });
  assert.deepEqual(older, standard);
  assert.equal(prompts[0], prompts[1]);
  assert.match(prompts[0], /铁板神数条文参考/u);
  assert.doesNotMatch(prompts[0], /长子木年生/u);
  assert.deepEqual(standard.tieban.results, [
    { axis: 'earlier', clauseId: 3784, status: 'unmatched', reason: 'not_in_catalog' },
    { axis: 'later', clauseId: 2666, status: 'unmatched', reason: 'not_in_catalog' },
  ]);
  const additional = standard.tieban.additionalCalculations;
  assert.ok(additional.some(row => row.results.some(result => result.claimId === 'tbss-v4-clauses-p04542-001')));
  assert.ok(additional.some(row => row.results.some(result => result.decadalPeriod)));
  assert.ok(additional.every(row => row.libraryEdition === 'muxuan-json' && row.results.length > 0
    && row.results.every(result => !result.requiresSelection && result.age === undefined)));
  const unknown = await request(bazi, false);
  assert.equal(unknown.tieban, undefined);

  const instant = Date.parse('1931-03-16T22:00:00Z');
  const calibrationFacts = chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000, 'male'));
  const calibration = await request({ ...bazi, birthYear: 1931,
    confirmedFacts: [...calibrationFacts, { kind: 'natal_gender', gender: '男' }] });
  const stemSequence = calibration.tieban.additionalCalculations.find(row => row.profile === 'chen-nineteen-methods-stem-sequence-v1');
  assert.deepEqual(stemSequence.results.find(row => row.clauseId === 10095), {
    axis: 'chen_stem_sequence_first_addition', clauseId: 10095, status: 'unmatched', reason: 'not_in_catalog',
  });
  assert.doesNotMatch(prompts.at(-1), /母命癸酉年生方合/u);
});

test('imports both original Claim collections and sends their confirmed matches alongside legacy rules', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-mixed-claims-'));
  context.after(() => { rmSync(join(directory, catalogFile), { force: true }); rmdirSync(directory); });
  const date = { year: 1990, month: 1, day: 1 };
  const bazi = calculateBaZi(Date.UTC(1990, 0, 1, 8), Date.UTC(1990, 0, 1, 16));
  const ziwei = calculateZiwei({ date, gender: 'male' }, 8);
  const chartQueries = Object.entries({ bazi, ziwei }).map(([method, chart]) => ({
    method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts: chartFacts[method](chart),
  }));
  const inventory = claimInventory();
  assert.equal(inventory.filter(({ method }) => method === 'bazi').length, 5334);
  assert.equal(inventory.filter(({ method }) => method === 'ziwei').length, 4209);
  const baziId = 'smth-v8-liuri-03-09-p007-101';
  const ziweiId = 'ziwei-v2-caibogong-p003-001';
  const hidden = inventory.find(({ claim }) => claim.id === 'smth-v7-temperament-p002-001');
  assert.equal(hidden.lookup.reason, 'uncertain_conditions');
  for (const [method, id, facts] of [
    ['bazi', baziId, chartQueries[0].confirmedFacts.filter((fact) => fact.position !== 'hour')],
    ['ziwei', ziweiId, [{ kind: 'palace_star', palace: '命宫', star: '天机', scope: 'origin' }]],
  ]) {
    assert.ok(!lookupClaims(method, chartContext(method, facts)).some((hit) => hit.id === id));
  }
  const output = await generateReport(parseInput({ timeKnown: true, chartQueries }), {
    lookup: createReportLookup(directory), signal: signal(),
    complete: async ({ references }) => {
      const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
      for (const id of [baziId, ziweiId]) {
        const match = hits.find((row) => row.id === id);
        const original = inventory.find(({ claim }) => claim.id === id).claim;
        assert.deepEqual(match, { ...original, evidence: { ...original.evidence, context: null },
          conditions: { original: original.conditions.original, normalized: original.conditions.normalized,
            uncertain: original.conditions.uncertain, excluded: original.conditions.excluded },
          method: inventory.find((row) => row.claim.id === id).method,
          matchedConditions: match.matchedConditions });
        assert.ok(match.matchedConditions.required.length);
      }
      assert.ok(hits.some((hit) => !inventory.some(({ claim }) => claim.id === hit.id)));
      assert.ok(!hits.some(({ id }) => id === hidden.claim.id));
      return '原样返回的解读';
    },
  });
  assert.equal(output.report, '原样返回的解读');
});

test('keeps the locally archived Ziwei rule out of the shipped catalog and reports', () => {
  const id = 'ziwei-v1-c017-p101004-001';
  assert.equal(claimInventory().some(({ claim }) => claim.id === id), false);
  assert.equal([...structuredClaimMappings()].some(row => row.id === id), false);
  assert.equal(pendingClaimConditions({ includeSkipped: true }).some(row => row.id === id), false);
  const chart = chartContext('ziwei', chartFacts.ziwei(calculateZiwei({ date: { year: 1988, month: 1, day: 4 }, gender: 'male' }, 8)));
  assert.equal(lookupClaims('ziwei', chart).some((row) => row.id === id), false);
  assert.equal(explainClaim(id, 'ziwei', chart), null);
});

test('a sourced career passage keeps its own topic and excludes the unresolved marriage judgment', async () => {
  const id = 'smth-v9-liuri-10-09-p012-001';
  const wallTime = Date.UTC(1969, 8, 5, 16);
  const chart = calculateBaZi(wallTime - 8 * 3600000, wallTime);
  const facts = chartFacts.bazi(chart);
  const matches = lookupClaims('bazi', chartContext('bazi', facts));
  const hit = matches.find((row) => row.id === id);
  assert.equal(hit.topic, '事业');
  assert.equal(hit.originalTopic, '爱情');
  const prompt = claimForPrompt(hit);
  assert.equal(prompt.category.topic, '事业');
  assert.equal(prompt.originalCategory.topic, '爱情');
  assert.equal(prompt.evidence.original_text, '酉申年月三四品');
  assert.doesNotMatch(prompt.evidence.original_text, /妻賢子孝|榮華在後/u);
  const missingYear = chartContext('bazi', facts.filter(({ position }) => position !== 'year'));
  assert.equal(lookupClaims('bazi', missingYear).some((row) => row.id === id), false);
  await generateReport(parseInput({ timeKnown: true, chartQueries: [{ ...query, confirmedFacts: facts }] }), {
    signal: signal(),
    lookup: () => [{ topicId: 'career', topic: '事业', personality: [], events: matches.filter((row) => row.id === id) }],
    complete: async ({ references }) => {
      assert.equal(references.find(({ topicId }) => topicId === 'career').events.find((row) => row.id === id).category.topic, '事业');
      assert.ok(references.filter(({ topicId }) => topicId !== 'career').every(({ personality, events }) =>
        [...personality, ...events].every((row) => row.id !== id)));
      return '按命中分句解读。';
    },
  });
});

test('requires confirmed four-pillar exclusions and uses the calculated xun of each pillar', () => {
  const chart = (year, month, day, hour) => chartFacts.bazi(describeBaZiPillars({ year, month, day, hour }));
  const hit = (id, facts) => lookupClaims('bazi', chartContext('bazi', facts)).find((entry) => entry.id === id);
  const absence = 'smth-v8-liuri-03-09-p018-101';
  const facts = chart('甲寅', '丁卯', '丙戌', '丙申');
  assert.equal(hit(absence, facts).matchedConditions.absent.length, 20);
  assert.equal(hit(absence, facts.filter(({ kind, position }) => kind !== 'branch' || position !== 'month')), undefined);
  assert.equal(hit(absence, chart('壬寅', '丁卯', '丙戌', '丙申')), undefined);

  const oneXun = 'smth-v12-gold-voice-p072-001';
  assert.equal(hit(oneXun, chart('甲子', '丙寅', '丙寅', '戊子')), undefined);
  const matched = hit(oneXun, chart('甲子', '丙寅', '丙寅', '戊辰'));
  assert.deepEqual(matched.matchedConditions.required.map(({ head }) => head), Array(4).fill('甲子'));
});

test('matches the updated independent Ziwei records by their own palace, companion and brightness', () => {
  const star = (palace, name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const hit = (id, facts) => lookupClaims('ziwei', chartContext('ziwei', facts)).find((entry) => entry.id === id);
  const wealth = 'ziwei-v2-caibogong-p101007-001';
  const main = star('财帛', '天同');
  const separate = claimForPrompt(hit(wealth, [main, star('迁移', '巨门')]));
  assert.deepEqual(separate.evidence, { original_text: '天同白手生财晚发', context: null });
  const companionId = 'ziwei-v2-caibogong-p101007-002';
  assert.equal(hit(companionId, [main, star('迁移', '巨门')]), undefined);
  const together = claimForPrompt(hit(companionId, [main, star('财帛', '巨门')]));
  assert.equal(together.evidence.original_text, '巨门同财气进退');
  assert.doesNotMatch(together.evidence.original_text, /天梁|空劫/u);
  assert.equal(hit('ziwei-v2-guanlugong-p101022-001', [star('官禄', '禄存')]), undefined);

  const wenqu = star('子女', '文曲');
  const brightness = (level) => ({ ...wenqu, kind: 'palace_brightness', brightness: level });
  const children = 'ziwei-v2-c005-p101026-001';
  assert.equal(hit(children, [wenqu]), undefined);
  assert.equal(hit(children, [wenqu, brightness('陷')]), undefined);
  assert.equal(hit('ziwei-v2-c005-p101026-002', [wenqu, brightness('陷')]).basis, '陷地有二三人');
  assert.equal(hit(children, [wenqu, brightness('庙')]).basis, '文曲庙旺有四人');
});

test('uses the Western source groups on calculated tropical charts without substituting house systems', async (context) => {
  const place = { latitude: 0, longitude: 0 };
  const date = Date.UTC(1990, 5, 4, 12);
  const day = chartFacts.western(calculateWestern(date, place));
  const night = chartFacts.western(calculateWestern(date - 12 * 3600000, place));
  assert.ok(day.some((fact) => fact.kind === 'western_sect' && fact.sect === 'day'));
  assert.ok(night.some((fact) => fact.kind === 'western_sect' && fact.sect === 'night'));
  const query = { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: day };
  const lookup = (facts) => lookupClaims('western', chartContext('western', facts));
  const gemini = 'astro-alan-leo-v1-gemini-p001-001';
  const hit = lookup(day).find(({ id }) => id === gemini);
  assert.ok(hit.matchedConditions.required.some((fact) => fact.kind === 'western_zodiac'));
  assert.equal(lookup(day.filter(({ kind }) => kind !== 'western_zodiac')).some(({ id }) => id === gemini), false);
  assert.equal(lookup(day).some(({ id }) => id === 'astro-lilly-v3-wealth-level-p002-001'), false);
  const [unknownTime] = parseChartQueries([query], { timeKnown: false });
  assert.ok(unknownTime.confirmedFacts.every(({ kind }) => !['angle_sign', 'western_sect', 'planet_house'].includes(kind)));
  const western = [...structuredClaimMappings()].filter(({ method }) => method === 'western');
  assert.equal(western.length, 1619);
  assert.equal(western.some(({ id }) => id === 'astro-ptolemy-v3-soul-p001-001'), false);
  const regio = western.find(({ id }) => id === 'astro-lilly-v3-wealth-level-p002-001');
  assert.equal(regio.status, 'indexed');
  assert.ok(regio.inputs.every(input => input.required.some(fact => fact.kind === 'western_lilly_ruleset')));
  const wit = western.find(({ id }) => id === 'astro-lilly-v3-wit-p012-001');
  assert.equal(wit.status, 'indexed');
  assert.deepEqual(wit.inputs.map(input => input.required[0].table), ['main', 'other']);
  assert.ok(wit.inputs.every(({ required: [fact] }) => fact.kind === 'western_lilly_aspect'
    && fact.first === 'mercury' && fact.second === 'sun' && fact.aspect === 'conjunction' && fact.matches));

  const directory = mkdtempSync(join(tmpdir(), 'destiny-western-claims-'));
  context.after(() => { rmSync(join(directory, catalogFile), { force: true }); rmdirSync(directory); });
  const output = await generateReport(parseInput({ timeKnown: true, chartQueries: [query] }), {
    lookup: createReportLookup(directory), signal: signal(),
    complete: async ({ references }) => {
      const matches = references.flatMap(({ personality, events }) => [...personality, ...events]);
      assert.deepEqual(matches.find(({ id }) => id === gemini), claimForPrompt(hit));
      return '星盘解读';
    },
  });
  assert.deepEqual(output, { report: '星盘解读' });
});

test('separate BaZi season passages cannot match without their own season', () => {
  const id = 'smth-v9-liuri-06-12-p020-101';
  const lookup = (month) => lookupClaims('bazi', chartContext('bazi', chartFacts.bazi(
    describeBaZiPillars({ year: '己巳', month, day: '己酉', hour: '乙亥' })))).find((row) => row.id === id);
  assert.deepEqual(lookup('丙寅').matchedBranches.map(({ text }) => text), ['春夏顯達']);
  assert.equal(lookup('壬申'), undefined);
  assert.deepEqual(lookup('乙亥').matchedBranches.map(({ text }) => text), ['冬財旺']);
});

test('the six-day hour judgment recognizes its stated two-branch punishment', () => {
  const id = 'smth-v8-liuri-01-06-p007-103';
  const natal = { year: '庚辰', month: '壬午', day: '甲寅', hour: '己巳' };
  const lookup = (pillars) => lookupClaims('bazi', chartContext('bazi', chartFacts.bazi(describeBaZiPillars(pillars))))
    .some((row) => row.id === id);
  assert.equal(lookup(natal), true);
  assert.equal(lookup({ ...natal, hour: '庚午' }), false);
});

test('a Ziwei negative condition requires a complete origin star list for its own palace', () => {
  const id = 'ziwei-v2-fuqigong-p101003-003';
  const palace = '夫妻';
  const star = (name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const count = (value) => ({ kind: 'palace_origin_star_count', palace, count: value });
  const fields = [star('太阳'), star('巨门')];
  const lookup = (facts) => lookupClaims('ziwei', chartContext('ziwei', facts)).find((row) => row.id === id);
  assert.equal(lookup(fields), undefined);
  assert.equal(lookup([...fields, count(3)]), undefined);
  assert.equal(lookup([...fields, count(2)]).basis, '巨门同无羊陀火铃空劫不克');
  assert.equal(lookup([...fields, star('火星'), count(3)]), undefined);
});

test('a minor Ziwei star stands alone only with a complete origin list and no other core star', () => {
  const id = 'ziwei-v2-c008-p101022-001';
  const palace = '迁移';
  const star = (name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const lookup = (...facts) => lookupClaims('ziwei', chartContext('ziwei', [...facts, star('火星')]))
    .find((row) => row.id === id);
  const count = { kind: 'palace_origin_star_count', palace, count: 2 };
  assert.equal(lookup({ kind: 'palace_core_star_count', palace, count: 1 }), undefined);
  assert.equal(lookup(count), undefined);
  assert.equal(lookup(count, star('铃星')), undefined);
  assert.equal(lookup(count, star('天姚')).basis, '火星独守出外不安');
});

test('Ziwei trine-sector matches require a confirmed aspect for each star outside the anchor palace', () => {
  const id = 'ziwei-v3-c020-p102020-001';
  const anchor = '命宫';
  const facts = [
    { kind: 'palace_star', palace: anchor, star: '紫微', scope: 'origin' },
    { kind: 'palace_star', palace: '财帛', star: '文昌', scope: 'origin' },
    { kind: 'palace_star', palace: '迁移', star: '文曲', scope: 'origin' },
    { kind: 'palace_relation', anchor, target: '财帛', relation: 'trine' },
  ];
  const lookup = (...extra) => lookupClaims('ziwei', chartContext('ziwei', [...facts, ...extra])).some((row) => row.id === id);
  assert.equal(lookup({ kind: 'palace_sector_star', palace: anchor, star: '文曲' }), false);
  assert.equal(lookup({ kind: 'palace_relation', anchor, target: '迁移', relation: 'opposite' }), true);
});

test('Ziwei auspicious transformation and brightness must belong to the same major star', () => {
  const id = 'ziwei-v3-c001-p101011-001';
  const palace = '命宫';
  const scope = 'origin';
  const facts = [
    { kind: 'palace_star', palace, star: '太阴', scope },
    { kind: 'palace_star', palace, star: '天同', scope },
    { kind: 'palace_star', palace, star: '火星', scope },
    { kind: 'palace_brightness', palace, star: '太阴', brightness: '庙', scope },
    { kind: 'palace_brightness', palace, star: '天同', brightness: '陷', scope },
    { kind: 'palace_major_state', palace, state: '庙旺化吉' },
    { kind: 'palace_mutagen_brightness', palace, change: '科', brightness: '陷' },
    { kind: 'palace_star', palace: '财帛', star: '文曲', scope },
    { kind: 'palace_relation', anchor: palace, target: '财帛', relation: 'trine' },
  ];
  const lookup = (star, expected = id) => lookupClaims('ziwei', chartContext('ziwei', [
    ...facts, { kind: 'star_mutagen', palace, star, change: '科', scope },
  ])).some((row) => row.id === expected);
  assert.equal(lookup('天同'), false);
  assert.equal(lookup('太阴'), true);
  assert.equal(lookup('太阴', 'ziwei-v1-c010-p101018-001'), false);
  assert.equal(lookup('天同', 'ziwei-v1-c010-p101018-001'), true);
});

test('Ziwei official-talisman passages require the natal Suiqian cycle', () => {
  const expected = 'ziwei-v1-c007-p101014-001';
  const birth = { date: { year: 1941, month: 2, day: 16 }, gender: 'male' };
  const facts = chartFacts.ziwei(calculateZiwei(birth, 11));
  const lookup = (supplied) => lookupClaims('ziwei', chartContext('ziwei', supplied)).some(({ id }) => id === expected);
  assert.equal(lookup(facts), true);
  assert.equal(lookup(facts.filter(({ kind }) => kind !== 'palace_suiqian_star').concat({
    kind: 'palace_jiangqian_star', palace: '迁移', star: '官符',
  })), false);
});

test('Ziwei malefic count needs complete origin lists in the four proven sectors', () => {
  const id = 'ziwei-v3-c020-p102004-001';
  const anchor = '命宫';
  const scope = 'origin';
  const palaces = { 命宫: ['紫微', '擎羊', '地空'], 财帛: ['火星'], 官禄: ['铃星'], 迁移: ['地劫'] };
  const stars = Object.entries(palaces).flatMap(([palace, names]) => names.map((star) => ({ kind: 'palace_star', palace, star, scope })));
  const positions = [
    { kind: 'palace_branch', palace: anchor, branch: '卯' },
    { kind: 'palace_relation', anchor, target: '财帛', relation: 'trine' },
    { kind: 'palace_relation', anchor, target: '官禄', relation: 'trine' },
    { kind: 'palace_relation', anchor, target: '迁移', relation: 'opposite' },
  ];
  const counts = Object.entries(palaces).map(([palace, names]) => ({ kind: 'palace_origin_star_count', palace, count: names.length }));
  const claimed = { kind: 'palace_sector_malefic_count', palace: anchor, count: 3 };
  const lookup = (complete) => lookupClaims('ziwei', chartContext('ziwei', [...stars, ...positions, ...complete, claimed]))
    .some((row) => row.id === id);
  assert.equal(lookup(counts.slice(0, -1)), false);
  assert.equal(lookup(counts), true);
});

test('BaZi mutual void requires both named pillars to occupy each other’s xun void', () => {
  const id = 'smth-v3-void-p003-003';
  const lookup = (day) => lookupClaims('bazi', chartContext('bazi', chartFacts.bazi(describeBaZiPillars({
    year: '甲子', month: '丁卯', day, hour: '甲辰',
  })))).find((row) => row.id === id);
  assert.ok(lookup('壬戌'));
  assert.equal(lookup('甲戌'), undefined);
});

test('BaZi three-wealth passage requires the controlled elements of the year stem, branch and Nayin', () => {
  const id = 'smth-v7-female-discourse-p005-002';
  const pillars = { year: '戊子', month: '甲寅', day: '壬戌', hour: '壬寅' };
  const gender = { kind: 'natal_gender', gender: '女' };
  const proposed = { kind: 'bazi_natal_configuration', name: '禄命身三财齐' };
  const lookup = (...facts) => lookupClaims('bazi', chartContext('bazi', facts)).find((row) => row.id === id);
  const facts = (day) => chartFacts.bazi(describeBaZiPillars({ ...pillars, day }));
  assert.equal(lookup(...facts('壬戌'), { ...gender, gender: '男' }), undefined);
  assert.equal(lookup(...facts('壬子'), gender, proposed), undefined);
  assert.deepEqual(lookup(...facts('壬戌'), gender).matchedBranches.map(({ text }) => text), ['得祿命身三財則夫榮子貴']);
});

test('BaZi seasonal-fire passage requires a fire Nayin and an actually water-free natal chart', () => {
  const id = 'smth-v4-season-fire-p002-001';
  const pillars = { year: '戊午', month: '乙卯', day: '丁卯', hour: '乙巳' };
  const assertedAbsent = { kind: 'bazi_natal_element', element: '水' };
  const lookup = (replacement = {}) => lookupClaims('bazi', chartContext('bazi',
    chartFacts.bazi(describeBaZiPillars({ ...pillars, ...replacement })), [assertedAbsent]))
    .some((row) => row.id === id);
  assert.equal(lookup(), true);
  assert.equal(lookup({ hour: '辛亥' }), false);
  assert.equal(lookup({ year: '庚午' }), false);
});

test('BaZi true school and academy require both positions to match the year Nayin', () => {
  const id = 'smth-v3-school-p007-001';
  const pillars = { year: '乙酉', month: '甲申', day: '癸亥', hour: '壬子' };
  const claimedSchool = { kind: 'bazi_nayin_school', position: 'month', school: '真学堂' };
  const lookup = (year) => lookupClaims('bazi', chartContext('bazi', [
    ...chartFacts.bazi(describeBaZiPillars({ ...pillars, year })), claimedSchool,
  ])).find((row) => row.id === id);
  assert.equal(lookup('辛酉'), undefined);
  assert.deepEqual(lookup('乙酉').matchedBranches.map(({ text }) => text), ['生來祿馬眞學堂若同詞館主文章']);
});

test('BaZi reciprocal Lu requires both stems to reach Lin Guan in the other pillar', () => {
  const id = 'smth-v8-liuri-04-07-p018-101';
  const expected = { year: '甲寅', month: '己巳', day: '丁巳', hour: '丙午' };
  const proposed = { kind: 'bazi_natal_configuration', name: '日时互换禄' };
  const lookup = (day) => lookupClaims('bazi', chartContext('bazi', [
    ...chartFacts.bazi(describeBaZiPillars({ ...expected, day })), proposed,
  ])).some((rule) => rule.id === id);
  assert.equal(lookup('丁巳'), true);
  assert.equal(lookup('丁未'), false);
});

test('BaZi day-noble matching needs both the sect and confirmed void exclusions', () => {
  const id = 'smth-v6-day-noble-p002-001';
  const natal = describeBaZiPillars({ year: '甲子', month: '丁卯', day: '癸巳', hour: '壬子' });
  const facts = chartFacts.bazi(natal);
  const lookup = (data, sect) => lookupClaims('bazi', chartContext('bazi', [...data, { kind: 'natal_daylight', sect }]))
    .some((row) => row.id === id);
  assert.equal(lookup(facts, 'night'), true);
  assert.equal(lookup(facts, 'day'), false);
  assert.equal(lookup(facts.filter(({ kind, position }) => kind !== 'pillar' || position !== 'month'), 'night'), false);
});

test('BaZi floating sha matches only the palace obtained from one confirmed principal term', () => {
  const id = 'smth-v3-spirits-p020-001';
  const atHour = (hour) => {
    const birth = Date.UTC(1990, 0, 1, hour);
    return chartFacts.bazi(calculateBaZi(birth - 8 * 3600000, birth));
  };
  const passages = (facts) => lookupClaims('bazi', chartContext('bazi', facts))
    .find((row) => row.id === id)?.matchedBranches.map(({ text }) => text);
  const wealth = atHour(20);
  const home = atHour(16);
  const qi = (term) => ({ kind: 'bazi_previous_qi', term });

  assert.deepEqual(passages(wealth), ['只在財帛宫名串錢主富蓄']);
  assert.deepEqual(passages(home), ['在田宅則主破祖']);
  assert.equal(passages([...wealth, qi('小雪')]), undefined);
  const withoutQi = wealth.filter(({ kind }) => kind !== 'bazi_previous_qi');
  assert.throws(() => passages([...withoutQi, qi('芒种')]), /Invalid fields for bazi_previous_qi/u);
  assert.equal(passages([...withoutQi, qi('大暑')]), undefined);
  assert.equal(passages([...withoutQi, { kind: 'bazi_natal_configuration', name: '浮沉煞落财帛宫' }]), undefined);
});

test('BaZi three-wonders exclusions require one confirmed natal gender', () => {
  const id = 'smth-v3-heaven-wonders-p003-001';
  const birth = Date.UTC(1915, 9, 13, 22);
  const facts = chartFacts.bazi(calculateBaZi(birth - 8 * 3600000, birth));
  const daylight = { kind: 'natal_daylight', sect: 'night' };
  const male = { kind: 'natal_gender', gender: '男' };
  const female = { kind: 'natal_gender', gender: '女' };
  const assertedAbsence = ['year', 'month', 'day', 'hour'].map((position) => ({
    kind: 'shen_sha', position, name: '元辰',
  }));
  const lookup = (gender, absent = []) => lookupClaims('bazi', chartContext('bazi', [...facts, daylight, ...gender], absent))
    .some((row) => row.id === id);

  assert.equal(lookup([male]), true);
  assert.equal(lookup([], assertedAbsence), false);
  assert.equal(lookup([male, female]), false);
});

test('Ziwei grade Claims combine calculated star and number grades with complete natal evidence', () => {
  const id = 'ziwei-v3-c003-p111000-001';
  const chart = calculateZiwei({ date: { year: 1987, month: 7, day: 6 }, gender: 'female' }, 10);
  const facts = chartFacts.ziwei(chart);
  const lookup = (data) => lookupClaims('ziwei', chartContext('ziwei', data)).find((row) => row.id === id);
  const claimedGrade = { kind: 'ziwei_grade', dimension: 'number', grade: '中' };

  assert.equal(claimForPrompt(lookup(facts)).mappingSource.book, '紫微斗数精成');
  assert.equal(lookup([...facts.filter(({ kind }) => kind !== 'natal_ziwei_life_phase'), claimedGrade]), undefined);
  assert.equal(lookup(facts.filter(({ kind, palace }) => kind !== 'palace_origin_star_count' || palace !== '官禄')), undefined);
});

test('a Ziwei transformation exclusion requires all four natal transformations', () => {
  const id = 'ziwei-v3-c020-p102001-001';
  const fields = [
    { kind: 'natal_year_stem', stem: '甲' },
    { kind: 'palace_branch', palace: '命宫', branch: '午' },
    { kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' },
    { kind: 'palace_origin_star_count', palace: '命宫', count: 1 },
  ];
  const change = (name, palace) => ({ kind: 'palace_mutagen', palace, change: name, scope: 'origin' });
  const known = [change('禄', '兄弟'), change('权', '官禄'), change('科', '迁移')];
  const lookup = (...transformations) => lookupClaims('ziwei', chartContext('ziwei', [...fields, ...transformations]))
    .find((row) => row.id === id);
  assert.equal(lookup(...known), undefined);
  assert.equal(lookup(...known, change('忌', '命宫')), undefined);
  assert.equal(lookup(...known, change('忌', '福德'), change('忌', '迁移')), undefined);
  assert.deepEqual(lookup(...known, change('忌', '福德')).matchedBranches.map(({ text }) => text),
    ['紫微居午无刑忌甲丁己命至公卿']);
});

test('a Ziwei clause keeps the final character of 天同 before the placement verb', () => {
  const id = 'ziwei-v2-minggong-p133001-001';
  const placement = { kind: 'palace_star', palace: '命宫', star: '天同', scope: 'origin' };
  const lookup = (brightness) => lookupClaims('ziwei', chartContext('ziwei', [
    placement, { ...placement, kind: 'palace_brightness', brightness },
  ])).find((row) => row.id === id);
  assert.equal(lookup('陷'), undefined);
  assert.ok(lookup('庙').matchedConditions.required.some(({ kind, star, brightness }) =>
    kind === 'palace_brightness' && star === '天同' && brightness === '庙'));
});

test('a classical Ziwei table row keeps its branch, brightness, year stem and companion tied together', () => {
  const id = 'ziwei-v2-minggong-p126000-001';
  const palace = '命宫';
  const star = (name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const birthStem = (stem) => ({ kind: 'natal_year_stem', stem });
  const branch = (name) => ({ kind: 'palace_branch', palace, branch: name });
  const lookup = (facts) => lookupClaims('ziwei', chartContext('ziwei', facts)).find((row) => row.id === id);
  const fields = [star('武曲'), branch('子'), birthStem('丁'), { ...star('武曲'), kind: 'palace_brightness', brightness: '旺' }];
  assert.equal(lookup(fields), undefined);
  assert.equal(lookup([...fields, star('天府')]).basis, '子午宫旺地，与天府同度，丁己庚生人财官格。');
  assert.equal(lookup([...fields.filter(({ kind }) => kind !== 'natal_year_stem'), birthStem('乙'), star('天府')]), undefined);
  assert.equal(lookup([...fields.filter(({ kind }) => kind !== 'palace_branch'), branch('卯'), star('天府')]), undefined);
});

test('BaZi absence checks visible and hidden ten gods and temperament uses the named calculation profile', () => {
  const chart = (year) => describeBaZiPillars({ year, month: '己亥', day: '辛亥', hour: '戊子' });
  const lookup = (facts) => lookupClaims('bazi', chartContext('bazi', facts));
  const id = 'smth-v9-liuri-08-01-p021-001';
  const natal = chart('辛酉');
  const facts = chartFacts.bazi(natal);
  assert.ok(lookup(facts).some((row) => row.id === id));
  assert.ok(!lookup(chartFacts.bazi(chart('庚午'))).some((row) => row.id === id));
  assert.ok(!lookup(facts.filter(({ kind, position }) => kind !== 'hidden_ten_god' || position !== 'month')).some((row) => row.id === id));
  const { method, indicators } = analyzeBaZi(natal).L2.assessments.fiveElementStrength.temperament;
  const matches = lookup([...facts, ...indicators.map(({ element, classification }) =>
    ({ kind: 'bazi_element_temperament', element, classification, profile: method }))]);
  const hit = matches.find((row) => row.id.startsWith('smth-v7-temperament-'));
  assert.ok(hit);
  assert.match(claimForPrompt(hit).interpretation.limitations.join(''), /五行权重/u);
});

test('the two-pillar combination cannot combine a stem pair with an unrelated punishment', () => {
  const id = 'smth-v6-punish-combine-p002-001';
  const lookup = (pillars, extra = []) => lookupClaims('bazi', chartContext('bazi', [...chartFacts.bazi(describeBaZiPillars(pillars)), ...extra]))
    .find((row) => row.id === id);
  const base = { year: '甲子', month: '己卯', day: '戊辰', hour: '庚申' };
  const hit = lookup(base);
  assert.ok(hit.matchedConditions.required.some(({ kind, first, second }) => kind === 'bazi_branch_relation' && first === 'year' && second === 'month'));
  const unrelated = { ...base, month: '己巳', day: '丁卯' };
  assert.equal(lookup(unrelated), undefined);
  assert.equal(lookup(unrelated, [{ kind: 'bazi_branch_relation', relation: '相刑', first: 'year', second: 'month' }]), undefined);
});

test('Daozang uses its own stars, calendar projection and the cited day-three boundary', () => {
  const birth = { yearBranch: '寅', month: 1, day: 3, hour: 8, leap: false };
  const projected = daozangChartFacts(birth);
  const position = (star) => projected.find((fact) => fact.kind === 'daozang_star_branch' && fact.star === star)?.branch;
  assert.equal(position('紫微'), '酉');
  assert.equal(position('天杖'), '子');
  assert.equal(position('天异'), '亥');
  assert.ok(projected.some((fact) => fact.kind === 'daozang_palace_star' && fact.palace === '命宫' && fact.star === '天贵' && fact.relation === 'occupies'));
  const onBody = (hour, star) => daozangChartFacts({ ...birth, hour }).some((fact) =>
    fact.kind === 'daozang_palace_star' && fact.palace === '身宫' && fact.star === star && fact.relation === 'occupies');
  assert.ok(onBody(6, '天杖'));
  assert.ok(onBody(7, '天异'));
  const scope = (facts) => lookupClaims('ziwei', chartContext('ziwei', facts)).find((row) => row.id === 'ziwei-v2-daozang-153-p229-002');
  assert.ok(scope([{ kind: 'ziwei_daozang_input', ...birth }]));
  assert.equal(scope([{ kind: 'ziwei_daozang_input', ...birth, leap: true }]), undefined);
  assert.equal(scope([{ kind: 'palace_star', palace: '命宫', star: '天贵', scope: 'origin' }]), undefined);
});

test('Daozang middle-hour passages use the exact birth minute in the civil two-hour interval', () => {
  const id = 'ziwei-v1-daozang-040-p073-001';
  const input = (hour, minute) => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts: chartFacts.ziwei(calculateZiwei({ date: { year: 1980, month: 1, day: 18 }, gender: 'male',
      time: { timeKnown: true, hour, minute } }, 8)) });
  const lookup = (hour, minute, timeKnown = true) => {
    const [parsed] = parseChartQueries([input(hour, minute)], { timeKnown });
    return lookupClaims('ziwei', chartContext('ziwei', parsed.confirmedFacts)).some((row) => row.id === id);
  };
  assert.equal(lookup(15, 39), false);
  assert.equal(lookup(15, 40), true);
  assert.equal(lookup(16, 19), true);
  assert.equal(lookup(16, 20), false);
  assert.equal(lookup(16, 0, false), false);
});

test('each mapped Daozang Claim can match a chart in its own projection', () => {
  const remaining = new Map([...structuredClaimMappings()].filter(({ id, branches }) => id.includes('-daozang-') && branches.length)
    .map(({ id, branches }) => [id, branches.flatMap(({ inputs }) => inputs.map(({ required }) => required.map((fact) => JSON.stringify(fact))))]));
  const genderKeys = ['男', '女'].map((gender) => JSON.stringify({ kind: 'natal_gender', gender }));
  assert.ok(remaining.size > 0);
  search: for (const yearBranch of '子丑寅卯辰巳午未申酉戌亥') {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 30; day++) {
        for (const [hour, branch] of [...'子丑寅卯辰巳午未申酉戌亥'].entries()) {
          const keys = new Set(daozangChartFacts({ yearBranch, month, day, hour, leap: false }).map((fact) => JSON.stringify(fact)));
          const bandKeys = ['early', 'middle', 'late'].map((band) => JSON.stringify({ kind: 'natal_ziwei_time_band', branch, band }));
          for (const [id, groups] of remaining) if (groups.some((group) => bandKeys.some((bandKey) => genderKeys.some((genderKey) =>
            group.every((key) => keys.has(key) || key === bandKey || key === genderKey))))) remaining.delete(id);
          if (!remaining.size) break search;
        }
      }
    }
  }
  assert.deepEqual([...remaining.keys()], []);
});
