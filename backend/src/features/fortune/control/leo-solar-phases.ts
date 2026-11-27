import { leoNatalBodies, leoSourcePolicy, readLeoMovingPosition } from './leo-source-context';
import type { GeometricBand } from './leo-source-context';
import { leoLunarNature, summarizeLeoLunarNatures } from './leo-lunar-conditions';
import { classifyLeoDirections, describeLeoDirection, isConcurrentLeoDirection, summarizeLeoDirectionNatures } from './leo-direction-support';
import { progressedAspects, progressionEpoch, progressionRealTime, scanProgressionLongitudePair } from './western-progressions';

const day = 86_400_000;
type Window = { start: number; end: number };
type SolarTarget = Exclude<typeof leoNatalBodies[number], 'Sun'>;
type NatalPosition = { body: typeof leoNatalBodies[number]; longitude: number };
type SolarPhase = 'applying-year' | 'formation-year' | 'separating-year' | 'natal-to-progressed';
type SolarPhaseObservation = Window & {
  natalTargetId: SolarTarget;
  targetKind: 'natal' | 'progressed';
  aspectType: string;
  phase: SolarPhase;
  formationAt: number;
  natalFormationAt?: number;
  phaseStart: number;
  phaseEnd: number;
};

export const leoSolarPhasePolicy = {
  profile: 'leo-1906-solar-birthday-phases-v1',
  yearBoundary: 'progression-birthday',
  zodiac: 'tropical',
  coordinate: 'ecliptic_longitude',
} as const;

export const leoSolarLunarPhasePolicy = 'leo-1906-solar-lunar-phases-v1';

type LunarQualification = 'strengthened' | 'moderated' | 'favourable-context' | 'adverse-context';
const lunarConditionRules = new Map<string, {
  favourable?: LunarQualification; adverse?: LunarQualification; adverseTarget?: SolarTarget;
  reviewOtherDirections?: 'presence' | 'nature';
  reviewSaturnFamilyContext?: true;
}>([
  ['Jupiter:conjunction', { favourable: 'favourable-context' }],
  ['Jupiter:semisextile', { favourable: 'strengthened' }],
  ['Jupiter:sesquiquadrate', { adverse: 'strengthened' }],
  ['Mars:semisquare', { favourable: 'favourable-context', adverse: 'adverse-context' }],
  ['Moon:semisextile', { favourable: 'strengthened' }],
  ['Moon:trine', { favourable: 'strengthened' }],
  ['Neptune:trine', { reviewOtherDirections: 'nature' }],
  ['Saturn:semisextile', { favourable: 'strengthened', reviewOtherDirections: 'presence' }],
  ['Saturn:semisquare', { adverseTarget: 'Saturn' }],
  ['Saturn:quincunx', { reviewSaturnFamilyContext: true }],
  ['Saturn:opposition', { adverse: 'strengthened', reviewSaturnFamilyContext: true }],
  ['Uranus:semisextile', { favourable: 'strengthened' }],
  ['Uranus:sesquiquadrate', { favourable: 'moderated', adverse: 'strengthened' }],
]);

// Chapter XI distinguishes domestic strain, steadiness, and the weaker
// restraint or reflection of the Moon–Saturn semisextile and quincunx.
const saturnLunarFamilyAspects = new Set(['conjunction', 'square', 'sesquiquadrate', 'opposition']);
const saturnLunarSteadinessAspects = new Set(['sextile', 'trine']);
const saturnLunarWeakSteadinessAspects = new Set(['semisextile', 'quincunx']);

const phaseOffsets = [
  [-1, 'applying-year'],
  [0, 'formation-year'],
  [1, 'separating-year'],
] as const;

const bridgeTargets: readonly SolarTarget[] = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const signedArc = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

// Leo's example follows the same directed contact from the fixed point to the
// moving point. Stop at a reversal or a cyclic seam instead of pairing distant,
// unrelated contacts on the same planet.
function findCrossing(errorAt: (epoch: number) => number, middle: number, birthAt: number, direction: -1 | 1) {
  let previousAt = middle, previous = errorAt(middle);
  for (let days = 1; days <= 366; days++) {
    const at = Math.max(birthAt, middle + direction * days * day);
    const error = errorAt(at);
    if (direction * (error - previous) <= 0) return undefined;
    if (direction * error >= 0) {
      let start = Math.min(previousAt, at), end = Math.max(previousAt, at);
      while (end - start > 1) {
        const point = Math.round((start + end) / 2);
        if (errorAt(point) < 0) start = point;
        else end = point;
      }
      return end;
    }
    if (at === birthAt) return undefined;
    previousAt = at;
    previous = error;
  }
}

export function buildLeoSolarPhases(window: Window, birthAt: number, natal: readonly NatalPosition[]) {
  const yearIndex = (at: number) => Math.floor((progressionEpoch(birthAt, at) - birthAt) / day);
  const yearStart = (index: number) => Math.round(progressionRealTime(birthAt, birthAt + index * day));
  const firstYear = yearIndex(window.start), lastYear = yearIndex(window.end - 1);
  const search = { start: yearStart(Math.max(firstYear - 1, 0)), end: yearStart(lastYear + 2) };

  const longitudes = new Map<number, Map<NatalPosition['body'], number>>();
  const longitudeAtEpoch = (body: NatalPosition['body'], epoch: number) => {
    let positions = longitudes.get(epoch);
    if (!positions) {
      positions = new Map();
      longitudes.set(epoch, positions);
    }
    let value = positions.get(body);
    if (value === undefined) {
      value = readLeoMovingPosition(body, epoch).longitude;
      positions.set(body, value);
    }
    return value;
  };
  const longitude = (body: NatalPosition['body'], at: number) =>
    longitudeAtEpoch(body, Math.round(progressionEpoch(birthAt, Math.max(at, birthAt))));
  const middle = Math.round(progressionEpoch(birthAt, (window.start + window.end) / 2));

  const observations: SolarPhaseObservation[] = [];
  for (const target of natal) {
    if (target.body === 'Sun') continue;
    for (const targetKind of ['natal', 'progressed'] as const) {
      const delta = (at: number) => longitude('Sun', at)
        - (targetKind === 'natal' ? target.longitude : longitude(target.body, at));
      for (const { aspectType, exactTimes } of scanProgressionLongitudePair(search, delta, 0)) {
        for (const formationAt of exactTimes) {
          const formationYear = yearIndex(formationAt);
          for (const [offset, phase] of phaseOffsets) {
            const age = formationYear + offset;
            if (age < firstYear || age > lastYear) continue;
            const phaseStart = yearStart(age), phaseEnd = yearStart(age + 1);
            const start = Math.max(window.start, phaseStart), end = Math.min(window.end, phaseEnd);
            if (start < end) observations.push({ start, end, phaseStart, phaseEnd, formationAt, phase,
              natalTargetId: target.body, targetKind, aspectType });
          }
        }
      }
    }
    // The p242 Mars quincunx uses the same Chapter X transition between two oriented contacts.
    const bridgeAspects = bridgeTargets.includes(target.body) ? progressedAspects
      : target.body === 'Mars' ? progressedAspects.filter(aspect => aspect.type === 'quincunx') : [];
    for (const { type: aspectType, angle } of bridgeAspects) {
      const offsets = angle === 0 || angle === 180 ? [angle] : [angle, -angle];
      for (const offset of offsets) {
        const natalError = (at: number) => signedArc(longitudeAtEpoch('Sun', at) - target.longitude - offset);
        const progressedError = (at: number) => signedArc(longitudeAtEpoch('Sun', at) - longitudeAtEpoch(target.body, at) - offset);
        const passed = natalError(middle), approaching = progressedError(middle);
        if (passed <= 0 || approaching >= 0 || passed - approaching >= 180) continue;
        const natalEpoch = findCrossing(natalError, middle, birthAt, -1);
        const progressedEpoch = findCrossing(progressedError, middle, birthAt, 1);
        if (natalEpoch === undefined || progressedEpoch === undefined) continue;
        const natalFormationAt = Math.round(progressionRealTime(birthAt, natalEpoch));
        const formationAt = Math.round(progressionRealTime(birthAt, progressedEpoch));
        const phaseStart = yearStart(yearIndex(natalFormationAt) + 2), phaseEnd = yearStart(yearIndex(formationAt) - 1);
        const start = Math.max(window.start, phaseStart), end = Math.min(window.end, phaseEnd);
        if (start < end) observations.push({ start, end, phaseStart, phaseEnd, formationAt, natalFormationAt,
          phase: 'natal-to-progressed', natalTargetId: target.body, targetKind: 'progressed', aspectType });
      }
    }
  }
  return observations;
}

export function buildLeoSolarLunarPhases(phases: readonly SolarPhaseObservation[], bands: readonly GeometricBand[],
  lunarHouses?: readonly (Window & { house: number; targetKind: SolarPhaseObservation['targetKind'] })[]) {
  const lunarBands = bands.filter(band => band.progressedBody === 'Moon');
  return phases.flatMap(phase => {
    const rule = lunarConditionRules.get(phase.natalTargetId + ':' + phase.aspectType);
    if (!rule) return [];
    const concurrent = lunarBands.filter(band => (band.targetKind ?? 'natal') === phase.targetKind
      && band.start < phase.end && phase.start < band.end
      && !(phase.targetKind === 'progressed' && phase.natalTargetId === 'Moon'
        && band.natalTargetId === 'Sun' && band.aspectType === phase.aspectType));
    const saturnLunarLongitudeBands = rule.reviewSaturnFamilyContext ? concurrent.filter(band =>
      band.natalTargetId === 'Saturn' && band.coordinate === 'ecliptic_longitude') : undefined;
    const saturnFamilyBands = saturnLunarLongitudeBands?.filter(band => saturnLunarFamilyAspects.has(band.aspectType));
    const saturnEighthHouseBands = phase.natalTargetId === 'Saturn' && phase.aspectType === 'quincunx'
      ? lunarHouses?.filter(house => house.house === 8 && house.targetKind === phase.targetKind
        && house.start < phase.end && phase.start < house.end) : undefined;
    const saturnSteadinessBands = phase.aspectType === 'quincunx'
      ? saturnLunarLongitudeBands?.filter(band => saturnLunarSteadinessAspects.has(band.aspectType)) : undefined;
    const saturnWeakSteadinessBands = phase.aspectType === 'quincunx'
      ? saturnLunarLongitudeBands?.filter(band => saturnLunarWeakSteadinessAspects.has(band.aspectType)) : undefined;
    // Keep each named lunar contact in its first second within the phase.
    const saturnPointEdges = phase.aspectType === 'quincunx' ? [
      ...(saturnFamilyBands ?? []), ...(saturnSteadinessBands ?? []), ...(saturnWeakSteadinessBands ?? []),
    ].flatMap(band => {
      const start = Math.max(phase.start, band.start), end = Math.min(phase.end, band.end);
      return band.exactTimes.filter(at => start <= at && at < end).flatMap(at => [at, Math.min(at + 1_000, end)]);
    }) : undefined;
    // Chapter XI describes family concerns during the Moon–Saturn parallel, including the part before formation.
    const saturnFamilyParallelBands = phase.natalTargetId === 'Saturn' && phase.aspectType === 'quincunx'
      ? concurrent.filter(band => band.natalTargetId === 'Saturn' && band.aspectType === 'parallel'
        && band.coordinate === 'equatorial_declination_of_date' && band.allowedOrb === leoSourcePolicy.parallelOrb) : undefined;
    // The lunar Neptune sections give sextile and trine the related subjective themes.
    const reviewsNeptuneTrineSupport = phase.natalTargetId === 'Neptune' && phase.aspectType === 'trine';
    // The Venus–Mars opposition has an explicit financial warning in p311.
    const neptuneTrineVenusMarsOppositions = reviewsNeptuneTrineSupport ? bands.filter(band =>
      (band.targetKind ?? 'natal') === 'natal' && band.progressedBody === 'Venus' && band.natalTargetId === 'Mars'
      && band.aspectType === 'opposition' && band.coordinate === 'ecliptic_longitude'
      && band.start < phase.end && phase.start < band.end) : undefined;
    const neptuneLunarSupportPasses = reviewsNeptuneTrineSupport ? concurrent.flatMap(band => {
      if (band.natalTargetId !== 'Neptune' || band.coordinate !== 'ecliptic_longitude'
        || (band.aspectType !== 'sextile' && band.aspectType !== 'trine')) return [];
      return band.exactTimes.filter(at => Math.max(phase.start, band.start) <= at && at < Math.min(phase.end, band.end))
        .map(at => ({ start: at, end: Math.min(at + 1_000, phase.end, band.end), aspectType: band.aspectType }));
    }) : undefined;
    const otherDirections = rule.reviewOtherDirections ? bands.filter(band => band.progressedBody !== 'Moon'
      && isConcurrentLeoDirection({ ...phase, progressedBody: 'Sun' }, band)) : [];
    const classified = rule.reviewOtherDirections === 'nature' ? classifyLeoDirections(otherDirections) : undefined;
    const oppositeLayerBands = reviewsNeptuneTrineSupport ? bands.filter(band =>
      (band.targetKind ?? 'natal') !== phase.targetKind && band.start < phase.end && phase.start < band.end) : undefined;
    const otherLayer = oppositeLayerBands && classifyLeoDirections(oppositeLayerBands.filter(band => band.progressedBody !== 'Moon'));
    const reviewedOppositeLayer = new Map(otherLayer?.map(({ band, nature }) => [band, nature]));
    const oppositeLayerNatures = oppositeLayerBands?.map(band => ({
      band, nature: band.progressedBody === 'Moon' ? leoLunarNature(band) : reviewedOppositeLayer.get(band),
    }));
    // An actual opposite-layer contact can be expressly adverse or still
    // unclassified. Neither establishes the favourable backdrop of p262.
    const neptuneTrineOppositeAdverseBands = oppositeLayerNatures?.filter(row => row.nature === 'adverse').map(row => row.band);
    const neptuneTrineOppositeUnreviewedBands = oppositeLayerNatures?.filter(row =>
      row.nature === undefined || row.nature === 'conditional').map(row => row.band);
    // The solar Jupiter sextile names material and social themes also present in p262.
    // Match the same moving Sun at the actual contact and retain each target's chart layer.
    const crossLayerSolarPasses = otherLayer && otherLayer.flatMap(({ band, ...contact }) => {
      if (contact.body !== 'Sun' || contact.passage !== 'p228' || band.coordinate !== 'ecliptic_longitude') return [];
      return band.exactTimes.filter(at => Math.max(phase.start, band.start) <= at && at < Math.min(phase.end, band.end))
        .map(start => ({ start, end: Math.min(start + 1_000, phase.end, band.end), contact }))
        .filter(pass => !otherLayer.some(({ band: contrary, nature }) => nature === 'adverse'
          && contrary.start < pass.end && pass.start < contrary.end));
    });
    const edges = [...new Set([phase.start, phase.end, ...[...concurrent, ...otherDirections,
      ...(neptuneTrineVenusMarsOppositions ?? []), ...(neptuneTrineOppositeAdverseBands ?? []),
      ...(neptuneTrineOppositeUnreviewedBands ?? [])].flatMap(band =>
      [Math.max(phase.start, band.start), Math.min(phase.end, band.end)]),
    ...(saturnPointEdges ?? []),
    ...(neptuneLunarSupportPasses ?? []).flatMap(pass => [pass.start, pass.end]),
    ...(crossLayerSolarPasses ?? []).flatMap(pass => [pass.start, pass.end])])].sort((first, second) => first - second);
    return edges.slice(0, -1).map((start, index) => {
      const end = edges[index + 1];
      const contacts = concurrent.filter(band => band.start <= start && end <= band.end).map(band => ({
        target: band.natalTargetId, aspectType: band.aspectType, nature: leoLunarNature(band),
      }));
      const targets = (nature: 'favourable' | 'adverse') => [...new Set(contacts
        .filter(contact => contact.nature === nature).map(contact => contact.target))];
      const sameLayerLunarState = summarizeLeoLunarNatures(contacts.map(contact => contact.nature));
      const lunarFavourableTargets = targets('favourable'), lunarAdverseTargets = targets('adverse');
      const active = otherDirections.filter(band => band.start <= start && end <= band.end);
      const activeClassified = classified?.filter(({ band }) => band.start <= start && end <= band.end);
      const supportingDirections = activeClassified?.map(({ band: _band, ...direction }) => direction);
      const directionSupportState = supportingDirections && summarizeLeoDirectionNatures(supportingDirections.map(row => row.nature));
      const hasUnreviewedOtherDirection = activeClassified && activeClassified.length < active.length;
      const lunarQualification = rule.adverseTarget && lunarAdverseTargets.includes(rule.adverseTarget) ? 'strengthened'
        : sameLayerLunarState === 'all_favourable' ? rule.favourable
          : sameLayerLunarState === 'all_adverse' ? rule.adverse : undefined;
      const saturnLunarExactContacts = (availableBands: readonly GeometricBand[] | undefined) => availableBands?.flatMap(band => band.exactTimes
        .filter(at => start <= at && at < end).map(at => ({ target: 'Saturn' as const,
          aspectType: band.aspectType, exactAt: new Date(at).toISOString() })));
      const saturnLunarFamilyContextContacts = saturnLunarExactContacts(saturnFamilyBands);
      // Chapter XI assesses eighth-house themes through the actual lunar aspect.
      const hasExactSaturnLunarEighthHouseContext = saturnEighthHouseBands && saturnLunarFamilyContextContacts?.some(contact => {
        const at = Date.parse(contact.exactAt);
        return saturnEighthHouseBands.some(house => house.start <= at && at < house.end);
      });
      const saturnLunarSteadinessContacts = saturnLunarExactContacts(saturnSteadinessBands);
      const saturnLunarWeakSteadinessContacts = saturnLunarExactContacts(saturnWeakSteadinessBands);
      const hasSaturnLunarFamilyParallelContext = saturnFamilyParallelBands?.some(band => band.start <= start && end <= band.end);
      const saturnLunarFamilyParallelContact = hasSaturnLunarFamilyParallelContext
        ? { target: 'Saturn' as const, targetKind: phase.targetKind, aspectType: 'parallel' as const,
          allowedOrb: leoSourcePolicy.parallelOrb, coordinate: 'equatorial_declination_of_date' as const } : undefined;
      const neptuneTrineLunarSupportContacts = neptuneLunarSupportPasses?.filter(pass => pass.start <= start && end <= pass.end)
        .map(pass => ({ target: 'Neptune' as const, aspectType: pass.aspectType, exactAt: new Date(pass.start).toISOString() }));
      const neptuneTrineCrossLayerSolarContacts = crossLayerSolarPasses?.filter(pass => pass.start <= start && end <= pass.end)
        .map(pass => ({ ...pass.contact, exactAt: new Date(pass.start).toISOString() }));
      const hasExactNeptuneTrineCrossLayerSolarSupport = neptuneTrineCrossLayerSolarContacts
        && directionSupportState === 'none' && hasUnreviewedOtherDirection === false && neptuneTrineCrossLayerSolarContacts.length > 0;
      // Keep an exact lunar contact as evidence even when a known contrary Moon aspect blocks lunar-only support.
      const lunarSupport = directionSupportState === 'none' && lunarAdverseTargets.length === 0 && neptuneTrineLunarSupportContacts?.[0];
      const neptuneTrineSupportType = reviewsNeptuneTrineSupport ? directionSupportState === 'favourable' ? 'major'
        : lunarSupport ? lunarSupport.aspectType === 'sextile' ? 'lunar-sextile' : 'lunar-trine'
          : hasExactNeptuneTrineCrossLayerSolarSupport ? 'cross-layer-solar' : 'none' : undefined;
      const hasAdverseNeptuneTrineMoonContact = reviewsNeptuneTrineSupport ? lunarAdverseTargets.length > 0 : undefined;
      const hasOppositeLayerNeptuneTrineAdverseContact = neptuneTrineOppositeAdverseBands?.some(band =>
        band.start <= start && end <= band.end);
      const hasOppositeLayerNeptuneTrineUnreviewedContact = neptuneTrineOppositeUnreviewedBands?.some(band =>
        band.start <= start && end <= band.end);
      const hasNeptuneTrineVenusMarsOpposition = neptuneTrineVenusMarsOppositions?.some(band => band.start <= start && end <= band.end);
      return { ...phase, start, end, contacts, sameLayerLunarState, lunarQualification, lunarFavourableTargets, lunarAdverseTargets,
        saturnLunarFamilyContextContacts, saturnLunarFamilyParallelContact, hasSaturnLunarFamilyParallelContext,
        hasExactSaturnLunarFamilyContext: saturnLunarFamilyContextContacts && saturnLunarFamilyContextContacts.length > 0,
        hasExactSaturnLunarEighthHouseContext,
        saturnLunarSteadinessContacts,
        hasExactSaturnLunarSteadinessContext: saturnLunarSteadinessContacts && saturnLunarSteadinessContacts.length > 0,
        saturnLunarWeakSteadinessContacts,
        hasExactSaturnLunarWeakSteadinessContext: saturnLunarWeakSteadinessContacts && saturnLunarWeakSteadinessContacts.length > 0,
        neptuneTrineSupportType, neptuneTrineLunarSupportContacts, neptuneTrineCrossLayerSolarContacts,
        hasExactNeptuneTrineCrossLayerSolarSupport, hasAdverseNeptuneTrineMoonContact, hasNeptuneTrineVenusMarsOpposition,
        hasOppositeLayerNeptuneTrineAdverseContact, hasOppositeLayerNeptuneTrineUnreviewedContact,
        otherDirection: active[0] && describeLeoDirection(active[0]),
        supportingDirections, directionSupportState, hasUnreviewedOtherDirection };
    });
  });
}
