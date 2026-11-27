import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyAspectAngles, lillyAspectPhase } from './lilly-aspects.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyBookOneAspectsProfile = 'lilly-1647-book-one-aspects-v1';
const sourceKind = 'western_lilly_book_one_aspect_source';
const sourceDigests = new Map([
  ['aspect-table-p001', '0156382de35c6920a20340aabd31d54f39cee98b3d593d87a6e846bb5b572969'],
  ['aspect-table-p002', 'ad921cb7f3ee86cbe11356d2ecc69048d23739bedb4896ab2bd24a7b9905bb57'],
  ['aspect-table-p003', 'dc329f3cbbd74fd85c2a3c4209c4011b57642e0e44b2b1797e6210b3a3192e88'],
  ['aspect-table-p004', '7d5842f24554c36069f0d7a9747665c7dbb5361e77cfc5d2c7c668d04bdda224'],
  ['aspect-table-p005', '25a5d93c1b4909154346bc7d8757878bbe2a120e1e06994e220460aba25d698e'],
  ['aspect-table-p006', '86de824f6152e83bc9ae7eb45f2965c88bdd1901d5cd1813e36edb664113fdc2'],
  ['aspect-table-p007', '8076a433d300349c06c7f4973fed5d826448e798babe1d2c4ba9c870675401d3'],
  ['aspect-table-p008', '99bf3547081797fade440d6c25a7acdf11b59aca4384cd01d13394b7397736db'],
  ['aspect-table-p009', '11ee94980f07121efca5b5ecb73b4362490c1dae198b2f9b72809a7e1d00ab9d'],
  ['aspects-p020', '5169b8737ed87e781829cf5ff84782dcb6a9bd9d6e222914a4ddcc2361c3c307'],
  ['aspects-p022', 'aced0bfe0bf565bc873e42419eaea7fab30cd4ae7b8d33b9cdaf088c279a0afe'],
  ['aspects-p028', 'fd753c7eeab242b8cd8f7fdaee7d1267e8954c2563ef5ddcb377842c28aa47a1'],
  ['aspects-p030', 'c43031c7e1852ad46b16a9e8d16fdec600640ffd24a2d98ea164a33e75416daa'],
  ['aspects-p031', '7c7296e1d3b2f5c88fa919e083468427af7c3b745f573b32c86caa0c76cbab4f'],
  ['aspects-p032', '90677a484c39d3579f3b81a2d007fea6c5e90c3ee875ea5db695bd2e83809121'],
  ['aspects-p033', '45b04ef393d824e72f767fff08054077321fb27a7aaac79d2f173c3f8723c294'],
  ['aspects-p035', '35e3ed01e90adf8208b89864b5759732b605d4b78f781d7476942d02baec2eab'],
  ['aspects-p036', 'c015534cd6f194498af87c2368869e6072a8ff8cefb8569d5e71403db03ee8ce'],
  ['aspects-p037', '6f0c5563cf4c52b4b6e375da3f9467e3fb836508238563e19b5c9b34a2c38134'],
  ['aspects-p038', '1d52091c73dcd844ad09b2c7818a8338354d95b25aa2f4323570a38a37f568fb'],
  ['aspects-p039', 'cb24792497d9d16c06b3a77460f5defe548ea196349c73fe4a5247854730f92d'],
  ['aspects-p040', '6d700b8825908c9bbd0bfb5c991879b2d632773dc96d930793d17bcdcd6d79e5'],
  ['aspects-p041', 'fc16c37cced84ee8b2d75e0e25c7bd450b6727c5a7948a7629332f55727b3b5b'],
  ['aspects-p042', 'be3bcc5598262c41cde1c7cbe56bb4bb426d8ab107f831145bdf2b212e171132'],
  ['aspects-p043', '2f7c7130c6f1738f162b5fe9bdea55cbc065e5af9668ac815b6f2e38b5ce19a4'],
]);
const forwardSteps = [[10], [2], [9], [3], [8], [4], [6], [1, 5, 7, 11], [8, 9, 10]];
const superiors = ['Mars', 'Jupiter', 'Saturn'];
const inferiorPlanets = ['Mercury', 'Venus'];
const solarStates = {
  32: ['cazimi'], 33: ['combust'], 35: ['under_beams'],
  38: ['oriental', superiors], 39: ['occidental', superiors],
  40: ['oriental', inferiorPlanets], 41: ['occidental', inferiorPlanets],
  42: ['oriental', ['Moon']], 43: ['occidental', ['Moon']],
};
const tables = ['main', 'other'];
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const sourceFact = passage => ({ kind: sourceKind, passage });
export const isLillyBookOneAspectSource = passage => sourceDigests.has(passage);
const signFact = ({ planet, sign }) => ({ kind: 'planet_sign', planet, sign: zodiacNames[sign] });
const longitudeFact = ({ planet, longitude }) => ({ kind: 'planet_longitude', planet, longitude });
const hourlyMotion = ({ planet, speed }) => ({ kind: 'planet_hourly_motion', planet, signedDegrees: speed });
const stepsFrom = (first, second) => (second.sign - first.sign + 12) % 12;

export function compileLillyBookOneAspects(claim) {
  const passage = /^astro-lilly-v1-((?:aspect-table|aspects)-p\d{3})-001$/u.exec(claim.id)?.[1];
  const expected = sourceDigests.get(passage);
  if (!expected) return undefined;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) {
    return { reason: 'source_review_required', reviewNote: '莉莉卷一相位条目的出处、条件或原文有改动，须重新核对。' };
  }
  return {
    compiler: lillyBookOneAspectsProfile, matchScope: 'historical_aphorism',
    inputs: [normalizeRuleInput('western', { required: [tropical, sourceFact(passage)] })],
    ...(['aspects-p020', 'aspects-p031', 'aspects-p036', 'aspects-p037'].includes(passage)
      && { remainingAlternatives: 1 }),
  };
}

function chartPositions(facts) {
  return lillyDignityBodies.flatMap(planet => {
    const position = lillyPlanetPosition(facts, planet);
    return position ? [{ planet, body: planet.toLowerCase(), ...position }] : [];
  });
}

function signPairs(positions, steps) {
  return positions.flatMap(first => positions.flatMap(second => {
    const distance = stepsFrom(first, second);
    return first !== second && steps.includes(distance)
      ? [{ kind: 'western_lilly_book_one_sign_steps', first: first.planet, second: second.planet, steps: distance },
        signFact(first), signFact(second)] : [];
  }));
}

function movingPlanets(facts, positions) {
  return positions.flatMap(point => {
    const speeds = new Set(facts.filter(f => f.kind === 'planet_hourly_motion' && f.planet === point.planet).map(f => f.signedDegrees));
    const directions = new Set(facts.filter(f => f.kind === 'planet_motion' && f.planet === point.planet).map(f => f.motion));
    const [speed] = speeds, direction = speed < 0 ? 'retrograde' : 'direct';
    return Number.isFinite(point.longitude) && speeds.size === 1 && Number.isFinite(speed) && Math.abs(speed) >= 1e-7
      && (!directions.size || directions.size === 1 && directions.has(direction)) ? [{ ...point, speed }] : [];
  });
}

function motionEvidence(facts, positions, number) {
  const moving = movingPlanets(facts, positions);
  const phase = number === 22 ? 'separating' : 'applying';
  return moving.flatMap(first => moving.flatMap(second => {
    if (first === second || number === 20 && (first.speed > 0 || second.speed > 0)) return [];
    const steps = stepsFrom(first, second);
    const angle = Math.min(steps, 12 - steps) * 30;
    const aspect = Object.keys(lillyAspectAngles).find(name => lillyAspectAngles[name] === angle);
    if (!aspect) return [];
    return tables.flatMap(table => lillyAspect(first.longitude, second.longitude, first.body, second.body, aspect, table)
      && lillyAspectPhase(first, second, phase, table)
      ? [{ kind: 'western_lilly_aspect_phase', first: first.body, second: second.body, phase, table },
        longitudeFact(first), longitudeFact(second), hourlyMotion(first), hourlyMotion(second)] : []);
  }));
}

function solarEvidence(positions, solar, number) {
  const [condition, bodies] = solarStates[number];
  const sun = positions.find(point => point.planet === 'Sun');
  if (!sun) return [];
  return positions.flatMap(point => {
    if (bodies && !bodies.includes(point.planet)) return [];
    if (number === 40 && ![0, 11].includes(stepsFrom(sun, point))
      || number === 41 && ![0, 1].includes(stepsFrom(sun, point))) return [];
    const state = solar.find(f => f.selector === point.body && f.condition === condition && f.matches === true);
    return state ? [state, longitudeFact(sun), longitudeFact(point)] : [];
  });
}

function hayzEvidence(facts, positions, sect) {
  const sects = new Set(facts.filter(f => f.kind === 'western_sect').map(f => f.sect));
  if (sects.size !== 1 || !sects.has(sect) || !lillyCusps(facts)) return [];
  const day = sect === 'day';
  const houses = facts.filter(f => f.kind === 'western_profile_planet_house' && f.profile === 'regiomontanus');
  const nativeHouse = planet => {
    const entries = houses.filter(f => f.planet === planet);
    return new Set(entries.map(f => f.house)).size === 1 ? entries[0] : null;
  };
  const solarHouse = nativeHouse('Sun');
  if (!solarHouse || (solarHouse.house >= 7) !== day) return [];
  return positions.flatMap(position => {
    const house = nativeHouse(position.planet);
    const eligible = day ? ['Sun', 'Jupiter', 'Saturn'] : ['Moon', 'Venus'];
    return house && eligible.includes(position.planet) && position.sign % 2 === (day ? 0 : 1) && (house.house >= 7) === day
      ? [{ kind: 'western_sect', sect }, house, signFact(position)] : [];
  });
}

function besiegingEvidence(positions) {
  const mars = positions.find(point => point.planet === 'Mars'), saturn = positions.find(point => point.planet === 'Saturn');
  if (!Number.isFinite(mars?.longitude) || !Number.isFinite(saturn?.longitude) || mars.sign !== saturn.sign) return [];
  const lower = Math.min(mars.longitude, saturn.longitude), upper = Math.max(mars.longitude, saturn.longitude);
  return positions.flatMap(point => Number.isFinite(point.longitude) && point.longitude > lower && point.longitude < upper
    ? [{ kind: 'western_lilly_book_one_besieged', planet: point.planet },
      longitudeFact(mars), longitudeFact(saturn), longitudeFact(point)] : []);
}

function sourceEvidence(passage, facts, dignities, solar) {
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = chartPositions(facts);
  const number = Number(passage.slice(-3));
  if (passage.startsWith('aspect-table-')) return signPairs(positions, forwardSteps[number - 1]);
  if (number === 20 || number === 22) return motionEvidence(facts, positions, number);
  if (number === 28) return positions.flatMap(point => {
    const state = dignities.find(f => f.planet === point.planet && f.dignity === 'peregrine' && f.matches === true);
    return state ? [state, longitudeFact(point)] : [];
  });
  if (number === 30) return positions.flatMap(point => point.planet === 'Sun' ? [] : [
    { kind: 'western_lilly_book_one_rank', planet: point.planet, rank: superiors.includes(point.planet) ? 'superior' : 'inferior' },
    signFact(point),
  ]);
  if (number === 31) return besiegingEvidence(positions);
  if (number === 36 || number === 37) return hayzEvidence(facts, positions, number === 36 ? 'day' : 'night');
  return solarEvidence(positions, solar, number);
}

export function lillyBookOneAspectFacts(facts, requested, dignities, solar) {
  const sources = requested.filter(f => f.kind === sourceKind && isLillyBookOneAspectSource(f.passage));
  return sources.filter(({ passage }) => sourceEvidence(passage, facts, dignities, solar).length);
}

export function lillyBookOneAspectProof(conditions, observed) {
  const { passage } = conditions.required.find(f => f.kind === sourceKind);
  const proof = sourceEvidence(passage, observed,
    observed.filter(f => f.kind === 'western_lilly_dignity'), observed.filter(f => f.kind === 'western_lilly_solar_state'));
  return { ...conditions, required: [...new Map([...conditions.required, ...proof].map(f => [JSON.stringify(f), f])).values()] };
}
