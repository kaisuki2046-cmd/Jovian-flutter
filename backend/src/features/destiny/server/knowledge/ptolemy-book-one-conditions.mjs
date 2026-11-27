import { zodiacNames, westernStationaryHourlyLimit } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { lillyAspectAngles } from './lilly-aspects.mjs';
import { westernPlanetAngleOffsets } from './lilly-coangles.mjs';
import { ptolemyDignitySign, ptolemyEssentialClaims } from './ptolemy-fortune.mjs';
import { confirmedHourlyMotion, easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';

const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const faceSteps = { Venus: 2, Mars: 3, Jupiter: 4, Saturn: 6 };
const signAspects = new Map([[2, 'sextile'], [3, 'square'], [4, 'trine'], [6, 'opposition']]);
const essential = ['domicile', 'exaltation', 'triplicity', 'term'];
const signTypes = ['equinox_sign', 'solid_sign', 'bicorporeal_sign', 'solstice_sign',
  'solid_sign', 'bicorporeal_sign', 'equinox_sign', 'solid_sign',
  'bicorporeal_sign', 'solstice_sign', 'solid_sign', 'bicorporeal_sign'];
const directions = ['applying', 'separating'];
const axes = ['mc', 'ic', 'ascendant', 'descendant'];
const majorAspects = ['conjunction', ...signAspects.values()];
const limit = 3;
const wrapping = (value, modulus) => (value % modulus + modulus) % modulus;
const arc = value => wrapping(value + 180, 360) - 180;
const shortest = (a, b) => Math.min(wrapping(b - a, 12), wrapping(a - b, 12));
const longitudeFact = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const latitudeFact = (planet, latitude) => ({ kind: 'western_geometry_planet_latitude', planet, latitude });
const motionFact = (planet, signedDegrees) => ({ kind: 'planet_hourly_motion', planet, signedDegrees });
const ascendantFact = longitude => ({ kind: 'western_geometry_ascendant', longitude });
const anglesFact = (planet, angle, offset) => ({ kind: 'western_ptolemy_book_one_angle', planet, angle, offset });
const ascAspectFact = (planet, steps) => ({ kind: 'western_ptolemy_book_one_asc_aspect', planet, steps });

const reviewed = new Map();
function sources(segment, rows) {
  for (const [passage, hash, partial, ...selectors] of rows) {
    reviewed.set(`astro-ptolemy-v1-${segment}-p${String(passage).padStart(3, '0')}-001`,
      { hash, selectors, needsTropical: true, partial });
  }
}
sources('zodiac-types', [
  [2, 'f94e1ef0ef735eaa0891b8e25dfef36af7c3efedb7fd808f933c4120bcae4213', false, 'solstice_sign'],
  [3, '75a203d94b63b4f3d3559fdf01e2131b44cf8a131e21976dd27a4671dd8be702', false, 'equinox_sign'],
  [4, '5c534698ad58017464bfd3990ddaa80a43a0b085b3d75ccb20e8990d581e7288', false, 'solid_sign'],
  [5, '836aab0a461c2e3278961e5d11ecc129041acbce35d781fa90e3fca32731fdd0', false, 'bicorporeal_sign'],
]);
sources('chapter-23', [
  [1, '8ac175371c31d46591495f7936c7cc4e6176a115c176f71ce91e0d9fe1308fc7', true, 'proper_face_sun', 'proper_face_moon'],
  [2, '1aa373db9ad23a8777af834ce3c1dbe8f6c9edbba93375a6b4f92db890923b3c', false, 'proper_face_venus_both'],
  [3, '85e54f0709811b3d5b293f54003241d14d89e0fb3747d500e9bf544fe2d6f684', true, 'two_familiarities'],
]);
sources('applications', [
  [2, '215a084bfa09f1fd93db044daaeec88f8385de4c5ef641d712e32f5596b95027', true, 'body_applying', 'body_separating'],
  [3, '27bcdf9aa5469a6d78e562607a50f9b638840697b6d765de007458ab51c166a7', true, 'ray_applying', 'ray_separating'],
  [6, '144ab5d4fe7b5ad6e13f859a7443456e423f99f313e6bc8f0ae0d64d03b84366', true, 'upper_culmination', 'approaching_upper_culmination'],
  [7, '821a6ff575b8da1b411956167b95827044ae13bc3a45035ef2aa6cf116c7ab81', true, 'horizon', 'next_rising_sign'],
  [8, '007e90803e0ba1798c760ce5750843f17e8149642463caefb6a16c7af4500d53', true, 'eastern_horizon', 'lower_culmination'],
  [9, '28dedaa1e1e7388e064733ad3463e2f528a046d52b272d9bb767d869a46cc11f', false, 'ascendant_disjunct'],
  [12, 'ec661a6c24b7d4b3491d1694e83b519e967dfe3e118c02b1b63696f264733b0b', true, 'ascendant_other_aspect'],
]);
const witnesses = new Set([...reviewed.values()].flatMap(spec => spec.selectors));
export const ptolemyBookOneConditionSource = id => reviewed.get(id);
export const isPtolemyBookOneConditionWitness = witness => witnesses.has(witness);

export function isPtolemyBookOneConditionFact(fact) {
  if (!bodies.includes(fact.planet) && fact.kind !== 'western_ptolemy_book_one_contact') return false;
  switch (fact.kind) {
    case 'western_ptolemy_book_one_face':
      return Object.hasOwn(faceSteps, fact.planet) && ['Sun', 'Moon'].includes(fact.luminary) && fact.steps === faceSteps[fact.planet];
    case 'western_ptolemy_book_one_familiarity':
      return essential.includes(fact.basis);
    case 'western_ptolemy_book_one_contact':
      return bodies.includes(fact.first) && bodies.includes(fact.second) && fact.first !== fact.second
        && majorAspects.includes(fact.aspect) && directions.includes(fact.phase)
        && Number.isFinite(fact.distance) && fact.distance > 0 && fact.distance <= limit;
    case 'western_ptolemy_book_one_angle':
      return axes.includes(fact.angle) && Number.isFinite(fact.offset) && Math.abs(fact.offset) <= limit;
    case 'western_ptolemy_book_one_asc_aspect':
      return [1, 2, 3, 4, 5, 6].includes(fact.steps);
    default: return false;
  }
}

function recordFace(positions, record) {
  for (const [planet, steps] of Object.entries(faceSteps)) {
    const position = positions.get(planet);
    if (!Number.isFinite(position?.longitude)) continue;
    const rays = [];
    for (const luminary of ['Sun', 'Moon']) {
      const light = positions.get(luminary);
      if (!Number.isFinite(light?.longitude)) continue;
      // I.17 gives the layout, with Saturn opposite both lights and the
      // intermediate planets west of the Sun's house, east of the Moon's.
      const signOffset = wrapping(position.sign - light.sign, 12);
      const expected = luminary === 'Sun' ? steps : 12 - steps;
      const signed = arc(position.longitude - light.longitude);
      if (signOffset !== expected || (steps !== 6 && (luminary === 'Sun' ? signed <= 0 : signed >= 0))) continue;
      const proof = [{ kind: 'western_ptolemy_book_one_face', planet, luminary, steps },
        longitudeFact(planet, position.longitude), longitudeFact(luminary, light.longitude)];
      record(luminary === 'Sun' ? 'proper_face_sun' : 'proper_face_moon', ...proof);
      rays.push(...proof);
    }
    if (planet === 'Venus' && rays.length === 6) record('proper_face_venus_both', ...rays);
  }
}

function recordFamiliarities(facts, positions, dignitiesAt, record) {
  if (!dignitiesAt) return;
  const sects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const [sect] = sects;
  if (sects.size !== 1 || !['day', 'night'].includes(sect)) return;
  for (const [planet, position] of positions) {
    if (!Number.isFinite(position.longitude)) continue;
    const cells = dignitiesAt(ptolemyDignitySign(position.sign), position.degree, sect);
    if (!cells?.term || !cells.triplicity?.length) continue;
    const bases = ptolemyEssentialClaims(planet, position, cells);
    if (bases.length < 2) continue;
    record('two_familiarities', longitudeFact(planet, position.longitude), { kind: 'western_sect', sect },
      ...bases.map(basis => ({ kind: 'western_ptolemy_book_one_familiarity', planet, basis })));
  }
}

function readLatitude(facts, planet) {
  const matches = new Set(facts.filter(fact => fact.kind === 'western_geometry_planet_latitude' && fact.planet === planet)
    .map(fact => fact.latitude));
  const [value] = matches;
  return matches.size === 1 && Number.isFinite(value) && Math.abs(value) < 90 ? value : undefined;
}

function recordContacts(facts, positions, record) {
  const entries = [...positions].flatMap(([planet, position]) => {
    const speed = confirmedHourlyMotion(facts, planet);
    return Number.isFinite(position.longitude) && speed !== null
      ? [{ planet, ...position, speed, latitude: readLatitude(facts, planet) }] : [];
  });
  for (const [index, first] of entries.entries()) {
    for (const second of entries.slice(index + 1)) {
      const separation = arc(first.longitude - second.longitude);
      const aspect = Math.abs(separation) <= limit ? 'conjunction' : signAspects.get(shortest(first.sign, second.sign));
      if (!aspect) continue;
      const fromExact = separation - Math.sign(separation) * lillyAspectAngles[aspect];
      const distance = Math.abs(fromExact), relativeSpeed = first.speed - second.speed;
      if (distance <= 1e-9 || distance > limit || Math.abs(relativeSpeed) <= westernStationaryHourlyLimit) continue;
      const bodily = aspect === 'conjunction';
      if (bodily && !(first.latitude * second.latitude > 0)) continue;
      const phase = fromExact * relativeSpeed < 0 ? 'applying' : 'separating';
      record((bodily ? 'body_' : 'ray_') + phase,
        { kind: 'western_ptolemy_book_one_contact', first: first.planet, second: second.planet, aspect, phase, distance },
        longitudeFact(first.planet, first.longitude), longitudeFact(second.planet, second.longitude),
        motionFact(first.planet, first.speed), motionFact(second.planet, second.speed),
        ...(bodily ? [latitudeFact(first.planet, first.latitude), latitudeFact(second.planet, second.latitude)] : []));
    }
  }
}

function recordAngularPositions(facts, positions, record) {
  const ascendant = easternOrCulminatingLongitude(facts, 'ascendant');
  if (!Number.isFinite(ascendant)) return;
  const ascSign = Math.floor(ascendant / 30);
  const midheaven = easternOrCulminatingLongitude(facts, 'mc');
  const cusps = Number.isFinite(midheaven) ? lillyCusps(facts) : null;
  const geometry = westernPlanetAngleOffsets(facts, cusps, new Map([...positions].map(([planet, point]) => [planet, point.longitude])));
  for (const [planet, point] of positions) {
    const sign = { kind: 'planet_sign', planet, sign: zodiacNames[point.sign] };
    const steps = shortest(point.sign, ascSign), following = wrapping(point.sign - ascSign, 12) === 1;
    const zodiacProof = [ascendantFact(ascendant), sign];
    if (following) record('next_rising_sign', ...zodiacProof);
    const axisIndex = (point.sign + ascSign) % 12;
    if ((steps === 1 || steps === 5) && axisIndex !== 0 && axisIndex !== 6) {
      record('ascendant_disjunct', ...zodiacProof, ascAspectFact(planet, steps));
    }
    const measured = geometry.get(planet);
    if (!measured) continue;
    const { offsets, latitude, obliquity } = measured;
    const proof = [...zodiacProof, { kind: 'western_geometry_midheaven', longitude: midheaven },
      { kind: 'western_geometry_obliquity', obliquity }, longitudeFact(planet, point.longitude), latitudeFact(planet, latitude)];
    const upper = Math.abs(offsets.mc) <= 1;
    const approaching = offsets.mc > 1 && offsets.mc <= limit;
    const lower = Math.abs(offsets.ic) <= 1;
    const east = Math.abs(offsets.ascendant) <= 1;
    const west = Math.abs(offsets.descendant) <= 1;
    const onAngle = (name, angle) => record(name, ...proof, anglesFact(planet, angle, offsets[angle]));
    if (upper) onAngle('upper_culmination', 'mc');
    if (approaching) onAngle('approaching_upper_culmination', 'mc');
    if (lower) onAngle('lower_culmination', 'ic');
    if (east) {
      onAngle('horizon', 'ascendant');
      onAngle('eastern_horizon', 'ascendant');
    }
    if (west) onAngle('horizon', 'descendant');
    if (signAspects.has(steps) && !following && !upper && !approaching && !lower && !east && !west) {
      record('ascendant_other_aspect', ...proof, ascAspectFact(planet, steps));
    }
  }
}

export function recordPtolemyBookOneConditions(facts, positions, dignitiesAt, record) {
  for (const [planet, { sign }] of positions) record(signTypes[sign], { kind: 'planet_sign', planet, sign: zodiacNames[sign] });
  recordFace(positions, record);
  recordFamiliarities(facts, positions, dignitiesAt, record);
  recordContacts(facts, positions, record);
  recordAngularPositions(facts, positions, record);
}
