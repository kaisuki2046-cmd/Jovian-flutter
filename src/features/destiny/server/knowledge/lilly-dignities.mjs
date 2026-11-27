import { zodiacNames } from '../../control/charts.ts';

export const lillyDignityProfile = 'lilly-1659-p104-v1';
export const lillyDignityBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const lillyDignityNames = ['domicile', 'exaltation', 'triplicity', 'term', 'face', 'detriment', 'fall', 'peregrine'];
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const dimensions = { 庙位: 'domicile', 擢升: 'exaltation', 三分主: 'triplicity', 界: 'term', 面: 'face', 失势: 'detriment', 落陷: 'fall' };
const symbols = { sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄', north_node: '☊', south_node: '☋' };

// Build time only. The source table is computational reference data, not a
// collection of unconditional personality readings. Never drop its query scope.
export function compileLillyDignityCells(claims) {
  const table = claims.filter(claim => /^astro-lilly-v1-dignity-table-p(?:00[1-9]|0[1-9]\d|1[0-3]\d|14[0-4])-001$/u.test(claim.id));
  if (!table.length) return [];
  if (table.length !== 144 || new Set(table.map(claim => claim.id)).size !== 144) throw new Error('Incomplete Lilly p.104 source table.');
  const cells = [];
  for (const claim of table) {
    const dimension = dimensions[claim.category.tags[2]];
    const bodies = Object.keys(symbols).filter(body => claim.category.tags.includes(body));
    const body = bodies[0];
    const match = claim.conditions.match;
    if (!dimension || bodies.length !== 1 || claim.source.book !== 'Christian Astrology'
      || !claim.source.edition.includes('1659') || match.status !== 'ready' || !match.include.length || match.exclude.length
      || claim.conditions.excluded.length || !claim.conditions.original.join(' ').includes(symbols[body])) {
      throw new Error('Invalid Lilly p.104 source cell: ' + claim.id);
    }
    const groups = new Map();
    for (const group of match.include) {
      const allowed = new Set(['context.lilly_dignity_table', 'chart.zodiac', 'chart.sect', 'profiles.lilly.dignities.active_sign', 'profiles.lilly.dignities.active_degree_floor_in_sign']);
      const values = Object.fromEntries(group.map(({ fact, equals }) => [fact, equals]));
      const sign = values['profiles.lilly.dignities.active_sign'];
      const sect = values['chart.sect'] ?? 'both';
      const degree = values['profiles.lilly.dignities.active_degree_floor_in_sign'];
      if (group.some(({ fact }) => !allowed.has(fact)) || Object.keys(values).length !== group.length
        || values['context.lilly_dignity_table'] !== 'christian_astrology_book_i' || values['chart.zodiac'] !== 'tropical'
        || !signs.includes(sign) || !(dimension === 'triplicity' ? ['day', 'night'].includes(sect) : sect === 'both')
        || (['term', 'face'].includes(dimension) ? !Number.isInteger(degree) || degree < 0 || degree >= 30 : degree !== undefined)) {
        throw new Error('Unsupported Lilly p.104 cell conditions: ' + claim.id);
      }
      const key = sign + ':' + sect;
      if (!groups.has(key)) groups.set(key, { sign, sect, degrees: [] });
      groups.get(key).degrees.push(degree);
    }
    for (const { sign, sect, degrees } of groups.values()) {
      const bounded = ['term', 'face'].includes(dimension);
      const start = bounded ? Math.min(...degrees) : 0;
      const end = bounded ? Math.max(...degrees) + 1 : 30;
      if (bounded && (degrees.length !== end - start || new Set(degrees).size !== degrees.length)) throw new Error('Non-contiguous Lilly interval: ' + claim.id);
      cells.push({ sourceId: claim.id, dimension, sign, body, sect, start, end });
    }
  }
  // The complete table is needed to prove a negative. Reject gaps and overlap
  // before publishing the SQLite transaction; retain the previous valid DB.
  for (const sign of signs) for (let degree = 0; degree < 30; degree++) {
    const active = cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
    for (const dimension of Object.values(dimensions)) for (const sect of dimension === 'triplicity' ? ['day', 'night'] : ['both']) {
      const count = active.filter(cell => cell.dimension === dimension && cell.sect === sect).length;
      const optional = ['exaltation', 'fall'].includes(dimension);
      if (count > 1 || !optional && count !== 1) throw new Error('Incomplete or overlapping Lilly table: ' + [sign, degree, dimension, sect].join('/'));
    }
  }
  return cells;
}

// Runtime callback reads the active cells from SQLite, never from JSON files.
// Unknown sect is evaluated both ways and only consensus becomes a fact.
export function lillyDignityFacts(facts, cellsAt, { includeCount = false, allowSignOnly = false } = {}) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (!cellsAt || zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const declaredSects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const sects = declaredSects.size === 1 ? [...declaredSects] : ['day', 'night'];
  const results = [];
  const counts = sects.map(() => 0); let measured = 0;
  for (const planet of lillyDignityBodies) {
    const positions = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet).map(fact => fact.longitude));
    const declaredSigns = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === planet).map(fact => fact.sign));
    const signOnly = allowSignOnly && positions.size === 0 && declaredSigns.size === 1;
    if (!signOnly && positions.size !== 1) continue;
    const [longitude] = positions;
    if (!signOnly && (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360)) continue;
    const signIndex = signOnly ? zodiacNames.indexOf(declaredSigns.values().next().value) : Math.floor(longitude / 30);
    if (signIndex < 0 || declaredSigns.size > 1 || declaredSigns.size === 1 && !declaredSigns.has(zodiacNames[signIndex])) continue;
    // A sign's first table column represents sign-wide conditions only.
    const cells = cellsAt(signs[signIndex], signOnly ? 0 : Math.floor(longitude % 30));
    if (!cells?.length) continue;
    const body = planet.toLowerCase();
    const names = signOnly ? lillyDignityNames.filter(name => !['term', 'face', 'peregrine'].includes(name)) : lillyDignityNames.slice(0, -1);
    const alternatives = sects.map(sect => Object.fromEntries(names.map(name =>
      [name, cells.some(cell => cell.dimension === name && cell.body === body && (cell.sect === 'both' || cell.sect === sect))])));
    if (!signOnly) {
      for (const state of alternatives) state.peregrine = !lillyDignityNames.slice(0, 5).some(name => state[name]);
      measured++;
      alternatives.forEach((state, index) => { if (!state.peregrine) counts[index]++; });
    }
    for (const dignity of signOnly ? names : lillyDignityNames) {
      const values = new Set(alternatives.map(state => state[dignity]));
      if (values.size === 1) results.push({ kind: 'western_lilly_dignity', planet, dignity, matches: [...values][0], profile: lillyDignityProfile });
    }
  }
  // Count complete charts within each sect BEFORE intersecting individual
  // facts: different stars can exchange triplicity dignity while the total
  // remains the same. One body with several dignities still counts only once.
  if (includeCount && measured === lillyDignityBodies.length && declaredSects.size <= 1
    && sects.every(sect => ['day', 'night'].includes(sect)) && new Set(counts).size === 1) {
    results.push({ kind: 'western_lilly_dignified_count', count: counts[0], profile: lillyDignityProfile });
  }
  return results;
}
