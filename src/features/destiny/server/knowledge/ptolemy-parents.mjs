import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';

export const ptolemyParentsProfile = 'ptolemy-iii-parents-v1';
export const ptolemyParentTexts = ['hubner_greek', 'allacci_latin'];
const reviewedSources = new Map([
  ['astro-ptolemy-v3-parents-p001-001', 'adbee3e0807f491fd59c165fe200bc6c4bc54600fefb655d2e362ac7f5b0d1a5'],
  ['astro-ptolemy-v3-parents-p002-001', '98dcac3099987f16f76feb041f4d0cb7de37da5bab2a7bee76939c6b6df4261d'],
  ['astro-ptolemy-v3-parents-p008-001', 'dc971c1056b7752aa4469afdc0bc27b122e7dd2b34a4b6a39f2954964ff29f96'],
  ['astro-ptolemy-v3-parents-p009-001', '2fb7b6229fcdb5a1e8d4584e1d52394c16376d21bdc5370ce2607713099da482'],
  ['astro-ptolemy-v3-parents-p024-001', 'de65fd1b3c3cee8ce04635df28e9b187f223237050182212669b7e8ac3aa10f7'],
]);
export const isPtolemyParentsSource = claim => reviewedSources.has(claim.id);
export function ptolemyParentsSourceMatches(claim) {
  const { source, conditions, evidence } = claim;
  return createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex') === reviewedSources.get(claim.id);
}

const prefix = 'profiles.ptolemy.parents.';
const lights = ['Sun', 'Moon'];
const positions = ['same_sign', 'next_following_sign'];
const focusBySect = {
  day: { father: 'Sun', mother: 'Venus' },
  night: { father: 'Saturn', mother: 'Moon' },
};
const planetSects = { Sun: 'day', Moon: 'night', Jupiter: 'day', Venus: 'night', Saturn: 'day', Mars: 'night' };
const benefics = new Set(['Jupiter', 'Venus']);
const companions = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const activeParents = ['father', 'mother'];
const activeBodies = ['sun', 'saturn', 'venus', 'moon'];
const attendanceSelectors = lights.flatMap(light => ['benefic', 'same_sect'].flatMap(role =>
  positions.map(position => `attendance.${light.toLowerCase()}.${role}_${position}`)));
export const ptolemyParentSelectors = new Set([
  ...ptolemyParentTexts, ...attendanceSelectors, 'attendance.in_sect_beneficial',
  ...activeParents.map(parent => `active_parent.${parent}`),
  ...activeBodies.map(body => `active_luminary_or_planet.${body}`),
]);
const parentFact = selector => ({ kind: 'western_ptolemy_parent', selector });

export function ptolemyParentsCondition(fact, equals) {
  if (fact === 'context.ptolemy_parent_attendance_text' && ptolemyParentTexts.includes(equals)) return parentFact(equals);
  if (!fact.startsWith(prefix)) return null;
  const key = fact.slice(prefix.length);
  const selector = key.startsWith('attendance.') ? key : `${key}.${equals}`;
  if (key.startsWith('attendance.') && equals !== true) return null;
  return ptolemyParentSelectors.has(selector) ? parentFact(selector) : null;
}

function longitudeOf(facts, planet) {
  const values = new Set(facts.filter(f => f.kind === 'planet_longitude' && f.planet === planet).map(f => f.longitude));
  const signs = new Set(facts.filter(f => f.kind === 'planet_sign' && f.planet === planet).map(f => f.sign));
  const [value] = values;
  if (values.size !== 1 || !Number.isFinite(value) || value < 0 || value >= 360
    || signs.size > 1 || signs.size === 1 && !signs.has(zodiacNames[Math.floor(value / 30)])) return null;
  return value;
}

export function ptolemyParentsFacts(facts, attendanceText = 'hubner_greek') {
  const zodiac = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiac.size !== 1 || !zodiac.has('tropical') || !ptolemyParentTexts.includes(attendanceText)) return [];
  const longitudes = new Map([...lights, ...companions].map(planet => [planet, longitudeOf(facts, planet)]));
  const sects = new Set(facts.filter(f => f.kind === 'western_sect').map(f => f.sect));
  const [sect] = sects;
  const matches = new Set();
  if (sects.size === 1 && Object.hasOwn(focusBySect, sect)) {
    for (const [parent, planet] of Object.entries(focusBySect[sect])) {
      if (longitudes.get(planet) === null) continue;
      matches.add(`active_parent.${parent}`);
      matches.add(`active_luminary_or_planet.${planet.toLowerCase()}`);
    }
  }
  if (lights.some(light => longitudes.get(light) === null)) return [...matches].map(parentFact);

  matches.add(attendanceText);
  const sun = longitudes.get('Sun'), mercury = longitudes.get('Mercury');
  // Book I assigns Mercury by morning/evening phase. The signed short
  // ecliptic arc to the Sun supplies phase, with no assignment at conjunction.
  const mercuryArc = mercury === null ? 0 : (mercury - sun + 540) % 360 - 180;
  const mercurySect = mercuryArc === 0 || mercuryArc === -180 ? null : mercuryArc < 0 ? 'day' : 'night';
  const doublyQualified = new Set();
  for (const light of lights) {
    const anchorSign = Math.floor(longitudes.get(light) / 30);
    const slot = `attendance.${light.toLowerCase()}`;
    for (const planet of companions) {
      const longitude = longitudes.get(planet);
      if (longitude === null) continue;
      const position = positions[(Math.floor(longitude / 30) - anchorSign + 12) % 12];
      if (!position) continue;
      const benefic = benefics.has(planet);
      const sameSect = (planet === 'Mercury' ? mercurySect : planetSects[planet]) === planetSects[light];
      if (benefic) matches.add(`${slot}.benefic_${position}`);
      if (sameSect) matches.add(`${slot}.same_sect_${position}`);
      if (benefic && sameSect) doublyQualified.add(light);
    }
  }
  if (attendanceText === 'hubner_greek' && doublyQualified.size === lights.length) {
    matches.add('attendance.in_sect_beneficial');
  }
  return [...matches].map(parentFact);
}
