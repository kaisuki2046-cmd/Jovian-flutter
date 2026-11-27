import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { quanshuLuYangTuo, quanshuTransformations, quanshuBrightness, readQuanshuNatal,
  quanshuAnnualContext, quanshuPalaceCondition, quanshuLimitPhase, quanshuLunarMidnight,
  quanshuMinorLimit, quanshuPalaceRelation } = await import('./control/ziwei-quanshu.ts');
const { quanshuKillerEcho } = await import('./control/ziwei-killer-echo.ts');
const { quanshuLimitChapter, quanshuAnnualFlyingShaBranches } = await import('./control/ziwei-limit-chapter.ts');
const { quanshuTransformLimits } = await import('./control/ziwei-transform-limits.ts');
const { quanshuFourFlying, quanshuKongJiePositions } = await import('./control/ziwei-kongjie.ts');
const { quanshuAuxiliaryPositions } = await import('./control/ziwei-source-support.ts');
const { quanshuLimitCombinations } = await import('./control/ziwei-limit-combinations.ts');
const { quanshuAnnualSha } = await import('./control/ziwei-annual-sha.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitTiming } = await import('./control/ziwei-limit-timing.ts');
const { quanshuBodyLimitEncounters } = await import('./control/ziwei-body-limit-encounters.ts');
const { quanshuLimitVerseContacts } = await import('./control/ziwei-limit-verse-contacts.ts');
const { quanshuXingJiTiger } = await import('./control/ziwei-xing-ji-tiger.ts');
const { quanshuTimedBody, quanshuTimedLianzhen, quanshuTimedTianji, quanshuTimedTong } = await import('./control/ziwei-timed-limit-conditions.ts');
const { quanshuYearAndLimits } = await import('./control/ziwei-year-and-limits.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
function native(dateStr = '1990-05-05', timeIndex = 2) {
  return astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }).toJSON();
}
const chart = (natal = native()) => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot = chart(), periodType = 'year', targetPeriod = { year: 2030 }) {
  const input = { periodType, displayTimezone: 'Asia/Shanghai', targetPeriod };
  const time = buildFactTimeContext(input, Date.parse('2026-11-18T03:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'quanshu-run', { snapshotId: 'quanshu-snapshot', chart: snapshot });
}
let cached;
const realRun = () => cached ??= calculate();
const result = (run, index = 5) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId);
const killerIndex = 6;
const killerFacts = run => run.facts.filter(f => f.factType === 'quanshu_killer_echo');
const killerFact = (run, lunarYear) => killerFacts(run).find(f => f.normalizedPayload.lunarYear === lunarYear);
const chapterFacts = run => run.facts.filter(f => f.factType === 'quanshu_limit_chapter' && !f.normalizedPayload.jielanHourWitness);
function verifiedChapterFrame(natal, fact, windowEnd) {
  const { lunarYear, yearly, decadal, minor, monthly, daily } = fact.normalizedPayload;
  const index = seat => seat && natal.palaces.find(row => row.earthlyBranch === seat.branch).index;
  return { at: Date.parse(fact.activeFrom), windowEnd, lunarYear, age: lunarYear - natal.rawDates.lunarDate.lunarYear + 1,
    yearIndex: index(yearly), decadalIndex: index(decadal), minorIndex: index(minor),
    ...(daily && { monthIndex: index(monthly), dayIndex: index(daily), dayEnd: Date.parse(fact.activeTo) }) };
}
const chapterHours = run => run.facts.filter(f => f.factType === 'quanshu_limit_chapter' && f.normalizedPayload.jielanHourWitness);
const withoutChapterHours = run => ({ ...run, facts: run.facts.filter(f => !f.normalizedPayload.jielanHourWitness) });
const chapterIndex = suffix => fortuneKnowledge.ziwei.rules.findIndex(rule => rule.knowledgeId.endsWith('ziwei-quanshu-v3-archive-p081-' + suffix));
const transformationFacts = run => run.facts.filter(fact => fact.factType === 'quanshu_transform_limits');
const tianjiTimedFact = fact => fact.factType === 'quanshu_timed_limit_condition'
  && fact.normalizedPayload.sourceFactType === 'quanshu_transform_limits' && fact.normalizedPayload.star === '天机';
const transformationMatch = (run, passage) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith(passage + '-001'));
function transformationSample(birth, hour, year) {
  return yearTransformation(chart(native(birth, hour)), year);
}
function yearTransformation(snapshot, year) {
  return readYearTransformation(calculate(snapshot, 'year', { year }), year);
}
function readYearTransformation(run, year) {
  const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  return { run: { ...run, facts: run.facts.filter(row => row.factType === fact.factType ? row.factId === fact.factId
    : !tianjiTimedFact(row) || row.normalizedPayload.lunarYear === year) },
    fact, data: fact.normalizedPayload };
}
function completeQuanshuBirth(date, hour) {
  const snapshot = chart(native(date, hour));
  const clock = String(hour * 2).padStart(2, '0') + ':00:00+08:00';
  snapshot.birthContext = { precision: 'minute', birthInstant: new Date(date + 'T' + clock).toISOString(),
    latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  return snapshot;
}
const combinationFacts = run => run.facts.filter(fact => fact.factType === 'quanshu_limit_combinations');
function combinationSample(birth, hour, year) {
  const run = calculate(chart(native(birth, hour)), 'year', { year });
  validateFortuneFacts(run);
  const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  return { run: { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) },
    fact, data: fact.normalizedPayload };
}
function combinationFrame(natal, { lunarYear, annualBranch, decadalBranch, minorBranch }) {
  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch)?.index;
  return { lunarYear, yearIndex: index(annualBranch), decadalIndex: index(decadalBranch), minorIndex: index(minorBranch) };
}
function copyWithShiftedDecade(natal, frame) {
  const copy = structuredClone(natal);
  const decade = copy.palaces.find(row => row.index === frame.decadalIndex).decadal;
  const age = frame.lunarYear - readQuanshuNatal(natal).birthYear + 1;
  const shift = decade.range[1] === age ? 1 : -1;
  decade.range = decade.range.map(value => value + shift);
  assert.equal(quanshuLimitPhase(copy, frame.decadalIndex, age, quanshuLunarMidnight(frame.lunarYear, 1)).ready, true);
  return copy;
}
function archiveMinorInWrongLayer(natal, name) {
  const copy = structuredClone(natal);
  const palace = copy.palaces.find(row => row.minorStars.some(star => star.name === name));
  const [star] = palace.minorStars.splice(palace.minorStars.findIndex(entry => entry.name === name), 1);
  palace.adjectiveStars.push(star);
  return copy;
}
const combinationPrompt = run => formatFortuneFactAudit(buildFortuneModelContext(run,
  interpretFortune(run, requestForFortuneRun(run), 'combined-limits')).input);
const annualShaFact = (run, year) => run.facts.find(fact => fact.factType === 'quanshu_annual_sha' && fact.normalizedPayload.lunarYear === year);
function annualShaSample(birth, hour, year) {
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'annual-sha-' + year };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(native(birth, hour)) })));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const fact = annualShaFact(bound, year);
  assert.ok(fact);
  return { run: { ...bound, facts: bound.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) },
    fact, data: fact.normalizedPayload };
}
const yearAndLimitsFacts = run => run.facts.filter(row => row.factType === 'quanshu_year_and_limits');
const limitAuditMatch = (run, passage) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith(`archive-${passage}-001`));

test('named limit combinations and transformation groups reject a uniquely archived star in a wrong palace', () => {
  const moveMajor = (natal, star) => {
    const oldSeat = natal.palaces.find(row => row.majorStars.some(entry => entry.name === star));
    const entry = oldSeat.majorStars.find(row => row.name === star);
    oldSeat.majorStars = oldSeat.majorStars.filter(row => row !== entry);
    natal.palaces.find(row => row.index === (oldSeat.index + 1) % 12).majorStars.push(entry);
  };
  const frame = (natal, { lunarYear, annualBranch, decadalBranch, minorBranch }) => {
    const index = branch => natal.palaces.find(row => row.earthlyBranch === branch)?.index;
    return { lunarYear, yearIndex: index(annualBranch), decadalIndex: index(decadalBranch), minorIndex: index(minorBranch) };
  };
  const combination = combinationSample('1947-02-05', 9, 2015);
  const comboNatal = native('1947-02-05', 9);
  moveMajor(comboNatal, '贪狼');
  const displaced = quanshuLimitCombinations(comboNatal, frame(comboNatal, combination.data));
  const formerPair = combination.data.starPairs.find(row => row.primary === '陀罗' && row.companion === '贪狼');
  assert.equal(formerPair.candidate, true);
  assert.equal(displaced.starPairs.find(row => row.primary === '陀罗' && row.companion === '贪狼').candidate, undefined);
  assert.equal(displaced.majorContacts.find(row => row.star === '贪狼').branch, undefined);
  assert.equal(displaced.majorContacts.find(row => row.star === '廉贞').candidate, true);
  assert.equal(transformationMatch({ ...combination.run, facts: [{ ...combination.fact, normalizedPayload: displaced }] }, 'expansion-p024').status, 'partial');

  for (const [birth, hour, year, star, gate, passage] of [
    ['1947-02-05', 0, 2044, '天同', 'decadalNatalQuanSha', 'zhuxing-wenda-p155000'],
    ['1981-02-15', 3, 1997, '巨门', 'femaleLuQuanshuFixedFireTabooCandidate', 'expansion-p015'],
    ['1949-03-19', 3, 1961, '贪狼', 'natalQuanLuJiShaAtLimit', 'expansion-p042'],
  ]) {
    const natal = native(birth, hour);
    const { run, fact, data } = yearTransformation(completeQuanshuBirth(birth, hour), year);
    assert.equal(data[gate], true, passage);
    assert.equal(transformationMatch(run, passage).status, 'partial');
    moveMajor(natal, star);
    const wrong = quanshuTransformLimits(natal, frame(natal, data));
    assert.equal(wrong[gate], undefined, passage);
    for (const seat of wrong.seats) for (const change of seat.groups) {
      assert.ok(change.stars.filter(entry => entry.star === star).every(entry => entry.branch === undefined));
    }
    const scoped = { ...run, facts: [{ ...fact, normalizedPayload: wrong }] };
    assert.equal(transformationMatch(scoped, passage).status, 'unknown', passage);
  }
});

test('three timed clauses cannot take a displaced natal major as a visible yearly taboo recipient', () => {
  const cases = [
    { dateStr: '1990-01-15', timeIndex: 7, year: 2006, star: '贪狼', recipient: '廉贞', from: '申', to: '酉',
      gate: 'tanlangYearXingJiCandidate', passage: 'expansion-p006', previous: 'partial',
      recompute: (timing, natal, yearIndex, limits) => quanshuTimedBody(timing, quanshuBodyLimitEncounters(natal, yearIndex, limits))[0] },
    { dateStr: '1991-02-15', timeIndex: 8, year: 2003, star: '天同', recipient: '贪狼', from: '未', to: '子',
      gate: 'tongFallenJiOpposedCandidate', passage: 'expansion-p028', previous: 'not_matched',
      recompute: (timing, _natal, _yearIndex, limits) => quanshuTimedTong(timing, quanshuLimitVerseContacts(limits)) },
    { dateStr: '1990-02-15', timeIndex: 4, year: 2033, star: '廉贞', recipient: '贪狼', from: '丑', to: '寅',
      gate: 'lianzhenYearXingJiBladeCandidate', passage: 'expansion-p029', previous: 'partial',
      recompute: (timing, natal, yearIndex, limits) => quanshuTimedLianzhen(timing, quanshuXingJiTiger(natal, yearIndex, limits)) },
  ];
  for (const { dateStr, timeIndex, year, star, recipient, from, to, gate, passage, previous, recompute } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = engine.toJSON();
    const run = calculate(chart(natal), 'year', { year });
    const fact = run.facts.find(row => row.factType === 'quanshu_timed_limit_condition' && row.normalizedPayload.lunarYear === year
      && row.normalizedPayload.star === star && row.normalizedPayload.activeInSourceHalf === true);
    assert.ok(fact, passage);
    assert.equal(fact.normalizedPayload[gate], previous === 'partial', passage);
    assert.equal(transformationMatch({ ...run, facts: [fact] }, passage).status, previous, passage);

    const oldSeat = natal.palaces.find(row => row.earthlyBranch === from);
    const moved = oldSeat.majorStars.find(row => row.name === recipient);
    assert.ok(moved, passage);
    oldSeat.majorStars = oldSeat.majorStars.filter(row => row !== moved);
    natal.palaces.find(row => row.earthlyBranch === to).majorStars.push(moved);
    const horoscope = engine.horoscope(year + '-06-01').toJSON();
    const frame = { lunarYear: year, yearIndex: horoscope.yearly.index, decadalIndex: horoscope.decadal.index,
      minorIndex: horoscope.age.index, age: year - natal.rawDates.lunarDate.lunarYear + 1 };
    const limits = quanshuLimitBranches(natal, frame);
    const window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
    const [timing] = quanshuLimitTiming(natal, limits, window, frame);
    const normalizedPayload = recompute(timing.data, natal, frame.yearIndex, limits);
    assert.equal(normalizedPayload.activeInSourceHalf, true, passage);
    assert.equal(normalizedPayload[gate], undefined, passage);
    assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload }] }, passage).status, 'unknown', passage);
  }
});

test('p082 requires source-specific palace relations, with different outcomes on either side of the real lunar year boundary', () => {
  const run = calculate(chart(), 'year', { year: 2029 });
  validateFortuneFacts(run);
  const [prior, current] = yearAndLimitsFacts(run);
  const p = prior.normalizedPayload, q = current.normalizedPayload;
  assert.equal(p.lunarYear, 2028); assert.equal(q.lunarYear, 2029);
  assert.equal(prior.activeTo, '2029-02-12T16:00:00.000Z');
  assert.equal(prior.activeTo, current.activeFrom);
  assert.deepEqual(p.guards.map(row => [row.layer, row.branch, row.natalName]),
    [['decadal', '子', '子女'], ['minor', '寅', '兄弟'], ['yearly', '申', '仆役']]);
  assert.deepEqual(p.pairs.map(row => row.relation), ['其他', '三合', '冲']);
  assert.deepEqual(p.annualOppositions, ['minor']);
  assert.deepEqual(p.annualNamedStarContacts.filter(row => row.relation === '冲').map(row => [row.star, row.branch]), [['七杀', '寅']]);
  assert.ok(p.guards[1].stars.some(row => row.star === '七杀' && row.grade === '庙'));
  assert.ok(q.pairs.some(row => row.relation === '三合'));
  assert.ok(q.annualNamedStarContacts.some(row => row.star === '擎羊' && row.relation === '守'));
  assert.equal(q.reviewedLimitContact, false);
  assert.equal(q.annualFlowOppositionCandidate, false);
  assert.equal(q.threeLayerTrineCandidate, false);
  assert.equal(p.verifiedIndependentGradedGuardsCandidate, true);
  assert.equal(q.verifiedIndependentGradedGuardsCandidate, false);
  const hit = limitAuditMatch(run, 'p082');
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [prior.factId]);
  assert.deepEqual(hit.windows, [{ start: prior.activeFrom, endExclusive: prior.activeTo }]);
  const onlyCurrent = { ...run, facts: run.facts.filter(row => row.factId !== prior.factId) };
  assert.equal(limitAuditMatch(onlyCurrent, 'p082').status, 'not_matched');
  const wrong = native();
  const qisha = wrong.palaces.find(row => row.majorStars.some(star => star.name === '七杀'));
  const moved = qisha.majorStars.find(star => star.name === '七杀');
  qisha.majorStars = qisha.majorStars.filter(row => row !== moved);
  const index = branch => wrong.palaces.find(row => row.earthlyBranch === branch).index;
  wrong.palaces.find(row => row.earthlyBranch === '卯').majorStars.push(moved);
  const [decadal, minor, yearly] = q.guards.map(row => row.branch);
  const frame = { lunarYear: 2029, yearIndex: index(yearly), decadalIndex: index(decadal), minorIndex: index(minor) };
  const corrupted = quanshuYearAndLimits(wrong, quanshuLimitBranches(wrong, frame), quanshuAnnualContext(wrong, 2029, '己'));
  assert.equal(corrupted.ready, true);
  assert.equal(corrupted.annualNamedStarContacts.some(row => row.star === '七杀'), false);
  assert.equal(corrupted.reviewedLimitContact, undefined);
  assert.equal(limitAuditMatch({ ...run, facts: [{ ...current, normalizedPayload: corrupted }] }, 'p082').status, 'unknown');

  const together = realRun();
  const sameSeat = yearAndLimitsFacts(together).find(row => row.normalizedPayload.lunarYear === 2030);
  assert.deepEqual(sameSeat.normalizedPayload.pairs[0], { first: 'decadal', second: 'minor', relation: '守' });
  assert.deepEqual(limitAuditMatch(together, 'p082').sourceFactIds, [sameSeat.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-year-and-limits'));
  const chinese = formatFortuneFactAudit(input);
  assert.match(chinese, /小限独守寅宫.*七杀（原书列庙）/u);
  assert.match(chinese, /太岁实际对冲小限/u);
  assert.match(chinese, /太岁与本命寅宫七杀对冲/u);
  assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId).originalText,
    '须详大限独守吉凶何如，小限独守吉凶何如，太岁独守吉凶何如');
  assert.doesNotMatch(formatFortunePrompt(input), /太岁与本命寅宫七杀对冲|小限独守寅宫/u);
});

test('p082 queries same-year flowing Yang and Tuo oppositions and the complete trinal triangle through SQLite', () => {
  const samples = [
    { timeIndex: 0, year: 2002, start: '2002-02-11T16:00:00.000Z', seats: ['巳', '辰', '午'], pairs: ['其他', '其他', '其他'],
      flow: [['擎羊', '子', '冲'], ['陀罗', '戌', '三合']], phrase: '太岁实冲按当年干核位的子宫流年擎羊' },
    { timeIndex: 0, year: 2018, start: '2018-02-15T16:00:00.000Z', seats: ['卯', '子', '戌'], pairs: ['其他', '其他', '其他'],
      flow: [['擎羊', '午', '三合'], ['陀罗', '辰', '冲']], phrase: '太岁实冲按当年干核位的辰宫流年陀罗' },
    { timeIndex: 1, year: 2051, start: '2051-02-10T16:00:00.000Z', seats: ['亥', '卯', '未'], pairs: ['三合', '三合', '三合'],
      flow: [['擎羊', '戌', '其他'], ['陀罗', '申', '其他']], phrase: '太岁、大限和小限实居三个不同宫位，三组宫对均为三合' },
  ];
  for (const { timeIndex, year, start, seats, pairs, flow, phrase } of samples) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1);
    const archive = { snapshotId: 'year-limit-contacts-' + year, chart: chart(native('1990-05-05', timeIndex)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'year-limit-contacts', archive);
    validateFortuneFacts(run);
    const fact = yearAndLimitsFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.deepEqual(data.guards.map(row => row.branch), seats);
    assert.deepEqual(data.pairs.map(row => row.relation), pairs);
    assert.deepEqual(data.annualFlowContacts.map(row => [row.star, row.branch, row.relation]), flow);
    assert.equal(data.reviewedLimitContact, false);
    assert.equal(data.annualFlowOppositionCandidate, year !== 2051);
    assert.equal(data.threeLayerTrineCandidate, year === 2051);
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = limitAuditMatch(scoped, 'p082');
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: year + '-12-31T16:00:00.000Z' }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'year-limit-contacts'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase), phrase);
    assert.doesNotMatch(prompt, /annualFlowContacts|annualFlowOppositionCandidate|threeLayerTrineCandidate/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
    const natal = native('1990-05-05', timeIndex);
    const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
    const [decadal, minor, yearly] = seats;
    const annual = quanshuAnnualContext(natal, year, '甲乙丙丁戊己庚辛壬癸'[(year - 4) % 10]);
    const displaced = quanshuYearAndLimits(natal, quanshuLimitBranches(natal, { lunarYear: year,
      yearIndex: index(yearly), decadalIndex: index(decadal), minorIndex: index(decadal) }), annual);
    assert.equal(displaced.sourceMinor.branch, minor);
    assert.equal(displaced.sourceMinor.verified, false);
    assert.deepEqual(displaced.guards.map(row => row.layer), ['decadal', 'yearly']);
    assert.equal(displaced.independentGuardsReady, false);
    assert.equal(displaced.reviewedLimitContact, undefined);
    assert.equal(displaced.annualFlowOppositionCandidate, undefined);
    assert.equal(displaced.threeLayerTrineCandidate, undefined);
    assert.equal(limitAuditMatch({ ...run, facts: [{ ...fact, normalizedPayload: displaced }] }, 'p082').status, 'unknown');
  }
});

test('p082 keeps yearly opposition unknown if the actual year or either partner limit is unavailable', () => {
  const natal = native('1990-05-05', 0);
  const index = branch => natal.palaces.find(palace => palace.earthlyBranch === branch).index;
  const frame = { lunarYear: 2018, yearIndex: index('戌'), decadalIndex: index('卯'), minorIndex: index('子') };
  const annual = quanshuAnnualContext(natal, 2018, '戊');
  const current = quanshuYearAndLimits(natal, quanshuLimitBranches(natal, frame), annual);
  assert.equal(current.annualFlowOppositionCandidate, true);
  const wrongYear = quanshuYearAndLimits(natal, quanshuLimitBranches(natal, frame), quanshuAnnualContext(natal, 2019, '己'));
  assert.equal(wrongYear.annualFlowContacts, undefined);
  assert.equal(wrongYear.annualFlowOppositionCandidate, undefined);
  const missingLimit = quanshuYearAndLimits(natal, quanshuLimitBranches(natal, { ...frame, minorIndex: undefined }), annual);
  assert.equal(missingLimit.annualFlowContacts.find(row => row.star === '陀罗').relation, '冲');
  assert.equal(missingLimit.annualFlowOppositionCandidate, undefined);
  assert.equal(missingLimit.threeLayerTrineCandidate, undefined);
});

test('p082 requires a verified common opposite palace when Tai Sui opposes both limits', () => {
  const birth = '1990-03-05', year = 2004, n = native(birth, 0);
  const run = calculate(completeQuanshuBirth(birth, 0), 'year', { year });
  const fact = yearAndLimitsFacts(run).find(row => row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.equal(data.annualOppositionProfile, 'quanshu-nanyangtang-verified-limit-opposition-v1');
  assert.deepEqual(data.guards.map(row => [row.layer, row.branch]), [['decadal', '寅'], ['minor', '寅'], ['yearly', '申']]);
  assert.deepEqual(data.pairs.map(row => row.relation), ['守', '冲', '冲']);
  assert.deepEqual(data.annualOppositions, ['decadal', 'minor']);
  assert.deepEqual(data.sourceMinor, { startBranch: '辰', branch: '寅', ordinal: 15, direction: '逆行', verified: true });
  assert.equal(data.annualDoubleVerifiedOppositionCandidate, true);
  const exact = { ...fact, normalizedPayload: { ...data, reviewedLimitContact: false,
    annualFlowOppositionCandidate: false, threeLayerTrineCandidate: false } };
  const hit = limitAuditMatch({ ...run, facts: [exact] }, 'p082');
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-double-opposition'));
  assert.match(formatFortuneFactAudit(input), /太岁同段实冲大限及明刊复算的小限/u);
  assert.doesNotMatch(formatFortunePrompt(input), /太岁同段实冲大限及明刊复算的小限/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const wrongProfile = { ...exact, normalizedPayload: { ...exact.normalizedPayload, annualOppositionProfile: 'other-source' } };
  assert.equal(limitAuditMatch({ ...run, facts: [wrongProfile] }, 'p082').status, 'not_matched');

  const index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index('申'), decadalIndex: index('寅'), minorIndex: index('寅') };
  const missing = quanshuYearAndLimits(n, quanshuLimitBranches(n, { ...frame, minorIndex: undefined }));
  assert.equal(missing.annualDoubleVerifiedOppositionCandidate, undefined);
  assert.equal(missing.sourceMinor.verified, undefined);
  const wrongDirection = { ...n, gender: '男' };
  const incompatible = quanshuYearAndLimits(wrongDirection, quanshuLimitBranches(wrongDirection, frame));
  assert.deepEqual(incompatible.annualOppositions, []);
  assert.equal(incompatible.sourceDecadal.verified, false);
  assert.equal(incompatible.sourceMinor.verified, false);
  assert.equal(incompatible.annualDoubleVerifiedOppositionCandidate, undefined);

  const next = calculate(chart(n), 'year', { year: 2005 });
  const later = yearAndLimitsFacts(next).find(row => row.normalizedPayload.lunarYear === 2005);
  assert.equal(later.normalizedPayload.annualDoubleVerifiedOppositionCandidate, false);
  assert.equal(limitAuditMatch({ ...next, facts: [later] }, 'p082').status, 'not_matched');

  const limitBranch = (result, lunarYear) => result.facts.find(row => row.factType === 'quanshu_limit_branches'
    && row.normalizedPayload.lunarYear === lunarYear);
  const actual = limitBranch(run, year);
  const companionFlags = Object.fromEntries(['annualReliefCandidate', 'annualAdverseCandidate',
    'annualSeatedReliefCandidate', 'annualCrossGroupReliefCandidate', 'annualSeatedAdverseCandidate',
    'annualOpposedGuardCandidate', 'annualTrineAdverseCandidate', 'annualOpposedQishaCandidate',
    'annualOpposedDecadalFullReliefCandidate', 'annualMingFixedOppositionShaCandidate'].map(key => [key, false]));
  const evaluate = (result, fact, normalizedPayload = fact.normalizedPayload) => transformationMatch({
    ...result, facts: [{ ...fact, normalizedPayload: { ...normalizedPayload, ...companionFlags } }],
  }, 'expansion-p043');
  const branch = actual.normalizedPayload;
  assert.equal(branch.annualDoubleVerifiedOppositionCandidate, true);
  const original = evaluate(run, actual);
  assert.equal(original.status, 'partial');
  assert.deepEqual(original.sourceFactIds, [actual.factId]);
  assert.deepEqual(original.windows, [{ start: actual.activeFrom, endExclusive: actual.activeTo }]);
  const evidence = /太岁在申宫，同年实际对冲寅宫大限和寅宫小限/u;
  assert.match(formatFortuneFactAudit(input), evidence);
  assert.doesNotMatch(formatFortunePrompt(input), evidence);
  assert.equal(evaluate(run, actual, { ...branch, annualOppositionProfile: 'other-source' }).status, 'not_matched');
  const { limitPlacementProof, ...olderBranch } = branch;
  assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
  assert.equal(evaluate(run, actual, olderBranch).status, 'unknown');
  const missingMinor = quanshuLimitBranches(n, { ...frame, minorIndex: undefined });
  assert.equal(missingMinor.annualDoubleVerifiedOppositionCandidate, undefined);
  assert.equal(evaluate(run, actual, missingMinor).status, 'unknown');
  const nextBranch = limitBranch(next, 2005);
  assert.equal(nextBranch.normalizedPayload.annualDoubleVerifiedOppositionCandidate, false);
  assert.equal(evaluate(next, nextBranch).status, 'not_matched');
});

test('p082 independently checks a fallen major and native Sha guarding all three actual seats with verified Injury', () => {
  const natal = native('1947-10-22', 7), year = 1976;
  const run = calculate(chart(natal), 'year', { year });
  const fact = yearAndLimitsFacts(run).find(row => row.normalizedPayload.lunarYear === year);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.reviewedLimitContact, data.annualFlowOppositionCandidate, data.threeLayerTrineCandidate,
    data.annualDoubleVerifiedOppositionCandidate], [false, false, false, false]);
  assert.equal(data.threeLayerFallenShangShiCandidate, true);
  assert.deepEqual(data.threeLayerFallenShangShiWitnesses, [
    { scope: 'decadal', branch: '巳', fallenStars: ['廉贞', '贪狼'], shaStars: ['陀罗'] },
    { scope: 'minor', branch: '申', fallenStars: ['天梁'], shaStars: ['天伤'] },
    { scope: 'yearly', branch: '辰', fallenStars: ['太阴'], shaStars: ['古天空'] },
  ]);
  const scoped = { ...run, facts: [fact] };
  const hit = limitAuditMatch(scoped, 'p082');
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'named-injury-three-seats'));
  assert.match(formatFortuneFactAudit(input), /小限[^\n]*申宫[^\n]*天梁[^\n]*天伤/u);
  assert.doesNotMatch(formatFortunePrompt(input), /小限[^\n]*申宫[^\n]*天梁[^\n]*天伤|threeLayerFallenShangShiWitnesses/u);

  const next = calculate(chart(natal), 'year', { year: year + 1 });
  const nearby = yearAndLimitsFacts(next).find(row => row.normalizedPayload.lunarYear === year + 1).normalizedPayload;
  assert.equal(nearby.threeLayerFallenShangShiCandidate, false);
  assert.deepEqual(nearby.threeLayerFallenShangShiWitnesses, []);

  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index('辰'), decadalIndex: index('巳'), minorIndex: index('申') };
  const wrongMinor = { ...frame, minorIndex: index('巳') };
  const missingInjury = structuredClone(natal);
  for (const row of missingInjury.palaces) row.adjectiveStars = row.adjectiveStars.filter(star => star.name !== '天伤');
  for (const [archive, scope] of [[natal, wrongMinor], [missingInjury, frame]]) {
    const limits = quanshuLimitBranches(archive, scope);
    const unknown = quanshuYearAndLimits(archive, limits, quanshuAnnualContext(archive, year, '丙'));
    assert.equal(unknown.threeLayerFallenShangShiCandidate, undefined);
    assert.deepEqual(unknown.threeLayerFallenShangShiWitnesses, []);
    assert.equal(limitAuditMatch({ ...run, facts: [{ ...fact, normalizedPayload: unknown }] }, 'p082').status, 'unknown');
  }
});

test('the source annual-and-minor table requires the same verified seat for each named branch', () => {
  const samples = [
    [2240, '1988-08-25', 7, 2021, '戊', '丑', '天相', 'annualTempleMajorStars'],
    [2241, '2004-02-25', 1, 2035, '甲', '卯', '太阴', 'annualNonTempleMajorStars'],
    [2242, '2003-02-25', 5, 2036, '癸', '辰', '廉贞', 'annualNonTempleMajorStars'],
    [2243, '1980-05-10', 1, 2017, '庚', '酉', '天相', 'annualNonTempleMajorStars'],
    [2244, '1980-02-25', 7, 2017, '庚', '酉', '天府', 'annualNonTempleMajorStars'],
    [2245, '1997-02-10', 3, 2030, '丁', '戌', '武曲', 'annualTempleMajorStars'],
    [2246, '2008-05-15', 2, 2043, '戊', '亥', '太阴', 'annualTempleMajorStars'],
    [2247, '1996-08-25', 3, 2031, '丙', '亥', '廉贞', 'annualNonTempleMajorStars'],
    [2248, '1996-05-15', 11, 2031, '丙', '亥', '武曲', 'annualNonTempleMajorStars'],
    [2268, '2006-03-16', 2, 2033, '丙', '丑', '天机', 'annualNonTempleMajorStars'],
    [2269, '1993-02-22', 10, 2016, '癸', '申', '巨门', 'annualTempleMajorStars'],
    [2270, '1997-02-22', 1, 2018, '丁', '戌', '巨门', 'annualNonTempleMajorStars'],
    [2271, '2006-02-16', 1, 2033, '丙', '丑', '太阴', 'annualTempleMajorStars'],
    [2271, '2006-11-10', 9, 2033, '丙', '丑', '武曲', 'annualTempleMajorStars'],
    [2272, '2007-03-10', 0, 2032, '丁', '子', '天府', 'annualTempleMajorStars'],
    [2272, '2007-03-10', 1, 2032, '丁', '子', '天相', 'annualTempleMajorStars'],
    [2272, '2007-05-10', 3, 2032, '丁', '子', '天梁', 'annualTempleMajorStars'],
    [2273, '1996-02-22', 7, 2025, '丙', '巳', '巨门', 'annualNonTempleMajorStars'],
    [2273, '1996-02-22', 1, 2025, '丙', '巳', '贪狼', 'annualNonTempleMajorStars'],
    [2274, '1999-02-25', 9, 2022, '己', '寅', '天梁', 'annualTempleMajorStars'],
    [2274, '1999-03-10', 7, 2022, '己', '寅', '七杀', 'annualTempleMajorStars'],
    [2275, '2007-03-25', 2, 2026, '丁', '午', '紫微', 'annualTempleMajorStars'],
    [2275, '2007-02-22', 7, 2026, '丁', '午', '天梁', 'annualTempleMajorStars'],
    [2275, '2007-03-10', 1, 2026, '丁', '午', '破军', 'annualTempleMajorStars'],
    [2276, '2012-03-10', 2, 2039, '壬', '未', '紫微', 'annualTempleMajorStars'],
    [2276, '2012-02-22', 10, 2039, '壬', '未', '天府', 'annualTempleMajorStars'],
  ];
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, birth, hour, year, stem, branch, star, gradeField] of samples) {
    const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const chart = completeQuanshuBirth(birth, hour);
    const reference = { snapshotId: 'quanshu-annual-minor-' + id, chart };
    const asOf = Date.UTC(year, 5, 1);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), reference.snapshotId, reference);
    const result = lookup(run, id);
    assert.equal(result.status, 'matched', 'source entry ' + id);
    const evidence = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(evidence.length > 0);
    for (const { normalizedPayload: data } of evidence) {
      assert.equal(data.lunarYear, year);
      assert.equal(data.birthStem, stem);
      assert.equal(data.annualBranch, branch);
      assert.equal(data.sourceMinor.branch, branch);
      assert.equal(data.sourceMinor.verified, true);
      assert.ok(data[gradeField].includes(star));
      if ([2240, 2268, 2271].includes(id)) assert.equal(data.lifeBranch, branch);
    }
    assert.equal(result.windows[0].start, new Date(quanshuLunarMidnight(year, 1)).toISOString());
    const excludedStem = id === 2268 ? '甲' : '辛';
    const counterexamples = [{ annualMinorSameSeatVerified: false }, { [gradeField]: [] }, { birthStem: excludedStem }];
    if ([2240, 2268, 2271].includes(id)) counterexamples.push({ annualAtLife: false });
    for (const change of counterexamples) {
      const facts = evidence.map(row => ({ ...row, normalizedPayload: { ...row.normalizedPayload, ...change } }));
      assert.equal(lookup({ ...run, facts }, id).status, 'not_matched');
    }
  }
});

test('p084 checks all four actual seats and the Gui-Zi example using the client and SQLite path', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2032 } };
  const asOf = Date.parse('2026-11-18T03:00:00Z');
  const archive = { snapshotId: 'quanshu-gui-zi-chart', chart: chart(native('1993-07-04', 6)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'quanshu-gui-zi-run', archive);
  validateFortuneFacts(run);
  const hit = limitAuditMatch(run, 'p084');
  const [fact] = yearAndLimitsFacts(run).filter(row => hit.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(hit.status, 'matched'); assert.equal(hit.sourceFactIds.length, 1);
  assert.equal(fact.activeFrom, '2032-02-10T16:00:00.000Z');
  assert.deepEqual([p.lifeBranch, p.annualBranch, p.birthStem, p.guiLifeZiExample], ['子', '子', '癸', true]);
  const originalExample = candidate => matchFortuneKnowledge(candidate).byMethod.ziwei
    .find(row => row.knowledgeId === 'fortune-entry-2230');
  assert.deepEqual(originalExample(run).sourceFactIds, [fact.factId]);
  assert.equal(originalExample({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, birthStem: '壬', guiLifeZiExample: false } }] })
    .status, 'not_matched');
  assert.deepEqual(p.lifeArea.map(row => [row.branch, row.relation]), [['辰', '三合'], ['午', '冲'], ['申', '三合'], ['子', '守']]);
  assert.ok(p.lifeArea.some(row => row.branch === '申' && row.supportPositions.includes('左辅')));
  assert.ok(p.lifeArea.some(row => row.branch === '辰' && row.adversePositions.includes('归档铃星')));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-gui-zi-report'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const text = formatFortuneFactAudit(input);
  assert.match(text, /太岁实临本命命宫/u);
  assert.match(text, /本命官禄宫在辰，与命宫三合/u);
  assert.match(text, /癸生人太岁和命宫同在子宫/u);
  assert.doesNotMatch(text, /lifeArea|annualNamedStarContacts|reviewedLimitContact|quanshu_year_and_limits/u);
});

test('unknown or conflicting natal scope and generic interval overlap cannot qualify either reviewed chapter', () => {
  const run = realRun();
  assert.ok(['decadal', 'minor', 'yearly'].every(scope => run.facts.some(row => row.factType === 'time_segment' && row.scope === scope)));
  const generic = { ...run, facts: run.facts.filter(row => row.factType !== 'quanshu_year_and_limits') };
  for (const passage of ['p082', 'p084']) assert.equal(limitAuditMatch(generic, passage).status, 'unknown');
  const n = native('1993-07-04', 6);
  const yearIndex = n.palaces.find(row => row.earthlyBranch === '子').index;
  const noLimits = quanshuYearAndLimits(n, quanshuLimitBranches(n, { lunarYear: 2032, yearIndex }));
  assert.equal(noLimits.reviewedLimitContact, undefined);
  assert.equal(noLimits.independentGuardsReady, false);
  assert.equal(noLimits.annualAtLife, true);
  const conflicting = chart(); conflicting.ziwei.rawResult.push(native('1990-05-05', 3));
  const unknown = calculate(conflicting);
  assert.ok(yearAndLimitsFacts(unknown).every(row => row.completeness === 'partial'));
  for (const passage of ['p082', 'p084']) assert.equal(limitAuditMatch(unknown, passage).status, 'unknown');

  for (const passage of ['p082', 'p084']) {
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(`archive-${passage}-001`));
    const source = fortuneKnowledge.ziwei.entries.find(row => row.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: source.evidence, conditions: source.conditions })).digest('hex'));
    assert.equal(rule.queries.length, 1);
    assert.equal(rule.queries[0].factType, 'quanshu_year_and_limits');
  }
});

test('Tanlang in a source fire seat reaches SQLite through distinct natal or yearly migration witnesses', () => {
  const samples = [
    ['1947-02-05', 9, 2007, 'yearly', '陀罗', 'migrationRelation'],
    ['1980-07-15', 8, 2003, 'natal', '擎羊', 'pojunRelation'],
  ];
  for (const [birth, hour, year, layer, sha, overlap] of samples) {
    const run = calculate(chart(native(birth, hour)), 'year', { year });
    validateFortuneFacts(run);
    const fact = annualShaFact(run, year);
    const payload = fact.normalizedPayload;
    const anchors = payload.migrations.filter(row => row.candidate);
    assert.deepEqual(anchors.map(row => row.layer), [layer]);
    const [anchor] = anchors;
    assert.deepEqual([anchor.branch, anchor.tanlangRelation, anchor.pojun, anchor.pojunRelation], ['巳', '守', '丑', '三合']);
    assert.deepEqual([anchor.jumen, anchor.jumenRelation, anchor.qisha, anchor.qishaRelation], ['午', '邻宫', '酉', '三合']);
    assert.equal(anchor.annualSha.find(row => row.star === sha)[overlap], '守');
    const match = transformationMatch(run, 'expansion-p007');
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
    assert.ok(fact.sourceFactIds.length >= 2);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-migration-sha'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes((layer === 'natal' ? '本命' : '流年') + '迁移宫在巳宫，贪狼同守该宫'));
    assert.match(prompt, /本命巨门在午宫，.*邻宫/u);
    assert.doesNotMatch(prompt, /migrationFireCandidate|quanshu-annual-sha/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
  }
  const displaced = native('1947-02-05', 9);
  const oldSeat = displaced.palaces.find(palace => palace.majorStars.some(star => star.name === '天府'));
  const newSeat = displaced.palaces.find(palace => palace.index === (oldSeat.index + 1) % 12);
  const tianfu = oldSeat.majorStars.splice(oldSeat.majorStars.findIndex(star => star.name === '天府'), 1)[0];
  newSeat.majorStars.push(tianfu);
  const wrong = calculate(chart(displaced), 'year', { year: 2007 });
  const wrongPayload = annualShaFact(wrong, 2007).normalizedPayload;
  assert.ok(wrongPayload.unverifiedMajorStars.includes('贪狼'));
  assert.equal(wrongPayload.migrations.find(row => row.layer === 'yearly').branch, '巳');
  assert.equal(wrongPayload.migrationFireCandidate, undefined);
  assert.equal(transformationMatch(wrong, 'expansion-p007').status, 'unknown');
});

test('annual sha binds Pojun or Bell-Yang-Tiger to their own verified seats and keeps effective control unresolved', () => {
  const pojun = calculate(chart(native('1947-02-05', 0)), 'year', { year: 2002 });
  const fact = annualShaFact(pojun, 2002), payload = fact.normalizedPayload;
  assert.equal(payload.pojunCase.candidate, true);
  assert.deepEqual([payload.pojunCase.branch, payload.pojunCase.annualRelation, payload.pojunCase.grade], ['戌', '三合', '旺']);
  assert.deepEqual(payload.pojunCase.annualSha.filter(row => row.relation === '守').map(row => row.star), ['陀罗']);
  assert.deepEqual(payload.pojunCase.relief.map(row => [row.layer, row.star, row.branch, row.relation]), [
    ['natal', '天梁', '巳', '其他'], ['natal', '禄存', '午', '三合'], ['yearly', '禄存', '亥', '邻宫'],
  ]);
  assert.equal(payload.pojunCase.namedReliefInArea, true);
  const wrongNativeLu = archiveMinorInWrongLayer(native('1947-02-05', 0), '禄存');
  const displaced = quanshuAnnualSha(wrongNativeLu, quanshuAnnualContext(wrongNativeLu, 2002, '壬'), '午');
  assert.equal(displaced.pojunCase.namedReliefInArea, undefined);
  assert.equal(displaced.pojunCase.candidate, true);
  const bellNatal = native('1980-08-15', 11);
  const bell = calculate(chart(bellNatal), 'year', { year: 2009 });
  const bellFact = annualShaFact(bell, 2009), bellPayload = bellFact.normalizedPayload;
  assert.equal(bellFact.activeFrom, '2009-01-25T16:00:00.000Z');
  assert.equal(bellPayload.pojunCase.candidate, false);
  assert.deepEqual(bellPayload.bellTigerCase, { lifeBranch: '酉', bell: '酉', nativeYang: '酉', whiteTiger: '酉', candidate: true });
  for (const [run, witness] of [[pojun, fact], [bell, bellFact]]) {
    const match = transformationMatch(run, 'expansion-p023');
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(witness.factId));
    assert.equal(witness.normalizedPayload.effectiveControl, 'unresolved');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-annual-sha-control'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /实际有制或无制尚未判定/u);
    assert.match(prompt, run === pojun ? /流年陀罗与破军同宫/u : /本命擎羊、归档铃星和流年白虎同在酉宫/u);
    assert.doesNotMatch(prompt, /effectiveControl|yearlyShaCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
  }
  const wrongTiger = quanshuAnnualSha(bellNatal, quanshuAnnualContext(bellNatal, 2010, '庚'), '寅', '申');
  assert.equal(wrongTiger.bellTigerCase.candidate, false);
  const modified = structuredClone(bellNatal);
  const seat = modified.palaces.find(row => row.earthlyBranch === '酉');
  seat.minorStars = seat.minorStars.filter(row => row.name !== '铃星');
  const withoutBell = quanshuAnnualSha(modified, quanshuAnnualContext(modified, 2009, '己'), '丑', '未');
  assert.equal(withoutBell.yearlyShaCandidate, undefined);
});

test('p007 repeats the same natal and annual Sha at Qisha in the actual migration and Pojun trines', () => {
  for (const [birth, hour, year, layer, anchor, pojun, qisha, sha, label] of [
    ['1990-10-21', 11, 2000, 'natal', '巳', '丑', '酉', '擎羊', '本命'],
    ['1982-10-05', 4, 2032, 'yearly', '午', '寅', '戌', '陀罗', '流年'],
  ]) {
    const { run, fact, data } = annualShaSample(birth, hour, year);
    assert.equal(data.migrationFireCandidate, false);
    assert.equal(data.migrationFireShaRepeatCandidate, true);
    const hits = data.migrations.filter(row => row.repeatedShaCandidate);
    assert.deepEqual(hits.map(row => [row.layer, row.branch, row.pojun, row.qisha]), [[layer, anchor, pojun, qisha]]);
    assert.deepEqual(hits[0].repeatedSha, [{
      star: sha, branch: qisha, natalBranch: qisha, repeatsNatal: true,
      migrationRelation: '三合', pojunRelation: '三合', qishaRelation: '守',
    }]);
    const match = transformationMatch(run, 'expansion-p007');
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'migration-repeat'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('本命' + sha + '与流年' + sha + '同在' + qisha + '宫，与本命七杀同守，并三合' + label + '迁移宫和破军宫'));
    assert.doesNotMatch(prompt, /repeatedShaCandidate|migrationFireShaRepeatCandidate/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));
    const wrongLayer = archiveMinorInWrongLayer(native(birth, hour), sha);
    const wrong = quanshuAnnualSha(wrongLayer, quanshuAnnualContext(wrongLayer, year, data.annualStem), data.yearBranch,
      data.migrations.find(row => row.layer === 'yearly').branch);
    const slot = wrong.migrations.find(row => row.layer === layer);
    assert.equal(slot.annualSha.find(row => row.star === sha).repeatsNatal, undefined);
    assert.equal(slot.repeatedShaCandidate, undefined);
    assert.deepEqual(slot.repeatedSha, []);
    assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrong }] }, 'expansion-p007').status, 'unknown');
    const near = annualShaSample(birth, hour, year + 1);
    assert.equal(near.data.migrationFireShaRepeatCandidate, false);
    assert.equal(transformationMatch(near.run, 'expansion-p007').status, 'not_matched');
  }
});

test('p007 confirms annual repeats only when both migration layers and both blade placements agree', () => {
  const birth = '1982-06-16', hour = 6, year = 2032;
  const { run, fact, data } = annualShaSample(birth, hour, year);
  const hit = transformationMatch(run, 'expansion-p007');
  assert.equal(data.migrationSharedFireShaRepeat, true);
  assert.deepEqual(data.migrations.map(row => [row.layer, row.branch, row.tanlang, row.pojun, row.qisha, row.jumenRelation]),
    [['natal', '午', '午', '寅', '戌', '邻宫'], ['yearly', '午', '午', '寅', '戌', '邻宫']]);
  assert.deepEqual(data.migrations[0].annualSha.map(row => [row.star, row.natalBranch, row.branch, row.repeatsNatal]),
    [['擎羊', '子', '子', true], ['陀罗', '戌', '戌', true]]);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '流年歲殺迭並');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

  const changed = archiveMinorInWrongLayer(native(birth, hour), '擎羊');
  const wrongLayer = quanshuAnnualSha(changed, quanshuAnnualContext(changed, year, '壬'), '子', '午');
  assert.equal(wrongLayer.migrationFireShaRepeatCandidate, true);
  assert.equal(wrongLayer.migrationSharedFireShaRepeat, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 'expansion-p007').status, 'partial');
  const next = annualShaSample(birth, hour, year + 1);
  assert.equal(next.data.migrationSharedFireShaRepeat, false);
  assert.notEqual(transformationMatch(next.run, 'expansion-p007').status, 'matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'common-fire-migration-sha'));
  assert.match(formatFortuneFactAudit(input), /本命与流年迁移同在午宫，另核本命和流年擎羊均实守子宫太岁/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /流年歲殺迭並/u);
  assert.doesNotMatch(prompt, /迁移同在午宫|子宫太岁|破軍暗殺並|migrationSharedFireShaRepeat/u);
});

test('p007 confirms the Ming earth-seat migration with the verified natal and annual blade repeats', () => {
  const birth = '1967-06-15', hour = 11, year = 2027;
  const { run, fact, data } = annualShaSample(birth, hour, year);
  assert.deepEqual([data.migrationFireCandidate, data.migrationFireShaRepeatCandidate, data.migrationSharedFireShaRepeat],
    [false, false, false]);
  assert.equal(data.migrationSharedMingEarthShaRepeat, true);
  assert.deepEqual(data.migrations.map(row => [row.layer, row.branch, row.tanlang, row.pojun, row.qisha, row.jumenRelation]),
    [['natal', '丑', '丑', '酉', '巳', '邻宫'], ['yearly', '丑', '丑', '酉', '巳', '邻宫']]);
  assert.deepEqual(data.migrations[0].annualSha.map(row => [row.star, row.natalBranch, row.branch, row.repeatsNatal]),
    [['擎羊', '未', '未', true], ['陀罗', '巳', '巳', true]]);
  assert.deepEqual(data.migrations[0].repeatedSha.map(row => row.star), ['陀罗']);

  const hit = transformationMatch(run, 'expansion-p007');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '流年歲殺迭並');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

  const changed = archiveMinorInWrongLayer(native(birth, hour), '擎羊');
  const wrongLayer = quanshuAnnualSha(changed, quanshuAnnualContext(changed, year, '丁'), '未', '丑');
  assert.equal(wrongLayer.migrationSharedMingEarthShaRepeat, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 'expansion-p007').status, 'unknown');
  const natal = native(birth, hour);
  const wrongMigration = quanshuAnnualSha(natal, quanshuAnnualContext(natal, year, '丁'), '未', '午');
  assert.equal(wrongMigration.migrationSharedMingEarthShaRepeat, undefined);
  const next = annualShaSample(birth, hour, year + 1);
  assert.equal(next.data.migrationSharedMingEarthShaRepeat, false);
  assert.equal(transformationMatch(next.run, 'expansion-p007').status, 'not_matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'common-earth-migration-sha'));
  assert.match(formatFortuneFactAudit(input), /本命与流年迁移同在丑宫，按明刊土乡取宫，另核本命和流年擎羊均实守未宫太岁/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /流年歲殺迭並/u);
  assert.doesNotMatch(prompt, /迁移同在丑宫|未宫太岁|破軍暗殺並|migrationSharedMingEarthShaRepeat/u);
});

test('p023 confirms the Ming Taiwei Yang-Bell-Tiger clause with a genuine natal blade layer', () => {
  const birth = '1974-01-23', hour = 11, year = 2015;
  const { run, fact, data } = annualShaSample(birth, hour, year);
  assert.equal(data.yearlyShaCandidate, false);
  assert.equal(data.bellTigerCase.bell, '寅');
  assert.equal(data.annualShaBladePlacementProof, 'quanshu-verified-native-blade-minor-layer-v1');
  assert.deepEqual(data.quanshuFixedBellTigerCase, {
    lifeBranch: '卯', bell: '卯', nativeYang: '卯', whiteTiger: '卯', candidate: true,
  });
  assert.equal(data.fixedBellTigerZiweiGuard, false);
  const scoped = normalizedPayload => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
  const hit = transformationMatch(run, 'expansion-p023');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '流年最忌');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-taiwei-yang-bell-tiger'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /明刊铃星、本命擎羊与年度四飞白虎实守卯宫的本命命宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /据南阳堂明刊《全书》卷一〈太微赋〉的具名句/u);
  assert.doesNotMatch(prompt, /遇殺無制|quanshuFixedBellTigerCase|annualShaBladePlacementProof|实守卯宫/u);

  const natal = native(birth, hour);
  const withoutMovedBell = structuredClone(natal);
  const archivedBellSeat = withoutMovedBell.palaces.find(row => row.earthlyBranch === '寅');
  archivedBellSeat.minorStars = archivedBellSeat.minorStars.filter(star => star.name !== '铃星');
  const onlyMing = quanshuAnnualSha(withoutMovedBell, quanshuAnnualContext(withoutMovedBell, year, data.annualStem), data.yearBranch);
  assert.equal(onlyMing.bellTigerCase.bell, undefined);
  assert.equal(onlyMing.quanshuFixedBellTigerCandidate, true);
  assert.equal(transformationMatch(scoped(onlyMing), 'expansion-p023').status, 'matched');
  const wrongLayer = archiveMinorInWrongLayer(natal, '擎羊');
  const wrong = quanshuAnnualSha(wrongLayer, quanshuAnnualContext(wrongLayer, year, data.annualStem), data.yearBranch);
  assert.equal(wrong.quanshuFixedBellTigerCase.nativeYang, undefined);
  assert.equal(wrong.quanshuFixedBellTigerCandidate, undefined);
  assert.equal(transformationMatch(scoped(wrong), 'expansion-p023').status, 'unknown');
  assert.equal(transformationMatch(scoped({ ...data, annualShaBladePlacementProof: undefined }), 'expansion-p023').status, 'unknown');
  const next = quanshuAnnualSha(natal, quanshuAnnualContext(natal, 2016, '丙'), '申');
  assert.equal(next.quanshuFixedBellTigerCandidate, false);
  assert.notEqual(transformationMatch(scoped(next), 'expansion-p023').status, 'matched');
});

test('p023 keeps the Ming Bell and Tiger combination partial when Ziwei guards it or cannot be located', () => {
  const birth = '1974-03-05', hour = 0, year = 2015;
  const { run, fact, data } = annualShaSample(birth, hour, year);
  assert.equal(data.quanshuFixedBellTigerCandidate, true);
  assert.equal(data.fixedBellTigerZiweiGuard, true);
  const readMatch = sample => transformationMatch(sample, 'expansion-p023');
  const hit = readMatch(run);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);

  const natal = native(birth, hour);
  const life = natal.palaces.find(row => row.name === '命宫');
  const ziwei = life.majorStars.find(row => row.name === '紫微');
  life.majorStars = life.majorStars.filter(star => star !== ziwei);
  life.minorStars.push(ziwei);
  const misplaced = quanshuAnnualSha(natal, quanshuAnnualContext(natal, year, data.annualStem), data.yearBranch);
  assert.equal(misplaced.quanshuFixedBellTigerCandidate, true);
  assert.equal(misplaced.fixedBellTigerZiweiGuard, undefined);
  assert.equal(readMatch({ ...run, facts: [{ ...fact, normalizedPayload: misplaced }] }).status, 'partial');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ziwei-governs-ming-bell'));
  assert.match(formatFortuneFactAudit(input), /紫微和明刊铃星同守卯宫，另见同卷所列制铃条件/u);
  assert.ok(input.sections.every(section => section.findings.every(item => item.knowledgeId !== hit.knowledgeId)));
  assert.doesNotMatch(formatFortunePrompt(input), /制铃条件|fixedBellTigerZiweiGuard/u);
});

test('p023 requires an actual guard shared by Pojun and annual White Tiger', () => {
  const { run, fact, data } = annualShaSample('1980-02-15', 4, 1996);
  assert.equal(data.yearlyShaCandidate, false);
  assert.equal(data.jielanBellTigerCandidate, false);
  assert.deepEqual([data.yearBranch, data.pojunCase.branch, data.pojunCase.annualRelation], ['子', '申', '三合']);
  assert.deepEqual(data.pojunCase.annualTiger, { branch: '申', relation: '守' });
  assert.deepEqual(data.pojunCase.guardingLimits, ['minor']);
  assert.equal(data.tigerAtPojunLimitCandidate, true);
  const match = transformationMatch(run, 'expansion-p023');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(row => row.rawFactId === id && row.payload === undefined)));
  const local = calculate(chart(native('1980-02-15', 4)), 'year', { year: 1996 });
  const localFact = annualShaFact(local, 1996);
  const source = local.rawFacts.find(row => localFact.sourceFactIds.includes(row.rawFactId)
    && row.payload?.policy?.profile === 'quanshu-annual-sha-source-v1');
  assert.ok(source);
  assert.equal(source.payload.interval.year.output.earthlyBranch, '子');
  assert.equal(source.payload.interval.minor.output.earthlyBranch, '申');
  for (const layer of ['year', 'minor']) {
    assert.ok(source.payload.interval[layer].start <= Date.parse(fact.activeFrom));
    assert.ok(Date.parse(fact.activeTo) <= source.payload.interval[layer].end);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'pojun-tiger-limit'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /年度四飞白虎与本命破军同守申宫的小限/u);
  assert.match(prompt, /实际有制或无制尚未判定/u);
  assert.doesNotMatch(prompt, /tigerAtPojunLimitCandidate|guardingLimits/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));

  const near = annualShaSample('1980-02-15', 0, 1999);
  assert.deepEqual(near.data.pojunCase.annualTiger, { branch: '亥', relation: '守' });
  assert.deepEqual(near.data.pojunCase.guardingLimits, []);
  assert.equal(near.data.tigerAtPojunLimitCandidate, false);
  assert.equal(transformationMatch(near.run, 'expansion-p023').status, 'not_matched');
  const n = native('1980-02-15', 0);
  const astroOptions = { dateStr: '1980-02-15', timeIndex: 0, gender: '女', fixLeap: true, config };
  const year = astro.withOptions(astroOptions).horoscope('1999-06-01', 6);
  const allegedLimit = n.palaces.find(row => row.earthlyBranch === near.data.pojunCase.branch).index;
  const verifiedLimits = { lunarYear: 1999, yearIndex: year.yearly.index, decadalIndex: year.decadal.index, minorIndex: year.age.index };
  const wrongMinor = quanshuAnnualSha(n, quanshuAnnualContext(n, 1999, '己'), near.data.yearBranch, undefined,
    quanshuLimitBranches(n, { ...verifiedLimits, minorIndex: allegedLimit }));
  assert.deepEqual(wrongMinor.pojunCase.guardingLimits, []);
  assert.equal(wrongMinor.tigerAtPojunLimitCandidate, undefined);
  const runWithWrongMinor = { ...near.run, facts: [{ ...near.fact, normalizedPayload: wrongMinor }] };
  assert.equal(transformationMatch(runWithWrongMinor, 'expansion-p023').status, 'unknown');

  const wrongDecadalLimits = quanshuLimitBranches(n, { ...verifiedLimits, decadalIndex: allegedLimit });
  assert.equal(wrongDecadalLimits.sourceDecadal.verified, false);
  const wrongDecadal = quanshuAnnualSha(n, quanshuAnnualContext(n, 1999, '己'), near.data.yearBranch, undefined, wrongDecadalLimits);
  assert.deepEqual(wrongDecadal.pojunCase.guardingLimits, []);
  assert.equal(wrongDecadal.tigerAtPojunLimitCandidate, undefined);
  assert.equal(transformationMatch({ ...near.run, facts: [{ ...near.fact, normalizedPayload: wrongDecadal }] }, 'expansion-p023').status, 'unknown');

  const decadal = annualShaSample('1947-02-15', 1, 1966);
  assert.deepEqual(decadal.data.pojunCase.annualTiger, { branch: '寅', relation: '守' });
  assert.deepEqual(decadal.data.pojunCase.guardingLimits, ['decadal']);
  assert.equal(decadal.data.tigerAtPojunLimitCandidate, true);
  assert.equal(transformationMatch(decadal.run, 'expansion-p023').status, 'partial');
});

test('p023 separates Wang natal Pojun Hua Lu from the Gui year and keeps overall control unresolved', () => {
  const positive = annualShaSample('1953-05-05', 3, 1997);
  const yearlyOnly = annualShaSample('1954-05-05', 8, 1993);
  assert.deepEqual(positive.data.pojunWangNativeHuaLuWitness, {
    branch: '巳', birthStem: '癸', guardingLimits: ['decadal'], annualSha: [{ star: '陀罗', branch: '巳' }],
  });
  assert.deepEqual(yearlyOnly.data.pojunCase.guardingLimits, ['minor']);
  assert.deepEqual([positive.data.pojunWangNativeHuaLuSupport, positive.data.pojunYearlyHuaLuContact], [true, false]);
  assert.deepEqual([yearlyOnly.data.pojunWangNativeHuaLuSupport, yearlyOnly.data.pojunYearlyHuaLuContact], [false, true]);
  assert.equal(yearlyOnly.data.pojunWangNativeHuaLuWitness, undefined);
  for (const { run, fact, data } of [positive, yearlyOnly]) {
    assert.equal(data.pojunCase.candidate, true);
    assert.equal(data.pojunCase.namedReliefInArea, false);
    assert.equal(data.effectiveControl, 'unresolved');
    const match = transformationMatch({ ...run, facts: [fact] }, 'expansion-p023');
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'pojun-wang-lu'));
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));
    assert.match(formatFortuneFactAudit(input), data.pojunWangNativeHuaLuSupport
      ? /按王亭之释法，生年癸使破军化禄.*守巳宫的大限/u : /另核流年癸发破军化禄，保留在丑宫的流年发干层/u);
    assert.doesNotMatch(formatFortunePrompt(input), /王亭之|另核流年癸发破军化禄|pojunWangNativeHuaLu|pojunYearlyHuaLuContact/u);
  }
  const neighbor = annualShaSample('1953-05-05', 3, 1998);
  assert.equal(neighbor.data.pojunWangNativeHuaLuSupport, false);
  assert.equal(neighbor.data.pojunWangNativeHuaLuWitness, undefined);
  const natal = native('1953-05-05', 3);
  const annual = quanshuAnnualContext(natal, 1997, '丁');
  assert.equal(quanshuAnnualSha(natal, annual, '丑').pojunWangNativeHuaLuSupport, undefined);
  const palace = natal.palaces.find(row => row.earthlyBranch === '巳');
  palace.minorStars.push(...palace.majorStars.filter(row => row.name === '破军'));
  palace.majorStars = palace.majorStars.filter(row => row.name !== '破军');
  const wrongLayer = quanshuAnnualSha(natal, annual, '丑');
  assert.equal(wrongLayer.pojunWangNativeHuaLuSupport, undefined);
  assert.equal(wrongLayer.pojunWangNativeHuaLuWitness, undefined);
});

test('p023 adds a verified Jielan fallen Pojun in the annual directional Sha group', () => {
  const { run, fact, data } = annualShaSample('1947-02-15', 4, 1963);
  for (const field of ['yearlyShaCandidate', 'jielanBellTigerCandidate', 'tigerAtPojunLimitCandidate', 'quanshuFixedBellTigerCandidate']) {
    assert.equal(data[field], false);
  }
  assert.equal(data.pojunJielanMinorFlowShaCandidate, true);
  assert.equal(data.pojunCase.namedReliefInArea, false);
  assert.equal(data.reliefPlacementProof, 'quanshu-native-minor-lucun-v1');
  assert.deepEqual(data.pojunJielanMinorFlowShaWitness, {
    minorBranch: '酉', branches: ['申', '酉', '戌'], grade: '陷', annualRelation: '冲', relief: [
      { star: '天梁', layer: 'natal', branch: '辰', relation: '其他' },
      { star: '禄存', layer: 'natal', branch: '午', relation: '其他' },
      { star: '禄存', layer: 'yearly', branch: '子', relation: '其他' },
    ],
  });
  const hit = transformationMatch(run, 'expansion-p023');
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jielan-pojun-flow-sha'));
  assert.match(formatFortuneFactAudit(input), /按《捷览》星表，破军陷于酉宫。复算小限实守该宫，也落在当年流煞组申、酉、戌/u);
  assert.doesNotMatch(formatFortunePrompt(input), /按《捷览》星表，破军陷于酉宫|pojunJielanMinorFlowShaWitness/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  const wrongProfile = { ...fact, normalizedPayload: { ...data, jielanDignityProfile: 'unverified' } };
  assert.equal(transformationMatch({ ...run, facts: [wrongProfile] }, 'expansion-p023').status, 'not_matched');
  for (const year of [1962, 1964]) assert.equal(annualShaSample('1947-02-15', 4, year).data.pojunJielanMinorFlowShaCandidate, false);
  const n = native('1947-02-15', 4), annual = quanshuAnnualContext(n, 1963, data.annualStem);
  assert.equal(quanshuAnnualSha(n, annual, data.yearBranch).pojunJielanMinorFlowShaCandidate, undefined);
  const shiftedLu = archiveMinorInWrongLayer(n, '禄存');
  const h = astro.withOptions({ dateStr: '1947-02-15', timeIndex: 4, gender: '女', fixLeap: true, config })
    .horoscope('1963-06-01', 6);
  const frame = { lunarYear: 1963, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const wrongLayer = quanshuAnnualSha(shiftedLu, quanshuAnnualContext(shiftedLu, 1963, data.annualStem), data.yearBranch, undefined,
    quanshuLimitBranches(shiftedLu, frame));
  assert.equal(wrongLayer.pojunCase.namedReliefInArea, undefined);
  assert.equal(wrongLayer.pojunJielanMinorFlowShaCandidate, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 'expansion-p023').status, 'unknown');
  const withoutProof = { ...fact, normalizedPayload: { ...data, reliefPlacementProof: undefined } };
  assert.equal(transformationMatch({ ...run, facts: [withoutProof] }, 'expansion-p023').status, 'unknown');
});

test('generic palace facts, an unbound year, and a missing or neighboring sha cannot satisfy the reviewed finds', () => {
  const natal = native('1947-02-05', 9);
  const run = calculate(chart(natal), 'year', { year: 1995 });
  const fact = annualShaFact(run, 1995), payload = fact.normalizedPayload;
  assert.equal(payload.migrations[1].fireSeat, true);
  assert.equal(payload.migrations[1].tanlangRelation, '守');
  assert.equal(payload.migrations[1].pojunRelation, '三合');
  assert.equal(payload.migrationFireCandidate, false);
  assert.equal(payload.yearlyShaCandidate, false);
  assert.ok(run.facts.some(row => row.factType === 'palace_condition' && row.scope === 'yearly'
    && row.activeFrom === fact.activeFrom && row.normalizedPayload.flowName === '命宫'
    && row.normalizedPayload.surroundingStarNames.some(star => ['擎羊', '陀罗', '火星', '铃星'].includes(star))));
  const currentSlice = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const genericOnly = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType) };
  for (const id of ['expansion-p007', 'expansion-p023']) {
    assert.equal(transformationMatch(currentSlice, id).status, 'not_matched');
    assert.equal(transformationMatch(genericOnly, id).status, 'unknown');
    const rule = fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(id + '-001'));
    const entry = fortuneKnowledge.ziwei.entries.find(row => row.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
  const annual = quanshuAnnualContext(natal, 2007, '丁');
  assert.equal(quanshuAnnualSha(natal, annual, '子', '午').ready, false);
  assert.equal(quanshuAnnualSha(natal, annual, '亥', '辰').migrationFireCandidate, undefined);
  const duplicated = structuredClone(natal);
  const pojun = duplicated.palaces.flatMap(row => row.majorStars).find(row => row.name === '破军');
  duplicated.palaces[0].majorStars.push(pojun);
  assert.equal(quanshuAnnualSha(duplicated, quanshuAnnualContext(duplicated, 2007, '丁'), '亥', '巳').migrationFireCandidate, undefined);
});

test('two source combination passages reach SQLite with same-star and same-limit-slice witnesses', () => {
  const natal = native('1947-02-05', 9), run = calculate(chart(natal), 'year', { year: 2015 });
  validateFortuneFacts(run);
  const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === 2015);
  const payload = fact.normalizedPayload;
  assert.equal(fact.activeFrom, '2015-02-18T16:00:00.000Z');
  assert.equal(fact.activeTo, run.time.displayWindow.instantRange.endInstantExclusive);
  assert.ok(fact.sourceFactIds.length >= 2);
  const pair = payload.starPairs.find(row => row.candidate);
  assert.deepEqual([pair.primary, pair.companion, pair.primaryBranch, pair.companionBranch, pair.minorRelation], ['陀罗', '贪狼', '巳', '巳', '守']);
  assert.deepEqual(payload.majorContacts.filter(row => row.candidate).map(row =>
    [row.star, row.branch, row.grade, row.decadalRelation, row.minorRelation, row.lifeRelation, row.bodyRelation]),
  [['贪狼', '巳', '陷', '冲', '守', '守', '冲'], ['廉贞', '巳', '陷', '冲', '守', '守', '冲']]);
  const passages = ['expansion-p016', 'expansion-p024'];
  const matches = passages.map(passage => transformationMatch(run, passage));
  for (const match of matches) {
    assert.equal(match.status, 'partial');
    assert.ok(match.sourceFactIds.includes(fact.factId));
    const rule = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId === match.knowledgeId);
    const entry = fortuneKnowledge.ziwei.entries.find(entry => entry.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'limits-and-combinations'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /陀罗与贪狼同在巳宫，小限命宫也在此宫/u);
  assert.match(prompt, /本命贪狼在巳宫，与在亥宫的大限命宫为冲，与小限命宫同在巳宫/u);
  assert.doesNotMatch(prompt, /quanshu_limit_combinations|fourMajorsCandidate|yangTuoCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => matches.some(match => match.knowledgeId === item.knowledgeId)));
  assert.deepEqual(payload.sourceDecadal, { branch: '亥', verified: true });
  const frame = combinationFrame(natal, payload);
  const damaged = quanshuLimitCombinations(copyWithShiftedDecade(natal, frame), frame);
  assert.deepEqual(damaged.sourceDecadal, { branch: '亥', verified: false });
  assert.equal(damaged.decadalBranch, undefined);
  assert.equal(damaged.sourceMinorVerified, true);
  assert.equal(damaged.minorBranch, '巳');
  assert.equal(damaged.splitMajorPairCandidate, undefined);
  const isolate = normalizedPayload => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
  assert.equal(transformationMatch(isolate(damaged), passages[0]).status, 'partial');
  assert.equal(transformationMatch(isolate(damaged), passages[1]).status, 'unknown');
  const { limitPlacementProof, ...olderFact } = payload;
  assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
  for (const passage of passages) assert.equal(transformationMatch(isolate(olderFact), passage).status, 'unknown');
});

test('Yang and Tuo related stars and product-coordinate fire and bell are checked as separate pairs', () => {
  const samples = [
    ['1947-02-05', 7, { lunarYear: 2003, yearIndex: 5, decadalIndex: 10, minorIndex: 3 }, [['陀罗', '太阳'], ['陀罗', '铃星']]],
    ['1947-02-05', 8, { lunarYear: 2003, yearIndex: 5, decadalIndex: 9, minorIndex: 3 }, [['陀罗', '太阳'], ['陀罗', '火星']]],
    ['1988-10-22', 5, { lunarYear: 2002, yearIndex: 4, decadalIndex: 2, minorIndex: 6 }, [['陀罗', '太阴']]],
    ['1988-10-22', 5, { lunarYear: 2004, yearIndex: 6, decadalIndex: 2, minorIndex: 4 }, [['陀罗', '太阴'], ['擎羊', '巨门']]],
    ['1985-01-01', 3, { lunarYear: 2027, yearIndex: 5, decadalIndex: 3, minorIndex: 1 }, [['擎羊', '贪狼']]],
  ];
  for (const [birth, hour, frame, expected] of samples) {
    const fact = quanshuLimitCombinations(native(birth, hour), frame);
    const pairs = fact.starPairs.filter(row => row.candidate);
    assert.deepEqual(pairs.map(row => [row.primary, row.companion]), expected);
    assert.ok(pairs.every(row => row.sameSeat && (row.decadalRelation === '守' || row.minorRelation === '守')));
    assert.ok(pairs.every(row => row.archiveFireBell === ['火星', '铃星'].includes(row.companion)));
  }
  const [birth, hour, frame] = samples[0];
  const natal = native(birth, hour);
  const bellSeat = natal.palaces.find(palace => palace.minorStars.some(star => star.name === '铃星'));
  bellSeat.minorStars = bellSeat.minorStars.filter(star => star.name !== '铃星');
  const withoutBell = quanshuLimitCombinations(natal, frame);
  assert.equal(withoutBell.starPairs.find(row => row.primary === '陀罗' && row.companion === '铃星').candidate, undefined);
  assert.ok(withoutBell.starPairs.some(row => row.companion === '太阳' && row.candidate === true));
});

test('Tuo and both verified auxiliary pairs reach SQLite only at the trine and active seat', () => {
  const assistants = combinationSample('1979-07-15', 2, 1999);
  const literary = combinationSample('1980-03-11', 3, 1995);
  for (const [sample, trines, names] of [[assistants, ['守', '三合'], ['左辅', '右弼']], [literary, ['三合', '其他'], ['文昌', '文曲']]]) {
    const { run, fact, data } = sample;
    assert.equal(data.yangTuoCandidate, false);
    assert.equal(data.tuoHelperPairCandidate, true);
    assert.deepEqual([data.tuoLife, data.tuoBody], trines);
    assert.deepEqual(data.auxiliaryGroups.map(group => group.stars.map(star => star.star)), [names]);
    const match = transformationMatch(run, 'expansion-p016');
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
  }
  assert.match(combinationPrompt(literary.run), /三合本命命宫，整对会到此宫的辅曜为未宫的文昌（守）、未宫的文曲（守）/u);
  const wrongLimit = combinationSample('1980-03-11', 3, 1996);
  assert.equal(transformationMatch(wrongLimit.run, 'expansion-p016').status, 'not_matched');
  const natal = native('1980-03-11', 3);
  const seat = natal.palaces.find(palace => palace.earthlyBranch === '未');
  seat.minorStars = seat.minorStars.filter(star => star.name !== '文曲');
  const missing = quanshuLimitCombinations(natal, { lunarYear: 1995, yearIndex: 9, decadalIndex: 8, minorIndex: 5 });
  assert.equal(missing.tuoHelperPairCandidate, undefined);
  assert.deepEqual(missing.auxiliaryGroups, []);
});

test('natal and yearly Quan retain separate witnesses while Yang, Qisha and the recipient must share the active seat', () => {
  const natalQuan = combinationSample('1980-03-11', 1, 2005);
  const yearlyQuan = combinationSample('1984-09-15', 4, 2010);
  for (const [sample, layer, branch] of [[natalQuan, 'natal', '酉'], [yearlyQuan, 'yearly', '卯']]) {
    assert.equal(sample.data.yangTuoCandidate, false);
    assert.equal(sample.data.yangQuanShaCandidate, true);
    assert.deepEqual(sample.data.quanShaGroups, [{ layer, stem: '庚', star: '武曲', branch, candidate: true }]);
    assert.equal(transformationMatch(sample.run, 'expansion-p016').status, 'partial');
  }
  assert.match(combinationPrompt(yearlyQuan.run), /本命擎羊、七杀和流年干庚所化权的武曲同守卯宫/u);
  const natal = native('1980-03-11', 1);
  const seat = natal.palaces.find(palace => palace.earthlyBranch === '酉');
  const qisha = seat.majorStars.find(star => star.name === '七杀');
  seat.majorStars = seat.majorStars.filter(star => star !== qisha);
  natal.palaces.find(palace => palace.earthlyBranch === '丑').majorStars.push(qisha);
  const separated = quanshuLimitCombinations(natal, combinationFrame(natal, natalQuan.data));
  assert.equal(separated.sourceDecadal.verified, true);
  assert.equal(separated.sourceMinorVerified, true);
  assert.equal(separated.yangQuanShaCandidate, undefined);
  assert.deepEqual(separated.quanShaGroups, []);
});

test('Tanlang and Pojun require distinct real annual and limit guards in either direction', () => {
  for (const [hour, year, annualStar, yearSeat, limitStar, limitSeat] of [
    [0, 2023, '贪狼', '卯', '破军', '亥'], [6, 1998, '破军', '寅', '贪狼', '午'],
  ]) {
    const { run, fact, data } = combinationSample('1979-07-15', hour, year);
    assert.equal(data.yangTuoCandidate, false);
    assert.equal(data.tanHaoAnnualCandidate, true);
    assert.deepEqual(data.tanHaoGroups.map(row => [row.annualStar, row.yearSeat, row.limitStar, row.limitSeat]),
      [[annualStar, yearSeat, limitStar, limitSeat]]);
    const match = transformationMatch(run, 'expansion-p016');
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.match(combinationPrompt(run), /以破军化耗核贪耗候选.+二曜三合/u);
  }
  const neighboringYear = combinationSample('1979-07-15', 6, 1997);
  assert.equal(neighboringYear.data.tanHaoAnnualCandidate, false);
});

test('two distinct named majors opposite their own limits can match without the single-star path', () => {
  const { run, fact, data } = combinationSample('1979-07-15', 8, 2011);
  assert.equal(data.fourMajorsCandidate, false);
  assert.equal(data.splitMajorPairCandidate, true);
  assert.deepEqual(data.splitMajorPairs.map(row => [row.decadal.star, row.minor.star, row.bothOppose, row.contact]),
    [['破军', '贪狼', true, '三合'], ['破军', '廉贞', true, '三合']]);
  const match = transformationMatch(run, 'expansion-p024');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const prompt = combinationPrompt(run);
  assert.match(prompt, /大小限对宫分别有具名星，两星所在宫的关系为三合/u);
  assert.match(prompt, /本命破军在未宫，与在丑宫的大限命宫为冲/u);
  assert.doesNotMatch(prompt, /splitMajorPairCandidate|auxiliaryGroups|yangQuanShaCandidate|quanshu_limit_combinations/u);
  const bothGuard = combinationSample('1979-07-15', 4, 2029);
  assert.ok(bothGuard.data.splitMajorPairs.some(row => row.bothGuard && row.decadal.star === '破军' && row.minor.star === '贪狼'));
  const neighboringYear = combinationSample('1979-07-15', 8, 2010);
  assert.equal(transformationMatch(neighboringYear.run, 'expansion-p024').status, 'not_matched');
});

test('generic seats, separated partners and missing or inconsistent coordinates cannot replace a combination', () => {
  const run = calculate(chart(native('1947-02-05', 0)), 'year', { year: 2000 });
  const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === 2000);
  assert.equal(fact.normalizedPayload.yangTuoCandidate, false);
  assert.equal(fact.normalizedPayload.fourMajorsCandidate, false);
  assert.ok(fact.normalizedPayload.starPairs.some(row => row.minorRelation === '守' || row.decadalRelation === '守'));
  assert.ok(fact.normalizedPayload.majorContacts.some(row => row.minorRelation === '守' || row.decadalRelation === '守'));
  const currentSlice = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const genericOnly = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType) };
  for (const id of ['expansion-p016', 'expansion-p024']) {
    assert.equal(transformationMatch(currentSlice, id).status, 'not_matched');
    assert.equal(transformationMatch(genericOnly, id).status, 'unknown');
  }
  const natal = native('1947-02-05', 9);
  const frame = { lunarYear: 2015, yearIndex: 5, decadalIndex: 9, minorIndex: 3 };
  const noMinor = quanshuLimitCombinations(natal, { ...frame, minorIndex: undefined });
  assert.equal(noMinor.yangTuoCandidate, undefined);
  assert.equal(noMinor.fourMajorsCandidate, undefined);
  assert.equal(quanshuLimitCombinations(natal, { ...frame, yearIndex: 9 }).ready, false);
  const duplicate = structuredClone(natal);
  duplicate.palaces[0].majorStars.push(duplicate.palaces.flatMap(row => row.majorStars).find(row => row.name === '贪狼'));
  const ambiguous = quanshuLimitCombinations(duplicate, frame);
  assert.equal(ambiguous.starPairs.find(row => row.primary === '陀罗' && row.companion === '贪狼').candidate, undefined);
  assert.equal(ambiguous.fourMajorsCandidate, undefined);
});

test('p016 can bind a Ming fixed Fire and a blade guarding one real limit without invoking the archive', () => {
  const birth = '1974-02-05', hour = 1, year = 1982;
  const { run, fact, data } = combinationSample(birth, hour, year);
  assert.ok(![data.yangTuoCandidate, data.tuoHelperPairCandidate, data.yangQuanShaCandidate, data.tanHaoAnnualCandidate].some(Boolean));
  assert.equal(data.mingFixedBladeFireBellCandidate, true);
  assert.deepEqual(data.mingFixedBladeFireBellPairs, [{ primary: '陀罗', primaryBranch: '丑',
    companion: '火星', companionBranch: '丑', sameSeat: true, decadalRelation: '守', minorRelation: '其他', candidate: true }]);
  const hit = transformationMatch(run, 'expansion-p016');
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-blade-fire'));
  assert.match(formatFortuneFactAudit(input), /明刊定宫火星与陀罗同守/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊定宫火星与陀罗同守/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(transformationMatch({ ...run, facts: [wrong] }, 'expansion-p016').status, 'not_matched');
  const n = native(birth, hour), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const unplaced = quanshuLimitCombinations(n,
    { lunarYear: year, yearIndex: index('戌'), minorIndex: index('申') });
  assert.equal(unplaced.mingFixedBladeFireBellCandidate, undefined);
  const unverifiedGuard = quanshuLimitCombinations(n,
    { lunarYear: year, yearIndex: index('戌'), minorIndex: index('丑') });
  assert.equal(unverifiedGuard.sourceMinorVerified, false);
  assert.equal(unverifiedGuard.minorBranch, undefined);
  assert.equal(unverifiedGuard.mingFixedBladeFireBellCandidate, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: unverifiedGuard }] }, 'expansion-p016').status, 'unknown');
  const frame = combinationFrame(n, data);
  const damaged = quanshuLimitCombinations(copyWithShiftedDecade(n, frame), frame);
  assert.deepEqual(damaged.sourceDecadal, { branch: '丑', verified: false });
  assert.equal(damaged.sourceMinorVerified, true);
  assert.equal(damaged.mingFixedBladeFireBellCandidate, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: damaged }] }, 'expansion-p016').status, 'unknown');
});

test('p016 confirms the Ming co-seated blade and fixed Fire or Bell only at two real limits', () => {
  const cases = [
    ['1974-02-05', 4, 2073, '丑', '陀罗', '火星', '2073-02-06T16:00:00.000Z'],
    ['1972-02-15', 0, 2020, '戌', '陀罗', '铃星', '2020-01-24T16:00:00.000Z'],
    ['1961-07-15', 0, 1994, '戌', '擎羊', '铃星', '1994-02-09T16:00:00.000Z'],
  ];
  const field = 'mingFixedBladeFireBellDoubleGuardCandidate';
  for (const [dateStr, timeIndex, year, branch, primary, companion, start] of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }), natal = engine.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-fixed-blade-double', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.equal(data[field], true);
    assert.deepEqual([data.mingBladeDarkDoubleGuardCandidate, data.mingTuoTanlangDoubleGuardCandidate], [false, false]);
    assert.deepEqual(data.mingFixedBladeFireBellDoubleGuardWitnesses, [{ primary, primaryBranch: branch,
      companion, companionBranch: branch, sameSeat: true, decadalRelation: '守', minorRelation: '守', candidate: true }]);
    const scoped = { ...run, facts: [fact] }, hit = transformationMatch(scoped, 'expansion-p016');
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), archive.snapshotId));
    assert.match(formatFortunePrompt(input), /火星或铃星/u);
    assert.doesNotMatch(formatFortunePrompt(input), /mingFixedBladeFireBellDoubleGuard|[丑戌]宫/u);
    const verify = (archive, lunarYear, revise = frame => frame) => {
      const h = engine.horoscope(lunarYear + '-06-15', 6);
      return quanshuLimitCombinations(archive, revise({ lunarYear, yearIndex: h.yearly.index,
        decadalIndex: h.decadal.index, minorIndex: h.age.index }));
    };
    const badMinor = verify(natal, year, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
    for (const wrong of [badMinor, verify(archiveMinorInWrongLayer(natal, primary), year)]) {
      assert.equal(wrong[field], undefined);
      assert.deepEqual(wrong.mingFixedBladeFireBellDoubleGuardWitnesses, []);
      assert.notEqual(transformationMatch({ ...scoped, facts: [{ ...fact, normalizedPayload: wrong }] }, 'expansion-p016').status, 'matched');
    }
    assert.equal(verify(natal, year + 1)[field], false);
  }
});

test('p016 and p024 confirm named source combinations only on the same verified double-guard segment', () => {
  const cases = [
    { dateStr: '1980-03-15', timeIndex: 7, gender: '男', year: 2003, branch: '酉', passage: '016',
      candidate: 'mingBladeDarkDoubleGuardCandidate', witness: 'mingBladeDarkDoubleGuardWitness', wrong: '擎羊',
      condition: /擎羊化刑、巨门化暗/u, audit: '按明刊刑暗一支，复算大小限同守酉宫的本命擎羊和巨门' },
    { dateStr: '1990-02-15', timeIndex: 5, gender: '女', year: 2011, branch: '未', passage: '016',
      candidate: 'mingTuoTanlangDoubleGuardCandidate', witness: 'mingTuoTanlangDoubleGuardWitness', wrong: '陀罗',
      condition: /陀罗化气为忌/u, audit: '按明刊陀忌会贪一支，复算大小限同守未宫的本命陀罗和贪狼' },
    { dateStr: '1950-09-15', timeIndex: 1, gender: '女', year: 1998, branch: '辰', passage: '024',
      candidate: 'fallenJumenDoubleGuardCandidate', witness: 'fallenJumenDoubleGuardWitness', wrong: '巨门',
      condition: /本命身、命须各在独立宫位/u, audit: '复算大小限同守辰宫的陷地巨门，本命身宫与命宫均会该宫' },
  ];
  for (const { dateStr, timeIndex, gender, year, branch, passage, candidate, witness, wrong, condition, audit } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: `named-double-guard-${year}`, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data[candidate], true);
    const row = data[witness];
    assert.deepEqual([row.decadalRelation, row.minorRelation, data.decadalBranch, data.minorBranch], ['守', '守', branch, branch]);
    if (passage === '024') assert.deepEqual([data.lifeBranch, data.bodyBranch, row.lifeRelation, row.bodyRelation, row.grade],
      ['申', '戌', '三合', '冲', '陷']);
    const isolate = (normalizedPayload = data) => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
    const evaluate = data => transformationMatch(isolate(data), `expansion-p${passage}`);
    const hit = evaluate(data);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

    const frame = combinationFrame(natal, data);
    const next = engine.horoscope(`${year + 1}-06-01`, 6);
    const neighbor = quanshuLimitCombinations(natal, { lunarYear: year + 1, yearIndex: next.yearly.index,
      decadalIndex: next.decadal.index, minorIndex: next.age.index });
    assert.equal(neighbor[candidate], false);
    assert.notEqual(evaluate(neighbor).status, 'matched');
    const wrongLimit = quanshuLimitCombinations(natal, { ...frame, minorIndex: next.age.index });
    assert.equal(wrongLimit[candidate], undefined);
    assert.notEqual(evaluate(wrongLimit).status, 'matched');

    const malformed = structuredClone(natal), from = passage === '016' ? 'minorStars' : 'majorStars';
    const host = malformed.palaces.find(palace => palace[from].some(star => star.name === wrong));
    const [misplaced] = host[from].splice(host[from].findIndex(star => star.name === wrong), 1);
    host.adjectiveStars.push(misplaced);
    const wrongLayer = quanshuLimitCombinations(malformed, frame);
    assert.equal(wrongLayer[candidate], undefined);
    assert.equal(wrongLayer[witness], undefined);
    assert.notEqual(evaluate(wrongLayer).status, 'matched');

    const scope = isolate();
    const { input } = buildFortuneModelContext(scope, interpretFortune(scope, requestForFortuneRun(scope), ref.snapshotId));
    assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === hit.knowledgeId));
    assert.ok(formatFortuneFactAudit(input).includes(audit));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, condition);
    assert.ok(!prompt.includes(candidate) && !prompt.includes(witness) && !prompt.includes(audit));
  }
});

test('p024 confirms the printed fallen Po Jun, Tan Lang and Lian Zhen positions with both real limits', () => {
  for (const [timeIndex, year, branch, life, body, names] of [
    [7, 2055, '卯', '酉', '亥', ['破军']],
    [11, 2059, '亥', '巳', '卯', ['贪狼', '廉贞']],
  ]) {
    const archive = astro.withOptions({ dateStr: '1988-05-15', timeIndex, gender: '女', fixLeap: true, config });
    const natal = archive.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: `fallen-named-majors-${year}`, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const fact = combinationFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.equal(data.fallenTanPoLianDoubleGuardCandidate, true);
    assert.equal(data.fallenJumenDoubleGuardCandidate, false);
    assert.deepEqual([data.decadalBranch, data.minorBranch, data.lifeBranch, data.bodyBranch], [branch, branch, life, body]);
    assert.deepEqual(data.fallenTanPoLianDoubleGuardWitnesses.map(row => [row.star, row.branch, row.grade,
      row.decadalRelation, row.minorRelation, row.lifeRelation, row.bodyRelation]),
      names.map(star => [star, branch, '陷', '守', '守', '冲', '三合']));

    const isolate = (normalizedPayload = data) => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
    const evaluate = payload => transformationMatch(isolate(payload), 'expansion-p024');
    const hit = evaluate(data);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(fact.activeFrom, new Date(quanshuLunarMidnight(year, 1)).toISOString());

    const frame = combinationFrame(natal, data);
    const following = archive.horoscope(`${year + 1}-06-01`, 6);
    const nextYear = quanshuLimitCombinations(natal, { lunarYear: year + 1, yearIndex: following.yearly.index,
      decadalIndex: following.decadal.index, minorIndex: following.age.index });
    assert.equal(nextYear.fallenTanPoLianDoubleGuardCandidate, false);
    assert.notEqual(evaluate(nextYear).status, 'matched');
    const wrongMinor = quanshuLimitCombinations(natal, { ...frame, minorIndex: following.age.index });
    assert.equal(wrongMinor.fallenTanPoLianDoubleGuardCandidate, undefined);
    assert.notEqual(evaluate(wrongMinor).status, 'matched');
    const wrongBody = quanshuLimitCombinations({ ...natal, earthlyBranchOfBodyPalace: life }, frame);
    assert.equal(wrongBody.fallenTanPoLianDoubleGuardCandidate, undefined);
    assert.notEqual(evaluate(wrongBody).status, 'matched');

    const wrongStars = structuredClone(natal);
    for (let index = 0; index < names.length; index++) {
      const palace = wrongStars.palaces.find(row => row.earthlyBranch === branch);
      const [removed] = palace.majorStars.splice(palace.majorStars.findIndex(row => row.name === names[index]), 1);
      palace.adjectiveStars.push(removed);
      const revised = quanshuLimitCombinations(wrongStars, frame);
      const remaining = names.slice(index + 1);
      assert.deepEqual(revised.fallenTanPoLianDoubleGuardWitnesses.map(row => row.star), remaining);
      assert.equal(revised.fallenTanPoLianDoubleGuardCandidate, remaining.length ? true : undefined);
      assert.equal(evaluate(revised).status === 'matched', remaining.length > 0);
    }
    const scoped = isolate();
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), ref.snapshotId));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
    const audit = formatFortuneFactAudit(input), provider = formatFortunePrompt(input);
    for (const name of names) {
      const detail = '复算大小限同守' + branch + '宫的陷地' + name;
      assert.ok(audit.includes(detail));
      assert.ok(!provider.includes(detail));
    }
    assert.match(provider, /二限甚忌貪破巨廉/u);
    assert.doesNotMatch(provider, /fallenTanPoLianDoubleGuardWitnesses/u);
  }
});

test('p016 Ming blade, prison and killer share only a real limit with correctly placed natal stars', () => {
  const natal = native('1983-05-02', 9), year = 2007;
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'ming-blade-prison-killer' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const fact = combinationFacts(bound).find(row => row.normalizedPayload.lunarYear === year);
  const data = fact.normalizedPayload;
  for (const key of ['yangTuoCandidate', 'tuoHelperPairCandidate', 'yangQuanShaCandidate',
    'tanHaoAnnualCandidate', 'mingFixedBladeFireBellCandidate']) assert.equal(data[key], false, key);
  assert.equal(data.mingXingQiuShaCandidate, true);
  assert.deepEqual(data.mingXingQiuShaWitness, { branch: '丑', guardScopes: ['minor'] });
  assert.equal(data.decadalBranch, '申');
  const evaluate = (normalizedPayload, current = fact) => transformationMatch({
    ...bound, facts: [{ ...current, normalizedPayload }],
  }, 'expansion-p016');
  const match = evaluate(data);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), 'ming-blade-prison-killer'));
  const witness = /按明刊刑囚合杀一支，本命擎羊、廉贞、七杀同守丑宫，实际小限也守该宫/u;
  assert.match(formatFortuneFactAudit(input), witness);
  assert.doesNotMatch(formatFortunePrompt(input), witness);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
  assert.equal(evaluate({ ...data, mingXingQiuShaProfile: 'other-source' }).status, 'not_matched');
  const preceding = combinationFacts(bound).find(row => row.normalizedPayload.lunarYear === year - 1);
  assert.equal(preceding.normalizedPayload.sourceMinorVerified, true);
  assert.equal(preceding.normalizedPayload.mingXingQiuShaCandidate, false);

  const frame = combinationFrame(natal, data);
  const wrongMinor = quanshuLimitCombinations(natal, { ...frame, minorIndex: frame.decadalIndex });
  assert.equal(wrongMinor.sourceMinorVerified, false);
  assert.equal(wrongMinor.mingXingQiuShaCandidate, undefined);
  assert.equal(wrongMinor.mingXingQiuShaWitness, undefined);
  assert.equal(evaluate(wrongMinor).status, 'unknown');
  const badNatal = structuredClone(natal);
  const seat = badNatal.palaces.find(row => row.earthlyBranch === '丑');
  const lianzhen = seat.majorStars.find(row => row.name === '廉贞');
  seat.majorStars = seat.majorStars.filter(row => row !== lianzhen);
  badNatal.palaces.find(row => row.earthlyBranch === '寅').majorStars.push(lianzhen);
  const damaged = quanshuLimitCombinations(badNatal, frame);
  assert.equal(damaged.mingXingQiuShaCandidate, undefined);
  assert.equal(damaged.mingXingQiuShaWitness, undefined);
  assert.equal(evaluate(damaged).status, 'unknown');
});

test('a neighboring archive minor cannot complete the split two-limit star witnesses', () => {
  const birth = '1979-07-15', hour = 8, year = 2010;
  const { run, fact, data } = combinationSample(birth, hour, year);
  const { data: next } = combinationSample(birth, hour, year + 1);
  assert.equal(data.sourceMinorVerified, true);
  assert.equal(next.sourceMinorVerified, true);
  assert.equal(next.splitMajorPairCandidate, true);
  assert.notEqual(data.minorBranch, next.minorBranch);
  const n = native(birth, hour), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const wrong = quanshuLimitCombinations(n, { lunarYear: year, yearIndex: index(data.annualBranch),
    decadalIndex: index(data.decadalBranch), minorIndex: index(next.minorBranch) });
  assert.equal(wrong.sourceMinorVerified, false);
  assert.equal(wrong.minorBranch, undefined);
  assert.equal(wrong.splitMajorPairCandidate, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrong }] }, 'expansion-p024').status, 'unknown');
});

test('six transformation passages query actual whole-group witnesses in their own year and source layer', () => {
  const samples = [
    ['zhuxing-wenda-p154000', 'minorNatalLuGuard', '1947-02-05', 3, 1995],
    ['zhuxing-wenda-p155000', 'decadalNatalQuanSha', '1947-02-05', 0, 2044],
    ['zhuxing-wenda-p157000', 'tripleNatalJiGuard', '1947-02-05', 9, 1966],
    ['expansion-p015', 'femaleLuSupportCandidate', '1980-03-11', 0, 1996],
    ['expansion-p026', 'tianjiNatalSanHuaCandidate', '1947-02-05', 1, 1967],
    ['expansion-p042', 'natalQuanLuJiShaAtLimit', '1949-03-19', 3, 1961],
  ];
  const runs = new Map();
  for (const [passage, flag, birth, hour, year] of samples) {
    const key = [birth, hour, year].join(':');
    if (!runs.has(key)) runs.set(key, calculate(completeQuanshuBirth(birth, hour), 'year', { year }));
    const run = runs.get(key);
    validateFortuneFacts(run);
    const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === year && row.normalizedPayload[flag] === true);
    assert.ok(fact, passage);
    const match = transformationMatch(run, passage);
    const complete = ['zhuxing-wenda-p154000', 'zhuxing-wenda-p157000'].includes(passage);
    assert.equal(match.status, complete ? 'matched' : 'partial', passage);
    assert.ok(flag === 'tianjiNatalSanHuaCandidate' ? run.facts.some(row => tianjiTimedFact(row)
      && row.normalizedPayload.lunarYear === year && match.sourceFactIds.includes(row.factId))
      : match.sourceFactIds.includes(fact.factId), passage);
    assert.ok(fact.sourceFactIds.length >= 2);
    const rule = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId === match.knowledgeId);
    const entry = fortuneKnowledge.ziwei.entries.find(entry => entry.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    if (flag === 'tripleNatalJiGuard') {
      const p = fact.normalizedPayload;
      assert.equal(p.annualBranch, p.decadalBranch);
      assert.equal(p.annualBranch, p.minorBranch);
      assert.ok(p.seats.every(seat => seat.groups.some(group => group.stars.some(star => star.kind === '忌' && star.relation === '守'))));
      const [decadal, minor] = p.seats, emitter = decadal.groups.find(group => group.layer === 'natal');
      assert.deepEqual(emitter.tabooBenefics.map(row => [row.kind, row.star, row.branch, row.relation]),
        [['禄', '太阴', '辰', '其他'], ['权', '天同', '申', '其他'], ['科', '天机', '子', '冲']]);
      assert.equal(decadal.tabooFollowup.fourShaVisible, false);
      assert.equal(minor.tabooFollowup, undefined);
      assert.ok(match.windows.every(window => window.start < window.endExclusive));
    }
    if (flag === 'tianjiNatalSanHuaCandidate') {
      const seat = fact.normalizedPayload.seats.find(row => row.groups.some(group => group.layer === 'natal' && group.tianjiSanHua));
      const group = seat.groups.find(group => group.layer === 'natal');
      const palace = native(birth, hour).palaces.find(palace => palace.earthlyBranch === seat.branch);
      assert.ok(palace.majorStars.some(star => star.name === '天机'));
      assert.deepEqual(group.stars.filter(star => ['守', '冲', '三合'].includes(star.relation)).slice(0, 3).map(star => star.kind), ['禄', '权', '科']);
    }
    if (flag === 'natalQuanLuJiShaAtLimit') {
      const p = fact.normalizedPayload, seat = p.seats.find(row => row.groups.some(group => group.layer === 'natal' && group.jiSha));
      const group = seat.groups.find(row => row.layer === 'natal');
      assert.equal(group.stem, '己');
      assert.equal(seat.branch, '未');
      assert.deepEqual(group.stars.filter(star => star.relation === '守').map(star => star.kind).filter(kind => kind !== '科'), ['禄', '权', '忌']);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-transform-limits'));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, /生年同组权禄忌同守/u);
      assert.ok(!prompt.includes('jiSha') && !prompt.includes('quanshu-transform-limits-v1'));
    }
  }
});

test('Lu aids and same-emitter Quan-Lu-Ji cannot borrow the neighboring verified minor palace', () => {
  const birth = '1949-03-19', hour = 3, snapshot = completeQuanshuBirth(birth, hour);
  const positive = yearTransformation(snapshot, 1961);
  const nearby = yearTransformation(snapshot, 1959);
  assert.equal(positive.data.sourceMinor.verified, true);
  assert.equal(positive.data.minorBranch, '未');
  assert.ok(positive.data.femaleLuSupportCandidate && positive.data.natalQuanLuJiShaAtLimit);
  assert.equal(nearby.data.sourceMinor.verified, true);
  assert.equal(nearby.data.minorBranch, '酉');
  assert.equal(nearby.data.femaleLuSupportCandidate, false);
  assert.equal(nearby.data.natalQuanLuJiShaAtLimit, false);

  const n = native(birth, hour), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const wrong = quanshuTransformLimits(n, { lunarYear: 1959, yearIndex: index(nearby.data.annualBranch),
    decadalIndex: index(nearby.data.decadalBranch), minorIndex: index(positive.data.minorBranch) });
  assert.equal(wrong.sourceMinor.verified, false);
  assert.equal(wrong.minorBranch, '未');
  const raw = wrong.seats.find(row => row.layer === 'minor').groups.find(group => group.layer === 'natal');
  assert.equal(raw.stem, '己');
  assert.equal(raw.luSupportPair, true);
  assert.equal(raw.jiSha, true);
  assert.equal(wrong.femaleLuSupportCandidate, undefined);
  assert.equal(wrong.natalQuanLuJiShaAtLimit, undefined);
  const audit = describeFortuneFact({ method: 'ziwei', type: 'quanshu_transform_limits', data: wrong }, String);
  assert.match(audit, /复算的小限宫与归档不一致/u);
  assert.doesNotMatch(audit, /这一发干组的化禄与小限同宫|生年化禄实守小限/u);
  const inconsistent = { ...nearby.run, facts: [{ ...nearby.fact, normalizedPayload: wrong }] };
  for (const passage of ['expansion-p015', 'expansion-p042']) {
    assert.equal(transformationMatch(positive.run, passage).status, 'partial');
    assert.equal(transformationMatch(nearby.run, passage).status, 'not_matched');
    assert.equal(transformationMatch(inconsistent, passage).status, 'unknown');
  }
  const positiveFrame = combinationFrame(n, positive.data);
  const shifted = quanshuTransformLimits(copyWithShiftedDecade(n, positiveFrame), positiveFrame);
  assert.equal(shifted.sourceDecadal.verified, false);
  assert.equal(shifted.sourceMinor.verified, true);
  assert.equal(shifted.decadalNatalQuanAspectSha, undefined);
  assert.ok(shifted.femaleLuSupportCandidate && shifted.natalQuanLuJiShaAtLimit);
  const retainedMinor = { ...positive.run, facts: [{ ...positive.fact, normalizedPayload: shifted }] };
  assert.equal(transformationMatch(retainedMinor, 'zhuxing-wenda-p155000').status, 'unknown');
  for (const passage of ['expansion-p015', 'expansion-p042']) {
    assert.equal(transformationMatch(retainedMinor, passage).status, 'partial');
  }
});

test('three transformation rules reject a plausible archived decade without disabling a verified minor', () => {
  const cases = [
    ['1947-03-02', 6, 1961, [['zhuxing-wenda-p155000', 'decadalNatalQuanSha'], ['expansion-p042', 'volumeTwoNamedBirthStemJiReliefCandidate']]],
    ['1980-03-11', 0, 1996, [['expansion-p015', 'femaleLuSupportCandidate']]],
    ['1951-03-11', 10, 1996, [['expansion-p042', 'volumeTwoNamedBirthStemJiReliefCandidate']]],
  ];
  for (const [birth, hour, year, gates] of cases) {
    const { run, fact, data } = transformationSample(birth, hour, year);
    const natal = native(birth, hour), frame = combinationFrame(natal, data);
    const shifted = quanshuTransformLimits(copyWithShiftedDecade(natal, frame), frame);
    assert.deepEqual(shifted.sourceDecadal, { branch: data.decadalBranch, verified: false });
    assert.equal(shifted.sourceMinor.verified, true);
    assert.equal(shifted.seats.find(seat => seat.layer === 'minor').groups.some(group => group.layer === 'decadal'), false);
    const evaluate = (normalizedPayload, passage) => transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload }] }, passage);
    const { limitPlacementProof, ...outdated } = data;
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    for (const [passage, gate] of gates) {
      assert.equal(data[gate], true);
      const actual = evaluate(data, passage);
      assert.equal(actual.status, 'partial');
      assert.deepEqual(actual.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.equal(shifted[gate], undefined);
      assert.equal(evaluate(shifted, passage).status, 'unknown');
      assert.equal(evaluate(outdated, passage).status, 'unknown');
    }
    if (hour === 10) {
      const onlyMinor = shifted.seats.find(seat => seat.layer === 'minor');
      assert.ok(onlyMinor.groups.some(group => group.luNatalYangTuo || group.luFireTaboo));
      assert.equal(shifted.femaleLuShaCandidate, true);
      assert.equal(evaluate(shifted, 'expansion-p015').status, 'partial');
    }
  }
});

test('p015 does not borrow transformations from a wrong stem of either independently verified limit', () => {
  const dateStr = '1947-02-05', timeIndex = 0, year = 1984;
  const natal = native(dateStr, timeIndex);
  const { run, fact, data } = transformationSample(dateStr, timeIndex, year);
  const frame = combinationFrame(natal, data);
  const evaluate = normalizedPayload => transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload }] }, 'expansion-p015');
  const emitter = (payload, layer) => payload.seats.find(row => row.layer === 'decadal').groups.find(group => group.layer === layer);
  assert.equal(evaluate(data).status, 'not_matched');
  assert.deepEqual([data.decadalBranch, data.minorBranch], ['巳', '子']);
  assert.deepEqual([emitter(data, 'decadal').stem, emitter(data, 'minor').stem], ['乙', '壬']);
  for (const [layer, other] of [['decadal', 'minor'], ['minor', 'decadal']]) {
    const bad = structuredClone(natal);
    bad.palaces.find(row => row.index === frame[layer + 'Index']).heavenlyStem = '己';
    const altered = quanshuTransformLimits(bad, frame);
    assert.equal(altered.sourceDecadal.verified, true);
    assert.equal(altered.sourceMinor.verified, true);
    assert.equal(emitter(altered, layer).stem, undefined);
    assert.deepEqual(emitter(altered, layer).stars, []);
    for (const unaffected of ['natal', 'yearly', other]) {
      assert.deepEqual(emitter(altered, unaffected), emitter(data, unaffected));
    }
    assert.equal(altered.femaleLuSupportCandidate, undefined);
    const result = evaluate(altered);
    assert.equal(result.status, 'unknown');
    assert.deepEqual(result.sourceFactIds, []);
  }
});

test('p155 requires natal Quan and its named witness in the same actual opposition or trine palace', () => {
  const snapshot = completeQuanshuBirth('1947-02-05', 0);
  for (const [year, relation] of [[1980, '冲'], [2002, '三合']]) {
    const { run, fact, data } = yearTransformation(snapshot, year);
    assert.equal(data.decadalNatalQuanSha, false);
    assert.equal(data.decadalNatalQuanAspectSha, true);
    const seat = data.seats.find(row => row.layer === 'decadal');
    const witness = seat.groups.find(row => row.layer === 'natal');
    assert.deepEqual(witness.stars.find(row => row.kind === '权'), { star: '天同', kind: '权', branch: '亥', relation });
    assert.deepEqual(witness.quanAspectHazards, ['古天空', '地劫'].map(star => ({ star, branch: '亥', relation })));
    const hit = transformationMatch(run, 'zhuxing-wenda-p155000');
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quan-aspect')).input;
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, new RegExp('生年化权和以下具名曜同居大限的一个照临宫：亥宫的古天空与限宫为' + relation, 'u'));
    assert.ok(!prompt.includes('quanAspectSha'));
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
    if (year === 1980) {
      const birth = native('1947-02-05', 0), frame = combinationFrame(birth, data);
      for (const [wrong, remaining] of [['地空', '地劫'], ['地劫', '古天空']]) {
        const revised = quanshuTransformLimits(archiveMinorInWrongLayer(birth, wrong), frame);
        const natalGroup = revised.seats.find(row => row.layer === 'decadal').groups.find(row => row.layer === 'natal');
        assert.equal(revised.decadalNatalQuanAspectSha, true);
        assert.deepEqual(natalGroup.quanAspectHazards, [{ star: remaining, branch: '亥', relation }]);
        assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: revised }] }, 'zhuxing-wenda-p155000').status, 'partial');
      }
    }
  }
  for (const [year, otherLayer] of [[1971, 'decadal'], [1992, 'minor']]) {
    const { run, data } = yearTransformation(snapshot, year);
    const seat = data.seats.find(row => row.layer === 'decadal');
    assert.equal(data.decadalQuanAspectShaCandidate, true);
    assert.deepEqual(seat.groups.filter(group => group.quanAspectSha === true).map(group => group.layer), [otherLayer]);
    assert.equal(data.decadalNatalQuanAspectSha, false);
    assert.equal(transformationMatch(run, 'zhuxing-wenda-p155000').status, 'not_matched');
    assert.match(describeFortuneFact({ method: 'ziwei', type: 'quanshu_transform_limits', data }, String), /保留发干盘层对照/u);
  }
  const near = yearTransformation(snapshot, 1956);
  const decadal = near.data.seats.find(row => row.layer === 'decadal');
  assert.ok(decadal.groups.some(group => group.stars.some(row => row.kind === '权' && row.branch === '戌' && row.relation === '三合')));
  assert.ok(decadal.hazards.some(row => row.star === '流年擎羊' && row.branch === '午' && row.relation === '三合'));
  assert.ok(decadal.hazards.some(row => row.star === '归档铃星' && row.branch === '戌'));
  assert.equal(near.data.decadalQuanAspectShaCandidate, false);
  assert.equal(transformationMatch(near.run, 'zhuxing-wenda-p155000').status, 'not_matched');
});

test('p155 matches Tian Shang as the independent named Hao in the actual natal Quan aspect palace', () => {
  const dateStr = '1990-05-05', timeIndex = 8, year = 2003, passage = 'zhuxing-wenda-p155000';
  const birth = native(dateStr, timeIndex);
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'quan-tianshang-hao', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  const scoped = payload => ({ ...run, facts: [{ ...fact, normalizedPayload: payload }] });
  const evaluate = payload => transformationMatch(scoped(payload), passage);
  assert.deepEqual([data.decadalNatalQuanSha, data.decadalNatalQuanAspectSha, data.decadalNatalQuanPojunHaoCandidate], [false, false, false]);
  assert.equal(data.decadalNatalQuanTianShangHaoCandidate, true);
  assert.deepEqual(data.decadalNatalQuanTianShangHaoWitness, { stem: '庚', quanStar: '武曲', branch: '寅', decadalBranch: '申', relation: '冲' });
  assert.equal(evaluate({ ...data, decadalNatalQuanTianShangHaoCandidate: false }).status, 'not_matched');
  const hit = evaluate(data);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const matchedRun = scoped(data);
  const { input } = buildFortuneModelContext(matchedRun, interpretFortune(matchedRun, requestForFortuneRun(matchedRun), 'quan-tianshang-hao'));
  assert.match(formatFortuneFactAudit(input), /按《全书》天伤篇的大耗取法.*武曲与天伤同在寅宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /按《全书》天伤篇的大耗取法|武曲与天伤同在寅宫|decadalNatalQuanTianShangHao/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
  for (const lunarYear of [2000, 2011]) {
    const h = engine.horoscope(lunarYear + '-06-01', 6);
    const adjacent = quanshuTransformLimits(birth, { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index });
    assert.equal(adjacent.decadalNatalQuanTianShangHaoCandidate, false);
    assert.equal(evaluate(adjacent).status, 'not_matched');
  }
  const frame = combinationFrame(birth, data);
  const wrongLayer = structuredClone(birth), servant = wrongLayer.palaces.find(row => row.name === '仆役');
  const shang = servant.adjectiveStars.find(row => row.name === '天伤');
  servant.adjectiveStars = servant.adjectiveStars.filter(row => row !== shang);
  servant.minorStars.push(shang);
  for (const unresolved of [wrongLayer, copyWithShiftedDecade(birth, frame)]) {
    const revised = quanshuTransformLimits(unresolved, frame);
    assert.equal(revised.decadalNatalQuanTianShangHaoCandidate, undefined);
    assert.equal(revised.decadalNatalQuanTianShangHaoWitness, undefined);
    assert.equal(evaluate(revised).status, 'unknown');
  }
  const haoLayers = [['boshi12', '博士系大耗'], ['suiqian12', '岁前大耗']];
  const contacts = (result, star) => result.seats.find(row => row.layer === 'decadal').hazards.find(row => row.star === star);
  for (const [archiveLayer, hao] of haoLayers) {
    const misplaced = structuredClone(wrongLayer);
    const oldPlace = misplaced.palaces.find(row => row[archiveLayer] === '大耗');
    const quanPlace = misplaced.palaces.find(row => row.earthlyBranch === '寅');
    assert.notEqual(oldPlace.earthlyBranch, quanPlace.earthlyBranch);
    assert.equal(contacts(data, hao).branch, oldPlace.earthlyBranch);
    [oldPlace[archiveLayer], quanPlace[archiveLayer]] = [quanPlace[archiveLayer], oldPlace[archiveLayer]];
    const revised = quanshuTransformLimits(misplaced, frame);
    assert.equal(contacts(revised, hao).branch, undefined);
    const other = haoLayers.find(([, star]) => star !== hao)[1];
    assert.deepEqual(contacts(revised, other), contacts(data, other));
    assert.equal(revised.decadalNatalQuanAspectSha, undefined);
    assert.equal(evaluate(revised).status, 'unknown');
  }
  const withoutEnvoy = structuredClone(birth), envoy = withoutEnvoy.palaces.find(row => row.name === '疾厄');
  envoy.adjectiveStars = envoy.adjectiveStars.filter(row => row.name !== '天使');
  assert.equal(quanshuTransformLimits(withoutEnvoy, frame).decadalNatalQuanTianShangHaoCandidate, true);
});

test('p155 confirms all named hazards in one actual natal Quan decade under both Hao readings', () => {
  const dateStr = '1979-04-06', timeIndex = 2, year = 1994, passage = 'zhuxing-wenda-p155000';
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config });
  const natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'quan-two-hao-meanings', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  const scoped = payload => ({ ...run, facts: [{ ...fact, normalizedPayload: payload }] });
  const evaluate = payload => transformationMatch(scoped(payload), passage);
  assert.equal(data.decadalNatalQuanNamedAssemblyCandidate, true);
  assert.deepEqual(data.decadalNatalQuanNamedAssemblyWitness, {
    stem: '己', quanStar: '贪狼', decadalBranch: '丑',
    companions: [
      { star: '擎羊', branch: '未', relation: '冲' }, { star: '陀罗', branch: '巳', relation: '三合' },
      { star: '破军', branch: '酉', relation: '三合' }, { star: '天伤', branch: '未', relation: '冲' },
      { star: '天使', branch: '酉', relation: '三合' }, { star: '古天空', branch: '酉', relation: '三合' },
      { star: '地劫', branch: '丑', relation: '守' },
    ],
  });
  const hit = evaluate(data);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '如逢羊陀耗使劫空');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.equal(evaluate({ ...data, namedShaLayerProof: undefined }).status, 'partial');
  const sourceRun = scoped(data);
  const { input } = buildFortuneModelContext(sourceRun, interpretFortune(sourceRun, requestForFortuneRun(sourceRun), 'quan-two-hao-meanings'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /生年己干使贪狼化权，实守丑宫大限/u);
  assert.match(audit, /破军.*天伤.*天使.*古天空.*地劫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同书所见两种耗义在此情形均满足/u);
  assert.doesNotMatch(prompt, /decadalNatalQuanNamedAssemblyWitness|实守丑宫大限/u);

  const frame = combinationFrame(natal, data);
  const wrongStem = structuredClone(natal);
  wrongStem.palaces.find(row => row.index === frame.decadalIndex).heavenlyStem = '甲';
  const independent = quanshuTransformLimits(wrongStem, frame);
  assert.equal(independent.sourceDecadal.verified, true);
  const decadeGroup = independent.seats.find(seat => seat.layer === 'decadal').groups.find(group => group.layer === 'decadal');
  assert.equal(decadeGroup.stem, undefined);
  assert.deepEqual(decadeGroup.stars, []);
  assert.deepEqual(independent.decadalNatalQuanNamedAssemblyWitness, data.decadalNatalQuanNamedAssemblyWitness);
  assert.equal(evaluate(independent).status, 'matched');
  const wrongBlade = archiveMinorInWrongLayer(natal, '擎羊');
  const wrongVoid = archiveMinorInWrongLayer(natal, '地空');
  for (const invalid of [wrongBlade, wrongVoid, copyWithShiftedDecade(natal, frame)]) {
    const changed = quanshuTransformLimits(invalid, frame);
    assert.equal(changed.decadalNatalQuanNamedAssemblyCandidate, undefined);
    assert.equal(changed.decadalNatalQuanNamedAssemblyWitness, undefined);
    assert.notEqual(evaluate(changed).status, 'matched');
  }
  for (const lunarYear of [1993, 2004]) {
    const h = engine.horoscope(lunarYear + '-06-01', 6);
    const other = quanshuTransformLimits(natal, { lunarYear, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index });
    assert.equal(other.decadalNatalQuanNamedAssemblyCandidate, false);
    assert.notEqual(evaluate(other).status, 'matched');
  }
});

test('p155 confirms the named Shang and Shi assembly when Pojun falls outside the real Quan decade', () => {
  const dateStr = '1968-04-06', timeIndex = 5, year = 1982, passage = 'zhuxing-wenda-p155000';
  const source = { dateStr, timeIndex, gender: '男', fixLeap: true, config };
  const engine = astro.withOptions(source);
  const natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'quan-shang-shi-assembly', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  const scoped = normalizedPayload => ({ ...run, facts: [{ ...fact, normalizedPayload }] });
  const evaluate = payload => transformationMatch(scoped(payload), passage);
  assert.equal(data.decadalNatalQuanNamedAssemblyCandidate, false);
  assert.equal(data.decadalNatalQuanShangShiAssemblyCandidate, true);
  assert.equal(data.decadalNatalQuanBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
  assert.deepEqual(data.decadalNatalQuanShangShiAssemblyWitness, {
    stem: '戊', quanStar: '太阴', decadalBranch: '子', companions: [
      { star: '擎羊', branch: '午', relation: '冲' }, { star: '陀罗', branch: '辰', relation: '三合' },
      { star: '天伤', branch: '辰', relation: '三合' }, { star: '天使', branch: '午', relation: '冲' },
      { star: '古天空', branch: '午', relation: '冲' }, { star: '地劫', branch: '辰', relation: '三合' },
    ],
  });
  assert.equal(natal.palaces.find(row => row.majorStars.some(star => star.name === '破军')).earthlyBranch, '酉');
  const hit = evaluate(data);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.equal(hit.matchedSourceExcerpt, '如逢羊陀耗使劫空');
  const { input } = buildFortuneModelContext(scoped(data), interpretFortune(scoped(data), requestForFortuneRun(run), ref.snapshotId));
  assert.match(formatFortuneFactAudit(input), /生年戊干使太阴化权，实守子宫大限/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按同书伤使入限诀所称天耗核本命天伤/u);
  assert.doesNotMatch(prompt, /实守子宫大限|decadalNatalQuanShangShiAssemblyWitness/u);

  const frame = combinationFrame(natal, data);
  const nextBirth = astro.withOptions({ ...source, dateStr: '1968-04-07' }).toJSON();
  const wrongDay = { ...natal, solarDate: nextBirth.solarDate,
    rawDates: { ...natal.rawDates, lunarDate: nextBirth.rawDates.lunarDate } };
  const mismatched = quanshuTransformLimits(wrongDay, frame);
  assert.equal(mismatched.decadalNatalQuanShangShiAssemblyCandidate, true);
  assert.equal(mismatched.decadalNatalQuanBirthAnchorProof, undefined);
  assert.notEqual(evaluate(mismatched).status, 'matched');
  const invalid = quanshuTransformLimits(archiveMinorInWrongLayer(natal, '擎羊'), frame);
  assert.equal(invalid.decadalNatalQuanShangShiAssemblyCandidate, undefined);
  assert.notEqual(evaluate(invalid).status, 'matched');
  for (const lunarYear of [1978, 1989]) {
    const h = engine.horoscope(lunarYear + '-06-01', 6);
    const other = quanshuTransformLimits(natal, { lunarYear, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index });
    assert.equal(other.decadalNatalQuanShangShiAssemblyCandidate, false);
  }
});

test('p155 records the distinct Pojun Hao assembly as evidence awaiting its textual reading', () => {
  const year = 2031, passage = 'zhuxing-wenda-p155000';
  const natal = astro.withOptions({ dateStr: '1979-04-06', timeIndex: 0, gender: '男', fixLeap: true, config }).toJSON();
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'quan-distinct-pojun-hao', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  assert.equal(data.decadalNatalQuanPojunAssemblyCandidate, true);
  assert.equal(data.decadalNatalQuanNamedAssemblyCandidate, false);
  assert.equal(data.decadalNatalQuanShangShiAssemblyCandidate, false);
  assert.equal(data.decadalNatalQuanBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
  assert.deepEqual(data.decadalNatalQuanPojunAssemblyWitness, {
    stem: '己', quanStar: '贪狼', decadalBranch: '亥', companions: [
      { star: '擎羊', branch: '未', relation: '三合' }, { star: '陀罗', branch: '巳', relation: '冲' },
      { star: '破军', branch: '未', relation: '三合' }, { star: '天使', branch: '亥', relation: '守' },
      { star: '古天空', branch: '亥', relation: '守' }, { star: '地劫', branch: '亥', relation: '守' },
    ],
  });
  assert.equal(natal.palaces.find(row => row.adjectiveStars.some(star => star.name === '天伤')).earthlyBranch, '酉');
  const scoped = { ...run, facts: [fact] }, hit = transformationMatch(scoped, passage);
  assert.equal(hit.status, 'partial');
  assert.equal(hit.matchedSourceExcerpt, undefined);
  assert.deepEqual(hit.windows, [{ start: '2031-01-22T16:00:00.000Z', endExclusive: fact.activeTo }]);

  const frame = combinationFrame(natal, data);
  for (const invalid of [archiveMinorInWrongLayer(natal, '擎羊'), copyWithShiftedDecade(natal, frame)]) {
    const changed = quanshuTransformLimits(invalid, frame);
    assert.equal(changed.decadalNatalQuanPojunAssemblyCandidate, undefined);
    assert.equal(changed.decadalNatalQuanPojunAssemblyWitness, undefined);
    assert.notEqual(transformationMatch({ ...scoped, facts: [{ ...fact, normalizedPayload: changed }] }, passage).status, 'matched');
  }
});

test('one natal archive gives no independent transformations to an unverified minor seat', () => {
  const archive = astro.withOptions({ dateStr: '1990-05-05', timeIndex: 2, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON(), byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const dataAt = (year, archiveBranch) => {
    const h = archive.horoscope(year + '-06-15', 6);
    return quanshuTransformLimits(natal, { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
      minorIndex: archiveBranch ? byBranch(archiveBranch) : h.age.index });
  };
  const evaluate = (data, passage) => {
    const rows = [{ factType: 'quanshu_transform_limits', scope: 'yearly', completeness: 'complete', normalizedPayload: data }];
    const query = evaluateFortuneRules('ziwei', 'year', rows).find(row => row.knowledgeId.endsWith(passage)).required[0];
    return [query.hits.length, query.unknown];
  };
  const cases = [
    [2014, '辰', '午', 'expansion-p015-001', ['femaleLuSupportCandidate', 'femaleLuShaCandidate']],
    [1998, '申', '戌', 'expansion-p015-001', ['femaleLuShaCandidate']],
    [2044, '戌', '未', 'expansion-p042-001', ['volumeTwoTabooTempleAtLimitCandidate']],
    [2004, '寅', '卯', undefined, ['tianjiShaAspectCandidate']],
  ];
  for (const [year, actualMinor, wrong, passage, fields] of cases) {
    const actual = dataAt(year);
    const displaced = dataAt(year, wrong);
    assert.equal(actual.sourceMinor.verified, true);
    assert.equal(actual.minorBranch, actualMinor);
    assert.equal(displaced.minorBranch, wrong);
    assert.deepEqual([displaced.sourceMinor.branch, displaced.sourceMinor.verified], [actualMinor, false]);
    assert.ok(displaced.seats.every(seat => seat.groups.every(group => group.layer !== 'minor')));
    for (const field of fields) {
      assert.equal(actual[field], false, field);
      assert.equal(displaced[field], undefined, field);
    }
    if (passage) {
      assert.deepEqual(evaluate(actual, passage), [0, false]);
      assert.deepEqual(evaluate(displaced, passage), [0, true]);
    }
  }
  const verified = dataAt(2047);
  assert.deepEqual([verified.decadalBranch, verified.minorBranch, verified.sourceMinor.verified], ['戌', '未', true]);
  const atDecade = verified.seats.find(seat => seat.layer === 'decadal');
  const minorEmitter = atDecade.groups.find(group => group.layer === 'minor');
  assert.deepEqual([minorEmitter.stem, minorEmitter.jiVolumeTwoTemple], ['癸', true]);
  assert.ok(atDecade.groups.every(group => group.layer === 'minor' || group.jiVolumeTwoTemple !== true));
  assert.deepEqual(evaluate(verified, 'expansion-p042-001'), [1, false]);
});

test('p155 checks Po Jun as a distinct same-seat Hao reading beside the existing two Da Hao positions', () => {
  const cases = [
    ['1982-07-15', 1, 2028, '丑', '守', 2026, '寅'],
    ['1982-05-05', 8, 1991, '酉', '三合', 1997, '申'],
  ];
  for (const [birth, hour, year, limit, relation, otherYear, otherLimit] of cases) {
    const { run, fact, data } = transformationSample(birth, hour, year);
    assert.deepEqual([data.decadalNatalQuanSha, data.decadalNatalQuanAspectSha], [false, false]);
    assert.equal(data.decadalNatalQuanPojunHaoCandidate, true);
    assert.deepEqual(data.decadalNatalQuanPojunHaoWitness,
      { stem: '壬', quanStar: '紫微', branch: '丑', decadalBranch: limit, relation });
    const hit = transformationMatch(run, 'zhuxing-wenda-p155000');
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);

    const outside = transformationSample(birth, hour, otherYear);
    assert.equal(outside.data.decadalBranch, otherLimit);
    assert.equal(outside.data.decadalNatalQuanPojunHaoCandidate, false);
    assert.equal(transformationMatch(outside.run, 'zhuxing-wenda-p155000').status, 'not_matched');
  }
  const natal = native('1982-07-15', 1), byBranch = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  for (const palace of natal.palaces) palace.majorStars = palace.majorStars.filter(star => star.name !== '破军');
  const missing = quanshuTransformLimits(natal, { lunarYear: 2028, yearIndex: byBranch('申'), decadalIndex: byBranch('丑') });
  assert.equal(missing.decadalNatalQuanPojunHaoCandidate, undefined);
});

test('p157 requires natal Ji guarding the actual three-way seat from the lunar year boundary', () => {
  const params = { periodType: 'year', targetPeriod: { year: 1966 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(1966, 5, 1), ref = { snapshotId: 'natal-ji-triple-limit', chart: completeQuanshuBirth('1947-02-05', 9) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(run);
  const before = transformationFacts(run).find(fact => fact.normalizedPayload.lunarYear === 1965);
  const after = transformationFacts(run).find(fact => fact.normalizedPayload.lunarYear === 1966);
  assert.ok(before && after);
  assert.equal(before.activeTo, after.activeFrom);
  assert.equal(before.normalizedPayload.tripleNatalJiGuard, false);
  assert.equal(before.normalizedPayload.tripleNatalJiVerifiedGuard, false);
  const p = after.normalizedPayload;
  assert.deepEqual([p.annualBranch, p.decadalBranch, p.minorBranch], ['午', '午', '午']);
  assert.equal(p.tripleNatalJiGuard, true);
  assert.equal(p.tripleNatalJiVerifiedGuard, true);
  assert.deepEqual(p.sourceMinor, { startBranch: '丑', branch: '午', ordinal: 20, direction: '逆行', verified: true });
  const groups = p.seats.find(row => row.layer === 'decadal').groups;
  assert.deepEqual(groups.filter(group => group.ji === true).map(group => group.layer), ['natal']);
  assert.deepEqual(groups[0].stars.find(star => star.kind === '忌'), { star: '巨门', kind: '忌', branch: '午', relation: '守' });
  const hit = transformationMatch(run, 'zhuxing-wenda-p157000');
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [after.factId]);
  assert.deepEqual(hit.windows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大小限都经复算，生年化忌与太岁、大限、小限同在一宫/u);
  assert.match(prompt, /按五局、顺逆与起岁核到午宫大限/u);
  assert.match(prompt, /午宫的巨门与限宫为守/u);
  assert.doesNotMatch(prompt, /tripleNatalJiGuard|tripleTabooCandidate/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId === hit.knowledgeId));
  assert.doesNotMatch(formatFortunePrompt(input), /tripleNatalJiVerifiedGuard|tripleTabooCandidate/u);

  const pairOnly = yearTransformation(completeQuanshuBirth('1947-02-05', 0), 1963);
  const compare = pairOnly.data, natalGroup = compare.seats[0].groups.find(group => group.layer === 'natal');
  assert.equal(natalGroup.ji, true);
  assert.deepEqual([compare.annualBranch, compare.decadalBranch, compare.minorBranch], ['卯', '卯', '酉']);
  assert.equal(compare.tripleNatalJiGuard, false);
  assert.equal(transformationMatch(pairOnly.run, 'zhuxing-wenda-p157000').status, 'not_matched');

  const n = native('1947-02-05', 9);
  const index = n.palaces.find(row => row.earthlyBranch === '午').index;
  const frame = { lunarYear: 1966, yearIndex: index, decadalIndex: index };
  const missing = quanshuTransformLimits(n, frame);
  assert.equal(missing.sourceMinor.verified, undefined);
  assert.equal(missing.tripleNatalJiVerifiedGuard, undefined);
  const mismatch = quanshuTransformLimits({ ...n, gender: '男' }, { ...frame, minorIndex: index });
  assert.equal(mismatch.sourceMinor.verified, false);
  assert.equal(mismatch.tripleNatalJiGuard, true);
  assert.equal(mismatch.tripleNatalJiVerifiedGuard, undefined);
  const invalidFact = { ...after, normalizedPayload: mismatch };
  assert.equal(transformationMatch({ ...run, facts: [invalidFact] }, 'zhuxing-wenda-p157000').status, 'unknown');
  const currentFrame = { ...frame, minorIndex: index };
  const shifted = quanshuTransformLimits(copyWithShiftedDecade(n, currentFrame), currentFrame);
  assert.deepEqual(shifted.sourceDecadal, { branch: '午', verified: false });
  assert.equal(shifted.sourceMinor.verified, true);
  assert.equal(shifted.tripleNatalJiGuard, true);
  assert.equal(shifted.tripleNatalJiVerifiedGuard, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...after, normalizedPayload: shifted }] },
    'zhuxing-wenda-p157000').status, 'unknown');
  const jumen = n.palaces.find(palace => palace.majorStars.some(star => star.name === '巨门'));
  jumen.majorStars.push({ ...jumen.majorStars.find(star => star.name === '巨门') });
  const duplicate = quanshuTransformLimits(n, { ...frame, minorIndex: index });
  assert.equal(duplicate.tripleSeat, true);
  assert.equal(duplicate.tripleNatalJiVerifiedGuard, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...after, normalizedPayload: duplicate }] },
    'zhuxing-wenda-p157000').status, 'unknown');
});

test('p157 keeps the four named stars in the visibility area distinct from sharing the same seat', () => {
  const { run, data } = yearTransformation(completeQuanshuBirth('1980-05-15', 9), 2035);
  const [decadal] = data.seats;
  assert.equal(data.tripleTabooCandidate, true);
  assert.equal(data.tripleNatalJiGuard, false);
  assert.equal(decadal.branch, '卯');
  assert.equal(decadal.tabooFollowup.fourShaGuard, false);
  assert.equal(decadal.tabooFollowup.fourShaVisible, true);
  assert.equal(decadal.tabooFollowup.yangFireBellSkyVisible, false);
  assert.equal(decadal.tabooFollowup.natalAssembly, undefined);
  assert.deepEqual(decadal.tabooFollowup.fourSha.map(row => [row.star, row.branch, row.relation]),
    [['擎羊', '酉', '冲'], ['陀罗', '未', '三合'], ['归档火星', '亥', '三合'], ['归档铃星', '未', '三合']]);
  const rule = transformationMatch(run, 'zhuxing-wenda-p157000');
  assert.equal(rule.status, 'not_matched');
  assert.deepEqual(rule.sourceFactIds, []);
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'taboo-followup')).input;
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /所核四煞均到交临宫的守冲三合范围/u);
  assert.match(prompt, /明刻本所列羊火铃空逐曜为/u);
  assert.doesNotMatch(prompt, /所核羊火铃空均到交临宫/u);
  assert.match(prompt, /以下发干组的化忌留作盘层对照/u);
  assert.match(prompt, /与化忌同组的化权：未宫的天梁与限宫为三合/u);
  assert.ok(!prompt.includes('均守交临宫') && !prompt.includes('tabooFollowup'));
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== rule.knowledgeId)));

  const incomplete = native('1980-05-15', 9);
  for (const palace of incomplete.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[key] = palace[key].filter(row => row.name !== '火星');
  }
  const focus = incomplete.palaces.find(palace => palace.earthlyBranch === '卯').index;
  const missing = quanshuTransformLimits(incomplete, { lunarYear: 2035, yearIndex: focus, decadalIndex: focus, minorIndex: focus });
  assert.equal(missing.tripleTabooCandidate, true);
  assert.equal(missing.seats[0].tabooFollowup.fourShaVisible, undefined);
});

test('p157 compares the two named groups at the actual natal Ji seat and keeps its natal benefics separate', () => {
  const { run, fact, data } = yearTransformation(completeQuanshuBirth('1950-12-13', 2), 1969);
  const seat = data.seats.find(row => row.layer === 'decadal'), followup = seat.tabooFollowup;
  assert.equal(seat.branch, '酉');
  assert.equal(data.tripleNatalJiGuard, true);
  assert.deepEqual(followup.yangFireBellSky.map(row => [row.star, row.branch, row.relation]), [
    ['擎羊', '酉', '守'], ['古天空', '酉', '守'], ['归档火星', '卯', '冲'], ['归档铃星', '巳', '三合'],
  ]);
  assert.equal(followup.yangFireBellSkyGuard, false);
  assert.equal(followup.yangFireBellSkyVisible, true);
  assert.equal(followup.fourShaVisible, false);
  assert.deepEqual(followup.natalAssembly, { beneficsGuard: false, beneficsVisible: false, helpersVisible: false });
  assert.equal(followup.fourSha.find(row => row.star === '陀罗').relation, '其他');
  const hit = transformationMatch(run, 'zhuxing-wenda-p157000');
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-ji-source-quartets')).input;
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /所核羊火铃空均到交临宫的守冲三合范围/u);
  assert.doesNotMatch(prompt, /所核四煞均到交临宫|科权禄均到化忌交临宫|yangFireBellSkyVisible|natalAssembly/u);

  const helperSample = yearTransformation(completeQuanshuBirth('1979-02-05', 0), 2012);
  const helperSeat = helperSample.data.seats.find(row => row.layer === 'decadal');
  assert.equal(helperSample.data.tripleNatalJiGuard, true);
  assert.equal(helperSeat.branch, '辰');
  assert.deepEqual(helperSeat.tabooFollowup.helperPairs.map(pair => [pair.label, pair.visible]),
    [['紫微天府', true], ['文昌文曲', true], ['左辅右弼', true]]);
  assert.deepEqual(helperSeat.tabooFollowup.natalAssembly, { beneficsGuard: false, beneficsVisible: false, helpersVisible: true });
  assert.equal(helperSeat.tabooFollowup.yangFireBellSkyVisible, false);
  assert.match(describeFortuneFact({ method: 'ziwei', type: 'quanshu_transform_limits', data: helperSample.data }, String),
    /紫府、昌曲、左右六曜均到生年化忌交临宫的守冲三合范围/u);
});

test('p154000 matches the natal Lu star guarding the actual minor seat from the lunar year boundary', () => {
  const snapshot = chart(native('1947-02-05', 3));
  snapshot.birthContext = { precision: 'minute', birthInstant: '1947-02-04T22:00:00.000Z', latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', targetPeriod: { year: 1995 }, displayTimezone: 'Asia/Shanghai' };
  const opening = '1995-01-30T16:00:00.000Z', now = Date.parse(opening);
  const ref = { snapshotId: 'natal-lu-at-minor-seat', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(run);
  const before = transformationFacts(run).find(row => row.activeTo === opening);
  const after = transformationFacts(run).find(row => row.activeFrom === opening);
  assert.ok(before && after);
  assert.equal(before.normalizedPayload.lunarYear, 1994);
  assert.equal(before.normalizedPayload.minorBranch, '寅');
  assert.deepEqual(before.normalizedPayload.sourceMinor, { startBranch: '丑', branch: '寅', ordinal: 48, direction: '逆行', verified: true });
  assert.equal(before.normalizedPayload.minorNatalLuGuard, false);
  const p = after.normalizedPayload, seat = p.seats.find(item => item.layer === 'minor');
  assert.equal(p.lunarYear, 1995);
  assert.equal(seat.branch, '丑');
  assert.deepEqual(p.sourceMinor, { startBranch: '丑', branch: '丑', ordinal: 49, direction: '逆行', verified: true });
  const source = seat.groups.find(group => group.layer === 'natal');
  assert.equal(source.stem, '丁');
  assert.deepEqual(source.stars.find(star => star.kind === '禄'), { kind: '禄', star: '太阴', branch: '丑', relation: '守' });
  assert.equal(p.minorNatalLuGuard, true);
  const match = transformationMatch(run, 'zhuxing-wenda-p154000');
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [after.factId]);
  assert.deepEqual(match.windows, [{ start: opening, endExclusive: after.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
  assert.ok(input.sections.find(section => section.id === 'wealth').findings.some(finding => finding.knowledgeId === match.knowledgeId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /生年干丁这一组，生年化禄实守小限本宫/u);
  assert.match(prompt, /丑宫的太阴与限宫为守/u);
  assert.doesNotMatch(prompt, /minorNatalLuGuard|minorLuCandidate/u);
});

test('p154000 does not accept a minor archive seat that disagrees with the source age count', () => {
  const natal = native('1947-02-05', 3);
  const year = natal.palaces.find(palace => palace.earthlyBranch === '戌');
  const impostor = natal.palaces.find(palace => palace.earthlyBranch === '丑');
  const data = quanshuTransformLimits(natal, { lunarYear: 1994, yearIndex: year.index, minorIndex: impostor.index });
  assert.equal(data.ready, true);
  assert.equal(data.minorBranch, '丑');
  assert.deepEqual(data.sourceMinor, { startBranch: '丑', branch: '寅', ordinal: 48, direction: '逆行', verified: false });
  assert.equal(data.seats.find(seat => seat.layer === 'minor').groups.find(group => group.layer === 'natal').lu, true);
  assert.equal(data.minorNatalLuGuard, undefined);
  const { run, fact } = yearTransformation(chart(natal), 1994);
  const inconsistent = { ...run, facts: run.facts.map(row => row.factId === fact.factId ? { ...row, normalizedPayload: data } : row) };
  const match = transformationMatch(inconsistent, 'zhuxing-wenda-p154000');
  assert.equal(match.status, 'unknown');
  assert.deepEqual(match.windows, []);
});

test('p154000 retains other emitter seats, natal aspects and Lu Cun as separate evidence', () => {
  const snapshot = chart(native('1947-02-05', 3));
  snapshot.birthContext = { precision: 'minute', birthInstant: '1947-02-04T22:00:00.000Z', latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const samples = [
    { year: 1999, minor: '酉', natalRelation: '三合', phrase: '生年化禄与小限有三合' },
    { year: 2000, minor: '申', natalRelation: '其他', other: 'decadal', phrase: '保留发干盘层对照' },
    { year: 2001, minor: '未', natalRelation: '冲', phrase: '生年化禄与小限有冲' },
    { year: 2002, minor: '午', natalRelation: '其他', luCun: true },
    { year: 2005, minor: '卯', natalRelation: '其他', other: 'yearly', phrase: '保留发干盘层对照' },
  ];
  for (const sample of samples) {
    const run = calculate(snapshot, 'year', { year: sample.year });
    const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === sample.year);
    assert.ok(fact);
    const p = fact.normalizedPayload, seat = p.seats.find(item => item.layer === 'minor');
    assert.equal(seat.branch, sample.minor);
    assert.equal(seat.groups.find(group => group.layer === 'natal').stars.find(star => star.kind === '禄').relation, sample.natalRelation);
    assert.equal(p.minorLuCandidate, Boolean(sample.other));
    assert.equal(p.minorNatalLuGuard, false);
    if (sample.other) assert.deepEqual(seat.groups.filter(group => group.lu === true).map(group => group.layer), [sample.other]);
    if (sample.luCun) assert.equal(quanshuLuYangTuo('丁').lucunBranch, sample.minor);
    const match = transformationMatch(run, 'zhuxing-wenda-p154000');
    assert.equal(match.status, 'not_matched', String(sample.year));
    assert.deepEqual(match.sourceFactIds, []);
    assert.deepEqual(match.windows, []);
    const phrase = describeFortuneFact({ method: 'ziwei', type: fact.factType, data: p }, String);
    if (sample.phrase) assert.ok(phrase.includes(sample.phrase));
    assert.doesNotMatch(phrase, /生年化禄实守小限本宫/u);
  }
});

test('Lu requires a complete named pair or same-emitter support and separates the two named Sha witnesses', () => {
  const pair = transformationSample('1980-03-11', 0, 1996);
  const coTransforms = transformationSample('1980-03-11', 2, 2006);
  const fireTaboo = transformationSample('1980-03-11', 0, 2053);
  const loose = transformationSample('1947-02-05', 3, 2000);
  const seat = pair.data.seats.find(row => row.groups.some(group => group.luSupportPair));
  assert.equal(seat.layer, 'decadal');
  assert.ok(seat.supportPairs.some(row => row.label === '魁钺组' && row.present === true));
  assert.ok(seat.groups.some(row => row.luSupportPair && row.luNatalYangTuo && !row.luFireTaboo));
  assert.ok(coTransforms.data.seats.some(row => row.groups.some(g => g.luKeQuan && !g.luSupportPair)));
  assert.equal(fireTaboo.data.femaleLuSupportCandidate, false);
  assert.ok(fireTaboo.data.seats.some(row => row.groups.some(g => g.luFireTaboo && !g.luNatalYangTuo)));
  for (const sample of [pair, coTransforms, fireTaboo]) {
    const found = transformationMatch(sample.run, 'expansion-p015');
    assert.equal(found.status, 'partial');
    assert.deepEqual(found.sourceFactIds, [sample.fact.factId]);
  }
  assert.equal(loose.data.minorLuCandidate, true);
  assert.ok(loose.data.seats.some(row => row.hazards.some(hazard => hazard.star === '古天空' && hazard.relation === '守')));
  assert.equal(transformationMatch(loose.run, 'expansion-p015').status, 'not_matched');
});

test('p015 can bind the Jielan fire position to its own Lu and Ji emitter group', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2042 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2042-11-19T03:00:00Z');
  const ref = { snapshotId: 'jielan-lu-ji-snapshot', chart: chart(native('1965-02-15', 0)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'jielan-lu-ji', ref);
  const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === 2042);
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.equal(data.femaleLuShaCandidate, false);
  assert.equal(data.femaleLuSupportCandidate, false);
  assert.equal(data.femaleLuJielanFireTabooCandidate, true);
  const minor = data.seats.find(row => row.layer === 'minor');
  assert.equal(minor.branch, '寅');
  assert.deepEqual(minor.jielanFire, { branch: '戌', relation: '三合' });
  const natalEmitter = minor.groups.find(row => row.layer === 'natal');
  assert.equal(natalEmitter.stem, '乙');
  assert.ok(natalEmitter.luJielanFireTaboo && !natalEmitter.luFireTaboo);
  assert.deepEqual(natalEmitter.stars.filter(row => row.kind === '禄' || row.kind === '忌').map(row => [row.star, row.relation]),
    [['天机', '守'], ['太阴', '守']]);
  const isolated = { ...run, facts: [fact] };
  const match = transformationMatch(isolated, 'expansion-p015');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  const wrongSource = { ...fact, normalizedPayload: { ...data, jielanFireBellProfile: 'another-source' } };
  assert.equal(transformationMatch({ ...run, facts: [wrongSource] }, 'expansion-p015').status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jielan-lu-ji'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本宫化禄，《捷览》所推火星和同一发干的化忌也会到此宫，戌宫的《捷览》火星与限宫为三合/u);
  assert.doesNotMatch(prompt, /femaleLuJielanFireTabooCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
});

test('p015 checks that the natal Lu recipient and Lu Cun guard one verified limit', () => {
  const birth = '1960-07-15', hour = 0, snapshot = completeQuanshuBirth(birth, hour);
  const positive = yearTransformation(snapshot, 2022);
  const nearby = yearTransformation(snapshot, 2021);
  const passage = 'expansion-p015';
  const data = positive.data;
  assert.deepEqual([data.femaleLuSupportCandidate, data.femaleLuShaCandidate,
    data.femaleLuJielanFireTabooCandidate, data.femaleLuQuanshuFixedFireTabooCandidate], [false, false, false, false]);
  assert.equal(data.sourceMinor.verified, true);
  assert.equal(data.femaleNatalLuCunCoGuardCandidate, true);
  assert.deepEqual(data.femaleNatalLuCunCoGuards, [{ scope: 'minor', branch: '申', stem: '庚', star: '太阳' }]);
  const hit = transformationMatch(positive.run, passage);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [positive.fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '2022-01-31T16:00:00.000Z', endExclusive: '2022-12-31T16:00:00.000Z' }]);
  assert.equal(nearby.data.femaleNatalLuCunCoGuardCandidate, false);
  assert.deepEqual(nearby.data.femaleNatalLuCunCoGuards, []);
  assert.equal(transformationMatch(nearby.run, passage).status, 'not_matched');

  const natal = native(birth, hour);
  const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const wrong = quanshuTransformLimits(natal, { lunarYear: 2021, yearIndex: index(nearby.data.annualBranch),
    decadalIndex: index(nearby.data.decadalBranch), minorIndex: index(data.minorBranch) });
  assert.equal(wrong.minorBranch, '申');
  assert.equal(wrong.sourceMinor.verified, false);
  assert.equal(wrong.femaleNatalLuCunCoGuardCandidate, undefined);
  assert.deepEqual(wrong.femaleNatalLuCunCoGuards, []);
  assert.equal(transformationMatch({ ...nearby.run, facts: [{ ...nearby.fact, normalizedPayload: wrong }] }, passage).status, 'unknown');
  const wrongLucun = quanshuTransformLimits(archiveMinorInWrongLayer(natal, '禄存'), {
    lunarYear: 2022, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch), minorIndex: index(data.minorBranch),
  });
  assert.equal(wrongLucun.sourceMinor.verified, true);
  assert.equal(wrongLucun.femaleNatalLuCunCoGuardCandidate, undefined);
  assert.deepEqual(wrongLucun.femaleNatalLuCunCoGuards, []);
  assert.equal(transformationMatch({ ...positive.run, facts: [{ ...positive.fact, normalizedPayload: wrongLucun }] }, passage).status, 'unknown');

  const report = interpretFortune(positive.run, requestForFortuneRun(positive.run), 'p015-natal-lu-and-lucun');
  const { input } = buildFortuneModelContext(positive.run, report);
  assert.match(formatFortuneFactAudit(input), /同一小限申宫[^\n]*生年干庚所化禄的太阳与本命禄存均实守/u);
  assert.doesNotMatch(formatFortunePrompt(input), /太阳与本命禄存均实守|femaleNatalLuCunCoGuard/u);
});

test('p015 confirms the named natal opposition when Lu and two verified limits guard the same Life seat', () => {
  const birth = '1953-02-21', hour = 7, year = 1965;
  const snapshot = completeQuanshuBirth(birth, hour);
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 15), archive = { snapshotId: 'natal-lu-and-four-sha', chart: snapshot };
  const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const bound = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, now), archive.snapshotId, archive);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  assert.equal(data.femaleNatalLuKeQuanDoubleGuardCandidate, false);
  assert.equal(data.femaleNatalLuNamedShaDoubleGuardCandidate, true);
  assert.deepEqual(data.femaleNatalLuNamedShaDoubleGuardWitness, {
    branch: '未', palace: '命宫', stem: '癸', lu: { star: '破军', kind: '禄', branch: '未' },
    ji: { star: '贪狼', kind: '忌', branch: '亥', relation: '三合' },
    sha: [{ star: '擎羊', branch: '丑', relation: '冲' }, { star: '陀罗', branch: '亥', relation: '三合' },
      { star: '火星', branch: '卯', relation: '三合' }],
  });
  const passage = 'expansion-p015';
  const hit = transformationMatch(run, passage);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '杀凑平常');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const evaluate = normalizedPayload => transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload }] }, passage);
  assert.equal(evaluate({ ...data, quanshuFixedFireBellProfile: 'archive-position' }).status, 'partial');

  const natal = snapshot.ziwei.rawResult[0], frame = combinationFrame(natal, data);
  const invalid = archiveMinorInWrongLayer(natal, '陀罗');
  const wrongTuo = quanshuTransformLimits(invalid, frame);
  assert.equal(wrongTuo.femaleNatalLuNamedShaDoubleGuardCandidate, undefined);
  assert.equal(wrongTuo.femaleNatalLuNamedShaDoubleGuardWitness, undefined);
  assert.equal(evaluate(wrongTuo).status, 'partial');
  const wrongMinor = quanshuTransformLimits(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
  assert.equal(wrongMinor.femaleNatalLuNamedShaDoubleGuardCandidate, undefined);
  assert.equal(evaluate(wrongMinor).status, 'partial');
  const next = yearTransformation(snapshot, year + 1);
  assert.equal(next.data.femaleNatalLuNamedShaDoubleGuardCandidate, false);
  assert.notEqual(transformationMatch(next.run, passage).status, 'matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /杀凑平常/u);
  assert.match(provider, /本命擎羊、本命陀罗、明刊定宫火星与同一生年干的化忌受曜均实际到会/u);
  assert.doesNotMatch(provider, /femaleNatalLuNamedShaDoubleGuardWitness|癸干破军|丑宫正冲/u);
});

test('p015 locates the Ming fixed Fire, Lu and Ji in one verified small limit and one natal emitter', () => {
  const snapshot = completeQuanshuBirth('1981-02-15', 3);
  const { run, fact, data } = yearTransformation(snapshot, 1997);
  assert.equal(data.femaleLuShaCandidate, false);
  assert.equal(data.femaleLuSupportCandidate, false);
  assert.equal(data.femaleLuJielanFireTabooCandidate, false);
  assert.equal(data.femaleLuQuanshuFixedFireTabooCandidate, true);
  assert.equal(data.quanshuFixedFireBellProfile, 'quanshu-nanyangtang-fixed-firebell-v1');
  assert.equal(data.sourceMinor.verified, true);
  const minor = data.seats.find(row => row.layer === 'minor');
  assert.equal(minor.branch, '卯');
  assert.deepEqual(minor.quanshuFixedFire, { branch: '卯', relation: '守' });
  const emitter = minor.groups.find(row => row.layer === 'natal');
  assert.equal(emitter.stem, '辛');
  assert.equal(emitter.luQuanshuFixedFireTaboo, true);
  assert.equal(emitter.luFireTaboo, false);
  assert.equal(emitter.luJielanFireTaboo, false);
  assert.deepEqual(emitter.stars.filter(row => row.kind === '禄' || row.kind === '忌'), [
    { star: '巨门', kind: '禄', branch: '卯', relation: '守' },
    { star: '文昌', kind: '忌', branch: '未', relation: '三合' },
  ]);
  const sql = { ...run, facts: [fact] };
  const match = transformationMatch(sql, 'expansion-p015');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const nonMing = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(transformationMatch({ ...run, facts: [nonMing] }, 'expansion-p015').status, 'not_matched');
  const before = yearTransformation(snapshot, 1996);
  assert.equal(before.data.femaleLuQuanshuFixedFireTabooCandidate, false);
  assert.equal(transformationMatch({ ...before.run, facts: [before.fact] }, 'expansion-p015').status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-lu-ji'));
  assert.match(formatFortuneFactAudit(input), /生年化禄实守，明刊火星与同一生年干的化忌另见此限/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊火星与同一生年干的化忌另见此限|femaleLuQuanshuFixedFireTabooCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
});

test('p026 matches natal San Hua or natal Lucun with Ke and Quan within the verified Tianji half', () => {
  const cases = [
    ['1947-02-05', 1, 1967, [true, false, false], '天机守限，生年化科、化权、化禄均会此宫'],
    ['1953-02-15', 5, 1972, [false, true, false], '天机守限，本命禄存与生年化科、化权均到此宫'],
    ['1947-02-05', 3, 2029, [false, false, false], '天机守限，此发干组的科权禄均有见位，保留盘层对照'],
    ['1948-03-05', 0, 1973, [false, false, true], '天机守限，流年禄存与同一流年干的化科、化权另列为盘层对照'],
    ['1953-02-15', 5, 1971, [false, false, false], ''],
    ['1947-02-05', 0, 1962, [false, false, false], ''],
  ];
  const visible = ['守', '冲', '三合'];
  for (const [birth, hour, year, flags, phrase] of cases) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'tianji-lucun-' + year, chart: completeQuanshuBirth(birth, hour) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const { run, fact, data } = readYearTransformation(bound, year);
    assert.deepEqual([data.tianjiNatalSanHuaCandidate, data.tianjiNatalLucunKeQuanCandidate,
      data.tianjiYearLucunKeQuanCandidate], flags, String(year));
    assert.equal(data.tianjiShaAspectCandidate, false, String(year));
    const seat = data.seats.find(row => row.tianji.relation === '守');
    if (year === 1971) assert.equal(seat, undefined);
    if (year === 1972 || year === 1973) {
      const layer = year === 1972 ? 'natal' : 'yearly';
      const group = seat.groups.find(row => row.layer === layer);
      assert.equal(group.stem, '癸');
      assert.equal(group.tianjiSanHua, false);
      assert.deepEqual(group.tianjiLucun, { star: year === 1972 ? '本命禄存' : '流年禄存', branch: '子', relation: '守' });
      assert.deepEqual(group.stars.filter(row => row.kind !== '忌').map(row => [row.kind, row.star, row.branch, row.relation]),
        [['禄', '破军', '丑', '其他'], ['权', '巨门', '午', '冲'], ['科', '太阴', '辰', '三合']]);
    }
    if (year === 2029) assert.deepEqual(seat.groups.filter(row => row.tianjiSanHua).map(row => [row.layer, row.stem]), [['decadal', '丙']]);
    if (year === 1962) {
      const natal = seat.groups.find(group => group.layer === 'natal');
      const yearly = seat.groups.find(group => group.layer === 'yearly');
      assert.ok(natal.stars.filter(row => ['科', '权'].includes(row.kind)).every(row => visible.includes(row.relation)));
      assert.equal(natal.tianjiLucun.relation, '其他');
      assert.equal(yearly.tianjiLucun.relation, '三合');
      assert.ok(yearly.stars.filter(row => ['科', '权'].includes(row.kind)).every(row => row.relation === '其他'));
    }
    const expected = flags[0] || flags[1];
    const result = transformationMatch(run, 'expansion-p026');
    assert.equal(result.status, expected ? 'partial' : 'not_matched', String(year));
    if (expected) {
      const timed = run.facts.filter(tianjiTimedFact);
      const active = timed.find(row => row.normalizedPayload.activeInSourceHalf);
      const previous = timed.find(row => row.activeTo === active.activeFrom);
      const field = flags[0] ? 'tianjiNatalSanHuaCandidate' : 'tianjiNatalLucunKeQuanCandidate';
      assert.equal(previous.normalizedPayload[field], false);
      assert.equal(active.normalizedPayload[field], true);
      assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
      assert.equal(active.normalizedPayload.tianjiSupportWitnesses[0].scope, 'minor');
      assert.deepEqual(result.sourceFactIds, [active.factId]);
      assert.deepEqual(result.windows, [{ start: year === 1967 ? '1967-08-05T16:00:00.000Z' : '1972-08-08T16:00:00.000Z', endExclusive: fact.activeTo }]);
      if (year === 1972) {
        const wrong = archiveMinorInWrongLayer(native(birth, hour), '禄存');
        const index = branch => wrong.palaces.find(row => row.earthlyBranch === branch).index;
        const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch),
          minorIndex: index(data.minorBranch), age: data.sourceMinor.ordinal };
        const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
        const [binding] = quanshuLimitTiming(wrong, quanshuLimitBranches(wrong, frame), window, frame);
        const misplaced = quanshuTimedTianji(binding.data, quanshuTransformLimits(wrong, frame));
        assert.deepEqual(misplaced.guardScopes, ['minor']);
        assert.equal(misplaced.tianjiNatalSanHuaCandidate, false);
        assert.equal(misplaced.tianjiNatalLucunKeQuanCandidate, undefined);
        assert.equal(misplaced.tianjiNatalLucunPlacementProof, undefined);
        assert.deepEqual(misplaced.tianjiSupportWitnesses, []);
        const { tianjiNatalLucunPlacementProof, ...oldPayload } = active.normalizedPayload;
        assert.equal(tianjiNatalLucunPlacementProof, 'quanshu-native-minor-lucun-v1');
        for (const normalizedPayload of [misplaced, oldPayload]) {
          assert.equal(transformationMatch({ ...run, facts: [{ ...active, normalizedPayload }] }, 'expansion-p026').status, 'unknown');
        }
      }
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianji-lucun'));
    const prompt = formatFortuneFactAudit(input);
    if (phrase) assert.ok(prompt.includes(phrase), String(year));
    if (expected) {
      assert.match(prompt, /天机为南斗，实守小限[巳子]宫且处在本星适用的下半年/u);
      assert.match(prompt, year === 1967 ? /同一小限按本生年干丁核天机值限的科权禄/u
        : /同一小限按本生年干癸核天机值限的科权与本命禄存/u);
      assert.doesNotMatch(formatFortunePrompt(input), /核天机值限|原分支与该限同段/u);
    }
    if (!expected) assert.doesNotMatch(prompt, /天机守限，生年化科、化权、化禄均会此宫|天机守限，本命禄存与生年化科、化权均到此宫/u);
    assert.doesNotMatch(prompt, /tianjiNatalLucunKeQuanCandidate|tianjiYearLucunKeQuanCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
  }
});

test('p026 confirms both source readings of San Hua under true southern Tianji double guards', () => {
  const orderedBranches = '子丑寅卯辰巳午未申酉戌亥';
  const atOffset = (index, offset) => orderedBranches[(index + offset + 12) % orderedBranches.length];
  for (let ziwei = 0; ziwei < orderedBranches.length; ziwei++) {
    const tianji = atOffset(ziwei, -1);
    const sunLu = atOffset(ziwei, -3);
    const wuquQuan = atOffset(ziwei, -4);
    for (const beneficiary of [sunLu, wuquQuan]) {
      assert.equal(quanshuPalaceRelation(tianji, beneficiary), '其他', tianji);
    }
  }
  const dateStr = '1978-01-05', timeIndex = 3, year = 1998;
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'tianji-exact-double-guard', chart: completeQuanshuBirth(dateStr, timeIndex) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(bound);
  const { run, fact, data } = readYearTransformation(bound, year);
  assert.deepEqual([data.decadalBranch, data.minorBranch, data.tianjiNatalSanHuaCandidate], ['戌', '戌', true]);
  const slices = run.facts.filter(tianjiTimedFact);
  const exact = slices.find(row => row.normalizedPayload.guardScopes.length === 2);
  const boundary = new Date(quanshuLunarMidnight(year, 7)).toISOString();
  assert.ok(exact);
  assert.equal(exact.activeFrom, boundary);
  assert.deepEqual(exact.normalizedPayload.guardScopes, ['decadal', 'minor']);
  const witnesses = exact.normalizedPayload.tianjiSupportWitnesses;
  assert.deepEqual(witnesses.map(row => [row.scope, row.stem]), [['decadal', '丁'], ['minor', '丁']]);
  assert.deepEqual(witnesses.map(row => row.stars.map(({ star, kind, branch, relation }) => [star, kind, branch, relation])),
    Array.from({ length: 2 }, () => [['太阴', '禄', '午', '三合'], ['天同', '权', '午', '三合'], ['天机', '科', '戌', '守']]));
  const evaluate = facts => transformationMatch({ ...run, facts }, 'expansion-p026');
  const hit = evaluate(slices);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [exact.factId]);
  assert.equal(exact.normalizedPayload.tianjiMingNatalLucunKeQuanDoubleGuardCandidate, true);
  assert.match(hit.matchedSourceExcerpt, /男女二限值天机，科权禄逢大有为/u);
  assert.match(hit.matchedSourceExcerpt, /禄主科权大有为/u);
  const early = slices.filter(row => row.activeTo <= boundary);
  assert.ok(early.length > 0);
  assert.ok(early.every(row => row.normalizedPayload.guardScopes.length < 2));
  assert.equal(evaluate(early).status, 'partial');
  const selected = { ...run, facts: [fact, ...slices] };
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'tianji-source-double-guard'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /复核的大小限都实守同一颗本命天机/u);
  assert.match(prompt, /出生年干定位的化科、化权、化禄三颗受曜均实守、对冲或三合该宫/u);
  assert.match(prompt, /禄主科权大有为/u);
  assert.doesNotMatch(prompt, /戌宫|tianjiNatalSanHuaCandidate|tianjiMingNatalLucunKeQuanDoubleGuardCandidate|太阴化禄/u);

  const natal = native(dateStr, timeIndex), index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch),
    minorIndex: index(data.minorBranch), age: data.sourceMinor.ordinal };
  const window = { start: Date.parse(exact.activeFrom), end: Date.parse(exact.activeTo) };
  const timed = (archive, sourceFrame) => {
    const limits = quanshuLimitBranches(archive, sourceFrame);
    const [phase] = quanshuLimitTiming(archive, limits, window, sourceFrame);
    return quanshuTimedTianji(phase.data, quanshuTransformLimits(archive, sourceFrame));
  };
  const misplacedLucun = timed(archiveMinorInWrongLayer(natal, '禄存'), frame);
  assert.equal(misplacedLucun.tianjiNatalLucunPlacementProof, undefined);
  assert.equal(misplacedLucun.tianjiNatalSanHuaCandidate, true);
  assert.equal(misplacedLucun.tianjiMingNatalLucunKeQuanDoubleGuardCandidate, undefined);
  const independentOfLucun = evaluate([{ ...exact, normalizedPayload: misplacedLucun }]);
  assert.equal(independentOfLucun.status, 'matched');
  assert.match(independentOfLucun.matchedSourceExcerpt, /男女二限值天机，科权禄逢大有为/u);
  assert.match(independentOfLucun.matchedSourceExcerpt, /禄主科权大有为/u);
  const wrongMinor = timed(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
  assert.deepEqual(wrongMinor.guardScopes, ['decadal']);
  assert.equal(wrongMinor.tianjiNatalSanHuaCandidate, true);
  assert.notEqual(wrongMinor.tianjiMingNatalLucunKeQuanDoubleGuardCandidate, true);
  assert.equal(evaluate([{ ...exact, normalizedPayload: wrongMinor }]).status, 'partial');
  const lunar = natal.palaces.find(palace => palace.majorStars.some(row => row.name === '太阴'));
  const [receiver] = lunar.majorStars.splice(lunar.majorStars.findIndex(row => row.name === '太阴'), 1);
  lunar.adjectiveStars.push(receiver);
  const unknown = timed(natal, frame);
  assert.deepEqual(unknown.guardScopes, ['decadal', 'minor']);
  assert.equal(unknown.tianjiNatalSanHuaCandidate, undefined);
  assert.equal(unknown.tianjiNatalLucunKeQuanCandidate, true);
  assert.equal(unknown.tianjiMingNatalLucunKeQuanDoubleGuardCandidate, true);
  const lucunWithoutVerifiedHuaLu = evaluate([{ ...exact, normalizedPayload: unknown }]);
  assert.equal(lucunWithoutVerifiedHuaLu.status, 'partial');
  assert.equal(lucunWithoutVerifiedHuaLu.matchedSourceExcerpt, undefined);
});

test('Tianji aspect binds Jumen and one complete Yang-Tuo layer without requiring the separate triple transformation', () => {
  for (const [year, expected, text] of [[1994, [true, false], '本命擎羊、陀罗均会此限'], [2034, [false, true], '流年擎羊、陀罗均会此限']]) {
    const { run, fact, data } = transformationSample('1980-03-11', 0, year);
    assert.equal(data.tianjiSanHuaCandidate, false);
    const seat = data.seats.find(row => row.tianjiNatalYangTuo || row.tianjiYearYangTuo);
    assert.equal(seat.tianji.relation, '三合');
    assert.ok(['守', '三合'].includes(seat.jumen.relation));
    assert.deepEqual([seat.tianjiNatalYangTuo, seat.tianjiYearYangTuo], expected);
    const found = transformationMatch(run, 'expansion-p026');
    assert.equal(found.status, 'partial');
    const aspect = run.facts.filter(row => tianjiTimedFact(row) && row.normalizedPayload.tianjiShaAspectCandidate === true);
    assert.ok(aspect.every(row => row.normalizedPayload.activeInSourceHalf === false));
    assert.ok(aspect.every(row => row.normalizedPayload.tianjiAspectWitnesses.some(witness => witness.scope === seat.layer
      && witness.branch === seat.branch && witness.layer === (expected[0] ? 'natal' : 'yearly')
      && witness.tianji.relation === '三合' && witness.sha.length === 2)));
    assert.deepEqual(found.sourceFactIds, aspect.map(row => row.factId));
    assert.deepEqual(found.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianji-sha-aspect'));
    const audit = formatFortuneFactAudit(input);
    assert.ok(audit.includes(text));
    assert.match(audit, /另首天机照限的羊陀巨暗条件同段成立/u);
    assert.doesNotMatch(formatFortunePrompt(input), /天机照限的羊陀巨暗/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === found.knowledgeId));
    if (year === 1994) {
      const n = native('1980-03-11', 0), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
      const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch),
        minorIndex: index(data.minorBranch), age: data.sourceMinor.ordinal };
      const origin = n.palaces.find(row => row.majorStars.some(star => star.name === '紫微'));
      n.palaces.find(row => row.index === (origin.index + 1) % 12).majorStars.push(origin.majorStars.find(star => star.name === '紫微'));
      origin.majorStars = origin.majorStars.filter(star => star.name !== '紫微');
      const archived = quanshuTransformLimits(n, frame);
      assert.equal(archived.seats.find(row => row.layer === seat.layer).tianjiNatalYangTuo, undefined);
      const window = { start: Date.parse(aspect[0].activeFrom), end: Date.parse(aspect[0].activeTo) };
      const [timing] = quanshuLimitTiming(n, quanshuLimitBranches(n, frame), window, frame);
      assert.ok(timing.data.unverifiedTimingStars.includes('天机'));
      const invalid = quanshuTimedTianji(timing.data, archived);
      assert.equal(invalid.tianjiShaAspectCandidate, undefined);
      assert.deepEqual(invalid.tianjiAspectWitnesses, []);
      assert.equal(transformationMatch({ ...run, facts: [{ ...aspect[0], normalizedPayload: invalid }] }, 'expansion-p026').status, 'unknown');
    }
  }
  const near = transformationSample('1980-03-11', 0, 1993);
  assert.ok(near.data.seats.some(row => ['三合', '冲'].includes(row.tianji.relation)
    && ['守', '冲', '三合'].includes(row.jumen.relation)));
  assert.ok(near.run.facts.filter(tianjiTimedFact).every(row => row.normalizedPayload.tianjiPlainOppositionCandidate === false));
  assert.equal(transformationMatch(near.run, 'expansion-p026').status, 'not_matched');
});

test('p026 tests the separate Ming Tianji verse against either actual limit through its opposite palace', () => {
  const birth = '1980-03-11', hour = 0;
  for (const [year, scope, label] of [[1991, 'minor', '小限'], [2014, 'decadal', '大限']]) {
    const { run, fact, data } = transformationSample(birth, hour, year);
    assert.deepEqual([data.tianjiNatalSanHuaCandidate, data.tianjiNatalLucunKeQuanCandidate, data.tianjiShaAspectCandidate], [false, false, false]);
    const facts = run.facts.filter(tianjiTimedFact);
    for (const timed of facts) {
      const p = timed.normalizedPayload;
      assert.equal(p.tianjiPlainOppositionCandidate, true);
      assert.equal(p.activeInSourceHalf, false);
      assert.deepEqual(p.guardScopes, []);
      assert.deepEqual(p.tianjiPlainOppositionWitnesses, [{ scope, branch: '亥', tianjiBranch: '巳' }]);
    }
    const found = transformationMatch(run, 'expansion-p026');
    assert.equal(found.status, 'matched');
    assert.equal(found.matchedSourceExcerpt, '天机照限不安宁');
    assert.deepEqual(found.sourceFactIds, facts.map(row => row.factId));
    assert.deepEqual(found.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianji-plain-opposition'));
    assert.ok(formatFortuneFactAudit(input).includes(`天机在巳宫，实冲${label}亥宫，另核原书照限句`));
    const provider = formatFortunePrompt(input);
    assert.match(provider, /天机照限不安宁/u);
    assert.doesNotMatch(provider, /实冲[大小]限亥宫|tianjiPlainOppositionWitnesses/u);
    if (scope === 'minor') {
      const n = native(birth, hour), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
      const timed = facts[0];
      const window = { start: Date.parse(timed.activeFrom), end: Date.parse(timed.activeTo) };
      const frame = { lunarYear: year, yearIndex: index(data.annualBranch), decadalIndex: index(data.decadalBranch),
        minorIndex: index('戌'), age: data.sourceMinor.ordinal };
      const limits = quanshuLimitBranches(n, frame);
      assert.equal(limits.sourceMinor.verified, false);
      const [timing] = quanshuLimitTiming(n, limits, window, frame);
      const normalizedPayload = quanshuTimedTianji(timing.data, quanshuTransformLimits(n, frame));
      assert.equal(normalizedPayload.tianjiPlainOppositionCandidate, undefined);
      assert.deepEqual(normalizedPayload.tianjiPlainOppositionWitnesses, []);
      assert.equal(transformationMatch({ ...run, facts: [{ ...timed, normalizedPayload }] }, 'expansion-p026').status, 'unknown');
    }
  }
});

test('p026 cannot use an archive-only small limit when its old group flags would be true', () => {
  const birth = '1947-02-05', hour = 1, year = 1967;
  const sample = yearTransformation(completeQuanshuBirth(birth, hour), year);
  const actual = sample.run.facts.find(row => tianjiTimedFact(row) && row.normalizedPayload.activeInSourceHalf === true);
  assert.ok(actual);
  assert.equal(sample.data.tianjiNatalSanHuaCandidate, true);
  const n = native(birth, hour), index = branch => n.palaces.find(row => row.earthlyBranch === branch).index;
  const frame = { lunarYear: year, yearIndex: index(sample.data.annualBranch), decadalIndex: index(sample.data.decadalBranch),
    minorIndex: index(sample.data.minorBranch), age: sample.data.sourceMinor.ordinal };
  const context = quanshuTransformLimits(n, frame), limits = quanshuLimitBranches(n, frame);
  const unverifiedContext = { ...context, sourceMinor: { ...context.sourceMinor, verified: false } };
  const unverifiedLimits = { ...limits, sourceMinor: { ...limits.sourceMinor, verified: false } };
  const window = { start: Date.parse(actual.activeFrom), end: Date.parse(actual.activeTo) };
  const [timing] = quanshuLimitTiming(n, unverifiedLimits, window, frame);
  const unverified = quanshuTimedTianji(timing.data, unverifiedContext);
  assert.equal(unverified.activeInSourceHalf, undefined);
  assert.deepEqual(unverified.guardScopes, []);
  assert.deepEqual(unverified.tianjiSupportWitnesses, []);
  const run = { ...sample.run, facts: [{ ...actual, normalizedPayload: unverified }] };
  assert.equal(transformationMatch(run, 'expansion-p026').status, 'unknown');
});

test('p026 uses the back half of the actual Tianji decade even when the small limit does not guard it', () => {
  const snapshot = completeQuanshuBirth('1953-02-15', 5);
  for (const [year, expected] of [[1988, false], [1991, true]]) {
    const { run, fact, data } = yearTransformation(snapshot, year);
    assert.equal(data.decadalBranch, '子');
    assert.notEqual(data.minorBranch, '子');
    assert.equal(data.tianjiNatalLucunKeQuanCandidate, true);
    const timed = run.facts.filter(tianjiTimedFact);
    for (const row of timed) {
      assert.deepEqual(row.normalizedPayload.guardScopes, expected ? ['decadal'] : []);
      assert.equal(row.normalizedPayload.tianjiNatalLucunKeQuanCandidate, expected);
    }
    const result = transformationMatch(run, 'expansion-p026');
    assert.equal(result.status, expected ? 'partial' : 'not_matched');
    assert.deepEqual(result.windows, expected ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
  }
});

test('Quan-Lu-Ji distinguishes the natal guard, the separated yearly guard and a lone non-seated witness', () => {
  for (const [birth, hour, year, flags, hasSha] of [
    ['1979-07-15', 3, 2011, [true, false, true], true],
    ['1980-05-15', 3, 2019, [false, true, false], true],
    ['1979-07-15', 2, 2008, [false, false, false], false],
  ]) {
    const { run, fact, data } = transformationSample(birth, hour, year);
    const seat = data.seats.find(row => row.groups.some(group => group.jiLuQuan));
    const group = seat.groups.find(row => row.jiLuQuan);
    assert.deepEqual([group.jiNatalShaGuard, group.jiYearYangGuard, group.jiNatalShaPair], flags);
    assert.equal(data.sameSourceQuanLuJiShaCandidate, hasSha);
    assert.equal(data.natalQuanLuJiShaAtLimit, year === 2011);
    const found = transformationMatch(run, 'expansion-p042');
    assert.equal(found.status, 'partial');
    assert.deepEqual(found.sourceFactIds, [fact.factId]);
    if (!hasSha) {
      assert.deepEqual([data.volumeTwoTabooReliefAtLimitCandidate, data.volumeTwoTabooFallenAtLimitCandidate,
        data.volumeTwoTabooTempleAtLimitCandidate, data.lianzhenHaiWaterYearAtLimitCandidate], [false, false, true, false]);
      assert.deepEqual(seat.namedMixedContacts.map(row => [row.star, row.relation]), [['归档铃星', '三合']]);
      assert.deepEqual(seat.mixedTabooContext.modernSkyPositions, [{ star: '今法天空', branch: '申', relation: '守' }]);
      assert.equal(seat.mixedTabooContext.namedPositions.find(row => row.star === '古天空').relation, '其他');
      const natal = native(birth, hour), frame = combinationFrame(natal, data);
      const missingRobbery = quanshuTransformLimits(archiveMinorInWrongLayer(natal, '地劫'), frame);
      const retained = missingRobbery.seats.find(row => row.layer === seat.layer);
      assert.deepEqual(retained.mixedTabooContext.namedPositions.find(row => row.star === '古天空'),
        seat.mixedTabooContext.namedPositions.find(row => row.star === '古天空'));
      assert.equal(retained.hazards.find(row => row.star === '地劫').branch, undefined);
      assert.equal(missingRobbery.natalQuanLuJiShaAtLimit, false);
      const missingSky = quanshuTransformLimits(archiveMinorInWrongLayer(natal, '地空'), frame);
      const skyAbsent = missingSky.seats.find(row => row.layer === seat.layer);
      assert.equal(skyAbsent.mixedTabooContext.namedPositions.find(row => row.star === '古天空').branch, undefined);
      assert.deepEqual(skyAbsent.hazards.find(row => row.star === '地劫'), seat.hazards.find(row => row.star === '地劫'));
      assert.equal(retained.mixedTabooContext.bothSourceHourVoidsOutside, undefined);
      assert.equal(skyAbsent.mixedTabooContext.bothSourceHourVoidsOutside, undefined);
      assert.equal(skyAbsent.mixedTabooContext.sourceHourVoidContacts[0].relation, undefined);
    }
  }
});

test('p042 binds yearly Yang and a named natal star to the very same aspect palace and preserves the temple branch', () => {
  const run = calculate(chart(native('1981-03-24', 9)), 'year', { year: 1999 });
  validateFortuneFacts(run);
  const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === 1999);
  const seat = fact.normalizedPayload.seats.find(row => row.layer === 'minor');
  const group = seat.groups.find(row => row.jiYearYangMixedAspect);
  assert.equal(seat.branch, '丑');
  assert.equal(group.stem, '己');
  assert.deepEqual([group.jiNatalShaGuard, group.jiYearYangGuard, group.jiNatalShaPair], [false, false, false]);
  assert.deepEqual(group.jiYearYangMixedWitnesses, [
    { star: '流年擎羊', branch: '未', relation: '冲' }, { star: '归档铃星', branch: '未', relation: '冲' },
  ]);
  assert.equal(group.mixedTabooSummaryGrade, '庙');
  assert.equal(group.layer, 'yearly');
  assert.equal(fact.normalizedPayload.natalQuanLuJiShaAtLimit, false);
  assert.equal(fact.normalizedPayload.volumeTwoTabooTempleAtLimitCandidate, true);
  assert.equal(seat.mixedTabooContext.allNamedVisible, false);
  assert.equal(seat.mixedTabooContext.bothSourceHourVoidsOutside, true);
  assert.deepEqual(seat.mixedTabooContext.sourceHourVoidContacts, [
    { star: '古天空', branch: '寅', relation: '其他' }, { star: '地劫', branch: '申', relation: '其他' },
  ]);
  assert.ok(seat.mixedTabooContext.helperPairs.find(row => row.label === '文昌文曲').stars.every(row => row.relation === '守'));
  const hit = transformationMatch(run, 'expansion-p042');
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  assert.ok(hit.windows.some(window => window.start <= fact.activeFrom && fact.activeTo <= window.endExclusive));
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'mixed-taboo-aspect')).input;
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /流年擎羊与下列同宫参与曜共在同一个照临宫：未宫的流年擎羊与限宫为冲、未宫的归档铃星与限宫为冲/u);
  assert.match(prompt, /化忌受曜的卷三原表等级为庙/u);
  assert.match(prompt, /紫府昌曲的文昌文曲位置：丑宫的文昌与限宫为守、丑宫的文曲与限宫为守/u);
  assert.match(prompt, /古天空和地劫均在该限宫的守、冲、三合之外/u);
  assert.doesNotMatch(prompt, /jiYearYangMixedAspect|mixedTabooContext/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  assert.doesNotMatch(formatFortunePrompt(input), /sourceHourVoidContacts|bothSourceHourVoidsOutside|古天空和地劫均在该限宫的守、冲、三合之外/u);

  const near = transformationSample('1979-07-03', 8, 2021);
  const other = near.data.seats.find(row => row.layer === 'decadal');
  assert.ok(other.hazards.some(row => row.star === '流年擎羊' && row.branch === '戌' && row.relation === '三合'));
  assert.deepEqual(other.namedMixedContacts, [{ star: '归档铃星', branch: '午', relation: '三合' }]);
  assert.equal(other.groups.find(row => row.jiLuQuan).jiYearYangMixedAspect, false);
  assert.equal(transformationMatch(near.run, 'expansion-p042').status, 'not_matched');

  const incomplete = native('1981-03-24', 9);
  for (const palace of incomplete.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[key] = palace[key].filter(row => row.name !== '铃星');
  }
  const unknown = quanshuTransformLimits(incomplete, { lunarYear: 1999, yearIndex: 1, decadalIndex: 5, minorIndex: 11 });
  assert.equal(unknown.seats.find(row => row.layer === 'minor').groups.find(row => row.jiLuQuan).jiYearYangMixedAspect, undefined);
});

test('p042 verifies the natal transformation triple and the Ming Bell with Yang in the same aspect palace', () => {
  const birth = '1991-03-02', hour = 8;
  const { run, fact, data } = transformationSample(birth, hour, 2002);
  const seat = data.seats.find(row => row.layer === 'minor');
  assert.deepEqual([seat.branch, data.sourceMinor.verified], ['寅', true]);
  const group = seat.groups.find(row => row.layer === 'natal');
  assert.equal(group.stem, '辛');
  assert.deepEqual(group.stars.filter(row => row.kind !== '科').map(row => [row.kind, row.star, row.relation]),
    [['禄', '巨门', '守'], ['权', '太阳', '守'], ['忌', '文昌', '守']]);
  assert.equal(data.natalQuanLuJiMingYangBellAspectAtLimit, true);
  assert.deepEqual(group.jiMingYangBellAspectWitnesses, [
    { star: '擎羊', branch: '戌', relation: '三合' }, { star: '铃星', branch: '戌', relation: '三合' },
  ]);
  assert.deepEqual(seat.mixedTabooContext.namedPositions.find(row => row.star === '归档铃星'),
    { star: '归档铃星', branch: '午', relation: '三合' });
  const isolated = structuredClone(run);
  const ruleFact = transformationFacts(isolated)[0].normalizedPayload;
  ruleFact.natalQuanLuJiShaAtLimit = false;
  const found = transformationMatch(isolated, 'expansion-p042');
  assert.equal(found.status, 'partial');
  assert.deepEqual(found.sourceFactIds, [fact.factId]);
  ruleFact.quanshuFixedFireBellProfile = 'archive-position';
  assert.equal(transformationMatch(isolated, 'expansion-p042').status, 'not_matched');
  const natal = native(birth, hour), wrongBlade = archiveMinorInWrongLayer(natal, '擎羊');
  const shifted = quanshuTransformLimits(wrongBlade, combinationFrame(natal, data));
  assert.equal(shifted.natalQuanLuJiMingYangBellAspectAtLimit, undefined);
  assert.equal(shifted.seats.find(row => row.layer === 'minor').groups.find(row => row.layer === 'natal').jiMingYangBellAspectWitnesses, undefined);
  assert.equal(transformationMatch({ ...run, facts: [{ ...fact, normalizedPayload: {
    ...shifted, natalQuanLuJiShaAtLimit: false,
  } }] }, 'expansion-p042').status, 'unknown');
  for (const [year, temple] of [[2001, false], [2003, true]]) {
    const near = transformationSample(birth, hour, year);
    assert.equal(near.data.natalQuanLuJiMingYangBellAspectAtLimit, false);
    assert.equal(near.data.volumeTwoTabooTempleAtLimitCandidate, temple);
    assert.equal(transformationMatch(near.run, 'expansion-p042').status, temple ? 'partial' : 'not_matched');
  }
  const otherHour = transformationSample(birth, 7, 2002);
  assert.equal(otherHour.data.natalQuanLuJiMingYangBellAspectAtLimit, false);
  assert.equal(transformationMatch(otherHour.run, 'expansion-p042').status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-yang-bell-taboo'));
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== found.knowledgeId)));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /生年权禄忌实守同一限宫，擎羊与明刊定宫铃星在同一个照临宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /擎羊与明刊定宫铃星在同一个照临宫|jiMingYangBellAspect/u);
});

test('p042 source hour voids are outside every verified same-emitter triple geometry', () => {
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const branchAt = index => branches[(index + 12) % 12];
  const pivotCases = [];
  for (const [hour, birthHour] of branches.entries()) {
    const voids = quanshuKongJiePositions(native('1991-03-02', hour));
    assert.equal(voids.ready, true);
    assert.deepEqual([voids.skyBranch, voids.robberyBranch], [branchAt(11 - hour), branchAt(11 + hour)]);
    const auxiliaries = quanshuAuxiliaryPositions(1, birthHour, '辛').named;
    for (const [ziwei] of branches.entries()) {
      const tianfu = (4 - ziwei + 12) % 12;
      // The Ming verse lists the Ziwei line in reverse and Tianfu's line forward.
      const positions = new Map([
        ...Object.entries({ 紫微: 0, 天机: -1, 太阳: -3, 武曲: -4, 天同: -5, 廉贞: -8 })
          .map(([star, offset]) => [star, branchAt(ziwei + offset)]),
        ...Object.entries({ 天府: 0, 太阴: 1, 贪狼: 2, 巨门: 3, 天相: 4, 天梁: 5, 七杀: 6, 破军: 10 })
          .map(([star, offset]) => [star, branchAt(tianfu + offset)]),
        ...auxiliaries.map(({ star, branch }) => [star, branch]),
      ]);
      for (const stem of '甲乙丙丁戊己庚辛壬癸') {
        const trio = quanshuTransformations(stem).filter(({ kind }) => kind !== '科');
        const seat = positions.get(trio[0].star);
        if (trio.every(({ star }) => positions.get(star) === seat)) {
          assert.ok(seat);
          pivotCases.push([birthHour, stem, seat, trio.find(({ kind }) => kind === '忌').star]);
          assert.equal(quanshuPalaceRelation(seat, voids.skyBranch), '其他');
          assert.equal(quanshuPalaceRelation(seat, voids.robberyBranch), '其他');
        }
      }
    }
  }
  assert.deepEqual(pivotCases, [['寅', '辛', '申', '文昌'], ['卯', '己', '未', '文曲'],
    ['申', '辛', '寅', '文昌'], ['酉', '己', '丑', '文曲']]);
});

test('p042 retains another stem layer as geometry without triggering the natal Quan-Lu-Ji rule', () => {
  const { run, data } = yearTransformation(completeQuanshuBirth('1949-02-05', 8), 1966);
  const seat = data.seats.find(row => row.layer === 'minor');
  assert.equal(seat.branch, '寅');
  assert.deepEqual(seat.groups.filter(group => group.jiSha).map(({ layer, stem }) => [layer, stem]), [['decadal', '辛']]);
  assert.equal(seat.mixedTabooContext.bothSourceHourVoidsOutside, true);
  assert.deepEqual(seat.mixedTabooContext.sourceHourVoidContacts, [
    { star: '古天空', branch: '卯', relation: '其他' }, { star: '地劫', branch: '未', relation: '其他' },
  ]);
  assert.equal(data.sameSourceQuanLuJiShaCandidate, true);
  assert.equal(data.natalQuanLuJiShaAtLimit, false);
  assert.deepEqual([data.volumeTwoTabooReliefAtLimitCandidate, data.volumeTwoTabooFallenAtLimitCandidate,
    data.volumeTwoTabooTempleAtLimitCandidate, data.lianzhenHaiWaterYearAtLimitCandidate], [false, false, false, false]);
  const hit = transformationMatch(run, 'expansion-p042');
  assert.equal(hit.status, 'not_matched');
  assert.deepEqual(hit.sourceFactIds, []);
  const phrase = describeFortuneFact({ method: 'ziwei', type: 'quanshu_transform_limits', data }, String);
  assert.match(phrase, /同组权禄忌同守，并见篇内煞曜候选，留作其他发干盘层对照/u);
  assert.doesNotMatch(phrase, /生年同组权禄忌同守/u);
});

test('mixed-stem triples, missing or duplicated locations, and absent partners cannot stand in for a source condition', () => {
  const run = calculate(chart(native('1947-02-05', 3)), 'year', { year: 2005 });
  const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === 2005);
  const data = fact.normalizedPayload;
  assert.equal(data.sameSourceQuanLuJiShaCandidate, false);
  assert.ok(data.seats.some(seat => {
    const kinds = new Set(seat.groups.flatMap(group => group.stars.filter(star => star.relation === '守').map(star => star.kind)));
    return ['权', '禄', '忌'].every(kind => kinds.has(kind)) && !seat.groups.some(group => group.jiLuQuan);
  }));
  const onlyCurrentYear = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  assert.deepEqual([data.volumeTwoTabooReliefAtLimitCandidate, data.volumeTwoTabooFallenAtLimitCandidate,
    data.volumeTwoTabooTempleAtLimitCandidate, data.lianzhenHaiWaterYearAtLimitCandidate], [false, false, true, false]);
  assert.equal(transformationMatch(onlyCurrentYear, 'expansion-p042').status, 'partial');
  const onlyGeneric = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType) };
  assert.equal(transformationMatch(onlyGeneric, 'expansion-p042').status, 'unknown');

  const original = native('1980-03-11', 9);
  const frame = { lunarYear: 2001, yearIndex: 3, decadalIndex: 2, minorIndex: 11 };
  const before = quanshuTransformLimits(original, frame);
  const group = before.seats.flatMap(seat => seat.groups).find(group => group.jiSha === true);
  const taboo = group.stars.find(star => star.kind === '忌').star;
  const archived = original.palaces.flatMap(p => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]).find(star => star.name === taboo);
  const changed = structuredClone(original);
  changed.palaces[0].minorStars.push(archived);
  const after = quanshuTransformLimits(changed, frame);
  assert.equal(after.ready, true);
  assert.equal(after.sameSourceQuanLuJiShaCandidate, undefined);
  const missingPartner = quanshuTransformLimits(native('1947-02-05', 11), { lunarYear: 2044, yearIndex: 10, decadalIndex: 10 });
  assert.equal(missingPartner.tripleTabooCandidate, undefined);
  assert.equal(quanshuTransformLimits(original, { ...frame, yearIndex: 10 }).ready, false);
});

test('p042 distinguishes named relief, verified natal luminaries and wider emitters in the local audit', () => {
  const cases = [
    ['1947-03-02', 6, 1961, 'decadal', 'decadal', '庚', '天同', '戌', '丁', true],
    ['1951-03-11', 10, 1996, 'minor', 'decadal', '丁', '巨门', '辰', '辛', true],
    ['1947-02-05', 7, 2039, 'minor', 'decadal', '甲', '太阳', '巳', undefined, true],
    ['1947-02-05', 7, 2035, 'minor', 'yearly', '乙', '太阴', '酉', undefined, true],
    ['1947-02-05', 3, 2007, 'minor', 'decadal', '甲', '太阳', '丑', undefined, false],
    ['1971-05-01', 4, 2015, 'decadal', 'yearly', '乙', '太阴', '巳', undefined, false],
  ];
  for (const [birth, hour, year, scope, layer, stem, star, branch, birthStem, relief] of cases) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'taboo-named-cases-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(native(birth, hour)) })));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const fact = transformationFacts(bound).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload, seat = data.seats.find(row => row.layer === scope);
    const group = seat.groups.find(row => row.layer === layer);
    assert.equal(seat.branch, branch);
    assert.equal(group.stem, stem);
    assert.equal(group.reliefBirthStem, birthStem);
    assert.deepEqual(group.stars.find(row => row.kind === '忌'), { kind: '忌', star, branch, relation: '守' });
    assert.deepEqual([group.jiVolumeTwoRelief, group.jiVolumeTwoFallen], [relief, !relief]);
    assert.equal(group.jiVolumeTwoBirthStemRelief, birthStem !== undefined);
    assert.equal(data.volumeTwoNamedBirthStemJiReliefCandidate, birthStem !== undefined);
    assert.deepEqual([data.sunNatalJiReliefGuard, data.moonNatalJiReliefGuard], [false, false]);
    assert.deepEqual([data.sameSourceQuanLuJiShaCandidate, data.volumeTwoTabooReliefAtLimitCandidate,
      data.volumeTwoTabooFallenAtLimitCandidate], [false, relief, !relief]);
    const run = { ...bound, facts: bound.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = transformationMatch(run, 'expansion-p042');
    const matched = birthStem !== undefined || !relief;
    assert.equal(hit.status, matched ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, matched ? [fact.factId] : []);
    assert.deepEqual(hit.windows, matched ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-taboo-cases'));
    const prompt = formatFortuneFactAudit(input);
    const reason = !relief ? '其宫位在卷二明列的陷地，为另一分支'
      : birthStem ? '卷二另列此处的缓和条件' : '此宫位另作《全书》明列见位的对照';
    assert.ok(prompt.includes(star + '在' + branch + '宫化忌并守此限，' + reason));
    if (birthStem) assert.ok(prompt.includes(reason + '，此例所核生年干为' + birthStem));
    assert.doesNotMatch(prompt, /reliefBirthStem|jiVolumeTwoFallen/u);
  }
});

test('p042 reads verified natal Sun and Moon relief in their listed palace and actual limit', () => {
  const cases = [
    ['1984-03-11', 3, 2004, 'minor', '甲', '太阳', '寅', true],
    ['1984-07-11', 0, 2028, 'decadal', '甲', '太阳', '卯', true],
    ['1985-03-11', 0, 2004, 'minor', '乙', '太阴', '子', true],
    ['1985-03-11', 3, 1999, 'decadal', '乙', '太阴', '子', true],
    ['1985-03-11', 7, 2006, 'minor', '乙', '太阴', '戌', true],
    ['1984-03-11', 0, 1997, 'minor', '甲', '太阳', '酉', false],
    ['1985-07-11', 0, 1996, 'minor', '乙', '太阴', '申', false],
  ];
  for (const [birth, hour, year, layer, stem, star, branch, relief] of cases) {
    const { run, fact, data } = yearTransformation(completeQuanshuBirth(birth, hour), year);
    const seat = data.seats.find(row => row.layer === layer);
    const natal = seat.groups.find(row => row.layer === 'natal');
    assert.equal(data.natalLuminaryJiProfile, 'quanshu-ming-natal-luminary-ji-v1');
    assert.equal(data.sourceMinor.verified, true);
    assert.equal(natal.stem, stem);
    assert.deepEqual(natal.stars.find(row => row.kind === '忌'), { kind: '忌', star, branch, relation: '守' });
    assert.deepEqual([data.sunNatalJiReliefGuard, data.moonNatalJiReliefGuard], [relief && stem === '甲', relief && stem === '乙']);
    assert.equal(data.natalLuminaryJiBirthAnchorProof, relief ? 'quanshu-natal-ziwei-bureau-lunar-day-v1' : undefined);
    if (relief) {
      const hit = transformationMatch({ ...run, facts: [fact] }, 'expansion-p042');
      assert.equal(hit.status, 'matched');
      const shortExcerpt = star === '太阳' ? '太阳在寅卯辰巳午化忌' : '太阴在酉戌亥子化忌';
      assert.equal(hit.matchedSourceExcerpt, shortExcerpt);
      assert.deepEqual(hit.sourceFactIds, [fact.factId]);
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      if (year === 2006 || (birth === '1984-03-11' && year === 2004)) {
        const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-luminary-relief'));
        const phrase = '生年' + stem + '干使' + star + '在' + branch + '宫化忌并守此限，符合明列的缓和宫位';
        assert.ok(formatFortuneFactAudit(input).includes(phrase));
        assert.ok(!formatFortunePrompt(input).includes(phrase));
        assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId).originalText, shortExcerpt);
        assert.doesNotMatch(formatFortunePrompt(input), /natalLuminaryJiBirthAnchorProof|作事进退/u);
        const nonMing = { ...fact, normalizedPayload: { ...data, natalLuminaryJiProfile: 'other-source' } };
        assert.equal(transformationMatch({ ...run, facts: [nonMing] }, 'expansion-p042').status, 'not_matched');
        const withoutBirthAnchor = { ...fact, normalizedPayload: { ...data, natalLuminaryJiBirthAnchorProof: undefined } };
        assert.equal(transformationMatch({ ...run, facts: [withoutBirthAnchor] }, 'expansion-p042').status, 'partial');
      }
    }
  }

  const n = native('1984-03-11', 3);
  const frame = { lunarYear: 2004, yearIndex: 6, decadalIndex: 9, minorIndex: 0 };
  const correct = quanshuTransformLimits(n, frame);
  assert.equal(correct.sunNatalJiReliefGuard, true);
  const adjacentBirth = native('1984-03-12', 3);
  const wrongDayArchive = { ...adjacentBirth, palaces: adjacentBirth.palaces.map(palace => ({ ...palace,
    majorStars: n.palaces.find(row => row.index === palace.index).majorStars,
  })) };
  const wrongDay = quanshuTransformLimits(wrongDayArchive, frame);
  assert.equal(wrongDay.sunNatalJiReliefGuard, true);
  assert.equal(wrongDay.natalLuminaryJiBirthAnchorProof, undefined);
  const missing = quanshuTransformLimits(n, { ...frame, minorIndex: undefined });
  assert.equal(missing.sourceMinor.verified, undefined);
  assert.equal(missing.sunNatalJiReliefGuard, undefined);
  const corruptDirection = quanshuTransformLimits({ ...n, gender: '男' }, frame);
  assert.equal(corruptDirection.sourceMinor.verified, false);
  assert.ok(corruptDirection.seats.find(row => row.layer === 'minor').groups.some(group => group.jiVolumeTwoRelief));
  assert.equal(corruptDirection.volumeTwoTabooReliefAtLimitCandidate, undefined);
  assert.equal(corruptDirection.sunNatalJiReliefGuard, undefined);
  const before = yearTransformation(completeQuanshuBirth('1984-03-11', 3), 2003);
  assert.equal(before.data.sunNatalJiReliefGuard, false);
  assert.equal(transformationMatch({ ...before.run, facts: [before.fact] }, 'expansion-p042').status, 'not_matched');
});

test('p042 keeps wrong birth stems, unlisted fall seats and ambiguous recipients from supplying named cases', () => {
  for (const [birth, hour, year, scope, star, branch, temple, status] of [
    ['1990-05-05', 0, 2008, 'minor', '天同', '戌', undefined, 'unknown'],
    ['1990-05-05', 0, 2007, 'decadal', '巨门', '辰', false, 'not_matched'],
    ['1971-05-01', 8, 2001, 'minor', '太阴', '未', undefined, 'unknown'],
  ]) {
    const { run, data } = transformationSample(birth, hour, year);
    const seat = data.seats.find(row => row.layer === scope);
    assert.equal(seat.branch, branch);
    assert.ok(seat.groups.some(row => row.ji === true && row.stars.some(item => item.kind === '忌' && item.star === star)
      && row.jiVolumeTwoRelief === false && row.jiVolumeTwoFallen === false));
    assert.deepEqual([data.sameSourceQuanLuJiShaCandidate, data.volumeTwoTabooReliefAtLimitCandidate,
      data.volumeTwoTabooFallenAtLimitCandidate, data.volumeTwoTabooTempleAtLimitCandidate,
      data.lianzhenHaiWaterYearAtLimitCandidate], [false, false, false, temple, false]);
    assert.equal(transformationMatch(run, 'expansion-p042').status, status);
  }

  const duplicate = native('1947-03-02', 6);
  const recipient = duplicate.palaces.flatMap(palace => palace.majorStars).find(star => star.name === '天同');
  duplicate.palaces[0].majorStars.push(recipient);
  const run = calculate(chart(duplicate), 'year', { year: 1961 });
  const fact = transformationFacts(run).find(row => row.normalizedPayload.lunarYear === 1961);
  const seat = fact.normalizedPayload.seats.find(row => row.layer === 'decadal');
  assert.equal(seat.groups.find(row => row.layer === 'decadal').jiVolumeTwoRelief, undefined);
});

test('p042 confirms natal Lianzhen Ji in Hai across two independently verified water readings', () => {
  const snapshot = completeQuanshuBirth('1936-03-05', 10);
  const years = [
    [1997, '1997-02-06T16:00:00.000Z', false, true, ['子', '戌'], ['亥', '酉']],
    [2007, '2007-02-17T16:00:00.000Z', true, true, ['亥', '子'], ['戌', '亥']],
    [2008, '2008-02-06T16:00:00.000Z', true, false, ['戌', '亥'], ['戌', '戌']],
  ];
  for (const [year, boundary, prior, incoming, priorLimits, incomingLimits] of years) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'natal-lianzhen-both-water-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const facts = transformationFacts(run);
    const before = facts.find(row => row.activeTo === boundary);
    const after = facts.find(row => row.activeFrom === boundary);
    assert.ok(before && after);
    const hit = transformationMatch(run, 'expansion-p042');
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '如廉贞在亥化忌是也');
    for (const [fact, qualifies, limits] of [[before, prior, priorLimits], [after, incoming, incomingLimits]]) {
      const data = fact.normalizedPayload;
      assert.deepEqual([data.birthYearPillar, data.birthYearNaYin, data.verifiedLifeBureau], ['丙子', '涧下水', '水二局']);
      assert.deepEqual([data.decadalBranch, data.minorBranch], limits);
      assert.equal(data.natalLianzhenHaiBothWaterGuard, qualifies);
      assert.equal(hit.sourceFactIds.includes(fact.factId), qualifies);
      if (!qualifies) continue;
      const seat = data.seats.find(row => row.branch === '亥');
      assert.ok(seat.layer === 'decadal' ? data.sourceDecadal.verified : data.sourceMinor.verified);
      const group = seat.groups.find(row => row.layer === 'natal');
      assert.equal(group.stem, '丙');
      assert.deepEqual(group.stars.find(row => row.kind === '忌'), { kind: '忌', star: '廉贞', branch: '亥', relation: '守' });
      assert.equal(group.jiVolumeTwoTemple, false);
    }
    if (year === 1997) assert.equal(hit.windows[0].start, boundary);
    if (year === 2008) assert.equal(hit.windows.at(-1).endExclusive, boundary);
    if (year !== 2007) continue;
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-lianzhen-both-water'));
    const auditOnly = /生年纳音属水、命宫为水二局，生年丙干的廉贞在亥宫化忌并守此限/u;
    assert.match(formatFortuneFactAudit(input), auditOnly);
    const message = formatFortunePrompt(input);
    assert.match(message, /如廉贞在亥化忌是也/u);
    assert.match(message, /权禄兼空组及入庙另论/u);
    assert.doesNotMatch(message, auditOnly);
    assert.doesNotMatch(message, /原文：权禄与忌同宫|原文：忌星入庙|natalLianzhenHaiBothWaterGuard/u);
    const natal = snapshot.ziwei.rawResult[0], p = after.normalizedPayload;
    const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
    const wrongMinor = quanshuTransformLimits(natal, { lunarYear: year, yearIndex: index(p.annualBranch),
      decadalIndex: index(p.decadalBranch), minorIndex: index('子') });
    assert.equal(wrongMinor.sourceMinor.verified, false);
    assert.equal(wrongMinor.natalLianzhenHaiBothWaterGuard, undefined);
  }
  assert.equal(quanshuBrightness('廉贞', '亥'), '陷');
  const otherBureau = transformationSample('1936-03-07', 8, 2019);
  assert.deepEqual([otherBureau.data.birthYearNaYin, otherBureau.data.verifiedLifeBureau,
    otherBureau.data.decadalBranch, otherBureau.data.minorBranch], ['涧下水', '金四局', '亥', '亥']);
  assert.equal(otherBureau.data.lianzhenHaiWaterYearAtLimitCandidate, true);
  assert.equal(otherBureau.data.natalLianzhenHaiBothWaterGuard, false);
  assert.equal(transformationMatch(otherBureau.run, 'expansion-p042').status, 'partial');
});

test('p042 matches natal-year water NaYin and source temple grade as independent client facts', () => {
  const cases = [
    { birth: '1974-02-15', hour: 5, year: 2051, scope: 'minor', layer: 'decadal', stem: '丙',
      star: '廉贞', branch: '亥', naYin: '大溪水', bureau: '金四局', water: true, temple: false },
    { birth: '1974-02-15', hour: 1, year: 2041, scope: 'minor', layer: 'yearly', stem: '辛',
      star: '文昌', branch: '酉', naYin: '大溪水', bureau: '水二局', water: false, temple: true },
    { birth: '1998-02-09', hour: 0, year: 2036, scope: 'decadal', layer: 'yearly', stem: '丙',
      star: '廉贞', branch: '亥', naYin: '城头土', bureau: '水二局', water: false, temple: false },
  ];
  for (const sample of cases) {
    const { birth, hour, year, scope, layer, stem, star, branch, naYin, bureau, water, temple } = sample;
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'taboo-water-temple-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(native(birth, hour)) })));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const fact = transformationFacts(bound).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload, seat = data.seats.find(row => row.layer === scope);
    const group = seat.groups.find(row => row.layer === layer);
    assert.deepEqual([data.birthYearNaYin, data.verifiedLifeBureau], [naYin, bureau]);
    assert.deepEqual([seat.branch, group.stem], [branch, stem]);
    assert.deepEqual(group.stars.find(row => row.kind === '忌'), { kind: '忌', star, branch, relation: '守' });
    assert.deepEqual([group.jiLianzhenHaiWaterYear, group.jiVolumeTwoTemple], [water, temple]);
    assert.deepEqual([data.lianzhenHaiWaterYearAtLimitCandidate, data.volumeTwoTabooTempleAtLimitCandidate], [water, temple]);
    assert.deepEqual([data.sameSourceQuanLuJiShaCandidate, data.volumeTwoTabooReliefAtLimitCandidate,
      data.volumeTwoTabooFallenAtLimitCandidate], [false, false, false]);
    const run = { ...bound, facts: bound.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = transformationMatch(run, 'expansion-p042');
    assert.equal(hit.status, water || temple ? 'partial' : 'not_matched');
    if (!water && !temple) continue;
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'taboo-water-temple'));
    const prompt = formatFortuneFactAudit(input);
    if (water) {
      assert.match(prompt, /农历生年柱为甲寅，纳音为大溪水/u);
      assert.match(prompt, /廉贞在亥宫化忌并守此限/u);
    } else {
      assert.match(prompt, /文昌在酉宫化忌并守此限，卷三星表明确列为庙/u);
    }
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
    assert.doesNotMatch(prompt, /jiLianzhenHaiWaterYear|jiVolumeTwoTemple/u);
  }
});

test('the recorded source table independently retains Ren Tianfu Ke and literal Lu-Yang-Tuo positions for all ten stems', () => {
  assert.deepEqual(quanshuTransformations('壬'), [{ star: '天梁', kind: '禄' }, { star: '紫微', kind: '权' }, { star: '天府', kind: '科' }, { star: '武曲', kind: '忌' }]);
  assert.deepEqual(quanshuTransformations('庚').filter(t => t.kind === '忌'), [{ star: '天同', kind: '忌' }]);
  const order = '子丑寅卯辰巳午未申酉戌亥';
  for (const stem of '甲乙丙丁戊己庚辛壬癸') {
    const p = quanshuLuYangTuo(stem), index = order.indexOf(p.lucunBranch);
    assert.equal(order[(index + 1) % 12], p.qingyangBranch); assert.equal(order[(index + 11) % 12], p.tuoluoBranch);
    assert.equal(quanshuTransformations(stem).length, 4);
  }
  assert.deepEqual(quanshuLuYangTuo('庚'), { lucunBranch: '申', qingyangBranch: '酉', tuoluoBranch: '未' });
  assert.deepEqual(quanshuLuYangTuo('癸'), { lucunBranch: '子', qingyangBranch: '丑', tuoluoBranch: '亥' });
  assert.throws(() => quanshuTransformations('')); assert.throws(() => quanshuLuYangTuo('甲乙'));
});

test('unprinted quality cells stay unknown and source brightness never borrows a default-engine grade', () => {
  assert.equal(quanshuBrightness('破军', '子'), '庙'); assert.equal(quanshuBrightness('破军', '午'), '庙');
  assert.equal(quanshuBrightness('破军', '辰'), '旺'); assert.equal(quanshuBrightness('破军', '酉'), '陷');
  assert.equal(quanshuBrightness('文昌', '卯'), undefined); assert.equal(quanshuBrightness('紫微', '辰'), undefined);
  assert.equal(quanshuBrightness('七杀', '巳'), '平'); assert.throws(() => quanshuBrightness('七杀', '子丑'));
  const natal = native('1990-05-05', 7);
  const palace = natal.palaces.find(p => [...p.majorStars, ...p.minorStars].some(s => s.name === '文昌'));
  assert.equal(palace.earthlyBranch, '卯');
  const before = quanshuPalaceCondition(natal, palace.index, '命宫');
  palace.minorStars.find(s => s.name === '文昌').brightness = '庙';
  const after = quanshuPalaceCondition(natal, palace.index, '命宫');
  assert.deepEqual(after, before); assert.ok(after.unknownQualityStars.includes('文昌'));
  assert.ok(!after.sourceTempleStars.includes('文昌'));
});

test('source natal frame is recomputed and mismatched, duplicate or leap archives do not fabricate a ready context', () => {
  const natal = native(), before = structuredClone(natal), basis = readQuanshuNatal(natal);
  assert.equal(basis.status, 'ready'); assert.equal(basis.birthStem, '庚'); assert.equal(basis.lifeBranch, '卯'); assert.equal(basis.migrationBranch, '酉');
  assert.equal(quanshuAnnualContext(natal, 2030, '庚').ready, true);
  assert.equal(quanshuAnnualContext(natal, 2030, '辛').ready, false); assert.deepEqual(natal, before);
  for (const alter of [n => { n.rawDates.lunarDate.isLeap = true; }, n => { n.rawDates.chineseDate.hourly[1] = '午'; },
    n => { n.rawDates.chineseDate.yearly[0] = '辛'; }, n => { n.palaces[0].index = n.palaces[1].index; },
    n => { n.palaces.find(p => p.earthlyBranch === '酉').minorStars = n.palaces.find(p => p.earthlyBranch === '酉').minorStars.filter(s => s.name !== '擎羊'); }]) {
    const damaged = structuredClone(natal); alter(damaged);
    assert.equal(quanshuAnnualContext(damaged, 2030, '庚').ready, false);
  }
});

test('real ephemeris-free source frame reaches only the Geng annual interval and the exact fixed-edition example in SQLite', () => {
  const run = realRun(); validateFortuneFacts(run);
  assert.notEqual(run.methods.ziwei.status, 'failed');
  const contexts = run.facts.filter(f => f.factType === 'quanshu_annual_context');
  assert.equal(contexts.length, 2); assert.ok(contexts.every(f => f.completeness === 'complete'));
  const matched = result(run); assert.equal(matched.status, 'matched');
  const geng = contexts.find(f => f.normalizedPayload.annualStem === '庚');
  assert.deepEqual(matched.windows, [{ start: geng.activeFrom, endExclusive: geng.activeTo }]);
  assert.ok(geng.activeFrom > '2030-01-01T00:00:00.000Z');
  const otherPalace = calculate(chart(native('1990-05-05', 6)));
  assert.equal(result(otherPalace).status, 'not_matched');
  const otherYear = calculate(chart(), 'year', { year: 2031 });
  assert.ok(result(otherYear).windows.every(window => window.endExclusive < '2031-03-01T00:00:00.000Z'));
  for (const key of ['lifeBranch', 'migrationBranch', 'qingyangBranch', 'annualQingyangBranch', 'annualTuoluoBranch']) {
    const changed = structuredClone(run);
    changed.facts.filter(f => f.factType === 'quanshu_annual_context').forEach(f => { f.normalizedPayload[key] = '子'; });
    assert.equal(result(changed).status, 'not_matched', key);
  }
  const generic = structuredClone(run); generic.facts = generic.facts.filter(f => f.factType !== 'quanshu_annual_context');
  assert.equal(result(generic).status, 'unknown');
});

test('both annual malefics must cast off-palace contacts to the same life palace with native Seven Killings in its life trine', () => {
  const snapshot = chart(native('1990-05-05', 3));
  const run = calculate(snapshot, 'year', { year: 2021 });
  validateFortuneFacts(run);
  const matched = result(run, killerIndex), fact = killerFact(run, 2021);
  const boundary = '2021-02-11T16:00:00.000Z';
  assert.equal(fact.activeFrom, boundary);
  assert.equal(matched.status, 'partial');
  assert.deepEqual(matched.sourceFactIds, [fact.factId]);
  assert.deepEqual(matched.windows, [{ start: boundary, endExclusive: '2021-12-31T16:00:00.000Z' }]);
  assert.deepEqual(fact.normalizedPayload.annualYangTuo.map(({ star, branch, lifeRelation }) => [star, branch, lifeRelation]),
    [['擎羊', '戌', '三合'], ['陀罗', '申', '冲']]);
  assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  const { killerSourceSeatVerified, ...oldPayload } = fact.normalizedPayload;
  assert.equal(killerSourceSeatVerified, true);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: oldPayload }] }, killerIndex).status, 'unknown');

  const followingYear = calculate(snapshot, 'year', { year: 2022 }), single = killerFact(followingYear, 2022);
  assert.deepEqual(single.normalizedPayload.annualYangTuo.map(row => row.lifeRelation), ['其他', '三合']);
  assert.deepEqual(result(followingYear, killerIndex).windows,
    [{ start: '2021-12-31T16:00:00.000Z', endExclusive: '2022-01-31T16:00:00.000Z' }]);
  assert.equal(single.normalizedPayload.jointAnnualContact, false);

  const seated = calculate(snapshot, 'year', { year: 2025 });
  assert.deepEqual(killerFact(seated, 2025).normalizedPayload.annualYangTuo.map(row => row.lifeRelation), ['其他', '守']);
  assert.equal(result(seated, killerIndex).status, 'not_matched');
  const opposed = calculate(chart(native('1990-06-10', 6)), 'year', { year: 2026 });
  assert.equal(killerFact(opposed, 2026).normalizedPayload.killerLifeRelation, '冲');
  assert.equal(killerFact(opposed, 2026).normalizedPayload.jointAnnualContact, true);
  assert.equal(result(opposed, killerIndex).status, 'not_matched');

  const generic = structuredClone(run);
  generic.facts = generic.facts.filter(f => f.factType !== 'quanshu_killer_echo');
  assert.equal(result(generic, killerIndex).status, 'unknown');
});

test('source grades, named relief stars and taboo candidates keep their own positions and do not borrow an engine fall grade', () => {
  const natal = native('1990-01-05', 0);
  const annual = quanshuAnnualContext(natal, 2020, '庚');
  const qisha = natal.palaces.flatMap(p => p.majorStars).find(star => star.name === '七杀');
  qisha.brightness = '陷';
  const echo = quanshuKillerEcho(natal, annual, '子');
  assert.equal(echo.ready, true);
  assert.equal(echo.killerLifeRelation, '三合');
  assert.equal(echo.killerGrade, '平');
  assert.equal(echo.annualQingyangInMaoYou, true);
  assert.equal(echo.birthYearBranch, '巳');
  assert.equal(echo.birthHour, '子');
  assert.deepEqual(echo.rescuePositions.map(row => [row.star, row.branch, row.lifeRelation, row.killerRelation]),
    [['紫微', '巳', '三合', '守'], ['天相', '卯', '其他', '其他'], ['禄存', '午', '其他', '其他'], ['禄存', '申', '其他', '其他']]);
  assert.ok(echo.auxiliaryPositions.some(row => row.star === '文昌'));
  assert.equal(echo.jointAnnualContact, true);

  const another = native('1990-05-05', 11);
  const annualWithTaboo = quanshuAnnualContext(another, 2022, '壬');
  const withTaboo = quanshuKillerEcho(another, annualWithTaboo, '寅');
  assert.equal(withTaboo.killerGrade, '旺');
  assert.deepEqual(withTaboo.tabooPositions.map(row => [row.layer, row.star, row.branch, row.atAnnualQingyang]),
    [['natal', '天同', '亥', false], ['annual_candidate', '武曲', '子', true]]);
  assert.equal(withTaboo.annualYangTuo[0].grade, '陷');
  assert.equal(quanshuKillerEcho(another, annualWithTaboo, '丑').ready, false);
});

test('p087 uses actual Tai Sui and both limits around a guarded Qisha palace independently of the Life-palace route', () => {
  const snapshot = chart(native('1989-02-15', 2));
  const year = 2032, asOf = Date.parse('2032-11-19T00:00:00Z');
  const parameters = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const reference = { snapshotId: 'qisha-verse-archive', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'qisha-verse-client', reference);
  const fact = killerFact(run, year), p = fact.normalizedPayload;
  assert.deepEqual([p.lifeBranch, p.killerBranch, p.killerLifeRelation], ['子', '辰', '三合']);
  assert.deepEqual(p.verseSeats.map(row => [row.scope, row.branch, row.killerRelation]),
    [['yearly', '子', '三合'], ['decadal', '辰', '守'], ['minor', '子', '三合']]);
  assert.deepEqual(p.annualYangTuo.map(row => [row.branch, row.killerRelation]), [['子', '三合'], ['戌', '冲']]);
  assert.equal(p.jointAnnualContact, false);
  assert.equal(p.actualLimitEchoCandidate, true);
  const isolated = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const match = result(isolated, killerIndex);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const local = calculate(snapshot, 'year', { year }), localFact = killerFact(local, year);
  const raw = local.rawFacts.find(row => localFact.sourceFactIds.includes(row.rawFactId) && row.payload.policy?.verse);
  assert.ok(raw);
  assert.deepEqual([fact.activeFrom, fact.activeTo], [localFact.activeFrom, localFact.activeTo]);
  for (const layer of ['year', 'decadal', 'minor']) {
    assert.ok(raw.payload.interval[layer].start <= Date.parse(fact.activeFrom));
    assert.ok(Date.parse(fact.activeTo) <= raw.payload.interval[layer].end);
  }
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'qisha-verse'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大限在辰宫，与七杀所在宫为守/u);
  assert.match(prompt, /小限在子宫，与七杀所在宫为三合/u);
  assert.doesNotMatch(prompt, /actualLimitEchoCandidate|verseSeats/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));

  const near = calculate(snapshot, 'year', { year: 2052 }), nearFact = killerFact(near, 2052);
  assert.deepEqual(nearFact.normalizedPayload.verseSeats.map(row => row.killerRelation), ['三合', '其他', '守']);
  assert.equal(nearFact.normalizedPayload.actualLimitEchoCandidate, false);
  const nearSlice = { ...near, facts: near.facts.filter(row => row.factType !== nearFact.factType || row.factId === nearFact.factId) };
  assert.equal(result(nearSlice, killerIndex).status, 'not_matched');
  const natal = snapshot.ziwei.rawResult[0], decadalIndex = natal.palaces.find(row => row.earthlyBranch === '辰').index;
  const annual = quanshuAnnualContext(natal, year, '壬');
  const oneLimit = quanshuKillerEcho(natal, annual, '子', { decadalIndex });
  assert.equal(oneLimit.actualLimitEchoCandidate, undefined);
  const wrongMinor = natal.palaces.find(row => row.earthlyBranch === '申').index;
  const displaced = quanshuKillerEcho(natal, annual, '子', { decadalIndex, minorIndex: wrongMinor });
  assert.deepEqual([displaced.sourceMinor.branch, displaced.sourceMinor.verified], ['子', false]);
  assert.deepEqual(displaced.verseSeats[2], { scope: 'minor', branch: undefined, killerRelation: undefined });
  assert.equal(displaced.actualLimitEchoCandidate, undefined);
  assert.equal(result({ ...isolated, facts: [{ ...fact, normalizedPayload: displaced }] }, killerIndex).status, 'unknown');
});

test('p087 binds the Jielan Jia-Gui blade overlap to exact directional Qisha and a guarded limit', () => {
  const astrolabe = astro.withOptions({ dateStr: '1954-02-05', timeIndex: 5, gender: '男', fixLeap: true, config });
  const natal = astrolabe.toJSON();
  for (const year of [1983, 1982, 1984]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), reference = { snapshotId: 'jielan-jia-gui', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const fact = killerFact(run, year), data = fact.normalizedPayload;
    const isolated = { ...run, facts: [{ ...fact, normalizedPayload: { ...data,
      jointAnnualContact: false, actualLimitEchoCandidate: false } }] };
    const match = result(isolated, killerIndex);
    assert.equal(data.jielanJiaGuiKillerEchoCandidate, year === 1983, year);
    assert.equal(match.status, year === 1983 ? 'partial' : 'not_matched', year);
    if (year !== 1983) continue;
    assert.deepEqual([data.jointAnnualContact, data.actualLimitEchoCandidate], [false, false]);
    assert.deepEqual(data.jielanJiaGuiKillerEchoWitness, { birthStem: '甲', annualStem: '癸', lifeBranch: '酉',
      killerBranch: '酉', sharedShaBranch: '丑', shaLifeRelation: '三合', flowQishaBranches: ['申', '酉', '戌'],
      guards: [{ scope: 'minor', branch: '酉' }] });
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrong = { ...isolated.facts[0], normalizedPayload: { ...isolated.facts[0].normalizedPayload,
      jielanFlowShaProfile: 'wrong-annual-direction-table' } };
    assert.equal(result({ ...isolated, facts: [wrong] }, killerIndex).status, 'not_matched');
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'jielan-blades'));
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
    assert.match(formatFortuneFactAudit(input), /《捷览》甲生癸岁例.*同在丑宫.*小限守酉宫/u);
    assert.doesNotMatch(formatFortunePrompt(input), /甲生癸岁例|jielanJiaGuiKillerEchoWitness/u);
  }
  const decadalIndex = astrolabe.horoscope('1983-06-01').decadal.index;
  const missingMinor = quanshuKillerEcho(natal, quanshuAnnualContext(natal, 1983, '癸'), '亥', { decadalIndex });
  assert.equal(missingMinor.jielanJiaGuiKillerEchoCandidate, undefined);
});

test('missing, duplicated and unknown-time killer positions stay unknown while missing auxiliaries leave geometry available', () => {
  for (const alter of [n => { n.palaces.forEach(p => { p.majorStars = p.majorStars.filter(star => star.name !== '七杀'); }); },
    n => { n.palaces[0].majorStars.push({ name: '七杀' }); }, n => {
      const original = n.palaces.find(row => row.majorStars.some(star => star.name === '七杀'));
      n.palaces.find(row => row.index === (original.index + 4) % 12).majorStars.push(original.majorStars.find(star => star.name === '七杀'));
      original.majorStars = original.majorStars.filter(star => star.name !== '七杀');
    }]) {
    const natal = native('1990-05-05', 3); alter(natal);
    const run = calculate(chart(natal), 'year', { year: 2021 });
    assert.equal(result(run, killerIndex).status, 'unknown');
    assert.ok(killerFacts(run).every(f => f.completeness === 'partial'));
  }
  const unknownTime = chart(native('1990-05-05', 3)); unknownTime.timeKnown = false;
  assert.equal(result(calculate(unknownTime, 'year', { year: 2021 }), killerIndex).status, 'unknown');

  const natal = native('1990-05-05', 3);
  natal.palaces.forEach(p => { p.minorStars = p.minorStars.filter(star => star.name !== '文昌'); });
  const echo = quanshuKillerEcho(natal, quanshuAnnualContext(natal, 2021, '辛'), '丑');
  assert.equal(echo.ready, true);
  assert.equal(echo.auxiliaryPositions, undefined);
  assert.equal(echo.tabooPositions.find(row => row.layer === 'annual_candidate').branch, undefined);
});

test('unknown-time, multiple, incompatible and variant-position archives never admit the complete source example', () => {
  for (const alter of [c => { c.timeKnown = false; }, c => { c.ziwei.rawResult.push(structuredClone(c.ziwei.rawResult[0])); },
    c => { c.ziwei.engineVersion = 'other'; }, c => { c.ziwei.rawResult[0].rawDates.lunarDate.isLeap = true; }]) {
    const snapshot = chart(); alter(snapshot);
    assert.notEqual(result(calculate(snapshot)).status, 'matched');
  }
  const swapped = chart(), palaces = swapped.ziwei.rawResult[0].palaces;
  for (const palace of palaces) for (const star of palace.minorStars) {
    if (star.name === '擎羊') star.name = '陀罗'; else if (star.name === '陀罗') star.name = '擎羊';
  }
  const run = calculate(swapped);
  assert.equal(result(run).status, 'unknown');
  assert.ok(run.facts.filter(f => f.factType === 'quanshu_annual_context').every(f => f.completeness === 'partial'));
});

test('the projected annual prompt describes the bound contact and relief witnesses while the source stays partial', () => {
  const run = calculate(chart(native('1990-05-05', 3)), 'year', { year: 2021 });
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'killer-echo-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命七杀在寅宫，与命宫的关系为守，同书星表列为庙/u);
  assert.match(prompt, /两颗流曜同时照命，一颗对冲、一颗三合/u);
  assert.match(prompt, /本命紫微在申宫/u);
  assert.match(prompt, /同书星表未列七杀的陷位/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === fortuneKnowledge.ziwei.rules[killerIndex].knowledgeId));
  for (const machine of ['quanshu_killer_echo', 'jointAnnualContact', 'rescuePositions', 'killer-echo-prompt']) assert.ok(!prompt.includes(machine));
});

test('full native limit endpoints cross Lunar New Year and remain independent of a clipped annual query edge', () => {
  const run = calculate(chart(), 'year', { year: 2024 });
  const phases = run.facts.filter(f => f.factType === 'quanshu_limit_phase');
  assert.equal(phases.length, 2); assert.ok(phases.every(f => f.completeness === 'complete'));
  assert.equal(phases[0].normalizedPayload.stageEnd, '2024-02-09T16:00:00.000Z');
  assert.equal(phases[1].normalizedPayload.stageStart, '2024-02-09T16:00:00.000Z');
  assert.ok(phases[1].normalizedPayload.stageEnd > run.time.displayWindow.instantRange.endInstantExclusive);
  const old = chapterFacts(run).find(f => f.normalizedPayload.exitInWindow);
  assert.equal(old.activeTo, phases[0].normalizedPayload.stageEnd);
  assert.equal(old.normalizedPayload.decadalMultipleSupportAtSeat, false);
  assert.equal(result(run, chapterIndex('003')).status, 'not_matched');
  assert.equal(chapterFacts(run).find(f => f.activeFrom === phases[1].normalizedPayload.stageStart).normalizedPayload.exitInWindow, false);
  assert.equal(result(realRun(), chapterIndex('003')).status, 'not_matched');
  const natal = native(); const noAge = quanshuLimitPhase(natal, 0, 90, Date.parse('2024-06-01T00:00:00Z'));
  assert.equal(noAge.ready, false);
});

test('p081-003 requires named support stars guarding the old limit before the verified exit', () => {
  for (const [hour, year, branch, guards] of [
    [1, 2033, '丑', ['天府']], [2, 2034, '子', []], [5, 2035, '酉', ['天同', '文曲']],
  ]) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(2026, 10, 18, 3);
    const reference = { snapshotId: 'quanshu-limit-exit-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, {
      ...reference, chart: chart(native('1990-05-05', hour)),
    })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'quanshu-limit-exit', reference);
    validateFortuneFacts(run);
    const [old, next] = chapterFacts(run);
    const p = old.normalizedPayload;
    assert.equal(p.exitInWindow, true);
    assert.equal(p.decadal.branch, branch);
    assert.equal(old.activeTo, p.stageEnd);
    assert.equal(next.activeFrom, p.stageEnd);
    assert.equal(next.normalizedPayload.exitInWindow, false);
    assert.ok(p.decadal.namedSupport.length >= 2);
    assert.deepEqual(p.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star), guards);
    const qualifies = guards.length >= 2;
    assert.equal(p.decadalMultipleSupportAtSeat, qualifies);
    const hit = result(run, chapterIndex('003'));
    assert.equal(hit.status, qualifies ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, qualifies ? [old.factId] : []);
    assert.deepEqual(hit.windows, qualifies ? [{ start: old.activeFrom, endExclusive: old.activeTo }] : []);
    const natal = native('1990-05-05', hour), index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
    const frame = { at: Date.parse(old.activeFrom), windowEnd: Date.parse(run.time.displayWindow.instantRange.endInstantExclusive),
      lunarYear: p.lunarYear, age: p.lunarYear - natal.rawDates.lunarDate.lunarYear + 1, yearIndex: index(p.yearly.branch),
      decadalIndex: index(p.decadal.branch), minorIndex: index(p.minor.branch) };
    if (year === 2033) {
      const distantHelper = ['文昌', '文曲', '左辅', '右弼'].find(star => natal.palaces.some(row =>
        row.earthlyBranch !== branch && row.minorStars.some(auxiliary => auxiliary.name === star)));
      assert.ok(distantHelper);
      const remote = quanshuLimitChapter(archiveMinorInWrongLayer(natal, distantHelper), frame);
      assert.ok(remote.unverifiedAuxiliaryStars.includes(distantHelper));
      assert.equal(remote.decadalMultipleSupportAtSeat, false);
      assert.equal(result({ ...run, facts: [{ ...old, normalizedPayload: remote }] }, chapterIndex('003')).status, 'not_matched');
    }
    if (qualifies) {
      const wrongLayer = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '文曲'), frame);
      assert.deepEqual(wrongLayer.unverifiedAuxiliaryStars, ['文曲']);
      assert.deepEqual(wrongLayer.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star), ['天同']);
      assert.equal(wrongLayer.decadalMultipleSupportAtSeat, undefined);
      assert.equal(result({ ...run, facts: [{ ...old, normalizedPayload: wrongLayer }] }, chapterIndex('003')).status, 'unknown');
      const { natalBladePlacementProof, ...unverifiedLayerProof } = p;
      assert.equal(natalBladePlacementProof, 'quanshu-natal-yang-tuo-and-lucun-auxiliary-layer-v1');
      assert.equal(result({ ...run, facts: [{ ...old, normalizedPayload: unverifiedLayerProof }] }, chapterIndex('003')).status, 'unknown');
      const legacy = { ...run, facts: run.facts.map(fact => fact.factId === old.factId ? { ...fact,
        normalizedPayload: { ...p, decadalMultipleSupportAtSeat: undefined, decadalSupportKnown: true },
      } : fact) };
      assert.equal(result(legacy, chapterIndex('003')).status, 'unknown');
      const previous = calculate(chart(native('1990-05-05', hour)), 'year', { year: year - 1 });
      assert.ok(chapterFacts(previous).some(fact => fact.normalizedPayload.decadalMultipleSupportAtSeat === true));
      assert.equal(result(previous, chapterIndex('003')).status, 'not_matched');
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-exit-prompt'));
      assert.match(formatFortuneFactAudit(input), /旧大限酉宫实守的已核助曜有天同、文曲/u);
    }
  }
});

test('p081 confirms four named supports in the final second before the actual limit exit', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2074 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(2074, 5, 1), reference = { snapshotId: 'quanshu-named-exit', chart: chart(native('1990-05-05', 2)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const [normal, exact, next] = chapterFacts(run);
  const endExclusive = '2074-01-26T16:00:00.000Z', start = '2074-01-26T15:59:59.000Z';
  assert.deepEqual([normal.activeTo, exact.activeFrom, exact.activeTo, next.activeFrom], [endExclusive, start, endExclusive, endExclusive]);
  assert.deepEqual(exact.normalizedPayload.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star),
    ['紫微', '天府', '文昌', '禄存']);
  const hit = result(run, chapterIndex('003'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大限将出，有吉众者');
  assert.deepEqual(hit.sourceFactIds, [exact.factId]);
  assert.deepEqual(hit.windows, [{ start, endExclusive }]);
  assert.deepEqual(hit.candidateWindows, [{ start: normal.activeFrom, endExclusive: start }]);
  const before = calculate(reference.chart, 'year', { year: 2073 });
  assert.equal(result(before, chapterIndex('003')).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.match(formatFortunePrompt(input), /旧大限交接前最后一秒/u);
  assert.doesNotMatch(formatFortunePrompt(input), /exitVerifiedNamedSupportAtBoundary|无灾悔/u);
});

test('p081 confirms the same four Ming assistants only at the real old limit exit', () => {
  const natal = native('1980-11-09', 9), year = 2004;
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-four-assistants-exit', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const [old, exact, next] = chapterFacts(run);
  const endExclusive = '2004-01-21T16:00:00.000Z', start = '2004-01-21T15:59:59.000Z';
  assert.deepEqual([old.activeTo, exact.activeFrom, exact.activeTo, next.activeFrom], [endExclusive, start, endExclusive, endExclusive]);
  assert.deepEqual([old.normalizedPayload.decadal.branch, next.normalizedPayload.decadal.branch], ['丑', '子']);
  assert.equal(old.normalizedPayload.exitMingFourHelpersCandidate, true);
  assert.equal(old.normalizedPayload.exitVerifiedMingFourHelpersAtBoundary, undefined);
  assert.equal(exact.normalizedPayload.exitVerifiedMingFourHelpersAtBoundary, true);
  assert.deepEqual([exact.normalizedPayload.exitVerifiedNamedSupportAtBoundary, exact.normalizedPayload.exitVerifiedFewNamedSupportsAtBoundary],
    [undefined, undefined]);
  assert.deepEqual(exact.normalizedPayload.cleanSeatMingFourHelpersWitness.helpers.map(row => [row.star, row.branch]),
    ['文昌', '文曲', '左辅', '右弼'].map(star => [star, '丑']));
  const hit = result(run, chapterIndex('003'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大限将出，有吉众者');
  assert.deepEqual(hit.sourceFactIds, [exact.factId]);
  assert.deepEqual(hit.windows, [{ start, endExclusive }]);
  assert.deepEqual(hit.candidateWindows, [{ start: old.activeFrom, endExclusive: start }]);

  const anchors = verifiedChapterFrame(natal, old, run.time.window.end);
  const wrongLayer = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '左辅'), anchors);
  assert.equal(wrongLayer.cleanSeatMingFourHelpersCandidate, undefined);
  assert.equal(wrongLayer.exitMingFourHelpersCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...old, normalizedPayload: wrongLayer }] }, chapterIndex('003')).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /左辅、右弼|左右昌曲/u);
  assert.match(prompt, /最后一秒/u);
  assert.doesNotMatch(prompt, /丑宫|exitVerifiedMingFourHelpersAtBoundary|无灾悔/u);
});

test('p081 records the named Boshi limit encounter and the distinct fallen limit at its actual exit', () => {
  const annualNatal = native('1980-10-22', 9);
  const annualRun = calculate(chart(annualNatal), 'year', { year: 2048 });
  const annualFact = chapterFacts(annualRun).find(row => row.normalizedPayload.lunarYear === 2048);
  const annual = annualFact.normalizedPayload;
  const previousRoutes = ['overlappingShaCandidate', 'overlappingAnnualSeatShaCandidate', 'overlappingAnnualShangShiCandidate',
    'overlappingAnnualFlyingShaCandidate', 'overlappingMingFixedShaCandidate'];
  assert.deepEqual(previousRoutes.map(key => annual[key]), previousRoutes.map(() => false));
  assert.deepEqual([annual.yearly.branch, annual.decadal.branch, annual.minor.branch], ['辰', '未', '寅']);
  assert.deepEqual(annual.decadal.grades, [{ star: '天机', grade: '陷' }]);
  assert.equal(annual.decadal.localSourceSha, true);
  assert.equal(annual.minor.nativeShaAtSeat, true);
  assert.equal(annual.overlappingAnnualBoshiCandidate, true);
  assert.deepEqual(annual.annualBoshiGuards, [{ star: '将军', branch: '辰' }]);
  const annualOnly = { ...annualRun, facts: [annualFact] };
  const annualMatch = result(annualOnly, chapterIndex('002'));
  assert.equal(annualMatch.status, 'partial');
  assert.deepEqual(annualMatch.windows, [{ start: '2048-02-13T16:00:00.000Z', endExclusive: annualFact.activeTo }]);
  const nearby = calculate(chart(annualNatal), 'year', { year: 2049 });
  const nextYear = chapterFacts(nearby).find(row => row.normalizedPayload.lunarYear === 2049).normalizedPayload;
  assert.equal(nextYear.overlappingAnnualBoshiCandidate, false);
  assert.deepEqual(nextYear.annualBoshiGuards, []);
  const annualAnchors = annualRun.rawFacts.find(row => annualFact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
  const inaccurateBoshi = structuredClone(annualNatal);
  const general = inaccurateBoshi.palaces.find(row => row.boshi12 === '将军');
  const impostor = inaccurateBoshi.palaces.find(row => row.earthlyBranch === '午');
  [general.boshi12, impostor.boshi12] = [impostor.boshi12, general.boshi12];
  const displacedBoshi = quanshuLimitChapter(inaccurateBoshi, annualAnchors);
  assert.deepEqual(displacedBoshi.annualBoshiGuards, []);
  assert.equal(displacedBoshi.overlappingAnnualBoshiCandidate, undefined);
  assert.equal(result({ ...annualRun, facts: [{ ...annualFact, normalizedPayload: displacedBoshi }] }, chapterIndex('002')).status, 'unknown');
  const annualPrompt = buildFortuneModelContext(annualOnly, interpretFortune(annualOnly, requestForFortuneRun(annualOnly), 'boshi-at-tai-sui')).input;
  assert.match(formatFortuneFactAudit(annualPrompt), /太岁[^\n]*博士[^\n]*将军/u);
  assert.doesNotMatch(formatFortunePrompt(annualPrompt), /博士将军|annualBoshiGuards/u);
  const secondAnnualRun = calculate(chart(native('1986-05-05', 7)), 'year', { year: 2044 });
  const secondAnnualFact = chapterFacts(secondAnnualRun).find(row => row.normalizedPayload.lunarYear === 2044);
  assert.deepEqual(previousRoutes.map(key => secondAnnualFact.normalizedPayload[key]), previousRoutes.map(() => false));
  assert.deepEqual(secondAnnualFact.normalizedPayload.annualBoshiGuards, [{ star: '奏书', branch: '子' }]);
  assert.equal(result({ ...secondAnnualRun, facts: [secondAnnualFact] }, chapterIndex('002')).status, 'partial');

  const exitNatal = native('1980-03-11', 6);
  const exitRun = calculate(chart(exitNatal), 'year', { year: 2021 });
  const [old, exact, next] = chapterFacts(exitRun);
  const exit = old.normalizedPayload;
  assert.equal(exit.exitInWindow, true);
  assert.equal(exit.decadalMultipleSupportAtSeat, false);
  assert.equal(exit.exitFallenWithoutNamedGuardCandidate, true);
  assert.deepEqual(exit.exitFallenWithoutNamedGuardWitness, { branch: '巳', stageEnd: '2021-02-11T16:00:00.000Z',
    fallen: [{ star: '廉贞', grade: '陷' }, { star: '贪狼', grade: '陷' }],
    sha: [{ star: '天空', branch: '巳', relation: '守' }, { star: '地劫', branch: '巳', relation: '守' }],
    supportAspects: [{ star: '紫微', branch: '丑', relation: '三合' }],
  });
  assert.equal(old.activeTo, next.activeFrom);
  assert.equal(next.normalizedPayload.exitFallenWithoutNamedGuardCandidate, false);
  assert.equal(exit.exitMingFewNamedSupportsCandidate, true);
  assert.equal(old.normalizedPayload.exitVerifiedFewNamedSupportsAtBoundary, undefined);
  assert.equal(exact.normalizedPayload.exitVerifiedFewNamedSupportsAtBoundary, true);
  assert.equal(exact.normalizedPayload.exitVerifiedNamedSupportAtBoundary, undefined);
  assert.deepEqual([exact.activeFrom, exact.activeTo], ['2021-02-11T15:59:59.000Z', '2021-02-11T16:00:00.000Z']);
  const boundaryMatch = result(exitRun, chapterIndex('003'));
  assert.equal(boundaryMatch.status, 'matched');
  assert.equal(boundaryMatch.matchedSourceExcerpt, '少者灾多');
  assert.deepEqual(boundaryMatch.sourceFactIds, [exact.factId]);
  assert.deepEqual(boundaryMatch.windows, [{ start: exact.activeFrom, endExclusive: exact.activeTo }]);
  assert.deepEqual(boundaryMatch.candidateWindows, [{ start: old.activeFrom, endExclusive: exact.activeFrom }]);
  assert.equal(result({ ...exitRun, facts: [next] }, chapterIndex('003')).status, 'not_matched');
  const verified = buildFortuneModelContext(exitRun, interpretFortune(exitRun, requestForFortuneRun(exitRun), 'fallen-boundary')).input;
  assert.match(formatFortunePrompt(verified), /少者灾多/u);
  assert.doesNotMatch(formatFortunePrompt(verified), /巳宫|exitVerifiedFewNamedSupportsAtBoundary/u);
  const exitOnly = { ...exitRun, facts: [old] };
  const exitMatch = result(exitOnly, chapterIndex('003'));
  assert.equal(exitMatch.status, 'partial');
  assert.deepEqual(exitMatch.windows, [{ start: '2020-12-31T16:00:00.000Z', endExclusive: '2021-02-11T16:00:00.000Z' }]);
  const previous = calculate(chart(exitNatal), 'year', { year: 2020 });
  assert.equal(result(previous, chapterIndex('003')).status, 'not_matched');
  const exitAnchors = exitRun.rawFacts.find(row => old.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
  for (const [wrong, remaining] of [['地空', '地劫'], ['地劫', '天空']]) {
    const retainedVoid = quanshuLimitChapter(archiveMinorInWrongLayer(exitNatal, wrong), exitAnchors);
    assert.equal(retainedVoid.exitFallenWithoutNamedGuardCandidate, true);
    assert.deepEqual(retainedVoid.exitFallenWithoutNamedGuardWitness.sha.map(row => row.star), [remaining]);
    assert.ok(retainedVoid.flankWitnesses.every(row => row.group !== '空劫'));
    assert.equal(result({ ...exitRun, facts: [{ ...old, normalizedPayload: retainedVoid }] }, chapterIndex('003')).status, 'partial');
  }
  const missingGuardRecord = structuredClone(exitNatal);
  const remote = missingGuardRecord.palaces.find(row => row.minorStars.some(star => star.name === '左辅'));
  const [helper] = remote.minorStars.splice(remote.minorStars.findIndex(star => star.name === '左辅'), 1);
  assert.ok(!['巳', '酉', '丑', '亥'].includes(remote.earthlyBranch));
  const withoutRemote = quanshuLimitChapter(missingGuardRecord, exitAnchors);
  assert.equal(withoutRemote.exitMingFewNamedSupportsCandidate, true);
  missingGuardRecord.palaces.find(row => row.earthlyBranch === '巳').minorStars.push(helper);
  const unknownExit = quanshuLimitChapter(missingGuardRecord, exitAnchors);
  assert.equal(unknownExit.exitFallenWithoutNamedGuardCandidate, undefined);
  assert.equal(unknownExit.exitMingFewNamedSupportsCandidate, undefined);
  assert.equal(unknownExit.exitFallenWithoutNamedGuardWitness, undefined);
  assert.equal(result({ ...exitRun, facts: [{ ...old, normalizedPayload: unknownExit }] }, chapterIndex('003')).status, 'unknown');
  const wrongLuLayer = quanshuLimitChapter(archiveMinorInWrongLayer(exitNatal, '禄存'), exitAnchors);
  assert.equal(wrongLuLayer.exitInWindow, true);
  assert.equal(wrongLuLayer.exitFallenWithoutNamedGuardCandidate, true);
  assert.equal(wrongLuLayer.exitMingFewNamedSupportsCandidate, true);
  assert.equal(result({ ...exitRun, facts: [{ ...old, normalizedPayload: wrongLuLayer }] }, chapterIndex('003')).status, 'partial');
  const exitPrompt = buildFortuneModelContext(exitOnly, interpretFortune(exitOnly, requestForFortuneRun(exitOnly), 'fallen-limit-exit')).input;
  assert.match(formatFortuneFactAudit(exitPrompt), /廉贞[^\n]*贪狼[^\n]*天空[^\n]*地劫/u);
  assert.match(formatFortuneFactAudit(exitPrompt), /紫微[^\n]*三合/u);
  assert.doesNotMatch(formatFortunePrompt(exitPrompt), /廉贞[^\n]*贪狼[^\n]*天空[^\n]*地劫|exitFallenWithoutNamedGuardWitness/u);
});

test('p081 confirms annual blades only when they actually guard the risk-bearing decade of the verified minor limit year', () => {
  const selector = 'overlappingMingAnnualBladeAtDecadalCandidate';
  for (const [birth, hour, year, decade, minor, blade] of [
    ['1980-03-11', 6, 2017, '巳', '酉', '流年陀罗'],
    ['1988-05-15', 8, 2018, '午', '辰', '流年擎羊'],
  ]) {
    const natal = native(birth, hour), params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'limit-chapter-annual-blade-' + year, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const active = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === year), data = active.normalizedPayload;
    assert.deepEqual([data.decadal.branch, data.minor.branch], [decade, minor]);
    assert.deepEqual(data.decadal.annualSha.filter(row => row.relation === '守'), [{ star: blade, branch: decade, relation: '守' }]);
    assert.equal(data.decadal.nativeShaAtSeat, true);
    assert.equal(data.minor.nativeShaAtSeat, true);
    assert.equal(data[selector], true);
    assert.ok(['overlappingMingNamedShaCandidate', 'overlappingMingAnnualFireCandidate', 'overlappingMingNatalTabooAndMinorBellCandidate',
      'overlappingMingFlyingShaCandidate', 'overlappingMingNatalTabooWithAnnualShangShiCandidate'].every(key => data[key] !== true));
    const scoped = { ...run, facts: [active] }, match = result(scoped, chapterIndex('002'));
    assert.equal(match.status, 'matched');
    assert.equal(match.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
    assert.deepEqual(match.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
    const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
    const anchors = { lunarYear: year, age: year - natal.rawDates.lunarDate.lunarYear + 1, at: Date.parse(active.activeFrom),
      windowEnd: Date.parse(active.activeTo), yearIndex: index(data.yearly.branch), decadalIndex: index(decade), minorIndex: index(minor) };
    const falseMinor = quanshuLimitChapter(natal, { ...anchors, minorIndex: (anchors.minorIndex + 1) % 12 });
    assert.equal(falseMinor[selector], undefined);
    assert.notEqual(result({ ...run, facts: [{ ...active, normalizedPayload: falseMinor }] }, chapterIndex('002')).status, 'matched');
    if (blade === '流年陀罗') {
      const later = astro.withOptions({ dateStr: birth, timeIndex: hour, gender: '女', fixLeap: true, config }).horoscope('2018-06-01', 6);
      const nearby = quanshuLimitChapter(natal, { ...anchors, lunarYear: year + 1, age: anchors.age + 1,
        at: Date.UTC(year + 1, 5, 1), windowEnd: Date.UTC(year + 1, 11, 31),
        yearIndex: later.yearly.index, decadalIndex: later.decadal.index, minorIndex: later.age.index });
      assert.ok(nearby.decadal.annualSha.every(row => row.relation !== '守'));
      assert.equal(nearby[selector], false);
    }
    const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), archive.snapshotId)).input;
    assert.match(formatFortunePrompt(input), /流年擎羊或陀罗/u);
    assert.doesNotMatch(formatFortunePrompt(input), new RegExp('流年[擎羊陀罗]+.{0,4}' + decade + '宫|' + selector, 'u'));
  }
});

test('the limit chapter clean and overlapping annual paths require named stars in the same source slice', () => {
  const clean = calculate(chart(native('1990-05-05', 6)), 'year', { year: 2024 });
  const cleanResult = result(clean, chapterIndex('001'));
  assert.equal(cleanResult.status, 'partial');
  const cleanFact = chapterFacts(clean).find(f => cleanResult.sourceFactIds.includes(f.factId));
  assert.deepEqual(cleanFact.normalizedPayload.decadal.grades, [{ star: '紫微', grade: '旺' }, { star: '天府', grade: '地' }]);
  assert.equal(cleanFact.normalizedPayload.decadal.localSourceSha, false);
  assert.ok(cleanFact.normalizedPayload.decadal.archiveFireBell.every(row => row.relation !== '守'));
  const { starPlacementProof, ...olderClean } = cleanFact.normalizedPayload;
  assert.equal(starPlacementProof, 'quanshu-nanyangtang-limit-chapter-star-layers-v1');
  assert.equal(result({ ...clean, facts: [{ ...cleanFact, normalizedPayload: olderClean }] }, chapterIndex('001')).status, 'unknown');

  const natal = native('1980-03-11', 2), run = calculate(chart(natal), 'year', { year: 2025 });
  validateFortuneFacts(run);
  const hit = result(run, chapterIndex('002'));
  assert.equal(hit.status, 'partial');
  const fact = chapterFacts(run).find(f => hit.sourceFactIds.includes(f.factId) && f.normalizedPayload.lunarYear === 2025);
  const p = fact.normalizedPayload;
  assert.ok(p.decadal.grades.some(row => row.star === '天梁' && row.grade === '陷'));
  assert.equal(p.decadal.natalJi.relation, '守');
  assert.ok(p.minor.namedNativeSha.some(row => row.relation === '守'));
  assert.deepEqual(p.decadal.annualSha.map(row => [row.star, row.relation]), [['流年擎羊', '三合'], ['流年陀罗', '冲']]);
  const anchors = run.rawFacts.find(raw => fact.sourceFactIds.includes(raw.rawFactId) && raw.payload.anchors).payload.anchors;
  const retainedRobbery = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '地空'), anchors);
  assert.deepEqual([retainedRobbery.sourceSkyReady, retainedRobbery.sourceRobberyReady], [false, true]);
  assert.deepEqual(retainedRobbery.minor.namedNativeSha.filter(row => row.relation === '守'),
    [{ star: '地劫', branch: '丑', relation: '守' }]);
  assert.equal(retainedRobbery.overlappingShaCandidate, true);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: retainedRobbery }] }, chapterIndex('002')).status, 'partial');
  const missingGuard = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '地劫'), anchors);
  assert.deepEqual([missingGuard.sourceSkyReady, missingGuard.sourceRobberyReady], [true, false]);
  assert.equal(missingGuard.minor.nativeShaAtSeat, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: missingGuard }] }, chapterIndex('002')).status, 'unknown');
  assert.equal(quanshuLimitChapter(natal, { ...anchors, minorIndex: undefined }).overlappingShaCandidate, undefined);
  const basis = readQuanshuNatal(natal);
  const otherBlade = [basis.qingyangBranch, basis.tuoluoBranch].find(branch => branch !== p.minor.branch);
  const displacedIndex = natal.palaces.find(palace => palace.earthlyBranch === otherBlade).index;
  const displaced = quanshuLimitChapter(natal, { ...anchors, minorIndex: displacedIndex });
  assert.equal(displaced.sourceMinor.verified, false);
  assert.equal(displaced.minor, undefined);
  assert.equal(displaced.overlappingShaCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: displaced }] }, chapterIndex('002')).status, 'unknown');
  const duplicate = structuredClone(natal);
  duplicate.palaces[0].majorStars.push(structuredClone(duplicate.palaces.flatMap(row => row.majorStars).find(star => star.name === '天梁')));
  assert.equal(quanshuLimitChapter(duplicate, anchors).overlappingShaCandidate, undefined);
  const generic = { ...run, facts: run.facts.filter(item => item.factType !== 'quanshu_limit_chapter') };
  assert.equal(result(generic, chapterIndex('002')).status, 'unknown');
});

test('the daily source rule binds the real Doujun month and product day with upper-layer witnesses', () => {
  const natal = native();
  const run = calculate(chart(natal), 'day', { date: '2026-04-17' }), hit = result(run, chapterIndex('004'));
  validateFortuneFacts(run);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: '2026-04-16T16:00:00.000Z', endExclusive: '2026-04-17T16:00:00.000Z' }]);
  const fact = chapterFacts(run).find(f => hit.sourceFactIds.includes(f.factId)), p = fact.normalizedPayload;
  assert.equal(p.monthly.branch, '未'); assert.equal(p.daily.branch, '未');
  assert.ok(p.monthly.namedNativeSha.some(row => row.star === '陀罗' && row.relation === '守'));
  const anchors = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
  const displaced = quanshuLimitChapter(natal, { ...anchors, minorIndex: (anchors.minorIndex + 1) % 12 });
  assert.equal(displaced.sourceMinor.verified, false);
  assert.equal(displaced.minor, undefined);
  for (const field of ['dailyShaCandidate', 'dailyFlankedShaCandidate', 'dailyGuardedTabooCandidate']) {
    assert.equal(displaced[field], undefined, field);
  }
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: displaced }] }, chapterIndex('004')).status, 'unknown');
  const nearby = calculate(chart(), 'day', { date: '2026-04-18' });
  const beforeLateZi = chapterFacts(nearby).filter(row => row.activeTo <= '2026-04-18T15:00:00.000Z');
  assert.equal(result({ ...nearby, facts: beforeLateZi }, chapterIndex('004')).status, 'not_matched');
  assert.equal(result(nearby, chapterIndex('004')).status, 'unknown');
  const afterLeap = calculate(chart(), 'day', { date: '2025-09-05' });
  assert.ok(chapterFacts(afterLeap).every(f => f.normalizedPayload.monthly === undefined));
  assert.equal(result(afterLeap, chapterIndex('004')).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-limit-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /斗君月在未宫/u); assert.match(prompt, /产品流日在未宫/u);
  assert.match(prompt, /原书流日和时层取法仍待核/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === hit.knowledgeId));
  assert.ok(!/quanshu_limit_chapter|dailyShaCandidate/u.test(prompt));
});

test('p081 uses the source annual flying Sha groups for all twelve years without allocating individual star names', () => {
  for (const [years, expected] of [
    [[2022, 2026, 2030], ['亥', '卯', '未']],
    [[2028, 2020, 2024], ['巳', '酉', '丑']],
    [[2031, 2023, 2027], ['申', '子', '辰']],
    [[2025, 2029, 2021], ['寅', '午', '戌']],
  ]) {
    for (const year of years) {
      const group = quanshuAnnualFlyingShaBranches(year);
      assert.deepEqual(group, expected);
      const official = quanshuFourFlying(year);
      const guanfu = official.placements.find(row => row.name === '官府').branch;
      const excluded = [official.yearBranch, guanfu];
      for (let offset = 0; offset < 12; offset++) {
        const birthBranch = quanshuFourFlying(year - offset).yearBranch;
        for (const gender of ['男', '女']) excluded.push(quanshuMinorLimit(birthBranch, gender, offset + 1).branch);
      }
      for (const branch of excluded) assert.ok(group.every(position => quanshuPalaceRelation(branch, position) === '其他'));
    }
  }
  for (const year of [0, 10000, 2025.5]) assert.throws(() => quanshuAnnualFlyingShaBranches(year), RangeError);
});

test('p081 reads Ming fixed Fire and Bell independently in clean and overlapping limits', () => {
  const chartFor = (timeIndex, gender) => astro.withOptions({
    dateStr: '1990-05-05', timeIndex, gender, fixLeap: true, config,
  }).toJSON();
  const yearFragment = (n, year) => {
    const run = calculate(chart(n), 'year', { year });
    const fact = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    return { run: { ...run, facts: [fact] }, fact, data: fact.normalizedPayload };
  };
  const female = chartFor(1, '女'), male = chartFor(2, '男');
  for (const [n, year, accepted, branch, grade] of [
    [female, 2023, false, '丑', { star: '天府', grade: '庙' }],
    [male, 2014, true, '巳', { star: '太阳', grade: '旺' }],
  ]) {
    const { run, fact, data } = yearFragment(n, year), clean = result(run, chapterIndex('001'));
    assert.equal(data.quanshuFixedFireBellProfile, 'quanshu-nanyangtang-fixed-firebell-v1');
    assert.deepEqual([data.cleanSeatCandidate, data.cleanSeatMingFixedCandidate], [!accepted, accepted]);
    assert.deepEqual(data.decadal.grades, [grade]);
    assert.equal(data.decadal.branch, branch);
    assert.equal(data.decadal.localSourceSha, false);
    assert.deepEqual(data.decadal.mingFixedFireBell, [{ star: '火星', branch: '丑', relation: accepted ? '三合' : '守' }]);
    assert.deepEqual(data.decadal.archiveFireBell.filter(row => row.relation === '守'),
      accepted ? [{ star: '铃星', branch: '巳', relation: '守' }] : []);
    assert.equal(clean.status, accepted ? 'partial' : 'not_matched');
    assert.deepEqual(clean.sourceFactIds, accepted ? [fact.factId] : []);
    assert.deepEqual(clean.windows, accepted ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
    if (accepted) {
      const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
      assert.equal(result({ ...run, facts: [wrong] }, chapterIndex('001')).status, 'not_matched');
      const anchors = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
      const wrongLayer = quanshuLimitChapter(archiveMinorInWrongLayer(n, '陀罗'), anchors);
      assert.equal(wrongLayer.decadal.localSourceSha, undefined);
      assert.equal(wrongLayer.cleanSeatMingFixedCandidate, undefined);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, chapterIndex('001')).status, 'unknown');
    }
  }

  const { run, fact, data } = yearFragment(female, 2033);
  assert.equal(data.sourceMinor.verified, true);
  assert.deepEqual(data.decadal.grades, [{ star: '太阳', grade: '陷' }]);
  assert.deepEqual(data.decadal.namedNativeSha, [{ star: '地劫', branch: '子', relation: '守' }]);
  assert.deepEqual(data.minor.namedNativeSha, [{ star: '擎羊', branch: '酉', relation: '守' }]);
  assert.deepEqual(data.yearly.mingFixedFireBell, [{ star: '火星', branch: '丑', relation: '守' }]);
  assert.deepEqual([data.overlappingShaCandidate, data.overlappingAnnualSeatShaCandidate,
    data.overlappingAnnualShangShiCandidate, data.overlappingAnnualFlyingShaCandidate], [false, false, false, false]);
  assert.equal(data.overlappingMingFixedShaCandidate, true);
  assert.equal(data.overlappingMingAnnualFireCandidate, true);
  assert.equal(data.overlappingMingNamedShaCandidate, false);
  const overlap = result(run, chapterIndex('002'));
  assert.equal(overlap.status, 'matched');
  assert.equal(overlap.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
  assert.deepEqual(overlap.sourceFactIds, [fact.factId]);
  assert.deepEqual(overlap.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const previous = { ...fact, normalizedPayload: { ...data, overlappingMingAnnualFireCandidate: undefined } };
  assert.equal(result({ ...run, facts: [previous] }, chapterIndex('002')).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-chapter-limits'));
  assert.match(formatFortuneFactAudit(input), /大限陷曜、小限与太岁煞曜同段，至少一层实守明刊静位火铃/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同一农历年的太岁另须实临按明刊生年安位的火星/u);
  assert.doesNotMatch(prompt, /至少一层实守明刊静位火铃|overlappingMingAnnualFireCandidate/u);
  const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(result({ ...run, facts: [wrong] }, chapterIndex('002')).status, 'not_matched');
  const next = yearFragment(female, 2034);
  assert.equal(next.data.overlappingMingFixedShaCandidate, false);
  assert.equal(next.data.overlappingMingAnnualFireCandidate, false);
  assert.equal(result(next.run, chapterIndex('002')).status, 'not_matched');
  const raw = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors);
  const unpaired = quanshuLimitChapter(female, { ...raw.payload.anchors, minorIndex: undefined });
  assert.equal(unpaired.sourceMinor.verified, undefined);
  assert.equal(unpaired.overlappingMingFixedShaCandidate, undefined);
  const wrongYangLayer = quanshuLimitChapter(archiveMinorInWrongLayer(female, '擎羊'), raw.payload.anchors);
  assert.equal(wrongYangLayer.minor.nativeShaAtSeat, undefined);
  assert.equal(wrongYangLayer.decadal.nativeShaAtSeat, true);
  assert.equal(wrongYangLayer.overlappingMingFixedShaCandidate, undefined);
  assert.equal(wrongYangLayer.overlappingMingAnnualFireCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongYangLayer }] }, chapterIndex('002')).status, 'unknown');
});

test('p081-002 can use natal Sha guarding Tai Sui in the actual three-layer slice', () => {
  const natal = native('1990-05-05', 7), run = calculate(chart(natal), 'year', { year: 2026 });
  const fact = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === 2026), data = fact.normalizedPayload;
  assert.equal(data.overlappingShaCandidate, false);
  assert.equal(data.overlappingAnnualSeatShaCandidate, true);
  assert.equal(data.overlappingMingAnnualNatalShaGuardCandidate, true);
  assert.deepEqual(data.decadal.grades, [{ star: '天机', grade: '陷' }]);
  assert.equal(data.decadal.localSourceSha, true);
  assert.deepEqual(data.decadal.annualSha, []);
  assert.deepEqual(data.yearly.namedNativeSha, [{ star: '地劫', branch: '午', relation: '守' }]);
  assert.deepEqual(data.minor.namedNativeSha, [{ star: '天空', branch: '辰', relation: '守' }]);
  const scoped = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
  const hit = result(scoped, chapterIndex('002'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'chapter-annual-seat'));
  assert.match(formatFortuneFactAudit(input), /太岁宫实见本命具名煞曜及小限实见本命具名煞曜在同一片段成立/u);
  const raw = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors);
  assert.equal(quanshuLimitChapter(natal, { ...raw.payload.anchors, minorIndex: undefined }).overlappingAnnualSeatShaCandidate, undefined);
});

test('p081-002 uses verified Tai Sui Injury or Envoy and the independent annual flying Sha group', () => {
  const natal = native('1980-03-11', 1), snapshot = chart(natal);
  const params = { periodType: 'year', targetPeriod: { year: 2043 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2043-11-19T03:00:00Z'), reference = { snapshotId: 'chapter-flying-sha', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const client = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-flying-sha-client', reference);
  const envoy = calculate(snapshot, 'year', { year: 2040 });
  for (const [sample, year, tallies, seats, group, witnesses, description] of [
    [envoy, 2040, [true, false], ['申', '申', '戌'], ['巳', '酉', '丑'], [{ star: '天使', branch: '申' }],
      '太岁在申宫，实守本命天使'],
    [client, 2043, [false, true], ['亥', '申', '未'], ['申', '子', '辰'], [],
      '同年飞天三杀的无序支位组为申、子、辰，大限实到其中的申宫'],
  ]) {
    const fact = chapterFacts(sample).find(row => row.normalizedPayload.lunarYear === year), data = fact.normalizedPayload;
    assert.deepEqual([data.overlappingShaCandidate, data.overlappingAnnualSeatShaCandidate], [false, false]);
    assert.deepEqual([data.overlappingAnnualShangShiCandidate, data.overlappingAnnualFlyingShaCandidate], tallies);
    assert.equal(data.overlappingMingFlyingShaCandidate, false);
    assert.deepEqual([data.yearly.branch, data.decadal.branch, data.minor.branch], seats);
    assert.deepEqual(data.annualFlyingShaBranches, group);
    assert.deepEqual(data.annualShangShiGuards, witnesses);
    assert.ok(data.decadal.grades.some(row => row.star === '天梁' && row.grade === '陷'));
    assert.equal(data.decadal.localSourceSha, true);
    assert.equal(data.minor.nativeShaAtSeat, true);
    const scoped = { ...sample, facts: sample.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = result(scoped, chapterIndex('002'));
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'chapter-named-annual'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(description));
    assert.doesNotMatch(prompt, /annualFlyingShaBranches|annualShangShiGuards/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  }

  const fact = chapterFacts(envoy).find(row => row.normalizedPayload.lunarYear === 2040);
  const raw = envoy.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  const missing = structuredClone(natal);
  for (const palace of missing.palaces) palace.adjectiveStars = palace.adjectiveStars.filter(row => row.name !== '天使');
  const unverified = quanshuLimitChapter(missing, raw.payload.anchors);
  assert.equal(unverified.overlappingAnnualShangShiCandidate, undefined);
  assert.equal(unverified.annualShangShiGuards, undefined);
  const wrongLayer = structuredClone(natal), envoySeat = wrongLayer.palaces.find(row => row.name === '疾厄');
  const [wrongEnvoy] = envoySeat.adjectiveStars.splice(envoySeat.adjectiveStars.findIndex(row => row.name === '天使'), 1);
  envoySeat.minorStars.push(wrongEnvoy);
  const wrongEvidence = quanshuLimitChapter(wrongLayer, raw.payload.anchors);
  assert.equal(fact.normalizedPayload.shangShiPlacementProof, 'quanshu-shangshi-native-palaces-adjective-layer-v1');
  assert.equal(wrongEvidence.overlappingAnnualShangShiCandidate, undefined);
  assert.equal(wrongEvidence.annualShangShiGuards, undefined);
  const check = normalizedPayload => result({ ...envoy, facts: [{ ...fact, normalizedPayload }] }, chapterIndex('002'));
  assert.equal(check(wrongEvidence).status, 'unknown');
  assert.equal(check({ ...fact.normalizedPayload, shangShiPlacementProof: undefined }).status, 'unknown');

  const otherMissing = structuredClone(natal), injurySeat = otherMissing.palaces.find(row => row.name === '仆役');
  injurySeat.adjectiveStars = injurySeat.adjectiveStars.filter(row => row.name !== '天伤');
  const retained = quanshuLimitChapter(otherMissing, raw.payload.anchors);
  assert.deepEqual(retained.annualShangShiGuards, [{ star: '天使', branch: '申' }]);
  assert.equal(retained.overlappingAnnualShangShiCandidate, true);
  assert.equal(check(retained).status, 'partial');

  const local = calculate(snapshot, 'year', { year: 2043 });
  const flying = chapterFacts(local).find(row => row.normalizedPayload.lunarYear === 2043);
  const source = local.rawFacts.find(row => flying.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(source);
  assert.equal(quanshuLimitChapter(natal, { ...source.payload.anchors, minorIndex: undefined }).overlappingAnnualFlyingShaCandidate, undefined);
});

test('p081-002 confirms the source flying Sha set at the verified fallen decade with natal Sha at the small limit', () => {
  const birth = { dateStr: '1988-05-15', timeIndex: 8, gender: '女', fixLeap: true, config };
  const archive = astro.withOptions(birth), natal = archive.toJSON(), year = 2042;
  const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.UTC(year, 5, 1), reference = { snapshotId: 'chapter-ming-flying-sha', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const facts = chapterFacts(run);
  const active = facts.find(row => row.normalizedPayload.lunarYear === year);
  const previous = facts.find(row => row.activeTo === active.activeFrom);
  assert.equal(active.activeFrom, new Date(quanshuLunarMidnight(year, 1)).toISOString());
  assert.equal(previous.normalizedPayload.lunarYear, year - 1);
  assert.equal(previous.normalizedPayload.overlappingMingFlyingShaCandidate, false);
  assert.deepEqual(active.normalizedPayload.overlappingMingFlyingShaWitness, {
    annualBranch: '戌', decadalBranch: '卯', minorBranch: '辰', groupBranches: ['亥', '卯', '未'],
    decadalFallen: [{ star: '破军', grade: '陷' }],
    decadalSha: [{ star: '天空', branch: '卯', relation: '守' }], minorSha: [{ star: '陀罗', branch: '辰', relation: '守' }],
  });
  const scoped = { ...run, facts };
  const hit = result(scoped, chapterIndex('002'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
  assert.deepEqual(hit.sourceFactIds, [active.factId]);
  assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
  const atYear = lunarYear => {
    const date = `${lunarYear}-06-01`, h = archive.horoscope(date, 6);
    return { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index,
      age: h.age.nominalAge, at: Date.parse(date + 'T03:00:00Z'), windowEnd: Date.UTC(lunarYear, 11, 29) };
  };
  const frame = atYear(year);
  const displaced = quanshuLimitChapter(natal, { ...frame, minorIndex: frame.decadalIndex });
  assert.equal(displaced.overlappingMingFlyingShaCandidate, undefined);
  assert.equal(result({ ...scoped, facts: [{ ...active, normalizedPayload: displaced }] }, chapterIndex('002')).status, 'unknown');
  const nextYear = quanshuLimitChapter(natal, atYear(year + 1));
  assert.equal(nextYear.decadal.branch, '卯');
  assert.equal(nextYear.overlappingMingFlyingShaCandidate, false);
  assert.notEqual(result({ ...scoped, facts: [{ ...active, normalizedPayload: nextYear }] }, chapterIndex('002')).status, 'matched');
  const { input: modelInput } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  assert.ok(modelInput.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
  assert.match(formatFortunePrompt(modelInput), /不分派|不分别指定/u);
  assert.doesNotMatch(formatFortunePrompt(modelInput), /亥、卯、未|overlappingMingFlyingShaWitness/u);
});

test('p081-004 requires a verified flanking pair and named guards in the same actual month and day', () => {
  const date = '2028-03-26', natal = native('1990-05-05', 0);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-flanks-chart', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = withoutChapterHours(bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-flanks-client', reference));
  const hit = result(run, chapterIndex('004')), fact = chapterFacts(run).find(row => hit.sourceFactIds.includes(row.factId));
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: '2028-03-25T16:00:00.000Z', endExclusive: '2028-03-26T16:00:00.000Z' }]);
  const data = fact.normalizedPayload;
  assert.equal(data.shangShiPlacementProof, 'quanshu-shangshi-native-palaces-adjective-layer-v1');
  assert.equal(data.dailyShaCandidate, false);
  assert.equal(data.dailyFlankedShaCandidate, true);
  assert.deepEqual([data.monthly.branch, data.daily.branch], ['未', '未']);
  assert.deepEqual(data.flankWitnesses, [{ scope: 'yearly', branch: '申', group: '本命羊陀',
    stars: [{ star: '擎羊', branch: '酉' }, { star: '陀罗', branch: '未' }], candidate: true }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chapter-flanks'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /擎羊在酉宫、陀罗在未宫，夹太岁所在的申宫/u);
  assert.doesNotMatch(prompt, /dailyFlankedShaCandidate|flankWitnesses/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const comparisonChart = chart(native('1990-05-05', 1));
  const acrossZi = calculate(comparisonChart, 'day', { date: '2031-02-02' });
  const wrap = chapterFacts(acrossZi).find(row => row.normalizedPayload.dailyFlankedShaCandidate === true);
  assert.deepEqual(wrap.normalizedPayload.flankWitnesses.map(row => [row.scope, row.branch, row.stars.map(star => star.branch)]),
    [['minor', '亥', ['戌', '子']], ['yearly', '亥', ['戌', '子']]]);
  assert.equal(result(withoutChapterHours(acrossZi), chapterIndex('004')).status, 'partial');
  const noDayGuard = calculate(comparisonChart, 'day', { date: '2031-02-01' });
  const earlier = chapterFacts(noDayGuard)[0].normalizedPayload;
  assert.equal(earlier.upperFlankCandidate, true);
  assert.equal(earlier.daily.nativeShaAtSeat, false);
  assert.equal(earlier.dailyFlankedShaCandidate, false);
  assert.equal(earlier.dailyGuardedTabooCandidate, true);
  assert.deepEqual(earlier.guardedTabooWitnesses.map(row => [row.scope, row.branch, row.taboos[0].star]),
    [['monthly', '酉', '文昌']]);
  assert.equal(result(noDayGuard, chapterIndex('004')).status, 'partial');
  const earlierFact = chapterFacts(noDayGuard)[0];
  const earlierFrame = noDayGuard.rawFacts.find(row => earlierFact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
  const misplacedTaboo = quanshuLimitChapter(archiveMinorInWrongLayer(native('1990-05-05', 1), '文昌'), earlierFrame);
  assert.deepEqual(misplacedTaboo.unverifiedAuxiliaryStars, ['文昌']);
  assert.equal(misplacedTaboo.dailyGuardedTabooCandidate, undefined);
  assert.deepEqual(misplacedTaboo.guardedTabooWitnesses, []);

  const shangShi = native('1980-03-11', 0);
  const paired = calculate(chart(shangShi), 'day', { date: '2028-02-25' });
  const sameSeat = chapterFacts(paired).find(row => row.normalizedPayload.dailyFlankedShaCandidate === true);
  assert.deepEqual(sameSeat.normalizedPayload.flankWitnesses.map(row => [row.scope, row.branch, row.group]),
    [['yearly', '申', '伤使'], ['yearly', '申', '本命羊陀']]);
  assert.deepEqual(sameSeat.normalizedPayload.flankWitnesses[0].stars, [
    { star: '天伤', branch: '未' }, { star: '天使', branch: '酉' },
  ]);
  const raw = paired.rawFacts.find(row => sameSeat.sourceFactIds.includes(row.rawFactId) && row.payload.anchors);
  const injurySeat = shangShi.palaces.find(row => row.name === '仆役');
  const [injury] = injurySeat.adjectiveStars.splice(injurySeat.adjectiveStars.findIndex(row => row.name === '天伤'), 1);
  injurySeat.minorStars.push(injury);
  const wrongLayer = quanshuLimitChapter(shangShi, raw.payload.anchors);
  assert.deepEqual(wrongLayer.flankWitnesses.map(row => row.group), ['本命羊陀']);
  assert.equal(wrongLayer.dailyFlankedShaCandidate, true);
  const check = normalizedPayload => result({ ...paired, facts: [{ ...sameSeat, normalizedPayload }] }, chapterIndex('004'));
  assert.equal(check(wrongLayer).status, 'partial');
  assert.equal(check({ ...sameSeat.normalizedPayload, shangShiPlacementProof: undefined }).status, 'unknown');
});

test('p081-004 matches Sha and Ji in the same active month or day and retains the actual emitting stem', () => {
  const natal = native('1990-05-05', 0), date = '2026-02-21';
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-taboo-chart', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-taboo-client', reference);
  for (const [sampleDate, hour, scope, branch, sha, layer, stem, star] of [
    [date, 0, 'daily', '未', '陀罗', '流年', '丙', '廉贞'],
    ['2026-06-16', 0, 'monthly', '未', '陀罗', '流年', '丙', '廉贞'],
    ['2026-02-23', 1, 'daily', '戌', '天空', '生年', '庚', '天同'],
    ['2026-08-14', 1, 'monthly', '戌', '天空', '生年', '庚', '天同'],
  ]) {
    const sample = withoutChapterHours(sampleDate === date ? run : calculate(chart(native('1990-05-05', hour)), 'day', { date: sampleDate }));
    const start = Date.parse(sampleDate + 'T00:00:00+08:00');
    const match = result(sample, chapterIndex('004'));
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.windows, [{ start: new Date(start).toISOString(), endExclusive: new Date(start + 86_400_000).toISOString() }]);
    const fact = chapterFacts(sample).find(row => match.sourceFactIds.includes(row.factId)), data = fact.normalizedPayload;
    assert.equal(data.dailyShaCandidate, false);
    assert.equal(data.dailyFlankedShaCandidate, false);
    assert.equal(data.dailyGuardedTabooCandidate, true);
    assert.deepEqual(data.guardedTabooWitnesses, [{ scope, branch, sha: [{ star: sha, branch, relation: '守' }],
      taboos: [{ layer, stem, star, branch, relation: '守' }], candidate: true }]);
    if (scope === 'daily' && sha === '天空') {
      const anchors = sample.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload.anchors).payload.anchors;
      const retainedSky = quanshuLimitChapter(archiveMinorInWrongLayer(native('1990-05-05', hour), '地劫'), anchors);
      assert.deepEqual([retainedSky.sourceSkyReady, retainedSky.sourceRobberyReady], [true, false]);
      assert.deepEqual(retainedSky.guardedTabooWitnesses, data.guardedTabooWitnesses);
      assert.equal(result({ ...sample, facts: [{ ...fact, normalizedPayload: retainedSky }] }, chapterIndex('004')).status, 'partial');
    }

    const { input } = buildFortuneModelContext(sample, interpretFortune(sample, requestForFortuneRun(sample), 'chapter-taboo-prompt'));
    const prompt = formatFortuneFactAudit(input);
    const scopeLabel = scope === 'daily' ? '产品流日' : '斗君月';
    assert.ok(prompt.includes(scopeLabel + '在' + branch + '宫，' + sha + '、' + layer + stem + '干化忌受曜' + star + '同守该宫'));
    assert.doesNotMatch(prompt, /guardedTabooWitnesses|dailyGuardedTabooCandidate/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));
  }

  const local = calculate(reference.chart, 'day', { date });
  const fact = chapterFacts(local)[0];
  const raw = local.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  const missing = structuredClone(natal);
  for (const palace of missing.palaces) palace.majorStars = palace.majorStars.filter(row => row.name !== '廉贞');
  const unverified = quanshuLimitChapter(missing, raw.payload.anchors);
  assert.equal(unverified.dailyGuardedTabooCandidate, undefined);
  assert.deepEqual(unverified.guardedTabooWitnesses, []);
  assert.equal(quanshuLimitChapter(natal, { ...raw.payload.anchors, monthIndex: undefined }).dailyGuardedTabooCandidate, undefined);
});

test('p081 verifies the natal star positions and actual decade for all four limit-chapter clauses', () => {
  const cases = [
    { suffix: '001', dateStr: '1990-05-05', timeIndex: 2, gender: '男', year: 2014, star: '太阳', field: 'cleanSeatMingFixedCandidate' },
    { suffix: '002', dateStr: '1980-03-11', timeIndex: 2, year: 2025, star: '天梁', field: 'overlappingShaCandidate' },
    { suffix: '003', dateStr: '1990-05-05', timeIndex: 5, year: 2035, star: '天同', field: 'decadalMultipleSupportAtSeat' },
    { suffix: '004', dateStr: '1990-05-05', timeIndex: 0, date: '2026-02-21', star: '廉贞', field: 'dailyGuardedTabooCandidate' },
  ];
  for (const { suffix, dateStr, timeIndex, gender = '女', year, date, star, field } of cases) {
    const natal = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config }).toJSON();
    const run = date ? calculate(chart(natal), 'day', { date }) : calculate(chart(natal), 'year', { year });
    const rule = chapterIndex(suffix), hit = result(suffix === '004' ? withoutChapterHours(run) : run, rule);
    assert.equal(hit.status, 'partial', suffix);
    if (suffix === '004') {
      const withHour = result(run, rule);
      assert.equal(withHour.status, 'matched');
      assert.ok(withHour.sourceFactIds.every(id => chapterHours(run).some(fact => fact.factId === id)));
    }
    const fact = chapterFacts(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload[field] === true);
    assert.ok(fact, suffix);
    const { limitPlacementProof, ...unprovenPayload } = fact.normalizedPayload;
    assert.deepEqual(unprovenPayload.unverifiedMajorStars, []);
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    const anchors = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors).payload.anchors;
    const branch = fact.normalizedPayload.decadal.branch;
    assert.deepEqual(fact.normalizedPayload.sourceDecadal, { branch, verified: true });
    const shifted = quanshuLimitChapter(copyWithShiftedDecade(natal, anchors), anchors);
    assert.deepEqual(shifted.sourceDecadal, { branch, verified: false });
    assert.equal(shifted.sourceMinor.verified, true);
    assert.equal(shifted.yearly.branch, fact.normalizedPayload.yearly.branch);
    assert.equal(shifted.minor.branch, fact.normalizedPayload.minor.branch);
    assert.equal(shifted.decadal, undefined);
    assert.equal(shifted.stageStart, undefined);
    assert.equal(shifted.stageEnd, undefined);
    assert.equal(shifted[field], undefined, suffix);
    for (const normalizedPayload of [shifted, unprovenPayload]) {
      const restricted = { ...run, facts: [{ ...fact, normalizedPayload }] };
      assert.equal(result(restricted, rule).status, 'unknown', suffix);
    }
    const decadeWarning = '归档大限未能通过五局起岁与顺逆复核';
    const decadeSeat = `大限在${branch}宫`;
    const minorSeat = `小限在${shifted.minor.branch}宫`;
    for (const [payload, misfiledDecade] of [[fact.normalizedPayload, false], [shifted, true]]) {
      const scoped = { ...run, facts: [{ ...fact, normalizedPayload: payload }] };
      const report = interpretFortune(scoped, requestForFortuneRun(scoped), 'chapter-decade-proof');
      const { input } = buildFortuneModelContext(scoped, report);
      const audit = formatFortuneFactAudit(input), prompt = formatFortunePrompt(input);
      assert.equal(audit.includes(decadeWarning), misfiledDecade, suffix);
      assert.equal(audit.includes(decadeSeat), !misfiledDecade, suffix);
      assert.ok(audit.includes(minorSeat), suffix);
      assert.ok(![decadeWarning, decadeSeat, minorSeat, 'sourceDecadal'].some(value => prompt.includes(value)), suffix);
    }
    const wrong = structuredClone(natal);
    const host = wrong.palaces.find(row => row.majorStars.some(value => value.name === star));
    wrong.palaces.find(row => row.index === (host.index + 1) % 12).majorStars.push(host.majorStars.find(value => value.name === star));
    host.majorStars = host.majorStars.filter(value => value.name !== star);
    const altered = quanshuLimitChapter(wrong, anchors);
    assert.deepEqual(altered.unverifiedMajorStars, [star], suffix);
    assert.equal(altered[field], undefined, suffix);
    if (suffix === '003') {
      assert.deepEqual(altered.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star), ['文曲']);
    }
    if (suffix === '004') {
      assert.deepEqual(altered.guardedTabooWitnesses, []);
      assert.equal(altered.jielanDailyFireBellCandidate, true);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: altered }] }, rule).status, 'partial');
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: {
        ...altered, jielanFireBellProfile: 'unverified',
      } }] }, rule).status, 'unknown');
      continue;
    }
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: altered }] }, rule).status, 'unknown', suffix);
  }
});

test('p081 confirms the named annual and opening-day branches on one actual Ming limit chart', () => {
  const date = '2012-01-23', year = 2012;
  const archive = astro.withOptions({ dateStr: '1988-05-15', timeIndex: 8, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON();
  const ref = { snapshotId: 'chapter-ming-shared-chart', chart: chart(natal) };
  const asOf = Date.parse(date + 'T03:00:00Z');
  const submit = (periodType, targetPeriod) => {
    const params = { periodType, targetPeriod, displayTimezone: 'Asia/Shanghai' };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
    validateFortuneFacts(run);
    return run;
  };
  const annualRun = submit('year', { year });
  const annualFact = chapterFacts(annualRun).find(row => row.normalizedPayload.lunarYear === year);
  const annual = annualFact.normalizedPayload;
  assert.equal(annual.overlappingMingNamedShaCandidate, true);
  const guarded = seat => seat.namedNativeSha.filter(row => row.relation === '守').map(row => row.star);
  assert.deepEqual([annual.decadal.branch, annual.yearly.branch, annual.minor.branch], ['午', '辰', '戌']);
  assert.deepEqual([guarded(annual.decadal), guarded(annual.yearly)], [['擎羊'], ['陀罗']]);
  assert.ok(annual.decadal.grades.some(row => row.star === '天同' && row.grade === '陷'));
  const annualOnly = { ...annualRun, facts: [annualFact] };
  const annualHit = result(annualOnly, chapterIndex('002'));
  assert.equal(annualHit.status, 'matched');
  assert.equal(annualHit.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
  assert.deepEqual(annualHit.windows, [{ start: annualFact.activeFrom, endExclusive: annualFact.activeTo }]);
  const oldAnnual = { ...annualFact, normalizedPayload: { ...annual, overlappingMingNamedShaCandidate: undefined } };
  assert.equal(result({ ...annualRun, facts: [oldAnnual] }, chapterIndex('002')).status, 'partial');

  const dailyRun = submit('day', { date });
  const [dailyFact, lateZi] = chapterFacts(dailyRun);
  const daily = dailyFact.normalizedPayload;
  assert.equal(daily.mingOpeningMinorBellCandidate, true);
  assert.deepEqual([daily.minor.branch, daily.monthly.branch, daily.daily.branch], ['戌', '戌', '戌']);
  assert.deepEqual(daily.mingOpeningSha.guards, [{ star: '铃星', branch: '戌', relation: '守' }]);
  const dailyHit = result(dailyRun, chapterIndex('004'));
  assert.equal(dailyHit.status, 'matched');
  assert.equal(dailyHit.matchedSourceExcerpt, '更须看月值恶杀，日值恶杀');
  assert.deepEqual(dailyHit.windows, [{ start: '2012-01-22T16:00:00.000Z', endExclusive: '2012-01-23T15:00:00.000Z' }]);
  assert.notEqual(result({ ...dailyRun, facts: [lateZi] }, chapterIndex('004')).status, 'matched');

  const h = archive.horoscope(date, 6);
  const frame = { lunarYear: year, age: year - readQuanshuNatal(natal).birthYear + 1,
    yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, monthIndex: h.monthly.index, dayIndex: h.daily.index,
    at: Date.parse(dailyFact.activeFrom), dayEnd: Date.parse(dailyFact.activeTo), windowEnd: Date.parse(lateZi.activeTo) };
  const wrongAnnualSha = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '陀罗'), frame);
  assert.equal(wrongAnnualSha.overlappingMingNamedShaCandidate, undefined);
  assert.equal(wrongAnnualSha.mingOpeningMinorBellCandidate, true);
  const absentMinor = quanshuLimitChapter(natal, { ...frame, minorIndex: undefined });
  assert.equal(absentMinor.overlappingMingNamedShaCandidate, undefined);
  assert.equal(absentMinor.mingOpeningMinorBellCandidate, undefined);
  const wrongDay = quanshuLimitChapter(natal, { ...frame, dayIndex: (frame.dayIndex + 1) % 12 });
  assert.equal(wrongDay.mingOpeningMinorBellCandidate, false);
  for (const [run, hit] of [[annualOnly, annualHit], [dailyRun, dailyHit]]) {
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
    assert.equal(finding.originalText, hit.matchedSourceExcerpt);
    assert.doesNotMatch(formatFortunePrompt(input), /overlappingMingNamedShaCandidate|mingOpeningMinorBellCandidate|初一斗君和产品流日同在戌宫/u);
  }
});

test('p081-004 verifies the opening Doujun and Ming Bell during the common first-day hours', () => {
  const date = '1992-02-04';
  const natal = astro.withOptions({ dateStr: '1980-03-11', timeIndex: 2, gender: '男', fixLeap: true, config }).toJSON();
  const snapshot = chart(natal);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-opening-chart', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-opening-client', reference);
  validateFortuneFacts(run);
  const facts = chapterFacts(run);
  const fact = facts.find(row => row.normalizedPayload.mingOpeningShaCandidate === true);
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.monthly.branch, data.daily.branch], ['戌', '戌']);
  assert.deepEqual([data.yearly.branch, data.decadal.branch, data.minor.branch, data.sourceMinor.verified], ['申', '子', '戌', true]);
  assert.deepEqual([data.dailyShaCandidate, data.dailyFlankedShaCandidate, data.dailyGuardedTabooCandidate], [false, false, false]);
  assert.deepEqual(data.mingOpeningSha, { branch: '戌', guards: [{ star: '铃星', branch: '戌', relation: '守' }] });
  assert.equal(data.mingOpeningMinorBellCandidate, true);
  assert.deepEqual(data.monthly.archiveFireBell, [{ star: '火星', branch: '辰', relation: '冲' }]);
  const match = result(run, chapterIndex('004'));
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [fact.factId]);
  assert.deepEqual(match.windows, [{ start: '1992-02-03T16:00:00.000Z', endExclusive: '1992-02-04T15:00:00.000Z' }]);
  const noMingProfile = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'archive-position' } };
  assert.equal(result({ ...run, facts: [noMingProfile] }, chapterIndex('004')).status, 'not_matched');
  const later = facts.find(row => row.activeFrom === fact.activeTo);
  assert.equal(later.activeTo, '1992-02-04T16:00:00.000Z');
  assert.equal(later.normalizedPayload.mingOpeningShaCandidate, undefined);
  const next = calculate(snapshot, 'day', { date: '1992-02-05' });
  assert.equal(chapterFacts(next)[0].normalizedPayload.mingOpeningShaCandidate, false);

  const local = calculate(snapshot, 'day', { date });
  const localFact = chapterFacts(local).find(row => row.normalizedPayload.mingOpeningShaCandidate === true);
  const raw = local.rawFacts.find(row => localFact.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  const frame = raw.payload.anchors;
  const shifted = quanshuLimitChapter(natal, { ...frame, dayIndex: (frame.dayIndex + 1) % 12 });
  assert.equal(shifted.mingOpeningShaCandidate, false);
  assert.equal(quanshuLimitChapter(natal, { ...frame, minorIndex: undefined }).mingOpeningShaCandidate, undefined);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chapter-ming-opening'));
  assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId).originalText,
    '更须看月值恶杀，日值恶杀');
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /明刊正月初一斗君和产品流日同在戌宫/u);
  assert.match(audit, /北京时间午夜至23点取证/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊正月初一斗君和产品流日同在|北京时间午夜至23点取证|mingOpeningShaCandidate/u);
});

test('p081-004 verifies the opening Doujun and Ming Fire in the same actual small limit', () => {
  const date = '2000-02-05', year = 2000;
  const engine = astro.withOptions({ dateStr: '1980-02-20', timeIndex: 10, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON();
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse(date + 'T03:00:00Z'), archive = { snapshotId: 'chapter-opening-fire', chart: chart(natal) };
  const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const [fact, lateZi] = chapterFacts(run);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.monthly.branch, data.daily.branch, data.minor.branch], ['寅', '寅', '寅']);
  assert.deepEqual([data.mingOpeningMinorFireCandidate, data.mingOpeningMinorBellCandidate, data.sourceMinor.verified], [true, false, true]);
  assert.deepEqual(data.mingOpeningSha, { branch: '寅', guards: [{ star: '火星', branch: '寅', relation: '守' }] });
  const hit = result(run, chapterIndex('004'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '更须看月值恶杀，日值恶杀');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '2000-02-04T16:00:00.000Z', endExclusive: '2000-02-05T15:00:00.000Z' }]);
  assert.equal(lateZi.normalizedPayload.mingOpeningMinorFireCandidate, undefined);
  assert.notEqual(result({ ...run, facts: [lateZi] }, chapterIndex('004')).status, 'matched');

  const h = engine.horoscope(date, 6);
  const frame = { at: Date.parse(fact.activeFrom), dayEnd: Date.parse(fact.activeTo), windowEnd: Date.parse(lateZi.activeTo),
    lunarYear: year, age: h.age.nominalAge, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
    minorIndex: h.age.index, monthIndex: h.monthly.index, dayIndex: h.daily.index };
  const wrongMinor = quanshuLimitChapter(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
  assert.equal(wrongMinor.sourceMinor.verified, false);
  assert.equal(wrongMinor.mingOpeningMinorFireCandidate, undefined);
  assert.notEqual(result({ ...run, facts: [{ ...fact, normalizedPayload: wrongMinor }] }, chapterIndex('004')).status, 'matched');
  const next = calculate(archive.chart, 'day', { date: '2000-02-06' });
  assert.equal(chapterFacts(next).find(row => row.normalizedPayload.lunarYear === year).normalizedPayload.mingOpeningMinorFireCandidate, false);
  assert.notEqual(result(next, chapterIndex('004')).status, 'matched');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  const audit = /明刊正月初一斗君和产品流日同在寅宫.*实守火铃.*火星/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按该版以生年安出的火星/u);
  assert.doesNotMatch(prompt, audit);
  assert.doesNotMatch(prompt, /mingOpeningMinorFireCandidate/u);
});

test('p081-004 derives an ordinary Jielan day from the Doujun month and clips the disputed Zi hour', () => {
  const date = '2026-03-31', natal = native('1947-02-05', 0), snapshot = chart(natal);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-jielan-day', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-jielan-client', reference);
  validateFortuneFacts(run);
  const [day, lateZi] = chapterFacts(run), data = day.normalizedPayload;
  assert.deepEqual([day.activeFrom, day.activeTo, lateZi.activeFrom, lateZi.activeTo], [
    '2026-03-30T16:00:00.000Z', '2026-03-31T15:00:00.000Z', '2026-03-31T15:00:00.000Z', '2026-03-31T16:00:00.000Z',
  ]);
  assert.equal(data.jielanDailyShaCandidate, true);
  assert.deepEqual(data.jielanDailyShaWitness, { lunarMonth: 2, lunarDay: 13, monthBranch: '未', dayBranch: '未', productDayBranch: '未',
    monthSha: [{ star: '擎羊', branch: '未', relation: '守' }], daySha: [{ star: '擎羊', branch: '未', relation: '守' }] });
  assert.equal(lateZi.normalizedPayload.jielanDailyShaCandidate, undefined);
  assert.equal(lateZi.normalizedPayload.dailyShaCandidate, true);
  const isolated = [day, lateZi].map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload,
    dailyShaCandidate: false, dailyFlankedShaCandidate: false, dailyGuardedTabooCandidate: false, mingOpeningShaCandidate: false } }));
  const strict = { ...run, facts: isolated };
  const hit = result(strict, chapterIndex('004'));
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: day.activeFrom, endExclusive: day.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [day.factId]);
  const { input } = buildFortuneModelContext(strict, interpretFortune(strict, requestForFortuneRun(strict), 'chapter-jielan-day'));
  assert.match(formatFortuneFactAudit(input), /按《捷览》，从未宫的当月斗君起初一，至农历第13日落在未宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /当月斗君起初一|jielanDailyShaWitness/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  assert.equal(result({ ...run, facts: [{ ...isolated[0], normalizedPayload: { ...isolated[0].normalizedPayload,
    jielanDayProfile: 'unverified' } }] }, chapterIndex('004')).status, 'not_matched');
  assert.equal(chapterFacts(calculate(snapshot, 'day', { date: '2026-04-01' }))[0].normalizedPayload.jielanDailyShaCandidate, false);
  const local = calculate(snapshot, 'day', { date });
  const localDay = chapterFacts(local)[0];
  const raw = local.rawFacts.find(row => localDay.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  const sourceDay = quanshuLimitChapter(natal, { ...raw.payload.anchors, dayIndex: undefined });
  assert.equal(sourceDay.jielanDailyShaCandidate, true);
  assert.equal(sourceDay.jielanDailyShaWitness.productDayBranch, undefined);
  assert.equal(quanshuLimitChapter(natal, { ...raw.payload.anchors, minorIndex: undefined }).jielanDailyShaCandidate, undefined);
});

test('p081 and p082 confirm the clean decade and three actual separate seats on one Ming chart', () => {
  const archive = astro.withOptions({ dateStr: '1988-05-15', timeIndex: 8, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON(), year = 2024;
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'ming-clean-and-independent-seats', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const submitted = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(submitted);
  const chapter = chapterFacts(submitted).find(row => row.normalizedPayload.lunarYear === year);
  const yearly = yearAndLimitsFacts(submitted).find(row => row.normalizedPayload.lunarYear === year);
  const run = { ...submitted, facts: [chapter, yearly] };
  const chapterData = chapter.normalizedPayload, yearlyData = yearly.normalizedPayload;
  assert.equal(chapterData.cleanSeatMingNamedRosterCandidate, true);
  assert.deepEqual(chapterData.decadal.grades, [{ star: '天府', grade: '地' }]);
  assert.deepEqual(chapterData.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star), ['天府', '禄存']);
  assert.equal(yearlyData.verifiedIndependentGradedGuardsCandidate, true);
  assert.deepEqual(yearlyData.guards.map(row => row.branch), ['巳', '戌', '辰']);
  assert.deepEqual(yearlyData.annualOppositions, ['minor']);
  const chapterRead = result(run, chapterIndex('001')), yearlyRead = limitAuditMatch(run, 'p082');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
  for (const [hit, fact, excerpt] of [[chapterRead, chapter, '如宫分星缠全吉庙旺得地'],
    [yearlyRead, yearly, '须详大限独守吉凶何如，小限独守吉凶何如，太岁独守吉凶何如']]) {
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId).originalText, excerpt);
  }
  assert.match(formatFortuneFactAudit(input), /太岁实际对冲小限/u);
  assert.doesNotMatch(formatFortunePrompt(input), /太岁实际对冲小限|cleanSeatMingNamedRosterCandidate|verifiedIndependentGradedGuardsCandidate/u);

  const frameFor = y => {
    const date = `${y}-06-01`, h = archive.horoscope(date, 6);
    return { lunarYear: y, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index,
      age: y - readQuanshuNatal(natal).birthYear + 1, at: Date.parse(date + 'T03:00:00Z'), windowEnd: Date.UTC(y, 11, 30) };
  };
  const frame = frameFor(year), annual = quanshuAnnualContext(natal, year, '甲');
  const adjacentBirthday = astro.withOptions({ dateStr: '1988-05-14', timeIndex: 8, gender: '女', fixLeap: true, config }).toJSON();
  const mixedBirthday = { ...adjacentBirthday, palaces: adjacentBirthday.palaces.map(palace => ({ ...palace,
    majorStars: natal.palaces.find(row => row.index === palace.index).majorStars })) };
  const dayCheck = quanshuLimitChapter(mixedBirthday, frame);
  assert.deepEqual([chapterData.ziweiBirthAnchorVerified, dayCheck.ziweiBirthAnchorVerified], [true, false]);
  assert.equal(dayCheck.sourceDecadal.verified, true);
  assert.equal(dayCheck.decadal.branch, '巳');
  assert.equal(dayCheck.cleanSeatMingNamedRosterCandidate, undefined);
  assert.deepEqual(dayCheck.decadal.namedSupport.filter(row => row.relation === '守').map(row => row.star), ['禄存']);
  assert.equal(result({ ...run, facts: [{ ...chapter, normalizedPayload: dayCheck }] }, chapterIndex('001')).status, 'unknown');
  const shifted = copyWithShiftedDecade(natal, frame);
  const wrongYearly = quanshuYearAndLimits(shifted, quanshuLimitBranches(shifted, frame), annual);
  assert.equal(wrongYearly.sourceDecadal.verified, false);
  assert.deepEqual(wrongYearly.guards.map(row => row.layer), ['minor', 'yearly']);
  assert.equal(wrongYearly.verifiedIndependentGradedGuardsCandidate, undefined);
  assert.equal(limitAuditMatch({ ...run, facts: [{ ...yearly, normalizedPayload: wrongYearly }] }, 'p082').status, 'unknown');
  assert.equal(quanshuLimitChapter(shifted, frame).cleanSeatMingNamedRosterCandidate, undefined);
  const wrongAuxiliary = quanshuLimitChapter(archiveMinorInWrongLayer(natal, '禄存'), frame);
  assert.equal(wrongAuxiliary.cleanSeatMingNamedRosterCandidate, undefined);
  assert.equal(result({ ...run, facts: [{ ...chapter, normalizedPayload: wrongAuxiliary }] }, chapterIndex('001')).status, 'partial');
  for (const star of ['文昌', '文曲', '左辅', '右弼']) {
    assert.notEqual(natal.palaces.find(row => row.minorStars.some(auxiliary => auxiliary.name === star)).earthlyBranch,
      chapterData.decadal.branch, star);
    const outsideSeat = quanshuLimitChapter(archiveMinorInWrongLayer(natal, star), frame);
    assert.ok(outsideSeat.unverifiedAuxiliaryStars.includes(star));
    assert.equal(outsideSeat.cleanSeatMingNamedRosterCandidate, true, star);
    const retained = result({ ...run, facts: [{ ...chapter, normalizedPayload: outsideSeat }] }, chapterIndex('001'));
    assert.equal(retained.status, 'matched', star);
    assert.equal(retained.matchedSourceExcerpt, chapterRead.matchedSourceExcerpt, star);
  }
  const nextFrame = frameFor(2025);
  const nextYear = quanshuYearAndLimits(natal, quanshuLimitBranches(natal, nextFrame), quanshuAnnualContext(natal, 2025, '乙'));
  assert.equal(nextYear.verifiedIndependentGradedGuardsCandidate, false);
  assert.equal(quanshuLimitChapter(natal, nextFrame).cleanSeatMingNamedRosterCandidate, true);
});

test('p081 confirms the Ming first-day minor, month and day seated with a named natal Sha before late Zi', () => {
  const cases = [
    ['1980-11-09', 9, '1993-01-23', '酉', '擎羊'],
    ['1988-05-15', 8, '2006-01-29', '辰', '陀罗'],
    ['1974-02-05', 8, '1983-02-13', '未', '地劫'],
    ['1988-04-01', 3, '2002-02-12', '申', '天空'],
  ];
  const field = 'mingOpeningMinorNatalShaCandidate';
  for (const [dateStr, timeIndex, date, branch, star] of cases) {
    const year = Number(date.slice(0, 4)), natal = native(dateStr, timeIndex);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.parse(date + 'T04:00:00.000Z'), archive = { snapshotId: 'ming-opening-natal-sha', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const start = new Date(quanshuLunarMidnight(year, 1)).toISOString(), endExclusive = date + 'T15:00:00.000Z';
    const [fact, ...dayRows] = chapterFacts(run).filter(row => row.scope === 'daily' && row.normalizedPayload.sourceMinor?.verified === true);
    assert.ok(fact && dayRows.length, date);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.minor.branch, data.monthly.branch, data.daily.branch], [branch, branch, branch]);
    assert.deepEqual([data[field], data.mingOpeningMinorBellCandidate, data.mingOpeningMinorFireCandidate], [true, false, false]);
    assert.deepEqual(data.mingOpeningMinorNatalShaWitness, { branch, guards: [{ star, branch, relation: '守' }] });
    assert.equal(dayRows[0].activeFrom, endExclusive);
    assert.ok(dayRows.every(row => row.normalizedPayload[field] !== true));
    const selected = { ...run, facts: [fact] }, hit = result(selected, chapterIndex('004'));
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '更须看月值恶杀，日值恶杀');
    assert.deepEqual(hit.windows, [{ start, endExclusive }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const anchors = verifiedChapterFrame(natal, fact, run.time.window.end);
    const badMinor = quanshuLimitChapter(natal, { ...anchors, minorIndex: (anchors.minorIndex + 1) % 12 });
    const misplaced = quanshuLimitChapter(archiveMinorInWrongLayer(natal, star === '天空' ? '地空' : star), anchors);
    const wrongDay = quanshuLimitChapter(natal, { ...anchors, dayIndex: (anchors.dayIndex + 1) % 12 });
    assert.deepEqual([badMinor[field], misplaced[field], wrongDay[field]], [undefined, undefined, false]);
    assert.ok([badMinor, misplaced, wrongDay].every(payload => payload.mingOpeningMinorNatalShaWitness === undefined));
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), archive.snapshotId));
    assert.match(formatFortunePrompt(input), /更须看月值恶杀，日值恶杀/u);
    assert.doesNotMatch(formatFortunePrompt(input), /mingOpeningMinorNatalShaWitness|[酉辰未申]宫/u);
  }
});

test('p081 distinguishes four assistants and annual fixed Bell on the same verified native chart', () => {
  const engine = astro.withOptions({ dateStr: '1980-11-09', timeIndex: 9, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), snapshot = chart(natal);
  const run = calculate(snapshot, 'year', { year: 1994 });
  const [previous, fact] = chapterFacts(run), data = fact.normalizedPayload;
  assert.deepEqual([previous.normalizedPayload.decadal.branch, previous.normalizedPayload.cleanSeatMingFourHelpersCandidate], ['寅', false]);
  assert.equal(data.cleanSeatMingFixedCandidate, false);
  assert.equal(data.cleanSeatMingFourHelpersCandidate, true);
  assert.deepEqual(data.cleanSeatMingFourHelpersWitness, { branch: '丑', grades: [], helpers: [
    { star: '文昌', branch: '丑' }, { star: '文曲', branch: '丑' }, { star: '左辅', branch: '丑' }, { star: '右弼', branch: '丑' },
  ] });
  const hit = result(run, chapterIndex('001'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '遇左右昌曲');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '1994-02-09T16:00:00.000Z', endExclusive: fact.activeTo }]);

  const wrongProfile = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'unverified' } };
  assert.equal(result({ ...run, facts: [wrongProfile] }, chapterIndex('001')).status, 'not_matched');
  const raw = run.rawFacts.find(row => fact.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  const incomplete = structuredClone(natal), seat = incomplete.palaces.find(row => row.earthlyBranch === '丑');
  seat.minorStars = seat.minorStars.filter(row => row.name !== '左辅');
  assert.equal(quanshuLimitChapter(incomplete, raw.payload.anchors).cleanSeatMingFourHelpersCandidate, undefined);

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chapter-four-helpers'));
  assert.match(formatFortuneFactAudit(input), /四辅同守大限丑宫，实见文昌、文曲、左辅、右弼/u);
  assert.doesNotMatch(formatFortunePrompt(input), /四辅同守大限丑宫|cleanSeatMingFourHelpersWitness/u);
  assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
  assert.match(formatFortunePrompt(input), /遇左右昌曲/u);
  assert.equal(data.overlappingMingAnnualBellCandidate, false);

  const year = 2042, request = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), reference = { snapshotId: 'ming-annual-bell-overlap', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, now, reference)));
  const submitted = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(submitted);
  const annualBell = chapterFacts(submitted).find(row => row.normalizedPayload.lunarYear === year);
  const bell = annualBell.normalizedPayload;
  assert.deepEqual([bell.decadal.branch, bell.minor.branch, bell.yearly.branch], ['酉', '申', '戌']);
  assert.deepEqual(bell.decadal.grades, [{ star: '天相', grade: '陷' }]);
  assert.deepEqual(bell.decadal.namedNativeSha.filter(row => row.relation === '守'), [{ star: '擎羊', branch: '酉', relation: '守' }]);
  assert.deepEqual(bell.minor.namedNativeSha.filter(row => row.relation === '守'), [{ star: '地劫', branch: '申', relation: '守' }]);
  assert.deepEqual(bell.yearly.mingFixedFireBell.filter(row => row.relation === '守'), [{ star: '铃星', branch: '戌', relation: '守' }]);
  assert.equal(bell.overlappingMingAnnualBellCandidate, true);
  assert.ok(['overlappingMingNamedShaCandidate', 'overlappingMingAnnualFireCandidate', 'overlappingMingNatalTabooAndMinorBellCandidate',
    'overlappingMingFlyingShaCandidate', 'overlappingMingNatalTabooWithAnnualShangShiCandidate',
    'overlappingMingAnnualBladeAtDecadalCandidate'].every(key => bell[key] === false));
  const selected = { ...submitted, facts: [annualBell] }, matched = result(selected, chapterIndex('002'));
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
  assert.deepEqual(matched.sourceFactIds, [annualBell.factId]);
  assert.deepEqual(matched.windows, [{ start: '2042-01-21T16:00:00.000Z', endExclusive: annualBell.activeTo }]);

  const actual = engine.horoscope(year + '-06-15', 6);
  const anchors = { at: Date.parse(annualBell.activeFrom), windowEnd: Date.parse(annualBell.activeTo),
    lunarYear: year, age: actual.age.nominalAge, yearIndex: actual.yearly.index,
    decadalIndex: actual.decadal.index, minorIndex: actual.age.index };
  for (const [archive, frame] of [
    [archiveMinorInWrongLayer(natal, '地劫'), anchors],
    [natal, { ...anchors, minorIndex: (anchors.minorIndex + 1) % 12 }],
  ]) {
    const unresolved = quanshuLimitChapter(archive, frame);
    assert.equal(unresolved.overlappingMingAnnualBellCandidate, undefined);
    assert.notEqual(result({ ...selected, facts: [{ ...annualBell, normalizedPayload: unresolved }] }, chapterIndex('002')).status, 'matched');
  }
  const adjacentYear = year + 1, h = engine.horoscope(adjacentYear + '-06-15', 6);
  const at = quanshuLunarMidnight(adjacentYear, 1);
  const next = quanshuLimitChapter(natal, { at, lunarYear: adjacentYear, age: h.age.nominalAge, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index, windowEnd: at + 1000 });
  assert.equal(next.overlappingMingAnnualBellCandidate, false);
  const bellInput = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), reference.snapshotId)).input;
  const prompt = formatFortunePrompt(bellInput);
  assert.match(prompt, /铃星/u);
  assert.doesNotMatch(prompt, /戌宫铃星|overlappingMingAnnualBellCandidate/u);
});

test('p081 confirms Tai Sui arriving at separately verified Ming natal Sha or Ji in the same limit year', () => {
  const cases = [
    { dateStr: '1974-02-05', timeIndex: 4, year: 2013, start: '2013-02-09T16:00:00.000Z',
      branches: ['巳', '未', '丑'], annualSha: [], natalTaboo: '太阳', wrongStar: '陀罗' },
    { dateStr: '1980-11-09', timeIndex: 0, year: 2007, start: '2007-02-17T16:00:00.000Z',
      branches: ['亥', '酉', '未'], annualSha: ['天空', '地劫'], wrongStar: '陀罗' },
    { dateStr: '1988-04-01', timeIndex: 9, year: 2014, start: '2014-01-30T16:00:00.000Z',
      branches: ['午', '辰', '申'], annualSha: ['擎羊'], wrongStar: '擎羊' },
  ];
  for (const { dateStr, timeIndex, year, start, branches, annualSha, natalTaboo, wrongStar } of cases) {
    const natal = native(dateStr, timeIndex);
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-tai-sui-natal-sha', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload, [annualBranch, decadalBranch, minorBranch] = branches;
    assert.equal(data.overlappingMingAnnualNatalShaGuardCandidate, true);
    assert.ok(['overlappingMingNamedShaCandidate', 'overlappingMingAnnualFireCandidate', 'overlappingMingAnnualBellCandidate',
      'overlappingMingNatalTabooAndMinorBellCandidate', 'overlappingMingFlyingShaCandidate',
      'overlappingMingNatalTabooWithAnnualShangShiCandidate', 'overlappingMingAnnualBladeAtDecadalCandidate']
      .every(key => data[key] !== true));
    assert.deepEqual(data.overlappingMingAnnualNatalShaGuardWitness, {
      annualBranch, decadalBranch, minorBranch, annualSha: annualSha.map(star => ({ star, branch: annualBranch, relation: '守' })),
      ...(natalTaboo ? { natalTaboo: { star: natalTaboo, branch: annualBranch, relation: '守' } } : {}),
    });
    const selected = { ...run, facts: [fact] }, hit = result(selected, chapterIndex('002'));
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const anchors = verifiedChapterFrame(natal, fact, run.time.window.end);
    const wrongLayer = quanshuLimitChapter(archiveMinorInWrongLayer(natal, wrongStar), anchors);
    const wrongMinor = quanshuLimitChapter(natal, { ...anchors, minorIndex: (anchors.minorIndex + 1) % 12 });
    for (const wrong of [wrongLayer, wrongMinor]) {
      assert.equal(wrong.overlappingMingAnnualNatalShaGuardCandidate, undefined);
      assert.equal(wrong.overlappingMingAnnualNatalShaGuardWitness, undefined);
      assert.notEqual(result({ ...run, facts: [{ ...fact, normalizedPayload: wrong }] }, chapterIndex('002')).status, 'matched');
    }
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), archive.snapshotId));
    assert.match(formatFortunePrompt(input), /又加流年恶杀凑合/u);
    assert.doesNotMatch(formatFortunePrompt(input), /overlappingMingAnnualNatalShaGuardWitness|太岁在[巳亥午]宫/u);
  }
});

test('p081 distinguishes the Ming natal Lu pair from other bright limit seats', () => {
  const dateStr = '1983-04-15', timeIndex = 5, year = 1994;
  const natal = native(dateStr, timeIndex);
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-distinct-lu-pair', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const [previous, fact] = chapterFacts(run), data = fact.normalizedPayload;
  const field = 'cleanSeatMingLucunHuaLuCandidate';
  assert.deepEqual([previous.normalizedPayload.decadal.branch, previous.normalizedPayload[field]], ['亥', false]);
  assert.ok(previous.normalizedPayload.decadal.namedNativeSha.some(row => row.star === '陀罗' && row.relation === '守'));
  assert.deepEqual([data.cleanSeatMingFixedCandidate, data.cleanSeatMingFourHelpersCandidate, data[field]], [false, false, true]);
  assert.deepEqual(data.decadal.grades, [{ star: '破军', grade: '庙' }]);
  assert.deepEqual(data.decadal.namedNativeSha.map(({ star, relation }) => [star, relation]),
    [['天空', '冲'], ['地劫', '三合']]);
  assert.deepEqual(data.cleanSeatMingLucunHuaLuWitness, {
    branch: '子', stem: '癸', lucun: { star: '禄存', branch: '子' }, recipient: { star: '破军', branch: '子' },
  });
  const hit = result(run, chapterIndex('001'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '禄存、禄主');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '1994-02-09T16:00:00.000Z', endExclusive: fact.activeTo }]);
  const frame = verifiedChapterFrame(natal, fact, run.time.window.end);
  const badRecipient = structuredClone(natal);
  const seat = badRecipient.palaces.find(row => row.earthlyBranch === '子');
  const [pojun] = seat.majorStars.splice(seat.majorStars.findIndex(row => row.name === '破军'), 1);
  seat.adjectiveStars.push(pojun);
  for (const [chart, anchors] of [
    [archiveMinorInWrongLayer(natal, '禄存'), frame],
    [badRecipient, frame],
    [natal, { ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 }],
  ]) {
    const wrong = quanshuLimitChapter(chart, anchors);
    assert.equal(wrong[field], undefined);
    assert.equal(wrong.cleanSeatMingLucunHuaLuWitness, undefined);
    assert.notEqual(result({ ...run, facts: [{ ...fact, normalizedPayload: wrong }] }, chapterIndex('001')).status, 'matched');
  }
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId)).input;
  assert.match(formatFortuneFactAudit(input), /大限子宫实守本命禄存与癸年化禄的破军/u);
  assert.match(formatFortunePrompt(input), /禄存、禄主/u);
  assert.doesNotMatch(formatFortunePrompt(input), /cleanSeatMingLucunHuaLu|破军化禄|子宫/u);
});

test('p081 requires separately verified Boshi seats and two true natal Sha limits', () => {
  const cases = [
    ['1983-05-25', 4, 1989, '奏书', ['丑', '未', '巳'], '1989-02-05T16:00:00.000Z'],
    ['1980-11-09', 9, 2036, '将军', ['酉', '寅', '辰'], '2036-01-27T16:00:00.000Z'],
  ];
  const field = 'overlappingMingAnnualBoshiCandidate';
  for (const [dateStr, timeIndex, year, star, places, start] of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config });
    const natal = engine.toJSON();
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-boshi-' + year, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.decadal.branch, data.minor.branch, data.yearly.branch], places);
    assert.deepEqual(data.annualBoshiGuards, [{ star, branch: places[2] }]);
    assert.deepEqual([data[field], data.overlappingAnnualBoshiCandidate, data.overlappingMingFlyingShaCandidate],
      [true, true, star === '将军']);
    const scoped = { ...run, facts: [fact] }, hit = result(scoped, chapterIndex('002'));
    assert.equal(hit.status, 'matched');
    assert.match(hit.matchedSourceExcerpt, /太岁行至奏书[、，]?将军/u);
    assert.deepEqual(hit.windows, [{ start, endExclusive: fact.activeTo }]);
    const frame = verifiedChapterFrame(natal, fact, run.time.window.end);
    const wrongBoshi = structuredClone(natal);
    const seat = wrongBoshi.palaces.find(row => row.boshi12 === star), moved = wrongBoshi.palaces.find(row => row.index === (seat.index + 1) % 12);
    [seat.boshi12, moved.boshi12] = [moved.boshi12, seat.boshi12];
    const misplaced = quanshuLimitChapter(wrongBoshi, frame);
    const wrongMinor = quanshuLimitChapter(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
    for (const normalizedPayload of [misplaced, wrongMinor]) {
      assert.equal(normalizedPayload[field], undefined);
      const excluded = result({ ...scoped, facts: [{ ...fact, normalizedPayload }] }, chapterIndex('002'));
      assert.doesNotMatch(excluded.matchedSourceExcerpt ?? '', /太岁行至奏书[、，]?将军/u);
    }
    assert.deepEqual(misplaced.annualBoshiGuards, []);
    for (const nearby of [year - 1, year + 1]) {
      const h = engine.horoscope(nearby + '-06-01', 6), at = quanshuLunarMidnight(nearby, 1);
      const nearbyFact = quanshuLimitChapter(natal, { at, lunarYear: nearby, age: h.age.nominalAge, yearIndex: h.yearly.index,
        decadalIndex: h.decadal.index, minorIndex: h.age.index, windowEnd: at + 1000 });
      assert.equal(nearbyFact[field], false);
      assert.equal(nearbyFact.annualBoshiGuards.length, nearby === year - 1 ? 1 : 0);
    }
    const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), archive.snapshotId)).input;
    assert.ok(formatFortuneFactAudit(input).includes(`太岁实临${places[2]}宫的本命博士系${star}`));
    assert.match(formatFortunePrompt(input), /太岁行至奏书[、，]?将军/u);
    assert.doesNotMatch(formatFortunePrompt(input), /overlappingMingAnnualBoshiCandidate|[巳辰]宫(?:奏书|将军)/u);
  }
});

test('p081 verifies Ming natal taboo, annual wound or envoy, and a real minor guard in the same lunar year', () => {
  const birth = astro.withOptions({ dateStr: '1980-03-05', timeIndex: 10, gender: '女', fixLeap: true, config });
  const natal = birth.toJSON();
  const source = 'overlappingMingNatalTabooWithAnnualShangShiCandidate';
  for (const [year, annual, minor, star] of [[1993, '酉', '酉', '天伤'], [1995, '亥', '未', '天使']]) {
    const request = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), reference = { snapshotId: `ming-taboo-shangshi-${year}`, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, now, reference)));
    const submitted = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(submitted);
    const fact = chapterFacts(submitted).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const run = { ...submitted, facts: [fact] }, data = fact.normalizedPayload;
    assert.equal(data[source], true);
    assert.deepEqual(data.decadal.mingNatalJi, { star: '天相', branch: '卯', relation: '守' });
    assert.ok(data.decadal.grades.some(row => row.grade === '陷'));
    assert.notEqual(data.decadal.natalJi.relation, '守');
    assert.deepEqual(data.annualShangShiGuards, [{ star, branch: annual }]);
    assert.equal(data.minor.branch, minor);
    assert.equal(data.minor.nativeShaAtSeat, true);
    assert.equal(data.overlappingAnnualShangShiCandidate, false);
    assert.equal(data.overlappingMingFixedShaCandidate, false);
    const hit = result(run, chapterIndex('002'));
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const local = formatFortuneFactAudit(input), position = `太岁实临${annual}宫本命${star}`;
    assert.match(local, /明刊生年化忌实守大限/u);
    assert.ok(local.includes(position));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /又加流年恶杀凑合，及小限巡逢凶杀/u);
    assert.ok(!prompt.includes(position) && !prompt.includes(source));

    const h = birth.horoscope(`${year}-06-01`, 6);
    const frame = { at: Date.parse(fact.activeFrom), windowEnd: Date.parse(run.time.displayWindow.instantRange.endInstantExclusive),
      lunarYear: year, age: year - natal.rawDates.lunarDate.lunarYear + 1, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index };
    const wrong = structuredClone(natal), palace = wrong.palaces.find(row => row.earthlyBranch === annual);
    const [moved] = palace.adjectiveStars.splice(palace.adjectiveStars.findIndex(row => row.name === star), 1);
    assert.equal(moved.name, star);
    palace.minorStars.push(moved);
    const wrongYearlyGuard = quanshuLimitChapter(wrong, frame);
    const wrongMinorGuard = quanshuLimitChapter(natal, { ...frame, minorIndex: undefined });
    for (const payload of [wrongYearlyGuard, wrongMinorGuard]) {
      assert.equal(payload[source], undefined);
      assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: payload }] }, chapterIndex('002')).status, 'unknown');
    }
  }
  const year = 1994, h = birth.horoscope(`${year}-06-01`, 6);
  const neighbor = quanshuLimitChapter(natal, { at: Date.UTC(year, 5, 1), windowEnd: Date.UTC(year + 1, 0, 1),
    lunarYear: year, age: year - natal.rawDates.lunarDate.lunarYear + 1, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index });
  assert.equal(neighbor[source], false);
});

test('Ming limit chapter uses Geng Tianxiang independently from the transmitted Tiantong taboo', () => {
  const cases = [
    [5, 2021, '001', '巳', '守', '戌', '其他', 'cleanSeatMingNamedRosterCandidate', 'matched'],
    [9, 2004, '002', '卯', '其他', '卯', '守', 'overlappingMingNatalTabooAndMinorBellCandidate', 'matched'],
  ];
  for (const [hour, year, suffix, branch, transmittedRelation, mingBranch, mingRelation, flag, status] of cases) {
    const natal = native('1980-03-05', hour);
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 20), reference = { snapshotId: 'ming-geng-limit-' + suffix, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const fact = chapterFacts(run).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.equal(data.decadal.branch, branch);
    assert.equal(data.decadal.natalJi.star, '天同');
    assert.equal(data.decadal.natalJi.relation, transmittedRelation);
    assert.deepEqual(data.decadal.mingNatalJi, { star: '天相', branch: mingBranch, relation: mingRelation });
    assert.equal(data.decadal.localSourceSha, transmittedRelation === '守');
    assert.equal(data.decadal.mingLocalSourceSha, mingRelation === '守');
    assert.equal(data[flag], true);
    const evaluate = normalizedPayload => result({ ...run, facts: [{ ...fact, normalizedPayload }] }, chapterIndex(suffix));
    const match = evaluate(data);
    assert.equal(match.status, status);
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const index = at => natal.palaces.find(row => row.earthlyBranch === at).index;
    const anchors = { lunarYear: year, age: year - 1980 + 1, at: Date.parse(fact.activeFrom),
      yearIndex: index(data.yearly.branch), decadalIndex: index(branch), minorIndex: index(data.minor.branch), windowEnd: Date.parse(fact.activeTo) };
    const isMingTabooBranch = suffix === '002';
    if (isMingTabooBranch) {
      assert.equal(data.decadal.nativeShaAtSeat, false);
      assert.ok(data.decadal.grades.some(row => row.star === '天相' && row.grade === '陷'));
      assert.deepEqual(data.yearly.namedNativeSha.filter(row => row.relation === '守'), [{ star: '地劫', branch: '申', relation: '守' }]);
      assert.deepEqual(data.minor.mingFixedFireBell.filter(row => row.relation === '守'), [{ star: '铃星', branch: '戌', relation: '守' }]);
      assert.equal(data.overlappingMingNamedShaCandidate, false);
      assert.equal(data.overlappingMingAnnualFireCandidate, false);
      assert.equal(match.matchedSourceExcerpt, '又加流年恶杀凑合，及小限巡逢凶杀');
      assert.equal(evaluate({ ...data, [flag]: undefined }).status, 'partial');

      const next = calculate(chart(natal), 'year', { year: year + 1 });
      const nextFact = chapterFacts(next).find(row => row.normalizedPayload.lunarYear === year + 1);
      assert.equal(nextFact.normalizedPayload[flag], false);
      assert.equal(result({ ...next, facts: [nextFact] }, chapterIndex(suffix)).status, 'not_matched');
    } else {
      const misplaced = structuredClone(natal), injurySeat = misplaced.palaces.find(row => row.name === '仆役');
      const [injury] = injurySeat.adjectiveStars.splice(injurySeat.adjectiveStars.findIndex(row => row.name === '天伤'), 1);
      injurySeat.minorStars.push(injury);
      const withoutProof = quanshuLimitChapter(misplaced, anchors);
      assert.equal(withoutProof.cleanSeatMingFixedCandidate, true);
      assert.equal(withoutProof.cleanSeatMingNamedRosterCandidate, undefined);
      assert.equal(evaluate(withoutProof).status, 'partial');
      assert.equal(evaluate({ ...data, shangShiPlacementProof: undefined }).status, 'partial');
    }

    const wrong = structuredClone(natal), xiang = wrong.palaces.find(row => row.earthlyBranch === mingBranch);
    const [star] = xiang.majorStars.splice(xiang.majorStars.findIndex(row => row.name === '天相'), 1);
    xiang.minorStars.push(star);
    const unknown = quanshuLimitChapter(wrong, anchors);
    assert.deepEqual(unknown.decadal.mingNatalJi, { star: '天相', branch: undefined, relation: undefined });
    assert.deepEqual(unknown.decadal.natalJi, data.decadal.natalJi);
    assert.equal(unknown[flag], undefined);
    assert.equal(evaluate(unknown).status, 'unknown');

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const prompt = formatFortunePrompt(input);
    if (isMingTabooBranch) {
      const auditDetail = /大限同宫的明刊生年化忌见天相在卯宫守/u;
      assert.match(formatFortuneFactAudit(input), auditDetail);
      assert.match(prompt, /生年[^\n]*化忌/u);
      assert.doesNotMatch(prompt, auditDetail);
    }
    assert.doesNotMatch(prompt, /mingNatalJi|overlappingMingNatalTabooAndMinorBellCandidate|明刊庚干天相化忌在卯宫/u);
  }
});

test('p081-004 guards the Jielan month and both days of a late-Zi hour with verified Bell or Robbery', () => {
  const date = '2026-06-15', natal = native('1980-03-11', 1), snapshot = chart(natal);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-jielan-bell-day', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = withoutChapterHours(bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'chapter-jielan-bell-client', reference));
  validateFortuneFacts(run);
  const [day, lateZi] = chapterFacts(run), data = day.normalizedPayload;
  for (const key of ['jielanDailyShaCandidate', 'dailyShaCandidate', 'dailyFlankedShaCandidate', 'dailyGuardedTabooCandidate', 'mingOpeningShaCandidate']) {
    assert.equal(data[key], false, key);
  }
  assert.equal(data.jielanDailyFireBellCandidate, true);
  const bell = { star: '铃星', branch: '亥' };
  assert.deepEqual(data.jielanDailyFireBellWitness, {
    lunarMonth: 5, lunarDay: 1, monthBranch: '亥', dayBranch: '亥', productDayBranch: '亥',
    monthFireBell: [bell], dayFireBell: [bell], monthSha: [], daySha: [],
  });
  assert.equal(data.monthly.mingFireBellAtSeat, false);
  assert.equal(lateZi.normalizedPayload.jielanDailyFireBellCandidate, true);
  assert.deepEqual(lateZi.normalizedPayload.jielanDailyFireBellWitness, {
    ...data.jielanDailyFireBellWitness,
    lateZiAlternative: { lunarDay: 2, dayBranch: '子', daySha: [{ star: '地劫', branch: '子', relation: '守' }], dayFireBell: [] },
  });
  const hit = result(run, chapterIndex('004'));
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [day.factId, lateZi.factId]);
  assert.deepEqual(hit.windows, [{ start: '2026-06-14T16:00:00.000Z', endExclusive: '2026-06-15T16:00:00.000Z' }]);
  for (const profile of ['jielanFireBellProfile', 'jielanDayProfile']) {
    const wrong = { ...day, normalizedPayload: { ...data, [profile]: 'unverified' } };
    assert.equal(result({ ...run, facts: [wrong] }, chapterIndex('004')).status, 'not_matched');
  }
  const previous = calculate(snapshot, 'day', { date: '2026-06-14' });
  const [previousDay, monthBoundary] = chapterFacts(previous);
  assert.equal(previousDay.normalizedPayload.jielanDailyFireBellCandidate, false);
  assert.equal(monthBoundary.normalizedPayload.jielanDailyFireBellCandidate, undefined);
  assert.equal(monthBoundary.normalizedPayload.jielanDailyFireBellWitness, undefined);
  const next = calculate(snapshot, 'day', { date: '2026-06-16' });
  const nextWitness = chapterFacts(next)[0].normalizedPayload.jielanDailyFireBellWitness;
  assert.deepEqual([nextWitness.monthFireBell, nextWitness.dayFireBell, nextWitness.daySha], [[bell], [], [
    { star: '地劫', branch: '子', relation: '守' },
  ]]);
  const local = calculate(snapshot, 'day', { date });
  const localDay = chapterFacts(local)[0];
  const raw = local.rawFacts.find(row => localDay.sourceFactIds.includes(row.rawFactId) && row.payload?.anchors);
  assert.ok(raw);
  assert.equal(quanshuLimitChapter(natal, { ...raw.payload.anchors, minorIndex: undefined }).jielanDailyFireBellCandidate, undefined);
  const incomplete = structuredClone(natal), seat = incomplete.palaces.find(row => row.earthlyBranch === '亥');
  seat.minorStars = seat.minorStars.filter(row => row.name !== '铃星');
  assert.equal(quanshuLimitChapter(incomplete, raw.payload.anchors).jielanDailyFireBellCandidate, undefined);

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chapter-jielan-bell-day'));
  assert.match(formatFortuneFactAudit(input), /《捷览》按生年与生时安火铃.*月宫实守煞曜.*铃星在亥宫守.*日宫实守煞曜.*铃星在亥宫守/u);
  assert.match(formatFortuneFactAudit(input), /子初换日另取农历第2日，流日宫在子宫.*地劫在子宫守/u);
  assert.doesNotMatch(formatFortunePrompt(input), /《捷览》按生年与生时安火铃|jielanDailyFireBellWitness|子初换日另取/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
});

test('p081-004 verifies each regular lunar month of a shared late Zi hour before confirming its candidate', () => {
  const date = '2028-03-25', natal = native('1980-03-11', 1);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T03:00:00Z'), reference = { snapshotId: 'chapter-jielan-late-zi-rollover', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const [day, lateZi] = chapterFacts(run);
  assert.equal(lateZi.activeFrom, '2028-03-25T15:00:00.000Z');
  assert.equal(lateZi.activeTo, '2028-03-25T16:00:00.000Z');
  const proof = lateZi.normalizedPayload.jielanDailyFireBellWitness;
  assert.deepEqual([proof.lunarMonth, proof.lunarDay, proof.monthBranch, proof.dayBranch], [2, 30, '戌', '卯']);
  assert.deepEqual(proof.monthSha.map(row => row.star), ['天空']);
  assert.deepEqual(proof.dayFireBell.map(row => row.star), ['火星']);
  const next = proof.lateZiAlternative;
  assert.deepEqual([next.lunarMonth, next.lunarDay, next.monthBranch, next.dayBranch], [3, 1, '亥', '亥']);
  assert.deepEqual(next.monthFireBell, [{ star: '铃星', branch: '亥' }]);
  assert.deepEqual(next.dayFireBell, next.monthFireBell);
  assert.equal(day.normalizedPayload.jielanDailyFireBellWitness.lateZiAlternative, undefined);
  const single = { ...run, facts: [lateZi] }, match = result(single, chapterIndex('004'));
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.windows, [{ start: lateZi.activeFrom, endExclusive: lateZi.activeTo }]);
  const { input } = buildFortuneModelContext(single, interpretFortune(single, requestForFortuneRun(single), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /子初换日也进入农历第3月，斗君月宫在亥宫.*铃星在亥宫守/u);
  assert.doesNotMatch(formatFortunePrompt(input), /子初换日也进入|lateZiAlternative/u);
  const calendarDay = calculate(reference.chart, 'day', { date: '2028-03-26' });
  const nextDay = chapterFacts(calendarDay)[0].normalizedPayload.jielanDailyFireBellWitness;
  assert.deepEqual([nextDay.lunarMonth, nextDay.lunarDay, nextDay.monthBranch, nextDay.dayBranch], [3, 1, '亥', '亥']);

  const hours = chapterHours(run), midnightHour = hours.find(row => row.activeFrom === day.activeFrom);
  const opening = midnightHour?.normalizedPayload.jielanHourWitness;
  assert.equal(opening?.hourBranch, '子');
  assert.equal(opening?.civil.branch, '卯');
  assert.equal(midnightHour.activeTo, '2028-03-24T17:00:00.000Z');
  assert.equal(opening?.ziStart, undefined);
  const ordinaryHour = hours.find(row => row.normalizedPayload.jielanHourWitness.hourBranch !== '子');
  assert.ok(ordinaryHour);
  const ordinary = ordinaryHour.normalizedPayload.jielanHourWitness;
  const branches = '子丑寅卯辰巳午未申酉戌亥', index = branches.indexOf(ordinary.hourBranch);
  const ordinaryStart = Date.parse(day.activeFrom) + (2 * index - 1) * 3_600_000;
  assert.equal(ordinary.civil.branch, branches[(branches.indexOf('卯') + index) % 12]);
  assert.equal(ordinaryHour.activeFrom, new Date(ordinaryStart).toISOString());
  assert.equal(ordinaryHour.activeTo, new Date(ordinaryStart + 7_200_000).toISOString());
  assert.equal(ordinary.ziStart, undefined);
  const lastHour = hours.find(row => row.activeFrom === lateZi.activeFrom);
  const last = lastHour?.normalizedPayload.jielanHourWitness;
  assert.ok(last);
  assert.deepEqual([last.hourBranch, last.civil.dayBranch, last.civil.branch, last.ziStart.dayBranch, last.ziStart.branch],
    ['子', '卯', '卯', '亥', '亥']);
  assert.deepEqual(last.civil.guards.map(row => row.star), ['火星']);
  assert.deepEqual(last.ziStart.guards.map(row => row.star), ['铃星']);
  const tail = { ...run, facts: [lastHour] };
  const confirmed = result(tail, chapterIndex('004'));
  assert.equal(confirmed.status, 'matched');
  assert.deepEqual(confirmed.windows, [{ start: lateZi.activeFrom, endExclusive: lateZi.activeTo }]);
  const { input: hourInput } = buildFortuneModelContext(tail, interpretFortune(tail, requestForFortuneRun(tail), reference.snapshotId));
  assert.match(formatFortuneFactAudit(hourInput), /午夜换日口径以卯宫的流日宫起子时.*火星.*子初换日口径以亥宫的流日宫起子时.*铃星/u);
  const provider = formatFortunePrompt(hourInput);
  assert.match(provider, /从流日宫起子时逐时辰顺排/u);
  assert.doesNotMatch(provider, /午夜换日口径以卯宫|jielanHourWitness|23:00/u);

  const disagreement = calculate(reference.chart, 'day', { date: '2026-06-14' });
  assert.equal(chapterHours(disagreement).some(row => row.activeFrom === '2026-06-14T15:00:00.000Z'), false);
  const week = calculate(reference.chart, 'week', { weekStartDate: '2028-03-20' });
  const weekly = chapterHours(week).find(row => row.activeFrom === lastHour.activeFrom);
  assert.equal(weekly?.activeTo, lastHour.activeTo);
  assert.deepEqual(weekly?.normalizedPayload.jielanHourWitness, last);
});

test('p081-004 does not join a monthly guard to a taboo occupying the separate daily seat', () => {
  const run = calculate(chart(native('1990-05-05', 0)), 'day', { date: '2024-08-07' });
  const [day, lateZi] = chapterFacts(run), data = day.normalizedPayload;
  assert.deepEqual([data.monthly.branch, data.monthly.nativeShaAtSeat], ['未', true]);
  assert.deepEqual([data.daily.branch, data.daily.nativeShaAtSeat, data.daily.natalJi.relation], ['戌', false, '守']);
  assert.equal(data.dailyGuardedTabooCandidate, false);
  assert.deepEqual(data.guardedTabooWitnesses, []);
  assert.equal(data.jielanDailyFireBellCandidate, false);
  assert.equal(lateZi.normalizedPayload.jielanDailyFireBellCandidate, false);
  assert.equal(result(run, chapterIndex('004')).status, 'not_matched');
});

test('Ren source birth transformations remain Tianfu Ke at its actual palace, never a copied default Left Assistant', () => {
  const natal = native('1992-05-05', 2);
  const palace = natal.palaces.find(p => p.majorStars.some(s => s.name === '天府'));
  const condition = quanshuPalaceCondition(natal, palace.index, '财帛');
  assert.equal(condition.ready, true); assert.ok(condition.localNatalTransformations.includes('科:天府'));
  assert.ok(!condition.localNatalTransformations.includes('科:左辅'));
});

test('reviewed legacy rows retain their source hashes and a complete real match reaches natural-language model input', () => {
  for (const index of [0, 1, 2, 5, 6, 9, 10, 11, 12, 13, 14, 17, chapterIndex('004')]) {
    const rule = fortuneKnowledge.ziwei.rules[index], entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.ok(rule.queries.length > 0);
    const complete = index === 5 || ['p154000-001', 'p157000-001'].some(suffix => rule.knowledgeId.endsWith('zhuxing-wenda-' + suffix));
    assert.equal(rule.unresolved.length === 0, complete, entry.id);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
  assert.match(fortuneKnowledge.ziwei.rules[2].unresolved.join(), /提前量/u);
  const run = realRun(), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'quanshu-prompt'));
  const finding = input.sections.flatMap(s => s.findings).find(f => f.knowledgeId === fortuneKnowledge.ziwei.rules[5].knowledgeId);
  assert.ok(finding); const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命命宫在卯，迁移宫在酉/u); assert.match(prompt, /流年擎羊在酉宫/u);
  assert.match(prompt, /流年又遇流羊流陀/u);
  for (const machine of ['quanshu_', 'qingyangBranch', 'sourceQualities', 'tableVersion', 'natalBasis', 'quanshu-run']) assert.ok(!prompt.includes(machine), machine);
});
