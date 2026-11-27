import { readRetrogradeLoopPasses, readTransitLongitude, retrogradeLoopGeometry, scanRetrogradeLoopStations } from './solar-transits';

const normalize = (value: number) => (value % 360 + 360) % 360;
const arc = (value: number) => normalize(value + 180) - 180;
type Read = (at: number) => number;
type Turn = { at: number; longitude: number; directionAfter: 'direct' | 'retrograde' };
export const heindelJupiterRepeatPolicy = {
  profile: 'heindel-jupiter-station-bracketed-repeat-v1',
  coordinate: 'modern-geocentric-apparent-tropical-longitude',
  search: 'UTC-anchor-year-minus-two-through-plus-three-not-an-effect-duration',
  ...retrogradeLoopGeometry,
  cycles: 'direct-station-to-retrograde-station-to-direct-station-to-next-retrograde-station',
  effectDurationVerified: false,
} as const;

export const scanJupiterStations = scanRetrogradeLoopStations;
export const jupiterPassesInCycle = readRetrogradeLoopPasses;

function jupiterCycles(stations: Turn[], target: number, read: Read) {
  return stations.slice(0, -3).flatMap((row, i) => row.directionAfter === 'direct'
    ? [jupiterPassesInCycle(stations.slice(i, i + 4), target, read)] : []);
}

export function classifyJupiterRepeats(stations: Turn[], target: number, anchorAt: number,
  referenceAt: number, birthAt: number, read: Read) {
  const cycles = jupiterCycles(stations, target, read);
  const matches = cycles.filter(cycle => [...cycle.passes, ...cycle.touches].some(point => Math.abs(point.at - anchorAt) <= 2_000));
  const repeats = matches.filter(cycle => cycle.passes.length === 3);
  const chosen = repeats.length === 1 ? repeats : matches;
  const passes = chosen.flatMap(row => row.passes).sort((a, b) => a.at - b.at)
    .filter((row, i, all) => !i || Math.abs(row.at - all[i - 1].at) > 2_000);
  const touches = chosen.flatMap(row => row.touches).filter(row => Math.abs(row.at - anchorAt) <= 2_000);
  const verified = !touches.length && (repeats.length === 1 || !repeats.length && matches.length >= 2 && passes.length === 1);
  return { status: touches.length ? 'stationary_touch' : repeats.length === 1 ? 'repeated' : verified ? 'single' : 'unresolved',
    verified, hasRepeatGeometry: verified ? repeats.length === 1 : undefined,
    allPassesAfterBirth: passes.length ? passes.every(row => row.at >= birthAt) : undefined,
    returnedAsOfReference: verified && repeats.length === 1 && passes.every(row => row.at >= birthAt && row.at <= referenceAt),
    occurredPassCount: passes.filter(row => birthAt <= row.at && row.at <= referenceAt).length,
    futurePassCount: passes.filter(row => row.at > referenceAt).length,
    passes: passes.map(row => ({ ...row, beforeBirth: row.at < birthAt, afterReference: row.at > referenceAt })),
    stationTurns: chosen.flatMap(row => row.turns).sort((a, b) => a.at - b.at).filter((row, i, all) => !i || row.at !== all[i - 1].at),
    touches, bracketingCycleCount: chosen.length } as const;
}

export function createJupiterRepeatScanner(referenceAt: number, birthAt: number, read: Read = at => readTransitLongitude('Jupiter', at)) {
  if (![referenceAt, birthAt].every(Number.isSafeInteger) || referenceAt <= birthAt) throw new RangeError('Invalid Jupiter reference');
  const values = new Map<number, number>(), stationCache = new Map<number, Turn[]>();
  const position = (at: number) => {
    if (!values.has(at)) { const value = read(at); if (!Number.isFinite(value)) throw new RangeError('Invalid Jupiter longitude'); values.set(at, value); }
    return values.get(at)!;
  };
  const yearStart = (year: number) => { const date = new Date(0); date.setUTCFullYear(year, 0, 1); date.setUTCHours(0, 0, 0, 0); return date.getTime(); };
  const stationsFor = (year: number) => {
    if (!stationCache.has(year)) stationCache.set(year, scanJupiterStations({ start: yearStart(year - 2), end: yearStart(year + 3) }, position));
    return stationCache.get(year)!;
  };
  const scan = (anchorAt: number, natalLongitude: number, aspectType: string) => {
    if (!Number.isSafeInteger(anchorAt) || anchorAt < birthAt || !Number.isFinite(natalLongitude) || natalLongitude < 0 || natalLongitude >= 360
      || !['sextile', 'trine'].includes(aspectType)) throw new RangeError('Invalid Jupiter aspect anchor');
    const angle = aspectType === 'sextile' ? 60 : 120, separation = arc(position(anchorAt) - natalLongitude);
    const year = new Date(anchorAt).getUTCFullYear(), start = yearStart(year - 2), end = yearStart(year + 3);
    const offset = separation < 0 ? -angle : angle, targetLongitude = normalize(natalLongitude + offset);
    const base = { profile: heindelJupiterRepeatPolicy.profile, referenceAt, birthAt, anchorAt, natalLongitude,
      aspectType, offset, targetLongitude, searchStart: start, searchEnd: end, effectDurationVerified: false };
    if (Math.abs(Math.abs(separation) - angle) > 1e-6) return { ...base, status: 'coordinate_mismatch', verified: false } as const;
    return { ...base, ...classifyJupiterRepeats(stationsFor(year), targetLongitude, anchorAt, referenceAt, birthAt, position) };
  };
  // A narrow band can be cut by the query boundary before or after its exact
  // pass. Every intervening station must still be in that same directed band.
  const findAdjacentBandRepeat = (band: { start: number; end: number }, query: { start: number; end: number },
    natalLongitude: number, aspectType: 'sextile' | 'trine', orb: number) => {
    const edges = [
      ...(band.start === query.start ? [{ at: band.start, side: -1 }] : []),
      ...(band.end === query.end ? [{ at: band.end, side: 1 }] : []),
    ];
    if (!edges.length) return undefined;
    const aspect = aspectType === 'sextile' ? 60 : 120;
    const offset = Math.sign(arc(position(Math.floor((band.start + band.end) / 2)) - natalLongitude)) * aspect;
    const target = normalize(natalLongitude + offset);
    for (const edge of edges) {
      if (Math.abs(arc(position(edge.at) - target)) > orb) continue;
      const cycles = jupiterCycles(stationsFor(new Date(edge.at).getUTCFullYear()), target, position);
      const candidates = cycles.flatMap(({ turns, passes, touches }) => {
        if (touches.length || passes.length !== 3 || passes.some(pass => pass.at < birthAt)
          || edge.at < turns[0].at || edge.at > turns.at(-1)!.at) return [];
        return passes.filter(pass => {
          if (edge.side === -1 ? pass.at >= edge.at : pass.at < edge.at) return false;
          const lo = Math.min(edge.at, pass.at), hi = Math.max(edge.at, pass.at);
          return turns.every(turn => turn.at <= lo || turn.at >= hi || Math.abs(arc(turn.longitude - target)) <= orb);
        });
      }).sort((a, b) => Math.abs(a.at - edge.at) - Math.abs(b.at - edge.at));
      if (!candidates.length) continue;
      const proof = scan(candidates[0].at, natalLongitude, aspectType);
      if (proof.status === 'repeated' && proof.allPassesAfterBirth) return proof;
    }
  };
  return Object.assign(scan, { findAdjacentBandRepeat });
}
