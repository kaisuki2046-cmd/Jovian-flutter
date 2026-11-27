import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { westernFixedStarNames, westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { lillyDignityBodies, lillyDignityFacts, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyReceptionFacts } from './lilly-receptions.mjs';
import { lillyMotionFacts, lillySolarFacts } from './lilly-solar-motion.mjs';

export const lillyFortitudeProfile = 'lilly-1659-p115-v1';
const prefix = 'astro-lilly-v1-strength-table-p';
const path = 'profiles.lilly.dignities.';
const dignityFields = {
  domicile: 'own_domicile', exaltation: 'own_exaltation', triplicity: 'own_triplicity_under_sect',
  term: 'own_term', face: 'own_face', detriment: 'in_detriment', fall: 'in_fall', peregrine: 'peregrine_under_p112',
};
const contacts = {
  jupiter: { conjunction: 0, sextile: 60, trine: 120 }, venus: { conjunction: 0, sextile: 60, trine: 120 },
  saturn: { conjunction: 0, square: 90, opposition: 180 }, mars: { conjunction: 0, square: 90, opposition: 180 },
  north_node: { conjunction: 0 }, south_node: { conjunction: 0 },
};

// These are score-table rows, and must never become unconditional natal claims.
export function compileLillyFortitudeRows(claims) {
  const table = claims.filter(({ id }) => id.startsWith(prefix) && /^(?:00[1-9]|0[1-3]\d|04[01])-001$/u.test(id.slice(prefix.length)))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!table.length) return new Map();
  if (table.length !== 41 || new Set(table.map(row => row.id)).size !== 41) throw new Error('Incomplete Lilly p.115 source rows.');
  const canonical = table.map(({ id, title, category, source, evidence, conditions, interpretation }) =>
    ({ id, title, category, source, evidence, conditions, interpretation }));
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  if (digest !== '1323d546dad2850fcd4c54007b5879fc6f558bc4d88e7ab0342dfd0c85978cc6') throw new Error('Review changed Lilly p.115 source rows.');
  return new Map(table.map(claim => [claim.id, {
    role: 'fortitude_table', profile: lillyFortitudeProfile,
    points: Number(claim.category.tags.find(tag => /^points:[+-]\d+$/u.test(tag)).slice(7)),
    label: claim.title.replace(/^莉莉 p\. 115 的/u, '').replace(/[加扣]\d+分$/u, ''),
    checks: claim.conditions.match.include.map(group => group.map(({ fact, equals }) => [fact, equals])),
  }]));
}

function singleValue(facts, kind, planet, key) {
  const values = new Set(facts.filter(fact => fact.kind === kind && fact.planet === planet).map(fact => fact[key]));
  return values.size === 1 ? values.values().next().value : undefined;
}

function fixedStarLongitudes(facts) {
  const catalogFacts = facts.filter(fact => fact.kind === 'western_fixed_star_longitude' && fact.profile === westernFixedStarProfile);
  return Object.keys(westernFixedStarNames).flatMap(star => {
    const positions = new Set(catalogFacts.filter(fact => fact.star === star).map(fact => fact.longitude));
    const [longitude] = positions;
    return positions.size === 1 && Number.isFinite(longitude) && longitude >= 0 && longitude < 360 ? [[star, longitude]] : [];
  });
}

const scoreKey = key => path + 'score.' + key;

function fortitudeStates(facts, cellsAt, { allowSignOnly }) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return new Map();
  const planets = lillyDignityBodies.map(planet => [planet.toLowerCase(), planet]);
  const longitudes = new Map(lillyNodeLongitudes(facts).map(({ node, longitude }) => [node, longitude]));
  const states = new Map();
  for (const [name, planet] of planets) {
    const longitude = singleValue(facts, 'planet_longitude', planet, 'longitude');
    const sign = singleValue(facts, 'planet_sign', planet, 'sign');
    const hasLongitude = facts.some(fact => fact.kind === 'planet_longitude' && fact.planet === planet);
    const hasSign = facts.some(fact => fact.kind === 'planet_sign' && fact.planet === planet);
    if (hasLongitude) {
      if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360
        || hasSign && sign !== zodiacNames[Math.floor(longitude / 30)]) continue;
      longitudes.set(name, longitude);
    } else if (!allowSignOnly || !zodiacNames.includes(sign)) continue;
    states.set(name, new Map([
      ['context.lilly_dignity_table', 'christian_astrology_book_i'], [path + 'active_planet', name],
    ]));
  }
  const put = (planet, key, value) => states.get(planet)?.set(scoreKey(key), value);
  const positions = new Map();
  const cachedCells = (sign, degree) => {
    const key = sign + ':' + degree;
    if (!positions.has(key)) positions.set(key, cellsAt(sign, degree));
    return positions.get(key);
  };
  for (const { planet, dignity, matches } of lillyDignityFacts(facts, cachedCells, { allowSignOnly })) {
    put(planet.toLowerCase(), dignityFields[dignity], matches);
  }
  const receptions = [...states.keys()].flatMap(first => [...states.keys()].filter(second => first < second)
    .flatMap(second => ['mutual_domicile', 'mutual_exaltation'].map(reception =>
      ({ kind: 'western_lilly_reception', first, second, reception, profile: lillyDignityProfile }))));
  const calculatedReceptions = lillyReceptionFacts(facts, receptions, cachedCells, { allowSignOnly });
  for (const { first, second, reception, matches } of calculatedReceptions) {
    if (!matches) continue;
    const condition = reception === 'mutual_domicile' ? 'mutual_reception_by_domicile' : 'reception_by_exaltation';
    put(first, condition, true);
    put(second, condition, true);
  }
  for (const name of states.keys()) for (const [reception, condition] of [
    ['mutual_domicile', 'mutual_reception_by_domicile'], ['mutual_exaltation', 'reception_by_exaltation'],
  ]) {
    const contacts = calculatedReceptions.filter(fact => fact.reception === reception && [fact.first, fact.second].includes(name));
    if (contacts.length === planets.length - 1) put(name, condition, contacts.some(fact => fact.matches));
  }
  for (const { kind, planet, house } of lillyHouseFacts(facts)) if (kind === 'western_lilly_planet_house') {
    states.get(planet.toLowerCase())?.set('chart.house_system', 'regiomontanus');
    put(planet.toLowerCase(), 'active_planet_house', house);
  }
  for (const [name, planet] of planets) {
    const motion = singleValue(facts, 'planet_motion', planet, 'motion');
    if (['direct', 'retrograde', 'stationary'].includes(motion)) put(name, 'motion', motion);
  }
  const speeds = lillyMotionFacts(facts);
  for (const { selector, condition, matches } of speeds) {
    if (matches) put(selector, 'speed_category', condition);
  }
  const solar = lillySolarFacts(facts).filter(({ selector, matches }) => states.has(selector) && matches);
  const fixedStars = fixedStarLongitudes(facts);
  for (const name of states.keys()) {
    const conditions = new Set(solar.filter(fact => fact.selector === name).map(fact => fact.condition));
    const proximity = ['cazimi', 'combust', 'under_beams', 'free_of_beams'].find(condition => conditions.has(condition));
    if (proximity) put(name, 'solar_proximity', proximity);
    if (name === 'sun') put(name, 'solar_proximity', 'not_applicable');
    if (speeds.some(fact => fact.selector === name) && !speeds.some(fact => fact.selector === name && fact.matches)) {
      put(name, 'speed_category', 'mean');
    }
    const orientation = ['oriental', 'occidental'].find(condition => conditions.has(condition));
    if (orientation) {
      put(name, 'relation_to_sun', orientation);
      if (name === 'moon') {
        put(name, 'moon_increasing_light', orientation === 'occidental');
        put(name, 'moon_decreasing_light', orientation === 'oriental');
      }
    }
    const longitude = longitudes.get(name);
    if (longitude === undefined) continue;
    for (const [star, starLongitude] of fixedStars) {
      const arc = Math.abs(longitude - starLongitude);
      const matches = star === 'caput_algol' ? Math.min(arc, 360 - arc) <= 5
        : Math.floor(longitude * 60) === Math.floor(starLongitude * 60);
      put(name, `fixed_stars.${star}.satisfies_table_contact`, matches);
    }
    for (const [other, angles] of Object.entries(contacts)) {
      if (other === name) {
        for (const aspect of Object.keys(angles)) put(name, `active_partile_aspects.${other}.${aspect}`, false);
        continue;
      }
      if (!longitudes.has(other)) continue;
      // pp.106 and 108 give the same degree and minute as the exact contact.
      const arc = Math.abs(Math.floor(longitude * 60) - Math.floor(longitudes.get(other) * 60));
      const separation = Math.min(arc, 360 * 60 - arc);
      for (const [aspect, angle] of Object.entries(angles)) put(name, `active_partile_aspects.${other}.${aspect}`, separation === angle * 60);
    }
    const mars = longitudes.get('mars'), saturn = longitudes.get('saturn');
    if (Number.isFinite(mars) && Number.isFinite(saturn)) put(name, 'besieged_by_saturn_and_mars',
      Math.floor(mars / 30) === Math.floor(saturn / 30) && longitude > Math.min(mars, saturn) && longitude < Math.max(mars, saturn));
  }
  return states;
}

export function lillyFortitudeReferences(facts, cellsAt, rows) {
  if (!rows.length) return [];
  const states = fortitudeStates(facts, cellsAt, { allowSignOnly: true });
  return lillyDignityBodies.flatMap(planet => {
    const state = states.get(planet.toLowerCase());
    if (!state) return [];
    const factors = rows.filter(row => row.checks.some(group => group.every(([key, value]) => state.get(key) === value)))
      .map(({ checks, ...row }) => row);
    return factors.length ? [{ role: 'fortitude_lookup', profile: lillyFortitudeProfile, planet, factors }] : [];
  });
}

export function lillyFortitudeRanges(facts, cellsAt, rows) {
  if (rows.length !== 41 || !cellsAt) return new Map();
  const states = fortitudeStates(facts, cellsAt, { allowSignOnly: false });
  return new Map(lillyDignityBodies.flatMap(planet => {
    const state = states.get(planet.toLowerCase());
    if (!state) return [];
    let min = 0, max = 0;
    const confirmedFactors = [];
    const unresolvedSources = [];
    for (const { checks, points, sourceId } of rows) {
      if (checks.some(group => group.every(([key, expected]) => state.get(key) === expected))) {
        min += points;
        max += points;
        confirmedFactors.push({ points, sourceId });
      } else if (checks.some(group => group.every(([key, expected]) => !state.has(key) || state.get(key) === expected))) {
        min += Math.min(0, points);
        max += Math.max(0, points);
        unresolvedSources.push(sourceId);
      }
    }
    return [[planet, { min, max, confirmedFactors, unresolvedSources }]];
  }));
}
