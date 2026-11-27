import { zodiacNames } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';

export const lillySignClassProfile = 'lilly-1647-explicit-sign-classes-v1';
export const lillySignSelectors = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'house_7_cusp', 'house_11_cusp', 'house_7_ruler', 'venus_dispositor'];
const bodies = 'Sun Moon Mercury Venus Mars Jupiter Saturn'.split(' ');
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
// Book I pp.87–90. The profession paragraph at Book III p.632 explicitly
// lists only Aries/Leo/Sagittarius for its four-footed group, unlike Book I's
// wider list. Keep that passage-specific classification distinct.
const common = [2, 5, 8, 11];
const fruitful = [3, 7, 11];
const groups = {
  movable: [0, 3, 6, 9], fixed: [1, 4, 7, 10], common,
  fruitful, fruitful_or_common: [...new Set([...fruitful, ...common])],
  fire: [0, 4, 8], earth: [1, 5, 9], air: [2, 6, 10], water: [3, 7, 11],
  tropic: [3, 9], human: [2, 5, 6, 10], profession_quadrupedal: [0, 4, 8],
};
export const lillySignClasses = [...Object.keys(groups), 'selected'];

function uniquePosition(longitudeRows, signRows) {
  const coordinates = new Set(longitudeRows.map(f => f.longitude)), labels = new Set(signRows.map(f => f.sign));
  if (coordinates.size > 1 || labels.size > 1) return null;
  if (coordinates.size === 1) {
    const [longitude] = coordinates;
    if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) return null;
    const sign = Math.floor(longitude / 30);
    return !labels.size || labels.has(zodiacNames[sign]) ? { sign, degree: Math.floor(longitude % 30), longitude } : null;
  }
  const sign = zodiacNames.indexOf([...labels][0]);
  // A confirmed sign suffices for classification and domicile identity.
  return sign >= 0 ? { sign, degree: null, longitude: null } : null;
}

export function lillyPlanetPosition(facts, planet) {
  return uniquePosition(facts.filter(f => f.kind === 'planet_longitude' && f.planet === planet),
    facts.filter(f => f.kind === 'planet_sign' && f.planet === planet));
}

export function lillySignClassFacts(facts, cellsAt) {
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const position = planet => lillyPlanetPosition(facts, planet);
  const houses = lillyHouseFacts(facts);
  const validHouses = houses.some(f => f.kind === 'western_lilly_ruleset');
  const locations = new Map(bodies.map((body, i) => [lillySignSelectors[i], position(body)]));
  for (const house of [7, 11]) locations.set(`house_${house}_cusp`, validHouses ? uniquePosition(
    facts.filter(f => f.kind === 'western_profile_cusp_longitude' && f.profile === 'regiomontanus' && f.house === house),
    facts.filter(f => f.kind === 'western_profile_house_sign' && f.profile === 'regiomontanus' && f.house === house)) : null);
  const seventhLord = houses.find(f => f.kind === 'western_lilly_house_ruler' && f.house === 7)?.planet;
  locations.set('house_7_ruler', seventhLord ? position(seventhLord) : null);
  const venus = locations.get('venus');
  // Use the unified SQLite dignity cells, not a modern co-ruler or a client
  // supplied selector. Domicile is constant throughout a sign; degree zero
  // selects that SQL cell when only the sign, rather than a degree, is known.
  const domicile = venus && cellsAt ? cellsAt(signs[venus.sign], venus.degree ?? 0)?.filter(cell => cell.dimension === 'domicile') : [];
  const dispositor = domicile?.length === 1 ? bodies.find(body => body.toLowerCase() === domicile[0].body) : null;
  locations.set('venus_dispositor', dispositor ? position(dispositor) : null);
  const results = [];
  for (const [selector, location] of locations) {
    const selected = selector === 'venus_dispositor' ? Boolean(dispositor) : Boolean(location);
    if (selected) results.push({ kind: 'western_lilly_sign_class', selector, classification: 'selected', matches: true, profile: lillySignClassProfile });
    if (!location) continue;
    for (const [classification, members] of Object.entries(groups)) results.push({ kind: 'western_lilly_sign_class', selector,
      classification, matches: members.includes(location.sign), profile: lillySignClassProfile });
  }
  return results;
}
