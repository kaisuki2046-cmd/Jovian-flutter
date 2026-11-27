import { leoContactSharesEndpoint, leoSourcePolicy, leoVenusNeptuneOtherBodies, type GeometricBand, type scanLeoSolarDignities } from './leo-source-context';
import {
  classifyLeoDirections, classifyLeoTopicDirections, describeLeoDirection, isConcurrentLeoDirection, linkLeoSupportingDirection,
  supportingLeoDirections, summarizeLeoDirectionNatures,
} from './leo-direction-support';

export const leoLunarConditionPolicy = {
  profile: 'leo-1906-lunar-conditions-v1',
  nature: 'moon-chapter-by-recipient-and-aspect',
  timing: 'half-open-intersections-and-separate-natal-and-progressed-frames',
  crossChart: 'leo-1906-lunar-same-progressed-point-bridge-v1',
  venusNeptune: 'sextile-all-reviewed-contrary-directions-trine-reviewed-other-planet-pairs',
  monthlyTheme: 'leo-1906-lunar-exact-and-major-theme-v2',
  mutualSupport: 'leo-1906-mutual-support-by-slice-v1',
} as const;

// The Moon chapter describes individual pairs. Aspects whose descriptions
// depend substantially on circumstance stay conditional. Planet names and
// angles alone do not share a uniform classification.
const lunarNatureByTarget: Readonly<Record<string, { favourable: readonly string[]; adverse: readonly string[] }>> = {
  Sun: { favourable: ['semisextile', 'sextile', 'trine'], adverse: ['semisquare', 'square', 'sesquiquadrate', 'opposition'] },
  Mercury: { favourable: ['semisextile', 'sextile', 'trine', 'parallel'], adverse: ['semisquare', 'square', 'sesquiquadrate', 'opposition'] },
  Venus: { favourable: ['conjunction', 'semisextile', 'sextile', 'trine', 'parallel'], adverse: ['semisquare', 'square', 'opposition'] },
  Mars: { favourable: [], adverse: ['conjunction', 'semisquare', 'square', 'sesquiquadrate', 'opposition', 'parallel'] },
  Jupiter: { favourable: ['conjunction', 'semisextile', 'sextile', 'trine', 'parallel'], adverse: ['semisquare', 'square'] },
  Saturn: { favourable: ['semisextile', 'sextile', 'trine'], adverse: ['conjunction', 'semisquare', 'square', 'sesquiquadrate', 'opposition', 'parallel'] },
  Uranus: { favourable: ['sextile', 'trine'], adverse: ['semisquare', 'square', 'sesquiquadrate'] },
  Neptune: { favourable: [], adverse: [] },
};

export function leoLunarNature(band: Pick<GeometricBand, 'natalTargetId' | 'aspectType'>): 'favourable' | 'adverse' | 'conditional' {
  const target = lunarNatureByTarget[band.natalTargetId];
  return target?.favourable.includes(band.aspectType) ? 'favourable'
    : target?.adverse.includes(band.aspectType) ? 'adverse' : 'conditional';
}

export function summarizeLeoLunarNatures(natures: ReturnType<typeof leoLunarNature>[]) {
  const favourable = natures.includes('favourable'), adverse = natures.includes('adverse');
  if (!natures.length) return 'none';
  if (favourable && adverse) return 'mixed';
  if (natures.includes('conditional')) return 'conditional';
  return favourable ? 'all_favourable' : 'all_adverse';
}

type AdverseContactStart = { start: number; target: GeometricBand['natalTargetId']; aspectType: string };
type AdverseSequence = { end: number; first: AdverseContactStart; initialContacts: Set<string>; second?: AdverseContactStart };

// Bands may share a start when clipped to the observation window. A connected
// sequence requires a different contact to begin later than that initial group.
function connectedAdverseSequences(base: GeometricBand, concurrent: GeometricBand[]) {
  const targetKind = base.targetKind ?? 'natal';
  const bands = concurrent.filter(moon => (moon.targetKind ?? 'natal') === targetKind && leoLunarNature(moon) === 'adverse')
    .sort((first, second) => first.start - second.start);
  const sequences: AdverseSequence[] = [];
  for (const band of bands) {
    const witness = { start: band.start, target: band.natalTargetId, aspectType: band.aspectType };
    const key = `${witness.target}:${witness.aspectType}`;
    const end = Math.min(base.end, band.end);
    const current = sequences.at(-1);
    if (!current || current.end < witness.start) {
      sequences.push({ end, first: witness, initialContacts: new Set([key]) });
      continue;
    }
    current.end = Math.max(current.end, end);
    if (current.second) continue;
    if (current.first.start === witness.start) current.initialContacts.add(key);
    else if (!current.initialContacts.has(key)) current.second = witness;
  }
  return sequences.flatMap(({ end, first, second }) => second ? [{ end, first, second }] : []);
}

const basesWithDirectionSupport = new Set([
  'Venus:Jupiter:conjunction', 'Moon:Mercury:conjunction', 'Moon:Sun:quincunx', 'Sun:Neptune:trine',
  'Venus:Jupiter:parallel', 'Mercury:Saturn:parallel', 'Moon:Venus:trine', 'Sun:Neptune:sextile',
  'Mars:Saturn:square', 'Mercury:Jupiter:sesquiquadrate', 'Moon:Jupiter:sextile', 'Moon:Jupiter:sesquiquadrate', 'Moon:Jupiter:parallel',
  'Moon:Mars:semisquare', 'Moon:Mars:sesquiquadrate', 'Moon:Mars:parallel', 'Moon:Mercury:sesquiquadrate',
  'Moon:Uranus:semisquare', 'Moon:Uranus:sesquiquadrate', 'Moon:Uranus:parallel', 'Moon:Venus:opposition',
  'Mars:Uranus:sextile', 'Mercury:Jupiter:trine', 'Moon:Sun:square', 'Moon:Venus:sesquiquadrate',
  'Sun:Saturn:parallel', 'Venus:Saturn:parallel', 'Moon:Uranus:quincunx',
  'Mars:Saturn:trine', 'Mars:Saturn:opposition', 'Mercury:Jupiter:quincunx', 'Mercury:Jupiter:parallel',
  'Moon:Saturn:sesquiquadrate', 'Moon:Sun:opposition', 'Venus:Jupiter:semisextile', 'Venus:Uranus:conjunction',
  'Mars:Saturn:conjunction', 'Mars:Saturn:semisquare', 'Sun:Uranus:square',
  'Venus:Jupiter:semisquare', 'Venus:Jupiter:opposition', 'Venus:Saturn:square', 'Venus:Saturn:quincunx',
  'Mars:Jupiter:conjunction', 'Mars:Jupiter:quincunx', 'Venus:Mars:quincunx', 'Sun:Jupiter:parallel', 'Sun:Venus:parallel',
]);

const basesWithOtherDirection = new Set(['Mercury:Mars:quincunx', 'Mercury:Mars:parallel', 'Moon:Mercury:parallel', 'Sun:Saturn:semisextile']);
const isVenusNeptuneOtherPlanetPair = ({ progressedBody, natalTargetId }: GeometricBand) =>
  leoVenusNeptuneOtherBodies.has(progressedBody) && leoVenusNeptuneOtherBodies.has(natalTargetId);
// Leo and Green, The Horoscope in Detail, p. 8. Use aspect geometry for
// the supplementary progressed chart. Leave its variable and weak contacts open.
const leoAdversePlanetPairAspects = new Set(['semisquare', 'square', 'sesquiquadrate', 'opposition']);
const leoFavourablePlanetPairAspects = new Set(['semisextile', 'sextile', 'trine']);
const monthlyLunarThemes: Readonly<Record<string, 'monthlyAttachment' | 'monthlyFinance'>> = {
  'Moon:Mars:semisquare': 'monthlyAttachment',
  'Moon:Mars:sesquiquadrate': 'monthlyAttachment',
  'Moon:Mercury:sesquiquadrate': 'monthlyAttachment',
  'Moon:Sun:square': 'monthlyAttachment',
  'Moon:Sun:opposition': 'monthlyAttachment',
  'Moon:Uranus:sesquiquadrate': 'monthlyAttachment',
  'Moon:Uranus:quincunx': 'monthlyAttachment',
  'Moon:Uranus:parallel': 'monthlyAttachment',
  'Moon:Venus:conjunction': 'monthlyAttachment',
  'Moon:Venus:semisextile': 'monthlyAttachment',
  'Moon:Venus:semisquare': 'monthlyAttachment',
  'Moon:Venus:sextile': 'monthlyAttachment',
  'Moon:Venus:square': 'monthlyAttachment',
  'Moon:Venus:trine': 'monthlyAttachment',
  'Moon:Venus:sesquiquadrate': 'monthlyAttachment',
  'Moon:Venus:quincunx': 'monthlyAttachment',
  'Moon:Venus:opposition': 'monthlyAttachment',
  'Moon:Jupiter:semisextile': 'monthlyFinance',
  'Moon:Jupiter:semisquare': 'monthlyFinance',
  'Moon:Saturn:semisextile': 'monthlyFinance',
};

function crossChartDirectionLinks<T extends GeometricBand>(
  base: T, natalBridgeBands: readonly GeometricBand[], directions: ReturnType<typeof classifyLeoDirections<T>>,
) {
  const baseKind = base.targetKind ?? 'natal';
  const matchingNatalAspects = baseKind === 'natal' ? natalBridgeBands.filter(band =>
    (band.targetKind ?? 'natal') === 'natal' && band.coordinate === 'ecliptic_longitude'
    && band.natalTargetId === base.natalTargetId && band.start < base.end && base.start < band.end) : [];
  return directions.flatMap(({ band, ...direction }) => {
    if (direction.targetKind === baseKind || band.start >= base.end || base.start >= band.end) return [];
    // The natal connection must reach the actual progressed point of the direction.
    // A planet with the same name at its birth position does not connect the two charts.
    const bridges = baseKind === 'natal' ? matchingNatalAspects.filter(bridge =>
      bridge.progressedBody === band.progressedBody || bridge.progressedBody === band.natalTargetId)
      : band.coordinate === 'ecliptic_longitude' && [base.progressedBody, base.natalTargetId].includes(band.progressedBody)
        ? [band] : [];
    return bridges.flatMap(bridge => {
      const start = Math.max(base.start, band.start, bridge.start);
      const end = Math.min(base.end, band.end, bridge.end);
      return start < end ? [{ start, end, direction, progressedPoint: bridge.progressedBody,
        natalContact: describeLeoDirection(bridge) }] : [];
    });
  });
}

export function buildLeoLunarConditions<T extends GeometricBand>(bands: T[], solarDignities: ReturnType<typeof scanLeoSolarDignities> = [],
  natalBridgeBands: readonly GeometricBand[] = [], scannedProgressedPairs?: readonly GeometricBand[],
  slowContraryPairs?: readonly GeometricBand[], additionalNatalContraryPairs?: {
    sextile?: readonly GeometricBand[];
    trine?: readonly GeometricBand[];
    venusJupiter?: readonly GeometricBand[];
  }, lunarStudyHouses?: readonly { start: number; end: number; targetKind: 'natal' | 'progressed';
    house: number; houseProfile: string }[]) {
  const moonBands = bands.filter(band => band.progressedBody === 'Moon');
  const sunBands = bands.filter(band => band.progressedBody === 'Sun');
  const sameChartSolar = sunBands.filter(band => band.targetKind === 'progressed' && band.natalTargetId !== 'Moon');
  const majorBands = bands.filter(band => band.progressedBody !== 'Moon');
  const progressedOtherPlanetPairs = scannedProgressedPairs && [...scannedProgressedPairs, ...(slowContraryPairs ?? [])]
    // The same-chart Sun–Moon angle appears in both directed orderings.
    .filter(band => band.targetKind === 'progressed' && !(band.progressedBody === 'Sun' && band.natalTargetId === 'Moon'));
  const classified = classifyLeoDirections(majorBands);
  const additionalJupiterDirections = additionalNatalContraryPairs?.venusJupiter;
  const venusJupiterMajorBands = additionalJupiterDirections && progressedOtherPlanetPairs && slowContraryPairs
    ? [...majorBands.filter(band => band.targetKind !== 'progressed'), ...additionalJupiterDirections,
      ...progressedOtherPlanetPairs].filter(band => band.progressedBody !== 'Moon')
    : undefined;
  const venusJupiterClassified = venusJupiterMajorBands && classifyLeoDirections(venusJupiterMajorBands);
  const natalSextileCounterNatures = additionalNatalContraryPairs?.sextile && classifyLeoDirections([...additionalNatalContraryPairs.sextile]);
  const directionNatures = new Map<GeometricBand, 'favourable' | 'adverse'>(
    [...classified, ...(natalSextileCounterNatures ?? []), ...(venusJupiterClassified ?? [])].map(({ band, nature }) => [band, nature]));
  const speculation = classifyLeoTopicDirections(bands, 'speculation');
  const travel = classifyLeoTopicDirections(bands, 'travel');
  const correspondence = classifyLeoTopicDirections(bands, 'correspondence');
  const friendship = classifyLeoTopicDirections(bands, 'friendship');
  const study = classifyLeoTopicDirections(moonBands, 'study');
  const dispute = classifyLeoTopicDirections(moonBands, 'dispute');
  const metaphysical = classifyLeoTopicDirections(moonBands, 'metaphysical');
  const uranianMetaphysicalMutual = classified.filter(({ body, target, targetKind, aspectType, nature }) =>
    body === 'Mercury' && target === 'Uranus' && targetKind === 'natal' && nature === 'favourable'
    && (aspectType === 'sextile' || aspectType === 'trine'));
  const relocation = classifyLeoTopicDirections(moonBands, 'relocation');
  const monthlyMajorCandidates = {
    monthlyAttachment: classifyLeoTopicDirections(majorBands, 'monthlyAttachment'),
    monthlyFinance: classifyLeoTopicDirections(majorBands, 'monthlyFinance'),
  };
  const mutual = classified.filter(({ body, target }) => body !== 'Sun' && target !== 'Sun' && target !== 'Moon');
  return bands.flatMap(base => {
    const targetKind = base.targetKind ?? 'natal';
    const overlapsBase = (band: Pick<GeometricBand, 'start' | 'end'>) => base.start < band.end && band.start < base.end;
    const concurrent = moonBands.filter(moon => {
      if (!overlapsBase(moon)) return false;
      if ((moon.targetKind ?? 'natal') !== targetKind || moon.aspectType !== base.aspectType) return true;
      // A repeated or reciprocal record of the base direction is not another contact.
      const repeatsBase = base.progressedBody === 'Moon' && moon.natalTargetId === base.natalTargetId;
      const mirrorsBase = targetKind === 'progressed' && base.natalTargetId === 'Moon'
        && moon.natalTargetId === base.progressedBody;
      return !repeatsBase && !mirrorsBase;
    });
    // The Mars–Saturn sesquiquadrate refers back to the semisquare's discussion.
    const checksLuminaries = base.progressedBody === 'Mars' && base.natalTargetId === 'Saturn'
      && (base.aspectType === 'semisquare' || base.aspectType === 'sesquiquadrate');
    const solarLinks = checksLuminaries ? sunBands.filter(sun => overlapsBase(sun) && leoContactSharesEndpoint(base, sun)) : [];
    const checksAdverseSequence = (base.progressedBody === 'Mars' && base.natalTargetId === 'Jupiter' && base.aspectType === 'opposition')
      || (base.progressedBody === 'Mercury' && base.natalTargetId === 'Uranus' && base.aspectType === 'quincunx');
    const adverseSequences = checksAdverseSequence ? connectedAdverseSequences(base, concurrent) : undefined;
    const baseKey = [base.progressedBody, base.natalTargetId, base.aspectType].join(':');
    const checksNeptuneLunarSupport = targetKind === 'natal' && baseKey === 'Mercury:Neptune:semisextile';
    // Chapter XI describes the sextile and trine as useful for receptive and creative tendencies.
    const neptuneLunarSupport = checksNeptuneLunarSupport ? concurrent.filter(band =>
      (band.targetKind ?? 'natal') === 'natal' && band.natalTargetId === 'Neptune'
      && (band.aspectType === 'sextile' || band.aspectType === 'trine')) : undefined;
    const venusUranusLunarReview = baseKey === 'Venus:Uranus:quincunx';
    const reviewsMarsJupiterQuincunx = baseKey === 'Mars:Jupiter:quincunx'
      && base.coordinate === 'ecliptic_longitude' && base.allowedOrb === leoSourcePolicy.longitudeOrb;
    const reviewsMarsSaturnParallel = baseKey === 'Mars:Saturn:parallel'
      && base.coordinate === 'equatorial_declination_of_date' && base.allowedOrb === leoSourcePolicy.parallelOrb;
    const checksExactMarsSaturnEndpoints = targetKind === 'natal' && baseKey === 'Mars:Saturn:semisquare';
    const passesInBase = (band: GeometricBand) => {
      const start = Math.max(base.start, band.start), end = Math.min(base.end, band.end);
      return band.exactTimes.filter(at => start <= at && at < end)
        .map(at => ({ start: at, end: Math.min(at + 1_000, end), target: band.natalTargetId }));
    };
    // The trine passage names strength and tact for this very same pair.
    const marsSaturnParallelTrinePasses = reviewsMarsSaturnParallel ? majorBands.flatMap(band =>
      band.progressedBody === 'Mars' && band.natalTargetId === 'Saturn' && band.targetKind === targetKind
        && band.aspectType === 'trine' && band.coordinate === 'ecliptic_longitude' ? passesInBase(band) : []) : undefined;
    const passesAtSharedEndpoint = (band: GeometricBand) => leoContactSharesEndpoint(base, band) ? passesInBase(band) : [];
    const endpointPasses = venusUranusLunarReview || checksExactMarsSaturnEndpoints
      ? concurrent.flatMap(passesAtSharedEndpoint) : undefined;
    // Chapter XI treats Moon–Uranus parallel as an extended susceptibility
    // context. Preserve its checked band independently of a lunar exact point.
    const uranianLunarParallelBands = venusUranusLunarReview ? concurrent.filter(band =>
      band.targetKind === targetKind && band.natalTargetId === 'Uranus' && band.aspectType === 'parallel'
      && band.coordinate === 'equatorial_declination_of_date' && band.allowedOrb === leoSourcePolicy.parallelOrb) : undefined;
    // Chapter XI also describes the Moon–Venus parallel as sustained. Here
    // Venus must be the moving endpoint of the quincunx in either target layer.
    const venusLunarParallelBands = venusUranusLunarReview ? concurrent.filter(band =>
      band.targetKind === 'progressed' && band.natalTargetId === 'Venus' && band.aspectType === 'parallel'
      && band.coordinate === 'equatorial_declination_of_date' && band.allowedOrb === leoSourcePolicy.parallelOrb) : undefined;
    const solarEndpointPasses = checksExactMarsSaturnEndpoints ? solarLinks.flatMap(band =>
      passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }))) : undefined;
    // Solar opposition in Chapter X names suggestibility to other people, the theme of p340.
    const uranianOppositionBands = venusUranusLunarReview ? sunBands.filter(band => overlapsBase(band)
      && band.natalTargetId === 'Uranus' && band.aspectType === 'opposition' && band.coordinate === 'ecliptic_longitude'
      && leoContactSharesEndpoint(base, band)) : undefined;
    const uranianOppositionPasses = uranianOppositionBands?.flatMap(passesInBase);
    // Chapter XII gives each Venus–Neptune square the same affective theme,
    // with the natal and progressed Neptune contacts kept separate.
    const venusNeptuneSensitivityPasses = venusUranusLunarReview ? majorBands.flatMap(band => {
      if (band.progressedBody !== base.progressedBody || !band.targetKind || band.natalTargetId !== 'Neptune'
        || band.aspectType !== 'square' || band.coordinate !== 'ecliptic_longitude') return [];
      return passesInBase(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    // The Moon–Neptune semisquare and square name the same interpersonal theme.
    const moonNeptuneSensitivityPasses = venusUranusLunarReview ? concurrent.flatMap(band => {
      if ((band.targetKind ?? 'natal') !== targetKind || band.natalTargetId !== 'Neptune'
        || (band.aspectType !== 'semisquare' && band.aspectType !== 'square') || band.coordinate !== 'ecliptic_longitude') return [];
      return passesInBase(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    // Chapter XII gives the same Venus–Uranus pair a longer parallel
    // background of spontaneous feeling. Review it at quincunx formation.
    const venusUranusParallelBands = venusUranusLunarReview ? majorBands.filter(band =>
      band.progressedBody === 'Venus' && band.targetKind === targetKind && band.natalTargetId === 'Uranus'
      && band.aspectType === 'parallel' && band.coordinate === 'equatorial_declination_of_date'
      && band.allowedOrb === leoSourcePolicy.parallelOrb && overlapsBase(band)) : undefined;
    // Chapter X links these longitude contacts to original and metaphysical thought, as does p286.
    const uranianMetaphysicalSolarPasses = baseKey === 'Sun:Uranus:parallel' ? sunBands.flatMap(band => {
      if (band.natalTargetId !== 'Uranus') return [];
      // Chapter X names Uranus at birth for the qualifying condition,
      // while the two contemporaneous directions must use the same endpoint.
      const quincunx = band.targetKind === targetKind && band.aspectType === 'quincunx'
        && band.coordinate === 'ecliptic_longitude' && band.hasNatalUranusAffliction === false;
      const passage = band.aspectType === 'semisextile' && band.coordinate === 'ecliptic_longitude' ? 'p278'
        : band.aspectType === 'sextile' ? 'p280' : band.aspectType === 'trine' ? 'p282' : quincunx ? 'p284' : undefined;
      if (!passage) return [];
      return passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: { ...describeLeoDirection(band), passage } }));
    }) : undefined;
    // Chapter XII treats the natal and same-chart directions separately.
    // The same-chart sextile and trine speak to the same research theme.
    const uranianMetaphysicalMercuryPasses = baseKey === 'Sun:Uranus:parallel' ? majorBands.flatMap(band => {
      if (band.progressedBody !== 'Mercury' || band.natalTargetId !== 'Uranus' || band.targetKind !== targetKind
        || band.coordinate !== 'ecliptic_longitude') return [];
      const passage = targetKind === 'natal' && band.aspectType === 'semisextile' ? 'p118'
        : targetKind === 'progressed' && band.aspectType === 'sextile' ? 'p120'
          : targetKind === 'progressed' && band.aspectType === 'trine' ? 'p122' : undefined;
      return passage ? passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: { ...describeLeoDirection(band), passage } })) : [];
    }) : undefined;
    // Chapter XI names new ideas and study in the sextile and trine to Uranus.
    const uranianMetaphysicalMoonBands = baseKey === 'Sun:Uranus:parallel' ? concurrent.filter(band =>
      band.natalTargetId === 'Uranus' && band.targetKind === targetKind && band.coordinate === 'ecliptic_longitude'
      && (band.aspectType === 'sextile' || band.aspectType === 'trine')) : undefined;
    const describeUranianMoonDirection = (band: GeometricBand) => ({ ...describeLeoDirection(band),
      passage: band.aspectType === 'sextile' ? 'p208' as const : 'p210' as const,
    });
    const uranianMetaphysicalMoonPasses = uranianMetaphysicalMoonBands?.flatMap(band =>
      passesInBase(band).map(pass => ({ ...pass, direction: describeUranianMoonDirection(band) })));
    // p206 separately names a weak opportunity for new ways of thinking.
    // Keep it separate from the stronger lunar contacts and their joint branches.
    const reviewsSunUranusParallel = baseKey === 'Sun:Uranus:parallel'
      && base.coordinate === 'equatorial_declination_of_date' && base.allowedOrb === leoSourcePolicy.parallelOrb;
    // Chapter XI gives lunar residence in VIII and IX a research theme. Its
    // testimony ends at the actual cusp crossing of the relevant chart.
    const uranianMoonStudyHouses = reviewsSunUranusParallel ? lunarStudyHouses?.filter(row =>
      row.targetKind === targetKind && row.start < base.end && base.start < row.end) : undefined;
    const uranianMetaphysicalMinorMoonPasses = reviewsSunUranusParallel ? concurrent.flatMap(band =>
      band.natalTargetId === 'Uranus' && band.targetKind === targetKind && band.coordinate === 'ecliptic_longitude'
        && band.aspectType === 'semisextile'
        ? passesInBase(band).map(pass => ({ ...pass, direction: { ...describeLeoDirection(band), passage: 'p206' as const } }))
        : []) : undefined;
    // p205 names original thought and study for people already receptive
    // to that activity. Keep its mixed interpretation separate from the trine and sextile.
    const uranianMetaphysicalMoonConjunctionPasses = reviewsSunUranusParallel ? concurrent.flatMap(band =>
      band.natalTargetId === 'Uranus' && band.targetKind === targetKind && band.coordinate === 'ecliptic_longitude'
        && band.aspectType === 'conjunction'
        ? passesInBase(band).map(pass => ({ ...pass, direction: { ...describeLeoDirection(band), passage: 'p205' as const } }))
        : []) : undefined;
    // Chapter XII explicitly associates Venus trine Uranus with the same study theme.
    const uranianMetaphysicalVenusPasses = reviewsSunUranusParallel
      ? majorBands.flatMap(band => band.progressedBody === 'Venus' && band.natalTargetId === 'Uranus'
        && band.aspectType === 'trine' && band.coordinate === 'ecliptic_longitude' && band.targetKind === targetKind
        ? passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: { ...describeLeoDirection(band), passage: 'p338' as const } })) : [])
      : undefined;
    // These passages explicitly distinguish the adverse lunar activation from the slower base direction.
    const checksAdverseMoonEndpoint = reviewsMarsSaturnParallel || reviewsMarsJupiterQuincunx
      || targetKind === 'natal' && (baseKey === 'Mars:Jupiter:square' || baseKey === 'Mars:Saturn:semisquare');
    // Chapter XI interprets lunar contacts to natal and progressed places
    // separately. A progressed contact must reach the moving endpoint.
    const adverseMoonEndpointPasses = checksAdverseMoonEndpoint ? concurrent.flatMap(band => {
      const marsSaturnLunarParallel = baseKey === 'Mars:Saturn:parallel' && band.aspectType === 'parallel'
        && band.coordinate === 'equatorial_declination_of_date' && band.allowedOrb === leoSourcePolicy.parallelOrb;
      if (!band.targetKind || (band.coordinate !== 'ecliptic_longitude' && !marsSaturnLunarParallel)
        || leoLunarNature(band) !== 'adverse') return [];
      return passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    // Moon–Mars and Moon–Saturn parallels also operate throughout their
    // checked bands. Neither requires absolute declinations to reach equality.
    const marsSaturnLunarParallelBands = reviewsMarsSaturnParallel && scannedProgressedPairs !== undefined ? concurrent.filter(band =>
        band.targetKind && band.aspectType === 'parallel' && band.coordinate === 'equatorial_declination_of_date'
        && band.allowedOrb === leoSourcePolicy.parallelOrb && leoContactSharesEndpoint(base, band)) : undefined;
    // Chapter XI calls Moon square Neptune adverse. Use this third-body
    // witness only where the source asks about the general lunar directions.
    const isMoonNeptuneSquare = (band: GeometricBand) => band.natalTargetId === 'Neptune' && band.aspectType === 'square'
      && band.coordinate === 'ecliptic_longitude';
    const isProgressedMoonNeptuneSquare = (band: GeometricBand) => band.targetKind === 'progressed' && isMoonNeptuneSquare(band);
    const reviewsMoonNeptuneSquare = targetKind === 'natal'
      && (baseKey === 'Mars:Jupiter:quincunx' || baseKey === 'Mars:Saturn:parallel');
    const natalMoonNeptuneSquarePasses = reviewsMoonNeptuneSquare ? concurrent.flatMap(band =>
      band.targetKind === 'natal' && isMoonNeptuneSquare(band) ? passesInBase(band) : []) : undefined;
    // Both passages ask about adverse lunar directions generally. Keep a
    // different point separate from the original endpoints and Neptune exception.
    const neptuneLunarMinorAdversePasses = (reviewsMarsSaturnParallel || reviewsMarsJupiterQuincunx)
      && scannedProgressedPairs !== undefined ? concurrent.flatMap(band => {
        if (!band.targetKind || band.natalTargetId !== 'Neptune' || band.coordinate !== 'ecliptic_longitude'
          || band.aspectType !== 'semisquare' && band.aspectType !== 'sesquiquadrate') return [];
        return passesInBase(band).map(pass => ({ ...pass, band }));
      }) : undefined;
    const otherAdverseMoonPasses = (includeProgressedNeptuneSquare: boolean) => concurrent.flatMap(band => {
      if (!band.targetKind || band.coordinate !== 'ecliptic_longitude' || leoContactSharesEndpoint(base, band)
        || leoLunarNature(band) !== 'adverse' && !(includeProgressedNeptuneSquare && isProgressedMoonNeptuneSquare(band))) return [];
      return passesInBase(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    });
    const marsSaturnOtherMoonPasses = reviewsMarsSaturnParallel && scannedProgressedPairs !== undefined
      ? otherAdverseMoonPasses(true) : undefined;
    const marsJupiterOtherMoonPasses = reviewsMarsJupiterQuincunx && scannedProgressedPairs !== undefined
      ? otherAdverseMoonPasses(false) : undefined;
    // Chapter XI gives adverse readings for the lunar parallels to Mars and Saturn throughout their bands.
    const marsJupiterAdverseLunarParallelBands = marsJupiterOtherMoonPasses && concurrent.filter(band =>
      band.targetKind && band.aspectType === 'parallel' && band.coordinate === 'equatorial_declination_of_date'
      && band.allowedOrb === leoSourcePolicy.parallelOrb && leoLunarNature(band) === 'adverse');
    const checksFavourableMovingMoon = targetKind === 'natal'
      && (baseKey === 'Mercury:Jupiter:quincunx' || baseKey === 'Venus:Jupiter:conjunction');
    const favourableMovingMoonPasses = checksFavourableMovingMoon ? concurrent.flatMap(band => {
      if (band.targetKind !== 'progressed' || band.coordinate !== 'ecliptic_longitude' || leoLunarNature(band) !== 'favourable') return [];
      return passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    const favourableNatalMoonPasses = targetKind === 'natal' && baseKey === 'Venus:Jupiter:conjunction' ? concurrent.flatMap(band => {
      if (band.targetKind !== 'natal' || band.coordinate !== 'ecliptic_longitude'
        || !['conjunction', 'sextile', 'trine'].includes(band.aspectType)) return [];
      return passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    // Chapter XI gives a mild contrary theme for the exact Moon–Neptune
    // sesquiquadrate even in the ordinary case. Do not classify all lunar Neptune bands.
    const neptuneLunarContraryPasses = targetKind === 'natal' && baseKey === 'Venus:Neptune:sextile' ? concurrent.flatMap(band => {
      if (band.targetKind !== 'natal' || band.coordinate !== 'ecliptic_longitude' || band.aspectType !== 'sesquiquadrate') return [];
      return passesAtSharedEndpoint(band).map(pass => ({ ...pass, direction: describeLeoDirection(band) }));
    }) : undefined;
    // An observed formation belongs to its own instant, independently of
    // longer slices that have a distinct supporting lunar or planetary direction.
    const observesFormation = base.coordinate === 'ecliptic_longitude' && (baseKey === 'Moon:Uranus:quincunx' || venusUranusLunarReview
      || reviewsMarsJupiterQuincunx || targetKind === 'natal' && (baseKey === 'Mars:Saturn:trine' || baseKey === 'Mars:Saturn:semisquare'
        || baseKey === 'Mars:Jupiter:square'
        || baseKey === 'Mercury:Jupiter:quincunx' || baseKey === 'Mercury:Uranus:quincunx'
        || baseKey === 'Venus:Jupiter:conjunction'
        || baseKey === 'Venus:Neptune:sextile' || baseKey === 'Venus:Neptune:trine'));
    const formationPasses = observesFormation
      ? base.exactTimes.filter(at => base.start <= at && at < base.end)
        .map(at => ({ start: at, end: Math.min(at + 1_000, base.end) })) : [];
    const exactPasses = [...(endpointPasses ?? []), ...(solarEndpointPasses ?? []),
      ...(uranianOppositionPasses ?? []), ...(uranianMetaphysicalSolarPasses ?? []), ...(venusNeptuneSensitivityPasses ?? []),
      ...(moonNeptuneSensitivityPasses ?? []),
      ...(uranianMetaphysicalMercuryPasses ?? []), ...(uranianMetaphysicalMoonPasses ?? []), ...(uranianMetaphysicalMinorMoonPasses ?? []),
      ...(uranianMetaphysicalMoonConjunctionPasses ?? []), ...(uranianMetaphysicalVenusPasses ?? []),
      ...(adverseMoonEndpointPasses ?? []), ...(favourableMovingMoonPasses ?? []), ...(favourableNatalMoonPasses ?? []),
      ...(neptuneLunarContraryPasses ?? []), ...(natalMoonNeptuneSquarePasses ?? []),
      ...(marsSaturnOtherMoonPasses ?? []), ...(marsJupiterOtherMoonPasses ?? []), ...(neptuneLunarMinorAdversePasses ?? []),
      ...(marsSaturnParallelTrinePasses ?? []), ...formationPasses];
    // Both passages discuss responding impulsively to other people. The lunar
    // contact may occur while the solar direction is already in force.
    const uranianSensitivity = baseKey === 'Moon:Uranus:quincunx' ? sunBands.filter(band =>
      band.natalTargetId === 'Uranus' && band.aspectType === 'opposition' && isConcurrentLeoDirection(base, band)) : undefined;
    const monthlyLunarTheme = monthlyLunarThemes[baseKey];
    const monthlyMajor = monthlyLunarTheme && supportingLeoDirections(base, monthlyMajorCandidates[monthlyLunarTheme]);
    const lunarJupiterSextile = targetKind === 'natal' && baseKey === 'Moon:Jupiter:sextile';
    const lunarJupiterParallel = baseKey === 'Moon:Jupiter:parallel';
    const marsNeptuneTrine = targetKind === 'natal' && baseKey === 'Mars:Neptune:trine';
    const mercuryJupiter = targetKind === 'natal' && base.progressedBody === 'Mercury' && base.natalTargetId === 'Jupiter';
    const mercuryJupiterSemisextile = mercuryJupiter && base.aspectType === 'semisextile';
    const mercuryJupiterSextile = mercuryJupiter && base.aspectType === 'sextile';
    const mercuryJupiterOpposition = mercuryJupiter && base.aspectType === 'opposition';
    const mercurySaturn = targetKind === 'natal' && base.progressedBody === 'Mercury' && base.natalTargetId === 'Saturn';
    const mercurySaturnSemisextile = mercurySaturn && base.aspectType === 'semisextile';
    const mercurySaturnTrine = mercurySaturn && base.aspectType === 'trine';
    const mercurySaturnOpposition = mercurySaturn && base.aspectType === 'opposition';
    const mercuryUranus = targetKind === 'natal' && base.progressedBody === 'Mercury' && base.natalTargetId === 'Uranus';
    const mercuryUranusSemisextile = mercuryUranus && base.aspectType === 'semisextile';
    const mercuryUranusTrine = mercuryUranus && base.aspectType === 'trine';
    const mercuryUranusSesquiquadrate = mercuryUranus && base.aspectType === 'sesquiquadrate';
    const mercuryUranusParallel = mercuryUranus && base.aspectType === 'parallel';
    const mercuryVenus = targetKind === 'natal' && base.progressedBody === 'Mercury' && base.natalTargetId === 'Venus';
    const mercuryVenusSemisquare = mercuryVenus && base.aspectType === 'semisquare';
    const mercuryVenusSocial = mercuryVenus && ['conjunction', 'semisquare', 'parallel'].includes(base.aspectType);
    const mercurySupport = (directions: typeof correspondence) => supportingLeoDirections(base, directions)
      .filter(({ body }) => mercuryJupiterSemisextile || body === 'Moon');
    const principalFor = (directions: typeof speculation) => supportingLeoDirections(base, directions).filter(({ body }) => body !== 'Moon');
    const speculationCandidates = lunarJupiterSextile ? principalFor(speculation)
      : mercurySaturnTrine || mercuryUranusTrine ? mercurySupport(speculation)
        : targetKind === 'natal' && (baseKey === 'Mars:Jupiter:trine' || marsNeptuneTrine) ? supportingLeoDirections(base, speculation) : undefined;
    const travelCandidates = mercuryUranusSesquiquadrate || mercuryUranusParallel ? mercurySupport(travel)
      : marsNeptuneTrine || mercuryJupiterSemisextile ? supportingLeoDirections(base, travel) : undefined;
    const correspondenceCandidates = mercuryJupiterSemisextile || mercuryJupiterOpposition || mercurySaturnTrine || mercurySaturnOpposition
        || mercuryUranusTrine || mercuryUranusSesquiquadrate || mercuryVenusSemisquare
      ? mercurySupport(correspondence) : undefined;
    const friendshipCandidates = lunarJupiterSextile ? principalFor(friendship)
      : mercuryJupiterSemisextile || mercuryJupiterSextile || mercuryJupiterOpposition || mercuryUranusSesquiquadrate || mercuryVenusSocial
        ? mercurySupport(friendship) : undefined;
    const studyCandidates = mercurySaturnSemisextile || mercurySaturnTrine || mercurySaturnOpposition
      ? supportingLeoDirections(base, study) : undefined;
    const disputeCandidates = mercurySaturnOpposition ? supportingLeoDirections(base, dispute) : undefined;
    const metaphysicalCandidates = baseKey === 'Sun:Uranus:parallel'
      ? metaphysical.filter(({ band }) => band.natalTargetId === 'Uranus' && overlapsBase(band) && leoContactSharesEndpoint(base, band))
      : mercuryUranusSemisextile || mercuryUranusTrine ? supportingLeoDirections(base, metaphysical) : undefined;
    // Leo p120 and p122 explicitly give the mental and metaphysical topic of
    // p286. Pair the two directions only through the same natal Uranus.
    const uranianMetaphysicalMutualCandidates = baseKey === 'Sun:Uranus:parallel' && targetKind === 'natal'
      ? supportingLeoDirections(base, uranianMetaphysicalMutual) : undefined;
    const relocationCandidates = mercuryUranusSesquiquadrate || mercuryUranusParallel ? supportingLeoDirections(base, relocation) : undefined;
    const checksCrossChart = baseKey === 'Moon:Mercury:conjunction'
      || targetKind === 'natal' && baseKey === 'Moon:Sun:quincunx';
    const crossChartLinks = checksCrossChart ? crossChartDirectionLinks(base, natalBridgeBands, classified) : undefined;
    const progressedSolar = baseKey === 'Moon:Sun:parallel' ? sameChartSolar.filter(overlapsBase) : undefined;
    const solarPlacements = progressedSolar && solarDignities.filter(overlapsBase);
    // A same-chart Mars can only be shared with a natal direction as its moving endpoint.
    const natalSolarMarsSupport = baseKey === 'Sun:Mars:semisextile' ? classified.filter(({ band, nature }) =>
      nature === 'favourable' && (band.targetKind ?? 'natal') === 'natal' && overlapsBase(band)
        && (targetKind === 'progressed' || isConcurrentLeoDirection(base, band))
        && (band.progressedBody === 'Sun' || band.progressedBody === 'Mars' && targetKind === 'progressed'
          || band.natalTargetId === 'Mars' && targetKind === 'natal')) : undefined;
    const checksLunarBridge = baseKey === 'Venus:Jupiter:conjunction';
    const reviewsMutualSupport = checksFavourableMovingMoon || targetKind === 'natal' && baseKey === 'Mars:Saturn:trine';
    const checksBothCharts = checksLunarBridge && targetKind === 'natal' && venusJupiterMajorBands !== undefined;
    const venusJupiterSupportScope = checksBothCharts ? 'both-chart-planetary-pairs' as const : undefined;
    const isRelevantDirection = (band: GeometricBand) => checksBothCharts && band.targetKind === 'progressed'
      ? overlapsBase(band) : isConcurrentLeoDirection(base, band);
    const majorReviewBands = checksBothCharts ? venusJupiterMajorBands : majorBands;
    // An unclassified geometric contact cannot be counted as favourable or as absence of a direction.
    const unreviewedMutualMajor = reviewsMutualSupport
      ? majorReviewBands?.filter(band => !directionNatures.has(band) && isRelevantDirection(band))
      : undefined;
    const sourceDirections = checksBothCharts ? venusJupiterClassified : baseKey === 'Venus:Uranus:conjunction' ? mutual : classified;
    const directionCandidates = basesWithDirectionSupport.has(baseKey)
      ? sourceDirections?.filter(({ band }) => isRelevantDirection(band)) : undefined;
    let supporting = natalSolarMarsSupport ?? directionCandidates;
    if (baseKey === 'Sun:Jupiter:parallel') {
      supporting = directionCandidates?.filter(({ body, target, aspectType }) => aspectType === 'square'
        && (body === 'Sun' && target === 'Jupiter' || targetKind === 'progressed' && body === 'Jupiter' && target === 'Sun'));
    }
    if (baseKey === 'Sun:Uranus:square' || baseKey === 'Sun:Venus:parallel') {
      supporting = directionCandidates?.filter(({ band }) => band.progressedBody === base.progressedBody
        || (targetKind === 'progressed' && band.progressedBody === base.natalTargetId) || leoContactSharesEndpoint(base, band));
    }
    const otherMajor = basesWithOtherDirection.has(baseKey) ? majorBands.filter(band => isConcurrentLeoDirection(base, band)) : undefined;
    const contraryScope = targetKind === 'natal' && base.progressedBody === 'Venus' && base.natalTargetId === 'Neptune'
      ? (base.aspectType === 'sextile' ? 'reviewed-directions' : base.aspectType === 'trine' ? 'other-planet-pairs' : undefined)
      : undefined;
    const scansAllNatalPairs = contraryScope === 'reviewed-directions' && additionalNatalContraryPairs?.sextile !== undefined;
    const additionalCounterpairs = scansAllNatalPairs ? additionalNatalContraryPairs.sextile
      : contraryScope === 'other-planet-pairs' ? additionalNatalContraryPairs?.trine : undefined;
    const natalOtherPlanetPairScope = additionalCounterpairs !== undefined
      ? scansAllNatalPairs ? 'all-other-directed-pairs' : 'non-luminary-unrelated-directed-pairs' : undefined;
    const natalCounterpairs = additionalCounterpairs ? [...majorBands, ...additionalCounterpairs] : majorBands;
    const consideredMajor = contraryScope && natalCounterpairs.filter(band => isConcurrentLeoDirection(base, band)
      && (contraryScope === 'reviewed-directions' || isVenusNeptuneOtherPlanetPair(band)));
    const scanEveryOtherPair = contraryScope === 'reviewed-directions' && slowContraryPairs !== undefined;
    const progressedOtherPlanetPairScope = contraryScope && progressedOtherPlanetPairs && slowContraryPairs !== undefined
      ? scanEveryOtherPair ? 'all-other-pairs' : 'non-luminary-unrelated-pairs' : undefined;
    // A same-chart Venus–Neptune contact is independent of the natal sextile.
    // Only the trine passage confines its counterevidence to other planets.
    const consideredProgressed = contraryScope && progressedOtherPlanetPairs?.filter(band => overlapsBase(band)
      && (scanEveryOtherPair || isVenusNeptuneOtherPlanetPair(band)));
    const sourceBands = [...concurrent, ...solarLinks, ...(supporting?.map(({ band }) => band) ?? []), ...(otherMajor ?? []),
      ...(uranianSensitivity ?? []), ...(uranianOppositionBands ?? []), ...(venusUranusParallelBands ?? []),
      ...(unreviewedMutualMajor ?? []),
      ...(progressedSolar ?? []), ...(solarPlacements ?? []), ...(consideredMajor ?? []), ...(consideredProgressed ?? []),
      ...(crossChartLinks ?? []), ...(speculationCandidates?.map(({ band }) => band) ?? []),
      ...(travelCandidates?.map(({ band }) => band) ?? []), ...(correspondenceCandidates?.map(({ band }) => band) ?? []),
      ...(friendshipCandidates?.map(({ band }) => band) ?? []), ...(studyCandidates?.map(({ band }) => band) ?? []),
      ...(monthlyMajor?.map(({ band }) => band) ?? []),
      ...(disputeCandidates?.map(({ band }) => band) ?? []), ...(metaphysicalCandidates?.map(({ band }) => band) ?? []),
      ...(uranianMetaphysicalMutualCandidates?.map(({ band }) => band) ?? []),
      ...(relocationCandidates?.map(({ band }) => band) ?? [])];
    const boundaries = [...new Set([base.start, base.end,
      ...[...sourceBands, ...(uranianMoonStudyHouses ?? [])].flatMap(band =>
        [Math.max(base.start, band.start), Math.min(base.end, band.end)]),
      ...exactPasses.flatMap(pass => [pass.start, pass.end]),
    ])].sort((a, b) => a - b);
    return boundaries.slice(0, -1).map((start, i) => {
      const end = boundaries[i + 1];
      const active = concurrent.filter(moon => moon.start <= start && end <= moon.end);
      const contacts = active.map(moon => ({
        target: moon.natalTargetId, targetKind: moon.targetKind ?? 'natal',
        aspectType: moon.aspectType, nature: leoLunarNature(moon),
        exactTimes: moon.exactTimes.filter(at => start <= at && at < end),
      } as const));
      const natalState = summarizeLeoLunarNatures(contacts.filter(contact => contact.targetKind === 'natal').map(contact => contact.nature));
      const progressedState = summarizeLeoLunarNatures(contacts.filter(contact => contact.targetKind === 'progressed').map(contact => contact.nature));
      const sameLayerLunarState = targetKind === 'natal' ? natalState : progressedState;
      const sameLayer = contacts.filter(contact => contact.targetKind === targetKind);
      const targetsWithNature = (nature: 'favourable' | 'adverse') =>
        [...new Set(sameLayer.filter(contact => contact.nature === nature).map(contact => contact.target))];
      const linkedMoon = active.filter(moon => leoContactSharesEndpoint(base, moon));
      const mercuryNeptuneLunarSupportState = checksNeptuneLunarSupport
        ? summarizeLeoLunarNatures(linkedMoon.map(moon => neptuneLunarSupport?.includes(moon) ? 'favourable' : leoLunarNature(moon)))
        : undefined;
      const favourableNatalNeptuneLunarContacts = neptuneLunarSupport?.filter(moon => moon.start <= start && end <= moon.end)
        .map(describeLeoDirection);
      const luminaryLinks = checksLuminaries ? [...linkedMoon, ...solarLinks.filter(sun => sun.start <= start && end <= sun.end)]
        .map(band => ({ body: band.progressedBody, target: band.natalTargetId, targetKind: band.targetKind ?? 'natal',
          aspectType: band.aspectType })) : undefined;
      const exactSolarEndpointContacts = solarEndpointPasses?.filter(pass => pass.start === start).map(pass => pass.direction);
      const adverseSequence = adverseSequences?.find(sequence => sequence.second.start <= start && end <= sequence.end);
      const otherDirections = supporting?.filter(({ band }) => band.start <= start && end <= band.end);
      const directionSupportState = otherDirections && summarizeLeoDirectionNatures(otherDirections.map(row => row.nature));
      const solarDirections = otherDirections?.filter(({ body, target, targetKind }) =>
        body === 'Sun' || targetKind === 'progressed' && target === 'Sun');
      const solarCanStrengthen = baseKey === 'Moon:Sun:opposition' || baseKey === 'Moon:Sun:square';
      const sameLayerSolarDirectionState = solarCanStrengthen && solarDirections
        ? summarizeLeoDirectionNatures(solarDirections.map(row => row.nature)) : undefined;
      const concurrentSolarJupiterSquare = baseKey === 'Sun:Jupiter:parallel' ? solarDirections?.some(direction =>
        direction.aspectType === 'square' && (direction.body === 'Sun' && direction.target === 'Jupiter'
          || targetKind === 'progressed' && direction.body === 'Jupiter' && direction.target === 'Sun')) : undefined;
      const hasCleanLunarJupiterSupport = lunarJupiterParallel
        ? (sameLayerLunarState === 'all_favourable' && ['favourable', 'none'].includes(directionSupportState ?? 'none'))
          || (sameLayerLunarState === 'none' && directionSupportState === 'favourable')
        : undefined;
      const activeDirections = (candidates: typeof speculationCandidates) => candidates?.filter(({ band }) => band.start <= start && end <= band.end)
        .map(({ band: _band, ...direction }) => direction);
      const monthlyThemeEvidence = monthlyLunarTheme && (() => {
        const majorDirections = activeDirections(monthlyMajor) ?? [];
        const lunarExactTimes = base.exactTimes.filter(at => start <= at && at < end);
        const lunarNature = leoLunarNature(base);
        const majorState = summarizeLeoDirectionNatures(majorDirections.map(direction => direction.nature));
        return { topic: monthlyLunarTheme, lunarExactTimes, lunarNature, majorDirections, majorState,
          hasExact: lunarExactTimes.length > 0, hasUnopposedMajorSupport: targetKind === 'natal' && majorState === lunarNature };
      })();
      const uranianSensitivityDirection = monthlyThemeEvidence?.hasExact
        ? uranianSensitivity?.find(band => band.start <= start && end <= band.end) : undefined;
      const concurrentUranianSensitivityDirection = uranianSensitivityDirection && describeLeoDirection(uranianSensitivityDirection);
      const monthlyStrengthened = solarCanStrengthen ? sameLayerSolarDirectionState === 'adverse'
        : baseKey === 'Moon:Venus:trine' ? monthlyThemeEvidence?.majorState === 'favourable'
          : ['Moon:Mars:sesquiquadrate', 'Moon:Uranus:parallel', 'Moon:Venus:sesquiquadrate', 'Moon:Venus:opposition'].includes(baseKey)
            ? directionSupportState === 'adverse' : undefined;
      const monthlyLunarQualification = monthlyStrengthened === undefined || !monthlyThemeEvidence
        || !(base.aspectType === 'parallel' || monthlyThemeEvidence.hasExact) ? undefined
        : monthlyStrengthened ? 'strengthened' : 'base';
      const speculationDirections = activeDirections(speculationCandidates);
      const travelDirections = activeDirections(travelCandidates);
      const correspondenceDirections = activeDirections(correspondenceCandidates);
      const friendshipDirections = activeDirections(friendshipCandidates);
      const studyDirections = activeDirections(studyCandidates);
      const disputeDirections = activeDirections(disputeCandidates);
      const metaphysicalDirections = activeDirections(metaphysicalCandidates);
      const uranianMetaphysicalMutualDirections = activeDirections(uranianMetaphysicalMutualCandidates);
      const uranianMetaphysicalSolarPass = uranianMetaphysicalSolarPasses?.find(pass =>
        pass.start <= start && end <= pass.end);
      const uranianMetaphysicalSolarDirection = uranianMetaphysicalSolarPass?.direction;
      const uranianMetaphysicalMercuryPass = uranianMetaphysicalMercuryPasses?.find(pass =>
        pass.start <= start && end <= pass.end);
      const uranianMetaphysicalMercuryDirection = uranianMetaphysicalMercuryPass?.direction;
      const uranianMetaphysicalMoonDirection = uranianMetaphysicalMoonPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const uranianMetaphysicalMinorMoonDirection = uranianMetaphysicalMinorMoonPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const uranianMetaphysicalMoonConjunction = uranianMetaphysicalMoonConjunctionPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const uranianLunarWitnessAt = (instant: number) => {
        const band = uranianMetaphysicalMoonBands?.find(row => row.start <= instant && end <= row.end);
        return band && describeUranianMoonDirection(band);
      };
      const uranianMetaphysicalMercuryLunarDirection = uranianMetaphysicalMercuryPass?.direction.passage === 'p118'
        ? uranianLunarWitnessAt(uranianMetaphysicalMercuryPass.start) : undefined;
      const uranianMetaphysicalSolarLunarDirection = uranianMetaphysicalSolarPass?.direction.passage === 'p278'
        ? uranianLunarWitnessAt(uranianMetaphysicalSolarPass.start) : undefined;
      const uranianMetaphysicalVenusDirection = uranianMetaphysicalVenusPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const adverseMoonEndpointAt = (layer: 'natal' | 'progressed') => adverseMoonEndpointPasses?.find(pass =>
        pass.direction.targetKind === layer && pass.start <= start && end <= pass.end)?.direction;
      const exactAdverseMoonToNatalEndpoint = adverseMoonEndpointAt('natal');
      const exactAdverseMoonToProgressedEndpoint = adverseMoonEndpointAt('progressed');
      const onlyAdverseMoon = [natalState, progressedState].every(state => state === 'none' || state === 'all_adverse');
      const marsSaturnAdverseLunarParallelContacts = marsSaturnLunarParallelBands?.filter(band =>
        band.start <= start && end <= band.end).map(describeLeoDirection);
      const hasCleanAdverseMoonNeptuneActivation = natalMoonNeptuneSquarePasses
        && natalMoonNeptuneSquarePasses.some(pass => pass.start <= start && end <= pass.end)
        && active.every(band => isMoonNeptuneSquare(band) || leoLunarNature(band) === 'adverse');
      const exactCleanMarsSaturnAdverseMoon = marsSaturnOtherMoonPasses?.find(({ start: passAt, end: passEnd, direction }) => {
        if (passAt > start || end > passEnd) return false;
        if (onlyAdverseMoon) return true;
        // Chapter XI calls this specific Moon–Neptune square unfavourable in either chart layer.
        // A near square and other unclassified contacts stay outside this exact exception.
        return direction.targetKind === 'progressed' && direction.target === 'Neptune' && direction.aspectType === 'square'
          && active.every(band => isProgressedMoonNeptuneSquare(band) || leoLunarNature(band) === 'adverse');
      })?.direction;
      const exactCleanMarsJupiterOtherAdverseMoon = onlyAdverseMoon ? marsJupiterOtherMoonPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction : undefined;
      // Chapter XI gives a qualified adverse reading for these two exact
      // contacts. The surrounding Moon–Neptune bands remain unclassified.
      const exactNeptuneMinorAdverse = neptuneLunarMinorAdversePasses?.filter(pass => pass.start <= start && end <= pass.end);
      const cleanNeptuneMinorAdverse = exactNeptuneMinorAdverse?.length && active.every(band =>
        leoLunarNature(band) === 'adverse' || exactNeptuneMinorAdverse.some(pass => pass.band === band))
        ? exactNeptuneMinorAdverse : undefined;
      const neptuneSemisquare = cleanNeptuneMinorAdverse?.find(pass => pass.band.aspectType === 'semisquare');
      const neptuneSesquiquadrate = cleanNeptuneMinorAdverse?.find(pass => pass.band.aspectType === 'sesquiquadrate');
      const exactCleanNeptuneLunarSemisquare = neptuneSemisquare && describeLeoDirection(neptuneSemisquare.band);
      const exactCleanNeptuneLunarSesquiquadrate = neptuneSesquiquadrate && describeLeoDirection(neptuneSesquiquadrate.band);
      const marsJupiterAdverseLunarParallelContacts = marsJupiterAdverseLunarParallelBands?.filter(band =>
        band.start <= start && end <= band.end).map(describeLeoDirection);
      const hasMarsSaturnReviewedMixedOrFavourableMoon = reviewsMarsSaturnParallel
        ? contacts.some(contact => contact.nature === 'favourable') && !contacts.some(contact => contact.nature === 'conditional')
        : undefined;
      // The same-chart clause requires a checked contact to a moving endpoint.
      // The natal reading can also use the original all-adverse lunar condition.
      const marsSaturnNatalLunarActivation = sameLayerLunarState === 'all_adverse'
        || (sameLayerLunarState === 'mixed' || sameLayerLunarState === 'conditional') && Boolean(exactAdverseMoonToNatalEndpoint)
        || progressedState === 'all_adverse' && Boolean(exactAdverseMoonToProgressedEndpoint);
      const hasMarsSaturnAdverseLunarActivation = reviewsMarsSaturnParallel
        ? targetKind === 'progressed' ? Boolean(exactAdverseMoonToProgressedEndpoint) : marsSaturnNatalLunarActivation
        : undefined;
      const exactFavourableMoonToNatalEndpoint = favourableNatalMoonPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const exactFavourableMoonToProgressedEndpoint = favourableMovingMoonPasses?.find(pass =>
        pass.start <= start && end <= pass.end)?.direction;
      const relocationDirections = activeDirections(relocationCandidates);
      const topicState = (directions: typeof speculationDirections) => directions && summarizeLeoDirectionNatures(directions.map(row => row.nature));
      const speculationState = (lunar: boolean) => speculationDirections && summarizeLeoDirectionNatures(
        speculationDirections.filter(({ body }) => (body === 'Moon') === lunar).map(row => row.nature));
      const crossChartDirections = crossChartLinks?.filter(link => link.start <= start && end <= link.end)
        .map(({ direction, progressedPoint, natalContact }) => ({ direction, progressedPoint, natalContact }));
      const crossChartSupportState = crossChartDirections && summarizeLeoDirectionNatures(crossChartDirections.map(row => row.direction.nature));
      const otherDirection = otherMajor?.find(band => band.start <= start && end <= band.end);
      const progressedSolarContacts = progressedSolar?.filter(band => band.start <= start && end <= band.end).map(describeLeoDirection);
      const progressedSolarDignity = solarPlacements?.find(band => band.start <= start && end <= band.end)?.dignity;
      const lunarBridge = checksLunarBridge && otherDirections ? linkLeoSupportingDirection(linkedMoon, active, otherDirections) : undefined;
      const activeUnreviewedMutual = unreviewedMutualMajor?.filter(band => band.start <= start && end <= band.end);
      const unreviewedMutualMajorDirections = activeUnreviewedMutual?.map(describeLeoDirection);
      const hasUnreviewedMutualMajorDirection = unreviewedMutualMajorDirections && unreviewedMutualMajorDirections.length > 0;
      const unreviewedLunarBridge = linkedMoon.length > 0 && activeUnreviewedMutual?.some(direction =>
        active.some(contact => leoContactSharesEndpoint(direction, contact)));
      const venusJupiterLunarLinkState = checksLunarBridge && reviewsMutualSupport
        ? (lunarBridge ? 'linked' : !venusJupiterSupportScope || unreviewedLunarBridge ? 'unreviewed' : 'no-reviewed-link') : undefined;
      const lunarSupportNeedsReview = sameLayerLunarState === 'mixed' || sameLayerLunarState === 'conditional';
      const venusJupiterLunarSupport = venusJupiterLunarLinkState !== undefined && (sameLayerLunarState === 'all_favourable'
        || lunarSupportNeedsReview && Boolean(exactFavourableMoonToNatalEndpoint)
        || progressedState === 'all_favourable' && Boolean(exactFavourableMoonToProgressedEndpoint));
      const venusJupiterEffectState = venusJupiterLunarLinkState === undefined ? undefined
        : lunarBridge ? 'linked-support'
          : venusJupiterLunarSupport ? 'lunar-support'
            : directionSupportState === 'favourable' && venusJupiterLunarLinkState === 'no-reviewed-link' && !lunarSupportNeedsReview
              ? 'indirect-candidate'
              : venusJupiterLunarLinkState === 'unreviewed' || directionSupportState === 'mixed' || lunarSupportNeedsReview
                ? 'unreviewed' : 'basic';
      const exactNeptuneLunarContrary = neptuneLunarContraryPasses?.find(pass => pass.start <= start && end <= pass.end)?.direction;
      const venusNeptuneAt = (layer: 'natal' | 'progressed') => venusNeptuneSensitivityPasses?.find(pass =>
        pass.direction.targetKind === layer && pass.start <= start && end <= pass.end)?.direction;
      const venusNeptuneSensitivityDirection = venusNeptuneAt('natal');
      const progressedVenusNeptuneSensitivityDirection = venusNeptuneAt('progressed');
      const moonNeptuneSensitivityDirection = moonNeptuneSensitivityPasses?.find(pass => pass.start <= start && end <= pass.end)?.direction;
      const hasVenusUranusParallelAtFormation = venusUranusParallelBands
        && formationPasses.some(pass => start <= pass.start && pass.start < end)
        && venusUranusParallelBands.some(band => band.start <= start && end <= band.end);
      const contraryCandidates = consideredMajor && [
        ...consideredMajor.filter(band => band.start <= start && end <= band.end)
          .map(band => ({ ...describeLeoDirection(band), nature: directionNatures.get(band) })),
        ...(contraryScope === 'reviewed-directions' ? sameLayer.map(({ nature, target, targetKind, aspectType }) =>
          ({ body: 'Moon', target, targetKind, aspectType,
            nature: exactNeptuneLunarContrary?.target === target && exactNeptuneLunarContrary.aspectType === aspectType
              ? 'adverse' as const : nature })) : []),
      ];
      const contraryDirections = contraryCandidates?.filter(row => row.nature === 'adverse');
      const unreviewedContraryDirections = contraryCandidates?.filter(row => !row.nature || row.nature === 'conditional');
      const contraryReviewState = contraryDirections && (contraryDirections.length ? 'adverse'
        : unreviewedContraryDirections?.length ? 'unreviewed' : 'clear');
      const contraryDecisionReady = contraryReviewState && contraryReviewState !== 'unreviewed' ? true : undefined;
      const progressedPlanetPairs = consideredProgressed && consideredProgressed.filter(band => band.start <= start && end <= band.end);
      const progressedOtherPlanetContraryDirections = progressedPlanetPairs?.filter(band =>
        leoAdversePlanetPairAspects.has(band.aspectType)).map(describeLeoDirection);
      const progressedOtherPlanetUnreviewedDirections = progressedPlanetPairs?.filter(band =>
        !leoAdversePlanetPairAspects.has(band.aspectType) && !leoFavourablePlanetPairAspects.has(band.aspectType)).map(describeLeoDirection);
      const progressedOtherPlanetContraryReviewState = progressedOtherPlanetContraryDirections &&
        (progressedOtherPlanetContraryDirections.length ? 'adverse' : progressedOtherPlanetUnreviewedDirections?.length ? 'unreviewed' : 'clear');
      const exactLunarLinkedBodies = endpointPasses && [...new Set(endpointPasses.filter(pass => pass.start === start).map(pass => pass.target))];
      const moonUranusParallel = uranianLunarParallelBands?.find(band => band.start <= start && end <= band.end);
      const uranianLunarParallelActivation = moonUranusParallel && { ...describeLeoDirection(moonUranusParallel), passage: 'p214' as const };
      const moonVenusParallel = venusLunarParallelBands?.find(band => band.start <= start && end <= band.end);
      const venusLunarParallelActivation = moonVenusParallel && { ...describeLeoDirection(moonVenusParallel), passage: 'p224' as const };
      // The synthesis in Chapter XIV distinguishes a lunar trigger from one also backed by a similar solar direction.
      const hasUranianMoonSolarActivation = uranianOppositionBands && Boolean((exactLunarLinkedBodies?.length || moonUranusParallel || moonVenusParallel)
        && uranianOppositionBands.some(band => band.start <= start && end <= band.end));
      const moonStudyHouse = uranianMoonStudyHouses?.find(row => row.start <= start && end <= row.end);
      // Leo states the multi-year parallel separately from the more active
      // passages. Preserve all existing same-topic candidates in those slices.
      const sunUranusParallelBackgroundOnly = reviewsSunUranusParallel
        ? metaphysicalDirections?.length === 0 && !uranianMetaphysicalMutualDirections?.length
          && !uranianMetaphysicalSolarDirection && !uranianMetaphysicalMercuryDirection
          && !uranianMetaphysicalMoonDirection && !uranianMetaphysicalMinorMoonDirection && !uranianMetaphysicalMoonConjunction
          && !uranianMetaphysicalVenusDirection && !moonStudyHouse
        : undefined;
      return { start, end, base, contacts, natalState, progressedState, sameLayerLunarState, hasCleanLunarJupiterSupport,
        hasMarsSaturnReviewedMixedOrFavourableMoon,
        hasMarsSaturnTrineAtParallel: marsSaturnParallelTrinePasses?.some(pass => pass.start <= start && end <= pass.end),
        hasMarsSaturnAdverseLunarActivation,
        marsSaturnAdverseLunarParallelContacts,
        hasMarsSaturnAdverseLunarParallelActivation: marsSaturnAdverseLunarParallelContacts
          && onlyAdverseMoon && marsSaturnAdverseLunarParallelContacts.length > 0,
        exactCleanMarsSaturnAdverseMoon,
        hasExactCleanMarsSaturnAdverseMoon: marsSaturnOtherMoonPasses && Boolean(exactCleanMarsSaturnAdverseMoon),
        exactCleanMarsJupiterOtherAdverseMoon,
        hasExactCleanMarsJupiterOtherAdverseMoon: marsJupiterOtherMoonPasses && Boolean(exactCleanMarsJupiterOtherAdverseMoon),
        exactCleanNeptuneLunarSesquiquadrate,
        hasExactCleanNeptuneLunarSesquiquadrate: neptuneLunarMinorAdversePasses && Boolean(exactCleanNeptuneLunarSesquiquadrate),
        exactCleanNeptuneLunarSemisquare,
        hasExactCleanNeptuneLunarSemisquare: reviewsMarsJupiterQuincunx || reviewsMarsSaturnParallel
          ? Boolean(exactCleanNeptuneLunarSemisquare) : undefined,
        marsJupiterAdverseLunarParallelContacts,
        hasMarsJupiterAdverseLunarParallelActivation: marsJupiterAdverseLunarParallelContacts
          && onlyAdverseMoon && marsJupiterAdverseLunarParallelContacts.length > 0,
        monthlyThemeEvidence, monthlyLunarQualification,
        hasOtherSameLayerLunarContacts: sameLayer.length > 0,
        lunarFavourableTargets: targetsWithNature('favourable'), lunarAdverseTargets: targetsWithNature('adverse'),
        lunarLinkedBodies: [...new Set(linkedMoon.map(moon => moon.natalTargetId))],
        exactLunarLinkedBodies, hasUranianMoonSolarActivation,
        uranianLunarParallelActivation, hasUranianLunarParallelActivation: uranianLunarParallelBands && Boolean(uranianLunarParallelActivation),
        venusLunarParallelActivation, hasVenusLunarParallelActivation: venusLunarParallelBands && Boolean(venusLunarParallelActivation),
        exactSolarLinkedBodies: exactSolarEndpointContacts && [...new Set(exactSolarEndpointContacts.map(contact => contact.target))],
        exactSolarEndpointContacts,
        exactUranianSensitivityDirection: uranianOppositionPasses?.some(pass => pass.start === start),
        venusNeptuneSensitivityDirection,
        hasExactVenusNeptuneSensitivityDirection: venusNeptuneSensitivityPasses && Boolean(venusNeptuneSensitivityDirection),
        progressedVenusNeptuneSensitivityDirection,
        hasExactProgressedVenusNeptuneSensitivityDirection: venusNeptuneSensitivityPasses && Boolean(progressedVenusNeptuneSensitivityDirection),
        moonNeptuneSensitivityDirection,
        hasExactMoonNeptuneSensitivityDirection: moonNeptuneSensitivityPasses && Boolean(moonNeptuneSensitivityDirection),
        hasVenusUranusParallelAtFormation,
        concurrentUranianSensitivityDirection,
        hasConcurrentUranianSensitivityDirection: uranianSensitivity && Boolean(concurrentUranianSensitivityDirection),
        favourableNatalNeptuneLunarContacts,
        hasFavourableNatalNeptuneLunarContact: favourableNatalNeptuneLunarContacts && favourableNatalNeptuneLunarContacts.length > 0,
        mercuryNeptuneLunarSupportState,
        hasFavourableLunarLink: linkedMoon.some(moon => leoLunarNature(moon) === 'favourable'),
        directionSupportState, supportingDirections: otherDirections?.map(({ band: _band, ...direction }) => direction),
        mutualSupportReviewProfile: reviewsMutualSupport ? leoLunarConditionPolicy.mutualSupport : undefined,
        unreviewedMutualMajorDirections, hasUnreviewedMutualMajorDirection, venusJupiterSupportScope,
        venusJupiterLunarLinkState, venusJupiterEffectState,
        speculationDirections, speculationLunarState: speculationState(true), speculationMajorState: speculationState(false),
        speculationDirectionState: marsNeptuneTrine && speculationDirections
          ? summarizeLeoDirectionNatures(speculationDirections.map(row => row.nature)) : undefined,
        travelDirections, travelDirectionState: topicState(travelDirections),
        correspondenceDirections, correspondenceDirectionState: topicState(correspondenceDirections),
        friendshipDirections, friendshipDirectionState: topicState(friendshipDirections),
        studyDirections, studyDirectionState: topicState(studyDirections),
        disputeDirections, disputeDirectionState: topicState(disputeDirections),
        metaphysicalDirections, metaphysicalDirectionState: topicState(metaphysicalDirections), sunUranusParallelBackgroundOnly,
        uranianMetaphysicalMutualDirections,
        hasUranianMetaphysicalMutualDirection: uranianMetaphysicalMutualDirections && uranianMetaphysicalMutualDirections.length > 0,
        uranianMetaphysicalSolarDirection,
        hasExactUranianMetaphysicalSolarDirection: uranianMetaphysicalSolarPasses && Boolean(uranianMetaphysicalSolarDirection),
        uranianMetaphysicalSolarLunarDirection,
        hasUranianMetaphysicalSolarLunarWitness: uranianMetaphysicalSolarPasses && Boolean(uranianMetaphysicalSolarLunarDirection),
        uranianMetaphysicalMercuryDirection,
        hasExactUranianMetaphysicalMercuryDirection: uranianMetaphysicalMercuryPasses && Boolean(uranianMetaphysicalMercuryDirection),
        uranianMetaphysicalMoonDirection,
        hasExactUranianMetaphysicalMoonDirection: uranianMetaphysicalMoonPasses && Boolean(uranianMetaphysicalMoonDirection),
        hasVerifiedUranianMetaphysicalMoonHouse: reviewsSunUranusParallel ? Boolean(moonStudyHouse) : undefined,
        uranianMetaphysicalMoonHouse: moonStudyHouse?.house,
        uranianMetaphysicalMoonHouseProfile: moonStudyHouse?.houseProfile,
        uranianMetaphysicalMinorMoonDirection,
        hasExactUranianMetaphysicalMinorMoonDirection: uranianMetaphysicalMinorMoonPasses && Boolean(uranianMetaphysicalMinorMoonDirection),
        uranianMetaphysicalMoonConjunction,
        hasExactUranianMetaphysicalMoonConjunction: uranianMetaphysicalMoonConjunctionPasses && Boolean(uranianMetaphysicalMoonConjunction),
        uranianMetaphysicalMercuryLunarDirection,
        hasUranianMetaphysicalMercuryLunarWitness: uranianMetaphysicalMercuryPasses && Boolean(uranianMetaphysicalMercuryLunarDirection),
        uranianMetaphysicalVenusDirection,
        hasExactUranianMetaphysicalVenusDirection: uranianMetaphysicalVenusPasses && Boolean(uranianMetaphysicalVenusDirection),
        exactAdverseMoonToNatalEndpoint,
        hasExactAdverseMoonToNatalEndpoint: adverseMoonEndpointPasses && Boolean(exactAdverseMoonToNatalEndpoint),
        exactAdverseMoonToProgressedEndpoint,
        hasExactAdverseMoonToProgressedEndpoint: adverseMoonEndpointPasses && Boolean(exactAdverseMoonToProgressedEndpoint),
        hasCleanAdverseMoonNeptuneActivation,
        exactFavourableMoonToNatalEndpoint,
        hasExactFavourableMoonToNatalEndpoint: favourableNatalMoonPasses && Boolean(exactFavourableMoonToNatalEndpoint),
        exactFavourableMoonToProgressedEndpoint,
        hasExactFavourableMoonToProgressedEndpoint: favourableMovingMoonPasses && Boolean(exactFavourableMoonToProgressedEndpoint),
        relocationDirections, relocationDirectionState: topicState(relocationDirections),
        crossChartSupportState, crossChartDirections,
        hasAdverseSolarDirection: solarDirections?.some(({ nature }) => nature === 'adverse'),
        concurrentSolarJupiterSquare, sameLayerSolarDirectionState,
        hasOtherSameLayerDirection: otherMajor && Boolean(otherDirection),
        otherDirection: otherDirection && describeLeoDirection(otherDirection),
        contraryScope, contraryDirections, unreviewedContraryDirections, contraryReviewState, contraryDecisionReady,
        exactNeptuneLunarContrary,
        natalOtherPlanetPairScope,
        hasReviewedContraryDirection: contraryDirections && contraryDirections.length > 0,
        progressedOtherPlanetPairScope,
        progressedOtherPlanetContraryReviewState, progressedOtherPlanetContraryDirections, progressedOtherPlanetUnreviewedDirections,
        progressedSolarContacts, hasProgressedSolarContact: progressedSolarContacts && progressedSolarContacts.length > 0,
        progressedSolarDignity,
        lunarBridge, hasLunarBridge: checksLunarBridge ? Boolean(lunarBridge) : undefined,
        adverseSequence, hasSameLayerAdverseSequence: adverseSequences && Boolean(adverseSequence),
        luminaryLinks, luminaryLinkedBodies: luminaryLinks && [...new Set(luminaryLinks.map(link => link.target))] };
    });
  });
}
