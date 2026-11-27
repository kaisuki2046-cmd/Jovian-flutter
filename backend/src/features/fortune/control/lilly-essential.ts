const classical = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type ClassicalPlanet = typeof classical[number];
type Sect = 'day' | 'night' | undefined;
const houses: ClassicalPlanet[] = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const exaltations: (ClassicalPlanet | undefined)[] = ['Sun', 'Moon', undefined, 'Jupiter', undefined, 'Mercury', 'Saturn', undefined, undefined, 'Mars', undefined, 'Venus'];
const exaltationOrdinals = [19, 3, undefined, 15, undefined, 15, 21, undefined, undefined, 28, undefined, 27];
const triplicities: [ClassicalPlanet, ClassicalPlanet][] = [['Sun', 'Jupiter'], ['Venus', 'Moon'], ['Saturn', 'Mercury'], ['Mars', 'Mars']];
// Printed p104, with named corrections supported by the same book's planet
// chapters. Original table cells and a remaining prose gap stay auditable;
// no modern Egyptian/Ptolemaic table silently replaces this source.
const termEnds = [[6, 14, 21, 26, 30], [8, 15, 22, 26, 30], [7, 14, 21, 25, 30], [6, 13, 20, 27, 30],
  [6, 13, 19, 25, 30], [7, 13, 18, 24, 30], [6, 11, 19, 24, 30], [6, 14, 21, 27, 30],
  [8, 14, 20, 25, 30], [6, 12, 19, 25, 30], [6, 12, 20, 25, 30], [8, 14, 20, 26, 30]];
const termLords: ClassicalPlanet[][] = [
  ['Jupiter', 'Venus', 'Mercury', 'Mars', 'Saturn'], ['Venus', 'Mercury', 'Jupiter', 'Saturn', 'Mars'],
  ['Mercury', 'Jupiter', 'Venus', 'Saturn', 'Mars'], ['Mars', 'Jupiter', 'Mercury', 'Venus', 'Saturn'],
  ['Saturn', 'Mercury', 'Venus', 'Jupiter', 'Mars'], ['Mercury', 'Venus', 'Jupiter', 'Saturn', 'Mars'],
  ['Saturn', 'Venus', 'Jupiter', 'Mercury', 'Mars'], ['Mars', 'Jupiter', 'Venus', 'Mercury', 'Saturn'],
  ['Jupiter', 'Venus', 'Mercury', 'Saturn', 'Mars'], ['Venus', 'Mercury', 'Jupiter', 'Mars', 'Saturn'],
  ['Saturn', 'Mercury', 'Venus', 'Jupiter', 'Mars'], ['Venus', 'Jupiter', 'Mercury', 'Mars', 'Saturn'],
];
const faceLords: ClassicalPlanet[][] = [
  ['Mars', 'Sun', 'Venus'], ['Mercury', 'Moon', 'Saturn'], ['Jupiter', 'Mars', 'Sun'], ['Venus', 'Mercury', 'Moon'],
  ['Saturn', 'Jupiter', 'Mars'], ['Sun', 'Venus', 'Mercury'], ['Moon', 'Saturn', 'Jupiter'], ['Mars', 'Sun', 'Venus'],
  ['Mercury', 'Moon', 'Saturn'], ['Jupiter', 'Mars', 'Sun'], ['Venus', 'Mercury', 'Moon'], ['Saturn', 'Jupiter', 'Mars'],
];
export const lillyEssentialPolicy = {
  profile: 'lilly-1647-essential-prose-v2', zodiac: 'tropical', planets: classical,
  edition: 'wellcome-b30338724-p104-compared-with-ca-william-lilly-and-world-astrology-transcription',
  bounds: 'half-open-from-printed-cumulative-endpoints-no-rounding',
  waterTriplicity: 'mars-day-and-night-not-dorothean',
  conflicts: ['taurus-endpoint-20-vs-26', 'libra-fourth-term-venus-vs-mercury',
    'sagittarius-mercury-saturn-boundary-19-vs-20', 'gemini-venus-twenty-first-degree-gap'],
  termResolution: 'same-book-saturn-p57-mars-p65-and-mercury-p77-prose-preserves-table-readings',
  judgement: 'no-strength-score-or-well-affected-shortcut',
} as const;

export function lillyEssentialDignities(body: string, longitude: number, sect?: Sect) {
  if (!classical.some(p => p === body) || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360
    || sect !== undefined && !['day', 'night'].includes(sect)) throw new RangeError('Invalid Lilly dignity input');
  const sign = Math.floor(longitude / 30), degree = longitude - sign * 30;
  const termIndex = termEnds[sign].findIndex(end => degree < end), faceIndex = Math.floor(degree / 10);
  const [dayLord, nightLord] = triplicities[sign % 4], termLord = termLords[sign][termIndex];
  const sourceDifferences = sign === 1 && degree >= 20 ? ['taurus-endpoint-20-vs-26']
    : sign === 6 && degree >= 19 && degree < 24 ? ['libra-fourth-term-venus-vs-mercury']
      : sign === 8 && degree >= 19 && degree < 20 ? ['sagittarius-mercury-saturn-boundary-19-vs-20']
        : sign === 2 && degree >= 20 && degree < 21 ? ['gemini-venus-twenty-first-degree-gap'] : [];
  const unresolvedTerm = sourceDifferences.includes('gemini-venus-twenty-first-degree-gap');
  const inTriplicity = sect ? body === (sect === 'day' ? dayLord : nightLord)
    : dayLord === nightLord ? body === dayLord : body !== dayLord && body !== nightLord ? false : undefined;
  const inOwnTerm = unresolvedTerm && body !== 'Sun' && body !== 'Moon' ? undefined : body === termLord;
  const domicile = body === houses[sign], exalted = body === exaltations[sign], inOwnFace = body === faceLords[sign][faceIndex];
  const strengths = [domicile, exalted, inTriplicity, inOwnTerm, inOwnFace];
  return { profile: lillyEssentialPolicy.profile, body, longitude, sign, degree, sect,
    domicile, exalted, detriment: body === houses[(sign + 6) % 12], fall: body === exaltations[(sign + 6) % 12],
    signLord: houses[sign], exaltationLord: exaltations[sign], exaltationOrdinal: exaltationOrdinals[sign],
    triplicityDayLord: dayLord, triplicityNightLord: nightLord, inTriplicity,
    termLord, termStart: termIndex ? termEnds[sign][termIndex - 1] : 0, termEnd: termEnds[sign][termIndex],
    termStatus: unresolvedTerm ? 'source_variant' : sourceDifferences.length ? 'prose_resolved' : 'ready', inOwnTerm,
    tableTermLord: sign === 6 && degree >= 19 && degree < 24 ? 'Venus'
      : sign === 8 && degree >= 19 && degree < 20 ? 'Saturn' : termLord,
    faceLord: faceLords[sign][faceIndex], faceStart: faceIndex * 10, faceEnd: (faceIndex + 1) * 10, inOwnFace,
    hasEssentialDignity: strengths.includes(true) ? true : strengths.includes(undefined) ? undefined : false,
    sourceDifferences, judgement: 'unresolved-accidental-condition-and-source-favourability' };
}
