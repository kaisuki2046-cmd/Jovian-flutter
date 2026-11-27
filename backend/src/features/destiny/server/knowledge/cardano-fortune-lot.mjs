import { lillyCusps, lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { longitudeHouse } from '../../control/regiomontanus.mjs';
import { zodiacNames } from '../../control/charts.ts';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { classicalExaltationSigns } from './ptolemy-fortune.mjs';
import { ptolemyLunarRay } from './ptolemy-fortune-angles.mjs';

const angularHouses = [1, 4, 7, 10];
const wanderingPlanets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const inheritancePlaces = new Map([[11, 'inheritance_eleventh'], [9, 'inheritance_ninth'], [8, 'inheritance_eighth']]);
const signRays = new Map([[2, 'sextile'], [3, 'square'], [4, 'trine'], [6, 'opposition']]);
const cases = [
  'angular_house', 'above_eleventh', 'above_ninth', 'ruler_oriental', 'ruler_angle_center', 'ruler_own_dignity',
  'ruler_with_sun', 'ruler_with_moon', 'strong_lot_under_sun', 'lot_with_moon_sun_rising', 'strong_lot_moon_trine', 'strong_lot_moon_sextile',
  'ruler_angle_and_dignity', 'case_jupiter_second', 'case_lot_venus_mercury_angular',
  ...inheritancePlaces.values(),
];
const normalize = longitude => (longitude + 360) % 360;
export const cardanoArcDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
export const cardanoConjunctionLimit = 3;
export const cardanoAngleLimit = 1;
export const cardanoCoordinate = (body, longitude) => ({ kind: 'western_cardano_fortune_longitude', body, longitude });
export function cardanoLotCondition(witness) {
  return { kind: 'western_cardano_fortune_lot_condition', witness };
}
const houseProof = house => ({ kind: 'western_cardano_fortune_lot_house', house });
const rulerProof = planet => ({ kind: 'western_cardano_fortune_lot_ruler', planet });
const dignityProof = dignity => ({ kind: 'western_cardano_fortune_lot_dignity', dignity });
const rayProof = aspect => ({ kind: 'western_cardano_fortune_lot_ray', aspect });
const bodyHouse = (planet, house) => ({ kind: 'western_cardano_fortune_body_house', planet, house });
const jupiterBicorporeal = { kind: 'western_cardano_fortune_jupiter_bicorporeal' };

export function isCardanoLotFact(fact) {
  switch (fact.kind) {
    case 'western_cardano_fortune_lot_condition': return cases.includes(fact.witness);
    case 'western_cardano_fortune_lot_house': return [1, 4, 7, 9, 10, 11].includes(fact.house);
    case 'western_cardano_fortune_lot_ruler': return Object.hasOwn(classicalExaltationSigns, fact.planet);
    case 'western_cardano_fortune_lot_dignity': return ['domicile', 'exaltation'].includes(fact.dignity);
    case 'western_cardano_fortune_lot_ray': return ['sextile', 'trine'].includes(fact.aspect);
    case 'western_cardano_fortune_body_house': return wanderingPlanets.includes(fact.planet)
      && Number.isInteger(fact.house) && fact.house >= 1 && fact.house <= 12;
    case 'western_cardano_fortune_jupiter_bicorporeal': return true;
    default: return false;
  }
}

function bodyInProfile(facts, planet) {
  const position = lillyPlanetPosition(facts, planet);
  if (!Number.isFinite(position?.longitude)) return null;
  const houses = new Set(facts.filter(fact => fact.kind === 'western_profile_planet_house'
    && fact.profile === 'regiomontanus' && fact.planet === planet).map(fact => fact.house));
  const [house] = houses;
  return houses.size === 1 && Number.isInteger(house) && house >= 1 && house <= 12 ? { ...position, house } : null;
}

function recordHouseCases(facts, { lot, house, placement, cusps, mc, west, moon, ruler }, record) {
  // Keep the hand-checked natal configurations as separate historical sources.
  const mercuryLongitude = lillyPlanetPosition(facts, 'Mercury')?.longitude, jupiter = bodyInProfile(facts, 'Jupiter');
  if (placement && ruler === 'Mercury' && Number.isFinite(mercuryLongitude) && jupiter?.house === 2
    && lillyDomicileRuler(cusps[1]) === 'Jupiter' && cardanoArcDistance(jupiter.longitude, mercuryLongitude) <= cardanoConjunctionLimit) {
    record('case_jupiter_second', houseProof(house), rulerProof(ruler), cardanoCoordinate('second_cusp', cusps[1]),
      cardanoCoordinate('Jupiter', jupiter.longitude), cardanoCoordinate('Mercury', mercuryLongitude), bodyHouse('Jupiter', 2));
  }

  const mercury = bodyInProfile(facts, 'Mercury');
  const venus = bodyInProfile(facts, 'Venus');
  if (angularHouses.includes(house) && mercury?.house === house && venus?.house === house
    && [[lot, venus.longitude], [lot, mercury.longitude], [venus.longitude, mercury.longitude]]
      .every(([a, b]) => cardanoArcDistance(a, b) <= cardanoConjunctionLimit)) {
    record('case_lot_venus_mercury_angular', houseProof(house), cardanoCoordinate('Venus', venus.longitude),
      cardanoCoordinate('Mercury', mercury.longitude), bodyHouse('Venus', house), bodyHouse('Mercury', house));
  }

  if (ruler !== 'Saturn' || jupiter?.house !== 7 || jupiter.sign !== Math.floor(west / 30)) return;
  const saturn = bodyInProfile(facts, 'Saturn');
  const substitute = inheritancePlaces.get(saturn?.house);
  if (!substitute || saturn.sign === Math.floor(mc / 30)) return;
  const difference = Math.abs(saturn.sign - jupiter.sign);
  const aspect = signRays.get(Math.min(difference, 12 - difference));
  if (!aspect) return;
  const bicorporeal = [2, 5, 8, 11].includes(jupiter.sign);
  const ray = ptolemyLunarRay(facts, moon, jupiter.longitude);
  if (!bicorporeal && !ray) return;
  record(substitute, rulerProof(ruler), cardanoCoordinate('Saturn', saturn.longitude), cardanoCoordinate('Jupiter', jupiter.longitude),
    cardanoCoordinate('descendant', west), cardanoCoordinate('mc', mc),
    bodyHouse('Saturn', saturn.house), bodyHouse('Jupiter', jupiter.house),
    { kind: 'western_ptolemy_fortune_witness', planet: 'Jupiter', aspect, relation: 'same_sect' },
    ...(bicorporeal ? [jupiterBicorporeal] : []), ...(ray ? [ray] : []));
}

function friendlyRay(a, b) {
  const signs = Math.abs(Math.floor(a / 30) - Math.floor(b / 30));
  const step = Math.min(signs, 12 - signs);
  if (Math.abs(cardanoArcDistance(a, b) - step * 30) > cardanoConjunctionLimit) return null;
  if (step === 2) return 'sextile';
  if (step === 4) return 'trine';
  return null;
}

const oppositeAngle = (facts, angle, origin) => {
  if (!Number.isFinite(origin)) return null;
  const longitude = normalize(origin + 180);
  return facts.some(fact => fact.kind === 'angle_sign' && fact.angle === angle
    && fact.sign !== zodiacNames[Math.floor(longitude / 30)]) ? null : longitude;
};

export function cardanoLotEvidence(facts, ascendant, mc) {
  const evidence = new Map();
  const sun = lillyPlanetPosition(facts, 'Sun')?.longitude, moon = lillyPlanetPosition(facts, 'Moon')?.longitude;
  if (![ascendant, sun, moon].every(Number.isFinite)) return evidence;
  // IV.2 Textus II keeps the directed arc from the Sun to the Moon in both sects.
  const lot = normalize(ascendant + moon - sun);
  const ruler = lillyDomicileRuler(lot);
  const luminaries = [cardanoCoordinate('Sun', sun), cardanoCoordinate('Moon', moon)];
  const common = [cardanoCoordinate('ascendant', ascendant), ...luminaries, cardanoCoordinate('fortune', lot)];
  const record = (witness, ...proof) => evidence.set(witness, [...common, ...proof]);

  const cusps = lillyCusps(facts);
  const west = oppositeAngle(facts, 'descendant', ascendant);
  const ic = oppositeAngle(facts, 'ic', mc);
  const angles = [['ascendant', ascendant], ['mc', mc], ['descendant', west], ['ic', ic]];
  const anglesAgree = !cusps || angles.every(([, longitude], index) => {
    // Angle coordinates shared by the house calculation must agree with their cusps.
    const house = [1, 10, 7, 4][index];
    return Number.isFinite(longitude) && cardanoArcDistance(longitude, cusps[house - 1]) < 1e-8;
  });
  if (cusps && anglesAgree) {
    // Fortune is a point on the ecliptic. Use the actual, unshifted cusp intervals.
    const house = longitudeHouse(lot, cusps);
    const above = normalize(lot - ascendant) > 180;
    const placement = angularHouses.includes(house) ? 'angular_house'
      : above && house === 11 ? 'above_eleventh' : above && house === 9 ? 'above_ninth' : null;
    if (placement) {
      const proof = houseProof(house);
      record(placement, proof);
      if (cardanoArcDistance(lot, sun) <= cardanoConjunctionLimit) record('strong_lot_under_sun', proof);
      const ray = friendlyRay(lot, moon);
      if (ray) record('strong_lot_moon_' + ray, proof, rayProof(ray));
    }
    recordHouseCases(facts, { lot, house, placement, cusps, mc, west, moon, ruler }, record);
  }
  if (cardanoArcDistance(lot, moon) <= cardanoConjunctionLimit && cardanoArcDistance(sun, ascendant) <= cardanoAngleLimit) {
    record('lot_with_moon_sun_rising');
  }

  const position = lillyPlanetPosition(facts, ruler);
  if (!Number.isFinite(position?.longitude)) return evidence;
  const rulerLongitude = position.longitude;
  const owner = [rulerProof(ruler), cardanoCoordinate(ruler, rulerLongitude)];
  const elongation = normalize(rulerLongitude - sun);
  if (wanderingPlanets.includes(ruler) && elongation > 180 + 1e-10 && elongation < 360 - 1e-10) {
    record('ruler_oriental', ...owner);
  }
  const atCenter = angles.filter(([, longitude]) => Number.isFinite(longitude)
    && cardanoArcDistance(rulerLongitude, longitude) <= cardanoAngleLimit);
  const centers = anglesAgree ? atCenter.map(([angle, longitude]) => cardanoCoordinate(angle, longitude)) : [];
  if (centers.length) {
    record('ruler_angle_center', ...owner, ...centers);
  }
  const dignities = [
    ...(lillyDomicileRuler(rulerLongitude) === ruler ? [dignityProof('domicile')] : []),
    ...(classicalExaltationSigns[ruler] === position.sign ? [dignityProof('exaltation')] : []),
  ];
  if (dignities.length) record('ruler_own_dignity', ...owner, ...dignities);
  if (centers.length && dignities.length) record('ruler_angle_and_dignity', ...owner, ...centers, ...dignities);
  for (const [body, longitude] of [['Sun', sun], ['Moon', moon]]) {
    if (body === ruler) continue;
    const ray = friendlyRay(rulerLongitude, longitude);
    if (ray) record('ruler_with_' + body.toLowerCase(), ...owner, rayProof(ray));
  }
  return evidence;
}
