import { SiderealTime } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import type { FortuneFactRecord } from '../model/fortune-facts';
import { civilClockEpoch } from './period-window';
import { readWesternHouseFrame, scanCircularRegions } from './western-houses';
import { readProgressionBirth, readProgressionPosition } from './western-progressions';
import { buildLunationWindows } from './western-time-links';
import { readTransitLongitude, westernSearchPolicy, type Planet } from './solar-transits';

const day = 86_400_000;
const normalize = (n: number) => (n % 360 + 360) % 360;
const arc = (n: number) => normalize(n + 180) - 180;
const principal = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'] as const;
const targets = [...principal, 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
type NatalBody = typeof targets[number];
const benefics: ReadonlySet<NatalBody> = new Set(['Sun', 'Venus', 'Jupiter']);
const malefics: ReadonlySet<NatalBody> = new Set(['Mars', 'Saturn', 'Uranus', 'Neptune']);
const aspects = [{ type: 'conjunction', angle: 0 }, { type: 'sextile', angle: 60 },
  { type: 'square', angle: 90 }, { type: 'trine', angle: 120 }, { type: 'opposition', angle: 180 }];
const planetaryPowers = {
  Sun: [[4], 0], Moon: [[3], 1], Mercury: [[2, 5], 5], Venus: [[1, 6], 11], Mars: [[0, 7], 9],
  Jupiter: [[8, 11], 3], Saturn: [[9, 10], 6], Uranus: [[10], 7], Neptune: [[11], 3],
} as const;
type Window = { start: number; end: number };
export const heindelSourcePolicy = {
  version: 'heindel-acd-source-context-v9', profile: 'heindel-acd-geometry-candidate-v1',
  clock: 'directed-daily-noon-sidereal-ACD; archive-local-birthday-with-UTC-fallback',
  dateBases: ['archive-local-birthday', 'UTC-birth-date-candidate'],
  annualAnchor: 'ACD-calendar-anniversary-at-UTC-noon; clamp-Feb-29',
  interpolation: 'linear-between-noon-longitudes; one-twelfth-per-calendar-month',
  solarOrb: 1.5, lunarOrb: 'not-established; exact-crossings-only', planetaryOrb: 'not-established; exact-crossings-only',
  natalWitnessProfile: 'heindel-chapter-18-planetary-powers-v1',
  natalAspectProfile: 'heindel-simplified-scientific-natal-aspects-v1',
  natalLongitudeOrb: 6, natalParallelOrb: 1, natalParallelExtendedOrb: 1.5,
  directionProfile: 'heindel-acd-same-pair-direction-v1',
  lunationActivationProfile: 'heindel-natal-lunation-3-degree-v1', lunationOrb: 3,
  lunarDirectionActivationProfile: 'heindel-solar-lunar-direction-transit-v1',
  angleOverlapProfile: 'heindel-solar-saturn-radical-angle-v1',
  transitObservationProfile: 'heindel-chapter-27-exact-transit-observation-v1',
  fellowshipTransitBandProfile: 'rosicrucian-lesson-13-neptune-transit-1.5-v1', fellowshipTransitOrb: 1.5,
  fellowshipNeptuneAdverseTransitBandProfile: 'rosicrucian-lesson-13-neptune-adverse-transit-1.5-v1',
  fellowshipJupiterTransitBandProfile: 'rosicrucian-lesson-13-jupiter-transit-1.5-v1',
  fellowshipJupiterMildTransitBandProfile: 'rosicrucian-lesson-13-jupiter-mild-transit-1.5-v1',
  fellowshipSaturnTransitBandProfile: 'rosicrucian-lesson-13-saturn-transit-1.5-v1',
  fellowshipUranusTransitBandProfile: 'rosicrucian-lesson-13-uranus-adverse-transit-1.5-v1',
  fellowshipTransitLunationProfile: 'rosicrucian-lesson-13-actual-transit-lunation-v1',
  fellowshipTransitLunationMonthProfile: 'rosicrucian-lesson-13-continuous-transit-in-lunation-v1',
  coordinate: 'modern-apparent-geocentric-ecliptic-of-date; tropical-candidate',
  sourceClockVerified: false, natureInference: 'named-source-activations-and-transit-pairs; no-event-or-weight-inference',
} as const;

export function heindelStrongTransitWindows(window: Window, body: 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune', natalLongitude: number,
  aspect: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition', stations: number[]) {
  const read = (at: number) => readTransitLongitude(body, at);
  const angle = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 }[aspect];
  const direction = Math.sign(arc(read(window.start + (window.end - window.start) / 2) - natalLongitude));
  const centre = normalize(natalLongitude + direction * angle);
  const orb = heindelSourcePolicy.fellowshipTransitOrb;
  const scan = scanCircularRegions(window, read, [normalize(centre - orb), normalize(centre + orb)],
    westernSearchPolicy.sampleHours[body] * day / 24, stations);
  return scan.intervals.filter(({ longitude }) => Math.abs(arc(longitude - centre)) <= orb)
    .map(({ start, end }) => ({ start, end }));
}

export function readHeindelNatalPower(body: keyof typeof planetaryPowers, longitude: number) {
  if (!Number.isFinite(longitude)) throw new RangeError('Invalid Heindel natal longitude');
  const [domiciles, exaltation] = planetaryPowers[body];
  const sign = Math.floor(normalize(longitude) / 30);
  const opposite = (sign + 6) % 12;
  return { body, longitude, sign, domicile: domiciles.some(value => value === sign), detriment: domiciles.some(value => value === opposite),
    exaltationSign: exaltation === sign, fallSign: exaltation === opposite } as const;
}

type NatalPosition = { body: NatalBody; longitude: number; declination: number };

export function readHeindelNatalPair(first: NatalPosition, second: NatalPosition) {
  if (first.body === second.body || ![first.longitude, second.longitude, first.declination, second.declination].every(Number.isFinite)
    || Math.abs(first.declination) > 90 || Math.abs(second.declination) > 90) throw new RangeError('Invalid Heindel natal pair');
  const separation = Math.abs(arc(first.longitude - second.longitude));
  const declinationDifference = Math.abs(Math.abs(first.declination) - Math.abs(second.declination));
  const classify = (aspectType: string, deviation: number, band: 'standard' | 'extended') => {
    const hard = ['square', 'opposition'].includes(aspectType);
    const soft = ['sextile', 'trine'].includes(aspectType);
    const affected = hard ? [first.body, second.body]
      : soft ? [] : [...(malefics.has(second.body) ? [first.body] : []), ...(malefics.has(first.body) ? [second.body] : [])];
    const assessment = affected.length ? 'affliction'
      : soft || benefics.has(first.body) || benefics.has(second.body) ? 'support' : 'undetermined';
    return { aspectType, deviation, band, assessment, affected };
  };
  const longitude = aspects.find(row => Math.abs(separation - row.angle) <= heindelSourcePolicy.natalLongitudeOrb);
  return { first: first.body, second: second.body, separation, declinationDifference,
    contacts: [
      ...(longitude ? [classify(longitude.type, Math.abs(separation - longitude.angle), 'standard')] : []),
      ...(declinationDifference <= heindelSourcePolicy.natalParallelExtendedOrb
        ? [classify('parallel', declinationDifference, declinationDifference <= heindelSourcePolicy.natalParallelOrb ? 'standard' : 'extended')] : []),
    ] };
}

function archiveBirthdayNoon(birthAt: number, clock?: DestinyChartSnapshot['birthContext']) {
  if (clock?.precision !== 'minute' || clock.clockVersion !== 'gregory-iana-intl-v1'
    || Date.parse(clock.birthInstant) !== birthAt) return undefined;
  try {
    const localNoon = Math.floor(civilClockEpoch(birthAt, clock.timeZone) / day) * day + day / 2;
    // The fourfold rule covers only the two GMT half-days on either side.
    if (Math.abs(localNoon - birthAt) < day) return localNoon;
  } catch { /* An unreadable time zone cannot qualify the local birthday. */ }
}

export function heindelCalculationDate(birthAt: number, archiveClock?: DestinyChartSnapshot['birthContext']) {
  if (!Number.isFinite(new Date(birthAt).getTime())) throw new RangeError('Invalid Heindel birth time');
  const localNoon = archiveBirthdayNoon(birthAt, archiveClock);
  const baseNoon = localNoon ?? Math.floor(birthAt / day) * day + day / 2;
  const direction = birthAt < baseNoon ? 1 : -1;
  // Unwrap the sidereal arc in the specified direction. A circular error
  // could choose the next cycle near noon and shift the reference year.
  const required = Math.abs(baseNoon - birthAt) / day * 360;
  let adjustedAt = baseNoon, residual = required, advance = 0;
  let previous = SiderealTime(new Date(baseNoon)) * 15;
  // Simulate the precision of the book's printed h:m columns using the
  // same modern ephemeris. Equal residuals can correspond to two dates.
  const minutesPerDay = day / 60_000;
  const requiredMinutes = Math.round(Math.abs(baseNoon - birthAt) / 60_000);
  const baseMinute = Math.round(previous * 4) % minutesPerDay;
  const targetSiderealMinute = (baseMinute + direction * requiredMinutes + minutesPerDay) % minutesPerDay;
  const dates = [{ adjustedAt: baseNoon, siderealMinute: baseMinute }];
  let previousMinute = baseMinute, minuteAdvance = 0, residualMinutes = requiredMinutes;
  for (let i = 1; i <= 366 && (advance < required || minuteAdvance < requiredMinutes); i++) {
    const at = baseNoon + direction * i * day;
    const sidereal = SiderealTime(new Date(at)) * 15;
    advance += normalize(direction * (sidereal - previous));
    previous = sidereal;
    const error = Math.abs(advance - required);
    if (error < residual) { adjustedAt = at; residual = error; }

    const siderealMinute = Math.round(sidereal * 4) % minutesPerDay;
    minuteAdvance += (direction * (siderealMinute - previousMinute) + minutesPerDay) % minutesPerDay;
    previousMinute = siderealMinute;
    const minuteError = Math.abs(minuteAdvance - requiredMinutes);
    if (minuteError <= residualMinutes) {
      if (minuteError < residualMinutes) dates.length = 0;
      dates.push({ adjustedAt: at, siderealMinute });
      residualMinutes = minuteError;
    }
  }
  const printedMinuteComparison = { targetSiderealMinute, residualMinutes,
    dates: dates.sort((first, last) => first.adjustedAt - last.adjustedAt),
    includesPreciseDate: dates.some(row => row.adjustedAt === adjustedAt) };
  return { birthAt, baseNoon, adjustedAt, siderealResidualDegrees: residual, printedMinuteComparison,
    dateBasis: localNoon === undefined ? 'UTC-birth-date-candidate' : 'archive-local-birthday', sourceClockVerified: false } as const;
}
export type HeindelClock = ReturnType<typeof heindelCalculationDate>;

function monthAnchor(clock: HeindelClock, months: number) {
  const base = new Date(clock.adjustedAt), index = base.getUTCFullYear() * 12 + base.getUTCMonth() + months;
  const year = Math.floor(index / 12), month = (index % 12 + 12) % 12;
  return Date.UTC(year, month, Math.min(base.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), 12);
}
export function heindelProgressionSegment(clock: HeindelClock, at: number) {
  if (!Number.isFinite(new Date(at).getTime()) || at < clock.birthAt) throw new RangeError('Invalid Heindel real time');
  const base = new Date(clock.adjustedAt), date = new Date(at);
  let months = (date.getUTCFullYear() - base.getUTCFullYear()) * 12 + date.getUTCMonth() - base.getUTCMonth();
  if (monthAnchor(clock, months) > at) months--;
  const yearIndex = Math.floor(months / 12), monthIndex = (months % 12 + 12) % 12;
  const start = monthAnchor(clock, months), end = monthAnchor(clock, months + 1);
  return { start, end, ephemerisStart: clock.baseNoon + yearIndex * day,
    ephemerisEnd: clock.baseNoon + (yearIndex + 1) * day,
    fraction: (monthIndex + (at - start) / (end - start)) / 12, monthIndex };
}
function readHeindelCoordinates(clock: HeindelClock, body: Planet, at: number) {
  const segment = heindelProgressionSegment(clock, at);
  // The historical ephemeris tabulates each noon's declination in its own
  // equator. Only the fixed natal target uses the equator at birth.
  const first = readProgressionPosition(body, segment.ephemerisStart, segment.ephemerisStart);
  const last = readProgressionPosition(body, segment.ephemerisEnd, segment.ephemerisEnd);
  return {
    longitude: normalize(first.longitude + arc(last.longitude - first.longitude) * segment.fraction),
    declination: first.declination + (last.declination - first.declination) * segment.fraction,
  };
}
export function readHeindelPosition(clock: HeindelClock, body: Planet, at: number) {
  return readHeindelCoordinates(clock, body, at).longitude;
}

// Both axes are linear within one ACD calendar month. Solve the actual
// threshold intersections, including wrap, rather than manufacturing a lunar
// orb, converting a whole new-moon month into an instant, or re-evaluating the
// ephemeris at a fractional day instead of interpolating the book's endpoints.
export function heindelLinearContacts(window: Window, first: number, last: number, target: number, orb: number) {
  if (!(window.end > window.start) || ![first, last, target, orb].every(Number.isFinite) || orb < 0 || orb >= 30) throw new RangeError('Invalid Heindel linear contact');
  const delta = arc(last - first), end = first + delta;
  const contacts = [];
  for (const aspect of aspects) for (const offset of [0, 180].includes(aspect.angle) ? [aspect.angle] : [aspect.angle, -aspect.angle]) {
    const center = first + arc(target + offset - first), x = first - center, y = end - center;
    if (orb === 0) {
      if (!delta) continue; // A constant equality is not a timed crossing.
      const fraction = -x / delta, at = Math.round(window.start + fraction * (window.end - window.start));
      if (fraction >= 0 && fraction < 1 && window.start <= at && at < window.end) contacts.push({
        start: at, end: at, aspectType: aspect.type, exactAngle: aspect.angle, exactTimes: [at], allowedOrb: 0,
      });
    } else {
      const edges = delta ? [(-orb - x) / delta, (orb - x) / delta].sort((a, b) => a - b) : [-Infinity, Infinity];
      if (!delta && Math.abs(x) > orb) continue;
      const a = Math.max(0, edges[0]), b = Math.min(1, edges[1]);
      if (!(a < b)) continue;
      const start = Math.round(window.start + a * (window.end - window.start));
      const finish = Math.round(window.start + b * (window.end - window.start));
      const exact = delta ? Math.round(window.start - x / delta * (window.end - window.start)) : undefined;
      if (start < finish) contacts.push({ start, end: finish, aspectType: aspect.type, exactAngle: aspect.angle,
        exactTimes: exact !== undefined && start <= exact && exact < finish ? [exact] : [], allowedOrb: orb });
    }
  }
  return contacts;
}
type Contact = ReturnType<typeof heindelLinearContacts>[number] & { progressedBody: Planet; natalTargetId: Planet;
  coordinate?: 'equatorial_declination_of_date'; declination?: { progressed: number; natal: number } };
type SolarAngle = ReturnType<typeof heindelLinearContacts>[number] & { natalTargetId: 'ASC' | 'MC'; natalLongitude: number };

function appendSolarBand<T extends { start: number; end: number; natalTargetId: string; aspectType: string; exactTimes: number[] }>(
  bands: T[], band: T, segmentStart: number,
) {
  const previous = bands.findLast(row => row.natalTargetId === band.natalTargetId && row.aspectType === band.aspectType
    && row.end === segmentStart);
  if (!previous || band.start !== segmentStart) bands.push(band);
  else {
    previous.end = band.end;
    previous.exactTimes.push(...band.exactTimes);
  }
}

function heindelInstantParallels(window: Window, first: number, last: number, natal: number,
  progressedBody: 'Sun' | 'Moon', natalTargetId: NatalBody): Contact[] {
  // The source compares unsigned declination, but daily interpolation stays signed.
  const change = last - first;
  if (!change) return [];
  const points = new Map<number, Contact>();
  for (const target of new Set([natal, -natal])) {
    const fraction = (target - first) / change;
    if (fraction < 0 || fraction >= 1) continue;
    const at = Math.round(window.start + fraction * (window.end - window.start));
    if (at >= window.end || points.has(at)) continue;
    points.set(at, { start: at, end: at, aspectType: 'parallel', exactAngle: 0, exactTimes: [at], allowedOrb: 0,
      progressedBody, natalTargetId, coordinate: 'equatorial_declination_of_date',
      declination: { progressed: target, natal } });
  }
  return [...points.values()];
}
type TransitNature = 'favourable' | 'adverse' | 'mild_adverse' | 'no_observed_gain' | 'hasty_reaction' | 'unclassified';
type NatalCondition = { support: boolean; affliction: boolean };
type DirectionOverlap = Contact & { directionKind: 'exact_point' | 'solar_band' | 'solar_lunar_direction_activation';
  natureRelation: 'akin' | 'different' | 'unclassified'; transitNature: TransitNature;
  directionNature?: 'favourable' | 'adverse';
  lunationActivations?: ReturnType<typeof heindelExampleLunationActivations>;
  lunarDirectionActivation?: { at: number; natalTargetId: Planet; aspectType: string } };

export function readHeindelTransitObservation(body: Planet, target: string, aspect: unknown, motion: unknown) {
  const soft = aspect === 'sextile' || aspect === 'trine';
  const hard = aspect === 'square' || aspect === 'opposition';
  if (body === 'Saturn') {
    if (target === 'Mercury') {
      if (soft && motion === 'direct') return 'favourable';
      if (hard && motion === 'retrograde') return 'adverse';
    } else if (soft && ['Sun', 'Moon', 'Venus', 'Jupiter'].includes(target)) return 'no_observed_gain';
  }
  if (body === 'Jupiter' && ['Sun', 'Moon', 'Venus', 'Mercury'].includes(target)
    && hard) return 'mild_adverse';
  if (body === 'Uranus' && ['Mars', 'Moon', 'Mercury'].includes(target)
    && aspect === 'conjunction') return 'hasty_reaction';
  return undefined;
}

function heindelTransitNature(body: NatalBody, target: NatalBody, aspect: unknown, motion: unknown,
  natal: NatalCondition): TransitNature {
  const soft = aspect === 'sextile' || aspect === 'trine';
  if (body === 'Jupiter' && ['Sun', 'Moon', 'Venus', 'Mercury'].includes(target)) {
    if (soft && natal.support) return 'favourable';
  }
  if (body === 'Saturn' && target === 'Sun' && ['conjunction', 'square', 'opposition'].includes(String(aspect))) return 'adverse';
  if (body === 'Uranus' && target === 'Venus' && (aspect === 'square' || aspect === 'opposition')) return 'adverse';
  if (body === 'Neptune' && (target === 'Mercury' || target === 'Moon')) {
    if (soft || aspect === 'conjunction') return 'favourable';
    if (natal.affliction && (aspect === 'square' || aspect === 'opposition')) return 'adverse';
  }
  return readHeindelTransitObservation(body, target, aspect, motion) ?? 'unclassified';
}

function motionAt(body: NatalBody, at: number) {
  // Both sides of the contact must agree, including near a station.
  const step = 600_000;
  const longitude = readTransitLongitude(body, at);
  const before = arc(longitude - readTransitLongitude(body, at - step));
  const after = arc(readTransitLongitude(body, at + step) - longitude);
  return before > 0 && after > 0 ? 'direct' : before < 0 && after < 0 ? 'retrograde' : 'stationary';
}

function heindelSamePairNature(direction: Contact, transitingBody: NatalBody, target: NatalBody, aspect: unknown,
  targetNatal: NatalCondition, outerNatal: NatalCondition):
  Pick<DirectionOverlap, 'natureRelation' | 'transitNature' | 'directionNature'> {
  const soft = direction.aspectType === 'sextile' || direction.aspectType === 'trine';
  const hard = direction.aspectType === 'square' || direction.aspectType === 'opposition';
  if (direction.progressedBody === 'Sun' && target === 'Sun') {
    const reachesConjunction = direction.aspectType === 'conjunction';
    const parallel = direction.aspectType === 'parallel' && direction.coordinate === 'equatorial_declination_of_date'
      && direction.allowedOrb === 0;
    const jupiter = transitingBody === 'Jupiter', saturn = transitingBody === 'Saturn';
    let directionNature: DirectionOverlap['directionNature'];
    if (outerNatal.affliction && ((jupiter || saturn) && hard || saturn && (reachesConjunction || parallel))) directionNature = 'adverse';
    if (!outerNatal.affliction && outerNatal.support && ((jupiter || saturn) && soft || jupiter && (reachesConjunction || parallel))) {
      directionNature = 'favourable';
    }
    const transitNature = heindelTransitNature(transitingBody, target, aspect, undefined, targetNatal);
    // Chapter XXVII still describes Jupiter's squares and oppositions as adverse,
    // with a lesser intensity. Compare polarity while retaining that strength.
    const transitPolarity = jupiter && transitNature === 'mild_adverse' ? 'adverse' : transitNature;
    return { transitNature, directionNature, natureRelation: directionNature && (transitPolarity === 'favourable' || transitPolarity === 'adverse')
      ? specificRelation(directionNature, transitPolarity) : 'unclassified' };
  }
  if (transitingBody === 'Neptune' && (target === 'Mercury' || target === 'Moon')) {
    const transitNature = heindelTransitNature(transitingBody, target, aspect, undefined, targetNatal);
    let directionNature: DirectionOverlap['directionNature'];
    // Chapter 26 names both orders for Mercury. Chapter 25 specifies the progressed Moon on natal Neptune.
    if (target === 'Mercury') directionNature = soft ? 'favourable' : hard ? 'adverse' : undefined;
    if (direction.progressedBody === 'Moon' && direction.natalTargetId === 'Neptune') {
      const parallel = direction.aspectType === 'parallel' && direction.coordinate === 'equatorial_declination_of_date';
      if (soft && outerNatal.support && !outerNatal.affliction) directionNature = 'favourable';
      if ((hard || direction.aspectType === 'conjunction' || parallel) && outerNatal.affliction) directionNature = 'adverse';
    }
    return { transitNature, directionNature, natureRelation: directionNature && (transitNature === 'favourable' || transitNature === 'adverse')
      ? specificRelation(directionNature, transitNature) : 'unclassified' };
  }
  // Chapter 25 names the progressed Moon on natal Jupiter and asks whether Jupiter is well aspected.
  if (transitingBody === 'Jupiter' && target === 'Moon' && direction.progressedBody === 'Moon' && direction.natalTargetId === 'Jupiter') {
    const transitNature = heindelTransitNature(transitingBody, target, aspect, undefined, targetNatal);
    const directionNature = (soft || direction.aspectType === 'conjunction') && outerNatal.support && !outerNatal.affliction
      ? 'favourable' : undefined;
    return { transitNature, directionNature,
      natureRelation: directionNature && transitNature === 'favourable' && !targetNatal.affliction ? 'akin' : 'unclassified' };
  }
  // These named pairs have clear positive and negative progression branches in chapter 26.
  if (!(transitingBody === 'Saturn' && target === 'Mercury'
    || transitingBody === 'Jupiter' && (target === 'Mercury' || target === 'Venus')
    || transitingBody === 'Uranus' && target === 'Venus')) {
    return { natureRelation: 'unclassified', transitNature: 'unclassified' };
  }
  const transitNature = heindelTransitNature(transitingBody, target, aspect,
    transitingBody === 'Saturn' ? motionAt(transitingBody, direction.start) : undefined, targetNatal);
  const directionNature = soft ? 'favourable' : hard ? 'adverse' : undefined;
  return { transitNature, directionNature, natureRelation: directionNature && (transitNature === 'favourable' || transitNature === 'adverse')
    ? specificRelation(directionNature, transitNature) : 'unclassified' };
}

const specificRelation = (direction: 'favourable' | 'adverse', transit: 'favourable' | 'adverse') =>
  direction === transit ? 'akin' : 'different';

function heindelExampleLunarAspects(band: Contact) {
  if (band.progressedBody !== 'Sun') return [];
  if (band.natalTargetId === 'Saturn' && band.aspectType === 'square') {
    return aspects.filter(aspect => ['conjunction', 'square', 'opposition'].includes(aspect.type));
  }
  if (band.natalTargetId === 'Jupiter' && band.aspectType === 'trine') {
    return aspects.filter(aspect => ['sextile', 'trine'].includes(aspect.type));
  }
  return [];
}

export function heindelExampleActivations(solar: Contact[], lunar: Contact[]) {
  return solar.flatMap((band, solarIndex) => {
    const permitted = heindelExampleLunarAspects(band).map(aspect => aspect.type);
    return lunar.flatMap((point, lunarIndex) => point.progressedBody === 'Moon' && permitted.includes(point.aspectType)
      && ['Sun', band.natalTargetId].includes(point.natalTargetId) && band.start <= point.start && point.start < band.end
      ? [{ at: point.start, solarIndex, lunarIndex, solarTarget: band.natalTargetId, solarAspect: band.aspectType,
        lunarTarget: point.natalTargetId, lunarAspect: point.aspectType, exampleGeometryOnly: true }] : []);
  });
}

export function heindelExampleLunationActivations(solar: Contact[], lunations: { at: number; longitude: number }[],
  natal: { body: NatalBody; longitude: number }[]) {
  const allowedOrb = heindelSourcePolicy.lunationOrb;
  return solar.flatMap((band, solarIndex) => {
    const permitted = heindelExampleLunarAspects(band);
    if (!permitted.length) return [];
    const targets = natal.filter(target => target.body === 'Sun' || target.body === band.natalTargetId);
    return lunations.filter(point => band.start <= point.at && point.at < band.end).flatMap(point =>
      targets.flatMap(target => {
        const separation = Math.abs(arc(point.longitude - target.longitude));
        return permitted.flatMap(aspect => {
          const deviation = Math.abs(separation - aspect.angle);
          return deviation <= allowedOrb ? [{ at: point.at, solarIndex, natalTargetId: target.body,
            aspectType: aspect.type, deviation, allowedOrb }] : [];
        });
      }));
  });
}

export function buildHeindelSourceContext(window: Window, chart?: DestinyChartSnapshot) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.end <= window.start
    || window.end - window.start > 368 * day) throw new RangeError('Invalid Heindel window');
  const birth = readProgressionBirth(chart);
  if (birth.status !== 'ready') return { ...birth, policy: heindelSourcePolicy };
  if (window.start <= birth.birthAt + 60_000) return { status: 'before_birth', policy: heindelSourcePolicy } as const;
  const clock = heindelCalculationDate(birth.birthAt, chart?.birthContext);
  const natal = targets.map(body => {
    const { longitude, declination } = readProgressionPosition(body, birth.birthAt, birth.birthAt);
    return { ...readHeindelNatalPower(body, longitude), declination };
  });
  const cache = new Map<string, ReturnType<typeof readHeindelCoordinates>>();
  const coordinates = (body: Planet, at: number) => {
    const key = body + ':' + at;
    if (!cache.has(key)) cache.set(key, readHeindelCoordinates(clock, body, at));
    return cache.get(key)!;
  };
  const position = (body: Planet, at: number) => coordinates(body, at).longitude;
  const natalNeptune = natal.find(row => row.body === 'Neptune')!;
  const solarParallelTargets = natal.filter(row => row.body === 'Jupiter' || row.body === 'Saturn');
  const solar: Contact[] = [], lunar: Contact[] = [], planetary: Contact[] = [], outer: Contact[] = [];
  const solarParallels: Contact[] = [];
  const angles: { id: SolarAngle['natalTargetId']; longitude: number }[] = [];
  if (readWesternHouseFrame(chart).status === 'ready') {
    const { ascendant, midheaven } = chart!.western.rawResult[0];
    angles.push({ id: 'ASC', longitude: ascendant }, { id: 'MC', longitude: midheaven });
  }
  const solarAngles: SolarAngle[] = [];
  for (let start = window.start; start < window.end;) {
    const end = Math.min(window.end, heindelProgressionSegment(clock, start).end);
    for (const { id, longitude } of angles) {
      const bands = heindelLinearContacts({ start, end }, position('Sun', start), position('Sun', end), longitude, heindelSourcePolicy.solarOrb);
      for (const band of bands) if (band.aspectType === 'square' || band.aspectType === 'opposition') {
        appendSolarBand(solarAngles, { ...band, natalTargetId: id, natalLongitude: longitude }, start);
      }
    }
    lunar.push(...heindelInstantParallels({ start, end }, coordinates('Moon', start).declination,
      coordinates('Moon', end).declination, natalNeptune.declination, 'Moon', 'Neptune'));
    for (const target of solarParallelTargets) {
      solarParallels.push(...heindelInstantParallels({ start, end }, coordinates('Sun', start).declination,
        coordinates('Sun', end).declination, target.declination, 'Sun', target.body));
    }
    for (const body of targets) for (const target of natal) {
      if (body === target.body) continue;
      const rows = heindelLinearContacts({ start, end }, position(body, start), position(body, end), target.longitude,
        body === 'Sun' ? heindelSourcePolicy.solarOrb : 0);
      for (const row of rows) {
        const contact = { ...row, progressedBody: body, natalTargetId: target.body };
        if (body === 'Sun') appendSolarBand(solar, contact, start);
        else if (body === 'Moon') lunar.push(contact);
        else if (body === 'Mercury' || body === 'Venus' || body === 'Mars') planetary.push(contact);
        else outer.push(contact);
      }
    }
    start = end;
  }
  solar.sort((a, b) => a.start - b.start || a.natalTargetId.localeCompare(b.natalTargetId));
  lunar.sort((a, b) => a.start - b.start || a.natalTargetId.localeCompare(b.natalTargetId));
  planetary.sort((a, b) => a.start - b.start || a.natalTargetId.localeCompare(b.natalTargetId));
  const sampleAt = Math.floor((window.start + window.end) / 2);
  const natalPairs = natal.flatMap((first, i) => natal.slice(i + 1).map(second => readHeindelNatalPair(first, second)));
  const lunationWindows = buildLunationWindows(window);
  const lunations = lunationWindows.filter(row => window.start <= row.newMoonAt && row.newMoonAt < window.end)
    .map(row => ({ at: row.newMoonAt, longitude: row.longitude,
      natalSeparations: natal.map(target => ({ body: target.body, separation: Math.abs(arc(row.longitude - target.longitude)) })) }));
  return { status: 'ready', policy: heindelSourcePolicy, window, clock, natal, natalPairs, sampleAt,
    progressed: principal.map(body => ({ body, longitude: position(body, sampleAt) })), solar, solarAngles, solarParallels, lunar, planetary, outer, lunations, lunationWindows,
    activations: heindelExampleActivations(solar, lunar),
    lunationActivations: heindelExampleLunationActivations(solar, lunations, natal) } as const;
}
type Ready = Extract<ReturnType<typeof buildHeindelSourceContext>, { status: 'ready' }>;

function matchingTransitLunations(source: Ready, window: Window, transitBody: NatalBody,
  natalLongitude: number, aspectType: unknown) {
  const aspect = aspects.find(row => row.type === aspectType);
  if (!aspect) return [];
  const { fellowshipTransitOrb, lunationOrb } = heindelSourcePolicy;
  return source.lunationWindows.flatMap(({ newMoonAt: at, nextNewMoonAt, longitude }) => {
    if (at < source.clock.birthAt || at >= window.end || window.start >= nextNewMoonAt
      || at < window.start && window.start !== source.window.start) return [];
    const transitLongitude = readTransitLongitude(transitBody, at);
    const direction = Math.sign(arc(transitLongitude - natalLongitude));
    const centre = natalLongitude + direction * aspect.angle;
    const natalDeviation = Math.abs(arc(longitude - centre));
    const transitDeviation = Math.abs(arc(transitLongitude - centre));
    const phaseTransitDeviation = Math.abs(arc(longitude - transitLongitude));
    // Lesson 13 supplies the natal limits. This narrow branch also requires
    // one directed aspect and the true phase inside the outer planet's orb.
    return natalDeviation <= lunationOrb && transitDeviation <= fellowshipTransitOrb && phaseTransitDeviation <= fellowshipTransitOrb
      ? [{ at, nextNewMoonAt, natalDeviation, transitDeviation, phaseTransitDeviation }] : [];
  });
}

function heindelTransitFacts(facts: FortuneFactRecord[]) {
  const all = facts.filter(f => f.method === 'western' && f.completeness === 'complete' && f.scope === 'transit'
    && ['aspect_interval', 'aspect_exact'].includes(f.factType));
  if (!all.length) return [];
  const identity = (f: FortuneFactRecord) => JSON.stringify([f.calculationRunId, f.natalChartSnapshotId, f.profileId, f.periodType]);
  const scope = identity(all[0]);
  return !all[0].calculationRunId || !all[0].natalChartSnapshotId || all.some(f => identity(f) !== scope) ? [] : all;
}

// Chapters XXIV and XXVII separately name the radical Ascendant and Midheaven.
// Pair the solar direction and the actual Saturn conjunction to the same checked angle.
export function linkHeindelSaturnAngleTransits(source: Ready, facts: FortuneFactRecord[]) {
  if (!source.solarAngles.length) return [];
  const transits = heindelTransitFacts(facts);
  return transits.flatMap(fact => {
    const p = fact.normalizedPayload as Record<string, unknown>;
    const start = Date.parse(fact.activeFrom), end = Date.parse(fact.activeTo);
    if (fact.factType !== 'aspect_interval' || p.transitBody !== 'Saturn' || p.aspectType !== 'conjunction'
      || p.natalTargetType !== 'angle' || p.zodiac !== 'tropical' || typeof p.natalLongitude !== 'number' || !Number.isFinite(p.natalLongitude)
      || !(source.window.start <= start && start < end && end <= source.window.end)) return [];
    const longitude = p.natalLongitude;
    return source.solarAngles.flatMap(band => {
      if (band.natalTargetId !== p.natalTargetId || Math.abs(arc(band.natalLongitude - longitude)) > 0.02) return [];
      const from = Math.max(start, band.start), to = Math.min(end, band.end);
      if (from >= to) return [];
      const exactPasses = transits.flatMap(pass => {
        if (pass.factType !== 'aspect_exact' || !fact.parentSignalId || pass.parentSignalId !== fact.parentSignalId
          || pass.activeFrom !== fact.activeFrom || pass.activeTo !== fact.activeTo
          || !pass.sourceFactIds.some(id => fact.sourceFactIds.includes(id))) return [];
        const at = Date.parse(pass.exactInstant ?? '');
        return from <= at && at < to ? [at] : [];
      });
      return [{ start: from, end: to, band, sourceFactIds: fact.sourceFactIds, exactPasses }];
    });
  });
}

export function linkHeindelTransits(source: Ready, facts: FortuneFactRecord[]) {
  // Verify the natal coordinate as well as the common run, snapshot, profile and period.
  const all = heindelTransitFacts(facts);
  const directions = [...source.solar, ...source.solarParallels, ...source.lunar, ...source.planetary, ...source.outer];
  const sun = source.natal.find(row => row.body === 'Sun')!;
  // Chapter XIX names the natal Sun–Jupiter link as income-related evidence.
  const financeContact = source.natalPairs.find(row => row.first === 'Sun' && row.second === 'Jupiter')
    ?.contacts.find(contact => contact.band === 'standard' && ['sextile', 'trine'].includes(contact.aspectType));
  const financeAfflicted = financeContact && source.natalPairs.some(pair => pair.contacts.some(contact =>
    contact.band === 'standard' && contact.affected.some(body => body === 'Sun' || body === 'Jupiter')));
  const financialSupport = financeContact ? financeAfflicted ? 'mixed' : 'supported' : 'absent';
  return all.flatMap(fact => {
    const p = fact.normalizedPayload as Record<string, unknown>;
    const target = source.natal.find(row => row.body === p.natalTargetId);
    const start = Date.parse(fact.activeFrom), end = Date.parse(fact.activeTo);
    if (!['Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(String(p.transitBody)) || !target
      || p.natalTargetType !== 'planet' || p.zodiac !== 'tropical' || typeof p.natalLongitude !== 'number' || !Number.isFinite(p.natalLongitude)
      || Math.abs(arc(p.natalLongitude - target.longitude)) > 0.02 || !(source.window.start <= start && start < end && end <= source.window.end)) return [];
    const exactAt = fact.exactInstant === undefined ? undefined : Date.parse(fact.exactInstant);
    if (fact.factType === 'aspect_exact' && (exactAt === undefined || !(start <= exactAt && exactAt < end))) return [];
    const transitingNatal = source.natal.find(row => row.body === p.transitBody)!;
    const natalAspectEvidence = source.natalPairs.filter(row => row.contacts.length
      && [row.first, row.second].some(body => body === target.body || body === transitingNatal.body));
    const targetContacts = natalAspectEvidence.filter(row => row.first === target.body || row.second === target.body)
      .flatMap(row => row.contacts.filter(aspect => aspect.band === 'standard'));
    const natalTargetHasSupport = targetContacts.some(aspect => aspect.assessment === 'support');
    const natalTargetHasAffliction = targetContacts.some(aspect => aspect.affected.includes(target.body));
    const checksFinancialSupport = exactAt !== undefined && transitingNatal.body === 'Jupiter'
      && ['Sun', 'Moon', 'Venus', 'Mercury'].includes(target.body) && ['sextile', 'trine'].includes(String(p.aspectType));
    const outerContacts = natalAspectEvidence.filter(row => row.first === transitingNatal.body || row.second === transitingNatal.body)
      .flatMap(row => row.contacts.filter(aspect => aspect.band === 'standard'));
    const natalOuterSupport = outerContacts.some(aspect => aspect.assessment === 'support');
    const natalOuterAffliction = outerContacts.some(aspect => aspect.affected.includes(transitingNatal.body));
    const targetNatal = { support: natalTargetHasSupport, affliction: natalTargetHasAffliction };
    const outerNatal = { support: natalOuterSupport, affliction: natalOuterAffliction };
    const mercuryOffset = target.body === 'Mercury' ? arc(target.longitude - sun.longitude) : undefined;
    const directionContacts = directions.filter(direction =>
      direction.progressedBody === target.body && direction.natalTargetId === transitingNatal.body
      || direction.progressedBody === transitingNatal.body && direction.natalTargetId === target.body).flatMap<DirectionOverlap>(direction => {
      const { allowedOrb, ...details } = direction;
      const point = allowedOrb === 0;
      const from = Math.max(start, direction.start), to = Math.min(end, point ? direction.start + 1 : direction.end);
      if (from >= to) return [];
      const nature = heindelSamePairNature(direction, transitingNatal.body, target.body, p.aspectType,
        targetNatal, outerNatal);
      if (direction.aspectType !== p.aspectType && nature.natureRelation === 'unclassified') return [];
      const lunationActivations = !point && heindelExampleLunarAspects(direction).length
        ? source.lunationActivations.filter(activation =>
          source.solar[activation.solarIndex] === direction && from <= activation.at && activation.at < to) : undefined;
      return [{ ...details, ...nature, start: from, end: to, directionKind: point ? 'exact_point' : 'solar_band', allowedOrb,
        exactTimes: direction.exactTimes.filter(at => from <= at && at < to), lunationActivations }];
    });
    if (fact.factType === 'aspect_interval' && target.body === 'Sun') {
      for (const activation of source.activations) {
        const { at, solarTarget, lunarTarget, lunarAspect } = activation;
        if (solarTarget !== transitingNatal.body || !(start <= at && at < end)) continue;
        if (solarTarget === 'Saturn' && lunarTarget === 'Sun' && lunarAspect === 'conjunction') continue;
        const solar = source.solar[activation.solarIndex];
        const nature = heindelSamePairNature(solar, transitingNatal.body, target.body, p.aspectType,
          targetNatal, outerNatal);
        if (nature.natureRelation !== 'akin') continue;
        // The Sun has its source band. The Moon supplies only a timed point inside that band and the transit.
        directionContacts.push({ ...solar, ...nature, start: at, end: at + 1, exactTimes: [],
          directionKind: 'solar_lunar_direction_activation',
          lunarDirectionActivation: { at, natalTargetId: lunarTarget, aspectType: lunarAspect } });
      }
    }
    const transitLunationActivations = fact.factType === 'aspect_interval'
      ? matchingTransitLunations(source, { start, end }, transitingNatal.body, target.longitude, p.aspectType) : [];
    return [{ start, end, exactAt, kind: fact.factType === 'aspect_exact' ? 'exact' : 'interval',
      profile: heindelSourcePolicy.profile, dateBasis: source.clock.dateBasis, sourceClockVerified: false, geometryOnly: true,
      transitBody: p.transitBody, natalTargetId: target.body, natalLongitude: target.longitude,
      transitNatalLongitude: p.natalLongitude,
      aspectType: p.aspectType, transitMotion: p.transitMotion, transitAllowedOrb: p.allowedOrb,
      transitNature: exactAt === undefined ? undefined
        : heindelTransitNature(transitingNatal.body, target.body, p.aspectType, p.transitMotion, targetNatal),
      passIndex: p.passIndex, transitFactId: fact.factId, sourceFactIds: fact.sourceFactIds,
      natalWitnessProfile: heindelSourcePolicy.natalWitnessProfile, natalPowers: [target, transitingNatal],
      natalAspectProfile: heindelSourcePolicy.natalAspectProfile, natalAspectEvidence, natalTargetHasSupport, natalTargetHasAffliction,
      natalSunJupiterFinancialSupport: checksFinancialSupport ? financialSupport : undefined,
      natalSunJupiterFinanceContact: checksFinancialSupport && financeContact
        ? { first: 'Sun', second: 'Jupiter', aspectType: financeContact.aspectType, deviation: financeContact.deviation } : undefined,
      mercuryToSun: mercuryOffset === undefined ? undefined : { offset: mercuryOffset, withinThreeDegrees: Math.abs(mercuryOffset) < 3 },
      directionContacts, transitLunationActivations,
      solar: source.solar.filter(band => band.start < end && start < band.end),
      lunar: source.lunar.filter(point => start <= point.start && point.start < end),
      lunations: source.lunations.filter(point => start <= point.at && point.at < end),
      activations: source.activations.filter(point => start <= point.at && point.at < end),
      // Presence at one point and interval overlap are explicitly different.
      solarActiveAtExact: exactAt === undefined ? undefined : source.solar.filter(b => b.start <= exactAt && exactAt < b.end)
        .map(b => ({ natalTargetId: b.natalTargetId, aspectType: b.aspectType })),
    }];
  });
}
