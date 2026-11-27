import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyOrbTables, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';
import { estateSupport, estateSupportPlaces, familyAssessment, familyAssessmentNames, familyBenefics,
  familyConfiguration as configuration, fourthPriority, lillyFamilyAssessments, strongerParent } from './lilly-family-assessments.mjs';
import { birthAscendant, birthAscendantRay, birthAttendantMotion, birthCompanions, difficultBirthRays, easyBirthRays,
  isLillyFamilyBirthFact, lillyFamilyBirthFacts, longBirthSigns, obliqueBirthSigns } from './lilly-family-birth.mjs';
import { estateMalefics, estatePressure, estatePressurePaths } from './lilly-family-estate.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { lillyMotionProfile, lillySolarProfile } from './lilly-solar-motion.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyFamilyProfile = 'lilly-1647-family-569-573-v1';
const sides = { father: { house: 4, day: 'Sun', night: 'Saturn' }, mother: { house: 10, day: 'Venus', night: 'Moon' } };
const parents = Object.keys(sides);
const tables = Object.keys(lillyOrbTables);
const sourceContacts = { Jupiter: ['friendly'], Venus: ['friendly'], Mars: ['conjunction', 'square', 'opposition'], Saturn: ['conjunction', 'square', 'opposition'] };
const configurationNames = ['sun_moon_masculine', 'sun_south_node_bestial', 'sun_north_node',
  'father_mixed', 'fourth_cadent_pressure', 'estate_fifth_unfortunate', 'estate_sun_mars_rays_second'];
const shares = ['all', 'strict_majority'];
const cadentHouses = [3, 6, 9, 12];
const favorableHouses = [1, 2, 10, 11];
const birthSigns = { male: ['狮子座', '天秤座', '射手座'], female: ['巨蟹座', '处女座', '天蝎座'] };
const birthLuminaries = ['Sun', 'Moon'];
export const lillyFamilyAphorismFact = { kind: 'western_lilly_family_historical_aphorism' };
export const lillyFamilyBirthBranchFact = branch => ({ kind: 'western_lilly_family_birth_branch', branch });
const birthLuminary = (planet, sign) => ({ kind: 'western_lilly_family_birth_luminary', planet, sign });
const role = (parent, planet, role) => ({ kind: 'western_lilly_family_role', parent, planet, role });
const source = (parent, planet, table) => ({ kind: 'western_lilly_family_source', parent, planet, table });
const motherShare = share => ({ kind: 'western_lilly_family_mother_share', share });
const houseOf = (planet, house) => ({ kind: 'western_lilly_planet_house', planet, house });
const aspect = (table, first, second, aspect) => ({ kind: 'western_lilly_aspect', table, first, second, aspect, matches: true });
const dignity = (planet, dignity) => ({ kind: 'western_lilly_dignity', planet, dignity, matches: true, profile: lillyDignityProfile });
const solar = (selector, condition) => ({ kind: 'western_lilly_solar_state', selector, condition, matches: true, profile: lillySolarProfile });

export function isLillyFamilyFact(fact) {
  switch (fact.kind) {
    case 'western_lilly_family_role':
      return parents.includes(fact.parent) && (fact.role === 'member' ? lillyDignityBodies.includes(fact.planet)
        : fact.role === 'sect' && [sides[fact.parent].day, sides[fact.parent].night].includes(fact.planet));
    case 'western_lilly_family_source':
      return parents.includes(fact.parent) && Object.hasOwn(sourceContacts, fact.planet) && tables.includes(fact.table);
    case 'western_lilly_family_configuration': return configurationNames.includes(fact.selector);
    case 'western_lilly_family_assessment': return familyAssessmentNames.includes(fact.selector) && tables.includes(fact.table);
    case 'western_lilly_family_stronger_parent': return parents.includes(fact.parent) && tables.includes(fact.table);
    case 'western_lilly_family_fourth_priority': return lillyDignityBodies.includes(fact.planet);
    case 'western_lilly_family_estate_support':
      return familyBenefics.includes(fact.planet) && estateSupportPlaces.includes(fact.place)
        && ['day', 'night'].includes(fact.sect) && tables.includes(fact.table);
    case 'western_lilly_family_estate_pressure':
      return estateMalefics.includes(fact.planet) && estatePressurePaths.includes(fact.path) && tables.includes(fact.table);
    case 'western_lilly_family_mother_share': return shares.includes(fact.share);
    case 'western_lilly_family_birth_branch': return Object.hasOwn(birthSigns, fact.branch);
    case 'western_lilly_family_birth_luminary': return birthLuminaries.includes(fact.planet) && zodiacNames.includes(fact.sign);
    default: return isLillyFamilyBirthFact(fact);
  }
}

function beneficShare(members, placements, dignities) {
  // The cusp defines the group. Occupancy and essential dignity evaluate distinct bodies.
  const results = [...members].map(planet => {
    if (favorableHouses.includes(placements.get(planet))) return true;
    const evidence = dignities.find(fact => fact.planet === planet && fact.dignity === 'peregrine');
    return evidence && !evidence.matches;
  });
  if (!results.length) return [];
  const favorable = results.filter(Boolean).length;
  if (favorable === results.length) return [motherShare('all')];
  // A strict majority excludes an equally possible all-favorable chart.
  return favorable * 2 > results.length && results.includes(false) ? [motherShare('strict_majority')] : [];
}

export function lillyFamilyFacts(facts, houses, dignities) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical') || !houses.some(fact => fact.kind === 'western_lilly_ruleset')) return [];
  const known = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(facts, planet)])
    .filter(([, position]) => Number.isFinite(position?.longitude)));
  const placements = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house' && known.has(fact.planet))
    .map(({ planet, house }) => [planet, house]));
  const sects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const [possibleSect] = sects;
  const sect = sects.size === 1 && ['day', 'night'].includes(possibleSect) ? possibleSect : undefined;
  const rulers = new Map(houses.filter(fact => fact.kind === 'western_lilly_house_ruler').map(({ house, planet }) => [house, planet]));
  const cohorts = new Map();
  const evidence = [];
  for (const [parent, entry] of Object.entries(sides)) {
    const ruler = rulers.get(entry.house);
    const light = entry[sect];
    const members = new Set([ruler, light, ...[...placements].filter(([, house]) => house === entry.house).map(([planet]) => planet)]
      .filter(planet => known.has(planet)));
    cohorts.set(parent, { lord: ruler, light, members });
    if (known.has(light)) evidence.push(role(parent, light, 'sect'));
    evidence.push(...[...members].map(planet => role(parent, planet, 'member')));
    if (parent === 'mother' && light && placements.size === lillyDignityBodies.length) {
      evidence.push(...beneficShare(members, placements, dignities));
    }
    for (const [planet, angles] of Object.entries(sourceContacts)) {
      if (!placements.has(planet)) continue;
      for (const table of tables) {
        const hasContact = [...members].some(target => planet !== target && angles.some(type =>
          lillyAspect(known.get(planet).longitude, known.get(target).longitude,
            planet.toLowerCase(), target.toLowerCase(), type, table) === true));
        if (hasContact) evidence.push(source(parent, planet, table));
      }
    }
  }
  const sun = known.get('Sun'), moon = known.get('Moon');
  for (const planet of birthLuminaries) {
    const sign = zodiacNames[known.get(planet)?.sign];
    if (sign) evidence.push(birthLuminary(planet, sign));
  }
  const cusps = lillyCusps(facts);
  evidence.push(...lillyFamilyBirthFacts(facts, known, cusps?.[0]));
  if (sun && moon && sun.sign === moon.sign && sun.sign % 2 === 0) evidence.push(configuration('sun_moon_masculine'));
  const nodes = lillyNodeLongitudes(facts);
  const south = nodes.find(point => point.node === 'south_node')?.longitude;
  if (sun && Number.isFinite(south) && [0, 1, 4, 8, 9].includes(sun.sign) && lillyPartileDistance(sun.longitude, south) === 0) {
    evidence.push(configuration('sun_south_node_bestial'));
  }
  const north = nodes.find(point => point.node === 'north_node')?.longitude;
  if (sun && Number.isFinite(north) && lillyPartileDistance(sun.longitude, north) === 0) {
    evidence.push(configuration('sun_north_node'));
  }
  const complete = Boolean(sect && rulers.has(4) && rulers.has(10) && placements.size === lillyDignityBodies.length);
  evidence.push(...lillyFamilyAssessments(facts, known, placements, rulers, sect, cohorts, dignities, complete, cusps));
  return evidence;
}

export function lillyFamilyProof(conditions, observed) {
  const matched = [...conditions.required, ...conditions.alternatives.flat()];
  const sources = new Set(matched.filter(fact => fact.kind === 'western_lilly_family_source').map(fact => fact.planet));
  const comparedParents = matched.some(fact => fact.kind === 'western_lilly_family_stronger_parent');
  const hasMotherGroup = comparedParents || matched.some(fact => fact.kind === 'western_lilly_family_mother_share' || fact.selector === 'mother_severely_afflicted');
  const hasFatherGroup = comparedParents || matched.some(fact => fact.selector === 'father_mixed' || fact.selector === 'father_all_impeded');
  const hasEstateLoss = matched.some(fact => fact.selector === 'estate_fifth_unfortunate');
  const fifthRuler = hasEstateLoss && observed.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 5);
  const details = observed.filter(fact => (fact.kind === 'western_lilly_planet_house' && sources.has(fact.planet))
    || (fact.kind === 'western_lilly_family_role' && fact.role === 'member' && (fact.parent === 'mother' ? hasMotherGroup : hasFatherGroup))
    || (fifthRuler && (fact === fifthRuler || (fact.kind === 'western_lilly_planet_house'
      && fact.house === 4 && ['Mars', 'Saturn', fifthRuler.planet].includes(fact.planet)))));
  return details.length ? { ...conditions, required: [...conditions.required, ...details] } : conditions;
}

const sectGroups = parent => ['day', 'night'].map(sect => [
  { kind: 'western_sect', sect }, role(parent, sides[parent][sect], 'sect'),
]);
const sourceGroups = planet => parents.flatMap(parent => tables.map(table => [source(parent, planet, table)]));
const motherGroups = () => shares.map(share => [motherShare(share)]);
const assessmentGroups = (selector, sect) => tables.map(table => [familyAssessment(selector, table),
  ...(sect ? [{ kind: 'western_sect', sect }] : [])]);
const mixedGroups = prioritize => [{
  required: [configuration('father_mixed')],
  anyOf: lillyDignityBodies.map(planet => [houseOf(planet, 4), ...(prioritize ? [fourthPriority(planet)] : [])]),
}];
const estateGroups = () => tables.flatMap(table => estateSupportPlaces.map(place => ({
  required: [],
  anyOf: ['day', 'night'].flatMap(sect => familyBenefics.map(planet => [estateSupport(planet, place, sect, table)])),
})));
const estatePressureGroups = () => tables.flatMap(table => estateMalefics.flatMap(planet => estatePressurePaths.map(path => [
  { kind: 'western_sect', sect: 'night' }, solar('moon', 'oriental'), estatePressure(planet, path, table),
])));
const sunMarsEstate = () => tables.map(table => [configuration('estate_sun_mars_rays_second'),
  dignity('Sun', 'peregrine'), dignity('Mars', 'peregrine'), aspect(table, 'sun', 'mars', 'conjunction')]);
const disputedParent = house => tables.map(table => ({
  required: [aspect(table, 'house_10_ruler', 'house_4_ruler', 'opposition')],
  anyOf: ['Saturn', 'Mars'].map(planet => [houseOf(planet, house)]),
}));
const fatherDignity = () => lillyDignityBodies.map(planet => ({
  required: [role('father', planet, 'member')],
  anyOf: [1, 2, 4, 5, 7, 8, 10, 11].flatMap(house =>
    ['domicile', 'exaltation'].map(name => [houseOf(planet, house), dignity(planet, name)])),
}));
const branchesByHouse = (planets, houses) => planets.reduce((groups, planet) =>
  groups.flatMap(group => houses.map(house => [...group, houseOf(planet, house)])), [[]]);
const solarNorth = () => [[configuration('sun_north_node'), houseOf('Moon', 4)]];
const masculineConjunction = () => tables.map(table => [configuration('sun_moon_masculine'), aspect(table, 'sun', 'moon', 'conjunction')]);
const speed = (selector, condition) => ({ kind: 'western_lilly_speed_state', selector, condition, matches: true, profile: lillyMotionProfile });
const malevolentContact = (table, body, target, types) => types.map(type => [aspect(table, body, target, type)]);
const motherSlowMalefic = planet => tables.map(table => ({
  required: [speed(planet.toLowerCase(), 'slow')],
  anyOf: branchesByHouse([planet], cadentHouses).flatMap(group =>
    malevolentContact(table, planet.toLowerCase(), 'moon', ['square', 'opposition']).map(contact => [...group, ...contact])),
}));
const motherSwift = () => tables.flatMap(table => ['saturn', 'mars'].map(body => ({
  required: [speed('moon', 'swift'), speed(body, 'swift')],
  anyOf: branchesByHouse(['Moon', 'Venus'], favorableHouses).flatMap(group =>
    malevolentContact(table, body, 'moon', ['square', 'opposition']).map(contact => [...group, ...contact])),
})));
const saturnAfflictedMoon = orientation => tables.map(table => ({
  required: [solar('moon', orientation)],
  anyOf: malevolentContact(table, 'saturn', 'moon', ['conjunction', 'square', 'opposition']),
}));
const motherTenthSupport = () => tables.flatMap(table => ['Moon', 'Venus'].map(planet =>
  [houseOf(planet, 10), aspect(table, planet.toLowerCase(), 'jupiter', 'friendly')]));
const motherConjunction = () => tables.flatMap(table => ['Moon', 'Venus'].flatMap(planet => [4, 10].flatMap(house =>
  ['saturn', 'mars', 'mercury'].map(other => [houseOf(planet, house), aspect(table, planet.toLowerCase(), other, 'conjunction')]))));
const fortunateMoon = () => tables.flatMap(table => ['domicile', 'exaltation'].flatMap(honor =>
  [[1, 4, 7, 10], [2, 5, 8, 11]].flatMap(houses => [
    aspect(table, 'venus', 'moon', 'sextile'), aspect(table, 'venus', 'moon', 'trine'), aspect(table, 'jupiter', 'moon', 'any'),
  ].map(assistance => ({
    required: [dignity('Moon', honor), familyAssessment('moon_fortunate', table), assistance],
    anyOf: houses.map(house => [houseOf('Moon', house)]),
  })))));
const historicalBirth = branch => birthLuminaries.flatMap(planet =>
  birthSigns[branch].map(sign => [lillyFamilyBirthBranchFact(branch), birthLuminary(planet, sign)]));
const firstNode = node => ({ kind: 'western_lilly_node_house', house: 1, node });
const obliqueAscendantGroups = () => obliqueBirthSigns.flatMap(sign =>
  [...difficultBirthRays.map(birthAscendantRay), firstNode('south_node')].map(witness => [birthAscendant(sign), witness]));
const longAscendantGroups = () => [...easyBirthRays.map(birthAscendantRay), firstNode('north_node')].map(witness => ({
  required: [witness], anyOf: longBirthSigns.map(sign => [birthAscendant(sign)]),
}));
const obliqueMoonGroups = () => obliqueBirthSigns.flatMap(sign => tables.flatMap(table =>
  ['retrograde', 'stationary', 'slow'].map(motion => ({
    required: [birthLuminary('Moon', sign)],
    anyOf: (motion === 'slow' ? ['Sun', ...birthCompanions] : birthCompanions).map(planet => [
      aspect(table, 'moon', planet.toLowerCase(), 'conjunction'),
      motion === 'slow' ? speed(planet.toLowerCase(), 'slow') : birthAttendantMotion(planet, motion),
    ]),
  }))));
const historicalAphorisms = new Map([
  [40, ['a936ca1b5273fe6cb009a58824e3fafd1fcc0be2a4452e285b83c91c09322150',
    () => [['Sun', 'Saturn', 'Mars', 'Mercury'].map(planet => houseOf(planet, 4))]]],
  [42, ['875a0eb259496d9742b5e60ac539780113d4eedc9d842c0ef46fa04b551ac826', solarNorth, 1]],
  [43, ['3b2a0b2340fa493061cf442f0e81895d87f6402bda1c348a739009db2147a12a', masculineConjunction]],
  [44, ['057e51368f58a7c5770dadabcbc6c15eb52aa4826d18964cbac5f47886fabfb7', () => tables.map(table => ({
    required: [aspect(table, 'sun', 'saturn', 'conjunction')], anyOf: branchesByHouse(['Sun', 'Saturn'], cadentHouses),
  }))]],
  [45, ['2150508dcaac6b51d3390d48d79019d8e8d24a1801275864526e8d9ec36de06f', () => tables.map(table => ({
    required: [], anyOf: malevolentContact(table, 'saturn', 'sun', ['conjunction', 'square', 'opposition']),
  })), 1]],
  [47, ['dd177a88a209c11520e4377afe3ee72a534c74cf8567002a558a9d50bcccf1d7', motherTenthSupport]],
  [48, ['30572e8be177aa1c4ba23306abb8bd8912257eb2b3e83fe699008e8dfc97eb52', motherConjunction]],
  [49, ['1be025ec3685f0861d23078aa5b7741be66ca3621061cb876376c008570c3ac6', fortunateMoon, 1]],
  [50, ['86c63c6cd4287cd2031bd5eb4f9e0d9a2883452b280320ce5a81bfa0c05bd397', () => motherSlowMalefic('Saturn'), 1]],
  [51, ['9dab4a29cb6fd35bb75eeb35cd216f2cdfbad341cacee533508a24df72e97be1', () => motherSlowMalefic('Mars'), 1]],
  [52, ['d4a71de6f80af7fa2d89c0f884818904af51f9ccd26e70f2071b68949271c35b', motherSwift]],
  [53, ['e87257be5c1ce5ce002320636d9409444719b04c225fce9901502588ec4defba', () => saturnAfflictedMoon('oriental'), 1]],
  [54, ['2847d09a3287202aa3f070d53dc42799a19ad7e0b3016b04def9022d8a80875e', () => saturnAfflictedMoon('occidental'), 1]],
  [55, ['ee4e547313a74650407f13d54d8ded1820a66e0bb038d8b16692bfcfe1b5a0f6',
    () => tables.map(table => [aspect(table, 'moon', 'saturn', 'opposition')])]],
  [57, ['d9ac67d9f0b1e29cd4adef45167f6afbd3b4ffb2708a9918b717fa9da1e0de10', obliqueAscendantGroups, 1]],
  [58, ['c3d2f896d491199cde3121ac5d2f230590a31b4c826abef0795bb22a34dd5f03', longAscendantGroups, 1]],
  [59, ['7d5ffb2ecd77d08c509cf8421a5762f8479846ff128608a440c89883c998fa7a',
    () => tables.flatMap(table => ['jupiter', 'venus'].map(body => ({
      required: [], anyOf: ['conjunction', 'friendly'].map(type => [aspect(table, body, 'moon', type)]),
    }))), 1]],
  [60, ['2adee20b582a47b8835b9755be6849e5508eab709c39de8afa3bf76971cd9d93', () => historicalBirth('male')]],
  [61, ['062524dd2993a2bb854063ada91091aaf3afdcdca2827c8a4328b7f0e7f49a7a', () => historicalBirth('female')]],
  [62, ['53dad267b84246ea4c2dd109b1dd856b3db3d8dcdd3cdf575469d52207e4a50f',
    () => [{ required: [], anyOf: ['Saturn', 'Mars'].map(planet => [houseOf(planet, 12)]) }]]],
  [63, ['17c26593258057e8dac45adebc3ea3383e4abebdaf9ad67bcc662a2d2f9d6293', obliqueMoonGroups, 1]],
  [64, ['93860d61db7510663f96ffeb8b2b2fd98c8d21c82c52b66c013ae18ac763c2cf',
    () => [[{ kind: 'western_lilly_ruler_house', house: 10, placedIn: 8 }]]]],
]);
const reviewed = new Map([
  [8, ['b7181adec0ecba4fed542cf0fd549f6c8928386da072babc69efbe137778d6fc', motherGroups, 1]],
  [11, ['ebfb019b5f48a11a4d7d5d06094ecdb5a3fa36e1eed426592a52732eb7671003', () => sectGroups('father')]],
  [12, ['e2c2735fd4b1cc7d09639c75db9520b35086e580a6a70aa27fbb86e8011ec845', () => assessmentGroups('father_all_impeded'), 1]],
  [13, ['b5d9871384cab3f30f526a0bd0caf3a6d81f38fcaec14c4e564823606152ab7d', () => mixedGroups(true), 1]],
  [14, ['453d0fb59c0cffe5c041dd6963502b4ae61c37a4a0c0a33a88a169cc8774284d', () => assessmentGroups('fourth_benefics_supported'), 1]],
  [15, ['a2c33c95d91d5a8af98cf217e0dd103b41fefda74afbd9a80196a03889eea584',
    () => [[configuration('fourth_cadent_pressure')], ...assessmentGroups('fourth_dispositor_afflicted')], 1]],
  [16, ['4a66a054d2df801018fca0936a4ec0ac177e9c9379a8c112bc9d777415b16bb2', fatherDignity]],
  [17, ['3bcdca063ba1df7fc15eee89f5c3cce8213a38599731522a053029a85fb9635c', solarNorth, 1]],
  [18, ['254b9fed9fc9e0002ca22349179f89519d7dc6317b27055f816e52241cacf168', masculineConjunction]],
  [20, ['d58b2deca2e352c7c6ecab65c3d3ba27cf0f42bf3aa2e99dd6b0dba69c8f01b8', () => [{
    required: [configuration('sun_south_node_bestial')],
    anyOf: [3, 6, 9, 12].map(house => [houseOf('Sun', house)]),
  }], 1]],
  [21, ['ea222e4c4fa716ec328d787fe2318276ecccce45fcfd0371605eeb63765fce00', () => sectGroups('mother')]],
  [22, ['e7f1faddd4429ced9c7563150e0ed21ffe499ab0bd3848e5d9b09b133c7af11d',
    () => assessmentGroups('mother_severely_afflicted'), 1]],
  [23, ['d2e11c4ad9dacb250a8c4eeeeab9962307ab7c354fb9ae0ff838c321ebae377d',
    () => tables.flatMap(table => parents.map(parent => [strongerParent(parent, table)])), 1]],
  [24, ['fc7c33a450d1b89b90eea59fe1420eeb93e4d7ea55df481870092cd261f97511', () => sourceGroups('Jupiter'), 1]],
  [25, ['aae0ccb6ddc7dae239cff617ee36c8be4b83c2782068e6916e836caa84e0304b', () => sourceGroups('Venus'), 1]],
  [26, ['af0164ee4f494657a99dbd91398a0dc72a7cd0aa84e1f1652667f4ad04335b91', () => sourceGroups('Mars')]],
  [27, ['8404cbea2690397b985333a8dfc14f88375e6326f6e73e5ebf6afdf91db28583', () => sourceGroups('Saturn')]],
  [30, ['1b038c1b93ffe1b6c599d926a88a5666e9a035a5df4f38f7f7762938dd6e2253', estateGroups, 1]],
  [31, ['ab10baffb29bdacb07496850cb732038c112e96f0192f111e47188a1f54bda3a', () => assessmentGroups('day_estate_unrestrained', 'day'), 1]],
  [32, ['4d0688767c74aea3e1b2debc3723326a01eab593d517a1674b9b2055ae895956', () => assessmentGroups('night_estate_unrestrained', 'night'), 1]],
  [33, ['5c943de607f7cb767b556a5eb911c4268c31805cb8c643d17bcdd901510e89f6', estatePressureGroups, 1]],
  [34, ['67f9a27e21d0c9ecb4a361a53bc77b3e512713b9ca04e8871494773ccb74a5f2',
    () => [[configuration('estate_fifth_unfortunate')]], 1]],
  [35, ['404645d06994bcc807ae073b67f08b64362ed318ddfbee31085074d685250495', sunMarsEstate, 1]],
  [36, ['dcc97ca18ca9415992269df8e56ea4be060aa98a3912a0eec9c4d688cccdf88f',
    () => assessmentGroups('venus_approaching_combustion', 'day'), 1]],
  [37, ['ff9d5d3faba62979c249f06adeb71181310db61803b3a1538ef4fcd01758f478',
    () => assessmentGroups('venus_retrograde_separating', 'day'), 1]],
  [38, ['ff7f66ccb8b3386bc07e187fbb9d0a2c47653f9829e007f0f2c988aa11abd18a', () => disputedParent(10)]],
  [39, ['42870373517049bbf7dacb7d488ace035a55900f72c30b8668aa58728ea6e596', () => disputedParent(4)]],
  [46, ['f2a8f771d14eb3df928e2f6588a6ba475473ae20d13597374c35c53c04e59b43', motherGroups, 1]],
  [65, ['ef984f2e899aa541a5af66fa8968f427918f4e6920040633c3154aee3a7232b3', () => mixedGroups(false), 1]],
]);

export function compileLillyFamilySource(claim) {
  const id = /^astro-lilly-v3-family-p(\d{3})-001$/u.exec(claim.id);
  const number = Number(id?.[1]);
  const historical = historicalAphorisms.get(number);
  const spec = historical ?? reviewed.get(number);
  if (!spec) return undefined;
  const [expected, build, remainingAlternatives] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: '莉莉父母章的原文、条件或出处有变，须重新复核。' };
  const inputs = build().map(group => normalizeRuleInput('western', {
    required: [{ kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset },
      ...(historical ? [lillyFamilyAphorismFact] : []), ...(group.required ?? group)],
    anyOf: group.anyOf,
  }));
  const corrected = id[1] === '017' && {
    reviewedOriginalText: 'shew the Father to be of good Parents',
    revisedEvidence: true,
  };
  return { compiler: lillyFamilyProfile, inputs, ...(remainingAlternatives && { remainingAlternatives }),
    ...(historical && { matchScope: 'historical_aphorism' }), ...corrected };
}
