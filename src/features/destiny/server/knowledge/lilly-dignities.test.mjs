import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { test } from 'node:test';
import { compileLillyDignityCells, lillyDignityFacts, lillyDignityProfile } from './lilly-dignities.mjs';
import { createClaimsCatalog, claimChartContext, explainClaim } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { normalizeFacts } from './catalog.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { chartVersions } from '../../control/charts.ts';

const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const table = sources.filter(claim => /^astro-lilly-v1-dignity-table-p\d+-001$/u.test(claim.id) && Number(claim.id.match(/-p(\d+)/u)[1]) <= 144);
const cells = compileLillyDignityCells(table);
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
const facts = (planet, longitude, sect) => [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_longitude', planet, longitude }, ...(sect ? [{ kind: 'western_sect', sect }] : [])];
const state = (planet, longitude, sect) => Object.fromEntries(lillyDignityFacts(facts(planet, longitude, sect), at).map(fact => [fact.dignity, fact.matches]));
function temporary(context, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('all 144 source entries reproduce the original p.104 sign, term, face and sect columns', () => {
  assert.equal(cells.length, 160);
  assert.equal(new Set(cells.map(cell => cell.sourceId)).size, 144);
  // Independent transcription of the printed p.104 columns; not generated
  // from the machine include groups being tested. Bounds are cumulative.
  const terms = [
    'jupiter6 venus14 mercury21 mars26 saturn30', 'venus8 mercury15 jupiter22 saturn26 mars30',
    'mercury7 jupiter14 venus21 saturn25 mars30', 'mars6 jupiter13 mercury20 venus27 saturn30',
    'saturn6 mercury13 venus19 jupiter25 mars30', 'mercury7 venus13 jupiter18 saturn24 mars30',
    'saturn6 venus11 jupiter19 mercury24 mars30', 'mars6 jupiter14 venus21 mercury27 saturn30',
    'jupiter8 venus14 mercury19 saturn25 mars30', 'venus6 mercury12 jupiter19 mars25 saturn30',
    'saturn6 mercury12 venus20 jupiter25 mars30', 'venus8 jupiter14 mercury20 mars26 saturn30',
  ];
  const faces = ['mars sun venus', 'mercury moon saturn', 'jupiter mars sun', 'venus mercury moon',
    'saturn jupiter mars', 'sun venus mercury', 'moon saturn jupiter', 'mars sun venus',
    'mercury moon saturn', 'jupiter mars sun', 'venus mercury moon', 'saturn jupiter mars'];
  const domiciles = 'mars venus mercury moon sun mercury venus mars jupiter saturn saturn jupiter'.split(' ');
  const detriments = 'venus mars jupiter saturn saturn jupiter mars venus mercury moon sun mercury'.split(' ');
  const exaltations = 'sun moon north_node jupiter - mercury saturn - south_node mars - venus'.split(' ');
  const falls = 'saturn - - mars - venus sun moon - jupiter - mercury'.split(' ');
  const trips = [['sun', 'jupiter'], ['venus', 'moon'], ['saturn', 'mercury'], ['mars', 'mars']];
  for (let sign = 0; sign < 12; sign++) {
    const actual = dimension => cells.filter(cell => cell.sign === signs[sign] && cell.dimension === dimension);
    assert.deepEqual(actual('term').map(cell => cell.body + cell.end), terms[sign].split(' '));
    assert.deepEqual(actual('face').map(cell => cell.body), faces[sign].split(' '));
    for (const [dimension, expected] of [['domicile', domiciles], ['detriment', detriments], ['exaltation', exaltations], ['fall', falls]]) {
      assert.deepEqual(actual(dimension).map(cell => cell.body), expected[sign] === '-' ? [] : [expected[sign]]);
    }
    for (const [i, sect] of ['day', 'night'].entries()) assert.equal(actual('triplicity').find(cell => cell.sect === sect).body, trips[sign % 4][i]);
    for (const dimension of ['term', 'face']) for (const cell of actual(dimension)) {
      const planet = cell.body[0].toUpperCase() + cell.body.slice(1);
      assert.equal(state(planet, sign * 30 + cell.start, 'day')[dimension], true, `${dimension}: exact lower bound`);
      assert.equal(state(planet, sign * 30 + cell.end - 0.000001, 'night')[dimension], true, `${dimension}: just below upper bound`);
      const next = (sign * 30 + cell.end) % 360;
      const nextSign = cell.end === 30 ? (sign + 1) % 12 : sign;
      const nextOwner = cell.end === 30 ? (dimension === 'term' ? terms[nextSign].split(' ')[0].replace(/\d+$/u, '') : faces[nextSign].split(' ')[0])
        : actual(dimension).find(other => other.start === cell.end).body;
      assert.equal(state(planet, next, 'day')[dimension], nextOwner === cell.body, `${dimension}: upper bound belongs to next interval, possibly the same ruler`);
    }
  }
});

test('peregrine requires all five dignities absent; unknown, contradictory and forged facts cannot supply proof', () => {
  assert.equal(state('Saturn', 4 * 30 + 3, 'day').fall, false);
  assert.equal(state('Saturn', 4 * 30 + 3, 'day').peregrine, false, 'term and face prevent peregrine even in detriment');
  assert.equal(state('Saturn', 4 * 30 + 12, 'day').peregrine, true);
  assert.equal(state('Saturn', 70, 'day').peregrine, false, 'day triplicity prevents peregrine');
  assert.equal(state('Saturn', 70, 'night').peregrine, true);
  assert.equal(state('Saturn', 70).peregrine, undefined, 'unknown sect proves neither truth nor falsehood');
  assert.equal(state('Mars', 100).triplicity, true, 'water triplicity agrees under both sects');
  assert.equal(state('Mercury', 60, 'night').domicile, true, 'D/N domicile labels do not restrict possession of a domicile');
  assert.equal(state('Sun', 0, 'day').exaltation, true, 'exaltation is not confined to the printed special degree');
  assert.equal(state('Sun', 29.999999, 'night').exaltation, true);
  assert.equal(state('Sun', 30, 'day').exaltation, false);
  assert.deepEqual(lillyDignityFacts([{ kind: 'western_zodiac', zodiac: 'tropical' }], at), []);
  assert.deepEqual(lillyDignityFacts(facts('Mercury', 60).slice(1), at), [], 'unconfirmed zodiac');
  assert.deepEqual(lillyDignityFacts([...facts('Mercury', 60), { kind: 'planet_longitude', planet: 'Mercury', longitude: 120 }], at), []);
  assert.deepEqual(lillyDignityFacts([...facts('Mercury', 60), { kind: 'planet_sign', planet: 'Mercury', sign: '白羊座' }], at), [], 'sign contradicts longitude');
  assert.deepEqual(lillyDignityFacts(facts('Mercury', 60), () => []), [], 'missing source table is not a negative');
  const contradictory = lillyDignityFacts([...facts('Saturn', 70, 'day'), { kind: 'western_sect', sect: 'night' }], at);
  assert.ok(!contradictory.some(fact => fact.dignity === 'peregrine'));
  const forged = { kind: 'western_lilly_dignity', planet: 'Mercury', dignity: 'domicile', matches: true, profile: lillyDignityProfile };
  const supplied = chartContext('western', [forged], [{ ...forged, matches: false }], 'natal');
  const calculated = claimChartContext('western', supplied, [], at);
  assert.equal(calculated.present.length, 0);
  assert.equal(calculated.absentKeys.size, 0);
  const query = { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: [...facts('Mercury', 60), forged] };
  assert.ok(!parseChartQueries([query])[0].confirmedFacts.some(fact => fact.kind === 'western_lilly_dignity'));
  assert.equal(parseChartQueries([query], { timeKnown: false })[0].confirmedFacts.some(fact => fact.kind === 'planet_longitude'), false);
  assert.throws(() => normalizeFacts('western', [{ ...forged, dignity: 'strong' }]));
  assert.throws(() => normalizeFacts('western', [{ ...forged, profile: 'modern' }]));
});

test('SQLite uses the table without source JSON scans and a failed table update retains the last valid generation', context => {
  const directory = temporary(context, 'destiny-dignity-sqlite-');
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const mercury = sources.find(claim => claim.id === 'astro-lilly-v3-wit-p005-001');
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'western' ? [...table, mercury] : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const options = { directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false };
  const catalog = createClaimsCatalog(options);
  catalog.ensure();
  assert.equal(catalog.inventory().filter(row => row.lookup.calculationReference).length, 144);
  assert.equal(catalog.get(table[0].id).calculationReference.profile, lillyDignityProfile);
  let db = new DatabaseSync(catalog.file, { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) AS n FROM lilly_dignity_cell').get().n, 160);
  assert.equal(db.prepare('SELECT count(DISTINCT source_id) AS n FROM lilly_dignity_cell').get().n, 144);
  const digest = db.prepare('SELECT source_digest FROM claim_catalog_meta').get().source_digest;
  db.close();
  const original = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    if (String(file).startsWith(sourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON read');
    return original(file, ...args);
  };
  syncBuiltinESMExports();
  try {
    const fresh = createClaimsCatalog(options);
    assert.equal(fresh.lillyDignityCells('gemini', 0).find(cell => cell.dimension === 'domicile').sourceId, 'astro-lilly-v1-dignity-table-p024-001');
    assert.equal(explainClaim(mercury.id, 'western', chartContext('western', facts('Mercury', 60), [], 'natal'), undefined, fresh).matched, true);
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
  const broken = structuredClone(table);
  broken.find(claim => claim.id === 'astro-lilly-v1-dignity-table-p005-001').conditions.match.include.shift();
  writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify([...broken, mercury]));
  assert.throws(() => catalog.build(), /Incomplete or overlapping Lilly table/u);
  db = new DatabaseSync(catalog.file, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT source_digest FROM claim_catalog_meta').get().source_digest, digest);
    assert.equal(db.prepare('SELECT count(*) AS n FROM lilly_dignity_cell').get().n, 160);
    assert.equal(db.prepare('SELECT count(*) AS n FROM claim_entry').get().n, 145);
  } finally { db.close(); }
});

test('a fresh read waits for an independent SQLite writer to release its exclusive lock', async context => {
  const directory = temporary(context, 'destiny-dignity-concurrent-');
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'western' ? table : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const options = { directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false };
  const catalog = createClaimsCatalog(options);
  catalog.ensure();
  const writer = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData); db.exec('BEGIN EXCLUSIVE');
    parentPort.postMessage('locked');
    setTimeout(() => { db.exec('COMMIT'); db.close(); }, 150);`, { eval: true, workerData: catalog.file });
  context.after(async () => { await writer.terminate(); });
  await new Promise((resolve, reject) => { writer.once('message', resolve); writer.once('error', reject); });
  // Main thread blocks in SQLite while the separate worker can still commit.
  const fresh = createClaimsCatalog(options);
  assert.equal(fresh.inventory().length, 144);
  assert.equal(fresh.lillyDignityCells('aries', 0).find(cell => cell.dimension === 'term').body, 'jupiter');
});
