import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SiderealTime, SunPosition, MakeTime, e_tilt } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { splitLeoLunarHouses, buildLeoLunarHouses, leoLunarHousePolicy, leoAnnualLunarHouseBands } = await import('./control/leo-lunar-houses.ts');
const { anglesFromFrame, calculateHouseCusps, progressedHouseFrame, zodiacalHouse,
  buildWesternSourceHouses, scanProgressedMoonHouses } = await import('./control/western-houses.ts');
const { progressionEpoch, readProgressionPosition, buildWesternProgressions } = await import('./control/western-progressions.ts');
const { buildLeoSourceContext, readLeoMovingPosition } = await import('./control/leo-source-context.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const day = 86400000, iso = at => new Date(at).toISOString();
const cusps = Array.from({ length: 12 }, (_, i) => (180 + i * 30) % 360);
const natal = { dayChart: true, bodies: [
  { body: 'Mercury', longitude: 65, declination: 5, sign: 2, house: 9 },
  { body: 'Moon', longitude: 75, declination: -7, sign: 2, house: 9 },
  { body: 'Sun', longitude: 300, declination: -20, sign: 10, house: 5 },
] };
function contact(progressedBody, start, end, exactTimes = []) {
  return { progressedBody, natalTargetId: 'Venus', aspectType: 'trine', coordinate: 'ecliptic_longitude', allowedOrb: 1,
    start: start * day, end: end * day, exactTimes: exactTimes.map(at => at * day) };
}

test('all twelve house correspondences stay distinct from actual cusp signs and do not classify prominence', () => {
  for (let house = 1; house <= 12; house++) {
    const rows = splitLeoLunarHouses({ start: 0, end: day }, [{ start: 0, end: day, house: house }], [], natal, cusps);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.house, house); assert.equal(row.naturalSign, house - 1);
    assert.equal(row.cuspSign, (house + 5) % 12); assert.notEqual(row.cuspSign, row.naturalSign);
    assert.deepEqual(row.naturalSignBodies, natal.bodies.filter(body => body.sign === house - 1).map(body => body.body));
    assert.deepEqual(row.natalHouseBodies, natal.bodies.filter(body => body.house === house).map(body => body.body));
    assert.equal(row.prominent, undefined); assert.equal(row.good, undefined); assert.equal(row.geometryOnly, true);
    assert.deepEqual(row.lunarAspects, []); assert.deepEqual(row.solarAspects, []); assert.deepEqual(row.mutualAspects, []);
    if (house === 3) assert.deepEqual(row.mercurySeparations, [{ body: 'Moon', longitudeSeparation: 10, absoluteDeclinationDifference: 2 },
      { body: 'Sun', longitudeSeparation: 125, absoluteDeclinationDifference: 15 }]);
    else assert.equal(row.mercurySeparations, undefined);
  }
});

test('every active and inactive aspect boundary partitions its actual lunar-house interval; exact points occur in one half-open fragment', () => {
  const aspects = [contact('Moon', 2, 6, [3, 4]), contact('Sun', 4, 8, [6]), contact('Venus', 3, 5, [4]), contact('Mars', 10, 12, [11])];
  const rows = splitLeoLunarHouses({ start: 0, end: 10 * day }, [{ start: -day, end: 12 * day, house: 3 }], aspects, natal, cusps);
  assert.deepEqual(rows.map(row => row.start / day), [0, 2, 3, 4, 5, 6, 8]);
  assert.deepEqual(rows.map(row => row.end / day), [2, 3, 4, 5, 6, 8, 10]);
  for (const row of rows) {
    const actual = [...row.lunarAspects, ...row.solarAspects, ...row.mutualAspects];
    assert.deepEqual(actual.map(a => a.sourceBandIndex).sort(), aspects.flatMap((a, i) => a.start <= row.start && row.end <= a.end ? [i] : []));
    assert.ok(actual.every(a => a.exactTimes.every(at => row.start <= at && at < row.end)));
  }
  for (const [index, aspect] of aspects.entries()) assert.deepEqual(rows.flatMap(row =>
    [...row.lunarAspects, ...row.solarAspects, ...row.mutualAspects].filter(a => a.sourceBandIndex === index).flatMap(a => a.exactTimes)),
    aspect.exactTimes.filter(at => 0 <= at && at < 10 * day));
  assert.deepEqual(rows[0].lunarAspects, []);
  assert.deepEqual(rows.at(-1).solarAspects, []);
});

test('disjoint house fragments cannot borrow aspects from another house or bridge an uncomputed gap', () => {
  const rows = splitLeoLunarHouses({ start: 0, end: 10 * day }, [
    { start: 0, end: 3 * day, house: 5 }, { start: 7 * day, end: 10 * day, house: 7 }],
  [contact('Moon', 4, 6), contact('Sun', 8, 9)], natal, cusps);
  assert.ok(rows.every(row => row.end <= 3 * day || row.start >= 7 * day));
  assert.ok(rows.every(row => row.lunarAspects.length === 0));
  assert.ok(rows.filter(row => row.solarAspects.length).every(row => row.house === 7));
  assert.equal(buildLeoLunarHouses({ start: 0, end: day }, { status: 'uncertain' }, { status: 'ready' }).status, 'unavailable');
  assert.equal(buildLeoLunarHouses({ start: 0, end: day }, { moon: [], placidus: { status: 'ready', cusps } }, { status: 'unavailable' }).status, 'unavailable');
  assert.throws(() => splitLeoLunarHouses({ start: 0, end: day }, [{ start: 0, end: day, house: 13 }], [], natal, cusps));
});

test('same named aspect in different frames keeps its own active period and original lunar classification', () => {
  const aspects = [
    { ...contact('Moon', 0, 2, [1]), targetKind: 'natal' },
    { ...contact('Moon', 2, 4, [2]), targetKind: 'progressed' },
    { ...contact('Moon', 2, 4), natalTargetId: 'Mars', aspectType: 'square', targetKind: 'progressed' },
    { ...contact('Moon', 2, 4), natalTargetId: 'Mercury', aspectType: 'conjunction', targetKind: 'natal' },
  ];
  const rows = splitLeoLunarHouses({ start: 0, end: 4 * day }, [{ start: 0, end: 4 * day, house: 7 }], aspects, {
    ...natal, bodies: [...natal.bodies, { body: 'Venus', longitude: 20, declination: 8, sign: 0 },
      { body: 'Mars', longitude: 320, declination: -13, sign: 10 }],
  }, cusps);
  assert.deepEqual(rows.map(row => row.lunarAspects.map(aspect => [aspect.targetKind, aspect.nature])),
    [[['natal', 'favourable']], [['progressed', 'favourable'], ['progressed', 'adverse'], ['natal', 'conditional']]]);
  assert.deepEqual(rows[1].lunarAspects[0].exactTimes, [2 * day]);
  assert.deepEqual(rows[1].rulerPair, { first: 'Venus', seventh: 'Mars', longitudeSeparation: 60,
    absoluteDeclinationDifference: 5 });
  assert.equal(rows[0].seventhRulerAspectsReady, undefined);
  assert.equal(rows[0].hasFavourableNatalTargetWithoutAffliction, undefined);
  assert.deepEqual(rows.map(row => row.lunarAspectNatures), [['favourable'], ['conditional']]);
  assert.deepEqual(rows.map(row => row.lunarExactAspectNatures), [['favourable'], []]);
  const text = describeFortuneFact({ method: 'western', type: 'leo_lunar_house_context', data: rows[1] }, iso);
  assert.match(text, /对同图次限火星形成四分相.+原书月亮篇偏难/u);
  assert.match(text, /对本命水星形成合相.+原书取义依情境/u);
  assert.match(text, /本命一宫主为金星，七宫主为火星/u);
});

test('ninth-house testimony follows the current anniversary ruler and never borrows the other chart or a prior year', () => {
  const window = { start: 0, end: 10 * day };
  const houses = [{ ...window, house: 9 }];
  const positions = [['Venus', 10], ['Mars', 200], ['Jupiter', 116], ['Saturn', 220], ['Uranus', 37], ['Neptune', 280]];
  const fullNatal = { ...natal, bodies: [...natal.bodies, ...positions.map(([body, longitude]) =>
    ({ body, longitude, declination: 0, sign: Math.floor(longitude / 30) }))] };
  const frames = [30, 60].map((shift, i) => ({ annualStart: i * 4 * day, annualEnd: (i + 1) * 4 * day,
    cusps: cusps.map(degree => (degree + shift) % 360) }));
  const bands = [
    { ...contact('Moon', 0, 10), natalTargetId: 'Sun', targetKind: 'natal' },
    { ...contact('Mars', 1, 6), natalTargetId: 'Moon', targetKind: 'progressed' },
    { ...contact('Moon', 6, 8), natalTargetId: 'Sun', targetKind: 'progressed' },
    { ...contact('Sun', 6, 8), natalTargetId: 'Moon', targetKind: 'progressed' },
  ];
  const split = birth => splitLeoLunarHouses(window, houses, bands, birth, cusps, undefined, frames);
  const rows = split(fullNatal);
  assert.deepEqual(rows.map(row => [row.start / day, row.end / day, row.ninthRulers?.progressedRuler, row.hasNinthRulerTestimony]),
    [[0, 1, 'Moon', false], [1, 4, 'Moon', true], [4, 6, 'Sun', false], [6, 8, 'Sun', true], [8, 10, undefined, undefined]]);
  assert.ok(rows.slice(0, 4).every(({ ninthRulers }) => ninthRulers.natalRuler === 'Mercury'
    && ninthRulers.natalAspects.length > 0 && ninthRulers.natalAspects.every(a => [a.first, a.second].includes('Mercury'))));
  assert.deepEqual(rows[3].ninthRulers.progressedAspects, [{ body: 'Moon', target: 'Sun', targetKind: 'progressed', aspectType: 'trine' }]);
  const evaluate = row => passage(evaluateFortuneRules('western', 'year', [{
    factType: 'leo_lunar_house_context', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...row, progressionPolicy: 'secondary-utc-calendar-month-v1' },
  }]), 'p141').required[0];
  assert.deepEqual(rows.map(row => evaluate(row).hits.length), [1, 1, 1, 1, 1]);
  assert.equal(rows[4].hasNinthRulerTestimony, undefined);
  assert.equal(split(natal)[1].hasNinthRulerTestimony, undefined);
  assert.equal(evaluate(split(natal)[1]).hits.length, 1);
});

test('Leo chapter VII annual chart reproduces the printed sidereal time and switches only at the next anniversary', () => {
  // Printed pp. 34–37, Westminster local mean time within half a minute of Greenwich.
  const timestamp = Date.parse('1860-08-07T05:49:00Z');
  const window = { start: Date.parse('1906-08-06T00:00:00Z'), end: Date.parse('1906-08-09T00:00:00Z') };
  const armc = SiderealTime(new Date(timestamp)) * 15;
  const frame = { birthAt: timestamp, armc, latitude: 51.5 };
  const pieces = leoAnnualLunarHouseBands(window, frame);
  assert.equal(pieces.length, 2);
  const change = Date.parse('1906-08-07T05:49:00Z');
  assert.equal(pieces[0].bands.at(-1).end, change);
  assert.equal(pieces[1].bands[0].start, change);
  assert.equal(pieces[0].annualEnd, pieces[1].annualStart);
  // Printed sidereal time 5h 54m 16s; compare the modern midheaven to the printed 28°41′ Gemini.
  assert.ok(Math.abs(pieces[1].cusps[9] - (60 + 28 + 41 / 60)) < 0.25);
  assert.notDeepEqual(pieces[0].cusps, pieces[1].cusps);
  for (const piece of pieces) for (const band of piece.bands) {
    const at = (band.start + band.end) / 2;
    assert.equal(band.house, zodiacalHouse(readProgressionPosition('Moon', progressionEpoch(timestamp, at), timestamp).longitude, piece.cusps));
  }
});

const born = Date.parse('1990-01-01T04:00:00Z');
function chart(armc = 290, birthAt = born) {
  const epoch = new Date(birthAt);
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birthAt / day + 2440587.5, ...anglesFromFrame(armc, 35, e_tilt(MakeTime(epoch)).tobl),
      positions: Object.values(Body).filter(planet => ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(planet))
        .map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(epoch).elon : Ecliptic(GeoVector(planet, epoch, true)).elon })),
    }] } };
}
const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026 } };
const asOf = Date.parse('2026-11-19T00:00:00Z');
function calculate(snapshot) {
  return calculateFortuneFacts(params, buildFactTimeContext(params, asOf, 'server'), 'lunar-house-run',
    { snapshotId: 'lunar-house-snapshot', chart: snapshot });
}
const cached = new Map();
function realRun(armc = 290) {
  if (!cached.has(armc)) cached.set(armc, calculate(chart(armc)));
  return cached.get(armc);
}
const facts = run => run.facts.filter(f => f.factType === 'leo_lunar_house_context');
const crossings = run => run.facts.filter(f => f.factType === 'leo_lunar_ascendant_crossing');
const passage = (rows, id) => rows.find(row => row.knowledgeId.endsWith('-leo-1906-interpretation-' + id + '-001'));

function assertSharedHousePoints(run, matches, id, house) {
  const match = passage(matches, id);
  const otherPassages = ['p137', 'p142', 'p143'].filter(p => p !== id);
  assert.ok(otherPassages.every(other => passage(matches, other).status === 'not_matched'));
  const houseFacts = facts(run).filter(row => match.sourceFactIds.includes(row.factId));
  assert.ok(houseFacts.length && houseFacts.every(({ normalizedPayload: p }) =>
    p.house === house && p.targetKind === 'natal' && p.houseSystem === 'placidus'));
  for (const [date, target, aspect, nature] of [
    ['2026-01-31', 'Sun', 'sextile', 'favourable'], ['2026-07-08', 'Venus', 'square', 'adverse'],
  ]) {
    const witness = houseFacts.find(({ normalizedPayload: p }) => p.lunarAspects.some(contact =>
      contact.targetKind === 'natal' && contact.natalTargetId === target && contact.aspectType === aspect
      && contact.exactTimes.some(at => at.startsWith(date))));
    assert.ok(witness?.normalizedPayload.lunarExactAspectNatures.includes(nature), id);
  }
}

function assertProviderHouseFinding(input, match) {
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
  assert.ok(finding?.originalText && finding.note, match.knowledgeId);
  const prompt = formatFortunePrompt(input);
  assert.ok(prompt.includes('原文：' + finding.originalText.trim()), match.knowledgeId);
  assert.ok(prompt.includes('现代释义：' + finding.note.trim()), match.knowledgeId);
}

function assertProjectedHouseBranches(input, references, match, house) {
  assertProviderHouseFinding(input, match);
  const houseFacts = input.facts.filter(fact => match.sourceFactIds.includes(references.get(fact.ref)) && fact.type === 'leo_lunar_house_context'
    && fact.data.house === house && fact.data.targetKind === 'natal');
  for (const nature of ['favourable', 'adverse']) {
    assert.ok(houseFacts.some(fact => fact.data.lunarExactAspectNatures?.includes(nature)), nature);
  }
}

function submitLocatedChart(snapshotId, birthInstant, longitude, timeZone) {
  const timestamp = Date.parse(birthInstant), latitude = 35;
  const armc = (SiderealTime(new Date(timestamp)) * 15 + longitude + 360) % 360;
  const snapshot = chart(armc, timestamp);
  snapshot.birthContext = { precision: 'minute', birthInstant, latitude, longitude, timeZone, clockVersion: 'gregory-iana-intl-v1' };
  const reference = { snapshotId, chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
  validateFortuneFacts(run);
  return run;
}

test('Leo p286 uses actual lunar research houses only in the matching Sun–Uranus parallel layer', () => {
  const samples = [
    { birth: '1955-03-20T04:00:00Z', lon: -60, zone: 'Etc/GMT+4', layer: 'natal',
      from: 9, to: 10, day: '2026-03-16', otherHouse: 7, profile: 'leo-original-natal' },
    { birth: '1955-03-20T12:00:00Z', lon: 150, zone: 'Etc/GMT-10', layer: 'progressed',
      from: 8, to: 9, day: '2026-11-05', otherHouse: 11, profile: 'leo-1906-annual-progressed-house-v1' },
  ];
  for (const { birth, lon, zone, layer, from, to, day: crossingDay, otherHouse, profile } of samples) {
    const run = submitLocatedChart(`leo-p286-moon-in-house-${layer}`, birth, lon, zone);
    const otherLayer = layer === 'natal' ? 'progressed' : 'natal';
    const houses = facts(run);
    const entering = houses.find(({ activeFrom, normalizedPayload: p }) =>
      activeFrom.startsWith(crossingDay) && p.targetKind === layer && p.house === to);
    assert.ok(entering, `${layer} house ${to}`);
    const crossing = entering.activeFrom;
    assert.ok(houses.some(({ activeTo, normalizedPayload: p }) => activeTo === crossing && p.house === from && p.targetKind === layer));
    assert.ok(houses.some(({ activeFrom, activeTo, normalizedPayload: p }) =>
      activeFrom <= crossing && crossing < activeTo && p.targetKind === otherLayer && p.house === otherHouse));

    const parallels = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Uranus' && p.aspectType === 'parallel');
    const before = parallels.find(({ activeTo, normalizedPayload: p }) => activeTo === crossing && p.targetKind === layer);
    const after = parallels.find(({ activeFrom, normalizedPayload: p }) => activeFrom === crossing && p.targetKind === layer);
    const other = parallels.find(({ activeFrom, activeTo, normalizedPayload: p }) =>
      activeFrom <= crossing && crossing < activeTo && p.targetKind === otherLayer);
    assert.ok(before && after && other, `${layer} and ${otherLayer} are both in parallel at the crossing`);
    assert.equal(before.normalizedPayload.hasVerifiedUranianMetaphysicalMoonHouse, true);
    assert.equal(before.normalizedPayload.uranianMetaphysicalMoonHouse, from);
    assert.equal(before.normalizedPayload.uranianMetaphysicalMoonHouseProfile, profile);
    assert.equal(before.normalizedPayload.sunUranusParallelBackgroundOnly, false);
    assert.equal(after.normalizedPayload.uranianMetaphysicalMoonHouse, to === 9 ? to : undefined);
    assert.equal(other.normalizedPayload.hasVerifiedUranianMetaphysicalMoonHouse, false);
    assert.equal(other.normalizedPayload.uranianMetaphysicalMoonHouse, undefined);

    const natalAt = Date.parse(birth);
    const natalArmc = (SiderealTime(new Date(natalAt)) * 15 + lon + 360) % 360;
    const annualFrame = layer === 'progressed'
      ? progressedHouseFrame(natalAt, Date.parse('2026-03-20T12:00:00Z'), natalArmc, 35) : undefined;
    const actualCusps = layer === 'natal' ? run.facts.find(row => row.factType === 'natal_house_cusps'
      && row.normalizedPayload.houseSystem === 'placidus').normalizedPayload.cusps
      : calculateHouseCusps(annualFrame.armc, 35, annualFrame.obliquity, 'placidus').cusps;
    for (const [offset, expected] of [[-3_600_000, from], [3_600_000, to]]) {
      const epoch = Math.round(progressionEpoch(natalAt, Date.parse(crossing) + offset));
      const moon = readLeoMovingPosition('Moon', epoch);
      const sun = readLeoMovingPosition('Sun', epoch);
      assert.equal(zodiacalHouse(moon.longitude, actualCusps), expected);
      for (const uranusAt of [natalAt, epoch]) {
        const uranus = readLeoMovingPosition('Uranus', uranusAt);
        assert.ok(Math.abs(Math.abs(sun.declination) - Math.abs(uranus.declination)) < 1);
      }
    }
    assert.equal(before.sourceFactIds.filter(id => entering.sourceFactIds.includes(id)).length, 2);
    const researchHits = rows => passage(evaluateFortuneRules('western', 'year', rows), 'p286').confirmations
      .filter(branch => branch.condition.includes('"uranianMetaphysicalMoonHouse"')).flatMap(branch => branch.hits);
    assert.deepEqual(researchHits([before, after, other]).map(row => row.factId),
      (to === 9 ? [before, after] : [before]).map(row => row.factId));
    assert.deepEqual(researchHits([{ ...before, normalizedPayload: { ...before.normalizedPayload, targetKind: otherLayer } }]), []);
    const scoped = { ...run, facts: [before, after, other] };
    const result = passage(matchFortuneKnowledge(scoped).byMethod.western, 'p286');
    const phrase = from === 8 ? '第八宫' : '第九宫';
    const branch = result.confirmedBranches.find(({ conditions }) => conditions[0].includes('月亮实经' + phrase));
    assert.deepEqual(branch.windows, [{ start: before.activeFrom, endExclusive: before.activeTo }]);
    const { input } = buildFortuneModelContext(scoped,
      interpretFortune(scoped, requestForFortuneRun(scoped), scoped.natalChartSnapshotId));
    assert.ok(formatFortuneFactAudit(input).includes('次限月亮实际经过同一' + (layer === 'natal' ? '本命' : '次限') + '盘' + phrase));
    const prompt = formatFortunePrompt(input);
    assert.ok(prompt.includes('月亮实经' + phrase));
    assert.ok(!prompt.includes('uranianMetaphysicalMoonHouse') && !prompt.includes(crossing));
  }
});

test('real ephemerides and twenty-four reliable natal frames reach all twelve physical lunar houses without a whole-sign substitution', () => {
  const window = { start: Date.parse('2026-11-19T00:00:00Z'), end: Date.parse('2026-11-20T00:00:00Z') };
  const progression = buildWesternProgressions(window, window.start, chart());
  const seen = new Set();
  for (let armc = 5; armc < 360; armc += 15) {
    const snapshot = chart(armc), houses = buildWesternSourceHouses(window, snapshot, []);
    const leo = buildLeoSourceContext(window, snapshot, progression), result = buildLeoLunarHouses(window, houses, leo);
    assert.equal(result.status, 'ready');
    assert.ok(result.intervals.length);
    for (const interval of result.intervals) {
      const middle = (interval.start + interval.end) / 2;
      assert.equal(interval.house, zodiacalHouse(readProgressionPosition('Moon', progressionEpoch(born, middle), born).longitude, houses.placidus.cusps));
      seen.add(interval.house);
    }
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index + 1));
});

test('real calculations preserve complete source provenance, physical lunar house membership and each active source aspect in each fragment', () => {
  const run = realRun(); validateFortuneFacts(run); assert.notEqual(run.methods.western.status, 'failed');
  const rows = facts(run); assert.ok(rows.length > 1);
  const cusps = run.facts.find(f => f.factType === 'natal_house_cusps' && f.normalizedPayload.houseSystem === 'placidus').normalizedPayload.cusps;
  const original = run.rawFacts.find(raw => raw.payload.policy?.profile === 'leo-1906-source-context-v1').payload.calculation;
  const houseRaw = run.rawFacts.find(raw => raw.payload.policy?.profile === leoLunarHousePolicy.profile).payload.calculation;
  const originalBands = [...original.intervals, ...original.progressedPairs];
  assert.ok(rows.some(row => row.normalizedPayload.targetKind === 'progressed'));
  assert.ok(rows.some(row => row.normalizedPayload.lunarAspects.some(aspect => aspect.targetKind === 'progressed')));
  for (const row of rows) {
    assert.equal(row.normalizedPayload.profile, leoLunarHousePolicy.profile);
    assert.ok(row.sourceFactIds.length >= 3);
    assert.ok(row.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
    const middle = (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2;
    const moon = readProgressionPosition('Moon', progressionEpoch(born, middle), born);
    const frame = row.normalizedPayload.targetKind === 'natal' ? cusps : houseRaw.annual.find(year =>
      Date.parse(row.normalizedPayload.annualFrameStart) === year.annualStart).cusps;
    assert.equal(zodiacalHouse(moon.longitude, frame), row.normalizedPayload.house);
    const expected = originalBands.flatMap((a, i) => a.start <= Date.parse(row.activeFrom) && Date.parse(row.activeTo) <= a.end ? [i] : []);
    const active = [...row.normalizedPayload.lunarAspects, ...row.normalizedPayload.solarAspects, ...row.normalizedPayload.mutualAspects];
    assert.deepEqual(active.map(a => a.sourceBandIndex).sort((a, b) => a - b), expected);
    assert.ok(active.every(a => a.targetKind === originalBands[a.sourceBandIndex].targetKind));
    assert.ok(active.every(a => a.exactTimes.every(at => row.activeFrom <= at && at < row.activeTo)));
    const sameLayerPoints = row.normalizedPayload.lunarAspects.filter(a =>
      a.targetKind === row.normalizedPayload.targetKind && a.exactTimes.length);
    assert.deepEqual(row.normalizedPayload.lunarExactAspectNatures, [...new Set(sameLayerPoints.map(a => a.nature))]);
  }
  const physical = run.facts.filter(f => f.factType === 'progressed_house');
  for (const house of physical) {
    const corresponding = rows.filter(row => row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.house === house.normalizedPayload.house
      && house.activeFrom <= row.activeFrom && row.activeTo <= house.activeTo).sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    assert.equal(corresponding[0].activeFrom, house.activeFrom); assert.equal(corresponding.at(-1).activeTo, house.activeTo);
    assert.ok(corresponding.slice(1).every((row, index) => row.activeFrom === corresponding[index].activeTo));
  }
});

test('SQLite lunar rows use the atomic source context and reject generic or wrong-profile house records', () => {
  const run = realRun(245), result = matchFortuneKnowledge(run).byMethod.western;
  const rules = fortuneKnowledge.western.rules.filter(rule => rule.queries[0]?.factType === 'leo_lunar_house_context');
  assert.equal(rules.length, 11);
  for (const rule of rules) {
    const entry = fortuneKnowledge.western.entries.find(entry => entry.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.deepEqual(rule.unresolved, []);
    assert.equal(rule.queries[0].where.profile, leoLunarHousePolicy.profile);
  }
  const current = passage(rules, 'p137');
  assert.equal(result.find(row => row.knowledgeId === current.knowledgeId).status, 'matched');
  const generic = structuredClone(run); generic.facts = generic.facts.filter(f => f.factType !== 'leo_lunar_house_context');
  assert.equal(matchFortuneKnowledge(generic).byMethod.western.find(row => row.knowledgeId === current.knowledgeId).status, 'unknown');
  const wrong = structuredClone(run); facts(wrong).forEach(row => { row.normalizedPayload.profile = 'other'; });
  assert.equal(matchFortuneKnowledge(wrong).byMethod.western.find(row => row.knowledgeId === current.knowledgeId).status, 'not_matched');
});

test('only physical first-house ingress matches Leo, including the annual chart through the client and SQLite', () => {
  const reference = { snapshotId: 'lunar-ingress-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: chart(309) })));
  const annualRun = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-ingress', reference);
  const rule = passage(fortuneKnowledge.western.rules, 'p133');
  const source = fortuneKnowledge.western.entries.find(entry => entry.id === rule.knowledgeId);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: source.evidence, conditions: source.conditions })).digest('hex'));
  for (const [run, layer] of [[realRun(344), 'natal'], [annualRun, 'progressed']]) {
    validateFortuneFacts(run);
    const records = crossings(run);
    assert.equal(records.length, 1);
    const [record] = records, p = record.normalizedPayload, at = Date.parse(record.exactInstant);
    assert.equal(p.targetKind, layer);
    assert.equal(record.activeFrom, record.exactInstant);
    assert.equal(Date.parse(record.activeTo) - at, 1);
    assert.equal(record.timePrecision, 'second');
    assert.ok(record.sourceFactIds.length >= 3);
    const residual = sample => (readProgressionPosition('Moon', progressionEpoch(born, sample), born).longitude
      - p.cuspLongitude + 540) % 360 - 180;
    assert.ok(Math.abs(residual(at)) < 0.00001);
    assert.ok(residual(at - 5000) < 0 && residual(at + 5000) > 0);
    if (layer === 'progressed') assert.ok(p.annualFrameStart < record.activeFrom && record.activeTo < p.annualFrameEnd);
    const candidate = passage(matchFortuneKnowledge(run).byMethod.western, 'p133');
    assert.equal(candidate.status, 'matched');
    assert.deepEqual(candidate.sourceFactIds, [record.factId]);
    assert.equal(p.natalMoonDignity, 'other');
    assert.equal(p.hasProgressedSolarAtCrossing, true);
    const sourcePairs = run.facts.filter(row => row.factType === 'leo_progressed_aspect'
      && row.activeFrom <= record.exactInstant && record.exactInstant < row.activeTo
      && row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.targetKind === 'progressed');
    assert.deepEqual(p.solarAtCrossing, sourcePairs.map(({ normalizedPayload: a }) =>
      ({ body: 'Sun', target: a.natalTargetId, targetKind: 'progressed', aspectType: a.aspectType })));
    const query = (row = record) => passage(evaluateFortuneRules('western', 'year', [row]), 'p133').required[0].hits;
    const frame = layer === 'progressed' ? leoLunarHousePolicy.houseProfile : leoLunarHousePolicy.annualHouseProfile;
    for (const change of [{ houseProfile: frame }, { profile: 'other' }, { fromHouse: 2 }]) {
      assert.equal(query({ ...record, normalizedPayload: { ...p, ...change } }).length, 0);
    }
    const noBackgroundContacts = { ...p, hasProgressedSolarAtCrossing: false, hasReviewedNatalMoonAspect: false };
    assert.equal(query({ ...record, normalizedPayload: noBackgroundContacts }).length, 1);
    const firstHouse = facts(run).find(row => row.normalizedPayload.targetKind === layer
      && row.normalizedPayload.house === 1 && row.activeFrom === record.activeFrom);
    assert.ok(firstHouse);
    assert.equal(query(firstHouse).length, 0);
  }
  const { input } = buildFortuneModelContext(annualRun, interpretFortune(annualRun, requestForFortuneRun(annualRun), 'lunar-ingress-report'));
  assert.match(formatFortuneFactAudit(input), /由第十二宫越过年度次限上升宫头进入第一宫/u);
  assert.match(formatFortuneFactAudit(input), /穿越时同图已有次限太阳/u);
  assert.doesNotMatch(formatFortuneFactAudit(input), /leo-lunar-ascendant-crossing-v1/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === rule.knowledgeId));
});

test('a real natal Moon in Cancer is recorded separately from the first-house crossing', () => {
  const birthAt = Date.parse('1988-02-01T04:00:00Z');
  const run = calculate(chart(170, birthAt));
  const record = crossings(run).find(row => row.normalizedPayload.targetKind === 'natal');
  assert.ok(record);
  assert.equal(Math.floor(readProgressionPosition('Moon', birthAt, birthAt).longitude / 30), 3);
  assert.equal(record.normalizedPayload.natalMoonDignity, 'domicile');
  const compare = dignity => passage(evaluateFortuneRules('western', 'year', [{
    ...record, normalizedPayload: { ...record.normalizedPayload, natalMoonDignity: dignity,
      hasProgressedSolarAtCrossing: false, hasReviewedNatalMoonAspect: false },
  }]), 'p133').required[0];
  assert.equal(compare('domicile').hits.length, 1);
  assert.equal(compare('other').hits.length, 1);
  assert.equal(compare(undefined).hits.length, 1);
});

test('real first-house crossings preserve the natal Moon fall, detriment and named direct contacts for audit', () => {
  for (const [birth, armc, dignity, expectedAspects, phrase] of [
    ['1980-04-03', 18, 'fall', [], /本命月亮在天蝎座落陷/u],
    ['1980-05-06', 100, 'detriment', [], /本命月亮在摩羯座失势/u],
    ['1980-03-16', 155, 'other', [['Venus', 'sextile'], ['Saturn', 'opposition']], /本命月亮与本命金星为六合相.*本命月亮与本命土星为对分相/u],
  ]) {
    const reference = { snapshotId: 'lunar-crossing-' + dignity };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, {
      ...reference, chart: chart(armc, Date.parse(birth + 'T04:00:00Z')),
    })));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-crossing', reference);
    validateFortuneFacts(run);
    const record = crossings(run).find(row => row.normalizedPayload.targetKind === 'natal');
    assert.ok(record, dignity);
    const p = record.normalizedPayload;
    assert.equal(p.natalMoonDignity, dignity);
    assert.equal(p.hasProgressedSolarAtCrossing, false);
    assert.equal(p.hasReviewedNatalMoonAspect, expectedAspects.length > 0);
    assert.deepEqual(p.natalMoonContacts.map(c => [c.second, c.aspect]), expectedAspects);
    assert.ok(p.natalMoonContacts.every(c => c.first === 'Moon' && c.difference <= c.orb));
    const candidate = passage(matchFortuneKnowledge(run).byMethod.western, 'p133');
    assert.equal(candidate.status, 'matched');
    assert.ok(candidate.sourceFactIds.includes(record.factId));
    const evaluate = normalizedPayload => passage(evaluateFortuneRules('western', 'year', [
      { ...record, normalizedPayload },
    ]), 'p133').required[0];
    assert.equal(evaluate({ ...p, natalMoonDignity: 'other', hasReviewedNatalMoonAspect: false }).hits.length, 1);
    assert.equal(evaluate({ ...p, natalMoonDignity: 'other', hasReviewedNatalMoonAspect: undefined }).hits.length, 1);
    const annual = { ...p, targetKind: 'progressed', houseProfile: leoLunarHousePolicy.annualHouseProfile };
    assert.equal(evaluate(annual).hits.length, 1);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.match(formatFortuneFactAudit(input), phrase);
  }
});

test('a real submitted ninth-house window binds the natal and annual rulers through SQLite and Chinese input', () => {
  const reference = { snapshotId: 'lunar-ninth-ruler-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: chart(120) })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-ninth-rulers', reference);
  const matches = passage(matchFortuneKnowledge(run).byMethod.western, 'p141');
  assert.equal(matches.status, 'matched');
  const sameHouse = facts(run).filter(row => row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.house === 9);
  assert.deepEqual(new Set(matches.sourceFactIds), new Set(sameHouse.map(row => row.factId)));
  const qualified = sameHouse.filter(row => row.normalizedPayload.hasNinthRulerTestimony);
  assert.ok(qualified.length > 0 && qualified.length < sameHouse.length);
  const atBirthday = '2026-01-01T04:00:00.000Z';
  assert.ok(qualified.some(row => row.activeTo === atBirthday));
  assert.ok(qualified.some(row => row.activeFrom === atBirthday));
  const annual = leoAnnualLunarHouseBands({
    start: Date.parse('2025-12-31T16:00:00Z'), end: Date.parse('2026-12-31T16:00:00Z'),
  }, { birthAt: born, armc: 120, latitude: 35 });
  for (const row of qualified) {
    const witness = row.normalizedPayload.ninthRulers;
    assert.ok(matches.windows.some(window => window.start <= row.activeFrom && row.activeTo <= window.endExclusive));
    assert.ok(witness.annualStart <= row.activeFrom && row.activeTo <= witness.annualEnd);
    const frame = annual.find(year => year.annualStart === Date.parse(witness.annualStart));
    assert.equal(witness.progressedCuspSign, Math.floor(frame.cusps[8] / 30));
    assert.ok(witness.natalAspects.every(aspect => [aspect.first, aspect.second].includes(witness.natalRuler)));
    assert.ok(witness.progressedAspects.every(aspect => aspect.targetKind === 'progressed'
      && [aspect.body, aspect.target].includes(witness.progressedRuler)));
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lunar-ninth-report'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /固定本命第九宫主为水星/u);
  assert.match(prompt, /年度次限图的第九宫头在巨蟹座，宫主是月亮/u);
  assert.doesNotMatch(prompt, /hasNinthRulerTestimony|leo-lunar-ninth-rulers-by-chart-v1|lunar-ninth-ruler-snapshot/u);
  assertProviderHouseFinding(input, matches);
});

test('annual frame changes and query windows already in the first house do not report a cusp crossing', () => {
  const run = realRun(285);
  const frames = run.rawFacts.find(raw => raw.payload.policy?.profile === leoLunarHousePolicy.profile).payload.calculation.annual;
  assert.equal(frames[0].bands.at(-1).house, 2);
  const [changed] = frames[1].bands;
  assert.equal(changed.start, frames[1].annualStart);
  assert.equal(changed.house, 1);
  assert.ok(!changed.enteredThroughAscendant);
  const clipped = scanProgressedMoonHouses({ start: changed.start + 60_000, end: changed.start + 120_000 }, born, frames[1].cusps);
  assert.deepEqual(clipped.map(row => [row.house, row.enteredThroughAscendant]), [[1, false]]);
  assert.ok(facts(run).some(row => row.normalizedPayload.house === 1));
  assert.deepEqual(crossings(run), []);
  const candidate = passage(matchFortuneKnowledge(run).byMethod.western, 'p133');
  assert.equal(candidate.status, 'unknown');
  assert.equal(candidate.sourceFactIds.length, 0);
});

test('annual-only third house retains the day chart and natal Mercury hard contact as additional evidence', () => {
  const run = calculate(chart(345.8194953307177, Date.parse('1988-01-01T04:00:00Z'))), rows = facts(run);
  assert.ok(rows.filter(row => row.normalizedPayload.targetKind === 'natal').every(row => row.normalizedPayload.house !== 3));
  const third = passage(matchFortuneKnowledge(run).byMethod.western, 'p135');
  assert.equal(third.status, 'matched');
  const hits = rows.filter(row => third.sourceFactIds.includes(row.factId));
  assert.ok(hits.length && hits.every(({ normalizedPayload: p }) => p.targetKind === 'progressed' && p.house === 3
    && p.dayChart === true && p.mercuryAfflictions.some(a => a.first === 'Mercury' && a.second === 'Jupiter' && a.aspect === 'square')));
  const evaluated = payload => passage(evaluateFortuneRules('western', 'year', [{ ...hits[0], normalizedPayload: payload }]), 'p135').required[0];
  assert.equal(evaluated({ ...hits[0].normalizedPayload, dayChart: false, natalMercuryAfflicted: false }).hits.length, 1);
  assert.equal(evaluated({ ...hits[0].normalizedPayload, house: 4 }).hits.length, 0);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-house-mercury-report'));
  assertProviderHouseFinding(input, third);
  assert.match(formatFortuneFactAudit(input), /本命水星与本命木星为四分相/u);
});

test('the third house retains an annual contact while the fourth house requires the natal chart', () => {
  const run = realRun(245), rows = facts(run);
  const matches = matchFortuneKnowledge(run).byMethod.western;
  assert.ok(rows.some(row => row.normalizedPayload.targetKind === 'progressed' && row.normalizedPayload.house === 4));
  assert.ok(rows.filter(row => row.normalizedPayload.targetKind === 'natal').every(row => row.normalizedPayload.house === 5));
  assert.ok(rows.some(row => row.normalizedPayload.house === 3 && row.normalizedPayload.targetKind === 'progressed'));
  const third = passage(matches, 'p135');
  assert.equal(third.status, 'matched');
  assert.ok(rows.some(row => third.sourceFactIds.includes(row.factId) && row.normalizedPayload.dayChart === true
    && row.normalizedPayload.mercuryAfflictions.length === 1 && row.normalizedPayload.mercuryAfflictions[0].aspect === 'semisquare'));
  assert.equal(passage(matches, 'p136').status, 'not_matched');
});

test('a submitted day chart retains a natal Mercury sesquiquadrate with the third-house SQLite match', () => {
  const reference = { snapshotId: 'lunar-third-affliction-snapshot' };
  const snapshot = chart(0, Date.parse('1966-03-05T04:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-third-affliction', reference);
  const third = passage(matchFortuneKnowledge(run).byMethod.western, 'p135');
  assert.equal(third.status, 'matched');
  const selected = facts(run).filter(fact => third.sourceFactIds.includes(fact.factId));
  assert.ok(selected.length);
  for (const { normalizedPayload: p } of selected) {
    assert.equal(p.dayChart, true);
    assert.equal(p.house, 3);
    assert.equal(p.targetKind, 'progressed');
    assert.deepEqual(p.mercuryAfflictions.map(a => [a.first, a.second, a.aspect, a.orb]), [['Moon', 'Mercury', 'sesquiquadrate', 4]]);
  }
  const [fact] = selected;
  const evaluate = overrides => passage(evaluateFortuneRules('western', 'year',
    [{ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...overrides } }]), 'p135').required[0];
  assert.equal(evaluate({ dayChart: false, natalMercuryAfflicted: undefined }).hits.length, 1);
  assert.equal(evaluate({ houseProfile: 'other-house-profile' }).hits.length, 0);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lunar-third-affliction-report'));
  assert.match(formatFortuneFactAudit(input), /本命月亮与本命水星为倍半刑相/u);
});

test('SQLite uses classified same-layer contacts and keeps separate opposite branches', () => {
  const run = realRun(245);
  const rows = facts(run).filter(({ normalizedPayload: p }) => p.house === 5 && p.targetKind === 'natal');
  const expected = rows.filter(({ normalizedPayload: p }) => p.lunarAspects.some(a =>
    a.targetKind === 'natal' && ['favourable', 'adverse'].includes(a.nature))
    || p.attachmentDirections.length > 0 || p.speculationDirections.length > 0);
  assert.ok(expected.length > 0 && expected.length < rows.length);
  assert.ok(expected.some(row => row.normalizedPayload.lunarAspectNatures.includes('favourable')));
  assert.ok(expected.some(row => row.normalizedPayload.lunarAspectNatures.includes('adverse')));
  assert.ok(rows.some(({ normalizedPayload: p }) => p.lunarAspectNatures.length === 0 && p.lunarAspects.some(a =>
    a.targetKind === 'progressed' && ['favourable', 'adverse'].includes(a.nature))));
  const match = passage(matchFortuneKnowledge(run).byMethod.western, 'p137');
  assert.equal(match.status, 'matched');
  assert.deepEqual(new Set(match.sourceFactIds), new Set(rows.map(row => row.factId)));
  for (const [id, house] of [['p134', 2], ['p138', 6], ['p139', 7], ['p140', 8], ['p141', 9], ['p144', 12]]) {
    const [query] = passage(fortuneKnowledge.western.rules, id).queries;
    assert.equal(query.where.house, house);
    assert.equal(query.where.targetKind, 'natal');
    assert.equal(query.anyOf, undefined);
  }
});

test('fifth and eleventh house topics keep distinct, overlapping source contacts and exclude annual-chart lookalikes', () => {
  const window = { start: 0, end: 8 * day };
  const houses = [{ start: 0, end: 4 * day, house: 5 }, { start: 4 * day, end: 8 * day, house: 11 }];
  const lunar = (target, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact('Moon', start, end), natalTargetId: target, aspectType, targetKind });
  const aspects = [lunar('Venus', 'trine', 0, 2), lunar('Neptune', 'opposition', 1, 3),
    lunar('Jupiter', 'semisquare', 1, 2), lunar('Uranus', 'opposition', 3, 5, 'progressed'),
    lunar('Uranus', 'opposition', 5, 7), lunar('Venus', 'sextile', 6, 8)];
  const rows = splitLeoLunarHouses(window, houses, aspects, natal, cusps);
  assert.deepEqual(rows.map(row => [row.start / day, row.end / day, row.attachmentDirectionState,
    row.speculationDirectionState, row.friendshipDirectionState]), [
    [0, 1, 'favourable', 'none', undefined], [1, 2, 'mixed', 'adverse', undefined],
    [2, 3, 'adverse', 'none', undefined], [3, 4, 'none', 'none', undefined],
    [4, 5, undefined, undefined, 'none'], [5, 6, undefined, undefined, 'adverse'],
    [6, 7, undefined, undefined, 'mixed'], [7, 8, undefined, undefined, 'favourable'],
  ]);
  const rowFacts = rows.map(({ start, end, ...p }) => ({
    factId: 'house-topic-' + start, scope: 'progressed', method: 'western', factType: 'leo_lunar_house_context',
    activeFrom: iso(start), activeTo: iso(end), completeness: 'complete',
    normalizedPayload: { ...p, progressionPolicy: 'secondary-utc-calendar-month-v1' },
  }));
  const results = evaluateFortuneRules('western', 'year', rowFacts);
  for (const [id, expected] of [['p137', [0, 1, 2, 3]], ['p143', [4, 5, 6, 7]]]) {
    assert.deepEqual(passage(results, id).required[0].hits.map(row => Date.parse(row.activeFrom) / day), expected);
  }
  const [conflicted] = rows.filter(row => row.attachmentDirectionState === 'mixed');
  assert.deepEqual(conflicted.attachmentDirections.map(row => [row.passage, row.nature, row.sourceBandIndex]),
    [['p220', 'favourable', 0], ['p183', 'adverse', 1]]);
  assert.deepEqual(conflicted.speculationDirections.map(row => [row.passage, row.nature]), [['p147', 'adverse']]);
  const annual = splitLeoLunarHouses(window, houses, aspects, natal, cusps, { annualStart: 0, annualEnd: 10 * day });
  assert.ok(annual.every(row => row.attachmentDirections === undefined && row.friendshipDirections === undefined));
});

test('complete birth charts reach SQLite through the second-house writing and fifth- and eleventh-house topical branches', () => {
  const cases = [
    { id: 'p134', house: 2, birthInstant: '1964-01-04T04:00:00Z', longitude: -45, timeZone: 'Etc/GMT+3',
      sample: '2026-07-01T00:00:00.000Z', field: 'literaryPlacements', state: 'hasLiteraryPlacement', negative: false,
      phrase: /实际第3宫的水星与写作相联/u },
    { id: 'p137', house: 5, birthInstant: '1965-01-01T04:00:00Z', longitude: -45, timeZone: 'Etc/GMT+3',
      sample: '2026-05-20T00:00:00.000Z', field: 'attachmentDirections', state: 'attachmentDirectionState', negative: 'none',
      phrase: /情感与依恋的同期依据为次限月亮对本命天王星的对分相，该议题在原书此项偏难/u },
    { id: 'p143', house: 11, birthInstant: '1965-01-01T04:00:00Z', longitude: 135, timeZone: 'Asia/Tokyo',
      sample: '2026-05-20T00:00:00.000Z', field: 'friendshipDirections', state: 'friendshipDirectionState', negative: 'none',
      phrase: /朋友与交往的同期依据为次限月亮对本命天王星的对分相，该议题在原书此项偏难/u },
  ];
  for (const { id, house, birthInstant, longitude, timeZone, sample, field, state, negative, phrase } of cases) {
    const snapshotId = 'lunar-topic-' + house;
    const run = submitLocatedChart(snapshotId, birthInstant, longitude, timeZone);
    const witness = facts(run).find(row => row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.house === house
      && row.activeFrom <= sample && sample < row.activeTo);
    assert.equal(witness?.completeness, 'complete', id);
    const payload = witness.normalizedPayload;
    assert.ok(payload.lunarAspectNatures.every(nature => nature === 'conditional'), id);
    if (house === 2) {
      assert.equal(payload.hasLiteraryPlacement, true);
      assert.deepEqual(payload.literaryPlacements, [{ body: 'Mercury', house: 3 }]);
    } else {
      assert.equal(payload[state], 'adverse');
      assert.deepEqual(payload[field].map(({ target, aspectType, passage }) => [target, aspectType, passage]),
        [['Uranus', 'opposition', 'p213']]);
      const [direction] = payload[field];
      assert.ok(payload.lunarAspects.some(row => row.sourceBandIndex === direction.sourceBandIndex && row.targetKind === 'natal'
        && row.nature === 'conditional' && row.natalTargetId === direction.target), id);
    }
    const matches = matchFortuneKnowledge(run).byMethod.western;
    const found = passage(matches, id);
    assert.equal(found.status, 'matched', id);
    if (house !== 2) assertSharedHousePoints(run, matches, id, house);
    assert.ok(found.sourceFactIds.includes(witness.factId), id);
    assert.ok(found.windows.some(window => window.start <= witness.activeFrom && witness.activeTo <= window.endExclusive), id);
    const withoutEvidence = { ...witness, normalizedPayload: { ...payload, [state]: negative, [field]: [] } };
    const withoutNatalFrame = { ...witness, normalizedPayload: { ...payload, targetKind: 'progressed' } };
    const hitCount = fact => passage(evaluateFortuneRules('western', 'year', [fact]), id).required[0].hits.length;
    assert.equal(hitCount(withoutEvidence), 1, id);
    assert.equal(hitCount(withoutNatalFrame), 0, id);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), snapshotId));
    assert.ok(input.facts.some(fact => found.sourceFactIds.includes(references.get(fact.ref)) && fact.data[field]?.length), id);
    if (house !== 2) assertProjectedHouseBranches(input, references, found, house);
    else assertProviderHouseFinding(input, found);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase, id);
    assert.doesNotMatch(prompt, /literaryPlacements|attachmentDirections|friendshipDirections|\bp(?:134|137|143|213)\b/u, id);
  }
});

test('second-house Moon evidence keeps a named natal financial target separate from another chart', () => {
  const window = { start: 0, end: 4 * day };
  const chart = { bodies: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
    .map((body, i) => ({ body, longitude: i * 27, sign: Math.floor(i * 27 / 30), declination: 0,
      house: body === 'Venus' ? 2 : 5 })) };
  const aspects = [
    { ...contact('Moon', 0, 2), natalTargetId: 'Venus', targetKind: 'progressed' },
    { ...contact('Moon', 1, 4), natalTargetId: 'Venus', targetKind: 'natal' },
    { ...contact('Moon', 2, 3), natalTargetId: 'Mars', targetKind: 'natal' },
  ];
  const rows = splitLeoLunarHouses(window, [{ ...window, house: 2 }], aspects, chart, cusps);
  const venusRoles = ['second_house_occupants', 'named_financial_pair'];
  assert.deepEqual(rows.map(row => [row.start / day, row.end / day,
    row.secondFinance.contacts.map(contact => [contact.target, contact.roles])]), [
    [0, 1, []], [1, 2, [['Venus', venusRoles]]], [2, 3, [['Venus', venusRoles]]], [3, 4, [['Venus', venusRoles]]],
  ]);
  const description = describeFortuneFact({ method: 'western', type: 'leo_lunar_house_context', data: rows[1] }, String);
  assert.match(description, /受照星属本命二宫实居星/u);
});

test('ninth-house voyage uses two same-topic layers and checks the adverse lunar premise in the same slice', () => {
  const positions = [['Moon', 75], ['Jupiter', 135], ['Saturn', 165], ['Sun', 300], ['Mercury', 298],
    ['Venus', 310], ['Mars', 235], ['Uranus', 30], ['Neptune', 148]];
  const birth = { bodies: positions.map(([body, longitude]) => ({ body, longitude, declination: 12,
    sign: Math.floor(longitude / 30), house: zodiacalHouse(longitude, cusps) })) };
  const aspect = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact(progressedBody, start, end), natalTargetId, aspectType, targetKind });
  const bands = [aspect('Mercury', 'Saturn', 'sextile', 0, 3),
    aspect('Sun', 'Uranus', 'sextile', 2, 4, 'progressed'),
    aspect('Mars', 'Jupiter', 'square', 1, 5),
    aspect('Moon', 'Saturn', 'square', 1, 3),
    aspect('Moon', 'Venus', 'trine', 2, 3),
    aspect('Moon', 'Saturn', 'square', 3, 5, 'progressed'),
    aspect('Mercury', 'Saturn', 'sextile', 4, 5, 'progressed'),
    aspect('Moon', 'Jupiter', 'parallel', 5, 6)];
  const window = { start: 0, end: 6 * day };
  const rows = splitLeoLunarHouses(window, [{ ...window, house: 9 }], bands, birth, cusps);
  assert.deepEqual(rows.map(row => [row.start / day, row.ninthVoyage.matchedNatures]), [
    [0, ['favourable']], [1, ['favourable', 'adverse']], [2, ['favourable']], [3, ['favourable']], [4, []], [5, []],
  ]);
  assert.ok(rows.every(row => row.ninthVoyage.natalAspects.some(contact =>
    contact.body === 'Moon' && contact.house === 9 && contact.first === 'Moon'
    && contact.second === 'Saturn' && contact.aspect === 'square' && contact.nature === 'adverse')));
  const evaluate = row => passage(evaluateFortuneRules('western', 'year', [{
    factType: 'leo_lunar_house_context', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...row, progressionPolicy: 'secondary-utc-calendar-month-v1' },
  }]), 'p141').required[0].hits.length;
  assert.deepEqual(rows.map(evaluate), [1, 1, 1, 1, 1, 1]);
  const wrongFrame = splitLeoLunarHouses(window, [{ ...window, house: 9 }], bands, birth, cusps,
    { annualStart: 0, annualEnd: 10 * day });
  assert.ok(wrongFrame.every(row => row.ninthVoyage === undefined && evaluate(row) === 0));
  const withoutNatalAnchor = { bodies: birth.bodies.map(body => ({ ...body, house: 2 })) };
  const wrongNatal = splitLeoLunarHouses(window, [{ ...window, house: 9 }], bands, withoutNatalAnchor, cusps);
  assert.ok(wrongNatal.every(row => row.hasNinthVoyageTestimony === false && evaluate(row) === 1));
});

test('complete birth chart attaches real fourth-house placement and concurrent relocation evidence to SQLite and prompt', () => {
  const run = submitLocatedChart('leo-fourth-domestic', '1965-02-08T04:00:00Z', 120, 'Etc/GMT-8');
  const at = '2026-12-14T22:21:12.162Z';
  const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p136');
  assert.equal(found.status, 'matched');
  const witness = facts(run).find(row => found.sourceFactIds.includes(row.factId) && row.activeFrom <= at && at < row.activeTo);
  assert.equal(witness?.completeness, 'complete');
  const p = witness.normalizedPayload;
  assert.equal(p.targetKind, 'natal');
  assert.equal(p.house, 4);
  assert.deepEqual(p.domesticPlacements, [{ body: 'Uranus', house: 4 }]);
  assert.ok(p.relocationDirections.some(row => row.passage === 'p149' && row.nature === 'adverse'
    && row.target === 'Jupiter' && row.aspectType === 'square'));
  assert.ok(facts(run).some(row => found.sourceFactIds.includes(row.factId) && row.normalizedPayload.relocationDirectionState === 'none'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-fourth-domestic-report'));
  assertProviderHouseFinding(input, found);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命天王星实居第四宫，Leo与Green将这一位置与家宅或迁居相联/u);
  assert.match(prompt, /家宅迁居的同期依据为次限月亮对本命木星的四分相，该议题在原书此项偏难/u);
  assert.doesNotMatch(prompt, /domesticPlacements|relocationDirections|\bp(?:136|149)\b/u);
});

test('real ninth-house voyages reach SQLite with actual radices and each named direction frame', () => {
  const cases = [
    { birth: '1953-10-18T04:00:00Z', longitude: 120, timeZone: 'Etc/GMT-8', source: 'p110', frames: ['natal'],
      translation: /次限水星对本命土星的六合相/u },
    { birth: '1955-03-06T04:00:00Z', longitude: 135, timeZone: 'Asia/Tokyo', source: 'p280', frames: ['natal', 'progressed'],
      translation: /次限太阳对(?:本命|同图次限)天王星的六合相/u },
    { birth: '1970-05-19T04:00:00Z', longitude: -60, timeZone: 'Etc/GMT+4', source: 'p041', frames: ['natal'],
      anchor: 'Moon', nature: 'adverse', sample: '2026-01-08T08:17:55.177Z',
      heading: /远行的偏难本命依据为本命月亮实居第九宫/u,
      translation: /次限火星对本命木星的四分相/u },
  ];
  for (const { birth, longitude, timeZone, source, frames, translation, anchor = 'Sun', nature = 'favourable',
    sample = '2026-06-15T00:00:00.000Z', heading = /远行的偏顺本命依据为本命太阳实居第九宫/u } of cases) {
    const run = submitLocatedChart('leo-ninth-voyage-' + longitude, birth, longitude, timeZone);
    const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p141');
    assert.equal(found.status, 'matched');
    const witness = facts(run).find(row => row.normalizedPayload.targetKind === 'natal' && row.normalizedPayload.house === 9
      && row.activeFrom <= sample && sample < row.activeTo);
    assert.ok(witness?.completeness === 'complete' && found.sourceFactIds.includes(witness.factId), birth);
    const p = witness.normalizedPayload;
    assert.equal(p.hasNinthVoyageTestimony, true, birth);
    assert.deepEqual(p.ninthVoyage.matchedNatures, [nature], birth);
    assert.ok(p.ninthVoyage.natalAspects.some(row => row.body === anchor && row.house === 9 && row.nature === nature
      && [row.first, row.second].includes(anchor)), birth);
    assert.deepEqual([...new Set(p.ninthVoyage.directions.filter(row => row.passage === source).map(row => row.targetKind))].sort(), frames);
    if (nature === 'adverse') {
      assert.deepEqual(p.lunarAspectNatures, ['adverse'], birth);
      assert.ok(p.lunarAspects.some(row => row.targetKind === 'natal' && row.nature === 'adverse'), birth);
    }
    const evaluate = overrides => passage(evaluateFortuneRules('western', 'year',
      [{ ...witness, normalizedPayload: { ...p, hasNinthRulerTestimony: false, ...overrides } }]), 'p141').required[0].hits.length;
    assert.equal(evaluate({}), 1);
    assert.equal(evaluate({ hasNinthVoyageTestimony: false }), 1);
    assert.equal(evaluate({ targetKind: 'progressed' }), 0);
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ninth-voyage-report'));
    assert.ok(input.facts.some(fact => found.sourceFactIds.includes(references.get(fact.ref))
      && fact.data.ninthVoyage?.matchedNatures.includes(nature)));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, heading);
    assert.match(prompt, translation);
    assert.doesNotMatch(prompt, /ninthVoyage|matchedNatures|\bp(?:041|110|141|280)\b/u);
  }
});

test('complete eighth-house charts keep estate and shared finances separate from the independent occult branch', () => {
  const cases = [
    { birth: '1999-03-09T04:00:00Z', longitude: 45, timeZone: 'Etc/GMT-3', sample: '2026-06-16T22:15:53.283Z',
      nature: 'favourable', body: 'Jupiter', aspect: 'trine', phrase: /遗产议题的偏顺本命依据为月亮实居第八宫/u },
    { birth: '1971-09-11T04:00:00Z', longitude: 75, timeZone: 'Etc/GMT-5', sample: '2026-12-13T04:41:03.299Z',
      nature: 'adverse', body: 'Sun', aspect: 'square', phrase: /伴侣财务议题的偏难本命依据为月亮实居第八宫/u },
    { birth: '1964-03-31T04:00:00Z', longitude: 105, timeZone: 'Etc/GMT-7', sample: '2026-07-26T08:12:08.283Z',
      phrase: /玄学与内在体验的同期依据为次限月亮对本命海王星的四分相，该议题在原书此项偏难/u },
  ];
  for (const { birth, longitude, timeZone, sample, nature, body, aspect, phrase } of cases) {
    const run = submitLocatedChart('leo-eighth-' + longitude, birth, longitude, timeZone);
    const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p140');
    assert.equal(found.status, 'matched', birth);
    const witness = facts(run).find(row => row.normalizedPayload.house === 8 && row.normalizedPayload.targetKind === 'natal'
      && row.activeFrom <= sample && sample < row.activeTo);
    assert.ok(witness?.completeness === 'complete' && found.sourceFactIds.includes(witness.factId), birth);
    const p = witness.normalizedPayload;
    assert.ok(found.windows.some(window => window.start <= witness.activeFrom && witness.activeTo <= window.endExclusive), birth);
    if (nature) {
      assert.equal(p.natalMoon.house, 8, birth);
      assert.ok(p.eighthFinance.matchedNatures.includes(nature), birth);
      assert.ok(p.lunarAspectNatures.includes(nature), birth);
      assert.ok(p.eighthFinance.natalAspects.some(row => [row.first, row.second].includes('Moon')
        && [row.first, row.second].includes(body) && row.nature === nature && row.aspect === aspect), birth);
    } else {
      assert.deepEqual(p.lunarAspectNatures, ['conditional'], birth);
      assert.deepEqual(p.eighthFinance.matchedNatures, [], birth);
      assert.deepEqual(p.eighthOccultDirections.map(row => [row.target, row.aspectType, row.nature, row.passage]),
        [['Neptune', 'square', 'adverse', 'p179']], birth);
      const evaluates = override => passage(evaluateFortuneRules('western', 'year',
        [{ ...witness, normalizedPayload: { ...p, ...override } }]), 'p140').required[0].hits.length;
      assert.equal(evaluates({ eighthOccultDirectionState: 'none' }), 1);
      assert.equal(evaluates({ targetKind: 'progressed' }), 0);
      const withoutTopic = facts(run).filter(({ normalizedPayload: data }) => data.targetKind === 'natal' && data.house === 8
        && data.eighthOccultDirectionState === 'none' && data.lunarAspectNatures.every(value => value === 'conditional'));
      assert.ok(withoutTopic.length > 0 && withoutTopic.every(row => found.sourceFactIds.includes(row.factId)), birth);
    }
    const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'eighth-house-report'));
    assert.ok(input.facts.some(fact => found.sourceFactIds.includes(references.get(fact.ref))
      && (nature ? fact.data.eighthFinance?.matchedNatures.includes(nature) : fact.data.eighthOccultDirections?.length)), birth);
    assertProviderHouseFinding(input, found);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase, birth);
    assert.doesNotMatch(prompt, /eighthFinance|eighthOccultDirections|\bp(?:140|179)\b/u, birth);
  }
});

test('complete tenth-house chart matches independent business and household segments and keeps an occupation placement', () => {
  const run = submitLocatedChart('leo-tenth-topic', '1965-01-01T04:00:00Z', -180, 'Etc/GMT+12');
  const matches = matchFortuneKnowledge(run).byMethod.western;
  const found = passage(matches, 'p142');
  assert.equal(found.status, 'matched');
  assertSharedHousePoints(run, matches, 'p142', 10);
  const cases = [
    { sample: '2026-05-22T01:31:49.424Z', career: 'adverse', family: 'none', field: 'careerDirections', passage: 'p213' },
    { sample: '2026-12-31T04:44:59.945Z', career: 'none', family: 'adverse', field: 'familyDirections', passage: 'p214' },
  ];
  for (const item of cases) {
    const witness = facts(run).find(row => row.normalizedPayload.house === 10 && row.normalizedPayload.targetKind === 'natal'
      && row.activeFrom <= item.sample && item.sample < row.activeTo);
    assert.ok(witness?.completeness === 'complete' && found.sourceFactIds.includes(witness.factId), item.passage);
    const p = witness.normalizedPayload;
    assert.deepEqual(p.lunarAspectNatures, ['conditional'], item.passage);
    assert.equal(p.careerDirectionState, item.career, item.passage);
    assert.equal(p.familyDirectionState, item.family, item.passage);
    assert.deepEqual(p[item.field].map(row => [row.targetKind, row.target, row.nature, row.passage]),
      [['natal', 'Uranus', 'adverse', item.passage]]);
    const evaluates = override => passage(evaluateFortuneRules('western', 'year',
      [{ ...witness, normalizedPayload: { ...p, ...override } }]), 'p142').required[0].hits.length;
    assert.equal(evaluates({ careerDirectionState: 'none', familyDirectionState: 'none' }), 1);
    assert.equal(evaluates({ targetKind: 'progressed' }), 0);
  }
  const withoutTopic = facts(run).filter(({ normalizedPayload: data }) => data.targetKind === 'natal' && data.house === 10
    && data.careerDirectionState === 'none' && data.familyDirectionState === 'none'
    && data.lunarAspectNatures.every(value => value === 'conditional'));
  assert.ok(withoutTopic.length > 0 && withoutTopic.every(row => found.sourceFactIds.includes(row.factId)));
  const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tenth-house-topic-report'));
  assertProjectedHouseBranches(input, references, found, 10);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /职业与上级的同期依据为次限月亮对本命天王星的对分相，该议题在原书此项偏难/u);
  assert.match(prompt, /家宅安排的同期依据为次限月亮对本命天王星的赤纬绝对值平行，该议题在原书此项偏难/u);
  assert.doesNotMatch(prompt, /careerDirections|familyDirections|\bp(?:142|213|214)\b/u);

  const placementRun = submitLocatedChart('leo-tenth-placement', '1964-01-04T04:00:00Z', 90, 'Etc/GMT-6');
  const placement = passage(matchFortuneKnowledge(placementRun).byMethod.western, 'p142');
  assert.ok(facts(placementRun).some(row => placement.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.careerPlacements?.some(({ ruler, ruledHouse, house }) =>
      ruler === 'Jupiter' && ruledHouse === 10 && house === 1)));
  const placedInput = buildFortuneModelContext(placementRun,
    interpretFortune(placementRun, requestForFortuneRun(placementRun), 'tenth-house-placement-report')).input;
  assert.match(formatFortuneFactAudit(placedInput), /本命十宫主木星实居第一宫，.*职业与公众地位候选依据/u);
});

test('the same Moon direction keeps separate career and reflection readings, with sixth-house service clipped by layer', () => {
  const window = { start: 0, end: 9 * day };
  const houses = [
    { start: 0, end: 3 * day, house: 6 }, { start: 3 * day, end: 6 * day, house: 10 },
    { start: 6 * day, end: 9 * day, house: 12 },
  ];
  const lunar = (natalTargetId, aspectType, start, end, targetKind = 'natal') =>
    ({ ...contact('Moon', start, end), natalTargetId, aspectType, targetKind });
  const bands = [lunar('Saturn', 'sextile', 0, 2), lunar('Mercury', 'opposition', 1, 3, 'progressed'),
    lunar('Neptune', 'sesquiquadrate', 4, 7), lunar('Neptune', 'square', 7, 8, 'progressed')];
  const rows = splitLeoLunarHouses(window, houses, bands, natal, cusps);
  const at = start => rows.find(row => row.start === start * day);
  assert.equal(at(1).serviceDirectionState, 'favourable');
  assert.deepEqual(at(1).serviceDirections.map(x => x.passage), ['p188']);
  assert.equal(at(2).serviceDirectionState, 'none');
  assert.deepEqual(at(4).careerDirections.map(x => [x.sourceBandIndex, x.passage, x.nature]), [[2, 'p181', 'adverse']]);
  assert.deepEqual(at(6).reflectionDirections.map(x => [x.sourceBandIndex, x.passage, x.nature]), [[2, 'p181', 'favourable']]);
  assert.equal(at(4).reflectionDirections, undefined);
  assert.equal(at(6).careerDirections, undefined);
  assert.deepEqual(at(7).reflectionDirections, []);
  const forecast = (row, id) => passage(evaluateFortuneRules('western', 'year', [{
    factType: 'leo_lunar_house_context', scope: 'progressed', completeness: 'complete',
    normalizedPayload: { ...row, progressionPolicy: 'secondary-utc-calendar-month-v1' },
  }]), id).required[0].hits.length;
  assert.equal(forecast(at(1), 'p138'), 1);
  assert.equal(forecast(at(2), 'p138'), 1);
  assert.equal(forecast(at(7), 'p144'), 1);
});

test('complete sixth-house birth and submitted facts reach the employment branch without any concurrent Moon aspect', () => {
  const run = submitLocatedChart('leo-sixth-service-placement', '1964-02-04T04:00:00Z', -165, 'Etc/GMT+11');
  const sample = '2026-12-31T09:45:40.375Z';
  const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p138');
  assert.equal(found.status, 'matched');
  const witness = facts(run).find(row => row.normalizedPayload.house === 6 && row.normalizedPayload.targetKind === 'natal'
    && row.activeFrom <= sample && sample < row.activeTo);
  assert.ok(witness?.completeness === 'complete' && found.sourceFactIds.includes(witness.factId));
  const p = witness.normalizedPayload;
  assert.deepEqual(p.lunarAspectNatures, []);
  assert.equal(p.serviceDirectionState, 'none');
  assert.equal(p.hasSixthServicePlacement, true);
  assert.deepEqual(p.sixthServicePlacements.map(({ body, house }) => [body, house]), [['Mercury', 6]]);
  const [placement] = p.sixthServicePlacements;
  assert.ok(placement.support.some(row => row.first === 'Mercury' && row.second === 'Venus' && row.aspect === 'sextile'));
  const evaluate = override => passage(evaluateFortuneRules('western', 'year',
    [{ ...witness, normalizedPayload: { ...p, ...override } }]), 'p138').required[0].hits.length;
  assert.equal(evaluate({ hasSixthServicePlacement: false, sixthServicePlacements: [] }), 1);
  assert.equal(evaluate({ targetKind: 'progressed' }), 0);
  const { input, references } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sixth-service-report'));
  assertProviderHouseFinding(input, found);
  assert.ok(input.facts.some(fact => found.sourceFactIds.includes(references.get(fact.ref))
    && fact.data.sixthServicePlacements?.some(row => row.body === 'Mercury')));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命水星实居第6宫，Leo与Green将这一位置与替他人办理事务相联/u);
  assert.doesNotMatch(prompt, /sixthServicePlacements|serviceDirectionState|\bp138\b/u);
});

test('complete twelfth-house charts keep independently sourced private placements and reflection intervals in the prompt', () => {
  const cases = [
    { birth: '1965-04-01T04:00:00Z', longitude: 105, timeZone: 'Etc/GMT-7', sample: '2026-09-08T13:31:46.787Z',
      phrase: /阅读与内在反思的同期依据为次限月亮对本命海王星的倍半刑相，该议题在原书此项偏顺/u },
    { birth: '1970-05-19T04:00:00Z', longitude: -150, timeZone: 'Etc/GMT+10', sample: '2026-01-08T08:17:55.177Z',
      natalBody: 'Jupiter', phrase: /本命木星实居第12宫，Leo与Green将这一位置与互助与公益相联/u },
  ];
  for (const { birth, longitude, timeZone, sample, phrase, natalBody } of cases) {
    const run = submitLocatedChart('leo-twelfth-' + longitude, birth, longitude, timeZone);
    const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p144');
    assert.equal(found.status, 'matched', birth);
    const witness = facts(run).find(row => row.normalizedPayload.house === 12 && row.normalizedPayload.targetKind === 'natal'
      && row.activeFrom <= sample && sample < row.activeTo);
    assert.ok(witness?.completeness === 'complete' && found.sourceFactIds.includes(witness.factId), birth);
    const p = witness.normalizedPayload;
    if (natalBody) {
      assert.ok(p.twelfthPrivatePlacements.some(row => row.body === natalBody && row.house === 12 && row.afflictions.length === 0), birth);
    } else {
      assert.deepEqual(p.lunarAspectNatures, ['conditional'], birth);
      assert.deepEqual(p.reflectionDirections.map(row => [row.target, row.targetKind, row.aspectType, row.passage, row.nature]),
        [['Neptune', 'natal', 'sesquiquadrate', 'p181', 'favourable']], birth);
      assert.ok(facts(run).some(row => found.sourceFactIds.includes(row.factId) && !row.normalizedPayload.reflectionDirections?.length));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'twelfth-reflection-report'));
    assertProviderHouseFinding(input, found);
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, phrase, birth);
    assert.doesNotMatch(prompt, /twelfthPrivatePlacements|reflectionDirections|\bp(?:144|181)\b/u, birth);
  }
});

test('client-submitted seventh-house facts retain ruler geometry and independent favourable and adverse windows', () => {
  const reference = { snapshotId: 'lunar-house-client-snapshot' };
  const snapshot = chart(135, Date.parse('1966-07-09T04:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-house-client', reference);
  const seventh = passage(matchFortuneKnowledge(run).byMethod.western, 'p139');
  assert.equal(seventh.status, 'matched');
  const selected = facts(run).filter(fact => seventh.sourceFactIds.includes(fact.factId));
  assert.ok(selected.every(({ normalizedPayload: p }) => p.house === 7 && p.targetKind === 'natal'
    && p.rulerPair.first === 'Mars' && p.rulerPair.seventh === 'Venus' && Array.isArray(p.rulerPair.natalAspects)));
  assert.ok(selected.some(({ normalizedPayload: p }) => p.lunarAspectNatures.includes('adverse')));
  assert.ok(selected.some(({ normalizedPayload: p }) => p.moonHasAdverseAspect === false && p.favourableNatalTargets.some(target =>
    target.afflictions.length === 0 && p.lunarAspects.some(a => a.targetKind === 'natal'
      && a.nature === 'favourable' && a.natalTargetId === target.body))));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-house-seventh'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命一宫主为火星，七宫主为金星/u);
  assert.match(prompt, /同段月亮偏顺照到本命.+本命四分、对分、半刑或倍半刑为未检出/u);
  assert.doesNotMatch(prompt, /seventhRulerAspectsReady|favourableNatalTargets|hasFavourableNatalTargetWithoutAffliction/u);
  assertProviderHouseFinding(input, seventh);
});

test('a natal hard aspect precludes the favourable recipient branch while the seventh-house interval remains valid', () => {
  const run = calculate(chart(20, Date.parse('1983-06-14T04:00:00Z')));
  const rows = facts(run).filter(({ normalizedPayload: p }) => p.house === 7 && p.targetKind === 'natal');
  assert.ok(rows.length && rows.every(({ normalizedPayload: p }) => p.favourableNatalTargets.length > 0
    && p.favourableNatalTargets.every(target => target.afflictions.some(row => ['square', 'opposition'].includes(row.aspect)))
    && !p.moonHasAdverseAspect));
  assert.ok(rows[0].normalizedPayload.rulerPair.natalAspects.some(aspect => aspect.aspect === 'trine'));
  assert.ok(rows.every(({ normalizedPayload: p }) => !p.hasFavourableNatalTargetWithoutAffliction));
  const found = passage(matchFortuneKnowledge(run).byMethod.western, 'p139');
  assert.equal(found.status, 'matched');
  assert.deepEqual(new Set(found.sourceFactIds), new Set(rows.map(row => row.factId)));
});

test('seventh-house natal minor affliction blocks the favourable recipient without blocking actual adverse Moon slices', () => {
  const reference = { snapshotId: 'lunar-seventh-affliction-snapshot' };
  const snapshot = chart(210, Date.parse('1975-01-31T04:00:00Z'));
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, { ...reference, chart: snapshot })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'lunar-seventh-affliction', reference);
  const seventh = passage(matchFortuneKnowledge(run).byMethod.western, 'p139');
  assert.equal(seventh.status, 'matched');
  const selected = facts(run).filter(fact => seventh.sourceFactIds.includes(fact.factId));
  assert.ok(selected.some(({ normalizedPayload: p }) => p.moonHasAdverseAspect));
  const witness = facts(run).find(({ normalizedPayload: p }) => p.house === 7 && p.targetKind === 'natal' && !p.moonHasAdverseAspect
    && p.favourableNatalTargets?.length === 1 && p.favourableNatalTargets[0].body === 'Venus');
  assert.ok(witness);
  assert.ok(seventh.sourceFactIds.includes(witness.factId));
  const p = witness.normalizedPayload;
  assert.equal(p.hasFavourableNatalTargetWithoutAffliction, false);
  assert.deepEqual(p.favourableNatalTargets[0].afflictions.map(row => [row.first, row.second, row.aspect, row.orb]),
    [['Venus', 'Saturn', 'sesquiquadrate', 4]]);
  assert.equal(p.rulerPair.first, 'Saturn');
  assert.ok(p.rulerPair.firstAfflictions.some(row => row.first === 'Mercury' && row.second === 'Saturn' && row.aspect === 'sesquiquadrate'));
  const evaluate = flag => passage(evaluateFortuneRules('western', 'year',
    [{ ...witness, normalizedPayload: { ...p, hasFavourableNatalTargetWithoutAffliction: flag } }]), 'p139').required[0];
  assert.equal(evaluate(false).hits.length, 1);
  assert.equal(evaluate(undefined).hits.length, 1);
  assert.equal(evaluate(true).hits.length, 1);
  const translated = describeFortuneFact({ method: 'western', type: witness.factType, data: p }, iso);
  assert.match(translated, /同段月亮偏顺照到本命金星.+本命金星与本命土星为倍半刑相/u);
  assert.match(translated, /一宫主参与的本命四分、对分、半刑或倍半刑为本命水星与本命土星为倍半刑相/u);
});

test('Chinese model input preserves the three separate simultaneous aspect groups and explicit unknown meaning without machine data or partial findings', () => {
  const run = realRun(), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lunar-house-report'));
  assert.ok(input.facts.some(f => f.type === 'leo_lunar_house_context'));
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['原书按宫序对应的自然星座', '本片段的月亮相位', '本片段的太阳推运', '本片段的互相推运',
    '同一时段不等于同性质', '年度次限图第1宫', '固定本命第3宫']) assert.ok(prompt.includes(phrase), phrase);
  for (const secret of ['sourceBandIndex', 'naturalSignBodies', leoLunarHousePolicy.profile, 'mercurySeparations',
    'lunar-house-run', 'lunar-house-snapshot']) assert.ok(!prompt.includes(secret));
  const unresolved = new Set(fortuneKnowledge.western.rules.filter(rule => rule.unresolved.length).map(rule => rule.knowledgeId));
  assert.ok(input.sections.flatMap(s => s.findings).every(finding => !unresolved.has(finding.knowledgeId)));
  const row = splitLeoLunarHouses({ start: 0, end: day }, [{ start: 0, end: day, house: 3 }], [], natal, cusps)[0];
  const translated = describeFortuneFact({ method: 'western', type: 'leo_lunar_house_context', data: row }, iso);
  assert.match(translated, /双子座/u); assert.match(translated, /射手座/u);
  assert.match(translated, /水星与月亮的最短黄经夹角为10°/u);
  assert.match(translated, /没有与本片段重叠的记录/u);
  assert.ok(!/[{}\[\]]/u.test(translated));
});
