import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { smthMinorLuckVariants, minorLuckOrdinal, baziMinorLuckContext, baziMinorLuckPolicy,
  smthMinorMajorLuckHistory } = await import('./control/bazi-minor-luck.ts');
const { describeBaZiPillar, smthHeavenVirtueStemRule, smthMoonVirtueRule } = await import('./control/bazi-calculation.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/bazi-minor-luck-reference.json', import.meta.url)));
const hourKey = 'zuixing-hour-year-direction', fixedKey = 'fixed-bingyin-renshen', openingKey = 'female-bingshen-opening-reading';
const liChun2026 = '2026-02-03T20:02:08.000Z';
function archive(example = reference.realExample) {
  const { year, month, day, hour, gender } = example, l = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  return { timeKnown: true, bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: new Date(Date.UTC(year, month - 1, day, hour - 8)).toISOString(), year: l.getYearInGanZhiExact(), month: l.getMonthInGanZhiExact(),
      day: l.getDayInGanZhiExact(), hour: l.getTimeInGanZhi(), tenGods: {}, shenSha: {},
      luckPeriods: l.getEightChar().getYun(gender, 2).getDaYun(11).slice(1).map(s => ({ ganZhi: s.getGanZhi(), startAge: s.getStartAge(), endAge: s.getEndAge() })) }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
function calculate(chart = archive(), year = 2026) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  return calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server'),
    'minor-source-run', { snapshotId: 'minor-source-snapshot', chart });
}
const specific = run => run.facts.filter(f => f.factType === 'minor_luck_context');
const results = run => matchFortuneKnowledge(run).byMethod.bazi.filter(r => [1, 2].some(i => r.knowledgeId === fortuneKnowledge.bazi.rules[i].knowledgeId));
let cached;
const real = () => cached ??= calculate();

test('p245 confirms the small-luck-only punctuation only where both clocks and methods agree', () => {
  const birth = { year: 1970, month: 1, day: 15, hour: 2, gender: 1 };
  const chart = archive(birth), year = 2028;
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.parse('2028-06-01T04:00:00Z');
  const reference = { snapshotId: 'minor-only-harm', chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'minor-only-harm', reference);
  validateFortuneFacts(run);
  const cut = '2028-02-04T07:31:13.000Z';
  const fact = specific(run).find(row => row.normalizedPayload.allMinorMethodsSameNatalMinorOnlyHarm);
  assert.ok(fact);
  assert.equal(fact.activeFrom, cut);
  const p = fact.normalizedPayload;
  assert.deepEqual([p.annualPillar, p.luckPillar], ['戊申', '辛未']);
  assert.deepEqual(p.harmEvidence.annual, []);
  assert.deepEqual(p.harmEvidence.mutual, []);
  assert.deepEqual(p.p245Agreement.minorOnlyHarm, [{ target: 'natal:day', kind: '相刑', pillar: '乙未' }]);
  const alternatives = specific(run).filter(row => !row.normalizedPayload.p245Agreement && row.activeFrom === cut);
  assert.deepEqual(alternatives.map(row => row.normalizedPayload.minorPillar), ['丁丑', '乙丑']);
  assert.ok(alternatives.every(row => row.normalizedPayload.harmEvidence.minor.some(edge => edge.target === 'natal:day' && edge.kind === '相刑')));
  assert.ok(specific(run).some(row => row.activeTo === cut && !row.normalizedPayload.allMinorMethodsSameNatalMinorOnlyHarm));
  const [hit] = results(run);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: cut, endExclusive: '2028-12-31T16:00:00.000Z' }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.notEqual(results({ ...run, facts: alternatives })[0].status, 'matched');
  const changed = calculate(archive({ ...birth, hour: 4 }), year);
  assert.ok(specific(changed).every(row => !row.normalizedPayload.allMinorMethodsSameNatalMinorOnlyHarm));

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-only-harm'));
  assert.match(formatFortuneFactAudit(input), /各法小运均见本命日柱乙未的相刑/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /逐年太岁交代当年背景，小运到刑害位置另核/u);
  assert.doesNotMatch(prompt, /allMinorMethodsSameNatalMinorOnlyHarm|本命日柱乙未|2028-02-04T/u);
});

test('printed hour-origin example begins one place after birth, keeps all four sex/year directions, and wraps after sixty', () => {
  assert.equal(reference.profile, baziMinorLuckPolicy.profile);
  for (const row of reference.hourExamples) {
    const actual = smthMinorLuckVariants(row.year, row.hour, row.gender, row.ordinal).find(v => v.variant === hourKey);
    assert.equal(actual.pillar, row.pillar); assert.equal(actual.direction, row.direction);
  }
  assert.notEqual(smthMinorLuckVariants('甲子', '甲子', '男', 1)[0].pillar, '甲子');
  for (const ordinal of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => smthMinorLuckVariants('甲子', '甲子', '男', ordinal));
  for (const [year, hour, gender] of [['甲丑', '甲子', '男'], ['甲子', '甲丑', '男'], ['甲子', '甲子', 'unknown']]) {
    assert.throws(() => smthMinorLuckVariants(year, hour, gender, 1));
  }
});

test('fixed starts and the female opening variant remain separate from hour-origin direction, with no substitution or off-by-one', () => {
  for (const row of reference.fixedExamples) {
    const variants = smthMinorLuckVariants('乙丑', '庚午', row.gender, row.ordinal);
    assert.equal(variants.find(v => v.variant === fixedKey).pillar, row.pillar);
    if (row.opening) assert.equal(variants.find(v => v.variant === openingKey).pillar, row.opening);
  }
  const maleYinYear = smthMinorLuckVariants('乙丑', '甲子', '男', 2);
  assert.equal(maleYinYear.find(v => v.variant === hourKey).direction, 'backward');
  assert.equal(maleYinYear.find(v => v.variant === fixedKey).direction, 'forward');
  const unknownHour = smthMinorLuckVariants('甲子', undefined, '女', 1);
  assert.equal(unknownHour.length, 2); assert.ok(unknownHour.every(v => v.variant !== hourKey));
});

test('declared ordinal convention changes only at exact Li Chun, including January births, and remains explicitly unverified as source calendar', () => {
  const birth = Date.parse('1990-09-29T04:00:00Z'), boundary = Date.parse(liChun2026);
  assert.equal(minorLuckOrdinal(birth, boundary - 1).ordinal, 36);
  assert.equal(minorLuckOrdinal(birth, boundary).ordinal, 37);
  assert.equal(minorLuckOrdinal(birth, Date.parse('2026-01-01T00:00:00+08:00')).yearLabel, 2025);
  for (const instant of ['2026-02-17T00:00:00+08:00', '2026-09-29T12:00:00+08:00']) assert.equal(minorLuckOrdinal(birth, Date.parse(instant)).ordinal, 37);
  const january = Date.parse('1990-01-10T04:00:00Z');
  assert.equal(minorLuckOrdinal(january, january).birthYearLabel, 1989);
  assert.equal(minorLuckOrdinal(january, january).ordinal, 1);
  assert.equal(minorLuckOrdinal(january, Date.parse('1990-02-04T02:14:00Z')).ordinal, 2);
  assert.equal(minorLuckOrdinal(birth, birth - 1), undefined);
  assert.equal(minorLuckOrdinal(birth, boundary).calendarVerified, false);
  assert.throws(() => minorLuckOrdinal(NaN, boundary));
});

test('annual/minor harm participants, Lu bases and year-horse positions are atomic geometry, not automatic injury or lucky-god totals', () => {
  const natal = { year: '甲子', month: '丙寅', day: '丁卯', hour: '庚子' }, before = structuredClone(natal);
  const value = baziMinorLuckContext(natal, true, '乙卯', '甲申', { variant: fixedKey, direction: 'backward', pillar: '丁未' });
  assert.deepEqual(value.jointNatalHarmTargets, ['natal:year', 'natal:hour']);
  assert.equal(value.hasIndependentHarm, true);
  assert.ok(value.harmEvidence.annual.some(row => row.target === 'natal:year' && row.pillar === '甲子' && row.kind === '相刑'));
  assert.ok(value.harmEvidence.minor.some(row => row.target === 'natal:year' && row.pillar === '甲子' && row.kind === '六害'));
  assert.ok(value.annualContacts.some(row => row.target === 'natal:year' && row.kind === '相刑'));
  assert.ok(value.minorContacts.some(row => row.target === 'natal:year' && row.kind === '六害'));
  assert.equal(value.yearLuBranch, '寅'); assert.equal(value.dayLuBranch, '午'); assert.equal(value.yearHorseBranch, '寅');
  assert.equal(value.annual.atDayLu, false); assert.equal(value.sourceEffects, 'unresolved-source-calendar-variant-actors-and-usefulness');
  const clashOnly = baziMinorLuckContext(natal, true, '丙午', '甲申', { variant: fixedKey, direction: 'forward', pillar: '戊午' });
  assert.deepEqual(clashOnly.jointNatalHarmTargets, []); // Clashes are not mislabeled as punishment/harm.
  const three = baziMinorLuckContext(natal, true, '乙巳', '甲申', { variant: fixedKey, direction: 'forward', pillar: '戊申' });
  assert.ok(three.threePunishments.some(row => row.branches === '寅巳申' && row.participants.flat().includes('annual')));
  const unknown = baziMinorLuckContext({ ...natal, hour: 'not-provided' }, false, '乙卯', undefined, { variant: fixedKey, direction: 'forward', pillar: '丙寅' });
  assert.equal(unknown.hasMajorLuck, false); assert.ok(unknown.annualContacts.every(row => row.target !== 'natal:hour' && row.target !== 'luck'));
  assert.throws(() => baziMinorLuckContext(natal, true, '甲丑', '甲申', { variant: fixedKey, direction: 'forward', pillar: '戊申' }));
  assert.throws(() => baziMinorLuckContext(natal, true, '乙卯', '', { variant: fixedKey, direction: 'forward', pillar: '戊申' }));
  assert.deepEqual(natal, before);
});

test('a mutual pair, minor-only harm and a clash are distinguished by the source predicate', () => {
  const natal = { year: '甲申', month: '壬申', day: '壬申', hour: '戊申' };
  const compare = (annual, minor) => baziMinorLuckContext(natal, true, annual, '壬申',
    { variant: hourKey, direction: 'forward', pillar: minor });
  const mutual = compare('甲子', '乙卯');
  assert.deepEqual(mutual.harmEvidence, { annual: [], minor: [], mutual: ['相刑'] });
  assert.equal(mutual.hasIndependentHarm, undefined);
  const minorOnly = compare('甲子', '丁亥');
  assert.ok(minorOnly.harmEvidence.minor.some(row => row.kind === '六害'));
  assert.deepEqual(minorOnly.harmEvidence.annual, []);
  assert.equal(minorOnly.hasIndependentHarm, undefined);
  const zi = { year: '甲子', month: '丙子', day: '戊子', hour: '庚子' };
  const clash = baziMinorLuckContext(zi, true, '丙午', '甲子', { variant: hourKey, direction: 'forward', pillar: '壬辰' });
  assert.ok(clash.annualContacts.some(row => row.kind === '六冲'));
  assert.deepEqual(clash.harmEvidence, { annual: [], minor: [], mutual: [] });
  assert.equal(clash.hasIndependentHarm, false);
  assert.equal(baziMinorLuckContext(zi, false, '丙午', '甲子', { variant: hourKey, direction: 'forward', pillar: '壬辰' }).hasIndependentHarm, undefined);
});

test('shared support uses the named birth, peak and Lu positions under one stem or a common horse relation', () => {
  const natal = { year: '甲子', month: '丙寅', day: '丁卯', hour: '庚子' };
  const compare = (annual, minor, born = natal) => baziMinorLuckContext(born, true, annual, '甲申',
    { variant: hourKey, direction: 'forward', pillar: minor });
  assert.deepEqual(compare('丁亥', '乙卯').commonStemSupport,
    [{ basis: 'year', stem: '甲', annual: ['长生'], minor: ['帝旺'] }]);
  assert.deepEqual(compare('辛酉', '丁巳').commonStemSupport,
    [{ basis: 'day', stem: '丁', annual: ['长生'], minor: ['帝旺'] }]);
  assert.deepEqual(compare('丙午', '丁巳').commonStemSupport,
    [{ basis: 'day', stem: '丁', annual: ['禄'], minor: ['帝旺'] }]);
  const mixed = compare('丙寅', '丁巳');
  assert.equal(mixed.annual.atYearLu, true);
  assert.equal(mixed.hasSharedSourceSupport, undefined);
  const direct = compare('丙寅', '戊寅');
  assert.equal(direct.commonHorseSupport, 'same_horse_position');
  const combined = compare('丁亥', '己亥', { ...natal, year: '戊辰' });
  assert.equal(combined.commonHorseSupport, 'both_combine_with_horse');
  assert.deepEqual(combined.commonStemSupport, []);
  assert.equal(combined.hasSharedSourceSupport, true);
});

test('all twenty named horse pillars use their birth-year group and full stem and branch', () => {
  const printed = [
    ['甲申 甲子 甲辰', ['甲寅正禄文星马', '丙寅福星马', '戊寅伏马', '庚寅破禄马', '壬寅截路马'], '己亥'],
    ['甲寅 甲午 甲戌', ['甲申截路空日马', '丙申大败马', '戊申福星伏马', '庚申逢天关马', '壬申大败马'], '乙巳'],
    ['乙巳 乙酉 乙丑', ['乙亥天德马', '丁亥天乙马', '己亥旺禄马', '辛亥正禄马', '癸亥大败马'], '甲寅'],
    ['乙亥 乙卯 乙未', ['乙巳正禄马', '丁巳旺气马', '己巳九天禄库马', '辛巳截路马', '癸巳天乙伏马'], '甲申'],
  ];
  for (const [years, rows, other] of printed) for (const year of years.split(' ')) for (const row of rows) {
    const pillar = row.slice(0, 2);
    const { horseEvidence } = baziMinorLuckContext({ year, month: '庚寅', day: '丁卯', hour: '庚子' }, true, pillar, '甲子',
      { variant: hourKey, direction: 'forward', pillar: other });
    assert.equal(horseEvidence.annual.name, row.slice(2), year + ' ' + pillar);
    assert.equal(horseEvidence.annualAtResponseBranch, true);
    assert.equal(horseEvidence.minor, undefined);
  }
  const natal = { year: '戊辰', month: '庚申', day: '壬午', hour: '丁未' };
  for (const [annual, minor] of [['甲寅', '己亥'], ['辛亥', '丙寅']]) {
    const fact = baziMinorLuckContext(natal, true, annual, '甲子', { variant: hourKey, direction: 'forward', pillar: minor });
    assert.equal(fact.commonHorseSupport, 'stem_and_branch_combine_with_horse');
    assert.equal(fact.hasSharedSourceSupport, true);
    assert.equal(fact.horseEvidence.annualAtResponseBranch, true);
    assert.equal(fact.horseEvidence.minorAtResponseBranch, true);
  }
  const solelyBranch = baziMinorLuckContext(natal, true, '甲寅', '甲子', { variant: hourKey, direction: 'forward', pillar: '丁亥' });
  assert.equal(solelyBranch.commonHorseSupport, undefined);
  assert.equal(solelyBranch.hasSharedSourceSupport, undefined);
});

test('the verified minor-luck pair records a real horse combination and excludes unsupported horse cases', () => {
  const asOf = Date.parse('2026-11-19T03:00:00Z');
  const combinedBirth = { year: 1981, month: 3, day: 2, hour: 10, gender: 1 };
  const adverseBirth = { year: 1980, month: 3, day: 10, hour: 14, gender: 1 };
  const cases = [
    { birth: combinedBirth, year: 2007, annual: '丁亥', minor: '壬寅', name: '天乙马', shape: 'stem_and_branch_combine_with_horse', matches: true },
    { birth: combinedBirth, year: 2019, annual: '己亥', minor: '庚寅', name: '旺禄马', matches: false },
    { birth: adverseBirth, year: 2010, annual: '庚寅', minor: '戊寅', name: '破禄马', shape: 'same_horse_position', matches: false },
  ];
  for (const example of cases) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: example.year } };
    const input = { snapshotId: 'minor-typed-horse-' + example.year, chart: archive(example.birth) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, input)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'minor-typed-horse-run', input);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const facts = specific(run).filter(({ normalizedPayload: p }) => p.annualPillar === example.annual);
    const hourFacts = facts.filter(({ normalizedPayload: p }) => p.variant === hourKey);
    assert.ok(hourFacts.length, String(example.year));
    for (const fact of hourFacts) {
      const p = fact.normalizedPayload;
      assert.equal(p.p245MatchProfile, baziMinorLuckPolicy.p245);
      assert.equal(p.minorPillar, example.minor);
      assert.equal(p.horseEvidence.annual.name, example.name);
      assert.equal(p.horseEvidence.annual.supportUnverified, example.name === '破禄马');
      assert.equal(p.commonHorseSupport, example.shape);
      assert.deepEqual(p.commonStemSupport, []);
      assert.equal(p.hasSharedSourceSupport === true, example.matches);
      if (example.matches) assert.deepEqual(p.majorLuckWeakBases, []);
    }
    assert.ok(facts.every(fact => !support.sourceFactIds.includes(fact.factId)));
    const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-typed-horse-report'));
    const prompt = formatFortuneFactAudit(modelInput);
    if (example.matches) assert.match(prompt, /另一方同时五合它的天干、六合它的地支/u);
    if (example.name === '破禄马') assert.match(prompt, /破禄马，这一马类单独不能支持岁与小运共同得助/u);
    assert.doesNotMatch(prompt, /horseEvidence|supportUnverified|stem_and_branch_combine_with_horse/u);
  }
});

test('p245-002 checks void and combination on the actual horse seats', () => {
  const natal = { year: '壬辰', month: '戊申', day: '丁未', hour: '乙巳' };
  const variant = { variant: hourKey, direction: 'forward', pillar: '甲寅' };
  const separate = baziMinorLuckContext(natal, true, '丙寅', '甲子', variant);
  assert.equal(separate.commonHorseSupport, 'same_horse_position');
  assert.deepEqual(separate.commonStemSupport, []);
  assert.deepEqual(separate.horseEvidence.blockedPositions, ['annual', 'minor']);
  assert.equal(separate.hasSharedSourceSupport, false);
  for (const seat of separate.horseEvidence.seats) {
    assert.deepEqual(seat.voidSources, [{ basis: 'day', xun: '甲辰' }]);
    assert.deepEqual(seat.voidCombinations, []);
  }
  const sameSeat = baziMinorLuckContext({ ...natal, hour: '辛亥' }, true, '丙寅', '甲子', variant);
  assert.deepEqual(sameSeat.horseEvidence.blockedPositions, []);
  assert.equal(sameSeat.hasSharedSourceSupport, true);
  for (const seat of sameSeat.horseEvidence.seats) {
    assert.deepEqual(seat.voidCombinations.map(row => row.members), [['natal:hour', seat.position]]);
  }
});

test('p245-002 rejects a listed Fu pillar as sole Horse support and retains the actual same-seat combination', () => {
  const cases = [
    { birth: { year: 1966, month: 3, day: 5, hour: 10, gender: 1 }, year: 2028, annual: '戊申', minor: '庚申',
      matches: false, name: '福星伏马', phrase: /本段太岁戊申整柱见〈论进交退伏〉所列伏神/u },
    { birth: { year: 1965, month: 3, day: 15, hour: 14, gender: 0 }, year: 2019, annual: '己亥', minor: '甲寅',
      matches: true, name: '旺禄马', phrase: /本段太岁的这一马位另见本段太岁与本段小运六合，保留合解候选/u },
  ];
  for (const sample of cases) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const asOf = Date.UTC(sample.year, 5, 15), reference = { snapshotId: 'minor-horse-seats-' + sample.year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual);
    const p = fact.normalizedPayload;
    assert.equal(p.minorPillar, sample.minor);
    assert.deepEqual(p.commonStemSupport, []);
    assert.equal(p.horseEvidence.annual.name, sample.name);
    assert.equal(p.hasSharedSourceSupport, sample.matches);
    assert.equal(support.sourceFactIds.includes(fact.factId), sample.matches);
    const seat = p.horseEvidence.seats.find(row => row.position === 'annual');
    assert.equal(seat.progressRestriction, sample.matches ? undefined : '伏神');
    if (sample.matches) {
      assert.ok(seat.voidSources.some(row => row.basis === 'day'));
      assert.ok(seat.voidCombinations.some(row => row.members.includes('minor')));
      assert.ok(seat.breakContacts.some(row => row.members.includes('minor')));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /voidCombinations|progressRestriction|blockedPositions/u);
  }
});

test('p245-002 matches shared canopy and natal noble flanks only on the unobstructed side of a real transition', () => {
  const samples = [
    { birth: { year: 1952, month: 3, day: 18, hour: 10, gender: 0 }, year: 1976,
      cut: '1976-05-12T12:00:00.000Z', annual: '丙辰', minor: '壬辰',
      before: '辛丑', after: '庚子', blockedSide: 'before', obstruction: '六破',
      flanks: [['卯', 'month', '癸卯'], ['巳', 'hour', '丁巳']] },
    { birth: { year: 1952, month: 4, day: 5, hour: 6, gender: 1 }, year: 2012,
      cut: '2012-06-24T10:00:00.000Z', annual: '壬辰', minor: '壬辰',
      before: '己酉', after: '庚戌', blockedSide: 'after', obstruction: '六冲',
      flanks: [['卯', 'hour', '辛卯'], ['巳', 'day', '辛巳']] },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 5, 15);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-canopy-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    assert.equal(support.status, 'partial');
    const facts = specific(run).filter(row => row.normalizedPayload.variant === hourKey);
    const before = facts.find(row => row.activeTo === sample.cut), after = facts.find(row => row.activeFrom === sample.cut);
    const annualOnly = specific(run).find(row => row.activeFrom === sample.cut && row.normalizedPayload.canopyReview?.seats.length === 1);
    assert.deepEqual(annualOnly.normalizedPayload.canopyReview.seats, [{ position: 'annual', pillar: sample.annual }]);
    assert.equal(annualOnly.normalizedPayload.hasSharedCanopySupport, false);
    for (const [side, fact] of [['before', before], ['after', after]]) {
      const p = fact.normalizedPayload, review = p.canopyReview;
      const active = side !== sample.blockedSide;
      assert.equal(p.luckPillar, sample[side]);
      assert.equal(p.canopyProfile, baziMinorLuckPolicy.canopy);
      assert.equal(p.hasSharedSourceSupport, undefined);
      assert.equal(p.hasSharedCanopySupport, active);
      assert.equal(support.sourceFactIds.includes(fact.factId), active);
      assert.deepEqual(review.seats, [{ position: 'annual', pillar: sample.annual }, { position: 'minor', pillar: sample.minor }]);
      assert.deepEqual(review.flanks, sample.flanks.map(([branch, position, pillar]) => ({ branch, columns: [{ position, pillar }] })));
      assert.deepEqual(review.voidBases, []);
      assert.deepEqual(review.obstructions, active ? [] : ['annual', 'minor'].map(position => ({ position, target: 'luck', kind: sample.obstruction })));
      const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
      if (active) assert.match(phrase, /原局夹贵两侧齐备，保留共同支持候选/u);
      else assert.match(phrase, new RegExp('实际华盖位置有.*' + sample.obstruction, 'u'));
    }
    const withoutReview = structuredClone(run);
    for (const fact of specific(withoutReview)) delete fact.normalizedPayload.canopyProfile;
    const withoutWitnesses = results(withoutReview)[1].sourceFactIds;
    assert.ok(![before, after].some(fact => withoutWitnesses.includes(fact.factId)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /华盖辰/u);
    assert.doesNotMatch(prompt, /canopyReview|hasSharedCanopySupport|natal-noble-flanks/u);
  }
});

test('p245-002 keeps the other published canopy branch and excludes void or a missing natal flank', () => {
  const cases = [
    { birth: { year: 1946, month: 2, day: 6, hour: 18, gender: 1 }, year: 1958, luck: '辛卯', branch: '戌',
      flanks: ['酉', '亥'], candidate: true, voidBases: [] },
    { birth: { year: 1952, month: 6, day: 26, hour: 10, gender: 0 }, year: 1964, luck: '乙巳', branch: '辰',
      flanks: ['卯', '巳'], candidate: false, voidBases: ['day'] },
    { birth: { year: 1952, month: 2, day: 6, hour: 6, gender: 1 }, year: 1988, luck: '乙巳', branch: '辰',
      flanks: ['卯'], candidate: false, voidBases: [] },
  ];
  for (const sample of cases) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year);
    const [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.luckPillar === sample.luck
      && p.canopyReview?.bothAtCanopy === true);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload;
    assert.equal(p.hasSharedSourceSupport, undefined);
    assert.equal(p.hasSharedCanopySupport, sample.candidate);
    assert.equal(support.sourceFactIds.includes(fact.factId), sample.candidate);
    assert.equal(p.canopyReview.branch, sample.branch);
    assert.deepEqual(p.canopyReview.flanks.filter(row => row.columns.length).map(row => row.branch), sample.flanks);
    assert.deepEqual(p.canopyReview.voidBases, sample.voidBases);
    assert.deepEqual(p.canopyReview.obstructions, []);
  }
});

test('the five Sanming Tiyao groups require two different noble combinations within each stem basis', () => {
  const table = [
    ['甲戊庚', '甲子', '庚午', '丑', '未'], ['乙己', '乙丑', '己巳', '子', '申'],
    ['丙丁', '丙寅', '戊辰', '亥', '酉'], ['壬癸', '壬申', '甲戌', '巳', '卯'],
    ['辛', '辛未', '乙亥', '午', '寅'],
  ];
  for (const [stems, annual, minor, nobleAtAnnual, nobleAtMinor] of table) for (const stem of stems) {
    const natal = { year: stem + ('甲丙戊庚壬'.includes(stem) ? '子' : '丑'), month: '壬寅', day: '甲子', hour: '甲子' };
    const variant = { variant: hourKey, direction: 'forward', pillar: minor };
    const together = baziMinorLuckContext(natal, true, annual, '甲子', variant);
    assert.equal(together.hasSharedNobleCombinationSupport, true);
    assert.deepEqual(together.nobleCombinationReview.find(row => row.basis === 'year'), { basis: 'year', stem, distinctPairs: 2,
      matches: [{ position: 'annual', pillar: annual, nobleBranch: nobleAtAnnual }, { position: 'minor', pillar: minor, nobleBranch: nobleAtMinor }] });
    const repeated = baziMinorLuckContext(natal, true, annual, '甲子', { ...variant, pillar: annual });
    assert.equal(repeated.hasSharedNobleCombinationSupport, false);
    assert.equal(repeated.nobleCombinationReview.find(row => row.basis === 'year').distinctPairs, 1);
  }
  const ordinary = baziMinorLuckContext({ year: '甲子', month: '壬寅', day: '辛亥', hour: '戊子' }, true,
    '甲子', '庚午', { variant: hourKey, direction: 'forward', pillar: '乙丑' });
  assert.ok(ordinary.annualContacts.some(row => row.target === 'minor' && row.kind === '六合'));
  assert.equal(ordinary.hasSharedNobleCombinationSupport, false);
});

test('p245-002 binds distinct noble combinations to the same active method and natal stem', () => {
  const samples = [
    { birth: { year: 1952, month: 2, day: 5, hour: 6, gender: 0 }, year: 1980,
      annual: '庚申', minor: '壬戌', pairs: [['year', 2, '巳卯']], candidate: true, weak: [],
      phrase: /本命年干壬为基准.*?贵支巳六合.*?贵支卯六合.*?保留同一年干的共同支持候选/u },
    { birth: { year: 1952, month: 2, day: 5, hour: 6, gender: 0 }, year: 1983,
      annual: '癸亥', minor: '己未', pairs: [['day', 2, '寅午']], candidate: true, weak: ['year-nayin'],
      phrase: /本命日干辛为基准.*?贵支寅六合.*?贵支午六合.*?保留同一日干的共同支持候选/u },
    { birth: { year: 1952, month: 2, day: 5, hour: 0, gender: 1 }, year: 1991,
      annual: '辛未', minor: '丁未', pairs: [['year', 1, '午午'], ['day', 1, '午午']], candidate: false,
      phrase: /两层同到一处贵支六合位，计一处/u },
    { birth: { year: 1952, month: 2, day: 10, hour: 14, gender: 0 }, year: 1980,
      annual: '庚申', minor: '丙寅', pairs: [['year', 1, '巳'], ['day', 1, '亥']], candidate: false,
      phrase: /这一干的取法只见一层落位/u },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 6, 1);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-noble-combinations-' + sample.year + '-' + sample.birth.hour, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const live = specific(run).filter(row => Date.parse(row.activeFrom) <= asOf && asOf < Date.parse(row.activeTo));
    const fact = live.find(row => row.normalizedPayload.variant === hourKey), p = fact.normalizedPayload;
    assert.equal(p.annualPillar, sample.annual);
    assert.equal(p.minorPillar, sample.minor);
    assert.equal(p.nobleCombinationProfile, baziMinorLuckPolicy.nobleCombinations);
    assert.equal(p.hasSharedSourceSupport, undefined);
    assert.equal(p.hasSharedCanopySupport, false);
    assert.equal(p.hasSharedNobleCombinationSupport, sample.candidate);
    assert.deepEqual(p.nobleCombinationReview.map(row => [row.basis, row.distinctPairs, row.matches.map(item => item.nobleBranch).join('')]), sample.pairs);
    assert.ok(live.filter(row => row !== fact).every(row => row.normalizedPayload.hasSharedNobleCombinationSupport === false));
    const [, support] = results(run);
    if (sample.weak) assert.deepEqual(p.majorLuckWeakBases, sample.weak);
    const matched = sample.candidate && sample.weak.length > 0;
    assert.equal(support.sourceFactIds.includes(fact.factId), matched);
    if (matched) {
      assert.equal(support.status, 'partial');
      const withoutReview = structuredClone(run);
      for (const row of specific(withoutReview)) delete row.normalizedPayload.nobleCombinationProfile;
      assert.ok(!results(withoutReview)[1].sourceFactIds.includes(fact.factId));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /nobleCombinationProfile|nobleCombinationReview|distinctPairs/u);
  }
});

test('p245-002 uses the actual Yan Dongsou noble pillars and the same major-luck interval', () => {
  const samples = [
    { birth: { year: 1956, month: 6, day: 22, hour: 2, gender: 0 }, year: 1971,
      basis: 'year', stem: '丙', annual: '辛亥', minor: '辛酉', stages: ['癸巳', '壬辰'], mutualClash: false },
    { birth: { year: 1950, month: 6, day: 22, hour: 14, gender: 1 }, year: 1985,
      basis: 'year', stem: '庚', annual: '乙丑', minor: '乙未', stages: ['乙酉', '丙戌'], mutualClash: true },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 11, 15);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-yan-noble-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual);
    const [beforeStage, afterStage] = sample.stages;
    const after = rows.find(row => row.normalizedPayload.luckPillar === afterStage && row.activeFrom === row.normalizedPayload.stageStart);
    const before = rows.find(row => row.normalizedPayload.luckPillar === beforeStage && row.activeTo === after?.activeFrom);
    assert.ok(before && after);
    assert.equal(before.activeTo, after.activeFrom);
    for (const [fact, isAfter] of [[before, false], [after, true]]) {
      const p = fact.normalizedPayload;
      assert.equal(p.minorPillar, sample.minor);
      assert.equal(p.yanNobleCombinationProfile, baziMinorLuckPolicy.yanNobleCombinations);
      const shouldMatch = !sample.mutualClash && isAfter;
      assert.equal(p.hasSharedYanNobleCombinationSupport, shouldMatch);
      assert.ok(![p.hasSharedSourceSupport, p.hasSharedCanopySupport, p.hasSharedNobleCombinationSupport,
        p.hasSharedMoonVirtueSupport, p.hasSharedHeavenVirtueSupport].includes(true));
      const review = p.yanNobleCombinationReview.find(row => row.basis === sample.basis);
      assert.equal(review.stem, sample.stem);
      assert.deepEqual(review.seats.map(row => [row.position, row.pillar]), [['annual', sample.annual], ['minor', sample.minor]]);
      assert.equal(review.seats.every(row => row.obstructions.some(c => c.kind === '六冲' && ['annual', 'minor'].includes(c.target))), sample.mutualClash);
      assert.equal(support.sourceFactIds.includes(fact.factId), shouldMatch, `${sample.year} ${p.luckPillar} ${after.activeFrom}`);
    }
    assert.deepEqual(after.normalizedPayload.majorLuckAdverseCases, ['unreached-birth-contention']);
    const others = specific(run).filter(row => row.normalizedPayload.variant !== hourKey);
    assert.ok(others.length && others.every(row => row.normalizedPayload.hasSharedYanNobleCombinationSupport !== true));
    if (!sample.mutualClash) {
      assert.equal(support.status, 'partial');
      const annual = before.normalizedPayload.yanNobleCombinationReview[0].seats[0];
      assert.equal(annual.pillar, '辛亥');
      assert.ok(annual.obstructions.some(contact => contact.target === 'luck' && contact.kind === '六冲'));
      const withoutReview = structuredClone(run);
      for (const row of specific(withoutReview)) delete row.normalizedPayload.yanNobleCombinationProfile;
      assert.ok(!results(withoutReview)[1].sourceFactIds.includes(after.factId));
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
      assert.ok(input.sections.every(section => section.findings.every(f => f.knowledgeId !== support.knowledgeId)));
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, /同一年干丙的两柱贵合/u);
      assert.doesNotMatch(audit, /yanNobleCombinationReview|hasSharedYanNobleCombinationSupport/u);
    } else {
      const audit = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: after.normalizedPayload }, String);
      assert.match(audit, /实际受阻于[^；。]*六冲/u);
    }
  }
});

test('real archived female example keeps three minor methods separate and only the same-method support reaches SQLite', () => {
  const run = real(); validateFortuneFacts(run); const facts = specific(run), { realExample: ex } = reference;
  assert.ok(facts.length > 0 && facts.every(f => f.scope === 'minor' && f.normalizedPayload.calendarVerified === false));
  for (const [variant, before, after] of [[hourKey, ex.hourMinorBeforeLiChun, ex.hourMinorAfterLiChun], [fixedKey, undefined, ex.fixedAfterLiChun], [openingKey, undefined, ex.openingAfterLiChun]]) {
    const selected = facts.filter(f => f.normalizedPayload.variant === variant);
    assert.ok(selected.some(f => f.activeFrom === liChun2026 && f.normalizedPayload.minorPillar === after));
    if (before) assert.ok(selected.some(f => f.activeTo === liChun2026 && f.normalizedPayload.minorPillar === before));
  }
  const [harm, support] = results(run);
  assert.equal(harm.status, 'not_matched');
  assert.equal(support.status, 'partial');
  const witnessed = facts.filter(row => support.sourceFactIds.includes(row.factId));
  assert.ok(witnessed.length > 0 && witnessed.every(({ normalizedPayload: p }) => p.confirmed && p.hasMajorLuck && p.hasSharedSourceSupport === true));
  assert.deepEqual(witnessed.filter(f => f.activeFrom === liChun2026).map(f => f.normalizedPayload.variant), [hourKey]);
  for (const fact of facts) assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
});

test('a real exact major-luck transition changes only the major stage and never resets the minor ordinal or mixes methods', () => {
  const run = calculate(archive(reference.transitionExample)); validateFortuneFacts(run);
  const facts = specific(run).filter(f => f.normalizedPayload.variant === hourKey);
  const after = facts.find(f => f.activeFrom === reference.transitionExample.transition);
  const before = facts.find(f => f.activeTo === after.activeFrom);
  assert.equal(before.normalizedPayload.luckPillar, reference.transitionExample.beforeLuck);
  assert.equal(after.normalizedPayload.luckPillar, reference.transitionExample.afterLuck);
  assert.equal(before.normalizedPayload.minorPillar, reference.transitionExample.minor);
  assert.equal(after.normalizedPayload.minorPillar, reference.transitionExample.minor);
  assert.equal(before.normalizedPayload.ordinal, after.normalizedPayload.ordinal);
  for (const fact of facts) assert.ok(fact.activeFrom >= fact.normalizedPayload.stageStart && fact.activeTo <= fact.normalizedPayload.stageEnd);
  const [harm] = results(run);
  assert.equal(harm.status, 'not_matched');
  const positive = specific(run).filter(({ normalizedPayload: p }) => p.p245MatchProfile && p.hasIndependentHarm);
  assert.equal(positive[0].activeFrom, reference.transitionExample.transition);
  assert.deepEqual(positive.map(f => f.normalizedPayload.variant), [fixedKey, openingKey]);
  assert.ok(positive.every(({ normalizedPayload: p }) => p.luckPillar === '辛巳'
    && p.harmEvidence.minor.some(row => row.target === 'luck' && row.pillar === '辛巳')));
  assert.ok(positive.every(({ normalizedPayload: p }) => p.majorLuckFavorableBases.length === 0));
});

test('p245 tracks major-luck growth history on both sides of the actual transition', () => {
  const cases = [
    { birth: { year: 1960, month: 2, day: 7, hour: 12, gender: 0 }, minor: '辛卯',
      cut: '2010-11-20T06:00:00.000Z', before: ['癸酉', '沐浴', 'not-reached'], after: ['壬申', '长生', 'current-stage'],
      phrase: /按年命纳音壁上土，当步运支为沐浴.*?未历长生，实际岁运同对见刑、冲、克或破/u },
    { birth: { year: 1960, month: 4, day: 3, hour: 12, gender: 1 }, minor: '乙酉',
      cut: '2010-10-16T18:00:00.000Z', before: ['甲申', '长生', 'current-stage'], after: ['乙酉', '沐浴', 'passed'],
      beforeNobleClash: true,
      phrase: /按年命纳音壁上土，当步运支为沐浴.*?前一步长生后进入沐浴，实际岁运另见刑、冲、克或破/u },
  ];
  for (const sample of cases) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2010 } };
    const asOf = Date.UTC(2010, 7, 15), reference = { snapshotId: 'minor-luck-history-' + sample.birth.month };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    assert.equal(support.status, 'partial');
    const facts = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === '庚寅');
    const before = facts.find(row => row.activeTo === sample.cut), after = facts.find(row => row.activeFrom === sample.cut);
    for (const [fact, [pillar, phase, birthStatus]] of [[before, sample.before], [after, sample.after]]) {
      const p = fact.normalizedPayload;
      assert.equal(p.luckPillar, pillar);
      assert.equal(p.minorPillar, sample.minor);
      assert.equal(p.majorLuckHistoryProfile, baziMinorLuckPolicy.majorHistory);
      assert.equal(p.majorLuckNaYinRelation, p.majorLuckHistory.majorLuckNaYin.relation);
      assert.equal(p.majorLuckPolarityCondition, p.majorLuckHistory.majorLuckPolarity.condition);
      assert.ok(p.majorLuckHistory.clashes.length + p.majorLuckHistory.controls.length > 0);
      assert.deepEqual(p.majorLuckHistory.bases.map(row => row.basis), ['year-nayin', 'day-stem']);
      const [year] = p.majorLuckHistory.bases;
      assert.equal(year.value, '壁上土');
      assert.equal(year.currentPhase, phase);
      assert.equal(year.birthStatus, birthStatus);
      assert.equal(year.contentionBeforeBirth, birthStatus === 'not-reached');
      assert.equal(year.contentionAtBathingAfterBirth, birthStatus === 'passed' && phase === '沐浴');
      const blocked = fact === before && sample.beforeNobleClash === true;
      assert.equal(support.sourceFactIds.includes(fact.factId), !blocked);
      if (blocked) {
        const noble = p.directNobleReview.find(row => row.basis === 'day');
        assert.deepEqual(noble.seats, [{ position: 'annual', pillar: '庚寅', voidSources: [],
          obstructions: [{ target: 'luck', kind: '六冲' }], voidCombinations: [], eligible: false }]);
      }
    }
    const [afterYear] = after.normalizedPayload.majorLuckHistory.bases;
    if (afterYear.birthStatus === 'passed') {
      assert.deepEqual(afterYear.earlierBirth, { pillar: '甲申', start: '2000-10-16T18:00:00.000Z' });
    } else {
      assert.equal(before.normalizedPayload.majorLuckHistory.bases[0].earlierBirth, undefined);
    }
    const withoutHistory = structuredClone(run);
    for (const fact of specific(withoutHistory)) delete fact.normalizedPayload.majorLuckHistoryProfile;
    assert.equal(results(withoutHistory)[1].status, 'unknown');
    const withoutComparison = structuredClone(run);
    for (const fact of specific(withoutComparison)) delete fact.normalizedPayload.majorLuckNaYinRelation;
    assert.equal(results(withoutComparison)[1].status, 'unknown');
    const withoutPolarity = structuredClone(run);
    for (const fact of specific(withoutPolarity)) delete fact.normalizedPayload.majorLuckPolarityCondition;
    assert.equal(results(withoutPolarity)[1].status, 'unknown');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /majorLuckHistory|contentionBeforeBirth|major-luck-history/u);
  }
});

test('p245-001 binds favorable luck direction and matching NaYin to the exact harm interval', () => {
  const chart = archive({ year: 1952, month: 2, day: 5, hour: 0, gender: 1 });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const year = 2051, cut = '2051-11-08T22:00:00.000Z', asOf = Date.UTC(year, 11, 1);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const reference = { snapshotId: 'minor-favorable-transition', chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const [harm] = results(run);
  assert.equal(harm.status, 'partial');
  const facts = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === '辛未');
  const before = facts.find(fact => fact.activeTo === cut), after = facts.find(fact => fact.activeFrom === cut);
  for (const [fact, pillar, eligible] of [[before, '壬辰', false], [after, '辛卯', true]]) {
    const p = fact.normalizedPayload;
    assert.equal(p.luckPillar, pillar);
    assert.equal(p.minorPillar, '丁未');
    assert.equal(p.hasIndependentHarm, true);
    assert.equal(p.majorLuckHistory.majorLuckNaYin.directionMatches, true);
    assert.equal(p.majorLuckHistory.majorLuckNaYin.relation === '同五行', eligible);
    assert.deepEqual(p.majorLuckFavorableBases, eligible ? ['nayin-in-own-direction'] : []);
    assert.equal(harm.sourceFactIds.includes(fact.factId), eligible);
    const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
    assert.match(phrase, eligible ? /符合〈论大运〉所查吉乡条件.*?当步运支得地.*?各自的刑害/u : /独立刑害已核，未见可计入的吉乡条件/u);
  }
  assert.equal(harm.windows[0].start, cut);
  const separated = structuredClone(run);
  for (const { normalizedPayload: p } of specific(separated)) if (p.majorLuckFavorableBases?.length) p.hasIndependentHarm = false;
  assert.deepEqual(results(separated)[0].sourceFactIds, []);
  const withoutPolarity = structuredClone(run);
  for (const fact of specific(withoutPolarity)) delete fact.normalizedPayload.majorLuckPolarityCondition;
  assert.equal(results(withoutPolarity)[0].status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.doesNotMatch(formatFortuneFactAudit(input), /majorLuckFavorableBases|favorableBases|nayin-in-own-direction/u);
});

test('p245 confirmation is cut to the common calendar range and compares every minor method on the same object', () => {
  const examples = [
    { birth: { year: 1989, month: 9, day: 6, hour: 6, gender: 1 }, year: 2037, index: 0,
      pillar: '戊辰', start: '2037-02-14T16:00:00.000Z', date: '2037-02-03T16:00:00.000Z',
      timeZone: 'Etc/GMT-8', proof: 'allMinorMethodsSameNatalHarm',
      fields: { harm: [{ target: 'natal:month', kind: '相刑', pillar: '壬申' }], lu: [] }, text: /同一种相刑或六害/u },
    { birth: { year: 1962, month: 2, day: 7, hour: 18, gender: 0 }, year: 1983, index: 1,
      pillar: '己亥', start: '1983-02-21T00:00:00.000Z', date: '1983-02-03T16:00:00.000Z', proof: 'allMinorMethodsSameLu',
      fields: { harm: [], lu: [{ basis: 'year', stem: '壬' }] }, text: /均到同一已核年干或日干之禄/u },
  ];
  for (const e of examples) {
    const chart = archive(e.birth), params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: e.year } };
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: e.timeZone ?? 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const asOf = Date.UTC(e.year, 11, 1), ref = { snapshotId: 'minor-method-agreement-' + e.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const hit = results(run)[e.index];
    assert.equal(hit.status, 'matched');
    const rows = specific(run), confirmed = rows.find(row => row.normalizedPayload[e.proof] && row.normalizedPayload.luckPillar === e.pillar);
    assert.ok(confirmed, String(e.year));
    assert.deepEqual(confirmed.normalizedPayload.p245Agreement, e.fields);
    assert.equal(confirmed.activeFrom, e.start);
    assert.deepEqual(hit.windows, [{ start: e.start, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    assert.deepEqual(hit.sourceFactIds, [confirmed.factId]);
    assert.ok(rows.some(row => row.activeFrom <= e.date && e.date < row.activeTo && row.normalizedPayload[e.proof] !== true));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
    assert.match(formatFortunePrompt(input), e.text);
    assert.doesNotMatch(formatFortunePrompt(input), /p245Agreement|allMinorMethodsSame/u);
    const conflicting = structuredClone(run);
    conflicting.facts = conflicting.facts.filter(row => row.factId !== confirmed.factId);
    assert.equal(results(conflicting)[e.index].status, 'partial');
  }
});

test('p245-002 confirms shared growth and peak only where all minor methods and both age calendars agree', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1983 } };
  const start = '1983-02-12T16:00:00.000Z', asOf = Date.UTC(1983, 11, 1);
  for (const [day, stem, kind] of [[16, '癸', '帝旺'], [17, '甲', '长生']]) {
    const chart = archive({ year: 1962, month: 3, day, hour: 18, gender: 0 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const ref = { snapshotId: 'minor-growth-agreement-' + day, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
    const hit = results(run)[1];
    const fact = specific(run).find(row => hit.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.allMinorMethodsStemGrowthPhases?.includes(kind));
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.luckPillar, '辛丑');
    assert.deepEqual(p.p245Agreement.stemGrowth, [{ basis: 'day', stem, kind }]);
    assert.deepEqual(p.allMinorMethodsStemGrowthPhases, [kind]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    assert.ok(specific(run).some(row => row.activeFrom < start && row.activeTo > start
      && row.normalizedPayload.annualPillar === '癸亥' && row.normalizedPayload.p245Agreement === undefined));
    assert.equal(hit.confirmedBranches.length, 2);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
    assert.ok(formatFortunePrompt(input).includes('均到同一已核年干或日干的' + kind + '位'));
    assert.doesNotMatch(formatFortunePrompt(input), /allMinorMethodsStemGrowthPhases|p245Agreement/u);
  }
});

test('p245-002 confirms Tianyi only when both minor methods reach the same eligible seat', () => {
  const year = 2021, asOf = Date.UTC(year, 11, 1);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const lunarNewYear = '2021-02-11T16:00:00.000Z';
  for (const [hour, agreeing] of [[2, true], [4, false]]) {
    const chart = archive({ year: 1962, month: 5, day: 12, hour, gender: 1 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const ref = { snapshotId: 'minor-tianyi-agreement-' + hour, chart };
    const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
    const run = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, asOf), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const facts = specific(run).filter(({ normalizedPayload: p }) => p.annualPillar === '辛丑' && p.luckPillar === '辛亥');
    const singles = facts.filter(({ normalizedPayload: p }) => p.p245Agreement === undefined);
    assert.ok(singles.some(({ normalizedPayload: p }) => p.variant === fixedKey && p.minorPillar === '乙丑'));
    assert.ok(singles.some(({ normalizedPayload: p }) => p.variant === hourKey && p.minorPillar === (agreeing ? '丁丑' : '戊寅')));
    for (const { normalizedPayload: p } of singles.filter(({ normalizedPayload: p }) => p.variant === fixedKey || agreeing)) {
      assert.deepEqual(p.commonStemSupport, [{ basis: 'day', stem: '庚', annual: ['天乙'], minor: ['天乙'] }]);
      assert.equal(p.commonHorseSupport, undefined);
    }
    const confirmed = facts.filter(({ normalizedPayload: p }) => p.allMinorMethodsSameDirectNoble);
    const [, hit] = results(run);
    assert.equal(hit.status, agreeing ? 'matched' : 'partial');
    if (!agreeing) {
      assert.deepEqual(confirmed, []);
      assert.ok(singles.some(fact => fact.normalizedPayload.variant === fixedKey && hit.sourceFactIds.includes(fact.factId)));
      continue;
    }
    assert.equal(confirmed.length, 1);
    const [fact] = confirmed;
    assert.equal(fact.activeFrom, lunarNewYear);
    assert.ok(singles.some(row => row.activeFrom < lunarNewYear && lunarNewYear < row.activeTo));
    assert.deepEqual(fact.normalizedPayload.p245Agreement.directNoble, [{ basis: 'day', stem: '庚', branch: '丑' }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: lunarNewYear, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /同一已核年干或日干的天乙/u);
    assert.doesNotMatch(prompt, /allMinorMethodsSameDirectNoble|directNobleReview/u);
  }
});

test('p245-001 confirms a named favorable luck only where the annual and all minor methods share a natal harm', () => {
  const chart = archive({ year: 1950, month: 4, day: 11, hour: 2, gender: 1 });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2003 } };
  const ref = { snapshotId: 'minor-named-favorable', chart }, asOf = Date.UTC(2003, 11, 1);
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
  const [hit] = results(run);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: '2003-02-04T06:05:20.000Z', endExclusive: '2003-12-31T16:00:00.000Z' }]);
  const exact = specific(run).find(row => hit.sourceFactIds.includes(row.factId));
  assert.equal(exact.normalizedPayload.luckPillar, '乙酉');
  assert.deepEqual(exact.normalizedPayload.p245Agreement.namedHarm, {
    sourceCase: 'geng-chen-and-yi-you',
    positions: [{ target: 'natal:day', kind: '六害', pillar: '丙子' }, { target: 'natal:hour', kind: '相刑', pillar: '己丑' }],
  });
  const noAgreement = { ...run, facts: run.facts.filter(row => row.factId !== exact.factId) };
  assert.equal(results(noAgreement)[0].status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
  assert.match(formatFortunePrompt(input), /大运复现卷二明列的一组吉乡干支/u);
  assert.doesNotMatch(formatFortunePrompt(input), /allMinorMethodsNamedFavorableHarm|nayin-in-own-direction/u);
});

test('p245-001 keeps the named favorable cases, water cases, and counterconditions separate', () => {
  const examples = [
    { birth: { year: 1937, month: 2, day: 5, hour: 0, gender: 0 }, year: 1987, luck: '丁未', minor: '癸卯',
      variant: hourKey, favorable: ['ding-chou-to-ding-wei'], exception: false },
    { birth: { year: 1937, month: 3, day: 21, hour: 0, gender: 0 }, year: 1972, luck: '丁未', minor: '丙子',
      variant: hourKey, favorable: [], exception: true },
    { birth: { year: 1939, month: 1, day: 7, hour: 0, gender: 1 }, year: 2059, luck: '丁丑', minor: '丁卯',
      variant: fixedKey, favorable: ['wu-yin-to-ding-chou'] },
    { birth: { year: 1937, month: 2, day: 5, hour: 0, gender: 0 }, year: 1998, luck: '戊申', minor: '甲寅',
      variant: hourKey, favorable: ['earth-metal-water'], chain: 'earth-metal-water' },
    { birth: { year: 1952, month: 3, day: 1, hour: 20, gender: 0 }, year: 1990, luck: '戊戌', minor: '己未',
      variant: hourKey, favorable: ['water-and-fire-branches'], water: true },
    { birth: { year: 1952, month: 2, day: 7, hour: 12, gender: 1 }, year: 1992, luck: '丙午', minor: '丙午',
      variant: fixedKey, favorable: [], conflict: true, water: true },
    { birth: { year: 1952, month: 11, day: 8, hour: 10, gender: 1 }, year: 2023, luck: '戊午', minor: '丁丑',
      variant: fixedKey, favorable: [], conflict: true, water: true, chain: 'fire-earth-water' },
  ];
  for (const sample of examples) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year), [harm] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === sample.variant && p.luckPillar === sample.luck
      && p.minorPillar === sample.minor && p.hasIndependentHarm === true);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload, history = p.majorLuckHistory;
    assert.deepEqual(p.majorLuckFavorableBases, sample.favorable);
    assert.equal(history.favorableConflict, sample.conflict === true);
    assert.equal(harm.sourceFactIds.includes(fact.factId), sample.favorable.length > 0);
    if (sample.exception !== undefined) assert.equal(history.namedMajorExamples[0].dingChouWeiException, sample.exception);
    if (sample.chain) assert.equal(history.waterNaYinLuck.chain, sample.chain);
    if (sample.water) assert.ok(history.waterNaYinLuck.fireBranchReview.candidateBases.length);
    if (sample.conflict) {
      if (!sample.chain) assert.equal(history.waterNaYinLuck.waterLuckReview.candidate, true);
      const text = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
      assert.match(text, /同段同时见吉乡结构与水命牵制例/u);
    }
  }
});

test('p245-001 admits the exact Geng-Chen to Yi-You luck with no overlap or recorded You warning', () => {
  const cases = [
    { birth: { year: 1940, month: 2, day: 5, hour: 20, gender: 1 }, cut: '2009-11-01T10:00:00.000Z',
      luck: '乙酉', minor: '壬申', pillar: '庚辰', position: 'year', eligible: true },
    { birth: { year: 1920, month: 4, day: 5, hour: 12, gender: 1 }, cut: '1970-06-26T02:00:00.000Z',
      luck: '乙酉', minor: '己酉', pillar: '庚辰', position: 'month', eligible: true },
    { birth: { year: 1920, month: 9, day: 9, hour: 20, gender: 0 }, cut: '1961-03-12T08:00:00.000Z',
      luck: '庚辰', minor: '甲辰', pillar: '乙酉', position: 'month', eligible: false, warning: ['month'] },
    { birth: { year: 1920, month: 9, day: 19, hour: 0, gender: 0 }, cut: '1964-04-10T12:00:00.000Z',
      luck: '庚辰', minor: '辛卯', pillar: '乙酉', position: 'month', eligible: false, warning: ['month'], overlap: ['day'] },
  ];
  for (const example of cases) {
    const chart = archive(example.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: Number(example.cut.slice(0, 4)) } };
    const asOf = Date.parse(example.cut), reference = { snapshotId: 'minor-geng-yi-' + example.cut, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const facts = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.minorPillar === example.minor);
    const before = facts.find(row => row.activeTo === example.cut);
    const after = facts.find(row => row.activeFrom === example.cut);
    assert.ok(before && after, example.cut);
    const p = after.normalizedPayload;
    assert.equal(p.confirmed, true);
    assert.equal(p.luckPillar, example.luck);
    assert.equal(p.hasIndependentHarm, true);
    const evidence = p.majorLuckHistory.namedMajorExamples.find(row => row.sourceCase === 'geng-chen-and-yi-you');
    assert.equal(evidence.natalPillar, example.pillar);
    assert.deepEqual(evidence.matchedBases, [example.position]);
    assert.deepEqual(evidence.contacts, ['天干五合', '六合']);
    assert.deepEqual(evidence.yiGengYearYouPositions, example.warning ?? []);
    assert.deepEqual(evidence.luckPillarPositions, example.overlap ?? []);
    assert.equal(p.majorLuckFavorableBases.includes('geng-chen-and-yi-you'), example.eligible);
    assert.ok(!before.normalizedPayload.majorLuckFavorableBases.includes('geng-chen-and-yi-you'));
    const [hit] = results(run);
    assert.equal(hit.sourceFactIds.includes(after.factId), example.eligible);
    if (example.eligible) {
      assert.equal(hit.status, 'partial');
      assert.equal(hit.windows[0].start, example.cut);
      assert.match(describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String), /原局单见庚辰或乙酉.{0,25}天干、地支均合/u);
    }
  }
  const doubled = archive({ year: 1940, month: 4, day: 6, hour: 12, gender: 1 }).bazi.rawResult[0];
  assert.ok(doubled.luckPeriods.some(stage => stage.ganZhi === '乙酉'));
  const history = smthMinorMajorLuckHistory(doubled, '己丑', '乙酉', []);
  const [comparison] = history.namedMajorExamples;
  assert.deepEqual(comparison.matchedBases, ['year', 'month']);
  assert.deepEqual(comparison.yiGengYearYouPositions, []);
  assert.ok(!history.favorableBases.includes('geng-chen-and-yi-you'));
});

test('p245-002 keeps the named Bing-Zi and Ren-Yin pressure alongside favorable evidence and requires shared support', () => {
  const chart = archive({ year: 1936, month: 5, day: 7, hour: 12, gender: 1 });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const run = calculate(chart, 2034), [, support] = results(run);
  const facts = specific(run).filter(({ normalizedPayload: p }) => p.annualPillar === '甲寅' && p.luckPillar === '壬寅');
  const fixed = facts.find(({ normalizedPayload: p }) => p.variant === fixedKey);
  const hour = facts.find(({ normalizedPayload: p }) => p.variant === hourKey);
  assert.ok(fixed && hour);
  for (const { normalizedPayload: p } of [fixed, hour]) {
    assert.equal(p.confirmed, true);
    assert.equal(p.hasMajorLuck, true);
    assert.deepEqual(p.majorLuckAdverseCases, ['bing-zi-to-ren-yin']);
    assert.deepEqual(p.majorLuckFavorableBases, ['water-and-fire-branches']);
    const [example] = p.majorLuckHistory.namedAdverseExamples;
    assert.deepEqual([example.natalPillar, example.luckPillar, example.matchedBases, example.stemRelation],
      ['丙子', '壬寅', ['year'], '后克前']);
    assert.ok(example.contacts.includes('天干四冲'));
  }
  assert.equal(fixed.normalizedPayload.minorPillar, '甲辰');
  assert.equal(fixed.normalizedPayload.hasSharedNobleCombinationSupport, true);
  assert.notEqual(hour.normalizedPayload.hasSharedNobleCombinationSupport, true);
  assert.equal(support.status, 'partial');
  assert.ok(support.sourceFactIds.includes(fixed.factId));
  assert.ok(!support.sourceFactIds.includes(hour.factId));
  const hourAudit = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: hour.normalizedPayload }, String);
  assert.match(hourAudit, /实际运壬克年丙/u);
  assert.doesNotMatch(hourAudit, /此版同段太岁和小运均有原书同源支持/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-major-pressures'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /实际运壬克年丙/u);
  assert.match(prompt, /另核同一步大运的吉乡依据/u);
  assert.match(prompt, /此版同段太岁和小运均有原书同源支持/u);
  assert.doesNotMatch(prompt, /namedAdverseExamples|bing-zi-to-ren-yin/u);
});

test('p245-002 requires actual same-stage contention before birth phase as well as shared support', () => {
  const samples = [
    { birth: { year: 1952, month: 2, day: 5, hour: 14, gender: 1 }, year: 1971,
      cut: '1971-11-20T20:00:00.000Z', annual: '辛亥', minor: '乙卯',
      stages: [['癸卯', [], ['not-reached', 'not-reached']], ['甲辰', ['year-nayin', 'day-stem'], ['not-reached', 'not-reached']]],
      unrelatedClash: true },
    { birth: { year: 1952, month: 2, day: 7, hour: 0, gender: 1 }, year: 2011,
      cut: '2011-06-01T06:00:00.000Z', annual: '辛卯', minor: '壬子',
      stages: [['丁未', ['year-nayin'], ['not-reached', 'passed']], ['戊申', [], ['current-stage', 'passed']]] },
    { birth: { year: 1953, month: 2, day: 5, hour: 12, gender: 0 }, year: 2022,
      cut: '2022-08-30T08:00:00.000Z', annual: '壬寅', minor: '丙辰',
      stages: [['庚申', ['day-stem'], ['current-stage', 'not-reached']], ['辛酉', [], ['passed', 'current-stage']]] },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 6, 1);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-weak-and-supported-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    assert.equal(support.status, 'partial');
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual);
    const before = rows.find(fact => fact.activeTo === sample.cut), after = rows.find(fact => fact.activeFrom === sample.cut);
    for (const [fact, [luck, weak, birthStates]] of [[before, sample.stages[0]], [after, sample.stages[1]]]) {
      const p = fact.normalizedPayload, history = p.majorLuckHistory;
      assert.equal(p.luckPillar, luck);
      assert.equal(p.minorPillar, sample.minor);
      assert.ok(p.hasSharedSourceSupport || p.hasSharedCanopySupport || p.hasSharedNobleCombinationSupport);
      assert.deepEqual(p.majorLuckWeakBases, weak);
      assert.deepEqual(history.bases.map(row => row.birthStatus), birthStates);
      assert.equal(support.sourceFactIds.includes(fact.factId), weak.length > 0);
      if (weak.length) assert.ok(history.clashes.length + history.controls.length > 0);
      const text = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
      assert.match(text, weak.length ? /实际岁运同对见刑冲克破，并见太岁与本版小运的共同支持/u
        : /本段可见太岁与本版小运的共同支持，未见所查的未历长生兼岁运刑冲克破/u);
    }
    if (sample.unrelatedClash) {
      const p = before.normalizedPayload;
      assert.ok(p.annualContacts.some(row => row.target === 'natal:day' && row.kind === '六冲'));
      assert.deepEqual(p.majorLuckHistory.clashes, []);
      assert.deepEqual(p.majorLuckHistory.controls, []);
    }
    const withoutWeakWindow = structuredClone(run);
    for (const fact of specific(withoutWeakWindow)) fact.normalizedPayload.majorLuckAdverseCases = [];
    assert.deepEqual(results(withoutWeakWindow)[1].sourceFactIds, []);
    const separated = structuredClone(run);
    for (const { normalizedPayload: p } of specific(separated)) if (p.majorLuckAdverseCases?.length) {
      p.hasSharedSourceSupport = false;
      p.hasSharedCanopySupport = false;
      p.hasSharedNobleCombinationSupport = false;
      p.hasSharedMoonVirtueSupport = false;
      p.hasSharedHeavenVirtueSupport = false;
    }
    assert.deepEqual(results(separated)[1].sourceFactIds, []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.doesNotMatch(formatFortuneFactAudit(input), /majorLuckWeakBases|weakBases/u);
  }
});

test('p245-002 starts matching a same-stage bathing blade and support on the actual luck transition', () => {
  const samples = [
    { birth: { year: 1952, month: 5, day: 18, hour: 0, gender: 1 }, year: 2018, cut: '2018-09-29T08:00:00.000Z',
      annual: '戊戌', minor: '壬申', before: '辛亥', after: '壬子', seat: { position: 'luck', pillar: '壬子' }, blade: '子' },
    { birth: { year: 1954, month: 2, day: 5, hour: 0, gender: 1 }, year: 2023, cut: '2023-11-28T16:00:00.000Z',
      annual: '癸卯', minor: '乙亥', before: '壬申', after: '癸酉', seat: { position: 'annual', pillar: '癸卯' }, blade: '卯' },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 11, 1);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-bathing-blade-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    assert.equal(support.status, 'partial');
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === fixedKey && p.annualPillar === sample.annual);
    const before = rows.find(fact => fact.activeTo === sample.cut), after = rows.find(fact => fact.activeFrom === sample.cut);
    for (const [fact, stage, matched] of [[before, sample.before, false], [after, sample.after, true]]) {
      const p = fact.normalizedPayload;
      assert.equal(p.luckPillar, stage);
      assert.equal(p.minorPillar, sample.minor);
      assert.ok(p.hasSharedSourceSupport || p.hasSharedCanopySupport || p.hasSharedNobleCombinationSupport);
      assert.deepEqual(p.majorLuckWeakBases, []);
      assert.deepEqual(p.majorLuckAdverseCases, matched ? ['bathing-blade-contention'] : []);
      assert.equal(support.sourceFactIds.includes(fact.factId), matched);
    }
    const p = after.normalizedPayload, review = p.majorLuckHistory.bathingBladeReview;
    assert.deepEqual(review.bases, ['day-stem']);
    assert.deepEqual(review.seats, [sample.seat]);
    assert.equal(review.bladeBranch, sample.blade);
    assert.equal(review.hasXingOrControl, true);
    assert.equal(review.candidate, true);
    const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
    assert.match(phrase, /本段入败地后见同对刑克和羊刃，并见太岁与本版小运的共同支持/u);
    const separated = structuredClone(run);
    for (const { normalizedPayload: payload } of specific(separated)) if (payload.majorLuckAdverseCases?.length) {
      payload.hasSharedSourceSupport = false;
      payload.hasSharedCanopySupport = false;
      payload.hasSharedNobleCombinationSupport = false;
      payload.hasSharedMoonVirtueSupport = false;
      payload.hasSharedHeavenVirtueSupport = false;
    }
    assert.ok(!results(separated)[1].sourceFactIds.includes(after.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /上一正式大运长生，当步进入沐浴败地/u);
    assert.doesNotMatch(prompt, /bathingBladeReview|majorLuckAdverseCases|bathing-blade-contention/u);
  }
});

test('p245-002 bathing blades require actual Xing or control and keep a flying blade separate', () => {
  const samples = [
    { birth: { year: 1952, month: 2, day: 14, hour: 6, gender: 1 }, year: 2020, annual: '庚子', minor: '戊子', luck: '己酉',
      basis: 'year-nayin', blades: [{ position: 'annual', pillar: '庚子' }], flying: [], xingOrControl: false },
    { birth: { year: 1952, month: 3, day: 14, hour: 0, gender: 0 }, year: 2014, annual: '甲午', minor: '辛酉', luck: '丙申',
      basis: 'day-stem', blades: [], flying: [{ position: 'annual', pillar: '甲午' }], xingOrControl: true },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year), [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.luckPillar === sample.luck
      && p.annualPillar === sample.annual && p.minorPillar === sample.minor);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload, review = p.majorLuckHistory.bathingBladeReview;
    assert.ok(p.hasSharedSourceSupport || p.hasSharedCanopySupport || p.hasSharedNobleCombinationSupport);
    assert.deepEqual(p.majorLuckWeakBases, []);
    assert.deepEqual(p.majorLuckAdverseCases, []);
    assert.deepEqual(review.bases, [sample.basis]);
    assert.deepEqual(review.seats, sample.blades);
    assert.deepEqual(review.flyingSeats, sample.flying);
    assert.equal(review.hasXingOrControl, sample.xingOrControl);
    assert.equal(review.candidate, false);
    assert.ok(!support.sourceFactIds.includes(fact.factId));
    if (!sample.xingOrControl) assert.deepEqual(p.majorLuckHistory.clashes, ['六破']);
  }
});

test('p245-002 reads the two opposed Jie and Wang seats from all twelve natal year branches', () => {
  const groups = [
    { years: ['甲申', '甲子', '甲辰'], jie: '辛巳', wang: '癸亥' },
    { years: ['甲寅', '甲午', '甲戌'], jie: '癸亥', wang: '辛巳' },
    { years: ['乙巳', '乙酉', '乙丑'], jie: '丙寅', wang: '壬申' },
    { years: ['乙亥', '乙卯', '乙未'], jie: '壬申', wang: '丙寅' },
  ];
  const prior = [{ pillar: '癸巳', start: Date.UTC(2010, 0, 1) }];
  for (const { years, jie, wang } of groups) for (const year of years) {
    const natal = { year, month: '己卯', day: '庚子', hour: '壬午' };
    for (const [annual, star] of [[jie, '劫煞'], [wang, '亡神']]) {
      const review = smthMinorMajorLuckHistory(natal, annual, '甲午', prior).bathingJieWangReview;
      assert.equal(review.yearPillar, year);
      assert.equal(review.jieBranch, jie[1]);
      assert.equal(review.wangBranch, wang[1]);
      assert.deepEqual(review.seats.map(({ position, pillar, star }) => ({ position, pillar, star })),
        [{ position: 'annual', pillar: annual, star }]);
    }
  }
});

test('p245-002 matches a Jie or Wang seat controlling the natal year on the actual bathing transition', () => {
  const samples = [
    { birth: { year: 1955, month: 12, day: 5, hour: 12, gender: 0 }, year: 2016, cut: '2016-11-01T00:00:00.000Z',
      annual: '丙申', minor: '甲申', before: '癸巳', after: '甲午', yearPillar: '乙未', yearNaYin: '沙中金',
      seat: { position: 'annual', pillar: '丙申', star: '劫煞', naYin: '山下火', naYinRelation: '前克后' } },
    { birth: { year: 1964, month: 6, day: 21, hour: 6, gender: 0 }, year: 2029, cut: '2029-07-20T00:00:00.000Z',
      annual: '己酉', minor: '乙酉', before: '甲子', after: '癸亥', yearPillar: '甲辰', yearNaYin: '覆灯火',
      seat: { position: 'luck', pillar: '癸亥', star: '亡神', naYin: '大海水', naYinRelation: '前克后' } },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 11, 1);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-bathing-jie-wang-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual);
    const before = rows.find(fact => fact.activeTo === sample.cut), after = rows.find(fact => fact.activeFrom === sample.cut);
    assert.equal(support.status, 'partial');
    assert.ok(before && after, sample.cut);
    for (const [fact, stage, matched] of [[before, sample.before, false], [after, sample.after, true]]) {
      const p = fact.normalizedPayload;
      assert.equal(p.luckPillar, stage);
      assert.equal(p.minorPillar, sample.minor);
      assert.ok(p.hasSharedSourceSupport || p.hasSharedCanopySupport || p.hasSharedNobleCombinationSupport);
      assert.deepEqual(p.majorLuckAdverseCases, matched ? ['bathing-jie-wang-contention'] : []);
      assert.equal(support.sourceFactIds.includes(fact.factId), matched);
    }
    const { majorLuckHistory } = after.normalizedPayload, review = majorLuckHistory.bathingJieWangReview;
    assert.equal(majorLuckHistory.bathingBladeReview.candidate, false);
    assert.equal(review.yearPillar, sample.yearPillar);
    assert.equal(review.yearNaYin, sample.yearNaYin);
    assert.deepEqual(review.seats, [sample.seat]);
    assert.equal(review.hasXingOrControl, true);
    assert.equal(review.candidate, true);
    const withoutSameMethod = structuredClone(run);
    const { normalizedPayload: unpaired } = specific(withoutSameMethod).find(fact => fact.factId === after.factId);
    unpaired.hasSharedSourceSupport = false;
    unpaired.hasSharedCanopySupport = false;
    unpaired.hasSharedNobleCombinationSupport = false;
    unpaired.hasSharedMoonVirtueSupport = false;
    unpaired.hasSharedHeavenVirtueSupport = false;
    assert.ok(!results(withoutSameMethod)[1].sourceFactIds.includes(after.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(sample.seat.pillar + '实落' + sample.seat.star));
    assert.match(prompt, /该煞位柱纳音克年命/u);
    assert.match(prompt, /入败地后见岁运同对刑克及劫煞或亡神实位克年/u);
    assert.doesNotMatch(prompt, /bathingJieWangReview|naYinRelation|bathing-jie-wang-contention/u);
  }
});

test('p245-002 keeps Jie and Wang position, directed NaYin control, and same-pair Xing or control separate', () => {
  const samples = [
    { birth: { year: 1951, month: 4, day: 5, hour: 6, gender: 1 }, year: 2058, annual: '戊寅', luck: '辛巳', minor: '辛卯',
      variant: hourKey, star: '亡神', relation: '后克前', xingOrControl: true, luckControlsYear: true, phrase: '年命纳音反克该煞位柱' },
    { birth: { year: 1950, month: 2, day: 5, hour: 6, gender: 1 }, year: 2049, annual: '己巳', luck: '戊子', minor: '乙巳',
      variant: fixedKey, star: '亡神', relation: '同五行', xingOrControl: true, phrase: '两柱纳音同五行' },
    { birth: { year: 1950, month: 10, day: 5, hour: 18, gender: 1 }, year: 1971, annual: '辛亥', luck: '戊子', minor: '丁亥',
      variant: fixedKey, star: '劫煞', relation: '前克后', xingOrControl: false, phrase: '该煞位柱纳音克年命' },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year), [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === sample.variant && p.annualPillar === sample.annual
      && p.luckPillar === sample.luck && p.minorPillar === sample.minor);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload, review = p.majorLuckHistory.bathingJieWangReview;
    assert.ok(p.hasSharedSourceSupport || p.hasSharedCanopySupport || p.hasSharedNobleCombinationSupport);
    assert.deepEqual(p.majorLuckAdverseCases, []);
    assert.deepEqual(review.seats.map(({ position, pillar, star, naYinRelation }) => ({ position, pillar, star, naYinRelation })),
      [{ position: 'annual', pillar: sample.annual, star: sample.star, naYinRelation: sample.relation }]);
    assert.equal(review.hasXingOrControl, sample.xingOrControl);
    assert.equal(review.candidate, false);
    if (sample.luckControlsYear) assert.equal(p.majorLuckHistory.majorLuckNaYin.relation, '后克前');
    assert.ok(!support.sourceFactIds.includes(fact.factId));
    const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
    assert.ok(phrase.includes(sample.phrase));
    assert.doesNotMatch(phrase, /入败地后见岁运同对刑克及劫煞或亡神实位克年/u);
  }
});

test('p245-002 reads the four Moon Virtue stem pairs and counters from the natal month', () => {
  const groups = [
    ['寅午戌', '丙', '辛', '壬'], ['亥卯未', '甲', '己', '庚'],
    ['申子辰', '壬', '丁', '戊'], ['巳酉丑', '庚', '乙', '丙'],
  ];
  for (const [branches, stem, partner, taboo] of groups) for (const month of branches) {
    assert.deepEqual(smthMoonVirtueRule(month), { branches, stem, partner, taboo });
  }
});

test('p245-002 matches Moon Virtue only while its own method and adverse luck conditions overlap without an exposed counter', () => {
  const chart = archive({ year: 1950, month: 6, day: 5, hour: 12, gender: 1 });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const natal = chart.bazi.rawResult[0];
  assert.ok(describeBaZiPillar(natal.month).hiddenStems.some(row => row.stem === '丙'));
  const cases = [
    { year: 1990, annual: '庚午', minor: '乙亥', before: '乙酉', after: '丙戌', supported: [true, false], adverse: [true, true] },
    { year: 2000, annual: '庚辰', minor: '乙酉', before: '丙戌', after: '丁亥', supported: [false, true], adverse: [true, true] },
    { year: 2010, annual: '庚寅', minor: '乙未', before: '丁亥', after: '戊子', supported: [true, true], adverse: [true, false] },
  ];
  for (const sample of cases) {
    const cut = sample.year + '-10-19T10:00:00.000Z', asOf = Date.parse(cut) - 1;
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-moon-virtue-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual);
    const before = rows.find(fact => fact.activeTo === cut), after = rows.find(fact => fact.activeFrom === cut);
    assert.equal(support.status, 'partial');
    assert.ok(before && after, cut);
    for (const [index, fact, stage] of [[0, before, sample.before], [1, after, sample.after]]) {
      const p = fact.normalizedPayload, review = p.moonVirtueReview;
      assert.equal(p.luckPillar, stage);
      assert.equal(p.minorPillar, sample.minor);
      assert.equal(p.moonVirtueProfile, baziMinorLuckPolicy.moonVirtue);
      assert.ok(!p.hasSharedSourceSupport && !p.hasSharedCanopySupport && !p.hasSharedNobleCombinationSupport);
      assert.equal(review.monthBranch, '巳');
      assert.equal(review.paired, true);
      assert.deepEqual(review.seats, [{ id: 'annual', pillar: sample.annual }, { id: 'minor', pillar: sample.minor }]);
      assert.deepEqual(review.obstructions, sample.supported[index] ? [] : [{ id: 'luck', pillar: '丙戌' }]);
      assert.equal(p.hasSharedMoonVirtueSupport, sample.supported[index]);
      assert.equal(Boolean(p.majorLuckAdverseCases.length), sample.adverse[index]);
      assert.equal(support.sourceFactIds.includes(fact.factId), sample.supported[index] && sample.adverse[index]);
      const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
      assert.match(phrase, sample.supported[index] ? /同段未见所列忌干，记共同支持候选/u : /实际透干在同段大运丙戌/u);
    }
    assert.ok(specific(run).filter(fact => fact.normalizedPayload.variant !== hourKey)
      .every(fact => fact.normalizedPayload.hasSharedMoonVirtueSupport === false));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /本命巳月取庚为月德，合干乙，忌丙/u);
    assert.doesNotMatch(prompt, /moonVirtueReview|hasSharedMoonVirtueSupport|smth-month-virtue-stem-pair/u);
  }
});

test('p245-002 records reversed Moon Virtue partners, natal counters and repeated stems without false matches', () => {
  const cases = [
    { birth: { year: 1950, month: 12, day: 5, hour: 0, gender: 0 }, year: 1969, annual: '己酉', minor: '甲辰',
      stage: '乙酉', paired: true, obstructions: [{ id: 'natal:year', pillar: '庚寅' }] },
    { birth: { year: 1950, month: 6, day: 5, hour: 6, gender: 0 }, year: 1970, annual: '庚戌', minor: '庚午',
      stage: '己卯', paired: false, obstructions: [] },
  ];
  for (const sample of cases) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year), [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual
      && p.minorPillar === sample.minor && p.luckPillar === sample.stage);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload, review = p.moonVirtueReview;
    assert.deepEqual(review.seats, [{ id: 'annual', pillar: sample.annual }, { id: 'minor', pillar: sample.minor }]);
    assert.equal(review.paired, sample.paired);
    assert.deepEqual(review.obstructions, sample.obstructions);
    assert.ok(p.majorLuckAdverseCases.length > 0);
    assert.equal(p.hasSharedMoonVirtueSupport, false);
    assert.ok(!support.sourceFactIds.includes(fact.factId));
  }
});

test('p245-002 retains the eight Heaven Virtue stem pairs and their named counters', () => {
  const cases = [['寅', '丁', '壬', '癸'], ['辰', '壬', '丁', '戊'], ['巳', '辛', '丙', '丁'], ['未', '甲', '己', '庚'],
    ['申', '癸', '戊', '己'], ['戌', '丙', '辛', '壬'], ['亥', '乙', '庚', '辛'], ['丑', '庚', '乙', '丙']];
  for (const [month, stem, partner, taboo] of cases) assert.deepEqual(smthHeavenVirtueStemRule(month), { stem, partner, taboo });
  for (const month of '卯午酉子') assert.equal(smthHeavenVirtueStemRule(month), undefined);
});

test('p245-002 matches Heaven Virtue only while its stem pair, birth month general and actual luck segment agree', () => {
  const samples = [
    { hour: 0, year: 1986, variant: openingKey, cut: '1986-05-05T08:00:00.000Z', annual: '丙寅', minor: '辛酉',
      before: '丙申', after: '丁酉', matchedAfter: false },
    { hour: 6, year: 1996, variant: hourKey, cut: '1996-04-04T14:00:00.000Z', annual: '丙子', minor: '辛丑',
      before: '丁酉', after: '戊戌', matchedAfter: true },
  ];
  for (const sample of samples) {
    const chart = archive({ year: 1951, month: 5, day: 23, hour: sample.hour, gender: 0 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const asOf = Date.parse(sample.cut) + (sample.matchedAfter ? 0 : -1);
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-heaven-virtue-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    const rows = specific(run).filter(({ normalizedPayload: p }) => p.variant === sample.variant && p.annualPillar === sample.annual);
    const before = rows.find(fact => fact.activeTo === sample.cut), after = rows.find(fact => fact.activeFrom === sample.cut);
    assert.ok(before && after, sample.cut);
    assert.equal(support.status, 'partial');
    for (const [fact, stage, matched] of [[before, sample.before, !sample.matchedAfter], [after, sample.after, sample.matchedAfter]]) {
      const p = fact.normalizedPayload, review = p.heavenVirtueReview;
      assert.equal(p.luckPillar, stage);
      assert.equal(p.minorPillar, sample.minor);
      assert.ok(!p.hasSharedSourceSupport && !p.hasSharedCanopySupport && !p.hasSharedNobleCombinationSupport && !p.hasSharedMoonVirtueSupport);
      assert.deepEqual(p.majorLuckAdverseCases, ['unreached-birth-contention']);
      assert.equal(review.paired, true);
      assert.deepEqual(review.seats, [{ id: 'annual', pillar: sample.annual }, { id: 'minor', pillar: sample.minor }]);
      assert.deepEqual(review.obstructions, matched ? [] : [{ id: 'luck', pillar: '丁酉' }]);
      assert.equal(review.monthGeneral.middleTerm, '小满');
      assert.equal(review.monthGeneral.actualBranch, '申');
      assert.equal(review.monthGeneral.expectedBranch, '申');
      assert.equal(review.monthGeneral.matchesHeavenVirtueGeneral, true);
      assert.equal(p.hasSharedHeavenVirtueSupport, matched);
      assert.equal(support.sourceFactIds.includes(fact.factId), matched);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /本命巳月取辛为天德，合干丙，忌丁/u);
    assert.match(prompt, /出生中气所取月将为申，本命月建的天德喜将为申/u);
    assert.doesNotMatch(prompt, /heavenVirtueReview|hasSharedHeavenVirtueSupport|matchesHeavenVirtueGeneral/u);
  }
});

test('p245-002 keeps a nonmatching birth general and Heaven Virtue branch directions as evidence without a stem match', () => {
  const samples = [
    { birth: { year: 1950, month: 2, day: 13, hour: 0, gender: 1 }, year: 1967, annual: '丁未', minor: '壬午', luck: '庚辰' },
    { birth: { year: 1950, month: 6, day: 13, hour: 0, gender: 0 }, year: 1962, annual: '壬寅', minor: '辛亥', luck: '庚辰',
      direction: { monthBranch: '午', trigram: '乾', partner: '艮', pairedBranches: '寅亥' } },
    { birth: { year: 1950, month: 12, day: 13, hour: 18, gender: 1 }, year: 1968, annual: '戊申', minor: '戊辰', luck: '庚寅',
      direction: { monthBranch: '子', trigram: '巽', partner: '坤', pairedBranches: '申辰' } },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year), [, support] = results(run);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.annualPillar === sample.annual
      && p.minorPillar === sample.minor && p.luckPillar === sample.luck);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload;
    assert.deepEqual(p.majorLuckAdverseCases, ['unreached-birth-contention']);
    assert.equal(p.hasSharedHeavenVirtueSupport, false);
    assert.ok(!support.sourceFactIds.includes(fact.factId));
    const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
    if (sample.direction) {
      assert.deepEqual(p.heavenVirtueDirectionReview, sample.direction);
      assert.equal(p.heavenVirtueReview, undefined);
      assert.ok(phrase.includes('实际岁支与本版小运支见' + sample.direction.pairedBranches));
    } else {
      assert.equal(p.heavenVirtueReview.paired, true);
      assert.deepEqual(p.heavenVirtueReview.obstructions, []);
      assert.equal(p.heavenVirtueReview.monthGeneral.matchesHeavenVirtueGeneral, false);
      assert.match(phrase, /出生中气所取月将为子，本命月建的天德喜将为亥/u);
    }
  }
});

test('client facts preserve the shared year-horse combination and never fill a different minor method from it', () => {
  const example = { year: 1988, month: 6, day: 2, hour: 6, gender: 1 };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2019 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), input = { snapshotId: 'minor-horse-chart', chart: archive(example) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, input)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'minor-horse-run', input);
  validateFortuneFacts(run);
  const [, support] = results(run);
  assert.equal(support.status, 'not_matched');
  const witnesses = specific(run).filter(({ normalizedPayload: p }) => p.annualPillar === '己亥' && p.hasSharedSourceSupport === true);
  assert.equal(witnesses.length, 2);
  assert.equal(witnesses[0].activeFrom, '2019-02-04T03:14:21.000Z');
  assert.ok(witnesses.every(({ normalizedPayload: p }) => p.annualPillar === '己亥' && p.minorPillar === '丁亥' && p.variant === hourKey
    && p.commonHorseSupport === 'both_combine_with_horse' && p.commonStemSupport.length === 0));
  assert.ok(witnesses.every(({ normalizedPayload: p }) => p.majorLuckWeakBases.length === 0));

  const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-horse-report'));
  const prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /太岁支与本版小运支均在亥，分别六合本命年支驿马位寅/u);
  assert.doesNotMatch(prompt, /p245MatchProfile|commonHorseSupport|harmEvidence|both_combine_with_horse/u);
  assert.ok(modelInput.sections.every(section => section.findings.every(row => row.knowledgeId !== support.knowledgeId)));

  const wrongClock = archive(example); wrongClock.bazi.rawResult[0].hour = '辛卯';
  const unverified = calculate(wrongClock, 2019);
  assert.ok(specific(unverified).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.hasSharedSourceSupport
    && !row.normalizedPayload.p245MatchProfile));
  assert.ok(results(unverified).every(row => row.status === 'unknown'));
  const [noHarm, noSupport] = results(calculate(archive(), 2020));
  assert.equal(noHarm.status, 'not_matched');
  assert.equal(noSupport.status, 'unknown');
  assert.deepEqual(noSupport.sourceFactIds, []);
});

test('the Tongxuan birth-solstice noble branch reaches SQLite independently of growth, Lu and horse', () => {
  const chart = archive({ year: 1984, month: 3, day: 15, hour: 22, gender: 1 });
  const run = calculate(chart, 2015), [, support] = results(run);
  const facts = specific(run).filter(f => f.normalizedPayload.annualPillar === '乙未');
  const hits = facts.filter(f => support.sourceFactIds.includes(f.factId));
  assert.equal(support.status, 'partial');
  assert.equal(hits.length, 1);
  const p = hits[0].normalizedPayload;
  assert.equal(hits[0].activeFrom, '2015-02-04T03:58:27.000Z');
  assert.equal(p.variant, hourKey);
  assert.equal(p.nobleSeason, '阳贵');
  assert.equal(p.commonHorseSupport, undefined);
  assert.deepEqual(p.commonStemSupport, [{ basis: 'year', stem: '甲', annual: ['天乙'], minor: ['天乙'] }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-tianyi-report'));
  assert.match(formatFortuneFactAudit(input), /太岁支到天乙，小运支到天乙。天乙按卷三通玄经一说，以出生时的冬夏至取阳贵/u);
});

test('the Tongxuan noble seats and weak-luck premise are checked independently at an actual transition', () => {
  const samples = [
    { birth: { year: 1952, month: 2, day: 10, hour: 6, gender: 0 }, year: 2023,
      cut: '2023-10-15T14:00:00.000Z', annual: '癸卯', minor: '己卯', before: '乙未', after: '甲午',
      basis: 'year', stem: '壬', blocked: 'after', kind: '六破', weak: ['day-stem'], outcome: 'partial' },
    { birth: { year: 1954, month: 7, day: 14, hour: 14, gender: 0 }, year: 2026,
      cut: '2026-09-22T16:00:00.000Z', annual: '丙午', minor: '壬午', before: '甲子', after: '癸亥',
      basis: 'day', stem: '辛', blocked: 'before', kind: '六冲', weak: [], outcome: 'not_matched' },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth), asOf = Date.UTC(sample.year, 6, 1);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const reference = { snapshotId: 'minor-noble-seat-' + sample.year, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const [, support] = results(run);
    assert.equal(support.status, sample.outcome);
    const facts = specific(run).filter(row => row.normalizedPayload.variant === hourKey);
    const before = facts.find(row => row.activeTo === sample.cut), after = facts.find(row => row.activeFrom === sample.cut);
    for (const [side, fact] of [['before', before], ['after', after]]) {
      const p = fact.normalizedPayload, active = side !== sample.blocked;
      assert.equal(p.luckPillar, sample[side]);
      assert.equal(p.directNobleProfile, baziMinorLuckPolicy.directNoble);
      assert.equal(p.hasSharedSourceSupport, active);
      assert.equal(p.hasSharedCanopySupport, false);
      assert.equal(p.hasSharedNobleCombinationSupport, false);
      assert.deepEqual(p.majorLuckWeakBases, sample.weak);
      assert.equal(support.sourceFactIds.includes(fact.factId), active && sample.weak.length > 0);
      assert.deepEqual(p.commonStemSupport, active ? [{ basis: sample.basis, stem: sample.stem, annual: ['天乙'], minor: ['天乙'] }] : []);
      const review = p.directNobleReview.find(row => row.basis === sample.basis);
      assert.equal(review.nobleBranch, sample.annual[1]);
      assert.deepEqual(review.seats, [['annual', sample.annual], ['minor', sample.minor]].map(([position, pillar]) => ({
        position, pillar, voidSources: [], obstructions: active ? [] : [{ target: 'luck', kind: sample.kind }],
        voidCombinations: [], eligible: active,
      })));
      if (!active) {
        const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
        assert.match(phrase, new RegExp('天乙实位.*该位遇同段大运的' + sample.kind, 'u'));
      }
    }
    const withoutReview = structuredClone(run);
    for (const fact of specific(withoutReview)) delete fact.normalizedPayload.directNobleProfile;
    const withoutWitnesses = results(withoutReview)[1].sourceFactIds;
    assert.ok(![before, after].some(fact => withoutWitnesses.includes(fact.factId)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /天乙实位/u);
    assert.doesNotMatch(prompt, /directNobleReview|directNobleProfile|noble-seat-obstructions/u);
  }
});

test('void Tongxuan noble seats retain same-seat combinations and leave independent growth support in place', () => {
  const samples = [
    { birth: { year: 1952, month: 3, day: 6, hour: 6, gender: 0 }, year: 1975, annual: '乙卯', minor: '丁卯',
      luck: '庚子', basis: 'year', voidBasis: 'day', combined: false, status: false },
    { birth: { year: 1952, month: 2, day: 18, hour: 6, gender: 1 }, year: 1979, annual: '己未', minor: '乙未',
      luck: '乙巳', basis: 'day', voidBasis: 'year', combined: true, status: false },
    { birth: { year: 1952, month: 8, day: 5, hour: 14, gender: 1 }, year: 1971, annual: '辛亥', minor: '己卯',
      luck: '己酉', basis: 'day', combined: false, status: true },
  ];
  for (const sample of samples) {
    const chart = archive(sample.birth);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.year);
    const fact = specific(run).find(({ normalizedPayload: p }) => p.variant === hourKey && p.luckPillar === sample.luck
      && p.annualPillar === sample.annual && p.minorPillar === sample.minor);
    assert.ok(fact, String(sample.year));
    const p = fact.normalizedPayload, review = p.directNobleReview.find(row => row.basis === sample.basis);
    assert.ok(review.seats.every(seat => !seat.eligible));
    if (sample.voidBasis) {
      assert.equal(review.seats.length, 2);
      for (const seat of review.seats) {
        assert.deepEqual(seat.voidSources.map(row => row.basis), [sample.voidBasis]);
        assert.deepEqual(seat.voidCombinations, sample.combined ? [{ target: 'natal:day', kind: '六合' }] : []);
      }
    } else {
      assert.equal(review.seats.length, 1);
      assert.equal(review.seats[0].position, 'minor');
      assert.deepEqual(review.seats[0].obstructions, [{ target: 'luck', kind: '六冲' }]);
    }
    assert.equal(p.hasSharedSourceSupport, sample.status);
    assert.deepEqual(p.commonStemSupport, sample.status ? [{ basis: 'day', stem: '癸', annual: ['帝旺'], minor: ['长生'] }] : []);
    if (sample.status) assert.deepEqual(p.majorLuckWeakBases, []);
    assert.ok(!results(run)[1].sourceFactIds.includes(fact.factId));
    if (sample.combined) {
      const phrase = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: p }, String);
      assert.match(phrase, /本命年柱甲申旬空.*同一空位还与本命日柱六合，实际合解待核/u);
    }
  }
});

test('pre-luck childhood does not fabricate a major stage; missing archives, unknown time and multiple candidates do not become confirmed minor methods', () => {
  const childhood = calculate(archive(), 1990), facts = specific(childhood), birth = archive().bazi.rawResult[0].utc;
  assert.ok(facts.length && facts.every(f => f.activeFrom >= birth && !f.normalizedPayload.hasMajorLuck));
  assert.ok(facts.some(f => f.activeFrom === birth && f.normalizedPayload.ordinal === 1));
  assert.ok(results(childhood).every(r => r.status === 'not_matched'));
  for (const change of [chart => { chart.bazi.rawResult[0].luckPeriods.pop(); }, chart => { chart.timeKnown = false; },
    chart => { chart.bazi.rawResult.push(structuredClone(chart.bazi.rawResult[0])); }]) {
    const chart = archive(); change(chart); const run = calculate(chart);
    assert.ok(specific(run).every(f => f.completeness === 'partial' && !f.normalizedPayload.confirmed));
    assert.ok(results(run).every(r => r.status === 'unknown'));
    if (!chart.timeKnown) assert.ok(specific(run).every(f => f.normalizedPayload.variant !== hourKey));
  }
});

test('each method gets its own Chinese explanation and neither incomplete source passage nor machine JSON reaches matched materials', () => {
  const run = real(), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-prompt'));
  const projected = input.facts.filter(f => f.type === 'minor_luck_context');
  assert.equal(new Set(projected.map(f => f.data.variant)).size, 3);
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['醉醒子时柱起', '女起壬申逆', '女起丙申异文', '不当成确定原法', '小运不在大运交接时重置']) assert.ok(prompt.includes(phrase), phrase);
  assert.match(prompt, /（八字，小运）/u);
  assert.ok(input.sections.every(section => section.findings.every(f => ![1, 2].some(i => f.knowledgeId === fortuneKnowledge.bazi.rules[i].knowledgeId))));
  for (const key of ['minor_luck_context', 'zuixing-hour-year-direction', 'annualContacts', 'jointNatalHarmTargets', 'minor-source-run', 'https://']) assert.ok(!prompt.includes(key), key);
  const single = describeFortuneFact({ method: 'bazi', type: 'minor_luck_context', data: { ...projected[0].data, variant: 'unsupported-variant' } }, String);
  assert.equal(single, '');
});

test('two source hashes are preserved and unresolved method, calendar, actual targets and usefulness gates cannot be removed by computed Lu/Ma positions', () => {
  for (const index of [1, 2]) {
    const rule = fortuneKnowledge.bazi.rules[index], e = fortuneKnowledge.bazi.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: e.evidence, conditions: e.conditions })).digest('hex'));
    assert.equal(rule.queries.length, 1); assert.equal(rule.queries[0].factType, 'minor_luck_context');
    assert.equal(rule.queries[0].where.confirmed, true); assert.equal(rule.queries[0].where.hasMajorLuck, true);
    assert.equal(rule.unresolved.length, 4); assert.ok(rule.unresolved.some(s => s.includes('计龄')));
    assert.ok(rule.unresolved.some(s => s.includes('原局取用')));
  }
});
