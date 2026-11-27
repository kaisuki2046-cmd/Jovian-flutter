import { createHash } from 'node:crypto';
import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { easternOrCulminatingLongitude, inheritance, isPtolemyFortuneAngleFact, ptolemyInheritanceFacts } from './ptolemy-fortune-angles.mjs';

export const ptolemyFortuneProfile = 'ptolemy-robbins-1940-iv-2-fortune-v1';
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const fixedSects = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };
export const classicalExaltationSigns = { Sun: 0, Moon: 1, Jupiter: 3, Mercury: 5, Saturn: 6, Mars: 9, Venus: 11 };
export const ptolemyDignitySign = sign => signs[sign];
const aspectNames = new Map([[2, 'sextile'], [3, 'square'], [4, 'trine'], [6, 'opposition']]);
const familiarities = ['domicile', 'exaltation', 'triplicity', 'term'];
const sourcePlanets = ['Saturn', 'Jupiter', 'Mars', 'Venus', 'Mercury'];
const fortuneFormula = { kind: 'western_ptolemy_fortune_formula' };
const fortuneAssessment = { kind: 'western_ptolemy_fortune_assessment' };
const point = longitude => ({ kind: 'western_ptolemy_fortune_point', longitude });
const governor = planet => ({ kind: 'western_ptolemy_fortune_governor', planet });
const power = planet => ({ kind: 'western_ptolemy_fortune_power', planet });
const affinity = (planet, dignity) => ({ kind: 'western_ptolemy_fortune_affinity', planet, dignity });
const witness = (planet, aspect, relation) => ({ kind: 'western_ptolemy_fortune_witness', planet, aspect, relation });
const following = planet => ({ kind: 'western_ptolemy_fortune_following', planet });

export function ptolemyEssentialClaims(planet, position, cells) {
  const key = planet.toLowerCase();
  return [
    ['domicile', lillyDomicileRuler(position.longitude) === planet],
    ['exaltation', classicalExaltationSigns[planet] === position.sign],
    ['triplicity', cells?.triplicity?.includes(key)],
    ['term', cells?.term === key],
  ].flatMap(([basis, holds]) => holds ? [basis] : []);
}

export function isPtolemyFortuneFact(fact) {
  if (fact.kind === fortuneFormula.kind || fact.kind === fortuneAssessment.kind) return true;
  if (isPtolemyFortuneAngleFact(fact)) return true;
  if (fact.kind === 'western_ptolemy_fortune_point') return Number.isFinite(fact.longitude) && fact.longitude >= 0 && fact.longitude < 360;
  if (!lillyDignityBodies.includes(fact.planet)) return false;
  if (['western_ptolemy_fortune_governor', 'western_ptolemy_fortune_power', 'western_ptolemy_fortune_following'].includes(fact.kind)) return true;
  if (fact.kind === 'western_ptolemy_fortune_affinity') return familiarities.includes(fact.dignity);
  if (fact.kind !== 'western_ptolemy_fortune_witness' || ![...aspectNames.values()].includes(fact.aspect)) return false;
  if (['same_sect', 'opposite_sect'].includes(fact.relation)) return true;
  return fact.relation === 'opposite_superior' && fact.aspect === 'square';
}

export function ptolemyFortuneFacts(facts, solar, dignitiesAt) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const ascendant = easternOrCulminatingLongitude(facts, 'ascendant');
  const positions = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(facts, planet)]));
  const sun = positions.get('Sun')?.longitude, moon = positions.get('Moon')?.longitude;
  if (ascendant === null || !Number.isFinite(sun) || !Number.isFinite(moon)) return [];
  const longitude = (ascendant + moon - sun + 360) % 360;
  const results = [fortuneFormula, point(longitude)];
  // I.17 gives the same seven sign domiciles.
  const ruler = lillyDomicileRuler(longitude), position = positions.get(ruler);
  if (!Number.isFinite(position?.longitude)) return results;
  results.push(governor(ruler));

  const declared = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const chartSect = declared.size === 1 ? [...declared][0] : null;
  const cells = dignitiesAt?.(ptolemyDignitySign(position.sign), position.degree, chartSect);
  const proofs = ptolemyEssentialClaims(ruler, position, cells).map(dignity => affinity(ruler, dignity));
  results.push(...proofs);
  if (proofs.length >= 2) results.push(power(ruler));

  const mercury = solar.find(fact => fact.selector === 'mercury' && fact.matches
    && ['oriental', 'occidental'].includes(fact.condition));
  const sectOf = { ...fixedSects, Mercury: mercury && (mercury.condition === 'oriental' ? 'day' : 'night') };
  const rulerSect = sectOf[ruler];
  if (!rulerSect) return results;
  if (cells?.term && cells.triplicity?.length && sectOf.Mercury && [...positions.values()].every(body => Number.isFinite(body?.longitude))) {
    results.push(fortuneAssessment);
  }
  for (const [planet, candidate] of positions) {
    if (planet === ruler || !Number.isFinite(candidate?.longitude) || !sectOf[planet]) continue;
    const offset = (candidate.sign - position.sign + 12) % 12;
    const aspect = aspectNames.get(Math.min(offset, 12 - offset));
    const sameSect = sectOf[planet] === rulerSect;
    if (aspect) results.push(witness(planet, aspect, sameSect ? 'same_sect' : 'opposite_sect'));
    if (offset === 9 && !sameSect) results.push(witness(planet, 'square', 'opposite_superior'));
    if (offset === 1 && !sameSect) results.push(following(planet));
    if (aspect && ruler === 'Saturn' && planet === 'Jupiter') results.push(...ptolemyInheritanceFacts(facts, positions, ascendant));
  }
  return results;
}

const forPlanets = (planets, fact) => planets.map(planet => [fact(planet)]);
const aspects = [...aspectNames.values()];
const overcoming = () => [{ required: [], anyOf: forPlanets(lillyDignityBodies, planet => witness(planet, 'square', 'opposite_superior')) }];
const afterRuler = () => [{ required: [], anyOf: forPlanets(lillyDignityBodies, following) }];
const upperInheritance = () => ['bicorporeal', 'moon_applying'].map(evidence => ({ required: [inheritance('upper', evidence)] }));
const westInheritance = evidence => () => [{ required: [inheritance('mc_west', evidence)] }];
const historicalSources = new Set([12, 16, 47, 48, 49, 58]);
const reviewed = new Map([
  [1, ['b4a5ec38f6c1ed59926de96fa032c40129e0a12a89a118fe4e045659532d787a',
    () => [{ required: [], anyOf: forPlanets(lillyDignityBodies, power) }]]],
  [2, ['a915e59cae71d167e06436ac8b7505de900868617f5b86c142a15cb7bff4b55c',
    () => aspects.map(aspect => ({ required: [governor('Saturn'), witness('Jupiter', aspect, 'same_sect')] }))]],
  ...[
    '586dd3446e50a55135bbe0d23dbdb96b51036273c1f70592029db9d1e3218640',
    'a98216e4ffdf69930863e980150bf5015c628a0d0c55303c3e267f737ba2edba',
    'd742064c06ce5436088d1ac5ae1f9a4a08a13491c667fbbd0580c58a288d9286',
    'd26b2e899090f014c07df914dc5d0adb3fd41ff2f355e368515e6003ba992086',
    'eff64c3fdff00c6298963052c22e7475d5c3ca575c48ccb2a73b4c9658770717',
  ].map((digest, index) => [3 + index, [digest, () => [{ required: [power(sourcePlanets[index])] }]]]),
  [8, ['af4a45bdbe977ecc65ec91e4ffea0c236b9a3fb4a030c378c7633aab7d1850ec',
    () => aspects.map(aspect => ({ required: [],
      anyOf: forPlanets(lillyDignityBodies, planet => witness(planet, aspect, 'same_sect')) }))]],
  [9, ['f97da452bc9210762c4eb15964117863621be53509b3778e94212420d7af4baa', () => [...overcoming(), ...afterRuler()]]],
  [10, ['36b602797e8460dff43bfca98089f5738978824660152aa407f825ec90c150fc', upperInheritance]],
  [11, ['49328d7eb3931d154d3f017dfacdefd39d6d62effcd79ecf20916dc73576517c',
    () => ['Sun', 'Moon'].flatMap(light => ['sextile', 'trine'].map(aspect => ({
      required: [witness(light, aspect, 'same_sect')], anyOf: forPlanets(lillyDignityBodies.filter(planet => planet !== light), power),
    })))]],
  [12, ['eb1e4d4e164f5e2e67b285ee900d626869225a1e34ea240e5cb90ecf2f34eaca',
    () => [{ required: [fortuneAssessment] }]]],
  [13, ['c409be5eea7631c9b5f38025eeaa350558d457b78090f5c42a029423f14973a3', upperInheritance]],
  [14, ['a546abdec8152b740b6786dbf72ef0b15cfeefb53904946480a265ac9dd41526', overcoming]],
  [15, ['1f39b871a1ab1ac822665d3e384d4ffce1c93e23e47495263297bf4a7c9ed978', afterRuler]],
  [16, ['4932be75062f44a12f228e44feea2900f7a12636af366ede59d5b435a83e42d1', westInheritance('bicorporeal')]],
  [47, ['d3b21bdffe6b05c657367cf5fd3819273148f3a26b5add6b220e35c30244b468', westInheritance('positions')]],
  [48, ['b95470de461cafcc58c1c0cb196e73d643aaa37cb00cd55370326a937cdb4bf6', westInheritance('moon_applying')]],
  [49, ['3d488944fc3ddceb590f772b5d95113378d81ee5d284368e311b7550d32e2f41', westInheritance('moon_separating')]],
  [58, ['071ce12e4fbff47ddb24665c1649cb5c528252ff7a1ebe4f3dc42ea1d5afe195',
    () => [{ required: [fortuneFormula] }]]],
]);

export function compilePtolemyFortune(claim) {
  const number = Number(/^astro-ptolemy-v4-fortune-p(\d{3})-001$/u.exec(claim.id)?.[1]);
  const spec = reviewed.get(number);
  if (!spec) return undefined;
  const [expected, groups] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: '托勒密财富章的原文、条件或出处有变，须重新复核。' };
  const inputs = groups().map(group => normalizeRuleInput('western', {
    ...group, required: [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...group.required],
  }));
  return { compiler: ptolemyFortuneProfile, inputs,
    ...(historicalSources.has(number) && { matchScope: 'historical_aphorism' }),
    ...(number !== 58 && { remainingAlternatives: 1 }) };
}

export function ptolemyFortuneProof(conditions, observed) {
  const matched = [conditions.required, ...conditions.alternatives].flat();
  const hasPower = matched.some(fact => fact.kind === 'western_ptolemy_fortune_power');
  const assessed = matched.some(fact => fact.kind === fortuneAssessment.kind);
  const inherits = matched.some(fact => fact.kind === 'western_ptolemy_fortune_inheritance');
  const lunarEvidence = inherits && matched.some(fact => fact.evidence === 'moon_applying' || fact.evidence === 'moon_separating');
  const extra = new Set(['western_ptolemy_fortune_point']);
  if (!matched.some(fact => fact.kind === 'western_ptolemy_fortune_governor')
    && !matched.some(fact => fact.kind === fortuneFormula.kind)) extra.add('western_ptolemy_fortune_governor');
  if (hasPower || assessed) extra.add('western_ptolemy_fortune_affinity');
  if (assessed) {
    extra.add('western_ptolemy_fortune_power');
    extra.add('western_ptolemy_fortune_witness');
    extra.add('western_ptolemy_fortune_following');
  }
  if (inherits) extra.add('western_ptolemy_fortune_angle');
  if (lunarEvidence) extra.add('western_ptolemy_fortune_moon_ray');
  return { ...conditions, required: [...conditions.required, ...observed.filter(fact => extra.has(fact.kind)
    || inherits && fact.kind === 'western_ptolemy_fortune_witness' && fact.planet === 'Jupiter' && fact.relation === 'same_sect')] };
}
