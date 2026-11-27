import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt, describeFortuneFact } from './control/fortune-prompt.mjs';
const { quanshuFireBellAnchors, quanshuFireBellCondition, quanshuHorseBranch } = await import('./control/ziwei-firebell.ts');
const { quanshuBrightness, quanshuLunarMidnight, quanshuLuYangTuo, quanshuMinorLimit, quanshuPalaceRelation } = await import('./control/ziwei-quanshu.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitVerseContacts } = await import('./control/ziwei-limit-verse-contacts.ts');
const { quanshuLimitTiming } = await import('./control/ziwei-limit-timing.ts');
const { quanshuSolarWuPoLimits } = await import('./control/ziwei-solar-wu-po-limits.ts');
const { quanshuSupportCondition } = await import('./control/ziwei-source-support.ts');
const { quanshuTimedBell, quanshuTimedPo, quanshuTimedSupport, quanshuTimedTong } = await import('./control/ziwei-timed-limit-conditions.ts');
const { quanshuTransformLimits } = await import('./control/ziwei-transform-limits.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-firebell-reference.json', import.meta.url)));
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const native = (example = {}) => astro.withOptions({ dateStr: '1990-05-05', timeIndex: 2, gender: '女', ...example, fixLeap: true, config }).toJSON();
const all = palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const chart = natal => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot, year = 2026) {
  const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  return calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse(`${year}-11-19T03:00:00Z`), 'server'),
    'firebell-run', { snapshotId: 'firebell-snapshot', chart: snapshot });
}
const cache = new Map();
const real = e => { const key = [e.dateStr, e.timeIndex, e.gender, e.year].join(':'); if (!cache.has(key)) cache.set(key, calculate(chart(native(e)), e.year)); return cache.get(key); };
const ruleNumber = n => fortuneKnowledge.ziwei.rules.find(r => r.knowledgeId.includes('expansion-p' + String(n).padStart(3, '0') + '-'));
const match = (run, n) => matchFortuneKnowledge(run).byMethod.ziwei.find(r => r.knowledgeId === ruleNumber(n).knowledgeId);
const specific = run => run.facts.filter(f => f.factType === 'quanshu_firebell_context');
const verseFactType = 'quanshu_limit_verse_contacts';
const timedType = 'quanshu_timed_limit_condition';
const timedFrom = (fact, type) => fact.factType === timedType && fact.normalizedPayload.sourceFactType === type;
const timedBell = fact => timedFrom(fact, verseFactType) && fact.normalizedPayload.star === '铃星';
const timedTong = fact => timedFrom(fact, verseFactType) && fact.normalizedPayload.star === '天同';
const verseRules = [1, 3, 27, 28, 30, 31, 37];
const exampleFor = n => reference.examples.find(e => e.n === n);
const selectVerse = (run, year) => {
  const facts = run.facts.filter(f => (f.factType !== verseFactType && !timedFrom(f, verseFactType))
    || f.normalizedPayload.lunarYear === year);
  const verse = facts.find(f => f.factType === verseFactType);
  assert.ok(verse);
  return { run: { ...run, facts }, verse, data: verse.normalizedPayload };
};
const knownVerse = example => selectVerse(real(example), example.year);
function submittedVerse(name, birthContext) {
  const example = typeof name === 'string' ? reference.verseSamples[name] : name;
  const label = typeof name === 'string' ? name : 'xiang-' + example.dateStr;
  const year = example.year;
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: label, chart: chart(native(example)) };
  if (birthContext) ref.chart.birthContext = birthContext;
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), label, ref);
  validateFortuneFacts(bound);
  return selectVerse(bound, year);
}
const natalAndFrame = example => {
  const archive = astro.withOptions({ ...example, fixLeap: true, config });
  const h = archive.horoscope(example.year + '-06-01', 6);
  return { natal: archive.toJSON(), frame: { lunarYear: example.year, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index } };
};

test('three timed verses require the actual archived Fire and Bell layer without losing an independently verified companion', () => {
  const cases = [
    { dateStr: '1947-02-05', timeIndex: 7, year: 1966, star: '破军', wrong: '铃星', suffix: 'pojun-limit-p059',
      flag: 'poTemplePlainCandidate', base: 'poTempleAtVerifiedLimitCandidate' },
    { dateStr: '1991-02-16', timeIndex: 2, year: 1998, star: '天同', wrong: '铃星', suffix: 'expansion-p028',
      flag: 'tongFallenOpposedCandidate' },
    { dateStr: '1960-05-05', timeIndex: 1, year: 2027, star: '天梁', wrong: '火星', suffix: 'expansion-p032',
      flag: 'tianliangCombinedShaCandidate', base: 'tianliangPlainGuardCandidate' },
  ];
  for (const { star, wrong, suffix, flag, base, ...birth } of cases) {
    const example = { ...birth, gender: '女' }, run = real(example);
    const active = run.facts.find(row => row.factType === timedType && row.normalizedPayload.lunarYear === example.year
      && row.normalizedPayload.star === star && row.normalizedPayload.activeInSourceHalf === true
      && row.normalizedPayload[flag] === true);
    assert.ok(active, star);
    const knowledgeId = fortuneKnowledge.ziwei.rules.find(rule => rule.knowledgeId.endsWith(suffix + '-001')).knowledgeId;
    const evaluate = normalizedPayload => matchFortuneKnowledge({ ...run, facts: [{ ...active, normalizedPayload }] })
      .byMethod.ziwei.find(rule => rule.knowledgeId === knowledgeId);
    const isolate = payload => base ? { ...payload, [base]: false } : payload;
    const actual = evaluate(isolate(active.normalizedPayload));
    assert.equal(actual.status, 'partial', star);
    assert.deepEqual(actual.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
    const { archivedFireBellPlacementProof, ...older } = active.normalizedPayload;
    assert.equal(archivedFireBellPlacementProof, 'quanshu-archive-firebell-helper-layer-v1');
    assert.equal(evaluate(isolate(older)).status, 'unknown', star);

    const { natal, frame } = natalAndFrame(example);
    const moveLayer = name => {
      const copy = structuredClone(natal);
      const palace = copy.palaces.find(row => row.minorStars.some(entry => entry.name === name));
      const [archived] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === name), 1);
      palace.adjectiveStars.push(archived);
      return copy;
    };
    const recalculate = changed => {
      const limits = quanshuLimitBranches(changed, frame);
      const [timing] = quanshuLimitTiming(changed, limits, { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) },
        { ...frame, age: frame.lunarYear - changed.rawDates.lunarDate.lunarYear + 1 });
      const archive = limits.adverse.find(row => row.name === '归档火铃').stars;
      if (star === '破军') {
        const source = quanshuSolarWuPoLimits(limits, quanshuTransformLimits(changed, frame));
        return { archive, payload: quanshuTimedPo(timing.data, source) };
      }
      if (star === '天同') return { archive, payload: quanshuTimedTong(timing.data, quanshuLimitVerseContacts(limits)) };
      const source = quanshuSupportCondition(changed, frame.minorIndex, frame.yearIndex, frame.lunarYear, 'minor', frame.decadalIndex);
      return { archive, payload: quanshuTimedSupport(timing.data, source, 'minor', limits.minorBranch).find(row => row.star === star) };
    };
    const misplaced = recalculate(moveLayer(wrong));
    assert.deepEqual(misplaced.archive.map(row => row.branch === undefined), wrong === '火星' ? [true, false] : [false, true]);
    assert.equal(misplaced.payload.activeInSourceHalf, true, star);
    assert.equal(misplaced.payload[flag], undefined, star);
    assert.equal(evaluate(isolate(misplaced.payload)).status, 'unknown', star);
    if (base) assert.equal(evaluate(misplaced.payload).status, 'partial', star);
    else {
      const retainedBell = recalculate(moveLayer('火星')).payload;
      assert.equal(retainedBell[flag], true);
      assert.equal(evaluate(retainedBell).status, 'partial');
    }
  }
});
const removeNatalStar = (natal, name) => {
  for (const palace of natal.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[key] = palace[key].filter(row => row.name !== name);
  }
};

test('twelve birth-year rows retain the printed pair rather than presenting the product hour walk as a verified source rule', () => {
  for (const [i, branch] of branches.entries()) assert.equal(quanshuFireBellAnchors(branch).sourcePair.join(''), reference.anchorPairsByBirthYear[i]);
  assert.throws(() => quanshuFireBellAnchors('未定')); assert.throws(() => quanshuHorseBranch(''));
  assert.equal(quanshuHorseBranch('午'), '申'); assert.equal(quanshuHorseBranch('子'), '寅');
});

test('Nanyangtang volume VI fixes the named Fire and Bell seats for all four birth-year groups', () => {
  // Lunar date and hour recorded in the charts. Modern cycle equivalents keep the same stem and branch.
  const sourceCases = [
    ['2022-04-20', 10, '寅午戌', '未', '丑卯'], // Scan 100, 司馬彌
    ['2016-09-13', 1, '申子辰', '酉', '寅戌'], // Scan 100, 殷倫
    ['2005-06-06', 10, '巳酉丑', '酉', '卯戌'], // Scan 102, 杭寬
    ['1973-07-04', 4, '巳酉丑', '辰', '卯戌'], // Scan 102, 張溫
    ['2011-09-23', 1, '亥卯未', '酉', '酉戌'], // Scan 101, 項濟川
  ];
  for (const [dateStr, timeIndex, birthGroup, life, seats] of sourceCases) {
    const archive = astro.withOptions({ type: 'lunar', dateStr, timeIndex, gender: '男', fixLeap: true, config });
    const yearly = archive.horoscope('2026-06-01', 6).yearly;
    const row = quanshuFireBellCondition(archive.toJSON(), yearly.index, yearly.index, 2026, 'yearly');
    assert.equal(row.ready, true, dateStr);
    assert.equal(row.birthGroup, birthGroup);
    assert.equal(row.natalLifeBranch, life);
    assert.equal(row.quanshuFixedFireBellProfile, 'quanshu-nanyangtang-fixed-firebell-v1');
    assert.deepEqual(row.quanshuFixedFireBell, [{ star: '火星', branch: seats[0] }, { star: '铃星', branch: seats[1] }]);
    // The printed groups never place Fire or Bell at Zi, the opposition to Tong's fall at Wu.
    assert.ok(row.quanshuFixedFireBell.every(star => star.branch !== '子'));
    assert.equal(row.quanshuFixedFireAtFocus, seats[0] === row.branch);
    assert.equal(row.quanshuFixedBellAtFocus, seats[1] === row.branch);
    assert.equal(row.quanshuFixedBellAtLife, seats[1] === life);
    assert.notDeepEqual(row.quanshuFixedFireBell, row.archivedFireBell);
    assert.notDeepEqual(row.quanshuFixedFireBell, row.jielanFireBell);
  }
});

test('natal Blade, Nanyangtang fixed Bell and annual White Tiger require the same verified Life palace', () => {
  const cases = [
    { dateStr: '1994-05-15', timeIndex: 2, year: 2027, fixed: true, shifted: false, tiger: true },
    { dateStr: '1994-05-15', timeIndex: 2, year: 2026, fixed: true, shifted: false, tiger: false },
    { dateStr: '1990-02-25', timeIndex: 6, year: 2021, fixed: false, shifted: true, tiger: true },
  ];
  for (const { fixed, shifted, tiger, ...example } of cases) {
    const { year } = example;
    const request = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1);
    const ref = { snapshotId: 'firebell-fixed-snapshot', chart: chart(native(example)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, now, ref)));
    const run = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, now), 'firebell-fixed-' + year, ref);
    validateFortuneFacts(run);
    const fact = specific(run).find(f => f.scope === 'yearly' && f.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const row = fact.normalizedPayload;
    assert.equal(row.ready, true);
    assert.equal(row.qingyangAtLife, true);
    assert.equal(row.quanshuFixedBellAtLife, fixed);
    assert.equal(row.bellArchiveAtLife, shifted);
    assert.equal(row.jielanBellAtLife, shifted);
    assert.equal(row.annualWhiteTigerAtLife, tiger);
    const shouldMatch = fixed && tiger;
    const verdict = match(run, 49);
    assert.equal(verdict.status, shouldMatch ? 'matched' : 'not_matched');
    const report = interpretFortune(run, requestForFortuneRun(run), 'firebell-fixed-report');
    const { input } = buildFortuneModelContext(run, report);
    assert.equal(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === verdict.knowledgeId)), shouldMatch);
    const prompt = formatFortuneFactAudit(input);
    assert.equal(prompt.includes('按明刊取法，本命擎羊、铃星和流年四飞白虎实到同一本命命宫'), shouldMatch);
    assert.doesNotMatch(prompt, /quanshuFixedBellAtLife|nanyangtang-fixed-firebell/u);
    if (shouldMatch) {
      assert.deepEqual(verdict.sourceFactIds, [fact.factId]);
      assert.deepEqual(verdict.windows, [{ start: '2027-02-05T16:00:00.000Z', endExclusive: fact.activeTo }]);
      assert.equal(match({ ...run, facts: [ { ...fact, normalizedPayload: { ...row, quanshuFixedFireBellProfile: row.jielanFireBellProfile } } ] }, 49).status, 'not_matched');
    }
  }
});

test('Nanyangtang fixed-position branches preserve their source-specific matches and local observations', () => {
  const annualFireBell = 'quanshu_firebell_context';
  const fixedProfile = 'quanshu-nanyangtang-fixed-firebell-v1';
  const cases = [
    { n: 12, dateStr: '1980-03-15', timeIndex: 1, year: 2010, type: annualFireBell,
      field: 'quanshuFixedFireAtFocus', phrase: '火星和本命天马实守本年太岁宫', status: 'matched', check(row) {
        assert.equal(row.natalHorseAtFocus, true);
        assert.equal(row.branch, '寅');
        assert.equal(row.annualBranch, '寅');
        assert.equal(row.natalHorseBranch, '寅');
        assert.equal(row.quanshuFixedFireBell[0].branch, '寅');
        assert.equal(row.fireArchiveAtFocus, false);
        assert.equal(row.jielanFireAtFocus, false);
      } },
    { n: 12, dateStr: '1980-03-15', timeIndex: 1, year: 2000, type: annualFireBell,
      field: 'flowHorseQuanshuFixedFireCandidate', phrase: '实际守限的流马与明刊火星同宫', status: 'not_matched', check(row) {
        assert.equal(row.flowHorse.branch, '寅');
        assert.deepEqual(row.flowHorse.guardingLimits, ['minor']);
        assert.deepEqual([row.annualBranch, row.natalHorseBranch, row.quanshuFixedFireBell[0].branch], ['辰', '寅', '寅']);
        assert.equal(row.natalHorseAtFocus, false);
        assert.equal(row.flowHorseArchiveFireCandidate, false);
        assert.equal(row.flowHorseJielanFireCandidate, false);
      } },
    { n: 23, dateStr: '1994-05-15', timeIndex: 2, year: 2027, type: 'quanshu_annual_sha',
      field: 'quanshuFixedBellTigerCandidate', phrase: '明刊铃星、本命擎羊与年度四飞白虎实守卯宫', status: 'matched', check(row) {
        assert.deepEqual(row.quanshuFixedBellTigerCase, { lifeBranch: '卯', bell: '卯', nativeYang: '卯', whiteTiger: '卯', candidate: true });
        assert.equal(row.bellTigerCase.candidate, false);
        assert.equal(row.jielanBellTigerCandidate, false);
      } },
    { n: 32, dateStr: '1988-05-15', timeIndex: 3, year: 2000, type: 'quanshu_support_condition', scope: 'minor',
      field: 'tianliangQuanshuFixedCombinedShaCandidate', phrase: '天梁实守戌宫的当前限宫。按南阳堂明刊核火铃', check(row) {
        assert.equal(row.branch, '戌');
        assert.deepEqual(row.namedSupport.tianliang.quanshuFixedCounter.map(({ star, branch, relation }) => [star, branch, relation]),
          [['擎羊', '午', '三合'], ['陀罗', '辰', '冲'], ['火星', '寅', '三合'], ['铃星', '戌', '守']]);
        assert.equal(row.tianliangCombinedShaCandidate, false);
      } },
    { n: 37, dateStr: '1980-02-15', timeIndex: 1, year: 2006, type: verseFactType,
      field: 'quanshuFixedBellCandidate', phrase: '禄存在午宫，与此宫为三合', status: 'not_matched', check(row) {
        assert.equal(row.quanshuFixedBell.bell.branch, '戌');
        assert.equal(row.quanshuFixedBell.bell.minorRelation, '守');
        assert.equal(row.quanshuFixedBell.bellWithoutNamedSupportCandidate, false);
        assert.equal(row.quanshuFixedBell.bellWithAdditionalAidCandidate, true);
        assert.equal(row.bellWithoutNamedSupportCandidate, false);
        assert.equal(row.jielanBellCandidate, false);
      } },
    { n: 37, dateStr: '1985-03-22', timeIndex: 1, year: 1994, type: verseFactType,
      field: 'quanshuFixedBellWithoutNamedSupportCandidate', phrase: '小限守戌宫的南阳堂明刊铃星', check(row) {
        assert.equal(row.quanshuFixedBell.bell.minorRelation, '守');
        assert.ok(row.quanshuFixedBell.bellAdditionalAid.every(star => star.branch && star.relation === '其他'));
        assert.equal(row.bellWithoutNamedSupportCandidate, false);
        assert.equal(row.jielanBellWithoutNamedSupportCandidate, false);
      } },
    { n: 48, dateStr: '1981-02-15', timeIndex: 1, year: 2002, type: 'quanshu_xing_ji_tiger',
      field: 'qishaQuanshuFixedBellTigerCandidate', phrase: '南阳堂明刊铃星与本命擎羊同在戌宫，与七杀宫为三合', status: 'not_matched', check(row) {
        assert.equal(row.qisha.branch, '寅');
        assert.equal(row.annualTiger, '寅');
        assert.equal(row.bellBranch, '亥');
        assert.deepEqual(row.quanshuFixedBell, { branch: '戌', relation: '三合', natalBladeAtSeat: false,
          annualBladeAtSeat: false, natalBladeAtAspect: true, annualBladeAtAspect: false });
        assert.equal(row.qishaJielanBellTigerCandidate, false);
      } },
  ];
  for (const { n, year, type, scope = 'yearly', field, phrase, check, status = 'partial', ...sample } of cases) {
    const run = real({ ...sample, year, gender: '女' });
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === type && row.scope === scope
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload[field] === true);
    assert.ok(fact, field);
    const data = fact.normalizedPayload;
    assert.equal(data.quanshuFixedFireBellProfile, fixedProfile);
    check(data);
    const source = n === 32 ? run.facts.find(row => timedFrom(row, type) && row.scope === scope
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload[field] && row.normalizedPayload.activeInSourceHalf)
      : n === 37 ? run.facts.find(row => timedBell(row) && row.normalizedPayload.lunarYear === year
        && (status === 'not_matched' || row.normalizedPayload[field] === true)) : fact;
    assert.ok(source, field);
    const candidate = match({ ...run, facts: [source] }, n);
    assert.equal(candidate.status, status, field);
    assert.deepEqual(candidate.sourceFactIds, status === 'not_matched' ? [] : [source.factId]);
    assert.deepEqual(candidate.windows, status === 'not_matched' ? [] : [{ start: source.activeFrom, endExclusive: source.activeTo }]);
    const wrongVersion = { ...source, normalizedPayload: { ...source.normalizedPayload, quanshuFixedFireBellProfile: 'other-source' } };
    if (n === 32) assert.equal(match({ ...run, facts: [wrongVersion] }, n).status, 'partial', field);
    const independent = n === 32 ? { ...wrongVersion, normalizedPayload: { ...wrongVersion.normalizedPayload, tianliangPlainGuardCandidate: false } }
      : wrongVersion;
    assert.equal(match({ ...run, facts: [independent] }, n).status, 'not_matched', field);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fixed-source-' + n));
    assert.equal(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === candidate.knowledgeId),
      status === 'matched', field);
    const audit = formatFortuneFactAudit(input);
    assert.ok(audit.includes(phrase), phrase);
    assert.ok(!audit.includes(field), field);
  }
});

test('the Ming war-horse report uses the verified natal conjunction only while Tai Sui occupies that palace', () => {
  const sample = { dateStr: '1980-03-15', timeIndex: 1, gender: '女' };
  const fixed = ruleNumber(12);
  assert.deepEqual(fixed.unresolved, []);
  assert.deepEqual(fixed.queries, [{ factType: 'quanshu_firebell_context', scope: 'yearly', where: {
    profile: 'quanshu-firebell-anchor-archive-v1', ready: true, quanshuFixedFireBellProfile: 'quanshu-nanyangtang-fixed-firebell-v1',
    quanshuFixedFireAtFocus: true, natalHorseAtFocus: true,
  } }]);

  const following = real({ ...sample, year: 2011 });
  const preceding = specific(following).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === 2010);
  const current = specific(following).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === 2011);
  assert.deepEqual([current.normalizedPayload.branch, current.normalizedPayload.natalHorseBranch], ['卯', '寅']);
  assert.equal(current.normalizedPayload.quanshuFixedFireAtFocus, false);
  assert.equal(preceding.activeTo, current.activeFrom);
  const result = match(following, 12);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.sourceFactIds, [preceding.factId]);
  assert.deepEqual(result.windows, [{ start: '2010-12-31T16:00:00.000Z', endExclusive: '2011-02-02T16:00:00.000Z' }]);
  assert.equal(match({ ...following, facts: [current] }, 12).status, 'not_matched');

  const withFlow = real({ ...sample, year: 2000 });
  const flowYear = specific(withFlow).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === 2000);
  const minor = specific(withFlow).find(row => row.scope === 'minor' && row.normalizedPayload.lunarYear === 2000);
  assert.equal(flowYear.normalizedPayload.flowHorseQuanshuFixedFireCandidate, true);
  assert.equal(minor.normalizedPayload.natalHorseAtFocus, true);
  assert.equal(minor.normalizedPayload.quanshuFixedFireAtFocus, true);
  assert.equal(match({ ...withFlow, facts: [flowYear, minor] }, 12).status, 'not_matched');

  const scoped = { ...following, facts: [preceding, current] };
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-natal-war-horse'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === fixed.knowledgeId);
  assert.ok(finding);
  const provider = formatFortunePrompt(input);
  assert.match(provider, /原文：火星同宫谓之战马/u);
  assert.match(finding.conditions.join('；'), /明刊/u);
  assert.match(finding.conditions.join('；'), /本命天马/u);
  assert.match(finding.conditions.join('；'), /太岁/u);
  assert.doesNotMatch(provider, /災病|灾病|主災|主灾|流马|流年天马|quanshuFixedFireAtFocus/u);
});

test('Nanyangtang fixed contacts distinguish Tianxiang, Taiyin and Sun limit witnesses in SQLite', () => {
  const cases = [
    { n: 3, dateStr: '1980-02-15', timeIndex: 2, year: 1989, field: 'xiangFallenQuanshuFixedOpposedCandidate',
      phrases: ['陷地天相实守限宫', '火星在酉宫'],
      check(row) {
        assert.equal(row.xiang.branch, '卯');
        assert.equal(row.xiangGrade, '陷');
        assert.equal(row.xiang.minorRelation, '守');
        assert.deepEqual(row.xiangQuanshuFixedFireBell, [{ star: '火星', branch: '酉', relation: '冲' },
          { star: '铃星', branch: '戌', relation: '其他' }]);
        assert.equal(row.xiangFireBell[0].relation, '三合');
        assert.equal(row.xiangFallenOpposedCandidate, false);
      } },
    { n: 30, dateStr: '1980-02-15', timeIndex: 2, year: 1992, field: 'yinQuanshuFixedClearFireBellCandidate',
      phrases: ['明刊火铃均已定位，太阴宫守冲三合范围均未见'],
      check(row) {
        assert.equal(row.yin.branch, '子');
        assert.equal(row.yin.minorRelation, '守');
        assert.deepEqual(row.yinQuanshuFixedFireBell.map(star => star.relation), ['其他', '其他']);
        assert.equal(row.yinQuanshuFixedPairedFireBellCandidate, false);
        assert.equal(row.yinSingleFireBellCandidate, true);
      } },
    { n: 30, dateStr: '1980-03-15', timeIndex: 6, year: 1988, field: 'yinQuanshuFixedPairedFireBellCandidate',
      phrases: ['明刊火铃均在太阴宫守冲三合范围', '火星在寅宫', '铃星在戌宫'],
      check(row) {
        assert.equal(row.yin.branch, '寅');
        assert.equal(row.yin.minorRelation, '守');
        assert.deepEqual(row.yinQuanshuFixedFireBell.map(star => [star.branch, star.relation]), [['寅', '守'], ['戌', '三合']]);
        assert.equal(row.yinQuanshuFixedClearFireBellCandidate, false);
        assert.equal(row.yinSingleFireBellCandidate, true);
      } },
    { n: 31, dateStr: '1980-05-15', timeIndex: 10, year: 2016, field: 'yinReverseQuanshuFixedFireBellCandidate',
      phrases: ['太阳在戌宫且太阴在辰宫', '小限守戌宫的明刊铃星'],
      check(row) {
        assert.equal(row.yinReverseSource, 'volume-three');
        assert.equal(row.sunBranch, '戌');
        assert.equal(row.yin.branch, '辰');
        assert.equal(row.yin.decadalRelation, '守');
        assert.equal(row.yinQuanshuFixedFireBell[1].branch, '戌');
        assert.equal(row.yinQuanshuFixedFireBell[1].minorRelation, '守');
        assert.equal(row.yinReverseFireBellCandidate, false);
      } },
    { n: 20, dateStr: '1988-05-15', timeIndex: 3, year: 2002, type: 'quanshu_solar_wu_po_limits',
      phrases: ['偏垣太阳另核明刊火铃', '巨门在申宫', '火星在寅宫', '陀罗在辰宫'],
      field: 'sunDarkQuanshuFixedCandidate', check(row) {
        assert.equal(row.sun.branch, '申');
        assert.equal(row.sun.solarPhase, '偏垣');
        assert.equal(row.sun.minorRelation, '守');
        assert.equal(row.sunDarkWitness.relation, '守');
        assert.deepEqual(row.sunDarkQuanshuFixedFireBell.map(star => [star.branch, star.relation]), [['寅', '冲'], ['戌', '其他']]);
        assert.ok(row.sunHazards.some(star => star.star === '陀罗' && star.branch === '辰' && star.relation === '三合'));
        assert.equal(row.sunDarkCandidate, false);
      } },
  ];
  for (const { n, year, type = verseFactType, field, phrases, check, ...sample } of cases) {
    const run = real({ ...sample, year, gender: '女' });
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === type && row.scope === 'yearly'
      && row.normalizedPayload.lunarYear === year && row.normalizedPayload[field] === true);
    assert.ok(fact, field);
    const data = fact.normalizedPayload;
    assert.equal(data.quanshuFixedFireBellProfile, 'quanshu-nanyangtang-fixed-firebell-v1');
    check(data);
    const verdict = match({ ...run, facts: [fact] }, n);
    assert.equal(verdict.status, 'partial', field);
    assert.deepEqual(verdict.sourceFactIds, [fact.factId]);
    assert.deepEqual(verdict.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrongProfile = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source',
      ...(n === 30 ? { yinAtVerifiedLimitCandidate: false } : {}) } };
    assert.equal(match({ ...run, facts: [wrongProfile] }, n).status, 'not_matched', field);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fixed-verse-' + field));
    assert.ok(!input.sections.some(section => section.findings.some(finding => finding.knowledgeId === verdict.knowledgeId)));
    const audit = formatFortuneFactAudit(input);
    for (const phrase of phrases) assert.ok(audit.includes(phrase), phrase);
    assert.ok(!audit.includes(field));
  }
});

test('four real birth-year groups by twelve hours reproduce compatible archive coordinates, but never certify the missing source hour method', () => {
  for (const dateStr of ['1990-05-05', '1992-05-05', '1993-06-05', '1995-05-05']) {
    let anchor;
    for (let timeIndex = 0; timeIndex < 12; timeIndex++) {
      const natal = native({ dateStr, timeIndex }), before = structuredClone(natal);
      const row = quanshuFireBellCondition(natal, 4, 4, 2026, 'yearly');
      assert.equal(row.ready, true, dateStr + ':' + timeIndex); anchor ??= row.sourcePair; assert.deepEqual(row.sourcePair, anchor);
      for (const star of row.archivedFireBell) assert.equal(natal.palaces.find(p => all(p).some(s => s.name === star.star)).earthlyBranch, star.branch);
      const expectedComparison = row.birthGroup === '巳酉丑' ? [...row.archivedFireBell].reverse() : row.archivedFireBell;
      assert.deepEqual(row.jielanFireBell.map(star => star.branch), expectedComparison.map(star => star.branch));
      assert.deepEqual(row.jielanFireBell.map(star => star.star), ['火星', '铃星']);
      assert.equal(row.sourceHourRuleVerified, false); assert.deepEqual(natal, before);
      if (timeIndex === 0) assert.equal(row.sourcePairEqualsArchive, true);
    }
  }
});

test('the Jielan named hour rule reproduces its Jia-Shen example and stays separate from the Nanyangtang match', () => {
  const example = quanshuFireBellCondition(native({ dateStr: '2004-03-15', timeIndex: 1 }), 4, 4, 2026, 'yearly');
  assert.deepEqual(example.jielanFireBell, [{ star: '火星', branch: '卯' }, { star: '铃星', branch: '亥' }]);
  const cases = [
    { n: 12, dateStr: '1997-02-15', timeIndex: 1, year: 2031, type: 'quanshu_firebell_context',
      check(p) {
        assert.equal(p.branch, '亥');
        assert.equal(p.fireArchiveAtFocus, false);
        assert.ok(p.jielanFireAtFocus && p.natalHorseAtFocus);
      }, phrase: '依《捷览》排出的火星与本命天马同在本期宫位' },
    { n: 37, dateStr: '1997-02-15', timeIndex: 2, year: 2023, type: verseFactType,
      check(p) {
        assert.equal(p.bell.branch, '子');
        assert.equal(p.bell.minorRelation, '其他');
        assert.equal(p.jielanBell.bell.branch, '巳');
        assert.equal(p.jielanBell.bell.minorRelation, '守');
        assert.equal(p.jielanBell.bellWithoutNamedSupportCandidate, false);
        assert.equal(p.jielanBell.bellWithAdditionalAidCandidate, true);
        assert.equal(p.jielanBellCandidate, true);
      }, phrase: '小限守巳宫的《捷览》所推铃星' },
    { n: 48, dateStr: '1997-05-15', timeIndex: 9, year: 2032, type: 'quanshu_xing_ji_tiger',
      check(p) {
        assert.equal(p.qisha.branch, '申');
        assert.equal(p.annualTiger, '申');
        assert.equal(p.bellBranch, '未');
        assert.equal(p.jielanBell.branch, '子');
        assert.equal(p.jielanBell.relation, '三合');
        assert.equal(p.jielanBell.annualBladeAtAspect, true);
        assert.equal(p.qishaJielanBellTigerCandidate, true);
      }, phrase: '依《捷览》排出的铃星与流年擎羊同在子宫' },
    { n: 49, dateStr: '1997-11-15', timeIndex: 4, year: 2031, type: 'quanshu_firebell_context',
      check(p) {
        assert.equal(p.natalLifeBranch, '未');
        assert.equal(p.bellArchiveAtLife, false);
        assert.equal(p.quanshuFixedBellAtLife, false);
        assert.ok(p.jielanBellAtLife && p.qingyangAtLife && p.annualWhiteTigerAtLife);
        assert.equal(p.sourceHourRuleVerified, false);
      }, phrase: '依《捷览》排出的铃星与本命擎羊、年度四飞白虎同到本命命宫' },
  ];
  for (const { n, dateStr, timeIndex, year, type, check, phrase } of cases) {
    const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.parse(`${year}-11-19T03:00:00Z`);
    const ref = { snapshotId: 'firebell-source-snapshot' };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...ref, chart: chart(native({ dateStr, timeIndex })) })));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'firebell-jielan-' + n, ref);
    validateFortuneFacts(run);
    const verdict = match(run, n);
    assert.equal(verdict.status, 'not_matched', String(n));
    const fact = run.facts.find(row => row.factType === type && row.scope === 'yearly'
      && row.normalizedPayload.lunarYear === year);
    assert.ok(fact, String(n));
    check(fact.normalizedPayload);
    assert.equal(match({ ...run, facts: [fact] }, n).status, n === 37 ? 'unknown' : 'not_matched');
    const wrongSource = { ...fact, normalizedPayload: { ...fact.normalizedPayload, jielanFireBellProfile: 'other-source' } };
    assert.equal(match({ ...run, facts: [wrongSource] }, n).status, n === 37 ? 'unknown' : 'not_matched');
    const report = interpretFortune(run, requestForFortuneRun(run), 'firebell-jielan-prompt-' + n);
    const modelInput = buildFortuneModelContext(run, report).input;
    const prompt = formatFortuneFactAudit(modelInput);
    assert.ok(prompt.includes(phrase), phrase);
    assert.ok(!modelInput.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === verdict.knowledgeId));
    if (n === 49) {
      const annual = run.facts.find(row => row.factType === 'quanshu_annual_sha' && row.normalizedPayload.lunarYear === year);
      assert.equal(annual?.normalizedPayload.jielanBellTigerCandidate, true);
      assert.equal(annual.normalizedPayload.bellTigerCase.candidate, false);
      const shaMatch = match(run, 23);
      assert.equal(shaMatch.status, 'partial');
      assert.ok(shaMatch.sourceFactIds.includes(annual.factId));
      const jielanOnly = { ...annual, normalizedPayload: { ...annual.normalizedPayload, yearlyShaCandidate: false } };
      assert.equal(match({ ...run, facts: [jielanOnly] }, 23).status, 'partial');
      assert.ok(prompt.includes('本命擎羊、《捷览》所推铃星和年度四飞白虎同在未宫'));
    }
  }
});

test('missing, duplicated or displaced archive fire/bell stars cannot become verified product coordinates', () => {
  for (const name of ['火星', '铃星']) for (const mode of ['missing', 'duplicated', 'moved']) {
    const natal = native(), palace = natal.palaces.find(p => all(p).some(s => s.name === name)), star = all(palace).find(s => s.name === name);
    if (mode !== 'duplicated') for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) palace[key] = palace[key].filter(s => s.name !== name);
    if (mode !== 'missing') natal.palaces[(palace.index + 1) % 12].minorStars.push(star);
    assert.equal(quanshuFireBellCondition(natal, 4, 4, 2026, 'yearly').ready, false, name + ':' + mode);
  }
});

test('fire/bell source grades keep Mao Wei Hai unknown; changing archive brightness cannot change source fallen Tong at Wu', () => {
  for (const star of ['火星', '铃星']) for (const [i, branch] of branches.entries()) assert.equal(quanshuBrightness(star, branch), reference.fireBellGradesByBranch[i] ?? undefined);
  const natal = native(reference.examples.find(e => e.n === 28)), palace = natal.palaces.find(p => all(p).some(s => s.name === '天同'));
  assert.equal(palace.earthlyBranch, '午');
  all(palace).find(s => s.name === '天同').brightness = '庙';
  const row = quanshuFireBellCondition(natal, palace.index, 4, 2026, 'decadal', palace.index);
  assert.ok(row.localSourceFallenStars.includes('天同'));
});

test('same, opposite, trine and adjacent sha/support positions remain distinct and named by their coordinate basis', () => {
  const natal = native();
  for (let i = 0; i < 12; i++) {
    const row = quanshuFireBellCondition(natal, i, 4, 2026, 'decadal', i);
    assert.equal(row.ready, true); assert.equal(row.fourShaRelations.length, 4);
    for (const star of row.fourShaRelations) {
      const distance = (branches.indexOf(star.branch) - branches.indexOf(row.branch) + 12) % 12;
      const expected = distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合' : [1, 11].includes(distance) ? '邻宫' : '其他';
      assert.equal(star.relation, expected);
      assert.equal(star.coordinateBasis, ['火星', '铃星'].includes(star.star) ? 'archive_product_hour' : 'source_calculated');
    }
    assert.equal(row.supportReady, true);
    assert.ok(row.sourceSupportRelations.some(s => s.star === '左辅'));
  }
});

test('natal horse identity is verified separately from the current-year candidate; corrupted natal horse is not a negative fact', () => {
  const natal = native(), row = quanshuFireBellCondition(natal, 4, 4, 2026, 'yearly');
  assert.equal(row.natalHorseVerified, true); assert.equal(row.natalHorseBranch, '申');
  assert.equal(row.annualHorseCandidateBranch, '申');
  for (const palace of natal.palaces) for (const key of ['majorStars', 'minorStars', 'adjectiveStars']) palace[key] = palace[key].filter(s => s.name !== '天马');
  const broken = quanshuFireBellCondition(natal, 4, 4, 2026, 'yearly');
  assert.equal(broken.ready, true); assert.equal(broken.natalHorseVerified, false); assert.equal(broken.natalHorseAtFocus, undefined);
});

test('nine real examples verify same-period SQLite matches and exclude broad or shifted guards', () => {
  for (const example of reference.examples) {
    const run = [27, 28].includes(example.n) ? knownVerse(example).run : real(example);
    validateFortuneFacts(run);
    const result = match(run, example.n);
    if ([3, 12, 27, 37, 49].includes(example.n)) {
      assert.equal(result.status, 'not_matched');
      assert.deepEqual(result.sourceFactIds, []);
    } else {
      assert.equal(result.status, example.n === 1 ? 'matched' : 'partial', String(example.n));
      const expectedFact = example.n === 1 ? 'quanshu_limit_star_timing'
        : example.n === 28 ? timedType : verseRules.includes(example.n) ? verseFactType : 'quanshu_firebell_context';
      assert.ok(result.sourceFactIds.length && result.sourceFactIds.every(id => run.facts.some(f => f.factId === id && f.factType === expectedFact)));
    }
    assert.ok(specific(run).every(f => f.normalizedPayload.sourceHourRuleVerified === false));
    if (example.n === 49) assert.ok(specific(run).some(f => f.normalizedPayload.qingyangAtLife && f.normalizedPayload.bellArchiveAtLife && f.normalizedPayload.annualWhiteTigerAtLife));
  }
});

test('the base Nanyang Tong verse and the separate fallen opposition can match the same actual half', () => {
  const opposition = knownVerse(exampleFor(28));
  assert.equal(opposition.verse.scope, 'yearly');
  assert.equal(opposition.data.tongSourceGrade, '陷');
  assert.equal(opposition.data.tong.branch, '午');
  assert.ok(opposition.data.tongSha.some(row => row.star === '归档铃星' && row.branch === '子' && row.relation === '冲'));
  const opposing = match(opposition.run, 28), base = match(opposition.run, 27);
  assert.equal(opposing.status, 'partial');
  assert.equal(base.status, 'matched');
  assert.deepEqual(base.sourceFactIds, opposing.sourceFactIds);
  assert.deepEqual(base.windows, opposing.windows);

  const trine = knownVerse(reference.verseSamples.tongTrineOnly);
  assert.equal(trine.data.tongSourceGrade, '陷');
  assert.ok(trine.data.tongSha.some(row => row.relation === '三合'));
  assert.ok(trine.data.tongJi.every(row => row.relation === '三合'));
  assert.equal(match(trine.run, 28).status, 'not_matched');
  assert.equal(match(trine.run, 27).status, 'matched');
  const differentPalace = knownVerse(exampleFor(27));
  assert.equal(differentPalace.data.tongSourceGrade, '不得地');
  assert.equal(match(differentPalace.run, 27).status, 'not_matched');
});

test('p028 confirms Tai Sui and two verified southern Tong guards with an actual annual Yang opposition', () => {
  const sample = { dateStr: '1959-09-05', timeIndex: 6, year: 2002, gender: '女' };
  const { run, verse, data } = submittedVerse(sample);
  assert.deepEqual(data.tong, { branch: '午', annualRelation: '守', decadalRelation: '守', minorRelation: '守' });
  assert.equal(data.tongSourceGrade, '陷');
  assert.deepEqual(data.tongAnnualYangTuo.map(({ star, branch, relation }) => [star, branch, relation]),
    [['流年擎羊', '子', '冲'], ['流年陀罗', '戌', '三合']]);
  const slices = run.facts.filter(row => timedFrom(row, verseFactType) && row.normalizedPayload.star === '天同');
  const boundary = new Date(quanshuLunarMidnight(sample.year, 7)).toISOString();
  const exact = slices.find(row => row.activeFrom === boundary);
  assert.ok(exact);
  assert.deepEqual(exact.normalizedPayload.guardScopes, ['decadal', 'minor']);
  assert.equal(exact.normalizedPayload.tongFallenAnnualOpposedAtTaiSuiCandidate, true);
  const evaluate = facts => match({ ...run, facts }, 28);
  const hit = evaluate(slices);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [exact.factId]);
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: verse.activeTo }]);
  const early = slices.filter(row => row.activeTo <= boundary);
  assert.ok(early.every(row => row.normalizedPayload.guardScopes.length < 2));
  assert.equal(evaluate(early).status, 'partial');
  const selected = { ...run, facts: [verse, ...slices] };
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'tong-double-southern-yang'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /太岁及复核大小限都到午宫陷地天同/u);
  assert.doesNotMatch(prompt, /午宫天同守限，同年流曜实际对冲此宫|tongFallenAnnualOpposedAtTaiSuiCandidate/u);

  const { natal, frame } = natalAndFrame(sample);
  const wrong = { ...frame, age: sample.year - natal.rawDates.lunarDate.lunarYear + 1, minorIndex: (frame.minorIndex + 1) % 12 };
  const limits = quanshuLimitBranches(natal, wrong);
  const window = { start: Date.parse(exact.activeFrom), end: Date.parse(exact.activeTo) };
  const coeval = quanshuLimitTiming(natal, limits, window, wrong)[0].data;
  const mismatch = quanshuTimedTong(coeval, quanshuLimitVerseContacts(limits));
  assert.deepEqual(mismatch.guardScopes, ['decadal']);
  assert.equal(evaluate([{ ...exact, normalizedPayload: mismatch }]).status, 'partial');
  const next = natalAndFrame({ ...sample, year: 2003 });
  const nearby = quanshuLimitVerseContacts(quanshuLimitBranches(next.natal, next.frame));
  assert.equal(nearby.tongFallenAnnualOpposedAtTaiSuiCandidate, false);
});

test('p028 separates the unreachable natal Yang opposition from the small-limit and Tai Sui coincidence', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const stemsPuttingYangAtZi = stems.filter(stem => quanshuLuYangTuo(stem).qingyangBranch === '子');
  assert.deepEqual(stemsPuttingYangAtZi, ['壬']);
  assert.ok(stems.every(stem => quanshuLuYangTuo(stem).tuoluoBranch !== '子'));
  const birthsAllowingSameSeat = [];
  for (const [birthIndex, birthBranch] of branches.entries()) {
    const taiSuiWuAge = (branches.indexOf('午') - birthIndex + 12) % 12 + 1;
    for (const gender of ['男', '女']) {
      if (quanshuMinorLimit(birthBranch, gender, taiSuiWuAge).branch === '午') {
        birthsAllowingSameSeat.push([birthBranch, gender]);
        // The admissible stems of each birth pillar share the branch's polarity.
        assert.ok(stems.filter((_, index) => index % 2 === birthIndex % 2).every(stem => !stemsPuttingYangAtZi.includes(stem)));
      }
    }
  }
  assert.deepEqual(birthsAllowingSameSeat, [['巳', '女'], ['亥', '女']]);
});

test('p028 requires natal blade opposition in the verified auxiliary layer', () => {
  const example = { dateStr: '1982-05-15', timeIndex: 4, year: 2059, gender: '女' };
  const { run, data } = submittedVerse(example);
  assert.deepEqual(data.tongSha.filter(row => row.relation === '冲'), [{ star: '擎羊', branch: '子', relation: '冲' }]);
  assert.deepEqual([data.tongFallenAnnualOpposedCandidate, data.tongFallenVoidsOpposedCandidate,
    data.tongFallenJiOpposedCandidate], [false, false, false]);
  const fact = run.facts.find(row => timedTong(row) && row.normalizedPayload.tongFallenOpposedCandidate === true
    && row.normalizedPayload.activeInSourceHalf === true);
  assert.ok(fact);
  assert.equal(match({ ...run, facts: [fact] }, 28).status, 'partial');
  const { natal, frame } = natalAndFrame(example);
  const child = natal.palaces.find(row => row.earthlyBranch === '子');
  const [blade] = child.minorStars.splice(child.minorStars.findIndex(row => row.name === '擎羊'), 1);
  child.adjectiveStars.push(blade);
  const limits = quanshuLimitBranches(natal, frame), window = { start: Date.parse(fact.activeFrom), end: Date.parse(fact.activeTo) };
  const [timing] = quanshuLimitTiming(natal, limits, window, { ...frame, age: limits.sourceMinor.ordinal });
  const context = quanshuLimitVerseContacts(limits);
  assert.equal(context.tongSha.find(row => row.star === '擎羊').relation, undefined);
  const wrongLayer = quanshuTimedTong(timing.data, context);
  assert.equal(wrongLayer.activeInSourceHalf, true);
  assert.equal(wrongLayer.tongFallenOpposedCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongLayer }] }, 28).status, 'unknown');
});

test('p028 independently checks voids and both Ji layers at the actual opposed Tong limit', () => {
  for (const [name, start, witness, wording] of [
    ['tongRobberyOpposition', '1998-08-21T16:00:00.000Z', { star: '地劫', branch: '子', relation: '冲' },
      '对宫见已核空劫星位，地劫在子宫'],
    ['tongSkyOpposition', null, { star: '古天空', branch: '子', relation: '冲' },
      '对宫见已核空劫星位，古天空在子宫'],
    ['tongNatalJiOpposition', '1990-08-19T16:00:00.000Z', { layer: 'natal', stem: '辛', star: '文昌', branch: '子', relation: '冲' },
      '本命生年干辛使文昌化忌，文昌在子宫对冲天同限宫'],
    ['tongYearJiOpposition', '2019-02-04T16:00:00.000Z', { layer: 'yearly', stem: '己', star: '文曲', branch: '子', relation: '冲' },
      '以流年干己延用生年表，候选为文曲化忌，文曲在子宫对冲天同限宫'],
  ]) {
    const { run, verse, data } = submittedVerse(name);
    assert.equal(data.tong.branch, '午', name);
    assert.ok([data.tong.decadalRelation, data.tong.minorRelation].includes('守'), name);
    assert.deepEqual([data.tongFallenOpposedCandidate, data.tongFallenAnnualOpposedCandidate], [false, false], name);
    assert.deepEqual([data.tongFallenVoidsOpposedCandidate, data.tongFallenJiOpposedCandidate], [!witness.layer, Boolean(witness.layer)], name);
    const contacts = witness.layer ? data.tongJi : data.tongVoids;
    assert.deepEqual(contacts.filter(row => row.relation === '冲'), [witness], name);
    const hit = match(run, 28);
    const base = match(run, 27);
    const timeBound = run.facts.filter(f => timedTong(f) && f.normalizedPayload.activeInSourceHalf);
    assert.equal(hit.status, start ? 'partial' : 'not_matched', name);
    assert.equal(base.status, start ? 'matched' : 'not_matched', name);
    assert.deepEqual(hit.sourceFactIds, timeBound.map(f => f.factId), name);
    assert.deepEqual(hit.windows, start ? [{ start, endExclusive: verse.activeTo }] : [], name);
    assert.deepEqual(base.sourceFactIds, hit.sourceFactIds, name);
    assert.deepEqual(base.windows, hit.windows, name);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(wording), name);
    assert.doesNotMatch(prompt, /tongVoids|tongJi|tongFallenJiOpposedCandidate/u);
  }

  const { natal, frame } = natalAndFrame(reference.verseSamples.tongYearJiOpposition);
  removeNatalStar(natal, '文曲');
  const missing = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(missing.tongFallenJiOpposedCandidate, undefined);
  assert.equal(missing.tongSupportCandidate, undefined);
});

test('same-year flowing Yang and Tuo reach the Tong and reversed Yin limit rules through client facts and SQLite', () => {
  const cases = [
    { n: 28, dateStr: '1990-02-15', timeIndex: 5, year: 2012, start: '2012-08-16T16:00:00.000Z',
      flow: [['流年擎羊', '子', '冲'], ['流年陀罗', '戌', '三合']], text: '午宫天同守限，同年流曜实际对冲此宫，流年擎羊在子宫' },
    { n: 31, dateStr: '1970-01-02', timeIndex: 0, year: 2011, start: '2011-02-02T16:00:00.000Z',
      flow: [['流年擎羊', '戌', '冲'], ['流年陀罗', '申', '三合']], text: '反背的太阴实守限宫，同年流曜三合此宫，流年陀罗在申宫' },
    { n: 31, dateStr: '1970-01-02', timeIndex: 0, year: 2012, start: '2012-01-22T16:00:00.000Z',
      flow: [['流年擎羊', '子', '三合'], ['流年陀罗', '戌', '冲']], text: '反背的太阴实守限宫，同年流曜三合此宫，流年擎羊在子宫' },
  ];
  for (const { n, dateStr, timeIndex, year, start, flow, text } of cases) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'flow-limit-verse-' + n + '-' + year, chart: chart(native({ dateStr, timeIndex })) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'flow-limit-verse', ref);
    validateFortuneFacts(bound);
    const { run, verse, data } = selectVerse(bound, year);
    if (n === 28) {
      assert.deepEqual([data.tong.branch, data.tong.minorRelation, data.tongSourceGrade], ['午', '守', '陷']);
      assert.deepEqual([data.tongFallenOpposedCandidate, data.tongFallenAnnualOpposedCandidate, data.tongSupportCandidate],
        [false, true, false]);
      assert.equal(match(run, 27).status, 'matched');
    } else {
      assert.deepEqual([data.sunBranch, data.yin.branch, data.yin.decadalRelation], ['戌', '辰', '守']);
      assert.deepEqual([data.yinReverseYangTuoCandidate, data.yinReverseAnnualYangTuoCandidate, data.yinReverseFireBellCandidate],
        [false, true, false]);
    }
    assert.deepEqual((n === 28 ? data.tongAnnualYangTuo : data.yinAnnualYangTuo).map(row => [row.star, row.branch, row.relation]), flow);
    const result = match(run, n);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.windows, [{ start, endExclusive: year + '-12-31T16:00:00.000Z' }]);
    const usedFacts = n === 28 ? run.facts.filter(f => timedTong(f) && f.normalizedPayload.activeInSourceHalf) : [verse];
    assert.deepEqual(result.sourceFactIds, usedFacts.map(f => f.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'flow-limit-verse'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(text), text);
    assert.doesNotMatch(prompt, /tongFallenAnnualOpposedCandidate|yinReverseAnnualYangTuoCandidate|yinAnnualYangTuo/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
  }

  const withoutTrine = knownVerse({ dateStr: '1970-01-02', timeIndex: 0, gender: '女', year: 2013 });
  assert.equal(withoutTrine.data.yin.decadalRelation, '守');
  assert.equal(withoutTrine.data.yinReverseAnnualYangTuoCandidate, false);
  assert.equal(match(withoutTrine.run, 31).status, 'not_matched');
  const { natal, frame } = natalAndFrame({ dateStr: '1970-01-02', timeIndex: 0, gender: '女', year: 2011 });
  const withoutLimit = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, decadalIndex: undefined }));
  assert.equal(withoutLimit.yinAnnualYangTuo[1].relation, '三合');
  assert.equal(withoutLimit.yinReverseAnnualYangTuoCandidate, undefined);
});

test('Ji separates the actual limit, the two source grade lists and full named contact groups', () => {
  const samples = reference.verseSamples;
  const supporting = knownVerse(samples.jiSupported), fallen = knownVerse(samples.jiFallenSha);
  assert.equal(supporting.data.ji.minorRelation, '守');
  assert.deepEqual(supporting.data.jiSupport.map(row => [row.star, row.relation]),
    [['天梁', '冲'], ['左辅', '冲'], ['右弼', '冲'], ['文昌', '三合'], ['文曲', '三合']]);
  assert.deepEqual([supporting.data.jiGrade, supporting.data.jiSupportCandidate, supporting.data.jiFallenShaCandidate], ['陷', true, false]);
  assert.equal(fallen.data.ji.decadalRelation, '守');
  assert.deepEqual(fallen.data.jiSha.map(row => [row.star, row.relation]),
    [['擎羊', '三合'], ['陀罗', '冲'], ['归档火星', '三合'], ['归档铃星', '冲']]);
  assert.deepEqual([fallen.data.jiBaseCandidate, fallen.data.jiSupportCandidate, fallen.data.jiFallenShaCandidate], [false, false, true]);
  const song = knownVerse(samples.jiSongOnlyGrade);
  assert.equal(song.data.ji.branch, '戌');
  assert.equal(song.data.jiGrade, undefined);
  assert.equal(song.data.jiQuestionSongTemple, true);
  for (const { run, verse } of [supporting, fallen, song]) {
    assert.equal(match({ ...run, facts: [verse] }, 1).status, 'unknown');
  }
  const { natal, frame } = natalAndFrame(samples.jiFallenSha);
  removeNatalStar(natal, '火星');
  const missing = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(missing.ji.decadalRelation, '守');
  assert.equal(missing.jiFallenShaCandidate, undefined);
  assert.equal(missing.jiBaseCandidate, undefined);
});

test('Ji fallen in Wei can meet four Ming Sha even when the archived fire and bell miss', () => {
  const example = { dateStr: '1974-02-05', timeIndex: 1, gender: '女', year: 1995 };
  const { run, verse, data } = knownVerse(example);
  assert.equal(data.ji.branch, '未');
  assert.equal(data.jiGrade, '陷');
  assert.equal(data.ji.minorRelation, '守');
  assert.equal(data.jiFallenShaCandidate, false);
  assert.equal(data.jiMingFixedFourShaCandidate, true);
  assert.deepEqual(data.jiMingFixedSha, [
    { star: '擎羊', branch: '卯', relation: '三合' },
    { star: '陀罗', branch: '丑', relation: '冲' },
    { star: '火星', branch: '丑', relation: '冲' },
    { star: '铃星', branch: '卯', relation: '三合' },
  ]);
  assert.ok(data.jiSha.filter(row => row.star.startsWith('归档')).every(row => row.relation === '其他'));
  assert.equal(match({ ...run, facts: [verse] }, 1).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-tianji'));
  assert.match(formatFortuneFactAudit(input), /陷地天机依明刊并列四煞守冲三合，至少一曜实冲/u);
  assert.doesNotMatch(formatFortunePrompt(input), /陷地天机依明刊并列四煞/u);
  const next = knownVerse({ ...example, year: 1996 });
  assert.equal(next.data.ji.minorRelation, '其他');
  assert.equal(next.data.jiMingFixedFourShaCandidate, false);
  const nextTiming = next.run.facts.filter(fact => fact.factType === 'quanshu_limit_star_timing' && fact.normalizedPayload.lunarYear === 1996);
  assert.equal(match({ ...next.run, facts: nextTiming }, 1).status, 'not_matched');
  const { natal, frame } = natalAndFrame(example);
  const leftOut = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: undefined }));
  assert.equal(leftOut.jiMingFixedFourShaCandidate, undefined);
});

test('Xiang separates verified temple aid, fallen Lian-Po with Yang-Tuo and fire/bell opposition', () => {
  const samples = reference.verseSamples;
  const temple = knownVerse(samples.xiangTempleAid), group = knownVerse(samples.xiangFallenLianPoYangTuo);
  const opposed = knownVerse(samples.xiangFallenOpposed);
  assert.equal(temple.data.xiangGrade, '庙');
  assert.ok(temple.data.xiangSupport.every(row => row.relation === '守'));
  assert.equal(temple.data.xiangTempleAidCandidate, true);
  const { natal, frame } = natalAndFrame(samples.xiangTempleAid);
  removeNatalStar(natal, '右弼');
  assert.equal(quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame)).xiangTempleAidCandidate, undefined);

  assert.equal(group.data.xiangGrade, '陷');
  assert.ok(group.data.xiangLianPo.every(row => row.relation === '冲'));
  assert.ok(group.data.xiangWuTan.every(row => row.branch === '丑' && row.relation === '其他'));
  assert.deepEqual(group.data.xiangYangTuo.map(row => row.relation), ['冲', '三合']);
  assert.equal(group.data.xiangFallenLianPoYangTuoCandidate, true);
  assert.equal(group.data.xiangIdleSeatCandidate, false);
  assert.ok(opposed.data.xiangFireBell.some(row => row.star === '归档铃星' && row.relation === '冲'));
  assert.equal(opposed.data.xiangFallenOpposedCandidate, true);
  const near = knownVerse({ ...samples.xiangFallenOpposed, year: 1999 });
  assert.equal(near.data.xiang.minorRelation, '三合');
  assert.equal(near.data.xiangFallenOpposedCandidate, false);
  assert.equal(match(near.run, 3).status, 'not_matched');
  for (const { run, verse } of [temple, group, opposed]) {
    const matchResult = match(run, 3);
    assert.equal(matchResult.status, 'partial');
    assert.ok(matchResult.sourceFactIds.includes(verse.factId));
  }
  const { input } = buildFortuneModelContext(opposed.run,
    interpretFortune(opposed.run, requestForFortuneRun(opposed.run), 'xiang-limit-verse'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /陷地天相对宫见归档火铃，归档铃星在卯宫/u);
  assert.doesNotMatch(prompt, /xiangFallenOpposedCandidate|quanshu_limit_verse_contacts/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === ruleNumber(3).knowledgeId));
});

test('p001 keeps distinct limits aspecting Tianji in local audit and requires a true guard for the source passage', () => {
  const cases = [
    ['1947-02-05', 2, 1961, '巳', '丑', '亥', ['三合', '冲'], [true, false, false, false, false]],
    ['1947-02-05', 2, 1963, '巳', '丑', '酉', ['三合', '三合'], [true, false, false, false, false]],
    ['1947-02-25', 3, 1999, '丑', '巳', '酉', ['三合', '三合'], [true, true, false, true, false]],
    ['1947-02-15', 3, 1962, '辰', '子', '戌', ['三合', '冲'], [true, false, true, false, false]],
    ['1947-02-05', 7, 1993, '未', '亥', '卯', ['三合', '三合'], [true, false, false, true, false]],
    ['1950-02-25', 4, 1971, '丑', '酉', '未', ['三合', '冲'], [false, false, false, false, true]],
    ['1947-02-05', 2, 1959, '巳', '丑', '丑', ['三合', '三合'], [false, false, false, false, false]],
    ['1947-02-05', 0, 1973, '卯', '辰', '亥', ['其他', '三合'], [false, false, false, false, false]],
  ];
  for (const [dateStr, timeIndex, year, ji, decadal, minor, contacts, flags] of cases) {
    const hour = String(timeIndex * 2).padStart(2, '0');
    const birthContext = { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
      latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const { run, data } = submittedVerse({ dateStr, timeIndex, year, gender: '女' }, birthContext);
    const [, named, liang, tong, fallen] = flags, expected = flags.includes(true);
    assert.deepEqual([data.ji.branch, data.decadalBranch, data.minorBranch], [ji, decadal, minor], String(year));
    assert.deepEqual([data.ji.decadalRelation, data.ji.minorRelation], contacts, String(year));
    assert.equal(data.jiBothLimitsAspect, expected);
    assert.equal(data.jiBaseCandidate, false);
    assert.deepEqual([data.jiBothLimitsAspectCandidate, data.jiSupportCandidate, data.jiLiangTogetherCandidate,
      data.jiTongChangQuCandidate, data.jiFallenShaCandidate], flags, String(year));
    if (fallen) {
      assert.equal(data.jiGrade, '陷');
      assert.deepEqual(data.jiSha.map(row => row.relation), ['三合', '冲', '三合', '冲']);
    }
    if (tong) assert.deepEqual(data.jiTongChangQu.map(row => row.relation), ['三合', ...(named ? ['冲', '冲'] : ['三合', '三合'])]);
    const timingFacts = run.facts.filter(fact => fact.factType === 'quanshu_limit_star_timing' && fact.normalizedPayload.lunarYear === year);
    const hit = match({ ...run, facts: timingFacts }, 1);
    assert.notEqual(hit.status, 'matched', String(year));
    assert.deepEqual(hit.windows, []);
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianji-limit-encounters')).input);
    assert.equal(prompt.includes('两限从不同宫位照同一颗天机'), expected, String(year));
    assert.equal(prompt.includes('天梁、辅弼和昌曲全组均有实际会照'), named, String(year));
    assert.equal(prompt.includes('天梁与天机同在' + ji + '宫'), liang, String(year));
    assert.equal(prompt.includes('天同、文昌、文曲均会天机宫'), tong, String(year));
    assert.equal(prompt.includes('两限会照陷地天机，四颗具名煞曜均到守冲三合范围且有实冲'), fallen, String(year));
    assert.doesNotMatch(prompt, /jiBothLimitsAspectCandidate|jiTongChangQuCandidate/u);
  }
});

test('Xiang p003 keeps named idle seats and source growth with both aides separate from merely guarding a limit', () => {
  const cases = [
    { dateStr: '1987-07-13', timeIndex: 1, gender: '女', year: 2026, branch: '戌', phase: '胎',
      idle: true, growth: false, direction: '逆排', wording: '卷二把天相所在的戌宫列为闲宫' },
    { dateStr: '1987-05-13', timeIndex: 4, gender: '女', year: 2025, branch: '亥', phase: '长生',
      idle: false, growth: true, direction: '逆排', wording: '逆排至天相宫为长生' },
    { dateStr: '1987-01-13', timeIndex: 2, gender: '男', year: 2030, branch: '卯', phase: '帝旺',
      idle: false, growth: true, direction: '顺排', wording: '顺排至天相宫为帝旺' },
    { dateStr: '1987-01-13', timeIndex: 4, gender: '男', year: 2025, branch: '子', phase: '胎',
      idle: false, growth: false, direction: '顺排' },
  ];
  for (const { branch, phase, idle, growth, direction, wording, ...sample } of cases) {
    const { run, verse, data } = submittedVerse(sample);
    assert.equal(data.xiang.branch, branch);
    assert.ok([data.xiang.decadalRelation, data.xiang.minorRelation].includes('守'));
    assert.deepEqual([data.xiangGrowth.phase, data.xiangGrowth.direction], [phase, direction]);
    assert.deepEqual([data.xiangIdleSeatCandidate, data.xiangGrowthAidCandidate], [idle, growth]);
    assert.deepEqual([data.xiangTempleAidCandidate, data.xiangFallenLianPoYangTuoCandidate, data.xiangFallenOpposedCandidate],
      [false, false, false]);
    const hit = match(run, 3);
    assert.equal(hit.status, wording ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, wording ? [verse.factId] : []);
    if (wording) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xiang-growth'));
      const prompt = formatFortuneFactAudit(input);
      assert.ok(prompt.includes(wording), wording);
      assert.doesNotMatch(prompt, /xiangGrowthAidCandidate|quanshu-volume-two-bureau-growth-by-gender-v1/u);
    }
  }
});

test('p003 verifies Tianxiang and Yang guarding one true limit with both Ming fire and bell in its area', () => {
  const example = { dateStr: '2008-03-11', timeIndex: 2, gender: '男', year: 2016 };
  const { run, verse, data } = submittedVerse(example);
  assert.deepEqual([data.xiang.branch, data.xiangGrade, data.xiang.decadalRelation, data.xiang.minorRelation],
    ['午', '庙', '其他', '守']);
  assert.equal(data.xiangMingYangFireBellCandidate, true);
  assert.equal(data.xiangFallenQuanshuFixedOpposedCandidate, false);
  assert.deepEqual(data.xiangMingYangFireBellWitnesses, [
    { star: '擎羊', branch: '午', relation: '守' },
    { star: '火星', branch: '寅', relation: '三合' },
    { star: '铃星', branch: '戌', relation: '三合' },
  ]);
  assert.deepEqual(data.xiangFireBell, [
    { star: '归档火星', branch: '辰', relation: '其他' },
    { star: '归档铃星', branch: '子', relation: '冲' },
  ]);
  const matched = match(run, 3);
  assert.equal(matched.status, 'partial');
  assert.deepEqual(matched.sourceFactIds, [verse.factId]);
  const isolated = { ...run, facts: [{ ...verse, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'archive-position' } }] };
  assert.equal(match(isolated, 3).status, 'not_matched');
  for (const year of [2015, 2017]) {
    const near = knownVerse({ ...example, year });
    assert.equal(near.data.xiangMingYangFireBellCandidate, false);
    assert.equal(match(near.run, 3).status, 'not_matched');
  }
  const { natal, frame } = natalAndFrame(example);
  const displaced = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(displaced.xiangMingYangFireBellCandidate, undefined);
  const palace = natal.palaces.find(row => row.earthlyBranch === data.xiang.branch);
  const [yang] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === '擎羊'), 1);
  assert.equal(yang.name, '擎羊');
  palace.adjectiveStars.push(yang);
  const wrongLayer = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.deepEqual(wrongLayer.xiangQuanshuFixedFireBell, data.xiangQuanshuFixedFireBell);
  assert.equal(wrongLayer.xiangMingYangFireBellCandidate, undefined);
  assert.deepEqual(wrongLayer.xiangMingYangFireBellWitnesses, []);
  assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: wrongLayer }] }, 3).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xiang-ming-yang-firebell'));
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== matched.knowledgeId)));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /天相与擎羊实守同一限宫，明刊定宫的火铃也均会到此宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /天相与擎羊实守同一限宫|xiangMingYangFireBellCandidate/u);
});

test('Ming Tianxiang and Yang alone at one verified limit remain a local source comparison', () => {
  const example = { dateStr: '1947-02-05', timeIndex: 9, gender: '男', year: 1965 };
  const { run, data } = knownVerse(example);
  assert.deepEqual(data.xiang, { branch: '未', annualRelation: '其他', decadalRelation: '其他', minorRelation: '守' });
  assert.equal(data.xiangMingYangAtVerifiedLimitCandidate, true);
  assert.deepEqual(data.xiangMingYangAtVerifiedLimitWitness, { star: '擎羊', branch: '未', relation: '守' });
  assert.deepEqual(data.xiangQuanshuFixedFireBell.map(row => row.relation), ['其他', '其他']);
  assert.equal(data.xiangMingYangFireBellCandidate, false);
  const matched = match(run, 3);
  assert.equal(matched.status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xiang-ming-yang-alone'));
  assert.match(formatFortuneFactAudit(input), /明刊入限诀另列擎羊。本命擎羊与天相同在未宫，小限实守此宫/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== matched.knowledgeId)));
  assert.doesNotMatch(formatFortunePrompt(input), /本命擎羊与天相同在未宫|xiangMingYangAtVerifiedLimit/u);
  for (const year of [1964, 1966]) {
    const near = knownVerse({ ...example, year });
    assert.equal(near.data.xiangMingYangAtVerifiedLimitCandidate, false);
    assert.equal(near.data.xiangMingYangAtVerifiedLimitWitness, undefined);
  }
  const { natal, frame } = natalAndFrame(example);
  const displaced = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(displaced.xiangMingYangAtVerifiedLimitCandidate, undefined);
});

test('p003 accepts an idle Tianxiang aspected from two distinct actual limit palaces in the same annual window', () => {
  const cases = [
    ['1947-02-05', 3, 1962, '辰', '子', '戌', ['三合', '冲'], true],
    ['1948-02-05', 3, 1990, '戌', '寅', '午', ['三合', '三合'], true],
    ['1947-02-05', 3, 1960, '辰', '子', '子', ['三合', '三合'], false],
    ['1947-02-05', 0, 1960, '辰', '卯', '子', ['其他', '三合'], false],
    ['1947-02-05', 1, 2000, '寅', '午', '申', ['三合', '冲'], false],
  ];
  for (const [dateStr, timeIndex, year, xiang, decade, minor, relations, expected] of cases) {
    const hour = String(timeIndex * 2).padStart(2, '0');
    const birthContext = { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
      latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const { run, verse, data } = submittedVerse({ dateStr, timeIndex, year, gender: '女' }, birthContext);
    assert.deepEqual([data.xiang.branch, data.decadalBranch, data.minorBranch], [xiang, decade, minor]);
    assert.deepEqual([data.xiang.decadalRelation, data.xiang.minorRelation], relations);
    assert.equal(data.xiangIdleBothLimitsAspectCandidate, expected);
    assert.equal(data.xiangIdleSeatCandidate, false);
    const hit = match(run, 3);
    assert.equal(hit.status, expected ? 'partial' : 'not_matched');
    if (expected) {
      assert.deepEqual(hit.sourceFactIds, [verse.factId]);
      assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);
    }
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xiang-idle-limits')).input);
    assert.equal(prompt.includes('两限从不同宫位照同一颗天相'), expected);
    if (expected) assert.ok(prompt.includes('天相在卷二列闲的' + xiang + '宫，大限从' + decade + '宫' + relations[0] + '，小限从' + minor + '宫' + relations[1]));
    assert.doesNotMatch(prompt, /xiangIdleBothLimitsAspectCandidate/u);
  }
});

test('p003 matches Tianxiang independently when both verified limits guard its actual palace', () => {
  const example = { dateStr: '1990-05-05', timeIndex: 2, gender: '女', year: 2030 };
  const { run, verse, data } = submittedVerse(example);
  assert.deepEqual([data.xiang.branch, data.xiang.decadalRelation, data.xiang.minorRelation], ['子', '守', '守']);
  assert.equal(data.xiangDoubleGuardCandidate, true);
  const scoped = payload => ({ ...run, facts: [{ ...verse, normalizedPayload: payload }] });
  const result = payload => match(scoped(payload), 3);
  const guardText = '大限与复算小限都实守天相所在的子宫';
  const assertAudit = (payload, expected) => {
    const sample = scoped(payload), report = interpretFortune(sample, requestForFortuneRun(sample), 'xiang-double-guard');
    const { input } = buildFortuneModelContext(sample, report);
    assert.equal(formatFortuneFactAudit(input).includes(guardText), expected);
    const prompt = formatFortunePrompt(input);
    assert.ok(!prompt.includes(guardText) && !prompt.includes('xiangDoubleGuardCandidate'));
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== ruleNumber(3).knowledgeId)));
  };
  assert.equal(result({ ...data, xiangDoubleGuardCandidate: false }).status, 'not_matched');
  const hit = result(data);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [verse.factId]);
  assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);
  assertAudit(data, true);

  for (const year of [2029, 2031]) {
    const { natal, frame } = natalAndFrame({ ...example, year });
    const neighbor = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
    assert.equal(neighbor.xiang.branch, '子');
    assert.equal(neighbor.xiangDoubleGuardCandidate, false);
    assert.equal(result(neighbor).status, 'not_matched');
    assertAudit(neighbor, false);
  }
  const { natal, frame } = natalAndFrame(example);
  const wrongMinor = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(wrongMinor.xiang.decadalRelation, '守');
  assert.equal(wrongMinor.xiang.minorRelation, undefined);
  assert.equal(wrongMinor.xiangDoubleGuardCandidate, undefined);
  assert.equal(result(wrongMinor).status, 'unknown');
  assertAudit(wrongMinor, false);
});

test('p003 confirms a Tianxiang double guard in an explicitly idle palace only without the four recorded Sha', () => {
  const sample = { dateStr: '1990-05-05', timeIndex: 10, gender: '女', year: 2026 };
  const { run, verse, data } = submittedVerse(sample);
  assert.deepEqual([data.xiang.branch, data.xiang.decadalRelation, data.xiang.minorRelation], ['辰', '守', '守']);
  assert.equal(data.xiangIdleSeatCandidate, true);
  assert.deepEqual([...data.xiangYangTuo, ...data.xiangQuanshuFixedFireBell].map(({ star, branch, relation }) => [star, branch, relation]),
    [['擎羊', '酉', '其他'], ['陀罗', '未', '其他'], ['火星', '丑', '其他'], ['铃星', '卯', '其他']]);
  assert.equal(data.xiangIdleMingClearDoubleGuardCandidate, true);
  const selected = { ...run, facts: [verse] };
  const evaluate = normalizedPayload => match({ ...selected, facts: [{ ...verse, normalizedPayload }] }, 3);
  const hit = match(selected, 3);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [verse.factId]);
  assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);
  assert.equal(evaluate({ ...data, quanshuFixedFireBellProfile: 'other-source' }).status, 'partial');
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'xiang-idle-double-guard'));
  assert.match(formatFortuneFactAudit(input), /大限与复算小限都实守天相所在的辰宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /复核的大小限都实守辰或戌宫的本命天相/u);
  assert.doesNotMatch(prompt, /大小限都实守天相所在的辰宫|xiangIdleMingClearDoubleGuardCandidate/u);

  const opposed = submittedVerse({ dateStr: '1947-02-05', timeIndex: 3, gender: '女', year: 2004 });
  assert.deepEqual([opposed.data.xiang.branch, opposed.data.xiangDoubleGuardCandidate, opposed.data.xiangIdleSeatCandidate], ['辰', true, true]);
  assert.deepEqual(opposed.data.xiangQuanshuFixedFireBell.find(row => row.star === '铃星').relation, '冲');
  assert.equal(opposed.data.xiangIdleMingClearDoubleGuardCandidate, false);
  assert.equal(match({ ...opposed.run, facts: [opposed.verse] }, 3).status, 'partial');

  const { natal, frame } = natalAndFrame(sample);
  const misplaced = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(misplaced.xiangIdleMingClearDoubleGuardCandidate, undefined);
  assert.equal(evaluate(misplaced).status, 'partial');
  const wrongBlade = structuredClone(natal);
  const palace = wrongBlade.palaces.find(row => row.minorStars.some(star => star.name === '陀罗'));
  const [tuo] = palace.minorStars.splice(palace.minorStars.findIndex(star => star.name === '陀罗'), 1);
  palace.adjectiveStars.push(tuo);
  const withoutVerifiedTuo = quanshuLimitVerseContacts(quanshuLimitBranches(wrongBlade, frame));
  assert.equal(withoutVerifiedTuo.xiangDoubleGuardCandidate, true);
  assert.equal(withoutVerifiedTuo.xiangIdleMingClearDoubleGuardCandidate, undefined);
  assert.equal(evaluate(withoutVerifiedTuo).status, 'partial');
  const neighbor = natalAndFrame({ ...sample, year: 2027 });
  const next = quanshuLimitVerseContacts(quanshuLimitBranches(neighbor.natal, neighbor.frame));
  assert.equal(next.xiangIdleMingClearDoubleGuardCandidate, false);
});

test('Tai Yin distinguishes two known contacts, one known contact and no contacts without inferring a missing coordinate', () => {
  for (const [name, expectedIndex] of [['yinClear', 0], ['yinSingle', 1], ['yinBoth', 2]]) {
    const { data, run, verse } = knownVerse(reference.verseSamples[name]);
    assert.deepEqual([data.yinClearFireBellCandidate, data.yinSingleFireBellCandidate, data.yinPairedFireBellCandidate],
      [0, 1, 2].map(index => index === expectedIndex));
    const archiveOnly = { ...verse, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
    assert.equal(match({ ...run, facts: [archiveOnly] }, 30).status, 'partial');
    if (expectedIndex === 1) {
      assert.equal(data.yinQuanshuFixedClearFireBellCandidate, true);
      assert.equal(match(run, 30).status, 'partial');
    }
    if (expectedIndex === 2) assert.deepEqual(data.yinFireBell.map(row => row.relation), ['冲', '三合']);
  }
  const { natal, frame } = natalAndFrame(reference.verseSamples.yinClear);
  removeNatalStar(natal, '火星');
  const uncertain = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(uncertain.yin.minorRelation, '守');
  assert.equal(uncertain.yinClearFireBellCandidate, undefined);
  assert.equal(uncertain.yinFireBell.find(row => row.star === '归档铃星')?.relation, '其他');
  assert.equal(uncertain.yinPairedFireBellCandidate, false);
  const both = natalAndFrame(reference.verseSamples.yinBoth);
  removeNatalStar(both.natal, '火星');
  const missingFire = quanshuLimitVerseContacts(quanshuLimitBranches(both.natal, both.frame));
  assert.equal(missingFire.yinPairedFireBellCandidate, undefined);
  assert.equal(missingFire.yinClearFireBellCandidate, false);
});

test('p030 recognizes a verified Tai Yin guard even when each Fire Bell reading has just one contact', () => {
  const sample = { dateStr: '1990-05-05', timeIndex: 4, year: 2027, gender: '女' };
  const { run, verse, data } = knownVerse(sample);
  assert.deepEqual([data.yin.branch, data.yin.decadalRelation, data.yin.minorRelation], ['卯', '其他', '守']);
  assert.equal(data.yinAtVerifiedLimitCandidate, true);
  assert.equal(data.yinSingleFireBellCandidate, true);
  assert.equal(data.yinMingSingleGuardWithoutFireBellCandidate, false);
  assert.deepEqual(data.yinQuanshuFixedFireBell.map(row => [row.star, row.branch, row.relation]),
    [['火星', '丑', '其他'], ['铃星', '卯', '守']]);
  assert.deepEqual([data.yinClearFireBellCandidate, data.yinPairedFireBellCandidate,
    data.yinQuanshuFixedClearFireBellCandidate, data.yinQuanshuFixedPairedFireBellCandidate], [false, false, false, false]);
  const hit = match(run, 30);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [verse.factId]);
  assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);

  const { natal, frame } = natalAndFrame(sample);
  const misplaced = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(misplaced.yinAtVerifiedLimitCandidate, undefined);
  assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: misplaced }] }, 30).status, 'unknown');
  const next = knownVerse({ ...sample, year: 2028 });
  assert.equal(next.data.yinAtVerifiedLimitCandidate, false);
  assert.equal(match(next.run, 30).status, 'not_matched');
});

test('p030 separates two verified Tai Yin guards with clear and paired Ming Fire Bell conditions', () => {
  const sample = { dateStr: '1980-03-15', timeIndex: 2, year: 1990, gender: '女' };
  const { run, verse, data } = submittedVerse(sample);
  const evaluate = (payload = data) => match({ ...run, facts: [{ ...verse, normalizedPayload: payload }] }, 30);
  assert.deepEqual([data.yin.branch, data.yin.decadalRelation, data.yin.minorRelation, data.sunBranch], ['子', '守', '守', '寅']);
  assert.deepEqual(data.yinQuanshuFixedFireBell.map(({ branch, relation }) => [branch, relation]), [['寅', '其他'], ['戌', '其他']]);
  assert.equal(data.yinReverse, false);
  assert.equal(data.yinMingDoubleGuardWithoutFireBellCandidate, true);
  const hit = evaluate();
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [verse.factId]);
  assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);
  assert.equal(evaluate({ ...data, quanshuFixedFireBellProfile: 'other-source' }).status, 'partial');
  const selected = { ...run, facts: [verse] };
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'ming-taiyin-double-guard'));
  assert.match(formatFortuneFactAudit(input), /大限、小限守子宫的太阴.*明刊火铃均已定位/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /复核的大限和小限同段实守本命太阴/u);
  assert.match(prompt, /两曜均不在太阴实守宫的守、冲、三合范围/u);
  assert.doesNotMatch(prompt, /大限、小限守子宫的太阴|明刊火铃均已定位|yinMingDoubleGuardWithoutFireBellCandidate/u);

  const paired = submittedVerse({ ...sample, timeIndex: 5, year: 2032, gender: '男' });
  assert.deepEqual([paired.data.yin.branch, paired.data.yin.decadalRelation, paired.data.yin.minorRelation], ['寅', '守', '守']);
  assert.deepEqual(paired.data.yinQuanshuFixedFireBell.map(({ branch, relation }) => [branch, relation]), [['寅', '守'], ['戌', '三合']]);
  assert.equal(paired.data.yinMingDoubleGuardWithoutFireBellCandidate, false);
  assert.equal(paired.data.yinMingDoubleGuardWithFireBellCandidate, true);
  const pairedRun = { ...paired.run, facts: [paired.verse] };
  const pairedHit = match(pairedRun, 30);
  assert.equal(pairedHit.status, 'matched');
  assert.equal(pairedHit.matchedSourceExcerpt, '火铃若也来相凑');
  assert.deepEqual(pairedHit.windows, [{ start: paired.verse.activeFrom, endExclusive: paired.verse.activeTo }]);
  const pairedModel = buildFortuneModelContext(pairedRun, interpretFortune(pairedRun, requestForFortuneRun(pairedRun), 'ming-taiyin-paired'));
  const pairedPrompt = formatFortunePrompt(pairedModel.input);
  assert.match(pairedPrompt, /一曜实守，另一曜从对宫或三合来会/u);
  assert.doesNotMatch(pairedPrompt, /官灾病患|两曜均不在太阴实守宫/u);

  const { natal, frame } = natalAndFrame(sample);
  const wrongMinor = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(wrongMinor.yinMingDoubleGuardWithoutFireBellCandidate, undefined);
  assert.equal(evaluate(wrongMinor).status, 'partial');
  const wrongDecade = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, decadalIndex: (frame.decadalIndex + 1) % 12 }));
  assert.equal(wrongDecade.yinMingDoubleGuardWithoutFireBellCandidate, undefined);
  assert.equal(evaluate(wrongDecade).status, 'partial');
  removeNatalStar(natal, '太阳');
  const unknownReverse = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(unknownReverse.yinMingDoubleGuardWithoutFireBellCandidate, undefined);
  assert.equal(evaluate(unknownReverse).status, 'partial');
  const neighbor = natalAndFrame({ ...sample, year: 1991 });
  const next = quanshuLimitVerseContacts(quanshuLimitBranches(neighbor.natal, neighbor.frame));
  assert.equal(next.yinMingDoubleGuardWithoutFireBellCandidate, false);
});

test('p030 confirms the separate opening couplet when one real limit guards Tai Yin', () => {
  const birth = { dateStr: '1980-03-15', timeIndex: 2, gender: '女' };
  const field = 'yinMingSingleGuardWithoutFireBellCandidate';
  const evidence = 'yinMingSingleGuardWithoutFireBellWitness';
  for (const [year, scope] of [[1991, 'decadal'], [2002, 'minor']]) {
    const sample = { ...birth, year };
    const { run, verse, data } = submittedVerse(sample);
    const isolated = normalizedPayload => ({ ...run, facts: [{ ...verse, normalizedPayload }] });
    assert.equal(data[field], true);
    assert.equal(data.yinMingDoubleGuardWithoutFireBellCandidate, false);
    assert.deepEqual(data[evidence], {
      branch: '子', scope, sunBranch: '寅', fireBell: [
        { star: '火星', branch: '寅', relation: '其他' }, { star: '铃星', branch: '戌', relation: '其他' },
      ],
    });
    const positive = isolated(data), hit = match(positive, 30);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '太陰星曜限中逢');
    assert.deepEqual(hit.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);
    const { input } = buildFortuneModelContext(positive, interpretFortune(positive, requestForFortuneRun(positive), 'ming-taiyin-single-guard'));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
    const limit = scope === 'decadal' ? '大限' : '小限';
    assert.ok(formatFortuneFactAudit(input).includes(`${limit}实守子宫本命太阴。另一限已核不实守，复算明刊火铃均未守冲三合此宫`));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /太陰星曜限中逢/u);
    assert.doesNotMatch(prompt, /子宫|火星在寅|铃星在戌|yinMingSingleGuardWithoutFireBell/u);

    const { natal, frame } = natalAndFrame(sample);
    const key = scope === 'decadal' ? 'decadalIndex' : 'minorIndex';
    const wrong = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, [key]: (frame[key] + 1) % 12 }));
    assert.equal(wrong[field], undefined);
    assert.equal(wrong[evidence], undefined);
    assert.notEqual(match(isolated(wrong), 30).status, 'matched');
  }
  const next = natalAndFrame({ ...birth, year: 2003 });
  const noGuard = quanshuLimitVerseContacts(quanshuLimitBranches(next.natal, next.frame));
  assert.equal(noGuard[field], false);
  assert.equal(noGuard[evidence], undefined);
});

test('p030 distinguishes two Ming aspects from fire or bell guarding two verified Moon limits', () => {
  const sample = { dateStr: '1982-02-16', timeIndex: 1, year: 2025, gender: '女' };
  const { run, verse, data } = submittedVerse(sample);
  const flag = 'yinMingDoubleGuardBothFireBellAspectsCandidate', witness = 'yinMingDoubleGuardBothFireBellAspectsWitness';
  assert.equal(data[flag], true);
  assert.deepEqual([data.sunBranch, data.yin.branch, data.yin.decadalRelation, data.yin.minorRelation], ['巳', '酉', '守', '守']);
  assert.deepEqual(data[witness], { branch: '酉', fireBell: [
    { star: '火星', branch: '丑', relation: '三合' }, { star: '铃星', branch: '卯', relation: '冲' },
  ] });
  assert.equal(data.yinMingDoubleGuardWithFireBellCandidate, false);
  assert.equal(data.yinQuanshuFixedPairedFireBellCandidate, true);
  const selected = { ...run, facts: [verse] }, hit = match(selected, 30);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: '2025-01-28T16:00:00.000Z', endExclusive: verse.activeTo }]);
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'ming-taiyin-double-aspect'));
  assert.match(formatFortuneFactAudit(input), /明刊火铃同向到会酉宫，均未实守两限同到的太阴宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /均未实守两限同到的太阴宫|丑宫.*卯宫|yinMingDoubleGuardBothFireBellAspects/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const { natal, frame } = natalAndFrame(sample);
  const read = (archive, positions) => quanshuLimitVerseContacts(quanshuLimitBranches(archive, positions));
  const wrong = read(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 });
  assert.equal(wrong[flag], undefined);
  assert.equal(wrong[witness], undefined);
  const neighbor = natalAndFrame({ ...sample, year: 2026 });
  assert.equal(read(neighbor.natal, neighbor.frame)[flag], false);
  const trines = natalAndFrame({ dateStr: '1980-05-15', timeIndex: 2, gender: '女', year: 2080 });
  const doubleTrine = read(trines.natal, trines.frame);
  assert.equal(doubleTrine[flag], true);
  assert.deepEqual(doubleTrine[witness], { branch: '午', fireBell: [
    { star: '火星', branch: '寅', relation: '三合' }, { star: '铃星', branch: '戌', relation: '三合' },
  ] });
});

test('p030 and p031 accept the real moon decade and reject a prematurely moved decade', () => {
  const sample = { dateStr: '1980-05-15', timeIndex: 10, year: 2012, gender: '女' };
  const { run, verse, data } = knownVerse(sample);
  assert.equal(verse.activeFrom, '2012-01-22T16:00:00.000Z');
  assert.deepEqual(data.sourceDecadal, { branch: '辰', verified: true });
  assert.deepEqual([data.yin.branch, data.yin.decadalRelation, data.yin.minorRelation, data.sunBranch], ['辰', '守', '其他', '戌']);
  const before = selectVerse(real(sample), 2011);
  assert.equal(before.verse.activeTo, verse.activeFrom);
  assert.deepEqual(before.data.sourceDecadal, { branch: '巳', verified: true });
  const prior = natalAndFrame({ ...sample, year: 2011 });
  const wrongIndex = prior.natal.palaces.find(row => row.earthlyBranch === '辰').index;
  const wrong = quanshuLimitVerseContacts(quanshuLimitBranches(prior.natal, { ...prior.frame, decadalIndex: wrongIndex }));
  assert.deepEqual(wrong.sourceDecadal, { branch: '辰', verified: false });
  assert.equal(wrong.yin.decadalRelation, undefined);
  for (const [number, field] of [[30, 'yinAtVerifiedLimitCandidate'], [31, 'yinReverseQuanshuFixedFireBellCandidate']]) {
    assert.equal(data[field], true, field);
    const hit = match(run, number);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [verse.factId]);
    assert.equal(before.data[field], false, field);
    assert.equal(match(before.run, number).status, 'not_matched');
    assert.equal(wrong[field], undefined, field);
    assert.equal(match({ ...before.run, facts: [{ ...before.verse, normalizedPayload: wrong }] }, number).status, 'unknown');
  }
  const { natal, frame } = natalAndFrame(sample);
  const evaluate = (normalizedPayload, number) => match({ ...run, facts: [{ ...verse, normalizedPayload }] }, number);
  for (const [star, subject] of [['太阴', 'yin'], ['太阳', 'sun']]) {
    const copy = structuredClone(natal), owner = copy.palaces.find(row => row.majorStars.some(entry => entry.name === star));
    const [archived] = owner.majorStars.splice(owner.majorStars.findIndex(entry => entry.name === star), 1);
    owner.adjectiveStars.push(archived);
    const wrongLayer = quanshuLimitVerseContacts(quanshuLimitBranches(copy, frame));
    assert.equal(wrongLayer.principalSeatProof[subject].archiveBranch, undefined);
    assert.equal(wrongLayer.principalSeatProof[subject].expectedBranch, data.principalSeatProof[subject].archiveBranch);
    assert.equal(wrongLayer.principalSeatProof[subject].verified, undefined);
    assert.equal(wrongLayer.yinReverseQuanshuFixedFireBellCandidate, undefined);
    assert.equal(evaluate(wrongLayer, 31).status, 'unknown');
    assert.equal(evaluate(wrongLayer, 30).status, star === '太阴' ? 'unknown' : 'partial');
  }
  const { starPlacementProof, limitPlacementProof, ...older } = data;
  assert.equal(starPlacementProof, 'quanshu-nanyangtang-major-layer-v1');
  assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
  for (const number of [30, 31]) assert.equal(evaluate(older, number).status, 'unknown');
  const minor = natalAndFrame({ dateStr: '1990-05-05', timeIndex: 4, year: 2027, gender: '女' });
  const unchanged = quanshuLimitVerseContacts(quanshuLimitBranches(minor.natal, { ...minor.frame, decadalIndex: minor.frame.minorIndex }));
  assert.deepEqual(unchanged.sourceDecadal, { branch: '卯', verified: false });
  assert.equal(unchanged.yinAtVerifiedLimitCandidate, true);
  assert.equal(unchanged.yinReverseYangTuoCandidate, true);
});

test('a shared verse chart cannot promote Tianxiang, Tong, Tai Yin or Bell through a displaced small limit', () => {
  const cohort = { dateStr: '1980-02-15', timeIndex: 2, year: 1988 };
  const windows = [
    { example: cohort, branch: '卯', expected: '辰', field: 'xiangFallenQuanshuFixedOpposedCandidate', rule: 3, subject: 'xiang' },
    { example: cohort, branch: '子', expected: '辰', field: 'tongSupportCandidate', subject: 'tong' },
    { example: cohort, branch: '子', expected: '辰', field: 'yinQuanshuFixedClearFireBellCandidate', rule: 30, subject: 'yin' },
    { example: cohort, branch: '戌', expected: '辰', field: 'quanshuFixedBellCandidate', subject: 'quanshuFixedBell' },
    { example: { dateStr: '1980-05-15', timeIndex: 10, year: 2013 }, branch: '寅', expected: '丑',
      field: 'yinReverseQuanshuFixedFireBellCandidate', rule: 31, subject: 'yin' },
    { example: { dateStr: '1991-02-16', timeIndex: 2, year: 1995 }, branch: '午', expected: '酉',
      field: 'tongFallenOpposedCandidate', subject: 'tong' },
  ];
  for (const { example, branch, expected, field, rule, subject } of windows) {
    const { natal, frame } = natalAndFrame({ ...example, gender: '女' });
    const pal = natal.palaces.find(row => row.earthlyBranch === branch);
    const limits = quanshuLimitBranches(natal, { ...frame, minorIndex: pal.index });
    assert.equal(limits.sourceMinor.verified, false, field);
    assert.equal(limits.sourceMinor.branch, expected, field);
    const misplaced = quanshuLimitVerseContacts(limits);
    const trustedArchive = quanshuLimitVerseContacts({ ...limits,
      sourceMinor: { ...limits.sourceMinor, branch, verified: true } });
    assert.equal(trustedArchive[field], true, field);
    assert.equal(misplaced[field], undefined, field);
    assert.equal(misplaced.minorBranch, branch);
    assert.equal((misplaced[subject].bell ?? misplaced[subject]).minorRelation, undefined);
    if (rule !== undefined) {
      const { run, verse, data } = knownVerse(example);
      assert.equal(data[field], false, field);
      assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: misplaced }] }, rule).status, 'unknown', field);
    }
    const audit = describeFortuneFact({ method: 'ziwei', type: verseFactType, data: misplaced }, String);
    assert.ok(!audit.includes('小限守' + branch + '宫'), field);
  }
});

test('four limit verses require the Nanyang major star sequence and the archived major layer', () => {
  const cases = [
    [3, 'xiang', '天相', '天府', 'xiangMingYangFireBellCandidate',
      { dateStr: '2008-03-11', timeIndex: 2, gender: '男', year: 2016 }],
    [28, 'tong', '天同', '紫微', 'tongFallenOpposedCandidate', exampleFor(28)],
    [30, 'yin', '太阴', '天府', 'yinAtVerifiedLimitCandidate', exampleFor(30)],
    [31, 'sun', '太阳', '紫微', 'yinReverseYangTuoCandidate', exampleFor(31)],
  ];
  for (const [rule, subject, star, anchor, field, example] of cases) {
    const { run, verse, data } = knownVerse(example);
    const { archiveBranch, expectedBranch, verified } = data.principalSeatProof[subject];
    assert.equal(verified, true, star);
    assert.equal(archiveBranch, expectedBranch, star);
    assert.equal(data.principalSeatProof[subject].anchor, anchor, star);
    assert.equal(data[field], true, star);
    assert.equal(match(run, rule).status, 'partial', star);

    const { natal, frame } = natalAndFrame(example);
    for (const mislayeredStar of [star, anchor]) {
      const wrongLayer = structuredClone(natal);
      const seat = wrongLayer.palaces.find(palace => palace.majorStars.some(row => row.name === mislayeredStar));
      const archivedStar = seat.majorStars.find(row => row.name === mislayeredStar);
      seat.majorStars = seat.majorStars.filter(row => row !== archivedStar);
      seat.minorStars.push(archivedStar);
      const uncertain = quanshuLimitVerseContacts(quanshuLimitBranches(wrongLayer, frame));
      const proof = uncertain.principalSeatProof[subject];
      assert.equal(proof.verified, undefined, mislayeredStar);
      assert.equal(uncertain[field], undefined, mislayeredStar);
      if (mislayeredStar === star) assert.equal(proof.archiveBranch, undefined, mislayeredStar);
      else assert.equal(proof.expectedBranch, undefined, mislayeredStar);
      if (rule !== 28) assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: uncertain }] }, rule).status, 'unknown');
    }
    const host = natal.palaces.find(palace => palace.earthlyBranch === archiveBranch);
    const newHost = natal.palaces.find(palace => palace.index === (host.index + 1) % 12);
    newHost.majorStars.push(host.majorStars.find(row => row.name === star));
    host.majorStars = host.majorStars.filter(row => row.name !== star);
    const invalid = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
    assert.deepEqual(invalid.principalSeatProof[subject], { ...data.principalSeatProof[subject],
      archiveBranch: newHost.earthlyBranch, verified: false }, star);
    assert.equal(invalid[field], undefined, star);
    if (subject === 'sun') {
      assert.equal(invalid.yinAtVerifiedLimitCandidate, true);
      assert.equal(invalid.yinReverseSource, undefined);
    }
    const facts = rule === 28
      ? selectVerse(calculate(chart(natal), example.year), example.year).run.facts
      : [{ ...verse, normalizedPayload: invalid }];
    assert.equal(match({ ...run, facts }, rule).status, 'unknown', star);

    removeNatalStar(natal, anchor);
    const missing = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
    assert.equal(missing.principalSeatProof[subject].expectedBranch, undefined, star);
    assert.equal(missing.principalSeatProof[subject].verified, undefined, star);
    assert.equal(missing[field], undefined, star);
  }
});

test('explicit reverse Sun and Moon can meet either source Sha branch, while a lunar weak seat alone fails', () => {
  const sheep = knownVerse(exampleFor(31));
  assert.deepEqual([sheep.data.sunBranch, sheep.data.yin.branch], ['戌', '辰']);
  assert.equal(sheep.data.yinReverseSource, 'volume-three');
  assert.deepEqual(sheep.data.yinYangTuo.map(row => row.relation), ['冲', '三合']);
  assert.equal(sheep.data.yinReverseYangTuoCandidate, true);
  assert.equal(sheep.data.yinReverseFireBellCandidate, false);
  assert.equal(match(sheep.run, 31).status, 'partial');

  const fire = knownVerse(reference.verseSamples.yinReverseFire);
  assert.equal(fire.data.yinReverseYangTuoCandidate, false);
  assert.equal(fire.data.yinReverseFireBellCandidate, true);
  assert.equal(fire.data.yinFireBell.find(row => row.star === '归档火星').decadalRelation, '守');
  assert.equal(match(fire.run, 31).status, 'partial');

  const other = knownVerse({ dateStr: '1991-02-16', timeIndex: 1, gender: '女', year: 2010 });
  assert.deepEqual([other.data.sunBranch, other.data.yin.branch, other.data.yin.minorRelation], ['申', '午', '守']);
  assert.equal(other.data.yinReverse, false);
  assert.ok(other.data.yinYangTuo.some(row => row.relation === '三合'));
  assert.equal(match(other.run, 31).status, 'not_matched');
});

test('p031 confirms the Three-Volume reverse Moon and verified natal Tuo trine on two real guards', () => {
  const sample = { dateStr: '1991-02-16', timeIndex: 3, gender: '女', year: 2048 };
  const { run, verse, data } = submittedVerse(sample);
  const flag = 'yinVolumeThreeNativeTrineDoubleGuardCandidate';
  assert.equal(data.yinReverseSource, 'volume-three');
  assert.deepEqual([data.sunBranch, data.yin.branch, data.yin.decadalRelation, data.yin.minorRelation], ['戌', '辰', '守', '守']);
  assert.deepEqual(data.yinYangTuo.map(row => row.relation), ['冲', '三合']);
  assert.equal(data[flag], true);
  assert.deepEqual(data.yinVolumeThreeNativeTrineDoubleGuardWitness, { star: '陀罗', branch: '申', relation: '三合' });
  const verdict = match(run, 31);
  assert.equal(verdict.status, 'matched');
  assert.deepEqual(verdict.sourceFactIds, [verse.factId]);
  assert.deepEqual(verdict.windows, [{ start: verse.activeFrom, endExclusive: verse.activeTo }]);

  const { natal, frame } = natalAndFrame(sample);
  const read = (archive, positions) => quanshuLimitVerseContacts(quanshuLimitBranches(archive, positions));
  const neighbor = natalAndFrame({ ...sample, year: sample.year + 1 });
  assert.equal(read(neighbor.natal, neighbor.frame)[flag], false);
  const wrongMinor = read(natal, { ...frame, minorIndex: neighbor.frame.minorIndex });
  assert.equal(wrongMinor[flag], undefined);
  assert.equal(wrongMinor.yin.decadalRelation, '守');
  const wrongAuxiliary = structuredClone(natal), host = wrongAuxiliary.palaces.find(row => row.earthlyBranch === '申');
  const [tuo] = host.minorStars.splice(host.minorStars.findIndex(row => row.name === '陀罗'), 1);
  host.adjectiveStars.push(tuo);
  const wrongLayer = read(wrongAuxiliary, frame);
  assert.equal(wrongLayer[flag], undefined);
  assert.equal(wrongLayer.yinReverseYangTuoCandidate, undefined);
  const isolated = normalizedPayload => ({ ...run, facts: [{ ...verse, normalizedPayload }] });
  assert.equal(match(isolated(wrongMinor), 31).status, 'partial');
  assert.equal(match(isolated(wrongLayer), 31).status, 'unknown');
  assert.equal(match(isolated({ ...data, yinReverseSource: 'nanyang-commentary' }), 31).status, 'not_matched');
  for (const stem of '甲乙丙丁戊己庚辛壬癸') {
    const { qingyangBranch, tuoluoBranch } = quanshuLuYangTuo(stem);
    for (const focus of branches) {
      assert.ok([qingyangBranch, tuoluoBranch].some(branch => quanshuPalaceRelation(focus, branch) !== '三合'));
    }
  }

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'three-volume-yin-trine'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === verdict.knowledgeId);
  assert.equal(finding.originalText, '限至太阴居反背，不喜羊陀三方会');
  const local = '按三卷本日戌月辰，大小限同守辰宫太阴，陀罗在申宫实三合';
  assert.ok(formatFortuneFactAudit(input).includes(local));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按三卷本卷三所列的日戌月辰核反背/u);
  assert.ok(!prompt.includes(local));
  assert.doesNotMatch(prompt, /yinVolumeThreeNativeTrineDoubleGuard|三殺會/u);
});

test('p031 records the two verified Nanyang fire and bell guards on separate actual limits', () => {
  const sample = { dateStr: '1990-01-05', timeIndex: 6, year: 2029, gender: '女' };
  const { run, verse, data } = submittedVerse(sample);
  assert.deepEqual([data.sunBranch, data.yin.branch, data.yinReverseSource], ['亥', '卯', 'nanyang-commentary']);
  assert.equal(data.yinReverseQuanshuFixedFireBellCandidate, true);
  assert.equal(data.yinQuanshuFixedPairedFireBellCandidate, false);
  assert.equal(data.yinReverseQuanshuFixedSplitLimitsCandidate, true);
  assert.deepEqual(data.yinReverseQuanshuFixedSplitLimitsWitness, {
    moonBranch: '卯', fire: { branch: '卯', scope: 'minor' }, bell: { branch: '戌', scope: 'decadal' },
  });
  assert.equal(data.yinQuanshuFixedFireBell[1].relation, '其他');
  const verdict = match(run, 31);
  assert.deepEqual(verdict.sourceFactIds, [verse.factId]);
  assert.equal(verdict.status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'reversed-moon-fixed-split'));
  const wording = /按明刊定宫，火星实守卯宫的小限，铃星实守戌宫的大限/u;
  assert.match(formatFortuneFactAudit(input), wording);
  assert.doesNotMatch(formatFortunePrompt(input), /火星实守卯宫的小限|yinReverseQuanshuFixedSplitLimits/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== verdict.knowledgeId)));

  const { natal, frame } = natalAndFrame(sample);
  const wrong = quanshuLimitVerseContacts(quanshuLimitBranches(natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }));
  assert.equal(wrong.yinReverseQuanshuFixedSplitLimitsCandidate, undefined);
  assert.equal(wrong.yinReverseQuanshuFixedSplitLimitsWitness, undefined);
  for (const year of [2028, 2030]) {
    const checked = knownVerse({ ...sample, year });
    assert.equal(checked.data.yinReverseQuanshuFixedSplitLimitsCandidate, false);
    assert.equal(checked.data.yinReverseQuanshuFixedSplitLimitsWitness, undefined);
  }
});

test('Nanyang reverse luminaries intersect the twelve actual archive pairings', () => {
  const pairings = [
    ['1985-01-01', 0, '卯亥'], ['1985-01-01', 1, '亥卯', 'nanyang-commentary'],
    ['1985-01-01', 3, '子寅'], ['1985-01-01', 5, '巳酉'], ['1985-01-01', 7, '丑丑'],
    ['1985-01-02', 0, '辰戌'], ['1985-01-02', 5, '戌辰', 'volume-three'], ['1985-01-02', 7, '寅子'],
    ['1985-01-03', 1, '申午'], ['1985-01-06', 0, '午申'], ['1985-01-08', 0, '未未'],
    ['1985-01-09', 1, '酉巳', 'nanyang-commentary'],
  ];
  for (const [dateStr, timeIndex, pair, source] of pairings) {
    const { natal, frame } = natalAndFrame({ dateStr, timeIndex, gender: '女', year: 2026 });
    const data = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
    assert.equal(data.sunBranch + data.yin.branch, pair);
    assert.equal(data.yinReverseSource, source);
    assert.equal(data.yinReverse, source !== undefined);
  }
  assert.equal(new Set(pairings.map(([, , pair]) => pair[0])).size, 12);
  assert.ok(pairings.every(([, , pair]) => (branches.indexOf(pair[0]) + branches.indexOf(pair[1])) % 12 === 2));
  for (const pair of ['亥巳', '子午']) assert.ok(pairings.every(([, , found]) => found !== pair));
});

test('p031 preserves Nanyang fire while excluding a trine taken from the other variant', () => {
  const cases = [
    { dateStr: '1985-01-01', year: 2015, sun: '亥', moon: '卯', start: '2015-02-18T16:00:00.000Z',
      natalBlade: false, firebell: true, phrase: '小限守卯宫的归档火星' },
    { dateStr: '1985-01-09', year: 2025, sun: '酉', moon: '巳', start: '2025-01-28T16:00:00.000Z',
      natalBlade: true, firebell: false },
  ];
  for (const { dateStr, year, sun, moon, start, natalBlade, firebell, phrase } of cases) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'nanyang-reverse-' + year, chart: chart(native({ dateStr, timeIndex: 1 })) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'nanyang-reverse', ref);
    validateFortuneFacts(bound);
    const { run, verse, data } = selectVerse(bound, year);
    assert.deepEqual([data.sunBranch, data.yin.branch, data.yin.minorRelation], [sun, moon, '守']);
    assert.equal(data.yinReverseSource, 'nanyang-commentary');
    assert.deepEqual([data.yinReverseYangTuoCandidate, data.yinReverseAnnualYangTuoCandidate, data.yinReverseFireBellCandidate],
      [natalBlade, false, firebell]);
    if (!firebell) assert.equal(data.yinReverseQuanshuFixedFireBellCandidate, false);
    assert.equal(verse.activeFrom, start);
    const result = match(run, 31);
    assert.equal(result.status, firebell ? 'partial' : 'not_matched');
    assert.deepEqual(result.windows, firebell ? [{ start, endExclusive: year + '-12-31T16:00:00.000Z' }] : []);
    assert.deepEqual(result.sourceFactIds, firebell ? [verse.factId] : []);
    const altered = { ...verse, normalizedPayload: { ...data, yinReverseSource: 'other-edition' } };
    assert.equal(match({ ...run, facts: [altered] }, 31).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'nanyang-reverse'));
    const audit = formatFortuneFactAudit(input);
    if (firebell) {
      assert.ok(audit.includes('太阳在' + sun + '宫且太阴在' + moon + '宫，属于南阳堂本《太微赋注解》所列的反背支位'));
      assert.ok(audit.includes(phrase), phrase);
    } else assert.match(audit, /羊陀三合仅作版别对照，陀罗在丑宫/u);
    assert.doesNotMatch(audit, /nanyang-commentary|yinReverseSource/u);
    assert.doesNotMatch(formatFortunePrompt(input), /南阳堂本《太微赋注解》所列的反背支位|yinReverseSource/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
  }
  const { natal, frame } = natalAndFrame({ dateStr: '1985-01-09', timeIndex: 1, gender: '女', year: 2025 });
  removeNatalStar(natal, '太阳');
  const missing = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(missing.yinReverseSource, undefined);
  assert.equal(missing.yinReverseYangTuoCandidate, undefined);
});

test('opposed Tianxiang companions and absent Bell support use the same verified natal star sequence and layer', () => {
  const cases = [
    [3, reference.verseSamples.xiangFallenLianPoYangTuo, '廉贞', 'lianzhen', 'xiangFallenLianPoYangTuoCandidate'],
    [37, { dateStr: '1985-03-22', timeIndex: 1, year: 1994, gender: '女' }, '武曲', 'wuqu', 'quanshuFixedBellWithoutNamedSupportCandidate'],
  ];
  for (const [n, example, star, proofName, field] of cases) {
    const { run, verse, data } = knownVerse(example);
    assert.equal(data[field], true);
    assert.equal(data.anchorAgreement, true);
    assert.equal(data.principalSeatProof[proofName].verified, true);
    if (n === 3) {
      assert.ok(data.xiangLianPo.every(row => row.relation === '冲'));
      assert.ok(data.xiangWuTan.every(row => row.relation === '其他'));
    }
    assert.equal(match(run, n).status, 'partial');
    const { starPlacementProof, ...withoutStarLayerProof } = data;
    assert.equal(starPlacementProof, 'quanshu-nanyangtang-major-layer-v1');
    assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: withoutStarLayerProof }] }, n).status, 'unknown');
    const { natal, frame } = natalAndFrame(example);
    const wrongLayer = structuredClone(natal);
    const sameSeat = wrongLayer.palaces.find(palace => palace.majorStars.some(row => row.name === star));
    const archivedStar = sameSeat.majorStars.find(row => row.name === star);
    sameSeat.majorStars = sameSeat.majorStars.filter(row => row !== archivedStar);
    sameSeat.minorStars.push(archivedStar);
    const wrongLayerData = quanshuLimitVerseContacts(quanshuLimitBranches(wrongLayer, frame));
    assert.equal(wrongLayerData.principalSeatProof[proofName].archiveBranch, undefined);
    assert.equal(wrongLayerData[field], undefined);
    assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: wrongLayerData }] }, n).status, 'unknown');
    const host = natal.palaces.find(palace => palace.majorStars.some(row => row.name === star));
    natal.palaces.find(palace => palace.index === (host.index + 1) % 12).majorStars.push(host.majorStars.find(row => row.name === star));
    host.majorStars = host.majorStars.filter(row => row.name !== star);
    const invalid = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
    assert.equal(invalid.principalSeatProof[proofName].verified, false);
    assert.equal(invalid[field], undefined);
    assert.equal(match({ ...run, facts: [{ ...verse, normalizedPayload: invalid }] }, n).status, 'unknown');
  }
});

test('p037 includes verified Chang and Qu as support and keeps unverified positions unknown', () => {
  const named = knownVerse(reference.verseSamples.bellSupported);
  assert.equal(named.data.bellTanlang.relation, '守');
  assert.equal(named.data.bellWithNamedSupportCandidate, true);
  assert.equal(named.data.bellWithoutNamedSupportCandidate, false);
  assert.equal(named.data.bellTanlangAtLimitCandidate, true);
  assert.equal(match(named.run, 37).status, 'not_matched');
  const assisted = knownVerse(reference.verseSamples.bellWithoutNamedSupport);
  assert.equal(assisted.data.bellWithNamedSupportCandidate, false);
  assert.equal(assisted.data.bellWithAdditionalAidCandidate, true);
  assert.deepEqual(assisted.data.bellAdditionalAid.filter(row => row.relation === '三合' && ['禄存', '天马'].includes(row.star))
    .map(row => [row.star, row.branch]),
    [['禄存', '申'], ['天马', '申']]);
  assert.equal(match(assisted.run, 37).status, 'not_matched');
  const archived = knownVerse({ dateStr: '1949-02-15', timeIndex: 3, year: 1979, gender: '女' });
  assert.deepEqual([archived.data.bell.decadalRelation, archived.data.bell.minorRelation], ['守', '守']);
  assert.equal(archived.data.bellWithNamedSupportCandidate, false);
  assert.deepEqual(archived.data.bellAdditionalAid.filter(row => row.relation !== '其他'), [
    { star: '文昌', branch: '未', relation: '冲' }, { star: '文曲', branch: '未', relation: '冲' },
  ]);
  assert.equal(match(archived.run, 37).status, 'not_matched');

  const fixed = knownVerse({ dateStr: '1953-05-15', timeIndex: 4, year: 1962, gender: '女' });
  assert.equal(fixed.data.quanshuFixedBell.bell.minorRelation, '守');
  assert.deepEqual(fixed.data.quanshuFixedBell.bellAdditionalAid.filter(row => row.relation !== '其他'), [
    { star: '文昌', branch: '午', relation: '三合' },
  ]);
  assert.equal(match(fixed.run, 37).status, 'not_matched');

  const clearSample = { dateStr: '1985-03-22', timeIndex: 1, year: 1994, gender: '女' };
  const unassisted = knownVerse(clearSample);
  const ming = unassisted.data.quanshuFixedBell;
  assert.equal(ming.bellWithoutNamedSupportCandidate, true);
  assert.ok(ming.bellSupport.every(row => row.branch && row.relation === '其他'));
  assert.ok(ming.bellAdditionalAid.every(row => row.branch && row.relation === '其他'));
  assert.equal(match(unassisted.run, 37).status, 'partial');
  const variant = knownVerse({ dateStr: '1947-02-21', timeIndex: 10, year: 1964, gender: '女' });
  assert.equal(variant.data.bell.minorRelation, '守');
  assert.deepEqual(variant.data.bellAdditionalAid.filter(row => row.star === '魁钺组').map(row => row.branch), ['亥', undefined]);
  assert.equal(variant.data.bellWithoutNamedSupportCandidate, false);
  assert.equal(match(variant.run, 37).status, 'not_matched');

  for (const star of ['左辅', '天马', '紫微']) {
    const { natal, frame } = natalAndFrame(clearSample);
    removeNatalStar(natal, star);
    const data = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame)).quanshuFixedBell;
    assert.equal(data.bell.minorRelation, '守');
    assert.equal([...data.bellSupport, ...data.bellAdditionalAid].find(row => row.star === star).branch, undefined);
    assert.equal(data.bellWithoutNamedSupportCandidate, undefined);
  }
  for (const star of ['禄存', '天马', '天魁', '天钺', '文昌', '文曲']) {
    const { natal, frame } = natalAndFrame(clearSample);
    const palace = natal.palaces.find(row => row.minorStars.some(row => row.name === star));
    const [misplaced] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === star), 1);
    palace.adjectiveStars.push(misplaced);
    const limits = quanshuLimitBranches(natal, frame), data = quanshuLimitVerseContacts(limits);
    assert.equal(data.quanshuFixedBell.bell.minorRelation, '守');
    assert.equal(data.quanshuFixedBellWithoutNamedSupportCandidate, undefined, star);
    const active = unassisted.run.facts.find(f => timedBell(f) && f.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate);
    const [phase] = quanshuLimitTiming(natal, limits, { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) },
      { ...frame, age: limits.sourceMinor.ordinal });
    const payload = quanshuTimedBell(phase.data, data);
    assert.equal(match({ ...unassisted.run, facts: [{ ...active, normalizedPayload: payload }] }, 37).status, 'unknown', star);
  }
  const { natal, frame } = natalAndFrame({ dateStr: '1949-03-14', timeIndex: 1, year: 1976, gender: '女' });
  removeNatalStar(natal, '天钺');
  const incompletePair = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame)).jielanBell;
  assert.deepEqual(incompletePair.bellAdditionalAid.filter(row => row.star === '魁钺组').map(row => row.relation), ['三合', undefined]);
  assert.equal(incompletePair.bellWithAdditionalAidCandidate, true);
  assert.equal(incompletePair.bellWithoutNamedSupportCandidate, false);
});

test('p037 restricts the independently seated Ming Bell to the verified Southern limit half', () => {
  const example = { dateStr: '1985-03-22', timeIndex: 1, year: 1994, gender: '女' };
  const { run, verse, data } = submittedVerse(example);
  assert.equal(data.quanshuFixedBellWithoutNamedSupportCandidate, true);
  assert.deepEqual([data.quanshuFixedBell.bell.branch, data.quanshuFixedBell.bell.minorRelation], ['戌', '守']);
  const bell = run.facts.filter(timedBell);
  const former = bell.find(row => row.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate === false);
  const actual = bell.find(row => row.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate === true);
  assert.ok(former && actual);
  assert.equal(actual.activeFrom, former.activeTo);
  assert.equal(actual.activeFrom, new Date(quanshuLunarMidnight(example.year, 7)).toISOString());
  assert.deepEqual(actual.normalizedPayload.bellLimitWindows.find(row => row.edition === 'nanyang'),
    { edition: 'nanyang', branch: '戌', guardScopes: ['minor'], activeInSourceHalf: true, withoutNamedSupport: true,
      tanlangSamePalaceCandidate: false, templeFullNamedSupportCandidate: false });
  assert.equal(actual.normalizedPayload.bellWithoutNamedSupportCandidate, false);
  assert.equal(actual.normalizedPayload.jielanBellWithoutNamedSupportCandidate, false);
  const status = facts => match({ ...run, facts }, 37).status;
  const hit = match(run, 37);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [actual.factId]);
  assert.deepEqual(hit.windows, [{ start: actual.activeFrom, endExclusive: actual.activeTo }]);
  assert.equal(status([former]), 'not_matched');
  assert.equal(status([verse]), 'unknown');
  assert.equal(status([{ ...actual, normalizedPayload: { ...actual.normalizedPayload, quanshuFixedFireBellProfile: 'other-source' } }]), 'not_matched');

  const { natal, frame } = natalAndFrame(example);
  const wrong = { ...frame, minorIndex: frame.decadalIndex };
  const limits = quanshuLimitBranches(natal, wrong);
  assert.equal(limits.sourceMinor.verified, false);
  const [shifted] = quanshuLimitTiming(natal, limits, { start: Date.parse(actual.activeFrom), end: Date.parse(actual.activeTo) },
    { ...wrong, age: limits.sourceMinor.ordinal });
  const payload = quanshuTimedBell(shifted.data, quanshuLimitVerseContacts(limits));
  assert.equal(payload.quanshuFixedBellWithoutNamedSupportCandidate, undefined);
  assert.equal(status([{ ...actual, normalizedPayload: payload }]), 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-bell-southern-half'));
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  assert.match(formatFortuneFactAudit(input), /明刊铃星实守戌宫小限，处于南斗下半年/u);
  assert.doesNotMatch(formatFortunePrompt(input), /bellLimitWindows|南斗下半年|铃星实守戌宫/u);
});

test('p037 confirms the Ming double guard only with source-verified named assistance', () => {
  const example = { dateStr: '1994-05-15', timeIndex: 2, year: 2007, gender: '女' };
  const { run } = submittedVerse(example);
  const bell = run.facts.filter(timedBell);
  const flag = 'quanshuFixedBellDoubleGuardWithNamedAidCandidate';
  const boundary = new Date(quanshuLunarMidnight(example.year, 7)).toISOString();
  const before = bell.find(row => row.activeTo === boundary);
  const later = bell.find(row => row.activeFrom === boundary);
  assert.ok(before && later);
  assert.equal(before.normalizedPayload[flag], false);
  assert.equal(later.normalizedPayload[flag], true);
  assert.equal(later.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate, false);
  assert.deepEqual(later.normalizedPayload.bellMingDoubleGuardAidWitness, { branch: '卯', assists: [
    { star: '武曲', branch: '酉', relation: '冲' },
    { star: '天府', branch: '卯', relation: '守' },
    { star: '左辅', branch: '未', relation: '三合' },
    { star: '右弼', branch: '未', relation: '三合' },
  ] });
  const hit = match(run, 37);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '守临二限');
  assert.deepEqual(hit.sourceFactIds, [later.factId]);
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: later.activeTo }]);
  assert.equal(match({ ...run, facts: [before] }, 37).status, 'not_matched');

  const { natal, frame } = natalAndFrame(example);
  const wrongMinor = { ...frame, minorIndex: (frame.minorIndex + 1) % 12 };
  const bounds = { start: Date.parse(later.activeFrom), end: Date.parse(later.activeTo) };
  const wrongLimits = quanshuLimitBranches(natal, wrongMinor);
  const [wrongPhase] = quanshuLimitTiming(natal, wrongLimits, bounds, { ...wrongMinor, age: wrongLimits.sourceMinor.ordinal });
  const wrongPayload = quanshuTimedBell(wrongPhase.data, quanshuLimitVerseContacts(wrongLimits));
  assert.equal(wrongPayload[flag], undefined);
  assert.equal(match({ ...run, facts: [{ ...later, normalizedPayload: wrongPayload }] }, 37).status, 'unknown');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bell-ming-double-guard-aid'));
  assert.match(formatFortuneFactAudit(input), /明刊铃星与复算大限、小限同在卯宫，已核的同篇助曜有/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /守临二限/u);
  assert.doesNotMatch(prompt, /若无吉曜来相照|守临二限必癫狂|明刊铃星与复算大限、小限同在卯宫|bellMingDoubleGuardAidWitness/u);

  const majorOnly = { ...example, dateStr: '1994-05-05', timeIndex: 1 };
  const majorOnlyRun = submittedVerse(majorOnly).run;
  const special = majorOnlyRun.facts.find(row => timedBell(row) && row.activeFrom === boundary);
  assert.deepEqual(special.normalizedPayload.bellMingDoubleGuardAidWitness.assists.map(row => row.star), ['武曲', '天府']);
  assert.equal(match({ ...majorOnlyRun, facts: [special] }, 37).status, 'matched');
  for (const [birth, dateStr, baseRun, fact, surviving] of [
    [majorOnly, '1994-05-06', majorOnlyRun, special, []],
    [example, '1994-05-16', run, later, ['左辅', '右弼']],
  ]) {
    const { natal: correctNatal, frame: chosenYear } = natalAndFrame(birth);
    const displaced = native({ ...birth, dateStr });
    assert.equal(displaced.rawDates.lunarDate.lunarMonth, correctNatal.rawDates.lunarDate.lunarMonth);
    for (const palace of displaced.palaces) palace.majorStars = correctNatal.palaces.find(row => row.index === palace.index).majorStars;
    const limits = quanshuLimitBranches(displaced, chosenYear);
    const [phase] = quanshuLimitTiming(displaced, limits, bounds, { ...chosenYear, age: limits.sourceMinor.ordinal });
    assert.equal(phase.data.ziweiBirthAnchorVerified, false);
    const payload = quanshuTimedBell(phase.data, quanshuLimitVerseContacts(limits));
    assert.equal(payload[flag], surviving.length ? true : undefined);
    assert.deepEqual(payload.bellMingDoubleGuardAidWitness?.assists.map(row => row.star) ?? [], surviving);
    assert.equal(payload.quanshuFixedBellDoubleGuardWithLiteraryAidCandidate, surviving.length === 0);
    if (surviving.length === 0) {
      assert.deepEqual(payload.bellMingDoubleGuardLiteraryAidWitness, { branch: '卯',
        assists: [{ star: '文昌', branch: '酉', relation: '冲' }] });
    }
    assert.equal(match({ ...baseRun, facts: [{ ...fact, normalizedPayload: payload }] }, 37).status, 'matched');
  }
});

test('p037 confirms Ming double guards with source-verified Chang even when the six Bell helpers are absent', () => {
  const example = { dateStr: '1959-03-30', timeIndex: 8, year: 1998, gender: '女' };
  const { run, data } = submittedVerse(example);
  assert.equal(data.quanshuFixedBell.bellWithNamedSupportCandidate, false);
  const boundary = new Date(quanshuLunarMidnight(example.year, 7)).toISOString();
  const rows = run.facts.filter(timedBell);
  const early = rows.find(row => row.activeTo === boundary), active = rows.find(row => row.activeFrom === boundary);
  assert.ok(early && active);
  const flag = 'quanshuFixedBellDoubleGuardWithLiteraryAidCandidate';
  const witness = 'bellMingDoubleGuardLiteraryAidWitness';
  assert.equal(early.normalizedPayload[flag], false);
  assert.equal(active.normalizedPayload[flag], true);
  assert.equal(active.normalizedPayload.quanshuFixedBellDoubleGuardWithNamedAidCandidate, false);
  assert.equal(active.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate, false);
  assert.deepEqual(active.normalizedPayload[witness], { branch: '戌',
    assists: [{ star: '文昌', branch: '寅', relation: '三合' }] });
  const select = facts => match({ ...run, facts }, 37);
  const hit = select(rows);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '守临二限');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: active.activeTo }]);
  assert.equal(select([early]).status, 'not_matched');

  const { natal, frame } = natalAndFrame(example);
  const chang = natal.palaces.find(row => row.earthlyBranch === '寅');
  const [star] = chang.minorStars.splice(chang.minorStars.findIndex(row => row.name === '文昌'), 1);
  chang.adjectiveStars.push(star);
  const limits = quanshuLimitBranches(natal, frame);
  const bounds = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
  const [phase] = quanshuLimitTiming(natal, limits, bounds, { ...frame, age: limits.sourceMinor.ordinal });
  const wrong = quanshuTimedBell(phase.data, quanshuLimitVerseContacts(limits));
  assert.equal(wrong[flag], undefined);
  assert.equal(wrong[witness], undefined);
  assert.equal(select([{ ...active, normalizedPayload: wrong }]).status, 'unknown');

  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bell-literary-aid')).input;
  assert.match(formatFortuneFactAudit(input), /同书〈岁君〉的文曜接应有/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /参同书〈岁君〉所列文曜/u);
  assert.doesNotMatch(prompt, /文昌在寅宫|bellMingDoubleGuardLiteraryAidWitness|若无吉曜来相照/u);
});

test('p037 binds the explicit Tanlang and temple-aid clauses to each edition and its real Southern limit half', () => {
  const positiveId = 'fortune-entry-866';
  assert.deepEqual(fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId === positiveId).unresolved, []);
  const samePalaceExcerpt = '限至铃星事若何，贪狼相遇福还多', templeAidExcerpt = '更加入庙逢諸吉';
  const positiveHit = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === positiveId);
  const samples = [
    { dateStr: '1990-05-05', timeIndex: 0, year: 2003, gender: '女', branch: '卯',
      field: 'tanlangSamePalaceCandidate', editions: ['archive', 'jielan', 'nanyang'] },
    { dateStr: '1949-02-14', timeIndex: 7, year: 1958, gender: '女', branch: '戌',
      field: 'templeFullNamedSupportCandidate', editions: ['jielan', 'nanyang'] },
  ];
  for (const { branch, field, editions, ...example } of samples) {
    const { run, verse, data } = submittedVerse(example);
    assert.equal(data.quanshuFixedBell.bell.minorRelation, '守');
    const slices = run.facts.filter(timedBell);
    const boundary = new Date(quanshuLunarMidnight(example.year, 7)).toISOString();
    const former = slices.find(row => row.activeTo === boundary);
    const later = slices.find(row => row.activeFrom === boundary);
    assert.ok(former && later);
    assert.deepEqual(former.normalizedPayload.bellPositiveSupportWitnesses, []);
    const p = later.normalizedPayload;
    assert.deepEqual(p.bellLimitWindows.filter(row => row[field] === true).map(row => row.edition), editions);
    const confirmed = p.bellPositiveSupportWitnesses.filter(row =>
      field === 'tanlangSamePalaceCandidate' ? row.tanlang : row.templeNamedSupport);
    assert.deepEqual(confirmed.map(row => row.edition), editions);
    for (const witness of confirmed) {
      assert.deepEqual([witness.branch, witness.guardScopes], [branch, ['minor']]);
      if (field === 'tanlangSamePalaceCandidate') assert.deepEqual(witness.tanlang, { star: '贪狼', branch, relation: '守' });
      else {
        assert.equal(data.quanshuFixedBell.bellSourceGrade, '庙');
        assert.deepEqual(witness.templeNamedSupport.map(row => row.star), ['贪狼', '武曲', '紫微', '天府', '左辅', '右弼']);
        assert.ok(witness.templeNamedSupport.every(row => ['守', '冲', '三合'].includes(row.relation)));
      }
    }
    const status = facts => match({ ...run, facts }, 37).status;
    assert.equal(status([later]), 'not_matched');
    assert.equal(status([verse]), 'unknown');
    const samePalace = field === 'tanlangSamePalaceCandidate';
    const positiveExcerpt = samePalace ? samePalaceExcerpt : templeAidExcerpt;
    const positive = positiveHit(run);
    assert.equal(p.quanshuFixedBellTanlangSamePalaceCandidate, samePalace);
    assert.equal(p.quanshuFixedBellTempleFullSupportCandidate, !samePalace);
    assert.equal(positive.status, 'matched');
    assert.equal(positiveHit({ ...run, facts: [former] }).status, 'not_matched');
    assert.equal(positiveHit({ ...run, facts: [verse] }).status, 'unknown');
    assert.equal(positive.matchedSourceExcerpt, positiveExcerpt);
    assert.deepEqual(positive.sourceFactIds, [later.factId]);
    assert.deepEqual(positive.windows, [{ start: boundary, endExclusive: later.activeTo }]);
    const alternate = { ...later, normalizedPayload: { ...p, quanshuFixedFireBellProfile: 'jielan-named-firebell-hour-v1' } };
    assert.equal(positiveHit({ ...run, facts: [alternate] }).status, 'not_matched');

    const { natal, frame } = natalAndFrame(example);
    const changed = structuredClone(natal), name = field === 'tanlangSamePalaceCandidate' ? '贪狼' : '武曲';
    const wrongPalace = changed.palaces.find(palace => palace.majorStars.some(star => star.name === name));
    const [misplaced] = wrongPalace.majorStars.splice(wrongPalace.majorStars.findIndex(star => star.name === name), 1);
    wrongPalace.adjectiveStars.push(misplaced);
    const bounds = { start: Date.parse(later.activeFrom), end: Date.parse(later.activeTo) };
    for (const [archive, observed] of [[changed, frame], [natal, { ...frame, minorIndex: frame.decadalIndex }]]) {
      const limits = quanshuLimitBranches(archive, observed);
      const [phase] = quanshuLimitTiming(archive, limits, bounds, { ...observed, age: limits.sourceMinor.ordinal });
      const row = quanshuTimedBell(phase.data, quanshuLimitVerseContacts(limits));
      assert.equal(row.bellLimitWindows.find(entry => entry.edition === 'nanyang')[field], undefined);
      assert.ok(!row.bellPositiveSupportWitnesses.some(witness => witness.edition === 'nanyang'
        && (field === 'tanlangSamePalaceCandidate' ? witness.tanlang : witness.templeNamedSupport)));
      assert.notEqual(status([{ ...later, normalizedPayload: row }]), 'matched');
      assert.notEqual(positiveHit({ ...run, facts: [{ ...later, normalizedPayload: row }] }).status, 'matched');
    }

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bell-explicit-source-aids'));
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== ruleNumber(37).knowledgeId)));
    const audit = formatFortuneFactAudit(input);
    const wording = field === 'tanlangSamePalaceCandidate'
      ? /明刊卯宫铃星与本命贪狼同守实际限宫/u : /明刊戌宫铃星入庙，已核助曜有/u;
    assert.match(audit, wording);
    const output = formatFortunePrompt(input);
    assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === positiveId));
    assert.ok(output.includes(positiveExcerpt));
    assert.ok(!output.includes(samePalace ? templeAidExcerpt : samePalaceExcerpt));
    assert.doesNotMatch(output, wording);
    assert.doesNotMatch(output, /若无吉曜来相照|bellPositiveSupportWitnesses|庙铃与贪武紫府辅弼/u);
  }
});

test('entry 866 starts with the verified Southern decade half while the small limit stays elsewhere', () => {
  const birth = { dateStr: '1990-05-05', timeIndex: 0, gender: '女' };
  const evaluate = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-866');
  const before = knownVerse({ ...birth, year: 2017 });
  assert.deepEqual([before.data.quanshuFixedBell.bell.decadalRelation, before.data.quanshuFixedBell.bell.minorRelation], ['守', '其他']);
  assert.ok(before.run.facts.filter(timedBell).every(row => row.normalizedPayload.quanshuFixedBellTanlangSamePalaceCandidate === false));
  assert.equal(evaluate(before.run).status, 'not_matched');

  const next = submittedVerse({ ...birth, year: 2018 });
  assert.deepEqual([next.data.quanshuFixedBell.bell.decadalRelation, next.data.quanshuFixedBell.bell.minorRelation], ['守', '其他']);
  const witnesses = next.run.facts.filter(timedBell);
  assert.ok(witnesses.length);
  assert.ok(witnesses.every(row => row.normalizedPayload.quanshuFixedBellTanlangSamePalaceCandidate === true));
  for (const row of witnesses) {
    const fixed = row.normalizedPayload.bellPositiveSupportWitnesses.find(witness => witness.edition === 'nanyang');
    assert.deepEqual([fixed.branch, fixed.guardScopes], ['卯', ['decadal']]);
  }
  const match = evaluate(next.run);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: new Date(quanshuLunarMidnight(2018, 1)).toISOString(),
    endExclusive: witnesses.at(-1).activeTo }]);
  assert.deepEqual(match.sourceFactIds, witnesses.map(row => row.factId));
});

test('Bell with Tanlang, Wuqu or temple helpers remains local evidence for a separate verse', () => {
  const cases = [
    ['1947-02-05', 2, 2008, '子', '陷', '守', '其他', [true, false, false], '归档铃星与本命贪狼实守子宫小限'],
    ['1990-05-05', 7, 2001, '戌', '庙', '守', '冲', [true, true, false], '武曲在辰宫，与此宫为冲'],
    ['1947-02-05', 0, 2010, '戌', '庙', '三合', '其他', [false, false, true], '左辅在辰宫，与此宫为冲、右弼在戌宫，与此宫为守'],
    ['1947-06-21', 0, 2010, '戌', '庙', '冲', '守', [false, true, true], '紫微在寅宫，与此宫为三合、天府在寅宫，与此宫为三合'],
  ];
  for (const [dateStr, timeIndex, year, branch, grade, tanlangRelation, wuquRelation, candidates, evidence] of cases) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'bell-source-support-' + dateStr + '-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(native({ dateStr, timeIndex })) })));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const { run, verse, data } = selectVerse(bound, year);
    assert.equal(data.bell.branch, branch);
    assert.equal(data.bellSourceGrade, grade);
    assert.equal(data.bellTanlang.relation, tanlangRelation);
    assert.equal(data.bellWuqu.relation, wuquRelation);
    assert.equal(data.bellWithoutNamedSupportCandidate, false);
    assert.deepEqual([data.bellTanlangAtLimitCandidate, data.bellTempleWuTanCandidate, data.bellTempleSupportPairCandidate], candidates);
    const hit = match(run, 37);
    assert.equal(hit.status, 'not_matched');
    assert.deepEqual(hit.sourceFactIds, []);
    assert.deepEqual(hit.windows, []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bell-support'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(evidence));
    assert.doesNotMatch(prompt, /bellTempleSupportPairs|bellTanlangAtLimitCandidate/u);
  }

  const loose = knownVerse({ dateStr: '1947-02-05', timeIndex: 8, year: 2002 });
  assert.equal(loose.data.bellSourceGrade, '庙');
  assert.equal(loose.data.bellTanlang.relation, '三合');
  assert.equal(loose.data.bellWithNamedSupportCandidate, true);
  assert.deepEqual(loose.data.bellTempleSupportPairs, []);
  assert.equal(loose.data.bellTanlangAspectCandidate, true);
  assert.equal(match(loose.run, 37).status, 'not_matched');

  const ungraded = knownVerse({ dateStr: '1947-06-21', timeIndex: 1, year: 2009 });
  assert.equal(ungraded.data.bell.branch, '亥');
  assert.equal(ungraded.data.bellSourceGrade, undefined);
  assert.equal(ungraded.data.bellTempleWuTanCandidate, undefined);
  assert.equal(ungraded.data.bellTempleSupportPairCandidate, undefined);
  assert.equal(ungraded.data.bellTanlangAspectCandidate, true);
  assert.equal(match(ungraded.run, 37).status, 'not_matched');

  const { natal, frame } = natalAndFrame({ dateStr: '1947-02-05', timeIndex: 0, gender: '女', year: 2010 });
  removeNatalStar(natal, '左辅');
  const uncertain = quanshuLimitVerseContacts(quanshuLimitBranches(natal, frame));
  assert.equal(uncertain.bellTempleSupportPairCandidate, undefined);
  assert.deepEqual(uncertain.bellTempleSupportPairs, []);
});

test('Tanlang aspecting the Bell limit remains auditable without matching the unassisted-Bell verse', () => {
  for (const [name, source, start, bellBranch, tanlangBranch, relation] of [
    ['bellTanlangTrine', '归档铃星', '1961-02-14T16:00:00.000Z', '亥', '未', '三合'],
    ['jielanBellTanlangOpposition', '《捷览》所推铃星', '1963-01-24T16:00:00.000Z', '巳', '亥', '冲'],
  ]) {
    const { run, verse, data } = submittedVerse(name);
    const useArchive = source === '归档铃星', evidence = useArchive ? data : data.jielanBell;
    assert.equal(data.bellTanlangAspectCandidate, useArchive);
    assert.equal(evidence.bell.branch, bellBranch);
    assert.equal(evidence.bell.minorRelation, '守');
    assert.deepEqual(evidence.bellTanlang, { star: '贪狼', branch: tanlangBranch, relation });
    assert.equal(evidence.bellTanlangAspectCandidate, true);
    assert.equal(evidence.bellTanlangAtLimitCandidate, false);
    assert.notEqual(evidence.bellTempleWuTanCandidate, true);
    assert.notEqual(evidence.bellTempleSupportPairCandidate, true);
    if (!useArchive) assert.notEqual(data.bell.branch, bellBranch);
    const hit = match(run, 37);
    assert.equal(verse.activeFrom, start);
    assert.equal(hit.status, 'not_matched');
    assert.deepEqual(hit.sourceFactIds, []);
    assert.deepEqual(hit.windows, []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('本命贪狼在' + tanlangBranch + '宫，与' + source + '所守的限宫为' + relation));
    assert.doesNotMatch(prompt, /bellTanlangAspectCandidate|jielanBell/u);
  }

  const near = knownVerse(reference.verseSamples.bellOtherHelpersOnly);
  assert.equal(near.data.bellWithNamedSupportCandidate, true);
  assert.equal(near.data.bellTanlang.relation, '其他');
  assert.equal(near.data.bellTanlangAspectCandidate, false);
  assert.equal(near.data.bellTempleHelperGroupsCandidate, false);
  assert.equal(match(near.run, 37).status, 'not_matched');
});

test('p037 binds both named helper groups, all six companions and dual guards to independent Bell positions in SQLite', () => {
  const cases = [
    ['1947-09-05', 0, 1962, 'archive', '戌', 'helper-groups', '紫微天府与左辅右弼均会此宫'],
    ['1949-06-05', 11, 1966, 'jielan', '寅', 'helper-groups', '紫微天府与左辅右弼均会此宫'],
    ['1947-11-05', 8, 1954, 'archive', '午', 'all-six', '贪狼武曲、紫微天府、左辅右弼三组均会此宫'],
    ['1949-02-14', 7, 1958, 'jielan', '戌', 'all-six', '贪狼武曲、紫微天府、左辅右弼三组均会此宫'],
    ['1947-02-05', 3, 1971, 'archive', '丑', 'additional-aid', '天马在巳宫，与此宫为三合'],
    ['1949-03-14', 1, 1976, 'jielan', '辰', 'additional-aid', '魁钺组在子宫，与此宫为三合'],
    ['1985-03-22', 1, 2036, 'nanyang', '戌', 'dual-guard', '大小限同守铃星宫，贪狼、武曲、紫微、天府、左辅、右弼均已核位', '男'],
  ];
  for (const [dateStr, timeIndex, year, source, branch, condition, phrase, gender = '女'] of cases) {
    const birthHour = String(timeIndex * 2).padStart(2, '0');
    const birthOffset = ['1947-06-05', '1947-09-05'].includes(dateStr) ? '+09:00' : '+08:00';
    const birthContext = { precision: 'minute', birthInstant: new Date(dateStr + 'T' + birthHour + ':00:00' + birthOffset).toISOString(),
      latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const { run, verse, data } = submittedVerse({ dateStr, timeIndex, year, gender }, birthContext);
    const evidence = source === 'archive' ? data : source === 'jielan' ? data.jielanBell : data.quanshuFixedBell;
    assert.equal(evidence.bell.branch, branch);
    assert.equal(evidence.bell.minorRelation, '守');
    if (source === 'jielan') {
      assert.notEqual(data.bell.branch, branch);
      assert.equal(data.jielanBellCandidate, true);
      assert.ok(data.bell.decadalRelation !== '守' && data.bell.minorRelation !== '守');
    }
    assert.equal(evidence.bellTempleHelperGroupsCandidate, ['helper-groups', 'all-six'].includes(condition));
    assert.equal(evidence.bellTempleFullSupportCandidate, condition === 'all-six');
    assert.equal(evidence.bellDoubleLimitWithoutNamedSupportCandidate, condition === 'dual-guard');
    if (condition === 'helper-groups') {
      assert.equal(evidence.bellTanlang.relation, '其他');
      assert.equal(evidence.bellWuqu.relation, '三合');
      assert.equal(evidence.bellTempleSupportPairCandidate, false);
      assert.equal(evidence.bellWithoutNamedSupportCandidate, false);
      assert.equal(data.jielanBell.bellTempleHelperGroupsCandidate, true);
      const withoutGroupEvidence = { ...verse, normalizedPayload: { ...data,
        bellTempleHelperGroupsCandidate: false, jielanBellCandidate: false } };
      assert.equal(match({ ...run, facts: [withoutGroupEvidence] }, 37).status, 'unknown');
    }
    if (condition === 'dual-guard' || condition === 'additional-aid') {
      assert.equal(evidence.bell.decadalRelation, '守');
      assert.deepEqual([evidence.bellTanlang, evidence.bellWuqu, ...evidence.bellSupport].map(row => row.relation), Array(6).fill('其他'));
      assert.equal(evidence.bellWithAdditionalAidCandidate, condition === 'additional-aid');
    }
    const result = match(run, 37);
    const unassisted = condition === 'dual-guard';
    assert.equal(result.status, unassisted ? 'partial' : 'not_matched');
    const eligible = run.facts.filter(row => timedBell(row) && row.normalizedPayload.quanshuFixedBellWithoutNamedSupportCandidate === true);
    assert.deepEqual(result.sourceFactIds, unassisted ? eligible.map(row => row.factId) : []);
    assert.deepEqual(result.windows, unassisted ? [{ start: eligible[0].activeFrom, endExclusive: eligible.at(-1).activeTo }] : []);
    if (unassisted) {
      assert.deepEqual(eligible.map(row => row.normalizedPayload.bellLimitWindows.find(witness => witness.edition === source).guardScopes),
        [['decadal'], ['decadal', 'minor']]);
      assert.equal(eligible[0].activeTo, new Date(quanshuLunarMidnight(year, 7)).toISOString());
      assert.equal(eligible[1].normalizedPayload.quanshuFixedBellDoubleGuardWithNamedAidCandidate, false);
      assert.equal(eligible[1].normalizedPayload.bellMingDoubleGuardAidWitness, undefined);
    }
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run,
      interpretFortune(run, requestForFortuneRun(run), 'bell-named-groups')).input);
    assert.ok(prompt.includes(phrase), phrase);
    const location = { archive: '宫的归档铃星', jielan: '宫的《捷览》所推铃星', nanyang: '宫的南阳堂明刊铃星' };
    assert.ok(prompt.includes(location[source]));
    assert.doesNotMatch(prompt, /bellTempleHelperGroupsCandidate|bellDoubleLimitWithoutNamedSupportCandidate/u);
  }
});

test('older fire/bell facts cannot substitute for the annual verse and the Chinese projection keeps evidence and partial material separate', () => {
  const { run, verse } = knownVerse(exampleFor(28));
  assert.ok(specific(run).length && verse.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  const without = { ...run, facts: run.facts.filter(row => row.factType !== verseFactType && row.factType !== timedType) };
  assert.equal(match(without, 28).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'limit-verse-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /天同午宫为陷，同段见对冲的具名煞曜/u);
  assert.match(prompt, /归档铃星在子宫，与此宫为冲/u);
  assert.doesNotMatch(prompt, /quanshu_limit_verse_contacts|tongFallenOpposedCandidate|yinFireBell|limit-verse-prompt/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === ruleNumber(27).knowledgeId));
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === ruleNumber(28).knowledgeId));
  const transport = formatFortunePrompt(input);
  assert.match(transport, /把临限与经营家业、开拓资源相联/u);
  assert.match(transport, /陷地受恶煞冲时另辨阻力/u);
  assert.doesNotMatch(transport, /归档铃星在子宫|实守小限午宫/u);
});

test('unknown time, inconsistent year, leap birth and ambiguous input cannot become complete source matches', () => {
  const leap = native(); leap.rawDates.lunarDate.isLeap = true;
  assert.equal(quanshuFireBellCondition(leap, 4, 4, 2026, 'yearly').ready, false);
  assert.equal(quanshuFireBellCondition(native(), 4, 5, 2026, 'yearly').ready, false);
  const unknown = chart(native()); unknown.timeKnown = false;
  assert.equal(match(calculate(unknown), 3).status, 'unknown');
  const ambiguous = chart(native()); ambiguous.ziwei.rawResult.push(structuredClone(ambiguous.ziwei.rawResult[0]));
  assert.equal(match(calculate(ambiguous), 3).status, 'unknown');
});

test('source evidence hashes are unchanged and the legacy hour flag cannot promote p012 or the former p049 guard', () => {
  const unresolvedTopic = new Map([[3, '二限'], [28, '恶杀'], [30, '相凑'], [31, '羊陀'], [37, '会照']]);
  for (const example of reference.examples) {
    const rule = ruleNumber(example.n), entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    if (example.n === 49) {
      assert.deepEqual(rule.unresolved, []);
      assert.ok(rule.review.supportingSources.includes('https://sndmp.com/classics/facsimile/quanshu/book-2/0102.jpg'));
    } else if (example.n === 12) {
      assert.deepEqual(rule.unresolved, []);
      assert.ok(rule.review.supportingSources.includes('https://www.shidianguji.com/zh/book/SDZJ0170/chapter/1jvzoopnqo0t6'));
    } else if (example.n === 1) {
      assert.deepEqual(rule.unresolved, []);
      assert.equal(rule.queries[0].where.tianjiPhaseCandidate, true);
    } else if (example.n === 27) {
      assert.deepEqual(rule.unresolved, []);
      assert.equal(rule.queries[0].where.star, '天同');
      assert.equal(rule.queries[0].where.activeInSourceHalf, true);
      assert.equal(rule.queries[0].where.tongSupportCandidate, undefined);
    } else {
      assert.ok(rule.unresolved.some(t => t.includes(unresolvedTopic.get(example.n) ?? '生时')));
      assert.ok(rule.review.supportingSources.includes(reference.sourceURL));
    }
  }
  for (const n of [12, 49]) {
    const run = structuredClone(real(reference.examples.find(e => e.n === n)));
    specific(run).forEach(f => { f.normalizedPayload.sourceHourRuleVerified = true; });
    assert.equal(match(run, n).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'firebell-prompt-' + n));
    assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === ruleNumber(n).knowledgeId));
  }
});

test('the new source contexts are clipped at lunar new year and cannot borrow year-specific White Tiger from an adjacent segment', () => {
  const run = real(reference.examples.find(e => e.n === 49));
  const matching = specific(run).filter(f => f.scope === 'yearly' && f.normalizedPayload.annualWhiteTigerAtLife);
  assert.ok(matching.length); assert.equal(matching[0].activeFrom, '2021-02-11T16:00:00.000Z');
  assert.ok(specific(run).filter(f => f.scope === 'yearly' && f.normalizedPayload.lunarYear === 2020).every(f => !f.normalizedPayload.annualWhiteTigerAtLife));
});

test('Chinese input keeps source groups, product coordinates and unknowns separate without raw payloads or partial findings', () => {
  const run = real(reference.examples.find(e => e.n === 3)), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'firebell-chinese'));
  const fact = input.facts.find(f => f.type === 'quanshu_firebell_context'); assert.ok(fact);
  const text = describeFortuneFact(fact, String);
  for (const phrase of ['录文在该组只列宫位', '据南阳堂明刊命图的生年组定宫', '按该产品生时法', '本命天马按生年支重算', '年度天马候选']) assert.ok(text.includes(phrase), phrase);
  assert.ok(!/[{}\[\]]|quanshu-|sourcePair|archive_product_hour|sourceHourRuleVerified/u.test(text));
  assert.ok(formatFortuneFactAudit(input).includes('不能将二者混拼'));
});
