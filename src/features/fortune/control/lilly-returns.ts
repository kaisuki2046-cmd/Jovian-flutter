import { Body, e_tilt, EquatorFromVector, GeoVector, MakeTime, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import type { FortuneReturnLocation } from '../model/fortune-facts';
import { lillyEssentialDignities, lillyEssentialPolicy, type ClassicalPlanet } from './lilly-essential';
import { lillyAccidentalPolicy, lillyAspectOrbs, lillyFixedStarPositions, lillyLunarNodes, lillyNatalMoonDebility, lillyNatalMoonWorkedDebility, lillyNatalMoonWorkedFortitude, lillyP115Points,
  lillyP745NatalMoonBalance, lillyPlanetConditions, lillyPrintedLongitudeMinute, lillySolarCondition, lillyVenusFortitudeAtReturn,
  type LillyEpochPosition } from './lilly-accidental';
import { readProgressionBirth } from './western-progressions';
import { calculateHouseCusps, readWesternHouseFrame, westernHousePolicy, zodiacalHouse } from './western-houses';
import { buildSolarReturnPositions, readTransitLongitude, westernSearchPolicy } from './solar-transits';

const rad = Math.PI / 180, day = 86_400_000;
const lillyCuspVirtueDegrees = 5;
const pairs: { pair: string; returning: ClassicalPlanet; target: ClassicalPlanet }[] = [
  { pair: 'saturn-self', returning: 'Saturn', target: 'Saturn' },
  { pair: 'jupiter-mercury', returning: 'Jupiter', target: 'Mercury' },
  { pair: 'venus-mercury', returning: 'Venus', target: 'Mercury' },
  { pair: 'moon-self', returning: 'Moon', target: 'Moon' },
];
export const lillyReturnPolicy = {
  profile: 'lilly-return-source-pairs-v3-radical-place', essential: lillyEssentialPolicy, accidental: lillyAccidentalPolicy,
  pairPolicy: 'same-natal-snapshot-same-actual-solar-return-epoch',
  coincidence: 'same-sign-or-printed-orb-candidate-cross-chart-threshold-unresolved',
  returnLocation: 'explicit-unique-return-location-no-birth-location-default',
  localFrame: 'lilly-revolution-local-regiomontanus-v1',
  midheavenApproachDegrees: lillyCuspVirtueDegrees,
  epochCheck: 'source-sun-return-root-tolerance-is-not-a-conjunction-orb',
  exactEpochBasis: 'natal-sun-ephemeris',
  horizonContrast: 'lilly-book-three-p737-radical-below-revolution-above',
  returnSignification: 'lilly-book-three-p737-radical-lord-return-house-v1',
  revolutionFortune: 'lilly-book-three-p736-radical-luminaries-return-fortune-v1',
  ascendantDomicile: 'lilly-book-three-p736-same-rising-minute-domicile-v1',
  hardRisingAspect: 'lilly-book-three-p736-737-rising-square-opposition-v1',
} as const;

export const lillySeventhReturnPolicy = {
  profile: 'lilly-revolution-rising-and-radical-seventh-v1', zodiac: 'tropical', houseSystem: 'regiomontanus',
  location: 'explicit-for-the-unique-return-in-the-display-year',
  boundary: 'same-sign-within-return-root-tolerance-no-aspect-orb',
} as const;

type Window = { start: number; end: number };
type SolarReturns = ReturnType<typeof buildSolarReturnPositions>;

function uniqueReturnInWindow(window: Window, returns: SolarReturns) {
  const events = returns.filter(item => window.start <= item.returnAt && item.returnAt < window.end);
  return events.length === 1 ? events[0] : undefined;
}

function containsSolarReturnRoot(returnAt: number, natalSunLongitude: number) {
  const tolerance = westernSearchPolicy.aspectToleranceMs;
  const offset = (instant: number) => ((readTransitLongitude('Sun', instant) - natalSunLongitude + 540) % 360) - 180;
  // Astronomy Engine reuses nutation for nearby times. Allow its sub-millisecond angular drift.
  const longitudeToleranceDegrees = 1e-9;
  return offset(returnAt - tolerance) <= longitudeToleranceDegrees
    && offset(returnAt + tolerance) >= -longitudeToleranceDegrees;
}

export function buildLillySolarReturnPositions(window: Window, chart: DestinyChartSnapshot | undefined) {
  const western = chart?.western;
  const birth = readProgressionBirth(chart);
  if (!western || birth.status !== 'ready') return buildSolarReturnPositions(window, western);
  // Lilly, Book III p.734: use the actual birth Sun, even if display longitudes were rounded.
  const longitude = readTransitLongitude('Sun', birth.birthAt);
  const [natal] = western.rawResult;
  const positions = natal.positions.map(row => row.planet === 'Sun' ? { ...row, longitude } : row);
  return buildSolarReturnPositions(window, { ...western, rawResult: [{ ...natal, positions }] });
}

export function lillyReturnLocationTarget(window: Window, chart: DestinyChartSnapshot) {
  const natal = readWesternHouseFrame(chart);
  if (natal.status !== 'ready') return undefined;
  const returnAt = uniqueReturnInWindow(window, buildLillySolarReturnPositions(window, chart))?.returnAt;
  return returnAt !== undefined && returnAt > natal.birthAt + 60_000 ? returnAt : undefined;
}

export function readFortuneReturnLocation(returnAt: number, latitudeText: string, longitudeText: string) {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u;
  if (!decimal.test(latitudeText.trim()) || !decimal.test(longitudeText.trim())) return undefined;
  const location = { returnAt, latitude: Number(latitudeText), longitude: Number(longitudeText) };
  return validReturnLocation(location) ? location : undefined;
}

function validReturnLocation(location: FortuneReturnLocation) {
  return Number.isSafeInteger(location.returnAt) && Number.isFinite(location.latitude) && Math.abs(location.latitude) < 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

function planetAltitude(body: ClassicalPlanet, at: number, armc: number, latitude: number) {
  const time = new Date(at);
  const { ra, dec } = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), GeoVector(Body[body], time, true)));
  const sine = Math.sin(latitude * rad) * Math.sin(dec * rad)
    + Math.cos(latitude * rad) * Math.cos(dec * rad) * Math.cos((armc - ra * 15) * rad);
  return Math.asin(Math.max(-1, Math.min(1, sine))) / rad;
}

const toSect = (altitude: number): 'day' | 'night' | undefined => Math.abs(altitude) < 1e-8 ? undefined : altitude > 0 ? 'day' : 'night';

function lillyPlanetHorizon(samples: readonly { instant: number; armc: number }[], latitude: number) {
  return lillyEssentialPolicy.planets.map(body => {
    const sides = samples.map(({ instant, armc }) => toSect(planetAltitude(body, instant, armc, latitude)));
    const [first] = sides;
    const side = first && sides.every(current => current === first) ? (first === 'day' ? 'above' : 'below') : undefined;
    return { body, side } as const;
  });
}

// Book I p. 33 assigns the virtue to the nearest cusp within five degrees.
// Keep that separate from the planet's actual house.
function lillyScoringHouse(longitude: number, cusps: number[]) {
  const fromHouse = zodiacalHouse(longitude, cusps), cuspHouse = fromHouse % 12 + 1;
  const distance = (cusps[cuspHouse - 1] - longitude + 360) % 360;
  const distanceFromCurrent = (longitude - cusps[fromHouse - 1] + 360) % 360;
  if (distance > lillyCuspVirtueDegrees || distanceFromCurrent + westernHousePolicy.angleResidualTolerance < distance) {
    return { house: fromHouse };
  }
  if (distance + westernHousePolicy.angleResidualTolerance < distanceFromCurrent) {
    return { house: cuspHouse, approach: { fromHouse, cuspHouse, distance } };
  }
}

// Book III p.736 retains the natal solar-lunar distance in the return figure.
export function lillyRevolutionFortune(natalSun: number, natalMoon: number, returnAscendant: number) {
  return (returnAscendant + natalMoon - natalSun + 360) % 360;
}

export function buildLillyLocatedReturn(window: Window, chart: DestinyChartSnapshot | undefined, returns: SolarReturns,
  location?: FortuneReturnLocation) {
  if (!location || !validReturnLocation(location)) return undefined;
  const item = uniqueReturnInWindow(window, returns);
  if (!item || item.returnAt !== location.returnAt || !Number.isSafeInteger(item.returnEnd)
    || item.start !== item.returnAt || item.end !== Math.min(window.end, item.returnEnd)
    || !(item.start < item.end)) return undefined;
  const natal = readWesternHouseFrame(chart);
  if (natal.status !== 'ready' || item.returnAt <= natal.birthAt + 60_000) return undefined;
  const natalSunLongitude = readTransitLongitude('Sun', natal.birthAt);
  const rootTolerance = westernSearchPolicy.aspectToleranceMs;
  if (natalSunLongitude !== item.natalSunLongitude || !containsSolarReturnRoot(item.returnAt, item.natalSunLongitude)) return undefined;

  const natalHouses = calculateHouseCusps(natal.armc, natal.latitude, natal.obliquity, 'regiomontanus');
  if (natalHouses.status !== 'ready') return undefined;
  const natalSeventhLongitude = natalHouses.cusps[6];
  const samples = [item.returnAt, item.returnAt - rootTolerance, item.returnAt + rootTolerance].flatMap(instant => {
    const time = MakeTime(new Date(instant)), armc = SiderealTime(time) * 15 + location.longitude;
    const houses = calculateHouseCusps(armc, location.latitude, e_tilt(time).tobl, 'regiomontanus');
    return houses.status === 'ready' ? [{ instant, armc, cusps: houses.cusps }] : [];
  });
  if (samples.length !== 3) return undefined;
  const [central] = samples;
  const returnAscendant = central.cusps[0];
  const natalMoonLongitude = readTransitLongitude('Moon', natal.birthAt);
  const fortuneHouses = samples.map(({ cusps }) => zodiacalHouse(lillyRevolutionFortune(natalSunLongitude, natalMoonLongitude, cusps[0]), cusps));
  const [centralFortuneHouse] = fortuneHouses;
  const returnFortune = fortuneHouses.every(house => house === centralFortuneHouse)
    ? { profile: lillyReturnPolicy.revolutionFortune, house: centralFortuneHouse } : undefined;
  const zodiacSign = (longitude: number) => Math.floor(longitude / 30);
  const returnSign = zodiacSign(returnAscendant);
  const ascendingSamples = samples.map(({ cusps }) => cusps[0]);
  const returnSignStable = ascendingSamples.every(longitude => zodiacSign(longitude) === returnSign);
  const natalCuspSign = (longitude: number) =>
    Math.abs(longitude - Math.round(longitude / 30) * 30) > westernHousePolicy.angleResidualTolerance ? zodiacSign(longitude) : undefined;
  const comparedNatalCusps = ([6, 12] as const).map(house => ({ house, sign: natalCuspSign(natalHouses.cusps[house - 1]) }));
  // Book III p.737 compares the sign of the radical cusp, independently of actual house occupancy.
  const returnRisingSignMatchesNatalCuspHouse = returnSignStable && comparedNatalCusps.every(({ sign }) => sign !== undefined)
    ? comparedNatalCusps.find(({ sign }) => sign === returnSign)?.house ?? 'different-sign' as const : undefined;
  const natalAscendant = natalHouses.cusps[0];
  const matchesRisingMinute = (target: number) => ascendingSamples.every(longitude => zodiacSign(longitude) === zodiacSign(target))
    && lillyRadicalPlaceMinute(target, ascendingSamples) === 'same_printed_minute';
  const commonRisingRuler = matchesRisingMinute(natalAscendant)
    ? lillyEssentialDignities('Sun', returnAscendant).signLord : undefined;
  // Book III pp.736–737 treats the ascendants' aspect and the natal house
  // containing the return ascendant as two independent observations.
  const hardAngle = [90, 180, 270].find(angle => matchesRisingMinute((natalAscendant + angle) % 360));
  const returnAscendantHardAspect = hardAngle === undefined ? undefined : hardAngle === 180 ? 'opposition' : 'square';
  const natalHousesAtReturnAscendant = hardAngle === undefined ? [] : ascendingSamples.map(longitude => zodiacalHouse(longitude, natalHouses.cusps));
  const [natalHouseAtReturnAscendant] = natalHousesAtReturnAscendant;
  const returnAscendantNatalHouse = natalHousesAtReturnAscendant.every(house => house === natalHouseAtReturnAscendant)
    ? natalHouseAtReturnAscendant : undefined;
  const houseByPlanet = new Map(lillyEssentialPolicy.planets.map(body => {
    const houses = samples.map(sample => zodiacalHouse(readTransitLongitude(body, sample.instant), sample.cusps));
    return [body, houses.every(house => house === houses[0]) ? houses[0] : undefined] as const;
  }));
  const scoringSamples = (body: ClassicalPlanet) => samples.map(({ instant, cusps }) => lillyScoringHouse(readTransitLongitude(body, instant), cusps));
  const venusScoring = scoringSamples('Venus'), saturnScoring = scoringSamples('Saturn');
  const retainsActualHouse = (body: ClassicalPlanet, scores: ReturnType<typeof scoringSamples>) => {
    const actual = houseByPlanet.get(body);
    return actual !== undefined && scores.every(row => row?.house === actual);
  };
  const venusRetainsActualHouse = retainsActualHouse('Venus', venusScoring);
  const saturnRetainsActualHouse = retainsActualHouse('Saturn', saturnScoring);
  const stableCuspApproach = (scores: ReturnType<typeof scoringSamples>) => {
    const approaches = scores.flatMap(row => row?.approach ?? []);
    const [central] = approaches;
    return central && approaches.length === samples.length
      && approaches.every(row => row.fromHouse === central.fromHouse && row.cuspHouse === central.cuspHouse)
      ? { ...central, distanceRange: [Math.min(...approaches.map(row => row.distance)),
        Math.max(...approaches.map(row => row.distance))] as const } : undefined;
  };
  const venusCuspVirtue = stableCuspApproach(venusScoring);
  const saturnCuspVirtue = stableCuspApproach(saturnScoring);
  const planetHorizon = lillyPlanetHorizon(samples, location.latitude);
  const sunHorizon = planetHorizon.find(row => row.body === 'Sun')?.side;
  const sect: ReturnType<typeof toSect> = sunHorizon === 'above' ? 'day' : sunHorizon === 'below' ? 'night' : undefined;
  const saturnApproachSamples = samples.map((sample, index) => {
    const longitude = readTransitLongitude('Saturn', sample.instant);
    const distance = (sample.cusps[9] - longitude + 540) % 360 - 180;
    return { distance, within: saturnScoring[index]?.approach?.cuspHouse === 10 };
  });
  const saturnMidheavenApproachStatus = saturnApproachSamples.every(row => row.within) ? 'within-five-before'
    : saturnApproachSamples.some(row => row.within) ? 'boundary' : 'outside-five-before';
  const saturnDistances = saturnApproachSamples.map(row => row.distance);
  const saturnMidheavenDistanceRange = [Math.min(...saturnDistances), Math.max(...saturnDistances)] as const;
  // The return calculation locates an epoch to a finite tolerance. It cannot
  // decide between two rising signs when that tolerance straddles a boundary.
  const seventhReady = natalCuspSign(natalSeventhLongitude) !== undefined && returnSignStable;
  const epoch = { start: item.start, end: item.end, returnAt: item.returnAt, returnEnd: item.returnEnd };
  const seventh = seventhReady ? { ...epoch,
    profile: lillySeventhReturnPolicy.profile, zodiac: lillySeventhReturnPolicy.zodiac, houseSystem: lillySeventhReturnPolicy.houseSystem,
    natalSeventhLongitude, returnAscendant, sameSign: returnSign === zodiacSign(natalSeventhLongitude) } : undefined;
  return { ...epoch, birthAt: natal.birthAt, sect, houseByPlanet, venusRetainsActualHouse, saturnRetainsActualHouse, venusCuspVirtue, saturnCuspVirtue,
    seventh, returnFortune, commonRisingRuler, returnAscendantHardAspect, returnAscendantNatalHouse, returnRisingSignMatchesNatalCuspHouse,
    saturnMidheavenApproachStatus, saturnMidheavenDistanceRange,
    planetHorizon };
}

export function buildLillySeventhReturn(window: Window, chart: DestinyChartSnapshot | undefined, returns: SolarReturns,
  location?: FortuneReturnLocation) {
  return buildLillyLocatedReturn(window, chart, returns, location)?.seventh;
}

export function lillyRadicalPlaceContact(returnBody: ClassicalPlanet, returningLongitude: number,
  natalBody: ClassicalPlanet, natalLongitude: number) {
  const longitudeSeparation = Math.abs(((returningLongitude - natalLongitude + 540) % 360 + 360) % 360 - 180);
  const sameSign = Math.floor(returningLongitude / 30) === Math.floor(natalLongitude / 30);
  const { mainOrb, alternateOrb } = lillyAspectOrbs(returnBody, natalBody);
  const inMainOrb = longitudeSeparation <= mainOrb, inAlternateOrb = longitudeSeparation <= alternateOrb;
  const placeComparison = inMainOrb && inAlternateOrb ? 'both_columns' : inMainOrb || inAlternateOrb ? 'one_column'
    : sameSign ? 'same_sign_only' : 'outside_sign_and_columns';
  return { longitudeSeparation, sameSign, sameDegreeCell: Math.floor(returningLongitude) === Math.floor(natalLongitude),
    mainOrb, alternateOrb, placeComparison, radicalPlaceCandidate: placeComparison !== 'outside_sign_and_columns' } as const;
}

export function lillyRadicalPlaceMinute(natalLongitude: number, returnLongitudes: readonly number[]) {
  const minutes = Array.from(new Set(returnLongitudes.map(lillyPrintedLongitudeMinute)));
  if (minutes.length !== 1) return 'minute_boundary';
  return minutes[0] === lillyPrintedLongitudeMinute(natalLongitude) ? 'same_printed_minute' : 'different_printed_minutes';
}

export function buildLillyReturnContext(window: { start: number; end: number }, chart: DestinyChartSnapshot | undefined,
  returns: SolarReturns, locatedReturn?: ReturnType<typeof buildLillyLocatedReturn>) {
  const birth = readProgressionBirth(chart);
  if (!chart || birth.status !== 'ready') return { status: birth.status, policy: lillyReturnPolicy, contexts: [] } as const;
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.end <= window.start
    || window.end - window.start > 368 * day || window.start <= birth.birthAt) {
    return { status: 'invalid_window', policy: lillyReturnPolicy, contexts: [] } as const;
  }
  const positions = chart.western.rawResult[0].positions;
  if (lillyEssentialPolicy.planets.some(body => positions.filter(p => p.planet === body).length !== 1)) {
    return { status: 'incomplete_natal', policy: lillyReturnPolicy, contexts: [] } as const;
  }
  const natalSunLongitude = readTransitLongitude('Sun', birth.birthAt);
  const frame = readWesternHouseFrame(chart);
  const houses = frame.status === 'ready' ? calculateHouseCusps(frame.armc, frame.latitude, frame.obliquity, 'regiomontanus') : undefined;
  const natalSixthCusp = houses?.status === 'ready' ? houses.cusps[5] : undefined;
  const natalSixthSign = natalSixthCusp === undefined
    || Math.abs(natalSixthCusp - Math.round(natalSixthCusp / 30) * 30) <= westernHousePolicy.angleResidualTolerance
    ? undefined : Math.floor(natalSixthCusp / 30);
  const altitude = frame.status === 'ready' ? planetAltitude('Sun', birth.birthAt, frame.armc, frame.latitude) : undefined;
  const natalSect = altitude === undefined ? undefined : toSect(altitude);
  const natalPlanetHorizon = frame.status === 'ready'
    ? lillyPlanetHorizon([{ instant: birth.birthAt, armc: frame.armc }], frame.latitude) : undefined;
  const sampled = new Map<ClassicalPlanet, Map<number, LillyEpochPosition>>();
  const read = (body: ClassicalPlanet, at: number) => {
    const cache = sampled.get(body) ?? new Map<number, LillyEpochPosition>();
    if (!sampled.has(body)) sampled.set(body, cache);
    const existing = cache.get(at);
    if (existing) return existing;
    const position = { body, longitude: readTransitLongitude(body, at),
      speed: (((readTransitLongitude(body, at + 600_000) - readTransitLongitude(body, at - 600_000) + 540) % 360) - 180) * 72 };
    cache.set(at, position);
    return position;
  };
  const epochPositions = (at: number) => lillyEssentialPolicy.planets.map(body => read(body, at));
  const natalEpoch = epochPositions(birth.birthAt);
  const natalNodes = lillyLunarNodes(birth.birthAt);
  const natalFixedStars = lillyFixedStarPositions(birth.birthAt);
  const contexts = returns.flatMap(item => {
    if (![item.start, item.end, item.returnAt, item.returnEnd].every(Number.isSafeInteger)
      || !(item.returnAt < item.returnEnd && item.returnAt > birth.birthAt + 60_000 && item.start < item.end)
      || item.start !== Math.max(window.start, item.returnAt) || item.end !== Math.min(window.end, item.returnEnd)
      || lillyEssentialPolicy.planets.some(body => item.bodies.filter(p => p.planet === body && Number.isFinite(p.longitude)
        && p.longitude >= 0 && p.longitude < 360 && Number.isFinite(p.speed)).length !== 1)) return [];
    if (item.natalSunLongitude !== natalSunLongitude || !containsSolarReturnRoot(item.returnAt, natalSunLongitude)
      || !containsSolarReturnRoot(item.returnEnd, natalSunLongitude)) return [];
    const arc = (n: number) => ((n + 540) % 360 + 360) % 360 - 180;
    const returnEpoch = epochPositions(item.returnAt);
    if (lillyEssentialPolicy.planets.some(body => {
      const p = item.bodies.find(p => p.planet === body)!;
      const calculated = returnEpoch.find(row => row.body === body)!;
      return Math.abs(arc(p.longitude - calculated.longitude)) > 1e-9 || Math.abs(p.speed - calculated.speed) > 1e-9
        || p.direction !== (p.speed < 0 ? 'retrograde' : 'direct');
    })) return [];
    const local = locatedReturn?.birthAt === birth.birthAt && locatedReturn.returnAt === item.returnAt && locatedReturn.returnEnd === item.returnEnd
      && locatedReturn.start === item.start && locatedReturn.end === item.end ? locatedReturn : undefined;
    const returnPlanetHorizon = local?.planetHorizon;
    // Book III p.737 gives this one configuration as an example, not a strength score.
    const returnHorizonContrast = !natalPlanetHorizon?.every(row => row.side) || !returnPlanetHorizon?.every(row => row.side)
      ? 'unverified' : natalPlanetHorizon.every(row => row.side === 'below') && returnPlanetHorizon.every(row => row.side === 'above')
        ? 'radix-below-return-above' : 'different-configuration';
    const returningNodes = lillyLunarNodes(item.returnAt);
    const returningFixedStars = lillyFixedStarPositions(item.returnAt);
    return pairs.map(pair => {
      const returning = item.bodies.find(p => p.planet === pair.returning)!;
      // A saved position may be rounded. Use one recomputed natal longitude for
      // both the narrow printed-minute evidence and the broader geometry.
      const natal = natalEpoch.find(p => p.body === pair.target)!;
      const contact = lillyRadicalPlaceContact(pair.returning, returning.longitude, pair.target, natal.longitude);
      const rootTolerance = westernSearchPolicy.aspectToleranceMs;
      const returnLongitudes = [
        readTransitLongitude(pair.returning, item.returnAt - rootTolerance), returning.longitude,
        readTransitLongitude(pair.returning, item.returnAt + rootTolerance),
      ];
      const radicalPlaceMinuteState = lillyRadicalPlaceMinute(natal.longitude, returnLongitudes);
      const returnHouse = local?.houseByPlanet.get(pair.returning);
      const natalTargetHouse = houses?.status === 'ready' ? zodiacalHouse(natal.longitude, houses.cusps) : undefined;
      const returnSign = Math.floor(returning.longitude / 30);
      // Book III p.789 compares an actual Moon in XII with the sign of the
      // radical VI cusp. It is a separate house/sign witness from natal weakness.
      const returnMoonRadicalSixthInTwelfth = pair.returning === 'Moon' && returnHouse !== undefined && natalSixthSign !== undefined
        && returnLongitudes.every(longitude => Math.floor(longitude / 30) === returnSign)
        ? returnHouse === 12 && returnSign === natalSixthSign : undefined;
      // Book III p.737 follows a radical significator into its house in the revolution.
      // The returning planet keeps its own radix roles, even when the paired natal target differs.
      const returnSignification = pair.returning !== 'Jupiter' && houses?.status === 'ready' && returnHouse !== undefined
        ? { profile: lillyReturnPolicy.returnSignification, body: pair.returning, returnHouse,
          natalRuledHouses: houses.cusps.flatMap((cusp, index) =>
            lillyEssentialDignities(pair.returning, cusp).domicile ? [index + 1] : []) }
        : undefined;
      const returningEssential = lillyEssentialDignities(pair.returning, returning.longitude, local?.sect);
      const natalTargetEssential = lillyEssentialDignities(pair.target, natal.longitude, natalSect);
      // Book III p.736 names agreement of the ascendants and a dignified
      // ruler, then separately cautions against a ruler combust on the return.
      const returnAscendantDomicileProfile = (pair.returning === 'Venus' || pair.returning === 'Moon')
        && local?.commonRisingRuler === pair.returning
        && [item.returnAt - rootTolerance, item.returnAt, item.returnAt + rootTolerance].every(at => {
          const ruler = read(pair.returning, at);
          return lillyEssentialDignities(pair.returning, ruler.longitude, local.sect).domicile
            && lillySolarCondition(ruler, read('Sun', at)).condition === 'free_of_beams';
        }) ? lillyReturnPolicy.ascendantDomicile : undefined;
      const returningConditions = lillyPlanetConditions(pair.returning, returnEpoch, returnHouse,
        contact.radicalPlaceCandidate && (pair.returning === 'Saturn' || pair.returning === 'Venus') ? { at: item.returnAt, read } : undefined, local?.sect);
      const returningP115 = pair.returning === 'Saturn' || pair.returning === 'Venus'
        ? lillyP115Points(returningEssential, returningConditions, returningNodes, returningFixedStars) : undefined;
      const scoreVenusFortitude = (house: number | undefined, useWorkedEighthHouse = false) => {
        if (!local || house === undefined || pair.returning !== 'Venus' || radicalPlaceMinuteState !== 'same_printed_minute'
          || returnHorizonContrast !== 'different-configuration') return;
        const scores = [item.returnAt, item.returnAt - rootTolerance, item.returnAt + rootTolerance].map(at => {
          const eighthHouseWitness = useWorkedEighthHouse ? {
            marsLongitude: read('Mars', at).longitude, saturnLongitude: read('Saturn', at).longitude,
          } : undefined;
          if (at === item.returnAt && house === returnHouse && returningP115) {
            return lillyVenusFortitudeAtReturn(returningEssential, returningConditions, returningP115, eighthHouseWitness);
          }
          const essential = lillyEssentialDignities('Venus', read('Venus', at).longitude, local.sect);
          const conditions = lillyPlanetConditions('Venus', epochPositions(at), house, undefined, local.sect);
          const score = lillyP115Points(essential, conditions, lillyLunarNodes(at), lillyFixedStarPositions(at));
          return lillyVenusFortitudeAtReturn(essential, conditions, score, eighthHouseWitness);
        });
        const [center, before, after] = scores;
        if (!center || !before || !after) return;
        return { lowerNet: Math.min(center.lowerNet, before.lowerNet, after.lowerNet),
          atLeastWorkedExample: center.atLeastWorkedExample && before.atLeastWorkedExample && after.atLeastWorkedExample };
      };
      const venusFortitude = local?.venusRetainsActualHouse ? scoreVenusFortitude(returnHouse) : undefined;
      const venusCuspVirtue = pair.returning === 'Venus' ? local?.venusCuspVirtue : undefined;
      const cuspVenusFortitude = venusCuspVirtue && scoreVenusFortitude(venusCuspVirtue.cuspHouse);
      const venusSolarCondition = returningConditions.solar.condition;
      const returnVenusFortitude = venusSolarCondition === 'free_of_beams' ? venusFortitude : undefined;
      const stableCazimi = venusSolarCondition === 'cazimi'
        && [item.returnAt - rootTolerance, item.returnAt + rootTolerance].every(at =>
          lillySolarCondition(read('Venus', at), read('Sun', at)).condition === 'cazimi');
      const returnVenusCazimiFortitude = stableCazimi ? venusFortitude : undefined;
      const eighthFortitude = returnHouse === 8 && local?.venusRetainsActualHouse && stableCazimi
        ? scoreVenusFortitude(returnHouse, true) : undefined;
      const returnVenusEighthFortitude = eighthFortitude && {
        ...eighthFortitude, bookThreeHousePenalty: -4, bodyBesiegement: 'both-malefics-on-one-side',
      } as const;
      const returnVenusCuspFortitude = venusSolarCondition === 'free_of_beams' || stableCazimi ? cuspVenusFortitude : undefined;
      const natalTargetConditions = lillyPlanetConditions(pair.target, natalEpoch, natalTargetHouse,
        contact.radicalPlaceCandidate && pair.target === 'Moon' ? { at: birth.birthAt, read } : undefined, natalSect);
      const natalTargetP115 = pair.target === 'Moon'
        ? lillyP115Points(natalTargetEssential, natalTargetConditions, natalNodes, natalFixedStars) : undefined;
      const natalMoonScoring = pair.target === 'Moon' && houses?.status === 'ready'
        ? lillyScoringHouse(natal.longitude, houses.cusps) : undefined;
      const natalMoonRetainsActualHouse = natalMoonScoring !== undefined && natalMoonScoring.house === natalTargetHouse;
      const natalMoonP745Balance = natalTargetP115 && natalTargetHouse !== undefined
        ? lillyP745NatalMoonBalance(natalTargetP115, natalTargetHouse) : undefined;
      const natalMoonDebility = radicalPlaceMinuteState === 'same_printed_minute'
        && natalTargetP115 && natalMoonRetainsActualHouse
        ? lillyNatalMoonDebility(natalTargetConditions, natalTargetP115) : undefined;
      const natalMoonWorkedDebility = radicalPlaceMinuteState === 'same_printed_minute'
        && natalTargetP115 && natalMoonRetainsActualHouse
        ? lillyNatalMoonWorkedDebility(natalTargetConditions, natalTargetP115) : undefined;
      const natalMoonCuspVirtue = natalMoonScoring?.approach;
      const natalMoonCuspConditions = natalMoonCuspVirtue && radicalPlaceMinuteState === 'same_printed_minute'
        ? lillyPlanetConditions('Moon', natalEpoch, natalMoonCuspVirtue.cuspHouse, undefined, natalSect) : undefined;
      const natalMoonCuspPoints = natalMoonCuspConditions
        ? lillyP115Points(natalTargetEssential, natalMoonCuspConditions, natalNodes, natalFixedStars) : undefined;
      const natalMoonCuspDebility = natalMoonCuspConditions && natalMoonCuspPoints
        ? lillyNatalMoonWorkedDebility(natalMoonCuspConditions, natalMoonCuspPoints) : undefined;
      const natalMoonCuspFortitude = natalMoonCuspConditions && natalMoonCuspPoints
        ? lillyNatalMoonWorkedFortitude(natalMoonCuspConditions, natalMoonCuspPoints) : undefined;
      // Book III p.736 names the Moon's own house, particularly by night. Use
      // actual angular placement and reject the checked contrary configurations.
      const natalMoonHasNocturnalSupport = natalSect && natalMoonScoring
        ? natalSect === 'night' && natalMoonRetainsActualHouse
          && natalPlanetHorizon?.some(row => row.body === 'Moon' && row.side === 'above') === true
          && natalTargetConditions.moonLight === 'increasing' && natalTargetConditions.solar.condition === 'free_of_beams'
          && !natalTargetConditions.contacts.some(row => ['square', 'opposition'].includes(row.aspectType)
            || row.aspectType === 'conjunction' && ['Mars', 'Saturn'].includes(row.otherBody)) : undefined;
      const natalMoonNocturnalDomicileFortitude = natalMoonHasNocturnalSupport === undefined ? undefined
        : natalMoonHasNocturnalSupport && natalTargetEssential.domicile && natalTargetConditions.houseKind === 'angular';
      const natalMoonWorkedFortitude = radicalPlaceMinuteState === 'same_printed_minute' && natalMoonNocturnalDomicileFortitude === false
        && natalTargetP115 && natalMoonRetainsActualHouse
        ? lillyNatalMoonWorkedFortitude(natalTargetConditions, natalTargetP115) : undefined;
      // Book III p.736 names the Moon's domicile and other essential dignities
      // by night. Outside the angular domicile route, also verify a benefic application.
      const natalMoonEssentialDignities = [
        ...(natalTargetEssential.exalted ? ['exaltation'] : []),
        ...(natalTargetEssential.inTriplicity ? ['triplicity'] : []),
        ...(natalTargetEssential.inOwnTerm ? ['term'] : []),
        ...(natalTargetEssential.inOwnFace ? ['face'] : []),
      ];
      const natalMoonNonAngularDomicile = natalTargetEssential.domicile
        && (natalTargetConditions.houseKind === 'succedent' || natalTargetConditions.houseKind === 'cadent');
      const natalMoonOtherDignities = !natalTargetEssential.domicile && !natalTargetEssential.detriment && !natalTargetEssential.fall
        && natalMoonEssentialDignities.length > 0 && natalMoonWorkedFortitude?.atLeastWorkedExample !== true;
      const natalMoonSupportContact = radicalPlaceMinuteState === 'same_printed_minute'
        && natalMoonHasNocturnalSupport === true && natalTargetP115
        && (natalMoonNonAngularDomicile || natalMoonOtherDignities)
        && natalTargetP115.fixedStarContacts?.find(row => row.star === 'Algol')?.points === 0
        ? natalTargetConditions.contacts.find(row => ['Jupiter', 'Venus'].includes(row.otherBody)
          && ['conjunction', 'sextile', 'trine'].includes(row.aspectType)
          && row.orbAgreement === 'both_columns' && row.application?.status === 'exact'
          && !row.application.lossOfApproachAt && !row.application.applyingRetrogradeStation
          && !row.interpositions?.length) : undefined;
      const natalMoonNocturnalWitness = natalMoonSupportContact && {
        supporter: natalMoonSupportContact.otherBody, aspect: natalMoonSupportContact.aspectType,
        exactAt: natalMoonSupportContact.application?.eventAt,
      };
      const natalMoonNocturnalEssentialWitness = natalMoonOtherDignities && natalMoonNocturnalWitness
        ? { ...natalMoonNocturnalWitness, dignities: natalMoonEssentialDignities } : undefined;
      const natalMoonNocturnalNonAngularDomicileWitness = natalMoonNonAngularDomicile ? natalMoonNocturnalWitness : undefined;
      // The mixed disposition in the p.786 return has two different dignities.
      // Keep it separate from the points for reciprocal domicile or exaltation.
      const saturnMoonDispositionAtReturn = pair.returning === 'Saturn'
        ? [item.returnAt - rootTolerance, item.returnAt, item.returnAt + rootTolerance].every(at => {
          const saturn = read('Saturn', at), moon = read('Moon', at);
          return Math.floor(saturn.longitude / 30) === Math.floor(natal.longitude / 30)
            && lillyEssentialDignities('Saturn', moon.longitude).domicile
            && lillyEssentialDignities('Moon', saturn.longitude).exalted;
        }) : undefined;
      const saturnMidheavenState = local && pair.returning === 'Saturn'
        ? returnHouse === 10 ? 'tenth-house' : returnHouse === undefined ? 'house-boundary' : 'other-house'
        : undefined;
      // p.786 treats the same sign as a Saturn return example. Keep the
      // confirmed p.738 branch to a close return with strong same-chart aid.
      // A stable approach to a cusp can establish the general placement.
      // The named midheaven reading still requires the tenth-house seat itself.
      const saturnCuspVirtue = pair.returning === 'Saturn' ? local?.saturnCuspVirtue : undefined;
      const saturnHouseVerified = local && returnHouse !== undefined && (local.saturnRetainsActualHouse
        || returnHouse !== 10 && saturnCuspVirtue !== undefined);
      const hasSaturnReturnBasis = pair.returning === 'Saturn' && contact.sameSign && contact.placeComparison === 'both_columns'
        && returnHorizonContrast === 'different-configuration' && saturnHouseVerified;
      const stableSaturnSupport = (otherBody: ClassicalPlanet, aspect: string, applying: boolean) => local && hasSaturnReturnBasis
        && [item.returnAt - rootTolerance, item.returnAt, item.returnAt + rootTolerance].every(at => {
          const stamp = epochPositions(at);
          const saturn = stamp.find(p => p.body === 'Saturn')!;
          const planet = stamp.find(p => p.body === otherBody)!;
          const radical = lillyRadicalPlaceContact('Saturn', saturn.longitude, 'Saturn', natal.longitude);
          const essential = lillyEssentialDignities('Saturn', saturn.longitude, local.sect);
          const conditions = lillyPlanetConditions('Saturn', stamp, returnHouse);
          const strongDignity = essential.domicile || essential.exalted
            || conditions.receptions.some(row => row.mutualHouse || row.mutualExaltation);
          return radical.sameSign && radical.placeComparison === 'both_columns'
            && strongDignity && !essential.detriment && !essential.fall
            && conditions.motion === 'direct' && conditions.solar.condition === 'free_of_beams'
            && (!applying || aspect !== 'sextile' || conditions.magnitudeComparedToMean === 'faster')
            && !conditions.contacts.some(row => row.otherBody === 'Mars' && ['conjunction', 'square', 'opposition'].includes(row.aspectType))
            && conditions.contacts.some(row => row.otherBody === otherBody && row.aspectType === aspect && row.signAspectMatches
              && (applying ? row.sameDegreeOfSign && row.phase === 'closing' && planet.speed > saturn.speed
                : lillyPrintedLongitudeMinute(saturn.longitude % 30) === lillyPrintedLongitudeMinute(planet.longitude % 30)));
        });
      const saturnSupport = hasSaturnReturnBasis ? returningP115?.partileContacts.find(other =>
        other.points > 0 && stableSaturnSupport(other.body, other.aspect, false)) : undefined;
      // Book I pp.102 and 124 include a benefic sextile alongside the trine.
      // Use the verified in-sign perfection and retain the established priority.
      const saturnApplyingContacts = hasSaturnReturnBasis && saturnMidheavenState === 'tenth-house' && !saturnSupport
        ? returningConditions.contacts.filter(row => ['Jupiter', 'Venus'].includes(row.otherBody)
          && ['conjunction', 'trine', 'sextile'].includes(row.aspectType)
          && row.application?.status === 'exact' && !row.application.lossOfApproachAt && !row.application.applyingRetrogradeStation
          && !row.interpositions?.length && stableSaturnSupport(row.otherBody, row.aspectType, true)) : [];
      const saturnApplyingContact = saturnApplyingContacts.find(row => row.aspectType === 'conjunction')
        ?? saturnApplyingContacts.find(row => row.aspectType === 'trine')
        ?? saturnApplyingContacts.find(row => row.aspectType === 'sextile');
      const saturnApplyingReturnWitness = saturnApplyingContact && {
        supporter: saturnApplyingContact.otherBody, aspect: saturnApplyingContact.aspectType,
        separation: saturnApplyingContact.separation, exactAt: saturnApplyingContact.application?.eventAt,
      };
      return { start: item.start, end: item.end, profile: lillyReturnPolicy.profile, pair: pair.pair,
        birthAt: birth.birthAt, returnAt: item.returnAt, returnEnd: item.returnEnd, zodiac: 'tropical',
        returnEpochBasis: lillyReturnPolicy.exactEpochBasis,
        returnBody: pair.returning, natalTargetId: pair.target, returningLongitude: returning.longitude, natalLongitude: natal.longitude,
        ...contact, radicalPlaceMinuteState,
        radicalPlaceMinuteMatch: radicalPlaceMinuteState === 'minute_boundary' ? undefined : radicalPlaceMinuteState === 'same_printed_minute',
        sourceOrbStatus: 'unresolved', natalSect, natalSunAltitude: altitude,
        natalHouseSystem: houses?.status === 'ready' ? 'regiomontanus' : undefined,
        natalTargetHouse,
        returnDirection: returning.direction, returnSpeed: returning.speed,
        returningEssential, natalTargetEssential, returningConditions, natalTargetConditions,
        returningP115, returnVenusFortitude, returnVenusAtLeastWorkedFortitude: returnVenusFortitude?.atLeastWorkedExample,
        returnVenusCazimiFortitude, returnVenusAtLeastCazimiFortitude: returnVenusCazimiFortitude?.atLeastWorkedExample,
        returnVenusEighthFortitude, returnVenusAtLeastWorkedEighthFortitude: returnVenusEighthFortitude?.atLeastWorkedExample,
        venusCuspVirtue, returnVenusCuspFortitude, returnVenusAtLeastCuspFortitude: returnVenusCuspFortitude?.atLeastWorkedExample,
        returnVenusCuspHouse: venusCuspVirtue?.cuspHouse,
        natalTargetP115, natalMoonP745Balance, natalMoonDebility, natalMoonWeakInBothTables: natalMoonDebility?.weakInBoth,
        natalMoonWorkedDebility, natalMoonAtMostWorkedDebility: natalMoonWorkedDebility?.atMostWorkedExample,
        natalMoonCuspVirtue, natalMoonCuspHouse: natalMoonCuspVirtue?.cuspHouse,
        natalMoonCuspDebility, natalMoonAtMostCuspDebility: natalMoonCuspDebility?.atMostWorkedExample,
        natalMoonCuspFortitude, natalMoonAtLeastCuspFortitude: natalMoonCuspFortitude?.atLeastWorkedExample,
        natalMoonNocturnalDomicileFortitude,
        natalMoonNocturnalNonAngularDomicileSupport: Boolean(natalMoonNocturnalNonAngularDomicileWitness),
        natalMoonNocturnalNonAngularDomicileWitness,
        natalMoonNocturnalEssentialSupport: Boolean(natalMoonNocturnalEssentialWitness), natalMoonNocturnalEssentialWitness,
        natalMoonWorkedFortitude,
        natalMoonAtLeastWorkedFortitude: natalMoonWorkedFortitude?.atLeastWorkedExample, saturnMoonDispositionAtReturn,
        returnSect: local?.sect ?? 'unavailable', returnAngles: local ? 'regiomontanus_verified' : 'unavailable',
        returnLocation: local ? 'provided' : 'unprovided', returnLocalFrame: local ? lillyReturnPolicy.localFrame : undefined,
        returnHorizonContrast, natalPlanetHorizon, returnPlanetHorizon,
        returnHouse, returnSignification, returnMoonRadicalSixthInTwelfth,
        returnFortuneProfile: local?.returnFortune?.profile, returnFortuneHouse: local?.returnFortune?.house, returnAscendantDomicileProfile,
        returnAscendantHardAspect: local?.returnAscendantHardAspect, returnAscendantNatalHouse: local?.returnAscendantNatalHouse,
        returnRisingSignMatchesNatalCuspHouse: pair.returning !== 'Jupiter' ? local?.returnRisingSignMatchesNatalCuspHouse : undefined,
        saturnMidheavenState, saturnCuspVirtue, saturnSupportedReturnContact: saturnSupport,
        saturnSupportedReturn: saturnSupport !== undefined ? true : undefined,
        saturnApplyingReturnSupport: saturnApplyingReturnWitness?.aspect === 'conjunction',
        saturnApplyingReturnTrineSupport: saturnApplyingReturnWitness?.aspect === 'trine',
        saturnApplyingReturnSextileSupport: saturnApplyingReturnWitness?.aspect === 'sextile', saturnApplyingReturnWitness,
        saturnMidheavenApproachStatus: pair.returning === 'Saturn' ? local?.saturnMidheavenApproachStatus : undefined,
        saturnMidheavenDistanceRange: pair.returning === 'Saturn' ? local?.saturnMidheavenDistanceRange : undefined,
        judgement: 'unresolved-coincidence-well-affected-and-radical-fortune' };
    });
  });
  return { status: 'ready', policy: lillyReturnPolicy, contexts } as const;
}
