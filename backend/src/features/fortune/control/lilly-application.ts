import type { ClassicalPlanet } from './lilly-essential';
import type { LillyEpochPosition } from './lilly-accidental';

const day = 86_400_000;
const arc = (degrees: number) => ((degrees + 540) % 360 + 360) % 360 - 180;
const sign = (longitude: number) => Math.floor(longitude / 30);
type Read = (body: ClassicalPlanet, at: number) => Omit<LillyEpochPosition, 'body'>;
export const lillyMajorAspects = [{ type: 'conjunction', angle: 0 }, { type: 'sextile', angle: 60 }, { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 }, { type: 'opposition', angle: 180 }] as const;
type MajorAspect = typeof lillyMajorAspects[number];

export const lillyApplicationPolicy = {
  profile: 'lilly-same-chart-application-v1',
  sampleMs: day / 4,
  maxDays: 32,
  toleranceMs: 1_000,
} as const;

// The predicate must hold on the left of the event and fail on the right.
function bracket(left: number, right: number, before: (at: number) => boolean) {
  while (right - left > lillyApplicationPolicy.toleranceMs) {
    const mid = Math.floor((left + right) / 2);
    if (before(mid)) left = mid;
    else right = mid;
  }
  return right;
}

export function lillyApplicationSequence(at: number, subject: LillyEpochPosition, other: LillyEpochPosition, angle: number, read: Read,
  before = at + lillyApplicationPolicy.maxDays * day) {
  const direction = arc(other.longitude - subject.longitude);
  const target = angle === 180 ? 180 : Math.sign(direction) * angle;
  const side = Math.sign(arc(direction - target));
  const subjectSign = sign(subject.longitude), otherSign = sign(other.longitude);
  const initiallyApplying = side > 0 ? subject : other;
  const bothDirect = subject.speed > 0 && other.speed > 0;
  const end = Math.min(before, at + lillyApplicationPolicy.maxDays * day);
  const sample = (instant: number) => {
    const first = read(subject.body, instant), second = read(other.body, instant);
    return { residual: side * arc(second.longitude - first.longitude - target), rate: side * (second.speed - first.speed),
      first, second, sameSigns: sign(first.longitude) === subjectSign && sign(second.longitude) === otherSign };
  };
  const applyingSpeed = (data: ReturnType<typeof sample>) => initiallyApplying === subject ? data.first.speed : data.second.speed;
  let lossOfApproachAt: number | undefined;
  let applyingStationAt: number | undefined;
  const witness = (status: 'exact' | 'sign_exit' | 'window_end' | 'ordering_unresolved', eventAt: number) => ({
    profile: lillyApplicationPolicy.profile, status, eventAt: new Date(eventAt).toISOString(),
    lossOfApproachAt: lossOfApproachAt === undefined ? undefined : new Date(lossOfApproachAt).toISOString(),
    applyingRetrogradeStation: applyingStationAt === undefined ? undefined : {
      body: initiallyApplying.body, at: new Date(applyingStationAt).toISOString(),
    },
  });

  let left = at, first = sample(at);
  while (left < end) {
    const right = Math.min(left + lillyApplicationPolicy.sampleMs, end), last = sample(right);
    const station = bothDirect && applyingStationAt === undefined && applyingSpeed(first) >= 0 && applyingSpeed(last) < 0
      ? bracket(left, right, t => applyingSpeed(sample(t)) > 0) : undefined;
    // Extrema can expose a crossing even when the two coarse samples agree.
    const breaks = [
      ...(first.first.speed * last.first.speed < 0 ? [bracket(left, right, t => sample(t).first.speed * first.first.speed > 0)] : []),
      ...(first.second.speed * last.second.speed < 0 ? [bracket(left, right, t => sample(t).second.speed * first.second.speed > 0)] : []),
      ...(first.rate < 0 && last.rate >= 0 ? [bracket(left, right, t => sample(t).rate < 0)] : []),
      right,
    ].sort((a, b) => a - b);
    let from = left, initial = first;
    for (const to of breaks) {
      const final = sample(to);
      const exact = final.residual <= 0 ? bracket(from, to, t => sample(t).residual > 0) : undefined;
      const signExit = !final.sameSigns ? bracket(from, to, t => sample(t).sameSigns) : undefined;
      const firstEvent = Math.min(exact ?? Infinity, signExit ?? Infinity);
      if (lossOfApproachAt === undefined && initial.rate < 0 && final.rate >= 0) {
        const turn = bracket(from, to, t => sample(t).rate < 0);
        if (turn < firstEvent) lossOfApproachAt = turn;
      }
      if (station !== undefined && station <= to && station < firstEvent) applyingStationAt = station;
      if (exact !== undefined && signExit !== undefined && Math.abs(exact - signExit) <= lillyApplicationPolicy.toleranceMs) {
        return witness('ordering_unresolved', firstEvent);
      }
      if (Number.isFinite(firstEvent)) return witness(firstEvent === exact ? 'exact' : 'sign_exit', firstEvent);
      from = to;
      initial = final;
    }
    left = right;
    first = last;
  }
  return witness('window_end', end);
}

function forwardExactBefore(at: number, moving: LillyEpochPosition, target: LillyEpochPosition,
  angle: MajorAspect['angle'], before: number, read: Read) {
  const separation = arc(target.longitude - moving.longitude);
  const signedAngle = angle === 180 ? 180 : Math.sign(separation) * angle;
  if (!(moving.speed > target.speed && target.speed > 0) || arc(separation - signedAngle) <= 1e-9) return undefined;
  const result = lillyApplicationSequence(at, moving, target, angle, read, before);
  return result.status === 'exact' && result.lossOfApproachAt === undefined
    && Date.parse(result.eventAt) < before - lillyApplicationPolicy.toleranceMs ? result.eventAt : undefined;
}

type LillyInterposition = {
  kind: 'bodily_prohibition' | 'aspectual_prohibition' | 'frustration';
  thirdBody: ClassicalPlanet;
  applyingBody: ClassicalPlanet;
  receivingBody: ClassicalPlanet;
  applyingAspectType?: MajorAspect['type'];
  aspectType: MajorAspect['type'];
  applyingContactAt?: string;
  receivingContactAt: string;
};

export function lillyApplicationInterpositions(at: number, first: LillyEpochPosition, second: LillyEpochPosition,
  positions: LillyEpochPosition[], read: Read, application: ReturnType<typeof lillyApplicationSequence>,
  primaryAspect: MajorAspect['type']): LillyInterposition[] {
  if (application.status !== 'exact' || application.lossOfApproachAt !== undefined
    || first.speed <= 0 || second.speed <= 0) return [];
  const [applying, receiving] = first.speed > second.speed ? [first, second] : [second, first];
  const before = Date.parse(application.eventAt);
  const aspectFrom = (third: LillyEpochPosition, target: LillyEpochPosition) => {
    const distance = Math.abs(sign(third.longitude) - sign(target.longitude));
    return lillyMajorAspects.find(row => row.angle === Math.min(distance, 12 - distance) * 30);
  };
  return positions.flatMap((third): LillyInterposition[] => {
    if (third.body === first.body || third.body === second.body || third.speed <= 0) return [];
    const applyingAspect = aspectFrom(third, applying);
    const receivingAspect = aspectFrom(third, receiving);
    if (!applyingAspect || !receivingAspect) return [];
    const roles = { thirdBody: third.body, applyingBody: applying.body, receivingBody: receiving.body,
      aspectType: receivingAspect.type };
    if (third.speed > applying.speed) {
      const applyingContactAt = forwardExactBefore(at, third, applying, applyingAspect.angle, before, read);
      if (!applyingContactAt) return [];
      const receivingContactAt = forwardExactBefore(at, third, receiving, receivingAspect.angle, before, read);
      if (!receivingContactAt || Date.parse(receivingContactAt) - Date.parse(applyingContactAt) <= lillyApplicationPolicy.toleranceMs) return [];
      const applyingAspectType = applyingAspect.type === receivingAspect.type ? undefined : applyingAspect.type;
      return [{ ...roles, kind: receivingAspect.angle === 0 && applyingAspect.angle === 0 ? 'bodily_prohibition' : 'aspectual_prohibition',
        applyingAspectType, applyingContactAt, receivingContactAt }];
    }
    // Book I's frustration condition expressly describes bodily conjunction.
    if (primaryAspect !== 'conjunction' || receivingAspect.angle !== 0) return [];
    const receivingContactAt = forwardExactBefore(at, receiving, third, 0, before, read);
    return receivingContactAt ? [{ ...roles, kind: 'frustration', receivingContactAt }] : [];
  });
}

export function lillyTranslationWitnesses(at: number, body: ClassicalPlanet, positions: LillyEpochPosition[], read: Read,
  aspectOrbs: (first: ClassicalPlanet, second: ClassicalPlanet) => { mainOrb: number; alternateOrb: number }) {
  // Reflect the same ephemeris about the chart epoch to reuse the in-sign root finder for separation.
  const reverse: Read = (planet, instant) => {
    const row = read(planet, 2 * at - instant);
    return { longitude: row.longitude, speed: -row.speed };
  };
  const directOrder = (moving: { speed: number }, target: { speed: number }) => moving.speed > target.speed && target.speed > 0;
  return positions.flatMap(moving => {
    const signAspectGeometry = positions.flatMap(other => {
      if (other.body === moving.body) return [];
      const signDistance = Math.abs(sign(moving.longitude) - sign(other.longitude));
      const aspect = lillyMajorAspects.find(row => row.angle === Math.min(signDistance, 12 - signDistance) * 30);
      if (!aspect) return [];
      const arcBetween = arc(other.longitude - moving.longitude);
      const signedAngle = aspect.angle === 180 ? 180 : Math.sign(arcBetween) * aspect.angle;
      const residual = arc(arcBetween - signedAngle);
      const { mainOrb, alternateOrb } = aspectOrbs(moving.body, other.body);
      return [{ other, aspect, residual, inBothOrbs: Math.abs(residual) <= Math.min(mainOrb, alternateOrb) }];
    });
    const contacts = signAspectGeometry.filter(row => row.inBothOrbs && directOrder(moving, row.other));
    if (contacts.some(row => Math.abs(row.residual) <= 1e-9)) return [];
    const separating = contacts.filter(row => row.residual < 0);
    const applying = contacts.filter(row => row.residual > 0);
    if (!separating.length || !applying.length || moving.body !== body && !contacts.some(row => row.other.body === body)) return [];
    const scan = (rows: typeof contacts, backwards: boolean) => rows.flatMap(({ other, aspect }) => {
      const result = backwards
        ? lillyApplicationSequence(at, { ...moving, speed: -moving.speed }, { ...other, speed: -other.speed }, aspect.angle, reverse)
        : lillyApplicationSequence(at, moving, other, aspect.angle, read);
      if (result.status !== 'exact' || result.lossOfApproachAt !== undefined || result.applyingRetrogradeStation) return [];
      const elapsed = Date.parse(result.eventAt) - at;
      const time = backwards ? at - elapsed : at + elapsed;
      if (!directOrder(read(moving.body, time), read(other.body, time))) return [];
      return [{ body: other.body, aspect: aspect.type, time }];
    });
    const prior = scan(separating, true).sort((a, b) => b.time - a.time);
    const next = scan(applying, false).sort((a, b) => a.time - b.time);
    const [from, previous] = prior, [to, following] = next;
    if (!from || !to || ![moving.body, from.body, to.body].includes(body)
      || (previous && from.time - previous.time <= lillyApplicationPolicy.toleranceMs)
      || (following && following.time - to.time <= lillyApplicationPolicy.toleranceMs)) return [];
    // Book I p.126 requires reaching the second significator before meeting
    // any other planet, regardless of its motion or orb at the chart epoch.
    const deadline = to.time + lillyApplicationPolicy.toleranceMs;
    const meetsThirdBodyFirst = signAspectGeometry.some(({ other, aspect, residual }) => {
      if (other.body === from.body || other.body === to.body) return false;
      if (Math.abs(residual) <= 1e-9) return true;
      const result = lillyApplicationSequence(at, moving, other, aspect.angle, read, deadline);
      return (result.status === 'exact' || result.status === 'ordering_unresolved')
        && Date.parse(result.eventAt) <= deadline;
    });
    if (meetsThirdBodyFirst) return [];
    return [{ movingBody: moving.body, fromBody: from.body, fromAspect: from.aspect,
      fromAt: new Date(from.time).toISOString(), toBody: to.body, toAspect: to.aspect, toAt: new Date(to.time).toISOString() }];
  });
}
