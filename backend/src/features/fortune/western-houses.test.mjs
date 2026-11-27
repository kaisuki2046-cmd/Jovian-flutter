import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, EquatorFromVector, GeoVector, MakeTime, RotateVector, Rotation_EQD_ECT, Rotation_EQJ_EQD, SearchMoonPhase, SearchSunLongitude, SiderealTime, SunPosition, Vector, e_tilt } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { anglesFromFrame, calculateHouseCusps, eclipticEquator, frameFromAngles, progressedHouseFrame, readWesternHouseFrame,
  scanCircularRegions, westernHousePolicy, zodiacalHouse } = await import('./control/western-houses.ts');
const { progressionEpoch, readProgressionPosition } = await import('./control/western-progressions.ts');
const { readTransitLongitude } = await import('./control/solar-transits.ts');
const { readLeoNatalAspects } = await import('./control/leo-natal-aspects.ts');
const { buildLeoSecondHouseContexts, leoNatalTransitPolicy } = await import('./control/leo-transit-natal.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const day = 86_400_000, rad = Math.PI / 180;
const birthAt = Date.parse('1990-01-01T04:00:00Z');
const normalize = value => (value % 360 + 360) % 360;
const arc = value => normalize(value + 180) - 180;
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// Independent Cartesian plane intersections, matching the public archive's
// coordinate definition; production uses inverse/closed-form sphere geometry.
function vectorAngles(armc, latitude, at = birthAt) {
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
function snapshot(armc = 300, latitude = 35, at = birthAt) {
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] },
    western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: at / day + 2440587.5, ...vectorAngles(armc, latitude, at),
      positions: bodies.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[planet], new Date(at), true)).elon })),
    }] } };
}
function calculate(chart = snapshot(), periodType = 'year', targetPeriod = { year: 2026 }) {
  const params = { periodType, displayTimezone: 'Asia/Shanghai', targetPeriod };
  const time = buildFactTimeContext(params, Date.parse('2026-11-18T03:00:00Z'), 'server');
  return calculateFortuneFacts(params, time, 'source-house-run', { snapshotId: 'source-house-snapshot', chart });
}
let baseline;
const realRun = () => baseline ??= calculate();
const resultAt = (run, index) => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === fortuneKnowledge.western.rules[index].knowledgeId);
const leoTransitMatch = (run, passage) => matchFortuneKnowledge(run).byMethod.western.find(row =>
  row.knowledgeId.endsWith('leo-v1-transit-' + passage + '-001'));

test('154 independent Swiss reference cases verify both house systems in both hemispheres and across angle wrap', () => {
  const reference = JSON.parse(readFileSync(new URL('./model/fixtures/western-house-reference.json', import.meta.url)));
  assert.equal(reference.cases.length, 154);
  for (const row of reference.cases) {
    const result = calculateHouseCusps(row.armc, row.latitude, row.obliquity, row.system);
    assert.equal(result.status, 'ready');
    result.cusps.forEach((cusp, index) => assert.ok(Math.abs(arc(cusp - row.cusps[index])) < 1e-6,
      JSON.stringify({ armc: row.armc, latitude: row.latitude, system: row.system, house: index + 1 })));
    for (let i = 0; i < 6; i++) assert.ok(Math.abs(Math.abs(arc(result.cusps[i + 6] - result.cusps[i])) - 180) < 1e-8);
  }
});

test('archived angles recover their actual geometric frame; underdetermined and inconsistent angles never invent a latitude', () => {
  for (const latitude of [-60, -35, 0, 35, 60]) for (const armc of [0, 45, 135, 225, 315]) {
    const angles = vectorAngles(armc, latitude), epsilon = e_tilt(MakeTime(new Date(birthAt))).tobl;
    const frame = frameFromAngles(angles.ascendant, angles.midheaven, epsilon);
    assert.equal(frame.status, 'ready');
    assert.ok(Math.abs(frame.latitude - latitude) < 1e-7);
    assert.ok(Math.abs(arc(frame.armc - armc)) < 1e-7);
    const rebuilt = anglesFromFrame(frame.armc, frame.latitude, frame.obliquity);
    assert.ok(Math.abs(arc(rebuilt.ascendant - angles.ascendant)) < 1e-8);
  }
  assert.equal(frameFromAngles(0, 270, 23.44).status, 'indeterminate_latitude');
  assert.equal(frameFromAngles(180, 90, 23.44).status, 'indeterminate_latitude');
  const a = vectorAngles(300, 35);
  assert.equal(frameFromAngles(normalize(a.ascendant + 180), a.midheaven, 23.44).status, 'inconsistent_angles');
  assert.equal(frameFromAngles(NaN, 90, 23.44).status, 'invalid_angles');
  assert.equal(calculateHouseCusps(0, 80, 23.44, 'placidus').status, 'circumpolar_unavailable');
});

test('fixed birth-clock progression reproduces the book angle example without a half-year half-turn or solar arc substitution', () => {
  const birth = Date.parse('1860-08-07T05:49:00Z'), theta = SiderealTime(new Date(birth)) * 15;
  const birthday = Date.parse('1906-08-07T05:49:00Z'), halfAt = Date.parse('1907-02-07T05:49:00Z');
  const result = progressedHouseFrame(birth, birthday, theta, 51.5), half = progressedHouseFrame(birth, halfAt, theta, 51.5);
  assert.ok(Math.abs(result.armc - (5 + 54 / 60 + 16 / 3600) * 15) < 0.003);
  assert.ok(Math.abs(result.midheaven - (60 + 28 + 41 / 60)) < 0.03);
  assert.ok(Math.abs(result.ascendant - (150 + 28 + 59 / 60)) < 0.03);
  assert.ok(Math.abs(arc(half.ascendant - result.ascendant)) < 1);
  const wronglyTimed = anglesFromFrame(SiderealTime(new Date(progressionEpoch(birth, halfAt))) * 15, 51.5, half.obliquity);
  assert.ok(Math.abs(arc(wronglyTimed.ascendant - half.ascendant)) > 100);
  const natal = anglesFromFrame(theta, 51.5, e_tilt(MakeTime(new Date(birth))).tobl);
  const solarArc = readProgressionPosition('Sun', progressionEpoch(birth, birthday), birth).longitude
    - readProgressionPosition('Sun', birth, birth).longitude;
  assert.ok(Math.abs(arc(result.ascendant - natal.ascendant - solarArc)) > 1);
});

test('circular scans preserve wrap, retrograde recrossing, narrow station bands and half-open query edges without counting touches', () => {
  const window = { start: 0, end: 4 * day };
  const direct = scanCircularRegions(window, at => normalize(359 + at / day), [0], day);
  assert.equal(direct.crossings.length, 1); assert.equal(direct.crossings[0].at, day);
  const reverse = scanCircularRegions(window, at => normalize(1 - at / day), [0], day);
  assert.equal(reverse.crossings.length, 1); assert.equal(reverse.crossings[0].direction, 'retrograde');
  const narrow = scanCircularRegions(window, at => normalize((at / day - 2) ** 2 - 0.000001), [0], day, [2 * day]);
  assert.equal(narrow.crossings.length, 2);
  assert.ok(Math.abs(narrow.crossings[0].at - (2 - 0.001) * day) <= 1_000);
  assert.ok(Math.abs(narrow.crossings[1].at - (2 + 0.001) * day) <= 1_000);
  assert.equal(scanCircularRegions(window, at => (at / day - 2) ** 2, [0], day, [2 * day]).crossings.length, 0);
  assert.equal(scanCircularRegions({ start: 0, end: day }, at => at / day, [1], day / 2).crossings.length, 0);
  assert.equal(scanCircularRegions({ start: day, end: 2 * day }, at => at / day, [1], day / 2).crossings[0].at, day);
});

test('real ephemerides reach traditional transit, progressed ascendant and fixed natal Moon-house facts, with correct source provenance', () => {
  const run = realRun(); validateFortuneFacts(run);
  assert.equal(run.methods.western.nativeWindow.sourceHouses.status, 'ready');
  const cusps = run.facts.find(fact => fact.factType === 'natal_house_cusps' && fact.normalizedPayload.houseSystem === 'placidus').normalizedPayload.cusps;
  assert.ok(run.facts.some(fact => fact.factType === 'progressed_ascendant'));
  const moons = run.facts.filter(fact => fact.factType === 'progressed_house');
  assert.ok(moons.length);
  for (const fact of moons) {
    const at = (Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2;
    const position = readProgressionPosition('Moon', progressionEpoch(birthAt, at), birthAt);
    assert.equal(fact.normalizedPayload.house, zodiacalHouse(position.longitude, cusps));
  }
  assert.equal(resultAt(run, 6).status, 'matched');
  assert.equal(resultAt(calculate(snapshot(100)), 2).status, 'matched');
  const report = interpretFortune(run, requestForFortuneRun(run), 'house-to-prompt');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === fortuneKnowledge.western.entries[6].id)));
  assert.match(prompt, /行运木星经过本命第3宫/u);
  assert.match(prompt, /literary work/u);
  assert.match(prompt, /Leo 原法推运上升/u);
  for (const secret of ['latitude', 'armc', 'julianDay', 'sourceHousePolicy', 'geometryBasis']) assert.ok(!prompt.includes(secret), secret);
  assert.equal(fortuneKnowledge.western.rules.filter(rule => rule.queries[0]?.factType === 'leo_lunar_house_context').length, 11);
  assert.equal(fortuneKnowledge.western.rules.filter(rule => rule.queries[0]?.factType === 'leo_lunar_ascendant_crossing').length, 1);
});

test('a real Venus/Jupiter second-cusp crossing matches only its own day and never a mere stay in the second house', () => {
  const year = realRun();
  const hit = year.facts.find(fact => fact.factType === 'traditional_cusp_crossing');
  assert.ok(hit);
  const date = new Date(Date.parse(hit.exactInstant) + 8 * 3_600_000).toISOString().slice(0, 10);
  const run = calculate(snapshot(), 'day', { date });
  assert.equal(resultAt(run, 18).status, 'matched');
  const exact = run.facts.find(fact => fact.factType === 'traditional_cusp_crossing');
  const p = exact.normalizedPayload;
  assert.ok(Math.abs(arc(readTransitLongitude(p.transitBody, Date.parse(exact.exactInstant)) - p.cuspLongitude)) < 0.00002);
  const wrongSystem = structuredClone(run);
  wrongSystem.facts.filter(fact => fact.factType === 'traditional_cusp_crossing').forEach(fact => { fact.normalizedPayload.houseSystem = 'whole-sign'; });
  assert.notEqual(resultAt(wrongSystem, 18).status, 'matched');
  const stay = structuredClone(run); stay.facts = stay.facts.filter(fact => fact.factType !== 'traditional_cusp_crossing');
  assert.equal(resultAt(stay, 18).status, 'unknown');
});

test('Leo natal aspect limits distinguish luminary tiers, minor aspect limits and absolute declination', () => {
  const point = (body, longitude, declination) => ({ body, longitude, declination });
  for (const [first, second, orb] of [['Sun', 'Moon', 12], ['Moon', 'Venus', 10], ['Mars', 'Saturn', 8]]) {
    for (const [angle, aspect] of [[0, 'conjunction'], [180, 'opposition']]) {
      const kind = delta => readLeoNatalAspects(point(first, 359, 15), point(second, normalize(359 + angle - delta), 3));
      assert.ok(kind(orb).some(a => a.aspect === aspect && a.orb === orb));
      assert.ok(kind(orb + 0.01).every(a => a.aspect !== aspect));
    }
  }
  for (const [angle, aspect, orb] of [[30, 'semisextile', 2], [45, 'semisquare', 4], [60, 'sextile', 7],
    [90, 'square', 8], [120, 'trine', 8], [135, 'sesquiquadrate', 4], [150, 'quincunx', 2]]) {
    const read = delta => readLeoNatalAspects(point('Sun', 0, 15), point('Mars', angle + delta, 3));
    assert.deepEqual(read(orb).find(a => a.aspect === aspect), { aspect, orb, difference: orb, coordinate: 'longitude' });
    assert.ok(read(orb + 0.01).every(a => a.aspect !== aspect));
  }
  assert.deepEqual(readLeoNatalAspects(point('Mars', 0, 9), point('Saturn', 106, -10)),
    [{ aspect: 'parallel', difference: 1, orb: 1, coordinate: 'declination' }]);
});

test('Leo daily Sun passage distinguishes three independent natal reasons and rejects a non-qualifying exact contact', () => {
  const chart = snapshot(0), raw = chart.western.rawResult[0];
  for (const [planet, angular, ruler, closest, expected] of [
    ['Mercury', true, false, false, 'matched'], ['Moon', false, true, false, 'matched'],
    ['Mars', false, false, true, 'matched'], ['Sun', false, false, false, 'not_matched'],
  ]) {
    const natalLongitude = raw.positions.find(row => row.planet === planet).longitude;
    const crossing = SearchSunLongitude(natalLongitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(crossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const run = calculate(chart, 'day', { date });
    validateFortuneFacts(run);
    const hit = run.facts.find(f => f.factType === 'leo_solar_natal_contact' && f.normalizedPayload.natalTargetId === planet);
    assert.ok(hit, planet);
    const p = hit.normalizedPayload;
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarAspects.length > 0], [angular, ruler, closest]);
    const sameSign = raw.positions.filter(row => row.planet !== planet && row.planet !== 'Pluto'
      && Math.floor(row.longitude / 30) === Math.floor(natalLongitude / 30));
    assert.deepEqual(p.sameSignNatalBodies.map(row => row.body).sort(), sameSign.map(row => row.planet).sort(), planet);
    assert.ok(p.natalTargetAspectContacts.every(row => [row.first, row.second].includes(planet) && row.difference <= row.orb), planet);
    assert.ok(Math.abs(Date.parse(hit.exactInstant) - crossing) < 30_000);
    const declination = (body, at) => EquatorFromVector(RotateVector(Rotation_EQJ_EQD(at), GeoVector(Body[body], at, true))).dec;
    const transitDeclination = declination('Sun', new Date(hit.exactInstant));
    const natalDeclination = declination(planet, new Date(birthAt));
    assert.equal(p.contactDeclinations.transitDeclination, transitDeclination);
    assert.ok(Math.abs(p.contactDeclinations.natalDeclination - natalDeclination) < 1e-8);
    assert.ok(Math.abs(p.contactDeclinations.difference - Math.abs(transitDeclination - natalDeclination)) < 1e-8);
    assert.equal(leoTransitMatch(run, 'p009').status, expected, planet);
    if (planet === 'Mars') {
      assert.equal(p.isAscendantDecanRuler, true);
      assert.equal(p.hasUniqueClosestNatalSolarMajor, false);
    }
    if (planet === 'Mercury') {
      assert.equal(p.ordinaryNatalAngularOccupant, true);
      assert.equal(p.isNatalAngularStrengthWitness, false);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-sun-exact'));
      assert.match(formatFortuneFactAudit(input), /太阳在精确时点经过本命水星/u);
      assert.match(formatFortuneFactAudit(input), /按同作者1928年本命参考外限核本命水星参与的相位/u);
      assert.match(formatFortuneFactAudit(input), /精确过点时行运赤纬.+南北实差/u);
      assert.doesNotMatch(formatFortunePrompt(input), /本命水星参与的相位|natalTargetAspectContacts|精确过点时行运赤纬/u);
      assert.match(formatFortunePrompt(input), /四角宫落星具重要性/u);
      assert.doesNotMatch(formatFortunePrompt(input), /ordinaryNatalAngularOccupant|本命实居角宫/u);
      const generic = { ...run, facts: run.facts.filter(f => f.factType !== 'leo_solar_natal_contact') };
      assert.equal(leoTransitMatch(generic, 'p009').status, 'unknown');
    }
  }
});

test('p009 confirms the documented tenth-house branch only with the same exact natal solar aspect', () => {
  const exactBirth = Date.parse('1968-04-15T19:41:14.378Z'), asOf = Date.parse('2026-08-19T04:00:00Z');
  const conditions = '行运太阳实际同度经过实居本命第十宫、并与本命太阳精确形成主要黄经相位的同一颗本命星。';
  for (const [label, birth, armc, expected] of [
    ['documented', exactBirth, 133.343921, 'matched'],
    ['different house', exactBirth, 98.343921, 'matched'],
    ['near natal aspect', exactBirth + 6 * 3_600_000, 133.343921, 'matched'],
  ]) {
    const chart = snapshot(armc, 35, birth);
    const raw = chart.western.rawResult[0];
    const longitude = planet => raw.positions.find(row => row.planet === planet).longitude;
    const natalDifference = Math.abs(Math.abs(arc(longitude('Jupiter') - longitude('Sun'))) - 120);
    const utcCrossing = SearchSunLongitude(longitude('Jupiter'), new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(utcCrossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', displayTimezone: 'Asia/Shanghai', targetPeriod: { date } };
    const reference = { snapshotId: 'leo-tenth-house-solar-contact', chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const target = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Jupiter');
    assert.ok(target, label);
    const p = target.normalizedPayload;
    assert.equal(p.natalHouse === 10, label !== 'different house', label);
    assert.equal(natalDifference <= 0.000001, label !== 'near natal aspect', label);
    const tenthHouseConfirmed = label === 'documented';
    assert.equal(p.hasExactNatalSolarAspectInTenthHouse, tenthHouseConfirmed, label);
    assert.ok(Math.abs(Date.parse(target.exactInstant) - utcCrossing) < 30_000);
    const result = leoTransitMatch(run, 'p009');
    assert.equal(result.status, expected, label);
    assert.ok(result.sourceFactIds.includes(target.factId), label);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes(conditions), tenthHouseConfirmed, label);
    const detail = '同一颗第十宫本命星与本命太阳精确形成三分相，满足原书的显著性条件';
    assert.equal(formatFortuneFactAudit(input).includes(detail), tenthHouseConfirmed, label);
    assert.ok(!provider.includes(detail), label);
    assert.doesNotMatch(provider, /hasExactNatalSolarAspectInTenthHouse|natalTargetAspectContacts|本命木星实居第十宫/u);
    if (tenthHouseConfirmed) {
      assert.equal(p.exactNatalSolarAspectInTenthHouse.aspect, 'trine');
      assert.ok(p.exactNatalSolarAspectInTenthHouse.difference <= 0.000001);
      assert.deepEqual(result.matchedConditions, [conditions]);
      assert.deepEqual(result.windows, [{ start: target.activeFrom, endExclusive: target.activeTo }]);
      const noAnchor = { ...target, factType: 'aspect_interval' };
      const missing = { ...run, facts: run.facts.map(row => row === target ? noAnchor : row) };
      assert.notEqual(leoTransitMatch(missing, 'p009').status, 'matched');
    } else if (label === 'different house') {
      assert.equal(p.hasUniqueClosestNatalSolarMajor, true);
      assert.match(provider, /本命太阳唯一的最近有效主要相位对象/u);
    } else {
      assert.equal(p.ordinaryNatalAngularOccupant, true);
      assert.match(provider, /四角宫落星具重要性/u);
    }
  }
});

test('p009 separately confirms the solar passage over the sole angular ascendant ruler', () => {
  const asOf = Date.parse('2026-12-02T00:00:00Z');
  const source = /行运太阳实际同度经过本命上升主星，且该星是原书择强所列第一、第十、第七宫中的唯一落星/u;
  const originalRuler = /按原书第九章，本命上升主星的作用贯穿一生/u;
  const tenth = /行运太阳实际同度经过实居本命第十宫/u;
  const audit = /本命火星兼为上升主星，实为原书择强三宫唯一落星/u;
  for (const [armc, isAscendantRuler, isSoleAngularBody, expected] of [
    [145, true, true, 'matched'], [135, true, false, 'matched'], [165, false, true, 'matched'],
  ]) {
    const chart = snapshot(armc);
    const params = { periodType: 'day', displayTimezone: 'Asia/Shanghai', targetPeriod: { date: '2026-12-02' } };
    const reference = { snapshotId: 'leo-sole-angular-ruler-' + armc, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const target = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Mars');
    assert.ok(target, reference.snapshotId);
    const p = target.normalizedPayload;
    assert.deepEqual([p.isAscendantRuler, p.isSoleAngularBody, p.hasExactNatalSolarAspectInTenthHouse],
      [isAscendantRuler, isSoleAngularBody, false]);
    const transitSun = SunPosition(new Date(target.exactInstant)).elon;
    const natalMars = Ecliptic(GeoVector(Body.Mars, new Date(birthAt), true)).elon;
    assert.ok(Math.abs(arc(transitSun - natalMars)) < 0.00001);
    const result = leoTransitMatch(run, 'p009');
    assert.equal(result.status, expected);
    assert.ok(result.sourceFactIds.includes(target.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.equal(source.test(provider), isAscendantRuler && isSoleAngularBody);
    assert.equal(originalRuler.test(provider), isAscendantRuler && !isSoleAngularBody);
    assert.equal(/按 Leo 与 Green 的本命角宫择强所选出的星体/u.test(provider), !isAscendantRuler && isSoleAngularBody);
    assert.doesNotMatch(provider, tenth);
    assert.equal(audit.test(formatFortuneFactAudit(input)), isAscendantRuler && isSoleAngularBody);
    assert.doesNotMatch(provider, /实为原书择强三宫唯一落星|isSoleAngularBody/u);
  }
});

test('p009 uses the same precisely contacted planet selected by natal dignity and cusp distance', () => {
  const source = '按 Leo 与 Green 的本命角宫择强所选出的星体';
  for (const [armc, at, body, basis, witness, status] of [
    [265, birthAt, 'Saturn', 'one-dignified', [10, 'domicile', 10], 'matched'],
    [340, birthAt, 'Jupiter', 'closer-dignified-cusp', [1, 'exaltation', 1], 'matched'],
    [340, birthAt, 'Saturn', 'closer-dignified-cusp', null, 'matched'],
    [235, birthAt, 'Moon', 'undetermined', null, 'matched'],
    [330, Date.parse('2014-03-01T04:00:00Z'), 'Jupiter', 'disputed-dignity', null, 'matched'],
  ]) {
    const chart = snapshot(armc, 35, at);
    const raw = chart.western.rawResult[0];
    const natal = raw.positions.find(row => row.planet === body).longitude;
    const crossing = SearchSunLongitude(natal, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(crossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const run = calculate(chart, 'day', { date });
    validateFortuneFacts(run);
    const target = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === body);
    assert.ok(target, `${armc} ${body}`);
    assert.ok(Math.abs(crossing - Date.parse(target.exactInstant)) < 30_000);
    assert.ok(Math.abs(arc(SunPosition(new Date(target.exactInstant)).elon - natal)) < 0.00001);
    const p = target.normalizedPayload;
    assert.equal(p.isAscendantRuler, false);
    assert.equal(p.isAngular, true);
    assert.equal(p.natalAngularStrength.basis, basis);
    assert.equal(p.isNatalAngularStrengthWitness, basis === 'disputed-dignity' ? undefined : Boolean(witness));
    if (witness) {
      const { cusps } = calculateHouseCusps(armc, 35, e_tilt(MakeTime(new Date(at))).tobl, 'placidus');
      const { body: selected, house, dignity, cuspHouse, distance } = p.natalAngularStrength;
      assert.equal(selected, body);
      assert.deepEqual([house, dignity, cuspHouse], witness);
      assert.ok(Math.abs(distance - Math.abs(arc(natal - cusps[cuspHouse - 1]))) < 1e-8);
    } else {
      assert.equal(p.natalAngularStrength.body, undefined);
    }
    const isolated = { ...run, facts: [target] };
    const match = leoTransitMatch(isolated, 'p009');
    assert.equal(match.status, status, `${armc} ${body}`);
    const findings = evaluateFortuneRules('western', 'day', [target]).find(row => row.knowledgeId.includes('-p009-')).confirmations;
    const finding = findings.find(row => row.condition.includes('"isNatalAngularStrengthWitness":true'));
    assert.equal(finding.hits.length, Number(Boolean(witness)));
    assert.equal(finding.unknown, basis === 'disputed-dignity');
    if (basis === 'closer-dignified-cusp' && !witness) assert.ok(findings.some(row => row !== finding && row.hits.length > 0));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-angular-strength'));
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes(source), Boolean(witness));
    if (basis === 'undetermined' || basis === 'disputed-dignity') assert.match(provider, /四角宫落星具重要性/u);
    assert.doesNotMatch(provider, /isNatalAngularStrengthWitness|natalAngularStrength|closer-dignified-cusp|one-dignified/u);
  }
});

test('p009 confirms an actual solar return only when the Sun is the original ascendant ruler', () => {
  const originalRuler = '按原书第九章，本命上升主星的作用贯穿一生';
  const natal = SunPosition(new Date(birthAt)).elon;
  const exactAt = SearchSunLongitude(natal, new Date('2025-12-25T00:00:00Z'), 15).date.getTime();
  assert.ok(Math.abs(exactAt - Date.parse('2025-12-31T21:46:48.920Z')) < 1_000);
  for (const [armc, displayTimezone, ascendantRuler, expected] of [
    [30, 'Asia/Shanghai', 'Sun', 'matched'],
    [55, 'Asia/Shanghai', 'Mercury', 'not_matched'],
    [30, 'UTC', 'Sun', 'not_matched'],
  ]) {
    const params = { periodType: 'day', targetPeriod: { date: '2026-01-01' }, displayTimezone };
    const reference = { snapshotId: 'leo-return-as-ascendant-ruler-' + armc + '-' + displayTimezone, chart: snapshot(armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const sun = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Sun');
    if (displayTimezone === 'UTC') {
      assert.equal(sun, undefined);
    } else {
      assert.ok(sun && Math.abs(Date.parse(sun.exactInstant) - exactAt) < 30_000);
      const p = sun.normalizedPayload;
      assert.deepEqual([p.ascendantRuler, p.natalHouse, p.isSoleAngularBody, p.hasExactNatalSolarAspectInTenthHouse],
        [ascendantRuler, 5, false, false]);
      assert.ok(Math.abs(arc(SunPosition(new Date(sun.exactInstant)).elon - natal)) < 0.00001);
      assert.equal(leoTransitMatch({ ...run, facts: [sun] }, 'p009').status, expected);
    }
    const match = leoTransitMatch(run, 'p009');
    if (expected === 'matched') {
      assert.equal(match.status, 'matched');
      assert.ok(match.sourceFactIds.includes(sun.factId));
      assert.equal(match.matchedSourceExcerpt, 'stirs into activity');
    } else {
      assert.ok(!match.sourceFactIds.includes(sun?.factId));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes(originalRuler), expected === 'matched');
    assert.doesNotMatch(provider, /isAscendantRuler|该星为本命上升星座的主星/u);
    if (expected === 'matched') assert.match(formatFortuneFactAudit(input), /该星为本命上升星座的主星/u);
  }
});

test('p009 uses two coordinates of the same sole solar partner at a real transit', () => {
  const birth = Date.UTC(1978, 9, 19);
  const chart = snapshot(245, 35, birth);
  const run = calculate(chart, 'day', { date: '2026-09-02' });
  validateFortuneFacts(run);
  const target = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Saturn');
  assert.ok(target);
  const p = target.normalizedPayload;
  assert.equal(p.soleSolarDualCoordinateCandidate, true);
  assert.ok(p.soleSolarDualCoordinateContacts.every(row => row.body === 'Saturn'));
  assert.deepEqual(p.soleSolarDualCoordinateContacts.map(row => row.aspect).sort(), ['parallel', 'semisquare']);
  assert.ok(Math.abs(arc(SunPosition(new Date(target.exactInstant)).elon - p.natalLongitude)) < 0.00001);
  const isolated = { ...run, facts: [target] };
  const match = leoTransitMatch(isolated, 'p009');
  assert.equal(match.status, 'matched');
  assert.ok(match.sourceFactIds.includes(target.factId));
  assert.ok(match.matchedConditions?.some(row => row.includes('都只指向该星'))
    || match.confirmedBranches?.some(branch => branch.conditions.some(row => row.includes('都只指向该星'))));
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-sole-solar-dual'));
  assert.match(formatFortunePrompt(input), /都只指向该星/u);
  assert.doesNotMatch(formatFortunePrompt(input), /soleSolarDualCoordinate/u);
});

test('p009 accepts the Moon’s sole partner when its longitude and declination contacts reach the same body', () => {
  const samples = [
    { birth: '1922-11-17T00:00:00Z', qualifies: true },
    { birth: '1922-11-16T16:00:00Z', qualifies: false },
  ];
  for (const { birth, qualifies } of samples) {
    const birthAt = Date.parse(birth);
    const chart = snapshot(245, 35, birthAt);
    const position = chart.western.rawResult[0].positions.find(row => row.planet === 'Uranus');
    const at = SearchSunLongitude(position.longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(at + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-p009-lunar-coordinates-' + birth, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, at), reference.snapshotId, reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Uranus');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.soleLunarCandidate, qualifies);
    assert.ok(Math.abs(arc(SunPosition(new Date(fact.exactInstant)).elon - position.longitude)) < 0.00001);
    const isolated = { ...run, facts: [fact] };
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
    const provider = formatFortunePrompt(input);
    const lunarSource = '半刑或倍半刑与赤纬平行时，也只登记同一颗星';
    assert.equal(provider.includes(lunarSource), qualifies);
    if (!qualifies) {
      assert.deepEqual(p.soleLunarAspectContacts, []);
      continue;
    }
    assert.ok(p.soleLunarAspectContacts.every(row => row.body === 'Uranus'));
    assert.deepEqual(p.soleLunarAspectContacts.map(row => row.aspect).sort(), ['parallel', 'sesquiquadrate']);
    assert.ok(leoTransitMatch(isolated, 'p009').sourceFactIds.includes(fact.factId));
    const { longitude } = chart.western.rawResult[0].positions.find(row => row.planet === 'Moon');
    assert.ok(Math.abs(p.soleLunarAspectContacts.find(row => row.coordinate === 'longitude').difference
      - Math.abs(Math.abs(arc(longitude - position.longitude)) - 135)) < 1e-8);
    const declination = body => {
      const time = new Date(birthAt);
      const vector = GeoVector(Body[body], time, true);
      return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), vector)).dec;
    };
    const declinationDifference = Math.abs(Math.abs(declination('Moon')) - Math.abs(declination('Uranus')));
    assert.ok(Math.abs(p.soleLunarAspectContacts.find(row => row.coordinate === 'declination').difference - declinationDifference) < 1e-8);
    assert.doesNotMatch(provider, /soleLunarAspectContacts|soleLunarCandidate/u);
  }
});

test('p009 treats a sole natal solar parallel independently and leaves an unlike-pair comparison unresolved', () => {
  const source = '两者在本命只有较弱的赤纬平行';
  for (const [dayOfBirth, qualifies] of [[13, true], [14, false]]) {
    const birth = Date.UTC(1930, 2, dayOfBirth, 12);
    const chart = snapshot(245, 35, birth);
    const uranus = chart.western.rawResult[0].positions.find(row => row.planet === 'Uranus').longitude;
    const at = SearchSunLongitude(uranus, new Date('2026-03-29T00:00:00Z'), 5).date.getTime();
    const date = new Date(at + 8 * 3_600_000).toISOString().slice(0, 10);
    const run = calculate(chart, 'day', { date });
    validateFortuneFacts(run);
    const target = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Uranus');
    assert.ok(target);
    const p = target.normalizedPayload;
    assert.equal(p.isAngular, false);
    assert.equal(p.isAscendantRuler, false);
    assert.equal(p.soleSolarParallelCandidate, qualifies);
    assert.equal(p.soleSolarDualCoordinateCandidate, false);
    assert.ok(Math.abs(arc(SunPosition(new Date(target.exactInstant)).elon - uranus)) < 0.00001);
    const declination = body => { const time = new Date(birth);
      return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), GeoVector(Body[body], time, true))).dec; };
    const separation = Math.abs(Math.abs(declination('Sun')) - Math.abs(declination('Uranus')));
    assert.ok(separation < 1);
    if (qualifies) {
      assert.equal(p.soleSolarParallelAspect.aspect, 'parallel');
      assert.ok(Math.abs(separation - p.soleSolarParallelAspect.difference) < 1e-8);
    } else assert.equal(p.soleSolarParallelAspect, undefined);
    const isolated = { ...run, facts: [target] };
    const result = leoTransitMatch(isolated, 'p009');
    assert.equal(result.status, qualifies ? 'matched' : 'not_matched');
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-sole-solar-parallel'));
    const provider = formatFortunePrompt(input);
    const local = '这颗本命星是太阳在原书相位表中的唯一联系';
    assert.equal(formatFortuneFactAudit(input).includes(local), qualifies);
    assert.ok(!provider.includes(local));
    assert.equal(provider.includes(source), qualifies);
    assert.doesNotMatch(provider, /soleSolarParallelAspect|soleSolarParallelCandidate/u);
    if (qualifies) assert.deepEqual(result.windows, [{ start: target.activeFrom, endExclusive: target.activeTo }]);
  }
});

test('the actual rising degree supplies a separate solar-transit qualification only within its declared tolerance', () => {
  for (const [armc, emptyRisingHouse, near, exact, expected, risingApproach] of [
    [260.7485192121012, true, true, true, 'matched', false],
    [260.75, true, true, false, 'partial', false],
    [261.5, true, false, false, 'not_matched', false],
    [145.13638958193633, false, true, false, 'not_matched', false],
    [260.8256290193988, true, true, false, 'partial', true],
  ]) {
    const birth = risingApproach ? Date.UTC(1990, 0, 2, 4) : birthAt;
    const chart = snapshot(armc, 35, birth), raw = chart.western.rawResult[0];
    const saturn = raw.positions.find(row => row.planet === 'Saturn');
    const crossing = SearchSunLongitude(saturn.longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(crossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-rising-' + armc };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, crossing, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, crossing), 'leo-rising-evidence', reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Saturn');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate],
      [false, false, false, near && emptyRisingHouse]);
    assert.equal(p.beforeAngularCuspCandidate, false);
    const isolated = { ...run, facts: [fact] };
    const result = leoTransitMatch(isolated, 'p009');
    assert.equal(result.status, expected);
    assert.equal(result.sourceFactIds.includes(fact.factId), near && emptyRisingHouse);
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - crossing) < 30_000);
    const difference = Math.abs(60 - Math.abs(arc(saturn.longitude - raw.ascendant)));
    assert.equal(difference < 1, near);
    const { cusps } = calculateHouseCusps(armc, 35, e_tilt(MakeTime(new Date(birth))).tobl, 'placidus');
    const natalPositions = raw.positions.filter(row => row.planet !== 'Pluto');
    assert.equal(!natalPositions.some(row => zodiacalHouse(row.longitude, cusps) === 1), emptyRisingHouse);
    if (risingApproach) {
      const moon = natalPositions.find(row => row.planet === 'Moon');
      assert.equal(zodiacalHouse(moon.longitude, cusps), 12);
      assert.ok(Math.abs(normalize(cusps[0] - moon.longitude) - 3.44399757) < 1e-6);
      assert.ok(difference < 0.000001);
      assert.deepEqual(p.exactRisingDegreeAspect, undefined);
    }
    assert.equal(p.hasExactRisingDegreeAspect, exact);
    if (near && emptyRisingHouse) {
      const [aspect] = p.risingDegreeAspects;
      assert.equal(aspect.aspect, 'sextile');
      assert.ok(Math.abs(aspect.difference - difference) < 1e-8);
      if (exact) {
        assert.deepEqual(p.exactRisingDegreeAspect, aspect);
        assert.ok(difference < 0.000001);
        assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      }
    } else {
      assert.deepEqual(p.risingDegreeAspects, []);
    }
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-rising-report'));
    assert.equal(formatFortuneFactAudit(input).includes('本命一宫无落星，该星与实际升起度数'), near && emptyRisingHouse);
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes('同一颗本命星与实际升起度数精确形成主要黄经相位'), exact);
    assert.doesNotMatch(provider, /hasExactRisingDegreeAspect|exactRisingDegreeAspect|本命一宫无落星，该星与实际升起度数/u);
  }
});

test('Leo separates the precise solar passage near the seventh and tenth cusps from unique natal elevation', () => {
  for (const [cuspHouse, offset, birth, blocker, elevated = false] of [
    [10, 3.25, birthAt], [10, 6.25, birthAt], [7, 3.25, birthAt], [7, 6.25, birthAt],
    [10, 2.8, Date.UTC(1990, 0, 6, 4), 'rising', true], [10, 'tie', Date.UTC(1990, 0, 6, 4), 'rising'],
    [10, 3.25, Date.UTC(1990, 0, 6, 4), 'rising'], [10, 3.25, Date.UTC(1990, 1, 2, 4), 'before-rising'],
  ]) {
    const natal = snapshot(300, 35, birth).western.rawResult[0].positions;
    const saturn = natal.find(row => row.planet === 'Saturn');
    const mercury = natal.find(row => row.planet === 'Mercury');
    const angle = offset === 'tie' ? arc(mercury.longitude - saturn.longitude) / 2 : offset;
    const tilt = e_tilt(MakeTime(new Date(birth))).tobl;
    const cusp = normalize(saturn.longitude + angle);
    const { rightAscension, declination } = eclipticEquator(cuspHouse === 7 ? normalize(cusp + 180) : cusp, tilt);
    const armc = cuspHouse === 10 ? rightAscension
      : normalize(rightAscension - Math.acos(-Math.tan(35 * rad) * Math.tan(declination * rad)) / rad);
    const chart = snapshot(armc, 35, birth);
    const crossing = SearchSunLongitude(saturn.longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(crossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const archive = { snapshotId: 'leo-approached-seventh-tenth', chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, crossing, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, crossing), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Saturn');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    const near = angle <= 5, confirmed = near && blocker === undefined;
    const { cusps } = calculateHouseCusps(armc, 35, tilt, 'placidus');
    const positions = chart.western.rawResult[0].positions.filter(row => row.planet !== 'Pluto');
    assert.equal(positions.some(row => zodiacalHouse(row.longitude, cusps) === 1), blocker === 'rising');
    assert.equal(positions.some(row => zodiacalHouse(row.longitude, cusps) === 12
      && normalize(cusps[0] - row.longitude) <= 5), blocker === 'before-rising');
    assert.equal(p.natalHouse, cuspHouse - 1);
    assert.equal(p.isAngular, false);
    assert.equal(p.beforeAngularCuspCandidate, near);
    assert.equal(p.hasNatalRisingCuspApproach, false);
    assert.equal(p.hasNearNatalSeventhOrTenthCuspWithoutRisingPlanet, confirmed);
    const distances = positions.map(row => [row.planet, Math.abs(arc(row.longitude - cusps[9]))]).sort((a, b) => a[1] - b[1]);
    const uniqueNearest = distances[0][0] === 'Saturn' && distances[0][1] + 1e-9 < distances[1][1];
    assert.equal(p.hasNatalElevatedTenthCuspApproach, cuspHouse === 10 && near && uniqueNearest);
    if (elevated) {
      assert.ok(p.elevatedTenthCuspApproach);
      assert.equal(p.elevatedTenthCuspApproach.nextClosestBody, 'Mercury');
      assert.ok(Math.abs(p.elevatedTenthCuspApproach.nextClosestDistance - distances[1][1]) < 1e-9);
    }
    if (offset === 'tie') assert.ok(Math.abs(distances[0][1] - distances[1][1]) < 1e-9);
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - crossing) < 30_000);
    const isolated = { ...run, facts: [fact] };
    const match = leoTransitMatch(isolated, 'p009');
    if (confirmed || elevated) {
      assert.equal(match.status, 'matched');
      assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    } else if (!near) assert.equal(match.status, 'not_matched');
    if (near) {
      assert.deepEqual([p.angularCuspApproach.fromHouse, p.angularCuspApproach.nextHouse], [cuspHouse - 1, cuspHouse]);
      assert.ok(Math.abs(p.angularCuspApproach.cuspLongitude - cusp) < 1e-8);
      assert.ok(Math.abs(p.angularCuspApproach.distance - angle) < 1e-8);
      const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), archive.snapshotId));
      const evidence = new RegExp('本命土星在第' + (cuspHouse - 1) + '宫，距前方第' + cuspHouse + '角宫宫头', 'u');
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, evidence);
      const elevationEvidence = '此星为最接近第十宫头的已核本命星';
      assert.equal(audit.includes(elevationEvidence), p.hasNatalElevatedTenthCuspApproach);
      const provider = formatFortunePrompt(input);
      assert.doesNotMatch(provider, evidence);
      assert.equal(provider.includes(elevationEvidence), false);
      assert.doesNotMatch(provider, /hasNearNatalSeventhOrTenthCuspWithoutRisingPlanet|elevatedTenthCuspApproach|nextClosestDistance/u);
      assert.equal(provider.includes('靠近第七或第十宫头的同一颗本命星'), confirmed);
      assert.equal(provider.includes('唯一最靠近该宫头'), elevated);
    } else {
      assert.equal(p.angularCuspApproach, undefined);
    }
  }
});

test('Leo confirms an exact solar passage to a natal planet approaching the rising cusp within five degrees', () => {
  const moon = snapshot().western.rawResult[0].positions.find(row => row.planet === 'Moon');
  const tilt = e_tilt(MakeTime(new Date(birthAt))).tobl;
  const crossing = SearchSunLongitude(moon.longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
  const date = new Date(crossing + 8 * 3_600_000).toISOString().slice(0, 10);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  for (const [distance, house, confirmation, status] of [[3.25, 12, true, 'matched'], [5, 12, true, 'matched'],
    [5.0001, 12, false, 'not_matched'], [-0.5, 1, false, 'matched']]) {
    const cusp = normalize(moon.longitude + distance);
    const { rightAscension, declination } = eclipticEquator(cusp, tilt);
    const armc = normalize(rightAscension - Math.acos(-Math.tan(35 * rad) * Math.tan(declination * rad)) / rad);
    const chart = snapshot(armc);
    const archive = { snapshotId: 'leo-approaching-rising-cusp', chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, crossing, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, crossing), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Moon');
    assert.ok(fact);
    const { cusps } = calculateHouseCusps(armc, 35, tilt, 'placidus');
    assert.equal(zodiacalHouse(moon.longitude, cusps), house);
    assert.ok(Math.abs(arc(cusps[0] - moon.longitude) - distance) < 1e-8);
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - crossing) < 30_000);
    const p = fact.normalizedPayload;
    assert.equal(p.natalHouse, house);
    assert.equal(p.hasNatalRisingCuspApproach, confirmation);
    if (confirmation) {
      assert.deepEqual([p.angularCuspApproach.fromHouse, p.angularCuspApproach.nextHouse], [12, 1]);
      assert.ok(Math.abs(p.angularCuspApproach.distance - distance) < 1e-8);
      assert.equal(p.isAngular, false);
    }
    const isolated = { ...run, facts: [fact] };
    const match = leoTransitMatch(isolated, 'p009');
    assert.equal(match.status, status);
    if (confirmation) {
      assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.deepEqual(match.sourceFactIds, [fact.factId]);
    }
    if (distance === 3.25) {
      const followingDay = new Date(crossing + day + 8 * 3_600_000).toISOString().slice(0, 10);
      const adjacent = calculate(chart, 'day', { date: followingDay });
      assert.ok(!adjacent.facts.some(row => row.factType === 'leo_solar_natal_contact'
        && row.normalizedPayload.natalTargetId === 'Moon'));
    }
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), archive.snapshotId));
    const provider = formatFortunePrompt(input);
    assert.equal(provider.includes('沿黄道距上升宫头不超过五度'), confirmation);
    const localEvidence = '本命月亮在第12宫，距前方第1角宫宫头';
    assert.equal(formatFortuneFactAudit(input).includes(localEvidence), confirmation);
    assert.doesNotMatch(provider, /本命月亮在第12宫，距前方第1角宫宫头|hasNatalRisingCuspApproach/u);
  }
});

test('Leo solar passage uses the natal rising decan ruler on the exact contact day', () => {
  const longitude = snapshot().western.rawResult[0].positions.find(row => row.planet === 'Saturn').longitude;
  const exactAt = SearchSunLongitude(longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
  const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const isSaturnCrossing = ({ factType, normalizedPayload }) =>
    factType === 'leo_solar_natal_contact' && normalizedPayload.natalTargetId === 'Saturn';
  for (const [armc, decan, decanSign, ruler] of [[66, 1, 5, 'Mercury'], [66.25, 2, 9, 'Saturn']]) {
    const chart = snapshot(armc), { ascendant } = chart.western.rawResult[0];
    const reference = { snapshotId: `leo-sun-decan-${armc}`, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const crossing = run.facts.find(isSaturnCrossing);
    assert.ok(crossing, String(armc));
    assert.ok(Math.abs(Date.parse(crossing.exactInstant) - exactAt) < 30_000);
    const p = crossing.normalizedPayload;
    assert.ok(Math.abs(p.ascendantDecan.longitude - ascendant) < 1e-8);
    assert.deepEqual([p.ascendantRuler, p.natalHouse, p.ascendantDecan.sign, p.ascendantDecan.decan,
      p.ascendantDecan.decanSign, p.ascendantDecan.ruler], ['Mercury', 5, 5, decan, decanSign, ruler]);
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate,
      p.beforeAngularCuspCandidate], [false, false, false, false, false]);
    const qualifies = ruler === 'Saturn';
    assert.equal(p.isAscendantDecanRuler, qualifies);
    assert.equal(p.qualifiedCandidate, qualifies);
    const result = leoTransitMatch(run, 'p009');
    assert.equal(result.status, qualifies ? 'matched' : 'not_matched');
    assert.equal(result.sourceFactIds.includes(crossing.factId), qualifies);
    if (qualifies) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
      const evidence = /本命上升第2(?:个)?十分度[^。；]*辅助主星/u;
      assert.match(formatFortuneFactAudit(input), evidence);
      assert.equal(result.matchedSourceExcerpt, 'stirs into activity');
      assert.deepEqual(result.windows, [{ start: crossing.activeFrom, endExclusive: crossing.activeTo }]);
      assert.match(formatFortunePrompt(input), /实际同度经过本命上升十分度的辅助主星/u);
      assert.doesNotMatch(formatFortunePrompt(input), evidence);
      const nextDate = new Date(exactAt + day + 8 * 3_600_000).toISOString().slice(0, 10);
      assert.ok(!calculate(chart, 'day', { date: nextDate }).facts.some(isSaturnCrossing));
    }
  }
});

test('Leo solar passage verifies the natal ascendant twelfth-part ruler within both half-open boundaries', () => {
  const latitude = 35;
  const obliquity = e_tilt(MakeTime(new Date(birthAt))).tobl;
  const natalVenus = snapshot().western.rawResult[0].positions.find(row => row.planet === 'Venus').longitude;
  const exactAt = SearchSunLongitude(natalVenus, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
  const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
  const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const field = 'isAscendantDwadashamshaRuler';
  const isVenusCrossing = ({ factType, normalizedPayload: p }) => factType === 'leo_solar_natal_contact' && p.natalTargetId === 'Venus';
  for (const [ascendant, part, ruler] of [[2.499, 1, 'Mars'], [2.501, 2, 'Venus'], [4.999, 2, 'Venus'], [5.001, 3, 'Mercury']]) {
    const { rightAscension, declination } = eclipticEquator(ascendant, obliquity);
    const armc = normalize(rightAscension - Math.acos(-Math.tan(latitude * rad) * Math.tan(declination * rad)) / rad);
    const chart = snapshot(armc, latitude);
    const reference = { chart, snapshotId: 'leo-sun-twelfth-part-' + ascendant };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const crossing = run.facts.find(isVenusCrossing);
    assert.ok(crossing, String(ascendant));
    assert.ok(Math.abs(Date.parse(crossing.exactInstant) - exactAt) < 30_000);
    const p = crossing.normalizedPayload;
    const qualifies = ruler === 'Venus';
    assert.equal(p.natalHouse, 11);
    assert.deepEqual([p.ascendantRuler, p.ascendantDecan.ruler], ['Mars', 'Mars']);
    assert.ok(Math.abs(p.ascendantDwadashamsha.longitude - ascendant) < 1e-8);
    assert.deepEqual([p.ascendantDwadashamsha.sign, p.ascendantDwadashamsha.part, p.ascendantDwadashamsha.partSign,
      p.ascendantDwadashamsha.ruler], [0, part, part - 1, ruler]);
    assert.equal(p[field], qualifies);
    assert.equal(p.qualifiedCandidate, qualifies);
    const scoped = { ...run, facts: [crossing] };
    const match = leoTransitMatch(scoped, 'p009');
    assert.equal(match.status, qualifies ? 'matched' : 'not_matched');
    if (!qualifies) continue;
    assert.deepEqual(match.windows, [{ start: crossing.activeFrom, endExclusive: crossing.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
    const evidence = /本命上升第2个十二分度的辅助主星/u;
    assert.match(formatFortuneFactAudit(input), evidence);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /十二分度/u);
    assert.doesNotMatch(provider, /ascendantDwadashamsha|isAscendantDwadashamshaRuler|2\.501|4\.999/u);
    assert.doesNotMatch(provider, evidence);
    const wrongProfile = { ...crossing, normalizedPayload: { ...p, ascendantDwadashamshaProfile: 'other' } };
    assert.equal(leoTransitMatch({ ...run, facts: [wrongProfile] }, 'p009').status, 'not_matched');
  }
});

test('Leo Sun and Saturn transits distinguish a sole natal Moon contact and second-house minor pressure', () => {
  for (const [birthDay, qualifies] of [[3, true], [4, false]]) {
    const at = Date.UTC(1990, 0, birthDay, 4);
    const chart = snapshot(245, 35, at);
    const raw = chart.western.rawResult[0];
    const longitude = body => raw.positions.find(row => row.planet === body).longitude;
    const solarCrossing = SearchSunLongitude(longitude('Mercury'), new Date('2026-01-01T00:00Z'), 366).date.getTime();
    const date = new Date(solarCrossing + 8 * 3_600_000).toISOString().slice(0, 10);
    const daily = calculate(chart, 'day', { date });
    const solar = daily.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Mercury');
    assert.ok(solar, date);
    assert.ok(Math.abs(Date.parse(solar.exactInstant) - solarCrossing) < 30_000);
    const p = solar.normalizedPayload;
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate,
      p.beforeAngularCuspCandidate, p.isAscendantDecanRuler], [false, false, false, false, false, false]);
    assert.equal(p.soleLunarCandidate, qualifies);
    assert.equal(p.qualifiedCandidate, qualifies);
    const solarResult = leoTransitMatch(daily, 'p009');
    assert.equal(solarResult.status, qualifies ? 'matched' : 'not_matched');
    assert.equal(solarResult.sourceFactIds.includes(solar.factId), qualifies);
    if (qualifies) {
      const [witness] = p.soleLunarAspectContacts;
      assert.deepEqual([witness.body, witness.aspect, witness.coordinate, witness.orb], ['Mercury', 'sextile', 'longitude', 7]);
      assert.ok(Math.abs(witness.difference - Math.abs(Math.abs(arc(longitude('Moon') - longitude('Mercury'))) - 60)) < 1e-8);
    } else {
      assert.deepEqual(p.soleLunarAspectContacts, []);
    }
    const { input: solarInput } = buildFortuneModelContext(daily,
      interpretFortune(daily, requestForFortuneRun(daily), `leo-solar-sole-moon-${birthDay}`));
    const solarAudit = '本命月亮在已核相位中仅与该星成相，实见六合相';
    assert.equal(formatFortuneFactAudit(solarInput).includes(solarAudit), qualifies);
    assert.equal(/作者已核相位范围内唯一联系的星体/u.test(formatFortunePrompt(solarInput)), qualifies);
    assert.doesNotMatch(formatFortunePrompt(solarInput), /本命月亮在已核相位中仅与该星成相|soleLunarAspectContacts/u);

    const annual = calculate(chart);
    const saturnResult = leoTransitMatch(annual, 'p001');
    assert.equal(saturnResult.status, 'matched');
    const saturnHits = annual.facts.filter(row => saturnResult.sourceFactIds.includes(row.factId));
    assert.ok(saturnHits.length);
    const tilt = e_tilt(MakeTime(new Date(at))).tobl;
    const { cusps } = calculateHouseCusps(245, 35, tilt, 'placidus');
    const semisquareDeviation = Math.abs(Math.abs(arc(longitude('Mars') - longitude('Mercury'))) - 45);
    assert.ok(semisquareDeviation < 4);
    for (const { factType, activeFrom, activeTo, normalizedPayload: finance } of saturnHits) {
      assert.equal(factType, 'leo_second_house_transit_context');
      const midpoint = (Date.parse(activeFrom) + Date.parse(activeTo)) / 2;
      assert.equal(zodiacalHouse(readTransitLongitude('Saturn', midpoint), cusps), 2);
      assert.equal(finance.natalFinancialState, qualifies ? 'support' : 'mixed');
      assert.deepEqual(finance.financialAnchors.map(row => row.body), [qualifies ? 'Mars' : 'Moon']);
      assert.equal(finance.hasNatalSecondHouseMinorAffliction, qualifies);
      if (qualifies) {
        assert.deepEqual(finance.natalSecondHousePressureSources, []);
        assert.equal(finance.financeBasis, 'empty_second_house_ruler');
        const [witness] = finance.natalSecondHouseMinorAfflictionContacts;
        assert.equal(finance.natalSecondHouseMinorAfflictionContacts.length, 1);
        assert.deepEqual([witness.first, witness.body, witness.aspect, witness.orb], ['Mars', 'Mercury', 'semisquare', 4]);
        assert.ok(Math.abs(witness.difference - semisquareDeviation) < 1e-8);
      } else {
        assert.deepEqual(finance.natalSecondHouseMinorAfflictionContacts, []);
      }
    }
    const { input: financeInput } = buildFortuneModelContext(annual,
      interpretFortune(annual, requestForFortuneRun(annual), `leo-saturn-secondary-pressure-${birthDay}`));
    const financeAudit = /本命第二宫首查星火星与水星见半刑相[^。]*相对较弱的压力/u;
    assert.equal(financeAudit.test(formatFortuneFactAudit(financeInput)), qualifies);
    assert.doesNotMatch(formatFortunePrompt(financeInput), /本命第二宫首查星火星与水星见半刑相|natalSecondHouseMinorAfflictionContacts/u);
    assert.match(formatFortunePrompt(financeInput), /审慎安排支出是原文给出的可选回应/u);
    assert.doesNotMatch(formatFortunePrompt(financeInput), /本命财务压力与同期财务推运方向一致/u);
  }
});

test('Leo solar passage uses the unique nearest natal lunar longitude contact among multiple planets', () => {
  for (const [birthDay, qualifies] of [[4, false], [5, true]]) {
    const birth = Date.UTC(1990, 0, birthDay, 4);
    const chart = snapshot(245, 35, birth);
    const natalLongitude = body => chart.western.rawResult[0].positions.find(row => row.planet === body).longitude;
    const exactAt = SearchSunLongitude(natalLongitude('Mercury'), new Date('2026-01-01T00:00Z'), 366).date.getTime();
    const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-sun-nearest-moon', chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Mercury');
    assert.ok(fact);
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - exactAt) < 30_000);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate,
      p.beforeAngularCuspCandidate, p.isAscendantDecanRuler, p.soleLunarCandidate], Array(7).fill(false));
    assert.equal(p.closestLunarCandidate, qualifies);
    const match = leoTransitMatch(run, 'p009');
    assert.equal(match.status, qualifies ? 'matched' : 'not_matched');
    assert.equal(match.sourceFactIds.includes(fact.factId), qualifies);
    if (qualifies) {
      const [contact] = p.closestLunarAspectContacts;
      assert.deepEqual([contact.body, contact.aspect, contact.coordinate, contact.orb], ['Mercury', 'square', 'longitude', 8]);
      assert.ok(Math.abs(contact.difference - Math.abs(Math.abs(arc(natalLongitude('Moon') - natalLongitude('Mercury'))) - 90)) < 1e-8);
      assert.ok(Math.abs(Math.abs(arc(natalLongitude('Moon') - natalLongitude('Saturn'))) - 90) < 8);
      assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    } else {
      assert.deepEqual(p.closestLunarAspectContacts, []);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const detail = '在已核本命月亮的多个黄经相位中，该星是唯一最接近精确相位的对象';
    assert.equal(formatFortuneFactAudit(input).includes(detail), qualifies);
    assert.equal(/本命月亮唯一最近的已核黄经相位对象/u.test(formatFortunePrompt(input)), qualifies);
    assert.ok(!formatFortunePrompt(input).includes(detail));
  }
});

test('Leo solar passage can use the Moon’s sole natal parallel without comparing it to another aspect', () => {
  for (const [birthDay, qualifies] of [[1, true], [2, false]]) {
    const birth = Date.UTC(1924, 8, birthDay, 4);
    const chart = snapshot(130, 35, birth);
    const natalPositions = chart.western.rawResult[0].positions;
    const mercury = natalPositions.find(row => row.planet === 'Mercury');
    const exactAt = SearchSunLongitude(mercury.longitude, new Date('2026-01-01T00:00Z'), 366).date.getTime();
    const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-sun-sole-lunar-parallel', chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Mercury');
    const p = fact.normalizedPayload;
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - exactAt) < 30_000);
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate,
      p.beforeAngularCuspCandidate, p.isAscendantDecanRuler, p.closestLunarCandidate], Array(7).fill(false));
    assert.equal(p.qualifiedCandidate, qualifies);
    assert.equal(p.soleLunarCandidate, qualifies);
    const match = leoTransitMatch(run, 'p009');
    assert.equal(match.status, qualifies ? 'matched' : 'not_matched');
    assert.equal(match.sourceFactIds.includes(fact.factId), qualifies);
    if (qualifies) {
      const [contact] = p.soleLunarAspectContacts;
      assert.deepEqual([contact.body, contact.aspect, contact.coordinate, contact.orb], ['Mercury', 'parallel', 'declination', 1]);
      const at = new Date(birth);
      const declination = body => EquatorFromVector(RotateVector(Rotation_EQJ_EQD(at), GeoVector(Body[body], at, true))).dec;
      assert.ok(Math.abs(contact.difference - Math.abs(Math.abs(declination('Moon')) - Math.abs(declination('Mercury')))) < 1e-8);
    } else {
      assert.deepEqual(p.soleLunarAspectContacts, []);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const label = /本命月亮在已核相位中仅与该星成相，实见赤纬绝对值平行/u;
    assert.equal(label.test(formatFortuneFactAudit(input)), qualifies);
    assert.equal(/作者已核相位范围内唯一联系的星体/u.test(formatFortunePrompt(input)), qualifies);
    assert.doesNotMatch(formatFortunePrompt(input), label);
  }
});

test('Leo solar passage ranks lunar longitude after replacing only the same-pair parallel', () => {
  const rows = [
    { birth: '1990-02-25T00:00:00Z', armc: 0, target: 'Jupiter', overlapping: 'Sun', qualifies: true },
    { birth: '1990-03-02T00:00:00Z', armc: 5, target: 'Neptune', overlapping: 'Neptune', independent: 'Saturn', qualifies: false },
  ];
  for (const scenario of rows) {
    const birth = Date.parse(scenario.birth);
    const chart = snapshot(scenario.armc, 35, birth);
    const natalLongitude = body => chart.western.rawResult[0].positions.find(row => row.planet === body).longitude;
    const exactAt = SearchSunLongitude(natalLongitude(scenario.target), new Date('2026-01-01T00:00Z'), 366).date.getTime();
    const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-natal-moon-parallel-' + scenario.target, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === scenario.target);
    assert.ok(fact);
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - exactAt) < 30_000);
    const birthPosition = body => ({ body, longitude: natalLongitude(body), declination: EquatorFromVector(
      RotateVector(Rotation_EQJ_EQD(new Date(birth)), GeoVector(Body[body], new Date(birth), true))).dec });
    const moon = birthPosition('Moon');
    const overlapping = readLeoNatalAspects(moon, birthPosition(scenario.overlapping));
    assert.ok(overlapping.some(row => row.aspect === 'square' || row.aspect === 'trine' || row.aspect === 'conjunction'));
    assert.ok(overlapping.some(row => row.aspect === 'parallel'));
    if (scenario.independent) {
      const independent = readLeoNatalAspects(moon, birthPosition(scenario.independent));
      assert.deepEqual(independent.map(row => row.aspect), ['parallel']);
    }

    const p = fact.normalizedPayload;
    assert.deepEqual([p.isAngular, p.isAscendantRuler, p.closestSolarCandidate, p.risingDegreeCandidate,
      p.beforeAngularCuspCandidate, p.isAscendantDecanRuler, p.soleLunarCandidate], Array(7).fill(false));
    assert.equal(p.closestLunarCandidate, scenario.qualifies);
    const match = leoTransitMatch(run, 'p009');
    assert.equal(match.status, scenario.qualifies ? 'matched' : 'not_matched');
    assert.equal(match.sourceFactIds.includes(fact.factId), scenario.qualifies);
    if (scenario.qualifies) {
      assert.deepEqual(p.closestLunarAspectContacts.map(row => [row.body, row.aspect]), [['Jupiter', 'trine']]);
      assert.deepEqual(p.lunarParallelReplacements.map(row => [row.body, row.preferredAspect]), [['Sun', 'conjunction']]);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const detail = '该星对的赤纬平行不重复参与排序';
    assert.equal(formatFortuneFactAudit(input).includes(detail), scenario.qualifies);
    assert.ok(!formatFortunePrompt(input).includes(detail));
  }
});

test('p009 confirms the notable natal solar contact only when a separate parallel cannot change the ranking', () => {
  const solarRankPhrase = /本命太阳唯一的最近有效主要相位对象/u;
  const localPhrase = /本命太阳唯一的最近对象具备主要黄经相位/u;
  for (const [dayOfBirth, independentParallels, qualifies] of [[7, ['Mars', 'Jupiter'], false], [12, [], true]]) {
    const birth = Date.UTC(1990, 0, dayOfBirth, 4);
    const chart = snapshot(130, 35, birth);
    const natal = body => {
      const at = new Date(birth);
      return { body, longitude: chart.western.rawResult[0].positions.find(row => row.planet === body).longitude,
        declination: EquatorFromVector(RotateVector(Rotation_EQJ_EQD(at), GeoVector(Body[body], at, true))).dec };
    };
    for (const body of independentParallels) {
      assert.deepEqual(readLeoNatalAspects(natal('Sun'), natal(body)).map(row => row.aspect), ['parallel']);
    }
    const exactAt = SearchSunLongitude(natal('Saturn').longitude, new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
    const date = new Date(exactAt + 8 * 3_600_000).toISOString().slice(0, 10);
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
    const reference = { snapshotId: 'leo-sun-nearest-solar-' + dayOfBirth, chart };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, exactAt, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, exactAt), reference.snapshotId, reference);
    const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === 'Saturn');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.deepEqual(p.closestSolarAspects.map(row => [row.body, row.aspect, row.coordinate]), [['Saturn', 'conjunction', 'longitude']]);
    assert.equal(p.hasUniqueClosestNatalSolarMajor, qualifies);
    const result = leoTransitMatch(run, 'p009');
    assert.equal(result.status, qualifies ? 'matched' : 'partial');
    if (qualifies) assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.equal(localPhrase.test(formatFortuneFactAudit(input)), qualifies);
    const provider = formatFortunePrompt(input);
    assert.equal(solarRankPhrase.test(provider), qualifies);
    assert.doesNotMatch(provider, /本命太阳唯一的最近对象具备主要黄经相位|hasUniqueClosestNatalSolarMajor/u);
  }
});

test('p009 confirms the nearest named minor longitude contact separately for natal Sun and Moon', () => {
  const cases = [
    { luminary: 'Sun', dates: ['1960-01-31', '1960-01-30'], armc: 129, target: 'Jupiter', aspect: 'semisquare', angle: 45 },
    { luminary: 'Moon', dates: ['1960-01-04', '1960-01-05'], armc: 70, target: 'Neptune', aspect: 'sesquiquadrate', angle: 135 },
  ];
  for (const { luminary, dates, armc, target, aspect, angle } of cases) {
    for (const [index, birthDate] of dates.entries()) {
      const chart = snapshot(armc, 35, Date.parse(birthDate + 'T04:00:00Z'));
      const positions = chart.western.rawResult[0].positions;
      const longitude = body => positions.find(row => row.planet === body).longitude;
      const at = SearchSunLongitude(longitude(target), new Date('2026-01-01T00:00:00Z'), 366).date.getTime();
      const date = new Date(at + 8 * 3_600_000).toISOString().slice(0, 10);
      const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
      const reference = { snapshotId: 'leo-p009-minor-' + birthDate, chart };
      const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, reference)));
      const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, at), reference.snapshotId, reference);
      const fact = run.facts.find(row => row.factType === 'leo_solar_natal_contact' && row.normalizedPayload.natalTargetId === target);
      assert.ok(fact);
      const p = fact.normalizedPayload;
      const qualifies = index === 0;
      assert.ok(Math.abs(Date.parse(fact.exactInstant) - at) < 100);
      assert.equal(p.hasUniqueClosestNatalSolarMinor, luminary === 'Sun' && qualifies);
      assert.equal(p.closestLunarCandidate, luminary === 'Moon' && qualifies);
      assert.equal(p.soleLunarCandidate, false);
      assert.ok([p.isAngular, p.isAscendantRuler, p.isAscendantDecanRuler, p.isAscendantDwadashamshaRuler, p.hasExactRisingDegreeAspect,
        p.hasUniqueClosestNatalSolarMajor, p.soleSolarParallelCandidate, p.beforeAngularCuspCandidate].every(value => value === false));
      const matching = { ...run, facts: [fact] };
      const result = leoTransitMatch(matching, 'p009');
      if (!qualifies) {
        assert.notEqual(result.status, 'matched');
        continue;
      }
      const [witness] = luminary === 'Sun' ? p.closestSolarAspects : p.closestLunarAspectContacts;
      assert.deepEqual([witness.body, witness.aspect, witness.coordinate, witness.orb], [target, aspect, 'longitude', 4]);
      assert.ok(Math.abs(witness.difference - Math.abs(Math.abs(arc(longitude(luminary) - longitude(target))) - angle)) < 1e-8);
      assert.equal(result.status, 'matched');
      assert.deepEqual(result.sourceFactIds, [fact.factId]);
      assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const { input } = buildFortuneModelContext(matching, interpretFortune(matching, requestForFortuneRun(matching), reference.snapshotId));
      assert.match(formatFortuneFactAudit(input), luminary === 'Sun' ? /本命太阳唯一的最近对象为半刑或倍半刑/u : /最接近精确相位.*倍半刑/u);
      const provider = formatFortunePrompt(input);
      assert.match(provider, luminary === 'Sun' ? /本命太阳唯一最近的已核半刑或倍半刑/u : /唯一最近的已核黄经相位对象/u);
      assert.doesNotMatch(provider, /hasUniqueClosestNatalSolarMinor|closestLunarAspectContacts|同场没有阻碍排序/u);
    }
  }
});

test('Leo Jupiter in the second house uses actual occupants before the cusp ruler', () => {
  const year = calculate(snapshot(320));
  const hit = year.facts.find(f => f.factType === 'leo_second_house_transit_context' && f.normalizedPayload.transitBody === 'Jupiter');
  const p = hit.normalizedPayload;
  assert.equal(p.financeBasis, 'second_house_occupants');
  assert.deepEqual(p.financialAnchors.map(a => [a.body, a.house]), [['Jupiter', 2]]);
  assert.ok(p.financialAnchors[0].contacts.every(a => a.difference <= a.orb));
  const match = leoTransitMatch(year, 'p004');
  assert.equal(match.status, 'matched');
  assert.ok(match.sourceFactIds.includes(hit.factId));
  const generic = { ...year, facts: year.facts.filter(f => f.factType !== 'leo_second_house_transit_context') };
  assert.equal(leoTransitMatch(generic, 'p004').status, 'unknown');
});

test('second-house financial testimony uses real qualifiers and same-pair repeats in their own transit intervals', () => {
  const contact = (body, aspect) => ({ body, aspect, coordinate: 'longitude', difference: 0, orb: 7 });
  const natal = {
    bodies: [{ body: 'Mercury', house: 2 }, { body: 'Venus', house: 5 }],
    financialAnchors: [{ body: 'Mercury', contacts: [contact('Moon', 'trine'), contact('Venus', 'square')] }],
    generalFinancialPairs: [{ first: 'Jupiter', ...contact('Saturn', 'sextile'), involvesSecondOrTenthRuler: false },
      { first: 'Venus', ...contact('Moon', 'opposition'), involvesSecondOrTenthRuler: true }],
  };
  const houses = { transits: ['Jupiter', 'Saturn'].map(body => ({ body,
    placidusIntervals: [{ start: 0, end: 10, natalHouse: 2 }, { start: 10, end: 12, natalHouse: 3 }] })) };
  const band = (body, target, aspectType, start, end, targetKind = 'natal') => ({ progressedBody: body, natalTargetId: target,
    aspectType, targetKind, start, end, coordinate: 'ecliptic_longitude', exactTimes: [start, end] });
  const timings = [band('Moon', 'Mercury', 'trine', -1, 3), band('Mercury', 'Venus', 'square', 4, 7),
    band('Venus', 'Moon', 'opposition', 7, 10), band('Mercury', 'Moon', 'sextile', 3, 8),
    band('Mercury', 'Moon', 'trine', 3, 10, 'progressed'), band('Jupiter', 'Saturn', 'sextile', 1, 9)];
  const rows = buildLeoSecondHouseContexts(natal, houses, timings);
  assert.ok(rows.every(row => row.natalFinancialState === 'mixed' && row.financialTestimonies.length === 3));
  assert.deepEqual(rows.map(({ transitBody, start, end, repeatingDirections }) =>
    [transitBody, start, end, repeatingDirections.map(row => [row.aspectType, row.exactTimes])]), [
    ['Jupiter', 0, 3, [['trine', []]]], ['Jupiter', 3, 10, []],
    ['Saturn', 0, 4, []], ['Saturn', 4, 7, [['square', [4]]]], ['Saturn', 7, 10, [['opposition', [7]]]],
  ]);
  const absent = buildLeoSecondHouseContexts({ ...natal, financialAnchors: [], generalFinancialPairs: natal.generalFinancialPairs.slice(0, 1) },
    houses, timings);
  assert.ok(absent.every(row => row.natalFinancialState === 'none' && row.repeatingDirections.length === 0));
  for (const [passage, body] of [['p001', 'Saturn'], ['p004', 'Jupiter']]) {
    const id = fortuneKnowledge.western.rules.find(row => row.knowledgeId.endsWith('leo-v1-transit-' + passage + '-001')).knowledgeId;
    const cases = ['none', 'pressure', 'support', 'mixed', undefined].map(natalFinancialState => ({
      factType: 'leo_second_house_transit_context', scope: 'transit', completeness: 'complete', normalizedPayload: {
        profile: leoNatalTransitPolicy.profile, financialTestimonyProfile: leoNatalTransitPolicy.financialTestimony,
        financialDirectionProfile: leoNatalTransitPolicy.financialDirectionProfile,
        financeBasis: 'second_house_occupants', zodiac: 'tropical', transitBody: body, natalHouse: 2, natalFinancialState,
        financialDirectionState: 'none',
      },
    }));
    const evaluate = facts => evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === id).required[0];
    const expected = passage === 'p004' ? cases : cases.slice(0, -1);
    assert.deepEqual(evaluate(cases).hits, expected);
    assert.equal(evaluate(cases.slice(-1)).unknown, passage === 'p001');
    const unreviewedDirections = { ...cases[0], normalizedPayload: { ...cases[0].normalizedPayload, financialDirectionState: undefined } };
    assert.equal(evaluate([unreviewedDirections]).unknown, passage === 'p001');
    const outside = { ...cases[0], normalizedPayload: { ...cases[0].normalizedPayload, natalHouse: 3 } };
    assert.deepEqual(evaluate([outside]).hits, []);
  }
});

test('second-house crossings and money directions must share the actual natal point and valid time', () => {
  const natal = { financeBasis: 'second_house_occupants',
    financialAnchors: [{ body: 'Saturn', contacts: [] }], generalFinancialPairs: [],
    bodies: [{ body: 'Saturn', longitude: 15 }, { body: 'Mercury', longitude: 42 }] };
  const houses = { transits: [{ body: 'Jupiter', placidusIntervals: [{ start: 0, end: 10, natalHouse: 2 }] }] };
  const direction = { progressedBody: 'Venus', natalTargetId: 'Saturn', targetKind: 'natal', aspectType: 'square',
    coordinate: 'ecliptic_longitude', start: 2, end: 6, exactTimes: [3, 6] };
  const at = (ms, target = 'Saturn', longitude = 15, completeness = 'complete') => ({
    method: 'western', scope: 'transit', factType: 'aspect_exact', exactInstant: new Date(ms).toISOString(), completeness,
    sourceFactIds: ['raw:' + ms],
    normalizedPayload: { zodiac: 'tropical', aspectType: 'conjunction', natalTargetType: 'planet',
      transitBody: 'Jupiter', natalTargetId: target, natalLongitude: longitude, transitMotion: 'direct' },
  });
  const rows = buildLeoSecondHouseContexts(natal, houses, [direction, { ...direction, targetKind: 'progressed', start: 0, end: 10 }],
    [at(3), at(4, 'Mercury', 42), at(5, 'Saturn', 16), at(5, 'Saturn', 15, 'partial'), at(6), at(10)]);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.financialDirectionState]), [
    [0, 2, 'none'], [2, 6, 'adverse'], [6, 10, 'none'],
  ]);
  assert.deepEqual(rows[1].financialDirections.map(({ target, roles, exactTimes }) => [target, roles, exactTimes]),
    [['Saturn', ['second_house_occupants'], [3]]]);
  assert.deepEqual(rows.flatMap(row => row.targetCrossings).map(({ exactAt, target, sameTargetDirectionState }) =>
    [exactAt, target, sameTargetDirectionState]), [[3, 'Saturn', 'adverse'], [6, 'Saturn', 'none']]);
});

test('both Leo financial directions pass through the client contract and reach Chinese evidence while the actual pair repeats', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-06-15T00:00:00Z');
  const cases = [
    ['p001', '1967-02-07', 240, 'empty_second_house_ruler', 'mixed', ['Mars', 'Jupiter', 'square'], /次限火星对本命木星的四分相/u],
    ['p004', '1964-06-11', 330, 'second_house_occupants', 'support', ['Venus', 'Saturn', 'trine'], /次限金星对本命土星的三分相/u],
  ];
  for (const [passage, date, armc, basis, state, pair, phrase] of cases) {
    const reference = { snapshotId: 'leo-finance-' + passage };
    const at = Date.parse(date + 'T00:00:00Z');
    const chart = snapshot(armc, 0, at);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'leo-financial-testimony', reference);
    const match = leoTransitMatch(run, passage);
    assert.equal(match.status, 'matched', passage);
    const sameAspect = ({ progressedBody, natalTargetId, aspectType }) =>
      [progressedBody, natalTargetId, aspectType].join(':') === pair.join(':');
    const fact = run.facts.find(({ factId, normalizedPayload: p }) => match.sourceFactIds.includes(factId)
      && p.repeatingDirections?.some(sameAspect));
    assert.ok(fact, passage);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.financeBasis, p.natalFinancialState], [basis, state], passage);
    assert.ok(p.financialTestimonies.some(row => row.aspect === pair[2] && pair.slice(0, 2).every(body => [row.first, row.body].includes(body))));
    assert.ok(run.facts.some(row => row.factType === 'leo_progressed_aspect' && row.normalizedPayload.targetKind === 'natal'
      && sameAspect(row.normalizedPayload) && row.activeFrom <= fact.activeFrom && fact.activeTo <= row.activeTo));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-financial-report'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('过宫同一时段重现了对应本命星对与相位'), passage + ' repeats are reserved in the input');
    assert.ok(phrase.test(prompt), passage + ' renders the actual repeating pair');
    if (passage === 'p001') {
      const { cusps } = calculateHouseCusps(armc, 0, e_tilt(MakeTime(new Date(at))).tobl, 'placidus');
      const natalPositions = chart.western.rawResult[0].positions;
      assert.ok(p.natalSecondHousePressureSources.length);
      for (const contact of p.natalSecondHousePressureSources) {
        const anchor = p.financialAnchors.find(row => row.body === contact.first);
        assert.ok(anchor?.contacts.some(row => row.body === contact.body && row.aspect === contact.aspect));
        assert.ok(['square', 'opposition'].includes(contact.aspect));
        assert.equal(contact.sourceHouse, zodiacalHouse(natalPositions.find(row => row.planet === contact.body).longitude, cusps));
      }
      assert.match(prompt, /实居第\d+宫，与第二宫首查星/u);
      assert.doesNotMatch(formatFortunePrompt(input), /实居第\d+宫，与第二宫首查星|natalSecondHousePressureSources/u);
    } else {
      assert.equal(p.natalSecondHousePressureSources, undefined);
    }
  }
});

test('Leo Saturn uses the financial-pressure reading only when the actual directions support the whole matched window', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-06-15T00:00:00Z');
  const birth = Date.parse('1940-02-26T00:00:00Z');
  const reference = { snapshotId: 'leo-saturn-financial-pressure', chart: snapshot(236, 25, birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const match = leoTransitMatch(run, 'p001');
  const financeFacts = run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
  const witness = financeFacts.find(fact => fact.activeFrom <= new Date(now).toISOString() && new Date(now).toISOString() < fact.activeTo);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.natalFinancialState, p.financialDirectionState], ['pressure', 'adverse']);
  assert.ok(p.financialDirections.some(direction => direction.body === 'Sun' && direction.target === 'Venus'
    && direction.aspectType === 'semisquare'));
  const { cusps } = calculateHouseCusps(236, 25, e_tilt(MakeTime(new Date(birth))).tobl, 'placidus');
  assert.equal(zodiacalHouse(readTransitLongitude('Saturn', now), cusps), 2);
  const isolated = { ...run, facts: run.facts.filter(fact => fact.factId === witness.factId || !financeFacts.includes(fact)) };
  const verified = leoTransitMatch(isolated, 'p001');
  assert.deepEqual(verified.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /本命财务压力与同期财务推运方向一致/u);
  assert.doesNotMatch(prompt, /1940-02-26|financialDirectionState|次限太阳对本命金星的半刑相/u);
});

test('a real client Jupiter conjunction in the second house reaches the local financial audit', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-06-15T00:00:00Z');
  const reference = { snapshotId: 'leo-jupiter-mercury-second-house',
    chart: snapshot(19, 0, Date.parse('1985-07-15T04:00:00Z')) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  const match = leoTransitMatch(run, 'p004');
  const actual = run.facts.find(fact => fact.factType === 'aspect_exact' && fact.normalizedPayload.transitBody === 'Jupiter'
    && fact.normalizedPayload.natalTargetId === 'Mercury' && fact.normalizedPayload.aspectType === 'conjunction'
    && fact.exactInstant.startsWith('2026-09-28'));
  const witness = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.targetCrossings.some(row => row.exactAt === actual?.exactInstant));
  assert.equal(match.status, 'matched');
  assert.ok(actual && witness);
  assert.ok(actual.sourceFactIds.every(id => witness.sourceFactIds.includes(id)));
  const crossing = witness.normalizedPayload.targetCrossings.find(row => row.exactAt === actual.exactInstant);
  assert.deepEqual([crossing.target, crossing.roles, crossing.sameTargetDirectionState],
    ['Mercury', ['second_house_occupants'], 'none']);
  assert.ok(witness.activeFrom <= crossing.exactAt && crossing.exactAt < witness.activeTo);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jupiter-exact-financial-contact'));
  assert.match(formatFortuneFactAudit(input), /实合本命水星/u);
});

test('frame inference refuses incompatible, uncertain, conflicting or physically inconsistent archives', () => {
  const chart = snapshot();
  assert.equal(readWesternHouseFrame(chart).status, 'ready');
  chart.timeKnown = false; assert.equal(readWesternHouseFrame(chart).status, 'uncertain');
  chart.timeKnown = true; chart.western.engineVersion = 'unknown'; assert.equal(readWesternHouseFrame(chart).status, 'unsupported');
  chart.western.engineVersion = '2.1.19'; chart.western.rawResult[0].positions[0].longitude += 20;
  assert.equal(readWesternHouseFrame(chart).status, 'inconsistent_natal');
  const clock = snapshot(); clock.bazi = { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: new Date(birthAt + day).toISOString() }] };
  assert.equal(readWesternHouseFrame(clock).status, 'inconsistent_clock');
  assert.equal(westernHousePolicy.rootToleranceMs, 1000);
});

test('Sepharial London values independently identify the time-based house table', () => {
  // Original pp. 36–37, 40. House columns are printed to a whole degree,
  // with the ascendant printed separately to a minute.
  const rows = [
    { time: 0, cusps: [0, 39, 82, 116.6, 132, 153] },
    { time: 6, cusps: [90, 126, 156, 180, 204, 234] },
    { time: 6 + 7 / 60 + 28 / 3600, cusps: [92, 128, 158, 181.55, 206, 236] },
  ];
  for (const row of rows) {
    const table = [
      calculateHouseCusps(row.time * 15, 51 + 32 / 60, 23.45, 'placidus'),
      calculateHouseCusps(row.time * 15, 51 + 32 / 60, 23.45, 'regiomontanus'),
    ];
    const errors = table.map(result => [9, 10, 11, 0, 1, 2]
      .map((i, column) => Math.abs(arc(result.cusps[i] - row.cusps[column]))));
    assert.ok(errors[0].every(error => error < 0.8), JSON.stringify(errors[0]));
    assert.ok(errors[1].some(error => error > 2));
  }
});

test('Sepharial Saturn fact links ingress and retrograde exit to the actual second-house interval', () => {
  const chart = snapshot(240.4);
  const year = calculate(chart, 'year', { year: 2025 });
  const [first] = year.facts.filter(fact => fact.factType === 'sepharial_saturn_second_house');
  assert.ok(first);
  const { secondCuspLongitude, entryCusp, exitCusp, entryMotion, exitMotion } = first.normalizedPayload;
  assert.deepEqual([entryCusp, exitCusp, entryMotion, exitMotion], [2, 2, 'direct', 'retrograde']);
  assert.equal(first.exactInstant, first.activeFrom);
  const ends = [first.activeFrom, first.activeTo].map(Date.parse);
  for (const at of ends) {
    assert.ok(Math.abs(arc(readTransitLongitude('Saturn', at) - secondCuspLongitude)) < 0.00002);
  }
  assert.ok(arc(readTransitLongitude('Saturn', ends[0] - 60_000) - secondCuspLongitude) < 0);
  assert.ok(arc(readTransitLongitude('Saturn', ends[1] + 60_000) - secondCuspLongitude) < 0);
  assert.equal(resultAt(year, 9).status, 'matched');
  const leo = year.facts.find(fact => fact.factType === 'leo_second_house_transit_context' && fact.normalizedPayload.transitBody === 'Saturn');
  assert.equal(leo.normalizedPayload.financeBasis, 'empty_second_house_ruler');
  assert.deepEqual(leo.normalizedPayload.financialAnchors.map(a => a.body), [leo.normalizedPayload.secondRuler]);
  assert.ok(['none', 'support'].includes(leo.normalizedPayload.natalFinancialState));
  assert.equal(leoTransitMatch(year, 'p001').status, 'matched');
  const reentry = calculate(chart);
  assert.equal(resultAt(reentry, 9).status, 'matched');
  const stay = calculate(chart, 'year', { year: 2027 });
  assert.ok(stay.facts.some(fact => fact.factType === 'sepharial_saturn_second_house'));
  assert.equal(resultAt(stay, 9).status, 'not_matched');
  const { input } = buildFortuneModelContext(year, interpretFortune(year, requestForFortuneRun(year), 'sepharial-saturn'));
  assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === fortuneKnowledge.western.rules[9].knowledgeId)));
  assert.match(formatFortuneFactAudit(input), /土星顺行越过 Sepharial 口径的本命第二宫头/u);
  assert.match(formatFortunePrompt(input), /审慎安排支出是原文给出的可选回应/u);
});

test('Sepharial new-Moon and Jupiter house rules follow the same lunation across civil months', () => {
  const moon = SearchMoonPhase(0, new Date('2026-01-15T00:00:00Z'), 10).date.getTime();
  const exact = Math.round(moon / 1_000) * 1_000;
  const longitude = SunPosition(new Date(exact)).elon;
  // Find a real historic natal Jupiter at this longitude, keeping the rest
  // of the natal positions consistent with that date.
  let low = Date.parse('1996-12-01T00:00:00Z'), high = Date.parse('1997-01-30T00:00:00Z');
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (readTransitLongitude('Jupiter', mid) < longitude) low = mid; else high = mid;
  }
  for (const [armc, house, wholeSign, rule] of [[87, 4, 5, 15], [343, 8, 7, 16]]) {
    const chart = snapshot(armc, 35, high);
    const jan = calculate(chart, 'month', { year: 2026, month: 1 });
    const current = jan.facts.find(fact => fact.factType === 'sepharial_jupiter_lunation' && fact.normalizedPayload.exactConjunction);
    assert.equal(current.normalizedPayload.natalHouse, house);
    assert.equal(current.activeFrom, new Date(exact).toISOString());
    assert.equal(jan.facts.find(fact => fact.factType === 'natal_position' && fact.normalizedPayload.body === 'Jupiter').normalizedPayload.natalHouse, wholeSign);
    assert.equal(resultAt(jan, rule).status, 'matched');
    assert.equal(resultAt(jan, rule === 15 ? 16 : 15).status, 'not_matched');
    const feb = calculate(chart, 'month', { year: 2026, month: 2 });
    const continuation = resultAt(feb, rule);
    assert.equal(continuation.status, 'matched');
    assert.deepEqual(continuation.windows, [{ start: feb.time.displayWindow.instantRange.startInstant,
      endExclusive: current.normalizedPayload.nextNewMoonAt }]);
    const { input } = buildFortuneModelContext(feb, interpretFortune(feb, requestForFortuneRun(feb), 'sepharial-new-moon'));
    assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === fortuneKnowledge.western.rules[rule].knowledgeId)));
    assert.match(formatFortuneFactAudit(input), /新月线索从属于更高层的推运和行运/u);
  }
  const near = calculate(snapshot(87, 35, high + day), 'month', { year: 2026, month: 1 });
  assert.equal(resultAt(near, 15).status, 'not_matched');
  const uncertain = { ...snapshot(87, 35, high), timeKnown: false };
  assert.equal(resultAt(calculate(uncertain, 'month', { year: 2026, month: 1 }), 15).status, 'unknown');
});
