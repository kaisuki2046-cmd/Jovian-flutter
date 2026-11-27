import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyOrbTables, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyDignityFacts } from './lilly-dignities.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyFirstMoverCandidate, lillyProfessionBodies, lillyProfessionPtolemyAccountFacts,
  lillyProfessionRising } from './lilly-profession-rising.mjs';

export const lillyProfessionProfile = 'lilly-1647-profession-first-two-v1';
export { lillyProfessionBodies };
export const lillyProfessionStepStates = {
  1: ['qualifies'], 2: ['qualifies', 'peregrine', 'fall'], 3: ['candidate', 'selected'],
  4: ['qualifies', 'afflicted', 'selected'],
  5: ['selected'],
};
const and = (...values) => values.includes(false) ? false : values.includes(null) ? null : true;
export const lillyProfessionStepFact = (planet, step, state) => ({ kind: 'western_lilly_profession_step', planet, step, state });
export const lillyProfessionPartileComparison = { kind: 'western_lilly_profession_partile_comparison' };
export const lillyProfessionTenthHouse = { kind: 'western_lilly_profession_tenth_house' };
export const lillyProfessionSelected = planet => ({ kind: 'western_lilly_profession_selected', planet });
export const lillyProfessionSole = planet => ({ kind: 'western_lilly_profession_sole', planet });
export const lillyProfessionConditionPlanets = [...lillyProfessionBodies, 'Jupiter'];
export const lillyProfessionCondition = (planet, condition) => ({ kind: 'western_lilly_profession_condition', planet, condition });

const lunarRays = [60, 90, 120, 180];
const maleficAspects = ['conjunction', 'square', 'opposition'];
const separation = (a, b) => {
  const gap = Math.abs(a - b);
  return Math.min(gap, 360 - gap);
};

function longitudeOf(facts, planet) {
  const values = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet).map(fact => fact.longitude));
  if (values.size !== 1) return null;
  const [longitude] = values;
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) return null;
  const signs = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === planet).map(fact => fact.sign));
  return !signs.size || signs.size === 1 && signs.has(zodiacNames[Math.floor(longitude / 30)]) ? longitude : null;
}

export function lillyProfessionConditions(facts, houses, dignities) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical') || !houses.some(fact => fact.kind === 'western_lilly_ruleset')) return [];
  const malefics = ['Mars', 'Saturn'].map(planet => [planet, longitudeOf(facts, planet)]);
  const northNode = lillyNodeLongitudes(facts).find(point => point.node === 'north_node')?.longitude;
  return lillyProfessionConditionPlanets.flatMap(planet => {
    const longitude = longitudeOf(facts, planet);
    if (longitude === null) return [];
    const house = houses.find(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === planet)?.house;
    const strong = [1, 4, 7, 10].includes(house) && dignities.some(fact => fact.planet === planet && fact.matches
      && ['domicile', 'exaltation'].includes(fact.dignity));
    const clear = planet !== 'Jupiter' && malefics.every(([body, other]) => body === planet
      || other !== null && ![0, 90, 180].includes(lillyPartileDistance(longitude, other)));
    const withNode = planet === 'Jupiter' && Number.isFinite(northNode) && lillyPartileDistance(longitude, northNode) === 0;
    return [
      ...(strong ? [lillyProfessionCondition(planet, 'strong_angular')] : []),
      ...(clear ? [lillyProfessionCondition(planet, 'clear_partile_malefics')] : []),
      ...(withNode ? [lillyProfessionCondition(planet, 'with_north_node')] : []),
    ];
  });
}

function fourthStepStatus(planet, longitude, moon, malefics) {
  const distanceFromRay = Math.min(...lunarRays.map(ray => Math.abs(separation(longitude, moon) - ray)));
  const considered = malefics.filter(([body]) => body !== planet);
  const outcomes = Object.entries(lillyOrbTables).map(([table, orbs]) => {
    if (distanceFromRay > orbs.moon / 2 + 1e-10) return false;
    if (considered.some(([body, position]) => maleficAspects.some(aspect =>
      lillyAspect(longitude, position, planet.toLowerCase(), body.toLowerCase(), aspect, table) === true))) return 'afflicted';
    return considered.every(([, position]) => position !== null) ? 'qualifies' : null;
  });
  return outcomes.every(outcome => outcome === outcomes[0]) ? outcomes[0] : null;
}

// Christian Astrology, Book III p.625. Only the first two steps contribute
// to the original member/sole profile. Later steps have separate evidence.
// Solar clearance follows Book I p.113's full 17-degree elongation; the text
// of p.625 gives no cazimi override for its explicit clearance requirement.
export function lillyProfessionFacts(facts, cellsAt, { includeSteps = false } = {}) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  const declaredSects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const houses = lillyHouseFacts(facts);
  if (!houses.some(fact => fact.kind === 'western_lilly_ruleset')) return [];
  const houseOf = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house').map(fact => [fact.planet, fact.house]));
  const mcLord = houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 10)?.planet;
  const tenthHouse = includeSteps && houseOf.has(mcLord) && longitudeOf(facts, mcLord) !== null ? [lillyProfessionTenthHouse] : [];
  const rising = includeSteps ? lillyProfessionRising(facts, lillyCusps(facts)) : null;
  const chapterFacts = [...tenthHouse, ...(rising ? lillyProfessionPtolemyAccountFacts(rising, mcLord, houseOf) : [])];
  if (!cellsAt || declaredSects.size > 1) return chapterFacts;
  const sun = longitudeOf(facts, 'Sun');
  const clear = planet => {
    const longitude = longitudeOf(facts, planet);
    if (sun === null || longitude === null) return null;
    return separation(sun, longitude) >= 17;
  };
  const cachedCells = new Map();
  const activeCells = (sign, degree) => {
    const key = sign + ':' + degree;
    if (!cachedCells.has(key)) cachedCells.set(key, cellsAt(sign, degree));
    return cachedCells.get(key);
  };
  function firstTwoRoles(statuses) {
    const winners = lillyProfessionBodies.filter(planet => statuses.get(planet) === true);
    const complete = [...statuses.values()].every(value => value !== null);
    return lillyProfessionBodies.flatMap(planet => {
      const member = statuses.get(planet);
      const sole = member === false || winners.some(winner => winner !== planet) ? false : complete ? true : null;
      return [['member', member], ['sole', sole]].flatMap(([role, matches]) => matches === null ? [] :
        [{ kind: 'western_lilly_profession_ruler', planet, role, matches, profile: lillyProfessionProfile }]);
    });
  }
  function lunarStepEvidence() {
    const moon = longitudeOf(facts, 'Moon');
    if (moon === null) return [];
    const positions = lillyProfessionBodies.map(planet => [planet, longitudeOf(facts, planet)]);
    // p.106 gives corresponding whole degrees for partile rays. Book I
    // distinguishes seeing by a ray from bodily conjunction.
    const candidates = positions.filter(([, longitude]) => {
      if (longitude === null) return false;
      return lunarRays.includes(lillyPartileDistance(longitude, moon));
    }).map(([planet]) => planet);
    const evidence = candidates.map(planet => lillyProfessionStepFact(planet, 3, 'candidate'));
    if (candidates.length >= 2) evidence.push(lillyProfessionPartileComparison);
    if (positions.some(([, longitude]) => longitude === null)) return evidence;
    if (candidates.length === 1) {
      evidence.push(lillyProfessionStepFact(candidates[0], 3, 'selected'));
    }
    if (candidates.length) return evidence;

    const malefics = ['Mars', 'Saturn'].map(planet => [planet, longitudeOf(facts, planet)]);
    const statuses = positions.map(([planet, longitude]) => [planet, fourthStepStatus(planet, longitude, moon, malefics)]);
    const eligible = statuses.filter(([, status]) => status === 'qualifies');
    const fourthStep = statuses.flatMap(([planet, status]) => status ? [lillyProfessionStepFact(planet, 4, status)] : []);
    if (eligible.length === 1 && statuses.every(([, status]) => status !== null)) {
      fourthStep.push(lillyProfessionStepFact(eligible[0][0], 4, 'selected'));
    }
    if (!eligible.length && statuses.every(([, status]) => status !== null)) {
      const antecedent = lillyFirstMoverCandidate(rising);
      if (antecedent) fourthStep.push(lillyProfessionStepFact(antecedent, 5, 'selected'));
    }
    return fourthStep;
  }
  const sects = declaredSects.size === 1 ? [...declaredSects] : ['day', 'night'];
  const outcomes = sects.map(sect => {
    const dignity = lillyDignityFacts([...facts.filter(fact => fact.kind !== 'western_sect'), { kind: 'western_sect', sect }], activeCells);
    const state = (planet, name) => dignity.find(fact => fact.planet === planet && fact.dignity === name)?.matches ?? null;
    const ownDignity = planet => state(planet, 'peregrine') === null ? null : !state(planet, 'peregrine');
    const first = new Map(lillyProfessionBodies.map(planet => [planet, and(
      houseOf.has(planet) ? [10, 1, 7].includes(houseOf.get(planet)) : null, ownDignity(planet), clear(planet))]));
    const winners = [...first].filter(([, value]) => value === true).map(([planet]) => planet);
    if (winners.length) return [
      ...firstTwoRoles(first),
      ...(includeSteps ? winners.map(planet => lillyProfessionStepFact(planet, 1, 'qualifies')) : []),
    ];
    if ([...first.values()].some(value => value === null) || !mcLord) return [];
    const candidate = lillyProfessionBodies.includes(mcLord);
    const fall = candidate ? state(mcLord, 'fall') : null;
    const peregrine = candidate ? state(mcLord, 'peregrine') : null;
    const second = candidate ? and(peregrine === null ? null : !peregrine, fall === null ? null : !fall) : false;
    if (second === true) return [
      ...firstTwoRoles(new Map(lillyProfessionBodies.map(planet => [planet, planet === mcLord]))),
      ...(includeSteps ? [lillyProfessionStepFact(mcLord, 2, 'qualifies')] : []),
    ];
    if (second !== false || !includeSteps) return [];
    return [
      ...(peregrine === true ? [lillyProfessionStepFact(mcLord, 2, 'peregrine')] : []),
      ...(fall === true ? [lillyProfessionStepFact(mcLord, 2, 'fall')] : []),
      ...lunarStepEvidence(),
    ];
  });
  const paths = includeSteps ? outcomes.map(outcome => {
    const later = outcome.find(fact => fact.kind === 'western_lilly_profession_step' && fact.state === 'selected')?.planet;
    const selected = later ? [later] : outcome.filter(fact => fact.kind === 'western_lilly_profession_ruler'
      && fact.role === 'member' && fact.matches).map(fact => fact.planet);
    const sole = later ?? outcome.find(fact => fact.kind === 'western_lilly_profession_ruler' && fact.role === 'sole' && fact.matches)?.planet;
    return [...outcome, ...selected.map(lillyProfessionSelected), ...(sole ? [lillyProfessionSole(sole)] : [])];
  }) : outcomes;
  const otherPaths = paths.slice(1).map(outcome => new Set(outcome.map(fact => JSON.stringify(fact))));
  return [...chapterFacts, ...paths[0].filter(fact => otherPaths.every(path => path.has(JSON.stringify(fact))))];
}
