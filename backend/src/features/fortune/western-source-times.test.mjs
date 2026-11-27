import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, MakeTime, MoonPhase, SearchSunLongitude, SiderealTime, SunPosition, e_tilt } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { birthAnniversary, ptolemyLot, ptolemySignAspect, ptolemySignRuler, buildPtolemyPlaces, buildPtolemyTimes } = await import('./control/ptolemy-times.ts');
const { ptolemyPrimaryDirections, ptolemyPrimaryDirectionProfile } = await import('./control/ptolemy-primary-directions.ts');
const { ptolemyNatalGovernors, ptolemyNatalMercuryHorizon, ptolemyNatalPlacementFamiliarities, ptolemyPlanetSect, ptolemyTermAt } = await import('./control/ptolemy-natal-rulers.ts');
const { buildLunationWindows, westernProgressionTransitOverlaps } = await import('./control/western-time-links.ts');
const { buildLeoJupiterHouseContexts, leoJupiterHousePolicy } = await import('./control/leo-transit-natal.ts');
const { anglesFromFrame, buildWesternSourceHouses, eclipticEquator, scanCircularRegions, zodiacalHouse } = await import('./control/western-houses.ts');
const { progressionEpoch, readProgressionPosition } = await import('./control/western-progressions.ts');
const { buildSepharialLunarYearTable, buildSepharialLunationContexts, sepharialMidheavenAtRising, sepharialLunationPolicy } = await import('./control/sepharial-lunation.ts');
const { sepharialMundaneAngleArcs, sepharialMundaneConjunctionArc, sepharialNatalEquatorialPosition,
  sepharialSphericalPrimaryProfile } = await import('./control/sepharial-primary-directions.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const day = 86_400_000, birthAt = Date.parse('1990-01-01T04:00:00Z');
const normalize = v => (v % 360 + 360) % 360;
const sign = v => Math.floor(normalize(v) / 30);
function chart(at = birthAt, armc = 0) {
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] },
    western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: at / day + 2440587.5, ...anglesFromFrame(armc, 35, e_tilt(MakeTime(new Date(at))).tobl),
      positions: bodies.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(at)).elon
        : Ecliptic(GeoVector(Body[planet], new Date(at), true)).elon })),
    }] } };
}
function calculate(snapshot = chart(), periodType = 'year', targetPeriod = { year: 2026 }) {
  const params = { periodType, targetPeriod, displayTimezone: 'Asia/Shanghai' };
  const time = buildFactTimeContext(params, Date.parse('2026-11-18T03:00:00Z'), 'server');
  return calculateFortuneFacts(params, time, 'source-times-run', { snapshotId: 'source-times-snapshot', chart: snapshot });
}
let baseline;
const realRun = () => baseline ??= calculate();
const result = (run, i) => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === fortuneKnowledge.western.rules[i].knowledgeId);
const evidenceIds = match => [...match.sourceFactIds, ...(match.candidateFactIds ?? [])];

const houseContexts = (run, house) => run.facts.filter(fact => fact.factType === 'leo_jupiter_house_ruler_context'
  && fact.normalizedPayload.natalHouse === house);
const houseMatch = (run, passage) => result(run, fortuneKnowledge.western.rules.findIndex(rule => rule.knowledgeId.endsWith(passage + '-001')));
const housePrompt = run => formatFortuneFactAudit(buildFortuneModelContext(run,
  interpretFortune(run, requestForFortuneRun(run), 'leo-house-source')).input);

test('Jupiter ruler evidence keeps actual transit, anniversary, chart and same-angle premises together', () => {
  const cuspSigns = Array.from({ length: 12 }, (_, index) => index);
  const natal = { ascendantRuler: 'Mars', cuspSigns, bodies: [
    { body: 'Mars', longitude: 0, declination: 0, house: 1 },
    { body: 'Venus', longitude: 16, declination: 20, house: 2 },
    { body: 'Saturn', longitude: 120, declination: -10, house: 5 },
  ] };
  const houses = { transits: [{ body: 'Jupiter', placidusIntervals: [
    { start: 0, end: 15, natalHouse: 10 }, { start: 15, end: 20, natalHouse: 7 },
  ] }] };
  const band = (progressedBody, natalTargetId, aspectType, start, end, targetKind = 'progressed') =>
    ({ progressedBody, natalTargetId, aspectType, start, end, targetKind, coordinate: 'ecliptic_longitude',
      allowedOrb: 1, exactTimes: [start] });
  const frame = (annualStart, annualEnd, first, seventh, tenth) => {
    const cusps = cuspSigns.map(sign => sign * 30);
    [cusps[0], cusps[6], cusps[9]] = [first, seventh, tenth].map(sign => sign * 30);
    return { annualStart, annualEnd, cusps };
  };
  const rows = buildLeoJupiterHouseContexts(natal, houses, [
    band('Mars', 'Saturn', 'trine', 10, 12, 'natal'),
  ], {
    frames: [frame(0, 6, 6, 0, 3), frame(6, 18, 7, 1, 4)],
    directions: [
      band('Moon', 'Venus', 'trine', 2, 10), band('Venus', 'Moon', 'trine', 2, 10),
      band('Sun', 'Mars', 'trine', 0, 20, 'natal'), band('Sun', 'Mars', 'sextile', 6, 8),
      band('Sun', 'Mars', 'trine', 8, 10), band('Mars', 'Venus', 'square', 16, 17),
    ],
  });
  const tenth = rows.filter(row => row.natalHouse === 10);
  assert.deepEqual(tenth.map(row => [row.start, row.end, row.annualRulers.ascendantRuler, row.annualRulerDirectionCandidate]),
    [[0, 2, 'Venus', false], [2, 6, 'Venus', true], [6, 8, 'Mars', false], [8, 10, 'Mars', true],
      [10, 12, 'Mars', false], [12, 15, 'Mars', false]]);
  assert.equal(tenth[1].annualRulers.activeDirections.length, 1);
  assert.deepEqual(tenth[2].annualRulers.activeDirections.map(row => row.aspectType), ['sextile']);
  const facts = rows.map(row => ({
    factType: 'leo_jupiter_house_ruler_context', scope: 'transit', completeness: 'complete',
    normalizedPayload: { ...leoJupiterHousePolicy, ...row, transitBody: 'Jupiter' },
  }));
  const evaluate = (id, input = facts) => evaluateFortuneRules('western', 'year', input)
    .find(row => row.knowledgeId.endsWith(id + '-001')).required[0];
  assert.deepEqual(evaluate('leo-v1-transit-p007').hits.map(row => row.normalizedPayload.start), tenth.map(row => row.start));
  assert.deepEqual(rows.filter(row => row.natalHouse === 7 && row.annualRulerHasContact).map(row => row.start), [16]);
  assert.equal(rows.find(row => row.natalHouse === 7 && row.start === 18).annualRulerHasContact, undefined);
  const unscanned = buildLeoJupiterHouseContexts(natal, houses, [], {
    frames: [frame(0, 15, 8, 6, 9)], directions: [],
  }).find(row => row.natalHouse === 10);
  assert.deepEqual([unscanned.annualRulers.ascendantRuler, unscanned.annualRulers.houseRuler], ['Jupiter', 'Saturn']);
  assert.equal(unscanned.annualRulerDirectionCandidate, undefined);
  const unavailable = { ...facts.at(-1), normalizedPayload: { ...leoJupiterHousePolicy, ...unscanned, transitBody: 'Jupiter' } };
  assert.deepEqual(evaluate('leo-v1-transit-p007', [unavailable]).hits, [unavailable]);
});

test('Jupiter through the seventh records a Placidus passage independently of the cusp-ruler audit', () => {
  const natal = chart(Date.parse('1984-01-08T12:00:00Z'), 198);
  const run = calculate(natal);
  validateFortuneFacts(run);
  const [fact] = houseContexts(run, 7);
  const p = fact.normalizedPayload;
  assert.deepEqual([p.ascendantRuler, p.ascendantRulerHouse, p.houseRuler, p.houseRulerHouse], ['Saturn', 10, 'Moon', 3]);
  assert.ok(p.natalAspects.some(aspect => aspect.aspect === 'trine' && aspect.difference < 1 && aspect.orb === 8));
  assert.deepEqual(p.activeDirections.map(row => [row.progressedBody, row.natalTargetId, row.aspectType, row.repeatsNatalAspect]),
    [['Saturn', 'Moon', 'trine', true]]);
  const match = houseMatch(run, 'leo-v1-transit-p006');
  assert.equal(match.status, 'matched');
  const passages = run.facts.filter(row => row.factType === 'traditional_house_interval'
    && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.natalHouse === 7);
  assert.ok(passages.length);
  assert.deepEqual(match.sourceFactIds, passages.map(row => row.factId));
  const withoutRulers = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType) };
  assert.deepEqual(houseMatch(withoutRulers, 'leo-v1-transit-p006').windows, match.windows);
  const wholeSign = { ...run, facts: run.facts.map(row => passages.includes(row)
    ? { ...row, normalizedPayload: { ...row.normalizedPayload, houseSystem: 'whole-sign' } } : row) };
  assert.equal(houseMatch(wholeSign, 'leo-v1-transit-p006').status, 'not_matched');
  assert.match(housePrompt(run), /行运木星经过本命第7宫/u);
});

test('Jupiter in the tenth retains repeated ruler evidence alongside the basic house match', () => {
  const run = calculate(chart(Date.parse('1990-04-01T12:00:00Z'), 93));
  validateFortuneFacts(run);
  const bands = houseContexts(run, 10);
  const native = bands.filter(row => row.normalizedPayload.sameRulerDirectionCandidate);
  const [supported] = native;
  const before = bands.find(row => row.activeTo === supported.activeFrom);
  assert.equal(before.activeTo, supported.activeFrom);
  assert.equal(before.normalizedPayload.sameRulerDirectionCandidate, false);
  assert.deepEqual(before.normalizedPayload.activeDirections, []);
  const p = supported.normalizedPayload;
  assert.deepEqual([p.ascendantRuler, p.houseRuler, p.sameRulerDirectionCandidate], ['Venus', 'Moon', true]);
  assert.ok(p.natalAspects.some(row => row.aspect === 'trine' && row.orb === 8));
  // This example requires the reverse progression direction. The annual
  // natal-ruler labels remain fixed when the seventh/tenth ruler is directed.
  assert.deepEqual(p.activeDirections.map(row => [row.progressedBody, row.natalTargetId, row.aspectType, row.allowedOrb]),
    [['Moon', 'Venus', 'trine', 1]]);
  assert.ok(p.activeDirections[0].exactTimes.every(at => supported.activeFrom <= at && at < supported.activeTo));
  assert.equal(native.flatMap(row => row.normalizedPayload.activeDirections.flatMap(direction => direction.exactTimes)).length, 1);
  const match = houseMatch(run, 'leo-v1-transit-p007');
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, bands.map(row => row.factId));
  assert.ok(match.windows.some(window => window.start <= supported.activeFrom && native.at(-1).activeTo <= window.endExclusive));
  assert.ok(match.sourceFactIds.includes(before.factId));
  const prompt = housePrompt(run);
  assert.match(prompt, /同段次限月亮对本命金星为三分相，重复这对宫主的本命相位/u);
  assert.doesNotMatch(prompt, /sameRulerDirectionCandidate|activeDirections|leo_jupiter_house_ruler_context/u);
});

test('a real tenth-house passage supports the basic reputation theme without a repeated direction', () => {
  const run = calculate(chart(birthAt, 96));
  const bands = houseContexts(run, 10);
  assert.ok(bands.length && bands.every(row => row.normalizedPayload.sameRulerDirectionCandidate === false));
  assert.ok(bands.some(row => row.normalizedPayload.activeDirections.some(direction =>
    direction.aspectType === 'quincunx' && direction.repeatsNatalAspect === false)));
  const match = houseMatch(run, 'leo-v1-transit-p007');
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, bands.map(row => row.factId));
  assert.ok(match.windows.length);
});

test('real client facts reach both annual Jupiter ruler branches without borrowing the natal pair', () => {
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-11-18T03:00:00Z');
  const cases = [
    { house: 7, id: 'leo-v1-transit-p006', born: '1965-01-01T12:00:00Z', armc: 192 },
    { house: 10, id: 'leo-v1-transit-p007', born: '1968-05-20T12:00:00Z', armc: 111 },
  ];
  for (const { house, id, born, armc } of cases) {
    const epoch = Date.parse(born), ref = { snapshotId: 'jupiter-annual-' + house };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, asOf, { ...ref, chart: chart(epoch, armc) })));
    const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, asOf), 'jupiter-annual-rulers', ref);
    const match = houseMatch(run, id), rows = houseContexts(run, house);
    assert.equal(match.status, 'matched');
    const fact = rows.find(row => house === 7
      ? !row.normalizedPayload.natalHasRulerAspect && row.normalizedPayload.annualRulerHasContact
      : match.sourceFactIds.includes(row.factId) && !row.normalizedPayload.sameRulerDirectionCandidate
        && row.normalizedPayload.annualRulerDirectionCandidate);
    assert.ok(fact, id);
    const p = fact.normalizedPayload, frame = p.annualRulers;
    assert.ok(frame.annualStart <= fact.activeFrom && fact.activeTo <= frame.annualEnd);
    assert.deepEqual([frame.ascendantRuler, frame.houseRuler], ['Jupiter', 'Mercury']);
    if (house === 10) {
      assert.deepEqual([p.ascendantRuler, p.houseRuler], ['Venus', 'Moon']);
      assert.ok(p.natalAspects.some(row => row.aspect === 'sextile'));
    }
    if (house === 10) {
      assert.deepEqual(match.sourceFactIds, rows.map(row => row.factId));
    }
    const withoutAnnual = { ...fact, normalizedPayload: { ...p, annualRulerHasContact: false, annualRulerDirectionCandidate: false } };
    const comparison = evaluateFortuneRules('western', 'year', [withoutAnnual]).find(row => row.knowledgeId.endsWith(id + '-001'));
    assert.deepEqual(comparison.required[0].hits, house === 7 ? [] : [withoutAnnual]);
    assert.equal(comparison.required[0].unknown, house === 7);
    assert.ok(run.facts.some(row => row.factType === 'traditional_house_interval'
      && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.natalHouse === house
      && row.activeFrom <= fact.activeFrom && fact.activeTo <= row.activeTo));
    const mid = (Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2;
    const sky = progressionEpoch(epoch, mid);
    const separation = Math.abs((readProgressionPosition('Mercury', sky, epoch).longitude
      - readProgressionPosition('Jupiter', sky, epoch).longitude + 540) % 360 - 180);
    assert.ok(Math.abs(separation - 60) < 1, id);
    const prompt = housePrompt(run);
    if (house === 10) assert.match(prompt, /同段年度宫主相位为次限水星对同图次限木星的六合相/u);
    assert.doesNotMatch(prompt, /annualRulerDirectionCandidate|leo-jupiter-rulers-in-annual-chart-v1|jupiter-annual-rulers/u);
  }
});

test('source units retain whole signs, 28-day months and 7/3-day days, with an explicitly clamped anniversary clock and equal day/night lot formula', () => {
  const born = Date.parse('2000-02-29T12:34:56Z');
  assert.equal(new Date(birthAnniversary(born, 1)).toISOString(), '2001-02-28T12:34:56.000Z');
  assert.equal(new Date(birthAnniversary(born, 4)).toISOString(), '2004-02-29T12:34:56.000Z');
  const start = Date.parse('2026-01-01T04:00:00Z');
  const rows = buildPtolemyPlaces({ start, end: start + 60 * day }, birthAt, [{ origin: 'ASC', longitude: 359.9 }], 'day');
  assert.equal(rows.find(r => r.level === 'year').sign, 11);
  const months = rows.filter(r => r.level === 'month'); assert.equal(months[1].fullPeriodStart - months[0].fullPeriodStart, 28 * day);
  assert.equal(months[1].sign, 0); assert.equal(months[1].ruler, 'Mars');
  assert.deepEqual([months[1].annualSign, months[1].annualRuler, months[1].monthSign, months[1].monthlyRuler],
    [11, 'Jupiter', 0, 'Mars']);
  const days = rows.filter(r => r.level === 'day'); assert.equal(days[1].fullPeriodStart - days[0].fullPeriodStart, 7 * day / 3);
  assert.equal(days[11].fullPeriodEnd, months[0].fullPeriodEnd);
  assert.deepEqual([days[1].annualRuler, days[1].monthlyRuler, days[1].ruler], ['Jupiter', 'Jupiter', 'Mars']);
  assert.equal(ptolemyLot(10, 350, 20), 40); assert.equal(ptolemyLot(350, 20, 350), 320);
  assert.equal(ptolemySignRuler(10), 'Saturn'); assert.equal(ptolemySignRuler(11), 'Jupiter');
  assert.equal(ptolemySignAspect(11, 1), 'sextile'); assert.equal(ptolemySignAspect(2, 8), 'opposition');
  assert.equal(ptolemySignAspect(0, 1), undefined); assert.throws(() => ptolemyLot(NaN, 10, 20));
});

test('all sixty Egyptian terms respect the printed widths and unrounded half-open boundaries', () => {
  const widthsBySign = [
    'Jupiter 6,Venus 6,Mercury 8,Mars 5,Saturn 5',
    'Venus 8,Mercury 6,Jupiter 8,Saturn 5,Mars 3',
    'Mercury 6,Jupiter 6,Venus 5,Mars 7,Saturn 6',
    'Mars 7,Venus 6,Mercury 6,Jupiter 7,Saturn 4',
    'Jupiter 6,Venus 5,Saturn 7,Mercury 6,Mars 6',
    'Mercury 7,Venus 10,Jupiter 4,Mars 7,Saturn 2',
    'Saturn 6,Mercury 8,Jupiter 7,Venus 7,Mars 2',
    'Mars 7,Venus 4,Mercury 8,Jupiter 5,Saturn 6',
    'Jupiter 12,Venus 5,Mercury 4,Saturn 5,Mars 4',
    'Mercury 7,Jupiter 7,Venus 8,Saturn 4,Mars 4',
    'Mercury 7,Venus 6,Jupiter 7,Mars 5,Saturn 5',
    'Venus 12,Jupiter 4,Mercury 3,Mars 9,Saturn 2',
  ];
  for (const [sign, row] of widthsBySign.entries()) {
    let start = 0;
    for (const pair of row.split(',')) {
      const [ruler, width] = pair.split(' '), end = start + Number(width);
      assert.deepEqual(ptolemyNatalGovernors(sign * 30 + start).term, { ruler, start, end });
      assert.deepEqual(ptolemyNatalGovernors(sign * 30 + end - 1e-9).term, { ruler, start, end });
      start = end;
    }
    assert.equal(start, 30);
  }
  assert.equal(ptolemyNatalGovernors(5.999999999999999).term.ruler, 'Jupiter');
  assert.equal(ptolemyNatalGovernors(6).term.ruler, 'Venus');
  assert.throws(() => ptolemyNatalGovernors(360));
  assert.deepEqual(ptolemyNatalGovernors(95, 'day').triplicityRulers, ['Mars', 'Venus']);
  assert.deepEqual(ptolemyNatalGovernors(95, 'night').triplicityRulers, ['Mars', 'Moon']);
  assert.deepEqual(ptolemyNatalGovernors(95).triplicityRulers, ['Mars']);
  assert.deepEqual(ptolemyNatalGovernors(4).triplicityRulers, []);
  assert.equal(ptolemyNatalGovernors(95, 'night').exaltationRuler, 'Jupiter');
  assert.equal(ptolemyPlanetSect('Mercury', 350, 5), 'day');
  assert.equal(ptolemyPlanetSect('Mercury', 5, 350), 'night');
  assert.equal(ptolemyPlanetSect('Mercury', 5, 5), undefined);
});

test('nested candidate periods cover each query exactly, preserve annual and short-tail boundaries and never force 28-day units into twelve months', () => {
  const start = Date.parse('2026-01-01T04:00:00Z'), end = Date.parse('2027-01-01T04:00:00Z');
  const rows = buildPtolemyPlaces({ start, end }, birthAt, [{ origin: 'Moon', longitude: 100 }], 'day');
  for (const level of ['year', 'month', 'day']) {
    const periods = rows.filter(p => p.level === level).sort((a, b) => a.start - b.start);
    assert.equal(periods[0].start, start); assert.equal(periods.at(-1).end, end);
    for (let i = 1; i < periods.length; i++) assert.equal(periods[i - 1].end, periods[i].start);
  }
  const months = rows.filter(p => p.level === 'month');
  assert.equal(months.length, 14); assert.equal(months.at(-1).end - months.at(-1).start, day);
  const boundary = start + 28 * day;
  const exact = buildPtolemyPlaces({ start: boundary, end: boundary + 1 }, birthAt, [{ origin: 'Moon', longitude: 100 }], 'day');
  assert.equal(exact.find(p => p.level === 'month').monthIndex, 1);
  assert.equal(exact.find(p => p.level === 'day').dayIndex, 0);
  const beforeBirthday = buildPtolemyPlaces({ start: start - day, end: start + day }, birthAt, [{ origin: 'Sun', longitude: 10 }], 'year');
  assert.deepEqual(beforeBirthday.map(p => p.completedYears), [35, 36]);
  assert.throws(() => buildPtolemyPlaces({ start: birthAt - 1, end: birthAt + 1 }, birthAt, [{ origin: 'Sun', longitude: 10 }], 'day'));
});

test('Ptolemy isolates manuscript-only lunar occupancy and clips both day lengths at the monthly and annual edges', () => {
  const reference = { snapshotId: 'ptolemy-day-manuscript-edges', chart: chart(birthAt, 30) };
  const submit = date => {
    const params = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'UTC' };
    const now = Date.parse(date + 'T10:00:00Z');
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    return run;
  };
  const moonOn = origin => ({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'day' && p.origin === origin && p.transitBody === 'Moon';
  const actualMoonSign = at => sign(Ecliptic(GeoVector(Body.Moon, new Date(at), true)).elon);
  const midheavenDay = submit('2026-05-19');
  const ordinary = midheavenDay.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && ['square', 'opposition'].includes(p.aspectType));
  assert.ok(ordinary);
  assert.equal(ordinary.normalizedPayload.enteredDuringTimedPlace, undefined);
  assert.equal(ordinary.normalizedPayload.dayManuscriptMoonContact, undefined);
  const manuscript = midheavenDay.facts.find(fact => moonOn('MC')(fact) && fact.normalizedPayload.aspectType === 'none');
  assert.ok(manuscript);
  const q = manuscript.normalizedPayload;
  assert.deepEqual([q.sign, q.alternateManuscriptDaySign, q.transitSign, q.dayManuscriptMoonContact, q.dayManuscriptAgreement],
    [4, 3, 3, true, 'different-place']);
  assert.ok(Math.abs(Date.parse(manuscript.exactInstant) - Date.parse('2026-05-19T01:46:03.281Z')) < 1000);
  assert.deepEqual([actualMoonSign(Date.parse(manuscript.exactInstant) - 2000), actualMoonSign(Date.parse(manuscript.exactInstant) + 2000)], [2, 3]);
  assert.equal(q.dayManuscriptEnteredDuringTimedPlace, true);
  assert.equal(q.dayManuscriptIngressAt, manuscript.exactInstant);
  assert.equal(q.timedPlaceIngressAt, undefined);
  const manuscriptRun = { ...midheavenDay, facts: [manuscript] };
  const manuscriptMatch = result(manuscriptRun, 29);
  assert.equal(manuscriptMatch.status, 'matched');
  assert.deepEqual(manuscriptMatch.sourceFactIds, [manuscript.factId]);
  assert.deepEqual(manuscriptMatch.windows, [{ start: manuscript.activeFrom, endExclusive: manuscript.activeTo }]);
  const { input: verifier } = buildFortuneModelContext(manuscriptRun,
    interpretFortune(manuscriptRun, requestForFortuneRun(manuscriptRun), reference.snapshotId), reference.snapshotId);
  const audit = formatFortuneFactAudit(verifier);
  assert.match(audit, /月亮实际与手稿日位同在/u);
  assert.match(audit, /两种日位取法分别核对/u);
  assert.match(audit, /月亮实际在手稿日段内入座/u);
  const prompt = formatFortunePrompt(verifier);
  assert.match(prompt, /两份手稿日段，每两天半推进一座/u);
  assert.doesNotMatch(prompt, /dayManuscript|月亮实际与手稿日位同在|月亮实际在手稿日段内入座|01:46:03/u);

  const followingDay = submit('2026-05-20');
  const carry = followingDay.facts.find(fact => moonOn('MC')(fact) && fact.normalizedPayload.aspectType === 'none');
  assert.ok(carry);
  const continued = result({ ...followingDay, facts: [carry] }, 29);
  assert.equal(continued.status, 'matched');
  assert.deepEqual(continued.windows, [{ start: carry.activeFrom, endExclusive: carry.activeTo }]);
  const versionsMixed = { ...carry, normalizedPayload: { ...carry.normalizedPayload, dayManuscriptMoonContact: false } };
  assert.equal(result({ ...followingDay, facts: [versionsMixed] }, 29).status, 'not_matched');
  assert.equal(carry.exactInstant, undefined);
  assert.ok(Math.abs(Date.parse(carry.normalizedPayload.dayManuscriptIngressAt) - Date.parse(q.dayManuscriptIngressAt)) < 1_000);
  assert.equal(carry.normalizedPayload.timedPlaceIngressAt, undefined);

  const monthBoundary = '2026-05-21T04:00:00.000Z';
  const monthEnd = submit('2026-05-21');
  const oldMonth = monthEnd.facts.find(fact => moonOn('MC')(fact) && fact.normalizedPayload.dayManuscriptAgreement === 'same-place');
  assert.deepEqual([oldMonth.activeTo, oldMonth.normalizedPayload.dayManuscriptPeriodEnd, oldMonth.normalizedPayload.monthIndex],
    [monthBoundary, monthBoundary, 4]);
  const monthReset = monthEnd.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_time_place'
    && p.origin === 'MC' && p.level === 'day' && p.fullPeriodStart === monthBoundary);
  assert.deepEqual([monthReset.normalizedPayload.monthIndex, monthReset.normalizedPayload.dayIndex], [5, 0]);
  assert.ok(!monthEnd.facts.some(fact => moonOn('MC')(fact) && fact.normalizedPayload.monthIndex === 4 && fact.activeFrom >= monthBoundary));

  const laterAgreement = submit('2026-08-15');
  const later = laterAgreement.facts.find(fact => moonOn('Sun')(fact) && fact.normalizedPayload.sign === 6
    && fact.normalizedPayload.dayManuscriptAgreement === 'same-place');
  assert.equal(later.activeFrom, '2026-08-15T16:00:00.000Z');
  const l = later.normalizedPayload;
  assert.ok(Math.abs(Date.parse(l.timedPlaceIngressAt) - Date.parse('2026-08-15T14:19:39.711Z')) < 1_000);
  assert.deepEqual([l.enteredDuringTimedPlace, l.dayManuscriptEnteredDuringTimedPlace, l.dayManuscriptIngressAt, later.exactInstant],
    [true, false, undefined, undefined]);
  assert.equal(result({ ...laterAgreement, facts: [later] }, 29).status, 'matched');

  const annualBoundary = '2027-01-01T04:00:00.000Z';
  const pieces = submit('2027-01-01').facts.filter(fact => moonOn('Fortune')(fact)
    && fact.normalizedPayload.dayManuscriptAgreement === 'same-place');
  assert.equal(pieces.length, 2);
  const [before, after] = pieces;
  assert.deepEqual([before.activeTo, after.activeFrom, before.normalizedPayload.dayManuscriptPeriodEnd, after.normalizedPayload.dayManuscriptPeriodStart],
    Array(4).fill(annualBoundary));
  assert.deepEqual(pieces.map(({ normalizedPayload: p }) => [p.monthIndex, p.dayIndex, p.sign, p.alternateManuscriptDaySign]),
    [[13, 0, 6, 6], [0, 0, 6, 6]]);
  assert.deepEqual(pieces.map(({ normalizedPayload: p }) => [p.enteredDuringTimedPlace, p.dayManuscriptEnteredDuringTimedPlace]),
    [[false, false], [false, false]]);
  assert.equal(before.normalizedPayload.dayManuscriptPeriodStart, '2026-12-31T04:00:00.000Z');
  assert.equal(after.normalizedPayload.annualStart, annualBoundary);
  assert.equal(actualMoonSign(Date.parse(annualBoundary) - 1), 6);
  assert.equal(actualMoonSign(Date.parse(annualBoundary)), 6);
});

test('real source sign contacts are genuine ephemeris intersections and do not manufacture a fresh ingress at a timing boundary', () => {
  const run = realRun(); validateFortuneFacts(run); assert.notEqual(run.methods.western.status, 'failed');
  const places = run.facts.filter(f => f.factType === 'ptolemy_time_place');
  const byOrigin = Map.groupBy(places, fact => fact.normalizedPayload.origin);
  assert.equal(byOrigin.size, 5);
  for (const slices of byOrigin.values()) {
    assert.equal(new Set(slices.map(f => f.normalizedPayload.completedYears)).size, 2);
    const ordered = slices.toSorted((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    for (let i = 1; i < ordered.length; i++) assert.equal(ordered[i].activeFrom, ordered[i - 1].activeTo);
  }
  const contacts = run.facts.filter(f => f.factType === 'ptolemy_ingress_contact' && f.normalizedPayload.level !== 'authorTerm');
  assert.ok(contacts.length);
  for (const fact of contacts) {
    const p = fact.normalizedPayload, at = (Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2;
    const actual = p.transitBody === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[p.transitBody], new Date(at), true)).elon;
    assert.equal(sign(actual), p.transitSign); assert.equal(ptolemySignAspect(p.sign, p.transitSign), p.aspectType);
    assert.equal(p.sameAsAnnualLord, p.transitBody === p.annualRuler);
    assert.equal(p.natalGovernors.sign, sign(p.natalLongitude));
    assert.equal(p.annualOriginAspect, ptolemySignAspect(p.annualSign, p.natalGovernors.sign) ?? 'none');
    assert.equal(p.transitAnnualAspect, ptolemySignAspect(p.transitSign, p.annualSign) ?? 'none');
    if (p.level === 'month') {
      assert.equal(p.sameAsMonthlyLord, true);
      assert.equal(p.monthlyOriginAspect, ptolemySignAspect(p.sign, p.natalGovernors.sign) ?? 'none');
      assert.equal(p.transitMonthlyAspect, 'conjunction');
    } else if (p.level === 'day') {
      assert.equal(p.sameAsDailyLord, true);
      assert.equal(p.dayManuscriptAgreement, 'same-place');
      assert.equal(p.monthlyOriginAspect, ptolemySignAspect(p.monthSign, p.natalGovernors.sign) ?? 'none');
      assert.equal(p.transitMonthlyAspect, ptolemySignAspect(p.transitSign, p.monthSign) ?? 'none');
    } else {
      assert.equal(p.sameAsMonthlyLord, undefined);
      assert.equal(p.monthlyOriginAspect, undefined);
      assert.equal(p.transitMonthlyAspect, undefined);
    }
    assert.equal(p.natalGovernors.natalSect, 'night');
    if (!p.physicalIngressAt) assert.equal(fact.exactInstant, undefined);
    else {
      assert.equal(fact.exactInstant, p.physicalIngressAt);
      assert.ok(Date.parse(fact.activeFrom) <= Date.parse(fact.exactInstant) && Date.parse(fact.exactInstant) < Date.parse(fact.activeTo));
    }
  }
  assert.ok(contacts.some(f => !f.exactInstant)); assert.ok(contacts.some(f => f.exactInstant));
  assert.equal(result(run, 27).status, 'matched');
  assert.match(fortuneKnowledge.western.rules[27].unresolved.join(), /总|总体/u);
  const originalRuler = contacts.find(({ normalizedPayload: p }) => p.origin === 'ASC'
    && p.level === 'year' && p.sameAsAnnualLord && p.aspectType === 'conjunction' && p.transitBody === 'Moon');
  assert.ok(originalRuler);
  assert.deepEqual(originalRuler.normalizedPayload.natalRulership, ['domicile', 'triplicity']);
  const originalRulerMatch = result({ ...run, facts: [originalRuler] }, 31);
  assert.equal(originalRulerMatch.status, 'matched');
  assert.deepEqual(originalRulerMatch.windows, [{ start: originalRuler.activeFrom, endExclusive: originalRuler.activeTo }]);
  assert.deepEqual(originalRulerMatch.sourceFactIds, [originalRuler.factId]);
  assert.match(originalRulerMatch.matchedConditions.join(), /年度守护星本人实际经过所主的年度星座/u);
  const annualPhases = run.facts.filter(fact => fact.factType === 'ptolemy_lunar_phase_contact');
  assert.ok(annualPhases.length > 200);
  for (const { exactInstant, activeTo, normalizedPayload: p } of annualPhases) {
    const annual = byOrigin.get(p.origin).find(row => row.activeFrom <= exactInstant && exactInstant < row.activeTo);
    assert.ok(annual);
    const at = Date.parse(exactInstant), annualStart = Date.parse(annual.normalizedPayload.annualStart);
    const monthIndex = Math.floor((at - annualStart) / (28 * day));
    assert.equal(p.monthSign, (annual.normalizedPayload.annualSign + monthIndex) % 12);
    assert.deepEqual([p.natalOriginSign, p.annualRuler],
      [annual.normalizedPayload.natalGovernors.sign, annual.normalizedPayload.annualRuler]);
    assert.equal(p.monthlyRuler, ptolemySignRuler(p.monthSign));
    assert.equal(p.annualOriginAspect, ptolemySignAspect(p.natalOriginSign, p.annualSign) ?? 'none');
    assert.equal(p.monthlyOriginAspect, ptolemySignAspect(p.natalOriginSign, p.monthSign) ?? 'none');
    assert.equal(p.moonSign, sign(Ecliptic(GeoVector(Body.Moon, new Date(at), true)).elon));
    assert.equal(p.solarSign, sign(SunPosition(new Date(at)).elon));
    assert.equal(p.solarMonthlyAspect, ptolemySignAspect(p.solarSign, p.monthSign) ?? 'none');
    assert.ok(Date.parse(activeTo) <= Math.min(annualStart + (monthIndex + 1) * 28 * day, Date.parse(annual.normalizedPayload.annualEnd)));
  }
  assert.ok(annualPhases.every(({ normalizedPayload: p }) => !p.phaseIngressContacts.some(row => row.level === 'year')));
  assert.ok(annualPhases.some(({ normalizedPayload: p }) => p.phaseIngressContacts.some(row => row.level === 'month')));
  const januaryFullMoon = annualPhases.find(({ exactInstant, normalizedPayload: p }) =>
    exactInstant === '2026-01-03T10:03:26.043Z' && p.origin === 'ASC');
  assert.ok(januaryFullMoon);
  assert.deepEqual(januaryFullMoon.normalizedPayload.phaseCarryContacts.filter(row => row.level === 'year'),
    [{ level: 'year', body: 'Jupiter', sign: 3, timeRuler: 'Moon' }]);
  const jupiterCarry = contacts.find(({ activeFrom, activeTo, normalizedPayload: p }) =>
    p.origin === 'ASC' && p.transitBody === 'Jupiter' && p.enteredDuringTimedPlace === false && p.aspectType === 'conjunction'
      && activeFrom <= januaryFullMoon.exactInstant && januaryFullMoon.activeTo <= activeTo);
  assert.ok(jupiterCarry);
  for (const at of [jupiterCarry.normalizedPayload.annualStart, januaryFullMoon.exactInstant]) {
    assert.equal(sign(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon), 3);
  }
  const carryResult = result({ ...run, facts: [jupiterCarry] }, 27);
  assert.equal(carryResult.status, 'matched');
  assert.deepEqual(carryResult.windows, [{ start: jupiterCarry.activeFrom, endExclusive: jupiterCarry.activeTo }]);
  assert.ok(annualPhases.filter(({ normalizedPayload: p }) => p.origin === 'ASC' && p.annualSign === 3 && p.moonSign === 4)
    .some(({ normalizedPayload: p }) => !p.phaseCarryContacts.some(row => row.level === 'year')));
  const { input: annualModel } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-full-moon-carry'));
  const annualAudit = formatFortuneFactAudit(annualModel);
  assert.match(annualAudit, /月相真点时，同一起点的年级木星仍在巨蟹座，本时限内未核到新的入座/u);
  assert.doesNotMatch(annualAudit, /同一起点的年级位置在巨蟹座，木星于[^。]+实际入座/u);
  assert.doesNotMatch(formatFortunePrompt(annualModel), /本时限内未核到新的入座|phaseCarryContacts/u);

  const annualSeries = buildPtolemyTimes({ start: Date.UTC(2026, 0), end: Date.UTC(2027, 0) }, 'year', chart(birthAt, 30), []);
  const annualJupiter = { level: 'year', body: 'Jupiter', sign: 4, timeRuler: 'Sun' };
  const ascendantPhases = annualSeries.lunarPhaseContacts.filter(row => row.origin === 'ASC');
  const july = ascendantPhases.find(row => row.start >= Date.UTC(2026, 6));
  assert.ok(july.start > Date.parse('2026-06-30T05:56:15.218Z'));
  const ingress = july.phaseIngressContacts.find(row => row.body === 'Jupiter');
  assert.ok(ingress);
  const { ingressAt: jupiterIngressAt, ...jupiterPlace } = ingress;
  assert.deepEqual(jupiterPlace, annualJupiter);
  assert.ok(Math.abs(Date.parse(jupiterIngressAt) - Date.parse('2026-06-30T05:56:15.218Z')) < 1_000);
  assert.ok(ascendantPhases.filter(row => row.start < Date.parse(jupiterIngressAt)).every(row => !row.phaseIngressContacts.length));

  const dailySeries = buildPtolemyTimes({ start: Date.UTC(2026, 0, 2, 16), end: Date.UTC(2026, 0, 3, 16) }, 'day', chart(), []);
  const fullMoon = dailySeries.lunarPhaseContacts.find(row => row.origin === 'ASC');
  assert.equal(fullMoon.phase, 'full_moon');
  const moonIngress = fullMoon.phaseIngressContacts.find(row => row.level === 'day' && row.body === 'Moon');
  assert.ok(moonIngress);
  assert.deepEqual([moonIngress.sign, moonIngress.timeRuler], [3, 'Moon']);
  assert.ok(Date.parse(moonIngress.ingressAt) < Date.UTC(2026, 0, 2, 16));
  assert.ok(Math.abs(Date.parse(moonIngress.ingressAt) - Date.parse('2026-01-02T13:08:55.034Z')) < 1_000);
  assert.ok(dailySeries.lunarPhaseContacts.filter(row => row.origin !== 'ASC').every(row =>
    !row.phaseIngressContacts.some(witness => witness.level === 'day' && witness.body === 'Moon')));
});

test('Ptolemy confirms the actual monthly ruler passage at the same origin in a year report', () => {
  const natal = chart(birthAt, 30);
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, 6, 15);
  const reference = { snapshotId: 'ptolemy-monthly-same-ruler', chart: natal };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const entry = fortuneKnowledge.western.rules[31];
  const confirm = facts => evaluateFortuneRules('western', 'year', facts).find(row => row.knowledgeId === entry.knowledgeId)
    .confirmations.find(query => JSON.parse(query.condition).where.sameAsMonthlyLord === true);
  const monthContacts = run.facts.filter(row => row.factType === 'ptolemy_ingress_contact' && row.normalizedPayload.level === 'month');
  assert.ok(monthContacts.length > 0);
  assert.ok(monthContacts.every(({ normalizedPayload: p }) => p.sameAsMonthlyLord === true && p.aspectType === 'conjunction'));
  assert.ok(!run.facts.some(row => row.factType === 'ptolemy_time_place' && row.normalizedPayload.level === 'month'));
  for (const [origin, body, index, adoptedSign, ingress, start, end] of [
    ['Sun', 'Sun', 7, 4, '2026-07-22T19:13:18.705Z', undefined, '2026-08-13T04:00:00.000Z'],
    ['Moon', 'Venus', 8, 6, undefined, '2026-08-13T04:00:00.000Z', '2026-09-10T04:00:00.000Z'],
  ]) {
    const slices = monthContacts.filter(({ normalizedPayload: p }) => p.origin === origin && p.transitBody === body && p.monthIndex === index)
      .sort((first, second) => first.activeFrom.localeCompare(second.activeFrom));
    const [fact] = slices;
    assert.ok(fact, origin);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.sign, p.transitSign, p.ruler, p.monthlyRuler, p.sameAsAnnualLord], [adoptedSign, adoptedSign, body, body, false]);
    assert.equal(slices.at(-1).activeTo, end);
    assert.ok(slices.every((slice, index) => slice.normalizedPayload.fullPeriodEnd === end
      && (index === 0 || slice.activeFrom === slices[index - 1].activeTo)));
    const read = at => sign(body === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[body], new Date(at), true)).elon);
    const at = Date.parse(fact.activeFrom);
    if (ingress) {
      assert.equal(fact.activeFrom, fact.exactInstant);
      assert.ok(Math.abs(at - Date.parse(ingress)) < 1_000);
      assert.deepEqual([read(at - 2_000), read(at + 2_000)], [adoptedSign - 1, adoptedSign]);
    } else {
      assert.equal(fact.activeFrom, start);
      assert.equal(fact.exactInstant, undefined);
      assert.equal(p.enteredDuringTimedPlace, false);
      assert.deepEqual([read(at - 1), read(at), read(Date.parse(end))], [adoptedSign, adoptedSign, adoptedSign]);
    }
    const samePlanet = monthContacts.filter(row => row.normalizedPayload.origin === origin && row.normalizedPayload.transitBody === body);
    for (const outside of [at - 1, Date.parse(end)]) {
      assert.ok(samePlanet.every(row => !(Date.parse(row.activeFrom) <= outside && outside < Date.parse(row.activeTo))));
    }
    const changed = changes => ({ ...fact, normalizedPayload: { ...p, ...changes } });
    assert.deepEqual(confirm([fact]).hits, [fact]);
    assert.deepEqual(confirm([changed({ sameAsMonthlyLord: false }), changed({ aspectType: 'trine' })]).hits, []);
    assert.equal(confirm([changed({ sameAsMonthlyLord: undefined })]).unknown, true);
    const isolated = { ...run, facts: [fact] };
    const matched = result(isolated, 31);
    assert.equal(matched.status, 'matched');
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.match(matched.matchedSourceExcerpt, /lords of both/u);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
    const audit = /实际过境星兼为该二十八日月位的守护星/u;
    assert.match(formatFortuneFactAudit(input), audit);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /同一星也是此月位守护星/u);
    assert.doesNotMatch(prompt, audit);
    assert.doesNotMatch(prompt, /sameAsMonthlyLord|2026-07-22T19:13|2026-08-13T04:00/u);
  }
});

test('Ptolemy checks natal rulership as a separate support for the actual monthly co-ruler', () => {
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, 6, 15), reference = { snapshotId: 'ptolemy-monthly-natal-ruler', chart: chart(birthAt, 40) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const witness = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'Fortune' && p.transitBody === 'Venus'
    && p.sameAsMonthlyLord && p.natalRulership.includes('domicile') && activeFrom === '2026-12-03T04:00:00.000Z');
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.sign, p.transitSign, p.natalGovernors.sign], [6, 6, 6]);
  assert.equal(ptolemySignRuler(p.natalGovernors.sign), p.transitBody);
  const venusAt = at => sign(Ecliptic(GeoVector(Body.Venus, new Date(at), true)).elon);
  assert.equal(venusAt(Date.parse(witness.activeFrom)), 6);
  assert.equal(venusAt(Date.parse(witness.activeTo) + 2_000), 7);
  const selected = { ...run, facts: [witness] };
  const hit = result(selected, 31), phrase = /出生时已掌这一主题/u;
  assert.equal(hit.status, 'matched');
  assert.match(hit.matchedSourceExcerpt, /if they govern the species of the cause/u);
  assert.deepEqual(hit.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), reference.snapshotId));
  assert.match(formatFortunePrompt(input), phrase);
  assert.doesNotMatch(formatFortunePrompt(input), /natalRulership|2026-12-03T04:00/u);
  const lackingNatalDuty = { ...witness, normalizedPayload: { ...p, natalRulership: [] } };
  const ordinary = result({ ...run, facts: [lackingNatalDuty] }, 31);
  assert.equal(ordinary.status, 'matched');
  assert.equal(ordinary.matchedSourceExcerpt, 'lords of both');
  const conditions = ordinary.matchedConditions ?? ordinary.confirmedBranches.flatMap(branch => branch.conditions);
  assert.doesNotMatch(conditions.join(' '), phrase);
});

test('complete lunations include the preceding new moon, stay distinct from civil months and share a canonical half-open boundary', () => {
  const start = Date.parse('2026-11-18T00:00:00Z'), end = start + day;
  const [row] = buildLunationWindows({ start, end });
  assert.equal(row.start, start); assert.equal(row.end, end); assert.ok(row.newMoonAt < start && row.nextNewMoonAt > end);
  assert.equal(row.startsBeforeQuery, true); assert.equal(row.endsAfterQuery, true);
  const phase = MoonPhase(new Date(row.newMoonAt)); assert.ok(Math.min(phase, 360 - phase) < 0.0002);
  const boundary = row.nextNewMoonAt;
  const left = buildLunationWindows({ start: boundary - day, end: boundary });
  const right = buildLunationWindows({ start: boundary, end: boundary + day });
  assert.equal(left.length, 1); assert.equal(right.length, 1); assert.equal(left[0].nextNewMoonAt, right[0].newMoonAt);
  assert.equal(right[0].startsBeforeQuery, false);
});

test('Ptolemy preserves parent-year and parent-month real ingresses at the same phase across display periods', () => {
  const natal = chart(birthAt, 30);
  const reference = { snapshotId: 'ptolemy-parent-ingress', chart: natal };
  const lastQuarter = '2026-07-07T19:29:28.944Z';
  const expected = [
    ['ASC', 'year', 'Jupiter', 4, 'Sun', '2026-06-30T05:56:15.218Z'],
    ['Sun', 'month', 'Sun', 3, 'Moon', '2026-06-21T08:25:00.511Z'],
  ];
  const aspectPassages = [
    ['Moon', 'year', 'Jupiter', 4, 10, 'Saturn', 'opposition', 'opposition', 'conjunction', '2026-06-30T05:56:15.438Z'],
    ['ASC', 'month', 'Mars', 2, 10, 'Saturn', 'trine', 'sextile', 'trine', '2026-06-28T19:29:37.807Z'],
    ['ASC', 'month', 'Venus', 4, 10, 'Saturn', 'opposition', 'conjunction', 'opposition', undefined],
  ];
  for (const [periodType, targetPeriod] of [
    ['month', { year: 2026, month: 7 }],
    ['day', { date: '2026-07-07' }],
  ]) {
    const params = { periodType, targetPeriod, displayTimezone: 'UTC' };
    const now = Date.parse(lastQuarter);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const phases = run.facts.filter(fact => fact.factType === 'ptolemy_lunar_phase_contact' && fact.exactInstant === lastQuarter);
    assert.equal(phases.length, 5, periodType);
    const sunPhase = phases.find(row => row.normalizedPayload.origin === 'Sun');
    assert.deepEqual(sunPhase.normalizedPayload.phaseTransitAspectContacts, []);
    assert.deepEqual(sunPhase.normalizedPayload.phaseCarryContacts,
      [{ level: 'month', body: 'Mercury', sign: 3, timeRuler: 'Moon' }]);
    assert.ok(!sunPhase.normalizedPayload.phaseIngressContacts.some(row => row.body === 'Mercury'));
    const mercuryCarry = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
      factType === 'ptolemy_ingress_contact' && p.origin === 'Sun' && p.level === 'month' && p.transitBody === 'Mercury'
        && p.enteredDuringTimedPlace === false && activeFrom <= lastQuarter && sunPhase.activeTo <= activeTo);
    assert.ok(mercuryCarry, periodType);
    const mercuryMatch = evaluateFortuneRules('western', 'month', [mercuryCarry])
      .find(row => row.knowledgeId === fortuneKnowledge.western.rules[28].knowledgeId);
    assert.ok(mercuryMatch.confirmations[0].hits.some(row => row.factId === mercuryCarry.factId));
    for (const [origin, level, body, signAtPhase, timeSign, timeRuler, aspect, annualAspect, monthlyAspect, ingressAt] of aspectPassages) {
      const phaseFact = phases.find(row => row.normalizedPayload.origin === origin);
      const p = phaseFact.normalizedPayload;
      const passage = p.phaseTransitAspectContacts.find(row => row.level === level && row.body === body);
      assert.ok(passage, origin + ':' + body);
      assert.deepEqual({ ...passage, ingressAt: undefined },
        { level, body, sign: signAtPhase, timeSign, timeRuler, aspect, annualAspect, monthlyAspect, ingressAt: undefined });
      const at = Date.parse(lastQuarter);
      const longitude = date => Ecliptic(GeoVector(Body[body], new Date(date), true)).elon;
      assert.equal(sign(longitude(at)), signAtPhase);
      if (ingressAt) {
        const ingress = Date.parse(passage.ingressAt);
        assert.ok(Math.abs(ingress - Date.parse(ingressAt)) < 1_000 && ingress < Date.UTC(2026, 6, 1));
        assert.deepEqual([sign(longitude(ingress - 2_000)), sign(longitude(ingress + 2_000))], [signAtPhase - 1, signAtPhase]);
      } else {
        assert.equal(passage.ingressAt, undefined);
      }
      assert.ok(![...p.phaseIngressContacts, ...p.phaseCarryContacts].some(row => row.level === level && row.body === body));
      const transit = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: q }) =>
        factType === 'ptolemy_ingress_contact' && q.origin === origin && q.level === level && q.transitBody === body
        && q.aspectType === aspect && activeFrom <= lastQuarter && phaseFact.activeTo <= activeTo);
      assert.ok(transit);
      assert.equal(transit.normalizedPayload.enteredDuringTimedPlace, undefined);
      assert.equal(transit.normalizedPayload.timedPlaceIngressAt, undefined);
      assert.equal(transit.exactInstant, undefined);
      const entry = fortuneKnowledge.western.rules[level === 'year' ? 27 : 28];
      const scoped = evaluateFortuneRules('western', level, [transit]).find(row => row.knowledgeId === entry.knowledgeId);
      assert.deepEqual(scoped.required[0].hits, []);
    }
    for (const [origin, level, body, adoptedSign, ruler, ingressAt] of expected) {
      const fact = phases.find(row => row.normalizedPayload.origin === origin);
      const phase = fact.normalizedPayload;
      assert.equal(phase.phase, 'last_quarter', origin);
      const ingress = phase.phaseIngressContacts.find(row => row.level === level && row.body === body);
      assert.ok(ingress, origin);
      assert.deepEqual([ingress.sign, ingress.timeRuler], [adoptedSign, ruler], origin);
      const instant = Date.parse(ingress.ingressAt);
      assert.ok(Math.abs(instant - Date.parse(ingressAt)) < 1_000 && instant < Date.UTC(2026, 6, 1), origin);
      const longitude = time => body === 'Sun' ? SunPosition(new Date(time)).elon
        : Ecliptic(GeoVector(Body[body], new Date(time), true)).elon;
      assert.deepEqual([sign(longitude(instant - 2_000)), sign(longitude(instant + 2_000)),
        sign(longitude(Date.parse(lastQuarter)))], [adoptedSign - 1, adoptedSign, adoptedSign]);
      const transit = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
        factType === 'ptolemy_ingress_contact' && p.origin === origin && p.level === level && p.transitBody === body
        && activeFrom <= lastQuarter && fact.activeTo <= activeTo && p.timedPlaceIngressAt === ingress.ingressAt);
      assert.ok(transit, origin);
      assert.equal(transit.normalizedPayload.enteredDuringTimedPlace, true);
      assert.equal(transit.normalizedPayload.physicalIngressAt, undefined);
      assert.equal(transit.exactInstant, undefined);
      assert.ok(phases.filter(row => row.normalizedPayload.origin !== origin).every(({ normalizedPayload: p }) =>
        !p.phaseIngressContacts.some(row => row.level === level && row.body === body)), origin);
    }
    if (periodType === 'month') {
      const later = run.facts.filter(row => row.factType === 'ptolemy_lunar_phase_contact'
        && row.normalizedPayload.phase === 'first_quarter');
      const solar = later.find(row => row.normalizedPayload.origin === 'Sun').normalizedPayload;
      assert.deepEqual([solar.monthSign, solar.solarSign], [4, 3]);
      assert.ok(!solar.phaseIngressContacts.some(row => row.level === 'month' && row.body === 'Sun'));
      assert.ok(!solar.phaseCarryContacts.some(row => row.level === 'month' && row.body === 'Mercury'));
      assert.ok(later.find(row => row.normalizedPayload.origin === 'ASC').normalizedPayload.phaseIngressContacts
        .some(row => row.level === 'year' && row.body === 'Jupiter'));
      const yearWitness = run.facts.find(row => row.factType === 'ptolemy_ingress_contact'
        && row.normalizedPayload.origin === 'ASC' && row.normalizedPayload.level === 'year'
        && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.enteredDuringTimedPlace);
      const annualId = fortuneKnowledge.western.rules[27].knowledgeId;
      assert.ok(yearWitness);
      assert.ok(evaluateFortuneRules('western', 'year', [yearWitness]).find(row => row.knowledgeId === annualId)
        .confirmations[0].hits.some(row => row.factId === yearWitness.factId));
      assert.equal(result(run, 28).status, 'matched');
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const audit = formatFortuneFactAudit(input);
    assert.match(audit, /同一起点的月级位置在巨蟹座，太阳于[^。]+实际入座，月相真点仍在这段行运内/u);
    assert.match(audit, /月相真点时，同一起点的月级水星仍在巨蟹座，本时限内未核到新的入座/u);
    assert.doesNotMatch(audit, /同一起点的月级位置在巨蟹座，水星于[^。]+实际入座/u);
    assert.match(audit, /月相真点时，木星实际驻于狮子座，[^。]+年级时限位置[^。]+对分[^。]+实际入座时刻/u);
    assert.match(audit, /月相真点时，火星实际驻于双子座，[^。]+月级时限位置[^。]+(?:六合|三分)[^。]+实际入座时刻/u);
    const ascRun = { ...run, facts: phases.filter(fact => fact.normalizedPayload.origin === 'ASC') };
    const { input: ascInput } = buildFortuneModelContext(ascRun, interpretFortune(ascRun, requestForFortuneRun(ascRun), reference.snapshotId));
    assert.match(formatFortuneFactAudit(ascInput), /月相真点时，金星实际驻于狮子座，[^。]+月级时限位置[^。]+对分[^。]+承接原在座位置/u);
    const privateEvidence = /实际入座，月相真点仍在这段行运内|未核到新的入座|月相真点时，[^。]+实际驻于|phaseIngressContacts|phaseCarryContacts|timedPlaceIngressAt|phaseTransitAspectContacts|aspectPassageIngressAt/u;
    for (const providerInput of [input, ascInput]) assert.doesNotMatch(formatFortunePrompt(providerInput), privateEvidence);
  }
  const week = buildPtolemyTimes({ start: Date.UTC(2026, 6, 6), end: Date.UTC(2026, 6, 13) }, 'week', natal, []);
  assert.deepEqual(week.lunarPhaseContacts.flatMap(row => row.phaseIngressContacts
    .filter(ingress => ingress.level !== 'day').map(ingress => [row.origin, ingress.level, ingress.body])),
    [['Sun', 'month', 'Sun'], ['ASC', 'year', 'Jupiter']]);

  const year = buildPtolemyTimes({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) }, 'year', natal, []);
  assert.ok(year.places.every(row => row.level === 'year'));
  assert.ok(year.contacts.filter(row => row.level === 'month').every(row => row.sameAsMonthlyLord === true && row.aspectType === 'conjunction'));
  assert.ok(year.contacts.filter(row => row.level === 'day').every(row => row.sameAsDailyLord === true && row.aspectType === 'conjunction'
    && row.dayManuscriptAgreement === 'same-place' && row.dayManuscriptMoonContact === true));
  const samePhase = rows => rows.filter(row => row.start === Date.parse(lastQuarter));
  const phaseWitnesses = row => [row.origin, row.annualSign, row.monthSign,
    row.phaseIngressContacts.filter(p => p.level !== 'day').map(({ ingressAt: _at, ...p }) => p),
    row.phaseCarryContacts.filter(p => p.level !== 'day'),
    row.phaseTransitAspectContacts.map(({ ingressAt: _at, ...p }) => p)];
  assert.deepEqual(samePhase(year.lunarPhaseContacts).map(phaseWitnesses), samePhase(week.lunarPhaseContacts).map(phaseWitnesses));
  const annualSun = samePhase(year.lunarPhaseContacts).find(row => row.origin === 'Sun');
  const monthlySun = annualSun.phaseIngressContacts.find(row => row.level === 'month' && row.body === 'Sun');
  assert.ok(Math.abs(Date.parse(monthlySun.ingressAt) - Date.parse(expected[1][5])) < 1000);
  const next = year.lunarPhaseContacts.find(row => row.origin === 'Sun' && row.phase === 'first_quarter' && annualSun.start < row.start);
  assert.deepEqual([annualSun.monthSign, next.monthSign, next.solarSign], [3, 4, 3]);
  assert.ok(!next.phaseIngressContacts.some(row => row.level === 'month' && row.body === 'Sun'));
  assert.ok(!next.phaseCarryContacts.some(row => row.level === 'month' && row.body === 'Mercury'));
});

test('Sepharial rising-point examples recover both printed Midheavens by the ecliptic table geometry', () => {
  for (const [eclipticPoint, printedMidheaven] of [[308, 249], [281, 229]]) {
    const mc = sepharialMidheavenAtRising(eclipticPoint, 53.4, 23.44);
    assert.ok(Math.abs(mc - printedMidheaven) < 0.5);
    const { ascendant } = anglesFromFrame(eclipticEquator(mc, 23.44).rightAscension, 53.4, 23.44);
    assert.ok(Math.abs(ascendant - eclipticPoint) < 1e-7);
  }
  assert.equal(sepharialMidheavenAtRising(90, 70, 23.44), undefined);
});

test('Sepharial reproduces the 1841 true-body angles and direct and converse printed primary arcs', () => {
  const birth = Date.parse('1841-11-09T10:48:00Z');
  const frame = { armc: 210 + 27 / 60, latitude: 51 + 32 / 60 };
  const position = body => sepharialNatalEquatorialPosition(body, birth);
  const uranus = position('Uranus'), saturn = position('Saturn');
  const east = sepharialMundaneAngleArcs(frame, uranus).find(row => row.sphericalPoint === 'east-horizon');
  const upper = sepharialMundaneAngleArcs(frame, saturn).find(row => row.sphericalPoint === 'upper-meridian');
  assert.ok(Math.abs(east.arc - (56 + 51 / 60)) < 2 / 60);
  assert.ok(Math.abs(upper.arc - (59 + 43 / 60)) < 2 / 60);
  const horizon = (position, arc) => Math.sin(frame.latitude * Math.PI / 180) * Math.sin(position.declination * Math.PI / 180)
    + Math.cos(frame.latitude * Math.PI / 180) * Math.cos(position.declination * Math.PI / 180)
      * Math.cos((frame.armc + arc - position.rightAscension) * Math.PI / 180);
  assert.ok(Math.abs(horizon(uranus, east.arc)) < 1e-12);
  assert.ok(horizon(uranus, east.arc - 1) < 0 && horizon(uranus, east.arc + 1) > 0);
  assert.ok(Math.abs(frame.armc + upper.arc - saturn.rightAscension) < 1e-12);
  const direct = sepharialMundaneConjunctionArc(frame, position('Venus'), position('Moon'));
  const converse = sepharialMundaneConjunctionArc(frame, position('Sun'), position('Jupiter'));
  assert.ok(Math.abs(direct - (19 + 25 / 60)) < 2 / 60);
  assert.ok(Math.abs(converse + (44 + 49 / 60)) < 3 / 60);
  const polar = { ...frame, latitude: 85 };
  assert.deepEqual(sepharialMundaneAngleArcs(polar, saturn).map(row => row.sphericalPoint), ['upper-meridian', 'lower-meridian']);
  assert.equal(sepharialMundaneConjunctionArc(polar, position('Venus'), saturn), undefined);
});

test('Sepharial keeps a true upper-meridian witness separate from the projected direction and the lunation date', () => {
  const window = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  const birth = Date.parse('1982-11-09T15:13:47.963Z');
  const target = lunation.newMoonAt + 7 * day;
  const arc = (progressionEpoch(birth, target) - birth) / day;
  const sun = sepharialNatalEquatorialPosition('Sun', birth);
  const armc = normalize(sun.rightAscension - arc);
  const run = calculate(chart(birth, armc), 'month', { year: 2026, month: 11 });
  validateFortuneFacts(run);
  const match = result(run, 17);
  assert.equal(match.status, 'partial');
  const hit = run.facts.find(row => match.sourceFactIds.includes(row.factId));
  const p = hit.normalizedPayload;
  assert.equal(p.natalTarget, 'Sun');
  assert.equal(p.sphericalPrimaryProfile, sepharialSphericalPrimaryProfile);
  const witness = p.sphericalPrimaryDirections.find(row => row.body === 'Sun' && row.sphericalPoint === 'upper-meridian');
  assert.ok(witness.sameNatalIndicator);
  assert.deepEqual([witness.indicator, witness.aspect, witness.motion], ['MC', 'conjunction', 'direct']);
  assert.ok(Math.abs(witness.arcDegrees - arc) < 1e-8);
  assert.ok(Math.abs(Date.parse(witness.at) - target) < 20_000);
  assert.ok(!p.primaryDirections.some(row => row.body === 'Sun' && row.angle === 'MC' && row.aspect === 'conjunction'));
  const shifted = buildSepharialLunationContexts([lunation], buildWesternSourceHouses(window, chart(birth, armc + 2), []), [])
    .find(row => row.natalTarget === 'Sun');
  assert.ok(shifted.exactNatalContact);
  assert.ok(!shifted.sphericalPrimaryDirections.some(row => row.body === 'Sun' && row.sphericalPoint === 'upper-meridian'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sepharial-spherical-primary'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /球面主限候选（出生地赤经赤纬）[^\n]+太阳[^\n]+直向到上中天/u);
  assert.doesNotMatch(formatFortunePrompt(input), /球面主限候选|sphericalPrimaryDirections|upper-meridian|sepharial-1901/u);
});

test('Sepharial reproduces the printed 1911 Moon table and never treats the annual reset as an aspect', () => {
  const born = Date.parse('1865-06-03T01:18:00Z');
  const table = buildSepharialLunarYearTable(born, 1911);
  assert.equal(new Date(table.epochAt).toISOString(), '1865-07-18T15:10:00.000Z');
  assert.equal(new Date(table.precedingNoon).toISOString(), '1865-07-18T12:00:00.000Z');
  assert.equal(table.monthlyMotion, 69 / 60);
  for (const [index, degrees, minutes] of [[0, 4, 14], [1, 5, 23], [11, 16, 53]]) {
    // The original ephemeris and modern one differ by less than two minutes.
    assert.ok(Math.abs(table.januaryLongitude + index * table.monthlyMotion - (60 + degrees + minutes / 60)) < 2 / 60);
  }
  assert.ok(progressionEpoch(born, Date.UTC(1911, 0, 1)) !== table.epochAt);
  // The 1911 annual chart uses July 19, independently of the July 18 lunar clock.
  const annualEpoch = born + 46 * day;
  const annualVenus = readProgressionPosition('Venus', annualEpoch, born).longitude;
  const juneMoon = table.januaryLongitude + 5 * table.monthlyMotion;
  assert.equal(new Date(annualEpoch).toISOString(), '1865-07-19T01:18:00.000Z');
  assert.ok(juneMoon <= annualVenus && annualVenus < juneMoon + table.monthlyMotion);

  const birth = Date.parse('1980-11-09T03:26:58.224Z');
  const december = buildSepharialLunarYearTable(birth, 2026);
  const january = buildSepharialLunarYearTable(birth, 2027);
  const decemberLimit = normalize(december.januaryLongitude + 12 * december.monthlyMotion);
  assert.ok(decemberLimit - january.januaryLongitude > 0.4);
  const reset = Date.UTC(2027, 0, 1), window = { start: reset - day / 24, end: reset + day / 24 };
  const [lunation] = buildLunationWindows(window);
  // Use a controlled MC anchor to isolate the actual change of yearly tables.
  const rowsAt = longitude => {
    const armc = eclipticEquator(longitude, e_tilt(MakeTime(new Date(birth))).tobl).rightAscension;
    const houses = buildWesternSourceHouses(window, chart(birth, armc), []);
    return buildSepharialLunationContexts([{ ...lunation, longitude }], houses, []).find(row => row.natalTarget === 'MC');
  };
  const jumped = rowsAt((decemberLimit + january.januaryLongitude) / 2);
  assert.ok(jumped.exactNatalContact);
  assert.deepEqual(jumped.lunarDirections, []);
  const inside = reset + day / 48;
  const ordinary = rowsAt(january.januaryLongitude + january.monthlyMotion * (inside - reset) / (31 * day));
  assert.equal(ordinary.lunarDirections.length, 1);
  assert.equal(ordinary.lunarDirections[0].aspect, 'conjunction');
  assert.ok(Math.abs(ordinary.lunarDirections[0].at - inside) <= 1);
});

test('Sepharial preserves the annual progressed Venus layer through the actual new-Moon SQLite candidate', () => {
  const birth = Date.parse('1981-02-03T05:49:26.541Z');
  const snapshot = chart(birth);
  const run = calculate(snapshot, 'month', { year: 2026, month: 1 });
  validateFortuneFacts(run);
  const match = result(run, 17);
  assert.equal(match.status, 'partial');
  const anchor = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.natalTarget === 'Venus');
  assert.ok(anchor?.normalizedPayload.exactNatalContact);
  const p = anchor.normalizedPayload;
  assert.equal(p.annualProgressedLunarDirectionProfile, sepharialLunationPolicy.annualProgressedLunarDirectionProfile);
  assert.deepEqual(p.lunarDirections, []);
  assert.equal(p.annualProgressedLunarDirections.length, 1);
  const [contact] = p.annualProgressedLunarDirections;
  assert.equal(contact.aspect, 'opposition');
  assert.equal(contact.annualEphemerisAt, '1981-03-20T05:49:26.541Z');
  assert.ok(Math.abs(contact.annualLongitude - 354.926349) < 0.000001);
  const at = Date.parse(contact.at);
  assert.ok(Math.abs(at - Date.parse('2026-01-30T00:01:10.962Z')) <= 1);
  const time = { start: Date.parse(anchor.activeFrom), end: Date.parse(anchor.activeTo) };
  const houses = buildWesternSourceHouses(time, snapshot, []);
  const [span] = buildLunationWindows(time);
  const witness = (start, end) => buildSepharialLunationContexts([{ ...span, start, end }], houses, [])
    .find(row => row.natalTarget === 'Venus').annualProgressedLunarDirections;
  assert.deepEqual(witness(time.start, at), []);
  assert.deepEqual(witness(at, at + 1).map(row => row.at), [at]);
  assert.deepEqual(witness(at + 1, time.end), []);

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sepharial-annual-venus'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /月表对当年次限行星[^\n]*对当年次限金星形成/u);
  assert.doesNotMatch(formatFortunePrompt(input), /月表对当年次限行星|对当年次限金星形成|annualProgressedLunarDirections|1981-03-20T05:49|2026-01-30T00:01/u);
});

test('Sepharial reads the two annual planet positions independently inside one December-January lunation', () => {
  const birth = Date.parse('1992-12-08T18:45:15.590Z');
  const start = Date.UTC(2026, 11, 8), reset = Date.UTC(2027, 0, 1), end = Date.UTC(2027, 0, 8);
  const houses = buildWesternSourceHouses({ start, end }, chart(birth), []);
  const span = buildLunationWindows({ start, end }).find(row => row.start < reset && reset < row.end);
  assert.ok(span);
  const read = span => buildSepharialLunationContexts([span], houses, [])
    .find(row => row.natalTarget === 'Sun').annualProgressedLunarDirections;
  const contacts = read(span);
  assert.deepEqual(contacts.map(({ at, aspect, annualEphemerisAt }) => [new Date(at).toISOString(), aspect,
    new Date(annualEphemerisAt).toISOString()]), [
    ['2026-12-12T12:43:16.053Z', 'sesquiquadrate', '1993-01-11T18:45:15.590Z'],
    ['2027-01-06T14:05:44.911Z', 'sesquiquadrate', '1993-01-12T18:45:15.590Z'],
  ]);
  assert.deepEqual(read({ ...span, end: reset }), contacts.slice(0, 1));
  assert.deepEqual(read({ ...span, start: reset }), contacts.slice(1));
  assert.deepEqual(read({ ...span, start: reset - 1, end: reset + 1 }), []);
});

test('Sepharial uses the nearest admissible natal aspect for actual Mercury directions and preserves sign conflict', () => {
  const window = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  const primaryAt = lunation.newMoonAt + 10 * day;
  for (const [year, body, aspect, orb, nature] of [
    [1968, 'Moon', 'trine', 7, 'favourable'], [1980, 'Mars', 'semisquare', 5, 'adverse'],
    [1985, 'Jupiter', 'sextile', 5, 'unclassified'],
  ]) {
    const birth = SearchSunLongitude(lunation.longitude + 0.00001, new Date(Date.UTC(year, 10, 1)), 25).date.getTime();
    const longitude = readProgressionPosition('Mercury', birth, birth).longitude;
    const age = (progressionEpoch(birth, primaryAt) - birth) / day;
    const armc = eclipticEquator(normalize(longitude - age), e_tilt(MakeTime(new Date(birth))).tobl).rightAscension;
    const houses = buildWesternSourceHouses(window, chart(birth, armc), []);
    const [row] = buildSepharialLunationContexts([lunation], houses, []);
    assert.equal(row.natalTarget, 'Sun');
    const direction = row.primaryDirections.find(item => item.angle === 'MC' && item.body === 'Mercury' && item.aspect === 'conjunction');
    assert.ok(Math.abs(direction.at - primaryAt) < 20_000);
    assert.equal(direction.nature, nature);
    const [nearest] = direction.mercuryCondition.nearest;
    assert.deepEqual([nearest.body, nearest.aspect, nearest.orb], [body, aspect, orb]);
    assert.ok(nearest.difference < orb);
    if (year === 1985) assert.equal(direction.mercuryCondition.signCondition, 'opposite');
    assert.deepEqual(buildSepharialLunationContexts([{ ...lunation, longitude: lunation.longitude + 0.01 }], houses, [])[0].primaryDirections, []);
  }
});

test('actual November new moon reaches its four-layer Sepharial SQLite candidate with exact and separately scoped evidence', () => {
  const period = { year: 2026, month: 11 };
  const window = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  assert.equal(new Date(lunation.newMoonAt).toISOString(), '2026-11-09T07:02:42.000Z');
  // Pick a date whose actual natal Sun is numerically on the new Moon, then
  // place the natal meridian so its Mars direction perfects in this window.
  const at = SearchSunLongitude(lunation.longitude + 0.00001, new Date('1982-11-01T00:00:00Z'), 40).date.getTime();
  const primaryAt = lunation.newMoonAt + 10 * day;
  const age = (progressionEpoch(at, primaryAt) - at) / day;
  const mars = readProgressionPosition('Mars', at, at).longitude;
  const armc = eclipticEquator(normalize(mars - age), e_tilt(MakeTime(new Date(at))).tobl).rightAscension;
  const run = calculate(chart(at, armc), 'month', period);
  validateFortuneFacts(run);
  const rows = run.facts.filter(f => f.factType === 'sepharial_lunation_context');
  assert.ok(rows.some(row => !row.normalizedPayload.exactNatalContact && row.normalizedPayload.startsBeforeQuery));
  const [hit, ...others] = rows.filter(row => row.normalizedPayload.exactNatalContact);
  assert.equal(others.length, 0);
  const p = hit.normalizedPayload;
  assert.equal(p.natalTarget, 'Sun');
  assert.ok(p.separation <= sepharialLunationPolicy.exactTolerance);
  assert.deepEqual(p.order, ['primary', 'transit', 'lunar_direction', 'lunation']);
  const cusps = run.facts.find(f => f.factType === 'natal_house_cusps' && f.normalizedPayload.houseSystem === 'placidus').normalizedPayload.cusps;
  assert.equal(p.natalHouse, zodiacalHouse(p.natalLongitude, cusps));
  const primary = p.primaryDirections.find(item => item.angle === 'MC' && item.body === 'Mars' && item.aspect === 'conjunction');
  assert.ok(primary && Math.abs(Date.parse(primary.at) - primaryAt) < 20_000);
  assert.equal(primary.nature, 'adverse');
  assert.equal(primary.sameNatalIndicator, false);
  assert.equal(p.lunarClock, 'sepharial-1914-january-noon-monthly-motion-v1');
  assert.equal(p.lunarDayInterpolation, 'utc-month-uniform-clock-candidate');
  const lunarContact = p.lunarDirections.find(item => item.aspect === 'sesquiquadrate');
  assert.ok(lunarContact);
  assert.equal(lunarContact.nature, 'adverse');
  assert.equal(lunarContact.primaryRelation, undefined);
  const lunarAt = Date.parse(lunarContact.at), november = Date.UTC(2026, 10, 1);
  assert.ok(Math.abs(lunarAt - Date.parse('2026-11-11T06:11:45.654Z')) <= 1_000);
  const { januaryLongitude, monthlyMotion } = buildSepharialLunarYearTable(at, 2026);
  const tableLongitude = januaryLongitude + monthlyMotion * (10 + (lunarAt - november) / (30 * day));
  assert.ok(Math.abs(normalize(tableLongitude - p.natalLongitude) - 135) < 0.00001);
  const oldLongitude = readProgressionPosition('Moon', progressionEpoch(at, lunarAt), at).longitude;
  assert.ok(Math.abs(normalize(oldLongitude - p.natalLongitude) - 135) > 0.09);
  const previousBirth = Date.parse('1980-11-09T03:26:58.224Z');
  const previousHouses = buildWesternSourceHouses(window, chart(previousBirth), []);
  const previousAnchor = buildSepharialLunationContexts([lunation], previousHouses, []).find(row => row.natalTarget === 'Sun');
  assert.ok(previousAnchor.exactNatalContact);
  assert.deepEqual(previousAnchor.lunarDirections, []);
  assert.ok(run.facts.some(f => f.factType === 'aspect_exact' && f.normalizedPayload.transitBody === 'Sun'
    && f.normalizedPayload.natalTargetId === 'Sun'
    && Math.abs(Date.parse(f.exactInstant) - lunation.newMoonAt) <= sepharialLunationPolicy.duplicateLunationContactMs));
  assert.ok(!p.transits.some(item => item.body === 'Sun' || item.body === 'Moon'));
  assert.ok(p.transits.every(item => run.facts.some(f => f.factType === 'aspect_exact' && f.exactInstant === item.at
    && f.normalizedPayload.transitBody === item.body && f.normalizedPayload.natalTargetId === 'Sun'
    && f.sourceFactIds.every(id => hit.sourceFactIds.includes(id)))));
  for (const contact of [...p.primaryDirections, ...p.lunarDirections, ...p.transits]) {
    assert.ok(hit.activeFrom <= contact.at && contact.at < hit.activeTo);
  }
  const match = result(run, 17);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [hit.factId]);
  const olderFacts = { ...run, facts: run.facts.filter(f => f.factType !== 'sepharial_lunation_context') };
  assert.equal(result(olderFacts, 17).status, 'unknown');
  const normal = calculate(chart(), 'month', period);
  assert.equal(result(normal, 17).status, 'not_matched');
  assert.ok(normal.facts.some(f => f.factType === 'lunation_window'));
  const following = calculate(chart(at, armc), 'month', { ...period, month: 12 });
  const [carry] = following.facts.filter(f => f.factType === 'sepharial_lunation_context'
    && f.normalizedPayload.exactNatalContact);
  assert.equal(carry.normalizedPayload.newMoonAt, p.newMoonAt);
  assert.equal(carry.normalizedPayload.startsBeforeQuery, true);
  assert.equal(carry.activeTo, p.nextNewMoonAt);
  assert.ok(carry.normalizedPayload.transits.every(item => carry.activeFrom <= item.at && item.at < carry.activeTo));
  assert.ok(carry.normalizedPayload.transits.some(item => item.body === 'Moon' && Date.parse(item.at) > lunation.newMoonAt + 20 * day));
  assert.equal(result(following, 17).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sepharial-report'));
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['角点主限候选', '原书列为偏难', '列为同期背景', '本命太阳', '推运月亮', '实际朔望月',
    '月内时点按现代民用月均匀插值']) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  for (const key of ['sepharial_lunation_context', 'exactNatalContact', 'primaryDirections', 'sourceFactIds']) assert.ok(!prompt.includes(key), key);
  assert.doesNotMatch(formatFortunePrompt(input), /lunarClock|lunarDayInterpolation|月内时点按现代民用月|2026-11-11T06:11/u);

  for (const [offset, relation, phrase] of [
    [60, 'brief_disturbance', '原书将相反的月亮推运视为短暂扰动'],
    [90, 'reinforcing', '按原书加强该方向的提示'],
  ]) {
    const alignedArmc = eclipticEquator(normalize(p.natalLongitude + offset - age), e_tilt(MakeTime(new Date(at))).tobl).rightAscension;
    const aligned = calculate(chart(at, alignedArmc), 'month', period);
    validateFortuneFacts(aligned);
    const match = result(aligned, 17);
    assert.equal(match.status, 'partial');
    const anchor = aligned.facts.find(fact => match.sourceFactIds.includes(fact.factId));
    const primary = anchor.normalizedPayload.primaryDirections.find(item => item.body === 'Sun' && item.angle === 'MC');
    assert.equal(primary.sameNatalIndicator, true);
    assert.ok(Math.abs(Date.parse(primary.at) - primaryAt) < 20_000);
    const contact = anchor.normalizedPayload.lunarDirections.find(item => item.aspect === 'sesquiquadrate');
    assert.equal(contact.at, lunarContact.at);
    assert.equal(contact.primaryRelation, relation);
    const { input } = buildFortuneModelContext(aligned, interpretFortune(aligned, requestForFortuneRun(aligned), 'sepharial-aligned'));
    assert.ok(formatFortuneFactAudit(input).includes(phrase));
    const provider = formatFortunePrompt(input);
    assert.ok(!provider.includes(phrase) && !provider.includes('primaryRelation'));
  }
});

test('Sepharial confirms the house theme for an exact natal sextile or trine of the November new moon', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 11 }, displayTimezone: 'Asia/Shanghai' };
  const window = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  const asOf = Date.parse('2026-11-15T12:00:00Z');
  for (const [angle, aspect] of [[60, 'sextile'], [120, 'trine'], [90, undefined], [60.001, undefined]]) {
    const birth = SearchSunLongitude(normalize(lunation.longitude + angle), new Date('1980-01-01T00:00:00Z'), 366).date.getTime();
    const archive = { snapshotId: 'sepharial-lunation-aspect-' + angle, chart: chart(birth) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const match = result(run, 17);
    assert.equal(match.status, aspect ? 'matched' : 'not_matched', String(angle));
    const hit = run.facts.find(fact => match.sourceFactIds.includes(fact.factId));
    if (!aspect) continue;
    const p = hit.normalizedPayload;
    assert.deepEqual([p.natalTarget, p.natalLunationAspect, p.exactNatalContact, p.exactNatalSupportAspect], ['Sun', aspect, false, true]);
    assert.ok(Math.abs(p.separation - angle) <= sepharialLunationPolicy.exactTolerance);
    assert.equal(p.natalLunationDeviation, Math.abs(p.separation - angle));
    assert.equal(hit.activeFrom, new Date(lunation.newMoonAt).toISOString());
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
    const detail = /本命太阳在第\d+宫，与实际朔点精确成(?:六合|三分)相/u;
    assert.match(formatFortuneFactAudit(input), detail);
    const provider = formatFortunePrompt(input);
    assert.ok(provider.includes(match.matchedConditions[0]));
    assert.doesNotMatch(provider, /与实际朔点精确成|natalLunationAspect/u);
  }
});

test('Sepharial p004 confirms the new Moon on natal Jupiter using the source themes of its actual house', () => {
  const period = { year: 2026, month: 11 };
  const asOf = Date.parse('2026-11-18T03:00:00Z'), birth = Date.parse('1982-10-26T10:48:54.442Z');
  const window = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  const runFor = (natal, targetPeriod = period) => {
    const params = { periodType: 'month', targetPeriod, displayTimezone: 'Asia/Shanghai' };
    const archive = { snapshotId: 'sepharial-p103-jupiter', chart: natal };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
    return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), archive.snapshotId, archive);
  };
  for (const [armc, house, theme] of [[27.910194, 4, '家庭、住所和不动产'], [302.181647, 6, '日常照料'],
    [266, 8, '共同资源'], [180, 11, '朋友及团体活动'], [207.910194, 10, '职位、责任与声誉']]) {
    const natal = chart(birth, armc), run = runFor(natal);
    const match = result(run, 17);
    assert.equal(match.status, 'matched', house);
    const anchor = run.facts.find(row => match.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.natalTarget === 'Jupiter');
    const p = anchor?.normalizedPayload;
    assert.deepEqual([p?.natalHouse, p?.natalLunationAspect, p?.exactNatalContact], [house, 'conjunction', true]);
    const natalJupiter = natal.western.rawResult[0].positions.find(row => row.planet === 'Jupiter').longitude;
    const moonPhase = MoonPhase(new Date(lunation.newMoonAt));
    assert.ok(Math.min(moonPhase, 360 - moonPhase) < 0.0002);
    assert.ok(Math.abs(natalJupiter - SunPosition(new Date(lunation.newMoonAt)).elon) < sepharialLunationPolicy.exactTolerance);
    assert.equal(Date.parse(anchor.activeFrom), lunation.newMoonAt);
    assert.equal(Date.parse(anchor.activeTo), window.end);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sepharial-p103-jupiter'));
    const detail = `本命木星在第${house}宫，与实际朔点数值同度`;
    assert.ok(formatFortuneFactAudit(input).includes(detail), house);
    const provider = formatFortunePrompt(input);
    assert.ok(!provider.includes(detail), house);
    assert.ok(match.matchedConditions[0].includes(theme), house);
    assert.ok(provider.includes(match.matchedConditions[0]), house);
    assert.match(provider, /作用轻重仍须结合当期主限、行运及月亮推运/u);
    if (house === 10) {
      const assess = payload => evaluateFortuneRules('western', 'month', [{ ...anchor, normalizedPayload: { ...p, ...payload } }])
        .find(row => row.knowledgeId === match.knowledgeId).confirmations.filter(branch => branch.hits.length);
      const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
      for (const [index, name] of names.entries()) {
        const expected = '实际合朔核到本命第' + name + '宫的行星联系';
        const jupiter = assess({ natalHouse: index + 1 });
        const sextile = assess({ natalHouse: index + 1, natalTarget: 'Venus', exactNatalContact: false,
          exactNatalSupportAspect: true, natalLunationAspect: 'sextile' });
        for (const branches of [jupiter, sextile]) {
          assert.equal(branches.length, 1, name);
          assert.ok(branches[0].sourceConditions[0].startsWith(expected), name);
        }
      }
      assert.equal(assess({ natalHouse: undefined }).length, 0);
      assert.equal(assess({ natalHouse: 13 }).length, 0);
      assert.equal(assess({ natalTarget: 'ASC', exactNatalContact: false, exactNatalSupportAspect: true, natalLunationAspect: 'trine' }).length, 0);
    }
    if (house === 11) {
      const carry = result(runFor(natal, { ...period, month: 12 }), 17);
      assert.equal(carry.status, 'matched');
      assert.deepEqual(carry.windows, [{ start: anchor.activeTo, endExclusive: p.nextNewMoonAt }]);
    }
  }
  const near = runFor(chart(birth + 3_600_000, 180));
  assert.equal(result(near, 17).status, 'not_matched');
});

test('Sepharial confirms source-classified conjunctions at the actual lunation independently of the Moon anchor', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 11 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-11-15T12:00:00Z');
  const range = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const moon = buildLunationWindows(range).find(row => !row.startsBeforeQuery);
  const at = new Date(moon.newMoonAt);
  const natalJupiterCase = Date.parse('1982-10-26T10:48:54.442Z');
  const shiftedBirth = natalJupiterCase + 3_600_000;
  for (const [birth, offset, hasJupiterAnchor, angle, planet] of [
    [natalJupiterCase, 0, true, 'MC', 'Venus'],
    [natalJupiterCase, 0.001, true, 'MC', 'Venus'],
    [shiftedBirth, 0, false, 'MC', 'Venus'],
    [shiftedBirth, 0, false, 'ASC', 'Venus'],
    [shiftedBirth, 0, false, 'MC', 'Mars'],
    [shiftedBirth, 0, false, 'ASC', 'Mars'],
    [shiftedBirth, 0, false, 'MC', 'Mercury'],
  ]) {
    const longitude = Ecliptic(GeoVector(Body[planet], at, true)).elon;
    const obliquity = e_tilt(MakeTime(new Date(birth))).tobl;
    const midheaven = angle === 'MC' ? longitude : sepharialMidheavenAtRising(longitude, 35, obliquity);
    const meridian = eclipticEquator(midheaven, obliquity).rightAscension;
    const natal = chart(birth, meridian + offset);
    const snapshotId = ['sepharial-new-moon-significator', birth, offset, angle, planet].join('-');
    const archive = { snapshotId, chart: natal };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, archive);
    validateFortuneFacts(run);

    const hasExactContact = offset === 0;
    const hasBenefic = hasExactContact && planet === 'Venus';
    const hasAdverse = hasExactContact && planet === 'Mars';
    const hasClassifiedContact = hasBenefic || hasAdverse;
    const match = result(run, 17);
    assert.equal(match.status, hasJupiterAnchor || hasClassifiedContact ? 'matched' : 'partial');
    const anchor = run.facts.find(row => row.factType === 'sepharial_lunation_context' && row.activeFrom === at.toISOString()
      && match.sourceFactIds.includes(row.factId) && row.normalizedPayload.natalTarget === (hasJupiterAnchor ? 'Jupiter' : undefined));
    assert.ok(anchor);
    assert.equal(Date.parse(anchor.activeTo), range.end);
    const p = anchor.normalizedPayload;
    assert.equal(p.exactNatalContact, hasJupiterAnchor);
    assert.equal(p.natalHouse, hasJupiterAnchor ? 10 : undefined);
    assert.equal(p.newMoonSignificatorProfile, 'sepharial-1914-new-moon-at-natal-significators-v1');
    assert.equal(p.hasExactNewMoonSignificatorContact, hasExactContact);
    assert.equal(p.newMoonSolarMeridianBeneficConjunction, hasBenefic && angle === 'MC');
    assert.equal(p.newMoonLunarHorizonBeneficConjunction, hasBenefic && angle === 'ASC');
    assert.equal(p.newMoonSolarMeridianAdverseConjunction, hasAdverse && angle === 'MC');
    assert.equal(p.newMoonLunarHorizonAdverseConjunction, hasAdverse && angle === 'ASC');
    const saved = natal.western.rawResult[0];
    const natalAngle = angle === 'MC' ? saved.midheaven : saved.ascendant;
    if (hasExactContact) {
      assert.ok(Math.abs(longitude - natalAngle) <= sepharialLunationPolicy.exactTolerance);
      assert.deepEqual(p.newMoonSignificatorContacts.map(({ body, natalTarget, aspect }) => [body, natalTarget, aspect]),
        [[planet, angle, 'conjunction']]);
      const [contact] = p.newMoonSignificatorContacts;
      assert.equal(contact.longitude, longitude);
      assert.ok(Math.abs(contact.natalLongitude - natalAngle) < 0.000001);
      assert.ok(contact.deviation <= sepharialLunationPolicy.exactTolerance);
    } else {
      assert.ok(Math.abs(longitude - natalAngle) > sepharialLunationPolicy.exactTolerance);
      assert.deepEqual(p.newMoonSignificatorContacts, []);
    }

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), snapshotId));
    const planetName = { Venus: '金星', Mars: '火星', Mercury: '水星' }[planet];
    const local = '同一次朔时，实际' + planetName + '与本命'
      + (angle === 'MC' ? '天顶' : '上升点') + '精确形成合相';
    assert.equal(formatFortuneFactAudit(input).includes(local), hasExactContact);
    const provider = formatFortunePrompt(input);
    const staticTheme = angle === 'MC' ? '本命太阳或天顶' : '本命月亮或上升点';
    if (hasJupiterAnchor) assert.match(provider, /本命第十宫的行星联系/u);
    assert.equal(provider.includes(staticTheme), hasClassifiedContact);
    assert.equal(provider.includes('压力'), hasAdverse);
    assert.doesNotMatch(provider, /newMoonSignificatorContacts|朔时金星|朔时火星|朔时水星/u);

    const isolated = { ...run, facts: [{ ...anchor, normalizedPayload: { ...p, exactNatalContact: false,
      exactNatalSupportAspect: false, natalLunationAspect: undefined } }] };
    const independent = result(isolated, 17);
    assert.equal(independent.status, hasClassifiedContact ? 'matched' : hasExactContact ? 'partial' : 'not_matched');
    if (hasExactContact) assert.ok(independent.sourceFactIds.includes(anchor.factId));
    const isolatedInput = buildFortuneModelContext(isolated,
      interpretFortune(isolated, requestForFortuneRun(isolated), snapshotId)).input;
    assert.equal(formatFortunePrompt(isolatedInput).includes(staticTheme), hasClassifiedContact);
    assert.doesNotMatch(formatFortunePrompt(isolatedInput), /本命第十宫的行星联系/u);
  }
});

test('Sepharial classifies real non-conjunction contacts to the natal significators at the actual new moon', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 11 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2026-11-15T12:00:00Z');
  const range = { start: Date.parse('2026-10-31T16:00:00Z'), end: Date.parse('2026-11-30T16:00:00Z') };
  const lunation = buildLunationWindows(range).find(row => !row.startsBeforeQuery);
  const at = new Date(lunation.newMoonAt);
  const birth = Date.parse('1982-10-26T11:48:54.442Z');
  const obliquity = e_tilt(MakeTime(new Date(birth))).tobl;
  const samples = [
    ['Saturn', 'MC', 'sextile', 60, 'newMoonSolarMeridianFavourableAspect', '土星与本命天顶精确形成六合相'],
    ['Venus', 'ASC', 'trine', 120, 'newMoonLunarHorizonFavourableAspect', '金星与本命上升点精确形成三分相'],
    ['Venus', 'MC', 'square', 90, 'newMoonSolarMeridianAdverseAspect', '金星与本命天顶精确形成四分相'],
    ['Mars', 'ASC', 'opposition', 180, 'newMoonLunarHorizonAdverseAspect', '火星与本命上升点精确形成对分相'],
  ];
  const armcAtAspect = (body, target, separation) => {
    const longitude = Ecliptic(GeoVector(Body[body], at, true)).elon;
    const natalLongitude = normalize(longitude + separation);
    const midheaven = target === 'MC' ? natalLongitude : sepharialMidheavenAtRising(natalLongitude, 35, obliquity);
    return eclipticEquator(midheaven, obliquity).rightAscension;
  };
  for (const [body, target, aspect, separation, field, auditText] of samples) {
    const armc = armcAtAspect(body, target, separation);
    const snapshotId = `sepharial-nonconjunction-${target}-${aspect}`;
    const archive = { snapshotId, chart: chart(birth, armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, archive);
    validateFortuneFacts(run);
    const anchor = run.facts.find(row => row.factType === 'sepharial_lunation_context' && row.activeFrom === at.toISOString());
    const p = anchor.normalizedPayload;
    assert.equal(anchor.activeTo, new Date(range.end).toISOString());
    assert.equal(p.exactNatalContact, false);
    assert.equal(p.exactNatalSupportAspect, false);
    assert.deepEqual(samples.filter(([, , , , key]) => p[key]).map(([, , , , key]) => key), [field]);
    for (const [key, value] of Object.entries(p)) {
      if (key.startsWith('newMoon') && key.endsWith('Conjunction')) assert.equal(value, false);
    }
    assert.deepEqual(p.newMoonSignificatorContacts.map(contact => [contact.body, contact.natalTarget, contact.aspect]),
      [[body, target, aspect]]);
    assert.ok(Math.abs(p.newMoonSignificatorContacts[0].separation - separation) <= sepharialLunationPolicy.exactTolerance);
    const scoped = { ...run, facts: [anchor] };
    const match = result(scoped, 17);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: anchor.activeFrom, endExclusive: anchor.activeTo }]);
    const confirmation = rows => evaluateFortuneRules('western', 'month', rows).find(row => row.knowledgeId === match.knowledgeId)
      .confirmations.find(branch => branch.condition.includes(field));
    assert.deepEqual(confirmation([anchor]).hits.map(row => row.factId), [anchor.factId]);

    const nearby = chart(birth, armc + 0.001);
    const [offContact] = buildSepharialLunationContexts([lunation], buildWesternSourceHouses(range, nearby, []), []);
    assert.equal(offContact[field], false);
    assert.deepEqual(offContact.newMoonSignificatorContacts, []);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), snapshotId));
    assert.ok(formatFortuneFactAudit(input).includes(auditText));
    const prompt = formatFortunePrompt(input);
    assert.ok(prompt.includes(target === 'MC' ? '本命日或天顶' : '本命月或上升'));
    assert.doesNotMatch(prompt, /newMoonSignificatorContacts|newMoonSolarMeridian|newMoonLunarHorizon/u);
    assert.ok(!prompt.includes(auditText));
  }
  for (const [body, target, aspect, separation, fields] of [
    ['Jupiter', 'ASC', 'semisquare', 45, ['newMoonLunarHorizonAdverseAspect']],
    ['Saturn', 'MC', 'sesquiquadrate', 135, ['newMoonSolarMeridianAdverseAspect']],
    ['Mercury', 'MC', 'sextile', 60, []],
  ]) {
    const natal = chart(birth, armcAtAspect(body, target, separation));
    const [row] = buildSepharialLunationContexts([lunation], buildWesternSourceHouses(range, natal, []), []);
    assert.deepEqual(row.newMoonSignificatorContacts.map(contact => [contact.body, contact.natalTarget, contact.aspect]),
      [[body, target, aspect]]);
    assert.deepEqual(samples.filter(([, , , , key]) => row[key]).map(([, , , , key]) => key), fields);
  }
});

test('Sepharial orders real major transits to the same lunation anchor by source precedence', () => {
  const params = { periodType: 'month', targetPeriod: { year: 1996, month: 3 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('1996-03-25T12:00:00Z');
  const window = { start: Date.parse('1996-02-29T16:00:00Z'), end: Date.parse('1996-03-31T16:00:00Z') };
  const lunation = buildLunationWindows(window).find(row => !row.startsBeforeQuery);
  const birth = SearchSunLongitude(lunation.longitude, new Date('1960-03-15T00:00:00Z'), 10).date.getTime();
  const snapshot = chart(birth);
  const archive = { snapshotId: 'sepharial-saturn-mars-precedence', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const match = result(run, 17);
  assert.equal(match.status, 'partial');
  const row = run.facts.find(fact => match.sourceFactIds.includes(fact.factId));
  const payload = row.normalizedPayload;
  assert.equal(payload.natalTarget, 'Sun');
  const actual = payload.transits.filter(contact => ['Mars', 'Saturn'].includes(contact.body));
  assert.deepEqual(actual.map(contact => contact.body), ['Mars', 'Saturn']);
  assert.ok(actual[0].at < actual[1].at);
  assert.deepEqual(payload.majorTransitPrecedence, ['Saturn', 'Mars']);

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  const detail = '同一本命太阳的主要行运，按原书的发生频次优先参考土星、火星';
  assert.ok(formatFortuneFactAudit(input).includes(detail));
  assert.ok(!formatFortunePrompt(input).includes(detail));

  const houses = buildWesternSourceHouses(window, snapshot, []);
  const earlier = { ...lunation, end: Date.parse(actual[1].at) };
  const [beforeSaturn] = buildSepharialLunationContexts([earlier], houses, run.facts);
  assert.equal(beforeSaturn.natalTarget, 'Sun');
  assert.ok(beforeSaturn.transits.some(contact => contact.body === 'Mars'));
  assert.ok(!beforeSaturn.transits.some(contact => contact.body === 'Saturn'));
  assert.equal(beforeSaturn.majorTransitPrecedence, undefined);
});

test('Sepharial keeps an actual Uranus station on another natal significator and classifies observed primary angles', () => {
  const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month: 9 } };
  const now = Date.UTC(2026, 8, 12);
  const window = { start: Date.parse('2026-08-31T16:00:00Z'), end: Date.parse('2026-09-30T16:00:00Z') };
  const lunations = buildLunationWindows(window), [carry] = lunations;
  const birth = SearchSunLongitude(carry.longitude + 0.00001, new Date('1980-08-01T00:00:00Z'), 25).date.getTime();
  const tilt = e_tilt(MakeTime(new Date(birth))).tobl;
  const stationAt = '2026-09-10T18:40:38.768Z';
  const longitude = Ecliptic(GeoVector(Body.Uranus, new Date(stationAt), true)).elon;
  const archive = { snapshotId: 'sepharial-uranus-station', chart: chart(birth, eclipticEquator(longitude, tilt).rightAscension) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const station = run.facts.find(fact => fact.factType === 'station_natal_contact'
    && fact.normalizedPayload.natalTargetId === 'MC' && fact.normalizedPayload.transitBody === 'Uranus');
  assert.ok(station);
  assert.equal(station.exactInstant, stationAt);
  assert.equal(station.normalizedPayload.exactConjunction, true);
  const [fact] = run.facts.filter(fact => fact.factType === 'sepharial_lunation_context' && fact.normalizedPayload.exactNatalContact);
  assert.equal(fact.normalizedPayload.natalTarget, 'Sun');
  assert.deepEqual(fact.normalizedPayload.stationaryTransits, [
    { at: stationAt, body: 'Uranus', target: 'MC', directionAfter: 'retrograde', sameNatalIndicator: false },
  ]);
  assert.ok(station.sourceFactIds.every(id => fact.sourceFactIds.includes(id)));
  assert.ok(fact.activeFrom <= stationAt && stationAt < fact.activeTo);
  assert.equal(result(run, 17).status, 'partial');
  assert.ok(result(run, 17).sourceFactIds.includes(fact.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  assert.match(formatFortuneFactAudit(input), /天王星在.*停驻于本命天顶.*对应另一本命指征/u);
  assert.doesNotMatch(formatFortunePrompt(input), /停驻于本命天顶|stationaryTransits/u);

  const beyond = { ...station, exactInstant: fact.activeTo };
  const nearby = chart(birth, eclipticEquator(longitude + 0.01, tilt).rightAscension);
  for (const [snapshot, witness] of [[archive.chart, beyond], [nearby, station]]) {
    const houses = buildWesternSourceHouses(window, snapshot, []);
    const match = buildSepharialLunationContexts(lunations, houses, [witness]).find(row => row.exactNatalContact);
    assert.ok(match);
    assert.deepEqual(match.stationaryTransits, []);
  }

  const primaryAt = carry.end - 2 * day;
  const age = (progressionEpoch(birth, primaryAt) - birth) / day;
  const mars = readProgressionPosition('Mars', birth, birth).longitude;
  for (const [offset, aspect, nature] of [[60, 'sextile', 'favourable'], [135, 'sesquiquadrate', 'adverse']]) {
    const armc = eclipticEquator(normalize(mars + offset - age), tilt).rightAscension;
    const houses = buildWesternSourceHouses(window, chart(birth, armc), []);
    const match = buildSepharialLunationContexts(lunations, houses, []).find(row => row.exactNatalContact);
    const direction = match.primaryDirections.find(row => row.angle === 'MC' && row.body === 'Mars' && row.aspect === aspect);
    assert.ok(direction);
    assert.equal(direction.nature, nature);
    assert.ok(Math.abs(direction.at - primaryAt) < 20_000);
  }
});

test('Sepharial retains a real station opposite the natal Moon and clips it at the lunation cutoff', () => {
  const params = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2026, month: 9 } };
  const asOf = Date.UTC(2026, 8, 12);
  const window = { start: Date.parse('2026-08-31T16:00:00Z'), end: Date.parse('2026-09-30T16:00:00Z') };
  const lunations = buildLunationWindows(window), [carry] = lunations;
  const stationAt = '2026-09-10T18:40:38.768Z';
  const longitude = Ecliptic(GeoVector(Body.Uranus, new Date(stationAt), true)).elon;
  const natalTarget = normalize(longitude + 180);
  const birthWindow = { start: Date.UTC(1980, 7, 1), end: Date.UTC(1980, 8, 1) };
  const readMoon = at => readProgressionPosition('Moon', at, at).longitude;
  const [moon] = scanCircularRegions(birthWindow, readMoon, [natalTarget], 6 * 3_600_000).crossings;
  let before = moon.at - 1_000, after = moon.at + 1_000;
  while (after - before > 1) {
    const midpoint = Math.floor((before + after) / 2);
    if (readMoon(midpoint) < natalTarget) before = midpoint;
    else after = midpoint;
  }
  assert.ok(Math.abs(readMoon(after) - natalTarget) <= 0.000001);
  const snapshot = at => chart(at, eclipticEquator(carry.longitude, e_tilt(MakeTime(new Date(at))).tobl).rightAscension);
  const archive = { snapshotId: 'sepharial-uranus-station-opposite-moon', chart: snapshot(after) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), archive.snapshotId, archive);
  const match = result(run, 17);
  assert.equal(match.status, 'partial');
  const hit = run.facts.find(fact => match.sourceFactIds.includes(fact.factId) && fact.normalizedPayload.natalTarget === 'MC');
  const rawStation = run.facts.find(fact => fact.factType === 'station' && fact.exactInstant === stationAt && fact.subjectIds.includes('Uranus'));
  assert.ok(hit && rawStation);
  const witness = hit.normalizedPayload.stationaryTransits.find(row => row.aspect === 'opposition');
  assert.deepEqual(witness, { at: stationAt, body: 'Uranus', target: 'Moon', directionAfter: 'retrograde',
    aspect: 'opposition', sameNatalIndicator: false });
  assert.ok(rawStation.sourceFactIds.every(id => hit.sourceFactIds.includes(id)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  assert.match(formatFortuneFactAudit(input), /天王星在.*停驻时精确对冲本命月亮/u);
  assert.doesNotMatch(formatFortunePrompt(input), /停驻时精确对冲本命月亮|stationaryTransits/u);
  for (const [natal, span] of [[archive.chart, { ...carry, end: Date.parse(stationAt) }], [snapshot(after + 60_000), carry]]) {
    const houses = buildWesternSourceHouses(window, natal, []);
    const context = buildSepharialLunationContexts([span], houses, [rawStation]).find(row => row.natalTarget === 'MC');
    assert.ok(context);
    assert.deepEqual(context.stationaryTransits, []);
  }
});

test('actual annual, monthly and daily passages match the time place through SQLite', () => {
  const natal = chart(birthAt, 30);
  for (const [level, target, index, origin, body, expectedAt, expectedSign, excerpt, wrongBody] of [
    ['year', { year: 2026 }, 27, 'ASC', 'Jupiter', '2026-06-30T05:56:15.218Z', 4, 'places of the years', 'Moon'],
    ['month', { year: 2026, month: 7 }, 28, 'Sun', 'Sun', '2026-07-22T19:13:18.705Z', 4, 'Mars, Venus, and Mercury', 'Jupiter'],
    ['day', { date: '2026-07-17' }, 29, 'Moon', 'Moon', '2026-07-17T00:07:03.852Z', 5, 'transits of the moon', 'Venus'],
  ]) {
    const run = calculate(natal, level, target);
    validateFortuneFacts(run);
    const timed = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.level === level && p.origin === origin && p.transitBody === body && p.aspectType === 'conjunction');
    const hit = timed.find(row => row.exactInstant && Math.abs(Date.parse(row.exactInstant) - Date.parse(expectedAt)) < 1_000);
    assert.ok(hit && hit.exactInstant === hit.activeFrom, level);
    const p = hit.normalizedPayload, at = Date.parse(hit.exactInstant);
    const longitude = instant => body === 'Sun' ? SunPosition(new Date(instant)).elon
      : Ecliptic(GeoVector(Body[body], new Date(instant), true)).elon;
    assert.deepEqual([sign(longitude(at - 2_000)), sign(longitude(at + 2_000))], [expectedSign - 1, expectedSign], level);
    assert.deepEqual([p.sign, p.transitSign, p.enteredDuringTimedPlace], [expectedSign, expectedSign, true], level);
    assert.equal(p.timedPlaceIngressAt, hit.exactInstant);
    assert.ok(p.fullPeriodStart <= hit.exactInstant && hit.exactInstant < p.fullPeriodEnd, level);
    assert.equal(p.annualRuler, ptolemySignRuler(p.annualSign));
    assert.equal(p.ruler, ptolemySignRuler(p.sign));
    if (level !== 'year') {
      assert.equal(p.monthlyRuler, ptolemySignRuler(p.monthSign));
      assert.equal(p.monthlyOriginAspect, ptolemySignAspect(p.monthSign, p.natalGovernors.sign) ?? 'none');
      assert.equal(p.transitMonthlyAspect, ptolemySignAspect(p.transitSign, p.monthSign) ?? 'none');
    }
    const match = result(run, index);
    assert.equal(match.status, 'matched', level);
    assert.equal(match.matchedSourceExcerpt, excerpt);
    assert.ok(match.sourceFactIds.includes(hit.factId));
    const scope = changes => ({ ...run, facts: [{ ...hit, normalizedPayload: { ...p, ...changes } }] });
    assert.equal(result(scope({ enteredDuringTimedPlace: undefined, timedPlaceIngressAt: undefined }), index).status, 'matched');
    assert.equal(result(scope({ aspectType: undefined }), index).status, 'unknown');
    for (const changes of [{ level: 'primary' }, { transitBody: wrongBody }, { aspectType: 'trine' },
      { profile: 'ordinary-whole-sign-houses' }]) {
      assert.equal(result(scope(changes), index).status, 'not_matched', level);
    }
    if (level === 'year') {
      const ongoing = realRun();
      const birthday = '2026-01-01T04:00:00.000Z';
      const prior = ongoing.facts.find(({ factType, activeFrom, normalizedPayload: q }) =>
        factType === 'ptolemy_ingress_contact' && activeFrom === birthday && q.fullPeriodStart === birthday
        && q.level === 'year' && q.origin === 'ASC' && q.transitBody === 'Jupiter' && q.aspectType === 'conjunction');
      assert.ok(prior);
      assert.deepEqual([sign(longitude(Date.parse(birthday) - 2_000)), prior.normalizedPayload.transitSign], [3, 3]);
      assert.equal(prior.normalizedPayload.enteredDuringTimedPlace, false);
      assert.equal(prior.exactInstant, undefined);
      assert.deepEqual(result({ ...ongoing, facts: [prior] }, index).windows, [{ start: birthday, endExclusive: prior.activeTo }]);
      const carried = timed.find(row => row.activeFrom === hit.activeTo);
      assert.ok(carried && carried.exactInstant === undefined);
      assert.equal(carried.normalizedPayload.enteredDuringTimedPlace, true);
      assert.ok(match.sourceFactIds.includes(carried.factId));
      assert.ok(match.windows.some(window => window.start === hit.activeFrom && window.endExclusive === carried.activeTo));
      const anotherBirth = chart(Date.parse('1990-03-01T04:00:00Z'), 30);
      const nextYear = calculate(anotherBirth, level, { year: 2027 });
      validateFortuneFacts(nextYear);
      const continued = nextYear.facts.find(({ factType, normalizedPayload: q, activeFrom }) =>
        factType === 'ptolemy_ingress_contact' && q.level === level && q.origin === origin && q.transitBody === body
        && q.aspectType === 'conjunction' && q.sign === expectedSign && activeFrom === '2026-12-31T16:00:00.000Z');
      assert.ok(continued && continued.normalizedPayload.enteredDuringTimedPlace);
      assert.equal(continued.exactInstant, undefined);
      assert.ok(Math.abs(Date.parse(continued.normalizedPayload.timedPlaceIngressAt) - at) < 1_000);
      const matchedCarry = result({ ...nextYear, facts: [continued] }, index);
      assert.equal(matchedCarry.status, 'matched');
      assert.deepEqual(matchedCarry.windows, [{ start: continued.activeFrom, endExclusive: '2027-03-01T04:00:00.000Z' }]);
    }
    if (level === 'month') {
      const carried = timed.find(row => row.activeTo === '2026-07-16T04:00:00.000Z');
      assert.ok(carried && carried.exactInstant === undefined);
      assert.equal(carried.normalizedPayload.enteredDuringTimedPlace, true);
      assert.equal(sign(longitude(Date.parse(carried.normalizedPayload.timedPlaceIngressAt) - 2_000)), 2);
      assert.equal(sign(longitude(Date.parse(carried.normalizedPayload.timedPlaceIngressAt) + 2_000)), 3);
      assert.equal(result({ ...run, facts: [carried] }, index).status, 'matched');
      const latePlace = run.facts.find(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
        && q.level === 'month' && q.origin === 'Moon' && q.transitBody === 'Venus' && q.sign === 5
        && q.aspectType === 'conjunction' && q.fullPeriodStart === '2026-07-16T04:00:00.000Z');
      const earlierVenusIngress = Date.parse('2026-07-09T17:22:26.922Z');
      const venusSign = at => sign(Ecliptic(GeoVector(Body.Venus, new Date(at), true)).elon);
      assert.deepEqual([venusSign(earlierVenusIngress - 2_000), venusSign(earlierVenusIngress + 2_000)], [4, 5]);
      assert.ok(latePlace && latePlace.activeFrom > new Date(earlierVenusIngress).toISOString());
      assert.equal(latePlace.exactInstant, undefined);
      assert.equal(latePlace.normalizedPayload.enteredDuringTimedPlace, false);
      const lateMatch = result({ ...run, facts: [latePlace] }, index);
      assert.equal(lateMatch.status, 'matched');
      assert.deepEqual(lateMatch.windows, [{ start: latePlace.activeFrom, endExclusive: latePlace.activeTo }]);
      const august = calculate(natal, 'month', { year: 2026, month: 8 });
      const continued = august.facts.find(({ factType, normalizedPayload: q, activeFrom }) => factType === 'ptolemy_ingress_contact'
        && q.level === level && q.origin === origin && q.transitBody === body && q.sign === expectedSign
        && q.aspectType === 'conjunction' && activeFrom === '2026-07-31T16:00:00.000Z');
      assert.ok(continued && continued.exactInstant === undefined);
      assert.ok(Math.abs(Date.parse(continued.normalizedPayload.timedPlaceIngressAt) - at) < 1_000);
      assert.ok(result(august, index).sourceFactIds.includes(continued.factId));
    }
    if (level === 'day') {
      assert.ok(match.windows.every(w => Date.parse(w.endExclusive) - Date.parse(w.start) <= day));
      assert.equal(p.dayManuscriptAgreement, 'same-place');
      assert.equal(p.alternateManuscriptDaySign, expectedSign);
      assert.ok(match.confirmedBranches.some(branch => branch.conditions.some(condition => condition.includes('两份手稿'))));
      const tomorrow = calculate(natal, 'day', { date: '2026-07-18' });
      const carried = tomorrow.facts.find(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
        && q.level === level && q.origin === origin && q.transitBody === body && q.sign === expectedSign);
      assert.ok(carried && carried.exactInstant === undefined);
      assert.equal(carried.normalizedPayload.enteredDuringTimedPlace, true);
      assert.equal(carried.normalizedPayload.dayManuscriptAgreement, 'same-place');
      assert.ok(Math.abs(Date.parse(carried.normalizedPayload.timedPlaceIngressAt) - at) < 1_000);
      const continued = result({ ...tomorrow, facts: [carried] }, index);
      assert.equal(continued.status, 'matched');
      assert.deepEqual(continued.windows, [{ start: carried.activeFrom, endExclusive: carried.activeTo }]);
      const later = calculate(natal, 'day', { date: '2026-08-05' });
      validateFortuneFacts(later);
      const differs = later.facts.find(({ factType, normalizedPayload: q, exactInstant }) => factType === 'ptolemy_ingress_contact'
        && q.level === level && q.origin === origin && q.transitBody === body && q.aspectType === 'conjunction'
        && Math.abs(Date.parse(exactInstant) - Date.parse('2026-08-05T02:35:20.800Z')) < 1_000);
      assert.ok(differs);
      const altAt = Date.parse(differs.exactInstant), q = differs.normalizedPayload;
      assert.deepEqual([sign(longitude(altAt - 2_000)), sign(longitude(altAt + 2_000))], [0, 1]);
      assert.deepEqual([q.enteredDuringTimedPlace, q.sign, q.alternateManuscriptDaySign, q.dayManuscriptAgreement],
        [true, 1, 0, 'different-place']);
      const monthStart = Date.parse(q.annualStart) + q.monthIndex * 28 * day;
      assert.equal(Math.floor((altAt - monthStart) / (7 * day / 3)), 8);
      assert.equal(Math.floor((altAt - monthStart) / (5 * day / 2)), 7);
      const variant = { ...later, facts: [differs] };
      const variantMatch = result(variant, index);
      assert.equal(variantMatch.status, 'matched');
      assert.ok(variantMatch.matchedConditions.every(condition => !condition.includes('两份手稿')));
      const { input: variantModel } = buildFortuneModelContext(variant,
        interpretFortune(variant, requestForFortuneRun(variant), 'ptolemy-variant-difference'));
      assert.doesNotMatch(formatFortunePrompt(variantModel), /两份手稿|dayManuscriptAgreement|alternateManuscriptDaySign/u);

      const crossing = calculate(natal, 'day', { date: '2026-07-21' });
      const alternateBoundary = '2026-07-21T04:00:00.000Z';
      const ongoing = crossing.facts.filter(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
        && q.level === 'day' && q.origin === 'Sun' && q.transitBody === 'Moon' && q.aspectType === 'conjunction' && q.sign === 6);
      assert.equal(ongoing.length, 2);
      const [before, after] = ongoing;
      assert.deepEqual([before.activeTo, after.activeFrom], [alternateBoundary, alternateBoundary]);
      assert.equal(sign(longitude(Date.parse(before.activeFrom) - 2_000)), 6);
      assert.ok(ongoing.every(f => f.normalizedPayload.enteredDuringTimedPlace === false && !f.exactInstant));
      assert.deepEqual(ongoing.map(f => f.normalizedPayload.dayManuscriptAgreement), ['different-place', 'same-place']);
      const scoped = result({ ...crossing, facts: ongoing }, index);
      assert.equal(scoped.status, 'matched');
      assert.deepEqual(scoped.windows, [{ start: before.activeFrom, endExclusive: after.activeTo }]);
      assert.deepEqual(scoped.confirmedBranches.find(branch => branch.conditions.some(c => c.includes('两份手稿'))).windows,
        [{ start: alternateBoundary, endExclusive: after.activeTo }]);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-real-ingress-' + level));
    assert.match(formatFortuneFactAudit(input), /实际进入这个星座的时刻为/u);
    assert.match(formatFortuneFactAudit(input), /进入该星座的过点落在同一起点的该级时限内/u);
    const prompt = formatFortunePrompt(input);
    const conditions = match.matchedConditions ?? match.confirmedBranches.flatMap(branch => branch.conditions);
    for (const condition of conditions) assert.ok(prompt.includes(condition));
    assert.ok(prompt.includes(excerpt));
    assert.doesNotMatch(prompt, /实际进入这个星座的时刻为|进入该星座的过点|enteredDuringTimedPlace|physicalIngressAt|timedPlaceIngressAt|dayManuscriptAgreement|alternateManuscriptDaySign/u);
  }
});

function runPtolemyClient(periodType, targetPeriod, atBirth, { weekStartsOn = 1, armc = 210 } = {}) {
  const params = { periodType, targetPeriod, displayTimezone: 'UTC', weekStartsOn };
  const now = Date.UTC(2026, 6, 13, 12);
  const reference = { snapshotId: 'ptolemy-annual-daily-cross-check', chart: chart(atBirth, armc) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  return run;
}

test('Ptolemy checks real annual Jupiter occupancy against both express Almagest year lengths', () => {
  const birth = Date.UTC(1990, 6, 5, 4);
  const run = runPtolemyClient('year', { year: 2026 }, birth, { armc: 135 });
  const contact = p => p.level === 'year' && p.origin === 'MC' && p.transitBody === 'Jupiter' && p.aspectType === 'conjunction';
  const annual = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact' && contact(p));
  const egyptianBoundary = birth + 36 * 365 * day;
  const egyptianAt = new Date(egyptianBoundary).toISOString();
  assert.equal(egyptianAt, '2026-06-26T04:00:00.000Z');
  const agreement = annual.find(fact => fact.activeTo === egyptianAt);
  const differing = annual.find(fact => fact.activeFrom === egyptianAt);
  const later = annual.find(fact => fact.activeFrom === '2026-07-05T04:00:00.000Z');
  assert.ok(agreement && differing && later);
  const profile = 'ptolemy-almagest-III1-mean-and-egyptian-year-v1';
  assert.deepEqual([agreement, differing, later].map(({ exactInstant, normalizedPayload: p }) =>
    [p.annualClockComparisonProfile, p.annualClockAgreement, p.completedYears, p.annualSign, p.transitSign, exactInstant]), [
    [profile, 'three-year-counts-agree', 35, 3, 3, undefined],
    [profile, 'year-counts-differ', 35, 3, 3, undefined],
    [profile, 'three-year-counts-agree', 36, 4, 4, undefined],
  ]);
  const jupiter = at => sign(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon);
  assert.deepEqual([jupiter(egyptianBoundary - 2_000), jupiter(egyptianBoundary + 2_000)], [3, 3]);
  const ingress = Date.parse(differing.activeTo);
  assert.ok(Math.abs(ingress - Date.parse('2026-06-30T05:56:15Z')) < 1_000);
  assert.deepEqual([jupiter(ingress - 2_000), jupiter(ingress + 2_000)], [3, 4]);
  const byClock = evaluateFortuneRules('western', 'year', [agreement, differing, later])
    .find(rule => rule.knowledgeId === fortuneKnowledge.western.rules[27].knowledgeId).confirmations
    .find(entry => JSON.parse(entry.condition).where.annualClockAgreement === 'three-year-counts-agree');
  assert.deepEqual(new Set(byClock.hits.map(fact => fact.factId)), new Set([agreement.factId, later.factId]));
  const isolated = { ...run, facts: [agreement] };
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'ptolemy-year-clocks'));
  assert.match(formatFortuneFactAudit(input), /三种年长计数一致/u);
  const disagreement = { ...run, facts: [differing] };
  const { input: disagreementInput } = buildFortuneModelContext(disagreement,
    interpretFortune(disagreement, requestForFortuneRun(disagreement), 'ptolemy-year-clocks'));
  assert.match(formatFortuneFactAudit(disagreementInput), /三种年长计数出现分歧/u);
  const prompt = formatFortunePrompt(input);
  assert.ok(byClock.sourceConditions.every(condition => prompt.includes(condition)));
  assert.doesNotMatch(prompt, /annualClockComparisonProfile|annualClockAgreement|2026-06-26T04:00/u);

  const secondBirth = Date.UTC(1992, 5, 28, 4);
  const second = buildPtolemyTimes({ start: Date.UTC(2026, 5, 27), end: Date.UTC(2026, 6, 2) }, 'year', chart(secondBirth, 162), []);
  const meanBoundary = secondBirth + 34 * (365 * day + 21_312_000);
  assert.equal(new Date(meanBoundary).toISOString(), '2026-06-28T13:16:48.000Z');
  const [before, after] = second.contacts.filter(contact);
  assert.deepEqual([before.start, before.end, after.start, before.annualClockAgreement, after.annualClockAgreement],
    [Date.UTC(2026, 5, 28, 4), meanBoundary, meanBoundary, 'year-counts-differ', 'three-year-counts-agree']);
  assert.ok([before, after].every(row => row.transitSign === 3 && row.physicalIngressAt === undefined));
  assert.deepEqual([jupiter(meanBoundary - 2_000), jupiter(meanBoundary + 2_000)], [3, 3]);
});

test('Ptolemy shares real monthly and daily ingresses across three annual anchors only in the common subperiod', () => {
  const profile = 'ptolemy-IV10-three-year-anchors-fixed-subperiods-v1';
  const find = (run, from, level, origin, body) => run.facts.find(({ factType, activeFrom, normalizedPayload: p }) =>
    factType === 'ptolemy_ingress_contact' && activeFrom === from && p.level === level && p.origin === origin
    && p.transitBody === body && p.aspectType === 'conjunction');
  const verify = (run, ruleIndex, period, positive, negative) => {
    assert.ok(positive && negative);
    assert.equal(positive.activeTo, negative.activeFrom);
    assert.deepEqual([positive, negative].map(({ normalizedPayload: p }) => [p.subperiodClockComparisonProfile, p.subperiodClockAgreement]),
      [[profile, 'same-index'], [profile, 'different-index']]);
    assert.ok([positive, negative].every(({ normalizedPayload: p }) => p.transitSign === p.sign));
    const passages = evaluateFortuneRules('western', period, [positive, negative])
      .find(rule => rule.knowledgeId === fortuneKnowledge.western.rules[ruleIndex].knowledgeId).confirmations;
    const branch = passages.find(row => JSON.parse(row.condition).where.subperiodClockAgreement === 'same-index');
    assert.deepEqual(branch.hits, [positive]);
    const selected = { ...run, facts: [positive, negative] };
    const hit = result(selected, ruleIndex);
    assert.equal(hit.status, 'matched');
    assert.ok(hit.confirmedBranches.some(row => row.conditions[0] === branch.sourceConditions[0]
      && row.windows.some(({ start, endExclusive }) => start === positive.activeFrom && endExclusive === positive.activeTo)));
    const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'ptolemy-subperiod-clocks'));
    assert.ok(branch.sourceConditions.every(condition => formatFortunePrompt(input).includes(condition)));
    assert.doesNotMatch(formatFortunePrompt(input), /subperiodClockAgreement|三个年度起点在此段/u);
    assert.match(formatFortuneFactAudit(input), /三个年度起点在此段推得同一子期/u);
  };

  const adult = Date.UTC(1990, 6, 5, 4), geometry = { armc: 135 };
  const monthly = runPtolemyClient('month', { year: 2026, month: 7 }, adult, geometry);
  const annual = runPtolemyClient('year', { year: 2026 }, adult, geometry);
  const solarIngress = '2026-07-22T19:13:18.705Z';
  const monthBoundary = '2026-07-24T04:00:00.000Z';
  assert.equal(Date.parse(monthBoundary), adult + 36 * 365 * day + 28 * day);
  assert.deepEqual([sign(SunPosition(new Date(Date.parse(solarIngress) - 2_000)).elon),
    sign(SunPosition(new Date(Date.parse(monthBoundary) + 2_000)).elon)], [3, 4]);
  for (const [run, ruleIndex, period] of [[monthly, 28, 'month'], [annual, 31, 'year']]) {
    const positive = find(run, solarIngress, 'month', 'MC', 'Sun');
    const negative = find(run, monthBoundary, 'month', 'MC', 'Sun');
    assert.ok(positive?.normalizedPayload.sameAsMonthlyLord);
    assert.deepEqual([positive.exactInstant, negative?.exactInstant], [solarIngress, undefined]);
    verify(run, ruleIndex, period, positive, negative);
  }

  const young = Date.UTC(2022, 6, 5, 4);
  const weekly = runPtolemyClient('week', { weekStartDate: '2026-07-06' }, young, geometry);
  const dayStart = '2026-07-07T16:00:00.000Z', dayBoundary = '2026-07-08T20:00:00.000Z';
  assert.equal(Date.parse(dayBoundary), young + 4 * 365 * day + 2 * 7 * day / 3);
  const positive = find(weekly, dayStart, 'day', 'ASC', 'Moon');
  const negative = find(weekly, dayBoundary, 'day', 'ASC', 'Moon');
  assert.ok(positive && negative);
  assert.equal(positive.normalizedPayload.dayManuscriptAgreement, 'same-place');
  assert.equal(sign(Ecliptic(GeoVector(Body.Moon, new Date(Date.parse(dayBoundary) + 2_000), true)).elon), 0);
  assert.equal(result(weekly, 29).status, 'not_applicable');
  const daily = runPtolemyClient('day', { date: '2026-07-08' }, young, geometry);
  verify(daily, 29, 'day', find(daily, '2026-07-08T00:00:00.000Z', 'day', 'ASC', 'Moon'),
    find(daily, dayBoundary, 'day', 'ASC', 'Moon'));
});

test('Ptolemy confirms the named annual Jupiter only while it harmonizes with annual and natal places', () => {
  const readJupiter = at => sign(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon);
  const annualJupiter = run => run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'year' && p.origin === 'MC' && p.transitBody === 'Jupiter');
  for (const [atBirth, annualSign, annualAspect] of [[birthAt, 7, 'trine'], [Date.UTC(1968, 0, 1, 4), 5, 'sextile']]) {
    const run = runPtolemyClient('month', { year: 2026, month: 6 }, atBirth);
    const contacts = annualJupiter(run);
    const witness = contacts.find(({ normalizedPayload: p }) => p.transitSign === 3 && p.aspectType === annualAspect);
    assert.ok(witness);
    const p = witness.normalizedPayload;
    assert.deepEqual([p.sign, p.natalGovernors.sign, p.annualOriginAspect, p.transitAnnualAspect,
      p.natalOriginAspect, p.annualTransitNatalOriginAspect, p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler, p.oppositeNatalSect],
      [annualSign, 7, annualSign === 7 ? 'conjunction' : 'sextile', annualAspect, annualAspect, 'trine', false, false, false]);
    assert.equal(p.transitNatalOriginAspect, undefined);
    const end = Date.parse(witness.activeTo);
    assert.ok(Math.abs(end - Date.parse('2026-06-30T05:56:15Z')) < 1_000);
    assert.deepEqual([readJupiter(end - 2_000), readJupiter(end + 2_000)], [3, 4]);
    const scoped = { ...run, facts: [witness] };
    const matched = result(scoped, 30);
    assert.equal(matched.status, 'matched');
    assert.equal(matched.matchedSourceExcerpt, 'favourable aspect');
    assert.deepEqual(matched.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    if (annualSign === 7) {
      const square = contacts.find(({ activeFrom, normalizedPayload: q }) => activeFrom === witness.activeTo && q.aspectType === 'square');
      assert.ok(square);
      assert.equal(square.normalizedPayload.annualTransitNatalOriginAspect, 'square');
      assert.notEqual(result({ ...run, facts: [square] }, 30).status, 'matched');
    }
    for (const changes of [{ governsNatalOrigin: true }, { sameAsNatalAuthorTermRuler: true }, { oppositeNatalSect: true },
      { annualTransitNatalOriginAspect: 'opposition' }]) {
      assert.notEqual(result({ ...run, facts: [{ ...witness, normalizedPayload: { ...p, ...changes } }] }, 30).status, 'matched');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-jupiter-annual'));
    const audit = formatFortuneFactAudit(input);
    assert.match(audit, /过境星座与本命起算点构成整星座三分/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /favourable aspect/u);
    assert.doesNotMatch(prompt, /annualTransitNatalOriginAspect|2026-06-30T05:56/u);
  }
});

test('Ptolemy separates annual Jupiter opposing the natal origin from opposing only its harmonious time place', () => {
  const atBirth = Date.UTC(1987, 0, 1, 4);
  const jupiterSign = at => sign(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon);
  for (const [year, month, crossing, annualSign, annualOriginAspect, previousSign, newSign, natalAspect] of [
    [2023, 5, '2023-05-16T17:28:01.127Z', 7, 'conjunction', 0, 1, 'opposition'],
    [2015, 8, '2015-08-11T11:06:49.569Z', 11, 'trine', 4, 5, 'sextile'],
  ]) {
    const run = runPtolemyClient('month', { year, month }, atBirth);
    const witness = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.origin === 'MC' && p.level === 'year' && p.transitBody === 'Jupiter' && p.aspectType === 'opposition');
    assert.ok(witness);
    const p = witness.normalizedPayload;
    assert.deepEqual([p.sign, p.natalGovernors.sign, p.annualOriginAspect, p.transitAnnualAspect,
      p.natalOriginAspect, p.annualTransitNatalOriginAspect, p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler, p.oppositeNatalSect],
      [annualSign, 7, annualOriginAspect, 'opposition', 'trine', natalAspect, false, false, false]);
    const event = Date.parse(witness.activeFrom);
    assert.ok(Math.abs(event - Date.parse(crossing)) < 1_000, witness.activeFrom);
    assert.deepEqual([jupiterSign(event - 2_000), jupiterSign(event + 2_000)], [previousSign, newSign]);
    const scoped = { ...run, facts: [witness] };
    const match = result(scoped, 30);
    assert.equal(match.status, 'matched');
    assert.equal(match.matchedSourceExcerpt, 'even as they cause evil if they oppose');
    assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    assert.match(match.matchedConditions.join('。'), annualOriginAspect === 'conjunction' ? /同座年位/u : /同时仍与本命原位/u);
    for (const changed of [{ oppositeNatalSect: true }, { governsNatalOrigin: true }, { sameAsNatalAuthorTermRuler: true },
      { transitAnnualAspect: 'square' }, { annualTransitNatalOriginAspect: 'square' }]) {
      const invalid = { ...witness, normalizedPayload: { ...p, ...changed } };
      assert.notEqual(result({ ...scoped, facts: [invalid] }, 30).status, 'matched');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-annual-opposition'));
    assert.match(formatFortunePrompt(input), /偏难线索/u);
    assert.doesNotMatch(formatFortunePrompt(input), /annualTransitNatalOriginAspect|ptolemy-annual-opposition/u);
  }
});

test('Ptolemy tests an opposite-sect Jupiter against both annual and natal places', () => {
  const samples = [
    { birth: birthAt, armc: 180, origin: 'MC', natal: 'square', aspect: 'square', natalContact: 'square', closes: true },
    { birth: birthAt, armc: 0, origin: 'Moon', natal: 'none', aspect: 'opposition', natalContact: 'opposition', closes: false },
    { birth: Date.UTC(1968, 0, 1, 4), armc: 60, origin: 'MC', natal: 'square', aspect: 'square', natalContact: 'none', closes: true },
  ];
  const jupiterSign = at => sign(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon);
  for (const sample of samples) {
    const run = runPtolemyClient('month', { year: 2026, month: 6 }, sample.birth, { armc: sample.armc });
    const annual = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'year' && p.origin === sample.origin && p.transitBody === 'Jupiter');
    const witness = annual.find(({ normalizedPayload: p }) => p.aspectType === sample.aspect);
    assert.ok(witness, sample.origin);
    const p = witness.normalizedPayload;
    assert.deepEqual([p.natalOriginAspect, p.transitAnnualAspect, p.annualTransitNatalOriginAspect,
      p.oppositeNatalSect, p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler],
    [sample.natal, sample.aspect, sample.natalContact, true, false, false]);
    const crossing = Date.parse(sample.closes ? witness.activeTo : witness.activeFrom);
    assert.ok(Math.abs(crossing - Date.parse('2026-06-30T05:56:15Z')) < 1_000);
    assert.deepEqual([jupiterSign(crossing - 2_000), jupiterSign(crossing + 2_000)], [3, 4]);
    const scoped = { ...run, facts: [witness] };
    const match = result(scoped, 30);
    assert.equal(match.status, 'matched');
    assert.equal(match.matchedSourceExcerpt, 'if they are in opposition or in quartile');
    assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    for (const changes of [{ oppositeNatalSect: false }, { governsNatalOrigin: true }, { sameAsNatalAuthorTermRuler: true }]) {
      assert.notEqual(result({ ...scoped, facts: [{ ...witness, normalizedPayload: { ...p, ...changes } }] }, 30).status, 'matched');
    }
    if (sample.armc === 180) {
      const softer = annual.find(fact => fact.activeFrom === witness.activeTo && fact.normalizedPayload.aspectType === 'sextile');
      assert.ok(softer);
      assert.equal(result({ ...run, facts: [softer] }, 30).status, 'not_matched');
    } else if (sample.natalContact === 'none') {
      assert.equal(p.annualOriginAspect, 'sextile');
      assert.match(match.matchedConditions.join(''), /只对年位/u);
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-annual-discord'));
    assert.match(formatFortunePrompt(input), /if they are in opposition or in quartile/u);
    assert.doesNotMatch(formatFortunePrompt(input), /annualTransitNatalOriginAspect|2026-06-30T05:56/u);
  }
});

test('Ptolemy shares the real Jupiter annual occupancy and annual lord across three clocks', () => {
  const run = runPtolemyClient('year', { year: 2021 }, birthAt, { armc: 135 });
  const sameLord = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.origin === 'MC' && p.level === 'year' && p.transitBody === 'Jupiter' && p.aspectType === 'conjunction'
    && p.sameAsAnnualLord === true && p.sign === 11);
  const common = sameLord.find(row => row.normalizedPayload.annualClockAgreement === 'three-year-counts-agree'
    && row.exactInstant === row.activeFrom && row.activeFrom.startsWith('2021-05-13'));
  const disputed = sameLord.find(row => row.normalizedPayload.annualClockAgreement === 'year-counts-differ'
    && row.exactInstant === row.activeFrom && row.activeFrom.startsWith('2021-12-29'));
  assert.ok(common && disputed);
  const at = Date.parse(common.exactInstant);
  const jupiterSign = value => sign(Ecliptic(GeoVector(Body.Jupiter, new Date(value), true)).elon);
  assert.deepEqual([jupiterSign(at - 2_000), jupiterSign(at + 2_000)], [10, 11]);
  assert.ok(Math.abs(at - Date.parse('2021-05-13T22:49:20Z')) < 1_000);
  const scoped = { ...run, facts: [common, disputed] };
  assert.equal(result(scoped, 27).status, 'matched');
  assert.equal(result(scoped, 31).status, 'matched');
  for (const index of [27, 31]) {
    const resolved = evaluateFortuneRules('western', 'year', [common, disputed])
      .find(rule => rule.knowledgeId === fortuneKnowledge.western.rules[index].knowledgeId);
    const branch = resolved.confirmations.find(row => JSON.parse(row.condition).where.annualClockAgreement === 'three-year-counts-agree');
    assert.deepEqual(branch.hits, [common]);
    const match = result(scoped, index);
    assert.ok(match.confirmedBranches.some(row => row.conditions[0] === branch.sourceConditions[0]
      && row.windows.some(({ start, endExclusive }) => start === common.activeFrom && endExclusive === common.activeTo)));
  }
  assert.equal(result({ ...run, facts: [disputed] }, 31).status, 'matched');
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-shared-jupiter-lord'));
  assert.match(formatFortuneFactAudit(input), /三种年长计数一致/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /木星本人也守护该年位/u);
  assert.doesNotMatch(prompt, /annualClockAgreement|2021-05-13T22:49/u);
});

test('Ptolemy confirms a daily lunar co-ruler only within a Cancer period shared by both day clocks', () => {
  const run = runPtolemyClient('year', { year: 2026 }, birthAt);
  const week = runPtolemyClient('week', { weekStartDate: '2026-07-10' }, birthAt, { weekStartsOn: 5 });
  const lunarContacts = facts => facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'day' && p.origin === 'Fortune' && p.transitBody === 'Moon' && p.aspectType === 'conjunction');
  const contacts = lunarContacts(run.facts);
  assert.ok(contacts.every(({ normalizedPayload: p }) => p.dayManuscriptMoonContact && p.sameAsDailyLord));
  const witness = contacts.find(({ activeFrom }) => activeFrom === '2026-07-13T04:00:00.000Z');
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.sign, p.transitSign, p.alternateManuscriptDaySign, p.ruler, p.dayManuscriptAgreement], [3, 3, 3, 'Moon', 'same-place']);
  assert.deepEqual([witness.activeFrom, witness.activeTo, witness.exactInstant],
    ['2026-07-13T04:00:00.000Z', '2026-07-13T20:00:00.000Z', undefined]);
  const weekContacts = lunarContacts(week.facts);
  const before = weekContacts.find(({ activeTo, normalizedPayload: q }) => activeTo === witness.activeFrom && q.sameAsDailyLord);
  assert.ok(before);
  assert.equal(before.normalizedPayload.dayManuscriptAgreement, 'different-place');
  assert.equal(before.normalizedPayload.dayManuscriptMoonContact, false);
  assert.ok(Math.abs(Date.parse(before.exactInstant) - Date.parse('2026-07-12T22:46:25Z')) < 1_000);
  const moon = at => sign(Ecliptic(GeoVector(Body.Moon, new Date(at), true)).elon);
  const ingress = Date.parse(before.exactInstant);
  assert.deepEqual([moon(ingress - 2_000), moon(ingress + 2_000), moon(Date.parse(witness.activeTo))], [2, 3, 3]);
  const gemini = weekContacts.find(({ normalizedPayload: q }) => q.transitSign === 2 && q.dayManuscriptMoonContact);
  assert.ok(gemini);
  assert.equal(gemini.normalizedPayload.sameAsDailyLord, false);

  const scoped = { ...run, facts: [witness] };
  const matched = result(scoped, 31);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, 'lords of both');
  assert.deepEqual(matched.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  for (const fact of [before, gemini]) {
    const date = (fact.exactInstant ?? fact.activeFrom).slice(0, 10);
    const daily = runPtolemyClient('day', { date }, birthAt);
    assert.equal(result(daily, 29).status, 'matched');
    assert.equal(result({ ...week, facts: [fact] }, 29).status, 'not_applicable');
    assert.notEqual(result({ ...run, facts: [fact] }, 31).status, 'matched');
  }
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-day-moon'));
  const audit = /实际过境的月亮也守护两种读法共同的日位星座/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /lords of both/u);
  assert.doesNotMatch(prompt, audit);
  assert.doesNotMatch(prompt, /sameAsDailyLord|dayManuscriptAgreement|2026-07-13T04:00/u);
});

test('Ptolemy reverses an originally harmonious non-ruling transit opposing coincident natal and monthly signs', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 1 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-01-25T12:00:00Z');
  const reference = { snapshotId: 'ptolemy-harmonious-reversal', chart: chart(birthAt, 30) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const isOpposition = ({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'ASC' && p.transitBody === 'Mars' && p.aspectType === 'opposition';
  const [witness] = run.facts.filter(isOpposition);
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.natalOriginAspect, p.transitNatalOriginAspect, p.oppositeNatalSect, p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler],
    ['trine', 'opposition', false, false, false]);
  assert.deepEqual([p.natalGovernors.sign, p.sign, p.transitSign], [4, 4, 10]);
  const ingress = Date.parse(witness.activeFrom);
  assert.ok(Math.abs(ingress - Date.parse('2026-01-23T09:16:18.881Z')) < 1_000);
  const marsSign = at => sign(Ecliptic(GeoVector(Body.Mars, new Date(at), true)).elon);
  assert.deepEqual([marsSign(ingress - 60_000), marsSign(ingress + 60_000)], [9, 10]);
  assert.equal(witness.activeTo, '2026-01-29T04:00:00.000Z');
  assert.ok(run.facts.filter(isOpposition).every(row => row.activeTo <= witness.activeTo));
  const match = result(run, 30);
  const scoped = { ...run, facts: [witness] };
  const reversal = result(scoped, 30);
  assert.equal(reversal.status, 'matched');
  assert.equal(reversal.matchedSourceExcerpt, 'even as they cause evil if they oppose');
  assert.ok(match.sourceFactIds.includes(witness.factId));
  assert.deepEqual(reversal.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);

  const only = changes => result({ ...run, facts: [{ ...witness, normalizedPayload: { ...p, ...changes } }] }, 30);
  assert.equal(only({ transitNatalOriginAspect: 'trine' }).status, 'not_matched');
  assert.equal(only({ aspectType: 'square' }).status, 'not_matched');
  assert.equal(only({ oppositeNatalSect: true }).status, 'not_matched');
  assert.equal(only({ transitNatalOriginAspect: undefined }).status, 'unknown');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const audit = '本命原有和谐相位，实际过境同时对原位与月级位置成对分';
  assert.ok(formatFortuneFactAudit(input).includes(audit));
  assert.ok(!formatFortunePrompt(input).includes(audit));
  const { input: confirmed } = buildFortuneModelContext(scoped,
    interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
  const prompt = formatFortunePrompt(confirmed);
  assert.ok(prompt.includes(reversal.matchedSourceExcerpt));
  assert.doesNotMatch(prompt, /favourable aspect|in opposition or in quartile|transitNatalOriginAspect/u);
});

test('Ptolemy verifies a reversing actual opposition to a distinct harmonious monthly place', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 10 }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, 9, 15), reference = { snapshotId: 'ptolemy-opposite-month-only', chart: chart(birthAt, 60) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const venus = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'MC' && p.transitBody === 'Venus');
  const witness = venus.find(row => row.normalizedPayload.transitMonthlyAspect === 'opposition');
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.natalOriginAspect, p.monthlyOriginAspect, p.transitNatalOriginAspect, p.transitAnnualAspect],
    ['trine', 'sextile', 'trine', 'trine']);
  assert.deepEqual([p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler, p.oppositeNatalSect], [false, false, false]);
  const at = Date.parse(witness.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2026-10-25T08:56:58.066Z')) < 1000);
  const venusSign = at => sign(Ecliptic(GeoVector(Body.Venus, new Date(at), true)).elon);
  assert.deepEqual([venusSign(at - 60_000), venusSign(at + 60_000)], [7, 6]);
  const selected = { ...run, facts: [witness] };
  const hit = result(selected, 30);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, 'even as they cause evil if they oppose');
  assert.deepEqual(hit.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  // Before the retrograde ingress Venus is in Scorpio, which has no
  // listed whole-sign aspect to the Aries month place.
  const before = new Date(at - 60_000).toISOString();
  const previousEvidence = venus.filter(row => row.activeFrom <= before && before < row.activeTo);
  assert.deepEqual(previousEvidence, []);
  const text = /月位本身与原位和谐/u;
  assert.notEqual(result({ ...run, facts: previousEvidence }, 30).status, 'matched');
  const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), reference.snapshotId));
  assert.match(formatFortunePrompt(input), text);
  assert.doesNotMatch(formatFortunePrompt(input), /monthlyOriginAspect|transitMonthlyAspect|08:56:58/u);

  const softer = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'Moon' && p.transitBody === 'Sun' && p.aspectType === 'sextile');
  assert.ok(softer);
  assert.deepEqual([softer.normalizedPayload.natalOriginAspect, softer.normalizedPayload.natalOriginSignFamiliarity,
    softer.normalizedPayload.oppositeNatalSect, softer.normalizedPayload.transitAnnualAspect,
    softer.normalizedPayload.transitNatalOriginAspect], ['none', 'alien', true, 'trine', 'trine']);
  const atSofter = Date.parse(softer.activeFrom) + 60_000;
  assert.equal(sign(SunPosition(new Date(atSofter)).elon), softer.normalizedPayload.transitSign);
  assert.equal(ptolemySignAspect(softer.normalizedPayload.transitSign, softer.normalizedPayload.sign), 'sextile');
  const isolated = { ...run, facts: [softer] };
  const noAdverseTrigger = result(isolated, 30);
  assert.equal(noAdverseTrigger.status, 'matched');
  assert.equal(noAdverseTrigger.matchedSourceExcerpt, 'but not in the other aspects');
  assert.deepEqual(noAdverseTrigger.windows, [{ start: softer.activeFrom, endExclusive: softer.activeTo }]);
  const changed = { ...softer, normalizedPayload: { ...softer.normalizedPayload, transitAnnualAspect: 'opposition' } };
  assert.equal(result({ ...run, facts: [changed] }, 30).status, 'not_matched');
  const model = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), reference.snapshotId));
  assert.match(formatFortunePrompt(model.input), /异派不协调再遇刑冲的偏难条件没有出现/u);
});

test('Ptolemy recognizes a real native square as discordant without substituting the annual or monthly bearing', () => {
  const run = calculate(chart(birthAt, 40), 'month', { year: 2026, month: 7 });
  const relation = result(run, 30);
  const evidence = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'Fortune' && p.transitBody === 'Sun'
    && p.natalOriginAspect === 'square' && p.oppositeNatalSect === true && p.aspectType === 'square');
  assert.ok(evidence);
  const p = evidence.normalizedPayload;
  assert.equal(p.governsNatalOrigin, false);
  assert.equal(p.annualOriginAspect, 'conjunction');
  assert.equal(p.monthlyOriginAspect, 'opposition');
  assert.equal(p.transitAnnualAspect, 'square');
  assert.equal(p.transitMonthlyAspect, 'square');
  const scoped = { ...run, facts: [evidence] };
  const discordant = result(scoped, 30);
  assert.equal(discordant.status, 'matched');
  assert.equal(discordant.matchedSourceExcerpt, 'if they are in opposition or in quartile');
  assert.ok(relation.sourceFactIds.includes(evidence.factId));
  const check = fact => evaluateFortuneRules('western', 'month', [fact]).find(row => row.knowledgeId === relation.knowledgeId).required[0].hits;
  assert.equal(check(evidence).length, 1);
  for (const [key, value] of [['natalOriginAspect', 'none'], ['oppositeNatalSect', false], ['aspectType', 'trine']]) {
    assert.equal(check({ ...evidence, normalizedPayload: { ...p, [key]: value } }).length, 0);
  }
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-square')).input;
  const auditedAspects = input.facts.filter(f => f.type === 'ptolemy_ingress_contact' && f.data.origin === 'Fortune')
    .map(f => [f.data.natalOriginAspect, f.data.monthlyOriginAspect]);
  assert.ok(auditedAspects.some(([natal, monthly]) => natal === 'square' && monthly === 'opposition'), JSON.stringify(auditedAspects));
  assert.ok(formatFortuneFactAudit(input).includes('月级时限星座与本命起算点构成整星座对分相'));
  const { input: confirmed } = buildFortuneModelContext(scoped,
    interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-square'));
  const prompt = formatFortunePrompt(confirmed);
  assert.ok(prompt.includes(discordant.matchedSourceExcerpt));
  assert.doesNotMatch(prompt, /favourable aspect|even as they cause evil|transitNatalOriginAspect/u);
  const excluded = { ...evidence, normalizedPayload: { ...p, transitNatalOriginAspect: 'sextile' } };
  assert.equal(result({ ...scoped, facts: [excluded] }, 30).status, 'partial');
  const solarWitnesses = run.facts.filter(({ factType, normalizedPayload: payload }) => factType === 'ptolemy_ingress_contact'
    && payload.level === 'month' && payload.origin === 'Fortune' && payload.transitBody === 'Sun');
  const monthlyOnly = solarWitnesses.find(row => row.normalizedPayload.transitMonthlyAspect === 'square'
    && row.normalizedPayload.transitAnnualAspect === 'sextile');
  assert.ok(monthlyOnly);
  const monthPayload = monthlyOnly.normalizedPayload;
  assert.deepEqual([monthPayload.transitSign, monthPayload.monthSign, monthPayload.annualSign, monthPayload.natalGovernors.sign], [4, 1, 6, 6]);
  assert.deepEqual([monthPayload.natalOriginAspect, monthPayload.oppositeNatalSect, monthPayload.governsNatalOrigin,
    monthPayload.sameAsNatalAuthorTermRuler, monthPayload.transitNatalOriginAspect], ['square', true, false, false, 'sextile']);
  const ingress = Date.parse(monthlyOnly.activeFrom);
  assert.ok(Math.abs(ingress - Date.parse('2026-07-22T19:13:18.265Z')) < 1_000);
  assert.deepEqual([sign(SunPosition(new Date(ingress - 60_000)).elon), sign(SunPosition(new Date(ingress + 60_000)).elon)], [3, 4]);
  assert.equal(monthlyOnly.activeTo, '2026-07-31T16:00:00.000Z');
  const prior = solarWitnesses.find(row => row.activeTo === monthlyOnly.activeFrom);
  assert.deepEqual([prior.normalizedPayload.transitMonthlyAspect, prior.normalizedPayload.transitAnnualAspect], ['sextile', 'square']);
  const monthOnly = { ...run, facts: [monthlyOnly] };
  const monthMatch = result(monthOnly, 30);
  assert.equal(monthMatch.status, 'matched');
  assert.equal(monthMatch.matchedSourceExcerpt, 'if they are in opposition or in quartile');
  assert.deepEqual(monthMatch.windows, [{ start: monthlyOnly.activeFrom, endExclusive: monthlyOnly.activeTo }]);
  assert.equal(result({ ...run, facts: [prior] }, 30).status, 'not_matched');
  const verify = changes => result({ ...run, facts: [{ ...monthlyOnly, normalizedPayload: { ...monthPayload, ...changes } }] }, 30);
  assert.equal(verify({ transitAnnualAspect: 'square' }).status, 'partial');
  assert.equal(verify({ transitAnnualAspect: undefined }).status, 'partial');
  assert.equal(verify({ level: 'year' }).status, 'not_matched');
  assert.equal(verify({ oppositeNatalSect: undefined }).status, 'unknown');
  const report = interpretFortune(monthOnly, requestForFortuneRun(monthOnly), 'ptolemy-iv10-monthly-only');
  const { input: monthOnlyInput } = buildFortuneModelContext(monthOnly, report);
  const local = formatFortuneFactAudit(monthOnlyInput);
  const monthlyOnlyEvidence = '当段实际刑冲只及同一月位，年位与本命原位另核各自关系';
  assert.ok(local.includes(monthlyOnlyEvidence));
  assert.match(local, /过境星座与月级时限星座构成整星座四分相/u);
  assert.match(local, /过境星座与年级时限星座构成整星座六合相/u);
  const provider = formatFortunePrompt(monthOnlyInput);
  assert.ok(monthMatch.matchedConditions.every(condition => provider.includes(condition)));
  assert.ok(!provider.includes(monthlyOnlyEvidence));
  assert.doesNotMatch(provider, /过境星座与月级时限星座|过境星座与年级时限星座|transitAnnualAspect|transitMonthlyAspect|2026-07-22T19:13:18/u);
});

test('Ptolemy paths switch rays and Egyptian bounds at verified equatorial arcs for all five origins', () => {
  const birth = chart();
  const natal = birth.western.rawResult[0];
  const frame = { ...natal, armc: 0, latitude: 35, obliquity: e_tilt(MakeTime(new Date(birthAt))).tobl };
  const sun = natal.positions.find(p => p.planet === 'Sun').longitude;
  const moon = natal.positions.find(p => p.planet === 'Moon').longitude;
  const originsForFrame = ({ ascendant, midheaven }) => [
    { origin: 'ASC', longitude: ascendant }, { origin: 'MC', longitude: midheaven },
    { origin: 'Sun', longitude: sun }, { origin: 'Moon', longitude: moon },
    { origin: 'Fortune', longitude: ptolemyLot(ascendant, sun, moon) },
  ];
  const origins = originsForFrame(frame);
  const directions = ptolemyPrimaryDirections(frame, natal.positions, origins);
  const rad = Math.PI / 180;
  for (const origin of ['ASC', 'MC']) {
    const rows = directions.filter(row => row.origin === origin);
    assert.ok(rows.length > 60);
    assert.equal(rows[0].startArc, 0);
    assert.equal(rows.at(-1).endArc, 360);
    for (const [index, row] of rows.entries()) {
      if (index) assert.equal(row.startArc, rows[index - 1].endArc);
      const angle = anglesFromFrame((row.startArc + row.endArc) / 2, frame.latitude, frame.obliquity);
      const midpoint = origin === 'ASC' ? angle.ascendant : angle.midheaven;
      const lord = ptolemyNatalGovernors(midpoint);
      assert.equal(row.sign, lord.sign);
      assert.deepEqual(row.term, lord.term);
      for (const ray of row.witnesses) {
        const eq = eclipticEquator(ray.longitude, frame.obliquity);
        const hourAngle = (ray.arc - eq.rightAscension) * rad;
        if (origin === 'MC') assert.ok(Math.abs(Math.sin(hourAngle / 2)) < 1e-8);
        else {
          const latitude = frame.latitude * rad, declination = eq.declination * rad;
          const altitude = Math.sin(latitude) * Math.sin(declination)
            + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
          assert.ok(Math.abs(altitude) < 1e-8 && Math.sin(hourAngle) < 0);
        }
      }
    }
  }
  const temporalHour = (longitude, armc, meridian) => {
    const equator = eclipticEquator(longitude, frame.obliquity);
    const diurnal = Math.acos(-Math.tan(frame.latitude * rad) * Math.tan(equator.declination * rad)) / rad;
    const hourAngle = normalize(armc - equator.rightAscension + (meridian === 'upper' ? 180 : 0)) - 180;
    return 6 * hourAngle / (meridian === 'upper' ? diurnal : 180 - diurnal);
  };
  for (const { origin, longitude } of origins.slice(2)) {
    const rows = directions.filter(row => row.origin === origin);
    assert.ok(rows.length > 60);
    assert.equal(rows[0].startArc, 0);
    assert.equal(rows.at(-1).endArc, 360);
    const upperHour = temporalHour(longitude, frame.armc, 'upper');
    const meridian = Math.abs(upperHour) <= 6 ? 'upper' : 'lower';
    const initialHour = temporalHour(longitude, frame.armc, meridian);
    for (const [index, row] of rows.entries()) {
      assert.equal(row.temporalMeridian, meridian);
      assert.ok(Math.abs(row.temporalHours - initialHour) < 1e-8);
      const previous = rows[index - 1];
      if (previous) {
        assert.equal(row.startArc, previous.endArc);
        if (row.sign !== previous.sign || row.term.start !== previous.term.start) {
          const bound = row.sign * 30 + row.term.start;
          assert.ok(Math.abs(temporalHour(bound, frame.armc + row.startArc, meridian) - initialHour) < 1e-8);
        }
      }
      for (const ray of row.witnesses) {
        assert.ok(Math.abs(temporalHour(ray.longitude, frame.armc + ray.arc, meridian) - initialHour) < 1e-8);
      }
    }
  }
  const venus = natal.positions.find(row => row.planet === 'Venus').longitude;
  const tied = natal.positions.map(row => row.planet === 'Mars' ? { ...row, longitude: venus } : row);
  const simultaneous = ptolemyPrimaryDirections(frame, tied, origins).find(row => row.witnesses.some(ray => ray.body === 'Venus')
    && row.witnesses.some(ray => ray.body === 'Mars'));
  assert.equal(simultaneous.ruler, undefined);
  const polar = { ...frame, latitude: 70, ...anglesFromFrame(0, 70, frame.obliquity) };
  assert.deepEqual([...new Set(ptolemyPrimaryDirections(polar, natal.positions, originsForFrame(polar)).map(row => row.origin))], ['MC']);
  assert.deepEqual(ptolemyPrimaryDirections(frame, natal.positions.filter(row => row.planet !== 'Mercury'), origins), []);
});

test('actual primary chronocrator ingresses qualify independently of the sign ruler through client submission and SQLite', () => {
  const now = Date.parse('2026-11-18T03:00:00Z');
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const reference = { snapshotId: 'source-times-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart: chart() })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'ptolemy-angular-test', reference);
  validateFortuneFacts(run);
  const witnessed = run.facts.filter(fact => fact.factType === 'ptolemy_ingress_contact'
    && fact.normalizedPayload.aspectType === 'conjunction' && fact.normalizedPayload.sameAsPrimaryDirectionRuler
    && !fact.normalizedPayload.sameAsAnnualLord);
  const candidateFacts = [];
  for (const [origin, body, terms, first, last, meridian] of [
    ['ASC', 'Mars', 'Saturn', '2026-08-11', '2026-09-28'],
    ['MC', 'Venus', 'Mercury', '2026-03-06', '2026-03-30'],
    ['Sun', 'Mars', 'Venus', '2026-01-01', '2026-01-23', 'lower'],
    ['Moon', 'Mercury', 'Jupiter', '2026-01-20', '2026-02-06', 'upper'],
  ]) {
    const fact = witnessed.find(row => row.normalizedPayload.level === 'year'
      && row.normalizedPayload.origin === origin && row.normalizedPayload.transitBody === body);
    assert.ok(fact, origin);
    const p = fact.normalizedPayload;
    assert.equal(p.primaryDirectionProfile, ptolemyPrimaryDirectionProfile);
    assert.equal(p.primaryDirection.term.ruler, terms);
    assert.equal(p.primaryDirection.ruler, body);
    assert.equal(p.primaryDirection.temporalMeridian, meridian);
    assert.ok(fact.activeFrom.startsWith(first) && fact.activeTo.startsWith(last));
    const candidate = result({ ...run, facts: [fact] }, 31);
    assert.equal(candidate.status, 'partial');
    assert.deepEqual(candidate.sourceFactIds, [fact.factId]);
    candidateFacts.push(fact);
    const wrongOrigin = structuredClone(fact);
    wrongOrigin.normalizedPayload.origin = 'Unknown';
    assert.equal(result({ ...run, facts: [wrongOrigin] }, 31).status, 'not_matched');
    const termOnly = structuredClone(fact);
    termOnly.normalizedPayload.sameAsPrimaryDirectionRuler = false;
    termOnly.normalizedPayload.sameAsPrimaryTermRuler = true;
    assert.equal(termOnly.normalizedPayload.termCoRulerIngress, false);
    assert.equal(result({ ...run, facts: [termOnly] }, 31).status, 'not_matched');
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-angular-report'));
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['从本命上升按当地斜升量', '从本命中天按赤经差', '从本命太阳按不等时小时',
    '从本命月亮按不等时小时', '从本命福点按不等时小时', '移动后的位置在', '与本段主限星候选相同']) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  assert.doesNotMatch(prompt, /primaryDirectionProfile|sameAsPrimaryDirectionRuler/u);
  const candidateRun = { ...run, facts: candidateFacts };
  const { input: candidateInput } = buildFortuneModelContext(candidateRun,
    interpretFortune(candidateRun, requestForFortuneRun(candidateRun), 'ptolemy-angular-candidates'));
  assert.ok(!candidateInput.sections.flatMap(section => section.findings)
    .some(finding => finding.knowledgeId === fortuneKnowledge.western.rules[31].knowledgeId));

  const primaryFacts = [];
  for (const [origin, body, actualIngress] of [
    ['ASC', 'Mars', '2026-09-28'], ['MC', 'Venus', '2026-03-30'], ['Sun', 'Mars', '2026-01-23'],
    ['Moon', 'Mercury', '2026-04-15'], ['Fortune', 'Sun', undefined],
  ]) {
    const fact = witnessed.find(row => row.normalizedPayload.level === 'primary'
      && row.normalizedPayload.origin === origin && row.normalizedPayload.transitBody === body);
    assert.ok(fact, origin);
    const p = fact.normalizedPayload;
    assert.equal(p.primaryDirection.origin, origin);
    assert.equal(p.primaryDirection.ruler, body);
    assert.equal(p.termCoRulerIngress, false);
    assert.deepEqual([p.sign, p.transitSign], [p.primaryDirection.sign, p.primaryDirection.sign]);
    assert.ok(p.primaryDirection.start <= Date.parse(fact.activeFrom) && Date.parse(fact.activeTo) <= p.primaryDirection.end);
    const signAt = instant => sign(body === 'Sun' ? SunPosition(new Date(instant)).elon
      : Ecliptic(GeoVector(Body[body], new Date(instant), true)).elon);
    if (actualIngress) {
      assert.ok(fact.exactInstant.startsWith(actualIngress));
      const at = Date.parse(fact.exactInstant);
      assert.notEqual(signAt(at - 2_000), p.sign);
      assert.equal(signAt(at + 2_000), p.sign);
    } else {
      assert.equal(fact.exactInstant, undefined);
      assert.equal(signAt(Date.parse(fact.activeFrom) - 2_000), p.sign);
    }
    const only = changes => result({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, ...changes } }] }, 31);
    const matched = only({});
    assert.equal(matched.status, 'matched', origin);
    assert.equal(matched.matchedSourceExcerpt, 'lords of both');
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(only({ level: 'year' }).status, 'partial');
    assert.equal(only({ sameAsPrimaryDirectionRuler: false }).status, 'not_matched');
    assert.equal(only({ origin: 'Unknown' }).status, 'not_matched');
    primaryFacts.push(fact);
  }
  const primaryRun = { ...run, facts: primaryFacts };
  const { input: primaryInput } = buildFortuneModelContext(primaryRun,
    interpretFortune(primaryRun, requestForFortuneRun(primaryRun), 'ptolemy-angular-confirmed'));
  const provider = formatFortunePrompt(primaryInput);
  assert.match(provider, /有一颗主限星实际行经该段总体时限星座/u);
  assert.doesNotMatch(provider, /sameAsPrimaryDirectionRuler|2026-09-28T02:49|本命上升按当地斜升量/u);
});

test('Ptolemy confirms actual Saturn passage through its own general midheaven time place', () => {
  const run = calculate(chart(birthAt, 340));
  const scoped = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'primary' && p.origin === 'MC' && p.transitBody === 'Saturn');
  const saturn = scoped.find(row => row.exactInstant?.startsWith('2026-02-14'));
  assert.ok(saturn);
  const p = saturn.normalizedPayload;
  assert.deepEqual([p.enteredDuringTimedPlace, p.primaryDirection.ruler, p.sign, p.transitSign, p.aspectType],
    [true, 'Saturn', 0, 0, 'conjunction']);
  assert.deepEqual(p.primaryDirection.witnesses.map(ray => [ray.body, ray.aspect]), [['Saturn', 'square']]);
  const ingressAt = Date.parse(saturn.exactInstant);
  assert.ok(Math.abs(ingressAt - Date.parse('2026-02-14T00:39:32.386Z')) < 1_000);
  const saturnSign = at => sign(Ecliptic(GeoVector(Body.Saturn, new Date(at), true)).elon);
  assert.deepEqual([saturnSign(ingressAt - 60_000), saturnSign(ingressAt + 60_000)], [11, 0]);
  assert.equal(saturn.activeFrom, saturn.exactInstant);
  assert.ok(scoped.every(row => row.activeFrom >= saturn.activeFrom));
  const only = payload => result({ ...run, facts: [{ ...saturn, normalizedPayload: { ...p, ...payload } }] }, 31);
  const match = only({});
  assert.equal(match.status, 'matched');
  assert.equal(match.matchedSourceExcerpt, 'lords of both');
  assert.deepEqual(match.windows, [{ start: saturn.activeFrom, endExclusive: saturn.activeTo }]);
  assert.equal(only({ origin: 'Unknown' }).status, 'not_matched');
  assert.equal(only({ sameAsPrimaryDirectionRuler: false }).status, 'not_matched');
  const following = calculate(chart(birthAt, 340), 'year', { year: 2027 });
  const open = '2026-12-31T16:00:00.000Z';
  const carried = following.facts.find(({ factType, activeFrom, normalizedPayload: q }) =>
    factType === 'ptolemy_ingress_contact' && activeFrom === open && q.level === 'primary' && q.origin === 'MC'
    && q.transitBody === 'Saturn' && q.sameAsPrimaryDirectionRuler);
  assert.ok(carried);
  assert.deepEqual([saturnSign(Date.parse(open) - 2_000), carried.normalizedPayload.sign], [0, 0]);
  assert.equal(carried.normalizedPayload.enteredDuringTimedPlace, false);
  assert.equal(carried.exactInstant, undefined);
  const ongoing = result({ ...following, facts: [carried] }, 31);
  assert.equal(ongoing.status, 'matched');
  assert.deepEqual(ongoing.windows, [{ start: open, endExclusive: carried.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-saturn-mc'));
  const provider = formatFortunePrompt(input);
  for (const source of match.matchedConditions) assert.ok(provider.includes(source));
  assert.doesNotMatch(provider, /sameAsPrimaryDirectionRuler|enteredDuringTimedPlace|2026-02-14T/u);
});

test('an annual ingress by the actual Egyptian co-ruler has an independent source query', () => {
  const run = realRun();
  const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'year' && p.origin === 'Sun' && p.transitBody === 'Venus' && p.termCoRulerIngress);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.primaryDirection.term.ruler, 'Venus');
  assert.equal(p.primaryDirection.ruler, 'Mars');
  assert.equal(p.annualRuler, 'Saturn');
  assert.equal(p.transitSign, p.annualSign);
  assert.equal(p.sameAsAnnualLord, false);
  assert.equal(p.sameAsPrimaryDirectionRuler, false);
  assert.equal(fact.activeFrom, '2026-01-01T04:00:00.000Z');
  assert.equal(fact.exactInstant, undefined);
  const reduced = facts => result({ ...run, facts }, 31);
  assert.deepEqual(reduced([fact]).sourceFactIds, [fact.factId]);
  for (const override of [{ termCoRulerIngress: false }, { sameAsPrimaryTermRuler: false }, { aspectType: 'trine' }]) {
    const different = { ...fact, normalizedPayload: { ...p, ...override } };
    assert.equal(reduced([different]).status, 'not_matched');
  }
  assert.match(housePrompt(run), /该行星同时是本段埃及界主，并实际行经年度星座/u);
});

test('an Egyptian bound change clips a continuing ingress without creating another physical ingress', () => {
  const window = { start: Date.UTC(2026, 3, 15), end: Date.UTC(2026, 3, 20) };
  const run = buildPtolemyTimes(window, 'year', chart(birthAt, 3), []);
  assert.equal(run.status, 'ready');
  const contacts = run.contacts.filter(fact => fact.origin === 'ASC' && fact.transitBody === 'Jupiter'
    && fact.aspectType === 'conjunction');
  const [before, after] = contacts;
  assert.equal(contacts.length, 2);
  assert.deepEqual([before.start, before.end, after.start, after.end],
    [window.start, Date.parse('2026-04-17T07:35:04.084Z'), Date.parse('2026-04-17T07:35:04.084Z'), window.end]);
  assert.deepEqual(contacts.map(row => row.primaryDirection.term.ruler), ['Saturn', 'Mercury']);
  assert.ok(contacts.every(row => row.primaryDirection.ruler === 'Mars' && row.physicalIngressAt === undefined));
});

test('the author and Egyptian term tables keep separate boundaries and actual co-ruler ingresses', () => {
  const bound = (longitude, table) => ptolemyTermAt(longitude, table).term;
  assert.deepEqual(bound(312 - 1e-9, 'author'), { ruler: 'Mercury', start: 6, end: 12 });
  assert.deepEqual(bound(312, 'author'), { ruler: 'Venus', start: 12, end: 20 });
  assert.deepEqual(bound(312, 'egyptian'), { ruler: 'Venus', start: 7, end: 13 });
  assert.deepEqual(bound(312 + 1, 'egyptian'), { ruler: 'Jupiter', start: 13, end: 20 });
  const parameters = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-11-18T03:00:00Z');
  const reference = { snapshotId: 'ptolemy-author-term-example', chart: chart() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  const witnesses = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'authorTerm' && p.origin === 'Sun' && p.transitBody === 'Mercury');
  for (const [level, targetSign, exactAt] of [
    ['year', 9, '2026-01-01T21:11:09.286Z'], ['primary', 10, '2026-01-20T16:41:25.765Z'],
  ]) {
    const fact = witnesses.find(row => row.exactInstant === exactAt);
    assert.ok(fact, level);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.authorTermLevel, p.sign, p.primarySign, p.egyptianTermRuler, p.authorNatalTermRuler],
      [level, targetSign, 10, 'Venus', 'Mercury']);
    assert.equal(p.termTableAgreement, 'different-ruler');
    assert.equal(p.sameAsNatalAuthorTermRuler, true);
    assert.deepEqual(p.term, { ruler: 'Mercury', start: 6, end: 12 });
    const mid = new Date((Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2);
    assert.equal(sign(Ecliptic(GeoVector(Body.Mercury, mid, true)).elon), targetSign);
    const reduced = facts => result({ ...run, facts }, 31);
    assert.deepEqual(reduced([fact]).sourceFactIds, [fact.factId]);
    assert.equal(reduced([fact]).status, 'partial');
    for (const override of [{ authorTermProfile: 'egyptian' }, { origin: 'Unknown' }]) {
      const changed = { ...fact, normalizedPayload: { ...p, ...override } };
      assert.equal(reduced([changed]).status, 'not_matched');
    }
    assert.equal(result({ ...run, facts: [fact] }, 27).status, 'not_matched');
  }
  const agreement = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'authorTerm' && p.authorTermLevel === 'primary' && p.origin === 'MC' && p.termTableAgreement === 'same-ruler');
  assert.ok(agreement);
  const { normalizedPayload: p } = agreement;
  assert.deepEqual([p.transitBody, p.egyptianTermRuler, p.term.ruler, p.sameAsNatalAuthorTermRuler],
    ['Mercury', 'Mercury', 'Mercury', false]);
  assert.equal(agreement.activeFrom, '2026-05-03T02:57:13.446Z');
  assert.equal(agreement.activeTo, '2026-05-17T10:26:20.712Z');
  assert.equal(agreement.exactInstant, agreement.activeFrom);
  const longitude = at => Ecliptic(GeoVector(Body.Mercury, new Date(at), true)).elon;
  const ingress = Date.parse(agreement.exactInstant);
  assert.notEqual(sign(longitude(ingress - 60_000)), p.transitSign);
  assert.equal(sign(longitude(ingress + 60_000)), p.transitSign);
  const egyptian = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'primary' && p.origin === 'MC' && p.termCoRulerIngress && activeFrom === agreement.activeFrom);
  assert.ok(egyptian);
  const singleTable = result({ ...run, facts: [agreement] }, 31);
  assert.equal(singleTable.status, 'matched');
  assert.deepEqual(singleTable.windows, [{ start: agreement.activeFrom, endExclusive: agreement.activeTo }]);
  assert.deepEqual(singleTable.sourceFactIds, [agreement.factId]);
  assert.deepEqual(result({ ...run, facts: [agreement, egyptian] }, 31).windows,
    result({ ...run, facts: [egyptian] }, 31).windows);
  const old = { ...agreement, normalizedPayload: { ...p, termTableComparisonProfile: undefined } };
  assert.equal(result({ ...run, facts: [old] }, 31).status, 'unknown');
  const atAnnual = run.facts.find(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
    && q.level === 'authorTerm' && q.authorTermLevel === 'year' && q.origin === 'MC'
    && q.transitBody === 'Mercury' && q.termTableAgreement === 'same-ruler');
  assert.ok(atAnnual);
  assert.deepEqual([atAnnual.normalizedPayload.sign, atAnnual.normalizedPayload.primarySign], [0, 1]);
  assert.equal(sign(longitude(Date.parse(atAnnual.activeFrom) + 60_000)), 0);
  assert.equal(atAnnual.activeTo, agreement.activeFrom);
  const annualTerm = result({ ...run, facts: [atAnnual] }, 31);
  assert.equal(annualTerm.status, 'matched');
  assert.deepEqual(annualTerm.windows, [{ start: atAnnual.activeFrom, endExclusive: atAnnual.activeTo }]);
  assert.match(annualTerm.matchedConditions.join(' '), /年度位置/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-author-terms'));
  assert.match(formatFortuneFactAudit(input), /按卷一托勒密表/u);
  assert.match(formatFortuneFactAudit(input), /两表在此段得到同一界主|本命原位之界/u);
  assert.doesNotMatch(formatFortunePrompt(input), /按卷一托勒密表|authorTermProfile|termTableAgreement/u);
});

test('actual Saturn transits of the general direction use their own sign and keep the natal Lot ruler distinct', () => {
  const now = Date.parse('2026-11-18T03:00:00Z');
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'Asia/Shanghai' };
  const reference = { snapshotId: 'source-times-snapshot' };
  const runFor = armc => {
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart: chart(birthAt, armc) })));
    return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'ptolemy-general-saturn', reference);
  };
  const run = runFor(210);
  const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'primary' && p.origin === 'Fortune' && p.sameAsPrimaryDirectionRuler);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.transitBody, 'Saturn');
  assert.equal(p.sign, 0);
  assert.equal(p.transitSign, p.primaryDirection.sign);
  assert.equal(p.annualSign, 11);
  assert.equal(p.primaryDirection.term.ruler, 'Mercury');
  assert.equal(p.sameAsAnnualLord, false);
  assert.equal(p.sameAsNatalMaterialSignRuler, false);
  assert.equal(fact.activeFrom, fact.exactInstant);
  assert.ok(fact.exactInstant.startsWith('2026-02-14'));
  assert.ok(Math.abs(normalize(Ecliptic(GeoVector(Body.Saturn, new Date(fact.exactInstant), true)).elon + 180) - 180) < 0.0002);
  const generalOnly = result({ ...run, facts: [fact] }, 31);
  assert.equal(generalOnly.status, 'matched');
  assert.deepEqual(generalOnly.sourceFactIds, [fact.factId]);
  assert.equal(result({ ...run, facts: [fact] }, 27).status, 'not_matched');
  for (const invalid of [
    { sameAsPrimaryDirectionRuler: false, sameAsAnnualLord: true, sameAsPrimaryTermRuler: false },
    { primaryDirectionProfile: 'ordinary-house-ruler' }, { aspectType: 'opposition' },
  ]) {
    const changed = { ...fact, normalizedPayload: { ...p, ...invalid } };
    assert.equal(result({ ...run, facts: [changed] }, 31).status, 'not_matched');
  }

  const coRulerRun = runFor(220);
  const termOnly = coRulerRun.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'primary' && p.origin === 'Fortune' && p.termCoRulerIngress);
  assert.equal(termOnly.length, 2);
  assert.equal(termOnly[0].activeFrom, termOnly[0].exactInstant);
  assert.ok(termOnly[0].exactInstant.startsWith('2026-02-14'));
  assert.equal(termOnly[0].activeTo, termOnly[1].activeFrom);
  assert.equal(termOnly[1].exactInstant, undefined);
  for (const row of termOnly) {
    const p = row.normalizedPayload;
    assert.equal(p.transitBody, 'Saturn');
    assert.equal(p.primaryDirection.term.ruler, 'Saturn');
    assert.equal(p.transitSign, p.primaryDirection.sign);
    assert.equal(p.sameAsPrimaryDirectionRuler, false);
    assert.equal(p.sameAsAnnualLord, false);
    assert.ok(evidenceIds(result(coRulerRun, 31)).includes(row.factId));
  }

  const natalLot = runFor(185);
  const joined = natalLot.facts.filter(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
    && q.level === 'primary' && q.origin === 'Fortune' && q.sameAsPrimaryDirectionRuler && q.sameAsNatalMaterialSignRuler);
  assert.equal(joined.length, 2);
  assert.equal(joined[0].activeTo, joined[1].activeFrom);
  assert.ok(joined.every(row => row.exactInstant === undefined && row.normalizedPayload.natalRulership.includes('domicile')));
  for (const row of joined) {
    assert.deepEqual(row.normalizedPayload.natalFortuneLordLuminaryContacts, [{ body: 'Sun', aspect: 'conjunction', sign: 9 }]);
    const { lunarApplication, ...jupiterWitness } = row.normalizedPayload.natalFortuneSaturnJupiterWitness;
    assert.deepEqual(jupiterWitness, { saturnSign: 9, jupiterSign: 3, aspect: 'opposition', jupiterBicorporeal: false });
    assert.equal(lunarApplication.aspect, 'trine');
    assert.ok(lunarApplication.gap > 6.4 && lunarApplication.gap < 6.41);
    const lunarExact = new Date(lunarApplication.exactAt);
    const longitudeAtExact = body => Ecliptic(GeoVector(Body[body], lunarExact, true)).elon;
    assert.ok(Math.abs(Math.abs(normalize(longitudeAtExact('Moon') - longitudeAtExact('Jupiter') + 180) - 180) - 120) < 0.001);
    assert.deepEqual(row.normalizedPayload.natalFortuneRulerConditions, {
      rulerSign: 9, rulerSect: 'day', ownPositionRulership: ['domicile'], witnessesComplete: true,
      ownPositionFamiliarities: { profile: 'robbins-I.23-same-table-familiarities-v1',
        egyptian: { roles: ['domicile'], multiple: false }, author: { roles: ['domicile'], multiple: false } },
      witnesses: [
        { body: 'Sun', sign: 9, aspect: 'conjunction', relation: 'same' },
        { body: 'Mercury', sign: 9, aspect: 'conjunction', relation: 'opposite' },
        { body: 'Jupiter', sign: 3, aspect: 'opposition', relation: 'same' },
      ],
    });
  }
  assert.equal(fact.normalizedPayload.natalFortuneLordLuminaryContacts, undefined);
  assert.equal(fact.normalizedPayload.natalFortuneSaturnJupiterWitness, undefined);
  assert.equal(fact.normalizedPayload.natalFortuneRulerConditions, undefined);
  assert.equal(sign(Ecliptic(GeoVector(Body.Saturn, new Date(birthAt), true)).elon), 9);
  assert.equal(sign(Ecliptic(GeoVector(Body.Jupiter, new Date(birthAt), true)).elon), 3);
  const match = result(natalLot, 31);
  assert.ok(joined.every(row => evidenceIds(match).includes(row.factId)));
  const otherPlanets = [
    [natalLot, 'MC', 'Sun', 7, true, false, '2026-10-23'],
    [run, 'Moon', 'Mercury', 0, false, true, '2026-04-15'],
  ];
  for (const [candidate, origin, body, signIndex, direction, term, exactDay] of otherPlanets) {
    const witness = candidate.facts.find(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
      && q.level === 'primary' && q.origin === origin && q.transitBody === body && q.sameAsPrimaryDirectionRuler === direction
      && q.sameAsPrimaryTermRuler === term && q.sameAsAnnualLord === false);
    assert.ok(witness, body);
    const q = witness.normalizedPayload;
    assert.deepEqual([q.sign, q.transitSign, q.aspectType], [signIndex, signIndex, 'conjunction']);
    assert.equal(direction ? q.primaryDirection.ruler : q.primaryDirection.term.ruler, body);
    assert.ok(witness.exactInstant.startsWith(exactDay));
    assert.ok(evidenceIds(result(candidate, 31)).includes(witness.factId));
  }
  const { input } = buildFortuneModelContext(natalLot, interpretFortune(natalLot, requestForFortuneRun(natalLot), 'ptolemy-general-saturn'));
  const prompt = formatFortuneFactAudit(input);
  for (const phrase of ['本命福点起算的总体主限位置', '实际行运土星位于双鱼座', '也是本命福点所在星座的守护星',
    '本命太阳在摩羯座，与本命福点守护星成整星座合相']) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  const natalWitness = '同一福点由土星守护；本命摩羯座土星与巨蟹座木星成整星座对分相';
  assert.ok(prompt.includes(natalWitness));
  assert.ok(prompt.includes('本命水星与福点守护星成整星座合相，与守护星异派'));
  assert.ok(!prompt.includes('本命木星实在双体星座'));
  assert.doesNotMatch(prompt, /同一口径下有至少两项亲近条件/u);
  assert.ok(!formatFortunePrompt(input).includes(natalWitness));
  assert.doesNotMatch(prompt, /sameAsNatalMaterialSignRuler|natalFortuneLordLuminaryContacts|主限星座的守护星为土星/u);
  const generalRun = { ...natalLot, facts: joined };
  const { input: generalInput } = buildFortuneModelContext(generalRun,
    interpretFortune(generalRun, requestForFortuneRun(generalRun), 'ptolemy-general-saturn-confirmed'));
  assert.equal(result(generalRun, 31).status, 'matched');
  assert.ok(generalInput.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === match.knowledgeId));
  assert.doesNotMatch(formatFortunePrompt(generalInput), /同一福点由土星守护|natalFortuneSaturnJupiterWitness/u);
});

test('same-ruler Fortune testimony distinguishes a real bicorporeal Jupiter from the ruler’s own-place authority', () => {
  const birth = Date.parse('1977-04-12T04:00:00Z');
  const archiveChart = chart(birth, 280);
  const run = calculate(archiveChart);
  validateFortuneFacts(run);
  const match = result(run, 31);
  const fact = run.facts.find(row => evidenceIds(match).includes(row.factId)
    && row.normalizedPayload.natalFortuneSaturnJupiterWitness?.jupiterBicorporeal === true);
  assert.ok(fact);
  assert.equal(result({ ...run, facts: [fact] }, 31).status, 'partial');
  const p = fact.normalizedPayload;
  assert.deepEqual(p.natalFortuneSaturnJupiterWitness, { saturnSign: 4, jupiterSign: 2, aspect: 'sextile', jupiterBicorporeal: true });
  assert.equal(p.transitBody, 'Saturn');
  assert.ok(p.natalRulership.includes('domicile'));
  assert.deepEqual(p.natalFortuneRulerConditions.ownPositionRulership, []);
  assert.ok(p.natalFortuneRulerConditions.witnesses.some(row => row.body === 'Jupiter' && row.relation === 'same'));
  assert.ok(p.natalFortuneRulerConditions.witnesses.some(row => row.body === 'Moon' && row.relation === 'opposite'));
  const expected = '本命木星实在双体星座';
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-fortune-jupiter'));
  assert.ok(formatFortuneFactAudit(input).includes(expected));
  assert.ok(!formatFortunePrompt(input).includes(expected));
});

test('Ptolemy Fortune rulers combine their natal familiarities inside each bound system', () => {
  for (const [birth, armc, ruler, rulerSign, egyptian, author, expectedAt, annualLord] of [
    ['1961-08-11T00:00:00Z', 120, 'Venus', 3, ['triplicity', 'term'], ['triplicity'], '2026-01-17T12:42:45.526Z', false],
    ['1974-03-22T12:00:00Z', 60, 'Sun', 0, ['exaltation', 'triplicity'], ['exaltation', 'triplicity'], '2026-11-22T07:23:34.378Z', false],
    ['1974-09-16T12:00:00Z', 330, 'Mercury', 6, ['triplicity'], ['triplicity', 'term'], '2026-08-25T11:04:19.935Z', true],
  ]) {
    const birthAt = Date.parse(birth);
    const run = calculate(chart(birthAt, armc));
    validateFortuneFacts(run);
    const match = result(run, 31);
    const fact = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'year' && p.origin === 'Fortune' && p.transitBody === ruler && p.aspectType === 'conjunction'
      && p.sameAsNatalMaterialSignRuler === true && (p.sameAsAnnualLord || p.sameAsPrimaryDirectionRuler || p.termCoRulerIngress)
      && Math.abs(Date.parse(activeFrom) - Date.parse(expectedAt)) < 1_000);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.equal(ptolemySignRuler(p.natalGovernors.sign), ruler, birth);
    const natalDate = new Date(birthAt);
    const longitude = ruler === 'Sun' ? SunPosition(natalDate).elon : Ecliptic(GeoVector(Body[ruler], natalDate, true)).elon;
    assert.equal(sign(longitude), rulerSign, birth);
    const actualAt = new Date((Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2);
    const transitLongitude = ruler === 'Sun' ? SunPosition(actualAt).elon : Ecliptic(GeoVector(Body[ruler], actualAt, true)).elon;
    assert.equal(sign(transitLongitude), p.sign, birth);
    assert.deepEqual(p.natalFortuneRulerConditions.ownPositionFamiliarities, { profile: 'robbins-I.23-same-table-familiarities-v1',
      egyptian: { roles: egyptian, multiple: egyptian.length > 1 }, author: { roles: author, multiple: author.length > 1 } }, birth);
    assert.equal(ptolemyTermAt(longitude, 'egyptian').term.ruler === ruler, egyptian.includes('term'), birth);
    assert.equal(ptolemyTermAt(longitude, 'author').term.ruler === ruler, author.includes('term'), birth);
    assert.equal(p.sameAsAnnualLord, annualLord, birth);
    assert.equal(result({ ...run, facts: [fact] }, 31).status, annualLord ? 'matched' : 'partial', birth);
    assert.ok(evidenceIds(match).includes(fact.factId), birth);
    assert.equal(result({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, aspectType: 'opposition' } }] }, 31).status, 'not_matched', birth);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-fortune-familiarities'));
    const labels = { term: '界', triplicity: '三分', exaltation: '擢升' };
    const audit = formatFortuneFactAudit(input);
    for (const [table, roles] of [['埃及界表', egyptian], ['托勒密界表', author]]) {
      const evidence = '福点守护星本命落座按' + table + '核实' + roles.map(role => labels[role]).join('、');
      assert.ok(audit.includes(evidence), birth);
      assert.equal(audit.includes(evidence + '，同一口径下有至少两项亲近条件'), roles.length >= 2, birth);
    }
    assert.doesNotMatch(formatFortunePrompt(input), /福点守护星本命落座按|ownPositionFamiliarities/u);
  }

  // Aries 2° is Jupiter's bound in both systems, but it remains just one role per table.
  const bothTerms = ptolemyNatalPlacementFamiliarities(ptolemyNatalGovernors(2, 'day'), 'Jupiter');
  assert.deepEqual(bothTerms.egyptian, { roles: ['term'], multiple: false });
  assert.deepEqual(bothTerms.author, bothTerms.egyptian);
  const unverifiedSect = ptolemyNatalPlacementFamiliarities(ptolemyNatalGovernors(2), 'Jupiter');
  assert.equal(unverifiedSect.egyptian.multiple, undefined);
  assert.equal(unverifiedSect.author.multiple, undefined);
});

test('Ptolemy separates lunar application, separation and opposite latitudes for Saturn-governed Fortune', () => {
  const details = '本命月亮优先入相木星';
  const params = { periodType: 'year', targetPeriod: { year: 2026 }, displayTimezone: 'UTC' };
  const now = Date.parse('2026-07-01T12:00:00Z');
  const scenarios = [
    { at: '1977-11-28T04:00:00Z', applying: true },
    { at: '1977-11-28T08:00:00Z', applying: false },
  ];
  const conjunction = Date.parse('1977-11-28T07:47:46.772Z');
  for (const { at, applying } of scenarios) {
    const birth = Date.parse(at);
    const reference = { snapshotId: `ptolemy-fortune-lunar-application-${birth}`, chart: chart(birth) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const match = result(run, 31);
    const witness = run.facts.find(fact => evidenceIds(match).includes(fact.factId)
      && fact.normalizedPayload.natalFortuneSaturnJupiterWitness);
    assert.ok(witness);
    assert.equal(result({ ...run, facts: [witness] }, 31).status, 'partial');
    const { saturnSign, jupiterSign, aspect, jupiterBicorporeal, lunarApplication }
      = witness.normalizedPayload.natalFortuneSaturnJupiterWitness;
    assert.deepEqual([saturnSign, jupiterSign, aspect, jupiterBicorporeal], [5, 3, 'sextile', false]);
    for (const time of [birth, conjunction]) {
      const moon = Ecliptic(GeoVector(Body.Moon, new Date(time), true));
      const jupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(time), true));
      assert.equal(Math.sign(moon.elat), Math.sign(jupiter.elat));
      if (time === conjunction) assert.ok(Math.abs(moon.elon - jupiter.elon) < 0.001);
    }
    if (applying) {
      assert.equal(lunarApplication.aspect, 'conjunction');
      assert.ok(lunarApplication.gap > 1.8 && lunarApplication.gap < 2);
      assert.ok(Math.abs(Date.parse(lunarApplication.exactAt) - conjunction) <= 1_000);
    } else {
      assert.ok(conjunction < birth);
      assert.equal(lunarApplication, undefined);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    assert.equal(formatFortuneFactAudit(input).includes(details), applying);
    assert.ok(!formatFortunePrompt(input).includes(details));
  }

  const oppositeBirth = Date.parse('1979-03-09T04:00:00Z');
  const oppositeConjunction = Date.parse('1979-03-09T09:39:54.870Z');
  const opposite = buildPtolemyTimes({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) },
    'year', chart(oppositeBirth, 105), []);
  const contact = opposite.contacts.find(row => row.origin === 'Fortune' && row.transitBody === 'Saturn'
    && row.natalFortuneSaturnJupiterWitness);
  assert.ok(contact);
  assert.equal(contact.natalFortuneSaturnJupiterWitness.lunarApplication, undefined);
  for (const time of [oppositeBirth, oppositeConjunction]) {
    const moon = Ecliptic(GeoVector(Body.Moon, new Date(time), true));
    const jupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(time), true));
    assert.notEqual(Math.sign(moon.elat), Math.sign(jupiter.elat));
    if (time === oppositeBirth) assert.ok(jupiter.elon - moon.elon > 2 && jupiter.elon - moon.elon < 3);
    else assert.ok(Math.abs(moon.elon - jupiter.elon) < 0.001);
  }
});

test('Ptolemy applies the extra Fortune testimony only with same-sect natal support', () => {
  const cases = [
    ['1990-03-19T04:00:00Z', 0, 'Moon', 'sextile', '月亮', '六合相'],
    ['1977-11-28T00:00:00Z', 75, 'Mercury', 'trine', '水星', '三分相'],
  ];
  const stableTheme = '本命另有同派行星与福点守护星成整星座六合或三分';
  for (const [birth, armc, witnessBody, witnessAspect, witnessLabel, aspectLabel] of cases) {
    const born = Date.parse(birth);
    const run = calculate(chart(born, armc));
    validateFortuneFacts(run);
    const annual = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'year' && p.origin === 'Fortune' && p.transitBody === 'Mars' && p.sameAsAnnualLord
      && p.sameAsNatalMaterialSignRuler);
    const ingress = annual.find(row => row.normalizedPayload.transitSign === 0 && row.exactInstant);
    assert.ok(ingress && ingress.activeFrom === ingress.exactInstant, birth);
    const ingressAt = Date.parse(ingress.exactInstant);
    assert.ok(Math.abs(ingressAt - Date.parse('2026-04-09T19:36:28.256Z')) < 1_000);
    const p = ingress.normalizedPayload;
    assert.deepEqual([p.natalGovernors.sign, p.annualSign, p.transitSign, p.aspectType], [0, 0, 0, 'conjunction']);
    assert.equal(p.hasNatalFortuneSameSectHarmoniousWitness, true);
    assert.equal(p.natalFortuneRulerConditions.rulerSect, 'night');
    const natalSign = body => sign(body === 'Sun' ? SunPosition(new Date(born)).elon
      : Ecliptic(GeoVector(Body[body], new Date(born), true)).elon);
    assert.equal(ptolemySignAspect(natalSign(witnessBody), natalSign('Mars')), witnessAspect);
    assert.deepEqual(p.natalFortuneRulerConditions.witnesses.find(r => r.body === witnessBody),
      { body: witnessBody, sign: natalSign(witnessBody), aspect: witnessAspect, relation: 'same' });
    if (witnessBody === 'Mercury') {
      const { mercuryHorizon, witnesses } = p.natalFortuneRulerConditions;
      assert.equal(mercuryHorizon.sect, 'night');
      assert.ok(mercuryHorizon.sunriseAltitude < 0 && mercuryHorizon.sunsetAltitude > 0);
      assert.deepEqual(witnesses.find(r => r.body === 'Sun'),
        { body: 'Sun', sign: natalSign('Sun'), aspect: 'trine', relation: 'opposite' });
      assert.deepEqual(witnesses.filter(r => r.relation === 'same' && ['sextile', 'trine'].includes(r.aspect))
        .map(r => r.body), ['Mercury']);
      const annualVenus = run.facts.find(({ factType, normalizedPayload: q }) => factType === 'ptolemy_ingress_contact'
        && q.level === 'year' && q.origin === 'ASC' && q.transitBody === 'Venus' && q.aspectType === 'conjunction'
        && q.sameAsAnnualLord && q.governsNatalOrigin === false);
      assert.ok(annualVenus);
      assert.equal(annualVenus.activeFrom, '2026-11-28T00:00:00.000Z');
      assert.equal(annualVenus.exactInstant, undefined);
      const only = fact => result({ ...run, facts: [fact] }, 31);
      const annualOnly = only(annualVenus);
      assert.deepEqual(annualOnly.windows, [{ start: annualVenus.activeFrom, endExclusive: annualVenus.activeTo }]);
      assert.equal(annualOnly.status, 'matched');
      for (const override of [{ sameAsAnnualLord: false, sameAsPrimaryDirectionRuler: false, termCoRulerIngress: false },
        { aspectType: 'opposition' }, { origin: 'Unknown' }]) {
        const counter = { ...annualVenus, normalizedPayload: { ...annualVenus.normalizedPayload, ...override } };
        assert.equal(only(counter).status, 'not_matched');
      }
    }
    const marsSignAt = at => sign(Ecliptic(GeoVector(Body.Mars, new Date(at), true)).elon);
    assert.deepEqual([marsSignAt(ingressAt - 2_000), marsSignAt(ingressAt + 2_000)], [11, 0]);
    assert.ok(!annual.some(row => row.activeFrom <= new Date(ingressAt - 1).toISOString() && row.activeTo >= ingress.activeFrom));
    const otherAspect = annual.find(row => row.normalizedPayload.aspectType !== 'conjunction');
    assert.ok(otherAspect);
    assert.equal(result({ ...run, facts: [otherAspect] }, 31).status, 'not_matched');
    const after = result({ ...run, facts: [ingress] }, 31);
    assert.equal(after.status, 'matched');
    assert.deepEqual(after.windows, [{ start: ingress.activeFrom, endExclusive: ingress.activeTo }]);
    const missing = { ...ingress, normalizedPayload: { ...p, hasNatalFortuneSameSectHarmoniousWitness: undefined } };
    const baseOnly = result({ ...run, facts: [missing] }, 31);
    assert.equal(baseOnly.status, 'matched');
    assert.doesNotMatch(baseOnly.matchedConditions.join(), /本命另有同派/u);
    assert.equal(evaluateFortuneRules('western', 'year', [missing]).find(row => row.knowledgeId === after.knowledgeId)
      .confirmations[0].unknown, true);
    assert.equal(after.matchedSourceExcerpt, 'lords of both');
    assert.ok(result(run, 31).candidateWindows?.length > 0);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-fortune-same-sect'));
    const actualAudit = '本命' + witnessLabel + '与福点守护星同派并成整星座' + aspectLabel + '，与实际年度同主过境同参';
    assert.ok(formatFortuneFactAudit(input).includes(actualAudit), birth);
    const provider = formatFortunePrompt(input);
    assert.ok(provider.includes(stableTheme));
    assert.doesNotMatch(provider, /本命[月亮水星]{2}与福点守护星同派并成整星座|hasNatalFortuneSameSectHarmoniousWitness|mercuryHorizon/u);
  }
});

test('Ptolemy uses natal Mercury as fortune ruler only with a determinate same-sect harmonious witness', () => {
  const cases = [
    ['1966-01-09T04:00:00Z', 135, 'day', 'Saturn', 'sextile', 'same', true],
    ['1966-01-01T04:00:00Z', 255, 'day', 'Moon', 'trine', 'opposite', false],
    ['1966-02-06T04:00:00Z', 165, undefined, 'Jupiter', 'trine', 'unknown', undefined],
  ];
  const window = { start: Date.UTC(2026, 4, 14), end: Date.UTC(2026, 4, 20) };
  const knowledgeId = fortuneKnowledge.western.rules[31].knowledgeId;
  for (const [birth, armc, sect, witnessBody, aspect, relation, qualifies] of cases) {
    const run = buildPtolemyTimes(window, 'year', chart(Date.parse(birth), armc), []);
    assert.equal(run.status, 'ready', birth);
    const contact = run.contacts.find(row => row.level === 'year' && row.origin === 'Fortune'
      && row.transitBody === 'Mercury' && row.sameAsAnnualLord && row.sameAsNatalMaterialSignRuler
      && row.aspectType === 'conjunction' && row.physicalIngressAt !== undefined);
    assert.ok(contact, birth);
    const utc = contact.physicalIngressAt;
    const mercurySignAt = at => sign(Ecliptic(GeoVector(Body.Mercury, new Date(at), true)).elon);
    assert.equal(contact.start, utc);
    assert.ok(Math.abs(utc - Date.parse('2026-05-17T10:26:21.151Z')) < 1_000);
    assert.deepEqual([mercurySignAt(utc - 2_000), mercurySignAt(utc + 2_000)], [1, 2]);
    const { rulerSect, mercuryHorizon, witnesses } = contact.natalFortuneRulerConditions;
    assert.equal(rulerSect, sect, birth);
    assert.equal(mercuryHorizon.sect, sect, birth);
    assert.ok(mercuryHorizon.sunsetAltitude < 0);
    assert.equal(mercuryHorizon.sunriseAltitude > 0, sect === 'day');
    const witness = witnesses.find(row => row.body === witnessBody);
    assert.deepEqual([witness.aspect, witness.relation], [aspect, relation], birth);
    assert.equal(contact.hasNatalFortuneSameSectHarmoniousWitness, qualifies, birth);
    const fact = { factType: 'ptolemy_ingress_contact', scope: 'transit', completeness: 'complete', normalizedPayload: contact };
    const selected = evaluateFortuneRules('western', 'year', [fact]).find(row => row.knowledgeId === knowledgeId);
    assert.deepEqual(selected.required[0].hits, [fact], birth);
    assert.deepEqual(selected.confirmations[0].hits, qualifies ? [fact] : [], birth);
    assert.equal(selected.confirmations[0].unknown, qualifies === undefined, birth);
  }
});

test('Ptolemy distinguishes the author natal bound at the actual monthly ingress from the Egyptian bound and the following transit', () => {
  const asOf = Date.parse('2026-01-16T12:00:00Z');
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 1 }, displayTimezone: 'UTC' };
  const natalAt = Date.parse('1968-01-01T12:00:00Z');
  const reference = { snapshotId: 'ptolemy-author-natal-terms', chart: chart(natalAt, 150) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  const direct = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'Sun' && p.transitBody === 'Mercury');
  const fact = direct.find(({ normalizedPayload: p }) => p.aspectType === 'sextile' && p.transitSign === 9);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.deepEqual(p.natalGovernors.authorTerm, { ruler: 'Mercury', start: 6, end: 12 });
  assert.deepEqual(p.natalGovernors.term, { ruler: 'Jupiter', start: 7, end: 14 });
  assert.equal(p.natalAuthorTermProfile, 'robbins-I.21-author-half-open-bounds');
  assert.deepEqual(p.natalRulership, []);
  assert.equal(p.governsNatalOrigin, false);
  assert.equal(p.sameAsNatalAuthorTermRuler, true);
  assert.equal(p.natalOriginAspect, 'conjunction');
  assert.equal(p.sign, 7);
  assert.equal(fact.activeFrom, fact.exactInstant);
  assert.ok(Math.abs(Date.parse(fact.activeFrom) - Date.parse('2026-01-01T21:11:09.066Z')) < 1_000);
  const next = direct.find(row => row.activeFrom === fact.activeTo);
  assert.ok(next && next.normalizedPayload.sameAsNatalAuthorTermRuler);
  assert.deepEqual([next.normalizedPayload.transitSign, next.normalizedPayload.aspectType], [10, 'square']);
  for (const row of [fact, next]) {
    const midpoint = new Date((Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2);
    assert.equal(row.normalizedPayload.transitSign, sign(Ecliptic(GeoVector(Body.Mercury, midpoint, true)).elon));
  }
  const match = result(run, 30);
  assert.ok(match.candidateFactIds.includes(fact.factId));
  assert.ok(!match.sourceFactIds.includes(fact.factId));
  assert.ok(!match.sourceFactIds.includes(next.factId));
  assert.equal(result({ ...run, facts: [fact] }, 30).status, 'partial');
  const ascendantWitness = run.facts.find(({ factType, normalizedPayload, activeFrom }) =>
    factType === 'ptolemy_ingress_contact' && normalizedPayload.origin === 'ASC' && normalizedPayload.level === 'month'
    && normalizedPayload.transitBody === 'Mercury' && activeFrom === fact.activeFrom
    && normalizedPayload.monthlyOriginAspect === 'sextile');
  assert.ok(ascendantWitness);
  const asc = ascendantWitness.normalizedPayload;
  assert.deepEqual([asc.natalOriginAspect, asc.aspectType, asc.transitNatalOriginAspect], ['sextile', 'trine', 'sextile']);
  assert.equal(asc.sameNatalMercuryHorizonSect, true);
  const combinedMatch = result({ ...run, facts: [ascendantWitness] }, 30);
  assert.equal(combinedMatch.status, 'matched');
  assert.deepEqual(combinedMatch.windows, [{ start: ascendantWitness.activeFrom, endExclusive: ascendantWitness.activeTo }]);
  for (const mutation of [{ level: 'year' }, { natalAuthorTermProfile: 'robbins-I.20' }, { sameAsNatalAuthorTermRuler: false }]) {
    const wrong = { ...fact, normalizedPayload: { ...p, ...mutation } };
    assert.equal(result({ ...run, facts: [wrong] }, 30).status, 'not_matched');
  }
  const { input } = buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
  const authorEvidence = /按托勒密本命界表，水星是同一起点的本命界主/u;
  assert.match(formatFortuneFactAudit(input), authorEvidence);
  assert.doesNotMatch(formatFortunePrompt(input), authorEvidence);
  for (const condition of combinedMatch.matchedConditions) assert.ok(formatFortunePrompt(input).includes(condition));
});

test('Ptolemy keeps real monthly hard ingresses with conflicting natal bounds as local evidence only', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 1 }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(2026, 0, 16, 12);
  const cases = [
    [birthAt, 345, 'Fortune', 'Venus', 'opposition', 'opposition', 10, 'Mercury', '2026-01-17T12:42:45.526Z'],
    [birthAt, 330, 'Fortune', 'Mercury', 'none', 'opposition', 10, 'Venus', '2026-01-20T16:41:25.546Z'],
    [Date.parse('1968-01-01T12:00:00Z'), 330, 'ASC', 'Venus', 'none', 'square', 9, 'Mars', '2026-01-01T12:00:00.000Z'],
    [Date.parse('1960-01-23T12:00:00Z'), 60, 'Moon', 'Mercury', 'square', 'square', 9, 'Saturn', '2026-01-01T21:11:09.066Z'],
  ];
  for (const [born, armc, origin, body, natalAspect, transitAspect, transitSign, egyptian, start] of cases) {
    const reference = { snapshotId: 'ptolemy-disputed-bound-' + born + '-' + armc, chart: chart(born, armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const fact = run.facts.find(({ factType, normalizedPayload: p, activeFrom }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'month' && p.origin === origin && p.transitBody === body && p.aspectType === transitAspect
      && Math.abs(Date.parse(activeFrom) - Date.parse(start)) < 1_000);
    assert.ok(fact, reference.snapshotId);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.natalOriginAspect, p.transitSign, p.natalGovernors.term.ruler, p.natalGovernors.authorTerm.ruler],
      [natalAspect, transitSign, egyptian, body]);
    assert.equal(p.governsNatalOrigin, false);
    assert.equal(p.sameAsNatalAuthorTermRuler, true);
    assert.equal(p.natalGovernorProfile, 'ptolemy-robbins-natal-governors-v1');
    assert.deepEqual(ptolemyTermAt(p.natalLongitude, 'author'),
      { sign: p.natalGovernors.sign, term: p.natalGovernors.authorTerm });
    assert.equal(body === 'Mercury' ? p.sameNatalMercuryHorizonSect : !p.oppositeNatalSect, false);
    if (natalAspect === 'none') assert.equal(p.natalOriginSignFamiliarity, 'alien');
    const midpoint = new Date((Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2);
    assert.equal(sign(Ecliptic(GeoVector(Body[body], midpoint, true)).elon), transitSign);
    assert.equal(ptolemySignAspect(p.sign, transitSign), transitAspect);
    const scoped = value => ({
      ...run, facts: [{ ...fact, normalizedPayload: { ...p, sameAsNatalAuthorTermRuler: value } }],
    });
    assert.equal(result(scoped(true), 30).status, 'not_matched', reference.snapshotId);
    assert.ok(!result(run, 30).sourceFactIds.includes(fact.factId), reference.snapshotId);
    assert.equal(result(scoped(undefined), 30).status, 'unknown', reference.snapshotId);
    // If the new independent prerequisite is removed, the former rule accepts this actual geometry.
    const againstBoth = ['square', 'opposition'].includes(ptolemySignAspect(transitSign, p.natalGovernors.sign));
    const wouldConfirm = againstBoth;
    assert.equal(result(scoped(false), 30).status, wouldConfirm ? 'matched' : 'partial', reference.snapshotId);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const dispute = '本命界表有分歧，本段实际刑冲只供核对';
    assert.ok(formatFortuneFactAudit(input).includes(dispute), reference.snapshotId);
    assert.doesNotMatch(formatFortunePrompt(input), /本命界表有分歧|sameAsNatalAuthorTermRuler/u);
  }
});

test('Ptolemy uses the natal Mercury horizon for harmonious and reversing actual monthly ingresses', () => {
  const cases = [
    { birth: birthAt, armc: 30, month: 1, phase: 'evening', sameSect: true, origin: 'MC',
      aspects: ['trine', 'trine', 'trine'], signs: [9, 1, 9, 1], at: '2026-01-01T21:11:09.066Z', expected: 'matched' },
    { birth: birthAt, armc: 30, month: 12, phase: 'evening', sameSect: true, origin: 'MC',
      aspects: ['trine', 'opposition', 'opposition'], signs: [9, 1, 7, 1], at: '2026-12-03T04:00:00.000Z', expected: 'matched' },
    { birth: Date.parse('1984-01-08T12:00:00Z'), armc: 290, month: 1, phase: 'morning', sameSect: true, origin: 'ASC',
      aspects: ['trine', 'sextile', 'trine'], signs: [9, 1, 9, 7], at: '2026-01-07T12:00:00.000Z', expected: 'partial' },
    { birth: birthAt, armc: 210, month: 1, phase: 'evening', sameSect: false, origin: 'MC',
      aspects: ['sextile', 'sextile', 'sextile'], signs: [9, 7, 9, 7], at: '2026-01-01T21:11:09.066Z', expected: 'not_matched' },
    { birth: Date.parse('1960-01-23T12:00:00Z'), armc: 0, month: 1, phase: 'undetermined', sameSect: undefined, origin: 'MC',
      aspects: ['sextile', 'trine', 'sextile'], signs: [10, 0, 10, 6], at: '2026-01-22T12:00:00.000Z', expected: 'unknown' },
  ];
  for (const { birth, armc, month, phase, sameSect, origin, aspects, signs, at, expected } of cases) {
    const params = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
    const asOf = Date.UTC(2026, month - 1, 16, 12);
    const reference = { snapshotId: 'ptolemy-mercury-horizon-' + month + '-' + armc, chart: chart(birth, armc) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const fact = run.facts.find(({ factType, normalizedPayload: p, activeFrom }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'month' && p.origin === origin && p.transitBody === 'Mercury' && Math.abs(Date.parse(activeFrom) - Date.parse(at)) < 1_000);
    assert.ok(fact, reference.snapshotId);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.natalOriginAspect, p.aspectType, p.transitNatalOriginAspect], aspects, reference.snapshotId);
    assert.deepEqual([p.natalTransitBodySign, p.natalGovernors.sign, p.transitSign, p.sign], signs, reference.snapshotId);
    const midpoint = new Date((Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2);
    assert.equal(sign(Ecliptic(GeoVector(Body.Mercury, midpoint, true)).elon), p.transitSign);
    assert.equal(p.governsNatalOrigin, false);
    assert.equal(p.sameAsNatalAuthorTermRuler, false);
    const horizon = p.natalMercuryHorizon;
    assert.equal(horizon.phase, phase);
    assert.equal(p.sameNatalMercuryHorizonSect, sameSect);
    assert.equal(horizon.sunriseAltitude > 0, phase === 'morning');
    assert.equal(horizon.sunsetAltitude > 0, phase === 'evening');
    const scoped = { ...run, facts: [fact] };
    const scopedMatch = result(scoped, 30);
    assert.equal(scopedMatch.status, expected);
    if (p.aspectType === 'opposition' && expected === 'matched') {
      assert.equal(scopedMatch.matchedSourceExcerpt, 'even as they cause evil if they oppose');
    }
    const aggregate = result(run, 30);
    const witnesses = expected === 'partial' && aggregate.status === 'matched' ? aggregate.candidateFactIds : aggregate.sourceFactIds;
    assert.equal(witnesses.includes(fact.factId), sameSect === true);
    if (sameSect !== true) continue;
    const missing = { ...fact, normalizedPayload: { ...p, sameNatalMercuryHorizonSect: undefined, natalMercuryHorizon: undefined } };
    assert.equal(result({ ...scoped, facts: [missing] }, 30).status, 'unknown');
    for (const wrong of [{ level: 'year' }, { transitNatalOriginAspect: 'none' }]) {
      const contrast = { ...fact, normalizedPayload: { ...p, ...wrong } };
      assert.equal(result({ ...scoped, facts: [contrast] }, 30).status, 'not_matched');
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const local = phase === 'evening' ? /同一本命的水星日落时在当地地平线上，按原书属夜派/u
      : /同一本命的水星日出时在当地地平线上，按原书属昼派/u;
    assert.match(formatFortuneFactAudit(input), local);
    assert.doesNotMatch(formatFortunePrompt(input), /同一本命的水星日[出落]时在当地地平线上|natalMercuryHorizon|sameNatalMercuryHorizonSect/u);
  }
});

test('Ptolemy Mercury near the horizon uses dated solar crossings instead of holding the birth sky fixed', () => {
  for (const [date, phase, sunriseAbove, sunsetAbove] of [
    ['1990-03-19', 'evening', false, true],
    ['1991-06-18', 'undetermined', true, true],
  ]) {
    const birth = new Date(date + 'T04:00:00.000Z');
    const armc = (SiderealTime(birth) * 15 + 117) % 360;
    const witness = ptolemyNatalMercuryHorizon({ birthAt: birth.getTime(), armc, latitude: 35 });
    assert.equal(witness.phase, phase);
    assert.equal(witness.sunriseAltitude > 0, sunriseAbove);
    assert.equal(witness.sunsetAltitude > 0, sunsetAbove);
    assert.ok(Date.parse(witness.sunriseAt) < birth.getTime() && birth.getTime() < Date.parse(witness.sunsetAt));
  }
});

test('Ptolemy adverse monthly Mercury ingresses require a known opposing natal horizon sect', () => {
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 1 }, displayTimezone: 'UTC' };
  const asOf = Date.UTC(2026, 0, 16, 12);
  const cases = [
    { birth: '1990-01-09T00:00:00Z', armc: 150, latitude: 0, origin: 'MC', phase: 'morning',
      aspects: ['none', 'opposition'], at: '2026-01-01T21:11:09.066Z', candidate: false, sameSect: false, status: 'partial' },
    { birth: '1990-01-09T00:00:00Z', armc: 150, latitude: 0, origin: 'MC', phase: 'morning',
      aspects: ['none', 'opposition'], at: '2026-01-20T16:41:25.546Z', candidate: false, sameSect: false, status: 'matched' },
    { birth: '1990-01-09T00:00:00Z', armc: 150, latitude: 0, month: 2, origin: 'MC', phase: 'morning',
      aspects: ['none', 'opposition'], at: '2026-02-06T22:47:58.636Z', candidate: false, sameSect: false, status: 'matched' },
    { birth: '1990-03-18T06:00:00Z', armc: 195, latitude: 0, origin: 'Moon', phase: 'evening',
      aspects: ['square', 'square'], at: '2026-01-01T00:00:00.000Z', candidate: true, sameSect: true, status: 'not_matched' },
    { birth: '1991-06-18T04:00:00Z', armc: 66, latitude: 35, origin: 'Fortune', phase: 'undetermined',
      aspects: ['none', 'square'], at: '2026-01-01T21:11:09.066Z', candidate: true, sameSect: undefined, status: 'unknown' },
    { birth: '1991-06-18T04:00:00Z', armc: 75, latitude: 35, origin: 'Fortune', phase: 'undetermined',
      aspects: ['opposition', 'square'], at: '2026-01-20T16:41:25.546Z', candidate: true, sameSect: undefined, status: 'unknown' },
    { birth: '1990-01-01T04:00:00Z', armc: 240, latitude: 35, origin: 'Fortune', phase: 'evening',
      aspects: ['square', 'square'], at: '2026-01-01T21:11:09.066Z', candidate: true, sameSect: false, status: 'matched' },
  ];
  const auditSect = /月级水星按本命晨昏地平与出生昼夜异派/u;
  const runs = new Map();
  for (const { birth, armc, latitude, month = 1, origin, phase, aspects, at, candidate, sameSect, status } of cases) {
    const snapshotId = 'ptolemy-adverse-mercury-horizon-' + armc + '-' + month;
    if (!runs.has(snapshotId)) {
      const atBirth = Date.parse(birth);
      const natal = chart(atBirth, armc);
      const obliquity = e_tilt(MakeTime(new Date(atBirth))).tobl;
      Object.assign(natal.western.rawResult[0], anglesFromFrame(armc, latitude, obliquity));
      const reference = { snapshotId, chart: natal };
      const request = { ...params, targetPeriod: { ...params.targetPeriod, month } };
      const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(request, asOf, reference)));
      const run = bindClientFortuneRun(request, batch, readClientFactTime(request, batch, asOf), snapshotId, reference);
      validateFortuneFacts(run);
      runs.set(snapshotId, run);
    }
    const run = runs.get(snapshotId);
    const ingresses = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
      && p.level === 'month' && p.origin === origin && p.transitBody === 'Mercury');
    const fact = ingresses.find(({ normalizedPayload: p, activeFrom }) => p.aspectType === aspects[1]
      && Math.abs(Date.parse(activeFrom) - Date.parse(at)) < 1_000);
    assert.ok(fact, snapshotId + ': ' + JSON.stringify(ingresses.map(({ activeFrom, normalizedPayload: p }) =>
      [activeFrom, p.aspectType, p.transitNatalOriginAspect])));
    const p = fact.normalizedPayload;
    assert.deepEqual([p.natalOriginAspect, p.aspectType], aspects);
    if (aspects[0] === 'none') assert.equal(p.natalOriginSignFamiliarity, 'alien');
    if (birth === '1990-01-09T00:00:00Z') {
      const natalOpposition = at === '2026-01-20T16:41:25.546Z';
      assert.equal(p.transitNatalOriginAspect, natalOpposition ? 'opposition' : 'none');
      assert.equal(p.transitAnnualAspect, month === 1 ? 'opposition' : 'none');
    }
    assert.equal(p.governsNatalOrigin, false);
    assert.equal(p.sameAsNatalAuthorTermRuler, false);
    assert.equal(p.oppositeNatalSect, candidate);
    assert.equal(p.sameNatalMercuryHorizonSect, sameSect);
    assert.equal(p.natalMercuryHorizon.phase, phase);
    assert.equal(p.natalMercuryHorizon.sunriseAltitude > 0, phase !== 'evening');
    assert.equal(p.natalMercuryHorizon.sunsetAltitude > 0, phase !== 'morning');
    const midpoint = new Date((Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2);
    assert.equal(sign(Ecliptic(GeoVector(Body.Mercury, midpoint, true)).elon), p.transitSign);
    const scoped = result({ ...run, facts: [fact] }, 30);
    assert.equal(scoped.status, status, snapshotId);
    assert.equal(scoped.sourceFactIds.includes(fact.factId), status === 'partial' || status === 'matched');
    if (status === 'matched') assert.equal(scoped.matchedSourceExcerpt, 'if they are in opposition or in quartile');
    if (month === 2) {
      const ingress = Date.parse(fact.activeFrom);
      const mercurySign = time => sign(Ecliptic(GeoVector(Body.Mercury, new Date(time), true)).elon);
      assert.deepEqual([mercurySign(ingress - 60_000), mercurySign(ingress + 60_000)], [10, 11]);
      assert.deepEqual([p.monthSign, p.annualSign, p.natalGovernors.sign, p.transitMonthlyAspect], [5, 4, 4, 'opposition']);
      assert.deepEqual(scoped.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.equal(fact.activeTo, '2026-03-01T00:00:00.000Z');
    }
    if (status !== 'partial' && status !== 'matched') continue;
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), snapshotId));
    assert.match(formatFortuneFactAudit(input), auditSect);
    assert.doesNotMatch(formatFortunePrompt(input), /月级水星按本命晨昏地平|natalMercuryHorizon|sameNatalMercuryHorizonSect/u);
  }
});

test('server SQLite uses each submitted natal origin and transit interval to resolve the Ptolemy relationship candidates', () => {
  const now = Date.parse('2026-11-18T03:00:00Z');
  const params = { periodType: 'month', targetPeriod: { year: 2026, month: 1 }, displayTimezone: 'Asia/Shanghai' };
  const reference = { snapshotId: 'source-times-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart: chart() })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'ptolemy-test', reference);
  const match = result(run, 30);
  assert.equal(match.status, 'matched');
  const required = fact => evaluateFortuneRules('western', 'month', [fact])
    .find(row => row.knowledgeId === match.knowledgeId).required[0];
  const tested = (origin, body, aspect) => run.facts.find(({ factType, normalizedPayload: p }) =>
    factType === 'ptolemy_ingress_contact' && p.level === 'month' && p.origin === origin && p.transitBody === body && p.aspectType === aspect);
  const support = tested('MC', 'Mars', 'sextile');
  const opposedSect = tested('ASC', 'Sun', 'opposition');
  assert.equal(result({ ...run, facts: [support] }, 30).status, 'partial');
  assert.equal(result({ ...run, facts: [opposedSect] }, 30).status, 'matched');
  assert.ok(match.candidateFactIds.includes(support.factId));
  assert.ok(!match.sourceFactIds.includes(support.factId));
  assert.ok(match.sourceFactIds.includes(opposedSect.factId));
  assert.deepEqual(support.normalizedPayload.natalRulership, ['domicile']);
  assert.equal(support.normalizedPayload.natalOriginAspect, 'trine');
  assert.equal(opposedSect.normalizedPayload.oppositeNatalSect, true);
  assert.equal(opposedSect.normalizedPayload.governsNatalOrigin, false);
  assert.equal(opposedSect.normalizedPayload.natalOriginAspect, 'opposition');

  const venus = tested('MC', 'Venus', 'sextile');
  assert.ok(venus && match.sourceFactIds.includes(venus.factId));
  const pVenus = venus.normalizedPayload;
  assert.deepEqual([pVenus.natalGovernorProfile, pVenus.natalOriginAspect, pVenus.transitNatalOriginAspect,
    pVenus.oppositeNatalSect, pVenus.governsNatalOrigin, pVenus.sameAsNatalAuthorTermRuler],
  ['ptolemy-robbins-natal-governors-v1', 'sextile', 'sextile', false, false, false]);
  assert.deepEqual([pVenus.natalGovernors.sign, pVenus.natalTransitBodySign, pVenus.transitSign, pVenus.sign], [0, 10, 10, 0]);
  assert.equal(pVenus.monthlyOriginAspect, 'conjunction');
  assert.ok(Math.abs(Date.parse(venus.activeFrom) - Date.parse('2026-01-17T12:42:45.746Z')) < 1_000);
  assert.equal(venus.activeTo, '2026-01-29T04:00:00.000Z');
  const venusIngress = Date.parse(venus.activeFrom);
  const venusSign = time => sign(Ecliptic(GeoVector(Body.Venus, new Date(time), true)).elon);
  assert.deepEqual([venusSign(birthAt), venusSign(venusIngress - 60_000), venusSign(venusIngress + 60_000)], [10, 9, 10]);
  const onlyVenus = payload => result({ ...run, facts: [{ ...venus, normalizedPayload: { ...pVenus, ...payload } }] }, 30);
  const established = onlyVenus({});
  assert.equal(established.status, 'matched');
  assert.deepEqual(established.windows, [{ start: venus.activeFrom, endExclusive: venus.activeTo }]);
  assert.equal(established.matchedSourceExcerpt, 'favourable aspect');
  assert.equal(onlyVenus({ monthlyOriginAspect: 'opposition' }).status, 'partial');
  assert.equal(onlyVenus({ monthlyOriginAspect: undefined }).status, 'partial');
  const changeVenus = changes => required({ ...venus, normalizedPayload: { ...pVenus, ...changes } });
  for (const changes of [{ oppositeNatalSect: true }, { transitNatalOriginAspect: 'none' }, { natalOriginAspect: 'square' }, { level: 'year' }]) {
    const assessment = changeVenus(changes);
    assert.deepEqual([assessment.hits.length, assessment.unknown], [0, false]);
  }
  const missingOrigin = changeVenus({ transitNatalOriginAspect: undefined });
  assert.deepEqual([missingOrigin.hits.length, missingOrigin.unknown], [0, true]);
  const oppositeFortune = tested('Fortune', 'Sun', 'trine');
  assert.ok(oppositeFortune);
  assert.deepEqual([oppositeFortune.normalizedPayload.natalOriginAspect, oppositeFortune.normalizedPayload.transitNatalOriginAspect,
    oppositeFortune.normalizedPayload.oppositeNatalSect], ['trine', 'trine', true]);
  assert.ok(!match.sourceFactIds.includes(oppositeFortune.factId));

  const autumn = calculate(chart(), 'month', { year: 2026, month: 9 });
  const reversed = autumn.facts.find(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.origin === 'MC' && p.transitBody === 'Mars' && p.aspectType === 'opposition');
  assert.ok(reversed && required(reversed).hits.length === 1);
  assert.equal(reversed.normalizedPayload.governsNatalOrigin, true);
  assert.equal(reversed.normalizedPayload.natalOriginAspect, 'trine');

  const ordinaryReference = { snapshotId: 'ptolemy-i16-alien', chart: chart(birthAt, 290) };
  const ordinaryBatch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ordinaryReference)));
  const ordinary = bindClientFortuneRun(params, ordinaryBatch, readClientFactTime(params, ordinaryBatch, now),
    'ptolemy-client-alien', ordinaryReference);
  const contact = (run, origin, body, aspect) => run.facts.find(({ factType, normalizedPayload: p }) =>
    factType === 'ptolemy_ingress_contact' && p.level === 'month' && p.origin === origin
    && p.transitBody === body && p.aspectType === aspect && p.natalOriginAspect === 'none');
  const alien = contact(ordinary, 'ASC', 'Mars', 'square');
  assert.ok(alien);
  const alienPayload = alien.normalizedPayload;
  assert.deepEqual([alienPayload.natalOriginSignFamiliarity, alienPayload.natalTransitBodySign, alienPayload.natalGovernors.sign,
    alienPayload.governsNatalOrigin, alienPayload.oppositeNatalSect], ['alien', 8, 1, false, true]);
  assert.equal(alienPayload.natalGovernors.natalSect, 'day');
  assert.equal(sign(Ecliptic(GeoVector(Body.Mars, new Date(birthAt), true)).elon), alienPayload.natalTransitBodySign);
  const transitAt = new Date((Date.parse(alien.activeFrom) + Date.parse(alien.activeTo)) / 2);
  assert.equal(sign(Ecliptic(GeoVector(Body.Mars, transitAt, true)).elon), alienPayload.transitSign);
  assert.ok(Math.abs(Date.parse(alien.activeFrom) - Date.parse('2026-01-23T09:16:19.101Z')) < 1_000);
  assert.equal(alien.activeTo, '2026-01-29T04:00:00.000Z');
  const alienRule = result({ ...ordinary, facts: [alien] }, 30);
  assert.equal(alienRule.status, 'matched');
  assert.equal(alienRule.matchedSourceExcerpt, 'if they are in opposition or in quartile');
  assert.match(alienRule.matchedConditions.join('\n'), /异质座/u);
  assert.equal(alienPayload.transitNatalOriginAspect, 'square');
  const alienRun = { ...ordinary, facts: [alien] };
  const { input: alienInput } = buildFortuneModelContext(alienRun,
    interpretFortune(alienRun, requestForFortuneRun(alienRun), ordinaryReference.snapshotId));
  const alienEvidence = '该行运星的本命座射手座与起算原位金牛座按原书列为异质座';
  assert.ok(formatFortuneFactAudit(alienInput).includes(alienEvidence));
  const alienProvider = formatFortunePrompt(alienInput);
  assert.match(alienProvider, /异质座/u);
  assert.ok(!alienProvider.includes(alienEvidence));
  const ordinaryTrines = ordinary.facts.filter(({ factType, normalizedPayload: p }) => factType === 'ptolemy_ingress_contact'
    && p.level === 'month' && p.aspectType === 'trine' && p.natalGovernors.natalSect === 'day');
  const trineCandidates = evaluateFortuneRules('western', 'month', ordinaryTrines)
    .find(row => row.knowledgeId === match.knowledgeId).required[0].hits;
  const authorTrines = trineCandidates.filter(row => row.normalizedPayload.sameAsNatalAuthorTermRuler === true);
  assert.ok(ordinaryTrines.length > authorTrines.length);
  assert.deepEqual(authorTrines.map(({ normalizedPayload: p }) => [p.origin, p.transitBody, p.natalOriginAspect,
    p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler]), [['Fortune', 'Venus', 'trine', false, true]]);

  for (const [birth, armc, month, origin, aspect, formerRelation, originSign, originTransitAspect, confirmed] of [
    [birthAt, 60, 6, 'MC', 'opposition', 'commanding-obeying', 2, 'conjunction', true],
    [birthAt, 60, 9, 'MC', 'opposition', 'commanding-obeying', 2, 'square', true],
    [Date.parse('1968-01-01T12:00:00Z'), 150, 1, 'Fortune', 'square', 'equal-power', 8, 'none', true],
    [Date.parse('1968-01-01T12:00:00Z'), 150, 3, 'Fortune', 'square', 'equal-power', 8, 'square', true],
  ]) {
    const contrast = calculate(chart(birth, armc), 'month', { year: 2026, month });
    const witness = contact(contrast, origin, 'Sun', aspect);
    assert.ok(witness, `${origin} ${month}`);
    const p = witness.normalizedPayload;
    assert.deepEqual([p.natalOriginSignFamiliarity, p.natalTransitBodySign, p.natalGovernors.sign,
      p.governsNatalOrigin, p.sameAsNatalAuthorTermRuler, p.oppositeNatalSect, p.transitNatalOriginAspect],
    ['alien', 9, originSign, false, false, true, originTransitAspect]);
    assert.equal(sign(SunPosition(new Date(birth)).elon), p.natalTransitBodySign);
    const midway = new Date((Date.parse(witness.activeFrom) + Date.parse(witness.activeTo)) / 2);
    assert.equal(sign(SunPosition(midway).elon), p.transitSign);
    assert.equal(ptolemySignAspect(p.sign, p.transitSign), aspect);
    assert.equal(required(witness).hits.length, 1);
    assert.equal(required({ ...witness, normalizedPayload: { ...p, natalOriginSignFamiliarity: formerRelation } }).hits.length, 0);
    const scoped = { ...contrast, facts: [witness] };
    const checked = result(scoped, 30);
    assert.equal(checked.status, confirmed ? 'matched' : 'partial');
    assert.ok(checked.sourceFactIds.includes(witness.factId));
    assert.equal(checked.matchedSourceExcerpt, confirmed ? 'if they are in opposition or in quartile' : undefined);
    if (confirmed) {
      assert.deepEqual(checked.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ptolemy-loeb-alien'));
      assert.match(formatFortuneFactAudit(input), /本命座摩羯座与起算原位[^。]+按原书列为异质座/u);
      assert.doesNotMatch(formatFortunePrompt(input), /本命座摩羯座与起算原位|natalOriginSignFamiliarity/u);
    }
  }
  // The known pairs listed by Robbins remain configured and do not enter I.16.
  for (const [armc, transitBody, natalSign, originSign, natalAspect] of [
    [105, 'Sun', 9, 3, 'opposition'], // I.14 note 80: Cancer–Capricorn.
    [315, 'Mars', 8, 10, 'sextile'], // I.15 note 83: Aquarius–Sagittarius.
  ]) {
    const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2026, 1, 1) };
    const familiar = buildPtolemyTimes(window, 'month', chart(birthAt, armc), []).contacts
      .filter(row => row.level === 'month' && row.origin === 'MC' && row.transitBody === transitBody);
    assert.ok(familiar.length > 0);
    for (const row of familiar) {
      assert.deepEqual([row.natalTransitBodySign, row.natalGovernors.sign, row.natalOriginAspect], [natalSign, originSign, natalAspect]);
      assert.equal(row.natalOriginSignFamiliarity, undefined);
    }
  }
  assert.equal(required({ ...alien, normalizedPayload: { ...alienPayload, natalOriginSignFamiliarity: undefined } }).unknown, true);
  const withoutSect = structuredClone(opposedSect);
  delete withoutSect.normalizedPayload.oppositeNatalSect;
  assert.equal(result({ ...run, facts: [withoutSect] }, 30).status, 'unknown');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ptolemy-client-relation'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /所承年级星座/u);
  assert.match(prompt, /原位按埃及表/u);
  assert.match(prompt, /该天体与本命昼夜派别相反/u);
  assert.match(prompt, /火星在本命以守护掌原位/u);
  assert.doesNotMatch(prompt, /governsNatalOrigin|natalGovernorProfile|oppositeNatalSect/u);
  const provider = formatFortunePrompt(input);
  for (const condition of established.matchedConditions) assert.ok(provider.includes(condition));
  assert.ok(provider.includes('favourable aspect'));
  assert.doesNotMatch(provider, /所承年级星座|governsNatalOrigin|natalGovernorProfile|oppositeNatalSect/u);

  const phases = run.facts.filter(({ factType }) => factType === 'ptolemy_lunar_phase_contact');
  assert.equal(phases.length, 20);
  const january = [
    ['full_moon', '2026-01-03', 180], ['last_quarter', '2026-01-10', 270],
    ['new_moon', '2026-01-18', 0], ['first_quarter', '2026-01-26', 90],
  ];
  for (const [name, date, expectedAngle] of january) {
    const rows = phases.filter(({ normalizedPayload }) => normalizedPayload.phase === name);
    assert.equal(rows.length, 5);
    assert.equal(new Set(rows.map(row => row.exactInstant)).size, 1);
    assert.ok(rows[0].exactInstant.startsWith(date));
    const at = new Date(rows[0].exactInstant);
    assert.ok(Math.abs(normalize(MoonPhase(at) - expectedAngle + 180) - 180) < 0.0002);
    for (const row of rows) {
      const p = row.normalizedPayload;
      const actual = sign(Ecliptic(GeoVector(Body.Moon, at, true)).elon);
      assert.equal(p.moonSign, actual);
      const samePlace = run.facts.find(fact => fact.factType === 'ptolemy_time_place'
        && fact.normalizedPayload.origin === p.origin && fact.normalizedPayload.level === 'month'
        && fact.activeFrom <= row.exactInstant && row.exactInstant < fact.activeTo);
      assert.ok(samePlace);
      assert.deepEqual([p.annualSign, p.monthSign], [samePlace.normalizedPayload.annualSign, samePlace.normalizedPayload.monthSign]);
      assert.deepEqual([p.natalOriginSign, p.annualRuler, p.monthlyRuler, p.annualOriginAspect, p.monthlyOriginAspect],
        [samePlace.normalizedPayload.natalGovernors.sign, samePlace.normalizedPayload.annualRuler,
          samePlace.normalizedPayload.monthlyRuler, samePlace.normalizedPayload.annualOriginAspect, samePlace.normalizedPayload.monthlyOriginAspect]);
      assert.equal(p.annualAspect, ptolemySignAspect(actual, p.annualSign) ?? 'none');
      assert.equal(p.monthlyAspect, ptolemySignAspect(actual, p.monthSign) ?? 'none');
      assert.equal(p.solarSign, sign(SunPosition(at).elon));
      assert.equal(p.solarAnnualAspect, ptolemySignAspect(p.solarSign, p.annualSign) ?? 'none');
      assert.equal(p.solarMonthlyAspect, ptolemySignAspect(p.solarSign, p.monthSign) ?? 'none');
      assert.equal(row.activeFrom, row.exactInstant);
      assert.equal(Date.parse(row.activeTo) - at.getTime(), 1000);
      for (const ingress of p.phaseIngressContacts) {
        const witness = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: q }) =>
          factType === 'ptolemy_ingress_contact' && q.origin === p.origin && q.level === ingress.level
          && q.transitBody === ingress.body && q.timedPlaceIngressAt === ingress.ingressAt
          && activeFrom <= row.exactInstant && row.activeTo <= activeTo);
        assert.ok(witness && ingress.ingressAt <= row.exactInstant);
        assert.equal(ingress.sign, witness.normalizedPayload.sign);
        assert.equal(ingress.timeRuler, ptolemySignRuler(ingress.sign));
        const longitudeAt = time => ingress.body === 'Sun' ? SunPosition(new Date(time)).elon
          : Ecliptic(GeoVector(Body[ingress.body], new Date(time), true)).elon;
        const ingressAt = Date.parse(ingress.ingressAt);
        assert.notEqual(sign(longitudeAt(ingressAt - 60_000)), ingress.sign);
        assert.equal(sign(longitudeAt(ingressAt + 60_000)), ingress.sign);
        assert.equal(sign(longitudeAt(at.getTime())), ingress.sign);
      }
    }
  }
  assert.ok(phases.some(({ normalizedPayload: p }) => p.annualAspect === 'none' && p.monthlyAspect === 'none'));
  const withSolarIngress = phases.find(({ normalizedPayload: p }) => p.phaseIngressContacts.some(ingress =>
    ingress.level === 'month' && ingress.body === 'Sun'));
  assert.ok(withSolarIngress);
  assert.equal(withSolarIngress.normalizedPayload.solarMonthlyAspect, 'conjunction');
  const otherCauses = phases.filter(fact => fact.exactInstant === withSolarIngress.exactInstant
    && fact.normalizedPayload.origin !== withSolarIngress.normalizedPayload.origin);
  assert.ok(otherCauses.some(({ normalizedPayload: p }) => p.solarMonthlyAspect !== 'conjunction'
    && !p.phaseIngressContacts.some(ingress => ingress.level === 'month' && ingress.body === 'Sun')));
  assert.ok(phases.every(row => !match.sourceFactIds.includes(row.factId)));
  assert.match(prompt, /月相应期。实际(?:朔|望|上弦|下弦)点的月亮位于/u);
  assert.match(prompt, /同一月相时刻的太阳位于/u);
  assert.match(prompt, /同一本命起点位于.*年级时限[^。]*的守护星是/u);
  assert.match(prompt, /实际入座，月相真点仍在这段行运内/u);
  assert.doesNotMatch(formatFortunePrompt(input), /月相应期|实际入座，月相真点仍在这段行运内|ptolemy_lunar_phase_contact|phaseIngressContacts/u);
});

test('source timing refuses unknown, conflicting or multiple birth data and never silently replaces missing axes with another origin', () => {
  const window = { start: Date.parse('2026-07-01T00:00:00Z'), end: Date.parse('2026-08-01T00:00:00Z') };
  for (const alter of [c => { c.timeKnown = false; }, c => { c.western.engineVersion = 'unknown'; },
    c => { c.western.rawResult.push(structuredClone(c.western.rawResult[0])); },
    c => { c.western.rawResult[0].positions[0].longitude += 10; }]) {
    const snapshot = chart(); alter(snapshot);
    assert.notEqual(buildPtolemyTimes(window, 'month', snapshot, []).status, 'ready');
  }
  const noAxes = chart(); noAxes.western.rawResult[0].ascendant = NaN;
  const result = buildPtolemyTimes(window, 'month', noAxes, []);
  assert.equal(result.status, 'ready'); assert.equal(result.originCount, 2);
  assert.ok(result.places.every(p => ['Sun', 'Moon'].includes(p.origin)));
  assert.ok(result.places.every(p => p.natalGovernors.natalSect === undefined));
  assert.ok([...result.places, ...result.contacts].every(p => p.primaryDirection === undefined));
  assert.ok(result.contacts.every(p => p.oppositeNatalSect === undefined));

  const duplicate = chart(), wrapped = chart();
  const placements = duplicate.western.rawResult[0].positions;
  placements.push({ ...placements.find(p => p.planet === 'Mars') });
  wrapped.western.rawResult[0].positions.find(p => p.planet === 'Mars').longitude += 360;
  const mars = snapshot => buildPtolemyTimes(window, 'month', snapshot, []).contacts.filter(contact => contact.transitBody === 'Mars');
  assert.deepEqual(mars(wrapped), mars(chart()));
  assert.ok(mars(duplicate).length && mars(duplicate).every(p => p.natalOriginAspect === undefined));
});

function pair() {
  const common = { method: 'western', completeness: 'complete', calculationRunId: 'r', natalChartSnapshotId: 's', periodType: 'year',
    activeFrom: '2026-01-01T00:00:00.000Z', activeTo: '2026-04-01T00:00:00.000Z', sourceFactIds: ['raw'] };
  return [{ ...common, factId: 'p', scope: 'progressed', factType: 'progressed_aspect', normalizedPayload: {
    kind: 'secondary', targetKind: 'natal', zodiac: 'tropical', progressedBody: 'Venus', natalTargetId: 'Moon', aspectType: 'trine' } },
  { ...common, factId: 't', scope: 'transit', factType: 'aspect_interval', activeFrom: '2026-03-01T00:00:00.000Z', normalizedPayload: {
    zodiac: 'tropical', transitBody: 'Saturn', natalTargetType: 'planet', natalTargetId: 'Moon', aspectType: 'square' } }];
}
test('temporal links require the same snapshot, run, target and real interval; geometry alone does not infer harmonious nature', () => {
  const facts = pair(), before = structuredClone(facts), [overlap] = westernProgressionTransitOverlaps(facts);
  assert.equal(overlap.start, Date.parse('2026-03-01T00:00:00Z')); assert.equal(overlap.end, Date.parse('2026-04-01T00:00:00Z'));
  assert.equal(overlap.overlapOnly, true); assert.equal(overlap.sameNature, undefined); assert.deepEqual(facts, before);
  for (const alter of [p => { p[1].natalChartSnapshotId = 'other'; }, p => { p[1].calculationRunId = 'other'; },
    p => { p[1].periodType = 'month'; }, p => { p[1].completeness = 'partial'; }, p => { p[1].normalizedPayload.natalTargetId = 'Sun'; },
    p => { p[1].normalizedPayload.natalTargetType = 'sky'; }, p => { p[1].activeFrom = p[0].activeTo; },
    p => { delete p[0].natalChartSnapshotId; delete p[1].natalChartSnapshotId; }]) {
    const changed = pair(); alter(changed); assert.deepEqual(westernProgressionTransitOverlaps(changed), []);
  }
});

test('all eight old western rows have reviewed queries with their precise missing source premises still excluding complete hits', () => {
  const library = fortuneKnowledge.western; assert.equal(library.rules.filter(r => !r.queries.length).length, 0);
  for (const i of [17, 23, 27, 28, 29, 30, 31, 39]) {
    const rule = library.rules[i], entry = library.entries.find(e => e.id === rule.knowledgeId);
    assert.ok(rule.queries.length && rule.unresolved.length);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
  assert.match(library.rules[27].unresolved.join(), /候选解释/u); assert.match(library.rules[39].unresolved.join(), /不同指征的同题/u);
});

test('real temporal links reach natural language while generic overlap stays distinct from the Heindel source match', () => {
  const run = realRun(), links = run.facts.filter(f => f.factType === 'progression_transit_overlap'); assert.ok(links.length);
  for (const f of links) {
    const p = f.normalizedPayload, first = run.facts.find(f => f.factId === p.progressionFactId), second = run.facts.find(f => f.factId === p.transitFactId);
    assert.ok(first && second); assert.ok(f.activeFrom >= first.activeFrom && f.activeFrom >= second.activeFrom);
    assert.ok(f.activeTo <= first.activeTo && f.activeTo <= second.activeTo);
  }
  assert.ok(run.facts.some(f => f.factType === 'heindel_direction_transit_overlap' && f.normalizedPayload.directionKind === 'no_overlap'));
  assert.equal(result(run, 39).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'source-times-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /托勒密候选年级时限位置/u); assert.match(prompt, /二又三分之一天/u);
  assert.match(prompt, /当前朔望月/u); assert.match(prompt, /不等于同性质/u);
  for (const i of [17, 23, 27, 28, 29, 30, 31, 39]) assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === fortuneKnowledge.western.rules[i].knowledgeId));
  for (const forbidden of ['ptolemy_', 'sameAsAnnualLord', 'progressionFactId', 'source-times-run', 'fullPeriodStart']) assert.ok(!prompt.includes(forbidden), forbidden);
});
