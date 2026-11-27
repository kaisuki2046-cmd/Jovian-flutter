import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';

export const cardanoDignityProfile = 'cardano-1578-iv3-regiomontanus-v1';
const reviewedSources = new Map([
  ['astro-ptolemy-v4-dignity-p033-001', '104947ca6bc8088bcb840d1c166d0c4178a8043762c43cd67175589e601b0c95'],
  ['astro-ptolemy-v4-dignity-p034-001', '7f1e0e713a351de46ff17debf3b4d31e2b58b5a6532d1b02b672cdd8862c410d'],
]);
const selectors = new Map([
  ['profiles.ptolemy.luminaries.sun_in_masculine_sign', 'sun_masculine'],
  ['profiles.ptolemy.luminaries.moon_in_masculine_sign', 'moon_masculine'],
  ['profiles.ptolemy.attendance.cardano.sun_angular', 'sun_angular'],
  ['profiles.ptolemy.attendance.cardano.moon_angular', 'moon_angular'],
  ['profiles.ptolemy.attendance.cardano.exactly_one_luminary_is_angular', 'one_angular'],
  ['profiles.ptolemy.attendance.cardano.limited_rank_configuration_confirmed', 'fourth_state'],
]);
export const cardanoDignitySelectors = ['cardano_1578', ...selectors.values()];
export const isCardanoDignitySource = claim => reviewedSources.has(claim.id);

export function cardanoDignitySourceMatches(claim) {
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  return digest === reviewedSources.get(claim.id);
}

const rankFact = (selector, matches) => ({
  kind: 'western_cardano_dignity', profile: cardanoDignityProfile, selector, matches,
});

export function cardanoDignityCondition(fact, equals) {
  if (fact === 'context.ptolemy_iv3_attendance_text' && equals === 'cardano_1578') {
    return rankFact('cardano_1578', true);
  }
  const selector = selectors.get(fact);
  return selector && typeof equals === 'boolean' ? rankFact(selector, equals) : null;
}

const signAndAngle = (facts, planet) => {
  const matching = facts.filter(fact => fact.planet === planet);
  const degrees = new Set(matching.filter(fact => fact.kind === 'planet_longitude').map(fact => fact.longitude));
  const signs = new Set(matching.filter(fact => fact.kind === 'planet_sign').map(fact => fact.sign));
  const houses = new Set(matching.filter(fact => fact.kind === 'western_profile_planet_house'
    && fact.profile === 'regiomontanus').map(fact => fact.house));
  const [degree] = degrees, [house] = houses;
  if (degrees.size !== 1 || !Number.isFinite(degree) || degree < 0 || degree >= 360
    || houses.size !== 1 || !Number.isInteger(house) || house < 1 || house > 12) return null;
  const signIndex = Math.floor(degree / 30);
  if (signs.size > 1 || signs.size === 1 && !signs.has(zodiacNames[signIndex])) return null;
  return { masculine: signIndex % 2 === 0, angular: [1, 4, 7, 10].includes(house) };
};

export function cardanoDignityFacts(facts) {
  const zodiac = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiac.size !== 1 || !zodiac.has('tropical')
    || !facts.some(fact => fact.kind === 'western_profile_system' && fact.profile === 'regiomontanus')) return [];
  // Use the native 3D Regiomontanus positions. Lilly's five-degree
  // reassignment to the following house is a separate historical convention.
  const sun = signAndAngle(facts, 'Sun'), moon = signAndAngle(facts, 'Moon');
  if (!sun || !moon) return [];
  const oneAngular = sun.angular !== moon.angular;
  return [
    rankFact('cardano_1578', true),
    rankFact('sun_masculine', sun.masculine), rankFact('moon_masculine', moon.masculine),
    rankFact('sun_angular', sun.angular), rankFact('moon_angular', moon.angular),
    rankFact('one_angular', oneAngular),
    rankFact('fourth_state', oneAngular && sun.masculine && !moon.masculine),
  ];
}
