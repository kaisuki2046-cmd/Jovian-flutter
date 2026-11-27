import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-8-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-8-witnesses.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });

test('all forty new records and the completed travel alternative reach report materials from real chart coordinates', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-eight-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-eight-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const catalog = catalogForDirectory(directory);
  const report = createReportLookup(directory);
  const seen = new Set();
  assert.equal(batch.changes.length, 40);
  assert.equal(batch.extended.length, 1);
  assert.deepEqual(witnesses.missing, []);
  assert.equal(catalog.get('astro-lilly-v3-travel-p001-001').remainingAlternatives, 0);
  for (const { id } of [...batch.changes, ...batch.extended]) {
    const row = catalog.get(id);
    assert.ok(row.inputs.length);
    for (const input of row.inputs) {
      const tables = new Set([...input.required, ...input.mustBeAbsent].filter(fact => fact.kind === 'western_lilly_aspect').map(fact => fact.table));
      assert.ok(tables.size <= 1, id + ': a single proof uses a single table');
    }
  }
  for (const witness of witnesses.witnesses) {
    const chart = calculateWestern(Date.parse(witness.date), witness);
    const facts = [...chartFacts.western(chart), { kind: 'natal_gender', gender: witness.gender }];
    const parsed = parseChartQueries([query(facts)]);
    assert.ok(parsed);
    assert.ok(parsed[0].confirmedFacts.length <= 256, 'calculated aspect matrices are not appended to client payloads');
    const hits = lookupInterpretations(directory, parsed[0]);
    const material = buildReportMaterials(report(parsed));
    for (const id of witness.ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id);
      assert.ok(material.includes(hit.claim.evidence.original_text), id);
      seen.add(id);
    }
    const unknown = parseChartQueries([query(facts)], { timeKnown: false });
    assert.ok(!lookupInterpretations(directory, unknown[0]).some(hit => witness.ids.includes(hit.id)));
    const missing = facts.filter(fact => fact.kind !== 'planet_longitude');
    const missingIds = lookupInterpretations(directory, query(missing)).map(hit => hit.id);
    for (const id of witness.ids.filter(id => batch.changes.some(row => row.id === id))) {
      assert.ok(!missingIds.includes(id), id + ': signs, ordinary aspects or historical derived assertions cannot replace precise coordinates');
    }
  }
  assert.deepEqual([...seen].sort(), [...batch.changes, ...batch.extended].map(row => row.id).sort());
});
