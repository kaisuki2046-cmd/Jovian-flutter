import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';

const { progressionEpoch, progressionRealTime, progressionPolicy, readProgressionBirth,
  readProgressionPosition, scanProgressionBand, buildWesternProgressions } = await import('./control/western-progressions.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const day = 86_400_000;
const birthAt = Date.parse('1990-01-01T04:00:00Z');
const start = Date.parse('2026-01-01T00:00:00Z'), end = Date.parse('2027-01-01T00:00:00Z');
const referenceAt = Date.parse('2026-11-18T02:00:00Z');
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
function snapshot() {
  const positions = bodies.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(birthAt)).elon
    : Ecliptic(GeoVector(Body[planet], new Date(birthAt), true)).elon }));
  return { version: 1, timeKnown: true,
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1', rawResult: [] },
    ziwei: { rawResult: [] },
    western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1',
      rawResult: [{ julianDay: birthAt / day + 2440587.5, ascendant: 15, midheaven: 285, positions }] } };
}
let baseline;
const calculated = () => baseline ??= buildWesternProgressions({ start, end }, referenceAt, snapshot());

test('day-for-year and two-hours-for-month keys reproduce the original birthday examples, including leap-day policy and inverse times', () => {
  const leoBirth = Date.parse('1860-08-07T05:49:00Z');
  assert.equal(progressionEpoch(leoBirth, Date.parse('1906-08-07T05:49:00Z')), Date.parse('1860-09-22T05:49:00Z'));
  assert.equal(progressionEpoch(leoBirth, Date.parse('1907-02-07T05:49:00Z')), Date.parse('1860-09-22T17:49:00Z'));
  const leapBirth = Date.parse('2000-02-29T12:34:00Z');
  assert.equal(progressionEpoch(leapBirth, Date.parse('2001-02-28T12:34:00Z')), leapBirth + day);
  for (const at of ['2000-03-31T12:00:00Z', '2001-03-01T00:00:00Z', '2026-11-18T03:21:42Z']) {
    const instant = Date.parse(at);
    assert.ok(Math.abs(progressionRealTime(leapBirth, progressionEpoch(leapBirth, instant)) - instant) < 2);
  }
  assert.throws(() => progressionEpoch(birthAt, birthAt - 1), /Invalid/u);
  assert.throws(() => progressionEpoch(birthAt, Infinity), /Invalid/u);
});

test('birth clocks and natal longitudes must agree before a secondary progression is calculated', () => {
  const chart = snapshot();
  assert.equal(readProgressionBirth(chart).status, 'ready');
  chart.bazi.rawResult = [{ utc: new Date(birthAt + day).toISOString() }];
  assert.equal(readProgressionBirth(chart).status, 'inconsistent_clock');
  chart.bazi.rawResult = [{ utc: new Date(birthAt).toISOString() }];
  delete chart.western.rawResult[0].julianDay;
  assert.equal(readProgressionBirth(chart).clockSource, 'archived_bazi_utc');
  chart.bazi.engineVersion = 'unrecognized';
  assert.equal(readProgressionBirth(chart).status, 'missing_clock');
  chart.bazi.engineVersion = '1.7.8';
  chart.western.rawResult[0].positions[0].longitude += 10;
  assert.equal(readProgressionBirth(chart).status, 'inconsistent_natal');
  assert.equal(readProgressionBirth({ ...snapshot(), timeKnown: false }).status, 'uncertain');
  const missing = snapshot(); delete missing.western.rawResult[0].julianDay;
  assert.equal(readProgressionBirth(missing).status, 'missing_clock');
});

test('the scalar solver detects two narrow bands around an interior station even with both sample endpoints outside', () => {
  const fn = at => (at / day - 1) ** 2 - 0.01;
  const bands = scanProgressionBand({ start: 0, end: 4 * day }, fn, 0.002);
  assert.equal(bands.length, 2);
  const expected = [[1 - Math.sqrt(0.012), 1 - Math.sqrt(0.008)], [1 + Math.sqrt(0.008), 1 + Math.sqrt(0.012)]];
  for (let index = 0; index < 2; index++) {
    assert.ok(Math.abs(bands[index].start / day - expected[index][0]) < 0.0001);
    assert.ok(Math.abs(bands[index].end / day - expected[index][1]) < 0.0001);
    assert.equal(bands[index].exactTimes.length, 1);
    assert.ok(Math.abs(fn(bands[index].exactTimes[0])) < 1e-5);
  }
});

test('parallel scanning rejects opposite hemispheres even when absolute declinations or broad differences are near each other', () => {
  const natalDec = 0.1;
  const same = value => Math.sign(value + natalDec) === Math.sign(natalDec);
  assert.equal(scanProgressionBand({ start: 0, end: day }, () => -0.2, 0.25, [-natalDec], same).length, 0);
  const bands = scanProgressionBand({ start: 0, end: day }, at => at / day * 0.4 - 0.2, 0.25, [-natalDec], same);
  assert.equal(bands.length, 1);
  assert.ok(Math.abs(bands[0].start - day / 4) < 2_000);
});

test('real ephemerides yield planetary secondary positions and valid geometric bands rather than current transits or one solar arc for all bodies', () => {
  const result = calculated();
  assert.equal(result.status, 'ready');
  assert.equal(result.positions.length, 10);
  assert.ok(result.intervals.length > 0);
  const sun = result.positions.find(row => row.body === 'Sun');
  const neptune = result.positions.find(row => row.body === 'Neptune');
  const solarArc = (sun.longitude - sun.natalLongitude + 360) % 360;
  const neptuneArc = (neptune.longitude - neptune.natalLongitude + 360) % 360;
  assert.ok(Math.abs(solarArc - neptuneArc) > 20);
  assert.ok(Math.abs(neptune.longitude - Ecliptic(GeoVector(Body.Neptune, new Date(referenceAt), true)).elon) > 10);
  for (const row of result.intervals) {
    assert.ok(start <= row.start && row.start < row.end && row.end <= end);
    const at = (row.start + row.end) / 2;
    const position = readProgressionPosition(row.progressedBody, progressionEpoch(birthAt, at), birthAt);
    if (row.aspectType === 'parallel') {
      assert.ok(position.declination * row.natalDeclination >= 0);
      assert.ok(Math.abs(position.declination - row.natalDeclination) <= row.allowedOrb + 1e-6);
    } else {
      const distance = Math.abs((position.longitude - row.natalLongitude + 540) % 360 - 180);
      assert.ok(Math.abs(distance - row.exactAngle) <= row.allowedOrb + 1e-6);
    }
    for (const exact of row.exactTimes) assert.ok(row.start <= exact && exact < row.end);
  }
  assert.ok(result.intervals.some(row => row.exactTimes.length));
  assert.throws(() => buildWesternProgressions({ start, end: start }, referenceAt, snapshot()), /window/u);
});

test('all 342 records have source-specific directions and predicates, with Leo magnitude parallels distinct from the generic hemisphere policy', () => {
  const rules = fortuneKnowledge.western.rules.filter(row => row.knowledgeId.includes('leo-1906-interpretation'));
  assert.equal(rules.length, 342);
  const kinds = Object.groupBy(rules, rule => rule.queries[0].factType);
  assert.equal(kinds.leo_progressed_aspect.length + kinds.leo_lunar_condition.length, 294);
  assert.equal(kinds.leo_lunar_condition.length, 123);
  assert.equal(kinds.leo_ascendant_context.length, 36);
  assert.equal(kinds.leo_lunar_house_context.length, 11);
  assert.equal(kinds.leo_lunar_ascendant_crossing.length, 1);
  for (const row of rules) {
    assert.ok(row.review.sourceHash && row.review.mappedConditions.length && row.unresolved.length);
    const query = row.queries[0];
    assert.equal(query.scope, 'progressed');
    if (['leo_progressed_aspect', 'leo_lunar_condition'].includes(query.factType)) {
      assert.ok(query.where.targetKind === 'natal'
        || ['Sun', 'Moon'].includes(query.where.progressedBody) && query.where.targetKind.oneOf.join() === 'natal,progressed');
      assert.equal(query.where.kind, 'secondary');
      assert.equal(query.where.progressionPolicy, progressionPolicy.version);
      assert.equal(query.where.profile, 'leo-1906-source-context-v1');
      if (query.where.aspectType === 'parallel') {
        assert.equal(query.where.coordinate, 'equatorial_declination_of_date');
        assert.equal(query.where.sameHemisphere, undefined);
        assert.equal(query.where.allowedOrb, 1);
      }
    }
  }
  const merged = rules.find(row => row.knowledgeId.includes('interpretation-p245-'));
  assert.deepEqual(merged.queries[0].anyOf, [
    { aspectType: { oneOf: ['conjunction', 'semisextile', 'sextile', 'trine'] }, coordinate: 'ecliptic_longitude' },
    { aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', parallelComparison: 'absolute-declination-north-south-not-required', allowedOrb: 1 },
  ]);
});

test('real calculation facts feed source matching and Chinese prompts while source branches remain incomplete', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai' };
  const time = buildFactTimeContext(input, referenceAt, 'server');
  const run = calculateFortuneFacts(input, time, 'progression-run', { snapshotId: 'progression-chart', chart: snapshot() });
  validateFortuneFacts(run);
  assert.notEqual(run.methods.western.status, 'failed');
  const geometric = run.facts.filter(row => row.factType === 'progressed_aspect');
  assert.ok(geometric.length);
  assert.ok(geometric.every(row => row.scope === 'progressed' && row.normalizedPayload.targetKind === 'natal'));
  const exact = run.facts.filter(row => row.factType === 'progressed_aspect_exact');
  assert.ok(exact.length);
  assert.ok(exact.every(row => row.normalizedPayload.separation < 0.0001));
  const matches = matchFortuneKnowledge(run).byMethod.western.filter(row => row.knowledgeId.includes('leo-1906-interpretation'));
  assert.ok(matches.some(row => row.status === 'partial'));
  assert.ok(matches.every(row => row.status !== 'matched'));
  const report = interpretFortune(run, requestForFortuneRun(run), 'progression-report');
  const context = buildFortuneModelContext(run, report);
  assert.ok(context.input.facts.some(row => row.scope === 'progressed'));
  assert.ok(context.input.sections.flatMap(section => section.findings).every(row => !row.knowledgeId.includes('leo-1906-interpretation')));
  const outgoing = formatFortuneFactAudit(context.input);
  assert.match(outgoing, /次限推运/u);
  assert.match(outgoing, /次限.+对本命/u);
  assert.ok(!/progressedBody|progressionPolicy|progressed_aspect/u.test(outgoing));
  assert.ok(!outgoing.includes('1990-01-01'), 'the ephemeris epoch and birth clock remain internal');
});
