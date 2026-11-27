import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';

export const lillyTravelProfile = 'lilly-1647-travel-testimonies-v1';
const sourcePrefix = 'astro-lilly-v3-travel-';
const reviewed = new Map([
  ['p003', '0212fac8cf4c012846582fb7bca85d9f45cf41a0286cc9877a73abec63859091'],
  ['p004', '673bee4799c9d6d02c424dd821ca9878c877724a56cb55d2f6f7f6ab87a2ed2f'],
  ['followup-p003', '4eea23f2688225a3016f29375dde17aaafec7df784f111673c54b34ec7927d9f'],
  ['followup-p004', '6c3415b6a5afd1ac65f1e31e38fd237781019d33bb0be4dbbf31deebfa5e6822'],
  ['followup-p005', '5478a9414a859a1c7f32e1915f01ad9de32c4cfc4b097e6cf0d070698269b77c'],
  ['p005', '524747b25ae0ef62b520c0df4d5844864ccacbc764e95dc24f5afd311f83af84'],
  ['p006', '592266a659414c038a1df14abc9d490a5dfa221b7d57cf34eef19886130f3ea0'],
  ['followup-p007', 'ba5e94e5fbd4f60a62d6ba577ea056ce540ce3e645b47943fc9f0c7d51859f65'],
  ['followup-p008', '271dc349f7c5ded3df5e54d274b9bc86b45ef8bb7fd4cf3bf5d286086180f184'],
  ['followup-p009', 'c1aa9008003c07e56d31baaae4324e447b7039593d11864d176fb158c01d77a1'],
  ['followup-p010', 'a5a1f8a45c8a5a905720c0c03abff198a86c7c83243199a1c6a4378352af3aec'],
  ['followup-p011', 'ca6d740306ea600a280f8552ab30542ea050b6349223c11a88900122d323e677'],
  ['followup-p012', '140c3e440106f10d80f53244c331c698f0b84a530c1ab3da14865a534980f49f'],
  ['followup-p013', 'c0dffd8b30bf507ecd52fd1ce9a0d989fb5519a976f1b27d6eff9166bf2fc441'],
  ['followup-p014', 'aec1272037ad2ec47b61fe2a5d74c1362bc9744e633fc13bb61f384499177d78'],
  ['followup-p015', '6284b28ad03526a51dbd650e730748f4c193f891aa06d9dd00629fc05ed0534a'],
  ['followup-p016', 'eebf820140ec675b101faa8c0a86090c41d9a4d9262a886017b0f8a2041a0e2d'],
  ['followup-p017', '3a7743fcb7be19b9101d13f16c1715737101c2f176e9b9c4b8a9cd3a47d8190b'],
  ['followup-p018', 'c73c67b514851177e4f04477b9d4d1748a4c74c3ce50e83251a8fdce65a09b35'],
  ['followup-p019', 'be740ab748ea5287b0d5f2ca7ee06a3a797cebd2dad9c5b0b1e609cef7d12059'],
  ['followup-p020', '61e79ff3f916a7129c45c9ffde94f03957551eee9e14fd5f33f69f55903d39fa'],
  ['followup-p027', '0888d9af734eac16cc0fab9ce30651260556358e0b47dffa086bcf0bed5d63de'],
  ['followup-p028', '1a82e14a0c9e74fcc3beaddd19178eda5a94941779aa85570a3560d54df82b8c'],
  ['followup-p029', '172ed22dc5a35d2a78724f2750bb43c3a5fce9561804552ca7290dcc5dcc1237'],
  ['followup-p030', '727c65897caa761b10b693d10c535ed93a25df7ae43b2b8739681e06b8ec68d0'],
  ['followup-p031', '1d38070c8c852de7854fea91c126708caf4531a6a8ca7483cf025ac472970c48'],
  ['followup-p032', 'b50560f764bf13e39ff73efdefe1d4a74eca183f0f35caaf7cda4a862546f4e6'],
  ['followup-p033', 'cc5fc81bf603d8c93de629bb648c345ae8a1d28d317796741b195155a4c9102e'],
  ['followup-p036', 'c6d2b63287ec96041054e42950e18be47d391632d3b537866007af6ceffe90f6'],
  ['followup-p037', '427059faf5ec34e40cb9ef9f1e884c7da659da4ddaf91dff7c1ecbadd2df9f1b'],
  ['followup-p038', '741fdeb1bb4aba3e6098ecf91872cf44a0fb173376f534d8b596f863119cb200'],
  ['followup-p039', '25344c1233cda5ed8c05969ac4d8f94f9482ed1716dd304d3eaa4a2e70b50e00'],
  ['p019', '793c3c46ee579f26b1f68e42083dcc5c02004e0c9167a5d217e368c9e2bedbbb'],
  ['p020', '8920676575e7e24e36bfb3c3ba80d2d3e7405273d977e08a3abc4fa9d4367637'],
  ['followup-p048', 'dae72c8d225d358e5605d466ab8557ae7898b0128aefd0240332ec7a7a47602b'],
  ['followup-p050', '37bf8530a01c64ce38f2ebfdc0f40a31952cd013b4cd5976efce816d8b649882'],
  ['followup-p052', '47b2247efc0357edd79eab8c2628aa1323dbb6641588811c8ddc6c0ead5c72af'],
]);

const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const modeNames = ['movable', 'fixed', 'common'];
const elementNames = ['fire', 'earth', 'air', 'water'];
const directionBodies = ['sun', 'saturn', 'venus', 'jupiter', 'moon', 'mars'];
const journeyHouses = [1, 3, 9];
const easternHouses = [10, 11, 12, 1, 2, 3];
const quadrupedal = [0, 1, 4, 8, 9], human = [2, 5, 6, 10];
const dignities = ['domicile', 'exaltation', 'triplicity', 'term', 'face'];
const malefics = ['Mars', 'Saturn'];
const obstructionHouses = [3, 12];
const difficultySignClasses = {
  moist: [2, 3, 6, 7, 10, 11], // Book III p.533 describes both air and water as moist.
  fixed_except_scorpio: [1, 4, 10],
  movable: [0, 3, 6, 9],
  human,
  bestial: quadrupedal,
};

export const lillyTravelSelectors = new Set([
  'established', 'moon_or_mercury_conj_or_received_by_ruler_1_or_9', 'moon_mercury_in_or_dignified_in_house_1_3_9',
  ...['movable', 'fixed'].map(mode => 'relevant_significators_sign_mode.' + mode),
  ...directionBodies.map(planet => 'active_significators.' + planet),
  ...elementNames.map(element => 'direction_significator_elements.' + element),
  ...['fire_or_earth', 'water_or_air', 'quadrupedal', 'human'].map(branch => 'transport_branches.' + branch),
  'motives.significator_in_house_1', 'motives.significator_in_house_2',
  'motives.saturn.signifies', 'motives.saturn.conjoins_a_significator',
  'motives.saturn.has_essential_dignity_at_a_significator', 'motives.jupiter.applies',
  'abenrodan', 'direction.both_luminaries_abenrodan_quarter.east', 'direction.both_luminaries_abenrodan_quarter.west',
  'malefic_aspect', 'significators_in_malefic_domiciles',
  'obstruction.travel_significator_selected', 'obstruction.saturn_or_mars_selected',
  'obstruction.afflicts_travel_significator', 'obstruction.lords_travel_significator_place',
  ...malefics.map(planet => `active_obstructing_malefic.${planet.toLowerCase()}`),
  ...obstructionHouses.map(house => `obstructing_malefic_house.${house}`),
  ...Object.keys(difficultySignClasses).map(group => `difficulty_sign_classes.${group}`),
]);

const sourceKey = id => typeof id === 'string' && id.startsWith(sourcePrefix) && id.endsWith('-001')
  ? id.slice(sourcePrefix.length, -4) : '';
export const isLillyTravelSource = claim => reviewed.has(sourceKey(claim.id));

export function lillyTravelSourceMatches(claim) {
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  return reviewed.get(sourceKey(claim.id)) === digest;
}

const travelFact = (table, selector) => ({ kind: 'western_lilly_travel', table, selector });

export function lillyTravelCondition(fact, equals, table) {
  if (fact === 'context.lilly_travel_direction_method' && equals === 'abenrodan_as_quoted_by_lilly') {
    return travelFact(table, 'abenrodan');
  }
  const prefix = 'profiles.lilly.travel.';
  if (!fact.startsWith(prefix)) return null;
  const field = fact.slice(prefix.length);
  const selector = equals === true ? field : field + '.' + equals;
  return lillyTravelSelectors.has(selector) ? travelFact(table, selector) : null;
}

function planetaryPositions(facts) {
  const positions = new Map();
  for (const planet of lillyDignityBodies) {
    const evidence = facts.filter(fact => fact.planet === planet);
    const degrees = new Set(evidence.filter(fact => fact.kind === 'planet_longitude').map(fact => fact.longitude));
    const labels = new Set(evidence.filter(fact => fact.kind === 'planet_sign').map(fact => fact.sign));
    const [degree] = degrees;
    if (degrees.size !== 1 || !Number.isFinite(degree) || degree < 0 || degree >= 360) continue;
    if (labels.size > 1 || labels.size === 1 && !labels.has(zodiacNames[Math.floor(degree / 30)])) continue;
    positions.set(planet, degree);
  }
  return positions;
}

function travelObstructionSelectors(active, positions, houseOf, table) {
  const selectors = new Set();
  // Book III p.610. The house belongs to the obstructing body; the sign
  // classes are evaluated on the travel significator it affects.
  for (const significator of active) {
    const longitude = positions.get(significator);
    const sign = Math.floor(longitude / 30);
    for (const planet of malefics) {
      if (planet === significator) continue;
      const aspect = name => lillyAspect(positions.get(planet), longitude, planet.toLowerCase(), significator.toLowerCase(), name, table);
      if (aspect('any') === true) selectors.add('malefic_aspect');
      const governs = lillyDomicileRuler(longitude) === planet;
      if (governs) selectors.add('significators_in_malefic_domiciles');
      const afflicts = ['conjunction', 'square', 'opposition'].some(aspect);
      if (!governs && !afflicts) continue;
      selectors.add('obstruction.travel_significator_selected');
      selectors.add('obstruction.saturn_or_mars_selected');
      if (governs) selectors.add('obstruction.lords_travel_significator_place');
      if (afflicts) selectors.add('obstruction.afflicts_travel_significator');
      selectors.add(`active_obstructing_malefic.${planet.toLowerCase()}`);
      const house = houseOf.get(planet);
      if (obstructionHouses.includes(house)) selectors.add(`obstructing_malefic_house.${house}`);
      for (const [classification, signs] of Object.entries(difficultySignClasses)) {
        if (signs.includes(sign)) selectors.add(`difficulty_sign_classes.${classification}`);
      }
    }
  }
  return selectors;
}

export function lillyTravelFacts(chart, houses, cellsAt) {
  const cusps = lillyCusps(chart);
  const zodiacs = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (!cusps || zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = planetaryPositions(chart);
  const houseOf = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house' && positions.has(fact.planet))
    .map(fact => [fact.planet, fact.house]));
  const lord = house => houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === house)?.planet;
  const sect = new Set(chart.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const sects = sect.size === 1 ? [...sect] : ['day', 'night'];
  const matchingCells = new Map();
  const dignitiesAt = longitude => {
    if (!Number.isFinite(longitude) || !cellsAt) return null;
    const sign = Math.floor(longitude / 30), degree = Math.floor(longitude % 30), key = sign * 30 + degree;
    if (!matchingCells.has(key)) matchingCells.set(key, cellsAt(signs[sign], degree) ?? []);
    return matchingCells.get(key);
  };
  const hasDignity = (planet, longitude) => {
    const cells = dignitiesAt(longitude);
    if (sect.size > 1 || !cells?.length) return null;
    const outcomes = sects.map(value => cells.some(cell => cell.body === planet.toLowerCase()
      && dignities.includes(cell.dimension) && (cell.sect === 'both' || cell.sect === value)));
    return outcomes.every(value => value === outcomes[0]) ? outcomes[0] : null;
  };
  const receives = (receiver, guest) => receiver !== guest && hasDignity(receiver, positions.get(guest)) === true;
  const occupants = [...houseOf].filter(([, house]) => house === 9).map(([planet]) => planet);
  const first = lord(1), ninth = lord(9);
  if (!first || !ninth) return [];
  const domiciledIn = (guest, ...hosts) => positions.has(guest) && hosts.includes(lillyDomicileRuler(positions.get(guest)));
  const subjects = ['Moon', 'Mercury'];

  // Book III pp.606–607. Every qualifying testimony retains the exact
  // body or bodies it used. Both of Lilly's orb columns run independently.
  return Object.keys(lillyOrbTables).flatMap(table => {
    const active = new Set(), result = [];
    const emit = selector => result.push(travelFact(table, selector));
    const conj = (a, b) => lillyAspect(positions.get(a), positions.get(b), a.toLowerCase(), b.toLowerCase(), 'conjunction', table);
    const contribute = (...planets) => planets.filter(planet => positions.has(planet)).forEach(planet => active.add(planet));

    if (houseOf.get(ninth) === 1) contribute(ninth);
    if (houseOf.get(first) === 9) contribute(first);
    if (conj(first, ninth)) contribute(first, ninth);
    if (conj('Moon', 'Mercury') || receives('Moon', 'Mercury') && receives('Mercury', 'Moon')
      || domiciledIn('Moon', 'Mercury') || domiciledIn('Mercury', 'Moon')) contribute(...subjects);
    let rulerContact = false, houseContact = false;
    for (const subject of subjects) {
      for (const ruler of new Set([first, ninth])) {
        if (!conj(subject, ruler) && !receives(ruler, subject)) continue;
        rulerContact = true;
        contribute(subject, ruler);
      }
      if (journeyHouses.includes(houseOf.get(subject))
        || positions.has(subject) && journeyHouses.some(house => hasDignity(subject, cusps[house - 1]) === true)) {
        houseContact = true;
        contribute(subject);
      }
      if (conj('Sun', subject) || receives(subject, 'Sun') || domiciledIn('Sun', subject)) contribute('Sun', subject);
    }
    if (rulerContact) emit('moon_or_mercury_conj_or_received_by_ruler_1_or_9');
    if (houseContact) emit('moon_mercury_in_or_dignified_in_house_1_3_9');
    if (!active.size || positions.size !== lillyDignityBodies.length) return result;

    // Include the ninth lord and its confirmed occupants, as specified on
    // p.606, after at least one positive travel testimony. Count each body once.
    contribute(ninth, ...occupants);
    emit('established');
    const memberSigns = [...active].map(planet => Math.floor(positions.get(planet) / 30));
    const elements = memberSigns.map(sign => elementNames[sign % 4]);
    modeNames.slice(0, 2).filter((_, index) => memberSigns.every(sign => sign % 3 === index))
      .forEach(mode => emit('relevant_significators_sign_mode.' + mode));
    for (const planet of directionBodies) {
      if (active.has(lillyDignityBodies.find(body => body.toLowerCase() === planet))) emit('active_significators.' + planet);
    }
    const mercuryContact = conj('Mercury', 'Sun') || conj('Mercury', 'Moon');
    const mercuryEligible = !mercuryContact || hasDignity('Mercury', positions.get('Mercury')) === true;
    for (const planet of active) {
      if (planet !== 'Mercury' || mercuryEligible) {
        const element = elementNames[Math.floor(positions.get(planet) / 30) % 4];
        emit('direction_significator_elements.' + element);
      }
    }
    const fireEarth = elements.filter(element => element === 'fire' || element === 'earth').length;
    if (fireEarth * 2 > elements.length) emit('transport_branches.fire_or_earth');
    if (fireEarth * 2 < elements.length) emit('transport_branches.water_or_air');
    if (memberSigns.every(sign => quadrupedal.includes(sign))) emit('transport_branches.quadrupedal');
    if (memberSigns.every(sign => human.includes(sign))) emit('transport_branches.human');

    const memberHouses = [...active].map(planet => houseOf.get(planet));
    for (const house of [1, 2]) if (memberHouses.includes(house)) emit('motives.significator_in_house_' + house);
    if (active.has('Saturn')) emit('motives.saturn.signifies');
    if ([...active].some(planet => conj('Saturn', planet))) emit('motives.saturn.conjoins_a_significator');
    if ([...active].some(planet => receives('Saturn', planet))) emit('motives.saturn.has_essential_dignity_at_a_significator');
    if (active.has('Jupiter') || [...active].some(planet => conj('Jupiter', planet) || receives('Jupiter', planet))) emit('motives.jupiter.applies');

    for (const selector of travelObstructionSelectors(active, positions, houseOf, table)) emit(selector);

    const luminaries = ['Sun', 'Moon'].map(planet => houseOf.get(planet));
    if (luminaries.every(house => easternHouses.includes(house))) {
      emit('abenrodan');
      emit('direction.both_luminaries_abenrodan_quarter.east');
    } else if (luminaries.every(house => !easternHouses.includes(house))) {
      emit('abenrodan');
      emit('direction.both_luminaries_abenrodan_quarter.west');
    }
    return result;
  });
}
