import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { quanshuVerseSeat, quanshuVersePolicy } = await import('./control/ziwei-verse-seats.ts');
const { quanshuLimitPhase, quanshuLunarMidnight, quanshuLuYangTuo, quanshuPalaceRelation } = await import('./control/ziwei-quanshu.ts');
const { readQuanshuArchivedFireBell } = await import('./control/ziwei-firebell-positions.ts');
const { quanshuFireBellCondition } = await import('./control/ziwei-firebell.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitTiming } = await import('./control/ziwei-limit-timing.ts');
const { quanshuTransformLimits } = await import('./control/ziwei-transform-limits.ts');
const { quanshuSolarWuPoLimits, quanshuSolarWuPoPolicy } = await import('./control/ziwei-solar-wu-po-limits.ts');
const { quanshuTimedWu, quanshuTimedPo } = await import('./control/ziwei-timed-limit-conditions.ts');
const { bindQuanshuYearScopes } = await import('./control/ziwei-source-year.ts');
const { buildZiweiFactWindow } = await import('./control/ziwei-flows.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-verse-reference.json', import.meta.url)));
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const native = e => astro.withOptions({ ...e, fixLeap: true, config }).toJSON();
const all = p => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars];
const position = (n, star) => n.palaces.find(p => all(p).some(s => s.name === star));
const chart = n => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] }, ziwei: {
  engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [n],
} });
const ids = ref.passages.map(row => row.knowledgeId);
const cache = new Map();
function runFor(e) {
  const key = [e.dateStr, e.timeIndex, e.gender, e.year].join(':');
  if (!cache.has(key)) {
    const input = { periodType: 'year', targetPeriod: { year: e.year }, displayTimezone: 'Asia/Shanghai' };
    cache.set(key, calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse(`${e.year}-11-19T03:00:00Z`), 'server'),
      'verse-private-run', { snapshotId: 'verse-private-snapshot', chart: chart(native(e)) }));
  }
  return cache.get(key);
}
const ownFacts = run => run.facts.filter(f => f.factType === 'quanshu_firebell_context');
const ownMatch = (run, i) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === ids[i]);
const branchFactType = 'quanshu_solar_wu_po_limits';
const timedSolarFact = row => row.factType === 'quanshu_timed_limit_condition'
  && row.normalizedPayload.sourceFactType === branchFactType;
const timedWuFact = row => timedSolarFact(row) && row.normalizedPayload.star === '武曲';
const timedPoFact = row => timedSolarFact(row) && row.normalizedPayload.star === '破军';
function timedWu(run, fact) {
  return run.facts.filter(row => timedWuFact(row)
    && row.normalizedPayload.lunarYear === fact.normalizedPayload.lunarYear && row.normalizedPayload.activeInSourceHalf === true);
}
const branchExample = (e, run = runFor(e)) => {
  const lunarYear = e.lunarYear ?? e.year;
  const facts = run.facts.filter(f => (f.factType !== branchFactType && !timedSolarFact(f)) || f.normalizedPayload.lunarYear === lunarYear);
  const fact = facts.find(f => f.factType === branchFactType);
  assert.ok(fact, String(lunarYear));
  return { run: { ...run, facts }, fact, data: fact.normalizedPayload };
};
const natalAndFrame = e => {
  const archive = astro.withOptions({ ...e, fixLeap: true, config });
  const h = archive.horoscope(e.year + '-06-01', 6);
  return { natal: archive.toJSON(), frame: { lunarYear: e.year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index } };
};
const removeStar = (natal, name) => {
  for (const palace of natal.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[key] = palace[key].filter(row => row.name !== name);
  }
};
function submittedCompleteBirth(example) {
  const { dateStr, timeIndex, year } = example;
  const hour = String(timeIndex * 2).padStart(2, '0');
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1);
  const archive = { snapshotId: 'verse-complete-' + dateStr + '-' + timeIndex, chart: chart(native(example)) };
  archive.chart.birthContext = { birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(), precision: 'minute',
    latitude: 31.2304, longitude: 121.4737, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  return branchExample(example, run);
}
const relation = (from, to) => {
  const d = (branches.indexOf(to) - branches.indexOf(from) + 12) % 12;
  return d === 0 ? '守' : d === 6 ? '冲' : [4, 8].includes(d) ? '三合' : [1, 11].includes(d) ? '邻宫' : '其他';
};

test('all 36 verse seat cells retain volume II wording and missing Po Jun cells without borrowing summary or engine values', () => {
  for (const [star, expected] of Object.entries(ref.grades)) for (const [i, branch] of branches.entries()) {
    assert.equal(quanshuVerseSeat(star, branch).verseGrade, expected[i] ?? undefined, star + branch);
  }
  assert.equal(quanshuVerseSeat('太阳', '午').summaryGrade, '旺');
  assert.equal(quanshuVerseSeat('太阳', '丑').summaryGrade, undefined);
  assert.equal(quanshuVerseSeat('破军', '巳').summaryGrade, undefined);
  assert.equal(quanshuVerseSeat('武曲', '巳').gradeAgreement, false); // 和平 vs 平, not silently normalized.
  assert.equal(quanshuVerseSeat('武曲', '子').verseGrade, '旺');
  assert.throws(() => quanshuVerseSeat('太阳', '未知')); assert.throws(() => quanshuVerseSeat('天府', '子'));
});

test('volume I named solar phases remain distinct from brightness and an unverified reading of the darkness verse', () => {
  for (const [branch, expected] of Object.entries(ref.solarPhases)) assert.equal(quanshuVerseSeat('太阳', branch).solarPhase, expected ?? undefined);
  assert.equal(quanshuVerseSeat('太阳', '未').verseGrade, '得地'); assert.equal(quanshuVerseSeat('太阳', '未').solarPhase, '偏垣');
  assert.equal(quanshuVerseSeat('太阳', '丑').verseGrade, '陷'); assert.equal(quanshuVerseSeat('太阳', '丑').solarPhase, undefined);
  assert.match(quanshuVersePolicy.solarPhase, /not-poem-darkness-definition/u);
});

test('real star and auxiliary positions bind to the subject, focus, other limit and annual palace separately', () => {
  const e = ref.examples.wuMinor, n = native(e), input = { start: Date.parse('2026-01-01T00:00:00+08:00'), end: Date.parse('2027-01-01T00:00:00+08:00') };
  const result = buildZiweiFactWindow(input, 'year', chart(n));
  for (const interval of bindQuanshuYearScopes(result.candidates[0].scopes)) {
    const p = quanshuFireBellCondition(n, interval.focus.output.index, interval.year.output.index, interval.year.lunarYear,
      interval.focus.scope, interval.decadal?.output.index, interval.minor?.output.index);
    assert.equal(p.verseReady, true);
    for (const row of p.verseSubjects) {
      assert.equal(row.branch, position(n, row.star).earthlyBranch);
      assert.equal(row.focusRelation, relation(p.branch, row.branch));
      assert.equal(row.otherRelation, p.verseOtherBranch ? relation(p.verseOtherBranch, row.branch) : undefined);
      assert.equal(row.annualRelation, relation(p.annualBranch, row.branch));
      for (const aux of row.auxiliaryRelations) if (aux.star !== '魁钺组') {
        assert.equal(aux.branch, position(n, aux.star).earthlyBranch);
        assert.equal(aux.relation, relation(row.branch, aux.branch));
      }
      assert.equal(row.auxiliaryRelations.filter(v => v.star === '魁钺组').length, 2);
      assert.equal(row.fourShaRelations.length, 4); assert.equal(row.natalTransformations.length, 4);
      assert.ok(row.fourShaRelations.filter(v => ['火星', '铃星'].includes(v.star)).every(v => v.coordinateBasis === 'archive_product_hour'));
    }
  }
});

test('changing archive brightness cannot change verse grades and absent partner does not become a negative relation', () => {
  const n = native(ref.examples.wuMinor), p = position(n, '武曲');
  all(p).find(s => s.name === '武曲').brightness = '陷';
  const row = quanshuFireBellCondition(n, p.index, 4, 2026, 'minor', undefined, p.index);
  assert.equal(row.verseWuquTempleAtFocus, true); assert.equal(row.verseOtherBranch, undefined);
  assert.ok(row.verseSubjects.every(v => v.otherRelation === undefined));
});

test('unverified auxiliaries keep verse premises unknown while existing firebell facts remain available', () => {
  for (const mode of ['missing', 'duplicate', 'moved']) {
    const n = native(ref.examples.wuMinor), p = position(n, '文昌'), star = all(p).find(s => s.name === '文昌');
    if (mode !== 'duplicate') for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) p[key] = p[key].filter(s => s.name !== '文昌');
    if (mode !== 'missing') n.palaces[(p.index + 1) % 12].minorStars.push(star);
    const row = quanshuFireBellCondition(n, 4, 4, 2026, 'yearly');
    assert.equal(row.ready, true); assert.equal(row.verseReady, undefined); assert.equal(row.verseSubjects, undefined);
    assert.equal(row.verseWuquTempleAtFocus, undefined);
  }
});

test('Sun uses one guarded limit then screens independently for fallen Sha and same-fragment taboo contacts', () => {
  const clear = branchExample(ref.branchExamples.sunClear), match = ownMatch(clear.run, 0);
  assert.equal(clear.data.sun.minorRelation, '守');
  assert.notEqual(clear.data.sun.decadalRelation, '守');
  assert.equal(clear.data.sunHarmoniousCandidate, true);
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.includes(clear.fact.factId));
  assert.ok(clear.fact.sourceFactIds.length >= 2);
  validateFortuneFacts(runFor(ref.branchExamples.sunClear));

  const taboo = branchExample(ref.branchExamples.sunTaboo);
  assert.equal(taboo.data.sunFallenShaCandidate, false);
  assert.equal(taboo.data.sunTabooShaCandidate, true);
  assert.ok(taboo.data.sunTaboos.some(row => row.layer === 'yearly' && row.star === '文昌' && row.branch === '戌' && row.relation === '三合'));
  assert.equal(ownMatch(taboo.run, 0).status, 'not_matched');

  const fallen = branchExample(ref.branchExamples.sunFallen);
  assert.equal(fallen.data.sun.verseGrade, '陷');
  assert.equal(fallen.data.sunFallenShaCandidate, true);
  assert.equal(ownMatch(fallen.run, 0).status, 'not_matched');
});

test('Sun screens actual Sha and Ji using Ming fixed coordinates while preserving the archive comparison', () => {
  for (const [dateStr, timeIndex, year, branch, grade, accepted] of [
    ['1974-02-05', 5, 1986, '辰', '旺', true],
    ['1986-02-28', 7, 1999, '卯', '庙', false],
  ]) {
    const { run, fact, data } = submittedCompleteBirth({ dateStr, timeIndex, year, gender: '女' });
    assert.equal(data.quanshuFixedFireBellProfile, 'quanshu-nanyangtang-fixed-firebell-v1');
    assert.deepEqual([data.sun.branch, data.sun.verseGrade, data.sun.minorRelation], [branch, grade, '守']);
    assert.deepEqual([data.sunHarmoniousCandidate, data.sunMingFixedHarmoniousCandidate], [!accepted, accepted]);
    assert.deepEqual([data.sunTabooShaCandidate, data.sunMingFixedTabooShaCandidate], [accepted, !accepted]);
    assert.ok(data.sunTaboos.some(row => row.relation === '守'));
    const archiveBell = data.sunHazards.find(row => row.star === '归档铃星');
    const mingBell = data.sunMingFixedHazards.find(row => row.star === '铃星');
    assert.deepEqual([archiveBell.branch, archiveBell.relation], accepted ? ['申', '三合'] : ['戌', '其他']);
    assert.deepEqual([mingBell.branch, mingBell.relation], accepted ? ['卯', '邻宫'] : ['卯', '守']);
    const hit = ownMatch(run, 0);
    assert.equal(hit.status, accepted ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, accepted ? [fact.factId] : []);
    assert.deepEqual(hit.windows, accepted ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-sun-relations'));
    const auditReading = accepted ? /按南阳堂明刊火铃定宫核验/u : /按明刊定宫，本段太阳另见陷地或加忌并见煞曜/u;
    assert.match(formatFortuneFactAudit(input), auditReading);
    assert.doesNotMatch(formatFortunePrompt(input), auditReading);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
    if (accepted) {
      const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
      assert.equal(ownMatch({ ...run, facts: [wrong] }, 0).status, 'not_matched');
      const { natal, frame } = natalAndFrame({ dateStr, timeIndex, year, gender: '女' });
      const withSunAtWrongLayer = structuredClone(natal), palace = position(withSunAtWrongLayer, '太阳');
      const [sun] = palace.majorStars.splice(palace.majorStars.findIndex(row => row.name === '太阳'), 1);
      palace.adjectiveStars.push(sun);
      const evaluate = normalizedPayload => ownMatch({ ...run, facts: [{ ...fact, normalizedPayload }] }, 0);
      const displaced = quanshuSolarWuPoLimits(quanshuLimitBranches(withSunAtWrongLayer, frame),
        quanshuTransformLimits(withSunAtWrongLayer, frame));
      assert.equal(displaced.sun.branch, undefined);
      assert.equal(displaced.sourceMinor.verified, true);
      assert.equal(displaced.sunMingFixedHarmoniousCandidate, undefined);
      assert.equal(evaluate(displaced).status, 'unknown');
      const wrongDecade = { ...frame, decadalIndex: frame.minorIndex };
      const retainedMinor = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, wrongDecade), quanshuTransformLimits(natal, wrongDecade));
      assert.equal(retainedMinor.sourceDecadal.verified, false);
      assert.equal(retainedMinor.sun.decadalRelation, undefined);
      assert.equal(retainedMinor.sun.minorRelation, '守');
      assert.equal(evaluate(retainedMinor).status, 'partial');
      const { starPlacementProof, limitPlacementProof, ...older } = data;
      assert.equal(starPlacementProof, 'quanshu-nanyangtang-major-layer-v1');
      assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
      assert.equal(evaluate(older).status, 'unknown');
    }
  }
});

test('the Ming Sun relationship clause confirms both verified limits at one bright, screened Sun', () => {
  const example = { dateStr: '1990-02-15', timeIndex: 0, gender: '男', year: 2000 };
  const { run, fact, data } = submittedCompleteBirth(example);
  assert.equal(data.sunMingBrightDoubleGuardCandidate, true);
  assert.deepEqual([data.sun.decadalRelation, data.sun.minorRelation], ['守', '守']);
  const witness = data.sunMingBrightDoubleGuardWitness;
  assert.deepEqual([witness.branch, witness.grade], ['寅', '旺']);
  assert.equal(witness.hazards.length, 8);
  assert.equal(witness.taboos.length, 4);
  assert.ok([...witness.hazards, ...witness.taboos].every(row => row.branch && ['邻宫', '其他'].includes(row.relation)));
  const result = ownMatch(run, 0);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '婚姻和合');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
  assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bright-sun-two-guarding-limits'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同一岁限片段的大限、小限均实守卷二明列庙旺的本命太阳/u);
  assert.match(formatFortuneFactAudit(input), /大限、小限实守寅宫旺太阳/u);
  assert.doesNotMatch(prompt, /添嗣续|sunMingBrightDoubleGuardWitness|寅宫旺太阳/u);

  const sameChart = { ...example, year: 2001 };
  const nearby = natalAndFrame(sameChart);
  const neighboring = quanshuSolarWuPoLimits(quanshuLimitBranches(nearby.natal, nearby.frame),
    quanshuTransformLimits(nearby.natal, nearby.frame));
  assert.equal(neighboring.sunMingBrightDoubleGuardCandidate, false);
  const single = { ...fact, normalizedPayload: neighboring };
  assert.notEqual(ownMatch({ ...run, facts: [single] }, 0).status, 'matched');

  const { natal, frame } = natalAndFrame(example);
  const blade = position(natal, '擎羊'), [sheep] = blade.minorStars.splice(blade.minorStars.findIndex(row => row.name === '擎羊'), 1);
  blade.adjectiveStars.push(sheep);
  const unknown = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
  assert.equal(unknown.sunMingBrightDoubleGuardCandidate, undefined);
  assert.equal(ownMatch({ ...run, facts: [{ ...fact, normalizedPayload: unknown }] }, 0).status, 'partial');
});

test('the same Sun can meet two distinct aspecting limits, with taboo and Sha screened in its own palace', () => {
  const birth = { dateStr: '1978-01-05', gender: '女' };
  const cases = [
    [2009, 1, '丑', '亥', '未', '冲', '三合'],
    [2021, 1, '卯', '亥', '未', '三合', '三合'],
    [2018, 3, '子', '寅', '申', '三合', '冲'],
  ];
  for (const [year, timeIndex, decadal, minor, sun, decadalRelation, minorRelation] of cases) {
    const example = { ...birth, year, timeIndex };
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 15), archive = { snapshotId: 'sun-two-limits-' + year, chart: chart(native(example)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const submitted = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(submitted);
    const { run, fact, data } = branchExample(example, submitted);
    assert.deepEqual([data.decadalBranch, data.minorBranch, data.sun.branch], [decadal, minor, sun]);
    assert.deepEqual([data.sun.decadalRelation, data.sun.minorRelation], [decadalRelation, minorRelation]);
    assert.equal(data.sunHarmoniousCandidate, false);
    assert.equal(data.sunTwoLimitAspectCandidate, true);
    const match = ownMatch(run, 0);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sun-two-limits'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(`大限在${decadal}宫，小限在${minor}宫，分别以${decadalRelation}、${minorRelation}照${sun}宫的同一颗太阳`));
    assert.doesNotMatch(prompt, /sunTwoLimitAspectCandidate/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
    if (year === 2009) {
      const { natal, frame } = natalAndFrame(example);
      const decade = natal.palaces.find(row => row.index === frame.decadalIndex).decadal;
      const age = year - natal.rawDates.lunarDate.lunarYear + 1;
      const shift = decade.range[1] === age ? 1 : -1;
      decade.range = decade.range.map(value => value + shift);
      assert.equal(quanshuLimitPhase(natal, frame.decadalIndex, age, quanshuLunarMidnight(year, 1)).ready, true);
      const changed = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
      assert.deepEqual(changed.sourceDecadal, { branch: decadal, verified: false });
      assert.equal(changed.sun.decadalRelation, undefined);
      assert.equal(changed.sun.minorRelation, minorRelation);
      assert.equal(changed.sunMingFixedTwoLimitAspectCandidate, undefined);
      assert.equal(ownMatch({ ...run, facts: [{ ...fact, normalizedPayload: changed }] }, 0).status, 'unknown');
    }
  }

  const blocked = branchExample({ ...birth, year: 1986, timeIndex: 0 });
  assert.deepEqual([blocked.data.sun.decadalRelation, blocked.data.sun.minorRelation], ['冲', '三合']);
  assert.ok(blocked.data.sunTaboos.some(row => row.layer === 'natal' && row.star === '巨门' && row.branch === '戌' && row.relation === '三合'));
  assert.ok(blocked.data.sunHazards.some(row => row.star === '归档铃星' && row.branch === '戌' && row.relation === '三合'));
  assert.ok(blocked.data.sunTabooShaSharedPalaces.some(row => row.layer === 'natal' && row.star === '巨门'
    && row.sha === '归档铃星' && row.branch === '戌'));
  assert.equal(blocked.data.sunTwoLimitAspectCandidate, false);
  assert.equal(ownMatch(blocked.run, 0).status, 'not_matched');

  const sameSeat = branchExample({ ...birth, year: 2006, timeIndex: 0 });
  assert.equal(sameSeat.data.decadalBranch, sameSeat.data.minorBranch);
  assert.deepEqual([sameSeat.data.sun.decadalRelation, sameSeat.data.sun.minorRelation], ['三合', '三合']);
  assert.equal(sameSeat.data.sunTwoLimitAspectCandidate, false);
  assert.equal(ownMatch(sameSeat.run, 0).status, 'not_matched');

  const { natal, frame } = natalAndFrame({ ...birth, year: 2009, timeIndex: 1 });
  const wrongFrame = quanshuTransformLimits(natal, { ...frame, lunarYear: frame.lunarYear + 12 });
  assert.equal(wrongFrame.ready, true);
  assert.equal(quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), wrongFrame).sunTwoLimitAspectCandidate, undefined);
});

test('complete Sun charts retain shared and separate archive witnesses when the Ming reading differs', () => {
  const base = { dateStr: '1978-01-05', gender: '女' };
  const shared = submittedCompleteBirth({ ...base, timeIndex: 0, year: 1986 });
  const separated = submittedCompleteBirth({ ...base, timeIndex: 4, year: 2028 });
  for (const example of [shared, separated]) {
    assert.equal(example.data.sun.guarded, false);
    assert.equal(example.data.sunTabooShaCandidate, true);
  }
  assert.equal(shared.data.sunMingFixedTabooShaCandidate, true);
  assert.equal(ownMatch(shared.run, 0).status, 'not_matched');
  assert.equal(separated.data.sunMingFixedTabooShaCandidate, false);
  assert.equal(separated.data.sunMingFixedTwoLimitAspectCandidate, true);
  assert.equal(ownMatch(separated.run, 0).status, 'partial');
  const { input } = buildFortuneModelContext(shared.run, interpretFortune(shared.run, requestForFortuneRun(shared.run), 'sun-shared-seat'));
  assert.match(formatFortuneFactAudit(input), /巨门与归档铃星实居戌宫/u);
  assert.deepEqual(separated.data.sunTabooShaSharedPalaces, []);
  const splitText = describeFortuneFact({ method: 'ziwei', type: branchFactType, data: separated.data }, String);
  assert.match(splitText, /同段见到分层化忌的候选及具名煞曜/u);
  assert.doesNotMatch(splitText, /实居.*宫/u);
});

test('temple Wu Qu separates original support geometry, neighboring Chang and the base branch in SQLite', () => {
  for (const [example, relation, expectedChang] of [[ref.examples.wuMinor, '三合', true], [ref.branchExamples.wuNearChang, '邻宫', false],
    [ref.branchExamples.wuPlain, '其他', false]]) {
    const { run, fact, data } = branchExample(example), match = ownMatch(run, 1);
    assert.equal(data.wu.verseGrade, '庙');
    assert.equal(data.wuChang.relation, relation);
    assert.equal(data.wuTempleChangCandidate, expectedChang);
    assert.equal(data.wuTempleChangNeighborCandidate, relation === '邻宫');
    assert.equal(data.wuTemplePlainCandidate, relation === '其他');
    const active = timedWu(run, fact);
    assert.equal(match.status, relation === '其他' ? 'not_matched' : 'matched');
    assert.equal(match.matchedSourceExcerpt, relation === '其他' ? undefined : '武曲临限化权星');
    assert.deepEqual(match.sourceFactIds, active.map(row => row.factId));
    if (relation === '三合') assert.equal(data.wu.minorRelation, '守');
    if (relation === '邻宫') {
      assert.ok(data.wuAssistants.every(row => row.relation === '其他' && row.changRelation === '三合'));
      assert.equal(data.wuTempleChangAssistantsCandidate, false);
      assert.ok(active.every(row => row.normalizedPayload.wuTempleAtVerifiedLimitCandidate
        && row.normalizedPayload.wuTempleChangNeighborCandidate && !row.normalizedPayload.wuTempleChangCandidate));
    }
  }
});

test('the temple Wu Qu foundation confirms both verified northern limit halves in their common window', () => {
  const sample = { dateStr: '1990-05-05', timeIndex: 3, gender: '男', year: 2014 };
  const { run, fact, data } = submittedCompleteBirth(sample);
  assert.deepEqual([data.wu.branch, data.wu.verseGrade, data.wu.decadalRelation, data.wu.minorRelation], ['辰', '庙', '守', '守']);
  assert.deepEqual([data.wuChang.branch, data.wuChang.relation], ['未', '其他']);
  assert.equal(data.wuTemplePlainCandidate, true);
  const slices = run.facts.filter(timedWuFact);
  const active = slices.filter(row => row.normalizedPayload.guardScopes.length === 2);
  assert.equal(active.length, 1);
  assert.deepEqual(active[0].normalizedPayload.guardScopes, ['decadal', 'minor']);
  const boundary = new Date(quanshuLunarMidnight(sample.year, 7)).toISOString();
  assert.equal(active[0].activeTo, boundary);
  const evaluate = facts => ownMatch({ ...run, facts }, 1);
  const hit = evaluate(slices);
  assert.equal(hit.status, 'matched');
  const authority = slices.filter(row => row.normalizedPayload.wuNatalQuanAtActiveLimitCandidate === true);
  assert.equal(hit.matchedSourceExcerpt, '若还入庙主财兴\n武曲临限化权星');
  assert.deepEqual(hit.sourceFactIds, authority.map(row => row.factId));
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: authority.at(-1).activeTo }]);
  assert.ok(authority.some(row => row.activeFrom === boundary && row.normalizedPayload.guardScopes.join() === 'decadal'));
  const later = slices.filter(row => row.activeFrom >= boundary);
  assert.ok(later.length > 0);
  assert.ok(later.every(row => row.normalizedPayload.guardScopes.length < 2));
  assert.equal(evaluate(later).matchedSourceExcerpt, '武曲临限化权星');
  const selected = { ...run, facts: [fact, ...slices] };
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'temple-wu-double-guard'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /复核大小限在同一时段都实守辰、戌、丑或未宫的入庙武曲/u);
  assert.match(prompt, /若还入庙主财兴/u);
  assert.doesNotMatch(prompt, /wuTempleAtVerifiedLimitCandidate|武曲在辰宫|更加文昌临左右/u);

  const { natal, frame } = natalAndFrame(sample);
  const wrong = { ...frame, age: sample.year - natal.rawDates.lunarDate.lunarYear + 1, minorIndex: (frame.minorIndex + 1) % 12 };
  const limits = quanshuLimitBranches(natal, wrong);
  const context = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(natal, wrong));
  const window = { start: Date.parse(active[0].activeFrom), end: Date.parse(active[0].activeTo) };
  const timed = quanshuTimedWu(quanshuLimitTiming(natal, limits, window, wrong)[0].data, context);
  assert.deepEqual(timed.guardScopes, ['decadal']);
  assert.equal(evaluate([{ ...active[0], normalizedPayload: timed }]).matchedSourceExcerpt, '武曲临限化权星');
});

test('Ming Wu Qu verifies Chang and both named assistants on the same actual northern double limit', () => {
  const sample = { dateStr: '1950-11-17', timeIndex: 9, gender: '女', year: 1965 };
  const { run, fact, data } = submittedCompleteBirth(sample);
  assert.deepEqual([data.wu.branch, data.wu.verseGrade, data.wu.decadalRelation, data.wu.minorRelation], ['丑', '庙', '守', '守']);
  assert.deepEqual(data.wuChang, { star: '文昌', branch: '丑', relation: '守' });
  assert.deepEqual(data.wuAssistants, ['左辅', '右弼'].map(star => ({ star, branch: '丑', relation: '守', changRelation: '守' })));
  assert.equal(data.wuTempleMingChangFuBiDoubleGuardCandidate, true);
  const slices = run.facts.filter(timedWuFact).filter(row => row.normalizedPayload.lunarYear === sample.year);
  const boundary = new Date(quanshuLunarMidnight(sample.year, 7)).toISOString();
  const active = slices.find(row => row.normalizedPayload.wuTempleMingChangFuBiDoubleGuardCandidate === true);
  assert.deepEqual([active.activeFrom, active.activeTo], [fact.activeFrom, boundary]);
  assert.deepEqual(active.normalizedPayload.guardScopes, ['decadal', 'minor']);
  const evaluate = facts => ownMatch({ ...run, facts }, 1);
  const hit = evaluate(slices);
  assert.equal(hit.status, 'matched');
  const authority = slices.filter(row => row.normalizedPayload.wuNatalQuanAtActiveLimitCandidate === true);
  const quanLiterary = '武曲临限化权星\n更遇吉星同会合';
  assert.equal(hit.matchedSourceExcerpt, '若还入庙主财兴\n更加文昌临左右\n' + quanLiterary);
  assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: authority.at(-1).activeTo }]);
  const later = slices.filter(row => row.activeFrom >= boundary);
  assert.ok(later.length > 0);
  assert.ok(later.every(row => row.normalizedPayload.wuTempleMingChangFuBiDoubleGuardCandidate === false));
  assert.equal(evaluate(later).matchedSourceExcerpt, quanLiterary);

  const { natal, frame } = natalAndFrame(sample);
  const copy = structuredClone(natal), palace = position(copy, '左辅');
  const [fubi] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === '左辅'), 1);
  palace.adjectiveStars.push(fubi);
  const timedAt = (archive, current) => {
    const limits = quanshuLimitBranches(archive, current);
    const context = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(archive, current));
    const start = quanshuLunarMidnight(current.lunarYear, 1);
    const age = current.lunarYear - archive.rawDates.lunarDate.lunarYear + 1;
    const timing = quanshuLimitTiming(archive, limits, { start, end: start + 86400000 }, { ...current, age })[0].data;
    return quanshuTimedWu(timing, context);
  };
  const wrongLayer = timedAt(copy, frame);
  assert.equal(wrongLayer.wuTempleMingChangFuBiDoubleGuardCandidate, undefined);
  assert.equal(evaluate([{ ...active, normalizedPayload: wrongLayer }]).matchedSourceExcerpt, '若还入庙主财兴\n' + quanLiterary);
  const wrongMinor = timedAt(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
  assert.equal(wrongMinor.wuTempleMingChangFuBiDoubleGuardCandidate, undefined);
  assert.equal(evaluate([{ ...active, normalizedPayload: wrongMinor }]).matchedSourceExcerpt, quanLiterary);
  const next = natalAndFrame({ ...sample, year: sample.year + 1 });
  assert.equal(timedAt(next.natal, next.frame).wuTempleMingChangFuBiDoubleGuardCandidate, false);

  const selected = { ...run, facts: [fact, ...slices] };
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'temple-wu-named-fubi'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /更加文昌临左右/u);
  assert.match(prompt, /文昌、左辅和右弼均经出生月时安位和本命辅曜层复核/u);
  assert.doesNotMatch(prompt, /wuTempleMingChangFuBiDoubleGuardCandidate|武曲在丑宫/u);
});

test('non-temple Wu Qu transforms to Quan while guarding a real limit and matches independently in SQLite', () => {
  const birth = { dateStr: '1947-02-05', timeIndex: 0, gender: '女' };
  const cases = [
    [birth.dateStr, 0, 2020, 'minor', 'yearly', '流年干', '子', '旺'],
    [birth.dateStr, 0, 2032, 'minor', 'decadal', '大限宫干候选', '子', '旺'],
    ['1980-03-11', 1, 2025, 'decadal', 'natal', '生年干', '酉', '利益'],
    ['1999-04-04', 2, 2006, 'minor', 'minor', '小限宫干候选', '午', '旺'],
  ];
  for (const [dateStr, timeIndex, year, scope, layer, layerName, branch, grade] of cases) {
    const natal = native({ dateStr, timeIndex, gender: birth.gender });
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(year, 5, 1), ref = { snapshotId: 'wuqu-quan-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...ref, chart: chart(natal) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'wuqu-quan', ref);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === branchFactType && row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload;
    assert.equal(data.wu.verseGrade, grade);
    assert.equal(data.wuTemplePlainCandidate, false);
    assert.equal(data.wuTempleChangCandidate, false);
    assert.equal(data.wuQuanAtLimitCandidate, true);
    assert.deepEqual(data.wuQuanWitnesses, [{ scope, layer, stem: '庚', branch }]);
    const scoped = { ...run, facts: run.facts.filter(f => !timedWuFact(f) || f.normalizedPayload.lunarYear === year) };
    const hit = ownMatch(scoped, 1);
    const natalQuan = layer === 'natal';
    assert.equal(hit.status, natalQuan ? 'matched' : 'partial');
    assert.equal(hit.matchedSourceExcerpt, natalQuan ? '武曲临限化权星' : undefined);
    const active = timedWu(run, fact).filter(row => row.normalizedPayload.wuQuanAtLimitCandidate === true);
    assert.ok(active.length > 0);
    assert.ok(active.every(row => row.normalizedPayload.guardScopes.includes(scope)
      && row.normalizedPayload.wuNatalQuanAtActiveLimitCandidate === natalQuan));
    const onlyOutside = scoped.facts.filter(row => timedWuFact(row) && row.normalizedPayload.activeInSourceHalf === false);
    assert.ok(onlyOutside.every(row => row.normalizedPayload.wuNatalQuanAtActiveLimitCandidate === false));
    assert.deepEqual(hit.sourceFactIds, active.map(row => row.factId));
    assert.deepEqual(hit.windows, [{ start: active[0].activeFrom, endExclusive: active.at(-1).activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'wuqu-quan'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(layerName + '庚使武曲化权，武曲实守' + branch + '宫' + (scope === 'decadal' ? '大限' : '小限')));
    assert.ok(!prompt.includes('wuQuanWitnesses'));
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes('武曲临限化权星'), natalQuan);
    assert.doesNotMatch(provider, /wuNatalQuanAtActiveLimitCandidate|武曲实守[子酉午]宫[大小]限/u);
    if (natalQuan) {
      const sample = { dateStr, timeIndex, year, gender: birth.gender };
      const { natal, frame } = natalAndFrame(sample);
      const misplaced = position(natal, '武曲');
      misplaced.adjectiveStars.push(misplaced.majorStars.find(star => star.name === '武曲'));
      misplaced.majorStars = misplaced.majorStars.filter(star => star.name !== '武曲');
      const limits = quanshuLimitBranches(natal, frame);
      const window = { start: Date.parse(active[0].activeFrom), end: Date.parse(active[0].activeTo) };
      const [timing] = quanshuLimitTiming(natal, limits, window, frame);
      const unverified = quanshuTimedWu(timing.data, quanshuSolarWuPoLimits(limits, quanshuTransformLimits(natal, frame)));
      assert.equal(unverified.wuNatalQuanAtActiveLimitCandidate, undefined);
      assert.equal(ownMatch({ ...run, facts: [{ ...active[0], normalizedPayload: unverified }] }, 1).status, 'unknown');
    }
  }

  const { natal, frame } = natalAndFrame({ ...birth, year: 2020 });
  const limits = quanshuLimitBranches(natal, frame), transformations = quanshuTransformLimits(natal, frame);
  const wrongFrame = quanshuSolarWuPoLimits(limits, { ...transformations, lunarYear: 2019 });
  assert.equal(wrongFrame.wuQuanAtLimitCandidate, undefined);
  assert.deepEqual(wrongFrame.wuQuanWitnesses, []);
  const otherEmission = structuredClone(transformations);
  const receivingStar = otherEmission.seats.find(row => row.layer === 'minor').groups.find(row => row.layer === 'yearly')
    .stars.find(row => row.kind === '权');
  receivingStar.star = '太阳';
  const differentStar = quanshuSolarWuPoLimits(limits, otherEmission);
  assert.equal(differentStar.wu.guarded, true);
  assert.equal(differentStar.wuQuanAtLimitCandidate, false);
  assert.deepEqual(differentStar.wuQuanWitnesses, []);
  const duplicate = structuredClone(natal);
  duplicate.palaces[0].majorStars.push(position(natal, '武曲').majorStars.find(star => star.name === '武曲'));
  const uncertain = quanshuSolarWuPoLimits(quanshuLimitBranches(duplicate, frame), quanshuTransformLimits(duplicate, frame));
  assert.equal(uncertain.wuQuanAtLimitCandidate, undefined);
  assert.deepEqual(uncertain.wuQuanWitnesses, []);
});

test('Ming temple Wu Qu verifies seated Chang and Qu with natal Quan in active single and double limits', () => {
  const birth = { dateStr: '1980-03-11', timeIndex: 9, gender: '女' };
  const engine = astro.withOptions({ ...birth, fixLeap: true, config });
  const field = 'wuNatalQuanMingChangQuAtActiveLimitCandidate';
  for (const [year, guardScopes, expectedStart, expectedEnd] of [
    [1989, ['minor'], '1989-02-05T16:00:00.000Z', '1989-08-01T16:00:00.000Z'],
    [2025, ['decadal', 'minor'], '2025-01-28T16:00:00.000Z', '2025-12-31T16:00:00.000Z'],
  ]) {
    const { run, fact } = submittedCompleteBirth({ ...birth, year });
    const rows = run.facts.filter(row => timedWuFact(row) && row.normalizedPayload.lunarYear === year);
    const active = rows.filter(row => row.normalizedPayload[field] === true);
    assert.ok(active.length);
    assert.ok(active.every(row => row.normalizedPayload.wuNatalQuanAtActiveLimitCandidate === true));
    assert.deepEqual(active[0].normalizedPayload.guardScopes, guardScopes);
    assert.deepEqual(active[0].normalizedPayload.wuNatalQuanMingChangQuWitness, {
      branch: '丑', stem: '庚', assistants: [
        { star: '文昌', branch: '丑', relation: '守' }, { star: '文曲', branch: '丑', relation: '守' },
      ],
    });
    assert.equal(fact.normalizedPayload.wu.verseGrade, '庙');
    const scoped = { ...run, facts: active }, hit = ownMatch(scoped, 1);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: expectedStart, endExclusive: expectedEnd }]);
    assert.match(hit.matchedSourceExcerpt, /更遇吉星同会合/u);
    const exact = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...active[0], normalizedPayload }])
      .find(row => row.knowledgeId === hit.knowledgeId).confirmations.find(row => row.condition.includes(field));
    assert.equal(exact(active[0].normalizedPayload).hits.length, 1);
    const minorCut = new Date(quanshuLunarMidnight(year, 7)).toISOString();
    const afterMinor = rows.find(row => row.activeFrom === minorCut);
    assert.ok(afterMinor);
    assert.deepEqual(afterMinor.normalizedPayload.guardScopes, guardScopes.length === 1 ? [] : ['decadal']);
    assert.equal(exact(afterMinor.normalizedPayload).hits.length, guardScopes.length - 1);

    const h = engine.horoscope(year + '-06-01', 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
    const window = { start: Date.parse(active[0].activeFrom), end: Date.parse(active[0].activeTo) };
    for (const star of ['文昌', '文曲']) {
      const wrong = engine.toJSON(), palace = position(wrong, star);
      palace.adjectiveStars.push(palace.minorStars.find(row => row.name === star));
      palace.minorStars = palace.minorStars.filter(row => row.name !== star);
      const limits = quanshuLimitBranches(wrong, frame);
      const [timing] = quanshuLimitTiming(wrong, limits, window, frame);
      const missing = quanshuTimedWu(timing.data, quanshuSolarWuPoLimits(limits, quanshuTransformLimits(wrong, frame)));
      assert.equal(missing[field], undefined);
      assert.equal(missing.wuNatalQuanAtActiveLimitCandidate, true);
      assert.deepEqual([exact(missing).hits.length, exact(missing).unknown], [0, true]);
      const independent = ownMatch({ ...run, facts: [{ ...active[0], normalizedPayload: missing }] }, 1);
      assert.match(independent.matchedSourceExcerpt, /武曲临限化权星/u);
      assert.doesNotMatch(independent.matchedSourceExcerpt, /更遇吉星同会合/u);
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-wu-literary'));
    assert.match(formatFortunePrompt(input), /更遇吉星同会合/u);
    assert.doesNotMatch(formatFortunePrompt(input), /wuNatalQuanMingChangQu|丑宫/u);
  }
});

test('Wu Qu distinguishes Chang flanked on opposite sides and both assistants supporting its own Quan', () => {
  const flanked = submittedCompleteBirth({ dateStr: '1959-04-16', timeIndex: 3, gender: '女', year: 1963 });
  assert.equal(flanked.data.wuTempleChangAssistantsCandidate, false);
  assert.equal(flanked.data.wuTempleChangFlankedCandidate, true);
  assert.deepEqual(flanked.data.wuAssistants.map(row => [row.branch, row.changRelation]), [['午', '邻宫'], ['申', '邻宫']]);
  assert.equal(flanked.data.wuChang.branch, '未');
  assert.equal(ownMatch(flanked.run, 1).status, 'partial');
  const { input } = buildFortuneModelContext(flanked.run, interpretFortune(flanked.run, requestForFortuneRun(flanked.run), 'wu-flanked-chang'));
  assert.match(formatFortuneFactAudit(input), /左辅与右弼分居文昌两侧邻宫/u);
  const notFlanked = branchExample(ref.branchExamples.wuNearChang);
  assert.equal(notFlanked.data.wuTempleChangFlankedCandidate, false);

  const assisted = submittedCompleteBirth({ dateStr: '1978-01-05', timeIndex: 1, gender: '女', year: 1990 });
  assert.equal(assisted.data.wuQuanAssistedCandidate, true);
  assert.deepEqual(assisted.data.wuQuanWitnesses, [{ scope: 'minor', layer: 'yearly', stem: '庚', branch: '午' }]);
  assert.deepEqual(assisted.data.wuAssistants.map(row => row.relation), ['三合', '冲']);
  assert.equal(ownMatch(assisted.run, 1).status, 'partial');
  const assistedText = describeFortuneFact({ method: 'ziwei', type: branchFactType, data: assisted.data }, String);
  assert.match(assistedText, /武曲实守限宫且自身化权时，左辅右弼均到会/u);
});

test('Po Jun separates temple with both companions, a known clear seat, and a seat with adverse contacts', () => {
  const support = branchExample({ ...ref.branchExamples.poSupport, year: 1993 });
  assert.equal(support.data.po.verseGrade, '庙');
  assert.equal(support.data.poChang.relation, '冲');
  assert.ok(support.data.poNobles.some(row => row.relation === '守' && row.star === '魁钺组'));
  assert.equal(support.data.poTempleJoinedSupportCandidate, false);
  assert.equal(support.data.poTempleAdverseCandidate, false);
  assert.equal(support.data.poTempleMingNamedShaClearCandidate, true);
  const hit = ownMatch(support.run, 2);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '庙地方知福禄昌');
  const active = support.run.facts.find(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === true);
  assert.ok(active.normalizedPayload.guardScopes.includes('decadal'));
  assert.ok(hit.sourceFactIds.includes(active.factId));
  const lateDecadal = branchExample(ref.branchExamples.poSupport);
  assert.equal(lateDecadal.data.poTempleSupportCandidate, true);
  assert.equal(lateDecadal.data.po.decadalRelation, '守');
  assert.equal(ownMatch(lateDecadal.run, 2).status, 'not_matched');

  const adverse = branchExample(ref.branchExamples.poAdverse);
  assert.equal(adverse.data.poChang.relation, '三合');
  assert.ok(adverse.data.poNobles.some(row => row.relation === '守'));
  assert.ok(adverse.data.poHazards.some(row => row.star === '归档铃星' && row.relation === '三合'));
  assert.equal(adverse.data.poTempleAdverseCandidate, true);
  assert.deepEqual([adverse.data.poTemplePlainCandidate, adverse.data.poTempleSupportCandidate,
    adverse.data.poTempleJoinedSupportCandidate, adverse.data.poTempleBothNoblesCandidate], [false, false, false, false]);
  const ordinary = ownMatch(adverse.run, 2);
  const ordinaryFact = adverse.run.facts.find(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === true);
  assert.equal(ordinaryFact.normalizedPayload.poTempleAtVerifiedLimitCandidate, true);
  assert.deepEqual(ordinaryFact.normalizedPayload.guardScopes, ['minor']);
  assert.equal(ordinary.status, 'matched');
  assert.equal(ordinary.matchedSourceExcerpt, '庙地方知福禄昌');
  assert.deepEqual(ordinary.sourceFactIds, [ordinaryFact.factId]);
  assert.deepEqual(ordinary.windows, [{ start: '2008-02-06T16:00:00.000Z', endExclusive: '2008-07-31T16:00:00.000Z' }]);

  const noCompanions = branchExample(ref.examples.poTemple);
  assert.equal(noCompanions.data.po.verseGrade, '庙');
  assert.equal(noCompanions.data.po.guarded, true);
  assert.equal(noCompanions.data.poChang.relation, '其他');
  assert.equal(noCompanions.data.poTempleSupportCandidate, false);
  assert.equal(noCompanions.data.poTemplePlainCandidate, true);
  assert.equal(noCompanions.data.poTempleMingNamedShaClearCandidate, true);
  assert.equal(ownMatch(noCompanions.run, 2).matchedSourceExcerpt, '庙地方知福禄昌');
});

test('the same natal archive verifies temple Wu Qu during its actual limit when Chang is unverified', () => {
  const sample = { ...ref.branchExamples.poAdverse, year: 1998 }, natal = native(sample);
  removeStar(natal, '文昌');
  const input = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
  const reference = { snapshotId: 'wuqu-temple-missing-chang', chart: chart(natal) };
  const run = calculateFortuneFacts(input, buildFactTimeContext(input, Date.UTC(sample.year, 5, 1), 'server'),
    'wuqu-temple-base', reference);
  const scoped = branchExample(sample, run);
  assert.deepEqual([scoped.data.wu.branch, scoped.data.wu.verseGrade, scoped.data.wu.minorRelation], ['戌', '庙', '守']);
  assert.equal(scoped.data.wuChang.branch, undefined);
  assert.equal(scoped.data.wuTempleChangCandidate, undefined);
  assert.deepEqual([scoped.data.wuQuanAtLimitCandidate, scoped.data.wuQuanAssistedCandidate], [false, false]);
  const timed = scoped.run.facts.filter(timedWuFact);
  const active = timed.find(row => row.normalizedPayload.activeInSourceHalf === true);
  assert.equal(active.normalizedPayload.wuTempleAtVerifiedLimitCandidate, true);
  assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
  const hit = ownMatch(scoped.run, 1);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [active.factId]);
  assert.deepEqual(hit.windows, [{ start: '1998-01-27T16:00:00.000Z', endExclusive: '1998-08-21T16:00:00.000Z' }]);
  const inactive = timed.filter(row => row.normalizedPayload.activeInSourceHalf === false);
  assert.ok(inactive.length);
  assert.equal(ownMatch({ ...scoped.run, facts: inactive }, 1).status, 'not_matched');
});

test('both northern temple rules reject a same-palace record in the wrong natal star layer', () => {
  const birth = ref.branchExamples.poAdverse;
  for (const [year, star, branch, rule, filter, bind, gate] of [
    [1998, '武曲', '戌', 1, timedWuFact, quanshuTimedWu, 'wuTempleAtVerifiedLimitCandidate'],
    [2008, '破军', '子', 2, timedPoFact, quanshuTimedPo, 'poTempleAtVerifiedLimitCandidate'],
  ]) {
    const sample = { ...birth, year };
    const { run, data } = branchExample(sample);
    assert.equal(data[gate], true, star);
    const active = run.facts.find(fact => filter(fact) && fact.normalizedPayload.activeInSourceHalf === true);
    assert.ok(active, star);
    assert.equal(active.normalizedPayload.branch, branch);
    assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
    const hit = ownMatch({ ...run, facts: [active] }, rule);
    assert.equal(hit.status, rule === 2 ? 'matched' : 'partial');
    if (rule === 2) assert.equal(hit.matchedSourceExcerpt, '庙地方知福禄昌');
    const { starPlacementProof, ...outdated } = active.normalizedPayload;
    assert.equal(starPlacementProof, 'quanshu-nanyangtang-major-layer-v1');
    const evaluate = normalizedPayload => ownMatch({ ...run, facts: [{ ...active, normalizedPayload }] }, rule);
    assert.equal(evaluate(outdated).status, 'unknown');

    const { natal, frame } = natalAndFrame(sample);
    const palace = position(natal, star);
    const misplaced = palace.majorStars.find(row => row.name === star);
    palace.majorStars = palace.majorStars.filter(row => row !== misplaced);
    palace.adjectiveStars.push(misplaced);
    const limits = quanshuLimitBranches(natal, frame);
    assert.equal(limits.principalPositions.find(row => row.star === star).branch, branch);
    assert.equal(limits.sourceMinor.verified, true);
    const source = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(natal, frame));
    assert.equal(source[gate], undefined);
    const age = year - natal.rawDates.lunarDate.lunarYear + 1;
    const [timing] = quanshuLimitTiming(natal, limits, { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) }, { ...frame, age });
    const payload = bind(timing.data, source);
    assert.equal(payload.activeInSourceHalf, undefined);
    assert.deepEqual(payload.guardScopes, []);
    assert.equal(evaluate(payload).status, 'unknown');
  }
});

test('both source noble seats and Chang meet an actual Po Jun limit only within its first half', () => {
  const example = submittedCompleteBirth({ dateStr: '1959-02-13', timeIndex: 4, gender: '女', year: 1972 });
  assert.equal(example.data.poTempleBothNoblesCandidate, true);
  assert.equal(example.data.poTempleJoinedSupportCandidate, false);
  assert.equal(example.data.poTempleMingJoinedBothNoblesCandidate, false);
  assert.deepEqual(example.data.poNobles.map(row => [row.branch, row.relation]), [['子', '守'], ['申', '三合']]);
  assert.deepEqual([example.data.poChang.branch, example.data.poChang.relation], ['午', '冲']);
  assert.equal(ownMatch(example.run, 2).matchedSourceExcerpt, '庙地方知福禄昌');
  const onlyBoth = { ...example.run, facts: example.run.facts.map(fact => !timedPoFact(fact) ? fact : {
    ...fact, normalizedPayload: { ...fact.normalizedPayload,
      poTempleSupportCandidate: false, poTempleAtVerifiedLimitCandidate: false, poTempleMingNamedShaClearCandidate: false },
  }) };
  const result = ownMatch(onlyBoth, 2);
  assert.equal(result.status, 'partial');
  const phase = example.run.facts.find(fact => timedPoFact(fact) && fact.normalizedPayload.activeInSourceHalf === true);
  assert.ok(phase);
  assert.ok(result.sourceFactIds.includes(phase.factId));
  assert.ok(result.windows.some(window => window.endExclusive === phase.activeTo && window.endExclusive < example.fact.activeTo));
  const text = describeFortuneFact({ method: 'ziwei', type: branchFactType, data: example.data }, String);
  assert.match(text, /文昌和来源魁钺组两处星位均守冲三合破军限宫/u);
});

test('verified Chang companion geometry reaches SQLite and Chinese input for both temple-limit verses', () => {
  const examples = [
    { dateStr: '1940-3-5', timeIndex: 6, gender: '女', year: 1964,
      rule: 1, field: 'wuTempleChangAssistantsCandidate', phrase: /左辅与右弼均对实际到会的文昌有守冲三合关系/u },
    { dateStr: '1940-2-5', timeIndex: 10, gender: '女', year: 1958,
      rule: 2, field: 'poTempleJoinedSupportCandidate', phrase: /文昌与魁钺组的一颗实居子宫，共同到会庙地破军所在的限宫/u },
  ];
  for (const sample of examples) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
    const now = Date.UTC(sample.year, 5, 1), archive = { snapshotId: 'verse-chang-' + sample.year, chart: chart(native(sample)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'verse-chang', archive);
    const { run, fact, data } = branchExample(sample, bound);
    assert.equal(data[sample.field], true);
    if (sample.rule === 1) {
      assert.deepEqual([data.wu.branch, data.wu.minorRelation, data.wuChang.branch, data.wuChang.relation], ['戌', '守', '辰', '冲']);
      assert.deepEqual(data.wuAssistants.map(row => [row.star, row.branch, row.changRelation]),
        [['左辅', '辰', '守'], ['右弼', '戌', '冲']]);
    } else {
      assert.deepEqual([data.po.branch, data.po.minorRelation, data.poChang.branch, data.poChang.relation], ['午', '守', '子', '冲']);
      assert.deepEqual(data.poNobles.filter(row => row.changRelation === '守').map(row => row.branch), ['子']);
      assert.ok(data.poHazards.every(row => row.branch && ['邻宫', '其他'].includes(row.relation)));
    }
    const hit = ownMatch(run, sample.rule);
    const wu = sample.rule === 1;
    assert.equal(hit.status, wu ? 'matched' : 'partial');
    assert.equal(hit.matchedSourceExcerpt, wu ? '武曲临限化权星' : undefined);
    const timedMatch = wu ? timedWuFact : timedPoFact;
    assert.ok(run.facts.some(row => timedMatch(row) && hit.sourceFactIds.includes(row.factId)));
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom,
      endExclusive: sample.rule === 2 ? '1958-08-14T16:00:00.000Z' : '1964-08-07T16:00:00.000Z' }]);

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'verse-chang'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.ok(!prompt.includes(sample.field));
    assert.equal(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === hit.knowledgeId), wu);
    assert.doesNotMatch(formatFortunePrompt(input), sample.phrase);

    const { natal, frame } = natalAndFrame(sample);
    if (sample.rule === 2) {
      const active = run.facts.find(row => timedPoFact(row) && hit.sourceFactIds.includes(row.factId));
      const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
      for (const [names, field] of [[['天魁', '天钺'], 'poNobles'], [['擎羊'], 'poHazards']]) {
        const archive = structuredClone(natal);
        const palace = field === 'poNobles' ? archive.palaces.find(row => row.earthlyBranch === data.poChang.branch)
          : position(archive, names[0]);
        const star = palace.minorStars.find(row => names.includes(row.name));
        assert.ok(star, field);
        removeStar(archive, star.name);
        palace.adjectiveStars.push(star);
        const limits = quanshuLimitBranches(archive, frame);
        const moved = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(archive, frame));
        assert.equal(moved.poTempleJoinedSupportCandidate, undefined, field);
        assert.ok(moved[field].some(row => row.branch === undefined && row.relation === undefined), field);
        const [timing] = quanshuLimitTiming(archive, limits, window, frame);
        const candidateRun = { ...run, facts: [{ ...fact, normalizedPayload: moved },
          { ...active, normalizedPayload: quanshuTimedPo(timing.data, moved) }] };
        assert.equal(ownMatch(candidateRun, 2).status, 'partial', field);
        const { input: movedInput } = buildFortuneModelContext(candidateRun,
          interpretFortune(candidateRun, requestForFortuneRun(candidateRun), 'pojun-wrong-natal-layer'));
        assert.doesNotMatch(formatFortuneFactAudit(movedInput), sample.phrase, field);
        assert.doesNotMatch(formatFortunePrompt(movedInput), /文昌与魁钺组的一颗实居|更遇文昌同魁钺/u, field);
      }
    }
    removeStar(natal, sample.rule === 1 ? '右弼' : '火星');
    const uncertain = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
    assert.equal(uncertain[sample.field], undefined);
  }
});

test('temple Po Jun can independently match a clear actual limit with known incomplete companions', () => {
  const sample = ref.branchExamples.poPlain, year = sample.year;
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'pojun-plain', chart: chart(native(sample)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'pojun-plain', archive);
  validateFortuneFacts(bound);
  const { run, data } = branchExample(sample, bound);
  assert.deepEqual([data.po.branch, data.po.verseGrade, data.po.minorRelation], ['午', '庙', '守']);
  assert.deepEqual([data.poChang.branch, data.poChang.relation], ['卯', '其他']);
  assert.deepEqual(data.poNobles.map(row => [row.branch, row.relation]), [['亥', '其他'], [undefined, undefined]]);
  assert.ok(data.poHazards.every(row => row.branch && ['邻宫', '其他'].includes(row.relation)));
  assert.deepEqual([data.poTemplePlainCandidate, data.poTempleSupportCandidate, data.poTempleAdverseCandidate], [true, false, false]);
  const hit = ownMatch(run, 2);
  assert.equal(hit.status, 'partial');
  const timing = run.facts.find(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === true);
  assert.deepEqual(timing.normalizedPayload.guardScopes, ['minor']);
  assert.deepEqual(hit.sourceFactIds, [timing.factId]);
  assert.deepEqual(hit.windows, [{ start: '1966-01-20T16:00:00.000Z', endExclusive: '1966-08-15T16:00:00.000Z' }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'pojun-plain'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /该限实守庙地破军，文昌与魁钺组同会条件未成立/u);
  assert.match(prompt, /该宫守冲三合均未见已核羊陀和归档火铃/u);
  assert.match(prompt, /破军为北斗，实守小限午宫且处在本星适用的上半年，原分支与该限同段/u);
  assert.doesNotMatch(prompt, /poTemplePlainCandidate|pojunPhaseCandidate/u);
  assert.doesNotMatch(formatFortunePrompt(input), /原分支与该限同段|该限实守庙地破军/u);

  const { natal, frame } = natalAndFrame(sample);
  removeStar(natal, '火星');
  const missing = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
  assert.equal(missing.poTemplePlainCandidate, undefined);
});

test('Po Jun checks Ming temple risk independently of the archived Fire and Bell placements', () => {
  const cases = [
    [ref.branchExamples.poAdverse, true, false, ['火星', '卯', '其他'], ['铃星', '戌', '其他']],
    [ref.branchExamples.poPlain, false, false, ['火星', '酉', '其他'], ['铃星', '戌', '三合']],
    [{ dateStr: '1940-2-5', timeIndex: 10, gender: '女', year: 1958 }, false, false, ['火星', '酉', '其他'], ['铃星', '戌', '三合']],
    [{ dateStr: '1959-03-05', timeIndex: 2, gender: '女', year: 1972 }, true, true, ['火星', '酉', '其他'], ['铃星', '戌', '其他']],
  ];
  for (const [sample, clear, joined, fire, bell] of cases) {
    const { run, data } = joined ? submittedCompleteBirth(sample) : branchExample(sample);
    assert.equal(data.poTempleAtVerifiedLimitCandidate, true);
    assert.equal(data.poTempleAdverseCandidate, clear);
    assert.equal(data.poTempleMingNamedShaClearCandidate, clear);
    assert.equal(data.poTempleMingJoinedSupportCandidate, joined);
    assert.equal(data.poTempleMingJoinedBothNoblesCandidate, joined);
    assert.deepEqual(data.poTempleMingHazards.slice(2).map(({ star, branch, relation }) => [star, branch, relation]), [fire, bell]);
    if (joined) {
      assert.equal(data.poTempleJoinedSupportCandidate, false);
      assert.deepEqual([data.poChang.branch, data.poChang.relation], ['申', '三合']);
      assert.equal(data.poMingJoinedNoblePlacementProof, 'quanshu-ming-chang-noble-auxiliary-layer-v1');
      assert.ok(data.poNobles.some(row => row.branch === '申' && row.changRelation === '守'));
      assert.deepEqual(data.poNobles.map(row => [row.branch, row.relation]), [['子', '守'], ['申', '三合']]);
    }

    const active = run.facts.find(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === true);
    assert.ok(active);
    assert.deepEqual(active.normalizedPayload.poTempleMingHazards, data.poTempleMingHazards);
    const oldFlagsOff = { poTempleAtVerifiedLimitCandidate: false, poTempleBothNoblesCandidate: false,
      poTempleJoinedSupportCandidate: false, poTempleSupportCandidate: false, poTemplePlainCandidate: false,
      poFallenMingBladeFireBellCandidate: false };
    const withPayload = changes => ({ ...run, facts: [{ ...active, normalizedPayload: {
      ...active.normalizedPayload, ...oldFlagsOff, ...changes,
    } }] });
    const result = ownMatch(withPayload({}), 2);
    assert.equal(result.status, clear ? 'matched' : 'not_matched');
    assert.deepEqual(result.sourceFactIds, clear ? [active.factId] : []);
    if (clear) {
      assert.deepEqual(result.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
      assert.equal(result.matchedSourceExcerpt, joined ? '庙地方知福禄昌\n更遇文昌同魁钺' : '庙地方知福禄昌');
    }
    assert.equal(ownMatch(withPayload({ poTempleMingNamedShaClearCandidate: false }), 2).status, joined ? 'matched' : 'not_matched');
    if (joined) assert.equal(ownMatch(withPayload({ poTempleMingNamedShaClearCandidate: false,
      poMingJoinedNoblePlacementProof: undefined }), 2).status, 'unknown');
    assert.equal(ownMatch(withPayload({ activeInSourceHalf: false }), 2).status, 'not_matched');
    assert.equal(ownMatch(withPayload({ quanshuFixedFireBellProfile: 'other-source' }), 2).status, 'not_matched');

    const { natal, frame } = natalAndFrame(sample);
    removeStar(natal, '铃星');
    const anchors = quanshuLimitBranches(natal, frame);
    const withoutArchiveBell = quanshuSolarWuPoLimits(anchors, quanshuTransformLimits(natal, frame));
    assert.equal(withoutArchiveBell.poTempleAdverseCandidate, undefined);
    assert.equal(withoutArchiveBell.poTempleMingNamedShaClearCandidate, clear);
    assert.deepEqual(withoutArchiveBell.poTempleMingHazards, data.poTempleMingHazards);
    if (clear && !joined) {
      const palace = position(natal, '擎羊');
      const blade = palace.minorStars.find(star => star.name === '擎羊');
      assert.ok(blade);
      removeStar(natal, '擎羊');
      palace.adjectiveStars.push(blade);
      const wrongLayer = quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
      assert.equal(wrongLayer.poTempleMingNamedShaClearCandidate, undefined);
      assert.equal(ownMatch(withPayload({ poTempleMingNamedShaClearCandidate: undefined }), 2).status, 'unknown');
      const inactive = run.facts.filter(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === false);
      assert.ok(inactive.length > 0);
      assert.equal(ownMatch({ ...run, facts: inactive }, 2).status, 'not_matched');
    }
    if (joined) {
      for (const name of ['文昌', '天魁', '天钺']) {
        const archive = structuredClone(natal), palace = position(archive, name);
        const star = palace.minorStars.find(row => row.name === name);
        assert.ok(star);
        removeStar(archive, name);
        palace.adjectiveStars.push(star);
        const limits = quanshuLimitBranches(archive, frame);
        const wrongLayer = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(archive, frame));
        assert.equal(wrongLayer.poTempleMingJoinedBothNoblesCandidate, undefined);
        const affectsJoinedPair = name === '文昌' || palace.earthlyBranch === data.poChang.branch;
        assert.equal(wrongLayer.poTempleMingJoinedSupportCandidate, affectsJoinedPair ? undefined : true);
        assert.equal(wrongLayer.poMingJoinedNoblePlacementProof, affectsJoinedPair ? undefined : data.poMingJoinedNoblePlacementProof);
        const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
        const timed = quanshuTimedPo(quanshuLimitTiming(archive, limits, window, frame)[0].data, wrongLayer);
        const foundation = ownMatch({ ...run, facts: [{ ...active, normalizedPayload: timed }] }, 2);
        assert.equal(foundation.status, 'matched');
        assert.equal(foundation.matchedSourceExcerpt, '庙地方知福禄昌');
      }
    }

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-pojun-temple'));
    const audit = formatFortuneFactAudit(input), prompt = formatFortunePrompt(input);
    const clearText = /庙地破军实守此限，已核羊陀与明刊火铃均未到会/u;
    const joinedText = /文昌与魁钺组内一曜实同宫并到会此限/u;
    assert.equal(clearText.test(audit), clear);
    assert.equal(joinedText.test(audit), joined);
    if (!clear) assert.match(audit, /庙地破军所在限宫按明刊安星核得/u);
    assert.doesNotMatch(prompt, /庙地破军实守此限|庙地破军所在限宫按明刊安星核得|文昌与魁钺组内一曜|poTempleMing/u);
    assert.equal(/已核本命辅曜层羊陀及明刊定宫火铃均未到会同一限宫/u.test(prompt), clear);
    assert.equal(/魁钺两处星位均到会同一限宫/u.test(prompt), joined);
    assert.equal(/本命擎羊、陀罗与明刊定宫的火星、铃星均不在该限宫/u.test(prompt), joined);
  }
});

test('the Ming Wu Qu and Po Jun verses distinguish verified companion seats at active northern double limits', () => {
  const cases = [
    { sample: { dateStr: '1950-05-24', timeIndex: 3, gender: '女', year: 1965 }, row: 1, branch: '丑', companion: '未',
      stem: 'wuTempleMingChangFuBiOpposedDoubleGuard', prior: 'wuTempleMingChangFuBiDoubleGuardCandidate', auxiliary: '左辅',
      start: '1965-02-01T16:00:00.000Z', end: '1965-07-27T16:00:00.000Z', bind: quanshuTimedWu, owns: timedWuFact },
    { sample: { dateStr: '1989-05-10', timeIndex: 6, gender: '女', year: 2008 }, row: 2, branch: '子', companion: '辰',
      stem: 'poTempleMingChangTwoNoblesDistinctTrineDoubleGuard', prior: 'poTempleMingJoinedBothNoblesCandidate', auxiliary: '天魁',
      start: '2008-02-06T16:00:00.000Z', end: '2008-07-31T16:00:00.000Z', bind: quanshuTimedPo, owns: timedPoFact },
  ];
  for (const { sample, row, branch, companion, stem, prior, auxiliary, start, end, bind, owns } of cases) {
    const { run: submitted } = submittedCompleteBirth(sample);
    const run = { ...submitted, facts: submitted.facts.filter(owns) };
    const selector = `${stem}Candidate`, witness = `${stem}Witness`, wu = row === 1;
    const matching = run.facts.filter(fact => fact.normalizedPayload[selector] === true);
    assert.ok(matching.length > 0);
    assert.equal(matching[0].activeFrom, start);
    assert.equal(matching.at(-1).activeTo, end);
    for (const { normalizedPayload: payload } of matching) {
      assert.equal(payload[prior], false);
      assert.deepEqual(payload.guardScopes, ['decadal', 'minor']);
      assert.equal(payload.branch, branch);
      const evidence = payload[witness];
      assert.equal(evidence.chang.branch, companion);
      if (wu) {
        assert.equal(evidence.wuBranch, branch);
        assert.deepEqual(evidence.assistants.map(({ star, branch, relation, changRelation }) => [star, branch, relation, changRelation]),
          [['左辅', '未', '冲', '守'], ['右弼', '未', '冲', '守']]);
      } else {
        assert.equal(evidence.poBranch, branch);
        assert.deepEqual(evidence.nobles.map(({ branch, relation, changRelation }) => [branch, relation, changRelation]),
          [['子', '守', '三合'], ['申', '三合', '三合']]);
        assert.ok(payload.poTempleMingHazards.every(sha => !['守', '冲', '三合'].includes(sha.relation)));
      }
    }
    assert.ok(run.facts.some(fact => fact.activeFrom >= end && fact.normalizedPayload[selector] === false));
    const hit = ownMatch(run, row);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt.includes('更加文昌临左右'), wu);
    if (!wu) assert.deepEqual(hit.matchedSourceExcerpt.split('\n'), ['庙地方知福禄昌', '魁鉞命身限遇昌']);

    const template = matching[0];
    const { profile, limitPlacementProof, starPlacementProof, star, sourceProfile, sourceFactType, activeInSourceHalf, guardScopes,
      ready, quanshuFixedFireBellProfile } = template.normalizedPayload;
    const isolated = { ...template, normalizedPayload: { profile, limitPlacementProof, starPlacementProof, star, sourceProfile, sourceFactType,
      activeInSourceHalf, guardScopes, ready, quanshuFixedFireBellProfile, [selector]: true } };
    const evaluation = evaluateFortuneRules('ziwei', 'year', [isolated]).find(rule => rule.knowledgeId === ids[row]);
    assert.equal(evaluation.required[0].hits.length, 1);
    assert.ok(evaluation.confirmations.some(query => query.condition.includes(selector) && query.hits.length > 0));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), stem));
    const local = wu ? /大小限同守丑宫庙地武曲，文昌、左辅、右弼实同在未宫正对/u
      : /大小限同守子宫庙地破军，文昌在辰宫.*昌魁钺分在同一三合组/u;
    assert.match(formatFortuneFactAudit(input), local);
    const prompt = formatFortunePrompt(input);
    assert.ok(!prompt.includes(stem));
    if (!wu) assert.match(prompt, /魁鉞命身限遇昌/u);
    assert.doesNotMatch(prompt, local);
    assert.doesNotMatch(prompt, /三曜(?:同守|同在)未宫|文昌(?:在|实守|位于)辰宫|魁钺.*分别(?:在|实守)子、申宫/u);

    const { natal, frame } = natalAndFrame(sample);
    const at = (archive, current) => {
      const limits = quanshuLimitBranches(archive, current);
      const day = quanshuLunarMidnight(current.lunarYear, 1);
      const timing = quanshuLimitTiming(archive, limits, { start: day, end: day + 86400000 },
        { ...current, age: current.lunarYear - archive.rawDates.lunarDate.lunarYear + 1 })[0];
      return bind(timing.data, quanshuSolarWuPoLimits(limits, quanshuTransformLimits(archive, current)));
    };
    assert.equal(at(natal, natalAndFrame({ ...sample, year: sample.year + 1 }).frame)[selector], false);
    const badStarLayer = structuredClone(natal), palace = position(badStarLayer, auxiliary);
    const starAtWrongLayer = palace.minorStars.find(placed => placed.name === auxiliary);
    assert.ok(starAtWrongLayer);
    removeStar(badStarLayer, auxiliary);
    palace.adjectiveStars.push(starAtWrongLayer);
    for (const [archive, current] of [[badStarLayer, frame], [natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }]]) {
      const missing = at(archive, current);
      assert.equal(missing[selector], undefined);
      assert.equal(missing[witness], undefined);
    }
  }
});

test('an unverified archive minor alone cannot activate a temple Po Jun limit window', () => {
  const sample = ref.branchExamples.poPlain;
  const { run } = submittedCompleteBirth(sample);
  const real = run.facts.find(row => timedPoFact(row) && row.normalizedPayload.activeInSourceHalf === true);
  assert.deepEqual(real.normalizedPayload.guardScopes, ['minor']);

  const frameInput = natalAndFrame(sample);
  const limits = quanshuLimitBranches(frameInput.natal, frameInput.frame);
  assert.equal(limits.sourceMinor.verified, true);
  const mistimedLimits = { ...limits, sourceMinor: { ...limits.sourceMinor, verified: false } };
  const context = quanshuSolarWuPoLimits(mistimedLimits, quanshuTransformLimits(frameInput.natal, frameInput.frame));
  const frames = quanshuLimitTiming(frameInput.natal, mistimedLimits,
    { start: Date.parse(real.activeFrom), end: Date.parse(real.activeTo) },
    { age: limits.sourceMinor.ordinal, decadalIndex: frameInput.frame.decadalIndex });
  const phase = frames[0].data;
  assert.equal(phase.pojunPhaseCandidate, true);
  const unproven = quanshuTimedPo(phase, context);
  assert.equal(unproven.poTemplePlainCandidate, undefined);
  assert.equal(unproven.activeInSourceHalf, undefined);
  assert.deepEqual(unproven.guardScopes, []);

  const unresolved = { ...run, facts: run.facts.map(row => row.factId === real.factId
    ? { ...row, normalizedPayload: unproven } : row) };
  assert.equal(ownMatch(unresolved, 2).status, 'unknown');
});

test('non-temple Wu Qu and Po Jun remain outside the temple cases', () => {
  for (const [key, star, flag] of [['wuNotTemple', '武曲', 'verseWuquTempleAtFocus'], ['poNotTemple', '破军', 'versePoJunTempleAtFocus']]) {
    const run = runFor(ref.examples[key]);
    const rows = ownFacts(run).filter(f => f.scope === ref.examples[key].scope && f.normalizedPayload.branch === ref.examples[key].focusBranch);
    assert.ok(rows.length > 0);
    for (const f of rows) { assert.equal(f.normalizedPayload[flag], false); assert.notEqual(f.normalizedPayload.verseSubjects.find(r => r.star === star).verseGrade, '庙'); }
  }
});

test('the solar darkness candidate requires phase, Ju Men, and both separate Sha groups in its guarded palace', () => {
  const exact = branchExample(ref.branchExamples.sunDark);
  assert.equal(exact.data.sun.solarPhase, '偏垣');
  assert.deepEqual(exact.data.sunDarkWitness, { star: '巨门', branch: '申', relation: '守' });
  assert.ok(exact.data.sunHazards.some(row => row.star === '陀罗' && row.relation === '守'));
  assert.ok(exact.data.sunHazards.some(row => row.star === '归档铃星' && row.relation === '三合'));
  assert.equal(ownMatch(exact.run, 3).status, 'partial');

  const wrong = branchExample(ref.branchExamples.sunMissingFireBell);
  assert.equal(wrong.data.sun.solarPhase, '偏垣');
  assert.equal(wrong.data.sunDarkWitness.relation, '守');
  assert.ok(wrong.data.sunHazards.some(row => row.star === '陀罗' && row.relation === '守'));
  assert.equal(ownMatch(wrong.run, 3).status, 'not_matched');

  const wei = branchExample({ dateStr: '1987-05-15', timeIndex: 10, gender: '女', year: 2005 });
  assert.equal(wei.data.sun.branch, '未');
  assert.equal(wei.data.sun.solarPhase, '偏垣');
  assert.equal(wei.data.sun.guarded, true);
  assert.deepEqual(wei.data.sunDarkWitness, { star: '巨门', branch: '酉', relation: '其他' });
  assert.equal(wei.data.sunDarkCandidate, false);
  assert.equal(wei.data.sunDarkQuanshuFixedCandidate, false);
  assert.equal(ownMatch(wei.run, 3).status, 'not_matched');
});

test('the Ming solar darkness foundation matches both real guards without confirming the four hazards', () => {
  const birth = { dateStr: '1988-05-15', timeIndex: 3, gender: '女' };
  const { run, fact, data } = submittedCompleteBirth({ ...birth, year: 2050 });
  assert.equal(data.sunMingDimPairDoubleGuard, true);
  assert.equal(data.sunDarkMingDoubleGuardCandidate, true);
  assert.deepEqual(data.sunDarkMingDoubleGuardWitness, { branch: '申',
    jumen: { star: '巨门', branch: '申', relation: '守' }, fire: { star: '火星', branch: '寅', relation: '冲' },
    bell: { star: '铃星', branch: '戌', relation: '其他' }, yangTuo: [{ star: '陀罗', branch: '辰', relation: '三合' }],
  });
  const hit = ownMatch(run, 3);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '偏垣逢暗度');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-solar-darkness'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /大限、小限实守申宫的太阳与巨门/u);
  assert.match(audit, /火星在寅宫，与太阳为冲.*陀罗在辰宫，与太阳为三合.*明刊铃星在戌宫，未到会/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /偏垣逢暗度/u);
  assert.doesNotMatch(prompt, /大限、小限实守申宫的太阳与巨门|sunDarkMingDoubleGuardWitness|二限若值此，必定賣田園/u);
  assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === hit.knowledgeId)));

  const calculate = (natal, frame) => quanshuSolarWuPoLimits(quanshuLimitBranches(natal, frame), quanshuTransformLimits(natal, frame));
  const { natal, frame } = natalAndFrame({ ...birth, year: 2050 });
  const tuoluo = position(natal, '陀罗');
  const misplaced = tuoluo.minorStars.find(row => row.name === '陀罗');
  tuoluo.minorStars = tuoluo.minorStars.filter(row => row !== misplaced);
  tuoluo.adjectiveStars.push(misplaced);
  const wrongLayer = calculate(natal, frame);
  assert.equal(wrongLayer.sunDarkMingDoubleGuardCandidate, undefined);
  assert.equal(wrongLayer.sunMingDimPairDoubleGuard, true);
  assert.equal(ownMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 3).matchedSourceExcerpt, '偏垣逢暗度');
  const jumenSeat = position(natal, '巨门');
  const jumen = jumenSeat.majorStars.find(row => row.name === '巨门');
  jumenSeat.majorStars = jumenSeat.majorStars.filter(row => row !== jumen);
  jumenSeat.adjectiveStars.push(jumen);
  const wrongJumen = calculate(natal, frame);
  assert.equal(wrongJumen.sunMingDimPairDoubleGuard, undefined);
  assert.equal(ownMatch({ ...run, facts: [{ ...fact, normalizedPayload: wrongJumen }] }, 3).status, 'unknown');
  const archiveOnly = { ...fact, normalizedPayload: { ...data, starPlacementProof: undefined } };
  assert.equal(ownMatch({ ...run, facts: [archiveOnly] }, 3).status, 'unknown');

  for (const year of [2002, 2051]) {
    const other = natalAndFrame({ ...birth, year });
    const alternate = calculate(other.natal, other.frame);
    assert.equal(alternate.sunMingDimPairDoubleGuard, false, String(year));
    assert.equal(alternate.sunDarkMingDoubleGuardCandidate, false, String(year));
    assert.equal(alternate.sunDarkMingDoubleGuardWitness, undefined, String(year));
    if (year === 2002) assert.equal(alternate.sunDarkQuanshuFixedCandidate, true);
  }
});

test('p020 and p042 rule out simultaneous natal hazards in all three Fire and Bell profiles', () => {
  const bothReach = (anchor, seats) => seats.every(seat => quanshuPalaceRelation(anchor, seat) !== '其他');
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const doubleYangTuoStems = stems.filter(stem => {
    const { qingyangBranch, tuoluoBranch } = quanshuLuYangTuo(stem);
    return bothReach('申', [qingyangBranch, tuoluoBranch]);
  });
  assert.deepEqual(doubleYangTuoStems, ['乙']);
  // The p042 source-hour void test independently derives Ji and Xin as the only
  // stems that place Authority, Prosperity and Taboo in one natal palace.
  const tripleStems = ['己', '辛'];
  const pairsReachingShen = { quanshuFixedFireBell: 0, archivedFireBell: 0, jielanFireBell: 0 };
  const natal = native({ dateStr: '1988-05-15', timeIndex: 3, gender: '女' });
  for (const [yearIndex, yearBranch] of branches.entries()) {
    const compatibleStems = stems.filter((_, index) => index % 2 === yearIndex % 2);
    const hasDoubleYangTuo = compatibleStems.some(stem => doubleYangTuoStems.includes(stem));
    const hasSameStemTriple = compatibleStems.some(stem => tripleStems.includes(stem));
    for (const birthHour of branches) {
      const positions = readQuanshuArchivedFireBell(natal, yearBranch, birthHour);
      for (const profile of Object.keys(pairsReachingShen)) {
        const pair = positions[profile].map(star => star.branch);
        const label = `${profile} ${yearBranch} ${birthHour}`;
        const bothAtShen = bothReach('申', pair);
        if (bothAtShen) pairsReachingShen[profile] += compatibleStems.length;
        if (hasDoubleYangTuo) assert.equal(bothAtShen, false, `p020 ${label}`);
        if (hasSameStemTriple) assert.ok(branches.every(anchor => !bothReach(anchor, pair)), `p042 ${label}`);
      }
    }
  }
  assert.deepEqual(pairsReachingShen, { quanshuFixedFireBell: 0, archivedFireBell: 75, jielanFireBell: 75 });
});

test('missing geometry and an unrelated emitter frame cannot prove absence', () => {
  const sun = natalAndFrame(ref.branchExamples.sunClear);
  const sunLimits = quanshuLimitBranches(sun.natal, sun.frame), emitters = quanshuTransformLimits(sun.natal, sun.frame);
  const wrongYear = quanshuSolarWuPoLimits(sunLimits, { ...emitters, lunarYear: sun.frame.lunarYear - 1 });
  assert.equal(wrongYear.sun.guarded, true);
  assert.equal(wrongYear.sunHarmoniousCandidate, undefined);

  const wu = natalAndFrame(ref.examples.wuMinor);
  removeStar(wu.natal, '文昌');
  const missingChang = quanshuSolarWuPoLimits(quanshuLimitBranches(wu.natal, wu.frame), quanshuTransformLimits(wu.natal, wu.frame));
  assert.equal(missingChang.wu.verseGrade, '庙');
  assert.equal(missingChang.wuTempleChangCandidate, undefined);
  assert.equal(missingChang.wuTemplePlainCandidate, undefined);

  const po = natalAndFrame(ref.branchExamples.poSupport);
  removeStar(po.natal, '火星');
  const missingFire = quanshuSolarWuPoLimits(quanshuLimitBranches(po.natal, po.frame), quanshuTransformLimits(po.natal, po.frame));
  assert.equal(missingFire.poTempleSupportCandidate, undefined);
});

test('the four SQLite mappings preserve source hashes and apply their recorded northern limit phases', () => {
  for (const e of ref.passages) {
    const rule = fortuneKnowledge.ziwei.rules.find(r => r.knowledgeId === e.knowledgeId), source = fortuneKnowledge.ziwei.entries.find(s => s.id === e.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: source.evidence, conditions: source.conditions })).digest('hex'));
    const poJun = rule.knowledgeId.includes('pojun-limit');
    const wuQu = rule.knowledgeId.includes('wuqu-limit');
    assert.equal(rule.queries.length, 1);
    assert.equal(rule.queries[0].factType, poJun || wuQu ? 'quanshu_timed_limit_condition' : branchFactType);
    if (poJun || wuQu) {
      assert.equal(rule.queries[0].where.sourceFactType, branchFactType);
      assert.equal(rule.queries[0].where.activeInSourceHalf, true);
    }
    assert.equal(rule.queries[0].where.sourceProfile ?? rule.queries[0].where.profile, quanshuSolarWuPoPolicy.profile);
    assert.ok(rule.unresolved.length > 0);
    assert.equal(rule.queries[0].scope, 'yearly');
  }
});

test('old generic palace records and missing verse context cannot satisfy the new source premises', () => {
  const example = branchExample(ref.branchExamples.sunDark);
  assert.equal(ownMatch(example.run, 3).status, 'partial');
  const run = { ...example.run, facts: example.run.facts.filter(f => f.factType !== branchFactType) };
  assert.equal(ownMatch(run, 0).status, 'unknown'); assert.equal(ownMatch(run, 3).status, 'unknown');
  assert.ok(ownFacts(run).some(f => f.normalizedPayload.verseSunAtFocus));
  assert.ok(run.facts.some(f => f.factType === 'palace_mapping'));
});

test('subject backgrounds render in Chinese with unknown cells, distinct source tables and no JSON or source-query fields', () => {
  const run = runFor(ref.examples.sunChou), fact = ownFacts(run).find(f => f.normalizedPayload.verseSunAtFocus);
  const prose = describeFortuneFact({ method: 'ziwei', type: fact.factType, data: fact.normalizedPayload }, String);
  for (const expected of ['太阳在本命', '卷二本星逐宫段等级为陷', '卷一玉蟾段未列该支', '不预设两限必须同时到同一颗星', '文昌临左右不擅定为夹宫', '本命生年表']) assert.ok(prose.includes(expected), expected);
  for (const hidden of ['verseSubjects', 'verseProfile', 'source_calculated', 'archive_product_hour', 'gradeAgreement', '{', '[']) assert.ok(!prose.includes(hidden), hidden);
});

test('local audit keeps solar conditions and model transport withholds all four incomplete source paragraphs', async () => {
  const { run } = branchExample(ref.branchExamples.sunDark), report = interpretFortune(run, requestForFortuneRun(run));
  const { input } = buildFortuneModelContext(run, report), before = structuredClone(input);
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /暗度暂按巨门见位核对/u);
  assert.match(audit, /巨门在申宫，与太阳为守/u);
  const provider = createFortuneDeepSeek({ apiKey: 'test-only', transport: async (_, options) => {
    const payload = JSON.parse(options.body), prompt = payload.messages[1].content;
    assert.equal(prompt, formatFortunePrompt(input)); assert.throws(() => JSON.parse(prompt));
    assert.doesNotMatch(prompt, /暗度暂按巨门见位核对|巨门在申宫，与太阳为守/u);
    for (const e of ref.passages) assert.ok(!input.sections.some(s => s.findings.some(f => f.knowledgeId === e.knowledgeId)));
    for (const secret of ['verse-private-', 'verseSubjects', 'verseProfile', 'normalizedPayload', 'sourceHourRuleVerified', 'sunDarkCandidate', '{', '[']) assert.ok(!prompt.includes(secret), secret);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input); assert.deepEqual(input, before);
});
