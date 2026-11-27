import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { anglesFromFrame } = await import('./control/western-houses.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { evaluateFortuneRules, getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { progressionEpoch } = await import('./control/western-progressions.ts');
const { readLeoMovingPosition } = await import('./control/leo-source-context.ts');
const { buildLeoLunarConditions, leoLunarConditionPolicy } = await import('./control/leo-lunar-conditions.ts');

const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const marsSaturnBackground = 'This, like all the parallel aspects, will last over a very long period';
const marsSaturnAdverseActivation = 'When, therefore, the lunar directions are evil';

function longitude(planet, instant) {
  const date = new Date(instant);
  return planet === 'Sun' ? SunPosition(date).elon : Ecliptic(GeoVector(Body[planet], date, true)).elon;
}

function annualReport(birthDate, year, birthTime = '00:00:00.000', armc = 0, latitude = 0) {
  const birth = Date.parse(`${birthDate}T${birthTime}Z`);
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birth / 86_400_000 + 2440587.5,
      ...anglesFromFrame(armc, latitude, 23.44),
      positions: planets.map(planet => ({ planet, longitude: longitude(planet, birth) })),
    }],
  } };
  const parameters = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
  const now = Date.UTC(year, 6, 1);
  const reference = { snapshotId: `leo-mutual-directions-${birthDate}-${birthTime}-${armc}-${latitude}-${year}`, chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  const matches = matchFortuneKnowledge(run).byMethod.western;
  const report = interpretFortune(run, requestForFortuneRun(run), reference.snapshotId);
  const { input } = buildFortuneModelContext(run, report);
  return { birth, run, matches, input, prompt: formatFortunePrompt(input) };
}

test('p044 and p066 accept the explicitly adverse natal Moon–Neptune square only at its exact time without contrary evidence', () => {
  const exactField = 'hasCleanAdverseMoonNeptuneActivation';
  for (const [passage, birth, outer, aspect, expected, confirmationIndex] of [
    ['p044', '1933-11-21', 'Jupiter', 'quincunx', '2026-06-29T11:31:47.798Z', 4],
    ['p066', '1930-10-25', 'Saturn', 'parallel', '2026-08-07T18:53:43.835Z', 5],
  ]) {
    const sample = annualReport(birth, 2026, '12:00:00');
    const family = sample.run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === outer && p.aspectType === aspect && p.targetKind === 'natal');
    const witness = family.find(({ activeFrom, normalizedPayload: p }) => p[exactField]
      && Math.abs(Date.parse(activeFrom) - Date.parse(expected)) < 2000);
    assert.ok(witness, passage);
    const at = Date.parse(witness.activeFrom);
    const p = witness.normalizedPayload;
    assert.equal(Date.parse(witness.activeTo) - at, 1000);
    assert.equal(p.hasExactAdverseMoonToNatalEndpoint, false);
    assert.equal(p.hasExactAdverseMoonToProgressedEndpoint, false);
    const epoch = Math.round(progressionEpoch(sample.birth, at));
    const moon = longitude('Moon', epoch), neptune = longitude('Neptune', sample.birth);
    assert.ok(Math.abs(Math.abs((moon - neptune + 540) % 360 - 180) - 90) < 0.00001);
    if (aspect === 'quincunx') {
      const separation = Math.abs((longitude('Mars', epoch) - longitude(outer, sample.birth) + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 150) > 0.8 && Math.abs(separation - 150) < 1);
    } else {
      const mars = readLeoMovingPosition('Mars', epoch), saturn = readLeoMovingPosition(outer, sample.birth);
      assert.ok(Math.abs(Math.abs(mars.declination) - Math.abs(saturn.declination)) < 1);
    }
    const isRule = row => row.knowledgeId.includes(`-${passage}-`);
    const isolated = { ...sample.run, facts: [witness] };
    const result = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    for (const nearby of [at - 1, at + 1000]) {
      const adjacent = family.find(row => Date.parse(row.activeFrom) <= nearby && nearby < Date.parse(row.activeTo));
      assert.ok(adjacent && adjacent.normalizedPayload[exactField] === false);
      const adjacentMatch = matchFortuneKnowledge({ ...sample.run, facts: [adjacent] }).byMethod.western.find(isRule);
      if (passage === 'p066') assert.equal(adjacentMatch.matchedSourceExcerpt, marsSaturnBackground);
      else assert.notEqual(adjacentMatch.status, 'matched');
    }
    const assess = changes => evaluateFortuneRules('western', 'year', [{ ...witness, normalizedPayload: { ...p, ...changes } }])
      .find(isRule).confirmations[confirmationIndex];
    assert.equal(assess({ targetKind: 'progressed' }).hits.length, 0);
    assert.equal(assess({ [exactField]: undefined }).unknown, true);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-third-body-moon'));
    const provider = formatFortunePrompt(input);
    const localGeometry = '次限月亮精确四分本命海王星';
    assert.ok(formatFortuneFactAudit(input).includes(localGeometry));
    assert.ok(!provider.includes(localGeometry));
    assert.match(provider, /次限月亮与本命海王星实际形成四分/u);
    assert.doesNotMatch(provider, /hasCleanAdverseMoonNeptuneActivation|blood disorders|death in the family|go to deliberate extremes/u);
  }

  const base = { start: 0, end: 5000, progressedBody: 'Mars', natalTargetId: 'Jupiter', targetKind: 'natal',
    aspectType: 'quincunx', coordinate: 'ecliptic_longitude', exactTimes: [] };
  const square = { ...base, progressedBody: 'Moon', natalTargetId: 'Neptune', aspectType: 'square', exactTimes: [2000] };
  const accepted = (...rows) => buildLeoLunarConditions([base, ...rows]).filter(row => row.base === base && row[exactField]);
  assert.deepEqual(accepted(square).map(({ start, end }) => [start, end]), [[2000, 3000]]);
  assert.equal(accepted({ ...square, targetKind: 'progressed' }).length, 0);
  assert.equal(accepted(square, { ...square, targetKind: 'progressed', aspectType: 'trine' }).length, 0);
  assert.equal(accepted(square, { ...square, natalTargetId: 'Venus', aspectType: 'sextile' }).length, 0);
});

test('Uranus passages bind a weak same-chart support and a moving lunar endpoint to their actual overlapping intervals', () => {
  const angularDistance = (a, b) => Math.abs((a - b + 540) % 360 - 180);
  const parallelDifference = (a, b) => Math.abs(Math.abs(a.declination) - Math.abs(b.declination));
  const runCase = (birth, time, year, passage, pulse, endpoint, where, condition, confirmationIndex) => {
    const sample = annualReport(birth, year, time);
    const family = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && where(fact.normalizedPayload));
    const target = family.find(fact => fact.activeFrom <= pulse && pulse < fact.activeTo);
    assert.ok(target, passage);
    const p = target.normalizedPayload;
    const isRule = row => row.knowledgeId.includes(`-${passage}-`);
    const assess = (fact, change = {}) => evaluateFortuneRules('western', 'year', [{ ...fact,
      normalizedPayload: { ...fact.normalizedPayload, ...change } }]).find(isRule).confirmations[confirmationIndex];
    const isolated = { ...sample.run, facts: [target] };
    const match = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(match.status, 'matched', passage);
    assert.deepEqual(match.windows, [{ start: target.activeFrom, endExclusive: target.activeTo }], passage);
    assert.equal(assess(target).hits.length, 1, passage);
    assert.equal(assess(target, { [endpoint]: undefined }).unknown, true, passage);
    const otherLayer = p.targetKind === 'natal' ? 'progressed' : 'natal';
    assert.equal(assess(target, { targetKind: otherLayer }).hits.length, 0, passage);
    const previous = family.findLast(fact => fact.activeTo <= target.activeFrom && !fact.normalizedPayload[endpoint]);
    assert.ok(previous, passage);
    assert.equal(assess(previous).hits.length, 0, passage);
    const entered = family.find(fact => fact.activeFrom === previous.activeTo);
    assert.ok(entered && assess(entered).hits.length === 1, passage);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-uranus-shared-endpoints'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, condition);
    assert.ok(!prompt.includes(endpoint));
    assert.ok(!prompt.includes(pulse));
    return { sample, target, p };
  };

  const { sample: solar, target: point, p: solarPayload } = runCase('1870-05-02', '04:00:00', 1910, 'p286',
    '1910-08-20T10:27:31.800Z', 'hasUranianMetaphysicalSolarLunarWitness',
    p => p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel' && p.targetKind === 'progressed',
    /太阳实际与该次限天王星成半六合时，次限月亮对同一颗次限天王星的六合或三分也有效/u, 7);
  assert.equal(Date.parse(point.activeTo) - Date.parse(point.activeFrom), 1_000);
  const progressedAt = progressionEpoch(solar.birth, Date.parse(point.activeFrom));
  const [sun, moon, uranus] = ['Sun', 'Moon', 'Uranus'].map(body => readLeoMovingPosition(body, Math.round(progressedAt)));
  assert.deepEqual(solarPayload.uranianMetaphysicalSolarLunarDirection,
    { body: 'Moon', target: 'Uranus', targetKind: 'progressed', aspectType: 'trine', passage: 'p210' });
  assert.ok(Math.abs(angularDistance(sun.longitude, uranus.longitude) - 30) < 0.00001);
  assert.ok(parallelDifference(sun, uranus) < 1);
  assert.ok(Math.abs(angularDistance(moon.longitude, uranus.longitude) - 120) < 1);

  const { sample: lunar, p: lunarPayload } = runCase('1937-08-02', '12:00:00', 2026, 'p340',
    '2026-09-16T01:09:40.645Z', 'hasVenusLunarParallelActivation',
    p => p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx' && p.targetKind === 'natal',
    /次限月亮和同一次限金星的一度绝对赤纬平行与金天梅花带实际重合/u, 4);
  assert.deepEqual(lunarPayload.venusLunarParallelActivation,
    { body: 'Moon', target: 'Venus', targetKind: 'progressed', aspectType: 'parallel', passage: 'p224' });
  assert.deepEqual(lunarPayload.exactLunarLinkedBodies, []);
  assert.equal(lunarPayload.hasUranianLunarParallelActivation, false);
  assert.equal(lunarPayload.hasUranianMoonSolarActivation, false);
  const epoch = Math.round(progressionEpoch(lunar.birth, Date.parse('2026-09-16T01:09:40.645Z')));
  const [movingMoon, movingVenus] = ['Moon', 'Venus'].map(body => readLeoMovingPosition(body, epoch));
  const fixedUranus = readLeoMovingPosition('Uranus', lunar.birth);
  assert.ok(parallelDifference(movingMoon, movingVenus) > 0.1 && parallelDifference(movingMoon, movingVenus) < 1);
  assert.ok(parallelDifference(movingMoon, fixedUranus) > 1);
  assert.ok(Math.abs(angularDistance(movingVenus.longitude, fixedUranus.longitude) - 150) < 1);

  const base = { start: 0, end: 5_000, targetKind: 'natal', progressedBody: 'Venus', natalTargetId: 'Uranus',
    aspectType: 'quincunx', coordinate: 'ecliptic_longitude', exactTimes: [] };
  const linked = { ...base, start: 2_000, end: 3_000, targetKind: 'progressed', progressedBody: 'Moon', natalTargetId: 'Venus',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1 };
  const accepted = (...directions) => buildLeoLunarConditions([base, ...directions])
    .filter(row => row.base === base && row.hasVenusLunarParallelActivation).map(row => [row.start, row.end]);
  assert.deepEqual(accepted(linked), [[2_000, 3_000]]);
  assert.deepEqual(accepted({ ...linked, targetKind: 'natal' }, { ...linked, natalTargetId: 'Uranus' },
    { ...linked, allowedOrb: 0.25 }, { ...linked, start: 5_000, end: 6_000 }), []);
});

// Chapter XII explains the independent mental tendency of mutual directions;
// concrete outcomes require the chart topics and the corresponding luminary directions.
// https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=153
const groups = [
  { birth: '1934-01-13', neighbor: 2025, rules: [
    ['p335', 'Venus', 'Uranus', 'semisquare', 45],
  ] },
  { birth: '1979-05-26', neighbor: 2025, rules: [
    ['p306', 'Venus', 'Mars', 'sextile', 60],
  ] },
  { birth: '1941-05-24', neighbor: 2025, rules: [
    ['p313', 'Venus', 'Neptune', 'conjunction', 0],
  ] },
  { birth: '1966-12-06', neighbor: 2025, rules: [
    ['p300', 'Venus', 'Jupiter', 'quincunx', 150],
  ] },
  { birth: '1974-12-12', neighbor: 2025, rules: [
    ['p329', 'Venus', 'Saturn', 'sesquiquadrate', 135],
  ] },
  { birth: '1935-05-07', neighbor: 2027, rules: [
    ['p114', 'Mercury', 'Saturn', 'quincunx', 150], ['p129', 'Mercury', 'Venus', 'semisquare', 45],
  ] },
  { birth: '1938-03-04', neighbor: 2025, rules: [
    ['p069', 'Mars', 'Uranus', 'semisquare', 45], ['p081', 'Mercury', 'Jupiter', 'square', 90],
  ] },
  { birth: '1950-09-15', neighbor: 2027, rules: [
    ['p088', 'Mercury', 'Mars', 'semisextile', 30], ['p111', 'Mercury', 'Saturn', 'square', 90],
  ] },
  { birth: '1983-01-28', neighbor: 2025, rules: [
    ['p087', 'Mercury', 'Mars', 'conjunction', 0], ['p121', 'Mercury', 'Uranus', 'square', 90],
    ['p299', 'Venus', 'Jupiter', 'sesquiquadrate', 135, 'all_favourable'],
  ] },
  { birth: '1988-11-06', neighbor: 2027, rules: [
    ['p107', 'Mercury', 'Saturn', 'conjunction', 0], ['p117', 'Mercury', 'Uranus', 'conjunction', 0],
  ] },
  { birth: '1935-05-28', neighbor: 2025, rules: [
    ['p123', 'Mercury', 'Uranus', 'sesquiquadrate', 135],
    ['p130', 'Mercury', 'Venus', 'sextile', 60],
  ] },
  { birth: '1935-04-08', neighbor: 2025, rules: [
    ['p305', 'Venus', 'Mars', 'semisquare', 45], ['p338', 'Venus', 'Uranus', 'trine', 120],
  ] },
  { birth: '1940-12-26', neighbor: 2025, rules: [
    ['p308', 'Venus', 'Mars', 'trine', 120], ['p325', 'Venus', 'Saturn', 'semisquare', 45],
    ['p336', 'Venus', 'Uranus', 'sextile', 60],
  ] },
  { birth: '1942-07-20', neighbor: 2025, rules: [
    ['p297', 'Venus', 'Jupiter', 'square', 90], ['p328', 'Venus', 'Saturn', 'trine', 120],
  ] },
  { birth: '1943-02-18', neighbor: 2027, rules: [
    ['p317', 'Venus', 'Neptune', 'square', 90], ['p334', 'Venus', 'Uranus', 'semisextile', 30],
  ] },
  { birth: '1943-06-26', neighbor: 2025, rules: [
    ['p309', 'Venus', 'Mars', 'sesquiquadrate', 135], ['p337', 'Venus', 'Uranus', 'square', 90],
  ] },
  { birth: '1949-03-23', neighbor: 2025, rules: [
    ['p307', 'Venus', 'Mars', 'square', 90], ['p326', 'Venus', 'Saturn', 'sextile', 60],
  ] },
  { birth: '1936-08-28', neighbor: 2025, rules: [
    ['p310', 'Venus', 'Mars', 'quincunx', 150, 'all_adverse'],
  ] },
  { birth: '1936-10-22', neighbor: 2027, rules: [
    ['p311', 'Venus', 'Mars', 'opposition', 180, 'all_adverse'],
  ] },
  { birth: '1936-09-14', neighbor: 2025, rules: [
    ['p040', 'Mars', 'Jupiter', 'sextile', 60], ['p048', 'Mars', 'Neptune', 'semisextile', 30],
    ['p295', 'Venus', 'Jupiter', 'semisquare', 45],
  ] },
  { birth: '1940-07-03', neighbor: 2025, rules: [
    ['p043', 'Mars', 'Jupiter', 'sesquiquadrate', 135], ['p072', 'Mars', 'Uranus', 'trine', 120],
  ] },
  { birth: '1946-05-05', neighbor: 2025, rules: [
    ['p038', 'Mars', 'Jupiter', 'semisextile', 30], ['p060', 'Mars', 'Saturn', 'sextile', 60],
  ] },
  { birth: '1949-06-23', neighbor: 2025, rules: [
    ['p045', 'Mars', 'Jupiter', 'opposition', 180], ['p068', 'Mars', 'Uranus', 'semisextile', 30],
  ] },
  { birth: '1962-01-07', neighbor: 2025, rules: [
    ['p058', 'Mars', 'Saturn', 'semisextile', 30], ['p075', 'Mars', 'Uranus', 'opposition', 180],
  ] },
  { birth: '1968-06-01', neighbor: 2025, rules: [
    ['p052', 'Mars', 'Neptune', 'trine', 120], ['p070', 'Mars', 'Uranus', 'sextile', 60],
  ] },
  { birth: '1935-03-07', neighbor: 2025, rules: [
    ['p039', 'Mars', 'Jupiter', 'semisquare', 45],
  ] },
  { birth: '1935-07-02', neighbor: 2025, rules: [
    ['p061', 'Mars', 'Saturn', 'square', 90],
  ] },
  { birth: '1935-11-06', neighbor: 2025, rules: [
    ['p055', 'Mars', 'Neptune', 'opposition', 180],
  ] },
  { birth: '1936-08-03', neighbor: 2025, rules: [
    ['p065', 'Mars', 'Saturn', 'opposition', 180],
  ] },
  { birth: '1975-10-06', neighbor: 2027, rules: [
    ['p112', 'Mercury', 'Saturn', 'trine', 120], ['p118', 'Mercury', 'Uranus', 'semisextile', 30],
  ] },
  { birth: '1941-12-10', neighbor: 2025, rules: [
    ['p082', 'Mercury', 'Jupiter', 'trine', 120], ['p090', 'Mercury', 'Mars', 'sextile', 60],
  ] },
  { birth: '1954-01-24', neighbor: 2027, rules: [
    ['p092', 'Mercury', 'Mars', 'trine', 120], ['p122', 'Mercury', 'Uranus', 'trine', 120],
  ] },
  { birth: '1955-02-20', neighbor: 2025, rules: [
    ['p080', 'Mercury', 'Jupiter', 'sextile', 60], ['p115', 'Mercury', 'Saturn', 'opposition', 180],
  ] },
  { birth: '1963-01-11', neighbor: 2027, rules: [
    ['p077', 'Mercury', 'Jupiter', 'conjunction', 0], ['p108', 'Mercury', 'Saturn', 'semisextile', 30],
  ] },
  { birth: '1976-11-19', neighbor: 2027, rules: [
    ['p089', 'Mercury', 'Mars', 'semisquare', 45],
    ['p131', 'Venus', 'Mercury', 'square', 90],
  ] },
  { birth: '1935-01-09', neighbor: 2027, rules: [
    ['p083', 'Mercury', 'Jupiter', 'sesquiquadrate', 135],
  ] },
  { birth: '1935-02-02', neighbor: 2027, rules: [
    ['p085', 'Mercury', 'Jupiter', 'opposition', 180],
  ] },
  { birth: '1953-01-26', neighbor: 2025, rules: [
    ['p127', 'Mercury', 'Venus', 'conjunction', 0],
  ] },
  { birth: '1935-11-27', neighbor: 2025, rules: [
    ['p296', 'Venus', 'Jupiter', 'sextile', 60], ['p324', 'Venus', 'Saturn', 'semisextile', 30],
  ] },
  { birth: '1944-09-02', neighbor: 2027, rules: [
    ['p298', 'Venus', 'Jupiter', 'trine', 120], ['p331', 'Venus', 'Saturn', 'opposition', 180],
  ] },
  { birth: '1975-10-19', neighbor: 2027, rules: [
    ['p327', 'Venus', 'Saturn', 'square', 90], ['p333', 'Venus', 'Uranus', 'conjunction', 0],
  ] },
  { birth: '1935-01-04', neighbor: 2027, rules: [
    ['p301', 'Venus', 'Jupiter', 'opposition', 180],
  ] },
  { birth: '1935-12-22', neighbor: 2027, rules: [
    ['p323', 'Venus', 'Saturn', 'conjunction', 0],
  ] },
  { birth: '1938-08-03', neighbor: 2025, rules: [
    ['p073', 'Mars', 'Uranus', 'sesquiquadrate', 135], ['p125', 'Mercury', 'Uranus', 'opposition', 180],
  ] },
  { birth: '1944-03-31', neighbor: 2025, rules: [
    ['p037', 'Mars', 'Jupiter', 'conjunction', 0], ['p131', 'Mercury', 'Venus', 'square', 90],
  ] },
  { birth: '1962-02-19', neighbor: 2027, rules: [
    ['p091', 'Mercury', 'Mars', 'square', 90], ['p105', 'Mercury', 'Neptune', 'opposition', 180],
  ] },
  { birth: '1935-10-31', neighbor: 2027, rules: [
    ['p303', 'Venus', 'Mars', 'conjunction', 0],
  ] },
  { birth: '1936-12-18', neighbor: 2027, rules: [
    ['p094', 'Mercury', 'Mars', 'quincunx', 150],
  ] },
  { birth: '1937-01-08', neighbor: 2027, rules: [
    ['p095', 'Mercury', 'Mars', 'opposition', 180],
  ] },
  { birth: '1935-07-05', neighbor: 2025, rules: [
    ['p051', 'Mars', 'Neptune', 'square', 90],
  ] },
  { birth: '1935-09-27', neighbor: 2025, rules: [
    ['p054', 'Mars', 'Neptune', 'quincunx', 150],
  ] },
  { birth: '1936-01-05', neighbor: 2025, rules: [
    ['p067', 'Mars', 'Uranus', 'conjunction', 0],
  ] },
  { birth: '1935-11-29', neighbor: 2025, rules: [
    ['p042', 'Mars', 'Jupiter', 'trine', 120],
  ] },
  { birth: '1935-10-21', neighbor: 2025, rules: [
    ['p057', 'Mars', 'Saturn', 'conjunction', 0],
  ] },
  { birth: '1935-01-17', neighbor: 2025, audit: /同段次限太阳照到这对星的本命土星，形成六合相/u, rules: [
    ['p063', 'Mars', 'Saturn', 'sesquiquadrate', 135],
  ] },
  { birth: '1935-02-14', neighbor: 2025, rules: [
    ['p101', 'Mercury', 'Neptune', 'square', 90],
  ] },
  { birth: '1935-05-24', neighbor: 2027, rules: [
    ['p097', 'Mercury', 'Neptune', 'conjunction', 0],
  ] },
];

for (const { birth, neighbor, rules, audit } of groups) {
  test(`annual mutual directions require an exact natal-target aspect (${birth}, 2026 vs ${neighbor})`, () => {
    const positive = annualReport(birth, 2026);
    const nearby = annualReport(birth, neighbor);
    if (audit) assert.match(formatFortuneFactAudit(positive.input), audit);
    for (const [passage, moving, target, aspect, angle, lunarState] of rules) {
      const isRule = row => row.knowledgeId.includes(`-${passage}-`);
      const isAspect = ({ normalizedPayload: p }) => p.progressedBody === moving && p.natalTargetId === target
        && p.aspectType === aspect && p.targetKind === 'natal' && p.coordinate === 'ecliptic_longitude';
      const match = positive.matches.find(isRule);
      assert.equal(match?.status, 'matched', passage);
      assert.deepEqual(match.unresolvedConditions, [], passage);
      const facts = positive.run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
      assert.ok(facts.length, passage);
      if (lunarState) assert.ok(positive.run.facts.some(fact => fact.factType === 'leo_lunar_condition' && isAspect(fact)
        && fact.normalizedPayload.sameLayerLunarState === lunarState && !match.sourceFactIds.includes(fact.factId)), passage);
      for (const fact of facts) {
        assert.equal(fact.factType, 'leo_mutual_exact_observation', passage);
        assert.ok(isAspect(fact) && fact.normalizedPayload.observed, passage);
        assert.equal(fact.activeFrom, fact.exactInstant, passage);
        const at = Date.parse(fact.exactInstant);
        assert.ok(at >= Date.UTC(2026, 0, 1) && at < Date.UTC(2027, 0, 1), passage);
        assert.ok(Date.parse(fact.activeTo) - at <= 1_000, passage);
        const movingLongitude = longitude(moving, progressionEpoch(positive.birth, at));
        const natalLongitude = longitude(target, positive.birth);
        const separation = Math.abs((movingLongitude - natalLongitude + 540) % 360 - 180);
        assert.ok(Math.abs(separation - angle) < 0.00001, passage);
      }
      const [sample] = facts;
      const wrongLayer = { ...sample, normalizedPayload: { ...sample.normalizedPayload, targetKind: 'progressed' } };
      const wrongLayerResult = evaluateFortuneRules('western', 'year', [wrongLayer]).find(isRule).required[0];
      assert.equal(wrongLayerResult.hits.length, 0, passage);
      assert.equal(wrongLayerResult.unknown, false, passage);

      assert.ok(nearby.run.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isAspect(fact)), passage);
      assert.ok(!nearby.run.facts.some(fact => fact.factType === 'leo_mutual_exact_observation' && isAspect(fact)), passage);
      assert.equal(nearby.matches.find(isRule)?.status, 'not_matched', passage);
      const meaning = getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning;
      assert.ok(positive.prompt.includes(meaning), passage);
      assert.ok(!nearby.prompt.includes(meaning), passage);
    }
  });
}

test('p102 requires the exact Mercury–Neptune trine and a completed natal affliction check', () => {
  const isRule = row => row.knowledgeId.includes('-p102-');
  const isTrine = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'trine' && p.targetKind === 'natal';
  const clear = annualReport('1946-11-09', 2026);
  const afflicted = annualReport('1935-01-30', 2026);
  const nearby = annualReport('1946-11-09', 2025);
  const positive = clear.matches.find(isRule);
  const meaning = getFortuneKnowledgeEntry(positive.knowledgeId).interpretation.classical_meaning;
  assert.equal(positive.status, 'matched');
  assert.deepEqual(positive.unresolvedConditions, []);
  for (const [sample, expected, afflictedBodies] of [[clear, 'matched', []], [afflicted, 'excluded', ['Mercury', 'Neptune']]]) {
    const observation = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && isTrine(fact));
    assert.ok(observation?.normalizedPayload.observed && observation.normalizedPayload.natalAfflictionsChecked);
    assert.deepEqual(observation.normalizedPayload.natalAfflictedBodies, afflictedBodies);
    const at = progressionEpoch(sample.birth, Date.parse(observation.exactInstant));
    const separation = Math.abs((longitude('Mercury', at) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 120) < 0.00001);
    const result = sample.matches.find(isRule);
    assert.equal(result.status, expected);
    assert.ok(result.sourceFactIds.includes(observation.factId));
    assert.equal(sample.prompt.includes(meaning), expected === 'matched');
  }
  assert.match(formatFortuneFactAudit(afflicted.input), /本命水星与本命木星为四分相/u);
  assert.ok(nearby.run.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isTrine(fact)));
  assert.equal(nearby.matches.find(isRule)?.status, 'not_matched');
  assert.ok(!nearby.prompt.includes(meaning));

  const [fact] = clear.run.facts.filter(row => positive.sourceFactIds.includes(row.factId));
  const unknownMarker = { ...fact, normalizedPayload: { ...fact.normalizedPayload, natalAfflictionsChecked: undefined, natalAfflictedBodies: undefined } };
  const unknownArray = { ...fact, normalizedPayload: { ...fact.normalizedPayload, natalAfflictedBodies: undefined } };
  for (const unknown of [unknownMarker, unknownArray]) {
    const result = matchFortuneKnowledge({ ...clear.run, facts: [unknown] }).byMethod.western.find(isRule);
    assert.equal(result.status, 'unknown');
  }
});

test('p049 keeps the real annual semisquare with and without natal Mars–Neptune mitigation', () => {
  const isRule = row => row.knowledgeId.includes('-p049-');
  const isGeometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'semisquare' && p.targetKind === 'natal';
  const cases = [['1965-05-06', '12:00:00', []], ['1983-12-29', '12:00:00', [['sextile', 7]]],
    ['2005-05-26', '00:00:00', [['semisextile', 2]]]];
  for (const [birth, birthTime, natalAspects] of cases) {
    const sample = annualReport(birth, 2026, birthTime);
    const result = sample.matches.find(isRule);
    assert.equal(result.status, 'matched', birth);
    assert.deepEqual(result.unresolvedConditions, [], birth);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact)
      && fact.normalizedPayload.observed);
    assert.ok(point && result.sourceFactIds.includes(point.factId), birth);
    assert.equal(point.normalizedPayload.natalPairAspectsChecked, true);
    assert.equal(point.normalizedPayload.natalPairHarmonious, natalAspects.length > 0);
    assert.deepEqual(point.normalizedPayload.natalPairAspectTypes, natalAspects.map(([type]) => type));
    assert.deepEqual(point.normalizedPayload.natalPairAspects.map(({ aspect, orb }) => [aspect, orb]), natalAspects);
    assert.ok(point.normalizedPayload.natalPairAspects.every(({ difference, orb }) => difference <= orb));
    assert.equal(point.activeFrom, point.exactInstant, birth);
    assert.ok(Date.parse(point.activeTo) - Date.parse(point.activeFrom) <= 1_000, birth);
    const epoch = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const separation = Math.abs((longitude('Mars', epoch) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 45) < 0.00001, birth);
    const unknown = { ...point, normalizedPayload: { ...point.normalizedPayload, natalPairHarmonious: undefined } };
    assert.equal(matchFortuneKnowledge({ ...sample.run, facts: [unknown] }).byMethod.western.find(isRule).status, 'unknown');
    const wrongLayer = { ...point, normalizedPayload: { ...point.normalizedPayload, targetKind: 'progressed' } };
    assert.equal(matchFortuneKnowledge({ ...sample.run, facts: [wrongLayer] }).byMethod.western.find(isRule).status, 'not_matched');
    const audit = formatFortuneFactAudit(sample.input);
    if (birth === '1983-12-29') assert.match(audit, /本命火星与本命海王星的直接偏顺相位为六合相/u);
    if (birth === '2005-05-26') {
      assert.match(audit, /本命火星与本命海王星的直接偏顺相位为半六合相/u);
      assert.match(audit, /半六合属较弱的偏顺相位/u);
    }
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.ok(sample.prompt.includes(meaning), birth);
  }
  const nearby = annualReport('1965-05-06', 2025, '12:00:00');
  assert.ok(nearby.run.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isGeometry(fact)));
  assert.ok(!nearby.run.facts.some(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact)));
  assert.equal(nearby.matches.find(isRule).status, 'not_matched');
});

test('p314 distinguishes all natal Venus–Neptune states at the actual annual semisextile', () => {
  const isRule = row => row.knowledgeId.includes('-p314-');
  const isGeometry = ({ normalizedPayload: p }) => p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'semisextile' && p.targetKind === 'natal';
  const auditByState = {
    adverse: '本命金星与海王星有已核的直接不良相位', weak: '本命金星与海王星仅见弱梅花候选',
    clear: '本命金星与海王星未见所核相位的受克分支',
  };
  const qualifyingContact = (aspect, basis, venusDignity, neptunePiscesDignityDisputed = false) => ({
    aspect, basis, ...(venusDignity && { venusDignity }), neptunePiscesDignityDisputed,
  });
  for (const [birth, year, state, native, variableContact] of [
    ['1970-07-11', 2026, 'adverse', ['square']],
    ['1928-04-08', 2026, 'weak', ['quincunx']],
    ['1951-09-01', 2007, 'clear', []],
    ['1936-04-30', 2026, 'qualified', ['parallel'], qualifyingContact('parallel', 'general-unfavourable')],
    ['1954-09-02', 2026, 'qualified', ['conjunction'], qualifyingContact('conjunction', 'qualified-by-venus-dignity', 'domicile')],
    ['2012-11-29', 2078, 'qualified', ['parallel'], qualifyingContact('parallel', 'neptune-pisces-dignity-disputed', undefined, true)],
    ['2013-02-27', 2038, 'qualified', ['conjunction'], qualifyingContact('conjunction', 'qualified-by-venus-dignity', 'exaltation', true)],
    ['2000-01-01', 2026, 'clear', ['sextile', 'parallel']],
    ['2008-03-13', 2026, 'clear', ['conjunction']],
  ]) {
    const sample = annualReport(birth, year);
    const result = sample.matches.find(isRule);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact));
    assert.ok(point, birth);
    if (state === 'weak') assert.ok(Math.abs(Date.parse(point.exactInstant) - Date.parse('2026-10-30T20:17:33.762Z')) < 1_000);
    const epoch = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const distance = Math.abs((longitude('Venus', epoch) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(distance - 30) < 0.00001, birth);
    const p = point.normalizedPayload;
    assert.equal(p.natalPairAspectsChecked, true);
    assert.equal(p.natalVenusNeptuneAfflictionState, state, birth);
    assert.deepEqual(p.natalPairAspectTypes, native, birth);
    assert.deepEqual(p.natalVenusNeptuneVariableContact, variableContact, birth);
    assert.ok(p.natalPairAspects.every(row => row.difference <= row.orb));
    if (state === 'weak') assert.equal(p.natalPairAspects[0].orb, 2);
    const band = sample.run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && isGeometry(fact)
      && fact.parentSignalId === point.parentSignalId);
    assert.equal(band?.normalizedPayload.natalVenusNeptuneAfflictionState, state);
    assert.deepEqual(band.normalizedPayload.natalVenusNeptuneVariableContact, variableContact);
    assert.equal(result.status, 'matched', birth);
    assert.ok(result.sourceFactIds.includes(point.factId) && !result.sourceFactIds.includes(band.factId));
    assert.ok(sample.prompt.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), birth);
    const audit = formatFortuneFactAudit(sample.input);
    const localPhrases = [auditByState[state],
      variableContact?.aspect === 'conjunction' && '本命金星与海王星实际同座合相',
      variableContact?.aspect === 'parallel' && '本命金星与海王星见单独赤纬平行',
      variableContact?.venusDignity === 'domicile' && '金星实在入垣星座',
      variableContact?.venusDignity === 'exaltation' && '金星实在擢升星座',
      variableContact?.neptunePiscesDignityDisputed && '海王星在双鱼的尊贵有原书所载异说',
    ];
    for (const phrase of localPhrases.filter(Boolean)) {
      assert.ok(audit.includes(phrase), `${birth}: ${phrase}`);
      assert.ok(!sample.prompt.includes(phrase), birth);
    }
    assert.doesNotMatch(sample.prompt, /natalVenusNeptuneVariableContact|qualified-by-venus-dignity|neptune-pisces-dignity-disputed/u);
    const required = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).required[0];
    assert.deepEqual(required([band]).hits, []);
    assert.deepEqual(required([{ ...point, normalizedPayload: { ...p, targetKind: 'progressed' } }]).hits, []);
    assert.equal(required([{ ...point, normalizedPayload: { ...p, natalVenusNeptuneAfflictionState: undefined } }]).unknown, true);
  }
});

test('p314 keeps Leo’s third-house literary conjunction separate from natal affliction', () => {
  const isRule = row => row.knowledgeId.includes('-p314-');
  const isGeometry = ({ normalizedPayload: p }) => p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'semisextile' && p.targetKind === 'natal';
  const evidence = '本命金星为上升主星，与海王星同座合相且同居第三宫';
  for (const armc of [91, 89]) {
    const sample = annualReport('1971-01-08', 2001, '00:00:00', armc, 25);
    const result = sample.matches.find(isRule);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact));
    const band = sample.run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && isGeometry(fact)
      && fact.parentSignalId === point?.parentSignalId);
    assert.ok(point && band, String(armc));
    assert.ok(Math.abs(Date.parse(point.exactInstant) - Date.parse('2001-08-23T14:02:38.752Z')) < 1_000);
    const { normalizedPayload: p } = point;
    const venus = longitude('Venus', sample.birth), neptune = longitude('Neptune', sample.birth);
    const progressedVenus = longitude('Venus', progressionEpoch(sample.birth, Date.parse(point.exactInstant)));
    assert.ok(Math.abs(Math.abs((progressedVenus - neptune + 540) % 360 - 180) - 30) < 0.00001);
    assert.deepEqual([band.normalizedPayload.natalBodyHouse, p.natalTargetHouse, p.natalVenusNeptuneAfflictionState],
      [3, 3, 'qualified']);
    assert.equal(p.natalVenusNeptuneVariableContact?.basis, 'general-unfavourable');
    assert.equal(result.status, 'matched');
    assert.ok(result.sourceFactIds.includes(point.factId) && !result.sourceFactIds.includes(band.factId));
    const natalConjunction = p.natalPairAspects.find(row => row.aspect === 'conjunction');
    assert.ok(Math.abs(natalConjunction.difference - Math.abs(venus - neptune)) < 0.000001);
    const qualifies = armc === 91;
    assert.deepEqual(p.natalVenusNeptuneLiteraryConjunction, qualifies ? {
      ...natalConjunction, house: 3, sign: 8, ascendantSign: 6,
    } : undefined);
    assert.equal(formatFortuneFactAudit(sample.input).includes(evidence), qualifies);
    assert.ok(!sample.prompt.includes(evidence));
    assert.match(formatFortuneFactAudit(sample.input), /本命金星与海王星实际同座合相/u);
    assert.match(sample.prompt, /本命两星命中需依星座条件判读的较弱关系/u);
  }
});

test('p099 and p103 distinguish the sole natal Mercury contact from a nearby annual direction', () => {
  for (const [passage, birth, birthTime, year, nearbyYear, aspect, angle, natalAspect] of [
    ['p099', '1946-06-13', '00:00:00', 2024, 2023, 'semisquare', 45, 'square'],
    ['p103', '1988-03-24', '12:00:00', 2026, 2027, 'sesquiquadrate', 135, 'sextile'],
  ]) {
    const isRule = row => row.knowledgeId.includes(`-${passage}-`);
    const isGeometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
      && p.aspectType === aspect && p.targetKind === 'natal';
    const sample = annualReport(birth, year, birthTime);
    const result = sample.matches.find(isRule);
    assert.equal(result.status, 'matched', passage);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact));
    assert.ok(point && result.sourceFactIds.includes(point.factId), passage);
    const p = point.normalizedPayload;
    assert.equal(p.hasNatalMercuryNeptuneTestimony, true);
    assert.equal(p.hasSoleNatalMercuryNeptuneContact, true);
    assert.deepEqual(p.natalMercuryContactBodies, ['Neptune']);
    assert.ok(p.natalMercuryNeptuneTestimonies.some(row => row.aspect === natalAspect));
    const at = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const separation = Math.abs((longitude('Mercury', at) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - angle) < 0.00001, passage);
    const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
    assert.ok(sample.prompt.includes(meaning), passage);
    const withoutNatal = { ...point, normalizedPayload: { ...p, natalMercuryNeptuneTestimonies: [],
      hasNatalMercuryNeptuneTestimony: false, hasSoleNatalMercuryNeptuneContact: false } };
    assert.equal(matchFortuneKnowledge({ ...sample.run, facts: [withoutNatal] }).byMethod.western.find(isRule).status,
      'matched', passage);

    const nearby = annualReport(birth, nearbyYear, birthTime);
    const bands = nearby.run.facts.filter(fact => fact.factType === 'leo_progressed_aspect' && isGeometry(fact));
    assert.ok(bands.length && bands.every(fact => fact.normalizedPayload.hasSoleNatalMercuryNeptuneContact), passage);
    assert.ok(!nearby.run.facts.some(fact => fact.factType === 'leo_mutual_exact_observation' && isGeometry(fact)), passage);
    assert.equal(nearby.matches.find(isRule).status, 'not_matched', passage);
    assert.ok(!nearby.prompt.includes(meaning), passage);
  }
});

test('rising natal Neptune supports two precise artistic directions on one birth chart', () => {
  const cases = [
    ['p100', 'Mercury', 'sextile', 60, '2032-06-16', 'hasMercuryNeptuneSextileExact'],
    ['p314', 'Venus', 'semisextile', 30, '2007-12-17', 'hasVenusNeptuneSemisextileExact'],
  ];
  const birth = '1951-09-01';
  // Leo and Green, The Horoscope in Detail, p. 59, names rising Neptune
  // as a birth-chart witness for musical, poetic and other aesthetic tendencies.
  for (const [passage, body, aspectType, angle, expectedDate, exactFlag] of cases) {
    const isRule = row => row.knowledgeId.includes(`-${passage}-`);
    const geometry = ({ normalizedPayload: p }) => p.progressedBody === body && p.natalTargetId === 'Neptune'
      && p.aspectType === aspectType && p.targetKind === 'natal';
    for (const [armc, house] of [[105, 1], [0, 4]]) {
      const sample = annualReport(birth, Number(expectedDate.slice(0, 4)), '00:00:00', armc);
      const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
      assert.equal(point?.exactInstant.slice(0, 10), expectedDate, passage);
      const witness = sample.run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && geometry(fact)
        && point.parentSignalId === fact.parentSignalId);
      assert.equal(witness?.normalizedPayload[exactFlag], true, passage);
      const p = witness.normalizedPayload;
      assert.equal(p.natalTargetHouse, house, passage);
      if (passage === 'p100') {
        assert.equal(p.hasNatalNeptuneArtContact, false);
        assert.equal(p.hasNatalNeptuneCreativeTestimony, false);
        assert.equal(p.hasNatalMercuryVenusArtisticContact, true);
        const [contact] = p.natalMercuryVenusArtisticContacts;
        const natalMercury = longitude('Mercury', sample.birth), natalVenus = longitude('Venus', sample.birth);
        assert.deepEqual([contact.first, contact.second, contact.aspect], ['Mercury', 'Venus', 'conjunction']);
        assert.equal(Math.floor(natalMercury / 30), Math.floor(natalVenus / 30));
        assert.ok(Math.abs(contact.difference - Math.abs(natalMercury - natalVenus)) < 0.00001);
      } else {
        assert.ok(!p.natalPairAspectTypes.some(aspect =>
          ['semisquare', 'square', 'sesquiquadrate', 'quincunx', 'opposition'].includes(aspect)));
      }
      const actual = longitude(body, Math.round(progressionEpoch(sample.birth, Date.parse(point.exactInstant))));
      const natal = longitude('Neptune', sample.birth);
      assert.ok(Math.abs(Math.abs((actual - natal + 540) % 360 - 180) - angle) < 0.00001, passage);
      const result = sample.matches.find(isRule);
      assert.equal(result.status, 'matched', passage);
      assert.ok(result.sourceFactIds.includes(point.factId), passage);
      if (passage === 'p100') assert.equal(point.normalizedPayload.mercuryNeptuneArtisticBasis, 'qualified');
      const localText = '本命海王星实居第一宫，按 Leo 与 Green 的升起海王星条可参考创艺倾向';
      assert.equal(formatFortuneFactAudit(sample.input).includes(localText), house === 1, passage);
      assert.ok(!sample.prompt.includes(localText), passage);
    }
  }
  const adjacent = annualReport(birth, 2008, '00:00:00', 105);
  assert.ok(adjacent.run.facts.some(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
    && p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune' && p.aspectType === 'semisextile'
    && p.targetKind === 'natal' && p.natalTargetHouse === 1 && p.hasVenusNeptuneSemisextileExact === false));
  assert.equal(adjacent.matches.find(row => row.knowledgeId.includes('-p314-')).status, 'not_matched');
});

test('p062 and p084 distinguish actual mutual points from concurrent strengthening', () => {
  const group = [
    ['p062', '1935-05-16', 'Mars', 'Saturn', 'trine', 120, 'all_adverse', 'adverse'],
    ['p084', '1935-02-20', 'Mercury', 'Jupiter', 'quincunx', 150, 'mixed', 'adverse'],
  ];
  const bothFavourable = ({ sameLayerLunarState, directionSupportState }) =>
    sameLayerLunarState === 'all_favourable' && directionSupportState === 'favourable';
  const onlyVerifiedMajor = p => p.directionSupportState === 'favourable' && p.hasUnreviewedMutualMajorDirection === false;
  const eitherFavourable = p => p.sameLayerLunarState === 'all_favourable' || onlyVerifiedMajor(p)
    || p.progressedState === 'all_favourable' && p.hasExactFavourableMoonToProgressedEndpoint;
  const definitions = group.map(([passage, birth, body, target, aspect, angle, lunarState, directionState]) => ({
    passage, birth, body, target, angle, lunarState, directionState,
    isRule: row => row.knowledgeId.includes(`-${passage}-`),
    isAspect: ({ normalizedPayload: p }) => p.progressedBody === body && p.natalTargetId === target
      && p.targetKind === 'natal' && p.aspectType === aspect,
    strengthened: passage === 'p062' ? p => bothFavourable(p) && onlyVerifiedMajor(p) : eitherFavourable,
  }));
  const check = (sample, { isRule, isAspect, strengthened }, exact) => {
    const matches = sample.matches.find(isRule);
    const facts = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && isAspect(fact));
    const points = sample.run.facts.filter(fact => fact.factType === 'leo_mutual_exact_observation' && isAspect(fact));
    assert.equal(points.length > 0, exact);
    const containsPoint = fact => points.some(point => fact.activeFrom <= point.exactInstant && point.exactInstant < fact.activeTo);
    assert.ok(facts.length && facts.every(fact => fact.normalizedPayload.mutualExactInSlice === containsPoint(fact)));
    assert.ok(facts.every(({ normalizedPayload: p }) => p.mutualSupportReviewProfile === leoLunarConditionPolicy.mutualSupport
      && p.hasUnreviewedMutualMajorDirection === (p.unreviewedMutualMajorDirections.length > 0)
      && p.unreviewedMutualMajorDirections.every(row => row.targetKind === 'natal')));
    const qualifying = facts.filter(fact => containsPoint(fact) || strengthened(fact.normalizedPayload));
    assert.deepEqual(new Set(matches.sourceFactIds), new Set(qualifying.map(row => row.factId)));
    assert.equal(matches.status, qualifying.length ? 'matched' : 'not_matched');
    return { facts, points, matches };
  };
  for (const spec of definitions) {
    const sample = annualReport(spec.birth, 2026);
    const { facts, points, matches } = check(sample, spec, true);
    const [point] = points, measuredAt = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const angle = Math.abs((longitude(spec.body, measuredAt) - longitude(spec.target, sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(angle - spec.angle) < 0.00001, spec.passage);
    const precise = facts.find(fact => fact.normalizedPayload.mutualExactInSlice);
    assert.deepEqual([precise.normalizedPayload.sameLayerLunarState, precise.normalizedPayload.directionSupportState],
      [spec.lunarState, spec.directionState], spec.passage);
    assert.ok(!spec.strengthened(precise.normalizedPayload), spec.passage);
    const instant = Date.parse(point.exactInstant);
    assert.equal(precise.activeFrom, point.exactInstant);
    assert.equal(Date.parse(precise.activeTo), instant + 1_000);
    assert.ok(matches.windows.some(row => row.start === precise.activeFrom && row.endExclusive === precise.activeTo), spec.passage);
    for (const nextAt of [instant - 1, instant + 1_000]) {
      const adjacent = facts.find(row => Date.parse(row.activeFrom) <= nextAt && nextAt < Date.parse(row.activeTo));
      assert.ok(adjacent && adjacent.normalizedPayload.mutualExactInSlice === false, spec.passage);
      assert.ok(!matches.sourceFactIds.includes(adjacent.factId), spec.passage);
    }
    assert.ok(facts.some(fact => !fact.normalizedPayload.mutualExactInSlice
      && !spec.strengthened(fact.normalizedPayload) && !matches.sourceFactIds.includes(fact.factId)), spec.passage);
    assert.ok(sample.prompt.includes(getFortuneKnowledgeEntry(matches.knowledgeId).interpretation.classical_meaning), spec.passage);
    const review = update => evaluateFortuneRules('western', 'year',
      [{ ...precise, normalizedPayload: { ...precise.normalizedPayload, ...update } }]).find(spec.isRule).required[0];
    assert.deepEqual(review({ mutualExactInSlice: false }).hits, []);
    assert.equal(review({ mutualExactInSlice: false }).unknown, false);
    assert.equal(review({ mutualExactInSlice: undefined }).unknown, true);
    assert.deepEqual(review({ targetKind: 'progressed' }).hits, []);
    assert.doesNotMatch(sample.prompt, /hasUnreviewedMutualMajorDirection|mutualExactInSlice/u);
    const exactAudit = spec.passage === 'p062'
      ? /次限火星对本命土星的三分相有效段内.*本段含基础推运的实际成相点，另查同期推运能否加强/u
      : /次限水星对本命木星的梅花相有效段内.*本段含基础推运的实际成相点，另查同期推运能否加强/u;
    assert.match(formatFortuneFactAudit(sample.input), exactAudit);
    assert.doesNotMatch(sample.prompt, exactAudit);
  }

  const [mars] = definitions;
  const near = check(annualReport(mars.birth, 2025), mars, false);
  assert.equal(near.matches.status, 'not_matched');
  const supported = annualReport('1940-12-07', 2026);
  const { facts, matches } = check(supported, mars, true);
  const when = '2026-12-15T00:00:00.000Z';
  const strong = facts.find(fact => fact.activeFrom <= when && when < fact.activeTo);
  assert.ok(strong);
  const p = strong.normalizedPayload;
  assert.equal(p.mutualExactInSlice, false);
  assert.ok(bothFavourable(p));
  assert.ok(p.lunarFavourableTargets.includes('Jupiter'));
  assert.ok(p.supportingDirections.some(row => row.passage === 'p291' && row.body === 'Sun' && row.target === 'Venus'));
  assert.equal(matches.sourceFactIds.includes(strong.factId), !p.hasUnreviewedMutualMajorDirection);
});

test('p084 and p293 keep independently favourable Moon contacts on the same progressed endpoint', () => {
  const band = (progressedBody, natalTargetId, aspectType, targetKind, exactTimes) => ({
    start: 0, end: 7_000, progressedBody, natalTargetId, aspectType, targetKind, exactTimes, coordinate: 'ecliptic_longitude',
  });
  const base = band('Mercury', 'Jupiter', 'quincunx', 'natal', []);
  const slices = buildLeoLunarConditions([base,
    band('Moon', 'Mercury', 'trine', 'progressed', [2_000, 7_000]),
    band('Moon', 'Mercury', 'trine', 'natal', [4_000]),
    band('Moon', 'Jupiter', 'trine', 'progressed', [5_000]),
    band('Moon', 'Jupiter', 'trine', 'natal', [6_000]),
  ]).filter(row => row.base === base);
  assert.deepEqual(slices.map(row => [row.start, row.end, row.hasExactFavourableMoonToProgressedEndpoint]),
    [[0, 2_000, false], [2_000, 3_000, true], [3_000, 7_000, false]]);
  const cases = [
    ['p084', '1937-05-01', '12:00:00', 'Mercury', 'quincunx', 'trine', 120, '2026-11-25T08:00:24.280Z', 'conditional', 'adverse'],
    ['p293', '1970-10-07', '00:00:00', 'Venus', 'conjunction', 'sextile', 60, '2026-02-07T11:40:57.971Z', 'mixed', 'none'],
  ];
  for (const [passage, birthday, birthTime, mover, aspect, lunarAspect, lunarAngle, exactAt, natalState, directionState] of cases) {
    const { birth, run, matches, input, prompt } = annualReport(birthday, 2026, birthTime);
    const isPassage = row => row.knowledgeId.includes(`-${passage}-`);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === mover && p.natalTargetId === 'Jupiter' && p.targetKind === 'natal' && p.aspectType === aspect);
    const point = family.find(fact => fact.activeFrom === exactAt && fact.normalizedPayload.hasExactFavourableMoonToProgressedEndpoint);
    assert.ok(point, passage);
    const p = point.normalizedPayload;
    assert.equal(p.sameLayerLunarState, natalState, passage);
    assert.equal(p.progressedState, 'all_favourable', passage);
    assert.equal(p.directionSupportState, directionState, passage);
    assert.equal(p.hasUnreviewedMutualMajorDirection, true, passage);
    assert.equal(p.mutualExactInSlice, false, passage);
    if (mover === 'Venus') assert.equal(p.hasLunarBridge, false);
    assert.deepEqual(p.exactFavourableMoonToProgressedEndpoint,
      { body: 'Moon', target: mover, targetKind: 'progressed', aspectType: lunarAspect }, passage);
    const instant = Date.parse(exactAt);
    const epoch = Math.round(progressionEpoch(birth, instant));
    const separation = Math.abs((readLeoMovingPosition('Moon', epoch).longitude
      - readLeoMovingPosition(mover, epoch).longitude + 540) % 360 - 180);
    assert.ok(Math.abs(separation - lunarAngle) < 0.00001, passage);

    const result = matches.find(isPassage);
    assert.equal(result.status, 'matched', passage);
    assert.ok(result.sourceFactIds.includes(point.factId), passage);
    for (const adjacentAt of [instant - 1, instant + 1_000]) {
      const adjacent = family.find(fact => Date.parse(fact.activeFrom) <= adjacentAt && adjacentAt < Date.parse(fact.activeTo));
      assert.ok(adjacent && adjacent.normalizedPayload.hasExactFavourableMoonToProgressedEndpoint === false, passage);
      assert.ok(!result.sourceFactIds.includes(adjacent.factId), passage);
    }
    const evidence = changes => evaluateFortuneRules('western', 'year', [{ ...point, normalizedPayload: { ...p, ...changes } }])
      .find(isPassage).required[0];
    assert.deepEqual(evidence({ hasExactFavourableMoonToProgressedEndpoint: false }).hits, [], passage);
    assert.equal(evidence({ hasExactFavourableMoonToProgressedEndpoint: undefined }).unknown, true, passage);
    assert.deepEqual(evidence({ progressedState: 'mixed' }).hits, [], passage);
    assert.deepEqual(evidence({ targetKind: 'progressed' }).hits, [], passage);
    const wording = new RegExp('这一秒核到次限月亮对同图次限' + (mover === 'Venus' ? '金星的六合相' : '水星的三分相') + '精确成相', 'u');
    assert.match(formatFortuneFactAudit(input), wording, passage);
    assert.doesNotMatch(prompt, wording, passage);
    if (passage === 'p293') {
      const natalPoint = family.find(fact => fact.normalizedPayload.hasExactFavourableMoonToNatalEndpoint);
      const natalAt = Date.parse(natalPoint?.activeFrom);
      assert.ok(Math.abs(natalAt - Date.parse('2026-01-25T07:57:46.736Z')) < 1_000);
      const natalWitness = natalPoint.normalizedPayload;
      assert.equal(natalWitness.sameLayerLunarState, 'mixed');
      assert.deepEqual(natalWitness.exactFavourableMoonToNatalEndpoint,
        { body: 'Moon', target: 'Jupiter', targetKind: 'natal', aspectType: 'sextile' });
      const moon = longitude('Moon', progressionEpoch(birth, natalAt));
      assert.ok(Math.abs(Math.abs((moon - longitude('Jupiter', birth) + 540) % 360 - 180) - 60) < 0.00001);
      assert.ok(result.sourceFactIds.includes(natalPoint.factId));
      const natalEvidence = changes => evaluateFortuneRules('western', 'year', [{ ...natalPoint,
        normalizedPayload: { ...natalWitness, ...changes } }]).find(isPassage).required[0];
      assert.equal(natalEvidence({ hasExactFavourableMoonToNatalEndpoint: false }).hits.length, 0);
      assert.equal(natalEvidence({ hasExactFavourableMoonToNatalEndpoint: undefined }).unknown, true);
      assert.equal(natalEvidence({ targetKind: 'progressed' }).hits.length, 0);
      const before = family.find(fact => Date.parse(fact.activeFrom) < natalAt && Date.parse(fact.activeTo) === natalAt);
      assert.equal(before?.normalizedPayload.hasExactFavourableMoonToNatalEndpoint, false);
      assert.ok(!result.sourceFactIds.includes(before.factId));
      assert.doesNotMatch(prompt, /exactFavourableMoonToNatalEndpoint/u);

      const at = date => family.find(fact => fact.activeFrom <= date && date < fact.activeTo);
      const linked = at('2026-03-02T12:00:00.000Z'), indirect = at('2026-03-04T12:00:00.000Z');
      const direction = { body: 'Sun', target: 'Venus', targetKind: 'progressed', aspectType: 'semisextile', nature: 'favourable', passage: 'p288' };
      assert.equal(linked.activeTo, indirect.activeFrom);
      assert.equal(linked.normalizedPayload.venusJupiterEffectState, 'linked-support');
      assert.deepEqual(linked.normalizedPayload.lunarBridge.direction, direction);
      assert.deepEqual(linked.normalizedPayload.lunarBridge.baseContact,
        { body: 'Moon', target: 'Venus', targetKind: 'progressed', aspectType: 'sextile' });
      assert.deepEqual(linked.normalizedPayload.lunarBridge.otherContact, linked.normalizedPayload.lunarBridge.baseContact);
      assert.equal(indirect.normalizedPayload.venusJupiterEffectState, 'indirect-candidate');
      assert.equal(indirect.normalizedPayload.venusJupiterSupportScope, 'both-chart-planetary-pairs');
      assert.deepEqual(indirect.normalizedPayload.supportingDirections, [direction]);
      assert.ok(indirect.normalizedPayload.hasUnreviewedMutualMajorDirection);
      assert.equal(indirect.normalizedPayload.venusJupiterLunarLinkState, 'no-reviewed-link');
      assert.deepEqual(indirect.normalizedPayload.lunarLinkedBodies, []);
      for (const fact of [linked, indirect]) assert.ok(result.sourceFactIds.includes(fact.factId));
      const unavailable = { ...indirect, normalizedPayload: { ...indirect.normalizedPayload, venusJupiterSupportScope: undefined } };
      const missingScope = evaluateFortuneRules('western', 'year', [unavailable]).find(isPassage).required[0];
      assert.deepEqual([missingScope.hits.length, missingScope.unknown], [0, true]);
      const ephemerisAt = Math.round(progressionEpoch(birth, Date.parse(indirect.activeFrom)));
      const difference = Math.abs((longitude('Sun', ephemerisAt) - longitude('Venus', ephemerisAt) + 540) % 360 - 180);
      assert.ok(Math.abs(difference - 30) < 1);
      assert.match(prompt, /次限金星合本命木星的基础倾向较温和/u);
      assert.match(prompt, /仅在有已核月亮连接的片段/u);
      assert.match(prompt, /可参考经由他人间接表现的可能/u);
      assert.doesNotMatch(prompt, /venusJupiterSupportScope|both-chart-planetary-pairs|no-reviewed-link/u);
    }
  }
});

test('p062, p084 and p293 distinguish unreviewed and mixed major directions from independent lunar support', () => {
  const band = (start, end, progressedBody, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind, exactTimes: [] });
  for (const [passage, body, target, aspect] of [
    ['p062', 'Mars', 'Saturn', 'trine'], ['p084', 'Mercury', 'Jupiter', 'quincunx'], ['p293', 'Venus', 'Jupiter', 'conjunction'],
  ]) {
    const base = { ...band(0, 10, body, target, aspect), exactTimes: [1], coordinate: 'ecliptic_longitude' };
    const rows = buildLeoLunarConditions([base,
      band(2, 6, 'Sun', 'Jupiter', 'sextile'), band(3, 5, 'Moon', 'Sun', 'trine'),
      band(4, 8, 'Mercury', 'Uranus', 'quincunx'), band(5, 6, 'Mercury', 'Saturn', 'square'),
      band(0, 10, 'Mars', 'Neptune', 'quincunx', 'progressed'),
    ]).filter(row => row.base === base);
    const byStart = at => rows.find(row => row.start <= at && at < row.end);
    assert.equal(byStart(3).directionSupportState, 'favourable');
    assert.equal(byStart(3).hasUnreviewedMutualMajorDirection, false);
    assert.equal(byStart(4).sameLayerLunarState, 'all_favourable');
    assert.equal(byStart(4).directionSupportState, 'favourable');
    assert.deepEqual(byStart(4).unreviewedMutualMajorDirections,
      [{ body: 'Mercury', target: 'Uranus', targetKind: 'natal', aspectType: 'quincunx' }]);
    assert.equal(byStart(5).directionSupportState, 'mixed');
    assert.equal(byStart(6).hasUnreviewedMutualMajorDirection, true);
    assert.equal(byStart(8).hasUnreviewedMutualMajorDirection, false);
    if (passage === 'p293') {
      assert.equal(byStart(3).venusJupiterLunarLinkState, 'unreviewed');
      assert.equal(byStart(4).venusJupiterLunarLinkState, 'unreviewed');
      assert.equal(byStart(3).venusJupiterEffectState, 'lunar-support');
      assert.equal(byStart(4).venusJupiterEffectState, 'lunar-support');
      assert.equal(byStart(5).venusJupiterEffectState, 'unreviewed');
      assert.equal(byStart(6).venusJupiterEffectState, 'unreviewed');
    }
    const facts = rows.map(row => ({ factType: 'leo_lunar_condition', scope: 'progressed', completeness: 'complete',
      normalizedPayload: { ...base, ...row, kind: 'secondary', progressionPolicy: 'secondary-utc-calendar-month-v1',
        zodiac: 'tropical', profile: 'leo-1906-source-context-v1', lunarProfile: leoLunarConditionPolicy.profile,
        mutualExactInSlice: row.start <= 1 && 1 < row.end } }));
    const match = evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId.includes('-' + passage + '-'));
    assert.ok(match);
    const starts = { p062: [1, 3], p084: [1, 2, 3, 4], p293: [1, 3, 4] };
    assert.deepEqual(match.required[0].hits.map(({ normalizedPayload: p }) => p.start), starts[passage]);
    const majorOnlyWitness = facts.find(({ normalizedPayload: p }) => p.start === (passage === 'p062' ? 3 : 2));
    const missingEvidence = { ...majorOnlyWitness, normalizedPayload: { ...majorOnlyWitness.normalizedPayload,
      ...(passage === 'p293' ? { venusJupiterEffectState: 'indirect-candidate' } : { hasUnreviewedMutualMajorDirection: undefined }) } };
    const missing = evaluateFortuneRules('western', 'year', [missingEvidence]).find(row => row.knowledgeId === match.knowledgeId);
    assert.equal(missing.required[0].unknown, true, passage);
    assert.deepEqual(missing.required[0].hits, [], passage);
  }
});

test('p098 separates Mercury dominance, independent culmination and Moon assistance to the natal endpoint', () => {
  const isPassage = row => row.knowledgeId.includes('-p098-');
  const direction = p => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'semisextile' && p.targetKind === 'natal';
  const slices = run => run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && direction(fact.normalizedPayload));
  const hasPriorWitness = p => p.hasFavourableLunarLink || p.mercuryBehindNeptune || [1, 4, 7, 10].includes(p.natalTargetHouse)
    || p.natalNeptuneClosestToMidheaven || p.natalMercuryDomicileAngular || p.natalNeptuneBeforeAngularCusp || p.hasNatalNeptuneSoleLuminaryContact;
  const staysLocal = (sample, phrase) => {
    assert.ok(formatFortuneFactAudit(sample.input).includes(phrase), phrase);
    assert.ok(!sample.prompt.includes(phrase), phrase);
  };

  const angular = annualReport('1930-05-23', 2026, '00:00:00.000', 25);
  const outsideAngles = annualReport('1930-05-23', 2026, '00:00:00.000', 20);
  const angularSlices = slices(angular.run);
  assert.ok(angularSlices.length > 1);
  assert.ok(angularSlices.some(({ normalizedPayload: p }) => !hasPriorWitness(p)));
  assert.ok(angularSlices.every(({ normalizedPayload: p }) => !p.mutualExactInSlice && !p.hasFavourableNatalNeptuneLunarContact
    && p.natalMercuryDominantAngular && p.natalMercuryAngularDominance.body === 'Mercury'
    && p.natalMercuryAngularDominance.basis === 'only-in-angular-house' && p.natalMercuryAngularDominance.house === 10
    && p.natalMercuryAngularDominance.dignity === 'none'));
  const angularHit = angular.matches.find(isPassage);
  assert.equal(angularHit.status, 'matched');
  assert.deepEqual(new Set(angularHit.sourceFactIds), new Set(angularSlices.map(row => row.factId)));
  assert.ok(angularSlices.every(({ normalizedPayload: p }) => p.mercuryNeptuneNatalSensitivityState === 'mercury'));
  const nonAngularSlices = slices(outsideAngles.run);
  assert.deepEqual(nonAngularSlices.map(({ activeFrom, activeTo }) => [activeFrom, activeTo]),
    angularSlices.map(({ activeFrom, activeTo }) => [activeFrom, activeTo]));
  assert.ok(nonAngularSlices.every(({ normalizedPayload: p }) => p.natalMercuryDominantAngular === false
    && p.natalMercuryAngularDominance === undefined));
  assert.deepEqual(new Set(outsideAngles.matches.find(isPassage).sourceFactIds),
    new Set(nonAngularSlices.filter(({ normalizedPayload: p }) => hasPriorWitness(p)).map(row => row.factId)));
  staysLocal(angular, '本命水星实居第10宫，按同作者的角宫排序列为主导候选');

  const culmination = annualReport('1945-07-12', 2042, '00:00:00.000', 9.5);
  const culminations = culmination.run.facts.filter(fact => fact.factType === 'leo_mutual_exact_observation'
    && direction(fact.normalizedPayload));
  assert.equal(culminations.length, 1);
  const exact = culminations[0];
  const separation = Math.abs((exact.normalizedPayload.progressedLongitude - exact.normalizedPayload.targetLongitude + 540) % 360 - 180);
  assert.ok(Math.abs(separation - 30) < 0.00001);
  const byTime = slices(culmination.run).filter(fact => fact.activeFrom <= exact.exactInstant && exact.exactInstant < fact.activeTo);
  assert.equal(byTime.length, 1);
  assert.deepEqual(slices(culmination.run).filter(({ normalizedPayload: p }) => p.mutualExactInSlice), byTime);
  assert.ok(slices(culmination.run).every(({ normalizedPayload: p }) => !hasPriorWitness(p)
    && !p.hasFavourableNatalNeptuneLunarContact && !p.natalMercuryDominantAngular));
  const culminationHit = culmination.matches.find(isPassage);
  assert.equal(culminationHit.status, 'matched');
  assert.deepEqual(culminationHit.sourceFactIds, byTime.map(fact => fact.factId));
  assert.equal(byTime[0].normalizedPayload.mercuryNeptuneNatalSensitivityState, 'unreviewed');
  staysLocal(culmination, '次限水星对本命海王星的半六合相有效段内；本段含基础推运的实际成相点，另查同期推运能否加强');

  for (const [birth, aspectType] of [['1936-06-12', 'sextile'], ['1936-06-27', 'trine']]) {
    const moonAssistance = annualReport(birth, 2026);
    const moonSlices = slices(moonAssistance.run);
    assert.ok(moonSlices.every(({ normalizedPayload: p }) => !hasPriorWitness(p) && !p.mutualExactInSlice && !p.natalMercuryDominantAngular));
    const contact = { body: 'Moon', target: 'Neptune', targetKind: 'natal', aspectType };
    const assisted = moonSlices.filter(({ normalizedPayload: p }) => p.hasFavourableNatalNeptuneLunarContact);
    assert.ok(assisted.length);
    assert.ok(assisted.every(({ normalizedPayload: p }) => p.contacts.some(row => row.target === 'Neptune'
      && row.targetKind === 'natal' && row.aspectType === aspectType)));
    for (const { normalizedPayload: p } of assisted) assert.deepEqual(p.favourableNatalNeptuneLunarContacts, [contact]);
    const otherLayer = moonSlices.filter(({ normalizedPayload: p }) => !p.hasFavourableNatalNeptuneLunarContact
      && p.contacts.some(row => row.target === 'Neptune' && row.targetKind === 'progressed' && row.aspectType === aspectType));
    assert.ok(otherLayer.length);
    assert.ok(assisted.some(({ normalizedPayload: p }) => p.mercuryNeptuneLunarSupportState === 'all_favourable'));
    assert.ok(otherLayer.every(({ normalizedPayload: p }) => p.mercuryNeptuneLunarSupportState !== 'all_favourable'));
    const result = moonAssistance.matches.find(isPassage);
    assert.equal(result.status, 'matched');
    assert.deepEqual(new Set(result.sourceFactIds), new Set(assisted.map(fact => fact.factId)));
    const chineseAspect = aspectType === 'sextile' ? '六合' : '三分';
    staysLocal(moonAssistance, `同段次限月亮对本命海王星形成${chineseAspect}相，作为原文的月亮助力候选`);
  }
});

test('p106 admits natal Moon–Neptune artistic evidence inside the real one-degree parallel', () => {
  const isPassage = row => row.knowledgeId.includes('-p106-');
  const isBand = ({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect' && p.progressedBody === 'Mercury'
    && p.natalTargetId === 'Neptune' && p.targetKind === 'natal' && p.aspectType === 'parallel';
  const sample = annualReport('1942-01-13', 2026, '00:00:00', 160);
  const result = sample.matches.find(isPassage);
  assert.equal(result.status, 'matched');
  const bands = sample.run.facts.filter(isBand);
  assert.equal(bands.length, 1);
  assert.deepEqual(result.sourceFactIds, bands.map(band => band.factId));
  const [band] = bands;
  const p = band.normalizedPayload;
  assert.equal(p.natalTargetHouse, 10);
  assert.equal(p.hasNatalNeptuneArtContact, false);
  assert.equal(p.hasNatalNeptuneMinorAffliction, false);
  assert.ok(!p.natalSquareOppositionBodies.includes('Neptune'));
  assert.equal(p.hasNatalNeptuneCreativeTestimony, true);
  assert.equal(p.hasMercuryNeptuneSextileExact, undefined);
  assert.deepEqual(p.natalNeptuneCreativeTestimonies.map(row => [row.other, row.aspect, row.nature]), [['Moon', 'sextile', 'favourable']]);
  assert.ok(p.natalNeptuneCreativeTestimonies.every(row => row.difference <= row.orb));
  assert.ok(Math.abs(Math.abs(p.progressedDeclination) - Math.abs(p.natalDeclination)) <= 1);
  assert.ok(!sample.run.facts.some(row => row.factType === 'leo_progressed_aspect_exact' && row.parentSignalId === band.parentSignalId));
  assert.equal(band.activeTo, '2026-08-10T17:09:43.264Z');
  const control = { ...band, normalizedPayload: { ...p,
    mercuryNeptuneParallelBandObserved: false, hasNatalNeptuneCreativeTestimony: false } };
  const evaluate = evidence => evaluateFortuneRules('western', 'year', evidence).find(isPassage).required[0];
  assert.deepEqual(evaluate([control]).hits, []);
  const wording = /本命月亮与本命海王星为六合相[^。]*供同期水海赤纬平行的创作主题参考/u;
  assert.match(formatFortuneFactAudit(sample.input), wording);
  assert.doesNotMatch(sample.prompt, wording);
  assert.match(sample.prompt, /若本人确在从事富有想象力的写作、诗歌或音乐创作/u);
  assert.match(sample.prompt, /Should the native be an imaginative writer, a poet or musician/u);
  assert.doesNotMatch(sample.prompt, /natalNeptuneCreativeTestimonies|Artemus Ward|less refined natures/u);
  const unsupportedBirth = { ...band, normalizedPayload: { ...p, natalTargetHouse: undefined,
    hasNatalNeptuneCreativeTestimony: undefined, hasNatalNeptuneArtContact: undefined, hasNatalMercuryVenusArtisticContact: undefined } };
  const scoped = { ...sample.run, facts: [unsupportedBirth] };
  const scopedHit = matchFortuneKnowledge(scoped).byMethod.western.find(isPassage);
  assert.equal(scopedHit.status, 'matched');
  assert.ok(scopedHit.matchedConditions.some(condition => condition.includes('若本人确在从事')));
  const neighbor = annualReport('1942-01-13', 2027, '00:00:00', 160);
  const resumed = neighbor.run.facts.filter(isBand);
  assert.ok(resumed.length && resumed.every(row => row.activeFrom >= '2027-04-15T10:27:32.014Z'));
  const later = neighbor.matches.find(isPassage);
  assert.equal(later.status, 'matched');
  assert.ok(later.windows.every(row => row.start >= '2027-04-15T10:27:32.014Z'));
});

test('p100 and p106 use natal Mercury–Venus artistry only in their own real Neptune configurations', () => {
  for (const [passage, birth, birthTime, house, aspect] of [
    ['p100', '1945-04-16', '06:00:00', 4, 'sextile'],
    ['p106', '1961-11-23', '12:00:00', 5, 'parallel'],
  ]) {
    const isPassage = row => row.knowledgeId.includes(`-${passage}-`);
    const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
      && p.aspectType === aspect && p.targetKind === 'natal';
    const isBand = fact => fact.factType === 'leo_progressed_aspect' && geometry(fact);
    const sample = annualReport(birth, 2026, birthTime);
    const result = sample.matches.find(isPassage);
    const bands = sample.run.facts.filter(isBand);
    assert.equal(bands.length, 1, passage);
    const [band] = bands;
    const p = band.normalizedPayload;
    assert.equal(p.natalTargetHouse, house, passage);
    assert.equal(p.hasNatalNeptuneArtContact, false, passage);
    assert.equal(p.hasNatalNeptuneCreativeTestimony, false, passage);
    assert.equal(p.hasNatalMercuryVenusArtisticContact, true, passage);
    const [artistry] = p.natalMercuryVenusArtisticContacts;
    assert.equal(p.natalMercuryVenusArtisticContacts.length, 1);
    assert.deepEqual([artistry.first, artistry.second, artistry.aspect, artistry.orb], ['Mercury', 'Venus', 'conjunction', 8]);
    const mercury = longitude('Mercury', sample.birth), venus = longitude('Venus', sample.birth);
    assert.equal(Math.floor(mercury / 30), Math.floor(venus / 30));
    assert.ok(Math.abs(artistry.difference - Math.abs((mercury - venus + 540) % 360 - 180)) < 1e-8);
    assert.equal(result.status, 'matched', passage);
    const point = aspect === 'sextile' ? sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation'
      && geometry(fact) && fact.parentSignalId === band.parentSignalId) : band;
    assert.ok(point, passage);
    assert.deepEqual(result.sourceFactIds, [point.factId], passage);
    const evidence = changes => evaluateFortuneRules('western', 'year', [{ ...band, normalizedPayload: { ...p, ...changes } }])
      .find(isPassage).required[0];
    assert.deepEqual(evidence({ hasNatalMercuryVenusArtisticContact: false,
      mercuryNeptuneParallelBandObserved: false }).hits, [], passage);
    assert.deepEqual(evidence({ targetKind: 'progressed' }).hits, [], passage);
    const wording = /本命水星与本命金星为合相[^。]*可参考同作者的诗乐背景说法/u;
    assert.match(formatFortuneFactAudit(sample.input), wording, passage);
    assert.doesNotMatch(sample.prompt, wording, passage);
    const exact = sample.run.facts.filter(fact => fact.factType === 'leo_progressed_aspect_exact' && geometry(fact));
    if (aspect === 'parallel') {
      assert.equal(p.hasNatalNeptuneMinorAffliction, false);
      assert.ok(!p.natalSquareOppositionBodies.includes('Neptune'));
      assert.equal(p.allowedOrb, 1);
      assert.deepEqual(exact, []);
      assert.equal(band.activeTo, '2026-01-12T22:24:29.421Z');
      const difference = at => Math.abs(Math.abs(readLeoMovingPosition('Mercury', progressionEpoch(sample.birth, at)).declination)
        - Math.abs(readLeoMovingPosition('Neptune', sample.birth).declination));
      assert.ok(difference(Date.parse(band.activeFrom)) < 1);
      assert.ok(difference(Date.parse(band.activeTo) + 86_400_000) > 1);
      const confirmation = changes => evaluateFortuneRules('western', 'year', [
        { ...band, normalizedPayload: { ...p, ...changes } },
      ]).find(isPassage).confirmations.find(row => JSON.parse(row.condition).where.hasNatalMercuryVenusArtisticContact === true);
      assert.deepEqual(confirmation({}).hits, [band]);
      assert.ok(confirmation({}).sourceConditions.every(condition => sample.prompt.includes(condition)));
      assert.equal(confirmation({ mercuryNeptuneParallelBandObserved: false }).hits.length, 0);
      assert.equal(confirmation({ hasNatalMercuryVenusArtisticContact: false }).hits.length, 0);
    } else {
      assert.deepEqual(exact.map(fact => fact.exactInstant), ['2026-05-09T21:58:36.394Z']);
      assert.equal(p.hasMercuryNeptuneSextileExact, true);
      assert.equal(point.normalizedPayload.mercuryNeptuneArtisticBasis, 'qualified');
      const independent = { ...point, normalizedPayload: { ...point.normalizedPayload, mercuryNeptuneArtisticBasis: 'unreviewed' } };
      assert.ok(evaluateFortuneRules('western', 'year', [independent]).find(isPassage).required[0].hits.includes(independent));
      const earlier = annualReport(birth, 2025, birthTime);
      const near = earlier.run.facts.find(isBand);
      assert.ok(near && near.normalizedPayload.hasNatalMercuryVenusArtisticContact);
      assert.equal(near.normalizedPayload.hasMercuryNeptuneSextileExact, false);
      assert.equal(earlier.matches.find(isPassage).status, 'not_matched');
    }
  }
});

test('p106 uses independent natal Jupiter–Neptune art only inside the actual Mercury parallel', () => {
  const passage = row => row.knowledgeId.includes('-p106-');
  const sample = annualReport('1968-11-15', 2026);
  const match = sample.matches.find(passage);
  const band = sample.run.facts.find(({ factType, normalizedPayload: p }) =>
    factType === 'leo_progressed_aspect' && p.mercuryNeptuneParallelBandObserved === true);
  assert.ok(band);
  const p = band.normalizedPayload;
  assert.ok(Math.abs(Date.parse(band.activeFrom) - Date.parse('2026-07-19T13:21:54.844Z')) < 1000);
  assert.equal(p.hasNatalNeptuneCreativeTestimony, false);
  assert.equal(p.hasNatalMercuryVenusArtisticContact, false);
  assert.deepEqual(p.natalNeptuneJupiterArtisticContacts.map(({ other, aspect, nature }) => [other, aspect, nature]),
    [['Jupiter', 'sextile', 'favourable']]);
  const longitudeError = Math.abs(Math.abs((longitude('Jupiter', sample.birth) - longitude('Neptune', sample.birth) + 540) % 360 - 180) - 60);
  assert.ok(Math.abs(longitudeError - p.natalNeptuneJupiterArtisticContacts[0].difference) < 1e-8);
  const declinationDifference = at => Math.abs(Math.abs(readLeoMovingPosition('Mercury', progressionEpoch(sample.birth, at)).declination)
    - Math.abs(readLeoMovingPosition('Neptune', sample.birth).declination));
  assert.ok(declinationDifference(Date.parse(band.activeFrom) - 86_400_000) > 1);
  assert.ok(declinationDifference(Date.parse(band.activeFrom) + 86_400_000) < 1);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: band.activeFrom, endExclusive: band.activeTo }]);
  const confirmation = changes => evaluateFortuneRules('western', 'year', [
    { ...band, normalizedPayload: { ...p, ...changes } },
  ]).find(passage).confirmations.find(row => JSON.parse(row.condition).where.hasNatalNeptuneJupiterArtisticContact === true);
  const verified = confirmation({});
  assert.deepEqual(verified.hits, [band]);
  assert.ok(verified.sourceConditions.every(condition => sample.prompt.includes(condition)));
  const auditEvidence = /本命木星与本命海王星为六合相[^。]*供水海赤纬平行的创作主题参考/u;
  assert.match(formatFortuneFactAudit(sample.input), auditEvidence);
  assert.doesNotMatch(sample.prompt, auditEvidence);
  assert.doesNotMatch(sample.prompt, /natalNeptuneJupiterArtisticContacts|hasNatalNeptuneJupiterArtisticContact|1968-11-15/u);
  assert.equal(confirmation({ mercuryNeptuneParallelBandObserved: false }).hits.length, 0);
  assert.equal(confirmation({ hasNatalNeptuneJupiterArtisticContact: false }).hits.length, 0);
  assert.equal(confirmation({ targetKind: 'progressed' }).hits.length, 0);
});

test('p100 admits the natal ninth-house Neptune branch only with the actual Mercury sextile', () => {
  const isPassage = row => row.knowledgeId.includes('-p100-');
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'sextile' && p.targetKind === 'natal';
  for (const [year, armc, house, exact, expected] of [
    [2026, 190, 9, true, 'matched'], [2026, 160, 10, true, 'matched'], [2027, 190, 9, false, 'not_matched'],
  ]) {
    const sample = annualReport('1941-09-07', year, '00:00:00', armc);
    const result = sample.matches.find(isPassage);
    const band = sample.run.facts.find(row => row.factType === 'leo_progressed_aspect' && geometry(row));
    const point = sample.run.facts.find(row => row.factType === 'leo_mutual_exact_observation' && geometry(row));
    assert.ok(band);
    assert.equal(Boolean(point), exact);
    assert.equal(band.normalizedPayload.natalTargetHouse, house);
    assert.equal(band.normalizedPayload.hasNatalNeptuneArtContact, false);
    assert.equal(band.normalizedPayload.hasNatalNeptuneCreativeTestimony, false);
    assert.equal(band.normalizedPayload.hasMercuryNeptuneSextileExact, exact);
    assert.equal(result.status, expected);
    assert.ok(!result.sourceFactIds.includes(band.factId));
    if (exact) assert.deepEqual(result.sourceFactIds, [point.factId]);
    if (house === 9 && exact) {
      const wording = /次限水星精确六合本命第九宫海王星/u;
      assert.match(formatFortuneFactAudit(sample.input), wording);
      assert.doesNotMatch(sample.prompt, wording);
    }
    if (point) {
      assert.equal(point.normalizedPayload.natalTargetHouse, house);
      assert.equal(point.normalizedPayload.mercuryNeptuneArtisticBasis, 'unreviewed');
      assert.equal(point.exactInstant, '2026-09-16T02:55:55.115Z');
      assert.equal(Date.parse(point.activeTo) - Date.parse(point.activeFrom), 1_000);
      const epoch = Math.round(progressionEpoch(sample.birth, Date.parse(point.exactInstant)));
      const separation = Math.abs((longitude('Mercury', epoch) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
      assert.ok(Math.abs(separation - 60) < 1e-6);
      const assess = changes => evaluateFortuneRules('western', 'year', [{ ...point,
        normalizedPayload: { ...point.normalizedPayload, ...changes } }]).find(isPassage).required[0];
      assert.deepEqual(assess({ targetKind: 'progressed' }).hits, []);
      assert.deepEqual(assess({ observed: false }).hits, []);
      const unverified = assess({ mercuryNeptuneArtisticBasis: undefined });
      assert.deepEqual([unverified.hits.length, unverified.unknown], [0, true]);
    } else {
      const oldBand = evaluateFortuneRules('western', 'year', [band]).find(isPassage).required[0];
      assert.deepEqual(oldBand.hits, []);
    }
  }
});

test('p257 and p266 keep the same real solar background with or without verified prominence', () => {
  for (const [armc, state] of [[75, 'qualified'], [30, 'prominence-unreviewed']]) {
    const sample = annualReport('1949-07-21', 2025, '00:00:00', armc);
    for (const [passage, type, aspect] of [['p257', 'leo_solar_phase', 'conjunction'], ['p266', 'leo_progressed_aspect', 'parallel']]) {
      const isRule = row => row.knowledgeId.includes(`-${passage}-`);
      const result = sample.matches.find(isRule);
      assert.equal(result.status, 'matched', passage);
      assert.deepEqual(result.unresolvedConditions, []);
      const evidence = sample.run.facts.filter(row => result.sourceFactIds.includes(row.factId));
      assert.ok(evidence.length);
      for (const row of evidence) {
        assert.equal(row.factType, type);
        const p = row.normalizedPayload;
        assert.equal(p.solarNeptuneNatalEvidenceState, state, passage);
        assert.equal(p.hasNatalTargetAspect, true);
        assert.equal(p.targetKind, 'natal');
        assert.equal(p.progressedBody, 'Sun');
        assert.equal(p.natalTargetId, 'Neptune');
        assert.equal(p.aspectType, aspect);
        if (aspect === 'conjunction') {
          const epoch = progressionEpoch(sample.birth, Date.parse(p.formationAt));
          const target = p.targetKind === 'natal' ? sample.birth : epoch;
          const arc = (longitude('Sun', epoch) - longitude('Neptune', target) + 540) % 360 - 180;
          assert.ok(Math.abs(arc) < 0.00001, passage);
          assert.equal(p.hasSolarNeptuneExact, false);
        } else {
          const epoch = progressionEpoch(sample.birth, (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2);
          const target = p.targetKind === 'natal' ? sample.birth : epoch;
          const delta = Math.abs(Math.abs(readLeoMovingPosition('Sun', epoch).declination)
            - Math.abs(readLeoMovingPosition('Neptune', target).declination));
          assert.ok(delta <= 1, passage);
        }
      }
      const [fact] = evidence;
      const check = changes => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...changes } }])
        .find(isRule).required[0];
      assert.deepEqual(check({ targetKind: 'progressed' }).hits, []);
      assert.deepEqual(check({ targetKind: 'transit' }).hits, []);
      const unknown = check({ solarNeptuneNatalEvidenceState: undefined });
      assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true]);
      assert.ok(sample.prompt.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), passage);
    }
    const condition = state === 'qualified' ? '本命相位与显著性均有已核依据' : '本次只采用基础背景';
    assert.ok(sample.prompt.includes(condition));
    const local = state === 'qualified' ? '本命海王星的相位及显著性均有已核依据' : '已核海王星的本命相位，显著性仍待核';
    assert.ok(formatFortuneFactAudit(sample.input).includes(local));
    assert.ok(!sample.prompt.includes(local));
    assert.doesNotMatch(sample.prompt, /solarNeptuneNatalEvidenceState|natalTargetAspectContacts/u);
  }
});

test('p106 admits the real weak annual parallel with and without the known natal affliction', () => {
  const asOf = Date.UTC(2026, 6, 1), instant = new Date(asOf).toISOString();
  const concurrent = fact => fact.activeFrom <= instant && instant < fact.activeTo;
  const waterRule = row => row.knowledgeId.includes('-p106-');
  for (const [birth, aspect] of [['1950-06-21', 'semisquare'], ['1965-12-10', 'sesquiquadrate']]) {
    for (const [birthTime, known] of [['00:00:00', true], ['12:00:00', false]]) {
      const sample = annualReport(birth, 2026, birthTime);
      const fact = sample.run.facts.find(row => row.factType === 'leo_progressed_aspect' && concurrent(row)
        && row.normalizedPayload.progressedBody === 'Mercury' && row.normalizedPayload.natalTargetId === 'Neptune'
        && row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.aspectType === 'parallel');
      assert.ok(fact, birth);
      const p = fact.normalizedPayload;
      assert.equal(p.allowedOrb, 1);
      assert.equal(p.mercuryNeptuneParallelBandObserved, true);
      assert.notEqual(p.natalTargetHouse, 3);
      assert.equal(p.hasNatalNeptuneArtContact, false);
      assert.ok(!p.natalSquareOppositionBodies.includes('Neptune'));
      assert.equal(p.hasNatalNeptuneMinorAffliction, known);
      assert.deepEqual(p.natalNeptuneMinorAfflictionContacts.map(row => [row.first, row.second, row.aspect]),
        known ? [['Moon', 'Neptune', aspect]] : []);
      assert.deepEqual(p.natalNeptuneParallelAfflictionContacts, p.natalNeptuneMinorAfflictionContacts);
      assert.equal(p.hasNatalNeptuneParallelOverindulgenceContact, known);
      assert.deepEqual(p.natalNeptuneParallelOverindulgenceContacts, p.natalNeptuneMinorAfflictionContacts);
      assert.ok(p.natalNeptuneParallelUnclassifiedContacts.every(row => ['parallel', 'conjunction']
        .includes(row.aspect)));
      assert.deepEqual(p.natalNeptuneParallelWeakFavourableContacts.map(row => [row.first, row.second, row.aspect]),
        birth === '1950-06-21' ? [['Saturn', 'Neptune', 'semisextile']] : []);
      for (const contact of p.natalNeptuneParallelWeakFavourableContacts) {
        const first = readLeoMovingPosition(contact.first, sample.birth).longitude;
        const second = readLeoMovingPosition(contact.second, sample.birth).longitude;
        const angularError = Math.abs(Math.abs((first - second + 540) % 360 - 180) - 30);
        assert.ok(Math.abs(angularError - contact.difference) < 1e-8 && angularError < contact.orb && contact.orb === 2);
      }
      assert.ok(p.natalNeptuneMinorAfflictionContacts.every(row => row.difference < row.orb && row.orb === 4));
      const epoch = progressionEpoch(sample.birth, asOf);
      const mercury = readLeoMovingPosition('Mercury', epoch).declination;
      const neptune = readLeoMovingPosition('Neptune', sample.birth).declination;
      const separation = Math.abs(Math.abs(mercury) - Math.abs(neptune));
      assert.ok(separation > 0.01 && separation < 1, birth);
      const hit = sample.matches.find(waterRule);
      const otherArtistry = birth === '1965-12-10';
      assert.equal(p.hasNatalMercuryVenusArtisticContact, otherArtistry, birth);
      assert.equal(hit.status, 'matched', birth);
      assert.ok(hit.sourceFactIds.includes(fact.factId), birth);
      assert.ok(hit.windows.some(window => window.start <= instant && instant < window.endExclusive), birth);
      const isolated = data => matchFortuneKnowledge({ ...sample.run, facts: [{ ...fact, normalizedPayload: data }] })
        .byMethod.western.find(waterRule);
      const verified = isolated(p);
      assert.equal(verified.status, 'matched');
      assert.equal(verified.confirmedBranches?.length, known ? 2 : undefined);
      if (known) {
        assert.ok(verified.confirmedBranches.every(branch => branch.sourceFactIds.length === 1 && branch.sourceFactIds[0] === fact.factId));
        assert.ok(verified.confirmedBranches.some(branch => branch.conditions.some(condition => condition.includes('过度投入'))));
      }
      assert.equal(isolated({ ...p, hasNatalNeptuneParallelOverindulgenceContact: undefined }).confirmedBranches, undefined);
      assert.notEqual(isolated({ ...p, targetKind: 'progressed' }).status, 'matched');
      assert.notEqual(isolated({ ...p, allowedOrb: 1.1 }).status, 'matched');
      const minorOnly = { ...fact, normalizedPayload: { ...p, hasNatalMercuryVenusArtisticContact: false,
        mercuryNeptuneParallelBandObserved: false } };
      assert.equal(evaluateFortuneRules('western', 'year', [minorOnly]).find(waterRule).required[0].hits.length, known ? 1 : 0, birth);
      const assess = changes => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...p, ...changes } }])
        .find(waterRule).required[0];
      assert.equal(assess({ targetKind: 'progressed' }).hits.length, 0);
      assert.equal(assess({ coordinate: 'ecliptic_longitude' }).hits.length, 0);
      assert.equal(assess({ allowedOrb: 1.1 }).hits.length, 0);
      if (!known && !otherArtistry) {
        const missing = assess({ mercuryNeptuneParallelBandObserved: undefined });
        assert.deepEqual([missing.hits.length, missing.unknown], [0, true]);
      }
      assert.match(sample.prompt, /只确认原书所述的较弱主观倾向/u);
      assert.match(sample.prompt, /rather an inclining than a determinative influence/u);
      assert.equal(sample.prompt.includes('当事人若实际察觉自己容易过度投入'), known);
      assert.equal(sample.prompt.includes('if the natal aspects to Neptune predispose thereto.'), known);
      assert.doesNotMatch(sample.prompt, /less refined natures|Artemus Ward|natalNeptuneMinorAfflictionContacts|natalNeptuneParallelOverindulgenceContacts|natalNeptuneParallelWeakFavourableContacts/u);
      const minorAudit = '本命海王星参与的半刑或倍半刑供偏难分支参考';
      const audit = formatFortuneFactAudit(sample.input);
      assert.equal(audit.includes(minorAudit), known, birth);
      assert.equal(audit.includes('供原书所述过度投入的条件性提醒参考'), known, birth);
      assert.equal(audit.includes('半六合单列为较弱支持'), birth === '1950-06-21');
      assert.doesNotMatch(sample.prompt, /本命海王星参与的半刑或倍半刑供偏难分支参考|供原书所述过度投入的条件性提醒参考|半六合单列为较弱支持/u);
    }
  }

});

test('p106 gives the stronger geometry priority only for the same real natal Neptune pair', () => {
  const isPassage = row => row.knowledgeId.includes('-p106-');
  const event = '2026-07-01T00:00:00.000Z';
  for (const [birth, favourable, unknown, weak, opposing] of [
    ['1961-09-15', 'Moon', [['Uranus', 'parallel']], [], []],
    ['1961-11-19', 'Mercury', [['Venus', 'conjunction'], ['Venus', 'parallel']], ['Moon'], []],
    ['1971-05-18', 'Jupiter', [], ['Mercury'], ['Sun']],
  ]) {
    const sample = annualReport(birth, 2026);
    const fact = sample.run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
      factType === 'leo_progressed_aspect' && activeFrom <= event && event < activeTo && p.mercuryNeptuneParallelBandObserved);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    const winner = p.natalNeptuneParallelFavourableConjunctions.find(row => row.first === favourable);
    assert.ok(winner && winner.second === 'Neptune' && winner.aspect === 'conjunction', birth);
    const birthBody = readLeoMovingPosition(favourable, sample.birth);
    const neptune = readLeoMovingPosition('Neptune', sample.birth);
    assert.equal(Math.floor(birthBody.longitude / 30), Math.floor(neptune.longitude / 30), birth);
    assert.ok(winner.difference < winner.orb, birth);
    const primary = p.natalNeptuneParallelSupersededContacts.find(row => row.first === favourable);
    assert.equal(primary?.preferredAspect, 'conjunction', birth);
    assert.ok(Math.abs(primary.difference - Math.abs(Math.abs(birthBody.declination) - Math.abs(neptune.declination))) < 1e-8, birth);
    assert.ok(!p.natalNeptuneParallelUnclassifiedContacts.some(row => row.first === favourable), birth);
    for (const [body, type] of unknown) assert.ok(p.natalNeptuneParallelUnclassifiedContacts.some(row =>
      row.first === body && row.second === 'Neptune' && row.aspect === type), birth);
    assert.deepEqual(p.natalNeptuneParallelWeakAdverseContacts.map(row => row.first), weak, birth);
    assert.ok(p.natalNeptuneParallelWeakAdverseContacts.every(row => row.second === 'Neptune'
      && row.aspect === 'quincunx' && row.difference < row.orb && row.orb === 2), birth);
    assert.ok(!p.natalNeptuneParallelAfflictionContacts.some(row => row.aspect === 'quincunx'), birth);
    for (const body of opposing) {
      assert.ok(p.natalNeptuneParallelAfflictionContacts.some(row => row.first === body && row.aspect === 'opposition'), birth);
      assert.ok(p.natalNeptuneParallelSupersededContacts.some(row => row.first === body && row.preferredAspect === 'opposition'), birth);
    }
    assert.deepEqual(p.natalNeptuneParallelOverindulgenceContacts.map(row => [row.first, row.aspect]),
      birth === '1971-05-18' ? [['Moon', 'square']] : []);
    const hit = sample.matches.find(isPassage);
    assert.equal(hit.status, 'matched', birth);
    assert.ok(hit.sourceFactIds.includes(fact.factId), birth);
    const wrongLayer = { ...fact, normalizedPayload: { ...p, targetKind: 'progressed' } };
    assert.deepEqual(evaluateFortuneRules('western', 'year', [wrongLayer]).find(isPassage).required[0].hits, [], birth);
    const audit = formatFortuneFactAudit(sample.input);
    const precedence = '同一本命星对已有较强黄经相位，赤纬平行不重复计入';
    const weaker = '梅花相单列为较弱旁证';
    assert.ok(audit.includes(precedence), birth);
    assert.equal(audit.includes(weaker), weak.length > 0, birth);
    assert.ok(!sample.prompt.includes(precedence) && !sample.prompt.includes(weaker), birth);
    assert.doesNotMatch(sample.prompt, /natalNeptuneParallelFavourableConjunctions|preferredAspect|natalNeptuneParallelWeakAdverseContacts/u);
  }
});

test('p106 confirms the source-limited reminder with a natal Mars square but no natal Moon affliction', () => {
  const sample = annualReport('1953-07-16', 2026);
  const isRule = row => row.knowledgeId.includes('-p106-');
  const at = '2026-07-01T00:00:00.000Z';
  const fact = sample.run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload }) =>
    factType === 'leo_progressed_aspect' && activeFrom <= at && at < activeTo && normalizedPayload.mercuryNeptuneParallelBandObserved);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.deepEqual(p.natalNeptuneParallelOverindulgenceContacts.map(row => [row.first, row.second, row.aspect]),
    [['Mars', 'Neptune', 'square']]);
  const mars = readLeoMovingPosition('Mars', sample.birth).longitude;
  const neptune = readLeoMovingPosition('Neptune', sample.birth);
  assert.ok(Math.abs(Math.abs((mars - neptune.longitude + 540) % 360 - 180) - 90) < 0.13);
  const mercury = readLeoMovingPosition('Mercury', progressionEpoch(sample.birth, Date.parse(at)));
  assert.ok(Math.abs(Math.abs(mercury.declination) - Math.abs(neptune.declination)) < 1);
  const result = sample.matches.find(isRule);
  assert.equal(result.status, 'matched');
  assert.ok(result.confirmedBranches.some(branch => branch.sourceFactIds.includes(fact.factId)
    && branch.conditions.some(condition => condition.includes('过度投入'))));
  assert.match(formatFortuneFactAudit(sample.input), /本命火星与本命海王星为四分相[^。]*供原书所述过度投入的条件性提醒参考/u);
  assert.match(sample.prompt, /当事人若实际察觉自己容易过度投入/u);
  assert.doesNotMatch(sample.prompt, /本命火星与本命海王星为四分相|natalNeptuneParallelOverindulgenceContacts/u);
});

test('p316 recognizes the exact natal Moon–Neptune countercase and keeps adjoining geometry unclassified', () => {
  const sample = annualReport('1943-10-15', 2026);
  const isRule = row => row.knowledgeId.includes('-p316-');
  const family = sample.run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal' && p.aspectType === 'sextile');
  const witness = family.find(row => row.normalizedPayload.exactNeptuneLunarContrary);
  const at = Date.parse(witness?.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2026-04-24T14:25:23.254Z')) < 1_000);
  const { normalizedPayload: p } = witness;
  const contact = { body: 'Moon', target: 'Neptune', targetKind: 'natal', aspectType: 'sesquiquadrate' };
  assert.deepEqual(p.exactNeptuneLunarContrary, contact);
  assert.equal(p.contraryReviewState, 'adverse');
  assert.ok(p.contraryDirections.some(row => row.body === 'Moon' && row.target === 'Neptune' && row.aspectType === 'sesquiquadrate'));
  const epoch = progressionEpoch(sample.birth, at);
  assert.ok(Math.abs(Math.abs((longitude('Moon', epoch) - longitude('Neptune', sample.birth) + 540) % 360 - 180) - 135) < 0.00001);
  assert.equal(Date.parse(witness.activeTo), at + 1_000);
  const match = sample.matches.find(isRule);
  const exact = family.filter(row => row.normalizedPayload.mutualExactInSlice);
  assert.equal(match.status, exact.length ? 'matched' : 'not_matched');
  assert.deepEqual(match.sourceFactIds, exact.map(row => row.factId));
  assert.ok(!witness.normalizedPayload.mutualExactInSlice);
  assert.ok(!match.sourceFactIds.includes(witness.factId));
  for (const time of [at - 1, at + 1_000]) {
    const adjacent = family.find(row => Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
    assert.equal(adjacent?.normalizedPayload.exactNeptuneLunarContrary, undefined);
    assert.ok(adjacent?.normalizedPayload.unreviewedContraryDirections.some(row => row.body === 'Moon' && row.target === 'Neptune'
      && row.aspectType === 'sesquiquadrate'));
  }
  assert.doesNotMatch(sample.prompt, /exactNeptuneLunarContrary/u);
});

test('p316 keeps a real base band when additional natal directions make a former clear reading uncertain', () => {
  const sample = annualReport('1960-06-09', 2026, '12:00:00', 60);
  const isRule = row => row.knowledgeId.includes('-p316-');
  const at = Date.parse('2026-02-15T00:00:00Z'), instant = new Date(at).toISOString();
  const witness = sample.run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
    factType === 'leo_lunar_condition' && p.contraryScope === 'reviewed-directions'
    && activeFrom <= instant && instant < activeTo);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.equal(p.natalOtherPlanetPairScope, 'all-other-directed-pairs');
  assert.equal(p.contraryReviewState, 'unreviewed');
  assert.equal(p.contraryDecisionReady, undefined);
  assert.equal(p.progressedOtherPlanetContraryReviewState, 'adverse');
  assert.ok(p.unreviewedContraryDirections.some(({ body, target, targetKind, aspectType }) =>
    body === 'Jupiter' && target === 'Sun' && targetKind === 'natal' && aspectType === 'parallel'));
  assert.ok(p.unreviewedContraryDirections.some(({ body, target, targetKind, aspectType }) =>
    body === 'Uranus' && target === 'Mars' && targetKind === 'natal' && aspectType === 'trine'));
  const epoch = progressionEpoch(sample.birth, at);
  const declination = (body, time) => Math.abs(readLeoMovingPosition(body, time).declination);
  assert.ok(Math.abs(declination('Jupiter', epoch) - declination('Sun', sample.birth)) <= 1);
  const delta = Math.abs((longitude('Uranus', epoch) - longitude('Mars', sample.birth) + 540) % 360 - 180);
  assert.ok(Math.abs(delta - 120) <= 1);
  const result = sample.matches.find(isRule);
  assert.equal(result.status, 'matched');
  assert.ok(!result.sourceFactIds.includes(witness.factId));
  const exact = sample.run.facts.find(row => result.sourceFactIds.includes(row.factId));
  assert.ok(exact?.normalizedPayload.mutualExactInSlice);
  assert.ok([exact.normalizedPayload.contraryReviewState, exact.normalizedPayload.progressedOtherPlanetContraryReviewState]
    .some(state => state !== 'clear'));
  const check = changes => evaluateFortuneRules('western', 'year', [{ ...witness, normalizedPayload: { ...p, ...changes } }])
    .find(isRule).required[0];
  assert.deepEqual(check({ targetKind: 'progressed' }).hits, []);
  assert.equal(check({ natalOtherPlanetPairScope: undefined, mutualExactInSlice: true }).unknown, true);
  assert.deepEqual(check({ mutualExactInSlice: false }).hits, []);
  const audit = formatFortuneFactAudit(sample.input);
  assert.ok(audit.includes('同段另核九曜间从次限到本命的有向组合，未分类的接触仍须复核'));
  assert.ok(audit.includes('次限木星对本命太阳'));
  assert.ok(!sample.prompt.includes('同段另核九曜间从次限到本命的有向组合'));
  assert.doesNotMatch(sample.prompt, /all-other-directed-pairs|unreviewedContraryDirections/u);
  assert.match(sample.prompt, /次限金星与本命海王星实际形成六合相/u);
  assert.match(sample.prompt, /本次采用原文的基础倾向/u);
});

test('p293 keeps its actual annual conjunction independent of unreviewed support', () => {
  const sample = annualReport('1965-03-05', 2026);
  const venusRule = row => row.knowledgeId.includes('-p293-');
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Venus' && p.natalTargetId === 'Jupiter'
    && p.aspectType === 'conjunction' && p.targetKind === 'natal';
  const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
  assert.equal(point?.exactInstant, '2026-06-20T02:25:20.618Z');
  const epoch = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
  assert.ok(Math.abs((longitude('Venus', epoch) - longitude('Jupiter', sample.birth) + 540) % 360 - 180) < 0.00001);
  const slices = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && geometry(fact));
  const containsPoint = fact => fact.activeFrom <= point.exactInstant && point.exactInstant < fact.activeTo;
  const earlierWitness = p => p.sameLayerLunarState === 'all_favourable'
    || ['mixed', 'conditional'].includes(p.sameLayerLunarState) && p.hasExactFavourableMoonToNatalEndpoint
    || p.venusJupiterEffectState === 'indirect-candidate' || p.hasLunarBridge
    || p.progressedState === 'all_favourable' && p.hasExactFavourableMoonToProgressedEndpoint;
  const exact = slices.find(containsPoint);
  assert.ok(exact && !earlierWitness(exact.normalizedPayload));
  assert.equal(exact.activeFrom, point.exactInstant);
  assert.equal(Date.parse(exact.activeTo), Date.parse(exact.activeFrom) + 1_000);
  assert.ok(slices.some(fact => !containsPoint(fact) && earlierWitness(fact.normalizedPayload)));
  assert.ok(slices.some(fact => !containsPoint(fact) && !earlierWitness(fact.normalizedPayload)));
  assert.ok(slices.every(fact => fact.normalizedPayload.mutualExactInSlice === containsPoint(fact)));
  assert.ok(slices.some(({ normalizedPayload: p }) => p.venusJupiterEffectState === 'lunar-support'));
  assert.ok(slices.some(({ normalizedPayload: p }) => p.venusJupiterEffectState === 'unreviewed'));
  assert.ok(slices.every(({ normalizedPayload: p }) => p.venusJupiterSupportScope === 'both-chart-planetary-pairs'));
  const indirect = slices.find(({ normalizedPayload: p }) => p.venusJupiterEffectState === 'indirect-candidate');
  assert.ok(indirect);
  assert.equal(indirect.normalizedPayload.venusJupiterLunarLinkState, 'no-reviewed-link');
  assert.deepEqual(indirect.normalizedPayload.supportingDirections,
    [{ body: 'Sun', target: 'Saturn', targetKind: 'progressed', aspectType: 'sextile', nature: 'favourable', passage: 'p270' }]);
  assert.equal(exact.normalizedPayload.venusJupiterEffectState, 'unreviewed');
  const result = sample.matches.find(venusRule);
  assert.equal(result.status, 'matched');
  assert.deepEqual(new Set(result.sourceFactIds), new Set(slices.filter(fact => containsPoint(fact)
    || earlierWitness(fact.normalizedPayload)).map(fact => fact.factId)));
  const exactAudit = /次限金星对本命木星的合相有效段内.*本段含基础推运的实际成相点，另查同期推运能否加强/u;
  assert.match(formatFortuneFactAudit(sample.input), exactAudit);
  assert.doesNotMatch(sample.prompt, exactAudit);
  assert.ok(formatFortuneFactAudit(sample.input).includes('金木合相同期影响仍待核，暂留原文的温和倾向'));
  assert.doesNotMatch(sample.prompt, /venusJupiterEffectState|金木合相同期影响仍待核/u);
  const single = { ...sample.run, facts: [exact] };
  const { input } = buildFortuneModelContext(single, interpretFortune(single, requestForFortuneRun(single), 'leo-p293-single'));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /次限金星合本命木星的基础倾向较温和/u);
  assert.doesNotMatch(provider, /仅在有已核月亮连接的片段|可参考经由他人间接表现的可能/u);
});

test('p044 real Mars–Jupiter quincunx distinguishes the exact weak basis from whole-chart prominence', () => {
  const isRule = row => row.knowledgeId.includes('-p044-');
  const lordCondition = /本命木星居首并强于本命火星。原书在此条件下将这个本来较弱的相位作偏顺倾向/u;
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mars' && p.natalTargetId === 'Jupiter'
    && p.aspectType === 'quincunx' && p.targetKind === 'natal';
  for (const [armc, body, house] of [[33, 'Mars', 7], [57, 'Jupiter', 1], [316, undefined, undefined]]) {
    const sample = annualReport('1968-01-01', 2022, '12:00:00', armc);
    const result = sample.matches.find(isRule);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
    assert.equal(point?.exactInstant, '2022-01-25T23:06:49.900Z');
    const witness = sample.run.facts.find(fact => fact.factType === 'leo_lunar_condition' && geometry(fact)
      && fact.activeFrom <= point.exactInstant && point.exactInstant < fact.activeTo);
    const p = witness.normalizedPayload;
    assert.equal(p.natalMarsJupiterDominantBody, body ?? 'unselected', String(armc));
    assert.equal(p.natalMarsJupiterProminence.dominant?.house, house, String(armc));
    assert.equal(p.natalMarsJupiterProminence.dominant?.basis, body && 'only-in-angular-house', String(armc));
    assert.equal(p.natalMarsJupiterProminentBody, body ?? 'Mars');
    assert.equal(p.sameLayerLunarState, 'none');
    assert.equal(p.directionSupportState, 'favourable');
    const confirmed = body === 'Jupiter' || body === 'Mars';
    assert.equal(result.status, 'matched', String(armc));
    assert.ok(result.sourceFactIds.includes(witness.factId));
    assert.equal(p.mutualExactInSlice, true);
    assert.equal(witness.activeFrom, point.exactInstant);
    const at = Date.parse(point.exactInstant);
    assert.equal(Date.parse(witness.activeTo), at + 1_000);
    const separation = Math.abs((longitude('Mars', progressionEpoch(sample.birth, at)) - longitude('Jupiter', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 150) < 0.00001);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...witness,
      normalizedPayload: { ...p, ...changes } }]).find(isRule);
    const confirmations = evaluate({}).confirmations;
    assert.deepEqual(confirmations.map(branch => branch.hits.length), [Number(body === 'Jupiter'), Number(body === 'Mars'), 1, 0]);
    assert.match(sample.prompt, /实际形成一百五十度。只在实际成相的半开秒参考原文所述的弱倾向/u);
    assert.equal(lordCondition.test(sample.prompt), body === 'Jupiter', String(armc));
    assert.equal(/本命火星在整盘居首并强于本命木星/u.test(sample.prompt), body === 'Mars', String(armc));
    assert.doesNotMatch(sample.prompt, /按原书的全盘角宫比较|natalMarsJupiterDominantBody|blood disorders|death in the family/u);
    if (confirmed) {
      assert.deepEqual(result.sourceFactIds, [witness.factId]);
      assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
      assert.ok(result.candidateWindows.length > 0);
      const planet = body === 'Jupiter' ? '木星' : '火星';
      assert.match(formatFortuneFactAudit(sample.input), new RegExp(`按原书的全盘角宫比较，本命${planet}实居第${house}宫并居首位`, 'u'));
      assert.equal(evaluate({ targetKind: 'progressed' }).confirmations[0].hits.length, 0);
      assert.equal(evaluate({ natalMarsJupiterDominantBody: undefined }).confirmations[0].unknown, true);
      for (const time of [at - 1, at + 1_000]) {
        const neighbor = sample.run.facts.find(fact => fact.factType === 'leo_lunar_condition' && geometry(fact)
          && Date.parse(fact.activeFrom) <= time && time < Date.parse(fact.activeTo));
        assert.equal(neighbor?.normalizedPayload.mutualExactInSlice, false);
        assert.ok(result.candidateWindows.some(window => Date.parse(window.start) <= time && time < Date.parse(window.endExclusive)));
      }
    }
    if (!body) {
      assert.deepEqual(result.sourceFactIds, [witness.factId]);
      for (const time of [at - 1, at + 1_000]) {
        const neighbor = sample.run.facts.find(fact => fact.factType === 'leo_lunar_condition' && geometry(fact)
          && Date.parse(fact.activeFrom) <= time && time < Date.parse(fact.activeTo));
        assert.equal(neighbor?.normalizedPayload.mutualExactInSlice, false);
        assert.ok(!result.sourceFactIds.includes(neighbor.factId));
      }
      const wrongLayer = evaluate({ targetKind: 'progressed' }).required[0];
      const missing = evaluate({ mutualExactInSlice: undefined }).required[0];
      assert.deepEqual([wrongLayer.hits.length, wrongLayer.unknown], [0, false]);
      assert.deepEqual([missing.hits.length, missing.unknown], [0, true]);
    }
  }
});

test('p041 real Mars–Jupiter square keeps the exact basis separate from natal repetition and Moon intensification', () => {
  const isRule = row => row.knowledgeId.includes('-p041-');
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mars' && p.natalTargetId === 'Jupiter'
    && p.aspectType === 'square' && p.targetKind === 'natal';
  for (const [birth, expectedAt, lunarState, lunarIntensification] of [
    ['1973-08-25', '2026-10-08T21:53:37.126Z', 'all_adverse', true],
    ['1967-02-09', '2026-07-16T17:33:46.868Z', 'all_favourable', false],
  ]) {
    const sample = annualReport(birth, 2026, '12:00:00');
    const result = sample.matches.find(isRule);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.unresolvedConditions, []);
    assert.ok(sample.prompt.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
    assert.equal(point?.exactInstant, expectedAt);
    const witness = sample.run.facts.find(fact => fact.factType === 'leo_lunar_condition' && geometry(fact)
      && fact.activeFrom <= expectedAt && expectedAt < fact.activeTo);
    const p = witness.normalizedPayload;
    assert.equal(p.natalMarsJupiterSquareRepeated, true);
    assert.ok(p.natalPairAspects.some(row => row.aspect === 'square' && row.orb === 8 && row.difference < row.orb));
    assert.equal(p.sameLayerLunarState, lunarState);
    assert.equal(witness.activeFrom, point.exactInstant);
    const at = Date.parse(point.exactInstant);
    assert.equal(Date.parse(witness.activeTo), at + 1_000);
    assert.equal(p.mutualExactInSlice, true);
    assert.ok(result.sourceFactIds.includes(witness.factId));
    const separation = Math.abs((longitude('Mars', progressionEpoch(sample.birth, at)) - longitude('Jupiter', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 90) < 0.00001);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...witness,
      normalizedPayload: { ...p, ...changes } }]).find(isRule).required[0];
    assert.equal(evaluate({ mutualExactInSlice: false }).hits.length, Number(lunarIntensification));
    assert.equal(evaluate({ targetKind: 'progressed' }).hits.length, 0);
    assert.equal(evaluate({ coordinate: 'equatorial_declination_of_date' }).hits.length, 0);
    const unreviewed = { sameLayerLunarState: undefined, hasExactAdverseMoonToNatalEndpoint: false,
      progressedState: 'none', hasExactAdverseMoonToProgressedEndpoint: false };
    assert.equal(evaluate(unreviewed).hits.length, 1);
    const unknown = evaluate({ ...unreviewed, mutualExactInSlice: false });
    assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true]);
  }
});

test('three Mars directions retain a same-endpoint adverse Moon exact point within mixed lunar evidence', () => {
  const band = (progressedBody, natalTargetId, aspectType, exactTimes, targetKind = 'natal') => ({
    start: 0, end: 7_000, progressedBody, natalTargetId, aspectType, targetKind, exactTimes, coordinate: 'ecliptic_longitude',
  });
  const base = band('Mars', 'Jupiter', 'square', []);
  const slices = buildLeoLunarConditions([base, band('Moon', 'Jupiter', 'square', [2_000, 7_000]),
    band('Moon', 'Jupiter', 'square', [4_000], 'progressed'), band('Moon', 'Saturn', 'square', [5_000]),
    band('Moon', 'Venus', 'sextile', [])]).filter(row => row.base === base);
  assert.deepEqual(slices.map(row => [row.start, row.end, row.sameLayerLunarState, row.hasExactAdverseMoonToNatalEndpoint]),
    [[0, 2_000, 'mixed', false], [2_000, 3_000, 'mixed', true], [3_000, 7_000, 'mixed', false]]);

  for (const [passage, birth, target, aspect, lunarAspect, supportiveBody, supportiveAspect, expectedAt] of [
    ['p041', '1942-07-03', 'Jupiter', 'square', 'square', 'Venus', 'sextile', '2026-06-04T21:04:03.567Z'],
    ['p044', '1956-05-26', 'Jupiter', 'quincunx', 'semisquare', 'Venus', 'conjunction', '2026-07-18T18:27:57.283Z'],
    ['p066', '1935-04-16', 'Saturn', 'parallel', 'semisquare', 'Jupiter', 'sextile', '2026-06-08T07:44:42.312Z'],
  ]) {
    const { birth: birthAt, run, matches, input, prompt } = annualReport(birth, 2026);
    const isPassage = row => row.knowledgeId.includes('-' + passage + '-');
    const result = matches.find(isPassage);
    assert.equal(result.status, 'matched', passage);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
    const exact = family.find(fact => fact.normalizedPayload.sameLayerLunarState === 'mixed'
      && fact.normalizedPayload.hasExactAdverseMoonToNatalEndpoint
      && Math.abs(Date.parse(fact.activeFrom) - Date.parse(expectedAt)) < 1_000);
    assert.ok(exact, passage);
    assert.ok(result.sourceFactIds.includes(exact.factId), passage);
    const p = exact.normalizedPayload;
    assert.deepEqual(p.exactAdverseMoonToNatalEndpoint, { body: 'Moon', target, targetKind: 'natal', aspectType: lunarAspect });
    assert.ok(p.contacts.some(contact => contact.target === supportiveBody && contact.targetKind === 'natal'
      && contact.aspectType === supportiveAspect && contact.nature === 'favourable'));
    const at = Date.parse(exact.activeFrom);
    const moon = readLeoMovingPosition('Moon', progressionEpoch(birthAt, at));
    const natal = readLeoMovingPosition(target, birthAt);
    const separation = Math.abs((moon.longitude - natal.longitude + 540) % 360 - 180);
    assert.ok(Math.abs(separation - (lunarAspect === 'square' ? 90 : 45)) < 0.00001, passage);
    for (const time of [at - 1, at + 1_000]) {
      const adjacent = family.find(fact => Date.parse(fact.activeFrom) <= time && time < Date.parse(fact.activeTo));
      assert.equal(adjacent?.normalizedPayload.sameLayerLunarState, 'mixed', passage);
      assert.equal(adjacent?.normalizedPayload.hasExactAdverseMoonToNatalEndpoint, false, passage);
      if (passage === 'p066') {
        assert.ok(result.windows.some(window => window.start <= adjacent.activeFrom && adjacent.activeTo <= window.endExclusive), passage);
        assert.equal(adjacent.normalizedPayload.hasMarsSaturnAdverseLunarActivation, false, passage);
      }
    }
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...exact, normalizedPayload: { ...p, ...changes } }])
      .find(isPassage);
    assert.equal(evaluate({ sameLayerLunarState: 'all_adverse', hasExactAdverseMoonToNatalEndpoint: false }).required[0].hits.length,
      1, passage);
    assert.equal(evaluate({ targetKind: 'progressed' }).required[0].hits.length, Number(passage === 'p066'), passage);
    if (passage === 'p044') {
      assert.equal(evaluate({}).confirmations[3].hits.length, 1);
      assert.equal(evaluate({ hasExactAdverseMoonToNatalEndpoint: false }).confirmations[3].hits.length, 0);
      assert.equal(evaluate({ hasExactAdverseMoonToNatalEndpoint: undefined }).confirmations[3].unknown, true);
      assert.match(prompt, /可参考原文所述困扰可能增加；其他偏顺或待核证据及个人真实处境仍须分别考虑/u);
    }
    if (passage === 'p066') {
      const mars = readLeoMovingPosition('Mars', progressionEpoch(birthAt, at));
      assert.ok(Math.abs(Math.abs(mars.declination) - Math.abs(natal.declination)) <= 1);
      assert.equal(p.marsSaturnParallelBandObserved, true);
      assert.equal(p.hasMarsSaturnAdverseLunarActivation, true);
      assert.deepEqual(evaluate({}).exclusions, []);
      for (const changes of [
        { marsSaturnParallelBandObserved: false }, { allowedOrb: 0.25 }, { coordinate: 'ecliptic_longitude' },
      ]) assert.equal(evaluate(changes).required[0].hits.length, 0);
      assert.equal(evaluate({ marsSaturnParallelBandObserved: undefined }).required[0].unknown, true);
      assert.equal(evaluate({}).confirmations[3].hits.length, 0);
      assert.deepEqual(evaluate({}).confirmations[4].hits, [exact]);
      const mixedConfirmation = facts => evaluateFortuneRules('western', 'year', facts).find(isPassage).confirmations.find(row => {
        const { where } = JSON.parse(row.condition);
        return where.sameLayerLunarState === 'mixed' && where.hasExactAdverseMoonToNatalEndpoint === true;
      });
      const mixed = mixedConfirmation([exact]);
      assert.deepEqual(mixed.hits, [exact]);
      assert.deepEqual(mixedConfirmation([{ ...exact, normalizedPayload: { ...p, targetKind: 'progressed' } }]).hits, []);
      const adjacent = family.filter(row => row.activeTo === exact.activeFrom || row.activeFrom === exact.activeTo);
      assert.equal(adjacent.length, 2);
      assert.deepEqual(mixedConfirmation(adjacent).hits, []);
      const scopedMixed = { ...run, facts: [exact] };
      const mixedMatch = matchFortuneKnowledge(scopedMixed).byMethod.western.find(isPassage);
      assert.deepEqual(mixedMatch.windows, [{ start: exact.activeFrom, endExclusive: exact.activeTo }]);
      const mixedInput = buildFortuneModelContext(scopedMixed, interpretFortune(
        scopedMixed, requestForFortuneRun(scopedMixed), 'p066-mixed-moon-exact',
      )).input;
      const mixedPrompt = formatFortunePrompt(mixedInput);
      assert.ok(mixed.sourceConditions.every(condition => mixedPrompt.includes(condition)));
      assert.doesNotMatch(mixedPrompt, /hasExactAdverseMoonToNatalEndpoint|2026-06-08T07:44/u);
      assert.ok(result.windows.some(window => window.start <= exact.activeFrom && exact.activeTo <= window.endExclusive));
      const quiet = family.filter(({ normalizedPayload: row }) => row.natalState === 'none' && row.progressedState === 'none');
      const reviewed = family.filter(({ normalizedPayload: row }) => row.contacts.some(contact => contact.nature === 'favourable')
        && row.contacts.every(contact => contact.nature !== 'conditional'));
      assert.ok(quiet.length);
      const parallelBackground = run.facts.filter(({ factType, normalizedPayload: row }) =>
        factType === 'leo_lunar_condition' && row.marsSaturnParallelBandObserved === true);
      assert.deepEqual(new Set(result.sourceFactIds), new Set(parallelBackground.map(row => row.factId)));
      assert.ok(quiet.every(row => row.normalizedPayload.contacts.length === 0
        && row.normalizedPayload.marsSaturnNatalBalanceBasis === 'no-reviewed-mitigation'));
      for (const row of quiet) {
        const middle = (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2;
        const progressingMars = readLeoMovingPosition('Mars', progressionEpoch(birthAt, middle));
        assert.ok(Math.abs(Math.abs(progressingMars.declination) - Math.abs(natal.declination)) < 1);
      }
      const backgroundCheck = (fact, changes = {}) => evaluateFortuneRules('western', 'year', [{ ...fact,
        normalizedPayload: { ...fact.normalizedPayload, ...changes },
      }]).find(isPassage).confirmations[4];
      assert.deepEqual(backgroundCheck(quiet[0]).hits, [quiet[0]]);
      assert.equal(backgroundCheck(quiet[0], { progressedState: 'conditional' }).hits.length, 1);
      assert.equal(backgroundCheck(quiet[0], { natalState: undefined }).hits.length, 1);
      assert.equal(backgroundCheck(quiet[0], { marsSaturnParallelBandObserved: undefined }).unknown, true);
      assert.equal(p.hasMarsSaturnReviewedMixedOrFavourableMoon, false);
      assert.deepEqual(backgroundCheck(exact).hits, [exact]);
      for (const [date, state, contacts] of [
        ['2026-12-20T12:00:00.000Z', 'all_favourable', [['Venus', 'trine']]],
        ['2026-12-31T04:00:00.000Z', 'mixed', [['Venus', 'trine'], ['Uranus', 'square']]],
      ]) {
        const fact = reviewed.find(row => row.activeFrom <= date && date < row.activeTo);
        assert.ok(fact);
        const detail = fact.normalizedPayload;
        assert.deepEqual([detail.natalState, detail.progressedState, detail.hasMarsSaturnReviewedMixedOrFavourableMoon], [state, 'none', true]);
        assert.deepEqual(detail.contacts.map(contact => [contact.target, contact.aspectType]), contacts);
        const at = progressionEpoch(birthAt, Date.parse(date));
        const mars = readLeoMovingPosition('Mars', at), moon = readLeoMovingPosition('Moon', at);
        assert.ok(Math.abs(Math.abs(mars.declination) - Math.abs(natal.declination)) < 1);
        for (const [body, angle] of contacts.map(([body, aspect]) => [body, aspect === 'trine' ? 120 : 90])) {
          assert.ok(Math.abs(Math.abs((moon.longitude - longitude(body, birthAt) + 540) % 360 - 180) - angle) < 1);
        }
        assert.equal(backgroundCheck(fact).hits.length, 1);
        assert.equal(backgroundCheck(fact, { hasMarsSaturnReviewedMixedOrFavourableMoon: undefined }).hits.length, 1);
        const isolated = { ...run, facts: [fact] };
        const match = matchFortuneKnowledge(isolated).byMethod.western.find(isPassage);
        assert.deepEqual([match.status, match.matchedSourceExcerpt], ['matched', marsSaturnBackground]);
        const changed = { ...fact, normalizedPayload: { ...detail, allowedOrb: 1.1 } };
        const rejection = matchFortuneKnowledge({ ...run, facts: [changed] }).byMethod.western.find(isPassage);
        assert.equal(rejection.status, 'not_matched');
        const { input: isolatedInput } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'p066-reviewed-background'));
        assert.match(formatFortuneFactAudit(isolatedInput), /两层所见同期月相均已分类，并查到偏顺月相/u);
        const isolatedPrompt = formatFortunePrompt(isolatedInput);
        assert.match(isolatedPrompt, /较长的行动和约束背景/u);
        assert.doesNotMatch(isolatedPrompt, /When, therefore, the lunar directions are evil|只在该成相秒确认原书的偏难月相引动|并查到偏顺月相|hasMarsSaturnReviewedMixedOrFavourableMoon/u);
      }
      assert.match(prompt, /较长的行动和约束背景/u);
      assert.doesNotMatch(prompt, /只在该成相秒确认原书的偏难月相引动/u);
    }
    const evidence = new RegExp('同层月相有顺有难；这一秒核到次限月亮对本命' + (target === 'Saturn' ? '土星' : '木星')
      + '的' + (lunarAspect === 'square' ? '四分相' : '半刑相') + '精确成相', 'u');
    const localAudit = formatFortuneFactAudit(input);
    assert.ok(evidence.test(localAudit), `${passage} missing local exact Moon evidence`);
    assert.ok(!evidence.test(prompt), `${passage} exposed internal exact Moon evidence`);
    const scoped = /在原书一度范围内，火土赤纬平行的背景仍保留|本段另有符合已核分支的偏难月相引动/u;
    if (passage === 'p066') assert.match(localAudit, scoped);
    assert.doesNotMatch(prompt, scoped);
    assert.doesNotMatch(prompt, /marsSaturnParallelBandObserved|marsSaturnNatalBalanceBasis|hasMarsSaturnAdverseLunarActivation/u);
  }
});

test('p066 confirms natal Mars–Saturn harmony during an actual progressed parallel', () => {
  const { birth, run, matches, prompt } = annualReport('1946-11-19', 2026);
  const result = matches.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p066-'));
  assert.equal(result.status, 'matched');
  const witness = run.facts.find(row => result.sourceFactIds.includes(row.factId) && row.factType === 'leo_lunar_condition'
    && row.normalizedPayload.natalPairAspectTypes.includes('trine'));
  assert.ok(witness);
  const natalDistance = Math.abs((longitude('Mars', birth) - longitude('Saturn', birth) + 540) % 360 - 180);
  assert.ok(Math.abs(natalDistance - 120) < 0.04);
  const sample = Date.parse(witness.activeFrom) + Math.floor((Date.parse(witness.activeTo) - Date.parse(witness.activeFrom)) / 2);
  const progressed = readLeoMovingPosition('Mars', progressionEpoch(birth, sample)).declination;
  const natal = readLeoMovingPosition('Saturn', birth).declination;
  assert.ok(Math.abs(Math.abs(progressed) - Math.abs(natal)) <= 1);
  for (const [changes, status] of [[{ natalPairAspectTypes: ['square'] }, 'matched'],
    [{ natalPairAspectTypes: ['quincunx'] }, 'matched'], [{ targetKind: 'progressed' }, 'not_matched']]) {
    const facts = [{ ...witness, normalizedPayload: { ...witness.normalizedPayload, ...changes } }];
    const isolated = matchFortuneKnowledge({ ...run, facts }).byMethod.western.find(row => row.knowledgeId === result.knowledgeId);
    assert.equal(isolated.status, status);
    if (status === 'matched') assert.doesNotMatch(isolated.matchedSourceExcerpt, /favourable aspect in the nativity/u);
  }
  assert.match(prompt, /按原文将本命和谐相作为缓和依据/u);
  assert.doesNotMatch(prompt, /natalPairAspectTypes|1946-11-19/u);
});

test('p044 confirms clean source-classified Moon points on both chart layers without an endpoint', () => {
  const { birth, run } = annualReport('1963-08-08', 2026, '12:00:00', 20);
  const isRule = row => row.knowledgeId.includes('-p044-');
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Mars' && p.natalTargetId === 'Jupiter' && p.targetKind === 'natal' && p.aspectType === 'quincunx');
  const assess = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).confirmations.find(query =>
    JSON.parse(query.condition).where.hasExactCleanMarsJupiterOtherAdverseMoon === true);
  const at = time => family.find(row => Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
  for (const [date, target, targetKind, aspectType, angle] of [
    ['2026-06-12T15:25:07.874Z', 'Mercury', 'natal', 'semisquare', 45],
    ['2026-06-16T13:40:46.326Z', 'Uranus', 'progressed', 'semisquare', 45],
    ['2026-10-21T21:06:01.560Z', 'Venus', 'progressed', 'square', 90],
  ]) {
    const time = Date.parse(date), point = at(time), p = point.normalizedPayload;
    assert.equal(point.activeFrom, date);
    assert.equal(Date.parse(point.activeTo), time + 1_000);
    assert.ok(p.hasExactCleanMarsJupiterOtherAdverseMoon);
    assert.deepEqual(p.exactCleanMarsJupiterOtherAdverseMoon, { body: 'Moon', target, targetKind, aspectType });
    assert.deepEqual([p.hasExactAdverseMoonToNatalEndpoint, p.hasExactAdverseMoonToProgressedEndpoint], [false, false]);
    assert.ok([p.natalState, p.progressedState].every(state => state === 'none' || state === 'all_adverse'));
    const epoch = progressionEpoch(birth, time);
    const delta = Math.abs((longitude('Moon', epoch) - longitude(target, targetKind === 'natal' ? birth : epoch) + 540) % 360 - 180);
    assert.ok(Math.abs(delta - angle) < 0.00001);
    assert.deepEqual(assess([point]).hits, [point]);
    assert.deepEqual(assess([at(time - 1), at(time + 1_000)]).hits, []);
  }
  const blocked = at(Date.parse('2026-03-05T13:08:52.068Z'));
  const blockedPayload = blocked.normalizedPayload;
  assert.equal(blockedPayload.hasExactCleanMarsJupiterOtherAdverseMoon, false);
  assert.ok(blockedPayload.contacts.some(row => row.target === 'Uranus' && row.targetKind === 'natal'
    && row.aspectType === 'semisquare' && row.nature === 'adverse'));
  assert.deepEqual(blockedPayload.contacts.filter(row => row.nature === 'conditional')
    .map(row => [row.target, row.targetKind, row.aspectType]),
    [['Saturn', 'natal', 'quincunx'], ['Mars', 'progressed', 'trine']]);
  assert.deepEqual(assess([blocked]).hits, []);
  const point = at(Date.parse('2026-06-16T13:40:46.326Z'));
  const isolated = { ...run, facts: [point] };
  const match = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
  assert.deepEqual(match.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p044-clean-moon'));
  const dynamic = /次限月亮对同图次限天王星的半刑相实际成相/u;
  assert.match(formatFortuneFactAudit(input), dynamic);
  const provider = formatFortunePrompt(input);
  assert.match(provider, /unless the lunar aspects are evil/u);
  assert.doesNotMatch(provider, dynamic);
  assert.doesNotMatch(provider, /hasExactCleanMarsJupiterOtherAdverseMoon|blood disorders|death in the family/u);
});

test('p044 confirms only reviewed adverse lunar parallel bands through both physical chart layers', () => {
  const isRule = row => row.knowledgeId.includes('-p044-');
  for (const example of [
    { birthDate: '1974-08-15', start: '2026-01-03T11:13:53.752Z', end: '2026-01-24T11:29:33.743Z',
      contacts: [['Saturn', 'natal'], ['Saturn', 'progressed']], states: ['all_adverse', 'all_adverse'] },
    { birthDate: '1949-08-01', start: '2026-12-27T07:35:45.740Z', end: '2027-01-01T00:00:00.000Z',
      entry: '2026-12-24T11:48:15.667Z', contacts: [['Mars', 'progressed']], states: ['none', 'all_adverse'] },
  ]) {
    const { run, birth } = annualReport(example.birthDate, 2026, '12:00:00');
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Jupiter' && p.targetKind === 'natal' && p.aspectType === 'quincunx');
    const findAt = at => family.find(row => Date.parse(row.activeFrom) <= at && at < Date.parse(row.activeTo));
    const start = Date.parse(example.start), end = Date.parse(example.end);
    const point = findAt(start), p = point.normalizedPayload;
    assert.deepEqual([point.activeFrom, point.activeTo], [example.start, example.end]);
    assert.deepEqual([p.natalState, p.progressedState], example.states);
    assert.equal(p.hasMarsJupiterAdverseLunarParallelActivation, true);
    assert.equal(p.hasExactCleanMarsJupiterOtherAdverseMoon, false);
    assert.equal(p.mutualExactInSlice, false);
    const witnesses = p.marsJupiterAdverseLunarParallelContacts;
    assert.deepEqual(witnesses.map(({ target, targetKind }) => [target, targetKind]), example.contacts);
    const epoch = Math.round(progressionEpoch(birth, (start + end) / 2));
    const moon = readLeoMovingPosition('Moon', epoch).declination;
    for (const { body, target, targetKind, aspectType } of witnesses) {
      assert.deepEqual([body, aspectType], ['Moon', 'parallel']);
      const counterpart = readLeoMovingPosition(target, targetKind === 'natal' ? birth : epoch).declination;
      assert.ok(Math.abs(Math.abs(moon) - Math.abs(counterpart)) < 1);
    }

    const assess = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).confirmations.find(query =>
      JSON.parse(query.condition).where.hasMarsJupiterAdverseLunarParallelActivation === true);
    assert.deepEqual(assess([point]).hits, [point]);
    if (example.entry) {
      const entry = Date.parse(example.entry);
      assert.deepEqual(findAt(entry - 1).normalizedPayload.marsJupiterAdverseLunarParallelContacts, []);
      const entered = findAt(entry);
      assert.equal(entered.normalizedPayload.marsJupiterAdverseLunarParallelContacts.length, 1);
      assert.deepEqual(assess([entered]).hits, []);
      const separation = at => {
        const epoch = Math.round(progressionEpoch(birth, at));
        const latitude = body => Math.abs(readLeoMovingPosition(body, epoch).declination);
        return Math.abs(latitude('Moon') - latitude('Mars'));
      };
      assert.ok(separation(entry - 3_600_000) > 1 && separation(entry + 3_600_000) < 1);
    }
    for (const at of [start - 1, end].filter(at => at < Date.UTC(2027, 0, 1))) {
      const neighbour = findAt(at);
      assert.ok(neighbour, example.birthDate);
      assert.equal(neighbour.normalizedPayload.hasMarsJupiterAdverseLunarParallelActivation, false);
      assert.ok(neighbour.normalizedPayload.marsJupiterAdverseLunarParallelContacts.length > 0);
      assert.ok([neighbour.normalizedPayload.natalState, neighbour.normalizedPayload.progressedState]
        .some(state => state === 'mixed' || state === 'conditional'));
      assert.deepEqual(assess([neighbour]).hits, []);
    }
    for (const changes of [{ targetKind: 'progressed' }, { progressedState: 'conditional' },
      { hasMarsJupiterAdverseLunarParallelActivation: undefined }]) {
      assert.deepEqual(assess([{ ...point, normalizedPayload: { ...p, ...changes } }]).hits, []);
    }
    const isolated = { ...run, facts: [point] };
    const match = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: example.start, endExclusive: example.end }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p044-lunar-parallel'));
    const detail = /在火木梅花有效段内持续处于一度绝对赤纬平行带/u;
    assert.match(formatFortuneFactAudit(input), detail);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /unless the lunar aspects are evil/u);
    assert.doesNotMatch(provider, detail);
    assert.doesNotMatch(provider, /marsJupiterAdverseLunarParallelContacts|hasMarsJupiterAdverseLunarParallelActivation|blood disorders|death in the family/u);
  }
});

test('p044 and p066 retain a verified natal Moon endpoint alongside an unclassified contact', () => {
  for (const [passage, birthday, armc, target, aspect, exactAt, lunarAspect, angle, unreviewed] of [
    ['p044', '1963-08-08', 20, 'Jupiter', 'quincunx', '2026-03-08T15:53:18.010Z', 'square', 90, ['Saturn', 'quincunx']],
    ['p066', '1931-01-07', 0, 'Saturn', 'parallel', '2026-09-18T17:56:26.096Z', 'semisquare', 45, ['Jupiter', 'sesquiquadrate']],
  ]) {
    const { birth, run, matches, input, prompt } = annualReport(birthday, 2026, '12:00:00', armc);
    const isRule = row => row.knowledgeId.includes(`-${passage}-`);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
    const witness = family.find(row => row.normalizedPayload.hasExactAdverseMoonToNatalEndpoint
      && Math.abs(Date.parse(row.activeFrom) - Date.parse(exactAt)) < 1_000);
    assert.ok(witness, passage);
    const p = witness.normalizedPayload;
    assert.equal(p.sameLayerLunarState, 'conditional', passage);
    const [unreviewedTarget, unreviewedAspect] = unreviewed;
    assert.ok(p.contacts.some(contact => contact.target === unreviewedTarget && contact.targetKind === 'natal'
      && contact.aspectType === unreviewedAspect && contact.nature === 'conditional'), passage);
    assert.deepEqual(p.exactAdverseMoonToNatalEndpoint,
      { body: 'Moon', target, targetKind: 'natal', aspectType: lunarAspect }, passage);
    const instant = Date.parse(witness.activeFrom);
    const epoch = progressionEpoch(birth, instant);
    const separation = Math.abs((longitude('Moon', epoch) - longitude(target, birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - angle) < 0.00001, passage);
    const fromFacts = facts => matchFortuneKnowledge({ ...run, facts }).byMethod.western.find(isRule);
    const result = passage === 'p066' ? fromFacts([witness]) : matches.find(isRule);
    assert.equal(result.status, 'matched', passage);
    assert.ok(result.sourceFactIds.includes(witness.factId), passage);
    for (const at of [instant - 1, Date.parse(witness.activeTo)]) {
      const adjacent = family.find(row => Date.parse(row.activeFrom) <= at && at < Date.parse(row.activeTo));
      assert.ok(adjacent && !adjacent.normalizedPayload.hasExactAdverseMoonToNatalEndpoint, passage);
      if (passage === 'p066') {
        assert.equal(fromFacts([adjacent]).matchedSourceExcerpt, marsSaturnBackground);
        assert.equal(adjacent.normalizedPayload.hasMarsSaturnAdverseLunarActivation, false);
      } else assert.ok(!result.sourceFactIds.includes(adjacent.factId));
    }
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...witness,
      normalizedPayload: { ...p, ...changes } }]).find(isRule);
    assert.equal(evaluate({ hasExactAdverseMoonToNatalEndpoint: false }).required[0].hits.length, Number(passage === 'p066'), passage);
    assert.equal(evaluate({ targetKind: 'progressed' }).required[0].hits.length, 0, passage);
    const missing = evaluate(passage === 'p066' ? { marsSaturnParallelBandObserved: undefined }
      : { hasExactAdverseMoonToNatalEndpoint: undefined }).required[0];
    assert.deepEqual([missing.hits.length, missing.unknown], [0, true], passage);
    if (passage === 'p044') {
      assert.ok(result.windows.some(window => window.start <= witness.activeFrom && witness.activeTo <= window.endExclusive));
      assert.equal(evaluate({}).confirmations[3].hits.length, 1);
      assert.equal(evaluate({ sameLayerLunarState: 'none' }).confirmations[3].hits.length, 0);
      assert.match(prompt, /可参考原文所述困扰可能增加；其他偏顺或待核证据及个人真实处境仍须分别考虑/u);
    }
    if (passage === 'p066') {
      assert.equal(p.hasMarsSaturnAdverseLunarActivation, true);
      assert.equal(p.hasMarsSaturnReviewedMixedOrFavourableMoon, false);
      assert.deepEqual(evaluate({}).exclusions, []);
      assert.equal(evaluate({}).confirmations[3].hits.length, 0);
      assert.equal(result.matchedSourceExcerpt, marsSaturnBackground);
    }
    const actualMoon = passage === 'p044' ? '本命木星的四分相' : '本命土星的半刑相';
    assert.ok(formatFortuneFactAudit(input).includes(`同层月相另有待核。这一秒核到次限月亮对${actualMoon}精确成相`), passage);
    assert.doesNotMatch(prompt, /exactAdverseMoonToNatalEndpoint|同层月相另有待核/u, passage);
    if (passage === 'p044') {
      assert.ok(prompt.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
    } else {
      // The real parallel confirms the long background even on a slice with unclassified lunar evidence.
      const isolated = { ...run, facts: [witness] };
      const report = interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p066-unclassified-exact');
      const isolatedInput = buildFortuneModelContext(isolated, report).input;
      assert.ok(isolatedInput.sections.some(section => section.findings.some(finding => finding.knowledgeId === result.knowledgeId)));
      const checkedMitigation = /同一本命火土未见已核偏顺相位或互入守护座/u;
      assert.match(formatFortuneFactAudit(isolatedInput), checkedMitigation);
      assert.match(formatFortuneFactAudit(input), checkedMitigation);
      assert.doesNotMatch(prompt, checkedMitigation);
      const unreviewed = { ...witness, normalizedPayload: { ...p, marsSaturnNatalBalanceBasis: 'unreviewed' } };
      const unreviewedRun = { ...run, facts: [unreviewed] };
      assert.equal(fromFacts([unreviewed]).matchedSourceExcerpt, marsSaturnBackground);
      const unreviewedReport = interpretFortune(unreviewedRun, requestForFortuneRun(unreviewedRun), 'leo-p066-unreviewed-mitigation');
      assert.doesNotMatch(formatFortuneFactAudit(buildFortuneModelContext(unreviewedRun, unreviewedReport).input), checkedMitigation);
      const isolatedPrompt = formatFortunePrompt(isolatedInput);
      assert.match(isolatedPrompt, /较长的行动和约束背景/u);
      assert.doesNotMatch(isolatedPrompt, /When, therefore, the lunar directions are evil|精确成相|marsSaturnNatalBalanceBasis/u);
      assert.doesNotMatch(isolatedPrompt, checkedMitigation);
    }
    assert.doesNotMatch(prompt, /blood disorders|death in the family/u, passage);
  }
});

test('three Mars directions also admit an exact adverse Moon contact to the same progressed Mars', () => {
  const cases = [
    ['p041', '1967-05-23', '08:00:00', 'Jupiter', 'square', 'square', 90, '2026-11-17T02:10:14.246Z', 'mixed'],
    ['p044', '1953-11-20', '08:00:00', 'Jupiter', 'quincunx', 'semisquare', 45, '2026-10-02T17:27:00.813Z', 'all_favourable'],
    ['p066', '1965-03-03', '16:00:00', 'Saturn', 'parallel', 'square', 90, '2026-01-17T19:09:29.641Z', 'none'],
  ];
  for (const [passage, birthday, birthTime, target, aspect, lunarAspect, lunarAngle, exactAt, natalState] of cases) {
    const { birth, run, matches, input, prompt } = annualReport(birthday, 2026, birthTime);
    const isPassage = row => row.knowledgeId.includes(`-${passage}-`);
    const result = matches.find(isPassage);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === target && p.targetKind === 'natal' && p.aspectType === aspect);
    const point = family.find(fact => fact.activeFrom === exactAt && fact.normalizedPayload.hasExactAdverseMoonToProgressedEndpoint);
    assert.ok(point, passage);
    const p = point.normalizedPayload;
    assert.equal(p.natalState, natalState, passage);
    assert.equal(p.progressedState, 'all_adverse', passage);
    assert.equal(p.hasExactAdverseMoonToNatalEndpoint, false, passage);
    assert.deepEqual(p.exactAdverseMoonToProgressedEndpoint,
      { body: 'Moon', target: 'Mars', targetKind: 'progressed', aspectType: lunarAspect }, passage);
    const instant = Date.parse(exactAt);
    const epoch = Math.round(progressionEpoch(birth, instant));
    const separation = Math.abs((readLeoMovingPosition('Moon', epoch).longitude
      - readLeoMovingPosition('Mars', epoch).longitude + 540) % 360 - 180);
    assert.ok(Math.abs(separation - lunarAngle) < 0.00001, passage);
    assert.equal(result.status, 'matched', passage);
    assert.ok(result.sourceFactIds.includes(point.factId), passage);
    for (const adjacentAt of [instant - 1, instant + 1_000]) {
      const adjacent = family.find(fact => Date.parse(fact.activeFrom) <= adjacentAt && adjacentAt < Date.parse(fact.activeTo));
      assert.ok(adjacent && adjacent.normalizedPayload.hasExactAdverseMoonToProgressedEndpoint === false, passage);
      if (passage === 'p066') {
        assert.ok(result.sourceFactIds.includes(adjacent.factId));
        assert.equal(adjacent.normalizedPayload.hasMarsSaturnAdverseLunarActivation, false);
        const adjacentMatch = matchFortuneKnowledge({ ...run, facts: [adjacent] }).byMethod.western.find(isPassage);
        assert.ok(!adjacentMatch.matchedSourceExcerpt.includes(marsSaturnAdverseActivation));
      } else assert.ok(!result.sourceFactIds.includes(adjacent.factId), passage);
    }

    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point, normalizedPayload: { ...p, ...changes } }]).find(isPassage);
    assert.equal(evaluate({ hasExactAdverseMoonToProgressedEndpoint: false }).required[0].hits.length, Number(passage === 'p066'), passage);
    assert.equal(evaluate({ progressedState: 'mixed' }).required[0].hits.length, Number(passage === 'p066'), passage);
    const audit = new RegExp('这一秒核到次限月亮对同图次限火星的' + (lunarAngle === 90 ? '四分相' : '半刑相') + '精确成相', 'u');
    assert.match(formatFortuneFactAudit(input), audit, passage);
    assert.doesNotMatch(prompt, audit, passage);
    if (passage === 'p044') {
      assert.equal(evaluate({}).confirmations[3].hits.length, 1);
      assert.equal(evaluate({ progressedState: 'mixed' }).confirmations[3].hits.length, 0);
      assert.equal(evaluate({ hasExactAdverseMoonToProgressedEndpoint: undefined }).confirmations[3].unknown, true);
      assert.match(prompt, /可参考原文所述困扰可能增加；其他偏顺或待核证据及个人真实处境仍须分别考虑/u);
      assert.doesNotMatch(prompt, /hasExactAdverseMoonToProgressedEndpoint|blood disorders|death in the family/u);
    }
    if (target === 'Saturn') {
      assert.equal(p.hasMarsSaturnAdverseLunarActivation, true);
      assert.deepEqual(evaluate({}).exclusions, []);
      assert.deepEqual(evaluate({}).confirmations.slice(0, 5).map(branch => branch.hits.length), [0, 0, 0, 1, 1]);
      assert.equal(evaluate({ natalState: 'conditional' }).confirmations[3].hits.length, 0);
      assert.equal(evaluate({ progressedState: 'mixed' }).confirmations[3].hits.length, 0);
      assert.equal(evaluate({ hasExactAdverseMoonToProgressedEndpoint: undefined }).confirmations[3].unknown, true);
      assert.ok(result.matchedSourceExcerpt.includes(marsSaturnAdverseActivation));
      assert.ok(result.matchedSourceExcerpt.includes(marsSaturnBackground));
      assert.match(prompt, /只在该成相秒确认原书的偏难月相引动/u);
    }
  }
});

test('p066 recognizes true lunar parallels at the separate natal and progressed endpoints', () => {
  const { birth, run, matches, input, prompt } = annualReport('1968-01-01', 2014, '12:00:00');
  const passage = row => row.knowledgeId.includes('-p066-');
  const result = matches.find(passage);
  assert.equal(result.status, 'matched');
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Mars' && p.natalTargetId === 'Saturn' && p.targetKind === 'natal' && p.aspectType === 'parallel');
  for (const [field, target, kind, date] of [
    ['exactAdverseMoonToNatalEndpoint', 'Saturn', 'natal', '2014-07-06T17:43:28.923Z'],
    ['exactAdverseMoonToProgressedEndpoint', 'Mars', 'progressed', '2014-06-16T12:51:56.272Z'],
  ]) {
    const row = family.find(fact => fact.normalizedPayload[field]?.aspectType === 'parallel'
      && Math.abs(Date.parse(fact.activeFrom) - Date.parse(date)) < 1_000);
    assert.ok(row, `${kind} ${target} ${date}`);
    assert.ok(result.sourceFactIds.includes(row.factId));
    assert.deepEqual(row.normalizedPayload[field], { body: 'Moon', target, targetKind: kind, aspectType: 'parallel' });
    assert.equal(row.normalizedPayload.natalMutualDomicileExchange, true);
    const moonOnly = { ...row, normalizedPayload: { ...row.normalizedPayload, natalMutualDomicileExchange: false } };
    assert.equal(matchFortuneKnowledge({ ...run, facts: [moonOnly] }).byMethod.western.find(passage).matchedSourceExcerpt, marsSaturnBackground);
    const exact = Date.parse(row.activeFrom), at = Math.round(progressionEpoch(birth, exact));
    const moon = readLeoMovingPosition('Moon', at), contact = readLeoMovingPosition(target, kind === 'natal' ? birth : at);
    assert.ok(Math.abs(Math.abs(moon.declination) - Math.abs(contact.declination)) < 0.00001);
    for (const near of [exact - 1, Date.parse(row.activeTo)]) {
      const adjacent = family.find(fact => Date.parse(fact.activeFrom) <= near && near < Date.parse(fact.activeTo));
      assert.ok(adjacent && adjacent.normalizedPayload[field]?.aspectType !== 'parallel');
    }
  }
  const start = '2014-07-16T20:08:43.279Z', end = '2014-07-18T06:31:07.126Z';
  const read = at => family.find(fact => Date.parse(fact.activeFrom) <= at && at < Date.parse(fact.activeTo));
  const bands = family.filter(fact => start <= fact.activeFrom && fact.activeTo <= end);
  assert.equal(bands[0].activeFrom, start);
  assert.equal(bands.at(-1).activeTo, end);
  const parallelConfirmation = facts => evaluateFortuneRules('western', 'year', facts).find(passage).confirmations.find(query =>
    JSON.parse(query.condition).where.hasMarsSaturnAdverseLunarParallelActivation === true);
  assert.deepEqual(parallelConfirmation(bands).hits, bands);
  for (const band of bands) {
    const p = band.normalizedPayload;
    assert.deepEqual([p.natalState, p.progressedState], ['all_adverse', 'all_adverse']);
    assert.equal(p.hasMarsSaturnAdverseLunarParallelActivation, true);
    assert.equal(p.hasExactAdverseMoonToNatalEndpoint, false);
    assert.equal(p.hasExactAdverseMoonToProgressedEndpoint, false);
    assert.deepEqual(p.marsSaturnAdverseLunarParallelContacts.map(({ target, targetKind, aspectType }) =>
      [target, targetKind, aspectType]), [['Saturn', 'natal', 'parallel'], ['Mars', 'progressed', 'parallel']]);
    const at = (Date.parse(band.activeFrom) + Date.parse(band.activeTo)) / 2;
    const epoch = Math.round(progressionEpoch(birth, at));
    const dec = (body, time) => Math.abs(readLeoMovingPosition(body, time).declination);
    for (const [body, time] of [['Saturn', birth], ['Mars', epoch]]) {
      const deviation = Math.abs(dec('Moon', epoch) - dec(body, time));
      assert.ok(0.00001 < deviation && deviation < 1);
    }
  }
  const excluded = [read(Date.parse(start) - 1), read(Date.parse(end))];
  assert.ok(excluded.every(row => row.normalizedPayload.natalState === 'conditional'
    && row.normalizedPayload.marsSaturnAdverseLunarParallelContacts.length === 2
    && row.normalizedPayload.hasMarsSaturnAdverseLunarParallelActivation === false));
  assert.deepEqual(parallelConfirmation(excluded).hits, []);
  const [sample] = bands;
  const unknown = { ...sample, normalizedPayload: { ...sample.normalizedPayload, hasMarsSaturnAdverseLunarParallelActivation: undefined } };
  assert.equal(parallelConfirmation([unknown]).unknown, true);
  const bandRun = { ...run, facts: [sample] };
  const bandResult = matchFortuneKnowledge(bandRun).byMethod.western.find(passage);
  assert.deepEqual(bandResult.windows, [{ start: sample.activeFrom, endExclusive: sample.activeTo }]);
  const { input: bandInput } = buildFortuneModelContext(bandRun,
    interpretFortune(bandRun, requestForFortuneRun(bandRun), 'leo-p066-lunar-parallel-band'));
  const bandPrompt = formatFortunePrompt(bandInput);
  const bandAudit = /次限月亮对本命土星的赤纬绝对值平行在同一火土有效段内持续处于一度绝对赤纬平行带/u;
  assert.match(formatFortuneFactAudit(bandInput), bandAudit);
  assert.match(bandPrompt, /一度绝对赤纬平行带/u);
  assert.doesNotMatch(bandPrompt, bandAudit);
  assert.doesNotMatch(bandPrompt, /hasMarsSaturnAdverseLunarParallelActivation|marsSaturnAdverseLunarParallelContacts/u);
  const audit = formatFortuneFactAudit(input);
  for (const label of ['本命土星', '同图次限火星']) {
    const phrase = `火土平行有效段内，次限月亮对${label}的赤纬绝对值平行实际成相`;
    assert.ok(audit.includes(phrase), label);
    assert.ok(!prompt.includes(phrase), label);
  }
  assert.match(prompt, /本命两星同时落在彼此守护的星座/u);
  assert.doesNotMatch(prompt, /exactAdverseMoonToNatalEndpoint|exactAdverseMoonToProgressedEndpoint/u);
});

test('p066 confirms an actual natal Saturn Moon trigger when both layers are adverse', () => {
  const { birth, run, matches, input, prompt } = annualReport('1965-02-03', 2026);
  const isRule = rule => rule.knowledgeId.includes('-p066-');
  const expectedAt = Date.parse('2026-12-20T22:28:04.973Z');
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Mars' && p.natalTargetId === 'Saturn' && p.targetKind === 'natal' && p.aspectType === 'parallel');
  const point = family.find(row => row.normalizedPayload.hasExactAdverseMoonToNatalEndpoint
    && Math.abs(Date.parse(row.activeFrom) - expectedAt) < 1_000);
  assert.ok(point);
  const p = point.normalizedPayload;
  assert.deepEqual([p.natalState, p.progressedState, p.natalMutualDomicileExchange], ['all_adverse', 'all_adverse', false]);
  assert.deepEqual(p.exactAdverseMoonToNatalEndpoint, { body: 'Moon', target: 'Saturn', targetKind: 'natal', aspectType: 'square' });
  const at = Date.parse(point.activeFrom), lunarEpoch = progressionEpoch(birth, at);
  assert.equal(Date.parse(point.activeTo), at + 1_000);
  const separation = Math.abs((longitude('Moon', lunarEpoch) - longitude('Saturn', birth) + 540) % 360 - 180);
  assert.ok(Math.abs(separation - 90) < 0.00001);
  const progressedMars = readLeoMovingPosition('Mars', lunarEpoch).declination;
  assert.ok(Math.abs(Math.abs(progressedMars) - Math.abs(readLeoMovingPosition('Saturn', birth).declination)) <= 1);
  const result = matches.find(isRule);
  assert.equal(result.status, 'matched');
  assert.ok(result.sourceFactIds.includes(point.factId));
  const adverseBranch = result.confirmedBranches.find(branch => branch.conditions.some(condition => condition.includes('只在该成相秒')));
  assert.ok(adverseBranch.windows.some(window => window.start === point.activeFrom && window.endExclusive === point.activeTo));
  const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point,
    normalizedPayload: { ...p, ...changes } }]).find(isRule).confirmations[3];
  assert.equal(evaluate({}).hits.length, 1);
  assert.equal(evaluate({ progressedState: 'all_favourable' }).hits.length, 0);
  assert.equal(evaluate({ hasExactAdverseMoonToNatalEndpoint: undefined }).unknown, true);
  for (const adjacentAt of [at - 1, Date.parse(point.activeTo)]) {
    const neighbor = family.find(row => Date.parse(row.activeFrom) <= adjacentAt && adjacentAt < Date.parse(row.activeTo));
    assert.ok(neighbor && result.sourceFactIds.includes(neighbor.factId) && !adverseBranch.sourceFactIds.includes(neighbor.factId));
  }
  const raw = /次限月亮对本命土星形成四分相，原书月亮篇偏难，精确点为2026-12-20 22:28:04/u;
  assert.match(formatFortuneFactAudit(input), raw);
  assert.match(prompt, /只在该成相秒确认原书的偏难月相引动/u);
  assert.doesNotMatch(prompt, raw);
});

test('p066 accepts a progressed Moon–Neptune square only at its exact point with no unclassified companion', () => {
  const isRule = rule => rule.knowledgeId.includes('-p066-');
  const confirm = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).confirmations.find(query =>
    JSON.parse(query.condition).where.hasExactCleanMarsSaturnAdverseMoon === true);
  for (const [birthday, exactDate, clean] of [
    ['1931-08-08', '2026-06-28T12:53:03.660Z', true],
    ['1930-10-25', '2026-08-03T17:29:44.418Z', false],
  ]) {
    const { birth, run } = annualReport(birthday, 2026, '12:00:00');
    const expected = Date.parse(exactDate);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.marsSaturnParallelBandObserved === true && p.targetKind === 'natal');
    const point = family.find(fact => Math.abs(Date.parse(fact.activeFrom) - expected) < 1_000);
    assert.ok(point, exactDate);
    const p = point.normalizedPayload;
    assert.equal(p.progressedState, 'conditional');
    assert.equal(p.hasExactCleanMarsSaturnAdverseMoon, clean);
    assert.deepEqual(confirm([point]).hits, clean ? [point] : []);
    const at = Date.parse(point.activeFrom);
    const epoch = progressionEpoch(birth, at);
    const moon = readLeoMovingPosition('Moon', epoch), neptune = readLeoMovingPosition('Neptune', epoch);
    const angle = Math.abs((moon.longitude - neptune.longitude + 540) % 360 - 180);
    assert.ok(Math.abs(angle - 90) < 0.00001);
    const natalNeptune = readLeoMovingPosition('Neptune', birth);
    const natalAngle = Math.abs((moon.longitude - natalNeptune.longitude + 540) % 360 - 180);
    assert.equal(Math.abs(natalAngle - 90) < 1, !clean);
    if (!clean) {
      assert.equal(p.natalState, 'conditional');
      assert.equal(p.exactCleanMarsSaturnAdverseMoon, undefined);
      continue;
    }
    assert.deepEqual(p.exactCleanMarsSaturnAdverseMoon,
      { body: 'Moon', target: 'Neptune', targetKind: 'progressed', aspectType: 'square' });
    assert.equal(Date.parse(point.activeTo), at + 1_000);
    for (const adjacentAt of [at - 1, Date.parse(point.activeTo)]) {
      const neighbor = family.find(fact => Date.parse(fact.activeFrom) <= adjacentAt && adjacentAt < Date.parse(fact.activeTo));
      assert.ok(neighbor && neighbor.normalizedPayload.hasExactCleanMarsSaturnAdverseMoon === false);
    }
    const isolated = { ...run, facts: [point] };
    assert.deepEqual(matchFortuneKnowledge(isolated).byMethod.western.find(isRule).windows,
      [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p066-progressed-neptune'));
    const detail = /次限月亮对同图次限海王星的四分相实际成相/u;
    assert.match(formatFortuneFactAudit(input), detail);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /与另一已核位置实际形成 Leo 月亮篇列出的偏难相位/u);
    assert.doesNotMatch(provider, /exactCleanMarsSaturnAdverseMoon|12:53:03/u);
    assert.doesNotMatch(provider, detail);
  }
});

test('p066 confirms other source-classified adverse Moon points only after both layers are checked', () => {
  const { birth, run } = annualReport('1965-03-03', 2026, '16:00:00');
  const isRule = rule => rule.knowledgeId.includes('-p066-');
  const isOtherMoon = query => JSON.parse(query.condition).where.hasExactCleanMarsSaturnAdverseMoon === true;
  const confirm = facts => evaluateFortuneRules('western', 'year', facts).find(isRule).confirmations.find(isOtherMoon);
  const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.marsSaturnParallelBandObserved === true && p.targetKind === 'natal');
  const at = (value, facts = family) => facts.find(fact => Date.parse(fact.activeFrom) <= value && value < Date.parse(fact.activeTo));
  for (const [date, target, chineseTarget] of [
    ['2026-02-11T16:37:18.684Z', 'Uranus', '天王星'],
    ['2026-05-23T18:29:13.088Z', 'Saturn', '土星'],
  ]) {
    const exactAt = Date.parse(date);
    const point = at(exactAt);
    assert.ok(point, date);
    assert.equal(point.activeFrom, date);
    assert.equal(Date.parse(point.activeTo), exactAt + 1_000);
    const p = point.normalizedPayload;
    assert.equal(p.hasExactCleanMarsSaturnAdverseMoon, true);
    assert.deepEqual([p.natalState, p.progressedState], ['none', 'all_adverse']);
    assert.deepEqual(p.exactCleanMarsSaturnAdverseMoon, { body: 'Moon', target, targetKind: 'progressed', aspectType: 'square' });
    assert.equal(p.hasExactAdverseMoonToNatalEndpoint, false);
    assert.equal(p.hasExactAdverseMoonToProgressedEndpoint, false);
    const epoch = progressionEpoch(birth, exactAt);
    const longitudeGap = Math.abs((longitude('Moon', epoch) - longitude(target, epoch) + 540) % 360 - 180);
    assert.ok(Math.abs(longitudeGap - 90) < 0.00001);
    const mars = readLeoMovingPosition('Mars', epoch).declination, saturn = readLeoMovingPosition('Saturn', birth).declination;
    assert.ok(Math.abs(Math.abs(mars) - Math.abs(saturn)) <= 1);
    assert.deepEqual(confirm([point]).hits, [point]);
    const neighbours = [at(exactAt - 1), at(exactAt + 1_000)];
    assert.ok(neighbours.every(Boolean));
    assert.deepEqual(confirm(neighbours).hits, []);
    const isolated = { ...run, facts: [point] };
    const matched = matchFortuneKnowledge(isolated).byMethod.western.find(isRule);
    assert.equal(matched.status, 'matched');
    assert.deepEqual(matched.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p066-other-moon'));
    const audit = '次限月亮对同图次限' + chineseTarget + '的四分相实际成相，两层已核月相无偏顺或待分类接触';
    assert.ok(formatFortuneFactAudit(input).includes(audit), date);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /与另一已核位置实际形成 Leo 月亮篇列出的偏难相位/u);
    assert.doesNotMatch(prompt, /hasExactCleanMarsSaturnAdverseMoon|exactCleanMarsSaturnAdverseMoon/u);
    assert.ok(!prompt.includes(audit));
  }

  for (const [date, target, natalState, progressedState] of [
    ['2026-04-02T14:22:40.437Z', 'Uranus', 'all_adverse', 'all_favourable'],
    ['2026-09-23T03:53:19.329Z', 'Mercury', 'mixed', 'conditional'],
  ]) {
    const point = at(Date.parse(date));
    assert.ok(point, date);
    const p = point.normalizedPayload;
    assert.equal(point.activeFrom, date);
    assert.deepEqual([p.natalState, p.progressedState], [natalState, progressedState]);
    assert.ok(p.contacts.some(row => row.target === target && row.targetKind === 'natal'
      && row.nature === 'adverse' && row.aspectType === 'square' && row.exactTimes.includes(date)));
    assert.equal(p.hasExactCleanMarsSaturnAdverseMoon, false);
    assert.deepEqual(confirm([point]).hits, []);
  }

  const topology = { start: 0, end: 4_000, exactTimes: [] };
  const base = { ...topology, progressedBody: 'Mars', natalTargetId: 'Saturn', targetKind: 'natal',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1 };
  const adverse = { ...topology, progressedBody: 'Moon', natalTargetId: 'Uranus', targetKind: 'progressed',
    aspectType: 'square', coordinate: 'ecliptic_longitude', exactTimes: [2_000] };
  const mixed = { ...topology, progressedBody: 'Moon', natalTargetId: 'Venus', targetKind: 'natal',
    aspectType: 'sextile', coordinate: 'ecliptic_longitude' };
  const conditional = { ...mixed, natalTargetId: 'Neptune', aspectType: 'quincunx' };
  const active = (others, checked) => buildLeoLunarConditions([base, adverse, ...others], [], [], checked)
    .find(row => row.base === base && row.start <= 2_000 && 2_000 < row.end);
  assert.equal(active([], [adverse]).hasExactCleanMarsSaturnAdverseMoon, true);
  assert.equal(active([mixed], [adverse]).hasExactCleanMarsSaturnAdverseMoon, false);
  assert.equal(active([conditional], [adverse]).hasExactCleanMarsSaturnAdverseMoon, false);
  assert.equal(active([], undefined).hasExactCleanMarsSaturnAdverseMoon, undefined);
});

test('p059 distinguishes exact solar-only preparation from a same-slice Moon witness', () => {
  const isRule = row => row.knowledgeId.includes('-p059-');
  for (const [birthday, expectedAt, target, targetKind, aspectType, angle, lunarWitness] of [
    ['1952-06-03', '2026-04-26T12:38:51.189Z', 'Mars', 'progressed', 'square', 90, true],
    ['1954-01-16', '2026-04-09T00:51:23.972Z', 'Saturn', 'natal', 'quincunx', 150, false],
  ]) {
    const { birth, run, matches, input, prompt } = annualReport(birthday, 2026, '12:00:00');
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Saturn' && p.targetKind === 'natal' && p.aspectType === 'semisquare');
    const point = family.find(row => row.normalizedPayload.exactSolarLinkedBodies?.includes(target)
      && Math.abs(Date.parse(row.activeFrom) - Date.parse(expectedAt)) < 1_000);
    assert.ok(point, birthday);
    const p = point.normalizedPayload;
    assert.deepEqual(p.exactSolarEndpointContacts, [{ body: 'Sun', target, targetKind, aspectType }]);
    assert.equal(p.pairLuminaryLinksComplete, lunarWitness);
    assert.equal(p.mutualExactInSlice, false);
    assert.deepEqual(p.exactLunarLinkedBodies, []);
    const result = matches.find(isRule);
    assert.equal(result.status, 'matched');
    assert.ok(result.sourceFactIds.includes(point.factId));
    const endpoint = targetKind === 'natal' ? '本命土星的梅花相' : '同图次限火星的四分相';
    const audit = '火土半刑有效段内，次限太阳对' + endpoint + '实际成相，同段次限月亮也接触相关火土';
    const preparation = '火土半刑有效段内，次限太阳对' + endpoint + '实际成相，只供准备倾向参考，显化仍须月亮合参';
    const localAudit = formatFortuneFactAudit(input);
    assert.equal(localAudit.includes(audit), lunarWitness);
    assert.equal(localAudit.includes(preparation), !lunarWitness);
    assert.ok(!prompt.includes(audit));
    assert.ok(!prompt.includes(preparation));
    const at = Date.parse(point.activeFrom);
    assert.equal(Date.parse(point.activeTo), at + 1_000);
    const epoch = progressionEpoch(birth, at);
    const separation = Math.abs((longitude('Sun', epoch) - longitude(target, targetKind === 'natal' ? birth : epoch) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - angle) < 0.00001);
    for (const time of [at - 1, at + 1_000]) {
      const adjacent = family.find(row => Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
      assert.deepEqual(adjacent?.normalizedPayload.exactSolarLinkedBodies, []);
      assert.ok(!result.sourceFactIds.includes(adjacent.factId));
    }
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point,
      normalizedPayload: { ...p, ...changes } }]).find(isRule).required[0];
    assert.equal(evaluate({ targetKind: 'progressed' }).hits.length, 0);
    assert.deepEqual([evaluate({ exactSolarLinkedBodies: [] }).hits.length,
      evaluate({ exactSolarLinkedBodies: [] }).unknown], [0, false]);
    const unknown = evaluate({ exactSolarLinkedBodies: undefined });
    assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true]);
    const unreviewedMoonLink = evaluate({ pairLuminaryLinksComplete: undefined });
    assert.deepEqual([unreviewedMoonLink.hits.length, unreviewedMoonLink.unknown], [0, true]);
    assert.doesNotMatch(prompt, /exactSolarLinkedBodies|exactSolarEndpointContacts/u);
  }
});

test('p340 keeps only the weak background in a real year without a matching lunar or other witness', () => {
  const sample = annualReport('1968-03-04', 2026);
  const result = sample.matches.find(row => row.knowledgeId.includes('-p340-'));
  const family = sample.run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
    && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'quincunx');
  const points = family.filter(({ normalizedPayload: p }) => p.mutualExactInSlice);
  assert.deepEqual(points.map(point => point.activeFrom), ['2026-08-24T19:36:41.111Z']);
  assert.ok(family.every(({ normalizedPayload: p }) => p.exactLunarLinkedBodies.length === 0
    && p.exactUranianSensitivityDirection === false && p.hasExactVenusNeptuneSensitivityDirection === false));
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.sourceFactIds, points.map(point => point.factId));
  const [point] = points;
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  const instant = Date.parse(point.activeFrom);
  const progressedVenus = longitude('Venus', progressionEpoch(sample.birth, instant));
  const fixedUranus = longitude('Uranus', sample.birth);
  assert.ok(Math.abs(Math.abs((progressedVenus - fixedUranus + 540) % 360 - 180) - 150) < 0.00001);
  assert.equal(Date.parse(point.activeTo) - instant, 1_000);
  const matchFor = row => matchFortuneKnowledge({ ...sample.run, facts: [row] }).byMethod.western
    .find(candidate => candidate.knowledgeId === result.knowledgeId);
  for (const adjacentAt of [instant - 1, instant + 1_000]) {
    const adjacent = family.find(row => Date.parse(row.activeFrom) <= adjacentAt && adjacentAt < Date.parse(row.activeTo));
    assert.ok(adjacent);
    assert.equal(matchFor(adjacent).status, 'not_matched');
  }
  const movedUranus = longitude('Uranus', progressionEpoch(sample.birth, instant));
  assert.ok(Math.abs(Math.abs((progressedVenus - movedUranus + 540) % 360 - 180) - 150) > 0.00001);
  const otherLayerAtPoint = sample.run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
    factType === 'leo_lunar_condition' && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus'
    && p.targetKind === 'progressed' && p.aspectType === 'quincunx' && activeFrom <= point.activeFrom && point.activeFrom < activeTo);
  assert.notEqual(otherLayerAtPoint?.normalizedPayload.mutualExactInSlice, true);
  const background = '次限金星对本命天王星实际形成梅花相，原书列作较弱背景';
  assert.ok(formatFortuneFactAudit(sample.input).includes(background));
  assert.ok(!sample.prompt.includes(background));
  assert.match(sample.prompt, /An aspect that is very weak and may have little or no effect upon the life/u);
  assert.match(sample.prompt, /较明显的感受另须同期同题证据/u);
  assert.doesNotMatch(sample.prompt, /本条同时具备月亮引动|nervous disorders|lend money|mutualExactInSlice/u);
});

test('p340 confirms the exact natal Venus–Neptune square only inside its Venus–Uranus band', () => {
  const sample = annualReport('1939-08-31', 2025, '12:00:00');
  const isRule = row => row.knowledgeId.includes('-p340-');
  const pair = ({ normalizedPayload: p }) => p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus'
    && p.targetKind === 'natal' && p.aspectType === 'quincunx';
  const slices = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && pair(fact));
  const exact = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_mutual_exact_observation'
    && p.progressedBody === 'Venus' && p.natalTargetId === 'Neptune' && p.aspectType === 'square' && p.targetKind === 'natal');
  assert.ok(exact?.exactInstant?.startsWith('2025-04'));
  const witness = slices.find(row => row.normalizedPayload.hasExactVenusNeptuneSensitivityDirection);
  assert.ok(witness);
  assert.equal(witness.activeFrom, exact.exactInstant);
  assert.deepEqual(witness.normalizedPayload.venusNeptuneSensitivityDirection,
    { body: 'Venus', target: 'Neptune', targetKind: 'natal', aspectType: 'square' });
  assert.deepEqual(witness.normalizedPayload.exactLunarLinkedBodies, []);
  assert.equal(witness.normalizedPayload.exactUranianSensitivityDirection, false);
  assert.equal(witness.normalizedPayload.hasUranianLunarParallelActivation, false);
  assert.equal(witness.normalizedPayload.hasVenusLunarParallelActivation, false);
  assert.equal(witness.normalizedPayload.mutualExactInSlice, false);
  const at = Date.parse(witness.activeFrom);
  assert.equal(Date.parse(witness.activeTo), at + 1_000);
  const venus = longitude('Venus', progressionEpoch(sample.birth, at));
  const separation = target => Math.abs((venus - longitude(target, sample.birth) + 540) % 360 - 180);
  assert.ok(Math.abs(separation('Neptune') - 90) < 0.00001);
  assert.ok(Math.abs(separation('Uranus') - 150) < 1);
  const result = sample.matches.find(isRule);
  const lunarWitnesses = slices.filter(({ normalizedPayload: p }) =>
    p.hasUranianLunarParallelActivation || p.exactLunarLinkedBodies.length);
  const basis = slices.filter(({ normalizedPayload: p }) => p.mutualExactInSlice);
  assert.ok(lunarWitnesses.length);
  assert.equal(result.status, 'matched');
  assert.deepEqual(new Set(result.sourceFactIds), new Set([...lunarWitnesses, ...basis, witness].map(row => row.factId)));
  const alone = row => matchFortuneKnowledge({ ...sample.run, facts: [row] }).byMethod.western.find(isRule);
  const confirmed = alone(witness);
  assert.equal(confirmed.status, 'matched');
  assert.equal(confirmed.matchedSourceExcerpt, 'other influences of a similar nature are operating');
  assert.deepEqual(confirmed.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  assert.match(confirmed.matchedConditions.join('\n'), /同一次限金星与本命海王星实际形成四分/u);
  const changed = changes => alone({ ...witness, normalizedPayload: { ...witness.normalizedPayload, ...changes } });
  assert.equal(changed({ hasExactVenusNeptuneSensitivityDirection: undefined }).status, 'unknown');
  assert.equal(changed({ targetKind: 'progressed' }).status, 'not_matched');
  for (const time of [at - 1, at + 1_000]) {
    const nearby = slices.find(row => Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
    assert.equal(nearby?.normalizedPayload.hasExactVenusNeptuneSensitivityDirection, false);
    assert.equal(alone(nearby).status, 'not_matched');
  }
  const base = { start: 0, end: 5_000, progressedBody: 'Venus', natalTargetId: 'Uranus', targetKind: 'natal',
    aspectType: 'quincunx', coordinate: 'ecliptic_longitude', exactTimes: [] };
  const square = { ...base, natalTargetId: 'Neptune', aspectType: 'square' };
  const movingSquare = { ...square, targetKind: 'progressed', exactTimes: [2_000] };
  const afterBand = { ...square, end: 6_000, exactTimes: [5_000] };
  const rows = buildLeoLunarConditions([base, square, movingSquare, afterBand]).filter(row => row.base === base);
  assert.ok(rows.every(row => row.hasExactVenusNeptuneSensitivityDirection === false));
  assert.deepEqual(rows.filter(row => row.hasExactProgressedVenusNeptuneSensitivityDirection)
    .map(({ start, end }) => [start, end]), [[2_000, 3_000]]);
  const audit = '金天梅花有效段内，次限金星对本命海王星的四分相实际成相，作为同主题旁证';
  assert.ok(formatFortuneFactAudit(sample.input).includes(audit));
  assert.ok(!sample.prompt.includes(audit));
  assert.match(sample.prompt, /原书金海段也提到受他人影响的情感感受/u);
  assert.doesNotMatch(sample.prompt, /nervous disorders|lend money/u);
  assert.doesNotMatch(sample.prompt, /venusNeptuneSensitivityDirection|hasExactVenusNeptuneSensitivityDirection/u);
});

test('p340 verifies the exact same-layer Moon–Neptune semisquare or square without mistaking it for a Venus or Uranus endpoint', () => {
  const rule = row => row.knowledgeId.includes('-p340-');
  const samples = [
    ['1945-09-06', [
      ['natal', 'semisquare', '2026-03-04T00:48:04.241Z', 'progressed'],
      ['progressed', 'semisquare', '2026-05-20T12:41:47.190Z', 'natal'],
    ]],
    ['1946-07-15', [['progressed', 'square', '2026-11-07T07:19:51.248Z']]],
    ['1946-10-05', [['natal', 'square', '2026-12-05T14:20:13.440Z']]],
  ];
  const separation = (moving, movingAt, target, targetAt) =>
    Math.abs((longitude(moving, movingAt) - longitude(target, targetAt) + 540) % 360 - 180);
  for (const [birthday, contacts] of samples) {
    const { run, birth } = annualReport(birthday, 2026);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.aspectType === 'quincunx');
    for (const [layer, aspect, expected, wrongLayer] of contacts) {
      const witness = family.find(({ activeFrom, normalizedPayload: p }) => p.targetKind === layer
        && p.hasExactMoonNeptuneSensitivityDirection && Math.abs(Date.parse(activeFrom) - Date.parse(expected)) < 1_000);
      assert.ok(witness, expected);
      const p = witness.normalizedPayload;
      const at = Date.parse(witness.activeFrom);
      assert.equal(Date.parse(witness.activeTo) - at, 1_000);
      assert.deepEqual(p.moonNeptuneSensitivityDirection, { body: 'Moon', target: 'Neptune', targetKind: layer, aspectType: aspect });
      assert.deepEqual(p.exactLunarLinkedBodies, []);
      const epoch = Math.round(progressionEpoch(birth, at));
      const targetAt = layer === 'natal' ? birth : epoch;
      assert.ok(Math.abs(separation('Venus', epoch, 'Uranus', targetAt) - 150) < 1);
      assert.ok(Math.abs(separation('Moon', epoch, 'Neptune', targetAt) - (aspect === 'semisquare' ? 45 : 90)) < 0.00001);
      const scoped = { ...run, facts: [witness] };
      const result = matchFortuneKnowledge(scoped).byMethod.western.find(rule);
      assert.equal(result.status, 'matched');
      assert.equal(result.matchedSourceExcerpt, 'other influences of a similar nature are operating');
      assert.deepEqual(result.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
      const confirmation = facts => evaluateFortuneRules('western', 'year', facts).find(rule).confirmations
        .find(query => {
          const { where } = JSON.parse(query.condition);
          return where.targetKind === layer && where.hasExactMoonNeptuneSensitivityDirection === true;
        });
      for (const nearby of [at - 1, at + 1_000]) {
        const adjacent = family.find(row => row.normalizedPayload.targetKind === layer
          && Date.parse(row.activeFrom) <= nearby && nearby < Date.parse(row.activeTo));
        assert.equal(adjacent?.normalizedPayload.hasExactMoonNeptuneSensitivityDirection, false);
        assert.equal(confirmation([adjacent]).hits.length, 0);
      }
      if (wrongLayer) {
        const other = family.find(row => row.normalizedPayload.targetKind === wrongLayer
          && row.activeFrom <= witness.activeFrom && witness.activeFrom < row.activeTo);
        assert.equal(other?.normalizedPayload.hasExactMoonNeptuneSensitivityDirection, false);
        assert.equal(confirmation([other]).hits.length, 0);
      }
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'leo-p340-neptune-moon'));
      const audit = /金天梅花有效段内，次限月亮对(?:本命|同图次限)海王星的(?:半刑|四分)相实际成相/u;
      assert.match(formatFortuneFactAudit(input), audit);
      const provider = formatFortunePrompt(input);
      assert.match(provider, /对他人影响较敏感/u);
      assert.doesNotMatch(provider, audit);
      assert.doesNotMatch(provider, /moonNeptuneSensitivityDirection|nervous disorders|lend money/u);
    }
  }
});

test('p340 confirms only the same moving Venus at an exact progressed Neptune square inside the natal Uranus band', () => {
  const rule = row => row.knowledgeId.includes('-p340-');
  const confirm = facts => evaluateFortuneRules('western', 'year', facts).find(rule).confirmations.find(query =>
    JSON.parse(query.condition).where.hasExactProgressedVenusNeptuneSensitivityDirection === true);
  for (const [birthday, date, within] of [
    ['1966-11-27', '2026-06-18T18:38:59.718Z', true],
    ['1941-08-12', '2026-08-17T17:50:03.186Z', false],
  ]) {
    const { birth, run } = annualReport(birthday, 2026, '12:00:00');
    const expected = Date.parse(date);
    const family = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Venus' && p.natalTargetId === 'Uranus' && p.targetKind === 'natal' && p.aspectType === 'quincunx');
    const witness = family.find(fact => fact.normalizedPayload.hasExactProgressedVenusNeptuneSensitivityDirection === true
      && Math.abs(Date.parse(fact.activeFrom) - expected) < 1_000);
    assert.equal(Boolean(witness), within, date);
    const at = witness ? Date.parse(witness.activeFrom) : expected;
    const ephemeris = Math.round(progressionEpoch(birth, at));
    const venus = longitude('Venus', ephemeris);
    const separation = (body, time) => Math.abs((venus - longitude(body, time) + 540) % 360 - 180);
    assert.ok(Math.abs(separation('Neptune', ephemeris) - 90) < 0.00001, date);
    assert.ok(Math.abs(separation('Neptune', birth) - 90) > 1, date);
    assert.equal(Math.abs(separation('Uranus', birth) - 150) < 1, within, date);
    if (!witness) {
      assert.ok(family.every(fact => date < fact.activeFrom || date >= fact.activeTo));
      continue;
    }
    const p = witness.normalizedPayload;
    assert.equal(p.hasExactVenusNeptuneSensitivityDirection, false);
    assert.equal(p.venusNeptuneSensitivityDirection, undefined);
    assert.deepEqual(p.progressedVenusNeptuneSensitivityDirection,
      { body: 'Venus', target: 'Neptune', targetKind: 'progressed', aspectType: 'square' });
    assert.equal(Date.parse(witness.activeTo), at + 1_000);
    assert.deepEqual(confirm([witness]).hits, [witness]);
    const wrongBase = { ...witness, normalizedPayload: { ...p, targetKind: 'progressed' } };
    assert.deepEqual(confirm([wrongBase]).hits, []);
    for (const neighborAt of [at - 1, Date.parse(witness.activeTo)]) {
      const neighbor = family.find(fact => Date.parse(fact.activeFrom) <= neighborAt && neighborAt < Date.parse(fact.activeTo));
      assert.ok(neighbor && neighbor.normalizedPayload.hasExactProgressedVenusNeptuneSensitivityDirection === false);
      assert.deepEqual(confirm([neighbor]).hits, []);
    }
    const isolated = { ...run, facts: [witness] };
    const match = matchFortuneKnowledge(isolated).byMethod.western.find(rule);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    assert.equal(match.matchedSourceExcerpt, 'other influences of a similar nature are operating');
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p340-moving-neptune'));
    const detail = /次限金星对同图次限海王星的四分相实际成相/u;
    assert.match(formatFortuneFactAudit(input), detail);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /与同图次限海王星实际形成四分/u);
    assert.doesNotMatch(provider, /与本命海王星实际形成四分|progressedVenusNeptuneSensitivityDirection|18:38:59/u);
    assert.doesNotMatch(provider, detail);
  }
});

test('p047 distinguishes the real Mars–Neptune conjunction from first-house art and third-house writing', () => {
  const passage = row => row.knowledgeId.includes('-p047-');
  const basicInclination = /次限火星与本命海王星在同一星座实际合相[^。]*精力与创造冲动/u;
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune'
    && p.targetKind === 'natal' && p.aspectType === 'conjunction';
  for (const [birth, year, armc, house, exact, expected, afflicted] of [
    ['1961-08-11', 2026, 45, 3, true, 'matched', true], ['1961-08-11', 2026, 105, 1, true, 'matched', true],
    ['1961-08-11', 2026, 0, 5, true, 'matched', true], ['1961-08-11', 2025, 105, 1, false, 'not_matched', true],
    ['1946-06-18', 2008, 15, 3, true, 'matched', false],
  ]) {
    const sample = annualReport(birth, year, '00:00:00', armc);
    const band = sample.run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && geometry(fact)
      && !fact.normalizedPayload.isMarsNeptuneConjunctionPoint);
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
    const confirmedPoint = sample.run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && geometry(fact)
      && fact.normalizedPayload.isMarsNeptuneConjunctionPoint);
    const result = sample.matches.find(passage);
    const p = band.normalizedPayload;
    assert.equal(Boolean(point), exact);
    assert.equal(p.hasMarsNeptuneConjunctionExact, exact);
    assert.equal(p.natalTargetHouse, house);
    assert.equal(p.hasNatalMarsNeptuneCreativeAffliction, afflicted);
    const afflictions = p.natalMarsNeptuneCreativeAfflictionContacts.map(({ first, second, aspect }) =>
      [first === 'Neptune' ? second : first, aspect]);
    assert.deepEqual(afflictions, afflicted ? [['Moon', 'square'], ['Mercury', 'square'], ['Mars', 'semisquare']] : []);
    assert.deepEqual(p.natalNeptuneCreativeTestimonies.map(row => [row.other, row.aspect]),
      afflicted ? [['Venus', 'trine']] : [['Moon', 'trine'], ['Venus', 'sextile']]);
    assert.equal(result.status, expected);
    assert.equal(result.sourceFactIds.includes(band.factId), false);
    assert.equal(Boolean(confirmedPoint), exact);
    const airMajority = birth === '1946-06-18';
    const elementBranch = facts => evaluateFortuneRules('western', 'year', facts).find(passage).confirmations
      .find(row => JSON.parse(row.condition).where.natalMarsNeptuneElementMajority === 'air');
    assert.equal(elementBranch([band]).hits.length, 0, birth);
    if (confirmedPoint) {
      const q = confirmedPoint.normalizedPayload;
      assert.equal(q.natalMarsNeptuneElementMajority, airMajority ? 'air' : 'none', birth);
      if (airMajority) {
        const airBodies = planets.filter(body => body !== 'Pluto' && Math.floor(longitude(body, sample.birth) / 30) % 4 === 2);
        assert.deepEqual(airBodies, ['Sun', 'Moon', 'Jupiter', 'Uranus', 'Neptune']);
        assert.deepEqual(q.natalMarsNeptuneElementMajorityWitness, { element: 'air', totalBodies: 9, bodies: airBodies });
        assert.ok(elementBranch([confirmedPoint]).sourceConditions.every(condition => sample.prompt.includes(condition)));
      } else assert.equal(q.natalMarsNeptuneElementMajorityWitness, undefined);
      assert.deepEqual(elementBranch([confirmedPoint]).hits, airMajority ? [confirmedPoint] : []);
      assert.equal(elementBranch([{ ...confirmedPoint, normalizedPayload: { ...q, isMarsNeptuneConjunctionPoint: false } }]).hits.length, 0);
      assert.doesNotMatch(sample.prompt, /natalMarsNeptuneElementMajority|1946-06-18/u);
    }
    const firstHouseAudit = /次限火星与本命第一宫海王星精确合相。[^。]+三分相/u;
    const thirdHouseAudit = /次限火星与本命第三宫海王星精确合相。[^。]+三分相/u;
    const audit = formatFortuneFactAudit(sample.input);
    const elementAudit = /精确火海合相时，本命风象星体为太阳、月亮、木星、天王星、海王星，占九星中的5颗/u;
    assert.equal(elementAudit.test(audit), airMajority && exact, birth);
    assert.doesNotMatch(sample.prompt, elementAudit);
    assert.equal(firstHouseAudit.test(audit), exact && house === 1);
    assert.equal(thirdHouseAudit.test(audit), exact && house === 3);
    assert.doesNotMatch(sample.prompt, /次限火星与本命第[一三]宫海王星精确合相|hasMarsNeptuneConjunctionExact|natalNeptuneCreativeTestimonies/u);
    assert.equal(basicInclination.test(sample.prompt), exact);
    assert.equal(/在同一火象或风象星座实际合相/u.test(sample.prompt), exact && p.conjunctionSign % 2 === 0);
    assert.equal(/可以参考诗乐、艺术主题/u.test(sample.prompt), exact && house === 1 && !afflicted);
    assert.equal(/可以参考想象与写作主题/u.test(sample.prompt), exact && house === 3 && !afflicted);
    assert.doesNotMatch(sample.prompt, /stage reached by the soul|To the undeveloped|isMarsNeptuneConjunctionPoint/u);
    // Isolate the house-dependent qualification from the separately tested sign branch.
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...band,
      normalizedPayload: { ...p, ...changes } }]).find(passage).required[0];
    const creative = changes => evaluate({ conjunctionSign: undefined, ...changes });
    assert.equal(creative({}).hits.length, Number(exact && [1, 3].includes(house)));
    assert.equal(creative({ hasNatalNeptuneCreativeTestimony: false }).hits.length, 0);
    assert.equal(creative({ natalTargetHouse: undefined }).unknown, true);
    assert.equal(creative({ targetKind: 'progressed' }).hits.length, 0);
    if (house === 5) {
      assert.deepEqual(evaluate({ hasNatalNeptuneCreativeTestimony: false }).hits, [{ ...band,
        normalizedPayload: { ...p, hasNatalNeptuneCreativeTestimony: false } }]);
      assert.deepEqual(evaluate({ hasMarsNeptuneConjunctionExact: false }).hits, []);
      assert.deepEqual(evaluate({ targetKind: 'progressed' }).hits, []);
      const missing = evaluate({ conjunctionSign: undefined });
      assert.deepEqual([missing.hits.length, missing.unknown], [0, true]);
    }
    if (point) {
      assert.equal(confirmedPoint.exactInstant, point.exactInstant);
      assert.deepEqual(result.windows, [{ start: point.exactInstant, endExclusive: new Date(Date.parse(point.exactInstant) + 1000).toISOString() }]);
      const isolated = { ...sample.run, facts: [band] };
      assert.equal(matchFortuneKnowledge(isolated).byMethod.western.find(passage).status, 'partial');
      const exactAt = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
      const separation = Math.abs((longitude('Mars', exactAt) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
      assert.ok(Math.abs(separation) < 0.00001);
      if (house === 5) {
        const exactWith = changes => matchFortuneKnowledge({ ...sample.run, facts: [{ ...confirmedPoint, normalizedPayload: {
          ...confirmedPoint.normalizedPayload, natalNeptuneCreativeTestimonies: [],
          hasNatalNeptuneCreativeTestimony: false, ...changes,
        } }] }).byMethod.western.find(passage);
        assert.equal(exactWith({}).status, 'matched');
        assert.equal(exactWith({ targetKind: 'progressed' }).status, 'not_matched');
        assert.notEqual(exactWith({ isMarsNeptuneConjunctionPoint: false }).status, 'matched');
      }
      if ([1, 3].includes(house)) {
        const assess = (selector, changes) => evaluateFortuneRules('western', 'year', [{ ...confirmedPoint,
          normalizedPayload: { ...confirmedPoint.normalizedPayload, ...changes } }]).find(passage)
          .confirmations.find(query => {
            const { where } = JSON.parse(query.condition);
            return where[selector] === house && where.hasNatalNeptuneCreativeTestimony === true;
          });
        const inHouse = changes => assess('natalTargetHouse', changes);
        assert.equal(inHouse({}).hits.length, Number(!afflicted));
        assert.equal(inHouse({ hasNatalMarsNeptuneCreativeAffliction: undefined }).unknown, true);
        assert.equal(inHouse({ targetKind: 'progressed' }).hits.length, 0);
        assert.equal(inHouse({ isMarsNeptuneConjunctionPoint: false }).hits.length, 0);
        const towardHouse = changes => assess('natalMarsNeptuneApproachedHouse', {
          natalTargetHouse: house === 1 ? 12 : 2, natalMarsNeptuneApproachedHouse: house, ...changes,
        });
        assert.equal(towardHouse({}).hits.length, Number(!afflicted));
        assert.equal(towardHouse({ hasNatalMarsNeptuneCreativeAffliction: undefined }).unknown, true);
      }
    }
  }
  const airy = annualReport('1946-05-31', 2026, '00:00:00', 0);
  const airyMatch = airy.matches.find(passage);
  const airyPoint = airy.run.facts.find(fact => airyMatch.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.isMarsNeptuneConjunctionPoint);
  assert.equal(airyPoint.normalizedPayload.conjunctionSign, 6);
  assert.equal(airyMatch.status, 'matched');
  assert.match(airy.prompt, basicInclination);
  assert.match(airy.prompt, /在同一火象或风象星座实际合相/u);
  assert.match(airyMatch.matchedSourceExcerpt, /according to the temperament indicated by the nativity/u);
  assert.match(airyMatch.matchedSourceExcerpt, /less likely where fiery or airy signs/u);
  assert.doesNotMatch(airy.prompt, /在同一水象或土象星座实际合相|To the undeveloped|isMarsNeptuneConjunctionPoint/u);
});

test('p047 confirms ninth-house writing only with the actual conjunction and reviewed natal support', () => {
  const passage = row => row.knowledgeId.includes('-p047-');
  const ninthHouseWriting = /若本人实际从事相关写作、研究或出版，可参考思想或信念主题的创作倾向/u;
  for (const [birth, year, armc, creative, afflictions] of [
    ['1946-06-18', 2008, 195, [['Moon', 'trine'], ['Venus', 'sextile']], []],
    ['1961-08-11', 2026, 225, [['Venus', 'trine']], [['Moon', 'square'], ['Mercury', 'square'], ['Mars', 'semisquare']]],
  ]) {
    const sample = annualReport(birth, year, '00:00:00', armc);
    const point = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal'
      && p.aspectType === 'conjunction' && p.isMarsNeptuneConjunctionPoint);
    assert.ok(point, birth);
    const p = point.normalizedPayload;
    const contactTypes = rows => rows.map(row => [row.other, row.aspect]);
    const qualified = afflictions.length === 0;
    assert.equal(p.natalTargetHouse, 9, birth);
    assert.deepEqual(contactTypes(p.natalNeptuneCreativeTestimonies), creative, birth);
    assert.deepEqual(p.natalMarsNeptuneCreativeAfflictionContacts.map(({ first, second, aspect }) =>
      [first === 'Neptune' ? second : first, aspect]), afflictions, birth);
    assert.equal(p.hasNatalMarsNeptuneCreativeAffliction, !qualified, birth);
    const exactAt = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const separation = Math.abs((longitude('Mars', exactAt) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(separation < 0.00001, birth);
    assert.equal(point.activeFrom, point.exactInstant, birth);
    assert.equal(Date.parse(point.activeTo) - Date.parse(point.activeFrom), 1000, birth);
    const result = sample.matches.find(passage);
    assert.equal(result.status, 'matched', birth);
    assert.equal(ninthHouseWriting.test(sample.prompt), qualified, birth);
    assert.doesNotMatch(sample.prompt, /hasNatalMarsNeptuneCreativeAffliction|natalMarsNeptuneCreativeAfflictionContacts|something very like genius/u);

    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point,
      normalizedPayload: { ...p, ...changes } }]).find(passage).confirmations[4];
    assert.equal(evaluate({}).hits.length, Number(qualified), birth);
    assert.equal(evaluate({ hasNatalMarsNeptuneCreativeAffliction: undefined }).unknown, true, birth);
    assert.equal(evaluate({ natalTargetHouse: 8 }).hits.length, 0, birth);
    assert.equal(evaluate({ targetKind: 'progressed' }).hits.length, 0, birth);
    assert.equal(evaluate({ isMarsNeptuneConjunctionPoint: false }).hits.length, 0, birth);
  }
});

test('p047 uses independent natal Jupiter art support only at the real first-house conjunction', () => {
  const passage = row => row.knowledgeId.includes('-p047-');
  const art = /本命盘的木海合相、六合或三分为已核艺术背景/u;
  for (const [armc, house] of [[120, 1], [0, 5]]) {
    const sample = annualReport('1968-11-15', 2062, '00:00:00', armc);
    const point = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal'
      && p.aspectType === 'conjunction' && p.isMarsNeptuneConjunctionPoint);
    assert.ok(point);
    const p = point.normalizedPayload;
    assert.equal(p.natalTargetHouse, house);
    assert.deepEqual(p.natalNeptuneCreativeTestimonies, []);
    assert.equal(p.hasNatalMarsNeptuneCreativeAffliction, false);
    assert.deepEqual(p.natalNeptuneJupiterArtisticContacts.map(({ other, aspect }) => [other, aspect]), [['Jupiter', 'sextile']]);
    const separation = Math.abs((longitude('Jupiter', sample.birth) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 60) < 7);
    const at = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    const progression = Math.abs((longitude('Mars', at) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(progression < 0.00001);
    const match = sample.matches.find(passage);
    assert.deepEqual(match.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    assert.equal(art.test(sample.prompt), house === 1);
    assert.doesNotMatch(sample.prompt, /natalNeptuneJupiterArtisticContacts|hasNatalNeptuneJupiterArtisticContact/u);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point,
      normalizedPayload: { ...p, ...changes } }]).find(passage).confirmations
      .find(row => row.sourceConditions.some(condition => art.test(condition)));
    assert.equal(evaluate({}).hits.length, Number(house === 1));
    assert.equal(evaluate({ isMarsNeptuneConjunctionPoint: false }).hits.length, 0);
    assert.equal(evaluate({ hasNatalMarsNeptuneCreativeAffliction: true }).hits.length, 0);
    assert.equal(evaluate({ targetKind: 'progressed' }).hits.length, 0);
  }
});

test('p047 confirms third-house writing from a clean natal Mercury–Neptune contact only at the exact conjunction', () => {
  const passage = row => row.knowledgeId.includes('-p047-');
  const writing = /若本人实际从事写作或诗歌，可参考同作者所述的诗性思考和表达倾向/u;
  for (const [armc, house] of [[0, 3], [300, 5]]) {
    const sample = annualReport('1940-08-08', 1989, '00:00:00', armc);
    const point = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune' && p.aspectType === 'conjunction'
      && p.isMarsNeptuneConjunctionPoint);
    assert.ok(point?.exactInstant?.startsWith('1989-07-26'));
    const p = point.normalizedPayload;
    assert.equal(p.natalTargetHouse, house);
    assert.deepEqual(p.natalMarsNeptuneWritingContacts.map(row => [row.other, row.aspect]), [['Mercury', 'sextile']]);
    assert.deepEqual(p.natalNeptuneCreativeTestimonies, []);
    assert.equal(p.hasNatalMarsNeptuneWritingAffliction, false);
    const natalDelta = Math.abs((longitude('Mercury', sample.birth) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(natalDelta - 60) < 7);
    const epoch = progressionEpoch(sample.birth, Date.parse(point.exactInstant));
    assert.ok(Math.abs((longitude('Mars', epoch) - longitude('Neptune', sample.birth) + 540) % 360 - 180) < 0.00001);
    const result = sample.matches.find(passage);
    assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    assert.equal(Date.parse(point.activeTo) - Date.parse(point.activeFrom), 1_000);
    assert.equal(writing.test(sample.prompt), house === 3);
    assert.doesNotMatch(sample.prompt, /natalMarsNeptuneWritingContacts|hasNatalMarsNeptuneWritingAffliction|something very like genius/u);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...point,
      normalizedPayload: { ...p, ...changes } }]).find(passage).confirmations
      .find(row => row.sourceConditions.some(condition => writing.test(condition)));
    assert.equal(evaluate({}).hits.length, Number(house === 3));
    for (const changes of [{ hasNatalMarsNeptuneWritingAffliction: true }, { hasNatalMarsNeptuneWritingContact: false },
      { targetKind: 'progressed' }, { isMarsNeptuneConjunctionPoint: false }]) assert.equal(evaluate(changes).hits.length, 0);
    if (house === 3) assert.equal(evaluate({ hasNatalMarsNeptuneWritingAffliction: undefined }).unknown, true);
  }
});

test('p047 admits an actual conjunction before a named house cusp only inside the source five degrees', () => {
  const passage = row => row.knowledgeId.includes('-p047-');
  const cases = [
    ['1940-08-08', 1989, 28, 2, 3, true, /宫头之前的海王星.*诗性思考/su],
    ['1940-08-08', 1989, 29, 2, 3, false, /宫头之前的海王星.*诗性思考/su],
    ['1968-11-15', 2062, 148, 12, 1, true, /宫头之前的海王星.*木海合相、六合或三分/su],
    ['1946-06-18', 2008, 219, 8, 9, true, /宫头之前的海王星.*思想或信念主题/su],
  ];
  for (const [birth, year, armc, fromHouse, nextHouse, inside, prose] of cases) {
    const sample = annualReport(birth, year, '00:00:00', armc);
    const point = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mars' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal'
      && p.aspectType === 'conjunction' && p.isMarsNeptuneConjunctionPoint);
    assert.ok(point, birth);
    const p = point.normalizedPayload;
    assert.equal(p.natalTargetHouse, fromHouse);
    assert.equal(p.natalMarsNeptuneApproachedHouse, inside ? nextHouse : undefined);
    if (inside) {
      const { distance, cuspLongitude } = p.marsNeptuneCuspApproach;
      assert.ok(distance > 0 && distance < 5);
      assert.ok(Math.abs((cuspLongitude - longitude('Neptune', sample.birth) + 360) % 360 - distance) < 1e-6);
      assert.match(formatFortuneFactAudit(sample.input), /按 Leo 与 Green 的宫头口径另核后宫主题/u);
    } else assert.equal(p.marsNeptuneCuspApproach, undefined);
    const result = sample.matches.find(passage);
    assert.equal(result.status, 'matched', birth);
    assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
    assert.equal(prose.test(sample.prompt), inside, birth);
    assert.doesNotMatch(sample.prompt, /marsNeptuneCuspApproach|按 Leo 与 Green 的宫头口径另核后宫主题/u);
  }
});

test('p106 confirms named natal Venus and Jupiter afflictions within the observed Mercury–Neptune parallel', () => {
  const passage = row => row.knowledgeId.includes('-p106-');
  const condition = /选择容易受一时的情绪或感官冲动影响/u;
  for (const [birth, counterpart] of [['1940-01-17', 'Jupiter'], ['1940-02-02', 'Venus']]) {
    const sample = annualReport(birth, 2026);
    const band = sample.run.facts.find(({ factType, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && p.progressedBody === 'Mercury' && p.natalTargetId === 'Neptune' && p.targetKind === 'natal'
      && p.aspectType === 'parallel' && p.mercuryNeptuneParallelBandObserved);
    assert.ok(band, birth);
    const p = band.normalizedPayload;
    assert.deepEqual(p.natalNeptuneParallelOverindulgenceContacts, []);
    assert.ok(p.natalNeptuneParallelVenusJupiterAdverseContacts.some(({ first, second, aspect }) =>
      [first, second].includes(counterpart) && aspect === 'opposition'));
    const separation = Math.abs((longitude(counterpart, sample.birth) - longitude('Neptune', sample.birth) + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 180) < 8);
    const midpoint = (Date.parse(band.activeFrom) + Date.parse(band.activeTo)) / 2;
    const moving = readLeoMovingPosition('Mercury', progressionEpoch(sample.birth, midpoint));
    const fixed = readLeoMovingPosition('Neptune', sample.birth);
    assert.ok(Math.abs(Math.abs(moving.declination) - Math.abs(fixed.declination)) < 1, birth);
    assert.ok(sample.matches.find(passage).sourceFactIds.includes(band.factId));
    assert.match(sample.prompt, condition);
    assert.doesNotMatch(sample.prompt, /natalNeptuneParallelVenusJupiterAdverseContacts|hasNatalNeptuneParallelVenusJupiterAdverseContact/u);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...band,
      normalizedPayload: { ...p, ...changes } }]).find(passage).confirmations.find(query =>
      JSON.parse(query.condition).where.hasNatalNeptuneParallelVenusJupiterAdverseContact === true);
    assert.equal(evaluate({}).hits.length, 1);
    assert.equal(evaluate({ mercuryNeptuneParallelBandObserved: false }).hits.length, 0);
    assert.equal(evaluate({ hasNatalNeptuneParallelVenusJupiterAdverseContact: false }).hits.length, 0);
    assert.equal(evaluate({ hasNatalNeptuneParallelVenusJupiterAdverseContact: undefined }).unknown, true);
  }
});

test('p106 confirms a separate weak caution for the difficult natal Mercury contact in the Mercury–Neptune parallel', () => {
  const passage = row => row.knowledgeId.includes('-p106-');
  const proof = facts => evaluateFortuneRules('western', 'year', facts).find(passage).confirmations.find(query =>
    JSON.parse(query.condition).where.hasNatalNeptuneParallelAdditionalAfflictionContact === true);
  const cases = [['1943-07-06', '2026-01-08T00:00:00.000Z', true], ['1961-11-23', '2026-01-08T00:00:00.000Z', false]];
  for (const [birth, time, hasContact] of cases) {
    const sample = annualReport(birth, 2026, '12:00:00');
    const band = sample.run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
      factType === 'leo_progressed_aspect' && p.mercuryNeptuneParallelBandObserved && activeFrom <= time && time < activeTo);
    assert.ok(band, birth);
    const p = band.normalizedPayload;
    assert.deepEqual(p.natalNeptuneParallelOverindulgenceContacts, []);
    assert.deepEqual(p.natalNeptuneParallelVenusJupiterAdverseContacts, []);
    assert.equal(p.hasNatalNeptuneParallelAdditionalAfflictionContact, hasContact);
    assert.deepEqual(p.natalNeptuneParallelAdditionalAfflictionContacts.map(row => [row.first, row.second, row.aspect]),
      hasContact ? [['Mercury', 'Neptune', 'square']] : []);
    const epoch = progressionEpoch(sample.birth, Date.parse(time));
    const moving = readLeoMovingPosition('Mercury', epoch), target = readLeoMovingPosition('Neptune', sample.birth);
    assert.ok(Math.abs(Math.abs(moving.declination) - Math.abs(target.declination)) < 1);
    assert.deepEqual(proof([band]).hits, hasContact ? [band] : []);
    if (!hasContact) continue;
    const mercury = longitude('Mercury', sample.birth);
    const gap = Math.abs(Math.abs((mercury - target.longitude + 540) % 360 - 180) - 90);
    assert.ok(Math.abs(gap - 0.784565) < 0.00001);
    const changed = changes => ({ ...band, normalizedPayload: { ...p, ...changes } });
    assert.deepEqual(proof([changed({ targetKind: 'progressed' }), changed({ mercuryNeptuneParallelBandObserved: false })]).hits, []);
    assert.equal(proof([changed({ hasNatalNeptuneParallelAdditionalAfflictionContact: undefined })]).unknown, true);
    const isolated = { ...sample.run, facts: [band] };
    const match = matchFortuneKnowledge(isolated).byMethod.western.find(passage);
    assert.deepEqual(match.windows, [{ start: band.activeFrom, endExclusive: band.activeTo }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p106-additional-affliction'));
    const dynamic = /本命水星与本命海王星为四分相/u;
    assert.match(formatFortuneFactAudit(input), dynamic);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /if the natal aspects to Neptune predispose thereto/u);
    assert.doesNotMatch(provider, dynamic);
    assert.doesNotMatch(provider, /natalNeptuneParallelAdditionalAfflictionContacts|hasNatalNeptuneParallelAdditionalAfflictionContact/u);
  }
});

for (const [passage, moving, target, aspect, birth, expectedAt, status, lunarAt] of [
  ['p078', 'Mercury', 'Jupiter', 'semisextile', '1966-03-22', '2026-04-25T08:53:12.297Z', 'matched'],
  ['p078', 'Mercury', 'Jupiter', 'semisextile', '1960-08-20', '2026-10-10T15:41:55.759Z', 'not_matched'],
  ['p059', 'Mars', 'Saturn', 'semisquare', '1961-09-21', '2026-08-02T12:51:37.815Z', 'matched', '2026-07-19T02:15:30.652Z'],
  ['p059', 'Mars', 'Saturn', 'semisquare', '1945-04-19', '2026-09-16T04:43:15.300Z', 'matched'],
  ['p059', 'Mars', 'Saturn', 'semisquare', '1960-01-23', '2026-01-14T01:02:48.201Z', 'matched', '2026-08-29T12:40:46.545Z'],
]) {
  test(`${passage} distinguishes the real mutual point from concurrent support for ${birth}`, () => {
    const sample = annualReport(birth, 2026, '12:00:00');
    const result = sample.matches.find(row => row.knowledgeId.includes(`-${passage}-`));
    assert.equal(result.status, status, birth);
    const geometry = ({ normalizedPayload: p }) => p.progressedBody === moving && p.natalTargetId === target
      && p.aspectType === aspect && p.targetKind === 'natal';
    const point = sample.run.facts.find(fact => fact.factType === 'leo_mutual_exact_observation' && geometry(fact));
    assert.equal(point?.exactInstant, expectedAt, birth);
    const slices = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && geometry(fact));
    const active = slices.filter(fact => fact.activeFrom <= expectedAt && expectedAt < fact.activeTo);
    assert.equal(active.length, 1, birth);
    assert.deepEqual(slices.filter(row => row.normalizedPayload.mutualExactInSlice), active, birth);
    const [witness] = active;
    assert.equal(result.sourceFactIds.includes(witness.factId), status === 'matched', birth);
    const p = witness.normalizedPayload;
    if (passage === 'p059') {
      assert.equal(witness.activeFrom, expectedAt);
      assert.equal(Date.parse(witness.activeTo) - Date.parse(expectedAt), 1_000);
    }
    if (lunarAt) {
      const lunar = slices.find(row => row.activeFrom === lunarAt);
      const hasSolarWitness = birth === '1961-09-21';
      assert.ok(lunar, birth);
      assert.equal(Date.parse(lunar.activeTo) - Date.parse(lunarAt), 1_000);
      assert.equal(lunar.normalizedPayload.mutualExactInSlice, false);
      assert.deepEqual(lunar.normalizedPayload.exactLunarLinkedBodies, [hasSolarWitness ? 'Mars' : 'Saturn']);
      assert.equal(lunar.normalizedPayload.pairLuminaryLinksComplete, hasSolarWitness);
      assert.ok(result.sourceFactIds.includes(lunar.factId));
      const before = slices.find(row => row.activeTo === lunarAt);
      assert.deepEqual(before.normalizedPayload.exactLunarLinkedBodies, []);
      assert.ok(!result.sourceFactIds.includes(before.factId));
      const at = progressionEpoch(sample.birth, Date.parse(lunarAt));
      const moon = longitude('Moon', at), endpoint = hasSolarWitness ? longitude('Mars', at) : longitude('Saturn', sample.birth);
      assert.ok(Math.abs(Math.abs((moon - endpoint + 540) % 360 - 180) - (hasSolarWitness ? 150 : 120)) < 0.00001);
      const audit = formatFortuneFactAudit(sample.input);
      const exactBody = hasSolarWitness ? '次限火星' : '本命土星';
      assert.ok(audit.includes(`火土半刑有效段内查到次限月亮与${exactBody}的精确成相`));
      assert.doesNotMatch(sample.prompt, /火土半刑有效段内查到|exactLunarLinkedBodies/u);
      if (!hasSolarWitness) {
        const assess = update => evaluateFortuneRules('western', 'year',
          [{ ...lunar, normalizedPayload: { ...lunar.normalizedPayload, ...update } }])
          .find(row => row.knowledgeId === result.knowledgeId).required[0];
        assert.deepEqual(assess({ exactLunarLinkedBodies: [] }).hits, []);
        assert.equal(assess({ exactLunarLinkedBodies: [] }).unknown, false);
        assert.equal(assess({ exactLunarLinkedBodies: undefined }).unknown, true);
        assert.deepEqual(assess({ targetKind: 'progressed' }).hits, []);
      }
    }
    if (passage === 'p078') {
      assert.deepEqual([p.correspondenceDirectionState, p.friendshipDirectionState, p.travelDirectionState],
        [status === 'matched' ? 'favourable' : 'none', 'none', 'none'], birth);
      if (status === 'matched') assert.ok(p.correspondenceDirections.some(direction => direction.passage === 'p245'));
    } else {
      const bothLuminaries = birth !== '1960-01-23';
      assert.equal(p.pairLuminaryLinksComplete, bothLuminaries, birth);
      const single = { ...sample.run, facts: [witness] };
      const { input } = buildFortuneModelContext(single, interpretFortune(single, requestForFortuneRun(single), 'leo-p059-single'));
      const provider = formatFortunePrompt(input);
      if (!bothLuminaries) assert.match(provider, /本次只采用弱背景/u);
      else if (birth === '1961-09-21') assert.match(provider, /仅对照应与同期偏难条件均已核实的片段/u);
      assert.doesNotMatch(provider, /exactAdverseMoonTo|同段次限月亮也接触相关火土/u);
      if (birth === '1945-04-19') {
        assert.deepEqual(p.luminaryLinks, ['Moon', 'Sun'].map(body =>
          ({ body, target: 'Saturn', targetKind: 'natal', aspectType: 'parallel' })));
        assert.deepEqual([p.sameLayerLunarState, p.directionSupportState], ['conditional', 'favourable']);
        const at = Math.round(progressionEpoch(sample.birth, Date.parse(expectedAt)));
        const saturn = readLeoMovingPosition('Saturn', sample.birth);
        const mars = readLeoMovingPosition('Mars', at);
        assert.ok(Math.abs(Math.abs((mars.longitude - saturn.longitude + 540) % 360 - 180) - 45) < 1e-6);
        for (const body of ['Moon', 'Sun']) {
          const luminary = readLeoMovingPosition(body, at);
          assert.ok(Math.abs(Math.abs(luminary.declination) - Math.abs(saturn.declination)) <= 1);
        }
        return;
      }
      assert.deepEqual(p.luminaryLinks, bothLuminaries ? [
        { body: 'Moon', target: 'Mars', targetKind: 'progressed', aspectType: 'quincunx' },
        { body: 'Sun', target: 'Saturn', targetKind: 'natal', aspectType: 'parallel' },
      ] : [], birth);
      if (bothLuminaries) assert.equal(p.directionSupportState, 'adverse');
      else {
        const neighbors = slices.filter(row => row.activeFrom === witness.activeTo || row.activeTo === witness.activeFrom);
        assert.equal(neighbors.length, 2);
        assert.ok(neighbors.every(row => !result.sourceFactIds.includes(row.factId)));
        assert.ok(!p.hasExactAdverseMoonToNatalEndpoint && !p.hasExactAdverseMoonToProgressedEndpoint);
      }
    }
  });
}

test('p086 requires favourable support inside the original one-degree Mercury–Jupiter parallel', () => {
  const sample = annualReport('1965-03-30', 2026, '12:00:00');
  const result = sample.matches.find(row => row.knowledgeId.includes('-p086-'));
  assert.equal(result.status, 'matched');
  const geometry = ({ normalizedPayload: p }) => p.progressedBody === 'Mercury' && p.natalTargetId === 'Jupiter'
    && p.aspectType === 'parallel' && p.targetKind === 'natal';
  const facts = sample.run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && geometry(fact));
  const lunar = facts.find(({ normalizedPayload: p }) => p.sameLayerLunarState === 'all_favourable' && p.directionSupportState === 'none');
  const wrongLayer = facts.find(({ normalizedPayload: p }) => p.progressedState === 'all_favourable'
    && p.sameLayerLunarState === 'none' && p.directionSupportState === 'none');
  const adverse = facts.find(({ normalizedPayload: p }) => p.sameLayerLunarState === 'all_adverse' && p.directionSupportState === 'none');
  assert.ok(lunar && wrongLayer && adverse);
  assert.equal(lunar.normalizedPayload.allowedOrb, 1);
  assert.equal(lunar.normalizedPayload.coordinate, 'equatorial_declination_of_date');
  assert.ok(result.sourceFactIds.includes(lunar.factId));
  assert.ok(!result.sourceFactIds.includes(wrongLayer.factId) && !result.sourceFactIds.includes(adverse.factId));
  assert.ok(!sample.run.facts.some(fact => fact.factType === 'leo_progressed_aspect_exact' && geometry(fact)));

  const solarSample = annualReport('1964-01-10', 2026, '12:00:00');
  const solarMatch = solarSample.matches.find(row => row.knowledgeId.includes('-p086-'));
  const solar = solarSample.run.facts.find(fact => fact.factType === 'leo_lunar_condition' && geometry(fact)
    && fact.activeFrom <= '2026-11-15T00:00:00.000Z' && '2026-11-15T00:00:00.000Z' < fact.activeTo);
  assert.equal(solar.normalizedPayload.sameLayerLunarState, 'all_adverse');
  assert.equal(solar.normalizedPayload.directionSupportState, 'favourable');
  assert.ok(solar.normalizedPayload.supportingDirections.some(direction => direction.passage === 'p288' && direction.body === 'Sun'));
  assert.equal(solarMatch.status, 'matched');
  assert.ok(solarMatch.sourceFactIds.includes(solar.factId));
});
