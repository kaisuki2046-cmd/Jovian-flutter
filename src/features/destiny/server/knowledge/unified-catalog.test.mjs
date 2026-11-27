import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createClaimsCatalog } from './claims.mjs';
import { claimSourceDirectory, openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { entries } from './entries.mjs';
import { catalogDirectory, catalogFile, exportCatalog, exportKnowledge, knowledgeCatalogStatus, lookupInterpretations } from './database.mjs';
import { chartVersions } from './catalog.mjs';

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'destiny-unified-'));
  context.after(() => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'destiny-unified-'));
    rmSync(root, { recursive: true, force: true });
  });
  const sourceDirectory = join(root, 'sources');
  const directory = join(root, 'runtime');
  mkdirSync(sourceDirectory);
  const original = JSON.parse(readFileSync(join(claimSourceDirectory, 'western.json'), 'utf8'))
    .find(row => row.id === 'astro-alan-leo-v1-gemini-p001-001');
  const claim = { ...original, id: 'test-merged-claim', title: '合库测试',
    conditions: { ...original.conditions, match: { version: 1, status: 'ready', reason: null, exclude: [],
      include: [[{ fact: 'chart.zodiac', equals: 'tropical' }, { fact: 'chart.planets.sun.sign', equals: 'capricorn' }]] } } };
  const write = () => writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify([claim]));
  write();
  for (const method of ['bazi', 'ziwei']) writeFileSync(join(sourceDirectory, method + '.json'), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  return { claim, write, directory, catalog: createClaimsCatalog({ directory, sourceDirectory }) };
}

test('one SQLite file contains all 14,257 uniquely identified legacy and Claim records with intact source states', () => {
  const status = knowledgeCatalogStatus();
  assert.equal(status.totalRecords, 14257);
  assert.equal(status.legacy.reduce((sum, row) => sum + row.records, 0), 3095);
  const rows = exportKnowledge();
  assert.equal(rows.length, 14257);
  assert.equal(rows.filter(row => row.origin === 'legacy').length, 3095);
  assert.equal(rows.filter(row => row.origin === 'claim').length, 11162);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.equal(rows.filter(row => row.status === 'skipped').length, 0);
  assert.equal(rows.filter(row => row.status === 'unmapped').length, 3717);
  assert.equal(rows.filter(row => row.status === 'case_indexed' && row.method === 'bazi').length, 20);
  assert.equal(rows.filter(row => row.status === 'case_indexed' && row.method === 'ziwei').length, 26);
  assert.equal(rows.filter(row => row.status === 'case_indexed' && row.method === 'western').length, 156);
  assert.equal(exportCatalog().length, 3095); // existing legacy export contract remains supported.
  assert.ok(exportKnowledge(catalogDirectory, { search: '太阳', origin: 'claim', method: 'western' }).length);
  assert.deepEqual(exportKnowledge(catalogDirectory, { search: "x' OR 1=1 --" }), []);
  const db = openKnowledgeReadDatabase(join(catalogDirectory, catalogFile));
  try {
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok');
  } finally { db.close(); }
});

test('both source generations match from one isolated runtime file and repeated builds preserve their records', context => {
  const { catalog, directory } = fixture(context);
  const first = catalog.build();
  assert.equal(first.totalRecords, entries.length + 1);
  assert.equal(catalog.build({ refreshLegacy: true }).totalRecords, first.totalRecords);
  assert.deepEqual(readdirSync(directory), [catalogFile]);
  const chart = { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet: 'Sun', sign: '摩羯座' }] };
  // Inject this deliberately isolated catalog, so no default JSON/SQLite fallback can supply the Claim.
  const db = new DatabaseSync(catalog.file, { readOnly: true });
  try {
    assert.ok(db.prepare("SELECT id FROM knowledge_entry WHERE origin = 'claim'").get().id === 'test-merged-claim');
    const old = db.prepare("SELECT * FROM knowledge_entry WHERE id = 'alan-leo-1899-sun-capricorn'").get();
    assert.equal(old.origin, 'legacy');
    assert.equal(old.status, 'indexed');
  } finally { db.close(); }
  // Match through the same public adapter using the fixture's already-built database.
  const matches = lookupInterpretations(directory, chart, catalog);
  assert.ok(matches.some(row => row.id === 'alan-leo-1899-sun-capricorn'));
  assert.ok(matches.some(row => row.id === 'test-merged-claim'));
  assert.equal(new Set(matches.map(row => row.id)).size, matches.length);
});

test('a colliding legacy/Claim ID aborts the entire build and leaves both source generations intact', context => {
  const { catalog, claim, write } = fixture(context);
  const previous = catalog.build();
  claim.id = entries[0].id; write();
  assert.throws(() => catalog.ensure(), /Duplicate ID across legacy rules and Claims/u);
  const db = new DatabaseSync(catalog.file, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) AS count FROM knowledge_entry').get().count, entries.length + 1);
    assert.equal(db.prepare("SELECT count(*) AS count FROM knowledge_entry WHERE origin = 'legacy'").get().count, entries.length);
    assert.equal(db.prepare("SELECT id FROM knowledge_entry WHERE origin = 'claim'").get().id, 'test-merged-claim');
    assert.equal(db.prepare('SELECT source_digest FROM claim_catalog_meta').get().source_digest, previous.source_digest);
  } finally { db.close(); }
});
