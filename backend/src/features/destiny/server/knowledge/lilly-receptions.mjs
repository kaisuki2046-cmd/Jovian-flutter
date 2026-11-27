import { zodiacNames } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';

const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const bodies = Object.fromEntries(lillyDignityBodies.map(body => [body.toLowerCase(), body]));
const positiveDignities = ['domicile', 'exaltation', 'triplicity', 'term', 'face'];
export const lillyReceptionNames = [...positiveDignities, 'mutual', 'mutual_domicile', 'mutual_exaltation'];
export const isLillyReceptionSelector = selector => Object.hasOwn(bodies, selector)
  || /^house_(?:[1-9]|1[0-2])_ruler$/u.test(selector) || ['sun_dispositor', 'moon_dispositor'].includes(selector);

// p.112 defines mutual reception as each planet occupying a dignity of the
// other. It expressly discusses it when no aspect helps: do not invent one.
// Directed reception retains its receiver/guest order. No generic "reception"
// field is silently equated with mutual or with an applying aspect.
export function lillyReceptionFacts(facts, requested, cellsAt, { allowSignOnly = false } = {}) {
  if (!cellsAt || !facts.some(fact => fact.kind === 'western_zodiac' && fact.zodiac === 'tropical')) return [];
  const positions = new Map();
  const cells = new Map();
  const lords = new Map(lillyHouseFacts(facts).filter(fact => fact.kind === 'western_lilly_house_ruler')
    .map(fact => [`house_${fact.house}_ruler`, fact.planet.toLowerCase()]));
  const declared = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const sects = declared.size === 1 ? [...declared] : ['day', 'night'];
  function position(body) {
    if (positions.has(body)) return positions.get(body);
    const coordinates = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === bodies[body]).map(fact => fact.longitude));
    let result = null;
    if (coordinates.size === 1) {
      const [longitude] = coordinates;
      if (Number.isFinite(longitude) && longitude >= 0 && longitude < 360) {
        const sign = Math.floor(longitude / 30);
        const supplied = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === bodies[body]).map(fact => fact.sign));
        if (!supplied.size || supplied.size === 1 && supplied.has(zodiacNames[sign])) result = { sign: signs[sign], degree: Math.floor(longitude % 30) };
      }
    }
    positions.set(body, result);
    return result;
  }
  function cellsFor(body) {
    if (!cells.has(body)) {
      const p = position(body);
      cells.set(body, p ? cellsAt(p.sign, p.degree) : null);
    }
    return cells.get(body);
  }
  function signDignityCellsFor(body, dimension) {
    if (position(body)) return cellsFor(body)?.filter(cell => cell.dimension === dimension) ?? null;
    // A confirmed sign suffices for sign-wide dignities, whose owner is constant across
    // the sign. Degree zero is only a SQLite table lookup anchor, never an
    // invented planetary coordinate. Conflicting/invalid degrees cannot fall
    // back to the less precise sign and hide that contradiction.
    if (facts.some(fact => fact.kind === 'planet_longitude' && fact.planet === bodies[body])) return null;
    const declared = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === bodies[body]).map(fact => fact.sign));
    if (declared.size !== 1) return null;
    const sign = zodiacNames.indexOf([...declared][0]); if (sign < 0) return null;
    const active = cellsAt(signs[sign], 0)?.filter(cell => cell.dimension === dimension);
    return active?.length === 1 ? active : null;
  }
  function identity(selector) {
    if (Object.hasOwn(bodies, selector)) return selector;
    if (lords.has(selector)) return lords.get(selector);
    if (['sun_dispositor', 'moon_dispositor'].includes(selector)) {
      const domicile = signDignityCellsFor(selector.split('_')[0], 'domicile');
      return domicile?.length === 1 && Object.hasOwn(bodies, domicile[0].body) ? domicile[0].body : null;
    }
    return null;
  }
  const accepts = (receiver, guest, dimensions, sect) => {
    const [dimension] = dimensions;
    const active = dimensions.length === 1 && (dimension === 'domicile' || allowSignOnly && dimension === 'exaltation')
      ? signDignityCellsFor(guest, dimension) : cellsFor(guest);
    return active?.length ? active.some(cell => cell.body === receiver && dimensions.includes(cell.dimension)
      && (cell.sect === 'both' || cell.sect === sect)) : null;
  };
  const and = (a, b) => a === false || b === false ? false : a === null || b === null ? null : true;
  const results = new Map();
  for (const fact of requested) {
    if (fact.kind !== 'western_lilly_reception' || !isLillyReceptionSelector(fact.first) || !isLillyReceptionSelector(fact.second)
      || !lillyReceptionNames.includes(fact.reception) || fact.profile !== lillyDignityProfile) continue;
    const first = identity(fact.first), second = identity(fact.second);
    if (!first || !second) continue;
    const mutual = fact.reception.startsWith('mutual');
    const dimensions = fact.reception === 'mutual' ? positiveDignities : [fact.reception.replace(/^mutual_/u, '')];
    const outcomes = sects.map(sect => first === second ? false : mutual
      ? and(accepts(first, second, dimensions, sect), accepts(second, first, dimensions, sect))
      : accepts(first, second, dimensions, sect));
    if (outcomes.some(value => value === null) || new Set(outcomes).size !== 1) continue;
    const calculated = { ...fact, matches: outcomes[0] };
    results.set(JSON.stringify(calculated), calculated);
  }
  return [...results.values()];
}
