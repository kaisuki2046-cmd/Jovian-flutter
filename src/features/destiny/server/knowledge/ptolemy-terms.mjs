import { zodiacNames } from '../../control/charts.ts';

export const ptolemyTermProfile = 'ptolemy-robbins-1940-terms-v1';
export const ptolemyTermSystems = ['egyptian_common', 'ptolemy_manuscript', 'chaldaean'];
export const ptolemyTermBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const rulers = 'mercury venus mars jupiter saturn'.split(' ');
const symbols = { '☿': 'mercury', '♀': 'venus', '♂': 'mars', '♃': 'jupiter', '♄': 'saturn' };
const signName = value => value.toLowerCase().replace('capricornus', 'capricorn');
const widths = [8, 7, 6, 5, 4];
const capitalized = body => body[0].toUpperCase() + body.slice(1);
function fail(id, reason) { throw new Error('Invalid Ptolemy term table ' + id + ': ' + reason); }

function printedRow(claim) {
  if (claim.conditions.original.length !== 1) fail(claim.id, 'one original row required');
  const [label, ...columns] = claim.conditions.original[0].split('|').map(value => value.trim());
  const sign = signName(label);
  if (!signs.includes(sign) || columns.length !== 5) fail(claim.id, 'invalid printed row');
  let start = 0;
  const cells = columns.map(value => {
    const match = /^([☿♀♂♃♄])\s*(\d+)$/u.exec(value);
    if (!match || Number(match[2]) < 1) fail(claim.id, 'invalid printed interval');
    const end = start + Number(match[2]);
    const cell = { sign, body: symbols[match[1]], start, end };
    start = end;
    return cell;
  });
  // Some claims quote a whole earlier transcript row, while the selected last
  // Libra cell has its own explicit print correction. Validate this claim's
  // selected interval against its own row; validate the assembled table below.
  if (start !== 30) fail(claim.id, 'printed row must cover 30 degrees');
  return cells;
}

function chaldaeanCell(claim) {
  const original = claim.conditions.original;
  const match = original.length === 1 && /^(.+); (day|night); slot ([1-5]); ([☿♀♂♃♄]) ([4-8])°$/u.exec(original[0]);
  if (!match) fail(claim.id, 'invalid Chaldaean source slot');
  const group = match[1].split(',').map(value => signName(value.trim()));
  const index = Number(match[3]) - 1;
  const night = match[2] === 'night';
  const cycle = ['jupiter', 'venus', ...(night ? ['mercury', 'saturn'] : ['saturn', 'mercury']), 'mars'];
  const triads = [['aries', 'leo', 'sagittarius'], ['taurus', 'virgo', 'capricorn'], ['gemini', 'libra', 'aquarius'], ['cancer', 'scorpio', 'pisces']];
  const triad = triads.findIndex(names => JSON.stringify(names) === JSON.stringify(group));
  if (triad < 0) fail(claim.id, 'invalid Chaldaean triplicity');
  const leader = triad === 0 ? 'jupiter' : triad === 1 ? 'venus' : triad === 2 ? night ? 'mercury' : 'saturn' : 'mars';
  const order = [...cycle.slice(cycle.indexOf(leader)), ...cycle.slice(0, cycle.indexOf(leader))];
  if (symbols[match[4]] !== order[index] || Number(match[5]) !== widths[index]) fail(claim.id, 'Chaldaean prose and slot disagree');
  const start = widths.slice(0, index).reduce((sum, width) => sum + width, 0);
  return group.map(sign => ({ sign, sect: match[2], body: order[index], start, end: start + widths[index] }));
}

// Build-time source conversion only. Table records remain calculation sources,
// and are never activated as unconditional personal character/event claims.
export function compilePtolemyTermCells(claims) {
  const selected = claims.filter(claim => {
    const match = /^astro-ptolemy-v1-chapter-(20|21)-p(\d{3})-001$/u.exec(claim.id);
    return match && Number(match[2]) >= 1 && Number(match[2]) <= (match[1] === '20' ? 60 : 100);
  });
  if (!selected.length) return [];
  if (selected.length !== 160 || new Set(selected.map(claim => claim.id)).size !== 160) throw new Error('Incomplete Ptolemy term source tables.');
  const result = [];
  const sourceCounts = new Map();
  for (const claim of selected) {
    const chapter = Number(claim.id.match(/chapter-(\d+)/u)[1]);
    const number = Number(claim.id.match(/-p(\d+)/u)[1]);
    const system = chapter === 20 ? 'egyptian_common' : number <= 60 ? 'ptolemy_manuscript' : 'chaldaean';
    const body = rulers.filter(body => claim.category.tags.includes(body));
    const match = claim.conditions.match;
    if (claim.source.book !== 'Tetrabiblos' || claim.source.volume !== 'Book I' || !claim.source.edition.includes('Robbins')
      || !claim.source.edition.includes('1940') || body.length !== 1 || !claim.category.tags.includes(system)
      || claim.conditions.uncertain.length || claim.conditions.excluded.length || match?.status !== 'ready'
      || !match.include.length || match.exclude.length
      || Object.keys(match).some(key => !['version', 'status', 'include', 'exclude', 'reason'].includes(key))) fail(claim.id, 'invalid source scope');
    const originals = system === 'chaldaean' ? chaldaeanCell(claim) : printedRow(claim).map(cell => ({ ...cell, sect: 'both' }));
    const groups = new Map();
    for (const group of match.include) {
      const values = Object.fromEntries(group.map(condition => [condition.fact, condition.equals]));
      const allowed = ['chart.zodiac', 'context.ptolemy_term_system', 'profiles.ptolemy.classification.active_sign', 'profiles.ptolemy.classification.active_degree_floor_in_sign', 'chart.sect'];
      const sign = values['profiles.ptolemy.classification.active_sign'];
      const degree = values['profiles.ptolemy.classification.active_degree_floor_in_sign'];
      const sect = values['chart.sect'] ?? 'both';
      if (Object.keys(values).length !== group.length || group.some(condition => !allowed.includes(condition.fact))
        || values['chart.zodiac'] !== 'tropical' || values['context.ptolemy_term_system'] !== system || !signs.includes(sign)
        || !Number.isInteger(degree) || degree < 0 || degree >= 30
        || (system === 'chaldaean' ? !['day', 'night'].includes(sect) : sect !== 'both')) fail(claim.id, 'unsupported query condition');
      const key = sign + ':' + sect;
      if (!groups.has(key)) groups.set(key, { sign, sect, degrees: [] });
      groups.get(key).degrees.push(degree);
    }
    for (const { sign, sect, degrees } of groups.values()) {
      const start = Math.min(...degrees), end = Math.max(...degrees) + 1;
      if (degrees.length !== end - start || new Set(degrees).size !== degrees.length
        || !originals.some(cell => cell.sign === sign && cell.sect === sect && cell.body === body[0] && cell.start === start && cell.end === end)) {
        fail(claim.id, 'encoded interval differs from original row');
      }
      result.push({ sourceId: claim.id, system, sign, body: body[0], sect, start, end });
    }
    if (groups.size !== (system === 'chaldaean' ? 3 : 1)) fail(claim.id, 'missing source sign');
    sourceCounts.set(system, (sourceCounts.get(system) ?? 0) + 1);
  }
  if (sourceCounts.get('egyptian_common') !== 60 || sourceCounts.get('ptolemy_manuscript') !== 60 || sourceCounts.get('chaldaean') !== 40 || result.length !== 240) {
    throw new Error('Incomplete Ptolemy term system coverage.');
  }
  for (const system of ptolemyTermSystems) for (const sign of signs) for (const sect of system === 'chaldaean' ? ['day', 'night'] : ['both']) {
    const cells = result.filter(cell => cell.system === system && cell.sign === sign && cell.sect === sect).sort((a, b) => a.start - b.start);
    if (cells.length !== 5 || new Set(cells.map(cell => cell.body)).size !== 5 || cells[0].start !== 0 || cells.at(-1).end !== 30 || cells.some((cell, index) => index && cell.start !== cells[index - 1].end)) {
      throw new Error('Gapped or overlapping Ptolemy term system: ' + [system, sign, sect].join('/'));
    }
  }
  return result;
}

// Runtime receives SQL rows including source metadata. It does not scan JSON.
export function ptolemyTermReferences(facts, cellsAt) {
  if (!cellsAt || !Array.isArray(facts)) return [];
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const declaredSects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const knownSect = declaredSects.size === 1 ? [...declaredSects][0] : null;
  const references = [];
  for (const planet of ptolemyTermBodies) {
    const positions = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet).map(fact => fact.longitude));
    if (positions.size !== 1) continue;
    const [longitude] = positions;
    if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) continue;
    const index = Math.floor(longitude / 30);
    const declaredSigns = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === planet).map(fact => fact.sign));
    if (declaredSigns.size > 1 || declaredSigns.size === 1 && !declaredSigns.has(zodiacNames[index])) continue;
    const cells = cellsAt(signs[index], Math.floor(longitude % 30));
    for (const system of ptolemyTermSystems) {
      if (system === 'chaldaean' && declaredSects.size > 1) continue;
      const sects = system === 'chaldaean' ? knownSect ? [knownSect] : ['day', 'night'] : ['both'];
      const candidates = sects.map(sect => cells.filter(cell => cell.system === system && cell.sect === sect));
      if (candidates.some(rows => rows.length !== 1) || new Set(candidates.flat().map(cell => cell.body)).size !== 1) continue;
      const chosen = candidates.flat();
      const sources = [...new Map(chosen.map(cell => [cell.sourceId, cell.source])).entries()].map(([id, source]) => ({ id, ...source }));
      references.push({ role: 'term_ruler_lookup', profile: ptolemyTermProfile, planet, longitude, sign: zodiacNames[index],
        degree: longitude % 30, system, sect: sects.length === 2 ? 'consensus' : sects[0], ruler: capitalized(chosen[0].body),
        start: Math.max(...chosen.map(cell => cell.start)), end: Math.min(...chosen.map(cell => cell.end)), sources });
    }
  }
  return references;
}
