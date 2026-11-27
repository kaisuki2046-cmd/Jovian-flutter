import { createHash } from 'node:crypto';
import { lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { lillyAspectAngles, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { lillySolarProfile } from './lilly-solar-motion.mjs';
import { wealthLuminaryRoles, wealthMotionWitness, wealthMotionWitnesses,
  wealthQuarter, wealthQuarterBases, wealthSaturnTestimony } from './lilly-wealth-history.mjs';
import { wealthPrincipal, wealthPrincipalBases, wealthStrength, wealthStrengths } from './lilly-wealth-principal.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyWealthDurationProfile = 'lilly-1647-wealth-duration-563-564-v1';
const namedStars = new Map([
  [8, { star: 'oculus_taurus', digest: 'dbc4be64d7a20ea46409a449b3ccda619db4e03b0dc650bf9a21d63844a6289d' }],
  [9, { star: 'cor_scorpii', digest: '0ee703afb977d67d7c3c1a0219709c3f070b52bb01ebbc6ad43d9a4c3bd7ac32' }],
  [10, { star: 'caput_algol', digest: 'd3ad5c3e859236c45655e9e8a718c5fa350cda5a211281a7feac6d870df6a113' }],
]);
const stars = [...namedStars.values()].map(({ star }) => star);
const malefics = ['Saturn', 'Mars'];
const hard = ['conjunction', 'square', 'opposition'];
const contact = (star, target) => ({ kind: 'western_lilly_wealth_star_contact', star, target });
const pressure = (planet, aspect) => ({ kind: 'western_lilly_wealth_lot_pressure', planet, aspect });
const lotPressureAlternatives = malefics.flatMap(planet => hard.map(aspect => [pressure(planet, aspect)]));

export function isLillyWealthDurationFact(fact) {
  if (fact.kind === 'western_lilly_wealth_star_contact') {
    return stars.includes(fact.star) && (fact.target === 'lot' || lillyDignityBodies.includes(fact.target));
  }
  if (fact.kind === 'western_lilly_wealth_lot_pressure') return malefics.includes(fact.planet) && hard.includes(fact.aspect);
  if (fact.kind === 'western_lilly_wealth_quarter') return [1, 2, 3, 4].includes(fact.quarter) && wealthQuarterBases.includes(fact.basis);
  if (fact.kind === 'western_lilly_wealth_saturn') return wealthLuminaryRoles.includes(fact.luminaries);
  if (!lillyDignityBodies.includes(fact.planet)) return false;
  if (fact.kind === 'western_lilly_wealth_participant') return Number.isInteger(fact.house) && fact.house >= 1 && fact.house <= 12;
  if (fact.kind === 'western_lilly_wealth_timing_motion') return wealthMotionWitnesses.includes(fact.motion)
    && (fact.planet !== 'Sun' || fact.motion === 'direct_swift')
    && (fact.planet !== 'Moon' || fact.motion !== 'retrograde');
  if (fact.kind === 'western_lilly_wealth_principal') return wealthPrincipalBases.includes(fact.basis);
  if (fact.kind === 'western_lilly_wealth_strength') return wealthStrengths.includes(fact.strength);
  return fact.kind === 'western_lilly_wealth_score' && [fact.min, fact.max].every(score => Number.isInteger(score) && Math.abs(score) < 200)
    && fact.min <= fact.max;
}

export function lillyWealthDurationFacts(facts, fortune) {
  if (!fortune) return [];
  const result = [];
  const ruler = lillyPlanetPosition(facts, fortune.ruler)?.longitude;
  const positions = facts.filter(fact => fact.kind === 'western_fixed_star_longitude' && fact.profile === westernFixedStarProfile);
  for (const star of stars) {
    const longitudes = new Set(positions.filter(fact => fact.star === star).map(fact => fact.longitude));
    const [longitude] = longitudes;
    if (longitudes.size !== 1 || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) continue;
    if (lillyPartileDistance(longitude, fortune.longitude) === 0) result.push(contact(star, 'lot'));
    if (Number.isFinite(ruler) && lillyPartileDistance(longitude, ruler) === 0) result.push(contact(star, fortune.ruler));
  }
  for (const planet of malefics) {
    const longitude = lillyPlanetPosition(facts, planet)?.longitude;
    if (!Number.isFinite(longitude)) continue;
    const angle = lillyPartileDistance(longitude, fortune.longitude);
    const aspect = hard.find(name => lillyAspectAngles[name] === angle);
    if (aspect) result.push(pressure(planet, aspect));
  }
  return result;
}

const starGroups = star => [
  { required: [contact(star, 'lot')] },
  { required: [], anyOf: lillyDignityBodies.map(planet => [contact(star, planet)]) },
];
const inSecond = planet => ({ kind: 'western_lilly_planet_house', planet, house: 2 });
const lossGroups = () => ['Sun', ...malefics].map(planet => ({
  required: [inSecond(planet),
    { kind: 'western_lilly_solar_state', selector: 'house_2_ruler', condition: 'combust', matches: true, profile: lillySolarProfile }],
  anyOf: lotPressureAlternatives,
}));
const beneficGrade = strength => ['Jupiter', 'Venus'].map(planet => ({
  required: [inSecond(planet), wealthStrength(planet, strength)],
  anyOf: ['domicile', 'exaltation', 'triplicity', 'term', 'face'].map(dignity => [
    { kind: 'western_lilly_dignity', planet, dignity, matches: true, profile: lillyDignityProfile },
  ]),
}));
const maleficGrade = strength => malefics.map(planet => ({ required: [inSecond(planet), wealthStrength(planet, strength)] }));
const principalSources = new Map([
  [1, ['e1a10fe5fc337bf97636449d1d0f615f61fd2f6d1f1fba62db36968743b1985f', () => beneficGrade('powerful')]],
  [2, ['4da3211136049ad4441fa7f9a41aa3c10e0a07eab186c5c3a951a500aaad2f87', () => beneficGrade('weak')]],
  [4, ['cb1affbc36f7a1fd753f75b2329627ef702efca4b6b98adf7858294974574d3e', () => maleficGrade('powerful')]],
  [5, ['6ac650379328f4c6c154882cce651c3afc3c772701b322aeff5eabd43def4488', () => maleficGrade('weak')]],
  [14, ['7856e4092acdc72b32419c3a812612b58263bde67f2d19863a04a85069d1afdd',
    () => lillyDignityBodies.map(planet => ({ required: [inSecond(planet), wealthPrincipal(planet, 'strongest_occupant')] }))]],
  [16, ['6279f8c43c486baf7dfe02f81fe56b70b5061848227b2695991c6fe610f82ee9',
    () => [{ required: [], anyOf: lillyDignityBodies.map(planet => [wealthStrength(planet, 'moderate')]) }]]],
  [20, ['45ef2e945ebf6b45c56b92c7f45c1e8a5a953726139f0d4582a022d5aa2d9822', lossGroups]],
]);
const historySources = new Map([
  [3, ['8bf97657ec26cef930857e5709e7c4292de27a57fec1e810ada7e56a20dda453', () =>
    ['strongest_occupant', 'shared_ruler'].map(basis => ({
      required: [], anyOf: lillyDignityBodies.map(planet => [wealthPrincipal(planet, basis)]),
    }))]],
  [21, ['a1d771f8a082b7c10b0d3830991290de8f613f907cca21b254781a6e20d76ea6', () =>
    [{ required: [wealthSaturnTestimony('neither')] }]]],
  [22, ['17555d45e6762d8e4a4998c805ed71e302ae068375378f033b8dece2830436da', () =>
    [{ required: [wealthSaturnTestimony('both')] }]]],
  ...[
    '2973309c69836f03f34a5b46239faf955f55d456cca61f650452a96b1888c65e',
    'e85dd43ebdbe41f471c8a8d7507a69360a7c2a3513c31d5fcfdd35b9f8e86d59',
    '003e1ca9a9916412cc57615bf3889e5c7e80081375288889f5581b5fe3c88f34',
    '35b3f97df9d61bde02325d8b9c21fbd2549ac0a3f37ce50c46b96a73787b7017',
  ].map((digest, index) => [24 + index, [digest,
    () => wealthQuarterBases.map(basis => ({ required: [wealthQuarter(index + 1, basis)] }))]]),
  [29, ['d08d4132b65613c2e07ff31d9081293dfb099a4a24e5fbab50012cd93f78c966',
    () => wealthMotionWitnesses.map(motion => {
      const planets = lillyDignityBodies.filter(planet => isLillyWealthDurationFact(wealthMotionWitness(planet, motion)));
      return { required: [], anyOf: planets.map(planet => [wealthMotionWitness(planet, motion)]) };
    })]],
]);

export function compileLillyWealthDuration(claim) {
  const number = Number(/^astro-lilly-v3-wealth-duration-p(\d{3})-001$/u.exec(claim.id)?.[1]);
  const named = namedStars.get(number);
  const historical = historySources.get(number);
  const spec = historical ?? (named ? [named.digest, () => starGroups(named.star)] : principalSources.get(number));
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const [expected, build] = spec;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: '莉莉财富持续篇的原文、条件或出处有变，须重新复核。' };
  const inputs = build().map(group => normalizeRuleInput('western', {
    ...group, required: [{ kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset }, ...group.required],
  }));
  return { compiler: lillyWealthDurationProfile, inputs, remainingAlternatives: 1,
    ...(historical && { matchScope: 'historical_aphorism' }) };
}
