import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition, EquatorFromVector, RotateVector, Rotation_EQJ_EQD, e_tilt, MakeTime, SiderealTime } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { buildLeoSourceContext, readLeoAppendixDate, readLeoEquatorial, readLeoMovingPosition, leoParallelDifference, scanLeoParallel, scanLeoMovingParallel,
  linkLeoLunarContacts, splitLeoConjunctionAtSigns, splitLeoRulershipDirectionAtSigns,
  scanLeoSolarDignities, leoSourcePolicy } = await import('./control/leo-source-context.ts');
const { buildLeoLunarConditions, leoLunarNature, leoLunarConditionPolicy } = await import('./control/leo-lunar-conditions.ts');
const { readLeoNatalAspectContacts } = await import('./control/leo-natal-aspects.ts');
const { leoSolarPhasePolicy } = await import('./control/leo-solar-phases.ts');
const { classifyLeoDirections, leoDirectionNatures } = await import('./control/leo-direction-support.ts');
const { buildWesternProgressions, progressedAspects, progressionEpoch, progressionRealTime } = await import('./control/western-progressions.ts');
const { anglesFromFrame, calculateHouseCusps, progressedHouseFrame, readWesternHouseFrame, zodiacalHouse } =
  await import('./control/western-houses.ts');
const { leoLunarHousePolicy } = await import('./control/leo-lunar-houses.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge, getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const golden = JSON.parse(readFileSync(new URL('./model/fixtures/leo-declination-reference.json', import.meta.url)));
const day = 86_400_000, born = Date.parse(golden.natalAt), epoch = Date.parse(golden.progressedAt);
const window = { start: Date.parse('1906-01-01T00:00:00Z'), end: Date.parse('1907-01-01T00:00:00Z') };
const at = Date.parse('1906-11-18T04:00:00Z');
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
function chart(birthAt = born, armc = 0) {
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birthAt / day + 2440587.5, ...anglesFromFrame(armc, 0, 23.44),
      positions: bodies.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(birthAt)).elon : Ecliptic(GeoVector(Body[planet], new Date(birthAt), true)).elon })),
    }],
  } };
}

const shared2026ProgressedPairRuns = new Map();
function progressedPairRun2026(birthDate) {
  if (!shared2026ProgressedPairRuns.has(birthDate)) {
    const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(2026, 5, 15), birthAt = Date.parse(birthDate + 'T00:00:00Z');
    const reference = { snapshotId: 'leo-progressed-pair-' + birthDate, chart: chart(birthAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    shared2026ProgressedPairRuns.set(birthDate, { birthAt, reference, run });
  }
  return shared2026ProgressedPairRuns.get(birthDate);
}

function assertAnnualMutualObservation(run, result, target, aspect, status, moving = 'Mars') {
  assert.equal(result.status, status, result.knowledgeId);
  const expected = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_mutual_exact_observation'
    && p.observed && p.progressedBody === moving && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
  assert.equal(expected.length > 0, status === 'matched', result.knowledgeId);
  assert.deepEqual(new Set(result.sourceFactIds), new Set(expected.map(row => row.factId)), result.knowledgeId);
}

function assertAnnualMercuryParallel(run, result, target) {
  assert.equal(result.status, 'matched', result.knowledgeId);
  const expected = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
    && p.progressedBody === 'Mercury' && p.natalTargetId === target && p.targetKind === 'natal'
    && p.aspectType === 'parallel' && p.coordinate === 'equatorial_declination_of_date' && p.allowedOrb === 1);
  assert.ok(expected.length, result.knowledgeId);
  assert.deepEqual(new Set(result.sourceFactIds), new Set(expected.map(row => row.factId)), result.knowledgeId);
}

test('Appendix V reproduces the two published Greenwich dates and retains the modern ephemeris comparison', () => {
  const birthAt = Date.parse('1860-08-07T05:49:00Z');
  const cases = [
    ['1860-09-22T10:40:00Z', '1906-10-22', 'Mercury', 135, '1860-09-22T00:00:00Z', '1906-10-22'],
    ['1860-09-23T04:01:00Z', '1907-07-13', 'Venus', 150, '1860-09-22T18:00:00Z', '1907-07-11'],
  ];
  for (const [printedAt, printedDate, target, expectedAngle, bracketStart, modernDate] of cases) {
    assert.equal(readLeoAppendixDate(birthAt, Date.parse(printedAt)).date, printedDate);
    let left = Date.parse(bracketStart), right = left + day;
    const error = ephemerisAt => {
      const moon = readLeoMovingPosition('Moon', ephemerisAt).longitude;
      const point = readLeoMovingPosition(target, target === 'Mercury' ? birthAt : ephemerisAt).longitude;
      return Math.abs((moon - point + 540) % 360 - 180) - expectedAngle;
    };
    assert.ok(error(left) < 0 && error(right) > 0);
    while (right - left > 1) {
      const midpoint = Math.floor((left + right) / 2);
      if (error(midpoint) < 0) left = midpoint;
      else right = midpoint;
    }
    assert.ok(Math.abs(error(right)) < 0.000001);
    const candidate = readLeoAppendixDate(birthAt, right);
    assert.equal(candidate.date, modernDate);
    assert.ok(candidate.residualSeconds < 120);
    assert.notEqual(new Date(progressionRealTime(birthAt, right)).toISOString().slice(0, 10), candidate.date);
  }
});

test('rulership directions retain one signal and exact pass through two retrograde sign crossings', () => {
  const band = { start: 0, end: 4 * day, exactTimes: [2 * day], natalLongitude: 29.5,
    allowedOrb: 1, clippedStart: true, clippedEnd: true, coordinate: 'ecliptic_longitude',
    progressedBody: 'Mars', natalTargetId: 'Neptune', aspectType: 'semisextile' };
  const longitudeAt = at => (359.5 + 0.25 * (at / day - 2) ** 2) % 360;
  const slices = splitLeoRulershipDirectionAtSigns(band, longitudeAt);
  assert.deepEqual(slices.map(row => row.progressedBodySign), [0, 11, 0]);
  assert.ok(slices.every(row => row.sourceBandStart === band.start && row.separation < 1));
  assert.deepEqual(slices.flatMap(row => row.exactTimes), band.exactTimes);
  assert.equal(slices[0].end, slices[1].start);
  assert.equal(slices[1].end, slices[2].start);
  const touch = at => 0.25 * (at / day - 2) ** 2;
  assert.deepEqual(splitLeoRulershipDirectionAtSigns(band, touch).map(row => row.progressedBodySign), [0]);
  const progressed = { ...band, targetKind: 'progressed' };
  assert.deepEqual(splitLeoRulershipDirectionAtSigns(progressed, longitudeAt), [progressed]);
});

test('actual Mars and Venus sign entries reach the paired natal cusp queries and model prose', () => {
  const cases = [
    { id: '048', body: 'Mars', target: 'Neptune', aspect: 'semisextile', birth: '1984-07-07',
      lat: 31.23, lon: 121.47, signs: [7, 8], phrase: /次限火星在天蝎座，本命海王星在射手座/u },
    { id: '300', body: 'Venus', target: 'Jupiter', aspect: 'quincunx', birth: '1988-12-04',
      lat: 51.51, lon: -0.13, signs: [8, 9], phrase: /次限金星在摩羯座，本命木星在金牛座/u },
  ];
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-06-15T00:00:00Z');
  const calculate = ({ id, birth, lat, lon }) => {
    const at = Date.parse(birth + 'T04:00:00Z');
    const time = MakeTime(new Date(at));
    const snapshot = chart(at);
    const armc = (SiderealTime(time) * 15 + lon + 360) % 360;
    Object.assign(snapshot.western.rawResult[0], anglesFromFrame(armc, lat, e_tilt(time).tobl));
    const reference = { snapshotId: 'leo-direction-sign-' + id };
    const submission = buildFortuneFactSubmission(parameters, now, { ...reference, chart: snapshot });
    const batch = JSON.parse(JSON.stringify(submission));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-interpretation-p' + id + '-'));
    return { run, match, at };
  };
  for (const sample of cases) {
    const { run, match, at } = calculate(sample);
    const independentMars = sample.id === '048';
    assertAnnualMutualObservation(run, match, sample.target, sample.aspect, independentMars ? 'not_matched' : 'matched', sample.body);
    const slices = run.facts.filter(({ factType, normalizedPayload: p }) =>
      factType === 'leo_progressed_aspect' && p.progressedBody === sample.body && p.natalTargetId === sample.target
        && p.aspectType === sample.aspect && p.targetKind === 'natal')
      .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    assert.deepEqual(slices.map(row => row.normalizedPayload.progressedBodySign), sample.signs, sample.id);
    assert.equal(slices[0].activeTo, slices[1].activeFrom, sample.id);
    assert.ok(slices[0].parentSignalId);
    assert.equal(slices[0].parentSignalId, slices[1].parentSignalId, sample.id);
    for (const [index, slice] of slices.entries()) {
      const p = slice.normalizedPayload;
      assert.equal(p.natalTargetId, sample.target);
      assert.equal(p.natalTargetSign, Math.floor(readLeoMovingPosition(sample.target, at).longitude / 30));
      assert.equal(p.aspectType, sample.aspect);
      assert.equal(p.rulership.houseStatus, 'ready');
      assert.equal(p.rulership.cuspRulers.length, 12);
      assert.equal(p.rulership.first.status, 'calculated_from_natal_cusps');
      const beforeOrAfter = Date.parse(slices[1].activeFrom) + (index === 0 ? -1 : 1) * 60 * 60_000;
      const moving = readLeoMovingPosition(sample.body, Math.round(progressionEpoch(at, beforeOrAfter)));
      assert.equal(Math.floor(moving.longitude / 30), sample.signs[index]);
    }
    if (independentMars) {
      const witness = slices[0];
      assert.match(describeFortuneFact({ method: 'western', type: witness.factType, data: witness.normalizedPayload }, String), sample.phrase);
      continue;
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-direction-signs'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /progressedBodySign|directionSignProfile|sourceBandStart/u);
  }
  const { run, match } = calculate({ ...cases[1], lat: -33.87, lon: 151.21 });
  assert.ok(run.facts.some(fact => fact.factType === 'leo_progressed_aspect'
    && fact.normalizedPayload.progressedBody === 'Venus' && fact.normalizedPayload.natalTargetId === 'Jupiter'
    && fact.normalizedPayload.aspectType === 'quincunx' && fact.normalizedPayload.houseStatus === 'ready'));
  assertAnnualMutualObservation(run, match, 'Jupiter', 'quincunx', 'matched', 'Venus');
});

let original, leo;
const progression = () => original ??= buildWesternProgressions(window, at, chart());
const calculated = () => leo ??= buildLeoSourceContext(window, chart(), progression());

test('seventeen printed declinations from the original calculation example match rounded modern magnitudes independently of their north/south signs', () => {
  assert.equal(Object.keys(golden.natalDegrees).length + Object.keys(golden.progressedDegrees).length, 17);
  for (const [body, expected] of Object.entries(golden.natalDegrees)) assert.equal(Math.round(Math.abs(readLeoEquatorial(body, born).dec)), expected, 'natal ' + body);
  for (const [body, expected] of Object.entries(golden.progressedDegrees)) assert.equal(Math.round(Math.abs(readLeoEquatorial(body, epoch).dec)), expected, 'progressed ' + body);
  const mercury = readLeoEquatorial('Mercury', epoch).dec, neptune = readLeoEquatorial('Neptune', born).dec;
  assert.ok(mercury > 0 && neptune < 0);
  assert.ok(leoParallelDifference(mercury, neptune) > 0.25 && leoParallelDifference(mercury, neptune) < 1);
  assert.ok(Math.abs(mercury - neptune) > 1);
  assert.equal(leoSourcePolicy.parallelOrb, 1); assert.throws(() => leoParallelDifference(100, 1));
});

test('absolute parallels split at the equator, preserve both exact passes and do not overlap or drop the equatorial target', () => {
  const w = { start: 0, end: 4 * day }, read = instant => instant / day - 2;
  const bands = scanLeoParallel(w, read, 0.5);
  assert.equal(bands.length, 2); assert.equal(bands[0].declinationSide, -1); assert.equal(bands[1].declinationSide, 1);
  assert.ok(Math.abs(bands[0].start - 0.5 * day) <= 1_000); assert.ok(Math.abs(bands[1].end - 3.5 * day) <= 1_000);
  assert.equal(bands[0].end, bands[1].start);
  const exact = bands.flatMap(b => b.exactTimes); assert.equal(exact.length, 2);
  assert.ok(Math.abs(exact[0] - 1.5 * day) <= 1_000); assert.ok(Math.abs(exact[1] - 2.5 * day) <= 1_000);
  const zero = scanLeoParallel(w, read, 0);
  assert.equal(zero[0].end, zero[1].start); assert.equal(zero.flatMap(b => b.exactTimes).length, 1);
  for (const b of [...bands, ...zero]) for (const e of b.exactTimes) assert.ok(b.start <= e && e < b.end);
});

test('conjunction sign segments handle the zodiac wrap, reverse motion and an isolated cusp touch', () => {
  const band = { start: 0, end: 4 * day, exactTimes: [3 * day], natalLongitude: 0.25,
    allowedOrb: 1, clippedStart: true, clippedEnd: true };
  for (const [longitudeAt, expected] of [
    [at => (359.6 + 0.8 * at / band.end) % 360, ['split', 0]],
    [at => (360.4 - 0.8 * at / band.end) % 360, [0, 'split']],
  ]) {
    const rows = splitLeoConjunctionAtSigns(band, longitudeAt);
    assert.deepEqual(rows.map(row => row.conjunctionSign), expected);
    assert.ok(Math.abs(rows[0].end - 2 * day) <= 1_000);
    assert.equal(rows[0].end, rows[1].start);
    assert.deepEqual(rows.map(row => row.exactTimes), [[], [3 * day]]);
    assert.deepEqual(rows.map(row => [row.clippedStart, row.clippedEnd]), [[true, false], [false, true]]);
  }
  const touching = splitLeoConjunctionAtSigns(band, at => (360 - 0.4 * (at / (2 * day) - 1) ** 2) % 360);
  assert.deepEqual(touching.map(row => [row.start, row.end, row.conjunctionSign]), [[0, band.end, 'split']]);
});

test('moving parallels preserve roots on both sides of an equator crossing', () => {
  const w = { start: 0, end: 4 * day };
  const bands = scanLeoMovingParallel(w, at => at / day - 2, at => 0.5 + at / day / 8, [2 * day]);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].end, bands[1].start);
  assert.equal(bands[0].clippedEnd, false);
  assert.equal(bands[1].clippedStart, false);
  const exact = bands.flatMap(b => b.exactTimes);
  assert.equal(exact.length, 2);
  assert.ok(Math.abs(exact[0] - (4 / 3) * day) <= 1_000);
  assert.ok(Math.abs(exact[1] - (20 / 7) * day) <= 1_000);
});

test('the original Mercury/Neptune example is an admitted opposite-hemisphere one-degree source interval and remains excluded by the generic narrow signed policy', () => {
  const source = calculated(); assert.equal(source.status, 'ready');
  const realAt = progressionRealTime(born, epoch);
  const example = source.intervals.find(b => b.progressedBody === 'Mercury' && b.natalTargetId === 'Neptune' && b.aspectType === 'parallel' && b.start <= realAt && realAt < b.end);
  assert.ok(example); assert.equal(example.sameHemisphere, false); assert.equal(example.allowedOrb, 1);
  assert.equal(example.coordinate, 'equatorial_declination_of_date');
  assert.ok(!progression().intervals.some(b => b.progressedBody === 'Mercury' && b.natalTargetId === 'Neptune' && b.aspectType === 'parallel' && b.start <= realAt && realAt < b.end));
});

test('every source parallel agrees with independent of-date equatorial vectors and actual valid/exact times', () => {
  const source = calculated();
  for (const b of source.intervals.filter(b => b.aspectType === 'parallel')) {
    const middle = (b.start + b.end) / 2, date = new Date(progressionEpoch(born, middle));
    const dec = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[b.progressedBody], date, true))).dec;
    const natalDate = new Date(born);
    const target = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(natalDate), GeoVector(Body[b.natalTargetId], natalDate, true))).dec;
    assert.ok(Math.abs(Math.abs(dec) - Math.abs(target)) <= 1 + 1e-6);
    assert.equal(b.sameHemisphere, Math.sign(dec) === Math.sign(target));
    for (const exact of b.exactTimes) {
      const d = readLeoEquatorial(b.progressedBody, progressionEpoch(born, exact)).dec;
      assert.ok(leoParallelDifference(d, target) < 0.00001);
      assert.ok(b.start <= exact && exact < b.end);
    }
  }
});

test('natal source context keeps Placidus houses, signs and geometric daylight separate from unavailable axes or a guessed whole-sign chart', () => {
  const birthAt = Date.parse('1990-01-01T04:00:00Z'), w = { start: Date.parse('2026-01-01T00:00:00Z'), end: Date.parse('2027-01-01T00:00:00Z') };
  const base = chart(birthAt), before = structuredClone(base);
  const p = buildWesternProgressions(w, w.start, base), first = buildLeoSourceContext(w, base, p);
  assert.equal(first.status, 'ready'); assert.equal(first.natalContext.sunSign, 9);
  assert.equal(first.natalContext.sunHouse, 7); assert.equal(first.natalContext.dayChart, true);
  const night = buildLeoSourceContext(w, chart(birthAt, 180), p);
  assert.equal(night.natalContext.sunHouse, 1); assert.equal(night.natalContext.dayChart, false);
  const missing = structuredClone(base); missing.western.rawResult[0].ascendant = NaN;
  const unknown = buildLeoSourceContext(w, missing, p);
  assert.equal(unknown.status, 'ready'); assert.equal(unknown.natalContext.houseStatus, 'unavailable');
  assert.ok(unknown.natalContext.bodies.every(b => b.house === undefined)); assert.equal(unknown.natalContext.dayChart, undefined);
  assert.deepEqual(base, before);
});

test('source context cannot be built from an unrelated birth, uncertain time, incompatible version or intervals outside its query', () => {
  for (const change of [c => { c.timeKnown = false; }, c => { c.western.engineVersion = 'other'; }, c => { c.western.rawResult[0].julianDay++; }]) {
    const c = chart(); change(c); assert.notEqual(buildLeoSourceContext(window, c, progression()).status, 'ready');
  }
  assert.notEqual(buildLeoSourceContext({ start: window.start + day, end: window.end }, chart(), progression()).status, 'ready');
});

test('lunar links require a genuinely shared body and positive interval and never equate overlap or similar angles with shared nature', () => {
  const basic = { exactTimes: [], clippedStart: false, clippedEnd: false, allowedOrb: 1, coordinate: 'ecliptic_longitude', separation: 0 };
  const base = { ...basic, start: 0, end: 10, progressedBody: 'Venus', natalTargetId: 'Mars', aspectType: 'trine' };
  const moon = { ...basic, start: 5, end: 15, progressedBody: 'Moon', natalTargetId: 'Mars', aspectType: 'square', exactTimes: [7, 12] };
  const before = structuredClone([base, moon]), links = linkLeoLunarContacts([base, moon]);
  assert.equal(links.length, 1); assert.deepEqual([links[0].start, links[0].end], [5, 10]);
  assert.deepEqual(links[0].lunarExactTimes, [7]); assert.equal(links[0].geometryOnly, true); assert.equal(links[0].sameNature, undefined);
  assert.deepEqual([base, moon], before);
  assert.deepEqual(linkLeoLunarContacts([base, { ...moon, natalTargetId: 'Jupiter' }]), []);
  assert.deepEqual(linkLeoLunarContacts([base, { ...moon, start: 10 }]), []);
  const progressed = { ...base, targetKind: 'progressed' };
  assert.deepEqual(linkLeoLunarContacts([progressed, moon]), []);
  const linked = linkLeoLunarContacts([progressed, { ...moon, targetKind: 'progressed', natalTargetId: 'Venus' }]);
  assert.equal(linked.length, 1);
  assert.equal(linked[0].lunarTargetKind, 'progressed');
  assert.deepEqual(linkLeoLunarContacts([{ ...progressed, natalTargetId: 'Moon' },
    { ...moon, targetKind: 'progressed', natalTargetId: 'Venus' }]), []);
});

let actual;
const realRun = () => {
  if (actual) return actual;
  const params = { periodType: 'year', targetPeriod: { year: 1906 }, displayTimezone: 'Asia/Shanghai' };
  return actual = calculateFortuneFacts(params, buildFactTimeContext(params, at, 'server'), 'leo-source-run', { snapshotId: 'leo-source-snapshot', chart: chart() });
};
test('real source intervals, exact points, natal context and lunar links retain raw provenance and cannot produce a complete source hit prematurely', () => {
  const run = realRun(); validateFortuneFacts(run); assert.notEqual(run.methods.western.status, 'failed');
  for (const type of ['leo_natal_context', 'leo_progressed_aspect', 'leo_progressed_aspect_exact', 'leo_lunar_contact', 'leo_lunar_condition']) assert.ok(run.facts.some(f => f.factType === type), type);
  const facts = run.facts.filter(f => f.factType.startsWith('leo_'));
  assert.ok(facts.every(f => f.sourceFactIds.every(id => run.rawFacts.some(r => r.rawFactId === id))));
  const exact = facts.filter(f => f.factType === 'leo_progressed_aspect_exact'); assert.ok(exact.every(f => f.normalizedPayload.separation < 0.0001));
  const rule = fortuneKnowledge.western.rules.find(r => r.queries[0]?.where.progressedBody === 'Mercury' && r.queries[0].where.natalTargetId === 'Neptune' && r.queries[0].where.aspectType === 'parallel');
  const parallels = facts.filter(fact => fact.factType === 'leo_progressed_aspect'
    && fact.normalizedPayload.progressedBody === 'Mercury' && fact.normalizedPayload.natalTargetId === 'Neptune'
    && fact.normalizedPayload.aspectType === 'parallel' && fact.normalizedPayload.targetKind === 'natal');
  assert.ok(parallels.length);
  assert.ok(parallels.every(fact => Array.isArray(fact.normalizedPayload.natalSquareOppositionBodies)
    && !fact.normalizedPayload.natalSquareOppositionBodies.includes('Neptune')));
  const result = matchFortuneKnowledge(run).byMethod.western.find(r => r.knowledgeId === rule.knowledgeId);
  assert.equal(result.status, 'not_matched');
  assert.deepEqual(result.sourceFactIds, []);
  assert.ok(result.unresolvedConditions.length);
});

test('Leo Moon chapter classification depends on the target and keeps qualified source clauses conditional', () => {
  for (const [natalTargetId, aspectType, expected] of [
    ['Jupiter', 'conjunction', 'favourable'], ['Mars', 'conjunction', 'adverse'], ['Sun', 'conjunction', 'conditional'],
    ['Venus', 'parallel', 'favourable'], ['Saturn', 'parallel', 'adverse'], ['Neptune', 'parallel', 'conditional'],
    ['Jupiter', 'opposition', 'conditional'], ['Saturn', 'opposition', 'adverse'], ['Mars', 'trine', 'conditional'],
  ]) assert.equal(leoLunarNature({ natalTargetId, aspectType }), expected);
});

test('concurrent Moon facts split at each real contact boundary and do not share Jupiter across layers or reuse the base Moon aspect', () => {
  const base = { start: 0, end: 20, progressedBody: 'Sun', natalTargetId: 'Jupiter', targetKind: 'natal',
    aspectType: 'parallel', exactTimes: [] };
  const moon = (start, end, natalTargetId, targetKind, aspectType, exactTimes = []) => ({
    start, end, progressedBody: 'Moon', natalTargetId, targetKind, aspectType, exactTimes,
  });
  const natalJupiter = moon(5, 10, 'Jupiter', 'natal', 'trine', [5, 9]);
  const progressedJupiter = moon(0, 5, 'Jupiter', 'progressed', 'sextile', [4]);
  const mars = moon(7, 15, 'Mars', 'natal', 'conjunction');
  const conditional = moon(10, 13, 'Jupiter', 'natal', 'opposition');
  const values = buildLeoLunarConditions([base, natalJupiter, progressedJupiter, mars, conditional]);
  const rows = values.filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.natalState, row.progressedState]), [
    [0, 5, 'none', 'all_favourable'], [5, 7, 'all_favourable', 'none'], [7, 10, 'mixed', 'none'],
    [10, 13, 'conditional', 'none'], [13, 15, 'all_adverse', 'none'], [15, 20, 'none', 'none'],
  ]);
  assert.deepEqual(rows.map(r => r.lunarFavourableTargets), [[], ['Jupiter'], ['Jupiter'], [], [], []]);
  assert.deepEqual(rows.map(r => r.sameLayerLunarState), rows.map(r => r.natalState));
  assert.deepEqual(rows.map(r => r.lunarAdverseTargets), [[], [], ['Mars'], ['Mars'], ['Mars'], []]);
  assert.deepEqual(rows[1].contacts[0].exactTimes, [5]);
  assert.deepEqual(rows[2].contacts[0].exactTimes, [9]);
  const moonRows = values.filter(row => row.base === natalJupiter);
  assert.ok(moonRows.every(row => !row.lunarFavourableTargets.includes('Jupiter')));
});

test('a Moon contact can reach the progressed source endpoint or its target in the proper chart', () => {
  const band = { start: 0, end: 20, exactTimes: [], allowedOrb: 1, clippedStart: false, clippedEnd: false,
    coordinate: 'ecliptic_longitude', separation: 0 };
  const base = { ...band, progressedBody: 'Venus', natalTargetId: 'Uranus', aspectType: 'quincunx', targetKind: 'natal' };
  const moon = { ...band, progressedBody: 'Moon', aspectType: 'trine' };
  const rows = buildLeoLunarConditions([base,
    { ...moon, natalTargetId: 'Venus', targetKind: 'natal', end: 5 },
    { ...moon, natalTargetId: 'Venus', targetKind: 'progressed', start: 5, end: 10 },
    { ...moon, natalTargetId: 'Uranus', targetKind: 'progressed', start: 10, end: 15 },
    { ...moon, natalTargetId: 'Uranus', targetKind: 'natal', start: 15 },
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => row.lunarLinkedBodies), [[], ['Venus'], [], ['Uranus']]);
  assert.deepEqual(rows.map(row => row.sameLayerLunarState), ['all_favourable', 'none', 'none', 'all_favourable']);
});

test('SQLite selects real lunar subdivisions for overall polarity, Saturn, Venus and either proper endpoint', () => {
  const reference = Date.parse('2026-06-15T00:00:00Z');
  const interval = { start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z') };
  const sameMoon = (row, planet, nature) => row.contacts.some(contact => contact.targetKind === (row.base.targetKind ?? 'natal')
    && contact.target === planet && contact.nature === nature);
  const cases = [
    ['p043', '1983-06-14', 'Mars', 'Jupiter', 'sesquiquadrate', row => ['all_favourable', 'all_adverse'].includes(row.natalState), true],
    ['p269', '1980-09-23', 'Sun', 'Saturn', 'semisquare', row => sameMoon(row, 'Saturn', 'adverse'), true],
    ['p269', '1981-10-06', 'Sun', 'Saturn', 'semisquare', row => sameMoon(row, 'Saturn', 'adverse'), false],
    ['p292', '1980-03-04', 'Sun', 'Venus', 'parallel', row => sameMoon(row, 'Venus', 'favourable'), true],
    ['p340', '1980-03-18', 'Venus', 'Uranus', 'quincunx', row => row.hasUranianLunarParallelActivation, true],
    ['p066', '1970-06-25', 'Mars', 'Saturn', 'parallel', row => row.natalState === 'all_adverse', true],
    ['p066', '1965-02-03', 'Mars', 'Saturn', 'parallel', row => row.natalState === 'all_adverse', true],
    ['p077', '1965-03-30', 'Mercury', 'Jupiter', 'conjunction', row => row.natalState === 'all_favourable', true],
    ['p095', '1965-01-03', 'Mercury', 'Mars', 'opposition', row => row.lunarAdverseTargets.length > 0, true],
    ['p045', '1965-09-15', 'Mars', 'Jupiter', 'opposition', row => row.hasSameLayerAdverseSequence, true],
    ['p086', '1965-03-30', 'Mercury', 'Jupiter', 'parallel', row => row.natalState === 'all_favourable'
      || row.directionSupportState === 'favourable', true],
    ['p293', '1965-03-05', 'Venus', 'Jupiter', 'conjunction', row => row.natalState === 'all_favourable'
      || row.hasLunarBridge || row.venusJupiterEffectState === 'indirect-candidate'
      || (['mixed', 'conditional'].includes(row.sameLayerLunarState) && row.hasExactFavourableMoonToNatalEndpoint)
      || (row.progressedState === 'all_favourable' && row.hasExactFavourableMoonToProgressedEndpoint)
      || row.base.exactTimes.some(at => row.start <= at && at < row.end), true],
    ['p298', '1965-07-03', 'Venus', 'Jupiter', 'trine', row => row.natalState === 'all_favourable', true],
  ];
  for (const [id, date, body, target, aspect, accepts, hasHits] of cases) {
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const context = buildLeoSourceContext(interval, snapshot, buildWesternProgressions(interval, reference, snapshot), true);
    assert.equal(context.status, 'ready');
    const rows = buildLeoLunarConditions([...context.intervals, ...context.progressedPairs], [], [],
      context.progressedPairs, context.slowContraryPairs, context.additionalNatalContraryPairs)
      .filter(({ base }) => base.progressedBody === body && base.natalTargetId === target
        && base.targetKind === 'natal' && base.aspectType === aspect);
    const facts = rows.map(({ base, ...lunar }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...lunar, lunarProfile: leoLunarConditionPolicy.profile,
        hasSameLayerAdverseContact: lunar.lunarAdverseTargets.length > 0,
        mutualExactInSlice: id === 'p293' ? base.exactTimes.some(at => lunar.start <= at && at < lunar.end) : undefined },
    }));
    const result = evaluateFortuneRules('western', 'year', facts).find(rule => rule.knowledgeId.includes('-' + id + '-'));
    const selected = facts.filter((_, i) => accepts(rows[i]));
    if (['p043', 'p045', 'p077', 'p095', 'p269', 'p298'].includes(id)) {
      assert.deepEqual(result.required[0].hits, []);
      assert.equal(result.required[0].unknown, true);
    } else assert.deepEqual(result.required[0].hits, id === 'p066' ? facts : selected, id + ' ' + date);
    assert.equal(selected.length > 0, hasHits, id + ' ' + date);
    assert.ok(selected.length < rows.length);
    if (id === 'p043') {
      assert.deepEqual([...new Set(rows.filter(accepts).map(row => row.natalState))].sort(), ['all_adverse', 'all_favourable']);
      assert.ok(rows.some(row => row.natalState === 'mixed'));
    }
    if (id === 'p269' && !hasHits) assert.ok(rows.some(row => row.natalState === 'all_adverse'));
    if (id === 'p292') assert.ok(rows.some(row => row.lunarFavourableTargets.includes('Venus')));
    if (id === 'p340') {
      assert.ok(rows.some(row => row.lunarLinkedBodies.includes('Uranus') && row.hasUranianLunarParallelActivation));
      assert.ok(rows.every(row => row.exactLunarLinkedBodies.length === 0));
      assert.ok(rows.some(row => row.contacts.some(contact => contact.targetKind === 'natal' && contact.target === 'Venus'
        && contact.exactTimes.length > 0) && !row.exactLunarLinkedBodies.includes('Venus')));
      const withoutParallel = facts.map(fact => ({ ...fact,
        normalizedPayload: { ...fact.normalizedPayload, hasUranianLunarParallelActivation: false } }));
      const preview = evaluateFortuneRules('western', 'year', withoutParallel).find(rule => rule.knowledgeId === result.knowledgeId);
      assert.deepEqual(preview.required[0].hits, []);
    }
    if (id === 'p066') {
      const balance = date === '1970-06-25' ? 'harmonious-aspect' : 'no-reviewed-mitigation';
      assert.ok(rows.every(row => row.base.marsSaturnNatalBalanceBasis === balance), date);
      assert.ok(rows.filter(accepts).every(row => row.hasMarsSaturnAdverseLunarActivation));
      assert.deepEqual(result.exclusions, []);
    }
    if (id === 'p045') assert.ok(rows.filter(accepts).every(row => row.adverseSequence.first.start < row.adverseSequence.second.start));
    if (id === 'p095') assert.ok(rows.some(row => row.natalState === 'mixed' && accepts(row)));
    const withoutConditionFacts = facts.map(fact => ({ ...fact, factType: 'leo_progressed_aspect' }));
    const missing = evaluateFortuneRules('western', 'year', withoutConditionFacts).find(rule => rule.knowledgeId === result.knowledgeId);
    assert.equal(missing.required[0].hits.length, 0);
    assert.equal(missing.required[0].unknown, true);
  }
});

test('p340 separates exact Venus–Uranus geometry, either Moon endpoint and concurrent solar opposition', () => {
  const passage = row => row.knowledgeId.includes('-p340-');
  const confirmedCondition = /次限金星对本命天王星的梅花相有效时，次限月亮与该次限金星或该本命天王星实际成相/u;
  const appearsIn = (row, windows) => windows.some(window => row.activeFrom < window.endExclusive && window.start < row.activeTo);
  const evidence = (run, row) => matchFortuneKnowledge({ ...run, facts: [row] }).byMethod.western.find(passage);
  const annualFacts = (birth, year = 2026) => {
    const born = Date.parse(`${birth}T00:00:00Z`);
    const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const now = Date.UTC(year, 5, 15);
    const reference = { snapshotId: `leo-p340-${birth}`, chart: chart(born) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    // This regression isolates the original natal-target route. The independent
    // same-chart route is exercised through the full submission in its own test.
    const natalRun = { ...run, facts: run.facts.filter(({ factType, normalizedPayload: p }) => !(factType === 'leo_lunar_condition'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.targetKind === 'progressed' && p.aspectType === 'quincunx')) };
    const result = matchFortuneKnowledge(natalRun).byMethod.western.find(passage);
    const rows = natalRun.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'quincunx');
    const observed = rows.filter(({ normalizedPayload: p }) => p.exactLunarLinkedBodies.length > 0);
    const formation = rows.filter(({ normalizedPayload: p }) => p.mutualExactInSlice);
    const lunarParallels = rows.filter(({ normalizedPayload: p }) => p.hasUranianLunarParallelActivation);
    const progressedNeptuneSquares = rows.filter(({ normalizedPayload: p }) => p.hasExactProgressedVenusNeptuneSensitivityDirection);
    return { born, run: natalRun, result, rows, observed, formation, lunarParallels, progressedNeptuneSquares };
  };
  for (const birth of ['1966-11-27', '1980-03-18']) {
    const { born, run, result, rows, observed, formation, lunarParallels, progressedNeptuneSquares } = annualFacts(birth);
    const exactConfirmed = birth === '1966-11-27';
    assert.equal(result.status, 'matched', birth);
    const expected = exactConfirmed ? [...observed, ...formation, ...progressedNeptuneSquares] : lunarParallels;
    assert.deepEqual(new Set(result.sourceFactIds), new Set(expected.map(row => row.factId)));
    if (exactConfirmed) {
      const mixedAt = '2026-05-13T20:44:07.815Z';
      const mixed = observed.find(row => row.activeFrom === mixedAt);
      assert.ok(mixed);
      assert.equal(mixed.normalizedPayload.progressedState, 'mixed');
      assert.deepEqual(mixed.normalizedPayload.exactLunarLinkedBodies, ['Uranus']);
      const exact = evidence(run, mixed);
      assert.equal(exact.status, 'matched');
      assert.match(exact.matchedConditions[0], confirmedCondition);
      const lunarEpoch = Math.round(progressionEpoch(born, Date.parse(mixedAt)));
      const lunar = readLeoMovingPosition('Moon', lunarEpoch).longitude;
      const natal = readLeoMovingPosition('Uranus', born).longitude;
      assert.ok(Math.abs(Math.abs((lunar - natal + 540) % 360 - 180) - 60) < 0.00001);
      for (const instant of [Date.parse(mixedAt) - 1, Date.parse(mixed.activeTo)]) {
        const neighbour = rows.find(row => Date.parse(row.activeFrom) <= instant && instant < Date.parse(row.activeTo));
        assert.ok(neighbour);
        assert.equal(neighbour.normalizedPayload.progressedState, 'mixed');
        assert.deepEqual(neighbour.normalizedPayload.exactLunarLinkedBodies, []);
        assert.ok(!result.sourceFactIds.includes(neighbour.factId));
      }
      assert.ok(formation.every(row => appearsIn(row, result.windows)));
      assert.equal(progressedNeptuneSquares.length, 1);
      const [square] = progressedNeptuneSquares;
      const epoch = Math.round(progressionEpoch(born, Date.parse(square.activeFrom)));
      const venus = readLeoMovingPosition('Venus', epoch).longitude;
      const neptune = readLeoMovingPosition('Neptune', epoch).longitude;
      const separation = Math.abs((venus - neptune + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 90) < 0.00001);
      assert.ok(appearsIn(square, result.windows));
    }
    assert.ok(rows.every(({ normalizedPayload: p }) => p.hasUranianMoonSolarActivation === false));
    assert.ok(rows.some(({ normalizedPayload: p }) => p.lunarLinkedBodies.length && !p.exactLunarLinkedBodies.length));
    for (const [wrongTarget, wrongLayer] of [['Venus', 'natal'], ['Uranus', 'progressed']]) {
      assert.ok(rows.some(({ normalizedPayload: p }) => p.contacts.some(contact => contact.target === wrongTarget
        && contact.targetKind === wrongLayer && contact.exactTimes.length) && !p.exactLunarLinkedBodies.includes(wrongTarget)), birth);
    }
    if (birth === '1980-03-18') {
      assert.deepEqual(formation, []);
      assert.deepEqual(observed, []);
      assert.deepEqual(progressedNeptuneSquares, []);
      assert.ok(rows.every(row => row.normalizedPayload.mutualExactInSlice === false));
      const lunarBand = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
        && p.progressedBody === 'Moon' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'parallel');
      assert.ok(lunarBand);
      assert.equal(lunarBand.normalizedPayload.allowedOrb, 1);
      assert.ok(Math.abs(Date.parse(lunarBand.activeFrom) - Date.parse('2026-04-24T12:51:26.609Z')) < 1_000);
      assert.equal(run.facts.some(({ factType, parentSignalId }) => factType === 'leo_progressed_aspect_exact'
        && parentSignalId === lunarBand.parentSignalId), false);
      assert.ok(lunarParallels.length > 0);
      const [first] = lunarParallels;
      assert.equal(first.activeFrom, lunarBand.activeFrom);
      assert.deepEqual(first.normalizedPayload.uranianLunarParallelActivation,
        { body: 'Moon', target: 'Uranus', targetKind: 'natal', aspectType: 'parallel', passage: 'p214' });
      for (const row of lunarParallels) {
        assert.ok(lunarBand.activeFrom <= row.activeFrom && row.activeTo <= lunarBand.activeTo);
        const instant = (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2;
        const moon = readLeoMovingPosition('Moon', Math.round(progressionEpoch(born, instant))).declination;
        const uranus = readLeoMovingPosition('Uranus', born).declination;
        assert.ok(leoParallelDifference(moon, uranus) < 1);
      }
      const previous = rows.find(row => row.activeTo === first.activeFrom);
      assert.ok(previous && !result.sourceFactIds.includes(previous.factId));
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p340-lunar-parallel'));
      const lunarProse = /金天梅花有效段与次限月亮对同一本命天王星的一度赤纬平行重合/u;
      assert.match(formatFortuneFactAudit(input), lunarProse);
      const provider = formatFortunePrompt(input);
      assert.match(provider, /金天梅花的有效段与次限月亮对同一本命天王星的一度绝对赤纬平行实际重合/u);
      assert.doesNotMatch(provider, /金天梅花有效段与次限月亮的一度|uranianLunarParallelActivation|nervous disorders|lend money/u);
      assert.equal(evidence(run, previous).status, 'not_matched');
      assert.equal(evidence(run, { ...first, normalizedPayload: { ...first.normalizedPayload, targetKind: 'transit' } }).status, 'not_matched');
      assert.doesNotMatch(provider, confirmedCondition);
      continue;
    }
    assert.deepEqual(formation.map(row => row.activeFrom), ['2026-10-23T15:50:00.916Z']);
    const [point] = formation;
    const p = point.normalizedPayload;
    const instant = Date.parse(point.activeFrom);
    const epoch = Math.round(progressionEpoch(born, instant));
    const venus = readLeoMovingPosition('Venus', epoch).longitude, uranus = readLeoMovingPosition('Uranus', born).longitude;
    assert.ok(Math.abs(Math.abs((venus - uranus + 540) % 360 - 180) - 150) < 0.00001);
    assert.equal(Date.parse(point.activeTo), instant + 1_000);
    assert.deepEqual([p.exactLunarLinkedBodies, p.exactUranianSensitivityDirection, p.hasExactVenusNeptuneSensitivityDirection], [[], false, false]);
    assert.equal(evidence(run, point).status, 'matched');
    for (const at of [instant - 1, instant + 1_000]) {
      const adjacent = rows.find(row => Date.parse(row.activeFrom) <= at && at < Date.parse(row.activeTo));
      assert.ok(adjacent && !result.sourceFactIds.includes(adjacent.factId));
      assert.equal(evidence(run, adjacent).status, 'not_matched');
    }
    const assess = changes => evaluateFortuneRules('western', 'year', [{ ...point, normalizedPayload: { ...p, ...changes } }])
      .find(passage).required[0];
    assert.equal(assess({ targetKind: 'transit' }).hits.length, 0);
    assert.equal(assess({ coordinate: 'equatorial_declination_of_date' }).hits.length, 0);
    const unreviewed = assess({ mutualExactInSlice: undefined });
    assert.deepEqual([unreviewed.hits.length, unreviewed.unknown], [0, true]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p340-formation'));
    const formationProse = '次限金星对本命天王星实际形成梅花相，原书列作较弱背景';
    assert.ok(formatFortuneFactAudit(input).includes(formationProse));
    const provider = formatFortunePrompt(input);
    assert.match(provider, confirmedCondition);
    assert.match(provider, /是否感到更容易受他人影响，仍视当事人的实际处境/u);
    assert.ok(!provider.includes(formationProse));
    assert.doesNotMatch(provider, /exactLunarLinkedBodies|hasUranianMoonSolarActivation/u);
    for (const [target, layer, aspect, angle] of [['Venus', 'progressed', 'quincunx', 150], ['Uranus', 'natal', 'sextile', 60]]) {
      const point = observed.find(({ activeFrom, normalizedPayload: p }) => p.exactLunarLinkedBodies.includes(target)
        && p.contacts.some(contact => contact.targetKind === layer && contact.target === target && contact.aspectType === aspect
          && contact.exactTimes.includes(activeFrom)));
      assert.ok(point, target);
      const epoch = progressionEpoch(born, Date.parse(point.activeFrom));
      const moon = readLeoMovingPosition('Moon', Math.round(epoch)).longitude;
      const destination = readLeoMovingPosition(target, layer === 'natal' ? born : Math.round(epoch)).longitude;
      const separation = Math.abs((moon - destination + 540) % 360 - 180);
      assert.ok(Math.abs(separation - angle) < 0.00001);
      assert.ok(Date.parse(point.activeTo) - Date.parse(point.activeFrom) <= 1_000);
      assert.equal(evidence(run, point).status, 'matched');
      const transitLayer = { ...point, normalizedPayload: { ...point.normalizedPayload, targetKind: 'transit' } };
      assert.equal(evidence(run, transitLayer).status, 'not_matched');
    }
  }

  for (const [birth, concurrent, date] of [['1967-01-15', true, '2026-08-19'], ['1997-07-02', false, '2026-05-30']]) {
    const { born, run, result, rows, observed, formation, lunarParallels, progressedNeptuneSquares } = annualFacts(birth);
    const isOpposition = p => p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus'
      && p.aspectType === 'opposition' && p.targetKind === 'natal';
    const solarPoint = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect_exact' && isOpposition(p));
    assert.ok(solarPoint?.exactInstant?.startsWith(date));
    const time = Date.parse(solarPoint.exactInstant);
    const epoch = Math.round(progressionEpoch(born, time));
    const uranus = readLeoMovingPosition('Uranus', born).longitude;
    const separation = (body, at) => Math.abs((readLeoMovingPosition(body, at).longitude - uranus + 540) % 360 - 180);
    assert.ok(Math.abs(separation('Sun', epoch) - 180) < 0.00001);
    assert.equal(Math.abs(separation('Venus', epoch) - 150) < 1, concurrent);
    const solarWitnesses = rows.filter(({ normalizedPayload: p }) => p.exactUranianSensitivityDirection);
    assert.equal(solarWitnesses.length, concurrent ? 1 : 0);
    const candidates = [...solarWitnesses, ...formation, ...lunarParallels, ...progressedNeptuneSquares];
    const expected = observed.length ? [...observed, ...formation, ...solarWitnesses, ...progressedNeptuneSquares] : candidates;
    assert.deepEqual(new Set(result.sourceFactIds), new Set(expected.map(row => row.factId)));
    if (!concurrent) continue;
    const [witness] = solarWitnesses;
    assert.equal(result.status, 'matched');
    const solarOnly = evidence(run, witness);
    assert.equal(solarOnly.status, 'matched');
    assert.equal(solarOnly.matchedSourceExcerpt, 'other influences of a similar nature are operating');
    assert.match(solarOnly.matchedConditions.join('\n'), /他人意愿可能影响自己的选择/u);
    assert.deepEqual(solarOnly.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    assert.ok(appearsIn(witness, result.windows));
    assert.equal(witness.activeFrom, solarPoint.exactInstant);
    assert.ok(Date.parse(witness.activeTo) - time <= 1_000);
    assert.deepEqual(witness.normalizedPayload.exactLunarLinkedBodies, []);
    const only = changes => evidence(run, { ...witness, normalizedPayload: { ...witness.normalizedPayload, ...changes } });
    assert.equal(only({ targetKind: 'progressed' }).status, 'not_matched');
    assert.equal(only({ exactUranianSensitivityDirection: undefined }).status, 'unknown');
    for (const edge of [time - 1, time + 1_000]) {
      const adjacent = rows.find(row => Date.parse(row.activeFrom) <= edge && edge < Date.parse(row.activeTo));
      assert.ok(adjacent);
      assert.equal(adjacent.normalizedPayload.exactUranianSensitivityDirection, false);
      assert.equal(evidence(run, adjacent).status, 'not_matched');
    }
    const solarBand = run.facts.find(({ factType, normalizedPayload: p, parentSignalId }) =>
      factType === 'leo_progressed_aspect' && isOpposition(p) && parentSignalId === solarPoint.parentSignalId);
    assert.ok(solarBand);
    const joined = observed.filter(({ normalizedPayload: p }) => p.hasUranianMoonSolarActivation);
    assert.deepEqual(joined.map(row => row.activeFrom), ['2026-05-27T08:08:06.365Z']);
    assert.ok(solarBand.activeFrom <= joined[0].activeFrom && joined[0].activeTo <= solarBand.activeTo);
    assert.deepEqual(joined[0].normalizedPayload.exactLunarLinkedBodies, ['Uranus']);
    assert.equal(joined[0].normalizedPayload.exactUranianSensitivityDirection, false);
    assert.ok(result.sourceFactIds.includes(joined[0].factId));
    const combined = evidence(run, joined[0]);
    assert.equal(combined.status, 'matched');
    assert.equal(combined.windows[0].start, joined[0].activeFrom);
    assert.equal(combined.windows[0].endExclusive, joined[0].activeTo);
    assert.match(combined.matchedConditions.join('\n'), /同时具备月亮引动和原书另述的太阳同主题条件/u);
    assert.match(evidence(run, { ...joined[0], normalizedPayload: {
      ...joined[0].normalizedPayload, hasUranianMoonSolarActivation: false,
    } }).matchedConditions.join('\n'), confirmedCondition);
    assert.ok(rows.some(({ activeFrom, activeTo, normalizedPayload: p }) => !p.exactUranianSensitivityDirection
      && solarBand.activeFrom < activeTo && activeFrom < solarBand.activeTo));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p340-solar'));
    const solarProse = /金天有效段内，次限太阳精确对冲同一本命天王星/u;
    assert.ok(solarProse.test(formatFortuneFactAudit(input)), 'keep the independently observed solar point in the local audit');
    assert.doesNotMatch(formatFortunePrompt(input), solarProse);
    assert.match(formatFortuneFactAudit(input), /月亮实际引动金天梅花时，次限太阳对同一本命天王星的对冲也在有效段内/u);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /同时具备月亮引动和原书另述的太阳同主题条件/u);
    assert.match(provider, /他人意愿可能影响自己的选择/u);
    assert.doesNotMatch(provider, /月亮实际引动金天梅花时|hasUranianMoonSolarActivation|exactUranianSensitivityDirection|2026-05-27T08:08:06|nervous disorders|lend money/u);
  }

  const parallelSample = annualFacts('1929-09-16', 1946);
  const { born: parallelBirth, run: parallelRun, rows: parallelRows } = parallelSample;
  const parallelWithSun = parallelRows.filter(({ normalizedPayload: p }) => p.hasUranianLunarParallelActivation
    && p.hasUranianMoonSolarActivation && !p.exactLunarLinkedBodies.length);
  assert.ok(parallelWithSun.length, 'Moon–Uranus parallel can overlap the solar opposition without a lunar exact point');
  const uranus = readLeoMovingPosition('Uranus', parallelBirth);
  const solarBands = parallelRun.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'opposition' && p.targetKind === 'natal');
  for (const row of parallelWithSun) {
    const epoch = Math.round(progressionEpoch(parallelBirth, (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2));
    assert.ok(leoParallelDifference(readLeoMovingPosition('Moon', epoch).declination, uranus.declination) < 1);
    assert.ok(solarBands.some(sun => sun.activeFrom <= row.activeFrom && row.activeTo <= sun.activeTo));
    const match = evidence(parallelRun, row);
    assert.equal(match.status, 'matched');
    assert.match(match.matchedConditions.join('\n'), /同时具备月亮引动和原书另述的太阳同主题条件/u);
  }

  const base = { progressedBody: 'Venus', natalTargetId: 'Uranus', aspectType: 'quincunx',
    targetKind: 'natal', coordinate: 'ecliptic_longitude', start: 0, end: 10_000, exactTimes: [] };
  const solar = { ...base, progressedBody: 'Sun', aspectType: 'opposition', end: 7_000 };
  const lunar = { ...base, progressedBody: 'Moon', aspectType: 'sextile' };
  const parallel = { ...lunar, aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1 };
  const rows = buildLeoLunarConditions([base,
    { ...solar, targetKind: 'progressed', exactTimes: [1_000] },
    { ...solar, exactTimes: [2_000, solar.end] },
    { ...lunar, exactTimes: [4_000, solar.end] },
    { ...lunar, targetKind: 'progressed', exactTimes: [5_000] },
    { ...parallel, targetKind: 'progressed', end: 1_000 },
    { ...parallel, allowedOrb: 0.25, end: 1_000 },
    { ...parallel, natalTargetId: 'Venus', end: 1_000 },
    { ...parallel, start: 6_000, end: 7_500 },
    { ...parallel, start: 8_000, end: 9_000 },
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.filter(row => row.exactUranianSensitivityDirection).map(row => [row.start, row.end]), [[2_000, 3_000]]);
  assert.deepEqual(rows.filter(row => row.hasUranianMoonSolarActivation).map(row => [row.start, row.end]), [[4_000, 5_000], [6_000, 7_000]]);
  assert.deepEqual(rows.filter(row => row.hasUranianLunarParallelActivation).map(row => [row.start, row.end]),
    [[6_000, 7_000], [7_000, 7_500], [8_000, 9_000]]);
});

test('source rows separate required same-layer lunar matching from the Mars–Saturn basis', () => {
  const states = ['none', 'all_favourable', 'all_adverse', 'mixed', 'conditional'];
  const groups = [
    [['p294', 'p302'], ['all_favourable']],
    [['p330'], ['all_adverse']],
    [['p059'], states],
  ];
  for (const [ids, expected] of groups) for (const id of ids) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + id + '-'));
    const entry = fortuneKnowledge.western.entries.find(row => row.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.equal(rule.unresolved.length, 0, id);
    const [query] = rule.queries;
    assert.equal(query.factType, 'leo_lunar_condition', id);
    const payload = Object.fromEntries(Object.entries(query.where).map(([key, value]) => [key,
      value?.oneOf?.[0] ?? (value?.includesAny ? [value.includesAny[0]] : value)]));
    const evaluate = rows => evaluateFortuneRules('western', 'year', rows).find(row => row.knowledgeId === rule.knowledgeId).required[0];
    const facts = states.map(state => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...payload, sameLayerLunarState: state, directionSupportState: payload.directionSupportState ?? 'none',
        ...(id === 'p059' ? { mutualExactInSlice: true } : {}),
        hasOtherSameLayerDirection: false,
        hasSameLayerAdverseContact: !['none', 'all_favourable'].includes(state) } }));
    assert.deepEqual(evaluate(facts).hits.map(row => row.normalizedPayload.sameLayerLunarState),
      states.filter(state => expected.includes(state)), id);
    assert.equal(evaluate(facts.map(fact => ({ ...fact, factType: 'leo_progressed_aspect' }))).hits.length, 0, id);
    assert.equal(evaluate(facts.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload,
      lunarProfile: 'other' } }))).hits.length, 0, id);
  }
});

test('alternate direction evidence respects the chart layer and stays separate from exact mutual aspects', () => {
  for (const [id, targetKind, expected] of [
    ['p037', 'natal', [[2, 5], [7, 10]]],
    ['p310', 'natal', [[7, 10]]],
    ['p311', 'natal', [[7, 10]]],
  ]) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + id + '-'));
    const [query] = rule.queries;
    const { progressedBody, natalTargetId, aspectType } = query.where;
    const band = (start, end, progressedBody, natalTargetId, aspectType, layer = targetKind) =>
      ({ start, end, progressedBody, natalTargetId, aspectType, targetKind: layer, exactTimes: [] });
    const base = band(0, 12, progressedBody, natalTargetId, aspectType);
    const oppositeLayer = targetKind === 'natal' ? 'progressed' : 'natal';
    const rows = buildLeoLunarConditions([base, { ...base },
      band(0, 2, 'Sun', 'Jupiter', 'square', oppositeLayer),
      band(2, 7, 'Sun', 'Jupiter', 'trine'),
      band(5, 10, 'Sun', 'Saturn', 'square'),
      band(12, 14, 'Sun', 'Saturn', 'square'),
      ...(id === 'p311' ? [band(7, 10, 'Moon', 'Saturn', 'square')] : []),
      ...(targetKind === 'progressed' ? [band(10, 12, natalTargetId, progressedBody, aspectType)] : []),
    ]).filter(row => row.base === base);
    const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: query.scope, completeness: 'complete',
      normalizedPayload: { ...query.where, targetKind, start: row.start, end: row.end,
        sameLayerLunarState: row.sameLayerLunarState, directionSupportState: row.directionSupportState,
        hasOtherSameLayerDirection: row.hasOtherSameLayerDirection } }));
    const evaluate = evidence => evaluateFortuneRules('western', 'year', evidence)
      .find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
    const supporting = rows.filter(row => id === 'p037' ? ['favourable', 'adverse'].includes(row.directionSupportState)
      : row.sameLayerLunarState === 'all_adverse' || id === 'p310' && row.directionSupportState === 'adverse');
    assert.deepEqual(supporting.map(row => [row.start, row.end]), expected, id);
    const point = { factType: 'leo_mutual_exact_observation', scope: query.scope, completeness: 'complete',
      normalizedPayload: { ...query.where, targetKind, observed: true, start: 1 } };
    assert.deepEqual(evaluate([...facts, point]), [point], id);
  }
});

test('Mars–Saturn accepts Sun and Moon links only to the actual endpoints and only during the common half-open slice', () => {
  const base = { start: 0, end: 12, progressedBody: 'Mars', natalTargetId: 'Saturn', targetKind: 'natal',
    aspectType: 'semisquare', exactTimes: [] };
  const contact = (body, target, targetKind, start, end) =>
    ({ ...base, progressedBody: body, natalTargetId: target, targetKind, start, end });
  const rows = buildLeoLunarConditions([base,
    contact('Moon', 'Mercury', 'natal', 0, 12),
    contact('Sun', 'Mars', 'natal', 0, 2),
    contact('Sun', 'Saturn', 'progressed', 2, 4),
    contact('Sun', 'Saturn', 'natal', 4, 8),
    contact('Moon', 'Mars', 'progressed', 8, 10),
    contact('Sun', 'Jupiter', 'natal', 10, 12),
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.sameLayerLunarState, row.luminaryLinkedBodies]),
    [[0, 4, 'all_adverse', []], [4, 8, 'all_adverse', ['Saturn']], [8, 10, 'all_adverse', ['Mars']], [10, 12, 'all_adverse', []]]);
  assert.deepEqual(rows[1].luminaryLinks, [{ body: 'Sun', target: 'Saturn', targetKind: 'natal', aspectType: 'semisquare' }]);
  assert.deepEqual(rows[2].luminaryLinks, [{ body: 'Moon', target: 'Mars', targetKind: 'progressed', aspectType: 'semisquare' }]);
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-p059-'));
  const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, ...base, ...row, luminaryLinkedBodies: row.luminaryLinkedBodies,
      mutualExactInSlice: false, pairLuminaryLinksComplete: false } }));
  const result = evaluateFortuneRules('western', 'year', facts).find(item => item.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits, []);
  const longitude = 'ecliptic_longitude';
  const wrongLayer = { ...contact('Moon', 'Mars', 'natal', 0, 12_000), coordinate: longitude, exactTimes: [1_000] };
  const movingMars = { ...wrongLayer, targetKind: 'progressed', exactTimes: [2_000] };
  const natalSaturn = { ...wrongLayer, natalTargetId: 'Saturn', exactTimes: [4_000] };
  const observedBase = { ...base, coordinate: longitude, end: 12_000, exactTimes: [8_000] };
  const evidence = buildLeoLunarConditions([observedBase, wrongLayer, movingMars, natalSaturn]).filter(row => row.base === observedBase);
  assert.deepEqual(evidence.filter(row => row.hasExactAdverseMoonToProgressedEndpoint).map(({ start, end }) => [start, end]), [[2_000, 3_000]]);
  assert.deepEqual(evidence.filter(row => row.hasExactAdverseMoonToNatalEndpoint).map(({ start, end }) => [start, end]), [[4_000, 5_000]]);
});

test('a client-submitted Mars–Saturn year keeps actual Sun contacts through SQLite and Chinese prompt rendering', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const moment = Date.parse('2026-06-15T00:00:00Z');
  const fixtureBirth = Date.parse('1971-11-29T00:00:00Z');
  const reference = { snapshotId: 'leo-luminary-link-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, moment, { ...reference, chart: chart(fixtureBirth) })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, moment), 'leo-luminary-link', reference);
  validateFortuneFacts(run);
  const rows = run.facts.filter(f => f.factType === 'leo_lunar_condition' && f.normalizedPayload.targetKind === 'natal'
    && f.normalizedPayload.progressedBody === 'Mars' && f.normalizedPayload.natalTargetId === 'Saturn'
    && f.normalizedPayload.aspectType === 'semisquare');
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p059-'));
  assert.ok(rows.some(row => !row.normalizedPayload.luminaryLinks.length));
  const expected = rows.filter(({ normalizedPayload: p }) => p.luminaryLinks.length
    && (p.sameLayerLunarState === 'all_adverse' || p.directionSupportState === 'adverse'));
  const lunarTriggers = rows.filter(({ normalizedPayload: p }) => p.exactLunarLinkedBodies.length > 0);
  assert.deepEqual(lunarTriggers.map(row => [row.activeFrom, row.normalizedPayload.exactLunarLinkedBodies]),
    [['2026-03-26T12:38:04.607Z', ['Mars']], ['2026-04-07T20:46:24.485Z', ['Saturn']]]);
  assert.deepEqual(lunarTriggers.map(({ normalizedPayload: p }) =>
    [p.exactAdverseMoonToNatalEndpoint, p.exactAdverseMoonToProgressedEndpoint]), [
    [undefined, { body: 'Moon', target: 'Mars', targetKind: 'progressed', aspectType: 'conjunction' }],
    [{ body: 'Moon', target: 'Saturn', targetKind: 'natal', aspectType: 'semisquare' }, undefined],
  ]);
  assert.ok(rows.every(row => row.normalizedPayload.exactSolarLinkedBodies.length === 0));
  assert.equal(result.status, 'matched');
  const exactOrLunar = rows.filter(({ factId, normalizedPayload: p }) => p.mutualExactInSlice
    || lunarTriggers.some(row => row.factId === factId));
  assert.deepEqual(new Set(result.sourceFactIds), new Set(exactOrLunar.map(row => row.factId)));
  const solarOnly = expected.find(row => row.normalizedPayload.luminaryLinks.length === 1
    && row.normalizedPayload.luminaryLinks[0].body === 'Sun' && row.normalizedPayload.exactSolarLinkedBodies.length === 0);
  assert.ok(solarOnly);
  assert.ok(!result.sourceFactIds.includes(solarOnly.factId));
  assert.deepEqual(solarOnly.normalizedPayload.luminaryLinks,
    [{ body: 'Sun', target: 'Saturn', targetKind: 'natal', aspectType: 'trine' }]);
  const sample = (Date.parse(solarOnly.activeFrom) + Date.parse(solarOnly.activeTo)) / 2;
  const progressedSun = SunPosition(new Date(Math.round(progressionEpoch(fixtureBirth, sample)))).elon;
  const natalSaturn = Ecliptic(GeoVector(Body.Saturn, new Date(fixtureBirth), true)).elon;
  const angle = Math.abs((progressedSun - natalSaturn + 540) % 360 - 180);
  assert.ok(Math.abs(angle - 120) < 1);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-luminary-link-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /同段次限太阳照到这对星的本命土星，形成三分相/u);
  assert.ok(!prompt.includes('只供准备倾向参考，显化仍须月亮合参'));
  assert.doesNotMatch(prompt, /luminaryLinkedBodies|luminaryLinks/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
});

test('the lunar branch of Sun-Jupiter parallel requires a favourable Moon contact to the same Jupiter', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const run = calculateFortuneFacts(params, buildFactTimeContext(params, Date.parse('2026-11-18T04:00:00Z'), 'server'),
    'leo-jupiter-lunar', { snapshotId: 'leo-jupiter-lunar-chart', chart: chart(Date.parse('1989-04-23T12:00:00Z')) });
  validateFortuneFacts(run);
  const rows = run.facts.filter(f => f.factType === 'leo_lunar_condition' && f.normalizedPayload.progressedBody === 'Sun'
    && f.normalizedPayload.natalTargetId === 'Jupiter' && f.normalizedPayload.aspectType === 'parallel');
  const result = matchFortuneKnowledge(run).byMethod.western.find(r => r.knowledgeId.includes('-p234-'));
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  assert.ok(result.windows.some(w => w.start < '2026-02-18T00:00:00.000Z' && w.endExclusive > '2026-02-18T00:00:00.000Z'));
  assert.ok(rows.some(row => row.normalizedPayload.lunarFavourableTargets.includes('Venus')
    && !row.normalizedPayload.lunarFavourableTargets.includes('Jupiter')));
  assert.deepEqual(new Set(result.sourceFactIds), new Set(rows.map(row => row.factId)));
  const strengthened = rows.filter(row =>
    row.normalizedPayload.contacts.some(c => c.targetKind === row.normalizedPayload.targetKind
      && c.target === 'Jupiter' && c.nature === 'favourable'));
  assert.ok(strengthened.length > 0 && strengthened.length < rows.length);
  const older = { ...run, facts: run.facts.filter(f => f.factType !== 'leo_lunar_condition') };
  assert.equal(matchFortuneKnowledge(older).byMethod.western.find(r => r.knowledgeId.includes('-p234-')).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-jupiter-report'));
  assert.match(formatFortuneFactAudit(input), /月亮对同层木星偏顺相位/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(match => match.knowledgeId === result.knowledgeId));
});

test('solar parallels use the named same-layer square or shared-endpoint support in their own intervals', () => {
  for (const [id, target, targetKind] of [
    ['p234', 'Jupiter', 'natal'], ['p234', 'Jupiter', 'progressed'], ['p292', 'Venus', 'natal'],
  ]) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + id + '-'));
    const [query] = rule.queries;
    const otherLayer = targetKind === 'natal' ? 'progressed' : 'natal';
    const band = (start, end, progressedBody, natalTargetId, aspectType, layer = targetKind) =>
      ({ start, end, progressedBody, natalTargetId, aspectType, targetKind: layer, exactTimes: [] });
    const base = band(0, 14, 'Sun', target, 'parallel');
    const conditions = target === 'Jupiter' ? [
      band(0, 3, 'Sun', 'Jupiter', 'square', otherLayer),
      band(0, 3, 'Sun', 'Saturn', 'square'),
      targetKind === 'natal' ? band(3, 7, 'Sun', 'Jupiter', 'square') : band(3, 7, 'Jupiter', 'Sun', 'square'),
      band(7, 10, 'Sun', 'Jupiter', 'sesquiquadrate'),
      band(14, 15, 'Sun', 'Jupiter', 'square'),
    ] : [
      band(0, 3, 'Sun', 'Mars', 'sextile', otherLayer),
      band(0, 3, 'Mercury', 'Jupiter', 'trine'),
      band(3, 8, 'Sun', 'Mars', 'sextile'),
      band(5, 10, 'Sun', 'Saturn', 'square'),
    ];
    const rows = buildLeoLunarConditions([base, ...conditions, band(10, 12, 'Moon', target, 'sextile')])
      .filter(row => row.base === base);
    const facts = rows.map(row => ({ factType: query.factType, scope: query.scope, completeness: 'complete',
      normalizedPayload: { ...query.where, targetKind, start: row.start, end: row.end,
        lunarFavourableTargets: row.lunarFavourableTargets, directionSupportState: row.directionSupportState,
        hasAdverseSolarDirection: row.hasAdverseSolarDirection, concurrentSolarJupiterSquare: row.concurrentSolarJupiterSquare } }));
    const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
    const hits = result.required[0].hits.map(({ normalizedPayload: p }) => [p.start, p.end, p.directionSupportState]);
    if (target === 'Jupiter') {
      assert.deepEqual(result.required[0].hits, facts);
      assert.deepEqual(facts.filter(row => row.normalizedPayload.concurrentSolarJupiterSquare)
        .map(({ normalizedPayload: p }) => [p.start, p.end]), [[3, 7]]);
    } else {
      assert.deepEqual(hits, [[10, 12, 'none']], id + ' ' + targetKind);
      assert.deepEqual(rows.filter(row => ['favourable', 'mixed'].includes(row.directionSupportState))
        .map(row => [row.start, row.end]), [[3, 5], [5, 8]]);
    }
  }
});

test('solar parallel co-directions reach SQLite and Chinese input through client-submitted ephemeris facts', () => {
  for (const [id, birthDate, year, target, targetKind, support] of [
    ['p234', '1955-08-31', 2026, 'Jupiter', 'natal', ['Sun', 'Jupiter', 'square']],
    ['p234', '1964-11-17', 2045, 'Jupiter', 'progressed', ['Sun', 'Jupiter', 'square']],
    ['p292', '1955-05-25', 2045, 'Venus', 'natal', ['Sun', 'Mars', 'sextile']],
  ]) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(year, 5, 15);
    const reference = { snapshotId: 'solar-parallel-' + id + '-' + targetKind };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, {
      ...reference, chart: chart(Date.parse(birthDate + 'T00:00:00Z')),
    })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), id, reference);
    validateFortuneFacts(run);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + id + '-'));
    if (id === 'p234') assert.equal(result.status, 'matched');
    else assert.ok(['matched', 'not_matched'].includes(result.status));
    const [body, contactTarget, aspectType] = support;
    const witness = run.facts.find(fact => fact.factType === 'leo_lunar_condition'
      && fact.normalizedPayload.progressedBody === 'Sun' && fact.normalizedPayload.natalTargetId === target
      && fact.normalizedPayload.aspectType === 'parallel'
      && fact.normalizedPayload.targetKind === targetKind && !fact.normalizedPayload.lunarFavourableTargets.includes(target)
      && fact.normalizedPayload.supportingDirections.some(direction => direction.targetKind === targetKind
        && direction.body === body && direction.target === contactTarget && direction.aspectType === aspectType));
    assert.ok(witness, id + ' ' + targetKind);
    if (id === 'p234') assert.equal(witness.normalizedPayload.concurrentSolarJupiterSquare, true);
    else assert.ok(!result.sourceFactIds.includes(witness.factId));
    for (const [moving, receiver, aspect] of [['Sun', target, 'parallel'], support]) {
      assert.ok(run.facts.some(fact => fact.factType === 'leo_progressed_aspect'
        && fact.normalizedPayload.progressedBody === moving && fact.normalizedPayload.natalTargetId === receiver
        && fact.normalizedPayload.aspectType === aspect && fact.normalizedPayload.targetKind === targetKind
        && fact.activeFrom <= witness.activeFrom && witness.activeTo <= fact.activeTo));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.ok(input.facts.some(({ type, data }) => type === 'leo_lunar_condition'
      && data.progressedBody === 'Sun' && data.natalTargetId === target && data.aspectType === 'parallel'
      && data.targetKind === targetKind && !data.lunarFavourableTargets.includes(target)
      && data.supportingDirections.some(direction => direction.targetKind === targetKind
        && direction.body === body && direction.target === contactTarget && direction.aspectType === aspectType)), id + ' ' + targetKind);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, id === 'p234' ? /同段另一条推运是次限太阳对(?:本命|同图次限)木星的四分相/u
      : /与太阳或金星共享实际端点的偏顺推运用于合参/u);
  }
});

test('adverse series need two different same-layer directions before the uninterrupted window qualifies in SQLite', () => {
  for (const [id, first, target, aspectType] of [
    ['p045', 'Mars', 'Jupiter', 'opposition'],
    ['p124', 'Mercury', 'Uranus', 'quincunx'],
  ]) {
    const base = { start: 1, end: 21, targetKind: 'natal', progressedBody: first, natalTargetId: target, aspectType, exactTimes: [] };
    const moon = (start, end, natalTargetId, aspect, targetKind = 'natal') =>
      ({ start, end, targetKind, progressedBody: 'Moon', natalTargetId, aspectType: aspect, exactTimes: [] });
    const rows = buildLeoLunarConditions([base, moon(0, 4, 'Venus', 'square'),
      moon(4, 8, 'Venus', 'square'), moon(8, 10, 'Venus', 'semisquare'),
      moon(9, 13, 'Mars', 'opposition'), moon(13, 14, 'Neptune', 'trine'),
      moon(14, 17, 'Saturn', 'opposition'), moon(15, 18, 'Uranus', 'square', 'progressed'),
      moon(18, 20, 'Mars', 'opposition'),
    ]).filter(row => row.base === base);
    const qualifying = rows.filter(row => row.hasSameLayerAdverseSequence);
    assert.deepEqual(qualifying.map(row => [row.start, row.end]), [[8, 9], [9, 10], [10, 13]], id);
    assert.ok(qualifying.every(row => row.adverseSequence.first.start === 0 && row.adverseSequence.second.start === 8));
    assert.deepEqual(qualifying[0].adverseSequence, {
      first: { start: 0, target: 'Venus', aspectType: 'square' },
      second: { start: 8, target: 'Venus', aspectType: 'semisquare' }, end: 13,
    });
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + id + '-'));
    const payload = rule.queries[0].where;
    const facts = rows.map(({ hasSameLayerAdverseSequence }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...payload, hasSameLayerAdverseSequence, hasNatalMercuryBroadStudyTestimony: false, mutualExactInSlice: false },
    }));
    const hit = records => evaluateFortuneRules('western', 'year', records).find(row => row.knowledgeId === rule.knowledgeId).required[0];
    if (id === 'p045') {
      assert.deepEqual(hit(facts).hits, []);
      continue;
    }
    assert.deepEqual(hit(facts).hits, facts.filter((_, index) => qualifying.includes(rows[index])));
    if (id === 'p124') {
      const natal = { ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload, hasNatalMercuryBroadStudyTestimony: true } };
      assert.equal(natal.normalizedPayload.hasSameLayerAdverseSequence, false);
      assert.deepEqual(hit([natal]).hits, [natal]);
    }
    const unknown = hit([{ ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload, hasSameLayerAdverseSequence: undefined } }]);
    assert.equal(unknown.unknown, true);
    assert.equal(unknown.hits.length, 0);
  }
});

test('adverse series distinguish simultaneous clipped contacts from a later independent onset', () => {
  const base = { start: 5, end: 15, targetKind: 'natal', progressedBody: 'Mercury', natalTargetId: 'Uranus',
    aspectType: 'quincunx', exactTimes: [] };
  const moon = (start, end, natalTargetId, aspectType, targetKind = 'natal') => ({
    ...base, start, end, natalTargetId, aspectType, targetKind, progressedBody: 'Moon', clippedStart: start === 0,
  });
  const first = moon(0, 6, 'Venus', 'square');
  const tied = moon(0, 9, 'Mars', 'opposition');
  const duplicate = moon(6, 9, 'Venus', 'square');
  const wrongLayer = moon(7, 10, 'Mercury', 'square', 'progressed');
  const lunarRows = bands => buildLeoLunarConditions([base, ...bands]).filter(row => row.base === base);
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-p124-'));
  const requiredHits = rows => {
    const facts = rows.map(({ start, hasSameLayerAdverseSequence }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, start, hasSameLayerAdverseSequence,
        hasNatalMercuryBroadStudyTestimony: false, mutualExactInSlice: false },
    }));
    return evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId)
      .required[0].hits.map(row => row.normalizedPayload.start);
  };
  for (const bands of [[first, tied], [tied, first]]) {
    const rows = lunarRows([...bands, duplicate, wrongLayer]);
    assert.deepEqual(requiredHits(rows), []);
    assert.ok(rows.every(row => !row.hasSameLayerAdverseSequence));
  }

  const existing = lunarRows([first, { ...tied, start: 2, clippedStart: false }, duplicate]);
  assert.deepEqual(requiredHits(existing), [5, 6]);
  assert.deepEqual(existing[0].adverseSequence, {
    first: { start: 0, target: 'Venus', aspectType: 'square' },
    second: { start: 2, target: 'Mars', aspectType: 'opposition' }, end: 9,
  });

  const adjacent = lunarRows([first, tied, duplicate, moon(9, 10, 'Mercury', 'square'), moon(11, 13, 'Saturn', 'square')]);
  assert.deepEqual(requiredHits(adjacent), [9]);
  assert.deepEqual(adjacent.find(row => row.start === 9).adverseSequence.second,
    { start: 9, target: 'Mercury', aspectType: 'square' });
});

test('classified direction tendencies trace to an exact source pair, angle and supported target chart', () => {
  for (const [key, source] of Object.entries(leoDirectionNatures)) {
    const [progressedBody, natalTargetId, aspectType] = key.split(':');
    const query = fortuneKnowledge.western.rules.find(rule => rule.knowledgeId.includes('-' + source.passage + '-')).queries[0];
    assert.deepEqual([query.where.progressedBody, query.where.natalTargetId, query.where.aspectType],
      [progressedBody, natalTargetId, aspectType]);
    assert.equal(query.where.targetKind === 'natal', Boolean(source.natalOnly));
    const natal = { start: 0, end: 1, progressedBody, natalTargetId, aspectType, targetKind: 'natal' };
    const [recognized] = classifyLeoDirections([natal]);
    assert.equal(recognized.nature, source.nature);
    assert.equal(recognized.passage, source.passage);
    const reversed = { ...natal, progressedBody: natalTargetId, natalTargetId: progressedBody };
    assert.equal(classifyLeoDirections([reversed]).length, 0);
    assert.equal(classifyLeoDirections([{ ...reversed, targetKind: 'progressed' }]).length, source.natalOnly ? 0 : 1);
  }
});

test('solar and mutual support stays in the actual chart and changes only at a classified contact boundary', () => {
  const direction = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ start, end, progressedBody: body, natalTargetId: target, aspectType, targetKind, exactTimes: [] });
  const base = direction('Moon', 'Mercury', 'conjunction', 0, 20);
  const rows = buildLeoLunarConditions([base,
    direction('Sun', 'Jupiter', 'trine', 2, 9), direction('Sun', 'Saturn', 'square', 6, 12),
    direction('Mercury', 'Jupiter', 'trine', 0, 20, 'progressed'),
    direction('Sun', 'Jupiter', 'sextile', 12, 20, 'progressed'),
    direction('Sun', 'Mars', 'trine', 12, 18),
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.directionSupportState]),
    [[0, 2, 'none'], [2, 6, 'favourable'], [6, 9, 'mixed'], [9, 12, 'adverse'], [12, 18, 'favourable'], [18, 20, 'none']]);
  assert.deepEqual(rows[2].supportingDirections.map(row => row.passage), ['p230', 'p271']);
  const rule = fortuneKnowledge.western.rules.find(item => item.knowledgeId.includes('-p165-'));
  const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, ...base, directionSupportState: row.directionSupportState } }));
  const result = evaluateFortuneRules('western', rule.period, facts).find(item => item.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits, []);
  assert.deepEqual(rows.filter(row => ['favourable', 'adverse'].includes(row.directionSupportState))
    .map(row => row.start), [2, 9, 12]);
});

test('cross-chart lunar directions require the same progressed point and the actual triple intersection', () => {
  const band = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind, exactTimes: [], coordinate: 'ecliptic_longitude' });
  for (const [target, aspectType] of [['Mercury', 'conjunction'], ['Sun', 'quincunx']]) {
    const base = band('Moon', target, aspectType, 0, 20);
    const solar = band('Sun', 'Jupiter', 'trine', 2, 15, 'progressed');
    const connection = band('Jupiter', target, 'sextile', 5, 11);
    const unrelatedPoint = band('Mars', target, 'sextile', 11, 15);
    const unrelatedNatalTarget = band('Jupiter', 'Venus', 'conjunction', 11, 15);
    const disconnectedCoord = { ...connection, start: 11, end: 15, coordinate: 'equatorial_declination_of_date' };
    const rows = buildLeoLunarConditions([base, solar], [],
      [connection, unrelatedPoint, unrelatedNatalTarget, disconnectedCoord]).filter(row => row.base === base);
    assert.deepEqual(rows.map(row => [row.start, row.end, row.crossChartSupportState]),
      [[0, 5, 'none'], [5, 11, 'favourable'], [11, 20, 'none']]);
    assert.equal(rows[1].directionSupportState, 'none');
    assert.deepEqual(rows[1].crossChartDirections, [{
      progressedPoint: 'Jupiter', direction: { body: 'Sun', target: 'Jupiter', targetKind: 'progressed', aspectType: 'trine',
        nature: 'favourable', passage: 'p230' },
      natalContact: { body: 'Jupiter', target, targetKind: 'natal', aspectType: 'sextile' },
    }]);
  }

  const base = band('Moon', 'Mercury', 'conjunction', 0, 20, 'progressed');
  const realBridge = band('Mercury', 'Saturn', 'square', 7, 16);
  const sameNameInOtherChart = band('Sun', 'Mercury', 'sextile', 2, 10);
  const unrelatedClassified = band('Sun', 'Jupiter', 'trine', 2, 10);
  const rows = buildLeoLunarConditions([base, realBridge, sameNameInOtherChart, unrelatedClassified]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.crossChartSupportState]),
    [[0, 7, 'none'], [7, 16, 'adverse'], [16, 20, 'none']]);
  assert.deepEqual(rows[1].crossChartDirections.map(row => row.progressedPoint), ['Mercury']);
});

test('real client facts reach the p165 and p202 cross-chart SQLite branches with an actual natal contact', () => {
  const cases = [
    ['p165', '1965-11-21', 7, 13, 'progressed', 'Mercury', 'Uranus', 'trine', 'adverse', 'matched'],
    ['p165', '2002-09-13', 2, 20, 'natal', 'Sun', 'Jupiter', 'sextile', 'adverse', 'not_matched'],
    ['p202', '1980-05-12', 7, 13, 'natal', 'Sun', 'Jupiter', 'sextile', 'none', 'matched'],
  ];
  const latitude = 31.2304, longitude = 121.4737;
  for (const [passage, date, month, dayOfMonth, baseChart, body, target, aspectType, sameLayerState, status] of cases) {
    const birthInstant = date + 'T00:00:00.000Z', birthDate = new Date(birthInstant);
    const snapshot = chart(+birthDate);
    snapshot.birthContext = { birthInstant, precision: 'minute', latitude, longitude, timeZone: 'Asia/Shanghai',
      clockVersion: 'gregory-iana-intl-v1' };
    const natal = snapshot.western.rawResult[0];
    Object.assign(natal, anglesFromFrame(SiderealTime(birthDate) * 15 + longitude, latitude, e_tilt(MakeTime(birthDate)).tobl));
    const params = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'Asia/Shanghai' };
    const at = Date.UTC(2026, month - 1, dayOfMonth);
    const ref = { snapshotId: 'leo-cross-chart-' + date, chart: snapshot };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, ref)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, at), ref.snapshotId, ref);
    validateFortuneFacts(run);
    const hit = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    assert.equal(hit.status, status, date);
    const baseTarget = passage === 'p165' ? 'Mercury' : 'Sun';
    const baseAspect = passage === 'p165' ? 'conjunction' : 'quincunx';
    const witness = run.facts.find(fact => fact.factType === 'leo_lunar_condition' && fact.normalizedPayload.targetKind === baseChart
      && fact.normalizedPayload.progressedBody === 'Moon' && fact.normalizedPayload.natalTargetId === baseTarget
      && fact.normalizedPayload.aspectType === baseAspect
      && fact.normalizedPayload.crossChartSupportState === 'favourable' && Date.parse(fact.activeFrom) <= at && at < Date.parse(fact.activeTo));
    assert.ok(witness, date);
    assert.equal(witness.normalizedPayload.directionSupportState, sameLayerState, date);
    const link = witness.normalizedPayload.crossChartDirections.find(link => link.direction.body === body
      && link.direction.target === target && link.direction.aspectType === aspectType);
    assert.ok(link, date);
    const connection = link.natalContact;
    assert.equal(connection.targetKind, 'natal');
    assert.equal(connection.body, link.progressedPoint);
    const angle = progressedAspects.find(row => row.type === connection.aspectType).angle;
    const natalLongitude = natal.positions.find(row => row.planet === connection.target).longitude;
    const moving = readLeoMovingPosition(connection.body, Math.round(progressionEpoch(+birthDate, at))).longitude;
    assert.ok(Math.abs(Math.abs((moving - natalLongitude + 540) % 360 - 180) - angle) < 1);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-cross-chart'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /另一盘层同期有/u);
    assert.doesNotMatch(prompt, /crossChartDirections|leo-1906-lunar-same-progressed-point-bridge/u);
    assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)), status === 'matched');
    if (status !== 'not_matched') assert.ok(hit.windows.every(window =>
      Date.parse(window.endExclusive) - Date.parse(window.start) <= 1000));
    if (passage === 'p202') {
      const evidence = run.facts.filter(fact => hit.sourceFactIds.includes(fact.factId));
      const exact = evidence.find(fact => fact.factType === 'leo_lunar_exact_observation');
      assert.ok(exact?.normalizedPayload.observed && exact.normalizedPayload.targetKind === 'natal');
      const support = evidence.find(fact => fact.factType === 'leo_lunar_condition' && fact.activeFrom <= exact.activeFrom && exact.activeFrom < fact.activeTo
        && fact.normalizedPayload.crossChartSupportState === 'favourable');
      assert.equal(support?.normalizedPayload.monthlyLunarHasExact, true);
      const delayed = { ...support, activeFrom: new Date(Date.parse(exact.activeFrom) + 500).toISOString(),
        activeTo: exact.activeTo, normalizedPayload: { ...support.normalizedPayload, monthlyLunarHasExact: false } };
      assert.ok(exact.activeFrom < delayed.activeFrom && delayed.activeFrom < exact.activeTo);
      const withoutCoincidence = matchFortuneKnowledge({ ...run, facts: [exact, delayed] }).byMethod.western
        .find(row => row.knowledgeId === hit.knowledgeId);
      assert.equal(withoutCoincidence.status, 'not_matched');
      assert.deepEqual(withoutCoincidence.windows, []);
      assert.ok(formatFortunePrompt(input).includes(getFortuneKnowledgeEntry(hit.knowledgeId).interpretation.classical_meaning));
    }
  }
});

test('SQLite distinguishes joint favourable, joint adverse and alternative support in the cited rules', () => {
  const cases = [
    ['062', [['all_favourable', 'favourable']]],
    ...['084', '086', '294'].map(id => [id, [['all_favourable', 'none'], ['all_favourable', 'favourable'],
      ['all_favourable', 'mixed'], ['mixed', 'favourable']]]),
  ];
  const variants = [['all_favourable', 'none'], ['all_favourable', 'favourable'], ['all_favourable', 'mixed'],
    ['all_adverse', 'none'], ['all_adverse', 'adverse'], ['all_adverse', 'mixed'], ['mixed', 'favourable'], ['none', 'none']];
  for (const [id, expected] of cases) {
    const rule = fortuneKnowledge.western.rules.find(r => r.review?.sourcePassageId === 'leo-1906-interpretation-p' + id);
    const evaluate = facts => evaluateFortuneRules('western', rule.period, facts).find(r => r.knowledgeId === rule.knowledgeId).required[0];
    const fact = ([sameLayerLunarState, directionSupportState]) => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, sameLayerLunarState, directionSupportState } });
    const result = evaluate(variants.map(fact));
    assert.deepEqual(result.hits.map(({ normalizedPayload: p }) => [p.sameLayerLunarState, p.directionSupportState]), expected, id);
    const unknown = evaluate([fact(['all_favourable', undefined])]);
    assert.deepEqual([unknown.hits.length, unknown.unknown], id === '062' ? [0, true] : [1, false], id);
  }
});

test('adverse support adds separate branches while retaining lunar mitigation and actual luminary links', () => {
  const cases = [
    ['057', ['known']], ['059', ['lunar', 'major']], ['281', ['lunar', 'major', 'mixed']],
    ['295', ['lunar', 'major']], ['301', ['lunar', 'major']], ['327', ['lunar', 'major']], ['330', ['lunar', 'major']],
  ];
  for (const [id, expected] of cases) {
    const rule = fortuneKnowledge.western.rules.find(r => r.review?.sourcePassageId === 'leo-1906-interpretation-p' + id);
    const where = rule.queries[0].where;
    const base = { ...where, targetKind: 'natal', luminaryLinkedBodies: ['Mars'] };
    const lunar = ['295', '327'].includes(id) ? 'all_favourable' : 'all_adverse';
    const facts = [
      { id: 'lunar', sameLayerLunarState: lunar, directionSupportState: 'none' },
      { id: 'major', sameLayerLunarState: 'conditional', directionSupportState: 'adverse' },
      { id: 'mixed', sameLayerLunarState: 'conditional', directionSupportState: 'mixed' },
      { id: 'known', sameLayerLunarState: 'all_adverse', directionSupportState: 'favourable' },
      { id: 'unlinked', sameLayerLunarState: 'none', directionSupportState: 'adverse', luminaryLinkedBodies: [] },
    ].map(({ id, ...fields }) => ({ id, factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...fields } }));
    const evaluate = rows => evaluateFortuneRules('western', rule.period, rows).find(r => r.knowledgeId === rule.knowledgeId).required[0];
    if (id === '059') {
      const witnessed = facts.map(fact => ({ ...fact, normalizedPayload: {
        ...fact.normalizedPayload, mutualExactInSlice: ['lunar', 'known', 'unlinked'].includes(fact.id),
        exactLunarLinkedBodies: fact.id === 'major' ? ['Mars'] : [],
      } }));
      assert.deepEqual(evaluate(witnessed).hits.map(row => row.id), [...expected, 'known'], id);
      const [basePoint] = witnessed;
      const unproved = evaluate([{ ...basePoint, normalizedPayload: {
        ...basePoint.normalizedPayload, mutualExactInSlice: undefined, exactLunarLinkedBodies: undefined,
      } }]);
      assert.deepEqual([unproved.hits.length, unproved.unknown], [0, true], id);
      continue;
    }
    if (['057', '281', '295', '301', '327'].includes(id)) {
      const selected = evaluate(facts);
      assert.deepEqual([selected.hits.length, selected.unknown], [0, true], id);
      if (id === '057') assert.deepEqual(facts.filter(({ normalizedPayload: p }) => p.sameLayerLunarState === 'all_adverse'
        && ['favourable', 'adverse', 'mixed'].includes(p.directionSupportState)).map(row => row.id), expected, id);
      continue;
    }
    const rows = facts.filter(row => row.id !== 'unlinked');
    const wanted = ['295', '327', '057'].includes(id) ? expected : [...expected, 'known'];
    assert.deepEqual(evaluate(rows).hits.map(row => row.id), wanted, id);
    const missing = evaluate([{ ...facts[1], normalizedPayload: { ...facts[1].normalizedPayload, directionSupportState: undefined } }]);
    assert.deepEqual([missing.hits.length, missing.unknown], id === '057' ? [0, false] : [0, true], id);
  }
});

test('Sun–Uranus reinforcement only uses another same-layer direction to an actual endpoint', () => {
  const rule = fortuneKnowledge.western.rules.find(r => r.review?.sourcePassageId === 'leo-1906-interpretation-p281');
  const band = (body, target, aspectType, start, end, targetKind = 'natal') => ({ progressedBody: body, natalTargetId: target,
    aspectType, start, end, targetKind, exactTimes: [] });
  const base = band('Sun', 'Uranus', 'square', 0, 12), sameChart = { ...base, targetKind: 'progressed' };
  const scenarios = [
    [base, [band('Mercury', 'Saturn', 'square', 0, 12), band('Sun', 'Saturn', 'square', 0, 12, 'progressed'),
      band('Mercury', 'Uranus', 'square', 2, 5), band('Sun', 'Jupiter', 'square', 5, 8),
      band('Mercury', 'Uranus', 'sextile', 6, 10)], [[2, 5], [5, 6], [6, 8]]],
    [sameChart, [band('Uranus', 'Sun', 'square', 0, 12, 'progressed'),
      band('Sun', 'Saturn', 'square', 4, 9, 'progressed')], [[4, 9]]],
  ];
  for (const [baseDirection, support, expected] of scenarios) {
    const rows = buildLeoLunarConditions([baseDirection, ...support]).filter(row => row.base === baseDirection);
    const facts = rows.map(({ start, end, directionSupportState, sameLayerLunarState }) => ({ start, end,
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, ...baseDirection, directionSupportState, sameLayerLunarState } }));
    const result = evaluateFortuneRules('western', rule.period, facts).find(r => r.knowledgeId === rule.knowledgeId).required[0];
    const qualifying = rows.filter(row => ['adverse', 'mixed'].includes(row.directionSupportState));
    assert.deepEqual(qualifying.map(({ start, end }) => [start, end]), expected, baseDirection.targetKind);
    assert.ok(qualifying.every(row => row.supportingDirections.every(d => d.targetKind === baseDirection.targetKind)));
    assert.deepEqual(result.hits, []);
  }
});

test('actual adverse alternatives survive client submission and reach the Chinese evidence', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    ['059', '1937-09-08', 'all_adverse', 'p111', /同段次限月亮照到这对星的次限火星/u],
    ['281', '1937-11-05', 'all_adverse', 'p337', /次限金星对本命天王星的四分相，原书此项偏难/u],
    ['295', '1935-11-11', 'all_favourable', 'p121', /次限水星对本命天王星的四分相，原书此项偏难/u],
  ];
  for (const [id, date, originalLunarState, passage, phrase] of cases) {
    const reference = { snapshotId: 'leo-alternative-' + id };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf,
      { ...reference, chart: chart(Date.parse(date + 'T00:00:00Z')) })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-adverse-alternatives', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '295') assertAnnualMutualObservation(run, result, 'Jupiter', 'semisquare', 'not_matched', 'Venus');
    else if (id === '281') assert.equal(result.status, 'matched', id);
    else assert.equal(result.status, 'partial', id);
    const witness = run.facts.find(({ factId, factType, normalizedPayload: p }) => (id === '059'
      ? result.sourceFactIds.includes(factId)
      : factType === 'leo_lunar_condition' && p.targetKind === 'natal' && (id === '295'
        ? p.progressedBody === 'Venus' && p.natalTargetId === 'Jupiter' && p.aspectType === 'semisquare'
        : p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'square'))
      && p.sameLayerLunarState !== originalLunarState && p.directionSupportState === 'adverse'
      && p.supportingDirections.some(row => row.passage === passage));
    assert.ok(witness, id);
    if (id === '281') assert.ok(!result.sourceFactIds.includes(witness.factId)
      && run.facts.filter(row => result.sourceFactIds.includes(row.factId)).every(row => row.factType === 'leo_solar_phase'));
    const description = describeFortuneFact({ method: 'western', type: witness.factType, data: witness.normalizedPayload }, String);
    assert.match(description, phrase, id);
    assert.ok(!description.includes(passage), id);
    if (id === '281' || id === '295') {
      const report = interpretFortune(run, requestForFortuneRun(run), 'leo-adverse-alternative-report');
      const { input } = buildFortuneModelContext(run, report);
      assert.match(formatFortuneFactAudit(input), phrase);
    }
  }
});

test('solar-only and mutual-only rules recognize their source evidence and preserve the true overlap', () => {
  const band = (body, target, type, start, end, targetKind = 'natal') => ({ progressedBody: body, natalTargetId: target,
    aspectType: type, start, end, targetKind, exactTimes: [] });
  const moon = { ...band('Moon', 'Sun', 'opposition', 0, 12), exactTimes: [3, 6] };
  const venus = band('Venus', 'Uranus', 'conjunction', 0, 12);
  const witnesses = [band('Sun', 'Mars', 'square', 2, 6), band('Mercury', 'Saturn', 'sextile', 4, 8),
    band('Mars', 'Jupiter', 'opposition', 6, 10), band('Moon', 'Saturn', 'square', 0, 12),
    band('Sun', 'Uranus', 'sesquiquadrate', 0, 12, 'progressed'), band('Mercury', 'Saturn', 'sextile', 0, 12, 'progressed')];
  for (const [id, base, expected] of [['203', moon, [[2, 4], [6, 8]]], ['333', venus, [[4, 6], [8, 10]]]]) {
    const rule = fortuneKnowledge.western.rules.find(r => r.review?.sourcePassageId === 'leo-1906-interpretation-p' + id);
    const rows = buildLeoLunarConditions([base, ...witnesses]).filter(row => row.base === base);
    const facts = rows.map(({ start, end, directionSupportState, sameLayerSolarDirectionState, monthlyThemeEvidence,
      monthlyLunarQualification }) => ({ start, end,
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, ...base, directionSupportState, sameLayerSolarDirectionState,
        monthlyLunarHasExact: monthlyThemeEvidence?.hasExact, monthlyLunarQualification } }));
    const result = evaluateFortuneRules('western', rule.period, facts).find(r => r.knowledgeId === rule.knowledgeId).required[0];
    if (id === '333') {
      assert.deepEqual(result.hits, []);
      assert.equal(result.unknown, true);
      assert.deepEqual(rows.filter(row => ['favourable', 'adverse'].includes(row.directionSupportState))
        .map(({ start, end }) => [start, end]), expected, id);
      assert.ok(rows.every(row => row.supportingDirections.every(d => d.body !== 'Sun' && d.body !== 'Moon')), id);
      assert.equal(rows.find(row => row.start === 6).directionSupportState, 'mixed');
    } else {
      assert.deepEqual(result.hits.map(({ start, end }) => [start, end]), expected, id);
      assert.deepEqual(result.hits.map(row => row.normalizedPayload.monthlyLunarQualification), ['strengthened', 'base']);
      const afterSolar = rows.find(row => row.start === 6);
      assert.equal(afterSolar.monthlyThemeEvidence.hasExact, true);
      assert.equal(afterSolar.sameLayerSolarDirectionState, 'none');
      assert.ok(afterSolar.supportingDirections.some(row => row.body === 'Mars' && row.nature === 'adverse'));
    }
  }
  const sameChartMoon = { ...moon, targetKind: 'progressed' };
  const reversedSun = band('Uranus', 'Sun', 'sesquiquadrate', 2, 6, 'progressed');
  const sameChart = buildLeoLunarConditions([sameChartMoon, reversedSun]).filter(row => row.base === sameChartMoon);
  assert.deepEqual(sameChart.filter(row => row.hasAdverseSolarDirection).map(({ start, end }) => [start, end]), [[2, 6]]);
});

test('new explicit solar and mutual classifications reach the corresponding client-to-SQLite rules', () => {
  const asOf = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    ['065', '1968-10-19', undefined, 'p229', 'natal', p => p.sameLayerLunarState === 'all_adverse' && p.directionSupportState === 'adverse'],
    ['203', '1952-09-13', 6, 'p283', 'natal', p => p.monthlyLunarHasExact && p.monthlyLunarQualification === 'strengthened'
      && p.sameLayerSolarDirectionState === 'adverse' && p.directionSupportState === 'mixed'],
    ['294', '1964-01-16', undefined, 'p090', 'natal', p => p.sameLayerLunarState === 'mixed' && p.directionSupportState === 'favourable'],
    ['333', '1966-07-25', undefined, 'p296', 'natal', p => p.directionSupportState === 'favourable'],
  ];
  for (const [id, date, month, passage, layer, accepts] of cases) {
    const parameters = { periodType: month ? 'month' : 'year', targetPeriod: month ? { year: 2026, month } : { year: 2026 },
      displayTimezone: 'Asia/Shanghai' };
    const ref = { snapshotId: 'leo-classified-' + id };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf,
      { ...ref, chart: chart(Date.parse(date + 'T00:00:00Z')) })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'leo-classified-support', ref);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '065') assertAnnualMutualObservation(run, match, 'Saturn', 'opposition', 'matched');
    else if (id === '333') assertAnnualMutualObservation(run, match, 'Uranus', 'conjunction', 'matched', 'Venus');
    else assert.equal(match.status, 'matched', id);
    const fact = run.facts.find(({ factId, factType, normalizedPayload: p }) => (id === '065'
      ? factType === 'leo_lunar_condition' && p.progressedBody === 'Mars' && p.natalTargetId === 'Saturn' && p.aspectType === 'opposition'
      : id === '333' ? factType === 'leo_lunar_condition' && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus'
        && p.aspectType === 'conjunction' : match.sourceFactIds.includes(factId))
      && p.targetKind === layer && accepts(p) && p.supportingDirections.some(d => d.passage === passage));
    assert.ok(fact, id);
    if (id === '065' || id === '333') assert.ok(!match.sourceFactIds.includes(fact.factId));
    else assert.ok(match.windows.some(window => window.start <= fact.activeFrom && fact.activeTo <= window.endExclusive), id);
    const prose = describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String);
    assert.match(prose, /同段另一条推运是次限/u);
    assert.ok(!prose.includes(passage));
  }
});

test('a lunar link joins both real directions in one slice before the linked Venus–Jupiter branch matches', () => {
  const direction = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ start, end, progressedBody: body, natalTargetId: target, aspectType, targetKind, exactTimes: [] });
  const base = direction('Venus', 'Jupiter', 'conjunction', 0, 20);
  const rows = buildLeoLunarConditions([base,
    direction('Sun', 'Jupiter', 'sextile', 2, 8), direction('Moon', 'Jupiter', 'square', 3, 6),
    direction('Moon', 'Jupiter', 'square', 6, 10, 'progressed'),
    direction('Sun', 'Saturn', 'sextile', 12, 18),
    direction('Moon', 'Jupiter', 'square', 10, 15), direction('Moon', 'Saturn', 'trine', 14, 16),
  ], [], [], [], [], { venusJupiter: [] }).filter(row => row.base === base);
  const bridged = rows.filter(row => row.hasLunarBridge);
  assert.deepEqual(bridged.map(row => [row.start, row.end]), [[3, 6], [14, 15]]);
  assert.deepEqual(bridged[0].lunarBridge.baseContact, bridged[0].lunarBridge.otherContact);
  assert.deepEqual([bridged[1].lunarBridge.baseContact.target, bridged[1].lunarBridge.otherContact.target], ['Jupiter', 'Saturn']);
  assert.equal(rows.find(row => row.start === 6).directionSupportState, 'favourable');
  assert.equal(rows.find(row => row.start === 6).hasLunarBridge, false);
  assert.equal(rows.find(row => row.start === 6).venusJupiterLunarLinkState, 'no-reviewed-link');
  assert.ok(bridged.every(row => row.venusJupiterLunarLinkState === 'linked'));
  const rule = fortuneKnowledge.western.rules.find(item => item.knowledgeId.includes('-p293-'));
  const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, ...base, sameLayerLunarState: row.sameLayerLunarState,
      hasLunarBridge: row.hasLunarBridge, directionSupportState: row.directionSupportState,
      venusJupiterSupportScope: row.venusJupiterSupportScope, venusJupiterEffectState: row.venusJupiterEffectState,
      mutualExactInSlice: false } }));
  const result = evaluateFortuneRules('western', 'year', facts).find(item => item.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits, facts.filter((_, index) => rows[index].venusJupiterEffectState === 'indirect-candidate'
    || rows[index].sameLayerLunarState === 'all_favourable' || bridged.includes(rows[index])));
  const [, separate] = bridged;
  const description = describeFortuneFact({ method: 'western', type: 'leo_lunar_condition',
    data: { ...base, ...separate, lunarProfile: leoLunarConditionPolicy.profile } }, at => String(at));
  assert.match(description, /同段月亮连接本条与次限太阳对本命土星的六合相，凭据为次限月亮对本命木星的四分相及次限月亮对本命土星的三分相/u);
  assert.doesNotMatch(description, /p270|baseContact|otherContact/u);
  const noLink = describeFortuneFact({ method: 'western', type: 'leo_lunar_condition',
    data: { ...base, ...rows.find(row => row.start === 6), lunarProfile: leoLunarConditionPolicy.profile } }, String);
  assert.match(noLink, /在已核同期推运范围内未见与金木相位相连的月相/u);
});

test('source rules match the actual Moon links and combined direction support computed by the ephemeris', () => {
  const time = Date.parse('2026-06-15T00:00:00Z');
  const period = { start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z') };
  const linked = row => row.lunarLinkedBodies.length > 0;
  const cases = [
    ['p165', '1966-10-10', 'Moon', 'Mercury', 'conjunction', row =>
      [row.directionSupportState, row.crossChartSupportState].some(state => ['favourable', 'adverse'].includes(state))],
    ['p202', '1965-01-13', 'Moon', 'Sun', 'quincunx', row => [row.directionSupportState, row.crossChartSupportState].includes('favourable')],
    ['p245', '1965-02-24', 'Sun', 'Mercury', 'sextile', linked],
    ['p302', '1965-05-03', 'Venus', 'Jupiter', 'parallel', row => row.directionSupportState === 'favourable' && row.natalState === 'all_favourable'],
  ];
  for (const [id, date, body, target, aspect, accepts] of cases) {
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const context = buildLeoSourceContext(period, snapshot, buildWesternProgressions(period, time, snapshot), true);
    const rows = buildLeoLunarConditions([...context.intervals, ...context.progressedPairs], context.progressedSolarDignities, context.natalBridgeBands)
      .filter(({ base }) => base.progressedBody === body && base.natalTargetId === target && base.aspectType === aspect && base.targetKind === 'natal');
    const facts = rows.map(({ base, ...lunar }) => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...lunar, lunarProfile: leoLunarConditionPolicy.profile, crossChartProfile: leoLunarConditionPolicy.crossChart,
        monthlyLunarHasExact: id === 'p202' ? base.exactTimes.some(at => lunar.start <= at && at < lunar.end) : undefined } }));
    const rule = fortuneKnowledge.western.rules.find(rule => rule.knowledgeId.includes('-' + id + '-'));
    const expected = facts.filter((_, index) => accepts(rows[index]));
    assert.ok(expected.length, id);
    const result = evaluateFortuneRules('western', rule.period, facts).find(item => item.knowledgeId === rule.knowledgeId);
    const witnesses = id === 'p202' ? expected.filter(fact => fact.normalizedPayload.monthlyLunarHasExact) : expected;
    assert.deepEqual(result.required[0].hits, id === 'p165' ? [] : id === 'p245' ? facts : witnesses, id);
  }
});

function submitSolarNeptuneYear(birth, latitude, longitude, timeZone) {
  const at = Date.parse(birth + 'T00:00:00Z'), ephemeris = MakeTime(new Date(at));
  const snapshot = chart(at);
  snapshot.birthContext = { precision: 'minute', birthInstant: new Date(at).toISOString(), latitude, longitude,
    timeZone, clockVersion: 'gregory-iana-intl-v1' };
  const armc = (SiderealTime(ephemeris) * 15 + longitude + 360) % 360;
  Object.assign(snapshot.western.rawResult[0], anglesFromFrame(armc, latitude, e_tilt(ephemeris).tobl));
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-06-15T00:00:00Z');
  const reference = { snapshotId: 'leo-solar-neptune-' + timeZone, chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
}

for (const [lat, lon, zone, state, secondRuler, anchors, hardRulers, financesAllow] of [
  [38.72, -9.14, 'Europe/Lisbon', 'support', 'Jupiter', [['Venus', 2]], [], true],
  [40.71, -74.01, 'America/New_York', 'none', 'Saturn', [['Saturn', 5]], [], true],
  [51.51, -0.13, 'Europe/London', 'support', 'Mars', [['Venus', 2], ['Saturn', 2]], [[5, 'Mercury', 'opposition']], false],
  [31.23, 121.47, 'Asia/Shanghai', 'support', 'Sun', [['Moon', 2]], [[11, 'Venus', 'semisquare']], false],
  [28.61, 77.21, 'Asia/Kolkata', 'mixed', 'Mercury', [['Mercury', 1]], [], false],
]) {
  test(`p262 binds same-layer favourable Sun–Neptune phases for ${zone}`, () => {
    const run = submitSolarNeptuneYear('1969-05-23', lat, lon, zone);
    const phases = run.facts.filter(fact => fact.factType === 'leo_solar_lunar_phase' && fact.normalizedPayload.progressedBody === 'Sun'
      && fact.normalizedPayload.natalTargetId === 'Neptune' && fact.normalizedPayload.aspectType === 'trine');
    const candidates = phases.filter(fact => fact.normalizedPayload.directionSupportState === 'favourable');
    const crossSupported = phases.filter(fact => fact.normalizedPayload.neptuneTrineSupportType === 'cross-layer-solar');
    assert.ok(candidates.length > 0, zone);
    assert.equal(crossSupported.length, 1, zone);
    for (const { activeFrom, activeTo, normalizedPayload: p, parentSignalId } of candidates) {
      const parent = run.facts.find(row => row.factType === 'leo_solar_phase' && row.parentSignalId === parentSignalId
        && row.normalizedPayload.phase === p.phase);
      assert.ok(parent && parent.activeFrom <= activeFrom && activeTo <= parent.activeTo, zone);
      assert.equal(p.observed, true, zone);
      assert.equal(typeof p.hasUnreviewedOtherDirection, 'boolean', zone);
      assert.ok(p.supportingDirections.length > 0 && p.supportingDirections.every(row => row.targetKind === p.targetKind
        && row.nature === 'favourable' && row.passage), zone);
      const finance = p.natalFinancialContext;
      assert.equal(finance.natalFinancialState, state, zone);
      assert.equal(finance.secondRuler, secondRuler, zone);
      assert.deepEqual(finance.anchors.map(row => [row.body, row.house]), anchors, zone);
      assert.deepEqual(finance.rulerAfflictions.map(row => [row.house, row.ruler, row.aspect]), hardRulers, zone);
      assert.equal(p.hasNatalFinancialRulerAffliction, hardRulers.length > 0, zone);
    }
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-interpretation-p262-'));
    assert.equal(match.status, 'partial', zone);
    const hasNoKnownAdverseMoon = ({ normalizedPayload: p }) => p.hasAdverseNeptuneTrineMoonContact === false;
    assert.ok(candidates.some(row => !hasNoKnownAdverseMoon(row)), zone);
    const eligible = candidates.filter(hasNoKnownAdverseMoon);
    const combined = [...eligible, ...crossSupported.filter(hasNoKnownAdverseMoon)];
    assert.ok(crossSupported.every(({ normalizedPayload: p }) => p.hasNeptuneTrineVenusMarsOpposition === true), zone);
    const financialOnly = combined.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload,
      hasNatalNeptuneCreativeTestimony: false, hasNatalNeptuneDevotionalContact: false, hasNatalMercuryVenusArtisticContact: false,
      hasNatalSunNeptuneCreativeContact: false } }));
    const financialEvidence = evaluateFortuneRules('western', 'year', financialOnly)
      .find(row => row.knowledgeId === match.knowledgeId).required[0];
    const financiallyClear = financialOnly.filter(({ normalizedPayload: p }) => p.hasNeptuneTrineVenusMarsOpposition === false);
    assert.deepEqual(financialEvidence.hits, financesAllow ? financiallyClear : [], zone);
    const expected = eligible;
    assert.deepEqual([...match.sourceFactIds].sort(), expected.map(row => row.factId).sort(), zone);
    assert.ok(match.windows.every(window => expected.some(row => row.activeFrom === window.start)
      && expected.some(row => row.activeTo === window.endExclusive)));
    const raw = run.facts.filter(row => row.factType === 'leo_lunar_condition' && row.normalizedPayload.progressedBody === 'Sun'
      && row.normalizedPayload.natalTargetId === 'Neptune' && row.normalizedPayload.aspectType === 'trine');
    assert.ok(raw.length > 0 && raw.every(row => !match.sourceFactIds.includes(row.factId)), zone);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), zone));
    const prompt = formatFortuneFactAudit(input);
    if (zone === 'Europe/London') {
      const born = Date.parse('1969-05-23T00:00:00Z');
      const natal = candidates.find(fact => fact.normalizedPayload.targetKind === 'natal');
      assert.ok(natal);
      assert.ok(candidates.every(({ normalizedPayload: p }) => p.hasNatalNeptuneDevotionalContact === true
        && p.hasNatalNeptuneCreativeTestimony === false && p.hasNatalFinancialRulerAffliction === true));
      assert.ok(natal.normalizedPayload.natalNeptuneDevotionalContacts.some(row => row.other === 'Jupiter'
        && row.aspect === 'sextile' && row.nature === 'favourable' && row.difference <= row.orb));
      const epoch = Math.round(progressionEpoch(born, Date.parse(natal.normalizedPayload.formationAt)));
      const separation = Math.abs((readLeoMovingPosition('Sun', epoch).longitude - readLeoMovingPosition('Neptune', born).longitude + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 120) < 1e-6);
      const noAssist = phases.filter(fact => fact.normalizedPayload.hasNatalNeptuneDevotionalContact === true
        && fact.normalizedPayload.directionSupportState !== 'favourable');
      const adjacent = noAssist.find(other => other.normalizedPayload.targetKind === 'progressed' && other.activeTo === natal.activeFrom);
      assert.ok(adjacent);
      assert.equal(adjacent.normalizedPayload.directionSupportState, 'none');
      assert.ok(noAssist.every(fact => !match.sourceFactIds.includes(fact.factId)));
      const prose = /本命木星与本命海王星为六合相[^。]*供原书另述的信念背景参考/u;
      assert.match(prompt, prose);
      assert.doesNotMatch(formatFortunePrompt(input), prose);
    }
    const anchor = state === 'support' ? /原盘第二宫有实居星，财务部分查金星/u : /原盘第二宫无实居星，财务部分查第二宫主星土星/u;
    if (financesAllow) assert.ok(anchor.test(prompt) && prompt.includes('同期同层另有'), zone);
    assert.doesNotMatch(prompt, /natalFinancialContext|hasNatalFinancialRulerAffliction/u);
    assert.doesNotMatch(formatFortunePrompt(input), anchor);
  });
}

test('p260 keeps the creative match separate from the natal financial background', () => {
  const run = submitSolarNeptuneYear('1965-07-10', -0.18, -78.47, 'America/Guayaquil');
  const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-interpretation-p260-'));
  assert.equal(match.status, 'matched');
  const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === 'sextile' && p.targetKind === 'natal');
  assert.ok(fact && !match.sourceFactIds.includes(fact.factId));
  const finance = fact.normalizedPayload.natalFinancialContext;
  assert.equal(finance.natalFinancialState, 'mixed');
  assert.equal(finance.secondRuler, 'Saturn');
  assert.deepEqual(finance.rulerAfflictions.map(row => [row.house, row.ruler, row.aspect]), [[11, 'Jupiter', 'square']]);
  const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-sextile-finance')).input);
  assert.match(prompt, /第二宫主土星与第11宫主木星为四分相/u);
  assert.doesNotMatch(prompt, /rulerAfflictions|natalFinancialContext/u);
});

test('p262 creative Sun–Neptune trine uses real artistic contacts without borrowing the financial branch', () => {
  const year = 2026, parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 15), born = Date.parse('1950-03-23T00:00:00Z');
  const reference = { snapshotId: 'leo-neptune-trine-creative' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...reference, chart: chart(born) })));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-interpretation-p262-'));
  assert.equal(match.status, 'partial');
  const phases = run.facts.filter(({ factId, factType, normalizedPayload: p }) => match.sourceFactIds.includes(factId)
    && factType === 'leo_solar_lunar_phase' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine');
  assert.ok(phases.length > 0);
  for (const fact of phases) {
    const p = fact.normalizedPayload;
    assert.equal(p.natalFinancialState, 'mixed');
    assert.equal(p.hasNatalFinancialRulerAffliction, true);
    assert.equal(p.natalAspectProfile, 'leo-natal-aspects-1928-support-v1');
    assert.equal(p.hasNatalNeptuneCreativeTestimony, true);
    assert.ok(p.natalNeptuneCreativeTestimonies.some(row => row.other === 'Venus' && row.aspect === 'trine'
      && row.nature === 'favourable' && row.difference <= row.orb));
    assert.ok(p.supportingDirections.length > 0 && p.supportingDirections.every(row => row.targetKind === p.targetKind
      && row.nature === 'favourable'));
    const evaluate = update => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...p, ...update } }])
      .find(row => row.knowledgeId === match.knowledgeId).required[0];
    assert.equal(evaluate({ hasNatalNeptuneCreativeTestimony: false, hasNatalMercuryVenusArtisticContact: false }).hits.length, 0);
    assert.equal(evaluate({ hasNatalNeptuneCreativeTestimony: undefined, hasNatalMercuryVenusArtisticContact: false }).unknown, true);
    for (const mistakenState of ['adverse', 'mixed']) assert.equal(evaluate({ directionSupportState: mistakenState }).hits.length, 0);
    assert.equal(evaluate({ directionSupportState: 'none', neptuneTrineSupportType: 'none' }).hits.length, 0);
  }
  const formation = phases.find(row => row.normalizedPayload.phase === 'formation-year' && row.normalizedPayload.targetKind === 'natal');
  assert.ok(formation);
  const at = Math.round(progressionEpoch(born, Date.parse(formation.normalizedPayload.formationAt)));
  const arc = n => Math.abs((n + 540) % 360 - 180);
  assert.ok(Math.abs(arc(readLeoMovingPosition('Sun', at).longitude - readLeoMovingPosition('Neptune', born).longitude) - 120) < 1e-6);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== match.knowledgeId)));
  assert.match(formatFortuneFactAudit(input), /供原书另述的诗乐创作分支参考/u);
  assert.doesNotMatch(formatFortunePrompt(input), /natalNeptuneCreativeTestimonies|hasNatalNeptuneCreativeTestimony/u);
});

test('p262 admits the independent natal Mercury–Venus artistic testimony only within the supported actual solar trine', () => {
  const born = Date.parse('1959-04-22T00:00:00Z');
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(2026, 5, 15);
  const reference = { snapshotId: 'leo-neptune-trine-mercury-venus', chart: chart(born) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
  const phases = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine');
  const supported = phases.filter(({ normalizedPayload: p }) =>
    p.directionSupportState === 'favourable' && p.hasAdverseNeptuneTrineMoonContact === false);
  assert.ok(supported.length > 0 && phases.some(row => row.normalizedPayload.directionSupportState !== 'favourable'));
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-interpretation-p262-'));
  assert.equal(result.status, 'partial');
  assert.deepEqual(new Set(result.sourceFactIds), new Set(supported.map(row => row.factId)));

  const natalSeparation = Math.abs((readLeoMovingPosition('Mercury', born).longitude
    - readLeoMovingPosition('Venus', born).longitude + 540) % 360 - 180);
  assert.ok(natalSeparation > 60 && natalSeparation < 67);
  for (const { normalizedPayload: p } of supported) {
    assert.equal(p.natalFinancialState, 'mixed');
    assert.equal(p.hasNatalFinancialRulerAffliction, true);
    assert.equal(p.hasNatalNeptuneCreativeTestimony, false);
    assert.equal(p.hasNatalNeptuneDevotionalContact, false);
    assert.equal(p.hasNatalMercuryVenusArtisticContact, true);
    assert.equal(p.natalMercuryVenusArtisticContacts.length, 1);
    const [witness] = p.natalMercuryVenusArtisticContacts;
    assert.deepEqual([witness.first, witness.second, witness.aspect, witness.orb], ['Mercury', 'Venus', 'sextile', 7]);
    assert.ok(Math.abs(witness.difference - (natalSeparation - 60)) < 1e-8);
    const formationEpoch = Math.round(progressionEpoch(born, Date.parse(p.formationAt)));
    const targetEpoch = p.targetKind === 'natal' ? born : formationEpoch;
    const angle = Math.abs((readLeoMovingPosition('Sun', formationEpoch).longitude
      - readLeoMovingPosition('Neptune', targetEpoch).longitude + 540) % 360 - 180);
    assert.ok(Math.abs(angle - 120) < 1e-6);
  }
  const unavailable = supported.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload,
    hasNatalMercuryVenusArtisticContact: false } }));
  assert.deepEqual(evaluateFortuneRules('western', 'year', unavailable)
    .find(row => row.knowledgeId === result.knowledgeId).required[0].hits, []);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const artisticContext = /本命水星与本命金星为六合相[^。]*可参考同作者的诗乐背景说法/u;
  assert.match(formatFortuneFactAudit(input), artisticContext);
  assert.doesNotMatch(formatFortunePrompt(input), artisticContext);
});

test('p182 and p262 share isolated natal Sun–Neptune artistic evidence on one real chart', () => {
  const birthAt = Date.parse('1959-12-25T00:00:00Z');
  const natalChart = chart(birthAt);
  const arc = difference => Math.abs((difference + 540) % 360 - 180);
  const natalSeparation = arc(readLeoMovingPosition('Sun', birthAt).longitude - readLeoMovingPosition('Neptune', birthAt).longitude);
  assert.ok(natalSeparation > 53 && natalSeparation < 54);
  const cases = [
    { passage: 'p262', periodType: 'year', factType: 'leo_solar_lunar_phase', moving: 'Sun', aspect: 'trine', angle: 120 },
    { passage: 'p182', periodType: 'month', month: 1, factType: 'leo_lunar_exact_observation', moving: 'Moon',
      aspect: 'quincunx', angle: 150, layer: 'natal', exactAt: '2026-01-26T13:57:39.485Z' },
    { passage: 'p182', periodType: 'month', month: 2, factType: 'leo_lunar_exact_observation', moving: 'Moon',
      aspect: 'quincunx', angle: 150, layer: 'progressed', exactAt: '2026-02-10T01:17:03.157Z' },
    { passage: 'p182', periodType: 'month', month: 3, factType: 'leo_lunar_exact_observation', moving: 'Moon',
      aspect: 'quincunx', angle: 150 },
  ];
  for (const { passage, periodType, month, factType, moving, aspect, angle, layer, exactAt } of cases) {
    const year = 2026, now = Date.UTC(year, month === undefined ? 5 : month - 1, 15);
    const parameters = { periodType, targetPeriod: { year, ...(month && { month }) }, displayTimezone: 'UTC' };
    const reference = { snapshotId: `leo-sun-neptune-creative-${month ?? year}`, chart: natalChart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes(`-${passage}-`));
    const base = ({ normalizedPayload: p }) => p.progressedBody === moving && p.natalTargetId === 'Neptune' && p.aspectType === aspect;
    const candidates = run.facts.filter(row => row.factType === factType && base(row));
    if (month === 3) {
      assert.equal(result.status, 'not_matched');
      assert.deepEqual(candidates, []);
      assert.ok(run.facts.some(row => row.factType === 'leo_progressed_aspect' && base(row)));
      continue;
    }
    assert.equal(result.status, periodType === 'year' ? 'partial' : 'matched', passage);
    const hits = candidates.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(hits.length);
    if (periodType === 'year') {
      assert.deepEqual(hits, candidates.filter(({ normalizedPayload: p }) =>
        p.directionSupportState === 'favourable' && p.hasAdverseNeptuneTrineMoonContact === false));
      assert.ok(candidates.some(({ normalizedPayload: p }) => p.directionSupportState !== 'favourable'));
    } else {
      assert.deepEqual(hits, candidates);
      assert.equal(hits.length, 1);
      assert.equal(hits[0].normalizedPayload.targetKind, layer);
      assert.ok(Math.abs(Date.parse(hits[0].exactInstant) - Date.parse(exactAt)) < 1_000);
    }
    for (const row of hits) {
      const { normalizedPayload: p } = row;
      const [witness] = p.natalSunNeptuneCreativeContacts;
      assert.equal(p.hasNatalSunNeptuneCreativeContact, true);
      assert.equal(p.natalSunNeptuneCreativeContacts.length, 1);
      assert.deepEqual([witness.first, witness.second, witness.aspect, witness.orb], ['Sun', 'Neptune', 'sextile', 7]);
      assert.ok(Math.abs(witness.difference - (60 - natalSeparation)) < 1e-8);
      if (periodType === 'year') {
        assert.equal(p.natalFinancialState, 'mixed');
        assert.equal(p.hasNatalNeptuneCreativeTestimony, false);
        assert.equal(p.hasNatalNeptuneDevotionalContact, false);
        assert.equal(p.hasNatalMercuryVenusArtisticContact, false);
      } else {
        assert.equal(p.natalTargetHouse, 5);
        assert.equal(p.hasLunarNeptuneTestimony, false);
        assert.equal(p.hasLunarNeptuneDevotionalContact, false);
        assert.equal(p.natalNeptuneApproachingAscendant, false);
      }
      const epoch = progressionEpoch(birthAt, Date.parse(p.formationAt ?? row.exactInstant));
      const targetEpoch = p.targetKind === 'natal' ? birthAt : epoch;
      const difference = readLeoMovingPosition(moving, epoch).longitude - readLeoMovingPosition('Neptune', targetEpoch).longitude;
      assert.ok(Math.abs(arc(difference) - angle) < 0.00001, passage);
    }
    const disabled = hits.map(row => ({ ...row, normalizedPayload: { ...row.normalizedPayload, hasNatalSunNeptuneCreativeContact: false } }));
    assert.deepEqual(evaluateFortuneRules('western', periodType, disabled)
      .find(row => row.knowledgeId === result.knowledgeId).required[0].hits, periodType === 'year' ? [] : disabled);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const localContact = '本命太阳与本命海王星为六合相';
    const provider = formatFortunePrompt(input);
    assert.ok(formatFortuneFactAudit(input).includes(localContact), `${passage} ${month ?? year}`);
    assert.ok(!provider.includes(localContact));
    assert.doesNotMatch(provider, /natalSunNeptuneCreativeContacts|hasNatalSunNeptuneCreativeContact/u);
    assert.equal(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), periodType === 'month');
  }
});

test('the monthly Moon quincunx needs an exact contact in the real supportive interval', () => {
  const parameters = { periodType: 'month', targetPeriod: { year: 2026, month: 2 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-02-18T00:00:00Z');
  const reference = { snapshotId: 'leo-direction-support-snapshot' };
  const snapshot = chart(Date.parse('1965-01-13T00:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'leo-direction-support', reference);
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p202-'));
  const aspects = run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && fact.normalizedPayload.progressedBody === 'Moon'
    && fact.normalizedPayload.natalTargetId === 'Sun' && fact.normalizedPayload.aspectType === 'quincunx'
    && fact.normalizedPayload.targetKind === 'natal');
  const supportive = run.facts.find(fact => fact.factType === 'leo_progressed_aspect'
    && fact.normalizedPayload.progressedBody === 'Venus' && fact.normalizedPayload.natalTargetId === 'Jupiter'
    && fact.normalizedPayload.aspectType === 'sextile' && fact.normalizedPayload.targetKind === 'natal');
  assert.equal(result.status, 'not_matched');
  assert.deepEqual(result.windows, []);
  assert.ok(aspects.some(row => row.normalizedPayload.directionSupportState === 'favourable'
    && row.normalizedPayload.monthlyLunarHasExact === false && row.activeTo === supportive.activeTo));
  assert.ok(aspects.some(row => row.normalizedPayload.directionSupportState === 'none'
    && row.activeFrom === supportive.activeTo && !result.sourceFactIds.includes(row.factId)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-direction-support-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /次限金星对本命木星的六合相，原书此项偏顺/u);
  assert.doesNotMatch(prompt, /supportingDirections|directionSupportState|p296/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
});

test('monthly lunar themes distinguish exactness, supporting major directions, contrary directions and another chart', () => {
  for (const [passage, topic] of [
    ['p216', 'monthlyAttachment'],
    ['p147', 'monthlyFinance'],
  ]) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
    const base = { ...rule.queries[0].where, targetKind: 'natal', start: 0, end: 12, exactTimes: [6] };
    const contact = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
      ({ progressedBody, natalTargetId, aspectType, start, end, targetKind, exactTimes: [] });
    const conditions = buildLeoLunarConditions([base,
      contact('Sun', 'Jupiter', 'trine', 0, 12, 'progressed'),
      contact('Moon', 'Venus', 'trine', 0, 12),
      contact('Sun', 'Jupiter', 'trine', 2, 8),
      contact('Venus', 'Saturn', 'square', 6, 10),
    ]).filter(row => row.base === base);
    assert.deepEqual(conditions.map(row => [row.start, row.end, row.monthlyThemeEvidence.majorState]), [
      [0, 2, 'none'], [2, 6, 'favourable'], [6, 8, 'mixed'], [8, 10, 'adverse'], [10, 12, 'none'],
    ]);
    for (const row of conditions) assert.equal(row.monthlyThemeEvidence.topic, topic);
    assert.deepEqual(conditions.filter(row => row.monthlyThemeEvidence.hasExact).map(row => row.start), [6]);
    assert.equal(conditions[2].monthlyThemeEvidence.hasUnopposedMajorSupport, false);
    const facts = conditions.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, start: row.start, monthlyLunarFrameProfile: leoLunarHousePolicy.monthlyAspectFrame,
        monthlyLunarHasExactInOwnFrame: row.monthlyThemeEvidence.hasExact,
        monthlyLunarHasUnopposedMajorSupport: row.monthlyThemeEvidence.hasUnopposedMajorSupport } }));
    const evaluate = evidence => evaluateFortuneRules('western', 'month', evidence).find(row => row.knowledgeId === rule.knowledgeId);
    const observations = conditions.flatMap(row => row.monthlyThemeEvidence.lunarExactTimes.map(start => ({
      factType: 'leo_lunar_exact_observation', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, start },
    })));
    assert.equal(evaluate(facts).required[0].hits.length, 0, passage);
    const result = evaluate(observations);
    assert.deepEqual(result.required[0].hits.map(fact => fact.normalizedPayload.start), [6], passage);

    const annualBase = { ...base, targetKind: 'progressed' };
    const annual = buildLeoLunarConditions([annualBase,
      contact('Sun', 'Jupiter', 'trine', 0, 12, 'progressed'),
      contact('Sun', 'Jupiter', 'semisquare', 0, 12),
      contact('Venus', 'Saturn', 'square', 0, 12, 'progressed'),
    ]).filter(row => row.base === annualBase);
    assert.equal(annual.length, 1);
    const evidence = annual[0].monthlyThemeEvidence;
    assert.deepEqual(evidence.majorDirections.map(row => [row.body, row.target, row.targetKind]), [['Sun', 'Jupiter', 'progressed']]);
    assert.equal(evidence.majorState, 'favourable');
    assert.equal(evidence.hasUnopposedMajorSupport, false);
  }
});

test('real monthly Venus and resource contacts retain their exact lunar points through client submission and SQLite', () => {
  for (const [passage, birth, month, exactDate, topic] of [
    ['p218', '1993-09-12', 8, '2026-08-17', 'monthlyAttachment'],
    ['p146', '1970-04-18', 1, '2026-01-09', 'monthlyFinance'],
    ['p147', '1994-04-18', 7, '2026-07-29', 'monthlyFinance'],
    ['p186', '1965-04-18', 4, '2026-04-18', 'monthlyFinance'],
  ]) {
    const params = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'Asia/Shanghai' };
    const at = Date.parse(exactDate + 'T08:00:00Z');
    const reference = { snapshotId: 'leo-monthly-themed-lunar-' + passage, chart: chart(Date.parse(birth + 'T08:00:00Z'), 100) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, at), reference.snapshotId, reference);
    const matched = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
    assert.equal(matched.status, 'matched', passage);
    const evidenceForMatch = run.facts.find(row => matched.sourceFactIds.includes(row.factId)
      && row.factType === 'leo_lunar_exact_observation' && row.normalizedPayload.observed === true
      && row.normalizedPayload.targetKind === 'natal' && row.exactInstant?.startsWith(exactDate));
    assert.ok(evidenceForMatch, passage);
    const fact = run.facts.find(row => row.factType === 'leo_lunar_condition'
      && row.parentSignalId === evidenceForMatch.parentSignalId
      && row.normalizedPayload.monthlyThemeEvidence?.lunarExactTimes.includes(evidenceForMatch.exactInstant));
    assert.ok(fact, passage);
    const evidence = fact.normalizedPayload.monthlyThemeEvidence;
    assert.equal(evidence.topic, topic);
    assert.ok(evidence.lunarExactTimes.some(time => time.startsWith(exactDate) && fact.activeFrom <= time && time < fact.activeTo));
    assert.equal(fact.normalizedPayload.monthlyLunarHasExactInOwnFrame, true);
    const frame = evidence.exactFrames.find(row => row.exactAt.startsWith(exactDate));
    const natal = readWesternHouseFrame(reference.chart);
    const houses = calculateHouseCusps(natal.armc, natal.latitude, natal.obliquity, 'placidus');
    assert.equal(frame.houseProfile, leoLunarHousePolicy.houseProfile);
    assert.equal(frame.moonHouse, zodiacalHouse(frame.moonLongitude, houses.cusps));
    assert.equal(frame.targetHouse, zodiacalHouse(frame.targetLongitude, houses.cusps));
    assert.equal(frame.annualStart, undefined);
    assert.match(frame.appendixDate.date, /^2026-\d{2}-\d{2}$/u);
    assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String),
      /精确成相时按出生本命盘的实际宫头/u);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.ok(input.sections.some(section => section.findings.some(item => item.knowledgeId === matched.knowledgeId)), passage);
  }
});

test('a real monthly contact to progressed Venus uses its annual chart and keeps radical contacts separate', () => {
  const birthAt = Date.parse('1988-12-04T08:00:00Z');
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 5 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-05-13T04:00:00Z');
  const reference = { snapshotId: 'leo-progressed-monthly-venus', chart: chart(birthAt, 100) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p218-'));
  const observation = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)
    && fact.factType === 'leo_lunar_exact_observation' && fact.normalizedPayload.targetKind === 'progressed');
  assert.equal(match.status, 'matched');
  assert.ok(observation);
  const witness = run.facts.find(fact => fact.factType === 'leo_lunar_condition' && fact.parentSignalId === observation.parentSignalId
    && fact.normalizedPayload.monthlyThemeEvidence?.lunarExactTimes.includes(observation.exactInstant));
  assert.ok(witness);
  const [frame] = witness.normalizedPayload.monthlyThemeEvidence.exactFrames;
  assert.equal(frame.houseProfile, leoLunarHousePolicy.annualHouseProfile);
  assert.match(frame.exactAt, /^2026-05-12T20:49/u);
  assert.equal(frame.annualStart, '2025-12-04T08:00:00.000Z');
  assert.equal(frame.annualEnd, '2026-12-04T08:00:00.000Z');
  const natal = readWesternHouseFrame(reference.chart);
  const direction = progressedHouseFrame(birthAt, Date.parse(frame.annualStart), natal.armc, natal.latitude);
  const houses = calculateHouseCusps(direction.armc, natal.latitude, direction.obliquity, 'placidus');
  assert.equal(frame.moonHouse, zodiacalHouse(frame.moonLongitude, houses.cusps));
  assert.equal(frame.targetHouse, zodiacalHouse(frame.targetLongitude, houses.cusps));
  const natalHouses = calculateHouseCusps(natal.armc, natal.latitude, natal.obliquity, 'placidus');
  assert.ok(frame.moonHouse !== zodiacalHouse(frame.moonLongitude, natalHouses.cusps)
    || frame.targetHouse !== zodiacalHouse(frame.targetLongitude, natalHouses.cusps));
  assert.ok(Array.isArray(frame.radicalContacts));
  assert.ok(frame.radicalContacts.every(contact => ['Moon', 'Venus'].includes(contact.body) && contact.separation <= 1));
  assert.match(describeFortuneFact({ method: 'western', type: witness.factType, data: witness.normalizedPayload }, String),
    /精确成相时按本年的次限盘的实际宫头/u);

  const invalid = structuredClone(run);
  invalid.facts.find(fact => fact.factId === observation.factId).normalizedPayload.targetKind = 'other-chart-layer';
  assert.ok(!matchFortuneKnowledge(invalid).byMethod.western.find(row => row.knowledgeId === match.knowledgeId)
    .sourceFactIds.includes(observation.factId));
});

test('a real client chart can match Venus–Jupiter through a shared Moon contact outside the all-favourable branch', () => {
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-06-15T00:00:00Z');
  const reference = { snapshotId: 'leo-shared-moon-direction-snapshot' };
  const snapshot = chart(Date.parse('1970-10-17T00:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'leo-shared-moon-direction', reference);
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p293-'));
  assert.equal(result.status, 'matched');
  const witness = run.facts.find(fact => result.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.sameLayerLunarState !== 'all_favourable'
    && fact.normalizedPayload.lunarBridge?.direction.passage === 'p080');
  assert.ok(witness);
  assert.equal(witness.normalizedPayload.venusJupiterLunarLinkState, 'linked');
  assert.equal(witness.normalizedPayload.venusJupiterEffectState, 'linked-support');
  const { direction, baseContact, otherContact } = witness.normalizedPayload.lunarBridge;
  assert.deepEqual([direction.body, direction.target, direction.targetKind, direction.aspectType],
    ['Mercury', 'Jupiter', 'natal', 'sextile']);
  assert.deepEqual(baseContact, { body: 'Moon', target: 'Jupiter', targetKind: 'natal', aspectType: 'quincunx' });
  assert.deepEqual(otherContact, baseContact);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-shared-moon-direction-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /同段月亮连接本条与次限水星对本命木星的六合相，凭据为次限月亮对本命木星的梅花相/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
});

test('the real solar Uranus and Venus Jupiter cases separate topical and nonlunar support from incidental contacts', () => {
  for (const [passage, birth, body, target, aspect] of [
    ['p286', '1955-03-20', 'Sun', 'Uranus', 'parallel'],
    ['p293', '1961-11-19', 'Venus', 'Jupiter', 'conjunction'],
  ]) {
    const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(2026, 5, 15);
    const reference = { snapshotId: passage + '-support', chart: chart(Date.parse(birth + 'T00:00:00Z')) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), passage, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), passage + '-test-report'));
    assert.equal(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId),
      result.status === 'matched');
    if (passage === 'p286') {
      assert.equal(result.status, 'matched', passage);
      const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition' && p.progressedBody === body
        && p.natalTargetId === target && p.aspectType === aspect);
      const lunarSupports = facts.filter(({ normalizedPayload: p }) => p.lunarLinkedBodies.includes('Uranus')
        && p.metaphysicalDirectionState === 'favourable');
      assert.ok(lunarSupports.some(({ normalizedPayload: p }) => p.metaphysicalDirections.some(r => r.passage === 'p208')));
      assert.ok(facts.some(({ normalizedPayload: p }) => p.lunarLinkedBodies.includes('Uranus') && p.metaphysicalDirectionState === 'none'));
      const verified = facts.filter(({ normalizedPayload: p }) => p.targetKind === 'natal' && p.hasExactUranianMetaphysicalMoonDirection);
      assert.equal(verified.length, 1);
      assert.equal(verified[0].normalizedPayload.uranianMetaphysicalMoonDirection.passage, 'p208');
      const lunar = result.confirmedBranches?.find(branch => branch.conditions.some(condition => condition.includes('次限月亮对同一本命天王星实际')));
      assert.deepEqual(lunar?.sourceFactIds ?? result.sourceFactIds, [verified[0].factId]);
      assert.match(formatFortuneFactAudit(input), /玄学与心灵体验议题的同期推运为次限月亮对本命天王星的六合相/u);

      const sameChart = facts.filter(({ normalizedPayload: p }) => p.targetKind === 'progressed');
      const expected = Date.parse('2026-03-30T01:46:15.256Z');
      const point = sameChart.find(row => Math.abs(Date.parse(row.activeFrom) - expected) < 1_000
        && row.normalizedPayload.hasExactUranianMetaphysicalMoonDirection);
      assert.ok(point, 'a real sextile to progressed Uranus inside the same-chart Sun–Uranus parallel');
      assert.deepEqual(point.normalizedPayload.uranianMetaphysicalMoonDirection,
        { body: 'Moon', target: 'Uranus', targetKind: 'progressed', aspectType: 'sextile', passage: 'p208' });
      const instant = Date.parse(point.activeFrom), end = Date.parse(point.activeTo);
      assert.equal(end - instant, 1_000);
      const birthAt = Date.parse(birth + 'T00:00:00Z'), epoch = Math.round(progressionEpoch(birthAt, instant));
      const moon = readLeoMovingPosition('Moon', epoch), sun = readLeoMovingPosition('Sun', epoch);
      const progressedUranus = readLeoMovingPosition('Uranus', epoch), natalUranus = readLeoMovingPosition('Uranus', birthAt);
      const separationFromMoon = ({ longitude }) => Math.abs((moon.longitude - longitude + 540) % 360 - 180);
      assert.ok(Math.abs(separationFromMoon(progressedUranus) - 60) < 0.00001);
      assert.ok(Math.abs(separationFromMoon(natalUranus) - 60) > 1);
      assert.ok(leoParallelDifference(sun.declination, progressedUranus.declination) < 1);

      const staticCondition = /次限月亮对同一颗同图次限天王星实际形成六合或三分/u;
      const confirmedFor = row => {
        const match = matchFortuneKnowledge({ ...run, facts: [row] }).byMethod.western
          .find(item => item.knowledgeId === result.knowledgeId);
        return (match.matchedConditions ?? match.confirmedBranches?.flatMap(branch => branch.conditions) ?? []).join('\n');
      };
      const sameChartBranch = result.confirmedBranches.find(branch => branch.conditions.some(condition => staticCondition.test(condition)));
      assert.deepEqual(sameChartBranch?.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
      assert.deepEqual(sameChartBranch.sourceFactIds, [point.factId]);
      assert.match(confirmedFor(point), staticCondition);
      for (const [samples, edge] of [[sameChart, instant - 1], [sameChart, end],
        [facts.filter(({ normalizedPayload: p }) => p.targetKind === 'natal'), instant]]) {
        const negative = samples.find(row => Date.parse(row.activeFrom) <= edge && edge < Date.parse(row.activeTo));
        assert.ok(negative, String(edge));
        assert.equal(negative.normalizedPayload.hasExactUranianMetaphysicalMoonDirection, false);
        assert.doesNotMatch(confirmedFor(negative), staticCondition);
      }
      const localAudit = /日天平行带内还有次限月亮对同图次限天王星的六合相真点/u;
      assert.match(formatFortuneFactAudit(input), localAudit);
      const provider = formatFortunePrompt(input);
      assert.match(provider, staticCondition);
      assert.doesNotMatch(provider, localAudit);
      assert.doesNotMatch(provider, /uranianMetaphysicalMoonDirection/u);
    } else {
      const related = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
        && p.progressedBody === body && p.natalTargetId === target && p.aspectType === aspect && p.targetKind === 'natal');
      const nonlunar = related.filter(({ normalizedPayload: p }) =>
        p.hasLunarBridge === false && p.sameLayerLunarState !== 'all_favourable' && p.directionSupportState === 'favourable');
      const witness = nonlunar.find(({ normalizedPayload: p }) => p.supportingDirections.some(r => r.passage === 'p225'));
      assert.ok(witness);
      assert.equal(witness.normalizedPayload.venusJupiterSupportScope, 'both-chart-planetary-pairs');
      const retained = related.filter(({ normalizedPayload: p }) => p.mutualExactInSlice || p.hasLunarBridge
        || p.sameLayerLunarState === 'all_favourable' || p.venusJupiterEffectState === 'indirect-candidate'
        || (['mixed', 'conditional'].includes(p.sameLayerLunarState) && p.hasExactFavourableMoonToNatalEndpoint)
        || (p.progressedState === 'all_favourable' && p.hasExactFavourableMoonToProgressedEndpoint));
      assert.equal(result.status, retained.length ? 'matched' : 'not_matched');
      assert.deepEqual(new Set(result.sourceFactIds), new Set(retained.map(row => row.factId)));
      assert.match(describeFortuneFact({ method: 'western', type: 'leo_lunar_condition', data: witness.normalizedPayload }, String),
        /同段另一条推运是次限太阳对本命木星的合相/u);
    }
  }
});

test('p340 finds year-specific Venus–Uranus and lunar contacts in the same progressed chart', () => {
  const now = Date.UTC(2026, 5, 15);
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const charts = new Map(['1968-01-15', '1977-03-15'].map(birth => {
    const reference = { snapshotId: 'p340-progressed-' + birth, chart: chart(Date.parse(birth + 'T00:00:00Z')) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
    return [birth, bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference)];
  }));
  const bases = rows => rows.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx');
  const match = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p340-'));
  const conditions = result => (result.matchedConditions ?? result.confirmedBranches?.flatMap(branch => branch.conditions) ?? []).join('\n');
  const formationRun = charts.get('1968-01-15');
  const exact = bases(formationRun.facts).find(row => row.normalizedPayload.mutualExactInSlice);
  assert.equal(exact.activeFrom, '2026-06-17T23:31:46.897Z');
  assert.equal(exact.normalizedPayload.targetKind, 'progressed');
  assert.equal(Date.parse(exact.activeTo) - Date.parse(exact.activeFrom), 1_000);
  const formationEpoch = Math.round(progressionEpoch(Date.UTC(1968, 0, 15), Date.parse(exact.activeFrom)));
  const angleBetween = (first, second, epoch) => Math.abs((readLeoMovingPosition(first, epoch).longitude
    - readLeoMovingPosition(second, epoch).longitude + 540) % 360 - 180);
  assert.ok(Math.abs(angleBetween('Venus', 'Uranus', formationEpoch) - 150) < 0.00001);
  assert.ok(match(formationRun).sourceFactIds.includes(exact.factId));
  assert.match(conditions(match({ ...formationRun, facts: [exact] })), /同一张次限图的金星和天王星实际形成一百五十度/u);

  const lunarRun = charts.get('1977-03-15');
  const rows = bases(lunarRun.facts);
  assert.ok(rows.length > 0 && rows.every(row => row.normalizedPayload.targetKind === 'progressed'));
  const result = match(lunarRun);
  assert.equal(result.status, 'matched');
  for (const [target, angle, at] of [
    ['Venus', 150, '2026-06-23T18:49:04.885Z'],
    ['Uranus', 0, '2026-07-11T09:49:53.665Z'],
  ]) {
    const row = rows.find(item => item.activeFrom === at && item.normalizedPayload.exactLunarLinkedBodies.includes(target));
    assert.ok(row, target);
    assert.ok(result.sourceFactIds.includes(row.factId), target);
    const lunarEpoch = Math.round(progressionEpoch(Date.UTC(1977, 2, 15), Date.parse(at)));
    assert.ok(Math.abs(angleBetween('Moon', target, lunarEpoch) - angle) < 0.00001, target);
    const matched = match({ ...lunarRun, facts: [row] });
    assert.match(conditions(matched), /同图次限金天梅花有效时/u);
    const end = row.activeTo;
    const next = rows.find(item => item.activeFrom === end);
    assert.ok(next);
    assert.ok(!next.normalizedPayload.exactLunarLinkedBodies.includes(target));
  }
  const { input } = buildFortuneModelContext(lunarRun,
    interpretFortune(lunarRun, requestForFortuneRun(lunarRun), 'leo-p340-progressed'));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /同图次限金天梅花有效时/u);
  assert.doesNotMatch(provider, /exactLunarLinkedBodies|2026-07-11T09:49:53|nervous disorders/u);

  const base = { progressedBody: 'Venus', natalTargetId: 'Uranus', aspectType: 'quincunx', targetKind: 'progressed',
    coordinate: 'ecliptic_longitude', start: 0, end: 8_000, exactTimes: [] };
  const moon = { ...base, progressedBody: 'Moon', aspectType: 'sextile' };
  const review = buildLeoLunarConditions([base, { ...moon, exactTimes: [4_000] },
    { ...moon, targetKind: 'natal', exactTimes: [2_000] }, { ...moon, natalTargetId: 'Jupiter', exactTimes: [3_000] }]);
  assert.deepEqual(review.filter(row => row.base === base && row.exactLunarLinkedBodies.length)
    .map(row => [row.start, row.end, row.exactLunarLinkedBodies]), [[4_000, 5_000, ['Uranus']]]);
  const solar = { ...base, progressedBody: 'Sun', aspectType: 'opposition' };
  for (const targetKind of ['natal', 'progressed']) {
    const slices = buildLeoLunarConditions([base, { ...moon, exactTimes: [4_000] }, { ...solar, targetKind }]);
    assert.deepEqual(slices.filter(row => row.base === base && row.hasUranianMoonSolarActivation).map(row => [row.start, row.end]),
      targetKind === 'progressed' ? [[4_000, 5_000]] : []);
  }
});

test('p340 confirms the independent solar and Venus witnesses in the same progressed chart', () => {
  const cases = [
    { birth: '1967-01-13', date: '2026-09-12T08:20:54.309Z', moving: 'Sun', target: 'Uranus', angle: 180,
      field: 'exactUranianSensitivityDirection', phrase: '实际形成对冲' },
    { birth: '1942-09-24', date: '2026-11-01T03:55:19.299Z', moving: 'Venus', target: 'Neptune', angle: 90,
      field: 'hasExactProgressedVenusNeptuneSensitivityDirection', phrase: '实际形成四分' },
  ];
  const rule = row => row.knowledgeId.includes('-p340-');
  const separation = (first, second) => Math.abs((first - second + 540) % 360 - 180);
  for (const sample of cases) {
    const { run, birthAt } = progressedPairRun2026(sample.birth);
    const evaluation = evaluateFortuneRules('western', 'year', run.facts).find(rule);
    const branch = evaluation.confirmations.find(row => row.sourceConditions.some(condition =>
      condition.includes('同图次限金天梅花有效时') && condition.includes(sample.phrase)));
    assert.equal(branch.hits.length, 1, sample.birth);
    const [hit] = branch.hits;
    assert.equal(hit.normalizedPayload.targetKind, 'progressed');
    assert.equal(hit.normalizedPayload[sample.field], true);
    assert.equal(hit.normalizedPayload.hasUranianMoonSolarActivation, false);
    assert.equal(hit.activeFrom, sample.date);
    const at = Date.parse(hit.activeFrom);
    assert.equal(Date.parse(hit.activeTo) - at, 1_000);
    const epoch = Math.round(progressionEpoch(birthAt, at));
    const moving = readLeoMovingPosition(sample.moving, epoch).longitude;
    const target = readLeoMovingPosition(sample.target, epoch).longitude;
    const natalTarget = readLeoMovingPosition(sample.target, birthAt).longitude;
    assert.ok(Math.abs(separation(moving, target) - sample.angle) < 0.00001);
    assert.ok(Math.abs(separation(moving, natalTarget) - sample.angle) > 1);
    const venus = readLeoMovingPosition('Venus', epoch).longitude;
    const uranus = readLeoMovingPosition('Uranus', epoch).longitude;
    assert.ok(Math.abs(separation(venus, uranus) - 150) < 1);

    const adjacent = run.facts.filter(row => row.factType === 'leo_lunar_condition' && row.parentSignalId === hit.parentSignalId
      && (row.activeTo === hit.activeFrom || row.activeFrom === hit.activeTo));
    assert.equal(adjacent.length, 2);
    assert.ok(adjacent.every(row => !row.normalizedPayload[sample.field]));
    assert.ok(matchFortuneKnowledge(run).byMethod.western.find(rule).sourceFactIds.includes(hit.factId));

    const result = interpretFortune(run, requestForFortuneRun(run), 'p340-shared-chart-' + sample.birth);
    const { input } = buildFortuneModelContext(run, result);
    const provider = formatFortunePrompt(input);
    assert.ok(provider.includes(branch.sourceConditions[0]));
    assert.ok(!provider.includes(sample.date) && !provider.includes(sample.field));
  }
});

test('p286 and p340 confirm separate Uranus witnesses only in the correct overlapping slice', () => {
  const cases = [
    { passage: 'p286', birth: '1908-03-28', year: 1986, body: 'Sun', aspect: 'parallel',
      witness: 'hasExactUranianMetaphysicalMinorMoonDirection', time: '1986-05-15T22:18:48.959Z', angle: 30,
      excerpt: /when there are other influences congenial to the Uranian vibration/u,
      explanation: /接触新思路的较弱机会/u,
      audit: /日天平行带内还有次限月亮对本命天王星的半六合相真点/u },
    { passage: 'p340', birth: '1910-05-20', year: 1972, body: 'Venus', aspect: 'quincunx',
      witness: 'hasVenusUranusParallelAtFormation', time: '1972-07-11T00:30:55.079Z', angle: 150,
      excerpt: /other influences of a similar nature are operating/u,
      explanation: /金天平行可作为较自发感受的背景/u,
      audit: /金天梅花实际成相时，同一星对也处在原书一度赤纬平行带/u },
  ];
  for (const { passage, birth, year, body, aspect, witness, time, angle, excerpt, explanation, audit } of cases) {
    const bornAt = Date.parse(birth), now = Date.UTC(year, 6, 1);
    const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const reference = { snapshotId: `leo-${passage}-minor-uranian`, chart: chart(bornAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === body && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === aspect);
    const point = family.find(({ normalizedPayload: p }) => p[witness]);
    assert.ok(point, passage);
    const at = Date.parse(point.activeFrom), end = Date.parse(point.activeTo), epoch = progressionEpoch(bornAt, at);
    assert.ok(Math.abs(at - Date.parse(time)) < 1_000, point.activeFrom);
    assert.equal(end - at, 1_000, passage);
    const fixed = readLeoMovingPosition('Uranus', bornAt), parallel = readLeoMovingPosition(body, epoch);
    const moving = body === 'Sun' ? readLeoMovingPosition('Moon', epoch) : parallel;
    const arc = Math.abs((moving.longitude - fixed.longitude + 540) % 360 - 180);
    assert.ok(Math.abs(arc - angle) < 0.00001, passage);
    assert.ok(leoParallelDifference(parallel.declination, fixed.declination) < 1, passage);
    if (body === 'Sun') {
      assert.deepEqual(point.normalizedPayload.uranianMetaphysicalMinorMoonDirection,
        { body: 'Moon', target: 'Uranus', targetKind: 'natal', aspectType: 'semisextile', passage: 'p206' });
      assert.equal(point.normalizedPayload.hasExactUranianMetaphysicalMoonDirection, false);
    } else {
      assert.equal(point.normalizedPayload.mutualExactInSlice, true);
      assert.deepEqual(point.normalizedPayload.exactLunarLinkedBodies, []);
    }
    const matchFor = fact => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western
      .find(row => row.knowledgeId.includes(`-${passage}-`));
    const conditions = result => (result.matchedConditions ?? result.confirmedBranches?.flatMap(row => row.conditions) ?? []).join('\n');
    const result = matchFor(point);
    assert.equal(result.status, 'matched', passage);
    assert.match(result.matchedSourceExcerpt, excerpt, passage);
    assert.match(conditions(result), explanation, passage);
    assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    for (const edge of [at - 1, end]) {
      const adjacent = family.find(row => Date.parse(row.activeFrom) <= edge && edge < Date.parse(row.activeTo));
      assert.ok(adjacent, passage);
      assert.equal(adjacent.normalizedPayload[witness], false, passage);
      assert.doesNotMatch(conditions(matchFor(adjacent)), explanation, passage);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.match(formatFortuneFactAudit(input), audit, passage);
    const provider = formatFortunePrompt(input);
    assert.match(provider, explanation, passage);
    assert.doesNotMatch(provider, audit, passage);
    assert.doesNotMatch(provider, new RegExp(witness, 'u'), passage);
  }

  const sun = { start: 0, end: 5_000, progressedBody: 'Sun', natalTargetId: 'Uranus', targetKind: 'natal',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1, exactTimes: [] };
  const moon = { ...sun, progressedBody: 'Moon', aspectType: 'semisextile', coordinate: 'ecliptic_longitude', exactTimes: [2_000] };
  const venus = { ...moon, progressedBody: 'Venus', aspectType: 'quincunx' };
  const venusParallel = { ...sun, progressedBody: 'Venus' };
  for (const [base, witness, field] of [[sun, moon, 'hasExactUranianMetaphysicalMinorMoonDirection'],
    [venus, venusParallel, 'hasVenusUranusParallelAtFormation']]) {
    const windows = updates => buildLeoLunarConditions([base, { ...witness, ...updates }])
      .filter(row => row.base === base && row[field]).map(({ start, end }) => [start, end]);
    assert.deepEqual(windows({}), [[2_000, 3_000]], field);
    assert.deepEqual(windows({ targetKind: 'progressed' }), [], field);
    assert.deepEqual(windows({ start: 2_001 }), [], field);
  }
});

test('p286 separates the topical natal Mercury direction and an exact Mercury direction to the same progressed Uranus', () => {
  const band = (start, end, progressedBody, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind, exactTimes: [] });
  const base = band(0, 10, 'Sun', 'Uranus', 'parallel');
  const rows = buildLeoLunarConditions([base, band(2, 4, 'Mercury', 'Uranus', 'sextile'),
    band(4, 6, 'Mercury', 'Uranus', 'sextile', 'progressed'), band(6, 8, 'Mercury', 'Jupiter', 'trine')])
    .filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.hasUranianMetaphysicalMutualDirection,
    row.uranianMetaphysicalMutualDirections.map(direction => direction.passage)]),
  [[0, 2, false, []], [2, 4, true, ['p120']], [4, 10, false, []]]);

  const progressedBase = { ...band(0, 10_000, 'Sun', 'Uranus', 'parallel', 'progressed'),
    coordinate: 'equatorial_declination_of_date', allowedOrb: 1 };
  const sextile = { ...band(1_500, 4_000, 'Mercury', 'Uranus', 'sextile', 'progressed'),
    coordinate: 'ecliptic_longitude', exactTimes: [2_000] };
  const exactSextile = witness => buildLeoLunarConditions([progressedBase, witness]).filter(row => row.base === progressedBase
    && row.hasExactUranianMetaphysicalMercuryDirection).map(row => [row.start, row.end, row.uranianMetaphysicalMercuryDirection.passage]);
  assert.deepEqual(exactSextile(sextile), [[2_000, 3_000, 'p120']]);
  assert.deepEqual(exactSextile({ ...sextile, targetKind: 'natal' }), []);
  assert.deepEqual(exactSextile({ ...sextile, natalTargetId: 'Jupiter' }), []);

  const birth = Date.parse('1954-09-22T00:00:00Z');
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  // Keep the actual lunar path outside houses VIII and IX in both charts so
  // the unsupported Mercury case has the plain solar background alone.
  const asOf = Date.UTC(2026, 6, 1), reference = { snapshotId: 'leo-uranian-mutual-context', chart: chart(birth, 45) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
  const isRule = row => row.knowledgeId.includes('-p286-');
  const result = matchFortuneKnowledge(run).byMethod.western.find(isRule);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  assert.equal(result.status, 'matched');
  const measured = (fact, targetKind, timestamp) => fact.activeFrom <= timestamp && timestamp < fact.activeTo
    && fact.normalizedPayload.targetKind === targetKind;
  for (const [date, supported] of [['2026-01-01', true], ['2026-10-01', false]]) {
    const instant = `${date}T00:00:00.000Z`;
    const witness = family.find(row => measured(row, 'natal', instant));
    const sameChart = family.find(row => measured(row, 'progressed', instant));
    assert.ok(witness && sameChart, date);
    assert.equal(witness.normalizedPayload.hasUranianMetaphysicalMutualDirection, supported, date);
    assert.equal(witness.normalizedPayload.metaphysicalDirectionState, 'none', date);
    assert.equal(sameChart.normalizedPayload.hasUranianMetaphysicalMutualDirection, undefined, date);
    assert.equal(sameChart.normalizedPayload.hasExactUranianMetaphysicalMercuryDirection, false, date);
    assert.equal(result.sourceFactIds.includes(witness.factId), supported || witness.normalizedPayload.sunUranusParallelBackgroundOnly, date);
    assert.equal(result.sourceFactIds.includes(sameChart.factId), sameChart.normalizedPayload.sunUranusParallelBackgroundOnly, date);
    assert.deepEqual(witness.normalizedPayload.uranianMetaphysicalMutualDirections, supported ? [{ body: 'Mercury', target: 'Uranus',
      targetKind: 'natal', aspectType: 'trine', nature: 'favourable', passage: 'p122' }] : [], date);

    const ephemerisAt = Math.round(progressionEpoch(birth, Date.parse(instant)));
    const mercury = readLeoMovingPosition('Mercury', ephemerisAt).longitude;
    const natalUranus = readLeoMovingPosition('Uranus', birth);
    const progressedUranus = readLeoMovingPosition('Uranus', ephemerisAt);
    const sun = readLeoMovingPosition('Sun', ephemerisAt);
    const trineError = uranus => Math.abs(Math.abs((mercury - uranus.longitude + 540) % 360 - 180) - 120);
    assert.ok(leoParallelDifference(sun.declination, natalUranus.declination) <= 1, date);
    assert.equal(trineError(natalUranus) <= 1, supported, date);
    assert.ok(trineError(progressedUranus) <= 1, date);
    if (!supported) {
      for (const fact of [witness, sameChart]) {
        const p = fact.normalizedPayload;
        assert.equal(p.sunUranusParallelBackgroundOnly, true);
        const isolated = { ...run, facts: [fact] };
        const result = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
        assert.equal(result.status, 'matched');
        assert.equal(result.matchedSourceExcerpt, 'This influence will extend over a period of several years');
        assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
        const where = changes => ({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, ...changes } }] });
        for (const changes of [{ allowedOrb: 0.25 }, { coordinate: 'ecliptic_longitude' }, { sunUranusParallelBackgroundOnly: false }]) {
          assert.notEqual(matchFortuneKnowledge(where(changes)).byMethod.western.find(isRule).status, 'matched');
        }
        const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
        const prompt = formatFortunePrompt(input);
        assert.match(prompt, /原书把这类平行列为多年背景/u);
        assert.doesNotMatch(prompt, /sunUranusParallelBackgroundOnly|when there are other influences congenial|will render the native either irritable/u);
      }
    }
  }
  const expectedExact = Date.parse('2026-04-14T16:16:06.942Z');
  const sameChartPoint = family.find(({ activeFrom, normalizedPayload: p }) => p.targetKind === 'progressed'
    && p.hasExactUranianMetaphysicalMercuryDirection === true && Math.abs(Date.parse(activeFrom) - expectedExact) < 1_000);
  assert.ok(sameChartPoint);
  assert.deepEqual(sameChartPoint.normalizedPayload.uranianMetaphysicalMercuryDirection,
    { body: 'Mercury', target: 'Uranus', targetKind: 'progressed', aspectType: 'trine', passage: 'p122' });
  assert.equal(sameChartPoint.normalizedPayload.hasUranianMetaphysicalMercuryLunarWitness, false);
  const { activeFrom: exact, activeTo: next } = sameChartPoint;
  const at = Date.parse(exact), epoch = Math.round(progressionEpoch(birth, at));
  assert.equal(Date.parse(next), at + 1_000);
  const mercury = readLeoMovingPosition('Mercury', epoch), uranus = readLeoMovingPosition('Uranus', epoch);
  assert.ok(Math.abs(Math.abs((mercury.longitude - uranus.longitude + 540) % 360 - 180) - 120) < 0.00001);
  assert.ok(leoParallelDifference(readLeoMovingPosition('Sun', epoch).declination, uranus.declination) < 1);
  for (const near of [new Date(at - 1).toISOString(), next]) {
    const adjacent = family.find(row => measured(row, 'progressed', near));
    assert.ok(adjacent);
    assert.equal(adjacent.normalizedPayload.hasExactUranianMetaphysicalMercuryDirection, false);
    assert.equal(adjacent.normalizedPayload.sunUranusParallelBackgroundOnly, true);
  }
  const natalAtSameTime = family.find(row => measured(row, 'natal', exact));
  assert.ok(natalAtSameTime);
  assert.equal(natalAtSameTime.normalizedPayload.hasExactUranianMetaphysicalMercuryDirection, false);
  const isolated = { ...run, facts: [sameChartPoint] };
  const exactResult = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
  assert.equal(exactResult.status, 'matched');
  assert.deepEqual(exactResult.windows, [{ start: exact, endExclusive: next }]);
  assert.equal(exactResult.matchedSourceExcerpt, 'when there are other influences congenial to the Uranian vibration');
  const { input: sameChartInput } = buildFortuneModelContext(isolated,
    interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
  const sameChartDetail = /次限水星对同图次限天王星的三分相真点/u;
  assert.match(formatFortuneFactAudit(sameChartInput), sameChartDetail);
  const sameChartPrompt = formatFortunePrompt(sameChartInput);
  assert.match(sameChartPrompt, /次限水星与同一颗次限天王星实际形成六合或三分/u);
  assert.doesNotMatch(sameChartPrompt, /uranianMetaphysicalMercuryDirection|hasExactUranianMetaphysicalMercuryDirection/u);
  assert.doesNotMatch(sameChartPrompt, sameChartDetail);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const localText = /也指向同一本命天王星，原书将它与原创思考和玄学研究相联/u;
  assert.match(formatFortuneFactAudit(input), localText);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /日天赤纬平行与次限水星对同一本命天王星的六合或三分在同一时段有效/u);
  assert.doesNotMatch(prompt, /日天赤纬平行有效时，次限太阳也对同一本命天王星实际形成六合或三分|will render the native either irritable/u);
  assert.doesNotMatch(prompt, localText);
});

test('p286 pairs exact solar sextile and trine with the same parallel endpoint', () => {
  const band = (progressedBody, natalTargetId, aspectType, targetKind, exactTimes) =>
    ({ start: 0, end: 5_000, progressedBody, natalTargetId, aspectType, targetKind, exactTimes });
  const base = band('Sun', 'Uranus', 'parallel', 'natal', []);
  const artificial = buildLeoLunarConditions([base,
    band('Sun', 'Uranus', 'sextile', 'natal', [2_000, 5_000]),
    band('Sun', 'Uranus', 'trine', 'progressed', [1_000]),
    band('Sun', 'Uranus', 'opposition', 'natal', [4_000]),
    band('Sun', 'Jupiter', 'trine', 'natal', [4_000]),
  ]).filter(row => row.base === base);
  assert.deepEqual(artificial.map(({ start, end, hasExactUranianMetaphysicalSolarDirection }) =>
    [start, end, hasExactUranianMetaphysicalSolarDirection]), [[0, 2_000, false], [2_000, 3_000, true], [3_000, 5_000, false]]);

  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(2026, 6, 1);
  for (const [birth, targetKind, aspectType, passage, angle, expectedAt] of [
    ['1957-03-16', 'natal', 'sextile', 'p280', 60, '2026-10-27T15:04:22.683Z'],
    ['1942-10-30', 'progressed', 'trine', 'p282', 120, '2026-06-14T07:22:38.020Z'],
  ]) {
    const bornAt = Date.parse(birth);
    const reference = { snapshotId: `leo-p286-${birth}`, chart: chart(bornAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
    const positive = family.find(({ normalizedPayload: p }) => p.targetKind === targetKind
      && p.hasExactUranianMetaphysicalSolarDirection);
    assert.ok(positive, `${birth} ${targetKind} ${aspectType}`);
    assert.deepEqual(positive.normalizedPayload.uranianMetaphysicalSolarDirection,
      { body: 'Sun', target: 'Uranus', targetKind, aspectType, passage });
    const at = Date.parse(positive.activeFrom);
    assert.ok(Math.abs(at - Date.parse(expectedAt)) < 1_000, `${birth} ${positive.activeFrom}`);
    const findParallel = (kind, instant) => family.find(({ activeFrom, activeTo, normalizedPayload }) =>
      normalizedPayload.targetKind === kind && Date.parse(activeFrom) <= instant && instant < Date.parse(activeTo));
    const otherKind = targetKind === 'natal' ? 'progressed' : 'natal';
    const sameLayerBefore = findParallel(targetKind, at - 1);
    const sameLayerAfter = findParallel(targetKind, at + 1_000);
    const wrongLayer = findParallel(otherKind, at);
    for (const fact of [sameLayerBefore, sameLayerAfter, wrongLayer]) {
      assert.equal(fact?.normalizedPayload.hasExactUranianMetaphysicalSolarDirection, false, birth);
      assert.equal(fact.normalizedPayload.uranianMetaphysicalSolarDirection, undefined, birth);
    }
    const epoch = progressionEpoch(bornAt, at);
    const sun = readLeoMovingPosition('Sun', epoch);
    const uranus = readLeoMovingPosition('Uranus', targetKind === 'natal' ? bornAt : epoch);
    const otherUranus = readLeoMovingPosition('Uranus', targetKind === 'natal' ? epoch : bornAt);
    const error = body => Math.abs(Math.abs((sun.longitude - body.longitude + 540) % 360 - 180) - angle);
    assert.ok(leoParallelDifference(sun.declination, uranus.declination) <= 1, birth);
    assert.ok(leoParallelDifference(sun.declination, otherUranus.declination) <= 1, birth);
    assert.ok(error(uranus) < 0.00001, birth);
    assert.ok(error(otherUranus) > 0.001, birth);
    if (targetKind === 'natal') assert.ok(error(otherUranus) < 1, birth);
    const isolated = { ...run, facts: [positive] };
    const result = matchFortuneKnowledge(isolated).byMethod.western.find(row => row.knowledgeId.includes('-p286-'));
    const natalConfirmed = targetKind === 'natal';
    assert.equal(result.status, 'matched', birth);
    assert.ok(result.sourceFactIds.includes(positive.factId), birth);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
    const localText = /日天平行带内还有[^，。]+真点，作为同层同主题证据/u;
    assert.match(formatFortuneFactAudit(input), localText, birth);
    const prompt = formatFortunePrompt(input);
    assert.doesNotMatch(prompt, localText, birth);
    assert.equal(/日天赤纬平行有效时，次限太阳也对同一本命天王星实际形成六合或三分/u.test(prompt), natalConfirmed, birth);
    assert.equal(/其表现取决于当事人能否利用现实机会及已有基础/u.test(prompt), !natalConfirmed, birth);
  }
});

test('p286 qualifies an exact solar quincunx only during its same natal parallel and with reviewed Uranus', () => {
  const isRule = row => row.knowledgeId.includes('-p286-');
  const born = Date.parse('1945-10-20T00:00:00Z'), year = 2025, asOf = Date.UTC(year, 6, 1);
  const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
  const reference = { snapshotId: 'leo-p286-quincunx', chart: chart(born) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  const point = family.find(({ normalizedPayload: p }) => p.uranianMetaphysicalSolarPassage === 'p284');
  assert.ok(point);
  const at = Date.parse(point.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2025-11-03T20:03:28.956Z')) < 1_000);
  assert.equal(Date.parse(point.activeTo) - at, 1_000);
  assert.deepEqual(point.normalizedPayload.uranianMetaphysicalSolarDirection,
    { body: 'Sun', target: 'Uranus', targetKind: 'natal', aspectType: 'quincunx', passage: 'p284' });
  const solar = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === 'leo_progressed_aspect_exact'
    && exactInstant === point.activeFrom && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus'
    && p.targetKind === 'natal' && p.aspectType === 'quincunx');
  assert.equal(solar?.normalizedPayload.hasNatalUranusAffliction, false);
  const epoch = progressionEpoch(born, at), sun = readLeoMovingPosition('Sun', epoch), uranus = readLeoMovingPosition('Uranus', born);
  const angle = Math.abs((sun.longitude - uranus.longitude + 540) % 360 - 180);
  assert.ok(Math.abs(angle - 150) < 0.00001);
  assert.ok(leoParallelDifference(sun.declination, uranus.declination) <= 1);
  const only = { ...run, facts: [point] };
  const result = matchFortuneKnowledge(only).byMethod.western.find(isRule);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  const { input } = buildFortuneModelContext(only, interpretFortune(only, requestForFortuneRun(only), reference.snapshotId));
  const staticText = /较易带来疏离或分歧/u;
  const auditText = /次限太阳对本命天王星的梅花相真点/u;
  assert.match(formatFortuneFactAudit(input), auditText);
  assert.match(formatFortunePrompt(input), staticText);
  assert.doesNotMatch(formatFortunePrompt(input), /hasNatalUranusAffliction|次限太阳对本命天王星的梅花相真点|2025-11-03T20:03/u);
  for (const instant of [at - 1, at + 1_000]) {
    const neighbour = family.find(({ normalizedPayload: p, activeFrom, activeTo }) => p.targetKind === 'natal'
      && Date.parse(activeFrom) <= instant && instant < Date.parse(activeTo));
    assert.ok(neighbour);
    assert.notEqual(neighbour.normalizedPayload.uranianMetaphysicalSolarPassage, 'p284');
  }
  const base = { start: 0, end: 5_000, progressedBody: 'Sun', natalTargetId: 'Uranus', targetKind: 'natal',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1, exactTimes: [] };
  const witness = { ...base, aspectType: 'quincunx', coordinate: 'ecliptic_longitude', exactTimes: [2_000], hasNatalUranusAffliction: false };
  const review = changes => buildLeoLunarConditions([base, { ...witness, ...changes }])
    .filter(row => row.base === base && row.uranianMetaphysicalSolarDirection?.passage === 'p284')
    .map(({ start, end }) => [start, end]);
  assert.deepEqual(review({}), [[2_000, 3_000]]);
  for (const changed of [{ targetKind: 'progressed' }, { hasNatalUranusAffliction: true },
    { hasNatalUranusAffliction: undefined }, { exactTimes: [5_000] }]) assert.deepEqual(review(changed), []);
});

test('p286 and p340 confirm the same progressed Uranus in simultaneous longitude and declination contacts', () => {
  const samples = [
    { passage: 'p286', birth: '1993-05-10', body: 'Sun', baseAspect: 'parallel',
      at: '2026-09-04T06:31:57.054Z', confirmed: p => p.uranianMetaphysicalSolarPassage === 'p284',
      text: /同图次限太阳与同一颗次限天王星实际形成一百五十度/u },
    { passage: 'p340', birth: '1980-06-09', body: 'Venus', baseAspect: 'quincunx',
      at: '2026-05-29T08:35:04.722Z', confirmed: p => p.hasVenusUranusParallelAtFormation === true,
      text: /同图次限金星与同一颗次限天王星实际成梅花相/u },
  ];
  const separation = (first, second) => Math.abs((first - second + 540) % 360 - 180);
  for (const sample of samples) {
    const { birthAt, reference, run } = progressedPairRun2026(sample.birth);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === sample.body && p.natalTargetId === 'Uranus' && p.aspectType === sample.baseAspect
      && p.targetKind === 'progressed');
    const witness = family.find(row => sample.confirmed(row.normalizedPayload)
      && Math.abs(Date.parse(row.activeFrom) - Date.parse(sample.at)) < 1000);
    assert.ok(witness, sample.passage);
    assert.equal(Date.parse(witness.activeTo) - Date.parse(witness.activeFrom), 1000);
    const epoch = Math.round(progressionEpoch(birthAt, Date.parse(witness.activeFrom)));
    const mover = readLeoMovingPosition(sample.body, epoch), target = readLeoMovingPosition('Uranus', epoch);
    const fixedTarget = readLeoMovingPosition('Uranus', birthAt);
    assert.ok(Math.abs(separation(mover.longitude, target.longitude) - 150) < 0.00001, sample.passage);
    assert.ok(leoParallelDifference(mover.declination, target.declination) <= 1, sample.passage);
    assert.ok(Math.abs(separation(mover.longitude, fixedTarget.longitude) - 150) > 0.00001, sample.passage);
    if (sample.passage === 'p286') {
      const proof = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === 'leo_progressed_aspect_exact'
        && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.targetKind === 'progressed'
        && p.aspectType === 'quincunx' && exactInstant === witness.activeFrom);
      assert.equal(proof?.normalizedPayload.hasNatalUranusAffliction, false);
    }
    const read = facts => matchFortuneKnowledge({ ...run, facts }).byMethod.western
      .find(row => row.knowledgeId.includes('-' + sample.passage + '-'));
    const text = hit => (hit.matchedConditions ?? hit.confirmedBranches?.flatMap(branch => branch.conditions) ?? []).join(' ');
    const hit = read([witness]);
    assert.equal(hit.status, 'matched');
    assert.match(text(hit), sample.text);
    assert.deepEqual(hit.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    const next = family.find(row => row.activeFrom === witness.activeTo);
    assert.ok(next);
    assert.doesNotMatch(text(read([next])), sample.text);
    const selected = { ...run, facts: [witness] };
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), reference.snapshotId));
    assert.match(formatFortunePrompt(input), sample.text);
    assert.doesNotMatch(formatFortunePrompt(input), /hasVenusUranusParallelAtFormation|uranianMetaphysicalSolarPassage/u);
  }
});

test('p286 admits the source-named Sun and Mercury semi-sextiles only at the same parallel endpoint', () => {
  const isRule = row => row.knowledgeId.includes('-p286-');
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(2026, 6, 1);
  for (const [birth, body, targetKind, passage, expectedAt, armc] of [
    ['1946-04-18', 'Sun', 'natal', 'p278', '2026-10-14T22:28:15.600Z'],
    ['1945-04-17', 'Sun', 'progressed', 'p278', '2026-12-14T22:17:56.760Z', 180],
    ['1946-03-29', 'Mercury', 'natal', 'p118', '2026-09-10T23:06:54.252Z'],
  ]) {
    const bornAt = Date.parse(birth);
    const reference = { snapshotId: `leo-p286-semisextile-${birth}`, chart: chart(bornAt, armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
    const directionKey = `uranianMetaphysical${body === 'Sun' ? 'Solar' : 'Mercury'}Direction`;
    const exactKey = `hasExactUranianMetaphysical${body === 'Sun' ? 'Solar' : 'Mercury'}Direction`;
    const point = family.find(({ normalizedPayload: p }) => p.targetKind === targetKind && p[directionKey]?.passage === passage);
    assert.ok(point, birth);
    const p = point.normalizedPayload, at = Date.parse(point.activeFrom);
    assert.equal(p[exactKey], true, birth);
    assert.deepEqual(p[directionKey], { body, target: 'Uranus', targetKind, aspectType: 'semisextile', passage }, birth);
    assert.ok(Math.abs(at - Date.parse(expectedAt)) < 1_000, point.activeFrom);
    const ephemerisAt = progressionEpoch(bornAt, at);
    const sun = readLeoMovingPosition('Sun', ephemerisAt);
    const moving = readLeoMovingPosition(body, ephemerisAt);
    const target = readLeoMovingPosition('Uranus', targetKind === 'natal' ? bornAt : ephemerisAt);
    const otherTarget = readLeoMovingPosition('Uranus', targetKind === 'natal' ? ephemerisAt : bornAt);
    const angleError = position => Math.abs(Math.abs((moving.longitude - position.longitude + 540) % 360 - 180) - 30);
    assert.ok(leoParallelDifference(sun.declination, target.declination) < 1, birth);
    assert.ok(leoParallelDifference(sun.declination, otherTarget.declination) < 1, birth);
    assert.ok(angleError(target) < 0.00001 && angleError(otherTarget) > 0.005, birth);
    const atSlice = (instant, layer) => family.find(row => row.normalizedPayload.targetKind === layer
      && Date.parse(row.activeFrom) <= instant && instant < Date.parse(row.activeTo));
    for (const row of [atSlice(at - 1, targetKind), atSlice(Date.parse(point.activeTo), targetKind),
      atSlice(at, targetKind === 'natal' ? 'progressed' : 'natal')]) {
      assert.ok(row && row.normalizedPayload[directionKey] === undefined, birth);
    }
    const isolated = { ...run, facts: [point] };
    const result = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(result.status, 'partial', birth);
    assert.equal(p.sunUranusParallelBackgroundOnly, false, birth);
    assert.notEqual(p.hasUranianMetaphysicalMercuryLunarWitness, true, birth);
    assert.ok(result.sourceFactIds.includes(point.factId), birth);
    const annual = matchFortuneKnowledge(run).byMethod.western.find(isRule);
    const candidates = annual.status === 'partial' ? annual.sourceFactIds : annual.candidateFactIds;
    assert.ok(candidates?.includes(point.factId), birth);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const local = `日天平行带内还有次限${body === 'Sun' ? '太阳' : '水星'}对${targetKind === 'natal' ? '本命' : '同图次限'}天王星的半六合相真点，作为同层较弱的同主题证据`;
    assert.ok(formatFortuneFactAudit(input).includes(local), birth);
    const prompt = formatFortunePrompt(input);
    assert.ok(!prompt.includes(local), birth);
    assert.doesNotMatch(prompt, /uranianMetaphysicalMercuryDirection|hasExactUranianMetaphysicalMercuryDirection/u);
  }
});

test('p286 confirms the conditional Moon conjunction during the true solar parallel in each chart layer', () => {
  const birth = Date.parse('1945-04-17T00:00:00Z');
  const asOf = Date.UTC(2026, 6, 1);
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const reference = { snapshotId: 'leo-p286-conditional-conjunction', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
  const isRule = row => row.knowledgeId.includes('-p286-');
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  const confirm = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).confirmations.find(query =>
    JSON.parse(query.condition).where.hasExactUranianMetaphysicalMoonConjunction === true);
  const rowAt = (time, layer) => family.find(row => row.normalizedPayload.targetKind === layer
    && Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
  for (const [targetKind, approximate, opposite] of [
    ['natal', '2026-04-04T00:18:49Z', 'progressed'],
    ['progressed', '2026-07-29T10:52:06Z', 'natal'],
  ]) {
    const hit = family.find(({ activeFrom, normalizedPayload: p }) => p.hasExactUranianMetaphysicalMoonConjunction
      && p.targetKind === targetKind && Math.abs(Date.parse(activeFrom) - Date.parse(approximate)) < 1_000);
    assert.ok(hit, targetKind);
    const p = hit.normalizedPayload;
    assert.deepEqual(p.uranianMetaphysicalMoonConjunction,
      { body: 'Moon', target: 'Uranus', targetKind, aspectType: 'conjunction', passage: 'p205' });
    assert.equal(p.hasExactUranianMetaphysicalMoonDirection, false);
    assert.equal(p.hasExactUranianMetaphysicalMinorMoonDirection, false);
    assert.equal(p.sunUranusParallelBackgroundOnly, false);
    const at = Date.parse(hit.activeFrom);
    assert.equal(Date.parse(hit.activeTo), at + 1_000);
    const epoch = progressionEpoch(birth, at);
    const moon = readLeoMovingPosition('Moon', epoch), sun = readLeoMovingPosition('Sun', epoch);
    const target = readLeoMovingPosition('Uranus', targetKind === 'natal' ? birth : epoch);
    const other = readLeoMovingPosition('Uranus', opposite === 'natal' ? birth : epoch);
    const separation = body => Math.abs((moon.longitude - body.longitude + 540) % 360 - 180);
    assert.ok(separation(target) < 0.00001 && separation(other) > 0.01);
    assert.ok(leoParallelDifference(sun.declination, target.declination) < 1);
    const excluded = [rowAt(at - 1, targetKind), rowAt(at + 1_000, targetKind), rowAt(at, opposite)];
    assert.ok(excluded.every(row => row?.normalizedPayload.hasExactUranianMetaphysicalMoonConjunction === false));
    assert.deepEqual(confirm([hit]).hits, [hit]);
    assert.deepEqual(confirm(excluded).hits, []);
    const isolated = { ...run, facts: [hit] };
    const result = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start: hit.activeFrom, endExclusive: hit.activeTo }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(run), reference.snapshotId));
    const local = /日天平行带内还有次限月亮对(?:本命|同图次限)天王星的合相真点/u;
    assert.match(formatFortuneFactAudit(input), local);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /若本人[^。]+研究/u);
    assert.doesNotMatch(provider, local);
    assert.doesNotMatch(provider, /hasExactUranianMetaphysicalMoonConjunction|uranianMetaphysicalMoonConjunction/u);
  }
});

test('p044 and p066 share the exact adverse Moon–Neptune sesquiquadrate without mixing chart layers', () => {
  const cases = [
    { birth: '1927-07-24', at: '2026-12-25T20:25:05.502Z', passage: 'p044', target: 'Jupiter',
      aspect: 'quincunx', lunarLayer: 'natal', baseAt: (mars, partner) => Math.abs(separation(mars.longitude, partner.longitude) - 150) },
    { birth: '1908-06-11', at: '2026-05-13T14:03:46.734Z', passage: 'p066', target: 'Saturn',
      aspect: 'parallel', lunarLayer: 'progressed', baseAt: (mars, partner) => leoParallelDifference(mars.declination, partner.declination) },
  ];
  function separation(first, second) {
    return Math.abs((first - second + 540) % 360 - 180);
  }
  for (const sample of cases) {
    const { birthAt, run } = progressedPairRun2026(sample.birth);
    const target = row => row.knowledgeId.includes('-' + sample.passage + '-');
    const evaluated = evaluateFortuneRules('western', 'year', run.facts).find(target);
    const branch = evaluated.confirmations.find(row => JSON.parse(row.condition).where.hasExactCleanNeptuneLunarSesquiquadrate === true);
    const expectedAt = Date.parse(sample.at);
    assert.ok(Math.abs(Date.parse(sample.at) - expectedAt) < 1_000);
    const point = branch.hits.find(({ activeFrom, normalizedPayload: p }) => p.targetKind === 'natal'
      && p.natalTargetId === sample.target && p.aspectType === sample.aspect && Math.abs(Date.parse(activeFrom) - expectedAt) < 1_000);
    assert.ok(point, sample.passage);
    assert.deepEqual(point.normalizedPayload.exactCleanNeptuneLunarSesquiquadrate,
      { body: 'Moon', target: 'Neptune', targetKind: sample.lunarLayer, aspectType: 'sesquiquadrate' });
    const actualAt = Date.parse(point.activeFrom), epoch = Math.round(progressionEpoch(birthAt, actualAt));
    assert.equal(Date.parse(point.activeTo) - actualAt, 1_000);
    const moon = readLeoMovingPosition('Moon', epoch);
    const neptuneAngle = layer => separation(moon.longitude, readLeoMovingPosition('Neptune', layer === 'natal' ? birthAt : epoch).longitude);
    assert.ok(Math.abs(neptuneAngle(sample.lunarLayer) - 135) < 0.00001, sample.passage);
    assert.ok(Math.abs(neptuneAngle(sample.lunarLayer === 'natal' ? 'progressed' : 'natal') - 135) > 0.05, sample.passage);
    assert.ok(sample.baseAt(readLeoMovingPosition('Mars', epoch), readLeoMovingPosition(sample.target, birthAt)) < 1);
    const adjacent = evaluated.required[0].hits.filter(row => row.parentSignalId === point.parentSignalId
      && (row.activeTo === point.activeFrom || row.activeFrom === point.activeTo));
    assert.equal(adjacent.length, 2);
    assert.ok(adjacent.every(row => row.normalizedPayload.hasExactCleanNeptuneLunarSesquiquadrate === false));
    const isolated = { ...run, facts: [point] };
    assert.ok(matchFortuneKnowledge(isolated).byMethod.western.find(target).sourceFactIds.includes(point.factId));
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-moon-neptune-sesquiquadrate'));
    assert.match(formatFortunePrompt(input), /只在实际成相的一秒参考短暂困扰/u);
    assert.doesNotMatch(formatFortunePrompt(input), /exactCleanNeptuneLunarSesquiquadrate|两层其余已核月相未见偏顺/u);
    assert.match(formatFortuneFactAudit(input), /海王星的倍半刑相实际成相/u);
  }
});

test('p044 and p066 confirm the same exact Moon–Neptune semisquare while keeping mixed lunar evidence unresolved', () => {
  const field = 'hasExactCleanNeptuneLunarSemisquare';
  const separation = (first, second) => Math.abs((first - second + 540) % 360 - 180);
  const cases = [
    { birth: '1967-12-27', at: '2026-12-02T14:49:08Z', lunarLayer: 'natal', clean: true },
    { birth: '1967-12-27', at: '2026-12-29T18:48:24Z', lunarLayer: 'progressed', clean: true },
    { birth: '1954-09-16', at: '2026-01-08T19:37:35Z', lunarLayer: 'progressed', clean: false },
  ];
  const rules = [
    ['p044', 'Jupiter', 'quincunx', 'natal'],
    ['p066', 'Saturn', 'parallel', 'progressed'],
  ];
  for (const { birth, at, lunarLayer, clean } of cases) {
    const { birthAt, run } = progressedPairRun2026(birth);
    const evaluated = evaluateFortuneRules('western', 'year', run.facts);
    const expectedAt = Date.parse(at);
    for (const [passage, partner, aspect, targetKind] of rules) {
      const isRule = row => row.knowledgeId.includes('-' + passage + '-');
      const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
        && p.progressedBody === 'Mars' && p.natalTargetId === partner && p.aspectType === aspect && p.targetKind === targetKind);
      const point = family.find(({ activeFrom, normalizedPayload: p }) => Math.abs(Date.parse(activeFrom) - expectedAt) < 2_000
        && p.contacts.some(contact => contact.target === 'Neptune' && contact.targetKind === lunarLayer
          && contact.aspectType === 'semisquare' && contact.exactTimes.includes(activeFrom)));
      assert.ok(point, `${birth} ${passage} ${lunarLayer}`);
      const actual = Date.parse(point.activeFrom), stamp = Math.round(progressionEpoch(birthAt, actual));
      assert.equal(Date.parse(point.activeTo) - actual, 1_000);
      const moon = readLeoMovingPosition('Moon', stamp);
      const neptune = layer => readLeoMovingPosition('Neptune', layer === 'natal' ? birthAt : stamp);
      assert.ok(Math.abs(separation(moon.longitude, neptune(lunarLayer).longitude) - 45) < 0.00001);
      assert.ok(Math.abs(separation(moon.longitude, neptune(lunarLayer === 'natal' ? 'progressed' : 'natal').longitude) - 45) > 0.05);
      const mars = readLeoMovingPosition('Mars', stamp);
      const outer = readLeoMovingPosition(partner, targetKind === 'natal' ? birthAt : stamp);
      assert.ok((partner === 'Jupiter' ? Math.abs(separation(mars.longitude, outer.longitude) - 150)
        : leoParallelDifference(mars.declination, outer.declination)) < 1);
      const branch = evaluated.find(isRule).confirmations.find(row => JSON.parse(row.condition).where[field] === true);
      assert.equal(branch.hits.some(row => row.factId === point.factId), clean);
      assert.equal(point.normalizedPayload[field], clean);
      if (!clean) {
        assert.ok(point.normalizedPayload.contacts.some(contact => contact.target === 'Mercury'
          && contact.targetKind === 'natal' && contact.nature === 'favourable' && contact.aspectType === 'sextile'));
        continue;
      }
      assert.deepEqual(point.normalizedPayload.exactCleanNeptuneLunarSemisquare,
        { body: 'Moon', target: 'Neptune', targetKind: lunarLayer, aspectType: 'semisquare' });
      const adjacent = family.filter(row => row.activeTo === point.activeFrom || row.activeFrom === point.activeTo);
      assert.equal(adjacent.length, 2);
      assert.ok(adjacent.every(row => !row.normalizedPayload[field]));
      const scoped = { ...run, facts: [point] };
      const match = matchFortuneKnowledge(scoped).byMethod.western.find(isRule);
      assert.ok(match.sourceFactIds.includes(point.factId));
      assert.deepEqual(match.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), scoped.natalChartSnapshotId));
      assert.match(formatFortuneFactAudit(input), /海王星的半刑相实际成相/u);
      const prompt = formatFortunePrompt(input);
      assert.match(prompt, /海王星实际成半刑/u);
      assert.match(prompt, /留意轻信或受他人影响/u);
      assert.doesNotMatch(prompt, /exactCleanNeptuneLunarSemisquare|两层其余已核月相未见偏顺/u);
    }
  }
});

test('p066 uses the true trine within the same natal or progressed Mars–Saturn parallel', () => {
  const birth = '1924-07-25';
  const { birthAt, run } = progressedPairRun2026(birth);
  const passage = row => row.knowledgeId.includes('-p066-');
  const evaluated = evaluateFortuneRules('western', 'year', run.facts).find(passage);
  const branch = evaluated.confirmations.find(row => row.sourceExcerpt === 'allowing the strength of Mars to be blended with the tact of Saturn');
  assert.equal(branch.hits.length, 1);
  const [point] = branch.hits;
  assert.equal(point.normalizedPayload.targetKind, 'progressed');
  assert.equal(point.normalizedPayload.hasMarsSaturnTrineAtParallel, true);
  const at = Date.parse(point.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2026-11-28T14:53:20.760Z')) < 1_000);
  assert.equal(Date.parse(point.activeTo) - at, 1_000);
  const epoch = Math.round(progressionEpoch(birthAt, at));
  const mars = readLeoMovingPosition('Mars', epoch);
  const saturn = readLeoMovingPosition('Saturn', epoch);
  const natalSaturn = readLeoMovingPosition('Saturn', birthAt);
  const angle = other => Math.abs((mars.longitude - other.longitude + 540) % 360 - 180);
  assert.ok(Math.abs(angle(saturn) - 120) < 0.00001);
  assert.ok(Math.abs(angle(natalSaturn) - 120) > 9);
  assert.ok(Math.abs(Math.abs(mars.declination) - Math.abs(saturn.declination)) < 1);
  const adjacent = evaluated.required[0].hits.filter(fact => fact.parentSignalId === point.parentSignalId
    && (fact.activeTo === point.activeFrom || fact.activeFrom === point.activeTo));
  assert.equal(adjacent.length, 2);
  assert.ok(adjacent.every(fact => fact.normalizedPayload.hasMarsSaturnTrineAtParallel === false));
  const matched = matchFortuneKnowledge(run).byMethod.western.find(passage);
  assert.ok(matched.sourceFactIds.includes(point.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p066-trine-parallel'));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /若本人确在调整行动的力度和节奏/u);
  assert.doesNotMatch(provider, /hasMarsSaturnTrineAtParallel|2026-11-28T14:53/u);
  assert.match(formatFortuneFactAudit(input), /同一盘层火土三分实际成相/u);

  const natalCases = [
    { birth: '1927-03-12', at: '2026-04-01T10:09:38.279Z', withinParallel: true },
    { birth: '1946-08-22', at: '2026-10-10T03:06:03.240Z', withinParallel: false },
  ];
  for (const sample of natalCases) {
    const { birthAt: natalBirth, run: natalRun } = progressedPairRun2026(sample.birth);
    const at = Date.parse(sample.at);
    const epoch = Math.round(progressionEpoch(natalBirth, at));
    const movingMars = readLeoMovingPosition('Mars', epoch);
    const fixedSaturn = readLeoMovingPosition('Saturn', natalBirth);
    const movingSaturn = readLeoMovingPosition('Saturn', epoch);
    const trineDifference = saturn => Math.abs(Math.abs((movingMars.longitude - saturn.longitude + 540) % 360 - 180) - 120);
    assert.ok(trineDifference(fixedSaturn) < 0.00001, sample.birth);
    assert.ok(trineDifference(movingSaturn) > 4, sample.birth);
    assert.equal(leoParallelDifference(movingMars.declination, fixedSaturn.declination) < 1, sample.withinParallel);
    const evaluation = evaluateFortuneRules('western', 'year', natalRun.facts).find(passage);
    const hits = evaluation.confirmations.find(row => row.sourceExcerpt === branch.sourceExcerpt).hits;
    const nearby = hits.filter(fact => fact.normalizedPayload.targetKind === 'natal'
      && Math.abs(Date.parse(fact.activeFrom) - at) < 1_000);
    assert.equal(nearby.length, Number(sample.withinParallel), sample.birth);
    if (sample.withinParallel) {
      const [matchedPoint] = nearby;
      assert.equal(Date.parse(matchedPoint.activeTo) - Date.parse(matchedPoint.activeFrom), 1_000);
      const matched = matchFortuneKnowledge({ ...natalRun, facts: nearby }).byMethod.western.find(passage);
      assert.deepEqual(matched.sourceFactIds, [matchedPoint.factId]);
    }
  }
});

test('p066 and p286 bind progressed-only endpoint witnesses to the true parallel', () => {
  const branchesText = result => (result.matchedConditions ?? result.confirmedBranches?.flatMap(branch => branch.conditions) ?? []).join('\n');
  const cases = [
    { birth: '1939-09-15', passage: 'p066', first: 'Mars', second: 'Saturn',
      witnessFirst: 'Moon', witnessSecond: 'Mars', witnessAngle: 90,
      at: '2026-04-12T16:49:55.422Z', key: 'hasMarsSaturnAdverseLunarActivation',
      text: /次限月亮与同一张次限图上的火星或土星实际形成/u },
    { birth: '1986-05-23', passage: 'p286', first: 'Sun', second: 'Uranus',
      witnessFirst: 'Venus', witnessSecond: 'Uranus', witnessAngle: 120,
      at: '2026-12-13T03:26:23.679Z', key: 'hasExactUranianMetaphysicalVenusDirection',
      text: /同图次限金星与经核的同一颗次限天王星实际三分/u },
  ];
  const angleBetween = (first, second) => Math.abs((first - second + 540) % 360 - 180);
  for (const sample of cases) {
    const { birthAt, reference, run } = progressedPairRun2026(sample.birth);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === sample.first && p.natalTargetId === sample.second && p.aspectType === 'parallel');
    const row = family.find(item => item.activeFrom === sample.at && item.normalizedPayload.targetKind === 'progressed'
      && item.normalizedPayload[sample.key] === true);
    assert.ok(row, sample.passage);
    assert.equal(Date.parse(row.activeTo) - Date.parse(row.activeFrom), 1_000);
    const epoch = Math.round(progressionEpoch(birthAt, Date.parse(sample.at)));
    const position = body => readLeoMovingPosition(body, epoch);
    assert.ok(leoParallelDifference(position(sample.first).declination, position(sample.second).declination) < 1);
    assert.ok(Math.abs(angleBetween(position(sample.witnessFirst).longitude, position(sample.witnessSecond).longitude)
      - sample.witnessAngle) < 0.00001);
    const wasNatalWitness = sample.passage === 'p066'
      ? leoParallelDifference(position(sample.first).declination, readLeoMovingPosition(sample.second, birthAt).declination) < 1
      : Math.abs(angleBetween(position(sample.witnessFirst).longitude, readLeoMovingPosition(sample.witnessSecond, birthAt).longitude)
        - sample.witnessAngle) < 0.00001;
    assert.equal(wasNatalWitness, false);

    const match = facts => matchFortuneKnowledge({ ...run, facts }).byMethod.western
      .find(result => result.knowledgeId.includes('-' + sample.passage + '-'));
    assert.equal(match(run.facts).status, 'matched');
    const exact = match([row]);
    assert.equal(exact.status, 'matched');
    assert.match(branchesText(exact), sample.text);
    const following = family.find(item => item.activeFrom === row.activeTo && item.normalizedPayload.targetKind === 'progressed');
    assert.ok(following);
    assert.equal(following.normalizedPayload[sample.key], false);
    assert.doesNotMatch(branchesText(match([following])), sample.text);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.match(provider, sample.text);
    assert.ok(!provider.includes(sample.at));
    assert.ok(!provider.includes(sample.key));
  }
});

test('p286 uses the exact Venus trine only during a parallel to the same natal Uranus', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, 6, 1), birth = Date.parse('1936-05-18T00:00:00Z');
  const reference = { snapshotId: 'leo-p286-venus-trine', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const isRule = row => row.knowledgeId.includes('-p286-');
  const matchFor = fact => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western.find(isRule);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  const witness = family.find(({ normalizedPayload: p }) => p.hasExactUranianMetaphysicalVenusDirection);
  assert.ok(witness);
  const at = Date.parse(witness.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2026-12-09T15:27:26.960Z')) < 1_000);
  assert.equal(Date.parse(witness.activeTo), at + 1_000);
  assert.deepEqual(witness.normalizedPayload.uranianMetaphysicalVenusDirection,
    { body: 'Venus', target: 'Uranus', targetKind: 'natal', aspectType: 'trine', passage: 'p338' });
  const progressedAt = Math.round(progressionEpoch(birth, at));
  const sun = readLeoMovingPosition('Sun', progressedAt), fixed = readLeoMovingPosition('Uranus', birth);
  const moving = readLeoMovingPosition('Uranus', progressedAt), venus = readLeoMovingPosition('Venus', progressedAt);
  assert.ok(leoParallelDifference(sun.declination, fixed.declination) < 1);
  assert.ok(leoParallelDifference(sun.declination, moving.declination) < 1);
  const trineError = target => Math.abs(Math.abs((venus.longitude - target.longitude + 540) % 360 - 180) - 120);
  assert.ok(trineError(fixed) < 0.00001);
  assert.ok(trineError(moving) > 0.005);
  for (const [instant, layer] of [[at - 1, 'natal'], [at + 1_000, 'natal'], [at, 'progressed']]) {
    const contrast = family.find(({ activeFrom, activeTo, normalizedPayload: p }) => p.targetKind === layer
      && Date.parse(activeFrom) <= instant && instant < Date.parse(activeTo));
    assert.ok(contrast);
    assert.notEqual(contrast.normalizedPayload.hasExactUranianMetaphysicalVenusDirection, true);
    assert.ok(!matchFor(contrast).matchedSourceExcerpt?.includes('when there are other influences congenial'));
  }
  const match = matchFor(witness);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [witness.factId]);
  assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const oldShape = { ...witness, normalizedPayload: { ...witness.normalizedPayload, hasExactUranianMetaphysicalVenusDirection: false } };
  assert.equal(matchFor(oldShape).status, 'not_matched');
  const adverse = family.find(({ activeFrom, activeTo, normalizedPayload: p }) => p.targetKind === 'natal'
    && activeFrom <= '2026-03-01T17:14:24.431Z' && '2026-03-01T17:14:24.431Z' < activeTo);
  assert.ok(adverse);
  assert.ok(adverse.normalizedPayload.contacts.some(p => p.targetKind === 'natal' && p.target === 'Uranus' && p.aspectType === 'square'));
  assert.equal(adverse.normalizedPayload.hasExactUranianMetaphysicalMoonDirection, false);
  assert.ok(!matchFor(adverse).matchedSourceExcerpt?.includes('when there are other influences congenial'));
  const wrongOrb = { ...witness, normalizedPayload: { ...witness.normalizedPayload, allowedOrb: 0.25 } };
  assert.equal(matchFor(wrongOrb).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const local = /日天平行带内还有次限金星对本命天王星的三分相真点，作为同层同主题证据/u;
  assert.match(formatFortuneFactAudit(input), local);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /原书将这两种推运均联系到形而上学与相关研究/u);
  assert.match(prompt, /个人的实际兴趣、反应和经历仍依现实情况判断/u);
  assert.doesNotMatch(prompt, /日天平行带内还有次限金星|uranianMetaphysicalVenusDirection/u);
});

test('p286 confirms a natal Moon trine true point and the Mercury semi-sextile within that same lunar band', () => {
  const isRule = row => row.knowledgeId.includes('-p286-');
  const birth = Date.parse('1952-04-23T00:00:00Z');
  const params = { periodType: 'year', targetPeriod: { year: 1995 }, displayTimezone: 'UTC' };
  const now = Date.UTC(1995, 6, 1);
  const reference = { snapshotId: 'leo-p286-lunar-research', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  const matchFor = (...facts) => matchFortuneKnowledge({ ...run, facts }).byMethod.western.find(isRule);
  const atSlice = (layer, at) => family.find(({ activeFrom, activeTo, normalizedPayload: p }) =>
    p.targetKind === layer && Date.parse(activeFrom) <= at && at < Date.parse(activeTo));
  const dest = readLeoMovingPosition('Uranus', birth);
  const arc = (a, b) => Math.abs((a - b + 540) % 360 - 180);
  for (const [witnessKey, body, angle, expected] of [
    ['uranianMetaphysicalMercuryLunarDirection', 'Mercury', 30, '1995-11-19T02:02:49.299Z'],
    ['uranianMetaphysicalMoonDirection', 'Moon', 120, '1995-12-05T22:44:21.877Z'],
  ]) {
    const fact = family.find(({ normalizedPayload: p }) => p.targetKind === 'natal' && p[witnessKey]);
    assert.ok(fact, witnessKey);
    const p = fact.normalizedPayload, at = Date.parse(fact.activeFrom);
    assert.ok(Math.abs(at - Date.parse(expected)) < 1_000, fact.activeFrom);
    assert.equal(Date.parse(fact.activeTo), at + 1_000);
    assert.deepEqual(p[witnessKey], { body: 'Moon', target: 'Uranus', targetKind: 'natal', aspectType: 'trine', passage: 'p210' });
    const eph = progressionEpoch(birth, at);
    const sun = readLeoMovingPosition('Sun', eph);
    const lunarError = Math.abs(arc(readLeoMovingPosition('Moon', eph).longitude, dest.longitude) - 120);
    assert.ok(leoParallelDifference(sun.declination, dest.declination) < 1);
    assert.ok(Math.abs(arc(readLeoMovingPosition(body, eph).longitude, dest.longitude) - angle) < 0.00001);
    assert.ok(body === 'Moon' ? lunarError < 0.00001 : lunarError > 0.6 && lunarError < 1);
    assert.notEqual(body === 'Moon' ? p.hasUranianMetaphysicalMercuryLunarWitness : p.hasExactUranianMetaphysicalMoonDirection, true);
    const result = matchFor(fact);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    for (const contrast of [atSlice('natal', at - 1), atSlice('natal', at + 1_000), atSlice('progressed', at)]) {
      assert.ok(contrast);
      assert.equal(contrast.normalizedPayload[witnessKey], undefined);
      assert.ok(!matchFor(contrast).matchedSourceExcerpt?.includes('when there are other influences congenial'));
    }
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const auditText = formatFortuneFactAudit(input);
  assert.match(auditText, /日天平行带内还有次限月亮对本命天王星的三分相真点/u);
  assert.match(auditText, /次限水星对本命天王星实际形成半六合时，次限月亮对本命天王星的三分相也在有效带内/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /次限月亮对同一本命天王星实际形成六合或三分/u);
  assert.match(prompt, /次限月亮对该天王星的六合或三分亦有效/u);
  assert.doesNotMatch(prompt, /uranianMetaphysicalMoonDirection|uranianMetaphysicalMercuryLunarDirection|日天平行带内还有次限月亮/u);

  const band = (progressedBody, aspectType, start, exactTimes = [], targetKind = 'natal') => ({ start, end: 5_000,
    progressedBody, natalTargetId: 'Uranus', aspectType, targetKind, exactTimes, coordinate: 'ecliptic_longitude' });
  const base = { ...band('Sun', 'parallel', 0), coordinate: 'equatorial_declination_of_date' };
  const mercury = band('Mercury', 'semisextile', 0, [2_000]);
  const lunarLate = band('Moon', 'trine', 2_001, [3_000, 5_000]);
  const wrongLayer = band('Moon', 'trine', 0, [2_000], 'progressed');
  const windows = buildLeoLunarConditions([base, mercury, lunarLate, wrongLayer]).filter(row => row.base === base);
  assert.ok(windows.some(row => row.start === 2_001 && row.hasExactUranianMetaphysicalMercuryDirection));
  assert.ok(windows.every(row => !row.hasUranianMetaphysicalMercuryLunarWitness));
  assert.deepEqual(windows.filter(row => row.hasExactUranianMetaphysicalMoonDirection).map(({ start, end }) => [start, end]),
    [[3_000, 4_000]]);
});

test('p286 requires the Uranus Moon band to have already begun at the solar half-sextile true point', () => {
  const isRule = row => row.knowledgeId.includes('-p286-');
  const birth = Date.parse('1993-11-13T00:00:00Z');
  const params = { periodType: 'year', targetPeriod: { year: 2022 }, displayTimezone: 'UTC' };
  const now = Date.UTC(2022, 6, 1);
  const reference = { snapshotId: 'leo-p286-solar-minor-lunar-band', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
  const witness = family.find(({ normalizedPayload: p }) => p.targetKind === 'natal' && p.hasUranianMetaphysicalSolarLunarWitness);
  assert.ok(witness);
  assert.equal(witness.activeFrom, '2022-01-12T08:41:52.683Z');
  const p = witness.normalizedPayload, at = Date.parse(witness.activeFrom), epoch = progressionEpoch(birth, at);
  assert.equal(Date.parse(witness.activeTo) - at, 1_000);
  assert.deepEqual(p.uranianMetaphysicalSolarDirection, { body: 'Sun', target: 'Uranus', targetKind: 'natal',
    aspectType: 'semisextile', passage: 'p278' });
  assert.deepEqual(p.uranianMetaphysicalSolarLunarDirection, { body: 'Moon', target: 'Uranus', targetKind: 'natal',
    aspectType: 'sextile', passage: 'p208' });
  const fixed = readLeoMovingPosition('Uranus', birth);
  const sun = readLeoMovingPosition('Sun', epoch), moon = readLeoMovingPosition('Moon', epoch);
  const separation = body => Math.abs((body.longitude - fixed.longitude + 540) % 360 - 180);
  assert.ok(leoParallelDifference(sun.declination, fixed.declination) < 1);
  assert.ok(Math.abs(separation(sun) - 30) < 0.00001);
  assert.ok(Math.abs(separation(moon) - 60) > 0.1 && Math.abs(separation(moon) - 60) < 1);
  const isolated = { ...run, facts: [witness] };
  const result = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.sourceFactIds, [witness.factId]);
  assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const assess = change => evaluateFortuneRules('western', 'year', [{ ...witness, normalizedPayload: { ...p, ...change } }])
    .find(isRule).confirmations[5];
  assert.equal(assess({ targetKind: 'progressed' }).hits.length, 0);
  assert.equal(assess({ hasUranianMetaphysicalSolarLunarWitness: false }).hits.length, 0);
  assert.equal(assess({ hasUranianMetaphysicalSolarLunarWitness: undefined }).unknown, true);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
  assert.match(formatFortuneFactAudit(input), /日天平行带内还有次限太阳对本命天王星的半六合相真点/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /实际对本命天王星形成半六合时，次限月亮对同一本命天王星的六合或三分也有效/u);
  assert.doesNotMatch(prompt, /uranianMetaphysicalSolarLunarDirection|hasUranianMetaphysicalSolarLunarWitness|2022-01-12T08:41:52/u);

  const base = { start: 0, end: 5_000, progressedBody: 'Sun', natalTargetId: 'Uranus', targetKind: 'natal',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', exactTimes: [] };
  const solar = { ...base, aspectType: 'semisextile', coordinate: 'ecliptic_longitude', exactTimes: [2_000] };
  const lunar = { ...solar, progressedBody: 'Moon', aspectType: 'sextile', exactTimes: [] };
  const otherLayer = { ...lunar, targetKind: 'progressed' };
  const late = { ...lunar, start: 2_001 };
  const onTime = { ...lunar, start: 2_000 };
  const boot = (...bands) => buildLeoLunarConditions([base, solar, ...bands]).filter(row => row.base === base);
  assert.ok(boot(otherLayer, late).every(row => !row.hasUranianMetaphysicalSolarLunarWitness));
  assert.deepEqual(boot(onTime).filter(row => row.hasUranianMetaphysicalSolarLunarWitness).map(row => [row.start, row.end]),
    [[2_000, 3_000]]);
});

test('rules about other Moon aspects reject repeated and reciprocal copies, gaps and other chart layers', () => {
  for (const id of ['p204', 'p244', 'p254']) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + id + '-'));
    const { where } = rule.queries[0];
    const base = { ...where, start: 0, end: 10, targetKind: 'progressed', exactTimes: [] };
    const other = (start, end, targetKind = 'progressed') => ({
      start, end, targetKind, progressedBody: 'Moon', natalTargetId: 'Mercury', aspectType: 'sextile', exactTimes: [],
    });
    const duplicate = id === 'p204' ? { ...base }
      : { ...base, progressedBody: 'Moon', natalTargetId: 'Sun' };
    const solar = id === 'p204' ? [{ start: 4, end: 7, targetKind: 'progressed', progressedBody: 'Sun',
      natalTargetId: 'Jupiter', aspectType: 'trine', exactTimes: [] }] : [];
    const rows = buildLeoLunarConditions([base, ...(id === 'p244' ? [] : [duplicate]), other(0, 10, 'natal'),
      other(4, 7), other(10, 12), ...solar]).filter(row => row.base === base);
    assert.deepEqual(rows.map(row => [row.start, row.end, row.hasOtherSameLayerLunarContacts]),
      [[0, 4, false], [4, 7, true], [7, 10, false]], id);
    const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, hasOtherSameLayerLunarContacts: row.hasOtherSameLayerLunarContacts,
        hasProgressedSolarTestimony: row.hasProgressedSolarContact, moonPositionReady: true } }));
    const evaluate = input => evaluateFortuneRules('western', rule.period, input).find(row => row.knowledgeId === rule.knowledgeId).required[0];
    assert.deepEqual(evaluate(facts).hits, id === 'p244' ? facts : [], id);
    if (id === 'p254') {
      const phase = { ...facts[1], factType: 'leo_solar_phase', normalizedPayload: { ...base, observed: true } };
      assert.deepEqual(evaluate([phase]).hits, [phase]);
      assert.equal(evaluate([{ ...phase, normalizedPayload: { ...phase.normalizedPayload, observed: false } }]).hits.length, 0);
    }
  }
});

test('Venus–Neptune contrary directions distinguish the two source scopes, layer and actual time', () => {
  const band = (start, end, progressedBody, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind, exactTimes: [] });
  const witnesses = [
    band(1, 3, 'Sun', 'Saturn', 'semisquare'),
    band(2, 4, 'Moon', 'Mars', 'opposition'),
    band(4, 5, 'Moon', 'Neptune', 'square'),
    band(5, 6, 'Venus', 'Saturn', 'square'),
    band(6, 8, 'Mercury', 'Saturn', 'square'),
    band(9, 11, 'Sun', 'Saturn', 'square', 'progressed'),
    band(12, 13, 'Mars', 'Saturn', 'square'),
  ];
  for (const [aspect, expected] of [
    ['sextile', ['Sun', 'Sun,Moon', 'Moon', '', 'Venus', 'Mercury', '', '']],
    ['trine', ['', '', '', '', '', 'Mercury', '', '']],
  ]) {
    const base = band(0, 12, 'Venus', 'Neptune', aspect);
    const rows = buildLeoLunarConditions([base, ...witnesses]).filter(row => row.base === base);
    const sampleTimes = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 9.5, 11.5];
    assert.deepEqual(sampleTimes.map(at => rows.find(row => row.start <= at && at < row.end).contraryDirections
      .map(row => row.body).join(',')), expected);
    assert.ok(rows.every(row => row.hasReviewedContraryDirection === (row.contraryDirections.length > 0)));
  }
});

test('Venus–Neptune retains its basis across clear, adverse and unreviewed same-layer slices', () => {
  const band = (start, end, progressedBody, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind, exactTimes: [] });
  for (const [id, aspect] of [['p316', 'sextile'], ['p318', 'trine']]) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + id + '-'));
    const base = band(0, 10, 'Venus', 'Neptune', aspect);
    const unclassified = band(2, 6, 'Mercury', 'Jupiter', 'square');
    const adverse = band(4, 5, 'Mercury', 'Saturn', 'square');
    const otherLayer = { ...unclassified, start: 6, end: 8, targetKind: 'progressed' };
    const inputBands = [base, unclassified, adverse, otherLayer];
    const rows = buildLeoLunarConditions(inputBands, [], [], [], [], { [aspect]: [] }).filter(row => row.base === base);
    const flags = rows.map(({ start, end, contraryReviewState, contraryDecisionReady, hasReviewedContraryDirection }) =>
      [start, end, contraryReviewState, contraryDecisionReady, hasReviewedContraryDirection]);
    assert.deepEqual(flags, [[0, 2, 'clear', true, false], [2, 4, 'unreviewed', undefined, false], [4, 5, 'adverse', true, true],
      [5, 6, 'unreviewed', undefined, false], [6, 10, 'clear', true, false]], id);
    const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, ...row } }));
    const tested = evaluateFortuneRules('western', 'year', facts).find(candidate => candidate.knowledgeId === rule.knowledgeId);
    assert.deepEqual(tested.required[0].hits, facts, id);
    assert.deepEqual(tested.exclusions, [], id);
    const onlyNear = { ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload, mutualExactInSlice: false } };
    const nearResult = evaluateFortuneRules('western', 'year', [onlyNear]).find(candidate => candidate.knowledgeId === rule.knowledgeId).required[0];
    assert.deepEqual([nearResult.hits, nearResult.unknown], [[], false], id);
    const legacy = buildLeoLunarConditions(inputBands).find(row => row.base === base);
    assert.equal(legacy.progressedOtherPlanetPairScope, undefined, id);
    assert.equal(legacy.progressedOtherPlanetContraryReviewState, undefined, id);
    const unknown = evaluateFortuneRules('western', 'year', [{ ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload,
      ...legacy } }]).find(candidate => candidate.knowledgeId === rule.knowledgeId).required[0];
    assert.deepEqual([unknown.hits, unknown.unknown], [[], true], id);
    const unscanned = { ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload, natalOtherPlanetPairScope: undefined } };
    const estimate = evaluateFortuneRules('western', 'year', [unscanned]).find(candidate => candidate.knowledgeId === rule.knowledgeId).required[0];
    assert.deepEqual([estimate.hits, estimate.unknown], [[], true], id);
    assert.deepEqual([rows[0].contraryReviewState, rows[0].progressedOtherPlanetContraryReviewState], ['clear', 'clear'], id);
    assert.deepEqual(rows[1].unreviewedContraryDirections.map(row => [row.body, row.target]), [['Mercury', 'Jupiter']], id);
    const sharedTarget = band(0, 2, 'Mercury', 'Neptune', 'square');
    const paired = buildLeoLunarConditions([base, sharedTarget]).filter(row => row.base === base);
    assert.deepEqual(paired.map(row => [row.start, row.end, row.contraryReviewState]),
      id === 'p316' ? [[0, 2, 'unreviewed'], [2, 10, 'clear']] : [[0, 10, 'clear']], id);

    const progressedUnreviewed = band(8, 9, 'Mars', 'Saturn', 'parallel', 'progressed');
    const progressedLuminary = band(5, 10, 'Sun', 'Jupiter', 'square', 'progressed');
    const progressedShared = band(5, 10, 'Mercury', 'Neptune', 'square', 'progressed');
    const both = buildLeoLunarConditions([base, unclassified, adverse], [],
      [], [otherLayer, progressedUnreviewed, progressedLuminary, progressedShared]).filter(row => row.base === base);
    for (const [at, expected, counter, unknown] of [[5, 'clear', [], []],
      [6, 'adverse', ['square'], []], [8, 'unreviewed', [], ['parallel']], [9, 'clear', [], []]]) {
      const row = both.find(slice => slice.start <= at && at < slice.end);
      assert.equal(row.progressedOtherPlanetContraryReviewState, expected, id);
      assert.deepEqual(row.progressedOtherPlanetContraryDirections.map(contact => contact.aspectType), counter, id);
      assert.deepEqual(row.progressedOtherPlanetUnreviewedDirections.map(contact => contact.aspectType), unknown, id);
    }
    const slow = band(3, 5, 'Jupiter', 'Uranus', 'sesquiquadrate', 'progressed');
    const samePair = band(0, 10, 'Venus', 'Neptune', 'parallel', 'progressed');
    const coverage = buildLeoLunarConditions([base], [], [], [progressedShared, samePair], [slow]).filter(row => row.base === base);
    assert.deepEqual(coverage.map(row => [row.start, row.end, row.progressedOtherPlanetContraryReviewState]), id === 'p316'
      ? [[0, 3, 'unreviewed'], [3, 5, 'adverse'], [5, 10, 'adverse']]
      : [[0, 3, 'clear'], [3, 5, 'adverse'], [5, 10, 'clear']], id);
    assert.ok(coverage.every(row => row.progressedOtherPlanetPairScope === (id === 'p316' ? 'all-other-pairs' : 'non-luminary-unrelated-pairs')));
    assert.ok(coverage.every(row => !row.progressedOtherPlanetContraryDirections.some(({ body, target }) => body === 'Venus' && target === 'Neptune')));
    assert.equal(coverage[0].progressedOtherPlanetUnreviewedDirections.some(({ body, target, aspectType }) =>
      body === 'Venus' && target === 'Neptune' && aspectType === 'parallel'), id === 'p316');
    if (id === 'p316') {
      const unclassifiedNatal = band(3, 5, 'Jupiter', 'Sun', 'parallel');
      const comparison = buildLeoLunarConditions([base], [], [], [], [], { sextile: [unclassifiedNatal] });
      assert.deepEqual(comparison.map(row => [row.start, row.end, row.contraryReviewState, row.progressedOtherPlanetContraryReviewState]),
        [[0, 3, 'clear', 'clear'], [3, 5, 'unreviewed', 'clear'], [5, 10, 'clear', 'clear']]);
      assert.ok(comparison.every(row => row.natalOtherPlanetPairScope === 'all-other-directed-pairs'));
      assert.deepEqual(comparison[1].unreviewedContraryDirections.map(({ body, target, targetKind, aspectType }) =>
        [body, target, targetKind, aspectType]), [['Jupiter', 'Sun', 'natal', 'parallel']]);
    }
  }
});

for (const [passage, birth, qualifies] of [
  ['p292', '1980-03-04', row => row.lunarFavourableTargets?.includes('Venus')],
  ['p302', '1965-05-03', row => row.sameLayerLunarState === 'all_favourable' && row.directionSupportState === 'favourable'],
  ['p330', '1934-05-16', row => row.sameLayerLunarState === 'all_adverse' || row.directionSupportState === 'adverse'],
]) {
  test(`annual ${passage} uses real same-layer support and excludes other segments`, () => {
    const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(2026, 5, 15);
    const reference = { snapshotId: 'leo-supported-' + passage, chart: chart(Date.parse(birth + 'T00:00:00Z')) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
    const use = row => row.knowledgeId.includes('-' + passage + '-');
    const rule = fortuneKnowledge.western.rules.find(use);
    const { progressedBody, natalTargetId, aspectType } = rule.queries[0].where;
    const related = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === progressedBody && p.natalTargetId === natalTargetId && p.aspectType === aspectType
      && (passage === 'p292' || p.targetKind === 'natal'));
    const compatible = related.filter(row => qualifies(row.normalizedPayload));
    const result = matchFortuneKnowledge(run).byMethod.western.find(use);
    assert.equal(result.status, 'matched');
    assert.ok(compatible.length && compatible.length < related.length);
    assert.deepEqual(new Set(result.sourceFactIds), new Set(compatible.map(row => row.factId)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.ok(formatFortunePrompt(input).includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
  });
}

test('real Venus–Neptune windows retain their basis and keep contrary evidence at its own strength', () => {
  for (const [passage, birth, year, scope, states, angle, exactStates] of [
    ['p316', '1960-08-30T12:00:00Z', 2042, 'reviewed-directions', [['2042-09-01', 'adverse']]],
    ['p316', '1960-06-09T12:00:00Z', 2026, 'reviewed-directions', [['2026-02-15', 'unreviewed'], ['2026-04-15', 'unreviewed']], 60],
    ['p318', '1967-03-25T12:00:00Z', 2035, 'other-planet-pairs', [['2035-01-01', 'clear'], ['2035-08-01', 'adverse']]],
    ['p318', '1960-01-16T12:00:00Z', 2026, 'other-planet-pairs', [['2026-04-15', 'unreviewed']], 120, ['unreviewed', 'adverse']],
    ['p318', '1939-09-24T12:00:00Z', 2026, 'other-planet-pairs', [], 120, ['unreviewed', 'clear']],
    ['p318', '1910-12-03T12:00:00Z', 1989, 'other-planet-pairs', [], 120, ['clear', 'clear']],
  ]) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const birthAt = Date.parse(birth), asOf = Date.UTC(year, 5, 1);
    const reference = { snapshotId: `leo-neptune-contrary-${birth}-${year}`, chart: chart(birthAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-contrary', reference);
    const match = sample => matchFortuneKnowledge(sample).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const result = match(run);
    const family = row => row.factType === 'leo_lunar_condition' && row.normalizedPayload.contraryScope === scope;
    const slices = run.facts.filter(family);
    const matched = slices.filter(row => row.normalizedPayload.mutualExactInSlice);
    assert.equal(result.status, angle === undefined ? 'not_matched' : 'matched', birth);
    assert.deepEqual(new Set(result.sourceFactIds), new Set(matched.map(row => row.factId)));
    for (const [date, state] of states) {
      const at = `${date}T00:00:00.000Z`;
      const witness = slices.find(row => row.activeFrom <= at && at < row.activeTo);
      const observedState = witness?.normalizedPayload.contraryReviewState;
      if (passage === 'p318' && state === 'clear') assert.ok(['clear', 'unreviewed'].includes(observedState), birth);
      else assert.equal(observedState, state, birth);
      assert.equal(witness.normalizedPayload.hasReviewedContraryDirection, state === 'adverse', birth);
      assert.equal(witness.normalizedPayload.contraryDecisionReady, observedState === 'unreviewed' ? undefined : true, birth);
      assert.equal(match({ ...run, facts: [witness] }).status, 'not_matched', birth);
    }
    if (passage === 'p318' && birth === '1960-01-16T12:00:00Z') {
      const beforeContact = '2026-01-15T00:00:00.000Z';
      assert.ok(slices.every(row => beforeContact < row.activeFrom));
      const at = '2026-05-20T16:42:58.821Z';
      const witness = slices.find(row => row.activeFrom <= at && at < row.activeTo);
      const data = witness?.normalizedPayload;
      assert.equal(data?.progressedOtherPlanetPairScope, 'non-luminary-unrelated-pairs');
      assert.equal(data.progressedOtherPlanetContraryReviewState, 'adverse');
      assert.ok(data.progressedOtherPlanetContraryDirections.some(row => row.body === 'Jupiter' && row.target === 'Uranus'
        && row.aspectType === 'sesquiquadrate' && row.targetKind === 'progressed'));
      const epoch = Math.round(progressionEpoch(birthAt, Date.parse(at)));
      const separation = Math.abs((readLeoMovingPosition('Jupiter', epoch).longitude
        - readLeoMovingPosition('Uranus', epoch).longitude + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 135) < 1e-6);
      assert.ok(!result.sourceFactIds.includes(witness.factId));
      assert.ok(data.progressedOtherPlanetContraryDirections.every(row =>
        ![row.body, row.target].some(body => ['Sun', 'Moon', 'Venus', 'Neptune'].includes(body))));
    }
    const point = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_mutual_exact_observation'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal'
      && p.aspectType === (passage === 'p316' ? 'sextile' : 'trine'));
    assert.equal(Boolean(point), angle !== undefined, birth);
    if (point) {
      const venus = readLeoMovingPosition('Venus', Math.round(progressionEpoch(birthAt, Date.parse(point.exactInstant)))).longitude;
      const neptune = readLeoMovingPosition('Neptune', birthAt).longitude;
      assert.ok(Math.abs(Math.abs((venus - neptune + 540) % 360 - 180) - angle) < 0.00001);
      const exact = slices.find(row => row.normalizedPayload.mutualExactInSlice);
      assert.equal(exact.activeFrom, point.exactInstant, birth);
      const instant = Date.parse(exact.activeFrom);
      assert.equal(Date.parse(exact.activeTo), instant + 1_000, birth);
      const p = exact.normalizedPayload;
      if (exactStates) assert.deepEqual([p.contraryReviewState, p.progressedOtherPlanetContraryReviewState], exactStates, birth);
      for (const at of [instant - 1, instant + 1_000]) {
        const nearby = slices.find(row => Date.parse(row.activeFrom) <= at && at < Date.parse(row.activeTo));
        assert.ok(nearby && !result.sourceFactIds.includes(nearby.factId), birth);
      }
      const override = changes => match({ ...run, facts: [{ ...exact, normalizedPayload: { ...p, ...changes } }] });
      assert.equal(override({ natalOtherPlanetPairScope: undefined }).status, 'unknown', birth);
      assert.equal(override({ mutualExactInSlice: undefined }).status, 'unknown', birth);
      assert.equal(override({ targetKind: 'progressed' }).status, 'not_matched', birth);
      if (birth.startsWith('1939-09-24')) {
        const extra = p.unreviewedContraryDirections;
        assert.ok(extra.some(row => row.body === 'Uranus' && row.target === 'Jupiter' && row.aspectType === 'semisquare'));
        assert.ok(extra.some(row => row.body === 'Jupiter' && row.target === 'Mercury' && row.aspectType === 'parallel'));
      }
    }

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-contrary-report'));
    const prompt = formatFortuneFactAudit(input);
    if (year === 2042) {
      const known = slices.find(row => row.activeFrom <= '2042-09-01T00:00:00.000Z' && '2042-09-01T00:00:00.000Z' < row.activeTo);
      assert.ok(known);
      assert.ok(known.normalizedPayload.contraryDirections.some(row =>
        row.body === 'Mercury' && row.target === 'Jupiter' && row.aspectType === 'semisquare'));
      assert.ok(known.normalizedPayload.unreviewedContraryDirections.some(row =>
        row.body === 'Mercury' && row.target === 'Neptune' && row.aspectType === 'parallel'));
      assert.match(prompt, /次限水星对本命木星的半刑相/u);
      assert.match(prompt, /同段仍有性质未核的接触为/u);
    } else if (year === 2035) {
      assert.ok(run.facts.some(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
        && p.progressedBody === 'Mercury' && p.natalTargetId === 'Mars' && p.aspectType === 'trine' && p.targetKind === 'natal'));
      assert.match(prompt, /与本条同时生效的已核反向推运为次限水星对本命土星的四分相/u);
    }
    assert.doesNotMatch(prompt, /hasReviewedContraryDirection|contraryReviewState|contraryScope|other-planet-pairs/u);
    assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === result.knowledgeId)), result.status === 'matched');
    if (result.status === 'matched') {
      const provider = formatFortunePrompt(input);
      const clear = matched.every(({ normalizedPayload: p }) => p.contraryReviewState === 'clear'
        && p.progressedOtherPlanetContraryReviewState === 'clear');
      assert.equal(provider.includes('两层在所核同期范围内均未见反向或待审，可有条件参考较强的满足感描述'), clear, birth);
      assert.equal(provider.includes('本次采用原文的基础倾向。较强的满足感描述须在相关反向条件已排清时才适用'), !clear, birth);
      const scopeText = passage === 'p316' ? /同段另核九曜间从次限到本命的有向组合/u : /次限对本命另查除日月金海外的有向星对/u;
      assert.match(prompt, scopeText);
      assert.doesNotMatch(provider, scopeText);
      assert.doesNotMatch(provider, /natalOtherPlanetPairScope|unreviewedContraryDirections/u);
      if (passage === 'p316') assert.match(provider, /次限金星与本命海王星实际形成六合相/u);
    }
  }
});

test('real Venus–Neptune years keep concurrent progressed counterpairs apart from natal directions', () => {
  const year = 2026, asOf = Date.UTC(year, 6, 1), instant = new Date(asOf).toISOString();
  const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
  for (const [passage, birth, aspect, body, target] of [
    ['p316', '1973-07-01', 'sextile', 'Mars', 'Jupiter'], ['p318', '1971-03-01', 'trine', 'Mercury', 'Mars'],
  ]) {
    const chartForBirth = chart(Date.parse(`${birth}T12:00:00Z`));
    const reference = { snapshotId: `leo-progressed-counterpair-${birth}`, chart: chartForBirth };
    const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, submission, readClientFactTime(parameters, submission, asOf),
      reference.snapshotId, reference);
    const candidate = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: row }) =>
      factType === 'leo_lunar_condition' && row.progressedBody === 'Venus' && row.natalTargetId === 'Neptune'
      && row.aspectType === aspect && row.targetKind === 'natal' && activeFrom <= instant && instant < activeTo);
    assert.ok(candidate, passage);
    const counter = { body, target, aspectType: 'square', targetKind: 'progressed' };
    const data = candidate.normalizedPayload;
    assert.equal(data.progressedOtherPlanetContraryReviewState, 'adverse', passage);
    assert.ok(data.progressedOtherPlanetContraryDirections.some(row => Object.entries(counter)
      .every(([key, value]) => row[key] === value)), passage);
    if (passage === 'p316') {
      assert.equal(data.progressedOtherPlanetPairScope, 'all-other-pairs');
      assert.ok(data.progressedOtherPlanetContraryDirections.some(row => row.body === 'Uranus' && row.target === 'Neptune'
        && row.aspectType === 'semisquare' && row.targetKind === 'progressed'));
      const epoch = Math.round(progressionEpoch(Date.parse(`${birth}T12:00:00Z`), asOf));
      const separation = Math.abs((readLeoMovingPosition('Uranus', epoch).longitude
        - readLeoMovingPosition('Neptune', epoch).longitude + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 45) < 1 && Math.abs(separation - 45) > 0.01);
      assert.ok(data.progressedOtherPlanetContraryDirections.every(row => ![row.body, row.target].every(body =>
        ['Venus', 'Neptune'].includes(body))));
    }
    assert.ok(data.contraryDirections.every(row => row.targetKind === 'natal'), passage);
    const matchingBand = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: row }) =>
      factType === 'leo_progressed_aspect' && row.progressedBody === body && row.natalTargetId === target
      && row.aspectType === 'square' && row.targetKind === 'progressed' && activeFrom <= instant && instant < activeTo);
    assert.ok(matchingBand, passage);
    const pair = matchingBand.normalizedPayload;
    const measured = Math.abs((pair.progressedLongitude - pair.targetLongitude + 540) % 360 - 180);
    assert.ok(Math.abs(measured - 90) <= pair.allowedOrb && pair.allowedOrb === 1, passage);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes(`-${passage}-`));
    const exact = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune' && p.aspectType === aspect
      && p.targetKind === 'natal' && p.mutualExactInSlice);
    assert.equal(result.status, exact.length ? 'matched' : 'not_matched', passage);
    assert.deepEqual(result.sourceFactIds, exact.map(row => row.factId), passage);
    assert.ok(!result.sourceFactIds.includes(candidate.factId), passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const localText = /同图次限的其他行星对在本段另有偏难相位/u;
    const scopeText = passage === 'p316' ? /含木土天海的慢行星对/u : /含木土、木天及土天/u;
    const audit = formatFortuneFactAudit(input);
    assert.match(audit, localText, passage);
    assert.match(audit, scopeText, passage);
    if (passage === 'p316') assert.match(audit, /次限天王星对同图次限海王星的半刑相/u);
    assert.doesNotMatch(formatFortunePrompt(input), localText, passage);
    assert.doesNotMatch(formatFortunePrompt(input), scopeText, passage);
  }
});

test('the new favourable branches require an independent supporting direction or actual favourable Moon contacts', () => {
  for (const id of ['p116', 'p220', 'p260']) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + id + '-'));
    const base = { ...rule.queries[0].where, start: 0, end: 10, targetKind: 'natal', exactTimes: id === 'p220' ? [7] : [] };
    const candidates = [
      { ...base },
      { start: 2, end: 4, targetKind: 'natal', progressedBody: 'Moon', natalTargetId: 'Mercury', aspectType: 'trine', exactTimes: [] },
      { start: 4, end: 6, targetKind: 'progressed', progressedBody: 'Moon', natalTargetId: 'Mercury', aspectType: 'trine', exactTimes: [] },
      { start: 6, end: 8, targetKind: 'natal', progressedBody: 'Sun', natalTargetId: 'Jupiter', aspectType: 'trine', exactTimes: [] },
    ];
    const rows = buildLeoLunarConditions([base, ...candidates]).filter(row => row.base === base);
    assert.deepEqual(rows.map(row => [row.start, row.end, row.sameLayerLunarState, row.directionSupportState]),
      [[0, 2, 'none', 'none'], [2, 4, 'all_favourable', 'none'], [4, 6, 'none', 'none'],
        [6, 8, 'none', 'favourable'], [8, 10, 'none', 'none']], id);
    const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, sameLayerLunarState: row.sameLayerLunarState, directionSupportState: row.directionSupportState,
        monthlyLunarHasExact: row.monthlyThemeEvidence?.hasExact, monthlyLunarMajorState: row.monthlyThemeEvidence?.majorState,
        monthlyLunarQualification: row.monthlyLunarQualification } }));
    const selected = evaluateFortuneRules('western', rule.period, facts).find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
    if (id === 'p116') {
      assert.deepEqual(selected, [], id);
      const band = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete', normalizedPayload: base };
      const evaluated = evaluateFortuneRules('western', rule.period, [band]).find(row => row.knowledgeId === rule.knowledgeId);
      assert.deepEqual(evaluated.required[0].hits, [band], id);
    } else if (id === 'p220') assert.deepEqual(selected, [facts[3]], id);
    else {
      assert.deepEqual(selected, [], id);
      const phase = { factType: 'leo_solar_phase', scope: 'progressed', completeness: 'complete', normalizedPayload: base };
      assert.deepEqual(evaluateFortuneRules('western', rule.period, [phase]).find(row => row.knowledgeId === rule.knowledgeId)
        .required[0].hits, [phase], id);
    }
  }
});

test('concurrent-direction queries distinguish presence, polarity, mixed evidence and other chart layers', () => {
  const cases = [
    ['061', [6, 12, 14, 16]], ['083', [6, 12, 14, 16]], ['089', [2, 4, 6, 16]], ['090', [4, 6, 16]],
    ['094', [2, 4, 6, 8, 10, 12, 14, 16]], ['148', [10, 12]], ['151', [12, 14]],
    ['154', [4, 10]], ['161', [12]], ['164', [12, 14]], ['174', [8, 10, 12, 14]],
    ['191', [12, 14]], ['207', [12, 14]], ['214', [12]], ['223', [12]], ['231', [6, 16]], ['248', [4, 16]],
  ];
  for (const [id, expectedStarts] of cases) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    const { where, anyOf } = rule.queries[0];
    const independentObservation = ['148', '151', '191', '207'].includes(id);
    const predicates = new Set([...(anyOf ?? []).flatMap(Object.keys), 'directionSupportState',
      'hasOtherSameLayerLunarContacts', 'hasOtherSameLayerDirection', 'hasSameLayerFavourableContact', 'hasSameLayerAdverseContact',
      'observed', 'monthlyLunarHasExact', 'monthlyLunarQualification']);
    const geometry = Object.fromEntries(Object.entries(where).filter(([key]) => !predicates.has(key)));
    for (const targetKind of where.targetKind.oneOf ?? [where.targetKind]) {
      const opposite = targetKind === 'natal' ? 'progressed' : 'natal';
      const exactTimes = independentObservation ? [1] : ['161', '223'].includes(id) ? [13] : [];
      const base = { ...geometry, start: 0, end: 20, targetKind, exactTimes };
      const make = (progressedBody, natalTargetId, aspectType, start, end, kind = targetKind) =>
        ({ progressedBody, natalTargetId, aspectType, start, end, targetKind: kind, exactTimes: [] });
      const contacts = [
        { ...base },
        make('Moon', 'Mercury', 'sextile', 0, 20, opposite), make('Sun', 'Saturn', 'square', 0, 20, opposite),
        make('Moon', 'Neptune', 'trine', 2, 4), make('Moon', 'Mercury', 'sextile', 4, 6),
        make('Moon', 'Saturn', 'square', 6, 8), make('Sun', 'Mercury', 'conjunction', 8, 10),
        make('Sun', 'Jupiter', 'trine', 10, 12), make('Sun', 'Saturn', 'square', 12, 16),
        make('Sun', 'Jupiter', 'trine', 14, 16),
        make('Moon', 'Mercury', 'sextile', 16, 18), make('Moon', 'Saturn', 'square', 16, 18),
        make('Sun', 'Saturn', 'square', 20, 22),
      ];
      if (targetKind === 'progressed') contacts.push(make(base.natalTargetId, base.progressedBody, base.aspectType, 0, 20));
      const rows = buildLeoLunarConditions([base, ...contacts]).filter(row => row.base === base);
      const facts = rows.map(({ base: _base, ...row }) => ({
        factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
        normalizedPayload: { ...base, ...row, hasSameLayerFavourableContact: row.lunarFavourableTargets.length > 0,
          hasSameLayerAdverseContact: row.lunarAdverseTargets.length > 0,
          monthlyLunarHasExact: row.monthlyThemeEvidence?.hasExact,
          hasNatalMoonJupiterPromise: id === '154' ? true : undefined },
      }));
      const evaluate = evidence => evaluateFortuneRules('western', rule.period, evidence)
        .find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
      if (['154', '164', '174'].includes(id)) {
        const support = rows.filter(row => id === '154' ? row.hasCleanLunarJupiterSupport
          : id === '164' ? ['adverse', 'mixed'].includes(row.directionSupportState) : row.hasOtherSameLayerDirection);
        assert.deepEqual(support.map(row => row.start), expectedStarts, id + ' ' + targetKind);
        if (id === '174') assert.ok(support.every(row => row.otherDirection.targetKind === targetKind));
        assert.deepEqual(evaluate(facts), []);
        const parallel = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete', normalizedPayload: base };
        const wrongCoordinate = { ...parallel, normalizedPayload: { ...base, coordinate: 'ecliptic_longitude' } };
        const wrongLayer = { ...parallel, normalizedPayload: { ...base, targetKind: 'other-chart-layer' } };
        assert.deepEqual(evaluate([parallel, wrongCoordinate, wrongLayer]), [parallel]);
        continue;
      }
      if (id === '061' || id === '083') {
        const adverse = rows.filter(row => row.lunarAdverseTargets.length > 0 || ['adverse', 'mixed'].includes(row.directionSupportState));
        assert.deepEqual(adverse.map(row => row.start), expectedStarts, id + ' ' + targetKind);
        assert.deepEqual(evaluate(facts), []);
        continue;
      }
      if (id === '089' || id === '090') {
        const supporting = rows.filter(row => id === '089' ? row.hasOtherSameLayerLunarContacts
          : row.lunarFavourableTargets.length > 0 || row.lunarAdverseTargets.length > 0);
        assert.deepEqual(supporting.map(row => row.start), expectedStarts, id + ' ' + targetKind);
        assert.deepEqual(evaluate(facts), []);
        continue;
      }
      if (id === '094') {
        assert.deepEqual(rows.filter(row => row.hasOtherSameLayerLunarContacts || row.hasOtherSameLayerDirection)
          .map(row => row.start), expectedStarts, id);
        assert.deepEqual(evaluate(facts), []);
        continue;
      }
      if (id === '214') {
        const strengthened = rows.filter(row => row.monthlyLunarQualification === 'strengthened');
        assert.deepEqual(strengthened.map(row => row.start), expectedStarts, id + ' ' + targetKind);
        assert.ok(strengthened.every(row => row.directionSupportState === 'adverse'
          && row.supportingDirections.some(direction => direction.targetKind === targetKind && direction.nature === 'adverse')));
        assert.ok(rows.some(row => row.directionSupportState === 'mixed' && row.monthlyLunarQualification === 'base'));
        assert.deepEqual(evaluate(facts), facts);
        continue;
      }
      if (id === '231' || id === '248') {
        const supporting = rows.filter(row => (id === '231' ? row.lunarAdverseTargets : row.lunarFavourableTargets).length > 0);
        assert.deepEqual(supporting.map(row => row.start), expectedStarts, id + ' ' + targetKind);
        assert.deepEqual(evaluate(facts), []);
        const phase = { factType: 'leo_solar_lunar_phase', scope: 'progressed', completeness: 'complete',
          normalizedPayload: { ...geometry, targetKind, observed: true } };
        const wrongLayer = { ...phase, normalizedPayload: { ...phase.normalizedPayload, targetKind: 'other-chart-layer' } };
        assert.deepEqual(evaluate([phase, wrongLayer]), [phase]);
        continue;
      }
      if (independentObservation) {
        const themed = rows.filter(row => id === '148'
          ? [row.directionSupportState, row.speculationMajorState, row.friendshipDirectionState]
            .some(state => ['favourable', 'adverse'].includes(state))
          : ['adverse', 'mixed'].includes(row.directionSupportState));
        const topicStarts = id === '148' && targetKind === 'natal' ? [...expectedStarts, 14] : expectedStarts;
        assert.deepEqual(themed.map(row => row.start), topicStarts, id + ' ' + targetKind);
        const [at] = base.exactTimes;
        assert.ok(themed.every(row => at < row.start || row.end <= at));
        const unobserved = { factType: 'leo_lunar_exact_observation', scope: 'progressed', completeness: 'complete',
          normalizedPayload: { ...geometry, targetKind, observed: false } };
        const observation = { ...unobserved, normalizedPayload: { ...unobserved.normalizedPayload, observed: true, start: at } };
        assert.deepEqual(evaluate([...facts, unobserved, observation]), [observation]);
        continue;
      }
      assert.deepEqual(evaluate(facts).map(fact => fact.normalizedPayload.start), expectedStarts, id + ' ' + targetKind);
    }
  }
});

test('real submitted facts provide an independent direction or Moon contact through SQLite and Chinese input', () => {
  const moment = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    { id: '174', born: '1965-01-03', month: 1, witness: p => p.targetKind === 'progressed'
        && p.otherDirection?.targetKind === 'progressed' && p.otherDirection.body !== 'Moon',
      phrase: /同段另有太阳或行星推运，实算为次限/u },
    { id: '223', born: '1965-02-08', month: 2, witness: p => p.targetKind === 'natal' && p.monthlyLunarHasExact
        && p.monthlyLunarQualification === 'strengthened'
        && !p.hasSameLayerAdverseContact && p.supportingDirections.some(row => row.nature === 'adverse' && row.targetKind === 'natal'),
      phrase: /同段另一条推运是次限.*原书此项偏难/u },
    { id: '248', born: '1965-01-04', witness: p => p.targetKind === 'progressed' && p.hasSameLayerFavourableContact
        && p.contacts.some(row => row.targetKind === 'progressed' && row.nature === 'favourable'),
      phrase: /次限月亮对同图次限.*原书月亮篇偏顺/u },
  ];
  for (const { id, born, month, witness, phrase } of cases) {
    const parameters = { periodType: month ? 'month' : 'year', targetPeriod: month ? { year: 2026, month } : { year: 2026 },
      displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-concurrent-' + id };
    const snapshot = chart(Date.parse(born + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, moment, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, moment), 'leo-concurrent-facts', reference);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    const independentParallel = id === '174';
    const solarPhase = id === '248';
    assert.equal(match.status, 'matched', id);
    const matchIds = new Set(match.sourceFactIds);
    const evidence = run.facts.find(({ factId, factType, normalizedPayload: p }) => {
      if (factType !== 'leo_lunar_condition' || !witness(p)) return false;
      if (independentParallel) return p.progressedBody === 'Moon' && p.natalTargetId === 'Mercury' && p.aspectType === 'parallel';
      if (solarPhase) return p.progressedBody === 'Sun' && p.natalTargetId === 'Moon' && p.aspectType === 'semisextile';
      return matchIds.has(factId);
    });
    assert.ok(evidence, id);
    if (solarPhase) {
      const phases = run.facts.filter(fact => matchIds.has(fact.factId));
      assert.ok(phases.length && phases.every(fact => fact.factType === 'leo_solar_lunar_phase'
        && fact.normalizedPayload.observed && fact.normalizedPayload.yearBoundary === 'progression-birthday'));
      assert.ok(phases.some(fact => fact.normalizedPayload.targetKind === evidence.normalizedPayload.targetKind
        && fact.activeFrom < evidence.activeTo && evidence.activeFrom < fact.activeTo));
      assert.ok(!matchIds.has(evidence.factId));
    } else assert.ok(match.windows.some(window => window.start <= evidence.activeFrom && evidence.activeTo <= window.endExclusive), id);
    const description = describeFortuneFact({ method: 'western', type: 'leo_lunar_condition', data: evidence.normalizedPayload }, String);
    assert.match(description, phrase, id);
    if (independentParallel) {
      assert.ok(!matchIds.has(evidence.factId));
      assert.ok(run.facts.some(fact => matchIds.has(fact.factId) && fact.factType === 'leo_progressed_aspect'
        && fact.parentSignalId === evidence.parentSignalId && fact.normalizedPayload.allowedOrb === 1));
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-concurrent-report'));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, /次限月亮对同图次限水星形成同向赤纬平行/u);
      assert.match(prompt, /比较赤纬绝对值，一度以内计入，不要求南北同向/u);
      assert.doesNotMatch(prompt, /otherDirection|hasOtherSameLayerDirection|leo-concurrent-174/u);
      const meaning = getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning;
      assert.ok(formatFortunePrompt(input).includes(meaning));
    }
  }
});

const conditionalPremiseCases = [
  ['070', [2, 4, 10, 16]], ['082', [2, 4, 10, 16]], ['152', [2, 4, 6, 8, 10]],
  ['199', [14]], ['221', [14]], ['249', [2, 4]], ['276', [2, 4, 10, 16]],
  ['278', [2, 4, 10]], ['286', [8]], ['332', [8, 10, 12, 14]],
];
for (const [id, expected] of conditionalPremiseCases) {
  test(`the new conditional premises keep lunar endpoints, solar witnesses and the moving Moon distinct (p${id})`, () => {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    const { where } = rule.queries[0];
    const geometry = Object.fromEntries(Object.entries(where).filter(([key]) =>
      !['hasFavourableLunarLink', 'hasOtherSameLayerLunarContacts', 'hasAdverseSolarDirection',
        'hasSameLayerFavourableContact', 'lunarLinkedBodies', 'observed', 'directionSupportState', 'monthlyLunarHasExact'].includes(key)));
    for (const targetKind of where.targetKind.oneOf ?? [where.targetKind]) {
      const otherLayer = targetKind === 'natal' ? 'progressed' : 'natal';
      const exactTimes = id === '152' ? [1] : id === '199' ? [13, 15] : id === '221' ? [15] : [];
      const base = { ...geometry, start: 0, end: 20, targetKind, exactTimes };
      const band = (progressedBody, natalTargetId, aspectType, start, end, kind = targetKind) =>
        ({ progressedBody, natalTargetId, aspectType, targetKind: kind, start, end, exactTimes: [] });
      const tracks = [
        { ...base },
        band('Moon', 'Uranus', 'square', 0, 20, otherLayer), band('Sun', 'Saturn', 'square', 0, 20, otherLayer),
        band('Moon', 'Mercury', 'sextile', 2, 4), band('Moon', 'Jupiter', 'trine', 4, 6),
        band('Moon', 'Neptune', 'trine', 6, 8), band('Moon', 'Uranus', 'square', 8, 10),
        band('Moon', 'Mars', 'conjunction', 10, 12), band('Moon', 'Venus', 'trine', 10, 12),
        band('Mars', 'Saturn', 'square', 12, 14), band('Sun', 'Saturn', 'square', 14, 16),
        band('Sun', 'Jupiter', 'trine', 16, 18), band('Sun', 'Saturn', 'square', 20, 22),
      ];
      if (id === '286') tracks.push(band('Moon', 'Uranus', 'sextile', 8, 9),
        band('Moon', 'Uranus', 'sextile', 0, 20, otherLayer));
      if (targetKind === 'progressed') tracks.push(band(base.natalTargetId, base.progressedBody, base.aspectType, 0, 20));
      const rows = buildLeoLunarConditions([base, ...tracks]).filter(row => row.base === base);
      const facts = rows.map(({ base: _base, ...row }) => ({
        factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
        normalizedPayload: { ...base, ...row, natalFavourableBodies: [],
          hasSameLayerFavourableContact: row.lunarFavourableTargets.length > 0,
          hasSameLayerAdverseContact: row.lunarAdverseTargets.length > 0, monthlyLunarHasExact: row.monthlyThemeEvidence?.hasExact },
      }));
      const evaluate = input => evaluateFortuneRules('western', rule.period, input)
        .find(row => row.knowledgeId === rule.knowledgeId).required[0];
      if (id === '152') {
        const withLunarContact = rows.filter(row => row.hasOtherSameLayerLunarContacts);
        assert.deepEqual(withLunarContact.map(row => row.start), expected, id + ' ' + targetKind);
        const [exactAt] = base.exactTimes;
        assert.ok(!withLunarContact.some(row => row.start <= exactAt && exactAt < row.end));
        const missing = { factType: 'leo_lunar_exact_observation', scope: 'progressed', completeness: 'complete',
          normalizedPayload: { ...geometry, targetKind, observed: false } };
        const observation = { ...missing, normalizedPayload: { ...missing.normalizedPayload, observed: true, start: exactAt } };
        const wrongLayer = { ...observation, normalizedPayload: { ...observation.normalizedPayload, targetKind: 'other-chart-layer' } };
        assert.deepEqual(evaluate([...facts, missing, observation, wrongLayer]).hits, [observation]);
        continue;
      }
      if (id === '070' || id === '082') {
        const supporting = rows.filter(row => row.lunarFavourableTargets.length > 0 || ['favourable', 'mixed'].includes(row.directionSupportState));
        assert.deepEqual(supporting.map(row => row.start), expected, id);
        assert.deepEqual(evaluate(facts).hits, []);
        continue;
      }
      if (id === '199') {
        const solarWitnesses = rows.filter(row => row.hasAdverseSolarDirection);
        assert.deepEqual(solarWitnesses.map(row => row.start), expected, targetKind);
        assert.ok(solarWitnesses.every(row => row.supportingDirections.some(direction =>
          direction.body === 'Sun' && direction.targetKind === targetKind && direction.nature === 'adverse')));
        assert.deepEqual(evaluate(facts).hits.map(({ normalizedPayload: p }) => [p.start, p.monthlyLunarQualification]),
          [[12, 'base'], [14, 'strengthened']], targetKind);
        continue;
      }
      if (id === '278') {
        const supporting = rows.filter(row => row.lunarFavourableTargets.length > 0);
        assert.deepEqual(supporting.map(row => row.start), expected, id + ' ' + targetKind);
        const phase = { factType: 'leo_solar_lunar_phase', scope: 'progressed', completeness: 'complete',
          normalizedPayload: { ...geometry, targetKind, observed: true } };
        const unobserved = { ...phase, normalizedPayload: { ...phase.normalizedPayload, observed: false } };
        assert.deepEqual(evaluate([...facts, phase, unobserved]).hits, [phase]);
        continue;
      }
      if (id === '332') {
        const supporting = rows.filter(row => row.lunarAdverseTargets.length > 0 || ['adverse', 'mixed'].includes(row.directionSupportState));
        assert.deepEqual(supporting.map(row => row.start), expected, id);
        assert.deepEqual(evaluate(facts).hits, [], id);
        assert.equal(evaluate([{ factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete',
          normalizedPayload: base }]).hits.length, 1, id);
        continue;
      }
      if (id === '276') {
        const supporting = rows.filter(row => row.lunarFavourableTargets.length > 0 || ['favourable', 'mixed'].includes(row.directionSupportState));
        assert.deepEqual(supporting.map(row => row.start), expected, id + ' ' + targetKind);
        assert.deepEqual(evaluate(facts).hits, [], id);
        const basis = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete', normalizedPayload: base };
        assert.deepEqual(evaluate([basis]).hits, [basis]);
        continue;
      }
      if (id === '249') {
        assert.deepEqual(rows.filter(row => row.sameLayerLunarState === 'all_favourable').map(row => row.start), expected, targetKind);
        assert.deepEqual(evaluate(facts).hits, []);
        const phase = { factType: 'leo_solar_phase', scope: 'progressed', completeness: 'complete',
          normalizedPayload: { ...geometry, targetKind, observed: true } };
        assert.deepEqual(evaluate([phase]).hits, [phase]);
        continue;
      }
      if (id === '286') {
        // The existing lunar branch required a favourable research contact.
        // Keep the right-layer square as geometry with a non-qualifying topic.
        const linked = rows.filter(row => row.lunarLinkedBodies.includes('Uranus'));
        const natalTopic = targetKind === 'natal';
        assert.deepEqual(linked.map(row => [row.start, row.end, row.metaphysicalDirectionState]),
          [[8, 9, natalTopic ? 'favourable' : 'none'], [9, 10, 'none']], targetKind);
        assert.ok(facts.every(({ normalizedPayload: p }) => !p.hasExactUranianMetaphysicalMercuryDirection
          && !p.hasExactUranianMetaphysicalSolarDirection));
        const withoutBackground = facts.map(row => ({ ...row, normalizedPayload: {
          ...row.normalizedPayload, sunUranusParallelBackgroundOnly: false,
        } }));
        assert.deepEqual(evaluate(withoutBackground).hits.map(({ normalizedPayload: p }) => p.start), natalTopic ? expected : []);
        const withBackground = evaluateFortuneRules('western', rule.period, facts).find(row => row.knowledgeId === rule.knowledgeId);
        assert.deepEqual(withBackground.required[0].hits, facts);
        const background = withBackground.confirmations.find(branch => branch.condition.includes('sunUranusParallelBackgroundOnly'));
        assert.deepEqual(background.hits.map(({ normalizedPayload: p }) => p.start),
          rows.filter(row => !natalTopic || !expected.includes(row.start)).map(row => row.start));
        continue;
      }
      const starts = evaluate(facts).hits.map(fact => fact.normalizedPayload.start);
      assert.deepEqual(starts, expected, id + ' ' + targetKind);
    }
  });
}

const specificBranchCases = [
    { id: '070', date: '1970-12-19', witness: p => p.natalFavourableBodies.length < 2 && p.hasSameLayerFavourableContact,
      wrong: { natalFavourableBodies: ['Mars'], natalAbilityTypes: [], hasSameLayerFavourableContact: false, directionSupportState: 'none' } },
    { id: '199', date: '1964-09-21', month: 6, witness: p => p.supportingDirections.some(row =>
      row.body === 'Sun' && row.target === 'Saturn' && row.targetKind === 'natal' && row.nature === 'adverse'),
      phrase: /次限太阳对本命土星的四分相，原书此项偏难/u },
    { id: '249', date: '1941-01-27', witness: p => p.targetKind === 'progressed' && p.sameLayerLunarState === 'all_favourable'
        && p.contacts.some(row => row.targetKind === 'progressed' && row.nature === 'favourable')
        && !p.contacts.some(row => row.targetKind === 'progressed' && row.target === 'Sun' && row.aspectType === 'semisquare'),
      wrong: { targetKind: 'natal' }, phrase: /次限太阳对同图次限月亮的半刑相有效段内/u },
    { id: '286', date: '1940-08-24', witness: p => p.targetKind === 'natal' && p.lunarLinkedBodies.includes('Uranus')
        && p.contacts.some(row => row.target === 'Uranus' && row.targetKind === 'natal'),
      wrong: { lunarLinkedBodies: ['Sun'] }, phrase: /次限月亮也照到太阳平行所指的本命天王星/u },
];
for (const { id, date, month, witness, wrong, phrase } of specificBranchCases) {
  test(`real submissions qualify the source-specific lunar, solar and natal branches in SQLite (p${id})`, () => {
    const now = Date.parse('2026-06-15T00:00:00Z');
    const parameters = { periodType: month ? 'month' : 'year', targetPeriod: month ? { year: 2026, month } : { year: 2026 },
      displayTimezone: 'Asia/Shanghai' };
    const ref = { snapshotId: 'leo-specific-' + id };
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...ref, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), 'leo-specific-branches', ref);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '070') {
      assertAnnualMutualObservation(run, match, 'Uranus', 'sextile', 'matched');
      const support = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition' && p.targetKind === 'natal'
        && p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.aspectType === 'sextile' && witness(p));
      assert.ok(support && !match.sourceFactIds.includes(support.factId));
      return;
    }
    if (id === '199') {
      assert.equal(match.status, 'matched');
      const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
        && p.progressedBody === 'Moon' && p.natalTargetId === 'Sun' && p.aspectType === 'square' && p.targetKind === 'natal');
      const support = family.find(({ normalizedPayload: p }) => p.hasAdverseSolarDirection && witness(p));
      assert.ok(support);
      assert.match(describeFortuneFact({ method: 'western', type: support.factType, data: support.normalizedPayload }, String), phrase);
      const exact = family.find(row => match.sourceFactIds.includes(row.factId));
      assert.equal(exact?.normalizedPayload.monthlyLunarHasExact, true);
      const evaluate = override => evaluateFortuneRules('western', parameters.periodType,
        [{ ...exact, normalizedPayload: { ...exact.normalizedPayload, ...override } }])
        .find(row => row.knowledgeId === match.knowledgeId).required[0];
      assert.equal(evaluate({ hasAdverseSolarDirection: false, monthlyLunarQualification: 'base' }).hits.length, 1);
      assert.equal(evaluate({ monthlyLunarHasExact: false }).hits.length, 0);
      return;
    }
    if (id === '249') {
      assert.equal(match.status, 'matched');
      assert.ok(run.facts.some(row => match.sourceFactIds.includes(row.factId) && row.factType === 'leo_solar_phase'
        && row.normalizedPayload.targetKind === 'progressed'));
      const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
        && p.progressedBody === 'Sun' && p.natalTargetId === 'Moon' && p.aspectType === 'semisquare' && witness(p));
      assert.ok(fact && !match.sourceFactIds.includes(fact.factId));
      assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String), phrase);
      return;
    }
    if (id === '286') {
      const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
        && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
      const fact = family.find(({ normalizedPayload: p }) => witness(p) && p.sunUranusParallelBackgroundOnly);
      assert.ok(fact, id);
      assert.equal(fact.normalizedPayload.metaphysicalDirectionState, 'none');
      assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String), phrase);
      // A generic lunar link only supplies the solar background here. Other
      // slices in the year may have separately confirmed research directions.
      const withoutBackground = { ...fact, normalizedPayload: { ...fact.normalizedPayload, sunUranusParallelBackgroundOnly: false } };
      const prior = evaluateFortuneRules('western', parameters.periodType, [withoutBackground])
        .find(row => row.knowledgeId === match.knowledgeId).required[0];
      assert.deepEqual(prior.hits, []);
      const baseline = matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western
        .find(row => row.knowledgeId === match.knowledgeId);
      assert.equal(baseline.status, 'matched');
      assert.equal(baseline.matchedSourceExcerpt, 'This influence will extend over a period of several years');
      assert.deepEqual(baseline.sourceFactIds, [fact.factId]);
      return;
    }
    assert.equal(match.status, 'partial', id);
    const fact = run.facts.find(row => match.sourceFactIds.includes(row.factId) && witness(row.normalizedPayload));
    assert.ok(fact, id);
    assert.ok(match.windows.some(window => window.start <= fact.activeFrom && fact.activeTo <= window.endExclusive), id);
    if (phrase) assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String), phrase, id);
    const counterexample = { ...fact, normalizedPayload: { ...fact.normalizedPayload, ...wrong } };
    const result = evaluateFortuneRules('western', parameters.periodType, [counterexample])
      .find(row => row.knowledgeId === match.knowledgeId).required[0];
    assert.equal(result.hits.length, 0, id);
    assert.equal(result.unknown, false, id);
  });
}

test('p181 uses the exact lunar Neptune contact and keeps the same natal affliction in the following near-only month', () => {
  const snapshot = chart(Date.parse('1940-03-09T00:00:00Z'));
  const reference = { snapshotId: 'leo-specific-181' };
  const replay = month => {
    const parameters = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'Asia/Shanghai' };
    const now = Date.UTC(2026, month - 1, 15);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), 'leo-specific-branches', reference);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p181-'));
    const contacts = run.facts.filter(({ normalizedPayload: p }) => p.progressedBody === 'Moon'
      && p.natalTargetId === 'Neptune' && p.aspectType === 'sesquiquadrate');
    const band = contacts.find(row => row.factType === 'leo_progressed_aspect' && row.normalizedPayload.targetKind === 'natal');
    assert.ok(band);
    const p = band.normalizedPayload;
    assert.ok(p.natalSquareOppositionBodies.includes('Neptune'));
    assert.ok(p.natalMajorAspectContacts.some(contact => [contact.first, contact.second].includes('Neptune')
      && ['square', 'opposition'].includes(contact.aspect)));
    assert.match(describeFortuneFact({ method: 'western', type: band.factType, data: p }, String), /本命海王星为(?:四分相|对分相)/u);
    return { run, match, band, exact: contacts.filter(row => row.factType === 'leo_lunar_exact_observation') };
  };

  const may = replay(5);
  const [fact] = may.exact;
  assert.equal(may.match.status, 'matched');
  assert.equal(may.exact.length, 1);
  assert.ok(may.match.sourceFactIds.includes(fact.factId));
  assert.equal(fact.parentSignalId, may.band.parentSignalId);
  assert.match(fact.exactInstant, /^2026-05-25T/u);
  assert.equal(fact.activeFrom, fact.exactInstant);
  const { progressedLongitude, targetLongitude } = fact.normalizedPayload;
  const distance = Math.abs((progressedLongitude - targetLongitude + 540) % 360 - 180);
  assert.ok(Math.abs(distance - 135) < 0.00001);
  assert.deepEqual(may.match.windows.map(({ start, endExclusive }) => [start, endExclusive]), [[fact.activeFrom, fact.activeTo]]);
  assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String),
    /次限月亮对本命海王星精确形成倍半刑相/u);
  const withoutNatalAffliction = { ...fact, normalizedPayload: { ...fact.normalizedPayload,
    natalSquareOppositionBodies: ['Moon'], hasLunarNeptuneTestimony: false, lunarNeptuneTestimonies: [] } };
  const ordinary = evaluateFortuneRules('western', 'month', [withoutNatalAffliction])
    .find(row => row.knowledgeId === may.match.knowledgeId).required[0];
  assert.deepEqual([ordinary.hits.length, ordinary.unknown], [1, false]);
  const report = interpretFortune(may.run, requestForFortuneRun(may.run), 'lunar-neptune-exact-report');
  const { input } = buildFortuneModelContext(may.run, report);
  assert.match(formatFortuneFactAudit(input), /本命海王星为(?:四分相|对分相)/u);

  const june = replay(6);
  assert.deepEqual(june.exact, []);
  assert.equal(june.match.status, 'not_matched');
});

test('Mars–Jupiter trine keeps overlapping investment directions separate from the exact aspect', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p042-'));
  const band = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody, natalTargetId, aspectType, start, end, targetKind, exactTimes: [] });
  const base = band('Mars', 'Jupiter', 'trine', 0, 10);
  const rows = buildLeoLunarConditions([
    base,
    band('Moon', 'Sun', 'trine', 1, 9),
    band('Sun', 'Jupiter', 'trine', 3, 8),
    band('Moon', 'Jupiter', 'semisquare', 4, 5),
    band('Mercury', 'Saturn', 'sesquiquadrate', 6, 7),
    band('Venus', 'Jupiter', 'sextile', 0, 10),
    band('Sun', 'Jupiter', 'sesquiquadrate', 0, 10, 'progressed'),
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.speculationLunarState, row.speculationMajorState]), [
    [0, 1, 'none', 'none'], [1, 3, 'favourable', 'none'], [3, 4, 'favourable', 'favourable'],
    [4, 5, 'mixed', 'favourable'], [5, 6, 'favourable', 'favourable'], [6, 7, 'favourable', 'mixed'],
    [7, 8, 'favourable', 'favourable'], [8, 9, 'favourable', 'none'], [9, 10, 'none', 'none'],
  ]);
  const facts = rows.map(({ speculationLunarState, speculationMajorState, speculationDirections }) => ({
    factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, ...base, speculationLunarState, speculationMajorState, speculationDirections },
  }));
  const point = { factType: 'leo_mutual_exact_observation', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, start: 1 } };
  const result = evaluateFortuneRules('western', rule.period, [...facts, point]).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits, [point]);
  const supporting = facts.filter(({ normalizedPayload: p }) => p.speculationLunarState === 'favourable' && p.speculationMajorState === 'favourable');
  assert.deepEqual(supporting, [facts[2], facts[4], facts[6]]);
  assert.deepEqual(facts[2].normalizedPayload.speculationDirections.map(direction => direction.passage), ['p200', 'p230']);
});

test('Mars–Neptune trine considers travel and speculation independently in each actual slice', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p052-'));
  const band = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody, natalTargetId, aspectType, start, end, targetKind, exactTimes: [] });
  const base = band('Mars', 'Neptune', 'trine', 0, 14);
  const rows = buildLeoLunarConditions([
    base, { ...base }, band('Moon', 'Venus', 'trine', 0, 14),
    band('Sun', 'Uranus', 'square', 0, 14, 'progressed'),
    band('Sun', 'Jupiter', 'trine', 2, 10), band('Moon', 'Mercury', 'sextile', 4, 12),
    band('Sun', 'Uranus', 'square', 6, 8), band('Moon', 'Jupiter', 'semisquare', 8, 11),
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.travelDirectionState, row.speculationDirectionState]), [
    [0, 'none', 'none'], [2, 'none', 'favourable'], [4, 'favourable', 'favourable'], [6, 'mixed', 'favourable'],
    [8, 'mixed', 'mixed'], [10, 'mixed', 'adverse'], [11, 'favourable', 'none'], [12, 'none', 'none'],
  ]);
  const facts = rows.map(({ travelDirectionState, speculationDirectionState }) => ({
    factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, travelDirectionState, speculationDirectionState },
  }));
  const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(facts.filter(({ normalizedPayload: p }) => p.travelDirectionState === 'favourable'
    || p.speculationDirectionState === 'favourable'), [facts[1], facts[2], facts[3], facts[6]]);
  assert.deepEqual(result.required[0].hits, []);
  const citedSextile = { ...facts[1], normalizedPayload: { ...facts[1].normalizedPayload, aspectType: 'sextile' } };
  const reference = evaluateFortuneRules('western', 'year', [citedSextile]).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(reference.required[0].hits, []);
  assert.deepEqual(rows[3].travelDirections.map(direction => direction.passage), ['p168', 'p281']);
  assert.ok(rows.every(row => row.speculationDirections.every(direction => direction.passage !== 'p052')));
});

test('client Mars–Neptune facts reach SQLite with a named natal strong planet or an actual same-topic direction', () => {
  const runFor = (birth, year, armc = 0) => {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(year, 5, 1), reference = { snapshotId: 'leo-mars-neptune', chart: chart(Date.parse(birth), armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-mars-neptune', reference);
  };
  const matching = (run, passage) => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
  const family = (run, aspect, factType) => run.facts.filter(({ factType: type, normalizedPayload: p }) => type === factType
    && p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal' && p.aspectType === aspect);
  const promptFor = run => formatFortuneFactAudit(buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), 'leo-mars-neptune-report')).input);

  for (const [birth, year, armc, body, house, basis, name] of [
    ['1960-01-01T12:00:00Z', 2024, 100, 'Neptune', 1, 'only-in-angular-house', '海王星'],
    ['1960-02-02T12:00:00Z', 1992, 15, 'Mars', 7, 'one-dignified', '火星'],
  ]) {
    const run = runFor(birth, year, armc), result = matching(run, 'p051');
    assertAnnualMutualObservation(run, result, 'Neptune', 'square', 'matched');
    const witness = family(run, 'square', 'leo_progressed_aspect').find(fact => fact.normalizedPayload.natalMarsNeptuneStrength?.body === body);
    const recorded = witness?.normalizedPayload.natalMarsNeptuneStrength;
    assert.deepEqual([recorded?.body, recorded?.house, recorded?.basis], [body, house, basis]);
    assert.ok(!result.sourceFactIds.includes(witness.factId));
    const prompt = promptFor(run);
    assert.ok(prompt.includes('按Leo与Green的本命角宫比较，本命' + name + '实居第' + house + '宫'));
    assert.doesNotMatch(prompt, /natalMarsNeptuneStrength|only-in-angular-house|one-dignified/u);
  }
  const otherSite = runFor('1960-01-01T12:00:00Z', 2024, 145);
  assert.ok(family(otherSite, 'square', 'leo_progressed_aspect').some(({ normalizedPayload: p }) => p.natalMarsNeptuneStrong === false));
  assertAnnualMutualObservation(otherSite, matching(otherSite, 'p051'), 'Neptune', 'square', 'matched');

  const timed = runFor('1965-12-28T00:00:00Z', 2026), timedResult = matching(timed, 'p052');
  const facts = family(timed, 'trine', 'leo_lunar_condition');
  assertAnnualMutualObservation(timed, timedResult, 'Neptune', 'trine', 'matched');
  const supporting = facts.filter(({ normalizedPayload: p }) => p.travelDirectionState === 'favourable' || p.speculationDirectionState === 'favourable');
  assert.equal(supporting.at(0).activeFrom, '2026-10-23T21:58:46.941Z');
  assert.equal(supporting.at(-1).activeTo, '2026-12-20T15:53:53.606Z');
  const journey = supporting.find(({ normalizedPayload: p }) => p.travelDirections.some(direction => direction.passage === 'p210'));
  assert.ok(journey && !timedResult.sourceFactIds.includes(journey.factId));
  const contrary = facts.find(({ normalizedPayload: p }) => p.travelDirectionState === 'adverse' && p.speculationDirectionState === 'adverse'
    && p.travelDirections.some(direction => direction.passage === 'p147'));
  assert.ok(contrary && !timedResult.sourceFactIds.includes(contrary.factId));
  assert.ok(timedResult.windows.every(window => window.endExclusive <= contrary.activeFrom || contrary.activeTo <= window.start));
  assert.ok(facts.some(({ normalizedPayload: p, factId }) => p.contacts.length > 0 && p.travelDirectionState === 'none'
    && p.speculationDirectionState === 'none' && !timedResult.sourceFactIds.includes(factId)));
  const prompt = promptFor(timed);
  assert.match(describeFortuneFact({ method: 'western', type: journey.factType, data: journey.normalizedPayload }, String),
    /旅行议题的同期推运为次限月亮对本命天王星的三分相/u);
  assert.doesNotMatch(prompt, /travelDirectionState|travelDirections|p210/u);
});

test('Mercury–Jupiter topics respect actual overlap, natal layer and the Moon-only branches', () => {
  const band = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody, natalTargetId, aspectType, start, end, targetKind, exactTimes: [] });
  const cases = [
    ['p078', 'semisextile', [
      band('Moon', 'Jupiter', 'semisextile', 0, 2), band('Sun', 'Mercury', 'trine', 2, 6),
      band('Moon', 'Mercury', 'square', 4, 6), band('Moon', 'Saturn', 'sextile', 6, 8),
      band('Moon', 'Mars', 'sextile', 8, 10),
    ], [2, 6, 8]],
    ['p080', 'sextile', [
      band('Sun', 'Jupiter', 'sextile', 0, 10), band('Moon', 'Mercury', 'trine', 0, 4),
      band('Moon', 'Saturn', 'sextile', 2, 6), band('Moon', 'Venus', 'square', 4, 6),
      band('Moon', 'Jupiter', 'trine', 6, 8, 'progressed'),
      band('Moon', 'Venus', 'sextile', 8, 10), band('Moon', 'Mercury', 'opposition', 8, 10),
    ], [2, 8]],
    ['p085', 'opposition', [
      band('Mercury', 'Mars', 'square', 0, 10), band('Moon', 'Mercury', 'trine', 0, 2),
      band('Moon', 'Mercury', 'square', 2, 4), band('Moon', 'Saturn', 'sextile', 2, 4),
      band('Moon', 'Mercury', 'trine', 4, 6), band('Moon', 'Jupiter', 'square', 4, 6),
      band('Moon', 'Mercury', 'square', 6, 8), band('Moon', 'Mars', 'square', 8, 10),
      band('Moon', 'Mercury', 'trine', 8, 10),
    ], [2, 4, 6]],
  ];
  for (const [passage, aspect, contacts, expectedStarts] of cases) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const base = band('Mercury', 'Jupiter', aspect, 0, 10);
    const rows = buildLeoLunarConditions([base, ...contacts]).filter(row => row.base === base);
    const facts = rows.map(({ start, end, sameLayerLunarState, correspondenceDirectionState, friendshipDirectionState, travelDirectionState }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, start, sameLayerLunarState, correspondenceDirectionState,
        friendshipDirectionState, travelDirectionState, mutualExactInSlice: passage === 'p078' && start <= 2 && 2 < end },
    }));
    const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
    if (passage === 'p078') {
      const topical = rows.filter(row => [row.correspondenceDirectionState, row.friendshipDirectionState, row.travelDirectionState].includes('favourable'));
      assert.deepEqual(topical.map(row => row.start), expectedStarts, passage);
      assert.deepEqual(result.required[0].hits.map(fact => fact.normalizedPayload.start), [2]);
    }
    else {
      const topical = rows.filter(row => passage === 'p080' ? row.friendshipDirectionState === 'favourable'
        : row.sameLayerLunarState === 'all_adverse'
          || [row.correspondenceDirectionState, row.friendshipDirectionState].includes('adverse'));
      assert.deepEqual(topical.map(row => row.start), expectedStarts, passage);
      assert.deepEqual(result.required[0].hits, [], passage);
    }
  }
});

const mercuryJupiterTopicCases = [
    { passage: 'p078', birth: '1966-03-22', aspect: 'semisextile', start: '2026-03-31T16:16:33.494Z',
      accepts: p => !p.hasFavourableLunarLink && p.correspondenceDirections.some(direction => direction.passage === 'p245'),
      rejects: p => p.correspondenceDirectionState === 'mixed' && p.friendshipDirectionState === 'none' && p.travelDirectionState === 'none',
      prose: /写作与文书议题的同期推运为次限太阳对本命水星的.*相/u },
    { passage: 'p080', birth: '1964-12-30', aspect: 'sextile', start: '2026-09-11T16:23:11.638Z',
      accepts: p => p.sameLayerLunarState === 'conditional' && p.friendshipDirections.some(direction => direction.passage === 'p154'),
      rejects: p => p.contacts.length > 0 && p.friendshipDirectionState === 'none',
      prose: /交往与友谊议题的同期推运为次限月亮对本命木星的赤纬绝对值平行/u },
    { passage: 'p085', birth: '1965-11-08', aspect: 'opposition', start: '2026-01-17T07:38:01.531Z',
      accepts: p => p.sameLayerLunarState === 'mixed' && p.correspondenceDirections.some(direction => direction.passage === 'p171'),
      rejects: p => p.sameLayerLunarState === 'mixed' && p.correspondenceDirectionState === 'none' && p.friendshipDirectionState === 'none',
      prose: /写作与文书议题的同期推运为次限月亮对本命水星的.*相，原书此项偏难/u },
];
for (const { passage, birth, aspect, start, accepts, rejects, prose } of mercuryJupiterTopicCases) {
  test(`client Mercury–Jupiter ${passage} preserves topical evidence through SQLite and Chinese audit`, () => {
    const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(2026, 5, 15), snapshotId = 'leo-mercury-jupiter';
    const reference = { snapshotId, chart: chart(Date.parse(birth + 'T12:00:00Z')) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const exact = passage !== 'p078';
    if (exact) assertAnnualMutualObservation(run, result, 'Jupiter', aspect, 'matched', 'Mercury');
    else assert.equal(result.status, 'matched', passage);
    const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Jupiter' && p.targetKind === 'natal' && p.aspectType === aspect);
    const selected = facts.find(fact => fact.activeFrom === start && accepts(fact.normalizedPayload));
    assert.ok(selected, passage);
    assert.ok(!result.sourceFactIds.includes(selected.factId), passage);
    if (!exact) {
      const exactWithTopic = facts.find(({ normalizedPayload: p }) => p.mutualExactInSlice && p.correspondenceDirectionState === 'favourable');
      assert.ok(exactWithTopic && result.sourceFactIds.includes(exactWithTopic.factId), passage);
      assert.ok(result.windows.some(window => window.start <= exactWithTopic.activeFrom && exactWithTopic.activeTo <= window.endExclusive), passage);
    }
    const excluded = facts.filter(fact => rejects(fact.normalizedPayload));
    assert.ok(excluded.length > 0 && excluded.every(fact => !result.sourceFactIds.includes(fact.factId)), passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-jupiter-report'));
    const prompt = formatFortuneFactAudit(input);
    const topicLines = prompt.match(/(?:写作与文书|交往与友谊)议题的同期推运为[^；。]+/ug) ?? [];
    assert.ok(topicLines.some(line => prose.test(line)), `${passage} ${topicLines.join(' / ')}`);
    if (passage === 'p085') {
      assert.ok(facts.some(({ normalizedPayload: p }) => p.friendshipDirections.some(direction =>
        direction.passage === 'p162' && direction.nature === 'adverse')));
      assert.ok(topicLines.some(line => /交往与友谊议题的同期推运为次限月亮对本命\S+，原书此项偏难/u.test(line)),
        topicLines.join(' / '));
    }
    assert.doesNotMatch(prompt, /(?:correspondence|friendship)Direction(?:s|State)|\bp(?:154|171|245)\b/u);
  });
}

test('Mercury–Mars parallel retains the natal background and separate overlapping directions', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p096-'));
  const band = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody: body, natalTargetId: target, aspectType, start, end, targetKind, exactTimes: [] });
  const base = band('Mercury', 'Mars', 'parallel', 0, 10);
  const rows = buildLeoLunarConditions([base, { ...base }, band('Sun', 'Mars', 'trine', 2, 4),
    band('Sun', 'Mercury', 'trine', 4, 6, 'progressed'), band('Moon', 'Saturn', 'square', 6, 8),
    band('Moon', 'Jupiter', 'trine', 8, 10, 'progressed'), band('Sun', 'Jupiter', 'square', 10, 12),
  ]).filter(row => row.base === base);
  const facts = rows.map(({ start, end, hasOtherSameLayerLunarContacts, hasOtherSameLayerDirection }) => ({
    factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, start, end, hasOtherSameLayerLunarContacts, hasOtherSameLayerDirection },
  }));
  const evaluate = evidence => evaluateFortuneRules('western', 'year', evidence).find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
  const support = facts.filter(({ normalizedPayload: p }) => p.hasOtherSameLayerLunarContacts || p.hasOtherSameLayerDirection);
  assert.deepEqual(support.map(({ normalizedPayload: p }) => [p.start, p.end]), [[2, 4], [6, 8]]);
  assert.equal(rows.find(row => row.start === 2).otherDirection.body, 'Sun');
  assert.equal(rows.find(row => row.start === 6).contacts[0].target, 'Saturn');
  assert.deepEqual(evaluate(facts), []);
  const background = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, start: base.start, end: base.end } };
  const otherChart = { ...background, normalizedPayload: { ...background.normalizedPayload, targetKind: 'progressed' } };
  assert.deepEqual(evaluate([background, otherChart]), [background]);
});

const mercuryMarsCases = [
  { passage: 'p091', birth: '1964-05-08', aspect: 'square', status: 'matched',
    witness: ['Mars', 'conjunction'], prose: /本命水星与本命火星为合相[^；。]+言行急促分支/u },
  { passage: 'p091', birth: '1964-05-07', aspect: 'square', status: 'matched' },
  { passage: 'p094', birth: '1964-12-14', aspect: 'quincunx', status: 'matched',
    witness: ['Jupiter', 'sesquiquadrate'], prose: /本命水星与本命木星为倍半刑相[^；。]+言行急促分支/u },
  { passage: 'p094', birth: '1966-12-09', aspect: 'quincunx', status: 'not_matched' },
  { passage: 'p096', birth: '1964-02-04', aspect: 'parallel', status: 'matched',
    prose: /原书将次限水星与本命火星的赤纬平行作为同段其他推运的持续背景/u },
];
for (const { passage, birth, aspect, status, witness, prose } of mercuryMarsCases) {
  test(`full Mercury–Mars charts apply ${passage} natal and concurrent evidence (${birth})`, () => {
    const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(2026, 5, 15), snapshotId = 'leo-mercury-mars';
    const birthInstant = birth + 'T12:00:00Z', at = Date.parse(birthInstant), latitude = 51.48, longitude = 0;
    const snapshot = chart(at);
    snapshot.birthContext = { precision: 'minute', birthInstant, latitude, longitude, timeZone: 'Europe/London', clockVersion: 'gregory-iana-intl-v1' };
    Object.assign(snapshot.western.rawResult[0], anglesFromFrame(SiderealTime(new Date(at)) * 15 + longitude, latitude, 23.44));
    const reference = { snapshotId, chart: snapshot };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    assert.equal(result.status, status, birth);
    const type = passage === 'p094' ? 'leo_lunar_condition' : 'leo_progressed_aspect';
    const sameGeometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury'
      && p.natalTargetId === 'Mars' && p.targetKind === 'natal' && p.aspectType === aspect;
    const candidates = run.facts.filter(fact => fact.factType === type && sameGeometry(fact));
    const matched = candidates.filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.ok(candidates.length > 0 && candidates.every(fact => fact.completeness === 'complete'), birth);
    if (passage === 'p096') {
      assert.ok(matched.length && matched.every(({ normalizedPayload: p }) =>
        p.allowedOrb === 1 && p.coordinate === 'equatorial_declination_of_date'));
      const support = run.facts.find(fact => fact.factType === 'leo_lunar_condition'
        && fact.activeTo === '2026-01-21T14:01:17.014Z' && matched.some(row => row.parentSignalId === fact.parentSignalId)
        && (fact.normalizedPayload.hasOtherSameLayerLunarContacts || fact.normalizedPayload.otherDirection?.targetKind === 'natal'));
      assert.ok(support && !result.sourceFactIds.includes(support.factId));
      assert.ok(result.windows.some(window => window.start <= support.activeFrom && support.activeTo < window.endExclusive));
      assert.match(describeFortuneFact({ method: 'western', type: support.factType, data: support.normalizedPayload }, String), prose);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-mars-report'));
      const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
      assert.ok(formatFortunePrompt(input).includes(meaning));
      assert.doesNotMatch(formatFortuneFactAudit(input), /\bp096\b/u);
      return;
    } else {
      assertAnnualMutualObservation(run, result, 'Mars', aspect, status, 'Mercury');
      assert.ok(candidates.every(({ normalizedPayload: p }) => p.hasNatalMercuryImpulsivenessTestimony === Boolean(witness)), birth);
      if (witness) assert.ok(candidates.some(({ normalizedPayload: p }) => p.natalMercuryImpulsivenessContacts.some(contact =>
        contact.first === 'Mercury' && contact.second === witness[0] && contact.aspect === witness[1])), birth);
      if (passage === 'p094') assert.ok(candidates.some(({ normalizedPayload: p }) =>
        p.hasOtherSameLayerLunarContacts || p.hasOtherSameLayerDirection), birth);
      assert.deepEqual(matched, []);
    }
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-mars-report'));
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.equal(formatFortunePrompt(input).includes(meaning), status === 'matched', birth);
    const natalEvidenceIds = new Set(run.facts.filter(fact => (fact.factType === 'leo_progressed_aspect' || fact.factType === type)
      && sameGeometry(fact)).map(fact => fact.factId));
    const projected = input.facts.filter(fact => natalEvidenceIds.has(references.get(fact.ref)));
    const lines = projected.map(fact => describeFortuneFact(fact, time => time));
    if (prose) assert.ok(lines.some(line => prose.test(line)), `${birth} ${lines.join(' / ')}`);
    else assert.ok(lines.every(line => !line.includes('言行急促分支')), birth);
    const prompt = formatFortuneFactAudit(input);
    if (prose) assert.match(prompt, prose, birth);
    assert.doesNotMatch(prompt, /natalMercuryImpulsivenessContacts|hasNatalMercuryImpulsivenessTestimony|\bp09[146]\b/u);
  });
}

function checkMercuryNeptuneCharts(cases) {
  for (const { passage, birth, aspect, windowStart, qualifies, prose, exact } of cases) {
    const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(2026, 5, 15), snapshotId = 'leo-mercury-neptune';
    const birthInstant = birth + 'T12:00:00Z', birthAt = Date.parse(birthInstant), latitude = 51.48, longitude = 0;
    const snapshot = chart(birthAt);
    snapshot.birthContext = { precision: 'minute', birthInstant, latitude, longitude, timeZone: 'Europe/London', clockVersion: 'gregory-iana-intl-v1' };
    Object.assign(snapshot.western.rawResult[0], anglesFromFrame(SiderealTime(new Date(birthAt)) * 15 + longitude, latitude, 23.44));
    const reference = { snapshotId, chart: snapshot };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const base = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && activeFrom === windowStart && p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal' && p.aspectType === aspect);
    assert.ok(base?.completeness === 'complete' && qualifies(base.normalizedPayload), birth);
    const sextileBasis = passage === 'p100';
    const observation = exact === undefined && !sextileBasis ? undefined : run.facts.find(row => row.factType === 'leo_mutual_exact_observation'
      && row.parentSignalId === base.parentSignalId && row.normalizedPayload.observed === true);
    if (exact !== undefined) {
      assert.equal(Boolean(observation), exact, birth);
      if (observation) {
        const p = observation.normalizedPayload;
        assert.equal(p.hasNatalMercuryNeptuneTestimony, Boolean(prose), birth);
        if (prose && ['p099', 'p103'].includes(passage)) {
          assert.equal(p.hasSoleNatalMercuryNeptuneContact, false, birth);
          assert.ok(p.natalMercuryContactBodies.includes('Neptune') && p.natalMercuryContactBodies.length > 1, birth);
        }
      }
    }
    const noExactConjunction = passage === 'p097';
    const mentalTendency = ['p099', 'p103'].includes(passage);
    const observedParallel = passage === 'p106' && base.normalizedPayload.mercuryNeptuneParallelBandObserved === true;
    const status = mentalTendency && exact || sextileBasis && observation || observedParallel ? 'matched'
      : prose && !mentalTendency && !sextileBasis ? 'partial' : 'not_matched';
    if (noExactConjunction) assertAnnualMutualObservation(run, result, 'Neptune', 'conjunction', 'not_matched', 'Mercury');
    else assert.equal(result.status, status, birth);
    if (!prose && status !== 'matched') {
      assert.deepEqual(result.sourceFactIds, [], birth);
      assert.deepEqual(result.windows, [], birth);
      continue;
    }
    const witness = observation ?? base;
    const matchesWitness = !noExactConjunction && (!sextileBasis || Boolean(observation));
    assert.equal(result.sourceFactIds.includes(witness.factId), matchesWitness, birth);
    assert.equal(result.windows.some(window => window.start <= witness.activeFrom && witness.activeTo <= window.endExclusive), matchesWitness, birth);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-neptune-report'));
    assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === result.knowledgeId)), status === 'matched');
    const modelFacts = input.facts.filter(fact => noExactConjunction || sextileBasis ? references.get(fact.ref) === base.factId
      : result.sourceFactIds.includes(references.get(fact.ref)));
    if (passage === 'p106') {
      assert.equal(observedParallel, true);
      assert.equal(base.normalizedPayload.hasNatalNeptuneCreativeTestimony, true);
      const evaluation = evaluateFortuneRules('western', 'year', [base]).find(row => row.knowledgeId === result.knowledgeId);
      const art = evaluation.confirmations.find(row => row.sourceExcerpt === 'Should the native be an imaginative writer, a poet or musician');
      assert.deepEqual(art.hits, [base]);
      assert.ok(base.normalizedPayload.natalNeptuneCreativeTestimonies.some(row =>
        row.other === 'Venus' && row.aspect === 'trine'));
      const unsupported = { ...base, normalizedPayload: { ...base.normalizedPayload, hasNatalNeptuneCreativeTestimony: false } };
      const retry = evaluateFortuneRules('western', 'year', [unsupported]).find(row => row.knowledgeId === result.knowledgeId);
      assert.deepEqual(retry.confirmations.find(row => row.sourceExcerpt === art.sourceExcerpt).hits, []);
      const provider = formatFortunePrompt(input);
      assert.match(provider, /当事人已经写作、作诗或从事音乐的前提/u);
      assert.doesNotMatch(provider, /natalNeptuneCreativeTestimonies|hasNatalNeptuneCreativeTestimony/u);
    }
    const prompt = formatFortuneFactAudit(input);
    if (prose) {
      assert.ok(modelFacts.some(fact => prose.test(describeFortuneFact(fact, time => time))), birth);
      assert.match(prompt, prose, birth);
    } else assert.ok(modelFacts.every(fact => !/本命感应的偏顺依据|本命感应的偏难依据/u.test(describeFortuneFact(fact, time => time))), birth);
    assert.doesNotMatch(prompt, /natalMercuryNeptuneTestimonies|natalNeptuneArtContacts|\bp(?:097|099|100|103|106)\b/u);
    if (observation) {
      const providerPrompt = formatFortunePrompt(input);
      assert.doesNotMatch(providerPrompt, /本命感应的偏顺依据|本命感应的偏难依据/u);
      assert.equal(providerPrompt.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), status === 'matched', birth);
    }
  }
}

const mercuryNeptuneSensitivityCases = [
    { passage: 'p097', birth: '1965-08-23', aspect: 'conjunction', windowStart: '2026-10-07T19:01:38.987Z',
      qualifies: p => p.natalMercuryNeptuneTestimonies.some(row => row.aspect === 'square' && row.nature === 'adverse') && !p.hasNatalNeptuneArtContact,
      prose: /本命水星与本命海王星为四分相[^；]+本命感应的偏难依据/u },
    { passage: 'p099', birth: '1963-08-07', aspect: 'semisquare', windowStart: '2026-01-01T00:00:00.000Z', exact: true,
      qualifies: p => p.natalMercuryNeptuneTestimonies.some(row => row.aspect === 'sextile' && row.nature === 'favourable'),
      prose: /本命水星与本命海王星为六合相[^；]+本命感应的偏顺依据/u },
    { passage: 'p099', birth: '1963-06-21', aspect: 'semisquare', windowStart: '2026-09-25T22:33:25.334Z', exact: false,
      qualifies: p => p.hasNatalMercuryNeptuneTestimony === false },
    { passage: 'p103', birth: '1964-01-15', aspect: 'sesquiquadrate', windowStart: '2026-04-15T16:19:20.266Z', exact: true,
      qualifies: p => p.natalMercuryNeptuneTestimonies.some(row => row.aspect === 'semisquare' && row.nature === 'adverse'),
      prose: /本命水星与本命海王星为半刑相[^；]+本命感应的偏难依据/u },
    { passage: 'p103', birth: '1963-01-21', aspect: 'sesquiquadrate', windowStart: '2026-06-11T12:25:07.874Z', exact: true,
      qualifies: p => !p.hasNatalMercuryNeptuneTestimony && p.natalMajorAspectContacts.some(row => row.first === 'Jupiter' && row.second === 'Neptune' && row.aspect === 'trine') },
];
for (const sample of mercuryNeptuneSensitivityCases) {
  test(`complete Mercury–Neptune ${sample.passage} chart distinguishes sensitivity from geometry (${sample.birth})`, () => {
    checkMercuryNeptuneCharts([sample]);
  });
}

const venusNeptuneArt = /本命金星与本命海王星为(?:六合|三分)相[^；]+艺术或音乐分支/u;
const mercuryNeptuneArtCases = [
    { passage: 'p097', birth: '1963-09-03', aspect: 'conjunction', windowStart: '2026-06-22T03:56:54.221Z',
      qualifies: p => !p.hasNatalMercuryNeptuneTestimony && p.natalNeptuneArtContacts.some(row => row.other === 'Venus' && row.aspect === 'sextile'), prose: venusNeptuneArt },
    { passage: 'p100', birth: '1963-06-09', aspect: 'sextile', windowStart: '2026-06-27T20:53:20.867Z',
      qualifies: p => p.natalTargetHouse === 3 && !p.hasNatalNeptuneArtContact,
      prose: /水海六合带内的本命海王星实居第三宫，保留写作与沟通背景供核对/u },
    { passage: 'p100', birth: '1965-11-20', aspect: 'sextile', windowStart: '2026-09-22T04:37:17.366Z',
      qualifies: p => p.natalTargetHouse !== 3 && p.natalNeptuneArtContacts.some(row => row.other === 'Venus' && row.aspect === 'sextile'),
      prose: /当前片段只列水海六合带。本命金星与本命海王星为六合相[^。]*创艺见证/u },
    { passage: 'p100', birth: '1963-11-02', aspect: 'sextile', windowStart: '2026-01-01T00:00:00.000Z',
      qualifies: p => p.natalTargetHouse !== 3 && !p.hasNatalNeptuneArtContact && p.natalPairAspectTypes.includes('conjunction') },
    { passage: 'p106', birth: '1964-08-24', aspect: 'parallel', windowStart: '2026-01-01T00:00:00.000Z',
      qualifies: p => p.allowedOrb === 1 && !p.natalSquareOppositionBodies.includes('Neptune') && p.natalNeptuneArtContacts.some(row => row.other === 'Venus' && row.aspect === 'trine'), prose: venusNeptuneArt },
];
for (const sample of mercuryNeptuneArtCases) {
  test(`complete Mercury–Neptune ${sample.passage} chart uses the actual natal artistic basis (${sample.birth})`, () => {
    checkMercuryNeptuneCharts([sample]);
  });
}

test('p100 exact Mercury–Neptune sextile accepts the independent natal Moon artistic evidence', () => {
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'sextile' && p.targetKind === 'natal';
  for (const [birth, house, supported] of [['1957-10-19', 10, true], ['1950-05-09', 2, false]]) {
    const birthInstant = `${birth}T12:00:00Z`, birthAt = Date.parse(birthInstant);
    const snapshotId = `leo-p100-moon-neptune-${birth}`;
    const run = submitLeoChart(snapshotId, birthInstant, 51.48, 0, 'Europe/London');
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p100-'));
    const band = run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && geometry(fact)
      && fact.normalizedPayload.hasMercuryNeptuneSextileExact === true);
    const point = run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact)
      && fact.parentSignalId === band?.parentSignalId);
    assert.ok(point && band);
    assert.equal(band.normalizedPayload.natalTargetHouse, house);
    assert.equal(band.normalizedPayload.hasNatalNeptuneArtContact, false);
    assert.equal(band.normalizedPayload.hasNatalNeptuneCreativeTestimony, supported);
    assert.deepEqual(band.normalizedPayload.natalNeptuneCreativeTestimonies.map(row => [row.other, row.aspect]),
      supported ? [['Moon', 'sextile']] : []);
    const ephemerisAt = Math.round(progressionEpoch(birthAt, Date.parse(point.exactInstant)));
    const mercury = readLeoMovingPosition('Mercury', ephemerisAt).longitude, neptune = readLeoMovingPosition('Neptune', birthAt).longitude;
    assert.ok(Math.abs(Math.abs((mercury - neptune + 540) % 360 - 180) - 60) < 0.00001);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.sourceFactIds, [point.factId]);
    assert.equal(point.normalizedPayload.mercuryNeptuneArtisticBasis, supported ? 'qualified' : 'unreviewed');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), snapshotId));
    const provider = formatFortunePrompt(input);
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.ok(provider.includes(meaning));
    assert.doesNotMatch(provider, /mercuryNeptuneArtisticBasis|natalNeptuneCreativeTestimonies/u);
    if (supported) {
      assert.match(formatFortuneFactAudit(input), /本命月亮与本命海王星为六合相[^。]+创艺见证/u);
    } else {
      assert.ok(provider.includes('本命有相关创艺见证且本人确有写作、音乐或艺术兴趣时'));
      assert.ok(provider.includes('具体经历以当事人的实际处境为准'));
    }
  }
});

test('Mercury–Neptune parallel retains the named natal hard-contact branch independently of the artistic branch', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p106-'));
  const query = rule.queries[0];
  const fact = (conditions) => ({ factType: query.factType, scope: query.scope, completeness: 'complete',
    normalizedPayload: { ...query.where, natalTargetHouse: 4, hasNatalNeptuneArtContact: false, natalSquareOppositionBodies: [],
      hasNatalNeptuneMinorAffliction: false, ...conditions } });
  const facts = [fact({ natalSquareOppositionBodies: ['Neptune'] }), fact({ natalSquareOppositionBodies: ['Mercury'] }),
    fact({ hasNatalNeptuneArtContact: true }), fact({ natalTargetHouse: 3 }), fact({ natalTargetHouse: 3, targetKind: 'progressed' }),
    fact({ hasNatalNeptuneMinorAffliction: true }), fact({ hasNatalNeptuneMinorAffliction: true, targetKind: 'progressed' })];
  const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits, [facts[0], facts[2], facts[3], facts[5]]);
});

test('Mercury–Saturn lunar topics match independently inside the foundation direction', () => {
  const band = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody: body, natalTargetId: target, aspectType, start, end, targetKind, exactTimes: [] });
  const cases = [
    ['p108', 'semisextile', [
      band('Moon', 'Mars', 'square', 0, 10), band('Moon', 'Saturn', 'trine', 2, 4),
      band('Moon', 'Mercury', 'sextile', 4, 6, 'progressed'), band('Moon', 'Mercury', 'opposition', 6, 8),
      band('Moon', 'Saturn', 'sextile', 6, 10),
    ], [2, 8]],
    ['p112', 'trine', [
      band('Moon', 'Mars', 'square', 0, 10), band('Moon', 'Saturn', 'trine', 2, 4), band('Moon', 'Sun', 'sextile', 4, 6),
      band('Moon', 'Jupiter', 'trine', 6, 8), band('Sun', 'Jupiter', 'trine', 0, 10),
      band('Moon', 'Uranus', 'trine', 8, 10), band('Moon', 'Jupiter', 'semisquare', 8, 10),
    ], [2, 4, 6]],
    ['p115', 'opposition', [
      band('Moon', 'Venus', 'sextile', 0, 10), band('Moon', 'Mars', 'square', 0, 2), band('Moon', 'Mars', 'opposition', 2, 4),
      band('Moon', 'Mercury', 'sesquiquadrate', 4, 6), band('Moon', 'Saturn', 'sesquiquadrate', 6, 8),
      band('Moon', 'Mars', 'opposition', 8, 10, 'progressed'),
    ], [2, 4, 6]],
  ];
  for (const [passage, aspect, others, expected] of cases) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const base = band('Mercury', 'Saturn', aspect, 0, 10);
    const rows = buildLeoLunarConditions([base, ...others]).filter(row => row.base === base);
    const facts = rows.map(({ start, sameLayerLunarState, studyDirectionState, correspondenceDirectionState, speculationLunarState, disputeDirectionState }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, start, sameLayerLunarState, studyDirectionState, correspondenceDirectionState,
        speculationLunarState, disputeDirectionState },
    }));
    const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
    const topical = rows.filter(row => {
      if (passage === 'p108') return row.sameLayerLunarState === 'all_favourable' || row.studyDirectionState === 'favourable';
      if (passage === 'p112') return row.sameLayerLunarState === 'all_favourable'
        || [row.studyDirectionState, row.correspondenceDirectionState, row.speculationLunarState].includes('favourable');
      return row.sameLayerLunarState === 'all_adverse'
        || [row.studyDirectionState, row.correspondenceDirectionState, row.disputeDirectionState].includes('adverse');
    });
    assert.deepEqual(topical.map(row => row.start), expected, passage);
    assert.deepEqual(result.required[0].hits, [], passage);
  }
});

function submitLeoChart(snapshotId, birthInstant, latitude, longitude, timeZone, month, year = 2026) {
  const birthAt = Date.parse(birthInstant), snapshot = chart(birthAt);
  snapshot.birthContext = { precision: 'minute', birthInstant, latitude, longitude, timeZone, clockVersion: 'gregory-iana-intl-v1' };
  const armc = (SiderealTime(new Date(birthAt)) * 15 + longitude + 360) % 360;
  Object.assign(snapshot.western.rawResult[0], anglesFromFrame(armc, latitude, 23.44));
  const params = { periodType: month ? 'month' : 'year',
    targetPeriod: month ? { year, month } : { year }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(year, 5, 15), reference = { snapshotId, chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
}

test('Mercury–Neptune opposition uses computed house rulership outside the older gate and with zero ruled houses', () => {
  for (const [longitude, timeZone, expected, phrase] of [
    [-180, 'Etc/GMT+12', [3], /水星实掌第3宫，可核手足、书信文书、基础学习与短途出行/u],
    [142, 'Etc/GMT-9', [], /本命宫头已计算，水星未实际掌任何宫位/u],
  ]) {
    const run = submitLeoChart('leo-mercury-ruled-houses', '1964-03-31T00:00:00Z', 51.48, longitude, timeZone);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p105-'));
    assertAnnualMutualObservation(run, result, 'Neptune', 'opposition', 'matched', 'Mercury');
    const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.aspectType === 'opposition' && p.targetKind === 'natal');
    assert.ok(facts.length > 0);
    for (const { normalizedPayload: p } of facts) {
      assert.deepEqual(p.natalFirstRuledHouseNumbers, expected, longitude);
      assert.equal(p.natalFirstRuledHouseCount, expected.length);
      assert.deepEqual(p.rulership.cuspRulers.filter(row => row.ruler === 'Mercury').map(row => row.house), expected);
      assert.equal(p.rulership.second.ruledHouses, undefined);
    }
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-ruled-houses-report'));
    const chosen = input.facts.find(row => facts.some(fact => fact.factId === references.get(row.ref)));
    assert.ok(chosen, longitude);
    const text = describeFortuneFact(chosen, String);
    assert.match(text, phrase);
    assert.match(text, /一般人物线索另列文书人员、雇员、信使或代理人/u);
    assert.doesNotMatch(text, /natalFirstRuledHouseCount|本命海王星未实际掌/u);
  }
});

test('complete Mercury–Saturn charts submit topical Moon witnesses and exclude unrelated periods', () => {
  const cases = [
    { passage: 'p108', birth: '1964-12-03', aspect: 'semisextile', general: 'all_favourable', start: '2026-08-29T10:08:56.023Z',
      fields: ['studyDirectionState'], nature: 'favourable', witness: 'p168', evidenceField: 'studyDirections',
      phrase: /思考与学习议题的同期推运为次限月亮对本命水星的六合相，原书此项偏顺/u },
    { passage: 'p112', birth: '1964-08-20', aspect: 'trine', general: 'all_favourable', start: '2026-08-14T15:22:56.697Z',
      fields: ['studyDirectionState', 'correspondenceDirectionState', 'speculationLunarState'], nature: 'favourable', witness: 'p188', evidenceField: 'studyDirections',
      phrase: /思考与学习议题的同期推运为次限月亮对本命土星的六合相，原书此项偏顺/u },
    { passage: 'p115', birth: '1964-07-10', aspect: 'opposition', general: 'all_adverse', start: '2026-01-01T00:00:00.000Z',
      fields: ['studyDirectionState', 'correspondenceDirectionState', 'disputeDirectionState'], nature: 'adverse', witness: 'p169', evidenceField: 'disputeDirections',
      phrase: /争执议题的同期推运为次限月亮对本命水星的四分相，原书此项偏难/u },
  ];
  for (const { passage, birth, aspect, general, start, fields, nature, witness, evidenceField, phrase } of cases) {
    const run = submitLeoChart('leo-mercury-saturn-topics', birth + 'T12:00:00Z', 51.48, 0, 'Europe/London');
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    assertAnnualMutualObservation(run, result, 'Saturn', aspect, 'matched', 'Mercury');
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Saturn' && p.targetKind === 'natal' && p.aspectType === aspect);
    const actual = family.find(fact => fact.activeFrom === start);
    assert.ok(actual?.completeness === 'complete' && !result.sourceFactIds.includes(actual.factId), passage);
    assert.notEqual(actual.normalizedPayload.sameLayerLunarState, general, passage);
    assert.ok(actual.normalizedPayload[evidenceField].some(direction => direction.passage === witness && direction.nature === nature), passage);
    assert.match(describeFortuneFact({ method: 'western', type: actual.factType, data: actual.normalizedPayload }, String), phrase, passage);
    const excluded = family.filter(({ normalizedPayload: p }) => p.sameLayerLunarState !== general
      && p.contacts.some(contact => contact.targetKind === 'natal') && !fields.some(field => p[field] === nature));
    assert.ok(excluded.length && excluded.every(fact => !result.sourceFactIds.includes(fact.factId)), passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-saturn-topics-report'));
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.ok(formatFortunePrompt(input).includes(meaning), passage);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase, passage);
    assert.doesNotMatch(prompt, /(?:study|dispute)Direction(?:State|s)|\bp(?:108|112|115|168|169|188)\b/u);
  }
});

test('Mercury–Uranus lunar topics separate known themes, contra-indications and chart layers', () => {
  const band = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody: body, natalTargetId: target, aspectType, start, end, targetKind, exactTimes: [] });
  const cases = [
    ['p118', 'semisextile', [
      band('Moon', 'Uranus', 'trine', 0, 2, 'progressed'), band('Moon', 'Uranus', 'square', 2, 4),
      band('Moon', 'Neptune', 'trine', 4, 8), band('Moon', 'Neptune', 'square', 6, 8), band('Moon', 'Neptune', 'opposition', 8, 10),
    ], [4, 6, 8]],
    ['p122', 'trine', [
      band('Moon', 'Saturn', 'square', 0, 10), band('Sun', 'Jupiter', 'trine', 0, 10), band('Moon', 'Uranus', 'sextile', 2, 4),
      band('Moon', 'Mercury', 'trine', 4, 6), band('Moon', 'Jupiter', 'trine', 6, 8),
      band('Moon', 'Neptune', 'trine', 8, 10), band('Moon', 'Neptune', 'opposition', 8, 10),
    ], [2, 4, 6]],
    ['p123', 'sesquiquadrate', [
      band('Moon', 'Sun', 'trine', 0, 2), band('Moon', 'Neptune', 'trine', 2, 10), band('Moon', 'Saturn', 'square', 2, 4),
      band('Moon', 'Venus', 'square', 4, 6), band('Moon', 'Mercury', 'semisquare', 6, 8),
      band('Moon', 'Mercury', 'semisquare', 8, 10, 'progressed'),
    ], [2, 4, 6]],
    ['p126', 'parallel', [
      band('Moon', 'Venus', 'square', 0, 10), band('Moon', 'Uranus', 'sextile', 2, 4), band('Moon', 'Mars', 'sextile', 4, 6),
      band('Moon', 'Uranus', 'sextile', 6, 8), band('Moon', 'Uranus', 'square', 6, 8), band('Moon', 'Uranus', 'sextile', 8, 10, 'progressed'),
    ], [2, 4]],
  ];
  for (const [passage, aspect, others, expected] of cases) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const { where } = rule.queries[0];
    const base = band('Mercury', 'Uranus', aspect, 0, 10);
    const rows = buildLeoLunarConditions([base, ...others]).filter(row => row.base === base);
    const facts = rows.map(({ start, sameLayerLunarState, correspondenceDirectionState, speculationLunarState,
      travelDirectionState, friendshipDirectionState, metaphysicalDirectionState, relocationDirectionState }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...where, start, sameLayerLunarState, correspondenceDirectionState, speculationLunarState,
        travelDirectionState, friendshipDirectionState, metaphysicalDirectionState, relocationDirectionState },
    }));
    const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
    const topical = rows.filter(row => {
      if (passage === 'p118') return ['favourable', 'adverse', 'mixed'].includes(row.metaphysicalDirectionState);
      if (passage === 'p122') return row.sameLayerLunarState === 'all_favourable'
        || [row.metaphysicalDirectionState, row.correspondenceDirectionState, row.speculationLunarState].includes('favourable');
      if (passage === 'p126') return row.sameLayerLunarState === 'all_favourable'
        || [row.travelDirectionState, row.relocationDirectionState].includes('favourable');
      return row.sameLayerLunarState === 'all_adverse'
        || [row.correspondenceDirectionState, row.friendshipDirectionState, row.travelDirectionState, row.relocationDirectionState].includes('adverse');
    });
    assert.deepEqual(topical.map(row => row.start), expected, passage);
    assert.deepEqual(result.required[0].hits, [], passage);
  }
});

test('complete Mercury–Uranus charts use topical Moon contacts through SQLite', () => {
  const cases = [
    { passage: 'p118', birth: '1963-06-27', aspect: 'semisextile', start: '2026-03-31T17:09:47.219Z',
      witness: 'p177', field: 'metaphysicalDirections',
      verify: p => p.lunarLinkedBodies.length === 0 && p.metaphysicalDirectionState === 'adverse',
      reject: p => p.lunarLinkedBodies.length > 0 && p.metaphysicalDirectionState === 'none',
      phrase: /玄学与心灵体验议题的同期推运为次限月亮对本命海王星的半刑相，原书此项偏难/u },
    { passage: 'p122', birth: '1963-02-07', aspect: 'trine', start: '2026-01-01T00:00:00.000Z',
      witness: 'p150', field: 'speculationDirections',
      verify: p => p.sameLayerLunarState === 'mixed' && p.speculationLunarState === 'favourable',
      reject: p => p.sameLayerLunarState === 'all_adverse' && p.speculationLunarState !== 'favourable'
        && p.metaphysicalDirectionState !== 'favourable' && p.correspondenceDirectionState !== 'favourable',
      phrase: /投资与投机议题的同期推运为次限月亮对本命木星的三分相，原书此项偏顺/u },
    { passage: 'p123', birth: '1963-12-06', aspect: 'sesquiquadrate', start: '2026-12-05T07:24:46.560Z',
      witness: 'p209', field: 'relocationDirections',
      verify: p => p.sameLayerLunarState === 'mixed' && p.relocationDirectionState === 'adverse' && p.travelDirectionState === 'none',
      reject: p => p.sameLayerLunarState === 'mixed' && p.relocationDirectionState === 'none' && p.travelDirectionState === 'none'
        && p.correspondenceDirectionState === 'favourable' && p.friendshipDirectionState === 'none',
      phrase: /迁居与变动议题的同期推运为次限月亮对本命天王星的四分相，原书此项偏难/u },
    { passage: 'p126', birth: '1963-01-08', aspect: 'parallel', start: '2026-08-23T07:42:54.207Z',
      witness: 'p158', field: 'travelDirections',
      verify: p => p.sameLayerLunarState === 'conditional' && p.travelDirectionState === 'favourable' && p.relocationDirectionState === 'none',
      reject: p => p.sameLayerLunarState === 'all_adverse' && p.relocationDirectionState === 'adverse' && p.travelDirectionState === 'none',
      phrase: /旅行议题的同期推运为次限月亮对本命火星的六合相，原书此项偏顺/u },
  ];
  for (const { passage, birth, aspect, start, witness, field, verify, reject, phrase } of cases) {
    const run = submitLeoChart('leo-mercury-uranus-topics', birth + 'T12:00:00Z', 51.48, 0, 'Europe/London');
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const exact = passage !== 'p126';
    if (exact) assertAnnualMutualObservation(run, result, 'Uranus', aspect, 'matched', 'Mercury');
    else assertAnnualMercuryParallel(run, result, 'Uranus');
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === aspect);
    const actual = family.find(({ activeFrom, normalizedPayload: p }) => activeFrom === start && verify(p));
    assert.ok(actual?.completeness === 'complete' && !result.sourceFactIds.includes(actual.factId), passage);
    const evidence = actual.normalizedPayload[field];
    assert.ok(evidence.some(direction => direction.passage === witness), passage);
    assert.ok(evidence.every(direction => direction.body === 'Moon' && direction.targetKind === 'natal'), passage);
    assert.match(describeFortuneFact({ method: 'western', type: actual.factType, data: actual.normalizedPayload }, String), phrase, passage);
    const rejected = family.filter(({ normalizedPayload }) => reject(normalizedPayload));
    assert.ok(rejected.length && rejected.every(fact => !result.sourceFactIds.includes(fact.factId)), passage);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-uranus-topics-report'));
    if (exact) {
      const point = run.facts.find(row => result.sourceFactIds.includes(row.factId));
      assert.equal(point?.factType, 'leo_mutual_exact_observation', passage);
      if (passage === 'p123') assert.ok(point.exactInstant < actual.activeFrom, passage);
    } else {
      assert.ok(result.windows.some(window => window.start <= start && actual.activeTo <= window.endExclusive), passage);
      assert.ok(input.facts.some(fact => family.some(row => row.factId === references.get(fact.ref)) && fact.data[field]?.length), passage);
    }
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.ok(formatFortunePrompt(input).includes(meaning), passage);
    const prompt = formatFortuneFactAudit(input);
    if (passage !== 'p123') assert.match(prompt, phrase, passage);
    assert.doesNotMatch(prompt, /(?:metaphysical|relocation)Direction(?:State|s)|\bp(?:118|122|123|126|150|158|177|209)\b/u);
  }
});

test('complete Mercury–Uranus quincunx admits the natal Mercury–Jupiter premise without a lunar series', () => {
  const run = submitLeoChart('leo-mercury-uranus-natal', '1967-02-27T12:00:00Z', 51.48, 0, 'Europe/London');
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p124-'));
  assert.equal(result.status, 'matched');
  const start = '2026-06-12T01:58:58.586Z';
  const witness = run.facts.find(({ activeFrom, factType, normalizedPayload: p }) => activeFrom === start && factType === 'leo_lunar_condition'
    && p.progressedBody === 'Mercury' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx' && p.targetKind === 'natal');
  assert.ok(witness?.completeness === 'complete' && result.sourceFactIds.includes(witness.factId));
  const { hasSameLayerAdverseSequence, hasNatalMercuryBroadStudyTestimony, natalMercuryBroadStudyContacts, mutualExactInSlice } = witness.normalizedPayload;
  assert.equal(hasSameLayerAdverseSequence, false);
  assert.equal(hasNatalMercuryBroadStudyTestimony, true);
  assert.equal(mutualExactInSlice, false);
  assert.deepEqual(natalMercuryBroadStudyContacts.map(({ first, second, aspect }) => [first, second, aspect]), [['Mercury', 'Jupiter', 'trine']]);
  assert.ok(result.windows.some(window => window.start <= start && witness.activeTo <= window.endExclusive));
  const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-uranus-natal-report'));
  const chosen = input.facts.find(fact => result.sourceFactIds.includes(references.get(fact.ref)) && fact.data.natalMercuryBroadStudyContacts?.length);
  assert.ok(chosen);
  assert.match(describeFortuneFact(chosen, String), /本命水星与本命木星为三分相[^；]+可供本条玄学研究分支参考/u);
  assert.doesNotMatch(formatFortuneFactAudit(input), /natalMercuryBroadStudyContacts|hasNatalMercuryBroadStudyTestimony|\bp124\b/u);
  const provider = formatFortunePrompt(input);
  assert.ok(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
  assert.doesNotMatch(provider, /本命水星与本命木星为三分相|natalMercuryBroadStudyContacts|hasNatalMercuryBroadStudyTestimony/u);
});

test('Mercury–Venus lunar support separates polarity, same-topic conflict and chart layer', () => {
  const band = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ progressedBody: body, natalTargetId: target, aspectType, start, end, targetKind, exactTimes: [] });
  const social = [band('Moon', 'Mars', 'square', 0, 10), band('Moon', 'Saturn', 'sextile', 2, 6),
    band('Moon', 'Venus', 'square', 4, 6), band('Moon', 'Jupiter', 'trine', 6, 8, 'progressed'),
    band('Sun', 'Jupiter', 'sextile', 8, 10)];
  const caution = [band('Moon', 'Neptune', 'trine', 0, 10), band('Moon', 'Mars', 'square', 0, 2),
    band('Moon', 'Mercury', 'square', 2, 4), band('Moon', 'Venus', 'opposition', 4, 6, 'progressed'),
    band('Moon', 'Venus', 'semisquare', 6, 8), band('Moon', 'Mercury', 'square', 8, 10), band('Moon', 'Mercury', 'trine', 8, 10)];
  for (const [passage, aspect, contacts, expected] of [
    ['p127', 'conjunction', social, [2]], ['p129', 'semisquare', caution, [2, 6]], ['p132', 'parallel', social, [2]],
  ]) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const base = band('Mercury', 'Venus', aspect, 0, 10);
    const rows = buildLeoLunarConditions([base, ...contacts]).filter(row => row.base === base);
    const facts = rows.map(({ start, sameLayerLunarState, friendshipDirectionState, correspondenceDirectionState }) => ({
      factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...rule.queries[0].where, start, sameLayerLunarState, friendshipDirectionState, correspondenceDirectionState },
    }));
    const result = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === rule.knowledgeId);
    const topical = rows.filter(row => passage === 'p129'
      ? row.sameLayerLunarState === 'all_adverse' || [row.friendshipDirectionState, row.correspondenceDirectionState].includes('adverse')
      : row.sameLayerLunarState === 'all_favourable' || row.friendshipDirectionState === 'favourable');
    assert.deepEqual(topical.map(row => row.start), expected, passage);
    assert.deepEqual(result.required[0].hits, [], passage);
  }
});

test('complete Mercury–Venus lunar charts keep topical evidence and reject unrelated contacts in SQLite', () => {
  const cases = [
    { passage: 'p127', birth: '1964-03-08', aspect: 'conjunction', start: '2026-12-27T00:03:32.585Z',
      witness: 'p188', nature: 'favourable', general: 'all_favourable',
      phrase: /交往与友谊议题的同期推运为次限月亮对本命土星的六合相，原书此项偏顺/u },
    { passage: 'p129', birth: '1964-02-02', aspect: 'semisquare', start: '2026-10-12T16:07:49.446Z',
      witness: 'p149', nature: 'adverse', general: 'all_adverse',
      phrase: /交往与友谊议题的同期推运为次限月亮对本命木星的四分相，原书此项偏难/u },
    { passage: 'p132', birth: '1963-01-01', aspect: 'parallel', start: '2026-06-20T05:45:27.576Z',
      witness: 'p220', nature: 'favourable', general: 'all_favourable',
      phrase: /交往与友谊议题的同期推运为次限月亮对本命金星的三分相，原书此项偏顺/u },
  ];
  for (const { passage, birth, aspect, start, witness, nature, general, phrase } of cases) {
    const run = submitLeoChart('leo-mercury-venus-topics', birth + 'T12:00:00Z', 51.48, 0, 'Europe/London');
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    if (passage === 'p132') assertAnnualMercuryParallel(run, result, 'Venus');
    else assertAnnualMutualObservation(run, result, 'Venus', aspect, 'not_matched', 'Mercury');
    const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition' && p.progressedBody === 'Mercury'
      && p.natalTargetId === 'Venus' && p.targetKind === 'natal' && p.aspectType === aspect);
    const actual = facts.find(({ activeFrom, normalizedPayload: p }) => activeFrom === start && p.sameLayerLunarState !== general
      && p.friendshipDirectionState === nature && p.friendshipDirections.some(direction => direction.passage === witness));
    assert.ok(actual?.completeness === 'complete' && !result.sourceFactIds.includes(actual.factId), passage);
    const excluded = facts.filter(({ normalizedPayload: p }) => p.hasOtherSameLayerLunarContacts && p.sameLayerLunarState !== general
      && p.friendshipDirectionState !== nature && p.correspondenceDirectionState !== nature);
    assert.ok(excluded.length && excluded.every(fact => !result.sourceFactIds.includes(fact.factId)), passage);
    assert.match(describeFortuneFact({ method: 'western', type: actual.factType, data: actual.normalizedPayload }, String), phrase, passage);
    if (passage === 'p127') {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-venus-topics-report'));
      assert.match(formatFortuneFactAudit(input), phrase, passage);
    }
    if (passage !== 'p132') continue;
    assert.ok(result.windows.some(window => window.start <= start && actual.activeTo <= window.endExclusive), passage);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-venus-topics-report'));
    assert.ok(input.facts.some(fact => facts.some(row => row.factId === references.get(fact.ref))
      && fact.data.friendshipDirections?.some(direction => direction.nature === nature)), passage);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase, passage);
    assert.doesNotMatch(prompt, /friendshipDirection(?:State|s)|\bp(?:127|129|132|149|188|220)\b/u);
  }
});

test('Mercury–Venus natal testimonies stay independent from the actual annual contact', () => {
  const cases = [
    { passage: 'p128', birth: '1963-11-09', aspect: 'semisextile', start: '2026-07-20T20:52:36.702Z',
      flags: [true, false], field: 'natalVenusArtTestimonies', contact: ['Venus', 'Jupiter', 'trine'], prose: /艺术或音乐相联/u },
    { passage: 'p128', birth: '1967-01-11', aspect: 'semisextile', start: '2026-01-01T00:00:00.000Z',
      flags: [false, true], field: 'natalDevotionalTestimonies', contact: ['Jupiter', 'Neptune', 'trine'], prose: /宗教或灵性兴趣相联/u },
    { passage: 'p128', birth: '1964-01-08', aspect: 'semisextile', start: '2026-08-03T10:04:45.535Z', flags: [false, false] },
    { passage: 'p130', birth: '1963-07-25', aspect: 'sextile', start: '2026-01-01T00:00:00.000Z',
      flags: [false, true], field: 'natalMercuryMentalTestimonies', contact: ['Mercury', 'Jupiter', 'trine'], prose: /写作、研究或思考相联/u },
    { passage: 'p130', birth: '1963-08-28', aspect: 'sextile', start: '2026-10-23T00:09:45.022Z', flags: [false, false] },
  ];
  for (const { passage, birth, aspect, start, flags, field, contact, prose } of cases) {
    const run = submitLeoChart('leo-mercury-venus-natal', birth + 'T12:00:00Z', 51.48, 0, 'Europe/London');
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    const base = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => activeFrom === start && factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Venus' && p.targetKind === 'natal' && p.aspectType === aspect);
    assert.equal(base?.completeness, 'complete', birth);
    const p = base.normalizedPayload;
    assert.deepEqual([p.hasNatalVenusArtTestimony,
      passage === 'p128' ? p.hasNatalDevotionalTestimony : p.hasNatalMercuryMentalTestimony], flags, birth);
    assertAnnualMutualObservation(run, result, 'Venus', aspect, 'not_matched', 'Mercury');
    if (!contact) {
      assert.deepEqual(result.sourceFactIds, [], birth);
      assert.deepEqual(result.windows, [], birth);
      continue;
    }
    assert.ok(p[field].some(({ first, second, aspect: angle }) => [first, second, angle].every((part, i) => part === contact[i])), birth);
    assert.ok(!result.sourceFactIds.includes(base.factId), birth);
    assert.deepEqual(result.windows, [], birth);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-venus-natal-report'));
    const chosen = input.facts.find(fact => references.get(fact.ref) === base.factId && fact.data[field]?.length);
    assert.ok(chosen, birth);
    assert.match(describeFortuneFact(chosen, String), prose, birth);
    assert.doesNotMatch(formatFortuneFactAudit(input), /natal(?:VenusArt|MercuryMental|Devotional)Testimon(?:ies|y)|\bp(?:128|130)\b/u);
  }
  for (const [birth, exactAt, devotional] of [
    ['1967-01-11', '2027-02-05T12:15:44.275Z', true],
    ['1964-01-08', '2027-02-11T09:17:14.583Z', false],
  ]) {
    const run = submitLeoChart('leo-mercury-venus-exact', birth + 'T12:00:00Z', 51.48, 0, 'Europe/London', undefined, 2027);
    const result = matchFortuneKnowledge(run).byMethod.western.find(({ knowledgeId }) => knowledgeId.includes('-p128-'));
    assertAnnualMutualObservation(run, result, 'Venus', 'semisextile', 'matched', 'Mercury');
    assert.ok(run.facts.some(fact => result.sourceFactIds.includes(fact.factId) && fact.exactInstant === exactAt), birth);
    assert.ok(run.facts.some(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Venus' && p.natalAspectProfile
      && p.hasNatalVenusArtTestimony === false && p.hasNatalDevotionalTestimony === devotional), birth);
    const report = interpretFortune(run, requestForFortuneRun(run), 'leo-mercury-venus-exact-report');
    const { input } = buildFortuneModelContext(run, report);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /若平日已有艺术或写作兴趣/u);
    assert.match(prompt, /其他情况下，可能只是短暂的小困扰/u);
    assert.doesNotMatch(prompt, /leo_mutual_exact_observation|natalDevotionalTestimonies/u);
  }
});

test('full natal charts keep the source-supported Mars intervals in the audit without an exact point', () => {
  for (const { passage, birth, year, target, aspect, windows, accepts, rejects, prose } of [
    { passage: 'p042', birth: '1962-07-28T12:00:00Z', year: 2004, target: 'Jupiter', aspect: 'trine',
      windows: [['2004-06-14T15:18:26.433Z', '2004-08-09T15:31:58.542Z']],
      accepts: p => p.speculationDirections.map(direction => direction.passage).sort().join(',') === 'p052,p210',
      rejects: p => p.sameLayerLunarState === 'all_favourable' && p.speculationLunarState === 'none' && p.speculationMajorState === 'favourable',
      prose: /投资与投机议题的同期推运为次限月亮对本命天王星的三分相/u },
    { passage: 'p058', birth: '1965-11-05T12:00:00Z', year: 2026, target: 'Saturn', aspect: 'semisextile',
      windows: [['2026-01-01T00:00:00.000Z', '2026-01-14T07:24:40.627Z'],
        ['2026-03-05T01:40:06.775Z', '2026-03-13T05:10:32.043Z'],
        ['2026-05-03T17:09:14.919Z', '2026-05-13T13:04:32.351Z']],
      accepts: p => p.sameLayerLunarState === 'all_favourable',
      rejects: p => p.sameLayerLunarState === 'mixed',
      prose: /次限月亮对本命这一层，已列的月亮相位均为偏顺/u },
  ]) {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(year, 5, 1), reference = { snapshotId: 'leo-mars-witnesses', chart: chart(Date.parse(birth)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-mars', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
    assertAnnualMutualObservation(run, result, target, aspect, 'not_matched');
    const relevant = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
    const matchedIds = new Set(result.sourceFactIds);
    const accepted = relevant.filter(fact => accepts(fact.normalizedPayload));
    assert.ok(accepted.length > 0 && accepted.every(fact => accepts(fact.normalizedPayload)), passage);
    const rejected = relevant.filter(fact => rejects(fact.normalizedPayload));
    assert.ok(rejected.length > 0 && rejected.every(fact => !matchedIds.has(fact.factId)), passage);
    for (const [start, end] of windows) {
      assert.ok(accepted.some(fact => fact.activeFrom === start), passage);
      assert.ok(accepted.some(fact => fact.activeTo === end), passage);
    }
    assert.ok(accepted.every(fact => windows.some(([start, end]) => start <= fact.activeFrom && fact.activeTo <= end)), passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-mars-report'));
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)), passage);
    const prompt = formatFortuneFactAudit(input);
    const evidence = passage === 'p058' ? describeFortuneFact({ method: 'western', type: accepted[0].factType,
      data: accepted[0].normalizedPayload }, String) : prompt;
    assert.match(evidence, prose, passage);
    assert.doesNotMatch(prompt, /speculation(?:Directions|LunarState|MajorState)|p052|p210/u);
  }
});

test('p044 and p066 confirm distinct same-chart Mars directions with real facts and time windows', () => {
  const samples = [
    { id: 'p044', birth: '1938-07-17', target: 'Jupiter', aspect: 'quincunx', key: 'mutualExactInSlice',
      at: '2026-11-08T04:03:34.794Z', condition: /火星与木星在同一张次限图实际形成梅花相/u },
    { id: 'p066', birth: '1939-09-15', target: 'Saturn', aspect: 'parallel', key: 'hasExactCleanMarsSaturnAdverseMoon',
      at: '2026-06-01T23:03:34.783Z', condition: /这两颗次限星的端点以外实际成相/u },
  ];
  const text = hit => (hit.matchedConditions ?? hit.confirmedBranches?.flatMap(branch => branch.conditions) ?? []).join(' ');
  const arc = (first, second) => Math.abs((first - second + 540) % 360 - 180);
  for (const sample of samples) {
    const { birthAt: birth, reference, run } = progressedPairRun2026(sample.birth);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === sample.target && p.aspectType === sample.aspect && p.targetKind === 'progressed');
    const witness = family.find(row => Math.abs(Date.parse(row.activeFrom) - Date.parse(sample.at)) < 1000
      && row.normalizedPayload[sample.key] === true);
    assert.ok(witness, sample.id);
    assert.equal(Date.parse(witness.activeTo) - Date.parse(witness.activeFrom), 1000);
    const epoch = Math.round(progressionEpoch(birth, Date.parse(witness.activeFrom)));
    const mars = readLeoMovingPosition('Mars', epoch), partner = readLeoMovingPosition(sample.target, epoch);
    if (sample.id === 'p044') {
      assert.ok(Math.abs(arc(mars.longitude, partner.longitude) - 150) < 0.00001);
      assert.equal(witness.normalizedPayload.natalMarsJupiterDominantBody, undefined);
    } else {
      assert.ok(leoParallelDifference(mars.declination, partner.declination) <= 1);
      const moon = readLeoMovingPosition('Moon', epoch);
      const natalSaturn = readLeoMovingPosition('Saturn', birth);
      assert.ok(Math.abs(arc(moon.longitude, natalSaturn.longitude) - 135) < 0.00001);
      assert.deepEqual(witness.normalizedPayload.exactCleanMarsSaturnAdverseMoon,
        { body: 'Moon', target: 'Saturn', targetKind: 'natal', aspectType: 'sesquiquadrate' });
      assert.equal(witness.normalizedPayload.marsSaturnNatalBalanceBasis, 'no-reviewed-mitigation');
    }
    const selected = { ...run, facts: [witness] };
    const read = input => matchFortuneKnowledge(input).byMethod.western.find(row => row.knowledgeId.includes('-' + sample.id + '-'));
    const hit = read(selected);
    assert.equal(hit.status, 'matched', sample.id);
    assert.match(text(hit), sample.condition);
    assert.deepEqual(hit.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    const next = family.find(row => row.activeFrom === witness.activeTo);
    assert.ok(next, sample.id);
    assert.doesNotMatch(text(read({ ...run, facts: [next] })), sample.condition);
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), reference.snapshotId));
    assert.match(formatFortunePrompt(input), sample.condition);
    assert.doesNotMatch(formatFortunePrompt(input), /mutualExactInSlice|exactCleanMarsSaturnAdverseMoon/u);
    if (sample.id === 'p044') {
      const other = family.find(row => row.activeFrom === '2026-03-01T20:58:49.797Z'
        && row.normalizedPayload.hasExactCleanMarsJupiterOtherAdverseMoon === true);
      assert.ok(other);
      const condition = /同期另有已核偏难月相的实际真点/u;
      assert.match(text(read({ ...run, facts: [other] })), condition);
      const near = family.find(row => row.activeFrom === other.activeTo);
      assert.ok(near);
      assert.doesNotMatch(text(read({ ...run, facts: [near] })), condition);
    }
  }
});

test('full natal Mars charts distinguish angular prominence, adverse timing and an independent domicile exchange', () => {
  const runFor = (birth, year, armc) => {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(year, 5, 1), reference = { snapshotId: 'leo-mars-natal-pairs', chart: chart(Date.parse(birth), armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-mars-natal', reference);
  };
  const match = (run, passage) => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
  const watch = (run, target, aspect) => run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Mars' && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
  const prose = run => formatFortuneFactAudit(buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), 'leo-natal-pairs-report')).input);

  const natal = '1968-01-01T12:00:00Z';
  const jupiter = runFor(natal, 2022, 147), jupiterRule = match(jupiter, 'p044');
  assert.equal(jupiterRule.status, 'matched');
  const jupiterWitness = watch(jupiter, 'Jupiter', 'quincunx').find(f => f.normalizedPayload.natalMarsJupiterProminentBody === 'Jupiter'
    && f.normalizedPayload.sameLayerLunarState === 'none' && jupiterRule.candidateWindows?.some(window =>
      window.start <= f.activeFrom && f.activeTo <= window.endExclusive));
  assert.deepEqual([jupiterWitness?.normalizedPayload.natalMarsJupiterProminence.first.house,
    jupiterWitness?.normalizedPayload.natalMarsJupiterProminence.second.house], [3, 10]);
  assert.match(prose(jupiter), /按Leo与Green的本命角宫比较，木星较显著/u);

  const differentLocation = runFor(natal, 2022, 316);
  const exactOnly = match(differentLocation, 'p044');
  assert.equal(exactOnly.status, 'matched');
  assert.deepEqual(exactOnly.sourceFactIds, watch(differentLocation, 'Jupiter', 'quincunx')
    .filter(({ normalizedPayload: p }) => p.mutualExactInSlice).map(fact => fact.factId));
  assert.ok(watch(differentLocation, 'Jupiter', 'quincunx').some(({ normalizedPayload: p }) =>
    p.natalMarsJupiterProminentBody === 'Mars' && p.directionSupportState === 'favourable'));

  const mars = runFor('1965-06-22T12:00:00Z', 2044, 167), marsRule = match(mars, 'p044');
  const marsWitness = watch(mars, 'Jupiter', 'quincunx').find(f => f.normalizedPayload.natalMarsJupiterProminentBody === 'Mars'
    && f.normalizedPayload.sameLayerLunarState !== 'all_adverse' && f.normalizedPayload.directionSupportState === 'adverse'
    && (marsRule.candidateWindows ?? marsRule.windows).some(window => window.start <= f.activeFrom && f.activeTo <= window.endExclusive));
  assert.ok(marsWitness?.normalizedPayload.supportingDirections.some(direction => direction.passage === 'p275'));

  const saturn = runFor(natal, 2014, 0), saturnRule = match(saturn, 'p066');
  assert.equal(saturnRule.status, 'matched');
  assert.ok(saturnRule.windows.length > 0);
  const exchange = watch(saturn, 'Saturn', 'parallel').find(f =>
    saturnRule.sourceFactIds.includes(f.factId) && f.normalizedPayload.sameLayerLunarState === 'all_adverse');
  assert.ok(exchange);
  assert.deepEqual(exchange.normalizedPayload.natalMutualDomicileSigns, [10, 0]);
  assert.deepEqual(exchange.normalizedPayload.natalPairAspectTypes, ['semisquare']);
  assert.equal(exchange.normalizedPayload.marsSaturnNatalBalanceBasis, 'domicile-exchange');
  assert.equal(exchange.normalizedPayload.hasMarsSaturnAdverseLunarActivation, true);
  const prompt = prose(saturn);
  assert.match(prompt, /本命火星在土星守护的水瓶座，本命土星在火星守护的白羊座/u);
  assert.match(prompt, /在原书一度范围内，火土赤纬平行的背景仍保留/u);
  assert.match(prompt, /本命缓和仅限制偏难读法/u);
  assert.doesNotMatch(prompt, /natalMutualDomicile|leo-natal-mars/u);
  const { input } = buildFortuneModelContext(saturn, interpretFortune(saturn, requestForFortuneRun(saturn), 'leo-natal-exchange'));
  const modelText = formatFortunePrompt(input);
  assert.match(modelText, /本命两星同时落在彼此守护的星座/u);
  const lunarPoints = saturnRule.confirmedBranches.find(branch => branch.conditions.some(line => line.includes('与另一已核位置实际形成')));
  assert.equal(lunarPoints.windows.length, 2);
  assert.ok(lunarPoints.windows.every(row => Date.parse(row.endExclusive) - Date.parse(row.start) === 1_000));
  assert.ok(lunarPoints.sourceFactIds.every(id => saturn.facts.some(fact => fact.factId === id
    && fact.normalizedPayload.targetKind === 'natal' && fact.normalizedPayload.hasExactCleanMarsSaturnAdverseMoon === true)));
  const movingOnly = match({ ...saturn, facts: saturn.facts.filter(fact => fact.factType === 'leo_lunar_condition'
    && fact.normalizedPayload.targetKind === 'progressed' && fact.normalizedPayload.marsSaturnParallelBandObserved === true) }, 'p066');
  assert.match(movingOnly.matchedSourceExcerpt, /mutual disposition/u);
  assert.doesNotMatch(movingOnly.matchedSourceExcerpt, /the lunar directions are evil/u);
  assert.match(modelText, /本命缓和与个人实际反应仍须分别考虑/u);
  assert.doesNotMatch(modelText, /按原文将本命和谐相作为缓和依据|natalMutualDomicileExchange/u);
});

test('Mars–Uranus ability contacts keep the natal conjunction in the same sign', () => {
  for (const [birth, reference, sameSign] of [
    ['1962-08-06T12:00:00Z', '2027-08-06T12:00:00Z', true],
    ['1962-08-10T12:00:00Z', '2024-08-10T12:00:00Z', false],
  ]) {
    const at = Date.parse(reference), window = { start: at - day / 2, end: at + day / 2 };
    const input = chart(Date.parse(birth));
    const source = buildLeoSourceContext(window, input, buildWesternProgressions(window, at, input));
    assert.equal(source.status, 'ready');
    const mercury = source.natalContext.bodies.find(row => row.body === 'Mercury');
    const uranus = source.natalContext.bodies.find(row => row.body === 'Uranus');
    assert.equal(mercury.sign === uranus.sign, sameSign);
    assert.ok(readLeoNatalAspectContacts([mercury, uranus]).some(row => row.aspect === 'conjunction'));
    const band = source.intervals.find(row => row.progressedBody === 'Mars' && row.natalTargetId === 'Uranus'
      && row.targetKind === 'natal' && row.aspectType === 'semisextile');
    assert.ok(band);
    assert.equal(band.natalAbilityContacts.some(row => row.ability === 'inventiveness' && row.aspect === 'conjunction'), sameSign);
  }
});

test('complete Mars–Uranus charts reach SQLite through named natal abilities or the originally weak affliction', () => {
  const runFor = (birth, year) => {
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(year, 5, 15), reference = { snapshotId: 'leo-mars-uranus', chart: chart(Date.parse(birth)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-mars-uranus', reference);
  };
  const matching = (run, passage) => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + passage + '-'));
  const promptFor = run => formatFortuneFactAudit(buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), 'leo-mars-uranus-report')).input);
  const cases = [
    { id: 'p068', birth: '1965-05-17T12:00:00Z', year: 2027, aspect: 'semisextile', target: 'Uranus', ability: 'inventiveness',
      witnessAspect: 'trine', phrase: /本命水星与本命天王星为三分相[^。]*发明和原创研究倾向/u },
    { id: 'p068', birth: '1965-05-19T12:00:00Z', year: 2025, aspect: 'semisextile', target: 'Mars', ability: 'engineering',
      witnessAspect: 'trine', phrase: /本命水星与本命火星为三分相[^。]*机械及工程倾向/u },
    { id: 'p070', birth: '1965-07-12T12:00:00Z', year: 2023, aspect: 'sextile', target: 'Jupiter', ability: 'writing-and-judgment',
      witnessAspect: 'sextile', phrase: /本命水星与本命木星为六合相[^。]*写作与判断倾向/u },
  ];
  for (const { id, birth, year, aspect, target, ability, witnessAspect, phrase } of cases) {
    const run = runFor(birth, year), result = matching(run, id);
    assertAnnualMutualObservation(run, result, 'Uranus', aspect, id === 'p068' ? 'not_matched' : 'matched');
    const first = run.facts.find(fact => {
      const p = fact.normalizedPayload;
      return fact.factType === 'leo_lunar_condition' && p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus'
        && p.targetKind === 'natal' && p.aspectType === aspect && p.natalAbilityTypes?.includes(ability)
        && p.sameLayerLunarState !== 'all_favourable' && (id === 'p068' || (p.natalFavourableBodies.length < 2
          && !p.hasSameLayerFavourableContact && !['favourable', 'mixed'].includes(p.directionSupportState)));
    });
    assert.ok(first, id);
    const witness = first.normalizedPayload.natalAbilityContacts.find(row => row.ability === ability);
    assert.deepEqual([witness?.first, witness?.second, witness?.aspect], ['Mercury', target, witnessAspect]);
    const query = evaluateFortuneRules('western', 'year', [first]).find(row => row.knowledgeId === result.knowledgeId).required[0];
    assert.deepEqual(query.hits, []);
    const prose = describeFortuneFact({ method: 'western', type: first.factType, data: first.normalizedPayload }, String);
    assert.match(prose, phrase);
    assert.doesNotMatch(prose, /natalAbility(?:Contacts|Types)|writing-and-judgment/u);
  }

  const weak = runFor('1979-02-27T00:00:00Z', 2026), weakResult = matching(weak, 'p073');
  assertAnnualMutualObservation(weak, weakResult, 'Uranus', 'sesquiquadrate', 'not_matched');
  const isMarsUranusBand = ({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
    && p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'sesquiquadrate';
  const witness = weak.facts.find(isMarsUranusBand);
  assert.equal(witness.normalizedPayload.natalMarsUranusAfflictionFocus, 'Mars');
  assert.deepEqual(witness.normalizedPayload.natalAfflictionContacts.map(row => [row.first, row.second, row.aspect, row.orb]),
    [['Mars', 'Jupiter', 'quincunx', 2]]);
  assert.match(promptFor(weak), /本命火星与本命木星为梅花相[^。]*。这次核到的是本命火星端受克/u);
  const unrelated = runFor('1979-06-20T00:00:00Z', 2032);
  const natal = unrelated.facts.find(fact => fact.factType === 'leo_natal_context').normalizedPayload;
  assert.ok(readLeoNatalAspectContacts(natal.bodies).some(row => row.first === 'Mercury' && row.second === 'Neptune' && row.aspect === 'quincunx'));
  assertAnnualMutualObservation(unrelated, matching(unrelated, 'p073'), 'Uranus', 'sesquiquadrate', 'matched');
  assert.ok(unrelated.facts.some(fact => isMarsUranusBand(fact) && fact.normalizedPayload.natalAfflictionContacts.length === 0));
});

test('Mercury–Neptune lunar assistance requires the right endpoint and an explicit favourable classification', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p098-'));
  const base = { ...rule.queries[0].where, start: 0, end: 9, exactTimes: [] };
  const moon = (start, end, targetKind, natalTargetId) =>
    ({ start, end, targetKind, progressedBody: 'Moon', natalTargetId, aspectType: 'trine', exactTimes: [] });
  const rows = buildLeoLunarConditions([base, moon(0, 3, 'natal', 'Neptune'),
    moon(3, 6, 'natal', 'Mercury'), moon(6, 9, 'progressed', 'Mercury')]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => row.hasFavourableLunarLink), [false, false, true]);
  assert.deepEqual(rows.map(row => row.mercuryNeptuneLunarSupportState), ['all_favourable', 'none', 'all_favourable']);
  const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...base, hasFavourableLunarLink: row.hasFavourableLunarLink } }));
  const selected = evaluateFortuneRules('western', rule.period, facts).find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
  assert.deepEqual(selected, [facts[2]]);
});

test('solar and lunar source rules reach their new premises using real ephemeris intervals', () => {
  const at = Date.parse('2026-06-15T00:00:00Z');
  const year = { start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z') };
  const favourable = row => row.sameLayerLunarState === 'all_favourable' || row.directionSupportState === 'favourable';
  const otherMoon = row => row.hasOtherSameLayerLunarContacts;
  const cases = [
    ['p098', '1965-09-20', 'Mercury', 'Neptune', 'semisextile', row => row.hasFavourableLunarLink || row.base.mercuryBehindNeptune
      || [1, 4, 7, 10].includes(row.base.natalTargetHouse) || row.base.natalNeptuneClosestToMidheaven
      || row.base.natalNeptuneBeforeAngularCusp || row.base.natalMercuryDomicileAngular],
    ['p116', '1965-01-21', 'Mercury', 'Saturn', 'parallel', favourable],
    ['p220', '1962-02-04', 'Moon', 'Venus', 'trine', row => row.monthlyThemeEvidence?.hasExact],
    ['p244', '1965-01-03', 'Sun', 'Mars', 'parallel', otherMoon],
    ['p260', '1965-07-10', 'Sun', 'Neptune', 'sextile', favourable],
  ];
  for (const [id, date, body, target, aspect, accepts] of cases) {
    const birthTime = id === 'p220' ? 'T04:00:00Z' : 'T00:00:00Z';
    const snapshot = chart(Date.parse(date + birthTime));
    const context = buildLeoSourceContext(year, snapshot, buildWesternProgressions(year, at, snapshot), true);
    const rows = buildLeoLunarConditions([...context.intervals, ...context.progressedPairs])
      .filter(({ base }) => base.progressedBody === body && base.natalTargetId === target && base.aspectType === aspect && base.targetKind === 'natal');
    const facts = rows.map(({ base, ...lunar }) => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...lunar, lunarProfile: leoLunarConditionPolicy.profile,
        monthlyLunarProfile: lunar.monthlyThemeEvidence && leoLunarConditionPolicy.monthlyTheme,
        monthlyLunarHasExact: lunar.monthlyThemeEvidence?.hasExact,
        monthlyLunarMajorState: lunar.monthlyThemeEvidence?.majorState } }));
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + id + '-'));
    const expected = facts.filter((_, index) => accepts(rows[index]));
    assert.ok(expected.length, id);
    const result = evaluateFortuneRules('western', rule.period, facts).find(row => row.knowledgeId === rule.knowledgeId);
    assert.deepEqual(result.required[0].hits, ['p116', 'p260'].includes(id) ? [] : id === 'p244' ? facts : expected, id);
    if (id === 'p220') assert.ok(expected.some(({ normalizedPayload }) => normalizedPayload.monthlyLunarQualification === 'strengthened'));
  }
});

test('real natal Neptune and Uranus premises use the named natal participant even for same-chart direction facts', () => {
  const year = { start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z') };
  const at = Date.parse('2026-06-15T00:00:00Z');
  for (const [id, date, planet, aspect] of [
    ['p257', '1965-09-09', 'Neptune', 'conjunction'], ['p284', '1965-12-09', 'Uranus', 'quincunx'],
  ]) {
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'), id === 'p257' ? 120 : 0);
    const context = buildLeoSourceContext(year, snapshot, buildWesternProgressions(year, at, snapshot), true);
    const band = context.intervals.find(row => row.progressedBody === 'Sun' && row.natalTargetId === planet && row.aspectType === aspect);
    assert.ok(band, id);
    assert.ok(band.natalMajorAspectContacts.some(record => [record.first, record.second].includes(planet)
      && (id === 'p257' || ['square', 'opposition'].includes(record.aspect))));
    const base = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete' };
    const evaluate = payload => evaluateFortuneRules('western', 'year', [{ ...base, normalizedPayload: payload }])
      .find(rule => rule.knowledgeId.includes('-leo-1906-interpretation-' + id + '-')).required[0];
    if (id === 'p284') {
      assert.ok(band.natalSquareOppositionBodies.includes('Uranus'));
      assert.deepEqual(evaluate(band).hits, []);
      assert.equal(evaluate(band).unknown, true);
      continue;
    }
    assert.equal(band.natalTargetHouse, 1);
    assert.equal(band.solarNeptuneNatalEvidenceState, 'qualified');
    assert.deepEqual(evaluate(band).hits, []);
    assert.equal(evaluate(band).unknown, true);
  }
});

test('client submissions reach source sign, zodiac order and named natal premises in SQLite', () => {
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    { id: '047', date: '1970-11-28', type: 'leo_progressed_aspect', witness: p => p.conjunctionSign === 8,
      contradict: { conjunctionSign: 'split' }, phrase: /次限火星和本命海王星均位于射手座/u },
    { id: '067', date: '1965-03-14', type: 'leo_progressed_aspect',
      witness: p => p.natalPairAspects.some(aspect => aspect.aspect === 'conjunction'), phrase: /本命火星和本命天王星.*另有合相/u },
    { id: '098', date: '1940-06-01', type: 'leo_lunar_condition',
      witness: p => p.mercuryBehindNeptune && p.mercuryNeptuneOffset < -29 && !p.hasFavourableLunarLink,
      contradict: { mercuryBehindNeptune: false, natalTargetHouse: 5 }, phrase: /次限水星在本命海王星的后方/u },
    { id: '106', date: '1940-06-16', type: 'leo_progressed_aspect',
      witness: p => p.natalMajorAspectContacts.some(aspect => [aspect.first, aspect.second].includes('Neptune') && aspect.aspect === 'square'),
      contradict: { natalSquareOppositionBodies: ['Mercury'], hasNatalNeptuneArtContact: false, natalTargetHouse: 5 },
      phrase: /本命太阳与本命海王星为四分相/u },
  ];
  for (const { id, date, type, witness, contradict, phrase } of cases) {
    const ref = { snapshotId: 'leo-positional-rule-' + id };
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...ref, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), 'leo-positions', ref);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '067') {
      assertAnnualMutualObservation(run, match, 'Uranus', 'conjunction', 'not_matched');
      const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === type && p.progressedBody === 'Mars'
        && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'conjunction' && witness(p));
      assert.ok(fact);
      assert.match(describeFortuneFact({ method: 'western', type, data: fact.normalizedPayload }, String), phrase);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), ref.snapshotId));
      assert.match(formatFortuneFactAudit(input), phrase);
      continue;
    }
    assert.equal(match.status, 'partial', id);
    const fact = run.facts.find(row => match.sourceFactIds.includes(row.factId) && row.factType === type && witness(row.normalizedPayload));
    assert.ok(fact, id);
    assert.match(describeFortuneFact({ method: 'western', type, data: fact.normalizedPayload }, String), phrase, id);
    const counterexample = { ...fact, normalizedPayload: { ...fact.normalizedPayload, ...contradict } };
    const result = evaluateFortuneRules('western', 'year', [counterexample]).find(row => row.knowledgeId === match.knowledgeId).required[0];
    assert.equal(result.hits.length, 0, id);
    assert.equal(result.unknown, false, id);
    if (id === '047') {
      const earlier = run.facts.find(row => row.factType === type && row.normalizedPayload.conjunctionSign === 'split'
        && row.activeTo === fact.activeFrom);
      assert.ok(earlier);
      assert.ok(!match.sourceFactIds.includes(earlier.factId));
      for (const [row, sign] of [[earlier, 7], [fact, 8]]) {
        const sample = (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2;
        const epoch = progressionEpoch(Date.parse(date + 'T00:00:00Z'), sample);
        assert.equal(Math.floor(Ecliptic(GeoVector(Body.Mars, new Date(epoch), true)).elon / 30), sign);
      }
    }
  }
});

test('referenced and concurrent premises match real client facts through SQLite without substituting the cited aspect', () => {
  const now = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    { id: '063', date: '1965-06-23', aspect: 'sesquiquadrate',
      witness: p => p.luminaryLinks?.some(link => link.body === 'Sun' && link.target === 'Mars' && link.targetKind === 'progressed'),
      absent: { luminaryLinkedBodies: [] }, citedAspect: 'semisquare', phrase: /同段次限太阳照到这对星的次限火星/u },
    { id: '132', date: '1965-03-13', aspect: 'parallel',
      witness: p => p.coordinate === 'equatorial_declination_of_date' && p.allowedOrb === 1
        && (p.sameLayerLunarState === 'all_favourable' || p.friendshipDirectionState === 'favourable'),
      citedAspect: 'conjunction', phrase: /次限水星对本命金星的赤纬绝对值平行/u },
    { id: '212', date: '1965-01-04', month: 1, aspect: 'quincunx',
      witness: p => p.targetKind === 'natal' && p.hasSameLayerFavourableContact && p.hasSameLayerAdverseContact
        && p.supportingDirections?.some(direction => direction.targetKind === 'natal' && direction.nature === 'favourable'),
      absent: { hasSameLayerFavourableContact: false, hasSameLayerAdverseContact: false, directionSupportState: 'none' },
      phrase: /偏顺和偏难的月亮相位同时出现/u },
     { id: '263', date: '1965-01-23', aspect: 'sesquiquadrate',
      witness: p => p.natalMajorAspectContacts?.some(row => [row.first, row.second].includes('Neptune')
        && ['square', 'opposition'].includes(row.aspect)),
       citedAspect: 'semisquare', phrase: /本命海王星/u },
    { id: '266', date: '1965-06-09', armc: 30, aspect: 'parallel', bothLayers: true,
      witness: p => p.natalTargetHouse === 4 && p.natalSextileTrineBodies?.includes('Neptune')
        && !p.natalSquareOppositionBodies?.includes('Neptune') && p.sameHemisphere === false,
      absent: { hasNatalTargetAspect: false },
      citedAspect: 'conjunction', phrase: /不要求南北同向/u },
  ];
  for (const { id, date, armc, month, aspect, bothLayers, witness, absent, citedAspect, phrase } of cases) {
    const parameters = { periodType: month ? 'month' : 'year', targetPeriod: month ? { year: 2026, month } : { year: 2026 },
      displayTimezone: 'Asia/Shanghai' };
    const ref = { snapshotId: 'leo-referenced-' + id };
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'), armc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...ref, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), 'leo-referenced-rules', ref);
    const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '212') {
      const context = run.facts.find(row => row.factType === 'leo_lunar_condition' && row.normalizedPayload.aspectType === aspect
        && row.normalizedPayload.progressedBody === 'Moon' && row.normalizedPayload.natalTargetId === 'Uranus'
        && witness(row.normalizedPayload));
      assert.ok(context, id);
      assert.equal(context.normalizedPayload.monthlyLunarHasExact, false, id);
      assert.match(describeFortuneFact({ method: 'western', type: context.factType, data: context.normalizedPayload }, String), phrase, id);
      assert.equal(match.status, 'not_matched', id);
      continue;
    }
    if (id === '132') {
      assertAnnualMercuryParallel(run, match, 'Venus');
      const actual = run.facts.find(row => row.factType === 'leo_lunar_condition' && row.normalizedPayload.progressedBody === 'Mercury'
        && row.normalizedPayload.natalTargetId === 'Venus' && row.normalizedPayload.targetKind === 'natal'
        && row.normalizedPayload.aspectType === 'parallel' && witness(row.normalizedPayload));
      assert.ok(actual && !match.sourceFactIds.includes(actual.factId), id);
      assert.match(describeFortuneFact({ method: 'western', type: actual.factType, data: actual.normalizedPayload }, String), phrase, id);
      const band = run.facts.find(row => match.sourceFactIds.includes(row.factId));
      const wrongGeometry = { ...band, normalizedPayload: { ...band.normalizedPayload, aspectType: citedAspect } };
      const required = evaluateFortuneRules('western', parameters.periodType, [actual, band, wrongGeometry])
        .find(row => row.knowledgeId === match.knowledgeId).required[0];
      assert.deepEqual(required.hits, [band], id);
      continue;
    }
    if (id === '263') {
      assert.equal(match.status, 'matched');
      const observations = run.facts.filter(row => match.sourceFactIds.includes(row.factId));
      assert.ok(observations.length && observations.every(row => row.factType === 'leo_solar_phase' && row.normalizedPayload.aspectType === aspect));
      const witnessBands = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
        && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === aspect && witness(p));
      assert.deepEqual([...new Set(witnessBands.map(row => row.normalizedPayload.targetKind))].sort(), ['natal', 'progressed']);
      for (const fact of witnessBands) assert.match(describeFortuneFact({ method: 'western', type: fact.factType,
        data: fact.normalizedPayload }, String), phrase);
      const sample = observations[0];
      const cited = { ...sample, normalizedPayload: { ...sample.normalizedPayload, aspectType: citedAspect } };
      const required = evaluateFortuneRules('western', parameters.periodType, [sample, cited, ...witnessBands])
        .find(row => row.knowledgeId === match.knowledgeId).required[0];
      assert.deepEqual(required.hits, [sample]);
      continue;
    }
    assert.equal(match.status, 'partial', id);
    const matched = run.facts.filter(row => match.sourceFactIds.includes(row.factId));
    assert.ok(matched.every(row => row.normalizedPayload.aspectType === aspect), id);
    const witnesses = matched.filter(row => witness(row.normalizedPayload));
    assert.ok(witnesses.length, id);
    if (bothLayers) assert.deepEqual([...new Set(witnesses.map(row => row.normalizedPayload.targetKind))].sort(), ['natal', 'progressed'], id);
    const [fact] = witnesses;
    assert.match(describeFortuneFact({ method: 'western', type: fact.factType, data: fact.normalizedPayload }, String), phrase, id);
    const evaluate = override => evaluateFortuneRules('western', parameters.periodType,
      [{ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...override } }])
      .find(row => row.knowledgeId === match.knowledgeId).required[0];
    const rejected = evaluate(absent);
    assert.equal(rejected.hits.length, 0, id);
    assert.equal(rejected.unknown, false, id);
    const missing = evaluate(Object.fromEntries(Object.keys(absent).map(key => [key, undefined])));
    assert.equal(missing.hits.length, 0, id);
    assert.equal(missing.unknown, true, id);
    if (citedAspect) assert.equal(evaluate({ aspectType: citedAspect }).hits.length, 0, id);
    if (id === '266') {
      assert.equal(evaluate({ natalBodyHouse: 4, natalTargetHouse: 5 }).hits.length, 0);
      assert.equal(evaluate({ natalTargetHouse: undefined }).unknown, true);
      const report = interpretFortune(run, requestForFortuneRun(run), 'leo-referenced-report');
      const { references } = buildFortuneModelContext(run, report);
      assert.ok([...references.values()].some(factId => witnesses.some(row => row.factId === factId)));
    }
  }
});

test('Mars–Saturn endpoint testimony excludes the wrong chart identity and clips to the true overlap', () => {
  const band = (body, target, targetKind, aspectType, start, end) => ({ progressedBody: body, natalTargetId: target,
    targetKind, aspectType, start, end, exactTimes: [] });
  const base = band('Mars', 'Saturn', 'natal', 'sesquiquadrate', 1, 10);
  const rows = buildLeoLunarConditions([base,
    band('Moon', 'Mars', 'natal', 'trine', 1, 3),
    band('Sun', 'Saturn', 'progressed', 'trine', 3, 6),
    band('Sun', 'Mars', 'progressed', 'trine', 5, 7),
    band('Moon', 'Saturn', 'natal', 'trine', 8, 12),
  ]).filter(row => row.base === base && row.luminaryLinks.length > 0);
  assert.deepEqual(rows.map(({ start, end, luminaryLinks }) => [start, end,
    luminaryLinks.map(({ body, target, targetKind }) => [body, target, targetKind])]), [
    [5, 7, [['Sun', 'Mars', 'progressed']]], [8, 10, [['Moon', 'Saturn', 'natal']]],
  ]);
});

function leoBandForExactObservation(run, observation) {
  const band = run.facts.find(fact => fact.factType === 'leo_progressed_aspect'
    && fact.parentSignalId === observation.parentSignalId
    && fact.activeFrom <= observation.exactInstant && observation.exactInstant < fact.activeTo);
  assert.ok(band);
  return band;
}

test('actual client facts supply the named natal house rulers and the two solar chart layers through SQLite', () => {
  const now = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    { id: '105', date: '1964-03-31', armc: 180, factType: 'leo_progressed_aspect', field: 'natalFirstRuledHouseCount',
      wrong: { natalFirstRuledHouseCount: -1, natalBodyHouse: 5, natalTargetHouse: 6 },
      check: p => {
        assert.deepEqual(p.natalFirstRuledHouseNumbers, [6]);
        assert.equal(p.rulership.cuspRulers[5].ruler, 'Mercury');
        assert.equal(p.rulership.second.ruledHouses, undefined);
      }, phrase: /水星的本命星座.*该星掌第6宫/u },
    { id: '196', date: '1964-07-04', month: 6, factType: 'leo_lunar_exact_observation', field: 'observed',
      layers: ['natal'], wrong: { natalFavourableBodies: ['Venus'], natalAfflictedBodies: ['Venus'] },
      check: p => assert.ok(p.natalMajorAspectContacts.some(contact => ['sextile', 'trine'].includes(contact.aspect)
        && [contact.first, contact.second].some(body => ['Sun', 'Moon'].includes(body)))), phrase: /同作者1928年本命参考外限/u },
    { id: '204', date: '1964-01-05', month: 6, factType: 'leo_lunar_condition', field: 'hasNatalSolarTestimony',
      wrong: { hasNatalSolarTestimony: false },
      check: p => {
        assert.equal(p.hasOtherSameLayerLunarContacts, true);
        assert.ok(p.natalSolarContacts.length && p.natalSolarContacts.every(contact => [contact.first, contact.second].includes('Sun')));
        assert.ok(p.progressedSolarContacts.some(contact => contact.body === 'Sun' && contact.targetKind === 'progressed'
          && contact.target === 'Neptune' && contact.aspectType === 'trine'));
      }, phrase: /同一有效段另查到次限太阳对同图次限海王星的三分相/u },
    { id: '300', date: '1964-09-21', armc: 45, factType: 'leo_progressed_aspect', field: 'natalPairRuledHouseNumbers',
      wrong: { natalPairRuledHouseNumbers: [4, 8], natalBodyHouse: 5 },
      check: p => {
        assert.deepEqual(p.natalPairRuledHouseNumbers, [3, 5, 8, 10]);
        for (const i of [4, 7]) assert.ok(['Venus', 'Jupiter'].includes(p.rulership.cuspRulers[i].ruler));
      }, phrase: /该星掌第[\d、与和]+宫/u },
  ];
  for (const { id, date, month, armc, factType, field, layers, wrong, check, phrase } of cases) {
    const parameters = { periodType: month ? 'month' : 'year', targetPeriod: month ? { year: 2026, month } : { year: 2026 },
      displayTimezone: 'Asia/Shanghai' };
    const ref = { snapshotId: 'leo-solar-rulers-' + id };
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'), armc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...ref, chart: snapshot })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), 'leo-solar-rulers', ref);
    const matched = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p' + id + '-'));
    if (id === '105' || id === '204') {
      assert.equal(matched.status, 'matched', id);
      const isExpectedBand = ({ factType: type, normalizedPayload: payload }) => type === factType
        && (id === '105'
          ? payload.progressedBody === 'Mercury' && payload.natalTargetId === 'Neptune' && payload.aspectType === 'opposition' && payload.targetKind === 'natal'
          : payload.progressedBody === 'Moon' && payload.natalTargetId === 'Sun' && payload.aspectType === 'parallel'
            && payload.hasNatalSolarTestimony && payload.hasProgressedSolarTestimony && payload.hasOtherSameLayerLunarContacts);
      const bands = run.facts.filter(isExpectedBand);
      assert.ok(bands.length, id);
      check(bands[0].normalizedPayload);
      const report = interpretFortune(run, requestForFortuneRun(run), 'leo-solar-rulers-audit');
      const { input } = buildFortuneModelContext(run, report);
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, phrase, id);
      if (id === '204') assert.match(audit, /出生盘太阳在同作者参考外限内的相位/u);
      continue;
    }
    if (id === '300') {
      assertAnnualMutualObservation(run, matched, 'Jupiter', 'quincunx', 'matched', 'Venus');
      const band = run.facts.find(({ factType: type, normalizedPayload: p }) => type === factType
        && p.progressedBody === 'Venus' && p.natalTargetId === 'Jupiter' && p.aspectType === 'quincunx'
        && p.targetKind === 'natal' && p[field]?.includes(5));
      assert.ok(band && !matched.sourceFactIds.includes(band.factId));
      check(band.normalizedPayload);
      assert.match(describeFortuneFact({ method: 'western', type: band.factType, data: band.normalizedPayload }, String), phrase);
      continue;
    }
    const exactLunar = id === '196';
    assert.equal(matched.status, exactLunar ? 'matched' : 'partial', id);
    const facts = run.facts.filter(fact => fact.factType === factType && matched.sourceFactIds.includes(fact.factId));
    assert.ok(facts.length, id);
    if (layers) assert.deepEqual([...new Set(facts.map(fact => fact.normalizedPayload.targetKind))].sort(), layers, id);
    if (exactLunar) {
      const nearBands = run.facts.filter(({ factType: type, normalizedPayload: p }) => type === 'leo_progressed_aspect'
        && p.progressedBody === 'Moon' && p.natalTargetId === 'Sun' && p.aspectType === 'semisextile');
      assert.deepEqual([...new Set(nearBands.map(fact => fact.normalizedPayload.targetKind))].sort(), ['natal', 'progressed']);
    }
    const bands = exactLunar ? facts.map(fact => leoBandForExactObservation(run, fact)) : facts;
    for (const band of bands) check(band.normalizedPayload);
    const [fact] = facts, [band] = bands;
    assert.match(describeFortuneFact({ method: 'western', type: band.factType, data: band.normalizedPayload }, String), phrase, id);
    const evaluate = override => evaluateFortuneRules('western', parameters.periodType,
      [{ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...override } }])
      .find(row => row.knowledgeId === matched.knowledgeId).required[0];
    const absent = evaluate(wrong);
    assert.deepEqual([absent.hits.length, absent.unknown], [exactLunar ? 1 : 0, false], id);
    const unknown = evaluate({ [field]: undefined });
    assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true], id);
  }
});

test('both solar chart premises and another lunar contact overlap without reusing the reciprocal parallel', () => {
  const rule = fortuneKnowledge.western.rules.find(r => r.knowledgeId.includes('-leo-1906-interpretation-p204-'));
  const band = (body, target, targetKind, aspectType, start, end) => ({ progressedBody: body, natalTargetId: target,
    targetKind, aspectType, start, end, exactTimes: [] });
  const base = band('Moon', 'Sun', 'progressed', 'parallel', 0, 10);
  const rows = buildLeoLunarConditions([base,
    band('Sun', 'Moon', 'progressed', 'parallel', 0, 10),
    band('Sun', 'Jupiter', 'natal', 'trine', 0, 10),
    band('Moon', 'Venus', 'progressed', 'sextile', 2, 7),
    band('Sun', 'Jupiter', 'progressed', 'trine', 3, 6),
    band('Sun', 'Saturn', 'progressed', 'square', 6, 10),
  ]).filter(row => row.base === base);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.progressedSolarContacts.map(contact => contact.target)]),
    [[0, 2, []], [2, 3, []], [3, 6, ['Jupiter']], [6, 7, ['Saturn']], [7, 10, ['Saturn']]]);
  const facts = rows.map(row => ({ factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...rule.queries[0].where, targetKind: 'progressed',
      hasOtherSameLayerLunarContacts: row.hasOtherSameLayerLunarContacts, hasProgressedSolarTestimony: row.hasProgressedSolarContact } }));
  const result = evaluateFortuneRules('western', 'month', facts).find(row => row.knowledgeId === rule.knowledgeId).required[0];
  assert.deepEqual(result.hits, facts);
  assert.deepEqual(rows.filter(row => row.hasOtherSameLayerLunarContacts && row.hasProgressedSolarContact)
    .map(row => [row.start, row.end]), [[3, 6], [6, 7]]);
});

test('client facts store the actual fixed or moving Moon position over the selected intervals for p254', () => {
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-06-15T00:00:00Z');
  for (const [date, targetKind] of [['1965-03-25', 'natal'], ['1965-01-13', 'progressed']]) {
    const epoch = Date.parse(date + 'T00:00:00Z');
    const reference = { snapshotId: 'leo-moon-position-' + targetKind };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, { ...reference, chart: chart(epoch) })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'leo-moon-position-report', reference);
    const selected = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p254-'));
    assert.equal(selected.status, 'matched');
    const witnesses = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Moon' && p.aspectType === 'quincunx' && p.targetKind === targetKind
      && p.moonPositionReady && p.hasOtherSameLayerLunarContacts);
    assert.ok(witnesses.length);
    for (const row of witnesses) {
      const { moonPosition, contacts, moonPositionReady } = row.normalizedPayload;
      assert.equal(moonPosition.targetKind, targetKind);
      assert.equal(moonPositionReady, true);
      assert.ok(contacts.some(item => item.targetKind === targetKind));
      const middle = Math.floor((Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2);
      if (targetKind === 'natal') assert.equal(moonPosition.sampleAt, undefined);
      else assert.equal(Date.parse(moonPosition.sampleAt), middle);
      const astronomicalTime = new Date(targetKind === 'natal' ? epoch : Math.round(progressionEpoch(epoch, middle)));
      const independentlyRead = Ecliptic(GeoVector(Body.Moon, astronomicalTime, true)).elon;
      assert.ok(Math.abs(moonPosition.longitude - independentlyRead) < 1e-8);
    }
    const phrase = targetKind === 'natal' ? /该方向的本命月亮位置为热带黄道/u : /取样，同图次限月亮位于热带黄道/u;
    assert.match(describeFortuneFact({ method: 'western', type: 'leo_lunar_condition', data: witnesses[0].normalizedPayload }, String), phrase);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-moon-position-report'));
    assert.ok(input.facts.some(fact => fact.type === 'leo_lunar_condition' && fact.data.moonPosition));
    const prompt = formatFortuneFactAudit(input);
    assert.doesNotMatch(prompt, /moonPositionReady|moonPosition|hasOtherSameLayerLunarContacts/u);
    assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === selected.knowledgeId));
  }
});

test('a real Mercury–Uranus point stays separate from the Chinese Moon sequence that starts at its second contact', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const moment = Date.parse('2026-06-15T00:00:00Z');
  const reference = { snapshotId: 'leo-adverse-series-snapshot' };
  const birthAt = Date.parse('1965-01-15T00:00:00Z');
  const snapshot = chart(birthAt);
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, moment, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, moment), 'leo-adverse-series', reference);
  const rows = run.facts.filter(f => f.factType === 'leo_lunar_condition' && f.normalizedPayload.progressedBody === 'Mercury'
    && f.normalizedPayload.natalTargetId === 'Uranus' && f.normalizedPayload.aspectType === 'quincunx'
    && f.normalizedPayload.targetKind === 'natal');
  const lookup = sample => matchFortuneKnowledge(sample).byMethod.western.find(row => row.knowledgeId.includes('-p124-'));
  const result = lookup(run);
  assert.equal(result.status, 'matched');
  const qualifying = rows.filter(row => row.normalizedPayload.hasSameLayerAdverseSequence);
  const point = rows.find(row => row.normalizedPayload.mutualExactInSlice);
  const exact = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_mutual_exact_observation'
    && p.progressedBody === 'Mercury' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx');
  assert.ok(exact);
  const exactAt = exact.exactInstant, instant = Date.parse(exactAt);
  assert.ok(Math.abs(instant - Date.parse('2026-10-03T08:12:11Z')) < 1_000);
  assert.equal(point?.activeFrom, exactAt);
  assert.equal(Date.parse(point.activeTo), instant + 1_000);
  assert.equal(point.normalizedPayload.hasSameLayerAdverseSequence, false);
  assert.equal(point.normalizedPayload.hasNatalMercuryBroadStudyTestimony, false);
  const epoch = progressionEpoch(birthAt, instant);
  const difference = readLeoMovingPosition('Mercury', epoch).longitude - readLeoMovingPosition('Uranus', birthAt).longitude;
  assert.ok(Math.abs(Math.abs((difference + 540) % 360 - 180) - 150) < 0.00001);
  assert.deepEqual(new Set(result.sourceFactIds), new Set([...qualifying, point].map(row => row.factId)));
  for (const at of [instant - 1, instant + 1_000]) {
    const nearby = rows.find(row => Date.parse(row.activeFrom) <= at && at < Date.parse(row.activeTo));
    assert.ok(nearby && !result.sourceFactIds.includes(nearby.factId));
    assert.equal(lookup({ ...run, facts: [nearby] }).status, 'not_matched');
  }
  const override = changes => lookup({ ...run, facts: [{ ...point, normalizedPayload: { ...point.normalizedPayload, ...changes } }] });
  assert.equal(override({ mutualExactInSlice: undefined }).status, 'unknown');
  assert.equal(override({ targetKind: 'progressed' }).status, 'not_matched');
  assert.ok(rows.some(row => row.normalizedPayload.hasSameLayerAdverseSequence === false));
  const { first, second, end } = qualifying[0].normalizedPayload.adverseSequence;
  assert.deepEqual([first.target, first.aspectType, second.target, second.aspectType], ['Mars', 'parallel', 'Mercury', 'square']);
  assert.ok(first.start < second.start);
  const windows = [{ start: second.start, endExclusive: end }, { start: point.activeFrom, endExclusive: point.activeTo }]
    .sort((a, b) => a.start.localeCompare(b.start));
  assert.deepEqual(result.windows, windows);
  assert.ok(rows.some(row => row.activeFrom < second.start && row.normalizedPayload.hasSameLayerAdverseContact
    && !result.sourceFactIds.includes(row.factId)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-adverse-series-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /连续偏难相位的第2项.+月亮对本命水星的四分相/u);
  assert.doesNotMatch(prompt, /adverseSequence|hasSameLayerAdverseSequence/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  const provider = formatFortunePrompt(input);
  assert.ok(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
  assert.match(provider, /基础倾向可独立表达，较明显的作用限定于已核连续偏难月相的区间/u);
  assert.doesNotMatch(provider, /连续偏难相位的第2项|adverseSequence|hasSameLayerAdverseSequence/u);
});

test('same-chart secondary facts use a second moving position and feed partial SQLite matches', () => {
  const run = realRun();
  const moving = run.facts.filter(f => f.factType === 'leo_progressed_aspect' && f.normalizedPayload.targetKind === 'progressed');
  assert.ok(moving.some(f => f.normalizedPayload.aspectType === 'parallel'));
  assert.ok(moving.some(f => f.normalizedPayload.aspectType !== 'parallel'));
  const longitude = (body, date) => body === 'Sun' ? SunPosition(date).elon : Ecliptic(GeoVector(Body[body], date, true)).elon;
  for (const f of moving) {
    const p = f.normalizedPayload;
    const midpoint = (Date.parse(f.activeFrom) + Date.parse(f.activeTo)) / 2;
    const date = new Date(Math.round(progressionEpoch(born, midpoint)));
    assert.equal(p.natalLongitude, undefined);
    assert.equal(p.natalDeclination, undefined);
    assert.ok(p.separation <= p.allowedOrb + 1e-6);
    if (p.aspectType === 'parallel') {
      const target = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[p.natalTargetId], date, true))).dec;
      assert.equal(p.targetDeclination, target);
    } else {
      assert.equal(p.targetLongitude, longitude(p.natalTargetId, date));
    }
  }
  const results = matchFortuneKnowledge({ ...run, facts: moving }).byMethod.western;
  assert.ok(results.some(result => result.status === 'partial' && result.sourceFactIds.some(id => moving.some(f => f.factId === id))));
  assert.ok(results.every(result => result.status !== 'matched'));
});

test('SQLite preserves the named Leo direction exceptions', () => {
  const template = realRun().facts.find(f => f.factType === 'leo_progressed_aspect');
  const cases = [
    ['year', 'p289', 'Sun', 'Venus', 'square', 'progressed', false],
    ['year', 'p289', 'Sun', 'Venus', 'square', 'natal', true],
    ['year', 'p289', 'Sun', 'Venus', 'semisquare', 'progressed', true],
    ['year', 'p291', 'Sun', 'Venus', 'trine', 'progressed', false],
    ['year', 'p291', 'Sun', 'Venus', 'trine', 'natal', true],
    ['month', 'p202', 'Moon', 'Sun', 'quincunx', 'progressed', false],
    ['month', 'p202', 'Moon', 'Sun', 'quincunx', 'natal', true],
    ['year', 'p131', 'Venus', 'Mercury', 'square', 'natal', true],
    ['year', 'p131', 'Venus', 'Mercury', 'square', 'progressed', false],
    ['year', 'p131', 'Mercury', 'Venus', 'square', 'natal', true],
  ];
  for (const [period, passage, progressedBody, natalTargetId, aspectType, targetKind, expected] of cases) {
    const fact = { ...template, normalizedPayload: { ...template.normalizedPayload, progressedBody, natalTargetId, aspectType, targetKind } };
    if (passage === 'p289' || passage === 'p291') {
      fact.factType = 'leo_solar_phase';
      Object.assign(fact.normalizedPayload, { profile: leoSolarPhasePolicy.profile, yearBoundary: 'progression-birthday', observed: true });
    }
    if (passage === 'p202') {
      fact.factType = 'leo_lunar_condition';
      Object.assign(fact.normalizedPayload, { lunarProfile: leoLunarConditionPolicy.profile, directionSupportState: 'favourable',
        monthlyLunarHasExact: true });
    }
    if (passage === 'p131') {
      fact.factType = 'leo_mutual_exact_observation';
      Object.assign(fact.normalizedPayload, { profile: leoSourcePolicy.mutualExactObservationProfile, observed: true });
    }
    const result = evaluateFortuneRules('western', period, [fact]).find(r => r.knowledgeId.includes(`-${passage}-`));
    assert.equal(result?.required[0].hits.length, Number(expected), `${passage} ${progressedBody} ${aspectType} ${targetKind}`);
  }
});

test('SQLite checks seven Leo natal premises against the actual star pair or named natal endpoints', () => {
  const middle = Date.parse('2026-06-15T00:00:00Z');
  const interval = { start: middle - day / 2, end: middle + day / 2 };
  const results = new Map();
  const evaluate = (passage, fact) => evaluateFortuneRules('western', 'year', [fact])
    .find(rule => rule.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
  const cases = [
    { id: 'p049', pair: ['Mars', 'Neptune', 'semisquare'], dates: [['1983-12-29', true], ['1965-05-06', false]] },
    { id: 'p066', pair: ['Mars', 'Saturn', 'parallel'], dates: [['1970-06-25', true], ['1965-02-03', false]] },
    { id: 'p070', pair: ['Mars', 'Uranus', 'sextile'], dates: [['1965-07-08', true], ['1970-12-19', false]] },
    { id: 'p073', pair: ['Mars', 'Uranus', 'sesquiquadrate'], dates: [['1971-09-07', true], ['1972-02-06', true], ['1971-09-06', true], ['1979-02-27', true]] },
    { id: 'p225', pair: ['Sun', 'Jupiter', 'conjunction'], dates: [['1983-10-21', true], ['1965-03-12', true], ['1967-05-26', false]], exclusion: true },
    { id: 'p261', pair: ['Sun', 'Neptune', 'square'], dates: [['1966-06-14', true], ['1965-06-11', true], ['1957-11-16', false]] },
    { id: 'p314', pair: ['Venus', 'Neptune', 'semisextile'], dates: [['1970-07-11', true], ['1971-08-18', false], ['1947-06-15', false]] },
  ];
  for (const { id, pair: [first, second, aspect], dates, exclusion } of cases) for (const [date, expected] of dates) {
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const context = buildLeoSourceContext(interval, snapshot, buildWesternProgressions(interval, middle, snapshot));
    assert.equal(context.status, 'ready');
    const band = context.intervals.find(row => row.progressedBody === first && row.natalTargetId === second
      && row.aspectType === aspect && row.start <= middle && middle < row.end);
    assert.ok(band, id + ' ' + date);
    const lunarState = id === 'p066' ? 'all_adverse' : id === 'p225' ? 'all_favourable' : undefined;
    const subdivision = lunarState || id === 'p070' ? buildLeoLunarConditions(context.intervals)
      .find(row => row.base === band && row.start <= middle && middle < row.end) : undefined;
    const normalizedPayload = subdivision ? { ...band, natalState: subdivision.natalState, progressedState: subdivision.progressedState,
      sameLayerLunarState: subdivision.sameLayerLunarState, lunarProfile: leoLunarConditionPolicy.profile } : band;
    const fact = { factType: subdivision ? 'leo_lunar_condition' : 'leo_progressed_aspect',
      scope: 'progressed', completeness: 'complete', normalizedPayload };
    const rule = evaluate(id, fact);
    if (id === 'p049') {
      assert.equal(band.natalPairAspectTypes.some(type => ['semisextile', 'sextile', 'trine'].includes(type)), expected, date);
      assert.equal(rule.required[0].unknown, true, date);
      assert.deepEqual(rule.exclusions, [], date);
    } else if (id === 'p066') {
      assert.equal(band.marsSaturnNatalBalanceBasis, expected ? 'harmonious-aspect' : 'no-reviewed-mitigation', date);
      assert.equal(rule.required[0].hits.length, 1, date);
      assert.deepEqual(rule.exclusions, [], date);
    } else if (id === 'p225') {
      assert.equal(band.natalAfflictedBodies.includes('Jupiter'), expected, date);
      assert.equal(rule.required[0].unknown, true, date);
    } else if (id === 'p070') {
      assert.equal(['Mars', 'Uranus'].every(body => band.natalFavourableBodies.includes(body)), expected, date);
      assert.equal(rule.required[0].hits.length, 0, date);
    } else if (id === 'p073' || id === 'p261') {
      if (id === 'p073') assert.ok(band.natalMarsUranusAfflictionFocus);
      else assert.equal(band.natalAfflictedBodies.includes('Neptune'), expected, date);
      assert.equal(rule.required[0].hits.length, 0, date);
    } else if (id === 'p314') {
      assert.equal(band.natalVenusNeptuneAfflictionState === 'adverse', expected, date);
      assert.equal(rule.required[0].hits.length, 0, date);
    } else {
      assert.equal(rule.required[0].hits.length, Number(lunarState ? subdivision?.sameLayerLunarState === lunarState : exclusion || expected), id + ' ' + date);
    }
    if (exclusion && id !== 'p225') assert.equal(rule.exclusions[0].hits.length, Number(expected), id + ' ' + date);
    if (id === 'p314' && date === '1947-06-15') {
      const minor = readLeoNatalAspectContacts(context.natalContext.bodies).filter(row => row.aspect === 'semisquare');
      assert.ok(minor.some(contact => contact.first === 'Mercury' && contact.second === 'Venus'));
      assert.ok(minor.some(contact => contact.first === 'Jupiter' && contact.second === 'Neptune'));
      assert.ok(!band.natalPairAspectTypes.includes('semisquare'));
    }
    results.set(id + ':' + date, fact);
  }
  const witnesses = (id, date) => results.get(id + ':' + date).normalizedPayload;
  assert.deepEqual(witnesses('p073', '1971-09-07').natalSquareOppositionBodies, ['Uranus']);
  assert.deepEqual(witnesses('p073', '1972-02-06').natalSquareOppositionBodies, ['Mars']);
  assert.deepEqual(witnesses('p073', '1971-09-06').natalSquareOppositionBodies, []);
  assert.deepEqual(witnesses('p073', '1971-09-06').natalAfflictedBodies, ['Mars', 'Uranus']);
  assert.deepEqual(witnesses('p073', '1979-02-27').natalAfflictedBodies, ['Mars']);
  assert.equal(witnesses('p073', '1979-02-27').natalMarsUranusAfflictionFocus, 'Mars');
  assert.equal(witnesses('p073', '1972-02-06').natalMarsUranusAfflictionFocus, 'Uranus');
  assert.deepEqual(witnesses('p261', '1965-06-11').natalSquareOppositionBodies, ['Sun']);
  assert.deepEqual(witnesses('p261', '1965-06-11').natalAfflictedBodies, ['Neptune']);
  assert.deepEqual(witnesses('p261', '1957-11-16').natalAfflictedBodies, []);
  assert.deepEqual(witnesses('p261', '1957-11-16').natalAfflictionContacts, []);
  const split = witnesses('p314', '1971-08-18');
  assert.deepEqual(split.natalSquareOppositionBodies, ['Venus', 'Neptune']);
  assert.ok(!split.natalPairAspectTypes.some(aspect => ['square', 'opposition'].includes(aspect)));
});

test('p225 natal Mars square tempers the lunar reinforcement while the real solar conjunction stays present', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-06-15T00:00:00Z'), reference = { snapshotId: 'leo-conditional-snapshot' };
  const snapshot = chart(Date.parse('1983-10-21T00:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  assert.ok(batch.facts.filter(fact => fact.factType === 'leo_lunar_condition' && fact.normalizedPayload.natalMajorAspectContacts)
    .every(({ normalizedPayload: p }) => p.progressedBody === 'Sun' && p.natalTargetId === 'Jupiter' && p.aspectType === 'conjunction'
      || p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.aspectType === 'sextile'));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-conditional', reference);
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p225-'));
  assert.equal(result.status, 'matched');
  const phases = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
  const formed = phases.find(row => row.normalizedPayload.phase === 'formation-year');
  assert.ok(phases.every(row => row.factType === 'leo_solar_phase' && row.normalizedPayload.natalJupiterAfflictionChecked));
  assert.deepEqual(phases.map(row => row.normalizedPayload.phase), ['formation-year', 'separating-year']);
  assert.equal(formed.normalizedPayload.formationAt, '2026-10-15T04:47:44.905Z');
  const evidence = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.natalTargetId === 'Jupiter' && p.aspectType === 'conjunction' && p.targetKind === 'natal'
    && p.phase === 'formation-year' && p.sameLayerLunarState === 'all_favourable' && p.formationAt === formed.normalizedPayload.formationAt);
  assert.ok(evidence && formed.activeFrom <= evidence.activeFrom && evidence.activeTo <= formed.activeTo);
  assert.equal(evidence.normalizedPayload.lunarQualification, 'favourable-context');
  assert.ok(evidence.normalizedPayload.natalJupiterAfflictionContacts.some(contact => contact.first === 'Mars'
    && contact.second === 'Jupiter' && contact.aspect === 'square'));
  assert.ok(run.facts.some(fact => fact.factType === 'leo_lunar_condition' && fact.normalizedPayload.progressedBody === 'Sun'
    && fact.normalizedPayload.natalTargetId === 'Jupiter' && fact.normalizedPayload.aspectType === 'conjunction'
    && fact.normalizedPayload.sameLayerLunarState !== 'all_favourable' && !result.sourceFactIds.includes(fact.factId)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-conditional-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命木星的受克见证为/u);
  assert.match(prompt, /本命火星与本命木星为(?:四分|对分)相/u);
  assert.match(prompt, /原段尤其指出来自火星的受克/u);
  assert.doesNotMatch(prompt, /natalJupiterAfflictionContacts|natalMajorAspectContacts|natalSquareOppositionBodies|leo-natal-aspects-1928-support-v1/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
});

test('Neptune natal prerequisites distinguish actual hard contacts, verified absence and unknown evidence in SQLite', () => {
  const samples = [
    ['p102', '1965-01-01', 'Mercury', 'trine', ['Mercury', 'Neptune'], ['Mercury', 'Neptune']],
    ['p102', '1965-04-26', 'Mercury', 'trine', [], ['Mercury']],
    ['p102', '1960-11-15', 'Mercury', 'trine', [], [], 2049],
    ['p259', '1966-10-29', 'Sun', 'semisquare', ['Sun']],
    ['p259', '1966-10-30', 'Sun', 'semisquare', ['Sun', 'Neptune']],
  ];
  for (const [id, date, body, aspect, expected, afflictions, year = 2026] of samples) {
    const moment = Date.UTC(year, 5, 15);
    const period = { start: Date.UTC(year - 1, 11, 31, 16), end: Date.UTC(year, 11, 31, 16) };
    const snapshot = chart(Date.parse(date + 'T00:00:00Z'));
    const context = buildLeoSourceContext(period, snapshot, buildWesternProgressions(period, moment, snapshot));
    assert.equal(context.status, 'ready');
    const band = context.intervals.find(row => row.progressedBody === body && row.natalTargetId === 'Neptune'
      && row.aspectType === aspect);
    assert.ok(band, id + ' ' + date);
    assert.deepEqual(band.natalSquareOppositionBodies, expected);
    for (const name of expected) assert.ok(band.natalMajorAspectContacts.some(contact =>
      ['square', 'opposition'].includes(contact.aspect) && [contact.first, contact.second].includes(name)));
    const fact = { factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete', normalizedPayload: band };
    const evaluate = (payload = band) => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: payload }])
      .find(row => row.knowledgeId.includes('-' + id + '-'));
    const result = evaluate();
    if (id === 'p102') {
      assert.deepEqual(band.natalAfflictedBodies, afflictions);
      assert.deepEqual(result.required[0].hits, []);
      assert.deepEqual(result.exclusions[0].hits, []);
      assert.equal(result.required[0].unknown, true);
      assert.equal(result.exclusions[0].unknown, true);
    } else {
      assert.deepEqual(result.required[0].hits, []);
      assert.equal(result.required[0].unknown, true);
    }
  }
});

test('client natal minor aspects reach SQLite with the exact pair or named planet and readable witnesses', () => {
  const samples = [
    { id: 'p314', birth: '1951-09-25', year: 2042, targetKind: 'natal', aspect: 'semisquare', status: 'not_matched', text: /本命金星与本命海王星的直接四分、对分、半刑或倍半刑为半刑相/u },
    { id: 'p314', birth: '1947-06-06', year: 2035, targetKind: 'natal', aspect: 'sesquiquadrate', status: 'matched' },
    { id: 'p102', birth: '1965-04-26', year: 2026, targetKind: 'natal', aspect: 'semisquare', status: 'not_matched', text: /本命月亮与本命水星为半刑相/u },
    { id: 'p261', birth: '1960-11-27', year: 2026, targetKind: 'progressed', aspect: 'sesquiquadrate', status: 'matched', text: /本命月亮与本命海王星为倍半刑相/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, 5, 15), reference = { snapshotId: 'leo-minor-natal-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-minor-natal', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + sample.id + '-'));
    assert.equal(result?.status, sample.status, sample.id + ' ' + sample.birth);
    const evidence = run.facts.find(row => row.factType === 'leo_progressed_aspect' && row.normalizedPayload.targetKind === sample.targetKind
      && (sample.id === 'p261'
        ? row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.natalTargetId === 'Neptune' && row.normalizedPayload.aspectType === 'square'
        : sample.id === 'p102' ? row.normalizedPayload.progressedBody === 'Mercury' && row.normalizedPayload.natalTargetId === 'Neptune'
          && row.normalizedPayload.aspectType === 'trine' : row.normalizedPayload.progressedBody === 'Venus'
          && row.normalizedPayload.natalTargetId === 'Neptune' && row.normalizedPayload.aspectType === 'semisextile'));
    assert.ok(evidence, sample.id + ' ' + sample.targetKind);
    const payload = evidence.normalizedPayload;
    const contacts = sample.id === 'p314' ? payload.natalPairAspects : payload.natalAfflictionContacts;
    assert.ok(contacts.some(row => row.aspect === sample.aspect && row.difference <= row.orb && row.orb === 4));
    assert.ok(!contacts.some(row => row.aspect === 'square' || row.aspect === 'opposition'));
    if (sample.id === 'p314') {
      assert.equal(payload.natalVenusNeptuneAfflictionState, 'adverse');
      assert.ok(!result.sourceFactIds.includes(evidence.factId));
      assert.equal(run.facts.some(row => row.factType === 'leo_mutual_exact_observation'
        && row.parentSignalId === evidence.parentSignalId && result.sourceFactIds.includes(row.factId)), sample.status === 'matched');
    }
    if (!sample.text) continue;
    if (sample.id === 'p261') assert.ok(!result.sourceFactIds.includes(evidence.factId)
      && run.facts.filter(row => result.sourceFactIds.includes(row.factId)).every(row => row.factType === 'leo_solar_phase'));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-minor-natal-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.text);
    assert.doesNotMatch(prompt, /natalAfflict(?:ionContacts|edBodies)|natalPairAspectTypes/u);
    if (['excluded', 'not_matched'].includes(sample.status)) {
      assert.deepEqual(result.windows, []);
      assert.ok(!input.sections.flatMap(row => row.findings).some(row => row.knowledgeId === result.knowledgeId));
    }
  }
});

test('Neptune prominence and additional natal contacts drive separate source branches from real client batches', () => {
  const samples = [
    { id: 'p098', birth: '1945-07-12', year: 2042, armc: 0, house: 4, layers: ['natal'], type: 'leo_lunar_condition',
      phrase: /本命海王星实居第4宫，为已核的显著位置候选/u },
    { id: 'p257', birth: '1949-07-21', year: 2026, armc: 75, house: 1, layers: ['natal'], type: 'leo_progressed_aspect',
      types: ['sesquiquadrate'], phrase: /本命月亮与本命海王星为倍半刑相/u },
    { id: 'p266', birth: '1953-01-28', year: 2026, armc: 0, house: 4, layers: ['natal', 'progressed'], type: 'leo_progressed_aspect',
      types: ['quincunx', 'conjunction', 'parallel'], phrase: /本命土星与本命海王星为赤纬绝对值平行/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, 5, 15), reference = { snapshotId: 'leo-prominence-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'), sample.armc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-prominence', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + sample.id + '-'));
    assert.equal(result?.status, 'matched', sample.id);
    const facts = run.facts.filter(row => row.factType === sample.type && (sample.types
      ? row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.natalTargetId === 'Neptune'
        && row.normalizedPayload.aspectType === (sample.id === 'p257' ? 'conjunction' : 'parallel')
      : result.sourceFactIds.includes(row.factId)));
    assert.deepEqual([...new Set(facts.map(fact => fact.normalizedPayload.targetKind))].sort(), sample.layers);
    for (const fact of facts) {
      const p = fact.normalizedPayload;
      assert.equal(p.natalTargetHouse, sample.house);
      const evaluate = data => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...p, ...data } }])
        .find(row => row.knowledgeId === result.knowledgeId).required[0];
      const independentCandidates = sample.types ? { hasNatalNeptuneSoleLuminaryContact: false }
        : { hasNatalNeptuneSoleLuminaryContact: false, mutualExactInSlice: false, natalMercuryDominantAngular: false,
          hasFavourableNatalNeptuneLunarContact: false, mercuryNeptuneNatalSensitivityState: 'unreviewed' };
      if (sample.types) {
        assert.equal(p.solarNeptuneNatalEvidenceState, 'qualified', sample.id);
        assert.deepEqual(p.natalTargetAspectContacts.map(row => row.aspect), sample.types);
        assert.ok(p.natalTargetAspectContacts.every(row => [row.first, row.second].includes('Neptune') && row.difference <= row.orb));
        assert.equal(p.hasSolarNeptuneExact, sample.id === 'p257');
        assert.deepEqual(p.natalNeptuneCreativeTestimonies, []);
        assert.equal(p.hasNatalNeptuneCreativeTestimony, false);
        assert.deepEqual(p.natalAfflictionContacts.map(row => [row.first, row.second, row.aspect]),
          sample.id === 'p257' ? [['Moon', 'Neptune', 'sesquiquadrate']] : []);
        assert.ok(!p.natalSextileTrineBodies.includes('Neptune') && !p.natalSquareOppositionBodies.includes('Neptune'));
      } else {
        assert.equal(evaluate({ ...independentCandidates, natalTargetHouse: sample.house }).hits.length, 1, sample.id);
        assert.equal(evaluate({ ...independentCandidates, natalTargetHouse: 5 }).hits.length, 0, sample.id);
        assert.equal(evaluate({ ...independentCandidates, natalTargetHouse: undefined }).unknown, true, sample.id);
        assert.equal(p.mercuryBehindNeptune, false);
        assert.equal(p.hasFavourableLunarLink, false);
      }
    }
    if (sample.types) assert.ok(run.facts.some(row => result.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.solarNeptuneNatalEvidenceState === 'qualified'));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-prominence-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(sample.phrase.test(prompt), `${sample.id} retains natal contact audit`);
    if (sample.id === 'p257') assert.ok(/当前(?:年|查询)窗内日海黄经确有合相点/u.test(prompt), 'p257 retains in-window exact-point audit');
    if (sample.id === 'p266') assert.ok(/当前(?:年|查询)窗内只有日海相位带/u.test(prompt), 'p266 retains band-only audit');
    assert.doesNotMatch(prompt, /hasNatalTargetAspect|natalTargetAspectContacts|natalTargetHouse/u);
  }
});

test('p257 and p266 keep the actual solar point, adjacent bands, and target layers distinct', () => {
  const examples = [
    ['1949-07-21', 2025, 'conjunction', ['natal'], [], false],
    ['1965-09-11', 2026, 'conjunction', ['natal', 'progressed'], ['natal'], true],
    ['1953-01-28', 2024, 'parallel', ['natal', 'progressed'], ['natal'], false],
  ];
  for (const [birth, year, aspect, layers, exactLayers, artistic] of examples) {
    const born = Date.parse(`${birth}T00:00:00Z`), natal = chart(born, 75), now = Date.UTC(year, 5, 15);
    const window = { start: Date.UTC(year - 1, 11, 31, 16), end: Date.UTC(year, 11, 31, 16) };
    const source = buildLeoSourceContext(window, natal, buildWesternProgressions(window, now, natal), true);
    assert.equal(source.status, 'ready');
    const bands = [...source.intervals, ...source.progressedPairs].filter(row => row.progressedBody === 'Sun'
      && row.natalTargetId === 'Neptune' && row.aspectType === aspect);
    const sortLayers = rows => [...new Set(rows.map(row => row.targetKind))].sort();
    assert.deepEqual(sortLayers(bands), layers, birth);
    assert.deepEqual(sortLayers(bands.filter(row => row.hasSolarNeptuneExact)), exactLayers, birth);
    for (const band of bands) {
      assert.equal(band.hasSolarNeptuneExact, band.exactTimes.length > 0, birth);
      assert.equal(band.hasNatalNeptuneCreativeTestimony, artistic, birth);
      if (artistic) assert.ok(band.natalNeptuneCreativeTestimonies.some(row => row.other === 'Moon'
        && row.aspect === 'trine' && row.nature === 'favourable' && row.difference <= row.orb), birth);
      for (const at of band.exactTimes) {
        const moving = Math.round(progressionEpoch(born, at)), target = band.targetKind === 'natal' ? born : moving;
        const difference = aspect === 'parallel' ? leoParallelDifference(readLeoEquatorial('Sun', moving).dec, readLeoEquatorial('Neptune', target).dec)
          : Math.abs((readLeoMovingPosition('Sun', moving).longitude - readLeoMovingPosition('Neptune', target).longitude + 540) % 360 - 180);
        assert.ok(difference < 1e-6, birth);
      }
    }
  }
});

test('new angle and dignity conditions qualify independently in the actual Leo windows', () => {
  const samples = [
    { id: 'p098', birth: '1945-07-12', year: 2042, armc: 154, house: 10, layers: ['natal'],
      closest: false, type: 'leo_lunar_condition', phrase: /本命海王星实居第10宫，为已核的显著位置候选/u },
    { id: 'p098', birth: '1935-08-19', year: 1960, armc: 40, house: 2, layers: ['natal'],
      closest: false, dignity: true, type: 'leo_lunar_condition', phrase: /本命水星在自己掌管的处女座，同时实居第1角宫/u },
    { id: 'p257', birth: '1949-07-21', year: 2026, armc: 192, house: 9, layers: ['natal'],
      closest: true, other: 'Saturn', type: 'leo_progressed_aspect', phrase: /本命海王星的黄经离本命天顶.*在原书所用九曜中最近/u },
    { id: 'p266', birth: '1953-01-28', year: 2026, armc: 263, house: 7, layers: ['natal', 'progressed'],
      closest: false, type: 'leo_progressed_aspect', phrase: /本命海王星实居第7宫，为已核的显著位置候选/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, 5, 15), reference = { snapshotId: 'leo-natal-prominence' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'), sample.armc);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const hit = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + sample.id + '-'));
    const isMercury = sample.id === 'p098';
    assert.equal(hit.status, 'matched', sample.id);
    const facts = run.facts.filter(row => row.factType === sample.type && (isMercury ? hit.sourceFactIds.includes(row.factId)
      : row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.natalTargetId === 'Neptune'
        && row.normalizedPayload.aspectType === (sample.id === 'p257' ? 'conjunction' : 'parallel')));
    assert.deepEqual([...new Set(facts.map(row => row.normalizedPayload.targetKind))].sort(), sample.layers);
    const matchedFacts = run.facts.filter(row => hit.sourceFactIds.includes(row.factId));
    assert.ok(matchedFacts.length > 0);
    assert.ok(matchedFacts.every(fact => hit.windows.some(window => window.start <= fact.activeFrom && fact.activeTo <= window.endExclusive)));
    for (const fact of facts) {
      const p = fact.normalizedPayload, elevation = p.natalNeptuneElevation;
      assert.equal(p.natalTargetHouse, sample.house);
      assert.equal(p.natalNeptuneClosestToMidheaven, sample.closest);
      assert.equal(elevation.isClosest, sample.closest);
      if (sample.closest) {
        assert.equal(elevation.nearestOther.body, sample.other);
        assert.ok(Math.abs(elevation.distance - 0.45355359766) < 1e-7);
        assert.ok(elevation.distance < elevation.nearestOther.distance);
      }
      if (isMercury) {
        assert.equal(p.hasFavourableLunarLink, false);
        assert.equal(p.mercuryBehindNeptune, false);
        assert.equal(p.natalMercuryDomicileAngular, Boolean(sample.dignity));
        const evaluate = data => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...p, ...data } }])
          .find(row => row.knowledgeId === hit.knowledgeId).required[0];
        const otherBranches = { mutualExactInSlice: false, natalMercuryDominantAngular: false, hasFavourableNatalNeptuneLunarContact: false,
          mercuryNeptuneNatalSensitivityState: 'unreviewed' };
        assert.equal(evaluate(otherBranches).hits.length, 1, sample.birth);
        assert.equal(evaluate({ ...otherBranches, natalTargetHouse: 9, natalNeptuneClosestToMidheaven: false, natalNeptuneBeforeAngularCusp: false,
          natalMercuryDomicileAngular: false, hasNatalNeptuneSoleLuminaryContact: false }).hits.length, 0);
      } else {
        assert.equal(p.hasNatalTargetAspect, true);
        assert.ok(p.natalTargetAspectContacts.every(row => row.first === 'Neptune' || row.second === 'Neptune'));
        assert.ok(matchedFacts.every(row => row.normalizedPayload.solarNeptuneNatalEvidenceState === 'qualified'
          && row.normalizedPayload.targetKind === 'natal'));
      }
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-natal-prominence'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(sample.phrase.test(prompt), `${sample.id} audit retains actual natal angle or dignity`);
    assert.doesNotMatch(prompt, /natalNeptuneElevation|natalNeptuneClosestToMidheaven|natalMercuryDomicileAngular/u);
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
  }
});

test('three Neptune rules share the source angular-cusp condition with real planets on either side of five degrees', () => {
  const samples = [
    ['p098', '1945-07-12', 2042, 6.5, 9.5, 'Mercury', 'semisextile'],
    ['p257', '1949-07-21', 2026, 14.5, 17.5, 'Sun', 'conjunction'],
    ['p266', '1953-01-28', 2026, 25, 28, 'Sun', 'parallel'],
  ];
  for (const [passage, date, year, near, far, body, aspect] of samples) {
    const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
    const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(year, 5, 15), reference = { snapshotId: 'leo-neptune-upcoming-cusp' };
    const snapshot = armc => chart(Date.parse(date + 'T00:00:00Z'), armc);
    const factType = rule.queries[0].factType;
    const applies = p => p.natalTargetId === 'Neptune' && p.progressedBody === body && p.aspectType === aspect
      && p.natalTargetHouse === 3 && p.natalNeptuneClosestToMidheaven === false
      && (passage === 'p098' ? p.hasFavourableLunarLink === false && p.mercuryBehindNeptune === false
        && p.natalMercuryDomicileAngular === false : p.hasNatalTargetAspect === true);
    const nearChart = snapshot(near);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: nearChart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const hit = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
    assert.equal(hit.status, 'matched', passage);
    const fact = run.facts.find(row => row.factType === factType && hit.sourceFactIds.includes(row.factId) && applies(row.normalizedPayload));
    assert.ok(fact, passage);
    const p = fact.normalizedPayload, approach = p.natalNeptuneElevation.angularCuspApproach;
    assert.equal(p.natalNeptuneBeforeAngularCusp, true, passage);
    assert.deepEqual([approach.fromHouse, approach.nextHouse], [3, 4]);
    assert.ok(approach.distance > 3 && approach.distance < 3.3, passage);
    if (passage !== 'p098') assert.equal(p.solarNeptuneNatalEvidenceState, 'qualified', passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const phrase = /本命海王星在第3宫，距前方第4角宫宫头/u;
    assert.ok(phrase.test(formatFortuneFactAudit(input)), `${passage} retains the natal angular-cusp audit`);
    assert.doesNotMatch(formatFortunePrompt(input), phrase, passage);

    const farChart = snapshot(far);
    const bounds = { start: Date.UTC(year - 1, 11, 31, 16), end: Date.UTC(year, 11, 31, 16) };
    const context = buildLeoSourceContext(bounds, farChart, buildWesternProgressions(bounds, asOf, farChart), true);
    const rows = [...context.intervals, ...context.progressedPairs];
    const controls = (passage === 'p098' ? buildLeoLunarConditions(rows).map(({ base, ...lunar }) =>
      ({ ...base, ...lunar, lunarProfile: leoLunarConditionPolicy.profile })) : rows).filter(applies);
    assert.ok(controls.length, passage);
    for (const control of controls) {
      assert.equal(control.natalNeptuneBeforeAngularCusp, false, passage);
      assert.equal(control.natalNeptuneElevation.angularCuspApproach, undefined, passage);
    }
    if (passage === 'p098') {
      const negativeFacts = controls.map(normalizedPayload => ({ factType, scope: 'progressed', completeness: 'complete', normalizedPayload }));
      const evaluated = evaluateFortuneRules('western', 'year', negativeFacts).find(row => row.knowledgeId === rule.knowledgeId);
      assert.deepEqual(evaluated.required[0].hits, [], passage);
    } else assert.ok(controls.every(p => p.solarNeptuneNatalEvidenceState === 'prominence-unreviewed'), passage);
  }
});

test('three Neptune rules share the sole luminary contact outside the angular-house branches', () => {
  const cases = [
    ['p098', '1970-11-08', 2026, 'Mercury', 'semisextile', 'leo_lunar_condition', ['natal']],
    ['p257', '1961-08-25', 2030, 'Sun', 'conjunction', 'leo_progressed_aspect', ['natal']],
    ['p266', '1961-08-25', 2026, 'Sun', 'parallel', 'leo_progressed_aspect', ['natal', 'progressed']],
  ];
  for (const [passage, date, year, body, aspectType, factType, targets] of cases) {
    const natalBirth = Date.parse(`${date}T00:00:00Z`);
    const controlBirth = Date.parse(`${date}T12:00:00Z`);
    const asOf = Date.UTC(year, 6, 1), reference = { snapshotId: `leo-sole-luminary-${passage}`, chart: chart(natalBirth) };
    const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, submission, readClientFactTime(parameters, submission, asOf), reference.snapshotId, reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes(`-${passage}-`));
    const pair = p => p.progressedBody === body && p.natalTargetId === 'Neptune' && p.aspectType === aspectType;
    const instant = new Date(asOf).toISOString();
    const facts = run.facts.filter(row => row.factType === factType && row.activeFrom <= instant && instant < row.activeTo && pair(row.normalizedPayload));
    assert.equal(result.status, 'matched', passage);
    assert.deepEqual([...new Set(facts.map(row => row.normalizedPayload.targetKind))].sort(), targets, passage);

    const assertNoPriorArm = p => {
      assert.equal(p.natalTargetHouse, 5, passage);
      assert.equal(p.natalNeptuneClosestToMidheaven, false, passage);
      assert.equal(p.natalNeptuneBeforeAngularCusp, false, passage);
      if (body === 'Mercury') {
        assert.equal(p.hasFavourableLunarLink, false, passage);
        assert.equal(p.mercuryBehindNeptune, false, passage);
        assert.equal(p.natalMercuryDomicileAngular, false, passage);
      } else assert.equal(p.hasNatalTargetAspect, true, passage);
    };
    const evaluate = rows => evaluateFortuneRules('western', 'year', rows).find(row => row.knowledgeId === result.knowledgeId).required[0];
    for (const fact of facts) {
      const p = fact.normalizedPayload;
      assertNoPriorArm(p);
      assert.equal(p.hasNatalNeptuneSoleLuminaryContact, true, passage);
      assert.deepEqual(p.natalNeptuneSoleLuminaryContacts.map(({ luminary, first, second, aspect }) => [luminary, first, second, aspect]),
        [['Moon', 'Moon', 'Neptune', 'square']], passage);
      assert.ok(p.natalNeptuneSoleLuminaryContacts.every(({ difference, orb }) => difference <= orb), passage);
      if (body === 'Sun') {
        assert.equal(p.solarNeptuneNatalEvidenceState, 'qualified', passage);
        if (passage === 'p266') assert.equal(result.sourceFactIds.includes(fact.factId), p.targetKind === 'natal', passage);
      } else assert.ok(result.sourceFactIds.includes(fact.factId), passage);
    }
    if (body === 'Sun') assert.ok(run.facts.some(row => result.sourceFactIds.includes(row.factId) && pair(row.normalizedPayload)
      && row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.solarNeptuneNatalEvidenceState === 'qualified'));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const auditText = /本命月亮唯一成相的星体为海王星/u;
    assert.ok(auditText.test(formatFortuneFactAudit(input)), `${passage} retains the sole luminary audit`);
    assert.doesNotMatch(formatFortunePrompt(input), auditText, passage);

    const bounds = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) }, negativeChart = chart(controlBirth);
    const context = buildLeoSourceContext(bounds, negativeChart, buildWesternProgressions(bounds, asOf, negativeChart), true);
    const bands = [...context.intervals, ...context.progressedPairs];
    const controls = (body === 'Mercury' ? buildLeoLunarConditions(bands).map(({ base, ...lunar }) =>
      ({ ...base, ...lunar, lunarProfile: leoLunarConditionPolicy.profile })) : bands)
      .filter(p => p.start <= asOf && asOf < p.end && pair(p));
    assert.deepEqual([...new Set(controls.map(p => p.targetKind))].sort(), targets, passage);
    for (const p of controls) {
      assertNoPriorArm(p);
      assert.equal(p.hasNatalNeptuneSoleLuminaryContact, false, passage);
      assert.deepEqual(p.natalNeptuneSoleLuminaryContacts, [], passage);
    }
    if (body === 'Sun') {
      const competing = readLeoNatalAspectContacts(context.natalContext.bodies).filter(row => row.first === 'Moon' || row.second === 'Moon');
      assert.ok(competing.some(row => [row.first, row.second].includes('Neptune')), passage);
      assert.ok(competing.some(row => ![row.first, row.second].includes('Neptune')), passage);
    }
    if (body === 'Mercury') {
      assert.deepEqual(evaluate(controls.map(normalizedPayload => ({ factType, scope: 'progressed', completeness: 'complete', normalizedPayload }))).hits,
        [], passage);
    } else assert.ok(controls.every(p => p.solarNeptuneNatalEvidenceState === 'prominence-unreviewed'), passage);
  }
});

test('p257 and p266 admit the closest comparable natal luminary contact with its own solar geometry', () => {
  const cases = [
    ['p266', '1961-08-04T00:00:00Z', 2048, 'parallel', true, false, true],
    ['p257', '1961-08-04T00:00:00Z', 2050, 'conjunction', true, true, true],
    ['p257', '1961-08-04T00:00:00Z', 2051, 'conjunction', true, false, false],
    ['p257', '1961-08-03T16:00:00Z', 2051, 'conjunction', false, true, false],
  ];
  for (const [passage, birthday, year, aspect, closest, exact, accepted] of cases) {
    const birthAt = Date.parse(birthday);
    const asOf = Date.UTC(year, 6, 1);
    const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
    const reference = { snapshotId: `leo-neptune-closest-luminary-${birthday}-${year}`, chart: chart(birthAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, reference)));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), reference.snapshotId, reference);
    const pair = p => p.targetKind === 'natal' && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === aspect;
    const fact = run.facts.find(row => row.factType === 'leo_progressed_aspect' && pair(row.normalizedPayload));
    assert.ok(fact, `${birthday} ${year}`);
    const p = fact.normalizedPayload;
    assert.equal(p.natalTargetHouse, 5);
    assert.equal(p.natalNeptuneClosestToMidheaven, false);
    assert.equal(p.natalNeptuneBeforeAngularCusp, false);
    assert.equal(p.hasNatalNeptuneSoleLuminaryContact, false);
    assert.equal(p.hasNatalTargetAspect, true);
    assert.equal(p.hasNatalNeptuneClosestComparableLuminaryContact, closest);
    assert.equal(p.hasSolarNeptuneExact, exact);

    const lon = body => readLeoMovingPosition(body, birthAt).longitude;
    const deltaFromSquare = body => Math.abs(Math.abs((lon('Sun') - lon(body) + 540) % 360 - 180) - 90);
    assert.equal(deltaFromSquare('Neptune') < deltaFromSquare('Moon'), closest);
    const comparable = p.natalNeptuneClosestComparableLuminaryContacts;
    assert.equal(comparable.length, closest ? 1 : 0);
    if (closest) {
      const [witness] = comparable;
      assert.deepEqual([witness.luminary, witness.first, witness.second, witness.aspect, witness.coordinate],
        ['Sun', 'Sun', 'Neptune', 'square', 'longitude']);
      assert.deepEqual([witness.closestOther.first, witness.closestOther.second, witness.closestOther.aspect, witness.closestOther.coordinate],
        ['Sun', 'Moon', 'square', 'longitude']);
      assert.ok(Math.abs(witness.difference - deltaFromSquare('Neptune')) < 1e-8);
      assert.ok(Math.abs(witness.closestOther.difference - deltaFromSquare('Moon')) < 1e-8);
    }

    const rule = row => row.knowledgeId.includes(`-${passage}-`);
    const result = matchFortuneKnowledge(run).byMethod.western.find(rule);
    assert.equal(result.status, 'matched', `${birthday} ${year}`);
    const matching = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(matching.length && matching.every(row => pair(row.normalizedPayload)), `${birthday} ${year}`);
    const state = closest ? 'qualified' : 'prominence-unreviewed';
    assert.equal(p.solarNeptuneNatalEvidenceState, state);
    assert.ok(matching.every(row => row.normalizedPayload.solarNeptuneNatalEvidenceState === state), `${birthday} ${year}`);
    const [selected] = matching;
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...selected, normalizedPayload: { ...selected.normalizedPayload, ...changes } }])
      .find(rule).required[0];
    assert.equal(evaluate({}).hits.length, 1);
    assert.deepEqual(evaluate({ targetKind: 'progressed' }).hits, []);
    assert.equal(evaluate({ solarNeptuneNatalEvidenceState: undefined }).unknown, true);
    const point = run.facts.find(row => row.factType === 'leo_progressed_aspect_exact' && pair(row.normalizedPayload));
    assert.equal(Boolean(point), exact);
    if (exact) {
      const epoch = Math.round(progressionEpoch(birthAt, Date.parse(point.exactInstant)));
      const moved = readLeoMovingPosition('Sun', epoch).longitude;
      assert.ok(Math.abs((moved - lon('Neptune') + 540) % 360 - 180) < 1e-6);
      if (accepted) assert.equal(point.exactInstant, '2050-11-09T19:49:31.033Z');
    }
    if (aspect === 'parallel') {
      const difference = at => Math.abs(Math.abs(readLeoMovingPosition('Sun', progressionEpoch(birthAt, at)).declination)
        - Math.abs(readLeoMovingPosition('Neptune', birthAt).declination));
      assert.equal(p.allowedOrb, 1);
      assert.ok(difference(Date.parse(fact.activeFrom)) < 1);
      assert.ok(difference(Date.parse(fact.activeTo) + day) > 1);
      assert.equal(fact.activeTo, '2048-10-08T14:33:19.182Z');
    }
    if (accepted) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
      const wording = '在本命太阳同类相位中，海王星的四分相最接近精确角';
      assert.ok(formatFortuneFactAudit(input).includes(wording), passage);
      assert.ok(!formatFortunePrompt(input).includes(wording), passage);
    }
  }
});

test('p225 natal Mars semisquare also tempers a favourable lunar slice', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.UTC(2026, 5, 15), reference = { snapshotId: 'leo-jupiter-affliction-snapshot' };
  const snapshot = chart(Date.parse('1957-07-12T00:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-jupiter-affliction', reference);
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p225-'));
  assert.equal(result?.status, 'matched');
  const witness = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.natalTargetId === 'Jupiter' && p.aspectType === 'conjunction' && p.targetKind === 'natal' && p.sameLayerLunarState === 'all_favourable');
  assert.ok(witness && witness.activeFrom < witness.activeTo);
  const p = witness.normalizedPayload;
  assert.equal(p.lunarQualification, 'favourable-context');
  assert.ok(!p.natalJupiterAfflictionContacts.some(row => ['square', 'opposition'].includes(row.aspect)));
  assert.ok(p.natalJupiterAfflictionContacts.some(row => row.first === 'Mars' && row.second === 'Jupiter' && row.aspect === 'semisquare'));
  const basis = run.facts.find(row => result.sourceFactIds.includes(row.factId) && row.normalizedPayload.formationAt === p.formationAt
    && row.normalizedPayload.phase === p.phase && row.normalizedPayload.targetKind === p.targetKind);
  assert.ok(basis && basis.activeFrom <= witness.activeFrom && witness.activeTo <= basis.activeTo);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-jupiter-affliction-report'));
  assert.match(formatFortuneFactAudit(input), /本命火星与本命木星为半刑相/u);
  assert.ok(input.sections.flatMap(row => row.findings).some(row => row.knowledgeId === result.knowledgeId));
});

test('natal semi-sextiles keep direct-pair mitigation and named-body matches distinct through SQLite and the prompt', () => {
  const samples = [
    { id: 'p066', birth: '1945-08-21', year: 2026, type: 'leo_lunar_condition', balance: true,
      phrase: /本命火星与本命土星的直接偏顺相位为半六合相/u },
    { id: 'p070', birth: '1947-08-07', year: 2049, type: 'leo_lunar_condition', bodies: ['Mars', 'Uranus'],
      phrase: /本命水星与本命火星为半六合相/u },
    { id: 'p196', birth: '1945-04-11', year: 2026, month: 8, type: 'leo_lunar_exact_observation', bodies: ['Moon'],
      phrase: /本命月亮与本命金星为半六合相/u },
    { id: 'p196', birth: '1945-03-14', year: 2035, month: 9, type: 'leo_lunar_exact_observation', bodies: ['Moon', 'Sun'],
      layer: 'progressed', phrase: /本命太阳与本命火星为半六合相/u },
  ];
  for (const sample of samples) {
    const params = { periodType: sample.month ? 'month' : 'year',
      targetPeriod: sample.month ? { year: sample.year, month: sample.month } : { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, (sample.month ?? 6) - 1, 15), reference = { snapshotId: 'leo-natal-semisextile-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-natal-semisextile', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + sample.id + '-'));
    const exactLunar = sample.type === 'leo_lunar_exact_observation';
    const independentMars = sample.id === 'p070';
    if (independentMars) assertAnnualMutualObservation(run, result, 'Uranus', 'sextile', 'not_matched');
    else assert.equal(result?.status, 'matched', sample.id);
    const witness = run.facts.find(({ factId, factType, normalizedPayload: p }) => factType === sample.type
      && p.targetKind === (sample.layer ?? 'natal') && (sample.id !== 'p066' || p.sameLayerLunarState === 'all_adverse')
      && (independentMars ? p.progressedBody === 'Mars' && p.natalTargetId === 'Uranus' && p.aspectType === 'sextile'
        && p.hasSameLayerFavourableContact === false && !['favourable', 'mixed'].includes(p.directionSupportState)
        : result.sourceFactIds.includes(factId)));
    assert.ok(witness && witness.activeFrom < witness.activeTo, sample.id);
    const band = exactLunar ? leoBandForExactObservation(run, witness) : witness;
    const p = band.normalizedPayload;
    const evaluate = overrides => evaluateFortuneRules('western', params.periodType,
      [{ ...witness, normalizedPayload: { ...witness.normalizedPayload, ...overrides } }])
      .find(row => row.knowledgeId === result.knowledgeId);
    if (sample.balance) {
      assert.ok(result.windows.length > 0);
      assert.deepEqual(p.natalPairAspects.filter(row => ['semisextile', 'sextile', 'trine'].includes(row.aspect))
        .map(row => [row.aspect, row.orb]), [['semisextile', 2]]);
      assert.equal(p.marsSaturnNatalBalanceBasis, 'harmonious-aspect');
      assert.equal(p.hasMarsSaturnAdverseLunarActivation, true);
      assert.equal(p.natalMutualDomicileExchange, false);
      const birth = Date.parse(sample.birth + 'T00:00:00Z');
      const separation = Math.abs((readLeoMovingPosition('Mars', birth).longitude
        - readLeoMovingPosition('Saturn', birth).longitude + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 30.978204084) < 0.00001);
      const middle = (Date.parse(witness.activeFrom) + Date.parse(witness.activeTo)) / 2;
      const mars = readLeoMovingPosition('Mars', progressionEpoch(birth, middle)).declination;
      const saturn = readLeoMovingPosition('Saturn', birth).declination;
      assert.ok(Math.abs(Math.abs(mars) - Math.abs(saturn)) <= 1);
      assert.deepEqual(evaluate({}).exclusions, []);
      const natalSemisextile = overrides => evaluate(overrides).confirmations.find(branch => branch.sourceConditions.some(line =>
        line.includes('同一本命盘的火星与土星成半六合')));
      assert.equal(natalSemisextile({}).hits.length, 1);
      assert.equal(natalSemisextile({ natalPairAspectTypes: ['quincunx'] }).hits.length, 0);
      assert.equal(natalSemisextile({ natalPairAspectTypes: undefined }).unknown, true);
      assert.equal(natalSemisextile({ targetKind: 'progressed' }).hits.length, 0);
      assert.equal(evaluate({ targetKind: 'transit' }).required[0].hits.length, 0);
    } else {
      assert.deepEqual(p.natalFavourableBodies, sample.bodies);
      assert.deepEqual(p.natalSextileTrineBodies, []);
      assert.ok(p.natalFavourableContacts.length && p.natalFavourableContacts.every(row =>
        row.aspect === 'semisextile' && row.orb === 2 && row.difference <= row.orb));
      if (exactLunar) {
        assert.equal(evaluate({ natalFavourableBodies: ['Venus'], natalAfflictedBodies: ['Venus'] }).required[0].hits.length, 1);
        assert.equal(evaluate({ observed: false }).required[0].hits.length, 0);
        assert.equal(evaluate({ observed: undefined }).required[0].unknown, true);
      } else assert.equal(evaluate({}).required[0].hits.length, 0);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-natal-semisextile-report'));
    const prompt = formatFortuneFactAudit(input);
    const natalAudit = exactLunar || independentMars ? describeFortuneFact({ method: 'western', type: band.factType, data: p }, String) : prompt;
    assert.match(natalAudit, sample.phrase);
    assert.match(natalAudit, /半六合属较弱的偏顺相位/u);
    if (sample.balance) {
      assert.match(result.matchedSourceExcerpt, /favourable aspect in the nativity/u);
      assert.doesNotMatch(result.matchedSourceExcerpt, /the lunar directions are evil/u);
      const provider = formatFortunePrompt(input);
      assert.match(provider, /本命半六合列为较弱的偏顺相位/u);
      assert.match(provider, /同期偏难月相引动仍需独立判断/u);
      assert.doesNotMatch(provider, sample.phrase);
    }
    if (exactLunar) assert.match(prompt, /次限月亮对(?:本命|同图次限)太阳精确形成半六合相/u);
    assert.doesNotMatch(prompt, /natalFavourableBodies|natalFavourableContacts|natalPairAspectTypes/u);
  }
});

test('p204 accepts additional natal Sun geometry without replacing either concurrent-chart premise', () => {
  const samples = [
    { birth: '1946-08-30', year: 2026, month: 6, layer: 'natal', types: ['semisquare', 'parallel', 'semisextile'],
      phrase: /出生盘太阳在同作者参考外限内的相位为本命太阳与本命金星为半刑相/u },
    { birth: '1945-04-10', year: 2035, month: 3, layer: 'progressed', types: ['conjunction', 'parallel', 'quincunx'],
      phrase: /出生盘太阳在同作者参考外限内的相位为本命太阳与本命水星为合相/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'month', targetPeriod: { year: sample.year, month: sample.month }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, sample.month - 1, 15), reference = { snapshotId: 'leo-solar-testimony-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-solar-testimony', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p204-'));
    assert.equal(result?.status, 'matched');
    const witness = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Moon' && p.natalTargetId === 'Sun' && p.aspectType === 'parallel'
      && p.targetKind === sample.layer && p.hasOtherSameLayerLunarContacts && p.hasNatalSolarTestimony && p.hasProgressedSolarTestimony);
    assert.ok(witness && witness.activeFrom < witness.activeTo, sample.birth);
    const p = witness.normalizedPayload;
    assert.deepEqual([...new Set(p.natalSolarContacts.map(contact => contact.aspect))], sample.types);
    assert.ok(p.natalSolarContacts.every(row => [row.first, row.second].includes('Sun') && row.difference <= row.orb));
    assert.ok(p.progressedSolarContacts.length && p.progressedSolarContacts.every(row => row.body === 'Sun' && row.targetKind === 'progressed'));
    assert.ok(p.contacts.some(row => row.targetKind === sample.layer && !(row.target === 'Sun' && row.aspectType === 'parallel')));
    const evaluate = overrides => evaluateFortuneRules('western', 'month',
      [{ ...witness, normalizedPayload: { ...p, ...overrides } }]).find(row => row.knowledgeId === result.knowledgeId).required[0];
    assert.equal(evaluate({}).hits.length, 0);
    assert.ok(run.facts.some(({ factType, factId }) => factType === 'leo_progressed_aspect' && result.sourceFactIds.includes(factId)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-testimony-report'));
    assert.match(formatFortuneFactAudit(input), sample.phrase);
  }
});

test('p204 only uses progressed solar dignity on the computed side of the sign crossing', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p204-'));
  const start = 0, end = 4 * day;
  const base = { ...rule.queries[0].where, start, end, targetKind: 'progressed', exactTimes: [] };
  const moon = { ...base, natalTargetId: 'Mercury', aspectType: 'sextile' };
  for (const { initial, dignity, activeBefore } of [
    { initial: 29, dignity: { sign: 0, kind: 'exaltation' }, activeBefore: true },
    { initial: 119, dignity: { sign: 4, kind: 'domicile' }, activeBefore: false },
  ]) {
    const placements = scanLeoSolarDignities({ start, end }, at => initial + at / day);
    assert.equal(placements.length, 1);
    assert.deepEqual(placements[0].dignity, dignity);
    const boundary = activeBefore ? placements[0].end : placements[0].start;
    assert.ok(Math.abs(boundary - day) < 1000);
    const rows = buildLeoLunarConditions([base, moon], placements).filter(row => row.base === base);
    assert.deepEqual(rows.map(row => [row.start, row.end]), [[start, boundary], [boundary, end]]);
    assert.deepEqual(rows.map(row => row.progressedSolarDignity), activeBefore ? [dignity, undefined] : [undefined, dignity]);
    assert.ok(rows.every(row => row.hasOtherSameLayerLunarContacts && row.hasProgressedSolarContact === false));
    const facts = rows.map(row => ({ factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, hasProgressedSolarTestimony: Boolean(row.progressedSolarDignity) } }));
    const result = evaluateFortuneRules('western', 'month', facts).find(row => row.knowledgeId === rule.knowledgeId).required[0];
    assert.deepEqual(result.hits, facts);
  }
});

test('p204 reads natal domicile and progressed exaltation from separate client chart evidence', () => {
  const samples = [
    { birth: '1937-08-19', month: 10, layer: 'natal', dignityField: 'natalSolarDignity', contactsField: 'natalSolarContacts',
      dignity: { sign: 4, kind: 'domicile' }, phrase: /本命太阳在狮子座入庙/u },
    { birth: '1920-12-08', month: 2, layer: 'progressed', dignityField: 'progressedSolarDignity', contactsField: 'progressedSolarContacts',
      dignity: { sign: 0, kind: 'exaltation' }, phrase: /同一有效段的次限太阳在白羊座擢升/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'month', targetPeriod: { year: 2026, month: sample.month }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(2026, sample.month - 1, 15), reference = { snapshotId: 'leo-solar-dignity-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-solar-dignity', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p204-'));
    assert.equal(result?.status, 'matched', sample.birth);
    const witness = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Moon' && p.natalTargetId === 'Sun' && p.aspectType === 'parallel'
      && p.targetKind === sample.layer && p.hasOtherSameLayerLunarContacts && p.hasNatalSolarTestimony && p.hasProgressedSolarTestimony
      && p[sample.contactsField]?.length === 0);
    assert.ok(witness && witness.activeFrom < witness.activeTo, sample.birth);
    const p = witness.normalizedPayload;
    assert.deepEqual(p[sample.dignityField], sample.dignity);
    assert.equal(p.hasOtherSameLayerLunarContacts, true);
    assert.ok(p.hasNatalSolarTestimony && p.hasProgressedSolarTestimony);
    const description = describeFortuneFact({ method: 'western', type: witness.factType, data: p }, String);
    assert.match(description, sample.phrase);
    assert.doesNotMatch(description, /SolarDignity|SolarTestimony/u);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-dignity-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /SolarDignity|SolarTestimony/u);
  }
});

test('p196 matches the exact lunar aspect with natal affliction and no supportive natal aspect', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2042, month: 4 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.UTC(2042, 3, 15), reference = { snapshotId: 'leo-luminary-affliction-snapshot' };
  const snapshot = chart(Date.parse('1923-09-28T00:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-luminary-affliction', reference);
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p196-'));
  assert.equal(result?.status, 'matched');
  const witness = run.facts.find(row => result.sourceFactIds.includes(row.factId) && row.factType === 'leo_lunar_exact_observation'
    && row.normalizedPayload.targetKind === 'natal');
  assert.ok(witness && witness.activeFrom < witness.activeTo);
  assert.equal(witness.activeFrom, witness.exactInstant);
  assert.deepEqual(result.windows.map(({ start, endExclusive }) => [start, endExclusive]), [[witness.activeFrom, witness.activeTo]]);
  const longitudeDifference = (witness.normalizedPayload.progressedLongitude - witness.normalizedPayload.targetLongitude + 540) % 360 - 180;
  assert.ok(Math.abs(Math.abs(longitudeDifference) - 30) < 0.00001);
  const band = leoBandForExactObservation(run, witness), p = band.normalizedPayload;
  assert.deepEqual(p.natalFavourableBodies, []);
  assert.deepEqual(p.natalAfflictedBodies, ['Sun']);
  assert.deepEqual(p.natalAfflictionContacts.map(a => [a.first, a.second, a.aspect, a.orb]),
    [['Sun', 'Jupiter', 'semisquare', 4], ['Sun', 'Neptune', 'semisquare', 4]]);
  const evaluate = fact => evaluateFortuneRules('western', 'month', [fact])
    .find(row => row.knowledgeId === result.knowledgeId).required[0];
  assert.equal(evaluate(witness).hits.length, 1);
  assert.equal(evaluate(band).hits.length, 0);
  assert.equal(evaluate({ ...witness, normalizedPayload: { ...witness.normalizedPayload, observed: undefined } }).unknown, true);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-luminary-affliction-report'));
  const prompt = formatFortuneFactAudit(input);
  const natalAudit = describeFortuneFact({ method: 'western', type: band.factType, data: p }, String);
  assert.match(natalAudit, /本命太阳与本命木星为半刑相/u);
  assert.match(natalAudit, /本命太阳与本命海王星为半刑相/u);
  assert.match(prompt, /次限月亮对本命太阳精确形成半六合相/u);
  assert.doesNotMatch(prompt, /natalAfflictionContacts|natalAfflictedBodies/u);
});

test('p236 separates its solar phase from distinct overlapping natal directions to or from the shared planet', () => {
  const rule = fortuneKnowledge.western.rules.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p236-'));
  const basis = rule.queries[0].where;
  const band = (progressedBody, natalTargetId, aspectType, targetKind, start, end) =>
    ({ progressedBody, natalTargetId, aspectType, targetKind, start, end, exactTimes: [] });
  const contacts = [
    band('Sun', 'Jupiter', 'trine', 'natal', 2, 4),
    band('Mercury', 'Mars', 'sextile', 'natal', 6, 8),
    band('Mars', 'Saturn', 'sextile', 'natal', 9, 11),
    band('Sun', 'Jupiter', 'trine', 'progressed', 13, 15),
    band('Sun', 'Saturn', 'square', 'natal', 16, 18),
    band('Venus', 'Jupiter', 'sextile', 'natal', 18, 20),
    band('Sun', 'Saturn', 'sextile', 'natal', 20, 22),
  ];
  for (const targetKind of ['natal', 'progressed']) {
    const base = { ...basis, ...band('Sun', 'Mars', 'semisextile', targetKind, 0, 20) };
    const rows = buildLeoLunarConditions([base, { ...base }, ...contacts]).filter(row => row.base === base);
    const facts = rows.map(({ base: _base, ...row }) => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...row, lunarProfile: leoLunarConditionPolicy.profile } }));
    const phase = { factType: 'leo_solar_phase', scope: 'progressed', completeness: 'complete', normalizedPayload: { ...basis, targetKind } };
    const found = evaluateFortuneRules('western', 'year', [...facts, phase]).find(row => row.knowledgeId === rule.knowledgeId).required[0].hits;
    assert.deepEqual(found, [phase]);
    const supporting = rows.filter(row => row.directionSupportState === 'favourable');
    assert.deepEqual(supporting.map(({ start, end }) => [start, end]), targetKind === 'natal' ? [[2, 4], [6, 8]] : [[2, 4], [9, 11]]);
    assert.equal(supporting[1].supportingDirections[0].body, targetKind === 'natal' ? 'Mercury' : 'Mars');
  }
});

test('p236 keeps the natal direction witness in real client windows and Chinese input for both base charts', () => {
  const samples = [
    { birth: '1948-04-27', year: 2026, layer: 'natal', first: 'Sun', second: 'Venus',
      phrase: /同段另一条推运是次限太阳对本命金星的半六合相，原书此项偏顺/u },
    { birth: '1949-04-13', year: 2049, layer: 'progressed', first: 'Mars', second: 'Saturn',
      phrase: /同段另一条推运是次限火星对本命土星的六合相，原书此项偏顺/u },
  ];
  for (const sample of samples) {
    const params = { periodType: 'year', targetPeriod: { year: sample.year }, displayTimezone: 'Asia/Shanghai' };
    const asOf = Date.UTC(sample.year, 5, 15), reference = { snapshotId: 'leo-solar-mars-snapshot' };
    const snapshot = chart(Date.parse(sample.birth + 'T00:00:00Z'));
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-solar-mars', reference);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p236-'));
    assert.equal(result?.status, 'matched');
    const matched = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(matched.length && matched.every(row => row.factType === 'leo_solar_phase'));
    const supporting = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Mars' && p.aspectType === 'semisextile' && p.targetKind === sample.layer
      && p.directionSupportState === 'favourable');
    const evidence = supporting.find(({ normalizedPayload: p }) =>
      p.supportingDirections.some(row => row.body === sample.first && row.target === sample.second && row.targetKind === 'natal'));
    assert.ok(evidence && evidence.activeFrom < evidence.activeTo);
    for (const row of supporting) {
      assert.ok(row.normalizedPayload.supportingDirections.every(witness => run.facts.some(fact => fact.factType === 'leo_progressed_aspect'
        && fact.normalizedPayload.targetKind === 'natal' && fact.normalizedPayload.progressedBody === witness.body
        && fact.normalizedPayload.natalTargetId === witness.target && fact.normalizedPayload.aspectType === witness.aspectType
        && fact.activeFrom <= row.activeFrom && row.activeTo <= fact.activeTo)));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-mars-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /directionSupportState|supportingDirections|leo-solar-mars-snapshot/u);
  }
});

test('all 294 source aspects retain their passage and profile, including the thirty-one parallel corrections', () => {
  const library = fortuneKnowledge.western;
  const prefix = 'leo-1906-interpretation-p';
  const passages = Array.from({ length: 306 }, (_, index) => index + 37)
    .filter(number => number < 133 || number > 144)
    .map(number => prefix + String(number).padStart(3, '0'));
  const passageSet = new Set(passages);
  const rules = library.rules.filter(rule => passageSet.has(rule.review?.sourcePassageId));
  assert.deepEqual(rules.map(rule => rule.review.sourcePassageId).sort(), passages);
  assert.equal(rules.length, 294); assert.equal(rules.filter(r => r.review.sourceCorrections).length, 31);
  const profiles = {
    leo_progressed_aspect: leoSourcePolicy.profile,
    leo_lunar_condition: leoSourcePolicy.profile,
    leo_lunar_exact_observation: leoSourcePolicy.lunarExactObservationProfile,
    leo_mutual_exact_observation: leoSourcePolicy.mutualExactObservationProfile,
    leo_solar_phase: leoSolarPhasePolicy.profile,
    leo_solar_lunar_phase: 'leo-1906-solar-lunar-phases-v1',
  };
  assert.equal(rules.filter(r => r.queries[0].where.targetKind?.oneOf?.includes('progressed')).length, 146);
  for (const r of rules) {
    const e = library.entries.find(e => e.id === r.knowledgeId);
    const [query] = r.queries;
    assert.ok(profiles[query.factType], r.knowledgeId);
    assert.equal(query.where.profile, profiles[query.factType], r.knowledgeId);
    if (['leo_lunar_condition', 'leo_solar_lunar_phase'].includes(query.factType)) {
      assert.equal(query.where.lunarProfile, leoLunarConditionPolicy.profile);
    }
    if (query.factType.endsWith('_exact_observation')) {
      assert.equal(query.where.observed, true);
      assert.equal(query.where.coordinate, 'ecliptic_longitude');
    }
    if (query.factType === 'leo_mutual_exact_observation') assert.equal(query.where.targetKind, 'natal');
    assert.equal(r.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: e.evidence, conditions: e.conditions })).digest('hex'));
    for (const w of [query.where, ...(query.anyOf ?? [])]) if (w.aspectType === 'parallel') {
      assert.equal(w.sameHemisphere, undefined); assert.equal(w.allowedOrb, 1); assert.equal(w.coordinate, 'equatorial_declination_of_date');
      assert.equal(r.review.sourceCorrections.originalJSONPreserved, true);
    }
  }
});

test('outbound source context is Chinese with explicit independent parallel policy, unknown permissions and no raw source indices or JSON', () => {
  const run = realRun(), report = interpretFortune(run, requestForFortuneRun(run), 'leo-context-report');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /Leo资料的本命背景/u); assert.match(prompt, /不要求南北同向/u);
  assert.match(prompt, /对同图次限/u);
  assert.match(prompt, /不等于本命允许范围/u); assert.match(prompt, /不能把时间重叠直接写成外部事件已触发/u);
  for (const token of ['leo-1906-source-context-v1', 'baseIndex', 'moonIndex', 'sourceBandIndex', 'natalAbsoluteDeclinationDifference', 'leo-source-run', 'leo-source-snapshot']) assert.ok(!prompt.includes(token), token);
  assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId.includes('leo-1906-interpretation')));
});

// Chapter XI, pp. 147–148 (PDF), distinguishes the monthly passage from its
// natal premise. Leo and Green, pp. 39 and 43–44 (PDF), describe the natal pairs.
const monthlyNeptuneCases = [
  { passage: 'p178', aspect: 'sextile', angle: 60, birth: '1984-04-01', month: 10,
    natalAspect: 'trine', nature: 'favourable', negativeBirth: '1994-09-15', negativeMonth: 4, nearMonth: 11 },
  { passage: 'p181', aspect: 'sesquiquadrate', angle: 135, birth: '1980-03-01', month: 2,
    natalAspect: 'square', nature: 'adverse', negativeBirth: '1949-06-01', negativeMonth: 9 },
  { passage: 'p182', aspect: 'quincunx', angle: 150, birth: '1996-10-01', month: 4,
    natalAspect: 'trine', nature: 'favourable', negativeBirth: '1960-01-21', negativeMonth: 7 },
  { passage: 'p182', aspect: 'quincunx', angle: 150, birth: '1991-04-15', month: 3,
    natalAspect: 'square', nature: 'adverse' },
  { passage: 'p182', aspect: 'quincunx', angle: 150, birth: '1992-04-01', month: 8,
    natalOther: 'Moon', natalAspect: 'sextile', nature: 'favourable' },
  { passage: 'p182', aspect: 'quincunx', angle: 150, birth: '1963-01-26', month: 5,
    natalOther: 'Moon', natalAspect: 'square', nature: 'adverse' },
];

for (const sample of monthlyNeptuneCases) {
  test(`monthly Neptune ${sample.passage} keeps actual ${sample.nature} natal ${sample.natalOther ?? 'Mercury'} evidence local`, () => {
    function replay(birthDate, month, expectedLayers = ['natal', 'progressed'], armc = 0) {
      const birthAt = Date.parse(birthDate + 'T00:00:00Z');
      const now = Date.UTC(2026, month - 1, 15);
      const parameters = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
      const reference = { snapshotId: `leo-monthly-neptune-${birthDate}-${month}` };
      const natalChart = chart(birthAt, armc ?? 0);
      if (armc === null) delete natalChart.western.rawResult[0].midheaven;
      const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now,
        { ...reference, chart: natalChart })));
      const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
      const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-' + sample.passage + '-'));
      const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_exact_observation'
        && p.observed === true && p.natalTargetId === 'Neptune' && p.aspectType === sample.aspect);
      assert.deepEqual([...new Set(facts.map(fact => fact.normalizedPayload.targetKind))].sort(), expectedLayers);
      for (const fact of facts) {
        const p = fact.normalizedPayload;
        const distance = Math.abs((p.progressedLongitude - p.targetLongitude + 540) % 360 - 180);
        assert.ok(Math.abs(distance - sample.angle) < 0.00001, String(distance));
        assert.ok(Date.parse(fact.activeTo) - Date.parse(fact.activeFrom) <= 1000);
      }
      return { run, match, facts };
    }
    const { run, match, facts } = replay(sample.birth, sample.month);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.unresolvedConditions, []);
    for (const { factId, normalizedPayload: p } of facts) {
      assert.ok(match.sourceFactIds.includes(factId));
      assert.equal(p.hasLunarNeptuneTestimony, true);
      assert.ok(p.lunarNeptuneTestimonies.some(row => row.first === (sample.natalOther ?? 'Mercury') && row.second === 'Neptune'
        && row.aspect === sample.natalAspect && row.nature === sample.nature));
      if (sample.natalOther === 'Moon') assert.ok(p.lunarNeptuneTestimonies.every(row => row.other === 'Moon'));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-monthly-neptune'));
    assert.match(formatFortuneFactAudit(input), /这处本命见位供核海王星倾向和限制条件/u);
    const providerPrompt = formatFortunePrompt(input);
    assert.doesNotMatch(providerPrompt, /这处本命见位供核海王星倾向和限制条件|lunarNeptuneTestimonies/u);
    const meaning = getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning;
    assert.ok(providerPrompt.includes(meaning));
    if (sample.nearMonth) {
      const adjacent = replay(sample.birth, sample.nearMonth, []);
      assert.equal(adjacent.match.status, 'not_matched');
      assert.ok(adjacent.run.facts.some(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
        && p.progressedBody === 'Moon' && p.natalTargetId === 'Neptune' && p.aspectType === sample.aspect));
    }
    if (!sample.negativeBirth) return;
    const negative = replay(sample.negativeBirth, sample.negativeMonth);
    assert.ok(negative.facts.every(row => row.normalizedPayload.hasLunarNeptuneTestimony === false));
    assert.equal(negative.match.status, 'matched');
    if (sample.passage !== 'p182') return;

    assert.ok(negative.facts.every(({ normalizedPayload: p }) => p.natalTargetHouse !== 1
      && p.natalNeptuneApproachingAscendant === false && p.hasLunarNeptuneDevotionalContact === false
      && p.hasNatalSunNeptuneCreativeContact === false));
    const { input: weakInput } = buildFortuneModelContext(negative.run,
      interpretFortune(negative.run, requestForFortuneRun(negative.run), 'leo-monthly-neptune-weak'));
    const weakPrompt = formatFortunePrompt(weakInput);
    assert.ok(weakPrompt.includes('月海梅花的影响通常很弱'));
    assert.ok(weakPrompt.includes('若本命已有相关敏感见证，才可参考更明显的牵制感'));
    assert.doesNotMatch(weakPrompt, /本命海王星实居第一宫|hasLunarNeptuneTestimony|natalNeptuneApproachingAscendant/u);

    // Leo and Green, p. 59: the Neptune entry names the planet rising in
    // the house sequence. Hold the date and geocentric aspects constant.
    const rising = replay(sample.negativeBirth, sample.negativeMonth, undefined, 125);
    const approaching = replay(sample.negativeBirth, sample.negativeMonth, undefined, 131);
    const beyond = replay(sample.negativeBirth, sample.negativeMonth, undefined, 132);
    const unavailable = replay(sample.negativeBirth, sample.negativeMonth, undefined, null);
    assert.ok([rising, approaching, beyond, unavailable].every(sample => sample.match.status === 'matched'));
    const { input: risingInput } = buildFortuneModelContext(rising.run,
      interpretFortune(rising.run, requestForFortuneRun(rising.run), 'leo-monthly-neptune-rising'));
    const risingProse = /本命海王星实居第一宫，作为 Leo 与 Green 所列海王星升起的感受性候选/u;
    assert.match(formatFortuneFactAudit(risingInput), risingProse);
    assert.doesNotMatch(formatFortunePrompt(risingInput), risingProse);
    const { input: approachingInput } = buildFortuneModelContext(approaching.run,
      interpretFortune(approaching.run, requestForFortuneRun(approaching.run), 'leo-monthly-neptune-approaching'));
    const approachProse = /本命海王星在第12宫，距前方第1角宫宫头/u;
    assert.match(formatFortuneFactAudit(approachingInput), approachProse);
    assert.doesNotMatch(formatFortunePrompt(approachingInput), approachProse);
    for (const [observed, house, approach] of [[rising, 1, false], [approaching, 12, true], [beyond, 12, false],
      [negative, 5, false], [unavailable, undefined, undefined]]) {
      assert.deepEqual(observed.facts.map(fact => fact.exactInstant), rising.facts.map(fact => fact.exactInstant));
      for (const { factId, normalizedPayload: p } of observed.facts) {
        assert.equal(p.hasLunarNeptuneTestimony, false);
        assert.equal(p.natalTargetHouse, house);
        assert.equal(p.natalNeptuneApproachingAscendant, approach);
        if (approach) {
          const witness = p.natalNeptuneAscendantApproach;
          assert.deepEqual([witness.fromHouse, witness.nextHouse], [12, 1]);
          assert.ok(witness.distance > 4 && witness.distance < 5);
        } else assert.equal(p.natalNeptuneAscendantApproach, undefined);
        assert.ok(observed.match.sourceFactIds.includes(factId));
      }
    }
  });
}

// Leo, Chapter XII, PDF pp. 153–154: technically complete mutual aspects
// can be read on the mental plane. The described target is a natal planet.
const annualMutualGroups = [
  { birth: '1950-10-01', neighbor: 2025, rows: [
    { passage: 'p079', moving: 'Mercury', target: 'Jupiter', aspect: 'semisquare', angle: 45 },
  ] },
  { birth: '1948-02-01', neighbor: 2027, rows: [
    { passage: 'p093', moving: 'Mercury', target: 'Mars', aspect: 'sesquiquadrate', angle: 135 },
  ] },
  { birth: '1940-12-01', neighbor: 2025, rows: [
    { passage: 'p110', moving: 'Mercury', target: 'Saturn', aspect: 'sextile', angle: 60 },
  ] },
  { birth: '1947-02-15', neighbor: 2027, rows: [
    { passage: 'p119', moving: 'Mercury', target: 'Uranus', aspect: 'semisquare', angle: 45 },
  ] },
  { birth: '1987-04-18', birthTime: '05:48:00', neighbor: 2025, rows: [
    { passage: 'p339', moving: 'Venus', target: 'Uranus', aspect: 'sesquiquadrate', angle: 135 },
  ] },
  { birth: '1935-06-24', neighbor: 2025, rows: [
    { passage: 'p074', moving: 'Mars', target: 'Uranus', aspect: 'quincunx', angle: 150 },
    { passage: 'p113', moving: 'Mercury', target: 'Saturn', aspect: 'sesquiquadrate', angle: 135 },
  ] },
  { birth: '1941-01-12', neighbor: 2025, rows: [
    { passage: 'p109', moving: 'Mercury', target: 'Saturn', aspect: 'semisquare', angle: 45 },
    { passage: 'p120', moving: 'Mercury', target: 'Uranus', aspect: 'sextile', angle: 60 },
  ] },
  { birth: '1941-02-08', neighbor: 2027, rows: [
    { passage: 'p071', moving: 'Mars', target: 'Uranus', aspect: 'square', angle: 90 },
  ] },
  { birth: '1944-08-12', neighbor: 2027, rows: [
    { passage: 'p341', moving: 'Venus', target: 'Uranus', aspect: 'opposition', angle: 180 },
  ] },
  { birth: '1985-04-24', neighbor: 2025, rows: [
    { passage: 'p064', moving: 'Mars', target: 'Saturn', aspect: 'quincunx', angle: 150 },
    { passage: 'p304', moving: 'Venus', target: 'Mars', aspect: 'semisextile', angle: 30 },
  ] },
  { birth: '1935-05-20', neighbor: 2025, rows: [
    { passage: 'p050', moving: 'Mars', target: 'Neptune', aspect: 'sextile', angle: 60 },
  ] },
  { birth: '1935-09-08', neighbor: 2025, rows: [
    { passage: 'p315', moving: 'Venus', target: 'Neptune', aspect: 'semisquare', angle: 45 },
  ] },
  { birth: '1935-10-20', neighbor: 2025, rows: [
    { passage: 'p104', moving: 'Mercury', target: 'Neptune', aspect: 'quincunx', angle: 150 },
  ] },
  { birth: '1936-01-01', neighbor: 2025, rows: [
    { passage: 'p321', moving: 'Venus', target: 'Neptune', aspect: 'opposition', angle: 180 },
  ] },
  { birth: '1937-11-12', neighbor: 2027, rows: [
    { passage: 'p320', moving: 'Venus', target: 'Neptune', aspect: 'quincunx', angle: 150 },
  ] },
  { birth: '1938-01-12', neighbor: 2025, rows: [
    { passage: 'p319', moving: 'Venus', target: 'Neptune', aspect: 'sesquiquadrate', angle: 135 },
  ] },
  { birth: '1939-12-08', neighbor: 2025, rows: [
    { passage: 'p053', moving: 'Mars', target: 'Neptune', aspect: 'sesquiquadrate', angle: 135 },
  ] },
];

for (const group of annualMutualGroups) {
  const passages = group.rows.map(row => row.passage).join(', ');
  test(`annual mutual ${passages} require the exact natal-target crossing in the requested year`, () => {
    const birthAt = Date.parse(group.birth + 'T' + (group.birthTime ?? '00:00:00') + 'Z');
    const snapshot = chart(birthAt);

    function replay(year) {
      const now = Date.UTC(year, 6, 1);
      const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
      const reference = { snapshotId: `leo-annual-mutual-${group.birth}-${year}` };
      const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now,
        { ...reference, chart: snapshot })));
      const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
      const matches = matchFortuneKnowledge(run).byMethod.western;
      const report = interpretFortune(run, requestForFortuneRun(run), 'leo-annual-mutual-' + year);
      const input = buildFortuneModelContext(run, report).input;
      return { run, matches, prompt: formatFortunePrompt(input) };
    }

    const positive = replay(2026);
    const nearby = replay(group.neighbor);
    assert.doesNotMatch(positive.prompt, /作为该年心理倾向的参考|leo_mutual_exact_observation/u);
    for (const { passage, moving, target, aspect, angle } of group.rows) {
      const identifies = ({ normalizedPayload: p }) => p.progressedBody === moving && p.natalTargetId === target
        && p.aspectType === aspect;
      const isRule = row => row.knowledgeId.includes('-' + passage + '-');
      const match = positive.matches.find(isRule);
      assert.equal(match.status, 'matched', passage);
      const facts = positive.run.facts.filter(row => match.sourceFactIds.includes(row.factId));
      assert.ok(facts.length > 0);
      for (const fact of facts) {
        assert.equal(fact.factType, 'leo_mutual_exact_observation');
        assert.ok(identifies(fact));
        assert.equal(fact.normalizedPayload.targetKind, 'natal');
        const at = Date.parse(fact.exactInstant);
        assert.ok(at >= Date.UTC(2026, 0, 1) && at < Date.UTC(2027, 0, 1));
        assert.ok(Date.parse(fact.activeTo) - Date.parse(fact.activeFrom) <= 1000);
        const progressed = Ecliptic(GeoVector(Body[moving], new Date(progressionEpoch(birthAt, at)), true)).elon;
        const fixed = snapshot.western.rawResult[0].positions.find(row => row.planet === target).longitude;
        assert.ok(Math.abs(Math.abs((progressed - fixed + 540) % 360 - 180) - angle) < 0.00001, passage);
      }
      const wrongLayer = { ...facts[0], normalizedPayload: { ...facts[0].normalizedPayload, targetKind: 'progressed' } };
      const evaluation = evaluateFortuneRules('western', 'year', [wrongLayer]).find(isRule);
      assert.deepEqual([evaluation.required[0].hits.length, evaluation.required[0].unknown], [0, false], passage);
      const meaning = getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning;
      assert.ok(positive.prompt.includes(meaning), passage);
      assert.ok(nearby.run.facts.some(row => row.factType === 'leo_progressed_aspect'
        && identifies(row) && row.normalizedPayload.targetKind === 'natal'), passage);
      assert.equal(nearby.matches.find(isRule).status, 'not_matched', passage);
      assert.ok(!nearby.prompt.includes(meaning), passage);
    }
  });
}
