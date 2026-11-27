import type { FortuneFactRecord } from '../model/fortune-facts';
import { isLeoGreenStrongNatalLongitude, isLeoNatalFinancialSupport, isLeoNatalSquareOrOpposition, leoNatalAspectPolicy, leoNatalFinancialProfile, leoNatalFinancialTargetRoles,
  readLeoAngularCuspApproach, readLeoGreenNatalAspects, readLeoNatalAngularSignGroup, readLeoNatalAspectContacts, readLeoNatalAspects,
  readLeoNatalFinancialAnchors, readLeoNatalFinancialTestimonies } from './leo-natal-aspects';
import { classifyLeoTopicDirections, summarizeLeoDirectionNatures } from './leo-direction-support';
import { readLeoAscendantDivision } from './leo-ascendant';
import { leoRulershipPolicy, readLeoSignRuler } from './leo-rulership';
import { canScanLeoProgressedPair, leoSourcePolicy, leoStrengthHouses, measureNatalLeoAngularPosition, rankNatalLeoAngularPositions,
  readLeoTransitDeclinations, type buildLeoSourceContext, type GeometricBand } from './leo-source-context';
import { progressedAspects } from './western-progressions';
import type { buildWesternSourceHouses } from './western-houses';
import type { LeoAnnualCusps } from './leo-lunar-houses';

const majorLongitudeAspects = progressedAspects.filter(aspect => [0, 60, 90, 120, 180].includes(aspect.angle));
const exactLongitudePrecision = 0.000001;

export const leoNatalTransitPolicy = {
  profile: 'leo-transit-natal-witness-1928-v1', zodiac: 'tropical',
  aspectProfile: leoNatalAspectPolicy.profile, rulerProfile: leoRulershipPolicy.profile,
  angularHouses: [1, 4, 7, 10],
  financialHouses: 'second-house-occupants-before-cusp-ruler-with-separate-general-significators',
  financialTestimony: leoNatalFinancialProfile,
  financialDirectionProfile: 'leo-1906-second-house-current-direction-and-crossing-v1',
  importanceProfile: 'leo-natal-importance-1928-reference-v1',
  ascendantDwadashamshaProfile: 'leo-ascendant-dwadashamsha-zodiac-order-v1',
  angularCuspPolicy: 'leo-green-1906-five-degrees-before-angular-cusp',
  risingDegreeOrb: leoSourcePolicy.longitudeOrb,
} as const;

export const leoJupiterHousePolicy = {
  profile: 'leo-jupiter-house-ruler-context-v1', zodiac: 'tropical', houseProfile: 'leo-original-natal', houseSystem: 'placidus',
  rulers: leoRulershipPolicy.profile, natalAspects: leoNatalAspectPolicy.profile,
  supportingGeometry: 'same-distinct-natal-ruler-pair-and-repeated-sextile-or-trine-in-a-secondary-to-natal-longitude-band',
  annualRulers: 'leo-jupiter-rulers-in-annual-chart-v1',
  time: 'actual-jupiter-house-band-split-at-matching-direction-and-anniversary-boundaries',
} as const;

type Natal = Extract<ReturnType<typeof buildLeoSourceContext>, { status: 'ready' }>['natalContext'];
type Houses = Extract<ReturnType<typeof buildWesternSourceHouses>, { frame: unknown }>;
type TransitNatal = NonNullable<ReturnType<typeof buildLeoTransitNatal>>;

function contacts(natal: Natal, focus: Natal['bodies'][number]) {
  return natal.bodies.flatMap(other => readLeoGreenNatalAspects(focus, other).map(aspect => ({ body: other.body, ...aspect })));
}

function preferredLongitudeOverParallel(allContacts: ReturnType<typeof contacts>) {
  return allContacts.flatMap(parallel => {
    if (parallel.aspect !== 'parallel') return [];
    const preferred = allContacts.find(contact => contact.body === parallel.body
      && isLeoGreenStrongNatalLongitude(contact));
    return preferred ? [{ ...parallel, preferredAspect: preferred.aspect }] : [];
  });
}

export function buildLeoTransitNatal(natal: Natal, houses: Houses) {
  if (houses.placidus.status !== 'ready' || natal.houseStatus !== 'ready') return;
  const cusps = houses.placidus.cusps;
  // Chapter IX ranks the natal sign, decan and twelfth-part rulers separately.
  const { longitude, sign, decan, decanSign, signRuler: ascendantRuler, decanRuler: ruler } = readLeoAscendantDivision(cusps[0]);
  const ascendantDecan = { longitude, sign, decan, decanSign, ruler };
  const part = Math.floor((longitude - 30 * sign) / 2.5) + 1;
  const partSign = (sign + part - 1) % 12;
  const ascendantDwadashamsha = { longitude, sign, part, partSign, ruler: readLeoSignRuler(partSign) };
  const angularPlanets = natal.bodies.filter(body => leoStrengthHouses.some(house => house === body.house));
  const angularPositions = angularPlanets.map(body => measureNatalLeoAngularPosition(body, cusps));
  const rank = rankNatalLeoAngularPositions(angularPositions);
  const soleAngularBody = rank.basis === 'only-in-angular-house' ? rank.witness.body : undefined;
  // In Leo and Green p. 6 the debated dignities matter only when accepting
  // one could change the outcome of the p. 85 comparison.
  const hasDisputedDignity = angularPositions.length > 1 && angularPositions.some(({ body, sign, distance }) => {
    const dignityInQuestion = sign === 10 && (body === 'Uranus' || body === 'Venus') || sign === 11 && body === 'Neptune';
    return dignityInQuestion && (!rank.witness || distance !== undefined && distance <= rank.witness.distance + 1e-8);
  });
  const natalAngularStrength = hasDisputedDignity ? { basis: 'disputed-dignity' as const, witness: undefined } : rank;
  const sun = natal.bodies.find(body => body.body === 'Sun')!;
  const allSolarContacts = contacts(natal, sun);
  // The sole parallel needs no comparison with another body's longitude contact.
  const soleSolarParallel = allSolarContacts.length === 1 && allSolarContacts[0].aspect === 'parallel' ? allSolarContacts[0] : undefined;
  const solarContacts = allSolarContacts.filter(contact => contact.coordinate === 'longitude');
  // Leo and Green, p. 76, name close solar aspect plus an actual tenth-house
  // placement. Equality within numerical precision is a verifiable subset.
  const exactTenthHouseSolarAspects = solarContacts.filter(contact => contact.difference <= exactLongitudePrecision
    && majorLongitudeAspects.some(aspect => aspect.type === contact.aspect)
    && natal.bodies.find(body => body.body === contact.body)?.house === 10);
  const closestDifference = Math.min(...solarContacts.map(contact => contact.difference));
  const closestSolar = solarContacts.filter(contact => Math.abs(contact.difference - closestDifference) <= 1e-9);
  const solarParallelReplacements = preferredLongitudeOverParallel(allSolarContacts);
  const rankableSolar = allSolarContacts.every(contact => contact.coordinate === 'longitude'
    || solarParallelReplacements.some(row => row.body === contact.body));
  const isMajorLongitude = (contact: ReturnType<typeof contacts>[number]) => contact.coordinate === 'longitude'
    && majorLongitudeAspects.some(aspect => aspect.type === contact.aspect);
  const isReviewedMinorLongitude = (contact: ReturnType<typeof contacts>[number]) =>
    contact.coordinate === 'longitude' && ['semisquare', 'sesquiquadrate'].includes(contact.aspect);
  // The Sun and Moon paragraphs say closest aspect. The aspect table treats
  // the semi-square and sesquiquadrate as material, unlike the feeblest aspects.
  const soleSolarDualCoordinateContacts = !rankableSolar
    && new Set(allSolarContacts.map(contact => contact.body)).size === 1
    && allSolarContacts.some(contact => contact.aspect === 'parallel')
    && solarContacts.some(contact => isMajorLongitude(contact) || isReviewedMinorLongitude(contact))
    ? allSolarContacts : [];
  const closestSolarBody = rankableSolar && new Set(closestSolar.map(contact => contact.body)).size === 1 ? closestSolar : [];
  const closestSolarMajor = closestSolarBody.find(isMajorLongitude);
  const closestSolarMinor = closestSolarBody.find(isReviewedMinorLongitude);
  const moon = natal.bodies.find(body => body.body === 'Moon')!;
  const allLunarContacts = contacts(natal, moon);
  // Leo and Green, p. 9: give a strong longitude aspect priority over an
  // accompanying declination parallel between the very same two bodies.
  const lunarParallelReplacements = preferredLongitudeOverParallel(allLunarContacts);
  const lunarContacts = allLunarContacts.filter(contact => contact.aspect !== 'parallel'
    || !lunarParallelReplacements.some(row => row.body === contact.body));
  const lunarBodyCount = new Set(lunarContacts.map(contact => contact.body)).size;
  const isReviewedLunarLongitude = (contact: ReturnType<typeof contacts>[number]) => isMajorLongitude(contact)
    || isReviewedMinorLongitude(contact);
  // If the two coordinates point to the same sole body, there is no
  // comparison between different planets' angles.
  const hasLunarMinorAndParallel = lunarContacts.some(isReviewedMinorLongitude)
    && lunarContacts.some(contact => contact.aspect === 'parallel');
  const soleLunar = lunarBodyCount === 1 ? lunarContacts.filter(contact => isMajorLongitude(contact)
    || (lunarContacts.length === 1 || hasLunarMinorAndParallel)
      && (contact.aspect === 'parallel' || isReviewedMinorLongitude(contact))) : [];
  const rankable = lunarBodyCount > 1 && lunarContacts.every(contact => contact.coordinate === 'longitude');
  const lunarDifference = Math.min(...lunarContacts.map(contact => contact.difference));
  const nearest = rankable ? lunarContacts.filter(contact => Math.abs(contact.difference - lunarDifference) <= 1e-9) : [];
  const closestLunar = new Set(nearest.map(contact => contact.body)).size === 1 ? nearest.filter(isReviewedLunarLongitude) : [];
  // Chapter VII gives a close aspect to the actual rising degree as an
  // additional consideration when there is no rising planet. Use the
  // existing narrow product orb as a candidate, as the passage gives no limit.
  const hasRisingHouseOccupant = natal.bodies.some(body => body.house === 1);
  const risingDegreeContacts = hasRisingHouseOccupant ? [] : natal.bodies.flatMap(body => {
    const distance = Math.abs((body.longitude - cusps[0] + 540) % 360 - 180);
    return majorLongitudeAspects.flatMap(aspect => {
      const difference = Math.abs(distance - aspect.angle);
      const orb = leoNatalTransitPolicy.risingDegreeOrb;
      return difference <= orb ? [{ body: body.body, aspect: aspect.type, difference, orb, ascendantLongitude: cusps[0] }] : [];
    });
  });
  const hasApproachingRisingPlanet = natal.bodies.some(body => readLeoAngularCuspApproach(body, cusps)?.nextHouse === 1);
  // Leo and Green define the elevated planet relative to the tenth cusp,
  // independently of the comparison for the strongest planet in the chart.
  const [nearestTenth, nextClosestTenth] = natal.bodies.map(body => ({ body: body.body,
    distance: Math.abs((body.longitude - cusps[9] + 540) % 360 - 180) }))
    .sort((first, second) => first.distance - second.distance);
  const uniqueElevatedBody = nearestTenth && nextClosestTenth && nearestTenth.distance + 1e-9 < nextClosestTenth.distance
    ? { body: nearestTenth.body, nextClosestBody: nextClosestTenth.body, nextClosestDistance: nextClosestTenth.distance } : undefined;
  return { ascendantRuler, ascendantDecan, ascendantDwadashamsha, soleAngularBody, natalAngularStrength,
    closestSolar, closestSolarMajor, closestSolarMinor, soleSolarParallel,
    soleSolarDualCoordinateContacts, exactTenthHouseSolarAspects, soleLunar, closestLunar, uniqueElevatedBody,
    lunarParallelReplacements, risingDegreeContacts, hasRisingHouseOccupant, hasApproachingRisingPlanet,
    natalAspectContacts: readLeoNatalAspectContacts(natal.bodies),
    ...readLeoNatalFinancialAnchors(natal.bodies, cusps),
    bodies: natal.bodies, cusps, cuspSigns: cusps.map(cusp => Math.floor(cusp / 30)),
  };
}

export function leoSolarNatalContacts(natal: TransitNatal, facts: FortuneFactRecord[]) {
  return facts.flatMap(fact => {
    if (fact.method !== 'western' || fact.scope !== 'transit' || fact.factType !== 'aspect_exact'
      || fact.completeness !== 'complete' || fact.sourceEngine !== 'astronomy-engine' || !fact.exactInstant) return [];
    const p = fact.normalizedPayload as Record<string, unknown> | null;
    if (p?.transitBody !== 'Sun' || p.natalTargetType !== 'planet' || p.aspectType !== 'conjunction' || p.zodiac !== 'tropical') return [];
    const body = natal.bodies.find(position => position.body === p.natalTargetId && position.longitude === p.natalLongitude);
    const at = Date.parse(fact.exactInstant), start = Date.parse(fact.activeFrom), end = Date.parse(fact.activeTo);
    if (!body || body.house === undefined || !(start <= at && at < end)) return [];
    const isAscendantRuler = body.body === natal.ascendantRuler;
    const isSoleAngularBody = body.body === natal.soleAngularBody;
    const { basis, witness } = natal.natalAngularStrength;
    const isNatalAngularStrengthWitness = basis === 'disputed-dignity' ? undefined : witness?.body === body.body;
    const isAscendantDecanRuler = body.body === natal.ascendantDecan.ruler;
    const isAscendantDwadashamshaRuler = body.body === natal.ascendantDwadashamsha.ruler;
    const isAngular = leoNatalTransitPolicy.angularHouses.some(house => house === body.house);
    const closestSolarAspects = natal.closestSolar.filter(closest => closest.body === body.body);
    const hasUniqueClosestNatalSolarMajor = natal.closestSolarMajor?.body === body.body;
    const hasUniqueClosestNatalSolarMinor = natal.closestSolarMinor?.body === body.body;
    const soleSolarParallelAspect = natal.soleSolarParallel?.body === body.body ? natal.soleSolarParallel : undefined;
    const soleSolarParallelCandidate = soleSolarParallelAspect !== undefined;
    const soleSolarDualCoordinateContacts = natal.soleSolarDualCoordinateContacts.filter(contact => contact.body === body.body);
    const soleSolarDualCoordinateCandidate = soleSolarDualCoordinateContacts.length > 0;
    const exactNatalSolarAspectInTenthHouse = natal.exactTenthHouseSolarAspects.find(contact => contact.body === body.body);
    const soleLunarAspectContacts = natal.soleLunar.filter(contact => contact.body === body.body);
    const soleLunarCandidate = soleLunarAspectContacts.length > 0;
    const closestLunarAspectContacts = natal.closestLunar.filter(contact => contact.body === body.body);
    const closestLunarCandidate = closestLunarAspectContacts.length > 0;
    const risingDegreeAspects = natal.risingDegreeContacts.filter(contact => contact.body === body.body);
    const closestSolarCandidate = closestSolarAspects.length > 0, risingDegreeCandidate = risingDegreeAspects.length > 0;
    const exactRisingDegreeAspect = natal.hasApproachingRisingPlanet ? undefined
      : risingDegreeAspects.find(contact => contact.difference <= exactLongitudePrecision);
    // Leo's fourth edition treats all four actual angles as important; ranking them is a separate question.
    const ordinaryNatalAngularOccupant = isAngular && isNatalAngularStrengthWitness !== true;
    const angularCuspApproach = readLeoAngularCuspApproach(body, natal.cusps);
    const beforeAngularCuspCandidate = angularCuspApproach !== undefined;
    const hasNatalRisingCuspApproach = angularCuspApproach?.nextHouse === 1;
    // Leo, How to Judge a Nativity p. 129, specifically considers these
    // two cusps when no natal planet is rising.
    const hasNearNatalSeventhOrTenthCuspWithoutRisingPlanet = !natal.hasRisingHouseOccupant && !natal.hasApproachingRisingPlanet
      && (angularCuspApproach?.nextHouse === 7 || angularCuspApproach?.nextHouse === 10);
    const elevatedTenthCuspApproach = angularCuspApproach?.nextHouse === 10 && natal.uniqueElevatedBody?.body === body.body
      ? { ...angularCuspApproach, nextClosestBody: natal.uniqueElevatedBody.nextClosestBody,
        nextClosestDistance: natal.uniqueElevatedBody.nextClosestDistance } : undefined;
    const natalAngularSameSignGroup = readLeoNatalAngularSignGroup(body.body, natal.bodies);
    return [{ start, end, at: fact.exactInstant, fact,
      payload: { natalTargetId: body.body, natalHouse: body.house, natalSign: body.sign, natalLongitude: body.longitude,
        ascendantRuler: natal.ascendantRuler, isAscendantRuler, isSoleAngularBody, isAngular, closestSolarAspects, risingDegreeAspects,
        isNatalAngularStrengthWitness, ordinaryNatalAngularOccupant,
        natalAngularStrength: isNatalAngularStrengthWitness ? { basis, ...witness } : { basis },
        hasExactNatalSolarAspectInTenthHouse: exactNatalSolarAspectInTenthHouse !== undefined,
        exactNatalSolarAspectInTenthHouse: exactNatalSolarAspectInTenthHouse && {
          aspect: exactNatalSolarAspectInTenthHouse.aspect, difference: exactNatalSolarAspectInTenthHouse.difference,
        },
        soleLunarAspectContacts, soleLunarCandidate, closestLunarAspectContacts, closestLunarCandidate,
        lunarParallelReplacements: closestLunarCandidate ? natal.lunarParallelReplacements : undefined,
        ascendantDecan: natal.ascendantDecan, isAscendantDecanRuler,
        ascendantDwadashamsha: natal.ascendantDwadashamsha, isAscendantDwadashamshaRuler,
        ascendantDwadashamshaProfile: leoNatalTransitPolicy.ascendantDwadashamshaProfile,
        importanceProfile: leoNatalTransitPolicy.importanceProfile, closestSolarCandidate, hasUniqueClosestNatalSolarMajor,
        hasUniqueClosestNatalSolarMinor, risingDegreeCandidate,
        hasExactRisingDegreeAspect: exactRisingDegreeAspect !== undefined, exactRisingDegreeAspect,
        soleSolarParallelCandidate, soleSolarParallelAspect, soleSolarDualCoordinateCandidate, soleSolarDualCoordinateContacts,
        angularCuspApproach, beforeAngularCuspCandidate, hasNatalRisingCuspApproach, hasNearNatalSeventhOrTenthCuspWithoutRisingPlanet,
        hasNatalElevatedTenthCuspApproach: elevatedTenthCuspApproach !== undefined, elevatedTenthCuspApproach,
        contactDeclinations: readLeoTransitDeclinations('Sun', at, body.declination),
        hasNatalAngularSameSignGroup: natalAngularSameSignGroup !== undefined, natalAngularSameSignGroup,
        natalAspectProfile: leoNatalAspectPolicy.profile,
        natalTargetAspectContacts: natal.natalAspectContacts.filter(row => row.first === body.body || row.second === body.body),
        sameSignNatalBodies: natal.bodies.filter(other => other.body !== body.body && other.sign === body.sign)
          .map(({ body, house }) => ({ body, house })),
        ruledHouses: natal.cuspSigns.flatMap((sign, index) => readLeoSignRuler(sign) === body.body ? [index + 1] : []),
        qualifiedCandidate: isAscendantRuler || isAngular || closestSolarCandidate || risingDegreeCandidate
          || beforeAngularCuspCandidate || isAscendantDecanRuler || isAscendantDwadashamshaRuler || soleLunarCandidate || closestLunarCandidate
          || soleSolarParallelCandidate || soleSolarDualCoordinateCandidate } }];
  });
}

function sameDirectionPair(direction: GeometricBand, first: string, other: string) {
  return first !== other && (direction.progressedBody === first && direction.natalTargetId === other
    || direction.progressedBody === other && direction.natalTargetId === first);
}

export function buildLeoSecondHouseContexts(natal: TransitNatal, houses: Houses, directions: readonly GeometricBand[],
  transitFacts: FortuneFactRecord[] = []) {
  const { financialTestimonies, natalFinancialState } = readLeoNatalFinancialTestimonies(natal);
  // Leo and Green, pp. 8 and 74, include the semi-square and sesquiquadrate
  // among the difficult aspects to a second-house occupant or empty-house ruler.
  const minorSecondHouseAfflictions = natal.financialAnchors.flatMap(({ body: first, contacts }) => contacts
    .filter(row => row.coordinate === 'longitude' && (row.aspect === 'semisquare' || row.aspect === 'sesquiquadrate'))
    .map(row => ({ first, ...row })));
  const natalSecondHouseMinorAfflictionContacts = [...new Map(minorSecondHouseAfflictions.map(row =>
    [[row.first, row.body].sort().join(':') + ':' + row.aspect, row])).values()];
  // The source traces a difficult contact through the actual house of the afflicting planet.
  const natalSecondHousePressureSources = natal.financialAnchors.flatMap(({ body: first, contacts }) => contacts
    .filter(isLeoNatalSquareOrOpposition).flatMap(contact => {
      const sourceHouse = natal.bodies.find(other => other.body === contact.body)?.house;
      return sourceHouse === undefined ? [] : [{ first, ...contact, sourceHouse }];
    }));
  const repetitions = directions.filter(direction => direction.targetKind === 'natal' && direction.coordinate === 'ecliptic_longitude'
    && financialTestimonies.some(row => row.aspect === direction.aspectType && sameDirectionPair(direction, row.first, row.body)));
  const qualifiedDirections = classifyLeoTopicDirections(directions.filter(band => band.targetKind === 'natal'
    && band.progressedBody !== 'Moon' && band.coordinate === 'ecliptic_longitude'), 'monthlyFinance').flatMap(direction => {
    const roles = leoNatalFinancialTargetRoles(natal, direction.target);
    return roles.length ? [{ ...direction, roles }] : [];
  });
  const crossings = transitFacts.flatMap(fact => {
    if (fact.method !== 'western' || fact.factType !== 'aspect_exact' || fact.scope !== 'transit'
      || fact.completeness !== 'complete' || !fact.exactInstant) return [];
    const p = fact.normalizedPayload as Record<string, unknown> | null;
    if (p?.zodiac !== 'tropical' || p.aspectType !== 'conjunction' || p.natalTargetType !== 'planet'
      || (p.transitBody !== 'Jupiter' && p.transitBody !== 'Saturn')) return [];
    const body = natal.bodies.find(item => item.body === p.natalTargetId && item.longitude === p.natalLongitude);
    const roles = body ? leoNatalFinancialTargetRoles(natal, body.body) : [];
    return body && roles.length ? [{ transitBody: p.transitBody, target: body.body, roles, exactAt: Date.parse(fact.exactInstant),
      motion: p.transitMotion, sourceFactIds: fact.sourceFactIds }] : [];
  });

  return houses.transits.flatMap(transit => {
    const transitBody = transit.body;
    if (transitBody !== 'Saturn' && transitBody !== 'Jupiter') return [];
    const relevantAspect = transitBody === 'Jupiter' ? isLeoNatalFinancialSupport : isLeoNatalSquareOrOpposition;
    return transit.placidusIntervals.filter(interval => interval.natalHouse === 2).flatMap(interval => {
      const related = repetitions.filter(direction => relevantAspect({ aspect: direction.aspectType })
        && interval.start < direction.end && direction.start < interval.end);
      const finance = qualifiedDirections.filter(({ band }) => interval.start < band.end && band.start < interval.end);
      const boundaries = [...new Set([interval.start, interval.end, ...[...related, ...finance.map(({ band }) => band)].flatMap(direction =>
        [Math.max(interval.start, direction.start), Math.min(interval.end, direction.end)])])].sort((a, b) => a - b);
      return boundaries.slice(0, -1).map((start, index) => {
        const end = boundaries[index + 1];
        const repeatingDirections = related.filter(direction => direction.start <= start && end <= direction.end)
          .map(({ progressedBody, natalTargetId, aspectType, exactTimes }) => ({ progressedBody, natalTargetId, aspectType,
            exactTimes: exactTimes.filter(at => start <= at && at < end) }));
        const financialDirections = finance.filter(({ band }) => band.start <= start && end <= band.end)
          .map(({ band, ...context }) => ({ ...context, exactTimes: band.exactTimes.filter(at => start <= at && at < end) }));
        const financialDirectionState = summarizeLeoDirectionNatures(financialDirections.map(row => row.nature));
        const targetCrossings = crossings.filter(crossing => crossing.transitBody === transitBody
          && start <= crossing.exactAt && crossing.exactAt < end).map(crossing => ({
          ...crossing, sameTargetDirectionState: summarizeLeoDirectionNatures(financialDirections.filter(row => row.target === crossing.target)
            .map(row => row.nature)),
        }));
        return { start, end, transitBody, natalFinancialState, financialTestimonies, repeatingDirections,
          natalSecondHouseMinorAfflictionContacts: transitBody === 'Saturn' ? natalSecondHouseMinorAfflictionContacts : undefined,
          hasNatalSecondHouseMinorAffliction: transitBody === 'Saturn' ? natalSecondHouseMinorAfflictionContacts.length > 0 : undefined,
          natalSecondHousePressureSources: transitBody === 'Saturn' ? natalSecondHousePressureSources : undefined,
          financialDirections, financialDirectionState, targetCrossings };
      });
    });
  });
}

type AnnualDirections = { frames: readonly LeoAnnualCusps[]; directions: readonly GeometricBand[] };

export function buildLeoJupiterHouseContexts(natal: TransitNatal, houses: Houses, directions: readonly GeometricBand[],
  annual?: AnnualDirections) {
  const jupiter = houses.transits.find(transit => transit.body === 'Jupiter');
  const first = natal.bodies.find(body => body.body === natal.ascendantRuler);
  if (!jupiter || !first || first.house === undefined) return [];

  return ([7, 10] as const).flatMap(natalHouse => {
    const cuspSign = natal.cuspSigns[natalHouse - 1];
    const houseRuler = readLeoSignRuler(cuspSign);
    const other = natal.bodies.find(body => body.body === houseRuler);
    if (!other || other.house === undefined) return [];

    const distinctRulers = first.body !== other.body;
    const natalAspects = readLeoNatalAspects(first, other);
    const repeatsNatal = (aspectType: string) => natalAspects.some(aspect => aspect.aspect === aspectType);
    const directionsToRulers = directions.filter(direction => direction.targetKind !== 'progressed'
      && direction.coordinate === 'ecliptic_longitude' && sameDirectionPair(direction, first.body, other.body)).map(direction => ({
      ...direction,
      repeatsNatalAspect: repeatsNatal(direction.aspectType),
    }));
    const annualPairs = annual?.frames.map(frame => {
      const firstSign = Math.floor(frame.cusps[0] / 30);
      const houseSign = Math.floor(frame.cusps[natalHouse - 1] / 30);
      const ascendantRuler = readLeoSignRuler(firstSign);
      const houseRuler = readLeoSignRuler(houseSign);
      const pairChecked = ascendantRuler === houseRuler || canScanLeoProgressedPair(ascendantRuler, houseRuler);
      const bands = pairChecked ? annual.directions.filter(direction => direction.targetKind === 'progressed'
        && direction.coordinate === 'ecliptic_longitude' && sameDirectionPair(direction, ascendantRuler, houseRuler)
        && frame.annualStart < direction.end && direction.start < frame.annualEnd) : undefined;
      return { annualStart: frame.annualStart, annualEnd: frame.annualEnd, firstSign, houseSign,
        ascendantRuler, houseRuler, bands };
    }) ?? [];

    return jupiter.placidusIntervals.filter(interval => interval.natalHouse === natalHouse).flatMap(interval => {
      const related = directionsToRulers.filter(direction => direction.start < interval.end && interval.start < direction.end);
      const frames = annualPairs.filter(frame => frame.annualStart < interval.end && interval.start < frame.annualEnd);
      const cuts = [...new Set([interval.start, interval.end,
        ...related.flatMap(direction => [Math.max(interval.start, direction.start), Math.min(interval.end, direction.end)]),
        ...frames.flatMap(frame => {
          const start = Math.max(interval.start, frame.annualStart), end = Math.min(interval.end, frame.annualEnd);
          return [start, end, ...(frame.bands ?? []).filter(band => start < band.end && band.start < end)
            .flatMap(band => [Math.max(start, band.start), Math.min(end, band.end)])];
        }),
      ])]
        .sort((a, b) => a - b);
      return cuts.slice(0, -1).map((start, index) => {
        const end = cuts[index + 1];
        const activeDirections = related.filter(direction => direction.start <= start && end <= direction.end)
          .map(({ progressedBody, natalTargetId, aspectType, coordinate, allowedOrb, exactTimes, repeatsNatalAspect }) => ({
            progressedBody, natalTargetId, aspectType, coordinate, allowedOrb, repeatsNatalAspect,
            exactTimes: exactTimes.filter(at => start <= at && at < end),
          }));
        const frame = frames.find(frame => frame.annualStart <= start && end <= frame.annualEnd);
        const currentAnnual = frame?.bands?.filter(band => band.start <= start && end <= band.end);
        const distinctAnnual = currentAnnual?.filter((band, i) =>
          currentAnnual.findIndex(other => other.aspectType === band.aspectType) === i);
        const annualRulers = frame && {
          annualStart: frame.annualStart, annualEnd: frame.annualEnd, firstSign: frame.firstSign, houseSign: frame.houseSign,
          ascendantRuler: frame.ascendantRuler, houseRuler: frame.houseRuler,
          activeDirections: distinctAnnual?.map(({ progressedBody, natalTargetId, aspectType, exactTimes }) => ({
            progressedBody, targetId: natalTargetId, aspectType, exactTimes: exactTimes.filter(at => start <= at && at < end),
          })),
        };
        return { start, end, natalHouse, cuspSign, ascendantRuler: first.body, houseRuler: other.body,
          ascendantRulerHouse: first.house, houseRulerHouse: other.house, natalAspects, activeDirections,
          natalHasRulerAspect: natalAspects.length > 0,
          annualRulerProfile: annualRulers ? leoJupiterHousePolicy.annualRulers : undefined,
          annualRulers, annualRulerHasContact: currentAnnual && currentAnnual.length > 0,
          annualRulerDirectionCandidate: currentAnnual?.some(direction => repeatsNatal(direction.aspectType)
            && ['sextile', 'trine'].includes(direction.aspectType)),
          sameRulerDirectionCandidate: distinctRulers ? activeDirections.some(direction => direction.repeatsNatalAspect
            && ['sextile', 'trine'].includes(direction.aspectType)) : undefined };
      });
    });
  });
}
