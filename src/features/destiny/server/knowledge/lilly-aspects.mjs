import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { zodiacNames } from '../../control/charts.ts';

// Christian Astrology (1647), p.107: first column and the author's alternative
// column. Each complete rule is evaluated under one table, never a mixture.
export const lillyOrbTables = {
  main: { sun: 17, moon: 12.5, mercury: 7, venus: 8, mars: 7.5, jupiter: 12, saturn: 10 },
  other: { sun: 15, moon: 12, mercury: 7, venus: 7, mars: 7, jupiter: 9, saturn: 9 },
};
const bodies = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };
export const lillyAspectAngles = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
export const lillyAspectNames = [...Object.keys(lillyAspectAngles), 'friendly', 'any'];
export const lillyPartileAspects = Object.keys(lillyAspectAngles);
export function lillyPartileDistance(first, second) {
  const gap = Math.abs(Math.floor(first) - Math.floor(second));
  return Math.min(gap, 360 - gap);
}
export const isLillyAspectSelector = value => Object.hasOwn(bodies, value)
  || value === 'fortune_ruler' || /^house_(?:[1-9]|1[0-2])_ruler$/u.test(value);
export const lillyAspectPhases = ['applying', 'applying_friendly_or_conjunction', 'separating', 'retrograde_separating'];
const directedAngles = [0, 60, 90, 120, 180, 240, 270, 300];
const friendlyOrBodilyAngles = [0, 60, 120, 240, 300];
const order = ['moon', 'mercury', 'venus', 'sun', 'mars', 'jupiter', 'saturn'];
const signedArc = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
export const lillyHouseClasses = ['angular', 'succedent', 'cadent'];
const houseClass = house => lillyHouseClasses[(house - 1) % 3];

export function lillyRulerHouseClassFacts(houseFacts) {
  return houseFacts.filter(fact => fact.kind === 'western_lilly_ruler_house').map(({ house, placedIn }) =>
    ({ kind: 'western_lilly_ruler_house_class', house, houseClass: houseClass(placedIn) }));
}

export function lillyAspectPhase(first, second, phase, table, tables = lillyOrbTables) {
  const orbs = tables[table];
  if (!orbs || first.body === second.body || !lillyAspectPhases.includes(phase)
    || ![first, second].every(({ body, longitude, speed }) => Object.hasOwn(orbs, body)
      && Number.isFinite(longitude) && longitude >= 0 && longitude < 360
      && Number.isFinite(speed) && Math.abs(speed) >= 1e-7 && Math.abs(speed) <= 1)) return false;
  const bound = (orbs[first.body] + orbs[second.body]) / 2;
  const relative = first.speed - second.speed;
  const sameDirection = Math.sign(first.speed) === Math.sign(second.speed);
  const applying = phase === 'applying' || phase === 'applying_friendly_or_conjunction';
  if (sameDirection && Math.abs(first.speed) <= Math.abs(second.speed)) return false;
  if (applying && sameDirection && order.indexOf(first.body) >= order.indexOf(second.body)) return false;
  if (phase === 'retrograde_separating' && first.speed >= 0) return false;
  const allowedAngles = phase === 'applying_friendly_or_conjunction' ? friendlyOrBodilyAngles : directedAngles;
  return allowedAngles.some(angle => {
    const gap = signedArc(first.longitude - second.longitude - angle);
    const distance = Math.abs(gap);
    if (distance <= 1e-10 || distance > bound + 1e-10) return false;
    return applying
      ? gap * first.speed < 0 && gap * relative < 0
      : distance >= 0.1 - 1e-10 && gap * first.speed > 0 && gap * relative > 0;
  });
}

export function lillyAspect(longitudeA, longitudeB, planetA, planetB, aspect, table, tables = lillyOrbTables) {
  const orbs = tables[table];
  if (!orbs || !Object.hasOwn(orbs, planetA) || !Object.hasOwn(orbs, planetB)
    || ![longitudeA, longitudeB].every(value => Number.isFinite(value) && value >= 0 && value < 360)
    || !lillyAspectNames.includes(aspect)) return null;
  if (planetA === planetB) return aspect === 'any' ? null : false; // A shared ruler is not a second body or evidence of no relationship.
  const arc = Math.abs(longitudeA - longitudeB);
  const separation = Math.min(arc, 360 - arc);
  const bound = (orbs[planetA] + orbs[planetB]) / 2;
  const contact = angle => Math.abs(separation - angle) <= bound + 1e-10;
  // Book I p.105 names four rays, while acknowledging that conjunction is
  // commonly (improperly) called an aspect. For unqualified source 'any',
  // retain only conclusions shared by both readings. A conjunction therefore
  // proves neither an unspecified aspect nor its absence; it remains pending.
  if (aspect === 'any') {
    if ([60, 90, 120, 180].some(contact)) return true;
    return contact(0) ? null : false;
  }
  // p.106 associates friendship with sextile/trine; conjunction is not
  // automatically benefic. Partile, 'any', angles and nodes remain separate.
  return aspect === 'friendly' ? contact(60) || contact(120) : contact(lillyAspectAngles[aspect]);
}

export function lillyAspectFacts(facts, requested, fortune = null) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (!zodiacs.has('tropical')) return [];
  const values = new Map();
  for (const fact of facts.filter(fact => fact.kind === 'planet_longitude')) {
    if (!values.has(fact.planet)) values.set(fact.planet, new Set());
    values.get(fact.planet).add(fact.longitude);
  }
  const houseFacts = lillyHouseFacts(facts);
  const lords = new Map(houseFacts.filter(fact => fact.kind === 'western_lilly_house_ruler')
    .map(fact => [`house_${fact.house}_ruler`, fact.planet.toLowerCase()]));
  if (fortune && fortune.rulerHouse !== null) lords.set('fortune_ruler', fortune.ruler.toLowerCase());
  function resolve(selector) {
    const body = bodies[selector] ? selector : lords.get(selector);
    const positions = body && values.get(bodies[body]);
    return positions?.size === 1 ? { body, longitude: [...positions][0] } : null;
  }
  const consistent = position => {
    const signs = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === bodies[position.body]).map(fact => fact.sign));
    return !signs.size || signs.size === 1 && signs.has(zodiacNames[Math.floor(position.longitude / 30)]);
  };
  const observedMotion = new Map();
  function moving(selector) {
    if (observedMotion.has(selector)) return observedMotion.get(selector);
    const position = resolve(selector);
    const speeds = position && new Set(facts.filter(fact => fact.kind === 'planet_hourly_motion' && fact.planet === bodies[position.body])
      .map(fact => fact.signedDegrees));
    const speed = speeds?.size === 1 ? speeds.values().next().value : null;
    const directions = position && new Set(facts.filter(fact => fact.kind === 'planet_motion' && fact.planet === bodies[position.body]).map(fact => fact.motion));
    const direction = speed < 0 ? 'retrograde' : 'direct';
    const valid = position && speed !== null && consistent(position)
      && (!directions.size || directions.size === 1 && directions.has(direction));
    const result = valid ? { ...position, speed } : null;
    observedMotion.set(selector, result);
    return result;
  }
  function hasPhase(first, second, phase, table) {
    const a = moving(first), b = moving(second);
    return a && b && lillyAspectPhase(a, b, phase, table);
  }
  const results = new Map();
  for (const fact of requested) {
    if (fact.kind === 'western_lilly_aspect_phase') {
      if (hasPhase(fact.first, fact.second, fact.phase, fact.table)) results.set(JSON.stringify(fact), fact);
      continue;
    }
    if (fact.kind === 'western_lilly_luminary_application') {
      const qualifying = houseFacts.some(({ kind, planet, house }) => kind === 'western_lilly_planet_house'
        && houseClass(house) === fact.houseClass && hasPhase(fact.luminary, planet.toLowerCase(), 'applying', fact.table));
      if (qualifying) results.set(JSON.stringify(fact), fact);
      continue;
    }
    if (fact.kind === 'western_lilly_partile_aspect') {
      const a = resolve(fact.first), b = resolve(fact.second);
      if (zodiacs.size !== 1 || !a || !b || a.body === b.body || ![a, b].every(consistent)
        || !lillyPartileAspects.includes(fact.aspect)) continue;
      // Book I p.106 describes corresponding whole degrees. The source
      // rules requesting these facts have no separate minute requirement.
      if (lillyPartileDistance(a.longitude, b.longitude) === lillyAspectAngles[fact.aspect]) results.set(JSON.stringify(fact), fact);
      continue;
    }
    if (fact.kind !== 'western_lilly_aspect' || !isLillyAspectSelector(fact.first) || !isLillyAspectSelector(fact.second)) continue;
    const a = resolve(fact.first), b = resolve(fact.second);
    if (!a || !b) continue; // Missing or contradictory positions prove neither presence nor absence.
    if (fact.aspect === 'any') {
      if (zodiacs.size !== 1) continue;
      if (![a, b].every(consistent)) continue;
    }
    const result = lillyAspect(a.longitude, b.longitude, a.body, b.body, fact.aspect, fact.table);
    if (result === null) continue;
    const calculated = { ...fact, matches: result };
    results.set(JSON.stringify(calculated), calculated);
  }
  return [...results.values()];
}
