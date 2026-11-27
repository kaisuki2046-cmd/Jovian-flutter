import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { baziAnnualLuckContext, baziSmthTaiSuiContext, smthLuNextBranch, smthMajorLuckNaYin,
  baziAnnualLuckPolicy } = await import('./control/bazi-annual-luck.ts');
const { smthMonthDuty, smthMonthDutyPolicy } = await import('./control/bazi-smth-month-duty.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/bazi-annual-luck-reference.json', import.meta.url)));
const careerIndex = 7, wealthIndex = 8;
const indices = [0, 3, 5, careerIndex, wealthIndex, 18];
function archive(example = reference.realExamples.common) {
  const { year, month, day, hour, gender } = example, lunar = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  const luckPeriods = lunar.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
    .map(s => ({ ganZhi: s.getGanZhi(), startAge: s.getStartAge(), endAge: s.getEndAge() }));
  return { timeKnown: true, bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: new Date(Date.UTC(year, month - 1, day, hour - 8)).toISOString(),
      year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), day: lunar.getDayInGanZhiExact(), hour: lunar.getTimeInGanZhi(),
      luckPeriods, tenGods: {}, shenSha: {} }] }, ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
function calculate(chart = archive(), year = 2004) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const time = buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'annual-luck-run', { snapshotId: 'annual-luck-snapshot', chart });
}
function clientRunWithClock(birth, year) {
  const chart = archive(birth);
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const asOf = Date.UTC(year, 5, 15), reference = { snapshotId: 'annual-luck-' + year + '-' + birth.month + '-' + birth.day + '-' + birth.hour };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  return { run, reference };
}
const result = (run, index) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId);
const specific = run => run.facts.filter(f => f.factType === 'annual_luck_context');
const cache = new Map();
const realRun = year => {
  if (!cache.has(year)) cache.set(year, calculate(archive(), year));
  return cache.get(year);
};

test('the source ten-stem Lu-next-branch table is explicit and year/day bases stay separate rather than copying generic Diwang', () => {
  assert.equal(reference.profile, baziAnnualLuckPolicy.profile);
  reference.stems.forEach((stem, i) => assert.deepEqual(smthLuNextBranch(stem), { luBranch: reference.luBranches[i], bladeBranch: reference.luNextBranches[i] }));
  assert.equal(smthLuNextBranch('乙').bladeBranch, '辰'); assert.equal(smthLuNextBranch('辛').bladeBranch, '戌');
  for (const stem of ['', '甲乙', '木']) assert.throws(() => smthLuNextBranch(stem));
  const natal = archive().bazi.rawResult[0], before = structuredClone(natal);
  const value = baziAnnualLuckContext(natal, true, '甲申', '甲申');
  assert.equal(value.dayMaster, '丁'); assert.equal(value.dayBasisBladeBranch, '未'); assert.equal(value.yearBasisBladeBranch, '酉');
  assert.equal(value.bladeBasisAgrees, false); assert.equal(value.bladeEffect, 'unresolved-source-basis-and-restraint');
  assert.deepEqual(natal, before);
});

test('full-pillar coincidence, stem-only and branch-only equality are distinct, with source relationships bound to the same two pillars', () => {
  const natal = archive().bazi.rawResult[0];
  const full = baziAnnualLuckContext(natal, true, '甲申', '甲申');
  assert.equal(full.samePillar, true); assert.ok(full.yearLuckRelations.includes('同柱'));
  const stem = baziAnnualLuckContext(natal, true, '壬寅', '壬午');
  assert.equal(stem.samePillar, false); assert.equal(stem.sameStem, true); assert.equal(stem.sameBranch, false);
  const branch = baziAnnualLuckContext(natal, true, '丙午', '壬午');
  assert.equal(branch.samePillar, false); assert.equal(branch.sameStem, false); assert.equal(branch.sameBranch, true);
  assert.ok(branch.yearLuckRelations.includes('天干四冲'));
  const invalid = { ...natal, day: '甲丑' }; assert.throws(() => baziAnnualLuckContext(invalid, true, '甲申', '甲申'));
  const unknown = baziAnnualLuckContext({ ...natal, hour: 'unknown' }, false, '甲申', '甲申');
  assert.equal(unknown.natalHour, undefined); assert.ok(!unknown.natalDayBasisBladePositions.includes('hour'));
});

test('wealth in main qi, non-main hidden qi and nowhere in the branch are three separate cases', () => {
  const natal = archive().bazi.rawResult[0];
  const si = baziAnnualLuckContext(natal, true, '戊申', '辛巳');
  assert.equal(si.luckStemWealth, true); assert.equal(si.luckMainQiWealth, false); assert.equal(si.luckAnyHiddenWealth, true);
  assert.equal(si.luckBranchWealthAbsent, undefined);
  assert.ok(si.luckHiddenTenGods.includes('正财'));
  assert.deepEqual(si.natalWealthRoots.map(({ layer, stem, sameStem }) => [layer, stem, sameStem]),
    [['month', '辛', true], ['day', '辛', true]]);
  const chen = baziAnnualLuckContext(natal, true, '戊午', '庚辰');
  assert.equal(chen.luckStemWealth, true); assert.equal(chen.luckAnyHiddenWealth, false);
  assert.equal(chen.luckBranchWealthAbsent, true);
  assert.deepEqual(chen.natalWealthRoots.map(({ layer, stem, sameStem }) => [layer, stem, sameStem]),
    [['month', '辛', false], ['day', '辛', false]]);
  const you = baziAnnualLuckContext(natal, true, '戊午', '辛酉');
  assert.equal(you.luckMainQiWealth, true); assert.equal(you.luckBranchWealthAbsent, false);
  const built = baziAnnualLuckContext(archive(reference.realExamples.builtLu).bazi.rawResult[0], true, '丙午', '辛巳');
  assert.equal(built.monthBuiltLu, true); assert.equal(built.dayLuBranch, '酉'); assert.equal(built.luckTenGod, '比肩');
});

test('exposed and hidden killer witnesses share a column without counting twice, and combination stays separate from food control', () => {
  const natal = { year: '丁未', month: '癸丑', day: '辛酉', hour: '癸巳' };
  const single = baziAnnualLuckContext(natal, true, '己亥', '丙辰');
  assert.deepEqual(single.natalKillerPositions.map(({ layer, placement }) => [layer, placement]),
    [['year', '天干'], ['year', '支非本气']]);
  assert.deepEqual(single.singleKillerControlColumns, ['month', 'hour']);
  const multiple = baziAnnualLuckContext({ ...natal, day: '辛未' }, true, '己亥', '丙辰');
  assert.ok(multiple.natalKillerPositions.some(witness => witness.layer === 'day'));
  assert.equal(multiple.singleKillerMultipleFoodControls, undefined);

  const combination = baziAnnualLuckContext({ ...natal, hour: '壬辰' }, true, '己亥', '丙辰');
  assert.deepEqual(combination.natalKillerCombinations, [{ columns: ['year', 'hour'], stems: '丁壬' }]);
  assert.equal(combination.singleKillerMultipleFoodControls, undefined);
});

test('a real 2004 overlap reaches SQLite only after Li Chun; same-stem 2022 and same-branch 2026 are not coincidence candidates', () => {
  const run = realRun(2004); validateFortuneFacts(run);
  const match = result(run, 3); assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: reference.realExamples.liChunCoincidenceStart, endExclusive: '2004-12-31T16:00:00.000Z' }]);
  const facts = specific(run).filter(f => f.normalizedPayload.samePillar);
  assert.ok(facts.length && facts.every(f => f.normalizedPayload.yearPillar === '甲申' && f.normalizedPayload.luckPillar === '甲申' && f.normalizedPayload.confirmed));
  assert.ok(match.sourceFactIds.every(id => facts.some(f => f.factId === id)));
  for (const [year, field] of [[2022, 'sameStem'], [2026, 'sameBranch']]) {
    const run = realRun(year); assert.equal(result(run, 3).status, 'not_matched');
    assert.ok(specific(run).some(f => f.normalizedPayload[field] && !f.normalizedPayload.samePillar));
  }
});

test('p267-001 confirms only the matching role excerpt when the year and day bases agree on the coincident stem', async () => {
  const examples = [
    { birth: { year: 1960, month: 1, day: 2, hour: 12, gender: 1 }, target: 1993,
      pillar: '癸酉', basis: '己', role: '财官印', god: '偏财', excerpt: '財官印綬' },
    { birth: { year: 1960, month: 4, day: 2, hour: 12, gender: 0 }, target: 1996,
      pillar: '丙子', basis: '庚', role: '七杀', god: '七杀', excerpt: '七煞' },
  ];
  for (const { birth, target, pillar, basis, role, god, excerpt } of examples) {
    const chart = archive(birth).bazi.rawResult[0];
    assert.equal(chart.year[0], basis);
    assert.equal(chart.day[0], basis);
    const { run } = clientRunWithClock(birth, target);
    const hit = result(run, 3), facts = specific(run);
    const first = facts.find(fact => fact.normalizedPayload.coincidentSharedBasisRole === role);
    assert.ok(first);
    const before = facts.find(row => row.activeTo === first.activeFrom && row.normalizedPayload.luckPillar === pillar);
    assert.ok(before);
    assert.equal(before.normalizedPayload.coincidentSharedBasisRole, undefined);
    const data = first.normalizedPayload;
    assert.equal(data.yearPillar, pillar);
    assert.equal(data.luckPillar, pillar);
    assert.deepEqual(data.coincidentRoles, [{ stem: pillar[0], god, placement: 'stem', kind: role }]);
    assert.deepEqual(data.coincidentBladeBases, []);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, excerpt);
    assert.equal(hit.windows[0].start, first.activeFrom);
    assert.ok(hit.sourceFactIds.includes(first.factId) && !hit.sourceFactIds.includes(before.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'coincident-role-excerpt'));
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
    assert.equal(finding.originalText, excerpt);
    assert.match(finding.conditions.join(''), /以本命日干核实该柱/u);
    const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
      const message = JSON.parse(options.body).messages[1].content;
      assert.ok(message.includes(excerpt));
      assert.doesNotMatch(message, /獨羊刃七煞為凶財官印綬亦吉|coincidentSharedBasisRole/u);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
    } });
    await provider.interpret(input);
  }
});

test('atomic annual/luck facts split at the precise real luck transition and do not take the first stage for the whole year', () => {
  const chart = archive({ ...reference.realExamples.common, gender: 1 }), run = calculate(chart, 2033);
  const boundary = '2033-11-14T06:00:00.000Z', facts = specific(run);
  assert.ok(facts.some(f => f.activeTo === boundary && f.normalizedPayload.luckPillar === '己丑'));
  assert.ok(facts.some(f => f.activeFrom === boundary && f.normalizedPayload.luckPillar === '庚寅'));
  assert.ok(facts.every(f => f.activeFrom >= f.normalizedPayload.stageStart && f.activeTo <= f.normalizedPayload.stageEnd));
  for (const f of facts) for (const id of f.sourceFactIds) assert.ok(run.rawFacts.some(raw => raw.rawFactId === id && raw.method === 'bazi'));
});

test('p267-001 queries the parallel pillar for named roles and keeps their actual locations separate', () => {
  const example = { year: 1990, month: 1, day: 7, hour: 12, gender: 0 };
  const run = calculate(archive(example), 2064), match = result(run, 3);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.unresolvedConditions, []);
  assert.equal(match.candidateWindows, undefined);
  assert.equal(match.matchedSourceExcerpt, '七煞\n財官印綬');
  assert.equal(match.confirmedBranches.length, 2);
  assert.ok(match.confirmedBranches.every(branch => branch.windows[0].start === match.windows[0].start));
  const { normalizedPayload: p } = specific(run).find(row => row.factId === match.sourceFactIds[0]);
  assert.equal(p.yearPillar, '甲申');
  assert.equal(p.luckPillar, p.yearPillar);
  assert.deepEqual(p.coincidentRoleGroups, ['财官印', '七杀']);
  assert.equal(p.coincidentSharedBasisRole, undefined);
  assert.deepEqual(p.coincidentRoles.map(({ stem, god, placement }) => [stem, god, placement]),
    [['庚', '偏印', 'main_qi'], ['戊', '七杀', 'other_hidden']]);
  assert.equal(p.yearAtDayBasisBlade, false);
  assert.equal(p.yearAtYearBasisBlade, false);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'coincident-roles-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /流年柱甲申的支本气庚为偏印、.+?流年柱甲申的支非本气藏干戊为七杀/u);
  assert.doesNotMatch(prompt, /coincidentRoles|coincidentRoleGroups|smth-volume2-tai-sui/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
  assert.equal(finding.confirmedBranches.length, 2);
  assert.doesNotMatch(formatFortunePrompt(input), /柱甲申的支本气庚|獨羊刃七煞為凶財官印綬亦吉/u);
  const bazi = fortuneKnowledge.bazi;
  const rules = bazi.rules.map(rule => rule.knowledgeId === match.knowledgeId
    ? { ...rule, confirmedWhen: rule.confirmedWhen.filter(branch => branch.sourceExcerpt === '羊刃') } : rule);
  const missingBranch = matchFortuneKnowledge(run, { ...fortuneKnowledge, bazi: { ...bazi, rules } }).byMethod.bazi[3];
  assert.equal(missingBranch.status, 'unknown');
  assert.equal(missingBranch.matchedSourceExcerpt, undefined);

  const plain = calculate(archive({ ...example, month: 6 }), 2055);
  const equalPillars = specific(plain).filter(row => row.normalizedPayload.samePillar);
  assert.ok(equalPillars.length > 0);
  assert.ok(equalPillars.every(({ normalizedPayload: p }) => p.yearPillar === '乙亥' && p.coincidentRoles.length === 0
    && p.yearAtDayBasisBlade === false && p.yearAtYearBasisBlade === false));
  assert.equal(result(plain, 3).status, 'not_matched');

  // Different source readings may give a blade candidate with no selected god.
  const blade = baziAnnualLuckContext({ year: '庚午', month: '壬午', day: '甲子', hour: '庚午' }, true, '丁卯', '丁卯');
  assert.equal(blade.yearAtDayBasisBlade, true);
  assert.equal(blade.yearAtYearBasisBlade, false);
  assert.deepEqual(baziSmthTaiSuiContext({ year: blade.natalYear, day: blade.natalDay }, '丁卯', '丁卯').coincidentRoles, []);
});

test('the same Jia-Mao geometry retains true and secondary blades and the two printed blade-head examples by whole pillar', () => {
  const natal = { year: '甲子', day: '乙亥' };
  const examples = [['乙卯', 'true_blade'], ['丁卯', 'true_blade'], ['己卯', 'secondary_blade', '财'],
    ['辛卯', 'secondary_blade', '鬼'], ['癸卯', 'secondary_blade']];
  for (const [pillar, jiaType, jiaHead] of examples) {
    const context = baziSmthTaiSuiContext(natal, pillar, pillar);
    assert.deepEqual(context.coincidentBladeBases, ['year']);
    assert.deepEqual(context.coincidentBlades, [{ basis: 'year', stem: '甲', luBranch: '寅', bladeBranch: '卯',
      jiaType, jiaHead, ziPingDayBlade: undefined }]);
  }
  assert.equal(baziSmthTaiSuiContext(natal, '乙卯', '丁卯').coincidentBlades, undefined);
  assert.deepEqual(baziSmthTaiSuiContext(natal, '乙亥', '乙亥').coincidentBlades, []);
  const yin = baziSmthTaiSuiContext(natal, '丙辰', '丙辰');
  assert.deepEqual(yin.coincidentBladeBases, ['day']);
  assert.equal(yin.coincidentBlades[0].ziPingDayBlade, false);
  assert.equal(yin.coincidentBlades[0].jiaType, undefined);
  const yang = baziSmthTaiSuiContext({ year: '庚午', day: '丙申' }, '丙午', '丙午');
  assert.equal(yang.coincidentBlades[0].ziPingDayBlade, true);
  assert.equal(yang.coincidentBlades[0].jiaType, undefined);
});

test('a real Ding-Mao coincidence reaches SQLite by the Jia day blade without a selected ten-god role', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2047 } };
  const asOf = Date.parse('2047-11-19T03:00:00Z');
  const archived = { snapshotId: 'coincident-blade-chart', chart: archive({ year: 1978, month: 8, day: 20, hour: 12, gender: 1 }) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archived)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'coincident-blade', archived);
  validateFortuneFacts(run);
  const matched = result(run, 3);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, '羊刃');
  const payload = specific(run).find(row => matched.sourceFactIds.includes(row.factId)).normalizedPayload;
  assert.equal(payload.luckPillar, '丁卯');
  assert.deepEqual(payload.coincidentRoleGroups, []);
  assert.deepEqual(payload.coincidentBladeBases, ['day']);
  assert.equal(payload.coincidentBlades[0].jiaType, 'true_blade');
  assert.equal(payload.coincidentBlades[0].ziPingDayBlade, true);
  const obsolete = structuredClone(run);
  for (const fact of specific(obsolete)) delete fact.normalizedPayload.coincidentBladeBases;
  assert.deepEqual(result(obsolete, 3).sourceFactIds, []);
  const report = interpretFortune(run, requestForFortuneRun(run), 'coincident-blade-report');
  const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, report).input);
  assert.match(prompt, /本命日干甲所定的禄前刃位卯与岁运并临柱丁卯同支，卷三引《太乙经》的甲干真刃例/u);
  assert.doesNotMatch(prompt, /coincidentBladeBases|true_blade/u);
});

test('p267-001 binds a repeated blade, native Lu and actual officer-to-seal links on the same basis', () => {
  const cases = [
    { birth: [1951, 11, 18, 0, 0], year: 1960, annual: '庚子', stem: '壬',
      blades: [['hour', '庚子']], lu: [['month', '己亥']], links: [['month', '己', 'year', '辛'], ['month', '己', 'hour', '庚']] },
    { birth: [1950, 1, 11, 10, 0], year: 2002, annual: '壬午', stem: '丙',
      blades: [['day', '丙午']], lu: [['hour', '癸巳']], links: [] },
    { birth: [1950, 1, 23, 6, 0], year: 2002, annual: '壬午', stem: '戊',
      blades: [['day', '戊午']], lu: [], links: [['hour', '乙', 'month', '丁']] },
    { birth: [1950, 1, 13, 10, 0], year: 2002, annual: '壬午', stem: '戊',
      blades: [], lu: [['hour', '丁巳']], links: [] },
  ];
  for (const { birth: [birthYear, month, day, hour, gender], year, annual, stem, blades, lu, links } of cases) {
    const { run } = clientRunWithClock({ year: birthYear, month, day, hour, gender }, year);
    const match = result(run, 3);
    assert.equal(match.status, 'matched');
    const segments = specific(run).filter(row => row.normalizedPayload.yearPillar === annual && row.normalizedPayload.luckPillar === annual);
    const [fact] = segments;
    assert.ok(fact);
    assert.deepEqual(match.sourceFactIds, segments.map(row => row.factId));
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: segments.at(-1).activeTo }]);
    const [review] = fact.normalizedPayload.coincidentBladeReview;
    assert.deepEqual(segments.map(row => row.normalizedPayload.coincidentBladeReview), segments.map(() => [review]));
    assert.deepEqual([review.basis, review.stem], ['day', stem]);
    assert.deepEqual(review.natalBladeHolders.map(row => [row.position, row.pillar]), blades);
    assert.deepEqual(review.natalLuHolders.map(row => [row.position, row.pillar]), lu);
    assert.deepEqual(review.officerSealLinks.map(({ officer, seal }) => [officer.column, officer.stem, seal.column, seal.stem]), links);
    const repeated = blades.length > 0 && lu.length > 0, withOfficers = repeated && links.length > 0;
    assert.equal(review.repeatedWithLu, repeated);
    assert.equal(review.repeatedWithLuAndOfficerSeal, withOfficers);
    assert.ok(specific(run).filter(row => !row.normalizedPayload.samePillar).every(row => row.normalizedPayload.coincidentBladeReview === undefined));
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'coincident-blade-lu')).input);
    assert.equal(prompt.includes('作为重刃见禄的候选'), repeated);
    assert.equal(prompt.includes('同一基准下另有明透官印相生'), withOfficers);
    assert.doesNotMatch(prompt, /coincidentBladeReview|officerSealLinks/u);
  }
});

test('p267-001 keeps the two editions separate when the Jia-year Ding-Mao blade meets natal Yi-Mao', () => {
  const { run } = clientRunWithClock({ year: 1954, month: 12, day: 18, hour: 6, gender: 0 }, 2047);
  const match = result(run, 3);
  assert.equal(match.status, 'matched');
  const fact = specific(run).find(row => row.normalizedPayload.luckPillar === '丁卯' && match.sourceFactIds.includes(row.factId));
  assert.ok(fact);
  const [review] = fact.normalizedPayload.coincidentBladeReview;
  assert.deepEqual([review.basis, review.stem], ['year', '甲']);
  assert.deepEqual(review.jiaYearSources, [
    { edition: 'sanming', annualTrue: true, natalTrueHolders: [{ position: 'hour', pillar: '乙卯' }] },
    { edition: 'jingji', annualTrue: true, natalTrueHolders: [] },
  ]);
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'coincident-blade-editions')).input);
  assert.match(prompt, /《三命通会》所引《太乙经》将并临柱丁卯列为真刃，该版本的真刃另见于本命时柱乙卯/u);
  assert.match(prompt, /《五行精纪》所引《太乙经》将并临柱丁卯列为真刃/u);
  assert.doesNotMatch(prompt, /《五行精纪》所引《太乙经》将并临柱丁卯列为真刃，该版本的真刃另见于/u);
});

test('p267-001 checks the other Jingji year-stem blade heads on genuine annual and luck coincidences', () => {
  const cases = [
    [{ year: 1945, month: 10, day: 8, hour: 8, gender: 1 }, 2000, '庚辰', true],
    [{ year: 1945, month: 9, day: 23, hour: 8, gender: 0 }, 2012, '壬辰', false],
  ];
  for (const [birth, year, pillar, annualTrue] of cases) {
    const { run } = clientRunWithClock(birth, year), hit = result(run, 3);
    const match = specific(run).find(fact => hit.sourceFactIds.includes(fact.factId)
      && fact.normalizedPayload.luckPillar === pillar && fact.normalizedPayload.yearPillar === pillar);
    assert.equal(hit.status, 'matched');
    assert.ok(match);
    const { coincidentBladeReview } = match.normalizedPayload;
    assert.deepEqual(coincidentBladeReview.find(row => row.basis === 'year').jingjiYearBlade, {
      truePillar: '庚辰', annualTrue, natalTrueHolders: [{ position: 'hour', pillar: '庚辰' }],
    });
    assert.ok(coincidentBladeReview.every(row => row.basis === 'year' || row.jingjiYearBlade === undefined));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jingji-blade-head'));
    const label = '并临柱' + pillar + (annualTrue ? '符合该真刃' : '仅同刃支');
    assert.ok(formatFortuneFactAudit(input).includes(label));
    assert.ok(!formatFortunePrompt(input).includes(label));
  }
  const birthYears = ['丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉'];
  const printed = ['甲午', '丁未', '戊午', '辛未', '乙酉', '戊戌', '壬子', '乙丑'];
  for (const [i, year] of birthYears.entries()) {
    const blade = baziSmthTaiSuiContext({ year, month: '辛卯', day: '甲寅', hour: '丁卯' }, printed[i], printed[i]);
    assert.equal(blade.coincidentBladeReview.find(row => row.basis === 'year').jingjiYearBlade.truePillar, printed[i]);
  }
});

test('p267-003 requires both named actors and keeps favorable and adverse contacts on their actual pairs', () => {
  const annual = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2050 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), reference = { snapshotId: 'repeat-year-chart', chart: archive() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(annual, asOf, reference)));
  const run = bindClientFortuneRun(annual, batch, readClientFactTime(annual, batch, asOf), 'repeat-year-run', reference);
  validateFortuneFacts(run);
  const match = result(run, 5);
  assert.equal(run.calculationSource, 'client');
  assert.equal(match.status, 'partial');
  const repeat = specific(run).find(row => row.factId === match.sourceFactIds[0]);
  assert.equal(repeat.activeFrom, match.windows[0].start);
  assert.ok(specific(run).some(row => row.activeTo === repeat.activeFrom && row.normalizedPayload.yearRepeatsNatalYear === false));
  const p = repeat.normalizedPayload;
  assert.equal(p.yearPillar, '庚午');
  assert.deepEqual(p.repeatYearComparedPositions, ['day', 'luck']);
  assert.deepEqual(p.repeatYearContacts, [
    { position: 'day', pillar: '丁酉', stemRelation: '前克后', branchRelation: '后克前', contacts: [] },
    { position: 'luck', pillar: '己卯', stemRelation: '前生后', branchRelation: '前生后', contacts: ['六破'] },
  ]);
  assert.equal(p.repeatYearCompatibleCandidate, false);
  assert.deepEqual(p.repeatYearContentionPositions, ['day', 'luck']);
  assert.equal(p.repeatYearLuckClashControls, undefined);
  assert.deepEqual(p.repeatYearCompoundContention, []);
  assert.deepEqual(p.repeatYearMutualContentionAt, []);
  const missing = structuredClone(run);
  for (const fact of specific(missing)) if (fact.normalizedPayload.yearRepeatsNatalYear) {
    fact.normalizedPayload.repeatYearComparedPositions = ['luck'];
  }
  assert.equal(result(missing, 5).status, 'not_matched');
  const oldFacts = structuredClone(run);
  for (const fact of specific(oldFacts)) delete fact.normalizedPayload.taiSuiProfile;
  assert.equal(result(oldFacts, 5).status, 'unknown');
  const wrongClock = archive();
  wrongClock.bazi.rawResult[0].hour = '戊午';
  assert.equal(result(calculate(wrongClock, 2050), 5).status, 'unknown');

  const report = interpretFortune(run, requestForFortuneRun(run), 'repeat-year-report');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命日柱丁酉与流年庚午，本命日干丁克岁干庚，岁支午克本命日支酉/u);
  assert.match(prompt, /当段大运己卯与流年庚午，运干己生岁干庚，运支卯生岁支午，同对另见六破/u);
  assert.match(prompt, /本命日柱和当段大运与岁柱有克或刑冲破害的见证/u);
  assert.doesNotMatch(prompt, /repeatYearContacts|repeatYearComparedPositions|repeatYearContentionPositions|taiSuiProfile/u);
  assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === match.knowledgeId)));

  const three = baziSmthTaiSuiContext({ year: '甲寅', day: '庚申' }, '甲寅', '己巳');
  assert.deepEqual(three.repeatYearContacts.map(row => row.contacts), [
    ['天干四冲', '六冲', '相刑'], ['天干五合', '六害', '相刑'],
  ]);
  assert.deepEqual(three.repeatYearPunishments, [{ kind: '三刑', values: '寅巳申', byBranch: [['annual'], ['luck'], ['day']] }]);
  assert.deepEqual(three.repeatYearCompoundContention, [
    { position: 'day', pillar: '庚申', frictions: ['六冲', '相刑'],
      controls: [{ part: 'stem', source: 'day' }, { part: 'branch', source: 'day' }] },
    { position: 'luck', pillar: '己巳', frictions: ['六害', '相刑'],
      controls: [{ part: 'stem', source: 'annual' }] },
  ]);
  assert.deepEqual(three.repeatYearNatalRepeatedStrikeAt, ['day']);
  assert.deepEqual(three.repeatYearUnqualifiedMutualContentionAt, []);
  assert.equal(baziSmthTaiSuiContext({ year: '甲子', day: '甲寅' }, '甲寅', '己巳').repeatYearContacts, undefined);
});

test('p267-003 retains the natal double clash and uses the original repeat exception in the actual year segment', () => {
  const { run } = clientRunWithClock({ year: 1950, month: 6, day: 18, hour: 6, gender: 0 }, 2010);
  const hit = result(run, 5), rows = specific(run);
  const start = '2010-02-03T22:47:51.000Z';
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '再遇亦無大咎');
  assert.match(hit.matchedConditions.join(''), /流年复见/u);
  assert.deepEqual(hit.windows, [{ start, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const fact = rows.find(row => hit.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(p.yearPillar, '庚寅');
  assert.equal(p.luckPillar, '丙子');
  assert.deepEqual(p.repeatYearMutualContentionAt, ['day']);
  assert.deepEqual(p.repeatYearNatalRepeatedStrikeAt, ['day']);
  assert.deepEqual(p.repeatYearUnqualifiedMutualContentionAt, []);
  assert.deepEqual(p.repeatYearCompoundContention, [{ position: 'day', pillar: '甲申', frictions: ['六冲', '相刑'],
    controls: [{ part: 'stem', source: 'annual' }, { part: 'branch', source: 'day' }] }]);
  assert.ok(rows.some(row => row.activeTo === start && row.normalizedPayload.yearRepeatsNatalYear === false));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'repeat-year-mutual-controls'));
  assert.match(formatFortuneFactAudit(input), /本命日柱与岁柱的同一柱对见刑冲破害，干支克向分属双方/u);
  assert.match(formatFortunePrompt(input), /再遇亦無大咎/u);
  assert.doesNotMatch(formatFortunePrompt(input), /repeatYear(MutualContentionAt|NatalRepeatedStrikeAt|UnqualifiedMutualContentionAt)|只在同一柱对成立时采用原文战克分支/u);

  const joint = baziSmthTaiSuiContext({ year: '庚寅', day: '甲申' }, '庚寅', '甲申');
  assert.deepEqual(joint.repeatYearNatalRepeatedStrikeAt, ['day']);
  assert.deepEqual(joint.repeatYearMutualContentionAt, ['day', 'luck']);
  assert.deepEqual(joint.repeatYearUnqualifiedMutualContentionAt, ['luck']);
});

test('p267-003 applies the original repeat to a true-year luck pillar only when it recreates the natal-hour double clash', () => {
  const birth = { year: 1945, month: 9, day: 9, hour: 6, gender: 0 };
  const { run } = clientRunWithClock(birth, 2005);
  const cut = '2005-08-07T00:00:00.000Z';
  const after = specific(run).find(f => f.activeFrom === cut && f.normalizedPayload.luckPillar === '辛卯');
  const prior = specific(run).find(f => f.activeTo === cut && f.normalizedPayload.yearRepeatsNatalYear);
  assert.ok(prior && after);
  assert.equal(prior.normalizedPayload.repeatYearNatalLuckStrikeWitness, undefined);
  const p = after.normalizedPayload;
  assert.equal(p.yearPillar, '乙酉');
  assert.deepEqual(p.repeatYearNatalLuckStrikeWitness, {
    natalYear: '乙酉', natalHour: '辛卯', luck: '辛卯', contacts: ['天干四冲', '六冲'],
  });
  assert.deepEqual(p.repeatYearMutualContentionAt, ['luck']);
  assert.deepEqual(p.repeatYearNatalRepeatedStrikeAt, ['luck']);
  assert.deepEqual(p.repeatYearUnqualifiedMutualContentionAt, []);
  const hit = result(run, 5);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '再遇亦無大咎');
  assert.deepEqual(hit.windows, [{ start: cut, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'repeat-year-hour-luck'));
  const local = /岁运两柱复现原年、时天干四冲及地支六冲/u;
  assert.match(formatFortuneFactAudit(input), local);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /再遇亦無大咎/u);
  assert.doesNotMatch(prompt, local);
  const { run: near } = clientRunWithClock({ ...birth, hour: 8 }, 2005);
  const mismatch = specific(near).find(f => f.normalizedPayload.yearRepeatsNatalYear
    && f.normalizedPayload.luckPillar === '辛卯');
  assert.ok(mismatch);
  assert.equal(mismatch.normalizedPayload.repeatYearNatalLuckStrikeWitness, undefined);
  assert.deepEqual(mismatch.normalizedPayload.repeatYearUnqualifiedMutualContentionAt, ['luck']);
  assert.notEqual(result({ ...near, facts: [mismatch] }, 5).matchedSourceExcerpt, '再遇亦無大咎');
});

test('p267-003 matches supported same-year geometry and stops at a verified transition to a neutral pair', () => {
  const year = 2039, params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const asOf = Date.UTC(year, 5, 15);
  const birth = { year: 1979, month: 2, day: 9, hour: 12, gender: 1 };
  const ref = { snapshotId: 'repeat-year-generating', chart: archive(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
  validateFortuneFacts(run);
  const match = result(run, 5);
  const fact = specific(run).find(row => row.normalizedPayload.yearRepeatsNatalYear);
  const p = fact.normalizedPayload;
  assert.equal(p.yearPillar, '己未');
  assert.deepEqual(p.repeatYearContacts, [
    { position: 'day', pillar: '丁未', stemRelation: '前生后', branchRelation: '同五行', contacts: [] },
    { position: 'luck', pillar: '庚申', stemRelation: '后生前', branchRelation: '后生前', contacts: [] },
  ]);
  assert.equal(p.repeatYearCompatibleCandidate, true);
  assert.equal(p.repeatYearStemGeneration, 'day-feeds-year-feeds-luck');
  assert.deepEqual(p.repeatYearContentionPositions, []);
  assert.equal(match.status, 'matched');
  assert.equal(match.matchedSourceExcerpt, '大運日主與太嵗相和相順');
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.ok(match.sourceFactIds.includes(fact.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'repeat-year-generating'));
  assert.match(formatFortuneFactAudit(input), /真太岁同段核到日干与岁干相生，岁运干支同向相生，两对均未见已列的克或刑冲破害/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
  assert.ok(finding);
  assert.deepEqual(finding.windows, match.windows);
  assert.match(formatFortunePrompt(input), /同书岁运相生的一支/u);

  const transition = calculate(archive({ year: 1979, month: 10, day: 9, hour: 12, gender: 0 }), year);
  const repeated = specific(transition).filter(row => row.normalizedPayload.yearRepeatsNatalYear);
  const [before, after] = repeated;
  assert.ok(before && after);
  assert.equal(before.activeTo, after.activeFrom);
  assert.equal(after.activeFrom, '2039-09-21T20:00:00.000Z');
  assert.equal(after.normalizedPayload.luckPillar, '庚辰');
  assert.deepEqual(before.normalizedPayload.repeatYearContentionPositions, ['luck']);
  assert.deepEqual(after.normalizedPayload.repeatYearComparedPositions, ['day', 'luck']);
  assert.deepEqual(after.normalizedPayload.repeatYearContentionPositions, []);
  assert.equal(after.normalizedPayload.repeatYearCompatibleCandidate, false);
  const changed = result(transition, 5);
  assert.equal(changed.status, 'partial');
  assert.deepEqual(changed.sourceFactIds, [before.factId]);
  assert.deepEqual(changed.windows, [{ start: before.activeFrom, endExclusive: after.activeFrom }]);
});

test('p267-003 queries stem generation with actual luck-year Liu He independently of same-direction generation', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2024 } };
  const asOf = Date.UTC(2024, 5, 15);
  const reference = { snapshotId: 'repeat-year-liuhe', chart: archive({ year: 1964, month: 3, day: 9, hour: 12, gender: 1 }) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'repeat-year-liuhe', reference);
  validateFortuneFacts(run);
  const witness = specific(run).find(row => row.normalizedPayload.yearPillar === '甲辰');
  const p = witness.normalizedPayload;
  assert.equal(p.yearRepeatsNatalYear, true);
  assert.equal(p.repeatYearCompatibleCandidate, false);
  assert.deepEqual(p.repeatYearContentionPositions, []);
  assert.deepEqual(p.repeatYearContacts.find(row => row.position === 'luck'),
    { position: 'luck', pillar: '癸酉', stemRelation: '前生后', branchRelation: '后生前', contacts: ['六合'] });
  assert.equal(p.repeatYearCombinationCandidate, true);
  assert.equal(p.repeatYearStemGeneration, 'luck-feeds-year-feeds-day');
  const hit = result(run, 5);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大運日主與太嵗相和相順');
  assert.deepEqual(hit.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [witness.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'repeat-year-liuhe'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /运干与岁干相生，运支与岁支六合，两对均未见已列的克或刑冲破害/u);
  assert.doesNotMatch(prompt, /repeatYearCombinationCandidate/u);
  assert.match(formatFortunePrompt(input), /实际运支同时与岁支六合/u);
  assert.doesNotMatch(formatFortunePrompt(input), /同书岁运相生的一支|repeatYearCombinationCandidate/u);

  const mixed = calculate(archive({ year: 1930, month: 3, day: 9, hour: 12, gender: 1 }), 1990);
  const mixedFact = specific(mixed).find(row => row.normalizedPayload.yearRepeatsNatalYear);
  assert.deepEqual(mixedFact.normalizedPayload.repeatYearCombinationContentionPositions, ['luck']);
  assert.equal(mixedFact.normalizedPayload.repeatYearCombinationCandidate, false);
  const mixedHit = result({ ...mixed, facts: [mixedFact] }, 5);
  assert.equal(mixedHit.status, 'partial');
  assert.ok(mixedHit.sourceFactIds.includes(mixedFact.factId));
});

test('p267-003 requires the actual stem generation directions and keeps each control on a clashing luck-year pair', () => {
  const cases = [
    { year: 1920, month: 7, day: 13, gender: 1, annual: '庚申', luck: '己丑',
      compatible: true, pattern: 'luck-feeds-year-feeds-day', phrase: /运干生岁干，岁干再生本命日干/u },
    { year: 1921, month: 7, day: 25, gender: 1, annual: '辛酉', luck: '己丑',
      compatible: true, pattern: 'both-feed-year', phrase: /本命日干和运干同生岁干/u },
    { year: 1921, month: 10, day: 17, gender: 1, annual: '辛酉', luck: '壬辰',
      pattern: 'year-feeds-both', phrase: /岁干同时生本命日干和运干/u },
    { year: 1921, month: 10, day: 23, gender: 1, annual: '辛酉', luck: '壬辰',
      pattern: 'day-feeds-year-feeds-luck', phrase: /本命日干生岁干，岁干再生运干/u },
    { year: 1923, month: 11, day: 11, gender: 0, annual: '癸亥', luck: '己巳',
      pattern: 'not-both-generating', phrase: /岁运支见六冲，本对另见运干克岁干、岁支克运支/u,
      clashControls: [{ part: 'stem', source: 'luck' }, { part: 'branch', source: 'annual' }] },
  ];
  for (const sample of cases) {
    const chart = archive({ ...sample, hour: 12 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const year = sample.year + 60, params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const asOf = Date.UTC(year, 5, 15), reference = { snapshotId: 'true-tai-sui-' + sample.pattern };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const hit = result(run, 5);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, sample.clashControls ? '與太嵗互相戰尅' : '大運日主與太嵗相和相順');
    const matchedFact = specific(run).find(row => hit.sourceFactIds.includes(row.factId));
    const p = matchedFact.normalizedPayload;
    assert.equal(p.yearPillar, sample.annual);
    assert.equal(p.luckPillar, sample.luck);
    assert.equal(p.repeatYearStemGeneration, sample.pattern);
    assert.equal(p.repeatYearCompatibleCandidate, Boolean(sample.compatible));
    assert.equal(p.repeatYearCombinationCandidate, !sample.compatible && !sample.clashControls);
    assert.deepEqual(p.repeatYearLuckClashControls, sample.clashControls);
    assert.deepEqual(p.repeatYearNatalRepeatedStrikeAt, []);
    assert.deepEqual(p.repeatYearUnqualifiedMutualContentionAt, sample.clashControls ? ['luck'] : []);
    assert.deepEqual(p.repeatYearCompoundContention, sample.clashControls
      ? [{ position: 'luck', pillar: sample.luck, frictions: ['六冲'], controls: sample.clashControls }] : []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /repeatYearStemGeneration|repeatYearLuckClashControls/u);

    if (sample.clashControls) continue;
    const inconsistent = structuredClone(run);
    for (const fact of specific(inconsistent)) {
      if (fact.normalizedPayload.yearRepeatsNatalYear) fact.normalizedPayload.repeatYearStemGeneration = 'not-both-generating';
    }
    assert.equal(result(inconsistent, 5).status, 'not_matched');
  }
});

test('p267-003 keeps a full annual combination on the same pillar and its actual incoming luck stage', () => {
  const mixed = baziSmthTaiSuiContext({ year: '甲辰', day: '己巳' }, '甲辰', '乙酉');
  assert.ok(mixed.repeatYearContacts.some(row => row.position === 'day' && row.contacts.includes('天干五合')));
  assert.ok(mixed.repeatYearContacts.some(row => row.position === 'luck' && row.contacts.includes('六合')));
  assert.deepEqual(mixed.repeatYearFullPillarCombinations, []);
  assert.equal(mixed.repeatYearVerifiedLuckPillarCombination, false);
  const noDayGeneration = baziSmthTaiSuiContext({ year: '庚辰', day: '己未' }, '庚辰', '乙酉');
  assert.ok(noDayGeneration.repeatYearFullPillarCombinations.some(row => row.position === 'luck'));
  assert.equal(noDayGeneration.repeatYearVerifiedLuckPillarCombination, false);

  const birth = { year: 1998, month: 5, day: 4, hour: 12, gender: 1 };
  const { run } = clientRunWithClock(birth, 2058);
  const facts = specific(run).filter(f => f.normalizedPayload.yearRepeatsNatalYear);
  const previous = facts.findLast(f => f.normalizedPayload.luckPillar === '壬戌');
  const current = facts.find(f => f.normalizedPayload.luckPillar === '癸亥');
  assert.ok(previous && current);
  assert.equal(previous.activeTo, '2058-11-09T10:00:00.000Z');
  assert.equal(previous.activeTo, current.activeFrom);
  assert.deepEqual(previous.normalizedPayload.repeatYearFullPillarCombinations, []);
  const [pair] = current.normalizedPayload.repeatYearFullPillarCombinations;
  assert.equal(current.normalizedPayload.repeatYearFullPillarCombinations.length, 1);
  assert.deepEqual([pair.position, pair.pillar, pair.stemRelation], ['luck', '癸亥', '后克前']);
  assert.ok(pair.contacts.includes('天干五合') && pair.contacts.includes('六合'));
  assert.equal(current.normalizedPayload.repeatYearVerifiedLuckPillarCombination, false);
  assert.deepEqual(current.normalizedPayload.repeatYearCompoundContention, [
    { position: 'luck', pillar: '癸亥', frictions: ['六破'], controls: [{ part: 'stem', source: 'annual' }] },
  ]);

  const hit = result(run, 5), sameSource = result(run, 10);
  assert.equal(hit.status, 'partial');
  assert.equal(sameSource.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(current.factId));
  assert.ok(sameSource.sourceFactIds.some(id => run.facts.some(f => f.factId === id
    && f.activeFrom === current.activeFrom && f.normalizedPayload.luckAnnualCombination === 'both')));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-full-combination'));
  const phrase = /当段大运癸亥与流年戊寅干支俱合/u;
  assert.match(formatFortuneFactAudit(input), phrase);
  assert.doesNotMatch(formatFortunePrompt(input), phrase);

  const exact = clientRunWithClock({ year: 1952, month: 4, day: 5, hour: 12, gender: 0 }, 2012).run;
  const boundary = '2012-05-13T22:00:00.000Z';
  const active = specific(exact).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丁酉');
  assert.ok(active);
  const p = active.normalizedPayload;
  assert.equal(p.yearPillar, '壬辰');
  assert.equal(p.repeatYearVerifiedLuckPillarCombination, true);
  const [dayContact, luckContact] = p.repeatYearContacts;
  assert.deepEqual([dayContact.pillar, dayContact.stemRelation, dayContact.branchRelation], ['辛巳', '前生后', '前生后']);
  assert.deepEqual([luckContact.stemRelation, luckContact.branchRelation, luckContact.contacts], ['后克前', '后生前', ['天干五合', '六合']]);
  const prior = specific(exact).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '戊戌');
  assert.ok(prior);
  assert.equal(prior.normalizedPayload.repeatYearVerifiedLuckPillarCombination, false);
  const verified = result(exact, 5);
  assert.equal(verified.status, 'matched');
  assert.ok(verified.sourceFactIds.includes(active.factId) && !verified.sourceFactIds.includes(prior.factId));
  assert.equal(verified.windows[0].start, boundary);
  const exactInput = buildFortuneModelContext(exact, interpretFortune(exact, requestForFortuneRun(exact), 'annual-verified-combination')).input;
  const exactPrompt = formatFortunePrompt(exactInput);
  assert.match(exactPrompt, /天干五合.*地支六合/u);
  assert.doesNotMatch(exactPrompt, /repeatYearVerifiedLuckPillarCombination|主添進人口/u);
});

test('p267-003 matches reciprocal Lu and keeps one-way Lu, Horse and Tianyi in their actual positions', () => {
  const examples = [
    { year: 1923, month: 6, day: 17, gender: 1, annual: '癸亥', luck: '壬子',
      mutualLu: true, mutualHorse: false, candidate: true, status: 'matched',
      phrase: /同段岁运互换禄，运支到岁干的禄位子，岁支到运干的禄位亥/u },
    { year: 1923, month: 6, day: 13, gender: 1, annual: '癸亥', luck: '壬子',
      mutualLu: true, mutualHorse: false, candidate: false, status: 'partial', noble: 'annual',
      phrase: /本命日干丁的天乙在亥，本段见于流年/u },
    { year: 1920, month: 3, day: 3, gender: 0, annual: '庚申', luck: '壬申',
      mutualLu: false, mutualHorse: false, candidate: false, status: 'not_matched',
      oneWayLu: true, phrase: /运支到岁干的禄位申/u },
    { year: 1929, month: 6, day: 1, gender: 0, annual: '己巳', luck: '乙亥',
      mutualLu: false, mutualHorse: true, candidate: false, status: 'partial', noble: 'luck',
      phrase: /本命日干丁的天乙在亥，本段见于当段大运/u },
    { year: 1920, month: 4, day: 7, gender: 1, annual: '庚申', luck: '丙戌',
      mutualLu: false, mutualHorse: false, candidate: false, status: 'matched', noble: 'annual', sharedSeat: true,
      phrase: /流年庚申同一马位见本命年干禄、本命日干天乙/u },
  ];
  for (const sample of examples) {
    const chart = archive({ ...sample, hour: 12 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const year = sample.year + 60, params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const asOf = Date.UTC(year, 5, 15), reference = { snapshotId: 'true-tai-sui-exchange-' + sample.year + '-' + sample.day };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const hit = result(run, 5);
    assert.equal(hit.status, sample.status);
    const fact = specific(run).find(row => row.normalizedPayload.yearRepeatsNatalYear);
    const p = fact.normalizedPayload;
    assert.equal(p.yearPillar, sample.annual);
    assert.equal(p.luckPillar, sample.luck);
    assert.equal(p.repeatYearMutualLuCandidate, sample.candidate);
    assert.equal(p.repeatYearExchanges.lu.mutual, sample.mutualLu);
    assert.equal(p.repeatYearExchanges.horse.mutual, sample.mutualHorse);
    if (!sample.mutualHorse) assert.equal(p.repeatYearExchanges.horse.naYin, undefined);
    assert.equal(p.repeatYearExchanges.nobleSeason, '阳贵');
    assert.deepEqual(p.repeatYearExchanges.nobles.find(row => row.basis === 'day').positions, sample.noble ? [sample.noble] : []);
    assert.deepEqual(p.repeatYearVerifiedNobleLuHorsePositions, sample.sharedSeat ? ['annual'] : []);
    if (sample.sharedSeat) {
      assert.deepEqual(p.repeatYearExchanges.horseSeats.map(row => ({
        position: row.position, lu: row.luBases, noble: row.nobleBases,
      })), [{ position: 'annual', lu: ['year'], noble: ['day'] }]);
      const isolated = result({ ...run, facts: [fact] }, 5);
      assert.equal(isolated.matchedSourceExcerpt, '有貴人禄馬');
      assert.deepEqual(isolated.windows, [{ start: '1980-02-04T16:09:28.000Z', endExclusive: '1980-12-16T00:00:00.000Z' }]);
    }
    if (sample.oneWayLu) {
      assert.equal(p.repeatYearExchanges.lu.luckAtAnnualTarget, true);
      assert.equal(p.repeatYearExchanges.lu.annualAtLuckTarget, false);
    }
    if (sample.candidate) {
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      assert.equal(p.repeatYearCompatibleCandidate, false);
      assert.equal(p.repeatYearCombinationCandidate, false);
      assert.deepEqual(p.repeatYearContentionPositions, []);
      assert.equal(hit.windows[0].start, fact.activeFrom);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /repeatYearExchanges|repeatYearMutualLuCandidate/u);
    const model = formatFortunePrompt(input);
    assert.equal(/一处实际驿马位同时见本命所取的禄与天乙/u.test(model), Boolean(sample.sharedSeat));
    assert.equal(/实运支是太岁干的禄位，太岁支是实运干的禄位/u.test(model), sample.candidate);
  }
  const original = baziSmthTaiSuiContext({ year: '庚寅', day: '庚寅' }, '庚寅', '甲申');
  assert.equal(original.repeatYearExchanges.lu.mutual, true);
  assert.equal(original.repeatYearExchanges.horse.mutual, true);
  assert.equal(original.repeatYearMutualLuCandidate, false);
  const same = baziSmthTaiSuiContext({ year: '庚申', day: '辛酉' }, '庚申', '庚申');
  assert.equal(same.repeatYearExchanges.lu.mutual, false);
});

test('p267-003 checks each exchanged Horse NaYin on the other actual pillar and retains the listed birth exceptions', () => {
  const exchange = (annual, luck) => baziSmthTaiSuiContext({ year: annual, day: '庚寅' }, annual, luck).repeatYearExchanges.horse.naYin;
  const original = exchange('庚申', '甲寅');
  assert.deepEqual(original.annual, { naYin: '石榴木', element: '木', oppositePillar: '甲寅', phase: '临官', restrictedBirth: false });
  assert.deepEqual(original.luck, { naYin: '大溪水', element: '水', oppositePillar: '庚申', phase: '长生', restrictedBirth: false });
  assert.equal(original.relation, '后生前');
  assert.deepEqual(original.growthPositions, ['annual', 'luck']);
  assert.deepEqual(exchange('甲寅', '庚申').annual, original.luck);
  assert.equal(exchange('甲寅', '庚申').relation, '前生后');
  const exceptions = [
    ['戊寅', '庚申', '土'], ['甲寅', '戊申', '水'], ['丙申', '甲寅', '火'], ['辛亥', '乙巳', '金'], ['己巳', '辛亥', '木'],
  ];
  for (const [annual, luck, element] of exceptions) {
    const restriction = exchange(annual, luck);
    assert.equal(restriction.annual.element, element);
    assert.equal(restriction.annual.phase, '长生');
    assert.equal(restriction.annual.restrictedBirth, true);
    assert.ok(!restriction.growthPositions.includes('annual'));
  }

  const chart = archive({ year: 1920, month: 8, day: 13, hour: 12, gender: 0 });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1980 } };
  const asOf = Date.UTC(1980, 5, 15), reference = { snapshotId: 'true-tai-sui-horse-nayin' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const hit = result(run, 5);
  assert.equal(hit.status, 'partial');
  const p = specific(run).find(row => hit.sourceFactIds.includes(row.factId)).normalizedPayload;
  assert.equal(p.yearPillar, '庚申');
  assert.equal(p.luckPillar, '戊寅');
  assert.ok(p.repeatYearContentionPositions.includes('luck'));
  assert.deepEqual(p.repeatYearExchanges.horse.naYin, {
    annual: { naYin: '石榴木', element: '木', oppositePillar: '戊寅', phase: '临官', restrictedBirth: false },
    luck: { naYin: '城头土', element: '土', oppositePillar: '庚申', phase: '长生', restrictedBirth: true },
    relation: '前克后', growthPositions: ['annual'],
  });
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /岁柱纳音石榴木临运支寅为临官/u);
  assert.match(prompt, /运柱纳音城头土临岁支申为长生，整柱庚申见卷一所列的长生受制例/u);
  assert.match(prompt, /岁柱纳音木克运柱纳音土/u);
  assert.doesNotMatch(prompt, /restrictedBirth|growthPositions/u);
});

test('volume two month duty uses the actual Jie instant, retains both printed schemes and leaves time beyond thirty days unassigned', () => {
  const duty = (at, branch) => smthMonthDuty(Date.parse(at), branch, '甲');
  const start = '2026-02-03T20:02:08.000Z';
  const first = duty(start, '寅');
  assert.equal(duty('2026-02-03T20:02:07.999Z', '寅'), undefined);
  assert.equal(first.start, start);
  assert.equal(first.startTerm, '立春');
  assert.equal(first.slot.label, '艮土');
  assert.equal(first.slot.stem, undefined);
  assert.deepEqual(first.slots.map(row => row.printedDays), [5, 5, 20]);
  assert.deepEqual(first.jadeWell.map(row => row.printedDays), [7, 5, 18]);
  assert.equal(duty('2026-02-08T20:02:07.999Z', '寅').slot.label, '艮土');
  assert.equal(duty('2026-02-08T20:02:08.000Z', '寅').slot.label, '丙火');
  assert.equal(duty('2026-02-13T20:02:08.000Z', '寅').slot.label, '甲木');
  assert.equal(first.slots.at(-1).end, '2026-03-05T13:59:00.000Z');
  assert.equal(duty('2026-03-05T13:58:59.999Z', '寅').slot.label, '甲木');
  assert.equal(duty('2026-03-05T13:59:00.000Z', '卯').slot.label, '甲木');

  const gap = duty('2026-08-06T02:00:00.000Z', '未');
  assert.equal(gap.outsidePrintedDays, true);
  assert.equal(gap.elapsedDay, 31);
  assert.equal(gap.slot, undefined);
  assert.equal(gap.slots.at(-1).end, '2026-08-06T01:56:57.000Z');
  assert.equal(gap.end, '2026-08-07T11:42:43.000Z');
  assert.equal(duty(gap.end, '申').slot.label, '坤土');
  assert.equal(duty('2026-09-15T12:00:00Z', '酉').jadeWellPrintedTotal, 32);
  assert.equal(duty('2026-12-12T12:00:00Z', '子').jadeWellPrintedTotal, 26);
});

test('SQLite p241 requires clock-verified native layers and independently compares month season, day-stem phase, and actual luck branch', () => {
  const example = { year: 1992, month: 7, day: 12, hour: 18, gender: 0 };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2035 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), reference = { snapshotId: 'smth-foundation-chart', chart: archive(example) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'smth-foundation-run', reference);
  const match = result(run, 0);
  validateFortuneFacts(run);
  assert.equal(run.calculationSource, 'client');
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.length);
  const fact = specific(run).find(row => row.factId === match.sourceFactIds[0]), p = fact.normalizedPayload;
  const f = p.foundation;
  assert.equal(p.luckPillar, '壬寅');
  assert.deepEqual(f.columns.map(row => row.pillar), ['壬申', '丁未', '己丑', '癸酉']);
  assert.deepEqual(f.season.map(row => row.element + row.power), ['土旺', '金相', '火休', '木囚', '水死']);
  assert.equal(p.monthDutyProfile, smthMonthDutyPolicy);
  assert.equal(f.monthDuty.startTerm, '小暑');
  assert.equal(f.monthDuty.elapsedDay, 6);
  assert.equal(f.monthDuty.slot.label, '丁火');
  assert.deepEqual(f.monthDuty.jadeWell.map(row => [row.label, row.printedDays]), [['己土', 18], ['乙木', 5], ['丁火', 7]]);
  assert.deepEqual(f.rootPositions.map(row => [row.position, row.sameStem]), [['year', false], ['month', true], ['day', true]]);
  assert.equal(f.luckPhase, '死');
  assert.ok(f.branchComparisons.some(row => row.position === 'year' && row.contacts.includes('六冲')));
  assert.ok(f.branchComparisons.some(row => row.position === 'month' && row.relation === '后克前'));

  const changed = archive(example); changed.bazi.rawResult[0].hour = '乙酉';
  const unverified = calculate(changed, 2035);
  assert.ok(specific(unverified).some(row => row.normalizedPayload.confirmed && !row.normalizedPayload.foundation));
  assert.equal(result(unverified, 0).status, 'unknown');
  const oldFacts = structuredClone(run);
  for (const row of specific(oldFacts)) delete row.normalizedPayload.monthDutyProfile;
  assert.equal(result(oldFacts, 0).status, 'unknown');

  const report = interpretFortune(run, requestForFortuneRun(run), 'smth-foundation-report');
  const { input: modelInput } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /本命月支未按卷二月序为土旺、金相、火休、木囚、水死/u);
  assert.match(prompt, /小暑交节后的第6日，按人元司事首表的二十四小时分日候选为丁火/u);
  assert.match(prompt, /日干临运支为死/u);
  assert.match(prompt, /运支对本命年柱为本命支克运支、六冲/u);
  assert.doesNotMatch(prompt, /foundationProfile|branchComparisons|smth-volume2/u);
  assert.ok(modelInput.sections.every(section => !section.findings.some(row => row.knowledgeId === match.knowledgeId)));
});

test('water NaYin chains use the actual natal intermediary and change with the verified major-luck transition', () => {
  const { run, reference } = clientRunWithClock({ year: 1953, month: 8, day: 11, hour: 12, gender: 1 }, 1974);
  const cut = '1974-09-20T00:00:00.000Z';
  const branches = [
    { edge: 'activeTo', pillar: '戊午', chain: 'fire-earth-water', intermediary: { position: 'hour', pillar: '庚午', naYin: '路旁土' } },
    { edge: 'activeFrom', pillar: '丁巳', chain: 'earth-metal-water', intermediary: { position: 'day', pillar: '甲午', naYin: '沙中金' } },
  ];
  const foundation = result(run, 0), minorSupport = result(run, 2);
  assert.equal(foundation.status, 'matched');
  assert.equal(foundation.matchedSourceExcerpt, '先以三元四柱');
  assert.equal(foundation.confirmedBranches.length, 2);
  assert.equal(foundation.confirmedBranches[0].windows.at(-1).endExclusive, cut);
  assert.equal(foundation.confirmedBranches[1].windows[0].start, cut);
  assert.equal(minorSupport.status, 'partial');
  for (const sample of branches) {
    const row = specific(run).find(fact => fact[sample.edge] === cut);
    assert.equal(row.normalizedPayload.yearPillar, '甲寅');
    assert.ok(foundation.sourceFactIds.includes(row.factId));
    const evidence = row.normalizedPayload.foundation.waterNaYinLuck;
    assert.equal(evidence.yearPillar, '癸巳');
    assert.equal(evidence.luckPillar, sample.pillar);
    assert.equal(evidence.chain, sample.chain);
    assert.deepEqual(evidence.matchingNaYin, [sample.intermediary]);
    const minor = run.facts.find(fact => fact.factType === 'minor_luck_context' && fact[sample.edge] === cut
      && fact.normalizedPayload.variant === 'fixed-bingyin-renshen');
    assert.ok(minorSupport.sourceFactIds.includes(minor.factId));
    assert.deepEqual(minor.normalizedPayload.majorLuckHistory.waterNaYinLuck, evidence);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命时柱庚午纳音为路旁土。运柱纳音火生原局纳音土，原局土再克年命水/u);
  assert.match(prompt, /本命日柱甲午纳音为沙中金。运柱纳音土生原局纳音金，原局金再生年命水/u);
  assert.doesNotMatch(prompt, /waterNaYinLuck|matchingNaYin|fire-earth-water|earth-metal-water/u);
  assert.match(formatFortunePrompt(input), /火运生原局已经存在的纳音土/u);
  assert.match(formatFortunePrompt(input), /土运生原局已经存在的纳音金/u);

  const other = clientRunWithClock({ year: 1952, month: 2, day: 7, hour: 12, gender: 0 }, 1992);
  const contrast = specific(other.run).find(row => row.normalizedPayload.luckPillar === '丁酉');
  const evidence = contrast.normalizedPayload.foundation.waterNaYinLuck;
  assert.equal(evidence.luckNaYin, '山下火');
  assert.deepEqual(evidence.matchingNaYin, []);
  assert.deepEqual(evidence.stemPositions, ['hour']);
  assert.deepEqual(evidence.branchPositions, ['year', 'day']);
  assert.equal(evidence.chain, undefined);
  assert.equal(result({ ...other.run, facts: [contrast] }, 0).status, 'partial');
  const otherMatch = result(other.run, 0);
  assert.equal(otherMatch.status, 'matched');
  assert.match(otherMatch.matchedConditions.join(''), /本命有火纳音/u);
  assert.equal(otherMatch.windows.at(-1).endExclusive, contrast.activeFrom);
  assert.ok(!otherMatch.sourceFactIds.includes(contrast.factId));
  const { input: contrastInput } = buildFortuneModelContext(other.run,
    interpretFortune(other.run, requestForFortuneRun(other.run), other.reference.snapshotId));
  const contrastPrompt = formatFortuneFactAudit(contrastInput);
  assert.match(contrastPrompt, /已核四柱纳音未见所需的土，这条纳音生克链缺少中间柱/u);
  assert.doesNotMatch(contrastPrompt, /符合〈论大运〉财化为鬼的结构条件/u);
});

test('water fate checks natal fire-branch and NaYin routes independently from a water luck stage', () => {
  const samples = [
    { month: 3, day: 1, hour: 20, gender: 0, target: 1990, cut: '1990-09-17T04:00:00.000Z',
      old: '己亥', next: '戊戌', natalGroup: '寅午戌', bases: ['natal-fire-branches'],
      phrase: /本命寅午戌三支齐备，属水命行寅午戌的原局地支候选/u },
    { month: 3, day: 1, hour: 0, gender: 0, target: 1990, cut: '1990-06-06T08:00:00.000Z',
      old: '己亥', next: '戊戌', natalGroup: '寅午', bases: ['natal-fire-nayin'],
      phrase: /本命时柱戊子纳音为霹雳火，属水命行寅午戌的原局纳音火候选/u },
    { month: 3, day: 1, hour: 10, gender: 0, target: 1990, cut: '1990-07-26T18:00:00.000Z',
      old: '己亥', next: '戊戌', natalGroup: '寅午', bases: [],
      phrase: /当步运支戌在寅午戌之内，原局寅在本命月柱、午在本命日柱，原局尚缺戌/u },
    { month: 2, day: 7, hour: 12, gender: 1, target: 1991, cut: '1991-04-01T18:00:00.000Z',
      old: '乙巳', next: '丙午', natalGroup: '寅午', bases: ['natal-fire-nayin'], water: true,
      phrase: /原局纳音金火同见，当步大运纳音水，属〈论大运〉所列分擘其福的结构条件/u },
    { month: 2, day: 5, hour: 20, gender: 1, target: 1991, cut: '1991-10-21T02:00:00.000Z',
      old: '乙巳', next: '丙午', natalGroup: '寅戌', bases: [], water: false,
      phrase: /当步大运纳音水。原局有纳音金，原局金火同见尚缺火/u },
  ];
  for (const sample of samples) {
    const { run, reference } = clientRunWithClock({ ...sample, year: 1952 }, sample.target);
    const hit = result(run, 0);
    const before = specific(run).find(row => row.activeTo === sample.cut);
    const after = specific(run).find(row => row.activeFrom === sample.cut);
    assert.equal(before.normalizedPayload.luckPillar, sample.old);
    assert.equal(after.normalizedPayload.luckPillar, sample.next);
    assert.equal(before.normalizedPayload.foundation.waterNaYinLuck?.fireBranchReview, undefined);
    assert.equal(before.normalizedPayload.foundation.waterNaYinLuck?.waterLuckReview, undefined);
    assert.ok(hit.sourceFactIds.includes(after.factId));

    const review = after.normalizedPayload.foundation.waterNaYinLuck;
    assert.deepEqual(review.fireBranchReview.candidateBases, sample.bases);
    assert.deepEqual(after.normalizedPayload.foundationWaterFireBranchBases, sample.bases);
    assert.equal(after.normalizedPayload.foundationWaterMetalFireInWaterLuck, sample.water === true);
    assert.equal(review.fireBranchReview.luckBranch, sample.next[1]);
    assert.equal(review.fireBranchReview.natalMembers.filter(row => row.positions.length).map(row => row.branch).join(''), sample.natalGroup);
    assert.equal(review.waterLuckReview?.candidate, sample.water);
    const confirmed = sample.bases.length > 0 || sample.water === true;
    assert.equal(hit.status, confirmed ? 'matched' : 'partial');
    assert.equal(result({ ...run, facts: [before] }, 0).status, 'partial');
    const expectedConditions = [
      ...(sample.bases.includes('natal-fire-nayin') ? [/本命有火纳音/u] : []),
      ...(sample.bases.includes('natal-fire-branches') ? [/本命柱中同时见寅、午、戌/u] : []),
      ...(sample.water ? [/本命兼有金、火纳音.*大运纳音属水/u] : []),
    ];
    if (confirmed) {
      assert.equal(hit.matchedSourceExcerpt, '先以三元四柱');
      assert.deepEqual(hit.windows, [{ start: sample.cut, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
      assert.ok(!hit.sourceFactIds.includes(before.factId));
      const branches = hit.confirmedBranches ?? [{ conditions: hit.matchedConditions, windows: hit.windows }];
      assert.equal(branches.length, expectedConditions.length);
      for (const [index, condition] of expectedConditions.entries()) {
        assert.deepEqual(branches[index].windows, hit.windows);
        assert.match(branches[index].conditions.join(''), condition);
      }
    }
    if (sample.water) {
      assert.deepEqual(review.waterLuckReview.natalMetal, [{ position: 'month', pillar: '壬寅', naYin: '金箔金' }]);
      assert.deepEqual(review.waterLuckReview.natalFire, [{ position: 'hour', pillar: '戊午', naYin: '天上火' }]);
    }
    const minor = run.facts.find(row => row.factType === 'minor_luck_context' && row.activeFrom === sample.cut);
    assert.deepEqual(minor.normalizedPayload.majorLuckHistory.waterNaYinLuck, review);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /fireBranchReview|waterLuckReview|natal-fire-nayin/u);
    const model = formatFortunePrompt(input);
    assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)), confirmed);
    expectedConditions.forEach(condition => assert.match(model, condition));
    assert.doesNotMatch(model, /fireBranchReview|waterLuckReview|natal-fire-nayin/u);
  }
});

test('the five year NaYin directions use the current branch and retain both memberships of Wei and Shen', () => {
  const years = [['戊戌', '东', '寅卯辰'], ['丙申', '南', '巳午未'], ['甲午', '西', '申酉戌'],
    ['壬辰', '北', '亥子丑'], ['庚子', '西南', '未申']];
  const pillars = '甲子 乙丑 丙寅 丁卯 戊辰 己巳 庚午 辛未 壬申 癸酉 甲戌 乙亥'.split(' ');
  for (const [year, direction, matches] of years) {
    pillars.forEach((luck, index) => {
      const evidence = smthMajorLuckNaYin(year, luck);
      assert.equal(evidence.expectedDirection, direction);
      assert.equal(evidence.cardinalDirection, '北北东东东南南南西西西北'[index]);
      assert.equal(evidence.directionMatches, matches.includes(luck[1]));
      assert.equal(evidence.inSouthwest, '未申'.includes(luck[1]));
    });
  }
});

test('year NaYin direction and directed control follow the verified stage without replacing each other', () => {
  const samples = [
    { birth: { year: 1960, month: 2, day: 10, hour: 12, gender: 0 }, cut: '2021-11-23T06:00:00.000Z',
      yearPillar: '庚子', yearNaYin: '壁上土', expected: '西南',
      stages: [['壬申', '剑锋金', '西', true, true, '前生后'], ['辛未', '路旁土', '南', true, true, '同五行']],
      phrases: [/运支申按四方三支属西方，按二十四山也在西南坤位/u, /运支未按四方三支属南方，按二十四山也在西南坤位/u] },
    { birth: { year: 1956, month: 2, day: 10, hour: 12, gender: 1 }, cut: '2014-04-01T04:00:00.000Z',
      yearPillar: '丙申', yearNaYin: '山下火', expected: '南',
      stages: [['乙未', '沙中金', '南', true, true, '前克后'], ['丙申', '山下火', '西', true, false, '同五行']],
      phrases: [/年命纳音克运柱纳音，符合卷二财运的生克方向/u, /年命纳音取南方，本步未见该方位条件/u, /年命与运柱纳音同类/u] },
    { birth: { year: 1952, month: 3, day: 10, hour: 12, gender: 0 }, cut: '1963-09-14T14:00:00.000Z',
      yearPillar: '壬辰', yearNaYin: '长流水', expected: '北',
      stages: [['壬寅', '金箔金', '东', false, false, '后生前'], ['辛丑', '壁上土', '北', false, true, '后克前']],
      phrases: [/运柱纳音生年命纳音/u, /运柱纳音克年命纳音，属年命受克的方向/u] },
  ];
  for (const { birth, cut, yearPillar, yearNaYin, expected, stages, phrases } of samples) {
    const { run, reference } = clientRunWithClock(birth, Number(cut.slice(0, 4)));
    const hit = result(run, 0);
    assert.ok(['partial', 'matched'].includes(hit.status));
    const facts = specific(run);
    const before = facts.find(row => row.activeTo === cut), after = facts.find(row => row.activeFrom === cut);
    for (const [fact, stage] of [[before, stages[0]], [after, stages[1]]]) {
      const [luckPillar, luckNaYin, cardinalDirection, inSouthwest, directionMatches, relation] = stage;
      const evidence = fact.normalizedPayload.foundation.majorLuckNaYin;
      assert.deepEqual(evidence, { yearPillar, yearNaYin, luckPillar, luckNaYin, luckBranch: luckPillar[1],
        cardinalDirection, inSouthwest, expectedDirection: expected, directionMatches, relation });
      assert.equal(fact.normalizedPayload.majorLuckNaYinRelation, relation);
      assert.ok([...hit.sourceFactIds, ...(hit.candidateFactIds ?? [])].includes(fact.factId));
      const minor = run.facts.find(row => row.factType === 'minor_luck_context' && row.activeFrom === fact.activeFrom);
      assert.deepEqual(minor.normalizedPayload.majorLuckHistory.majorLuckNaYin, evidence);
    }
    const withoutComparison = structuredClone(run);
    for (const fact of specific(withoutComparison)) delete fact.normalizedPayload.majorLuckNaYinRelation;
    assert.equal(result(withoutComparison, 0).status, 'unknown');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    phrases.forEach(phrase => assert.match(prompt, phrase));
    assert.doesNotMatch(prompt, /majorLuckNaYin|cardinalDirection|directionMatches/u);
  }
});

test('the source natal branch halves change independently from the same-season corner test', () => {
  const samples = [
    { birth: { year: 1952, month: 2, day: 5, hour: 18, gender: 1 }, cut: '1991-10-31T00:00:00.000Z',
      yangPositions: ['year', 'month', 'day'], yinPositions: ['hour'], natalMajority: 'yang',
      before: ['乙巳', 'yang', 'same-half'], after: ['丙午', 'yin', 'yang-into-yin'],
      phrase: /原局阳支多、当步运支在阴组.*?较迟，实际时间待核/u },
    { birth: { year: 1952, month: 6, day: 10, hour: 12, gender: 0 }, cut: '2013-11-28T12:00:00.000Z',
      yangPositions: ['year'], yinPositions: ['month', 'day', 'hour'], natalMajority: 'yin',
      before: ['庚子', 'yang', 'yin-into-yang'], after: ['己亥', 'yin', 'same-half'],
      phrase: /原局阴支多、当步运支在阳组.*?较快，实际时间待核/u },
    { birth: { year: 1952, month: 2, day: 10, hour: 12, gender: 1 }, cut: '1990-04-04T18:00:00.000Z',
      yangPositions: ['year', 'month'], yinPositions: ['day', 'hour'], natalMajority: 'even',
      before: ['乙巳', 'yang', 'even'], after: ['丙午', 'yin', 'even'],
      phrase: /本命四支两组各占两位，本段没有原文所述的阴多或阳多前提/u },
  ];
  const cornerIndex = fortuneKnowledge.bazi.rules.findIndex(row => row.knowledgeId.endsWith('smth-v2-volume-p259-001'));
  for (const sample of samples) {
    const { run, reference } = clientRunWithClock(sample.birth, Number(sample.cut.slice(0, 4)));
    const hit = result(run, 0);
    assert.ok(['partial', 'matched'].includes(hit.status));
    const before = specific(run).find(row => row.activeTo === sample.cut);
    const after = specific(run).find(row => row.activeFrom === sample.cut);
    for (const [fact, [pillar, luckHalf, condition]] of [[before, sample.before], [after, sample.after]]) {
      const evidence = fact.normalizedPayload.foundation.majorLuckPolarity;
      assert.deepEqual(evidence, { yangPositions: sample.yangPositions, yinPositions: sample.yinPositions,
        natalMajority: sample.natalMajority, luckBranch: pillar[1], luckHalf, condition });
      assert.equal(fact.normalizedPayload.luckPillar, pillar);
      assert.equal(fact.normalizedPayload.majorLuckPolarityCondition, condition);
      assert.ok([...hit.sourceFactIds, ...(hit.candidateFactIds ?? [])].includes(fact.factId));
      const minor = run.facts.find(row => row.factType === 'minor_luck_context' && row.activeFrom === fact.activeFrom);
      assert.deepEqual(minor.normalizedPayload.majorLuckHistory.majorLuckPolarity, evidence);
    }
    const transition = run.facts.find(row => row.factType === 'luck_transition' && row.exactInstant === sample.cut);
    assert.equal(transition.normalizedPayload.sameSeason, true);
    assert.equal(transition.normalizedPayload.forwardCorner, false);
    assert.equal(transition.normalizedPayload.reverseCorner, false);
    assert.equal(result(run, cornerIndex).status, 'not_matched');

    const withoutPolarity = structuredClone(run);
    for (const fact of specific(withoutPolarity)) delete fact.normalizedPayload.majorLuckPolarityCondition;
    assert.equal(result(withoutPolarity, 0).status, 'unknown');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /majorLuckPolarity|yinPositions|yang-into-yin/u);
    if (sample.natalMajority === 'even') assert.doesNotMatch(prompt, /符合原文所说乘[阴阳]气的条件/u);
  }
});

test('named major-luck examples bind the published year or month and the actual new stage', () => {
  const cases = [
    { birth: { year: 1937, month: 2, day: 5, hour: 0, gender: 0 }, cut: '1986-11-13T08:00:00.000Z',
      natal: '丁丑', luck: '丁未', bases: ['year'], kind: 'ding-chou-to-ding-wei', exception: false, contact: '六冲' },
    { birth: { year: 1937, month: 3, day: 21, hour: 0, gender: 0 }, cut: '1972-05-25T18:00:00.000Z',
      natal: '丁丑', luck: '丁未', bases: ['year'], kind: 'ding-chou-to-ding-wei', exception: true, repeat: ['day'],
      phrase: /原局另有本命日柱丁未，本命已有丁丑和丁未，原文将此列为例外/u },
    { birth: { year: 1939, month: 1, day: 7, hour: 0, gender: 1 }, cut: '2058-09-12T12:00:00.000Z',
      natal: '戊寅', luck: '丁丑', bases: ['year'], kind: 'wu-yin-to-ding-chou' },
    { birth: { year: 1940, month: 2, day: 5, hour: 20, gender: 1 }, cut: '2009-11-01T10:00:00.000Z',
      natal: '庚辰', luck: '乙酉', bases: ['year'], kind: 'geng-chen-and-yi-you', contact: '六合' },
    { birth: { year: 1920, month: 4, day: 5, hour: 12, gender: 1 }, cut: '1970-06-26T02:00:00.000Z',
      natal: '庚辰', luck: '乙酉', bases: ['month'], kind: 'geng-chen-and-yi-you', contact: '天干五合',
      phrase: /本命月柱庚辰与当步大运乙酉符合〈论大运〉庚辰乙酉的鸳鸯例/u },
    { birth: { year: 1945, month: 9, day: 3, hour: 12, gender: 1 }, cut: '1984-06-01T18:00:00.000Z',
      natal: '乙酉', luck: '庚辰', bases: ['year'], kind: 'geng-chen-and-yi-you', you: ['year'] },
    { birth: { year: 1920, month: 9, day: 9, hour: 20, gender: 0 }, cut: '1961-03-12T08:00:00.000Z',
      natal: '乙酉', luck: '庚辰', bases: ['month'], kind: 'geng-chen-and-yi-you', you: ['month'] },
    { birth: { year: 1920, month: 9, day: 19, hour: 0, gender: 0 }, cut: '1964-04-10T12:00:00.000Z',
      natal: '乙酉', luck: '庚辰', bases: ['month'], kind: 'geng-chen-and-yi-you', you: ['month'], repeat: ['day'],
      phrase: /庚辰见于本命日柱，原文叠见的具体口径待核/u },
    { birth: { year: 1920, month: 1, day: 23, hour: 0, gender: 0 }, cut: '1994-07-14T20:00:00.000Z',
      natal: '庚辰', luck: '乙酉', bases: [] },
    { birth: { year: 2004, month: 4, day: 7, hour: 12, gender: 0 }, cut: '2015-03-05T14:00:00.000Z',
      natal: '甲申', luck: '丙寅', bases: ['year'], kind: 'jia-shen-to-bing-yin', contact: '六冲' },
    { birth: { year: 1946, month: 10, day: 7, hour: 12, gender: 0 }, cut: '2006-05-24T22:00:00.000Z',
      natal: '丙戌', luck: '辛卯', bases: ['year'], kind: 'bing-xu-to-xin-mao', contact: '六合' },
    { birth: { year: 1936, month: 5, day: 7, hour: 12, gender: 1 }, cut: '2026-04-03T16:00:00.000Z',
      natal: '丙子', luck: '壬寅', bases: ['year'], kind: 'bing-zi-to-ren-yin', contact: '天干四冲' },
  ];
  for (const sample of cases) {
    const { run, reference } = clientRunWithClock(sample.birth, Number(sample.cut.slice(0, 4)));
    const hit = result(run, 0);
    assert.ok(['partial', 'matched'].includes(hit.status));
    const before = specific(run).find(row => row.activeTo === sample.cut);
    const after = specific(run).find(row => row.activeFrom === sample.cut);
    assert.equal(after.normalizedPayload.luckPillar, sample.luck);
    assert.ok([...hit.sourceFactIds, ...(hit.candidateFactIds ?? [])].includes(after.factId));
    assert.deepEqual(before.normalizedPayload.foundation.namedMajorExamples, []);
    const examples = after.normalizedPayload.foundation.namedMajorExamples;
    const minor = run.facts.find(row => row.factType === 'minor_luck_context' && row.activeFrom === sample.cut);
    assert.deepEqual(minor.normalizedPayload.majorLuckHistory.namedMajorExamples, examples);
    if (!sample.kind) {
      assert.equal(after.normalizedPayload.foundation.columns.find(row => row.position === 'day').pillar, sample.natal);
      assert.deepEqual(examples, []);
      continue;
    }
    assert.equal(examples.length, 1);
    const [example] = examples;
    assert.equal(example.sourceCase, sample.kind);
    assert.equal(example.natalPillar, sample.natal);
    assert.deepEqual(example.matchedBases, sample.bases);
    assert.equal(example.dingChouWeiException, sample.exception);
    assert.deepEqual(example.luckPillarPositions, sample.repeat ?? []);
    if (sample.you) assert.deepEqual(example.yiGengYearYouPositions, sample.you);
    if (sample.contact) assert.ok(example.contacts.includes(sample.contact));
    if (sample.phrase) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, sample.phrase);
      assert.doesNotMatch(prompt, /namedMajorExamples|matchedBases|dingChouWeiException/u);
    }
  }
});

test('the documented wealth-stem exception requires a wealth stem and no wealth among any hidden stems in the actual luck stage', () => {
  const nonWealthStem = realRun(2026);
  assert.ok(specific(nonWealthStem).some(({ normalizedPayload: fact }) => fact.confirmed
    && fact.luckStemWealth === false && fact.luckAnyHiddenWealth === false));
  assert.equal(result(nonWealthStem, wealthIndex).status, 'not_matched');
  const hiddenOnly = realRun(2029);
  assert.ok(specific(hiddenOnly).some(({ normalizedPayload: fact }) => fact.confirmed && fact.luckPillar === '辛巳'
    && fact.luckStemWealth === true && fact.luckMainQiWealth === false && fact.luckAnyHiddenWealth === true));
  assert.equal(result(hiddenOnly, wealthIndex).status, 'not_matched');
  const mainQi = calculate(archive({ year: 1988, month: 1, day: 1, hour: 2, gender: 0 }), 2051);
  assert.ok(specific(mainQi).some(({ normalizedPayload: fact }) => fact.confirmed && fact.luckPillar === '己未'
    && fact.luckStemWealth === true && fact.luckMainQiWealth === true && fact.luckAnyHiddenWealth === true));
  assert.equal(result(mainQi, wealthIndex).status, 'not_matched');

  const yearWithTransition = realRun(2037), known = result(yearWithTransition, wealthIndex);
  const transition = '2037-10-31T02:00:00.000Z';
  const facts = specific(yearWithTransition).filter(f => f.completeness === 'complete'
    && f.normalizedPayload.luckPillar === '庚辰'
    && f.normalizedPayload.luckStemWealth === true && f.normalizedPayload.luckAnyHiddenWealth === false);
  assert.equal(known.status, 'matched');
  assert.ok(facts.length && known.sourceFactIds.length);
  assert.ok(specific(yearWithTransition).some(f => f.normalizedPayload.luckPillar === '辛巳' && f.activeTo === transition));
  assert.equal(facts[0].normalizedPayload.stageStart, transition);
  assert.equal(known.windows[0].start, transition);
  assert.ok(known.sourceFactIds.every(id => facts.some(f => f.factId === id)));
});

test('p271-002 separates a natal root hit by the actual annual branch from a same-stage luck combination', () => {
  const request = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2047 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), reference = { snapshotId: 'smth-wealth-contacts', chart: archive() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, asOf, reference)));
  const run = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, asOf), 'smth-wealth-run', reference);
  validateFortuneFacts(run);
  const hit = result(run, wealthIndex);
  assert.equal(run.calculationSource, 'client');
  assert.equal(hit.status, 'matched');
  const fact = specific(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.yearPillar === '丁卯');
  const p = fact.normalizedPayload;
  assert.equal(p.luckPillar, '庚辰');
  assert.equal(fact.activeTo, p.stageEnd);
  assert.equal(p.wealthRootStatus, 'same-element-only');
  assert.deepEqual(p.luckWealthEvidence.rootPositions.map(row => [row.layer, row.stem, row.contacts]), [
    ['month', '辛', [{ actor: 'annual', kind: '六冲', branches: '酉卯' }, { actor: 'luck', kind: '六合', branches: '酉辰' }]],
    ['day', '辛', [{ actor: 'annual', kind: '六冲', branches: '酉卯' }, { actor: 'luck', kind: '六合', branches: '酉辰' }]],
  ]);
  assert.deepEqual(p.luckWealthEvidence.contacts.map(row => [row.layer, row.stem, row.feeds, row.controls, row.combines]), [
    ['month', '乙', false, false, true], ['hour', '丙', false, true, false], ['annual', '丁', false, true, false],
  ]);
  assert.ok(specific(run).some(row => row.activeFrom === fact.activeTo && row.normalizedPayload.luckPillar === '己卯'
    && row.normalizedPayload.luckWealthEvidence === undefined));
  assert.ok(hit.windows.every(window => window.endExclusive <= fact.activeTo));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'smth-wealth-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /月柱地支本气辛为偏财（与运干同五行异干），当段岁支卯与该根支酉六冲、当段运支辰与该根支酉六合/u);
  assert.match(prompt, /本命月柱天干乙为偏印，与运干财星五合/u);
  assert.match(prompt, /当段岁干丁为比肩，克运干财星/u);
  assert.doesNotMatch(prompt, /wealthRootStatus|luckWealthEvidence|rootPositions/u);
  const finding = model.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
  assert.ok(finding);
  assert.match(finding.note, /运支.*藏干.*(?:无财|没有财|不见财)/u);
  assert.match(finding.note, /运干.*(?:取象|参考)/u);
  assert.doesNotMatch(finding.note, /发财|稳赚|必得|一定获利|将有收入/u);
});

test('p271-002 confirms exact main and secondary roots or known absence and keeps the involved stems separate', () => {
  const cases = [
    [{ year: 1978, month: 1, day: 3, hour: 4, gender: 1 }, 2008, '己酉', 'exact-main'],
    [{ year: 1978, month: 1, day: 15, hour: 4, gender: 1 }, 1993, '辛亥', 'exact-hidden'],
    [{ year: 1978, month: 2, day: 23, hour: 4, gender: 0 }, 2006, '辛亥', 'no-natal-root'],
  ];
  for (const [example, year, luck, state] of cases) {
    const run = calculate(archive(example), year), hit = result(run, wealthIndex);
    assert.equal(hit.status, 'matched');
    const p = specific(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.luckPillar === luck
      && row.activeTo === run.time.displayWindow.instantRange.endInstantExclusive).normalizedPayload;
    assert.equal(p.wealthRootStatus, state);
    const evidence = p.luckWealthEvidence;
    if (state === 'exact-main') {
      assert.ok(evidence.rootPositions.some(row => row.layer === 'day' && row.sameStem && row.placement === '支本气'));
      assert.ok(evidence.contacts.some(row => row.layer === 'year' && row.tenGod === '食神' && row.feeds));
    } else if (state === 'exact-hidden') {
      assert.ok(evidence.rootPositions.some(row => row.layer === 'month' && row.sameStem && row.placement === '支非本气'));
      assert.ok(!evidence.rootPositions.some(row => row.sameStem && row.placement === '支本气'));
    } else {
      assert.deepEqual(evidence.rootPositions, []);
      assert.ok(evidence.contacts.some(row => row.layer === 'annual' && row.tenGod === '比肩' && row.controls && row.combines));
      assert.ok(evidence.contacts.every(row => row.layer !== 'day'));
    }
  }
  const wrongClock = archive();
  wrongClock.bazi.rawResult[0].hour = '壬午';
  const run = calculate(wrongClock, 2039);
  assert.ok(specific(run).some(row => row.normalizedPayload.luckPillar === '庚辰' && row.normalizedPayload.confirmed
    && row.normalizedPayload.luckWealthEvidence === undefined));
  assert.equal(result(run, wealthIndex).status, 'unknown');
});

test('SQLite binds one actual native killer and multiple exposed food stems to the same confirmed officer luck stage', () => {
  const example = { year: 1988, month: 1, day: 7, hour: 10, gender: 0 }, chart = archive(example);
  const { run } = clientRunWithClock(example, 2017), hit = result(run, careerIndex);
  validateFortuneFacts(run);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運遇天元官星');
  assert.match(hit.matchedConditions.join(''), /两柱明透食神分别克同一原杀/u);
  const cut = '2017-07-10T14:00:00.000Z';
  const prior = specific(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '乙卯');
  const current = specific(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '丙辰');
  assert.ok(prior && current);
  assert.deepEqual(hit.windows, [{ start: cut, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  assert.ok(hit.sourceFactIds.includes(current.factId) && !hit.sourceFactIds.includes(prior.factId));
  assert.ok(hit.sourceFactIds.length);
  for (const id of hit.sourceFactIds) {
    const { normalizedPayload: p } = specific(run).find(f => f.factId === id);
    assert.equal(p.luckPillar, '丙辰'); assert.equal(p.confirmed, true);
    assert.deepEqual(p.natalKillerPositions.map(({ layer, stem, placement }) => [layer, stem, placement]), [['year', '丁', '天干']]);
    assert.deepEqual(p.singleKillerControlColumns, ['month', 'hour']);
    assert.equal(p.officerControlPattern, 'separate-exposed-food');
    assert.equal(p.hasSoleNonHourExposedKillerWithSeparateControls, true);
    assert.equal(p.hasNamedHourKillerWithSeparateControls, false);
    assert.deepEqual(p.officerControlEvidence.foodPaths.map(row => [row.layer, row.targets[0].layer]),
      [['month', 'year'], ['hour', 'year']]);
  }
  const { input: ordinaryInput } = buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), 'separate-controls-officer'));
  const outgoing = formatFortunePrompt(ordinaryInput);
  assert.match(outgoing, /两柱明透食神分别克同一原杀/u);
  assert.doesNotMatch(outgoing, /hasSoleNonHourExposedKillerWithSeparateControls/u);
  assert.equal(result(calculate(chart, 2029), careerIndex).status, 'not_matched');

  const onlyResidual = calculate(archive({ year: 1988, month: 1, day: 1, hour: 2, gender: 0 }), 2061);
  assert.ok(specific(onlyResidual).some(f => f.normalizedPayload.luckTenGod === '正官'
    && f.normalizedPayload.natalKillerPresent && f.normalizedPayload.singleKillerMultipleFoodControls === undefined));
  assert.equal(result(onlyResidual, careerIndex).status, 'unknown');
  const noKiller = calculate(archive({ year: 1988, month: 1, day: 1, hour: 4, gender: 0 }), 2061);
  assert.ok(specific(noKiller).some(f => f.normalizedPayload.luckTenGod === '正官' && f.normalizedPayload.natalKillerPresent === false));
  assert.equal(result(noKiller, careerIndex).status, 'not_matched');

  const native = chart.bazi.rawResult[0], withoutHour = baziAnnualLuckContext(native, false, '己亥', '丙辰');
  assert.equal(withoutHour.natalKillerPresent, true);
  assert.equal(withoutHour.singleKillerMultipleFoodControls, undefined);
  assert.equal(withoutHour.hasSoleNonHourExposedKillerWithSeparateControls, undefined);

  const birth = { year: 1933, month: 11, day: 11, hour: 18, gender: 0 };
  const { run: namedRun } = clientRunWithClock(birth, 1962);
  const named = result(namedRun, careerIndex);
  const boundary = '1962-07-27T08:00:00.000Z';
  const previous = specific(namedRun).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '乙丑');
  const witness = specific(namedRun).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丙寅');
  assert.ok(previous && witness);
  assert.equal(named.status, 'matched');
  assert.equal(named.matchedSourceExcerpt, '運遇天元官星');
  assert.deepEqual(named.windows, [{ start: boundary, endExclusive: namedRun.time.displayWindow.instantRange.endInstantExclusive }]);
  assert.ok(named.sourceFactIds.includes(witness.factId) && !named.sourceFactIds.includes(previous.factId));
  const { normalizedPayload: p } = witness;
  assert.equal(p.hasNamedHourKillerWithSeparateControls, true);
  assert.deepEqual(p.natalKillerPositions.map(row => [row.layer, row.stem, row.placement]), [['hour', '丁', '天干']]);
  assert.deepEqual(p.officerControlEvidence.foodPaths.filter(row => row.placement === '天干').map(row => [row.layer, row.targets[0].layer]),
    [['year', 'hour'], ['month', 'hour']]);
  const previousFormat = { ...witness, normalizedPayload: { ...p, hasNamedHourKillerWithSeparateControls: undefined } };
  assert.equal(result({ ...namedRun, facts: [previousFormat] }, careerIndex).status, 'partial');
  const { input } = buildFortuneModelContext(namedRun, interpretFortune(namedRun, requestForFortuneRun(namedRun), 'hour-killer-officer'));
  assert.match(formatFortunePrompt(input), /運遇天元官星/u);
  assert.doesNotMatch(formatFortunePrompt(input), /hasNamedHourKillerWithSeparateControls|貧儒|处天干食神的直接制杀结构/u);
});

test('p271-001 admits a separately placed food stem and month-duty candidate only on a verified archive and officer stage', () => {
  const example = { year: 1982, month: 4, day: 23, hour: 20, gender: 0 };
  const request = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1990 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), reference = { snapshotId: 'smth-officer-food', chart: archive(example) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, asOf, reference)));
  const run = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, asOf), 'smth-officer-run', reference);
  validateFortuneFacts(run);
  const hit = result(run, careerIndex);
  assert.equal(run.calculationSource, 'client');
  assert.equal(hit.status, 'partial');
  const p = specific(run).find(row => row.factId === hit.sourceFactIds[0]).normalizedPayload;
  assert.equal(p.luckPillar, '癸卯');
  assert.equal(p.singleKillerMultipleFoodControls, undefined);
  assert.equal(p.hasSoleMainQiKillerWithSeparateFoodControls, false);
  assert.equal(p.officerControlPattern, 'exposed-food-and-month-duty');
  assert.equal(p.officerControlEvidence.monthDutyDay, 19);
  assert.equal(p.officerControlEvidence.monthFoodOnDuty, true);
  const [hour, month] = p.officerControlEvidence.foodPaths;
  assert.deepEqual([hour.layer, hour.placement, hour.stem], ['hour', '天干', '戊']);
  assert.deepEqual([month.layer, month.placement, month.stem], ['month', '支本气', '戊']);
  assert.deepEqual(hour.targets, [{ layer: 'year', stem: '壬', tenGod: '七杀', placement: '天干' }]);
  assert.deepEqual(month.targets, hour.targets);
  assert.deepEqual(hour.controllingSeals, [{ layer: 'month', stem: '甲', tenGod: '偏印', placement: '天干' }]);
  assert.equal(hour.combinesOfficer, true);
  assert.equal(month.combinesOfficer, false);

  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'smth-officer-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /首表司事候选为月支本气戊食神，与另一柱透食指向同一杀位/u);
  assert.match(prompt, /此食另受月柱天干甲为偏印的干克，能否夺食待核/u);
  assert.match(prompt, /此透食另与当段运干正官五合/u);
  assert.doesNotMatch(prompt, /officerControlEvidence|officerControlPattern|monthFoodOnDuty/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const earlier = calculate(archive({ ...example, day: 13 }), 1990);
  const unassigned = specific(earlier).find(row => row.normalizedPayload.luckPillar === '癸卯').normalizedPayload;
  assert.equal(unassigned.officerControlEvidence.monthDutyDay, 9);
  assert.equal(unassigned.officerControlEvidence.monthFoodOnDuty, false);
  assert.equal(result(earlier, careerIndex).status, 'unknown');
  const wrongClock = archive(example);
  wrongClock.bazi.rawResult[0].hour = '庚戌';
  assert.equal(result(calculate(wrongClock, 1990), careerIndex).status, 'unknown');
});

test('p271-001 binds a visible food and hurt to the same single killer only in the actual officer luck', async () => {
  const birth = { year: 1988, month: 1, day: 7, hour: 8, gender: 0 };
  const { run } = clientRunWithClock(birth, 2017);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙辰');
  assert.ok(change);
  const before = specific(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '乙卯');
  const after = specific(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '丙辰');
  assert.ok(before && after);
  assert.equal(before.normalizedPayload.officerControlEvidence, undefined);
  const proof = after.normalizedPayload;
  assert.equal(proof.officerControlPattern, 'mixed-exposed-food-hurt');
  assert.equal(proof.singleKillerMultipleFoodControls, undefined);
  assert.equal(proof.hasSoleNonHourExposedKillerWithSeparateControls, false);
  assert.equal(proof.luckTenGod, '正官');
  assert.deepEqual(proof.natalKillerPositions.map(row => [row.layer, row.stem, row.placement]), [['year', '丁', '天干']]);
  assert.deepEqual(proof.officerControlEvidence.mixedExposedControls.map(row =>
    [row.layer, row.stem, row.placement, row.tenGod, row.targets.map(target => [target.layer, target.stem, target.placement])]), [
    ['month', '癸', '天干', '食神', [['year', '丁', '天干']]],
    ['hour', '壬', '天干', '伤官', [['year', '丁', '天干']]],
  ]);
  const hit = result(run, careerIndex);
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
  assert.equal(hit.windows[0].start, change.exactInstant);
  const {input} = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-mixed-control'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /原局不同柱的透食与透伤分别克同一七杀/u);
  assert.ok(input.facts.some(fact => fact.type === 'annual_luck_context' && fact.start === change.exactInstant
    && fact.data.officerControlEvidence?.mixedExposedControls?.length === 2));
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.doesNotMatch(content, /原局不同柱的透食与透伤|mixedExposedControls|mixed-exposed-food-hurt/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);

  const { run: comparison } = clientRunWithClock({ ...birth, hour: 6 }, 2017);
  const other = specific(comparison).find(row => row.normalizedPayload.luckPillar === '丙辰');
  assert.ok(other);
  assert.equal(other.normalizedPayload.natalKillerPresent, true);
  assert.equal(other.normalizedPayload.officerControlPattern, undefined);
  assert.deepEqual(other.normalizedPayload.officerControlEvidence.mixedExposedControls, []);
  assert.deepEqual(result(comparison, careerIndex).sourceFactIds, []);
  assert.equal(baziAnnualLuckContext(archive(birth).bazi.rawResult[0], false, '丁酉', '丙辰').officerControlEvidence, undefined);
});

test('p271-001 confirms two distinct food controls of the sole main-qi killer without a competing exposed seal or officer combination', () => {
  const birth = { year: 1983, month: 12, day: 19, hour: 12, gender: 0 };
  const { run } = clientRunWithClock(birth, 2001);
  const hit = result(run, careerIndex);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運遇天元官星');
  assert.match(hit.matchedConditions.join(''), /月支本气食神/u);
  assert.deepEqual(hit.windows, [{
    start: run.time.displayWindow.instantRange.startInstant, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive,
  }]);
  const p = specific(run).find(row => row.factId === hit.sourceFactIds[0]).normalizedPayload;
  assert.equal(p.luckPillar, '丙寅');
  assert.equal(p.officerControlPattern, 'exposed-food-and-month-duty');
  assert.equal(p.hasSoleMainQiKillerWithSeparateFoodControls, true);
  assert.deepEqual(p.officerControlEvidence.foodPaths.map(row =>
    [row.layer, row.targets[0].layer, row.targets[0].placement, row.controllingSeals.length, row.combinesOfficer]),
    [['year', 'hour', '支本气', 0, false], ['month', 'hour', '支本气', 0, false]]);
  const unknownHour = baziAnnualLuckContext(archive(birth).bazi.rawResult[0], false, '辛巳', '丙寅', true);
  assert.equal(unknownHour.hasSoleMainQiKillerWithSeparateFoodControls, undefined);
});

test('p271-001 audits dedicated-lu water controls only at the same Si hour and leaves the officer combination unresolved', () => {
  const birth = { year: 1972, month: 3, day: 10, hour: 10, gender: 1 };
  const { run } = clientRunWithClock(birth, 2010);
  const cut = '2010-09-22T10:00:00.000Z';
  const previous = specific(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '丙午');
  const witness = specific(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '丁未');
  assert.ok(previous && witness);
  assert.equal(previous.normalizedPayload.hasDedicatedLuSiKillerWithWaterControls, undefined);
  assert.equal(witness.normalizedPayload.hasDedicatedLuSiKillerWithWaterControls, true);
  assert.deepEqual(witness.normalizedPayload.officerControlEvidence.mixedExposedControls.map(row =>
    [row.layer, row.stem, row.targets[0].layer, row.targets[0].stem, row.combinesOfficer]),
  [['year', '壬', 'hour', '丙', true], ['month', '癸', 'hour', '丙', false]]);
  const hit = result(run, careerIndex);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [witness.factId]);
  const comparison = baziAnnualLuckContext(archive({ ...birth, hour: 8 }).bazi.rawResult[0], true, '庚寅', '丁未', true);
  assert.equal(comparison.hasDedicatedLuSiKillerWithWaterControls, false);
  assert.equal(comparison.natalKillerPresent, false);
});

test('p271-001 checks month residual food and killer against the actual duty slot and incoming officer luck', () => {
  for (const row of [
    { day: 7, hour: 18, year: 2019, luck: '壬午', prior: '辛巳', elapsedDay: 2,
      confirmed: true,
      pattern: 'separate-exposed-food-to-month-residual-killer', phrase: /月支余藏癸七杀/u,
      paths: [['year', '己', '天干'], ['hour', '己', '天干'], ['month', '己', '支本气']], target: ['month', '癸', '支非本气'] },
    { day: 11, hour: 10, year: 2058, luck: '丙戌', prior: '乙酉', elapsedDay: 6,
      pattern: 'exposed-food-and-month-residual-duty', phrase: /月支余藏癸食神/u,
      paths: [['hour', '癸', '天干'], ['month', '癸', '支非本气']], target: ['month', '丁', '天干'] },
  ]) {
    const birth = { year: 1970, month: 1, day: row.day, hour: row.hour, gender: 0 };
    const { run } = clientRunWithClock(birth, row.year);
    const hit = result(run, careerIndex);
    assert.equal(hit.status, row.confirmed ? 'matched' : 'partial');
    if (row.confirmed) assert.equal(hit.matchedSourceExcerpt, '運遇天元官星');
    const matched = specific(run).filter(f => hit.sourceFactIds.includes(f.factId));
    assert.ok(matched.length);
    for (const { normalizedPayload: p } of matched) {
      assert.equal(p.luckPillar, row.luck);
      assert.equal(p.officerControlPattern, row.pattern);
      assert.equal(p.hasSoleMonthDutyKillerWithSeparateFoodControls, Boolean(row.confirmed));
      const { foodPaths, monthDutyDay, monthDutyStem } = p.officerControlEvidence;
      assert.deepEqual([monthDutyDay, monthDutyStem], [row.elapsedDay, '癸']);
      assert.deepEqual(foodPaths.map(({ layer, stem, placement }) => [layer, stem, placement]), row.paths);
      for (const { targets } of foodPaths) assert.deepEqual(targets.map(({ layer, stem, placement }) => [layer, stem, placement]), [row.target]);
    }
    assert.ok(specific(run).some(f => f.normalizedPayload.luckPillar === row.prior));
    assert.equal(specific(run).findLast(f => f.normalizedPayload.luckPillar === row.prior).activeTo, matched[0].activeFrom);

    const { run: offDuty } = clientRunWithClock({ ...birth, day: birth.day + 10 }, row.year);
    const offStage = specific(offDuty).find(f => f.normalizedPayload.luckPillar === row.luck);
    assert.ok(offStage);
    assert.equal(offStage.normalizedPayload.officerControlPattern, undefined);
    assert.equal(offStage.normalizedPayload.hasSoleMonthDutyKillerWithSeparateFoodControls, false);
    assert.deepEqual(result(offDuty, careerIndex).sourceFactIds, []);
    const natal = archive(birth).bazi.rawResult[0];
    assert.equal(baziAnnualLuckContext(natal, false, '己亥', row.luck, true)
      .hasSoleMonthDutyKillerWithSeparateFoodControls, undefined);

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-residual-duty'));
    assert.match(formatFortuneFactAudit(input), row.phrase);
    assert.doesNotMatch(formatFortunePrompt(input), row.phrase);
  }
});

test('Built-Lu and repeat-year prerequisites remain partial only after checking the corresponding structure', () => {
  assert.equal(result(realRun(2026), 18).status, 'not_matched');
  assert.equal(result(calculate(archive(reference.realExamples.builtLu), 2026), 18).status, 'partial');
  assert.equal(result(realRun(2050), 5).status, 'partial');
  assert.equal(result(realRun(2004), 5).status, 'not_matched');
});

test('generic separate facts, unverified luck tables, unknown time, multiple candidates and incompatible archives cannot complete the bound prerequisites', () => {
  const generic = structuredClone(realRun(2004));
  generic.facts = generic.facts.filter(f => !['annual_luck_context', 'smth_seal_hurting_context'].includes(f.factType));
  for (const i of indices) assert.equal(result(generic, i).status, 'unknown');
  for (const alter of [c => { c.bazi.rawResult[0].luckPeriods.pop(); }, c => { c.bazi.rawResult[0].luckPeriods[0].ganZhi = '丙子'; },
    c => { c.timeKnown = false; }, c => { c.bazi.rawResult.push(structuredClone(c.bazi.rawResult[0])); },
    c => { c.bazi.engineVersion = 'other'; }]) {
    const chart = archive(); alter(chart); const run = calculate(chart);
    for (const i of indices) assert.equal(result(run, i).status, 'unknown');
  }
});

test('atomic facts reach Chinese model input while incomplete source passages stay out of the matched-material section', () => {
  const run = realRun(2004), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-luck-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.ok(input.facts.some(f => f.type === 'annual_luck_context'));
  assert.match(prompt, /岁运完整干支相同/u); assert.match(prompt, /日干基准刃位为未，年干基准刃位为酉/u);
  assert.match(prompt, /不自定优先权/u);
  for (const i of indices) assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === fortuneKnowledge.bazi.rules[i].knowledgeId));
  for (const field of ['annual_luck_context', 'yearPillar', 'dayBasisBladeBranch', 'luckAnyHiddenWealth', 'annual-luck-run', 'https://']) assert.ok(!prompt.includes(field), field);
});

test('fortune prompt retains the limited wealth-stem finding and withholds incomplete killer material', () => {
  const wealth = realRun(2039);
  const career = calculate(archive({ year: 1988, month: 1, day: 7, hour: 10, gender: 0 }), 2019);
  for (const [run, index, expressions] of [
    [wealth, wealthIndex, [/本气和全藏干两种口径均成立/u, /月柱地支本气辛为偏财（与运干同五行异干）/u]],
    [career, careerIndex, [/一处本命杀位有2处天干食神的直接制杀结构，食神在月柱、时柱/u, /制伏太过及官杀去留仍须核定/u]],
  ]) {
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'stem-exception-prompt'));
    const prompt = formatFortuneFactAudit(input);
    for (const re of expressions) assert.match(prompt, re);
    const visible = input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId);
    assert.equal(visible, index === wealthIndex);
    for (const field of ['natalKillerPositions', 'natalWealthRoots', 'stemExceptionProfile', 'https://']) assert.ok(!prompt.includes(field), field);
  }
});

test('atomic source rows retain their evidence hashes and distinguish the defined wealth exception', () => {
  for (const index of indices) {
    const rule = fortuneKnowledge.bazi.rules[index], e = fortuneKnowledge.bazi.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: e.evidence, conditions: e.conditions })).digest('hex'));
    assert.equal(Boolean(rule.unresolved.length), index !== wealthIndex && index !== 3);
    if (index === 18) assert.equal(rule.queries[0].factType, 'smth_seal_hurting_context');
    else {
      assert.equal(rule.queries[0].factType, 'annual_luck_context');
      assert.equal(rule.queries[0].where.confirmed, true);
    }
  }
  const coincidence = fortuneKnowledge.bazi.rules[3], [query] = coincidence.queries;
  assert.equal(query.where.samePillar, true);
  assert.deepEqual(coincidence.confirmedWhen.map(({ where }) =>
    Object.fromEntries(Object.entries(where).filter(([key]) => !(key in query.where)))), query.anyOf);
  assert.match(coincidence.confirmedWhen.find(branch => branch.sourceExcerpt === '羊刃').sourceConditions[0], /年干、日干及子平五阳干/u);
  assert.match(fortuneKnowledge.bazi.rules[careerIndex].unresolved.join(), /两柱明食克同一杀.*实际制伏过重/u);
  const wealthRule = fortuneKnowledge.bazi.rules[wealthIndex].queries[0].where;
  assert.equal(wealthRule.luckStemWealth, true);
  assert.equal(wealthRule.luckAnyHiddenWealth, false);
});
