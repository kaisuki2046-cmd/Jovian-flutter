import { createHash } from 'node:crypto';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillyWitProfile = 'lilly-1647-wit-mercury-testimonies-v1';
const prefix = 'astro-lilly-v3-wit-p';
const reviewed = {
  '002': 'ccd4851c6d30706e977b47a5f064aba6f003f5210aa518dde7235adebdf9d51c',
  '009': 'cda29f11f1f8233d144bfa9f818761ad74c904804ffb13e46099fbde3fedefdc',
  '010': 'b6084f8855808894e80f95541f752af29a7d698d150a04c19ec12d7f1d3b3d50',
  '011': 'c64d5d5e4ecfa76a0fc021eb540203ea85b0baf1f7d864f889903e4bbd02a3cc',
  '012': '1a5faaad76548f85b3403127a593cbe9bce50713706cf845c27cc36339ede409',
  '013': '77f2565ca468e84cbb631375fab70f1fa1b43748462df7c4dada5b08f069dfd1',
  '014': '47faf7c012bac48d102f850caff911b429cad8c5764edc917e4d7f0a243af296',
  '015': '566ad03e0b65261b7a26eb93a2e5d082a595143d52b23757d48d2f65bec04c90',
  '018': 'e4c31965b93b44742d927de4acbd787b800dd009c718665e66cb85e7c07cfc3b',
  '019': 'ac321f94803b474c16abf030c091827c8fae3a0ef0912f753595f3cbd4db265a',
  '020': 'b7e1a870bd999a6e2e9a0f9165dc888ac1efa16a6f8707d9333b00092db30e31',
  '021': '970f76d7e5c824bf4c5e24bc9583b9f473f9d83007f26a7ec2babd9919cc9ee4',
  '025': '261662d8c9bbef0af1bb87bebf0365cf3933fac72703e57a28b49acdeccc18fb',
  '026': '1e3036085c2cb077aeb69a50c6b2ec127dc4c97a682fb888bb0f725b627311af',
  '029': '71d83b1d13433182f2fd15a6af1e2dc5c6976e173a2335f9d2ad1176cd367fcf',
  '044': 'f96d6ac9d5cbba0ab814f01f432860ffb65021987ecdbab545bc0a8ecaab9c03',
};
const sourceKey = id => typeof id === 'string' && id.startsWith(prefix) && id.endsWith('-001')
  ? id.slice(prefix.length, -4) : '';
export const isLillyWitSource = claim => Object.hasOwn(reviewed, sourceKey(claim.id));
export function lillyWitSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify([source, conditions, evidence])).digest('hex');
  return reviewed[sourceKey(id)] === digest;
}

const wit = 'profiles.lilly.wit.';
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const others = bodies.filter(body => body !== 'Mercury').map(body => body.toLowerCase());
const selectors = {
  mercury_at_ascendant_cusp: 'mercury_at_ascendant_cusp',
  majority_of_planets_in_air_signs: 'majority_air',
  moon_conjoins_either_node: 'moon_conjoins_node',
  mercury_below_horizon: 'mercury_below_horizon',
  mercury_above_horizon: 'mercury_above_horizon',
};
const positions = {
  'profiles.lilly.positions.mercury.angular': 'mercury_angular',
  'profiles.lilly.positions.mercury.cadent': 'mercury_cadent',
};
const malefics = ['Mars', 'Saturn'];
const partile = body => 'mercury_partile_' + body.toLowerCase();
export const lillyWitSelectors = new Set([...Object.values(selectors), ...Object.values(positions), ...malefics.map(partile)]);
const witFact = selector => ({ kind: 'western_lilly_wit', selector });

export function lillyWitCondition(fact, equals, aspectTable) {
  if (equals !== true) return null;
  if (fact === 'profiles.lilly.applications.mercury.mars') {
    return { kind: 'western_lilly_aspect_phase', table: aspectTable, first: 'mercury', second: 'mars', phase: 'applying' };
  }
  if (Object.hasOwn(positions, fact)) return witFact(positions[fact]);
  if (!fact.startsWith(wit)) return null;
  const path = fact.slice(wit.length);
  if (Object.hasOwn(selectors, path)) return witFact(selectors[path]);
  const body = malefics.find(body => path === 'mercury_receives_partile_affliction_from.' + body.toLowerCase());
  return body ? witFact(partile(body)) : null;
}

export function lillyWitAlternatives({ fact, equals }) {
  if (!fact.startsWith(wit)) return null;
  const path = fact.slice(wit.length);
  const atom = (fact, equals = true) => ({ fact: 'profiles.lilly.' + fact, equals });
  if (path === 'mercury_aspects_any_planet' && equals === false) {
    return [others.map(body => atom(`aspects.mercury.${body}.any`, false))];
  }
  if (path === 'mercury_in_air_sign' && equals === true) return [[atom('sign_classes.mercury.air')]];
  if (path === 'mercury_swift' && equals === true) return [[atom('positions.mercury.swift')]];
  const mixed = others.find(body => path === 'mercury_mix.' + body);
  return mixed && equals === true ? [[atom(`aspects.mercury.${mixed}.conjunction`)]] : null;
}

const wrapped = longitude => ((longitude % 360) + 360) % 360;
const angular = [1, 4, 7, 10], cadent = [3, 6, 9, 12];
const air = [2, 6, 10];

export function lillyWitFacts(facts, houses) {
  if (!facts.some(fact => fact.kind === 'western_zodiac' && fact.zodiac === 'tropical')) return [];
  const planets = new Map(bodies.map(body => [body, lillyPlanetPosition(facts, body)]));
  const witnesses = [];
  const longitude = planets.get('Mercury')?.longitude;
  const mercuryHouse = houses.find(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === 'Mercury')?.house;
  if (Number.isFinite(longitude) && angular.includes(mercuryHouse)) witnesses.push('mercury_angular');
  if (Number.isFinite(longitude) && cadent.includes(mercuryHouse)) witnesses.push('mercury_cadent');

  if ([...planets.values()].filter(planet => air.includes(planet?.sign)).length > bodies.length / 2) witnesses.push('majority_air');

  const cusps = lillyCusps(facts);
  const ascendant = cusps?.[0];
  if (Number.isFinite(longitude) && Number.isFinite(ascendant)) {
    const arc = wrapped(longitude - ascendant);
    // The ecliptic chart uses the unshifted
    // ascendant–descendant line. The five-degree house attribution is separate.
    if (Math.abs(wrapped(cusps[6] - ascendant) - 180) <= 1e-9
      && Math.min(arc, Math.abs(180 - arc), 360 - arc) > 1e-9) {
      witnesses.push(arc < 180 ? 'mercury_below_horizon' : 'mercury_above_horizon');
    }
    if (Math.floor(longitude) === Math.floor(ascendant)) witnesses.push('mercury_at_ascendant_cusp');
  }

  const moon = planets.get('Moon')?.longitude;
  if (Number.isFinite(moon) && lillyNodeLongitudes(facts).some(node => Math.floor(node.longitude) === Math.floor(moon))) {
    witnesses.push('moon_conjoins_node');
  }

  if (Number.isFinite(longitude)) {
    // Book I p.106 describes partile aspects at corresponding degrees.
    // Require the actual zodiac degree for the hard aspect/contact.
    for (const body of malefics) {
      const position = planets.get(body)?.longitude;
      if (Number.isFinite(position) && wrapped(Math.floor(position) - Math.floor(longitude)) % 90 === 0) {
        witnesses.push(partile(body));
      }
    }
  }
  return witnesses.map(witFact);
}
