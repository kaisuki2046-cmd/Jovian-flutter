import { e_tilt, MakeTime, SiderealTime } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import { progressionEpoch, progressionPolicy, readProgressionBirth, readProgressionPosition } from './western-progressions';
import { readTransitLongitude, westernSearchPolicy, type Planet } from './solar-transits';

const rad = Math.PI / 180, day = 86_400_000;
const normalize = (value: number) => (value % 360 + 360) % 360;
const arc = (value: number) => normalize(value + 180) - 180;
export const westernHousePolicy = {
  version: 'fortune-source-houses-v2', zodiac: 'tropical',
  mcTenthProfile: 'leo-mc-tenth-linked-v1',
  sepharialHouseProfile: 'sepharial-1918-london-table-v1',
  sepharialLunationTolerance: 0.00002,
  natalFrame: 'invert-compatible-natal-asc-mc-with-true-obliquity',
  progressedAngles: 'fixed-birth-clock-daily-sidereal-increment-interpolated-between-anniversaries',
  leoHouseSystem: 'placidus', lillyHouseSystem: 'regiomontanus',
  angleResidualTolerance: 1e-7, latitudeDegeneracyTolerance: 1e-8,
  cuspToleranceDegrees: 1e-9, rootToleranceMs: 1_000,
} as const;
export type HouseSystem = 'placidus' | 'regiomontanus';

export function eclipticEquator(longitude: number, obliquity: number) {
  const lambda = longitude * rad, epsilon = obliquity * rad;
  return { rightAscension: normalize(Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)) / rad),
    declination: Math.asin(Math.sin(lambda) * Math.sin(epsilon)) / rad };
}

export function anglesFromFrame(armc: number, latitude: number, obliquity: number) {
  if (![armc, latitude, obliquity].every(Number.isFinite) || Math.abs(latitude) >= 90 || obliquity <= 0 || obliquity >= 30) {
    throw new RangeError('Invalid house frame');
  }
  const theta = armc * rad, phi = latitude * rad, epsilon = obliquity * rad;
  return {
    ascendant: normalize(Math.atan2(Math.cos(theta), -Math.sin(theta) * Math.cos(epsilon) - Math.tan(phi) * Math.sin(epsilon)) / rad),
    midheaven: normalize(Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) / rad),
  };
}

// The compatible snapshot already records ASC and MC. Recover their geometric
// frame, not an asserted address or an invented birthplace. At an equatorial
// intersection the latitude is not identifiable; do not guess zero latitude.
export function frameFromAngles(ascendant: number, midheaven: number, obliquity: number) {
  if (![ascendant, midheaven, obliquity].every(Number.isFinite) || ascendant < 0 || ascendant >= 360
    || midheaven < 0 || midheaven >= 360 || obliquity <= 0 || obliquity >= 30) return { status: 'invalid_angles' } as const;
  const armc = eclipticEquator(midheaven, obliquity).rightAscension;
  const asc = eclipticEquator(ascendant, obliquity);
  if (Math.abs(Math.sin(asc.declination * rad)) < westernHousePolicy.latitudeDegeneracyTolerance) {
    return { status: 'indeterminate_latitude' } as const;
  }
  const latitude = Math.atan(-Math.cos((asc.rightAscension - armc) * rad) / Math.tan(asc.declination * rad)) / rad;
  const rebuilt = anglesFromFrame(armc, latitude, obliquity);
  if (Math.abs(arc(rebuilt.ascendant - ascendant)) > westernHousePolicy.angleResidualTolerance
    || Math.abs(arc(rebuilt.midheaven - midheaven)) > westernHousePolicy.angleResidualTolerance) {
    return { status: 'inconsistent_angles' } as const;
  }
  return { status: 'ready', armc, latitude, obliquity } as const;
}

function rootAngle(low: number, high: number, read: (angle: number) => number) {
  const left = read(low), right = read(high);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left > 1e-7 || right < -1e-7) throw new RangeError('Unbracketed house cusp');
  for (let i = 0; i < 80 && high - low > westernHousePolicy.cuspToleranceDegrees; i++) {
    const mid = (low + high) / 2;
    if (read(mid) > 0) high = mid; else low = mid;
  }
  return normalize((low + high) / 2);
}

export function calculateHouseCusps(armc: number, latitude: number, obliquity: number, system: HouseSystem) {
  const angles = anglesFromFrame(armc, latitude, obliquity);
  if (!['placidus', 'regiomontanus'].includes(system)) throw new RangeError('Unsupported house system');
  if (system === 'placidus' && Math.abs(latitude) >= 90 - obliquity - 1e-8) return { status: 'circumpolar_unavailable', system } as const;
  const cusps = Array(12).fill(0) as number[];
  cusps[0] = angles.ascendant; cusps[9] = angles.midheaven;
  if (system === 'regiomontanus') {
    // Great circles through the horizon's north point and twelve equal
    // equatorial divisions. Intersect each with the ecliptic, choosing the
    // same orientation as the reference equatorial point.
    for (let house = 1; house <= 12; house++) {
      const distance = (house - 10) * 30 * rad, q = armc * rad + distance;
      cusps[house - 1] = normalize(Math.atan2(Math.sin(q), Math.cos(q) * Math.cos(obliquity * rad)
        - Math.tan(latitude * rad) * Math.sin(distance) * Math.sin(obliquity * rad)) / rad);
    }
  } else {
    // Placidus: divide the rising-to-meridian diurnal semi-arc into thirds.
    // The western semi-arc gives VIII/IX; their antipodes give II/III.
    const semiArc = (lambda: number) => {
      const delta = eclipticEquator(lambda, obliquity).declination * rad;
      return Math.acos(-Math.tan(latitude * rad) * Math.tan(delta)) / rad;
    };
    const mc = angles.midheaven, asc = mc + normalize(angles.ascendant - mc);
    const desc = mc - normalize(mc - normalize(angles.ascendant + 180));
    const east = (fraction: number) => rootAngle(mc, asc,
      lambda => arc(eclipticEquator(lambda, obliquity).rightAscension - armc) - fraction * semiArc(lambda));
    const west = (fraction: number) => rootAngle(desc, mc,
      lambda => arc(eclipticEquator(lambda, obliquity).rightAscension - armc) + fraction * semiArc(lambda));
    cusps[10] = east(1 / 3); cusps[11] = east(2 / 3);
    cusps[1] = normalize(west(2 / 3) + 180); cusps[2] = normalize(west(1 / 3) + 180);
    for (const index of [0, 1, 2, 9, 10, 11]) cusps[(index + 6) % 12] = normalize(cusps[index] + 180);
  }
  const widths = cusps.map((cusp, i) => normalize(cusps[(i + 1) % 12] - cusp));
  if (widths.some(width => width < 1e-7 || width >= 180) || Math.abs(widths.reduce((a, b) => a + b, 0) - 360) > 1e-6) {
    return { status: 'invalid_house_order', system } as const;
  }
  return { status: 'ready', system, cusps, ...angles } as const;
}

export function zodiacalHouse(longitude: number, cusps: number[]) {
  if (!Number.isFinite(longitude) || cusps.length !== 12) throw new RangeError('Invalid house position');
  const index = cusps.findIndex((cusp, i) => normalize(longitude - cusp) < normalize(cusps[(i + 1) % 12] - cusp));
  if (index < 0) throw new RangeError('No house position');
  return index + 1;
}

export function readWesternHouseFrame(chart?: DestinyChartSnapshot) {
  const birth = readProgressionBirth(chart);
  if (birth.status !== 'ready') return birth;
  const natal = chart!.western.rawResult[0];
  const obliquity = e_tilt(MakeTime(new Date(birth.birthAt))).tobl;
  const frame = frameFromAngles(natal.ascendant, natal.midheaven, obliquity);
  if (frame.status !== 'ready') return frame;
  return { ...frame, birthAt: birth.birthAt, geometrySource: westernHousePolicy.natalFrame } as const;
}

export function progressedHouseFrame(birthAt: number, realAt: number, natalArmc: number, latitude: number) {
  const symbolicDays = (progressionEpoch(birthAt, realAt) - birthAt) / day;
  const whole = Math.floor(symbolicDays), fraction = symbolicDays - whole;
  const first = birthAt + whole * day, second = first + day;
  const start = SiderealTime(new Date(first)) * 15, increment = normalize(SiderealTime(new Date(second)) * 15 - start);
  if (increment < 0.8 || increment > 1.2) throw new RangeError('Invalid annual sidereal increment');
  const armc = normalize(natalArmc + arc(start - SiderealTime(new Date(birthAt)) * 15) + fraction * increment);
  const epsilonStart = e_tilt(MakeTime(new Date(first))).tobl, epsilonEnd = e_tilt(MakeTime(new Date(second))).tobl;
  const obliquity = epsilonStart + fraction * (epsilonEnd - epsilonStart);
  return { armc, latitude, obliquity, ...anglesFromFrame(armc, latitude, obliquity) };
}

// Split at each actual cusp crossing. Caller supplies stations for direct /
// retrograde motion. Roots at the query end belong only to the next window.
export function scanCircularRegions(window: { start: number; end: number }, read: (at: number) => number,
  boundaries: number[], stepMs: number, stations: number[] = []) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.end <= window.start
    || window.end - window.start > 368 * day || !Number.isFinite(stepMs) || stepMs <= 0
    || !boundaries.length || boundaries.some(value => !Number.isFinite(value))) throw new RangeError('Invalid cusp scan');
  const points = new Set([window.start, window.end, ...stations.filter(at => window.start < at && at < window.end)]);
  for (let at = window.start + stepMs; at < window.end; at += stepMs) points.add(at);
  const knots = [...points].sort((a, b) => a - b), crossings: { at: number; boundaryIndex: number; direction: 'direct' | 'retrograde' }[] = [];
  for (let i = 1; i < knots.length; i++) {
    const from = knots[i - 1], to = knots[i], origin = read(from), movement = arc(read(to) - origin);
    if (Math.abs(movement) < 1e-12) continue;
    for (const [boundaryIndex, boundary] of boundaries.entries()) {
      const distance = movement > 0 ? normalize(boundary - origin) : -normalize(origin - boundary);
      if ((movement > 0 && distance > movement + 1e-9) || (movement < 0 && distance < movement - 1e-9)) continue;
      let low = from, high = to;
      if (Math.abs(distance) > 1e-9) while (high - low > westernHousePolicy.rootToleranceMs) {
        const mid = Math.floor((low + high) / 2), progress = arc(read(mid) - origin);
        if (movement > 0 ? progress < distance : progress > distance) low = mid; else high = mid;
      }
      const at = Math.abs(distance) <= 1e-9 ? from : high;
      if (at < window.end && !crossings.some(hit => hit.boundaryIndex === boundaryIndex && Math.abs(hit.at - at) <= 1_000)) {
        crossings.push({ at, boundaryIndex, direction: movement > 0 ? 'direct' : 'retrograde' });
      }
    }
  }
  crossings.sort((a, b) => a.at - b.at);
  const actualCrossings = crossings.filter(hit => {
    // A station exactly on a cusp is a touch, not a change of house. Use the
    // adjoining monotone segments, including nearby stations, rather than a
    // fixed large buffer that could swallow a short double crossing.
    const left = knots.findLast(at => at < hit.at) ?? hit.at - 60_000;
    const right = knots.find(at => at > hit.at) ?? hit.at + 60_000;
    const boundary = boundaries[hit.boundaryIndex];
    return arc(read((left + hit.at) / 2) - boundary) * arc(read((right + hit.at) / 2) - boundary) < 0;
  });
  const cuts = [...new Set([window.start, window.end, ...actualCrossings.map(hit => hit.at)])].sort((a, b) => a - b);
  return { crossings: actualCrossings, touches: crossings.filter(hit => !actualCrossings.includes(hit)),
    intervals: cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1];
      // The midpoint can itself be an exact station touching a cusp from the
      // other side. Do not let that isolated point label the entire interval.
      let longitude = read(start + (end - start) / 2);
      if (boundaries.some(boundary => Math.abs(arc(longitude - boundary)) <= 1e-9)) {
        for (const fraction of [0.25, 0.75]) {
          const candidate = read(start + (end - start) * fraction);
          if (boundaries.every(boundary => Math.abs(arc(candidate - boundary)) > 1e-9)) { longitude = candidate; break; }
        }
      }
      return { start, end, longitude };
    }) };
}

export function scanProgressedMoonHouses(window: { start: number; end: number }, birthAt: number, cusps: number[]) {
  const scan = scanCircularRegions(window, at => readProgressionPosition('Moon', progressionEpoch(birthAt, at), birthAt).longitude,
    cusps, 2 * day);
  const entries = new Set(scan.crossings.filter(hit => hit.boundaryIndex === 0 && hit.direction === 'direct').map(hit => hit.at));
  return scan.intervals.map(interval => {
    const house = zodiacalHouse(interval.longitude, cusps);
    return { ...interval, house, enteredThroughAscendant: house === 1 && entries.has(interval.start) };
  });
}

// Bind an MC crossing only to its adjoining tenth-house interval. A crossing
// elsewhere in the year, or a stay already in progress, cannot stand in for it.
// Keep both directions: retrograde MC is leaving X, never a fresh entry to X.
export function linkMcTenthIntervals(window: { start: number; end: number }, cusps: number[], scan: ReturnType<typeof scanCircularRegions>) {
  if (cusps.length !== 12 || !cusps.every(Number.isFinite) || !(window.start < window.end)) throw new RangeError('Invalid MC/tenth context');
  const common = { profile: westernHousePolicy.mcTenthProfile, mcLongitude: cusps[9],
    natalHouse: 10, houseSystem: 'placidus', zodiac: 'tropical' } as const;
  const intervals = scan.intervals.filter(interval => zodiacalHouse(interval.longitude, cusps) === 10);
  if (!intervals.length) return [{ ...window, ...common, inTenth: false, linkedMcInWindow: false,
    mcContacts: [] as { at: number; motion: 'direct' | 'retrograde' | 'stationary'; role: 'entering' | 'leaving' | 'touching' }[], clippedStart: true, clippedEnd: true }];
  return intervals.map(interval => {
    const mcContacts = [...scan.crossings.filter(hit => hit.boundaryIndex === 9 && window.start <= hit.at && hit.at < window.end
      && (hit.at === interval.start || hit.at === interval.end)).map(hit => ({ at: hit.at, motion: hit.direction,
        role: hit.at === interval.start ? 'entering' as const : 'leaving' as const })),
      ...scan.touches.filter(hit => hit.boundaryIndex === 9 && interval.start <= hit.at && hit.at < interval.end)
        .map(hit => ({ at: hit.at, motion: 'stationary' as const, role: 'touching' as const }))].sort((a, b) => a.at - b.at);
    return { start: interval.start, end: interval.end, ...common, inTenth: true, linkedMcInWindow: mcContacts.length > 0, mcContacts,
      clippedStart: interval.start === window.start && !scan.crossings.some(hit => hit.at === interval.start),
      clippedEnd: interval.end === window.end };
  });
}

export function buildWesternSourceHouses(window: { start: number; end: number }, chart: DestinyChartSnapshot | undefined,
  motion: { planet: Planet; stations: { at: number }[] }[]) {
  const frame = readWesternHouseFrame(chart);
  if (frame.status !== 'ready') return { ...frame, policy: westernHousePolicy } as const;
  if (window.start <= frame.birthAt + 60_000) return { status: 'before_birth', policy: westernHousePolicy } as const;
  const placidus = calculateHouseCusps(frame.armc, frame.latitude, frame.obliquity, 'placidus');
  const regio = calculateHouseCusps(frame.armc, frame.latitude, frame.obliquity, 'regiomontanus');
  const ascendant = placidus.status !== 'ready' ? [] : scanCircularRegions(window, at => progressedHouseFrame(frame.birthAt, at, frame.armc, frame.latitude).ascendant,
    Array.from({ length: 36 }, (_, i) => i * 10), 2 * day).intervals.map(item => ({ ...item,
      sign: Math.floor(normalize(item.longitude) / 30), decan: Math.floor(normalize(item.longitude) % 30 / 10) + 1 }));
  const moon = placidus.status !== 'ready' ? [] : scanProgressedMoonHouses(window, frame.birthAt, placidus.cusps)
    .map(({ house, ...interval }) => ({ ...interval, body: 'Moon', natalHouse: house }));
  const transits = (['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const).map(body => {
    const cache = new Map<number, number>();
    const read = (at: number) => {
      if (!cache.has(at)) cache.set(at, readTransitLongitude(body, at));
      return cache.get(at)!;
    };
    const stations = motion.find(item => item.planet === body)?.stations.map(item => item.at) ?? [];
    const scan = placidus.status === 'ready'
      ? scanCircularRegions(window, read, placidus.cusps, westernSearchPolicy.sampleHours[body] * day / 24, stations) : { intervals: [], crossings: [], touches: [] };
    const regioHits = regio.status === 'ready' && ['Jupiter', 'Venus'].includes(body)
      ? scanCircularRegions(window, read, [regio.cusps[1]], westernSearchPolicy.sampleHours[body] * day / 24, stations).crossings : [];
    const placidusIntervals = placidus.status === 'ready'
      ? scan.intervals.map(item => ({ ...item, natalHouse: zodiacalHouse(item.longitude, placidus.cusps) })) : [];
    const sepharialSecondHouse = body === 'Saturn' && placidus.status === 'ready'
      ? placidusIntervals.filter(interval => interval.natalHouse === 2).map(({ start, end }) => {
        const entry = scan.crossings.find(hit => hit.at === start);
        const exit = scan.crossings.find(hit => hit.at === end);
        return { start, end, secondCuspLongitude: placidus.cusps[1],
          enteredThroughSecondCusp: entry?.boundaryIndex === 1 && entry.direction === 'direct',
          entryMotion: entry?.direction, entryCusp: entry && entry.boundaryIndex + 1,
          exitMotion: exit?.direction, exitCusp: exit && exit.boundaryIndex + 1 };
      }) : [];
    return { body, placidusIntervals, regioSecondCusp: regioHits, sepharialSecondHouse,
      leoMcTenth: body === 'Saturn' && placidus.status === 'ready' ? linkMcTenthIntervals(window, placidus.cusps, scan) : [] };
  });
  return { status: placidus.status === 'ready' && regio.status === 'ready' ? 'ready' : 'partial', frame, placidus, regio, ascendant, moon, transits,
    policy: westernHousePolicy, progressionPolicy: progressionPolicy.version } as const;
}
