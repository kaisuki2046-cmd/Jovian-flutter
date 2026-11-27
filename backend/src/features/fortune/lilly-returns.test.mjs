import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, EclipticGeoMoon, e_tilt, GeoVector, MakeTime, NextMoonNode, NodeEventKind, RotateVector, Rotation_EQD_ECT, Rotation_EQJ_EQD,
  SearchMoonNode, SiderealTime, SunPosition, Vector } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { lillyEssentialDignities, lillyEssentialPolicy } = await import('./control/lilly-essential.ts');
const { lillyAspectOrbs, lillyFixedStarPositions, lillyLunarNodes, lillyP115Points, lillyP745NatalMoonBalance, lillyPlanetConditions, lillyVenusFortitudeAtReturn } =
  await import('./control/lilly-accidental.ts');
const { lillyApplicationSequence, lillyTranslationWitnesses } = await import('./control/lilly-application.ts');
const { buildLillyLocatedReturn, buildLillyReturnContext, buildLillySeventhReturn, buildLillySolarReturnPositions,
  lillyRadicalPlaceContact, lillyRadicalPlaceMinute, lillyReturnLocationTarget, lillyRevolutionFortune,
  readFortuneReturnLocation } = await import('./control/lilly-returns.ts');
const { buildSolarReturnPositions, readTransitLongitude, westernSearchPolicy } = await import('./control/solar-transits.ts');
const { calculateHouseCusps, zodiacalHouse } = await import('./control/western-houses.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/lilly-essential-reference.json', import.meta.url)));
const day = 86_400_000, rad = Math.PI / 180;
const normalize = n => (n % 360 + 360) % 360;
const arc = n => normalize(n + 180) - 180;
const birthAt = Date.parse(ref.realChart.birthAt), window = { start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z') };
function cartesianAngles(at, armc, latitude) {
  // Independent Cartesian intersection construction, distinct from the
  // production inversion and spherical house solver.
  const time = MakeTime(new Date(at)), rotate = Rotation_EQD_ECT(time), theta = armc * rad, phi = latitude * rad;
  const east = RotateVector(rotate, new Vector(-Math.sin(theta), Math.cos(theta), 0, time));
  const zenith = RotateVector(rotate, new Vector(Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi), time));
  const meridian = RotateVector(rotate, new Vector(Math.cos(theta), Math.sin(theta), 0, time));
  const intersection = (normal, toward) => { let x = normal.y, y = -normal.x; if (x * toward.x + y * toward.y < 0) { x = -x; y = -y; } return normalize(Math.atan2(y, x) / rad); };
  return { ascendant: intersection(zenith, east), midheaven: intersection(east, meridian) };
}

function chart(birthAt = Date.parse(ref.realChart.birthAt), armc = ref.realChart.armc, latitude = ref.realChart.latitude) {
  const { ascendant, midheaven } = cartesianAngles(birthAt, armc, latitude);
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birthAt / day + 2440587.5, ascendant, midheaven,
      positions: [...lillyEssentialPolicy.planets, 'Uranus', 'Neptune', 'Pluto'].map(planet => ({ planet,
        longitude: planet === 'Sun' ? SunPosition(new Date(birthAt)).elon : Ecliptic(GeoVector(Body[planet], new Date(birthAt), true)).elon })),
    }] } };
}
const baseChart = chart(), returns = buildSolarReturnPositions(window, baseChart.western);
const contexts = () => buildLillyReturnContext(window, baseChart, returns);
const cached = new Map();
function run(year = 2026) {
  if (!cached.has(year)) {
    const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    cached.set(year, calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse(`${year}-11-19T03:00:00Z`), 'server'),
      'lilly-return-run-' + year, { snapshotId: 'lilly-return-snapshot', chart: baseChart }));
  }
  return cached.get(year);
}
const indices = [0, 40, 41, 42];
const specific = value => value.facts.filter(f => f.factType === 'lilly_return_context');
const seventhId = 'western-fortune-v1-year-love-lilly-v3-revolution-p003-001';
const seventhType = 'lilly_return_seventh_context';
const seventhMatch = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === seventhId);

test('all twelve source sign rulers, whole-sign exaltations, detriments and falls remain classical rather than using modern outer-planet rulers', () => {
  assert.equal(ref.profile, lillyEssentialPolicy.profile);
  for (const row of ref.rows) for (const body of lillyEssentialPolicy.planets) {
    const actual = lillyEssentialDignities(body, row.sign * 30 + 1, 'day'), opposite = ref.rows[(row.sign + 6) % 12];
    assert.equal(actual.signLord, row.house); assert.equal(actual.domicile, body === row.house);
    assert.equal(actual.exalted, body === row.exaltation); assert.equal(actual.detriment, body === opposite.house);
    assert.equal(actual.fall, body === opposite.exaltation);
  }
  assert.equal(lillyEssentialDignities('Venus', 330).exalted, true); // Not only degree 27.
  assert.equal(lillyEssentialDignities('Venus', 359.999999).exalted, true);
  assert.equal(lillyEssentialDignities('Saturn', 301).domicile, true);
  for (const [body, longitude] of [['Uranus', 301], ['NorthNode', 61], ['Venus', -1], ['Venus', 360], ['Venus', NaN]]) assert.throws(() => lillyEssentialDignities(body, longitude));
});

test('sixty source terms and thirty-six faces use exact half-open bounds, without degree rounding or moving a border back to the prior lord', () => {
  for (const row of ref.rows) {
    let start = 0;
    for (const [lord, end] of row.resolvedTerms ?? row.terms) {
      for (const degree of [start, end - 1e-7]) {
        const actual = lillyEssentialDignities('Mercury', row.sign * 30 + degree);
        assert.equal(actual.termLord, lord); assert.equal(actual.termStart, start); assert.equal(actual.termEnd, end);
      }
      start = end;
    }
    row.faces.forEach((lord, i) => {
      const value = lillyEssentialDignities('Moon', row.sign * 30 + i * 10);
      assert.equal(value.faceLord, lord); assert.equal(value.faceStart, i * 10); assert.equal(value.faceEnd, (i + 1) * 10);
    });
  }
  assert.equal(lillyEssentialDignities('Jupiter', 5.999999).inOwnTerm, true);
  assert.equal(lillyEssentialDignities('Jupiter', 6).inOwnTerm, false);
});

test('Lilly water triplicity is Mars both day and night; unknown sect stays unknown only where it affects the result', () => {
  for (const sign of [3, 7, 11]) for (const sect of ['day', 'night', undefined]) {
    assert.equal(lillyEssentialDignities('Mars', sign * 30 + 1, sect).inTriplicity, true);
    assert.equal(lillyEssentialDignities('Venus', sign * 30 + 1, sect).inTriplicity, false);
  }
  assert.equal(lillyEssentialDignities('Sun', 1, 'day').inTriplicity, true);
  assert.equal(lillyEssentialDignities('Sun', 1, 'night').inTriplicity, false);
  assert.equal(lillyEssentialDignities('Sun', 1).inTriplicity, undefined);
  assert.equal(lillyEssentialDignities('Mercury', 1).inTriplicity, false);
  assert.throws(() => lillyEssentialDignities('Venus', 1, 'unknown'));
});

test('same-book prose resolves named table conflicts explicitly without hiding original readings or generating a favourable-condition score', () => {
  const taurus = lillyEssentialDignities('Saturn', 53, 'night');
  assert.equal(taurus.termLord, 'Saturn'); assert.equal(taurus.termEnd, 26); assert.equal(taurus.inOwnTerm, true);
  assert.equal(taurus.termStatus, 'prose_resolved'); assert.ok(taurus.sourceDifferences.includes('taurus-endpoint-20-vs-26'));
  const libra = lillyEssentialDignities('Venus', 200, 'day');
  assert.equal(libra.tableTermLord, 'Venus'); assert.equal(libra.termLord, 'Mercury'); assert.equal(libra.inOwnTerm, false); assert.equal(libra.domicile, true);
  assert.equal(libra.hasEssentialDignity, true); assert.ok(!('score' in libra)); assert.ok(!('wellAffected' in libra));
  assert.equal(lillyEssentialDignities('Venus', 204).termStatus, 'ready');
  assert.equal(lillyEssentialDignities('Sun', 53).inOwnTerm, false); // The disputed term cannot belong to the Sun in either reading.
  assert.equal(lillyEssentialDignities('Mars', 53).hasEssentialDignity, false);
});

test('real ephemeris returns produce four distinct source pairs in each actual year interval, with unknown return location and sect left unfilled', () => {
  const result = contexts(); assert.equal(result.status, 'ready'); assert.equal(result.contexts.length, returns.length * 4); assert.equal(returns.length, 2);
  for (const item of result.contexts) {
    const record = returns.find(r => r.returnAt === item.returnAt), natal = baseChart.western.rawResult[0].positions.find(p => p.planet === item.natalTargetId);
    assert.equal(item.returningLongitude, record.bodies.find(p => p.planet === item.returnBody).longitude);
    assert.equal(item.natalLongitude, natal.longitude); assert.ok(Math.abs(item.longitudeSeparation - Math.abs(arc(item.returningLongitude - natal.longitude))) < 1e-10);
    assert.equal(item.returningEssential.body, item.returnBody); assert.equal(item.natalTargetEssential.body, item.natalTargetId);
    assert.equal(item.returningEssential.sect, undefined); assert.equal(item.returnSect, 'unavailable'); assert.equal(item.returnLocation, 'unprovided');
    assert.equal(item.natalHouseSystem, 'regiomontanus'); assert.ok(item.natalTargetHouse >= 1 && item.natalTargetHouse <= 12);
    assert.equal(item.sourceOrbStatus, 'unresolved'); assert.ok(!('allowedOrb' in item));
    assert.ok(item.start >= item.returnAt && item.end <= item.returnEnd);
  }
});

test('missing or inconsistent natal precision, duplicate classical bodies and unknown clocks cannot fabricate source contexts or return houses', () => {
  for (const change of [c => { c.timeKnown = false; }, c => { c.western.engineVersion = 'other'; },
    c => { c.western.rawResult.push(structuredClone(c.western.rawResult[0])); },
    c => { c.western.rawResult[0].positions.pop(); c.western.rawResult[0].positions.shift(); },
    c => { c.western.rawResult[0].positions.push(structuredClone(c.western.rawResult[0].positions[0])); },
    c => { c.western.rawResult[0].positions[0].longitude += 1; }]) {
    const value = chart(); change(value); assert.equal(buildLillyReturnContext(window, value, returns).contexts.length, 0);
  }
  const missingFrame = chart(); missingFrame.western.rawResult[0].ascendant = NaN;
  const value = buildLillyReturnContext(window, missingFrame, returns);
  assert.equal(value.contexts.length, 8); assert.ok(value.contexts.every(c => c.natalSect === undefined && c.natalTargetHouse === undefined));
});

test('invalid return intervals, positions, epoch and direction are rejected instead of borrowing another return or a different ephemeris moment', () => {
  for (const change of [r => { r.start--; }, r => { r.returnEnd = r.returnAt; }, r => { r.returnAt += day; },
    r => { r.bodies.find(b => b.planet === 'Venus').longitude += 1; }, r => { r.bodies.find(b => b.planet === 'Venus').direction = 'retrograde' === r.bodies.find(b => b.planet === 'Venus').direction ? 'direct' : 'retrograde'; },
    r => { r.bodies.push(structuredClone(r.bodies[0])); }]) {
    const record = structuredClone(returns[0]); change(record);
    assert.equal(buildLillyReturnContext(window, baseChart, [record]).contexts.length, 0);
  }
  assert.equal(buildLillyReturnContext({ start: birthAt, end: window.end }, baseChart, returns).contexts.length, 0);
});

test('radical-place geometry retains both printed columns, sign continuity and wrap-around as separate facts', () => {
  const check = (longitude, natal = 0) => lillyRadicalPlaceContact('Jupiter', longitude, 'Mercury', natal);
  assert.equal(check(359.5).longitudeSeparation, 0.5);
  assert.equal(check(359.5).sameSign, false);
  assert.equal(check(359.5).placeComparison, 'both_columns');
  assert.equal(check(8).placeComparison, 'both_columns');
  assert.equal(check(9.5).placeComparison, 'one_column');
  assert.equal(check(9.500001).placeComparison, 'same_sign_only');
  const far = check(127);
  assert.equal(far.placeComparison, 'outside_sign_and_columns');
  assert.equal(far.radicalPlaceCandidate, false);
});

test('Lilly’s annual pair uses two actual solar roots even without a specified return location', () => {
  const real = returns.find(row => row.start === row.returnAt);
  assert.ok(real);
  assert.equal(buildLillyReturnContext(window, baseChart, [real]).contexts.length, 4);
  const shifted = chart();
  shifted.western.rawResult[0].positions.find(p => p.planet === 'Sun').longitude = readTransitLongitude('Sun', real.returnAt + 6);
  const near = buildSolarReturnPositions(window, shifted.western).find(row => row.start === row.returnAt);
  assert.ok(near.returnAt - real.returnAt > westernSearchPolicy.aspectToleranceMs);
  assert.ok(Math.abs(near.natalSunLongitude - real.natalSunLongitude) < 1e-7);
  assert.equal(buildLillyReturnContext(window, baseChart, [{ ...near, natalSunLongitude: real.natalSunLongitude,
    returnEnd: real.returnEnd }]).contexts.length, 0);
  assert.equal(buildLillyReturnContext(window, baseChart, [{ ...real, returnEnd: real.returnEnd + 6 }]).contexts.length, 0);
});

test('printed-minute ties use the verified return and do not confuse a sign boundary or a broad conjunction with an exact place', () => {
  const boundary = 29 + 59.5 / 60;
  assert.equal(lillyRadicalPlaceMinute(boundary, [boundary - 1e-7, boundary + 1e-7]), 'minute_boundary');
  assert.equal(lillyRadicalPlaceMinute(359.99999, [0.00001]), 'different_printed_minutes');
  assert.equal(lillyRadicalPlaceMinute(359.99999, [359.99999, 0.00001]), 'minute_boundary');
  for (const [birth, pair] of [
    ['1960-02-04T20:03:26.846Z', 'venus-mercury'],
    ['1960-08-17T03:51:51.990Z', 'jupiter-mercury'],
    ['1969-01-15T04:32:32.054Z', 'moon-self'],
  ]) {
    const snapshot = chart(Date.parse(birth));
    const candidate = buildLillyReturnContext(window, snapshot, buildSolarReturnPositions(window, snapshot.western)).contexts
      .find(row => row.pair === pair && window.start <= row.returnAt && row.returnAt < window.end);
    assert.equal(candidate.radicalPlaceMinuteState, 'same_printed_minute', pair);
    assert.ok(candidate.longitudeSeparation < 0.00001, pair);
  }
  const birth = Date.parse('1960-08-17T15:51:51.990Z');
  const later = chart(birth);
  const broad = buildLillyReturnContext(window, later, buildSolarReturnPositions(window, later.western)).contexts
    .find(row => row.pair === 'jupiter-mercury' && window.start <= row.returnAt && row.returnAt < window.end);
  assert.equal(broad.radicalPlaceMinuteState, 'different_printed_minutes');
  assert.equal(broad.radicalPlaceCandidate, true);

  const rounded = chart(Date.parse('1960-08-17T03:51:51.990Z'));
  rounded.western.rawResult[0].positions.find(p => p.planet === 'Mercury').longitude += 0.01;
  const consistent = buildLillyReturnContext(window, rounded, buildSolarReturnPositions(window, rounded.western)).contexts
    .find(row => row.pair === 'jupiter-mercury' && window.start <= row.returnAt && row.returnAt < window.end);
  assert.equal(consistent.radicalPlaceMinuteState, 'same_printed_minute');
  assert.ok(consistent.longitudeSeparation < 0.00001);
});

test('Lilly keeps the natal rulership of three returning bodies separate from their verified revolution houses', () => {
  for (const sample of [
    { pair: 'saturn-self', passage: 'p001', body: 'Saturn', birth: '1921-11-04T09:37:05.134Z', natalArmc: 300,
      year: 1980, natalRuledHouses: [9, 10, 11], house: 10 },
    { pair: 'venus-mercury', passage: 'p003', body: 'Venus', birth: '1956-09-07T17:49:49.190Z', natalArmc: 300,
      year: 2024, returnArmc: 182, natalRuledHouses: [1, 6], house: 10 },
    { pair: 'moon-self', passage: 'p004', body: 'Moon', birth: '1988-05-20T17:57:48.370Z', natalArmc: 210,
      year: 2026, returnArmc: 210, natalRuledHouses: [7], house: 7 },
  ]) {
    const { pair, passage, body, year, natalArmc, natalRuledHouses, house } = sample;
    const birth = Date.parse(sample.birth), latitude = 35;
    const reference = { snapshotId: `lilly-radix-roles-${body}`, chart: chart(birth, natalArmc, latitude) };
    const range = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
    const epochs = buildLillySolarReturnPositions(range, reference.chart);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const time = MakeTime(new Date(returnAt));
    const midheaven = (readTransitLongitude(body, returnAt) - 8) * rad;
    const armc = sample.returnArmc ?? Math.atan2(Math.sin(midheaven) * Math.cos(e_tilt(time).tobl * rad), Math.cos(midheaven)) / rad;
    const longitude = arc(armc - SiderealTime(time) * 15);
    const location = { returnAt, latitude, longitude };
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const asOf = Date.UTC(year, 11, 1);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);

    const facts = specific(run).filter(row => row.normalizedPayload.pair === pair);
    const current = facts.find(row => Date.parse(row.normalizedPayload.returnAt) === returnAt);
    assert.ok(current, body);
    const payload = current.normalizedPayload;
    assert.deepEqual(payload.returnSignification, { profile: 'lilly-book-three-p737-radical-lord-return-house-v1', body,
      returnHouse: house, natalRuledHouses }, body);
    assert.equal(payload.returnHouse, house, body);
    assert.ok(facts.some(row => Date.parse(row.normalizedPayload.returnAt) < returnAt), body);
    assert.ok(facts.every(row => row === current || row.normalizedPayload.returnSignification === undefined), body);
    const bodyInReturn = zodiacalHouse(readTransitLongitude(body, returnAt),
      calculateHouseCusps(normalize(armc), latitude, e_tilt(time).tobl, 'regiomontanus').cusps);
    assert.equal(bodyInReturn, house, body);

    const match = fact => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western.find(row =>
      row.knowledgeId.includes(`-lilly-v3-return-${passage}-`));
    assert.equal(match(current).status, 'matched', body);
    const { returnSignification: _evidence, ...withoutEvidence } = payload;
    assert.equal(match({ ...current, normalizedPayload: withoutEvidence }).status, 'matched', body);
    const noLocation = buildLillyReturnContext(range, reference.chart, epochs).contexts
      .find(row => row.pair === pair && row.returnAt === returnAt);
    assert.equal(noLocation.returnSignification, undefined, body);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const name = { Saturn: '土星', Venus: '金星', Moon: '月亮' }[body];
    const local = `本命${name}守护第${natalRuledHouses.join('、')}宫，同次实际回归${name}实居第${house}宫`;
    assert.ok(formatFortuneFactAudit(input).includes(local), body);
    const provider = formatFortunePrompt(input);
    assert.ok(!provider.includes(local), body);
    assert.doesNotMatch(provider, /returnSignification|natalRuledHouses/u, body);
    if (body === 'Moon') {
      const invalid = structuredClone(batch);
      const submitted = invalid.facts.find(row => row.factType === 'lilly_return_context'
        && row.normalizedPayload.pair === pair && row.normalizedPayload.returnSignification);
      submitted.normalizedPayload.returnSignification.returnHouse = 8;
      const time = readClientFactTime(params, invalid, asOf);
      assert.throws(() => bindClientFortuneRun(params, invalid, time, reference.snapshotId, reference), { status: 400 });
    }
  }
});

test('a Jupiter return at the natal Mercury minute confirms that return year through SQLite', () => {
  const parameters = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const asOf = Date.UTC(2026, 10, 19);
  const birth = Date.parse('1960-08-17T03:51:51.990Z');
  const original = chart(birth);
  const rounded = structuredClone(original);
  const displaySun = rounded.western.rawResult[0].positions.find(row => row.planet === 'Sun');
  displaySun.longitude += 0.01;
  const displayRoots = buildSolarReturnPositions(window, rounded.western);
  const displayEpoch = displayRoots.find(row => window.start <= row.returnAt && row.returnAt < window.end);
  const actualEpoch = buildLillySolarReturnPositions(window, original).find(row => window.start <= row.returnAt && row.returnAt < window.end);
  assert.equal(new Date(displayEpoch.returnAt).toISOString(), '2026-08-17T02:46:05.459Z');
  assert.equal(new Date(actualEpoch.returnAt).toISOString(), '2026-08-17T02:31:06.960Z');
  assert.ok(Math.abs(arc(readTransitLongitude('Sun', actualEpoch.returnAt) - readTransitLongitude('Sun', birth))) < 1e-7);
  assert.equal(buildLillyReturnContext(window, rounded, displayRoots).contexts.length, 0);
  assert.deepEqual(buildLillySolarReturnPositions(window, { ...rounded, timeKnown: false }), displayRoots);
  assert.equal(lillyReturnLocationTarget(window, rounded), actualEpoch.returnAt);
  assert.equal(buildLillyLocatedReturn(window, rounded, displayRoots,
    { returnAt: displayEpoch.returnAt, latitude: 31.23, longitude: 121.47 }), undefined);
  const reference = { snapshotId: 'lilly-minute-real', chart: rounded };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const bound = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'lilly-minute-real', reference);
  const solar = bound.facts.find(({ factType, normalizedPayload: p }) =>
    factType === 'solar_return' && p.returnAt === new Date(actualEpoch.returnAt).toISOString());
  assert.ok(solar);
  assert.ok(!bound.facts.some(({ factType, normalizedPayload: p }) => factType === 'solar_return'
    && p.returnAt === new Date(displayEpoch.returnAt).toISOString()));
  const rule = fortuneKnowledge.western.rules[indices[1]];
  const result = matchFortuneKnowledge(bound).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(result.status, 'matched');
  const matched = specific(bound).find(row => result.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.radicalPlaceMinuteState === 'same_printed_minute');
  assert.ok(matched);
  assert.equal(matched.normalizedPayload.radicalPlaceMinuteMatch, true);
  assert.equal(matched.normalizedPayload.returnEpochBasis, 'natal-sun-ephemeris');
  assert.equal(matched.normalizedPayload.returnAt, solar.normalizedPayload.returnAt);
  assert.equal(matched.normalizedPayload.returnEnd, solar.normalizedPayload.returnEnd);
  assert.deepEqual(result.windows, [{ start: matched.activeFrom, endExclusive: matched.activeTo }]);
  const fallback = { ...matched, normalizedPayload: { ...matched.normalizedPayload, returnEpochBasis: undefined } };
  const candidate = evaluateFortuneRules('western', 'year', [fallback]).find(row => row.knowledgeId === rule.knowledgeId).required[0];
  assert.deepEqual([candidate.hits.length, candidate.unknown], [0, true]);
  const report = interpretFortune(bound, requestForFortuneRun(bound), 'lilly-minute-report');
  const { input } = buildFortuneModelContext(bound, report);
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /处在同一星座和同一最近角分/u);
  assert.match(audit, /按已核出生时刻的实算太阳黄经确定该次回归/u);
  const prompt = formatFortunePrompt(input);
  assert.doesNotMatch(prompt, /按已核出生时刻的实算太阳黄经确定该次回归|returnEpochBasis|radicalPlaceMinuteState/u);
  assert.match(prompt, /该例把回归年的木星到水星位置联系到学习与交流兴趣/u);
  const finding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === rule.knowledgeId);
  assert.ok(finding);
  const entry = fortuneKnowledge.western.entries.find(item => item.id === rule.knowledgeId);
  assert.deepEqual(finding.conditions, entry.conditions.normalized);
  assert.deepEqual(finding.windows, result.windows);
  const nearMinute = { ...matched, normalizedPayload: { ...matched.normalizedPayload, sameDegreeCell: true,
    radicalPlaceMinuteState: 'different_printed_minutes', radicalPlaceMinuteMatch: false } };
  const boundary = { ...matched, normalizedPayload: { ...matched.normalizedPayload,
    radicalPlaceMinuteState: 'minute_boundary', radicalPlaceMinuteMatch: undefined } };
  const isolate = fact => matchFortuneKnowledge({ ...bound, facts: [fact] }).byMethod.western
    .find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(isolate(nearMinute).status, 'not_matched');
  assert.equal(isolate(boundary).status, 'unknown');
});

test('Lilly verifies coincident ascendants and a domicile ruler for Venus and Moon returns', () => {
  const examples = [
    { birth: '1956-09-07T17:49:49.190Z', year: 2024, pair: 'venus-mercury', body: 'Venus', sign: 6, natalArmc: 91,
      returnArmc: 90.99998145923018, sourceRule: indices[2], priorProof: 'returnVenusAtLeastWorkedFortitude' },
    { birth: '1988-05-20T17:57:48.370Z', year: 2026, pair: 'moon-self', body: 'Moon', sign: 3, natalArmc: 0,
      returnArmc: 0.003599517047405243, sourceRule: indices[3], priorProof: 'natalMoonAtLeastWorkedFortitude' },
  ];
  const profile = 'lilly-book-three-p736-same-rising-minute-domicile-v1';
  for (const example of examples) {
    const { body, pair, year, natalArmc, returnArmc, sign, priorProof, sourceRule } = example;
    const birth = Date.parse(example.birth), latitude = 35, snapshot = chart(birth, natalArmc, latitude);
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const now = Date.UTC(year, 10, 19), reference = { snapshotId: 'lilly-rising-ascendant-ruler-' + body, chart: snapshot };
    const range = buildFactTimeContext(params, now, 'client').window;
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const time = MakeTime(new Date(returnAt)), sidereal = SiderealTime(time) * 15;
    const locationAt = armc => ({ returnAt, latitude, longitude: arc(armc - sidereal) });
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, locationAt(returnArmc))));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const witness = specific(run).find(({ normalizedPayload: p }) => p.pair === pair && Date.parse(p.returnAt) === returnAt);
    assert.ok(witness);
    const p = witness.normalizedPayload;
    assert.deepEqual([p[priorProof], p.returnAscendantDomicileProfile, p.returningEssential.domicile, p.returnHouse], [true, profile, true, 1]);
    assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(p.returningConditions.solar.condition, 'free_of_beams');
    const natalAscendant = cartesianAngles(birth, natalArmc, latitude).ascendant;
    const returnedAscendant = cartesianAngles(returnAt, returnArmc, latitude).ascendant;
    assert.deepEqual([Math.floor(natalAscendant / 30), Math.floor(returnedAscendant / 30)], [sign, sign]);
    assert.ok(Math.abs(arc(natalAscendant - returnedAscendant)) < 1e-6);
    assert.equal(lillyEssentialDignities(body, natalAscendant).signLord, body);

    const shiftedArmc = returnArmc + 0.1;
    const shiftedAscendant = cartesianAngles(returnAt, shiftedArmc, latitude).ascendant;
    assert.equal(Math.floor(shiftedAscendant / 30), sign);
    assert.ok(Math.abs(arc(natalAscendant - shiftedAscendant)) > 1 / 60);
    const sourceContext = location => buildLillyReturnContext(range, snapshot, epochs,
      buildLillyLocatedReturn(range, snapshot, epochs, location)).contexts.find(row => row.pair === pair && row.returnAt === returnAt);
    const shifted = sourceContext(locationAt(shiftedArmc));
    assert.deepEqual([shifted[priorProof], shifted.returningEssential.domicile, shifted.returnAscendantDomicileProfile], [true, true, undefined]);
    assert.equal(sourceContext(undefined).returnAscendantDomicileProfile, undefined);

    const rule = fortuneKnowledge.western.rules[sourceRule];
    const changed = changes => ({ ...witness, normalizedPayload: { ...p, ...changes } });
    const facts = [witness, changed({ returnAscendantDomicileProfile: shifted.returnAscendantDomicileProfile }), changed({ [priorProof]: false })];
    const branch = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId).confirmations
      .find(row => JSON.parse(row.condition).where.returnAscendantDomicileProfile === profile);
    assert.deepEqual(branch.hits, [witness]);
    const scoped = { ...run, facts: [witness] };
    const result = matchFortuneKnowledge(scoped).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
    const prompt = formatFortunePrompt(input);
    assert.ok(branch.sourceConditions.every(condition => prompt.includes(condition)));
    assert.doesNotMatch(prompt, /returnAscendantDomicileProfile|same-rising-minute-domicile|latitude|longitude/u);
  }
});

test('Lilly keeps the return ascendant square and natal house separate from Saturn, Venus and Moon conditions', () => {
  const examples = [
    { birth: '1942-02-20T13:51:47.321Z', year: 1971, pair: 'saturn-self', natalArmc: 298.4415738776861,
      returnArmc: 32, sourceRule: indices[0], priorProof: 'saturnSupportedReturn', nominalCusps: [[6, 56, 5], [12, 252, 11]] },
    { birth: '1956-09-07T17:49:49.190Z', year: 2024, pair: 'venus-mercury', natalArmc: 73.40662262777823,
      returnArmc: 182, sourceRule: indices[2], priorProof: 'returnVenusAtLeastWorkedFortitude', nominalCusps: [[6, 18, 5, 258], [12, 18, 11]] },
    { birth: '1936-11-13T16:10:49.878Z', year: 1993, pair: 'moon-self', natalArmc: 321,
      returnArmc: 64.7779691946971, sourceRule: indices[3], priorProof: 'natalMoonWeakInBothTables', nominalCusps: [[6, 128, 6], [12, 290, 12]] },
  ];
  for (const example of examples) {
    const { pair, year, natalArmc, returnArmc, priorProof, sourceRule } = example;
    const birth = Date.parse(example.birth), latitude = 35, snapshot = chart(birth, natalArmc, latitude);
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const now = Date.UTC(year, 11, 1), reference = { snapshotId: 'lilly-return-rising-square-' + pair, chart: snapshot };
    const range = buildFactTimeContext(params, now, 'client').window;
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const time = MakeTime(new Date(returnAt)), sidereal = SiderealTime(time) * 15;
    const locationAt = armc => ({ returnAt, latitude, longitude: arc(armc - sidereal) });
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, locationAt(returnArmc))));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const witness = specific(run).find(({ normalizedPayload: p }) => p.pair === pair && Date.parse(p.returnAt) === returnAt);
    assert.ok(witness);
    const p = witness.normalizedPayload;
    assert.deepEqual([p[priorProof], p.returnAscendantHardAspect, p.returnAscendantNatalHouse], [true, 'square', 4]);
    const natalRising = cartesianAngles(birth, natalArmc, latitude).ascendant;
    const returnRising = cartesianAngles(returnAt, returnArmc, latitude).ascendant;
    assert.ok(Math.abs(arc(returnRising - natalRising) - 90) < 1e-6);
    const natalHouses = calculateHouseCusps(natalArmc, latitude, e_tilt(MakeTime(new Date(birth))).tobl, 'regiomontanus');
    assert.equal(zodiacalHouse(returnRising, natalHouses.cusps), 4);

    const sourceContext = (location, sourceChart = snapshot) => buildLillyReturnContext(range, sourceChart, epochs,
      buildLillyLocatedReturn(range, sourceChart, epochs, location)).contexts.find(row => row.pair === pair && row.returnAt === returnAt);
    const shifted = sourceContext(locationAt(returnArmc + 0.12));
    assert.deepEqual([shifted[priorProof], shifted.returnAscendantHardAspect, shifted.returnAscendantNatalHouse], [true, undefined, undefined]);
    assert.equal(sourceContext(undefined).returnAscendantHardAspect, undefined);
    if (pair === 'moon-self') {
      const opposition = 173.52703419695536;
      assert.ok(Math.abs(Math.abs(arc(cartesianAngles(returnAt, opposition, latitude).ascendant - natalRising)) - 180) < 1e-6);
      for (const [offset, house] of [[-0.004, 6], [0, undefined], [0.002, 7]]) {
        const contact = sourceContext(locationAt(opposition + offset));
        assert.deepEqual([contact.returnAscendantHardAspect, contact.returnAscendantNatalHouse], ['opposition', house]);
      }
      const reverse = sourceContext(locationAt(256.3679981744908));
      assert.deepEqual([reverse.returnAscendantHardAspect, reverse.returnAscendantNatalHouse], ['square', 10]);
    }

    const rule = fortuneKnowledge.western.rules[sourceRule];
    const changed = changes => ({ ...witness, normalizedPayload: { ...p, ...changes } });
    const moved = changed({ returnAscendantHardAspect: shifted.returnAscendantHardAspect, returnAscendantNatalHouse: shifted.returnAscendantNatalHouse });
    const facts = [witness, moved, changed({ [priorProof]: false })];
    const branch = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId).confirmations
      .find(row => JSON.parse(row.condition).where.returnAscendantNatalHouse === 4);
    assert.deepEqual(branch.hits, [witness]);
    const scoped = { ...run, facts: [witness] };
    const match = rows => matchFortuneKnowledge({ ...scoped, facts: rows }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    const result = match([witness]);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    assert.equal(match([moved]).status, 'matched');
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
    const prompt = formatFortunePrompt(input);
    assert.ok(branch.sourceConditions.every(condition => prompt.includes(condition)));
    assert.doesNotMatch(prompt, /returnAscendant(HardAspect|NatalHouse)|latitude|longitude/u);

    assert.equal(p.returnRisingSignMatchesNatalCuspHouse, 'different-sign');
    assert.equal(sourceContext(undefined).returnRisingSignMatchesNatalCuspHouse, undefined);
    const priorReturn = specific(run).find(({ normalizedPayload: row }) => row.pair === pair && Date.parse(row.returnAt) < returnAt);
    assert.equal(priorReturn?.normalizedPayload.returnRisingSignMatchesNatalCuspHouse, undefined);
    for (const [cuspHouse, locatedArmc, actualNatalHouse, sourceArmc = natalArmc] of example.nominalCusps) {
      const sourceChart = sourceArmc === natalArmc ? snapshot : chart(birth, sourceArmc, latitude);
      const checked = sourceContext(locationAt(locatedArmc), sourceChart);
      assert.equal(checked[priorProof], true, pair);
      assert.equal(checked.returnRisingSignMatchesNatalCuspHouse, cuspHouse, pair);
      assert.equal(checked.returnAscendantHardAspect, undefined, pair);
      const cuspTable = calculateHouseCusps(sourceArmc, latitude, e_tilt(MakeTime(new Date(birth))).tobl, 'regiomontanus').cusps;
      const rising = cartesianAngles(returnAt, locatedArmc, latitude).ascendant;
      assert.equal(Math.floor(rising / 30), Math.floor(cuspTable[cuspHouse - 1] / 30));
      assert.equal(zodiacalHouse(rising, cuspTable), actualNatalHouse);
      const newFact = { ...witness, normalizedPayload: checked };
      const cuspBranch = evaluationFacts => evaluateFortuneRules('western', 'year', evaluationFacts)
        .find(row => row.knowledgeId === rule.knowledgeId).confirmations
        .find(row => JSON.parse(row.condition).where.returnRisingSignMatchesNatalCuspHouse === cuspHouse);
      assert.deepEqual(cuspBranch([newFact]).hits, [newFact]);
      assert.deepEqual(cuspBranch([witness]).hits, []);
      assert.deepEqual(cuspBranch([{ ...newFact, normalizedPayload: { ...checked, [priorProof]: false } }]).hits, []);
      const confirmation = match([newFact]);
      assert.equal(confirmation.status, 'matched');
      assert.deepEqual(confirmation.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
      const qualified = { ...run, facts: [newFact] };
      const qualifiedInput = buildFortuneModelContext(qualified, interpretFortune(
        qualified, requestForFortuneRun(qualified), reference.snapshotId,
      )).input;
      const qualifiedPrompt = formatFortunePrompt(qualifiedInput);
      const localWording = '回归上升与本命第' + cuspHouse + '宫宫头同座';
      assert.ok(formatFortuneFactAudit(qualifiedInput).includes(localWording));
      assert.ok(!qualifiedPrompt.includes(localWording));
      assert.ok(cuspBranch([newFact]).sourceConditions.every(condition => qualifiedPrompt.includes(condition)));
      assert.doesNotMatch(qualifiedPrompt, /returnRisingSignMatchesNatalCuspHouse|latitude|longitude/u);
    }
    if (pair === 'venus-mercury') {
      let before = 16, after = 18;
      for (let iteration = 0; iteration < 45; iteration++) {
        const armc = (before + after) / 2;
        if (cartesianAngles(returnAt, armc, latitude).ascendant < 120) before = armc;
        else after = armc;
      }
      const atBoundary = (before + after) / 2;
      const edge = sourceContext(locationAt(atBoundary));
      assert.equal(edge[priorProof], true);
      assert.equal(edge.returnRisingSignMatchesNatalCuspHouse, undefined);
      assert.equal(sourceContext(locationAt(atBoundary - 0.1)).returnRisingSignMatchesNatalCuspHouse, 'different-sign');
      assert.equal(sourceContext(locationAt(atBoundary + 0.1)).returnRisingSignMatchesNatalCuspHouse, 12);
    }
  }
});

test('Lilly applies the same printed positive house scores to return Venus in the second, third and ninth', () => {
  const birth = Date.parse('1956-09-07T17:49:49.190Z'), natal = chart(birth, 300, 35);
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2024 } };
  const now = Date.UTC(2024, 10, 19), reference = { snapshotId: 'lilly-venus-printed-house-fortitudes', chart: natal };
  const range = buildFactTimeContext(params, now, 'client').window;
  const epochs = buildLillySolarReturnPositions(range, natal);
  const { returnAt } = epochs.find(row => row.returnAt >= range.start);
  const time = MakeTime(new Date(returnAt)), latitude = 35, obliquity = e_tilt(time).tobl;
  const locationAt = armc => ({ returnAt, latitude, longitude: arc(armc - SiderealTime(time) * 15) });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, locationAt(48))));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const witness = specific(run).find(({ normalizedPayload: p }) => p.pair === 'venus-mercury' && Date.parse(p.returnAt) === returnAt);
  assert.ok(witness);
  const contextAt = armc => buildLillyReturnContext(range, natal, epochs, buildLillyLocatedReturn(range, natal, epochs, locationAt(armc)))
    .contexts.find(row => row.pair === 'venus-mercury' && row.returnAt === returnAt);
  const rule = fortuneKnowledge.western.rules[indices[2]];
  const withPayload = normalizedPayload => ({ ...run, facts: [{ ...witness, normalizedPayload }] });
  const match = payload => matchFortuneKnowledge(withPayload(payload)).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const longitude = readTransitLongitude('Venus', returnAt);
  for (const [armc, house, housePoints, lowerNet, actualHouseBeforeCusp] of [
    [48, 2, 3, 22], [16, 3, 1, 20], [196, 9, 2, 21], [74, 2, 3, 22, 1], [42, 3, 1, 20, 2], [220, 9, 2, 21, 8],
  ]) {
    const p = armc === 48 ? witness.normalizedPayload : contextAt(armc);
    assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(p.returningConditions.solar.condition, 'free_of_beams');
    const cusps = calculateHouseCusps(armc, latitude, obliquity, 'regiomontanus').cusps;
    assert.equal(zodiacalHouse(longitude, cusps), actualHouseBeforeCusp ?? house);
    if (actualHouseBeforeCusp === undefined) {
      assert.deepEqual([p.returnHouse, p.returningP115.points.house], [house, housePoints]);
      assert.deepEqual(p.returnVenusFortitude, { lowerNet, atLeastWorkedExample: true });
    } else {
      assert.deepEqual([p.returnHouse, p.returnVenusCuspHouse], [actualHouseBeforeCusp, house]);
      assert.ok(p.venusCuspVirtue.distanceRange.every(distance => distance < 5));
      assert.deepEqual(p.returnVenusCuspFortitude, { lowerNet, atLeastWorkedExample: true });
    }
    const found = match(p);
    assert.equal(found.status, 'matched', String(armc));
    assert.deepEqual(found.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  }
  const sixth = contextAt(282);
  assert.deepEqual([sixth.returnHouse, sixth.returningP115.points.house, sixth.returnVenusFortitude], [6, -2, undefined]);
  assert.equal(match(sixth).status, 'partial');
  const scoped = withPayload(witness.normalizedPayload);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /第二、第三或第九宫/u);
  assert.doesNotMatch(prompt, /returnVenusFortitude|latitude|longitude|2024-09-07T04:42/u);
});

test('Lilly confirms a fortified return Venus at the natal Mercury minute using the actual local return frame', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2024 } };
  const asOf = Date.UTC(2024, 9, 1);
  const birth = Date.parse('1956-09-07T17:49:49.190Z');
  const reference = { snapshotId: 'lilly-fortified-return-venus', chart: chart(birth, 300, 35) };
  const range = { start: Date.UTC(2024, 0, 1), end: Date.UTC(2025, 0, 1) };
  const epochs = buildLillySolarReturnPositions(range, reference.chart);
  const { returnAt } = epochs.find(row => row.returnAt >= range.start);
  const locationAtArmc = armc => ({ returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) });
  const location = locationAtArmc(182);
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  const rule = fortuneKnowledge.western.rules[indices[2]];
  const readMatch = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const matched = specific(run).find(row => row.normalizedPayload.returnVenusAtLeastWorkedFortitude);
  assert.ok(matched);
  const p = matched.normalizedPayload;
  assert.deepEqual([p.returnHouse, p.radicalPlaceMinuteState], [10, 'same_printed_minute']);
  assert.ok(p.returningConditions.receptions.some(row => row.otherBody === 'Saturn' && row.mutualExaltation));
  assert.equal(p.returningP115.points.exaltation, 4);
  assert.deepEqual(p.returnVenusFortitude, { lowerNet: 24, atLeastWorkedExample: true });
  assert.ok(Math.abs(arc(readTransitLongitude('Venus', returnAt) - readTransitLongitude('Mercury', birth))) < 0.000001);
  const result = readMatch(run);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: matched.activeFrom, endExclusive: matched.activeTo }]);
  const succedentBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, locationAtArmc(147))));
  const succedent = bindClientFortuneRun(params, succedentBatch, readClientFactTime(params, succedentBatch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(succedent);
  const eleventh = specific(succedent).find(row => row.normalizedPayload.returnVenusAtLeastWorkedFortitude);
  assert.ok(eleventh);
  const next = eleventh.normalizedPayload;
  assert.deepEqual([next.returnHouse, next.radicalPlaceMinuteState, next.returningP115.points.house], [11, 'same_printed_minute', 4]);
  assert.deepEqual(next.returnVenusFortitude, { lowerNet: 23, atLeastWorkedExample: true });
  assert.equal(next.returnAt, p.returnAt);
  const eleventhMatch = readMatch(succedent);
  assert.equal(eleventhMatch.status, 'matched');
  assert.equal(eleventhMatch.matchedSourceExcerpt, 'Learning');
  assert.deepEqual(eleventhMatch.windows, result.windows);
  const eleventhInput = buildFortuneModelContext(succedent, interpretFortune(succedent, requestForFortuneRun(succedent), reference.snapshotId)).input;
  assert.match(formatFortuneFactAudit(eleventhInput), /净值下限为23分/u);
  assert.match(formatFortunePrompt(eleventhInput), /第十一宫按 Lilly 原表计助力/u);
  assert.doesNotMatch(formatFortunePrompt(eleventhInput), /净值下限为23分|returnVenusFortitude|回归金星实居角宫/u);
  for (const [setting, expectedHouse, expectedMatch] of [[undefined, undefined, 'partial'], [locationAtArmc(120), 12, 'partial'],
    [locationAtArmc(137), 11, 'partial'], [locationAtArmc(165), 10, 'matched']]) {
    const local = buildLillyLocatedReturn(range, reference.chart, epochs, setting);
    const alternative = buildLillyReturnContext(range, reference.chart, epochs, local).contexts
      .find(row => row.pair === 'venus-mercury' && row.returnAt === returnAt);
    assert.equal(alternative.returnHouse, expectedHouse);
    assert.equal(alternative.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(alternative.returnVenusFortitude, undefined);
    assert.equal(readMatch({ ...run, facts: [{ ...matched, normalizedPayload: alternative }] }).status, expectedMatch);
  }
  const near = { ...matched, normalizedPayload: { ...p, radicalPlaceMinuteState: 'different_printed_minutes' } };
  assert.equal(readMatch({ ...run, facts: [near] }).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /净值下限为24分/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按 Lilly 的分项表保守核算仍达到原书具名命例的明显强势/u);
  assert.doesNotMatch(prompt, /净值下限为24分|returnVenusFortitude|1956-09-07/u);
});

test('Lilly confirms a Venus return strengthened by mutual domicile without changing the required score', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2028 } };
  const asOf = Date.UTC(2028, 11, 24);
  const birth = Date.parse('1978-12-23T19:47:12.397Z');
  const reference = { snapshotId: 'lilly-return-venus-mutual-domicile', chart: chart(birth, 300, 35) };
  const range = buildFactTimeContext(params, asOf, 'client').window;
  const epochs = buildLillySolarReturnPositions(range, reference.chart);
  const { returnAt } = epochs.find(row => row.returnAt >= range.start);
  assert.equal(new Date(returnAt).toISOString(), '2028-12-22T22:46:41.684Z');
  const locationAtArmc = armc => ({ returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, locationAtArmc(232))));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const rule = fortuneKnowledge.western.rules[indices[2]];
  const match = facts => matchFortuneKnowledge({ ...bound, facts }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const witness = specific(bound).find(row => row.normalizedPayload.pair === 'venus-mercury' && row.activeFrom === row.normalizedPayload.returnAt);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
  assert.ok(Math.abs(arc(readTransitLongitude('Venus', returnAt) - readTransitLongitude('Mercury', birth))) < 0.000001);
  assert.deepEqual([Math.floor(readTransitLongitude('Venus', returnAt) / 30), Math.floor(readTransitLongitude('Jupiter', returnAt) / 30)], [8, 6]);
  assert.deepEqual([p.returningEssential.domicile, p.returningEssential.exalted, p.returningP115.points.domicile], [false, false, 5]);
  assert.ok(p.returningConditions.receptions.some(row => row.otherBody === 'Jupiter' && row.mutualHouse));
  assert.equal(p.returnHouse, 10);
  assert.deepEqual(p.returnVenusFortitude, { lowerNet: 16, atLeastWorkedExample: true });
  const result = match([witness]);
  assert.deepEqual([result.status, result.matchedSourceExcerpt], ['matched', 'Learning']);
  assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), reference.snapshotId));
  const reception = /同次回归金星与木星互入守护座，按原表计5分/u;
  assert.match(formatFortuneFactAudit(input), reception);
  assert.doesNotMatch(formatFortunePrompt(input), reception);
  const other = buildLillyReturnContext(range, reference.chart, epochs,
    buildLillyLocatedReturn(range, reference.chart, epochs, locationAtArmc(210))).contexts
    .find(row => row.pair === 'venus-mercury' && row.returnAt === returnAt);
  assert.equal(other.returnHouse, 11);
  assert.equal(other.radicalPlaceMinuteState, 'same_printed_minute');
  assert.deepEqual(other.returnVenusFortitude, { lowerNet: 15, atLeastWorkedExample: false });
  for (const payload of [other, { ...p, radicalPlaceMinuteState: 'different_printed_minutes' }]) {
    assert.equal(match([{ ...witness, normalizedPayload: payload }]).status, 'partial');
  }
});

test('Lilly reassigns only the scoring house at a verified five-degree cusp for return Venus and radical Moon', () => {
  for (const [pair, year, birth, armc, outside, actualHouse, cuspHouse, distance, ruleIndex] of [
    ['venus-mercury', 2024, '1956-09-07T17:49:49.190Z', 193, 195, 9, 10, 3.55003, indices[2]],
    ['moon-self', 2028, '1952-01-26T02:36:05.512Z', 252, 254, 11, 12, 3.30337, indices[3]],
  ]) {
    const venus = pair === 'venus-mercury';
    const range = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const at = Date.UTC(year, 9, 1), born = Date.parse(birth);
    const chartFor = angle => chart(born, venus ? 300 : angle, 35);
    const snapshot = chartFor(armc);
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const locationFor = angle => venus ? { returnAt, latitude: 35, longitude: arc(angle - SiderealTime(new Date(returnAt)) * 15) } : undefined;
    const reference = { snapshotId: 'lilly-cusp-virtue-' + pair, chart: snapshot };
    const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, reference, locationFor(armc))));
    const run = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, at), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const fact = specific(run).find(row => row.normalizedPayload.pair === pair && Date.parse(row.normalizedPayload.returnAt) === returnAt);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    const check = data => venus ? data.venusCuspVirtue : data.natalMoonCuspVirtue;
    const proof = check(p);
    assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(venus ? p.returnHouse : p.natalTargetHouse, actualHouse);
    assert.deepEqual([proof.fromHouse, proof.cuspHouse], [actualHouse, cuspHouse]);
    assert.ok(Math.abs(proof.distance - distance) < 0.0001);
    if (venus) {
      assert.equal(p.returningP115.points.house, 2);
      assert.equal(p.returnVenusFortitude, undefined);
      assert.deepEqual(p.returnVenusCuspFortitude, { lowerNet: 24, atLeastWorkedExample: true });
    } else {
      assert.equal(p.natalTargetP115.points.house, 4);
      assert.equal(p.natalMoonWorkedDebility, undefined);
      assert.deepEqual(p.natalMoonCuspDebility, { bookOneUpperNet: -4, bookThreeUpperNet: -4, atMostWorkedExample: true });
    }
    const rule = fortuneKnowledge.western.rules[ruleIndex];
    const reads = data => matchFortuneKnowledge({ ...run, facts: [{ ...fact, normalizedPayload: data }] })
      .byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(reads(p).status, 'matched');
    assert.deepEqual(reads(p).windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const counterChart = chartFor(outside);
    const local = buildLillyLocatedReturn(range, counterChart, epochs, locationFor(outside));
    const outsideFive = buildLillyReturnContext(range, counterChart, epochs, local).contexts
      .find(row => row.pair === pair && row.returnAt === returnAt);
    assert.equal(venus ? outsideFive.returnHouse : outsideFive.natalTargetHouse, actualHouse);
    assert.equal(outsideFive.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(check(outsideFive), undefined);
    if (venus) assert.deepEqual(outsideFive.returnVenusFortitude, { lowerNet: 21, atLeastWorkedExample: true });
    assert.equal(reads(outsideFive).status, venus ? 'matched' : 'partial');
    assert.equal(reads({ ...p, radicalPlaceMinuteState: 'different_printed_minutes' }).status, 'partial');

    const isolated = { ...run, facts: [fact] };
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
    const details = venus ? /回归金星实居第9宫，距前方第10宫头/u : /本命月亮实居第11宫，距前方第12宫头/u;
    assert.match(formatFortuneFactAudit(input), details);
    const provider = formatFortunePrompt(input);
    assert.match(provider, venus ? /该宫为角宫或第十一宫/u : /前方第十二宫头五度以内/u);
    assert.doesNotMatch(provider, /venusCuspVirtue|natalMoonCuspVirtue|按五度宫头法另核该宫的作用/u);
    assert.doesNotMatch(provider, details);
  }
});

test('Lilly separates cusp fortitude and actual house in three real return pairs', () => {
  const samples = [
    { pair: 'saturn-self', rule: indices[0], year: 1980, birth: '1921-11-04T09:37:05.134Z', armc: 8 },
    { pair: 'venus-mercury', rule: indices[2], year: 2024, birth: '1956-09-07T17:49:49.190Z', armc: 312 },
    { pair: 'moon-self', rule: indices[3], year: 2026, birth: '1988-05-20T17:57:48.370Z', armc: 303 },
  ];
  for (const sample of samples) {
    const { pair, year, armc } = sample;
    const moon = pair === 'moon-self', saturn = pair === 'saturn-self';
    const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const now = Date.UTC(year, 11, 1);
    const range = buildFactTimeContext(parameters, now, 'client').window;
    const born = Date.parse(sample.birth);
    const snapshot = chart(born, moon ? armc : 300, 35);
    const reference = { snapshotId: 'lilly-known-cusp-' + pair, chart: snapshot };
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const current = MakeTime(new Date(returnAt));
    const locationAt = meridian => ({ returnAt, latitude: 35, longitude: arc(meridian - SiderealTime(current) * 15) });
    const location = moon ? undefined : locationAt(armc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference, location)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const fact = specific(run).find(row => row.normalizedPayload.pair === pair && Date.parse(row.normalizedPayload.returnAt) === returnAt);
    assert.ok(fact, pair);
    const p = fact.normalizedPayload;
    const rule = fortuneKnowledge.western.rules[sample.rule];
    const matchPayload = payload => matchFortuneKnowledge({ ...run, facts: [{ ...fact, normalizedPayload: payload }] })
      .byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    const matched = matchPayload(p);
    assert.equal(matched.status, 'matched', pair);
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const contextAt = (natal, returnLocation) => buildLillyReturnContext(range, natal, epochs,
      buildLillyLocatedReturn(range, natal, epochs, returnLocation)).contexts.find(row => row.pair === pair && row.returnAt === returnAt);
    if (saturn) {
      assert.deepEqual([p.returnHouse, p.saturnCuspVirtue.fromHouse, p.saturnCuspVirtue.cuspHouse], [3, 3, 4]);
      assert.ok(p.saturnCuspVirtue.distanceRange.every(value => value > 3.55 && value < 3.57));
      assert.equal(p.saturnSupportedReturnContact.body, 'Venus');
      assert.doesNotMatch(matched.matchedConditions.join(''), /第十宫/u);
      const fourthCusp = (readTransitLongitude('Saturn', returnAt) + 185) * rad;
      const boundaryMeridian = Math.atan2(Math.sin(fourthCusp) * Math.cos(e_tilt(current).tobl * rad), Math.cos(fourthCusp)) / rad;
      const boundary = contextAt(snapshot, locationAt(boundaryMeridian));
      assert.equal(boundary.returnHouse, 3);
      assert.equal(boundary.saturnCuspVirtue, undefined);
      assert.equal(boundary.saturnSupportedReturn, undefined);
      assert.equal(matchPayload(boundary).status, 'partial');
    } else if (moon) {
      assert.deepEqual([p.natalTargetHouse, p.natalMoonCuspVirtue.fromHouse, p.natalMoonCuspVirtue.cuspHouse], [3, 3, 4]);
      assert.ok(p.natalMoonCuspVirtue.distance > 3.25 && p.natalMoonCuspVirtue.distance < 3.28);
      assert.deepEqual(p.natalMoonCuspFortitude, { bookOneLowerNet: 14, bookThreeLowerNet: 14, atLeastWorkedExample: true });
      assert.equal(p.natalMoonWorkedFortitude, undefined);
      const farther = contextAt(chart(born, 305, 35));
      assert.equal(farther.natalTargetHouse, 3);
      assert.equal(farther.natalMoonCuspFortitude, undefined);
      assert.deepEqual(farther.natalMoonWorkedFortitude, { bookOneLowerNet: 11, bookThreeLowerNet: 11, atLeastWorkedExample: true });
      assert.doesNotMatch(matchPayload(farther).matchedConditions.join(''), /最近的前方宫头五度内/u);
      assert.equal(matchPayload({ ...p, radicalPlaceMinuteState: 'different_printed_minutes' }).status, 'partial');
    } else {
      assert.deepEqual([p.returnHouse, p.radicalPlaceMinuteState], [5, 'same_printed_minute']);
      assert.deepEqual(p.returnVenusFortitude, { lowerNet: 22, atLeastWorkedExample: true });
      assert.match(matched.matchedConditions.join(''), /第五宫/u);
      const fourth = contextAt(snapshot, locationAt(340));
      assert.deepEqual([fourth.returnHouse, fourth.venusCuspVirtue.cuspHouse, fourth.radicalPlaceMinuteState],
        [4, 5, 'same_printed_minute']);
      assert.ok(fourth.venusCuspVirtue.distanceRange.every(value => value > 2.22 && value < 2.24));
      assert.deepEqual(fourth.returnVenusCuspFortitude, { lowerNet: 22, atLeastWorkedExample: true });
      const nearby = matchPayload(fourth);
      assert.equal(nearby.status, 'matched');
      assert.match(nearby.matchedConditions.join(''), /第五宫头/u);
      const sixth = contextAt(snapshot, locationAt(290));
      assert.deepEqual([sixth.returnHouse, sixth.radicalPlaceMinuteState, sixth.returnVenusFortitude], [6, 'same_printed_minute', undefined]);
      assert.equal(matchPayload(sixth).status, 'partial');
    }
    const isolated = { ...run, facts: [fact] };
    const { input } = buildFortuneModelContext(isolated,
      interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.match(provider, saturn ? /同盘木星或金星的精细相位支持/u
      : moon ? /两种取法均达到第三卷所称强势的原例下限/u : /实居第一卷所列能发挥其性质的第五宫/u);
    if (saturn || moon) assert.match(formatFortuneFactAudit(input),
      saturn ? /回归土星实居第3宫，距前方第4宫头/u : /本命月亮按宫头作用重算的两表净值下限分别为14分和14分/u);
    assert.doesNotMatch(provider, /saturnCuspVirtue|natalMoonCuspFortitude|净值下限分别为/u);
  }
});

test('Lilly keeps the current scoring house when it is the nearest cusp of a short Regiomontanus house', () => {
  const examples = [
    { pair: 'saturn-self', body: 'Saturn', birth: '1921-11-04T09:37:05.134Z', year: 1980, latitude: 84,
      armc: 163.5, alternate: 155.5, house: 11, ruleIndex: indices[0] },
    { pair: 'venus-mercury', body: 'Venus', birth: '1956-09-07T17:49:49.190Z', year: 2024, latitude: -83,
      armc: 9.5, alternate: 6, house: 4, ruleIndex: indices[2] },
    { pair: 'moon-self', body: 'Moon', birth: '1960-06-03T08:40:24.520Z', year: 2055, latitude: 84,
      armc: 42.5, alternate: 29, house: 1, ruleIndex: indices[3] },
  ];
  for (const { pair, body, birth, year, latitude, armc, alternate, house, ruleIndex } of examples) {
    const natalMoon = body === 'Moon', birthAt = Date.parse(birth);
    const range = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const asOf = Date.UTC(year, 11, 1);
    const snapshotAt = meridian => natalMoon ? chart(birthAt, meridian, latitude) : chart(birthAt, 300, 35);
    const snapshot = snapshotAt(armc);
    const returns = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = returns.find(row => range.start <= row.returnAt);
    const returnLocation = meridian => natalMoon ? undefined
      : { returnAt, latitude, longitude: arc(meridian - SiderealTime(new Date(returnAt)) * 15) };
    const reference = { snapshotId: 'lilly-nearest-cusp-' + pair, chart: snapshot };
    const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, returnLocation(armc))));
    const run = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const fact = specific(run).find(row => row.activeFrom === row.normalizedPayload.returnAt && row.normalizedPayload.pair === pair);
    assert.ok(fact, pair);
    const verifyHouse = data => natalMoon ? data.natalTargetHouse : data.returnHouse;
    const score = data => body === 'Saturn' ? data.saturnSupportedReturn : body === 'Venus'
      ? data.returnVenusAtLeastWorkedFortitude : data.natalMoonAtLeastWorkedFortitude;
    const p = fact.normalizedPayload;
    assert.equal(verifyHouse(p), house);
    assert.equal(score(p), true);
    const rule = fortuneKnowledge.western.rules[ruleIndex];
    const read = payload => matchFortuneKnowledge({ ...run, facts: [{ ...fact, normalizedPayload: payload }] })
      .byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(read(p).status, 'matched');
    const epoch = natalMoon ? birthAt : returnAt;
    const t = MakeTime(new Date(epoch)), longitude = readTransitLongitude(body, epoch);
    const distances = meridian => {
      const frame = calculateHouseCusps(meridian, latitude, e_tilt(t).tobl, 'regiomontanus');
      assert.equal(frame.status, 'ready');
      assert.equal(zodiacalHouse(longitude, frame.cusps), house);
      return [normalize(longitude - frame.cusps[house - 1]), normalize(frame.cusps[house % 12] - longitude)];
    };
    const [current, following] = distances(armc), [otherCurrent, otherFollowing] = distances(alternate);
    assert.ok(current < following && following < 5, pair);
    assert.ok(otherFollowing < otherCurrent && otherFollowing < 5, pair);
    const readOther = meridian => {
      const other = snapshotAt(meridian);
      const location = buildLillyLocatedReturn(range, other, returns, returnLocation(meridian));
      return buildLillyReturnContext(range, other, returns, location).contexts.find(row => row.pair === pair && row.returnAt === returnAt);
    };
    const comparison = readOther(alternate);
    assert.equal(verifyHouse(comparison), house);
    assert.equal(comparison.radicalPlaceMinuteState, p.radicalPlaceMinuteState);
    const compared = read(comparison);
    if (body === 'Saturn') {
      assert.equal(p.saturnMidheavenState, 'other-house');
      assert.equal(comparison.saturnCuspVirtue.cuspHouse, 12);
      assert.equal(score(comparison), true);
      assert.equal(compared.status, 'matched');
      assert.doesNotMatch(compared.matchedConditions.join(''), /第十宫/u);
      continue;
    }
    assert.equal(score(comparison), undefined);
    if (body === 'Moon') {
      assert.equal(comparison.natalMoonCuspVirtue.cuspHouse, 2);
      assert.deepEqual(comparison.natalMoonCuspFortitude,
        { bookOneLowerNet: 12, bookThreeLowerNet: 12, atLeastWorkedExample: true });
      assert.equal(compared.status, 'matched');
      continue;
    }
    assert.deepEqual([comparison.returnHouse, comparison.venusCuspVirtue.fromHouse, comparison.venusCuspVirtue.cuspHouse], [4, 4, 5]);
    assert.deepEqual(comparison.returnVenusCuspFortitude, { lowerNet: 22, atLeastWorkedExample: true });
    assert.equal(compared.status, 'matched');
    assert.equal(compared.matchedSourceExcerpt, 'Learning');
    assert.match(compared.matchedConditions.join(''), /第五宫头/u);
    assert.deepEqual(compared.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    let before = alternate, after = armc;
    for (let i = 0; i < 38; i++) {
      const middle = (before + after) / 2, [near, next] = distances(middle);
      if (near < next) after = middle; else before = middle;
    }
    const ambiguous = readOther((before + after) / 2);
    assert.equal(verifyHouse(ambiguous), house);
    assert.equal(ambiguous.venusCuspVirtue, undefined);
    assert.equal(score(ambiguous), undefined);
    assert.equal(read(ambiguous).status, 'partial');
  }
});

test('Lilly counts a stable same-sign Venus cazimi separately from combustion and preserves both return conditions', () => {
  const year = 2030, range = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
  const asOf = Date.UTC(year, 9, 1), birth = Date.parse('1994-10-21T04:06:16.238Z');
  const rule = fortuneKnowledge.western.rules[indices[2]];
  const readMatch = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const context = (birthAt, armc) => {
    const snapshot = chart(birthAt, 300, 35);
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const location = { returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) };
    const local = buildLillyLocatedReturn(range, snapshot, epochs, location);
    const row = buildLillyReturnContext(range, snapshot, epochs, local).contexts
      .find(row => row.pair === 'venus-mercury' && row.returnAt === returnAt);
    return { snapshot, location, row, returnAt };
  };
  const { snapshot, location, row, returnAt } = context(birth, 0);
  assert.ok(Math.abs(returnAt - Date.parse('2030-10-20T21:31:04.032Z')) < 1000);
  assert.deepEqual([row.returnHouse, row.radicalPlaceMinuteState, row.returnDirection, row.returningEssential.domicile,
    row.returningConditions.solar.condition], [4, 'same_printed_minute', 'direct', true, 'cazimi']);
  const venus = readTransitLongitude('Venus', returnAt), sun = readTransitLongitude('Sun', returnAt);
  assert.ok(Math.abs(arc(venus - readTransitLongitude('Mercury', birth))) < 0.000001);
  assert.equal(Math.floor(venus / 30), Math.floor(sun / 30));
  assert.ok(Math.abs(Math.abs(arc(venus - sun)) * 60 - 6.660841) < 0.0001);
  const reference = { snapshotId: 'lilly-venus-return-cazimi', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const point = specific(run).find(fact => fact.normalizedPayload.returnVenusAtLeastCazimiFortitude === true);
  assert.ok(point);
  assert.deepEqual(point.normalizedPayload.returnVenusCazimiFortitude, { lowerNet: 17, atLeastWorkedExample: true });
  assert.equal(point.normalizedPayload.returnVenusAtLeastWorkedFortitude, undefined);
  const result = readMatch(run);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  assert.equal(result.matchedSourceExcerpt, 'Learning');
  const alternateHouse = context(birth, 240).row;
  assert.deepEqual([alternateHouse.returnHouse, alternateHouse.returningConditions.solar.condition], [8, 'cazimi']);
  assert.equal(alternateHouse.returningEssential.inOwnTerm, false);
  assert.equal(alternateHouse.returnVenusEighthFortitude, undefined);
  const belowThreshold = [[32, 3, 14], [212, 9, 15]].map(([armc, house, lowerNet]) => {
    const row = context(birth, armc).row;
    assert.deepEqual([row.returnHouse, row.returningConditions.solar.condition], [house, 'cazimi']);
    assert.deepEqual(row.returnVenusCazimiFortitude, { lowerNet, atLeastWorkedExample: false });
    return row;
  });
  const combustBirth = Date.parse('1961-10-22T13:56:11.786Z');
  const combust = context(combustBirth, 0);
  assert.ok(Math.abs(arc(readTransitLongitude('Venus', combust.returnAt) - readTransitLongitude('Mercury', combustBirth))) < 0.000001);
  assert.equal(combust.row.returningConditions.solar.condition, 'combust');
  for (const counter of [alternateHouse, ...belowThreshold, combust.row,
    { ...point.normalizedPayload, radicalPlaceMinuteState: 'different_printed_minutes' }]) {
    assert.notEqual(counter.returnVenusAtLeastCazimiFortitude && counter.radicalPlaceMinuteState === 'same_printed_minute', true);
    assert.equal(readMatch({ ...run, facts: [{ ...point, normalizedPayload: counter }] }).status, 'partial');
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const local = /回归金星实为同座日心，保守净值下限为17分/u;
  assert.match(formatFortuneFactAudit(input), local);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同座日心/u);
  assert.doesNotMatch(prompt, /保守净值下限为17分|returnVenusAtLeastCazimiFortitude|1994-10-21/u);
});

test('Lilly confirms the Book III eighth-house Venus example only with the real shared minute and worked fortitude', () => {
  const year = 2094, range = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
  const asOf = Date.UTC(year, 9, 1), birth = Date.parse('2028-10-02T08:00:09.859Z');
  const snapshot = chart(birth, 300, 35);
  const epochs = buildLillySolarReturnPositions(range, snapshot);
  const { returnAt } = epochs.find(row => row.returnAt >= range.start);
  assert.ok(Math.abs(returnAt - Date.parse('2094-10-02T07:45:33.971Z')) < 1000);
  const locationFor = armc => ({ returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) });
  const location = locationFor(230);
  const venus = readTransitLongitude('Venus', returnAt), sun = readTransitLongitude('Sun', returnAt);
  assert.ok(Math.abs(arc(venus - readTransitLongitude('Mercury', birth))) < 0.000001);
  assert.ok(arc(venus - sun) > 0 && arc(venus - sun) < 17 / 60);
  assert.equal(Math.floor(venus / 30), Math.floor(sun / 30));
  const sideOfVenus = body => arc(readTransitLongitude(body, returnAt) - venus);
  assert.ok(['Mars', 'Saturn'].every(body => -180 < sideOfVenus(body) && sideOfVenus(body) < 0));

  const reference = { snapshotId: 'lilly-venus-return-eighth-worked-example', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const point = specific(run).find(fact => fact.normalizedPayload.returnVenusAtLeastWorkedEighthFortitude === true);
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.deepEqual([p.pair, p.returnHouse, p.radicalPlaceMinuteState, p.returningEssential.inOwnTerm,
    p.returningConditions.solar.condition], ['venus-mercury', 8, 'same_printed_minute', true, 'cazimi']);
  assert.equal(p.returningP115.points.house, -2);
  assert.equal(p.returningP115.points.besiegement, undefined);
  assert.equal(p.returnVenusAtLeastCazimiFortitude, undefined);
  assert.deepEqual(p.returnVenusEighthFortitude, { lowerNet: 16, atLeastWorkedExample: true,
    bookThreeHousePenalty: -4, bodyBesiegement: 'both-malefics-on-one-side' });
  const assess = saturnLongitude => lillyVenusFortitudeAtReturn(p.returningEssential, p.returningConditions,
    p.returningP115, { marsLongitude: readTransitLongitude('Mars', returnAt), saturnLongitude });
  assert.equal(assess(readTransitLongitude('Saturn', returnAt)).atLeastWorkedExample, true);
  assert.equal(assess(venus + 30), undefined);
  const rule = fortuneKnowledge.western.rules[indices[2]];
  const match = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const result = match(run);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, 'Learning');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  const contextAt = armc => buildLillyReturnContext(range, snapshot, epochs,
    buildLillyLocatedReturn(range, snapshot, epochs, locationFor(armc))).contexts
    .find(row => row.pair === 'venus-mercury' && row.returnAt === returnAt);
  for (const [armc, house, lowerNet, actualHouseBeforeCusp] of [
    [46, 2, 18], [14, 3, 16], [320, 5, 18], [194, 9, 17], [72, 2, 18, 1], [42, 3, 16, 2], [220, 9, 17, 8],
  ]) {
    const normalizedPayload = contextAt(armc);
    assert.deepEqual([normalizedPayload.returnHouse, normalizedPayload.radicalPlaceMinuteState,
      normalizedPayload.returningConditions.solar.condition], [actualHouseBeforeCusp ?? house, 'same_printed_minute', 'cazimi']);
    assert.equal(normalizedPayload.returnVenusEighthFortitude, undefined);
    const fortitude = actualHouseBeforeCusp === undefined ? normalizedPayload.returnVenusCazimiFortitude
      : normalizedPayload.returnVenusCuspFortitude;
    if (actualHouseBeforeCusp !== undefined) assert.equal(normalizedPayload.returnVenusCuspHouse, house);
    assert.deepEqual(fortitude, { lowerNet, atLeastWorkedExample: true });
    assert.equal(match({ ...run, facts: [{ ...point, normalizedPayload }] }).status, 'matched', String(armc));
  }
  const fifth = contextAt(320), nearSixth = contextAt(310);
  const fifthFact = { ...point, normalizedPayload: fifth };
  assert.equal(fifth.returningP115.points.house, 3);
  assert.deepEqual([nearSixth.returnHouse, nearSixth.venusCuspVirtue.cuspHouse, nearSixth.radicalPlaceMinuteState,
    nearSixth.returningConditions.solar.condition], [5, 6, 'same_printed_minute', 'cazimi']);
  const offMinute = { ...fifth, radicalPlaceMinuteState: 'different_printed_minutes' };
  const negative = [nearSixth, offMinute].map(normalizedPayload => ({ ...point, normalizedPayload }));
  for (const fact of negative) assert.equal(match({ ...run, facts: [fact] }).status, 'partial');
  const branch = evaluateFortuneRules('western', 'year', [fifthFact, ...negative])
    .find(row => row.knowledgeId === rule.knowledgeId).confirmations.find(row => {
      const { where } = JSON.parse(row.condition);
      return where.returnHouse === 5 && where.returnVenusAtLeastCazimiFortitude === true;
    });
  assert.deepEqual(branch.hits, [fifthFact]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const auditEvidence = /回归金星实居第八宫且同座日心，依第三卷原例扣四分后净值下限为16分/u;
  assert.match(formatFortuneFactAudit(input), auditEvidence);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /实居第八宫/u);
  assert.doesNotMatch(prompt, auditEvidence);
  assert.doesNotMatch(prompt, /returnVenusEighthFortitude|both-malefics-on-one-side|2094-10-02T07:45:33/u);
});

test('Lilly’s weak natal Moon route needs the real return minute and debility even with all possible bonuses', () => {
  const parameters = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2028 } };
  const asOf = Date.UTC(2028, 10, 24);
  const birth = Date.parse('1990-11-17T04:25:22.316Z');
  const reference = { snapshotId: 'lilly-natal-moon-debility', chart: chart(birth, 165, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const time = readClientFactTime(parameters, batch, asOf);
  const bound = bindClientFortuneRun(parameters, batch, time, reference.snapshotId, reference);
  const rule = fortuneKnowledge.western.rules[indices[3]];
  const readMatch = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const matched = specific(bound).find(row => row.normalizedPayload.natalMoonWeakInBothTables === true);
  assert.ok(matched);
  const payload = matched.normalizedPayload;
  assert.equal(payload.radicalPlaceMinuteState, 'same_printed_minute');
  assert.equal(payload.natalTargetHouse, 12);
  assert.deepEqual(payload.natalMoonDebility, { bookOneUpperNet: -3, bookThreeUpperNet: -3, weakInBoth: true });
  assert.ok(Math.abs(arc(readTransitLongitude('Moon', Date.parse(payload.returnAt)) - readTransitLongitude('Moon', birth))) < 0.0001);
  const result = readMatch(bound);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: matched.activeFrom, endExclusive: matched.activeTo }]);
  const context = snapshot => buildLillyReturnContext(time.window, snapshot, buildLillySolarReturnPositions(time.window, snapshot))
    .contexts.find(row => row.pair === 'moon-self' && row.returnAt === Date.parse(payload.returnAt));
  const changeLocation = context(chart(birth, 220, 35));
  assert.equal(changeLocation.radicalPlaceMinuteState, 'same_printed_minute');
  assert.equal(changeLocation.natalTargetHouse, 10);
  assert.deepEqual(changeLocation.natalMoonDebility, { bookOneUpperNet: 7, bookThreeUpperNet: 7, weakInBoth: false });
  const nearCusp = context(chart(birth, 158, 35));
  assert.equal(nearCusp.natalTargetHouse, 12);
  assert.equal(nearCusp.natalMoonDebility, undefined);
  const nearAspect = { ...payload, radicalPlaceMinuteState: 'different_printed_minutes' };
  for (const candidate of [changeLocation, nearCusp, nearAspect]) {
    assert.equal(readMatch({ ...bound, facts: [{ ...matched, normalizedPayload: candidate }] }).status, 'partial');
  }
  const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /两种取法的净值上限分别为-3分和-3分/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按 Lilly 的助损表及本命命例取法，计入可能的助分后仍偏弱/u);
  assert.doesNotMatch(prompt, /两种取法的净值上限|natalMoonDebility|1990-11-17/u);
});

test('Lilly explains a weak Moon return using the worked twelfth-house and natal sixth-sign geometry', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1993 } };
  const now = Date.UTC(1993, 10, 19);
  const birth = Date.parse('1936-11-13T16:10:49.878Z'), latitude = 35;
  const snapshot = chart(birth, 321, latitude);
  const reference = { snapshotId: 'lilly-moon-return-twelfth-natal-sixth', chart: snapshot };
  const range = buildFactTimeContext(params, now, 'client').window;
  const returns = buildLillySolarReturnPositions(range, snapshot);
  const { returnAt } = returns.find(row => row.returnAt >= range.start);
  assert.ok(Math.abs(returnAt - Date.parse('1993-11-13T11:46:11.850Z')) < 3);
  const returnTime = MakeTime(new Date(returnAt));
  const locationAt = armc => ({ returnAt, latitude, longitude: arc(armc - SiderealTime(returnTime) * 15) });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, locationAt(148))));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const witness = specific(run).find(({ normalizedPayload: p }) => p.pair === 'moon-self' && Date.parse(p.returnAt) === returnAt);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.radicalPlaceMinuteState, p.returnHouse, p.natalTargetHouse, p.returnMoonRadicalSixthInTwelfth],
    ['same_printed_minute', 12, 6, true]);
  assert.deepEqual(p.natalMoonDebility, { bookOneUpperNet: -5, bookThreeUpperNet: -5, weakInBoth: true });
  const natalObliquity = e_tilt(MakeTime(new Date(birth))).tobl;
  const returnObliquity = e_tilt(returnTime).tobl;
  const natalCusp = armc => calculateHouseCusps(armc, latitude, natalObliquity, 'regiomontanus').cusps[5];
  assert.deepEqual([Math.floor(natalCusp(321) / 30), Math.floor(readTransitLongitude('Moon', returnAt) / 30)], [7, 7]);
  assert.ok(Math.abs(readTransitLongitude('Moon', birth) - readTransitLongitude('Moon', returnAt)) < 0.00001);
  assert.equal(zodiacalHouse(readTransitLongitude('Moon', returnAt),
    calculateHouseCusps(148, latitude, returnObliquity, 'regiomontanus').cusps), 12);

  const sourceContext = (natalArm, returnArm) => {
    const natal = chart(birth, natalArm, latitude);
    const local = returnArm === undefined ? undefined : buildLillyLocatedReturn(range, natal, returns, locationAt(returnArm));
    return buildLillyReturnContext(range, natal, returns, local).contexts.find(row => row.pair === 'moon-self' && row.returnAt === returnAt);
  };
  const alternateHouse = sourceContext(321, 190), alternateSign = sourceContext(318, 148);
  assert.equal(alternateHouse.returnHouse, 11);
  assert.deepEqual([alternateSign.returnHouse, Math.floor(natalCusp(318) / 30)], [12, 6]);
  for (const alternate of [alternateHouse, alternateSign]) {
    assert.equal(alternate.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(alternate.natalMoonWeakInBothTables, true);
    assert.equal(alternate.returnMoonRadicalSixthInTwelfth, false);
  }
  assert.equal(sourceContext(321).returnMoonRadicalSixthInTwelfth, undefined);

  const rule = fortuneKnowledge.western.rules[indices[3]];
  const changed = changes => ({ ...witness, normalizedPayload: { ...p, ...changes } });
  const cases = [witness, changed({ returnMoonRadicalSixthInTwelfth: alternateHouse.returnMoonRadicalSixthInTwelfth }),
    changed({ returnMoonRadicalSixthInTwelfth: alternateSign.returnMoonRadicalSixthInTwelfth }),
    changed({ natalMoonWeakInBothTables: false })];
  const branch = evaluateFortuneRules('western', 'year', cases).find(row => row.knowledgeId === rule.knowledgeId).confirmations
    .find(row => JSON.parse(row.condition).where.returnMoonRadicalSixthInTwelfth === true);
  assert.deepEqual(branch.hits, [witness]);
  const scoped = { ...run, facts: [witness] };
  const matched = matchFortuneKnowledge(scoped).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(matched.status, 'matched');
  assert.deepEqual(matched.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.ok(branch.sourceConditions.every(condition => prompt.includes(condition)));
  assert.doesNotMatch(prompt, /returnMoonRadicalSixthInTwelfth|1936-11-13|1993-11-13T11:46/u);
});

test('Lilly confirms a declining natal Moon under the beams without combustion only in the real return minute', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2028 } };
  const asOf = Date.UTC(2028, 2, 24), birth = Date.parse('1952-01-26T02:36:05.512Z');
  const reference = { snapshotId: 'lilly-natal-moon-worked-debility', chart: chart(birth, 240, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  const rule = fortuneKnowledge.western.rules[indices[3]];
  const readMatch = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const matched = specific(run).find(row => row.normalizedPayload.natalMoonAtMostWorkedDebility === true);
  assert.ok(matched);
  const p = matched.normalizedPayload;
  const returnAt = Date.parse(p.returnAt);
  assert.ok(Math.abs(returnAt - Date.parse('2028-01-25T13:18:33.354Z')) <= 1);
  assert.ok(Math.abs(arc(readTransitLongitude('Moon', returnAt) - readTransitLongitude('Moon', birth))) < 0.0001);
  assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
  assert.equal(p.natalTargetHouse, 12);
  assert.equal(p.natalTargetConditions.moonLight, 'decreasing');
  assert.equal(p.natalTargetConditions.solar.condition, 'under_beams');
  assert.equal(p.natalTargetConditions.solar.withinCombustionDistance, false);
  assert.equal(p.natalMoonWeakInBothTables, undefined);
  assert.deepEqual(p.natalMoonWorkedDebility, { bookOneUpperNet: -4, bookThreeUpperNet: -4, atMostWorkedExample: true });
  const found = readMatch(run);
  assert.equal(found.status, 'matched');
  assert.deepEqual(found.windows, [{ start: matched.activeFrom, endExclusive: matched.activeTo }]);

  const epochs = buildLillySolarReturnPositions(time.window, reference.chart);
  const sameReturn = armc => buildLillyReturnContext(time.window, chart(birth, armc, 35), epochs)
    .contexts.find(row => row.pair === 'moon-self' && row.returnAt === returnAt);
  const angular = sameReturn(220), nearCusp = sameReturn(225);
  assert.equal(angular.radicalPlaceMinuteState, 'same_printed_minute');
  assert.equal(angular.natalTargetHouse, 1);
  assert.deepEqual(angular.natalMoonWorkedDebility, { bookOneUpperNet: 14, bookThreeUpperNet: 14, atMostWorkedExample: false });
  assert.equal(nearCusp.natalTargetHouse, 12);
  assert.equal(nearCusp.natalMoonWorkedDebility, undefined);
  const offMinute = { ...p, radicalPlaceMinuteState: 'different_printed_minutes' };
  for (const candidate of [angular, nearCusp, offMinute]) {
    assert.equal(readMatch({ ...run, facts: [{ ...matched, normalizedPayload: candidate }] }).status, 'partial');
  }
  const adjacentWindow = { start: Date.UTC(2029, 0, 1), end: Date.UTC(2030, 0, 1) };
  const adjacentEpochs = buildLillySolarReturnPositions(adjacentWindow, reference.chart);
  const adjacent = buildLillyReturnContext(adjacentWindow, reference.chart, adjacentEpochs)
    .contexts.find(row => row.pair === 'moon-self' && adjacentWindow.start <= row.returnAt && row.returnAt < adjacentWindow.end);
  assert.equal(adjacent.radicalPlaceMinuteState, 'different_printed_minutes');
  assert.equal(adjacent.natalMoonWorkedDebility, undefined);

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /本命月亮在日光下但未受灼，按两种助损取法的净值上限分别为-4分和-4分/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /仍达到具名原例的明显偏弱程度/u);
  assert.doesNotMatch(prompt, /净值上限|natalMoonWorkedDebility|1952-01-26/u);
});

test('Lilly applies the sixth cusp to a weak natal Moon physically in the fifth house', () => {
  const year = 1921, birth = Date.parse('1902-11-28T18:48:58.353Z');
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
  const asOf = Date.UTC(year, 11, 1);
  const reference = { snapshotId: 'lilly-natal-moon-near-sixth-cusp', chart: chart(birth, 339, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  validateFortuneFacts(run);
  const point = specific(run).find(({ normalizedPayload: p }) =>
    p.natalMoonCuspHouse === 6 && p.radicalPlaceMinuteState === 'same_printed_minute');
  assert.ok(point);
  const p = point.normalizedPayload, returnAt = Date.parse(p.returnAt);
  assert.ok(Math.abs(returnAt - Date.parse('1921-11-28T09:19:06.238Z')) <= 1);
  assert.ok(Math.abs(arc(readTransitLongitude('Moon', returnAt) - readTransitLongitude('Moon', birth))) < 0.0001);
  assert.deepEqual([p.pair, p.radicalPlaceMinuteState, p.natalTargetHouse, p.natalMoonCuspVirtue.fromHouse],
    ['moon-self', 'same_printed_minute', 5, 5]);
  assert.ok(Math.abs(p.natalMoonCuspVirtue.distance - 1.88047) < 0.00001);
  assert.equal(p.natalTargetEssential.fall, true);
  assert.equal(p.natalTargetConditions.solar.condition, 'under_beams');
  assert.deepEqual(p.natalMoonCuspDebility, { bookOneUpperNet: -4, bookThreeUpperNet: -4, atMostWorkedExample: true });

  const epochs = buildLillySolarReturnPositions(time.window, reference.chart);
  const outside = buildLillyReturnContext(time.window, chart(birth, 342, 35), epochs).contexts
    .find(row => row.pair === 'moon-self' && row.returnAt === returnAt);
  assert.deepEqual([outside.radicalPlaceMinuteState, outside.natalTargetHouse, outside.natalMoonCuspVirtue],
    ['same_printed_minute', 5, undefined]);
  assert.deepEqual(outside.natalMoonWorkedDebility, { bookOneUpperNet: 1, bookThreeUpperNet: 1, atMostWorkedExample: false });
  const offMinute = { ...p, radicalPlaceMinuteState: 'different_printed_minutes' };
  const negative = [outside, offMinute].map(normalizedPayload => ({ ...point, normalizedPayload }));

  const rule = fortuneKnowledge.western.rules[indices[3]];
  const readMatch = facts => matchFortuneKnowledge({ ...run, facts }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const result = readMatch([point]);
  assert.deepEqual([result.status, result.matchedSourceExcerpt], ['matched', 'Radically']);
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  for (const fact of negative) assert.equal(readMatch([fact]).status, 'partial');
  const branch = evaluateFortuneRules('western', 'year', [point, ...negative])
    .find(row => row.knowledgeId === rule.knowledgeId).confirmations.find(row => {
      const { where } = JSON.parse(row.condition);
      return where.natalMoonCuspHouse === 6 && where.natalMoonAtMostCuspDebility === true;
    });
  assert.deepEqual(branch.hits, [point]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.ok(branch.sourceConditions.every(condition => prompt.includes(condition)));
  assert.doesNotMatch(prompt, /净值上限|natalMoonCuspVirtue|1902-11-28/u);
});

test('Lilly keeps verified natal malefic partiles in both upper bounds without deducting wider contacts', () => {
  const cases = [
    { birth: '1944-10-16T02:20:12.309Z', year: 2001, armc: 110, house: 12, malefic: 'Saturn', net: -6,
      returnAt: '2001-10-15T21:43:24.031Z', contrastArmc: 240, contrastHouse: 8, contrastNet: [-3, -5] },
    { birth: '2019-01-05T00:46:37.291Z', year: 2038, armc: 280, house: 9, malefic: 'Mars', net: -4,
      returnAt: '2038-01-04T15:34:32.790Z', contrastArmc: 260, contrastHouse: 10, contrastNet: [-1, -1] },
  ];
  const rule = fortuneKnowledge.western.rules[indices[3]];
  const readMatch = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  for (const example of cases) {
    const birthAt = Date.parse(example.birth), returnAt = Date.parse(example.returnAt);
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: example.year } };
    const asOf = Date.UTC(example.year, 10, 19);
    const reference = { snapshotId: 'lilly-natal-partile-' + example.malefic, chart: chart(birthAt, example.armc, 35) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const time = readClientFactTime(params, batch, asOf);
    const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
    const point = specific(run).find(({ normalizedPayload: p }) =>
      p.pair === 'moon-self' && Math.abs(Date.parse(p.returnAt) - returnAt) < 1_000);
    assert.ok(point);
    const p = point.normalizedPayload;
    assert.equal(p.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(p.natalTargetHouse, example.house);
    assert.deepEqual([p.natalTargetConditions.moonLight, p.natalTargetConditions.solar.condition], ['decreasing', 'under_beams']);
    const moon = EclipticGeoMoon(new Date(birthAt)).lon;
    const malefic = Ecliptic(GeoVector(Body[example.malefic], new Date(birthAt), true)).elon;
    assert.equal(Math.floor(moon % 30), Math.floor(malefic % 30));
    const signDistance = Math.abs(Math.floor(moon / 30) - Math.floor(malefic / 30));
    assert.equal(Math.min(signDistance, 12 - signDistance), 3);
    assert.deepEqual(p.natalTargetP115.partileContacts.filter(row => row.points < 0), [
      { body: example.malefic, aspect: 'square', points: -3 },
    ]);
    assert.deepEqual(p.natalMoonWorkedDebility,
      { bookOneUpperNet: example.net, bookThreeUpperNet: example.net, atMostWorkedExample: true });
    assert.ok(example.net + 3 > -4);
    const result = readMatch({ ...run, facts: [point] });
    assert.equal(result.status, 'matched');
    assert.ok(result.sourceFactIds.includes(point.factId));
    assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);

    const epochs = buildLillySolarReturnPositions(time.window, reference.chart);
    const contrast = chart(birthAt, example.contrastArmc, 35);
    const pending = buildLillyReturnContext(time.window, contrast, epochs).contexts.find(row =>
      row.pair === 'moon-self' && Math.abs(row.returnAt - returnAt) < 1_000);
    assert.equal(pending.radicalPlaceMinuteState, 'same_printed_minute');
    assert.equal(pending.natalTargetHouse, example.contrastHouse);
    assert.deepEqual(pending.natalMoonWorkedDebility,
      { bookOneUpperNet: example.contrastNet[0], bookThreeUpperNet: example.contrastNet[1], atMostWorkedExample: false });
    if (example.malefic === 'Mars') {
      const broadSaturn = pending.natalTargetConditions.contacts.find(row => row.otherBody === 'Saturn');
      assert.deepEqual([broadSaturn.aspectType, broadSaturn.sameDegreeOfSign], ['conjunction', false]);

      // The same natal Moon and return minute reuse the actual roots. Only
      // the natal horizon differs, so the assigned house score can change.
      const withMeridian = armc => buildLillyReturnContext(time.window, chart(birthAt, armc, 35), epochs).contexts
        .find(row => row.pair === 'moon-self' && Math.abs(row.returnAt - returnAt) < 1_000);
      const matchPayload = normalizedPayload => readMatch({ ...run, facts: [{ ...point, normalizedPayload }] });
      for (const [armc, house, cuspHouse, bookOneUpperNet, bookThreeUpperNet] of [
        [295, 8, 9, -4, -4], [319, 7, 8, -8, -10],
      ]) {
        const near = withMeridian(armc);
        assert.deepEqual([near.natalTargetHouse, near.natalMoonCuspVirtue.fromHouse, near.natalMoonCuspHouse,
          near.radicalPlaceMinuteState], [house, house, cuspHouse, 'same_printed_minute']);
        assert.ok(near.natalMoonCuspVirtue.distance > 0 && near.natalMoonCuspVirtue.distance < 5);
        assert.deepEqual(near.natalMoonCuspDebility, { bookOneUpperNet, bookThreeUpperNet, atMostWorkedExample: true });
        assert.equal(near.natalMoonWorkedDebility, undefined);
        const found = matchPayload(near);
        assert.deepEqual([found.status, found.matchedSourceExcerpt], ['matched', 'Radically']);
        assert.deepEqual(found.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
        assert.equal(matchPayload({ ...near, radicalPlaceMinuteState: 'different_printed_minutes' }).status, 'partial');
      }
      const outside = withMeridian(324);
      assert.deepEqual([outside.natalTargetHouse, outside.natalMoonCuspVirtue, outside.natalMoonAtMostWorkedDebility],
        [7, undefined, false]);
      assert.equal(matchPayload(outside).status, 'partial');
    }
    assert.equal(readMatch({ ...run, facts: [{ ...point, normalizedPayload: pending }] }).status, 'partial');

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const upper = '两种助损取法的净值上限分别为' + example.net + '分和' + example.net + '分';
    assert.ok(formatFortuneFactAudit(input).includes(upper));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /仍达到具名原例的明显偏弱程度/u);
    assert.ok(!prompt.includes(upper));
    assert.doesNotMatch(prompt, /natalMoonWorkedDebility|natalTargetP115/u);
  }
});

test('Lilly confirms the separate fortunate Moon branch for an actual nocturnal angular domicile', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
  const asOf = Date.UTC(2026, 7, 24), birth = Date.parse('1988-05-20T17:57:48.370Z');
  const reference = { snapshotId: 'lilly-natal-moon-nocturnal-domicile', chart: chart(birth, 210, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  validateFortuneFacts(run);
  const rule = fortuneKnowledge.western.rules[indices[3]];
  const readMatch = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const point = specific(run).find(row => row.normalizedPayload.natalMoonNocturnalDomicileFortitude === true
    && row.normalizedPayload.radicalPlaceMinuteState === 'same_printed_minute');
  assert.ok(point);
  const p = point.normalizedPayload;
  const returnAt = Date.parse(p.returnAt);
  assert.ok(Math.abs(returnAt - Date.parse('2026-05-20T22:38:10.489Z')) < 1_000);
  assert.ok(Math.abs(arc(readTransitLongitude('Moon', returnAt) - readTransitLongitude('Moon', birth))) < 0.0001);
  assert.deepEqual([p.natalSect, p.natalTargetHouse, p.natalTargetEssential.domicile, p.natalTargetConditions.moonLight,
    p.natalTargetConditions.solar.condition, p.natalMoonWeakInBothTables], ['night', 7, true, 'increasing', 'free_of_beams', undefined]);
  const result = readMatch(run);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  for (const [armc, sect, house, worked, status] of [
    [90, undefined, undefined, undefined, 'partial'],
    [120, 'day', 9, undefined, 'matched'],
    [190, 'night', 8, { bookOneLowerNet: 8, bookThreeLowerNet: 6, atLeastWorkedExample: true }, 'matched'],
    [285, 'night', 4, { bookOneLowerNet: 14, bookThreeLowerNet: 14, atLeastWorkedExample: true }, 'matched'],
  ]) {
    const alternative = chart(birth, armc, 35);
    const pending = buildLillyReturnContext(time.window, alternative, buildLillySolarReturnPositions(time.window, alternative))
      .contexts.find(row => row.pair === 'moon-self' && row.returnAt === returnAt);
    assert.deepEqual([pending.natalSect, pending.natalTargetHouse, pending.radicalPlaceMinuteState, pending.natalMoonNocturnalDomicileFortitude],
      [sect, house, 'same_printed_minute', sect === undefined ? undefined : false]);
    assert.deepEqual(pending.natalMoonWorkedFortitude, worked);
    if (armc === 120) assert.deepEqual(pending.natalMoonCuspFortitude,
      { bookOneLowerNet: 15, bookThreeLowerNet: 15, atLeastWorkedExample: true });
    assert.equal(readMatch({ ...run, facts: [{ ...point, normalizedPayload: pending }] }).status, status);
  }
  const wrongMinute = { ...point, normalizedPayload: { ...p, radicalPlaceMinuteState: 'different_printed_minutes' } };
  assert.equal(readMatch({ ...run, facts: [wrongMinute] }).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /本命月亮夜生，实居地平线以上的角宫与自身本垣，并增光远日/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /只参考原书所述本命已有的支持倾向/u);
  assert.doesNotMatch(prompt, /本命月亮落陷或失势|本命月亮夜生|natalMoonNocturnalDomicileFortitude|1988-05-20/u);

  const dayReference = { snapshotId: 'lilly-natal-moon-worked-fortitude', chart: chart(birth, 0, 35) };
  const dayBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, dayReference)));
  const dayRun = bindClientFortuneRun(params, dayBatch, readClientFactTime(params, dayBatch, asOf), dayReference.snapshotId, dayReference);
  const dayPoint = specific(dayRun).find(row => row.normalizedPayload.natalMoonAtLeastWorkedFortitude);
  assert.ok(dayPoint && dayPoint.normalizedPayload.natalMoonNocturnalDomicileFortitude === false);
  assert.deepEqual(dayPoint.normalizedPayload.natalMoonWorkedFortitude,
    { bookOneLowerNet: 15, bookThreeLowerNet: 15, atLeastWorkedExample: true });
  const dayResult = readMatch(dayRun);
  assert.equal(dayResult.status, 'matched');
  assert.deepEqual(dayResult.windows, [{ start: dayPoint.activeFrom, endExclusive: dayPoint.activeTo }]);
  assert.equal(readMatch({ ...dayRun, facts: [{ ...dayPoint, normalizedPayload: {
    ...dayPoint.normalizedPayload, radicalPlaceMinuteState: 'different_printed_minutes',
  } }] }).status, 'partial');
  const { input: dayInput } = buildFortuneModelContext(dayRun, interpretFortune(dayRun, requestForFortuneRun(dayRun), dayReference.snapshotId));
  assert.match(formatFortuneFactAudit(dayInput), /本命月亮按两种助损取法的净值下限分别为15分和15分/u);
  assert.match(formatFortunePrompt(dayInput), /出生盘的月亮达到原例所称强势的下限/u);
  assert.doesNotMatch(formatFortunePrompt(dayInput), /净值下限分别|natalMoonWorkedFortitude|1988-05-20/u);
});

test('Lilly p736 supports a nonangular nocturnal domicile Moon only with actual benefic application', () => {
  const birth = Date.parse('1933-05-27T17:46:26.678Z');
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2009 } };
  const asOf = Date.UTC(2009, 10, 19);
  const reference = { snapshotId: 'lilly-nocturnal-moon-nonangular-domicile', chart: chart(birth, 170, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  validateFortuneFacts(run);
  const point = specific(run).find(({ normalizedPayload: p }) => p.pair === 'moon-self'
    && p.radicalPlaceMinuteState === 'same_printed_minute');
  assert.ok(point);
  const p = point.normalizedPayload;
  const returnAt = Date.parse(p.returnAt);
  assert.ok(Math.abs(returnAt - Date.parse('2009-05-27T02:35:55.083Z')) < 3);
  assert.equal(p.natalMoonNocturnalNonAngularDomicileSupport, true);
  assert.deepEqual([p.natalSect, p.natalTargetHouse, p.natalTargetConditions.houseKind,
    p.natalTargetEssential.domicile, p.natalMoonNocturnalDomicileFortitude], ['night', 8, 'succedent', true, false]);
  assert.equal(p.natalPlanetHorizon.find(row => row.body === 'Moon').side, 'above');
  assert.deepEqual(p.natalMoonWorkedFortitude, { bookOneLowerNet: 3, bookThreeLowerNet: 1, atLeastWorkedExample: false });
  const proof = p.natalMoonNocturnalNonAngularDomicileWitness;
  assert.deepEqual([proof.supporter, proof.aspect], ['Jupiter', 'sextile']);
  const exact = Date.parse(proof.exactAt);
  assert.ok(Math.abs(exact - Date.parse('1933-05-27T20:57:44.973Z')) < 1_000);
  const sextile = at => Math.abs(arc(readTransitLongitude('Moon', at) - readTransitLongitude('Jupiter', at))) - 60;
  assert.ok(sextile(birth) > 1 && sextile(exact - 1_000) * sextile(exact + 1_000) < 0);

  const natalContext = (range, natalAt, armc) => {
    const natal = chart(natalAt, armc, 35);
    return buildLillyReturnContext(range, natal, buildLillySolarReturnPositions(range, natal)).contexts
      .find(row => row.pair === 'moon-self' && row.returnAt >= range.start);
  };
  const dayMoon = natalContext(time.window, birth, 160);
  const angular = natalContext(time.window, birth, 190);
  assert.deepEqual([dayMoon.natalSect, dayMoon.natalTargetHouse, dayMoon.radicalPlaceMinuteState,
    dayMoon.natalMoonNocturnalNonAngularDomicileSupport], ['day', 8, 'same_printed_minute', false]);
  assert.deepEqual([angular.natalSect, angular.natalTargetHouse, angular.natalMoonNocturnalDomicileFortitude,
    angular.natalMoonNocturnalNonAngularDomicileSupport], ['night', 7, true, false]);
  const leaving = natalContext({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) }, Date.parse('1988-05-20T17:57:48.370Z'), 190);
  assert.deepEqual([leaving.natalSect, leaving.natalTargetHouse, leaving.radicalPlaceMinuteState,
    leaving.natalTargetEssential.domicile, leaving.natalMoonNocturnalNonAngularDomicileSupport], ['night', 8, 'same_printed_minute', true, false]);
  assert.equal(leaving.natalTargetConditions.contacts.find(row => row.otherBody === 'Jupiter' && row.aspectType === 'sextile').phase, 'opening');

  const rule = fortuneKnowledge.western.rules[indices[3]];
  const scoped = { ...run, facts: [point] };
  const match = facts => matchFortuneKnowledge({ ...scoped, facts }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const confirmed = match([point]);
  assert.equal(confirmed.status, 'matched');
  assert.deepEqual(confirmed.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  assert.equal(match([{ ...point, normalizedPayload: dayMoon }]).status, 'partial');
  const wrongMinute = { ...point, normalizedPayload: { ...p, radicalPlaceMinuteState: 'different_printed_minutes' } };
  assert.equal(match([wrongMinute]).status, 'partial');
  const branch = evaluateFortuneRules('western', 'year', [point, wrongMinute]).find(row => row.knowledgeId === rule.knowledgeId)
    .confirmations.find(row => JSON.parse(row.condition).where.natalMoonNocturnalNonAngularDomicileSupport === true);
  assert.deepEqual(branch.hits, [point]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.ok(branch.sourceConditions.every(condition => prompt.includes(condition)));
  assert.doesNotMatch(prompt, /natalMoonNocturnalNonAngularDomicileWitness|1933-05-27|20:57:44/u);
});

test('Lilly p736 supports the nocturnal Moon with its own face and an actual benefic application', () => {
  const birth = Date.parse('1960-07-06T21:39:07.893Z');
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2017 } };
  const asOf = Date.UTC(2017, 10, 19);
  const reference = { snapshotId: 'lilly-nocturnal-moon-face', chart: chart(birth, 285, 35) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const time = readClientFactTime(params, batch, asOf);
  const run = bindClientFortuneRun(params, batch, time, reference.snapshotId, reference);
  validateFortuneFacts(run);
  const point = specific(run).find(({ normalizedPayload: p }) => p.pair === 'moon-self'
    && p.radicalPlaceMinuteState === 'same_printed_minute');
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.equal(p.natalMoonNocturnalEssentialSupport, true);
  assert.deepEqual([p.natalSect, p.natalTargetHouse, p.natalTargetEssential.inOwnFace, p.natalMoonNocturnalDomicileFortitude],
    ['night', 8, true, false]);
  assert.deepEqual(p.natalMoonWorkedFortitude, { bookOneLowerNet: 3, bookThreeLowerNet: 1, atLeastWorkedExample: false });
  const witness = p.natalMoonNocturnalEssentialWitness;
  assert.deepEqual([witness.dignities, witness.supporter, witness.aspect], [['face'], 'Jupiter', 'conjunction']);
  const applyAt = Date.parse(witness.exactAt);
  const moonJupiterGap = at => arc(EclipticGeoMoon(new Date(at)).lon - Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon);
  assert.ok(applyAt > birth && moonJupiterGap(applyAt - 1_000) * moonJupiterGap(applyAt) <= 0);
  const rule = fortuneKnowledge.western.rules[indices[3]];
  const match = value => matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const confirmed = match({ ...run, facts: [point] });
  assert.equal(confirmed.status, 'matched');
  assert.equal(confirmed.matchedSourceExcerpt, 'Radically');
  assert.deepEqual(confirmed.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);

  const contrast = chart(birth, 200, 35);
  const epochs = buildLillySolarReturnPositions(time.window, reference.chart);
  const dayMoon = buildLillyReturnContext(time.window, contrast, epochs).contexts.find(row => row.pair === 'moon-self'
    && row.returnAt === Date.parse(p.returnAt));
  assert.deepEqual([dayMoon.radicalPlaceMinuteState, dayMoon.natalSect, dayMoon.natalMoonNocturnalEssentialSupport],
    ['same_printed_minute', 'day', false]);
  assert.equal(match({ ...run, facts: [{ ...point, normalizedPayload: dayMoon }] }).status, 'partial');
  const wrongMinute = { ...point, normalizedPayload: { ...p, radicalPlaceMinuteState: 'different_printed_minutes' } };
  assert.equal(match({ ...run, facts: [wrongMinute] }).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.doesNotMatch(formatFortunePrompt(input), /natalMoonNocturnalEssentialWitness|1960-07-07/u);
});

test('Lilly retains established Book I supportive points at the paired Venus and Moon returns', () => {
  const cases = [
    { year: 2059, birth: '1970-05-24T04:35:11.778Z', armc: 300, returnAt: '2059-05-23T16:58:24.433Z',
      returnArmc: 205, pair: 'venus-mercury', ruleIndex: indices[2], excerpt: 'Learning',
      audit: /净值下限为18分/u, provider: /达到原书具名命例的明显强势/u },
    { year: 2055, birth: '1960-06-03T08:40:24.520Z', armc: 100, returnAt: '2055-06-03T07:49:24.023Z',
      pair: 'moon-self', ruleIndex: indices[3], excerpt: 'Radically',
      audit: /净值下限分别为4分和4分/u, provider: /出生盘的月亮达到原例所称强势的下限/u },
  ];
  for (const example of cases) {
    const { year, pair, returnArmc } = example;
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const asOf = Date.UTC(year, 9, 1), birth = Date.parse(example.birth);
    const reference = { snapshotId: 'lilly-partile-nodes-' + pair, chart: chart(birth, example.armc, 35) };
    const window = buildFactTimeContext(params, asOf, 'client').window;
    const epochs = buildLillySolarReturnPositions(window, reference.chart);
    const { returnAt } = epochs.find(row => window.start <= row.returnAt && row.returnAt < window.end);
    const locationAtArmc = armc => ({ returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) });
    const setting = returnArmc === undefined ? undefined : locationAtArmc(returnArmc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, setting)));
    const value = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(value);
    const point = specific(value).find(row => row.normalizedPayload.pair === pair && row.activeFrom === row.normalizedPayload.returnAt);
    assert.ok(point);
    assert.ok(Math.abs(returnAt - Date.parse(example.returnAt)) < 1_000);
    assert.ok(Math.abs(arc(SunPosition(new Date(birth)).elon - SunPosition(new Date(returnAt)).elon)) < 0.000001);
    const payload = point.normalizedPayload;
    assert.equal(payload.radicalPlaceMinuteState, 'same_printed_minute');
    const rule = fortuneKnowledge.western.rules[example.ruleIndex];
    const readMatch = facts => matchFortuneKnowledge({ ...value, facts }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    const matched = readMatch([point]);
    assert.equal(matched.status, 'matched');
    assert.ok(matched.matchedSourceExcerpt.includes(example.excerpt));
    assert.deepEqual(matched.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    if (pair === 'venus-mercury') {
      assert.equal(payload.returnHouse, 4);
      assert.deepEqual(payload.returnVenusFortitude, { lowerNet: 18, atLeastWorkedExample: true });
      const venus = readTransitLongitude('Venus', returnAt), jupiter = readTransitLongitude('Jupiter', returnAt);
      assert.equal(Math.floor(venus), Math.floor(jupiter));
      assert.ok(Math.abs(arc(venus - readTransitLongitude('Mercury', birth))) < 0.000001);
      assert.deepEqual(payload.returningP115.partileContacts, [{ body: 'Jupiter', aspect: 'conjunction', points: 5 }]);
      assert.equal(payload.returnVenusFortitude.lowerNet - payload.returningP115.partileContacts[0].points, 13);
      const eighthHouse = buildLillyLocatedReturn(window, reference.chart, epochs, locationAtArmc(85));
      const contrast = buildLillyReturnContext(window, reference.chart, epochs, eighthHouse).contexts
        .find(row => row.pair === pair && row.returnAt === returnAt);
      assert.equal(contrast.returnHouse, 8);
      assert.equal(contrast.radicalPlaceMinuteState, 'same_printed_minute');
      assert.deepEqual(contrast.returningP115.partileContacts, payload.returningP115.partileContacts);
      assert.equal(contrast.returnVenusAtLeastWorkedFortitude, undefined);
      assert.equal(readMatch([{ ...point, normalizedPayload: contrast }]).status, 'partial');
    } else {
      assert.equal(payload.natalTargetHouse, 12);
      assert.equal(payload.natalMoonNocturnalDomicileFortitude, false);
      assert.deepEqual(payload.natalMoonWorkedFortitude,
        { bookOneLowerNet: 4, bookThreeLowerNet: 4, atLeastWorkedExample: true });
      const moon = EclipticGeoMoon(new Date(birth)).lon;
      const ascending = payload.natalTargetP115.nodeContacts.ascending;
      assert.equal(Math.floor(moon), Math.floor(ascending.mean));
      assert.equal(Math.floor(moon), Math.floor(ascending.osculating));
      assert.equal(ascending.points, 4);
      assert.equal(payload.natalMoonWorkedFortitude.bookOneLowerNet - ascending.points, 0);
      const later = chart(birth + 3_600_000, example.armc, 35);
      const contrast = buildLillyReturnContext(window, later, buildLillySolarReturnPositions(window, later)).contexts
        .find(row => row.pair === pair && row.start === row.returnAt);
      assert.equal(contrast.radicalPlaceMinuteState, 'different_printed_minutes');
      assert.equal(contrast.natalMoonAtLeastWorkedFortitude, undefined);
      assert.equal(readMatch([{ ...point, normalizedPayload: contrast }]).status, 'partial');
    }
    const { input } = buildFortuneModelContext(value, interpretFortune(value, requestForFortuneRun(value), reference.snapshotId));
    const localAudit = formatFortuneFactAudit(input);
    assert.match(localAudit, example.audit);
    const support = pair === 'venus-mercury' ? /同度格内与木星的合相计5分/u : /升交点计4分/u;
    assert.match(localAudit, support);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, example.provider);
    assert.doesNotMatch(prompt, example.audit);
    assert.doesNotMatch(prompt, support);
    assert.doesNotMatch(prompt, /partileContacts|nodeContacts|returnVenusFortitude|natalMoonWorkedFortitude/u);
  }
});

test('Lilly’s Saturn same-sign return records the p786 mixed lunar disposition without inferring overall favour', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1999 } };
  const asOf = Date.UTC(1999, 7, 24);
  for (const [date, expected] of [['1969-05-04', false], ['1969-05-05', true]]) {
    const reference = { snapshotId: 'lilly-saturn-lunar-disposition-' + date, chart: chart(Date.parse(date + 'T12:00:00Z'), 300, 35) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const point = specific(run).find(({ normalizedPayload: p }) => p.pair === 'saturn-self' && p.returnAt.startsWith('1999-05'));
    assert.ok(point);
    const p = point.normalizedPayload, at = Date.parse(p.returnAt);
    const lunar = readTransitLongitude('Moon', at);
    assert.equal(lillyEssentialDignities('Saturn', lunar).domicile, expected);
    assert.equal(lillyEssentialDignities('Moon', readTransitLongitude('Saturn', at)).exalted, true);
    assert.equal(p.sameSign, true);
    assert.equal(p.radicalPlaceMinuteState, 'different_printed_minutes');
    assert.equal(p.saturnMoonDispositionAtReturn, expected);
    assert.ok(!p.returningConditions.receptions.some(row => row.otherBody === 'Moon' && (row.mutualHouse || row.mutualExaltation)));
    const rule = fortuneKnowledge.western.rules[indices[0]];
    const found = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(found.status, 'partial');
    assert.ok(found.sourceFactIds.includes(point.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const detail = /本次回归月亮实居土星本垣、土星实居月亮擢升座/u;
    assert.equal(detail.test(formatFortuneFactAudit(input)), expected);
    assert.doesNotMatch(formatFortunePrompt(input), /交叉处分|saturnMoonDispositionAtReturn/u);
  }
});

test('Lilly’s printed natal positions and reconstructed solar returns separate historical same-sign and close contacts', () => {
  // Book III pp. 735, 742–743 (printed longitudes), 783, 786 and 802 (narrative).
  // The historical return longitudes below are from modern ephemerides.
  const printed = { ...baseChart.western, rawResult: [{ positions: [{ planet: 'Sun', longitude: 186 + 37 / 60 }] }] };
  for (const [year, body, natalBody, natalLongitude, separation, comparison] of [
    [1644, 'Jupiter', 'Moon', 61 + 44 / 60, 0.481, 'both_columns'],
    // At p. 786, Lilly calls the same-sign Saturn return its own radical place
    // without claiming that the degrees coincide or promising a full result.
    [1645, 'Saturn', 'Saturn', 39 + 2 / 60, 6.390, 'both_columns'],
    [1652, 'Saturn', 'Mars', 120 + 54 / 60, 9.067, 'same_sign_only'],
  ]) {
    const range = { start: Date.parse(`${year}-01-01`), end: Date.parse(`${year + 1}-01-01`) };
    const epoch = buildSolarReturnPositions(range, printed).at(-1);
    assert.equal(new Date(epoch.returnAt).getUTCFullYear(), year);
    const returning = epoch.bodies.find(row => row.planet === body);
    const contact = lillyRadicalPlaceContact(body, returning.longitude, natalBody, natalLongitude);
    assert.ok(Math.abs(contact.longitudeSeparation - separation) < 0.002);
    assert.equal(contact.sameSign, true);
    assert.equal(contact.sameDegreeCell, year === 1644);
    assert.equal(lillyRadicalPlaceMinute(natalLongitude, [returning.longitude]), 'different_printed_minutes');
    assert.equal(contact.placeComparison, comparison);
    assert.equal(contact.radicalPlaceCandidate, true);
  }
});

test('Lilly locates the return Fortune from radical luminaries without changing a supported Saturn return', () => {
  // Book III pp.735–736, with the natal Moon recovered from p.743.
  const printedSun = 186 + 37 / 60, printedMoon = 61 + 44 / 60, printedAscendant = 90 + 32 / 60;
  assert.ok(Math.abs(lillyRevolutionFortune(printedSun, printedMoon, printedAscendant) - (325 + 39 / 60)) < 1e-9);

  const birth = Date.parse('1921-11-04T09:37:05.134Z'), natal = chart(birth, 300, 35);
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1980 } };
  const now = Date.UTC(1980, 11, 1), reference = { snapshotId: 'lilly-saturn-revolution-fortune', chart: natal };
  const range = buildFactTimeContext(params, now, 'client').window;
  const epochs = buildLillySolarReturnPositions(range, natal);
  const { returnAt } = epochs.find(row => row.returnAt >= range.start);
  const time = MakeTime(new Date(returnAt)), latitude = 60, obliquity = e_tilt(time).tobl;
  const locationAt = armc => ({ returnAt, latitude, longitude: arc(armc - SiderealTime(time) * 15) });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, locationAt(284))));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const point = specific(bound).find(({ normalizedPayload: p }) => p.pair === 'saturn-self' && Date.parse(p.returnAt) === returnAt);
  assert.ok(point);
  const p = point.normalizedPayload;
  const fortuneProfile = 'lilly-book-three-p736-radical-luminaries-return-fortune-v1';
  assert.deepEqual([p.saturnSupportedReturn, p.returnHouse, p.returnFortuneProfile, p.returnFortuneHouse], [true, 6, fortuneProfile, 4]);
  const [sun, natalMoon] = [readTransitLongitude('Sun', birth), readTransitLongitude('Moon', birth)];
  const returnMoon = readTransitLongitude('Moon', returnAt);
  const cuspsAt = armc => calculateHouseCusps(armc, latitude, obliquity, 'regiomontanus').cusps;
  const cusps = cuspsAt(284);
  assert.deepEqual([zodiacalHouse(normalize(cusps[0] + natalMoon - sun), cusps),
    zodiacalHouse(normalize(cusps[0] + returnMoon - sun), cusps)], [4, 12]);
  const contextAt = location => buildLillyReturnContext(range, natal, epochs, buildLillyLocatedReturn(range, natal, epochs, location))
    .contexts.find(row => row.pair === 'saturn-self' && row.returnAt === returnAt);
  const outside = contextAt(locationAt(282));
  assert.deepEqual([outside.returnHouse, outside.saturnSupportedReturn, outside.returnFortuneHouse], [6, true, 3]);
  assert.equal(contextAt(undefined).returnFortuneHouse, undefined);
  const gap = armc => {
    const cusps = cuspsAt(armc);
    return arc(cusps[0] + natalMoon - sun - cusps[3]);
  };
  let low = 282, high = 284;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (gap(middle) < 0) low = middle;
    else high = middle;
  }
  assert.ok(Math.abs(gap(high)) < 1e-7);
  const boundary = contextAt(locationAt(high));
  assert.equal(boundary.returnFortuneHouse, undefined);

  const rule = fortuneKnowledge.western.rules[indices[0]];
  const outsideFact = { ...point, normalizedPayload: { ...p, returnFortuneHouse: outside.returnFortuneHouse } };
  const query = evaluateFortuneRules('western', 'year', [point, outsideFact]).find(row => row.knowledgeId === rule.knowledgeId)
    .confirmations.find(row => JSON.parse(row.condition).where.returnFortuneHouse === 4);
  assert.deepEqual(query.hits, [point]);
  const scoped = { ...bound, facts: [point] };
  const matched = matchFortuneKnowledge(scoped).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(matched.status, 'matched');
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const provider = formatFortunePrompt(input);
  assert.ok(query.sourceConditions.every(condition => provider.includes(condition)));
  assert.doesNotMatch(provider, /returnFortuneHouse|returnFortuneProfile|1980-11-03T17:07|latitude|longitude/u);
});

test('Lilly confirms a supported Saturn return and strengthens only the actual tenth-house branch', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1980 } };
  const asOf = Date.UTC(1980, 11, 1);
  const range = { start: Date.UTC(1980, 0, 1), end: Date.UTC(1981, 0, 1) };
  const birth = Date.parse('1921-11-04T09:37:05.134Z');
  const reference = { snapshotId: 'lilly-saturn-return-support', chart: chart(birth, 300, 35) };
  const returnFrame = snapshot => {
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const time = MakeTime(new Date(returnAt));
    const saturn = readTransitLongitude('Saturn', returnAt);
    const locationAtOffset = offset => {
      const longitude = (saturn + offset) * rad;
      const meridian = Math.atan2(Math.sin(longitude) * Math.cos(e_tilt(time).tobl * rad), Math.cos(longitude)) / rad;
      return { returnAt, latitude: 35, longitude: arc(meridian - SiderealTime(time) * 15) };
    };
    return { epochs, returnAt, locationAtOffset };
  };
  const actual = returnFrame(reference.chart);
  assert.ok(Math.abs(actual.returnAt - Date.parse('1980-11-03T17:07:44.462Z')) < 1_000);
  const location = actual.locationAtOffset(-8);
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const rule = fortuneKnowledge.western.rules[indices[0]];
  const readMatch = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  const selectSaturn = (snapshot, frame, returnLocation) => buildLillyReturnContext(range, snapshot, frame.epochs,
    buildLillyLocatedReturn(range, snapshot, frame.epochs, returnLocation)).contexts
    .find(row => row.pair === 'saturn-self' && row.returnAt === frame.returnAt);
  const point = specific(bound).find(row => row.normalizedPayload.saturnSupportedReturn);
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.deepEqual([p.returnHouse, p.returningEssential.exalted, p.sameSign, p.placeComparison],
    [10, true, true, 'both_columns']);
  assert.deepEqual(p.saturnSupportedReturnContact, { body: 'Venus', aspect: 'conjunction', points: 5 });
  assert.ok(Math.abs(arc(readTransitLongitude('Venus', actual.returnAt) - readTransitLongitude('Saturn', actual.returnAt))) < 0.000001);
  const result = readMatch(bound);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, 'be well affected');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  assert.match(result.matchedConditions.join(''), /实居该次回归的第十宫/u);
  const withFact = fact => readMatch({ ...bound, facts: [{ ...point, normalizedPayload: fact }] });
  for (const offset of [undefined, 0, 4, 5, 8]) {
    const other = selectSaturn(reference.chart, actual, offset === undefined ? undefined : actual.locationAtOffset(offset));
    const comparison = withFact(other);
    assert.equal(comparison.status, [4, 8].includes(offset) ? 'matched' : 'partial');
    if ([4, 8].includes(offset)) {
      assert.equal(other.returnHouse, 9);
      assert.equal(other.saturnSupportedReturn, true);
      assert.equal(other.saturnMidheavenApproachStatus, offset === 4 ? 'within-five-before' : 'outside-five-before');
      assert.doesNotMatch(comparison.matchedConditions.join(''), /第十宫/u);
      assert.deepEqual(comparison.windows, result.windows);
    }
    if (offset === 5) assert.equal(other.saturnMidheavenApproachStatus, 'boundary');
  }
  const later = chart(birth + 10_800_000, 300, 35);
  const laterFrame = returnFrame(later);
  const near = selectSaturn(later, laterFrame, laterFrame.locationAtOffset(-8));
  assert.equal(near.returnHouse, 10);
  assert.equal(near.sameSign, true);
  assert.equal(near.saturnSupportedReturn, undefined);
  assert.equal(withFact(near).status, 'partial');
  const earlier = chart(birth - 7_200_000, 300, 35);
  const earlierFrame = returnFrame(earlier);
  const earlierLocation = earlierFrame.locationAtOffset(-8);
  const earlierReference = { snapshotId: 'lilly-saturn-applying-venus', chart: earlier };
  const earlierBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, earlierReference, earlierLocation)));
  const earlierBound = bindClientFortuneRun(params, earlierBatch, readClientFactTime(params, earlierBatch, asOf),
    earlierReference.snapshotId, earlierReference);
  validateFortuneFacts(earlierBound);
  const applyingPoint = specific(earlierBound).find(({ normalizedPayload: row }) => row.pair === 'saturn-self'
    && row.returnAt === new Date(earlierFrame.returnAt).toISOString());
  assert.ok(applyingPoint);
  const applying = applyingPoint.normalizedPayload;
  assert.deepEqual([applying.returnHouse, applying.saturnSupportedReturn, applying.saturnApplyingReturnSupport], [10, undefined, true]);
  assert.deepEqual([applying.saturnApplyingReturnWitness.supporter, applying.saturnApplyingReturnWitness.aspect], ['Venus', 'conjunction']);
  const exactAt = Date.parse(applying.saturnApplyingReturnWitness.exactAt);
  assert.ok(exactAt > earlierFrame.returnAt && Math.abs(exactAt - actual.returnAt) < 1_000);
  const venusSaturnGap = at => arc(readTransitLongitude('Venus', at) - readTransitLongitude('Saturn', at));
  assert.ok(venusSaturnGap(exactAt - 1_000) * venusSaturnGap(exactAt) <= 0);
  const applyingMatch = readMatch({ ...earlierBound, facts: [applyingPoint] });
  assert.deepEqual([applyingMatch.status, applyingMatch.matchedSourceExcerpt], ['matched', 'be well affected']);
  assert.deepEqual(applyingMatch.windows, [{ start: applyingPoint.activeFrom, endExclusive: applyingPoint.activeTo }]);
  const after = chart(birth + 7_200_000, 300, 35);
  const afterFrame = returnFrame(after);
  const afterContact = selectSaturn(after, afterFrame, afterFrame.locationAtOffset(-8));
  assert.equal(afterContact.returningConditions.contacts.find(row => row.otherBody === 'Venus').phase, 'opening');
  assert.equal(afterContact.saturnApplyingReturnSupport, false);
  assert.equal(withFact(afterContact).status, 'partial');
  assert.equal(withFact({ ...p, returnHorizonContrast: 'radix-below-return-above' }).status, 'excluded');
  const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /回归土星与同盘金星按角分核成合相/u);
  assert.match(formatFortunePrompt(input), /原书据此强调名位与职责主题/u);
  assert.doesNotMatch(formatFortunePrompt(input), /saturnSupportedReturn|回归土星与同盘金星按角分核成|1921-11-04/u);
});

test('Lilly confirms a returning Saturn in the tenth when the mutual domicile trine really perfects', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1971 } };
  const asOf = Date.UTC(1971, 11, 1), baseBirth = Date.parse('1942-02-20T13:51:47.321Z');
  const range = buildFactTimeContext(params, asOf, 'client').window;
  const frame = offset => {
    const natal = chart(baseBirth + offset * 3_600_000, 300, 35);
    const epochs = buildLillySolarReturnPositions(range, natal);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const location = { returnAt, latitude: 35, longitude: arc(32 - SiderealTime(new Date(returnAt)) * 15) };
    return { natal, epochs, returnAt, location };
  };
  const approaching = frame(-1);
  const reference = { snapshotId: 'lilly-saturn-applying-trine-venus', chart: approaching.natal };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, approaching.location)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const point = specific(bound).find(({ normalizedPayload: p }) => p.pair === 'saturn-self' && Date.parse(p.returnAt) === approaching.returnAt);
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.deepEqual([p.saturnApplyingReturnTrineSupport, p.saturnApplyingReturnSupport, p.saturnSupportedReturn,
    p.returnHouse, p.placeComparison], [true, false, undefined, 10, 'both_columns']);
  assert.ok(p.returningConditions.receptions.some(row => row.otherBody === 'Venus' && row.mutualHouse));
  const witness = p.saturnApplyingReturnWitness;
  assert.deepEqual([witness.supporter, witness.aspect], ['Venus', 'trine']);
  const gap = at => Math.abs(arc(readTransitLongitude('Venus', at) - readTransitLongitude('Saturn', at))) - 120;
  const exact = Date.parse(witness.exactAt);
  assert.ok(exact > approaching.returnAt && Math.abs(exact - Date.parse('1971-02-20T14:32:20.141Z')) < 1_000);
  assert.ok(Math.abs(gap(approaching.returnAt)) > 0.04 && gap(exact - 1_000) * gap(exact + 1_000) < 0);
  const following = frame(1);
  const other = buildLillyReturnContext(range, following.natal, following.epochs,
    buildLillyLocatedReturn(range, following.natal, following.epochs, following.location)).contexts
    .find(row => row.pair === 'saturn-self' && row.returnAt === following.returnAt);
  assert.equal(other.returnHouse, 10);
  assert.ok(other.returningConditions.receptions.some(row => row.otherBody === 'Venus' && row.mutualHouse));
  assert.equal(other.returningConditions.contacts.find(row => row.otherBody === 'Venus' && row.aspectType === 'trine').phase, 'opening');
  assert.equal(other.saturnApplyingReturnTrineSupport, false);
  const rule = fortuneKnowledge.western.rules[indices[0]];
  const scoped = { ...bound, facts: [point] };
  const match = facts => matchFortuneKnowledge({ ...scoped, facts }).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(match([point]).status, 'matched');
  assert.equal(match([{ ...point, normalizedPayload: other }]).status, 'partial');
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const audit = /回归土星与同盘金星在同度格趋近三分相，换座前的实际成相已复算/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /三分/u);
  assert.doesNotMatch(prompt, audit);
  assert.doesNotMatch(prompt, /saturnApplyingReturn(TrineSupport|Witness)|1971-02-20T14:32/u);
});

test('Lilly confirms a swift tenth-house Saturn return only while the same-chart benefic sextile is applying', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1982 } };
  const asOf = Date.UTC(1982, 11, 1), birth = Date.parse('1953-08-30T07:56:27.466Z');
  const range = buildFactTimeContext(params, asOf, 'client').window;
  const setup = (offset, armc) => {
    const natal = chart(birth + offset * 3_600_000, 300, 35);
    const epochs = buildLillySolarReturnPositions(range, natal);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const location = { returnAt, latitude: 35, longitude: arc(armc - SiderealTime(new Date(returnAt)) * 15) };
    return { natal, epochs, returnAt, location };
  };
  const before = setup(0, 190);
  const reference = { snapshotId: 'lilly-saturn-applying-sextile-venus', chart: before.natal };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, before.location)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const point = specific(bound).find(({ normalizedPayload: p }) => p.pair === 'saturn-self' && Date.parse(p.returnAt) === before.returnAt);
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.equal(p.returnHouse, 10);
  assert.equal(p.returnHorizonContrast, 'different-configuration');
  assert.equal(p.placeComparison, 'both_columns');
  assert.ok(p.returningEssential.exalted);
  assert.equal(p.returningConditions.motion, 'direct');
  assert.equal(p.returningConditions.magnitudeComparedToMean, 'faster');
  assert.deepEqual([p.saturnApplyingReturnSupport, p.saturnApplyingReturnTrineSupport, p.saturnApplyingReturnSextileSupport,
    p.saturnSupportedReturn], [false, false, true, undefined]);
  const witness = p.saturnApplyingReturnWitness;
  assert.deepEqual([witness.supporter, witness.aspect], ['Venus', 'sextile']);
  const exactAt = Date.parse(witness.exactAt);
  const gap = at => Math.abs(arc(readTransitLongitude('Venus', at) - readTransitLongitude('Saturn', at))) - 60;
  assert.ok(Math.abs(exactAt - Date.parse('1982-08-30T09:25:14Z')) < 2_000);
  assert.ok(exactAt > before.returnAt && gap(before.returnAt) > 0.04 && gap(exactAt - 1_000) * gap(exactAt + 1_000) < 0);

  const scoped = { ...bound, facts: [point] };
  const isRule = row => row.knowledgeId === fortuneKnowledge.western.rules[indices[0]].knowledgeId;
  const match = points => matchFortuneKnowledge({ ...scoped, facts: points }).byMethod.western.find(isRule);
  assert.equal(match([point]).status, 'matched');
  for (const [offset, armc, house, phase] of [[2, 190, 10, 'opening'], [0, 200, 9, 'closing']]) {
    const frame = setup(offset, armc);
    const located = buildLillyLocatedReturn(range, frame.natal, frame.epochs, frame.location);
    const other = buildLillyReturnContext(range, frame.natal, frame.epochs, located).contexts
      .find(row => row.pair === 'saturn-self' && row.returnAt === frame.returnAt);
    assert.equal(other.returnHouse, house);
    assert.equal(other.returnHorizonContrast, p.returnHorizonContrast);
    assert.equal(other.returningConditions.contacts.find(row => row.otherBody === 'Venus' && row.aspectType === 'sextile').phase, phase);
    assert.equal(other.saturnApplyingReturnSextileSupport, false);
    assert.equal(match([{ ...point, normalizedPayload: other }]).status, 'partial');
  }
  const slowRange = { start: Date.UTC(2019, 0, 1), end: Date.UTC(2020, 0, 1) };
  const slowNatal = chart(Date.parse('1989-04-12T07:49:03.763Z'), 300, 35);
  const slowEpochs = buildLillySolarReturnPositions(slowRange, slowNatal);
  const slowReturn = slowEpochs.find(row => row.returnAt >= slowRange.start).returnAt;
  const slowLocation = { returnAt: slowReturn, latitude: 35, longitude: arc(280 - SiderealTime(new Date(slowReturn)) * 15) };
  const slow = buildLillyReturnContext(slowRange, slowNatal, slowEpochs,
    buildLillyLocatedReturn(slowRange, slowNatal, slowEpochs, slowLocation)).contexts
    .find(row => row.pair === 'saturn-self' && row.returnAt === slowReturn);
  assert.deepEqual([slow.returnHouse, slow.placeComparison, slow.returnHorizonContrast], [10, 'both_columns', 'different-configuration']);
  assert.ok(slow.returningEssential.domicile);
  assert.equal(slow.returningConditions.motion, 'direct');
  assert.equal(slow.returningConditions.magnitudeComparedToMean, 'slower');
  assert.equal(slow.returningConditions.contacts.find(row => row.otherBody === 'Venus' && row.aspectType === 'sextile').application.status, 'exact');
  assert.equal(slow.saturnApplyingReturnSextileSupport, false);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const audit = /同盘金星在同度格趋近六合相，换座前的实际成相已复算/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /木星或金星正在与土星形成六合/u);
  assert.doesNotMatch(prompt, /saturnApplyingReturnSextileSupport|1982-08-30T09:25:15/u);
  assert.doesNotMatch(prompt, audit);
});

test('Lilly confirms a Saturn return only when the mutual domicile and benefic angle are both verified', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1971 } };
  const asOf = Date.UTC(1971, 11, 1), birth = Date.parse('1942-02-20T13:51:47.321Z');
  const range = buildFactTimeContext(params, asOf, 'client').window;
  const frame = snapshot => {
    const epochs = buildLillySolarReturnPositions(range, snapshot);
    const { returnAt } = epochs.find(row => row.returnAt >= range.start);
    const location = { returnAt, latitude: 35, longitude: arc(32 - SiderealTime(new Date(returnAt)) * 15) };
    return { epochs, location, returnAt };
  };
  const reference = { snapshotId: 'lilly-saturn-mutual-domicile', chart: chart(birth, 300, 35) };
  const { location, returnAt } = frame(reference.chart);
  assert.equal(new Date(returnAt).toISOString(), '1971-02-20T14:32:19.860Z');
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference, location)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(bound);
  const witness = specific(bound).find(row => row.normalizedPayload.saturnSupportedReturn);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  const saturn = readTransitLongitude('Saturn', returnAt), venus = readTransitLongitude('Venus', returnAt);
  assert.deepEqual([Math.floor(saturn / 30), Math.floor(venus / 30)], [1, 9]);
  assert.ok(Math.abs(Math.abs(arc(venus - saturn)) - 120) < 0.000001);
  const rootDifference = Math.abs(arc(saturn - readTransitLongitude('Saturn', birth)));
  assert.ok(rootDifference > 5.60 && rootDifference < 5.61);
  assert.deepEqual([p.returnHouse, p.sameSign, p.placeComparison, p.returningEssential.domicile, p.returningEssential.exalted],
    [10, true, 'both_columns', false, false]);
  assert.ok(p.returningConditions.receptions.some(row => row.otherBody === 'Venus' && row.mutualHouse));
  assert.deepEqual(p.saturnSupportedReturnContact, { body: 'Venus', aspect: 'trine', points: 4 });
  const rule = fortuneKnowledge.western.rules[indices[0]];
  const match = fact => matchFortuneKnowledge({ ...bound, facts: [{ ...witness, normalizedPayload: fact }] }).byMethod.western
    .find(row => row.knowledgeId === rule.knowledgeId);
  const result = match(p);
  assert.deepEqual([result.status, result.matchedSourceExcerpt], ['matched', 'be well affected']);
  assert.match(result.matchedConditions.join(''), /实居该次回归的第十宫/u);
  assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), reference.snapshotId));
  const reception = /同次回归土星与金星互入守护座，按原表计5分/u;
  assert.match(formatFortuneFactAudit(input), reception);
  assert.doesNotMatch(formatFortunePrompt(input), reception);
  const near = chart(birth + 3 * 3_600_000, 300, 35), next = frame(near);
  const point = buildLillyReturnContext(range, near, next.epochs,
    buildLillyLocatedReturn(range, near, next.epochs, next.location)).contexts
    .find(row => row.pair === 'saturn-self' && row.returnAt === next.returnAt);
  assert.equal(point.returnHouse, 10);
  assert.equal(point.placeComparison, 'both_columns');
  assert.ok(point.returningConditions.receptions.some(row => row.otherBody === 'Venus' && row.mutualHouse));
  assert.equal(point.saturnSupportedReturn, undefined);
  assert.equal(match(point).status, 'partial');
});

test('Lilly page 115 assigns separate printed points from the same eligible chart', () => {
  const positions = [
    ['Saturn', 39 + 2 / 60, -0.02], ['Jupiter', 261 + 55 / 60, 0.1], ['Mars', 120.9, 0.6],
    ['Sun', 186 + 37 / 60, 1], ['Venus', 186.85, 1.1], ['Mercury', 183 + 34 / 60, 1.2], ['Moon', 61 + 44 / 60, 14],
  ].map(([body, longitude, speed]) => ({ body, longitude, speed }));
  const read = (body, house, epoch = positions) => lillyP115Points(lillyEssentialDignities(body,
    epoch.find(row => row.body === body).longitude, 'day'), lillyPlanetConditions(body, epoch, house, undefined, 'day'));
  const saturn = read('Saturn', 3);
  assert.deepEqual(saturn.points, { domicile: 0, exaltation: 0, triplicity: 0, term: 0, face: 0,
    detriment: 0, fall: 0, peregrine: -5, house: 1, direction: -5, speed: -2, solar: 5,
    orientation: 2, moonLight: 0, besiegement: 0 });
  assert.deepEqual([saturn.fortitudes, saturn.debilities], [8, 12]);
  const moon = read('Moon', 5);
  assert.deepEqual([moon.fortitudes, moon.debilities, moon.points.moonLight, moon.points.direction], [10, 7, -2, 0]);
  assert.deepEqual(lillyP745NatalMoonBalance(moon, 5), {
    profile: 'lilly-book-three-p745-natal-moon-v1', fortitudes: 10, debilities: 7, net: 3,
  });
  const moonInEighth = read('Moon', 8);
  assert.equal(lillyP745NatalMoonBalance(moonInEighth, 8).debilities, moonInEighth.debilities + 2);
  assert.equal(lillyP745NatalMoonBalance(moonInEighth, 8).net, -4);
  assert.equal(read('Saturn').points.house, undefined);
  assert.equal(read('Venus', 8).points.house, -2);
  assert.equal(read('Venus', 8).points.solar, 5);
  assert.equal(read('Jupiter', 12).points.orientation, -2);
  assert.deepEqual(read('Sun', 8).partileContacts, [{ body: 'Venus', aspect: 'conjunction', points: 5 }]);
  const nearbyDegree = positions.map(row => row.body === 'Venus' ? { ...row, longitude: 187.005 } : row);
  assert.deepEqual(read('Sun', 8, nearbyDegree).partileContacts, []);
  const enclosing = positions.map(row => ({ ...row,
    longitude: { Sun: 21, Saturn: 15, Mars: 10, Venus: 13 }[row.body] ?? row.longitude }));
  assert.equal(read('Venus', 8, enclosing).points.besiegement, -5);
});

test('Lilly page 115 compares mean and osculating lunar nodes on the same chart epoch', () => {
  const findAscending = iso => {
    const next = SearchMoonNode(new Date(iso));
    return next.kind === NodeEventKind.Ascending ? next : NextMoonNode(next);
  };
  const exact = findAscending('2000-01-01T12:00:00Z');
  const distinct = findAscending('2026-01-01T00:00:00Z');
  for (const row of [exact, distinct]) {
    const nodes = lillyLunarNodes(row.time.date.getTime());
    assert.ok(Math.abs(arc(nodes.ascending.osculating - EclipticGeoMoon(row.time).lon)) < 0.0001);
    for (const mode of ['mean', 'osculating']) assert.ok(Math.abs(Math.abs(arc(nodes.ascending[mode] - nodes.descending[mode])) - 180) < 1e-8);
  }

  const snapshot = chart(exact.time.date.getTime());
  const calculated = buildLillyReturnContext(window, snapshot, buildSolarReturnPositions(window, snapshot.western)).contexts;
  const moon = calculated.find(pair => pair.pair === 'moon-self');
  assert.equal(moon.natalTargetP115.nodeContacts.ascending.points, 4);
  assert.equal(moon.natalTargetP115.nodeContacts.descending.points, 0);
  assert.equal(moon.returningP115, undefined);
  const saturn = calculated.find(pair => pair.pair === 'saturn-self');
  const atReturn = lillyLunarNodes(saturn.returnAt);
  assert.equal(saturn.returningP115.nodeContacts.ascending.mean, atReturn.ascending.mean);
  assert.equal(saturn.returningP115.nodeContacts.ascending.osculating, atReturn.ascending.osculating);

  const nodes = lillyLunarNodes(distinct.time.date.getTime());
  const positions = chart(distinct.time.date.getTime()).western.rawResult[0].positions
    .filter(row => lillyEssentialPolicy.planets.includes(row.planet)).map(row => ({ body: row.planet, longitude: row.longitude, speed: 1 }));
  const moonPosition = positions.find(row => row.body === 'Moon').longitude;
  const disagrees = lillyP115Points(lillyEssentialDignities('Moon', moonPosition), lillyPlanetConditions('Moon', positions), nodes);
  assert.equal(disagrees.nodeContacts.ascending.osculatingConjunction, true);
  assert.equal(disagrees.nodeContacts.ascending.meanConjunction, false);
  assert.equal(disagrees.nodeContacts.ascending.points, undefined);
  const south = lillyLunarNodes(exact.time.date.getTime());
  const aligned = positions.map(row => row.body === 'Moon' ? { ...row, longitude: south.descending.osculating } : row);
  const southScore = lillyP115Points(lillyEssentialDignities('Moon', south.descending.osculating),
    lillyPlanetConditions('Moon', aligned), south);
  assert.equal(southScore.nodeContacts.descending.points, -4);
  assert.match(describeFortuneFact({ method: 'western', type: 'lilly_return_context', data: moon }, String), /升交点计4分/u);
});

test('Lilly page 115 uses the star of date, with separate Algol and exact Regulus or Spica criteria', () => {
  const historic = lillyFixedStarPositions(Date.parse('1647-01-01T00:00:00Z'));
  const at = Date.parse('2026-01-01T00:00:00Z');
  const current = lillyFixedStarPositions(at);
  assert.deepEqual(current.map(row => row.star), ['Regulus', 'Spica', 'Algol']);
  assert.ok(current.every((row, index) => row.longitude - historic[index].longitude > 5));
  assert.equal(Math.floor(historic[0].longitude / 30), 4);
  assert.equal(Math.floor(current[0].longitude / 30), 5);
  const algol = current.find(row => row.star === 'Algol');
  const positions = chart(at).western.rawResult[0].positions
    .filter(row => lillyEssentialPolicy.planets.includes(row.planet))
    .map(row => ({ body: row.planet, longitude: row.longitude, speed: 1 }));
  const score = longitude => {
    const positionsWithSaturn = positions.map(row => row.body === 'Saturn' ? { ...row, longitude } : row);
    const conditions = lillyPlanetConditions('Saturn', positionsWithSaturn);
    const essential = lillyEssentialDignities('Saturn', longitude);
    return lillyP115Points(essential, conditions, undefined, current);
  };
  for (const sign of [-1, 1]) {
    assert.equal(score(algol.longitude + sign * 4.9999).fixedStarContacts[2].points, -5);
    assert.equal(score(algol.longitude + sign * 5.0001).fixedStarContacts[2].points, 0);
  }
  for (const [index, points] of [[0, 6], [1, 5]]) {
    const longitude = current[index].longitude;
    const exact = score(longitude).fixedStarContacts[index];
    assert.equal(exact.samePrintedMinute, true);
    assert.equal(exact.points, points);
    const near = longitude % 1 < 0.5 ? longitude + 0.24 : longitude - 0.24;
    const broad = score(near).fixedStarContacts[index];
    assert.equal(broad.sameDegree, true);
    assert.equal(broad.samePrintedMinute, false);
    assert.equal(broad.points, undefined);
  }
  const sample = contexts().contexts.find(row => row.pair === 'saturn-self');
  const byReturn = lillyFixedStarPositions(sample.returnAt);
  assert.deepEqual(sample.returningP115.fixedStarContacts.map(row => row.longitude), byReturn.map(row => row.longitude));
  for (const [birth, year, pair, star, points] of [
    ['1982-11-15T00:45:38.589Z', 2011, 'saturn-self', 'Spica', 5],
    ['2004-08-05T09:52:08.294Z', 2024, 'venus-mercury', 'Regulus', 6],
  ]) {
    const snapshot = chart(Date.parse(birth));
    const yearWindow = { start: Date.UTC(year, 0), end: Date.UTC(year + 1, 0) };
    const annual = buildLillySolarReturnPositions(yearWindow, snapshot);
    const returning = buildLillyReturnContext(yearWindow, snapshot, annual).contexts
      .find(row => row.pair === pair && row.start === row.returnAt);
    assert.ok(returning?.radicalPlaceCandidate);
    const contact = returning.returningP115.fixedStarContacts.find(row => row.star === star);
    assert.ok(contact.separation < 0.000001);
    assert.equal(contact.points, points);
    assert.equal(returning.natalTargetP115, undefined);
  }
});

test('Lilly actual lunar natal star points follow the paired return through SQLite and stay in local audit', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z');
  const time = buildFactTimeContext(params, asOf, 'server');
  const rule = fortuneKnowledge.western.rules[indices[3]];
  for (const [birth, star, points, text] of [
    ['1969-01-07T13:32:13.069Z', 'Regulus', 6, '轩辕十四'],
    ['1961-01-10T09:49:55.529Z', 'Spica', 5, '角宿一'],
  ]) {
    const at = Date.parse(birth);
    const natalMoon = EclipticGeoMoon(new Date(at)).lon;
    const starAtBirth = lillyFixedStarPositions(at).find(row => row.star === star);
    assert.ok(Math.abs(arc(natalMoon - starAtBirth.longitude)) < 0.000001);
    const runId = 'lilly-natal-fixed-star-' + star;
    const value = calculateFortuneFacts(params, time, runId, { snapshotId: runId, chart: chart(at) });
    validateFortuneFacts(value);
    const result = matchFortuneKnowledge(value).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(result.status, 'partial');
    const fact = specific(value).find(row => result.sourceFactIds.includes(row.factId)
      && row.activeFrom === row.normalizedPayload.returnAt);
    assert.ok(fact);
    assert.equal(fact.normalizedPayload.natalTargetP115.fixedStarContacts.find(row => row.star === star).points, points);
    assert.equal(fact.normalizedPayload.returningP115, undefined);
    const balance = fact.normalizedPayload.natalMoonP745Balance;
    assert.equal(balance.net, balance.fortitudes - balance.debilities);
    assert.equal(balance.debilities, fact.normalizedPayload.natalTargetP115.debilities
      + (fact.normalizedPayload.natalTargetHouse === 8 ? 2 : 0));
    const report = interpretFortune(value, requestForFortuneRun(value), runId + '-report');
    const { input } = buildFortuneModelContext(value, report);
    const phrase = new RegExp(text + '同一星座、同一最近角分，按原表计' + points + '分', 'u');
    assert.match(formatFortuneFactAudit(input), phrase);
    assert.match(formatFortuneFactAudit(input), /按第三卷命例相减，本命月亮已核分项净值为/u);
    assert.doesNotMatch(formatFortunePrompt(input), phrase);
    assert.doesNotMatch(formatFortunePrompt(input), /本命月亮已核分项净值/u);
  }
});

test('SQLite rules require a relevant pair and geometry while retaining their unresolved conjunction and condition premises', () => {
  const value = run(); validateFortuneFacts(value); const facts = specific(value); assert.equal(facts.length, 8);
  const negative = matchFortuneKnowledge(value).byMethod.western;
  for (const [index, year, count] of [[indices[0], 2019, 2], [indices[1], 2024, 1], [indices[2], 2019, 1], [indices[3], 2028, 1]]) {
    const rule = fortuneKnowledge.western.rules[index];
    assert.equal(negative.find(m => m.knowledgeId === rule.knowledgeId).status, 'not_matched');
    const positive = run(year), match = matchFortuneKnowledge(positive).byMethod.western.find(m => m.knowledgeId === rule.knowledgeId);
    const compatible = specific(positive).filter(f => f.normalizedPayload.pair === rule.queries[0].where.pair && f.normalizedPayload.radicalPlaceCandidate);
    assert.equal(compatible.length, count);
    if (index === indices[1]) {
      assert.equal(match.status, 'not_matched');
      assert.ok(compatible.every(fact => fact.normalizedPayload.radicalPlaceMinuteMatch === false));
      assert.deepEqual(match.sourceFactIds, []);
      const { input } = buildFortuneModelContext(positive, interpretFortune(positive, requestForFortuneRun(positive), 'lilly-near-minute'));
      assert.match(formatFortuneFactAudit(input), /不等于原书同度已经成立/u);
      assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== rule.knowledgeId)));
    } else {
      assert.equal(match.status, 'partial');
      assert.deepEqual(match.sourceFactIds, compatible.map(f => f.factId));
      assert.equal(match.windows[0].start, compatible[0].activeFrom);
      assert.equal(match.windows.at(-1).endExclusive, compatible.at(-1).activeTo);
    }
    const withoutVerifiedEpoch = compatible.map(fact => ({ ...fact, normalizedPayload: {
      ...fact.normalizedPayload, returnEpochBasis: 'rounded-display-sun', returnHorizonContrast: 'radix-below-return-above',
    } }));
    const invalid = evaluateFortuneRules('western', 'year', withoutVerifiedEpoch)
      .find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(invalid.required[0].hits.length, 0);
    assert.ok(invalid.exclusions.every(query => query.hits.length === 0));
  }
  for (const f of facts) assert.ok(f.sourceFactIds.every(id => value.rawFacts.some(r => r.rawFactId === id && r.method === 'western')));
  const changed = structuredClone(run(2019)); specific(changed).forEach(f => { f.normalizedPayload.pair = 'unrelated-pair'; });
  assert.ok(matchFortuneKnowledge(changed).byMethod.western.filter(m => indices.some(i => m.knowledgeId === fortuneKnowledge.western.rules[i].knowledgeId)).every(m => m.status === 'not_matched'));
});

test('all relevant return pairs are projected into Chinese, while source-incomplete passages and raw machine fields remain out of matched evidence', () => {
  const value = run(2019), { input } = buildFortuneModelContext(value, interpretFortune(value, requestForFortuneRun(value), 'lilly-prompt'));
  assert.equal(input.facts.filter(f => f.type === 'lilly_return_context').length, 3);
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['同一次太阳回归', '不等于原书同度已经成立', '不默认拿出生地点代替', '本质表不代替偶然状态',
    '两列距离比较均超出', '实际距离在两列参考范围内']) assert.ok(prompt.includes(phrase), phrase);
  assert.ok(input.sections.every(s => s.findings.every(f => !indices.some(i => f.knowledgeId === fortuneKnowledge.western.rules[i].knowledgeId))));
  assert.match(prompt, /回归(?:土星|金星)按 Lilly 第一卷第115页已核分项，助力小计/u);
  assert.match(prompt, /回归土星与同盘太阳的对反照点在同一度格/u);
  assert.doesNotMatch(formatFortunePrompt(input), /第115页已核分项|returningP115|natalTargetP115|对反照点|antiscionContacts/u);
  for (const key of ['lilly_return_context', 'returningEssential', 'termStatus', 'sourceOrbStatus', 'lilly-return-run', 'placeComparison', 'https://']) assert.ok(!prompt.includes(key), key);
  const standalone = describeFortuneFact({ method: 'western', type: 'lilly_return_context', data: { ...input.facts.find(f => f.type === 'lilly_return_context').data,
    returningEssential: lillyEssentialDignities('Saturn', 53) } }, String);
  assert.match(standalone, /二十度与二十六度差异/u); assert.ok(!/[{}\[\]]|taurus-endpoint/u.test(standalone));
});

test('the Moon return uses a reflected benefic in the natal chart at its actual epoch', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const now = Date.parse('2026-01-12T04:00:00Z'), birth = Date.parse('1987-01-21T04:00:00Z');
  const source = { chart: chart(birth), snapshotId: 'lilly-moon-antiscion' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, source)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), source.snapshotId, source);
  const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.endsWith('lilly-v3-return-p004-001'));
  const fact = specific(run).find(row => match.sourceFactIds.includes(row.factId));
  assert.equal(match.status, 'partial');
  assert.equal(fact.normalizedPayload.pair, 'moon-self');
  const natalPosition = name => Ecliptic(GeoVector(Body[name], new Date(birth), true)).elon;
  const moon = natalPosition('Moon'), mirrored = normalize(180 - natalPosition('Jupiter'));
  const witness = fact.normalizedPayload.natalTargetConditions.antiscionContacts.find(row => row.otherBody === 'Jupiter');
  assert.equal(witness.kind, 'antiscion');
  assert.equal(Math.floor(moon), Math.floor(mirrored));
  assert.ok(Math.abs(witness.longitude - mirrored) < 1e-9);
  assert.ok(Math.abs(witness.distance - Math.abs(arc(moon - mirrored))) < 1e-9);
  assert.equal(fact.normalizedPayload.returningConditions.antiscionContacts.some(row => row.otherBody === 'Jupiter'), false);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lilly-antiscion'));
  assert.match(formatFortuneFactAudit(input), /本命目标月亮与同盘木星的反照点在同一度格/u);
  assert.doesNotMatch(formatFortunePrompt(input), /反照点|antiscionContacts/u);
});

test('real in-sign application survives the client fact submission and remains partial source evidence', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2019 } };
  const asOf = Date.parse('2019-11-19T03:00:00Z'), archive = { snapshotId: 'lilly-application-snapshot', chart: baseChart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
  const bound = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'lilly-application', archive);
  validateFortuneFacts(bound);
  const matches = matchFortuneKnowledge(bound).byMethod.western;
  const report = interpretFortune(bound, requestForFortuneRun(bound), 'lilly-application-report');
  const { input: modelInput } = buildFortuneModelContext(bound, report);
  let exactCount = 0;
  for (const fact of specific(bound)) {
    const data = fact.normalizedPayload;
    const conditions = data.returningConditions;
    for (const row of conditions.contacts.filter(contact => contact.application?.status === 'exact')) {
      exactCount++;
      assert.ok(data.radicalPlaceCandidate);
      assert.ok(matches.some(match => match.status === 'partial' && match.sourceFactIds.includes(fact.factId)));
      const instant = Date.parse(row.application.eventAt), epoch = Date.parse(data.returnAt);
      const longitude = (planet, at) => planet === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[planet], new Date(at), true)).elon;
      const a = longitude(conditions.body, instant), b = longitude(row.otherBody, instant);
      for (const [planet, position] of [[conditions.body, a], [row.otherBody, b]]) {
        assert.equal(Math.floor(position / 30), Math.floor(longitude(planet, epoch) / 30));
      }
      assert.ok(instant > epoch && instant <= epoch + 32 * day);
      assert.ok(Math.abs(Math.abs(arc(a - b)) - row.angle) < 0.001);
    }
  }
  assert.ok(exactCount > 0);
  const prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /在离开原星座前核到精确黄经相位/u);
  assert.doesNotMatch(prompt, /lilly-same-chart-application|applyingRetrogradeStation/u);
});

test('Mercury contacting Sun and Saturn first reaches the SQLite solar return evidence in time order', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2020 } };
  const asOf = Date.parse('2020-11-19T03:00:00Z');
  const archive = { snapshotId: 'lilly-interposition-snapshot', chart: chart(Date.parse('1989-01-01T00:00:00Z')) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
  const bound = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'lilly-interposition', archive);
  validateFortuneFacts(bound);
  const rule = fortuneKnowledge.western.rules[0];
  const hit = matchFortuneKnowledge(bound).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(hit.status, 'partial');
  const fact = specific(bound).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.returnAt.startsWith('2020'));
  const contact = fact.normalizedPayload.returningConditions.contacts.find(row => row.otherBody === 'Sun' && row.aspectType === 'conjunction');
  const event = contact.interpositions.find(row => row.thirdBody === 'Mercury');
  assert.equal(event.kind, 'bodily_prohibition');
  assert.equal(event.applyingBody, 'Sun');
  assert.equal(event.receivingBody, 'Saturn');
  const events = [[event.applyingContactAt, 'Mercury', 'Sun'], [event.receivingContactAt, 'Mercury', 'Saturn'],
    [contact.application.eventAt, 'Sun', 'Saturn']];
  let prior = Date.parse(fact.normalizedPayload.returnAt);
  for (const [at, first, other] of events) {
    const date = new Date(at);
    const longitude = body => body === 'Sun' ? SunPosition(date).elon : Ecliptic(GeoVector(Body[body], date, true)).elon;
    assert.ok(date.getTime() > prior);
    assert.ok(Math.abs(arc(longitude(first) - longitude(other))) < 0.001);
    prior = date.getTime();
  }
  const report = interpretFortune(bound, requestForFortuneRun(bound), 'lilly-interposition-report');
  const { input: modelInput } = buildFortuneModelContext(bound, report);
  const prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /第三星水星.*先与太阳形成合相.*再与土星形成同类相位.*身体阻碍例的相位顺序/u);
  assert.doesNotMatch(prompt, /bodily_prohibition|receivingContactAt/u);
  const translation = fact.normalizedPayload.returningConditions.translations.find(row => row.movingBody === 'Moon');
  assert.deepEqual([translation.fromBody, translation.fromAspect, translation.toBody, translation.toAspect],
    ['Saturn', 'sextile', 'Mars', 'trine']);
  assert.ok(translation.fromAt < fact.normalizedPayload.returnAt);
  assert.ok(translation.toAt > fact.normalizedPayload.returnAt);
  for (const [at, other, degrees] of [[translation.fromAt, 'Saturn', 60], [translation.toAt, 'Mars', 120]]) {
    const date = new Date(at);
    const longitude = body => Ecliptic(GeoVector(Body[body], date, true)).elon;
    assert.ok(Math.abs(Math.abs(arc(longitude('Moon') - longitude(other))) - degrees) < 0.001);
  }
  assert.match(prompt, /按传光原例，月亮先于.*与土星形成六合.*与火星形成三分/u);
  assert.doesNotMatch(formatFortunePrompt(modelInput), /传光原例|translations|fromAspect/u);
});

test('the printed translation example uses the nearest completed contact on each side of the chart', () => {
  const at = Date.parse('2026-01-01T00:00:00Z');
  const sample = [
    { body: 'Mars', longitude: 15, speed: 0.5 },
    { body: 'Mercury', longitude: 16, speed: 1.5 },
    { body: 'Saturn', longitude: 20, speed: 0.1 },
  ];
  const translate = (positions, body) => lillyTranslationWitnesses(at, body, positions, (planet, time) => {
    const row = positions.find(item => item.body === planet);
    return { longitude: normalize(row.longitude + row.speed * ((time - at) / day)), speed: row.speed };
  }, lillyAspectOrbs);
  const [original] = translate(sample, 'Saturn');
  assert.deepEqual([original.movingBody, original.fromBody, original.fromAspect, original.toBody, original.toAspect],
    ['Mercury', 'Mars', 'conjunction', 'Saturn', 'conjunction']);
  assert.ok(Math.abs(Date.parse(original.fromAt) - (at - day)) <= 1000);
  assert.ok(Math.abs(Date.parse(original.toAt) - (at + day * 4 / 1.4)) <= 1000);
  const sextile = sample.map(row => row.body === 'Saturn' ? { ...row, longitude: 80 } : row);
  assert.equal(translate(sextile, 'Saturn')[0].toAspect, 'sextile');
  const nearer = [...sample, { body: 'Sun', longitude: 18, speed: 0.7 }];
  assert.ok(!translate(nearer, 'Saturn').some(row => row.movingBody === 'Mercury'));
  assert.equal(translate(nearer, 'Mercury').find(row => row.movingBody === 'Mercury').toBody, 'Sun');
  const tooFar = sample.map(row => row.body === 'Saturn' ? { ...row, longitude: 29, speed: 0.1 } : row);
  assert.deepEqual(translate(tooFar, 'Saturn'), []);
  const exactAtChart = sample.map(row => row.body === 'Mars' ? { ...row, longitude: 16 } : row);
  assert.ok(!translate(exactAtChart, 'Saturn').some(row => row.movingBody === 'Mercury'));
});

test('Lilly translation stops at the real opposition to retrograde Saturn before reaching Venus', () => {
  const birth = Date.parse('1990-05-27T12:00:00Z');
  const read = (body, at) => ({ longitude: readTransitLongitude(body, at),
    speed: arc(readTransitLongitude(body, at + 600_000) - readTransitLongitude(body, at - 600_000)) * 72 });
  const positions = lillyEssentialPolicy.planets.map(body => ({ ...read(body, birth), body }));
  const moon = positions.find(row => row.body === 'Moon'), saturn = positions.find(row => row.body === 'Saturn');
  assert.ok(saturn.speed < 0);
  const apparent = lillyTranslationWitnesses(birth, 'Moon', positions.filter(row => row.body !== 'Saturn'), read, lillyAspectOrbs)
    .find(row => row.movingBody === 'Moon');
  assert.deepEqual([apparent.fromBody, apparent.fromAspect, apparent.toBody, apparent.toAspect],
    ['Jupiter', 'conjunction', 'Venus', 'square']);
  const contact = lillyApplicationSequence(birth, moon, saturn, 180, read, Date.parse(apparent.toAt));
  const at = Date.parse(contact.eventAt);
  assert.equal(contact.status, 'exact');
  assert.ok(contact.eventAt.startsWith('1990-05-27T23:47:'));
  assert.ok(contact.eventAt < apparent.toAt && apparent.toAt.startsWith('1990-05-28T03:59:'));
  assert.ok(Math.abs(Math.abs(arc(read('Moon', at).longitude - read('Saturn', at).longitude)) - 180) < 0.001);
  assert.equal(lillyTranslationWitnesses(birth, 'Moon', positions, read, lillyAspectOrbs)
    .some(row => row.movingBody === 'Moon'), false);
});

test('Lilly Moon return skips an apparent natal translation when out-of-orb Mars completes first', () => {
  const birth = Date.parse('1993-06-19T00:00:00Z'), asOf = Date.parse('2012-07-01T00:00:00Z');
  const input = { periodType: 'year', targetPeriod: { year: 2012 }, displayTimezone: 'UTC' };
  const reference = { snapshotId: 'lilly-moon-natal-interposed-mars', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  const bound = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), reference.snapshotId, reference);
  const id = fortuneKnowledge.western.rules[42].knowledgeId;
  const result = matchFortuneKnowledge(bound).byMethod.western.find(row => row.knowledgeId === id);
  const fact = specific(bound).find(row => row.normalizedPayload.pair === 'moon-self'
    && row.normalizedPayload.returnAt.startsWith('2012-06'));
  assert.ok(fact && result.status === 'partial' && result.sourceFactIds.includes(fact.factId));
  const { natalTargetConditions: natal } = fact.normalizedPayload;
  assert.equal(natal.contacts.some(row => row.otherBody === 'Mars' && row.aspectType === 'sextile'), false);

  const read = (body, at) => ({ longitude: readTransitLongitude(body, at),
    speed: arc(readTransitLongitude(body, at + 600_000) - readTransitLongitude(body, at - 600_000)) * 72 });
  const positions = lillyEssentialPolicy.planets.map(body => ({ ...read(body, birth), body }));
  const moon = positions.find(row => row.body === 'Moon'), mars = positions.find(row => row.body === 'Mars');
  const truncated = lillyTranslationWitnesses(birth, 'Moon', positions.filter(row => row.body !== 'Mars'), read, lillyAspectOrbs);
  const apparent = truncated.find(row => row.movingBody === 'Moon');
  assert.deepEqual([apparent.fromBody, apparent.fromAspect, apparent.toBody, apparent.toAspect],
    ['Jupiter', 'trine', 'Sun', 'conjunction']);
  assert.equal(natal.translations.some(row => row.movingBody === 'Moon' && row.toBody === 'Sun'), false);
  const marsError = Math.abs(Math.abs(arc(mars.longitude - moon.longitude)) - 60);
  const limits = lillyAspectOrbs('Moon', 'Mars');
  assert.ok(marsError > Math.max(limits.mainOrb, limits.alternateOrb));
  const earlier = lillyApplicationSequence(birth, moon, mars, 60, read, Date.parse(apparent.toAt));
  assert.equal(earlier.status, 'exact');
  assert.ok(earlier.eventAt < apparent.toAt && earlier.eventAt.startsWith('1993-06-20T00:42:'));
  assert.ok(apparent.toAt.startsWith('1993-06-20T01:52:'));
  assert.ok(Math.abs(Math.abs(arc(read('Moon', Date.parse(earlier.eventAt)).longitude
    - read('Mars', Date.parse(earlier.eventAt)).longitude)) - 60) < 0.001);
  const report = interpretFortune(bound, requestForFortuneRun(bound), 'lilly-natal-interposition');
  const { input: modelInput } = buildFortuneModelContext(bound, report);
  assert.doesNotMatch(formatFortuneFactAudit(modelInput), /按传光原例，月亮先于[^。]+与木星形成三分[^。]+与太阳形成合相/u);
  assert.doesNotMatch(formatFortunePrompt(modelInput), /传光原例|translations|fromAspect|1993-06-20T00:42/u);
});

test('all four reviews preserve the source evidence hash and do not turn same-degree cells or one essential dignity into a completed source hit', () => {
  for (const index of indices) {
    const rule = fortuneKnowledge.western.rules[index], entry = fortuneKnowledge.western.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.equal(rule.queries[0].factType, 'lilly_return_context');
    assert.equal(rule.unresolved.some(v => v.includes('同度')), index !== indices[1]);
    assert.equal(rule.queries[0].where.radicalPlaceMinuteMatch, index === indices[1] ? true : undefined);
    assert.equal(rule.queries[0].where.sameDegreeCell, undefined);
    assert.equal(rule.queries[0].where.radicalPlaceCandidate, true);
  }
});

test('the return location is bound to one real epoch and the tropical signs agree with independent geometry', () => {
  const returnAt = lillyReturnLocationTarget(window, baseChart);
  assert.equal(new Date(returnAt).toISOString(), '2026-06-14T20:54:22.399Z');
  const location = readFortuneReturnLocation(returnAt, ' +39.90 ', '65');
  assert.deepEqual(location, { returnAt, latitude: 39.9, longitude: 65 });
  for (const [latitude, longitude] of [['', '65'], ['90', '65'], ['39.9', '-181'], ['39.9', '0x30'], ['NaN', '65']]) {
    assert.equal(readFortuneReturnLocation(returnAt, latitude, longitude), undefined);
  }
  assert.deepEqual(readFortuneReturnLocation(returnAt, '0', '-180'), { returnAt, latitude: 0, longitude: -180 });

  const comparison = buildLillySeventhReturn(window, baseChart, returns, location);
  const independent = cartesianAngles(returnAt, SiderealTime(new Date(returnAt)) * 15 + location.longitude, location.latitude);
  assert.ok(Math.abs(arc(comparison.returnAscendant - independent.ascendant)) < 1e-8);
  const chartDescendant = normalize(baseChart.western.rawResult[0].ascendant + 180);
  assert.ok(Math.abs(arc(comparison.natalSeventhLongitude - chartDescendant)) < 1e-8);
  assert.equal(comparison.sameSign, true);
  assert.ok(Math.abs(arc(comparison.returnAscendant - chartDescendant)) > 5);
  assert.equal(buildLillySeventhReturn(window, baseChart, returns, { ...location, longitude: 80 }).sameSign, false);

  const zeroCusp = arc(270 - SiderealTime(new Date(returnAt)) * 15);
  assert.equal(buildLillySeventhReturn(window, baseChart, returns, { ...location, longitude: zeroCusp }), undefined);
  for (const missing of [undefined, { ...location, returnAt: returns[0].returnAt }]) {
    assert.equal(buildLillySeventhReturn(window, baseChart, returns, missing), undefined);
  }
  assert.equal(buildLillySeventhReturn(window, { ...baseChart, timeKnown: false }, returns, location), undefined);
  assert.equal(buildLillySeventhReturn(window, baseChart, [returns[1], returns[1]], location), undefined);
  const shifted = { ...returns[1], start: returnAt + 60_000, returnAt: returnAt + 60_000 };
  assert.equal(buildLillySeventhReturn(window, baseChart, [shifted], { ...location, returnAt: shifted.returnAt }), undefined);
});

test('Lilly p737 distinguishes the seven planets changing hemispheres at the selected return', () => {
  const birth = Date.parse('1990-06-15T04:00:00Z');
  const snapshot = chart(birth, 191, -25);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2012 } };
  const asOf = Date.parse('2012-07-01T00:00:00Z');
  const display = { start: Date.parse('2011-12-31T16:00:00Z'), end: Date.parse('2012-12-31T16:00:00Z') };
  const returnAt = lillyReturnLocationTarget(display, snapshot);
  assert.ok(Math.abs(returnAt - Date.parse('2012-06-14T11:36:53.215Z')) < 1_000);
  const position = { returnAt, latitude: 55, longitude: 50.6053703 };
  const exact = buildSolarReturnPositions(display, snapshot.western);
  const planetIds = lillyEssentialPolicy.planets;
  const vector = (body, instant) => {
    const when = new Date(instant);
    return RotateVector(Rotation_EQJ_EQD(when), GeoVector(Body[body], when, true));
  };
  const isAbove = (body, instant, armc, latitude) => {
    const { x, y, z } = vector(body, instant);
    const phi = latitude * rad, theta = armc * rad;
    return Math.cos(phi) * (x * Math.cos(theta) + y * Math.sin(theta)) + Math.sin(phi) * z > 0;
  };
  assert.ok(planetIds.every(body => !isAbove(body, birth, 191, -25)));
  const localSidereal = SiderealTime(new Date(returnAt)) * 15;
  assert.ok(planetIds.every(body => isAbove(body, returnAt, localSidereal + position.longitude, position.latitude)));

  const { x, y, z } = vector('Saturn', returnAt);
  const boundaryHourAngle = Math.acos(-Math.tan(position.latitude * rad) * z / Math.hypot(x, y)) / rad;
  const boundaryLongitude = arc(Math.atan2(y, x) / rad + boundaryHourAngle - localSidereal);
  for (const [setting, expected] of [
    [position, 'radix-below-return-above'],
    [{ ...position, longitude: arc(position.longitude + 180) }, 'different-configuration'],
    [{ ...position, longitude: boundaryLongitude }, 'unverified'],
    [undefined, 'unverified'],
  ]) {
    const local = buildLillyLocatedReturn(display, snapshot, exact, setting);
    const rows = buildLillyReturnContext(display, snapshot, exact, local).contexts;
    const current = rows.filter(row => row.returnAt === returnAt);
    assert.equal(current.length, 4);
    assert.ok(rows.filter(row => row.returnAt !== returnAt).every(row => row.returnHorizonContrast === 'unverified'
      && row.returnPlanetHorizon === undefined));
    for (const row of current) {
      assert.equal(row.returnHorizonContrast, expected);
      assert.deepEqual(row.natalPlanetHorizon, planetIds.map(body => ({ body, side: 'below' })));
      if (!setting) assert.equal(row.returnPlanetHorizon, undefined);
      else if (setting.longitude === boundaryLongitude) assert.equal(row.returnPlanetHorizon.find(item => item.body === 'Saturn').side, undefined);
      else assert.deepEqual(row.returnPlanetHorizon, planetIds.map(body => ({ body,
        side: isAbove(body, returnAt, localSidereal + setting.longitude, setting.latitude) ? 'above' : 'below' })));
    }
  }

  const archive = { snapshotId: 'lilly-p737-horizon', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive, position)));
  const submitted = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), archive.snapshotId, archive);
  validateFortuneFacts(submitted);
  const current = specific(submitted).filter(fact => fact.normalizedPayload.returnAt === new Date(returnAt).toISOString());
  assert.equal(current.length, 4);
  assert.ok(current.every(fact => fact.normalizedPayload.returnHorizonContrast === 'radix-below-return-above'));
  const results = matchFortuneKnowledge(submitted).byMethod.western;
  for (const [pair, passage, eligible] of [['saturn-self', 'p001', false], ['jupiter-mercury', 'p002', false],
    ['venus-mercury', 'p003', true], ['moon-self', 'p004', false]]) {
    const rule = results.find(row => row.knowledgeId.endsWith('-lilly-v3-return-' + passage + '-001'));
    const fact = current.find(row => row.normalizedPayload.pair === pair);
    assert.equal(rule.sourceFactIds.includes(fact.factId), eligible, passage);
    if (eligible) {
      const scoped = matchFortuneKnowledge({ ...submitted, facts: [fact] }).byMethod.western
        .find(row => row.knowledgeId === rule.knowledgeId);
      assert.equal(scoped.status, pair === 'venus-mercury' ? 'excluded' : 'partial', passage);
      if (pair === 'venus-mercury') {
        assert.equal(fact.normalizedPayload.radicalPlaceCandidate, true);
        assert.deepEqual(scoped.windows, []);
      }
    }
  }
  const otherLocation = { ...position, longitude: arc(position.longitude + 180) };
  const otherBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive, otherLocation)));
  const other = bindClientFortuneRun(params, otherBatch, readClientFactTime(params, otherBatch, asOf), archive.snapshotId, archive);
  const otherVenus = specific(other).find(fact => fact.normalizedPayload.returnAt === new Date(returnAt).toISOString()
    && fact.normalizedPayload.pair === 'venus-mercury');
  assert.equal(otherVenus.normalizedPayload.returnHorizonContrast, 'different-configuration');
  const retained = matchFortuneKnowledge({ ...other, facts: [otherVenus] }).byMethod.western
    .find(row => row.knowledgeId.endsWith('-lilly-v3-return-p003-001'));
  assert.equal(retained.status, 'partial');
  assert.deepEqual(retained.windows, [{ start: otherVenus.activeFrom, endExclusive: otherVenus.activeTo }]);
  const report = interpretFortune(submitted, requestForFortuneRun(submitted), archive.snapshotId);
  const { input } = buildFortuneModelContext(submitted, report);
  const evidence = '本命七曜都在当地地平线下，本次回归七曜都在指定地点的地平线上';
  assert.ok(formatFortuneFactAudit(input).includes(evidence));
  assert.ok(!formatFortunePrompt(input).includes(evidence));
  assert.match(formatFortuneFactAudit(input), /正面分支被这一反向条件排除/u);
});

test('the actual 2020 Saturn return candidate is clipped by the verified contrary hemispheres', () => {
  const snapshot = chart(birthAt, 195, -15);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2020 } };
  const now = Date.parse('2020-07-01T00:00:00Z');
  const display = { start: Date.parse('2019-12-31T16:00:00Z'), end: Date.parse('2020-12-31T16:00:00Z') };
  const returnAt = lillyReturnLocationTarget(display, snapshot);
  assert.ok(Math.abs(returnAt - Date.parse('2020-06-14T10:11:16.145Z')) < 1_000);
  const site = { returnAt, latitude: 5, longitude: -35.9848348 };
  const reference = { snapshotId: 'lilly-saturn-horizon', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference, site)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const saturn = specific(bound).find(({ normalizedPayload: p }) => p.pair === 'saturn-self' && Date.parse(p.returnAt) === returnAt);
  const p = saturn.normalizedPayload;
  assert.equal(p.radicalPlaceCandidate, true);
  assert.equal(p.returnHorizonContrast, 'radix-below-return-above');
  assert.ok(p.natalPlanetHorizon.every(planet => planet.side === 'below'));
  assert.ok(p.returnPlanetHorizon.every(planet => planet.side === 'above'));
  const scoped = matchFortuneKnowledge({ ...bound, facts: [saturn] }).byMethod.western
    .find(rule => rule.knowledgeId.endsWith('-lilly-v3-return-p001-001'));
  assert.equal(scoped.status, 'excluded');
  assert.deepEqual(scoped.windows, []);
});

test('SQLite requires the explicitly located seventh cusp comparison and sends the excerpt only for a same-sign return', () => {
  const prior = run();
  assert.equal(seventhMatch(prior).status, 'unknown');
  assert.ok(prior.facts.some(f => f.factType === 'solar_return'));
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), archive = { snapshotId: 'lilly-seventh-snapshot', chart: baseChart };
  const returnAt = lillyReturnLocationTarget(window, baseChart);
  const serial = longitude => JSON.stringify(buildFortuneFactSubmission(input, asOf, archive, { returnAt, latitude: 39.9, longitude }));
  const bind = (batch, id) => bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), id, archive);
  const message = serial(65), batch = JSON.parse(message);
  assert.doesNotMatch(message, /"latitude"\s*:39\.9|"longitude"\s*:65[,}]/u);
  const located = bind(batch, 'lilly-seventh'), hit = seventhMatch(located);
  validateFortuneFacts(located);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: new Date(returnAt).toISOString(), endExclusive: new Date(window.end).toISOString() }]);
  assert.equal(hit.sourceFactIds.length, 1);
  const observed = located.facts.find(f => hit.sourceFactIds.includes(f.factId));
  assert.equal(observed.factType, seventhType);
  assert.equal(located.facts.filter(f => f.factType === seventhType).length, 1);
  assert.ok(located.facts.some(f => f.factType === 'solar_return' && f.activeFrom === observed.activeFrom
    && f.sourceFactIds.includes(observed.sourceFactIds[0])));

  const report = interpretFortune(located, requestForFortuneRun(located), 'lilly-seventh-prompt');
  const { input: modelInput } = buildFortuneModelContext(located, report);
  assert.ok(modelInput.sections.find(section => section.id === 'romance').findings.some(row => row.knowledgeId === seventhId));
  const prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /本命第七宫宫头与本次回归上升落在同一星座/u);
  assert.match(prompt, /desirious of Marriage/u);
  assert.doesNotMatch(prompt, /lilly_return_seventh_context|natalSeventhLongitude|returnAscendant/u);
  const mishit = bind(JSON.parse(serial(80)), 'lilly-no-seventh');
  assert.equal(seventhMatch(mishit).status, 'not_matched');
  assert.deepEqual(seventhMatch(mishit).sourceFactIds, []);

  for (const mutate of [p => { p.sameSign = false; }, p => { p.houseSystem = 'whole-sign'; }, p => { p.returnEnd = p.returnAt; },
    p => { p.latitude = 39.9; }]) {
    const invalidBatch = structuredClone(batch);
    mutate(invalidBatch.facts.find(f => f.factType === seventhType).normalizedPayload);
    assert.throws(() => bind(invalidBatch, 'lilly-invalid-location'), { status: 400 });
  }
  const noSource = { ...batch, facts: batch.facts.filter(f => f.factType !== 'solar_return') };
  assert.throws(() => bind(noSource, 'lilly-no-epoch'), { status: 400 });

  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId === seventhId);
  const entry = fortuneKnowledge.western.entries.find(row => row.id === seventhId);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  assert.equal(rule.unresolved.length, 0);
});

test('explicit return location qualifies only its own epoch and keeps the Saturn cusp boundary uncertain', () => {
  const range = { start: Date.parse('2018-12-31T16:00:00Z'), end: Date.parse('2019-12-31T16:00:00Z') };
  const epochs = buildSolarReturnPositions(range, baseChart.western);
  const [prior, current] = epochs;
  const time = MakeTime(new Date(current.returnAt));
  const saturn = current.bodies.find(row => row.planet === 'Saturn').longitude;
  const longitudeAtCusp = offset => {
    const angle = (saturn + offset) * rad;
    const meridian = Math.atan2(Math.sin(angle) * Math.cos(e_tilt(time).tobl * rad), Math.cos(angle)) / rad;
    return arc(meridian - SiderealTime(time) * 15);
  };
  const cuspLongitude = longitudeAtCusp(0);
  const atLocation = longitude => ({ returnAt: current.returnAt, latitude: 39.9, longitude: arc(longitude) });
  const calculate = location => buildLillyReturnContext(range, baseChart, epochs,
    buildLillyLocatedReturn(range, baseChart, epochs, location)).contexts;
  const selectSaturn = rows => rows.find(row => row.pair === 'saturn-self' && row.returnAt === current.returnAt);
  const before = calculate(atLocation(cuspLongitude - 5)), after = calculate(atLocation(cuspLongitude + 5));
  assert.equal(selectSaturn(before).saturnMidheavenState, 'tenth-house');
  assert.equal(selectSaturn(before).returnHouse, 10);
  assert.equal(selectSaturn(after).saturnMidheavenState, 'other-house');
  assert.equal(selectSaturn(after).returnHouse, 9);
  const ambiguous = selectSaturn(calculate(atLocation(cuspLongitude)));
  assert.equal(ambiguous.saturnMidheavenState, 'house-boundary');
  assert.equal(ambiguous.returnHouse, undefined);
  assert.equal(ambiguous.returnAngles, 'regiomontanus_verified');
  assert.ok(before.filter(row => row.returnAt === prior.returnAt).every(row => row.returnLocation === 'unprovided'
    && row.returningConditions.house === undefined && row.returningEssential.sect === undefined));
  const opposite = selectSaturn(calculate(atLocation(cuspLongitude + 175)));
  assert.deepEqual(new Set([selectSaturn(before).returnSect, opposite.returnSect]), new Set(['day', 'night']));
  const approach = selectSaturn(calculate(atLocation(longitudeAtCusp(4))));
  assert.equal(approach.returnHouse, 9);
  assert.equal(approach.saturnMidheavenApproachStatus, 'within-five-before');
  assert.ok(approach.saturnMidheavenDistanceRange.every(value => Math.abs(value - 4) < 0.01));
  assert.equal(selectSaturn(calculate(atLocation(longitudeAtCusp(5)))).saturnMidheavenApproachStatus, 'boundary');
  assert.equal(selectSaturn(calculate(atLocation(longitudeAtCusp(6)))).saturnMidheavenApproachStatus, 'outside-five-before');
  assert.equal(buildLillyLocatedReturn(range, baseChart, epochs, { ...atLocation(0), returnAt: prior.returnAt }), undefined);

  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2019 } };
  const asOf = Date.parse('2019-11-19T03:00:00Z'), archive = { snapshotId: 'lilly-located-pairs', chart: baseChart };
  const location = atLocation(cuspLongitude - 5);
  const serial = JSON.stringify(buildFortuneFactSubmission(params, asOf, archive, location));
  const batch = JSON.parse(serial);
  const locationFacts = batch.facts.filter(row => ['solar_return', 'lilly_return_context', seventhType].includes(row.factType));
  const withoutStellarLatitude = JSON.stringify(locationFacts, function (key, value) {
    return key === 'latitude' && ['Algol', 'Regulus', 'Spica'].includes(this.star) ? undefined : value;
  });
  assert.doesNotMatch(withoutStellarLatitude, /"latitude"|"cusps"|"houseByPlanet"/u);
  assert.ok(!serial.includes('"latitude":' + location.latitude) && !serial.includes('"longitude":' + location.longitude));
  const bind = (value, id) => bindClientFortuneRun(params, value, readClientFactTime(params, value, asOf), id, archive);
  const located = bind(batch, 'lilly-located-pairs');
  const locatedPairs = specific(located).filter(row => row.normalizedPayload.returnLocation === 'provided');
  assert.equal(locatedPairs.length, 4);
  const solar = located.facts.find(row => row.factType === 'solar_return'
    && row.normalizedPayload.returnLocalFrame === 'lilly-revolution-local-regiomontanus-v1');
  for (const pair of locatedPairs) {
    const p = pair.normalizedPayload;
    assert.ok(pair.sourceFactIds.some(id => solar.sourceFactIds.includes(id)));
    assert.equal(p.returnAt, solar.normalizedPayload.returnAt);
    assert.equal(p.returningEssential.sect, p.returnSect);
    assert.equal(p.returningConditions.house, p.returnHouse);
  }
  const rule = fortuneKnowledge.western.rules[indices[0]];
  const saturnFact = locatedPairs.find(row => row.normalizedPayload.pair === 'saturn-self');
  const match = matchFortuneKnowledge(located).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.includes(saturnFact.factId));
  const { input } = buildFortuneModelContext(located, interpretFortune(located, requestForFortuneRun(located), archive.snapshotId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /回归土星实居第十宫/u);
  assert.match(prompt, /回归太阳在当地地平线[上下]方/u);
  assert.doesNotMatch(prompt, /returnLocalFrame|saturnMidheavenState|undefined/u);
  assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === rule.knowledgeId)));

  const sourceIndex = batch.facts.findIndex(row => row.factType === 'lilly_return_context'
    && row.normalizedPayload.pair === 'saturn-self' && row.normalizedPayload.returnLocation === 'provided');
  for (const mutate of [
    row => { row.normalizedPayload.saturnMidheavenState = 'other-house'; },
    row => { row.normalizedPayload.returningConditions.house = 4; },
    row => { row.normalizedPayload.returningEssential.sect = 'unrelated'; },
    row => { row.normalizedPayload.returnAt = new Date(prior.returnAt).toISOString(); },
    row => { row.sourceFactIds = row.sourceFactIds.slice(0, 1); },
  ]) {
    const invalid = { ...batch, facts: [...batch.facts] };
    invalid.facts[sourceIndex] = structuredClone(invalid.facts[sourceIndex]);
    mutate(invalid.facts[sourceIndex]);
    assert.throws(() => bind(invalid, 'lilly-invalid-located-pair'), { status: 400 });
  }

  const nearBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive, atLocation(longitudeAtCusp(4)))));
  const nearRun = bind(nearBatch, 'lilly-near-midheaven');
  const nearMatch = matchFortuneKnowledge(nearRun).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
  assert.equal(nearMatch.status, 'partial');
  const nearFact = nearRun.facts.find(row => nearMatch.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.saturnMidheavenApproachStatus === 'within-five-before');
  assert.ok(nearFact);
  assert.equal(nearFact.normalizedPayload.returnHouse, 9);
  const old = { ...nearFact, normalizedPayload: { ...nearFact.normalizedPayload, saturnMidheavenApproachStatus: undefined } };
  const missing = evaluateFortuneRules('western', 'year', [old]).find(row => row.knowledgeId === rule.knowledgeId).required[0];
  assert.deepEqual([missing.hits.length, missing.unknown], [0, true]);
  const context = buildFortuneModelContext(nearRun, interpretFortune(nearRun, requestForFortuneRun(nearRun), archive.snapshotId));
  assert.match(formatFortuneFactAudit(context.input), /回归土星实居第九宫，且在最近的第十宫头之前五度内/u);
  const tampered = nearBatch.facts.find(row => row.normalizedPayload.saturnMidheavenApproachStatus === 'within-five-before'
    && row.factType === 'lilly_return_context');
  tampered.normalizedPayload.saturnMidheavenDistanceRange = [6, 7];
  assert.throws(() => bind(nearBatch, 'lilly-invalid-midheaven'), { status: 400 });
});
