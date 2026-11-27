import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt, describeFortuneFact } from './control/fortune-prompt.mjs';
const { quanshuKuXuPositions, quanshuDoujunPosition, quanshuKuXuCondition, quanshuDoujunCondition,
  quanshuShangShiCondition, bindQuanshuYearScopes } = await import('./control/ziwei-source-year.ts');
const { buildQuanshuDoujunMonths } = await import('./control/ziwei-doujun-months.ts');
const { readQuanshuNatal, quanshuLuYangTuo, quanshuPalaceRelation, quanshuTianxingCondition, quanshuLimitPhase,
  quanshuLunarMidnight, quanshuMinorLimit } = await import('./control/ziwei-quanshu.ts');
const { readQuanshuBodyNatal, quanshuBodyLifePositions } = await import('./control/ziwei-body-limits.ts');
const { readQuanshuSupportNatal } = await import('./control/ziwei-source-support.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuYearEncounters, quanshuYearEncountersPolicy } = await import('./control/ziwei-year-encounters.ts');
const { quanshuShangShiLimits, quanshuShangShiLimitPolicy, quanshuShangShiDiagramBranches } = await import('./control/ziwei-shangshi-limits.ts');
const { quanshuFireBellAnchors } = await import('./control/ziwei-firebell-positions.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-year-reference.json', import.meta.url)));
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const native = (example = {}) => astro.withOptions({ dateStr: '1990-05-05', timeIndex: 2, gender: '女', ...example, fixLeap: true, config }).toJSON();
const leapNative = (day, options = {}) => native({ type: 'lunar', dateStr: '1990-5-' + day, isLeapMonth: true, ...options });
const all = palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
function misplacedNatalStar(natal, name, sourceLayer) {
  const copy = structuredClone(natal);
  const palace = copy.palaces.find(row => row[sourceLayer].some(star => star.name === name));
  const [star] = palace[sourceLayer].splice(palace[sourceLayer].findIndex(row => row.name === name), 1);
  palace[sourceLayer === 'minorStars' ? 'adjectiveStars' : 'minorStars'].push(star);
  return copy;
}
function withMajorStarsFrom(natal, donor) {
  return { ...natal, palaces: natal.palaces.map(palace => ({ ...palace,
    majorStars: donor.palaces.find(row => row.index === palace.index).majorStars })) };
}
const chart = natal => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot = chart(native()), periodType = 'year', year = 2026, month = 11) {
  const targetPeriod = periodType === 'year' ? { year } : periodType === 'month' ? { year, month } : undefined;
  const input = { periodType, targetPeriod, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse(`${year}-${String(month).padStart(2, '0')}-19T03:00:00Z`);
  return calculateFortuneFacts(input, buildFactTimeContext(input, now, 'server'),
    'quanshu-year-test', { snapshotId: 'source-year-snapshot', chart: snapshot });
}
function bindSourceRun(natal, input, asOf) {
  const reference = { snapshotId: 'source-year-archive', profileId: 'source-year-profile', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  return bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'source-year-client', reference);
}
const cache = new Map();
const real = example => { const key = JSON.stringify(example); if (!cache.has(key)) cache.set(key, calculate(chart(native(example)), 'year', example.year)); return cache.get(key); };
const ruleNumber = n => fortuneKnowledge.ziwei.rules.find(r => r.knowledgeId.includes('expansion-p' + String(n).padStart(3, '0') + '-'));
const match = (run, n) => matchFortuneKnowledge(run).byMethod.ziwei.find(r => r.knowledgeId === ruleNumber(n).knowledgeId);
const encounterType = 'quanshu_year_encounters';
const doujunReviewType = 'quanshu_doujun_year_month';
const encounterFact = (run, year) => run.facts.find(row => row.factType === encounterType && row.normalizedPayload.lunarYear === year);
const onlyEncounter = (run, fact) => ({ ...run, facts: run.facts.filter(row => row.factType !== encounterType || row.factId === fact.factId) });
function shiftDecadalRange(natal, frame) {
  const shifted = structuredClone(natal), palace = shifted.palaces.find(row => row.index === frame.decadalIndex);
  const age = frame.lunarYear - natal.rawDates.lunarDate.lunarYear + 1;
  const offset = palace.decadal.range[1] === age ? 1 : -1;
  palace.decadal.range = palace.decadal.range.map(value => value + offset);
  assert.equal(quanshuLimitPhase(shifted, frame.decadalIndex, age, quanshuLunarMidnight(frame.lunarYear, 1)).ready, true);
  return shifted;
}
const together = { timeIndex: 0, year: 2006 };
const doujunContrast = { timeIndex: 8, year: 2030 };
const shangShiFacts = run => run.facts.filter(row => row.factType === 'quanshu_shangshi_limits');
const shangShiFact = (run, year) => shangShiFacts(run).find(row => row.normalizedPayload.lunarYear === year);
const envoyTogether = { dateStr: '1975-08-16', timeIndex: 7, year: 2052 };

test('the injury diagram keeps the printed branch sets and cannot read body joining as same seat, opposition or trine', () => {
  assert.deepEqual(quanshuShangShiDiagramBranches, { 天伤: '子辰卯午未', 天使: '丑卯辰酉戌', both: '寅申巳亥' });
  for (let month = 1; month <= 12; month++) for (const hour of branches) {
    const { lifeBranch, bodyBranch } = quanshuBodyLifePositions(month, hour);
    const injury = branches[(branches.indexOf(lifeBranch) + 5) % 12];
    assert.equal(quanshuPalaceRelation(injury, bodyBranch), '其他');
  }
  const sample = { dateStr: '1981-01-05', timeIndex: 11, year: 2062 };
  const { tianshang } = shangShiFact(real(sample), sample.year).normalizedPayload;
  assert.equal(tianshang.arrival, true);
  assert.equal(tianshang.branch, '午');
  assert.equal(tianshang.diagram.wuBodyBranch, '亥');
  assert.equal(tianshang.diagram.wuBodyRelation, '其他');
});

test('the Xu envoy diagram matches an actual natal or annual Yang-Tuo guard on the same verified segment', () => {
  const samples = [
    [{ dateStr: '1967-02-13', timeIndex: 11, year: 2042 }, { star: '陀罗', branch: '戌', layer: '流年' }],
    [{ dateStr: '1991-02-19', timeIndex: 11, year: 2066 }, { star: '擎羊', branch: '戌', layer: '本命' }],
  ];
  for (const [sample, guard] of samples) {
    const input = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const run = bindSourceRun(native(sample), input, Date.UTC(sample.year, 10, 19));
    validateFortuneFacts(run);
    const fact = shangShiFact(run, sample.year);
    assert.ok(fact);
    const payload = fact.normalizedPayload, row = payload.tianshi;
    assert.deepEqual([row.branch, row.annualRelation, row.decadalRelation, row.minorRelation], ['戌', '守', '守', '守']);
    assert.equal(row.diagram.listedForStar, true);
    assert.deepEqual(row.diagram.xuAdverse, [guard]);
    assert.equal(payload.tianshiXuDiagramCandidate, true);
    const result = match(run, 41);
    assert.equal(result.status, 'partial');
    assert.ok(result.sourceFactIds.includes(fact.factId));
    const isolated = structuredClone({ ...run, facts: run.facts.filter(other => other.factType !== fact.factType || other.factId === fact.factId) });
    for (const field of ['ReliefCandidate', 'CrossGroupReliefCandidate', 'AdverseCandidate', 'AnnualFirePairCandidate', 'JielanFireCandidate']) {
      shangShiFact(isolated, sample.year).normalizedPayload['tianshi' + field] = false;
    }
    assert.equal(match(isolated, 41).status, 'partial');
    shangShiFact(isolated, sample.year).normalizedPayload.tianshiXuDiagramCandidate = false;
    assert.equal(match(isolated, 41).status, 'not_matched');
    const projected = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xu-envoy-diagram'));
    assert.match(formatFortuneFactAudit(projected.input), new RegExp(guard.layer + guard.star + '实守戌宫', 'u'));

    const archive = astro.withOptions({ ...sample, gender: '女', fixLeap: true, config });
    const current = archive.horoscope(sample.year + '-06-01', 6);
    const unpaired = quanshuShangShiLimits(quanshuLimitBranches(archive.toJSON(), {
      lunarYear: sample.year, yearIndex: current.yearly.index, decadalIndex: current.decadal.index,
    }));
    assert.equal(unpaired.tianshiXuDiagramCandidate, undefined);
  }

  const contrast = { dateStr: '2003-04-06', timeIndex: 1, year: 2078 };
  const run = real(contrast), fact = shangShiFact(run, contrast.year);
  assert.equal(fact.normalizedPayload.tianshi.arrival, true);
  assert.equal(fact.normalizedPayload.tianshi.branch, '戌');
  assert.deepEqual(fact.normalizedPayload.tianshi.diagram.xuAdverse, []);
  assert.equal(fact.normalizedPayload.tianshiXuDiagramCandidate, false);
  assert.equal(match({ ...run, facts: run.facts.filter(other => other.factType !== fact.factType || other.factId === fact.factId) }, 41).status, 'not_matched');
});

test('all twelve crying/void positions follow the source birth-year table, including the Zi/Wu coincidences', () => {
  for (const [i, branch] of branches.entries()) assert.deepEqual(quanshuKuXuPositions(branch),
    [{ star: '天哭', branch: reference.cryByBirthYear[i] }, { star: '天虚', branch: reference.xuByBirthYear[i] }]);
  assert.throws(() => quanshuKuXuPositions('未知')); assert.throws(() => quanshuKuXuPositions(''));
  const shared = branches.flatMap(year => {
    const [cry, empty] = quanshuKuXuPositions(year);
    return cry.branch === empty.branch ? [cry.branch] : [];
  });
  assert.deepEqual(shared, ['午', '子']);
  assert.ok(!shared.some(branch => '丑卯申'.includes(branch)));
});

test('Doujun counts back birth months and forward birth hours for all 1728 year-branch/month/hour combinations', () => {
  for (const example of reference.doujunExamples) {
    const row = quanshuDoujunPosition(example.year, example.month, example.hour);
    assert.equal(row.birthMonthStop, example.stop); assert.equal(row.doujunBranch, example.branch);
  }
  for (let y = 1996; y < 2008; y++) for (let month = 1; month <= 12; month++) for (let h = 0; h < 12; h++) {
    let walked = branches[(y - 4) % 12];
    for (let m = 1; m < month; m++) walked = branches.at(branches.indexOf(walked) - 1);
    const stop = walked;
    for (let hour = 0; hour < h; hour++) walked = branches[(branches.indexOf(walked) + 1) % 12];
    assert.deepEqual(quanshuDoujunPosition(y, month, branches[h]), { annualBranch: branches[(y - 4) % 12], birthMonthStop: stop, doujunBranch: walked });
  }
  for (const args of [[2026, 0, '子'], [2026, 13, '子'], [0, 1, '子'], [10000, 1, '子'], [2026, 1, '未定']]) assert.throws(() => quanshuDoujunPosition(...args));
});

test('crying/void natal stars must be unique and source-consistent; corrupting them does not destroy independent Doujun geometry', () => {
  for (const name of ['天哭', '天虚']) for (const mode of ['missing', 'duplicated', 'moved']) {
    const natal = native(), palace = natal.palaces.find(p => all(p).some(s => s.name === name)), star = all(palace).find(s => s.name === name);
    if (mode !== 'duplicated') for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) palace[key] = palace[key].filter(s => s.name !== name);
    natal.palaces[(palace.index + 1) % 12].adjectiveStars.push(star);
    if (mode === 'missing') natal.palaces[(palace.index + 1) % 12].adjectiveStars.pop();
    assert.equal(quanshuKuXuCondition(natal, 4, 4, 2026, 'yearly').ready, false, name + mode);
    assert.equal(quanshuDoujunCondition(natal, 4, 4, 2026, 'yearly').ready, true);
  }
  for (const name of ['天哭', '天虚']) {
    const misplaced = misplacedNatalStar(native(), name, 'adjectiveStars');
    assert.equal(quanshuKuXuCondition(misplaced, 4, 4, 2026, 'yearly').ready, false, name);
    assert.equal(quanshuDoujunCondition(misplaced, 4, 4, 2026, 'yearly').ready, true, name);
  }
});

test('injury/envoy use the named native palaces and unique archive stars; absent major data is never inferred as no principal star', () => {
  for (const name of ['天伤', '天使']) {
    const natal = native(), palace = natal.palaces.find(p => all(p).some(s => s.name === name));
    assert.equal(quanshuShangShiCondition(natal, palace.index, 4, 2026, 'minor', undefined, palace.index).ready, true);
    palace.adjectiveStars = palace.adjectiveStars.filter(s => s.name !== name);
    assert.equal(quanshuShangShiCondition(natal, palace.index, 4, 2026, 'minor', undefined, palace.index).ready, false);
  }
  const natal = native(); natal.palaces.forEach(p => { p.majorStars = p.majorStars.filter(s => s.name !== '紫微'); });
  const row = quanshuShangShiCondition(natal, 4, 4, 2026, 'yearly');
  assert.equal(row.ready, true); assert.equal(row.majorPositionsVerified, false);
  assert.match(describeFortuneFact({ method: 'ziwei', type: 'quanshu_shangshi_condition', data: row }, String), /不能据此断定无正曜/u);
  const reclassified = native(), palace = reclassified.palaces.find(p => p.majorStars.some(s => s.name === '紫微'));
  const star = palace.majorStars.find(s => s.name === '紫微');
  palace.majorStars = palace.majorStars.filter(s => s.name !== '紫微'); palace.minorStars.push(star);
  const known = quanshuShangShiCondition(reclassified, palace.index, 4, 2026, 'decadal', palace.index);
  assert.equal(known.majorPositionsVerified, true); assert.ok(known.localMajorStars.includes('紫微'));
});

test('leap births, inconsistent birth year, wrong annual palace or partner limit cannot become complete source facts', () => {
  for (const fn of [quanshuKuXuCondition, quanshuDoujunCondition, quanshuShangShiCondition]) {
    const leap = native(); leap.rawDates.lunarDate.isLeap = true; assert.equal(fn(leap, 4, 4, 2026, 'yearly').ready, false);
    const wrong = native(); wrong.rawDates.chineseDate.yearly[1] = '巳'; assert.equal(fn(wrong, 4, 4, 2026, 'yearly').ready, false);
    assert.equal(fn(native(), 4, 5, 2026, 'yearly').ready, false);
    assert.equal(fn(native(), 4, 4, 2026, 'decadal', 5).ready, false);
  }
});

test('every focus is cut at both partner-limit boundaries as well as the lunar year; adjacent and gapped scopes are not joined', () => {
  const scope = (scope, start, end, index, lunarYear = 2026) => ({ scope, start, end, lunarYear, output: { index } });
  const rows = bindQuanshuYearScopes([scope('yearly', 0, 40, 4), scope('decadal', 0, 20, 1), scope('decadal', 20, 40, 2),
    scope('minor', 0, 10, 3), scope('minor', 10, 30, 4), scope('minor', 30, 40, 5)]).filter(row => row.focus.scope === 'yearly');
  assert.deepEqual(rows.map(r => [r.start, r.end, r.decadal.output.index, r.minor.output.index]), [[0, 10, 1, 3], [10, 20, 1, 4], [20, 30, 2, 4], [30, 40, 2, 5]]);
  const gap = bindQuanshuYearScopes([scope('yearly', 10, 20, 4), scope('decadal', 0, 10, 1)]);
  assert.ok(gap.every(row => row.focus.scope === 'yearly' && row.decadal === undefined));
});

test('crying and void retain the existing shared seat, split guard, exception seat and local Lu candidates', () => {
  const cases = [
    [together, [true, false, false, true], '生年干化禄'],
    [{ dateStr: '1990-01-05', timeIndex: 0, gender: '男', year: 2019 }, [false, true, true, true]],
    [{ dateStr: '1990-01-05', timeIndex: 2, year: 2007 }, [false, false, true, false]],
    [{ timeIndex: 2, year: 2024 }, [true, false, false, true], '流年干化禄候选'],
    [{ dateStr: '1990-01-05', timeIndex: 0, year: 2009 }, [false, false, false, false]],
  ];
  for (const [sample, expected, soleLu] of cases) {
    const run = real(sample), fact = encounterFact(run, sample.year), p = fact.normalizedPayload;
    assert.deepEqual([p.cryVoidTogetherCandidate, p.cryVoidSplitCandidate, p.cryVoidExceptionCandidate, p.cryVoidLuCandidate], expected);
    if (soleLu) for (const row of p.cries) assert.deepEqual(row.luContacts.filter(lu => lu.atSeat).map(lu => lu.label), [soleLu]);
    if (sample.year === 2007) assert.ok(p.cries.some(row => row.guarded && row.luContacts.some(lu => lu.relation === '三合' && !lu.atSeat)));
    const result = match(onlyEncounter(run, fact), 19);
    const expectedStatus = expected[2] || p.cryVoidMinorCoGuardCandidate ? 'matched' : expected.some(Boolean) ? 'partial' : 'not_matched';
    assert.equal(result.status, expectedStatus);
    if (expected.some(Boolean)) assert.ok(result.sourceFactIds.includes(fact.factId));
    if (soleLu) {
      const engine = astro.withOptions({ dateStr: '1990-05-05', gender: '女', ...sample, fixLeap: true, config });
      const h = engine.horoscope(sample.year + '-06-01', 6);
      const frame = { lunarYear: sample.year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      const star = p.cries[0].luContacts.find(row => row.label === soleLu).star;
      const natal = misplacedNatalStar(engine.toJSON(), star, 'majorStars');
      const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
      const invalid = quanshuYearEncounters(natal, quanshuLimitBranches(natal, frame), window, []);
      assert.equal(invalid.cryVoidTogetherCandidate, true);
      assert.equal(invalid.cryVoidLuCandidate, undefined);
      assert.ok(invalid.cries.every(row => row.luContacts.find(lu => lu.label === soleLu).branch === undefined));
    }
  }
});

test('p019 confirms both birth Cry and Void stars at the same two independently verified limits', () => {
  const year = 2030, sample = { dateStr: '1990-05-05', timeIndex: 2, gender: '女' };
  const engine = astro.withOptions({ ...sample, fixLeap: true, config }), natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const bound = bindSourceRun(natal, params, Date.UTC(year, 5, 1));
  validateFortuneFacts(bound);
  const fact = encounterFact(bound, year), data = fact.normalizedPayload;
  assert.deepEqual(data.cryVoidBothStarsDoubleGuardWitness, { branch: '子', stars: ['天哭', '天虚'] });
  assert.deepEqual(data.cries.map(row => [row.star, row.branch, row.decadal, row.minor]), [
    ['天哭', '子', '守', '守'], ['天虚', '子', '守', '守'],
  ]);
  assert.equal(data.cryVoidBothStarsDoubleGuardCandidate, true);
  assert.equal(data.cryVoidExceptionCandidate, false);
  const run = { ...bound, facts: [fact] }, knowledgeId = ruleNumber(19).knowledgeId;
  const confirming = payload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload: payload }])
    .find(row => row.knowledgeId === knowledgeId).confirmations.find(row =>
      row.sourceConditions.some(condition => condition.includes('大限和小限均独立复算实守此宫')));
  const gate = confirming(data);
  assert.deepEqual([gate.hits.length, gate.unknown], [1, false]);
  const hit = match(run, 19);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '二限若逢之');
  assert.deepEqual(hit.windows, [{ start: '2030-02-02T16:00:00.000Z', endExclusive: '2030-12-31T16:00:00.000Z' }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'cry-void-both-limits'));
  const local = /复算大限和小限同守子宫的本命天哭、天虚/u;
  assert.match(formatFortuneFactAudit(input), local);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /大限和小限均独立复算实守此宫/u);
  assert.doesNotMatch(prompt, /cryVoidBothStarsDoubleGuard|子宫|哭断肠/u);

  const frame = lunarYear => {
    const h = engine.horoscope(`${lunarYear}-06-15`, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const produce = (archive, yearFrame) => quanshuYearEncounters(archive, quanshuLimitBranches(archive, yearFrame),
    { start: quanshuLunarMidnight(yearFrame.lunarYear, 1), end: quanshuLunarMidnight(yearFrame.lunarYear + 1, 1) }, []);
  for (const adjacent of [year - 1, year + 1]) {
    const next = produce(natal, frame(adjacent)), result = confirming(next);
    assert.equal(next.cryVoidTogetherCandidate, true);
    assert.equal(next.cryVoidMinorCoGuardCandidate, false);
    assert.equal(next.cryVoidBothStarsDoubleGuardCandidate, false);
    assert.deepEqual([result.hits.length, result.unknown], [0, false]);
    assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: next }] }, 19).status, 'partial');
  }
  const current = frame(year);
  for (const [archive, yearFrame, minorStillValid] of [
    [shiftDecadalRange(natal, current), current, true],
    [natal, { ...current, minorIndex: (current.minorIndex + 1) % 12 }, undefined],
    [misplacedNatalStar(natal, '天虚', 'adjectiveStars'), current, undefined],
  ]) {
    const changed = produce(archive, yearFrame), result = confirming(changed);
    assert.equal(changed.cryVoidMinorCoGuardCandidate, minorStillValid);
    assert.equal(changed.cryVoidBothStarsDoubleGuardWitness, undefined);
    assert.deepEqual([result.hits.length, result.unknown], [0, true]);
  }
});

test('p019 confirms both directions of actual Cry and Void split guards on one native chart', () => {
  const birth = { dateStr: '1980-03-05', timeIndex: 0, gender: '女' };
  const archive = astro.withOptions({ ...birth, fixLeap: true, config }), natal = archive.toJSON();
  const frameFor = year => {
    const h = archive.horoscope(year + '-06-01', 6);
    return { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const evaluate = (chart, frame) => {
    const start = quanshuLunarMidnight(frame.lunarYear, 1), end = quanshuLunarMidnight(frame.lunarYear + 1, 1);
    return quanshuYearEncounters(chart, quanshuLimitBranches(chart, frame), { start, end }, []);
  };
  for (const [year, decade, minor, start] of [
    [1992, '寅', '戌', '1992-02-03T16:00:00.000Z'],
    [2024, '戌', '寅', '2024-02-09T16:00:00.000Z'],
  ]) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const run = bindSourceRun(natal, params, Date.UTC(year, 5, 15));
    validateFortuneFacts(run);
    const fact = encounterFact(run, year), data = fact.normalizedPayload;
    assert.deepEqual([data.decadalBranch, data.minorBranch, data.cryVoidSplitCandidate], [decade, minor, true]);
    assert.deepEqual(data.cries.map(row => [row.star, row.branch, row.decadal, row.minor]), [
      ['天哭', '戌', decade === '戌' ? '守' : '三合', minor === '戌' ? '守' : '三合'],
      ['天虚', '寅', decade === '寅' ? '守' : '三合', minor === '寅' ? '守' : '三合'],
    ]);
    assert.deepEqual([data.cryVoidExceptionCandidate, data.cryVoidMinorCoGuardCandidate, data.cryVoidTogetherCandidate],
      [false, false, false]);
    const scoped = onlyEncounter(run, fact), hit = match(scoped, 19);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '二限若逢之');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    if (year === 1992) {
      assert.equal(data.cryMourningMinorCoGuardCandidate, true);
      assert.equal(match(scoped, 52).status, 'matched');
    }
    const frame = frameFor(year);
    for (const altered of [
      evaluate(misplacedNatalStar(natal, '天虚', 'adjectiveStars'), frame),
      evaluate(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }),
      evaluate(natal, { ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 }),
    ]) {
      assert.equal(altered.cryVoidSplitCandidate, undefined);
      assert.notEqual(match({ ...scoped, facts: [{ ...fact, normalizedPayload: altered }] }, 19).status, 'matched');
    }
    assert.equal(evaluate(natal, frameFor(year + 1)).cryVoidSplitCandidate, false);
    const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'cry-void-split')).input;
    assert.match(formatFortuneFactAudit(input), /本命天哭、天虚分宫，大小限分别守入/u);
    assert.match(formatFortunePrompt(input), /二限若逢之/u);
    assert.doesNotMatch(formatFortunePrompt(input), /cryVoidSplitCandidate|[寅戌]宫/u);
  }
});

test('p019 confirms literal Cry and Void flanks only for the verified decade between them', () => {
  const possible = branches.flatMap(birthBranch => {
    const pair = quanshuKuXuPositions(birthBranch).map(row => row.branch);
    if (pair[0] === pair[1]) return [];
    return branches.flatMap((branch, i) => {
      const adjacent = [branches.at(i - 1), branches[(i + 1) % branches.length]];
      return pair.every(seat => adjacent.includes(seat)) ? [[birthBranch, branch]] : [];
    });
  });
  assert.deepEqual(possible, [['丑', '午'], ['巳', '子'], ['未', '子'], ['亥', '午']]);
  const field = 'cryVoidDadeFlankedDecadalCandidate';
  for (const [dateStr, timeIndex, gender, year, decadalBranch, cryBranch, xuBranch, start] of [
    ['1990-01-05', 2, '女', 2004, '子', '丑', '亥', '2004-01-21T16:00:00.000Z'],
    ['1973-07-12', 0, '男', 1988, '午', '巳', '未', '1988-02-16T16:00:00.000Z'],
  ]) {
    const a = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }), natal = a.toJSON();
    const run = bindSourceRun(natal, { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' },
      Date.UTC(year, 5, 15));
    validateFortuneFacts(run);
    const fact = encounterFact(run, year), data = fact.normalizedPayload;
    assert.deepEqual([data[field], data.cryVoidSplitCandidate, data.cryVoidExceptionCandidate, data.cryVoidTogetherCandidate],
      [true, false, false, false]);
    assert.deepEqual(data.cryVoidDadeFlankedDecadalWitness, { decadalBranch,
      flanks: [{ star: '天哭', branch: cryBranch }, { star: '天虚', branch: xuBranch }] });
    const scoped = { ...run, facts: [fact] }, hit = match(scoped, 19);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '哭虚夹大限');
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const evaluate = (chart, lunarYear, change = frame => frame) => {
      const h = a.horoscope(lunarYear + '-06-01', 6), at = quanshuLunarMidnight(lunarYear, 1);
      const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      return quanshuYearEncounters(chart, quanshuLimitBranches(chart, change(frame)), { start: at, end: at + 1000 }, []);
    };
    for (const damaged of [
      evaluate(misplacedNatalStar(natal, '天哭', 'adjectiveStars'), year),
      evaluate(natal, year, frame => ({ ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 })),
    ]) {
      assert.equal(damaged[field], undefined);
      assert.equal(damaged.cryVoidDadeFlankedDecadalWitness, undefined);
      assert.doesNotMatch(match({ ...scoped, facts: [{ ...fact, normalizedPayload: damaged }] }, 19).matchedSourceExcerpt ?? '', /哭虚夹大限/u);
    }
    for (const [sampleYear, expected] of [[year - 1, false], [year + 9, true], [year + 10, false]]) {
      assert.equal(evaluate(natal, sampleYear)[field], expected, String(sampleYear));
    }
    assert.equal(evaluate(natal, year, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }))[field], true);
    const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'cry-void-flank')).input;
    const witness = `复算大限在${decadalBranch}宫，两侧实见${cryBranch}宫的天哭、${xuBranch}宫的天虚`;
    assert.ok(formatFortuneFactAudit(input).includes(witness));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /哭虚夹大限/u);
    assert.doesNotMatch(prompt, /cryVoidDadeFlankedDecadal|复算大限在[子午]宫|两侧实见/u);
  }
});

test('p019 confirms the named Cry-Void exception with source Lu Cun and both verified limits', () => {
  const example = { dateStr: '1950-02-19', timeIndex: 0, gender: '女', year: 2018 };
  const engine = astro.withOptions({ ...example, fixLeap: true, config }), natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year: example.year }, displayTimezone: 'Asia/Shanghai' };
  const bound = bindSourceRun(natal, params, Date.UTC(example.year, 5, 1));
  const fact = encounterFact(bound, example.year), data = fact.normalizedPayload;
  assert.equal(data.cryVoidNativeLuExceptionDoubleGuardCandidate, true);
  assert.deepEqual(data.cryVoidNativeLuExceptionDoubleGuardWitness, { star: '天虚', branch: '申', nativeLucun: '申' });
  assert.deepEqual(data.cries.map(row => [row.star, row.branch, row.decadal, row.minor]), [
    ['天哭', '辰', '三合', '三合'], ['天虚', '申', '守', '守'],
  ]);
  const run = { ...bound, facts: [fact] };
  const hit = match(run, 19);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const literary = bound.facts.find(row => row.factType === 'quanshu_literary_limits' && row.normalizedPayload.lunarYear === example.year);
  assert.equal(match({ ...run, facts: [literary] }, 10).status, 'matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'cry-void-double-guard'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const format = formatFortunePrompt(input);
  assert.match(format, /已核本命天哭或天虚中的一曜与本命禄存实在此宫/u);
  assert.doesNotMatch(format, /cryVoidNativeLuExceptionDoubleGuardWitness|天哭在辰宫/u);

  const frame = lunarYear => {
    const h = engine.horoscope(`${lunarYear}-06-01`, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const current = frame(example.year), next = frame(example.year + 1);
  const produce = (archive, yearFrame) => quanshuYearEncounters(archive, quanshuLimitBranches(archive, yearFrame),
    { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) }, []);
  const check = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload }])
    .find(rule => rule.knowledgeId === hit.knowledgeId).confirmations[0];
  const adjacent = check(produce(natal, next));
  assert.deepEqual([adjacent.hits.length, adjacent.unknown], [0, false]);
  const followingYear = example.year + 1;
  const following = bindSourceRun(natal, { ...params, targetPeriod: { year: followingYear } }, Date.UTC(followingYear, 5, 1));
  validateFortuneFacts(following);
  const followingFact = encounterFact(following, followingYear);
  const followingData = followingFact.normalizedPayload;
  assert.notEqual(followingData.decadalBranch, followingData.minorBranch);
  assert.equal(followingData.cryVoidNativeLuAtVerifiedLimitCandidate, true);
  assert.equal(followingData.cryVoidNamedPalaceAtVerifiedLimitCandidate, false);
  const followingRun = { ...following, facts: [followingFact] };
  const followingHit = match(followingRun, 19);
  assert.equal(followingHit.status, 'matched');
  assert.equal(followingHit.matchedSourceExcerpt, '遇禄');
  assert.deepEqual(followingHit.windows, [{ start: followingFact.activeFrom, endExclusive: followingFact.activeTo }]);
  const followingModel = buildFortuneModelContext(followingRun,
    interpretFortune(followingRun, requestForFortuneRun(followingRun), 'cry-void-next-year'));
  const followingPrompt = formatFortunePrompt(followingModel.input);
  assert.match(followingPrompt, /至少一层实守该宫，采用原文遇禄的位置条件/u);
  assert.doesNotMatch(followingPrompt, /名显扬|cryVoidNativeLuAtVerifiedLimitCandidate/u);
  const duplicated = structuredClone(natal);
  const lucun = duplicated.palaces.find(row => row.earthlyBranch === '申').minorStars.find(row => row.name === '禄存');
  duplicated.palaces.find(row => row.earthlyBranch === '辰').adjectiveStars.push({ ...lucun });
  assert.equal(produce(duplicated, current).ready, false);
  const wrongLuLayer = misplacedNatalStar(natal, '禄存', 'minorStars');
  for (const archive of [shiftDecadalRange(natal, current), misplacedNatalStar(natal, '天虚', 'adjectiveStars'),
    wrongLuLayer]) {
    const invalid = produce(archive, current), gate = check(invalid);
    assert.equal(invalid.cryVoidNativeLuExceptionDoubleGuardWitness, undefined);
    assert.deepEqual([gate.hits.length, gate.unknown], [0, true]);
  }
  const unverifiedLu = produce(wrongLuLayer, next);
  assert.equal(unverifiedLu.cryVoidNativeLuAtVerifiedLimitCandidate, undefined);
  assert.equal(unverifiedLu.cryVoidNamedPalaceAtVerifiedLimitCandidate, true);
  assert.equal(match({ ...followingRun, facts: [{ ...followingFact, normalizedPayload: unverifiedLu }] }, 19).matchedSourceExcerpt,
    '丑卯申宫吉');

  const adjacentBirth = native({ ...example, dateStr: '1950-02-20' });
  const wrongDay = { ...natal, solarDate: adjacentBirth.solarDate, rawDates: { ...natal.rawDates, lunarDate: adjacentBirth.rawDates.lunarDate } };
  const correct = data.cries.find(row => row.star === '天虚');
  const stale = produce(wrongDay, current).cries.find(row => row.star === '天虚');
  assert.ok(correct.luContacts.filter(row => row.label.includes('化禄')).every(row => row.branch));
  assert.ok(stale.luContacts.filter(row => row.label.includes('化禄')).every(row => row.branch === undefined));
  assert.deepEqual(stale.luContacts.filter(row => row.star === '禄存'), correct.luContacts.filter(row => row.star === '禄存'));
});

test('p019 confirms the named Chou palace exception even when no Lu guards that palace', () => {
  assert.ok([...'甲乙丙丁戊己庚辛壬癸'].every(stem => quanshuLuYangTuo(stem).lucunBranch !== '丑'));
  const example = { dateStr: '1990-01-05', timeIndex: 2, gender: '女', year: 2019 };
  const engine = astro.withOptions({ ...example, fixLeap: true, config }), natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year: example.year }, displayTimezone: 'Asia/Shanghai' };
  const bound = bindSourceRun(natal, params, Date.UTC(example.year, 5, 1));
  validateFortuneFacts(bound);
  const fact = encounterFact(bound, example.year), data = fact.normalizedPayload;
  assert.equal(data.cryVoidNativeLuExceptionDoubleGuardCandidate, false);
  assert.equal(data.cryVoidNamedPalaceDoubleGuardCandidate, true);
  assert.deepEqual(data.cryVoidNamedPalaceDoubleGuardWitness, { star: '天哭', branch: '丑' });
  const [cry] = data.cries;
  assert.deepEqual([cry.star, cry.branch, cry.decadal, cry.minor], ['天哭', '丑', '守', '守']);
  assert.ok(cry.luContacts.every(row => row.atSeat === false));
  const run = { ...bound, facts: [fact] };
  const hit = match(run, 19);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '丑卯申宫吉');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'cry-void-chou-guard'));
  assert.match(formatFortuneFactAudit(input), /大限、小限守丑宫的本命天哭，属于丑卯申例外支位/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /丑卯申宫吉/u);
  assert.match(prompt, /本命天哭或天虚的一曜也实守这一宫/u);
  assert.doesNotMatch(prompt, /遇禄名显扬|cryVoidNamedPalaceDoubleGuardWitness|天哭在丑宫/u);

  const frame = year => {
    const h = engine.horoscope(`${year}-06-01`, 6);
    return { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const current = frame(example.year);
  const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const produce = (archive, yearFrame = current) => quanshuYearEncounters(archive, quanshuLimitBranches(archive, yearFrame), window, []);
  for (const year of [2007, 2020]) {
    const single = produce(natal, frame(year));
    assert.equal(single.cryVoidExceptionCandidate, true);
    assert.equal(single.cryVoidNamedPalaceDoubleGuardCandidate, false);
    assert.equal(single.cryVoidNamedPalaceAtVerifiedLimitCandidate, true);
    const singleHit = match({ ...run, facts: [{ ...fact, normalizedPayload: single }] }, 19);
    assert.equal(singleHit.status, 'matched');
    assert.equal(singleHit.matchedSourceExcerpt, '丑卯申宫吉');
  }
  for (const [archive, confirmed] of [
    [shiftDecadalRange(natal, current), true],
    [misplacedNatalStar(natal, '天哭', 'adjectiveStars'), false],
  ]) {
    const unverified = produce(archive);
    assert.equal(unverified.cryVoidNamedPalaceDoubleGuardCandidate, undefined);
    assert.equal(unverified.cryVoidNamedPalaceDoubleGuardWitness, undefined);
    const unverifiedHit = match({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, 19);
    assert.equal(unverifiedHit.status === 'matched', confirmed);
  }
  const unknownLu = produce(misplacedNatalStar(natal, '禄存', 'minorStars'));
  assert.equal(unknownLu.cries[0].luContacts.find(row => row.label === '本命禄存').branch, undefined);
  assert.equal(unknownLu.cryVoidNamedPalaceDoubleGuardCandidate, true);
});

test('p019 uses source-verified Cry and Void guards with aspects to the same or another active limit', () => {
  const samples = [
    { dateStr: '1989-01-05', timeIndex: 1, year: 2000 },
    { dateStr: '1990-01-05', timeIndex: 0, year: 2033 },
  ];
  const [same, distinct] = samples.map(sample => {
    const run = real(sample), fact = encounterFact(run, sample.year), data = fact.normalizedPayload;
    assert.ok(['cryVoidTogetherCandidate', 'cryVoidSplitCandidate', 'cryVoidExceptionCandidate', 'cryVoidLuCandidate',
      'cryVoidLuAspectCandidate'].every(key => data[key] === false));
    const result = match(onlyEncounter(run, fact), 19);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    return data;
  });
  assert.deepEqual([same.cryVoidSameLimitAspectCandidate, same.cryVoidOtherLimitAspectCandidate], [true, false]);
  assert.deepEqual(same.cryVoidLimitWitnesses.map(row => [row.guardStar, row.guardBranch, row.guardScope, row.aspectScope,
    row.aspectStar, row.aspectBranch, row.aspectRelation]), [
    ['天虚', '戌', 'decadal', 'decadal', '天哭', '寅', '三合'],
    ['天虚', '戌', 'minor', 'minor', '天哭', '寅', '三合'],
  ]);
  assert.deepEqual([distinct.cryVoidSameLimitAspectCandidate, distinct.cryVoidOtherLimitAspectCandidate], [false, true]);
  assert.deepEqual(distinct.cryVoidLimitWitnesses, [
    { guardScope: 'minor', guardBranch: '亥', guardStar: '天虚', aspectScope: 'decadal', aspectLimitBranch: '巳',
      aspectStar: '天哭', aspectBranch: '丑', aspectRelation: '三合', candidate: true },
  ]);
  assert.match(describeFortuneFact({ method: 'ziwei', type: encounterType, data: distinct }, String),
    /小限守亥宫的本命天虚，本命天哭在丑宫，与大限所在的巳宫为三合/u);

  const noGuard = real({ dateStr: '1989-01-05', timeIndex: 0, year: 2004 });
  const negative = encounterFact(noGuard, 2004);
  assert.deepEqual(negative.normalizedPayload.cries.map(row => [row.minor, row.guarded]), [['三合', false], ['三合', false]]);
  assert.equal(match(onlyEncounter(noGuard, negative), 19).status, 'not_matched');

  const archive = astro.withOptions({ ...samples[1], gender: '女', fixLeap: true, config });
  const natal = archive.toJSON(), h = archive.horoscope('2033-06-01', 6);
  const frame = { lunarYear: 2033, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const calculateEncounters = (snapshot, limits) => quanshuYearEncounters(snapshot,
    quanshuLimitBranches(snapshot, limits), { start: 0, end: 0 }, []);
  assert.equal(calculateEncounters(natal, { ...frame, decadalIndex: undefined }).cryVoidOtherLimitAspectCandidate, undefined);
  const shifted = calculateEncounters(shiftDecadalRange(natal, frame), frame);
  assert.deepEqual(shifted.sourceDecadal, { branch: '巳', verified: false });
  assert.equal(shifted.cries.find(row => row.star === '天虚').guarded, true);
  assert.equal(shifted.cryVoidOtherLimitAspectCandidate, undefined);
  const run = real(samples[1]), fact = encounterFact(run, 2033);
  const { limitPlacementProof, ...oldLimitProof } = fact.normalizedPayload;
  const { kuXuPlacementProof, ...oldKuXuProof } = fact.normalizedPayload;
  assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
  assert.equal(kuXuPlacementProof, 'quanshu-kuxu-birth-year-adjective-layer-v1');
  const wrongLayer = calculateEncounters(misplacedNatalStar(natal, '天哭', 'adjectiveStars'), frame);
  assert.equal(wrongLayer.cryVoidOtherLimitAspectCandidate, undefined);
  assert.equal(wrongLayer.cries.find(row => row.star === '天虚').guarded, true);
  for (const normalizedPayload of [shifted, oldLimitProof, oldKuXuProof, wrongLayer]) {
    assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload }] }, 19).status, 'unknown');
  }
  for (const palace of natal.palaces) palace.adjectiveStars = palace.adjectiveStars.filter(row => row.name !== '天哭');
  assert.equal(calculateEncounters(natal, frame).cryVoidOtherLimitAspectCandidate, undefined);
});

test('p019 serializes an actual Lu aspect from the client, matches it in SQLite and names its layer in the prompt', () => {
  const sample = { dateStr: '1990-01-05', timeIndex: 0, year: 2045 };
  const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2045-11-19T03:00:00Z'), reference = { snapshotId: 'cry-void-lu-chart', chart: chart(native(sample)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'cry-void-lu-client', reference);
  const fact = encounterFact(run, sample.year), isolated = onlyEncounter(run, fact), data = fact.normalizedPayload;
  assert.equal(data.cryVoidLuCandidate, false);
  assert.equal(data.cryVoidLuAspectCandidate, true);
  assert.equal(data.cryVoidExceptionCandidate, false);
  assert.deepEqual(data.cryVoidLimitWitnesses, []);
  const voidStar = data.cries.find(row => row.star === '天虚');
  assert.deepEqual([voidStar.branch, voidStar.minor], ['亥', '守']);
  assert.deepEqual(voidStar.luContacts.filter(row => ['冲', '三合'].includes(row.relation)), [
    { label: '流年禄存', star: '禄存', branch: '卯', relation: '三合', atSeat: false },
  ]);
  const result = match(isolated, 19);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'cry-void-lu'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /小限守亥宫的本命天虚，流年禄存在卯宫，与该限宫为三合/u);
  assert.doesNotMatch(prompt, /cryVoidLuAspectCandidate|quanshu_year_encounters/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === result.knowledgeId));
});

test('annual Mourning must actually meet verified natal Cry, independently of natal Void', () => {
  const year = together.year, natal = native(together);
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const run = bindSourceRun(natal, params, Date.UTC(year, 5, 1));
  validateFortuneFacts(run);
  const fact = encounterFact(run, year), data = fact.normalizedPayload;
  const isolated = onlyEncounter(run, fact), result = match(isolated, 52);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
  assert.equal(data.cryMourningMinorCoGuardCandidate, true);
  assert.equal(data.cryMourningAnnualCoGuardCandidate, false);
  assert.deepEqual([data.mourningBranch, data.cries[0].branch, data.cries[0].minor], ['子', '子', '守']);
  assert.equal(data.cryVoidMinorCoGuardCandidate, true);
  const cryVoidMatch = match(isolated, 19);
  assert.equal(cryVoidMatch.status, 'matched');
  assert.equal(cryVoidMatch.matchedSourceExcerpt, '二限若逢之');
  assert.deepEqual(cryVoidMatch.windows, result.windows);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'cry-mourning-minor-coguard'));
  assert.match(formatFortuneFactAudit(input), /流年丧门与本命天哭同在子宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /两个具名星实际同宫，复算后的小限也实守这一宫/u);
  assert.match(prompt, /本命天哭与天虚在同一宫，复算的小限实守该宫/u);
  assert.doesNotMatch(prompt, /哀哀哭断肠/u);
  assert.doesNotMatch(prompt, /流年丧门与本命天哭同在子宫|cryMourningMinorCoGuardCandidate/u);
  const near = real({ timeIndex: 0, year: 2008 }), other = encounterFact(near, 2008);
  assert.equal(other.normalizedPayload.cries[0].annual, '守');
  assert.equal(other.normalizedPayload.mourningBranch, '寅');
  assert.equal(other.normalizedPayload.cryMourningMinorCoGuardCandidate, false);
  assert.equal(match(onlyEncounter(near, other), 52).status, 'not_matched');
  const engine = astro.withOptions({ dateStr: '1990-05-05', timeIndex: 0, gender: '女', fixLeap: true, config });
  const h = engine.horoscope(`${year}-06-15`, 6);
  const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const displacedMinor = quanshuYearEncounters(natal,
    quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }), window, []);
  assert.equal(displacedMinor.cryMourningCandidate, true);
  assert.equal(displacedMinor.cryMourningMinorCoGuardCandidate, undefined);
  assert.equal(displacedMinor.cryVoidMinorCoGuardCandidate, undefined);
  const displaced = { ...run, facts: [{ ...fact, normalizedPayload: displacedMinor }] };
  assert.equal(match(displaced, 52).status, 'matched');
  assert.notEqual(match(displaced, 19).status, 'matched');
  for (const [name, expected] of [['天虚', true], ['天哭', undefined]]) {
    for (const palace of natal.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
      palace[key] = palace[key].filter(row => row.name !== name);
    }
    const data = quanshuYearEncounters(natal, quanshuLimitBranches(natal, frame), window, []);
    assert.equal(data.cryMourningCandidate, expected);
    assert.equal(data.cryMourningMinorCoGuardCandidate, expected);
    assert.equal(data.cryVoidMinorCoGuardCandidate, undefined);
  }
});

test('p052 confirms the same annual seat after client submission even with the actual minor limit elsewhere', () => {
  const year = together.year;
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const run = bindSourceRun(native({ ...together, gender: '男' }), params, Date.UTC(year, 5, 1));
  validateFortuneFacts(run);
  const fact = encounterFact(run, year), data = fact.normalizedPayload;
  assert.equal(data.minorBranch, '申');
  assert.equal(data.cryMourningMinorCoGuardCandidate, false);
  assert.equal(data.cryMourningAnnualCoGuardCandidate, true);
  const isolated = onlyEncounter(run, fact), hit = match(isolated, 52);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.match(hit.matchedConditions.join(), /独立的流年相遇条件/u);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'cry-mourning-annual'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /独立的流年相遇条件/u);
  assert.doesNotMatch(prompt, /复算后的小限也实守这一宫|cryMourningAnnualCoGuardCandidate/u);
});

test('p052 Nanyangtang chart witnesses distinguish the actual minor limit from natal Life', () => {
  const yan = { dateStr: '1980-11-01', timeIndex: 6, gender: '男' };
  const ran = { dateStr: '1975-03-18', timeIndex: 0, gender: '男' };
  const profile = 'quanshu-nanyangtang-cry-mourning-cases-v1';
  const conditions = {
    minor: { scope: 'minor', branch: '辰', cryRelation: '冲', mourningRelation: '守' },
    natal: { scope: 'natal', branch: '卯', cryRelation: '守', mourningRelation: '冲' },
  };
  let actualMinor;
  for (const [sample, year, expectedScope, independent, exampleTiming] of [
    [yan, 2022, 'minor', false, [43, '壬寅']],
    [ran, 2039, 'natal', false, [65, '己未']],
    [ran, 2027, 'natal', true],
    [yan, 2021, undefined, false],
    [ran, 2038, undefined, false],
  ]) {
    const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const natal = native(sample);
    if (exampleTiming) {
      const yearly = astro.withOptions({ ...sample, fixLeap: true, config }).horoscope(year + '-06-01', 6).yearly;
      assert.deepEqual([year - natal.rawDates.lunarDate.lunarYear + 1, yearly.heavenlyStem + yearly.earthlyBranch], exampleTiming);
    }
    const run = bindSourceRun(natal, input, Date.UTC(year, 5, 1));
    validateFortuneFacts(run);
    const fact = encounterFact(run, year);
    const data = fact.normalizedPayload;
    if (expectedScope === 'minor') actualMinor = { run, fact };
    assert.equal(data.cryMourningNanyangProfile, profile);
    assert.equal(data.cryMourningNanyangMinorCandidate, expectedScope === 'minor');
    assert.equal(data.cryMourningNanyangLifeCandidate, expectedScope === 'natal');
    assert.deepEqual(data.cryMourningNanyangWitnesses, expectedScope ? [conditions[expectedScope]] : []);
    const cutRun = onlyEncounter(run, fact);
    const matched = match(cutRun, 52);
    const expectedQuanjiOnly = year === 2038;
    assert.equal(data.cryMourningQuanjiLifeAspectCandidate, expectedQuanjiOnly);
    assert.equal(matched.status, expectedScope || expectedQuanjiOnly ? 'matched' : 'not_matched');
    if (expectedQuanjiOnly) {
      assert.deepEqual(data.cryMourningQuanjiLifeWitness, {
        tianzhangBranch: '亥', lifeBranch: '寅', cryBranch: '戌', mourningBranch: '申',
        cryRelation: '三合', mourningRelation: '冲',
      });
      assert.equal(matched.matchedSourceExcerpt, '并照命兮');
      assert.equal(matched.confirmedBranches, undefined);
    }
    if (expectedScope) {
      assert.deepEqual(matched.sourceFactIds, [fact.factId]);
      assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.equal(fact.activeFrom, new Date(quanshuLunarMidnight(year, 1)).toISOString());
      const context = buildFortuneModelContext(cutRun, interpretFortune(cutRun, requestForFortuneRun(cutRun), 'cry-mourning-nanyang')).input;
      assert.ok(context.sections.some(section => section.findings.some(finding => finding.knowledgeId === matched.knowledgeId)));
      const audit = formatFortuneFactAudit(context);
      const expected = expectedScope === 'minor' ? '按明刊晏平仲例，小限在辰宫，流年丧门实守此宫，本命天哭从戌宫正冲'
        : '按明刊冉求例，本命天哭实守卯宫的本命命宫，流年丧门从酉宫正冲';
      assert.ok(audit.includes(expected), expected);
      assert.doesNotMatch(audit, /cryMourningNanyang|quanshu-nanyangtang/u);
      const prompt = formatFortunePrompt(context);
      const minorCondition = /流年丧门实守复算的小限/u;
      const lifeCondition = /本命天哭实守命宫，流年丧门从对宫正冲/u;
      assert.equal(minorCondition.test(prompt), expectedScope === 'minor');
      assert.equal(lifeCondition.test(prompt), expectedScope === 'natal');
      assert.doesNotMatch(prompt, /晏平仲例|冉求例|cryMourningNanyang|辰宫|卯宫/u);
    }
    if (independent) {
      assert.deepEqual([data.cryMourningCandidate, data.cryMourningLimitAspectCandidate, data.cryMourningSplitLimitsCandidate], [false, false, false]);
      const wrongSource = { ...fact, normalizedPayload: { ...data, cryMourningNanyangProfile: 'other-edition' } };
      assert.equal(match({ ...run, facts: [wrongSource] }, 52).status, 'not_matched');
      const engine = astro.withOptions({ ...sample, fixLeap: true, config });
      const h = engine.horoscope(year + '-06-01', 6);
      const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
      for (const [star, expected] of [['天哭', 'unknown'], ['天虚', 'matched']]) {
        const natal = misplacedNatalStar(engine.toJSON(), star, 'adjectiveStars');
        const normalizedPayload = quanshuYearEncounters(natal, quanshuLimitBranches(natal, frame), window, []);
        assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload }] }, 52).status, expected, star);
      }
      const oldFact = { ...fact, normalizedPayload: { ...data, kuXuPlacementProof: undefined } };
      assert.equal(match({ ...run, facts: [oldFact] }, 52).status, 'unknown');
    }
  }
  const archive = astro.withOptions({ ...yan, fixLeap: true, config });
  const natal = archive.toJSON(), horoscope = archive.horoscope('2022-06-01', 6);
  const frame = { lunarYear: 2022, yearIndex: horoscope.yearly.index, decadalIndex: horoscope.decadal.index };
  const window = { start: Date.UTC(2022, 5, 1), end: Date.UTC(2022, 5, 2) };
  assert.ok(actualMinor);
  for (const minorIndex of [undefined, (horoscope.age.index + 1) % 12]) {
    const mismatched = quanshuYearEncounters(natal, quanshuLimitBranches(natal, { ...frame, minorIndex }), window, []);
    assert.equal(mismatched.cryMourningNanyangMinorCandidate, undefined);
    const wrong = { ...actualMinor.fact, normalizedPayload: mismatched };
    assert.notEqual(match({ ...actualMinor.run, facts: [wrong] }, 52).status, 'matched');
  }
});

test('p052 computes the Quanji birth placements before checking both aspects to the same life palace', () => {
  const dateStr = '1990-05-05', timeIndex = 1;
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON();
  assert.deepEqual([natal.rawDates.lunarDate.lunarMonth, natal.rawDates.lunarDate.lunarDay], [4, 11]);
  assert.equal(natal.palaces.find(palace => palace.name === '命宫').earthlyBranch, '辰');
  for (const [year, mourningBranch, mourningRelation] of [
    [2009, '卯', '三合'], [2010, '辰', undefined], [2011, '巳', '冲'],
  ]) {
    const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const run = bindSourceRun(natal, input, Date.UTC(year, 5, 1));
    validateFortuneFacts(run);
    const fact = encounterFact(run, year), data = fact.normalizedPayload;
    const matched = mourningRelation !== undefined;
    assert.deepEqual([data.cries[0].branch, data.mourningBranch], ['子', mourningBranch]);
    assert.equal(data.cryMourningQuanjiProfile, 'quanji-taixuan-tianzhang-life-and-six-harmony-cry-v1');
    assert.equal(data.cryMourningQuanjiLifeAspectCandidate, matched);
    assert.deepEqual([data.cryMourningCandidate, data.cryMourningLimitAspectCandidate, data.cryMourningSplitLimitsCandidate,
      data.cryMourningNanyangMinorCandidate, data.cryMourningNanyangLifeCandidate], [false, false, false, false, false]);
    assert.deepEqual(data.cryMourningQuanjiLifeWitness, matched ? {
      tianzhangBranch: '酉', lifeBranch: '亥', cryBranch: '未', mourningBranch, cryRelation: '三合', mourningRelation,
    } : undefined);
    const cutRun = onlyEncounter(run, fact), hit = match(cutRun, 52);
    assert.equal(hit.status, matched ? 'matched' : 'not_matched');
    if (!matched) continue;
    assert.equal(hit.matchedSourceExcerpt, '并照命兮');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(fact.activeFrom, new Date(quanshuLunarMidnight(year, 1)).toISOString());

    if (year === 2009) {
      const { input: model } = buildFortuneModelContext(cutRun, interpretFortune(cutRun, requestForFortuneRun(cutRun), 'quanji-cry-mourning'));
      const prompt = formatFortunePrompt(model);
      assert.match(prompt, /并照命兮/u);
      assert.doesNotMatch(prompt, /cryMourningQuanji|天杖(?:在|[、：])?酉|命宫在亥|哭泣加臨/u);
      const horoscope = engine.horoscope(year + '-06-01', 6);
      const frame = { lunarYear: year, yearIndex: horoscope.yearly.index };
      const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
      const source = (sourceNatal, birthTimeKnown) =>
        quanshuYearEncounters(sourceNatal, quanshuLimitBranches(sourceNatal, frame), window, [], undefined, birthTimeKnown);
      const independent = source(natal, true);
      assert.equal(independent.cryMourningQuanjiLifeAspectCandidate, true);
      assert.equal(independent.cryMourningMinorCoGuardCandidate, false);
      for (const bad of [source(natal, false), source({ ...natal, solarDate: '1990-05-06' }, true)]) {
        assert.equal(bad.ready, true);
        assert.equal(bad.cryMourningQuanjiProfile, undefined);
        assert.equal(bad.cryMourningQuanjiLifeAspectCandidate, undefined);
        assert.notEqual(match({ ...run, facts: [{ ...fact, normalizedPayload: bad }] }, 52).status, 'matched');
      }
      const wrongProfile = { ...data, cryMourningQuanjiProfile: 'quanshu-native-chart' };
      assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongProfile }] }, 52).status, 'not_matched');
    }
  }

  // The Quanji day-16 body is 卯, but the hour puts life at 子. Both aspects reach only the body.
  const bodyOnly = astro.withOptions({ dateStr: '1990-05-10', timeIndex: 0, gender: '女', fixLeap: true, config });
  assert.equal(bodyOnly.toJSON().rawDates.lunarDate.lunarDay, 16);
  assert.deepEqual(['未', '酉'].map(branch => quanshuPalaceRelation('卯', branch)), ['三合', '冲']);
  const bodyYear = bodyOnly.horoscope('2003-06-01', 6);
  const bodyFrame = { lunarYear: 2003, yearIndex: bodyYear.yearly.index };
  const bodyNatal = bodyOnly.toJSON();
  const body = quanshuYearEncounters(bodyNatal, quanshuLimitBranches(bodyNatal, bodyFrame),
    { start: Date.UTC(2003, 5, 1), end: Date.UTC(2003, 5, 2) }, [], undefined, true);
  assert.equal(body.mourningBranch, '酉');
  assert.equal(body.cryMourningQuanjiLifeAspectCandidate, false);

  const leap = leapNative(16);
  assert.equal(leap.rawDates.lunarDate.isLeap, true);
  const leapFrame = { lunarYear: 2009, yearIndex: leap.palaces.find(palace => palace.earthlyBranch === '丑').index };
  const leapFact = quanshuYearEncounters(leap, quanshuLimitBranches(leap, leapFrame),
    { start: Date.UTC(2009, 5, 1), end: Date.UTC(2009, 5, 2) }, [], undefined, true);
  assert.equal(leapFact.ready, true);
  assert.equal(leapFact.cryMourningQuanjiLifeAspectCandidate, undefined);
});

test('p052 accepts a Cry or Mourning guard and an actual aspect to that same limit, excluding two aspects to a third palace', () => {
  const samples = [
    [2010, 'decadal', '辰', '三合', '守'],
    [2012, 'minor', '午', '冲', '守'],
    [2046, 'decadal', '子', '守', '三合'],
  ];
  for (const [year, scope, branch, cryRelation, mourningRelation] of samples) {
    const run = real({ timeIndex: 0, year });
    const fact = encounterFact(run, year), data = fact.normalizedPayload;
    assert.equal(data.cryMourningCandidate, false);
    assert.equal(data.cryMourningLimitAspectCandidate, true);
    assert.deepEqual(data.cryMourningLimitContacts.filter(row => row.candidate),
      [{ scope, branch, cryRelation, mourningRelation, candidate: true }]);
    const result = match(onlyEncounter(run, fact), 52);
    assert.equal(result.status, year === 2012 ? 'matched' : 'partial');
    assert.ok(result.sourceFactIds.includes(fact.factId));
  }

  const third = real({ timeIndex: 0, year: 2002 }), thirdFact = encounterFact(third, 2002);
  assert.deepEqual(thirdFact.normalizedPayload.cryMourningLimitContacts.find(row => row.scope === 'minor'),
    { scope: 'minor', branch: '辰', cryRelation: '三合', mourningRelation: '三合', candidate: false });
  assert.equal(match(onlyEncounter(third, thirdFact), 52).status, 'not_matched');

  const sample = { timeIndex: 0, year: 2010 }, run = real(sample), fact = encounterFact(run, sample.year);
  const natal = native(sample), branch = fact.normalizedPayload.annualBranch;
  const yearIndex = natal.palaces.find(row => row.earthlyBranch === branch).index;
  const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const frame = { lunarYear: sample.year, yearIndex };
  assert.equal(quanshuYearEncounters(natal, quanshuLimitBranches(natal, frame), window, []).cryMourningLimitAspectCandidate, undefined);
  const p = fact.normalizedPayload, index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const actualFrame = { ...frame, decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) };
  const shifted = shiftDecadalRange(natal, actualFrame);
  const unverified = quanshuYearEncounters(shifted, quanshuLimitBranches(shifted, actualFrame), window, []);
  assert.deepEqual(unverified.sourceDecadal, { branch: '辰', verified: false });
  assert.equal(unverified.cryMourningLimitAspectCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, 52).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'cry-mourning-limit-test'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大限在辰宫，本命天哭在子宫，与该限宫为三合，流年丧门在辰宫，与该限宫为守/u);
  assert.doesNotMatch(prompt, /cryMourningLimitAspectCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === ruleNumber(52).knowledgeId));
});

test('Cry-Void and Cry-Mourning cannot use an unverified small limit on the same natal chart', () => {
  const natal = native({ timeIndex: 0 });
  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  for (const [year, rule, key, expectedMinor] of [
    [2005, 19, 'cryVoidTogetherCandidate', '丑'],
    [2002, 52, 'cryMourningLimitAspectCandidate', '辰'],
  ]) {
    const run = real({ timeIndex: 0, year }), fact = encounterFact(run, year), p = fact.normalizedPayload;
    assert.equal(match(onlyEncounter(run, fact), rule).status, 'not_matched');
    assert.equal(p.minorBranch, expectedMinor);
    const frame = { lunarYear: year, yearIndex: index(p.annualBranch),
      decadalIndex: index(p.decadalBranch), minorIndex: index('子') };
    const limits = quanshuLimitBranches(natal, frame);
    assert.equal(limits.sourceMinor.verified, false);
    const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
    const data = quanshuYearEncounters(natal, limits, window, []);
    assert.equal(data.cries.find(row => row.star === '天哭').branch, '子');
    assert.equal(data.minorBranch, '子');
    assert.equal(data[key], undefined);
    assert.ok(data.cries.every(row => row.minor === undefined));
    assert.equal(data.cryMourningLimitContacts.find(row => row.scope === 'minor').branch, undefined);
    const withoutProof = { ...run, facts: [{ ...fact, normalizedPayload: data }] };
    assert.equal(match(withoutProof, rule).status, 'unknown');
    const audit = describeFortuneFact({ method: 'ziwei', type: encounterType, data }, String);
    assert.doesNotMatch(audit, /小限在子宫|小限守子宫|本命天哭实守小限/u);
  }
});

test('p052 binds independent Cry and Mourning guards to distinct actual limits in the same lunar year', () => {
  for (const [dateStr, timeIndex, year, cryScope, crySeat, mourningScope, mourningSeat, hasAspect, phrase] of [
    ['1977-03-14', 7, 2038, 'decadal', '丑', 'minor', '申', false, /本命天哭实守大限丑宫，流年丧门实守小限申宫/u],
    ['1975-03-14', 1, 2049, 'minor', '卯', 'decadal', '未', true, /本命天哭实守小限卯宫，流年丧门实守大限未宫/u],
  ]) {
    const natal = native({ dateStr, timeIndex, gender: '男' });
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 15);
    const ref = { snapshotId: 'cry-mourning-split-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'cry-mourning-split', ref);
    validateFortuneFacts(run);
    const fact = encounterFact(run, year);
    const p = fact.normalizedPayload;
    assert.equal(p.cryMourningCandidate, false);
    assert.equal(p.cryMourningLimitAspectCandidate, hasAspect);
    assert.equal(p.cryMourningSplitLimitsCandidate, true);
    assert.deepEqual(p.cryMourningSplitGuards, [{ cryScope, crySeat, mourningScope, mourningSeat, candidate: true }]);
    assert.equal(p[cryScope + 'Branch'], crySeat);
    assert.equal(p[mourningScope + 'Branch'], mourningSeat);
    assert.equal(p.cries.find(row => row.star === '天哭').branch, crySeat);
    assert.equal(p.mourningBranch, mourningSeat);
    const sameYear = onlyEncounter(run, fact), hit = match(sameYear, 52);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

    const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
    const frame = { lunarYear: year, yearIndex: index(p.annualBranch),
      decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) };
    const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
    const compute = (candidate, anchors) => quanshuYearEncounters(candidate, quanshuLimitBranches(candidate, anchors), window, []);
    assert.equal(compute(natal, { ...frame, minorIndex: frame.decadalIndex }).cryMourningSplitLimitsCandidate, undefined);
    assert.equal(compute(natal, { ...frame, minorIndex: undefined }).cryMourningSplitLimitsCandidate, undefined);
    const missingCry = structuredClone(natal);
    for (const palace of missingCry.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
      palace[key] = palace[key].filter(row => row.name !== '天哭');
    }
    assert.equal(compute(missingCry, frame).cryMourningSplitLimitsCandidate, undefined);

    const { input } = buildFortuneModelContext(sameYear, interpretFortune(sameYear, requestForFortuneRun(sameYear), 'cry-mourning-split'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase);
    assert.doesNotMatch(prompt, /cryMourningSplitLimitsCandidate|cryMourningSplitGuards/u);
  }
});

test('p052 verifies the Dade annual trio around the true Void limit while Mourning trines Cry', () => {
  const birth = { dateStr: '1980-03-05', timeIndex: 0, gender: '男' }, year = 2068;
  const a = astro.withOptions({ ...birth, fixLeap: true, config }), natal = a.toJSON();
  const run = bindSourceRun(natal, { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' },
    Date.UTC(year, 5, 15));
  validateFortuneFacts(run);
  const fact = encounterFact(run, year), data = fact.normalizedPayload;
  const field = 'cryMourningDadeSplitFourFlyingCandidate';
  assert.deepEqual([data[field], data.cryVoidSplitCandidate, data.cryMourningSplitLimitsCandidate], [true, true, true]);
  assert.deepEqual([data.cryMourningCandidate, data.cryMourningNanyangMinorCandidate, data.cryMourningNanyangLifeCandidate],
    [false, false, false]);
  assert.deepEqual(data.cryMourningDadeSplitFourFlyingWitness, {
    cry: { branch: '戌', scope: 'decadal' }, voidStar: { branch: '寅', scope: 'minor' },
    fourFlying: [{ star: '丧门', branch: '寅', relation: '守' }, { star: '吊客', branch: '戌', relation: '三合' },
      { star: '白虎', branch: '申', relation: '冲' }],
  });
  const selected = { ...run, facts: [fact] }, hit = match(selected, 52);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '天哭喪門流年莫遇');
  assert.deepEqual(hit.windows, [{ start: '2068-02-02T16:00:00.000Z', endExclusive: fact.activeTo }]);
  assert.equal(match(selected, 19).matchedSourceExcerpt, '二限若逢之');
  const evaluate = (chart, lunarYear, change = frame => frame) => {
    const h = a.horoscope(lunarYear + '-06-01', 6), at = quanshuLunarMidnight(lunarYear, 1);
    const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    return quanshuYearEncounters(chart, quanshuLimitBranches(chart, change(frame)), { start: at, end: at + 1000 }, []);
  };
  for (const altered of [
    evaluate(misplacedNatalStar(natal, '天虚', 'adjectiveStars'), year),
    evaluate(natal, year, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 })),
    evaluate(natal, year, frame => ({ ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 })),
  ]) {
    assert.equal(altered[field], undefined);
    assert.equal(altered.cryMourningDadeSplitFourFlyingWitness, undefined);
    assert.notEqual(match({ ...selected, facts: [{ ...fact, normalizedPayload: altered }] }, 52).status, 'matched');
  }
  for (const nearby of [2067, 2069]) assert.equal(evaluate(natal, nearby)[field], false);
  const input = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'cry-mourning-dade')).input;
  assert.match(formatFortuneFactAudit(input), /天虚实守小限寅宫，该限有丧门在寅宫守、吊客在戌宫三合、白虎在申宫冲/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /天哭喪門流年莫遇/u);
  assert.doesNotMatch(prompt, /cryMourningDadeSplitFourFlying|天虚实守小限寅宫|(?:丧门在寅|吊客在戌|白虎在申)宫/u);
});

test('the Doujun contrast requires three favorable seats and an adverse verified first-month seat in the same fragment', () => {
  const run = real(doujunContrast); validateFortuneFacts(run);
  const fact = encounterFact(run, 2030), p = fact.normalizedPayload;
  assert.deepEqual(p.yearLayers.map(row => [row.label, row.branch, row.support.map(star => star.star), row.sha]),
    [['太岁', '戌', ['天府'], []], ['大限', '午', ['紫微'], []], ['小限', '子', ['文曲'], []]]);
  assert.equal(p.doujunBranch, '卯');
  assert.deepEqual(p.doujunSha.map(row => row.star), ['古天空']);
  assert.equal(p.doujunYearAnnualShaCandidate, false);
  assert.deepEqual(p.firstMonth, { start: '2030-02-02T16:00:00.000Z', end: '2030-03-03T16:00:00.000Z' });
  const result = match(onlyEncounter(run, fact), 44);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '如太岁二限美');
  assert.ok(result.sourceFactIds.includes(fact.factId) && fact.sourceFactIds.length >= 2);
  const months = run.facts.filter(row => row.factType === doujunReviewType && row.normalizedPayload.lunarYear === 2030);
  assert.equal(months.length, 12);
  assert.ok(months.every(row => row.scope === 'monthly' && row.activeFrom >= fact.activeFrom && row.activeTo <= fact.activeTo
    && row.subjectIds[0] === fact.subjectIds[0] && row.sourceFactIds.some(id => fact.sourceFactIds.includes(id))));
  const selected = months.filter(row => [...result.sourceFactIds, ...result.candidateFactIds].includes(row.factId));
  assert.deepEqual(selected.map(row => row.normalizedPayload.lunarMonth), [1, 2, 5, 7, 11, 12]);
  assert.deepEqual(result.windows, [{ start: p.firstMonth.start, endExclusive: p.firstMonth.end }]);
  assert.deepEqual(result.candidateWindows, [
    { start: '2030-03-03T16:00:00.000Z', endExclusive: '2030-04-02T16:00:00.000Z' },
    { start: '2030-05-31T16:00:00.000Z', endExclusive: '2030-06-30T16:00:00.000Z' },
    { start: '2030-07-29T16:00:00.000Z', endExclusive: '2030-08-28T16:00:00.000Z' },
    { start: '2030-11-24T16:00:00.000Z', endExclusive: '2030-12-31T16:00:00.000Z' },
  ]);
  assert.deepEqual(months.find(row => row.normalizedPayload.lunarMonth === 4).normalizedPayload.support,
    [{ star: '紫微', branch: '午' }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'year-encounter-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /正月初一的斗君在卯宫，守宫有古天空/u);
  assert.match(prompt, /农历2030年2月斗君宫在辰宫；当月具名煞曜实守有天使/u);
  assert.deepEqual(input.facts.filter(row => row.type === doujunReviewType && row.data.lunarYear === 2030)
    .map(row => row.data.lunarMonth).sort((a, b) => a - b), [1, 2, 5, 7, 11, 12]);
  assert.doesNotMatch(prompt, /quanshu_year_encounters|quanshu_doujun_year_month|doujunYearContrastCandidate/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId === result.knowledgeId));
  for (const [sample, support, sha] of [[{ timeIndex: 0, year: 1999 }, false, true], [{ timeIndex: 1, year: 2025 }, true, false]]) {
    const near = real(sample), other = encounterFact(near, sample.year);
    assert.equal(other.normalizedPayload.yearSupportCandidate, support);
    assert.equal(other.normalizedPayload.doujunSha.length > 0, sha);
    assert.equal(match(onlyEncounter(near, other), 44).status, 'not_matched');
    if (sample.year === 2025) {
      const available = near.facts.filter(row => row.factType === doujunReviewType && row.normalizedPayload.lunarYear === sample.year);
      assert.deepEqual(available.map(row => row.normalizedPayload.lunarMonth), [1, 2, 3, 4, 5, 6]);
      assert.equal(available[1].normalizedPayload.shaGuard, true); // Later evidence cannot supply the missing first-month premise.
      assert.equal(available[1].normalizedPayload.annualShaGuard, true);
      assert.equal(available[1].normalizedPayload.annualShaReviewCandidate, false);
    }
  }
  const natal = native(doujunContrast);
  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const limits = quanshuLimitBranches(natal, { lunarYear: 2030, yearIndex: index(p.annualBranch),
    decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) });
  const window = { start: Date.parse(p.firstMonth.start), end: Date.parse(p.firstMonth.end) };
  assert.equal(quanshuYearEncounters(natal, limits, window, []).doujunYearContrastCandidate, undefined);
  const laterWindow = { ...window, start: window.start + 1 };
  assert.equal(quanshuYearEncounters(natal, limits, laterWindow, []).doujunYearContrastCandidate, undefined);
  const monthSource = buildQuanshuDoujunMonths({ ...window, end: window.end + 30 * 86_400_000 }, natal);
  const frame = { lunarYear: 2030, yearIndex: index(p.annualBranch), decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) };
  const nextBirthDay = native({ ...doujunContrast, dateStr: '1990-05-06' });
  const mismatchedMajors = withMajorStarsFrom(nextBirthDay, natal);
  const birthDayLimits = quanshuLimitBranches(nextBirthDay, frame);
  const mismatchedLimits = quanshuLimitBranches(mismatchedMajors, frame);
  assert.deepEqual([p.ziweiBirthAnchorVerified, birthDayLimits.verifiedMajorBranches['紫微'], mismatchedLimits.verifiedMajorBranches['紫微']],
    [true, '未', '午']);
  const nextBirthDayFact = quanshuYearEncounters(nextBirthDay, birthDayLimits, window, buildQuanshuDoujunMonths(window, nextBirthDay));
  assert.equal(nextBirthDayFact.doujunMingYearContrastCandidate, false);
  const { monthlyReviews: [mismatchedMonth], ...mismatchedYear } = quanshuYearEncounters(
    mismatchedMajors, mismatchedLimits, window, buildQuanshuDoujunMonths(window, mismatchedMajors));
  assert.equal(mismatchedYear.ziweiBirthAnchorVerified, false);
  assert.deepEqual(mismatchedYear.yearLayers.map(({ support }) => support.map(row => row.star)), [[], [], ['文曲']]);
  assert.equal(mismatchedYear.doujunMingYearContrastCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: mismatchedYear },
    { ...months[0], normalizedPayload: mismatchedMonth.data }] }, 44).status, 'unknown');
  const shifted = shiftDecadalRange(natal, frame);
  const unverified = quanshuYearEncounters(shifted, quanshuLimitBranches(shifted, frame), window, monthSource);
  assert.equal(unverified.sourceDecadal.verified, false);
  assert.equal(unverified.openingSeatsMatch, undefined);
  assert.equal(unverified.doujunYearContrastCandidate, undefined);
  const [unverifiedMonth] = unverified.monthlyReviews;
  assert.equal(unverifiedMonth.data.lunarMonth, 1);
  assert.equal(unverifiedMonth.data.natalShaReviewCandidate, undefined);
  assert.equal(unverifiedMonth.data.mingNatalShaReviewCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: unverified },
    { ...months[0], normalizedPayload: unverifiedMonth.data }] }, 44).status, 'unknown');
  const oldFacts = [fact, ...months].map(({ normalizedPayload: { limitPlacementProof, ...payload }, ...row }) => {
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    return { ...row, normalizedPayload: payload };
  });
  assert.equal(match({ ...run, facts: oldFacts }, 44).status, 'unknown');
  const clipped = quanshuYearEncounters(natal, limits, { ...window, end: window.end - 1_000 }, monthSource);
  assert.deepEqual(clipped.monthlyReviews.map(row => [row.start, row.end, row.data.lunarMonth]), [[window.start, window.end - 1_000, 1]]);
  assert.deepEqual(quanshuYearEncounters(natal, limits, { ...window, start: window.start + 1 }, monthSource).monthlyReviews, []);
  const mismatched = structuredClone(monthSource);
  mismatched[0].data.annualBranch = '亥';
  assert.deepEqual(quanshuYearEncounters(natal, limits, window, mismatched).monthlyReviews, []);
  const mismatchedBirthMonth = structuredClone(monthSource);
  mismatchedBirthMonth[0].data.birthMonthBasis = 'quanshu-leap-next-month';
  assert.equal(quanshuYearEncounters(natal, limits, window, mismatchedBirthMonth).doujunYearContrastCandidate, undefined);
  assert.deepEqual(quanshuYearEncounters(natal, limits, window, mismatchedBirthMonth).monthlyReviews, []);
  const opening = { lunarYear: 2030, annualBranch: p.annualBranch, decadalBranch: p.decadalBranch, minorBranch: p.minorBranch };
  const checked = quanshuYearEncounters(natal, limits, laterWindow, monthSource, at => {
    assert.equal(at, window.start);
    return opening;
  });
  assert.equal(checked.includesFirstInstant, false);
  assert.equal(checked.doujunYearContrastCandidate, true);
  assert.deepEqual(checked.monthlyReviews.map(row => [row.start, row.end, row.data.lunarMonth]), [[laterWindow.start, window.end, 1]]);
  for (const [other, expected] of [[{ ...opening, minorBranch: '丑' }, false], [{ ...opening, lunarYear: 2029 }, false],
    [{ ...opening, minorBranch: undefined }, undefined]]) {
    const unverified = quanshuYearEncounters(natal, limits, laterWindow, monthSource, () => other);
    assert.equal(unverified.doujunYearContrastCandidate, expected);
    assert.deepEqual(unverified.monthlyReviews, []);
  }
});

test('p044 separates annual Yang and Tuo from Ming fixed natal guards through client submission and SQLite', () => {
  const cases = [
    [{ dateStr: '1981-02-15', timeIndex: 1, year: 2034 }, [[1, '卯', '流年擎羊'], [11, '丑', '流年陀罗']], [
      { start: '2034-02-18T16:00:00.000Z', endExclusive: '2034-03-19T16:00:00.000Z' },
      { start: '2034-12-10T16:00:00.000Z', endExclusive: '2034-12-31T16:00:00.000Z' },
    ]],
    [{ dateStr: '1986-10-17', timeIndex: 7, year: 2035 }, [[1, '寅', '流年陀罗'], [3, '辰', '流年擎羊']], [
      { start: '2035-02-07T16:00:00.000Z', endExclusive: '2035-03-09T16:00:00.000Z' },
      { start: '2035-04-07T16:00:00.000Z', endExclusive: '2035-05-07T16:00:00.000Z' },
    ]],
  ];
  for (const [example, expectedSeats, windows] of cases) {
    const { year } = example;
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(year, 5, 1);
    const reference = { snapshotId: 'doujun-annual-' + year, chart: chart(native(example)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'doujun-annual-test', reference);
    validateFortuneFacts(run);
    const fact = encounterFact(run, year), data = fact.normalizedPayload;
    const [, firstBranch, firstStar] = expectedSeats[0];
    assert.equal(data.yearSupportCandidate, true);
    assert.equal(data.doujunYearContrastCandidate, false);
    assert.deepEqual(data.doujunSha, []);
    assert.deepEqual(data.doujunAnnualSha, [{ star: firstStar, branch: firstBranch }]);
    assert.equal(data.doujunYearAnnualShaCandidate, true);
    assert.equal(data.firstMonth.start, windows[0].start);

    const months = run.facts.filter(row => row.factType === doujunReviewType && row.normalizedPayload.lunarYear === year);
    assert.deepEqual(months.filter(({ normalizedPayload: row }) => row.annualShaReviewCandidate)
      .map(({ normalizedPayload: row }) => [row.lunarMonth, row.branch, row.annualSha[0].star]), expectedSeats);
    assert.ok(months.some(({ normalizedPayload: row }) => row.shaGuard === true && row.annualShaGuard === false));
    assert.ok(months.every(({ normalizedPayload: row }) => row.natalShaReviewCandidate === false));
    const scoped = onlyEncounter(run, fact);
    const result = match(scoped, 44);
    if (year === 2035) {
      assert.equal(data.mingYearSupportCandidate, false);
      assert.equal(data.doujunMingYearAnnualShaCandidate, false);
      assert.equal(result.status, 'not_matched');
      continue;
    }
    assert.equal(data.doujunMingYearContrastCandidate, true);
    assert.equal(data.doujunMingYearAnnualShaCandidate, true);
    const selected = months.filter(row => [...result.sourceFactIds, ...result.candidateFactIds].includes(row.factId));
    assert.equal(result.status, 'matched');
    assert.equal(result.matchedSourceExcerpt, '如太岁二限美');
    assert.deepEqual(result.windows, [windows[0]]);
    assert.deepEqual(result.candidateWindows, [
      { start: '2034-05-17T16:00:00.000Z', endExclusive: '2034-06-15T16:00:00.000Z' },
      { start: '2034-07-15T16:00:00.000Z', endExclusive: '2034-08-13T16:00:00.000Z' },
      { start: '2034-09-12T16:00:00.000Z', endExclusive: '2034-10-11T16:00:00.000Z' },
      { start: '2034-11-10T16:00:00.000Z', endExclusive: windows[1].endExclusive },
    ]);
    assert.deepEqual(result.sourceFactIds, [selected[0].factId, fact.factId]);
    assert.deepEqual(selected.map(({ normalizedPayload: row }) => row.lunarMonth), [1, 4, 6, 8, 10, 11]);
    assert.deepEqual(selected.filter(({ normalizedPayload: row }) => row.mingAnnualShaReviewCandidate)
      .map(({ normalizedPayload: row }) => [row.lunarMonth, row.branch, row.annualSha[0].star]), expectedSeats);

    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'doujun-annual'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('正月初一的斗君在' + firstBranch + '宫，按流年干核位的守宫星有' + firstStar));
    for (const [month, branch, star] of expectedSeats) {
      assert.ok(prompt.includes('农历' + year + '年' + month + '月斗君宫在' + branch + '宫；按本年年干定位，实守当月斗君宫的有' + star));
    }
    assert.doesNotMatch(prompt, /doujunYearAnnualShaCandidate|annualShaReviewCandidate/u);
    assert.ok(input.sections.some(section => section.findings.some(item => item.knowledgeId === result.knowledgeId)));
  }

  const conflict = real({ dateStr: '1991-10-15', timeIndex: 0, year: 2058 });
  const conflictFact = encounterFact(conflict, 2058), conflictData = conflictFact.normalizedPayload;
  assert.equal(conflictData.yearSupportCandidate, true);
  assert.equal(conflictData.minorBranch, '午');
  assert.equal(conflictData.doujunBranch, '午');
  assert.deepEqual(conflictData.doujunAnnualSha, [{ star: '流年擎羊', branch: '午' }]);
  assert.equal(conflictData.doujunYearAnnualShaCandidate, false);
  assert.equal(match(onlyEncounter(conflict, conflictFact), 44).status, 'not_matched');
});

test('p044 compares actual Ming natal guards with archive positions at the same opening and later months', () => {
  const dateStr = '1980-03-11', timeIndex = 4;
  const submitted = (gender, year) => {
    const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const run = bindSourceRun(native({ dateStr, timeIndex, gender }), input, Date.UTC(year, 5, 1));
    validateFortuneFacts(run);
    const fact = encounterFact(run, year);
    return { fact, run: onlyEncounter(run, fact) };
  };
  const { fact, run } = submitted('男', 2014), p = fact.normalizedPayload;
  assert.equal(p.doujunYearContrastCandidate, false);
  assert.equal(p.doujunMingYearContrastCandidate, true);
  assert.equal(p.doujunMingYearAnnualShaCandidate, false);
  assert.deepEqual(p.yearLayers.map(row => [row.branch, row.favorable, row.mingFavorable]),
    [['午', false, true], ['丑', true, true], ['申', true, true]]);
  assert.deepEqual(p.mingDoujunSha, [{ star: '铃星', branch: '戌' }]);
  assert.equal(p.firstMonth.start, '2014-01-30T16:00:00.000Z');
  const matched = match(run, 44);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, '如太岁二限美');
  const monthIds = [...matched.sourceFactIds, ...matched.candidateFactIds];
  const months = run.facts.filter(row => row.factType === doujunReviewType && monthIds.includes(row.factId));
  assert.deepEqual(months.map(row => row.normalizedPayload.lunarMonth), [1, 5, 6, 8]);
  assert.deepEqual(matched.sourceFactIds, [months[0].factId, fact.factId]);
  assert.deepEqual(matched.windows, [{ start: '2014-01-30T16:00:00.000Z', endExclusive: '2014-02-28T16:00:00.000Z' }]);
  assert.deepEqual(matched.candidateWindows, [
    { start: '2014-05-28T16:00:00.000Z', endExclusive: '2014-07-26T16:00:00.000Z' },
    { start: '2014-08-24T16:00:00.000Z', endExclusive: '2014-09-23T16:00:00.000Z' },
  ]);
  const natal = native({ dateStr, timeIndex, gender: '男' });
  const byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const limits = quanshuLimitBranches(natal, { lunarYear: 2014, yearIndex: byBranch(p.annualBranch),
    decadalIndex: byBranch(p.decadalBranch), minorIndex: byBranch(p.decadalBranch) });
  assert.equal(limits.sourceMinor.verified, false);
  const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const { monthlyReviews, ...displaced } = quanshuYearEncounters(natal, limits, window, buildQuanshuDoujunMonths(window, natal));
  assert.equal(displaced.minorBranch, p.decadalBranch);
  assert.equal(displaced.yearLayers[2].branch, undefined);
  assert.equal(displaced.doujunMingYearContrastCandidate, undefined);
  const month = months[0], review = monthlyReviews.find(row => row.data.lunarMonth === month.normalizedPayload.lunarMonth);
  assert.equal(review.data.mingNatalShaReviewCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: displaced },
    { ...month, normalizedPayload: review.data }] }, 44).status, 'unknown');
  const frame = { lunarYear: 2014, yearIndex: byBranch(p.annualBranch), decadalIndex: byBranch(p.decadalBranch),
    minorIndex: byBranch(p.minorBranch) };
  const recalculate = shifted => quanshuYearEncounters(shifted, quanshuLimitBranches(shifted, frame),
    window, buildQuanshuDoujunMonths(window, shifted));
  const wrongNoble = recalculate(misplacedNatalStar(natal, '天魁', 'minorStars'));
  assert.deepEqual(wrongNoble.yearLayers[1].support, []);
  assert.equal(wrongNoble.doujunMingYearContrastCandidate, undefined);
  const opener = wrongNoble.monthlyReviews[0].data;
  assert.equal(opener.mingNatalShaReviewCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongNoble }, { ...months[0], normalizedPayload: opener }] }, 44).status, 'unknown');

  const wrongAgent = recalculate(misplacedNatalStar(natal, '天使', 'adjectiveStars'));
  assert.equal(wrongAgent.doujunMingYearContrastCandidate, true);
  const monthEight = months.find(row => row.normalizedPayload.lunarMonth === 8);
  const changedEight = wrongAgent.monthlyReviews.find(row => row.data.lunarMonth === 8).data;
  assert.equal(changedEight.mingNatalShaReviewCandidate, undefined);
  assert.deepEqual(changedEight.mingSha, []);
  const sixth = wrongAgent.monthlyReviews.find(row => row.data.lunarMonth === 6).data;
  assert.equal(sixth.mingNatalShaReviewCandidate, true);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongAgent }, { ...monthEight, normalizedPayload: changedEight }] }, 44).status, 'unknown');
  const oldMonth = { ...months[0], normalizedPayload: { ...months[0].normalizedPayload, doujunNamedStarLayerProof: undefined } };
  assert.equal(match({ ...run, facts: [fact, oldMonth] }, 44).status, 'unknown');
  const wrongProfile = structuredClone(run);
  encounterFact(wrongProfile, 2014).normalizedPayload.quanshuFixedFireBellProfile = 'archive-position';
  assert.equal(match(wrongProfile, 44).status, 'not_matched');

  const near = submitted('女', 2006), q = near.fact.normalizedPayload;
  assert.equal(q.doujunYearContrastCandidate, true);
  assert.equal(q.doujunMingYearContrastCandidate, false);
  assert.equal(q.mingYearSupportCandidate, false);
  assert.deepEqual(q.mingDoujunSha, [{ star: '火星', branch: '寅' }]);
  assert.equal(match(near.run, 44).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-doujun-sha'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === matched.knowledgeId));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /明刊定宫核到正月初一斗君在戌宫，实守有铃星/u);
  assert.match(audit, /明刊定宫核当月斗君宫的具名煞曜实守有火星/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /如太岁二限美/u);
  assert.doesNotMatch(prompt, /明刊定宫核到正月初一斗君|明刊定宫核当月斗君宫|doujunMingYearContrastCandidate/u);
});

test('p044 rechecks the same lunar opening for an annual view clipped before the next new year', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2031 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2031-11-19T03:00:00Z');
  const reference = { snapshotId: 'doujun-carry-chart', chart: chart(native(doujunContrast)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'doujun-carry', reference);
  const fact = encounterFact(run, 2030), data = fact.normalizedPayload;
  assert.deepEqual(data.yearOpening, { lunarYear: 2030, annualBranch: '戌', decadalBranch: '午', minorBranch: '子' });
  assert.equal(data.includesFirstInstant, false);
  assert.equal(data.openingSeatsMatch, true);
  assert.equal(data.doujunYearContrastCandidate, true);
  assert.deepEqual(data.firstMonth, { start: '2030-02-02T16:00:00.000Z', end: '2030-03-03T16:00:00.000Z' });
  const months = run.facts.filter(row => row.factType === doujunReviewType && row.normalizedPayload.lunarYear === 2030);
  assert.equal(months.length, 1);
  assert.equal(months[0].normalizedPayload.lunarMonth, 12);
  assert.equal(months[0].normalizedPayload.nativeStart, '2030-12-24T16:00:00.000Z');
  const expected = [{ start: '2030-12-31T16:00:00.000Z', endExclusive: '2031-01-22T16:00:00.000Z' }];
  assert.deepEqual(months.map(row => ({ start: row.activeFrom, endExclusive: row.activeTo })), expected);
  const scoped = { ...run, facts: run.facts.filter(row => row.factType === encounterType ? row.factId === fact.factId
    : row.factType !== doujunReviewType || row.factId === months[0].factId) };
  const result = match(scoped, 44);
  assert.equal(result.status, 'partial');
  assert.deepEqual(new Set(result.sourceFactIds), new Set([fact.factId, months[0].factId]));
  assert.deepEqual(result.windows, expected);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'doujun-carry-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /正月初一早于本段，已复核开年太岁和大小限的三个宫位均与本段相同/u);
  assert.match(prompt, /农历2030年12月斗君宫/u);
  assert.doesNotMatch(prompt, /yearOpening|openingSeatsMatch/u);
  assert.ok(input.sections.every(section => section.findings.every(item => item.knowledgeId !== result.knowledgeId)));
});

test('the actual new-year instant changes annual Doujun while natal crying/void positions stay fixed; day views retain only background', () => {
  const run = real(reference.examples[3]);
  const rows = run.facts.filter(f => f.factType === 'quanshu_doujun_context' && f.scope === 'yearly');
  assert.deepEqual(rows.map(f => f.normalizedPayload.doujunBranch), ['辰', '巳']);
  assert.equal(rows[0].activeTo, '2026-02-16T16:00:00.000Z'); assert.equal(rows[1].activeFrom, rows[0].activeTo);
  assert.deepEqual(rows.map(f => f.normalizedPayload.queryIncludesNewYear), [false, true]);
  assert.ok(rows[0].normalizedPayload.monthTimeline.every(row => !row.ready && row.branch === undefined));
  assert.ok(rows[1].normalizedPayload.monthTimeline.every(row => row.ready && row.startInstant >= rows[1].activeFrom
    && row.endInstantExclusive <= rows[1].activeTo));
  const first = rows[1].normalizedPayload.monthTimeline[0];
  assert.equal(first.lunarMonth, 1);
  assert.equal(first.startInstant, rows[1].activeFrom);
  assert.equal(first.branch, rows[1].normalizedPayload.doujunBranch);
  assert.ok(rows.every(row => row.normalizedPayload.bothLimitSeatsKnown));
  const crying = run.facts.filter(f => f.factType === 'quanshu_kuxu_condition' && f.scope === 'yearly');
  assert.ok(crying.every(f => f.normalizedPayload.positions.every(p => p.branch === '子')));
  const daily = calculate(chart(native()), 'day');
  const fact = daily.facts.find(f => f.factType === 'quanshu_doujun_context');
  assert.equal(fact.normalizedPayload.queryIncludesNewYear, false);
  assert.match(describeFortuneFact({ method: 'ziwei', type: fact.factType, data: fact.normalizedPayload }, String), /不冒充本窗新触发/u);
});

test('generic annual, overlap and star facts cannot replace a bound Doujun or envoy fact', () => {
  const run = real(envoyTogether);
  assert.ok(run.facts.some(row => row.factType === 'quanshu_shangshi_condition' && row.normalizedPayload.allThreeSamePalace
    && row.normalizedPayload.localSourceStars?.includes('天使')));
  assert.equal(match({ ...run, facts: run.facts.filter(row => row.factType !== 'quanshu_shangshi_limits') }, 41).status, 'unknown');
  const generic = structuredClone(real(doujunContrast)); generic.facts = generic.facts.filter(f => f.factType !== encounterType);
  assert.equal(match(generic, 44).status, 'unknown');
  const annualOnly = structuredClone(real(doujunContrast));
  annualOnly.facts = annualOnly.facts.filter(f => f.factType !== doujunReviewType);
  assert.equal(match(annualOnly, 44).status, 'unknown');
  const missingLimit = structuredClone(real(doujunContrast));
  for (const f of missingLimit.facts.filter(f => f.factType === encounterType)) {
    delete f.normalizedPayload.doujunYearContrastCandidate;
    delete f.normalizedPayload.doujunYearAnnualShaCandidate;
    delete f.normalizedPayload.doujunMingYearContrastCandidate;
    delete f.normalizedPayload.doujunMingYearAnnualShaCandidate;
  }
  assert.equal(match(missingLimit, 44).status, 'unknown');
  const unknown = chart(native()); unknown.timeKnown = false;
  assert.equal(match(calculate(unknown), 44).status, 'unknown');
});

test('source hashes and missing interpretation branches survive all five rule changes', () => {
  for (const n of [19, 40, 41, 44, 52]) {
    const rule = ruleNumber(n), entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.ok(rule.unresolved.length); assert.ok(rule.review.supportingSources.includes(reference.sourceURL));
  }
  for (const [n, prefix] of [[40, 'tianshang'], [41, 'tianshi']]) {
    const query = ruleNumber(n).queries[0];
    assert.equal(query.factType, 'quanshu_shangshi_limits');
    assert.equal(query.where.profile, quanshuShangShiLimitPolicy.profile);
    for (const suffix of ['ReliefCandidate', 'CrossGroupReliefCandidate', 'AdverseCandidate', 'AnnualFirePairCandidate']) {
      assert.ok(query.anyOf.some(branch => branch[prefix + suffix] === true));
    }
    assert.ok(query.anyOf.some(branch => branch[prefix + 'JielanFireCandidate'] === true
      && branch.jielanFireBellProfile === quanshuShangShiLimitPolicy.fireComparison));
  }
  for (const n of [19, 44, 52]) {
    assert.equal(ruleNumber(n).queries[0].factType, encounterType);
    assert.equal(ruleNumber(n).queries[0].where.profile, quanshuYearEncountersPolicy.profile);
  }
  assert.ok(!JSON.stringify(ruleNumber(52).queries).includes('yearlySuiqianStar'));
});

test('p040 and p041 confirm three complete named Ming relief groups only at their actual shared limits', () => {
  const cases = [
    [40, 'tianshang', { dateStr: '1970-01-05', timeIndex: 9, gender: '女' }, 2028, '申',
      ['紫微天府', '左辅右弼', '魁钺无序组'], '守临二限遇太岁，不问得地，只要众星吉方可获善'],
    [41, 'tianshi', { dateStr: '1954-11-05', timeIndex: 1, gender: '女' }, 2013, '巳',
      ['紫微天府', '文昌文曲', '左辅右弼'], '若二限太岁俱临，有吉星众者祸轻'],
  ];
  for (const [n, anchor, birth, year, branch, groups, excerpt] of cases) {
    const archive = astro.withOptions({ ...birth, fixLeap: true, config }), natal = archive.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const bound = bindSourceRun(natal, params, Date.UTC(year, 5, 1));
    validateFortuneFacts(bound);
    const fact = shangShiFact(bound, year);
    const run = { ...bound, facts: [fact] }, data = fact.normalizedPayload[anchor];
    const flag = anchor + 'MingNamedReliefCandidate';
    assert.equal(fact.normalizedPayload[flag], true);
    assert.deepEqual([data.branch, data.annualRelation, data.decadalRelation, data.minorRelation], [branch, '守', '守', '守']);
    assert.deepEqual(data.relief.filter(row => row.present === true).map(row => row.name), groups);
    assert.ok(data.relief[0].stars.some(row => row.star === '紫微' && row.relation === '守'));
    const hit = match(run, n);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, excerpt);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-shangshi-relief'));
    assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId).originalText, excerpt);
    assert.doesNotMatch(formatFortunePrompt(input), /mingNamedReliefCandidate|太岁、大限和小限同守天使宫|本命天伤在申宫/u);

    const frameFor = lunarYear => {
      const h = archive.horoscope(`${lunarYear}-06-01`, 6);
      return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    };
    const frame = frameFor(year), calculate = (chart, frame) => quanshuShangShiLimits(quanshuLimitBranches(chart, frame));
    const other = anchor === 'tianshang' ? '天使' : '天伤';
    const missingOther = structuredClone(natal);
    const otherPalace = missingOther.palaces.find(row => row.adjectiveStars.some(star => star.name === other));
    otherPalace.adjectiveStars = otherPalace.adjectiveStars.filter(star => star.name !== other);
    const retained = calculate(missingOther, frame);
    assert.equal(retained[anchor].branch, branch);
    assert.equal(retained[anchor === 'tianshang' ? 'tianshi' : 'tianshang'].branch, undefined);
    assert.equal(retained[flag], true);
    assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: retained }] }, n).status, 'matched');
    const wrongAnchor = calculate(misplacedNatalStar(natal, anchor === 'tianshang' ? '天伤' : '天使', 'adjectiveStars'), frame);
    assert.equal(wrongAnchor[anchor].branch, undefined);
    assert.equal(wrongAnchor[flag], undefined);
    assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongAnchor }] }, n).status, 'unknown');
    const mislayered = n === 40 ? natal.palaces.find(row => row.earthlyBranch === '申').minorStars
      .find(row => ['天魁', '天钺'].includes(row.name)).name : '文曲';
    const wrongStar = calculate(misplacedNatalStar(natal, mislayered, 'minorStars'), frame);
    assert.equal(wrongStar[flag], undefined);
    assert.equal(wrongStar[anchor].reliefCandidate, true);
    assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongStar }] }, n).status, 'partial');
    assert.equal(calculate(shiftDecadalRange(natal, frame), frame)[flag], undefined);
    assert.equal(calculate(natal, frameFor(year + 1))[flag], false);
  }
});

test('both named source passages reach SQLite with actual annual contacts and independently verified supporting and adverse branches', () => {
  const samples = [
    [40, { dateStr: '1970-01-05', timeIndex: 1, year: 2024 }, ['辰', '守', '守', '三合'], false, '该宫核到正曜或本命禄存，为武曲'],
    [40, { dateStr: '1970-01-05', timeIndex: 1, year: 1996 }, ['辰', '三合', '其他', '守'], false, '本命天伤在辰宫，太岁为三合'],
    [40, { dateStr: '1975-08-16', timeIndex: 5, year: 1980 }, ['申', '守', '其他', '守'], true, '归档火星在寅宫'],
    [41, { dateStr: '1970-01-05', timeIndex: 11, year: 2040 }, ['申', '守', '守', '守'], false, '太岁、大限和小限同守天使宫'],
    [41, envoyTogether, ['申', '守', '守', '守'], true, '已核十八正曜和本命禄存，该宫均未见'],
  ];
  for (const [n, sample, relations, adverse, phrase] of samples) {
    const run = real(sample); validateFortuneFacts(run);
    const fact = shangShiFact(run, sample.year), payload = fact.normalizedPayload;
    const row = n === 40 ? payload.tianshang : payload.tianshi;
    assert.deepEqual([row.branch, row.annualRelation, row.decadalRelation, row.minorRelation], relations);
    assert.equal(row.arrival, true);
    assert.equal(row.reliefCandidate, true);
    assert.equal(row.adverseCandidate, adverse);
    if (adverse) {
      assert.equal(row.noLocalPrincipals, true);
      assert.ok(row.adverse.every(star => ['守', '冲', '三合'].includes(star.relation)));
      assert.deepEqual(row.adverse.map(star => star.star), ['擎羊', '归档火星', '巨门', '天机']);
    }
    const candidate = match(run, n);
    assert.equal(candidate.status, 'partial');
    assert.ok(candidate.sourceFactIds.includes(fact.factId) && fact.sourceFactIds.length >= 2);
    assert.ok(candidate.windows.some(window => window.start <= fact.activeFrom && window.endExclusive >= fact.activeTo));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shangshi-limit-prompt'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    assert.doesNotMatch(prompt, /quanshu-shangshi-limit-branches|tianshiAdverseCandidate|tianshangReliefCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId === candidate.knowledgeId));
  }
});

test('injury without annual contact and envoy with no named group are not promoted by palace occupancy', () => {
  const cases = [
    [40, { dateStr: '1970-01-05', timeIndex: 0, year: 2027 }, 'tianshang', row => {
      assert.equal(row.decadalRelation, '守');
      assert.equal(row.annualRelation, '其他');
      assert.equal(row.arrival, false);
    }],
    [41, { dateStr: '1947-02-05', timeIndex: 3, year: 2026 }, 'tianshi', row => {
      assert.equal(row.arrival, true);
      assert.ok(row.localPrincipals.includes('七杀'));
      assert.ok(row.relief.every(group => group.present === false));
    }],
  ];
  for (const [n, sample, key, verify] of cases) {
    const run = real(sample), fact = shangShiFact(run, sample.year);
    verify(fact.normalizedPayload[key]);
    const facts = run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId);
    assert.equal(match({ ...run, facts }, n).status, 'not_matched');
  }
});

test('p040 and p041 support a guarded helper with an actual aspect from a different group', () => {
  const samples = [
    [40, { dateStr: '1993-02-15', timeIndex: 2, gender: '男', year: 2067 }, 'tianshang',
      ['魁钺组', '巳', '守', '魁钺无序组'], ['天府', '酉', '三合', '紫微天府']],
    [41, { dateStr: '1959-04-05', timeIndex: 4, year: 2038 }, 'tianshi',
      ['文昌', '午', '守', '文昌文曲'], ['魁钺组', '子', '冲', '魁钺无序组']],
  ];
  for (const [n, sample, key, guard, aspect] of samples) {
    const run = real(sample), fact = shangShiFact(run, sample.year), row = fact.normalizedPayload[key];
    assert.equal(row.arrival, true);
    assert.ok(row.relief.every(group => group.present === false));
    assert.equal(row.adverseCandidate, false);
    assert.equal(row.annualFirePairCandidate, false);
    assert.equal(row.crossGroupReliefCandidate, true);
    const select = witness => [witness.star, witness.branch, witness.relation, witness.group];
    assert.deepEqual(row.crossGroupReliefWitnesses.map(pair => [select(pair.guard), select(pair.aspect)]), [[guard, aspect]]);
    const isolated = { ...run, facts: run.facts.filter(item => item.factType !== fact.factType || item.factId === fact.factId) };
    const matchResult = match(isolated, n);
    assert.equal(matchResult.status, 'partial');
    assert.deepEqual(matchResult.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'shangshi-mixed-relief'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('本宫实守' + guard[0] + '，另一组的' + aspect[0] + '在' + aspect[1] + '宫，与本宫为' + aspect[2]));
    assert.doesNotMatch(prompt, /crossGroupReliefWitnesses|tianshiCrossGroupReliefCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === matchResult.knowledgeId));
  }

  const near = real({ timeIndex: 7, year: 2049 });
  const fact = shangShiFact(near, 2049), row = fact.normalizedPayload.tianshi;
  assert.equal(row.arrival, true);
  assert.ok(row.relief.flatMap(group => group.stars).every(star => star.relation !== '守'));
  assert.equal(row.crossGroupReliefCandidate, false);
  assert.equal(match({ ...near, facts: near.facts.filter(item => item.factType !== fact.factType || item.factId === fact.factId) }, 41).status, 'not_matched');
});

test('p040 uses the physically shared annual Yang and archive Fire palace only after checking the source absence and both major contacts', () => {
  const sample = { dateStr: '1975-08-16', timeIndex: 4, year: 2033 }, run = real(sample);
  const fact = shangShiFact(run, sample.year), row = fact.normalizedPayload.tianshang;
  assert.deepEqual([row.branch, row.decadalRelation, row.annualRelation], ['酉', '守', '三合']);
  assert.equal(row.noLocalPrincipals, true);
  assert.equal(row.adverseCandidate, false);
  assert.equal(row.reliefCandidate, false);
  assert.equal(row.crossGroupReliefCandidate, false);
  assert.deepEqual(row.annualSheep, { branch: '丑', relation: '三合' });
  assert.deepEqual(row.adverse.slice(1).map(item => [item.star, item.branch, item.relation]),
    [['归档火星', '丑', '三合'], ['巨门', '丑', '三合'], ['天机', '巳', '三合']]);
  assert.equal(row.annualFirePairCandidate, true);
  const isolated = { ...run, facts: run.facts.filter(item => item.factType !== fact.factType || item.factId === fact.factId) };
  const matchResult = match(isolated, 40);
  assert.equal(matchResult.status, 'partial');
  assert.deepEqual(matchResult.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'shang-annual-fire'));
  assert.match(formatFortuneFactAudit(input), /流年擎羊与归档火星同在丑宫，与此宫为三合/u);

  const separated = real({ dateStr: '1989-02-15', timeIndex: 11, year: 2012 });
  const separatedRow = shangShiFact(separated, 2012).normalizedPayload.tianshang;
  assert.equal(separatedRow.noLocalPrincipals, true);
  assert.deepEqual([separatedRow.annualSheep.branch, separatedRow.adverse.find(item => item.star === '归档火星').branch], ['子', '寅']);
  assert.equal(separatedRow.annualFirePairCandidate, false);

  const archive = astro.withOptions({ ...sample, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON(), h = archive.horoscope('2033-06-01', 6);
  for (const palace of natal.palaces) palace.minorStars = palace.minorStars.filter(item => item.name !== '火星');
  const frame = { lunarYear: 2033, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const missing = quanshuShangShiLimits(quanshuLimitBranches(natal, frame));
  assert.equal(missing.tianshangAnnualFirePairCandidate, undefined);
});

test('p041 annual Yang and Fire reach server SQLite only with the exact same three active seats at the envoy palace', () => {
  const sample = { dateStr: '1998-02-15', timeIndex: 6, gender: '女', year: 2059 };
  const archive = astro.withOptions({ ...sample, fixLeap: true, config });
  const natal = archive.toJSON();
  const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2059-11-19T03:00:00Z'), reference = { snapshotId: 'envoy-annual-fire-chart', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'envoy-annual-fire-client', reference);
  const fact = shangShiFact(run, 2059), row = fact.normalizedPayload.tianshi;
  assert.deepEqual([row.branch, row.annualRelation, row.decadalRelation, row.minorRelation], ['卯', '守', '守', '守']);
  assert.equal(row.noLocalPrincipals, true);
  assert.equal(row.reliefCandidate, false);
  assert.equal(row.crossGroupReliefCandidate, false);
  assert.equal(row.adverseCandidate, false);
  assert.equal(row.annualFirePairCandidate, true);
  assert.deepEqual([row.annualSheep.branch, ...row.adverse.slice(1).map(item => item.branch)], ['未', '未', '酉', '酉']);
  const isolated = { ...run, facts: run.facts.filter(item => item.factType !== fact.factType || item.factId === fact.factId) };
  const matchResult = match(isolated, 41);
  assert.equal(matchResult.status, 'partial');
  assert.deepEqual(matchResult.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'envoy-annual-fire'));
  assert.match(formatFortuneFactAudit(input), /流年擎羊与归档火星同在未宫，与此宫为三合/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === matchResult.knowledgeId));

  const h = archive.horoscope('2059-06-01', 6), frame = { lunarYear: 2059, yearIndex: h.yearly.index, decadalIndex: h.decadal.index };
  const missing = quanshuShangShiLimits(quanshuLimitBranches(natal, frame));
  assert.equal(missing.tianshi.arrival, undefined);
  assert.equal(missing.tianshiAnnualFirePairCandidate, undefined);
});

test('p038 and p040 match only the verified Nanyangtang fire or bell branch on neighboring-year controls', () => {
  const fixedProfile = 'quanshu-nanyangtang-fixed-firebell-v1';
  const cases = [
    { n: 38, dateStr: '1980-04-15', timeIndex: 5, year: 2054, type: 'quanshu_kongjie_limits',
      field: 'robberyTaiSuiQuanshuFixedFireBellCandidate', phrase: '太岁戌宫实守铃星，与地劫实际守限为冲', check(row) {
        assert.deepEqual(row.robbery, { annual: '冲', decadal: '守', minor: '三合' });
        assert.equal(row.robberyBranch, '辰');
        assert.equal(row.annualBranch, '戌');
        assert.deepEqual(row.taiSuiQuanshuFixedFireBell, [{ star: '铃星', branch: '戌' }]);
        assert.deepEqual([row.robberyShaCandidate, row.robberyTaiSuiShaCandidate, row.robberyTaiSuiFireBellEnvoyCandidate,
          row.robberyAnnualOfficialCandidate, row.robberyBoshiOfficialCandidate], [false, false, false, false, false]);
      } },
    { n: 40, dateStr: '1990-02-15', timeIndex: 10, year: 1997, type: 'quanshu_shangshi_limits',
      field: 'tianshangQuanshuFixedFireCandidate', phrase: '按南阳堂明刊火星核天伤宫的生年擎羊、火星、巨门和天机', check(row) {
        const injury = row.tianshang;
        assert.deepEqual([injury.branch, injury.annualRelation, injury.decadalRelation, injury.minorRelation], ['酉', '三合', '其他', '守']);
        assert.equal(injury.noLocalPrincipals, true);
        assert.deepEqual(injury.nanyang, { fire: { star: '南阳堂明刊火星', branch: '丑', relation: '三合' },
          withNatalSheep: true, withAnnualSheep: false });
        assert.deepEqual(injury.adverse.map(star => [star.star, star.branch, star.relation]),
          [['擎羊', '酉', '守'], ['归档火星', '亥', '其他'], ['巨门', '丑', '三合'], ['天机', '巳', '三合']]);
        assert.deepEqual([injury.reliefCandidate, injury.crossGroupReliefCandidate, injury.adverseCandidate,
          injury.annualFirePairCandidate, injury.jielanFireCandidate], [false, false, false, false, false]);
        assert.deepEqual([row.tianshi.nanyang.withNatalSheep, row.tianshi.nanyang.withAnnualSheep], [false, false]);
      } },
  ];
  for (const { n, year, type, field, phrase, check, ...sample } of cases) {
    const natal = native(sample);
    const runForYear = year => bindSourceRun(natal,
      { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' }, Date.UTC(year, 5, 1));
    const factForYear = (run, year) => run.facts.find(fact => fact.factType === type && fact.normalizedPayload.lunarYear === year);
    const run = runForYear(year), fact = factForYear(run, year);
    validateFortuneFacts(run);
    assert.ok(fact, field);
    assert.equal(fact.normalizedPayload[field], true);
    assert.equal(fact.normalizedPayload.quanshuFixedFireBellProfile, fixedProfile);
    check(fact.normalizedPayload);
    const result = match({ ...run, facts: [fact] }, n);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrongSource = { ...fact, normalizedPayload: { ...fact.normalizedPayload, quanshuFixedFireBellProfile: 'other-edition' } };
    assert.equal(match({ ...run, facts: [wrongSource] }, n).status, 'not_matched', field);
    const earlier = runForYear(year - 1), oldFact = factForYear(earlier, year - 1);
    assert.ok(oldFact, field);
    assert.equal(oldFact.normalizedPayload[field], false);
    assert.equal(match({ ...earlier, facts: [oldFact] }, n).status, 'not_matched', field);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fixed-fire-limit-' + n));
    assert.ok(!input.sections.some(section => section.findings.some(finding => finding.knowledgeId === result.knowledgeId)));
    const audit = formatFortuneFactAudit(input);
    const provider = formatFortunePrompt(input);
    assert.ok(audit.includes(phrase), phrase);
    assert.ok(!audit.includes(field), field);
    assert.ok(!provider.includes(phrase) && !provider.includes(field), field);
  }
});

test('p040 confirms the shared Ming Fire and annual Yang at the empty triple-guarded Tian Shang', () => {
  const cases = [
    { dateStr: '1982-02-25', timeIndex: 1, year: 2063, positions: ['未', '丑', '卯'], relation: '冲' },
    { dateStr: '1958-07-15', timeIndex: 10, year: 2033, positions: ['丑', '丑', '酉'], relation: '守' },
  ];
  const field = 'tianshangMingAnnualFireYangDoubleGuardCandidate';
  for (const { dateStr, timeIndex, year, positions, relation } of cases) {
    const birth = { dateStr, timeIndex, gender: '女' };
    const natal = native(birth);
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const bound = bindSourceRun(natal, params, Date.UTC(year, 5, 1));
    validateFortuneFacts(bound);
    const fact = shangShiFact(bound, year);
    assert.ok(fact);
    const data = fact.normalizedPayload, injury = data.tianshang, [branch, fireBranch, pairBranch] = positions;
    assert.deepEqual([injury.branch, injury.annualRelation, injury.decadalRelation, injury.minorRelation, injury.noLocalPrincipals],
      [branch, '守', '守', '守', true]);
    assert.deepEqual(injury.nanyang, { fire: { star: '南阳堂明刊火星', branch: fireBranch, relation },
      withNatalSheep: false, withAnnualSheep: true });
    assert.deepEqual(injury.annualSheep, { branch: fireBranch, relation });
    assert.deepEqual(injury.adverse.filter(row => ['巨门', '天机'].includes(row.star)).map(row => [row.branch, row.relation]),
      [[pairBranch, '三合'], [pairBranch, '三合']]);
    assert.equal(data[field], true);
    const isolated = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload }] });
    const run = isolated(data), hit = match(run, 40);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '若无正星又值羊火巨机');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-fire-yang-injury'));
    assert.match(formatFortunePrompt(input), /若无正星又值羊火巨机/u);
    assert.doesNotMatch(formatFortunePrompt(input), /未宫|丑宫|卯宫|酉宫|tianshangMingAnnualFireYang/u);

    const engine = astro.withOptions({ ...birth, fixLeap: true, config });
    const verify = (annual, source, alter = frame => frame) => {
      const h = engine.horoscope(annual + '-06-15', 6);
      const frame = alter({ lunarYear: annual, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
        minorIndex: h.age.index, age: h.age.nominalAge });
      return quanshuShangShiLimits(quanshuLimitBranches(source, frame));
    };
    const mislayered = verify(year, misplacedNatalStar(natal, '巨门', 'majorStars'));
    assert.equal(mislayered[field], undefined);
    assert.notEqual(match(isolated(mislayered), 40).status, 'matched');
    const wrongMinor = verify(year, natal, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
    assert.equal(wrongMinor[field], undefined);
    assert.notEqual(match(isolated(wrongMinor), 40).status, 'matched');
    assert.equal(verify(year + 1, natal)[field], false);
    assert.notEqual(match(isolated({ ...data, quanshuFixedFireBellProfile: 'archive-position' }), 40).status, 'matched');
  }
});

test('p040 confirms separate natal Yang and Ming Fire at the empty triple-guarded Tian Shang', () => {
  for (let i = 0; i < 60; i += 1) {
    const fire = quanshuFireBellAnchors(branches[i % 12]).engineNamedAnchors[0].branch;
    const yang = quanshuLuYangTuo('甲乙丙丁戊己庚辛壬癸'[i % 10]).qingyangBranch;
    assert.notEqual(fire, yang);
  }
  const cases = [
    { dateStr: '1934-04-06', timeIndex: 1, year: 2015, start: '2015-02-18T16:00:00.000Z', branch: '未',
      yang: ['卯', '三合'], fire: ['丑', '冲'], jumen: ['卯', '三合'], tianji: ['卯', '三合'] },
    { dateStr: '1950-09-02', timeIndex: 4, year: 2029, start: '2029-02-12T16:00:00.000Z', branch: '酉',
      yang: ['酉', '守'], fire: ['丑', '三合'], jumen: ['丑', '三合'], tianji: ['巳', '三合'] },
  ];
  const field = 'tianshangMingNatalFireYangDoubleGuardCandidate';
  for (const { dateStr, timeIndex, year, start, branch, yang, fire, jumen, tianji } of cases) {
    const birth = { dateStr, timeIndex, gender: '女' };
    const engine = astro.withOptions({ ...birth, fixLeap: true, config }), natal = engine.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const bound = bindSourceRun(natal, params, Date.UTC(year, 5, 1));
    validateFortuneFacts(bound);
    const fact = shangShiFact(bound, year), data = fact.normalizedPayload, injury = data.tianshang;
    assert.deepEqual([injury.branch, injury.annualRelation, injury.decadalRelation, injury.minorRelation, injury.noLocalPrincipals],
      [branch, '守', '守', '守', true]);
    assert.equal(data.tianshangMingAnnualFireYangDoubleGuardCandidate, false);
    assert.equal(data[field], true);
    const position = (star, [branch, relation]) => ({ star, branch, relation });
    assert.deepEqual(data.tianshangMingNatalFireYangDoubleGuardWitness, {
      branch, yang: position('擎羊', yang), fire: position('南阳堂明刊火星', fire),
      jumen: position('巨门', jumen), tianji: position('天机', tianji),
    });
    const isolate = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload }] });
    const run = isolate(data), hit = match(run, 40);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '若無正星，又羊火、巨机');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-natal-yang-fire'));
    assert.match(formatFortuneFactAudit(input), /太岁、大限、小限实守同一天伤空宫/u);
    assert.match(formatFortunePrompt(input), /若無正星，又羊火、巨机/u);
    assert.doesNotMatch(formatFortunePrompt(input), /未宫|丑宫|卯宫|酉宫|巳宫|tianshangMingNatalFireYang/u);

    const verify = (lunarYear, archive, alter = frame => frame) => {
      const h = engine.horoscope(lunarYear + '-06-15', 6);
      const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
        minorIndex: h.age.index, age: h.age.nominalAge };
      return quanshuShangShiLimits(quanshuLimitBranches(archive, alter(frame)));
    };
    const wrongYang = verify(year, misplacedNatalStar(natal, '擎羊', 'minorStars'));
    const wrongMinor = verify(year, natal, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
    for (const wrong of [wrongYang, wrongMinor]) {
      assert.equal(wrong[field], undefined);
      assert.equal(wrong.tianshangMingNatalFireYangDoubleGuardWitness, undefined);
      assert.notEqual(match(isolate(wrong), 40).status, 'matched');
    }
    assert.equal(verify(year + 1, natal)[field], false);
    assert.notEqual(match(isolate({ ...data, quanshuFixedFireBellProfile: 'archive-position' }), 40).status, 'matched');
  }
});

test('p040 and p041 independently match the Jielan fire position with actual injury and envoy limit seats', () => {
  const examples = [
    { n: 40, dateStr: '1965-09-15', timeIndex: 6, year: 1976, key: 'tianshang', branch: '申',
      fire: '辰', archiveFire: '酉', limits: ['三合', '其他', '守'], jielanRoutes: [true, false],
      phrase: '以《捷览》火星核本命擎羊、火星、巨门和天机同段会宫' },
    { n: 41, dateStr: '1997-11-15', timeIndex: 8, year: 2078, key: 'tianshi', branch: '戌',
      fire: '午', archiveFire: '亥', limits: ['守', '守', '守'], jielanRoutes: [false, true],
      phrase: '流年擎羊与《捷览》所推火星同在午宫，与此宫为三合' },
  ];
  for (const { n, dateStr, timeIndex, year, key, branch, fire, archiveFire, limits, jielanRoutes, phrase } of examples) {
    const archive = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = archive.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.parse(`${year}-11-19T03:00:00Z`);
    const ref = { snapshotId: 'jielan-shangshi-' + n, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'jielan-shangshi-' + n, ref);
    const fact = shangShiFact(run, year);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    const palace = p[key];
    assert.equal(palace.branch, branch);
    assert.deepEqual([palace.annualRelation, palace.decadalRelation, palace.minorRelation], limits);
    assert.equal(palace.noLocalPrincipals, true);
    assert.equal(palace.adverse.find(row => row.star === '归档火星').branch, archiveFire);
    assert.deepEqual([palace.adverseCandidate, palace.annualFirePairCandidate], [false, false]);
    assert.equal(palace.jielan.fire.branch, fire);
    assert.deepEqual([palace.jielan.withNatalSheep, palace.jielan.withAnnualSheep], jielanRoutes);
    assert.ok(palace.adverse.filter(row => ['巨门', '天机'].includes(row.star)).every(row => ['冲', '三合'].includes(row.relation)));

    const geometryOnly = { ...fact, normalizedPayload: { ...p, [key + 'ReliefCandidate']: false, [key + 'CrossGroupReliefCandidate']: false } };
    const verdict = match({ ...run, facts: [geometryOnly] }, n);
    assert.equal(verdict.status, 'partial');
    assert.deepEqual(verdict.sourceFactIds, [fact.factId]);
    const wrongSource = { ...geometryOnly, normalizedPayload: { ...geometryOnly.normalizedPayload, jielanFireBellProfile: 'another-source' } };
    assert.equal(match({ ...run, facts: [wrongSource] }, n).status, 'not_matched');
    const currentYear = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const report = interpretFortune(currentYear, requestForFortuneRun(currentYear), 'jielan-shangshi-' + n);
    const { input } = buildFortuneModelContext(currentYear, report);
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    assert.doesNotMatch(prompt, /jielanFireCandidate|jielanFireBellProfile/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === verdict.knowledgeId));

    const h = archive.horoscope(`${year}-06-01`, 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    const withoutSmallLimit = quanshuShangShiLimits(quanshuLimitBranches(natal, { ...frame, minorIndex: undefined }));
    assert.equal(withoutSmallLimit[key].jielanFireCandidate, undefined);
  }
});

test('p041 verifies the Nanyangtang Fire at the exact three-layer envoy window', () => {
  const sample = { dateStr: '1974-04-23', timeIndex: 3, gender: '女', year: 2029 };
  const source = astro.withOptions({ ...sample, fixLeap: true, config });
  const natal = source.toJSON();
  const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(sample.year, 5, 1), reference = { snapshotId: 'nanyang-envoy', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const fact = shangShiFact(run, sample.year), p = fact.normalizedPayload, row = p.tianshi;
  assert.equal(p.tianshiMingAnnualJumenJiCandidate, false);
  assert.deepEqual([row.branch, row.annualRelation, row.decadalRelation, row.minorRelation], ['酉', '守', '守', '守']);
  assert.equal(row.noLocalPrincipals, true);
  assert.deepEqual(row.nanyang, { fire: { star: '南阳堂明刊火星', branch: '丑', relation: '三合' },
    withNatalSheep: true, withAnnualSheep: false });
  assert.deepEqual(row.adverse.map(item => [item.star, item.branch, item.relation]),
    [['擎羊', '卯', '冲'], ['归档火星', '辰', '其他'], ['巨门', '丑', '三合'], ['天机', '巳', '三合']]);
  assert.equal(p.tianshiQuanshuFixedFireCandidate, true);
  assert.ok([p.tianshiReliefCandidate, p.tianshiCrossGroupReliefCandidate, p.tianshiAdverseCandidate,
    p.tianshiAnnualFirePairCandidate, p.tianshiJielanFireCandidate, p.tianshiXuDiagramCandidate].every(state => state === false));
  const isolated = { ...run, facts: [fact] };
  const verdict = match(isolated, 41);
  assert.equal(verdict.status, 'partial');
  assert.deepEqual(verdict.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const wrong = { ...fact, normalizedPayload: { ...p, quanshuFixedFireBellProfile: 'other-edition' } };
  assert.equal(match({ ...isolated, facts: [wrong] }, 41).status, 'not_matched');
  for (const year of [2028, 2030]) {
    const adjacent = real({ ...sample, year }), adjacentFact = shangShiFact(adjacent, year);
    assert.equal(adjacentFact.normalizedPayload.tianshiQuanshuFixedFireCandidate, false);
    assert.equal(match({ ...adjacent, facts: [adjacentFact] }, 41).status, 'not_matched');
  }
  const h = source.horoscope('2029-06-01', 6);
  const unavailable = quanshuShangShiLimits(quanshuLimitBranches(natal, { lunarYear: 2029,
    yearIndex: h.yearly.index, decadalIndex: h.decadal.index }));
  assert.equal(unavailable.ready, true);
  assert.equal(unavailable.tianshiQuanshuFixedFireCandidate, undefined);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === verdict.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /按南阳堂明刊火星核天使宫的生年擎羊、火星、巨门和天机/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊火星核天使宫|tianshiQuanshuFixedFireCandidate/u);
});

test('p041 keeps the Ming Ding Jumen Ji and the earlier Jumen Tianji routes separate', () => {
  let annualMinorConjunctions = 0;
  for (let ding = 3; ding < 60; ding += 10) for (const gender of ['男', '女']) for (let age = 1; age <= 12; age += 1) {
    const birthBranch = branches[ding % 12], annual = branches[(ding + age - 1) % 12];
    if (quanshuMinorLimit(birthBranch, gender, age).branch !== annual) continue;
    annualMinorConjunctions += 1;
    const fire = quanshuFireBellAnchors(birthBranch).engineNamedAnchors[0].branch;
    assert.equal(quanshuPalaceRelation(annual, fire), '其他', birthBranch + gender + age);
  }
  assert.equal(annualMinorConjunctions, 12);

  const sample = { dateStr: '1970-02-28', timeIndex: 2, gender: '女', year: 2027 };
  const engine = astro.withOptions({ ...sample, fixLeap: true, config }), natal = engine.toJSON();
  const bound = bindSourceRun(natal, { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' },
    Date.UTC(sample.year, 5, 1));
  const fact = shangShiFact(bound, sample.year), data = fact.normalizedPayload;
  assert.equal(data.tianshiMingAnnualJumenJiCandidate, true);
  assert.equal(data.tianshiQuanshuFixedFireCandidate, false);
  assert.deepEqual([data.tianshi.annualRelation, data.tianshi.decadalRelation, data.tianshi.minorRelation,
    data.tianshi.noLocalPrincipals], ['守', '守', '守', true]);
  assert.deepEqual(data.tianshiMingAnnualJumenJiWitness, { branch: '未', annualStem: '丁',
    jumen: { star: '巨门', branch: '卯', relation: '三合' },
    fire: { star: '南阳堂明刊火星', branch: '丑', relation: '冲' },
    yang: { star: '流年擎羊', branch: '未', relation: '守' },
  });

  const excludeEarlierRoutes = payload => ({ ...payload, tianshiReliefCandidate: false, tianshiCrossGroupReliefCandidate: false,
    tianshiAdverseCandidate: false, tianshiAnnualFirePairCandidate: false, tianshiJielanFireCandidate: false,
    tianshiXuDiagramCandidate: false, tianshiQuanshuFixedFireCandidate: false });
  const isolate = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload: excludeEarlierRoutes(normalizedPayload) }] });
  const run = isolate(data), hit = match(run, 41);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '若無正星，又值巨忌、羊火');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'envoy-ming-jumen-ji'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /若無正星，又值巨忌、羊火/u);
  assert.doesNotMatch(provider, /tianshiMingAnnualJumenJi|未宫|卯宫|丑宫/u);

  const frame = lunarYear => {
    const h = engine.horoscope(`${lunarYear}-06-01`, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const current = frame(2027), next = frame(2028);
  const produce = (archive, yearFrame) => quanshuShangShiLimits(quanshuLimitBranches(archive, yearFrame));
  const adjacent = produce(natal, next);
  assert.equal(adjacent.tianshiMingAnnualJumenJiCandidate, false);
  assert.equal(match(isolate(adjacent), 41).status, 'not_matched');
  for (const archive of [shiftDecadalRange(natal, current), misplacedNatalStar(natal, '天使', 'adjectiveStars'),
    misplacedNatalStar(natal, '巨门', 'majorStars'), misplacedNatalStar(natal, '禄存', 'minorStars')]) {
    const wrong = produce(archive, current);
    assert.equal(wrong.tianshiMingAnnualJumenJiCandidate, undefined);
    assert.equal(wrong.tianshiMingAnnualJumenJiWitness, undefined);
    assert.equal(match(isolate(wrong), 41).status, 'unknown');
  }
});

test('p040 excludes an archive minor seat at Tian Shang when it differs from the source calculation', () => {
  const source = astro.withOptions({ dateStr: '1965-09-15', timeIndex: 6, gender: '女', fixLeap: true, config });
  const natal = source.toJSON(), h = source.horoscope('1980-06-01', 6);
  const wrongMinor = natal.palaces.find(palace => palace.earthlyBranch === '申').index;
  const frame = { lunarYear: 1980, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: wrongMinor };
  const limits = quanshuLimitBranches(natal, frame);
  assert.equal(limits.ready, true);
  assert.equal(limits.sourceMinor.verified, false);
  const fact = quanshuShangShiLimits(limits);
  assert.equal(fact.tianshang.annualRelation, '守');
  assert.equal(fact.tianshang.minorRelation, undefined);
  assert.notEqual(fact.tianshang.decadalRelation, '守');
  assert.equal(fact.tianshang.arrival, undefined);
  assert.equal(fact.tianshangJielanFireCandidate, undefined);
});

test('p040 and p041 confirm the same natal star sequence before proving the injury and envoy palaces empty', () => {
  const examples = [
    ['1975-08-16', 4, 2033, 40, 'tianshang', 'tianshangAnnualFirePairCandidate', '巨门', '巳'],
    ['1974-04-23', 3, 2029, 41, 'tianshi', 'tianshiQuanshuFixedFireCandidate', '天机', '丑'],
  ];
  for (const [dateStr, timeIndex, year, rule, subject, field, star, misplacedBranch] of examples) {
    const natal = native({ dateStr, timeIndex });
    const runFor = (n, y) => bindSourceRun(n, { periodType: 'year', targetPeriod: { year: y }, displayTimezone: 'Asia/Shanghai' }, Date.UTC(y, 5, 1));
    const baseline = runFor(natal, year), fact = shangShiFact(baseline, year), p = fact.normalizedPayload;
    assert.equal(p.principalInventoryComplete, true);
    assert.deepEqual(p.unverifiedMajorStars, []);
    assert.equal(p[subject].noLocalPrincipals, true);
    assert.equal(p[field], true);
    assert.equal(match({ ...baseline, facts: [fact] }, rule).status, 'partial');

    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const h = engine.horoscope(`${year}-06-01`, 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    const wrongLayer = misplacedNatalStar(natal, star, 'majorStars');
    const layerCheck = quanshuShangShiLimits(quanshuLimitBranches(wrongLayer, frame));
    assert.ok(layerCheck.unverifiedMajorStars.includes(star));
    assert.equal(layerCheck[subject].noLocalPrincipals, undefined);
    assert.equal(layerCheck[field], undefined);

    const displaced = structuredClone(natal), host = displaced.palaces.find(palace => palace.majorStars.some(row => row.name === star));
    const wrongPalace = displaced.palaces.find(palace => palace.earthlyBranch === misplacedBranch);
    assert.notEqual(host.earthlyBranch, misplacedBranch);
    assert.equal(quanshuPalaceRelation(p[subject].branch, misplacedBranch), '三合');
    wrongPalace.majorStars.push(host.majorStars.find(row => row.name === star));
    host.majorStars = host.majorStars.filter(row => row.name !== star);
    const invalid = runFor(displaced, year), invalidFact = shangShiFact(invalid, year), q = invalidFact.normalizedPayload;
    assert.equal(q[subject].arrival, true);
    assert.deepEqual(q.unverifiedMajorStars, [star]);
    assert.equal(q.principalInventoryComplete, false);
    assert.equal(q[subject].noLocalPrincipals, undefined);
    assert.equal(q[subject].adverse.find(row => row.star === star).branch, undefined);
    assert.equal(q[field], undefined);
    assert.equal(match({ ...invalid, facts: [invalidFact] }, rule).status, 'unknown');
    assert.equal(q[subject].reliefCandidate, p[subject].reliefCandidate);
  }
});

test('a verified assistant in the injury palace blocks the absence branch even though all four adverse stars reach it', () => {
  const run = real({ dateStr: '1975-02-16', timeIndex: 9, year: 1990 });
  const { tianshang, principalInventoryComplete } = shangShiFact(run, 1990).normalizedPayload;
  assert.equal(principalInventoryComplete, true);
  assert.deepEqual(tianshang.localPrincipals, ['右弼']);
  assert.equal(tianshang.noLocalPrincipals, false);
  assert.ok(tianshang.adverse.every(row => ['守', '冲', '三合'].includes(row.relation)));
  assert.equal(tianshang.adverseCandidate, false);
  assert.equal(tianshang.reliefCandidate, true);
});

test('missing majors and limits preserve unknown while an independent named support pair remains verifiable', () => {
  const natal = native(envoyTogether), frame = { lunarYear: 2052, yearIndex: 6, decadalIndex: 6, minorIndex: 6 };
  const calculateBranches = (chart, query) => quanshuShangShiLimits(quanshuLimitBranches(chart, query));
  const absentLimit = calculateBranches(natal, { ...frame, minorIndex: undefined });
  assert.equal(absentLimit.tianshi.arrival, undefined);
  assert.equal(absentLimit.tianshiAdverseCandidate, undefined);
  const missing = structuredClone(natal);
  for (const palace of missing.palaces) for (const field of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[field] = palace[field].filter(row => row.name !== '武曲');
  }
  const result = calculateBranches(missing, frame);
  assert.equal(result.principalInventoryComplete, false);
  assert.equal(result.tianshi.noLocalPrincipals, undefined);
  assert.equal(result.tianshiAdverseCandidate, undefined);
  assert.equal(result.tianshiReliefCandidate, true);
  assert.equal(calculateBranches(natal, { ...frame, yearIndex: 7 }).ready, false);
});

test('regular lunar months advance from the source first-month seat without replacing the civil display window', () => {
  const start = Date.parse('2026-02-16T16:00:00Z'), end = Date.parse('2027-02-05T16:00:00Z');
  const rows = buildQuanshuDoujunMonths({ start, end }, native());
  assert.equal(rows.length, 12);
  assert.ok(rows.every(row => row.data.ready && row.data.doujunBranch === '巳' && row.data.annualBranch === '午'));
  assert.deepEqual(rows.map(row => row.data.branch), [...'巳午未申酉戌亥子丑寅卯辰']);
  assert.equal(rows[2].data.natalName, '官禄');
  assert.equal(rows[6].data.natalName, '财帛');
  assert.equal(rows[0].start, start);
  assert.equal(rows.at(-1).end, end);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.start, index ? rows[index - 1].end : start);
    assert.equal(row.data.lunarMonth, index + 1);
  }
  assert.deepEqual(rows[6].data.boshiHaoContacts, [{ star: '大耗', branch: '亥', relation: '守' }]);
  assert.deepEqual(rows[6].data.suiqianHaoContacts, []);
  assert.deepEqual(rows[7].data.suiqianHaoContacts, [{ star: '大耗', branch: '子', relation: '守' }]);
  assert.deepEqual(rows[7].data.boshiHaoContacts, []);
  assert.ok(rows.flatMap(row => row.data.voidContacts).some(row => row.star === '天空'));
  assert.ok(rows.flatMap(row => row.data.natalJiContacts).every(row => row.star === '天同'));
  assert.ok(rows.flatMap(row => row.data.annualJiContacts).every(row => row.star === '廉贞'));
});

test('leap months, post-leap months and unverified natal coordinates do not get an invented source palace', () => {
  const start = Date.parse('2025-06-30T16:00:00Z'), end = Date.parse('2025-08-31T16:00:00Z');
  const rows = buildQuanshuDoujunMonths({ start, end }, native());
  assert.deepEqual(rows.map(r => [r.data.lunarMonth, r.data.leap, r.data.ready]), [[6, false, true], [6, true, false], [7, false, false]]);
  assert.equal(rows[1].start, Date.parse('2025-07-24T16:00:00Z'));
  assert.equal(rows[1].end, Date.parse('2025-08-22T16:00:00Z'));
  assert.ok(rows.slice(1).every(r => r.data.reason === 'flow_leap' && r.data.branch === undefined));
  const swapped = native();
  swapped.palaces.find(p => p.name === '财帛').name = '官禄';
  assert.ok(buildQuanshuDoujunMonths({ start, end }, swapped).every(r => r.data.reason === 'natal_basis'));
  const leapBirth = native();
  leapBirth.rawDates.lunarDate.isLeap = true;
  assert.ok(buildQuanshuDoujunMonths({ start, end }, leapBirth).every(r => r.data.reason === 'birth_leap'));
  const missingVoid = native();
  missingVoid.palaces.forEach(p => { p.minorStars = p.minorStars.filter(s => s.name !== '地空'); });
  const partial = buildQuanshuDoujunMonths({ start, end }, missingVoid)[0].data;
  assert.equal(partial.ready, true);
  assert.equal(partial.voidContactsComplete, false);
  assert.deepEqual(partial.voidContacts, [{ star: '地劫', branch: '丑', relation: '三合' }]);
});

test('volume two uses the next birth month only when the real leap date and archived Life and Body agree', () => {
  const aligned = leapNative(16), earlier = leapNative(15);
  const before = structuredClone(aligned);
  assert.equal(earlier.earthlyBranchOfSoulPalace, '辰');
  assert.equal(readQuanshuNatal(earlier).status, 'unsupported_leap');
  const basis = readQuanshuNatal(aligned);
  assert.equal(basis.status, 'ready');
  assert.deepEqual([basis.birthMonth, basis.birthLeapMonth, basis.birthMonthBasis, basis.lifeBranch, basis.migrationBranch],
    [6, 5, 'quanshu-leap-next-month', '巳', '亥']);
  assert.equal(readQuanshuBodyNatal(aligned).bodyBranch, '酉');
  const support = readQuanshuSupportNatal(aligned);
  assert.equal(support.ready, true);
  assert.deepEqual(support.sourcePositions.filter(row => ['左辅', '右弼'].includes(row.star)),
    [{ star: '左辅', branch: '酉' }, { star: '右弼', branch: '巳' }]);
  assert.equal(quanshuTianxingCondition(aligned, basis.lifeIndex).tianxingBranch, '寅');
  assert.deepEqual(aligned, before);
  for (const alter of [
    natal => { natal.solarDate = '1990-7-9'; },
    natal => { natal.rawDates.lunarDate.lunarDay = 31; },
    natal => { natal.earthlyBranchOfBodyPalace = '申'; },
    natal => { natal.rawDates.chineseDate.yearly[1] = '巳'; },
  ]) {
    const wrong = structuredClone(aligned);
    alter(wrong);
    assert.equal(readQuanshuNatal(wrong).status, 'unsupported_leap');
  }
});

test('an aligned leap birth supplies the adjusted monthly career and wealth positions to server SQLite and Chinese input', () => {
  for (const [passage, month, monthName, branch, start, end] of [
    ['p067', 8, '官禄', '酉', '2026-08-12T16:00:00.000Z', '2026-08-31T16:00:00.000Z'],
    ['p063', 12, '财帛', '丑', '2026-12-08T16:00:00.000Z', '2026-12-31T16:00:00.000Z'],
  ]) {
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month } };
    const asOf = Date.UTC(2026, month - 1, 19, 3);
    const run = bindSourceRun(leapNative(16), input, asOf);
    const byRule = value => matchFortuneKnowledge(value).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    const result = byRule(run);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.windows, [{ start, endExclusive: end }]);
    const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId));
    const p = fact.normalizedPayload;
    assert.deepEqual([p.birthMonth, p.birthLeapMonth, p.birthMonthBasis, p.doujunBranch, p.natalName, p.branch],
      [6, 5, 'quanshu-leap-next-month', '卯', monthName, branch]);
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-leap-report'));
    const prompt = formatFortuneFactAudit(model.input);
    assert.match(prompt, /原生月为闰5月，归档身命与卷二按后一月安身命相合，斗君暂用6月作生月候选/u);
    assert.doesNotMatch(prompt, /birthMonthBasis|quanshu-leap-next-month|1990-07-08/u);
    assert.equal(byRule(bindSourceRun(leapNative(15), input, asOf)).status, 'unknown');
  }
});

test('the annual Doujun keeps its verified leap birth basis in both accepted and rejected Ming openings', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2028 } };
  const run = bindSourceRun(leapNative(16, { gender: '男' }), input, Date.UTC(2028, 5, 1));
  const fact = encounterFact(run, 2028);
  const p = fact.normalizedPayload;
  assert.deepEqual([p.birthMonthBasis, p.birthLeapMonth, p.birthMonth, p.includesFirstInstant, p.doujunBranch],
    ['quanshu-leap-next-month', 5, 6, true, '巳']);
  assert.equal(p.openingSeatsMatch, true);
  assert.equal(p.doujunYearContrastCandidate, true);
  assert.equal(p.doujunMingYearContrastCandidate, false);
  const found = match(run, 44);
  assert.equal(found.status, 'not_matched');
  assert.equal(p.firstMonth.start, '2028-01-25T16:00:00.000Z');
  assert.equal(p.firstMonth.end, '2028-02-24T16:00:00.000Z');
  const monthly = run.facts.filter(row => row.factType === doujunReviewType && row.normalizedPayload.lunarYear === 2028);
  assert.ok(monthly.length > 0);
  assert.ok(monthly.every(row => row.normalizedPayload.birthMonthBasis === p.birthMonthBasis && row.normalizedPayload.birthMonth === p.birthMonth));
  assert.ok(monthly.every(row => row.normalizedPayload.mingNatalShaReviewCandidate === false));

  const verifiedYear = 2013;
  const accepted = bindSourceRun(leapNative(16, { gender: '女', timeIndex: 0 }),
    { ...input, targetPeriod: { year: verifiedYear } }, Date.UTC(verifiedYear, 5, 1));
  const opening = encounterFact(accepted, verifiedYear), q = opening.normalizedPayload;
  assert.equal(q.birthMonthBasis, 'quanshu-leap-next-month');
  assert.equal(q.doujunMingYearContrastCandidate, true);
  const matched = match(onlyEncounter(accepted, opening), 44);
  assert.equal(matched.status, 'partial');
  assert.ok(matched.sourceFactIds.includes(opening.factId));
  const acceptedMonths = accepted.facts.filter(row => row.factType === doujunReviewType && matched.sourceFactIds.includes(row.factId));
  assert.deepEqual(acceptedMonths.map(row => row.normalizedPayload.lunarMonth), [1, 2, 3, 4, 8, 10]);
  assert.ok(acceptedMonths.every(row => row.normalizedPayload.birthMonthBasis === q.birthMonthBasis));
});

test('both monthly source rules require the same ready Doujun fact in SQLite and emit Chinese geometry for the clipped segment', () => {
  for (const [passage, month, palace, from, to] of [
    ['p063', 8, '财帛', '2026-08-12T16:00:00.000Z', '2026-08-31T16:00:00.000Z'],
    ['p067', 4, '官禄', '2026-04-16T16:00:00.000Z', '2026-04-30T16:00:00.000Z'],
  ]) {
    const run = calculate(chart(native()), 'month', 2026, month);
    const rule = fortuneKnowledge.ziwei.rules.find(r => r.knowledgeId.endsWith(`-${passage}-001`));
    const entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    const byRule = sample => matchFortuneKnowledge(sample).byMethod.ziwei.find(r => r.knowledgeId === rule.knowledgeId);
    const result = byRule(run);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.windows, [{ start: from, endExclusive: to }]);
    const fact = run.facts.find(f => f.factId === result.sourceFactIds[0]);
    assert.equal(fact.factType, 'quanshu_doujun_month');
    assert.equal(fact.normalizedPayload.natalName, palace);
    assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(row => row.rawFactId === id)));

    const generic = { ...run, facts: run.facts.filter(f => f.factType !== fact.factType) };
    assert.equal(byRule(generic).status, 'unknown');
    const noMatch = calculate(chart(native()), 'month', 2026, 6);
    assert.equal(byRule(noMatch).status, 'not_matched');
    const unknown = calculate({ ...chart(native()), timeKnown: false }, 'month', 2026, month);
    assert.equal(byRule(unknown).status, 'unknown');

    const report = interpretFortune(run, requestForFortuneRun(run), 'quanshu-month-report');
    const { input } = buildFortuneModelContext(run, report);
    const message = formatFortuneFactAudit(input);
    assert.match(message, new RegExp('顺推至本月.+对应本命' + palace + '宫', 'u'));
    assert.match(message, /博士十二神大耗.+岁前大耗.+生年干化忌.+流年干化忌/u);
    assert.ok(input.sections.flatMap(s => s.findings).every(f => f.knowledgeId !== rule.knowledgeId));
    assert.ok(!message.includes('boshiHaoContacts') && !message.includes('quanshu-doujun-month-from-first-month-v1'));
  }
});

test('monthly palace arrival alone is insufficient, and Hao is a separate branch only for wealth', () => {
  for (const [passage, month, haoStatus] of [['p063', 8, 'partial'], ['p067', 4, 'not_matched']]) {
    const run = calculate(chart(native()), 'month', 2026, month);
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(`-${passage}-001`));
    const byRule = sample => matchFortuneKnowledge(sample).byMethod.ziwei.find(row => row.knowledgeId === rule.knowledgeId);
    const id = byRule(run).sourceFactIds[0], fact = run.facts.find(row => row.factId === id);
    assert.ok(fact);
    // Isolate the persisted predicate from the combination of stars that usually accompanies this palace.
    for (const [flags, expected] of [
      [{}, 'not_matched'],
      [{ supportCandidate: undefined }, 'unknown'],
      [{ templeSupportCandidate: true }, 'partial'],
      [{ annualLucunCandidate: true }, 'partial'],
      [{ namedPairGuardCandidate: true }, 'partial'],
      [{ wealthNamedGuardCandidate: true }, passage === 'p063' ? 'partial' : 'not_matched'],
      [{ wealthWuquFavorableCandidate: true }, passage === 'p063' ? 'partial' : 'not_matched'],
      [{ careerTianjiWenquCandidate: true }, 'not_matched'],
      [{ careerTianjiMingClearCandidate: true }, passage === 'p067' ? 'partial' : 'not_matched'],
      [{ careerWuquLuQuanKeCandidate: true }, passage === 'p067' ? 'partial' : 'not_matched'],
      [{ jiCandidate: true }, 'partial'],
      [{ haoCandidate: true }, haoStatus],
    ]) {
      const fixture = { ...fact, normalizedPayload: { ...fact.normalizedPayload, supportCandidate: false,
        templeSupportCandidate: false, annualLucunCandidate: false, wealthNamedGuardCandidate: false,
        wealthWuquFavorableCandidate: false, careerTianjiWenquCandidate: false, careerTianjiMingClearCandidate: false, careerWuquLuQuanKeCandidate: false,
        jumenTianjiSameSeatCandidate: false, namedPairGuardCandidate: false, shaCandidate: false, haoCandidate: false, jiCandidate: false, ...flags } };
      const scoped = { ...run, facts: run.facts.flatMap(row => row.factId === id ? [fixture]
        : row.factType === fact.factType ? [] : [row]) };
      assert.equal(byRule(scoped).status, expected);
    }
  }
});

test('paired Jumen and Tianji guard the actual wealth or Mao career Doujun month', () => {
  const priorBranches = ['寅', '申'], followingBranches = ['辰', '戌'];
  const cases = [
    ['1990-05-05', 10, 4, 3, '财帛', '卯', '子', '辰', 'partial'],
    ['1991-05-05', 3, 4, 3, '财帛', '酉', '午', '戌', 'partial'],
    ['1947-02-05', 3, 8, 7, '官禄', '卯', '子', '辰', 'partial'],
    ['1983-11-25', 6, 8, 7, '官禄', '酉', '午', '戌', 'not_matched'],
  ];
  for (const [dateStr, timeIndex, month, lunarMonth, theme, branch, tianfu, ziwei, expected] of cases) {
    const natal = native({ dateStr, timeIndex });
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month } };
    const run = bindSourceRun(natal, input, Date.UTC(2026, month - 1, 20));
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === theme);
    assert.ok(fact, dateStr);
    const data = fact.normalizedPayload;
    const [nativeStart, nativeEnd] = lunarMonth === 3 ? ['2026-04-16T16:00:00.000Z', '2026-05-16T16:00:00.000Z']
      : ['2026-08-12T16:00:00.000Z', '2026-09-10T16:00:00.000Z'];
    assert.deepEqual([data.branch, data.lunarMonth, data.nativeStart, data.nativeEnd], [branch, lunarMonth, nativeStart, nativeEnd]);
    assert.equal(data.jumenTianjiSameSeatCandidate, true);
    assert.deepEqual(data.jumenTianjiSameSeatWitness, { branch, stars: [
      { star: '巨门', branch, anchor: '天府', anchorBranch: tianfu }, { star: '天机', branch, anchor: '紫微', anchorBranch: ziwei },
    ] });
    const bound = Date.parse(nativeStart), end = Date.parse(nativeEnd), side = branch === '卯' ? 0 : 1;
    const segments = buildQuanshuDoujunMonths({ start: bound - 1, end: end + 1 }, natal);
    assert.deepEqual(segments.map(row => [row.start, row.end, row.data.branch, row.data.jumenTianjiSameSeatCandidate]), [
      [bound - 1, bound, priorBranches[side], false], [bound, end, branch, true], [end, end + 1, followingBranches[side], false],
    ]);

    const onlyThisBranch = { ...fact, normalizedPayload: { ...data, supportCandidate: false,
      templeSupportCandidate: false, annualLucunCandidate: false, wealthNamedGuardCandidate: false, wealthWuquFavorableCandidate: false,
      careerTianjiMingClearCandidate: false, careerWuquLuQuanKeCandidate: false, shaCandidate: false, haoCandidate: false, jiCandidate: false } };
    const scoped = { ...run, facts: [onlyThisBranch] };
    const result = (input, passage) => matchFortuneKnowledge(input).byMethod.ziwei.find(row => row.knowledgeId.endsWith(`-${passage}-001`));
    const passage = theme === '财帛' ? 'p063' : 'p067';
    const hit = result(scoped, passage);
    assert.equal(hit.status, expected, dateStr);
    assert.deepEqual(hit.sourceFactIds, expected === 'partial' ? [fact.factId] : []);
    const displayEnd = month === 4 ? '2026-04-30T16:00:00.000Z' : '2026-08-31T16:00:00.000Z';
    assert.deepEqual(hit.windows, expected === 'partial' ? [{ start: nativeStart, endExclusive: displayEnd }] : []);
    assert.equal(result(scoped, passage === 'p063' ? 'p067' : 'p063').status, 'not_matched');
    const { input: modelInput } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'jumen-tianji-doujun'));
    const audited = formatFortuneFactAudit(modelInput);
    assert.ok(audited.includes('复核星序后，巨门与天机实守斗君所到的' + theme + branch + '宫'));
    assert.equal(audited.includes('明刊官禄酉宫另论'), expected === 'not_matched');
    assert.doesNotMatch(formatFortunePrompt(modelInput), /复核星序后，巨门与天机|明刊官禄酉宫另论|jumenTianjiSameSeat/u);
    assert.ok(modelInput.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

    const displaced = structuredClone(natal);
    const current = displaced.palaces.find(row => row.earthlyBranch === branch);
    const other = displaced.palaces.find(row => row.earthlyBranch === followingBranches[side]);
    other.majorStars.push(current.majorStars.find(row => row.name === '天机'));
    current.majorStars = current.majorStars.filter(row => row.name !== '天机');
    const invalid = buildQuanshuDoujunMonths({ start: bound, end }, displaced)[0].data;
    assert.equal(invalid.ready, true);
    assert.equal(invalid.jumenTianjiSameSeatCandidate, undefined);
    assert.equal(invalid.jumenTianjiSameSeatWitness, undefined);
    if (expected === 'partial') {
      const unknown = { ...onlyThisBranch, normalizedPayload: { ...onlyThisBranch.normalizedPayload, jumenTianjiSameSeatCandidate: undefined } };
      assert.equal(result({ ...scoped, facts: [unknown] }, passage).status, 'unknown');
    }
  }
});

test('source-named Liānzhēn and Pòjūn must actually guard their specified wealth Doujun seats', () => {
  const cases = [
    { dateStr: '1975-07-12', timeIndex: 7, month: 6, star: '廉贞', branch: '申', chapterSeats: '寅申' },
    { dateStr: '1998-02-15', timeIndex: 6, month: 9, star: '破军', branch: '辰', chapterSeats: '辰戌' },
  ];
  for (const { dateStr, timeIndex, month, star, branch, chapterSeats } of cases) {
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2022, month } };
    const run = bindSourceRun(native({ dateStr, timeIndex }), input, Date.UTC(2022, month - 1, 20));
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === '财帛');
    assert.deepEqual(fact.normalizedPayload.wealthNamedGuards, [{ star, branch, chapterSeats }]);
    assert.equal(fact.normalizedPayload.wealthNamedGuardCandidate, true);
    const result = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p063-001'));
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    const audit = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-wealth')).input);
    assert.ok(audit.includes('月财帛于' + branch + '宫，实守的' + star));
    assert.doesNotMatch(audit, /wealthNamedGuards|chapterSeats/u);
  }
});

test('temple Tianji at career distinguishes known Wenqu contacts, a non-contact, and an unverified position', () => {
  const window = { start: Date.parse('2026-02-19T00:00:00Z'), end: Date.parse('2026-02-20T00:00:00Z') };
  const cases = [
    ['1976-04-09', 2, '午', '守'], ['1976-08-05', 6, '戌', '三合'], ['1976-11-01', 8, '子', '冲'],
    ['1976-06-07', 4],
  ];
  for (const [dateStr, timeIndex, branch, relation] of cases) {
    const natal = native({ dateStr, timeIndex });
    const data = buildQuanshuDoujunMonths(window, natal)[0].data;
    assert.equal(data.natalName, '官禄');
    assert.ok(data.templeSupportContacts.some(row => row.star === '天机' && row.branch === '午'));
    assert.equal(data.careerTianjiWenquCandidate, Boolean(relation));
    assert.deepEqual(data.careerTianjiWenqu, relation ? { star: '文曲', branch, relation } : undefined);
  }
  const unknown = native({ dateStr: '1976-08-05', timeIndex: 6 });
  for (const palace of unknown.palaces) palace.minorStars = palace.minorStars.filter(star => star.name !== '文曲');
  assert.equal(buildQuanshuDoujunMonths(window, unknown)[0].data.careerTianjiWenquCandidate, undefined);

  const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month: 2 } };
  const run = bindSourceRun(native({ dateStr: '1976-08-05', timeIndex: 6 }), input, window.start);
  const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.careerTianjiWenquCandidate);
  const result = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
  assert.deepEqual(result.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-02-28T16:00:00.000Z' }]);
  const audit = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'career-tianji')).input);
  assert.match(audit, /官禄月宫天机实守且入庙，文曲在戌宫，与本宫为三合/u);
  assert.match(audit, /羊陀火铃.{0,28}异文/u);
  assert.doesNotMatch(audit, /careerTianjiWenqu|careerTianjiCounter/u);
});

test('career Doujun Tianji tests absence from the Ming coordinates separately from the archive', () => {
  const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month: 2 } };
  for (const [dateStr, timeIndex, branch, wenqu, fixed, archive, accepted] of [
    ['1960-04-19', 8, '子', ['子', '守'], [], [['铃星', '午', '冲']], true],
    ['1980-08-16', 6, '午', ['戌', '三合'], [['火星', '寅', '三合'], ['铃星', '戌', '三合']], [], false],
  ]) {
    const n = native({ dateStr, timeIndex });
    const run = bindSourceRun(n, input, Date.parse('2026-02-20T00:00:00Z'));
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.careerTianjiWenquCandidate === true);
    assert.ok(fact);
    const p = fact.normalizedPayload, counter = p.careerTianjiCounter;
    assert.equal(p.branch, branch);
    assert.deepEqual(p.templeSupportContacts, [{ star: '天机', branch, grade: '庙', relation: '守' }]);
    assert.deepEqual(p.careerTianjiWenqu, { star: '文曲', branch: wenqu[0], relation: wenqu[1] });
    assert.deepEqual(counter.natalYangTuo, []);
    assert.ok(counter.annualYangTuo.length > 0);
    const summarize = rows => rows.map(row => [row.star, row.branch, row.relation]);
    assert.deepEqual(summarize(counter.mingFixedFireBell), fixed);
    assert.deepEqual(summarize(counter.archivedFireBell), archive);
    assert.deepEqual([p.careerTianjiMingClearCandidate, p.careerTianjiArchiveClearCandidate], [accepted, !accepted]);
    const scoped = { ...fact, normalizedPayload: { ...p, supportCandidate: false, templeSupportCandidate: false,
      annualLucunCandidate: false, careerWuquLuQuanKeCandidate: false, shaCandidate: false, jiCandidate: false } };
    const hit = matchFortuneKnowledge({ ...run, facts: [scoped] }).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
    assert.equal(hit.status, accepted ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, accepted ? [fact.factId] : []);
    assert.deepEqual(hit.windows, accepted ? [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-02-28T16:00:00.000Z' }] : []);
    if (accepted) {
      const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-career'));
      assert.match(formatFortuneFactAudit(modelInput), /本命羊陀和明刊火铃均未到会该宫/u);
      assert.doesNotMatch(formatFortunePrompt(modelInput), /本命羊陀和明刊火铃均未到会该宫/u);
      const wrong = { ...scoped, normalizedPayload: { ...scoped.normalizedPayload, quanshuFixedFireBellProfile: 'other-source' } };
      const wrongHit = matchFortuneKnowledge({ ...run, facts: [wrong] }).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
      assert.equal(wrongHit.status, 'not_matched');
      const wrongLayer = structuredClone(n);
      const palace = wrongLayer.palaces.find(row => row.minorStars.some(star => star.name === '陀罗'));
      const [tuoluo] = palace.minorStars.splice(palace.minorStars.findIndex(star => star.name === '陀罗'), 1);
      palace.adjectiveStars.push(tuoluo);
      const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
      const incomplete = buildQuanshuDoujunMonths(window, wrongLayer)[0].data;
      assert.equal(incomplete.careerTianjiWenquCandidate, true);
      assert.equal(incomplete.careerTianjiMingClearCandidate, undefined);
      assert.equal(incomplete.natalShaContactsComplete, false);
      const incompleteRun = { ...run, facts: [{ ...fact, normalizedPayload: incomplete }] };
      const incompleteInput = buildFortuneModelContext(incompleteRun,
        interpretFortune(incompleteRun, requestForFortuneRun(incompleteRun), 'ming-career-invalid-layer')).input;
      assert.match(formatFortuneFactAudit(incompleteInput), /天机分支的本命羊陀位置未核齐/u);
      assert.match(formatFortuneFactAudit(incompleteInput), /仍有本命羊陀的星曜位置待核/u);
      assert.doesNotMatch(formatFortuneFactAudit(incompleteInput), /本命羊陀和明刊火铃均未到会该宫/u);
      assert.doesNotMatch(formatFortunePrompt(incompleteInput), /天机分支的本命羊陀位置未核齐|仍有本命羊陀的星曜位置待核|natalAdversityProof/u);
      for (const normalizedPayload of [
        { ...scoped.normalizedPayload, careerTianjiMingClearCandidate: incomplete.careerTianjiMingClearCandidate },
        { ...scoped.normalizedPayload, natalAdversityProof: undefined },
      ]) {
        const unproven = matchFortuneKnowledge({ ...run, facts: [{ ...scoped, normalizedPayload }] })
          .byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
        assert.equal(unproven.status, 'unknown');
      }
    }
  }
});

test('career Doujun verifies temple Tian Tong with no visible native Yang Tuo or fixed Ming Fire Bell', () => {
  const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month: 12 } };
  const asOf = Date.parse('2026-12-20T00:00:00Z');
  const lunarStart = '2026-12-08T16:00:00.000Z';
  const lunarEnd = '2027-01-07T16:00:00.000Z';
  for (const [dateStr, timeIndex, contacts] of [
    ['1975-09-14', 2, []], ['1990-05-05', 10, [['陀罗', '未', '三合'], ['铃星', '卯', '三合']]],
  ]) {
    const natal = native({ dateStr, timeIndex });
    const run = bindSourceRun(natal, input, asOf);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === '官禄');
    const data = fact.normalizedPayload;
    const accepted = contacts.length === 0;
    assert.deepEqual([data.branch, data.lunarMonth, data.nativeStart, data.nativeEnd], ['亥', 11, lunarStart, lunarEnd]);
    assert.deepEqual(data.careerTiantongMingShaContacts.map(({ star, branch, relation }) => [star, branch, relation]), contacts);
    assert.equal(data.careerTiantongMingClearCandidate, accepted);
    assert.deepEqual(data.careerTiantongMingClearWitness, accepted ? { star: '天同', branch: '亥', grade: '庙' } : undefined);
    const isolateCandidate = data => ({ ...data, supportCandidate: false, templeSupportCandidate: false,
      annualLucunCandidate: false, careerWuquLuQuanKeCandidate: false, shaCandidate: false, jiCandidate: false,
      careerTianjiMingClearCandidate: false, jumenTianjiSameSeatCandidate: false });
    const scoped = data => ({ ...run, facts: [{ ...fact, normalizedPayload: isolateCandidate(data) }] });
    const result = data => matchFortuneKnowledge(scoped(data)).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
    const hit = result(data);
    assert.equal(hit.status, accepted ? 'matched' : 'not_matched');
    assert.deepEqual(hit.windows, accepted ? [{ start: lunarStart, endExclusive: '2026-12-31T16:00:00.000Z' }] : []);
    if (accepted) {
      const modelInput = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-career-tiantong')).input;
      assert.match(formatFortuneFactAudit(modelInput), /官禄月宫天同实守亥宫[^\n]*明刊火铃/u);
      assert.doesNotMatch(formatFortunePrompt(modelInput), /官禄月宫天同实守亥宫|careerTiantongMing/u);
      const misplaced = structuredClone(natal);
      const archive = misplaced.palaces.find(row => row.minorStars.some(star => star.name === '擎羊'));
      const [qingyang] = archive.minorStars.splice(archive.minorStars.findIndex(star => star.name === '擎羊'), 1);
      archive.adjectiveStars.push(qingyang);
      const incomplete = buildQuanshuDoujunMonths({ start: Date.parse(lunarStart), end: Date.parse(lunarEnd) }, misplaced)[0].data;
      assert.equal(incomplete.careerTiantongMingClearWitness, undefined);
      assert.equal(incomplete.natalShaContactsComplete, false);
      assert.equal(result(incomplete).status, 'unknown');
      const before = buildQuanshuDoujunMonths({ start: Date.parse(lunarStart) - 1, end: Date.parse(lunarStart) }, natal)[0].data;
      assert.equal(before.careerTiantongMingClearCandidate, false);
      const oldSeat = natal.palaces.find(palace => palace.earthlyBranch === '亥');
      const star = oldSeat.majorStars.find(row => row.name === '天同');
      oldSeat.majorStars = oldSeat.majorStars.filter(row => row.name !== '天同');
      natal.palaces.find(palace => palace.earthlyBranch === '子').majorStars.push(star);
      const wrong = buildQuanshuDoujunMonths({ start: Date.parse(lunarStart), end: Date.parse(lunarEnd) }, natal)[0].data;
      assert.equal(wrong.careerTiantongMingClearCandidate, undefined);
      assert.equal(result(wrong).status, 'unknown');
    }
  }
});

test('Ming Tianfu checks both wealth and career Doujun months and keeps adverse or unverified positions out', () => {
  const cases = [
    ['财帛', 'p063', '1988-05-15', 7, 2022, 1, '巳', '地', true, '2022-01-02T16:00:00.000Z'],
    ['财帛', 'p063', '1965-09-15', 0, 2020, 2, '巳', '地', false, '2020-01-24T16:00:00.000Z'],
    ['官禄', 'p067', '1947-02-05', 6, 2024, 4, '子', '庙', true, '2024-04-08T16:00:00.000Z'],
    ['官禄', 'p067', '1979-07-15', 7, 2020, 4, '辰', '庙', false, '2020-03-23T16:00:00.000Z'],
  ];
  for (const [theme, passage, dateStr, timeIndex, year, month, branch, grade, accepted, nativeStart] of cases) {
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month } };
    const natal = native({ dateStr, timeIndex }), run = bindSourceRun(natal, input, Date.UTC(year, month - 1, 16));
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month'
      && row.normalizedPayload.natalName === theme && row.normalizedPayload.nativeStart === nativeStart);
    assert.ok(fact, theme + dateStr);
    const data = fact.normalizedPayload;
    assert.equal(data.ziweiBirthAnchorVerified, true);
    assert.ok(natal.palaces.find(row => row.earthlyBranch === branch).majorStars.some(row => row.name === '天府'));
    assert.equal(data.mingTianfuClearCandidate, accepted);
    assert.deepEqual(data.mingTianfuClearWitness, accepted ? { star: '天府', branch, grade } : undefined);
    const scoped = (payload = data) => ({ ...run, facts: [{ ...fact, normalizedPayload: payload }] });
    const evaluate = payload => matchFortuneKnowledge(scoped(payload)).byMethod.ziwei
      .find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    const hit = evaluate();
    assert.equal(hit.status, accepted ? 'matched' : 'partial');
    if (accepted) {
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.ok(hit.matchedConditions.some(row => row.includes('天府')));
      const model = buildFortuneModelContext(scoped(), interpretFortune(scoped(), requestForFortuneRun(scoped()), 'ming-tianfu')).input;
      const detail = theme + '月宫在' + branch + '宫，天府实守';
      assert.ok(formatFortuneFactAudit(model).includes(detail));
      assert.ok(!formatFortunePrompt(model).includes(detail));
      const end = Date.parse(data.nativeEnd), start = Date.parse(nativeStart);
      const earlier = buildQuanshuDoujunMonths({ start: start - 1, end: start }, natal)[0].data;
      const later = buildQuanshuDoujunMonths({ start: end, end: end + 1 }, natal)[0].data;
      assert.notEqual(earlier.mingTianfuClearCandidate, true);
      assert.notEqual(later.mingTianfuClearCandidate, true);
      const incomplete = buildQuanshuDoujunMonths({ start, end }, misplacedNatalStar(natal, '陀罗', 'minorStars'))[0].data;
      assert.equal(incomplete.mingTianfuClearCandidate, undefined);
      assert.equal(evaluate(incomplete).status, 'partial');
    } else {
      assert.ok(data.voidContacts.length > 0);
    }
  }
});

test('Ming Lianzhen and Tianxiang confirm both Doujun themes only at the actual unobstructed lunar seat', () => {
  const cases = [
    ['财帛', 'p063', '1988-01-17', 8, 12, 11, 9, '2024-11-30T16:00:00.000Z', '2024-12-30T16:00:00.000Z'],
    ['官禄', 'p067', '1987-12-31', 4, 4, 3, 1, '2024-04-08T16:00:00.000Z', '2024-04-30T16:00:00.000Z'],
  ];
  const flag = 'mingLianzhenTianxiangClearCandidate';
  for (const [theme, passage, dateStr, timeIndex, month, lunarMonth, adverseMonth, open, close] of cases) {
    const natal = native({ dateStr, timeIndex });
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2024, month } };
    const run = bindSourceRun(natal, input, Date.UTC(2024, month - 1, 16));
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === theme);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data.lunarMonth, lunarMonth);
    assert.equal(data[flag], true);
    assert.deepEqual(data.mingLianzhenTianxiangClearWitness, { branch: '子', stars: ['廉贞', '天相'] });
    assert.equal(data.mingTianfuClearCandidate, false);
    assert.equal(data.namedPairGuardCandidate, false);
    const scoped = { ...run, facts: [fact] };
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(`-${passage}-001`)).knowledgeId;
    const hit = matchFortuneKnowledge(scoped).byMethod.ziwei.find(row => row.knowledgeId === knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: open, endExclusive: close }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const exact = normalizedPayload => evaluateFortuneRules('ziwei', 'month', [{ ...fact, normalizedPayload }])
      .find(row => row.knowledgeId === knowledgeId).confirmations.find(query => query.condition.includes(flag));
    assert.equal(exact(data).hits.length, 1);
    const { input: model } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), passage));
    const detail = `${theme}月宫在子宫，廉贞与天相实守同宫，已核忌煞、空劫与耗曜均未到会`;
    assert.ok(formatFortuneFactAudit(model).includes(detail));
    const prompt = formatFortunePrompt(model);
    assert.match(prompt, /廉贞.*天相/u);
    assert.ok(!prompt.includes(detail));
    assert.doesNotMatch(prompt, /明刊廉贞天相|子宫|mingLianzhenTianxiangClearWitness/u);

    const start = Date.parse(data.nativeStart), end = Date.parse(data.nativeEnd);
    const readAt = (archive, start) => buildQuanshuDoujunMonths({ start, end: start + 1 }, archive)[0].data;
    for (const other of [readAt(natal, start - 1), readAt(natal, end)]) {
      assert.notEqual(other.natalName, theme);
      assert.equal(other[flag], false);
      assert.equal(exact(other).hits.length, 0);
    }
    const adverse = readAt(natal, quanshuLunarMidnight(2026, adverseMonth));
    assert.deepEqual([adverse.natalName, adverse.branch], [theme, '子']);
    assert.ok(adverse.annualJiContacts.some(row => row.star === '廉贞' && row.relation === '守'));
    assert.equal(adverse[flag], false);
    assert.deepEqual([exact(adverse).hits.length, exact(adverse).unknown], [0, false]);
    for (const archive of [misplacedNatalStar(natal, '廉贞', 'majorStars'), misplacedNatalStar(natal, '陀罗', 'minorStars')]) {
      const missing = readAt(archive, start);
      assert.equal(missing[flag], undefined);
      assert.equal(missing.mingLianzhenTianxiangClearWitness, undefined);
      assert.deepEqual([exact(missing).hits.length, exact(missing).unknown], [0, true]);
    }
  }
});

test('Ming Doujun confirms temple luminaries and Tianji with Wenqu only in the corresponding clear month', () => {
  const cases = [
    { dateStr: '1976-08-05', timeIndex: 1, theme: '财帛', passage: 'p063', star: '太阳', branch: '卯',
      year: 2016, month: 2, lunarMonth: 1, start: '2016-02-07T16:00:00.000Z', end: '2016-02-29T16:00:00.000Z',
      adverse: [2010, 7], flag: 'mingSolarTempleClearCandidate' },
    { dateStr: '1976-08-05', timeIndex: 1, theme: '官禄', passage: 'p067', star: '太阴', branch: '亥',
      year: 2011, month: 3, lunarMonth: 2, start: '2011-03-04T16:00:00.000Z', end: '2011-03-31T16:00:00.000Z',
      adverse: [2015, 10], flag: 'mingLunarTempleClearCandidate' },
    { dateStr: '1980-08-16', timeIndex: 4, theme: '财帛', passage: 'p063', star: '太阴', branch: '子',
      year: 2010, month: 2, lunarMonth: 1, start: '2010-02-13T16:00:00.000Z', end: '2010-02-28T16:00:00.000Z',
      adverse: [2015, 8], flag: 'mingLunarTempleClearCandidate' },
    { dateStr: '1960-04-19', timeIndex: 8, theme: '官禄', passage: 'p067', star: '天机', branch: '子',
      year: 2010, month: 6, lunarMonth: 5, start: '2010-06-11T16:00:00.000Z', end: '2010-06-30T16:00:00.000Z',
      adverse: [2011, 4], flag: 'careerTianjiMingClearCandidate' },
  ];
  for (const { dateStr, timeIndex, theme, passage, star, branch, year, month, lunarMonth, start, end, adverse, flag } of cases) {
    const natal = native({ dateStr, timeIndex });
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month } };
    const run = bindSourceRun(natal, input, Date.parse(start) + 3600000);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month'
      && row.normalizedPayload.natalName === theme && row.activeFrom === start);
    assert.ok(fact, star + start);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.branch, data.lunarMonth, data.ziweiBirthAnchorVerified, data[flag]], [branch, lunarMonth, true, true]);
    assert.ok(data.templeSupportContacts.some(row => row.star === star && row.branch === branch && row.grade === '庙' && row.relation === '守'));
    assert.equal(data.mingDoujunAdversityCandidate, false);
    if (star === '天机') assert.deepEqual(data.careerTianjiWenqu, { star: '文曲', branch, relation: '守' });
    const scoped = { ...run, facts: [fact] };
    const hit = matchFortuneKnowledge(scoped).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    assert.equal(hit.status, 'matched', star + start);
    assert.deepEqual(hit.windows, [{ start, endExclusive: end }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.ok(hit.matchedConditions.some(row => row.includes(star)));
    const exact = normalizedPayload => evaluateFortuneRules('ziwei', 'month', [{ ...fact, normalizedPayload }])
      .find(row => row.knowledgeId === hit.knowledgeId).confirmations.find(query => query.condition.includes(flag));
    assert.equal(exact(data).hits.length, 1);
    const { input: model } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-doujun-temple'));
    assert.ok(formatFortunePrompt(model).includes(star));
    assert.doesNotMatch(formatFortunePrompt(model), /mingSolarTempleClearCandidate|mingLunarTempleClearCandidate|careerTianjiMingClearCandidate/u);

    const readAt = (chart, start) => buildQuanshuDoujunMonths({ start, end: start + 1 }, chart)[0].data;
    for (const adjacent of [Date.parse(data.nativeStart) - 1, Date.parse(data.nativeEnd)]) {
      const other = readAt(natal, adjacent);
      assert.notEqual(other.natalName, theme);
      assert.equal(exact(other).hits.length, 0);
    }
    const mixed = readAt(natal, quanshuLunarMidnight(...adverse));
    assert.deepEqual([mixed.natalName, mixed.branch, mixed.mingDoujunAdversityCandidate], [theme, branch, true]);
    assert.ok(mixed.templeSupportContacts.some(row => row.star === star));
    assert.deepEqual([exact(mixed).hits.length, exact(mixed).unknown], [0, false]);
    const wrong = misplacedNatalStar(natal, star === '天机' ? '文曲' : star, star === '天机' ? 'minorStars' : 'majorStars');
    const missing = readAt(wrong, Date.parse(start));
    assert.equal(missing[flag], undefined);
    assert.deepEqual([exact(missing).hits.length, exact(missing).unknown], [0, true]);
  }
  const careerSunAt = quanshuLunarMidnight(2010, 11);
  const careerSun = buildQuanshuDoujunMonths({ start: careerSunAt, end: careerSunAt + 1 },
    native({ dateStr: '1961-06-19', timeIndex: 7 }))[0].data;
  assert.equal(careerSun.natalName, '官禄');
  assert.deepEqual(careerSun.templeSupportContacts, [{ star: '太阳', branch: '卯', grade: '庙', relation: '守' }]);
  assert.equal(careerSun.templeSupportCandidate, true);
  assert.equal(careerSun.mingSolarTempleClearCandidate, false);
});

test('Ming first-month career Doujun confirms the clear temple Tian Tong branch only in its real month', () => {
  const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2036, month: 2 } };
  const asOf = Date.parse('2036-02-19T00:00:00Z');
  const start = '2036-01-27T16:00:00.000Z', end = '2036-02-26T16:00:00.000Z';
  const good = native({ dateStr: '1975-09-14', timeIndex: 2 });
  const bad = native({ dateStr: '1990-05-05', timeIndex: 10 });
  const run = bindSourceRun(good, input, asOf);
  const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month'
    && row.normalizedPayload.natalName === '官禄' && row.normalizedPayload.lunarMonth === 1);
  assert.ok(fact);
  assert.deepEqual(fact.normalizedPayload.careerTiantongMingClearWitness, { star: '天同', branch: '亥', grade: '庙' });
  assert.deepEqual(fact.normalizedPayload.careerTiantongMingShaContacts, []);
  assert.deepEqual(fact.normalizedPayload.archivedFireBellContacts, [{ star: '火星', branch: '亥', relation: '守' }]);
  assert.equal(fact.normalizedPayload.mingDoujunAdversityCandidate, false);
  const evaluate = scoped => matchFortuneKnowledge(scoped).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p067-001'));
  const result = evaluate(run);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '2036-01-31T16:00:00.000Z', endExclusive: end }]);
  assert.deepEqual(result.sourceFactIds, [fact.factId]);

  const monthly = (natal, from, to) => buildQuanshuDoujunMonths({ start: Date.parse(from), end: Date.parse(to) }, natal)[0].data;
  const adverse = monthly(bad, start, end);
  assert.equal(adverse.careerTiantongMingClearCandidate, false);
  assert.deepEqual(adverse.careerTiantongMingShaContacts.map(({ star, relation }) => [star, relation]),
    [['陀罗', '三合'], ['铃星', '三合']]);
  const isolate = data => ({ ...run, facts: [{ ...fact, normalizedPayload: data }] });
  assert.equal(evaluate(isolate(adverse)).status, 'partial');
  const earlierBirthday = native({ dateStr: '1975-09-13', timeIndex: 2 });
  const actualEarlierMonth = monthly(earlierBirthday, start, end);
  assert.equal(actualEarlierMonth.ziweiBirthAnchorVerified, true);
  assert.equal(actualEarlierMonth.careerTiantongMingClearCandidate, false);
  const wrongBirthday = monthly(withMajorStarsFrom(earlierBirthday, good), start, end);
  assert.equal(wrongBirthday.ziweiBirthAnchorVerified, false);
  assert.equal(wrongBirthday.natalName, '官禄');
  assert.equal(wrongBirthday.careerTiantongMingClearCandidate, undefined);
  assert.equal(wrongBirthday.careerTiantongMingClearWitness, undefined);
  assert.deepEqual(wrongBirthday.annualLucunContacts, fact.normalizedPayload.annualLucunContacts);
  assert.notEqual(evaluate(isolate(wrongBirthday)).status, 'matched');
  const mixed = monthly(good, '2024-02-09T16:00:00.000Z', '2024-03-09T16:00:00.000Z');
  assert.equal(mixed.careerTiantongMingClearCandidate, true);
  assert.deepEqual(mixed.annualShaContacts, [{ star: '擎羊', branch: '卯', relation: '三合' }]);
  assert.equal(mixed.mingDoujunAdversityCandidate, true);
  assert.equal(evaluate(isolate(mixed)).status, 'partial');
  for (const badChart of [misplacedNatalStar(good, '天同', 'majorStars'), misplacedNatalStar(good, '擎羊', 'minorStars')]) {
    const unknown = monthly(badChart, start, end);
    assert.equal(unknown.careerTiantongMingClearCandidate, undefined);
    assert.notEqual(evaluate(isolate(unknown)).status, 'matched');
  }
  const next = monthly(good, end, '2036-02-26T16:00:00.001Z');
  assert.equal(next.lunarMonth, 2);
  assert.equal(next.careerTiantongMingClearCandidate, false);
  assert.notEqual(evaluate(isolate(next)).status, 'matched');

  const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-career-opening'));
  assert.ok(modelInput.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  assert.match(formatFortuneFactAudit(modelInput), /官禄月宫天同实守亥宫[^\n]*明刊火铃/u);
  const prompt = formatFortunePrompt(modelInput);
  assert.match(prompt, /正月斗君实到本命官禄/u);
  assert.doesNotMatch(prompt, /官禄月宫天同实守亥宫|careerTiantongMing/u);
});

test('Ming first-month wealth Doujun confirms its clear Tian Tong and Tian Liang pair on the same positions', () => {
  const natal = native({ dateStr: '1983-02-15', timeIndex: 2 });
  const target = year => ({ periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month: 2 } });
  const run = bindSourceRun(natal, target(2014), Date.UTC(2014, 1, 19));
  const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === '财帛');
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.equal(data.lunarMonth, 1);
  assert.deepEqual(data.namedPairGuardWitness, { branch: '申', stars: ['天同', '天梁'] });
  assert.deepEqual(data.archivedFireBellContacts, [{ star: '铃星', branch: '子', relation: '三合' }]);
  assert.equal(data.wealthTiantongTianliangMingClearCandidate, true);
  const evaluate = scoped => matchFortuneKnowledge(scoped).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-p063-001'));
  const result = evaluate(run);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '2014-01-31T16:00:00.000Z', endExclusive: '2014-02-28T16:00:00.000Z' }]);
  assert.deepEqual(result.sourceFactIds, [fact.factId]);

  const laterRun = bindSourceRun(natal, target(2026), Date.UTC(2026, 1, 20));
  const later = laterRun.facts.find(row => row.factType === 'quanshu_doujun_month'
    && row.normalizedPayload.natalName === '财帛').normalizedPayload;
  assert.equal(later.namedPairGuardCandidate, true);
  assert.deepEqual(later.annualShaContacts, [{ star: '陀罗', branch: '辰', relation: '三合' }]);
  assert.equal(later.wealthTiantongTianliangMingClearCandidate, false);
  assert.equal(evaluate(laterRun).status, 'partial');

  const start = Date.parse(data.nativeStart), end = Date.parse(data.nativeEnd);
  const incomplete = misplacedNatalStar(natal, '擎羊', 'minorStars');
  const unknown = buildQuanshuDoujunMonths({ start, end }, incomplete)[0].data;
  assert.equal(unknown.namedPairGuardCandidate, true);
  assert.equal(unknown.wealthTiantongTianliangMingClearCandidate, undefined);
  const isolate = data => ({ ...run, facts: [{ ...fact, normalizedPayload: data }] });
  assert.equal(evaluate(isolate(unknown)).status, 'partial');
  const wrongProfile = { ...data, quanshuFixedFireBellProfile: 'archive-position' };
  assert.equal(evaluate(isolate(wrongProfile)).status, 'partial');
  const next = buildQuanshuDoujunMonths({ start: end, end: end + 1 }, natal)[0].data;
  assert.equal(next.lunarMonth, 2);
  assert.equal(next.wealthTiantongTianliangMingClearCandidate, false);
  assert.notEqual(evaluate(isolate(next)).status, 'matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-wealth-opening'));
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /天同与天梁实守斗君所到的财帛申宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /正月斗君实到本命财帛/u);
  assert.doesNotMatch(prompt, /天同与天梁实守斗君所到的财帛申宫|wealthTiantongTianliangMing/u);
});

test('Ming Doujun separates natal and annual Geng Tianxiang taboo in both themes', () => {
  const cases = [
    { birth: { dateStr: '1983-02-15', timeIndex: 2 }, year: 2010, branch: '申', theme: '财帛',
      passage: 'p063', layer: 'annual', legacy: [{ star: '天同', branch: '申', relation: '守' }], ming: [],
      flag: 'wealthTiantongTianliangMingClearCandidate', status: 'matched' },
    { birth: { dateStr: '1990-02-08', timeIndex: 0 }, year: 2014, branch: '戌', theme: '财帛',
      passage: 'p063', layer: 'natal', legacy: [], ming: [{ star: '天相', branch: '寅', relation: '三合' }],
      flag: 'mingTianfuClearCandidate', status: 'partial' },
    { birth: { dateStr: '1947-02-05', timeIndex: 6 }, year: 2010, branch: '子', theme: '官禄',
      passage: 'p067', layer: 'annual', legacy: [], ming: [{ star: '天相', branch: '辰', relation: '三合' }],
      flag: 'mingTianfuClearCandidate', status: 'partial' },
  ];
  for (const { birth, year, branch, theme, passage, layer, legacy, ming, flag, status } of cases) {
    const natal = native(birth);
    const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month: 6 } };
    const run = bindSourceRun(natal, params, Date.UTC(year, 5, 20));
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === theme);
    const data = fact.normalizedPayload;
    const mingField = layer === 'natal' ? 'mingNatalGengJiContacts' : 'mingAnnualGengJiContacts';
    const otherLayer = layer === 'natal' ? 'mingAnnualGengJiContacts' : 'mingNatalGengJiContacts';
    assert.deepEqual([data.branch, data.lunarMonth, data[`${layer}JiContacts`], data[mingField], data[otherLayer]],
      [branch, 5, legacy, ming, undefined]);
    assert.equal(data.mingDoujunAdversityCandidate, Boolean(ming.length));
    assert.equal(data[flag], status === 'matched');
    const match = normalizedPayload => matchFortuneKnowledge({ ...run, facts: [{ ...fact, normalizedPayload }] }).byMethod.ziwei
      .find(row => row.knowledgeId.endsWith(`-${passage}-001`));
    assert.equal(match(data).status, status);
    assert.deepEqual(match(data).windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

    const start = Date.parse(data.nativeStart), end = Date.parse(data.nativeEnd);
    const wrong = buildQuanshuDoujunMonths({ start, end: start + 1 }, misplacedNatalStar(natal, '天相', 'majorStars'))[0].data;
    assert.equal(wrong[mingField], undefined);
    assert.equal(wrong.mingDoujunAdversityCandidate, undefined);
    assert.equal(wrong[flag], undefined);
    assert.notEqual(match(wrong).status, 'matched');
    assert.equal(buildQuanshuDoujunMonths({ start: end, end: end + 1 }, natal)[0].data[flag], false);
  }
});

test('Ming Doujun named wealth and career branches reach ordinary months after the first month', () => {
  const examples = [
    { dateStr: '1983-02-15', year: 2013, month: 3, lunarMonth: 2, theme: '财帛', passage: 'p063',
      branch: '申', start: '2013-03-11T16:00:00.000Z', end: '2013-03-31T16:00:00.000Z' },
    { dateStr: '1975-09-14', year: 2015, month: 11, lunarMonth: 10, theme: '官禄', passage: 'p067',
      branch: '亥', start: '2015-11-11T16:00:00.000Z', end: '2015-11-30T16:00:00.000Z' },
  ];
  for (const { dateStr, year, month, lunarMonth, theme, passage, branch, start, end } of examples) {
    const natal = native({ dateStr, timeIndex: 2 });
    const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month } };
    const run = bindSourceRun(natal, params, Date.UTC(year, month - 1, 20));
    validateFortuneFacts(run);
    const rows = run.facts.filter(row => row.factType === 'quanshu_doujun_month');
    const confirmed = rows.find(row => row.normalizedPayload.natalName === theme);
    const previous = rows.find(row => row.activeTo === start);
    assert.ok(confirmed && previous);
    assert.equal(previous.normalizedPayload.lunarMonth, lunarMonth - 1);
    assert.notEqual(previous.normalizedPayload.natalName, theme);
    assert.equal(confirmed.normalizedPayload.lunarMonth, lunarMonth);
    assert.equal(confirmed.normalizedPayload.leap, false);
    assert.equal(confirmed.normalizedPayload.branch, branch);
    assert.equal(confirmed.activeFrom, start);
    const result = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start, endExclusive: end }]);
    assert.deepEqual(result.sourceFactIds, [confirmed.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-later-' + passage));
    assert.ok(formatFortunePrompt(input).includes('当月斗君实到本命' + theme));
  }
});

test('Ming Doujun wealth and career pairs require both verified natal main stars in the actual lunar month', () => {
  const cases = [
    { dateStr: '2000-01-01', timeIndex: 0, month: 6, lunarMonth: 5, natalName: '财帛', branch: '申', pair: ['天同', '天梁'], passage: 'p063' },
    { dateStr: '1980-01-15', timeIndex: 8, month: 10, lunarMonth: 9, natalName: '官禄', branch: '申', pair: ['天同', '天梁'], passage: 'p067' },
    { dateStr: '1970-07-02', timeIndex: 6, month: 2, lunarMonth: 1, natalName: '官禄', branch: '辰', pair: ['天机', '天梁'], passage: 'p067' },
  ];
  for (const { dateStr, timeIndex, month, lunarMonth, natalName, branch, pair, passage } of cases) {
    const natal = native({ dateStr, timeIndex });
    const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2022, month } };
    const run = bindSourceRun(natal, input, Date.UTC(2022, month - 1, 20));
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month'
      && row.normalizedPayload.natalName === natalName && row.normalizedPayload.lunarMonth === lunarMonth);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data.namedPairGuardCandidate, true);
    assert.deepEqual(data.namedPairGuardWitness, { branch, stars: pair });
    const scope = (payload = data) => ({ ...run, facts: [{ ...fact, normalizedPayload: {
      ...payload, supportCandidate: false, templeSupportCandidate: false, annualLucunCandidate: false,
      wealthWuquFavorableCandidate: false, careerWuquLuQuanKeCandidate: false, careerTianjiMingClearCandidate: false,
      wealthNamedGuardCandidate: false, jumenTianjiSameSeatCandidate: false, careerTiantongMingClearCandidate: false,
      shaCandidate: false, haoCandidate: false, jiCandidate: false,
    } }] });
    const result = (normalizedPayload, suffix = passage) => matchFortuneKnowledge(scope(normalizedPayload)).byMethod.ziwei
      .find(row => row.knowledgeId.endsWith(`-${suffix}-001`));
    const hit = result(data);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.equal(result(data, passage === 'p063' ? 'p067' : 'p063').status, 'not_matched');
    const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-doujun-pair'));
    const pairText = `${pair.join('与')}实守斗君所到的${natalName}${branch}宫`;
    assert.ok(formatFortuneFactAudit(modelInput).includes(pairText));
    const prompt = formatFortunePrompt(modelInput);
    assert.ok(!prompt.includes(pairText) && !prompt.includes('namedPairGuard'));
    assert.ok(modelInput.sections.flatMap(section => section.findings).every(finding => finding.knowledgeId !== hit.knowledgeId));

    const start = Date.parse(data.nativeStart), end = Date.parse(data.nativeEnd);
    const displayStart = Date.UTC(2022, month - 1, 1) - 8 * 3_600_000;
    const displayEnd = Date.UTC(2022, month, 1) - 8 * 3_600_000;
    assert.deepEqual(hit.windows, [{ start: new Date(Math.max(start, displayStart)).toISOString(),
      endExclusive: new Date(Math.min(end, displayEnd)).toISOString() }]);
    for (const [from, to] of [[start - 1, start], [end, end + 1]]) {
      const otherMonth = buildQuanshuDoujunMonths({ start: from, end: to }, natal)[0].data;
      assert.equal(otherMonth.namedPairGuardCandidate, false);
      assert.equal(result(otherMonth).status, 'not_matched');
    }

    const palace = natal.palaces.find(row => row.earthlyBranch === branch);
    const wrongLayer = palace.majorStars.find(row => row.name === pair[1]);
    palace.majorStars = palace.majorStars.filter(row => row !== wrongLayer);
    palace.minorStars.push(wrongLayer);
    const unverified = buildQuanshuDoujunMonths({ start, end }, natal)[0].data;
    assert.equal(unverified.namedPairGuardCandidate, undefined);
    assert.equal(unverified.namedPairGuardWitness, undefined);
    assert.equal(result(unverified).status, 'unknown');
  }
});

test('wealth Wuqu and career Qingyang retain source-specific positive and negative evidence at once', () => {
  const monthly = (dateStr, timeIndex, start) => {
    const window = { start: Date.parse(start), end: Date.parse(start) + 86_400_000 };
    return buildQuanshuDoujunMonths(window, native({ dateStr, timeIndex }))[0].data;
  };
  const wuqu = monthly('1970-01-02', 6, '2022-06-19T00:00:00Z');
  assert.equal(wuqu.natalName, '财帛');
  assert.equal(wuqu.branch, '寅');
  assert.equal(wuqu.wealthNamedGuardCandidate, false);
  assert.deepEqual(wuqu.wealthWuquChanges, [{ layer: 'natal', stem: '己', kind: '禄' }]);
  assert.deepEqual(wuqu.wealthWuquJi, [{ layer: 'yearly', stem: '壬', kind: '忌' }]);
  const qingyang = monthly('1975-07-12', 7, '2026-10-19T00:00:00Z');
  assert.equal(qingyang.natalName, '官禄');
  assert.equal(qingyang.branch, '辰');
  assert.ok(qingyang.natalShaContacts.some(row => row.star === '擎羊' && row.branch === '辰' && row.relation === '守'));
  assert.deepEqual(qingyang.careerTempleYangSupport, [{ star: '紫微', branch: '辰', relation: '守' }]);
});

test('Doujun theme rules retain one verified aid when a different natal placement is in the wrong layer', () => {
  const cases = [
    [{ dateStr: '1983-02-15', timeIndex: 2 }, 2014, 2, '财帛', 'p063', '文昌', ['左辅', '禄存']],
    [{ dateStr: '1975-07-12', timeIndex: 7 }, 2026, 10, '官禄', 'p067', '文曲', ['紫微', '天府', '魁钺组', '魁钺组']],
  ];
  for (const [birth, year, month, theme, passage, displaced, expected] of cases) {
    const natal = native(birth);
    const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month } };
    const run = bindSourceRun(misplacedNatalStar(natal, displaced, 'minorStars'), params, Date.UTC(year, month - 1, 20));
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === theme);
    const data = fact.normalizedPayload;
    assert.equal(data.supportCandidate, true);
    assert.deepEqual(data.supportContacts.map(row => row.star), expected);
    const isolateSupport = payload => ({ ...run, facts: [{ ...fact, normalizedPayload: {
      ...payload, templeSupportCandidate: false, annualLucunCandidate: false, wealthWuquFavorableCandidate: false,
      careerWuquLuQuanKeCandidate: false, shaCandidate: false, haoCandidate: false, jiCandidate: false,
      wealthNamedGuardCandidate: false, namedPairGuardCandidate: false, jumenTianjiSameSeatCandidate: false,
      wealthTiantongTianliangMingClearCandidate: false, careerTianjiMingClearCandidate: false, careerTiantongMingClearCandidate: false,
    } }] });
    const matchSupport = payload => matchFortuneKnowledge(isolateSupport(payload)).byMethod.ziwei
      .find(row => row.knowledgeId.endsWith(`-${passage}-001`));
    const result = matchSupport(data);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    if (theme === '财帛') {
      const unresolved = [displaced, ...expected].reduce((base, star) => misplacedNatalStar(base, star, 'minorStars'), natal);
      const start = Date.parse(data.nativeStart);
      const partial = buildQuanshuDoujunMonths({ start, end: start + 1 }, unresolved)[0].data;
      assert.deepEqual(partial.supportContacts, []);
      assert.equal(partial.supportCandidate, undefined);
      assert.equal(matchSupport(partial).status, 'unknown');
    } else {
      const start = Date.parse(data.nativeStart), window = { start, end: start + 1 };
      const wrongChang = misplacedNatalStar(natal, displaced, 'minorStars');
      const noMajors = misplacedNatalStar(wrongChang, '紫微', 'majorStars');
      const nobleSeats = data.supportContacts.filter(row => row.star === '魁钺组').map(row => row.branch);
      assert.equal(nobleSeats.length, 2);
      for (const star of ['天魁', '天钺']) {
        const wrongNoble = misplacedNatalStar(noMajors, star, 'minorStars');
        const wrongBranch = natal.palaces.find(palace => palace.minorStars.some(row => row.name === star)).earthlyBranch;
        const retained = buildQuanshuDoujunMonths(window, wrongNoble)[0].data;
        assert.deepEqual(retained.supportContacts.filter(row => row.star === '魁钺组').map(row => row.branch),
          nobleSeats.filter(branch => branch !== wrongBranch));
        assert.equal(retained.supportCandidate, true);
        assert.equal(matchSupport(retained).status, 'partial');
      }
      const bothWrong = ['天魁', '天钺'].reduce((base, star) => misplacedNatalStar(base, star, 'minorStars'), noMajors);
      const unknown = buildQuanshuDoujunMonths(window, bothWrong)[0].data;
      assert.deepEqual(unknown.supportContacts, []);
      assert.equal(unknown.supportCandidate, undefined);
      assert.equal(matchSupport(unknown).status, 'unknown');
    }
  }
});

test('monthly Wuqu uses the same verified natal seat for a wealth guard and the yearly taboo recipient', () => {
  const natal = native({ dateStr: '1970-01-02', timeIndex: 6 });
  const window = { start: Date.parse('2022-06-19T00:00:00Z'), end: Date.parse('2022-06-20T00:00:00Z') };
  const monthly = () => buildQuanshuDoujunMonths(window, natal)[0].data;
  const valid = monthly();
  assert.equal(valid.wealthWuquFavorableCandidate, true);
  assert.deepEqual(valid.annualJiContacts, [{ star: '武曲', branch: '寅', relation: '守' }]);
  const oldSeat = natal.palaces.find(palace => palace.earthlyBranch === '寅');
  const wuqu = oldSeat.majorStars.find(star => star.name === '武曲');
  oldSeat.majorStars = oldSeat.majorStars.filter(star => star.name !== '武曲');
  natal.palaces.find(palace => palace.earthlyBranch === '午').majorStars.push(wuqu);
  const moved = monthly();
  assert.equal(moved.wealthWuquFavorableCandidate, undefined);
  assert.deepEqual(moved.wealthWuquChanges, []);
  assert.equal(moved.annualJiContacts, undefined);
  assert.ok(moved.natalJiContacts);
});

test('wealth and career Doujun carry annual Lu and the two Wuqu conditions from the client through SQLite', () => {
  const cases = [
    { dateStr: '1970-01-02', timeIndex: 6, year: 2021, month: 7, theme: '财帛', branch: '寅', start: '2021-07-09T16:00:00.000Z',
      endExclusive: '2021-07-31T16:00:00.000Z', wealth: [{ layer: 'natal', stem: '己', kind: '禄' }],
      text: '本命武曲实守财帛月宫，生年干己使本宫武曲化禄' },
    { dateStr: '1986-10-17', timeIndex: 2, year: 2030, month: 2, theme: '财帛', branch: '辰', start: '2030-02-02T16:00:00.000Z',
      endExclusive: '2030-02-28T16:00:00.000Z', wealth: [{ layer: 'yearly', stem: '庚', kind: '权' }],
      lu: { star: '禄存', branch: '申', relation: '三合' },
      text: '本命武曲实守财帛月宫，流年干庚使本宫武曲化权' },
    { dateStr: '1970-01-02', timeIndex: 3, year: 2024, month: 6, theme: '官禄', branch: '丑', start: '2024-06-05T16:00:00.000Z',
      endExclusive: '2024-06-30T16:00:00.000Z', career: [{ layer: 'yearly', stem: '甲', stars: [
        { star: '廉贞', kind: '禄', branch: '酉', relation: '三合' },
        { star: '破军', kind: '权', branch: '酉', relation: '三合' },
        { star: '武曲', kind: '科', branch: '丑', relation: '守' },
      ] }], text: '庙地武曲实守官禄月宫，同一流年干甲所发的科权禄均会本宫' },
    { dateStr: '1984-03-15', timeIndex: 0, year: 2025, month: 5, theme: '官禄', branch: '未', start: '2025-04-30T16:00:00.000Z',
      endExclusive: '2025-05-26T16:00:00.000Z', lu: { star: '禄存', branch: '卯', relation: '三合' },
      career: [{ layer: 'natal', stem: '甲', stars: [
        { star: '廉贞', kind: '禄', branch: '卯', relation: '三合' },
        { star: '破军', kind: '权', branch: '卯', relation: '三合' },
        { star: '武曲', kind: '科', branch: '未', relation: '守' },
      ] }], text: '庙地武曲实守官禄月宫，同一生年干甲所发的科权禄均会本宫' },
    { dateStr: '1970-01-02', timeIndex: 3, year: 2021, month: 9, theme: '官禄', branch: '丑', start: '2021-09-06T16:00:00.000Z',
      endExclusive: '2021-09-30T16:00:00.000Z', lu: { star: '禄存', branch: '酉', relation: '三合' },
      text: '按农历年干复算的流年禄存在本宫及冲合范围内可见禄存在酉宫（三合）' },
  ];
  for (const { dateStr, timeIndex, year, month, theme, branch, start, endExclusive, wealth, career, lu, text } of cases) {
    const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year, month } };
    const now = Date.UTC(year, month - 1, 20), ref = { snapshotId: 'monthly-wuqu-' + year + '-' + month, chart: chart(native({ dateStr, timeIndex })) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'monthly-wuqu', ref);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === theme);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data.branch, branch);
    assert.deepEqual(data.annualLucunContacts, lu ? [lu] : []);
    assert.equal(data.annualLucunCandidate, Boolean(lu));
    assert.deepEqual(data.wealthWuquChanges, wealth ?? []);
    assert.equal(data.wealthWuquFavorableCandidate, Boolean(wealth));
    assert.deepEqual(data.careerWuquGroups, career ?? []);
    assert.equal(data.careerWuquLuQuanKeCandidate, Boolean(career));
    const passage = theme === '财帛' ? 'p063' : 'p067';
    const result = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.windows, [{ start, endExclusive }]);
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-wuqu'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(text), text);
    if (theme === '官禄' && year === 2021) assert.doesNotMatch(prompt, /同一.+所发的科权禄均会本宫/u);
    assert.doesNotMatch(prompt, /wealthWuquChanges|careerWuquGroups|annualLucunContacts/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
  }
});

test('career Doujun only qualifies a temple Wuqu with one verified transformation group', () => {
  const natal = native({ dateStr: '1970-01-02', timeIndex: 3 });
  const window = { start: Date.parse('2024-06-19T00:00:00Z'), end: Date.parse('2024-06-20T00:00:00Z') };
  const evaluate = chart => buildQuanshuDoujunMonths(window, chart)[0].data;
  assert.equal(evaluate(natal).careerWuquLuQuanKeCandidate, true);
  const split = buildQuanshuDoujunMonths({
    start: Date.parse('2021-09-19T00:00:00Z'), end: Date.parse('2021-09-20T00:00:00Z'),
  }, natal)[0].data;
  // Ji-stem Lu and Quan both guard Chou, and Xin-stem Ke opposes it.
  assert.equal(split.branch, '丑');
  assert.equal(split.natalName, '官禄');
  for (const [star, branch] of [['武曲', '丑'], ['贪狼', '丑'], ['天梁', '辰'], ['巨门', '寅'], ['太阳', '寅'], ['文曲', '未']]) {
    assert.equal(natal.palaces.find(palace => all(palace).some(row => row.name === star)).earthlyBranch, branch);
  }
  assert.equal(split.careerWuquLuQuanKeCandidate, false);
  assert.deepEqual(split.careerWuquGroups, []);

  const corrupted = structuredClone(natal);
  const lianzhen = corrupted.palaces.flatMap(palace => palace.majorStars).find(star => star.name === '廉贞');
  corrupted.palaces.find(palace => palace.earthlyBranch === '辰').adjectiveStars.push(lianzhen);
  assert.equal(evaluate(corrupted).careerWuquLuQuanKeCandidate, undefined);
  assert.deepEqual(evaluate(corrupted).careerWuquGroups, []);
});

test('both Doujun monthly passages carry their named Volume II temple guards from client facts into SQLite and Chinese input', () => {
  for (const [dateStr, hour, month, natalName, branch, star, from, to] of [
    ['1970-01-02', 5, 4, '财帛', '卯', '太阳', '2026-04-16T16:00:00.000Z', '2026-04-30T16:00:00.000Z'],
    ['1988-10-22', 4, 2, '财帛', '寅', '太阴', '2026-02-16T16:00:00.000Z', '2026-02-28T16:00:00.000Z'],
    ['1988-10-22', 2, 2, '官禄', '子', '太阴', '2026-02-16T16:00:00.000Z', '2026-02-28T16:00:00.000Z'],
    ['1988-10-22', 8, 2, '官禄', '午', '天机', '2026-02-16T16:00:00.000Z', '2026-02-28T16:00:00.000Z'],
  ]) {
    const natal = native({ dateStr, timeIndex: hour });
    const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month } };
    const now = Date.UTC(2026, month - 1, 20), ref = { snapshotId: 'doujun-temple-' + natalName + '-' + star };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'doujun-temple', ref);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === natalName);
    assert.equal(fact.normalizedPayload.templeSupportCandidate, true);
    assert.deepEqual(fact.normalizedPayload.templeSupportContacts, [{ star, branch, grade: '庙', relation: '守' }]);
    const passage = natalName === '财帛' ? 'p063' : 'p067';
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('-' + passage + '-001'));
    const hit = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.windows, [{ start: from, endExclusive: to }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'doujun-temple'));
    assert.ok(formatFortuneFactAudit(input).includes('卷二列本命' + star + '在' + branch + '宫入庙，实际与斗君同守本月' + natalName + '宫'));
  }
});

test('Doujun monthly temple guards require the printed grade and unique major, and Fire/Bell require verified archive coordinates', () => {
  const noTemple = calculate(chart(native({ timeIndex: 1 })), 'month', 2026, 10).facts.find(row =>
    row.factType === 'quanshu_doujun_month' && row.normalizedPayload.natalName === '财帛').normalizedPayload;
  assert.equal(noTemple.branch, '子');
  assert.deepEqual(noTemple.templeSupportContacts, []);
  assert.equal(noTemple.templeSupportCandidate, false);

  const natal = native({ dateStr: '1970-01-02', timeIndex: 5 });
  const window = { start: Date.parse('2026-04-20T00:00:00Z'), end: Date.parse('2026-04-21T00:00:00Z') };
  const moon = candidate => buildQuanshuDoujunMonths(window, candidate)[0].data;
  const baseline = moon(natal);
  assert.ok(Array.isArray(baseline.archivedFireBellContacts));
  assert.equal(baseline.templeSupportCandidate, true);
  const duplicate = structuredClone(natal), palace = duplicate.palaces.find(p => p.earthlyBranch === '卯');
  palace.majorStars.push({ ...palace.majorStars.find(row => row.name === '太阳') });
  assert.equal(moon(duplicate).templeSupportCandidate, undefined);
  const bellPalace = natal.palaces.find(p => all(p).some(row => row.name === '铃星'));
  const bell = all(bellPalace).find(row => row.name === '铃星');
  for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) bellPalace[key] = bellPalace[key].filter(row => row.name !== '铃星');
  natal.palaces[(bellPalace.index + 1) % 12].adjectiveStars.push(bell);
  const displaced = moon(natal);
  assert.equal(displaced.archivedFireBellContacts, undefined);
  assert.equal(displaced.templeSupportCandidate, true);
});

test('wealth Doujun retains a common Void, Hao and Ji palace through the client and keeps split positions distinct', () => {
  const wealth = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('-p063-001')).knowledgeId;
  const byRule = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === wealth);
  const params = { periodType: 'month', targetPeriod: { year: 2024, month: 12 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2024-12-19T03:00:00Z');
  const reference = { snapshotId: 'doujun-common-palace', chart: chart(native({ timeIndex: 1 })) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'doujun-common-palace', reference);
  const result = byRule(run), fact = run.facts.find(row => row.factId === result.sourceFactIds[0]);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.windows, [{ start: '2024-11-30T16:00:00.000Z', endExclusive: '2024-12-30T16:00:00.000Z' }]);
  assert.deepEqual(fact.normalizedPayload.voidHaoJiTogether, [{ star: '地劫', branch: '子', relation: '守',
    haoLabels: ['本命岁前大耗'], jiStars: [{ label: '流年干化忌', star: '太阳' }] }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'doujun-common-palace'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /地劫、本命岁前大耗、流年干化忌的太阳实际同在子宫，与本月斗君宫为守/u);
  assert.doesNotMatch(prompt, /voidHaoJiTogether|supportCandidate/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== wealth)));

  const incompleteNatal = native({ timeIndex: 1 });
  const skySeat = incompleteNatal.palaces.find(row => row.minorStars.some(star => star.name === '地空'));
  skySeat.minorStars = skySeat.minorStars.filter(star => star.name !== '地空');
  const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const partialVoids = buildQuanshuDoujunMonths(window, incompleteNatal)[0].data;
  assert.equal(partialVoids.voidContactsComplete, false);
  assert.deepEqual(partialVoids.voidContacts, [{ star: '地劫', branch: '子', relation: '守' }]);
  assert.deepEqual(partialVoids.voidHaoJiTogether, fact.normalizedPayload.voidHaoJiTogether);
  const isolatedSha = { ...partialVoids, supportCandidate: false, templeSupportCandidate: false, annualLucunCandidate: false,
    wealthWuquFavorableCandidate: false, haoCandidate: false, jiCandidate: false, wealthNamedGuardCandidate: false,
    jumenTianjiSameSeatCandidate: false, namedPairGuardCandidate: false };
  const incompleteRun = { ...run, facts: [{ ...fact, normalizedPayload: isolatedSha }] };
  assert.equal(byRule(incompleteRun).status, 'partial');
  const incompleteInput = buildFortuneModelContext(incompleteRun,
    interpretFortune(incompleteRun, requestForFortuneRun(incompleteRun), 'doujun-incomplete-void')).input;
  assert.match(formatFortuneFactAudit(incompleteInput), /空劫至少一项本命位置待核，已确认的会照仍保留/u);
  assert.doesNotMatch(formatFortunePrompt(incompleteInput), /空劫至少一项本命位置待核|natalAdversityProof/u);
  assert.equal(byRule({ ...run, facts: [{ ...fact, normalizedPayload: { ...isolatedSha, natalAdversityProof: undefined } }] }).status, 'unknown');

  const natalHao = incompleteNatal.palaces.find(row => row.suiqian12 === '大耗');
  const otherHao = incompleteNatal.palaces.find(row => row.earthlyBranch === '寅');
  [natalHao.suiqian12, otherHao.suiqian12] = [otherHao.suiqian12, natalHao.suiqian12];
  const displacedHao = buildQuanshuDoujunMonths(window, incompleteNatal)[0].data;
  assert.equal(displacedHao.suiqianHaoContacts, undefined);
  assert.deepEqual(displacedHao.voidHaoJiTogether, []);

  const different = calculate(chart(native({ timeIndex: 1 })), 'month', 2027, 9);
  const separated = different.facts.find(row => row.factId === byRule(different).sourceFactIds[0]).normalizedPayload;
  assert.deepEqual(separated.voidContacts.map(row => row.branch), ['子']);
  assert.deepEqual(separated.suiqianHaoContacts.map(row => row.branch), ['子']);
  assert.deepEqual(separated.annualJiContacts.map(row => row.branch), ['辰']);
  assert.deepEqual(separated.voidHaoJiTogether, []);

  const trine = calculate(chart(native({ dateStr: '1998-05-05', timeIndex: 3, gender: '男' })), 'month', 2032, 12);
  const aspected = trine.facts.find(row => row.factId === byRule(trine).sourceFactIds[0]).normalizedPayload;
  assert.equal(aspected.branch, '戌');
  assert.deepEqual(aspected.voidHaoJiTogether, [{ star: '地劫', branch: '寅', relation: '三合',
    haoLabels: ['本命博士十二神大耗'], jiStars: [{ label: '流年干化忌', star: '武曲' }] }]);
  const mislaidBoshi = native({ dateStr: '1998-05-05', timeIndex: 3, gender: '男' });
  const rightBoshi = mislaidBoshi.palaces.find(row => row.boshi12 === '大耗');
  const otherBoshi = mislaidBoshi.palaces.find(row => row.earthlyBranch === '午');
  assert.equal(rightBoshi.earthlyBranch, '寅');
  [rightBoshi.boshi12, otherBoshi.boshi12] = [otherBoshi.boshi12, rightBoshi.boshi12];
  const missedBoshi = buildQuanshuDoujunMonths({ start: Date.parse(aspected.nativeStart), end: Date.parse(aspected.nativeEnd) }, mislaidBoshi)[0].data;
  assert.equal(missedBoshi.boshiHaoContacts, undefined);
  assert.deepEqual(missedBoshi.voidHaoJiTogether, []);
});

test('all three annual source fact types and the monthly timeline reach Chinese input without raw objects or partial findings', () => {
  const run = real(reference.examples[3]), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'year-prompt'));
  for (const type of ['quanshu_doujun_context', 'quanshu_kuxu_condition', 'quanshu_shangshi_condition']) {
    const fact = input.facts.find(f => f.type === type); assert.ok(fact, type);
    const text = describeFortuneFact(fact, String); assert.ok(text);
    assert.ok(!/[{}\[\]]|quanshu-|allThreeSamePalace|sourceQualities|yearly|decadal/u.test(text));
  }
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['逆数至生月4月', '不是直接拿普通流月命宫替代', '不自动判为陷地', '原文遇禄的发化或禄存盘层', '十四主星均核归档唯一位置']) assert.ok(prompt.includes(phrase), phrase);
  assert.match(prompt, /农历1月的窗内片段[^；]+斗君顺推至巳宫/u);
  assert.match(prompt, /本段月限取法未核定/u);
  assert.ok(!prompt.includes('monthTimeline'));
  for (const n of [19, 40, 41, 44, 52]) assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === ruleNumber(n).knowledgeId));
});
