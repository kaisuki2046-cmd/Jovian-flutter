import { Body, Ecliptic, GeoVector, NextMoonQuarter, SearchMoonQuarter } from 'astronomy-engine';
import type { DestinyChartSnapshot } from '../../destiny';
import type { PreviewPeriod } from './period-window';
import { ptolemyNatalGovernors, ptolemyNatalMercuryHorizon, ptolemyNatalPlacementFamiliarities, ptolemyNatalRulerPolicy, ptolemyNatalRulership, ptolemyNatalSect, ptolemyPlanetSect, ptolemySignRuler,
  type PtolemyTermTable } from './ptolemy-natal-rulers';
import { ptolemyPrimaryDirectionProfile, ptolemyPrimaryDirections, type PtolemyOrigin } from './ptolemy-primary-directions';
import { readProgressionBirth } from './western-progressions';
import { readTransitLongitude, readTransitStationTimes, westernSearchPolicy, type Planet } from './solar-transits';
import { readWesternHouseFrame, scanCircularRegions } from './western-houses';

export { ptolemySignRuler } from './ptolemy-natal-rulers';

const day = 86_400_000;
const normalize = (value: number) => (value % 360 + 360) % 360;
const sign = (longitude: number) => Math.floor(longitude / 30);
const classicalBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export const ptolemyTimePolicy = {
  profile: 'ptolemy-robbins-sign-times-v1', zodiac: 'tropical',
  yearUnit: 'one-sign-per-completed-birth-year', monthDays: 28, dayDaysNumerator: 7, dayDaysDenominator: 3,
  alternateManuscriptDay: 'robbins-IV.10-note82-two-and-a-half-days-v1',
  yearAnchor: 'UTC-civil-birth-anniversary-clamped-Feb29',
  annualClockComparison: 'ptolemy-almagest-III1-mean-and-egyptian-year-v1',
  subperiodClockComparison: 'ptolemy-IV10-three-year-anchors-fixed-subperiods-v1',
  subperiodOrigin: 'restart-28-day-months-at-annual-anchor-and-7/3-days-at-month-anchor',
  partialYearTail: 'retain-short-last-subperiod-no-forced-twelve-month-fit',
  lotPolicy: 'ASC-plus-Moon-minus-Sun-both-day-and-night',
  ingressPolicy: 'actual-presence-in-a-zodiac-sign-not-exact-degree-conjunction',
  lunarPhasePolicy: 'robbins-iv10-lunar-quarter-moon-sign-v1',
  natalAuthorTerm: 'robbins-I.21-author-half-open-bounds',
  termIngress: 'same-origin-active-egyptian-term-cogovernor-and-actual-sign-ingress',
  authorTermIngress: 'same-origin-robbins-I.21-author-term-cogovernor-and-actual-sign-ingress',
  authorTermComparison: 'independent-contemporary-term-tables-v1',
  natalRulers: ptolemyNatalRulerPolicy,
  primaryDirection: ptolemyPrimaryDirectionProfile,
  sourceTimingStatus: 'boundary-and-restart-interpretation-unresolved', rootToleranceMs: 1_000,
} as const;
const ptolemyMonthLength = ptolemyTimePolicy.monthDays * day;
// Almagest III.1 supplies two lengths, without choosing a clock for Tetrabiblos IV.10.
const egyptianYearLength = 365 * day;
const meanTropicalYearLength = egyptianYearLength + 21_312_000;
type Window = { start: number; end: number };
type Level = 'year' | 'month' | 'day';
type Origin = PtolemyOrigin;
export type PtolemyPlace = Window & { profile: typeof ptolemyTimePolicy.profile; level: Level;
  origin: Origin; natalLongitude: number; sign: number; ruler: Planet; annualSign: number; annualRuler: Planet;
  completedYears: number; monthIndex?: number; monthSign?: number; monthlyRuler?: Planet; dayIndex?: number;
  fullPeriodStart: number; fullPeriodEnd: number;
  annualStart: number; annualEnd: number };
type PrimaryPeriod = ReturnType<typeof ptolemyPrimaryDirections>[number] & Window;
type TimedPlace = PtolemyPlace & {
  natalGovernorProfile: typeof ptolemyNatalRulerPolicy.profile;
  natalGovernors: ReturnType<typeof ptolemyNatalGovernors>;
  annualOriginAspect: string;
  monthlyOriginAspect?: string;
  primaryDirectionProfile?: typeof ptolemyPrimaryDirectionProfile;
  primaryDirection?: PrimaryPeriod;
};
type TransitPlace = TimedPlace | (Omit<TimedPlace, 'level' | 'ruler' | 'primaryDirection'>
  & { level: 'primary'; ruler?: Planet; primaryDirection: PrimaryPeriod });
const ptolemyTimeIngressBodies: Record<Level, readonly Planet[]> = {
  year: ['Jupiter'], month: ['Sun', 'Mars', 'Venus', 'Mercury'], day: ['Moon'],
};

function isPtolemyTimeIngressBody(level: TransitPlace['level'], body: Planet) {
  return level !== 'primary' && ptolemyTimeIngressBodies[level].includes(body);
}

export function birthAnniversary(birthAt: number, age: number) {
  if (!Number.isFinite(new Date(birthAt).getTime()) || !Number.isInteger(age) || age < 0) throw new RangeError('Invalid annual clock');
  const birth = new Date(birthAt), year = birth.getUTCFullYear() + age, month = birth.getUTCMonth();
  return Date.UTC(year, month, Math.min(birth.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
    birth.getUTCHours(), birth.getUTCMinutes(), birth.getUTCSeconds(), birth.getUTCMilliseconds());
}

type SubperiodClockComparison = {
  subperiodClockComparisonProfile: typeof ptolemyTimePolicy.subperiodClockComparison;
  subperiodClockAgreement: 'same-index' | 'different-index';
};
type AnnualClockComparison = Window & {
  annualClockComparisonProfile: typeof ptolemyTimePolicy.annualClockComparison;
  annualClockAgreement: 'three-year-counts-agree' | 'year-counts-differ';
};

function annualClockWindows(window: Window, birthAt: number, completedYears: number): AnnualClockComparison[] {
  // The UTC slice already has completedYears. With an exact elapsed-days
  // anchor, the faster Egyptian clock enters and leaves that age first.
  const sameAgeStart = Math.max(window.start, birthAt + completedYears * meanTropicalYearLength);
  const sameAgeEnd = Math.min(window.end, birthAt + (completedYears + 1) * egyptianYearLength);
  const row = (start: number, end: number, annualClockAgreement: AnnualClockComparison['annualClockAgreement']): AnnualClockComparison =>
    ({ start, end, annualClockAgreement, annualClockComparisonProfile: ptolemyTimePolicy.annualClockComparison });
  if (sameAgeStart >= sameAgeEnd) return [row(window.start, window.end, 'year-counts-differ')];
  return [
    ...(window.start < sameAgeStart ? [row(window.start, sameAgeStart, 'year-counts-differ')] : []),
    row(sameAgeStart, sameAgeEnd, 'three-year-counts-agree'),
    ...(sameAgeEnd < window.end ? [row(sameAgeEnd, window.end, 'year-counts-differ')] : []),
  ];
}
function subperiodClockWindows<T extends Window>(window: T, birthAt: number, completedYears: number,
  monthIndex: number, dayIndex: number | undefined): (T & SubperiodClockComparison)[] {
  // Preserve the IV.10 units and the declared reset policy while changing
  // only the annual clock. Each alternative must reach the same nested slot.
  const dayLength = 7 * day / 3;
  const offset = monthIndex * ptolemyMonthLength + (dayIndex ?? 0) * dayLength;
  const duration = dayIndex === undefined ? ptolemyMonthLength : dayLength;
  const from = (yearLength: number) => {
    const yearStart = birthAt + completedYears * yearLength;
    return { start: yearStart + offset, end: Math.min(yearStart + offset + duration, yearStart + yearLength) };
  };
  const egyptian = from(egyptianYearLength), mean = from(meanTropicalYearLength);
  const sameStart = Math.max(window.start, egyptian.start, mean.start);
  const sameEnd = Math.min(window.end, egyptian.end, mean.end);
  const slice = (start: number, end: number, subperiodClockAgreement: SubperiodClockComparison['subperiodClockAgreement']) =>
    ({ ...window, start, end, subperiodClockAgreement, subperiodClockComparisonProfile: ptolemyTimePolicy.subperiodClockComparison });
  if (sameStart >= sameEnd) return [slice(window.start, window.end, 'different-index')];
  return [
    ...(window.start < sameStart ? [slice(window.start, sameStart, 'different-index')] : []),
    slice(sameStart, sameEnd, 'same-index'),
    ...(sameEnd < window.end ? [slice(sameEnd, window.end, 'different-index')] : []),
  ];
}

function instantAtArc(birthAt: number, arc: number) {
  const year = Math.floor(arc);
  const start = birthAnniversary(birthAt, year);
  const end = birthAnniversary(birthAt, year + 1);
  return Math.round(start + (end - start) * (arc - year));
}
export function ptolemyLot(ascendant: number, sun: number, moon: number) {
  if (![ascendant, sun, moon].every(value => Number.isFinite(value) && value >= 0 && value < 360)) throw new RangeError('Invalid lot longitudes');
  return normalize(ascendant + moon - sun);
}
function ptolemyMonthPlace(annualStart: number, annualEnd: number, annualSign: number, monthIndex: number) {
  const start = annualStart + monthIndex * ptolemyMonthLength;
  return { start, end: Math.min(start + ptolemyMonthLength, annualEnd), sign: (annualSign + monthIndex) % 12 };
}

function dayManuscriptWindows(place: Pick<PtolemyPlace, 'annualStart' | 'annualEnd' | 'annualSign' | 'sign'>,
  monthIndex: number, start: number, end: number) {
  const month = ptolemyMonthPlace(place.annualStart, place.annualEnd, place.annualSign, monthIndex);
  const alternateLength = 5 * day / 2;
  const windows = [];
  for (let cursor = start; cursor < end;) {
    const alternateDayIndex = Math.floor((cursor - month.start) / alternateLength);
    const alternateManuscriptDaySign = (month.sign + alternateDayIndex) % 12;
    const dayManuscriptPeriodStart = month.start + alternateDayIndex * alternateLength;
    const dayManuscriptPeriodEnd = Math.min(dayManuscriptPeriodStart + alternateLength, month.end);
    const sliceEnd = Math.min(end, dayManuscriptPeriodEnd);
    windows.push({ start: cursor, end: sliceEnd,
      dayManuscriptProfile: ptolemyTimePolicy.alternateManuscriptDay,
      dayManuscriptAgreement: alternateManuscriptDaySign === place.sign ? 'same-place' : 'different-place',
      dayManuscriptPeriodStart, dayManuscriptPeriodEnd,
      alternateManuscriptDaySign } as const);
    cursor = sliceEnd;
  }
  return windows;
}

// A declared, reviewable calendar interpretation. The book gives the units but
// not modern UTC/leap-day rules or unambiguous subperiod reset instructions.
// Thus this computes candidate timing geometry; it does not finish a source rule.
export function buildPtolemyPlaces(window: Window, birthAt: number, origins: { origin: Origin; longitude: number }[],
  period: PreviewPeriod, { annualSubperiodEvidence = false } = {}) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.start < birthAt
    || window.end <= window.start || window.end - window.start > 368 * day
    || !origins.length || new Set(origins.map(p => p.origin)).size !== origins.length
    || origins.some(p => !['ASC', 'MC', 'Sun', 'Moon', 'Fortune'].includes(p.origin)
      || !Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360)) throw new RangeError('Invalid Ptolemy place window');
  let age = new Date(window.start).getUTCFullYear() - new Date(birthAt).getUTCFullYear();
  if (birthAnniversary(birthAt, age) > window.start) age--;
  const output: PtolemyPlace[] = [];
  for (; birthAnniversary(birthAt, age) < window.end; age++) {
    const annualStart = birthAnniversary(birthAt, age), annualEnd = birthAnniversary(birthAt, age + 1);
    for (const point of origins) {
      const annualSign = (sign(point.longitude) + age) % 12;
      const common = { profile: ptolemyTimePolicy.profile, origin: point.origin, natalLongitude: point.longitude,
        annualSign, annualRuler: ptolemySignRuler(annualSign), completedYears: age, annualStart, annualEnd };
      const append = (level: Level, index: number, fullPeriodStart: number, fullPeriodEnd: number,
        more: Pick<PtolemyPlace, 'monthIndex' | 'monthSign' | 'monthlyRuler' | 'dayIndex'> = {}) => {
        const start = Math.max(window.start, fullPeriodStart), end = Math.min(window.end, fullPeriodEnd);
        if (start < end) output.push({ ...common, level, sign: index, ruler: ptolemySignRuler(index), start, end, fullPeriodStart, fullPeriodEnd, ...more });
      };
      append('year', annualSign, annualStart, annualEnd);
      if (period === 'year' && !annualSubperiodEvidence) continue;
      for (let monthIndex = Math.max(0, Math.floor((window.start - annualStart) / ptolemyMonthLength));
        annualStart + monthIndex * ptolemyMonthLength < Math.min(window.end, annualEnd); monthIndex++) {
        const { start: monthStart, end: monthEnd, sign: monthSign } = ptolemyMonthPlace(annualStart, annualEnd, annualSign, monthIndex);
        const month = { monthIndex, monthSign, monthlyRuler: ptolemySignRuler(monthSign) };
        append('month', monthSign, monthStart, monthEnd, month);
        if (period === 'month') continue;
        for (let dayIndex = Math.max(0, Math.floor((window.start - monthStart) / (7 * day / 3)));
          monthStart + dayIndex * (7 * day / 3) < Math.min(window.end, monthEnd); dayIndex++) {
          const dayStart = monthStart + dayIndex * (7 * day / 3), dayEnd = Math.min(monthEnd, dayStart + 7 * day / 3);
          const daySign = (monthSign + dayIndex) % 12;
          if (period === 'year' && ptolemySignRuler(daySign) !== 'Moon') continue;
          append('day', daySign, dayStart, dayEnd, { ...month, dayIndex });
        }
      }
    }
  }
  return output;
}

const aspectBySigns: Record<number, string> = { 0: 'conjunction', 2: 'sextile', 3: 'square', 4: 'trine', 6: 'opposition' };
export function ptolemySignAspect(first: number, second: number) {
  if (![first, second].every(value => Number.isInteger(value) && value >= 0 && value < 12)) throw new RangeError('Invalid sign aspect');
  const distance = (second - first + 12) % 12;
  return aspectBySigns[Math.min(distance, 12 - distance)];
}

function firstNatalMoonApplication(birthAt: number) {
  // Robbins I.24, note 129, records the anonymous commentary's fifteen-degree limit.
  const maximumGap = 15;
  const aspectOffsets = [0, 60, 90, 120, 180, 240, 270, 300];
  const window = { start: birthAt, end: birthAt + 2 * day };
  const latitudeSide = (body: (typeof classicalBodies)[number], at: number) =>
    Math.sign(Ecliptic(GeoVector(Body[body], new Date(at), true)).elat);
  const moonLongitude = readTransitLongitude('Moon', birthAt);
  const applications = classicalBodies.flatMap(body => {
    if (body === 'Moon') return [];
    const phase = (at: number) => normalize(readTransitLongitude('Moon', at) - readTransitLongitude(body, at));
    const initialPhase = normalize(moonLongitude - readTransitLongitude(body, birthAt));
    const candidate = aspectOffsets.map(offset => ({ offset, gap: normalize(offset - initialPhase) }))
      .find(({ gap }) => gap > 1e-7 && gap <= maximumGap);
    if (!candidate) return [];
    const hit = scanCircularRegions(window, phase, [candidate.offset], 3 * day / 24).crossings
      .find(row => row.direction === 'direct' && row.at > birthAt);
    if (!hit) return [];
    if (candidate.offset === 0 && [birthAt, hit.at].some(at => {
      const lunarSide = latitudeSide('Moon', at);
      return lunarSide === 0 || lunarSide !== latitudeSide(body, at);
    })) return [];
    return [{ body, aspect: ptolemySignAspect(0, candidate.offset / 30), gap: candidate.gap, at: hit.at }];
  }).sort((first, second) => first.at - second.at);
  const [first, second] = applications;
  if (first && (!second || second.at - first.at > ptolemyTimePolicy.rootToleranceMs)) return first;
}

type PhaseIngress = Window & { origin: Origin; level: TransitPlace['level']; natalLongitude: number;
  annualStart: number; sign: number; ruler?: Planet; transitBody: Planet; transitSign: number; aspectType: string;
  enteredDuringTimedPlace?: boolean; timedPlaceIngressAt?: number; aspectPassageIngressAt?: string };

function ptolemyLunarPhaseContacts(window: Window, places: TimedPlace[], period: PreviewPeriod, ingressContacts: PhaseIngress[]) {
  const level = period === 'year' ? 'year' : 'month';
  const candidates = places.filter(place => place.level === level);
  const passages = ingressContacts.filter(contact => isPtolemyTimeIngressBody(contact.level, contact.transitBody)
    && (contact.level === 'year' || contact.level === 'month' || period !== 'year' && contact.timedPlaceIngressAt !== undefined));
  const labels = ['new_moon', 'first_quarter', 'full_moon', 'last_quarter'] as const;
  const contacts = [];
  for (let event = SearchMoonQuarter(new Date(window.start)); event.time.date.getTime() < window.end;
    event = NextMoonQuarter(event)) {
    const at = event.time.date.getTime();
    if (at < window.start) continue;
    const moonSign = sign(readTransitLongitude('Moon', at));
    const solarSign = sign(readTransitLongitude('Sun', at));
    for (const place of candidates) {
      if (at < place.start || at >= place.end) continue;
      const monthIndex = Math.floor((at - place.annualStart) / ptolemyMonthLength);
      const month = ptolemyMonthPlace(place.annualStart, place.annualEnd, place.annualSign, monthIndex);
      const natalOriginSign = place.natalGovernors.sign;
      // IV.10 compares the time places with the natal cause, then the
      // actual phase or ingress with the time places of that same origin.
      const samePhasePassages = passages.filter(contact => contact.origin === place.origin
        && contact.natalLongitude === place.natalLongitude && contact.annualStart === place.annualStart
        && contact.start <= at && at < contact.end
        && (contact.timedPlaceIngressAt === undefined || contact.timedPlaceIngressAt <= at));
      const phaseIngressContacts = samePhasePassages.flatMap(contact => contact.timedPlaceIngressAt === undefined ? [] : [{
        level: contact.level, body: contact.transitBody, sign: contact.sign, timeRuler: contact.ruler,
        ingressAt: new Date(contact.timedPlaceIngressAt).toISOString(),
      }]);
      // Robbins IV.10 note 83 includes a planet's passage through the sign,
      // even where a new ingress did not take place inside this time division.
      const phaseCarryContacts = samePhasePassages.flatMap(contact => contact.enteredDuringTimedPlace === false ? [{
        level: contact.level, body: contact.transitBody, sign: contact.sign, timeRuler: contact.ruler,
      }] : []);
      const phaseTransitAspectContacts = samePhasePassages.flatMap(contact =>
        contact.level !== 'year' && contact.level !== 'month' || ['conjunction', 'none'].includes(contact.aspectType) ? [] : [{
          level: contact.level, body: contact.transitBody, sign: contact.transitSign,
          timeSign: contact.sign, timeRuler: contact.ruler, aspect: contact.aspectType,
          annualAspect: ptolemySignAspect(contact.transitSign, place.annualSign) ?? 'none',
          monthlyAspect: ptolemySignAspect(contact.transitSign, month.sign) ?? 'none',
          ingressAt: contact.aspectPassageIngressAt,
        }]);
      contacts.push({
        profile: ptolemyTimePolicy.lunarPhasePolicy, start: at,
        end: Math.min(at + 1_000, place.end, month.end, ...samePhasePassages.map(contact => contact.end)), origin: place.origin,
        phase: labels[event.quarter], moonSign, natalOriginSign, annualSign: place.annualSign, annualRuler: place.annualRuler,
        annualOriginAspect: place.annualOriginAspect, annualAspect: ptolemySignAspect(moonSign, place.annualSign) ?? 'none',
        monthSign: month.sign, monthlyRuler: ptolemySignRuler(month.sign),
        monthlyOriginAspect: ptolemySignAspect(month.sign, natalOriginSign) ?? 'none',
        monthlyAspect: ptolemySignAspect(moonSign, month.sign) ?? 'none',
        solarSign, solarAnnualAspect: ptolemySignAspect(solarSign, place.annualSign) ?? 'none',
        solarMonthlyAspect: ptolemySignAspect(solarSign, month.sign) ?? 'none',
        phaseIngressContacts, phaseCarryContacts, phaseTransitAspectContacts,
      });
    }
  }
  return contacts;
}

export function buildPtolemyTimes(window: Window, period: PreviewPeriod, chart: DestinyChartSnapshot | undefined,
  motion: { planet: Planet; stations: { at: number }[] }[]) {
  const birth = readProgressionBirth(chart);
  if (birth.status !== 'ready') return { status: birth.status, policy: ptolemyTimePolicy } as const;
  if (window.start < birth.birthAt) return { status: 'before_birth', policy: ptolemyTimePolicy } as const;
  const natal = chart!.western.rawResult[0];
  const natalLongitudeOf = (body: Planet) => {
    const candidates = natal.positions.filter(p => p.planet === body);
    if (candidates.length !== 1) return undefined;
    const longitude = candidates[0].longitude;
    return longitude >= 0 && longitude < 360 ? longitude : normalize(longitude);
  };
  const sun = natalLongitudeOf('Sun'), moon = natalLongitudeOf('Moon');
  if (sun === undefined || moon === undefined) return { status: 'missing_luminaries', policy: ptolemyTimePolicy } as const;
  // Solar/lunar origins do not require a made-up latitude. Invalid axes leave
  // their three origins unavailable rather than suppressing valid luminaries.
  const anglesReady = [natal.ascendant, natal.midheaven].every(value => Number.isFinite(value) && value >= 0 && value < 360);
  const origins: { origin: Origin; longitude: number }[] = [{ origin: 'Sun', longitude: sun }, { origin: 'Moon', longitude: moon },
    ...(anglesReady ? [{ origin: 'ASC' as const, longitude: natal.ascendant }, { origin: 'MC' as const, longitude: natal.midheaven },
      { origin: 'Fortune' as const, longitude: ptolemyLot(natal.ascendant, sun, moon) }] : [])];
  const frame = readWesternHouseFrame(chart);
  const sect = frame.status === 'ready' ? ptolemyNatalSect(frame) : undefined;
  const mercuryHorizon = frame.status === 'ready' && natalLongitudeOf('Mercury') !== undefined
    ? ptolemyNatalMercuryHorizon(frame) : undefined;
  const governors = new Map(origins.map(point => [point.origin, ptolemyNatalGovernors(point.longitude, sect)] as const));
  const fortuneRuler = governors.get('Fortune')?.domicileRuler;
  const fortuneRulerLongitude = fortuneRuler && natalLongitudeOf(fortuneRuler);
  const natalFortuneRulerConditions = (() => {
    if (!fortuneRuler || fortuneRulerLongitude === undefined) return;
    const natalSectOf = (body: Planet, longitude: number) =>
      body === 'Mercury' ? mercuryHorizon?.sect : ptolemyPlanetSect(body, longitude, sun);
    const rulerSect = natalSectOf(fortuneRuler, fortuneRulerLongitude);
    const ownPosition = ptolemyNatalGovernors(fortuneRulerLongitude, sect);
    const positions = classicalBodies.flatMap(body => {
      if (body === fortuneRuler) return [];
      const longitude = natalLongitudeOf(body);
      return longitude === undefined ? [] : [{ body, longitude }];
    });
    const witnesses = positions.flatMap(({ body, longitude }) => {
      const bodySign = sign(longitude);
      const aspect = ptolemySignAspect(bodySign, ownPosition.sign);
      if (!aspect) return [];
      const witnessSect = natalSectOf(body, longitude);
      const relation = !rulerSect || !witnessSect ? 'unknown' : rulerSect === witnessSect ? 'same' : 'opposite';
      return [{ body, sign: bodySign, aspect, relation }];
    });
    return { rulerSign: ownPosition.sign, rulerSect, ownPositionRulership: ptolemyNatalRulership(ownPosition, fortuneRuler),
      ownPositionFamiliarities: ptolemyNatalPlacementFamiliarities(ownPosition, fortuneRuler),
      witnessesComplete: positions.length === classicalBodies.length - 1,
      witnesses, mercuryHorizon: fortuneRuler === 'Mercury' || witnesses.some(witness => witness.body === 'Mercury')
        ? mercuryHorizon : undefined };
  })();
  // I.7 gives Mercury either sect. IV.2 compares the witness with the
  // ruler's own sect, independently of daylight at the birth instant.
  const fortuneHarmoniousWitnesses = natalFortuneRulerConditions?.witnesses.filter(({ aspect }) => aspect === 'sextile' || aspect === 'trine');
  const hasNatalFortuneSameSectHarmoniousWitness = fortuneHarmoniousWitnesses?.some(({ relation }) => relation === 'same')
    ? true : natalFortuneRulerConditions?.rulerSect && natalFortuneRulerConditions.witnessesComplete
      && fortuneHarmoniousWitnesses?.every(({ relation }) => relation !== 'unknown') ? false : undefined;
  const fortuneLuminaryContacts = fortuneRulerLongitude === undefined ? undefined
    : ([{ body: 'Sun', longitude: sun }, { body: 'Moon', longitude: moon }] as const).flatMap(({ body, longitude }) => {
      const aspect = ptolemySignAspect(sign(fortuneRulerLongitude), sign(longitude));
      return body !== fortuneRuler && aspect ? [{ body, aspect, sign: sign(longitude) }] : [];
    });
  // IV.2 identifies a natal Jupiter ray to Saturn when Saturn governs the Lot
  // of Fortune. Keep the named testimony separate from the annual timing.
  const natalFortuneSaturnJupiterWitness = (() => {
    if (fortuneRuler !== 'Saturn' || fortuneRulerLongitude === undefined) return;
    const jupiterLongitude = natalLongitudeOf('Jupiter');
    if (jupiterLongitude === undefined) return;
    const saturnSign = sign(fortuneRulerLongitude), jupiterSign = sign(jupiterLongitude);
    const aspect = ptolemySignAspect(saturnSign, jupiterSign);
    if (!aspect || aspect === 'conjunction') return;
    const application = firstNatalMoonApplication(birth.birthAt);
    return { saturnSign, jupiterSign, aspect, jupiterBicorporeal: jupiterSign % 3 === 2,
      ...(application?.body === 'Jupiter' && { lunarApplication: { aspect: application.aspect, gap: application.gap,
        exactAt: new Date(application.at).toISOString() } }) };
  })();
  const projectedPrimary = (table: PtolemyTermTable) => frame.status === 'ready' && window.end <= birthAnniversary(birth.birthAt, 360)
    ? ptolemyPrimaryDirections(frame, natal.positions, origins, table)
      .map(direction => ({ ...direction, start: instantAtArc(birth.birthAt, direction.startArc),
        end: instantAtArc(birth.birthAt, direction.endArc) }))
      .filter(row => row.start < window.end && window.start < row.end) : [];
  const primary = projectedPrimary('egyptian');
  const authorPrimary = projectedPrimary('author');
  // IV.10 compares an actual phase and planetary passages with both time
  // places. Annual requests also need the partial time rulers' own passages.
  const places = buildPtolemyPlaces(window, birth.birthAt, origins, period, { annualSubperiodEvidence: true }).flatMap<TimedPlace>(place => {
    const natalGovernors = governors.get(place.origin)!;
    const source = { ...place, natalGovernorProfile: ptolemyNatalRulerPolicy.profile, natalGovernors,
      annualOriginAspect: ptolemySignAspect(place.annualSign, natalGovernors.sign) ?? 'none',
      monthlyOriginAspect: place.monthSign === undefined ? undefined : ptolemySignAspect(place.monthSign, natalGovernors.sign) ?? 'none' };
    const slices = primary.filter(row => row.origin === place.origin && row.start < place.end && place.start < row.end);
    if (!slices.length) return [{ ...source, primaryDirectionProfile: undefined, primaryDirection: undefined }];
    return slices.map(primaryDirection => ({ ...source, start: Math.max(place.start, primaryDirection.start),
      end: Math.min(place.end, primaryDirection.end), primaryDirectionProfile: ptolemyPrimaryDirectionProfile, primaryDirection }));
  });
  const transitPlaces: TransitPlace[] = [...places];
  for (const place of places) {
    const direction = place.primaryDirection;
    if (place.level !== 'year' || !direction) continue;
    // Use one copy of the general interval per annual slice, including in month and day requests.
    transitPlaces.push({ ...place, level: 'primary', sign: direction.sign, ruler: direction.ruler, primaryDirection: direction,
      fullPeriodStart: direction.start, fullPeriodEnd: direction.end });
  }
  function transitBodies(place: TransitPlace): { body: Planet; conjunctionOnly?: true }[] {
    if (place.level === 'primary') {
      const bodies = new Set<Planet>(['Saturn', place.primaryDirection.term.ruler]);
      if (place.ruler) bodies.add(place.ruler);
      return [...bodies].map(body => ({ body, conjunctionOnly: true }));
    }
    if (place.level !== 'year') return ptolemyTimeIngressBodies[place.level].map(body => ({ body }));
    const regular = new Set<Planet>([...ptolemyTimeIngressBodies.year, place.ruler]);
    const main = place.primaryDirection?.ruler, term = place.primaryDirection?.term.ruler;
    if (main) regular.add(main);
    const entries = [...regular].map(body => ({ body }));
    return term && !regular.has(term) ? [...entries, { body: term, conjunctionOnly: true }] : entries;
  }
  const wanted = new Set<Planet>([...transitPlaces.flatMap(place => transitBodies(place).map(row => row.body)),
    ...authorPrimary.map(direction => direction.term.ruler)]);
  const signBoundaries = Array.from({ length: 12 }, (_, i) => i * 30);
  const traces = new Map([...wanted].map(body => {
    const scan = scanCircularRegions(window, at => readTransitLongitude(body, at), signBoundaries,
      westernSearchPolicy.sampleHours[body] * day / 24, motion.find(row => row.planet === body)?.stations.map(p => p.at) ?? []);
    return [body, scan] as const;
  }));
  const carryIngresses = new Map<string, { at: number; sign: number } | undefined>();
  const priorIngress = (body: Planet, timedPlaceStart: number) => {
    const key = body + ':' + timedPlaceStart;
    if (!carryIngresses.has(key)) {
      const beforeWindow = { start: timedPlaceStart, end: window.start };
      const scan = scanCircularRegions(beforeWindow, at => readTransitLongitude(body, at), signBoundaries,
        westernSearchPolicy.sampleHours[body] * day / 24, readTransitStationTimes(beforeWindow, body));
      const last = scan.crossings.at(-1);
      carryIngresses.set(key, last && { at: last.at, sign: (last.boundaryIndex + (last.direction === 'retrograde' ? 11 : 0)) % 12 });
    }
    return carryIngresses.get(key);
  };
  const contacts = transitPlaces.flatMap(place => {
    const annualDailyEvidence = period === 'year' && place.level === 'day';
    return transitBodies(place).flatMap(({ body, conjunctionOnly }) => {
      const trace = traces.get(body)!;
      const natalLongitude = natalLongitudeOf(body);
      const natalSign = natalLongitude === undefined ? undefined : sign(natalLongitude);
      const natalOriginAspect = natalSign === undefined ? undefined : ptolemySignAspect(natalSign, place.natalGovernors.sign) ?? 'none';
      // I.16 calls unconfigured signs one or five signs apart alien. Robbins's
      // whole-sign pairs in I.14–15 (notes 80 and 83) all have an even separation.
      const natalOriginSignFamiliarity = natalOriginAspect === 'none' ? 'alien' : undefined;
      const natalRulership = ptolemyNatalRulership(place.natalGovernors, body);
      const planetSect = ptolemyPlanetSect(body, natalLongitude, sun);
      const natalMercuryHorizon = body === 'Mercury' && place.level === 'month' ? mercuryHorizon : undefined;
      return trace.intervals.flatMap(interval => {
        const start = Math.max(place.start, interval.start), end = Math.min(place.end, interval.end);
        const transitSign = sign(interval.longitude), aspect = ptolemySignAspect(place.sign, transitSign);
        const manuscriptMonth = place.level === 'day' && (!aspect || aspect === 'conjunction') ? place.monthIndex : undefined;
        if (start >= end || (!aspect && manuscriptMonth === undefined)
          || ((conjunctionOnly || annualDailyEvidence) && aspect !== 'conjunction')) return [];
        const canAttachAspectPassage = aspect !== 'conjunction' && (place.level === 'year' || place.level === 'month')
          && isPtolemyTimeIngressBody(place.level, body);
        const ingressAt = trace.crossings.find(hit => hit.at === interval.start)?.at;
        const baseWindows: (Window & Partial<ReturnType<typeof dayManuscriptWindows>[number] & AnnualClockComparison>)[] =
          manuscriptMonth !== undefined ? dayManuscriptWindows(place, manuscriptMonth, start, end)
            : place.level === 'year' && body === 'Jupiter' && aspect === 'conjunction'
              ? annualClockWindows({ start, end }, birth.birthAt, place.completedYears) : [{ start, end }];
        const monthIndex = place.monthIndex;
        const windows: (typeof baseWindows[number] & Partial<SubperiodClockComparison>)[] = monthIndex !== undefined
          && (place.level === 'month' || place.level === 'day') && aspect === 'conjunction' && isPtolemyTimeIngressBody(place.level, body)
          ? baseWindows.flatMap(slice => subperiodClockWindows(slice, birth.birthAt, place.completedYears, monthIndex, place.dayIndex))
          : baseWindows;
        const sameAsPrimaryTermRuler = place.primaryDirection ? body === place.primaryDirection.term.ruler : undefined;
        const sameAsNatalMaterialSignRuler = place.origin === 'Fortune' ? body === fortuneRuler : undefined;
        return windows.flatMap(slice => {
          const dayManuscriptMoonContact = slice.dayManuscriptProfile ? transitSign === slice.alternateManuscriptDaySign : undefined;
          if (!aspect && dayManuscriptMoonContact !== true) return [];
          if (annualDailyEvidence && !dayManuscriptMoonContact) return [];
          // Read an earlier ingress within either applicable time place, then
          // test it against each reading separately. Current overlap is not an ingress.
          const manuscriptStart = dayManuscriptMoonContact ? slice.dayManuscriptPeriodStart : undefined;
          const earliestStart = Math.min(place.fullPeriodStart, manuscriptStart ?? place.fullPeriodStart);
          const carried = ingressAt === undefined && interval.start === window.start
            && (aspect === 'conjunction' || dayManuscriptMoonContact || canAttachAspectPassage) && earliestStart < window.start
            && isPtolemyTimeIngressBody(place.level, body) ? priorIngress(body, earliestStart) : undefined;
          const uncroppedIngressAt = ingressAt ?? (carried?.sign === transitSign ? carried.at : undefined);
          const enteredDuringTimedPlace = aspect === 'conjunction' && uncroppedIngressAt !== undefined
            && place.fullPeriodStart <= uncroppedIngressAt && uncroppedIngressAt < place.fullPeriodEnd;
          const manuscriptEnd = slice.dayManuscriptPeriodEnd;
          const dayManuscriptEnteredDuringTimedPlace = slice.dayManuscriptProfile ? manuscriptStart !== undefined
            && manuscriptEnd !== undefined && uncroppedIngressAt !== undefined
            && manuscriptStart <= uncroppedIngressAt && uncroppedIngressAt < manuscriptEnd : undefined;
          return [{ ...place, ...slice, transitBody: body, transitSign, aspectType: aspect ?? 'none', dayManuscriptMoonContact,
            dayManuscriptEnteredDuringTimedPlace,
            dayManuscriptIngressAt: dayManuscriptEnteredDuringTimedPlace ? uncroppedIngressAt : undefined,
            transitAnnualAspect: ptolemySignAspect(transitSign, place.annualSign) ?? 'none',
            transitMonthlyAspect: place.monthSign === undefined ? undefined : ptolemySignAspect(transitSign, place.monthSign) ?? 'none',
            transitNatalOriginAspect: place.level === 'month' ? ptolemySignAspect(transitSign, place.natalGovernors.sign) ?? 'none' : undefined,
            annualTransitNatalOriginAspect: place.level === 'year' && body === 'Jupiter'
              ? ptolemySignAspect(transitSign, place.natalGovernors.sign) ?? 'none' : undefined,
            sameAsAnnualLord: body === place.annualRuler,
            sameAsMonthlyLord: place.level === 'month' ? body === place.ruler : undefined,
            sameAsDailyLord: place.level === 'day' ? body === place.ruler : undefined,
            sameAsPrimaryDirectionRuler: place.primaryDirection?.ruler === undefined ? undefined : body === place.primaryDirection.ruler,
            sameAsPrimaryTermRuler,
            termCoRulerIngress: place.primaryDirection && (place.level === 'year' || place.level === 'primary')
              ? sameAsPrimaryTermRuler && aspect === 'conjunction' : undefined,
            natalSignAspect: natalSign === undefined ? undefined : ptolemySignAspect(natalSign, place.sign),
            sameAsNatalMaterialSignRuler,
            hasNatalFortuneSameSectHarmoniousWitness: sameAsNatalMaterialSignRuler
              ? hasNatalFortuneSameSectHarmoniousWitness : undefined,
            natalFortuneLordLuminaryContacts: sameAsNatalMaterialSignRuler ? fortuneLuminaryContacts : undefined,
            natalFortuneRulerConditions: sameAsNatalMaterialSignRuler ? natalFortuneRulerConditions : undefined,
            natalFortuneSaturnJupiterWitness: sameAsNatalMaterialSignRuler ? natalFortuneSaturnJupiterWitness : undefined,
            natalOriginAspect, natalOriginSignFamiliarity, natalTransitBodySign: natalSign, natalRulership, planetSect,
            natalAuthorTermProfile: ptolemyTimePolicy.natalAuthorTerm,
            sameAsNatalAuthorTermRuler: body === place.natalGovernors.authorTerm.ruler,
            governsNatalOrigin: natalRulership.length > 0 ? true : sect === undefined ? undefined : false,
            oppositeNatalSect: sect && planetSect ? sect !== planetSect : undefined,
            natalMercuryHorizon,
            sameNatalMercuryHorizonSect: sect && natalMercuryHorizon?.sect ? sect === natalMercuryHorizon.sect : undefined,
            enteredDuringTimedPlace: aspect === 'conjunction' ? enteredDuringTimedPlace : undefined,
            timedPlaceIngressAt: enteredDuringTimedPlace ? uncroppedIngressAt : undefined,
            aspectPassageIngressAt: canAttachAspectPassage && uncroppedIngressAt !== undefined
              && place.fullPeriodStart <= uncroppedIngressAt && uncroppedIngressAt < place.fullPeriodEnd
              ? new Date(uncroppedIngressAt).toISOString() : undefined,
            physicalIngressAt: ingressAt !== undefined && slice.start <= ingressAt && ingressAt < slice.end ? ingressAt : undefined,
            physicalIngressSign: transitSign }];
        });
      });
    });
  });
  const lunarPhaseContacts = ptolemyLunarPhaseContacts(window, places, period, contacts);
  const annualPlaces = places.filter(place => place.level === 'year');
  const authorTermContacts = authorPrimary.flatMap(direction => {
    const body = direction.term.ruler;
    const trace = traces.get(body)!;
    return annualPlaces.filter(place => place.origin === direction.origin && place.start < direction.end && direction.start < place.end)
      .flatMap(place => trace.intervals.flatMap(interval => {
        const transitSign = sign(interval.longitude);
        const start = Math.max(place.start, direction.start, interval.start);
        const end = Math.min(place.end, direction.end, interval.end);
        if (start >= end) return [];
        const crossing = trace.crossings.find(hit => hit.at === interval.start);
        const physicalIngressAt = crossing && start <= crossing.at && crossing.at < end ? crossing.at : undefined;
        const egyptianTermRuler = place.primaryDirection?.term.ruler;
        const termTableAgreement = egyptianTermRuler === undefined ? 'egyptian-unavailable'
          : egyptianTermRuler === body ? 'same-ruler' : 'different-ruler';
        const authorNatalTermRuler = place.natalGovernors.authorTerm.ruler;
        return ([['primary', direction.sign], ['year', place.annualSign]] as const).flatMap(([level, timedSign]) =>
          timedSign !== transitSign ? [] : [{ start, end, profile: ptolemyTimePolicy.authorTermIngress, origin: direction.origin,
            level, sign: timedSign, transitSign, transitBody: body, term: direction.term, primarySign: direction.sign,
            primaryRuler: direction.ruler, egyptianTermRuler, termTableAgreement,
            termTableComparisonProfile: ptolemyTimePolicy.authorTermComparison,
            authorNatalTermRuler, sameAsNatalAuthorTermRuler: body === authorNatalTermRuler,
            natalFortuneRulerConditions: direction.origin === 'Fortune' && body === fortuneRuler ? natalFortuneRulerConditions : undefined,
            natalFortuneSaturnJupiterWitness: direction.origin === 'Fortune' && body === 'Saturn'
              ? natalFortuneSaturnJupiterWitness : undefined, physicalIngressAt }]);
      }));
  });
  return { status: 'ready', policy: ptolemyTimePolicy, originCount: origins.length,
    places: period === 'year' ? annualPlaces : places,
    // Annual requests keep only a partial time ruler's own passage. The daily
    // path already requires actual lunar presence and both clocks in Cancer.
    contacts: period === 'year' ? contacts.filter(contact => contact.level !== 'month'
      || contact.sameAsMonthlyLord && contact.aspectType === 'conjunction') : contacts,
    authorTermContacts, lunarPhaseContacts } as const;
}
