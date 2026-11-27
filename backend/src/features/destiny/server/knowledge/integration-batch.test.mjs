import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartVersions, chartFacts } from './catalog.mjs';
import { calculateBaZi, calculateZiwei } from '../../control/charts.ts';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-20261118.json', import.meta.url)));
test('every newly wired record is compiled into SQLite and reaches the real lookup only with confirmed conditions', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-integration-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  catalog.ensure();
  assert.equal(batch.changes.length, 58);
  assert.equal(batch.changes.filter(row => row.previousStatus === 'unmapped').length, 57);
  for (const { id, method } of batch.changes) {
    const row = catalog.get(id);
    assert.ok(row.inputs?.length, id);
    for (const input of row.inputs) {
      const relation = method === 'bazi' && input.required[0];
      const facts = relation ? ['year', 'month', 'day', 'hour'].map(position => ({ kind: 'pillar', position,
        ganZhi: position === relation.first ? '甲子' : position === relation.second ? '甲午' : '甲寅' })) : input.required;
      const query = { method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts: facts,
        confirmedAbsentFacts: input.mustBeAbsent };
      assert.ok(lookupInterpretations(directory, query).some(hit => hit.id === id), id);
    }
    assert.ok(!lookupInterpretations(directory, { method, rulesetVersion: chartVersions[method].rulesetVersion,
      confirmedFacts: [] }).some(hit => hit.id === id), id + ': unknown is not confirmation');
  }
  const lookup = (facts, chartScope = 'natal') => lookupInterpretations(directory, { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts: facts, chartScope });
  assert.ok(!lookup([{ kind: 'palace_star', palace: '夫妻', star: '紫微', scope: 'origin' }])
    .some(hit => hit.id === 'ziwei-v2-c003-p101001-001'));
  assert.ok(!lookup([{ kind: 'palace_star', palace: '兄弟', star: '巨门', scope: 'decadal' }], 'decade')
    .some(hit => hit.id === 'ziwei-v4-jielan-162-p001-013'));
});

test('actual chart engines supply the new palace and branch facts and report materials retain their evidence', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-engine-integration-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const lookup = createReportLookup(directory);
  const seen = new Set();
  const targets = new Set(batch.changes.map(row => row.id));
  for (let month = 1; month <= 12; month++) {
    const date = { year: 1990, month, day: 15 };
    const charts = { ziwei: calculateZiwei({ date, place: { latitude: 39.907, longitude: 116.397 }, gender: 'female' }, 3),
      bazi: calculateBaZi(Date.UTC(1990, month - 1, 15, 8), Date.UTC(1990, month - 1, 15)) };
    const groups = lookup(Object.entries(charts).map(([method, chart]) => ({ method,
      rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts: chartFacts[method](chart) })));
    const hits = groups.flatMap(group => [...group.personality, ...group.events]).filter(hit => targets.has(hit.id));
    const text = buildReportMaterials(groups);
    for (const hit of hits) {
      seen.add(hit.method);
      assert.ok(text.includes(hit.claim.evidence.original_text), hit.id);
    }
  }
  assert.deepEqual([...seen].sort(), ['bazi', 'ziwei']);
});
