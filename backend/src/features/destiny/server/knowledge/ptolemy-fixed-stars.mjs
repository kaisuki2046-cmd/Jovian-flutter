import { createHash } from 'node:crypto';
import { westernFixedStarNames, westernFixedStarProfile, westernGeometryPlanets } from '../../control/western-fixed-stars.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const ptolemyFixedStarProfile = 'ptolemy-robbins-1940-i9-fixed-stars-v1';
const limit = 1;
const angles = ['ascendant', 'mc'];
const entries = new Map([
  [7, ['b8595ab262c8a6e21496ad0af9a4bdc12b5f8af04dee692b6555418a6d787e62', ['oculus_taurus']]],
  [13, ['311f8df09b768a87c6cd31359908fb2a152e64dd0ff65ec96dbedf733e30e1b9', ['hercules']]],
  [20, ['1cc24768009d0f4dc2103f4c52c735c3086c8e51ad6ed47610406991ba0d67d9', ['cor_leonis']]],
  [26, ['f6bcc1a1e7ce2cf52f9d2862d8c3a75990a83b6937d1adbe0d362d776754e1e8', ['spica_virgo']]],
  [31, ['779dc54e07a8a5bf50ecc6a70b17ec84df700290d743fcf4f3b3387d510ec9d2', ['cor_scorpii']]],
  [60, ['2b47fc5f6a812d8265685654a7b64292e9e9cdfd04ef7474816560f109a5fa3e', ['arcturus']]],
  [68, ['366c2fc9c1be6257b2281ec4c6ba0bd4ec26a588c52231733d71140f807f23e0', ['capella']]],
  [79, ['b1b7d29719702ed3898862ad246e1988fd193817e9b303790dcad94f29d88a54', ['betelgeuse']]],
  [84, ['83110bd4cd543742b9b0aea77fe2ec082c3e3ff94b85bec2a6e315749d8b2db2', ['sirius']]],
  [86, ['fc193bdabe50f3adac7f37fdffdd6ef13ec98c9d1df5923ea408347afe768176', ['procyon']]],
]);
const stars = new Set([...entries.values()].flatMap(([, members]) => members));
const selected = star => ({ kind: 'western_ptolemy_fixed_star_selected', star });
const contact = (star, target, distance) => ({ kind: 'western_ptolemy_fixed_star_contact', star, target, distance });

export function isPtolemyFixedStarFact(fact) {
  if (!Object.hasOwn(westernFixedStarNames, fact.star) || !stars.has(fact.star)) return false;
  if (fact.kind === 'western_ptolemy_fixed_star_selected') return true;
  return fact.kind === 'western_ptolemy_fixed_star_contact' && [...westernGeometryPlanets, ...angles].includes(fact.target)
    && Number.isFinite(fact.distance) && fact.distance >= 0 && fact.distance <= limit;
}

export function compilePtolemyFixedStars(claim) {
  const number = Number(/^astro-ptolemy-v1-chapter-9-p(\d{3})-001$/u.exec(claim.id)?.[1]);
  const spec = entries.get(number);
  if (!spec) return undefined;
  const [expected, members] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: '《四书》恒星段的出处、条文或条件有变，须重新核对。' };
  const inputs = members.map(star => normalizeRuleInput('western', { required: [selected(star), { kind: 'western_zodiac', zodiac: 'tropical' }] }));
  return { compiler: ptolemyFixedStarProfile, inputs, matchScope: 'historical_aphorism', remainingAlternatives: 1 };
}

function fixedStarWitnesses(facts) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return new Map();
  const targets = [
    ...westernGeometryPlanets.map(planet => ({ target: planet, longitude: lillyPlanetPosition(facts, planet)?.longitude,
      kind: 'planet_longitude' })),
    ...angles.map(angle => ({ target: angle, longitude: easternOrCulminatingLongitude(facts, angle),
      kind: angle === 'ascendant' ? 'western_geometry_ascendant' : 'western_geometry_midheaven' })),
  ].filter(({ longitude }) => Number.isFinite(longitude));
  const coordinates = facts.filter(fact => fact.kind === 'western_fixed_star_longitude' && fact.profile === westernFixedStarProfile);
  const witnesses = new Map();
  for (const star of stars) {
    const distinct = new Set(coordinates.filter(fact => fact.star === star).map(fact => fact.longitude));
    const [longitude] = distinct;
    if (distinct.size !== 1 || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) continue;
    const contacts = targets.flatMap(({ target, longitude: position, kind }) => {
      const gap = Math.abs(position - longitude), distance = Math.min(gap, 360 - gap);
      if (distance > limit) return [];
      return [contact(star, target, distance), { kind, ...(kind === 'planet_longitude' && { planet: target }), longitude: position }];
    });
    if (contacts.length) {
      witnesses.set(star, [{ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star, longitude }, ...contacts]);
    }
  }
  return witnesses;
}

export function ptolemyFixedStarFacts(facts) {
  return [...fixedStarWitnesses(facts).keys()].map(selected);
}

export function ptolemyFixedStarProof(conditions, facts) {
  const witnesses = fixedStarWitnesses(facts);
  const proof = [conditions.required, ...conditions.alternatives].flat()
    .filter(fact => fact.kind === 'western_ptolemy_fixed_star_selected').flatMap(({ star }) => witnesses.get(star) ?? []);
  return { ...conditions, required: [...new Map([...conditions.required, ...proof].map(fact => [JSON.stringify(fact), fact])).values()] };
}
