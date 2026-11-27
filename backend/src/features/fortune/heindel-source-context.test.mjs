import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Body, Ecliptic, EquatorFromVector, GeoVector, MoonPhase, RotateVector, Rotation_EQJ_EQD, SiderealTime, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt, describeFortuneFact } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { heindelCalculationDate, heindelProgressionSegment, readHeindelPosition, heindelLinearContacts,
  heindelExampleActivations, heindelExampleLunationActivations, buildHeindelSourceContext, linkHeindelSaturnAngleTransits,
  linkHeindelTransits, heindelSourcePolicy, readHeindelNatalPower,
  readHeindelNatalPair } = await import('./control/heindel-source-context.ts');
const { progressionEpoch, readProgressionPosition } = await import('./control/western-progressions.ts');
const { anglesFromFrame } = await import('./control/western-houses.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/heindel-acd-reference.json',import.meta.url)));
const day=86400000, born=Date.parse(ref.birthAt), iso=at=>new Date(at).toISOString(), arc=x=>((x+180)%360+360)%360-180;
const window={start:Date.parse('1918-01-01T00:00:00Z'),end:Date.parse('1919-01-01T00:00:00Z')};
const bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
function equatorialDeclination(body, at) {
  const date = new Date(at);
  return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec;
}
function heindelDeclinationInSegment(body, segment) {
  const first = equatorialDeclination(body, segment.ephemerisStart);
  const last = equatorialDeclination(body, segment.ephemerisEnd);
  return first + (last - first) * segment.fraction;
}
function chart(birth=born){return {timeKnown:true,bazi:{rawResult:[]},ziwei:{rawResult:[]},western:{engineName:'astronomy-engine',engineVersion:'2.1.19',rulesetVersion:'tropical-whole-sign-v1',rawResult:[{
  julianDay:birth/day+2440587.5,ascendant:150,midheaven:60,sect:'day',positions:bodies.map(planet=>({planet,longitude:planet==='Sun'?SunPosition(new Date(birth)).elon:Ecliptic(GeoVector(Body[planet],new Date(birth),true)).elon})),
}]}};}
let calculation,source;
function realSource(){return source??=buildHeindelSourceContext(window,chart());}
function annualRun(birth, year, sourceTimeZone) {
  const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1, 12);
  const snapshot = chart(birth);
  const reference = { snapshotId: 'heindel-snapshot', chart: snapshot };
  if (sourceTimeZone) {
    snapshot.birthContext = archiveClock(birth, sourceTimeZone);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, reference)));
    return bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'heindel-run', reference);
  }
  return calculateFortuneFacts(input, buildFactTimeContext(input, now, 'server'), 'heindel-run', reference);
}
function realRun(){return calculation??=annualRun(born,1918);}
const rules=()=>fortuneKnowledge.western.rules.filter(r=>r.knowledgeId.includes('heindel'));
const rows=run=>run.facts.filter(f=>f.factType==='heindel_transit_context');
const directionType = 'heindel_direction_transit_overlap';
const observationType = 'heindel_transit_observation';
const directionMatch = run => matchFortuneKnowledge(run).byMethod.western.find(m => m.knowledgeId.endsWith('heindel-v1-progression-p001-001'));
const observationIds = ['heindel-v1-saturn-p001-001', 'heindel-v1-jupiter-p002-001',
  'heindel-v1-mercury-p001-001', 'heindel-v1-mercury-p002-001', 'heindel-v1-uranus-p001-001'];
const isObservation = id => observationIds.some(suffix => id.endsWith(suffix));
const archiveClock = (birthAt, timeZone) => ({
  precision: 'minute', clockVersion: 'gregory-iana-intl-v1', birthInstant: iso(birthAt), timeZone,
});

test('Fellowship real new moons activate independently verified Jupiter and Neptune transit bands', () => {
  const planetLongitude = (body, at) => body === 'Sun' ? SunPosition(new Date(at)).elon
    : Ecliptic(GeoVector(Body[body], new Date(at), true)).elon;
  const examples = [
    { birth: Date.UTC(1950, 3, 27, 12), year: 2027, instant: '2027-08-31T17:41:41.000Z',
      outer: 'Jupiter', target: 'Sun', aspect: 'trine', angle: 120, passage: 'heindel-v1-jupiter-p001-001' },
    { birth: Date.UTC(1950, 0, 1, 12), year: 2028, instant: '2028-03-26T04:31:58.000Z',
      outer: 'Neptune', target: 'Moon', aspect: 'sextile', angle: -60, passage: 'heindel-v1-neptune-p001-001' },
  ];
  for (const { birth, year, instant, outer, target, aspect, angle, passage } of examples) {
    const run = annualRun(birth, year, 'UTC');
    validateFortuneFacts(run);
    const rowFor = fact => {
      const p = fact.normalizedPayload;
      return p.fellowshipTransitLunationProfile === heindelSourcePolicy.fellowshipTransitLunationProfile
        && p.transitBody === outer && p.natalTargetId === target && p.aspectType === aspect;
    };
    const witness = rows(run).find(rowFor);
    assert.ok(witness, outer);
    const p = witness.normalizedPayload;
    assert.equal(witness.activeFrom, instant);
    assert.equal(witness.exactInstant, instant);
    const at = Date.parse(instant);
    assert.equal(witness.activeTo, iso(at + 1000));
    assert.ok(Math.abs(arc(MoonPhase(new Date(at)))) < 0.001);
    const centre = planetLongitude(target, birth) + angle;
    const transiting = planetLongitude(outer, at);
    const phase = planetLongitude('Sun', at);
    const proof = p.transitLunationActivation;
    for (const [field, expected] of [
      ['natalDeviation', Math.abs(arc(phase - centre))], ['transitDeviation', Math.abs(arc(transiting - centre))],
      ['phaseTransitDeviation', Math.abs(arc(phase - transiting))],
    ]) assert.ok(Math.abs(proof[field] - expected) < 0.002, field);
    assert.ok(proof.natalDeviation <= 3 && proof.transitDeviation > 0.1 && proof.transitDeviation <= 1.5
      && proof.phaseTransitDeviation <= 1.5);
    const newMoon = run.facts.find(fact => fact.factType === 'lunation_window' && fact.exactInstant === instant);
    assert.ok(newMoon?.sourceFactIds.every(id => witness.sourceFactIds.includes(id)));
    const monthProfile = heindelSourcePolicy.fellowshipTransitLunationMonthProfile;
    const month = rows(run).find(({ activeFrom, normalizedPayload: p }) => activeFrom === instant
      && p.fellowshipTransitLunationMonthProfile === monthProfile && p.transitBody === outer
      && p.natalTargetId === target && p.aspectType === aspect);
    assert.ok(month && newMoon.sourceFactIds.every(id => month.sourceFactIds.includes(id)));
    assert.equal(month.exactInstant, undefined);
    assert.ok(month.activeTo > witness.activeTo && month.activeTo <= newMoon.normalizedPayload.nextNewMoonAt);
    if (month.activeTo !== newMoon.normalizedPayload.nextNewMoonAt) {
      const distanceAt = time => Math.abs(arc(planetLongitude(outer, time) - centre));
      const boundary = Date.parse(month.activeTo);
      assert.ok(distanceAt(boundary - 1_000) <= 1.5 && distanceAt(boundary + 1_000) > 1.5);
    }
    const monthSubrun = { ...run, facts: [month] };
    const monthlyMatch = matchFortuneKnowledge(monthSubrun).byMethod.western.find(item => item.knowledgeId.endsWith(passage));
    assert.equal(monthlyMatch.status, 'matched');
    assert.deepEqual(monthlyMatch.windows, [{ start: month.activeFrom, endExclusive: month.activeTo }]);
    const monthlyInput = buildFortuneModelContext(monthSubrun, interpretFortune(monthSubrun, requestForFortuneRun(monthSubrun))).input;
    assert.match(formatFortunePrompt(monthlyInput), /提前离开强带时终止/u);
    assert.doesNotMatch(formatFortunePrompt(monthlyInput), /fellowshipTransitLunationMonthProfile|这一段取相邻两朔/u);
    assert.match(formatFortuneFactAudit(monthlyInput), /这一段取相邻两朔之间与连续实际行运带的交集/u);
    const ordinary = rows(run).find(row => row.normalizedPayload.transitBody === outer && row.normalizedPayload.natalTargetId === target
      && row.normalizedPayload.aspectType === aspect && row.activeFrom < instant && instant < row.activeTo && !rowFor(row));
    assert.ok(ordinary);
    if (outer === 'Jupiter') {
      assert.ok(!run.facts.some(f => f.factType === directionType && f.exactInstant === instant
        && f.normalizedPayload.directionKind === 'solar_fellowship_transit_lunation'));
      const earlierBirth = Date.UTC(1950, 3, 27, 2);
      const earlierLongitude = planetLongitude('Sun', earlierBirth);
      assert.ok(Math.abs(arc(transiting - earlierLongitude - angle)) > 1.5);
      assert.ok(Math.abs(arc(phase - earlierLongitude - angle)) <= 3);
      const transit = run.facts.find(f => f.factType === 'aspect_interval' && f.activeFrom <= instant && instant < f.activeTo
        && f.normalizedPayload.transitBody === outer && f.normalizedPayload.natalTargetId === target
        && f.normalizedPayload.aspectType === aspect);
      assert.ok(transit);
      const earlierChart = { ...chart(earlierBirth), birthContext: archiveClock(earlierBirth, 'UTC') };
      const earlier = buildHeindelSourceContext({ start: Date.parse(transit.activeFrom), end: Date.parse(transit.activeTo) }, earlierChart);
      const interval = { ...transit, normalizedPayload: { ...transit.normalizedPayload, natalLongitude: earlierLongitude } };
      const [link] = linkHeindelTransits(earlier, [interval]);
      assert.ok(link.natalTargetHasSupport && !link.natalTargetHasAffliction);
      assert.ok(link.lunations.some(newMoon => newMoon.at === at));
      assert.deepEqual(link.transitLunationActivations, []);
    }
    const query = evaluateFortuneRules('western', 'year', [witness, ordinary]).find(rule => rule.knowledgeId.endsWith(passage))
      .confirmations.find(branch => JSON.parse(branch.condition).where.fellowshipTransitLunationProfile === heindelSourcePolicy.fellowshipTransitLunationProfile);
    assert.deepEqual(query.hits, [witness]);
    const scoped = { ...run, facts: [witness] };
    const match = matchFortuneKnowledge(scoped).byMethod.western.find(item => item.knowledgeId.endsWith(passage));
    assert.equal(match.status, 'matched');
    assert.ok(match.sourceFactIds.includes(witness.factId));
    assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-transit-lunation'));
    const audit = /实际新月同时触及同一本命方向/u;
    assert.match(formatFortuneFactAudit(input), audit);
    const prompt = formatFortunePrompt(input);
    assert.ok(query.sourceConditions.every(condition => prompt.includes(condition)));
    assert.doesNotMatch(prompt, audit);
    assert.doesNotMatch(prompt, /transitLunationActivation|phaseTransitDeviation|fellowshipTransitLunationProfile|17:41:41|04:31:58/u);
  }
});

test('Fellowship retains a December lunation in the new year only within the same continuous transit band', () => {
  const birth = Date.UTC(1940, 1, 15), year = 2020;
  const run = annualRun(birth, year, 'UTC');
  validateFortuneFacts(run);
  const at = Date.parse('2019-12-26T05:13:45.000Z'), viewStart = '2020-01-01T00:00:00.000Z';
  const profile = heindelSourcePolicy.fellowshipTransitLunationMonthProfile;
  const witness = rows(run).find(({ activeFrom, normalizedPayload: p }) => activeFrom === viewStart
    && p.fellowshipTransitLunationMonthProfile === profile && p.lunationStartsBeforeWindow
    && p.transitBody === 'Jupiter' && p.natalTargetId === 'Mercury' && p.aspectType === 'sextile');
  assert.ok(witness);
  const lunation = run.facts.find(fact => fact.factType === 'lunation_window'
    && fact.normalizedPayload.newMoonAt === iso(at));
  assert.ok(lunation?.sourceFactIds.every(id => witness.sourceFactIds.includes(id)));
  assert.ok(witness.activeTo > viewStart && witness.activeTo <= '2020-01-24T21:42:38.000Z');
  assert.equal(lunation.exactInstant, undefined);
  assert.equal(witness.exactInstant, undefined);
  const longitude = (body, time) => Ecliptic(GeoVector(Body[body], new Date(time), true)).elon;
  const centre = longitude('Mercury', birth) - 60;
  assert.ok(Math.abs(arc(MoonPhase(new Date(at)))) < 0.001);
  assert.ok(Math.abs(arc(longitude('Jupiter', at) - centre)) < 1.5);
  assert.ok(Math.abs(arc(longitude('Jupiter', Date.parse(viewStart)) - centre)) < 1.5);
  const isolated = { ...run, facts: [witness] };
  const result = matchFortuneKnowledge(isolated).byMethod.western.find(row => row.knowledgeId.endsWith('heindel-v1-jupiter-p001-001'));
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: viewStart, endExclusive: witness.activeTo }]);
});

test('Fellowship corroborates a separate active solar direction at the actual Jupiter and new moon contact', () => {
  const birth = Date.parse('1952-10-27T16:21:20.454Z');
  const run = annualRun(birth, 2025, 'UTC');
  validateFortuneFacts(run);
  const instant = '2025-06-25T10:32:08.000Z', at = Date.parse(instant);
  const interval = run.facts.filter(f => f.factType === directionType && f.activeFrom <= instant && instant < f.activeTo);
  const witness = interval.find(f => f.normalizedPayload.directionKind === 'solar_fellowship_transit_lunation');
  assert.ok(witness);
  const p = witness.normalizedPayload;
  assert.deepEqual([p.progressedBody, p.directionNatalTargetId, p.directionAspectType, p.natureRelation, p.allowedOrb],
    ['Sun', 'Jupiter', 'trine', 'akin', 1.5]);
  assert.deepEqual([p.transitBody, p.natalTargetId, p.aspectType], ['Jupiter', 'Sun', 'trine']);
  assert.deepEqual([witness.activeFrom, witness.exactInstant, witness.activeTo], [instant, instant, iso(at + 1000)]);
  const untriggeredBand = interval.find(f => f.normalizedPayload.directionKind === 'solar_band'
    && f.normalizedPayload.transitBody === 'Jupiter' && f.normalizedPayload.directionAspectType === 'trine');
  assert.ok(untriggeredBand);
  assert.ok(untriggeredBand.activeFrom < instant && witness.activeTo < untriggeredBand.activeTo);
  const slowJupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
  const natalSun = SunPosition(new Date(birth)).elon;
  const natalJupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(birth), true)).elon;
  const clock = heindelCalculationDate(birth, archiveClock(birth, 'UTC'));
  const segment = heindelProgressionSegment(clock, at);
  const phase = SunPosition(new Date(at)).elon;
  const first = SunPosition(new Date(segment.ephemerisStart)).elon, second = SunPosition(new Date(segment.ephemerisEnd)).elon;
  const progressedSun = first + segment.fraction * arc(second - first);
  assert.ok(Math.abs(Math.abs(arc(progressedSun - natalJupiter)) - 120) < 1.5);
  assert.ok(Math.abs(arc(slowJupiter - natalSun + 120)) < 1.5);
  assert.ok(Math.abs(arc(phase - slowJupiter)) < 1.5 && Math.abs(arc(MoonPhase(new Date(at)))) < 0.001);
  const newMoon = run.facts.find(fact => fact.factType === 'lunation_window' && fact.exactInstant === instant);
  assert.ok(newMoon?.sourceFactIds.every(id => witness.sourceFactIds.includes(id)));

  const query = evaluateFortuneRules('western', 'year', [witness, untriggeredBand])
    .find(rule => rule.knowledgeId.endsWith('heindel-v1-progression-p001-001')).confirmations
    .find(branch => JSON.parse(branch.condition).where.directionKind === 'solar_fellowship_transit_lunation');
  assert.deepEqual(query.hits, [witness]);
  const scoped = { ...run, facts: [witness] };
  const match = directionMatch(scoped);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: witness.activeFrom, endExclusive: witness.activeTo }]);
  const month = interval.find(({ normalizedPayload: p }) => p.directionKind === 'solar_fellowship_transit_lunation_month'
    && p.fellowshipTransitLunationMonthProfile === heindelSourcePolicy.fellowshipTransitLunationMonthProfile);
  assert.ok(month && month.activeFrom === instant && month.activeTo > witness.activeTo);
  assert.equal(month.exactInstant, undefined);
  const strong = rows(run).find(({ activeFrom, activeTo, normalizedPayload: p }) =>
    p.fellowshipJupiterTransitBandProfile === heindelSourcePolicy.fellowshipJupiterTransitBandProfile
    && p.natalTargetId === 'Sun' && p.aspectType === 'trine' && activeFrom <= instant && instant < activeTo);
  assert.ok(strong);
  assert.equal(month.activeTo, [newMoon.normalizedPayload.nextNewMoonAt, strong.activeTo, untriggeredBand.activeTo].sort()[0]);
  const monthMatch = directionMatch({ ...run, facts: [month] });
  assert.equal(monthMatch.status, 'matched');
  assert.deepEqual(monthMatch.windows, [{ start: month.activeFrom, endExclusive: month.activeTo }]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-separate-direction-lunation'));
  const audit = /木星对本命太阳的[^。]+与次限太阳对本命木星的[^。]+同段有效/u;
  assert.match(formatFortuneFactAudit(input), audit);
  const provider = formatFortunePrompt(input);
  assert.ok(query.sourceConditions.every(condition => provider.includes(condition)));
  assert.doesNotMatch(provider, audit);
  assert.doesNotMatch(provider, /solar_fellowship_transit_lunation|phaseTransitDeviation|fellowshipTransitLunationProfile|10:32:08/u);
});

test('both Fellowship transcription ACD examples and all seven printed noon/year pairs retain their base year',()=>{
  for(const e of ref.calculationDates)assert.equal(iso(heindelCalculationDate(Date.parse(e.birthAt)).adjustedAt).slice(0,10),e.adjustedDate);
  const clock=heindelCalculationDate(born);
  for(const [a,e]of ref.annualNoonPairs){
    // The earliest ACD precedes birth: inspect its first later annual pair instead.
    if(Date.parse(a+'T12:00:00Z')<born){assert.equal(iso(clock.baseNoon).slice(0,10),e);continue;}
    const s=heindelProgressionSegment(clock,Date.parse(a+'T12:00:00Z'));
    assert.equal(iso(s.ephemerisStart).slice(0,10),e);assert.equal(s.fraction,0);
  }
  const noon=Date.parse('2000-02-29T12:00:00Z'),c=heindelCalculationDate(noon);
  assert.equal(c.adjustedAt,noon);assert.equal(heindelProgressionSegment(c,Date.parse('2001-02-28T12:00:00Z')).ephemerisStart,noon+day);
  assert.deepEqual(c.printedMinuteComparison, {
    targetSiderealMinute: Math.round(SiderealTime(new Date(noon)) * 60) % 1440, residualMinutes: 0,
    dates: [{ adjustedAt: noon, siderealMinute: Math.round(SiderealTime(new Date(noon)) * 60) % 1440 }],
    includesPreciseDate: true,
  });
  assert.throws(()=>heindelCalculationDate(NaN));assert.throws(()=>heindelProgressionSegment(c,noon-1));
});

test('the 1918 edition ACD and printed 1902 noon positions keep the real anniversary even when the later-birth illustration differs', () => {
  // 1918 third edition, pp. 473–475 and 477. Longitude supplies 4 minutes per degree.
  const birthAt = Date.UTC(1872, 3, 25, 13, 30) + 80 * 4 * 60_000;
  assert.equal(iso(birthAt), '1872-04-25T18:50:00.000Z');
  const noon = Date.UTC(1872, 3, 25, 12);
  const anchor = Date.UTC(1902, 0, 12, 12);
  const printSidereal = (hours, minutes) => 15 * (hours + minutes / 60);
  assert.equal(noon + day - birthAt, (17 * 60 + 10) * 60_000);
  assert.equal(printSidereal(2, 15) + printSidereal(17, 10), printSidereal(19, 25));
  for (const clock of [heindelCalculationDate(birthAt), heindelCalculationDate(birthAt, archiveClock(birthAt, 'America/New_York'))]) {
    assert.equal(iso(clock.adjustedAt), '1872-01-12T12:00:00.000Z');
    assert.equal(clock.baseNoon, noon);
    assert.equal(clock.sourceClockVerified, false);
    const before = heindelProgressionSegment(clock, anchor - 1);
    const segment = heindelProgressionSegment(clock, anchor);
    assert.equal(iso(before.ephemerisStart), '1872-05-24T12:00:00.000Z');
    assert.equal(before.end, anchor);
    assert.equal(iso(segment.ephemerisStart), '1872-05-25T12:00:00.000Z');
    assert.equal(segment.start, anchor);
    assert.equal(segment.fraction, 0);
    assert.equal(iso(heindelProgressionSegment(clock, Date.UTC(1909, 0, 12, 12)).ephemerisStart), '1872-06-01T12:00:00.000Z');
    for (const [body, printed] of [['Sun', 64 + 31 / 60], ['Moon', 279 + 27 / 60]]) {
      assert.ok(Math.abs(arc(readHeindelPosition(clock, body, anchor) - printed)) < ref.positionToleranceDegrees, body);
    }
  }

  // The main printed example calls Jan. 12 at 19:26. Our modern simulation
  // rounded to the same table precision still finds Jan. 12 at 19:25.
  assert.deepEqual(heindelCalculationDate(birthAt).printedMinuteComparison, {
    targetSiderealMinute: 19 * 60 + 25, residualMinutes: 0,
    dates: [{ adjustedAt: Date.UTC(1872, 0, 12, 12), siderealMinute: 19 * 60 + 25 }],
    includesPreciseDate: true,
  });

  // The printed two-hour-later example lists Dec. 12. Rounded modern
  // table values tie, while the precise noon search selects Dec. 13.
  const laterBirth = birthAt + 2 * 3_600_000;
  const later = heindelCalculationDate(laterBirth);
  const printedDate = Date.UTC(1871, 11, 12, 12);
  assert.equal(later.adjustedAt - printedDate, day);
  assert.equal(later.baseNoon, noon);
  const expected = SiderealTime(new Date(noon)) * 15 + (noon + day - laterBirth) / day * 360;
  const residual = at => Math.abs(arc(SiderealTime(new Date(at)) * 15 - expected));
  assert.ok(residual(later.adjustedAt) < residual(printedDate));
  assert.ok(residual(later.adjustedAt) < residual(later.adjustedAt + day));
  assert.equal(later.sourceClockVerified, false);
  assert.deepEqual(later.printedMinuteComparison, {
    targetSiderealMinute: 17 * 60 + 25, residualMinutes: 2,
    dates: [
      { adjustedAt: printedDate, siderealMinute: 17 * 60 + 23 },
      { adjustedAt: later.adjustedAt, siderealMinute: 17 * 60 + 27 },
    ],
    includesPreciseDate: true,
  });
  assert.deepEqual(heindelCalculationDate(laterBirth - 60_000).printedMinuteComparison.dates.map(row => row.adjustedAt),
    [later.adjustedAt]);
  assert.deepEqual(heindelCalculationDate(laterBirth + 60_000).printedMinuteComparison.dates.map(row => row.adjustedAt),
    [printedDate]);

  const anniversary = Date.UTC(1902, 11, 12, 12);
  const preciseSegment = heindelProgressionSegment(later, anniversary);
  const alternateSegment = heindelProgressionSegment({ ...later, adjustedAt: printedDate }, anniversary);
  assert.equal(iso(preciseSegment.ephemerisStart), '1872-05-25T12:00:00.000Z');
  assert.equal(iso(alternateSegment.ephemerisStart), '1872-05-26T12:00:00.000Z');
  assert.equal(preciseSegment.end, anniversary + day);
  assert.equal(alternateSegment.start, anniversary);
});

test('printed-minute ACD disagreement submits only relative evidence and stays local to the audit', () => {
  const birth = Date.UTC(1872, 3, 25, 20, 50);
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 1902 } };
  const asOf = Date.UTC(1902, 11, 12, 12);
  const snapshotId = 'heindel-printed-minute-comparison';
  const reference = { snapshotId, chart: { ...chart(birth), birthContext: archiveClock(birth, 'America/New_York') } };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const context = batch.facts.find(fact => fact.factType === 'heindel_progression_context');
  assert.ok(context);
  const evidence = { residualMinutes: 2, includesPreciseDate: true, dayOffsets: [-1, 0] };
  assert.deepEqual(context.normalizedPayload.printedMinuteComparison, evidence);
  assert.equal(context.normalizedPayload.sourceClockVerified, false);
  assert.doesNotMatch(JSON.stringify(context), /1871-12-1[23]|birthInstant|baseNoon|adjustedAt|targetSiderealMinute|America\/New_York/u);

  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), snapshotId, reference);
  validateFortuneFacts(run);
  assert.deepEqual(run.facts.find(fact => fact.factType === 'heindel_progression_context').normalizedPayload.printedMinuteComparison, evidence);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), snapshotId));
  const audit = formatFortuneFactAudit(input);
  assert.ok(audit.includes('按原书时分表精度复算'));
  assert.ok(audit.includes('提前1天、同日'));
  assert.doesNotMatch(formatFortunePrompt(input), /printedMinuteComparison|按原书时分表精度复算|1871-12-1[23]/u);
});

test('six printed Sun/Moon positions agree within declared historical rounding, with actual endpoint interpolation distinct from generic birthday progression',()=>{
  const clock=heindelCalculationDate(born);
  for(const row of ref.printedPositions)assert.ok(Math.abs(arc(readHeindelPosition(clock,row.body,Date.parse(row.at))-row.longitude))<ref.positionToleranceDegrees,JSON.stringify(row));
  const at=Date.parse('1918-06-01T12:00:00Z'),s=heindelProgressionSegment(clock,at);
  const first=readProgressionPosition('Moon',s.ephemerisStart,born).longitude,last=readProgressionPosition('Moon',s.ephemerisEnd,born).longitude;
  assert.ok(Math.abs(arc(readHeindelPosition(clock,'Moon',at)-(first+arc(last-first)*s.fraction)))<1e-10);
  assert.ok(Math.abs(arc(readHeindelPosition(clock,'Moon',at)-readProgressionPosition('Moon',progressionEpoch(born,at),born).longitude))>0.01);
});

test('the archive birthday selects the prior or next GMT half-day, including across New Year', () => {
  for (const [gmt, zone, birthday, direction] of [
    ['1990-12-31T20:00:00Z', 'Asia/Shanghai', '1991-01-01', 1],
    ['1991-01-01T04:00:00Z', 'America/Los_Angeles', '1990-12-31', -1],
  ]) {
    const birthAt = Date.parse(gmt);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, zone));
    assert.equal(clock.dateBasis, 'archive-local-birthday');
    assert.equal(iso(clock.baseNoon), birthday + 'T12:00:00.000Z');
    assert.equal(Math.sign(clock.adjustedAt - clock.baseNoon), direction);
    assert.ok(Math.abs(clock.adjustedAt - clock.baseNoon) > 180 * day);
    assert.ok(clock.siderealResidualDegrees < 0.51);
    const firstUsableAnchor = new Date(clock.adjustedAt);
    if (direction === -1) firstUsableAnchor.setUTCFullYear(firstUsableAnchor.getUTCFullYear() + 1);
    assert.equal(heindelProgressionSegment(clock, firstUsableAnchor.getTime()).ephemerisStart, clock.baseNoon + (direction === 1 ? 0 : day));
    const fallback = heindelCalculationDate(birthAt);
    assert.equal(Math.sign(fallback.adjustedAt - fallback.baseNoon), -direction);
  }
});

test('noon comparison stays in the specified sidereal cycle, and invalid archive clocks keep the UTC basis', () => {
  const noon = Date.parse('2001-01-01T12:00:00Z');
  for (const offset of [-1000, 0, 1000]) {
    const birthAt = noon + offset;
    assert.equal(heindelCalculationDate(birthAt, archiveClock(birthAt, 'Asia/Shanghai')).adjustedAt, noon);
  }
  for (const clock of [archiveClock(noon + day, 'Asia/Shanghai'), archiveClock(noon, 'invalid'),
    archiveClock(noon, '+08:00'), { ...archiveClock(noon, 'Asia/Shanghai'), precision: 'day' },
    archiveClock(noon, 'Pacific/Kiritimati')]) {
    assert.deepEqual(heindelCalculationDate(noon, clock), heindelCalculationDate(noon));
  }
});

test('linear contacts handle zodiac wrap, exact half-open endpoints, constant equality and source solar band boundaries without inventing lunar orbs',()=>{
  const w={start:0,end:day};
  const exact=heindelLinearContacts(w,359,1,0,0).find(r=>r.aspectType==='conjunction');assert.deepEqual(exact.exactTimes,[day/2]);
  assert.equal(heindelLinearContacts(w,359,1,1,0).length,0);
  assert.equal(heindelLinearContacts(w,359,1,359,0)[0].start,0);
  assert.equal(heindelLinearContacts(w,0,0,0,0).length,0);
  const band=heindelLinearContacts(w,357,3,0,1.5)[0];assert.equal(band.start,day/4);assert.equal(band.end,day*3/4);assert.deepEqual(band.exactTimes,[day/2]);
  const stationary=heindelLinearContacts(w,359,359,0,1.5)[0];assert.equal(stationary.start,0);assert.equal(stationary.end,day);assert.deepEqual(stationary.exactTimes,[]);
  assert.throws(()=>heindelLinearContacts(w,0,2,0,-1));assert.throws(()=>heindelLinearContacts({start:0,end:0},0,2,0,1.5));
});

test('only the two source examples admit lunar type/target combinations, never a generic hard/soft or same-time classifier',()=>{
  const solar=(target,aspect)=>({start:0,end:10,progressedBody:'Sun',natalTargetId:target,aspectType:aspect});
  const lunar=(target,aspect,at=5)=>({start:at,end:at,progressedBody:'Moon',natalTargetId:target,aspectType:aspect});
  const bad=solar('Saturn','square'),good=solar('Jupiter','trine');
  for(const target of ['Sun','Saturn'])for(const aspect of ['conjunction','square','opposition'])assert.equal(heindelExampleActivations([bad],[lunar(target,aspect)]).length,1);
  for(const target of ['Sun','Jupiter'])for(const aspect of ['sextile','trine'])assert.equal(heindelExampleActivations([good],[lunar(target,aspect)]).length,1);
  for(const point of [lunar('Saturn','trine'),lunar('Venus','square'),lunar('Sun','square',10)])assert.equal(heindelExampleActivations([bad],[point]).length,0);
  assert.equal(heindelExampleActivations([good],[lunar('Sun','conjunction')]).length,0);
  assert.equal(heindelExampleActivations([solar('Venus','trine')],[lunar('Venus','trine')]).length,0);
});

test('an exact progressed Moon activates a qualified solar direction inside the actual same-nature transit', () => {
  const year = 2026;
  const at = '2026-12-10T09:25:38.970Z';
  const birth = Date.parse('1923-10-01T12:00:00Z');
  const run = annualRun(birth, year, 'UTC');
  validateFortuneFacts(run);
  const kind = 'solar_lunar_direction_activation';
  const activation = run.facts.find(row => row.factType === directionType
    && row.normalizedPayload.directionKind === kind && row.exactInstant === at);
  assert.ok(activation);
  const p = activation.normalizedPayload;
  assert.deepEqual(p.lunarDirectionActivation, { at, natalTargetId: 'Sun', aspectType: 'opposition' });
  assert.deepEqual([p.natureRelation, p.transitNature, p.directionNature], ['akin', 'adverse', 'adverse']);
  assert.deepEqual([p.transitBody, p.natalTargetId, p.aspectType], ['Saturn', 'Sun', 'opposition']);
  assert.deepEqual([p.progressedBody, p.directionNatalTargetId, p.directionAspectType], ['Sun', 'Saturn', 'square']);
  assert.equal(Date.parse(activation.activeTo) - Date.parse(activation.activeFrom), 1);
  const verifyStrongOverlap = (sample, fact, bornAt, planet, angle) => {
    const field = `fellowship${planet}TransitBandProfile`;
    assert.equal(fact.normalizedPayload[field], heindelSourcePolicy[field]);
    const natalSun = SunPosition(new Date(bornAt)).elon;
    const actual = Ecliptic(GeoVector(Body[planet], new Date(fact.exactInstant), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(actual - natalSun)) - angle) < 1.5);
    const matchAt = changes => directionMatch({ ...sample, facts: [{ ...fact,
      normalizedPayload: { ...fact.normalizedPayload, ...changes } }] });
    const checked = matchAt({});
    assert.equal(checked.status, 'matched');
    assert.deepEqual(checked.sourceFactIds, [fact.factId]);
    assert.match(checked.matchedConditions.join('\n'), /同学派一度半范围内/u);
    assert.deepEqual(checked.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    for (const changed of [{ [field]: undefined }, { dateBasis: 'UTC-birth-date-candidate' }, { natureRelation: 'different' }]) {
      assert.notEqual(matchAt(changed).status, 'matched');
    }
    return checked;
  };
  const observation = verifyStrongOverlap(run, activation, birth, 'Saturn', 180);
  const band = run.facts.find(row => row.factType === 'aspect_interval' && row.normalizedPayload.transitBody === 'Saturn'
    && row.normalizedPayload.natalTargetId === 'Sun' && row.normalizedPayload.aspectType === 'opposition'
    && row.activeFrom <= at && at < row.activeTo);
  assert.ok(band && band.sourceFactIds.every(id => activation.sourceFactIds.includes(id)));
  const window = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  const source = buildHeindelSourceContext(window, chart(birth));
  const [beforeBoundary] = linkHeindelTransits(source, [{ ...band, activeTo: at }]);
  assert.ok(!beforeBoundary.directionContacts.some(row => row.directionKind === kind));
  const wrongAspect = { ...band, normalizedPayload: { ...band.normalizedPayload, aspectType: 'trine' } };
  assert.ok(!linkHeindelTransits(source, [wrongAspect])[0].directionContacts.some(row => row.directionKind === kind));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'heindel-lunar-activation'));
  assert.ok(/次限月亮于.*精确形成对分相.*三层方向相符/u.test(formatFortuneFactAudit(input)));
  const prompt = formatFortunePrompt(input);
  assert.ok(prompt.includes(observation.matchedConditions[0]));
  assert.doesNotMatch(prompt, /三层方向相符|solar_lunar_direction_activation|2026-12-10T09:25/u);

  const mixedBirth = Date.parse('1957-03-10T12:00:00Z');
  const mixedRun = annualRun(mixedBirth, year);
  const mixedAt = '2026-01-09T12:12:26.241Z';
  const mixedSource = buildHeindelSourceContext(window, chart(mixedBirth));
  assert.ok(mixedSource.activations.some(row => row.at === Date.parse(mixedAt) && row.solarTarget === 'Jupiter'));
  assert.ok(mixedRun.facts.some(row => row.factType === 'aspect_interval' && row.normalizedPayload.transitBody === 'Jupiter'
    && row.normalizedPayload.natalTargetId === 'Sun' && row.normalizedPayload.aspectType === 'trine'
    && row.activeFrom <= mixedAt && mixedAt < row.activeTo));
  assert.ok(!mixedRun.facts.some(row => row.factType === directionType && row.normalizedPayload.directionKind === kind
    && row.exactInstant === mixedAt));

  const supportedBirth = Date.parse('1931-08-02T12:00:00Z');
  const supportedRun = annualRun(supportedBirth, 2046, 'UTC');
  const supportedAt = '2046-12-16T08:59:05.102Z';
  const supported = supportedRun.facts.find(row => row.factType === directionType && row.normalizedPayload.directionKind === kind
    && row.normalizedPayload.transitBody === 'Jupiter' && row.exactInstant === supportedAt);
  assert.ok(supported);
  assert.deepEqual(supported.normalizedPayload.lunarDirectionActivation, { at: supportedAt, natalTargetId: 'Sun', aspectType: 'sextile' });
  assert.deepEqual([supported.normalizedPayload.directionNature, supported.normalizedPayload.transitNature], ['favourable', 'favourable']);
  const supportedMatch = verifyStrongOverlap(supportedRun, supported, supportedBirth, 'Jupiter', 120);
  const supportedInput = buildFortuneModelContext(supportedRun,
    interpretFortune(supportedRun, requestForFortuneRun(supportedRun), 'heindel-lunar-activation-jupiter')).input;
  const supportedPrompt = formatFortunePrompt(supportedInput);
  assert.ok(supportedPrompt.includes(supportedMatch.matchedConditions[0]));
  assert.doesNotMatch(supportedPrompt, /三层方向相符|solar_lunar_direction_activation|2046-12-16T08:59/u);

  const outerBirth = Date.parse('1965-04-01T12:00:00Z');
  const outerRun = annualRun(outerBirth, year, 'UTC');
  const outerAt = '2026-10-29T05:37:43.897Z';
  const outer = outerRun.facts.find(row => row.factType === directionType && row.exactInstant === outerAt
    && row.normalizedPayload.directionKind === kind && row.normalizedPayload.transitBody === 'Saturn');
  assert.ok(outer);
  assert.equal(outer.normalizedPayload.natureRelation, 'akin');
  assert.equal(outer.normalizedPayload.fellowshipSaturnTransitBandProfile, undefined);
  const outerSaturn = Ecliptic(GeoVector(Body.Saturn, new Date(outerAt), true)).elon;
  assert.ok(Math.abs(arc(outerSaturn - SunPosition(new Date(outerBirth)).elon)) > 1.5);
  const isolatedOuter = { ...outerRun, facts: [outer] };
  assert.equal(directionMatch(isolatedOuter).status, 'partial');
  const outerInput = buildFortuneModelContext(isolatedOuter,
    interpretFortune(isolatedOuter, requestForFortuneRun(isolatedOuter), 'heindel-lunar-activation-outer-band')).input;
  assert.doesNotMatch(formatFortunePrompt(outerInput), /同学派一度半范围内|三层方向相符/u);
});

test('Heindel new moon activation verifies both original solar examples, the three-degree edge and actual transit overlap', () => {
  const squareSaturn = { start: 0, end: 10, progressedBody: 'Sun', natalTargetId: 'Saturn', aspectType: 'square' };
  const natal = [{ body: 'Saturn', longitude: 357 }, { body: 'Sun', longitude: 200 }, { body: 'Mars', longitude: 0 }];
  const edge = heindelExampleLunationActivations([squareSaturn], [
    { at: 0, longitude: 0 }, { at: 1, longitude: 0.0001 }, { at: 5, longitude: 57 }, { at: 10, longitude: 0 },
  ], natal);
  assert.deepEqual(edge, [{ at: 0, solarIndex: 0, natalTargetId: 'Saturn', aspectType: 'conjunction', deviation: 3, allowedOrb: 3 }]);

  for (const [birth, year, planet, directionAspect, target, activationAspect, at] of [
    ['1958-01-01T12:00:00Z', 2026, 'Saturn', 'square', 'Saturn', 'square', '2026-09-11T03:27:28.000Z'],
    ['1924-05-01T12:00:00Z', 2027, 'Jupiter', 'trine', 'Sun', 'trine', '2027-08-31T17:41:41.000Z'],
  ]) {
    const birthAt = Date.parse(birth);
    const run = annualRun(birthAt, year, 'UTC');
    const overlap = run.facts.find(row => row.factType === directionType && row.normalizedPayload.transitBody === planet
      && row.normalizedPayload.natalTargetId === 'Sun' && row.normalizedPayload.aspectType === directionAspect
      && row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.directionNatalTargetId === planet
      && row.normalizedPayload.directionAspectType === directionAspect && row.activeFrom < at && at < row.activeTo);
    assert.ok(overlap, birth);
    assert.equal(overlap.normalizedPayload.lunationActivationProfile, heindelSourcePolicy.lunationActivationProfile);
    assert.equal(overlap.normalizedPayload.hasLunationActivation, true);
    const witness = overlap.normalizedPayload.lunationActivations.find(point => point.at === at
      && point.natalTargetId === target && point.aspectType === activationAspect);
    assert.ok(witness, birth);
    assert.equal(witness.allowedOrb, 3);
    const newMoon = SunPosition(new Date(at)).elon;
    const natalLongitude = run.facts.find(row => row.factType === 'natal_position'
      && row.normalizedPayload.body === target).normalizedPayload.longitude;
    const deviation = Math.abs(Math.abs(arc(newMoon - natalLongitude)) - (activationAspect === 'square' ? 90 : 120));
    assert.ok(Math.abs(witness.deviation - deviation) < 1e-7 && deviation < 3);
    assert.ok(directionMatch({ ...run, facts: [overlap] }).sourceFactIds.includes(overlap.factId));

    const transit = run.facts.find(row => row.factType === 'aspect_interval' && row.normalizedPayload.transitBody === planet
      && row.normalizedPayload.natalTargetId === 'Sun' && row.normalizedPayload.aspectType === directionAspect
      && row.activeFrom <= overlap.activeFrom && overlap.activeTo <= row.activeTo);
    assert.ok(transit, birth);
    const source = buildHeindelSourceContext({ start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) }, chart(birthAt));
    const [trimmed] = linkHeindelTransits(source, [{ ...transit, activeTo: at }]);
    const earlier = trimmed.directionContacts.find(direction => direction.progressedBody === 'Sun'
      && direction.natalTargetId === planet && direction.aspectType === directionAspect);
    assert.ok(earlier, birth);
    assert.ok(earlier.lunationActivations.every(point => point.at < Date.parse(at)));

    if (planet === 'Saturn') {
      const point = run.facts.find(row => row.factType === directionType && row.exactInstant === at
        && row.normalizedPayload.directionKind === 'solar_lunation_activation' && row.normalizedPayload.natalTargetId === 'Saturn');
      assert.ok(point);
      assert.equal(point.normalizedPayload.natalSaturnAfflicted, true);
      const isolated = { ...run, facts: run.facts.filter(row => row.factType !== directionType || row === point) };
      const matched = directionMatch(isolated);
      assert.equal(matched.status, 'matched');
      assert.deepEqual(matched.windows, [{ start: at, endExclusive: iso(Date.parse(at) + 1000) }]);
      for (const changes of [{ natalSaturnAfflicted: false }, { natalTargetId: 'Sun' }, { dateBasis: 'UTC-birth-date-candidate' }]) {
        const different = { ...point, normalizedPayload: { ...point.normalizedPayload, ...changes } };
        assert.equal(directionMatch({ ...isolated, facts: [different] }).status, 'partial');
      }
      const { input } = buildFortuneModelContext(isolated,
        interpretFortune(isolated, requestForFortuneRun(isolated), 'heindel-snapshot'));
      const provider = formatFortunePrompt(input);
      assert.match(provider, /实际日月合朔在原书三度范围内触及同一本命土星/u);
      assert.doesNotMatch(provider, /实际土星精确经过同一角点|2026-09-11T03:27:28|natalSaturnAfflicted/u);
    }
    if (planet === 'Jupiter') {
      const independentAt = '2027-02-06T15:56:47.000Z';
      const independent = run.facts.find(row => row.factType === directionType && row.exactInstant === independentAt
        && row.normalizedPayload.directionKind === 'solar_lunation_activation');
      assert.ok(independent);
      assert.deepEqual([independent.normalizedPayload.natalTargetId, independent.normalizedPayload.aspectType,
        independent.normalizedPayload.directionNatalTargetId, independent.normalizedPayload.directionAspectType],
        ['Jupiter', 'sextile', 'Jupiter', 'trine']);
      assert.ok(!run.facts.some(row => row.factType === directionType && row.normalizedPayload.directionKind !== 'solar_lunation_activation'
        && row.activeFrom <= independentAt && independentAt < row.activeTo && row.normalizedPayload.directionNatalTargetId === planet
        && row.normalizedPayload.directionAspectType === directionAspect));
      const isolated = { ...run, facts: run.facts.filter(row => row.factType !== directionType || row === independent) };
      assert.equal(directionMatch(isolated).status, 'partial');
      assert.deepEqual(directionMatch(isolated).sourceFactIds, [independent.factId]);
      const rejected = { ...independent, normalizedPayload: { ...independent.normalizedPayload, hasLunationActivation: false } };
      assert.equal(directionMatch({ ...isolated, facts: isolated.facts.map(row => row === independent ? rejected : row) }).status, 'not_matched');
      const { input } = buildFortuneModelContext(isolated,
        interpretFortune(isolated, requestForFortuneRun(isolated), 'heindel-snapshot'));
      assert.match(formatFortuneFactAudit(input), /原书在这两种次限日例中把真实朔当作独立行运引动/u);
      assert.doesNotMatch(formatFortunePrompt(input), /原书在这两种次限日例中把真实朔当作独立行运引动|2027-02-06T15:56:47|heindel-natal-lunation-3-degree-v1/u);
      const nearMiss = source.lunations.find(point => iso(point.at).startsWith('2027-01-07'));
      const band = source.solar.find(b => b.natalTargetId === 'Jupiter' && b.aspectType === 'trine');
      assert.ok(nearMiss && band.start <= nearMiss.at && nearMiss.at < band.end);
      for (const { separation } of nearMiss.natalSeparations.filter(row => ['Sun', 'Jupiter'].includes(row.body))) {
        assert.ok(Math.abs(separation - 60) > 3 && Math.abs(separation - 120) > 3);
      }
      assert.ok(!run.facts.some(row => row.factType === directionType && row.normalizedPayload.directionKind === 'solar_lunation_activation'
        && row.exactInstant === iso(nearMiss.at) && row.normalizedPayload.directionNatalTargetId === planet));
    }
  }
});

test('actual source intervals and lunar roots agree with independent archived natal coordinates; missing, mixed or unknown birth never manufactures a source clock',()=>{
  const s=realSource();assert.equal(s.status,'ready');assert.equal(s.natalPairs.length,36);assert.equal(s.progressed.length,5);
  assert.equal(s.clock.sourceClockVerified,false);assert.equal(s.lunations.length,12);
  assert.ok(s.solar.some(b=>b.natalTargetId==='Saturn'&&b.aspectType==='conjunction'));
  assert.ok(s.lunar.some(b=>b.natalTargetId==='Sun'&&b.aspectType==='square'));
  for(const b of [...s.solar,...s.lunar,...s.planetary]){
    const target=s.natal.find(n=>n.body===b.natalTargetId);
    for(const at of b.exactTimes){assert.ok(window.start<=at&&at<window.end);
      assert.ok(Math.abs(Math.abs(arc(readHeindelPosition(s.clock,b.progressedBody,at)-target.longitude))-b.exactAngle)<1e-7);}
    if(b.progressedBody==='Sun')assert.ok(Math.abs(Math.abs(arc(readHeindelPosition(s.clock,'Sun',(b.start+b.end)/2)-target.longitude))-b.exactAngle)<=1.5);
  }
  const unknown=chart();unknown.timeKnown=false;assert.equal(buildHeindelSourceContext(window,unknown).status,'uncertain');
  const mixed=chart();mixed.western.rawResult.push(mixed.western.rawResult[0]);assert.equal(buildHeindelSourceContext(window,mixed).status,'uncertain');
  const bad=chart();bad.western.rawResult[0].positions[0].longitude+=1;assert.equal(buildHeindelSourceContext(window,bad).status,'inconsistent_natal');
  assert.equal(buildHeindelSourceContext({start:born-1,end:born+day},chart()).status,'before_birth');
});

test('the chapter 18 table keeps dual Mercury dignities and binds the two natal positions to a real transit', () => {
  const virgo = readHeindelNatalPower('Mercury', 167);
  const pisces = readHeindelNatalPower('Mercury', 337);
  assert.deepEqual([virgo.domicile, virgo.exaltationSign, virgo.detriment, virgo.fallSign], [true, true, false, false]);
  assert.deepEqual([pisces.domicile, pisces.exaltationSign, pisces.detriment, pisces.fallSign], [false, false, true, true]);
  assert.equal(readHeindelNatalPower('Neptune', 90).exaltationSign, true);
  assert.equal(readHeindelNatalPower('Neptune', 270).fallSign, true);
  assert.throws(() => readHeindelNatalPower('Sun', NaN));
  const target = rows(realRun()).find(row => row.normalizedPayload.natalTargetId === 'Mercury').normalizedPayload;
  assert.equal(target.natalWitnessProfile, heindelSourcePolicy.natalWitnessProfile);
  const s = realSource();
  assert.deepEqual(target.natalPowers, [s.natal.find(row => row.body === 'Mercury'), s.natal.find(row => row.body === target.transitBody)]);
  const offset = arc(s.natal.find(row => row.body === 'Mercury').longitude - s.natal.find(row => row.body === 'Sun').longitude);
  assert.deepEqual(target.mercuryToSun, { offset, withinThreeDegrees: Math.abs(offset) < 3 });
});

test('Heindel natal aspects retain six degrees, opposite declination hemispheres and the affected endpoint', () => {
  const body = (body, longitude, declination) => ({ body, longitude, declination });
  const contact = (first, second, aspect) => readHeindelNatalPair(first, second).contacts.find(row => row.aspectType === aspect);
  const mercury = body('Mercury', 357, 10);
  assert.equal(contact(mercury, body('Jupiter', 63, 0), 'sextile').assessment, 'support');
  assert.equal(contact(mercury, body('Jupiter', 63.0001, 0), 'sextile'), undefined);
  assert.deepEqual(contact(mercury, body('Saturn', 3, -9), 'conjunction').affected, ['Mercury']);
  const standard = contact(mercury, body('Mars', 70, -11), 'parallel');
  assert.deepEqual([standard.band, standard.affected], ['standard', ['Mercury']]);
  assert.equal(contact(mercury, body('Mars', 70, -11.5), 'parallel').band, 'extended');
  assert.equal(contact(mercury, body('Mars', 70, -11.501), 'parallel'), undefined);
  assert.deepEqual(contact(mercury, body('Venus', 87, 0), 'square').affected, ['Mercury', 'Venus']);
  assert.equal(contact(mercury, body('Moon', 10, -10), 'parallel').assessment, 'undetermined');
});

test('matching reaches SQLite only for an overlapping same-pair solar band or an actual exact direction point', () => {
  for (const [date, progressedBody, transitBody, aspectType, directionKind] of [
    ['1980-04-06T12:00:00Z', 'Sun', 'Jupiter', 'square', 'solar_band'],
    ['1979-02-28T12:00:00Z', 'Moon', 'Neptune', 'conjunction', 'exact_point'],
    ['2007-12-07T12:00:00Z', 'Mercury', 'Saturn', 'trine', 'exact_point'],
  ]) {
    const run = annualRun(Date.parse(date), 2026);
    validateFortuneFacts(run);
    const fact = run.facts.find(row => row.factType === directionType && row.normalizedPayload.progressedBody === progressedBody
      && row.normalizedPayload.transitBody === transitBody && row.normalizedPayload.aspectType === aspectType
      && row.normalizedPayload.directionAspectType === aspectType);
    assert.ok(fact, date);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.natalTargetId, p.directionNatalTargetId, p.directionKind, p.sourceClockVerified], [progressedBody, transitBody, directionKind, false]);
    const transit = rows(run).find(row => row.normalizedPayload.kind === 'interval' && row.normalizedPayload.transitBody === transitBody
      && row.normalizedPayload.natalTargetId === progressedBody && row.normalizedPayload.aspectType === aspectType
      && row.activeFrom <= fact.activeFrom && fact.activeTo <= row.activeTo);
    assert.ok(transit);
    if (directionKind === 'solar_band') assert.equal(p.allowedOrb, 1.5);
    else {
      assert.equal(p.allowedOrb, 0);
      assert.deepEqual(p.exactTimes, [fact.exactInstant]);
      assert.equal(Date.parse(fact.activeTo) - Date.parse(fact.activeFrom), 1);
    }
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== directionType || row.factId === fact.factId) };
    const match = directionMatch(scoped);
    assert.equal(match.status, 'partial');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'same-pair'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /同一对星在此段出现相同的黄经相位/u);
    assert.doesNotMatch(prompt, /heindel_direction_transit_overlap|directionNatalTargetId/u);
  }
});

test('same-order Jupiter progression and transit use one exact source point and one natal Sun', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2025 } };
  const birth = Date.parse('1966-05-03T00:00:00Z'), now = Date.UTC(2025, 5, 1, 12);
  const archive = { snapshotId: 'heindel-jupiter-same-order', chart: chart(birth) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const fact = run.facts.find(({ factType, normalizedPayload: p }) => factType === directionType
    && p.progressedBody === 'Jupiter' && p.directionNatalTargetId === 'Sun'
    && p.transitBody === 'Jupiter' && p.natalTargetId === 'Sun' && p.aspectType === 'sextile' && p.directionAspectType === 'sextile');
  assert.ok(fact);
  assert.equal(fact.exactInstant, '2025-08-05T11:43:49.910Z');
  assert.equal(fact.normalizedPayload.allowedOrb, 0);
  const at = Date.parse(fact.exactInstant), sun = SunPosition(new Date(birth)).elon;
  const source = buildHeindelSourceContext({ start: Date.UTC(2025, 0, 1), end: Date.UTC(2026, 0, 1) }, archive.chart);
  const moving = readHeindelPosition(source.clock, 'Jupiter', at);
  assert.ok(Math.abs(Math.abs(arc(moving - sun)) - 60) < 0.00001);
  const transit = Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
  assert.ok(Math.abs(Math.abs(arc(transit - sun)) - 60) > 0.5);
  const sameTransit = rows(run).find(row => row.normalizedPayload.kind === 'interval'
    && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.natalTargetId === 'Sun'
    && row.normalizedPayload.aspectType === 'sextile' && row.activeFrom <= fact.activeFrom && fact.activeTo <= row.activeTo);
  assert.ok(sameTransit);
  assert.ok(directionMatch(run).sourceFactIds.includes(fact.factId));
  for (const change of [
    { natalTargetId: 'Moon' },
    { activeFrom: iso(at + 1) },
  ]) {
    const { activeFrom, ...payload } = change;
    const other = { ...sameTransit, activeFrom: activeFrom ?? sameTransit.activeFrom, factType: 'aspect_interval',
      normalizedPayload: { ...sameTransit.normalizedPayload, ...payload, zodiac: 'tropical', natalTargetType: 'planet' } };
    assert.ok(linkHeindelTransits(source, [other]).every(link => !link.directionContacts.some(direction =>
      direction.progressedBody === 'Jupiter' && direction.natalTargetId === 'Sun' && direction.start === at)));
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  assert.match(formatFortuneFactAudit(input), /真实行运木星与本命太阳为六合相；按Heindel调整日候选，推运木星对本命太阳为六合相/u);
  assert.doesNotMatch(formatFortunePrompt(input), /推运木星对本命太阳为六合相/u);
});

test('Heindel compares adverse solar and Saturn directions only where both reach the same checked angle', () => {
  const birth = Date.parse('1968-11-07T12:00:00Z'), at = Date.parse('2026-07-15T12:00:00Z');
  const targetYear = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
  const kind = 'solar_angle_transit_overlap';
  for (const [id, armc, axis, other] of [['ASC', 279.4, 'ascendant', 'MC'], ['MC', 13.5, 'midheaven', 'ASC']]) {
    const natal = { ...chart(birth), birthContext: archiveClock(birth, 'UTC') };
    const frame = anglesFromFrame(armc, 35, 23.44);
    Object.assign(natal.western.rawResult[0], frame);
    const reference = { snapshotId: `heindel-saturn-angle-${id}`, chart: natal };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, at), reference.snapshotId, reference);
    const row = run.facts.find(record => record.factType === directionType && record.normalizedPayload.directionKind === kind
      && record.normalizedPayload.natalTargetId === id && record.activeFrom <= iso(at) && iso(at) < record.activeTo);
    assert.ok(row, id);
    const p = row.normalizedPayload, direction = buildHeindelSourceContext(targetYear, natal);
    assert.deepEqual([p.transitBody, p.aspectType, p.progressedBody, p.directionNatalTargetId, p.directionAspectType,
      p.natureRelation, p.directionNature, p.transitNature, p.allowedOrb],
    ['Saturn', 'conjunction', 'Sun', id, 'square', 'akin', 'adverse', 'adverse', 1.5]);
    const transit = run.facts.find(record => record.factType === 'aspect_interval' && record.activeFrom <= iso(at) && iso(at) < record.activeTo
      && record.normalizedPayload.transitBody === 'Saturn' && record.normalizedPayload.natalTargetId === id
      && record.normalizedPayload.aspectType === 'conjunction');
    const band = direction.solarAngles.find(item => item.natalTargetId === id && item.start <= at && at < item.end);
    assert.ok(transit && band, id);
    assert.ok(transit.sourceFactIds.every(source => row.sourceFactIds.includes(source)), id);
    assert.deepEqual([row.activeFrom, row.activeTo], [iso(Math.max(band.start, Date.parse(transit.activeFrom))),
      iso(Math.min(band.end, Date.parse(transit.activeTo)))]);
    assert.ok(Math.abs(arc(Ecliptic(GeoVector(Body.Saturn, new Date(at), true)).elon - frame[axis])) < 0.04);
    assert.ok(Math.abs(Math.abs(arc(readHeindelPosition(direction.clock, 'Sun', at) - frame[axis])) - 90) < 1.5);
    const check = facts => directionMatch({ ...run, facts });
    assert.ok(check([row]).sourceFactIds.includes(row.factId));
    assert.equal(check([row]).status, 'partial');
    const exact = run.facts.find(record => record.factType === directionType
      && record.normalizedPayload.natalTargetId === id && record.normalizedPayload.exactSaturnPass === true);
    assert.ok(exact, id);
    const exactAt = Date.parse(exact.exactInstant);
    const actual = Ecliptic(GeoVector(Body.Saturn, new Date(exactAt), true)).elon;
    assert.ok(Math.abs(arc(actual - frame[axis])) < 0.00001, id);
    assert.ok(row.activeFrom <= exact.activeFrom && exact.activeTo <= row.activeTo);
    assert.equal(check([exact]).status, 'matched');
    const pass = run.facts.find(record => record.factType === 'aspect_exact' && record.exactInstant === exact.exactInstant
      && record.parentSignalId === transit.parentSignalId);
    assert.ok(pass, id);
    for (const changes of [{ parentSignalId: other }, { exactInstant: row.activeTo }]) {
      assert.ok(linkHeindelSaturnAngleTransits(direction, [transit, { ...pass, ...changes }])
        .every(link => !link.exactPasses.length), id);
    }
    for (const changes of [{ directionNatalTargetId: other }, { dateBasis: 'UTC-birth-date-candidate' }]) {
      assert.notEqual(check([{ ...exact, normalizedPayload: { ...exact.normalizedPayload, ...changes } }]).status, 'matched');
    }
    for (const changes of [{ directionNatalTargetId: other }, { natalTargetId: 'DSC' }, { aspectType: 'square' },
      { directionAspectType: 'trine' }, { angleOverlapProfile: 'other' }]) {
      assert.equal(check([{ ...row, normalizedPayload: { ...p, ...changes } }]).status, 'not_matched', id);
    }
    const wrongAngle = { ...transit, normalizedPayload: { ...transit.normalizedPayload, natalTargetId: other } };
    assert.deepEqual(linkHeindelSaturnAngleTransits(direction, [wrongAngle]), []);
    assert.deepEqual(linkHeindelSaturnAngleTransits(direction, [{ ...transit, activeFrom: iso(band.end), activeTo: iso(band.end + 1) }]), []);
    assert.deepEqual(linkHeindelSaturnAngleTransits({ ...direction, solarAngles: [] }, [transit]), []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId));
    const angle = id === 'ASC' ? '上升点' : '天顶';
    const wording = `按Heindel调整日，次限太阳对本命${angle}的四分相与实际土星合该点同段成立`;
    const audit = formatFortuneFactAudit(input);
    assert.ok(audit.includes(wording), id);
    assert.ok(audit.includes(`实际土星在所示时刻精确经过本命${angle}`), id);
    const provider = formatFortunePrompt(input);
    assert.ok(!provider.includes(wording), id);
    assert.match(provider, /实际土星精确经过同一角点/u);
    assert.doesNotMatch(provider, /solar_angle_transit_overlap|angleOverlapProfile|exactSaturnPass/u);
  }
});

test('a scanned year with transits but no matching direction stays distinct from a missing source scan', () => {
  const run = annualRun(born, 1916);
  assert.ok(rows(run).some(row => row.normalizedPayload.kind === 'interval'));
  const flags = run.facts.filter(row => row.factType === directionType).map(row => row.normalizedPayload.directionKind);
  assert.deepEqual(flags, ['no_overlap']);
  assert.equal(directionMatch(run).status, 'not_matched');
  assert.equal(directionMatch({ ...run, facts: run.facts.filter(row => row.factType !== directionType) }).status, 'unknown');
});

test('real Mercury and Saturn contacts distinguish all four directions within the motion-specific strong band', () => {
  const cases = [
    ['1987-08-09T12:00:00Z', '2026-03-13T21:23:20.535Z', 'sextile', 'trine', 'favourable', 'akin', 1.697634377, false],
    ['1975-12-03T12:00:00Z', '2026-05-29T15:34:52.705Z', 'opposition', 'trine', 'favourable', 'different', 1.219619667, true],
    ['1984-01-24T12:00:00Z', '2026-11-02T01:41:14.523Z', 'trine', 'square', 'adverse', 'different', 0.278041176, true],
    ['1995-06-22T12:00:00Z', '2026-05-09T20:16:46.499Z', 'trine', 'sextile', 'favourable', 'akin', 0.739499416, true],
    ['1936-09-04T12:00:00Z', '2026-10-24T11:18:53.849Z', 'square', 'opposition', 'adverse', 'akin', 1.057356228, true],
  ];
  const long = (body, when) => Ecliptic(GeoVector(Body[body], new Date(when), true)).elon;
  const angles = { sextile: 60, square: 90, trine: 120, opposition: 180 };
  for (const [birth, at, directionAspectType, aspectType, transitNature, natureRelation, deviation, inside] of cases) {
    const birthAt = Date.parse(birth), instant = Date.parse(at);
    const run = annualRun(birthAt, 2026, 'Europe/London');
    validateFortuneFacts(run);
    const fact = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && exactInstant === at && p.transitBody === 'Saturn' && p.natalTargetId === 'Mercury'
      && p.aspectType === aspectType && p.directionAspectType === directionAspectType);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.equal(p.transitNature, transitNature);
    assert.equal(p.natureRelation, natureRelation);
    assert.equal(p.fellowshipSaturnTransitBandProfile, inside ? heindelSourcePolicy.fellowshipSaturnTransitBandProfile : undefined);
    const calcDate = heindelCalculationDate(birthAt, archiveClock(birthAt, 'Europe/London'));
    const progressed = readHeindelPosition(calcDate, 'Mercury', instant);
    const direction = Math.abs(arc(progressed - long('Saturn', birthAt)));
    assert.ok(Math.abs(direction - angles[directionAspectType]) < 0.00001);
    const saturn = long('Saturn', instant), mercury = long('Mercury', birthAt);
    assert.ok(Math.abs(Math.abs(Math.abs(arc(saturn - mercury)) - angles[aspectType]) - deviation) < 0.000001);
    const velocity = arc(long('Saturn', instant + 600000) - long('Saturn', instant - 600000));
    assert.equal(Math.sign(velocity), transitNature === 'favourable' ? 1 : -1);
    const scoped = { ...run, facts: [fact] };
    const matched = directionMatch(scoped);
    assert.equal(matched.status, inside ? 'matched' : 'partial');
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const description = describeFortuneFact({ method: 'western', type: directionType, data: p }, String);
    assert.ok(description.includes(natureRelation === 'akin' ? '两类接触性质同向' : '两类接触性质不同'));
    if (!inside) continue;
    for (const change of [{ directionNatalTargetId: 'Jupiter' }, { dateBasis: 'UTC-birth-date-candidate' },
      { fellowshipSaturnTransitBandProfile: undefined }]) {
      assert.equal(directionMatch({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, ...change } }] }).status, 'partial');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-mercury-saturn'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, transitNature === 'favourable' ? /实际顺行土星对本命水星/u : /实际逆行土星对本命水星/u);
    assert.doesNotMatch(prompt, /fellowshipSaturnTransitBandProfile|directionKind|natureRelation|两类接触性质/u);
  }
});

test('real solar direction bands compare their own Jupiter or Saturn natal premise against the actual reversed transit', () => {
  const cases = [
    ['1975-04-04T12:00:00Z', 'Jupiter', 'sextile', 'trine', 'favourable', 'akin'],
    ['1973-06-25T12:00:00Z', 'Saturn', 'sextile', 'square', 'favourable', 'different'],
    ['1970-09-19T12:00:00Z', 'Saturn', 'opposition', 'opposition', undefined, 'unclassified'],
  ];
  for (const [birth, body, directionAspectType, transitAspectType, nature, relation] of cases) {
    const run = annualRun(Date.parse(birth), 2026);
    const link = run.facts.find(row => row.factType === directionType && row.normalizedPayload.directionKind === 'solar_band'
      && row.normalizedPayload.progressedBody === 'Sun' && row.normalizedPayload.natalTargetId === 'Sun'
      && row.normalizedPayload.transitBody === body && row.normalizedPayload.directionNatalTargetId === body
      && row.normalizedPayload.directionAspectType === directionAspectType && row.normalizedPayload.aspectType === transitAspectType);
    assert.ok(link, birth);
    assert.equal(link.normalizedPayload.directionNature, nature);
    assert.equal(link.normalizedPayload.natureRelation, relation);
    assert.ok(directionMatch(run).sourceFactIds.includes(link.factId));
    const interval = run.facts.find(row => row.factType === 'aspect_interval' && row.activeFrom <= link.activeFrom
      && link.activeTo <= row.activeTo && row.normalizedPayload.transitBody === body && row.normalizedPayload.natalTargetId === 'Sun'
      && row.normalizedPayload.aspectType === transitAspectType);
    assert.ok(interval);
    const description = describeFortuneFact({ method: 'western', type: directionType, data: link.normalizedPayload }, String);
    if (nature) assert.match(description, /太阳推运列作偏顺/u);
    else assert.doesNotMatch(description, /太阳推运列作偏/u);
  }
});

test('Heindel compares a mild Jupiter transit with a qualified Sun direction without erasing its weaker nature', () => {
  const cases = [
    ['1942-10-23T12:00:00Z', '2026-06-18', 'opposition', 180, 'square', 90, 'adverse', 'akin'],
    ['1945-11-18T12:00:00Z', '2026-10-25', 'trine', 120, 'square', 90, 'favourable', 'different'],
    ['1943-01-17T12:00:00Z', '2026-06-03', 'square', 90, 'opposition', 180, undefined, undefined],
  ];
  const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
  for (const [birth, day, directionAspect, directionAngle, transitAspect, transitAngle, nature, relation] of cases) {
    const natal = chart(Date.parse(birth));
    const asOf = Date.UTC(2026, 6, 1);
    const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
    const reference = { snapshotId: 'heindel-solar-jupiter-' + birth, chart: natal };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const source = buildHeindelSourceContext(window, natal);
    const at = day + 'T00:00:00.000Z';
    const transit = run.facts.find(row => row.factType === 'aspect_interval' && row.activeFrom <= at && at < row.activeTo
      && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.natalTargetId === 'Sun'
      && row.normalizedPayload.aspectType === transitAspect);
    const band = source.solar.find(row => row.natalTargetId === 'Jupiter' && row.aspectType === directionAspect
      && row.start <= Date.parse(at) && Date.parse(at) < row.end);
    assert.ok(band && transit, birth);
    const natalJupiter = source.natal.find(row => row.body === 'Jupiter').longitude;
    const natalSun = source.natal.find(row => row.body === 'Sun').longitude;
    const progressed = readHeindelPosition(source.clock, 'Sun', Date.parse(at));
    const transitJupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(progressed - natalJupiter)) - directionAngle) < 1.5, birth);
    assert.ok(Math.abs(Math.abs(arc(transitJupiter - natalSun)) - transitAngle) < transit.normalizedPayload.allowedOrb, birth);
    const natalContacts = source.natalPairs.filter(row => [row.first, row.second].includes('Jupiter'))
      .flatMap(row => row.contacts.filter(aspect => aspect.band === 'standard'));
    assert.equal(natalContacts.some(contact => contact.affected.includes('Jupiter')), nature === 'adverse', birth);
    assert.equal(natalContacts.some(contact => contact.assessment === 'support'), nature === 'favourable', birth);
    const link = run.facts.find(row => row.factType === directionType && row.activeFrom <= at && at < row.activeTo
      && row.normalizedPayload.directionKind === 'solar_band' && row.normalizedPayload.progressedBody === 'Sun'
      && row.normalizedPayload.natalTargetId === 'Sun' && row.normalizedPayload.directionNatalTargetId === 'Jupiter'
      && row.normalizedPayload.transitBody === 'Jupiter' && row.normalizedPayload.directionAspectType === directionAspect
      && row.normalizedPayload.aspectType === transitAspect);
    if (!relation) {
      assert.equal(link, undefined, birth);
      continue;
    }
    assert.ok(link, birth);
    assert.deepEqual([link.normalizedPayload.directionNature, link.normalizedPayload.transitNature,
      link.normalizedPayload.natureRelation], [nature, 'mild_adverse', relation], birth);
    assert.equal(link.activeFrom, iso(Math.max(Date.parse(transit.activeFrom), band.start)), birth);
    assert.equal(link.activeTo, iso(Math.min(Date.parse(transit.activeTo), band.end)), birth);
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== directionType || row.factId === link.factId) };
    const match = directionMatch(scoped);
    assert.equal(match.status, 'partial', birth);
    assert.deepEqual(match.sourceFactIds, [link.factId], birth);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
    const local = relation === 'akin' ? '两类接触性质同向' : '两类接触性质不同';
    const mild = '原书将这类实际木星刑冲列为较轻的阻力';
    const audit = formatFortuneFactAudit(input);
    const prompt = formatFortunePrompt(input);
    assert.ok(audit.includes(local) && audit.includes(mild), birth);
    assert.ok(!prompt.includes(mild), birth);
    assert.doesNotMatch(prompt, /两类接触性质同向|两类接触性质不同|mild_adverse|natureRelation/u);
  }
});

test('Heindel confirms the same and opposite Sun–Jupiter directions only within the actual mild transit band', () => {
  const timeZone = 'Europe/London';
  const testCases = [
    ['1942-10-23T12:00:00Z', 'opposition', 'adverse', 'akin', '2026-06-20T12:35:30.468Z', '2026-07-04T16:01:51.840Z'],
    ['1945-11-18T12:00:00Z', 'trine', 'favourable', 'different', '2026-10-31T18:57:45.307Z', '2027-01-01T00:00:00.000Z'],
  ];
  for (const [birth, solarAspect, polarity, relation, start, end] of testCases) {
    const birthAt = Date.parse(birth), run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const link = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === directionType
      && p.fellowshipJupiterMildTransitBandProfile === heindelSourcePolicy.fellowshipJupiterMildTransitBandProfile
      && p.directionAspectType === solarAspect && Math.abs(Date.parse(activeFrom) - Date.parse(start)) < 1_000);
    assert.ok(link, birth);
    assert.ok(Math.abs(Date.parse(link.activeTo) - Date.parse(end)) < 1_000);
    const p = link.normalizedPayload;
    assert.deepEqual([p.dateBasis, p.directionNature, p.transitNature, p.natureRelation],
      ['archive-local-birthday', polarity, 'mild_adverse', relation]);
    const natalSun = SunPosition(new Date(birthAt)).elon;
    const transitError = at => Math.abs(Math.abs(arc(Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon - natalSun)) - 90);
    const noon = (Date.parse(link.activeFrom) + Date.parse(link.activeTo)) / 2;
    assert.ok(transitError(Date.parse(link.activeFrom) - 2_000) > 1.5);
    assert.ok(transitError(noon) < 1.5);
    if (!end.startsWith('2027')) assert.ok(transitError(Date.parse(link.activeTo) + 2_000) > 1.5);
    const broad = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: q }) => factType === directionType
      && q.directionAspectType === solarAspect && q.transitBody === 'Jupiter' && q.natalTargetId === 'Sun'
      && q.aspectType === 'square' && !q.fellowshipJupiterMildTransitBandProfile && activeFrom < link.activeFrom && link.activeTo <= activeTo);
    assert.ok(broad);
    const scoped = { ...run, facts: [broad, link] }, match = directionMatch(scoped);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.sourceFactIds, [link.factId]);
    assert.deepEqual(match.windows, [{ start: link.activeFrom, endExclusive: link.activeTo }]);
    assert.equal(directionMatch({ ...run, facts: [broad] }).status, 'partial');
    const changed = { ...link, normalizedPayload: { ...p, dateBasis: 'UTC-birth-date-candidate' } };
    assert.equal(directionMatch({ ...run, facts: [changed] }).status, 'partial');
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-mild-jupiter-range'));
    assert.match(formatFortuneFactAudit(input), /实际木星刑冲在一度半范围内/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /较轻阻力/u);
    assert.doesNotMatch(prompt, /fellowshipJupiterMildTransitBandProfile|heindel-mild-jupiter-range/u);
  }
  const unsupported = annualRun(Date.parse('1943-01-17T12:00:00Z'), 2026, timeZone);
  assert.ok(!unsupported.facts.some(({ factType, normalizedPayload: p }) => factType === directionType
    && p.transitBody === 'Jupiter' && p.natalTargetId === 'Sun' && p.directionAspectType === 'square'
    && p.fellowshipJupiterMildTransitBandProfile));
});

test('real fact writer binds the complete source background to each actual transit and preserves exact-time versus interval-overlap distinctions',()=>{
  const run=realRun();validateFortuneFacts(run);assert.notEqual(run.methods.western.status,'failed');assert.ok(rows(run).length>20);
  const s=realSource();
  for(const row of rows(run)){
    const p=row.normalizedPayload,transit=run.facts.find(f=>f.factId===p.transitFactId);
    assert.equal(row.activeFrom,transit.activeFrom);assert.equal(row.activeTo,transit.activeTo);assert.equal(row.exactInstant,transit.exactInstant);
    assert.equal(p.sourceClockVerified,false);assert.ok(row.sourceFactIds.length>=2);assert.ok(row.sourceFactIds.every(id=>run.rawFacts.some(r=>r.rawFactId===id)));
    assert.equal(p.natalLongitude,s.natal.find(n=>n.body===p.natalTargetId).longitude);
    if(row.exactInstant){const exact=Date.parse(row.exactInstant);assert.deepEqual(p.solarActiveAtExact,s.solar.filter(b=>b.start<=exact&&exact<b.end).map(b=>({natalTargetId:b.natalTargetId,aspectType:b.aspectType})));}
  }
});

test('source transit links reject different snapshots, runs, profiles, periods, target geometry and out-of-window records',()=>{
  const base=realRun().facts.filter(f=>f.factType==='aspect_interval'&&f.completeness==='complete'),s=realSource();
  assert.ok(linkHeindelTransits(s,base).length);
  for(const field of ['natalChartSnapshotId','calculationRunId','profileId','periodType']){
    const facts=structuredClone(base);facts[0][field]='other';assert.equal(linkHeindelTransits(s,facts).length,0,field);
  }
  const template=base.find(f=>linkHeindelTransits(s,[f]).length);
  for(const mutate of [f=>{f.normalizedPayload.natalLongitude+=2;},f=>{f.normalizedPayload.natalTargetType='angle';},
    f=>{f.normalizedPayload.zodiac='sidereal';},f=>{f.activeFrom=iso(window.start-day);},f=>{f.completeness='partial';}]){
    const f=structuredClone(template);mutate(f);assert.equal(linkHeindelTransits(s,[f]).length,0);
  }
});

test('all eight SQLite rules retain source hashes and their individual observation, transit and direction gates',()=>{
  assert.equal(rules().length,8);
  const run=realRun(),matches=matchFortuneKnowledge(run).byMethod.western;
  for(const r of rules()){
    const e=fortuneKnowledge.western.entries.find(e=>e.id===r.knowledgeId);
    assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));
    if (isObservation(r.knowledgeId)) {
      assert.equal(r.queries[0].factType, observationType);
      assert.deepEqual(r.unresolved, []);
      continue;
    }
    assert.equal(r.queries[0].factType,r.knowledgeId.includes('progression-p001')?directionType:'heindel_transit_context');
    if (r.knowledgeId.includes('heindel-v1-neptune')) {
      assert.ok(r.unresolved.some(item => /本命前提.+其他不和谐配置.+作用程度/u.test(item)));
      assert.ok(r.unresolved.some(item => /其余推运有效容许度.+异对同题.+新月激活范围/u.test(item)));
      assert.ok(r.review.mappedConditions.some(item => /六合.+三分/u.test(item)));
    } else assert.equal(r.unresolved.length, 3, r.knowledgeId);
    assert.deepEqual(r.queries[0].where.dateBasis.oneOf, [...heindelSourcePolicy.dateBases]);
    assert.ok(!['matched','unsupported'].includes(matches.find(m=>m.knowledgeId===r.knowledgeId).status));
  }
  assert.equal(matches.find(m=>m.knowledgeId.includes('heindel-v1-jupiter-p001')).status,'partial');
  const sourceTypes = ['heindel_transit_context', directionType, observationType];
  const noSource=structuredClone(run);noSource.facts=noSource.facts.filter(f=>!sourceTypes.includes(f.factType));
  assert.ok(matchFortuneKnowledge(noSource).byMethod.western.filter(m=>m.knowledgeId.includes('heindel')).every(m=>m.status==='unknown'));
  const wrong=structuredClone(run);wrong.facts.filter(f=>sourceTypes.includes(f.factType)).forEach(f=>{f.normalizedPayload.profile='leo';});
  assert.ok(matchFortuneKnowledge(wrong).byMethod.western.filter(m=>m.knowledgeId.includes('heindel')).every(m=>m.status==='not_matched'));
});

test('direct Saturn and Jupiter observations require real exact contacts and reach the report without ACD facts', () => {
  const runs = [realRun(), annualRun(Date.parse('1980-04-06T12:00:00Z'), 2026)];
  for (const [index, run] of runs.entries()) {
    const id = observationIds[index];
    const direct = { ...run, facts: run.facts.filter(f=>!['heindel_progression_context','heindel_transit_context',directionType].includes(f.factType)) };
    const match = source => matchFortuneKnowledge(source).byMethod.western.find(m => m.knowledgeId.endsWith(id));
    const result = match(direct);
    assert.equal(result.status, 'matched');
    const facts = direct.facts.filter(f => result.sourceFactIds.includes(f.factId));
    assert.ok(facts.length);
    for (const fact of facts) {
      assert.equal(fact.factType, observationType);
      assert.equal(fact.activeFrom, fact.exactInstant);
      assert.ok(Date.parse(fact.activeTo) - Date.parse(fact.exactInstant) <= 1000);
      assert.ok(direct.facts.some(f => f.factType === 'aspect_exact' && f.exactInstant === fact.exactInstant
        && f.normalizedPayload.transitBody === fact.normalizedPayload.transitBody
        && f.normalizedPayload.natalTargetId === fact.normalizedPayload.natalTargetId
        && f.normalizedPayload.aspectType === fact.normalizedPayload.aspectType));
    }
    const missing = { ...direct, facts: direct.facts.filter(f => f.factType !== observationType) };
    assert.equal(match(missing).status, 'unknown');
    const wrong = { ...direct, facts: direct.facts.map(f => f.factType !== observationType ? f : {
      ...f, normalizedPayload: { ...f.normalizedPayload, natalTargetId: 'Uranus' },
    }) };
    assert.equal(match(wrong).status, 'not_matched');
    const report = interpretFortune(direct, requestForFortuneRun(direct), 'direct-transit-observations');
    const { input } = buildFortuneModelContext(direct, report);
    assert.ok(input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId.endsWith(id)));
    assert.doesNotMatch(formatFortunePrompt(input), /heindel_transit_observation|transitBody|no_observed_gain/u);
  }
});

test('Saturn and Mercury observations use the direction of each exact pass from the client through SQLite', () => {
  const cases = [
    ['1975-12-03T12:00:00Z', 'trine', 'direct', 'retrograde', 'favourable', 2, 3],
    ['1980-01-07T12:00:00Z', 'square', 'retrograde', 'direct', 'adverse', 3, 2],
  ];
  for (const [birth, aspect, motion, oppositeMotion, observation, index, oppositeIndex] of cases) {
    const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
    const now = Date.UTC(2026, 5, 1, 12);
    const archive = { snapshotId: 'heindel-signed-observation', chart: chart(Date.parse(birth)) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, archive)));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), archive.snapshotId, archive);
    const pair = fact => fact.normalizedPayload.transitBody === 'Saturn' && fact.normalizedPayload.natalTargetId === 'Mercury';
    const exact = run.facts.filter(fact => fact.factType === 'aspect_exact' && pair(fact) && fact.normalizedPayload.aspectType === aspect);
    assert.ok(exact.some(fact => fact.normalizedPayload.transitMotion === oppositeMotion), birth);
    const observations = run.facts.filter(fact => fact.factType === observationType && pair(fact));
    const expected = exact.filter(fact => fact.normalizedPayload.transitMotion === motion);
    assert.ok(expected.length, birth);
    assert.deepEqual(observations.map(fact => fact.exactInstant), expected.map(fact => fact.exactInstant));
    assert.ok(observations.every(fact => fact.normalizedPayload.observation === observation
      && fact.normalizedPayload.transitMotion === motion && fact.activeFrom === fact.exactInstant));
    const matches = matchFortuneKnowledge(run).byMethod.western;
    assert.equal(matches.find(match => match.knowledgeId.endsWith(observationIds[index])).status, 'matched');
    assert.equal(matches.find(match => match.knowledgeId.endsWith(observationIds[oppositeIndex])).status, 'not_matched');
    const report = interpretFortune(run, requestForFortuneRun(run), 'signed-transit-observations');
    const modelInput = buildFortuneModelContext(run, report).input;
    assert.ok(modelInput.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId.endsWith(observationIds[index])));
    assert.doesNotMatch(formatFortunePrompt(modelInput), /heindel_transit_observation|transitMotion/u);
  }
});

test('SQLite keeps source-specific target distinctions even when a shared source background is present',()=>{
  const run=structuredClone(realRun()),template=structuredClone(rows(run).find(f=>f.exactInstant));
  const check=(payload,index)=>{
    const f={...template,normalizedPayload:{profile:heindelSourcePolicy.profile,natalWitnessProfile:heindelSourcePolicy.natalWitnessProfile,
      natalAspectProfile:heindelSourcePolicy.natalAspectProfile,
      geometryOnly:true,kind:'exact',dateBasis:'UTC-birth-date-candidate',...payload}};
    run.facts=run.facts.filter(f=>f.factType!=='heindel_transit_context');run.facts.push(f);
    return matchFortuneKnowledge(run).byMethod.western[index].status;
  };
  const neptuneConjunction={transitBody:'Neptune',natalTargetId:'Moon',aspectType:'conjunction'};
  assert.equal(check(neptuneConjunction,38),'partial');
  assert.equal(check({...neptuneConjunction,aspectType:'sextile'},38),'partial');
  assert.equal(check({...neptuneConjunction,aspectType:'trine'},38),'partial');
  assert.equal(check({...neptuneConjunction,aspectType:'sextile',kind:'interval'},38),'not_matched');
  assert.equal(check({...neptuneConjunction,natalTargetId:'Sun'},38),'not_matched');
  const jupiter = { transitBody: 'Jupiter', natalTargetId: 'Moon', aspectType: 'trine', repeatProfile: 'heindel-jupiter-station-bracketed-repeat-v1' };
  assert.equal(check({ ...jupiter, natalTargetHasSupport: true }, 35), 'partial');
  assert.equal(check({ ...jupiter, natalTargetHasSupport: false }, 35), 'unknown');
  assert.equal(check({ ...jupiter, natalTargetHasSupport: false, natalSunJupiterFinancialSupport: 'absent' }, 35), 'not_matched');
  assert.equal(check({ ...jupiter, natalTargetHasSupport: true, dateBasis: undefined }, 35), 'unknown');
  assert.equal(check({ ...jupiter, natalTargetHasSupport: true, dateBasis: 'unrecognized' }, 35), 'not_matched');
  const neptune = { transitBody: 'Neptune', natalTargetId: 'Moon', aspectType: 'opposition' };
  assert.equal(check({ ...neptune, natalTargetHasAffliction: true }, 38), 'partial');
  assert.equal(check({ ...neptune, natalTargetHasAffliction: false }, 38), 'not_matched');
  assert.equal(check(neptune, 38), 'unknown');
});

test('Jupiter to an unsupported natal receiver can use the separate unopposed Sun–Jupiter income evidence', () => {
  const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
  const asOf = Date.UTC(2026, 6, 1);
  const isRule = row => row.knowledgeId.endsWith('heindel-v1-jupiter-p001-001');
  for (const [birth, aspectType, at, state] of [
    ['1943-10-10T12:00:00Z', 'sextile', '2026-06-22T12:29:52.629Z', 'supported'],
    ['1942-04-07T12:00:00Z', 'trine', '2026-07-18T13:41:05.438Z', 'mixed'],
  ]) {
    const birthAt = Date.parse(birth);
    const reference = { snapshotId: 'heindel-natal-financial-support-' + birth, chart: chart(birthAt) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
    const witness = rows(run).find(row => {
      const p = row.normalizedPayload;
      return p.transitBody === 'Jupiter' && p.natalTargetId === 'Mercury' && p.kind === 'exact'
        && p.aspectType === aspectType && Math.abs(Date.parse(row.exactInstant) - Date.parse(at)) < 1_000;
    });
    assert.ok(witness, birth);
    const p = witness.normalizedPayload;
    assert.equal(p.natalTargetHasSupport, false, birth);
    assert.equal(p.natalSunJupiterFinancialSupport, state, birth);
    assert.deepEqual([p.natalSunJupiterFinanceContact.first, p.natalSunJupiterFinanceContact.second, p.natalSunJupiterFinanceContact.aspectType],
      ['Sun', 'Jupiter', 'sextile'], birth);
    const natalSun = SunPosition(new Date(birthAt)).elon;
    const natalJupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(birthAt), true)).elon;
    const difference = Math.abs(Math.abs(arc(natalSun - natalJupiter)) - 60);
    assert.ok(difference < 6 && Math.abs(difference - p.natalSunJupiterFinanceContact.deviation) < 1e-8, birth);
    const natalMercury = Ecliptic(GeoVector(Body.Mercury, new Date(birthAt), true)).elon;
    const transitJupiter = Ecliptic(GeoVector(Body.Jupiter, new Date(witness.exactInstant), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(transitJupiter - natalMercury)) - (aspectType === 'sextile' ? 60 : 120)) < 1e-6, birth);
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== witness.factType || row.factId === witness.factId) };
    const result = matchFortuneKnowledge(scoped).byMethod.western.find(isRule);
    assert.equal(result.status, state === 'supported' ? 'partial' : 'not_matched', birth);
    assert.deepEqual(result.sourceFactIds, state === 'supported' ? [witness.factId] : [], birth);
    const assess = changes => evaluateFortuneRules('western', 'year', [{ ...witness, normalizedPayload: { ...p, ...changes } }])
      .find(isRule).required[0];
    assert.equal(assess({ kind: 'interval' }).hits.length, 0, birth);
    assert.equal(assess({ natalTargetId: 'Saturn' }).hits.length, 0, birth);
    assert.deepEqual(assess({ natalSunJupiterFinancialSupport: 'absent' }).hits, [], birth);
    assert.equal(assess({ natalSunJupiterFinancialSupport: undefined }).unknown, true, birth);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
    const prompt = formatFortunePrompt(input);
    const text = state === 'supported' ? '原书财务章节所列的本命日木六合相已核，两曜未见本项所查受克'
      : '本命日木虽见六合相，但同见受克，财务支持仍待核';
    assert.ok(formatFortuneFactAudit(input).includes(text), birth);
    assert.ok(!prompt.includes(text), birth);
    assert.doesNotMatch(prompt, /natalSunJupiterFinancialSupport|natalSunJupiterFinanceContact/u);
    assert.ok(!input.sections.flatMap(section => section.findings).some(item => isRule(item)), birth);
  }
});

test('Uranus direct observations require an actual conjunction to the named natal receiver', () => {
  const birth = Date.parse('1968-05-06T12:00:00Z');
  const archive = { snapshotId: 'heindel-uranus-conjunction', chart: chart(birth) };
  const submit = (year) => {
    const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1, 12);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, archive)));
    return bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), archive.snapshotId, archive);
  };
  const run = submit(2026);
  const match = candidate => matchFortuneKnowledge(candidate).byMethod.western.find(row => row.knowledgeId.endsWith(observationIds[4]));
  const result = match(run);
  assert.equal(result.status, 'matched');
  const observations = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.deepEqual([...new Set(observations.map(fact => fact.normalizedPayload.natalTargetId))].sort(), ['Mars', 'Mercury']);
  for (const fact of observations) {
    const p = fact.normalizedPayload;
    const natal = archive.chart.western.rawResult[0].positions.find(row => row.planet === p.natalTargetId).longitude;
    const moving = Ecliptic(GeoVector(Body.Uranus, new Date(fact.exactInstant), true)).elon;
    assert.ok(Math.abs(arc(moving - natal)) < 0.001);
    assert.equal(fact.factType, observationType);
    assert.equal(fact.activeFrom, fact.exactInstant);
    assert.equal(p.observation, 'hasty_reaction');
  }
  const nearby = submit(2027);
  assert.ok(nearby.facts.some(fact => fact.factType === 'aspect_interval' && fact.normalizedPayload.transitBody === 'Uranus'
    && fact.normalizedPayload.natalTargetId === 'Mercury' && fact.normalizedPayload.aspectType === 'conjunction'));
  assert.notEqual(match(nearby).status, 'matched');
  for (const incorrect of [{ aspectType: 'sextile' }, { natalTargetId: 'Venus' }]) {
    const facts = observations.map(fact => ({ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...incorrect } }));
    assert.equal(match({ ...run, facts }).status, 'not_matched');
  }
  const report = interpretFortune(run, requestForFortuneRun(run), 'uranus-observations');
  const { input } = buildFortuneModelContext(run, report);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /原书将这一过点与较急的反应/u);
  assert.doesNotMatch(formatFortunePrompt(input), /heindel_transit_observation|hasty_reaction|transitMotion/u);
});

test('Neptune one-and-a-half-degree soft transit bands and actual hard-contact natal conditions survive SQLite', () => {
  const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
  const asOf = Date.UTC(2026, 5, 1, 12);
  const cases = [
    ['1980-01-03T12:00:00Z', 'Mercury', 'square', true, true],
    ['1980-03-03T12:00:00Z', 'Moon', 'opposition', false, false],
    ['1940-01-25T12:00:00Z', 'Mercury', 'sextile', true],
    ['1940-06-09T12:00:00Z', 'Moon', 'trine', true],
  ];
  for (const [birthDate, target, aspect, expectsMatch, expectedAffliction] of cases) {
    const birth = Date.parse(birthDate);
    const snapshot = { ...chart(birth), birthContext: { ...archiveClock(birth, 'Europe/London'), latitude: 51.48, longitude: 0 } };
    const archive = { snapshotId: 'heindel-natal-testimony', profileId: 'heindel-natal-profile', chart: snapshot };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'heindel-natal-testimony', archive);
    validateFortuneFacts(run);
    const facts = rows(run).filter(fact => fact.normalizedPayload.transitBody === 'Neptune' && fact.normalizedPayload.natalTargetId === target
      && fact.normalizedPayload.aspectType === aspect && fact.normalizedPayload.kind === 'exact');
    assert.ok(facts.length, birthDate);
    const isRule = row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001');
    const match = source => matchFortuneKnowledge(source).byMethod.western.find(isRule);
    const rule = match(run);
    for (const fact of facts) {
      if (expectedAffliction !== undefined) assert.equal(fact.normalizedPayload.natalTargetHasAffliction, expectedAffliction);
      const expectedNature = expectedAffliction === true ? 'adverse' : expectedAffliction === false ? 'unclassified' : 'favourable';
      assert.equal(fact.normalizedPayload.transitNature, expectedNature);
      assert.equal(match({ ...run, facts: [fact] }).sourceFactIds.includes(fact.factId), expectsMatch);
      assert.equal(fact.normalizedPayload.natalAspectProfile, heindelSourcePolicy.natalAspectProfile);
    }
    const prompt = describeFortuneFact({ method: 'western', type: 'heindel_transit_context', data: facts[0].normalizedPayload }, String);
    if (expectedAffliction === true) assert.match(prompt, /本命水星与土星四分.*依原书受克方向核见水星、土星/u);
    assert.doesNotMatch(prompt, /natalAspectEvidence|natalTargetHasAffliction/u);
    const bands = rows(run).filter(({ normalizedPayload: p }) => p.natalTargetId === target && p.aspectType === aspect
      && p.fellowshipTransitBandProfile === heindelSourcePolicy.fellowshipTransitBandProfile);
    if (aspect !== 'sextile' && aspect !== 'trine') {
      assert.deepEqual(bands, []);
      const adverse = rows(run).filter(({ normalizedPayload: p }) => p.natalTargetId === target && p.aspectType === aspect
        && p.fellowshipNeptuneAdverseTransitBandProfile === heindelSourcePolicy.fellowshipNeptuneAdverseTransitBandProfile);
      assert.equal(adverse.length > 0, expectedAffliction);
      for (const band of adverse) {
        assert.equal(band.normalizedPayload.transitAllowedOrb, 1.5);
        assert.equal(band.normalizedPayload.transitNature, 'adverse');
        const source = run.facts.find(row => row.factId === band.normalizedPayload.transitFactId);
        assert.ok(source?.factType === 'aspect_interval');
        assert.ok(source.activeFrom <= band.activeFrom && band.activeTo <= source.activeTo);
        assert.equal(match({ ...run, facts: [band] }).status, 'partial');
        const error = at => Math.abs(Math.abs(arc(Ecliptic(GeoVector(Body.Neptune, new Date(at), true)).elon
          - Ecliptic(GeoVector(Body[target], new Date(birth), true)).elon)) - 90);
        const from = Date.parse(band.activeFrom), to = Date.parse(band.activeTo);
        assert.ok(error((from + to) / 2) < 1.5);
        for (const [edge, broad, side] of [[from, Date.parse(source.activeFrom), -1], [to, Date.parse(source.activeTo), 1]]) {
          if (edge === broad) continue;
          assert.ok(Math.abs(error(edge) - 1.5) < 0.00001);
          assert.ok(error(edge + side * 120000) > 1.5);
          assert.ok(error(edge - side * 120000) < 1.5);
        }
        const noAffliction = { ...band, normalizedPayload: { ...band.normalizedPayload, natalTargetHasAffliction: false } };
        assert.equal(match({ ...run, facts: [noAffliction] }).status, 'not_matched');
        const only = { ...run, facts: [band] };
        const { input: model } = buildFortuneModelContext(only, interpretFortune(only, requestForFortuneRun(only), archive.snapshotId));
        assert.doesNotMatch(formatFortunePrompt(model), /dreams and visions|fellowshipNeptuneAdverseTransitBandProfile/u);
      }
      continue;
    }
    assert.ok(bands.length, birthDate);
    assert.equal(rule.status, 'matched');
    const errorAt = at => Math.abs(Math.abs(arc(Ecliptic(GeoVector(Body.Neptune, new Date(at), true)).elon
      - Ecliptic(GeoVector(Body[target], new Date(birth), true)).elon)) - (aspect === 'sextile' ? 60 : 120));
    let checkedEdge = false;
    for (const band of bands) {
      const p = band.normalizedPayload;
      assert.equal(p.transitAllowedOrb, 1.5);
      assert.ok(rule.sourceFactIds.includes(band.factId));
      const original = run.facts.find(row => row.factId === p.transitFactId);
      assert.ok(original && original.factType === 'aspect_interval');
      assert.ok(original.activeFrom <= band.activeFrom && band.activeTo <= original.activeTo);
      assert.ok(original.sourceFactIds.every(id => band.sourceFactIds.includes(id)));
      const from = Date.parse(band.activeFrom), to = Date.parse(band.activeTo);
      assert.ok(errorAt((from + to) / 2) < 1.5);
      for (const [edge, broad, outside] of [[from, Date.parse(original.activeFrom), -120_000],
        [to, Date.parse(original.activeTo), 120_000]]) {
        if (edge === broad) continue;
        assert.ok(Math.abs(errorAt(edge) - 1.5) < 0.00001);
        assert.ok(errorAt(edge + outside) > 1.5);
        checkedEdge = true;
      }
      const assess = changes => evaluateFortuneRules('western', 'year', [{ ...band, normalizedPayload: { ...p, ...changes } }])
        .find(isRule).confirmations[1];
      for (const changes of [{ fellowshipTransitBandProfile: 'product' }, { transitAllowedOrb: 6 },
        { dateBasis: 'UTC-birth-date-candidate' }, { natalTargetId: 'Sun' }, { aspectType: 'square' }]) {
        assert.equal(assess(changes).hits.length, 0);
      }
    }
    assert.ok(checkedEdge, birthDate);
    const { input: model } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
    assert.match(formatFortuneFactAudit(model), /真实行运海王星与本命(?:水星|月亮)的(?:六合|三分)相一度半区间/u);
    const provider = formatFortunePrompt(model);
    assert.match(provider, /依同学派高级课程第十三课另算行运一度半范围/u);
    assert.doesNotMatch(provider, /真实行运海王星与本命.*一度半区间|fellowshipTransitBandProfile/u);
  }
});

test('Heindel Neptune actual conjunction preserves both archived Moon passage seconds within the lesson band', () => {
  const birth = Date.parse('1940-04-06T12:00:00Z');
  const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
  const asOf = Date.UTC(2026, 5, 1, 12);
  const snapshot = { ...chart(birth), birthContext: { ...archiveClock(birth, 'Europe/London'), latitude: 51.48, longitude: 0 } };
  const archive = { snapshotId: 'heindel-neptune-conjunction', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const isRule = row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001');
  const rule = matchFortuneKnowledge(run).byMethod.western.find(isRule);
  const selected = rows(run).filter(fact => fact.normalizedPayload.hasVerifiedNeptuneConjunctionPoint === true
    && fact.normalizedPayload.natalTargetId === 'Moon');
  assert.equal(selected.length, 2);
  assert.equal(rule.status, 'matched');
  const natalMoon = Ecliptic(GeoVector(Body.Moon, new Date(birth), true)).elon;
  const expectedMonths = ['2026-03', '2026-11'];
  assert.deepEqual(selected.map(row => row.exactInstant.slice(0, 7)), expectedMonths);
  for (const row of selected) {
    const p = row.normalizedPayload;
    const transitNeptune = Ecliptic(GeoVector(Body.Neptune, new Date(row.exactInstant), true)).elon;
    assert.ok(Math.abs(arc(transitNeptune - natalMoon)) < 0.00001);
    assert.equal(row.activeFrom, row.exactInstant);
    assert.equal(Date.parse(row.activeTo) - Date.parse(row.exactInstant), 1000);
    assert.ok(rule.sourceFactIds.includes(row.factId));
    const isolated = matchFortuneKnowledge({ ...run, facts: [row] }).byMethod.western.find(isRule);
    assert.deepEqual(isolated.windows, [{ start: row.activeFrom, endExclusive: row.activeTo }]);
    const originals = rows(run).filter(other => other.exactInstant === row.exactInstant
      && other.normalizedPayload.transitFactId === p.transitFactId);
    assert.equal(originals.length, 2);
    const candidate = originals.find(other => other.factId !== row.factId);
    assert.equal(matchFortuneKnowledge({ ...run, facts: [candidate] }).byMethod.western.find(isRule).status, 'partial');
    const assess = changes => evaluateFortuneRules('western', 'year', [{ ...row, normalizedPayload: { ...p, ...changes } }])
      .find(isRule).confirmations[0];
    for (const changes of [{ dateBasis: 'UTC-birth-date-candidate' }, { natalTargetId: 'Sun' },
      { aspectType: 'sextile' }, { kind: 'interval' }]) assert.equal(assess(changes).hits.length, 0);
  }
  const deviation = at => Math.abs(arc(Ecliptic(GeoVector(Body.Neptune, new Date(at), true)).elon - natalMoon));
  const bands = rows(run).filter(({ normalizedPayload: p }) => p.kind === 'interval' && p.aspectType === 'conjunction'
    && p.natalTargetId === 'Moon' && p.fellowshipTransitBandProfile === heindelSourcePolicy.fellowshipTransitBandProfile);
  assert.ok(bands.length);
  let actualBoundary;
  for (const band of bands) {
    const start = Date.parse(band.activeFrom), end = Date.parse(band.activeTo);
    const distance = deviation((start + end) / 2);
    assert.ok(distance > 0.00001 && distance < 1.5);
    const scoped = matchFortuneKnowledge({ ...run, facts: [band] }).byMethod.western.find(isRule);
    assert.equal(scoped.status, 'matched');
    assert.deepEqual(scoped.windows, [{ start: band.activeFrom, endExclusive: band.activeTo }]);
    for (const [edge, sign] of [[start, -1], [end, 1]]) {
      if (Math.abs(deviation(edge) - 1.5) > 0.00001) continue;
      actualBoundary = edge;
      assert.ok(deviation(edge + sign * 600_000) > 1.5);
      assert.ok(deviation(edge - sign * 600_000) < 1.5);
    }
    const broadProductBand = { ...band, normalizedPayload: { ...band.normalizedPayload,
      transitAllowedOrb: 6, fellowshipTransitBandProfile: undefined } };
    assert.equal(matchFortuneKnowledge({ ...run, facts: [broadProductBand] }).byMethod.western.find(isRule).status, 'not_matched');
  }
  assert.ok(actualBoundary);
  const { input: model } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  assert.match(formatFortuneFactAudit(model), /真实行运海王星与本命月亮的合相精确接触/u);
  const provider = formatFortunePrompt(model);
  assert.match(provider, /实际行运海王星与本命水星或月亮的黄经实达同度/u);
  assert.match(provider, /海王星行运合相的一度半强范围/u);
  assert.match(provider, /dreams and visions/u);
  assert.doesNotMatch(provider, /真实行运海王星与本命月亮的合相精确接触|hasVerifiedNeptuneConjunctionPoint/u);
});

test('Neptune compares named progressions and confirms a real same-nature lunar point within the one-and-a-half-degree band', () => {
  for (const [birth, at, target, directionAspect, transitAspect, relation, directionNature, transitNature] of [
    ['1940-01-20T12:00:00Z', '2026-02-14T15:16:38.507Z', 'Moon', 'sextile', 'sextile', 'akin', 'favourable', 'favourable'],
    ['1942-01-10T12:00:00Z', '2026-09-27T08:34:18.903Z', 'Mercury', 'opposition', 'sextile', 'different', 'adverse', 'favourable'],
    ['1944-03-03T12:00:00Z', '2026-05-10T06:23:26.949Z', 'Moon', 'square', 'square', 'akin', 'adverse', 'adverse'],
  ]) {
    const birthAt = Date.parse(birth);
    const run = annualRun(birthAt, 2026, 'Europe/London');
    validateFortuneFacts(run);
    const match = directionMatch(run);
    const fact = run.facts.find(row => row.factType === directionType && row.exactInstant === at
      && row.normalizedPayload.transitBody === 'Neptune' && row.normalizedPayload.natalTargetId === target
      && row.normalizedPayload.directionAspectType === directionAspect);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.progressedBody, p.directionNatalTargetId, p.directionAspectType, p.aspectType],
      [target, 'Neptune', directionAspect, transitAspect]);
    assert.deepEqual([p.natureRelation, p.directionNature, p.transitNature], [relation, directionNature, transitNature]);
    const confirmed = target === 'Moon' && directionNature === 'favourable';
    assert.equal(p.fellowshipTransitBandProfile, confirmed ? heindelSourcePolicy.fellowshipTransitBandProfile : undefined);
    assert.equal(p.fellowshipNeptuneAdverseTransitBandProfile, undefined);
    const scoped = directionMatch({ ...run, facts: [fact] });
    assert.equal(scoped.status, confirmed ? 'matched' : 'partial');
    if (confirmed) {
      assert.ok(match.sourceFactIds.includes(fact.factId));
      assert.deepEqual(scoped.windows, [{ start: at, endExclusive: fact.activeTo }]);
      const rawBand = rows(run).find(row => row.normalizedPayload.fellowshipTransitBandProfile === p.fellowshipTransitBandProfile
        && row.activeFrom <= at && at < row.activeTo && row.normalizedPayload.natalTargetId === target);
      assert.ok(rawBand);
      for (const override of [{ fellowshipTransitBandProfile: undefined }, { natureRelation: 'different' },
        { dateBasis: 'UTC-birth-date-candidate' }]) {
        const only = { ...run, facts: [{ ...fact, normalizedPayload: { ...p, ...override } }] };
        assert.equal(directionMatch(only).status, 'partial');
      }
    }
    const interval = run.facts.find(row => row.factType === 'aspect_interval' && row.normalizedPayload.transitBody === 'Neptune'
      && row.normalizedPayload.natalTargetId === target && row.normalizedPayload.aspectType === transitAspect
      && row.activeFrom <= at && at < row.activeTo);
    assert.ok(interval && interval.sourceFactIds.every(id => fact.sourceFactIds.includes(id)));
    const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
    const source = buildHeindelSourceContext(window, chart(birthAt));
    const [cutOff] = linkHeindelTransits(source, [{ ...interval, activeTo: at }]);
    assert.ok(cutOff && cutOff.directionContacts.every(item => item.start < Date.parse(at)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'heindel-neptune-conditions'));
    const text = formatFortuneFactAudit(input);
    assert.ok(text.includes('按原书具名组合的条件，次限列作' + (directionNature === 'favourable' ? '偏顺' : '偏难')));
    const provider = formatFortunePrompt(input);
    if (confirmed) assert.match(provider, /实际海王星对本命月亮的六合或三分也在同学派课程的一度半范围内/u);
    assert.doesNotMatch(provider, /按原书具名组合的条件|heindel_direction_transit_overlap|fellowshipTransitBandProfile/u);
  }
});

test('Heindel reads an opposite-nature Mercury and Neptune contact only inside the verified strong transit band', () => {
  const timeZone = 'Europe/London';
  for (const [birth, at, deviation, within] of [
    ['1942-01-10T11:50:00Z', '2026-09-30T08:44:46.930Z', 1.479677736, true],
    ['1942-01-10T11:51:00Z', '2026-09-29T08:43:44.148Z', 1.506213666, false],
  ]) {
    const birthAt = Date.parse(birth), instant = Date.parse(at);
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const point = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && exactInstant === at && p.transitBody === 'Neptune' && p.natalTargetId === 'Mercury'
      && p.progressedBody === 'Mercury' && p.directionNatalTargetId === 'Neptune'
      && p.directionAspectType === 'opposition' && p.aspectType === 'sextile');
    assert.ok(point, birth);
    const p = point.normalizedPayload;
    assert.deepEqual([p.directionNature, p.transitNature, p.natureRelation], ['adverse', 'favourable', 'different']);
    assert.equal(p.fellowshipTransitBandProfile, within ? heindelSourcePolicy.fellowshipTransitBandProfile : undefined);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, timeZone));
    const longitude = (body, when) => Ecliptic(GeoVector(Body[body], new Date(when), true)).elon;
    const direction = Math.abs(arc(readHeindelPosition(clock, 'Mercury', instant) - longitude('Neptune', birthAt)));
    const transit = Math.abs(arc(longitude('Neptune', instant) - longitude('Mercury', birthAt)));
    assert.ok(Math.abs(direction - 180) < 0.00001);
    assert.ok(Math.abs(Math.abs(transit - 60) - deviation) < 0.000001);
    const scoped = { ...run, facts: [point] };
    const result = directionMatch(scoped);
    assert.equal(result.status, within ? 'matched' : 'partial');
    assert.deepEqual(result.windows, [{ start: at, endExclusive: point.activeTo }]);
    if (!within) continue;
    assert.match(result.matchedSourceExcerpt, /or weaken effects of aspects in the progressed horoscope/u);
    assert.ok(directionMatch(run).sourceFactIds.includes(point.factId));
    for (const override of [{ fellowshipTransitBandProfile: undefined }, { natureRelation: 'akin' },
      { directionNatalTargetId: 'Venus' }, { dateBasis: 'UTC-birth-date-candidate' }]) {
      const changed = { ...point, normalizedPayload: { ...p, ...override } };
      assert.equal(directionMatch({ ...run, facts: [changed] }).status, 'partial');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-adjusted-contrast'));
    assert.match(formatFortuneFactAudit(input), /两类接触性质不同/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /两项性质不同，只在它们实有交集的时点参考原书所述的减弱倾向/u);
    assert.doesNotMatch(prompt, /两类接触性质不同|natureRelation|fellowshipTransitBandProfile|08:44:46/u);
  }
});

test('Heindel confirms favourable Mercury and Moon directions against adverse Neptune only inside the verified transit band', () => {
  const timeZone = 'Europe/London';
  const samples = [
    ['1942-09-02T12:00:00Z', '2026-04-18T03:18:07.345Z', 'Mercury', 'sextile', 'opposition', 0.184464499, true],
    ['1957-09-30T13:55:00Z', '2026-08-28T12:44:37.693Z', 'Moon', 'trine', 'square', 1.495320411, true],
    ['1957-09-30T13:56:00Z', '2026-08-28T12:45:35.142Z', 'Moon', 'trine', 'square', 1.504095046, false],
  ];
  const longitude = (body, when) => Ecliptic(GeoVector(Body[body], new Date(when), true)).elon;
  const angles = { sextile: 60, square: 90, trine: 120, opposition: 180 };
  const profile = heindelSourcePolicy.fellowshipNeptuneAdverseTransitBandProfile;
  for (const [birth, exact, target, progression, transit, deviation, confirmed] of samples) {
    const birthAt = Date.parse(birth), instant = Date.parse(exact);
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const isPair = p => p.transitBody === 'Neptune' && p.natalTargetId === target && p.aspectType === transit;
    const point = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && exactInstant === exact && isPair(p) && p.progressedBody === target && p.directionNatalTargetId === 'Neptune'
      && p.directionAspectType === progression);
    assert.ok(point, birth);
    const p = point.normalizedPayload;
    const band = rows(run).find(row => row.activeFrom <= exact && exact < row.activeTo && isPair(row.normalizedPayload)
      && row.normalizedPayload.fellowshipNeptuneAdverseTransitBandProfile === profile);
    assert.deepEqual([p.directionNature, p.transitNature, p.natureRelation], ['favourable', 'adverse', 'different']);
    assert.equal(p.fellowshipNeptuneAdverseTransitBandProfile, confirmed ? profile : undefined);
    assert.equal(Boolean(band), confirmed);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, timeZone));
    const direction = Math.abs(arc(readHeindelPosition(clock, target, instant) - longitude('Neptune', birthAt)));
    const transitAngle = Math.abs(arc(longitude('Neptune', instant) - longitude(target, birthAt)));
    assert.ok(Math.abs(direction - angles[progression]) < 0.00001);
    assert.ok(Math.abs(Math.abs(transitAngle - angles[transit]) - deviation) < 0.000001);
    const isolated = { ...run, facts: [point] };
    const result = directionMatch(isolated);
    assert.equal(result.status, confirmed ? 'matched' : 'partial');
    assert.deepEqual(result.windows, [{ start: exact, endExclusive: point.activeTo }]);
    if (!confirmed) continue;
    assert.equal(band.normalizedPayload.natalTargetHasAffliction, true);
    assert.equal(result.matchedSourceExcerpt, 'or weaken effects of aspects in the progressed horoscope');
    assert.equal(directionMatch({ ...isolated, facts: [{ ...point, normalizedPayload: { ...p,
      dateBasis: 'UTC-birth-date-candidate' } }] }).status, 'partial');
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'heindel-adverse-transit-contrast'));
    assert.match(formatFortuneFactAudit(input), /两类接触性质不同/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /参考原书所述的减弱倾向/u);
    assert.doesNotMatch(prompt, /两类接触性质不同|fellowshipNeptuneAdverseTransitBandProfile|12:44:37/u);
  }
});

test('Heindel bounds adverse same-pair Neptune direction evidence to actual narrow transits', () => {
  for (const [birth, expected, target, progression, transit] of [
    ['1944-07-05T12:00:00Z', '2026-06-18T07:23:39.682Z', 'Moon', 'square', 'square'],
    ['1944-12-23T12:00:00Z', '2026-02-08T00:12:43.853Z', 'Mercury', 'opposition', 'square'],
    ['1944-01-16T12:00:00Z', '2026-01-28T02:23:19.017Z', 'Moon', 'conjunction', 'opposition'],
  ]) {
    const birthAt = Date.parse(birth), timeZone = 'Europe/London';
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const point = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && exactInstant === expected && p.transitBody === 'Neptune' && p.natalTargetId === target
      && p.progressedBody === target && p.directionNatalTargetId === 'Neptune'
      && p.directionAspectType === progression && p.aspectType === transit);
    assert.ok(point);
    const p = point.normalizedPayload, profile = heindelSourcePolicy.fellowshipNeptuneAdverseTransitBandProfile;
    assert.equal(p.fellowshipNeptuneAdverseTransitBandProfile, profile);
    assert.deepEqual([p.directionNature, p.transitNature, p.natureRelation], ['adverse', 'adverse', 'akin']);
    const band = rows(run).find(({ activeFrom, activeTo, normalizedPayload: b }) => activeFrom <= expected && expected < activeTo
      && b.fellowshipNeptuneAdverseTransitBandProfile === profile && b.natalTargetId === target && b.aspectType === transit);
    assert.ok(band?.normalizedPayload.natalTargetHasAffliction);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, timeZone));
    const exact = Date.parse(expected), natal = body => Ecliptic(GeoVector(Body[body], new Date(birthAt), true)).elon;
    const angles = { conjunction: 0, square: 90, opposition: 180 };
    assert.ok(Math.abs(Math.abs(arc(readHeindelPosition(clock, target, exact) - natal('Neptune'))) - angles[progression]) < 0.00001);
    const transitDeviation = Math.abs(Math.abs(arc(Ecliptic(GeoVector(Body.Neptune, new Date(exact), true)).elon
      - natal(target))) - angles[transit]);
    assert.ok(transitDeviation < 1.5);
    if (progression === 'conjunction') {
      assert.equal(p.allowedOrb, 0);
      assert.ok(Math.abs(transitDeviation - 1.2163530932) < 0.00001);
    }
    const context = { ...run, facts: [point, band] };
    const match = directionMatch(context);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: expected, endExclusive: point.activeTo }]);
    for (const changes of [{ fellowshipNeptuneAdverseTransitBandProfile: undefined }, { natureRelation: 'different' },
      { directionNatalTargetId: target }, { dateBasis: 'UTC-birth-date-candidate' }]) {
      const other = { ...point, normalizedPayload: { ...p, ...changes } };
      assert.equal(directionMatch({ ...run, facts: [other] }).status, 'partial');
    }
    const { input } = buildFortuneModelContext(context, interpretFortune(context, requestForFortuneRun(context), 'heindel-adverse-overlap'));
    const provider = formatFortunePrompt(input);
    assert.match(provider, progression === 'conjunction' ? /次限月亮实际与本命海王星成黄经合相/u : /只把两项实际重合的时点记为同向偏难的相参条件/u);
    assert.doesNotMatch(provider, /dreams and visions|fellowshipNeptuneAdverseTransitBandProfile|directionNatalTargetId|02:23:19/u);
  }

  const birth = Date.parse('1944-10-15T12:00:00Z');
  const expected = '2026-11-17T16:01:26.348Z';
  const timeZone = 'Europe/London';
  const birthContext = archiveClock(birth, timeZone);
  const source = buildHeindelSourceContext({ start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) },
    { ...chart(birth), birthContext });
  assert.ok(source.lunar.some(row => row.natalTargetId === 'Neptune' && row.aspectType === 'conjunction' && iso(row.start) === expected));
  const run = annualRun(birth, 2026, timeZone);
  const interval = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) => factType === 'aspect_interval'
    && activeFrom <= expected && expected < activeTo && p.transitBody === 'Neptune' && p.natalTargetId === 'Moon'
    && p.aspectType === 'opposition');
  assert.ok(interval);
  const at = Date.parse(expected);
  const lon = (body, instant) => Ecliptic(GeoVector(Body[body], new Date(instant), true)).elon;
  assert.ok(Math.abs(Math.abs(arc(lon('Neptune', at) - lon('Moon', birth))) - 180) < 1.5);
  const [link] = linkHeindelTransits(source, [interval]);
  assert.equal(link.natalTargetHasAffliction, true);
  assert.ok(!link.natalAspectEvidence.some(pair => pair.contacts.some(contact =>
    contact.band === 'standard' && contact.affected.includes('Neptune'))));
  assert.ok(!link.directionContacts.some(row => row.aspectType === 'conjunction' && iso(row.start) === expected));
  const atSameTime = run.facts.filter(row => row.factType === directionType && row.activeFrom <= expected && expected < row.activeTo);
  const match = directionMatch({ ...run, facts: atSameTime });
  assert.ok(!match?.windows.some(window => window.start === expected && window.endExclusive === iso(at + 1)));
});

test('Heindel confirms harmonious Moon and Mercury progressions at actual Neptune conjunctions only within the strong band', () => {
  const conjunctionRule = row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001');
  const knownBand = heindelSourcePolicy.fellowshipTransitBandProfile;
  const samples = [
    ['1937-05-07T10:39:00Z', '2026-07-08T11:41:59.142Z', 'Moon', '月亮', 'sextile', 60, 1.497833, true],
    ['1937-05-07T10:38:00Z', '2026-07-08T11:42:15.436Z', 'Moon', '月亮', 'sextile', 60, 1.507885, false],
    ['1959-04-08T16:00:00Z', '2026-03-12T07:41:29.459Z', 'Mercury', '水星', 'trine', 120, 0.299272, true],
    ['1959-04-08T12:00:00Z', '2026-05-15T03:10:23.916Z', 'Mercury', '水星', 'trine', 120, 2.458614, false],
  ];
  for (const [birth, at, receiver, label, aspect, angle, expectedDeviation, within] of samples) {
    const birthAt = Date.parse(birth);
    const run = annualRun(birthAt, 2026, 'UTC');
    validateFortuneFacts(run);
    const overlap = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) =>
      factType === directionType && exactInstant === at && p.directionKind === 'exact_point'
      && p.transitBody === 'Neptune' && p.natalTargetId === receiver && p.aspectType === 'conjunction'
      && p.progressedBody === receiver && p.directionNatalTargetId === 'Neptune' && p.directionAspectType === aspect);
    assert.ok(overlap, birth);
    const p = overlap.normalizedPayload;
    assert.equal(p.dateBasis, 'archive-local-birthday');
    assert.deepEqual([p.directionNature, p.transitNature, p.natureRelation], ['favourable', 'favourable', 'akin']);
    assert.equal(p.fellowshipTransitBandProfile, within ? knownBand : undefined);
    const ephemerisLongitude = (body, time) => Ecliptic(GeoVector(Body[body], new Date(time), true)).elon;
    const natalReceiver = ephemerisLongitude(receiver, birthAt);
    const actualNeptune = ephemerisLongitude('Neptune', at);
    const deviation = Math.abs(arc(actualNeptune - natalReceiver));
    assert.ok(Math.abs(deviation - expectedDeviation) < 0.00001, birth);
    assert.equal(deviation < 1.5, within, birth);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, 'UTC'));
    const segment = heindelProgressionSegment(clock, Date.parse(at));
    const first = ephemerisLongitude(receiver, segment.ephemerisStart);
    const last = ephemerisLongitude(receiver, segment.ephemerisEnd);
    const progressedReceiver = first + arc(last - first) * segment.fraction;
    assert.ok(Math.abs(Math.abs(arc(progressedReceiver - ephemerisLongitude('Neptune', birthAt))) - angle) < 0.00001);
    const rawBand = rows(run).find(({ activeFrom, activeTo, normalizedPayload: q }) => activeFrom <= at && at < activeTo
      && q.transitBody === 'Neptune' && q.natalTargetId === receiver && q.aspectType === 'conjunction'
      && q.kind === 'interval' && q.fellowshipTransitBandProfile === knownBand);
    assert.equal(Boolean(rawBand), within, birth);
    const scoped = { ...run, facts: [overlap] };
    const result = directionMatch(scoped);
    assert.equal(result.status, within ? 'matched' : 'partial');
    if (within) {
      assert.deepEqual(result.windows, [{ start: at, endExclusive: overlap.activeTo }]);
      const conjunction = matchFortuneKnowledge({ ...run, facts: [rawBand] }).byMethod.western.find(conjunctionRule);
      assert.equal(conjunction.status, 'matched');
      assert.equal(conjunction.matchedSourceExcerpt, 'dreams and visions');
      for (const override of [{ dateBasis: 'UTC-birth-date-candidate' }, { natureRelation: 'different' }]) {
        const altered = { ...overlap, normalizedPayload: { ...p, ...override } };
        assert.equal(directionMatch({ ...run, facts: [altered] }).status, 'partial');
      }
    }
    const { input } = buildFortuneModelContext(scoped,
      interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-neptune-conjunction-and-lunar'));
    const detail = '按原书具名组合的条件，次限列作偏顺';
    assert.ok(formatFortuneFactAudit(input).includes(detail), birth);
    const prompt = formatFortunePrompt(input);
    assert.equal(prompt.includes('一度半范围内合本命' + label), within);
    assert.equal(/原文：akin in nature/u.test(prompt), within);
    assert.ok(!prompt.includes(detail) && !prompt.includes(at.slice(11, 19)));
    assert.doesNotMatch(prompt, /fellowshipTransitBandProfile/u);
  }
});

test('Heindel confirms both exact harmonious Mercury–Neptune directions only inside the actual Mercury transit band', () => {
  for (const [birth, expected, moving, fixed] of [
    ['1940-08-14T12:00:00Z', '2026-06-25T10:57:39.853Z', 'Mercury', 'Neptune'],
    ['1944-07-13T12:00:00Z', '2026-08-01T01:33:15.781Z', 'Neptune', 'Mercury'],
  ]) {
    const birthAt = Date.parse(birth), timeZone = 'Europe/London';
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const fact = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && p.natalTargetId === 'Mercury' && p.transitBody === 'Neptune' && p.aspectType === 'trine'
      && p.progressedBody === moving && p.directionNatalTargetId === fixed && p.directionAspectType === 'sextile'
      && Math.abs(Date.parse(exactInstant) - Date.parse(expected)) < 1000);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.equal(p.natureRelation, 'akin');
    assert.equal(p.fellowshipTransitBandProfile, heindelSourcePolicy.fellowshipTransitBandProfile);
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, timeZone));
    const at = Date.parse(fact.exactInstant);
    const natalLongitude = body => Ecliptic(GeoVector(Body[body], new Date(birthAt), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(readHeindelPosition(clock, moving, at) - natalLongitude(fixed))) - 60) < 0.00001);
    const transitLongitude = Ecliptic(GeoVector(Body.Neptune, new Date(at), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(transitLongitude - natalLongitude('Mercury'))) - 120) < 1.5);
    const band = rows(run).find(({ activeFrom, activeTo, normalizedPayload: p }) => activeFrom <= fact.activeFrom
      && fact.activeFrom < activeTo && p.fellowshipTransitBandProfile && p.natalTargetId === 'Mercury' && p.aspectType === 'trine');
    assert.ok(band);
    const context = { ...run, facts: [fact, band] };
    const matched = matchFortuneKnowledge(context).byMethod.western;
    assert.equal(matched.find(row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001')).status, 'matched');
    const overlap = directionMatch(context);
    assert.equal(overlap.status, 'matched');
    assert.deepEqual(overlap.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    for (const changes of [{ natureRelation: 'different' }, { fellowshipTransitBandProfile: undefined },
      { directionNatalTargetId: moving }, { dateBasis: 'UTC-birth-date-candidate' }]) {
      const alternative = { ...fact, normalizedPayload: { ...p, ...changes } };
      assert.equal(directionMatch({ ...run, facts: [alternative] }).status, 'partial');
    }
    const { input } = buildFortuneModelContext(context, interpretFortune(context, requestForFortuneRun(context), 'heindel-mercury-overlap'));
    const provider = formatFortunePrompt(input);
    assert.match(provider, /次限水星六合或三分本命海王星，或次限海王星六合或三分本命水星实际成相时/u);
    assert.doesNotMatch(provider, /fellowshipTransitBandProfile|directionNatalTargetId/u);
  }
});

test('Heindel Jupiter verifies actual same-pair Mercury and Venus directions inside the strong transit band', () => {
  for (const [birth, expected, moving, fixed, receiver, directionAngle, transitAngle, directionAspect, transitAspect] of [
    ['1936-01-24T12:00:00Z', '2026-11-21T02:39:55.082Z', 'Venus', 'Jupiter', 'Venus', 120, 120, 'trine', 'trine'],
    ['1949-06-13T12:00:00Z', '2026-08-06T20:21:48.280Z', 'Mercury', 'Jupiter', 'Mercury', 120, 60, 'trine', 'sextile'],
    ['1996-03-17T12:00:00Z', '2026-01-24T01:42:39.372Z', 'Jupiter', 'Mercury', 'Mercury', 60, 120, 'sextile', 'trine'],
  ]) {
    const birthAt = Date.parse(birth), timeZone = 'Europe/London';
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    const fact = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && p.natalTargetId === receiver && p.transitBody === 'Jupiter' && p.aspectType === transitAspect
      && p.progressedBody === moving && p.directionNatalTargetId === fixed && p.directionAspectType === directionAspect
      && p.fellowshipJupiterTransitBandProfile === heindelSourcePolicy.fellowshipJupiterTransitBandProfile
      && Math.abs(Date.parse(exactInstant) - Date.parse(expected)) < 1000);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.equal(p.natureRelation, 'akin');
    assert.equal(p.directionNature, 'favourable');
    assert.equal(p.transitNature, 'favourable');
    const clock = heindelCalculationDate(birthAt, archiveClock(birthAt, timeZone));
    const at = Date.parse(fact.exactInstant);
    const natalLongitude = body => Ecliptic(GeoVector(Body[body], new Date(birthAt), true)).elon;
    const progressedLongitude = readHeindelPosition(clock, moving, at);
    assert.ok(Math.abs(Math.abs(arc(progressedLongitude - natalLongitude(fixed))) - directionAngle) < 0.00001);
    const transitLongitude = Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
    assert.ok(Math.abs(Math.abs(arc(transitLongitude - natalLongitude(receiver))) - transitAngle) < 1.5);
    const band = rows(run).find(({ activeFrom, activeTo, normalizedPayload: p }) => activeFrom <= fact.activeFrom
      && fact.activeFrom < activeTo && p.fellowshipJupiterTransitBandProfile && p.natalTargetId === receiver
      && p.aspectType === transitAspect);
    assert.ok(band?.normalizedPayload.natalTargetHasSupport);
    assert.equal(band.normalizedPayload.natalTargetHasAffliction, false);
    const context = { ...run, facts: [fact, band] };
    const overlap = directionMatch(context);
    assert.equal(overlap.status, 'matched');
    assert.deepEqual(overlap.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    for (const changes of [{ natureRelation: 'different' }, { fellowshipJupiterTransitBandProfile: undefined },
      { natalTargetId: receiver === 'Mercury' ? 'Venus' : 'Mercury' }, { dateBasis: 'UTC-birth-date-candidate' }]) {
      const alternative = { ...fact, normalizedPayload: { ...p, ...changes } };
      assert.notEqual(directionMatch({ ...run, facts: [alternative] }).status, 'matched');
    }
    const { input } = buildFortuneModelContext(context, interpretFortune(context, requestForFortuneRun(context), 'heindel-jupiter-overlap'));
    const provider = formatFortunePrompt(input);
    assert.match(provider, /同一对本命与次限水木或金木实际形成六合或三分/u);
    assert.doesNotMatch(provider, /fellowshipJupiterTransitBandProfile|directionNatalTargetId/u);
  }
});

test('Heindel lunar Jupiter qualifies the named roles only with favourable natal evidence on both sides', () => {
  const timeZone = 'Europe/London';
  const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
  for (const [birth, at, directionAspect, directionAngle, transitAspect, transitAngle, expectedDeviation, qualified] of [
    ['1964-03-16T12:00:00Z', '2026-12-14T02:10:44.206Z', 'trine', 120, 'trine', 120, 0.87206246, true],
    ['1911-05-01T12:00:00Z', '2026-09-13T11:34:47.954Z', 'sextile', 60, 'sextile', 60, 0.49738186, false],
    ['1994-10-03T12:00:00Z', '2026-02-16T17:46:40.871Z', 'conjunction', 0, 'sextile', 60, 1.41071417, true],
  ]) {
    const birthAt = Date.parse(birth);
    const source = buildHeindelSourceContext(window, { ...chart(birthAt), birthContext: archiveClock(birthAt, timeZone) });
    const run = annualRun(birthAt, 2026, timeZone);
    validateFortuneFacts(run);
    assert.equal(source.status, 'ready');
    const point = Date.parse(at);
    const fromEphemeris = (body, time) => Ecliptic(GeoVector(Body[body], new Date(time), true)).elon;
    const movingMoon = readHeindelPosition(source.clock, 'Moon', point);
    assert.ok(Math.abs(Math.abs(arc(movingMoon - fromEphemeris('Jupiter', birthAt))) - directionAngle) < 0.00001);
    const transitDeviation = Math.abs(Math.abs(arc(fromEphemeris('Jupiter', point) - fromEphemeris('Moon', birthAt))) - transitAngle);
    assert.ok(Math.abs(transitDeviation - expectedDeviation) < 0.00001);
    for (const planet of ['Moon', 'Jupiter']) {
      const contacts = source.natalPairs.filter(pair => pair.first === planet || pair.second === planet)
        .flatMap(pair => pair.contacts.filter(contact => contact.band === 'standard'));
      assert.ok(contacts.some(contact => contact.assessment === 'support'), planet);
      assert.equal(contacts.some(contact => contact.affected.includes(planet)), planet === 'Jupiter' && !qualified);
    }
    const fact = run.facts.find(({ factType, exactInstant, normalizedPayload: p }) => factType === directionType
      && exactInstant === at && p.transitBody === 'Jupiter' && p.natalTargetId === 'Moon'
      && p.progressedBody === 'Moon' && p.directionNatalTargetId === 'Jupiter'
      && p.aspectType === transitAspect && p.directionAspectType === directionAspect);
    assert.ok(fact, birth);
    const p = fact.normalizedPayload;
    assert.equal(p.fellowshipJupiterTransitBandProfile, heindelSourcePolicy.fellowshipJupiterTransitBandProfile);
    assert.equal(p.transitNature, 'favourable');
    assert.equal(p.directionNature, qualified ? 'favourable' : undefined);
    assert.equal(p.natureRelation, qualified ? 'akin' : 'unclassified');
    const scoped = { ...run, facts: [fact] };
    const match = directionMatch(scoped);
    assert.equal(match.status, qualified ? 'matched' : 'partial');
    assert.deepEqual(match.windows, [{ start: at, endExclusive: iso(point + 1) }]);
    const rawTransit = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
      factType === 'aspect_interval' && activeFrom <= at && at < activeTo && p.transitBody === 'Jupiter'
      && p.natalTargetId === 'Moon' && p.aspectType === transitAspect);
    assert.ok(rawTransit && rawTransit.sourceFactIds.every(id => fact.sourceFactIds.includes(id)), birth);
    const [stopsAtPoint] = linkHeindelTransits(source, [{ ...rawTransit, activeTo: at }]);
    assert.ok(stopsAtPoint);
    assert.ok(!stopsAtPoint.directionContacts.some(item => item.start === point && item.progressedBody === 'Moon'));
    for (const changed of [{ progressedBody: 'Jupiter', directionNatalTargetId: 'Moon' }, { aspectType: 'conjunction' },
      { dateBasis: 'UTC-birth-date-candidate' }, { fellowshipJupiterTransitBandProfile: undefined }]) {
      assert.notEqual(directionMatch({ ...scoped, facts: [{ ...fact, normalizedPayload: { ...p, ...changed } }] }).status, 'matched');
    }
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-lunar-jupiter'));
    assert.match(formatFortuneFactAudit(input), /推运月亮对本命木星/u);
    const prompt = formatFortunePrompt(input);
    const staticCondition = /本命木星和本命月亮各有已核相位支持/u;
    if (qualified) assert.match(prompt, staticCondition);
    else assert.doesNotMatch(prompt, staticCondition);
    assert.doesNotMatch(prompt, /fellowshipJupiterTransitBandProfile|推运月亮对本命木星|directionNatalTargetId/u);
  }
});

test('Heindel pairs the real Uranus opposition with exact Venus directions only in the Fellowship strong band', () => {
  for (const [born, exactAt, directionAspect, relation, expected] of [
    ['1930-10-16T12:00:00Z', '2026-06-16T13:18:14.410Z', 'trine', 'different', 'matched'],
    ['1945-12-09T12:00:00Z', '2026-07-21T16:40:16.279Z', 'square', 'akin', 'matched'],
    ['1945-12-09T15:00:00Z', '2026-06-04T02:43:04.050Z', 'square', 'akin', 'partial'],
  ]) {
    const birth = Date.parse(born), instant = Date.parse(exactAt);
    const run = annualRun(birth, 2026, 'UTC');
    validateFortuneFacts(run);
    const point = run.facts.find(fact => {
      const p = fact.normalizedPayload;
      return fact.factType === directionType && p.transitBody === 'Uranus' && p.natalTargetId === 'Venus'
        && p.aspectType === 'opposition' && p.directionKind === 'exact_point'
        && p.progressedBody === 'Venus' && p.directionNatalTargetId === 'Uranus' && p.directionAspectType === directionAspect
        && Math.abs(Date.parse(fact.exactInstant) - instant) < 1_000;
    });
    assert.ok(point, born);
    const p = point.normalizedPayload;
    assert.equal(p.natureRelation, relation);
    assert.equal(p.transitNature, 'adverse');
    assert.equal(p.directionNature, relation === 'akin' ? 'adverse' : 'favourable');
    const at = Date.parse(point.exactInstant);
    const uranus = Ecliptic(GeoVector(Body.Uranus, new Date(at), true)).elon;
    const natalVenus = Ecliptic(GeoVector(Body.Venus, new Date(birth), true)).elon;
    const deviation = Math.abs(Math.abs(arc(uranus - natalVenus)) - 180);
    const clock = heindelCalculationDate(birth, archiveClock(birth, 'UTC'));
    const natalUranus = Ecliptic(GeoVector(Body.Uranus, new Date(birth), true)).elon;
    const progressedVenus = readHeindelPosition(clock, 'Venus', at);
    assert.ok(Math.abs(Math.abs(arc(progressedVenus - natalUranus)) - (directionAspect === 'square' ? 90 : 120)) < 0.000001);
    assert.equal(deviation < 1.5, expected === 'matched');
    assert.equal(p.fellowshipUranusTransitBandProfile, expected === 'matched' ? heindelSourcePolicy.fellowshipUranusTransitBandProfile : undefined);

    const onlyPoint = { ...run, facts: [point] };
    const match = directionMatch(onlyPoint);
    assert.equal(match.status, expected);
    if (expected === 'matched') {
      assert.deepEqual(match.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
      const { input } = buildFortuneModelContext(onlyPoint, interpretFortune(onlyPoint, requestForFortuneRun(onlyPoint), 'heindel-uranus-venus'));
      const provider = formatFortunePrompt(input);
      assert.ok(provider.includes(match.matchedConditions[0]));
      assert.doesNotMatch(provider, /fellowshipUranusTransitBandProfile|13:18:14|16:40:16/u);
    }
  }
});

test('Moon–Neptune declination compares the actual parallel only with independently checked natal conditions', () => {
  const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
  const { fellowshipNeptuneAdverseTransitBandProfile, fellowshipTransitBandProfile } = heindelSourcePolicy;
  for (const [birth, expectedAt, oldAt, transitAspect, relation, hemisphere, bandDeviation] of [
    ['1950-12-24T12:00:00Z', '2026-03-14T09:13:55.631Z', '2026-03-14T11:04:56.605Z', 'square', 'akin', 'opposite', 1.312021872],
    ['1950-12-24T12:30:00Z', '2026-03-06T09:22:25.081Z', null, 'square', 'akin', 'opposite', 1.860238260],
    ['1940-03-19T12:00:00Z', '2026-11-03T18:40:54.887Z', '2026-11-03T20:44:17.009Z', 'trine', 'different', 'opposite', 3.364244898],
    ['1940-03-19T19:00:00Z', '2026-07-19T01:05:40.766Z', null, 'trine', 'different', 'opposite', 1.554016208],
    ['1940-03-19T20:00:00Z', '2026-07-03T13:56:43.880Z', null, 'trine', 'different', 'opposite', 0.987753492],
    ['1940-02-19T12:00:00Z', '2026-12-25T05:40:38.791Z', '2026-12-25T07:32:02.931Z', 'square', null, 'same', null],
  ]) {
    const birthAt = Date.parse(birth);
    const source = buildHeindelSourceContext(window, { ...chart(birthAt), birthContext: archiveClock(birthAt, 'Europe/London') });
    assert.equal(source.status, 'ready');
    const crossing = source.lunar.find(row => row.natalTargetId === 'Neptune' && row.aspectType === 'parallel'
      && Math.abs(row.start - Date.parse(expectedAt)) < 1000);
    assert.ok(crossing, birth);
    const at = iso(crossing.start);
    const movingDeclination = heindelDeclinationInSegment('Moon', heindelProgressionSegment(source.clock, crossing.start));
    const natalDeclination = equatorialDeclination('Neptune', birthAt);
    assert.ok(Math.abs(crossing.declination.progressed - movingDeclination) < 1e-6, birth);
    assert.ok(Math.abs(Math.abs(movingDeclination) - Math.abs(natalDeclination)) < 1e-6, birth);
    assert.equal(Math.sign(movingDeclination) === Math.sign(natalDeclination), hemisphere === 'same', birth);
    if (oldAt) {
      const oldDeclination = heindelDeclinationInSegment('Moon', heindelProgressionSegment(source.clock, Date.parse(oldAt)));
      assert.ok(Math.abs(Math.abs(oldDeclination) - Math.abs(natalDeclination)) > 0.0005, birth);
    }

    const run = annualRun(birthAt, 2026, 'Europe/London');
    validateFortuneFacts(run);
    const interval = run.facts.find(row => row.factType === 'aspect_interval' && row.activeFrom <= at && at < row.activeTo
      && row.normalizedPayload.transitBody === 'Neptune' && row.normalizedPayload.natalTargetId === 'Moon'
      && row.normalizedPayload.aspectType === transitAspect);
    assert.ok(interval, birth);
    const [link] = linkHeindelTransits(source, [interval]);
    assert.ok(link, birth);
    assert.ok(!link.directionContacts.some(row => row.aspectType === 'parallel' && iso(row.start) === oldAt), birth);
    assert.equal(link.natalAspectEvidence.some(pair => pair.contacts.some(contact =>
      contact.band === 'standard' && contact.affected.includes('Neptune'))), relation !== null, birth);
    if (transitAspect === 'square') assert.equal(link.natalTargetHasAffliction, true, birth);

    const isParallel = row => row.factType === directionType && row.exactInstant === at
      && row.normalizedPayload.transitBody === 'Neptune' && row.normalizedPayload.natalTargetId === 'Moon'
      && row.normalizedPayload.directionAspectType === 'parallel';
    const fact = run.facts.find(isParallel);
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== directionType || isParallel(row)
      || row.normalizedPayload.directionKind === 'no_overlap') };
    if (!relation) {
      assert.equal(fact, undefined, birth);
      assert.ok(!directionMatch(scoped).sourceFactIds.length, birth);
      continue;
    }
    assert.ok(fact && interval.sourceFactIds.every(id => fact.sourceFactIds.includes(id)), birth);
    assert.equal(fact.activeFrom, at, birth);
    assert.equal(fact.activeTo, iso(crossing.start + 1), birth);
    const p = fact.normalizedPayload;
    assert.deepEqual([p.directionKind, p.directionCoordinate, p.directionNature, p.transitNature, p.natureRelation],
      ['exact_point', 'equatorial_declination_of_date', 'adverse', transitAspect === 'square' ? 'adverse' : 'favourable', relation], birth);
    assert.deepEqual(p.directionDeclination, crossing.declination, birth);
    assert.equal(p.allowedOrb, 0, birth);
    const withinBand = bandDeviation !== null && bandDeviation < 1.5;
    if (bandDeviation !== null) {
      const physical = (body, time) => Ecliptic(GeoVector(Body[body], new Date(time), true)).elon;
      const angle = transitAspect === 'square' ? 90 : 120;
      const deviation = Math.abs(Math.abs(arc(physical('Neptune', crossing.start) - physical('Moon', birthAt))) - angle);
      assert.ok(Math.abs(deviation - bandDeviation) < 0.00001, birth);
    }
    assert.equal(p.fellowshipNeptuneAdverseTransitBandProfile, withinBand && relation === 'akin' ? fellowshipNeptuneAdverseTransitBandProfile : undefined, birth);
    assert.equal(p.fellowshipTransitBandProfile, withinBand && relation === 'different' ? fellowshipTransitBandProfile : undefined, birth);
    const match = directionMatch(scoped);
    assert.equal(match.status, withinBand ? 'matched' : 'partial', birth);
    assert.deepEqual(match.sourceFactIds, [fact.factId], birth);
    if (withinBand) {
      assert.deepEqual(match.windows, [{ start: at, endExclusive: fact.activeTo }]);
      for (const override of [{ directionCoordinate: undefined }, { directionNatalTargetId: 'Moon' }, { allowedOrb: 1 }]) {
        const other = { ...fact, normalizedPayload: { ...p, ...override } };
        assert.notEqual(directionMatch({ ...run, facts: [other] }).status, 'matched');
      }
    }
    const [cutOff] = linkHeindelTransits(source, [{ ...interval, activeTo: at }]);
    assert.ok(cutOff && !cutOff.directionContacts.some(row => row.aspectType === 'parallel' && row.start === crossing.start), birth);

    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-neptune-parallel'));
    assert.match(formatFortuneFactAudit(input), /按Heindel调整日候选，次限月亮与本命海王星的赤纬绝对值实等/u);
    const provider = formatFortunePrompt(input);
    const akin = /次限月亮与本命海王星赤纬绝对值实际相等/u;
    const different = /原书将这种异向关系用于参考短时缓和/u;
    if (withinBand && relation === 'akin') assert.match(provider, akin);
    else assert.doesNotMatch(provider, akin);
    if (withinBand && relation === 'different') {
      assert.match(provider, different);
      assert.match(provider, /or weaken effects of aspects in the progressed horoscope/u);
    } else assert.doesNotMatch(provider, different);
    assert.doesNotMatch(provider, /directionDeclination|equatorial_declination_of_date|赤纬绝对值实等|09:13:55|13:56:43/u);
  }
});

test('the same-pair solar parallels meet actual Jupiter and Saturn transits only inside their one-and-a-half-degree bands', () => {
  const samples = [
    ['1957-12-18T12:00:00Z', 'Jupiter', 'trine', 120, '2026-12-18T07:04:40.379Z', '2026-12-19T06:04:44.686Z', 0.664, true, 'favourable', '木星'],
    ['1921-12-19T12:00:00Z', 'Jupiter', 'trine', 120, '2026-11-08T17:16:20.948Z', '2026-11-10T01:21:58.210Z', 1.878, false, 'favourable', '木星'],
    ['1916-10-01T12:00:00Z', 'Saturn', 'opposition', 180, '2026-11-17T01:23:17.813Z', '2026-11-19T11:20:20.634Z', 0.467, true, 'adverse', '土星'],
    ['1924-01-03T12:00:00Z', 'Saturn', 'square', 90, '2026-06-21T22:20:38.344Z', '2026-06-23T06:51:19.312Z', 1.880, false, 'adverse', '土星'],
  ];
  const window = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };
  for (const [birth, body, aspect, angle, date, oldAt, error, qualifies, nature, name] of samples) {
    const born = Date.parse(birth);
    const snapshot = { ...chart(born), birthContext: archiveClock(born, 'UTC') };
    const calculated = buildHeindelSourceContext(window, snapshot);
    assert.equal(calculated.status, 'ready');
    const point = calculated.solarParallels.find(row => row.natalTargetId === body);
    assert.ok(point && Math.abs(point.start - Date.parse(date)) < 1_000, birth);
    const moving = heindelDeclinationInSegment('Sun', heindelProgressionSegment(calculated.clock, point.start));
    const natal = equatorialDeclination(body, born);
    assert.ok(Math.abs(Math.abs(moving) - Math.abs(natal)) < 1e-7, birth);
    assert.equal(Math.sign(moving) === Math.sign(natal), birth === samples[0][0], birth);
    const oldDeclination = heindelDeclinationInSegment('Sun', heindelProgressionSegment(calculated.clock, Date.parse(oldAt)));
    assert.ok(Math.abs(Math.abs(oldDeclination) - Math.abs(natal)) > 0.0005, birth);
    const actual = Ecliptic(GeoVector(Body[body], new Date(point.start), true)).elon;
    const natalSun = SunPosition(new Date(born)).elon;
    const deviation = Math.abs(Math.abs(arc(actual - natalSun)) - angle);
    assert.ok(Math.abs(deviation - error) < 0.001, birth);
    assert.equal(deviation < 1.5, qualifies, birth);

    const run = annualRun(born, 2026, 'UTC');
    validateFortuneFacts(run);
    const isDirection = ({ factType, normalizedPayload: p }) => factType === directionType
      && p.transitBody === body && p.natalTargetId === 'Sun' && p.aspectType === aspect
      && p.progressedBody === 'Sun' && p.directionNatalTargetId === body && p.directionAspectType === 'parallel';
    const fact = run.facts.find(isDirection);
    assert.ok(!run.facts.some(row => isDirection(row) && row.exactInstant === oldAt), birth);
    const scoped = { ...run, facts: run.facts.filter(row => row.factType !== directionType || isDirection(row)) };
    const profile = body === 'Jupiter' ? 'fellowshipJupiterTransitBandProfile' : 'fellowshipSaturnTransitBandProfile';
    const match = directionMatch(scoped);
    if (fact) {
      assert.equal(fact.exactInstant, iso(point.start), birth);
      assert.equal(Date.parse(fact.activeTo) - Date.parse(fact.activeFrom), 1, birth);
      const p = fact.normalizedPayload;
      assert.deepEqual([p.directionKind, p.directionCoordinate, p.directionNature, p.transitNature, p.natureRelation],
        ['exact_point', 'equatorial_declination_of_date', nature, nature, 'akin'], birth);
      assert.equal(p[profile] !== undefined, qualifies, birth);
    }
    assert.equal(match.status === 'matched', qualifies, birth);
    if (!qualifies) continue;
    assert.ok(fact, birth);
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const sourceCondition = '次限太阳与本命' + name + '达到绝对赤纬相等的真点';
    assert.ok(match.matchedConditions.some(condition => condition.includes(sourceCondition)));
    const assess = changes => evaluateFortuneRules('western', 'year', [{ ...fact, normalizedPayload: { ...fact.normalizedPayload, ...changes } }])
      .find(row => row.knowledgeId === match.knowledgeId).confirmations
      .find(row => row.sourceConditions?.some(condition => condition.includes(sourceCondition)));
    assert.deepEqual(assess({}).hits, [fact]);
    for (const changed of [{ dateBasis: 'UTC-birth-date-candidate' }, { directionNatalTargetId: 'Venus' },
      { directionCoordinate: 'ecliptic_longitude' }, { [profile]: 'other' }]) assert.deepEqual(assess(changed).hits, []);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'heindel-solar-parallel'));
    const local = new RegExp('次限太阳与本命' + name + '的赤纬绝对值实等', 'u');
    assert.match(formatFortuneFactAudit(input), local);
    const provider = formatFortunePrompt(input);
    assert.ok(provider.includes(sourceCondition));
    assert.doesNotMatch(provider, /赤纬绝对值实等|directionDeclination|fellowshipSaturnTransitBandProfile/u);
  }
});

test('an archived birthday across GMT midnight changes the progression and binds through client submission to SQLite', () => {
  const birthAt = Date.parse('1980-01-03T19:00:00Z');
  const snapshot = { ...chart(birthAt), birthContext: { ...archiveClock(birthAt, 'Asia/Taipei'), latitude: 25.03, longitude: 121.57 } };
  const year = 2026;
  const source = buildHeindelSourceContext({ start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) }, snapshot);
  assert.equal(source.status, 'ready');
  assert.equal(iso(source.clock.baseNoon), '1980-01-04T12:00:00.000Z');
  assert.ok(Math.abs(arc(readHeindelPosition(source.clock, 'Moon', source.sampleAt)
    - readHeindelPosition(heindelCalculationDate(birthAt), 'Moon', source.sampleAt))) > 0.001);
  const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year } };
  const asOf = Date.UTC(year, 5, 1, 12);
  const archive = { snapshotId: 'archived-heindel', profileId: 'archived-profile', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
  const heindelFacts = batch.facts.filter(fact => fact.factType.startsWith('heindel_'));
  assert.equal(heindelFacts.some(fact => /Asia\/Taipei|birthInstant|baseNoon|adjustedAt/u.test(JSON.stringify(fact))), false);
  const bind = value => bindClientFortuneRun(input, value, readClientFactTime(input, value, asOf), 'heindel-birthday', archive);
  const run = bind(batch);
  const basis = 'archive-local-birthday';
  const context = run.facts.find(fact => fact.factType === 'heindel_progression_context');
  assert.equal(context.normalizedPayload.dateBasis, basis);
  assert.ok(rows(run).length > 0);
  for (const fact of [...rows(run), ...run.facts.filter(fact => fact.factType === directionType)]) {
    assert.equal(fact.normalizedPayload.dateBasis, basis);
    assert.equal(fact.normalizedPayload.sourceClockVerified, false);
  }
  const match = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001'));
  assert.equal(match?.status, 'matched');
  assert.ok(match);
  assert.ok(match.sourceFactIds.length > 0);
  assert.ok(match.sourceFactIds.every(id => rows(run).some(fact => fact.factId === id && fact.normalizedPayload.dateBasis === basis)));
  assert.ok(rows(run).some(fact => match.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.fellowshipTransitBandProfile === heindelSourcePolicy.fellowshipTransitBandProfile));
  const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'heindel-birthday'));
  const prompt = formatFortuneFactAudit(modelInput);
  assert.match(prompt, /依出生档案时区取出生地民用生日/u);
  assert.doesNotMatch(prompt, /dateBasis|archive-local-birthday|Asia\/Taipei|1980-01-04T12:00:00/u);
  const conflict = structuredClone(batch);
  rows(conflict)[0].normalizedPayload.dateBasis = 'UTC-birth-date-candidate';
  assert.throws(() => bind(conflict), /Invalid fortune fact submission/u);
});

test('natural-language model input states ACD and lunar limitations, distinguishes each valid time, and never serializes source machinery or partial findings',async()=>{
  const run=realRun(),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'heindel-report'));
  assert.ok(input.facts.some(f=>f.type==='heindel_progression_context'));
  const prompt=formatFortuneFactAudit(input);
  for(const phrase of ['Heindel调整计算日候选','原文太阳一度半','月亮仅核精确过点','实际新月在','本命承诺','不能声称原法计时已完整核实'])assert.ok(prompt.includes(phrase),phrase);
  for(const secret of ['siderealResidualDegrees','heindel-acd-geometry','natalPairs','solarActiveAtExact','ephemerisStart','heindel-snapshot','heindel-run','sourceClockVerified'])assert.ok(!prompt.includes(secret),secret);
  assert.ok(input.sections.flatMap(s=>s.findings).filter(f=>f.knowledgeId.includes('heindel')).every(f=>isObservation(f.knowledgeId)));
  const p={...rows(run).find(f=>f.exactInstant).normalizedPayload,solarActiveAtExact:[]};
  const description=describeFortuneFact({method:'western',type:'heindel_transit_context',data:p},String);
  assert.match(description,/精确行运发生时有效的太阳候选相位：上述太阳范围内未见/u);
  assert.ok(!/[{}\[\]]/u.test(description));
  let called=false;const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{called=true;assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});
  await provider.interpret(input);assert.equal(called,true);assert.equal(heindelSourcePolicy.solarOrb,1.5);
});
