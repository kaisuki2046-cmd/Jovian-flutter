import { Body, Ecliptic, GeoVector, MoonPhase, SunPosition } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';

export const solarTransitVersion = 'fortune-solar-natal-sun-v1';
const planetaryTransitVersion = 'fortune-planetary-same-body-v1';
const engineVersion = '2.1.19';
const dayMs = 86_400_000;
export const planetLabels = {
  Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星',
  Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星',
} as const;
export type Planet = keyof typeof planetLabels;
const planets = Object.keys(planetLabels) as Planet[];
export const slowTransitBodies: ReadonlySet<Planet> = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
export const westernSearchPolicy = {
  sampleHours: { Sun: 24, Moon: 3, Mercury: 6, Venus: 6, Mars: 6,
    Jupiter: 12, Saturn: 12, Uranus: 12, Neptune: 12, Pluto: 12 },
  stationToleranceMs: 1_000, aspectToleranceMs: 1, maxEpisodeLookbackYears: 12,
} as const;
const stepFor = (planet: Planet) => westernSearchPolicy.sampleHours[planet] * dayMs / 24;

function normalize(degrees: number) {
  const remainder = degrees % 360;
  return remainder < 0 ? remainder + 360 : remainder;
}

function signedArc(degrees: number) {
  if (degrees > 180) return degrees - 360;
  if (degrees < -180) return degrees + 360;
  return degrees;
}

const aspects = [
  { angle: 0, label: '合相' }, { angle: 60, label: '六分相' }, { angle: 90, label: '四分相' },
  { angle: 120, label: '三分相' }, { angle: 180, label: '对分相' },
] as const;
type NatalWestern = DestinyChartSnapshot['western'];
type Window = { start: number; end: number };
type LongitudeAt = (at: number) => number;
type TransitDirection = 'direct' | 'retrograde';
type TransitTurn = { at: number; longitude: number; directionAfter: TransitDirection };
export const retrogradeLoopGeometry = { sampleMs: dayMs, velocityProbeMs: 600_000,
  stationToleranceMs: 1_000, crossingToleranceMs: 1, anchorToleranceMs: 2_000, angularTouchTolerance: 1e-7 } as const;
type Event = {
  id: string; at: number; planet: Planet; angle: typeof aspects[number]['angle'];
  label: typeof aspects[number]['label']; natalLongitude: number; transitLongitude: number;
  direction: 'direct' | 'retrograde';
};
type Unavailable = 'missing' | 'unsupported' | 'uncertain' | 'failed';
type BodyResult = { status: 'ready'; planet: Planet; events: Event[] } | { status: Unavailable; planet: Planet };

function natalLongitude(chart: NatalWestern, planet: Planet) {
  const candidates = chart.rawResult;
  const read = (candidate: NatalWestern['rawResult'][number]) =>
    candidate?.positions?.find(item => item.planet === planet)?.longitude;
  const longitude = read(candidates[0]);
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) return null;
  return candidates.every(candidate => read(candidate) === longitude) ? longitude : null;
}

function checkChart(western?: NatalWestern): 'missing' | 'unsupported' | undefined {
  if (!western?.rawResult.length) return 'missing';
  if (western.engineName !== 'astronomy-engine' || western.engineVersion !== engineVersion
    || western.rulesetVersion !== 'tropical-whole-sign-v1') return 'unsupported';
}

function crossing(start: number, end: number, from: number, distance: number, direction: number,
  read: (at: number) => number) {
  if (distance === 0) return start;
  let low = start;
  let high = end;
  while (high - low > westernSearchPolicy.aspectToleranceMs) {
    const middle = Math.floor((low + high) / 2);
    const travelled = signedArc(read(middle) - from) * direction;
    if (travelled < distance) low = middle;
    else high = middle;
  }
  return high;
}

function stationBetween(start: number, end: number, direction: number, read: (at: number) => number) {
  const origin = read(start);
  const progress = (at: number) => signedArc(read(at) - origin) * direction;
  let low = start;
  let high = end;
  while (high - low > westernSearchPolicy.stationToleranceMs) {
    const offset = Math.floor((high - low) / 3);
    if (progress(low + offset) < progress(high - offset)) low += offset;
    else high -= offset;
  }
  return Math.round((low + high) / 2);
}

export function scanRetrogradeLoopStations(window: Window, read: LongitudeAt) {
  const { sampleMs, velocityProbeMs, stationToleranceMs, anchorToleranceMs } = retrogradeLoopGeometry;
  if (![window.start, window.end].every(Number.isSafeInteger) || window.end <= window.start
    || window.end - window.start > 2_000 * dayMs) throw new RangeError('Invalid retrograde loop station window');
  const velocity = (at: number) => signedArc(read(at + velocityProbeMs) - read(at - velocityProbeMs));
  const stations: TransitTurn[] = [];
  for (let left = window.start; left < window.end; left += sampleMs) {
    const right = Math.min(left + sampleMs, window.end), first = velocity(left), last = velocity(right);
    if (![first, last].every(Number.isFinite)) throw new RangeError('Invalid retrograde loop velocity');
    if (first * last > 0 || first === 0 && last === 0) continue;
    let low = left, high = right;
    while (high - low > stationToleranceMs) {
      const middle = Math.floor((low + high) / 2);
      if (Math.sign(velocity(middle)) === Math.sign(first)) low = middle; else high = middle;
    }
    const at = first === 0 ? left : last === 0 ? right : Math.round((low + high) / 2);
    if (at < window.end && !stations.some(row => Math.abs(row.at - at) <= anchorToleranceMs)) stations.push({ at,
      longitude: normalize(read(at)), directionAfter: velocity(at + 60_000) < 0 ? 'retrograde' : 'direct' });
  }
  return stations;
}

export function readRetrogradeLoopPasses(turns: TransitTurn[], target: number, read: LongitudeAt) {
  if (turns.length !== 4 || !Number.isFinite(target) || target < 0 || target >= 360
    || turns.some((row, i) => !Number.isSafeInteger(row.at) || i > 0 && row.at <= turns[i - 1].at
      || row.directionAfter !== (i % 2 ? 'retrograde' : 'direct'))) throw new RangeError('Invalid retrograde loop');
  const passes: { at: number; direction: TransitDirection; phase: string }[] = [];
  const touches: { at: number; direction: string }[] = [];
  const epsilon = retrogradeLoopGeometry.angularTouchTolerance;
  for (let i = 0; i < 3; i++) {
    const first = read(turns[i].at), travel = signedArc(read(turns[i + 1].at) - first), sign = i === 1 ? -1 : 1;
    if (!Number.isFinite(first) || !Number.isFinite(travel) || Math.sign(travel) !== sign) {
      throw new RangeError('Non-monotonic retrograde loop bracket');
    }
    const distance = normalize((target - first) * sign);
    for (const row of [turns[i], turns[i + 1]]) if (Math.abs(signedArc(read(row.at) - target)) <= epsilon
      && !touches.some(touch => touch.at === row.at)) touches.push({ at: row.at, direction: 'stationary' });
    if (distance <= epsilon || distance >= Math.abs(travel) - epsilon) continue;
    passes.push({ at: crossing(turns[i].at, turns[i + 1].at, first, distance, sign, read),
      direction: sign > 0 ? 'direct' : 'retrograde', phase: ['lead_direct', 'retrograde', 'return_direct'][i] });
  }
  return { turns, passes, touches };
}

function createRetrogradeLoopLookup(window: Window, read: LongitudeAt, birthAt: number) {
  // The surrounding samples only seek enclosing station turns, never a transit duration.
  const span = 550 * dayMs;
  let turns: TransitTurn[][] | undefined;
  const loops = new Map<number, ReturnType<typeof readRetrogradeLoopPasses>[]>();
  return (target: number, pass: { at: number; direction: TransitDirection }) => {
    if (!turns) {
      const start = Math.floor(window.start / dayMs) * dayMs - span;
      const end = Math.ceil(window.end / dayMs) * dayMs + span;
      const stations = scanRetrogradeLoopStations({ start, end }, read);
      turns = stations.slice(0, -3).flatMap((row, index) => {
        const cycle = stations.slice(index, index + 4);
        return row.directionAfter === 'direct' && cycle.every((turn, i) => turn.directionAfter === (i % 2 ? 'retrograde' : 'direct'))
          ? [cycle] : [];
      });
    }
    let matches = loops.get(target);
    if (!matches) {
      matches = turns.filter(cycle => cycle[0].at < window.end && window.start < cycle[3].at)
        .map(cycle => readRetrogradeLoopPasses(cycle, target, read)).filter(loop =>
          loop.passes.length === 3 && !loop.touches.length && loop.passes.every(row => row.at >= birthAt));
      loops.set(target, matches);
    }
    const [result, competing] = matches.flatMap(loop => {
      const index = loop.passes.findIndex(row => row.direction === pass.direction
        && Math.abs(row.at - pass.at) <= retrogradeLoopGeometry.anchorToleranceMs);
      return index < 0 ? [] : [{ retrogradeLoopPassIndex: index + 1, retrogradeLoop: { turns: loop.turns, passes: loop.passes } }];
    });
    if (!competing) return result;
  };
}

function validateWindow(window: Window) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end)
    || !(window.end > window.start) || window.end - window.start > 368 * dayMs) {
    throw new RangeError('Invalid transit window');
  }

}

function makeEphemeris(planet: Planet) {
  const cache = new Map<number, { longitude: number; latitude: number; distanceAu: number }>();
  return (at: number) => {
    const cached = cache.get(at);
    if (cached) return cached;
    const date = new Date(at);
    const vector = planet === 'Sun' ? null : GeoVector(Body[planet], date, true);
    const coordinates = vector ? Ecliptic(vector) : SunPosition(date);
    const value = { longitude: coordinates.elon, latitude: coordinates.elat,
      distanceAu: vector ? Math.hypot(vector.x, vector.y, vector.z) : Math.hypot(
        coordinates.vec.x, coordinates.vec.y, coordinates.vec.z,
      ) };
    cache.set(at, value);
    return value;
  };
}

function longitudeTrace(window: Window, step: number, read: (at: number) => number, detectStations: boolean) {
  const edges = new Set([window.start, window.end]);
  for (let at = window.start + step; at < window.end; at += step) edges.add(at);
  const stations: { at: number; direction: number }[] = [];
  // A station can be close to either end of the window. Sample one step beyond each side to bracket it.
  if (detectStations) {
    for (let at = window.start; at < window.end + step; at += step) {
      const before = Math.sign(signedArc(read(at) - read(at - step)));
      const after = Math.sign(signedArc(read(at + step) - read(at)));
      if (!before || !after || before === after) continue;
      const station = stationBetween(at - step, at + step, before, read);
      if (station >= window.start && station < window.end) {
        if (!edges.has(station) || !stations.some(item => item.at === station)) stations.push({ at: station, direction: after });
        edges.add(station);
      }
    }
  }

  const ordered = [...edges].sort((a, b) => a - b);
  const segments = ordered.slice(1).map((end, index) => {
    const start = ordered[index];
    const from = read(start);
    const arc = signedArc(read(end) - from);
    return { start, end, from, arc, direction: Math.sign(arc) };
  });
  function hits(target: number) {
    const found = new Map<number, 'direct' | 'retrograde'>();
    for (const { start, end, from, arc, direction } of segments) {
      const distance = normalize((target - from) * direction);
      if (distance >= Math.abs(arc)) continue;
      const at = crossing(start, end, from, distance, direction, read);
      if (at < window.end) found.set(at, direction > 0 ? 'direct' : 'retrograde');
    }
    return [...found].map(([at, direction]) => ({ at, direction }));
  }
  return { read, step, detectStations, stations, hits };
}

function aspectTargets(longitude: number) {
  return aspects.flatMap(({ angle, label }) => {
    const offsets = angle === 0 || angle === 180 ? [angle] : [angle, -angle];
    return offsets.map(offset => ({ angle, label, offset, target: normalize(longitude + offset) }));
  });
}

function findContacts(window: Window, planet: Planet, longitude: number): Event[] {
  validateWindow(window);
  const ephemeris = makeEphemeris(planet);
  const trace = longitudeTrace(window, stepFor(planet), at => ephemeris(at).longitude,
    planet !== 'Sun' && planet !== 'Moon');
  return aspectTargets(longitude).flatMap(({ angle, label, offset, target }) => trace.hits(target).map(hit => ({
    ...hit, id: `western:${planet.toLowerCase()}:${offset}:${hit.at}`, planet, angle, label,
    natalLongitude: longitude, transitLongitude: trace.read(hit.at),
  }))).sort((a, b) => a.at - b.at);
}

function scanBody(window: Window, western: NatalWestern, planet: Planet): BodyResult {
  const longitude = natalLongitude(western, planet);
  if (longitude === null) return { planet, status: 'uncertain' };
  try {
    return { planet, status: 'ready', events: findContacts(window, planet, longitude) };
  } catch {
    return { planet, status: 'failed' };
  }
}

export function buildSolarTransits(window: Window, western?: NatalWestern) {
  const status = checkChart(western);
  if (status || !western) return { status: status ?? 'missing' } as const;
  const result = scanBody(window, western, 'Sun');
  if (result.status !== 'ready') return { status: result.status } as const;
  return { status: 'ready', version: solarTransitVersion, engineVersion, events: result.events } as const;
}

export function buildPlanetaryTransits(window: Window, western?: NatalWestern) {
  const status = checkChart(western);
  if (status || !western) return { status: status ?? 'missing' } as const;
  const bodies = planets.map(planet => scanBody(window, western, planet));
  const events = bodies.flatMap(body => body.status === 'ready' ? body.events : []).sort((a, b) => a.at - b.at);
  return { status: 'ready', version: planetaryTransitVersion, engineVersion, bodies, events } as const;
}

export function buildSolarReturnPositions(window: Window, western?: NatalWestern) {
  if (!western || checkChart(western)) return [];
  const longitude = natalLongitude(western, 'Sun');
  if (longitude === null) return [];
  const sun = makeEphemeris('Sun');
  const extended = { start: window.start - 367 * dayMs, end: window.end + 367 * dayMs };
  const instants: number[] = [];
  for (let start = extended.start; start < extended.end; start += 300 * dayMs) {
    const range = { start, end: Math.min(extended.end, start + 300 * dayMs) };
    const trace = longitudeTrace(range, dayMs, at => sun(at).longitude, false);
    instants.push(...trace.hits(longitude).map(hit => hit.at));
  }
  const returns = [...new Set(instants)].sort((a, b) => a - b);
  return returns.slice(0, -1).flatMap((at, index) => {
    const start = Math.max(window.start, at);
    const end = Math.min(window.end, returns[index + 1]);
    if (start >= end) return [];
    return [{ start, end, returnAt: at, returnEnd: returns[index + 1], natalSunLongitude: longitude,
      bodies: planets.map(planet => {
        const read = makeEphemeris(planet);
        const position = read(at);
        const speed = signedArc(read(at + 600_000).longitude - read(at - 600_000).longitude) * 72;
        return { planet, longitude: position.longitude, sign: signIndex(position.longitude),
          speed, direction: speed < 0 ? 'retrograde' : 'direct' };
      }) }];
  });
}

export function readTransitLongitude(planet: Planet, at: number) {
  return makeEphemeris(planet)(at).longitude;
}

export function readTransitStationTimes(window: Window, planet: Planet) {
  if (planet === 'Sun' || planet === 'Moon') return [];
  const read = makeEphemeris(planet);
  return longitudeTrace(window, stepFor(planet), at => read(at).longitude, true).stations.map(station => station.at);
}

const zodiac = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const westernOrbPolicy = {
  version: 'fortune-major-aspect-orbs-v1',
  byAspect: { 0: 6, 60: 4, 90: 5, 120: 5, 180: 6 },
  byTransitBody: { Moon: 4 },
  byTarget: { ASC: 3, MC: 3, DSC: 3, IC: 3 },
} as const;
type OrbPolicy = { version: string; byAspect: Record<typeof aspects[number]['angle'], number>;
  byTransitBody: Partial<Record<Planet, number>>; byTarget: Partial<Record<string, number>> };
type TransitOptions = { anglesReliable?: boolean; includeOppositeAxes?: boolean; orbs?: OrbPolicy };
const signIndex = (longitude: number) => Math.floor(normalize(longitude) / 30);
type WesternCandidate = NatalWestern['rawResult'][number];

function natalTargets(candidate: WesternCandidate, anglesReliable: boolean, includeOppositeAxes: boolean) {
  const valid = (angle: number) => Number.isFinite(angle) && angle >= 0 && angle < 360;
  const targets = (candidate.positions ?? []).filter(item => valid(item.longitude))
    .map(({ planet, longitude }) => ({ id: String(planet), longitude }));
  if (anglesReliable && valid(candidate.ascendant)) {
    targets.push({ id: 'ASC', longitude: candidate.ascendant });
    if (includeOppositeAxes) targets.push({ id: 'DSC', longitude: normalize(candidate.ascendant + 180) });
  }
  if (anglesReliable && valid(candidate.midheaven)) {
    targets.push({ id: 'MC', longitude: candidate.midheaven });
    if (includeOppositeAxes) targets.push({ id: 'IC', longitude: normalize(candidate.midheaven + 180) });
  }
  return targets;
}

function orbAt(read: (at: number) => number, target: number, at: number) {
  return Math.abs(signedArc(read(at) - target));
}

export function readJupiterConjunctionEpisode(episodeStart: number, natalLongitude: number, orb: number) {
  const step = stepFor('Jupiter');
  const jupiter = makeEphemeris('Jupiter');
  const trace = longitudeTrace({ start: episodeStart - step, end: episodeStart + 366 * dayMs },
    step, at => jupiter(at).longitude, true);
  const edges = [-1, 1].flatMap(side => trace.hits(normalize(natalLongitude + side * orb)).map(hit => ({
    ...hit, exiting: side === (hit.direction === 'direct' ? 1 : -1),
  }))).sort((a, b) => a.at - b.at);
  const ingress = edges.find(row => !row.exiting && Math.abs(row.at - episodeStart) <= westernSearchPolicy.stationToleranceMs);
  const egress = ingress && edges.find(row => row.at > ingress.at && row.exiting);
  if (!ingress || !egress) return;
  return { start: ingress.at, end: egress.at,
    exact: trace.hits(natalLongitude).filter(row => ingress.at <= row.at && row.at < egress.at),
    stations: trace.stations.filter(row => ingress.at <= row.at && row.at < egress.at).map(row => ({
      at: row.at, longitude: trace.read(row.at), directionAfter: row.direction > 0 ? 'direct' as const : 'retrograde' as const,
    })) };
}

function aspectMotion(read: (at: number) => number, target: number, at: number, orb: number) {
  const after = orbAt(read, target, at + 600_000);
  const before = orbAt(read, target, at - 600_000);
  const orbSpeedDegPerDay = (after - before) * 72;
  const state = orb < 1e-7 ? 'exact' : Math.abs(orbSpeedDegPerDay) < 1e-7 ? 'stationary'
    : orbSpeedDegPerDay < 0 ? 'applying' : 'separating';
  return { orbSpeedDegPerDay, state, applying: state === 'applying', separating: state === 'separating' };
}

function findEarlierOrbEntry(trace: ReturnType<typeof longitudeTrace>, target: number, orb: number, start: number) {
  const { read, step } = trace;
  let inside = start;
  const earliest = start - westernSearchPolicy.maxEpisodeLookbackYears * 366 * dayMs;
  // Align backward samples to UTC so overlapping display windows converge on the same crossing.
  for (let at = Math.floor((start - 1) / step) * step; at >= earliest; at -= step) {
    if (orbAt(read, target, at) <= orb) { inside = at; continue; }
    let outside = at;
    while (inside - outside > 1) {
      const middle = Math.floor((inside + outside) / 2);
      if (orbAt(read, target, middle) <= orb) inside = middle;
      else outside = middle;
    }
    return inside;
  }
}

function contactSeries(trace: ReturnType<typeof longitudeTrace>, longitude: number, window: Window,
  allowed: (angle: typeof aspects[number]['angle']) => number, trackEpisode = false) {
  return aspectTargets(longitude).map(({ target, offset, angle, label }) => {
    const allowedOrb = allowed(angle);
    const exact = trace.hits(target).map(hit => ({
      ...hit, transitLongitude: trace.read(hit.at), orb: orbAt(trace.read, target, hit.at),
    }));
    const edges = [...trace.hits(normalize(target - allowedOrb)), ...trace.hits(normalize(target + allowedOrb))];
    const cuts = [...new Set([window.start, window.end,
      ...edges.map(item => item.at),
    ])].sort((a, b) => a - b);
    const orbWindows = cuts.slice(1).flatMap((end, index) => {
      const start = cuts[index];
      const sampleAt = start + Math.floor((end - start) / 2);
      const orb = orbAt(trace.read, target, sampleAt);
      if (orb > allowedOrb) return [];
      const enters = edges.some(item => item.at === start);
      const episodeStart = enters ? start
        : trackEpisode ? findEarlierOrbEntry(trace, target, allowedOrb, start) : undefined;
      const earlierPasses = episodeStart !== undefined && episodeStart < start
        ? longitudeTrace({ start: episodeStart, end: start }, trace.step, trace.read, trace.detectStations).hits(target).length : 0;
      const sampleDirection = signedArc(trace.read(sampleAt + 600_000) - trace.read(sampleAt - 600_000));
      return [{ start, end, enters, episodeStart, earlierPasses,
        exits: end !== window.end, sampleAt, orb, transitLongitude: trace.read(sampleAt),
        transitMotion: sampleDirection < 0 ? 'retrograde' : sampleDirection > 0 ? 'direct' : 'stationary',
        ...aspectMotion(trace.read, target, sampleAt, orb),
        exact: exact.filter(item => item.at >= start && item.at < end).map(item => item.at) }];
    });
    return { angle, label, offset, target, allowedOrb, exact, orbWindows };
  }).filter(item => item.orbWindows.length || item.exact.length);
}

function activeAspects(read: (at: number) => number, longitude: number, at: number,
  allowed: (angle: typeof aspects[number]['angle']) => number) {
  const longitudeNow = read(at);
  return aspectTargets(longitude).flatMap(({ angle, label, offset, target }) => {
    const orb = Math.abs(signedArc(longitudeNow - target));
    const allowedOrb = allowed(angle);
    if (orb > allowedOrb) return [];
    return [{ angle, label, offset, orb, allowedOrb, ...aspectMotion(read, target, at, orb) }];
  });
}

export function buildWesternCalculation(window: Window, at: number, western?: NatalWestern, candidateId?: number,
  options: TransitOptions = {}) {
  validateWindow(window);
  if (!(window.start <= at && at < window.end)) throw new RangeError('Reference instant outside transit window');
  const natalStatus = checkChart(western) ?? 'ready';
  const natal = natalStatus === 'ready' && western ? western.rawResult : [];
  const orbPolicy: OrbPolicy = options.orbs ?? westernOrbPolicy;
  const allowed = (planet: Planet, target: string) => (angle: typeof aspects[number]['angle']) => {
    const value = Math.min(orbPolicy.byAspect[angle], orbPolicy.byTransitBody[planet] ?? Infinity,
      orbPolicy.byTarget[target] ?? Infinity);
    if (!Number.isFinite(value) || value <= 0 || value > 15) throw new RangeError('Invalid aspect orb configuration');
    return value;
  };
  if (candidateId !== undefined && (!Number.isInteger(candidateId) || !natal[candidateId])) {
    throw new RangeError('Invalid Western natal candidate');
  }
  const ephemeris = planets.map(planet => ({ planet, read: makeEphemeris(planet) }));
  const sky = ephemeris.map(({ planet, read }) => {
    const position = read(at);
    const sign = signIndex(position.longitude);
    const speed = signedArc(read(at + 600_000).longitude - read(at - 600_000).longitude) * 72;
    return { planet, ...position, sign, signName: zodiac[sign], signDegree: position.longitude % 30,
      longitudeSpeedDegPerDay: speed,
      direction: Math.abs(speed) < 1e-7 ? 'stationary' : speed < 0 ? 'retrograde' : 'direct' };
  });
  const absolute = ephemeris.map(({ planet, read }) => {
    const trace = longitudeTrace(window, stepFor(planet), time => read(time).longitude,
      planet !== 'Sun' && planet !== 'Moon');
    const ingresses = zodiac.flatMap((_, sign) => trace.hits(sign * 30).map(item => ({
      ...item, sign: item.direction === 'direct' ? sign : (sign + 11) % 12,
    }))).sort((a, b) => a.at - b.at);
    const stations = trace.stations.map(item => ({ at: item.at, longitude: trace.read(item.at),
      directionAfter: item.direction > 0 ? 'direct' : 'retrograde' }));
    return { planet, trace, ingresses, stations };
  });
  const anglesReliable = options.anglesReliable ?? natal.length === 1;
  const allTargets = natal.map(candidate => natalTargets(candidate, anglesReliable, options.includeOppositeAxes ?? true));
  const selectedTargets = candidateId === undefined ? allTargets[0]?.filter(target => allTargets.every(items =>
    items.some(item => item.id === target.id && item.longitude === target.longitude))) ?? [] : allTargets[candidateId] ?? [];
  const birthDates = (candidateId === undefined ? natal : [natal[candidateId]]).map(chart =>
    Math.round((chart.julianDay - 2440587.5) * dayMs));
  const birthAt = birthDates.length && birthDates.every(Number.isSafeInteger) ? Math.max(...birthDates) : undefined;
  const natalContacts = absolute.flatMap(({ planet, trace }) => {
    const retrogradeLoop = birthAt !== undefined && slowTransitBodies.has(planet)
      ? createRetrogradeLoopLookup(window, trace.read, birthAt) : undefined;
    return selectedTargets.flatMap(target => {
      const aspects = contactSeries(trace, target.longitude, window, allowed(planet, target.id), true).map(aspect => ({ ...aspect,
        exact: aspect.exact.map(pass => ({ ...pass, ...retrogradeLoop?.(aspect.target, pass) })),
      }));
      return aspects.length ? [{ planet, target: target.id, natalLongitude: target.longitude, aspects }] : [];
    });
  });

  const skyAspects = ephemeris.flatMap((first, index) => ephemeris.slice(index + 1).flatMap(second => {
    const difference = (time: number) => normalize(first.read(time).longitude - second.read(time).longitude);
    // Lower step captures Moon contacts and turning points of the relative longitude.
    const trace = longitudeTrace(window, dayMs / 4, difference, true);
    const aspects = contactSeries(trace, 0, window, allowed(first.planet, second.planet));
    const active = activeAspects(difference, 0, at, allowed(first.planet, second.planet));
    return aspects.length || active.length ? [{ first: first.planet, second: second.planet, aspects, active }] : [];
  }));
  const elongation = (time: number) => MoonPhase(new Date(time));
  const phaseTrace = longitudeTrace(window, dayMs / 4, elongation, false);
  const moonPhases = [0, 90, 180, 270].flatMap((angle, index) => phaseTrace.hits(angle)
    .map(item => ({ at: item.at, angle, name: ['朔', '上弦', '望', '下弦'][index] }))).sort((a, b) => a.at - b.at);

  const candidates = natal.map((raw, index) => {
    const ascendant = allTargets[index].find(target => target.id === 'ASC')?.longitude;
    const houseAt = (sign: number) => ascendant === undefined ? null
      : (sign - signIndex(ascendant) + 12) % 12 + 1;
    return {
      candidateId: index, natal: raw, targets: allTargets[index],
      transits: absolute.map(({ planet, trace, ingresses }) => ({
        planet, house: houseAt(signIndex(trace.read(at))),
        houseAtStart: houseAt(signIndex(trace.read(window.start))),
        houseIngresses: ascendant === undefined ? [] : ingresses.map(item => ({ ...item, house: houseAt(item.sign) })),
        aspects: allTargets[index].flatMap(target => activeAspects(trace.read, target.longitude, at, allowed(planet, target.id))
          .map(aspect => ({ ...aspect, target: target.id, natalLongitude: target.longitude }))),
      })),
    };
  });
  return {
    version: 'fortune-western-calculation-v2', engineVersion, window, at, orbPolicy, natalStatus, anglesReliable,
    natalRules: natal.length ? western?.rulesetVersion : undefined,
    scenario: candidateId === undefined ? 'stable-targets' : 'selected-candidate', candidateId,
    timelineTargets: selectedTargets, candidates,
    sky, motion: absolute.map(({ planet, ingresses, stations }) => ({ planet, ingresses, stations })),
    natalContacts, skyAspects, moon: { elongation: elongation(at), phases: moonPhases },
  } as const;
}
