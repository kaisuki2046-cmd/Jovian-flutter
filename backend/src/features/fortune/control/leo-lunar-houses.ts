import { calculateHouseCusps, progressedHouseFrame, scanProgressedMoonHouses, zodiacalHouse,
  type buildWesternSourceHouses } from './western-houses';
import { leoNatalBodies, readLeoAppendixDate, readLeoMovingPosition, type buildLeoSourceContext, type GeometricBand } from './leo-source-context';
import { leoLunarNature, leoLunarConditionPolicy } from './leo-lunar-conditions';
import { classifyLeoTopicDirections, describeLeoDirection, summarizeLeoDirectionNatures } from './leo-direction-support';
import { isLeoNatalAffliction, isLeoNatalSquareOrOpposition, leoNatalAspectPolicy, leoNatalFinancialTargetRoles,
  readLeoNatalAspectContacts, readLeoNatalAspects, readLeoNatalFinancialAnchors, readLeoNatalFinancialTestimonies } from './leo-natal-aspects';
import { leoRulershipPolicy, readLeoSignRuler } from './leo-rulership';
import { progressedAspects, progressionEpoch, progressionPolicy, progressionRealTime } from './western-progressions';

type Window = { start: number; end: number };
type HouseBand = Window & { house: number; enteredThroughAscendant?: boolean };
type AspectBand = Pick<GeometricBand, 'start' | 'end' | 'progressedBody' | 'natalTargetId' | 'aspectType'
  | 'coordinate' | 'allowedOrb' | 'exactTimes' | 'targetKind'>;
type IndexedBand = AspectBand & { sourceBandIndex: number };
type NatalBody = { body: string; longitude: number; declination: number; sign: number; house?: number };
type Natal = { bodies: NatalBody[]; dayChart?: boolean };
const day = 86_400_000;
const natalAspectHouses = [4, 6, 7, 8, 9, 12];
const natalMoonDignities: Partial<Record<number, string>> = { 1: 'exaltation', 3: 'domicile', 7: 'fall', 9: 'detriment' };
export const leoLunarHousePolicy = {
  profile: 'leo-lunar-house-context-v2', sourceProfile: 'leo-1906-source-context-v1',
  houseProfile: 'leo-original-natal', houseSystem: 'placidus', zodiac: 'tropical',
  annualHouseProfile: 'leo-1906-annual-progressed-house-v1',
  annualFrame: 'chapter-vii-birth-clock-cusps-by-symbolic-day-utc-anniversaries',
  ascendantCrossingProfile: 'leo-lunar-ascendant-crossing-v1',
  ninthRulerProfile: 'leo-lunar-ninth-rulers-by-chart-v1',
  monthlyAspectFrame: 'leo-1906-lunar-exact-radix-and-annual-cusps-v1',
  naturalCorrespondence: 'house-number-to-zodiac-sign-not-actual-cusp-sign',
  simultaneity: 'all-active-source-aspects-at-each-half-open-intersection',
  significance: 'unresolved-no-count-threshold-no-good-bad-score-no-same-nature-inference',
} as const;

type AnnualFrame = { annualStart: number; annualEnd: number };
export type LeoAnnualCusps = AnnualFrame & { cusps: readonly number[] };
const separation = (first: NatalBody, second: NatalBody) => ({
  longitudeSeparation: Math.abs(((second.longitude - first.longitude) % 360 + 540) % 360 - 180),
  absoluteDeclinationDifference: Math.abs(Math.abs(second.declination) - Math.abs(first.declination)),
});

// Long journeys are named in these passages. The ordinary travel topic
// also includes short trips, so only use the explicit long-distance subset.
function readVoyageDirections(bands: IndexedBand[], onlyAdverseNatalMoon: boolean) {
  return bands.flatMap<ReturnType<typeof describeLeoDirection> & {
    sourceBandIndex: number; nature: 'favourable' | 'adverse'; passage: string;
  }>(band => {
    const { sourceBandIndex, progressedBody, natalTargetId, aspectType } = band;
    const targetKind = band.targetKind ?? 'natal';
    if (aspectType === 'sextile' && progressedBody === 'Sun' && natalTargetId === 'Uranus') {
      return [{ ...describeLeoDirection(band), sourceBandIndex, nature: 'favourable', passage: 'p280' }];
    }
    if (targetKind !== 'natal') return [];
    if (aspectType === 'sextile' && progressedBody === 'Mercury' && natalTargetId === 'Saturn') {
      return [{ ...describeLeoDirection(band), sourceBandIndex, nature: 'favourable', passage: 'p110' }];
    }
    if (onlyAdverseNatalMoon && aspectType === 'square' && progressedBody === 'Mars' && natalTargetId === 'Jupiter') {
      return [{ ...describeLeoDirection(band), sourceBandIndex, nature: 'adverse', passage: 'p041' }];
    }
    return [];
  });
}

// The source distinguishes a house's natural zodiacal correspondence from the
// sign actually on its cusp. Keep both, and never turn an occupancy count into
// the source's qualitative "prominence" or a person's capacity to respond.
export function splitLeoLunarHouses(window: Window, houses: HouseBand[], aspects: AspectBand[], natal: Natal,
  cusps: number[], annual?: AnnualFrame, ninthFrames: readonly LeoAnnualCusps[] = []) {
  if (!(window.start < window.end) || cusps.length !== 12 || !cusps.every(Number.isFinite)
    || houses.some(h => !Number.isInteger(h.house) || h.house < 1 || h.house > 12 || !(h.start < h.end))
    || aspects.some(a => !(a.start < a.end) || !Number.isFinite(a.allowedOrb) || a.allowedOrb <= 0)) throw new RangeError('Invalid lunar house context');
  const mercury = natal.bodies.find(body => body.body === 'Mercury');
  const mercurySeparations = mercury ? natal.bodies.filter(body => body !== mercury).map(body => ({ body: body.body,
    ...separation(mercury, body) })) : undefined;
  const needsNatalAspects = houses.some(house => house.house === 3 || !annual && natalAspectHouses.includes(house.house));
  const fullNatalGeometry = natal.bodies.length === leoNatalBodies.length
    && leoNatalBodies.every(name => natal.bodies.some(body => body.body === name))
    && natal.bodies.every(body => Number.isFinite(body.longitude) && body.longitude >= 0 && body.longitude < 360
      && Number.isFinite(body.declination) && Math.abs(body.declination) <= 90);
  // Leo and Green name these actual birth houses for writing or imagination.
  const literaryPlacements = !annual && fullNatalGeometry
    ? natal.bodies.flatMap(({ body, house }) =>
      (body === 'Mercury' && (house === 3 || house === 9)) || (body === 'Neptune' && house === 3) ? [{ body, house }] : [])
    : undefined;
  const secondNatal = !annual && fullNatalGeometry && natal.bodies.every(body => body.house !== undefined)
    && houses.some(house => house.house === 2) ? readLeoNatalFinancialAnchors(natal.bodies, cusps) : undefined;
  const secondTestimonies = secondNatal && readLeoNatalFinancialTestimonies(secondNatal);
  const natalAspects = needsNatalAspects && fullNatalGeometry ? readLeoNatalAspectContacts(natal.bodies) : undefined;
  const afflictions = natalAspects?.filter(isLeoNatalAffliction);
  const afflictionsFor = (body: string) => afflictions?.filter(aspect => aspect.first === body || aspect.second === body);
  const supportFor = (body: string) => natalAspects?.filter(row =>
    (row.first === body || row.second === body) && (row.aspect === 'sextile' || row.aspect === 'trine'));
  const domesticPlacements = !annual && afflictions && natal.bodies.filter(({ body, house }) =>
    house === 4 && (body === 'Mercury' || body === 'Uranus' || body === 'Moon' && afflictionsFor('Moon')?.length === 0))
    .map(({ body, house }) => ({ body, house }));
  const natalMoon = natal.bodies.find(body => body.body === 'Moon');
  const sixthServicePlacements = !annual && natalAspects ? natal.bodies.filter(body => body.house === 6).flatMap(({ body }) => {
    const support = supportFor(body) ?? [], contrary = afflictionsFor(body) ?? [];
    const qualifies = body === 'Moon' && contrary.length === 0
      || (body === 'Mercury' || body === 'Saturn') && support.length > 0;
    return qualifies ? [{ body, house: 6, support, afflictions: contrary }] : [];
  }) : undefined;
  const twelfthPrivatePlacements = !annual && natalAspects ? natal.bodies.filter(body => body.house === 12).flatMap(({ body }) => {
    const support = supportFor(body) ?? [], contrary = afflictionsFor(body) ?? [];
    const qualifies = ['Sun', 'Moon', 'Jupiter'].includes(body) ? contrary.length === 0 : body === 'Uranus' && support.length > 0;
    return qualifies ? [{ body, house: 12, support, afflictions: contrary }] : [];
  }) : undefined;
  // Leo and Green tie an aspected natal Moon in the actual eighth house
  // to legacy and resources shared with a partner.
  const eighthNatalFinance = !annual && natalAspects && (natalMoon?.house === 8 ? natalAspects.flatMap(row => {
    const other = row.first === 'Moon' ? row.second : row.second === 'Moon' ? row.first : undefined;
    if (!other) return [];
    const supports = ['Mars', 'Venus', 'Jupiter'].includes(other) && ['sextile', 'trine'].includes(row.aspect);
    const nature = supports ? 'favourable' : isLeoNatalAffliction(row) ? 'adverse' : undefined;
    return nature ? [{ ...row, nature }] : [];
  }) : []);
  // The occupation chapter names these two distinct placement testimonies.
  const careerPlacements = !annual && fullNatalGeometry && houses.some(house => house.house === 10)
    ? [[1, 10], [10, 1]].flatMap(([ruledHouse, house]) => {
      const ruler = readLeoSignRuler(Math.floor(cusps[ruledHouse - 1] / 30));
      return ruler && natal.bodies.some(body => body.body === ruler && body.house === house) ? [{ ruler, ruledHouse, house }] : [];
    }) : undefined;
  const ninthLuminaries = natal.bodies.filter(({ body, house }) => house === 9 && (body === 'Sun' || body === 'Moon'));
  // Leo and Green connect the ninth-house luminaries to voyages. Require an
  // actual aspect of the natal luminary as well as a topic-specific direction.
  const voyageNatalAspects = !annual && natalAspects?.flatMap(row => ninthLuminaries.flatMap(({ body }) => {
    const other = row.first === body ? row.second : row.second === body ? row.first : undefined;
    if (!other) return [];
    const supportivePair = other === 'Jupiter' || body === 'Moon' && other === 'Mercury';
    const nature = supportivePair && (row.aspect === 'sextile' || row.aspect === 'trine') ? 'favourable'
      : (body === 'Moon' || other === 'Jupiter') && isLeoNatalAffliction(row) ? 'adverse' : undefined;
    return nature ? [{ ...row, body, house: 9, nature }] : [];
  }));
  const ninthNatalRuler = annual ? undefined : readLeoSignRuler(Math.floor(cusps[8] / 30));
  const ninthNatalAspects = ninthNatalRuler ? natalAspects?.filter(aspect =>
    aspect.first === ninthNatalRuler || aspect.second === ninthNatalRuler) : undefined;
  const mercuryAfflictions = afflictionsFor('Mercury');
  const targetKind: 'natal' | 'progressed' = annual ? 'progressed' : 'natal';
  return houses.flatMap(house => {
    const start = Math.max(window.start, house.start), end = Math.min(window.end, house.end);
    if (start >= end) return [];
    const candidates = aspects.flatMap((aspect, sourceBandIndex) => aspect.start < end && start < aspect.end ? [{ ...aspect, sourceBandIndex }] : []);
    const frames = house.house === 9 && !annual ? ninthFrames.filter(frame => frame.annualStart < end && start < frame.annualEnd) : [];
    const cuts = [...new Set([start, end,
      ...candidates.flatMap(a => [Math.max(start, a.start), Math.min(end, a.end)]),
      ...frames.flatMap(frame => [Math.max(start, frame.annualStart), Math.min(end, frame.annualEnd)]),
    ])].sort((a, b) => a - b);
    const naturalSign = house.house - 1;
    const cuspSign = Math.floor(cusps[naturalSign] / 30);
    const firstRuler = house.house === 7 && !annual ? readLeoSignRuler(Math.floor(cusps[0] / 30)) : undefined;
    const seventhRuler = firstRuler ? readLeoSignRuler(cuspSign) : undefined;
    const first = natal.bodies.find(body => body.body === firstRuler);
    const seventh = natal.bodies.find(body => body.body === seventhRuler);
    const rulerAspects = first && seventh ? natalAspects?.filter(aspect =>
      (aspect.first === first.body && aspect.second === seventh.body) || (aspect.first === seventh.body && aspect.second === first.body)) : undefined;
    const rulerPair = firstRuler && seventhRuler ? { first: firstRuler, seventh: seventhRuler,
      ...(first && seventh ? separation(first, seventh) : {}),
      ...(rulerAspects ? { natalAspects: rulerAspects, firstAfflictions: afflictionsFor(firstRuler),
        seventhAfflictions: afflictionsFor(seventhRuler) } : {}) } : undefined;
    return cuts.slice(0, -1).map((from, index) => {
      const to = cuts[index + 1];
      const activeBands = candidates.filter(a => a.start <= from && to <= a.end);
      const active = activeBands.map(a => ({ progressedBody: a.progressedBody,
        natalTargetId: a.natalTargetId, aspectType: a.aspectType, coordinate: a.coordinate, allowedOrb: a.allowedOrb,
        targetKind: a.targetKind ?? 'natal', nature: a.progressedBody === 'Moon' ? leoLunarNature(a) : undefined,
        exactTimes: a.exactTimes.filter(at => from <= at && at < to), sourceBandIndex: a.sourceBandIndex }));
      const lunarAspects = active.filter(a => a.progressedBody === 'Moon');
      const sameLayerMoon = lunarAspects.filter(a => a.targetKind === targetKind);
      const lunarAspectNatures = [...new Set(sameLayerMoon.map(a => a.nature).filter(nature => nature !== undefined))];
      const lunarExactAspectNatures = [...new Set(sameLayerMoon.flatMap(({ nature, exactTimes }) =>
        nature && exactTimes.length ? [nature] : []))];
      const secondFinance = house.house === 2 && secondNatal && secondTestimonies ? {
        financeBasis: secondNatal.financeBasis, secondRuler: secondNatal.secondRuler,
        anchors: secondNatal.financialAnchors.map(({ body, house }) => ({ body, house })),
        natalFinancialState: secondTestimonies.natalFinancialState,
        contacts: sameLayerMoon.flatMap(aspect => {
          const roles = leoNatalFinancialTargetRoles(secondNatal, aspect.natalTargetId);
          return roles.length ? [{ target: aspect.natalTargetId, aspectType: aspect.aspectType,
            nature: aspect.nature, roles }] : [];
        }),
      } : undefined;
      const lunarBands = activeBands.filter(band => band.progressedBody === 'Moon');
      const readTopic = (topic: Parameters<typeof classifyLeoTopicDirections>[1]) =>
        classifyLeoTopicDirections(lunarBands, topic).map(({ band: { sourceBandIndex }, ...direction }) => ({ ...direction, sourceBandIndex }));
      const relocationDirections = !annual && house.house === 4 ? readTopic('relocation') : undefined;
      const speculationDirections = !annual && house.house === 5 ? readTopic('speculation') : undefined;
      const attachmentDirections = !annual && house.house === 5 ? readTopic('attachment') : undefined;
      const serviceDirections = !annual && house.house === 6 ? readTopic('service') : undefined;
      const eighthOccultDirections = !annual && house.house === 8 ? readTopic('metaphysical') : undefined;
      const careerDirections = !annual && house.house === 10 ? readTopic('career') : undefined;
      const familyDirections = !annual && house.house === 10 ? readTopic('family') : undefined;
      const friendshipDirections = !annual && house.house === 11 ? readTopic('friendship') : undefined;
      const reflectionDirections = !annual && house.house === 12 ? readTopic('reflection') : undefined;
      const topicState = (directions: ReturnType<typeof readTopic> | undefined) =>
        directions && summarizeLeoDirectionNatures(directions.map(({ nature }) => nature));
      const eighthFinance = house.house === 8 && eighthNatalFinance ? {
        natalAspects: eighthNatalFinance,
        matchedNatures: lunarAspectNatures.filter(nature => eighthNatalFinance.some(aspect => aspect.nature === nature)),
      } : undefined;
      const favourableNatalTargets = house.house === 7 && !annual && afflictions
        ? [...new Set(sameLayerMoon.filter(a => a.nature === 'favourable').map(a => a.natalTargetId))]
          .map(body => ({ body, afflictions: afflictions.filter(aspect => aspect.first === body || aspect.second === body) }))
        : undefined;
      const ninthFrame = frames.find(frame => frame.annualStart <= from && to <= frame.annualEnd);
      const progressedCuspSign = ninthFrame && Math.floor(ninthFrame.cusps[8] / 30);
      const ninthProgressedRuler = progressedCuspSign === undefined ? undefined : readLeoSignRuler(progressedCuspSign);
      const ninthDirections = ninthProgressedRuler ? active.filter(aspect => aspect.targetKind === 'progressed'
        && (aspect.progressedBody === ninthProgressedRuler || aspect.natalTargetId === ninthProgressedRuler)) : [];
      const distinctDirections = ninthDirections.filter((aspect, index) => ninthDirections.findIndex(other =>
        other.aspectType === aspect.aspectType && (
          other.progressedBody === aspect.progressedBody && other.natalTargetId === aspect.natalTargetId
          || other.progressedBody === aspect.natalTargetId && other.natalTargetId === aspect.progressedBody
        )) === index);
      const ninthRulers = ninthFrame && ninthNatalRuler && ninthProgressedRuler ? {
        natalRuler: ninthNatalRuler, progressedRuler: ninthProgressedRuler, progressedCuspSign,
        annualStart: ninthFrame.annualStart, annualEnd: ninthFrame.annualEnd,
        natalAspects: ninthNatalAspects,
        progressedAspects: distinctDirections.map(describeLeoDirection),
      } : undefined;
      const voyageDirections = !annual && house.house === 9 && voyageNatalAspects
        ? readVoyageDirections(activeBands, lunarAspectNatures.length === 1 && lunarAspectNatures[0] === 'adverse')
        : undefined;
      const ninthVoyage = voyageDirections && voyageNatalAspects ? {
        natalAspects: voyageNatalAspects, directions: voyageDirections,
        matchedNatures: [...new Set(voyageDirections.map(row => row.nature))].filter(nature =>
          voyageNatalAspects.some(row => row.nature === nature)),
      } : undefined;
      return { start: from, end: to, profile: leoLunarHousePolicy.profile, body: 'Moon', kind: 'secondary',
        targetKind, annual,
        house: house.house, houseSystem: leoLunarHousePolicy.houseSystem,
        houseProfile: annual ? leoLunarHousePolicy.annualHouseProfile : leoLunarHousePolicy.houseProfile,
        lunarProfile: leoLunarConditionPolicy.profile,
        zodiac: leoLunarHousePolicy.zodiac, naturalSign, cuspSign,
        naturalSignBodies: natal.bodies.filter(body => body.sign === naturalSign).map(body => body.body),
        natalHouseBodies: annual ? undefined : natal.bodies.filter(body => body.house === house.house).map(body => body.body),
        natalMoon, dayChart: natal.dayChart,
        mercurySeparations: house.house === 3 ? mercurySeparations : undefined,
        mercuryAfflictions: house.house === 3 ? mercuryAfflictions : undefined,
        natalMercuryAfflicted: house.house === 3 && mercuryAfflictions ? mercuryAfflictions.length > 0 : undefined,
        natalAspectProfile: (house.house === 3 || !annual && natalAspectHouses.includes(house.house)) && natalAspects
          ? leoNatalAspectPolicy.profile : undefined,
        rulerPair, rulerTable: rulerPair ? leoRulershipPolicy.profile : undefined,
        ninthRulers, ninthRulerProfile: ninthRulers ? leoLunarHousePolicy.ninthRulerProfile : undefined,
        hasNinthRulerTestimony: ninthRulers?.natalAspects
          ? ninthRulers.natalAspects.length > 0 && ninthRulers.progressedAspects.length > 0 : undefined,
        ninthVoyage, hasNinthVoyageTestimony: ninthVoyage && ninthVoyage.matchedNatures.length > 0,
        seventhRulerAspectsReady: rulerAspects ? true : undefined,
        favourableNatalTargets,
        hasFavourableNatalTargetWithoutAffliction: favourableNatalTargets?.some(row => row.afflictions.length === 0),
        moonHasAdverseAspect: lunarAspectNatures.includes('adverse'),
        lunarAspectNatures, lunarExactAspectNatures, lunarAspects,
        secondFinance,
        literaryPlacements: house.house === 2 ? literaryPlacements : undefined,
        hasLiteraryPlacement: house.house === 2 && literaryPlacements ? literaryPlacements.length > 0 : undefined,
        domesticPlacements: house.house === 4 && domesticPlacements ? domesticPlacements : undefined,
        relocationDirections, relocationDirectionState: topicState(relocationDirections),
        speculationDirections, speculationDirectionState: topicState(speculationDirections),
        attachmentDirections, attachmentDirectionState: topicState(attachmentDirections),
        sixthServicePlacements: house.house === 6 ? sixthServicePlacements : undefined,
        hasSixthServicePlacement: house.house === 6 && sixthServicePlacements ? sixthServicePlacements.length > 0 : undefined,
        serviceDirections, serviceDirectionState: topicState(serviceDirections),
        eighthFinance, eighthOccultDirections, eighthOccultDirectionState: topicState(eighthOccultDirections),
        careerPlacements: house.house === 10 ? careerPlacements : undefined,
        careerDirections, careerDirectionState: topicState(careerDirections),
        familyDirections, familyDirectionState: topicState(familyDirections),
        friendshipDirections, friendshipDirectionState: topicState(friendshipDirections),
        twelfthPrivatePlacements: house.house === 12 ? twelfthPrivatePlacements : undefined,
        reflectionDirections,
        solarAspects: active.filter(a => a.progressedBody === 'Sun'),
        mutualAspects: active.filter(a => a.progressedBody !== 'Moon' && a.progressedBody !== 'Sun'),
        clippedStart: house.start === window.start, clippedEnd: house.end === window.end,
        geometryOnly: true };
    });
  });
}

type WesternFrame = Extract<ReturnType<typeof buildWesternSourceHouses>, { frame: unknown }>['frame'];

// Chapter VII erects each annual set of house cusps at the birth clock on
// that symbolic day. Approximate the real-year handover with the existing
// UTC anniversary mapping and keep it distinct from natal cusp passages.
export function leoAnnualHouseFrames(window: Window, frame: WesternFrame) {
  const { birthAt, armc, latitude } = frame;
  const firstYear = Math.floor((progressionEpoch(birthAt, window.start) - birthAt) / day);
  const years: (AnnualFrame & { cusps: number[] })[] = [];
  for (let year = firstYear; ; year++) {
    const annualStart = progressionRealTime(birthAt, birthAt + year * day);
    if (annualStart >= window.end) break;
    const annualEnd = progressionRealTime(birthAt, birthAt + (year + 1) * day);
    const start = Math.max(window.start, annualStart), end = Math.min(window.end, annualEnd);
    if (start >= end) continue;
    const angles = progressedHouseFrame(birthAt, annualStart, armc, latitude);
    const houses = calculateHouseCusps(angles.armc, latitude, angles.obliquity, 'placidus');
    if (houses.status !== 'ready') continue;
    years.push({ annualStart, annualEnd, cusps: houses.cusps });
  }
  return years;
}

export function leoAnnualLunarHouseBands(window: Window, frame: WesternFrame) {
  return leoAnnualHouseFrames(window, frame).map(year => ({
    ...year,
    bands: scanProgressedMoonHouses({ start: Math.max(window.start, year.annualStart),
      end: Math.min(window.end, year.annualEnd) }, frame.birthAt, year.cusps).map(band => ({
      ...band, enteredThroughAscendant: band.enteredThroughAscendant && band.start > year.annualStart,
    })),
  }));
}

type LunarAspectFrame = {
  birthAt: number;
  natal: Natal;
  natalCusps: number[];
  annual: ReturnType<typeof leoAnnualHouseFrames>;
};

export function readLeoMonthlyLunarFrame(base: Pick<GeometricBand, 'targetKind' | 'natalTargetId' | 'coordinate'>,
  exactTimes: number[], { birthAt, natal, natalCusps, annual }: LunarAspectFrame) {
  const targetKind = base.targetKind ?? 'natal';
  const natalTarget = natal.bodies.find(body => body.body === base.natalTargetId);
  if (!natalTarget) return [];
  return exactTimes.flatMap(exactAt => {
    const frame = targetKind === 'progressed' ? annual.find(item => item.annualStart <= exactAt && exactAt < item.annualEnd) : undefined;
    const cusps = targetKind === 'natal' ? natalCusps : frame?.cusps;
    if (!cusps) return [];
    const epoch = Math.round(progressionEpoch(birthAt, exactAt));
    const moonLongitude = readLeoMovingPosition('Moon', epoch).longitude;
    const targetLongitude = targetKind === 'progressed' ? readLeoMovingPosition(base.natalTargetId, epoch).longitude : natalTarget.longitude;
    const targetRuledHouses = cusps.flatMap((cusp, index) =>
      readLeoSignRuler(Math.floor(cusp / 30)) === base.natalTargetId ? [index + 1] : []);
    const radicalContacts = frame && [
      { body: 'Moon', longitude: moonLongitude },
      { body: base.natalTargetId, longitude: targetLongitude },
    ].flatMap(({ body, longitude }) => [
      ...natal.bodies.map(point => ({ target: point.body, longitude: point.longitude })),
      ...natalCusps.map((longitude, index) => ({ target: index + 1, longitude })),
    ].flatMap(point => {
      const angle = Math.abs(((longitude - point.longitude + 540) % 360) - 180);
      return progressedAspects.flatMap(({ type, angle: exactAngle }) => {
        const separation = Math.abs(angle - exactAngle);
        return separation <= progressionPolicy.longitudeOrb
          ? [{ body, target: point.target, aspectType: type, separation }] : [];
      });
    }));
    return [{ exactAt, targetKind, houseProfile: frame ? leoLunarHousePolicy.annualHouseProfile : leoLunarHousePolicy.houseProfile,
      annualStart: frame?.annualStart, annualEnd: frame?.annualEnd, moonLongitude, targetLongitude,
      moonHouse: zodiacalHouse(moonLongitude, cusps), targetHouse: zodiacalHouse(targetLongitude, cusps),
      appendixDate: base.coordinate === 'ecliptic_longitude' ? readLeoAppendixDate(birthAt, epoch) : undefined,
      targetRuledHouses, radicalContacts }];
  });
}

function readCrossingNatalMoon(bodies: NatalBody[]) {
  const moon = bodies.find(body => body.body === 'Moon');
  if (!moon) return {};
  const natalMoonContacts = bodies.flatMap(body => {
    if (!['Jupiter', 'Venus', 'Mars', 'Saturn'].includes(body.body)) return [];
    const supportive = body.body === 'Jupiter' || body.body === 'Venus';
    return readLeoNatalAspects(moon, body).filter(contact => supportive
      ? contact.aspect === 'sextile' || contact.aspect === 'trine' : isLeoNatalSquareOrOpposition(contact))
      .map(contact => ({ ...contact, first: moon.body, second: body.body }));
  });
  return { natalMoonSign: moon.sign, natalMoonDignity: natalMoonDignities[moon.sign] ?? 'other',
    natalMoonContacts, hasReviewedNatalMoonAspect: natalMoonContacts.length > 0,
    natalAspectProfile: leoNatalAspectPolicy.profile };
}

function ascendantCrossings(window: Window, bands: HouseBand[], cusps: number[], natalMoon: ReturnType<typeof readCrossingNatalMoon>,
  solar: AspectBand[] | undefined, annual?: AnnualFrame) {
  const targetKind = annual ? 'progressed' : 'natal';
  const houseProfile = annual ? leoLunarHousePolicy.annualHouseProfile : leoLunarHousePolicy.houseProfile;
  return bands.flatMap(band => {
    if (band.house !== 1 || !band.enteredThroughAscendant || band.start < window.start || band.start >= window.end) return [];
    const solarAtCrossing = solar?.filter(row => row.start <= band.start && band.start < row.end).map(describeLeoDirection);
    return [{ start: band.start, end: Math.min(band.start + 1, band.end, window.end), annual, targetKind, houseProfile,
      profile: leoLunarHousePolicy.ascendantCrossingProfile, kind: 'secondary', body: 'Moon', zodiac: leoLunarHousePolicy.zodiac,
      houseSystem: leoLunarHousePolicy.houseSystem, fromHouse: 12, house: 1, cuspLongitude: cusps[0], motion: 'direct',
      ...natalMoon, solarAtCrossing,
      hasProgressedSolarAtCrossing: solarAtCrossing && solarAtCrossing.length > 0 }];
  });
}

export function buildLeoLunarHouses(window: Window, houses: ReturnType<typeof buildWesternSourceHouses>,
  leo: ReturnType<typeof buildLeoSourceContext>, includeAnnual = false) {
  if (!('moon' in houses) || !houses.moon || houses.placidus?.status !== 'ready' || leo.status !== 'ready'
    || leo.natalContext.houseStatus !== 'ready' || houses.frame.birthAt !== leo.birthAt) {
    return { status: 'unavailable', policy: leoLunarHousePolicy } as const;
  }
  const aspects = [...leo.intervals, ...leo.progressedPairs];
  const annual = includeAnnual ? leoAnnualLunarHouseBands(window, houses.frame) : [];
  const natalMoon = readCrossingNatalMoon(leo.natalContext.bodies);
  const solar = includeAnnual ? leo.progressedPairs.filter(band => band.progressedBody === 'Sun' && band.targetKind === 'progressed')
    : undefined;
  const natalBands = houses.moon.map(({ start, end, natalHouse, enteredThroughAscendant }) =>
    ({ start, end, house: natalHouse, enteredThroughAscendant }));
  const isStudyHouse = ({ house }: HouseBand) => house === 8 || house === 9;
  return { status: 'ready', policy: leoLunarHousePolicy, annual,
    studyBands: [
      ...natalBands.filter(isStudyHouse).map(band => ({
        ...band, targetKind: 'natal' as const, houseProfile: leoLunarHousePolicy.houseProfile,
      })),
      ...annual.flatMap(({ bands }) => bands.filter(isStudyHouse).map(band => ({
        ...band, targetKind: 'progressed' as const, houseProfile: leoLunarHousePolicy.annualHouseProfile,
      }))),
    ],
    ascendantCrossings: [
      ...ascendantCrossings(window, natalBands, houses.placidus.cusps, natalMoon, solar),
      ...annual.flatMap(({ annualStart, annualEnd, cusps, bands }) => ascendantCrossings(window, bands, cusps, natalMoon, solar, { annualStart, annualEnd })),
    ],
    intervals: [
      ...splitLeoLunarHouses(window, natalBands, aspects, leo.natalContext, houses.placidus.cusps, undefined, annual),
      ...annual.flatMap(({ annualStart, annualEnd, cusps, bands }) => splitLeoLunarHouses(window, bands, aspects,
        leo.natalContext, cusps, { annualStart, annualEnd })),
    ],
  } as const;
}
