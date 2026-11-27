import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';

const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { anglesFromFrame } = await import('./control/western-houses.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { evaluateFortuneRules } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { buildLeoLunarConditions } = await import('./control/leo-lunar-conditions.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');

const day = 86_400_000;
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const now = Date.parse('2026-01-01T00:00:00Z');
const submissions = new Map();
const matches = new WeakMap();

function submit(birthDate, month, frameAvailable = true) {
  const key = JSON.stringify([birthDate, month, frameAvailable]);
  const cached = submissions.get(key);
  if (cached) return cached;
  const birth = new Date(birthDate + 'T04:00:00Z');
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birth.getTime() / day + 2440587.5,
      ...(frameAvailable ? anglesFromFrame(0, 0, 23.44) : {}),
      positions: bodies.map(planet => ({ planet,
        longitude: planet === 'Sun' ? SunPosition(birth).elon : Ecliptic(GeoVector(Body[planet], birth, true)).elon })),
    }],
  } };
  const parameters = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
  const reference = { snapshotId: 'monthly-lunar-directions-' + birthDate };
  const submission = buildFortuneFactSubmission(parameters, now, { ...reference, chart });
  const batch = JSON.parse(JSON.stringify(submission));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  submissions.set(key, run);
  return run;
}

function baseFacts(run, target, aspect, type = 'leo_lunar_condition') {
  return run.facts.filter(({ factType, normalizedPayload }) => factType === type
    && normalizedPayload.progressedBody === 'Moon' && normalizedPayload.natalTargetId === target
    && normalizedPayload.aspectType === aspect);
}

function match(run, passage) {
  if (!matches.has(run)) matches.set(run, matchFortuneKnowledge(run).byMethod.western);
  return matches.get(run).find(row => row.knowledgeId.includes('interpretation-' + passage + '-'));
}

function assertPartialCandidate(run, passage, auditPhrase) {
  const result = match(run, passage);
  assert.equal(result.status, 'partial');
  assert.ok(result.unresolvedConditions.length);
  const report = interpretFortune(run, requestForFortuneRun(run), 'monthly-lunar-directions-' + passage);
  const { input } = buildFortuneModelContext(run, report);
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== result.knowledgeId)));
  if (auditPhrase) assert.ok(auditPhrase.test(formatFortuneFactAudit(input)), passage);
  return result;
}

function assertMatchedExactObservation(run, passage, target, aspect) {
  const result = match(run, passage);
  assert.equal(result.status, 'matched');
  const points = baseFacts(run, target, aspect, 'leo_lunar_exact_observation')
    .filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.ok(points.length > 0);
  assert.ok(points.every(fact => fact.normalizedPayload.observed === true));
}

function assertCompleteCandidate(run, passage, auditPhrase) {
  const result = match(run, passage);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-lunar-' + passage));
  assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === result.knowledgeId)));
  if (auditPhrase) assert.match(formatFortuneFactAudit(input), auditPhrase);
  return result;
}

const cases = [
  { passage: 'p157', target: 'Mars', aspect: 'semisquare', supported: ['1980-05-07', 2], unsupported: ['1979-01-10', 7] },
  { passage: 'p171', target: 'Mercury', aspect: 'sesquiquadrate', supported: ['1980-06-06', 8], unsupported: ['1979-04-22', 6] },
  { passage: 'p211', target: 'Uranus', aspect: 'sesquiquadrate', supported: ['1979-08-26', 1], unsupported: ['1979-01-19', 4] },
];

for (const { passage, target, aspect, supported, unsupported } of cases) {
  test(`${passage} keeps an exact Moon ${aspect} ${target} apart from an adverse major direction`, () => {
    const supportedRun = submit(...supported);
    assertMatchedExactObservation(supportedRun, passage, target, aspect);
    const witnesses = baseFacts(supportedRun, target, aspect).filter(fact =>
      ['mixed', 'adverse'].includes(fact.normalizedPayload.directionSupportState));
    assert.ok(witnesses.length > 0);
    for (const { normalizedPayload: fact } of witnesses) {
      assert.ok(['mixed', 'adverse'].includes(fact.directionSupportState));
      assert.ok(fact.supportingDirections.some(direction => direction.nature === 'adverse'));
      assert.ok(fact.supportingDirections.every(direction => direction.targetKind === fact.targetKind));
    }
    const unsupportedRun = submit(...unsupported);
    const isolated = baseFacts(unsupportedRun, target, aspect);
    assert.ok(isolated.length > 0);
    assert.ok(isolated.every(fact => ['none', 'favourable'].includes(fact.normalizedPayload.directionSupportState)));
    assertMatchedExactObservation(unsupportedRun, passage, target, aspect);
  });
}

const majorDirectionCases = [
  { passage: 'p151', target: 'Jupiter', aspect: 'sesquiquadrate', supported: ['1966-10-13', 7],
    unsupported: ['1968-02-20', 10], activeState: 'adverse', absentState: 'none', lunarEvidence: 'hasSameLayerAdverseContact', basicExact: true },
  { passage: 'p161', target: 'Mars', aspect: 'sesquiquadrate', supported: ['1971-06-30', 7],
    unsupported: ['1971-11-07', 12], activeState: 'adverse', absentState: 'favourable', lunarEvidence: 'hasSameLayerAdverseContact' },
  { passage: 'p191', target: 'Saturn', aspect: 'sesquiquadrate', supported: ['1968-05-10', 6],
    unsupported: ['1966-11-07', 2], activeState: 'adverse', absentState: 'favourable', lunarEvidence: 'hasSameLayerAdverseContact', basicExact: true },
  { passage: 'p207', target: 'Uranus', aspect: 'semisquare', supported: ['1967-05-11', 6],
    unsupported: ['1966-11-07', 2], activeState: 'adverse', absentState: 'favourable', lunarEvidence: 'hasSameLayerAdverseContact', basicExact: true },
  { passage: 'p212', target: 'Uranus', aspect: 'quincunx', supported: ['1971-10-03', 1],
    unsupported: ['1973-12-06', 8], activeState: 'favourable', absentState: 'none', lunarEvidence: 'hasSameLayerFavourableContact' },
  { passage: 'p214', target: 'Uranus', aspect: 'parallel', supported: ['1969-04-26', 12],
    unsupported: ['1969-09-23', 10], activeState: 'adverse', absentState: 'none', lunarEvidence: 'hasSameLayerAdverseContact' },
  { passage: 'p221', target: 'Venus', aspect: 'sesquiquadrate', supported: ['1958-02-20', 9],
    unsupported: ['1957-10-23', 9], activeState: 'adverse', absentState: 'favourable', lunarEvidence: 'hasSameLayerAdverseContact' },
  { passage: 'p223', target: 'Venus', aspect: 'opposition', supported: ['1959-09-03', 10],
    unsupported: ['1958-03-17', 7], activeState: 'adverse', absentState: 'none', lunarEvidence: 'hasSameLayerAdverseContact' },
];

for (const { passage, target, aspect, supported, unsupported, activeState, absentState, lunarEvidence,
  basicExact } of majorDirectionCases) {
  test(`${passage} keeps a classified major direction distinct from additional Moon contacts`, () => {
    const supportedRun = submit(...supported);
    if (basicExact) assertMatchedExactObservation(supportedRun, passage, target, aspect);
    const advanced = ['p161', 'p214', 'p221', 'p223'].includes(passage);
    const exactContext = passage === 'p212';
    const result = basicExact ? match(supportedRun, passage)
      : advanced || exactContext ? assertCompleteCandidate(supportedRun, passage) : assertPartialCandidate(supportedRun, passage);
    const facts = baseFacts(supportedRun, target, aspect);
    const sources = new Set(result.sourceFactIds);
    const used = facts.filter(fact => fact.normalizedPayload.directionSupportState === activeState
      && (basicExact ? !sources.has(fact.factId) : sources.has(fact.factId)));
    assert.ok(used.length > 0);
    assert.ok(used.every(({ normalizedPayload: fact }) => fact.directionSupportState === activeState
      && fact.supportingDirections.some(direction => direction.nature === activeState && direction.targetKind === fact.targetKind)));
    if (advanced) assert.ok(used.some(fact => fact.normalizedPayload.monthlyLunarQualification === 'strengthened'));
    if (passage === 'p161') {
      assert.ok(used.every(({ normalizedPayload: fact }) => fact.monthlyLunarHasExact));
      assert.ok(facts.some(fact => fact.normalizedPayload.directionSupportState === 'adverse'
        && !fact.normalizedPayload.monthlyLunarHasExact && !sources.has(fact.factId)));
    }
    if (aspect === 'parallel') {
      assert.ok(used.every(({ normalizedPayload: fact }) => fact.coordinate === 'equatorial_declination_of_date'
        && fact.allowedOrb === 1 && fact.parallelComparison === 'absolute-declination-north-south-not-required'));
      const otherChart = facts.filter(({ normalizedPayload: fact }) => fact.targetKind === 'progressed');
      assert.ok(otherChart.length > 0);
      const exactOtherChart = otherChart.filter(fact => fact.normalizedPayload.monthlyLunarHasExactInOwnFrame === true);
      assert.ok(exactOtherChart.length > 0);
      assert.ok(exactOtherChart.every(fact => fact.normalizedPayload.directionSupportState === 'none'
        && fact.normalizedPayload.monthlyLunarQualification === 'base' && sources.has(fact.factId)));
    }

    const unsupportedRun = submit(...unsupported);
    const isolated = baseFacts(unsupportedRun, target, aspect);
    assert.ok(isolated.some(({ normalizedPayload: fact }) =>
      fact.directionSupportState === absentState && fact[lunarEvidence] === true));
    if (passage === 'p161') assert.ok(isolated.some(({ normalizedPayload: fact }) =>
      fact.monthlyLunarHasExact && fact.directionSupportState === 'favourable'));
    if (basicExact) assertMatchedExactObservation(unsupportedRun, passage, target, aspect);
    else if (exactContext) {
      const isolatedMatch = assertCompleteCandidate(unsupportedRun, passage);
      const exactMatches = isolated.filter(fact => isolatedMatch.sourceFactIds.includes(fact.factId));
      assert.ok(exactMatches.length > 0 && exactMatches.every(fact => fact.normalizedPayload.monthlyLunarHasExact === true));
    } else if (advanced && passage !== 'p223') {
      const isolatedMatch = assertCompleteCandidate(unsupportedRun, passage);
      assert.ok(isolated.filter(fact => isolatedMatch.sourceFactIds.includes(fact.factId))
        .every(fact => fact.normalizedPayload.monthlyLunarQualification === 'base'));
    } else {
      if (passage === 'p223') assert.ok(isolated.every(fact => fact.normalizedPayload.monthlyLunarHasExact === false));
      assert.equal(match(unsupportedRun, passage).status, 'not_matched');
    }
  });
}

test('p203 distinguishes an exact opposition from its own chart’s adverse solar directions', () => {
  const withSolar = submit('1987-12-23', 2);
  const result = assertCompleteCandidate(withSolar, 'p203', /精确月日对冲所在的同一盘层片段有已核偏难太阳推运/u);
  const accepted = baseFacts(withSolar, 'Sun', 'opposition').filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.ok(accepted.length > 0);
  assert.ok(accepted.every(({ normalizedPayload: data }) => data.monthlyLunarHasExact === true));
  assert.ok(accepted.some(({ normalizedPayload: data }) => data.sameLayerSolarDirectionState === 'adverse'
    && data.monthlyLunarQualification === 'strengthened' && data.supportingDirections.some(direction =>
      direction.body === 'Sun' && direction.nature === 'adverse' && direction.targetKind === data.targetKind)));
  const adjacent = submit('1987-12-23', 3);
  assert.ok(baseFacts(adjacent, 'Sun', 'opposition').some(({ normalizedPayload: data }) =>
    data.sameLayerSolarDirectionState === 'adverse' && data.monthlyLunarHasExact === false));
  assert.equal(match(adjacent, 'p203').status, 'not_matched');

  const withMutual = submit('1947-04-08', 9);
  const isolated = baseFacts(withMutual, 'Sun', 'opposition');
  assert.ok(isolated.some(({ normalizedPayload: fact }) =>
    fact.monthlyLunarHasExact && fact.hasAdverseSolarDirection === false && fact.supportingDirections.some(direction =>
      direction.body !== 'Sun' && direction.target !== 'Sun' && direction.nature === 'adverse')));
  const base = assertCompleteCandidate(withMutual, 'p203');
  assert.ok(isolated.filter(fact => base.sourceFactIds.includes(fact.factId))
    .every(fact => fact.normalizedPayload.monthlyLunarQualification === 'base'));
});

test('p203 solar state preserves mixed readings and excludes other chart layers and ended directions', () => {
  const band = (body, target, aspectType, start, end, targetKind = 'natal') => ({
    progressedBody: body, natalTargetId: target, aspectType, start, end, targetKind, exactTimes: [],
  });
  const base = { ...band('Moon', 'Sun', 'opposition', 0, 10), exactTimes: [6] };
  const related = [band('Sun', 'Saturn', 'semisquare', 0, 6), band('Sun', 'Saturn', 'semisquare', 4, 10, 'progressed'),
    band('Mars', 'Jupiter', 'opposition', 0, 10)];
  const atExact = bands => buildLeoLunarConditions([base, ...related, ...bands]).find(row =>
    row.base === base && row.monthlyThemeEvidence?.hasExact === true);
  assert.equal(atExact([]).sameLayerSolarDirectionState, 'none');
  const adverse = band('Sun', 'Saturn', 'semisquare', 6, 10);
  assert.equal(atExact([adverse]).sameLayerSolarDirectionState, 'adverse');
  assert.equal(atExact([adverse, band('Sun', 'Jupiter', 'sextile', 6, 10)]).sameLayerSolarDirectionState, 'mixed');
});

test('p205 requires the exact Moon–Uranus conjunction in the requested month', () => {
  const withConjunction = submit('1969-08-14', 8);
  assertMatchedExactObservation(withConjunction, 'p205', 'Uranus', 'conjunction');

  const withOpposition = submit('1970-03-07', 12);
  assert.ok(baseFacts(withOpposition, 'Uranus', 'opposition', 'leo_progressed_aspect').length > 0);
  assert.equal(match(withOpposition, 'p205').status, 'not_matched');
});

const exactVenusCases = [
  { passage: 'p216', aspect: 'semisextile', degrees: 30, basic: ['1963-12-07', 4], basicAt: '2026-04-16',
    reinforced: ['1967-02-09', 3], reinforcedAt: '2026-03-20', supportPassage: 'p338', nearbyMonth: 4 },
  { passage: 'p218', aspect: 'sextile', degrees: 60, basic: ['1963-02-05', 11], basicAt: '2026-11-15',
    reinforced: ['1972-08-11', 7], reinforcedAt: '2026-07-24', supportPassage: 'p298', nearbyMonth: 8 },
];

for (const { passage, aspect, degrees, basic, basicAt, reinforced, reinforcedAt, supportPassage, nearbyMonth } of exactVenusCases) {
  test(`${passage} locates the exact Venus aspect and keeps same-nature major support within that slice`, () => {
    const basicRun = submit(...basic);
    const basicMatch = match(basicRun, passage);
    assert.equal(basicMatch.status, 'matched');
    const lowerEvidence = baseFacts(basicRun, 'Venus', aspect).find(fact =>
      fact.normalizedPayload.monthlyThemeEvidence?.exactFrames?.some(frame => frame.exactAt.startsWith(basicAt)));
    assert.ok(lowerEvidence);
    assert.equal(lowerEvidence.normalizedPayload.monthlyLunarHasUnopposedMajorSupport, false);
    assert.equal(lowerEvidence.normalizedPayload.monthlyThemeEvidence.majorState, 'none');

    const reinforcedRun = submit(...reinforced);
    const reinforcedMatch = match(reinforcedRun, passage);
    assert.equal(reinforcedMatch.status, 'matched');
    const strongerEvidence = baseFacts(reinforcedRun, 'Venus', aspect).find(fact =>
      fact.normalizedPayload.monthlyThemeEvidence?.exactFrames?.some(frame => frame.exactAt.startsWith(reinforcedAt))
      && fact.normalizedPayload.monthlyLunarHasUnopposedMajorSupport);
    assert.ok(strongerEvidence);
    const { majorState, majorDirections } = strongerEvidence.normalizedPayload.monthlyThemeEvidence;
    assert.equal(majorState, 'favourable');
    assert.ok(majorDirections.some(direction =>
      direction.targetKind === 'natal' && direction.passage === supportPassage && direction.nature === 'favourable'));

    for (const [run, result, fact, date] of [
      [basicRun, basicMatch, lowerEvidence, basicAt], [reinforcedRun, reinforcedMatch, strongerEvidence, reinforcedAt],
    ]) {
      const frame = fact.normalizedPayload.monthlyThemeEvidence.exactFrames.find(item => item.exactAt.startsWith(date));
      assert.ok(frame);
      assert.equal(frame.targetKind, 'natal');
      assert.ok(fact.activeFrom <= frame.exactAt && frame.exactAt < fact.activeTo);
      const angle = Math.abs(((frame.moonLongitude - frame.targetLongitude + 540) % 360) - 180);
      assert.ok(Math.abs(angle - degrees) < 0.0001);
      assert.ok(baseFacts(run, 'Venus', aspect, 'leo_lunar_exact_observation').some(point =>
        result.sourceFactIds.includes(point.factId) && point.exactInstant === frame.exactAt));
    }

    const nearbyRun = submit(reinforced[0], nearbyMonth);
    const nearby = baseFacts(nearbyRun, 'Venus', aspect);
    assert.ok(nearby.some(fact => fact.normalizedPayload.monthlyLunarHasUnopposedMajorSupport));
    assert.ok(nearby.every(fact => !fact.normalizedPayload.monthlyLunarHasExactInOwnFrame));
    assert.equal(baseFacts(nearbyRun, 'Venus', aspect, 'leo_lunar_exact_observation').length, 0);
    assert.ok(nearbyRun.facts.some(fact => fact.factType === 'leo_lunar_exact_observation'
      && fact.normalizedPayload.observed === false && fact.exactInstant === undefined));
    assert.equal(match(nearbyRun, passage).status, 'not_matched');
  });
}

test('p220 distinguishes the exact Moon–Venus trine from the optional favourable relationship direction', () => {
  const withBoth = submit('1962-02-04', 1);
  const result = assertCompleteCandidate(withBoth, 'p220', /精确月金三合所在的同一片段有已核的偏顺情感主题主要推运/u);
  const accepted = baseFacts(withBoth, 'Venus', 'trine').filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.ok(accepted.length > 0);
  assert.ok(accepted.every(({ normalizedPayload: data }) => data.monthlyLunarHasExact === true));
  assert.ok(accepted.some(({ normalizedPayload: data }) => data.monthlyLunarMajorState === 'favourable'
    && data.monthlyLunarQualification === 'strengthened' && data.monthlyThemeEvidence.majorDirections.some(direction =>
      direction.body === 'Sun' && direction.target === 'Jupiter' && direction.aspectType === 'sextile'
      && direction.targetKind === data.targetKind && direction.nature === 'favourable')));

  const exactRun = submit('1958-03-12', 9);
  assert.ok(baseFacts(exactRun, 'Venus', 'trine').some(({ normalizedPayload: fact }) =>
    fact.monthlyLunarHasExactInOwnFrame === true
    && fact.monthlyLunarHasUnopposedMajorSupport === false && fact.directionSupportState === 'none'));
  const base = assertCompleteCandidate(exactRun, 'p220');
  assert.ok(baseFacts(exactRun, 'Venus', 'trine').filter(fact => base.sourceFactIds.includes(fact.factId))
    .every(fact => fact.normalizedPayload.monthlyLunarQualification === 'base'));

  const majorRun = submit('1962-02-04', 2);
  assert.ok(baseFacts(majorRun, 'Venus', 'trine').some(({ normalizedPayload: fact }) =>
    fact.monthlyLunarHasExactInOwnFrame === false
    && fact.directionSupportState === 'favourable' && fact.supportingDirections.some(direction =>
      direction.body === 'Sun' && direction.target === 'Jupiter' && direction.aspectType === 'sextile'
      && direction.targetKind === fact.targetKind && direction.nature === 'favourable')));
  assert.equal(match(majorRun, 'p220').status, 'not_matched');

  const lunarRun = submit('1958-12-07', 8);
  assert.ok(baseFacts(lunarRun, 'Venus', 'trine').some(({ normalizedPayload: fact }) =>
    fact.sameLayerLunarState === 'all_favourable' && fact.monthlyLunarHasExactInOwnFrame === false
    && fact.monthlyLunarHasUnopposedMajorSupport === false && fact.directionSupportState === 'none'));
  assert.equal(match(lunarRun, 'p220').status, 'not_matched');
});

const exactVenusNearCases = [
  { passage: 'p215', aspect: 'conjunction', birth: '1986-06-27', exactMonth: 2, nearbyMonth: 1, majorState: 'favourable' },
  { passage: 'p217', aspect: 'semisquare', birth: '1963-12-13', exactMonth: 12, nearbyMonth: 11, majorState: 'adverse' },
  { passage: 'p219', aspect: 'square', birth: '1960-06-03', exactMonth: 11, nearbyMonth: 12, majorState: 'adverse' },
  { passage: 'p222', aspect: 'quincunx', birth: '1960-06-24', exactMonth: 11, nearbyMonth: 12, majorState: 'none' },
];

for (const { passage, aspect, birth, exactMonth, nearbyMonth, majorState } of exactVenusNearCases) {
  test(`${passage} requires the exact Venus aspect in the requested month`, () => {
    const exactRun = submit(birth, exactMonth);
    assertMatchedExactObservation(exactRun, passage, 'Venus', aspect);

    const nearbyRun = submit(birth, nearbyMonth);
    const nearby = baseFacts(nearbyRun, 'Venus', aspect);
    assert.ok(nearby.some(({ normalizedPayload: fact }) => fact.monthlyThemeEvidence.majorState === majorState));
    assert.ok(nearby.every(({ normalizedPayload: fact }) => fact.monthlyLunarHasExactInOwnFrame === false));
    assert.equal(match(nearbyRun, passage).status, 'not_matched');
  });
}

// All 16 rules use a genuine point recalculated from ephemeris and the chart's own frame.
const romanceExactEvidence = [
  [679, 'p157', 'Mars', 'semisquare', '1979-01-10', 7, '2026-07-04'],
  [683, 'p161', 'Mars', 'sesquiquadrate', '1971-11-07', 12, '2026-12-14'],
  [693, 'p171', 'Mercury', 'sesquiquadrate', '1979-04-22', 6, '2026-06-23'],
  [725, 'p203', 'Sun', 'opposition', '1947-04-08', 9, '2026-09-19'],
  [733, 'p211', 'Uranus', 'sesquiquadrate', '1979-01-19', 4, '2026-04-07'],
  [734, 'p212', 'Uranus', 'quincunx', '1973-12-06', 8, '2026-08-13'],
  [736, 'p214', 'Uranus', 'parallel', '1969-04-26', 12, '2026-12-20'],
  [737, 'p215', 'Venus', 'conjunction', '1986-06-27', 2, '2026-02-13'],
  [738, 'p216', 'Venus', 'semisextile', '1963-12-07', 4, '2026-04-16'],
  [739, 'p217', 'Venus', 'semisquare', '1963-12-13', 12, '2026-12-04'],
  [740, 'p218', 'Venus', 'sextile', '1963-02-05', 11, '2026-11-15'],
  [741, 'p219', 'Venus', 'square', '1960-06-03', 11, '2026-11-28'],
  [742, 'p220', 'Venus', 'trine', '1958-03-12', 9, '2026-09-28'],
  [743, 'p221', 'Venus', 'sesquiquadrate', '1957-10-23', 9, '2026-09-27'],
  [744, 'p222', 'Venus', 'quincunx', '1960-06-24', 11, '2026-11-17'],
  [745, 'p223', 'Venus', 'opposition', '1958-11-12', 7, '2026-07-27'],
];

test('all 16 monthly relationship rules distinguish an exact point, absent proof, and a disproved condition', () => {
  for (const [id, passage, target, aspect, birth, month, exactDate] of romanceExactEvidence) {
    const run = submit(birth, month);
    const result = match(run, passage);
    const { knowledgeId } = result;
    const fact = baseFacts(run, target, aspect).find(({ normalizedPayload: value }) =>
      value.targetKind === 'natal' && value.monthlyThemeEvidence?.exactFrames?.some(frame => frame.exactAt.startsWith(exactDate)));
    assert.ok(fact, String(id));
    const payload = fact.normalizedPayload;
    const { exactAt } = payload.monthlyThemeEvidence.exactFrames.find(frame => frame.exactAt.startsWith(exactDate));
    assert.ok(fact.activeFrom <= exactAt && exactAt < fact.activeTo, String(id));
    const point = baseFacts(run, target, aspect, 'leo_progressed_aspect_exact').find(item =>
      item.normalizedPayload.targetKind === payload.targetKind && item.exactInstant === exactAt);
    assert.ok(point, String(id));
    const coordinate = aspect === 'parallel' ? 'equatorial_declination_of_date' : 'ecliptic_longitude';
    assert.equal(point.normalizedPayload.coordinate, coordinate, String(id));
    assert.ok(point.normalizedPayload.separation < 0.0001, String(id));

    const observation = baseFacts(run, target, aspect, 'leo_lunar_exact_observation').find(item =>
      item.normalizedPayload.targetKind === payload.targetKind && item.exactInstant === exactAt);
    const exactObservation = [679, 693, 733, 737, 738, 739, 740, 741, 744].includes(id);
    const qualifiedContext = [683, 725, 736, 742, 743, 745].includes(id);
    const witness = exactObservation ? observation : fact;
    assert.ok(witness, String(id));
    assert.equal(result.status, 'matched', String(id));
    const onExactBasis = witness.normalizedPayload;
    const evaluate = normalizedPayload => evaluateFortuneRules('western', 'month', [{ ...witness, normalizedPayload }])
      .find(rule => rule.knowledgeId === knowledgeId).required[0];
    const requiredField = qualifiedContext ? 'monthlyLunarQualification' : 'monthlyLunarHasExact';
    assert.equal(evaluate(onExactBasis).hits.length, 1, String(id));
    const unknown = evaluate(exactObservation ? { ...onExactBasis, targetKind: undefined }
      : { ...onExactBasis, monthlyLunarFrameProfile: undefined, [requiredField]: undefined });
    assert.equal(unknown.hits.length, 0, String(id));
    assert.equal(unknown.unknown, true, String(id));
    const rejected = evaluate(exactObservation ? { ...onExactBasis, targetKind: 'unrelated' }
      : { ...onExactBasis, [requiredField]: qualifiedContext ? 'unrelated' : false });
    assert.equal(rejected.hits.length, 0, String(id));
    assert.equal(rejected.unknown, false, String(id));
    assert.equal(evaluate({ ...onExactBasis, aspectType: 'unrelated' }).hits.length, 0, String(id));

    const at = Date.parse(exactAt);
    const band = { ...payload, start: at - 60_000, end: at, exactTimes: [at] };
    const later = { ...band, start: at, end: at + 60_000 };
    const split = buildLeoLunarConditions([band, later]);
    assert.deepEqual(split.map(row => row.monthlyThemeEvidence.lunarExactTimes), id === 734 ? [[], [at], []] : [[], [at]], String(id));
  }
});

test('an exact Venus sextile is observed even when house cusps are unavailable', () => {
  const run = submit('1963-02-05', 11, false);
  const facts = baseFacts(run, 'Venus', 'sextile');
  assert.ok(facts.some(({ normalizedPayload: fact }) => fact.monthlyLunarHasExact === true
    && fact.monthlyLunarHasExactInOwnFrame === undefined));
  const result = match(run, 'p218');
  assert.equal(result.status, 'matched');
  assert.ok(baseFacts(run, 'Venus', 'sextile', 'leo_lunar_exact_observation')
    .some(fact => result.sourceFactIds.includes(fact.factId)));
});
