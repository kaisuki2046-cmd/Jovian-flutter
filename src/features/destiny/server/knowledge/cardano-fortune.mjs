import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';
import { cardanoAngleLimit, cardanoArcDistance, cardanoConjunctionLimit, cardanoCoordinate,
  cardanoLotCondition, cardanoLotEvidence, isCardanoLotFact } from './cardano-fortune-lot.mjs';

export const cardanoFortuneProfile = 'cardano-1578-iv2-wealth-testimonies-v1';
const planets = ['Jupiter', 'Moon', 'Venus'];
const angles = { Sun: 'descendant', Venus: 'mc', Moon: 'ascendant' };
const replacementPlans = [
  ['none', planets],
  ...['Moon', 'Venus', 'Jupiter'].map(planet => [planet, [...planets.filter(body => body !== planet), 'north_node']]),
];
const groups = new Map(replacementPlans);
const knownBodies = new Set([...planets, 'Sun', 'Mercury', 'Mars', 'Saturn', 'north_node', 'fortune', 'second_cusp', 'ic', ...Object.values(angles)]);
const joined = replaced => ({ kind: 'western_cardano_fortune_conjunction', replaced });
const atAngle = (planet, angle) => ({ kind: 'western_cardano_fortune_angle', planet, angle });

export function isCardanoFortuneFact(fact) {
  if (fact.kind === 'western_cardano_fortune_conjunction') return groups.has(fact.replaced);
  if (fact.kind === 'western_cardano_fortune_angle') return Object.hasOwn(angles, fact.planet) && fact.angle === angles[fact.planet];
  if (fact.kind !== 'western_cardano_fortune_longitude') return isCardanoLotFact(fact);
  return knownBodies.has(fact.body)
    && Number.isFinite(fact.longitude) && fact.longitude >= 0 && fact.longitude < 360;
}

export function cardanoFortuneFacts(facts) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = new Map([...planets, 'Sun'].map(planet => [planet, lillyPlanetPosition(facts, planet)?.longitude]));
  const north = lillyNodeLongitudes(facts).find(fact => fact.node === 'north_node');
  if (north) positions.set(north.node, north.longitude);
  const results = [];
  const witnessed = new Set();
  for (const [replaced, members] of groups) {
    const coordinates = members.map(body => positions.get(body));
    // Require all three pairs, including the two outer members of a cluster.
    if (!coordinates.every(Number.isFinite)
      || coordinates.some((from, index) => coordinates.slice(index + 1).some(to => cardanoArcDistance(from, to) > cardanoConjunctionLimit))) continue;
    results.push(joined(replaced));
    for (const body of members) witnessed.add(body);
  }

  const ascendant = easternOrCulminatingLongitude(facts, 'ascendant');
  const mc = easternOrCulminatingLongitude(facts, 'mc');
  const descendant = ascendant === null ? null : (ascendant + 180) % 360;
  const consistentWest = descendant !== null && facts.every(fact => fact.kind !== 'angle_sign' || fact.angle !== 'descendant'
    || fact.sign === zodiacNames[Math.floor(descendant / 30)]);
  positions.set('ascendant', ascendant).set('mc', mc).set('descendant', consistentWest ? descendant : null);
  for (const [planet, angle] of Object.entries(angles)) {
    const longitude = positions.get(planet), reference = positions.get(angle);
    if (!Number.isFinite(longitude) || !Number.isFinite(reference) || cardanoArcDistance(longitude, reference) > cardanoAngleLimit) continue;
    results.push(atAngle(planet, angle));
    witnessed.add(planet);
    witnessed.add(angle);
  }
  return [...results, ...[...witnessed].map(body => cardanoCoordinate(body, positions.get(body))),
    ...[...cardanoLotEvidence(facts, ascendant, mc).keys()].map(cardanoLotCondition)];
}

const reviewed = new Map([
  [18, ['a49b064a5b1fca0fc4f9614aa38ac99dbb74e1f27f2bc605348e717b12cfe57f', joined('none')]],
  [19, ['8517118e01619001ba8b9859b1076d6206591f08139610849490e8686fa65f0c', joined('Moon')]],
  [20, ['296917fd6228a4a7e6e06a2332ebfa31ae3578b67faf886de6c66f0a2c1dc1d6', joined('Venus')]],
  [21, ['e3959cbdea3d2aaaac13d6a92e0e614e682a59bab373df0dd2a021ffafb71f80', joined('Jupiter')]],
  [22, ['e181d85ba6971a022375e72e8aaf64c7f39c7c165a6a4052daeee2c6cdc6bdc1', atAngle('Sun', 'descendant')]],
  [23, ['a47aa1b8ab69ca1aa353c2dbec3ac2738857d05eeadd75826dc04cce03dc74d8', atAngle('Venus', 'mc')]],
  [24, ['7aef0f6b2de6046266de239dda165382bb2ef61e9632c43c33a7c927016d1255', atAngle('Moon', 'ascendant')]],
  [27, ['1281c0689c58478f721fa8fc9c6cad99af954afe9f136a83c9b6d9c792002c27', cardanoLotCondition('angular_house')]],
  [28, ['9e1f3b4e10d473a9e0b235e56e262916b9d609f9024afea0c477b7ce8e3da506', cardanoLotCondition('above_eleventh')]],
  [29, ['5182d2a3bb0a44a415f510329ec024a6b396129b3824a259c6a6fcf56f50cdff', cardanoLotCondition('above_ninth')]],
  [32, ['2a26fa117f2dbe421430d2388a39ff95155af8fe402c170ff4695e9c4cd028ab', cardanoLotCondition('ruler_oriental')]],
  [33, ['26143ab10e3a5b997e6a53a6a9572a30daa6f1942c819dc063b61b3701a6c163', cardanoLotCondition('ruler_angle_center')]],
  [34, ['c2ffbecc7ad08ccc834e13b0705bd0dc4ba3d543ccb885a620f793a377dc1371', cardanoLotCondition('ruler_own_dignity')]],
  [36, ['c0623fdaa354a5c6dd3ad6632a35969f59eba0a55150dc6caece25052f94d3da', cardanoLotCondition('ruler_with_sun')]],
  [37, ['b746adf13b4a493b5aaf6b7bc414b1d954efdb42dfd394456239e8d0032cc0d1', cardanoLotCondition('ruler_with_moon')]],
  [38, ['7fb0f06bd1a308ac3aefac461491edefacdd00689b28f6b0512c4eb60044266e', cardanoLotCondition('ruler_angle_and_dignity')]],
  [39, ['146ffda0becdce2c8a1f588b8fa7445a21793dd21a3f0f7527c096fd97df18a3', cardanoLotCondition('strong_lot_under_sun')]],
  [40, ['1432cb2413590b9ece66156605ecc57c0d612f6a78b947513ff499b7d84732d5', cardanoLotCondition('lot_with_moon_sun_rising')]],
  [41, ['41ce723880089db8697263e87db1200257e5265290ef7da63155fb09284c80ec', cardanoLotCondition('strong_lot_moon_trine')]],
  [42, ['3af66027002001058f8f25a6fdd9b776882a53c2ca2f3365779333a3bc6e6731', cardanoLotCondition('strong_lot_moon_sextile')]],
  [50, ['58ed2f1166bc21801f49a5c433eabd6385f2fb4c4af1d1ee786e15dc8f3d091e', cardanoLotCondition('inheritance_eleventh')]],
  [53, ['b3dfad5ada5adbe7c87adeb510110af62230cfe66976de2d5175b664b2d5e8e1', cardanoLotCondition('case_jupiter_second')]],
  [54, ['de561b8385396f67584170fb7caaf512ef5c67b6ec511b855fc621af82987ed4', cardanoLotCondition('case_lot_venus_mercury_angular')]],
  [55, ['925a75645298af054002e3600624e0585ebb6e9601a9d4e8ed62d4e3be59183d', cardanoLotCondition('inheritance_ninth')]],
  [56, ['a3560376fd5088fd892a53e99f53eef0b22d42a5d9662cc7e97a98abbd1795c5', cardanoLotCondition('inheritance_eighth')]],
]);

export function compileCardanoFortune(claim) {
  const number = Number(/^astro-ptolemy-v4-fortune-p(\d{3})-001$/u.exec(claim.id)?.[1]);
  const spec = reviewed.get(number);
  if (!spec) return undefined;
  const [expected, fact] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: 'Cardano 财富章的评注、出处或取证条件有改动，须重新复核。' };
  const input = normalizeRuleInput('western', { required: [{ kind: 'western_zodiac', zodiac: 'tropical' }, fact] });
  return { compiler: cardanoFortuneProfile, inputs: [input], matchScope: 'historical_aphorism', remainingAlternatives: 1 };
}

export function cardanoFortuneProof(conditions, observed) {
  const lot = conditions.required.find(fact => fact.kind === 'western_cardano_fortune_lot_condition');
  if (lot) {
    const evidence = cardanoLotEvidence(observed, easternOrCulminatingLongitude(observed, 'ascendant'),
      easternOrCulminatingLongitude(observed, 'mc')).get(lot.witness) ?? [];
    return { ...conditions, required: [...new Map([...conditions.required, ...evidence].map(fact => [JSON.stringify(fact), fact])).values()] };
  }
  const active = conditions.required.find(fact => fact.kind === 'western_cardano_fortune_conjunction'
    || fact.kind === 'western_cardano_fortune_angle');
  if (!active) return conditions;
  const members = groups.get(active.replaced) ?? [active.planet, active.angle];
  return { ...conditions, required: [...conditions.required, ...observed.filter(fact =>
    fact.kind === 'western_cardano_fortune_longitude' && members.includes(fact.body))] };
}
