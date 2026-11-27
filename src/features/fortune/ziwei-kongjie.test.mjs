import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { quanshuKongJiePolicy, quanshuKongJiePositions, quanshuFourFlying, quanshuKongJieCondition } = await import('./control/ziwei-kongjie.ts');
const { quanshuKongJieLimits } = await import('./control/ziwei-kongjie-limits.ts');
const { quanshuHorseBranch } = await import('./control/ziwei-firebell.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitPhase, quanshuLunarMidnight, quanshuMinorLimit, quanshuPalaceRelation } = await import('./control/ziwei-quanshu.ts');
const { quanshuAuxiliaryPositions } = await import('./control/ziwei-source-support.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-kongjie-reference.json', import.meta.url)));
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const astrolabe = (example = reference.realExamples[0]) => astro.withOptions({ ...example, fixLeap: true, config });
const native = example => astrolabe(example).toJSON();
const stars = palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const place = (natal, name) => natal.palaces.find(p => stars(p).some(s => s.name === name));
const chart = (natal = native()) => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot = chart(), year = 2021) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const time = buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'kongjie-run', { snapshotId: 'kongjie-snapshot', chart: snapshot });
}
const rules = [66, 87, 88];
const result = (run, index) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId);
const specific = run => run.facts.filter(f => f.factType === 'quanshu_kongjie_condition');
const exact = run => run.facts.filter(f => f.factType === 'quanshu_kongjie_limits');
const cached = new Map();
const realRun = index => {
  if (!cached.has(index)) { const example = reference.realExamples[index]; cached.set(index, calculate(chart(native(example)), example.year)); }
  return cached.get(index);
};
function limitRun(name) {
  if (!cached.has(name)) {
    const example = reference.limitExamples[name];
    const run = calculate(chart(native(example)), example.year);
    run.facts = run.facts.filter(f => f.factType !== 'quanshu_kongjie_limits' || f.normalizedPayload.lunarYear === example.year);
    cached.set(name, run);
  }
  return cached.get(name);
}

function submittedLimitRun(dateStr, timeIndex, year, gender = '女', natal) {
  const key = natal === undefined ? JSON.stringify([dateStr, timeIndex, year, gender]) : undefined;
  if (key !== undefined && cached.has(key)) return structuredClone(cached.get(key));
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1);
  const archive = { snapshotId: 'kongjie-named-stars', chart: chart(natal ?? native({ dateStr, timeIndex, gender })) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'kongjie-named-stars', archive);
  validateFortuneFacts(run);
  const fact = exact(run).find(row => row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  const fixture = { fact, run: { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) } };
  if (key !== undefined) cached.set(key, structuredClone(fixture));
  return fixture;
}

test('independent source placement agrees at every birth hour, including both co-location cases and late Zi, without modifying the archive', () => {
  assert.equal(reference.profile, quanshuKongJiePolicy.profile);
  for (let hour = 0; hour <= 12; hour++) {
    const natal = native({ dateStr: '1990-05-05', timeIndex: hour, gender: '女' }), before = structuredClone(natal);
    const basis = quanshuKongJiePositions(natal), index = hour % 12;
    assert.equal(basis.ready, true); assert.equal(basis.birthHour, reference.hourBranches[index]);
    assert.equal(basis.skyBranch, reference.skyBranches[index]); assert.equal(basis.robberyBranch, reference.robberyBranches[index]);
    assert.equal(basis.skyBranch, place(natal, '地空').earthlyBranch); assert.equal(basis.robberyBranch, place(natal, '地劫').earthlyBranch);
    const skyIndex = reference.hourBranches.indexOf(basis.skyBranch);
    const changIndex = reference.hourBranches.indexOf(place(natal, '文昌').earthlyBranch);
    assert.equal((skyIndex - changIndex + 12) % 12, 1);
    const { named } = quanshuAuxiliaryPositions(4, basis.birthHour, '庚');
    for (const { star, branch } of named.filter(row => ['文昌', '文曲'].includes(row.star))) {
      assert.equal(place(natal, star).earthlyBranch, branch);
      assert.equal(quanshuPalaceRelation(basis.skyBranch, branch), '其他', basis.birthHour + star);
    }
    assert.equal(basis.skyRobberyTogether, [0, 6, 12].includes(hour));
    assert.deepEqual(natal, before);
  }
});

test('source four-flying coordinates retain their names and independently agree with a full twelve-year engine cycle', () => {
  for (const example of reference.fourFlyingExamples) assert.deepEqual(quanshuFourFlying(example.year), {
    lunarYear: example.year, yearBranch: example.yearBranch, placements: example.placements });
  const n = astrolabe(), natal = n.toJSON();
  for (let year = 2020; year < 2032; year++) {
    const h = n.horoscope(year + '-06-01', 6), positions = quanshuFourFlying(year);
    for (const s of positions.placements) {
      const palace = natal.palaces.find(p => p.earthlyBranch === s.branch);
      assert.equal(h.yearly.yearlyDecStar.suiqian12[palace.index], s.name === '官府' ? '官符' : s.name, year + ':' + s.name);
    }
    assert.ok(!positions.placements.some(s => s.name === '官符'));
  }
  for (const year of [NaN, 0, 1.5, 10000]) assert.throws(() => quanshuFourFlying(year));
});

test('modern same-name Sky, missing stars, duplicate locations and a shifted archive cannot substitute for source-hour identity', () => {
  for (const alter of [
    n => { place(n, '地空').minorStars = place(n, '地空').minorStars.filter(s => s.name !== '地空'); },
    n => { place(n, '地劫').minorStars.push({ name: '地劫' }); },
    n => { const p = place(n, '地空'), s = stars(p).find(s => s.name === '地空'); p.minorStars = p.minorStars.filter(s => s.name !== '地空'); place(n, '天空').minorStars.push(s); },
    n => { n.rawDates.lunarDate.isLeap = true; }, n => { n.rawDates.chineseDate.hourly[1] = '未知'; },
  ]) {
    const natal = native(); alter(natal);
    assert.equal(quanshuKongJiePositions(natal).ready, false);
    assert.equal(quanshuKongJieCondition(natal, 0, 2021).ready, false);
  }
  assert.equal(quanshuKongJieCondition(native(), 12, 2021).ready, false);
  assert.equal(quanshuKongJieCondition(native(), 0, NaN).ready, false);
});

test('real split void guards match and modern-Sky-only limits do not satisfy the source candidate', () => {
  const run = realRun(0); validateFortuneFacts(run);
  assert.equal(result(run, 66).matchedSourceExcerpt, '二限逢之');
  assert.equal(result(run, 87).status, 'partial');
  assert.equal(result(run, 88).status, 'partial');
  assert.ok(specific(run).some(f => f.scope === 'minor' && f.normalizedPayload.localSourceVoids.includes('天空') && f.normalizedPayload.annualAtPalace.includes('白虎')));
  const modernOnly = realRun(2);
  assert.ok(modernOnly.facts.some(f => f.factType === 'palace_condition' && f.scope === 'minor'
    && f.normalizedPayload.flowName === '命宫' && f.normalizedPayload.localStarNames.includes('天空')));
  for (const index of rules) assert.equal(result(modernOnly, index).status, 'not_matched');
  const both = realRun(3);
  assert.ok(specific(both).some(f => f.normalizedPayload.localSourceVoids.length === 2 && f.normalizedPayload.skyRobberyTogether));
  for (const index of rules) assert.notEqual(result(both, index).status, 'matched');
});

test('a stable decade crossing Lunar New Year receives two bound annual source segments, not the first year throughout', () => {
  const run = realRun(0), facts = specific(run).filter(f => f.scope === 'decadal');
  assert.equal(facts.length, 2); assert.ok(facts.every(f => f.completeness === 'complete'));
  assert.equal(facts[0].normalizedPayload.palaceIndex, facts[1].normalizedPayload.palaceIndex);
  assert.equal(facts[0].normalizedPayload.lunarYear, 2020); assert.equal(facts[1].normalizedPayload.lunarYear, 2021);
  assert.equal(facts[0].activeTo, '2021-02-11T16:00:00.000Z'); assert.equal(facts[1].activeFrom, facts[0].activeTo);
  assert.notDeepEqual(facts[0].normalizedPayload.placements, facts[1].normalizedPayload.placements);
  for (const f of facts) for (const id of f.sourceFactIds) assert.ok(run.rawFacts.some(raw => raw.rawFactId === id && raw.method === 'ziwei'));
  const all = specific(run);
  assert.ok(all.every(f => ['decadal', 'minor', 'yearly'].includes(f.scope)));
});

test('the source queries require a single annual fragment and ignore standalone void placement and monthly lookalikes', () => {
  const original = realRun(0);
  assert.ok(exact(original).length);
  assert.ok(exact(original).every(f => f.scope === 'yearly' && f.sourceFactIds.every(id => original.rawFacts.some(raw => raw.rawFactId === id))));
  const generic = { ...original, facts: original.facts.filter(f => f.factType !== 'quanshu_kongjie_limits') };
  assert.ok(specific(generic).length);
  for (const index of rules) assert.equal(result(generic, index).status, 'unknown');
  const monthly = structuredClone(original); exact(monthly).forEach(f => { f.scope = 'monthly'; });
  for (const index of rules) assert.notEqual(result(monthly, index).status, 'partial');
});

test('co-seated and split two-limit void conditions both reach SQLite, whereas a single guarding star does not', () => {
  for (const [name, expected, other, positions] of [
    ['sharedFourFlying', 'sharedPalace', 'splitLimits', ['亥', '亥']],
    ['splitWithoutSupport', 'splitLimits', 'sharedPalace', ['戌', '子']],
  ]) {
    const run = limitRun(name), fact = exact(run).find(f => f.normalizedPayload[expected] === true);
    assert.ok(fact);
    assert.equal(fact.normalizedPayload[other], false);
    assert.deepEqual([fact.normalizedPayload.skyBranch, fact.normalizedPayload.robberyBranch], positions);
    const match = result(run, 66);
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
  }
  const run = limitRun('robberyAlone');
  assert.ok(exact(run).some(f => f.normalizedPayload.robbery.minor === '守'));
  assert.equal(result(run, 66).status, 'not_matched');
});

test('annual Yang/Tuo, four-flying and natal Boshi offices hit separate robbery branches with independent locations', () => {
  const flags = ['robberyShaCandidate', 'robberyAnnualOfficialCandidate', 'robberyBoshiOfficialCandidate'];
  for (const [index, name, star, branch, relation] of [
    [0, 'annualShaOnly', '流年陀罗', '亥', '守'], [1, 'sharedFourFlying', '四飞官府', '卯', '三合'],
    [2, 'boshiOnly', '本命博士官府', '酉', '三合'],
  ]) {
    const run = limitRun(name), fact = exact(run).find(f => f.normalizedPayload[flags[index]] === true);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.deepEqual(flags.map(key => p[key]), flags.map((_, i) => i === index));
    assert.deepEqual([...p.annualShaPositions, p.annualOfficial, p.boshiOfficial].find(s => s.star === star), { star, branch, relation });
    const match = result(run, 87);
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
  }
  const standalone = limitRun('robberyAlone');
  assert.ok(exact(standalone).some(f => f.normalizedPayload.robbery.minor === '守'));
  assert.equal(result(standalone, 87).status, 'not_matched');
});

test('p017 can use one guarded void and an actual partner limit aspecting the other void, in either direction', () => {
  for (const [name, pairRelation, witness] of [
    ['aspectRobberyGuard', '三合', { guardStar: '地劫', guardBranch: '丑', guardScope: 'decadal',
      otherStar: '古天空', otherBranch: '酉', otherScope: 'minor', otherRelation: '冲' }],
    ['aspectSkyGuard', '冲', { guardStar: '古天空', guardBranch: '申', guardScope: 'minor',
      otherStar: '地劫', otherBranch: '寅', otherScope: 'decadal', otherRelation: '三合' }],
  ]) {
    const run = limitRun(name), fact = exact(run)[0], p = fact.normalizedPayload;
    assert.equal(p.pairedVoidsCandidate, false);
    assert.equal(p.voidPairRelation, pairRelation);
    assert.equal(p.voidAspectLimitsCandidate, true);
    assert.deepEqual(p.voidAspectWitnesses, [{ ...witness, candidate: true }]);
    const match = result(run, 66);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
  }

  const near = limitRun('aspectUnrelatedPartner'), p = exact(near)[0].normalizedPayload;
  assert.equal(p.voidPairRelation, '三合');
  assert.equal(p.sky.minor, '守');
  assert.equal(p.robbery.decadal, '其他');
  assert.equal(p.voidAspectLimitsCandidate, false);
  assert.equal(result(near, 66).status, 'not_matched');

  const archive = astrolabe(reference.limitExamples.aspectSkyGuard), year = archive.horoscope('2034-06-01', 6);
  const natal = archive.toJSON();
  const missing = quanshuKongJieLimits(natal, quanshuLimitBranches(natal,
    { lunarYear: 2034, yearIndex: year.yearly.index, minorIndex: year.age.index }));
  assert.equal(missing.voidAspectLimitsCandidate, undefined);

  const run = limitRun('aspectSkyGuard');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'paired-void-aspect'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /小限实守申宫的古天空，寅宫的地劫与该宫为冲，大限与地劫为三合/u);
  assert.doesNotMatch(prompt, /voidAspectWitnesses|voidAspectLimitsCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result(run, 66).knowledgeId));
});

test('Ming paired voids and four-flying Official confirm only two verified limits guarding the same palace', () => {
  const cases = [
    { timeIndex: 6, gender: '男', year: 2063, index: 66, branch: '巳', flag: 'voidsBothActualLimitsGuardCandidate',
      sourceText: /复算的大限和小限在同一农历年都实守该宫/u },
    { timeIndex: 2, gender: '女', year: 2017, index: 87, branch: '丑', flag: 'robberyFourFlyingOfficialDoubleGuardCandidate',
      sourceText: /由当年吊客的对宫定位流年官符/u },
  ];
  for (const { timeIndex, gender, year, index, branch, flag, sourceText } of cases) {
    const dateStr = '1990-05-05';
    const { run, fact } = submittedLimitRun(dateStr, timeIndex, year, gender);
    const data = fact.normalizedPayload;
    assert.equal(data.robberyBranch, branch);
    assert.deepEqual(data.robberyVerifiedLimitScopes, ['decadal', 'minor']);
    assert.equal(data[flag], true);
    if (index === 66) assert.deepEqual([data.skyBranch, data.sharedPalace], [branch, true]);
    else {
      assert.deepEqual(data.annualOfficial, { star: '四飞官府', branch, relation: '守' });
      assert.equal(data.boshiOfficial.relation, '三合');
    }
    const matched = result(run, index);
    assert.equal(matched.status, 'matched');
    assert.deepEqual(matched.sourceFactIds, [fact.factId]);
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

    const archive = astrolabe({ dateStr, timeIndex, gender }), natal = archive.toJSON();
    const frame = (y, minorIndex) => {
      const { yearly, decadal, age } = archive.horoscope(`${y}-06-01`, 6);
      return quanshuLimitBranches(natal, { lunarYear: y, yearIndex: yearly.index, decadalIndex: decadal.index,
        minorIndex: minorIndex ?? age.index });
    };
    const neighbor = quanshuKongJieLimits(natal, frame(year + 1));
    assert.equal(neighbor[flag], false);
    const wrongMinor = frame(year, archive.horoscope(`${year + 1}-06-01`, 6).age.index);
    assert.equal(wrongMinor.sourceMinor.verified, false);
    const unverified = quanshuKongJieLimits(natal, wrongMinor);
    assert.equal(unverified[flag], undefined);
    assert.deepEqual(unverified.robberyVerifiedLimitScopes, ['decadal']);
    const isolate = data => ({ ...run, facts: [{ ...fact, normalizedPayload: data }] });
    assert.notEqual(result(isolate(neighbor), index).status, 'matched');
    assert.equal(result(isolate(unverified), index).status, 'partial');

    const movedVoid = index === 66 ? '地空' : '地劫';
    const palace = place(natal, movedVoid);
    const [star] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === movedVoid), 1);
    palace.adjectiveStars.push(star);
    const wrongLayer = quanshuKongJieLimits(natal, frame(year));
    assert.equal(wrongLayer[flag], undefined);
    assert.notEqual(result(isolate(wrongLayer), index).status, 'matched');

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-void-double-guard'));
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === matched.knowledgeId);
    assert.ok(finding);
    if (index === 87) assert.equal(finding.originalText, '官符星遇有官符');
    const localText = index === 66 ? '古天空与地劫同在巳宫，复算大限、小限均实守'
      : '流年四飞官符与地劫同在丑宫，复算大限、小限均实守';
    assert.ok(formatFortuneFactAudit(input).includes(localText));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, sourceText);
    assert.ok(!prompt.includes(localText));
    assert.doesNotMatch(prompt, /voidsBothActualLimitsGuardCandidate|robberyFourFlyingOfficialDoubleGuardCandidate|太岁杀临多疾厄/u);
  }

  const ziweiAtMao = limitRun('threeLayersAtSky'), exception = exact(ziweiAtMao)[0].normalizedPayload;
  assert.equal(exception.sharedPalace, true);
  assert.deepEqual(exception.robberyVerifiedLimitScopes, ['decadal', 'minor']);
  assert.equal(exception.voidsBothActualLimitsGuardCandidate, false);
  assert.equal(result(ziweiAtMao, 66).status, 'partial');
});

test('p017 keeps four Ming sha contacts at the actual guarded void palace and distinct from the archive', () => {
  const { fact, run } = submittedLimitRun('1974-02-05', 4, 2011);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.decadalBranch, data.minorBranch], ['卯', '未', '卯']);
  assert.equal(data.voidMingFixedFourShaCandidate, true);
  assert.deepEqual(data.voidMingFixedFourShaWitnesses, [{ voidStar: '古天空', branch: '未', scopes: ['decadal'],
    related: [{ star: '擎羊', branch: '卯', relation: '三合' }, { star: '陀罗', branch: '丑', relation: '冲' },
      { star: '火星', branch: '丑', relation: '冲' }, { star: '铃星', branch: '卯', relation: '三合' }], candidate: true }]);
  assert.equal(data.pairedSha.find(row => row.star === '归档火星').skyRelation, '其他');
  assert.equal(data.pairedSha.find(row => row.star === '归档铃星').skyRelation, '守');
  const onlyMingBranch = structuredClone(run);
  const isolated = exact(onlyMingBranch)[0].normalizedPayload;
  isolated.pairedVoidsCandidate = false;
  isolated.voidAspectLimitsCandidate = false;
  isolated.voidsSeparateActualLimitsGuardCandidate = false;
  const matched = result(onlyMingBranch, 66);
  assert.equal(matched.status, 'partial');
  assert.deepEqual(matched.sourceFactIds, [fact.factId]);
  const wrongProfile = { ...onlyMingBranch, facts: [{ ...fact, normalizedPayload: { ...isolated, quanshuFixedFireBellProfile: 'archive-position' } }] };
  assert.equal(result(wrongProfile, 66).status, 'not_matched');

  const next = submittedLimitRun('1974-02-05', 4, 2012);
  assert.equal(next.fact.normalizedPayload.voidMingFixedFourShaCandidate, false);
  assert.equal(result(next.run, 66).status, 'not_matched');
  const { input } = buildFortuneModelContext(onlyMingBranch,
    interpretFortune(onlyMingBranch, requestForFortuneRun(onlyMingBranch), 'ming-void-four-sha'));
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === matched.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /明刊四煞同核实际限宫未宫的古天空/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊四煞同核实际限宫|voidMingFixedFourSha/u);
});

test('p017 binds the Jielan four Sha to one actual guarded void palace', () => {
  const { fact, run } = submittedLimitRun('1990-05-05', 8, 2015);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.decadalBranch, data.minorBranch], ['未', '卯']);
  assert.deepEqual([data.pairedVoidsCandidate, data.voidMingFixedFourShaCandidate, data.voidJielanFourShaCandidate], [true, false, true]);
  assert.deepEqual(data.voidJielanFourShaWitnesses, [{ voidStar: '古天空', branch: '卯', scopes: ['minor'],
    related: [{ star: '擎羊', branch: '酉', relation: '冲' }, { star: '陀罗', branch: '未', relation: '三合' },
      { star: '火星', branch: '酉', relation: '冲' }, { star: '铃星', branch: '亥', relation: '三合' }], candidate: true }]);
  const onlyJielan = { ...data, pairedVoidsCandidate: false, voidAspectLimitsCandidate: false,
    voidsSeparateActualLimitsGuardCandidate: false };
  const isolated = { ...run, facts: [{ ...fact, normalizedPayload: onlyJielan }] };
  const matched = result(isolated, 66);
  assert.equal(matched.status, 'partial');
  assert.deepEqual(matched.sourceFactIds, [fact.factId]);
  assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const wrong = { ...fact, normalizedPayload: { ...onlyJielan, jielanFireBellProfile: 'ming-fixed' } };
  assert.equal(result({ ...isolated, facts: [wrong] }, 66).status, 'not_matched');
  const near = submittedLimitRun('1990-05-05', 8, 2016);
  assert.equal(near.fact.normalizedPayload.voidJielanFourShaCandidate, false);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'jielan-void-four-sha'));
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === matched.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /按《捷览》生时定位的火铃与本命羊陀共同会照实际限宫卯宫的古天空/u);
  assert.doesNotMatch(formatFortunePrompt(input), /按《捷览》生时定位的火铃|voidJielanFourShaWitnesses/u);
  const source = astrolabe({ dateStr: '1990-05-05', timeIndex: 8, gender: '女' });
  const natal = source.toJSON(), { yearly, decadal } = source.horoscope('2015-06-01');
  const missingMinor = quanshuLimitBranches(natal, { lunarYear: 2015, yearIndex: yearly.index, decadalIndex: decadal.index });
  const unresolved = quanshuKongJieLimits(natal, missingMinor);
  assert.equal(unresolved.ready, true);
  assert.equal(unresolved.voidJielanFourShaCandidate, undefined);
});

test('p038 can verify natal Tuo at Tai Sui opposing the real robbery limit independently of Boshi archive metadata', () => {
  const sample = reference.limitExamples.boshiOnly, natal = native(sample);
  delete natal.palaces.find(row => row.boshi12 === '官府').boshi12;
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
  const asOf = Date.parse('2015-11-19T03:00:00Z');
  const archive = { snapshotId: 'kongjie-missing-boshi', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'robbery-tai-sui-client', archive);
  const fact = exact(run).find(row => row.normalizedPayload.lunarYear === sample.year), p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.robberyBranch, p.robbery.annual, p.robbery.decadal], ['未', '丑', '冲', '守']);
  assert.deepEqual(p.taiSuiNamedSha, ['本命陀罗']);
  assert.equal(p.robberyShaCandidate, false);
  assert.equal(p.robberyAnnualOfficialCandidate, false);
  assert.equal(p.robberyBoshiOfficialCandidate, undefined);
  assert.equal(p.robberyMingBoshiOfficialGuardCandidate, undefined);
  assert.equal(p.robberyTaiSuiShaCandidate, true);
  const isolated = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const match = result(isolated, 87);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const { input: context } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'robbery-tai-sui'));
  const prompt = formatFortuneFactAudit(context);
  assert.match(prompt, /太岁宫在未，实守有本命陀罗，与实际地劫限宫为冲/u);
  assert.doesNotMatch(prompt, /robberyTaiSuiShaCandidate|taiSuiNamedSha/u);

  const near = limitRun('taiSuiOpposesWithoutNamedSha'), missing = exact(near)[0].normalizedPayload;
  assert.equal(missing.robbery.annual, '冲');
  assert.equal(missing.robbery.minor, '守');
  assert.deepEqual(missing.taiSuiNamedSha, []);
  assert.equal(missing.robberyTaiSuiShaCandidate, false);
  assert.equal(missing.robberyTaiSuiFireBellEnvoyCandidate, false);
  assert.equal(missing.robberyTaiSuiSkyCandidate, true);
  assert.equal(result(near, 87).status, 'partial');
});

test('p038 Ming Boshi official guards the real robbery limit separately from the four-flying office', () => {
  const { run, fact } = submittedLimitRun('1974-02-05', 2, 1983, '男');
  const p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.decadalBranch, p.minorBranch, p.robberyBranch], ['亥', '子', '丑', '丑']);
  assert.deepEqual(p.boshiOfficial, { star: '本命博士官府', branch: '丑', relation: '守' });
  assert.deepEqual(p.annualOfficial, { star: '四飞官府', branch: '卯', relation: '其他' });
  assert.equal(p.robberyMingBoshiOfficialGuardCandidate, true);
  assert.deepEqual(p.robberyMingBoshiOfficialScopes, ['minor']);

  const near = submittedLimitRun('1974-02-05', 6, 1987, '男').fact.normalizedPayload;
  assert.equal(near.boshiOfficial.relation, '三合');
  assert.equal(near.robberyBoshiOfficialCandidate, true);
  assert.equal(near.robberyMingBoshiOfficialGuardCandidate, false);
  assert.deepEqual(near.robberyMingBoshiOfficialScopes, []);

  const isolated = structuredClone(run), source = exact(isolated)[0].normalizedPayload;
  for (const key of ['robberyShaCandidate', 'robberyAnnualOfficialCandidate', 'robberyBoshiOfficialCandidate',
    'robberyTaiSuiShaCandidate', 'robberyTaiSuiFireBellEnvoyCandidate', 'robberyTaiSuiQuanshuFixedFireBellCandidate']) {
    source[key] = false;
  }
  const hit = result(isolated, 87);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'ming-boshi-official'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /明刊候选核到本命博士官府与地劫同守丑宫/u);
  assert.match(audit, /四飞官符的位置另查/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊候选核到本命博士官府|robberyMingBoshiOfficial/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  source.mingBoshiOfficialProfile = 'unverified';
  assert.equal(result(isolated, 87).status, 'not_matched');
});

test('p038 uses the same verified robbery limit for the annual Sha and both official branches', () => {
  const [dateStr, timeIndex, gender] = ['1974-02-05', 2, '男'];
  const source = astrolabe({ dateStr, timeIndex, gender }), natal = source.toJSON();
  const { run, fact } = submittedLimitRun(dateStr, timeIndex, 1983, gender);
  const flags = ['robberyShaCandidate', 'robberyBoshiOfficialCandidate', 'robberyMingBoshiOfficialGuardCandidate'];
  assert.deepEqual(fact.normalizedPayload.robberyVerifiedLimitScopes, ['minor']);
  assert.ok(flags.every(flag => fact.normalizedPayload[flag] === true));
  assert.equal(result(run, 87).status, 'partial');

  const near = submittedLimitRun(dateStr, timeIndex, 1984, gender);
  assert.equal(result(near.run, 87).status, 'not_matched');
  assert.deepEqual(near.fact.normalizedPayload.robberyVerifiedLimitScopes, []);
  const next = source.horoscope('1984-06-01', 6), previous = source.horoscope('1983-06-01', 6);
  const frame = { lunarYear: 1984, yearIndex: next.yearly.index, decadalIndex: next.decadal.index, minorIndex: previous.age.index };
  const limits = quanshuLimitBranches(natal, frame), displaced = quanshuKongJieLimits(natal, limits);
  assert.equal(limits.sourceMinor.verified, false);
  assert.equal(displaced.robbery.minor, '守');
  assert.equal(displaced.robberyBoshiOfficialCandidate, undefined);
  assert.equal(displaced.robberyMingBoshiOfficialGuardCandidate, undefined);
  assert.deepEqual(displaced.robberyVerifiedLimitScopes, []);
  assert.equal(result({ ...near.run, facts: [{ ...near.fact, normalizedPayload: displaced }] }, 87).status, 'unknown');

  const guard = submittedLimitRun('1970-01-02', 1, 1990);
  assert.deepEqual(guard.fact.normalizedPayload.robberyVerifiedLimitScopes, ['decadal']);
  const senior = astrolabe({ dateStr: '1970-01-02', timeIndex: 1, gender: '女' });
  const h = senior.horoscope('1990-06-01', 6), archived = senior.toJSON();
  const withoutMinor = quanshuKongJieLimits(archived, quanshuLimitBranches(archived, {
    lunarYear: 1990, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
  }));
  assert.equal(withoutMinor.robberyTaiSuiFireBellEnvoyCandidate, true);
  assert.deepEqual(withoutMinor.robberyVerifiedLimitScopes, ['decadal']);
  assert.equal(result({ ...guard.run, facts: [{ ...guard.fact, normalizedPayload: withoutMinor }] }, 87).status, 'partial');
});

test('p038 matches a verified envoy guarding Tai Sui and opposing the actual robbery limit', () => {
  const { run, fact } = submittedLimitRun('1970-01-02', 1, 1990), p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.robberyBranch, p.robbery.annual, p.robbery.decadal], ['午', '子', '冲', '守']);
  assert.deepEqual(p.taiSuiFireBellEnvoy, ['本命天使']);
  assert.equal(p.robberyTaiSuiFireBellEnvoyCandidate, true);
  for (const key of ['robberyTaiSuiShaCandidate', 'robberyShaCandidate', 'robberyAnnualOfficialCandidate', 'robberyBoshiOfficialCandidate']) {
    assert.equal(p[key], false);
  }
  assert.equal(fact.activeFrom, '1990-01-26T16:00:00.000Z');
  const match = result(run, 87);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tai-sui-envoy'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /太岁宫在午，实守有本命天使，与实际地劫限宫为冲/u);
  assert.doesNotMatch(prompt, /robberyTaiSuiFireBellEnvoyCandidate|taiSuiFireBellEnvoy/u);
});

test('native principal and distinct support qualify the Sky branch only with annual and active limit contacts', () => {
  const run = limitRun('threeLayersAtSky');
  const fact = exact(run).find(f => f.normalizedPayload.skyAllThreeAtSeat === true);
  assert.ok(fact);
  const { knownLocalPrincipals, independentSupport, skySupportCandidate } = fact.normalizedPayload;
  assert.deepEqual(knownLocalPrincipals, ['武曲', '破军']);
  assert.ok(independentSupport.some(row => row.star === '魁钺组' && row.branch === '未' && row.relation === '三合'));
  assert.equal(skySupportCandidate, true);
  const match = result(run, 88);
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.includes(fact.factId));
  const archive = astrolabe(reference.limitExamples.threeLayersAtSky), natal = archive.toJSON();
  const year = fact.normalizedPayload.lunarYear, f = archive.horoscope(`${year}-06-01`, 6);
  const helper = place(natal, '天钺');
  assert.equal(helper.earthlyBranch, '未');
  helper.adjectiveStars.push(helper.minorStars.splice(helper.minorStars.findIndex(row => row.name === '天钺'), 1)[0]);
  const badHelper = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, {
    lunarYear: year, yearIndex: f.yearly.index, decadalIndex: f.decadal.index, minorIndex: f.age.index,
  }));
  assert.equal(badHelper.skyAllThreeAtSeat, true);
  assert.deepEqual(badHelper.knownLocalPrincipals, ['武曲', '破军']);
  assert.equal(badHelper.skySupportCandidate, undefined);
  assert.equal(badHelper.skyLuSupportCandidate, true);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: badHelper }] }, 88).status, 'partial');
  const annualOnly = limitRun('annualSkyOnly');
  assert.ok(exact(annualOnly).some(f => f.normalizedPayload.sky.annual === '守' && f.normalizedPayload.sky.minor !== '守'));
  assert.equal(result(annualOnly, 88).status, 'not_matched');
  const withoutNamedHelpers = limitRun('splitWithoutSupport'), p = exact(withoutNamedHelpers)[0].normalizedPayload;
  assert.equal(p.sky.annual, '守');
  assert.equal(p.sky.decadal, '守');
  assert.ok(p.knownLocalPrincipals.includes('天同'));
  assert.equal(p.skySupportCandidate, false);
  assert.equal(p.skyPartnerSupportCandidate, false);
  assert.equal(p.skyLuSupportCandidate, true);
  assert.ok(p.lucunSupport.some(row => row.star === '流年禄存' && row.branch === '寅' && row.relation === '三合'));
  assert.equal(result(withoutNamedHelpers, 88).status, 'partial');
});

test('p038 confirms Tai Sui with the source natal Sky or blade while two real limits guard Robbery', () => {
  const cases = [
    { dateStr: '1972-02-15', timeIndex: 6, year: 2013, start: '2013-02-09T16:00:00.000Z',
      robbery: '巳', annual: '巳', relation: '守', sha: '古天空', reuse: true },
    { dateStr: '1972-02-15', timeIndex: 9, year: 2070, start: '2070-02-10T16:00:00.000Z',
      robbery: '申', annual: '寅', relation: '冲', sha: '古天空' },
    { dateStr: '1988-04-01', timeIndex: 11, year: 2060, start: '2060-02-01T16:00:00.000Z',
      robbery: '戌', annual: '辰', relation: '冲', sha: '陀罗' },
  ];
  const field = 'robberyMingTaiSuiNatalShaDoubleGuardCandidate';
  for (const { dateStr, timeIndex, year, start, robbery, annual, relation, sha, reuse } of cases) {
    const archive = astrolabe({ dateStr, timeIndex, gender: '女' }), natal = archive.toJSON();
    const { run, fact } = submittedLimitRun(dateStr, timeIndex, year);
    const data = fact.normalizedPayload;
    assert.deepEqual(data.robberyVerifiedLimitScopes, ['decadal', 'minor']);
    assert.deepEqual([data.robberyMingTaiSuiFixedFireBellDoubleGuardCandidate, data.robberyFourFlyingOfficialDoubleGuardCandidate],
      [false, false]);
    assert.equal(data[field], true);
    assert.deepEqual(data.robberyMingTaiSuiNatalShaDoubleGuardWitness, {
      robberyBranch: robbery, annualBranch: annual, annualRelation: relation, guards: [{ star: sha, branch: annual }],
    });
    const isolate = normalizedPayload => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
    const scoped = isolate(data), hit = result(scoped, 87);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '太岁杀临');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    if (reuse) {
      for (const index of [66, 88]) assert.equal(result(scoped, index).status, 'matched');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'robbery-tai-sui-natal-sha'));
    assert.match(formatFortunePrompt(input), /太岁杀临/u);
    assert.doesNotMatch(formatFortunePrompt(input), /robberyMingTaiSuiNatalShaDoubleGuard|[巳申寅戌辰]宫/u);

    const evaluate = (archive, lunarYear, revise = frame => frame) => {
      const h = astrolabe({ dateStr, timeIndex, gender: '女' }).horoscope(lunarYear + '-06-01', 6);
      const frame = revise({ lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index });
      return quanshuKongJieLimits(archive, quanshuLimitBranches(archive, frame));
    };
    const corrupted = structuredClone(natal), name = sha === '古天空' ? '地空' : sha, seat = place(corrupted, name);
    const [star] = seat.minorStars.splice(seat.minorStars.findIndex(row => row.name === name), 1);
    seat.adjectiveStars.push(star);
    const wrongLayer = evaluate(corrupted, year);
    const wrongMinor = evaluate(natal, year, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
    for (const wrong of [wrongLayer, wrongMinor]) {
      assert.equal(wrong[field], undefined);
      assert.equal(wrong.robberyMingTaiSuiNatalShaDoubleGuardWitness, undefined);
      assert.notEqual(result(isolate(wrong), 87).status, 'matched');
    }
    assert.equal(evaluate(natal, year + 1)[field], false);
  }
});

test('one actual year verifies Sky at Tai Sui opposing the guarded Robbery and keeps the two source placements independent', () => {
  const dateStr = '1990-05-05', timeIndex = 3, gender = '女', year = 2004;
  const archive = astrolabe({ dateStr, timeIndex, gender }), natal = archive.toJSON();
  const { run, fact } = submittedLimitRun(dateStr, timeIndex, year, gender);
  const opposing = run.facts.find(row => row.factType === 'quanshu_limit_branches' && row.normalizedPayload.lunarYear === year);
  const p = fact.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.skyBranch, p.robberyBranch, p.robbery.annual], ['申', '申', '寅', '冲']);
  assert.deepEqual(p.robberyVerifiedLimitScopes, ['minor']);
  const previousRoutes = ['robberyShaCandidate', 'robberyTaiSuiShaCandidate', 'robberyTaiSuiFireBellEnvoyCandidate',
    'robberyAnnualOfficialCandidate', 'robberyBoshiOfficialCandidate', 'robberyTaiSuiQuanshuFixedFireBellCandidate',
    'robberyMingBoshiOfficialGuardCandidate'];
  assert.deepEqual(previousRoutes.map(key => p[key]), previousRoutes.map(() => false));
  assert.equal(p.robberyTaiSuiSkyCandidate, true);
  const hit = result({ ...run, facts: [fact] }, 87);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tai-sui-sky-audit'));
  const detail = '古天空实守申宫太岁，太岁正冲地劫所在的寅宫';
  assert.ok(formatFortuneFactAudit(input).includes(detail));
  assert.ok(!formatFortunePrompt(input).includes(detail));
  const p043 = fortuneKnowledge.ziwei.rules.findIndex(rule => rule.knowledgeId.endsWith('expansion-p043-001'));
  const peerRoutes = Object.fromEntries(['annualDoubleVerifiedOppositionCandidate', 'annualReliefCandidate', 'annualAdverseCandidate',
    'annualSeatedReliefCandidate', 'annualCrossGroupReliefCandidate', 'annualSeatedAdverseCandidate', 'annualTrineAdverseCandidate',
    'annualOpposedQishaCandidate', 'annualOpposedDecadalFullReliefCandidate', 'annualMingFixedOppositionShaCandidate'].map(key => [key, false]));
  const evaluateOpposing = normalizedPayload => result({ ...run, facts: [{ ...opposing, normalizedPayload: {
    ...normalizedPayload, ...peerRoutes,
  } }] }, p043);
  assert.deepEqual(opposing.normalizedPayload.annualAdverseGuards, ['古天空']);
  assert.equal(evaluateOpposing(opposing.normalizedPayload).status, 'partial');

  const frameFor = lunarYear => {
    const h = archive.horoscope(lunarYear + '-06-01', 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  };
  const frame = frameFor(year);
  for (const star of ['地空', '地劫']) {
    const changed = structuredClone(natal), palace = place(changed, star);
    const [archiveStar] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === star), 1);
    palace.adjectiveStars.push(archiveStar);
    const limits = quanshuLimitBranches(changed, frame);
    const outcomes = quanshuKongJieLimits(changed, limits);
    assert.equal(outcomes.robberyTaiSuiSkyCandidate, undefined);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: outcomes }] }, 87).status, 'unknown');
    const knownSky = star === '地劫';
    assert.equal(outcomes.pairedVoidsCandidate, knownSky ? false : undefined);
    assert.deepEqual(limits.annualAdverseGuards, knownSky ? ['古天空'] : []);
    assert.equal(limits.annualOpposedGuardCandidate, knownSky ? true : undefined);
    assert.equal(limits.adverse.find(row => row.name === '古空劫').minorPair, undefined);
    assert.equal(evaluateOpposing(limits).status, knownSky ? 'partial' : 'unknown');
  }
  const neighbor = frameFor(year - 1);
  const preceding = run.facts.find(row => row.factType === opposing.factType && row.normalizedPayload.lunarYear === year - 1);
  const nearby = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, neighbor));
  assert.equal(nearby.robberyTaiSuiSkyCandidate, false);
  assert.equal(result({ ...run, facts: [{
    ...fact, activeFrom: preceding.activeFrom, activeTo: preceding.activeTo, normalizedPayload: nearby,
  }] }, 87).status, 'not_matched');
});

test('the two void passages reject an otherwise coherent major sequence from a different birth date', () => {
  const dateStr = '1972-02-15', timeIndex = 6, year = 2013, gender = '女';
  const { run, fact } = submittedLimitRun(dateStr, timeIndex, year, gender);
  const facts = [fact], data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.skyBranch, data.robberyBranch], ['巳', '巳', '巳']);
  assert.deepEqual(data.skySupportLimits, { decadal: '守', minor: '守' });
  assert.equal(data.voidsBothActualLimitsGuardCandidate, true);
  assert.deepEqual(data.skyCoSeatedNobleWitness, { branch: '巳', principals: ['天机'], noble: '魁钺组' });
  assert.equal(data.skyCoSeatedMingAuxiliaryNobleCandidate, false);
  for (const index of [66, 88]) {
    const found = result({ ...run, facts }, index);
    assert.equal(found.status, 'matched');
    assert.deepEqual(found.sourceFactIds, [fact.factId]);
    assert.deepEqual(found.windows, [{ start: '2013-02-09T16:00:00.000Z', endExclusive: fact.activeTo }]);
  }

  const source = astrolabe({ dateStr, timeIndex, gender }), natal = source.toJSON();
  const changed = native({ dateStr: '1972-02-16', timeIndex, gender });
  assert.equal(changed.rawDates.lunarDate.lunarMonth, natal.rawDates.lunarDate.lunarMonth);
  assert.deepEqual([place(natal, '紫微').earthlyBranch, place(changed, '紫微').earthlyBranch], ['午', '亥']);
  for (const palace of changed.palaces) palace.majorStars = natal.palaces.find(row => row.index === palace.index).majorStars;
  const actual = source.horoscope(`${year}-06-01`, 6);
  const frame = { lunarYear: year, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: actual.age.index };
  const unverified = quanshuKongJieLimits(changed, quanshuLimitBranches(changed, frame));
  assert.equal(unverified.skyAllThreeAtSeat, true);
  assert.equal(unverified.sharedPalace, true);
  assert.equal(unverified.voidsBothActualLimitsGuardCandidate, undefined);
  assert.equal(unverified.skyCoSeatedNobleCandidate, undefined);
  assert.equal(unverified.skyCoSeatedNobleWitness, undefined);
  const wrongFacts = [{ ...fact, normalizedPayload: unverified }];
  assert.equal(result({ ...run, facts: wrongFacts }, 66).status, 'partial');
  assert.equal(result({ ...run, facts: wrongFacts }, 88).status, 'unknown');
});

test('the source horse cannot share the same annual and minor palace in the three-layer Sky clause', () => {
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  for (const [birth, branch] of [...branches].entries()) {
    const horse = quanshuHorseBranch(branch);
    const ordinal = (branches.indexOf(horse) - birth + 12) % 12 + 1;
    for (const gender of ['男', '女']) {
      assert.notEqual(quanshuMinorLimit(branch, gender, ordinal).branch, horse);
    }
  }
});

test('p017/p038 verify separate void limits and Ming Fire/Bell at the triple Robbery guard', () => {
  const cases = [
    { args: ['1987-06-05', 3, 2046], index: 66, excerpt: '二限逢之',
      flag: 'voidsSeparateActualLimitsGuardCandidate', positions: ['申', '寅', '寅', '申', '寅'] },
    { args: ['1968-12-04', 3, 1976], index: 66, excerpt: '二限逢之',
      flag: 'voidsSeparateActualLimitsGuardCandidate', positions: ['申', '寅', '辰', '申', '寅'] },
    { args: ['1970-07-15', 2, 2021], index: 87, excerpt: '太岁杀临',
      flag: 'robberyMingTaiSuiFixedFireBellDoubleGuardCandidate', positions: ['酉', '丑', '丑', '丑', '丑'], named: '火星' },
    { args: ['1961-07-15', 11, 1994], index: 87, excerpt: '太岁杀临',
      flag: 'robberyMingTaiSuiFixedFireBellDoubleGuardCandidate', positions: ['子', '戌', '戌', '戌', '戌'], named: '铃星' },
  ];
  for (const { args, index, excerpt, flag, positions, named } of cases) {
    const { run, fact } = submittedLimitRun(...args);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.skyBranch, data.robberyBranch, data.annualBranch, data.decadalBranch, data.minorBranch],
      positions, args.join('/'));
    assert.equal(data[flag], true);
    assert.notEqual(data.voidsBothActualLimitsGuardCandidate, true);
    assert.notEqual(data.robberyFourFlyingOfficialDoubleGuardCandidate, true);
    if (named) assert.deepEqual(data.taiSuiQuanshuFixedFireBell, [{ star: named, branch: data.annualBranch }]);
    const selected = { ...run, facts: [fact] };
    const match = result(selected, index);
    assert.equal(match.status, 'matched');
    assert.equal(match.matchedSourceExcerpt, excerpt);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'guarded-voids'));
    assert.ok(formatFortunePrompt(input).includes(excerpt));
    assert.doesNotMatch(formatFortunePrompt(input), /申宫|寅宫|丑宫|戌宫|voidsSeparateActualLimits|robberyMingTaiSui/u);
  }
  const nearby = submittedLimitRun('1987-06-05', 3, 2045).fact.normalizedPayload;
  assert.equal(nearby.voidsSeparateActualLimitsGuardCandidate, false);
  const otherLimit = submittedLimitRun('1970-02-28', 2, 2021).fact.normalizedPayload;
  assert.deepEqual(otherLimit.taiSuiQuanshuFixedFireBell, [{ star: '火星', branch: '丑' }]);
  assert.equal(otherLimit.robberyMingTaiSuiFixedFireBellDoubleGuardCandidate, false);
});

test('p017 isolates the Ming Ziwei Mao or You exception when the two verified limits guard separate trined voids', () => {
  const cases = [
    { dateStr: '1972-02-15', otherBirthday: '1972-02-16', timeIndex: 10, gender: '女', year: 2009,
      ziweiBranch: '酉', skyBranch: '丑', robberyBranch: '酉', decadalBranch: '丑', minorBranch: '酉', start: '2009-01-25T16:00:00.000Z' },
    { dateStr: '1974-02-05', otherBirthday: '1974-02-06', timeIndex: 8, gender: '男', year: 1997,
      ziweiBranch: '卯', skyBranch: '卯', robberyBranch: '未', decadalBranch: '未', minorBranch: '卯', start: '1997-02-06T16:00:00.000Z' },
  ];
  const field = 'voidsZiweiMaoYouSplitTrineCandidate';
  for (const { dateStr, otherBirthday, timeIndex, gender, year, start, ...witness } of cases) {
    const birth = { dateStr, timeIndex, gender };
    const archive = astrolabe(birth), natal = archive.toJSON();
    const { run, fact } = submittedLimitRun(dateStr, timeIndex, year, gender);
    const data = fact.normalizedPayload;
    assert.equal(data[field], true);
    assert.equal(data.skySupportBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
    assert.deepEqual(data.voidsZiweiMaoYouSplitTrineWitness, witness);
    assert.equal(data.voidPairRelation, '三合');
    assert.deepEqual([data.pairedVoidsCandidate, data.voidsBothActualLimitsGuardCandidate, data.voidsSeparateActualLimitsGuardCandidate],
      [true, false, false]);
    const scoped = { ...run, facts: [fact] }, hit = result(scoped, 66);
    assert.equal(hit.status, 'matched');
    assert.match(hit.matchedSourceExcerpt, /[極极]居卯酉[刼劫]空[臨临]/u);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ziwei-maoyou-pair'));
    const sameSeatVoid = witness.ziweiBranch === witness.skyBranch ? '古天空' : '地劫';
    assert.ok(formatFortuneFactAudit(input).includes(`复算紫微在${witness.ziweiBranch}宫，与${sameSeatVoid}同守`));
    assert.match(formatFortunePrompt(input), /[極极]居卯酉[刼劫]空[臨临]/u);
    assert.doesNotMatch(formatFortunePrompt(input), /voidsZiweiMaoYouSplitTrine|[卯酉丑未]宫[古地]/u);

    const evaluate = (chart, lunarYear, amend = frame => frame) => {
      const h = archive.horoscope(lunarYear + '-06-01', 6);
      const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      return quanshuKongJieLimits(chart, quanshuLimitBranches(chart, amend(frame)));
    };
    const wrongLayer = structuredClone(natal), sky = place(wrongLayer, '地空');
    const [voidStar] = sky.minorStars.splice(sky.minorStars.findIndex(row => row.name === '地空'), 1);
    sky.adjectiveStars.push(voidStar);
    const borrowed = native({ ...birth, dateStr: otherBirthday });
    borrowed.palaces = structuredClone(natal.palaces);
    const wrongMinor = evaluate(natal, year, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
    for (const normalizedPayload of [wrongMinor, evaluate(wrongLayer, year), evaluate(borrowed, year)]) {
      assert.equal(normalizedPayload[field], undefined);
      assert.equal(normalizedPayload.voidsZiweiMaoYouSplitTrineWitness, undefined);
      assert.notEqual(result({ ...scoped, facts: [{ ...fact, normalizedPayload }] }, 66).status, 'matched');
    }
    assert.equal(evaluate(natal, year + 1)[field], false);
  }
});

test('p039 binds co-seated assistants and primary stars to the verified three-layer Sky window', () => {
  const { run, fact } = submittedLimitRun('1987-06-05', 3, 2040);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.decadalBranch, data.minorBranch], ['申', '申', '申']);
  assert.equal(data.skyCoSeatedAssistantCandidate, true);
  assert.deepEqual(data.skyCoSeatedAssistantWitness, { branch: '申', principals: ['破军'], assistants: ['左辅'] });
  assert.notEqual(data.skyCoSeatedNobleCandidate, true);
  assert.deepEqual([data.skySupportCandidate, data.skyLuSupportCandidate, data.skyPartnerSupportCandidate,
    data.skyPartnerLuSupportCandidate], [undefined, false, false, false]);
  const verdict = result(run, 88);
  assert.equal(verdict.status, 'matched');
  assert.equal(verdict.matchedSourceExcerpt, '太岁二限遇逢，有正曜星加吉');
  assert.deepEqual(verdict.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const next = submittedLimitRun('1987-06-05', 3, 2041);
  assert.equal(next.fact.normalizedPayload.skyCoSeatedAssistantCandidate, false);
  assert.equal(next.fact.normalizedPayload.skyCoSeatedAssistantWitness, undefined);
  assert.equal(result(next.run, 88).status, 'not_matched');
  const source = astrolabe({ dateStr: '1987-06-05', timeIndex: 3, gender: '女' });
  const natal = source.toJSON(), { yearly, decadal } = source.horoscope('2040-06-01');
  const unknown = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, { lunarYear: 2040,
    yearIndex: yearly.index, decadalIndex: decadal.index }));
  assert.equal(unknown.ready, true);
  assert.equal(unknown.skyCoSeatedAssistantCandidate, undefined);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sky-verified-assistant'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === verdict.knowledgeId));
  assert.match(formatFortunePrompt(input), /太岁二限遇逢，有正曜星加吉/u);
  assert.match(formatFortuneFactAudit(input), /左辅与正曜破军实守古天空所在的申宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /实守古天空所在的申宫|skyCoSeatedAssistantWitness/u);
});

test('p039 verifies same-source named aid when Tai Sui opposes both actual Sky limits', () => {
  const dateStr = '1961-07-15', gender = '男', field = 'skyOpposedDoubleLimitNamedSupportCandidate';
  for (const { timeIndex, year, branch, annualBranch, principals, support } of [
    { timeIndex: 2, year: 2047, branch: '酉', annualBranch: '卯', principals: ['天同'], support: ['左辅'] },
    { timeIndex: 5, year: 2044, branch: '午', annualBranch: '子', principals: ['廉贞', '天相'], support: ['魁钺组'] },
  ]) {
    const { run, fact } = submittedLimitRun(dateStr, timeIndex, year, gender);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.skyBranch, data.decadalBranch, data.minorBranch, data.annualBranch], [branch, branch, branch, annualBranch]);
    assert.deepEqual(data.skySupportLimits, { decadal: '守', minor: '守' });
    assert.equal(data.sky.annual, '冲');
    assert.equal(data.skySupportBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
    assert.equal(data[field], true);
    assert.deepEqual(data.skyOpposedDoubleLimitNamedSupportWitness, { branch, annualBranch, principals, support });
    assert.deepEqual([data.skyCoSeatedNobleCandidate, data.skyCoSeatedAssistantCandidate,
      data.skyCoSeatedMingAuxiliaryNobleCandidate], [false, false, false]);
    const selected = { ...run, facts: [fact] }, hit = result(selected, 88);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '有正曜星加吉');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'sky-opposed-double-limit'));
    assert.match(formatFortunePrompt(input), /有正曜星加吉/u);
    assert.doesNotMatch(formatFortunePrompt(input), /skyOpposedDoubleLimitNamedSupport|太岁在[卯子]宫|实守[酉午]宫/u);

    const source = astrolabe({ dateStr, timeIndex, gender }), natal = source.toJSON(), actual = source.horoscope(year + '-06-01', 6);
    const frame = { lunarYear: year, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: actual.age.index };
    const compute = (archive, namedFrame) => quanshuKongJieLimits(archive, quanshuLimitBranches(archive, namedFrame));
    const next = source.horoscope(year + 1 + '-06-01', 6);
    assert.equal(compute(natal, { lunarYear: year + 1, yearIndex: next.yearly.index,
      decadalIndex: next.decadal.index, minorIndex: next.age.index })[field], false);
    const mismatched = compute(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
    assert.equal(mismatched.ready, true);
    assert.equal(mismatched.skySupportLimits.minor, undefined);
    assert.equal(mismatched[field], undefined);
    const evaluate = normalizedPayload => result({ ...selected, facts: [{ ...fact, normalizedPayload }] }, 88);
    assert.notEqual(evaluate(mismatched).status, 'matched');

    if (timeIndex === 2) {
      const broken = structuredClone(natal), seat = place(broken, '左辅');
      const [left] = seat.minorStars.splice(seat.minorStars.findIndex(star => star.name === '左辅'), 1);
      seat.adjectiveStars.push(left);
      const noAid = compute(broken, frame);
      assert.equal(noAid[field], undefined);
      assert.notEqual(evaluate(noAid).status, 'matched');
      const otherBirthDay = compute({ ...natal, solarDate: '1961-07-16' }, frame);
      assert.equal(otherBirthDay.skySupportBirthAnchorProof, undefined);
      assert.equal(otherBirthDay[field], undefined);
      assert.notEqual(evaluate(otherBirthDay).status, 'matched');
    }
  }
});

test('p039 confirms a verified noble and principal at the common Tai Sui and actual limits', () => {
  const dateStr = '1994-06-05', timeIndex = 4, year = 2063;
  const { run, fact } = submittedLimitRun(dateStr, timeIndex, year);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.decadalBranch, data.minorBranch, data.skyBranch], ['未', '未', '未', '未']);
  assert.equal(data.skyCoSeatedNobleCandidate, true);
  assert.deepEqual(data.skyCoSeatedNobleWitness, { branch: '未', principals: ['天梁'], noble: '魁钺组' });
  const selected = { ...run, facts: [fact] };
  const hit = result(selected, 88);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'sky-confirmed-noble'));
  assert.match(formatFortuneFactAudit(input), /魁钺组一曜与正曜天梁实守古天空所在的未宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同一农历年的太岁及复核大小限均实守本命古天空宫/u);
  assert.match(prompt, /校验归档的魁钺组一曜同守/u);
  assert.doesNotMatch(prompt, /未宫|skyCoSeatedNobleWitness|天梁/u);

  const source = astrolabe({ dateStr, timeIndex, gender: '女' });
  const natal = source.toJSON(), actual = source.horoscope(year + '-06-01', 6);
  const frame = { lunarYear: year, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: actual.age.index };
  const evaluate = normalizedPayload => result({ ...selected, facts: [{ ...fact, normalizedPayload }] }, 88);
  const wrongLimit = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(wrongLimit.skyCoSeatedNobleCandidate, undefined);
  assert.equal(evaluate(wrongLimit).status, 'partial');
  const noble = place(natal, '天钺');
  const [archived] = noble.minorStars.splice(noble.minorStars.findIndex(row => row.name === '天钺'), 1);
  noble.adjectiveStars.push(archived);
  const wrongLayer = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, frame));
  assert.equal(wrongLayer.skyCoSeatedAssistantCandidate, true);
  assert.equal(wrongLayer.skyCoSeatedNobleCandidate, undefined);
  assert.equal(evaluate(wrongLayer).matchedSourceExcerpt, '太岁二限遇逢，有正曜星加吉');

  const next = source.horoscope('2064-06-01', 6);
  const neighbor = quanshuKongJieLimits(source.toJSON(), quanshuLimitBranches(source.toJSON(), {
    lunarYear: 2064, yearIndex: next.yearly.index, decadalIndex: next.decadal.index, minorIndex: next.age.index,
  }));
  assert.equal(neighbor.skyCoSeatedNobleCandidate, false);
});

test('p039 separately confirms the Ming assistant classified as a principal with a distinct co-seated noble', () => {
  const dateStr = '1964-11-25', timeIndex = 10, year = 1973;
  const { run, fact } = submittedLimitRun(dateStr, timeIndex, year);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.annualBranch, data.decadalBranch, data.minorBranch, data.skyBranch], ['丑', '丑', '丑', '丑']);
  assert.equal(data.skyCoSeatedNobleCandidate, false);
  assert.equal(data.skyCoSeatedMingAuxiliaryNobleCandidate, true);
  assert.deepEqual(data.skyCoSeatedMingAuxiliaryNobleWitness, { branch: '丑', principals: ['左辅', '右弼'], noble: '魁钺组' });
  const selected = { ...run, facts: [fact] }, hit = result(selected, 88);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

  const astro = astrolabe({ dateStr, timeIndex, gender: '女' }), natal = astro.toJSON();
  const recompute = (archive, lunarYear, minorOffset = 0) => {
    const actual = astro.horoscope(`${lunarYear}-06-01`, 6);
    return quanshuKongJieLimits(archive, quanshuLimitBranches(archive, { lunarYear,
      yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: (actual.age.index + minorOffset) % 12 }));
  };
  const move = (archive, stars) => {
    const broken = structuredClone(archive);
    for (const name of stars) {
      const palace = place(broken, name);
      const [star] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === name), 1);
      palace.adjectiveStars.push(star);
    }
    return broken;
  };
  assert.equal(recompute(move(natal, ['天钺']), year).skyCoSeatedMingAuxiliaryNobleCandidate, true);
  for (const unverified of [recompute(move(natal, ['天魁']), year), recompute(move(natal, ['左辅', '右弼']), year), recompute(natal, year, 1)]) {
    assert.equal(unverified.skyCoSeatedMingAuxiliaryNobleCandidate, undefined);
    assert.notEqual(result({ ...selected, facts: [{ ...fact, normalizedPayload: unverified }] }, 88).status, 'matched');
  }
  const displaced = native({ dateStr: '1964-11-27', timeIndex, gender: '女' });
  assert.deepEqual([place(natal, '紫微').earthlyBranch, place(displaced, '紫微').earthlyBranch], ['子', '丑']);
  for (const palace of displaced.palaces) palace.majorStars = natal.palaces.find(row => row.index === palace.index).majorStars;
  const independentlyKnown = recompute(displaced, year);
  assert.equal(independentlyKnown.skyCoSeatedNobleCandidate, undefined);
  assert.equal(independentlyKnown.skyCoSeatedMingAuxiliaryNobleCandidate, true);
  assert.equal(result({ ...selected, facts: [{ ...fact, normalizedPayload: independentlyKnown }] }, 88).status, 'matched');
  assert.equal(recompute(natal, year + 1).skyCoSeatedMingAuxiliaryNobleCandidate, false);
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'sky-ming-auxiliary'));
  assert.match(formatFortuneFactAudit(input), /依明刊十八正曜，左辅、右弼与魁钺组一曜实守古天空所在的丑宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /左辅、右弼列入南北斗正曜/u);
  assert.doesNotMatch(prompt, /丑宫|skyCoSeatedMingAuxiliaryNobleWitness/u);
});

test('the Sky and Robbery passages survive an unrelated missing void, while paired voids retain unknown', () => {
  const cases = [
    { args: ['1974-02-05', 2, 1983, '男'], missing: '地空', misplaced: true,
      flag: 'robberyMingBoshiOfficialGuardCandidate', index: 87, other: 88, readiness: [false, true] },
    { args: ['1987-06-05', 3, 2040, '女'], missing: '地劫', misplaced: false,
      flag: 'skyCoSeatedAssistantCandidate', index: 88, other: 87, readiness: [true, false] },
  ];
  for (const { args, missing, misplaced, flag, index, other, readiness } of cases) {
    const [dateStr, timeIndex, , gender] = args;
    const natal = native({ dateStr, timeIndex, gender }), palace = place(natal, missing);
    const [archived] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === missing), 1);
    if (misplaced) palace.adjectiveStars.push(archived);
    const { run, fact } = submittedLimitRun(...args, natal);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.sourceSkyReady, data.sourceRobberyReady], readiness);
    assert.equal(data[flag], true);
    assert.equal(data.pairedVoidsCandidate, undefined);
    assert.equal(result(run, index).status, misplaced ? 'partial' : 'matched');
    assert.equal(result(run, other).status, 'unknown');
    assert.equal(result(run, 66).status, 'unknown');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'isolated-source-void'));
    const separateSource = misplaced ? '古天空待核，地劫独立核位' : '地劫待核，古天空独立核位';
    assert.ok(formatFortuneFactAudit(input).includes(separateSource));
    assert.doesNotMatch(formatFortunePrompt(input), /待核，(?:地劫|古天空)独立核位|sourceSkyReady|sourceRobberyReady/u);
    const { limitPlacementProof, ...legacy } = data;
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: legacy }] }, index).status, 'unknown');
  }
  const empty = astrolabe({ dateStr: '1987-06-05', timeIndex: 3, gender: '女' });
  const natal = empty.toJSON(), h = empty.horoscope('2040-06-01', 6);
  for (const name of ['地空', '地劫']) {
    const palace = place(natal, name);
    palace.minorStars = palace.minorStars.filter(row => row.name !== name);
  }
  const limits = quanshuLimitBranches(natal, { lunarYear: 2040, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
    minorIndex: h.age.index });
  assert.equal(limits.ready, true);
  assert.deepEqual(quanshuKongJieLimits(natal, limits), { ready: false });
});

test('a copied decade and a primary star in the wrong layer cannot supply the verified void limit', () => {
  const robbery = astrolabe({ dateStr: '1974-02-05', timeIndex: 2, gender: '男' });
  const { run, fact } = submittedLimitRun('1974-02-05', 2, 1984, '男');
  const natal = robbery.toJSON(), h = robbery.horoscope('1984-06-01', 6);
  const fake = place(natal, '地劫');
  fake.decadal.range = [...natal.palaces.find(row => row.index === h.decadal.index).decadal.range];
  const frame = { lunarYear: 1984, yearIndex: h.yearly.index, decadalIndex: fake.index, minorIndex: h.age.index };
  assert.equal(quanshuLimitPhase(natal, fake.index, h.age.nominalAge, quanshuLunarMidnight(1984, 1)).ready, true);
  const impossible = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, frame));
  assert.deepEqual(impossible.sourceDecadal, { branch: fake.earthlyBranch, verified: false });
  assert.equal(impossible.robbery.decadal, '守');
  assert.equal(impossible.robberyLimits.decadal, undefined);
  assert.deepEqual(impossible.robberyVerifiedLimitScopes, []);
  assert.equal(impossible.robberyMingBoshiOfficialGuardCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: impossible }] }, 87).status, 'unknown');

  const sky = astrolabe({ dateStr: '1987-06-05', timeIndex: 3, gender: '女' });
  const changed = sky.toJSON(), positive = sky.horoscope('2040-06-01', 6);
  const major = place(changed, '破军');
  const [pojun] = major.majorStars.splice(major.majorStars.findIndex(row => row.name === '破军'), 1);
  major.adjectiveStars.push(pojun);
  const unresolved = quanshuKongJieLimits(changed, quanshuLimitBranches(changed, { lunarYear: 2040,
    yearIndex: positive.yearly.index, decadalIndex: positive.decadal.index, minorIndex: positive.age.index }));
  assert.equal(unresolved.skyAllThreeAtSeat, true);
  assert.equal(unresolved.knownLocalPrincipals.includes('破军'), false);
  assert.equal(unresolved.skyCoSeatedAssistantCandidate, undefined);
  assert.equal(unresolved.skyCoSeatedAssistantWitness, undefined);
});

test('p039 can use an aspecting partner limit when a principal and distinct helper both guard its one actual palace', () => {
  for (const [name, guardScope, supportScope, supportBranch, principal] of [
    ['skySupportAtDecadalPartner', 'minor', 'decadal', '子', ['天同', '太阴']],
    ['skySupportAtMinorPartner', 'decadal', 'minor', '卯', ['天府']],
  ]) {
    const run = limitRun(name), fact = exact(run)[0], p = fact.normalizedPayload;
    assert.equal(p.skySupportCandidate, false);
    assert.equal(p.sky[guardScope], '守');
    assert.equal(p.skyPartnerSupportCandidate, true);
    assert.deepEqual(p.skyPartnerSupportWitnesses, [{ guardScope, supportScope, supportBranch, relation: '三合',
      principals: principal, support: ['魁钺组'], candidate: true }]);
    const match = result(run, 88);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    if (guardScope !== 'minor') continue;
    const archive = astrolabe(reference.limitExamples[name]), natal = archive.toJSON(), year = p.lunarYear;
    const actual = archive.horoscope(`${year}-06-01`, 6);
    const seat = natal.palaces.find(row => row.earthlyBranch === supportBranch);
    seat.adjectiveStars.push(seat.minorStars.splice(seat.minorStars.findIndex(row => ['天魁', '天钺'].includes(row.name)), 1)[0]);
    const wrongLayer = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, {
      lunarYear: year, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: actual.age.index,
    }));
    assert.equal(wrongLayer.skySupportLimits[guardScope], '守');
    assert.equal(wrongLayer.skyPartnerSupportCandidate, undefined);
    assert.deepEqual(wrongLayer.skyPartnerSupportWitnesses, []);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 88).status, 'unknown');
  }

  const near = limitRun('skyPartnerSupportSeparated'), split = exact(near)[0].normalizedPayload;
  assert.equal(split.sky.decadal, '守');
  assert.equal(split.sky.minor, '冲');
  assert.deepEqual(split.independentSupport.find(row => row.star === '天马'), { star: '天马', branch: '申', relation: '守' });
  assert.equal(split.skyPartnerSupportCandidate, false);
  assert.deepEqual(split.lucunSupport[0], { star: '本命禄存', branch: '申', relation: '守' });
  assert.equal(split.skyLuSupportCandidate, false);
  assert.equal(split.skyPartnerLuSupportCandidate, false);
  assert.equal(result(near, 88).status, 'not_matched');
  const run = limitRun('skySupportAtMinorPartner');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'partner-sky-support'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /小限在卯宫，与古天空宫为三合，实守正曜天府，同宫见魁钺组/u);
  assert.doesNotMatch(prompt, /skyPartnerSupportCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result(run, 88).knowledgeId));
});

test('p039 distinguishes natal Lu aspecting a local principal from annual Lu guarding the partner limit', () => {
  const { run: localRun, fact: local } = submittedLimitRun('1980-02-15', 1, 2006);
  const p = local.normalizedPayload;
  assert.deepEqual([p.skyBranch, p.sky.annual, p.sky.minor], ['戌', '守', '守']);
  assert.deepEqual(p.knownLocalPrincipals, ['天同']);
  assert.deepEqual(p.lucunSupport, [{ star: '本命禄存', branch: '午', relation: '三合' },
    { star: '流年禄存', branch: '巳', relation: '其他' }]);
  assert.equal(p.skyLuSupportCandidate, true);
  assert.equal(p.skyPartnerLuSupportCandidate, false);

  const { run: partnerRun, fact: partner } = submittedLimitRun('1980-02-15', 4, 2045);
  const q = partner.normalizedPayload;
  assert.deepEqual([q.skyBranch, q.sky.annual, q.sky.minor, q.sky.decadal], ['未', '冲', '守', '三合']);
  assert.deepEqual(q.knownLocalPrincipals, []);
  assert.equal(q.skyLuSupportCandidate, false);
  assert.equal(q.skyPartnerLuSupportCandidate, true);
  assert.deepEqual(q.skyPartnerLuSupportWitnesses, [{ guardScope: 'minor', supportBranch: '卯', supportScope: 'decadal',
    relation: '三合', principals: ['太阳', '天梁', '左辅'], support: ['流年禄存'], candidate: true }]);

  for (const [run, fact, start, expected] of [
    [localRun, local, '2006-01-28T16:00:00.000Z', /禄存与实守古天空的正曜有照，.*本命禄存.*午.*三合/u],
    [partnerRun, partner, '2045-02-16T16:00:00.000Z', /大限在卯宫，与古天空宫为三合，实守正曜太阳、天梁、左辅，同宫见流年禄存/u],
  ]) {
    assert.equal(fact.activeFrom, start);
    assert.equal(fact.normalizedPayload.skySupportCandidate, false);
    assert.equal(fact.normalizedPayload.skyPartnerSupportCandidate, false);
    const match = result(run, 88);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sky-lucun'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, expected);
    assert.doesNotMatch(prompt, /lucunSupport|skyLuSupportCandidate|skyPartnerLuSupportWitnesses/u);
  }

  for (const [sample, year, run, fact] of [
    [1, 2006, localRun, local], [4, 2045, partnerRun, partner],
  ]) {
    const archive = astrolabe({ dateStr: '1980-02-15', timeIndex: sample, gender: '女' });
    const { yearly, decadal, age } = archive.horoscope(year + '-06-01');
    const natal = archive.toJSON();
    const limits = quanshuLimitBranches(natal, { lunarYear: year, yearIndex: yearly.index, decadalIndex: decadal.index, minorIndex: age.index });
    assert.equal(limits.sourceMinor?.verified, true);
    const unverified = quanshuKongJieLimits(natal, { ...limits, sourceMinor: { ...limits.sourceMinor, verified: false } });
    assert.equal(unverified.sky.minor, '守');
    assert.equal(unverified.skySupportLimits.minor, undefined);
    assert.notEqual(unverified.skyLuSupportCandidate, true);
    assert.notEqual(unverified.skyPartnerLuSupportCandidate, true);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, 88).status, 'unknown');
  }
});

test('unverified Boshi and an unavailable partner limit preserve unknown in their own branches', () => {
  const archive = astrolabe(reference.limitExamples.boshiOnly), natal = archive.toJSON();
  const year = archive.horoscope('2015-06-01', 6);
  const frame = { lunarYear: 2015, yearIndex: year.yearly.index, decadalIndex: year.decadal.index, minorIndex: year.age.index };
  natal.palaces.find(p => p.boshi12 === '官府').boshi12 = '博士';
  const missingBoshi = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, frame));
  assert.equal(missingBoshi.robberyBoshiOfficialCandidate, undefined);
  assert.equal(missingBoshi.robberyAnnualOfficialCandidate, false);
  assert.equal(missingBoshi.robberyShaCandidate, false);
  const unknownLimit = quanshuKongJieLimits(natal, quanshuLimitBranches(natal, { ...frame, decadalIndex: undefined }));
  assert.equal(unknownLimit.robbery.decadal, undefined);
  assert.equal(unknownLimit.pairedVoidsCandidate, undefined);
  const split = astrolabe(reference.limitExamples.splitWithoutSupport);
  const splitYear = split.horoscope('2054-06-01', 6);
  const splitNatal = split.toJSON();
  const missingMinor = quanshuKongJieLimits(splitNatal, quanshuLimitBranches(splitNatal,
    { lunarYear: 2054, yearIndex: splitYear.yearly.index, decadalIndex: splitYear.decadal.index }));
  assert.equal(missingMinor.sky.decadal, '守');
  assert.equal(missingMinor.splitLimits, undefined);
  assert.equal(missingMinor.pairedVoidsCandidate, undefined);
});

test('source facts reach natural Chinese, while all three still-incomplete source passages stay out of matched materials', () => {
  const run = realRun(0), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'kongjie-prompt'));
  assert.ok(input.facts.some(f => f.type === 'quanshu_kongjie_condition'));
  assert.ok(input.facts.some(f => f.type === 'quanshu_kongjie_limits'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /古天空在酉宫/u); assert.match(prompt, /地劫在丑宫/u); assert.match(prompt, /不按同名直接替换古天空/u);
  assert.match(prompt, /不等于正曜加吉已成立|不据此推断三方没有吉援/u);
  assert.match(prompt, /太岁煞集合、救应及相遇范围仍待核/u);
  assert.match(prompt, /古天空与地劫分宫，大小限各守一颗/u);
  assert.match(prompt, /四飞官府、本命博士官府和流年羊陀各有取法/u);
  for (const index of rules) assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId));
  for (const forbidden of ['quanshu_kongjie', 'skyBranch', 'annualAtPalace', 'modernSkyBranches', 'robberyShaCandidate', 'kongjie-run', 'https://']) assert.ok(!prompt.includes(forbidden), forbidden);
});

test('ambiguous or incompatible input and unverified star identity cannot turn into a complete source match', () => {
  for (const alter of [c => { c.timeKnown = false; }, c => { c.ziwei.rawResult.push(structuredClone(c.ziwei.rawResult[0])); },
    c => { c.ziwei.engineVersion = 'other'; }, c => { c.ziwei.rawResult[0].rawDates.lunarDate.isLeap = true; }]) {
    const snapshot = chart(); alter(snapshot); const run = calculate(snapshot);
    for (const index of rules) assert.equal(result(run, index).status, 'unknown');
  }
  const snapshot = chart(), n = snapshot.ziwei.rawResult[0];
  place(n, '地空').minorStars = place(n, '地空').minorStars.filter(s => s.name !== '地空');
  const run = calculate(snapshot);
  assert.ok(specific(run).length && specific(run).every(f => f.completeness === 'partial'));
  for (const index of rules) assert.equal(result(run, index).status, 'unknown');
});

test('each changed rule records its original source hash, independently supported geometry and the exact remaining interpretation gap', () => {
  for (const index of rules) {
    const rule = fortuneKnowledge.ziwei.rules[index], entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.ok(rule.unresolved.length); assert.equal(rule.queries[0].factType, 'quanshu_kongjie_limits');
    assert.ok(rule.review.supportingSources.some(url => url.includes('oldid=1963110')));
  }
  const robberyRule = fortuneKnowledge.ziwei.rules[87];
  assert.match(robberyRule.unresolved.join(), /官符的盘层和作用仍待核/u);
  assert.match(robberyRule.review.mappedConditions.join(), /四飞官府.*本命博士官府/u);
  assert.match(fortuneKnowledge.ziwei.rules[88].unresolved.join(), /正曜和吉曜的完整范围/u);
});
