import { zodiacalHouse, type buildWesternSourceHouses } from './western-houses';
import type { buildLeoSourceContext, GeometricBand } from './leo-source-context';
import { readLeoSignRuler } from './leo-rulership';
import { classifyLeoDirections, summarizeLeoDirectionNatures } from './leo-direction-support';
import { leoLunarNature } from './leo-lunar-conditions';
import { isLeoNatalSquareOrOpposition, leoNatalAspectPolicy, readLeoNatalAspects } from './leo-natal-aspects';

type Window = { start: number; end: number };
type AscendantBand = Window & { longitude: number; sign: number; decan: number };
type AspectBand = Pick<GeometricBand, 'start' | 'end' | 'progressedBody' | 'natalTargetId' | 'targetKind'
  | 'aspectType' | 'coordinate' | 'allowedOrb' | 'exactTimes'>;
type NatalBody = { body: string; longitude: number; declination: number; sign: number; house?: number };
type Natal = { bodies: NatalBody[]; dayChart?: boolean; sunHouse?: number };
// Leo's own 1928 fourth edition, printed pp.26-27. This supporting edition is
// explicit: neither Uranus nor Neptune has a sign-house allotted in this table.
// Do not borrow the sign ruler of a modern library or another source profile.
export const leoAscendantPolicy = {
  profile: 'leo-ascendant-natal-decan-context-v1', sourceProfile: 'leo-1906-source-context-v1',
  zodiac: 'tropical', hierarchy: 'natal-before-progressed-sign-before-decan',
  decans: 'same-triplicity-zodiac-order-half-open-ten-degrees',
  rulershipBasis: 'leo-1928-fourth-edition-explicit-sign-table',
  editionCaution: 'supporting-same-author-edition-not-claimed-identical-1906-table',
  wholeSign: 'first-decan-text-applies-to-whole-sign-plus-active-decan-modifier',
  simultaneity: 'all-active-leo-aspects-at-each-half-open-intersection',
  directionProfile: 'leo-ascendant-classified-directions-by-chart-v1',
  houseDirectionProfile: 'leo-ascendant-classified-natal-house-directions-v1',
  piscesProfile: 'leo-pisces-natal-jupiter-and-ic-dsc-v1',
  significance: 'source-tendencies-for-verified-pairs-not-natal-promise-or-human-qualification',
} as const;
const normalize = (value: number) => (value % 360 + 360) % 360;

export function readLeoAscendantDivision(longitude: number) {
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) throw new RangeError('Invalid Leo ascendant longitude');
  const sign = Math.floor(longitude / 30), decan = Math.floor(longitude % 30 / 10) + 1;
  const decanSign = (sign + 4 * (decan - 1)) % 12;
  return { longitude, sign, decan, decanSign, signRuler: readLeoSignRuler(sign), decanRuler: readLeoSignRuler(decanSign) };
}

// A/B and a/b in chapter IX share a single natal and a single real interval.
// First-decan prose is a whole-sign background; the second/third decan never
// replaces it. Classify named directions separately for each target chart.
export function splitLeoAscendantContext(window: Window, ascendants: AscendantBand[], aspects: AspectBand[],
  natal: Natal, natalLongitude: number, cusps: number[]) {
  const validRange = (range: Window) => Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start < range.end;
  if (!validRange(window) || cusps.length !== 12 || !cusps.every(value => Number.isFinite(value) && value >= 0 && value < 360)
    || natalLongitude !== cusps[0] || ascendants.some((row, i) => !validRange(row)
      || i > 0 && row.start < ascendants[i - 1].end)
    || aspects.some(row => !validRange(row) || !Number.isFinite(row.allowedOrb) || row.allowedOrb <= 0
      || row.exactTimes.some(at => !Number.isFinite(at) || at < row.start || at >= row.end))) throw new RangeError('Invalid Leo ascendant context');
  const natalDivision = readLeoAscendantDivision(natalLongitude);
  for (const body of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
    const matches = natal.bodies.filter(row => row.body === body);
    if (matches.length !== 1 || !Number.isFinite(matches[0].longitude) || matches[0].longitude < 0 || matches[0].longitude >= 360
      || !Number.isFinite(matches[0].declination) || Math.abs(matches[0].declination) > 90
      || matches[0].sign !== Math.floor(matches[0].longitude / 30)) throw new RangeError('Invalid Leo natal bodies');
  }
  const sun = natal.bodies.find(body => body.body === 'Sun')!, jupiter = natal.bodies.find(body => body.body === 'Jupiter')!;
  const sunInIcDscArc = normalize(sun.longitude - cusps[3]) < normalize(cusps[6] - cusps[3]);
  const jupiterAspects = ascendants.some(row => row.sign === 11) ? natal.bodies.filter(body => body !== jupiter)
    .flatMap(body => readLeoNatalAspects(jupiter, body).map(aspect => ({ ...aspect, first: jupiter.body, second: body.body }))) : [];
  const natalJupiterSupportive = jupiterAspects.filter(row => row.aspect === 'sextile' || row.aspect === 'trine');
  const natalJupiterHard = jupiterAspects.filter(isLeoNatalSquareOrOpposition);
  // 'Very well aspected' is not defined numerically in this passage.
  const piscesNatalCondition = !sunInIcDscArc ? 'sun_outside_arc'
    : natalJupiterSupportive.length > 0 && !natalJupiterHard.length ? 'candidate' : undefined;
  const classified = new Map(classifyLeoDirections(aspects).map(({ band, nature }) => [band, nature]));
  const houseAnchors = [2, 5, 10].map(house => {
    const cuspSign = Math.floor(cusps[house - 1] / 30);
    const ruler = readLeoSignRuler(cuspSign);
    const occupants = natal.bodies.filter(body => zodiacalHouse(body.longitude, cusps) === house).map(body => body.body);
    return { house, cuspSign, ruler, occupants, targets: occupants.length ? occupants : [ruler] };
  });
  return ascendants.flatMap(ascendant => {
    const progressed = readLeoAscendantDivision(ascendant.longitude);
    if (progressed.sign !== ascendant.sign || progressed.decan !== ascendant.decan) throw new RangeError('Inconsistent Leo ascendant division');
    const start = Math.max(window.start, ascendant.start), end = Math.min(window.end, ascendant.end);
    if (start >= end) return [];
    const candidates = aspects.flatMap((aspect, sourceBandIndex) => aspect.start < end && start < aspect.end ? [{
      ...aspect, sourceBandIndex, nature: aspect.progressedBody === 'Moon' ? leoLunarNature(aspect) : classified.get(aspect),
    }] : []);
    const cuts = [...new Set([start, end, ...candidates.flatMap(aspect => [Math.max(start, aspect.start), Math.min(end, aspect.end)])])].sort((a, b) => a - b);
    const involved = new Set([natalDivision.signRuler, natalDivision.decanRuler, progressed.signRuler, progressed.decanRuler]);
    const rulerPositions = natal.bodies.filter(body => involved.has(body.body as ReturnType<typeof readLeoSignRuler>));
    const career = progressed.sign === 9;
    const earnings = career && progressed.decan === 2;
    const speculation = progressed.sign === 4 && progressed.decan === 2;
    const relevantHouses = houseAnchors.filter(({ house }) => house === 2 && earnings || house === 5 && speculation || house === 10 && career);
    return cuts.slice(0, -1).map((from, i) => {
      const to = cuts[i + 1];
      const directions = candidates.filter(aspect => aspect.start <= from && to <= aspect.end).map(aspect => ({
        progressedBody: aspect.progressedBody, natalTargetId: aspect.natalTargetId, targetKind: aspect.targetKind ?? 'natal',
        aspectType: aspect.aspectType, nature: aspect.nature,
        coordinate: aspect.coordinate, allowedOrb: aspect.allowedOrb, sourceBandIndex: aspect.sourceBandIndex,
        involvesRuler: involved.has(aspect.progressedBody as ReturnType<typeof readLeoSignRuler>) || involved.has(aspect.natalTargetId as ReturnType<typeof readLeoSignRuler>),
        exactTimes: aspect.exactTimes.filter(at => from <= at && at < to),
      }));
      const natalDirections = directions.filter(row => row.targetKind === 'natal');
      const progressedDirections = directions.filter(row => row.targetKind === 'progressed');
      const natalMercuryUranusDirectionState = progressed.sign === 10
        ? summarizeLeoDirectionNatures(natalDirections.filter(row => row.progressedBody === 'Mercury'
          && row.natalTargetId === 'Uranus' && ['sextile', 'square', 'trine'].includes(row.aspectType)).map(row => row.nature))
        : undefined;
      const favourableTargets = (layer: typeof directions) =>
        [...new Set(layer.filter(row => row.nature === 'favourable').map(row => row.natalTargetId))];
      const natalHouseDirections = relevantHouses.map(({ targets, ...anchor }) => ({ ...anchor,
        contacts: natalDirections.filter(row => targets.includes(row.natalTargetId) && (row.nature === 'favourable' || row.nature === 'adverse'))
          .map(({ progressedBody, natalTargetId, aspectType, nature }) => ({ progressedBody, natalTargetId, aspectType, nature })),
      }));
      const directionReview = speculation ? {
        hasAdverse: directions.some(row => row.nature === 'adverse'),
        hasUnresolved: directions.some(row => row.nature !== 'favourable' && row.nature !== 'adverse'),
      } : undefined;
      const pisces = progressed.sign === 11;
      return { start: from, end: to, profile: leoAscendantPolicy.profile, zodiac: leoAscendantPolicy.zodiac,
        hierarchy: leoAscendantPolicy.hierarchy, rulershipBasis: leoAscendantPolicy.rulershipBasis, natalContextReady: true,
        natalLongitude, natalSign: natalDivision.sign, natalDecan: natalDivision.decan, natalDecanSign: natalDivision.decanSign,
        natalSignRuler: natalDivision.signRuler, natalDecanRuler: natalDivision.decanRuler,
        ...progressed, longitudeSampleAt: ascendant.start + (ascendant.end - ascendant.start) / 2,
        wholeSignApplies: true, decanModifier: progressed.decan !== 1, rulerPositions,
        natalSunHouse: natal.sunHouse, dayChart: natal.dayChart,
        sunInIcDscArc, piscesProfile: pisces ? leoAscendantPolicy.piscesProfile : undefined,
        piscesNatalCondition: pisces ? piscesNatalCondition : undefined,
        natalJupiterAspectProfile: pisces ? leoNatalAspectPolicy.profile : undefined,
        natalJupiterSupportive: pisces ? natalJupiterSupportive : undefined,
        natalJupiterHard: pisces ? natalJupiterHard : undefined,
        natalJupiterSeparations: pisces ? natal.bodies.filter(body => body.body !== 'Jupiter').map(body => ({
          body: body.body, longitudeSeparation: Math.abs((body.longitude - jupiter.longitude + 540) % 360 - 180),
          absoluteDeclinationDifference: Math.abs(Math.abs(body.declination) - Math.abs(jupiter.declination)),
        })) : undefined,
        directionProfile: leoAscendantPolicy.directionProfile, directions,
        houseDirectionProfile: relevantHouses.length ? leoAscendantPolicy.houseDirectionProfile : undefined,
        natalHouseDirections: relevantHouses.length ? natalHouseDirections : undefined,
        natalHousesWithClassifiedDirections: relevantHouses.length
          ? natalHouseDirections.filter(row => row.contacts.length).map(row => row.house) : undefined,
        natalHousesWithFavourableDirections: relevantHouses.length
          ? natalHouseDirections.filter(row => row.contacts.some(contact => contact.nature === 'favourable')).map(row => row.house) : undefined,
        hasAdverseAscendantDirection: directionReview?.hasAdverse,
        hasUnresolvedAscendantDirection: directionReview?.hasUnresolved,
        natalDirectionState: summarizeLeoDirectionNatures(natalDirections.map(row => row.nature)),
        progressedDirectionState: summarizeLeoDirectionNatures(progressedDirections.map(row => row.nature)),
        natalMercuryUranusDirectionState,
        natalFavourableDirectionTargets: favourableTargets(natalDirections),
        progressedFavourableDirectionTargets: favourableTargets(progressedDirections),
        clippedStart: ascendant.start === window.start, clippedEnd: ascendant.end === window.end, geometryOnly: true };
    });
  });
}

export function buildLeoAscendantContext(window: Window, houses: ReturnType<typeof buildWesternSourceHouses>, leo: ReturnType<typeof buildLeoSourceContext>) {
  if (!('ascendant' in houses) || !houses.ascendant || !houses.frame || houses.placidus?.status !== 'ready' || leo.status !== 'ready'
    || leo.policy.profile !== leoAscendantPolicy.sourceProfile || houses.frame.birthAt !== leo.birthAt
    || leo.natalContext.houseStatus !== 'ready') return { status: 'unavailable', policy: leoAscendantPolicy } as const;
  const ascendant = leo.natalContext.ascendantLongitude, cusps = houses.placidus.cusps;
  if (ascendant === undefined || Math.abs((ascendant - cusps[0] + 540) % 360 - 180) > 1e-7
    || leo.natalContext.bodies.some(body => body.house !== zodiacalHouse(body.longitude, cusps))) {
    return { status: 'unavailable', policy: leoAscendantPolicy } as const;
  }
  return { status: 'ready', policy: leoAscendantPolicy,
    intervals: splitLeoAscendantContext(window, houses.ascendant, [...leo.intervals, ...leo.progressedPairs], leo.natalContext, cusps[0], cusps) } as const;
}
