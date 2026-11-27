import { createHash } from 'node:crypto';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { lillyAspect, lillyHouseClasses, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { lillySolarProfile } from './lilly-solar-motion.mjs';

export const lillyNinthHouseProfile = 'lilly-1647-ninth-house-testimonies-v1';
const prefix = 'astro-lilly-v3-religion-dreams-p';
// Christian Astrology, Book III, pp.611–614. Pin the reviewed source editions.
const reviewed = new Map([
  ['005', '424f6649b32ff252f6b878e37bb9c2d1337d0894f5c0893529a850369720e29f'],
  ['007', 'cabed24e2244754563eff0814f8da69cc9e4eb94727ba1a513a1a913150b2f12'],
  ['009', 'fdbd521e6ba729cc9d6db2907c0571992e8269ba5647cc6c087c2ae9aa7a2b95'],
  ['010', '3cb341f76e306bec61b5b07475f25992a75cd2cae3a49f7c529868850713c0bf'],
  ['012', 'aa70a7ca6a730d91a8e394d124a71ddfe3a8d80004a288bd0bdfce71c3d23dc6'],
  ['013', 'acf43e36659ca03329dd0026f21d965a901387e8cc1f8092488932c78a1bea2c'],
  ['014', '4491c02df84115fe2e8b3c40838dd56678f287f77bff428b9bf7dd1ee2123fd8'],
  ['015', '11b6bc6d8e7a0a9c5fe202d4a864efc32276d1d5943cfd6cc50bfb101f630607'],
  ['016', 'ecf0a82aae1c9a57883aec855e5ed9e1b9cff2b7eb34729b8f14aaddc5cecada'],
  ['017', 'b5ad8fbfcc3ad54526aa846721b0c1ba5295c74ae730e2914ac787ab7b033ccf'],
  ['018', '260dbd4ac65b60bf7a762f45a97d4f96d07907e31a0b52fc5d02ae096cb1604a'],
  ['022', '23197ee95d35949bda88eb3cfecebc4bbda0d64221065200e25e0969141a11b7'],
  ['023', '1f346e736fd28e032beee25e062eb31e8f8ac9eb80f27aba7393b3635438a3fd'],
  ['024', 'fb207c5e4ccc72a3e6278f18231121172eea898fc338fd4b7e4344fad4037bfa'],
  ['025', 'aef2bcbd881bcbbde667433320ad6d3f9d2c93da251f8eb841f863b6b366b64e'],
  ['027', '26731e51b6c63ad7b5b535de7392a25212e206ea0c19d398786295665ed86a94'],
  ['030', 'c7e7d19397e02ae552419e54092981dc89019870d5dcad87fb6c7ac11d32d403'],
  ['031', '994c4c8780af1de184631ddb1c1fbfc792cfc85fc09e3abe20d5c64e8329c790'],
  ['032', 'a2a4512c1b95372b32a9468e132f4f6ef07bef6091cdb26da4ebddd0fff6d550'],
  ['033', '85d4dd79b38bcaec900fd3a877a31b19ecb1e64b697ca53af522d86d175047a5'],
  ['034', 'a9d14020dabce8df7e83876023e7cf508efc064f86ecf371aedac29148ed5606'],
  ['035', 'b5c9d7315b4e142101121ccb09db6976563903f957a14399b1489e31aa075aaa'],
  ['036', '5556d7d26ea2e793ec2c4b86b66d2d50ff499174cd4481f3e84c630d5e6160a0'],
  ['037', 'e3b54efd442153f464003132d5e1d2a92b3c9ab13eedc3b2a474cf7856e60cd4'],
  ['038', '27e54c56cf9b9c73bd162445645078c559e56abce1f82fe6a88bad69ca444f8a'],
  ['039', '88cee1f34d77dd488833b2159a08651a5be2ac4bb092a684b7e45c9fa26dfb76'],
  ['040', '403b555d0f9557175ed5596a172bd037cc1c294ef82b379f48dd5073dc53c8ca'],
  ['041', 'a5a60ab115143c3bbc0ba694dbef8250ddf84de5a28f1907ecd81e3a810ea60e'],
  ['042', '4b9472453906ad9e8534979c1169054ea8b53be8cdeb5956147a308fe60424ea'],
]);
const sourceNumber = id => id?.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : null;
export const isLillyNinthHouseSource = ({ id }) => reviewed.has(sourceNumber(id));

export function lillyNinthHouseSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  return reviewed.get(sourceNumber(id)) === digest;
}

const pendingReview = new Map([
  ['005', '采用同一黄道整度的角宿一接触，原句未指明可延伸的相伴范围。'],
  ['009', '已核顺行且入庙或擢升、脱离日光束并确认与火土无硬相的形态，其他强势形态仍待校核。'],
  ['010', '已核本质失势、落陷、无尊贵、燃烧或火土整度硬相，其他严重受克形态仍待校核。'],
  ['025', '已核卷一第 113 页的日心条件，格言旁列对太阳的措辞继续待核。'],
  ...['027', '034', '035', '042'].map(number => [number, '已核失势、落陷与燃烧，其他失宜或受损形态仍待校核。']),
  ['039', '采用月亮与月南交点同一黄道整度的形态，原句未指明可延伸的相伴范围。'],
  ['041', '已核木星无本质尊贵、失势、落陷或燃烧，章首其余弱势形态仍待校核。'],
]);

export const lillyNinthHouseReview = id => pendingReview.get(sourceNumber(id));

const labels = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
const signClassLabels = { movable: '本位星座', bicorporeal: '双体星座' };
export const lillyNinthHouseTestimonies = {
  houses_3_and_9_empty: '已核实七颗古典星体均未落第三宫或第九宫',
  ninth_empty: '已核实七颗古典星体均未落第九宫',
  jupiter_venus_or_node_with_spica: '木星、金星或月北交点与角宿一在黄道同一度位',
  direct_saturn_or_mars_in_fixed_sign_in_third_or_ninth_with_benefic_aspect: '第三宫或第九宫有一颗顺行且落固定星座的土星或火星，与木星或金星成六分或三分相',
  strong_unafflicted_benefic_in_9: '第九宫有一颗顺行、入庙或擢升且脱离日光束的木星或金星，与火星及土星均无合、四分或对冲',
  weak_or_afflicted_benefic_in_9: '第九宫有木星或金星无本质尊贵、失势、落陷、被日光燃烧或与火土成同度位硬相',
  'angular.jupiter': '木星实际落角宫',
  'angular.venus': '金星实际落角宫',
  'angular.sun': '太阳实际落角宫',
  'angular.moon': '月亮实际落角宫',
  'angular.mercury': '水星实际落角宫',
  jupiter_cadent: '木星实际落果宫',
  jupiter_afflicted_by_malefic: '木星与火星或土星成合、四分或对冲',
  ninth_ruler_ill_disposed: '实际第九宫主失势、落陷或被日光燃烧',
  ninth_ruler_angular: '实际第九宫主落角宫',
  ninth_ruler_retrograde: '实际第九宫主逆行',
  saturn_retrograde: '土星逆行',
  'saturn_sign_modality.mutable': '土星处于双体星座',
  moon_in_double_bodied_sign: '月亮处于双体星座',
  mercury_in_double_bodied_sign: '水星处于双体星座',
  ascendant_ruler_in_double_bodied_sign: '实际第一宫主处于双体星座',
  saturn_mars_or_south_node_in_movable_sign_in_third_or_ninth: '在第三宫或第九宫的土星、火星或月南交点实际处于本位星座',
  moon_south_node_together: '月亮与月南交点在黄道同一度位',
  saturn_with_dream_moon: '第九宫选出的月亮指征与土星成合相',
  cxl_ii_opening_malefic_placement: '第九宫有土星、火星或月南交点，或第三宫有土星、火星，且同一指征处于本位星座',
  jupiter_weak_under_chapter_opening: '木星无本质尊贵、失势、落陷或被日光燃烧',
  mars_unfortunate: '火星失势、落陷或被日光燃烧',
  ...Object.fromEntries(Object.entries(labels).map(([planet, label]) =>
    ['dream_significators.' + planet.toLowerCase(), '按第九宫行星或空宫宫主取' + label + '为梦象指征'])),
  ...Object.fromEntries(['Moon', 'Venus'].flatMap(planet => Object.entries(signClassLabels).map(([classification, label]) =>
    [planet.toLowerCase() + '_religion_sign_class.' + classification, labels[planet] + '处于' + label]))),
};

const orbed = new Set([
  'direct_saturn_or_mars_in_fixed_sign_in_third_or_ninth_with_benefic_aspect',
  'strong_unafflicted_benefic_in_9', 'jupiter_afflicted_by_malefic', 'saturn_with_dream_moon',
]);
export const lillyNinthHouseUsesOrbs = selector => orbed.has(selector);
const testimony = (selector, table = 'main') => ({ kind: 'western_lilly_ninth_house', table, selector });
const cazimi = new Map([['jupiter_cazimi', 'jupiter'], ['venus_cazimi', 'venus']]);
const dignities = new Map([['jupiter_major_dignity', ['domicile', 'exaltation']],
  ['jupiter_debility', ['peregrine', 'fall', 'detriment']]]);
const otherAngles = ['venus', 'sun', 'moon', 'mercury'];

export function lillyNinthHouseCondition(sourceFact, equals, table) {
  const namespace = 'profiles.lilly.religion_dreams.';
  if (!sourceFact.startsWith(namespace)) return null;
  const fact = sourceFact.slice(namespace.length);
  if (cazimi.has(fact) && equals === true) {
    return { kind: 'western_lilly_solar_state', selector: cazimi.get(fact), condition: 'cazimi', matches: true, profile: lillySolarProfile };
  }
  if (dignities.get(fact)?.includes(equals)) {
    return { kind: 'western_lilly_dignity', planet: 'Jupiter', dignity: equals, matches: true, profile: lillyDignityProfile };
  }
  const other = /^jupiter_reception_with\.([a-z]+)$/u.exec(fact)?.[1];
  if (otherAngles.includes(other) && equals === true) {
    return { kind: 'western_lilly_reception', first: 'jupiter', second: other, reception: 'mutual', matches: true, profile: lillyDignityProfile };
  }
  if (fact === 'jupiter_venus_aspect' && ['conjunction', 'sextile', 'trine'].includes(equals)) {
    return { kind: 'western_lilly_aspect', table, first: 'jupiter', second: 'venus', aspect: equals, matches: true };
  }
  if (fact === 'ninth_ruler' && ['jupiter', 'venus'].includes(equals)) {
    return { kind: 'western_lilly_house_ruler', house: 9, planet: equals === 'jupiter' ? 'Jupiter' : 'Venus' };
  }
  const selector = fact === 'jupiter_angular' && equals === true ? 'angular.jupiter' : equals === true ? fact : fact + '.' + equals;
  return Object.hasOwn(lillyNinthHouseTestimonies, selector)
    ? testimony(selector, lillyNinthHouseUsesOrbs(selector) ? table : 'main') : null;
}

const benefics = ['Jupiter', 'Venus'];
const malefics = ['Mars', 'Saturn'];
const hardAngles = { conjunction: 0, square: 90, opposition: 180 };
const majorDignities = ['domicile', 'exaltation'];
const essentialWeakness = ['detriment', 'fall'];

function sameDegree(first, second) {
  return Number.isFinite(first) && Number.isFinite(second) && Math.floor(first) === Math.floor(second);
}

export function lillyNinthHouseFacts(chart, houses, nodes, dignityFacts, solarFacts) {
  const zodiacs = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const position = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(chart, planet)?.longitude])
    .filter(([, longitude]) => Number.isFinite(longitude)));
  const nodePosition = new Map(lillyNodeLongitudes(chart).map(({ node, longitude }) => [node, longitude]));
  const evidence = [];
  const emit = (condition, selector, table) => { if (condition) evidence.push(testimony(selector, table)); };
  const spica = new Set(chart.filter(fact => fact.kind === 'western_fixed_star_longitude'
    && fact.profile === westernFixedStarProfile && fact.star === 'spica_virgo').map(fact => fact.longitude));
  emit(spica.size === 1 && [...benefics.map(planet => position.get(planet)), nodePosition.get('north_node')]
    .some(longitude => sameDegree(longitude, spica.values().next().value)), 'jupiter_venus_or_node_with_spica');

  if (!houses.length) return evidence;
  const houseOf = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house' && position.has(fact.planet))
    .map(({ planet, house }) => [planet, house]));
  const nodeHouse = new Map(nodes.filter(fact => fact.kind === 'western_lilly_node_house').map(({ node, house }) => [node, house]));
  const ruler = house => houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === house)?.planet;
  const houseClass = planet => lillyHouseClasses[(houseOf.get(planet) - 1) % 3];
  const isAngular = planet => houseClass(planet) === 'angular';
  // From Aries onward, movable, fixed and common signs alternate.
  const modality = longitude => ['movable', 'fixed', 'bicorporeal'][Math.floor(longitude / 30) % 3];
  const signClass = planet => modality(position.get(planet));
  const hasMotion = (planet, expected) => {
    const motions = new Set(chart.filter(fact => fact.kind === 'planet_motion' && fact.planet === planet).map(fact => fact.motion));
    return position.has(planet) && motions.size === 1 && motions.has(expected);
  };
  const hasDignity = (planet, names) => dignityFacts.some(fact => fact.planet === planet && names.includes(fact.dignity) && fact.matches === true);
  const hasSolar = (planet, condition) => solarFacts.some(fact => fact.selector === planet?.toLowerCase() && fact.condition === condition && fact.matches === true);
  const illDisposed = planet => hasDignity(planet, essentialWeakness) || hasSolar(planet, 'combust');

  const ninthOccupants = [...houseOf].filter(([, house]) => house === 9).map(([planet]) => planet);
  const ninthEmpty = houseOf.size === lillyDignityBodies.length && !ninthOccupants.length;
  const ninthRuler = ruler(9);
  const dreamPlanets = ninthEmpty ? [ninthRuler] : ninthOccupants;
  const ninthBenefics = ninthOccupants.filter(planet => benefics.includes(planet));
  emit(ninthEmpty, 'ninth_empty');
  emit(ninthEmpty && ![...houseOf.values()].includes(3), 'houses_3_and_9_empty');
  for (const planet of dreamPlanets) if (position.has(planet)) emit(true, 'dream_significators.' + planet.toLowerCase());

  for (const planet of ['Jupiter', 'Venus', 'Sun', 'Moon', 'Mercury']) emit(isAngular(planet), 'angular.' + planet.toLowerCase());
  emit(houseClass('Jupiter') === 'cadent', 'jupiter_cadent');
  emit(illDisposed(ninthRuler), 'ninth_ruler_ill_disposed');
  emit(isAngular(ninthRuler), 'ninth_ruler_angular');
  emit(hasMotion(ninthRuler, 'retrograde'), 'ninth_ruler_retrograde');
  emit(hasMotion('Saturn', 'retrograde'), 'saturn_retrograde');
  emit(signClass('Saturn') === 'bicorporeal', 'saturn_sign_modality.mutable');
  emit(signClass('Moon') === 'bicorporeal', 'moon_in_double_bodied_sign');
  emit(signClass('Mercury') === 'bicorporeal', 'mercury_in_double_bodied_sign');
  emit(signClass(ruler(1)) === 'bicorporeal', 'ascendant_ruler_in_double_bodied_sign');
  for (const planet of ['Moon', 'Venus']) {
    const classification = signClass(planet);
    if (Object.hasOwn(signClassLabels, classification)) emit(true, planet.toLowerCase() + '_religion_sign_class.' + classification);
  }
  const maleficMovable = malefics.some(planet => [3, 9].includes(houseOf.get(planet)) && signClass(planet) === 'movable');
  const southMovable = modality(nodePosition.get('south_node')) === 'movable';
  emit(maleficMovable || southMovable && [3, 9].includes(nodeHouse.get('south_node')), 'saturn_mars_or_south_node_in_movable_sign_in_third_or_ninth');
  emit(maleficMovable || southMovable && nodeHouse.get('south_node') === 9, 'cxl_ii_opening_malefic_placement');
  emit(illDisposed('Jupiter') || hasDignity('Jupiter', ['peregrine']), 'jupiter_weak_under_chapter_opening');
  emit(illDisposed('Mars'), 'mars_unfortunate');
  emit(sameDegree(position.get('Moon'), nodePosition.get('south_node')), 'moon_south_node_together');
  emit(ninthBenefics.some(planet => illDisposed(planet) || hasDignity(planet, ['peregrine'])
    || malefics.some(malefic => Object.values(hardAngles).some(angle =>
      sameDegree((position.get(malefic) + angle) % 360, position.get(planet))
      || sameDegree((position.get(planet) + angle) % 360, position.get(malefic))))), 'weak_or_afflicted_benefic_in_9');

  for (const table of Object.keys(lillyOrbTables)) {
    const aspect = (first, second, name) =>
      lillyAspect(position.get(first), position.get(second), first.toLowerCase(), second.toLowerCase(), name, table);
    const hardContacts = planet => malefics.flatMap(malefic => Object.keys(hardAngles).map(name => aspect(planet, malefic, name)));
    emit(hardContacts('Jupiter').includes(true), 'jupiter_afflicted_by_malefic', table);
    emit(malefics.some(planet => [3, 9].includes(houseOf.get(planet)) && signClass(planet) === 'fixed' && hasMotion(planet, 'direct')
      && benefics.some(benefic => aspect(planet, benefic, 'friendly') === true)),
      'direct_saturn_or_mars_in_fixed_sign_in_third_or_ninth_with_benefic_aspect', table);
    emit(ninthBenefics.some(planet => hasMotion(planet, 'direct') && hasDignity(planet, majorDignities)
      && hasSolar(planet, 'free_of_beams') && hardContacts(planet).every(value => value === false)),
      'strong_unafflicted_benefic_in_9', table);
    emit(dreamPlanets.includes('Moon') && aspect('Moon', 'Saturn', 'conjunction') === true, 'saturn_with_dream_moon', table);
  }
  return evidence;
}
