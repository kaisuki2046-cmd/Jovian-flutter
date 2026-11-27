import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import * as LunarPackage from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt, describeFortuneFact } from './control/fortune-prompt.mjs';
const { quanshuAuxiliaryPositions, readQuanshuSupportNatal, quanshuMingGroupsFromVerifiedLimits, quanshuSupportCondition,
  bindQuanshuSupportScopes, quanshuSupportPolicy } = await import('./control/ziwei-source-support.ts');
const { quanshuLiteraryLimits, quanshuLiteraryLimitsPolicy, quanshuLumingChangBranch } = await import('./control/ziwei-literary-limits.ts');
const { quanshuTransformLimits } = await import('./control/ziwei-transform-limits.ts');
const { quanshuLimitBranches, quanshuLimitBranchesPolicy } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitTiming, quanshuLimitTimingPolicy } = await import('./control/ziwei-limit-timing.ts');
const { quanshuSolarWuPoLimits } = await import('./control/ziwei-solar-wu-po-limits.ts');
const { quanshuTimedBody, quanshuTimedLianzhen, quanshuTimedPo, quanshuTimedSupport, quanshuTimedTempleChangQu,
  quanshuTimedTianji, quanshuTimedTong, quanshuTimedWu } = await import('./control/ziwei-timed-limit-conditions.ts');
const { quanshuBodyLimitEncounters } = await import('./control/ziwei-body-limit-encounters.ts');
const { quanshuLimitVerseContacts } = await import('./control/ziwei-limit-verse-contacts.ts');
const { quanshuXingJiTiger } = await import('./control/ziwei-xing-ji-tiger.ts');
const { quanshuShangShiLimits } = await import('./control/ziwei-shangshi-limits.ts');
const { quanshuLimitPhase, quanshuLunarMidnight } = await import('./control/ziwei-quanshu.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-support-reference.json', import.meta.url)));
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const native = (example = {}) => astro.withOptions({ dateStr: '1990-05-05', timeIndex: 2, gender: '女', ...example, fixLeap: true, config }).toJSON();
const stars = palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const position = (natal, star) => natal.palaces.find(p => stars(p).some(s => s.name === star));
function withWrongStarLayer(natal, names, from, to) {
  const copy = structuredClone(natal);
  for (const name of names) {
    const palace = position(copy, name);
    const star = palace[from].find(row => row.name === name);
    assert.ok(star, name);
    palace[from] = palace[from].filter(row => row !== star);
    palace[to].push(star);
  }
  return copy;
}
const chart = (natal = native()) => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot = chart(), year = 2026) {
  const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  return calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server'), 'support-run', { snapshotId: 'support-snapshot', chart: snapshot });
}
const cache = new Map();
const realRun = example => {
  const key = [example.dateStr, example.timeIndex, example.gender, example.year].join(':');
  if (!cache.has(key)) cache.set(key, calculate(chart(native(example)), example.year));
  return cache.get(key);
};
const specific = run => run.facts.filter(f => f.factType === 'quanshu_support_condition');
const timedSupport = f => f.factType === 'quanshu_timed_limit_condition'
  && f.normalizedPayload.sourceFactType === 'quanshu_support_condition';
const result = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === id);
function isolateSupport(run, fact) {
  return { ...run, facts: run.facts.filter(row => timedSupport(row)
    ? row.scope === fact.scope && row.normalizedPayload.lunarYear === fact.normalizedPayload.lunarYear
      && row.normalizedPayload.branch === fact.normalizedPayload.branch
    : row.factType !== fact.factType || row.factId === fact.factId) };
}
const literaryRules = ['wenchang-limit-p059', 'huake-limit-p059', 'expansion-p021', 'expansion-p010'].map(suffix =>
  fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(suffix + '-001')));
const branchRules = ['expansion-p043', 'expansion-p045', 'expansion-p033'].map(suffix =>
  fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(suffix + '-001')));
const supportExamples = reference.examples.filter(example => ![...literaryRules, ...branchRules].some(rule => rule.knowledgeId === example.knowledgeId));
const literaryFact = (run, year) => run.facts.find(f => f.factType === 'quanshu_literary_limits' && f.normalizedPayload.lunarYear === year);

test('eleven source rules share one birthday anchor without losing independently located auxiliary stars', () => {
  const cases = [
    ['archive-sun-limit-p059', 'solar', 'sunMingBrightDoubleGuardCandidate', '1990-02-15', 0, '男', 2000],
    ['expansion-p003', 'verse', 'xiangIdleMingClearDoubleGuardCandidate', '1990-05-05', 10, '女', 2026],
    ['expansion-p005', 'tiger', 'parentMoonYearContactsCandidate', '1990-11-05', 4, '女', 2007],
    ['expansion-p020', 'solar', 'sunMingDimPairDoubleGuard', '1988-05-15', 3, '女', 2050],
    ['expansion-p030', 'verse', 'yinMingSingleGuardWithoutFireBellCandidate', '1980-03-15', 2, '女', 1991],
    ['expansion-p031', 'verse', 'yinVolumeThreeNativeTrineDoubleGuardCandidate', '1991-02-16', 3, '女', 2048],
    ['expansion-p040', 'shangshi', 'tianshangMingNamedReliefCandidate', '1970-01-05', 9, '女', 2028],
    ['expansion-p041', 'shangshi', 'tianshiMingNamedReliefCandidate', '1954-11-05', 1, '女', 2013],
    ['expansion-p043', 'branches', 'annualOpposedDecadalVerifiedFullReliefCandidate', '1990-07-19', 3, '女', 2027],
    ['expansion-p047', 'tiger', 'mingQishaNatalLucunOffTaiSuiCandidate', '1987-05-15', 1, '女', 2012],
    ['expansion-p048', 'tiger', 'qishaQuanshuFixedNatalBladeTigerCandidate', '1991-02-23', 5, '女', 2022],
  ];
  const producers = {
    solar: (limits, natal, frame) => quanshuSolarWuPoLimits(limits, quanshuTransformLimits(natal, frame)),
    verse: quanshuLimitVerseContacts,
    tiger: (limits, natal, frame) => quanshuXingJiTiger(natal, frame.yearIndex, limits),
    shangshi: quanshuShangShiLimits,
    branches: limits => limits,
  };
  for (const [suffix, producer, field, dateStr, timeIndex, gender, lunarYear] of cases) {
    const birth = { dateStr, timeIndex, gender }, engine = astro.withOptions({ ...birth, fixLeap: true, config });
    const natal = engine.toJSON(), h = engine.horoscope(`${lunarYear}-06-01`, 6);
    const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    const limits = quanshuLimitBranches(natal, frame);
    const known = producers[producer](limits, natal, frame);
    assert.equal(limits.ziweiBirthAnchorVerified, true, suffix);
    assert.equal(known[field], true, suffix);

    const previousDay = new Date(Date.parse(dateStr + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
    const followingDay = new Date(Date.parse(dateStr + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
    const neighboringDays = [followingDay, previousDay].map(dateStr => native({ ...birth, dateStr }));
    const wrongDay = neighboringDays.map(adjacent => ({ ...natal, solarDate: adjacent.solarDate,
      rawDates: { ...natal.rawDates, lunarDate: adjacent.rawDates.lunarDate } }))
      .find(adjacent => quanshuLimitBranches(adjacent, frame).ziweiBirthAnchorVerified === false);
    assert.ok(wrongDay, suffix);
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(suffix + '-001'));
    const getQuery = normalizedPayload => {
      const fact = { factId: suffix, factType: rule.queries[0].factType, scope: 'yearly', method: 'ziwei', completeness: 'complete', normalizedPayload,
        activeFrom: new Date(quanshuLunarMidnight(lunarYear, 1)).toISOString(),
        activeTo: new Date(quanshuLunarMidnight(lunarYear + 1, 1)).toISOString() };
      const match = evaluateFortuneRules('ziwei', 'year', [fact]).find(row => row.knowledgeId === rule.knowledgeId);
      return match.confirmations.find(row => row.condition.includes(field)) ?? match.required[0];
    };
    assert.equal(getQuery(known).hits.length, 1, suffix);

    const missingDate = { ...natal, solarDate: '' };
    const unresolvedArchives = [[wrongDay, false]];
    if (natal.rawDates.lunarDate.isLeap) assert.equal(quanshuLimitBranches(missingDate, frame).ready, false, suffix);
    else unresolvedArchives.push([missingDate, undefined]);
    for (const [archive, verification] of unresolvedArchives) {
      const unresolvedLimits = quanshuLimitBranches(archive, frame);
      const unresolved = producers[producer](unresolvedLimits, archive, frame);
      assert.equal(unresolvedLimits.ziweiBirthAnchorVerified, verification, suffix);
      assert.deepEqual(unresolvedLimits.verifiedMajorBranches, limits.verifiedMajorBranches, suffix);
      assert.ok(Object.values(unresolvedLimits.birthAnchoredMajorBranches).every(branch => branch === undefined), suffix);
      assert.deepEqual(unresolvedLimits.verifiedBellNatalAid, limits.verifiedBellNatalAid, suffix);
      assert.deepEqual(unresolvedLimits.sourceDecadal, limits.sourceDecadal, suffix);
      assert.deepEqual(unresolvedLimits.sourceMinor, limits.sourceMinor, suffix);
      assert.equal(unresolved[field], undefined, suffix);
      assert.deepEqual([getQuery(unresolved).hits.length, getQuery(unresolved).unknown], [0, true], suffix);
    }
  }
});

function literarySlice(example) {
  const run = realRun(example);
  validateFortuneFacts(run);
  const fact = literaryFact(run, example.year);
  assert.ok(fact);
  return { run: { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) },
    fact, data: fact.normalizedPayload };
}

function copyChartWithShiftedDecade(natal, frame) {
  const archive = structuredClone(natal);
  const palace = archive.palaces.find(row => row.index === frame.decadalIndex);
  const age = frame.lunarYear - archive.rawDates.lunarDate.lunarYear + 1;
  const offset = palace.decadal.range[1] === age ? 1 : -1;
  palace.decadal.range = palace.decadal.range.map(value => value + offset);
  assert.equal(quanshuLimitPhase(archive, frame.decadalIndex, age,
    quanshuLunarMidnight(frame.lunarYear, 1)).ready, true);
  return archive;
}

test('p021 finds named trines at the common Tai Sui and verified minor seat when Jielan Chang guards natal life', () => {
  const example = { dateStr: '1947-02-05', timeIndex: 3, year: 1990 };
  const { run, fact, data } = literarySlice(example), knowledgeId = literaryRules[2].knowledgeId;
  assert.deepEqual([data.lifeBranch, data.annualBranch, data.minorBranch, data.decadalBranch], ['亥', '午', '午', '卯']);
  for (const key of ['movingChangQuCandidate', 'movingChangQuAssistantCandidate', 'movingChangQuNamedTrinesCandidate',
    'movingChangQuNatalTransformCandidate', 'movingChangQuSourceSeatsCandidate']) assert.equal(data[key], false);
  assert.equal(data.movingChangQuLifeAndCommonMinorTrinesCandidate, true);
  assert.deepEqual(data.movingChangQuCommonMinorTrineWitness, { lifeBranch: '亥', commonBranch: '午',
    moving: [{ star: '流昌', branch: '亥', relation: '守' }, { star: '流曲', branch: '卯', relation: '三合' }],
    trines: [{ star: '右弼', branch: '戌', relation: '三合' }, { star: '魁钺组', branch: '戌', relation: '三合' }],
  });
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jielan-annual-chang-trines'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /《捷览》按年干排的流昌实守本命亥宫/u);
  assert.match(audit, /复算小限与太岁同守午宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /《捷览》按年干排的流昌|movingChangQuCommonMinorTrineWitness/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
  const incorrectProfile = { ...fact, normalizedPayload: { ...data, jielanAnnualChangProfile: 'unverified' } };
  assert.equal(result({ ...run, facts: [incorrectProfile] }, knowledgeId).status, 'not_matched');
  for (const [year, annual, minor] of [[1989, '巳', '未'], [1991, '未', '巳']]) {
    const adjacent = literarySlice({ ...example, year });
    assert.deepEqual([adjacent.data.annualBranch, adjacent.data.minorBranch], [annual, minor]);
    assert.equal(adjacent.data.movingChangQuLifeAndCommonMinorTrinesCandidate, false);
    assert.equal(result(adjacent.run, knowledgeId).status, 'not_matched');
  }

  const natal = native(example), byBranch = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const frame = { lunarYear: 1990, yearIndex: byBranch('午'), decadalIndex: byBranch('卯'), minorIndex: byBranch('午') };
  const partialMoves = [{ branch: '亥', movingStarIds: ['流昌'] }];
  assert.equal(quanshuLiteraryLimits(natal, quanshuTransformLimits(natal, frame), partialMoves)
    .movingChangQuLifeAndCommonMinorTrinesCandidate, undefined);
  const moves = [...partialMoves, { branch: '卯', movingStarIds: ['流曲'] }];
  assert.equal(quanshuLiteraryLimits(natal, quanshuTransformLimits(natal, { ...frame, minorIndex: undefined }), moves)
    .movingChangQuLifeAndCommonMinorTrinesCandidate, undefined);
});

test('p021 admits both moving literary stars trining the shared actual limits with Sun and the distinct annual Lu recipient', () => {
  const example = { dateStr: '1961-03-23', timeIndex: 2, year: 1967 };
  const natal = native(example), knowledgeId = literaryRules[2].knowledgeId;
  const bound = submitYear(natal, example.year, 'moving-literary-double-trines');
  const fact = literaryFact(bound, example.year), data = fact.normalizedPayload;
  assert.deepEqual([data.lifeBranch, data.decadalBranch, data.minorBranch, data.sourceMinor.verified], ['丑', '丑', '丑', true]);
  assert.equal(data.movingChangQuBothLimitsTrineCandidate, true);
  assert.equal(data.movingChangQuSharedLimitsGuardLife, true);
  assert.equal(data.movingChangQuAnnualHuaLuTrineConfirmed, true);
  assert.deepEqual(data.movingChangQuBothLimitsTrineWitness, {
    branch: '丑', lifeBranch: '丑', annualStem: '丁',
    moving: [{ star: '流昌', branch: '酉', relation: '三合' }, { star: '流曲', branch: '巳', relation: '三合' }],
    sun: { star: '太阳', branch: '酉', relation: '三合' },
    annualLu: { kind: '化禄', star: '太阴', branch: '巳', relation: '三合' },
    annualChangAgreement: { annualStem: '丁', jielanBranch: '酉', lumingBranch: '酉', agrees: true },
  });
  assert.deepEqual(data.limits[0].annualLu.find(row => row.kind === '禄存'),
    { kind: '禄存', star: '禄存', branch: '午', relation: '其他' });
  for (const key of ['movingChangQuCandidate', 'movingChangQuAssistantCandidate', 'movingChangQuNamedTrinesCandidate',
    'movingChangQuNatalTransformCandidate', 'movingChangQuSourceSeatsCandidate',
    'movingChangQuLifeAndCommonMinorTrinesCandidate']) assert.equal(data[key], false, key);
  const run = { ...bound, facts: [fact] };
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大小二限逢之，三合拱照太阳，又照流年禄');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const wrongProfile = { ...fact, normalizedPayload: { ...data, jielanAnnualChangProfile: 'unverified' } };
  assert.equal(result({ ...run, facts: [wrongProfile] }, knowledgeId).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'moving-literary-double-trines'));
  assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === knowledgeId)));
  assert.match(formatFortuneFactAudit(input), /大限与复算小限实守丑宫，流昌和流曲从不同宫三合到会/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按周德元所释，流年禄取该农历年天干的化禄受曜/u);
  assert.doesNotMatch(prompt, /movingChangQuBothLimitsTrineWitness|大限与复算小限实守丑宫|决然高中无疑/u);

  for (const year of [1966, 1968]) {
    const adjacent = literarySlice({ ...example, year });
    assert.equal(adjacent.data.movingChangQuBothLimitsTrineCandidate, false);
    assert.equal(result(adjacent.run, knowledgeId).status, 'not_matched');
  }
  const byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: example.year, yearIndex: byBranch('未'), decadalIndex: byBranch('丑'), minorIndex: byBranch('丑') };
  const moves = [{ branch: '酉', movingStarIds: ['流昌'] }, { branch: '巳', movingStarIds: ['流曲'] }];
  const wrongMinor = quanshuTransformLimits(natal, { ...frame, minorIndex: byBranch('寅') });
  assert.equal(quanshuLiteraryLimits(natal, wrongMinor, moves).movingChangQuBothLimitsTrineCandidate, undefined);
  const wrongDecade = copyChartWithShiftedDecade(natal, frame);
  const unverified = quanshuLiteraryLimits(wrongDecade, quanshuTransformLimits(wrongDecade, frame), moves);
  assert.deepEqual(unverified.sourceDecadal, { branch: '丑', verified: false });
  assert.equal(unverified.sourceMinor.verified, true);
  assert.deepEqual(unverified.limits.map(row => row.layer), ['minor']);
  assert.equal(unverified.movingChangQuBothLimitsTrineCandidate, undefined);
  assert.equal(unverified.movingChangQuBothLimitsTrineWitness, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, knowledgeId).status, 'unknown');
  const { limitEncounterProof, ...oldPayload } = data;
  assert.equal(limitEncounterProof, 'quanshu-literary-verified-limit-witnesses-v1');
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: oldPayload }] }, knowledgeId).status, 'unknown');
  const expectedLimits = quanshuTransformLimits(natal, frame);
  for (const unresolvedMoves of [moves.slice(0, 1), [{ branch: '酉', movingStarIds: ['流昌', '流曲'] }]]) {
    assert.equal(quanshuLiteraryLimits(natal, expectedLimits, unresolvedMoves).movingChangQuBothLimitsTrineCandidate, undefined);
  }
  const wrongSun = withWrongStarLayer(natal, ['太阳'], 'majorStars', 'minorStars');
  const wrongLayer = quanshuLiteraryLimits(wrongSun, quanshuTransformLimits(wrongSun, frame), moves);
  assert.equal(wrongLayer.sun, undefined);
  assert.equal(wrongLayer.movingChangQuBothLimitsTrineCandidate, undefined);
  assert.equal(wrongLayer.movingChangQuBothLimitsTrineWitness, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, knowledgeId).status, 'unknown');
});

test('p021 keeps a real shared limit trining natal life as a candidate without claiming the limits guard life', () => {
  const example = { dateStr: '1959-02-20', timeIndex: 9, gender: '男', year: 2007 };
  const natal = native(example), knowledgeId = literaryRules[2].knowledgeId;
  const bound = submitYear(natal, example.year, 'moving-literary-shared-limit-away-from-life');
  const fact = literaryFact(bound, example.year), data = fact.normalizedPayload;
  assert.deepEqual([data.lifeBranch, data.decadalBranch, data.minorBranch], ['巳', '丑', '丑']);
  assert.equal(data.sourceDecadal.verified, true);
  assert.equal(data.sourceMinor.verified, true);
  assert.equal(data.movingChangQuBothLimitsTrineCandidate, true);
  assert.deepEqual(data.movingChangQuBothLimitsTrineWitness, {
    branch: '丑', lifeBranch: '巳', annualStem: '丁',
    moving: [{ star: '流昌', branch: '酉', relation: '三合' }, { star: '流曲', branch: '巳', relation: '三合' }],
    sun: { star: '太阳', branch: '巳', relation: '三合' },
    annualLu: { kind: '化禄', star: '太阴', branch: '酉', relation: '三合' },
    annualChangAgreement: { annualStem: '丁', jielanBranch: '酉', lumingBranch: '酉', agrees: true },
  });
  assert.equal(data.movingChangQuSharedLimitsGuardLife, false);
  assert.equal(data.movingChangQuAnnualHuaLuTrineConfirmed, false);
  const run = { ...bound, facts: [fact] };
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'literary-away-from-life'));
  assert.match(formatFortuneFactAudit(input), /大限与复算小限实守丑宫，流昌和流曲从不同宫三合到会/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
  assert.doesNotMatch(formatFortunePrompt(input), /复核的大小限均在本命命宫|按周德元所释|实守丑宫/u);
});

test('the named Horse trines and natal Lu Ke Quan verify their two actual limits and keep adjacent years outside confirmation', () => {
  const cases = [
    { dateStr: '1950-02-19', timeIndex: 0, year: 2018, suffix: 'p010-001', type: 'quanshu_literary_limits',
      flag: 'horseChangZiFuTrineDoubleGuardCandidate', witness: 'horseChangZiFuTrineDoubleGuardWitness',
      phrase: /紫微和天府分别从两个三合宫来会/u,
      expected: { branch: '申', annualStem: '戊', stars: [
        { star: '本命天马', branch: '申', relation: '守' }, { star: '本命禄存', branch: '申', relation: '守' },
        { star: '紫微', branch: '辰', relation: '三合' }, { star: '天府', branch: '子', relation: '三合' },
        { star: '流昌', branch: '申', relation: '守' },
      ], annualChangAgreement: { annualStem: '戊', jielanBranch: '申', lumingBranch: '申', agrees: true } } },
    { dateStr: '1961-08-30', timeIndex: 4, year: 2008, suffix: 'p015-001', type: 'quanshu_transform_limits',
      flag: 'femaleNatalLuKeQuanDoubleGuardCandidate', witness: 'femaleNatalLuKeQuanDoubleGuardWitness',
      phrase: /同一生年干的三颗化禄、化权、化科受曜都实守此宫/u,
      expected: { branch: '申', palace: '官禄', stem: '辛', stars: [
        { star: '巨门', kind: '禄', branch: '申' }, { star: '太阳', kind: '权', branch: '申' },
        { star: '文曲', kind: '科', branch: '申' },
      ] } },
    { dateStr: '1961-04-30', timeIndex: 10, year: 2050, suffix: 'p015-001', type: 'quanshu_transform_limits',
      flag: 'femaleNatalLuKeQuanDoubleGuardCandidate', witness: 'femaleNatalLuKeQuanDoubleGuardWitness',
      phrase: /同守本命命宫、身宫或官禄宫之一/u,
      expected: { branch: '寅', palace: '身宫', stem: '辛', stars: [
        { star: '巨门', kind: '禄', branch: '寅' }, { star: '太阳', kind: '权', branch: '寅' },
        { star: '文曲', kind: '科', branch: '寅' },
      ] } },
  ];
  for (const { dateStr, timeIndex, year, suffix, type, flag, witness, phrase, expected } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = engine.toJSON(), submitted = submitYear(natal, year, 'literary-and-transform-double-' + year);
    const fact = submitted.facts.find(row => row.factType === type && row.normalizedPayload.lunarYear === year);
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(`expansion-${suffix}`));
    const run = { ...submitted, facts: [fact] };
    assert.equal(fact.normalizedPayload[flag], true);
    assert.deepEqual(fact.normalizedPayload[witness], expected);
    const hit = result(run, rule.knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-double-guard'));
    assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule.knowledgeId));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, phrase);
    assert.ok(!prompt.includes(flag) && !prompt.includes(expected.branch + '宫'));
    if (type === 'quanshu_transform_limits') {
      assert.equal(hit.matchedSourceExcerpt, '二限逢之');
      assert.match(prompt, /二限逢之/u);
      assert.doesNotMatch(prompt, /命妇|杀凑平常/u);
    }

    const frame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-01`, 6);
      return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    };
    const current = frame(year), next = frame(year + 1);
    const produce = (archive, slice, moving = '申') => {
      const transforms = quanshuTransformLimits(archive, slice);
      return type === 'quanshu_transform_limits' ? transforms
        : quanshuLiteraryLimits(archive, transforms, [{ branch: moving, movingStarIds: ['流昌'] }]);
    };
    const check = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload }])
      .find(row => row.knowledgeId === rule.knowledgeId).confirmations.find(row => row.condition.includes(flag));
    const adjacent = check(produce(natal, next, '酉'));
    assert.deepEqual([adjacent.hits.length, adjacent.unknown], [0, false]);
    const wrong = check(produce(copyChartWithShiftedDecade(natal, current), current));
    assert.deepEqual([wrong.hits.length, wrong.unknown], [0, true]);
    const star = type === 'quanshu_transform_limits' ? '文曲' : '天马';
    const wrongLayer = check(produce(withWrongStarLayer(natal, [star], 'minorStars', 'adjectiveStars'), current));
    assert.deepEqual([wrongLayer.hits.length, wrongLayer.unknown], [0, true]);
    if (type === 'quanshu_literary_limits') {
      const tomorrow = native({ dateStr: '1950-02-20', timeIndex, gender: '女' });
      const shiftedBirthday = { ...natal, solarDate: tomorrow.solarDate,
        rawDates: { ...natal.rawDates, lunarDate: tomorrow.rawDates.lunarDate } };
      const wrongBirthDay = produce(shiftedBirthday, current);
      assert.equal(wrongBirthDay.keMajorBirthAnchorVerified, false);
      assert.deepEqual([wrongBirthDay.sourceDecadal.verified, wrongBirthDay.sourceMinor.verified, wrongBirthDay.lumingChang,
        wrongBirthDay.limits[0].horseCompanions.find(row => row.star === '流昌').branch], [true, true, '申', '申']);
      const hit = check(wrongBirthDay);
      assert.deepEqual([hit.hits.length, hit.unknown, wrongBirthDay[witness]], [0, true, undefined]);
    }
    if (expected.palace === '身宫') {
      const body = natal.palaces.find(row => row.isBodyPalace);
      assert.deepEqual([body.name, body.earthlyBranch, current.decadalIndex, current.minorIndex],
        ['财帛', '寅', body.index, body.index]);
      const wrongBody = structuredClone(natal);
      for (const palace of wrongBody.palaces) palace.isBodyPalace = palace.earthlyBranch === '卯';
      wrongBody.earthlyBranchOfBodyPalace = '卯';
      const wrongBodyResult = produce(wrongBody, current);
      const missingBody = check(wrongBodyResult);
      assert.deepEqual([missingBody.hits.length, missingBody.unknown, wrongBodyResult[witness]], [0, true, undefined]);
      // Candidate support is still returned, but the altered body position cannot confirm this route.
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongBodyResult }] }, rule.knowledgeId).status, 'partial');
    }
  }
});

test('p010 confirms the real opposite Zi Fu at the same two Horse limits', () => {
  const dateStr = '1950-02-21', timeIndex = 0, year = 2018;
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), knowledgeId = literaryRules[3].knowledgeId;
  const submitted = submitYear(natal, year, 'literary-horse-opposite-zi-fu');
  const fact = literaryFact(submitted, year), data = fact.normalizedPayload;
  const isolated = normalizedPayload => ({ ...submitted, facts: [{ ...fact, normalizedPayload }] });
  const field = 'horseChangZiFuOpposedDoubleGuardCandidate';
  assert.equal(data[field], true);
  assert.equal(data.horseChangDoubleGuardAgreementCandidate, false);
  assert.equal(data.horseChangZiFuTrineDoubleGuardCandidate, false);
  assert.deepEqual(data.horseChangZiFuOpposedDoubleGuardWitness, {
    branch: '申', annualStem: '戊', stars: [
      { star: '本命天马', branch: '申', relation: '守' }, { star: '本命禄存', branch: '申', relation: '守' },
      { star: '紫微', branch: '寅', relation: '冲' }, { star: '天府', branch: '寅', relation: '冲' },
      { star: '流昌', branch: '申', relation: '守' },
    ], annualChangAgreement: { annualStem: '戊', jielanBranch: '申', lumingBranch: '申', agrees: true },
  });
  const run = isolated(data), hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'opposed-zi-fu'));
  assert.match(formatFortunePrompt(input), /紫微与天府同在本限的正对宫/u);
  assert.match(formatFortuneFactAudit(input), /复算大小限守申宫，寅宫的紫微与天府实由对宫照来，符合原文守照条件/u);
  assert.doesNotMatch(formatFortunePrompt(input), /寅宫的紫微与天府|horseChangZiFuOpposedDoubleGuard/u);

  const frame = lunarYear => {
    const h = engine.horoscope(`${lunarYear}-06-01`, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const current = frame(year);
  const withChang = (archive, limit, branch = '申') => quanshuLiteraryLimits(archive,
    quanshuTransformLimits(archive, limit), [{ branch, movingStarIds: ['流昌'] }]);
  assert.equal(withChang(natal, frame(year + 1), '酉')[field], false);
  assert.equal(withChang(natal, current, '寅')[field], undefined);
  assert.equal(withChang(copyChartWithShiftedDecade(natal, current), current)[field], undefined);
  const misplacedFu = withWrongStarLayer(natal, ['天府'], 'majorStars', 'minorStars');
  assert.equal(withChang(misplacedFu, current)[field], undefined);
});

test('p010 independently confirms Zhong Luming Chang on the same two verified Horse limits', () => {
  const cases = [
    { dateStr: '1984-09-10', timeIndex: 8, gender: '男', year: 2000, ziFu: ['申', '申'] },
    { dateStr: '1964-08-06', timeIndex: 0, gender: '女', year: 2020, ziFu: ['午', '戌'] },
  ];
  const knowledgeId = literaryRules[3].knowledgeId;
  const field = 'horseChangLumingDoubleGuardCandidate';
  for (const { dateStr, timeIndex, gender, year, ziFu } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }), raw = engine.toJSON();
    const submitted = submitYear(raw, year, 'horse-luming-dual-limits');
    const fact = literaryFact(submitted, year), data = fact.normalizedPayload;
    assert.equal(data[field], true);
    assert.equal(data.horseChangDoubleGuardAgreementCandidate, false);
    assert.equal(data.horseChangZiFuOpposedDoubleGuardCandidate, false);
    const decade = data.limits.find(row => row.layer === 'decadal');
    assert.equal(decade.horseCompanions.find(row => row.star === '流昌').branch, '亥');
    assert.equal(data.lumingChang, '戌');
    const witness = data.horseChangLumingDoubleGuardWitness;
    assert.deepEqual([witness.branch, witness.annualStem], ['寅', '庚']);
    assert.deepEqual(witness.stars.map(row => [row.star, row.branch, row.relation]), [
      ['本命天马', '寅', '守'], ['本命禄存', '寅', '守'],
      ['紫微', ziFu[0], year === 2000 ? '冲' : '三合'], ['天府', ziFu[1], year === 2000 ? '冲' : '三合'],
      ['禄命流昌', '戌', '三合'],
    ]);
    const run = { ...submitted, facts: [fact] };
    const hit = result(run, knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'luming-horse'));
    assert.match(formatFortuneFactAudit(input), /按钟义明〈天马篇〉附注的禄命法，复算大小限同守寅宫/u);
    assert.match(formatFortunePrompt(input), /按钟义明〈天马篇〉同句附注的禄命法/u);
    assert.doesNotMatch(formatFortunePrompt(input), /复算大小限同守寅宫|horseChangLumingDoubleGuard|禄命流昌在戌宫/u);

    const asFrame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-01`, 6);
      return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    };
    const present = asFrame(year);
    const changedLu = withWrongStarLayer(raw, ['禄存'], 'minorStars', 'adjectiveStars');
    const local = (archive, frame) => quanshuLiteraryLimits(archive, quanshuTransformLimits(archive, frame), []);
    assert.equal(local(changedLu, present)[field], undefined);
    assert.notEqual(local(raw, asFrame(year + 1))[field], true);
  }
});

test('p021 counts a named natal ally and a distinct natal transformed star at the same verified limit', () => {
  const example = { dateStr: '1981-02-15', timeIndex: 3, gender: '女' };
  const engine = astro.withOptions({ ...example, fixLeap: true, config });
  const natal = engine.toJSON(), knowledgeId = literaryRules[2].knowledgeId;
  for (const [year, layer] of [[2023, 'decadal'], [2033, 'minor']]) {
    const bound = submitYear(natal, year, 'mixed-literary-allies-' + year);
    const fact = literaryFact(bound, year), data = fact.normalizedPayload;
    for (const key of ['movingChangQuCandidate', 'movingChangQuAssistantCandidate', 'movingChangQuNamedTrinesCandidate',
      'movingChangQuNatalTransformCandidate', 'movingChangQuSourceSeatsCandidate', 'movingChangQuLifeAndCommonMinorTrinesCandidate',
      'movingChangQuBothLimitsTrineCandidate']) assert.equal(data[key], false, key);
    assert.equal(data.movingChangQuMixedNamedTrinesCandidate, true);
    assert.deepEqual(data.movingChangQuMixedNamedTrinesWitness, [{ layer, branch: '卯', lifeBranch: '亥',
      moving: [{ star: '流昌', branch: '卯', relation: '守' }, { star: '流曲', branch: '亥', relation: '三合' }],
      natalStem: '辛', pairs: [{ support: { star: '天马', branch: '亥', relation: '三合' },
        recipient: { star: '文曲', kind: '科', branch: '未', relation: '三合' } }],
    }]);
    const run = { ...bound, facts: [fact] }, hit = result(run, knowledgeId);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrongProfile = { ...fact, normalizedPayload: { ...data, jielanAnnualChangProfile: 'unverified' } };
    assert.equal(result({ ...run, facts: [wrongProfile] }, knowledgeId).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'mixed-literary-allies'));
    const audit = formatFortuneFactAudit(input), scopeName = layer === 'decadal' ? '大限' : '小限';
    assert.ok(audit.includes('本命助曜与生年化曜三合到同一限宫，实核' + scopeName + '在卯宫'));
    assert.match(audit, /天马在亥宫，与限宫为三合、辛干化科的文曲在未宫，与限宫为三合/u);
    assert.doesNotMatch(formatFortunePrompt(input), /本命助曜与生年化曜三合到同一限宫|movingChangQuMixedNamedTrinesWitness/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
  }
  const adjacent = literarySlice({ ...example, year: 2022 });
  assert.equal(adjacent.data.movingChangQuMixedNamedTrinesCandidate, false);
  assert.equal(result(adjacent.run, knowledgeId).status, 'not_matched');

  const actual = engine.horoscope('2023-06-01', 6);
  const frame = { lunarYear: 2023, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: actual.age.index };
  const moves = [{ branch: '卯', movingStarIds: ['流昌'] }, { branch: '亥', movingStarIds: ['流曲'] }];
  const wrongDecadal = structuredClone(natal);
  wrongDecadal.palaces.find(row => row.index === frame.decadalIndex).decadal.range = [99, 108];
  const missingRecipient = structuredClone(natal), recipientSeat = position(missingRecipient, '文曲');
  recipientSeat.minorStars = recipientSeat.minorStars.filter(star => star.name !== '文曲');
  for (const archive of [wrongDecadal, missingRecipient]) {
    const unresolved = quanshuLiteraryLimits(archive, quanshuTransformLimits(archive, frame), moves);
    assert.equal(unresolved.movingChangQuMixedNamedTrinesCandidate, undefined);
    assert.deepEqual(unresolved.movingChangQuMixedNamedTrinesWitness, []);
  }
});

const literaryPrompt = run => formatFortuneFactAudit(buildFortuneModelContext(run,
  interpretFortune(run, requestForFortuneRun(run), 'literary-contacts')).input);
const branchFact = (run, year) => run.facts.find(f => f.factType === 'quanshu_limit_branches' && f.normalizedPayload.lunarYear === year);
const timings = (run, year) => run.facts.filter(f => f.factType === 'quanshu_limit_star_timing' && f.normalizedPayload.lunarYear === year);
function submitYear(natal, year, snapshotId, birthContext) {
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 15), ref = { snapshotId };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: { ...chart(natal), birthContext } })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), snapshotId, ref);
  validateFortuneFacts(run);
  return run;
}
function submitLimitBranch(natal, year, snapshotId, birthContext) {
  const run = submitYear(natal, year, snapshotId, birthContext);
  const fact = branchFact(run, year);
  return { fact, run: { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) } };
}
function beijingBirthContext(dateStr, timeIndex) {
  const hour = String(timeIndex * 2).padStart(2, '0');
  return { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
    latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
}
const exampleAt = (year, timeIndex = 0) => ({ dateStr: '1947-02-05', timeIndex, year });
const branchExample = (year, timeIndex = 0) => ({ dateStr: '1989-02-10', timeIndex, year });

test('the property Sun and Ziwei require both verified limits for the same-seat Fu and Bi witnesses', () => {
  const cases = [
    { dateStr: '1989-11-15', timeIndex: 1, gender: '女', branch: '丑', star: '太阳', positive: 2031, near: 2027,
      nearMinor: '巳', entry: '004', name: 'propertySun', exact: 'propertySunDoubleFuBiGuard',
      alternatives: ['propertySunCandidate', 'propertySunSplitAssistedCandidate'] },
    { dateStr: '1947-06-15', timeIndex: 2, gender: '男', branch: '未', star: '紫微', positive: 2037, near: 2036,
      nearMinor: '午', entry: '025', name: 'ziwei', exact: 'ziweiDoubleFuBiGuard',
      alternatives: ['ziweiSupportCandidate', 'ziweiTrinePairCandidate', 'ziweiThreeShaCandidate'] },
  ];
  for (const example of cases) {
    const { dateStr, timeIndex, gender, branch, star, positive, near, nearMinor, entry, name, exact, alternatives } = example;
    const astrolabe = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }), n = astrolabe.toJSON();
    const rule = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(`expansion-p${entry}-001`));
    for (const year of [positive, near]) {
      const isPositive = year === positive;
      const bound = submitYear(n, year, `source-two-limits-${entry}-${year}`);
      const fact = specific(bound).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === year);
      assert.ok(fact);
      const data = fact.normalizedPayload, witness = data.namedSupport[name];
      assert.deepEqual([data.branch, data.otherBranch, witness.branch], [branch, isPositive ? branch : nearMinor, branch]);
      assert.ok(data.sourceLocalStars.includes(star));
      assert.deepEqual(witness.assistants, ['左辅', '右弼'].map(star => ({ star, branch, relation: '守' })));
      assert.equal(data[alternatives[0]], true);
      assert.equal(data[exact], isPositive);
      if (isPositive && name === 'ziwei') assert.equal(data.ziweiThreeShaCandidate, true);

      const isolated = structuredClone(fact);
      for (const key of alternatives) isolated.normalizedPayload[key] = false;
      const run = { ...bound, facts: [...bound.facts.filter(row => row.factType !== fact.factType), isolated] };
      const hit = result(run, rule.knowledgeId);
      assert.equal(hit.status, isPositive ? 'partial' : 'not_matched');
      assert.deepEqual(hit.sourceFactIds, isPositive ? [fact.factId] : []);
      if (isPositive) {
        assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
        const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'source-two-limits'));
        const audit = formatFortuneFactAudit(input), seat = `同一实段的大限与小限都守${branch}宫`;
        assert.ok(audit.includes(seat + (name === 'propertySun' ? '的本命田宅，太阳、左辅和右弼均在此宫' : '，本命紫微、左辅和右弼均在此宫')));
        if (name === 'ziwei') assert.match(audit, /紫微限诀另列三方的七杀、破军与贪狼/u);
        assert.doesNotMatch(formatFortunePrompt(input), /同一实段的大限与小限都守|DoubleFuBiGuard/u);
        assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule.knowledgeId));
      }
      isolated.normalizedPayload.twoLimitGuardProfile = 'unverified';
      assert.equal(result(run, rule.knowledgeId).status, 'not_matched');
    }

    const h = astrolabe.horoscope(`${positive}-06-01`, 6);
    const partial = quanshuSupportCondition(n, h.decadal.index, h.yearly.index, positive, 'decadal');
    assert.equal(partial.ready, true);
    assert.equal(partial[exact], undefined);
    const shiftedMinor = quanshuSupportCondition(n, h.decadal.index, h.yearly.index, positive, 'decadal', (h.age.index + 1) % 12);
    assert.equal(shiftedMinor.ready, true);
    assert.equal(shiftedMinor[exact], undefined);
    const frame = { lunarYear: positive, decadalIndex: h.decadal.index };
    const shiftedDecade = quanshuSupportCondition(copyChartWithShiftedDecade(n, frame), h.decadal.index,
      h.yearly.index, positive, 'decadal', h.age.index);
    assert.equal(shiftedDecade.namedSupport.sourceMinorVerified, true);
    assert.equal(shiftedDecade.namedSupport.sourceDecadal.verified, false);
    assert.equal(shiftedDecade[exact], undefined);
    const wrongLayer = withWrongStarLayer(n, ['左辅'], 'minorStars', 'adjectiveStars');
    assert.equal(quanshuSupportCondition(wrongLayer, h.decadal.index, h.yearly.index, positive, 'decadal', h.age.index)[exact], undefined);
  }
});

test('p025 confirms the named Fu and Xiang trines only with two verified Ziwei guards and no three-palace counter', () => {
  const engine = astro.withOptions({ dateStr: '1978-01-19', timeIndex: 6, gender: '男', fixLeap: true, config });
  const natal = engine.toJSON(), year = 1988;
  const submitted = submitYear(natal, year, 'ziwei-fu-xiang-double-guard');
  const fact = specific(submitted).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === year);
  const knowledgeId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith('expansion-p025-001')).knowledgeId;
  const data = fact.normalizedPayload;
  assert.equal(data.ziweiMingFuXiangDoubleGuardCandidate, true);
  assert.equal(data.ziweiDoubleFuBiGuard, false);
  assert.equal(data.ziweiThreeShaCandidate, false);
  assert.deepEqual(data.namedSupport.ziwei.mingFuXiangWitness, { branch: '午', trines: [
    { star: '天府', branch: '戌', relation: '三合' }, { star: '天相', branch: '寅', relation: '三合' },
  ], counter: [
    { star: '七杀', branch: '辰', relation: '其他' }, { star: '破军', branch: '申', relation: '其他' },
    { star: '贪狼', branch: '子', relation: '冲' },
  ] });
  const run = isolateSupport(submitted, fact);
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ziwei-fu-xiang-double-guard'));
  assert.match(formatFortuneFactAudit(input), /紫微实守午宫的当前限宫，戌宫的天府和寅宫的天相均三合此限/u);
  assert.match(formatFortuneFactAudit(input), /大限和小限实守午宫紫微.*天府在戌宫.*天相在寅宫.*未成原诀三方杀破狼/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /天府、天相分别从两个三合宫会来/u);
  assert.doesNotMatch(prompt, /戌宫的天府|寅宫的天相|大限和小限实守午宫紫微|ziweiMingFuXiangDoubleGuardCandidate/u);

  const frame = lunarYear => {
    const h = engine.horoscope(`${lunarYear}-06-01`, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const current = frame(year), next = frame(year + 1);
  const produce = (archive, { lunarYear, yearIndex, decadalIndex, minorIndex }) =>
    quanshuSupportCondition(archive, decadalIndex, yearIndex, lunarYear, 'decadal', minorIndex);
  const selectConfirmation = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload }])
    .find(row => row.knowledgeId === knowledgeId).confirmations[0];
  const near = selectConfirmation(produce(natal, next));
  assert.deepEqual([near.hits.length, near.unknown], [0, false]);
  const wrongDecade = copyChartWithShiftedDecade(natal, current);
  for (const broken of [wrongDecade, withWrongStarLayer(natal, ['天相'], 'majorStars', 'adjectiveStars')]) {
    const wrong = produce(broken, current);
    assert.equal(wrong.ziweiMingFuXiangDoubleGuardCandidate, undefined);
    assert.equal(wrong.ziweiTrinePairCandidate, undefined);
    assert.deepEqual(wrong.namedSupport.ziwei.trinePairs, []);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrong }] }, knowledgeId).status, 'unknown');
    const rejected = selectConfirmation(wrong);
    assert.deepEqual([rejected.hits.length, rejected.unknown], [0, true]);
  }
  const validMinor = specific(submitted).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === year);
  const minorWhileDecadeUnverified = quanshuSupportCondition(wrongDecade, current.minorIndex, current.yearIndex,
    current.lunarYear, 'minor', current.decadalIndex);
  assert.equal(minorWhileDecadeUnverified.ziweiTrinePairCandidate, true);
  assert.equal(minorWhileDecadeUnverified.ziweiMingFuXiangDoubleGuardCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...validMinor, normalizedPayload: minorWhileDecadeUnverified }] }, knowledgeId).status, 'partial');
});

test('p025 confirms the two source-named Ziwei co-guards and verifies the other good star by trine', () => {
  const examples = [
    { dateStr: '1950-02-27', timeIndex: 0, year: 2018, branch: '申', seat: '天府', trine: '天相', trineBranch: '子' },
    { dateStr: '1950-02-17', timeIndex: 7, year: 1986, branch: '辰', seat: '天相', trine: '天府', trineBranch: '子' },
  ];
  const field = 'ziweiMingFuXiangSeatAndTrineDoubleGuardCandidate';
  const knowledgeId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith('expansion-p025-001')).knowledgeId;
  for (const { dateStr, timeIndex, year, branch, seat, trine, trineBranch } of examples) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = engine.toJSON();
    const submitted = submitYear(natal, year, 'ziwei-fu-xiang-seat-and-trine-' + year);
    const fact = specific(submitted).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload, run = { ...submitted, facts: [fact] };
    assert.equal(data[field], true);
    assert.equal(data.ziweiMingFuXiangDoubleGuardCandidate, false);
    assert.equal(data.ziweiThreeShaCandidate, false);
    const witness = data.namedSupport.ziwei.mingFuXiangSeatAndTrineWitness;
    assert.equal(witness.branch, branch);
    assert.equal(witness.birthStem, '庚');
    assert.deepEqual(witness.atSeat, { star: seat, branch, relation: '守' });
    assert.deepEqual(witness.illuminating, { star: trine, branch: trineBranch, relation: '三合' });
    assert.ok(witness.counter.every(row => !['守', '三合'].includes(row.relation)));
    const hit = result(run, knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ziwei-fu-xiang-seat-and-trine'));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === knowledgeId)));
    assert.ok(formatFortuneFactAudit(input).includes(
      `大限和小限实守${branch}宫紫微，按明刊庚生人，${seat}同守此宫，${trineBranch}宫${trine}从三合来会`));
    assert.doesNotMatch(formatFortunePrompt(input), new RegExp(`实守${branch}宫|${trineBranch}宫的${trine}|${field}|mingFuXiangSeatAndTrineWitness`, 'u'));

    const frame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-01`, 6);
      return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    };
    const produce = (archive, { lunarYear, yearIndex, decadalIndex, minorIndex }) =>
      quanshuSupportCondition(archive, decadalIndex, yearIndex, lunarYear, 'decadal', minorIndex);
    const check = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload }])
      .find(row => row.knowledgeId === knowledgeId).confirmations.find(row => row.condition.includes(field));
    const next = produce(natal, frame(year + 1));
    assert.equal(next[field], false);
    assert.deepEqual([check(next).hits.length, check(next).unknown], [0, false]);
    const current = frame(year);
    for (const wrong of [copyChartWithShiftedDecade(natal, current), withWrongStarLayer(natal, [seat], 'majorStars', 'adjectiveStars')]) {
      const missing = produce(wrong, current);
      assert.equal(missing[field], undefined);
      assert.deepEqual([check(missing).hits.length, check(missing).unknown], [0, true]);
    }
  }
});

test('independent source hour/month tables cover all twelve branches and match unique real archived positions', () => {
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (let index = 0; index < 12; index++) {
    const calculated = quanshuAuxiliaryPositions(index + 1, branches[index], '庚');
    assert.deepEqual(calculated.named.map(row => row.branch), [reference.changByHour[index], reference.quByHour[index], reference.fuByMonth[index], reference.biByMonth[index]]);
    const natal = native({ timeIndex: index }), basis = readQuanshuSupportNatal(natal);
    assert.equal(basis.ready, true);
    for (const row of basis.sourcePositions.filter(row => ['文昌', '文曲', '左辅', '右弼'].includes(row.star))) assert.equal(position(natal, row.star).earthlyBranch, row.branch);
    const dateStr = LunarPackage.Lunar.fromYmd(1991, index + 1, 1).getSolar().toYmd();
    const monthly = native({ dateStr }), monthBasis = readQuanshuSupportNatal(monthly);
    assert.equal(monthBasis.ready, true); assert.equal(monthBasis.birthMonth, index + 1);
  }
  assert.throws(() => quanshuAuxiliaryPositions(0, '子', '庚'));
  assert.throws(() => quanshuAuxiliaryPositions(1, '未知', '庚'));
});

test('all ten noble pairs are unordered; Bing/Ding source Hai-Xu differs explicitly from the untouched default archive', () => {
  for (const [stem, pair] of Object.entries(reference.noblePairsByStem)) assert.deepEqual(quanshuAuxiliaryPositions(1, '子', stem).noblePair, pair);
  for (const dateStr of ['1986-05-05', '1987-05-05']) {
    const natal = native({ dateStr }), before = structuredClone(natal), basis = readQuanshuSupportNatal(natal);
    assert.equal(basis.ready, true); assert.deepEqual(basis.noblePair, ['亥', '戌']);
    assert.equal(basis.nobleArchiveState, 'different_pair');
    assert.deepEqual([...basis.nobleArchiveBranches].sort(), ['亥', '酉'].sort());
    assert.equal(basis.sourcePositions.filter(row => row.star === '魁钺组').length, 2);
    assert.ok(!basis.sourcePositions.some(row => ['天魁', '天钺'].includes(row.star)));
    assert.deepEqual(natal, before);
  }
  assert.match(quanshuSupportPolicy.rabbitGlyph, /explicit-reading/u);
});

test('missing, duplicated or displaced named auxiliaries and majors cannot silently become source support; unknown noble archives remain distinct', () => {
  for (const name of ['文昌', '文曲', '左辅', '右弼', '紫微']) {
    for (const mode of ['missing', 'duplicate', 'displaced']) {
      const natal = native(), palace = position(natal, name), star = stars(palace).find(s => s.name === name);
      if (mode !== 'duplicate') for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) palace[key] = palace[key].filter(s => s.name !== name);
      if (mode === 'duplicate') palace.minorStars.push(star);
      if (mode === 'displaced') natal.palaces[(palace.index + 1) % 12].minorStars.push(star);
      const basis = readQuanshuSupportNatal(natal);
      if (name === '紫微' && mode === 'displaced') assert.equal(basis.ready, true, 'major coordinates are inherited, not independently recomputed');
      else assert.equal(basis.ready, false, name + ':' + mode);
    }
  }
  const leap = native(); leap.rawDates.lunarDate.isLeap = true;
  assert.equal(readQuanshuSupportNatal(leap).ready, false);
  const unknown = native();
  for (const palace of unknown.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) palace[key] = palace[key].filter(s => !['天魁', '天钺'].includes(s.name));
  const basis = readQuanshuSupportNatal(unknown);
  assert.equal(basis.ready, true); assert.equal(basis.nobleArchiveState, 'unavailable');
  assert.deepEqual(basis.noblePair, ['丑', '未']);
});

test('source relations keep same/opposite/trine/adjacent separate, and major-limit support comes from that limit rather than the focused minor limit', () => {
  const natal = native();
  for (let index = 0; index < 12; index++) {
    const row = quanshuSupportCondition(natal, index, 4, 2026, 'minor', (index + 1) % 12);
    assert.equal(row.ready, true); assert.equal(row.otherSamePalace, false);
    assert.equal(row.annualLucunBranch, '巳');
    const groups = { 守: row.sourceLocalStars, 冲: row.sourceOppositeStars, 三合: row.sourceTrineStars, 邻宫: row.sourceAdjacentStars };
    for (const related of row.sourceRelations) if (groups[related.relation]) assert.ok(groups[related.relation].includes(related.star));
    const other = quanshuSupportCondition(natal, (index + 1) % 12, 4, 2026, 'decadal', index);
    assert.deepEqual(row.decadalAreaStars, other.sourceAreaStars);
  }
  assert.equal(quanshuSupportCondition(natal, 0, 3, 2026, 'decadal', 1).ready, false);
});

test('a merged decade is partitioned by both the annual and partner-limit boundaries without crossing gaps or half-open edges', () => {
  const scope = (kind, start, end, index, lunarYear = 2025) => ({ scope: kind, start, end, output: { index }, lunarYear });
  const rows = bindQuanshuSupportScopes([scope('decadal', 0, 30, 0), scope('minor', 0, 10, 0), scope('minor', 10, 30, 1),
    scope('yearly', 0, 20, 4), scope('yearly', 20, 30, 5, 2026)]);
  const decadal = rows.filter(row => row.focus.scope === 'decadal');
  assert.deepEqual(decadal.map(row => [row.start, row.end, row.other.output.index, row.year.lunarYear]), [[0, 10, 0, 2025], [10, 20, 1, 2025], [20, 30, 1, 2026]]);
  assert.ok(rows.every(row => row.start < row.end && row.focus.start <= row.start && row.end <= row.focus.end
    && row.year.start <= row.start && row.end <= row.year.end));
  const adjacent = bindQuanshuSupportScopes([scope('decadal', 0, 10, 0), scope('yearly', 10, 20, 1)]);
  assert.deepEqual(adjacent.filter(row => row.focus.scope === 'decadal'), []);
  assert.ok(adjacent.every(row => row.focus.scope === 'yearly' && row.other === undefined));
});

test('four named auxiliary examples reach same-period source facts and SQLite partial matches', () => {
  for (const example of supportExamples) {
    const run = realRun(example); validateFortuneFacts(run); assert.notEqual(run.methods.ziwei.status, 'failed');
    const match = result(run, example.knowledgeId); assert.equal(match.status, 'partial', example.knowledgeId);
    const rows = specific(run).filter(f => f.scope === example.scope && f.normalizedPayload.branch === example.branch
      && f.normalizedPayload.lunarYear === example.year);
    assert.ok(rows.length, example.knowledgeId);
    assert.ok(rows.every(f => f.completeness === 'complete' && f.normalizedPayload.birthStem === example.birthStem));
    assert.ok(rows.every(f => f.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id))));
    if (/p03[24]-001$/u.test(example.knowledgeId)) {
      const matched = run.facts.filter(f => match.sourceFactIds.includes(f.factId));
      assert.ok(matched.length && matched.every(f => timedSupport(f) && f.normalizedPayload.activeInSourceHalf === true));
      assert.ok(matched.some(row => row.scope === example.scope && row.normalizedPayload.branch === example.branch));
    } else {
      assert.ok(match.sourceFactIds.every(id => specific(run).some(f => f.factId === id)));
      assert.ok(rows.some(row => match.sourceFactIds.includes(row.factId)));
    }
  }
});

test('four named placements reach SQLite and retain distinct limit, branch and source-grade evidence', () => {
  const scenarios = [
    ['004', 'propertySunCandidate', '本命田宅宫在亥，太阳守此宫。大限、小限与太阳分别为守、冲'],
    ['025', 'ziweiSupportCandidate', '本命紫微在辰宫，当前限宫也在此宫'],
    ['032', 'tianliangSupportCandidate', '天梁在申宫，卷二逐宫称陷、同篇男命歌称庙，卷三汇表称陷'],
    ['034', 'wenquSupportCandidate', '右弼在未宫，与天同为三合'],
  ];
  for (const [suffix, flag, phrase] of scenarios) {
    const example = supportExamples.find(e => e.knowledgeId.endsWith('p' + suffix + '-001'));
    const run = realRun(example), match = result(run, example.knowledgeId);
    const fact = specific(run).find(row => row.scope === example.scope
      && row.normalizedPayload.lunarYear === example.year && row.normalizedPayload[flag] === true);
    assert.ok(fact, suffix);
    assert.equal(match.status, 'partial', suffix);
    assert.ok(match.sourceFactIds.some(id => run.facts.some(row => row.factId === id
      && row.scope === fact.scope && row.normalizedPayload.branch === fact.normalizedPayload.branch)), suffix);
    assert.deepEqual([fact.normalizedPayload.branch, fact.normalizedPayload.otherBranch, fact.normalizedPayload.annualBranch],
      [example.branch, example.otherBranch, example.annualBranch]);
    const p = fact.normalizedPayload, support = p.namedSupport;
    if (suffix === '004') {
      assert.equal(p.otherSamePalace, false);
      const natal = native(example), annualIndex = natal.palaces.find(row => row.earthlyBranch === p.annualBranch).index;
      assert.equal(quanshuSupportCondition(natal, p.palaceIndex, annualIndex, p.lunarYear, 'decadal').propertySunCandidate, undefined);
    }
    if (suffix === '025') assert.deepEqual(support.ziwei.assistants.map(row => row.relation), ['守', '冲']);
    if (suffix === '032') {
      assert.deepEqual(support.tianliang.assistants.map(row => row.relation), ['冲', '三合', '冲', '三合']);
      assert.equal(support.tianliang.gradeConflict, true);
    }
    if (suffix === '034') assert.deepEqual(support.wenqu.tongAssistants.map(row => row.relation), ['三合', '三合']);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-support-prompt'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    assert.doesNotMatch(prompt, /namedSupport|propertySunCandidate|ziweiThreeShaCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === example.knowledgeId));
  }
});

test('named solar, Ziwei, Tianliang and Wenqu rules do not trust a displaced small limit', () => {
  const cohort = [
    ['004', 'propertySunCandidate'], ['025', 'ziweiSupportCandidate'],
    ['032', 'tianliangSupportCandidate'], ['034', 'wenquSupportCandidate'],
  ];
  for (const [entry, flag] of cohort) {
    const example = supportExamples.find(row => row.knowledgeId.endsWith('p' + entry + '-001'));
    const archive = astro.withOptions({ ...example, fixLeap: true, config });
    const natal = archive.toJSON(), target = archive.horoscope(example.year + '-10-01', 6);
    const following = archive.horoscope(example.year + 1 + '-10-01', 6);
    const focus = example.scope === 'minor' ? target.age.index : target.decadal.index;
    const partner = example.scope === 'minor' ? target.decadal.index : target.age.index;
    const known = quanshuSupportCondition(natal, focus, target.yearly.index, example.year, example.scope, partner);
    assert.equal(known.namedSupport.sourceMinorVerified, true, entry);
    assert.equal(known[flag], true, entry);
    // Keeping the old reported palace in the following year invalidates its small limit without disturbing the birth chart.
    const displaced = quanshuSupportCondition(natal, focus, following.yearly.index, example.year + 1, example.scope, partner);
    assert.equal(displaced.ready, true, entry);
    assert.equal(displaced.namedSupport.sourceMinorVerified, false, entry);
    assert.equal(displaced[flag], undefined, entry);
    if (entry === '004') {
      assert.equal(displaced.namedSupport.propertySun.decadalRelation, '守');
      assert.equal(displaced.namedSupport.propertySun.minorRelation, undefined);
      assert.equal(displaced.propertySunSplitAssistedCandidate, undefined);
    }
    if (entry === '025') assert.equal(displaced.ziweiThreeShaCandidate, undefined);
    if (entry === '032') assert.equal(displaced.tianliangPlainGuardCandidate, undefined);
    if (entry === '034') {
      assert.equal(displaced.wenquChapterFallenCandidate, undefined);
      const tong = position(natal, '天同'), star = tong.majorStars.find(row => row.name === '天同');
      const next = natal.palaces.find(row => row.index === (tong.index + 1) % 12);
      tong.majorStars = tong.majorStars.filter(row => row !== star);
      next.majorStars.push(star);
      const wrongCompanion = quanshuSupportCondition(natal, focus, target.yearly.index, example.year, example.scope, partner);
      assert.equal(wrongCompanion.namedSupport.wenqu.atLimit, true);
      assert.equal(wrongCompanion.namedSupport.wenqu.tongBranch, undefined);
      assert.equal(wrongCompanion.wenquSupportCandidate, undefined);
    }
    if (entry === '004' || entry === '025') {
      const run = realRun(example);
      const fact = specific(run).find(row => row.scope === example.scope && row.normalizedPayload.lunarYear === example.year);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: displaced }] }, example.knowledgeId).status, 'unknown', entry);
    }
  }
});

test('p034 preserves both actual guarded palaces while rejecting Wenqu in the inactive half', () => {
  const example = { dateStr: '1989-02-11', timeIndex: 10, gender: '男', year: 2016 };
  const rule = supportExamples.find(row => row.knowledgeId.endsWith('p034-001')).knowledgeId;
  const run = realRun(example);
  const fact = specific(run).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === example.year);
  const p = fact.normalizedPayload, qu = p.namedSupport.wenqu;
  assert.deepEqual([p.branch, p.otherBranch, qu.tongRelation], ['寅', '戌', '三合']);
  assert.deepEqual(qu.tongAssistants.map(row => [row.star, row.branch, row.relation]), [['左辅', '辰', '冲'], ['右弼', '戌', '守']]);
  assert.equal(qu.companions.find(row => row.star === '左辅').relation, '其他');
  assert.equal(p.wenquSupportCandidate, false);
  assert.equal(p.wenquPairedLimitsCandidate, true);
  assert.deepEqual([qu.chapterGrade, qu.grade], ['平', '陷']);
  assert.equal(p.wenquChapterFallenCandidate, false);
  const isolated = isolateSupport(run, fact), match = result(isolated, rule);
  assert.equal(match.status, 'not_matched');
  assert.deepEqual(match.sourceFactIds, []);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'wenqu-paired-limits'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大限守寅宫文曲，小限守戌宫天同，两宫为三合/u);
  assert.match(prompt, /卷二文曲逐宫称平，卷三汇表称陷/u);
  assert.doesNotMatch(prompt, /wenquPairedLimitsCandidate/u);

  const negative = realRun({ ...example, year: 1996 });
  const other = specific(negative).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === 1996);
  assert.equal(other.normalizedPayload.branch, '寅');
  assert.equal(other.normalizedPayload.otherBranch, '辰');
  assert.equal(other.normalizedPayload.wenquPairedLimitsCandidate, false);
  const plain = isolateSupport(negative, other);
  const plainHit = result(plain, rule);
  assert.equal(plainHit.status, 'partial');
  assert.ok(plainHit.sourceFactIds.every(id => plain.facts.find(row => row.factId === id).normalizedPayload.wenquPlainGuardCandidate));
  const natal = native(example);
  const annual = natal.palaces.find(row => row.earthlyBranch === p.annualBranch);
  assert.equal(quanshuSupportCondition(natal, p.palaceIndex, annual.index, example.year, 'decadal').wenquPairedLimitsCandidate, undefined);
  const displaced = natal.palaces.find(row => row.earthlyBranch === '酉');
  const uncertain = quanshuSupportCondition(natal, p.palaceIndex, annual.index, example.year, 'decadal', displaced.index);
  assert.equal(uncertain.otherBranch, '酉');
  assert.equal(uncertain.wenquPairedLimitsCandidate, undefined);
});

test('Ming Wenqu confirms the four-star guard only within both verified northern halves', () => {
  const year = 1965;
  const engine = astro.withOptions({ type: 'lunar', dateStr: '1950-10-1', timeIndex: 9, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON();
  for (const star of ['文曲', '左辅', '右弼', '天同']) assert.equal(position(natal, star).earthlyBranch, '丑', star);
  const knowledgeId = supportExamples.find(row => row.knowledgeId.endsWith('p034-001')).knowledgeId;
  const full = submitYear(natal, year, 'ming-wenqu-double-guard');
  const run = { ...full, facts: full.facts.filter(row => timedSupport(row)
    && row.normalizedPayload.star === '文曲' && row.normalizedPayload.lunarYear === year) };
  const hit = result(run, knowledgeId);
  const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: new Date(quanshuLunarMidnight(year, 1)).toISOString(), endExclusive: boundary }]);
  const verified = run.facts.filter(row => row.normalizedPayload.wenquMingDoubleGuardCandidate === true);
  assert.deepEqual(verified.map(row => [row.scope, row.normalizedPayload.branch, row.activeTo]).sort(),
    [['decadal', '丑', boundary], ['minor', '丑', boundary]]);
  const inactive = run.facts.filter(row => row.activeFrom >= boundary);
  assert.ok(inactive.length > 0);
  assert.ok(inactive.every(row => row.normalizedPayload.wenquMingDoubleGuardCandidate === false));
  assert.equal(result({ ...run, facts: inactive }, knowledgeId).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-wenqu-double-guard'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /左辅、右弼和天同都与文曲同宫/u);
  assert.doesNotMatch(prompt, /wenquMingDoubleGuardCandidate|丑宫/u);

  const sky = engine.horoscope(year + '-06-15', 6);
  const frame = { lunarYear: year, yearIndex: sky.yearly.index, minorIndex: sky.age.index,
    decadalIndex: sky.decadal.index, age: sky.age.nominalAge };
  const window = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
  const minorWith = archive => {
    const limits = quanshuLimitBranches(archive, frame);
    const support = quanshuSupportCondition(archive, frame.minorIndex, frame.yearIndex, year, 'minor', frame.decadalIndex);
    const timing = quanshuLimitTiming(archive, limits, window, frame)[0].data;
    return quanshuTimedSupport(timing, support, 'minor', limits.minorBranch).find(row => row.star === '文曲');
  };
  for (const [archive, status] of [[withWrongStarLayer(natal, ['左辅'], 'minorStars', 'adjectiveStars'), 'matched'],
    [copyChartWithShiftedDecade(natal, frame), 'partial']]) {
    const evidence = minorWith(archive);
    assert.equal(evidence.wenquMingDoubleGuardCandidate, undefined);
    assert.equal(evidence.wenquPlainGuardCandidate, true);
    const fact = { ...verified.find(row => row.scope === 'minor'), normalizedPayload: evidence };
    const fallback = result({ ...run, facts: [fact] }, knowledgeId);
    assert.equal(fallback.status, status);
    if (status === 'matched') assert.equal(fallback.matchedSourceExcerpt, '二限相逢文曲星');
  }
});

test('p033 uses a unique Qisha and opposite Tianfu in the same year and keeps the actual partner-limit geometry', () => {
  const sample = { dateStr: '1990-01-01', timeIndex: 0, gender: '男' };
  const rule = branchRules[2].knowledgeId;
  for (const [year, timeIndex, expectedRelations, bothLimits, eligibleStart] of [
    [2001, 0, ['其他', '守'], false, '2001-08-18T16:00:00.000Z'],
    [2013, 0, ['三合', '守'], true, '2013-08-06T16:00:00.000Z'],
    [2055, 0, ['守', '冲'], true, '2055-01-27T16:00:00.000Z'],
    [2049, 1, ['守', '守'], true, '2049-02-01T16:00:00.000Z'],
  ]) {
    const run = realRun({ ...sample, timeIndex, year });
    const fact = branchFact(run, year), p = fact.normalizedPayload;
    assert.deepEqual([p.qishaTianfu.qishaBranch, p.qishaTianfu.tianfuBranch, p.qishaTianfu.relation], ['未', '丑', '冲']);
    assert.deepEqual(p.qishaTianfu.limits.map(row => row.qishaRelation), expectedRelations);
    assert.equal(p.qishaTianfuAtLimitCandidate, true);
    assert.equal(p.qishaTianfuBothLimitsCandidate, bothLimits);
    const isolated = { ...run, facts: run.facts.filter(row => row.factType === 'quanshu_limit_star_timing'
      ? row.normalizedPayload.lunarYear === year : row.factType !== fact.factType || row.factId === fact.factId) };
    const match = result(isolated, rule);
    assert.equal(match.status, 'matched');
    const eligible = timings(run, year).filter(row => row.normalizedPayload.qishaTianfuActiveCandidate);
    assert.deepEqual(match.sourceFactIds, eligible.map(row => row.factId));
    for (const row of eligible) {
      assert.deepEqual(row.normalizedPayload.qishaTianfuActiveWitness, { qishaBranch: '未', tianfuBranch: '丑',
        guardScopes: row.normalizedPayload.verifiedStarTimings.find(star => star.star === '七杀').activeScopes });
    }
    assert.deepEqual(match.windows, [{ start: eligibleStart, endExclusive: fact.activeTo }]);
    if (year === 2055) {
      const previous = branchFact(run, 2054);
      assert.equal(previous.normalizedPayload.qishaTianfuAtLimitCandidate, true);
      assert.equal(timings(run, 2054)[0].normalizedPayload.qishaPhaseCandidate, false);
      assert.equal(result({ ...run, facts: timings(run, 2054) }, rule).status, 'not_matched');
      const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'qisha-tianfu'));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, /七杀在未宫，卷三列为庙，对宫丑有天府/u);
      assert.match(prompt, /小限在丑宫，与七杀为冲，与天府为守/u);
      assert.match(prompt, /七杀为南斗，实守大限未宫，此段落在下五年/u);
      assert.match(prompt, /七杀实际守限在未宫，天府在丑宫，正对七杀守限宫/u);
      assert.doesNotMatch(prompt, /qishaTianfuBothLimitsCandidate/u);
      assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule));
      assert.doesNotMatch(formatFortunePrompt(input), /qishaTianfuActiveWitness/u);
    }
  }
  const noGuard = realRun({ ...sample, year: 2002 }), fact = branchFact(noGuard, 2002);
  assert.equal(fact.normalizedPayload.qishaTianfuAtLimitCandidate, false);
  const isolatedNegative = { ...noGuard, facts: timings(noGuard, 2002) };
  assert.equal(result(isolatedNegative, rule).status, 'not_matched');

  const natal = native(sample), yearIndex = natal.palaces.find(row => row.earthlyBranch === '巳').index;
  const minorIndex = position(natal, '七杀').index;
  const same = quanshuLimitBranches(natal, { lunarYear: 2001, yearIndex, minorIndex });
  assert.equal(same.qishaTianfuAtLimitCandidate, true);
  assert.equal(same.qishaTianfuBothLimitsCandidate, undefined);
  const tianfu = position(natal, '天府');
  tianfu.majorStars.push({ ...tianfu.majorStars.find(row => row.name === '天府') });
  const duplicate = quanshuLimitBranches(natal, { lunarYear: 2001, yearIndex, minorIndex });
  assert.equal(duplicate.qishaTianfuAtLimitCandidate, undefined);
  assert.equal(duplicate.qishaTianfu.tianfuBranch, undefined);
});

test('p033 cannot use a minor guard that disagrees with the source calculation', () => {
  const a = astro.withOptions({ dateStr: '1990-01-01', timeIndex: 0, gender: '男', fixLeap: true, config });
  const lunarYear = 2002, natal = a.toJSON(), horoscope = a.horoscope('2002-06-01', 6);
  const frame = { lunarYear, yearIndex: horoscope.yearly.index, decadalIndex: horoscope.decadal.index,
    minorIndex: position(natal, '七杀').index, age: horoscope.age.nominalAge };
  assert.notEqual(frame.minorIndex, horoscope.age.index);
  const limits = quanshuLimitBranches(natal, frame);
  assert.equal(limits.sourceMinor.verified, false);
  assert.equal(limits.qishaTianfuAtLimitCandidate, true);
  const yearWindow = { start: quanshuLunarMidnight(lunarYear, 1), end: quanshuLunarMidnight(lunarYear + 1, 1) };
  const late = quanshuLimitTiming(natal, limits, yearWindow, frame).at(-1);
  assert.equal(late.data.qishaPhaseCandidate, true);
  assert.equal(late.data.qishaTianfuActiveCandidate, undefined);
  assert.equal(late.data.qishaTianfuActiveWitness, undefined);
  const audit = describeFortuneFact({ method: 'ziwei', type: 'quanshu_limit_star_timing', data: late.data }, String);
  assert.doesNotMatch(audit, /列七杀为.*实守/u);
});

test('p033 keeps named Sha as a separate verse and needs the actual opposing Tianfu position', () => {
  const year = 2011, natal = native({ timeIndex: 0 });
  const complete = submitLimitBranch(natal, year, 'qisha-and-adverse');
  assert.equal(complete.fact.normalizedPayload.qishaTianfuAtLimitCandidate, true);
  const tianfu = position(natal, '天府');
  tianfu.majorStars = tianfu.majorStars.filter(row => row.name !== '天府');
  const missing = submitLimitBranch(natal, year, 'qisha-adverse-without-tianfu');
  assert.equal(missing.fact.normalizedPayload.qishaTianfuAtLimitCandidate, undefined);
  for (const { fact } of [complete, missing]) {
    const p = fact.normalizedPayload;
    assert.equal(p.qishaAdverseAtLimitCandidate, true);
    assert.deepEqual(p.qishaAdverseGuards, [{ star: '陀罗', branch: '未', relation: '守' }]);
    assert.deepEqual(p.qishaTianfu.limits.filter(row => row.qishaRelation === '守').map(row => [row.scope, row.branch]), [['minor', '未']]);
  }
  const hit = result(complete.run, branchRules[2].knowledgeId);
  const eligible = timings(complete.run, year).find(row => row.normalizedPayload.qishaTianfuActiveCandidate);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [eligible.factId]);
  assert.deepEqual(hit.windows, [{ start: '2011-07-30T16:00:00.000Z', endExclusive: complete.fact.activeTo }]);
  const { input } = buildFortuneModelContext(complete.run,
    interpretFortune(complete.run, requestForFortuneRun(complete.run), 'qisha-adverse'));
  assert.match(formatFortuneFactAudit(input), /本命七杀实守小限未宫，同宫煞曜有陀罗/u);
  const unknown = result(missing.run, branchRules[2].knowledgeId);
  assert.equal(unknown.status, 'unknown');
  assert.deepEqual(unknown.sourceFactIds, []);
  assert.deepEqual(unknown.windows, []);
  const p = missing.fact.normalizedPayload;
  const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index(p.annualBranch), decadalIndex: index(p.decadalBranch) };
  assert.equal(quanshuLimitBranches(natal, frame).qishaAdverseAtLimitCandidate, undefined);
  assert.equal(quanshuLimitBranches(natal, { ...frame, minorIndex: frame.decadalIndex }).qishaAdverseAtLimitCandidate, false);
});

test('source small-limit second half follows regular month seven after the 2025 leap sixth month', () => {
  const year = 2025, natal = native({ dateStr: '1990-01-01', timeIndex: 0, gender: '男' });
  const { fact, run } = submitLimitBranch(natal, year, 'qisha-leap-sixth-month');
  assert.equal(fact.normalizedPayload.qishaTianfuAtLimitCandidate, true);
  const [early, late] = timings(run, year);
  const regularSeventh = '2025-08-22T16:00:00.000Z';
  const duringLeapSixth = '2025-08-01T00:00:00.000Z';
  assert.ok(early.activeFrom <= duringLeapSixth && duringLeapSixth < early.activeTo);
  assert.deepEqual([early.activeTo, late.activeFrom], [regularSeventh, regularSeventh]);
  assert.equal(early.normalizedPayload.qishaPhaseCandidate, false);
  assert.equal(early.normalizedPayload.qishaTianfuActiveCandidate, false);
  assert.deepEqual(late.normalizedPayload.qisha.activeScopes, ['minor']);
  assert.equal(late.normalizedPayload.qishaTianfuActiveCandidate, true);
  assert.deepEqual(result(run, branchRules[2].knowledgeId).windows,
    [{ start: regularSeventh, endExclusive: fact.activeTo }]);
});

test('p001 matches only Tianji’s verified South Dipper limit window and reports that short source branch', () => {
  const year = 2019, natal = native({ dateStr: '1974-02-05', timeIndex: 4, gender: '女' });
  const { run } = submitLimitBranch(natal, year, 'tianji-direct-limit');
  const [early, late] = timings(run, year);
  assert.equal(early.normalizedPayload.tianjiPhaseCandidate, false);
  assert.equal(late.normalizedPayload.tianjiPhaseCandidate, true);
  assert.deepEqual(late.normalizedPayload.verifiedStarTimings.find(star => star.star === '天机'),
    { star: '天机', group: '南斗', branch: '未', activeScopes: ['minor'], candidate: true });
  assert.equal(late.activeFrom, '2019-07-31T16:00:00.000Z');
  const rule = fortuneKnowledge.ziwei.rules.find(entry => entry.knowledgeId.endsWith('expansion-p001-001')).knowledgeId;
  const exactRun = { ...run, facts: [early, late] };
  const match = result(exactRun, rule);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [late.factId]);
  assert.deepEqual(match.windows, [{ start: late.activeFrom, endExclusive: late.activeTo }]);
  assert.equal(result({ ...run, facts: [early] }, rule).status, 'not_matched');
  const { input } = buildFortuneModelContext(exactRun, interpretFortune(exactRun, requestForFortuneRun(exactRun), 'tianji-direct-limit'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule));
  assert.match(formatFortuneFactAudit(input), /天机为南斗，实守小限未宫，此段落在下半年/u);
  assert.doesNotMatch(formatFortunePrompt(input), /tianjiPhaseCandidate/u);
  const missingJi = structuredClone(natal);
  const seat = position(missingJi, '天机');
  seat.majorStars = seat.majorStars.filter(star => star.name !== '天机');
  const missing = submitLimitBranch(missingJi, year, 'tianji-missing-star').run;
  assert.equal(result({ ...missing, facts: timings(missing, year) }, rule).status, 'unknown');
});

test('one actual natal chart verifies eight named source stars against both halves of their own small limits', () => {
  const a = astro.withOptions({ dateStr: '1974-02-05', timeIndex: 4, gender: '女', fixLeap: true, config });
  const natal = a.toJSON();
  const cases = [
    [2012, '七杀', '南斗', '寅', 'qishaVerifiedPhaseCandidate', '2012-08-16T16:00:00.000Z'],
    [2013, '天梁', '南斗', '丑', 'tianliangPhaseCandidate', '2013-08-06T16:00:00.000Z'],
    [2014, '廉贞', '北斗', '子', 'lianzhenPhaseCandidate', '2014-07-26T16:00:00.000Z'],
    [2016, '贪狼', '北斗', '戌', 'tanlangPhaseCandidate', '2016-08-02T16:00:00.000Z'],
    [2018, '文曲', '北斗', '申', 'wenquPhaseCandidate', '2018-08-10T16:00:00.000Z'],
    [2019, '天机', '南斗', '未', 'tianjiPhaseCandidate', '2019-07-31T16:00:00.000Z'],
    [2022, '武曲', '北斗', '辰', 'wuquPhaseCandidate', '2022-07-28T16:00:00.000Z'],
    [2023, '天同', '南斗', '卯', 'tiantongPhaseCandidate', '2023-08-15T16:00:00.000Z'],
  ];
  for (const [year, star, group, branch, field, midpoint] of cases) {
    const h = a.horoscope(year + '-06-15', 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, minorIndex: h.age.index,
      decadalIndex: h.decadal.index, age: h.age.nominalAge };
    const limits = quanshuLimitBranches(natal, frame);
    assert.equal(limits.sourceMinor.verified, true, star);
    assert.equal(limits.minorBranch, branch, star);
    assert.notEqual(limits.decadalBranch, branch, star);
    const window = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    const rows = quanshuLimitTiming(natal, limits, window, frame);
    assert.deepEqual(rows.map(row => [row.start, row.end]),
      [[window.start, Date.parse(midpoint)], [Date.parse(midpoint), window.end]], star);
    const index = group === '北斗' ? 0 : 1;
    assert.deepEqual(rows[index].data.verifiedStarTimings.find(row => row.star === star),
      { star, group, branch, activeScopes: ['minor'], candidate: true }, star);
    assert.deepEqual(rows[1 - index].data.verifiedStarTimings.find(row => row.star === star),
      { star, group, branch, activeScopes: [], candidate: false }, star);
    assert.equal(rows[index].data[field], true, star);
    assert.equal(rows[1 - index].data[field], false, star);
    const displacedLimits = quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
    assert.equal(displacedLimits.sourceMinor.verified, false, star);
    assert.ok(quanshuLimitTiming(natal, displacedLimits, window, frame).every(row => row.data[field] === undefined), star);
  }
  const submitted = submitYear(natal, 2018, 'verified-star-halves');
  const [early, late] = timings(submitted, 2018);
  assert.equal(early.activeTo, '2018-08-10T16:00:00.000Z');
  assert.deepEqual(early.normalizedPayload.verifiedStarTimings.find(row => row.star === '文曲'),
    { star: '文曲', group: '北斗', branch: '申', activeScopes: ['minor'], candidate: true });
  assert.equal(early.normalizedPayload.wenquPhaseCandidate, true);
  assert.equal(late.normalizedPayload.wenquPhaseCandidate, false);
});

test('eight SQLite rules keep original branches and the same named guard in the active source half', () => {
  const cases = [
    ['wuqu-limit-p059', '武曲', '辰', '1990-05-05', 2, '男', 2026, 'wuTempleChangCandidate', '2026-02-16', '2026-08-12'],
    ['expansion-p006', '贪狼', '申', '1990-01-15', 0, '女', 2000, 'tanlangNatalXingJiCandidate', '2000-02-04', '2000-07-30'],
    ['expansion-p009', '七杀', '子', '1990-01-15', 0, '女', 2020, 'qishaPlainLimitCandidate', '2020-08-18', '2020-12-31'],
    ['expansion-p027', '天同', '卯', '1974-02-05', 4, '女', 2023, 'tongSupportCandidate', '2023-08-15', '2023-12-31'],
    ['expansion-p028', '天同', '午', '1991-02-16', 2, '女', 1998, 'tongFallenOpposedCandidate', '1998-08-21', '1998-12-31'],
    ['expansion-p029', '廉贞', '午', '1992-05-05', 4, '女', 2008, 'lianzhenNatalXingJiBladeCandidate', '2008-02-06', '2008-07-31'],
    ['expansion-p032', '天梁', '申', '1983-12-15', 8, '女', 2000, 'tianliangSupportCandidate', '2000-07-30', '2000-12-31'],
    ['expansion-p034', '文曲', '未', '1990-05-05', 3, '女', 2011, 'wenquSupportCandidate', '2011-02-02', '2011-07-30'],
  ];
  for (const [suffix, star, branch, dateStr, timeIndex, gender, year, predicate, start, end] of cases) {
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(suffix + '-001')).knowledgeId;
    const run = submitYear(native({ dateStr, timeIndex, gender }), year, 'same-limit-star-' + suffix);
    const related = run.facts.filter(f => f.factType === 'quanshu_timed_limit_condition'
      && f.normalizedPayload.star === star && f.normalizedPayload.lunarYear === year);
    const active = related.find(f => f.normalizedPayload.activeInSourceHalf === true && f.normalizedPayload[predicate] === true);
    const opposite = related.find(f => f.normalizedPayload.activeInSourceHalf === false && f.normalizedPayload[predicate] === true);
    assert.ok(active && opposite, suffix);
    assert.equal(active.normalizedPayload.branch, branch, suffix);
    assert.deepEqual(active.normalizedPayload.guardScopes, ['minor'], suffix);
    assert.deepEqual(opposite.normalizedPayload.guardScopes, [], suffix);
    const scoped = { ...run, facts: related };
    const match = result(scoped, knowledgeId);
    const isBaseTong = suffix === 'expansion-p027';
    const confirmed = isBaseTong || suffix === 'wuqu-limit-p059' || suffix === 'expansion-p032';
    assert.equal(match.status, confirmed ? 'matched' : 'partial', suffix);
    if (suffix === 'expansion-p032') assert.equal(match.matchedSourceExcerpt, '作事求谋更吉昌');
    if (suffix === 'wuqu-limit-p059') assert.equal(match.matchedSourceExcerpt, '武曲临限化权星');
    assert.deepEqual(match.sourceFactIds, [active.factId], suffix);
    assert.deepEqual(match.windows, [{ start: start + 'T16:00:00.000Z', endExclusive: end + 'T16:00:00.000Z' }], suffix);
    assert.equal(result({ ...scoped, facts: [opposite] }, knowledgeId).status, 'not_matched', suffix);
    if (isBaseTong || suffix === 'wuqu-limit-p059' || suffix === 'expansion-p028') {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), suffix));
      const expected = new RegExp('《全书》列' + star + '为' + active.normalizedPayload.starGroup + '，实守小限'
        + branch + '宫且处在本星适用的[上下]半年，原分支与该限同段', 'u');
      assert.match(formatFortuneFactAudit(input), expected);
      assert.doesNotMatch(formatFortunePrompt(input), expected);
      assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === knowledgeId)), confirmed);
    }
  }

  const oldPair = submitYear(native({ dateStr: '1989-02-11', timeIndex: 10, gender: '男' }), 2016, 'wenqu-only-wrong-half');
  const guards = oldPair.facts.filter(f => f.factType === 'quanshu_timed_limit_condition'
    && f.normalizedPayload.lunarYear === 2016 && f.normalizedPayload.star === '文曲');
  assert.ok(guards.some(f => f.scope === 'decadal' && f.normalizedPayload.branch === '寅'
    && f.normalizedPayload.wenquPairedLimitsCandidate && !f.normalizedPayload.activeInSourceHalf));
  assert.ok(guards.filter(f => f.scope === 'minor').every(f => f.normalizedPayload.branch === '戌'
    && f.normalizedPayload.activeInSourceHalf === false && f.normalizedPayload.wenquPairedLimitsCandidate === false));
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p034-001')).knowledgeId;
  assert.equal(result({ ...oldPair, facts: guards }, rule).status, 'not_matched');

  const missingAuxiliary = native({ dateStr: '1990-05-05', timeIndex: 3, gender: '女' });
  const palace = position(missingAuxiliary, '左辅');
  palace.minorStars = palace.minorStars.filter(row => row.name !== '左辅');
  const missing = submitYear(missingAuxiliary, 2011, 'wenqu-missing-auxiliary');
  const timed = missing.facts.filter(f => f.factType === 'quanshu_timed_limit_condition' && f.normalizedPayload.lunarYear === 2011);
  assert.ok(timed.some(f => f.normalizedPayload.sourceFactType !== 'quanshu_support_condition' && f.normalizedPayload.ready === true));
  const uncertain = timed.find(f => f.scope === 'minor' && f.normalizedPayload.star === '文曲'
    && f.normalizedPayload.activeInSourceHalf === true);
  assert.ok(uncertain);
  assert.equal(uncertain.normalizedPayload.ready, true);
  assert.equal(uncertain.normalizedPayload.wenquPlainGuardCandidate, true);
  assert.equal(uncertain.normalizedPayload.wenquSupportCandidate, undefined);
  assert.equal(uncertain.normalizedPayload.wenquPairedLimitsCandidate, undefined);
  assert.equal(result({ ...missing, facts: timed }, rule).status, 'partial');
});

test('the same native chart reaches the separate Ming Wenqu foundation and fallen Pojun guard in their real northern minor halves', () => {
  const birth = { dateStr: '1974-07-15', timeIndex: 0, gender: '女' };
  const cases = [
    { year: 1986, star: '文曲', branch: '辰', passage: 'expansion-p034', gate: 'wenquPlainGuardCandidate',
      prior: ['wenquSupportCandidate', 'wenquPairedLimitsCandidate', 'wenquChapterFallenCandidate', 'wenquJielanYinFallenCandidate'],
      start: '1986-02-08T16:00:00.000Z', end: '1986-08-05T16:00:00.000Z', phrase: /明刊文曲入限诀的独立守限条件/u },
    { year: 1987, star: '破军', branch: '卯', passage: 'pojun-limit-p059', gate: 'poFallenMingBladeFireBellCandidate',
      prior: ['poTemplePlainCandidate', 'poTempleSupportCandidate', 'poTempleJoinedSupportCandidate',
        'poTempleBothNoblesCandidate', 'poTempleAtVerifiedLimitCandidate'],
      start: '1987-01-28T16:00:00.000Z', end: '1987-08-23T16:00:00.000Z', phrase: /破军[^\n]*廉贞[^\n]*擎羊[^\n]*铃星/u },
  ];
  for (const { year, star, branch, passage, gate, prior, start, end, phrase } of cases) {
    const n = native(birth);
    const run = submitYear(n, year, 'ming-shared-northern-guard');
    const facts = run.facts.filter(row => row.factType === 'quanshu_timed_limit_condition' && row.normalizedPayload.star === star
      && row.normalizedPayload.lunarYear === year);
    const active = facts.find(row => row.normalizedPayload[gate] === true && row.normalizedPayload.activeInSourceHalf === true);
    const inactive = facts.find(row => row.activeFrom === end && row.normalizedPayload.branch === branch);
    assert.ok(active && inactive, passage);
    const payload = active.normalizedPayload;
    assert.deepEqual([payload.branch, payload.guardScopes, payload.starGroup], [branch, ['minor'], '北斗']);
    assert.deepEqual(prior.map(key => payload[key]), prior.map(() => false));
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(passage + '-001')).knowledgeId;
    const scoped = { ...run, facts };
    const hit = result(scoped, rule);
    const confirmed = star === '破军';
    assert.equal(hit.status, confirmed ? 'matched' : 'partial');
    assert.deepEqual(hit.windows, [{ start, endExclusive: end }]);
    assert.equal(result({ ...run, facts: [inactive] }, rule).status, 'not_matched');
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-northern-baselines'));
    assert.match(formatFortuneFactAudit(input), phrase);
    const provider = formatFortunePrompt(input);
    assert.doesNotMatch(provider, /卯宫|poFallenMingBladeFireBellWitness/u);
    assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === rule)), confirmed);
    if (star === '破军') {
      assert.equal(hit.matchedSourceExcerpt, '杀凑陷宫防破耗');
      assert.match(provider, /杀凑陷宫防破耗/u);
      assert.deepEqual(payload.poFallenMingBladeFireBellWitness, { branch: '卯', grade: '陷',
        coGuards: [{ star: '廉贞', branch }, { star: '擎羊', branch }, { star: '铃星', branch }] });
      const source = run.facts.find(row => row.factType === 'quanshu_solar_wu_po_limits' && row.normalizedPayload.lunarYear === year).normalizedPayload;
      const index = name => n.palaces.find(row => row.earthlyBranch === name).index;
      const frame = { lunarYear: year, yearIndex: index(source.annualBranch), decadalIndex: index(source.decadalBranch), minorIndex: index(source.minorBranch), age: 14 };
      const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
      const adjacentBirth = native({ ...birth, dateStr: '1974-07-16' });
      const transplanted = { ...adjacentBirth, palaces: adjacentBirth.palaces.map(palace => ({ ...palace,
        majorStars: n.palaces.find(row => row.index === palace.index).majorStars })) };
      const coherentWrongMajors = quanshuLimitBranches(transplanted, frame);
      assert.equal(coherentWrongMajors.verifiedMajorBranches['紫微'], '亥');
      assert.equal(coherentWrongMajors.verifiedPojunBranch, '卯');
      const [wrongTiming] = quanshuLimitTiming(transplanted, coherentWrongMajors, window, frame);
      assert.equal(wrongTiming.data.ziweiBirthAnchorVerified, false);
      assert.deepEqual(wrongTiming.data.verifiedStarTimings.filter(row => row.branch !== undefined).map(row => [row.star, row.branch]),
        [['文曲', '辰'], ['文昌', '戌']]);
      assert.equal(wrongTiming.data.pojunPhaseCandidate, true); // Unverified archive geometry remains inspectable.
      const retainedGeometry = quanshuSolarWuPoLimits(coherentWrongMajors, quanshuTransformLimits(transplanted, frame));
      assert.equal(retainedGeometry.poFallenMingBladeFireBellCandidate, true);
      const wrongDayPayload = quanshuTimedPo(wrongTiming.data, retainedGeometry);
      assert.equal(wrongDayPayload.activeInSourceHalf, undefined);
      assert.deepEqual(wrongDayPayload.guardScopes, []);
      assert.equal(wrongDayPayload.poFallenMingBladeFireBellWitness, undefined);
      assert.equal(result({ ...run, facts: [{ ...active, normalizedPayload: wrongDayPayload }] }, rule).status, 'unknown');
      const from = position(n, '廉贞'), lian = from.majorStars.find(row => row.name === '廉贞');
      from.majorStars = from.majorStars.filter(row => row !== lian);
      n.palaces.find(row => row.earthlyBranch === '辰').majorStars.push(lian);
      const limits = quanshuLimitBranches(n, frame);
      const changed = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(n, frame));
      const [timing] = quanshuLimitTiming(n, limits, window, frame);
      assert.equal(timing.data.ziweiBirthAnchorVerified, true);
      const normalizedPayload = quanshuTimedPo(timing.data, changed);
      assert.equal(normalizedPayload.activeInSourceHalf, true);
      assert.equal(normalizedPayload.poFallenMingBladeFireBellCandidate, undefined);
      assert.equal(normalizedPayload.poFallenMingBladeFireBellWitness, undefined);
      assert.equal(result({ ...run, facts: [{ ...active, normalizedPayload }] }, rule).status, 'unknown');
    }
  }
});

test('five source-half rules distinguish the actual guard, inactive half and unverified archive palace', () => {
  const cases = [
    ['wuqu-limit-p059', '武曲', '辰', '1990-05-05', 2, '男', 2026, 'wuTempleChangCandidate'],
    ['pojun-limit-p059', '破军', '午', '1947-02-05', 7, '女', 1966, 'poTemplePlainCandidate'],
    ['expansion-p029', '廉贞', '午', '1992-05-05', 4, '女', 2008, 'lianzhenNatalXingJiBladeCandidate'],
    ['expansion-p032', '天梁', '申', '1983-12-15', 8, '女', 2000, 'tianliangSupportCandidate'],
    ['expansion-p034', '文曲', '未', '1990-05-05', 3, '女', 2011, 'wenquSupportCandidate'],
  ];
  for (const [suffix, star, branch, dateStr, timeIndex, gender, year, predicate] of cases) {
    const archive = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = archive.toJSON(), horoscope = archive.horoscope(year + '-06-15', 6);
    const frame = { lunarYear: year, yearIndex: horoscope.yearly.index, minorIndex: horoscope.age.index,
      decadalIndex: horoscope.decadal.index, age: horoscope.age.nominalAge };
    const window = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(suffix + '-001')).knowledgeId;
    const scope = ['天梁', '文曲'].includes(star) ? 'minor' : 'yearly';
    const facts = (current, archive = natal) => {
      const limits = quanshuLimitBranches(archive, current);
      assert.equal(limits.sourceMinor.verified, current.minorIndex === frame.minorIndex, suffix);
      assert.notEqual(limits.decadalBranch, branch, suffix);
      const calculation = quanshuLimitTiming(archive, limits, window, current);
      if (scope === 'minor') {
        const support = quanshuSupportCondition(archive, current.minorIndex, current.yearIndex, year, scope, current.decadalIndex);
        return calculation.map(({ data }) => quanshuTimedSupport(data, support, scope, limits.minorBranch).find(row => row.star === star));
      }
      if (star === '廉贞') {
        const xing = quanshuXingJiTiger(archive, current.yearIndex, limits);
        return calculation.map(({ data }) => quanshuTimedLianzhen(data, xing));
      }
      const solar = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(archive, current));
      const bind = star === '武曲' ? quanshuTimedWu : quanshuTimedPo;
      return calculation.map(({ data }) => bind(data, solar));
    };
    const evaluate = rows => {
      const records = rows.map(normalizedPayload => ({ factType: 'quanshu_timed_limit_condition', scope,
        completeness: 'complete', normalizedPayload }));
      return evaluateFortuneRules('ziwei', 'year', records).find(row => row.knowledgeId === knowledgeId).required[0];
    };
    const actual = facts(frame);
    const active = actual.find(row => row.activeInSourceHalf === true);
    const inactive = actual.filter(row => row.activeInSourceHalf === false);
    assert.equal(active.branch, branch, suffix);
    assert.equal(active[predicate], true, suffix);
    assert.deepEqual(active.guardScopes, ['minor'], suffix);
    assert.equal(evaluate(actual).hits.length, 1, suffix);
    assert.ok(inactive.length, suffix);
    const outside = evaluate(inactive);
    assert.deepEqual([outside.hits.length, outside.unknown], [0, false], suffix);
    const displaced = facts({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
    assert.ok(displaced.every(row => row.activeInSourceHalf === undefined && !row.guardScopes.length), suffix);
    const unresolved = evaluate(displaced);
    assert.deepEqual([unresolved.hits.length, unresolved.unknown], [0, true], suffix);
    if (star === '武曲') {
      const alienAnchor = structuredClone(natal), origin = position(alienAnchor, '紫微');
      const neighbor = alienAnchor.palaces.find(palace => palace.index === (origin.index + 1) % 12);
      neighbor.majorStars.push(origin.majorStars.find(row => row.name === '紫微'));
      origin.majorStars = origin.majorStars.filter(row => row.name !== '紫微');
      const rows = facts(frame, alienAnchor);
      assert.ok(rows.every(row => row.branch === undefined && row[predicate] === undefined
        && row.activeInSourceHalf === undefined && row.guardScopes.length === 0));
      const verification = quanshuLimitTiming(alienAnchor, quanshuLimitBranches(alienAnchor, frame), window, frame)[0].data;
      assert.ok(verification.unverifiedTimingStars.includes('武曲'));
      assert.ok(!verification.unverifiedTimingStars.includes('文曲'));
      assert.deepEqual([evaluate(rows).hits.length, evaluate(rows).unknown], [0, true]);
    }
  }
});

test('timed Ziwei rules require source main-star layers, and Tianxing branches additionally require its natal adjective layer', () => {
  const timingType = 'quanshu_limit_star_timing', candidateType = 'quanshu_timed_limit_condition';
  const cases = [
    ['001', '天机', '1974-02-05', 4, '女', 2019, 'tianjiPhaseCandidate', timingType],
    ['006', '贪狼', '1990-01-15', 0, '女', 2000, 'tanlangNatalXingJiCandidate', candidateType],
    ['009', '七杀', '1990-01-15', 0, '女', 2020, 'qishaPlainLimitCandidate', candidateType],
    ['026', '天机', '1987-06-05', 6, '女', 2014, 'tianjiDualTrineLimitCandidate', candidateType],
    ['027', '天同', '1974-02-05', 4, '女', 2023, 'activeInSourceHalf', candidateType],
    ['028', '天同', '1991-02-16', 2, '女', 1998, 'tongFallenOpposedCandidate', candidateType],
    ['029', '廉贞', '1992-05-05', 4, '女', 2008, 'lianzhenNatalXingJiBladeCandidate', candidateType],
    ['033', '七杀', '1990-01-01', 0, '男', 2001, 'qishaTianfuActiveCandidate', timingType],
  ];
  for (const [passage, star, dateStr, timeIndex, gender, lunarYear, predicate, factType] of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON(), h = engine.horoscope(lunarYear + '-06-01', 6);
    const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
    const window = { start: quanshuLunarMidnight(lunarYear, 1), end: quanshuLunarMidnight(lunarYear + 1, 1) };
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p' + passage + '-001')).knowledgeId;
    const evaluate = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [
      { factType, scope: 'yearly', completeness: 'complete', normalizedPayload },
    ]).find(row => row.knowledgeId === rule).required[0];
    const facts = chart => {
      const limits = quanshuLimitBranches(chart, frame);
      return quanshuLimitTiming(chart, limits, window, frame).map(({ data }) => {
        if (factType === timingType) return data;
        if (passage === '026') return quanshuTimedTianji(data, quanshuTransformLimits(chart, frame));
        if (star === '天同') return quanshuTimedTong(data, quanshuLimitVerseContacts(limits));
        if (star === '廉贞') return quanshuTimedLianzhen(data, quanshuXingJiTiger(chart, frame.yearIndex, limits));
        return quanshuTimedBody(data, quanshuBodyLimitEncounters(chart, frame.yearIndex, limits)).find(row => row.star === star);
      });
    };
    const rows = facts(natal);
    const active = rows.findIndex(row => row[predicate] === true && evaluate(row).hits.length === 1);
    assert.notEqual(active, -1, passage);
    assert.equal(rows[active].starPlacementProof, 'quanshu-nanyangtang-major-layer-v1', passage);
    if (passage !== '026') assert.ok(rows.some(row => evaluate(row).hits.length === 0), passage);
    for (const displaced of [star, '天府']) {
      const wrong = facts(withWrongStarLayer(natal, [displaced], 'majorStars', 'minorStars'))[active];
      const result = evaluate(wrong);
      assert.deepEqual([result.hits.length, result.unknown], [0, true], passage + ' ' + displaced);
    }
    const older = evaluate({ ...rows[active], starPlacementProof: undefined });
    assert.deepEqual([older.hits.length, older.unknown], [0, true], passage);
    if (passage === '006' || passage === '029') {
      const narrow = payload => passage === '006'
        ? { ...payload, tanlangMingNatalYangJiAspectCandidate: false, tanlangMingNatalYangTuoJiCandidate: false,
          tanlangMingXingJiAliasesCandidate: false }
        : payload;
      assert.equal(evaluate(narrow(rows[active])).hits.length, 1, passage);
      assert.equal(rows[active].tianxingPlacementProof, 'quanshu-tianxing-birth-month-adjective-layer-v1', passage);
      const wrongXing = facts(withWrongStarLayer(natal, ['天刑'], 'adjectiveStars', 'minorStars'))[active];
      assert.equal(wrongXing.activeInSourceHalf, true, passage);
      assert.equal(wrongXing[predicate], undefined, passage);
      assert.equal(wrongXing.tianxingPlacementProof, undefined, passage);
      for (const fact of [wrongXing, { ...rows[active], tianxingPlacementProof: undefined }]) {
        const unknown = evaluate(narrow(fact));
        assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true], passage);
      }
    }
  }
});

test('Tianliang and Wenqu retain verified half-window guards when companion layers are wrong', () => {
  for (const [dateStr, timeIndex, gender, year, star, passage, companion, predicate] of [
    ['1983-12-15', 8, '女', 2000, '天梁', '032', '左辅', 'tianliangSupportCandidate'],
    ['1990-05-05', 3, '女', 2011, '文曲', '034', '左辅', 'wenquSupportCandidate'],
    ['1960-05-05', 1, '女', 2027, '天梁', '032', '陀罗', 'tianliangCombinedShaCandidate'],
    ['1951-02-15', 10, '男', 1964, '文曲', '034', '陀罗', 'wenquJielanYinFallenCandidate'],
  ]) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON(), sky = engine.horoscope(year + '-06-15', 6);
    const frame = { lunarYear: year, yearIndex: sky.yearly.index, minorIndex: sky.age.index,
      decadalIndex: sky.decadal.index, age: sky.age.nominalAge };
    const window = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    const activeSupport = chart => {
      const limits = quanshuLimitBranches(chart, frame);
      const support = quanshuSupportCondition(chart, frame.minorIndex, frame.yearIndex, year, 'minor', frame.decadalIndex);
      return quanshuLimitTiming(chart, limits, window, frame)
        .map(({ data }) => quanshuTimedSupport(data, support, 'minor', limits.minorBranch).find(row => row.star === star))
        .find(row => row.activeInSourceHalf === true);
    };
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p' + passage + '-001')).knowledgeId;
    const evaluate = normalizedPayload => evaluateFortuneRules('ziwei', 'year',
      [{ factType: 'quanshu_timed_limit_condition', scope: 'minor', completeness: 'complete', normalizedPayload }])
      .find(row => row.knowledgeId === knowledgeId).required[0];
    const plain = star === '天梁' ? 'tianliangPlainGuardCandidate' : 'wenquPlainGuardCandidate';
    const active = activeSupport(natal);
    assert.equal(active[predicate], true, predicate);
    const layered = activeSupport(withWrongStarLayer(natal, [companion], 'minorStars', 'adjectiveStars'));
    assert.equal(layered.namedAuxiliaryLayerProof, 'quanshu-named-auxiliary-layer-v1', predicate);
    assert.equal(layered[predicate], undefined, predicate);
    assert.equal(layered[plain], true, predicate);
    assert.equal(evaluate(layered).hits.length, 1, predicate);
    const enhancedOnly = { ...active, [plain]: false };
    assert.equal(evaluate(enhancedOnly).hits.length, 1, predicate);
    delete enhancedOnly.namedAuxiliaryLayerProof;
    const old = evaluate(enhancedOnly);
    assert.deepEqual([old.hits.length, old.unknown], [0, true], predicate);
  }
});

test('p026 confirms natal Yang Tuo and Jumen only with Tianji opposing the same verified limit', () => {
  const birth = { dateStr: '1964-02-27', timeIndex: 5, gender: '女' };
  const year = 1977, natal = native(birth);
  const run = submitYear(natal, year, 'ming-tianji-opp-sha');
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p026-001')).knowledgeId;
  const related = run.facts.filter(row => row.factType === 'quanshu_timed_limit_condition'
    && row.normalizedPayload.star === '天机' && row.normalizedPayload.lunarYear === year);
  assert.ok(related.length);
  const kept = { ...run, facts: related }, hit = result(kept, rule);
  assert.equal(hit.status, 'matched');
  assert.match(hit.matchedSourceExcerpt, /更遇羊陀并巨暗/u);
  const start = new Date(quanshuLunarMidnight(year, 1)).toISOString();
  assert.deepEqual(hit.windows, [{ start, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  assert.ok(related.every(row => row.normalizedPayload.tianjiNatalShaOpposedCandidate
    && row.normalizedPayload.activeInSourceHalf === false));
  const witness = { scope: 'minor', branch: '酉', layer: 'natal',
    tianji: { star: '天机', branch: '卯', relation: '冲' }, jumen: { star: '巨门', branch: '卯', relation: '冲' },
    sha: [{ star: '擎羊', branch: '卯', relation: '冲' }, { star: '陀罗', branch: '丑', relation: '三合' }] };
  assert.ok(related.every(row => row.normalizedPayload.tianjiAspectWitnesses.some(candidate => candidate.scope === 'minor'
    && candidate.layer === 'natal')));
  assert.deepEqual(related[0].normalizedPayload.tianjiAspectWitnesses.find(candidate => candidate.scope === 'minor'
    && candidate.layer === 'natal'), witness);
  const { input } = buildFortuneModelContext(kept, interpretFortune(kept, requestForFortuneRun(kept), 'ming-tianji-opp-sha'));
  assert.match(formatFortunePrompt(input), /更遇羊陀并巨暗/u);
  assert.doesNotMatch(formatFortunePrompt(input), /卯宫|酉宫|丑宫|tianjiNatalShaOpposedCandidate/u);

  const solar = astro.withOptions({ ...birth, fixLeap: true, config });
  const read = (dateYear, archive, createFrame = frame => frame) => {
    const h = solar.horoscope(dateYear + '-06-01', 6);
    const frame = createFrame({ lunarYear: dateYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
      minorIndex: h.age.index, age: h.age.nominalAge });
    const window = { start: quanshuLunarMidnight(dateYear, 1), end: quanshuLunarMidnight(dateYear + 1, 1) };
    return quanshuLimitTiming(archive, quanshuLimitBranches(archive, frame), window, frame)
      .map(({ data }) => quanshuTimedTianji(data, quanshuTransformLimits(archive, frame)));
  };
  const wrongLayer = read(year, withWrongStarLayer(natal, ['巨门'], 'majorStars', 'adjectiveStars'));
  assert.ok(wrongLayer.every(row => row.tianjiNatalShaOpposedCandidate === undefined && row.tianjiPlainOppositionCandidate === true));
  const wrongMinor = read(year, natal, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.ok(wrongMinor.every(row => row.tianjiNatalShaOpposedCandidate !== true));
  assert.ok(read(year + 1, natal).every(row => row.tianjiNatalShaOpposedCandidate !== true));
});

test('one native archive verifies separate Tianji trines and the Jielan Chang-Qu pairing in true limits', () => {
  const engine = astro.withOptions({ dateStr: '1987-06-05', timeIndex: 6, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), factType = 'quanshu_timed_limit_condition';
  const getFrame = lunarYear => {
    const h = engine.horoscope(lunarYear + '-06-01', 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
  };
  const timing = (chart, frame) => {
    const limits = quanshuLimitBranches(chart, frame), year = frame.lunarYear;
    const bounds = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    return quanshuLimitTiming(chart, limits, bounds, frame);
  };
  const predicate = (passage, payload, scope) => {
    const id = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(passage + '-001')).knowledgeId;
    return evaluateFortuneRules('ziwei', 'year', [{ factType, scope, normalizedPayload: payload, completeness: 'complete' }])
      .find(row => row.knowledgeId === id).required[0];
  };
  const frame = getFrame(2014);
  const tianji = current => quanshuTimedTianji(timing(natal, current)[0].data, quanshuTransformLimits(natal, current));
  const dual = tianji(frame);
  assert.deepEqual(dual.tianjiDualTrineLimitWitness, { tianjiBranch: '午', decadalBranch: '寅', minorBranch: '戌' });
  assert.deepEqual([dual.activeInSourceHalf, dual.tianjiPlainOppositionCandidate, dual.tianjiShaAspectCandidate], [false, false, false]);
  assert.equal(predicate('expansion-p026', dual, 'yearly').hits.length, 1);
  assert.match(describeFortuneFact({ method: 'ziwei', type: factType, data: dual }, String),
    /天机在午宫，分别三合实际大限寅宫和小限戌宫/u);
  const adjacent = tianji(getFrame(2015));
  assert.equal(adjacent.tianjiDualTrineLimitCandidate, false);
  assert.equal(adjacent.tianjiDualTrineLimitWitness, undefined);
  const displaced = tianji({ ...frame, minorIndex: getFrame(2015).minorIndex });
  assert.equal(displaced.tianjiDualTrineLimitCandidate, undefined);
  assert.equal(predicate('expansion-p026', displaced, 'yearly').unknown, true);

  const trineRun = submitYear(natal, 2014, 'actual-tianji-two-trines');
  const tianjiFacts = trineRun.facts.filter(row => row.factType === factType && row.normalizedPayload.star === '天机'
    && row.normalizedPayload.lunarYear === 2014 && row.normalizedPayload.tianjiDualTrineLimitCandidate === true);
  assert.ok(tianjiFacts.length);
  const tianjiRule = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith('expansion-p026-001')).knowledgeId;
  const trineScoped = { ...trineRun, facts: tianjiFacts };
  const trineHit = result(trineScoped, tianjiRule);
  assert.equal(trineHit.status, 'matched');
  assert.equal(trineHit.matchedSourceExcerpt, '天机照限不安宁');
  assert.deepEqual(trineHit.windows, [{ start: new Date(quanshuLunarMidnight(2014, 1)).toISOString(),
    endExclusive: trineRun.time.displayWindow.instantRange.endInstantExclusive }]);
  const trineConfirmation = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...tianjiFacts[0], normalizedPayload }])
    .find(row => row.knowledgeId === tianjiRule).confirmations.find(row => row.condition.includes('tianjiDualTrineLimitCandidate'));
  assert.deepEqual([trineConfirmation(adjacent).hits.length, trineConfirmation(adjacent).unknown], [0, false]);
  assert.deepEqual([trineConfirmation(displaced).hits.length, trineConfirmation(displaced).unknown], [0, true]);
  const trineInput = buildFortuneModelContext(trineScoped, interpretFortune(trineScoped,
    requestForFortuneRun(trineScoped), 'actual-tianji-two-trines')).input;
  assert.match(formatFortunePrompt(trineInput), /天机照限不安宁/u);
  assert.doesNotMatch(formatFortunePrompt(trineInput), /午宫|寅宫|戌宫|tianjiDualTrineLimitCandidate/u);

  const bound = submitYear(natal, 2038, 'two-distinct-native-limit-proofs');
  const active = bound.facts.find(row => timedSupport(row) && row.scope === 'minor'
    && row.normalizedPayload.lunarYear === 2038 && row.normalizedPayload.wenquJielanChangQuGuardCandidate === true
    && row.normalizedPayload.activeInSourceHalf === true);
  assert.ok(active);
  const witness = { wenquBranch: '戌', wenchangBranch: '辰', wenchangScope: 'decadal', tongBranch: '寅', tongRelation: '三合',
    assistants: [{ star: '左辅', branch: '申', relation: '冲' }, { star: '右弼', branch: '午', relation: '三合' }] };
  assert.deepEqual(active.normalizedPayload.wenquJielanChangQuGuardWitness, witness);
  assert.equal(active.normalizedPayload.wenquJielanChangQuSplitActiveCandidate, true);
  assert.deepEqual(active.normalizedPayload.wenquJielanChangQuSplitActiveWitness, {
    wenqu: { branch: '戌', scope: 'minor' }, wenchang: { branch: '辰', scope: 'decadal' },
  });
  const isolateJielan = payload => ({ ...payload, wenquSupportCandidate: false,
    wenquPairedLimitsCandidate: false, wenquChapterFallenCandidate: false, wenquJielanYinFallenCandidate: false });
  const narrowed = { ...active, normalizedPayload: isolateJielan(active.normalizedPayload) };
  const run = { ...bound, facts: [narrowed] };
  const id = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith('expansion-p034-001')).knowledgeId;
  const matched = result(run, id);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, '二限若逢昌与曲');
  assert.deepEqual(matched.windows, [{ start: '2038-02-03T16:00:00.000Z', endExclusive: '2038-07-31T16:00:00.000Z' }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jielan-chang-qu'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === id));
  assert.match(formatFortuneFactAudit(input), /按《捷览》昌曲分守/u);
  assert.match(formatFortuneFactAudit(input), /大限实守辰宫文昌，小限实守戌宫文曲/u);
  assert.match(formatFortunePrompt(input), /二限若逢昌与曲/u);
  assert.doesNotMatch(formatFortunePrompt(input), /wenquJielanChangQu|大限实守辰宫文昌|小限实守戌宫文曲|分别三合实际大限/u);

  const cur = getFrame(2038);
  const support = (chart, current) => quanshuTimedSupport(timing(chart, current)[0].data,
    quanshuSupportCondition(chart, current.minorIndex, current.yearIndex, current.lunarYear, 'minor', current.decadalIndex), 'minor', '戌')
    .find(row => row.star === '文曲');
  const wrong = support(natal, { ...cur, decadalIndex: (cur.decadalIndex + 1) % 12 });
  assert.equal(wrong.activeInSourceHalf, true);
  assert.equal(wrong.wenquJielanChangQuGuardCandidate, undefined);
  assert.equal(wrong.wenquJielanChangQuSplitActiveCandidate, undefined);
  const wrongLimit = result({ ...run, facts: [{ ...active, normalizedPayload: isolateJielan(wrong) }] }, id);
  assert.notEqual(wrongLimit.status, 'matched');
  assert.equal(wrongLimit.matchedSourceExcerpt, undefined);
  const wrongLayer = structuredClone(natal), chang = position(wrongLayer, '文昌');
  const [archived] = chang.minorStars.splice(chang.minorStars.findIndex(row => row.name === '文昌'), 1);
  chang.adjectiveStars.push(archived);
  assert.equal(support(wrongLayer, cur).wenquJielanChangQuGuardCandidate, undefined);
  assert.equal(support(wrongLayer, cur).wenquJielanChangQuSplitActiveCandidate, undefined);
  const after = bound.facts.find(row => timedSupport(row) && row.scope === 'minor'
    && row.normalizedPayload.lunarYear === 2038 && row.normalizedPayload.star === '文曲'
    && row.normalizedPayload.activeInSourceHalf === false && row.normalizedPayload.branch === '戌');
  assert.equal(after.normalizedPayload.wenquJielanChangQuGuardWitness, undefined);
  assert.equal(after.normalizedPayload.wenquJielanChangQuSplitActiveCandidate, false);
  assert.equal(after.normalizedPayload.wenquJielanChangQuSplitActiveWitness, undefined);
  assert.equal(result({ ...run, facts: [after] }, id).status, 'not_matched');
});

test('a copied decade range cannot guard Lianzhen; the verified small limit remains independent', () => {
  const archive = astro.withOptions({ dateStr: '1992-05-05', timeIndex: 4, gender: '女', fixLeap: true, config });
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p029-001'));
  const factType = 'quanshu_timed_limit_condition';
  const evaluate = rows => evaluateFortuneRules('ziwei', 'year', rows.map(normalizedPayload =>
    ({ factType, scope: 'yearly', completeness: 'complete', normalizedPayload })))
    .find(row => row.knowledgeId === rule.knowledgeId).required[0];

  for (const year of [2007, 2008]) {
    const n = archive.toJSON(), h = archive.horoscope(year + '-06-15', 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, minorIndex: h.age.index,
      decadalIndex: h.decadal.index, age: h.age.nominalAge };
    const window = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    const timed = (natal, current, limits) => {
      const lianzhen = quanshuXingJiTiger(natal, current.yearIndex, limits);
      return quanshuLimitTiming(natal, limits, window, current).map(({ data }) => quanshuTimedLianzhen(data, lianzhen));
    };
    const source = quanshuLimitBranches(n, frame);
    assert.deepEqual(source.sourceDecadal, { branch: '子', verified: true });
    assert.deepEqual([source.sourceMinor.branch, source.sourceMinor.verified], [year === 2007 ? '未' : '午', true]);
    const actual = timed(n, frame, source), smallLimitHits = year === 2008;
    assert.equal(evaluate(actual).hits.length, Number(smallLimitHits));

    const copy = structuredClone(n), wrongPalace = position(copy, '廉贞');
    wrongPalace.decadal.range = [...copy.palaces.find(palace => palace.index === frame.decadalIndex).decadal.range];
    const wrong = { ...frame, decadalIndex: wrongPalace.index };
    assert.equal(quanshuLimitPhase(copy, wrong.decadalIndex, wrong.age, window.start).ready, true);
    const wrongSource = quanshuLimitBranches(copy, wrong);
    assert.deepEqual(wrongSource.sourceDecadal, { branch: '午', verified: false });
    const wrongRows = timed(copy, wrong, wrongSource);
    assert.ok(wrongRows.every(row => row.activeInSourceHalf !== false && !row.guardScopes.includes('decadal')));
    assert.ok(wrongRows.some(row => row.activeInSourceHalf === undefined));
    assert.equal(evaluate(wrongRows).hits.length, Number(smallLimitHits));
    assert.equal(evaluate(wrongRows.filter(row => row.activeInSourceHalf === undefined)).unknown, true);

    if (smallLimitHits) {
      const omitProof = actual.map(({ limitPlacementProof, ...payload }) => payload);
      assert.ok(actual.some(row => row.limitPlacementProof === 'quanshu-bureau-and-source-minor-v1'));
      assert.deepEqual([evaluate(omitProof).hits.length, evaluate(omitProof).unknown], [0, true]);
      const noBureau = structuredClone(n);
      delete noBureau.fiveElementsClass;
      const partialBasis = quanshuLimitBranches(noBureau, frame);
      assert.equal(partialBasis.sourceDecadal.verified, undefined);
      assert.equal(partialBasis.sourceMinor.verified, true);
      assert.equal(evaluate(timed(noBureau, frame, partialBasis)).hits.length, 1);
      const noGender = structuredClone(n);
      delete noGender.gender;
      const missingBasis = quanshuLimitBranches(noGender, frame);
      assert.equal(missingBasis.sourceDecadal.verified, undefined);
      assert.equal(missingBasis.sourceMinor, undefined);
      const unread = evaluate(timed(noGender, frame, missingBasis));
      assert.deepEqual([unread.hits.length, unread.unknown], [0, true]);
    }
  }
});

test('broad placements and a different volume grade do not stand in for named support or the source counterbranch', () => {
  const cases = [
    { example: exampleAt(2010, 9), scope: 'decadal', suffix: '004', verify: p => {
      assert.equal(p.otherSamePalace, true);
      assert.equal(p.namedSupport.propertySun.natalName, '仆役');
      assert.ok(p.sourceLocalStars.includes('太阳') && ['左辅', '右弼'].every(star => p.sourceAreaStars.includes(star)));
    } },
    { example: { dateStr: '1988-10-22', timeIndex: 2, year: 2004 }, scope: 'minor', suffix: '034', verify: p => {
      assert.ok(p.sourceLocalStars.includes('文曲') && ['左辅', '右弼', '天同'].every(star => p.sourceAreaStars.includes(star)));
      assert.equal(p.namedSupport.wenqu.tongAssistants.find(row => row.star === '右弼').relation, '其他');
    } },
    { example: { dateStr: '1961-08-25', timeIndex: 10, year: 2004 }, scope: 'decadal', suffix: '034', verify: p => {
      assert.equal(p.namedSupport.wenqu.branch, '寅');
      assert.equal(p.namedSupport.wenqu.chapterGrade, '平');
      assert.equal(p.namedSupport.wenqu.grade, '陷');
      assert.equal(p.wenquFallenCandidate, true);
      assert.equal(p.wenquChapterFallenCandidate, false);
    } },
  ];
  for (const { example, scope, suffix, verify } of cases) {
    const run = realRun(example);
    const fact = specific(run).find(row => row.scope === scope && row.normalizedPayload.lunarYear === example.year);
    verify(fact.normalizedPayload);
    const only = isolateSupport(run, fact);
    const rule = supportExamples.find(row => row.knowledgeId.endsWith('p' + suffix + '-001'));
    const facts = only.facts.map(row => timedSupport(row) && row.normalizedPayload.star === '文曲'
      ? { ...row, normalizedPayload: { ...row.normalizedPayload, wenquPlainGuardCandidate: false } } : row);
    const hit = result({ ...only, facts }, rule.knowledgeId);
    if (example.dateStr === '1961-08-25') {
      assert.equal(hit.status, 'partial');
      for (const id of hit.sourceFactIds) {
        const p = facts.find(row => row.factId === id).normalizedPayload;
        assert.equal(p.wenquChapterFallenCandidate, false);
        assert.equal(p.wenquJielanYinFallenCandidate, true);
      }
    } else assert.equal(hit.status, 'not_matched');
  }
});

test('p034 verifies weak natal Life stars only within Wenqu’s actual northern half', () => {
  const natal = native({ dateStr: '1986-07-15', timeIndex: 6, gender: '女' });
  const run = submitYear(natal, 2004, 'wenqu-weak-life');
  const facts = run.facts.filter(fact => timedSupport(fact) && fact.scope === 'minor'
    && fact.normalizedPayload.star === '文曲' && fact.normalizedPayload.lunarYear === 2004
    && fact.normalizedPayload.branch === '戌');
  const active = facts.find(fact => fact.normalizedPayload.activeInSourceHalf === true);
  const inactive = facts.find(fact => fact.normalizedPayload.activeInSourceHalf === false);
  assert.ok(active && inactive);
  assert.equal(active.normalizedPayload.wenquChapterFallenWeakLifeCandidate, true);
  assert.deepEqual(active.normalizedPayload.wenquChapterFallenWeakLifeWitness, {
    lifeBranch: '丑', lifeStars: [{ star: '天机', branch: '丑', grade: '陷' }],
    counter: [{ star: '廉贞', branch: '午', relation: '三合' }, { star: '陀罗', branch: '辰', relation: '冲' },
      { star: '擎羊', branch: '午', relation: '三合' }],
  });
  assert.equal(active.activeTo, '2004-08-15T16:00:00.000Z');
  assert.equal(inactive.activeFrom, active.activeTo);
  assert.equal(inactive.normalizedPayload.wenquChapterFallenWeakLifeWitness, undefined);
  const rule = fortuneKnowledge.ziwei.rules.find(entry => entry.knowledgeId.endsWith('expansion-p034-001'));
  const isolated = { ...run, facts: [active] };
  const hit = result(isolated, rule.knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '文曲限遇廉陀羊，更兼命里星辰弱');
  assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
  assert.equal(result({ ...run, facts: [inactive] }, rule.knowledgeId).status, 'not_matched');
  const engine = astro.withOptions({ dateStr: '1986-07-15', timeIndex: 6, gender: '女', fixLeap: true, config });
  const actual = engine.horoscope('2004-06-01', 6);
  for (const [name, layer] of [['天机', 'majorStars'], ['陀罗', 'minorStars'], ['文曲', 'minorStars']]) {
    const copy = withWrongStarLayer(natal, [name], layer, 'adjectiveStars');
    const context = quanshuSupportCondition(copy, actual.age.index, actual.yearly.index, 2004, 'minor', actual.decadal.index);
    assert.equal(context.wenquChapterFallenWeakLifeCandidate, undefined, name);
    assert.equal(context.wenquChapterFallenWeakLifeWitness, undefined, name);
  }
  const healthyNatal = astro.withOptions({ dateStr: '1985-04-15', timeIndex: 6, gender: '女', fixLeap: true, config });
  const h = healthyNatal.horoscope('2000-06-01', 6);
  const healthy = quanshuSupportCondition(healthyNatal.toJSON(), h.decadal.index, h.yearly.index, 2000, 'decadal', h.age.index);
  assert.equal(healthy.wenquChapterFallenCandidate, true);
  assert.notEqual(healthy.wenquChapterFallenWeakLifeCandidate, true);
  assert.equal(healthy.wenquChapterFallenWeakLifeWitness, undefined);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'wenqu-weak-life'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /本命命宫在丑，按《全书》星表，实守正曜天机均列陷地/u);
  const provider = formatFortunePrompt(input);
  assert.match(provider, /文曲限遇廉陀羊，更兼命里星辰弱/u);
  assert.doesNotMatch(provider, /实守正曜天机均列陷地|wenquChapterFallenWeakLifeWitness/u);
});

test('p025 and p034 match source counterbranches independently through submitted limit facts', () => {
  for (const [suffix, example, scope, flag, phrase] of [
    ['025', exampleAt(2007, 9), 'minor', 'ziweiThreeShaCandidate', /紫微限诀另列三方的七杀、破军与贪狼/u],
    ['034', { dateStr: '1985-04-15', timeIndex: 6, year: 2000 }, 'decadal', 'wenquChapterFallenCandidate',
      /文曲守戌宫的当前限宫。廉贞在午宫，与文曲为三合，陀罗在寅宫，与文曲为三合，擎羊在辰宫，与文曲为冲/u],
  ]) {
    const { year, ...birth } = example;
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 15);
    const ref = { snapshotId: 'source-limit-counter-' + suffix };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(native(birth)) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'source-limit-counter', ref);
    validateFortuneFacts(run);
    const fact = specific(run).find(row => row.scope === scope && row.normalizedPayload.lunarYear === year);
    const p = fact.normalizedPayload;
    assert.equal(p[flag], true);
    if (suffix === '025') {
      assert.equal(p.ziweiSupportCandidate, false);
      assert.equal(p.namedSupport.ziwei.branch, p.branch);
      assert.deepEqual(p.namedSupport.ziwei.counter.map(row => [row.star, row.relation]),
        [['七杀', '三合'], ['破军', '守'], ['贪狼', '三合']]);
    } else {
      assert.equal(p.wenquSupportCandidate, false);
      assert.equal(p.wenquPairedLimitsCandidate, false);
      assert.equal(p.namedSupport.wenqu.branch, p.branch);
      assert.equal(p.namedSupport.wenqu.chapterGrade, '陷');
    }
    const only = isolateSupport(run, fact);
    const rule = supportExamples.find(row => row.knowledgeId.endsWith('p' + suffix + '-001'));
    const hit = result(only, rule.knowledgeId);
    assert.equal(hit.status, 'partial');
    const accepted = suffix === '034' ? only.facts.filter(row => timedSupport(row)
      && row.normalizedPayload.star === '文曲' && row.normalizedPayload.activeInSourceHalf === true) : [fact];
    assert.deepEqual(hit.sourceFactIds, accepted.map(row => row.factId));
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(only, interpretFortune(only, requestForFortuneRun(only), 'source-limit-counter'));
    assert.match(formatFortuneFactAudit(input), phrase);
    assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === rule.knowledgeId));
  }
});

test('p025 recognises each named trine pair at one actual Ziwei limit and retains any simultaneous counterbranch', () => {
  const rule = supportExamples.find(row => row.knowledgeId.endsWith('p025-001'));
  const cases = [
    ['1978-01-19', 6, 1990, '午', [['天府', '戌'], ['天相', '寅']], false],
    ['1978-01-26', 0, 1989, '未', [['左辅', '卯'], ['右弼', '亥']], true],
    ['1978-01-05', 3, 1997, '亥', [['文昌', '未'], ['文曲', '未']], true],
  ];
  for (const [dateStr, timeIndex, year, branch, expected, counter] of cases) {
    const submitted = submitYear(native({ dateStr, timeIndex }), year, 'ziwei-trine-pair-' + year);
    const fact = specific(submitted).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === year);
    const p = fact.normalizedPayload;
    assert.equal(p.ziweiSupportCandidate, false);
    assert.equal(p.ziweiThreeShaCandidate, counter);
    assert.equal(p.branch, branch);
    assert.equal(p.ziweiTrinePairCandidate, true);
    assert.deepEqual(p.namedSupport.ziwei.trinePairs, [expected.map(([star, branch]) => ({ star, branch, relation: '三合' }))]);
    const run = { ...submitted, facts: submitted.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = result(run, rule.knowledgeId);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ziwei-trine-pair'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(`紫微实守${branch}宫的当前限宫，${expected.map(([star, position]) => `${position}宫的${star}`).join('和')}均三合此限`));
    assert.equal(prompt.includes('紫微限诀另列三方的七杀、破军与贪狼'), counter);
    assert.doesNotMatch(prompt, /ziweiTrinePairCandidate|trinePairs/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  }

  const near = realRun({ dateStr: '1978-01-05', timeIndex: 1, year: 1986 });
  const fact = specific(near).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === 1986);
  const p = fact.normalizedPayload;
  assert.equal(p.namedSupport.ziwei.atLimit, true);
  assert.ok(p.sourceTrineStars.includes('天府') && p.sourceTrineStars.includes('左辅'));
  assert.ok(p.sourceLocalStars.includes('天相'));
  assert.equal(p.ziweiTrinePairCandidate, false);
  const run = { ...near, facts: near.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  assert.equal(result(run, rule.knowledgeId).status, 'not_matched');
});

test('p032 independently matches temple guards or all four same-limit Sha contacts', () => {
  for (const [birth, year, scope, branch, temple, sha, phrase] of [
    [{ timeIndex: 4 }, 2056, 'decadal', '未', true, false, /天梁在未宫入庙，与左辅、右弼实守同一限宫/u],
    [{ dateStr: '1960-05-05', timeIndex: 1 }, 2027, 'minor', '卯', false, true,
      /天梁实守卯宫的当前限宫。擎羊在酉宫，与天梁为冲，陀罗在未宫，与天梁为三合，归档火星在卯宫，与天梁为守，归档铃星在亥宫，与天梁为三合/u],
  ]) {
    const natal = native(birth);
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 15);
    const ref = { snapshotId: 'tianliang-conditions-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'tianliang-conditions', ref);
    validateFortuneFacts(run);
    const fact = specific(run).find(row => row.scope === scope && row.normalizedPayload.lunarYear === year);
    const p = fact.normalizedPayload;
    assert.equal(p.branch, branch);
    assert.equal(p.namedSupport.tianliang.branch, branch);
    assert.equal(p.tianliangSupportCandidate, false);
    assert.equal(p.tianliangTempleSupportCandidate, temple);
    assert.equal(p.tianliangCombinedShaCandidate, sha);
    const only = isolateSupport(run, fact);
    const rule = supportExamples.find(row => row.knowledgeId.endsWith('p032-001'));
    const hit = result(only, rule.knowledgeId);
    const eligible = only.facts.filter(row => timedSupport(row) && row.normalizedPayload.star === '天梁'
      && row.normalizedPayload.activeInSourceHalf === true);
    assert.equal(hit.status, temple ? 'not_matched' : 'partial');
    assert.deepEqual(hit.sourceFactIds, eligible.map(row => row.factId));
    assert.deepEqual(hit.windows, temple ? [] : [{ start: '2027-08-01T16:00:00.000Z', endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(only, interpretFortune(only, requestForFortuneRun(only), 'tianliang-conditions'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase);
    assert.doesNotMatch(prompt, /tianliangTempleSupportCandidate|tianliangCombinedShaCandidate/u);
    if (sha) {
      const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
      const firePalace = position(natal, '火星');
      for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
        firePalace[key] = firePalace[key].filter(row => row.name !== '火星');
      }
      const incomplete = quanshuSupportCondition(natal, index(p.branch), index(p.annualBranch), year, scope, index(p.otherBranch));
      assert.equal(incomplete.ready, true);
      assert.equal(incomplete.tianliangCombinedShaCandidate, undefined);
    }
  }
});

test('p032 confirms temple Tianliang with four seated helpers in both verified southern halves', () => {
  const year = 2013;
  const timedLiang = row => timedSupport(row) && row.normalizedPayload.star === '天梁' && row.normalizedPayload.lunarYear === year;
  const knowledgeId = supportExamples.find(row => row.knowledgeId.endsWith('p032-001')).knowledgeId;
  const entry = dateStr => {
    const engine = astro.withOptions({ dateStr, timeIndex: 3, gender: '男', fixLeap: true, config });
    const natal = engine.toJSON();
    const full = submitYear(natal, year, 'ming-liang-double-' + dateStr);
    const facts = full.facts.filter(timedLiang);
    const raw = specific(full).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === year);
    return { engine, natal, run: { ...full, facts }, data: raw.normalizedPayload };
  };
  const { engine, natal, run, data } = entry('1956-05-14');
  const original = data.namedSupport.tianliang;
  assert.deepEqual([data.branch, data.otherBranch, original.chapterGrade], ['未', '未', '庙']);
  assert.deepEqual(original.assistants.map(({ star, branch, relation }) => [star, branch, relation]),
    ['左辅', '右弼', '文昌', '文曲'].map(star => [star, '未', '守']));
  assert.deepEqual(original.quanshuFixedCounter.map(({ branch, relation }) => [branch, relation]),
    [['午', '邻宫'], ['辰', '其他'], ['寅', '其他'], ['戌', '其他']]);
  const exact = run.facts.filter(row => row.normalizedPayload.tianliangMingTempleDoubleGuardCandidate === true);
  const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
  assert.deepEqual(exact.map(row => [row.scope, row.activeFrom]).sort(), [['decadal', boundary], ['minor', boundary]]);
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  const plain = run.facts.filter(row => row.normalizedPayload.tianliangPlainMingClearGuardCandidate === true);
  assert.ok(plain.length > 0 && plain.every(row => row.scope === 'decadal' && row.activeTo <= boundary));
  assert.deepEqual(new Set(hit.sourceFactIds), new Set([...exact, ...plain].map(row => row.factId)));
  assert.deepEqual(hit.windows, [{ start: plain[0].activeFrom, endExclusive: exact[0].activeTo }]);
  const early = run.facts.filter(row => row.activeTo <= boundary);
  const earlyHit = result({ ...run, facts: early }, knowledgeId);
  assert.equal(earlyHit.status, 'matched');
  assert.equal(earlyHit.matchedSourceExcerpt, '作事求谋更吉昌');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-liang-double'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /左辅、右弼、文昌、文曲四曜与天梁同宫/u);
  assert.doesNotMatch(prompt, /未宫|tianliangMingTempleDoubleGuardCandidate/u);

  const adverse = entry('1950-05-21');
  assert.equal(adverse.data.tianliangTempleSupportCandidate, true);
  assert.deepEqual(adverse.data.namedSupport.tianliang.quanshuFixedCounter.map(({ relation }) => relation), ['其他', '守', '冲', '三合']);
  assert.ok(adverse.run.facts.every(row => row.normalizedPayload.tianliangMingTempleDoubleGuardCandidate === false));
  assert.equal(result(adverse.run, knowledgeId).status, 'partial');

  const sky = engine.horoscope(year + '-06-15', 6);
  const frame = { lunarYear: year, yearIndex: sky.yearly.index, minorIndex: sky.age.index,
    decadalIndex: sky.decadal.index, age: sky.age.nominalAge };
  const window = { start: Date.parse(exact[0].activeFrom), end: Date.parse(exact[0].activeTo) };
  for (const archive of [copyChartWithShiftedDecade(natal, frame), withWrongStarLayer(natal, ['文昌'], 'minorStars', 'adjectiveStars')]) {
    const limits = quanshuLimitBranches(archive, frame);
    const [timing] = quanshuLimitTiming(archive, limits, window, frame);
    const support = quanshuSupportCondition(archive, frame.minorIndex, frame.yearIndex, year, 'minor', frame.decadalIndex);
    const normalizedPayload = quanshuTimedSupport(timing.data, support, 'minor', limits.minorBranch).find(row => row.star === '天梁');
    assert.equal(normalizedPayload.tianliangMingTempleDoubleGuardCandidate, undefined);
    assert.equal(normalizedPayload.tianliangPlainGuardCandidate, true);
    const fallback = result({ ...run, facts: [{ ...exact.find(row => row.scope === 'minor'), normalizedPayload }] }, knowledgeId);
    assert.equal(fallback.status, 'matched');
    assert.equal(fallback.matchedSourceExcerpt, '作事求谋更吉昌');
  }
});

test('p032 and p034 confirm one actual support palace trining both verified guards only in their source half', () => {
  const cases = [
    { dateStr: '1956-05-16', timeIndex: 3, gender: '男', year: 1973, star: '天梁', entry: '032', first: false,
      branch: '卯', helper: '未', stem: 'tianliangMingTempleTrineDoubleGuard', prior: 'tianliangMingTempleDoubleGuardCandidate',
      auditPhrase: '大小限实守卯宫庙地天梁，左辅、右弼、文昌、文曲均在未宫三合',
      phrase: /左辅、右弼、文昌、文曲四曜由同一三合宫会天梁/u },
    { dateStr: '1976-11-27', timeIndex: 1, gender: '女', year: 2029, star: '文曲', entry: '034', first: true,
      branch: '巳', helper: '丑', stem: 'wenquMingTongTrineDoubleGuard', prior: 'wenquMingDoubleGuardCandidate',
      auditPhrase: '大小限实守巳宫文曲，左辅、右弼与天同同在丑宫三合',
      phrase: /左辅、右弼实守同一颗天同，三曜由同一三合宫会文曲/u },
  ];
  for (const example of cases) {
    const { dateStr, timeIndex, gender, year, star, entry, first, branch, helper, stem, prior, phrase, auditPhrase } = example;
    const selector = `${stem}Candidate`, witness = `${stem}Witness`;
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON(), bound = submitYear(natal, year, `${stem}-${year}`);
    const run = { ...bound, facts: bound.facts.filter(row => timedSupport(row)
      && row.normalizedPayload.star === star && row.normalizedPayload.lunarYear === year) };
    const rule = supportExamples.find(row => row.knowledgeId.endsWith(`p${entry}-001`)).knowledgeId;
    const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
    const matchingFacts = run.facts.filter(row => row.normalizedPayload[selector] === true);
    assert.deepEqual([...new Set(matchingFacts.map(row => row.scope))].sort(), ['decadal', 'minor']);
    const hit = result(run, rule);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.windows.length, 1);
    const strengthened = result({ ...run, facts: matchingFacts }, rule);
    assert.equal(first ? strengthened.windows[0].endExclusive : strengthened.windows[0].start, boundary);
    const plain = run.facts.filter(row => row.normalizedPayload.tianliangPlainMingClearGuardCandidate === true);
    assert.deepEqual(new Set(hit.sourceFactIds), new Set([...matchingFacts, ...plain].map(row => row.factId)));
    for (const fact of matchingFacts) {
      const data = fact.normalizedPayload, proof = data[witness];
      assert.equal(data.branch, branch);
      assert.equal(data[prior], false);
      const assistingStars = first ? ['左辅', '右弼'] : ['左辅', '右弼', '文昌', '文曲'];
      assert.deepEqual(proof.assistants, assistingStars.map(star => ({ star, branch: helper, relation: first ? '守' : '三合' })));
      assert.equal(proof.assistantBranch ?? proof.tongBranch, helper);
      assert.equal(proof.tianliangBranch ?? proof.wenquBranch, branch);
      if (!first) assert.deepEqual(proof.namedSha.map(row => row.relation), ['其他', '邻宫', '邻宫', '其他']);
    }
    const oppositeHalf = run.facts.filter(row => first ? row.activeFrom >= boundary : row.activeTo <= boundary);
    assert.ok(oppositeHalf.length);
    assert.ok(oppositeHalf.every(row => row.normalizedPayload[selector] !== true));
    const other = result({ ...run, facts: oppositeHalf }, rule);
    assert.equal(other.status === 'matched', !first);
    if (!first) assert.equal(other.matchedSourceExcerpt, '作事求谋更吉昌');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), stem));
    assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule));
    assert.ok(formatFortuneFactAudit(input).includes(auditPhrase), auditPhrase);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, phrase);
    assert.ok(!prompt.includes(`${helper}宫`) && !prompt.includes(selector) && !prompt.includes(auditPhrase));

    const incomplete = structuredClone(natal), jumen = position(incomplete, '巨门');
    jumen.majorStars = jumen.majorStars.filter(row => row.name !== '巨门');
    const recovered = submitYear(incomplete, year, `${stem}-unrelated-star-missing-${year}`);
    assert.ok(specific(recovered).some(row => row.normalizedPayload.reason === 'incomplete_major_positions'));
    const recoveredFacts = recovered.facts.filter(row => timedSupport(row) && row.normalizedPayload.star === star
      && row.normalizedPayload.lunarYear === year);
    const recoveredHit = result({ ...recovered, facts: recoveredFacts }, rule);
    assert.equal(recoveredHit.status, 'matched');
    assert.deepEqual(recoveredHit.windows, hit.windows);
    const positive = recoveredFacts.filter(row => row.normalizedPayload[selector] === true);
    assert.equal(positive.length, matchingFacts.length);
    assert.deepEqual(positive.map(row => row.normalizedPayload[witness]), matchingFacts.map(row => row.normalizedPayload[witness]));

    const frame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-15`, 6);
      return { lunarYear, yearIndex: h.yearly.index, minorIndex: h.age.index,
        decadalIndex: h.decadal.index, age: h.age.nominalAge };
    };
    const correct = matchingFacts.find(row => row.scope === 'minor');
    const timedAt = (archive, context) => {
      const limits = quanshuLimitBranches(archive, context);
      const start = quanshuLunarMidnight(context.lunarYear, first ? 1 : 7);
      const [timing] = quanshuLimitTiming(archive, limits, { start, end: start + 86400000 }, context);
      const support = quanshuSupportCondition(archive, context.minorIndex, context.yearIndex,
        context.lunarYear, 'minor', context.decadalIndex);
      return quanshuTimedSupport(timing.data, support, 'minor', limits.minorBranch,
        quanshuMingGroupsFromVerifiedLimits(limits)).find(row => row.star === star);
    };
    const current = frame(year), next = frame(year + 1);
    assert.equal(timedAt(natal, next)[selector], false);
    for (const archive of [copyChartWithShiftedDecade(natal, current), withWrongStarLayer(natal, ['左辅'], 'minorStars', 'adjectiveStars'),
      withWrongStarLayer(incomplete, first ? ['天同'] : ['左辅'], first ? 'majorStars' : 'minorStars', 'adjectiveStars')]) {
      const payload = timedAt(archive, current);
      assert.equal(payload[selector], undefined);
      assert.equal(payload[witness], undefined);
      const confirmations = evaluateFortuneRules('ziwei', 'year', [{ ...correct, normalizedPayload: payload }])
        .find(row => row.knowledgeId === rule).confirmations;
      const exact = confirmations.find(row => row.condition.includes(selector));
      assert.deepEqual([exact.hits.length, exact.unknown], [0, true]);
    }
  }
});

test('p034 confirms verified distributed assistants meeting Tian Tong within the same trine group', () => {
  const cases = [
    { birth: { dateStr: '1964-08-06', timeIndex: 1, gender: '女' }, year: 1981,
      wenqu: '巳', tong: '丑', assistants: [['左辅', '酉', '三合'], ['右弼', '巳', '三合']] },
    { birth: { dateStr: '1976-03-03', timeIndex: 5, gender: '女' }, year: 1989,
      wenqu: '酉', tong: '酉', assistants: [['左辅', '巳', '三合'], ['右弼', '酉', '守']] },
    { birth: { dateStr: '1976-01-11', timeIndex: 11, gender: '女' }, year: 1997,
      wenqu: '卯', tong: '卯', outsideHalf: true },
    { birth: { dateStr: '1976-02-01', timeIndex: 2, gender: '男' }, year: 2044,
      wenqu: '午', tong: '午', outside: true },
  ];
  const field = 'wenquMingDistributedDoubleGuardCandidate';
  const knowledgeId = supportExamples.find(row => row.knowledgeId.endsWith('p034-001')).knowledgeId;
  for (const { birth, year, wenqu, tong, assistants, outside, outsideHalf } of cases) {
    const raw = native(birth);
    const bound = submitYear(raw, year, 'wenqu-distributed');
    const applicable = row => timedSupport(row) && row.normalizedPayload.star === '文曲'
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload.branch === wenqu;
    const run = { ...bound, facts: bound.facts.filter(applicable) };
    assert.ok(run.facts.length);
    const check = facts => evaluateFortuneRules('ziwei', 'year', facts).find(row => row.knowledgeId === knowledgeId)
      .confirmations.find(row => JSON.parse(row.condition).where[field] === true);
    const hits = check(run.facts).hits;
    if (outside || outsideHalf) {
      assert.equal(hits.length, 0);
      const locations = ['左辅', '右弼', '天同'].map(star => position(raw, star).earthlyBranch);
      assert.deepEqual(locations, outside ? ['辰', '戌', '午'] : ['卯', '亥', '卯']);
      assert.equal(run.facts.some(row => row.scope === 'decadal' && row.normalizedPayload.activeInSourceHalf === true), !outsideHalf);
      continue;
    }
    const start = new Date(quanshuLunarMidnight(year, 1)).toISOString();
    const endExclusive = new Date(quanshuLunarMidnight(year, 7)).toISOString();
    assert.deepEqual([...new Set(hits.map(row => row.scope))].sort(), ['decadal', 'minor']);
    for (const row of hits) {
      assert.equal(row.activeFrom, start);
      assert.equal(row.activeTo, endExclusive);
      const witness = row.normalizedPayload.wenquMingDistributedDoubleGuardWitness;
      assert.deepEqual([witness.wenquBranch, witness.tongBranch], [wenqu, tong]);
      assert.deepEqual(witness.assistants.map(row => [row.star, row.branch, row.relation]), assistants);
    }
    const found = result(run, knowledgeId);
    assert.equal(found.status, 'matched');
    assert.ok(found.matchedSourceExcerpt.split('\n').includes('更添左右会天同'));
    assert.deepEqual(found.windows, [{ start, endExclusive }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'wenqu-distributed'));
    assert.match(formatFortuneFactAudit(input), /左辅、右弼与天同在同一组三合宫/u);
    assert.match(formatFortunePrompt(input), /左辅、右弼分别同守或三合天同/u);
    assert.doesNotMatch(formatFortunePrompt(input), /wenquMingDistributed|左辅、右弼与天同在同一组三合宫/u);
    if (year === 1981) {
      const wrongLayer = withWrongStarLayer(raw, ['右弼'], 'minorStars', 'adjectiveStars');
      const changed = submitYear(wrongLayer, year, 'wenqu-distributed-wrong-layer').facts.filter(applicable);
      assert.ok(changed.some(row => row.normalizedPayload.activeInSourceHalf === true));
      assert.equal(check(changed).hits.length, 0);
    }
  }
});

test('p032 and p034 confirm named support from verified separate seats in the relevant dual-limit phases', () => {
  const cases = [
    { dateStr: '1976-12-03', timeIndex: 1, year: 2015, phase: 7, branch: '丑', star: '天梁', passage: '032',
      stem: 'tianliangMingTempleDistributedDoubleGuard', excerpt: '若加吉曜逢庙地', oldTrine: 'tianliangMingTempleTrineDoubleGuardCandidate',
      positions: [['左辅', '丑', '守'], ['右弼', '丑', '守'], ['文昌', '酉', '三合'], ['文曲', '巳', '三合']] },
    { dateStr: '1976-11-24', timeIndex: 5, year: 2011, phase: 1, branch: '酉', star: '文曲', passage: '034',
      stem: 'wenquMingSeatedTongTrineAssistantsDoubleGuard', excerpt: '更添左右会天同', oldTrine: 'wenquMingTongTrineDoubleGuardCandidate',
      positions: [['左辅', '丑', '三合'], ['右弼', '丑', '三合']] },
  ];
  for (const { dateStr, timeIndex, year, phase, branch, star, passage, stem, excerpt, oldTrine, positions } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config }), natal = engine.toJSON();
    const bound = submitYear(natal, year, stem);
    const scope = row => timedSupport(row) && row.normalizedPayload.star === star && row.normalizedPayload.lunarYear === year;
    const run = { ...bound, facts: bound.facts.filter(scope) };
    const candidate = `${stem}Candidate`, witness = `${stem}Witness`;
    const active = run.facts.filter(row => row.normalizedPayload[candidate] === true);
    assert.deepEqual([...new Set(active.map(row => row.scope))].sort(), ['decadal', 'minor']);
    const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
    const expectedRange = phase === 1 ? {
      start: new Date(quanshuLunarMidnight(year, 1)).toISOString(), endExclusive: boundary,
    } : { start: boundary, endExclusive: new Date(`${year + 1}-01-01T00:00:00+08:00`).toISOString() };
    const rule = supportExamples.find(row => row.knowledgeId.endsWith(`p${passage}-001`)).knowledgeId;
    const hit = result(run, rule);
    assert.equal(hit.status, 'matched');
    assert.ok(hit.matchedSourceExcerpt.split('\n').includes(excerpt));
    const confirmationFor = facts => evaluateFortuneRules('ziwei', 'year', facts)
      .find(row => row.knowledgeId === rule).confirmations.find(row => row.condition.includes(candidate));
    assert.equal(confirmationFor(run.facts).hits.length, active.length);
    assert.deepEqual(result({ ...run, facts: active }, rule).windows, [expectedRange]);
    const plain = run.facts.filter(row => row.normalizedPayload.tianliangPlainMingClearGuardCandidate === true);
    assert.deepEqual(new Set(hit.sourceFactIds), new Set([...active, ...plain].map(row => row.factId)));
    for (const { normalizedPayload: data } of active) {
      assert.equal(data.branch, branch);
      assert.equal(data[oldTrine], false);
      const evidence = data[witness];
      assert.deepEqual(evidence.assistants.map(row => [row.star, row.branch, row.relation]), positions);
      if (star === '文曲') assert.deepEqual([evidence.wenquBranch, evidence.tongBranch], [branch, branch]);
      else assert.ok(evidence.namedSha.every(row => !['守', '冲', '三合'].includes(row.relation)));
    }
    const otherHalf = run.facts.filter(row => phase === 1 ? row.activeFrom >= boundary : row.activeTo <= boundary);
    assert.ok(otherHalf.length > 0);
    assert.ok(otherHalf.every(row => row.normalizedPayload[candidate] !== true));
    const other = result({ ...run, facts: otherHalf }, rule);
    assert.equal(other.status === 'matched', star === '天梁');
    if (star === '天梁') assert.equal(other.matchedSourceExcerpt, '作事求谋更吉昌');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), stem));
    const local = star === '文曲' ? /大小限同守酉宫文曲和天同.*左辅在丑宫三合/u
      : /大小限同守丑宫庙地天梁.*明刊羊、陀、火、铃均复算未到会/u;
    assert.match(formatFortuneFactAudit(input), local);
    const prompt = formatFortunePrompt(input);
    assert.ok(prompt.includes(excerpt));
    assert.doesNotMatch(prompt, new RegExp(`${stem}|${branch}宫`, 'u'));

    const frame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-15`, 6);
      return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index,
        age: h.age.nominalAge };
    };
    const payloadAt = (archive, current) => {
      const limits = quanshuLimitBranches(archive, current);
      const start = quanshuLunarMidnight(current.lunarYear, phase);
      const [timing] = quanshuLimitTiming(archive, limits, { start, end: start + 86400000 }, current);
      const support = quanshuSupportCondition(archive, current.decadalIndex, current.yearIndex, current.lunarYear, 'decadal', current.minorIndex);
      return quanshuTimedSupport(timing.data, support, 'decadal', limits.decadalBranch,
        quanshuMingGroupsFromVerifiedLimits(limits)).find(row => row.star === star);
    };
    const current = frame(year), next = frame(year + 1);
    assert.equal(payloadAt(natal, next)[candidate], false);
    for (const [archive, sourceFrame] of [
      [withWrongStarLayer(natal, ['左辅'], 'minorStars', 'adjectiveStars'), current],
      [natal, { ...current, minorIndex: (current.minorIndex + 1) % 12 }],
    ]) {
      const normalizedPayload = payloadAt(archive, sourceFrame);
      assert.equal(normalizedPayload[candidate], undefined);
      assert.equal(normalizedPayload[witness], undefined);
      const template = active.find(row => row.scope === 'decadal');
      const confirmation = confirmationFor([{ ...template, normalizedPayload }]);
      assert.deepEqual([confirmation.hits.length, confirmation.unknown], [0, true]);
    }
    if (star === '文曲') {
      const shiftedBirth = astro.withOptions({ dateStr: '1976-11-25', timeIndex, gender: '男', fixLeap: true, config }).toJSON();
      assert.equal(shiftedBirth.rawDates.lunarDate.lunarMonth, natal.rawDates.lunarDate.lunarMonth);
      for (const palace of shiftedBirth.palaces) {
        palace.majorStars = natal.palaces.find(row => row.index === palace.index).majorStars.filter(row => row.name !== '巨门');
      }
      const displaced = payloadAt(shiftedBirth, current);
      assert.equal(displaced.wenquPlainDoubleGuardCandidate, true);
      assert.equal(displaced[candidate], undefined);
      assert.equal(displaced[witness], undefined);
      const template = active.find(row => row.scope === 'decadal');
      const facts = [{ ...template, normalizedPayload: displaced }];
      const confirmation = confirmationFor(facts);
      assert.deepEqual([confirmation.hits.length, confirmation.unknown], [0, true]);
      assert.equal(result({ ...run, facts }, rule).matchedSourceExcerpt, '二限相逢文曲星');
    }
  }
});

test('p032 and p034 confirm their separate foundations while retaining opposite support as timed candidates', () => {
  const cases = [
    { dateStr: '1952-05-11', timeIndex: 3, year: 1973, star: '天梁', name: 'tianliang', passage: '032', first: false,
      names: ['左辅', '右弼', '文昌', '文曲'], selector: 'tianliangPlainMingClearDoubleGuardCandidate', excerpt: '作事求谋更吉昌' },
    { dateStr: '1950-06-07', timeIndex: 9, year: 2025, star: '文曲', name: 'wenqu', passage: '034', first: true,
      names: ['左辅', '右弼', '天同'], selector: 'wenquPlainDoubleGuardCandidate', excerpt: '二限相逢文曲星' },
  ];
  for (const { dateStr, timeIndex, year, star, name, passage, first, names, selector, excerpt } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = engine.toJSON();
    const bound = submitYear(natal, year, `two-opposed-supports-${year}`);
    const raw = specific(bound).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === year);
    assert.ok(raw);
    const support = raw.normalizedPayload.namedSupport[name];
    assert.equal(support.branch, '丑');
    assert.deepEqual(support.companions ?? support.assistants, names.map(star => ({ star, branch: '未', relation: '冲' })));
    if (name === 'tianliang') {
      assert.equal(support.chapterGrade, '庙');
      assert.ok(support.quanshuFixedCounter.every(row => !['守', '冲', '三合'].includes(row.relation)));
    } else {
      assert.ok(support.tongAssistants.every(row => row.branch === '未' && row.relation === '守'));
    }
    const facts = bound.facts.filter(row => timedSupport(row) && row.normalizedPayload.star === star
      && row.normalizedPayload.lunarYear === year);
    assert.deepEqual([...new Set(facts.filter(row => row.normalizedPayload[`${name}SupportCandidate`] === true)
      .map(row => row.scope))].sort(), ['decadal', 'minor']);
    const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
    const run = { ...bound, facts };
    const rule = supportExamples.find(row => row.knowledgeId.endsWith(`p${passage}-001`)).knowledgeId;
    const hit = result(run, rule);
    const enhanced = name === 'wenqu' ? ['wenquMingDoubleGuardCandidate', 'wenquMingTongTrineDoubleGuardCandidate']
      : ['tianliangMingTempleDoubleGuardCandidate', 'tianliangMingTempleTrineDoubleGuardCandidate'];
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, excerpt);
    assert.ok(hit.sourceFactIds.every(id => {
      const source = facts.find(row => row.factId === id).normalizedPayload;
      const verified = source[selector] === true || name === 'tianliang' && source.tianliangPlainMingClearGuardCandidate === true;
      return verified && enhanced.every(key => source[key] === false);
    }));
    const minor = facts.filter(row => row.scope === 'minor');
    const minorHit = result({ ...run, facts: minor }, rule);
    assert.equal(minorHit.status, 'matched');
    assert.equal(minorHit.windows.length, 1);
    assert.equal(first ? minorHit.windows[0].endExclusive : minorHit.windows[0].start, boundary);
    const outside = minor.filter(row => first ? row.activeFrom >= boundary : row.activeTo <= boundary);
    assert.ok(outside.length);
    assert.equal(result({ ...run, facts: outside }, rule).status, 'not_matched');
    const h = engine.horoscope(`${year}-06-15`, 6);
    const misplaced = withWrongStarLayer(natal, ['左辅'], 'minorStars', 'adjectiveStars');
    const unverified = quanshuSupportCondition(misplaced, h.age.index, h.yearly.index, year, 'minor', h.decadal.index);
    assert.equal(unverified[`${name}SupportCandidate`], undefined);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
    const active = facts.find(row => row.scope === 'decadal' && row.normalizedPayload[selector] === true);
    const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
    const evaluate = (chart, current) => {
      const limits = quanshuLimitBranches(chart, current);
      const [binding] = quanshuLimitTiming(chart, limits, window, current);
      const source = quanshuSupportCondition(chart, current.decadalIndex, current.yearIndex, year, 'decadal', current.minorIndex);
      return quanshuTimedSupport(binding.data, source, 'decadal', limits.decadalBranch, quanshuMingGroupsFromVerifiedLimits(limits))
        .find(row => row.star === star);
    };
    const withoutHelper = evaluate(misplaced, frame);
    assert.equal(withoutHelper[selector], true);
    const badMinor = evaluate(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
    assert.equal(badMinor[selector], undefined);
    const remaining = result({ ...run, facts: [{ ...active, normalizedPayload: badMinor }] }, rule);
    assert.equal(remaining.status === 'matched', name === 'tianliang');
    if (name === 'tianliang') {
      assert.equal(badMinor.tianliangPlainMingClearGuardCandidate, true);
      assert.equal(remaining.matchedSourceExcerpt, excerpt);
    }
    const wrongStar = withWrongStarLayer(natal, [star], first ? 'minorStars' : 'majorStars', 'adjectiveStars');
    assert.equal(evaluate(wrongStar, frame)[selector], undefined);
    if (name === 'tianliang') {
      assert.equal(evaluate(withWrongStarLayer(natal, ['擎羊'], 'minorStars', 'adjectiveStars'), frame)[selector], undefined);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), `two-opposed-supports-${year}`));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === rule)));
    const auditDetail = `复算大小限同守丑宫庙地${star}`;
    assert.ok(formatFortuneFactAudit(input).includes(auditDetail));
    const prompt = formatFortunePrompt(input);
    assert.ok(prompt.includes(excerpt));
    assert.ok(!prompt.includes(auditDetail));
    assert.doesNotMatch(prompt, /未宫|PlainMingClearDoubleGuardCandidate|wenquPlainDoubleGuardCandidate/u);
  }
});

test('p034 confirms both verified northern limits at all three Ming prospering Wenqu seats', () => {
  const cases = [
    ['1980-03-11', 11, 1987, '卯', '1987-01-28T16:00:00.000Z', '1987-08-23T16:00:00.000Z'],
    ['1988-08-15', 7, 2011, '亥', '2011-02-02T16:00:00.000Z', '2011-07-30T16:00:00.000Z'],
    ['1950-03-15', 3, 1995, '未', '1995-01-30T16:00:00.000Z', '1995-07-26T16:00:00.000Z'],
  ];
  const field = 'wenquBrightMingDoubleGuardCandidate';
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p034-001')).knowledgeId;
  for (const [dateStr, timeIndex, year, branch, start, endExclusive] of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }), natal = engine.toJSON();
    const run = submitYear(natal, year, 'ming-wenqu-bright-' + branch);
    const facts = run.facts.filter(row => timedSupport(row) && row.scope === 'minor'
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload.star === '文曲');
    const active = facts.filter(row => row.normalizedPayload[field] === true);
    const outside = facts.filter(row => row.activeFrom >= endExclusive);
    assert.ok(active.length && outside.length, branch);
    assert.ok(active.every(row => row.normalizedPayload.branch === branch && row.normalizedPayload.wenquPlainDoubleGuardCandidate === false));
    assert.ok(outside.every(row => row.normalizedPayload[field] === false));
    const scoped = { ...run, facts: active }, hit = result(scoped, rule);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start, endExclusive }]);
    assert.match(hit.matchedSourceExcerpt, /二限若逢文曲星/u);
    const exact = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...active[0], normalizedPayload }])
      .find(row => row.knowledgeId === rule).confirmations.find(row => row.condition.includes(field));
    assert.equal(exact(active[0].normalizedPayload).hits.length, 1);
    assert.deepEqual([exact(outside[0].normalizedPayload).hits.length, exact(outside[0].normalizedPayload).unknown], [0, false]);

    const h = engine.horoscope(year + '-06-01', 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
    const window = { start: Date.parse(start), end: Date.parse(endExclusive) };
    const verify = (archive, current) => {
      const limits = quanshuLimitBranches(archive, current);
      const [timing] = quanshuLimitTiming(archive, limits, window, current);
      const source = quanshuSupportCondition(archive, current.decadalIndex, current.yearIndex, year, 'decadal', current.minorIndex);
      return quanshuTimedSupport(timing.data, source, 'decadal', limits.decadalBranch, quanshuMingGroupsFromVerifiedLimits(limits))
        .find(row => row.star === '文曲');
    };
    for (const missing of [verify(withWrongStarLayer(natal, ['文曲'], 'minorStars', 'adjectiveStars'), frame),
      verify(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 })]) {
      assert.equal(missing[field], undefined);
      assert.deepEqual([exact(missing).hits.length, exact(missing).unknown], [0, true]);
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-wenqu-bright'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /二限若逢文曲星/u);
    assert.doesNotMatch(prompt, /wenquBrightMingDoubleGuardCandidate|复算大小限同守[卯亥未]宫/u);
  }
});

test('p032 confirms the named-sha-clear single Tianliang decade after the double-guard year', () => {
  const birth = { dateStr: '1956-05-16', timeIndex: 3, gender: '男' }, year = 1974;
  const engine = astro.withOptions({ ...birth, fixLeap: true, config }), natal = engine.toJSON();
  const run = submitYear(natal, year, 'tianliang-single-clear-decade');
  const fact = specific(run).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === year);
  assert.equal(fact.normalizedPayload.namedSupport.tianliang.branch, '卯');
  assert.equal(fact.normalizedPayload.otherBranch, '辰');
  assert.equal(fact.normalizedPayload.namedSupport.tianliang.mingClearNamedSha, true);
  const timedLiang = row => timedSupport(row) && row.normalizedPayload.star === '天梁'
    && row.normalizedPayload.lunarYear === year;
  const rows = run.facts.filter(timedLiang);
  const selector = 'tianliangPlainMingClearGuardCandidate';
  const knowledgeId = supportExamples.find(row => row.knowledgeId.endsWith('p032-001')).knowledgeId;
  const active = rows.filter(row => row.normalizedPayload[selector] === true);
  assert.ok(active.length > 0 && active.every(row => row.scope === 'decadal'
    && row.normalizedPayload.guardScopes.join() === 'decadal' && row.normalizedPayload.tianliangPlainMingClearDoubleGuardCandidate === false));
  const scoped = { ...run, facts: rows }, hit = result(scoped, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '作事求谋更吉昌');
  assert.deepEqual(hit.windows, [{ start: active[0].activeFrom, endExclusive: active.at(-1).activeTo }]);
  const asOf = engine.horoscope('1974-09-01', 6);
  const frame = { lunarYear: year, decadalIndex: asOf.decadal.index, minorIndex: asOf.age.index, yearIndex: asOf.yearly.index,
    age: year - natal.rawDates.lunarDate.lunarYear + 1 };
  const check = (archive, sourceFrame) => {
    const limits = quanshuLimitBranches(archive, sourceFrame);
    const from = quanshuLunarMidnight(sourceFrame.lunarYear, 7);
    const [timing] = quanshuLimitTiming(archive, limits, { start: from, end: from + 1 }, sourceFrame);
    const context = quanshuSupportCondition(archive, sourceFrame.decadalIndex, sourceFrame.yearIndex, sourceFrame.lunarYear,
      'decadal', sourceFrame.minorIndex);
    return quanshuTimedSupport(timing.data, context, 'decadal', limits.decadalBranch, quanshuMingGroupsFromVerifiedLimits(limits))
      .find(row => row.star === '天梁');
  };
  const altered = withWrongStarLayer(natal, ['擎羊'], 'minorStars', 'adjectiveStars');
  assert.equal(check(altered, frame)[selector], undefined);
  const early = engine.horoscope('1972-09-01', 6);
  const earlyFrame = { ...frame, lunarYear: 1972, decadalIndex: early.decadal.index, minorIndex: early.age.index, yearIndex: early.yearly.index,
    age: frame.age - 2 };
  assert.equal(check(natal, earlyFrame)[selector], false);
  const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'tianliang-single-clear-decade')).input;
  assert.match(formatFortunePrompt(input), /作事求谋更吉昌/u);
  assert.doesNotMatch(formatFortunePrompt(input), /卯宫|tianliangPlainMingClearGuardCandidate/u);
});

test('p032 matches plain Tianliang only during its own verified active half', () => {
  const example = { dateStr: '1983-12-15', timeIndex: 0, gender: '女', year: 2003 };
  const run = realRun(example);
  const rawGuard = specific(run).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === example.year);
  assert.equal(rawGuard.normalizedPayload.namedSupport.sourceMinorVerified, true);
  assert.equal(rawGuard.normalizedPayload.tianliangPlainGuardCandidate, true);
  const scoped = facts => facts.filter(f => timedSupport(f) && f.normalizedPayload.star === '天梁');
  const rows = scoped(run.facts).filter(f => f.normalizedPayload.lunarYear === example.year);
  const guards = rows.filter(f => f.normalizedPayload.tianliangPlainGuardCandidate === true);
  assert.ok(guards.length > 1);
  assert.ok(guards.every(fact => fact.scope === 'minor' && fact.normalizedPayload.branch === '巳'));
  const active = guards.filter(fact => fact.normalizedPayload.activeInSourceHalf === true);
  const inactive = guards.filter(fact => fact.normalizedPayload.activeInSourceHalf === false);
  assert.ok(active.length && inactive.length);
  for (const fact of active) {
    assert.deepEqual(fact.normalizedPayload.guardScopes, ['minor']);
    for (const old of ['tianliangSupportCandidate', 'tianliangTempleSupportCandidate', 'tianliangCombinedShaCandidate',
      'tianliangQuanshuFixedCombinedShaCandidate', 'tianliangJielanFireBellOpposedTrineCandidate']) {
      assert.equal(fact.normalizedPayload[old], false, old);
    }
  }
  const knowledgeId = supportExamples.find(row => row.knowledgeId.endsWith('p032-001')).knowledgeId;
  const limited = { ...run, facts: rows };
  const hit = result(limited, knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, active.map(fact => fact.factId));
  assert.deepEqual(hit.windows, [{ start: new Date(quanshuLunarMidnight(example.year, 7)).toISOString(), endExclusive: rawGuard.activeTo }]);
  const { input } = buildFortuneModelContext(limited, interpretFortune(limited, requestForFortuneRun(limited), 'tianliang-plain-guard'));
  assert.match(formatFortuneFactAudit(input), /本段也符合明刊天梁入限诀的独立守限条件/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊天梁入限诀|tianliangPlainGuardCandidate/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
  assert.equal(result({ ...run, facts: inactive }, knowledgeId).status, 'not_matched');
  for (const year of [2002, 2004]) {
    const near = realRun({ ...example, year });
    const facts = scoped(near.facts).filter(f => f.normalizedPayload.lunarYear === year);
    assert.ok(facts.length);
    assert.ok(facts.every(f => f.normalizedPayload.tianliangPlainGuardCandidate === false));
    assert.equal(result({ ...near, facts }, knowledgeId).status, 'not_matched');
  }
});

test('p032 verifies the plain Tianliang guard independently of missing unrelated auxiliaries', () => {
  const example = { dateStr: '1983-12-15', timeIndex: 0, gender: '女', year: 2003 };
  const natal = native(example), auxiliary = position(natal, '左辅');
  auxiliary.minorStars = auxiliary.minorStars.filter(row => row.name !== '左辅');
  const bound = submitYear(natal, example.year, 'tianliang-guard-missing-auxiliary');
  const timedLiang = run => run.facts.filter(fact => timedSupport(fact) && fact.scope === 'minor'
    && fact.normalizedPayload.star === '天梁' && fact.normalizedPayload.lunarYear === example.year);
  const timed = timedLiang(bound), active = timed.filter(row => row.normalizedPayload.activeInSourceHalf === true);
  assert.ok(active.length && timed.some(row => row.normalizedPayload.activeInSourceHalf === false));
  const raw = specific(bound).find(row => row.scope === 'minor' && row.activeFrom <= active[0].activeFrom && row.activeTo >= active[0].activeTo);
  assert.deepEqual(raw.normalizedPayload, { ready: false, reason: 'inconsistent_source_auxiliary' });
  for (const { normalizedPayload: row } of active) {
    assert.equal(row.ready, true);
    assert.equal(row.tianliangPlainGuardCandidate, true);
    assert.deepEqual(row.guardScopes, ['minor']);
    assert.equal(row.tianliangSupportCandidate, undefined);
    assert.equal(row.tianliangCombinedShaCandidate, undefined);
  }
  const rule = supportExamples.find(row => row.knowledgeId.endsWith('p032-001'));
  const run = { ...bound, facts: timed }, hit = result(run, rule.knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, active.map(row => row.factId));
  assert.deepEqual(hit.windows, [{ start: new Date(quanshuLunarMidnight(example.year, 7)).toISOString(), endExclusive: raw.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianliang-guard-fallback'));
  assert.match(formatFortuneFactAudit(input), /明刊天梁入限诀的独立守限条件/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊天梁入限诀|tianliangPlainGuardCandidate/u);

  const misplaced = structuredClone(natal), liang = position(misplaced, '天梁');
  const [star] = liang.majorStars.splice(liang.majorStars.findIndex(row => row.name === '天梁'), 1);
  liang.adjectiveStars.push(star);
  const wrongRun = submitYear(misplaced, example.year, 'tianliang-guard-wrong-layer');
  const wrong = timedLiang(wrongRun);
  assert.ok(wrong.length);
  assert.ok(wrong.every(row => row.normalizedPayload.tianliangPlainGuardCandidate === undefined));
  assert.equal(result({ ...wrongRun, facts: wrong }, rule.knowledgeId).status, 'unknown');
});

test('Jielan Tianliang and Wenqu use their own verified minor half and exact named contacts', () => {
  const cases = [
    { dateStr: '1974-02-05', timeIndex: 4, year: 1995, branch: '丑', star: '天梁', entry: '032',
      flag: 'tianliangJielanFireBellOpposedTrineCandidate', version: 'jielanFireBellProfile', witness: 'tianliangJielanFireBellWitness',
      half: ['1995-07-26T16:00:00.000Z', '1995-12-31T16:00:00.000Z'],
      contacts: [{ star: '火星', branch: '巳', relation: '三合' }, { star: '铃星', branch: '未', relation: '冲' }],
      alternatives: ['tianliangSupportCandidate', 'tianliangTempleSupportCandidate', 'tianliangCombinedShaCandidate', 'tianliangQuanshuFixedCombinedShaCandidate'] },
    { dateStr: '1951-02-15', timeIndex: 10, year: 1964, branch: '寅', star: '文曲', entry: '034',
      flag: 'wenquJielanYinFallenCandidate', version: 'jielanDignityProfile', witness: 'wenquJielanYinFallenWitness',
      half: ['1964-02-12T16:00:00.000Z', '1964-08-07T16:00:00.000Z'],
      contacts: [{ star: '廉贞', branch: '戌', relation: '三合' }, { star: '陀罗', branch: '申', relation: '冲' },
        { star: '擎羊', branch: '戌', relation: '三合' }],
      alternatives: ['wenquSupportCandidate', 'wenquPairedLimitsCandidate', 'wenquChapterFallenCandidate'] },
  ];
  for (const { dateStr, timeIndex, year, branch, star, entry, flag, version, witness, half, contacts, alternatives } of cases) {
    const n = native({ dateStr, timeIndex, gender: '男' });
    const run = submitYear(n, year, `jielan-limit-${entry}`);
    const facts = run.facts.filter(row => timedSupport(row) && row.scope === 'minor' && row.normalizedPayload.lunarYear === year
      && row.normalizedPayload.star === star && row.normalizedPayload.branch === branch);
    const hits = facts.filter(row => row.normalizedPayload.activeInSourceHalf === true && row.normalizedPayload[flag] === true);
    assert.ok(hits.length > 0);
    for (const fact of hits) {
      assert.deepEqual(fact.normalizedPayload.guardScopes, ['minor']);
      assert.deepEqual(fact.normalizedPayload[witness], contacts);
      for (const key of alternatives) assert.equal(fact.normalizedPayload[key], false);
    }
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(`expansion-p${entry}-001`)).knowledgeId;
    const limited = { ...run, facts };
    const hit = result(limited, knowledgeId);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.windows, [{ start: half[0], endExclusive: half[1] }]);
    assert.deepEqual(hit.sourceFactIds, hits.map(row => row.factId));
    const { input } = buildFortuneModelContext(limited, interpretFortune(limited, requestForFortuneRun(limited), 'jielan-limit-contacts'));
    const audit = formatFortuneFactAudit(input);
    if (star === '文曲') assert.match(audit, /《捷览》列文曲在寅宫为陷/u);
    for (const row of contacts) assert.ok(audit.includes(`按《捷览》，${row.star}在${row.branch}宫，与${star}实守的限宫为${row.relation}`));
    assert.doesNotMatch(formatFortunePrompt(input), /《捷览》列文曲在寅宫为陷|按《捷览》，|JielanFireBellOpposedTrineCandidate/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
    const wrongSource = hits.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload, [version]: 'unverified' } }));
    const plainFlag = star === '天梁' ? 'tianliangPlainGuardCandidate' : 'wenquPlainGuardCandidate';
    assert.equal(result({ ...limited, facts: wrongSource }, knowledgeId).status, 'partial');
    const withoutPlain = wrongSource.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload, [plainFlag]: false } }));
    assert.equal(result({ ...limited, facts: withoutPlain }, knowledgeId).status, 'not_matched');
    const next = submitYear(n, year + 1, `jielan-limit-near-${entry}`);
    assert.ok(next.facts.filter(timedSupport).every(fact => fact.normalizedPayload.lunarYear !== year + 1
      || fact.scope !== 'minor' || fact.normalizedPayload[flag] !== true));
  }
});

test('p032 keeps the conflicting Shen verse grade as evidence without using it for the chapter temple branch', () => {
  const example = { dateStr: '1980-03-11', timeIndex: 2, year: 2026 };
  const run = realRun(example);
  const fact = specific(run).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === example.year);
  const p = fact.normalizedPayload;
  assert.equal(p.branch, '申');
  assert.equal(p.namedSupport.tianliang.chapterGrade, '陷');
  assert.equal(p.namedSupport.tianliang.verseTemple, true);
  assert.ok(p.namedSupport.tianliang.assistants.some(row => row.star === '文昌' && row.relation === '守'));
  assert.equal(p.tianliangTempleSupportCandidate, false);
  const only = isolateSupport(run, fact);
  assert.equal(result(only, supportExamples.find(row => row.knowledgeId.endsWith('p032-001')).knowledgeId).status, 'not_matched');
});

test('Chinese input explains independent source positions, unordered noble differences and unknown rescue without raw machine fields or partial findings', () => {
  const run = calculate(chart(native({ dateStr: '1986-05-05' }))), report = interpretFortune(run, requestForFortuneRun(run), 'support-prompt');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.ok(input.facts.some(f => f.type === 'quanshu_support_condition'));
  for (const phrase of ['独立核辅弼昌曲', '魁钺无序支位组为亥、戌', '来源组不冒称默认本命星位', '已核几何不等于扶救成立', '不自动解决条文流年禄']) assert.ok(prompt.includes(phrase), phrase);
  for (const token of ['sourceRelations', 'decadalAreaStars', 'quanshu-auxiliary-limits-atomic-v1', 'different_pair', 'support-run', 'support-snapshot']) assert.ok(!prompt.includes(token), token);
  const partialIds = new Set(reference.examples.map(e => e.knowledgeId));
  assert.ok(!input.sections.flatMap(s => s.findings).some(f => partialIds.has(f.knowledgeId)));
  const row = quanshuSupportCondition(native(), 0, 4, 2026, 'minor');
  const text = describeFortuneFact({ method: 'ziwei', type: 'quanshu_support_condition', data: row }, String);
  assert.match(text, /大限位置未提供/u); assert.ok(!/[{}\[\]]/u.test(text));
});

test('four auxiliary, four literary and three limit-branch reviews retain original hashes and mapped scope', () => {
  const rows = fortuneKnowledge.ziwei.rules.filter(r => r.queries[0]?.factType === 'quanshu_support_condition'
    || r.queries[0]?.where.sourceFactType === 'quanshu_support_condition');
  assert.equal(rows.length, 4);
  assert.equal(fortuneKnowledge.ziwei.rules.filter(r => r.queries[0]?.factType === 'quanshu_literary_limits').length, 4);
  assert.equal(fortuneKnowledge.ziwei.rules.filter(r => r.queries[0]?.factType === 'quanshu_limit_branches').length, 2);
  for (const [rule, profile] of [[rows, quanshuSupportPolicy.profile], [literaryRules, quanshuLiteraryLimitsPolicy.profile],
    [branchRules.slice(0, 2), quanshuLimitBranchesPolicy.profile], [branchRules.slice(2), quanshuLimitTimingPolicy.profile]]
    .flatMap(([rules, token]) => rules.map(rule => [rule, token]))) {
    const entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    if (rule === literaryRules[0] || rule === branchRules[2]) assert.deepEqual(rule.unresolved, []);
    else assert.ok(rule.unresolved.length);
    assert.equal(rule.queries[0].where.sourceProfile ?? rule.queries[0].where.profile, profile);
    assert.ok(rule.review.supportingSources.includes(reference.sourceURL));
  }
});

test('opposed limits retain a verified decadal support pair, a separate adverse pair, or both in the same lunar slice', () => {
  for (const [year, relief, adverse, yearContacts, phrase] of [
    [2018, true, false, { decadalRelation: '冲', minorRelation: '三合' }, '大限同段核到文昌文曲这一组'],
    [2005, false, true, { decadalRelation: '冲', minorRelation: '冲' }, '受冲大限见古空劫一组'],
    [2017, true, true, { decadalRelation: '其他', minorRelation: '冲' }, '受冲小限见伤使一组'],
  ]) {
    const run = realRun(branchExample(year)); validateFortuneFacts(run);
    const fact = branchFact(run, year), p = fact.normalizedPayload;
    assert.deepEqual(p.yearContacts, yearContacts);
    assert.equal(p.annualReliefCandidate, relief);
    assert.equal(p.annualAdverseCandidate, adverse);
    assert.ok(fact.sourceFactIds.length >= 2);
    if (year === 2018) assert.deepEqual(p.relief.find(row => row.name === '文昌文曲').stars.map(row =>
      [row.branch, row.decadalRelation, row.minorRelation]), [['戌', '冲', '三合'], ['辰', '守', '其他']]);
    if (year === 2017) {
      assert.deepEqual(p.adverse.find(row => row.name === '伤使').stars.map(row =>
        [row.star, row.branch, row.minorRelation]), [['天伤', '未', '三合'], ['天使', '酉', '冲']]);
      assert.deepEqual(p.seatEvidence[0].helperGuards, ['文曲', '左辅']);
      assert.equal(p.seatEvidence[0].opposedCounts, undefined);
      assert.deepEqual(p.seatEvidence[1].opposedCounts, {
        visibleHelpers: 1, unresolvedHelpers: 0, visibleAdverse: 6, unresolvedAdverse: 0,
      });
    }
    const match = result(run, branchRules[0].knowledgeId);
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
    assert.ok(match.windows.some(row => row.start <= fact.activeFrom && fact.activeTo <= row.endExclusive));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'limit-branch-prompt'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    if (year === 2017) assert.match(prompt, /本段太岁冲小限，具名助曜属于另一宫的大限背景/u);
    assert.doesNotMatch(prompt, /annualReliefCandidate|quanshu-limit-branches|annualAdverseCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
  }
});

test('p043 queries a named star in the actual annual palace only when that palace opposes a limit', () => {
  const year = 2041, run = realRun(branchExample(year, 2)), fact = branchFact(run, year), p = fact.normalizedPayload;
  validateFortuneFacts(run);
  assert.deepEqual(p.yearContacts, { decadalRelation: '三合', minorRelation: '冲' });
  assert.deepEqual([p.annualReliefCandidate, p.annualAdverseCandidate, p.annualSeatedReliefCandidate, p.annualSeatedAdverseCandidate],
    [false, false, false, false]);
  assert.equal(p.annualBranch, '酉');
  assert.deepEqual(p.annualAdverseGuards, ['古天空']);
  assert.equal(p.annualOpposedGuardCandidate, true);
  assert.deepEqual(p.seatEvidence[1].opposedCounts, {
    visibleHelpers: 1, unresolvedHelpers: 0, visibleAdverse: 3, unresolvedAdverse: 0,
  });
  const match = result(run, branchRules[0].knowledgeId);
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.includes(fact.factId));
  assert.ok(match.windows.some(row => row.start <= fact.activeFrom && fact.activeTo <= row.endExclusive));
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-opposition-guard')).input;
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /太岁所在酉宫与古天空同宫，为受冲限宫的对宫见位/u);
  assert.match(prompt, /受冲小限在卯宫，其守冲三合范围已定位助曜1位、煞曜3位/u);
  assert.doesNotMatch(prompt, /annualOpposedGuardCandidate|opposedCounts/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));

  const other = realRun(branchExample(1995)), otherFact = branchFact(other, 1995), near = otherFact.normalizedPayload;
  assert.deepEqual(near.annualAdverseGuards, ['古天空', '地劫']);
  assert.equal(near.annualOpposedGuardCandidate, false);
  assert.ok(near.annualTrineAdverseWitnesses.length > 0);
  assert.equal(near.annualTrineAdverseCandidate, false);
  const facts = other.facts.filter(row => row.factType !== otherFact.factType || row.factId === otherFact.factId);
  assert.equal(result({ ...other, facts }, branchRules[0].knowledgeId).status, 'not_matched');

  const natal = native(branchExample(year, 2));
  for (const palace of natal.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[key] = palace[key].filter(row => row.name !== '地空');
  }
  const missing = quanshuLimitBranches(natal, { lunarYear: year, yearIndex: 7, decadalIndex: 3, minorIndex: 1 });
  assert.equal(missing.annualOpposedGuardCandidate, undefined);
  assert.deepEqual(missing.annualOppositionAdverse.find(row => row.name === '古空劫').stars.map(row => row.branch), [undefined, '丑']);
  assert.equal(missing.seatEvidence[1].opposedCounts.unresolvedAdverse, 1);
});

test('p043 uses a named star trining the actual annual palace while that palace opposes a limit', () => {
  const year = 2005, run = realRun(branchExample(year, 1)), fact = branchFact(run, year), data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.minorBranch, data.yearContacts.minorRelation], ['酉', '卯', '冲']);
  assert.deepEqual([data.annualReliefCandidate, data.annualAdverseCandidate, data.annualSeatedReliefCandidate,
    data.annualSeatedAdverseCandidate, data.annualOpposedGuardCandidate, data.annualOpposedQishaCandidate],
    [false, false, false, false, false, false]);
  assert.deepEqual(data.seatEvidence[1].helperGuards, ['紫微']);
  assert.equal(data.annualTrineAdverseCandidate, true);
  assert.deepEqual(data.annualTrineAdverseWitnesses, [{ star: '陀罗', branch: '巳', relation: '三合' }]);

  const isolated = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const match = result(isolated, branchRules[0].knowledgeId);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.match(literaryPrompt(isolated), /陀罗在巳宫，三合太岁所在的酉宫/u);
  const genericOnly = run.facts.filter(row => row.factType !== fact.factType);
  assert.equal(result({ ...run, facts: genericOnly }, branchRules[0].knowledgeId).status, 'unknown');
});

test('p043 matches different sets of named helpers aspecting the same actual decadal palace', () => {
  const year = 2038, natal = native({ dateStr: '1993-02-05', timeIndex: 6 });
  const { fact, run } = submitLimitBranch(natal, year, 'tai-sui-cross-group');
  const p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.decadalBranch, p.minorBranch], ['午', '子', '戌']);
  assert.deepEqual(p.yearContacts, { decadalRelation: '冲', minorRelation: '三合' });
  const oldConditions = ['annualReliefCandidate', 'annualAdverseCandidate', 'annualSeatedReliefCandidate', 'annualSeatedAdverseCandidate',
    'annualOpposedGuardCandidate', 'annualTrineAdverseCandidate', 'annualOpposedQishaCandidate'];
  assert.ok(oldConditions.every(key => p[key] === false));
  assert.equal(p.annualCrossGroupReliefCandidate, true);
  assert.deepEqual(p.annualCrossGroupReliefWitnesses.map(({ name, stars }) =>
    [name, stars.map(({ star, branch, decadalRelation }) => [star, branch, decadalRelation])]),
  [['文昌文曲', [['文昌', '辰', '三合']]], ['左辅右弼', [['左辅', '辰', '三合']]]]);
  const hit = result(run, branchRules[0].knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tai-sui-cross-group'));
  assert.match(formatFortuneFactAudit(input), /同段有不同组具名助曜照到大限。文昌在辰宫，与大限为三合。左辅在辰宫，与大限为三合/u);

  const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index(p.annualBranch), decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) };
  assert.equal(quanshuLimitBranches(natal, { ...frame, decadalIndex: undefined }).annualCrossGroupReliefCandidate, undefined);
  const left = position(natal, '左辅');
  for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) left[key] = left[key].filter(row => row.name !== '左辅');
  assert.equal(quanshuLimitBranches(natal, frame).annualCrossGroupReliefCandidate, undefined);
});

test('p043 preserves the complete named helper group and Ming fixed Sha at one annual opposition', () => {
  const dateStr = '1990-07-19', timeIndex = 3, year = 2027;
  const n = native({ dateStr, timeIndex });
  const { run, fact } = submitLimitBranch(n, year, 'ming-opposed-decade', beijingBirthContext(dateStr, timeIndex));
  const p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.decadalBranch, p.minorBranch], ['未', '丑', '卯']);
  assert.deepEqual(p.yearContacts, { decadalRelation: '冲', minorRelation: '三合' });
  assert.equal(p.annualDoubleVerifiedOppositionCandidate, false);
  assert.equal(p.annualOpposedDecadalFullReliefCandidate, true);
  assert.equal(p.annualOpposedDecadalVerifiedFullReliefCandidate, true);
  assert.deepEqual(p.relief.map(group => [group.name, group.stars.map(row => [row.star, row.branch, row.decadalRelation])]), [
    ['紫微天府', [['紫微', '未', '冲'], ['天府', '酉', '三合']]],
    ['文昌文曲', [['文昌', '未', '冲'], ['文曲', '未', '冲']]],
    ['左辅右弼', [['左辅', '酉', '三合'], ['右弼', '巳', '三合']]],
    ['魁钺无序组', [['魁钺组', '丑', '守'], ['魁钺组', '未', '冲']]],
  ]);
  assert.equal(p.annualMingFixedOppositionShaCandidate, true);
  assert.deepEqual(p.annualMingFixedSha, [
    { star: '火星', branch: '丑', annualRelation: '冲', decadalRelation: '守', minorRelation: '其他' },
    { star: '铃星', branch: '卯', annualRelation: '三合', decadalRelation: '其他', minorRelation: '守' },
  ]);
  assert.ok(p.adverse.find(row => row.name === '归档火铃').stars.every(row => row.decadalRelation === '其他'));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-full-relief')).input;
  assert.match(formatFortuneFactAudit(model), /八个已核位置均可守冲三合/u);
  const provider = formatFortunePrompt(model);
  assert.match(provider, /同一农历年太岁正冲复算所得的大限宫/u);
  assert.doesNotMatch(provider, /八个已核位置均可守冲三合|annualOpposedDecadalVerifiedFullReliefCandidate|吉星扶救则灾少/u);
  const legacy = { annualReliefCandidate: false, annualAdverseCandidate: false, annualSeatedReliefCandidate: false,
    annualCrossGroupReliefCandidate: false, annualSeatedAdverseCandidate: false, annualOpposedGuardCandidate: false,
    annualTrineAdverseCandidate: false, annualOpposedQishaCandidate: false };
  for (const [relief, sha] of [[true, false], [false, true]]) {
    const exact = { ...fact, normalizedPayload: { ...p, ...legacy,
      annualOpposedDecadalFullReliefCandidate: relief, annualOpposedDecadalVerifiedFullReliefCandidate: relief,
      annualMingFixedOppositionShaCandidate: sha } };
    const hit = result({ ...run, facts: [exact] }, branchRules[0].knowledgeId);
    assert.equal(hit.status, relief ? 'matched' : 'partial');
    assert.equal(hit.matchedSourceExcerpt, relief ? '若逢大限遇紫府昌曲左右魁钺' : undefined);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrong = { ...exact, normalizedPayload: { ...exact.normalizedPayload,
      [relief ? 'annualOppositionProfile' : 'quanshuFixedFireBellProfile']: 'other-source' } };
    assert.equal(result({ ...run, facts: [wrong] }, branchRules[0].knowledgeId).status, 'not_matched');
  }

  const next = submitLimitBranch(n, 2028, 'ming-minor-only-opposition');
  const q = next.fact.normalizedPayload;
  assert.deepEqual(q.yearContacts, { decadalRelation: '其他', minorRelation: '冲' });
  assert.ok(q.relief.every(group => group.decadalPair));
  assert.equal(q.annualOpposedDecadalFullReliefCandidate, false);
  assert.equal(q.annualOpposedDecadalVerifiedFullReliefCandidate, false);
  assert.equal(q.annualMingFixedOppositionShaCandidate, false);
  const index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index('未'), decadalIndex: index('丑'), minorIndex: index('卯') };
  assert.deepEqual(p.annualTrineAdverseWitnesses, [{ star: '天使', branch: '亥', relation: '三合' }]);
  assert.deepEqual(p.annualAdverseGuards, ['陀罗']);
  for (const [star, from, to, field, witnesses, localText] of [
    ['天使', 'adjectiveStars', 'minorStars', 'annualTrineAdverseCandidate', 'annualTrineAdverseWitnesses',
      /天使在亥宫，三合太岁所在的未宫/u],
    ['陀罗', 'minorStars', 'adjectiveStars', 'annualOpposedGuardCandidate', 'annualAdverseGuards',
      /太岁所在未宫与陀罗同宫/u],
  ]) {
    assert.match(formatFortuneFactAudit(model), localText);
    assert.doesNotMatch(provider, localText);
    const wrongLayer = quanshuLimitBranches(withWrongStarLayer(n, [star], from, to), frame);
    assert.equal(wrongLayer[field], undefined, star);
    assert.deepEqual(wrongLayer[witnesses], [], star);
    assert.equal(wrongLayer.annualOpposedDecadalVerifiedFullReliefCandidate, true, star);
    const corrected = { ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] };
    assert.equal(result(corrected, branchRules[0].knowledgeId).status, 'matched', star);
    assert.doesNotMatch(literaryPrompt(corrected), localText);
  }
  const shifted = quanshuLimitBranches(copyChartWithShiftedDecade(n, frame), frame);
  assert.deepEqual(shifted.sourceDecadal, { branch: '丑', verified: false });
  assert.equal(shifted.yearContacts.decadalRelation, '冲');
  assert.equal(shifted.seatEvidence.find(row => row.scope === 'decadal').opposed, undefined);
  assert.equal(shifted.annualOpposedDecadalFullReliefCandidate, undefined);
  assert.equal(shifted.annualOpposedDecadalVerifiedFullReliefCandidate, undefined);
  assert.equal(shifted.annualMingFixedOppositionShaCandidate, undefined);
  const { limitPlacementProof, ...oldPayload } = p;
  assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
  for (const normalizedPayload of [shifted, oldPayload]) {
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload }] }, branchRules[0].knowledgeId).status, 'unknown');
  }
  const corrupted = structuredClone(n);
  const starPalace = position(corrupted, '文昌');
  starPalace.minorStars = starPalace.minorStars.filter(row => row.name !== '文昌');
  const incomplete = quanshuLimitBranches(corrupted, { lunarYear: year, yearIndex: index('未'),
    decadalIndex: index('丑'), minorIndex: index('卯') });
  assert.equal(incomplete.annualOpposedDecadalFullReliefCandidate, undefined);
  assert.equal(incomplete.annualMingFixedOppositionShaCandidate, true);
  const displaced = structuredClone(n), ziwei = position(displaced, '紫微');
  const moved = ziwei.majorStars.find(row => row.name === '紫微');
  ziwei.majorStars = ziwei.majorStars.filter(row => row !== moved);
  displaced.palaces.find(row => row.earthlyBranch === '辰').majorStars.push(moved);
  const unverified = quanshuLimitBranches(displaced, { lunarYear: year, yearIndex: index('未'),
    decadalIndex: index('丑'), minorIndex: index('卯') });
  assert.equal(unverified.annualOpposedDecadalFullReliefCandidate, undefined);
  assert.equal(unverified.annualMingFixedOppositionShaCandidate, true);
  assert.deepEqual(unverified.relief.find(group => group.name === '紫微天府').stars.map(row => row.branch), [undefined, undefined]);
  const onlyRelief = { ...fact, normalizedPayload: { ...unverified, ...legacy, annualMingFixedOppositionShaCandidate: false } };
  assert.equal(result({ ...run, facts: [onlyRelief] }, branchRules[0].knowledgeId).status, 'unknown');
  const wrongNoble = quanshuLimitBranches(withWrongStarLayer(n, ['天魁'], 'minorStars', 'adjectiveStars'), frame);
  assert.equal(wrongNoble.annualOpposedDecadalFullReliefCandidate, true);
  assert.equal(wrongNoble.annualOpposedDecadalVerifiedFullReliefCandidate, undefined);
  const wrongNobleRun = { ...run, facts: [{ ...fact, normalizedPayload: wrongNoble }] };
  assert.equal(result(wrongNobleRun, branchRules[0].knowledgeId).status, 'partial');
  assert.doesNotMatch(literaryPrompt(wrongNobleRun), /八个已核位置均可守冲三合/u);

  const independent = submitLimitBranch(native({ dateStr: '1985-03-05', timeIndex: 1 }), 2017, 'ming-fixed-guard-only');
  const fixed = independent.fact.normalizedPayload;
  assert.deepEqual([fixed.annualBranch, fixed.decadalBranch, fixed.minorBranch], ['酉', '卯', '亥']);
  assert.ok(Object.keys(legacy).every(key => fixed[key] === false));
  assert.equal(fixed.annualOpposedDecadalFullReliefCandidate, false);
  assert.equal(fixed.annualMingFixedOppositionShaCandidate, true);
  assert.deepEqual(fixed.annualMingFixedSha.find(row => row.star === '火星'),
    { star: '火星', branch: '卯', annualRelation: '冲', decadalRelation: '守', minorRelation: '三合' });
  assert.equal(fixed.adverse.find(row => row.name === '归档火铃').stars.find(row => row.star === '铃星').minorRelation, '守');
  const hit = result(independent.run, branchRules[0].knowledgeId);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [independent.fact.factId]);
  assert.deepEqual(hit.windows, [{ start: independent.fact.activeFrom, endExclusive: independent.fact.activeTo }]);
  const { input } = buildFortuneModelContext(independent.run,
    interpretFortune(independent.run, requestForFortuneRun(independent.run), 'ming-fixed-opposition'));
  assert.match(formatFortuneFactAudit(input), /明刊定宫火星在卯宫，实守受冲大限/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊定宫火星在卯宫，实守受冲大限/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
});

test('p043 retains a verified Shang guard at Tai Sui when the unneeded Shi position is missing', () => {
  const lunarYear = 2040, timeIndex = 2, dateStr = '1990-05-05';
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON();
  const { run, fact } = submitLimitBranch(natal, lunarYear, 'ming-opposed-natal-shang');
  const data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.sourceMinor.branch, data.sourceMinor.verified], ['申', '寅', true]);
  assert.equal(data.annualOpposedGuardCandidate, true);
  assert.deepEqual(data.annualAdverseGuards, ['天伤']);
  const target = branchRules[0];
  assert.equal(result({ ...run, facts: [fact] }, target.knowledgeId).status, 'partial');

  const h = engine.horoscope(`${lunarYear}-06-01`, 6);
  const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const missingPair = structuredClone(natal), envoy = position(missingPair, '天使');
  envoy.adjectiveStars = envoy.adjectiveStars.filter(row => row.name !== '天使');
  const independent = quanshuLimitBranches(missingPair, frame);
  assert.equal(independent.annualOpposedGuardCandidate, true);
  assert.deepEqual(independent.annualAdverseGuards, ['天伤']);
  assert.deepEqual(independent.annualOppositionAdverse.find(row => row.name === '伤使').stars.map(row => row.branch), ['申', undefined]);
  const wrong = quanshuLimitBranches(withWrongStarLayer(natal, ['天伤'], 'adjectiveStars', 'minorStars'), frame);
  assert.equal(wrong.annualOpposedGuardCandidate, undefined);
  assert.deepEqual(wrong.annualAdverseGuards, []);

  const otherRoutes = Object.fromEntries(target.queries[0].anyOf.flatMap(branch => Object.entries(branch)
    .filter(([key, value]) => key !== 'annualOpposedGuardCandidate' && value === true)
    .map(([key]) => [key, false])));
  for (const [p, status] of [[independent, 'partial'], [wrong, 'unknown']]) {
    const isolated = { ...run, facts: [{ ...fact, normalizedPayload: { ...p, ...otherRoutes } }] };
    assert.equal(result(isolated, target.knowledgeId).status, status);
  }
});

test('p043 carries a verified Qisha guarding the opposed limit through the client, SQLite and prompt', () => {
  const sample = branchExample(2059, 3);
  const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2059-11-19T03:00:00Z'), reference = { snapshotId: 'annual-opposition-qisha-chart', chart: chart(native(sample)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'annual-opposition-qisha-client', reference);
  const fact = branchFact(run, sample.year), data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.decadalBranch, data.minorBranch, data.annualQishaBranch], ['卯', '巳', '酉', '酉']);
  assert.equal(data.yearContacts.minorRelation, '冲');
  assert.equal(data.annualOpposedQishaCandidate, true);
  assert.ok(branchRules[0].queries[0].anyOf.some(condition => condition.annualOpposedQishaCandidate === true));
  assert.equal(data.annualTrineAdverseCandidate, true);

  const isolated = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const match = result(isolated, branchRules[0].knowledgeId);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'annual-qisha'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命七杀实守受冲小限所在的酉宫/u);
  assert.doesNotMatch(prompt, /annualOpposedQishaCandidate|annualTrineAdverseWitnesses/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));

  const wrongLimitRun = realRun(branchExample(2053, 1)), wrongLimit = branchFact(wrongLimitRun, 2053).normalizedPayload;
  assert.deepEqual([wrongLimit.annualQishaBranch, wrongLimit.decadalBranch, wrongLimit.yearContacts.decadalRelation,
    wrongLimit.yearContacts.minorRelation], ['未', '未', '其他', '冲']);
  assert.equal(wrongLimit.annualOpposedQishaCandidate, false);
  const sameAsAnnualRun = realRun(branchExample(2029, 3)), sameAsAnnual = branchFact(sameAsAnnualRun, 2029).normalizedPayload;
  assert.equal(sameAsAnnual.annualQishaBranch, sameAsAnnual.annualBranch);
  assert.equal(sameAsAnnual.annualOpposedQishaCandidate, false);

  const natal = native(sample), frame = { lunarYear: sample.year, yearIndex: 1, decadalIndex: 3, minorIndex: 7 };
  assert.equal(quanshuLimitBranches(natal, { ...frame, minorIndex: undefined }).annualOpposedQishaCandidate, undefined);
  const palace = position(natal, '七杀'), qisha = palace.majorStars.find(row => row.name === '七杀');
  palace.majorStars = palace.majorStars.filter(row => row.name !== '七杀');
  assert.equal(quanshuLimitBranches(natal, frame).annualOpposedQishaCandidate, undefined);
  natal.palaces.find(row => row.earthlyBranch === data.annualBranch).majorStars.push(qisha);
  const displaced = quanshuLimitBranches(natal, frame);
  assert.equal(displaced.annualQishaBranch, undefined);
  assert.equal(displaced.annualOpposedQishaCandidate, undefined);
  assert.equal(displaced.annualTrineAdverseCandidate, true);
});

test('a single named star can supply a seated witness only in the correct limit palace', () => {
  for (const [year, hour, flags, scope, starField, observed, status, phrase] of [
    [2011, 1, [true, false], 'decadal', 'helperGuards', ['紫微'], 'partial', '大限命宫在卯宫，具名助曜实守有紫微'],
    [1999, 0, [false, true], 'minor', 'adverseGuards', ['天使'], 'partial', '受冲小限在酉宫，具名煞曜实守有天使'],
    [2005, 1, [false, false], 'minor', 'helperGuards', ['紫微'], 'partial'],
    [2029, 3, [false, false], 'decadal', 'adverseGuards', ['地劫'], 'partial'],
  ]) {
    const run = realRun(branchExample(year, hour)), fact = branchFact(run, year), p = fact.normalizedPayload;
    const facts = run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId);
    const scopedRun = { ...run, facts };
    assert.deepEqual([p.annualSeatedReliefCandidate, p.annualSeatedAdverseCandidate], flags);
    assert.deepEqual([p.annualReliefCandidate, p.annualAdverseCandidate], [false, false]);
    assert.deepEqual(p.seatEvidence.find(row => row.scope === scope)[starField], observed);
    const match = result(scopedRun, branchRules[0].knowledgeId);
    assert.equal(match.status, status);
    if (!phrase) {
      assert.equal(p.annualTrineAdverseCandidate, true);
      continue;
    }
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(scopedRun, interpretFortune(scopedRun, requestForFortuneRun(scopedRun), 'seated-witness'));
    assert.ok(formatFortuneFactAudit(input).includes(phrase));
  }
});

test('Chen and Xu bind one real Chang-Qu contact, two contacts to the same star, or an actual temple guard', () => {
  for (const [year, hour, seat, flag, phrase] of [
    [2004, 0, ['卯', '辰'], 'atChenXuLimit', '文昌在戌宫，卷三星表列为陷'],
    [2014, 0, ['辰', '午'], 'bothLimitsMeet', '大小限均会到同一颗文昌'],
    [2023, 1, ['辰', '酉'], 'templeAtOtherLimit', '一限到辰戌，另一限实际守这颗入庙星'],
    [2034, 2, ['辰', '戌'], 'atChenXuLimit', '大限会到文昌，小限会到文曲，两限所会为不同星'],
  ]) {
    const run = realRun(branchExample(year, hour)); validateFortuneFacts(run);
    const fact = branchFact(run, year), p = fact.normalizedPayload;
    assert.deepEqual([p.decadalBranch, p.minorBranch], seat);
    assert.equal(p.chenXuChangQuCandidate, year !== 2023);
    assert.equal(p.chenXuTempleCandidate, year === 2023);
    assert.equal(p.chenXuBothLimitsCandidate, year === 2014);
    assert.equal(p.chenXuSplitChangQuCandidate, year === 2034);
    assert.ok(p.changQu.some(row => row[flag] && (year !== 2023 || row.grade === '庙')));
    const match = result(run, branchRules[1].knowledgeId);
    assert.equal(match.status, 'partial'); assert.ok(match.sourceFactIds.includes(fact.factId));
    if (year === 2004) {
      const natal = native(branchExample(year, hour));
      const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
      const frame = { lunarYear: year, yearIndex: index(p.annualBranch), decadalIndex: index(p.decadalBranch), minorIndex: index(p.minorBranch) };
      const minorOnly = quanshuLimitBranches(copyChartWithShiftedDecade(natal, frame), frame);
      assert.equal(minorOnly.sourceDecadal.verified, false);
      assert.equal(minorOnly.sourceMinor.verified, true);
      assert.equal(minorOnly.chenXuChangQuCandidate, true);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: minorOnly }] }, branchRules[1].knowledgeId).status, 'partial');
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'temple-branch-prompt'));
    assert.ok(formatFortuneFactAudit(input).includes(phrase), phrase);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
  }
});

test('p045 queries an actual opposition or trine to a temple star at the other limit separately from a seated star', () => {
  for (const [year, relation, stars] of [[1998, '三合', ['文昌', '文曲']], [2010, '冲', ['文昌']]]) {
    const run = realRun(branchExample(year, 1)), fact = branchFact(run, year), p = fact.normalizedPayload;
    validateFortuneFacts(run);
    assert.equal(p.minorBranch, '戌');
    assert.equal(p.chenXuChangQuCandidate, false);
    assert.equal(p.chenXuTempleCandidate, false);
    assert.equal(p.chenXuTempleAspectCandidate, true);
    const witnesses = p.changQu.filter(row => row.templeAspectAtOtherLimit);
    assert.deepEqual(witnesses.map(row => row.star), stars);
    assert.ok(witnesses.every(row => row.grade === '庙' && row.decadalRelation === relation));
    const sliced = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = result(sliced, branchRules[1].knowledgeId);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const input = buildFortuneModelContext(sliced, interpretFortune(sliced, requestForFortuneRun(sliced), 'changqu-temple-aspect')).input;
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('大限与入庙的文昌实际' + (relation === '冲' ? '对冲' : '三合')));
    assert.doesNotMatch(prompt, /chenXuTempleAspectCandidate|templeAspectAtOtherLimit/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  }
});

test('detached temple positions and missing coordinates cannot fabricate a verified branch', () => {
  for (const year of [2004, 2022]) {
    const run = realRun(branchExample(year, 1)), fact = branchFact(run, year), p = fact.normalizedPayload;
    assert.ok(p.minorAtChenXu && p.changQu.every(row => row.grade === '庙'));
    assert.equal(p.decadalAtChenXu, year === 2022);
    assert.equal(p.chenXuTempleCandidate, false);
    assert.equal(p.chenXuTempleAspectCandidate, false);
    if (year === 2022) assert.ok(p.changQu.every(row => !['守', '冲', '三合'].includes(row.decadalRelation)
      && !['守', '冲', '三合'].includes(row.minorRelation)));
    const facts = run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId);
    assert.equal(result({ ...run, facts }, branchRules[1].knowledgeId).status, 'not_matched');
    const genericOnly = run.facts.filter(row => row.factType !== fact.factType);
    assert.equal(result({ ...run, facts: genericOnly }, branchRules[1].knowledgeId).status, 'unknown');
  }
  const natal = native(branchExample(2022, 1)), frame = { lunarYear: 2022, yearIndex: 0, decadalIndex: 2, minorIndex: 8 };
  const noPeer = quanshuLimitBranches(natal, { ...frame, decadalIndex: undefined });
  assert.equal(noPeer.chenXuTempleCandidate, undefined);
  assert.equal(noPeer.chenXuTempleAspectCandidate, undefined);
  assert.equal(quanshuLimitBranches(natal, { ...frame, yearIndex: 1 }).ready, false);
  for (const palace of natal.palaces) for (const field of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[field] = palace[field].filter(row => !['文昌', '文曲'].includes(row.name));
  }
  const missing = quanshuLimitBranches(natal, frame);
  assert.equal(missing.chenXuTempleCandidate, undefined);
  assert.equal(missing.chenXuTempleAspectCandidate, undefined);
  assert.equal(missing.chenXuChangQuCandidate, undefined);
});

test('one chart rejects archive-only minor opposition and a Chen-Xu contact borrowed from the previous year', () => {
  const natal = native(branchExample(2015));
  const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const cases = [
    { year: 2015, wrongBranch: '丑', verifiedBranch: '巳', field: 'annualReliefCandidate', rule: 0 },
    { year: 2005, wrongBranch: '辰', verifiedBranch: '卯', field: 'chenXuChangQuCandidate', rule: 1 },
  ];
  for (const { year, wrongBranch, verifiedBranch, field, rule } of cases) {
    const run = realRun(branchExample(year)), fact = branchFact(run, year), actual = fact.normalizedPayload;
    assert.equal(actual.sourceMinor.verified, true);
    assert.equal(actual.sourceMinor.branch, verifiedBranch);
    const draft = quanshuLimitBranches(natal, { lunarYear: year, yearIndex: index(actual.annualBranch),
      decadalIndex: index(actual.decadalBranch), minorIndex: index(wrongBranch) });
    assert.equal(draft.sourceMinor.verified, false);
    assert.equal(draft.minorBranch, wrongBranch);
    assert.equal(draft.seatEvidence[1].branch, undefined);
    assert.equal(draft[field], undefined);
    if (rule === 0) {
      assert.equal(draft.yearContacts.minorRelation, '冲');
      assert.ok(draft.relief.some(row => row.decadalPair));
      assert.equal(draft.seatEvidence[1].opposed, undefined);
    } else {
      assert.equal(draft.minorAtChenXu, undefined);
      assert.ok(draft.changQu.every(row => row.minorRelation === undefined));
    }
    const incorrect = { ...run, facts: [{ ...fact, normalizedPayload: draft }] };
    assert.equal(result(incorrect, branchRules[rule].knowledgeId).status, 'unknown');
    const audit = describeFortuneFact({ method: 'ziwei', type: 'quanshu_limit_branches', data: draft }, String);
    assert.doesNotMatch(audit, /实际冲小限|小限命宫在|一限到辰戌/u);
  }
});

test('p045 separates natal Chang Qu guarding Life from two actual Chen and Xu limits in the common Xin and Ren reading', () => {
  const knowledgeId = branchRules[1].knowledgeId;
  for (const [dateStr, year, stem, decadalBranch, minorBranch] of [
    ['1991-10-15', 2024, '辛', '戌', '辰'], ['1992-10-05', 2028, '壬', '辰', '戌'],
  ]) {
    const natal = native({ dateStr, timeIndex: 3 });
    const { run, fact } = submitLimitBranch(natal, year, 'chen-xu-natal-literary-guards');
    const data = fact.normalizedPayload;
    assert.deepEqual([data.chenXuChangQuCandidate, data.chenXuTempleCandidate,
      data.chenXuTempleAspectCandidate, data.templeChangQuBothLimitsCandidate], [false, false, false, false]);
    assert.ok(data.changQu.every(row => row.decadalRelation === '其他' && row.minorRelation === '其他'));
    assert.equal(data.mingChenXuNatalChangQuLifeCandidate, true);
    assert.deepEqual(data.mingChenXuNatalChangQuLifeWitness, { birthStem: stem, lifeBranch: '未',
      stars: [{ star: '文昌', branch: '未' }, { star: '文曲', branch: '未' }], decadalBranch, minorBranch });
    const hit = result(run, knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '限逢辰戌');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-xu-natal-literary-guards'));
    assert.match(formatFortuneFactAudit(input), /本命文昌[^\n]*文曲[^\n]*未宫[^\n]*大限[^\n]*小限/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /限逢辰戌/u);
    assert.doesNotMatch(prompt, /本命文昌[^\n]*文曲[^\n]*未宫[^\n]*大限[^\n]*小限|mingChenXuNatalChangQuLifeWitness|虑投河/u);
    const next = submitLimitBranch(natal, year + 1, 'chen-xu-natal-literary-neighbor');
    assert.equal(next.fact.normalizedPayload.mingChenXuNatalChangQuLifeCandidate, false);
    assert.equal(next.fact.normalizedPayload.mingChenXuNatalChangQuLifeWitness, undefined);

    const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
    const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(decadalBranch), minorIndex: index(minorBranch) };
    const shiftedMinor = quanshuLimitBranches(natal, { ...frame, minorIndex: index(decadalBranch) });
    assert.equal(shiftedMinor.sourceMinor.verified, false);
    assert.equal(shiftedMinor.mingChenXuNatalChangQuLifeCandidate, undefined);
    // The shifted small limit invalidates the classical pair without undoing Zhou's actual large limit.
    assert.equal(shiftedMinor.zhouChangQuChenXuDecadalCandidate, true);
    const isolatedMinor = result({ ...run, facts: [{ ...fact, normalizedPayload: shiftedMinor }] }, knowledgeId);
    assert.equal(isolatedMinor.status, 'matched');
    const survivingConditions = isolatedMinor.matchedConditions ?? isolatedMinor.confirmedBranches.flatMap(branch => branch.conditions);
    assert.match(survivingConditions.join(' '), /周德元[^。]*实际大限进入辰或戌/u);
    assert.doesNotMatch(survivingConditions.join(' '), /明刊|三卷本/u);
    if (stem === '辛') {
      const shifted = quanshuLimitBranches(copyChartWithShiftedDecade(natal, frame), frame);
      assert.equal(shifted.sourceDecadal.verified, false);
      assert.equal(shifted.decadalAtChenXu, undefined);
      assert.equal(shifted.mingChenXuNatalChangQuLifeCandidate, undefined);
      assert.equal(shifted.mingChenXuNatalChangQuLifeWitness, undefined);
      const audit = describeFortuneFact({ method: 'ziwei', type: 'quanshu_limit_branches', data: shifted }, String);
      assert.match(audit, /小限命宫在辰宫/u);
      assert.doesNotMatch(audit, /大限命宫在/u);
      const { limitPlacementProof, ...oldPayload } = data;
      assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
      assert.equal(shifted.zhouChangQuChenXuDecadalCandidate, undefined);
      assert.equal(shifted.zhouChangQuChenXuAnnualCandidate, true);
      const independentAnnual = result({ ...run, facts: [{ ...fact, normalizedPayload: shifted }] }, knowledgeId);
      assert.equal(independentAnnual.status, 'matched');
      assert.match(independentAnnual.matchedConditions.join(' '), /周德元[^。]*实际流年太岁在辰或戌/u);
      assert.doesNotMatch(independentAnnual.matchedConditions.join(' '), /明刊|三卷本/u);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: oldPayload }] }, knowledgeId).status, 'unknown');
      const life = natal.palaces.find(row => row.name === '命宫');
      const moved = life.minorStars.find(row => row.name === '文曲');
      life.minorStars = life.minorStars.filter(row => row !== moved);
      life.adjectiveStars.push(moved);
      const wrongLayer = quanshuLimitBranches(natal, { lunarYear: year, yearIndex: index(data.annualBranch),
        decadalIndex: index(decadalBranch), minorIndex: index(minorBranch) });
      assert.equal(wrongLayer.mingChenXuNatalChangQuLifeCandidate, undefined);
      assert.equal(wrongLayer.mingChenXuNatalChangQuLifeWitness, undefined);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, knowledgeId).status, 'unknown');
    }
  }
});

test('p045 confirms the Ji natal Chang Qu and actual Chen-Xu limits only under the three-volume reading', () => {
  const dateStr = '1989-10-18', year = 2028;
  const engine = astro.withOptions({ dateStr, timeIndex: 3, gender: '男', fixLeap: true, config });
  const natal = engine.toJSON(), knowledgeId = branchRules[1].knowledgeId;
  const { run, fact } = submitLimitBranch(natal, year, 'three-volume-ji-chen-xu');
  const data = fact.normalizedPayload;
  assert.equal(data.mingChenXuNatalChangQuLifeCandidate, false);
  assert.equal(data.mingChenXuNatalChangQuLifeWitness, undefined);
  assert.equal(data.threeVolumeJiChenXuNatalChangQuLifeCandidate, true);
  assert.deepEqual(data.threeVolumeJiChenXuNatalChangQuLifeWitness, {
    birthStem: '己', lifeBranch: '未', stars: [{ star: '文昌', branch: '未' }, { star: '文曲', branch: '未' }],
    decadalBranch: '辰', minorBranch: '戌',
  });
  for (const key of ['chenXuChangQuCandidate', 'chenXuTempleCandidate', 'chenXuTempleAspectCandidate', 'templeChangQuBothLimitsCandidate']) {
    assert.equal(data[key], false, key);
  }

  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '限逢辰戌');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'three-volume-ji-chen-xu'));
  const audit = /据三卷本，己年本命文昌、文曲同守未宫[^\n]*大限[^\n]*辰[^\n]*小限[^\n]*戌/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /三卷本卷三明列己生年/u);
  assert.doesNotMatch(prompt, audit);
  assert.doesNotMatch(prompt, /threeVolumeJiChenXuNatalChangQuLifeWitness|虑投河/u);

  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index('辰'), minorIndex: index('戌') };
  const next = engine.horoscope(`${year + 1}-06-01`, 6);
  const following = quanshuLimitBranches(natal, { lunarYear: year + 1, yearIndex: next.yearly.index,
    decadalIndex: next.decadal.index, minorIndex: next.age.index });
  assert.equal(following.threeVolumeJiChenXuNatalChangQuLifeCandidate, false);
  assert.equal(following.zhouChangQuChenXuDecadalCandidate, true);
  assert.equal(following.zhouChangQuChenXuAnnualCandidate, false);
  const independentDecade = result({ ...run, facts: [{ ...fact, normalizedPayload: following }] }, knowledgeId);
  assert.equal(independentDecade.status, 'matched');
  assert.match(independentDecade.matchedConditions.join(' '), /周德元[^。]*实际大限进入辰或戌/u);
  assert.doesNotMatch(independentDecade.matchedConditions.join(' '), /明刊|三卷本/u);

  const wrongLayer = quanshuLimitBranches(withWrongStarLayer(natal, ['文曲'], 'minorStars', 'adjectiveStars'), frame);
  assert.equal(wrongLayer.threeVolumeJiChenXuNatalChangQuLifeCandidate, undefined);
  assert.equal(wrongLayer.threeVolumeJiChenXuNatalChangQuLifeWitness, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, knowledgeId).status, 'unknown');
});

test('p045 confirms Zhou’s separately timed Chang Qu and the exact temple double-guard exception', () => {
  const dateStr = '1961-07-15', knowledgeId = branchRules[1].knowledgeId;
  const decadal = 'zhouChangQuChenXuDecadalCandidate', annual = 'zhouChangQuChenXuAnnualCandidate';
  const temple = 'zhouChangQuTempleLifeDoubleGuardCandidate';
  const cases = [
    { timeIndex: 3, year: 2022, actual: ['戌', '寅', '未'], flags: [true, false, false] },
    { timeIndex: 3, year: 2021, actual: ['酉', '丑', '未'], flags: [false, false, false] },
    { timeIndex: 3, year: 2018, actual: ['酉', '戌', '未'], flags: [false, true, false] },
    { timeIndex: 9, year: 1970, actual: ['戌', '戌', '丑'], flags: [false, false, true] },
    { timeIndex: 9, year: 1969, actual: ['戌', '酉', '丑'], flags: [true, false, false] },
  ];
  const charts = new Map([
    [3, native({ dateStr, timeIndex: 3, gender: '女' })],
    [9, native({ dateStr, timeIndex: 9, gender: '男' })],
  ]);
  for (const { timeIndex, year, actual, flags } of cases) {
    const natal = charts.get(timeIndex);
    const { run, fact } = submitLimitBranch(natal, year, 'zhou-chang-qu-' + year, beijingBirthContext(dateStr, timeIndex));
    const data = fact.normalizedPayload;
    assert.equal(data.sourceDecadal.verified, true, String(year));
    assert.deepEqual([data.decadalBranch, data.annualBranch, data.changQu[0].branch], actual, String(year));
    assert.equal(data.changQu[1].branch, actual[2], String(year));
    assert.deepEqual([data[decadal], data[annual], data[temple]], flags, String(year));

    if (flags.includes(true)) {
      const hit = result(run, knowledgeId);
      const excerpt = flags[2] ? '大限、流年俱到，则以吉论' : '限逢辰戌';
      assert.equal(hit.status, 'matched', String(year));
      assert.equal(hit.matchedSourceExcerpt, excerpt, String(year));
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

      if (year === 1970) {
        const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zhou-chang-qu'));
        assert.match(formatFortuneFactAudit(input), /昌曲同宫/u);
        assert.match(formatFortunePrompt(input), /大限、流年俱到，则以吉论/u);
        assert.doesNotMatch(formatFortunePrompt(input), /zhouChangQu|虑投河|文昌文曲[在同守]*丑宫/u);
      }
    } else {
      assert.equal(result(run, knowledgeId).status, 'not_matched', String(year));
    }

    const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
    const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(actual[0]), minorIndex: index(data.minorBranch) };
    if (year === 2022) {
      const wrongLayer = withWrongStarLayer(natal, ['文昌'], 'minorStars', 'adjectiveStars');
      assert.equal(quanshuLimitBranches(wrongLayer, frame)[decadal], undefined);
    }
    if (year === 2018) {
      assert.equal(quanshuLimitBranches(natal, { ...frame, minorIndex: undefined })[annual], true);
    }
    if (year === 1970) {
      const incorrect = quanshuLimitBranches(natal, { ...frame, decadalIndex: index('酉') });
      assert.equal(incorrect.sourceDecadal.verified, false);
      assert.deepEqual([incorrect[decadal], incorrect[annual], incorrect[temple]], [undefined, undefined, undefined]);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: incorrect }] }, knowledgeId).status, 'unknown');
    }
  }
});

test('p045 checks both actual limits against the same temple star independently of the Chen-Xu clause', () => {
  const cases = [
    [1999, 1, '己', ['丑', '酉'], [['文昌', '三合', '守'], ['文曲', '三合', '三合']], true],
    [2015, 1, '己', ['卯', '巳'], [['文昌', '冲', '三合']], true],
    [2039, 1, '己', ['巳', '巳'], [['文曲', '守', '守']], true],
    [2003, 1, '己', ['寅', '巳'], [], false],
    [2017, 1, '己', ['卯', '卯'], [], false],
    [2017, 5, '己', ['亥', '卯'], [], false],
    [2001, 1, '庚', ['丑', '巳'], [['文昌', '三合', '三合'], ['文曲', '三合', '守']], false],
  ];
  for (const [year, timeIndex, stem, seats, witnesses, expected] of cases) {
    const dateStr = stem === '庚' ? '1990-02-10' : '1989-02-10';
    const { fact, run } = submitLimitBranch(native({ dateStr, timeIndex }), year, `changqu-dual-limit-${year}-${timeIndex}`,
      beijingBirthContext(dateStr, timeIndex));
    const p = fact.normalizedPayload;
    assert.deepEqual([p.birthStem, p.decadalBranch, p.minorBranch], [stem, ...seats]);
    assert.deepEqual([p.chenXuChangQuCandidate, p.chenXuTempleCandidate, p.chenXuTempleAspectCandidate], [false, false, false]);
    assert.deepEqual(p.changQu.filter(row => row.templeBothLimitsMeet).map(row => [row.star, row.decadalRelation, row.minorRelation]), witnesses);
    assert.equal(p.templeChangQuBothLimitsCandidate, expected);
    const hit = result(run, branchRules[1].knowledgeId);
    assert.equal(hit.status, expected ? 'partial' : 'not_matched');
    if (expected) {
      const newYear = LunarPackage.Lunar.fromYmd(year, 1, 1).getSolar().toYmd();
      assert.equal(fact.activeFrom, new Date(newYear + 'T00:00:00+08:00').toISOString());
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    }
    const prompt = literaryPrompt(run);
    assert.equal(prompt.includes('按卷三通行本注语单列入庙双限候选'), expected);
    if (expected) for (const [star] of witnesses) assert.ok(prompt.includes('大小限均到入庙的' + star));
    assert.doesNotMatch(prompt, /templeChangQuBothLimitsCandidate|templeBothLimitsMeet/u);
  }
});

test('p045 confirms real double guard of temple Wenqu only in the overlapping northern phases', () => {
  const dateStr = '1989-02-10', timeIndex = 1, year = 2071;
  const natal = native({ dateStr, timeIndex, gender: '男' });
  const run = submitYear(natal, year, 'temple-wenqu-real-double-guard', beijingBirthContext(dateStr, timeIndex));
  const fact = branchFact(run, year);
  const before = new Date(quanshuLunarMidnight(year, 1)).toISOString();
  const after = new Date(quanshuLunarMidnight(year, 7)).toISOString();
  const timed = run.facts.filter(({ factType, normalizedPayload }) => factType === 'quanshu_limit_branches'
    && normalizedPayload.sourceFactType === 'quanshu_limit_branches' && normalizedPayload.lunarYear === year);
  const confirmed = timed.filter(row => row.normalizedPayload.wenquTempleDoubleGuardCandidate === true);
  assert.equal(confirmed.length, 1);
  const [active] = confirmed;
  assert.equal(active.normalizedPayload.branch, '巳');
  assert.deepEqual(active.normalizedPayload.guardScopes, ['decadal', 'minor']);
  assert.deepEqual([active.activeFrom, active.activeTo], [before, after]);
  const knowledgeId = branchRules[1].knowledgeId;
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '如入廟吉，大小二限俱到');
  assert.deepEqual(hit.windows, [{ start: before, endExclusive: after }]);
  assert.deepEqual(hit.sourceFactIds, [active.factId]);
  assert.ok(hit.candidateWindows.some(window => window.start === after));
  const remaining = result({ ...run, facts: [fact, ...timed.filter(row => row !== active)] }, knowledgeId);
  assert.equal(remaining.status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'temple-wenqu-real-double-guard'));
  assert.match(formatFortuneFactAudit(input), /文曲在巳宫入庙。实际大限上五年与小限上半年/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /如入廟吉，大小二限俱到/u);
  assert.doesNotMatch(prompt, /wenquTempleDoubleGuardCandidate|虑投河/u);
});

test('p045 confirms temple Wenchang in the overlapping southern phases only', () => {
  const dateStr = '1989-02-10', timeIndex = 1, year = 2039;
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config });
  const natal = engine.toJSON();
  const run = submitYear(natal, year, 'temple-wenchang-real-double-guard', beijingBirthContext(dateStr, timeIndex));
  const branch = branchFact(run, year);
  const before = quanshuLunarMidnight(year, 1), middle = quanshuLunarMidnight(year, 7);
  const after = quanshuLunarMidnight(year + 1, 1);
  const window = { start: new Date(middle).toISOString(),
    endExclusive: new Date(`${year + 1}-01-01T00:00:00+08:00`).toISOString() };
  const matching = run.facts.filter(row => row.factType === 'quanshu_limit_branches' && row.normalizedPayload.lunarYear === year
    && row.normalizedPayload.wenchangTempleDoubleGuardCandidate === true);
  assert.equal(matching.length, 1);
  const [hitFact] = matching, payload = hitFact.normalizedPayload;
  assert.deepEqual([payload.star, payload.branch, payload.starGroup, payload.guardScopes], ['文昌', '酉', '南斗', ['decadal', 'minor']]);
  assert.deepEqual([hitFact.activeFrom, hitFact.activeTo], [window.start, window.endExclusive]);
  assert.ok(run.facts.every(row => row.normalizedPayload.lunarYear !== year || row.normalizedPayload.wenquTempleDoubleGuardCandidate !== true));
  const scopedRun = { ...run, facts: [branch, hitFact] }, knowledgeId = branchRules[1].knowledgeId;
  const hit = result(scopedRun, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '如入廟吉，大小二限俱到');
  assert.deepEqual(hit.windows, [window]);
  assert.deepEqual(hit.sourceFactIds, [hitFact.factId]);
  assert.equal(result({ ...run, facts: [branch] }, knowledgeId).status, 'partial');
  const { input } = buildFortuneModelContext(scopedRun, interpretFortune(scopedRun, requestForFortuneRun(scopedRun),
    'temple-wenchang-real-double-guard'));
  assert.match(formatFortuneFactAudit(input), /文昌在酉宫入庙。实际大限下五年与小限下半年/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /如入廟吉，大小二限俱到/u);
  assert.doesNotMatch(prompt, /文昌在酉宫|wenchangTempleDoubleGuardCandidate|虑投河/u);

  const h = engine.horoscope(`${year}-06-15`, 6);
  const frame = { lunarYear: year, age: year - 1989 + 1, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index };
  for (const [archive, sourceFrame] of [[withWrongStarLayer(natal, ['文昌'], 'minorStars', 'adjectiveStars'), frame],
    [natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }]]) {
    const limits = quanshuLimitBranches(archive, sourceFrame);
    assert.equal(limits.ready, true);
    assert.equal(limits.changQu.find(row => row.star === '文昌').templeBothLimitsMeet, undefined);
    for (const timing of quanshuLimitTiming(archive, limits, { start: before, end: after }, sourceFrame)) {
      assert.ok(quanshuTimedTempleChangQu(timing.data, limits).every(row => row.wenchangTempleDoubleGuardCandidate !== true));
    }
  }
});

test('p045 confirms temple Wenchang and Wenqu guarding separate verified limits during the exact overlapping phases', () => {
  const year = 2035, knowledgeId = branchRules[1].knowledgeId;
  const start = quanshuLunarMidnight(year, 1), middle = quanshuLunarMidnight(year, 7);
  const end = quanshuLunarMidnight(year + 1, 1), civilEnd = Date.parse('2036-01-01T00:00:00+08:00');
  const cases = [
    ['1989-02-10', 1, '男', '己', { branch: '酉', scope: 'decadal' }, { branch: '巳', scope: 'minor' }, start, middle],
    ['1991-10-15', 5, '女', '辛', { branch: '巳', scope: 'minor' }, { branch: '酉', scope: 'decadal' }, middle, civilEnd],
  ];
  const isSplitGuard = ({ templeChangQuSplitDoubleGuardCandidate }) => templeChangQuSplitDoubleGuardCandidate === true;
  for (const [dateStr, timeIndex, gender, birthStem, chang, qu, expectedFrom, expectedTo] of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON(), snapshotId = 'temple-chang-qu-split-guard-' + birthStem;
    const run = submitYear(natal, year, snapshotId, beijingBirthContext(dateStr, timeIndex));
    const branch = branchFact(run, year), window = { start: new Date(expectedFrom).toISOString(),
      endExclusive: new Date(expectedTo).toISOString() };
    const facts = run.facts.filter(row => row.factType === 'quanshu_limit_branches'
      && row.normalizedPayload.lunarYear === year && isSplitGuard(row.normalizedPayload));
    assert.equal(facts.length, 1);
    const [match] = facts;
    assert.deepEqual(match.normalizedPayload.templeChangQuSplitDoubleGuardWitness, { birthStem, chang, qu });
    assert.deepEqual([match.activeFrom, match.activeTo], [window.start, window.endExclusive]);
    const jielanFacts = run.facts.filter(row => timedSupport(row) && row.scope === qu.scope
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload.wenquJielanChangQuSplitActiveCandidate === true);
    assert.equal(jielanFacts.length, 1);
    assert.deepEqual(jielanFacts[0].normalizedPayload.wenquJielanChangQuSplitActiveWitness, { wenqu: qu, wenchang: chang });
    const jielanId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith('expansion-p034-001')).knowledgeId;
    const jielan = result({ ...run, facts: jielanFacts }, jielanId);
    assert.equal(jielan.status, 'matched');
    assert.equal(jielan.matchedSourceExcerpt, '二限若逢昌与曲');
    assert.deepEqual(jielan.windows, [window]);
    const scopedRun = { ...run, facts: [branch, match] };
    const hit = result(scopedRun, knowledgeId);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '如入廟吉，大小二限俱到');
    assert.deepEqual(hit.windows, [window]);
    assert.deepEqual(hit.sourceFactIds, [match.factId]);
    assert.equal(result({ ...run, facts: [branch] }, knowledgeId).status, 'partial');
    const { input } = buildFortuneModelContext(scopedRun, interpretFortune(scopedRun,
      requestForFortuneRun(scopedRun), snapshotId));
    const local = `三卷本两庙星在各自有效半段分守真限。文昌守${chang.branch}宫的${chang.scope === 'decadal' ? '大限' : '小限'}，文曲守${qu.branch}宫的${qu.scope === 'decadal' ? '大限' : '小限'}。`;
    assert.ok(formatFortuneFactAudit(input).includes(local));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /如入廟吉，大小二限俱到/u);
    assert.doesNotMatch(prompt, /templeChangQuSplitDoubleGuard|文[昌曲]守[巳酉]宫|虑投河/u);

    const h = engine.horoscope(`${year}-06-15`, 6);
    const frame = { lunarYear: year, age: year - Number(dateStr.slice(0, 4)) + 1, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index };
    for (const [archive, sourceFrame] of [
      [withWrongStarLayer(natal, ['文昌'], 'minorStars', 'adjectiveStars'), frame],
      [withWrongStarLayer(natal, ['文曲'], 'minorStars', 'adjectiveStars'), frame],
      [natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }],
      [natal, { ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 }],
    ]) {
      const context = quanshuLimitBranches(archive, sourceFrame);
      const timed = quanshuLimitTiming(archive, context, { start, end }, sourceFrame);
      assert.ok(timed.length > 0);
      assert.ok(timed.every(row => quanshuTimedTempleChangQu(row.data, context).every(data => !isSplitGuard(data))));
    }
    const next = engine.horoscope(`${year + 1}-06-15`, 6);
    const nextFrame = { lunarYear: year + 1, age: frame.age + 1, yearIndex: next.yearly.index,
      decadalIndex: next.decadal.index, minorIndex: next.age.index };
    const nextContext = quanshuLimitBranches(natal, nextFrame);
    const nextYear = quanshuLimitTiming(natal, nextContext, { start: end, end: quanshuLunarMidnight(year + 2, 1) }, nextFrame);
    assert.ok(nextYear.length > 0);
    assert.ok(nextYear.every(row => quanshuTimedTempleChangQu(row.data, nextContext).every(data => !isSplitGuard(data))));
  }
});

test('p004 requires a different seated assistant at each actual limit when neither limit guards the property Sun', () => {
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p004-001'));
  const cases = [
    ['1982-02-25', 5, 2037, ['丑', '巳', '酉'], ['三合', '三合'], ['左辅', '右弼']],
    ['1982-04-15', 7, 2004, ['子', '申', '午'], ['三合', '冲'], ['右弼', '左辅']],
    ['1982-01-25', 7, 2016, ['戌', '辰', '午'], ['冲', '三合'], ['左辅', undefined]],
    ['1982-01-25', 7, 2040, ['戌', '寅', '午'], ['三合', '三合'], [undefined, undefined]],
  ];
  for (const [dateStr, timeIndex, year, seats, relations, assistantGuards] of cases) {
    const archive = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = archive.toJSON();
    const run = submitYear(natal, year, `property-sun-${year}`, beijingBirthContext(dateStr, timeIndex));
    const fact = specific(run).find(f => f.scope === 'decadal' && f.normalizedPayload.lunarYear === year);
    const p = fact.normalizedPayload, sun = p.namedSupport.propertySun;
    assert.equal(sun.natalName, '田宅');
    assert.deepEqual([sun.branch, p.branch, p.otherBranch], seats);
    assert.deepEqual([sun.decadalRelation, sun.minorRelation], relations);
    assert.deepEqual([p.branch, p.otherBranch].map(branch => sun.assistants.find(row => row.branch === branch)?.star), assistantGuards);
    assert.equal(p.propertySunCandidate, false);
    const expected = assistantGuards.every(Boolean);
    assert.equal(p.propertySunSplitAssistedCandidate, expected);
    const sliced = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = result(sliced, rule.knowledgeId);
    assert.equal(hit.status, expected ? 'partial' : 'not_matched');
    const prompt = literaryPrompt(sliced);
    if (expected) {
      const [decadalGuard, minorGuard] = assistantGuards;
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.ok(prompt.includes(decadalGuard + '实守' + p.branch + '宫大限，' + minorGuard + '实守' + p.otherBranch + '宫小限'));
    } else {
      assert.doesNotMatch(prompt, /[左右][辅弼]实守/u);
    }
    assert.doesNotMatch(prompt, /propertySunSplitAssistedCandidate|splitAssistants/u);
    if (year === 2037) {
      const h = archive.horoscope(`${year}-06-01`, 6);
      const frame = { lunarYear: year, decadalIndex: h.decadal.index };
      const check = normalizedPayload => result({ ...run, facts: [{ ...fact, normalizedPayload }] }, rule.knowledgeId).status;
      assert.equal(p.propertySunPlacementProof, rule.queries[0].where.propertySunPlacementProof);
      assert.equal(check({ ...p, propertySunPlacementProof: undefined }), 'unknown');
      for (const wrong of [copyChartWithShiftedDecade(natal, frame),
        withWrongStarLayer(natal, ['太阳'], 'majorStars', 'minorStars'),
        withWrongStarLayer(natal, ['左辅'], 'minorStars', 'adjectiveStars')]) {
        const payload = quanshuSupportCondition(wrong, h.decadal.index, h.yearly.index, year, 'decadal', h.age.index);
        assert.equal(payload.ready, true);
        assert.equal(payload.propertySunSplitAssistedCandidate, undefined);
        assert.equal(check(payload), 'unknown');
      }
    }
  }
});

test('p004 confirms the named solar property support with two actual guarding limits', () => {
  const dateStr = '1988-04-01', timeIndex = 1, year = 2019;
  const archive = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config });
  const natal = archive.toJSON();
  const run = submitYear(natal, year, 'ming-property-sun-four-supports', beijingBirthContext(dateStr, timeIndex));
  const fact = specific(run).find(f => f.scope === 'decadal' && f.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.propertySunMingNamedSupportCandidate, true);
  assert.deepEqual(p.namedSupport.propertySun.mingNamedSupportWitness, {
    branch: '巳', sunGrade: '旺', decadalBranch: '巳', minorBranch: '巳',
    assistants: [{ star: '左辅', branch: '巳', relation: '守' }, { star: '右弼', branch: '酉', relation: '三合' }],
    lucun: { star: '禄存', branch: '巳', relation: '守' },
    moon: { star: '太阴', branch: '酉', relation: '三合', grade: '旺' },
  });
  const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p004-001'));
  const isolated = (normalizedPayload = p) => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
  const hit = result(isolated(), rule.knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '若左右諸吉星皆至，大小二限俱到');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const isolatedRun = isolated();
  const { input } = buildFortuneModelContext(isolatedRun,
    interpretFortune(isolatedRun, requestForFortuneRun(isolatedRun), 'ming-property-sun-four-supports'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  assert.match(formatFortunePrompt(input), /本命左辅、右弼、禄存及庙旺太阴均实到该太阳宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /propertySunMingNamedSupportCandidate|mingNamedSupportWitness|旺太阴酉宫/u);

  const h = archive.horoscope(year + '-06-01', 6);
  const adjacentBirth = native({ dateStr: '1988-04-02', timeIndex, gender: '男' });
  const wrongBirthday = { ...adjacentBirth, palaces: adjacentBirth.palaces.map(palace => ({ ...palace,
    majorStars: natal.palaces.find(row => row.index === palace.index).majorStars })) };
  const wrongBirthdayProof = quanshuSupportCondition(wrongBirthday, h.decadal.index, h.yearly.index, year, 'decadal', h.age.index);
  assert.deepEqual([p.ziweiBirthAnchorVerified, wrongBirthdayProof.ziweiBirthAnchorVerified], [true, false]);
  assert.equal(wrongBirthdayProof.namedSupport.sourceDecadal.verified, true);
  assert.equal(wrongBirthdayProof.namedSupport.sourceMinorVerified, true);
  assert.equal(wrongBirthdayProof.propertySunMingNamedSupportCandidate, undefined);
  assert.equal(wrongBirthdayProof.namedSupport.propertySun.mingNamedSupportWitness, undefined);
  assert.equal(wrongBirthdayProof.propertySunDoubleFuBiGuard, false);
  assert.equal(result(isolated(wrongBirthdayProof), rule.knowledgeId).status, 'unknown');
  const wrongMoon = withWrongStarLayer(natal, ['太阴'], 'majorStars', 'minorStars');
  const missingMoon = quanshuSupportCondition(wrongMoon, h.decadal.index, h.yearly.index, year, 'decadal', h.age.index);
  assert.equal(missingMoon.propertySunMingNamedSupportCandidate, undefined);
  assert.equal(result(isolated(missingMoon), rule.knowledgeId).status, 'partial');
  const next = archive.horoscope((year + 1) + '-06-01', 6);
  const movedMinor = quanshuSupportCondition(natal, next.decadal.index, next.yearly.index, year + 1, 'decadal', next.age.index);
  assert.equal(movedMinor.propertySunMingNamedSupportCandidate, false);
  assert.notEqual(result(isolated(movedMinor), rule.knowledgeId).status, 'matched');
});

test('p004 confirms both named assistant limits in a trine and holds bare trines as candidates', () => {
  const dateStr = '1988-04-01', timeIndex = 1, gender = '男';
  const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }), natal = engine.toJSON();
  const query = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith('expansion-p004-001'));
  const field = 'propertySunMingNamedPartnerGuardCandidate';
  for (const [year, branch, expected] of [[2023, '酉', true], [2027, '丑', false]]) {
    const run = submitYear(natal, year, 'ming-named-property-sun-partner', beijingBirthContext(dateStr, timeIndex));
    const fact = specific(run).find(row => row.scope === 'decadal' && row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const p = fact.normalizedPayload, sun = p.namedSupport.propertySun;
    assert.deepEqual([sun.branch, sun.decadalRelation, sun.minorRelation, p.otherBranch], ['巳', '守', '三合', branch]);
    assert.equal(p.propertySunMingNamedSupportCandidate, false);
    assert.equal(p.propertySunCandidate, true);
    assert.equal(p[field], expected);
    const isolated = normalizedPayload => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
    const selected = isolated(p), hit = result(selected, query.knowledgeId);
    assert.equal(hit.status, expected ? 'matched' : 'partial');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    if (!expected) continue;
    assert.equal(hit.matchedSourceExcerpt, '若左右諸吉星皆至，大小二限俱到');
    assert.deepEqual([sun.mingNamedSupportWitness.decadalBranch, sun.mingNamedSupportWitness.minorBranch], ['巳', '酉']);
    const { input } = buildFortuneModelContext(selected,
      interpretFortune(selected, requestForFortuneRun(selected), 'ming-named-property-sun-partner'));
    assert.match(formatFortunePrompt(input), /若左右諸吉星皆至，大小二限俱到/u);
    assert.doesNotMatch(formatFortunePrompt(input), /巳宫|酉宫|propertySunMingNamedPartnerGuard/u);
    const h = engine.horoscope(year + '-06-15', 6);
    const wrongLayer = withWrongStarLayer(natal, ['右弼'], 'minorStars', 'adjectiveStars');
    const broken = quanshuSupportCondition(wrongLayer, h.decadal.index, h.yearly.index, year, 'decadal', h.age.index);
    assert.equal(broken[field], undefined);
    assert.notEqual(result(isolated(broken), query.knowledgeId).status, 'matched');
  }
});

test('four literary passages reach SQLite with their actual Chang, Ke recipient, moving pair and horse witnesses', () => {
  const cases = [
    [exampleAt(2030), 'changThreeLayersCandidate', '本命文昌同段对流年、大限、小限的关系分别是守、守、三合'],
    [exampleAt(2010), 'keChangCandidate', '大限宫干戊使右弼化科，受化星守此限宫'],
    [exampleAt(2027), 'movingChangQuCandidate', '年干化禄的太阴在丑宫，与限宫为三合'],
    [{ dateStr: '1980-03-11', timeIndex: 0, year: 2012 }, 'horseChangCandidate', '本命天马在寅宫，同守此限宫'],
  ];
  for (const [index, [example, flag, phrase]] of cases.entries()) {
    const run = realRun(example); validateFortuneFacts(run);
    const fact = literaryFact(run, example.year), match = result(run, literaryRules[index].knowledgeId);
    assert.ok(fact.sourceFactIds.length >= 2);
    assert.equal(fact.normalizedPayload[flag], true);
    assert.equal(match.status, index === 0 ? 'matched' : 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
    assert.ok(match.windows.some(window => window.start <= fact.activeFrom && window.endExclusive >= fact.activeTo));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'literary-prompt'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    if (flag === 'horseChangCandidate') {
      const seat = fact.normalizedPayload.limits.find(row => row.horseCandidate);
      assert.deepEqual([seat.layer, seat.branch], ['minor', '寅']);
      assert.deepEqual(seat.horseCompanions.map(row => [row.star, row.branch, row.relation]), [
        ['本命禄存', '申', '冲'], ['紫微', '午', '三合'], ['天府', '戌', '三合'], ['流昌', '寅', '守'],
      ]);
      assert.match(prompt, /流昌在寅宫，与限宫为守/u);
    }
    assert.doesNotMatch(prompt, /quanshu-literary-limits|keChangCandidate|movingChangQuCandidate/u);
    assert.equal(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId), index === 0);
  }
});

test('single-layer and self-transformed Chang do not substitute for three-layer or two-star source conditions', () => {
  const run = realRun(exampleAt(2005, 1)), fact = literaryFact(run, 2005);
  assert.deepEqual(fact.normalizedPayload.changContacts, { yearly: '守', decadal: '其他', minor: '冲' });
  const currentSlice = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const genericOnly = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType) };
  assert.equal(fact.normalizedPayload.changThreeLayersCandidate, false);
  assert.equal(fact.normalizedPayload.keChangSplitAspectCandidate, true);
  for (const rule of literaryRules) {
    assert.equal(result(currentSlice, rule.knowledgeId).status, rule === literaryRules[1] ? 'partial' : 'not_matched');
    assert.equal(result(genericOnly, rule.knowledgeId).status, 'unknown');
  }
  const selfRun = realRun(exampleAt(2012, 2)), self = literaryFact(selfRun, 2012);
  const seat = self.normalizedPayload.limits.find(row => row.layer === 'minor');
  assert.ok(seat.ke.some(row => row.recipient === '文昌' && row.sameStar && row.relation === '守'
    && row.candidate === false && row.splitAspectCandidate === false));
  assert.equal(self.normalizedPayload.keChangCandidate, false);
  const withoutPartners = realRun(exampleAt(2003)), horse = literaryFact(withoutPartners, 2003);
  assert.ok(horse.normalizedPayload.limits.some(row => row.branch === horse.normalizedPayload.horse));
  assert.equal(horse.normalizedPayload.horseChangCandidate, false);
  const horseSlice = { ...withoutPartners, facts: withoutPartners.facts.filter(row => row.factType !== horse.factType || row.factId === horse.factId) };
  assert.equal(result(horseSlice, literaryRules[3].knowledgeId).status, 'not_matched');
});

test('named Sha and a separately located Ji exclude only the dated fallen Chang candidate', () => {
  const blocked = literarySlice({ dateStr: '1979-07-15', timeIndex: 0, year: 2014 });
  const eligible = literarySlice(exampleAt(1974));
  const rule = literaryRules[0];
  assert.equal(blocked.data.changThreeLayersCandidate, true);
  assert.equal(blocked.data.changAdverseCandidate, true);
  assert.equal(blocked.data.changGrade, '陷');
  const seat = blocked.data.limits.find(row => row.changAdverse);
  assert.deepEqual([seat.layer, seat.branch, seat.changRelation], ['decadal', '戌', '守']);
  assert.deepEqual(seat.changSha.map(row => [row.star, row.relation]), [['归档铃星', '守']]);
  assert.deepEqual(seat.changJi.map(row => [row.layer, row.stem, row.star, row.branch, row.relation]), [['natal', '己', '文曲', '辰', '冲']]);
  const match = result(blocked.run, rule.knowledgeId);
  assert.equal(match.status, 'excluded');
  assert.deepEqual(match.sourceFactIds, [blocked.fact.factId]);
  assert.deepEqual(match.windows, []);
  const { input } = buildFortuneModelContext(blocked.run, interpretFortune(blocked.run, requestForFortuneRun(blocked.run), 'chang-excluded'));
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule.knowledgeId));
  assert.match(literaryPrompt(blocked.run), /已见具名煞曜及化忌，科名分支在此段排除/u);
  assert.equal(eligible.data.changGrade, '陷');
  assert.equal(eligible.data.changThreeLayersCandidate, true);
  assert.equal(eligible.data.changAdverseCandidate, false);
  assert.equal(result(eligible.run, rule.knowledgeId).status, 'matched');
});

test('Ming Chang and Ke guards verify the actual small limit and keep the fixed-firebell exception in its dated slice', () => {
  const changExample = { dateStr: '1980-03-11', timeIndex: 1, year: 2029 };
  const chang = literarySlice(changExample);
  assert.equal(chang.data.chang, '酉');
  assert.equal(chang.data.changGrade, '庙');
  assert.deepEqual(chang.data.changContacts, { yearly: '守', decadal: '守', minor: '守' });
  assert.equal(chang.data.changVerifiedTripleGuard, true);
  const changMatch = result(chang.run, literaryRules[0].knowledgeId);
  assert.equal(changMatch.status, 'matched');
  assert.deepEqual(changMatch.sourceFactIds, [chang.fact.factId]);
  assert.deepEqual(changMatch.windows, [{ start: chang.fact.activeFrom, endExclusive: chang.fact.activeTo }]);
  assert.match(literaryPrompt(chang.run), /太岁和大小限均实守文昌的入庙宫酉/u);

  const keExample = { dateStr: '1961-05-15', timeIndex: 3, year: 2021 };
  const ke = literarySlice(keExample);
  assert.deepEqual([ke.data.decadalBranch, ke.data.minorBranch, ke.data.annualBranch], ['未', '未', '丑']);
  assert.equal(ke.data.keChangVerifiedDoubleGuard, true);
  assert.equal(ke.data.keChangMingNatalDoubleGuard, true);
  assert.deepEqual(ke.data.keChangVerifiedWitness, { star: '文曲', kind: '科', branch: '未', relation: '守' });
  const keMatch = result(ke.run, literaryRules[1].knowledgeId);
  assert.equal(keMatch.status, 'matched');
  assert.deepEqual(keMatch.sourceFactIds, [ke.fact.factId]);
  assert.deepEqual(keMatch.windows, [{ start: ke.fact.activeFrom, endExclusive: ke.fact.activeTo }]);
  const { input } = buildFortuneModelContext(ke.run, interpretFortune(ke.run, requestForFortuneRun(ke.run), 'ke-double-guard'));
  assert.match(formatFortuneFactAudit(input), /大小限同守文昌，生年干使文曲化科并实守未宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /文昌与另一颗按生年干化科的星同宫/u);
  assert.doesNotMatch(prompt, /生年干使文曲化科并实守未宫|keChangMingNatalDoubleGuard/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === keMatch.knowledgeId));
  const before = literarySlice({ ...keExample, year: 2020 });
  assert.equal(before.data.keChangVerifiedDoubleGuard, false);
  assert.equal(before.data.keChangMingNatalDoubleGuard, false);
  assert.equal(before.data.keChangCandidate, true);
  assert.equal(result(before.run, literaryRules[1].knowledgeId).status, 'partial');

  const n = native(keExample);
  const byBranch = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: 2021, yearIndex: byBranch('丑'), decadalIndex: byBranch('未') };
  const missing = quanshuTransformLimits(n, frame);
  assert.equal(missing.sourceMinor.verified, undefined);
  assert.equal(quanshuLiteraryLimits(n, missing, []).keChangVerifiedDoubleGuard, undefined);
  assert.equal(quanshuLiteraryLimits(n, missing, []).keChangMingNatalDoubleGuard, undefined);
  const wrong = quanshuTransformLimits(n, { ...frame, minorIndex: byBranch('午') });
  assert.equal(wrong.sourceMinor.verified, false);
  assert.equal(quanshuLiteraryLimits(n, wrong, []).keChangVerifiedDoubleGuard, undefined);
  const wrongKe = withWrongStarLayer(n, ['文曲'], 'minorStars', 'adjectiveStars');
  const wrongKeFrame = { ...frame, minorIndex: byBranch('未') };
  const wrongKeFact = quanshuLiteraryLimits(wrongKe, quanshuTransformLimits(wrongKe, wrongKeFrame), []);
  assert.equal(wrongKeFact.keChangMingNatalDoubleGuard, undefined);
  const exact = evaluateFortuneRules('ziwei', 'year', [{ ...ke.fact, normalizedPayload: wrongKeFact }])
    .find(row => row.knowledgeId === keMatch.knowledgeId).confirmations[0];
  assert.deepEqual([exact.hits.length, exact.unknown], [0, true]);

  const fallenExample = { dateStr: '1989-05-15', timeIndex: 4, year: 2044 };
  const fallen = literarySlice(fallenExample);
  assert.equal(fallen.data.changGrade, '陷');
  assert.equal(fallen.data.changThreeLayersCandidate, true);
  assert.equal(fallen.data.changAdverseCandidate, false);
  assert.equal(fallen.data.changTrineShaJiCandidate, false);
  assert.equal(fallen.data.changQuanshuFixedAdverseCandidate, false);
  assert.equal(fallen.data.changQuanshuFixedTrineShaJiCandidate, true);
  const seat = fallen.data.limits.find(row => row.changQuanshuFixedTrineShaJi);
  assert.deepEqual([seat.layer, seat.branch, seat.changRelation], ['decadal', '午', '守']);
  assert.deepEqual(seat.changQuanshuFixedTrineWitnesses, [
    { layer: 'minor', stem: '丙', star: '廉贞', branch: '戌', relation: '三合', sha: '铃星', candidate: true },
  ]);
  assert.match(literaryPrompt(fallen.run), /明刊文昌陷守此限，铃星与小限宫干丙所化忌的廉贞同在戌宫/u);
  const blocked = result(fallen.run, literaryRules[0].knowledgeId);
  assert.equal(blocked.status, 'excluded');
  assert.deepEqual(blocked.sourceFactIds, [fallen.fact.factId]);
  assert.deepEqual(blocked.windows, []);
  const nonMing = { ...fallen.fact, normalizedPayload: { ...fallen.data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(result({ ...fallen.run, facts: [nonMing] }, literaryRules[0].knowledgeId).status, 'matched');
  const next = literarySlice({ ...fallenExample, year: 2045 });
  assert.equal(next.data.changQuanshuFixedTrineShaJiCandidate, false);
  assert.equal(result(next.run, literaryRules[0].knowledgeId).status, 'not_matched');

  const staticFire = literarySlice({ dateStr: '1932-06-11', timeIndex: 8, gender: '男', year: 1978 });
  assert.equal(staticFire.data.changThreeLayersCandidate, true);
  assert.equal(staticFire.data.changAdverseCandidate, false);
  assert.equal(staticFire.data.changTrineShaJiCandidate, false);
  assert.equal(staticFire.data.changQuanshuFixedAdverseCandidate, true);
  const fireSeat = staticFire.data.limits.find(row => row.changQuanshuFixedAdverse);
  assert.deepEqual([fireSeat.layer, fireSeat.branch, fireSeat.changRelation], ['decadal', '寅', '守']);
  assert.deepEqual(fireSeat.changQuanshuFixedSha, [{ star: '火星', branch: '寅', relation: '守' }]);
  assert.deepEqual(fireSeat.changQuanshuFixedJi.map(row => [row.layer, row.stem, row.star, row.branch, row.relation]), [
    ['yearly', '戊', '天机', '寅', '守'], ['minor', '戊', '天机', '寅', '守'],
  ]);
  assert.match(literaryPrompt(staticFire.run), /明刊文昌在陷地守此限，明刊火铃与化忌同时有见位/u);
  assert.equal(result(staticFire.run, literaryRules[0].knowledgeId).status, 'excluded');
});

test('the Nanyang base Chang verse verifies a triple guard independently from the palace grade', () => {
  const sample = { dateStr: '1989-05-15', timeIndex: 10, year: 2044 };
  const { run, fact, data } = literarySlice(sample);
  const rule = literaryRules[0];
  const base = rule.queries[0].anyOf.find(where => where.changVerifiedTripleGuard === true);
  assert.deepEqual(base, { changVerifiedTripleGuard: true });
  assert.deepEqual([data.chang, data.changGrade, data.changNanyangGrade, data.changVerifiedTripleGuard], ['子', '地', '地', true]);
  assert.deepEqual(data.changContacts, { yearly: '守', decadal: '守', minor: '守' });
  const hit = result(run, rule.knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.match(describeFortuneFact({ method: 'ziwei', type: fact.factType, data }, String),
    /经原法核小限，太岁和大小限均实守文昌的子宫/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chang-triple'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === rule.knowledgeId));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /关注读书人的考核与名声/u);
  assert.doesNotMatch(provider, /均实守文昌的子宫|changVerifiedTripleGuard|limitPlacementProof/u);

  const natal = native(sample);
  const byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const archive = quanshuTransformLimits(natal, { lunarYear: sample.year, yearIndex: byBranch('子'),
    decadalIndex: byBranch('子'), minorIndex: byBranch('丑') });
  const displaced = quanshuLiteraryLimits(natal, archive, []);
  assert.equal(displaced.sourceMinor.verified, false);
  assert.equal(displaced.changVerifiedTripleGuard, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: displaced }] }, rule.knowledgeId).status, 'unknown');
});

test('Ming natal Xin Ke and Chang share one palace with opposite and trinal sibling-limit witnesses', () => {
  const example = { dateStr: '1961-05-15', timeIndex: 3 };
  const n = native(example), knowledgeId = literaryRules[1].knowledgeId;
  for (const [year, expected, decadal, minor] of [
    [1973, [false, true], { branch: '卯', relation: '三合' }, { branch: '未', relation: '守' }],
    [2015, [true, false], { branch: '未', relation: '守' }, { branch: '丑', relation: '冲' }],
    [1985, [false, false], { branch: '辰', relation: '其他' }, { branch: '未', relation: '守' }],
  ]) {
    const bound = submitYear(n, year, 'ming-ke-chang-siblings-' + year);
    const fact = literaryFact(bound, year), data = fact.normalizedPayload;
    assert.deepEqual([data.decadalBranch, data.minorBranch], [decadal.branch, minor.branch]);
    assert.deepEqual([data.changContacts.decadal, data.changContacts.minor], [decadal.relation, minor.relation]);
    assert.deepEqual([data.chang, data.changGrade, data.changNanyangGrade], ['未', undefined, '利']);
    assert.deepEqual([data.changQuanshuFixedAdverseCandidate, data.changQuanshuFixedTrineShaJiCandidate], [false, false]);
    assert.deepEqual([data.keChangVerifiedOpposedLimit, data.keChangVerifiedTrineLimit], expected);
    assert.equal(data.keChangVerifiedDoubleGuard, false);
    assert.equal(data.keChangCandidate, true);
    const positive = expected.includes(true);
    assert.deepEqual(data.keChangVerifiedSiblingWitness, positive ? { stem: '辛', star: '文曲', branch: '未', decadal, minor } : undefined);

    const isolated = structuredClone(fact);
    for (const key of ['keChangCandidate', 'keChangAspectCandidate', 'keChangSharedAspectCandidate', 'keChangSplitAspectCandidate']) {
      isolated.normalizedPayload[key] = false;
    }
    const run = { ...bound, facts: [...bound.facts.filter(row => row.factType !== fact.factType), isolated] };
    const hit = result(run, knowledgeId);
    assert.equal(hit.status, positive ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, positive ? [fact.factId] : []);
    if (positive) {
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-ke-chang-siblings'));
      const contact = year === 1973 ? '大限在卯宫三合，小限实守未宫' : '大限实守未宫，小限在丑宫对冲';
      assert.ok(formatFortuneFactAudit(input).includes('生年辛干令文曲化科，与本命文昌同在未宫。' + contact));
      assert.match(formatFortuneFactAudit(input), /明刊文昌正文另列此宫为利/u);
      assert.doesNotMatch(formatFortunePrompt(input), /生年辛干令文曲化科，与本命文昌同在未宫|keChangVerifiedSibling|明刊文昌正文另列此宫为利/u);
      assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === knowledgeId));
    }
    isolated.normalizedPayload.keChangVerifiedSiblingLimitProfile = 'unverified';
    assert.equal(result(run, knowledgeId).status, 'not_matched');
  }

  const self = literarySlice({ dateStr: '1986-05-15', timeIndex: 0, year: 2004 }).data;
  assert.deepEqual(self.limits[0].ke.find(row => row.layer === 'natal'), {
    layer: 'natal', stem: '丙', recipient: '文昌', branch: '戌', relation: '冲', sameStar: true,
    candidate: false, aspectCandidate: false, sharedAspectCandidate: false, splitAspectCandidate: false,
  });
  assert.equal(self.keChangVerifiedOpposedLimit, false);
  assert.equal(self.keChangVerifiedSiblingWitness, undefined);
  const byBranch = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: 2015, yearIndex: byBranch('未'), decadalIndex: byBranch('未') };
  const incomplete = quanshuTransformLimits(n, frame);
  assert.equal(incomplete.sourceMinor.verified, undefined);
  assert.equal(quanshuLiteraryLimits(n, incomplete, []).keChangVerifiedOpposedLimit, undefined);
  const missingQu = structuredClone(n), anchoredQu = position(missingQu, '文曲');
  anchoredQu.minorStars = anchoredQu.minorStars.filter(star => star.name !== '文曲');
  const missingRecipient = quanshuTransformLimits(missingQu, { ...frame, minorIndex: byBranch('丑') });
  assert.equal(missingRecipient.sourceMinor.verified, true);
  assert.equal(quanshuLiteraryLimits(missingQu, missingRecipient, []).keChangVerifiedOpposedLimit, undefined);
  const missingZiwei = structuredClone(n), ziweiSeat = position(missingZiwei, '紫微');
  ziweiSeat.majorStars = ziweiSeat.majorStars.filter(star => star.name !== '紫微');
  const auxOnly = quanshuLiteraryLimits(missingZiwei, quanshuTransformLimits(missingZiwei, { ...frame, minorIndex: byBranch('丑') }), []);
  assert.equal(auxOnly.keMajorBirthAnchorVerified, undefined);
  assert.equal(auxOnly.keChangVerifiedOpposedLimit, true);
});

test('the Ming sibling-limit witness keeps verified birth stems distinct from the Geng variant', () => {
  for (const [dateStr, timeIndex, year, stem, star, branch, expected] of [
    ['1984-05-15', 10, 2006, '甲', '武曲', '子', [true, false]],
    ['1985-05-15', 0, 1994, '乙', '紫微', '戌', [true, false]],
    ['1987-05-15', 3, 2005, '丁', '天机', '未', [false, true]],
    ['1988-05-15', 2, 2014, '戊', '右弼', '申', [false, true]],
    ['1989-04-15', 6, 2016, '己', '天梁', '辰', [false, true]],
    ['1982-02-15', 3, 2033, '壬', '天府', '未', [true, false]],
    ['1993-05-15', 6, 2008, '癸', '太阴', '辰', [false, true]],
    ['1990-05-15', 3, 2011, '庚', '太阴', '未', [false, false]],
  ]) {
    const astrolabe = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const h = astrolabe.horoscope(year + '-06-01', 6), n = astrolabe.toJSON();
    const layers = quanshuTransformLimits(n, { lunarYear: year, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index });
    assert.equal(layers.sourceMinor.verified, true);
    const data = quanshuLiteraryLimits(n, layers, []);
    const source = data.limits[0].ke.find(row => row.layer === 'natal');
    assert.deepEqual([data.chang, source.stem, source.recipient, source.branch], [branch, stem, star, branch]);
    assert.deepEqual([data.keChangVerifiedOpposedLimit, data.keChangVerifiedTrineLimit], expected);
    assert.deepEqual(data.keChangVerifiedSiblingWitness && [data.keChangVerifiedSiblingWitness.stem, data.keChangVerifiedSiblingWitness.star],
      expected.includes(true) ? [stem, star] : undefined);
  }
});

test('p059 accepts the Ming Geng Tian Tong recipient and keeps the compatible Tai Yin position separate', () => {
  const dateStr = '1990-02-15', timeIndex = 8;
  const n = native({ dateStr, timeIndex });
  const key = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.includes('huake-limit')).knowledgeId;
  const compatibleCandidates = {
    keChangVerifiedDoubleGuard: false, keChangCandidate: false, keChangAspectCandidate: false,
    keChangSharedAspectCandidate: false, keChangSplitAspectCandidate: false,
    keChangVerifiedOpposedLimit: false, keChangVerifiedTrineLimit: false,
  };
  for (const [year, minor, relation, kind] of [
    [2032, '戌', '三合', 'TrineLimit'], [2034, '申', '冲', 'OpposedLimit'],
    [2040, '寅', '守', 'DoubleGuard'], [2033, '酉', '其他', undefined],
  ]) {
    const run = submitYear(n, year, 'ming-geng-ke-' + year, beijingBirthContext(dateStr, timeIndex));
    const fact = literaryFact(run, year), data = fact.normalizedPayload;
    assert.deepEqual([data.chang, data.decadalBranch, data.minorBranch], ['寅', '寅', minor]);
    const compatibleKe = data.limits[0].ke.find(row => row.layer === 'natal');
    assert.deepEqual([compatibleKe.stem, compatibleKe.recipient, compatibleKe.branch], ['庚', '太阴', '戌']);
    const variant = ['DoubleGuard', 'OpposedLimit', 'TrineLimit'];
    assert.deepEqual(variant.map(name => data['keChangMingGeng' + name]), variant.map(name => kind === name));
    assert.equal(data.keChangMingNatalDoubleGuard, kind === 'DoubleGuard');
    assert.deepEqual(data.keChangMingGengWitness, kind ? { stem: '庚', star: '天同', branch: '寅',
      decadal: { branch: '寅', relation: '守' }, minor: { branch: minor, relation } } : undefined);
    const source = { ...fact, normalizedPayload: { ...data, ...compatibleCandidates } };
    const isolated = { ...run, facts: [source] };
    const hit = result(isolated, key);
    assert.equal(hit.status, kind === 'DoubleGuard' ? 'matched' : kind ? 'partial' : 'not_matched');
    if (kind) {
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'ming-geng-ke'));
      assert.match(formatFortuneFactAudit(input), /明刊庚干以天同化科，与本命文昌同在寅宫/u);
      const prompt = formatFortunePrompt(input);
      assert.doesNotMatch(prompt, /明刊庚干以天同化科/u);
      assert.equal(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === key), kind === 'DoubleGuard');
      const wrong = { ...source, normalizedPayload: { ...source.normalizedPayload, keChangMingGengProfile: 'other-source',
        keChangMingNatalDoubleGuardProfile: 'other-source' } };
      assert.equal(result({ ...isolated, facts: [wrong] }, key).status, 'not_matched');
    }
  }
  const otherBirth = native({ dateStr: '1990-02-16', timeIndex });
  const otherSeat = position(otherBirth, '天同'), changSeat = position(otherBirth, '文昌');
  const minor = otherBirth.palaces.find(row => row.earthlyBranch === '申');
  const frame = { lunarYear: 2034, yearIndex: changSeat.index, decadalIndex: changSeat.index, minorIndex: minor.index };
  const read = () => quanshuLiteraryLimits(otherBirth, quanshuTransformLimits(otherBirth, frame), []);
  assert.deepEqual([otherSeat.earthlyBranch, changSeat.earthlyBranch], ['卯', '寅']);
  const valid = read();
  assert.equal(valid.sourceDecadal.verified, true);
  assert.equal(valid.keChangMingGengOpposedLimit, false);
  const [moved] = otherSeat.majorStars.splice(otherSeat.majorStars.findIndex(row => row.name === '天同'), 1);
  changSeat.majorStars.push(moved);
  const mislocated = read();
  assert.equal(mislocated.keChangMingGengOpposedLimit, undefined);
  assert.equal(mislocated.keChangMingGengWitness, undefined);
  const required = evaluateFortuneRules('ziwei', 'year', [{
    factType: 'quanshu_literary_limits', scope: 'yearly', completeness: 'complete',
    normalizedPayload: { ...mislocated, ...compatibleCandidates },
  }]).find(row => row.knowledgeId === key).required[0];
  assert.deepEqual([required.hits.length, required.unknown], [0, true]);
});

test('Chang and Ke use the archived decade containing that lunar year for both seats and emitters', () => {
  for (const [year, index, flag] of [[2030, 0, 'changThreeLayersCandidate'], [1986, 1, 'keChangAspectCandidate']]) {
    const example = exampleAt(year), { run, fact, data } = literarySlice(example), id = literaryRules[index].knowledgeId;
    assert.deepEqual(data.sourceDecadal, { branch: data.decadalBranch, verified: true });
    assert.equal(data[flag], true);
    assert.equal(result(run, id).status, index === 0 ? 'matched' : 'partial');
    if (year === 2030) {
      const before = literaryFact(realRun(example), 2029);
      assert.equal(before.normalizedPayload.changThreeLayersCandidate, false);
      assert.equal(fact.activeFrom, '2030-02-02T16:00:00.000Z');
      assert.equal(before.activeTo, fact.activeFrom);
    } else {
      const smallLimit = data.limits.find(row => row.layer === 'minor');
      assert.equal(smallLimit.ke.find(row => row.layer === 'decadal').aspectCandidate, true);
    }
    const wrong = native(example), branchIndex = branch => wrong.palaces.find(row => row.earthlyBranch === branch).index;
    const wrongDecadalBranch = data.chang, rightDecadalIndex = branchIndex(data.decadalBranch);
    const opposite = (rightDecadalIndex + 6) % 12;
    const wrongDecadalIndex = branchIndex(wrongDecadalBranch) === rightDecadalIndex ? opposite : branchIndex(wrongDecadalBranch);
    const frame = { lunarYear: year, yearIndex: branchIndex(data.annualBranch), decadalIndex: wrongDecadalIndex,
      minorIndex: branchIndex(data.minorBranch) };
    const forged = wrong.palaces.find(row => row.index === wrongDecadalIndex);
    forged.decadal.range = [...wrong.palaces.find(row => row.index === rightDecadalIndex).decadal.range];
    assert.equal(quanshuLimitPhase(wrong, wrongDecadalIndex, year - wrong.rawDates.lunarDate.lunarYear + 1,
      quanshuLunarMidnight(year, 1)).ready, true);
    const unverified = quanshuLiteraryLimits(wrong, quanshuTransformLimits(wrong, frame), []);
    assert.deepEqual(unverified.sourceDecadal, { branch: forged.earthlyBranch, verified: false });
    assert.equal(unverified.sourceMinor.verified, true);
    assert.equal(unverified.changContacts.decadal, undefined);
    assert.equal(unverified[flag], undefined);
    const smallLimit = unverified.limits.find(row => row.layer === 'minor');
    assert.equal(smallLimit.ke.find(row => row.layer === 'decadal'), undefined);
    const invalid = { ...run, facts: [{ ...fact, normalizedPayload: unverified }] };
    assert.equal(result(invalid, id).status, 'unknown');
    const { limitPlacementProof, ...previousPayload } = data;
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    const previous = { ...run, facts: [{ ...fact, normalizedPayload: previousPayload }] };
    assert.equal(result(previous, id).status, 'unknown');
    const audit = describeFortuneFact({ method: 'ziwei', type: fact.factType, data: unverified }, String);
    assert.match(audit, /归档大限未能通过该农历年的实际十年段核验/u);
    assert.doesNotMatch(audit, /大限命宫在|大限宫干/u);
  }
});

test('p059 Ming Geng Ke and Chang can meet at a shared verified limit from distinct positions', () => {
  const cases = [
    ['1990-03-17', 1, '女', 2045, '酉', '酉', '守', '巳', '三合'],
    ['1990-03-18', 2, '女', 2046, '申', '申', '守', '寅', '冲'],
    ['1990-03-21', 1, '女', 2005, '丑', '酉', '三合', '丑', '守'],
    ['1990-03-21', 9, '男', 2005, '未', '丑', '冲', '未', '守'],
  ];
  const id = literaryRules[1].knowledgeId;
  for (const [dateStr, timeIndex, gender, year, branch, chang, changRelation, ke, keRelation] of cases) {
    const { run, fact, data } = literarySlice({ dateStr, timeIndex, gender, year });
    for (const key of ['keChangVerifiedDoubleGuard', 'keChangCandidate', 'keChangAspectCandidate',
      'keChangSharedAspectCandidate', 'keChangSplitAspectCandidate', 'keChangVerifiedOpposedLimit', 'keChangVerifiedTrineLimit',
      'keChangMingGengDoubleGuard', 'keChangMingGengOpposedLimit', 'keChangMingGengTrineLimit']) assert.equal(data[key], false, key);
    assert.deepEqual([data.sourceDecadal.verified, data.sourceMinor.verified, data.decadalBranch, data.minorBranch], [true, true, branch, branch]);
    assert.equal(data.keChangMingGengSharedLimitAspect, true);
    assert.deepEqual(data.keChangMingGengSharedLimitAspectWitness, {
      branch, chang: { branch: chang, relation: changRelation }, ke: { stem: '庚', star: '天同', branch: ke, relation: keRelation },
    });
    const changGuards = changRelation === '守';
    assert.equal(data.keChangMingNatalDoubleGuardWithKeAspect, changGuards);
    assert.equal(data.keChangMingNatalKeAtDoubleGuardWithChangAspect, !changGuards);
    if (!changGuards) assert.deepEqual(data.keChangMingNatalKeAtDoubleGuardWithChangAspectWitness, {
      stem: '庚', star: '天同', branch: ke, changBranch: chang, changRelation,
    });
    const hit = result(run, id);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const incorrectProfile = { ...fact, normalizedPayload: { ...data, keChangMingGengProfile: 'unverified',
      keChangMingNatalDoubleGuardProfile: 'unverified' } };
    assert.equal(result({ ...run, facts: [incorrectProfile] }, id).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-geng-common-limit'));
    assert.ok(formatFortuneFactAudit(input).includes('明刊庚干天同与文昌一守一照同一双限宫' + branch));
    assert.doesNotMatch(formatFortunePrompt(input), /明刊庚干天同与文昌一守一照|keChangMingGengSharedLimitAspectWitness/u);
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === id);
    assert.equal(finding.originalText, '科星二限遇文昌');
    if (!changGuards) {
      assert.match(formatFortunePrompt(input), /大小限都实守生年化科受曜所在宫/u);
      const natal = native({ dateStr, timeIndex, gender });
      const index = value => natal.palaces.find(row => row.earthlyBranch === value).index;
      const missingMinor = quanshuTransformLimits(natal, { lunarYear: year, yearIndex: index(data.annualBranch),
        decadalIndex: index(branch) });
      const normalizedPayload = quanshuLiteraryLimits(natal, missingMinor, []);
      assert.equal(normalizedPayload.keChangMingNatalKeAtDoubleGuardWithChangAspect, undefined);
      assert.notEqual(result({ ...run, facts: [{ ...fact, normalizedPayload }] }, id).status, 'matched');
    }
  }
  const example = { dateStr: '1990-03-18', timeIndex: 2, gender: '女' };
  assert.equal(literarySlice({ ...example, year: 2047 }).data.keChangMingGengSharedLimitAspect, false);
  const natal = native(example), index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: 2046, yearIndex: index('寅'), decadalIndex: index('申'), minorIndex: index('申') };
  const misplaced = quanshuTransformLimits(natal, { ...frame, minorIndex: index('酉') });
  const unresolved = quanshuLiteraryLimits(natal, misplaced, []);
  assert.equal(unresolved.keChangMingGengSharedLimitAspect, undefined);
  assert.equal(unresolved.keChangMingGengSharedLimitAspectWitness, undefined);
  assert.equal(unresolved.keChangMingNatalDoubleGuardWithKeAspect, undefined);
  assert.equal(unresolved.keChangMingNatalKeAtDoubleGuardWithChangAspect, false);
});

test('p059 confirms a verified Yi stem Ke aspect to the palace guarded by both limits and Chang', () => {
  const example = { dateStr: '1985-03-22', timeIndex: 5, gender: '男', year: 2043 };
  const { run, fact, data } = literarySlice(example);
  const id = literaryRules[1].knowledgeId;
  assert.equal(data.keMajorBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
  assert.equal(data.keMajorBirthAnchorVerified, true);
  assert.deepEqual([data.sourceDecadal.verified, data.sourceMinor.verified, data.decadalBranch, data.minorBranch, data.chang],
    [true, true, '巳', '巳', '巳']);
  assert.equal(data.keChangMingNatalDoubleGuard, false);
  assert.deepEqual(data.keChangMingNatalDoubleGuardWithKeAspectWitness,
    { stem: '乙', star: '紫微', branch: '亥', relation: '冲' });
  const hit = result(run, id);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '科星二限遇文昌');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.equal(Date.parse(fact.activeFrom), quanshuLunarMidnight(example.year, 1));
  const check = normalizedPayload => result({ ...run, facts: [{ ...fact, normalizedPayload }] }, id);
  assert.equal(check({ ...data, keMajorBirthAnchorProof: undefined }).status, 'unknown');

  const label = '明刊生年乙干化科的紫微';
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-yi-ke-aspect'));
  assert.ok(formatFortuneFactAudit(input).includes(label));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /另一颗实有化科受曜从对宫或三合宫照到同一宫/u);
  assert.ok(!prompt.includes(label));

  const natal = native(example), index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: example.year, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch), minorIndex: index(data.minorBranch) };
  const inverted = structuredClone(natal);
  for (const [star, branch] of [['紫微', '巳'], ['天府', '亥']]) {
    const origin = position(inverted, star);
    const [moved] = origin.majorStars.splice(origin.majorStars.findIndex(row => row.name === star), 1);
    inverted.palaces.find(row => row.earthlyBranch === branch).majorStars.push(moved);
  }
  const wrongBirthAnchors = quanshuLiteraryLimits(inverted, quanshuTransformLimits(inverted, frame), []);
  assert.equal(wrongBirthAnchors.keMajorBirthAnchorVerified, false);
  assert.equal(wrongBirthAnchors.keChangMingNatalDoubleGuard, undefined);
  assert.equal(wrongBirthAnchors.keChangMingNatalDoubleGuardWithKeAspect, undefined);
  assert.notEqual(check(wrongBirthAnchors).status, 'matched');

  const wrongLayer = natal.palaces.find(row => row.earthlyBranch === '亥');
  const [shifted] = wrongLayer.majorStars.splice(wrongLayer.majorStars.findIndex(row => row.name === '紫微'), 1);
  wrongLayer.adjectiveStars.push(shifted);
  const unavailable = quanshuLiteraryLimits(natal, quanshuTransformLimits(natal, frame), []);
  assert.equal(unavailable.keChangMingNatalDoubleGuardWithKeAspect, undefined);
  assert.equal(unavailable.keChangMingNatalDoubleGuardWithKeAspectWitness, undefined);
  assert.notEqual(check(unavailable).status, 'matched');
});

test('literary candidates use verified minor positions without suppressing independent decadal evidence', () => {
  const cases = [
    [exampleAt(2030), 'changThreeLayersCandidate', undefined],
    [{ dateStr: '1990-02-15', timeIndex: 8, year: 2034 }, 'keChangMingGengOpposedLimit', undefined],
    [{ dateStr: '1980-03-11', timeIndex: 0, year: 2012 }, 'horseChangCandidate', undefined],
    [{ dateStr: '1947-02-05', timeIndex: 3, year: 1990 }, 'movingChangQuLifeAndCommonMinorTrinesCandidate', undefined],
    [exampleAt(2027), 'movingChangQuCandidate', true],
  ];
  for (const [example, key, expected] of cases) {
    const { data } = literarySlice(example);
    assert.equal(data[key], true, key);
    const n = native(example), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
    const frame = { lunarYear: example.year, yearIndex: index(data.annualBranch),
      decadalIndex: index(data.decadalBranch), minorIndex: index(data.minorBranch) };
    const layers = quanshuTransformLimits(n, frame);
    assert.equal(layers.sourceMinor.verified, true);
    const moving = data.limits[0].moving.filter(row => row.branch).map(row => ({ branch: row.branch, movingStarIds: [row.star] }));
    const wrongSource = { ...layers, sourceMinor: { ...layers.sourceMinor, verified: false } };
    const missing = quanshuLiteraryLimits(n, wrongSource, moving);
    assert.equal(missing[key], expected, key);
    assert.equal(missing.changContacts.minor, undefined);
    assert.equal(missing.minorBranch, data.minorBranch);
  }
});

test('fallen Chang is excluded when named Sha and Ji share the same trine palace', () => {
  const year = 1990;
  const submitted = submitYear(native({ dateStr: '1979-02-05', timeIndex: 8 }), year, 'chang-sha-ji-trine');
  const fact = literaryFact(submitted, year), data = fact.normalizedPayload;
  const run = { ...submitted, facts: submitted.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  assert.equal(fact.activeFrom, '1990-01-26T16:00:00.000Z');
  assert.equal(data.changThreeLayersCandidate, true);
  assert.equal(data.changAdverseCandidate, false);
  assert.equal(data.changTrineShaJiCandidate, true);
  const seat = data.limits.find(row => row.changTrineShaJi);
  assert.deepEqual([seat.layer, seat.branch, seat.changRelation], ['minor', '寅', '守']);
  assert.deepEqual(seat.changTrineShaJiWitnesses, [
    { layer: 'minor', stem: '丙', star: '廉贞', branch: '午', relation: '三合', sha: ['归档铃星'], candidate: true },
  ]);
  const rule = literaryRules[0], match = result(run, rule.knowledgeId);
  assert.equal(match.status, 'excluded');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, []);
  const prompt = literaryPrompt(run);
  assert.match(prompt, /归档铃星与小限宫干丙所化忌的廉贞同在午宫，共以三合照此限，科名分支在此段排除/u);
  assert.doesNotMatch(prompt, /changTrineShaJi/u);

  const separateTrines = literarySlice({ dateStr: '1979-02-13', timeIndex: 4, year: 2010 });
  assert.equal(separateTrines.data.changThreeLayersCandidate, true);
  assert.equal(separateTrines.data.changAdverseCandidate, false);
  assert.equal(separateTrines.data.changTrineShaJiCandidate, false);
  assert.ok(separateTrines.data.limits.every(row => row.changTrineShaJiWitnesses.length === 0));
  const fixedSeat = separateTrines.data.limits.find(row => row.changQuanshuFixedTrineShaJi);
  assert.deepEqual(fixedSeat.changQuanshuFixedTrineWitnesses.map(row => [row.layer, row.star, row.branch, row.sha]), [
    ['yearly', '天同', '戌', '铃星'], ['minor', '天同', '戌', '铃星'],
  ]);
  assert.equal(result(separateTrines.run, rule.knowledgeId).status, 'excluded');
  const archiveOnly = { ...separateTrines.fact, normalizedPayload: { ...separateTrines.data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(result({ ...separateTrines.run, facts: [archiveOnly] }, rule.knowledgeId).status, 'matched');
});

test('Chang at the limit can meet a distinct Ke recipient across the palace while the historical guard path is false', () => {
  const { run, fact, data } = literarySlice(exampleAt(1986));
  const rule = literaryRules[1];
  assert.equal(data.keChangCandidate, false);
  assert.equal(data.keChangAspectCandidate, true);
  const seat = data.limits.find(row => row.layer === 'minor');
  assert.equal(seat.changRelation, '守');
  assert.deepEqual(seat.ke.filter(row => row.aspectCandidate).map(row => [row.layer, row.stem, row.recipient, row.branch, row.relation]),
    [['decadal', '乙', '紫微', '辰', '冲']]);
  const match = result(run, rule.knowledgeId);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.match(literaryPrompt(run), /大限宫干乙使紫微化科，受化星在辰宫，与守限文昌为冲/u);
  assert.equal(result(literarySlice(exampleAt(1985)).run, rule.knowledgeId).status, 'not_matched');
});

test('a distinct Ke recipient and Chang can share an opposing or trine palace through the client and SQLite', () => {
  const dateStr = '1976-06-21', rule = literaryRules[1];
  const cases = [
    [2003, 0, 'decadal', '辰', '戌', '冲', 'yearly', '流年干', '癸', '太阴'],
    [2008, 0, 'minor', '寅', '戌', '三合', 'minor', '小限宫干', '庚', '太阴'],
    [2032, 2, 'minor', '寅', '申', '冲', 'decadal', '大限宫干', '己', '天梁'],
  ];
  for (const [year, timeIndex, scope, limitBranch, sharedBranch, aspect, layer, layerName, stem, recipient] of cases) {
    const run = submitYear(native({ dateStr, timeIndex }), year, 'ke-chang-shared-' + year);
    const fact = literaryFact(run, year), data = fact.normalizedPayload;
    assert.equal(data.chang, sharedBranch);
    assert.equal(data.keChangCandidate, false);
    assert.equal(data.keChangAspectCandidate, false);
    assert.equal(data.keChangSharedAspectCandidate, true);
    const seat = data.limits.find(row => row.layer === scope);
    assert.deepEqual([seat.branch, seat.changRelation], [limitBranch, aspect]);
    assert.ok(seat.ke.some(row => row.layer === layer && row.stem === stem && row.recipient === recipient
      && row.branch === sharedBranch && row.relation === aspect && row.sharedAspectCandidate === true));
    const clipped = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const match = result(clipped, rule.knowledgeId);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const prompt = literaryPrompt(clipped);
    assert.ok(prompt.includes(layerName + stem + '使' + recipient + '化科，受化星与本命文昌同居' + sharedBranch + '宫，共以' + aspect + '照此限'));
    assert.doesNotMatch(prompt, /keChangSharedAspectCandidate|sharedAspectCandidate/u);
  }

  const { run, data } = literarySlice({ dateStr, timeIndex: 1, year: 2009 });
  const seat = data.limits.find(row => row.layer === 'minor');
  assert.equal(data.chang, '酉');
  assert.deepEqual([seat.branch, seat.changRelation], ['丑', '三合']);
  assert.ok(seat.ke.some(row => row.recipient === '文曲' && row.branch === '巳' && row.relation === '三合'
    && row.sharedAspectCandidate === false && row.splitAspectCandidate === true));
  assert.equal(data.keChangSharedAspectCandidate, false);
  assert.equal(data.keChangSplitAspectCandidate, true);
  assert.equal(result(run, rule.knowledgeId).status, 'partial');
});

test('Chang and Ke in separate palaces can aspect the same actual limit through SQLite', () => {
  const rule = literaryRules[1], dateStr = '1946-05-15';
  const cases = [
    [1957, 0, 'decadal', '辰', '戌', '冲', 'decadal', '大限宫干', '壬', '天府', '申', '1957-01-30T16:00:00.000Z'],
    [1961, 1, 'minor', '丑', '酉', '三合', 'yearly', '流年干', '辛', '文曲', '巳', '1961-02-14T16:00:00.000Z'],
  ];
  for (const [year, timeIndex, scope, branch, chang, changRelation, layer, layerName, stem, recipient, keBranch, start] of cases) {
    const submitted = submitYear(native({ dateStr, timeIndex }), year, 'ke-chang-split-' + year);
    const fact = literaryFact(submitted, year), data = fact.normalizedPayload;
    const run = { ...submitted, facts: submitted.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    assert.equal(data.chang, chang);
    assert.equal(data.keChangCandidate, false);
    assert.equal(data.keChangAspectCandidate, false);
    assert.equal(data.keChangSharedAspectCandidate, false);
    assert.equal(data.keChangSplitAspectCandidate, true);
    const seat = data.limits.find(row => row.layer === scope);
    assert.deepEqual([seat.branch, seat.changRelation], [branch, changRelation]);
    assert.ok(seat.ke.some(row => row.layer === layer && row.stem === stem && row.recipient === recipient
      && row.branch === keBranch && row.relation === '三合' && row.splitAspectCandidate === true));
    const match = result(run, rule.knowledgeId);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start, endExclusive: fact.activeTo }]);
    const prompt = literaryPrompt(run);
    assert.ok(prompt.includes(`${layerName}${stem}使${recipient}化科，本命文昌在${chang}宫，受科星在${keBranch}宫，分别以${changRelation}、三合照同一限宫`));
    assert.doesNotMatch(prompt, /keChangSplitAspectCandidate|splitAspectCandidate/u);
  }
  const detached = literarySlice(exampleAt(1985));
  assert.equal(detached.data.keChangSplitAspectCandidate, false);
  assert.equal(result(detached.run, rule.knowledgeId).status, 'not_matched');
});

test('product Chang and Qu plus the natal assistant pair can match without the solar-Lu combination', () => {
  const example = { dateStr: '1980-05-15', timeIndex: 2, year: 2003 };
  const { run, fact, data } = literarySlice(example);
  const rule = literaryRules[2];
  assert.equal(data.movingChangQuCandidate, false);
  assert.equal(data.movingChangQuAssistantCandidate, true);
  assert.equal(data.lifeBranch, '卯');
  const seat = data.limits.find(row => row.movingAssistantCandidate);
  assert.deepEqual([seat.layer, seat.branch], ['minor', '亥']);
  assert.deepEqual(seat.moving.map(row => [row.star, row.branch, row.relation]), [['流昌', '卯', '三合'], ['流曲', '亥', '守']]);
  assert.deepEqual(seat.assistants.map(row => [row.star, row.branch, row.relation]), [['左辅', '未', '三合'], ['右弼', '未', '三合']]);
  const match = result(run, rule.knowledgeId);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.match(literaryPrompt(run), /本命辅弼均三合此限，为未宫的左辅与未宫的右弼/u);
  assert.equal(result(literarySlice({ ...example, year: 2002 }).run, rule.knowledgeId).status, 'not_matched');
});

test('p021 reaches SQLite independently through named trines, one birth-stem group and the Si-You seats', () => {
  const cases = [
    { dateStr: '1980-02-15', timeIndex: 2, year: 1993, scope: 'minor', branch: '亥',
      expected: [true, false, false], moving: [['流昌', '卯', '三合'], ['流曲', '亥', '守']],
      support: [['左辅', '卯'], ['三台', '未'], ['八座', '未']], transforms: [],
      phrase: '实际三合此限的具名本命星曜为卯宫的左辅、未宫的三台、未宫的八座' },
    { dateStr: '1981-02-15', timeIndex: 3, year: 2013, scope: 'minor', branch: '亥',
      expected: [false, true, false], moving: [['流昌', '卯', '三合'], ['流曲', '亥', '守']], support: [],
      transforms: [['巨门', '卯', '禄'], ['文曲', '未', '科']],
      phrase: '同一生年干辛的科权禄受曜中实际三合此限的是卯宫的巨门化禄、未宫的文曲化科' },
    { dateStr: '1980-02-15', timeIndex: 0, year: 1999, scope: 'minor', branch: '巳',
      expected: [false, false, true], moving: [['流昌', '酉', '三合'], ['流曲', '巳', '守']],
      support: [], transforms: [], phrase: '流昌流曲分居巳、酉，符合卷一所列得地支位' },
  ];
  const rule = literaryRules[2];
  for (const example of cases) {
    const { dateStr, timeIndex, year, scope, branch, expected, moving, support, transforms, phrase } = example;
    const bound = submitYear(native({ dateStr, timeIndex }), year, 'moving-literary-' + year);
    const fact = literaryFact(bound, year);
    assert.ok(fact);
    const data = fact.normalizedPayload, seat = data.limits.find(row => row.layer === scope);
    assert.equal(seat.branch, branch);
    assert.deepEqual(seat.moving.map(row => [row.star, row.branch, row.relation]), moving);
    assert.deepEqual(seat.namedSupportTrines.map(row => [row.star, row.branch]), support);
    assert.deepEqual(seat.natalTransformTrines.map(row => [row.star, row.branch, row.kind]), transforms);
    assert.deepEqual([data.movingChangQuCandidate, data.movingChangQuAssistantCandidate], [false, false]);
    assert.deepEqual([data.movingChangQuNamedTrinesCandidate, data.movingChangQuNatalTransformCandidate,
      data.movingChangQuSourceSeatsCandidate], expected);
    const run = { ...bound, facts: bound.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const match = result(run, rule.knowledgeId);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'moving-literary'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    assert.doesNotMatch(prompt, /movingChangQuNamedTrinesCandidate|natalTransformTrines|namedSupportTrines/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== rule.knowledgeId)));
  }

  const { dateStr, timeIndex, year } = cases[0];
  const archive = astro.withOptions({ dateStr, timeIndex, gender: '女', config, fixLeap: true });
  const natal = archive.toJSON(), horoscope = archive.horoscope(year + '-06-01', 6);
  assert.equal(natal.rawDates.lunarDate.lunarDay, 29);
  const wrongLayer = withWrongStarLayer(natal, ['三台', '八座'], 'adjectiveStars', 'minorStars');
  const sourcePalace = position(natal, '三台'), wrongPalace = natal.palaces.find(palace => palace.earthlyBranch === '卯');
  const displaced = sourcePalace.adjectiveStars.filter(star => ['三台', '八座'].includes(star.name));
  assert.equal(displaced.length, 2);
  sourcePalace.adjectiveStars = sourcePalace.adjectiveStars.filter(star => !displaced.includes(star));
  wrongPalace.adjectiveStars.push(...displaced);
  const frame = { lunarYear: year, yearIndex: horoscope.yearly.index,
    decadalIndex: horoscope.decadal.index, minorIndex: horoscope.age.index };
  const palaces = natal.palaces.map(palace => ({ branch: palace.earthlyBranch,
    movingStarIds: (horoscope.yearly.stars?.[palace.index] ?? []).map(star => star.name) }));
  for (const changed of [natal, wrongLayer]) {
    const uncertain = quanshuLiteraryLimits(changed, quanshuTransformLimits(changed, frame), palaces);
    assert.equal(uncertain.movingChangQuNamedTrinesCandidate, undefined);
    assert.ok(uncertain.limits.every(seat => seat.namedSupportTrines.length === 0));
  }
});

test('Horse, Lu and Chang at one limit require both Zi and Fu and the same horse at the peer limit', () => {
  const example = { dateStr: '1980-05-15', timeIndex: 0, year: 2018 };
  const { run, fact, data } = literarySlice(example);
  const rule = literaryRules[3];
  assert.equal(data.horseChangCandidate, false);
  assert.equal(data.horseChangSplitCandidate, true);
  assert.deepEqual(data.horseSplit, [{ horseLayer: 'decadal', peerLayer: 'minor', candidate: true }]);
  assert.deepEqual(data.limits.map(row => [row.layer, row.branch, row.horseRelation]), [['decadal', '寅', '守'], ['minor', '申', '冲']]);
  const match = result(run, rule.knowledgeId);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const prompt = literaryPrompt(run);
  assert.match(prompt, /本命天马实守寅宫的大限，同限会禄存和流昌/u);
  assert.match(prompt, /小限在申宫，同时会天马、紫微和天府/u);
  assert.doesNotMatch(prompt, /quanshu_literary_limits|horseChangSplitCandidate|horseLayer|peerLayer/u);
  assert.equal(result(literarySlice({ ...example, year: 2017 }).run, rule.knowledgeId).status, 'not_matched');

  const natal = native(example);
  const byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: example.year, yearIndex: byBranch(data.annualBranch),
    decadalIndex: byBranch(data.decadalBranch), minorIndex: byBranch(data.minorBranch) };
  const moves = data.limits[0].moving.filter(row => row.branch).map(row => ({ branch: row.branch, movingStarIds: [row.star] }));
  const wrongDecade = copyChartWithShiftedDecade(natal, frame);
  const unverified = quanshuLiteraryLimits(wrongDecade, quanshuTransformLimits(wrongDecade, frame), moves);
  assert.deepEqual(unverified.sourceDecadal, { branch: '寅', verified: false });
  assert.equal(unverified.sourceMinor.verified, true);
  assert.deepEqual(unverified.limits.map(row => row.layer), ['minor']);
  assert.deepEqual(unverified.horseSplit, []);
  assert.equal(unverified.horseChangSplitCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, rule.knowledgeId).status, 'unknown');
  const { limitEncounterProof, ...oldPayload } = data;
  assert.equal(limitEncounterProof, 'quanshu-literary-verified-limit-witnesses-v1');
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: oldPayload }] }, rule.knowledgeId).status, 'unknown');
});

test('p010 guards two actual limits with all five named stars where both Chang tables agree', () => {
  const example = { dateStr: '1950-03-02', timeIndex: 1, gender: '女', year: 2006 };
  const natal = native(example), knowledgeId = literaryRules[3].knowledgeId;
  const bound = submitYear(natal, example.year, 'two-horse-guards-chang-agreement');
  const fact = literaryFact(bound, example.year), data = fact.normalizedPayload;
  assert.deepEqual([data.decadalBranch, data.minorBranch, data.horse, data.lumingChang, data.sourceMinor.verified, data.sourceMinor.ordinal],
    ['申', '申', '申', '申', true, 57]);
  assert.equal(data.horseChangDoubleGuardAgreementCandidate, true);
  assert.deepEqual(data.horseChangDoubleGuardAgreementWitness, { branch: '申', annualStem: '丙',
    stars: ['本命天马', '本命禄存', '紫微', '天府', '流昌'].map(star => ({ star, branch: '申', relation: '守' })) });
  assert.equal(data.horseChangCandidate, true);
  assert.equal(data.lumingHorseChangCandidate, true);
  assert.equal(data.horseChangSplitCandidate, false);
  const run = { ...bound, facts: [fact] };
  const hit = result(run, knowledgeId);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'double-guard-chang-agreement'));
  assert.match(formatFortuneFactAudit(input), /两种丙干流昌安法同落此宫/u);
  const safeConditions = /复核的大限和小限实守本命天马所在宫，本命禄存、紫微、天府和流年文昌也同在此宫/u;
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, safeConditions);
  assert.doesNotMatch(prompt, /两种丙干流昌安法同落此宫|horseChangDoubleGuardAgreement/u);
  assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === knowledgeId)));
  const otherSource = { ...fact, normalizedPayload: { ...data, lumingChangProfile: 'other-source' } };
  assert.equal(result({ ...run, facts: [otherSource] }, knowledgeId).status, 'partial');

  for (const year of [2005, 2007]) {
    const near = literarySlice({ ...example, year });
    assert.equal(near.data.horseChangDoubleGuardAgreementCandidate, false);
    assert.equal(near.data.horseChangDoubleGuardAgreementWitness, undefined);
    assert.notEqual(result(near.run, knowledgeId).status, 'matched');
  }
  const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const frame = { lunarYear: example.year, yearIndex: index('戌'), decadalIndex: index('申'), minorIndex: index('申') };
  const flow = [{ branch: '申', movingStarIds: ['流昌'] }];
  const missingFlow = quanshuLiteraryLimits(natal, quanshuTransformLimits(natal, frame), []);
  assert.equal(missingFlow.horseChangDoubleGuardAgreementCandidate, undefined);
  const wrongMinor = quanshuTransformLimits(natal, { ...frame, minorIndex: index('酉') });
  const decadalOnly = quanshuLiteraryLimits(natal, wrongMinor, flow);
  assert.deepEqual(decadalOnly.limits.map(row => row.layer), ['decadal']);
  assert.equal(decadalOnly.horseChangDoubleGuardAgreementCandidate, undefined);
  assert.equal(decadalOnly.horseChangCandidate, true);
  const wrongDecade = copyChartWithShiftedDecade(natal, frame);
  const minorOnly = quanshuLiteraryLimits(wrongDecade, quanshuTransformLimits(wrongDecade, frame), flow);
  assert.deepEqual(minorOnly.limits.map(row => row.layer), ['minor']);
  assert.equal(minorOnly.horseChangDoubleGuardAgreementCandidate, undefined);
  assert.equal(minorOnly.horseChangCandidate, true);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: minorOnly }] }, knowledgeId).status, 'partial');
  const wrongTianfu = structuredClone(natal), origin = position(wrongTianfu, '天府');
  wrongTianfu.palaces.find(row => row.index === index('酉')).majorStars.push(origin.majorStars.find(row => row.name === '天府'));
  origin.majorStars = origin.majorStars.filter(row => row.name !== '天府');
  const invalid = quanshuLiteraryLimits(wrongTianfu, quanshuTransformLimits(wrongTianfu, frame), flow);
  assert.equal(invalid.horseChangDoubleGuardAgreementCandidate, undefined);
  assert.equal(invalid.horseChangDoubleGuardAgreementWitness, undefined);
  const tomorrow = native({ ...example, dateStr: '1950-03-03' });
  const shiftedBirthday = { ...natal, solarDate: tomorrow.solarDate,
    rawDates: { ...natal.rawDates, lunarDate: tomorrow.rawDates.lunarDate } };
  const wrongBirthDay = quanshuLiteraryLimits(shiftedBirthday, quanshuTransformLimits(shiftedBirthday, frame), flow);
  assert.equal(wrongBirthDay.keMajorBirthAnchorVerified, false);
  assert.deepEqual([wrongBirthDay.sourceDecadal.verified, wrongBirthDay.sourceMinor.verified, wrongBirthDay.horse,
    wrongBirthDay.lumingChang, wrongBirthDay.limits[0].horseCompanions.find(row => row.star === '流昌').branch],
  [true, true, '申', '申', '申']);
  assert.equal(wrongBirthDay.horseChangDoubleGuardAgreementCandidate, undefined);
  assert.equal(wrongBirthDay.horseChangDoubleGuardAgreementWitness, undefined);
  assert.equal(wrongBirthDay.horseChangCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongBirthDay }] }, knowledgeId).status, 'unknown');
  for (const star of ['天马', '禄存']) {
    const wrong = withWrongStarLayer(natal, [star], 'minorStars', 'majorStars');
    const unverified = quanshuLiteraryLimits(wrong, quanshuTransformLimits(wrong, frame), flow);
    assert.equal(unverified.horseChangDoubleGuardAgreementCandidate, undefined, star);
    assert.equal(unverified.horseChangDoubleGuardAgreementWitness, undefined, star);
    assert.equal(unverified.horseChangCandidate, undefined, star);
    assert.equal(unverified.lumingHorseChangCandidate, undefined, star);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, knowledgeId).status, 'unknown', star);
  }
});

test('p010 takes the Jielan double guard when the later Luming Chang table puts the star elsewhere', () => {
  const sample = { dateStr: '1984-10-20', timeIndex: 10, gender: '男', year: 2012 };
  const natal = native(sample), knowledgeId = literaryRules[3].knowledgeId;
  const submitted = submitYear(natal, sample.year, 'jielan-horse-double-guard');
  const fact = literaryFact(submitted, sample.year), data = fact.normalizedPayload;
  assert.deepEqual([data.annualStem, data.horse, data.lumingChang, data.decadalBranch, data.minorBranch,
    data.sourceDecadal.verified, data.sourceMinor.verified], ['壬', '寅', '子', '寅', '寅', true, true]);
  assert.equal(data.horseChangJielanDoubleGuardCandidate, true);
  assert.deepEqual(data.horseChangJielanDoubleGuardWitness, { branch: '寅', annualStem: '壬',
    stars: ['本命天马', '本命禄存', '紫微', '天府', '流昌'].map(star => ({ star, branch: '寅', relation: '守' })) });
  assert.equal(data.horseChangDoubleGuardAgreementCandidate, false);
  assert.equal(data.horseChangDoubleGuardAgreementWitness, undefined);
  assert.equal(data.lumingHorseChangCandidate, false);

  const strict = { ...data, horseChangCandidate: false, horseChangSplitCandidate: false,
    lumingHorseChangCandidate: false, lumingHorseChangSplitCandidate: false };
  const run = { ...submitted, facts: [{ ...fact, normalizedPayload: strict }] };
  const verdict = result(run, knowledgeId);
  assert.equal(verdict.status, 'partial');
  assert.deepEqual(verdict.sourceFactIds, [fact.factId]);
  assert.deepEqual(verdict.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jielan-horse-double-guard'));
  assert.match(formatFortuneFactAudit(input), /按《捷览》壬干安流昌，大限和小限实守寅宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /按《捷览》壬干安流昌，大限和小限实守寅宫|horseChangJielanDoubleGuard/u);
  assert.doesNotMatch(formatFortunePrompt(input), /复核的大限和小限实守本命天马所在宫/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== knowledgeId)));
  const unrelated = { ...fact, normalizedPayload: { ...strict, jielanAnnualChangProfile: 'other-source' } };
  assert.equal(result({ ...run, facts: [unrelated] }, knowledgeId).status, 'not_matched');

  const before = literaryFact(submitted, 2011);
  assert.equal(before.activeTo, fact.activeFrom);
  assert.equal(before.normalizedPayload.horseChangJielanDoubleGuardCandidate, false);
  const byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: sample.year, yearIndex: byBranch(data.annualBranch),
    decadalIndex: byBranch('寅'), minorIndex: byBranch('寅') };
  const moves = [{ branch: '寅', movingStarIds: ['流昌'] }];
  const withoutLu = structuredClone(natal), tiger = withoutLu.palaces.find(row => row.index === frame.decadalIndex);
  tiger.minorStars = tiger.minorStars.filter(star => star.name !== '禄存');
  const missing = quanshuLiteraryLimits(withoutLu, quanshuTransformLimits(withoutLu, frame), moves);
  assert.equal(missing.horseChangJielanDoubleGuardCandidate, undefined);
  assert.equal(missing.horseChangJielanDoubleGuardWitness, undefined);
});

test('the ten printed Luming Chang positions remain distinct from the product positions', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  assert.deepEqual(stems.map(quanshuLumingChangBranch), [...'巳午申酉申酉戌亥子丑']);
  const product = [...'巳午申酉申酉亥子寅卯'];
  assert.deepEqual(stems.filter((stem, index) => quanshuLumingChangBranch(stem) !== product[index]), [...'庚辛壬癸']);
  assert.equal(quanshuLumingChangBranch('庚辛'), undefined);
  assert.equal(quanshuLumingChangBranch(''), undefined);
});

test('real Luming-only same-limit and split-limit witnesses reach SQLite through client facts', () => {
  for (const [sample, sameLimit, splitLimit] of [
    [{ dateStr: '1980-05-11', timeIndex: 9, year: 2040 }, true, true],
    [{ dateStr: '1980-03-11', timeIndex: 8, year: 2030 }, false, true],
    [{ dateStr: '1980-03-11', timeIndex: 6, year: 2012 }, false, false],
  ]) {
    const input = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, 5, 1);
    const archive = { snapshotId: 'luming-horse-snapshot', profileId: 'luming-horse-profile', chart: chart(native(sample)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
    const full = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'luming-horse', archive);
    const fact = literaryFact(full, sample.year);
    const run = { ...full, facts: full.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const p = fact.normalizedPayload;
    assert.deepEqual([p.horseChangCandidate, p.horseChangSplitCandidate, p.lumingHorseChangCandidate, p.lumingHorseChangSplitCandidate],
      [false, false, sameLimit, splitLimit]);
    assert.equal(p.lumingChangProfile, quanshuLiteraryLimitsPolicy.lumingChang);
    const rule = literaryRules[3];
    const match = result(run, rule.knowledgeId);
    assert.equal(match.status, sameLimit || splitLimit ? 'partial' : 'not_matched');
    if (!sameLimit && !splitLimit) continue;
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual([p.annualStem, p.horse, p.lumingChang], ['庚', '寅', '戌']);
    const horseLimit = p.limits.find(row => row.horseRelation === '守');
    assert.equal(horseLimit.lumingChangRelation, '三合');
    assert.deepEqual(horseLimit.horseCompanions.find(row => row.star === '流昌'), { star: '流昌', branch: '亥', relation: '其他' });
    const prompt = literaryPrompt(run);
    assert.match(prompt, /《紫微随笔》禄命法的流昌在戌宫，与限宫为三合/u);
    assert.doesNotMatch(prompt, /lumingChang|zhongyiming|expansion-p010|流昌在亥宫，与限宫为三合/u);
    const otherSource = structuredClone(run);
    literaryFact(otherSource, sample.year).normalizedPayload.lumingChangProfile = 'another-profile';
    assert.equal(result(otherSource, rule.knowledgeId).status, 'not_matched');
  }
});

test('product yearly Chang and Qu positions cover ten stems while distinct annual Lu branches retain their actual geometry', () => {
  const raw = astro.withOptions({ dateStr: '1947-02-05', timeIndex: 0, gender: '女', fixLeap: true, config }), natal = raw.toJSON();
  for (let year = 2024; year <= 2033; year++) {
    const flow = raw.horoscope(year + '-04-07', 6);
    const frame = { lunarYear: year, yearIndex: flow.yearly.index, decadalIndex: flow.decadal.index, minorIndex: flow.age.index };
    const transformed = quanshuTransformLimits(natal, frame);
    const palaces = natal.palaces.map(palace => ({ branch: palace.earthlyBranch,
      movingStarIds: (flow.yearly.stars?.[palace.index] ?? []).map(star => star.name) }));
    const value = quanshuLiteraryLimits(natal, transformed, palaces);
    const [seat] = value.limits;
    const order = '子丑寅卯辰巳午未申酉戌亥';
    const luCun = seat.annualLu.find(row => row.kind === '禄存');
    assert.ok(seat.moving.every(row => row.branch && order.indexOf(row.branch) % 2 !== order.indexOf(luCun.branch) % 2));
    if (year === 2027) {
      assert.equal(value.movingChangQuCandidate, true);
      assert.ok(value.limits.every(row => row.movingCandidate && row.sunRelation === '三合'));
      assert.deepEqual(seat.annualLu.map(row => [row.kind, row.star, row.branch, row.relation]), [['禄存', '禄存', '午', '其他'], ['化禄', '太阴', '丑', '三合']]);
      const withoutFlow = palaces.map(row => ({ ...row, movingStarIds: row.movingStarIds.map(star =>
        star === '流昌' ? '文昌' : star === '流曲' ? '文曲' : star) }));
      assert.equal(quanshuLiteraryLimits(natal, transformed, withoutFlow).movingChangQuCandidate, undefined);
      const duplicated = structuredClone(palaces); duplicated[0].movingStarIds.push('流昌');
      assert.equal(quanshuLiteraryLimits(natal, transformed, duplicated).movingChangQuCandidate, undefined);
    }
  }
});
