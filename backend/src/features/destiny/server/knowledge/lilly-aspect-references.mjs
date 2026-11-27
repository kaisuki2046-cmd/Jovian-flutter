import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyAspect, lillyAspectAngles, lillyAspectPhase, lillyOrbTables } from './lilly-aspects.mjs';

export const lillyAspectReferenceProfile = 'lilly-1647-aspect-sources-v1';
const prefix = 'astro-lilly-v1-aspects-p';
const tableNames = { first_column: 'main', alternate_column: 'other' };
const planetNames = { Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn' };
const methodNames = { '017': 'platic', '019': 'both_direct', '021': 'opposite_motion' };
const reviewed = new Map([
  ['003', 'fed3d11c32c12e81efe252510a67909843aea1377f1f248d6187a4e5587b7947'],
  ['004', '8c20c154e2a6e7abe0b89c38cbb1ab53c23ed812da166255611c53884327bb91'],
  ['005', 'd00905072883e93ef75034cbfbe7094c52e05ee288692ac315f4e630703b21a8'],
  ['006', '5eac8181a58b61769088846de068a1405d5c6bc9b90e3a7487d6d12fa7245db9'],
  ['007', 'c698127d4b35ed67d9719b190a5031507bf45028713e908ad48fc77baad276da'],
  ['008', '64ee990b842bb08a0d15cfb2c35f24c63d769fafd6a9aca233804c2dd22b4757'],
  ['009', '59c6e17ee4f58d878141edbb26cbca5a33cab7f47e27b4bbc590fd2014bba2c6'],
  ['010', 'c19b33a7e03d99d3b8bd3d6e676d58fceeb353ad0d31d9fd4957f664a09fea13'],
  ['011', '086f1712f5ff97a7eec4442781eba5e16a2982e2cfd324973e37a77293a1ff4c'],
  ['012', '864d4bfc3699b7afc3f447ed83a438568914f60dc7a0dc2fc5e7c590e15671b9'],
  ['013', 'bda2a609e9a8f2e6b847cbb8752177babe113606b06b99a8bae8fd360c9f06e4'],
  ['014', '78c782eddcc8b8c566fe618dd13a753271559528c69b4ad22c44fc8f5839f6bc'],
  ['015', '67a69d7e933e4c9f7651410d6155315e94695421e124c99deaa676113c6fd18e'],
  ['016', '916ac6b1a0cb56963a2a488b583f37d8b906468a40f07d525c53577ceff1bf44'],
  ['017', '44fb09033b47737d1262f85f58bc615b8161b5a3f84841334442810ae4b92474'],
  ['019', '5580391e465740513fb90c2bdd71046f1f24cbf49a922c05d1b7b70c408167a9'],
  ['021', 'b28758b7af0335f07a3abfa6ca20d318d41c5c0d6eb13bc699c3e5f6b9c1767e'],
]);

export function compileLillyAspectReferences(claims) {
  const selected = claims.filter(claim => claim.id.startsWith(prefix) && reviewed.has(claim.id.slice(prefix.length, -4)));
  if (!selected.length) return new Map();
  if (selected.length !== reviewed.size) throw new Error('Incomplete Lilly aspect reference sources.');

  return new Map(selected.map(claim => {
    const id = claim.id.slice(prefix.length, -4);
    const { source, conditions, evidence } = claim;
    const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
    if (hash !== reviewed.get(id)) throw new Error('Review Lilly aspect reference ' + claim.id);
    const reference = { profile: lillyAspectReferenceProfile, cells: 1 };
    if (Object.hasOwn(methodNames, id)) {
      return [claim.id, { ...reference, role: 'aspect_method', method: methodNames[id] }];
    }
    const group = conditions.match.include[0];
    const fields = Object.fromEntries(group.map(({ fact, equals }) => [fact, equals]));
    const planet = fields['profiles.lilly.aspect_method.active_orb_planet'];
    const table = tableNames[fields['context.lilly_orb_table_column']];
    const line = evidence.original_text.match(/^([A-Z]+) (\d+) (\d+) [a-z ]+ (\d+) (\d+)$/u);
    if (!table || !line || line[1].toLowerCase() !== planet) throw new Error('Invalid Lilly orb row ' + claim.id);
    const [degrees, minutes] = line.slice(table === 'main' ? 2 : 4, table === 'main' ? 4 : 6).map(Number);
    const arcminutes = 60 * degrees + minutes;
    if (minutes >= 60 || arcminutes !== lillyOrbTables[table][planet] * 60) {
      throw new Error('Lilly orb row differs from reviewed calculation ' + claim.id);
    }
    return [claim.id, { ...reference, role: 'aspect_orb_table', table, planet, arcminutes }];
  }));
}

function confirmedPlanet(facts, planet, body) {
  const values = kind => facts.filter(fact => fact.kind === kind && fact.planet === planet);
  const longitudes = new Set(values('planet_longitude').map(fact => fact.longitude));
  const signs = new Set(values('planet_sign').map(fact => fact.sign));
  const [longitude] = longitudes;
  const sign = Math.floor(longitude / 30);
  if (longitudes.size !== 1 || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360
    || signs.size > 1 || (signs.size && !signs.has(zodiacNames[sign]))) return null;

  const changes = new Set(values('planet_hourly_motion').map(fact => fact.signedDegrees));
  const motions = new Set(values('planet_motion').map(fact => fact.motion));
  const [change] = changes;
  const direction = change < 0 ? 'retrograde' : 'direct';
  const speed = changes.size === 1 && Number.isFinite(change) && Math.abs(change) >= 1e-7 && Math.abs(change) <= 1
    && (!motions.size || motions.size === 1 && motions.has(direction)) ? change : null;
  return { planet, body, longitude, sign, speed };
}

const circleDistance = (first, second, turns) => {
  const distance = Math.abs(first - second);
  return Math.min(distance, turns - distance);
};

function applyingMethod(first, second, aspect, table, orbs) {
  if (first.speed === null || second.speed === null) return null;
  if (first.speed > 0 && second.speed > 0
    && (lillyAspectPhase(first, second, 'applying', table, orbs) || lillyAspectPhase(second, first, 'applying', table, orbs))) {
    return 'both_direct';
  }
  if (aspect !== 'conjunction') return null;
  const [direct, retrograde] = first.speed > 0 ? [first, second] : [second, first];
  return direct.speed > 0 && retrograde.speed < 0 && direct.longitude < retrograde.longitude
    && lillyAspectPhase(direct, retrograde, 'applying', table, orbs) ? 'opposite_motion' : null;
}

export function lillyAspectReferences(facts, rows) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical') || !rows.length) return [];

  const orbRows = { main: new Map(), other: new Map() };
  const methods = new Map();
  for (const row of rows) {
    if (row.role === 'aspect_orb_table') orbRows[row.table].set(row.planet, row);
    else methods.set(row.method, row);
  }
  const tables = Object.keys(orbRows);
  if (!tables.every(table => orbRows[table].size === Object.keys(planetNames).length) || methods.size !== 3) return [];
  const orbs = Object.fromEntries(tables.map(table => [table,
    Object.fromEntries([...orbRows[table]].map(([planet, row]) => [planet, row.arcminutes / 60]))]));
  const planets = Object.entries(planetNames).map(([planet, body]) => confirmedPlanet(facts, planet, body)).filter(Boolean);

  return planets.flatMap((first, index) => planets.slice(index + 1).flatMap(second => {
    // The aspect must have the corresponding sign geometry in Book I p.108.
    const signAngle = 30 * circleDistance(first.sign, second.sign, 12);
    const aspect = Object.keys(lillyAspectAngles).find(name => lillyAspectAngles[name] === signAngle);
    if (!aspect) return [];
    const deviation = Math.abs(circleDistance(first.longitude, second.longitude, 360) - signAngle);
    const partile = circleDistance(Math.floor(first.longitude), Math.floor(second.longitude), 360) === signAngle;
    const columns = tables.map(table => {
      const firstRow = orbRows[table].get(first.body);
      const secondRow = orbRows[table].get(second.body);
      const limit = (firstRow.arcminutes + secondRow.arcminutes) / 120;
      const matched = lillyAspect(first.longitude, second.longitude, first.body, second.body, aspect, table, orbs);
      const phase = matched && !partile ? applyingMethod(first, second, aspect, table, orbs) : null;
      return { table, limit, matched, phase, sources: [firstRow, secondRow, ...(phase ? [methods.get(phase)] : [])]
        .map(({ sourceId, source }) => ({ id: sourceId, ...source })) };
    });
    if (!columns.some(column => column.matched)) return [];
    const reference = methods.get('platic');
    return [{ role: 'aspect_orb_lookup', profile: lillyAspectReferenceProfile, first: first.planet, second: second.planet, aspect, deviation,
      columns, ...(partile ? {} : { method: { id: reference.sourceId, ...reference.source } }) }];
  }));
}
