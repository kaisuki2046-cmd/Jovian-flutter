import { createHash } from 'node:crypto';
import { zodiacNames, westernStationaryHourlyLimit } from '../../control/charts.ts';
import { lillyCusps, lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { longitudeHouse } from '../../control/regiomontanus.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { classicalExaltationSigns } from './ptolemy-fortune.mjs';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';
import { isPtolemyTravelGovernanceFact, recordCardanoTravelPriority, travelDignityAssessment, travelGovernance } from './ptolemy-travel-governance.mjs';

export const ptolemyTravelProfile = 'ptolemy-iv-travel-witnesses-v1';
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const lights = ['Sun', 'Moon'];
const travelHouses = [3, 6, 7, 9, 12];
const bicorporeal = [2, 5, 8, 11];
const signAspects = new Map([[2, 'sextile'], [3, 'square'], [4, 'trine'], [6, 'opposition']]);
const wrap = longitude => (longitude + 360) % 360;
const selected = witness => ({ kind: 'western_ptolemy_travel_selector', witness });
const relation = (first, second, aspect) => ({ kind: 'western_ptolemy_travel_aspect', first, second, aspect });
const following = (planet, body) => ({ kind: 'western_ptolemy_travel_following', planet, body });
const rulerProof = (body, planet) => ({ kind: 'western_ptolemy_travel_ruler', body, planet });
const closeToFortune = (body, distance) => ({ kind: 'western_ptolemy_travel_fortune_contact', body, distance });
const cardanoMars = (light, aspect) => 'cardano_mars_' + light.toLowerCase() + '_' + aspect;
const cardanoLot = (planet, house) => 'cardano_lot_' + planet.toLowerCase() + '_' + house;
const byLight = ['north', 'south', 'ascending', 'descending'].map(direction =>
  ['Moon', 'Mars'].map(planet => 'cardano_' + planet.toLowerCase() + '_' + direction));

const reviewed = new Map([
  [1, ['3eb9c0b5f4ef9b4d38095fd344fd2254e3affe509009e72b39ec869d5f235360', 'robbins_moon_setting', 'robbins_moon_declining']],
  [2, ['37350f43fb6fd00ffbfb5a55669e711e16f45b3a9953c3deb56f17cd5829ce37', 'robbins_benefic_aspect', 'robbins_benefic_following']],
  [3, ['983ec930428f6d60815dbd8a5f055a1c7d515001c8f9f1c82f28eee8bc960305', 'robbins_mars_setting', 'robbins_mars_declining']],
  [4, ['846e5c46a199bbf469471362f95203c8635de090b6ce9f2d7be9e4e0d9da1eaa', 'robbins_fortune']],
  [5, ['dce7e9b8d4e277fae54714348aae2e634f2925fa04028089d8e8e21408221c4c', 'robbins_malefic_aspect']],
  [6, ['aefd1963c05c4eaee7a1fa0ca99a5834292f886ac57ad023bc543aa400855ee0', 'robbins_single_sign', 'robbins_single_ruler']],
  [7, ['9bebd227e65f4b71d3b560fef9c6ae09f6d2f649ebc5598360e397d356ac77cc', 'robbins_bicorporeal']],
  [8, ['11197a2c7fbe1f2fa00694d74e879d104d6b5914745ec5735f246b85f1ef7f38', 'robbins_jupiter_venus']],
  [10, ['f7ae46c771e4050e6c50c3e49235bf2e773251efdde99eb5b32905d55d6574ae', 'robbins_eastern_lower']],
  [11, ['b94b67da87f86e597093cb79cee86e325dfbbaa6e0ebe3ed9acf800d063d544e', 'robbins_western']],
  [12, ['6d2efb4670f6a74f98749829ef2511d3717dd8fe5ccf2cdaab8568acd5cd54fa', 'robbins_saturn_mars_watery']],
  [13, ['367d983cdd03e01aacb13c5eeef86d962dc7707cb4036d6d550e742925287d53', 'robbins_saturn_mars_solid']],
  [14, ['1e4770c54f78615ef70a1c8ba87d558d50338840fc06eb2953e77299c55dc679', 'robbins_saturn_mars_solstitial_or_equinoxial']],
  [15, ['f6d5df7edefee9b2a332afad795b475db95f676b038c5bdc0b983beec295d44d', 'robbins_saturn_mars_human_form']],
  [16, ['a45a12c3ec5feb20da06741ac2511e6ce1d95eec1878fc882e9571d32436b672', 'robbins_saturn_mars_terrestrial']],
  [17, ['afbcc1d8368b9b716eae1635b600658e825f1af1c33e114b0daa644a1c7e2171', 'robbins_mercury_with_benefics']],
  [18, ['8e79eaabf56797009ac7417feec16d6119d3c3bcf76cd7495acd8ed4ec532754', 'robbins_saturn_mars_opposed']],
  [19, ['d1994ca382b12ff261c6f160ca6261ef44ee989c26714416f95e38358410e539', 'robbins_mercury_with_malefics']],
  [20, ['84f4012410e26e721427b613aefa3a70ce8f2799dbcfecb86940421fcd97d3ad', 'robbins_action_connection']],
  [21, ['39889979f8f85a2a609dd971d44129e0e5bfc3446993cbce2d87cc4eba2eef0b', 'robbins_property_connection']],
  [22, ['c0b0889cfbdf15d31aab78a63e2d7f0036f70e430e109380522c4c9175b79f26', 'robbins_body_connection']],
  [23, ['ba344274dd1cab6a524c4c13ef2d52ccad8dda5e4a4b6f79515bab2bf3a74054', 'robbins_dignity_connection']],
  [24, ['328d26106e18d2bcd0a820afa2b2e61cef05c370cc9477d2c7eeed1a15d6d248', 'robbins_mixed_dominance']],
  [25, ['07a87099d23a2fcd76dd58956869136b3e55e5d74fd501459db7b4cf1c26b567', 'robbins_benefic_dominance']],
  [26, ['1f41df228c2f3ab21a10f3a749360735a32614323ee74dbf72197c5db07065bd', 'robbins_malefic_dominance']],
  [28, ['1128170b86d25dea63a4fbbb4f65b07e72294be8e9b6d1458597fbd35b6fff67',
    ...lights.flatMap(light => ['square', 'opposition'].map(aspect => cardanoMars(light, aspect)))]],
  [29, ['59baddd1f8338163c887a029220e0066dd211093520c0bb5e51c3ddb633fe89a', 'cardano_moon_well_placed', 'cardano_mars_well_placed']],
  [30, ['1d78043730aa26e31f9a9bf4eb75e65e9e5474295f72a1d5038d013dcf9fdc70', 'cardano_sun_twelfth', 'cardano_moon_twelfth']],
  [31, ['933dfd7a6a3340107575a13be8fa72469c27e83ba5c98d675587ed4a04361f88',
    ...[7, 9].flatMap(house => ['Moon', 'Mars'].map(planet => cardanoLot(planet, house)))]],
  [32, ['58b467f80c583fc5864110f1471eb6940f8ac3aaf86a69677429c24929c6b077', 'cardano_following']],
  [33, ['b0337453c60e34eeaf559bed2e0f7929898f26b8c771c844ccfa4131eff86fa3', ...byLight[0]]],
  [34, ['0c349cd5101403a429f17617aedfb8b27b25a0178db3fe156b9215f5a6bb33a5', ...byLight[1]]],
  [35, ['48e9e99ed917f8c22a410da17d64a7bc4223a76e38c14fbd565b04be9e9342f6', ...byLight[2]]],
  [36, ['96d734a4fd8f31dda1e8500bbbcf8b0009a8d576e43d3e96ea51404631ae58a0', ...byLight[3]]],
  [48, ['542084321c2483f75389bcae4062b9b7aa7c64b480cd7f4081b04a33b6dccf58', 'cardano_priority_aspect']],
  [49, ['771b964c151a90b8d8ad804e3c0f62cebd00312f1e5ee9afafefdcffe206cb44', 'cardano_priority_dignity']],
  [52, ['da7af52f6ef2d79d28e5dadfae920de18120d162ffc858ce03b5d6d90cd09574', 'robbins_saturn_mars']],
]);
const witnesses = new Set([...reviewed.values()].flatMap(([, ...selectors]) => selectors));
const governance = new Set([8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 49, 52]);
const travelNumber = id => Number(/^astro-ptolemy-v4-travel-p(\d{3})-001$/u.exec(id)?.[1]);
export const ptolemyTravelRequiresDignities = id => governance.has(travelNumber(id));

export function isPtolemyTravelFact(fact) {
  if (fact.kind === 'western_ptolemy_travel_selector') return witnesses.has(fact.witness);
  if (fact.kind === 'western_ptolemy_travel_aspect') return bodies.includes(fact.first) && fact.first !== fact.second
    && [...bodies, 'fortune', 'mc', 'ascendant'].includes(fact.second) && ([...signAspects.values()].includes(fact.aspect)
      || (fact.aspect === 'conjunction' && fact.first === 'Mercury' && ['Jupiter', 'Venus', 'Saturn', 'Mars'].includes(fact.second)));
  if (fact.kind === 'western_ptolemy_travel_following' || fact.kind === 'western_ptolemy_travel_ruler') {
    return bodies.includes(fact.planet) && [...bodies, 'fortune'].includes(fact.body);
  }
  return isPtolemyTravelGovernanceFact(fact) || (fact.kind === 'western_ptolemy_travel_fortune_contact' && ['Moon', 'Mars'].includes(fact.body)
    && Number.isFinite(fact.distance) && fact.distance >= 0 && fact.distance <= 3);
}

export function compilePtolemyTravel(claim) {
  const number = travelNumber(claim.id);
  const row = reviewed.get(number);
  if (!row) return undefined;
  const [hash, ...selectors] = row;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== hash) return { reason: 'source_review_required', reviewNote: '《四书》远行条文、出处或条件有变，须重新复核。' };
  const inputs = selectors.map(witness => normalizeRuleInput('western', { required: [selected(witness), { kind: 'western_zodiac', zodiac: 'tropical' }] }));
  return { compiler: ptolemyTravelProfile, inputs, matchScope: 'historical_aphorism',
    ...((governance.has(number) || [2, 6, 10, 11, 29, 31, 35, 36, 48].includes(number)) && { remainingAlternatives: 1 }) };
}

function singleValue(facts, kind, planet, field) {
  const found = new Set(facts.filter(fact => fact.kind === kind && fact.planet === planet)
    .map(fact => fact[field]));
  return found.size === 1 ? [...found][0] : null;
}

function aspectBetween(a, b) {
  const offset = Math.abs(a.sign - b.sign);
  return signAspects.get(Math.min(offset, 12 - offset));
}

const signProof = ({ body, sign }) => ({ kind: 'planet_sign', planet: body, sign: zodiacNames[sign] });
const houseProof = ({ body, house }) => ({ kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: body, house });
const bodyProof = position => [signProof(position), houseProof(position)];
const lotProof = longitude => ({ kind: 'western_ptolemy_fortune_point', longitude });

function readPositions(facts) {
  const geo = facts.some(fact => fact.kind === 'western_profile_system' && fact.profile === 'regiomontanus');
  const nativeHouses = facts.filter(fact => fact.kind === 'western_profile_planet_house' && fact.profile === 'regiomontanus');
  return new Map(bodies.flatMap(body => {
    const position = lillyPlanetPosition(facts, body);
    if (!position) return [];
    const house = geo ? singleValue(nativeHouses, 'western_profile_planet_house', body, 'house') : null;
    return [[body, { ...position, body, house: Number.isInteger(house) && house >= 1 && house <= 12 ? house : null }]];
  }));
}

function moonAndMars(positions) {
  const moon = positions.get('Moon'), mars = positions.get('Mars');
  const hard = mars ? lights.flatMap(body => {
    const light = positions.get(body);
    const aspect = light && aspectBetween(mars, light);
    return ['square', 'opposition'].includes(aspect) ? [relation('Mars', body, aspect), signProof(light)] : [];
  }) : [];
  return { moon, mars, hard };
}

function roadWitnesses(positions, places, record, cardano = false) {
  for (const { position, proof } of places) {
    for (const [planet, candidate] of positions) {
      if (planet === position.body) continue;
      const successor = (candidate.sign - position.sign + 12) % 12 === 1;
      if (cardano) {
        if (successor) record('cardano_following', ...proof, following(planet, position.body), signProof(candidate));
        continue;
      }
      const aspect = aspectBetween(candidate, position);
      const benefic = ['Jupiter', 'Venus'].includes(planet);
      if (benefic && successor) record('robbins_benefic_following', ...proof, following(planet, position.body), signProof(candidate));
      if (aspect && (benefic || ['Saturn', 'Mars'].includes(planet))) {
        record(benefic ? 'robbins_benefic_aspect' : 'robbins_malefic_aspect',
          ...proof, relation(planet, position.body, aspect), signProof(candidate));
      }
    }
    if (cardano) continue;
    record(bicorporeal.includes(position.sign) ? 'robbins_bicorporeal' : 'robbins_single_sign', ...proof);
    const ruler = lillyDomicileRuler(position.sign * 30);
    const rulerPosition = positions.get(ruler);
    if (rulerPosition && !bicorporeal.includes(rulerPosition.sign)) {
      record('robbins_single_ruler', ...proof, rulerProof(position.body, ruler), signProof(rulerPosition));
    }
  }
}

function robbinsTravel(positions, { moon, mars, hard, cusps, lot }, record) {
  const active = [];
  if (travelHouses.includes(moon?.house)) {
    const proof = bodyProof(moon);
    record(moon.house === 7 ? 'robbins_moon_setting' : 'robbins_moon_declining', ...proof);
    active.push({ position: moon, proof });
  }
  if ([7, 9].includes(mars?.house) && hard.length) {
    const proof = [...bodyProof(mars), ...hard];
    record(mars.house === 7 ? 'robbins_mars_setting' : 'robbins_mars_declining', ...proof);
    active.push({ position: mars, proof });
  }
  if (!active.length) return active;
  const cause = active.flatMap(({ proof }) => proof);
  if (Number.isFinite(lot) && cusps) {
    const sign = Math.floor(lot / 30);
    const corresponding = travelHouses.filter(house => Math.floor(cusps[house - 1] / 30) === sign);
    if (corresponding.length) {
      const proof = [...cause, lotProof(lot), ...corresponding.map(house =>
        ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house, longitude: cusps[house - 1] }))];
      record('robbins_fortune', ...proof);
      active.push({ position: { body: 'fortune', sign, longitude: lot }, proof });
    }
  }
  const lightPositions = lights.map(body => positions.get(body));
  for (const [witness, houses] of [['robbins_eastern_lower', [4, 5, 6]], ['robbins_western', [1, 2, 3, 7, 8, 9]]]) {
    if (lightPositions.every(position => houses.includes(position?.house))) {
      record(witness, ...cause, ...lightPositions.flatMap(bodyProof));
    }
  }
  roadWitnesses(positions, active, record);
  return active;
}

function recordCardanoLatitude(facts, position, proof, record) {
  const planet = position.body, name = 'cardano_' + planet.toLowerCase() + '_';
  if (!['Moon', 'Mars'].includes(planet)) return;
  const latitude = singleValue(facts, 'western_geometry_planet_latitude', planet, 'latitude');
  if (!Number.isFinite(latitude) || Math.abs(latitude) >= 90) return;
  const measured = { kind: 'western_geometry_planet_latitude', planet, latitude };
  if (Math.abs(latitude) > 1e-10) record(name + (latitude > 0 ? 'north' : 'south'), ...proof, measured);
  const signedDegrees = singleValue(facts, 'western_geometry_planet_latitude_motion', planet, 'signedDegrees');
  if (Number.isFinite(signedDegrees) && Math.abs(signedDegrees) > westernStationaryHourlyLimit && Math.abs(signedDegrees) <= 1) {
    record(name + (signedDegrees > 0 ? 'ascending' : 'descending'), ...proof, measured,
      { kind: 'western_geometry_planet_latitude_motion', planet, signedDegrees });
  }
}

function cardanoTravel(facts, positions, { moon, mars, hard, cusps, lot }, record) {
  const active = [];
  const fortuneProof = [];
  for (const position of [positions.get('Sun'), moon, mars]) {
    if (!position) continue;
    const { body, house, sign, longitude } = position, name = 'cardano_' + body.toLowerCase();
    if (body === 'Mars' ? ![3, 7, 9].includes(house) || !hard.length : ![3, 7, 9, 12].includes(house)) continue;
    const proof = [...bodyProof(position), ...(body === 'Mars' ? hard : [])];
    active.push({ position, proof });
    if (house === 12) record(name + '_twelfth', ...proof);
    if (body === 'Mars' && house === 9) {
      for (const fact of hard.filter(fact => fact.kind === 'western_ptolemy_travel_aspect')) {
        record(cardanoMars(fact.second, fact.aspect), ...bodyProof(position), fact, signProof(positions.get(fact.second)));
      }
    }
    if (body !== 'Sun' && house === 7) {
      const dignity = lillyDomicileRuler(sign * 30) === body ? 'domicile'
        : classicalExaltationSigns[body] === sign ? 'exaltation' : null;
      if (dignity) record(name + '_well_placed', ...proof, { kind: 'western_ptolemy_fortune_affinity', planet: body, dignity });
    }
    if (body !== 'Sun' && [7, 9].includes(house) && Number.isFinite(lot) && Number.isFinite(longitude)
      && cusps && longitudeHouse(lot, cusps) === house) {
      const gap = Math.abs(longitude - lot), distance = Math.min(gap, 360 - gap);
      if (distance <= 3) {
        const witnesses = [...proof, lotProof(lot), closeToFortune(body, distance), { kind: 'planet_longitude', planet: body, longitude }];
        record(cardanoLot(body, house), ...witnesses);
        fortuneProof.push(...witnesses);
      }
    }
    recordCardanoLatitude(facts, position, proof, record);
  }
  roadWitnesses(positions, active, record, true);
  return fortuneProof.length ? [...active, { position: { body: 'fortune', sign: Math.floor(lot / 30), longitude: lot }, proof: fortuneProof }] : active;
}

function travelEvidence(facts, dignitiesAt) {
  const evidence = new Map();
  const zodiac = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiac.size !== 1 || !zodiac.has('tropical')) return evidence;
  const positions = readPositions(facts);
  const sun = positions.get('Sun')?.longitude, moon = positions.get('Moon')?.longitude;
  const asc = easternOrCulminatingLongitude(facts, 'ascendant');
  const lot = [sun, moon, asc].every(Number.isFinite) ? wrap(asc + moon - sun) : null;
  const data = { ...moonAndMars(positions), cusps: lillyCusps(facts), lot };
  const record = (witness, ...proof) => {
    if (!evidence.has(witness)) evidence.set(witness, []);
    evidence.get(witness).push(...proof);
  };
  const robbins = robbinsTravel(positions, data, record);
  const cardano = cardanoTravel(facts, positions, data, record);
  const assessment = robbins.length || cardano.length ? travelDignityAssessment(facts, positions, dignitiesAt, aspectBetween) : null;
  if (robbins.length && assessment) travelGovernance(facts, positions, robbins, assessment, aspectBetween, record);
  if (cardano.length) recordCardanoTravelPriority(positions, cardano, assessment, aspectBetween, record);
  return evidence;
}

export function ptolemyTravelFacts(facts, dignitiesAt) {
  return [...travelEvidence(facts, dignitiesAt).keys()].map(selected);
}

export function ptolemyTravelProof(conditions, facts, dignitiesAt) {
  const evidence = travelEvidence(facts, dignitiesAt);
  const proof = [conditions.required, ...conditions.alternatives].flat()
    .filter(fact => fact.kind === 'western_ptolemy_travel_selector').flatMap(({ witness }) => evidence.get(witness) ?? []);
  return { ...conditions, required: [...new Map([...conditions.required, ...proof].map(fact => [JSON.stringify(fact), fact])).values()] };
}
