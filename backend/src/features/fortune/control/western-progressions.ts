import { Body, Ecliptic, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SunPosition } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import { planetLabels, type Planet } from './solar-transits';

const day = 86_400_000;
const bodies = Object.keys(planetLabels) as Planet[];
export const progressionPolicy = {
  version: 'secondary-utc-calendar-month-v1', kind: 'secondary', zodiac: 'tropical',
  timeKey: 'one-ephemeris-day-per-year; calendar-month=two-hours; interpolate-within-UTC-month',
  coordinateFrame: 'geocentric apparent ecliptic of date; declination in fixed natal true equator',
  longitudeOrb: 1, parallelOrb: 0.25, sampleDays: 2, rootToleranceMs: 1_000,
  natalLongitudeTolerance: 0.02, natalClockToleranceMs: 1_000,
  leapDayPolicy: 'clamp-original-birth-day-to-last-day-of-target-month',
} as const;
export const progressedAspects = [
  { type: 'conjunction', angle: 0 }, { type: 'semisextile', angle: 30 }, { type: 'semisquare', angle: 45 },
  { type: 'sextile', angle: 60 }, { type: 'square', angle: 90 }, { type: 'trine', angle: 120 },
  { type: 'sesquiquadrate', angle: 135 }, { type: 'quincunx', angle: 150 }, { type: 'opposition', angle: 180 },
] as const;
const normalize = (value: number) => (value % 360 + 360) % 360;
const arc = (value: number) => normalize(value + 180) - 180;

function monthAnchor(birth: Date, months: number) {
  const index = birth.getUTCFullYear() * 12 + birth.getUTCMonth() + months;
  const year = Math.floor(index / 12), month = index % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(birth.getUTCDate(), lastDay), birth.getUTCHours(), birth.getUTCMinutes(),
    birth.getUTCSeconds(), birth.getUTCMilliseconds());
}

// Calendar anniversaries keep the book's birthday and half-year examples exact.
// The interpolation and leap-day treatment are declared product policies, not
// an undocumented replacement of the original key with solar arc or transits.
export function progressionEpoch(birthAt: number, realAt: number) {
  if (!Number.isFinite(new Date(birthAt).getTime()) || !Number.isFinite(new Date(realAt).getTime()) || realAt < birthAt) throw new RangeError('Invalid progression time');
  const birth = new Date(birthAt), date = new Date(realAt);
  let months = (date.getUTCFullYear() - birth.getUTCFullYear()) * 12 + date.getUTCMonth() - birth.getUTCMonth();
  if (monthAnchor(birth, months) > realAt) months--;
  const start = monthAnchor(birth, months), end = monthAnchor(birth, months + 1);
  return birthAt + (months + (realAt - start) / (end - start)) * day / 12;
}

export function progressionRealTime(birthAt: number, ephemerisAt: number) {
  if (!Number.isFinite(birthAt) || !Number.isFinite(ephemerisAt) || ephemerisAt < birthAt) throw new RangeError('Invalid progression epoch');
  const months = (ephemerisAt - birthAt) * 12 / day;
  const whole = Math.floor(months), birth = new Date(birthAt);
  const start = monthAnchor(birth, whole), end = monthAnchor(birth, whole + 1);
  return start + (months - whole) * (end - start);
}

export function readProgressionPosition(body: Planet, ephemerisAt: number, birthAt: number) {
  const date = new Date(ephemerisAt);
  const vector = GeoVector(Body[body], date, true);
  const longitude = body === 'Sun' ? SunPosition(date).elon : Ecliptic(vector).elon;
  const declination = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(new Date(birthAt)), vector)).dec;
  return { longitude, declination };
}

export function readProgressionBirth(chart?: DestinyChartSnapshot) {
  const western = chart?.western;
  if (!western?.rawResult.length) return { status: 'missing' } as const;
  if (western.engineName !== 'astronomy-engine' || western.engineVersion !== '2.1.19'
    || western.rulesetVersion !== 'tropical-whole-sign-v1') return { status: 'unsupported' } as const;
  if (!chart?.timeKnown || western.rawResult.length !== 1) return { status: 'uncertain' } as const;
  const natal = western.rawResult[0];
  const jdAt = Number.isFinite(natal.julianDay) ? Math.round((natal.julianDay - 2440587.5) * day) : undefined;
  const bazi = chart.bazi;
  const compatibleClock = bazi?.engineName === 'lunar-javascript' && bazi.engineVersion === '1.7.8'
    && bazi.rulesetVersion === 'utc8-jie-local-civil-late-zi-next-v1';
  const clocks = (compatibleClock ? bazi.rawResult : []).map(row => row.utc).filter(value => typeof value === 'string');
  const utcTimes = clocks.map(value => Date.parse(value));
  if (utcTimes.some(value => !Number.isFinite(value)) || utcTimes.some(value => Math.abs(value - utcTimes[0]) > progressionPolicy.natalClockToleranceMs)) {
    return { status: 'inconsistent_clock' } as const;
  }
  const birthAt = jdAt ?? utcTimes[0];
  if (!Number.isFinite(birthAt)) return { status: 'missing_clock' } as const;
  if (jdAt !== undefined && utcTimes.some(value => Math.abs(value - jdAt) > progressionPolicy.natalClockToleranceMs)) {
    return { status: 'inconsistent_clock' } as const;
  }
  try {
    if (!natal.positions.length || natal.positions.some(position => !bodies.includes(position.planet)
      || !Number.isFinite(position.longitude)
      || Math.abs(arc(readProgressionPosition(position.planet, birthAt, birthAt).longitude - position.longitude)) > progressionPolicy.natalLongitudeTolerance)) {
      return { status: 'inconsistent_natal' } as const;
    }
  } catch { return { status: 'inconsistent_natal' } as const; }
  return { status: 'ready', birthAt, clockSource: jdAt === undefined ? 'archived_bazi_utc' : 'western_julian_day' } as const;
}

type Window = { start: number; end: number };
function root(start: number, end: number, fn: (at: number) => number) {
  let low = start, high = end, left = fn(low);
  while (high - low > progressionPolicy.rootToleranceMs) {
    const mid = (low + high) / 2, value = fn(mid);
    if (Math.abs(value) < 1e-10) return mid;
    if ((left < 0) === (value < 0)) { low = mid; left = value; } else high = mid;
  }
  return (low + high) / 2;
}

// Add stationary points before threshold crossings, so a band that enters and
// exits between two samples is not lost merely because both endpoints are out.
export function scanProgressionBand(window: Window, fn: (at: number) => number, orb: number,
  extraThresholds: number[] = [], accepts: (value: number) => boolean = () => true) {
  if (!(window.end > window.start) || !Number.isFinite(orb) || orb <= 0) throw new RangeError('Invalid progression band');
  const step = progressionPolicy.sampleDays * day;
  const knots = [window.start];
  for (let at = window.start + step; at < window.end; at += step) knots.push(at);
  knots.push(window.end);
  const slope = (at: number) => fn(at + 60_000) - fn(at - 60_000);
  for (const [index, start] of [...knots].slice(0, -1).entries()) {
    const end = knots[index + 1], a = slope(start), b = slope(end);
    if (a * b < 0) knots.push(root(start, end, slope));
  }
  knots.sort((a, b) => a - b);
  const cuts = new Set(knots), exact = new Set<number>();
  for (let index = 1; index < knots.length; index++) {
    const start = knots[index - 1], end = knots[index], a = fn(start), b = fn(end);
    for (const threshold of [-orb, 0, orb, ...extraThresholds]) {
      const x = a - threshold, y = b - threshold;
      if (Math.abs(x) < 1e-9) { cuts.add(start); if (!threshold) exact.add(start); }
      if (x * y < 0) { const at = root(start, end, value => fn(value) - threshold); cuts.add(at); if (!threshold) exact.add(at); }
      if (Math.abs(y) < 1e-9) { cuts.add(end); if (!threshold) exact.add(end); }
    }
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const ranges: Window[] = [];
  for (let index = 1; index < edges.length; index++) {
    const start = edges[index - 1], end = edges[index], middle = fn((start + end) / 2);
    if (end <= start || Math.abs(middle) > orb || !accepts(middle)) continue;
    const last = ranges.at(-1);
    if (last?.end === start) last.end = end; else ranges.push({ start, end });
  }
  return ranges.map(range => ({ start: Math.round(range.start), end: Math.round(range.end),
    exactTimes: [...new Set([...exact].filter(at => range.start <= at && at < range.end && accepts(fn(at)))
      .map(Math.round).filter(at => Math.round(range.start) <= at && at < Math.round(range.end)))],
    clippedStart: range.start === window.start, clippedEnd: range.end === window.end,
  })).filter(range => range.end > range.start);
}

export function scanProgressionLongitudePair(window: Window, longitudeAt: (at: number) => number, natalLongitude: number) {
  const initial = longitudeAt(window.start);
  return progressedAspects.flatMap(aspect => {
    const offsets = [0, 180].includes(aspect.angle) ? [aspect.angle] : [aspect.angle, -aspect.angle];
    return offsets.flatMap(offset => {
      const targetLongitude = initial + arc(natalLongitude + offset - initial);
      const error = (at: number) => initial + arc(longitudeAt(at) - initial) - targetLongitude;
      return scanProgressionBand(window, error, progressionPolicy.longitudeOrb).map(band => {
        const middle = (band.start + band.end) / 2;
        return { ...band, aspectType: aspect.type, exactAngle: aspect.angle, allowedOrb: progressionPolicy.longitudeOrb,
          coordinate: 'ecliptic_longitude' as const, progressedLongitude: longitudeAt(middle),
          natalLongitude, separation: Math.abs(error(middle)) };
      });
    });
  });
}

export function buildWesternProgressions(window: Window, referenceAt: number, chart?: DestinyChartSnapshot) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.end <= window.start
    || window.end - window.start > 368 * day || referenceAt < window.start || referenceAt >= window.end) {
    throw new RangeError('Invalid progression window');
  }
  const birth = readProgressionBirth(chart);
  if (birth.status !== 'ready') return { ...birth, policy: progressionPolicy };
  if (window.start <= birth.birthAt + 60_000) return { status: 'before_birth', policy: progressionPolicy } as const;
  const birthAt = birth.birthAt;
  const cache = new Map<string, ReturnType<typeof readProgressionPosition>>();
  const position = (body: Planet, at: number) => {
    const epoch = Math.round(progressionEpoch(birthAt, at)), key = body + ':' + epoch;
    if (!cache.has(key)) cache.set(key, readProgressionPosition(body, epoch, birthAt));
    return cache.get(key)!;
  };
  const natal = Object.fromEntries(bodies.map(body => [body, readProgressionPosition(body, birthAt, birthAt)])) as Record<Planet, ReturnType<typeof readProgressionPosition>>;
  const positions = bodies.map(body => ({ body, ...position(body, referenceAt), natalLongitude: natal[body].longitude,
    natalDeclination: natal[body].declination }));
  const intervals = [];
  for (const body of bodies) {
    const longitudeAt = (at: number) => position(body, at).longitude;
    for (const target of bodies) {
      if (body === target) continue;
      intervals.push(...scanProgressionLongitudePair(window, longitudeAt, natal[target].longitude).map(band => ({
        ...band, progressedBody: body, natalTargetId: target, progressedDeclination: undefined, natalDeclination: undefined,
      })));
      const natalDec = natal[target].declination;
      if (Math.abs(natalDec) < 1e-7) continue; // Equatorial zero has no established same-hemisphere direction.
      const difference = (at: number) => position(body, at).declination - natalDec;
      for (const band of scanProgressionBand(window, difference, progressionPolicy.parallelOrb, [-natalDec],
        value => Math.sign(value + natalDec) === Math.sign(natalDec))) intervals.push({
          ...band, progressedBody: body, natalTargetId: target, aspectType: 'parallel', exactAngle: undefined,
          allowedOrb: progressionPolicy.parallelOrb, coordinate: 'natal_equatorial_declination',
          progressedDeclination: position(body, (band.start + band.end) / 2).declination,
          natalDeclination: natalDec, separation: Math.abs(difference((band.start + band.end) / 2)),
          progressedLongitude: undefined, natalLongitude: undefined,
        });
    }
  }
  return { status: 'ready', policy: progressionPolicy, birthAt, clockSource: birth.clockSource,
    ephemerisAt: progressionEpoch(birthAt, referenceAt), positions,
    intervals: intervals.sort((a, b) => a.start - b.start || a.progressedBody.localeCompare(b.progressedBody)) } as const;
}
