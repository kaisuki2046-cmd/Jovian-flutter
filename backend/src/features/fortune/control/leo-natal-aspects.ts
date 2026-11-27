import { progressedAspects } from './western-progressions';
import { readLeoSignRuler } from './leo-rulership';

export const leoNatalAspectPolicy = {
  profile: 'leo-natal-aspects-1928-support-v1',
  edition: 'leo-1928-fourth-edition-chapter-iv-outer-limits',
  parallel: 'absolute-declination-distance-either-hemisphere',
} as const;

export const leoGreenNatalAspectProfile = 'leo-green-1906-natal-aspects-v1';

const limits = {
  semisextile: 2, semisquare: 4, sextile: 7, square: 8, trine: 8,
  sesquiquadrate: 4, quincunx: 2,
};

type Position<Body extends string = string> = { body: Body; longitude: number; declination: number };
export type LeoNatalHousePosition = { body: string; longitude: number; house?: number };

export function readLeoNatalAngularSignGroup(targetId: string, positions: readonly LeoNatalHousePosition[]) {
  const target = positions.find(position => position.body === targetId);
  if (!target || target.house === undefined || ![1, 4, 7, 10].includes(target.house)) return;
  const sign = Math.floor(target.longitude / 30);
  const bodies = positions.filter(position => position.house === target.house && Math.floor(position.longitude / 30) === sign)
    .map(position => position.body);
  // The 1893 magazine's named group gives an example with four planets.
  // Use that conservative subset without assigning a universal size.
  if (bodies.length >= 4) return { house: target.house, sign, bodies };
}

export function readLeoCuspApproach(position: { longitude: number; house?: number }, cusps: readonly number[]) {
  const fromHouse = position.house;
  if (fromHouse === undefined) return;
  const nextHouse = fromHouse % 12 + 1;
  const cuspLongitude = cusps[nextHouse - 1];
  // Leo and Green judge a planet about five degrees before a cusp with the approached house.
  const distance = (cuspLongitude - position.longitude + 360) % 360;
  if (distance > 0 && distance <= 5) return { fromHouse, nextHouse, cuspLongitude, distance };
}

export function readLeoAngularCuspApproach(position: Parameters<typeof readLeoCuspApproach>[0], cusps: readonly number[]) {
  const approach = readLeoCuspApproach(position, cusps);
  return approach && [1, 4, 7, 10].includes(approach.nextHouse) ? approach : undefined;
}

// Chapter IV specifies outer limits, with tiers for conjunction/opposition.
// Keep the measured error so a marginal contact remains distinguishable.
export function readLeoNatalAspects(first: Position, second: Position) {
  if (first.body === second.body) return [];
  const luminaries = [first, second].filter(p => p.body === 'Sun' || p.body === 'Moon').length;
  const separation = Math.abs((first.longitude - second.longitude + 540) % 360 - 180);
  const longitude = progressedAspects.flatMap(({ type, angle }) => {
    const orb = type === 'conjunction' || type === 'opposition' ? 8 + 2 * luminaries : limits[type];
    const difference = Math.abs(separation - angle);
    return difference <= orb ? [{ aspect: type, difference, orb, coordinate: 'longitude' as const }] : [];
  });
  const parallel = Math.abs(Math.abs(first.declination) - Math.abs(second.declination));
  return [...longitude, ...(parallel <= 1
    ? [{ aspect: 'parallel' as const, difference: parallel, orb: 1, coordinate: 'declination' as const }] : [])];
}

// The 1906 companion manual gives these numerical limits and defines a conjunction within one sign.
export function readLeoGreenNatalAspects(first: Position, second: Position) {
  const sameSign = Math.floor(first.longitude / 30) === Math.floor(second.longitude / 30);
  return readLeoNatalAspects(first, second).filter(row => row.aspect !== 'conjunction' || sameSign);
}

export function isLeoGreenStrongNatalLongitude(contact: { aspect: string }) {
  return ['conjunction', 'square', 'trine', 'opposition'].includes(contact.aspect);
}

export function readLeoNatalAspectContacts<Body extends string>(positions: readonly Position<Body>[]) {
  return positions.flatMap((first, index) => positions.slice(index + 1).flatMap(second =>
    readLeoNatalAspects(first, second).map(aspect => ({ ...aspect, first: first.body, second: second.body }))));
}

export function isLeoNatalSquareOrOpposition(contact: { aspect: string }) {
  return contact.aspect === 'square' || contact.aspect === 'opposition';
}

export function isLeoNatalAffliction(contact: { aspect: string }) {
  return isLeoNatalSquareOrOpposition(contact) || contact.aspect === 'semisquare' || contact.aspect === 'sesquiquadrate';
}

export const leoNatalFinancialProfile = 'leo-second-house-financial-testimony-v1';

export function isLeoNatalFinancialSupport(contact: { aspect: string }) {
  return contact.aspect === 'sextile' || contact.aspect === 'trine';
}

export function readLeoNatalFinancialAnchors<Body extends string>(bodies: readonly (Position<Body> & { house?: number; sign: number })[],
  cusps: readonly number[]) {
  const secondRuler = readLeoSignRuler(Math.floor(cusps[1] / 30));
  const tenthRuler = readLeoSignRuler(Math.floor(cusps[9] / 30));
  const occupants = bodies.filter(body => body.house === 2);
  const financialBodies = occupants.length ? occupants : bodies.filter(body => body.body === secondRuler);
  const contacts = (focus: Position<Body>) => bodies.flatMap(other =>
    readLeoNatalAspects(focus, other).map(aspect => ({ body: other.body, ...aspect })));
  const financialAnchors = financialBodies.map(body => ({
    body: body.body, house: body.house, sign: body.sign, contacts: contacts(body),
  }));
  const generalFinancialPairs = bodies.filter(body => body.body === 'Jupiter' || body.body === 'Venus')
    .flatMap(first => contacts(first).filter(contact => contact.body === 'Saturn' || contact.body === 'Moon')
      .filter(contact => isLeoNatalFinancialSupport(contact) || isLeoNatalSquareOrOpposition(contact))
      .map(contact => ({ first: first.body, ...contact,
        involvesSecondOrTenthRuler: [secondRuler, tenthRuler].some(ruler => ruler === first.body || ruler === contact.body) })));
  return { secondRuler, tenthRuler, financialAnchors, generalFinancialPairs,
    financeBasis: occupants.length ? 'second_house_occupants' : 'empty_second_house_ruler' } as const;
}

export function readLeoNatalFinancialTestimonies(natal: Pick<ReturnType<typeof readLeoNatalFinancialAnchors>,
  'financialAnchors' | 'generalFinancialPairs'>) {
  const anchors = natal.financialAnchors.flatMap(({ body: first, contacts }) => contacts.map(contact => ({ first, ...contact })));
  const candidates = [...anchors, ...natal.generalFinancialPairs.filter(row => row.involvesSecondOrTenthRuler)]
    .filter(contact => isLeoNatalFinancialSupport(contact) || isLeoNatalSquareOrOpposition(contact));
  const distinct = new Map<string, typeof candidates[number]>();
  for (const row of candidates) {
    const key = [row.first, row.body].sort().join(':') + ':' + row.aspect;
    if (!distinct.has(key)) distinct.set(key, row);
  }
  const financialTestimonies = [...distinct.values()];
  const support = financialTestimonies.some(isLeoNatalFinancialSupport), pressure = financialTestimonies.some(isLeoNatalSquareOrOpposition);
  const natalFinancialState = support ? (pressure ? 'mixed' : 'support') : (pressure ? 'pressure' : 'none');
  return { financialTestimonies, natalFinancialState };
}

export function leoNatalFinancialTargetRoles(natal: ReturnType<typeof readLeoNatalFinancialAnchors>, target: string) {
  return [
    ...(natal.financialAnchors.some(row => row.body === target) ? [natal.financeBasis] : []),
    ...(natal.generalFinancialPairs.some(row => row.involvesSecondOrTenthRuler && [row.first, row.body].includes(target))
      ? ['named_financial_pair'] : []),
  ];
}
