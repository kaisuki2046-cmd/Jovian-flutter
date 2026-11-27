import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillyChildrenProfile = 'lilly-1647-fifth-house-testimonies-v1';
const prefix = 'astro-lilly-v3-children-';
const reviewed = {
  p003: '375af9f97bfa9a220270dcd4af24129e222c7d70d497b7d58c79265a7a7d8162',
  p006: '40be6df7f439f036e051a0ef2b5d8d827aa8fb8b9365d5f3d495b2d0700d2ea0',
  p007: '89f46bedc448acdb9dcf630bd37ec88dbc8e481d64a2d37d7fba43ff2a375139',
  p010: 'd5d3c07bee88050250570337c8261bef61ebdcd89482697b32434000a5770573',
  p011: 'ab2d4c91b27d10fd0e1ec290060f2872493f137f6eec01eb53f3d856c2b86e3a',
  p013: 'bbaaf0583a6d164905862f6fb5c10da9cd398a8a69ecaa1a5e19df3ec4334cbd',
  p014: 'd0d5c303c2747e1898930281fa37df37ddd927aa0da5c6b191e87b7bac377e77',
  p015: '8cd023acf40cfd431a1684516ef0bee98eea03596e5998e11cf8c3d550512e0e',
  p016: '6337792e14c54ba61db0f13cda68b734a86796ae8559ab7982b08aa0667c0614',
  p020: '29672bd9c4711ef5dc9a6b6e135841ec5b4b0c0da3e4c3a8289a30183acf0ed3',
  p021: '3ceb0e7caf0204f8798ab44502e683865761747415e4ac9d2377098ca744170b',
  p024: '4affe61159eac84a47e9420ca9d0329bb08f655935a449f50598d71d5824aa35',
  p027: '23e013c34262032d47e78fe1db4b007b9fb4345e466f9c05ac8086813872877d',
  p028: '94db7a8be0ec6e85f235d86e7c4a52faea32d6130dd7db530e8f247bd6e82058',
  p036: 'e1ae245c02677b6fca88c5c263530a5fdbd765936e7ecab8e24c5075c3c7bea6',
  p038: 'bec42b77412638710ce1a3f5266d87d8801559e103866fb5c5518da395c13a0c',
  p041: 'cc4d341ff20722f1ea6532089c6168342c0751947e9a810f552622fe99c03a98',
  p042: '990480150a7c45a2806b1b19247055e9d3d21dbbd39d63eb81d716e3d619b446',
  p051: '7a704f022fd715c671f4f6b80e0f2ca1a390206d579421db3432a99edfc54e14',
};
const sourceKey = id => typeof id === 'string' && id.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : '';
export const isLillyChildrenSource = claim => Object.hasOwn(reviewed, sourceKey(claim.id));
export function lillyChildrenSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify([source, conditions, evidence])).digest('hex');
  return reviewed[sourceKey(id)] === digest;
}

const childHouses = [1, 5, 11], quantityHouses = [5, 11];
const fruitfulPlanets = ['Jupiter', 'Venus', 'Moon'];
const barrenPlanets = ['Saturn', 'Mars', 'Sun'];
const fruitfulWitnesses = [...fruitfulPlanets, 'north_node'];
const barrenWitnesses = [...barrenPlanets, 'south_node'];
// Book I pp.87–89, as used by Book III's fifth-house chapter. Sagittarius
// belongs to the common group here, not the special sibling sign list at p.566.
const fruitfulSigns = [3, 7, 11], barrenSigns = [2, 4, 5], commonSigns = [2, 5, 8, 11];
const chapter = 'profiles.lilly.children.';
const testimonies = chapter + 'testimonies.';
const selectorsBySource = {
  fifth_outweighs_eleventh: 'fifth_outweighs_eleventh',
  mixed_fecund_planet_barren_sign: 'mixed_fecund_planet_barren_sign',
  mixed_barren_planet_fecund_sign: 'mixed_barren_planet_fecund_sign',
  houses_1_5_11_empty: 'empty_children_houses',
  mercury_active: 'mercury_active',
  fifth_cusp_sign_fertile: 'fifth_cusp_sign_fertile',
  fifth_ruler_sign_fertile: 'fifth_ruler_sign_fertile',
  ascending_sign_fertile: 'ascending_sign_fertile',
  venus_and_moon_fifth_fertile_sign_placement: 'venus_and_moon_fifth_fertile',
  all_traditional_planets_in_fertile_signs: 'all_planets_fertile_signs',
  fifth_ruler_retrograde: 'fifth_ruler_retrograde',
  active_child_significator_is_malefic: 'active_malefic',
  active_planet_confirmed: 'barren_planet_in_barren_sign',
};
const fertileHouseSelector = house => 'fruitful_occupant.' + house;
const bodySelector = body => 'body.' + body.toLowerCase();
export const lillyChildrenSelectors = new Set([
  ...Object.values(selectorsBySource), ...childHouses.map(fertileHouseSelector),
  ...[...fruitfulWitnesses, ...barrenWitnesses].map(bodySelector), 'quantity.common_only', 'quantity.fruitful_only',
]);
const childFact = selector => ({ kind: 'western_lilly_children', selector });
const verified = chapter + 'verified.';
const familyLords = 'aspects.house_1_ruler.house_5_ruler.';

export function lillyChildrenCondition(fact, equals) {
  const path = fact.startsWith(testimonies) && fact.slice(testimonies.length);
  let selector;
  if (fact === chapter + 'classification.active_planet') selector = 'body.' + equals;
  if (equals === true) {
    if (Object.hasOwn(selectorsBySource, path)) selector = selectorsBySource[path];
    if (fact.startsWith(verified)) selector = fact.slice(verified.length);
  }
  if (path === 'active_planet_fecundity' || path === 'active_planet_sign_fecundity') {
    if (equals === 'barren') selector = 'barren_planet_in_barren_sign';
  }
  return lillyChildrenSelectors.has(selector) ? childFact(selector) : null;
}

export function lillyChildrenAlternatives(condition, group) {
  const { fact, equals } = condition;
  if (!fact.startsWith(testimonies)) return null;
  const path = fact.slice(testimonies.length);
  const atom = (key, root = 'profiles.lilly.') => [{ fact: root + key, equals: true }];
  if (equals === true) {
    const aspects = {
      fifth_and_first_lords_friendly: [familyLords + 'friendly'],
      fifth_and_first_lords_hard: [familyLords + 'square', familyLords + 'opposition'],
      mercury_friendly_aspect_to_benefic: ['aspects.mercury.jupiter.friendly', 'aspects.mercury.venus.friendly'],
      mercury_configured_to_malefic: ['saturn', 'mars'].flatMap(body => ['any', 'conjunction'].map(aspect => `aspects.mercury.${body}.${aspect}`)),
    }[path];
    if (aspects) return aspects.map(key => atom(key));
  }
  const value = key => group.find(item => item.fact === testimonies + key)?.equals;
  // The house and both classifications belong to one witness, not to any
  // independently selected bodies in the same chart.
  if (['active_significator_house', 'active_significator_fertile_planet', 'active_significator_in_fertile_sign'].includes(path)) {
    const house = value('active_significator_house');
    if (childHouses.includes(house) && value('active_significator_fertile_planet') === true
      && value('active_significator_in_fertile_sign') === true) return [atom(fertileHouseSelector(house), verified)];
  }
  if (['active_prolific_planet', 'active_sign_is_bicorporeal', 'active_sign_is_fertile'].includes(path)
    && value('active_prolific_planet') === true) {
    const common = value('active_sign_is_bicorporeal'), fertile = value('active_sign_is_fertile');
    if (common === true && fertile === false) return [atom('quantity.common_only', verified)];
    if (fertile === true && common === false) return [atom('quantity.fruitful_only', verified)];
  }
  return null;
}

export function lillyChildrenFacts(facts, houses, nodes) {
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  const fifthLord = houses.find(f => f.kind === 'western_lilly_house_ruler' && f.house === 5)?.planet;
  const positions = new Map(lillyDignityBodies.map(body => [body, lillyPlanetPosition(facts, body)]));
  const planets = houses.filter(f => f.kind === 'western_lilly_planet_house' && positions.get(f.planet));
  const occupants = planets.filter(f => childHouses.includes(f.house)).map(({ planet: body, house }) =>
    ({ body, house, sign: positions.get(body).sign }));
  const active = [...occupants];
  for (const { node, house } of nodes.filter(f => f.kind === 'western_lilly_node_house' && childHouses.includes(f.house))) {
    const sign = zodiacNames.indexOf(nodes.find(f => f.kind === 'western_lilly_node_sign' && f.node === node)?.sign);
    if (sign >= 0) active.push({ body: node, house, sign });
  }
  const selectors = new Set();
  const fifthPosition = positions.get(fifthLord);
  if (planets.length === lillyDignityBodies.length && !occupants.length && fifthPosition) {
    selectors.add('empty_children_houses');
    active.push({ body: fifthLord, house: null, sign: fifthPosition.sign });
  }
  const compareHouse = (house, group) => active.some(f => f.house === house && group.includes(f.body));
  if (compareHouse(5, fruitfulPlanets) && compareHouse(11, barrenPlanets)) selectors.add('fifth_outweighs_eleventh');
  if (fruitfulSigns.includes(Math.floor(cusps[0] / 30))) selectors.add('ascending_sign_fertile');
  if (fruitfulSigns.includes(Math.floor(cusps[4] / 30))) selectors.add('fifth_cusp_sign_fertile');
  if (fruitfulSigns.includes(fifthPosition?.sign)) selectors.add('fifth_ruler_sign_fertile');
  if (['Moon', 'Venus'].every(body => occupants.some(f => f.body === body && f.house === 5 && fruitfulSigns.includes(f.sign)))) {
    selectors.add('venus_and_moon_fifth_fertile');
  }
  if ([...positions.values()].every(pos => fruitfulSigns.includes(pos?.sign))) selectors.add('all_planets_fertile_signs');
  if (fifthPosition && !['Sun', 'Moon'].includes(fifthLord)) {
    const moving = facts.filter(f => f.planet === fifthLord);
    const directions = new Set(moving.filter(f => f.kind === 'planet_motion').map(f => f.motion));
    const speeds = moving.filter(f => ['planet_daily_motion', 'planet_hourly_motion'].includes(f.kind));
    if (directions.size === 1 && directions.has('retrograde') && speeds.every(f => f.signedDegrees < 0)) {
      selectors.add('fifth_ruler_retrograde');
    }
  }
  for (const { body, house, sign } of active) {
    const fecund = fruitfulWitnesses.includes(body), barren = barrenWitnesses.includes(body);
    if (fecund || barren) selectors.add(bodySelector(body));
    if (body === 'Mercury') selectors.add('mercury_active');
    if (['Saturn', 'Mars'].includes(body)) selectors.add('active_malefic');
    if (fruitfulPlanets.includes(body) && barrenSigns.includes(sign)) selectors.add('mixed_fecund_planet_barren_sign');
    if (barrenPlanets.includes(body) && fruitfulSigns.includes(sign)) selectors.add('mixed_barren_planet_fecund_sign');
    if (barren && barrenSigns.includes(sign)) selectors.add('barren_planet_in_barren_sign');
    if (fecund && house && fruitfulSigns.includes(sign)) selectors.add(fertileHouseSelector(house));
    if (fruitfulPlanets.includes(body) && quantityHouses.includes(house)) {
      const common = commonSigns.includes(sign), fruitful = fruitfulSigns.includes(sign);
      if (common && !fruitful) selectors.add('quantity.common_only');
      if (fruitful && !common) selectors.add('quantity.fruitful_only');
    }
  }
  return [...selectors].map(childFact);
}
