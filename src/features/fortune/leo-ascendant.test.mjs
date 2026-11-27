import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition, SiderealTime, MakeTime, e_tilt, RotateVector, Rotation_EQD_ECT, Vector } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { readLeoAscendantDivision, splitLeoAscendantContext, buildLeoAscendantContext, leoAscendantPolicy } = await import('./control/leo-ascendant.ts');
const { buildWesternSourceHouses, progressedHouseFrame, readWesternHouseFrame } = await import('./control/western-houses.ts');
const { buildWesternProgressions, progressionEpoch } = await import('./control/western-progressions.ts');
const { buildLeoSourceContext } = await import('./control/leo-source-context.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge, evaluateFortuneRules } = await import('./control/knowledge/catalog.ts');
const { createWriter } = await import('./control/facts/context.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, maxFortuneSubmissionBytes, readClientFactTime } = await import('./server/client-facts.mjs');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/leo-ascendant-reference.json', import.meta.url)));
const day = 86400000, rad = Math.PI / 180, born = Date.parse('1990-01-01T04:00:00Z'), iso = at => new Date(at).toISOString();
const normalize = value => (value % 360 + 360) % 360;
const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const natalPositions = birth => planets.map(planet => ({ planet, longitude: planet === 'Sun'
  ? SunPosition(new Date(birth)).elon : Ecliptic(GeoVector(Body[planet], new Date(birth), true)).elon }));
const positions = natalPositions(born);
const fixtureNatal = { bodies: planets.slice(0, 9).map((body, i) => ({ body, longitude: i * 30 + 5, sign: i, declination: i - 4, house: i + 1 })), sunHouse: 1 };
const cusps = Array.from({ length: 12 }, (_, i) => i * 30 + 5);
const band = (longitude, start = 0, end = 10 * day) => ({ longitude, start, end, sign: Math.floor(longitude / 30), decan: Math.floor(longitude % 30 / 10) + 1 });
const contact = (progressedBody, start, end, times = []) => ({ progressedBody, natalTargetId: 'Venus', aspectType: 'trine',
  coordinate: 'ecliptic_longitude', allowedOrb: 1, start: start * day, end: end * day, exactTimes: times.map(at => at * day) });
// Independent vector intersections and sidereal interpolation, rather than
// deriving expected angles from production's trigonometric inverse functions.
function vectorAngles(armc, latitude, at = born) {
  const time = MakeTime(new Date(at)), rotate = Rotation_EQD_ECT(time), theta = armc * rad, phi = latitude * rad;
  const east = RotateVector(rotate, new Vector(-Math.sin(theta), Math.cos(theta), 0, time));
  const zenith = RotateVector(rotate, new Vector(Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi), time));
  const meridian = RotateVector(rotate, new Vector(Math.cos(theta), Math.sin(theta), 0, time));
  const intersection = (normal, toward) => {
    let x = normal.y, y = -normal.x;
    if (x * toward.x + y * toward.y < 0) { x = -x; y = -y; }
    return normalize(Math.atan2(y, x) / rad);
  };
  return { ascendant: intersection(zenith, east), midheaven: intersection(east, meridian) };
}
function independentProgressed(armc, latitude, at) {
  const symbolic = (progressionEpoch(born, at) - born) / day, whole = Math.floor(symbolic), fraction = symbolic - whole;
  const first = born + whole * day, next = first + day;
  const start = SiderealTime(new Date(first)) * 15;
  const progressedArmc = normalize(armc + start - SiderealTime(new Date(born)) * 15
    + fraction * normalize(SiderealTime(new Date(next)) * 15 - start));
  // The very small within-day obliquity change is checked independently to
  // 1e-5 degrees; it cannot move any selected middle-of-decan test case.
  return vectorAngles(progressedArmc, latitude, first).ascendant;
}
function chart(armc = 300, latitude = 35, birth = born) {
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1',
    rawResult: [{ julianDay: birth / day + 2440587.5, ...vectorAngles(armc, latitude, birth),
      positions: birth === born ? structuredClone(positions) : natalPositions(birth) }],
  } };
}
let cached;
function realRun() {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  return cached ??= calculateFortuneFacts(params, buildFactTimeContext(params, Date.parse('2026-11-19T00:00:00Z'), 'server'),
    'ascendant-test-run', { snapshotId: 'ascendant-test-snapshot', chart: chart() });
}
const facts = run => run.facts.filter(f => f.factType === 'leo_ascendant_context');
const rules = () => fortuneKnowledge.western.rules.filter(r => r.queries[0]?.factType === 'leo_ascendant_context');
const passage = (rows, id) => rows.find(row => row.knowledgeId.endsWith('-leo-1906-interpretation-' + id + '-001'));
const completePassages = Array.from({ length: 36 }, (_, index) => index + 1)
  .map(number => 'p' + String(number).padStart(3, '0'));

test('visually transcribed 36 decans and same-author sign rulers agree at every half-open boundary', () => {
  assert.equal(ref.decanSigns.length, 12);
  for (let sign = 0; sign < 12; sign++) for (let decan = 1; decan <= 3; decan++) {
    const low = sign * 30 + (decan - 1) * 10;
    for (const longitude of [low, low + 5, low + 10 - 1e-8]) {
      const row = readLeoAscendantDivision(longitude);
      assert.equal(row.sign, sign); assert.equal(row.decan, decan);
      assert.equal(row.decanSign, ref.decanSigns[sign][decan - 1]);
      assert.equal(row.signRuler, ref.signRulers[sign]);
      assert.equal(row.decanRuler, ref.signRulers[ref.decanSigns[sign][decan - 1]]);
    }
  }
  for (const invalid of [-1, 360, NaN, Infinity, undefined]) assert.throws(() => readLeoAscendantDivision(invalid), RangeError);
  assert.equal(readLeoAscendantDivision(305).signRuler, 'Saturn');
  assert.equal(readLeoAscendantDivision(335).signRuler, 'Jupiter');
  assert.equal(readLeoAscendantDivision(215).signRuler, 'Mars');
});

test('natal sign/decan and their lifelong priority cannot be overwritten by progressed sign or its modifier', () => {
  for (let native = 0; native < 36; native++) {
    const longitude = native * 10 + 5, shifted = cusps.map((_, i) => normalize(longitude + 30 * i));
    const progressed = (native + 13) % 36;
    const [row] = splitLeoAscendantContext({ start: 0, end: day }, [band(progressed * 10 + 5, 0, day)], [], fixtureNatal, longitude, shifted);
    assert.equal(row.natalSign, Math.floor(native / 3)); assert.equal(row.natalDecan, native % 3 + 1);
    assert.equal(row.natalDecanSign, ref.decanSigns[row.natalSign][row.natalDecan - 1]);
    assert.equal(row.natalSignRuler, ref.signRulers[row.natalSign]);
    assert.equal(row.sign, Math.floor(progressed / 3)); assert.equal(row.decan, progressed % 3 + 1);
    assert.equal(row.hierarchy, leoAscendantPolicy.hierarchy); assert.equal(row.wholeSignApplies, true);
    assert.equal(row.decanModifier, row.decan !== 1); assert.equal(row.geometryOnly, true);
    assert.equal(row.good, undefined); assert.equal(row.capacity, undefined);
    assert.equal(new Set(row.rulerPositions.map(p => p.body)).size, row.rulerPositions.length);
  }
});

test('all directions split the same ascendant interval; no aspect crosses a gap and exact points belong to one fragment', () => {
  const aspects = [contact('Moon', 2, 6, [3, 4]), contact('Sun', 4, 8, [6]), contact('Mercury', 3, 5, [4]), contact('Mars', 10, 12, [11])];
  const rows = splitLeoAscendantContext({ start: 0, end: 10 * day }, [band(15)], aspects, fixtureNatal, 5, cusps);
  assert.deepEqual(rows.map(r => r.start / day), [0, 2, 3, 4, 5, 6, 8]);
  assert.deepEqual(rows.map(r => r.end / day), [2, 3, 4, 5, 6, 8, 10]);
  for (const row of rows) assert.deepEqual(row.directions.map(a => a.sourceBandIndex).sort(),
    aspects.flatMap((a, i) => a.start <= row.start && row.end <= a.end ? [i] : []));
  for (let i = 0; i < aspects.length; i++) assert.deepEqual(rows.flatMap(row => row.directions
    .filter(a => a.sourceBandIndex === i).flatMap(a => a.exactTimes)), aspects[i].exactTimes.filter(at => at < 10 * day));
  const gaps = splitLeoAscendantContext({ start: 0, end: 10 * day }, [band(15, 0, 3 * day), band(25, 7 * day, 10 * day)], aspects, fixtureNatal, 5, cusps);
  assert.ok(gaps.every(r => r.end <= 3 * day || r.start >= 7 * day));
  assert.ok(gaps.every(r => r.sign === 0)); assert.ok(gaps.filter(r => r.decan === 3).every(r => r.directions.every(a => a.progressedBody === 'Sun')));
});

test('Aquarius Mercury retains the ten-degree theme and independently classifies its actual Mercury contacts', () => {
  const direction = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact(body, start, end), natalTargetId: target, aspectType, targetKind });
  const rows = splitLeoAscendantContext({ start: 0, end: 10 * day }, [band(315)], [
    direction('Mercury', 'Jupiter', 'sextile', 0, 2),
    direction('Moon', 'Mercury', 'square', 0, 7, 'progressed'),
    direction('Moon', 'Mercury', 'sextile', 4, 7),
    direction('Moon', 'Mercury', 'trine', 7, 9, 'progressed'),
  ], fixtureNatal, 5, cusps);
  assert.deepEqual(rows.map(row => [row.start / day, row.natalDirectionState, row.progressedDirectionState]),
    [[0, 'favourable', 'adverse'], [2, 'none', 'adverse'], [4, 'favourable', 'adverse'], [7, 'none', 'favourable'], [9, 'none', 'none']]);
  assert.deepEqual(rows[0].natalFavourableDirectionTargets, ['Jupiter']);
  const payloads = rows.map(normalizedPayload => ({ factType: 'leo_ascendant_context', scope: 'progressed', completeness: 'complete', normalizedPayload }));
  const result = passage(evaluateFortuneRules('western', 'year', payloads), 'p002');
  assert.deepEqual(result.required[0].hits, payloads);
  assert.deepEqual(rows.filter(row => [row.natalFavourableDirectionTargets, row.progressedFavourableDirectionTargets]
    .some(targets => targets.includes('Mercury'))).map(row => [row.start / day, row.end / day]), [[4, 7], [7, 9]]);
  const withNoProfile = { ...payloads[2], normalizedPayload: { ...rows[2], directionProfile: undefined } };
  assert.equal(passage(evaluateFortuneRules('western', 'year', [withNoProfile]), 'p002').required[0].unknown, true);
});

test('ten-degree rules distinguish a basic theme from extra required directions', () => {
  for (const [id, angle, accepted] of [
    ['p003', 325], ['p006', 25], ['p008', 105], ['p011', 285], ['p014', 75], ['p017', 135], ['p018', 145],
    ['p012', 295],
    ['p023', 345], ['p024', 355], ['p026', 255], ['p027', 265], ['p029', 225], ['p030', 235],
  ]) {
    const [base] = splitLeoAscendantContext({ start: 0, end: day }, [band(angle)], [], fixtureNatal, 5, cusps);
    const outcomes = [
      ['none', 'none'], ['favourable', 'none'], ['adverse', 'none'], ['mixed', 'none'],
      ['none', 'favourable'], ['none', 'adverse'], ['none', 'mixed'],
    ];
    const rows = outcomes.map(([natalDirectionState, progressedDirectionState]) => ({
      factType: 'leo_ascendant_context', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, natalDirectionState, progressedDirectionState },
    }));
    const result = passage(evaluateFortuneRules('western', 'year', rows), id).required[0];
    assert.deepEqual(result.hits, accepted ? rows.filter((_, i) => outcomes[i].some(state => accepted.includes(state))) : rows, id);
  }
});

test('Aquarius whole-sign reform candidates keep the exact natal Mercury-to-Uranus direction and its active interval', () => {
  const direction = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact(body, start, end), natalTargetId: target, aspectType, targetKind });
  const rows = splitLeoAscendantContext({ start: 0, end: 10 * day }, [
    band(305, 0, 2 * day), band(315, 2 * day, 5 * day), band(325, 5 * day, 10 * day),
  ], [
    direction('Mercury', 'Uranus', 'sextile', 1, 2),
    direction('Mercury', 'Uranus', 'square', 2, 4),
    direction('Mercury', 'Uranus', 'trine', 5, 6),
    direction('Mercury', 'Uranus', 'trine', 6, 7, 'progressed'),
    direction('Uranus', 'Mercury', 'square', 7, 8),
    direction('Mercury', 'Jupiter', 'trine', 8, 9),
    direction('Mercury', 'Uranus', 'semisquare', 9, 10),
  ], fixtureNatal, 5, cusps);
  assert.deepEqual(rows.map(row => row.natalMercuryUranusDirectionState),
    ['none', 'favourable', 'adverse', 'none', 'favourable', 'none', 'none', 'none', 'none']);
  const payloads = rows.map(normalizedPayload => ({ factType: 'leo_ascendant_context', scope: 'progressed', completeness: 'complete', normalizedPayload }));
  const hit = payloads => passage(evaluateFortuneRules('western', 'year', payloads), 'p001').required[0];
  assert.deepEqual(hit(payloads).hits, payloads);
  assert.deepEqual(rows.filter(row => row.natalMercuryUranusDirectionState !== 'none').map(row => [row.start / day, row.end / day]),
    [[1, 2], [2, 4], [5, 6]]);
  assert.equal(hit([{ ...payloads[1], normalizedPayload: { ...rows[1], directionProfile: undefined } }]).unknown, true);
});

test('Capricorn and Leo decan themes keep classified directions to actual natal house anchors as separate evidence', () => {
  const direction = (body, target, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact(body, start, end), natalTargetId: target, aspectType, targetKind });
  const natal = structuredClone(fixtureNatal);
  Object.assign(natal.bodies.find(row => row.body === 'Moon'), { longitude: 70, sign: 2, house: 3 });
  const read = (angle, aspects) => splitLeoAscendantContext({ start: 0, end: 10 * day }, [band(angle)], aspects, natal, 5, cusps);
  const hitStarts = (rows, id) => {
    const payloads = rows.map(normalizedPayload => ({ factType: 'leo_ascendant_context', scope: 'progressed', completeness: 'complete', normalizedPayload }));
    return passage(evaluateFortuneRules('western', 'year', payloads), id).required[0].hits.map(row => row.normalizedPayload.start / day);
  };

  const capricorn = read(285, [
    direction('Sun', 'Saturn', 'square', 0, 4),
    direction('Sun', 'Venus', 'trine', 2, 5),
    direction('Sun', 'Saturn', 'sextile', 4, 6, 'progressed'),
  ]);
  assert.deepEqual(hitStarts(capricorn, 'p010'), capricorn.map(row => row.start / day));
  assert.deepEqual(capricorn.filter(row => row.natalHousesWithClassifiedDirections.includes(10)).map(row => row.start / day), [0, 2]);
  assert.deepEqual(hitStarts(capricorn, 'p011'), capricorn.map(row => row.start / day));
  assert.deepEqual(capricorn.filter(row => row.natalHousesWithFavourableDirections.includes(2)).map(row => row.start / day), [2, 4]);
  assert.deepEqual(capricorn[1].natalHouseDirections.map(row => [row.house, row.occupants, row.ruler, row.contacts[0]?.nature]),
    [[2, [], 'Venus', 'favourable'], [10, [], 'Saturn', 'adverse']]);

  const leo = read(135, [
    direction('Sun', 'Mars', 'trine', 0, 6),
    direction('Moon', 'Mercury', 'square', 2, 4, 'progressed'),
    direction('Moon', 'Neptune', 'trine', 4, 6),
    direction('Sun', 'Mars', 'trine', 6, 8, 'progressed'),
  ]);
  assert.deepEqual(hitStarts(leo, 'p017'), leo.map(row => row.start / day));
  assert.deepEqual(leo.filter(row => row.natalHousesWithFavourableDirections.includes(5) && !row.hasAdverseAscendantDirection)
    .map(row => row.start / day), [0, 4]);
  assert.deepEqual(leo.map(row => [row.hasAdverseAscendantDirection, row.hasUnresolvedAscendantDirection]),
    [[false, false], [true, false], [false, true], [false, false], [false, false]]);
  assert.deepEqual(leo[0].natalHouseDirections[0].occupants, ['Mars']);
  assert.equal(leo[0].natalHouseDirections[0].contacts[0].natalTargetId, 'Mars');
});

test('inconsistent divisions, duplicate/missing natal rulers, invalid ranges and bad exact times are rejected', () => {
  const split = (bands = [band(5)], natal = fixtureNatal, aspects = []) => splitLeoAscendantContext({ start: 0, end: day }, bands, aspects, natal, 5, cusps);
  assert.throws(() => split([{ ...band(5), decan: 2 }]), /division/u);
  assert.throws(() => split([band(5, 0, day), band(15, 0, day)]), /context/u);
  assert.throws(() => split([], { bodies: fixtureNatal.bodies.slice(1) }), /bodies/u);
  assert.throws(() => split([], { bodies: [...fixtureNatal.bodies, fixtureNatal.bodies[0]] }), /bodies/u);
  assert.throws(() => split(undefined, undefined, [contact('Moon', 0, 1, [1])]), /context/u);
  assert.equal(buildLeoAscendantContext({ start: 0, end: day }, { status: 'uncertain' }, { status: 'ready' }).status, 'unavailable');
});

test('36 independently selected real natal frames reach every decan, preserving whole-sign and modifier applicability', () => {
  const window = { start: Date.parse('2026-11-19T00:00:00Z'), end: Date.parse('2026-11-20T00:00:00Z') }, frames = new Map();
  for (let armc = 0.5; armc < 360; armc += 0.5) {
    const longitude = independentProgressed(armc, 25, (window.start + window.end) / 2);
    if (longitude % 10 > 3 && longitude % 10 < 7 && !frames.has(Math.floor(longitude / 10))) frames.set(Math.floor(longitude / 10), armc);
  }
  assert.equal(frames.size, 36);
  const progression = buildWesternProgressions(window, window.start, chart()), run = realRun(), reached = new Set();
  const complete = new Set();
  const ascendantRules = rules();
  for (const [division, armc] of frames) {
    const snapshot = chart(armc, 25), houses = buildWesternSourceHouses(window, snapshot, []);
    const leo = buildLeoSourceContext(window, snapshot, progression), calculation = buildLeoAscendantContext(window, houses, leo);
    assert.equal(calculation.status, 'ready'); assert.ok(calculation.intervals.length);
    const writer = createWriter('western', { periodType: 'year' }, { snapshotId: run.natalChartSnapshotId }, run.calculationRunId);
    const raw = writer.raw(calculation);
    for (const row of calculation.intervals) {
      assert.equal(row.sign * 3 + row.decan - 1, division);
      assert.equal(row.natalSignRuler, ref.signRulers[Math.floor(snapshot.western.rawResult[0].ascendant / 30)]);
      assert.ok(Math.abs(row.longitude - independentProgressed(armc, 25, row.longitudeSampleAt)) < 1e-5);
      writer.add(row, { scope: 'progressed', factType: 'leo_ascendant_context', subjectIds: ['western:candidate:0', 'ASC'], normalizedPayload: row }, raw);
    }
    const applicable = ascendantRules.filter(({ queries: [q] }) => q.where.sign === Math.floor(division / 3)
      && (q.where.decan === undefined || q.where.decan === division % 3 + 1));
    assert.equal(applicable.length, division % 3 === 0 ? 1 : 2);
    const candidateRun = { ...run, facts: writer.facts, rawFacts: writer.rawFacts };
    const actual = matchFortuneKnowledge(candidateRun).byMethod.western
      .filter(r => ['matched', 'partial'].includes(r.status) && ascendantRules.some(q => q.knowledgeId === r.knowledgeId));
    assert.ok(actual.every(row => applicable.some(rule => row.knowledgeId === rule.knowledgeId)));
    assert.ok(applicable.filter(({ queries: [q] }) => !q.anyOf && !q.where.houseDirectionProfile && !q.where.natalMercuryUranusDirectionState)
      .every(rule => actual.some(row => row.knowledgeId === rule.knowledgeId)));
    for (const rule of applicable) reached.add(rule.knowledgeId);
    for (const row of actual.filter(row => row.status === 'matched')) complete.add(row.knowledgeId.split('-').at(-2));
    if (division === 22) {
      const scorpioSecond = passage(actual, 'p029');
      assert.equal(scorpioSecond.status, 'matched');
      assert.ok(facts(candidateRun).every(({ normalizedPayload: p }) => p.signRuler === 'Mars'
        && p.decanSign === 11 && p.decanRuler === 'Jupiter' && p.natalContextReady));
      const { input } = buildFortuneModelContext(candidateRun,
        interpretFortune(candidateRun, requestForFortuneRun(candidateRun), 'leo-ascendant-scorpio'));
      assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === scorpioSecond.knowledgeId)));
      assert.doesNotMatch(formatFortunePrompt(input), /natalContextReady|decanRuler|rulerPositions/u);
    } else assert.equal(passage(actual, 'p029'), undefined);
  }
  assert.equal(reached.size, 36);
  assert.deepEqual([...complete].sort(), completePassages);
});

test('full year facts have linked provenance, actual unbroken ascendant membership and every simultaneous source direction', () => {
  const run = realRun(); validateFortuneFacts(run); assert.notEqual(run.methods.western.status, 'failed');
  const rows = facts(run); assert.ok(rows.length > 1);
  const leo = run.rawFacts.find(raw => raw.payload.policy?.profile === 'leo-1906-source-context-v1').payload.calculation;
  const directions = [...leo.intervals, ...leo.progressedPairs];
  assert.ok(rows.some(row => row.normalizedPayload.directions.some(direction => direction.targetKind === 'progressed')));
  const frame = readWesternHouseFrame(chart());
  for (const row of rows) {
    const p = row.normalizedPayload, start = Date.parse(row.activeFrom), end = Date.parse(row.activeTo);
    assert.ok(row.sourceFactIds.length >= 3); assert.ok(row.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
    const physical = progressedHouseFrame(born, (start + end) / 2, frame.armc, frame.latitude).ascendant;
    assert.equal(Math.floor(physical / 30), p.sign); assert.equal(Math.floor(physical % 30 / 10) + 1, p.decan);
    assert.deepEqual(p.directions.map(a => [a.sourceBandIndex, a.targetKind]),
      directions.flatMap((a, i) => a.start <= start && end <= a.end ? [[i, a.targetKind]] : []));
    assert.ok(p.directions.every(a => a.exactTimes.every(at => row.activeFrom <= at && at < row.activeTo)));
  }
  const physical = run.facts.filter(f => f.factType === 'progressed_ascendant');
  for (const interval of physical) {
    const same = rows.filter(row => interval.activeFrom <= row.activeFrom && row.activeTo <= interval.activeTo);
    assert.equal(same[0].activeFrom, interval.activeFrom); assert.equal(same.at(-1).activeTo, interval.activeTo);
    assert.ok(same.slice(1).every((row, i) => row.activeFrom === same[i].activeTo));
  }
});

test('all 36 reviewed rules retain their source and validate the clock, rulers and both layers', () => {
  assert.equal(rules().length, 36);
  assert.deepEqual(rules().filter(rule => !rule.unresolved.length).map(rule => rule.knowledgeId.split('-').at(-2)).sort(), completePassages);
  for (const rule of rules()) {
    const source = fortuneKnowledge.western.entries.find(x => x.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: source.evidence, conditions: source.conditions })).digest('hex'));
    assert.equal(rule.queries[0].where.rulershipBasis, leoAscendantPolicy.rulershipBasis);
  }
  const run = realRun();
  const qualified = matchFortuneKnowledge(run).byMethod.western.find(row => row.status === 'matched'
    && rules().some(rule => rule.knowledgeId === row.knowledgeId));
  assert.ok(qualified);
  const one = structuredClone(facts(run).find(fact => qualified.sourceFactIds.includes(fact.factId)));
  const status = record => matchFortuneKnowledge({ ...run, facts: [record] }).byMethod.western;
  const positives = status(one).filter(r => ['matched', 'partial'].includes(r.status)
    && rules().some(rule => rule.knowledgeId === r.knowledgeId)); assert.ok(positives.length);
  for (const key of ['profile', 'hierarchy', 'rulershipBasis', 'signRuler', 'natalContextReady']) {
    const wrong = structuredClone(one); wrong.normalizedPayload[key] = 'wrong';
    assert.ok(status(wrong).filter(r => positives.some(p => p.knowledgeId === r.knowledgeId)).every(r => r.status === 'not_matched'), key);
  }
  const absent = structuredClone(one); delete absent.normalizedPayload.natalContextReady;
  assert.ok(status(absent).filter(r => positives.some(p => p.knowledgeId === r.knowledgeId)).every(r => r.status === 'unknown'));
  const generic = structuredClone(one); generic.factType = 'progressed_ascendant';
  assert.ok(status(generic).filter(r => positives.some(p => p.knowledgeId === r.knowledgeId)).every(r => r.status === 'unknown'));
});

test('Pisces keeps natal Jupiter distances and the source-specific half-open IC-to-DSC boundaries', () => {
  const [row] = splitLeoAscendantContext({ start: 0, end: day }, [band(335)], [], fixtureNatal, 5, cusps);
  assert.equal(row.natalJupiterSeparations.length, 8); assert.equal(row.sunInIcDscArc, false);
  const jupiter = fixtureNatal.bodies.find(p => p.body === 'Jupiter');
  for (const pair of row.natalJupiterSeparations) {
    const body = fixtureNatal.bodies.find(p => p.body === pair.body);
    assert.equal(pair.absoluteDeclinationDifference, Math.abs(Math.abs(body.declination) - Math.abs(jupiter.declination)));
  }
  assert.equal(row.piscesNatalCondition, 'sun_outside_arc');
  for (const [offset, longitude, expected] of [[5,95,true],[5,185-1e-8,true],[5,185,false],[5,95-1e-8,false],
    [200,290,true],[200,0,true],[200,20,false],[200,289.999,false]]) {
    const shifted = cusps.map((_, i) => normalize(offset + i * 30));
    const natal = structuredClone(fixtureNatal);
    Object.assign(natal.bodies[0], { longitude, sign: Math.floor(longitude / 30) });
    const [actual] = splitLeoAscendantContext({ start:0, end:day }, [band(335)], [], natal, offset, shifted);
    assert.equal(actual.sunInIcDscArc, expected, 'IC-to-DSC ' + offset + ':' + longitude);
  }
  const translated = describeFortuneFact({ method: 'western', type: 'leo_ascendant_context', data: row }, iso);
  assert.match(translated, /不据夹角直接认定木星非常有利/u);
  assert.match(translated, /不完成双鱼条的原文例外条件/u);
});

test('the Pisces natal exception requires both observations, preserving uncertainty when Jupiter has a hard contact', () => {
  const coordinates = { Sun: 125, Moon: 275, Mercury: 125, Venus: 116, Mars: 27, Jupiter: 245, Saturn: 20, Uranus: 6, Neptune: 320 };
  const make = (sun, uranus, aspects = []) => {
    const natal = { bodies: fixtureNatal.bodies.map(body => {
      const longitude = body.body === 'Sun' ? sun : body.body === 'Uranus' ? uranus : coordinates[body.body];
      return { ...body, longitude, sign: Math.floor(longitude / 30) };
    }) };
    const [normalizedPayload] = splitLeoAscendantContext({ start: 0, end: day }, [band(335)], aspects, natal, 5, cusps);
    return { factType: 'leo_ascendant_context', scope: 'progressed', completeness: 'complete', normalizedPayload };
  };
  const inside = make(125, 6), conflicted = make(125, 155), outside = make(190, 6);
  const outsideWithDirection = make(190, 6, [contact('Moon', 0, 1)]);
  assert.equal(inside.normalizedPayload.piscesNatalCondition, 'candidate');
  assert.ok(inside.normalizedPayload.natalJupiterSupportive.some(row => row.second === 'Sun' && row.aspect === 'trine'));
  assert.ok(conflicted.normalizedPayload.natalJupiterHard.some(row => row.second === 'Uranus' && row.aspect === 'square'));
  assert.equal(conflicted.normalizedPayload.piscesNatalCondition, undefined);
  assert.equal(outside.normalizedPayload.piscesNatalCondition, 'sun_outside_arc');
  const evaluate = rows => passage(evaluateFortuneRules('western', 'year', rows), 'p022').required[0];
  const piscesRows = [inside, conflicted, outside, outsideWithDirection];
  assert.deepEqual(evaluate(piscesRows).hits, piscesRows);
  assert.deepEqual(evaluate([{ ...inside, normalizedPayload: { ...inside.normalizedPayload, sign: 10 } }]).hits, []);
});

test('real client charts reach the Pisces natal exception and the Aquarius Mercury timing through SQLite', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const asOf = Date.parse('2026-11-19T00:00:00Z');
  const birth = Date.parse('1985-05-17T04:00:00Z');
  for (const [armc, id] of [[210, 'p022'], [194, 'p002']]) {
    const reference = { snapshotId: 'leo-ascendant-conditions-snapshot-' + id };
    const serialized = JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: chart(armc, 25, birth) }));
    assert.ok(Buffer.byteLength(serialized) < maxFortuneSubmissionBytes);
    const batch = JSON.parse(serialized);
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'leo-ascendant-conditions-' + id, reference);
    const result = passage(matchFortuneKnowledge(run).byMethod.western, id);
    assert.equal(result.status, 'matched', id);
    const witnesses = facts(run).filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.ok(witnesses.length);
    if (id === 'p022') {
      assert.ok(witnesses.every(({ normalizedPayload: p }) => p.sunInIcDscArc && p.piscesNatalCondition === 'candidate'
        && p.natalJupiterSupportive.some(row => row.second === 'Mars' && row.aspect === 'trine') && !p.natalJupiterHard.length));
    } else {
      assert.ok(witnesses.some(({ normalizedPayload: p }) => p.directions.some(row => row.targetKind === 'natal'
        && row.progressedBody === 'Moon' && row.natalTargetId === 'Mercury' && row.nature === 'favourable')));
      assert.ok(witnesses.some(({ normalizedPayload: p }) => !p.natalFavourableDirectionTargets.includes('Mercury')
        && !p.progressedFavourableDirectionTargets.includes('Mercury')));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-ascendant-condition-report'));
    const prompt = formatFortuneFactAudit(input);
    if (id === 'p022') assert.match(prompt, /符合双鱼段的联合例外候选/u);
    else assert.match(prompt, /本片段实际同期次限月亮对本命水星形成绝对赤纬平行；原书此项偏顺/u);
    assert.doesNotMatch(prompt, /natalJupiterSupportive|natalFavourableDirectionTargets|piscesNatalCondition/u);
    assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  }
});

test('real client Aquarius and Capricorn directions survive SQLite and appear as qualified Chinese evidence', () => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
  const asOf = Date.parse('2026-11-19T00:00:00Z');
  for (const [id, snapshot, phrase] of [
    ['p001', chart(176, 35, Date.parse('1968-05-09T04:00:00Z')), /水瓶整座的思维主题可与次限水星对本命天王星的实际相位交叉核对/u],
    ['p012', chart(184), /摩羯第三个十分度有已分类的同期方向可合看/u],
  ]) {
    const reference = { snapshotId: 'leo-ascendant-concurrent-' + id };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'concurrent-' + id, reference);
    const result = passage(matchFortuneKnowledge(run).byMethod.western, id);
    assert.equal(result.status, 'matched', id);
    const witnesses = facts(run).filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.ok(witnesses.length, id);
    assert.ok(witnesses.some(({ normalizedPayload: p }) => id === 'p001'
      ? p.sign === 10 && p.directions.some(row => row.targetKind === 'natal' && row.progressedBody === 'Mercury'
        && row.natalTargetId === 'Uranus' && ['sextile', 'square', 'trine'].includes(row.aspectType))
      : p.sign === 9 && p.decan === 3 && p.directions.some(row => ['favourable', 'adverse'].includes(row.nature))), id);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-concurrent-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase);
    assert.doesNotMatch(prompt, /natalMercuryUranusDirectionState|progressedDirectionState|natalDirectionState/u);
    assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  }
});

test('unknown clocks, inconsistent archives and mismatched source births cannot produce a source-qualified ascendant context', () => {
  const window = { start: Date.parse('2026-11-19T00:00:00Z'), end: Date.parse('2026-11-20T00:00:00Z') };
  const snapshot = chart(), progression = buildWesternProgressions(window, window.start, snapshot), leo = buildLeoSourceContext(window, snapshot, progression);
  const houses = buildWesternSourceHouses(window, snapshot, []);
  assert.equal(buildLeoAscendantContext(window, houses, { ...leo, birthAt: born + day }).status, 'unavailable');
  assert.equal(buildLeoAscendantContext(window, buildWesternSourceHouses(window, chart(100), []), leo).status, 'unavailable');
  assert.equal(buildLeoAscendantContext(window, houses, { ...leo, policy: { profile: 'other-source' } }).status, 'unavailable');
  for (const mutate of [c => { c.timeKnown = false; }, c => { c.western.rawResult[0].positions[0].longitude += 20; }, c => { c.western.rawResult.push(c.western.rawResult[0]); }]) {
    const c = chart(); mutate(c);
    assert.equal(buildLeoAscendantContext(window, buildWesternSourceHouses(window, c, []), leo).status, 'unavailable');
  }
});

test('the provider receives matched source text and natal hierarchy facts remain auditable locally', async () => {
  const run = realRun(), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ascendant-report'));
  assert.ok(input.facts.some(f => f.type === 'leo_ascendant_context'));
  const matchedAscendants = input.sections.flatMap(s => s.findings)
    .flatMap(f => rules().filter(r => r.knowledgeId === f.knowledgeId));
  assert.ok(matchedAscendants.length);
  assert.ok(matchedAscendants.every(rule => !rule.unresolved.length));
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['本命指征终生优先', '十分度只作修饰', '水瓶取土星、双鱼取木星', '本片段实际同期次限', '不等于有利、受克或同性质']) assert.ok(prompt.includes(phrase), phrase);
  for (const key of ['natalContextReady', 'decanSign', 'rulerPositions', 'sourceBandIndex', 'leo-ascendant-natal', 'ascendant-test-', 'sunInIcDscArc']) assert.ok(!prompt.includes(key), key);
  assert.ok(!/[{}\[\]]/u.test(prompt));
  assert.doesNotMatch(formatFortunePrompt(input), /本命指征终生优先|sourceBandIndex|natalContextReady/u);
  let called = false;
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
    called = true; assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input); assert.equal(called, true);
  assert.equal(describeFortuneFact({ method: 'western', type: 'leo_ascendant_context', data: { ...facts(run)[0].normalizedPayload, rulershipBasis: 'modern-rulers' } }, iso), '');
});
