import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { createClaimsCatalog } from './claims.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { compilePtolemyTermCells, ptolemyTermReferences, ptolemyTermProfile } from './ptolemy-terms.mjs';

const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compilePtolemyTermCells(sources);
const ids = new Set(cells.map(cell => cell.sourceId));
const table = sources.filter(claim => ids.has(claim.id));
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const names = { J: 'Jupiter', V: 'Venus', M: 'Mercury', A: 'Mars', S: 'Saturn' };
// Independent transcription of Robbins I.20–21; the supplied print correction
// gives Mars at the end of Libra, rather than the HTML transcript's Saturn.
const egyptian = ['J6V6M8A5S5', 'V8M6J8S5A3', 'M6J6V5A7S6', 'A7V6M6J7S4', 'J6V5S7M6A6', 'M7V10J4A7S2',
  'S6M8J7V7A2', 'A7V4M8J5S6', 'J12V5M4S5A4', 'M7J7V8S4A4', 'M7V6J7A5S5', 'V12J4M3A9S2'];
const manuscript = ['J6V8M7A5S4', 'V8M7J7S2A6', 'M7J6V7A6S4', 'A6J7M7V7S3', 'J6M7S6V6A5', 'M7V6J5S6A6',
  'S6V5M5J8A6', 'A6V7J8M6S3', 'J8V6M5S6A5', 'V6M6J7S6A5', 'S6M6V8J5A5', 'V8J6M6A5S5'];
const chaldaean = { day: ['JVSMA', 'VSMAJ', 'SMAJV', 'AJVSM'], night: ['JVMSA', 'VMSAJ', 'MSAJV', 'AJVMS'] };
function oracle(system, sign, degree, sect) {
  const row = system === 'chaldaean'
    ? chaldaean[sect][sign % 4].replaceAll(' ', '').split('').map((name, index) => [name, [8, 7, 6, 5, 4][index]])
    : [...(system === 'egyptian_common' ? egyptian[sign] : manuscript[sign]).matchAll(/([JVMAS])(\d+)/gu)].map(match => [match[1], Number(match[2])]);
  let end = 0;
  for (const [name, width] of row) { end += width; if (degree < end) return names[name]; }
  assert.fail('outside reference table');
}
const position = (longitude, sect = 'day') => [{ kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'planet_longitude', planet: 'Sun', longitude }, ...(sect ? [{ kind: 'western_sect', sect }] : [])];
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && cell.end > degree);
function temporary(context, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix)); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
function sourceCatalog(context) {
  const directory = temporary(context, 'destiny-ptolemy-terms-');
  const sourceDirectory = join(directory, 'sources'); mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'western' ? table : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const options = { directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false };
  return { catalog: createClaimsCatalog(options), options, sourceDirectory };
}

test('160 original records build 240 cells and independently reproduce all 2160 system/sect/degree lookups', () => {
  assert.equal(table.length, 160); assert.equal(cells.length, 240);
  for (const system of ['egyptian_common', 'ptolemy_manuscript', 'chaldaean']) for (const sect of ['day', 'night']) {
    for (let sign = 0; sign < 12; sign++) for (let degree = 0; degree < 30; degree++) {
      const reference = ptolemyTermReferences(position(sign * 30 + degree, sect), at).find(row => row.system === system);
      assert.equal(reference.ruler, oracle(system, sign, degree, sect), [system, sect, sign, degree].join('/'));
      assert.equal(reference.sign, zodiacNames[sign]);
      assert.ok(reference.sources.every(source => ids.has(source.id)));
    }
  }
  assert.equal(ptolemyTermReferences(position(209), at).find(row => row.system === 'ptolemy_manuscript').ruler, 'Mars');
});

test('exact degree endpoints, unknown sect consensus and contradictory coordinates are kept separate', () => {
  assert.equal(ptolemyTermReferences(position(6 - 1e-10), at).find(row => row.system === 'egyptian_common').ruler, 'Jupiter');
  assert.equal(ptolemyTermReferences(position(6), at).find(row => row.system === 'egyptian_common').ruler, 'Venus');
  assert.equal(ptolemyTermReferences(position(30), at)[0].sign, zodiacNames[1]);
  assert.equal(ptolemyTermReferences(position(359.99999), at)[0].sign, zodiacNames[11]);
  for (const invalid of [-1, 360, NaN, Infinity]) assert.deepEqual(ptolemyTermReferences(position(invalid), at), []);
  assert.deepEqual(ptolemyTermReferences(position(6)), []);
  assert.deepEqual(ptolemyTermReferences(undefined, at), []);
  assert.deepEqual(ptolemyTermReferences([...position(6), { kind: 'planet_longitude', planet: 'Sun', longitude: 7 }], at), []);
  assert.deepEqual(ptolemyTermReferences([...position(6), { kind: 'planet_sign', planet: 'Sun', sign: '金牛座' }], at), []);
  assert.deepEqual(ptolemyTermReferences([...position(6), { kind: 'western_zodiac', zodiac: 'sidereal' }], at), []);
  const consensus = ptolemyTermReferences(position(1, null), at).find(row => row.system === 'chaldaean');
  assert.equal(consensus.sect, 'consensus'); assert.equal(consensus.ruler, 'Jupiter'); assert.equal(consensus.sources.length, 2);
  assert.equal(ptolemyTermReferences(position(16, null), at).some(row => row.system === 'chaldaean'), false, 'day Saturn and night Mercury disagree');
  assert.equal(ptolemyTermReferences([...position(1), { kind: 'western_sect', sect: 'night' }], at).some(row => row.system === 'chaldaean'), false);
});

test('table conversion rejects incomplete tables, extra requirements and encoded intervals inconsistent with their originals', () => {
  assert.deepEqual(compilePtolemyTermCells([]), []);
  assert.throws(() => compilePtolemyTermCells(table.slice(1)), /Incomplete/u);
  const bad = structuredClone(table);
  bad[0].conditions.match.include.shift();
  assert.throws(() => compilePtolemyTermCells(bad), /original row/u);
  const extra = structuredClone(table);
  extra[0].conditions.match.requirements = ['additional unresolved selector'];
  assert.throws(() => compilePtolemyTermCells(extra), /source scope/u);
  const wrongRuler = structuredClone(table);
  const libra = wrongRuler.find(claim => claim.id === 'astro-ptolemy-v1-chapter-21-p035-001');
  libra.category.tags = libra.category.tags.map(tag => tag === 'mars' ? 'saturn' : tag);
  assert.throws(() => compilePtolemyTermCells(wrongRuler), /original row/u);
});

test('indexed SQL queries supply source-bound runtime results without rescanning JSON and schema 3 migrates in the same file', context => {
  const { catalog, options, sourceDirectory } = sourceCatalog(context);
  catalog.ensure();
  const schemaVersion = catalog.status().schema_version;
  assert.ok(schemaVersion > 3);
  assert.equal(catalog.inventory().filter(row => row.lookup.calculationReference?.profile === ptolemyTermProfile).length, 160);
  let db = new DatabaseSync(catalog.file, { readOnly: true });
  assert.equal(db.prepare('SELECT count(*) n FROM ptolemy_term_cell').get().n, 240);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM ptolemy_term_cell INDEXED BY ptolemy_terms_by_position WHERE sign = ? AND start_degree <= ? AND end_degree > ?').all('aries', 6, 6);
  assert.ok(plan.some(row => row.detail.includes('ptolemy_terms_by_position'))); db.close();
  const original = fs.readFileSync;
  fs.readFileSync = function (file, ...args) { if (String(file).startsWith(sourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try {
    const fresh = createClaimsCatalog(options);
    const references = fresh.ptolemyTermReferences(position(6));
    assert.equal(references.length, 3);
    assert.equal(references.find(row => row.system === 'egyptian_common').sources[0].id, 'astro-ptolemy-v1-chapter-20-p002-001');
    assert.ok(references.every(row => row.sources.every(source => source.url && source.original.length && source.limitations.length)));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
  db = new DatabaseSync(catalog.file); db.exec('DROP TABLE ptolemy_term_cell; UPDATE claim_catalog_meta SET schema_version = 3'); db.close();
  const migrated = createClaimsCatalog(options);
  assert.equal(migrated.status().schema_version, schemaVersion);
  assert.equal(migrated.ptolemyTermReferences(position(6)).length, 3);
});

test('a failed table update preserves the previous complete SQLite generation', context => {
  const { catalog, sourceDirectory, options } = sourceCatalog(context); catalog.ensure();
  const digest = catalog.status().source_digest;
  const broken = structuredClone(table); broken[0].conditions.match.include.shift();
  writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify(broken));
  assert.throws(() => catalog.build(), /original row/u);
  const db = new DatabaseSync(catalog.file, { readOnly: true });
  assert.equal(db.prepare('SELECT source_digest FROM claim_catalog_meta').get().source_digest, digest);
  assert.equal(db.prepare('SELECT count(*) n FROM ptolemy_term_cell').get().n, 240); db.close();
  writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify(table));
  assert.equal(createClaimsCatalog(options).ptolemyTermReferences(position(6)).length, 3);
});

test('real report lookup consumes the SQL calculation references without activating source tables as personal predictions', async context => {
  const directory = temporary(context, 'destiny-ptolemy-report-');
  const facts = [...position(209), { kind: 'planet_sign', planet: 'Sun', sign: '天秤座' }];
  const queries = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts }]);
  assert.ok(queries);
  const lookup = createReportLookup(directory);
  const references = lookup(queries);
  const calculation = references.find(row => row.topicId === 'overall').calculationReferences;
  assert.equal(calculation.filter(row => row.role === 'term_ruler_lookup').length, 3);
  assert.equal(calculation.find(row => row.system === 'ptolemy_manuscript').ruler, 'Mars');
  assert.ok(!lookupInterpretations(directory, queries[0]).some(hit => ids.has(hit.id)));
  const materials = buildReportMaterials(references);
  assert.match(materials, /界主查表结果/u); assert.match(materials, /古抄本印表界=火星/u);
  assert.match(materials, /不独立形成性格或事件结论/u);
  for (const internal of ['ptolemy_manuscript', 'active_sign', 'ptolemy-robbins', 'term_ruler_lookup']) assert.ok(!materials.includes(internal));
  const result = await generateReport({ chartQueries: queries }, {
    lookup: () => references.map(section => ({ ...section, personality: [], events: [] })),
    signal: new AbortController().signal,
    complete: async () => assert.fail('Term tables alone do not generate a report.'),
  });
  assert.equal(result.report, null);
});

test('all 240 table cells are exercised by native calculated planetary positions with intact source records', context => {
  const directory = temporary(context, 'destiny-ptolemy-native-'); const catalog = catalogForDirectory(directory);
  const report = createReportLookup(directory);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-19-witnesses.json', import.meta.url)));
  assert.deepEqual(witnesses.missing, []); assert.equal(witnesses.targetCells, 240);
  const seen = new Set();
  for (const witness of witnesses.witnesses) {
    const facts = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
    const results = catalog.ptolemyTermReferences(facts);
    const queries = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts }]);
    assert.ok(queries);
    const references = report(queries);
    const reportTerms = references.find(row => row.topicId === 'overall').calculationReferences;
    assert.ok(reportTerms?.length);
    assert.match(buildReportMaterials(references), /界主查表结果/u);
    for (const proof of witness.proofs) {
      const reference = results.find(row => row.planet === proof.planet && row.system === proof.system && row.sect === proof.sect);
      assert.ok(reference); assert.equal(reference.ruler, proof.ruler);
      assert.ok(reference.sources.some(source => source.id === proof.sourceId));
      assert.ok(reportTerms.some(row => row.planet === proof.planet && row.system === proof.system && row.sources.some(source => source.id === proof.sourceId)));
      seen.add(proof.sourceId + ':' + proof.sign + ':' + proof.sect);
    }
  }
  assert.deepEqual([...seen].sort(), cells.map(cell => cell.sourceId + ':' + cell.sign + ':' + cell.sect).sort());
  const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-19-20261118.json', import.meta.url)));
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
});
