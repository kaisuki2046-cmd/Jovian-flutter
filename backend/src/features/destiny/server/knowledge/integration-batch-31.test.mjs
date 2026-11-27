import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, lookupClaims } from './claims.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { ptolemyClassificationProfile, ptolemyClassificationSourceIds } from './ptolemy-classifications.mjs';
const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-31-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-31-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const table = sources.filter(c => ptolemyClassificationSourceIds.includes(c.id));
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
const key = c => [c.sourceId, c.target, c.key, c.sect].join(':');
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-thirty-one-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-thirty-one-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
function fixture(context) {
  const root = temporary(context), sourceDirectory = join(root, 'sources'); mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'western' ? table : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const options = { directory: join(root, 'runtime'), sourceDirectory, includeLegacy: false };
  return { ...options, options, catalog: createClaimsCatalog(options) };
}

test('all 61 classification cells reach actual SQL and report materials from native planetary positions without activating personal claims', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory), seen = new Set();
  assert.equal(batch.newCalculationReferenceSources, 19); assert.equal(batch.newClassificationCells, 61); assert.equal(native.targetCells, 61); assert.deepEqual(native.missing, []);
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), references = catalog.ptolemyClassificationReferences(raw), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]); assert.ok(!hits.some(hit => ptolemyClassificationSourceIds.includes(hit.id)));
    const actual = report(parsed), calculation = actual.find(row => row.topicId === 'overall').calculationReferences;
    assert.ok(calculation.some(r => r.profile === ptolemyClassificationProfile)); assert.match(buildReportMaterials(actual), /托勒密分类查表结果/u);
    for (const proof of witness.proofs) {
      const row = references.find(r => r.planet === proof.planet)?.classifications.find(c => key(c) === key(proof)); assert.ok(row);
      assert.deepEqual(row.values, proof.values); assert.equal(row.dimension, proof.dimension);
      assert.ok(calculation.some(r => r.planet === proof.planet && r.classifications?.some(c => key(c) === key(proof))));
      assert.deepEqual(catalog.get(proof.sourceId).claim, sources.find(c => c.id === proof.sourceId)); seen.add(key(proof));
    }
  }
  assert.deepEqual([...seen].sort(), batch.calculationReferences.flatMap(t => t.entries.map(c => key({ sourceId: t.id, ...c }))).sort());
});

test('SQL stores all 19 reference sources and 61 cells without indexing them as personal rules', context => {
  const { catalog, directory } = fixture(context); catalog.ensure(); const db = new DatabaseSync(join(directory, 'destiny-knowledge.sqlite'), { readOnly: true });
  try {
    const sourceIds = JSON.stringify(ptolemyClassificationSourceIds);
    const includesSource = ' IN (SELECT value FROM json_each(?))';
    assert.equal(db.prepare("SELECT count(*) n FROM claim_alternative a JOIN claim_entry e ON e.id = a.claim_id WHERE e.id"
      + includesSource + " AND json_extract(e.lookup_json, '$.matchScope') IS NOT 'historical_aphorism'").get(sourceIds).n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM claim_entry WHERE id' + includesSource).get(sourceIds).n, 19);
    assert.equal(db.prepare("SELECT count(*) n FROM claim_entry e JOIN json_each(e.lookup_json, '$.calculationReference.entries') c WHERE e.id"
      + includesSource).get(sourceIds).n, 61);
    const plan = db.prepare('EXPLAIN QUERY PLAN SELECT id FROM claim_entry WHERE id IN (?, ?)').all(...ptolemyClassificationSourceIds.slice(0, 2));
    assert.ok(plan.some(r => /SEARCH.*INDEX/iu.test(r.detail)));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []); assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok');
  } finally { db.close(); }
  assert.equal(catalog.inventory().filter(r => r.lookup.calculationReference?.profile === ptolemyClassificationProfile).length, 19);
  const matches = lookupClaims('western', chartContext('western', rawFacts(native.witnesses[0]), [], 'natal'), undefined, catalog);
  assert.ok(matches.every(({ id }) => !ptolemyClassificationSourceIds.includes(id)));
});

test('actual SQL distinguishes fixed affinity, uncertain birth sect, sign-only evidence and conflicting position declarations', context => {
  const { catalog } = fixture(context);
  const base = [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet: 'Moon', sign: '巨蟹座' }];
  const lookup = facts => catalog.ptolemyClassificationReferences(facts)[0]?.classifications ?? [];
  assert.ok(lookup(base).some(c => c.dimension === 'planet_sect_affinity' && c.values[0] === 'nocturnal'));
  assert.ok(!lookup(base).some(c => c.dimension === 'triplicity_rulers'));
  for (const [sect, values] of [['day', ['venus', 'mars']], ['night', ['moon', 'mars']]]) assert.deepEqual(lookup([...base, { kind: 'western_sect', sect }]).find(c => c.dimension === 'triplicity_rulers').values, values);
  assert.ok(!lookup([...base, { kind: 'western_sect', sect: 'day' }, { kind: 'western_sect', sect: 'night' }]).some(c => c.dimension === 'triplicity_rulers'));
  assert.deepEqual(lookup([...base, { kind: 'planet_longitude', planet: 'Moon', longitude: 0 }]), []);
  assert.ok(lookup(base.filter(f => f.kind !== 'western_zodiac')).every(c => c.target === 'planet'));
});

test('unknown birth time and other chart scopes cannot silently supply missing sect-dependent references', context => {
  const directory = temporary(context), report = createReportLookup(directory), raw = rawFacts(native.witnesses[0]);
  const unknown = parseChartQueries([query(raw.filter(f => f.kind !== 'western_sect'))], { timeKnown: false }); assert.ok(unknown);
  const classes = report(unknown).find(r => r.topicId === 'overall').calculationReferences.filter(r => r.profile === ptolemyClassificationProfile);
  assert.ok(classes.length); assert.ok(classes.every(r => !r.classifications.some(c => c.dimension === 'triplicity_rulers')));
  const annual = report([{ ...query(raw), chartScope: 'annual' }]); assert.ok(annual.every(r => !r.calculationReferences));
});

test('fresh source-table runtime reads classification data from SQLite with source JSON files blocked', context => {
  const { catalog, options, sourceDirectory } = fixture(context); catalog.ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(sourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); }; syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog(options); assert.ok(fresh.ptolemyClassificationReferences(rawFacts(native.witnesses[0])).length); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('a changed classification source aborts rebuild and preserves the previous valid SQLite database', context => {
  const { catalog, sourceDirectory, directory } = fixture(context); catalog.ensure(); const changed = structuredClone(table); changed[0].conditions.normalized.push('未定义新条件');
  writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify(changed)); assert.throws(() => catalog.build(), /Review Ptolemy classification/u);
  const db = new DatabaseSync(join(directory, 'destiny-knowledge.sqlite'), { readOnly: true });
  try { assert.equal(db.prepare('SELECT count(*) n FROM claim_entry').get().n, 19); assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok');
    assert.deepEqual(JSON.parse(db.prepare('SELECT claim_json FROM claim_entry WHERE id = ?').get(table[0].id).claim_json), table[0]);
  } finally { db.close(); }
});

test('classification evidence stays in local diagnostics and preserves its original sources', async context => {
  const directory = temporary(context), lookup = createReportLookup(directory);
  const facts = [{ kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'planet_sign', planet: 'Moon', sign: '巨蟹座' }, { kind: 'western_sect', sect: 'night' }];
  const chartQueries = parseChartQueries([query(facts)]);
  const references = lookup(chartQueries);
  const materials = buildReportMaterials(references);
  assert.match(materials, /托勒密分类查表结果/u);
  assert.match(materials, /月亮在托勒密自然类别列吉性/u);
  assert.match(materials, /三分组主星=月亮、火星（夜盘）/u);
  assert.match(materials, /不对应人的性别或优劣/u);
  assert.ok(!materials.includes('classification_lookup'));
  const result = await generateReport({ chartQueries }, {
    lookup: () => references.map(section => ({ ...section, personality: [], events: [] })),
    signal: new AbortController().signal,
    complete: async () => assert.fail('Classification results alone do not generate a report.'),
  });
  assert.equal(result.report, null);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousCompiledRowsUnchanged, 18846); assert.equal(batch.previousQueryableCompiledUnchanged, 2819);
});
