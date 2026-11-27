import { createHash } from 'node:crypto';
import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyHouseClasses, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillyEnemiesProfile = 'lilly-1647-enemies-testimonies-v1';
// Book III, pp.635, 639–641. Scope each interpretation to the reviewed source.
const reviewed = new Map([
  ['astro-lilly-v3-enemies-p004-001', '481481ac028059680b854422dc2a6a05446406eb9358563833e448bab500d27e'],
  ['astro-lilly-v3-enemies-p007-001', 'd8bcf8f229e3fcc364970499bde088a5a9a3cf68326b891cb4c572d3a0e05917'],
  ['astro-lilly-v3-enemies-p008-001', 'c297fdfcdbd40bad11d934c2727dea92bad72b18699c34c72651607e719c98dd'],
  ['astro-lilly-v3-enemies-p009-001', '39e4c2f5ab430e24893d3590926724a7fda9bb024b22a993837c7d385ec735b5'],
  ['astro-lilly-v3-enemies-p010-001', '9e16a4acd5d68845ba8054747457c248715775cd47832bcbe95ec944209d1b7e'],
  ['astro-lilly-v3-enemies-p012-001', '0102338d28854a1aab176d054447bce6650b7fe87f678c4381b8d272770a412d'],
  ['astro-lilly-v3-enemies-p013-001', '88e48f6b21921abee9b0250d66d64b19e61c03f68df87a4705ca1316d714dbe6'],
  ['astro-lilly-v3-enemies-p014-001', '31d755504c4d693ea3b5861a4e7e142f624ca85ae27d04f27b1bf74838206e02'],
  ['astro-lilly-v3-enemies-p015-001', '0ab371be065af7b8235d6237ebb16a54f2abfe7cb29736069bc8a5f37157e908'],
  ['astro-lilly-v3-enemies-p016-001', 'ae3a4f269981425f9a5eed1ad622b82fbb32a18642c48d43acca3429c58c25c0'],
  ['astro-lilly-v3-enemies-p017-001', '40a9b4715df016e58d8a1ad8a6de4877a5d9af994d22a2b3b81e76198a95131c'],
  ['astro-lilly-v3-enemies-p018-001', '4717d8384945d4271453d18ac8c5ad20ea0b65d2589e62f211cfba8f2bd53033'],
]);
export const isLillyEnemiesSource = ({ id }) => reviewed.has(id);

export function lillyEnemiesSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  return reviewed.get(id) === digest;
}

export const lillyEnemyTestimonies = {
  'active_malefic_in_twelfth_or_angular': '火星或土星落十二宫或角宫',
  'both_luminaries_opposed_by_planets': '太阳和月亮各有其他古典行星与其对冲',
  'seventh_empty': '第七宫无古典行星',
  'twelfth_empty': '第十二宫无古典行星',
  'ascendant_lord_disposes_twelfth_lord': '第一宫主是第十二宫主所处星座的庙主',
  'active_significator_house_class.succedent': '至少一颗对立关系指征星落续宫',
  'active_significator_house_class.cadent': '至少一颗对立关系指征星落果宫',
  'active_significator_dignity_branch.major_essential_strength': '至少一颗对立关系指征星入庙或擢升',
  'active_significator_dignity_branch.peregrine_detriment_or_fall': '至少一颗对立关系指征星无本质尊贵、失势或落陷',
  'active_significator_dignity_branch.minor_triplicity_term_or_face': '至少一颗对立关系指征星有三分、界或面尊贵，且无入庙或擢升',
  'twelfth_lord_retrograde': '第十二宫主逆行',
  'twelfth_lord_essential_debility.fall': '第十二宫主落陷',
  'twelfth_lord_essential_debility.detriment': '第十二宫主失势',
};
export const lillyEnemyUsesOrbs = selector => selector === 'both_luminaries_opposed_by_planets'
  || typeof selector === 'string' && selector.startsWith('active_significator_');
const testimony = (selector, table = 'main') => ({ kind: 'western_lilly_enemies', table, selector });

export function lillyEnemiesCondition(fact, equals, table) {
  if (fact === 'profiles.lilly.conflicts.twelfth_ruler_aspects_ascendant_ruler' && equals === false) {
    return { kind: 'western_lilly_aspect', table, first: 'house_12_ruler', second: 'house_1_ruler', aspect: 'any', matches: false };
  }
  if (fact === 'profiles.lilly.conflicts.house_12_ruler' && ['venus', 'jupiter'].includes(equals)) {
    return { kind: 'western_lilly_house_ruler', house: 12, planet: equals === 'venus' ? 'Venus' : 'Jupiter' };
  }
  if (!fact.startsWith('profiles.lilly.enemies.')) return null;
  const field = fact.slice('profiles.lilly.enemies.'.length);
  const selector = equals === false && ['seventh_has_planets', 'twelfth_has_planets'].includes(field)
    ? field.replace('_has_planets', '_empty') : equals === true ? field : field + '.' + equals;
  return Object.hasOwn(lillyEnemyTestimonies, selector)
    ? testimony(selector, lillyEnemyUsesOrbs(selector) ? table : 'main') : null;
}

const luminaries = ['Sun', 'Moon'];
const minorDignities = ['triplicity', 'term', 'face'];
const majorDignities = ['domicile', 'exaltation'];
const debilities = ['detriment', 'fall'];

export function lillyEnemyOppositions(positions, table) {
  const opponents = [...positions.keys()].filter(planet => !luminaries.includes(planet));
  return luminaries.flatMap(light => opponents.flatMap(planet => {
    const first = light.toLowerCase(), second = planet.toLowerCase();
    return lillyAspect(positions.get(light), positions.get(planet), first, second, 'opposition', table) === true
      ? [{ light, planet, aspect: { kind: 'western_lilly_aspect', first, second, aspect: 'opposition', table, matches: true } }] : [];
  }));
}

export function lillyEnemiesFacts(chart, houses, dignities) {
  if (!houses.length) return [];
  const zodiacs = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(chart, planet)?.longitude])
    .filter(([, longitude]) => Number.isFinite(longitude)));
  const placements = houses.filter(fact => fact.kind === 'western_lilly_planet_house' && positions.has(fact.planet));
  const houseOf = new Map(placements.map(({ planet, house }) => [planet, house]));
  const lord = house => houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === house)?.planet;
  const first = lord(1), seventh = lord(7), twelfth = lord(12);
  const result = [];
  if (['Mars', 'Saturn'].some(planet => [1, 4, 7, 10, 12].includes(houseOf.get(planet)))) {
    result.push(testimony('active_malefic_in_twelfth_or_angular'));
  }
  if (placements.length === lillyDignityBodies.length) {
    if (!placements.some(({ house }) => house === 7)) result.push(testimony('seventh_empty'));
    if (!placements.some(({ house }) => house === 12)) result.push(testimony('twelfth_empty'));
  }
  if (first !== twelfth && positions.has(twelfth) && lillyDomicileRuler(positions.get(twelfth)) === first) {
    result.push(testimony('ascendant_lord_disposes_twelfth_lord'));
  }
  const twelfthMotion = new Set(chart.filter(fact => fact.kind === 'planet_motion' && fact.planet === twelfth)
    .map(fact => fact.motion));
  if (positions.has(twelfth) && twelfthMotion.size === 1 && twelfthMotion.has('retrograde')) {
    result.push(testimony('twelfth_lord_retrograde'));
  }
  const dignityOf = (planet, dignity) => dignities.find(fact => fact.planet === planet && fact.dignity === dignity)?.matches;
  for (const dignity of debilities) {
    if (dignityOf(twelfth, dignity) === true) result.push(testimony('twelfth_lord_essential_debility.' + dignity));
  }

  const fixedActors = [seventh, twelfth, ...placements.filter(({ house }) => house === 7 || house === 12).map(({ planet }) => planet)];
  for (const table of Object.keys(lillyOrbTables)) {
    const opposing = lillyEnemyOppositions(positions, table);
    if (luminaries.every(light => opposing.some(row => row.light === light))) result.push(testimony('both_luminaries_opposed_by_planets', table));
    const actors = [...new Set([...fixedActors, ...opposing.map(row => row.planet)])];
    const emit = selector => result.push(testimony(selector, table));
    for (const classification of ['succedent', 'cadent']) {
      if (actors.some(planet => lillyHouseClasses[(houseOf.get(planet) - 1) % 3] === classification)) {
        emit('active_significator_house_class.' + classification);
      }
    }
    const dignified = (planet, names) => names.some(dignity => dignityOf(planet, dignity) === true);
    if (actors.some(planet => dignified(planet, majorDignities))) {
      emit('active_significator_dignity_branch.major_essential_strength');
    }
    if (actors.some(planet => dignified(planet, ['peregrine', ...debilities]))) {
      emit('active_significator_dignity_branch.peregrine_detriment_or_fall');
    }
    if (actors.some(planet => majorDignities.every(dignity => dignityOf(planet, dignity) === false) && dignified(planet, minorDignities))) {
      emit('active_significator_dignity_branch.minor_triplicity_term_or_face');
    }
  }
  return result;
}
