import type { FortuneFactRecord } from '../model/fortune-facts';
import { readTransitLongitude, type Planet } from './solar-transits';
import { sepharialMundaneAngleArcs, sepharialMundaneConjunctionArc,
  sepharialNatalEquatorialPosition, sepharialSphericalPrimaryProfile } from './sepharial-primary-directions';
import { anglesFromFrame, eclipticEquator, scanCircularRegions, westernHousePolicy, zodiacalHouse,
  type buildWesternSourceHouses } from './western-houses';
import { progressionEpoch, progressionRealTime, readProgressionPosition } from './western-progressions';
import type { buildLunationWindows } from './western-time-links';

const day = 86_400_000, rad = Math.PI / 180;
const normalize = (value: number) => (value % 360 + 360) % 360;
const distance = (a: number, b: number) => Math.abs(normalize(a - b + 180) - 180);
const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const satisfies readonly Planet[];
const angles = ['ASC', 'MC'] as const;
const majorTransitOrder = ['Neptune', 'Uranus', 'Saturn', 'Jupiter', 'Mars'] as const;
const majorTransits = new Set<unknown>(majorTransitOrder);
const natalSignificators = new Set<unknown>(['Sun', 'Moon', ...angles]);
const aspectOffsets = [
  { aspect: 'conjunction', offset: 0 }, { aspect: 'semisquare', offset: 45 }, { aspect: 'sextile', offset: 60 },
  { aspect: 'square', offset: 90 }, { aspect: 'trine', offset: 120 }, { aspect: 'sesquiquadrate', offset: 135 },
  { aspect: 'opposition', offset: 180 },
] as const;
const lunationAspects = aspectOffsets.filter(row => ['conjunction', 'sextile', 'trine'].includes(row.aspect));

export const sepharialLunationPolicy = {
  profile: 'sepharial-lunation-hierarchy-v1', zodiac: 'tropical',
  order: ['primary', 'transit', 'lunar_direction', 'lunation'],
  angularMeasure: 'forward-ecliptic-midheaven-arc-one-degree-per-year',
  sphericalPrimaryProfile: sepharialSphericalPrimaryProfile,
  lunarClock: 'sepharial-1914-january-noon-monthly-motion-v1',
  annualProgressedLunarDirectionProfile: 'sepharial-1914-calendar-year-progressed-planet-v1',
  newMoonSignificatorProfile: 'sepharial-1914-new-moon-at-natal-significators-v1',
  lunarDayInterpolation: 'utc-month-uniform-clock-candidate',
  natalContact: 'exact-conjunction-with-seconds-precision-tolerance',
  stationContact: 'actual-major-planet-station-exactly-on-natal-significator',
  exactTolerance: westernHousePolicy.sepharialLunationTolerance,
  duplicateLunationContactMs: 5_000,
} as const;

type SourceHouses = Extract<ReturnType<typeof buildWesternSourceHouses>, { frame: unknown }>;
type Frame = SourceHouses['frame'];
type Lunation = ReturnType<typeof buildLunationWindows>[number];
type Target = { body: (typeof planets)[number] | (typeof angles)[number]; longitude: number };
type Window = { start: number; end: number };

function angularDirectionNature(body: Target['body'], aspect: typeof aspectOffsets[number]['aspect']) {
  if (aspect === 'sextile' || aspect === 'trine') return 'favourable';
  if (aspect === 'opposition' || aspect === 'square' || aspect === 'semisquare' || aspect === 'sesquiquadrate') return 'adverse';
  if (aspect === 'conjunction') {
    if (body === 'Jupiter' || body === 'Venus' || body === 'Sun' || body === 'Moon') return 'favourable';
    if (body === 'Neptune' || body === 'Uranus' || body === 'Saturn' || body === 'Mars') return 'adverse';
  }
  // The source treats Mercury's conjunction as dependent on natal context.
  return 'unclassified';
}

function mercuryNatalCondition(targets: Target[]) {
  const mercury = targets.find(row => row.body === 'Mercury')!;
  // The author's natal aspect table allows seven degrees for luminaries and five for planets.
  const contacts = targets.filter(row => row.body !== 'Mercury' && row.body !== 'ASC' && row.body !== 'MC')
    .flatMap(({ body, longitude }) => {
      const separation = distance(mercury.longitude, longitude);
      const orb = body === 'Sun' || body === 'Moon' ? 7 : 5;
      return aspectOffsets.flatMap(({ aspect, offset }) => {
        const difference = Math.abs(separation - offset);
        return difference > orb ? [] : [{ body, aspect, difference, orb, nature: angularDirectionNature(body, aspect) }];
      });
    }).sort((first, second) => first.difference - second.difference);
  const nearest = contacts.filter(contact => contact.difference === contacts[0]?.difference);
  const sign = Math.floor(mercury.longitude / 30);
  const signCondition = [2, 5].includes(sign) ? 'domicile' : [8, 11].includes(sign) ? 'opposite' : 'other';
  const nature = nearest[0] && nearest.every(contact => contact.nature === nearest[0].nature) ? nearest[0].nature : 'unclassified';
  const agreesWithSign = (signCondition !== 'domicile' || nature === 'favourable')
    && (signCondition !== 'opposite' || nature === 'adverse');
  return { sign, signCondition, nearest, nature: agreesWithSign ? nature : 'unclassified' };
}

function aspectPoints(longitude: number) {
  return aspectOffsets.flatMap(({ aspect, offset }) => (offset === 0 || offset === 180 ? [offset] : [offset, -offset])
    .map(delta => ({ aspect, longitude: normalize(longitude + delta) })));
}

// The source reads the ecliptic MC at which an ecliptic place rises from
// a table for the birthplace latitude. Invert the same horizon geometry.
export function sepharialMidheavenAtRising(longitude: number, latitude: number, obliquity: number) {
  const { rightAscension, declination } = eclipticEquator(longitude, obliquity);
  const hourAngleCosine = -Math.tan(latitude * rad) * Math.tan(declination * rad);
  if (Math.abs(hourAngleCosine) >= 1) return undefined;
  return anglesFromFrame(rightAscension - Math.acos(hourAngleCosine) / rad, latitude, obliquity).midheaven;
}

function angularDirections(window: Window, frame: Frame, targets: Target[], cusps: number[]) {
  const { birthAt, latitude, obliquity } = frame;
  const mercury = mercuryNatalCondition(targets);
  return targets.filter(target => target.body !== 'ASC' && target.body !== 'MC').flatMap(target =>
    aspectPoints(target.longitude).flatMap(place => angles.flatMap(angle => {
      const mc = angle === 'MC' ? place.longitude : sepharialMidheavenAtRising(place.longitude, latitude, obliquity);
      if (mc === undefined) return [];
      const arc = normalize(mc - cusps[9]);
      const at = Math.round(progressionRealTime(birthAt, birthAt + arc * day));
      const mercuryCondition = target.body === 'Mercury' && place.aspect === 'conjunction' ? mercury : undefined;
      return window.start <= at && at < window.end ? [{ at, angle, body: target.body, aspect: place.aspect,
        natalHouse: zodiacalHouse(target.longitude, cusps), arc,
        nature: mercuryCondition?.nature ?? angularDirectionNature(target.body, place.aspect),
        ...(mercuryCondition && { mercuryCondition }) }] : [];
    }))).sort((a, b) => a.at - b.at);
}

function sphericalDirections(window: Window, frame: Frame) {
  const { birthAt } = frame;
  const positions = new Map(planets.map(body => [body, sepharialNatalEquatorialPosition(body, birthAt)]));
  const luminaries = new Set(['Sun', 'Moon']);
  const timed = planets.flatMap(body => {
    const position = positions.get(body)!;
    const contacts = [...sepharialMundaneAngleArcs(frame, position), ...planets.flatMap(indicator => {
      if (body === indicator || !luminaries.has(body) && !luminaries.has(indicator)) return [];
      const arc = sepharialMundaneConjunctionArc(frame, position, positions.get(indicator)!);
      return arc === undefined ? [] : [{ indicator, aspect: 'conjunction', sphericalPoint: 'luminary-semiarc', arc } as const];
    })];
    return contacts.flatMap(({ arc, ...contact }) => {
      const arcDegrees = Math.abs(arc);
      const at = Math.round(progressionRealTime(birthAt, birthAt + arcDegrees * day));
      return window.start <= at && at < window.end ? [{ ...contact, body, at, arcDegrees,
        motion: arc < 0 ? 'converse' : 'direct' } as const] : [];
    });
  });
  return timed.sort((first, second) => first.at - second.at);
}

function exactSolarContacts(window: Window, birthAt: number, target: Target) {
  const places = aspectPoints(target.longitude);
  const read = (at: number) => readProgressionPosition('Sun', progressionEpoch(birthAt, at), birthAt).longitude;
  return scanCircularRegions(window, read, places.map(place => place.longitude), 2 * day).crossings
    .map(hit => ({ at: hit.at, aspect: places[hit.boundaryIndex].aspect }));
}

export function buildSepharialLunarYearTable(birthAt: number, year: number) {
  const birth = new Date(birthAt);
  const civilMonths = (year - birth.getUTCFullYear()) * 12 - birth.getUTCMonth();
  // IV.3 borrows 30 days in the printed age subtraction: the calendar
  // month here equals two ephemeris hours, or thirty four-minute days.
  const symbolicDay = 4 * 60_000;
  const epochAt = birthAt + civilMonths * (day / 12) + (1 - birth.getUTCDate()) * symbolicDay;
  const precedingNoon = Math.floor((epochAt - day / 2) / day) * day + day / 2;
  const longitudeAt = (at: number) => readProgressionPosition('Moon', at, birthAt).longitude;
  const januaryLongitude = longitudeAt(epochAt);
  // The ephemeris in II.1 lists Greenwich noon. IV.3 divides this
  // daily travel by twelve and uses one rounded arcminute rate all year.
  const dailyMotion = normalize(longitudeAt(precedingNoon + day) - longitudeAt(precedingNoon));
  const monthlyMotion = Math.round(dailyMotion * 60 / 12) / 60;
  return { epochAt, precedingNoon, januaryLongitude, monthlyMotion };
}

function lunarTableMonths(window: Window, birthAt: number) {
  const startDate = new Date(window.start), endDate = new Date(window.end - 1);
  const birthYear = new Date(birthAt).getUTCFullYear();
  const months = [];
  for (let year = startDate.getUTCFullYear(); year <= endDate.getUTCFullYear(); year++) {
    const { januaryLongitude, monthlyMotion } = buildSepharialLunarYearTable(birthAt, year);
    const first = year === startDate.getUTCFullYear() ? startDate.getUTCMonth() : 0;
    const last = year === endDate.getUTCFullYear() ? endDate.getUTCMonth() : 11;
    for (let month = first; month <= last; month++) months.push({
      start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1),
      longitude: normalize(januaryLongitude + month * monthlyMotion), monthlyMotion,
      // IV.2 takes 46 full ephemeris days for 1911 minus 1865. IV.3
      // uses this annual chart's P positions alongside the different Moon table.
      annualEphemerisAt: birthAt + (year - birthYear) * day,
    });
  }
  return months;
}

type LunarTableMonth = ReturnType<typeof lunarTableMonths>[number];

function lunarTableContacts(window: Window, month: LunarTableMonth, places: ReturnType<typeof aspectPoints>) {
  return places.flatMap(({ aspect, longitude }) => {
    const arc = normalize(longitude - month.longitude);
    if (arc >= month.monthlyMotion) return [];
    // Each annual table resets in January; never interpolate from December into that reset.
    const at = Math.round(month.start + arc / month.monthlyMotion * (month.end - month.start));
    return window.start <= at && at < window.end && at < month.end ? [{ at, aspect }] : [];
  });
}

function lunarDirectionsWithPrimaryContext(window: Window, months: ReturnType<typeof lunarTableMonths>, target: Target,
  primaryDirections: (ReturnType<typeof angularDirections>[number] & { sameNatalIndicator: boolean })[],
  targets: Target[]) {
  const sameIndicator = primaryDirections.filter(direction => direction.sameNatalIndicator);
  const primaryNature = sameIndicator[0]?.nature;
  const agreedPrimaryNature = primaryNature !== undefined && primaryNature !== 'unclassified'
    && sameIndicator.every(direction => direction.nature === primaryNature) ? primaryNature : undefined;
  const places = aspectPoints(target.longitude);
  const contacts = months.flatMap(month => lunarTableContacts(window, month, places))
    .sort((first, second) => first.at - second.at);
  return contacts.map(contact => {
    const nature = target.body === 'Mercury' && contact.aspect === 'conjunction'
      ? mercuryNatalCondition(targets).nature : angularDirectionNature(target.body, contact.aspect);
    if (!agreedPrimaryNature || nature === 'unclassified') return { ...contact, nature };
    // Compare exact candidates within the lunar fragment, without assigning a duration to either direction.
    const primaryRelation = nature === agreedPrimaryNature ? 'reinforcing'
      : agreedPrimaryNature === 'favourable' ? 'brief_disturbance' : 'temporary_relief';
    return { ...contact, nature, primaryRelation };
  });
}

function annualProgressedLunarDirections(window: Window, months: LunarTableMonth[], target: Target, birthAt: number) {
  const { body } = target;
  // The printed P column uses other planets. The Moon is already the moving point of this table.
  if (body === 'ASC' || body === 'MC' || body === 'Moon') return [];
  return months.flatMap(month => {
    const { annualEphemerisAt } = month;
    const annualLongitude = readProgressionPosition(body, annualEphemerisAt, birthAt).longitude;
    return lunarTableContacts(window, month, aspectPoints(annualLongitude))
      .map(contact => ({ ...contact, annualEphemerisAt, annualLongitude }));
  }).sort((first, second) => first.at - second.at);
}

export function buildSepharialLunationContexts(lunations: Lunation[], houses: SourceHouses, facts: FortuneFactRecord[]) {
  if (houses.placidus.status !== 'ready' || !lunations.length) return [];
  const { frame } = houses, { birthAt } = frame, { cusps } = houses.placidus;
  const targets: Target[] = [
    ...planets.map(body => ({ body, longitude: readProgressionPosition(body, birthAt, birthAt).longitude })),
    { body: 'ASC', longitude: cusps[0] }, { body: 'MC', longitude: cusps[9] },
  ];
  const significators = targets.filter(target => natalSignificators.has(target.body));
  const transits = facts.flatMap(fact => {
    const { natalTargetId, transitBody, transitMotion, natalLongitude, aspectType } = fact.normalizedPayload as Record<string, unknown>;
    if (fact.method !== 'western' || fact.scope !== 'transit' || fact.factType !== 'aspect_exact' || fact.completeness !== 'complete'
      || aspectType !== 'conjunction' || !fact.exactInstant || typeof natalLongitude !== 'number'
      || !planets.some(body => body === transitBody) || typeof natalTargetId !== 'string') return [];
    return [{ at: Date.parse(fact.exactInstant), body: String(transitBody), target: natalTargetId, natalLongitude,
      motion: transitMotion, sourceFactIds: fact.sourceFactIds }];
  });
  const stations = facts.flatMap(fact => {
    const { natalTargetId, transitBody, natalLongitude, stationLongitude, directionAfter, exactConjunction } =
      fact.normalizedPayload as Record<string, unknown>;
    if (fact.method !== 'western' || fact.scope !== 'transit' || fact.factType !== 'station_natal_contact'
      || fact.completeness !== 'complete' || !fact.exactInstant || exactConjunction !== true
      || !majorTransits.has(transitBody) || !natalSignificators.has(natalTargetId)
      || typeof stationLongitude !== 'number' || typeof natalLongitude !== 'number'
      || (directionAfter !== 'direct' && directionAfter !== 'retrograde')) return [];
    const target = targets.find(row => row.body === natalTargetId);
    if (!target || !(distance(stationLongitude, target.longitude) <= 0.000001
      && distance(natalLongitude, target.longitude) <= 0.000001)) return [];
    return [{ at: Date.parse(fact.exactInstant), body: String(transitBody), target: target.body,
      directionAfter, sourceFactIds: fact.sourceFactIds }];
  });
  const natalMoon = targets.find(target => target.body === 'Moon')!;
  // The 1905 case also checks a major planet stationary opposite the natal Moon.
  const moonOppositionStations = facts.flatMap(fact => {
    const body = fact.subjectIds[0];
    if (fact.method !== 'western' || fact.scope !== 'transit' || fact.factType !== 'station'
      || fact.completeness !== 'complete' || fact.sourceEngine !== 'astronomy-engine'
      || !fact.exactInstant || !majorTransits.has(body)) return [];
    const { longitude, directionAfter } = fact.normalizedPayload as Record<string, unknown>;
    if (typeof longitude !== 'number' || !Number.isFinite(longitude)
      || Math.abs(distance(longitude, natalMoon.longitude) - 180) > 0.000001
      || (directionAfter !== 'direct' && directionAfter !== 'retrograde')) return [];
    return [{ at: Date.parse(fact.exactInstant), body, target: natalMoon.body, directionAfter,
      aspect: 'opposition' as const, sourceFactIds: fact.sourceFactIds }];
  });
  return lunations.flatMap(lunation => {
    const inWindow = { start: lunation.start, end: lunation.end };
    const anchors = targets.flatMap(target => {
      const separation = distance(lunation.longitude, target.longitude);
      const contact = lunationAspects.find(row => (row.aspect === 'conjunction' || (target.body !== 'ASC' && target.body !== 'MC'))
        && Math.abs(separation - row.offset) <= sepharialLunationPolicy.exactTolerance);
      return contact ? [{ target, separation, aspect: contact.aspect, deviation: Math.abs(separation - contact.offset) }] : [];
    });
    const primaryDirections = anchors.length ? angularDirections(inWindow, frame, targets, cusps) : [];
    const sphericalPrimaryDirections = anchors.length ? sphericalDirections(inWindow, frame) : [];
    const lunarMonths = anchors.length ? lunarTableMonths(inWindow, birthAt) : [];
    // The 1914 manual names the natal Ascendant, Midheaven and both luminaries
    // separately from the natal position reached by the Sun–Moon conjunction.
    const newMoonSignificatorContacts = planets.filter(body => body !== 'Sun' && body !== 'Moon').flatMap(body => {
      const longitude = readTransitLongitude(body, lunation.newMoonAt);
      return significators.flatMap(({ body: natalTarget, longitude: natalLongitude }) => {
        const separation = distance(longitude, natalLongitude);
        const contact = aspectOffsets.find(row => Math.abs(separation - row.offset) <= sepharialLunationPolicy.exactTolerance);
        return contact ? [{ body, natalTarget, aspect: contact.aspect, longitude, natalLongitude, separation,
          deviation: Math.abs(separation - contact.offset) }] : [];
      });
    });
    // The 1914 manual reads the planets at the lunation. Separate the
    // conjunction and aspect classes on pp. 31–32 within each significator area.
    const solarMeridianNatures = { conjunction: new Set<string>(), aspect: new Set<string>() };
    const lunarHorizonNatures = { conjunction: new Set<string>(), aspect: new Set<string>() };
    for (const contact of newMoonSignificatorContacts) {
      if (contact.body === 'Mercury') continue;
      const area = contact.natalTarget === 'Sun' || contact.natalTarget === 'MC' ? solarMeridianNatures : lunarHorizonNatures;
      const natures = contact.aspect === 'conjunction' ? area.conjunction : area.aspect;
      natures.add(angularDirectionNature(contact.body, contact.aspect));
    }
    const base = { ...lunation, profile: sepharialLunationPolicy.profile, order: sepharialLunationPolicy.order,
      exactTolerance: sepharialLunationPolicy.exactTolerance, lunarClock: sepharialLunationPolicy.lunarClock,
      lunarDayInterpolation: sepharialLunationPolicy.lunarDayInterpolation,
      annualProgressedLunarDirectionProfile: sepharialLunationPolicy.annualProgressedLunarDirectionProfile,
      sphericalPrimaryProfile: sepharialLunationPolicy.sphericalPrimaryProfile,
      newMoonSignificatorProfile: sepharialLunationPolicy.newMoonSignificatorProfile,
      hasExactNewMoonSignificatorContact: newMoonSignificatorContacts.length > 0, newMoonSignificatorContacts,
      newMoonSolarMeridianBeneficConjunction: solarMeridianNatures.conjunction.has('favourable'),
      newMoonLunarHorizonBeneficConjunction: lunarHorizonNatures.conjunction.has('favourable'),
      newMoonSolarMeridianAdverseConjunction: solarMeridianNatures.conjunction.has('adverse'),
      newMoonLunarHorizonAdverseConjunction: lunarHorizonNatures.conjunction.has('adverse'),
      newMoonSolarMeridianFavourableAspect: solarMeridianNatures.aspect.has('favourable'),
      newMoonLunarHorizonFavourableAspect: lunarHorizonNatures.aspect.has('favourable'),
      newMoonSolarMeridianAdverseAspect: solarMeridianNatures.aspect.has('adverse'),
      newMoonLunarHorizonAdverseAspect: lunarHorizonNatures.aspect.has('adverse') };
    return (anchors.length ? anchors : [undefined]).map(contact => {
      const target = contact?.target;
      const passing = target ? transits.filter(transit => transit.target === target.body && inWindow.start <= transit.at
        && transit.at < inWindow.end && distance(transit.natalLongitude, target.longitude) <= sepharialLunationPolicy.exactTolerance
        // The conjunction that forms the lunation is already recorded at the lunation layer.
        && !((transit.body === 'Sun' || transit.body === 'Moon')
          && Math.abs(transit.at - lunation.newMoonAt) <= sepharialLunationPolicy.duplicateLunationContactMs)) : [];
      const stationary = target ? [...stations, ...moonOppositionStations]
        .filter(station => inWindow.start <= station.at && station.at < inWindow.end) : [];
      const primary = primaryDirections.map(direction => ({ ...direction,
        sameNatalIndicator: direction.body === target?.body || direction.angle === target?.body }));
      const majorPasses = new Set(passing.map(transit => transit.body));
      const comparedMajorTransits = majorTransitOrder.filter(body => majorPasses.has(body));
      return { ...base, natalTarget: target?.body, natalLongitude: target?.longitude, separation: contact?.separation,
        exactNatalContact: contact?.aspect === 'conjunction', natalLunationAspect: contact?.aspect,
        exactNatalSupportAspect: contact?.aspect === 'sextile' || contact?.aspect === 'trine',
        natalLunationDeviation: contact?.deviation,
        natalHouse: target ? zodiacalHouse(target.longitude, cusps) : undefined,
        lunarDirections: target ? lunarDirectionsWithPrimaryContext(inWindow, lunarMonths, target, primary, targets) : [],
        annualProgressedLunarDirections: target ? annualProgressedLunarDirections(inWindow, lunarMonths, target, birthAt) : [],
        solarDirections: !target || target.body === 'ASC' || target.body === 'MC' ? [] : exactSolarContacts(inWindow, birthAt, target),
        transits: passing.map(({ at, body, motion }) => ({ at, body, motion,
          majorRetrograde: majorTransits.has(body) && motion === 'retrograde' })),
        majorTransitPrecedence: comparedMajorTransits.length > 1 ? comparedMajorTransits : undefined,
        stationaryTransits: stationary.map(({ sourceFactIds: _ids, ...station }) => ({
          ...station, sameNatalIndicator: station.target === target?.body,
        })),
        primaryDirections: primary,
        sphericalPrimaryDirections: sphericalPrimaryDirections.map(direction => ({ ...direction,
          sameNatalIndicator: direction.body === target?.body || direction.indicator === target?.body })),
        sourceFactIds: [...new Set([...passing, ...stationary].flatMap(transit => transit.sourceFactIds))] };
    });
  });
}
