import { Body, Equator, EquatorFromVector, GeoVector, Horizon, Observer, RotateVector, Rotation_EQJ_EQD, SearchAltitude, SiderealTime } from 'astronomy-engine';
import type { Planet } from './solar-transits';

type Sect = 'day' | 'night';
const radians = Math.PI / 180;
const domiciles = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const;
const exaltations = ['Sun', 'Moon', undefined, 'Jupiter', undefined, 'Mercury', 'Saturn', undefined, undefined, 'Mars', undefined, 'Venus'] as const;
const triplicities = [
  { day: 'Sun', night: 'Jupiter' }, { day: 'Venus', night: 'Moon' }, { day: 'Saturn', night: 'Mercury' },
  { day: 'Venus', night: 'Moon' },
] as const;

// Robbins I.20, printed p. 97. The entries are cumulative bounds computed from
// the five widths in each row of the Egyptian table.
const egyptianTerms = [
  [['Jupiter', 6], ['Venus', 12], ['Mercury', 20], ['Mars', 25], ['Saturn', 30]],
  [['Venus', 8], ['Mercury', 14], ['Jupiter', 22], ['Saturn', 27], ['Mars', 30]],
  [['Mercury', 6], ['Jupiter', 12], ['Venus', 17], ['Mars', 24], ['Saturn', 30]],
  [['Mars', 7], ['Venus', 13], ['Mercury', 19], ['Jupiter', 26], ['Saturn', 30]],
  [['Jupiter', 6], ['Venus', 11], ['Saturn', 18], ['Mercury', 24], ['Mars', 30]],
  [['Mercury', 7], ['Venus', 17], ['Jupiter', 21], ['Mars', 28], ['Saturn', 30]],
  [['Saturn', 6], ['Mercury', 14], ['Jupiter', 21], ['Venus', 28], ['Mars', 30]],
  [['Mars', 7], ['Venus', 11], ['Mercury', 19], ['Jupiter', 24], ['Saturn', 30]],
  [['Jupiter', 12], ['Venus', 17], ['Mercury', 21], ['Saturn', 26], ['Mars', 30]],
  [['Mercury', 7], ['Jupiter', 14], ['Venus', 22], ['Saturn', 26], ['Mars', 30]],
  [['Mercury', 7], ['Venus', 13], ['Jupiter', 20], ['Mars', 25], ['Saturn', 30]],
  [['Venus', 12], ['Jupiter', 16], ['Mercury', 19], ['Mars', 28], ['Saturn', 30]],
] as const;

// Robbins I.21, printed p. 107. Endpoints are cumulative degrees within the sign.
const authorTerms = [
  [['Jupiter', 6], ['Venus', 14], ['Mercury', 21], ['Mars', 26], ['Saturn', 30]],
  [['Venus', 8], ['Mercury', 15], ['Jupiter', 22], ['Saturn', 24], ['Mars', 30]],
  [['Mercury', 7], ['Jupiter', 13], ['Venus', 20], ['Mars', 26], ['Saturn', 30]],
  [['Mars', 6], ['Jupiter', 13], ['Mercury', 20], ['Venus', 27], ['Saturn', 30]],
  [['Jupiter', 6], ['Mercury', 13], ['Saturn', 19], ['Venus', 25], ['Mars', 30]],
  [['Mercury', 7], ['Venus', 13], ['Jupiter', 18], ['Saturn', 24], ['Mars', 30]],
  [['Saturn', 6], ['Venus', 11], ['Mercury', 16], ['Jupiter', 24], ['Mars', 30]],
  [['Mars', 6], ['Venus', 13], ['Jupiter', 21], ['Mercury', 27], ['Saturn', 30]],
  [['Jupiter', 8], ['Venus', 14], ['Mercury', 19], ['Saturn', 25], ['Mars', 30]],
  [['Venus', 6], ['Mercury', 12], ['Jupiter', 19], ['Saturn', 25], ['Mars', 30]],
  [['Saturn', 6], ['Mercury', 12], ['Venus', 20], ['Jupiter', 25], ['Mars', 30]],
  [['Venus', 8], ['Jupiter', 14], ['Mercury', 20], ['Mars', 25], ['Saturn', 30]],
] as const;
const termTables = { egyptian: egyptianTerms, author: authorTerms };
export type PtolemyTermTable = keyof typeof termTables;

export const ptolemyNatalRulerPolicy = {
  profile: 'ptolemy-robbins-natal-governors-v1',
  terms: 'robbins-I.20-egyptian-half-open-bounds',
  triplicity: 'robbins-I.18-by-natal-sect-with-mars-in-water-and-sect-coruler',
  sect: 'robbins-I.7-natal-geometric-solar-horizon-mercury-signed-longitude-candidate',
} as const;

export function ptolemySignRuler(index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 11) throw new RangeError('Invalid time sign');
  return domiciles[index];
}

export function ptolemyTermStarts(table: PtolemyTermTable) {
  return termTables[table].flatMap((bounds, sign) => bounds.map((_, index) => sign * 30 + (bounds[index - 1]?.[1] ?? 0)));
}

function termInSign(table: PtolemyTermTable, sign: number, degree: number) {
  const bounds = termTables[table][sign], index = bounds.findIndex(([, end]) => degree < end);
  const [ruler, end] = bounds[index];
  return { ruler, start: bounds[index - 1]?.[1] ?? 0, end };
}

export function ptolemyTermAt(longitude: number, table: PtolemyTermTable) {
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) throw new RangeError('Invalid natal place');
  const sign = Math.floor(longitude / 30);
  return { sign, term: termInSign(table, sign, longitude - sign * 30) };
}

export function ptolemyNatalGovernors(longitude: number, natalSect?: Sect) {
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) throw new RangeError('Invalid natal place');
  const sign = Math.floor(longitude / 30), degree = longitude - sign * 30, element = sign % 4;
  const triplicityRulers: Planet[] = element === 3 ? ['Mars'] : [];
  if (natalSect) triplicityRulers.push(triplicities[element][natalSect]);
  return { sign, degree, natalSect, domicileRuler: domiciles[sign], exaltationRuler: exaltations[sign],
    triplicityRulers, term: termInSign('egyptian', sign, degree), authorTerm: termInSign('author', sign, degree) };
}

export function ptolemyNatalSect(frame: { birthAt: number; latitude: number; armc: number }): Sect | undefined {
  const epoch = new Date(frame.birthAt);
  const sun = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(epoch), GeoVector(Body.Sun, epoch, true)));
  const latitude = frame.latitude * radians, declination = sun.dec * radians;
  const sinAltitude = Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * Math.cos(declination) * Math.cos((frame.armc - sun.ra * 15) * radians);
  return Math.abs(sinAltitude) <= 1e-10 ? undefined : sinAltitude > 0 ? 'day' : 'night';
}

export function ptolemyPlanetSect(body: Planet, natalLongitude: number | undefined, natalSun: number): Sect | undefined {
  if (body === 'Sun' || body === 'Jupiter' || body === 'Saturn') return 'day';
  if (body === 'Moon' || body === 'Venus' || body === 'Mars') return 'night';
  if (body !== 'Mercury' || natalLongitude === undefined) return undefined;
  const elongation = ((natalLongitude - natalSun + 540) % 360) - 180;
  return Math.abs(elongation) <= 1e-8 ? undefined : elongation < 0 ? 'day' : 'night';
}

export function ptolemyNatalMercuryHorizon(frame: { birthAt: number; latitude: number; armc: number }) {
  const epoch = new Date(frame.birthAt);
  const longitude = ((frame.armc - SiderealTime(epoch) * 15 + 540) % 360) - 180;
  const observer = new Observer(frame.latitude, longitude, 0);
  const day = 86_400_000, offset = longitude * day / 360;
  const localMidnight = new Date(Math.floor((frame.birthAt + offset) / day) * day - offset);
  const sunrise = SearchAltitude(Body.Sun, observer, 1, localMidnight, 1, 0);
  const sunset = SearchAltitude(Body.Sun, observer, -1, localMidnight, 1, 0);
  if (!sunrise || !sunset) return;
  const mercuryAltitude = (at: Date) => {
    const mercury = Equator(Body.Mercury, at, observer, true, true);
    return Horizon(at, observer, mercury.ra, mercury.dec).altitude;
  };
  const sunriseAltitude = mercuryAltitude(sunrise.date), sunsetAltitude = mercuryAltitude(sunset.date);
  const witness = { sunriseAt: sunrise.date.toISOString(), sunsetAt: sunset.date.toISOString(), sunriseAltitude, sunsetAltitude };
  // Robbins I.6 n.31 and I.7. With both or neither sides above the
  // horizon, these two geometry checks cannot single out one sect.
  if (sunriseAltitude > 1e-8 && sunsetAltitude < -1e-8) {
    return { phase: 'morning', sect: 'day', ...witness } as const;
  }
  if (sunriseAltitude < -1e-8 && sunsetAltitude > 1e-8) {
    return { phase: 'evening', sect: 'night', ...witness } as const;
  }
  return { phase: 'undetermined', sect: undefined, ...witness } as const;
}

export function ptolemyNatalRulership(governors: ReturnType<typeof ptolemyNatalGovernors>, body: Planet) {
  return [
    governors.domicileRuler === body ? 'domicile' : '',
    governors.exaltationRuler === body ? 'exaltation' : '',
    governors.triplicityRulers.includes(body) ? 'triplicity' : '',
    governors.term.ruler === body ? 'egyptian_term' : '',
  ].filter(Boolean);
}

export function ptolemyNatalPlacementFamiliarities(governors: ReturnType<typeof ptolemyNatalGovernors>, body: Planet) {
  const common = ptolemyNatalRulership(governors, body).filter(role => role !== 'egyptian_term');
  const read = (term: typeof governors.term) => {
    const roles = term.ruler === body ? [...common, 'term'] : common;
    return { roles, multiple: roles.length >= 2 ? true : governors.natalSect === undefined ? undefined : false };
  };
  return { profile: 'robbins-I.23-same-table-familiarities-v1', egyptian: read(governors.term), author: read(governors.authorTerm) } as const;
}
