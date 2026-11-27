import { Body, Ecliptic, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SiderealTime, SunPosition } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import {
  buildWesternProgressions, progressedAspects, progressionEpoch, progressionPolicy, progressionRealTime, readProgressionBirth,
  scanProgressionBand, scanProgressionLongitudePair,
} from './western-progressions';
import { calculateHouseCusps, readWesternHouseFrame, scanCircularRegions, zodiacalHouse } from './western-houses';
import type { Planet } from './solar-transits';
import { leoRulershipPolicy, readLeoPairRulership, readLeoSignRuler } from './leo-rulership';
import { isLeoNatalAffliction, isLeoNatalSquareOrOpposition, leoNatalAspectPolicy, leoNatalFinancialProfile,
  readLeoAngularCuspApproach, readLeoCuspApproach, readLeoGreenNatalAspects, readLeoNatalAspectContacts, readLeoNatalFinancialAnchors,
  readLeoNatalFinancialTestimonies } from './leo-natal-aspects';

const day = 86_400_000, rad = Math.PI / 180;
export const leoNatalBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
export const leoVenusNeptuneOtherBodies: ReadonlySet<Planet> = new Set(['Mercury', 'Mars', 'Jupiter', 'Saturn', 'Uranus']);
const targets: Partial<Record<Planet, readonly Planet[]>> = {
  Sun: leoNatalBodies.filter(b => b !== 'Sun'), Moon: leoNatalBodies.filter(b => b !== 'Moon'),
  Mercury: ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
  Venus: ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], Mars: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
};
const slowPlanetPairs: Partial<Record<Planet, readonly Planet[]>> = {
  Jupiter: ['Saturn', 'Uranus', 'Neptune'], Saturn: ['Uranus', 'Neptune'], Uranus: ['Neptune'],
};
export function canScanLeoProgressedPair(first: Planet, second: Planet) {
  return Boolean(targets[first]?.includes(second) || targets[second]?.includes(first));
}
const arc = (n: number) => (n % 360 + 540) % 360 - 180;
const angularHouses = [1, 4, 7, 10];
const lunarBridgeNatalTargets: readonly Planet[] = ['Sun', 'Mercury'];
const signBoundaries = Array.from({ length: 12 }, (_, sign) => sign * 30);
export const leoSourcePolicy = {
  profile: 'leo-1906-source-context-v1', zodiac: 'tropical', timeKey: progressionPolicy.version,
  longitudeOrb: progressionPolicy.longitudeOrb, longitudeOrbStatus: 'declared-product-threshold-not-universal-source-orb',
  parallelOrb: 1, parallelComparison: 'absolute-declination-north-south-not-required',
  declinationFrame: 'geocentric-apparent-equator-of-each-ephemeris-date',
  natalHouseSystem: 'placidus', lunarLink: 'same-body-in-same-chart-and-real-time-intersection-not-same-nature',
  directionLists: 'progressed-to-natal-and-progressed-to-progressed',
  sourceConflict: 'source-normalized-same-hemisphere-text-differs-from-1906-calculation-instructions',
  rulership: leoRulershipPolicy,
  directionSignProfile: 'leo-1906-moving-and-natal-signs-v1',
  natalProminence: 'leo-green-angular-houses-and-shortest-natal-longitude-distance-to-midheaven',
  natalFinancialProfile: leoNatalFinancialProfile,
  appendixDateProfile: 'leo-1906-appendix-v-greenwich-noon-v1',
  lunarExactObservationProfile: 'leo-1906-lunar-exact-observation-v1',
  mutualExactObservationProfile: 'leo-1906-mutual-exact-observation-v1',
} as const;

// Appendix V looks up the Greenwich noon whose sidereal time is nearest the directed arc.
// Use the mean steps only to select the calendar cycle and locate the neighbouring noons.
export function readLeoAppendixDate(birthAt: number, ephemerisAt: number) {
  const hour = 3_600_000;
  const siderealRate = 1 + 1 / 365.2422;
  const birthNoon = Math.floor(birthAt / day) * day + day / 2;
  const symbolicNoon = Math.floor((ephemerisAt - day / 2) / day) * day + day / 2;
  const symbolicDays = (symbolicNoon - birthNoon) / day;
  const nativeNoonSidereal = SiderealTime(new Date(birthNoon));
  const rawNoonGap = nativeNoonSidereal - SiderealTime(new Date(birthAt));
  const nominalNoonGap = (birthNoon - birthAt) / hour * siderealRate;
  const noonGap = rawNoonGap + 24 * Math.round((nominalNoonGap - rawNoonGap) / 24);
  const elapsedSidereal = noonGap + (ephemerisAt - symbolicNoon) / hour * siderealRate;
  const exactAge = symbolicDays + elapsedSidereal / 24;
  if (exactAge < 0) return undefined;
  const meanDate = progressionRealTime(birthAt, birthAt + exactAge * day);
  const meanNoon = Math.floor(meanDate / day) * day + day / 2;
  const signedHours = (value: number) => arc(value * 15) / 15;
  const targetHours = nativeNoonSidereal + elapsedSidereal;
  const difference = (noon: number) => signedHours(targetHours - SiderealTime(new Date(noon)));
  const guess = meanNoon + Math.round(difference(meanNoon) / ((siderealRate - 1) * 24)) * day;
  const nearest = [-1, 0, 1].map(offset => {
    const noon = guess + offset * day;
    return { noon, residualSeconds: Math.abs(difference(noon)) * 3600 };
  }).sort((a, b) => a.residualSeconds - b.residualSeconds);
  return { date: new Date(nearest[0].noon).toISOString().slice(0, 10),
    residualSeconds: nearest[0].residualSeconds };
}
export function readLeoEquatorial(body: Planet, at: number) {
  return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(new Date(at)), GeoVector(Body[body], new Date(at), true)));
}
export function readLeoTransitDeclinations(body: Planet, at: number, natalDeclination: number) {
  const transitDeclination = readLeoEquatorial(body, at).dec;
  return { natalDeclination, transitDeclination, difference: Math.abs(transitDeclination - natalDeclination) };
}
export function leoParallelDifference(first: number, second: number) {
  if (![first, second].every(n => Number.isFinite(n) && Math.abs(n) <= 90)) throw new RangeError('Invalid Leo declination');
  return Math.abs(Math.abs(first) - Math.abs(second));
}
type Window = { start: number; end: number };
type TargetKind = 'natal' | 'progressed';
export type GeometricBand = Window & { progressedBody: Planet; natalTargetId: Planet; aspectType: string; targetKind?: TargetKind;
  exactTimes: number[]; clippedStart: boolean; clippedEnd: boolean; allowedOrb: number; coordinate: string;
  progressedLongitude?: number; natalLongitude?: number; progressedDeclination?: number; natalDeclination?: number;
  targetLongitude?: number; targetDeclination?: number; conjunctionSign?: number | 'split';
  progressedBodySign?: number; sourceBandStart?: number;
  hasNatalUranusAffliction?: boolean;
  separation: number; sameHemisphere?: boolean; declinationSide?: number };

export function readLeoMovingPosition(body: Planet, epoch: number) {
  const date = new Date(epoch);
  const vector = GeoVector(Body[body], date, true);
  return {
    longitude: body === 'Sun' ? SunPosition(date).elon : Ecliptic(vector).elon,
    declination: EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), vector)).dec,
  };
}

function readVenusNeptuneAffliction(contacts: readonly { aspect: string }[], venusSign: number, neptuneSign: number) {
  if (contacts.some(isLeoNatalAffliction)) return { state: 'adverse' as const };
  const has = (aspect: string) => contacts.some(contact => contact.aspect === aspect);
  // Leo and Green, pp. 8–9: conjunction needs the same sign. A parallel is
  // weaker and yields to a recognised strong aspect of the same pair.
  const aspect = venusSign === neptuneSign && has('conjunction') ? 'conjunction'
    : has('parallel') && !has('sextile') && !has('trine') ? 'parallel' : undefined;
  if (!aspect) return { state: has('quincunx') ? 'weak' as const : 'clear' as const };

  const venusDignity = venusSign === leoExaltations.Venus ? 'exaltation'
    : readLeoSignRuler(venusSign) === 'Venus' ? 'domicile' : undefined;
  // Venus–Neptune is outside the good-conjunction list. Venus's dignity
  // can temper that reading, but p. 59 reports Neptune's Pisces dignity as disputed.
  const neptunePiscesDignityDisputed = neptuneSign === 11;
  const basis = venusDignity ? 'qualified-by-venus-dignity'
    : neptunePiscesDignityDisputed ? 'neptune-pisces-dignity-disputed' : 'general-unfavourable';
  return { state: 'qualified' as const, variableContact: { aspect, basis, venusDignity, neptunePiscesDignityDisputed } };
}

function leoSolarDignity(sign: number) {
  if (sign === 0) return { sign, kind: 'exaltation' } as const;
  if (sign === 4) return { sign, kind: 'domicile' } as const;
  return undefined;
}

export const leoStrengthHouses = [1, 10, 7];
const leoExaltations: Partial<Record<Planet, number>> = { Sun: 0, Moon: 1, Mercury: 5, Venus: 11, Mars: 9, Jupiter: 3, Saturn: 6 };

export function measureNatalLeoAngularPosition(
  position: { body: typeof leoNatalBodies[number]; longitude: number; sign: number; house?: number },
  cusps: readonly number[],
) {
  const { body, sign, house, longitude } = position;
  const dignity = readLeoSignRuler(sign) === body ? 'domicile' : sign === leoExaltations[body] ? 'exaltation' : 'none';
  const nearest = house !== undefined && leoStrengthHouses.includes(house) ? leoStrengthHouses.map(cuspHouse => {
    const cusp = cusps[cuspHouse - 1];
    return { cuspHouse, cusp, distance: Math.abs(arc(longitude - cusp)) };
  }).sort((a, b) => a.distance - b.distance)[0] : undefined;
  return { body, sign, house, dignity, ...nearest };
}

// Leo and Green, The Horoscope in Detail, p. 85. Apply the same comparison
// to the named pair when the source asks which of two is more prominent.
export function rankNatalLeoAngularPositions(positions: ReturnType<typeof measureNatalLeoAngularPosition>[]) {
  const angular = positions.flatMap(row => row.distance === undefined ? [] : [{ ...row, distance: row.distance }]);
  if (angular.length === 1) return { witness: angular[0], basis: 'only-in-angular-house' } as const;
  const dignified = angular.filter(row => row.dignity !== 'none').sort((a, b) => a.distance - b.distance);
  const [first, second] = dignified;
  if (first && !second) return { witness: first, basis: 'one-dignified' } as const;
  if (first && second && second.distance - first.distance > 1e-8) return { witness: first, basis: 'closer-dignified-cusp' } as const;
  return { witness: undefined, basis: 'undetermined' } as const;
}

export function scanLeoSolarDignities(window: Window, longitudeAt: (at: number) => number) {
  const { intervals } = scanCircularRegions(window, longitudeAt, [0, 30, 120, 150], 2 * day);
  return intervals.flatMap(({ start, end, longitude }) => {
    const dignity = leoSolarDignity(Math.floor(longitude / 30));
    return dignity ? [{ start, end, dignity }] : [];
  });
}

function splitLeoLongitudeBandAtSigns(band: GeometricBand, longitudeAt: (at: number) => number,
  boundaries: number[], angle: number): GeometricBand[] {
  const { natalLongitude } = band;
  if (natalLongitude === undefined) return [band];
  const minute = 60_000;
  const motion = (at: number) => arc(longitudeAt(at + minute) - longitudeAt(at - minute));
  const stations = scanProgressionBand(band, motion, 180).flatMap(row => row.exactTimes);
  return scanCircularRegions(band, longitudeAt, boundaries, progressionPolicy.sampleDays * day, stations).intervals
    .map(({ start, end, longitude }) => ({
      ...band, start, end, progressedLongitude: longitude, progressedBodySign: Math.floor(longitude / 30),
      separation: Math.abs(Math.abs(arc(longitude - natalLongitude)) - angle),
      exactTimes: band.exactTimes.filter(at => start <= at && at < end),
      clippedStart: band.clippedStart && start === band.start, clippedEnd: band.clippedEnd && end === band.end,
    }));
}

export function splitLeoConjunctionAtSigns(band: GeometricBand, longitudeAt: (at: number) => number): GeometricBand[] {
  const { natalLongitude } = band;
  if (natalLongitude === undefined) return [band];
  const natalSign = Math.floor(natalLongitude / 30);
  const nearby = [natalSign * 30, ((natalSign + 1) % 12) * 30]
    .filter(boundary => Math.abs(arc(natalLongitude - boundary)) <= band.allowedOrb);
  if (!nearby.length) return [{ ...band, conjunctionSign: natalSign }];
  return splitLeoLongitudeBandAtSigns(band, longitudeAt, nearby, 0).map(({ progressedBodySign, ...slice }) => ({
    ...slice, conjunctionSign: progressedBodySign === natalSign ? natalSign : 'split',
  }));
}

export function splitLeoRulershipDirectionAtSigns(band: GeometricBand, longitudeAt: (at: number) => number): GeometricBand[] {
  const marsNeptune = band.progressedBody === 'Mars' && band.natalTargetId === 'Neptune' && band.aspectType === 'semisextile';
  const venusJupiter = band.progressedBody === 'Venus' && band.natalTargetId === 'Jupiter' && band.aspectType === 'quincunx';
  if (band.targetKind === 'progressed' || band.coordinate !== 'ecliptic_longitude' || (!marsNeptune && !venusJupiter)) return [band];
  return splitLeoLongitudeBandAtSigns(band, longitudeAt, signBoundaries, marsNeptune ? 30 : 150)
    .map(slice => ({ ...slice, sourceBandStart: band.start }));
}

export function scanLeoParallel(window: Window, read: (at: number) => number, natalDeclination: number) {
  if (!Number.isFinite(natalDeclination) || Math.abs(natalDeclination) > 90) throw new RangeError('Invalid Leo natal declination');
  const magnitude = Math.abs(natalDeclination);
  // Split at the equator so a single record never asserts the same hemisphere
  // across a north/south change. Half-open intervals assign the zero only once.
  return [1, -1].flatMap(side => scanProgressionBand(window, at => side * read(at) - magnitude, leoSourcePolicy.parallelOrb,
    [-magnitude], value => value + magnitude >= 0).map(band => ({ ...band, declinationSide: side })))
    .sort((a, b) => a.start - b.start);
}

type LeoContactEndpoints = Pick<GeometricBand, 'progressedBody' | 'natalTargetId' | 'targetKind'>;

export function leoContactSharesEndpoint(base: LeoContactEndpoints, contact: LeoContactEndpoints) {
  const targetKind = base.targetKind ?? 'natal', contactTargetKind = contact.targetKind ?? 'natal';
  const reachesFirst = contactTargetKind === 'progressed' && contact.natalTargetId === base.progressedBody;
  const reachesSecond = contactTargetKind === targetKind && contact.natalTargetId === base.natalTargetId;
  return (reachesFirst || reachesSecond) && !(targetKind === 'progressed' && base.natalTargetId === 'Moon' && reachesFirst);
}

export function linkLeoLunarContacts(bands: GeometricBand[]) {
  const lunar = bands.flatMap((band, index) => band.progressedBody === 'Moon' ? [{ band, index }] : []);
  return bands.flatMap((base, baseIndex) => base.progressedBody === 'Moon' ? [] : lunar.flatMap(({ band: moon, index: moonIndex }) => {
    if (!leoContactSharesEndpoint(base, moon)) return [];
    const targetKind = base.targetKind ?? 'natal', lunarTargetKind = moon.targetKind ?? 'natal';
    const start = Math.max(base.start, moon.start), end = Math.min(base.end, moon.end);
    if (start >= end) return [];
    return [{ start, end, baseIndex, moonIndex, progressedBody: base.progressedBody,
      natalTargetId: base.natalTargetId, targetKind, aspectType: base.aspectType,
      lunarTargetId: moon.natalTargetId, lunarTargetKind, lunarAspectType: moon.aspectType,
      sharedBody: moon.natalTargetId, geometryOnly: true,
      lunarExactTimes: moon.exactTimes.filter(at => start <= at && at < end) }];
  }));
}

export function scanLeoMovingParallel(window: Window, readFirst: (at: number) => number,
  readSecond: (at: number) => number, equators: number[]) {
  const cuts = [...new Set([window.start, ...equators.filter(at => window.start < at && at < window.end), window.end])]
    .sort((a, b) => a - b);
  const difference = (at: number) => Math.abs(readFirst(at)) - Math.abs(readSecond(at));
  return cuts.slice(0, -1).flatMap((start, index) =>
    scanProgressionBand({ start, end: cuts[index + 1] }, difference, leoSourcePolicy.parallelOrb).map(band => ({
      ...band, clippedStart: band.start === window.start, clippedEnd: band.end === window.end,
    })));
}

function buildLeoProgressedPairs(window: Window, birthAt: number, partnersByBody = targets) {
  const bands: GeometricBand[] = [];
  const positions = new Map<string, ReturnType<typeof readLeoMovingPosition>>();
  const equators = new Map<Planet, number[]>();
  const position = (body: Planet, at: number) => {
    const epoch = Math.round(progressionEpoch(birthAt, at)), key = body + ':' + epoch;
    if (!positions.has(key)) positions.set(key, readLeoMovingPosition(body, epoch));
    return positions.get(key)!;
  };
  function equatorTimes(body: Planet) {
    if (!equators.has(body)) equators.set(body, scanProgressionBand(window, at => position(body, at).declination, 90)
      .flatMap(band => band.exactTimes));
    return equators.get(body)!;
  }
  for (const [body, partners] of Object.entries(partnersByBody)) for (const partner of partners!) {
    const first = (at: number) => position(body as Planet, at);
    const second = (at: number) => position(partner, at);
    const pair = { progressedBody: body as Planet, natalTargetId: partner, targetKind: 'progressed' as const };
    const delta = (at: number) => arc(first(at).longitude - second(at).longitude);
    const initial = delta(window.start);
    for (const aspect of progressedAspects) {
      const offsets = aspect.angle === 0 || aspect.angle === 180 ? [aspect.angle] : [aspect.angle, -aspect.angle];
      for (const offset of offsets) {
        const center = initial + arc(offset - initial);
        const error = (at: number) => initial + arc(delta(at) - initial) - center;
        for (const band of scanProgressionBand(window, error, leoSourcePolicy.longitudeOrb)) {
          const middle = (band.start + band.end) / 2;
          bands.push({ ...pair, ...band, aspectType: aspect.type, coordinate: 'ecliptic_longitude',
            allowedOrb: leoSourcePolicy.longitudeOrb, progressedLongitude: first(middle).longitude,
            targetLongitude: second(middle).longitude, separation: Math.abs(error(middle)) });
        }
      }
    }
    for (const band of scanLeoMovingParallel(window, at => first(at).declination, at => second(at).declination,
      [...equatorTimes(pair.progressedBody), ...equatorTimes(partner)])) {
      const middle = (band.start + band.end) / 2;
      const progressedDeclination = first(middle).declination, targetDeclination = second(middle).declination;
      bands.push({ ...pair, ...band, aspectType: 'parallel', coordinate: 'equatorial_declination_of_date',
        allowedOrb: leoSourcePolicy.parallelOrb, progressedDeclination, targetDeclination,
        separation: leoParallelDifference(progressedDeclination, targetDeclination),
        sameHemisphere: progressedDeclination !== 0 && targetDeclination !== 0
          ? Math.sign(progressedDeclination) === Math.sign(targetDeclination) : undefined });
    }
  }
  return bands;
}

export function buildLeoSourceContext(window: Window, chart: DestinyChartSnapshot | undefined,
  progression: ReturnType<typeof buildWesternProgressions>, includeProgressedPairs = false) {
  if (progression.status !== 'ready') return { status: progression.status, policy: leoSourcePolicy } as const;
  const birthAt = progression.birthAt;
  const birth = readProgressionBirth(chart);
  if (!chart || birth.status !== 'ready' || birth.birthAt !== birthAt || !Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end)
    || window.start <= birthAt + 60_000 || window.end <= window.start || window.end - window.start > 368 * day
    || progression.intervals.some(b => b.start < window.start || b.end > window.end)) return { status: 'unavailable', policy: leoSourcePolicy } as const;
  const frame = readWesternHouseFrame(chart);
  const houses = frame.status === 'ready' ? calculateHouseCusps(frame.armc, frame.latitude, frame.obliquity, 'placidus') : undefined;
  const natal = leoNatalBodies.map(body => {
    const position = progression.positions.find(p => p.body === body)!, eq = readLeoEquatorial(body, birthAt);
    return { body, longitude: position.natalLongitude, declination: eq.dec,
      sign: Math.floor(position.natalLongitude / 30),
      house: houses?.status === 'ready' ? zodiacalHouse(position.natalLongitude, houses.cusps) : undefined };
  });
  const mercury = natal.find(row => row.body === 'Mercury')!;
  const mercuryDomicileAngular = mercury.house === undefined ? undefined
    : readLeoSignRuler(mercury.sign) === 'Mercury' && angularHouses.includes(mercury.house);
  const midheaven = houses?.status === 'ready' ? houses.cusps[9] : undefined;
  const natalNeptuneElevation = houses?.status !== 'ready' || midheaven === undefined ? undefined : (() => {
    const distances = natal.map(row => ({ body: row.body, distance: Math.abs(arc(row.longitude - midheaven)) }));
    const neptune = distances.find(row => row.body === 'Neptune')!;
    const position = natal.find(row => row.body === 'Neptune')!;
    const nearestOther = distances.filter(row => row.body !== 'Neptune').sort((a, b) => a.distance - b.distance)[0];
    return { midheaven, distance: neptune.distance, nearestOther, isClosest: neptune.distance + 1e-9 < nearestOther.distance,
      angularCuspApproach: readLeoAngularCuspApproach(position, houses.cusps) };
  })();
  const sun = natal.find(p => p.body === 'Sun')!, sunEq = readLeoEquatorial('Sun', birthAt);
  const sunAltitude = frame.status === 'ready' ? Math.asin(Math.sin(frame.latitude * rad) * Math.sin(sunEq.dec * rad)
    + Math.cos(frame.latitude * rad) * Math.cos(sunEq.dec * rad) * Math.cos((frame.armc - sunEq.ra * 15) * rad)) / rad : undefined;
  const natalContext = { profile: leoSourcePolicy.profile, bodies: natal,
    ascendantLongitude: frame.status === 'ready' ? chart.western.rawResult[0].ascendant : undefined,
    ascendantSign: frame.status === 'ready' ? Math.floor(chart.western.rawResult[0].ascendant / 30) : undefined,
    sunSign: sun.sign, sunHouse: sun.house, sunAltitude,
    dayChart: sunAltitude === undefined || Math.abs(sunAltitude) < 1e-8 ? undefined : sunAltitude > 0,
    houseStatus: houses?.status === 'ready' ? 'ready' : 'unavailable',
    houseSystem: houses?.status === 'ready' ? 'placidus' : undefined };
  const natalContacts = readLeoNatalAspectContacts(natal);
  const natalLuminaryContacts = (['Sun', 'Moon'] as const).map(luminary => ({
    luminary, contacts: natalContacts.filter(row => row.first === luminary || row.second === luminary),
  }));
  // Leo and Green, The Horoscope in Detail, p. 86: the Sun and Moon are
  // each coloured by their closest natal aspect. A sole planet counterpart
  // is unambiguous without comparing the strength of different aspects.
  const natalNeptuneSoleLuminaryContacts = natalLuminaryContacts.flatMap(({ luminary, contacts }) => {
    return contacts.every(row => row.first === 'Neptune' || row.second === 'Neptune')
      ? contacts.map(row => ({ ...row, luminary })) : [];
  });
  const natalNeptuneClosestComparableLuminaryContacts = natalLuminaryContacts.flatMap(({ luminary, contacts }) => {
    const isNeptune = (row: typeof contacts[number]) => row.first === 'Neptune' || row.second === 'Neptune';
    const contact = contacts.find(isNeptune);
    if (!contact || contacts.some(row => row.aspect !== contact.aspect || row.coordinate !== contact.coordinate)) return [];
    const closestOther = contacts.filter(row => !isNeptune(row)).sort((a, b) => a.difference - b.difference)[0];
    // Distances are directly comparable only for the same coordinate and aspect.
    return closestOther && closestOther.difference - contact.difference > 1e-9
      ? [{ ...contact, luminary, closestOther }] : [];
  });
  const natalAngularPositions = houses?.status === 'ready' ? natal.map(row => measureNatalLeoAngularPosition(row, houses.cusps)) : undefined;
  const natalAngularStrength = natalAngularPositions && rankNatalLeoAngularPositions(natalAngularPositions);
  const natalMarsJupiterProminence = natalAngularPositions && (() => {
    const first = natalAngularPositions.find(row => row.body === 'Mars')!;
    const second = natalAngularPositions.find(row => row.body === 'Jupiter')!;
    const { witness, basis } = rankNatalLeoAngularPositions([first, second]);
    const strongest = natalAngularStrength?.witness;
    const dominant = strongest && strongest.body === witness?.body
      ? { ...strongest, basis: natalAngularStrength?.basis } : undefined;
    return { first, second, candidate: witness?.body ?? 'undetermined', basis, dominant };
  })();
  const natalSolarContacts = natalContacts.filter(row => row.first === 'Sun' || row.second === 'Sun');
  const supportive = natalContacts.filter(row => row.aspect === 'sextile' || row.aspect === 'trine');
  // The Art of Synthesis, p. 106, connects natal Sun–Neptune contacts with
  // music and qualifies the response by aspect and house. Keep the harmonious subset.
  const natalSunNeptuneCreativeContacts = supportive.filter(row => row.first === 'Sun' && row.second === 'Neptune');
  const favourable = natalContacts.filter(row => ['semisextile', 'sextile', 'trine'].includes(row.aspect));
  const mercuryAbilityContacts = [...favourable, ...natalContacts.filter(row => row.aspect === 'conjunction')].flatMap(row => {
    const other = row.first === 'Mercury' ? row.second : row.second === 'Mercury' ? row.first : undefined;
    // Leo and Green, The Horoscope in Detail, pp. 42–43, lists different
    // talents for these natal pairs and treats the Mars conjunction separately.
    const ability = other === 'Mars' && row.aspect !== 'conjunction' ? 'engineering'
      : other === 'Uranus' ? 'inventiveness' : other === 'Jupiter' ? 'writing-and-judgment' : undefined;
    if (!ability) return [];
    if (row.aspect === 'conjunction' && natal.find(position => position.body === row.first)!.sign
      !== natal.find(position => position.body === row.second)!.sign) return [];
    return [{ ...row, ability }];
  });
  const mercuryBroadStudyContacts = mercuryAbilityContacts.filter(row => row.ability === 'writing-and-judgment' && row.aspect !== 'semisextile');
  const hard = natalContacts.filter(isLeoNatalSquareOrOpposition);
  const afflictions = natalContacts.filter(isLeoNatalAffliction);
  const natalJupiterAfflictionContacts = afflictions.filter(({ first, second }) => first === 'Jupiter' || second === 'Jupiter');
  const hasNatalUranusAffliction = afflictions.some(({ first, second }) => first === 'Uranus' || second === 'Uranus');
  const natalNeptuneContacts = natalContacts.filter(({ first, second }) => first === 'Neptune' || second === 'Neptune');
  const natalNeptuneAfflictionContacts = natalNeptuneContacts.filter(isLeoNatalAffliction);
  // The Moon and Mars chapters explicitly associate difficult Neptune contacts
  // with excess or self-indulgence. Keep other afflictions in the general audit.
  const natalNeptuneParallelOverindulgenceContacts = natalNeptuneAfflictionContacts.filter(({ first, second }) =>
    first === 'Moon' || first === 'Mars' || second === 'Moon' || second === 'Mars');
  // Leo and Green, pp. 47 and 53, separately name sensual or impulsive excess
  // for adverse Venus–Neptune and Jupiter–Neptune. Use the explicit major angles.
  const natalNeptuneParallelVenusJupiterAdverseContacts = natalNeptuneAfflictionContacts.filter(row =>
    isLeoNatalSquareOrOpposition(row) && [row.first, row.second].some(body => body === 'Venus' || body === 'Jupiter'));
  // Leo and Green, pp. 8 and 59, also describe difficult natal Neptune
  // aspects generally. Keep these additional counterparts beside the named pairs.
  const natalNeptuneParallelAdditionalAfflictionContacts = natalNeptuneAfflictionContacts.filter(({ first, second }) =>
    [first, second].some(body => body === 'Sun' || body === 'Mercury' || body === 'Saturn' || body === 'Uranus'));
  const neptune = natal.find(row => row.body === 'Neptune')!;
  // The Horoscope in Detail, pp. 8–10, 39, 43 and 53. The strong geometry
  // takes precedence only for the same pair. A lone parallel remains variable.
  const natalNeptuneParallelReviews = natal.filter(row => row !== neptune).map(first => {
    const contacts = readLeoGreenNatalAspects(first, neptune).map(contact =>
      ({ ...contact, first: first.body, second: neptune.body }));
    const favourableConjunction = ['Moon', 'Mercury', 'Jupiter'].includes(first.body)
      ? contacts.find(row => row.aspect === 'conjunction') : undefined;
    const preferred = favourableConjunction ?? contacts.find(row =>
      isLeoNatalSquareOrOpposition(row) || row.aspect === 'sextile' || row.aspect === 'trine');
    const parallel = contacts.find(row => row.aspect === 'parallel');
    return {
      favourableConjunction,
      superseded: parallel && preferred ? { ...parallel, preferredAspect: preferred.aspect } : undefined,
      weakAdverse: contacts.find(row => row.aspect === 'quincunx'),
      weakFavourable: contacts.find(row => row.aspect === 'semisextile'),
      unclassified: contacts.filter(row => row.aspect === 'parallel' && !preferred
        || row.aspect === 'conjunction' && !favourableConjunction),
    };
  });
  const natalNeptuneBeforeAngularCusp = natalNeptuneElevation && Boolean(natalNeptuneElevation.angularCuspApproach);
  const natalNeptuneProminenceKnown = neptune.house !== undefined && angularHouses.includes(neptune.house)
    || natalNeptuneElevation?.isClosest || natalNeptuneBeforeAngularCusp
    || natalNeptuneSoleLuminaryContacts.length > 0 || natalNeptuneClosestComparableLuminaryContacts.length > 0;
  // The natal clauses in the solar conjunction qualify the marked effect.
  // An incomplete prominence review cannot rule that effect out for the person.
  const solarNeptuneNatalEvidenceState = natalNeptuneContacts.length === 0 ? 'no-reviewed-contact' as const
    : natalNeptuneProminenceKnown ? 'qualified' as const : 'prominence-unreviewed' as const;
  const solarNeptuneNatalEvidence = {
    solarNeptuneNatalEvidenceState,
    natalTargetHouse: neptune.house,
    natalTargetAspectContacts: natalNeptuneContacts,
    hasNatalTargetAspect: natalNeptuneContacts.length > 0,
    natalNeptuneElevation,
    natalNeptuneClosestToMidheaven: natalNeptuneElevation?.isClosest,
    natalNeptuneBeforeAngularCusp,
    natalNeptuneSoleLuminaryContacts,
    hasNatalNeptuneSoleLuminaryContact: natalNeptuneSoleLuminaryContacts.length > 0,
    natalNeptuneClosestComparableLuminaryContacts,
    hasNatalNeptuneClosestComparableLuminaryContact: natalNeptuneClosestComparableLuminaryContacts.length > 0,
  };
  // Leo and Green, The Horoscope in Detail, pp. 43, 47, 53: keep the
  // Mercury link distinct from the Venus and Jupiter artistic testimonies.
  const natalNeptuneTestimonies = natalContacts.flatMap(row => {
    const other = row.first === 'Neptune' ? row.second : row.second === 'Neptune' ? row.first : undefined;
    if (other !== 'Mercury' && other !== 'Venus' && other !== 'Jupiter' && other !== 'Moon') return [];
    const isFavourable = row.aspect === 'sextile' || row.aspect === 'trine' || other !== 'Venus'
      && row.aspect === 'conjunction' && natal.find(position => position.body === other)!.sign === neptune.sign;
    const nature = isFavourable ? 'favourable'
      : (other === 'Mercury' || other === 'Moon') && isLeoNatalAffliction(row) ? 'adverse' : undefined;
    return nature ? [{ ...row, other, nature }] : [];
  });
  const natalMercuryNeptuneTestimonies = natalNeptuneTestimonies.filter(row => row.other === 'Mercury');
  // How to Judge a Nativity, Chapter X, names the Mercury–Neptune link for poetic thought.
  const natalMercuryNeptuneWritingContacts = natalMercuryNeptuneTestimonies.filter(row => row.aspect === 'sextile' || row.aspect === 'trine');
  const natalMercuryNeptuneWritingAffliction = afflictions.some(({ first, second }) =>
    first === 'Mercury' || second === 'Mercury' || first === 'Neptune' || second === 'Neptune');
  // Leo and Green, p. 40: Mercury takes the nature of its closest and strongest
  // contact. A sole counterpart needs no ranking of different kinds of aspects.
  const natalMercuryContactBodies = [...new Set(natalContacts.flatMap(({ first, second, aspect }) => {
    const other = first === 'Mercury' ? second : second === 'Mercury' ? first : undefined;
    if (!other || aspect === 'conjunction' && natal.find(position => position.body === other)!.sign !== mercury.sign) return [];
    return [other];
  }))];
  const natalNeptuneArtContacts = natalNeptuneTestimonies.filter(row => row.other === 'Venus' || row.other === 'Jupiter');
  const natalNeptuneJupiterArtisticContacts = natalNeptuneArtContacts.filter(row => row.other === 'Jupiter');
  const lunarNeptuneEvidence: Partial<Record<GeometricBand['aspectType'], typeof natalNeptuneTestimonies>> = {
    sextile: natalMercuryNeptuneTestimonies.filter(row => row.nature === 'favourable'),
    sesquiquadrate: natalMercuryNeptuneTestimonies.filter(row => row.nature === 'adverse'),
    quincunx: natalNeptuneTestimonies.filter(row => row.other === 'Mercury' || row.other === 'Moon'),
  };
  // Leo and Green, pp. 39 and 47: the native's Moon and Venus can support
  // Neptune's artistic themes through favourable aspects with Neptune.
  const natalNeptuneCreativeTestimonies = natalNeptuneTestimonies.filter(row => row.nature === 'favourable'
    && (row.other === 'Moon' || row.other === 'Venus'));
  // Leo and Green, The Horoscope in Detail, pp. 42, 46–47, identify these forms of artistic inclination.
  const venusArtContacts = natalContacts.filter(row => {
    const other = row.first === 'Venus' ? row.second : row.second === 'Venus' ? row.first : undefined;
    if (other === 'Mercury' || other === 'Jupiter') {
      const sameSign = row.aspect === 'conjunction' && natal.find(position => position.body === other)!.sign
        === natal.find(position => position.body === 'Venus')!.sign;
      return sameSign || row.aspect === 'sextile' || other === 'Jupiter' && row.aspect === 'trine';
    }
    return (other === 'Uranus' || other === 'Neptune') && (row.aspect === 'sextile' || row.aspect === 'trine');
  });
  const natalMercuryVenusArtisticContacts = venusArtContacts.filter(row => row.first === 'Mercury' && row.second === 'Venus');
  const mercuryMentalContacts = [...mercuryAbilityContacts.filter(row => row.aspect !== 'semisextile'),
    ...supportive.filter(row => (row.first === 'Mercury' && row.second === 'Saturn') || (row.first === 'Saturn' && row.second === 'Mercury'))];
  const devotionalContacts = natalNeptuneArtContacts.filter(row => row.other === 'Jupiter');
  const natalMoon = natal.find(row => row.body === 'Moon')!;
  const natalJupiter = natal.find(row => row.body === 'Jupiter')!;
  const natalMoonJupiterPositive = natalContacts.filter(row => row.first === 'Moon' && row.second === 'Jupiter'
    && (row.aspect === 'sextile' || row.aspect === 'trine' || row.aspect === 'conjunction' && natalMoon.sign === natalJupiter.sign));
  const moonJupiterDevotion = [...natalMoonJupiterPositive, ...devotionalContacts];
  // Leo and Green explicitly qualify speculation for Mercury in the fifth
  // by a supportive aspect from Jupiter or Saturn.
  const natalMercury = natal.find(row => row.body === 'Mercury')!;
  const moonJupiterInvestment = natalMercury.house === undefined ? undefined : supportive.filter(row =>
    natalMercury.house === 5 && [row.first, row.second].includes('Mercury')
    && (['Jupiter', 'Saturn'].includes(row.first) || ['Jupiter', 'Saturn'].includes(row.second)));
  // Leo and Green, The Horoscope in Detail, pp. 42–43, name these Mercury pairs.
  const natalMercuryImpulsivenessContacts = natalContacts.filter(row => {
    const other = row.first === 'Mercury' ? row.second : row.second === 'Mercury' ? row.first : undefined;
    if (other !== 'Mars' && other !== 'Jupiter') return false;
    if (isLeoNatalAffliction(row)) return true;
    return other === 'Mars' && row.aspect === 'conjunction' && natal.find(position => position.body === 'Mercury')!.sign
      === natal.find(position => position.body === 'Mars')!.sign;
  });
  const afflictionsWithQuincunxes = [...afflictions, ...natalContacts.filter(row => row.aspect === 'quincunx')];
  const natalFinancialContext = houses?.status === 'ready' && natal.every(body => body.house !== undefined) ? (() => {
    const anchors = readLeoNatalFinancialAnchors(natal, houses.cusps);
    const { secondRuler } = anchors;
    const rulerAfflictions = [5, 11].flatMap(house => {
      const ruler = readLeoSignRuler(Math.floor(houses.cusps[house - 1] / 30));
      return afflictions.filter(({ first, second }) => (first === secondRuler && second === ruler) || (second === secondRuler && first === ruler))
        .map(({ aspect, difference, orb }) => ({ house, ruler, aspect, difference, orb }));
    });
    // Leo and Green, pp. 72–73, also look for hard contacts from the second-house
    // ruler to a planet in the twelfth, independently of the primary financial anchors.
    const twelfthBodies = new Set(natal.filter(({ house }) => house === 12).map(({ body }) => body));
    const secondRulerTwelfthHouseAfflictions = hard.flatMap(({ first, second, aspect, difference, orb }) => {
      const afflicted = first === secondRuler ? second : second === secondRuler ? first : undefined;
      return afflicted && twelfthBodies.has(afflicted) ? [{ ruler: secondRuler, afflicted, house: 12 as const, aspect, difference, orb }] : [];
    });
    return { profile: leoNatalFinancialProfile, financeBasis: anchors.financeBasis, secondRuler,
      anchors: anchors.financialAnchors.map(({ body, house }) => ({ body, house })),
      ...readLeoNatalFinancialTestimonies(anchors), rulerAfflictions, secondRulerTwelfthHouseAfflictions };
  })() : undefined;
  const enrich = (b: GeometricBand) => {
    const first = natal.find(n => n.body === b.progressedBody)!, second = natal.find(n => n.body === b.natalTargetId)!;
    const endpoints = [first.body, second.body];
    const contacts = [...supportive, ...hard].filter(row => endpoints.includes(row.first) || endpoints.includes(row.second));
    const natalPairAspects = natalContacts.filter(row => endpoints.includes(row.first) && endpoints.includes(row.second))
      .map(({ aspect, difference, orb, coordinate }) => ({ aspect, difference, orb, coordinate }));
    const linkedBodies = (rows: typeof natalContacts) => endpoints.filter(body => rows.some(row => row.first === body || row.second === body));
    const natalTarget = b.targetKind !== 'progressed';
    const venusNeptuneSemisextile = natalTarget && first.body === 'Venus' && second.body === 'Neptune' && b.aspectType === 'semisextile';
    const venusNeptuneAffliction = venusNeptuneSemisextile
      ? readVenusNeptuneAffliction(natalPairAspects, first.sign, second.sign) : undefined;
    const ascendantSign = houses?.status === 'ready' ? Math.floor(houses.cusps[0] / 30) : undefined;
    // Leo's Pitman example binds the Venus rulership, the natal conjunction and the third house.
    const literaryVenusNeptuneAspect = venusNeptuneSemisextile && ascendantSign !== undefined
      && readLeoSignRuler(ascendantSign) === 'Venus' && first.house === 3 && second.house === 3 && first.sign === second.sign
      ? natalPairAspects.find(row => row.aspect === 'conjunction' && row.coordinate === 'longitude') : undefined;
    const natalVenusNeptuneLiteraryConjunction = literaryVenusNeptuneAspect && {
      ...literaryVenusNeptuneAspect, house: 3, sign: first.sign, ascendantSign,
    };
    const moonJupiter = first.body === 'Moon' && second.body === 'Jupiter';
    const natalMoonJupiterInvestment = moonJupiter && b.aspectType === 'trine' ? moonJupiterInvestment : undefined;
    const natalMoonJupiterDevotion = moonJupiter && b.aspectType === 'trine' ? moonJupiterDevotion : undefined;
    const natalMoonJupiterPromise = moonJupiter && b.aspectType === 'parallel' ? natalMoonJupiterPositive : undefined;
    const mercuryVenus = natalTarget && first.body === 'Mercury' && second.body === 'Venus';
    const natalVenusArtTestimonies = mercuryVenus && ['semisextile', 'sextile'].includes(b.aspectType) ? venusArtContacts : undefined;
    const natalMercuryMentalTestimonies = mercuryVenus && b.aspectType === 'sextile' ? mercuryMentalContacts : undefined;
    const natalDevotionalTestimonies = mercuryVenus && b.aspectType === 'semisextile' ? devotionalContacts : undefined;
    const natalMercuryBroadStudyContacts = natalTarget && first.body === 'Mercury' && second.body === 'Uranus' && b.aspectType === 'quincunx'
      ? mercuryBroadStudyContacts : undefined;
    const mercuryNeptune = natalTarget && first.body === 'Mercury' && second.body === 'Neptune';
    const mercuryNeptuneParallel = mercuryNeptune && b.aspectType === 'parallel';
    const neptuneReceptivity = mercuryNeptune && ['conjunction', 'semisquare', 'sesquiquadrate'].includes(b.aspectType)
      ? natalMercuryNeptuneTestimonies : undefined;
    const mercuryNeptuneComparison = mercuryNeptune && ['semisquare', 'sesquiquadrate'].includes(b.aspectType)
      ? natalMercuryContactBodies : undefined;
    const lunarNeptune = first.body === 'Moon' && second.body === 'Neptune';
    const lunarNeptuneTestimonies = lunarNeptune ? lunarNeptuneEvidence[b.aspectType] : undefined;
    const lunarNeptuneQuincunx = lunarNeptune && b.aspectType === 'quincunx';
    const neptuneCusp = lunarNeptuneQuincunx ? natalNeptuneElevation?.angularCuspApproach : undefined;
    // The same authors count a planet within the following cusp's orb toward that house (p. 19).
    const natalNeptuneAscendantApproach = neptuneCusp?.fromHouse === 12 && neptuneCusp.nextHouse === 1 ? neptuneCusp : undefined;
    const neptuneArts = mercuryNeptune && ['conjunction', 'sextile', 'parallel'].includes(b.aspectType) ? natalNeptuneArtContacts : undefined;
    const mercuryNeptuneArtistry = mercuryNeptune && (b.aspectType === 'sextile' || b.aspectType === 'parallel')
      ? natalMercuryVenusArtisticContacts : undefined;
    const natalNeptuneMinorAfflictionContacts = mercuryNeptuneParallel ? natalNeptuneAfflictionContacts.filter(row =>
      row.aspect === 'semisquare' || row.aspect === 'sesquiquadrate') : undefined;
    const mercuryMars = natalTarget && first.body === 'Mercury' && second.body === 'Mars';
    const mercuryImpulsiveness = mercuryMars && (b.aspectType === 'square' || b.aspectType === 'quincunx')
      ? natalMercuryImpulsivenessContacts : undefined;
    const marsUranus = natalTarget && first.body === 'Mars' && second.body === 'Uranus';
    const marsUranusSesquiquadrate = marsUranus && b.aspectType === 'sesquiquadrate';
    const natalAbilityContacts = marsUranus && ['semisextile', 'sextile'].includes(b.aspectType)
      ? mercuryAbilityContacts.filter(row => b.aspectType === 'sextile' || row.ability !== 'writing-and-judgment') : undefined;
    const checksNatalMarsJupiter = natalTarget && first.body === 'Mars' && second.body === 'Jupiter' && b.aspectType === 'quincunx';
    const marsNeptune = natalTarget && first.body === 'Mars' && second.body === 'Neptune';
    const marsNeptuneConjunction = marsNeptune && b.aspectType === 'conjunction';
    const checksJupiterNeptuneArt = marsNeptuneConjunction || mercuryNeptuneParallel;
    const marsNeptuneCuspApproach = marsNeptuneConjunction && houses?.status === 'ready'
      ? readLeoCuspApproach(second, houses.cusps) : undefined;
    const marsNeptuneCreativeAfflictions = marsNeptuneConjunction ? natalNeptuneAfflictionContacts : undefined;
    const marsNeptuneStrength = marsNeptune && b.aspectType === 'square' && natalAngularStrength;
    const solarNeptune = first.body === 'Sun' && second.body === 'Neptune';
    const checksSolarNeptuneNatal = solarNeptune && (b.aspectType === 'conjunction' || b.aspectType === 'parallel');
    const neptuneCreative = (marsNeptuneConjunction
      || mercuryNeptune && (b.aspectType === 'sextile' || b.aspectType === 'parallel') || checksSolarNeptuneNatal)
      ? natalNeptuneCreativeTestimonies : undefined;
    const strongMarsNeptune = marsNeptuneStrength && marsNeptuneStrength.witness && endpoints.includes(marsNeptuneStrength.witness.body);
    const lunarSolarSemisextile = first.body === 'Moon' && second.body === 'Sun' && b.aspectType === 'semisextile';
    const checksNatalFavourable = lunarSolarSemisextile || marsUranus && b.aspectType === 'sextile';
    const natalFavourableContacts = checksNatalFavourable ? favourable.filter(row =>
      endpoints.includes(row.first) || endpoints.includes(row.second)) : undefined;
    const jupiterConjunction = first.body === 'Sun' && second.body === 'Jupiter' && b.aspectType === 'conjunction';
    const checksBothNatalAfflictions = lunarSolarSemisextile || marsUranusSesquiquadrate
      || natalTarget && first.body === 'Mercury' && second.body === 'Neptune' && b.aspectType === 'trine';
    const screenedBodies = (solarNeptune && b.aspectType === 'square') || checksSolarNeptuneNatal || jupiterConjunction ? [second.body]
      : checksBothNatalAfflictions ? endpoints : undefined;
    const natalAfflictionContacts = jupiterConjunction ? natalJupiterAfflictionContacts
      : screenedBodies && (marsUranusSesquiquadrate ? afflictionsWithQuincunxes : afflictions).filter(row =>
        screenedBodies.includes(row.first) || screenedBodies.includes(row.second));
    const natalAfflictedBodies = natalAfflictionContacts && screenedBodies?.filter(body =>
      natalAfflictionContacts.some(row => row.first === body || row.second === body));
    const natalMarsUranusAfflictionFocus = marsUranusSesquiquadrate
      ? (natalAfflictedBodies?.includes('Uranus') ? 'Uranus' : natalAfflictedBodies?.includes('Mars') ? 'Mars' : undefined) : undefined;
    const natalTargetAspectContacts = checksSolarNeptuneNatal ? natalNeptuneContacts : undefined;
    // The two signed semi-sextile branches cannot cross each other within an active band.
    const mercuryNeptuneOffset = b.progressedBody === 'Mercury' && b.natalTargetId === 'Neptune' && b.aspectType === 'semisextile'
      && b.targetKind !== 'progressed' && b.progressedLongitude !== undefined
      ? arc(b.progressedLongitude - second.longitude) : undefined;
    const checksNeptuneProminence = natalTargetAspectContacts !== undefined || mercuryNeptuneOffset !== undefined;
    const neptuneElevation = checksNeptuneProminence ? natalNeptuneElevation : undefined;
    // Leo and Green, p. 85: the strongest angular planet can give the prevailing tone to the mind.
    const mercuryAngularRank = mercuryNeptuneOffset === undefined ? undefined : natalAngularStrength;
    const mercuryAngularWitness = mercuryAngularRank?.witness;
    const natalMercuryAngularDominance = mercuryAngularRank && mercuryAngularWitness?.body === 'Mercury'
      ? { ...mercuryAngularWitness, basis: mercuryAngularRank.basis } : undefined;
    const natalMercurySensitivity = Boolean(mercuryDomicileAngular || natalMercuryAngularDominance);
    const mercuryNeptuneNatalSensitivityState = mercuryNeptuneOffset === undefined ? undefined
      : natalMercurySensitivity ? natalNeptuneProminenceKnown ? 'mercury-and-neptune' : 'mercury'
        : natalNeptuneProminenceKnown ? 'neptune' : 'unreviewed';
    const rulership = readLeoPairRulership(first, second, houses?.status === 'ready' ? houses.cusps : undefined);
    const observesMarsSaturnParallel = first.body === 'Mars' && second.body === 'Saturn' && b.aspectType === 'parallel'
      && b.coordinate === 'equatorial_declination_of_date' && b.allowedOrb === leoSourcePolicy.parallelOrb;
    const natalMutualDomicileExchange = observesMarsSaturnParallel ? rulership.mutualDomicileExchange : undefined;
    const harmoniousMarsSaturn = observesMarsSaturnParallel && natalPairAspects.some(row =>
      ['semisextile', 'sextile', 'trine'].includes(row.aspect));
    const marsSaturnNatalBalanceBasis = observesMarsSaturnParallel
      ? harmoniousMarsSaturn ? natalMutualDomicileExchange ? 'both' : 'harmonious-aspect'
        : natalMutualDomicileExchange === true ? 'domicile-exchange'
          : natalMutualDomicileExchange === false ? 'no-reviewed-mitigation' : 'unreviewed'
      : undefined;
    const natalFirstRuledHouseNumbers = mercuryNeptune && b.aspectType === 'opposition'
      ? rulership.first.ruledHouses?.map(row => row.house) : undefined;
    const natalPairRuledHouseNumbers = first.body === 'Venus' && second.body === 'Jupiter' && b.aspectType === 'quincunx'
      && rulership.first.ruledHouses && rulership.second.ruledHouses
      ? [...rulership.first.ruledHouses, ...rulership.second.ruledHouses].map(row => row.house).sort((a, b) => a - b) : undefined;
    return { ...b, profile: leoSourcePolicy.profile, kind: 'secondary', targetKind: b.targetKind ?? 'natal', zodiac: 'tropical',
      progressionPolicy: progressionPolicy.version, natalBodySign: first.sign, natalTargetSign: second.sign,
      directionSignProfile: b.progressedBodySign === undefined ? undefined : leoSourcePolicy.directionSignProfile,
      natalBodyHouse: first.house, natalTargetHouse: second.house, natalSunSign: sun.sign, natalSunHouse: sun.house,
      natalLongitudeSeparation: Math.abs(arc(first.longitude - second.longitude)),
      natalAbsoluteDeclinationDifference: leoParallelDifference(first.declination, second.declination),
      natalAspectProfile: leoNatalAspectPolicy.profile, natalPairAspects,
      natalPairAspectTypes: natalPairAspects.map(row => row.aspect),
      hasNatalUranusAffliction: b.progressedBody === 'Sun' && b.natalTargetId === 'Uranus' && b.aspectType === 'quincunx'
        ? hasNatalUranusAffliction : undefined,
      natalPairAspectsChecked: venusNeptuneSemisextile ? true : undefined,
      natalVenusNeptuneAfflictionState: venusNeptuneAffliction?.state,
      natalVenusNeptuneVariableContact: venusNeptuneAffliction?.variableContact, natalVenusNeptuneLiteraryConjunction,
      natalMoonJupiterInvestment, hasNatalMoonJupiterInvestment: natalMoonJupiterInvestment && natalMoonJupiterInvestment.length > 0,
      natalMoonJupiterDevotion, hasNatalMoonJupiterDevotion: natalMoonJupiterDevotion && natalMoonJupiterDevotion.length > 0,
      natalMoonJupiterPromise, hasNatalMoonJupiterPromise: natalMoonJupiterPromise && natalMoonJupiterPromise.length > 0,
      natalMercuryNeptuneTestimonies: neptuneReceptivity,
      hasNatalMercuryNeptuneTestimony: neptuneReceptivity && neptuneReceptivity.length > 0,
      natalMercuryContactBodies: mercuryNeptuneComparison,
      hasSoleNatalMercuryNeptuneContact: mercuryNeptuneComparison && natalMercuryNeptuneTestimonies.length > 0
        && mercuryNeptuneComparison.length === 1 && mercuryNeptuneComparison[0] === 'Neptune',
      lunarNeptuneTestimonies,
      lunarNeptuneDevotionalContacts: lunarNeptuneQuincunx ? devotionalContacts : undefined,
      natalSunNeptuneCreativeContacts: lunarNeptuneQuincunx ? natalSunNeptuneCreativeContacts : undefined,
      natalNeptuneAscendantApproach,
      natalNeptuneApproachingAscendant: lunarNeptuneQuincunx && natalNeptuneElevation
        ? Boolean(natalNeptuneAscendantApproach) : undefined,
      natalNeptuneArtContacts: neptuneArts,
      hasNatalNeptuneArtContact: neptuneArts && neptuneArts.length > 0,
      natalMercuryVenusArtisticContacts: mercuryNeptuneArtistry,
      hasNatalMercuryVenusArtisticContact: mercuryNeptuneArtistry && mercuryNeptuneArtistry.length > 0,
      natalNeptuneMinorAfflictionContacts,
      hasNatalNeptuneMinorAffliction: natalNeptuneMinorAfflictionContacts && natalNeptuneMinorAfflictionContacts.length > 0,
      mercuryNeptuneParallelBandObserved: mercuryNeptuneParallel && b.coordinate === 'equatorial_declination_of_date'
        && b.allowedOrb === leoSourcePolicy.parallelOrb ? true : undefined,
      natalNeptuneParallelAfflictionContacts: mercuryNeptuneParallel ? natalNeptuneAfflictionContacts : undefined,
      natalNeptuneParallelOverindulgenceContacts: mercuryNeptuneParallel ? natalNeptuneParallelOverindulgenceContacts : undefined,
      hasNatalNeptuneParallelOverindulgenceContact: mercuryNeptuneParallel
        ? natalNeptuneParallelOverindulgenceContacts.length > 0 : undefined,
      natalNeptuneParallelVenusJupiterAdverseContacts: mercuryNeptuneParallel
        ? natalNeptuneParallelVenusJupiterAdverseContacts : undefined,
      hasNatalNeptuneParallelVenusJupiterAdverseContact: mercuryNeptuneParallel
        ? natalNeptuneParallelVenusJupiterAdverseContacts.length > 0 : undefined,
      natalNeptuneParallelAdditionalAfflictionContacts: mercuryNeptuneParallel
        ? natalNeptuneParallelAdditionalAfflictionContacts : undefined,
      hasNatalNeptuneParallelAdditionalAfflictionContact: mercuryNeptuneParallel
        ? natalNeptuneParallelAdditionalAfflictionContacts.length > 0 : undefined,
      natalNeptuneParallelFavourableConjunctions: mercuryNeptuneParallel ? natalNeptuneParallelReviews.flatMap(({ favourableConjunction }) =>
        favourableConjunction ? [favourableConjunction] : []) : undefined,
      natalNeptuneParallelSupersededContacts: mercuryNeptuneParallel ? natalNeptuneParallelReviews.flatMap(({ superseded }) =>
        superseded ? [superseded] : []) : undefined,
      natalNeptuneParallelWeakAdverseContacts: mercuryNeptuneParallel ? natalNeptuneParallelReviews.flatMap(({ weakAdverse }) =>
        weakAdverse ? [weakAdverse] : []) : undefined,
      natalNeptuneParallelWeakFavourableContacts: mercuryNeptuneParallel ? natalNeptuneParallelReviews.flatMap(({ weakFavourable }) =>
        weakFavourable ? [weakFavourable] : []) : undefined,
      natalNeptuneParallelUnclassifiedContacts: mercuryNeptuneParallel
        ? natalNeptuneParallelReviews.flatMap(row => row.unclassified) : undefined,
      natalNeptuneCreativeTestimonies: neptuneCreative,
      hasNatalNeptuneCreativeTestimony: neptuneCreative && neptuneCreative.length > 0,
      natalNeptuneJupiterArtisticContacts: checksJupiterNeptuneArt ? natalNeptuneJupiterArtisticContacts : undefined,
      hasNatalNeptuneJupiterArtisticContact: checksJupiterNeptuneArt ? natalNeptuneJupiterArtisticContacts.length > 0 : undefined,
      marsNeptuneCuspApproach, natalMarsNeptuneApproachedHouse: marsNeptuneCuspApproach?.nextHouse,
      natalMarsNeptuneWritingContacts: marsNeptuneConjunction ? natalMercuryNeptuneWritingContacts : undefined,
      hasNatalMarsNeptuneWritingContact: marsNeptuneConjunction ? natalMercuryNeptuneWritingContacts.length > 0 : undefined,
      hasNatalMarsNeptuneWritingAffliction: marsNeptuneConjunction ? natalMercuryNeptuneWritingAffliction : undefined,
      natalMarsNeptuneCreativeAfflictionContacts: marsNeptuneCreativeAfflictions,
      hasNatalMarsNeptuneCreativeAffliction: marsNeptuneCreativeAfflictions && marsNeptuneCreativeAfflictions.length > 0,
      natalVenusArtTestimonies, hasNatalVenusArtTestimony: natalVenusArtTestimonies && natalVenusArtTestimonies.length > 0,
      natalMercuryMentalTestimonies, hasNatalMercuryMentalTestimony: natalMercuryMentalTestimonies && natalMercuryMentalTestimonies.length > 0,
      natalDevotionalTestimonies, hasNatalDevotionalTestimony: natalDevotionalTestimonies && natalDevotionalTestimonies.length > 0,
      natalMercuryImpulsivenessContacts: mercuryImpulsiveness,
      hasNatalMercuryImpulsivenessTestimony: mercuryImpulsiveness && mercuryImpulsiveness.length > 0,
      natalMercuryBroadStudyContacts,
      hasNatalMercuryBroadStudyTestimony: natalMercuryBroadStudyContacts && natalMercuryBroadStudyContacts.length > 0,
      natalMarsJupiterProminence: checksNatalMarsJupiter ? natalMarsJupiterProminence : undefined,
      natalMarsNeptuneStrong: marsNeptuneStrength ? Boolean(strongMarsNeptune) : undefined,
      natalMarsNeptuneStrength: strongMarsNeptune ? { ...marsNeptuneStrength.witness, basis: marsNeptuneStrength.basis } : undefined,
      natalMutualDomicileExchange,
      natalMutualDomicileSigns: natalMutualDomicileExchange ? [first.sign, second.sign] : undefined,
      marsSaturnParallelBandObserved: observesMarsSaturnParallel ? true : undefined,
      marsSaturnNatalBalanceBasis,
      mercuryNeptuneOffset, mercuryBehindNeptune: mercuryNeptuneOffset === undefined ? undefined : mercuryNeptuneOffset < 0,
      mercuryNeptuneNatalSensitivityState,
      natalNeptuneElevation: neptuneElevation, natalNeptuneClosestToMidheaven: neptuneElevation?.isClosest,
      natalNeptuneBeforeAngularCusp: neptuneElevation && Boolean(neptuneElevation.angularCuspApproach),
      natalNeptuneSoleLuminaryContacts: checksNeptuneProminence ? natalNeptuneSoleLuminaryContacts : undefined,
      hasNatalNeptuneSoleLuminaryContact: checksNeptuneProminence ? natalNeptuneSoleLuminaryContacts.length > 0 : undefined,
      natalNeptuneClosestComparableLuminaryContacts: checksNeptuneProminence ? natalNeptuneClosestComparableLuminaryContacts : undefined,
      hasNatalNeptuneClosestComparableLuminaryContact: checksNeptuneProminence
        ? natalNeptuneClosestComparableLuminaryContacts.length > 0 : undefined,
      natalMercuryDomicileAngular: mercuryNeptuneOffset === undefined ? undefined : mercuryDomicileAngular,
      natalMercuryAngularDominance,
      natalMercuryDominantAngular: mercuryAngularRank && Boolean(natalMercuryAngularDominance),
      natalSextileTrineBodies: linkedBodies(supportive), natalSquareOppositionBodies: linkedBodies(hard),
      natalMajorAspectContacts: contacts,
      natalFavourableContacts,
      natalFavourableBodies: natalFavourableContacts && linkedBodies(natalFavourableContacts),
      natalAbilityContacts, natalAbilityTypes: natalAbilityContacts && [...new Set(natalAbilityContacts.map(row => row.ability))],
      natalTargetAspectContacts,
      hasNatalTargetAspect: natalTargetAspectContacts && natalTargetAspectContacts.length > 0,
      hasSolarNeptuneExact: checksSolarNeptuneNatal ? b.exactTimes.length > 0 : undefined,
      solarNeptuneNatalEvidenceState: checksSolarNeptuneNatal ? solarNeptuneNatalEvidenceState : undefined,
      natalAfflictionContacts,
      natalAfflictedBodies, natalMarsUranusAfflictionFocus,
      pairRulershipProfile: leoRulershipPolicy.profile,
      rulership, natalFirstRuledHouseNumbers, natalFirstRuledHouseCount: natalFirstRuledHouseNumbers?.length, natalPairRuledHouseNumbers,
      dayChart: natalContext.dayChart, houseStatus: natalContext.houseStatus,
      parallelComparison: b.aspectType === 'parallel' ? leoSourcePolicy.parallelComparison : undefined };
  };
  const bands: GeometricBand[] = progression.intervals.filter(b => b.aspectType !== 'parallel'
    && (targets[b.progressedBody]?.includes(b.natalTargetId)
      || (includeProgressedPairs && b.aspectType === 'square' && b.progressedBody === 'Venus' && b.natalTargetId === 'Mercury')))
    .map(b => ({ ...b, natalTargetId: b.natalTargetId as Planet }));
  const cache = new Map<string, number>();
  const decAt = (body: Planet, at: number) => {
    const epoch = Math.round(progressionEpoch(birthAt, at)), key = body + ':' + epoch;
    if (!cache.has(key)) cache.set(key, readLeoEquatorial(body, epoch).dec);
    return cache.get(key)!;
  };
  const natalParallelBands = (search: Window, body: Planet, partner: Planet): GeometricBand[] => {
    const natalDec = natal.find(n => n.body === partner)!.declination;
    return scanLeoParallel(search, at => decAt(body, at), natalDec).map(band => {
      const progressedDec = decAt(body, (band.start + band.end) / 2);
      return { ...band, progressedBody: body, natalTargetId: partner, aspectType: 'parallel',
        allowedOrb: leoSourcePolicy.parallelOrb, coordinate: 'equatorial_declination_of_date',
        progressedDeclination: progressedDec, natalDeclination: natalDec,
        separation: leoParallelDifference(progressedDec, natalDec),
        sameHemisphere: natalDec === 0 ? undefined : Math.sign(progressedDec) === Math.sign(natalDec) };
    });
  };
  for (const [body, partners] of Object.entries(targets)) for (const partner of partners!) {
    bands.push(...natalParallelBands(window, body as Planet, partner));
  }
  const byStart = (a: GeometricBand, b: GeometricBand) => a.start - b.start || a.progressedBody.localeCompare(b.progressedBody);
  const intervals = bands.flatMap(band => {
    const longitudeAt = (at: number) => readLeoMovingPosition(band.progressedBody,
      Math.round(progressionEpoch(birthAt, Math.max(at, birthAt)))).longitude;
    return band.progressedBody === 'Mars' && band.natalTargetId === 'Neptune' && band.aspectType === 'conjunction'
      ? splitLeoConjunctionAtSigns(band, longitudeAt) : splitLeoRulershipDirectionAtSigns(band, longitudeAt);
  }).sort(byStart).map(enrich);
  const progressedPairs = includeProgressedPairs ? buildLeoProgressedPairs(window, birthAt).sort(byStart).map(enrich) : [];
  // The Venus–Neptune and Venus–Jupiter passages ask about separate contemporary
  // influences. The regular list omits directions between two slow planets.
  const venusNeptuneBands = includeProgressedPairs ? intervals.filter(band => band.progressedBody === 'Venus'
    && band.natalTargetId === 'Neptune' && (band.aspectType === 'sextile' || band.aspectType === 'trine')) : [];
  const venusJupiterBands = includeProgressedPairs ? intervals.filter(band => band.progressedBody === 'Venus'
    && band.natalTargetId === 'Jupiter' && band.aspectType === 'conjunction') : [];
  const concurrentReviewBands = [...venusNeptuneBands, ...venusJupiterBands];
  const slowContraryPairs = concurrentReviewBands.length ? buildLeoProgressedPairs({
    start: Math.min(...concurrentReviewBands.map(band => band.start)), end: Math.max(...concurrentReviewBands.map(band => band.end)),
  }, birthAt, slowPlanetPairs) : undefined;
  const scanAdditionalNatalContraryPairs = (observations: readonly GeometricBand[], otherBodies: readonly Planet[]) => {
    if (!observations.length) return undefined;
    const start = Math.min(...observations.map(band => band.start)), end = Math.max(...observations.map(band => band.end));
    const isAdditionalPair = (moving: Planet, fixed: Planet) => moving !== fixed
      && otherBodies.includes(moving) && otherBodies.includes(fixed) && !targets[moving]?.includes(fixed);
    // The chapter does not delineate every orientation of these pairs.
    // Keep the additional geometry separate so it cannot acquire a reading by default.
    const longitude = progression.intervals.filter(band => band.aspectType !== 'parallel' && band.start < end && start < band.end
      && !(band.progressedBody === 'Venus' && band.natalTargetId === 'Mercury' && band.aspectType === 'square')
      && isAdditionalPair(band.progressedBody, band.natalTargetId));
    const parallels = otherBodies.flatMap(moving => otherBodies.filter(fixed => isAdditionalPair(moving, fixed))
      .flatMap(fixed => natalParallelBands({ start, end }, moving, fixed)));
    return [...longitude, ...parallels].map(band => ({ ...band, targetKind: 'natal' as const }));
  };
  const additionalNatalContraryPairs = {
    sextile: scanAdditionalNatalContraryPairs(venusNeptuneBands.filter(band => band.aspectType === 'sextile'), leoNatalBodies),
    trine: scanAdditionalNatalContraryPairs(venusNeptuneBands.filter(band => band.aspectType === 'trine'), [...leoVenusNeptuneOtherBodies]),
    venusJupiter: scanAdditionalNatalContraryPairs(venusJupiterBands, leoNatalBodies),
  };
  // This geometry supports only the specific lunar comparisons. It does not
  // add standalone Leo interpretations for the reverse or same-planet pairs.
  const natalBridgeBands = includeProgressedPairs ? [
    ...progression.intervals.filter(band => band.coordinate === 'ecliptic_longitude'
      && lunarBridgeNatalTargets.includes(band.natalTargetId) && leoNatalBodies.some(body => body === band.progressedBody)),
    ...lunarBridgeNatalTargets.flatMap(body => {
      const natalLongitude = natal.find(row => row.body === body)!.longitude;
      const longitudes = new Map<number, number>();
      const longitudeAt = (at: number) => {
        const ephemerisAt = Math.round(progressionEpoch(birthAt, at));
        if (!longitudes.has(ephemerisAt)) longitudes.set(ephemerisAt, readLeoMovingPosition(body, ephemerisAt).longitude);
        return longitudes.get(ephemerisAt)!;
      };
      return scanProgressionLongitudePair(window, longitudeAt, natalLongitude)
        .map(band => ({ ...band, progressedBody: body, natalTargetId: body }));
    }),
  ] : [];
  const needsSolarDignities = includeProgressedPairs && [...intervals, ...progressedPairs].some(band =>
    band.progressedBody === 'Moon' && band.natalTargetId === 'Sun' && band.aspectType === 'parallel');
  const progressedSolarDignities = needsSolarDignities ? scanLeoSolarDignities(window,
    at => SunPosition(new Date(Math.round(progressionEpoch(birthAt, at)))).elon) : [];
  return { status: 'ready', policy: leoSourcePolicy, birthAt, natalContext, natalFinancialContext, natalSolarContacts, natalSolarDignity: leoSolarDignity(sun.sign),
    natalJupiterAfflictionContacts, natalNeptuneCreativeTestimonies, natalNeptuneDevotionalContacts: devotionalContacts,
    natalAspectProfile: leoNatalAspectPolicy.profile, natalSunNeptuneCreativeContacts, solarNeptuneNatalEvidence,
    natalMercuryVenusArtisticContacts,
    progressedSolarDignities, intervals, progressedPairs, slowContraryPairs, additionalNatalContraryPairs, natalBridgeBands,
    lunarContacts: linkLeoLunarContacts([...intervals, ...progressedPairs]) } as const;
}
