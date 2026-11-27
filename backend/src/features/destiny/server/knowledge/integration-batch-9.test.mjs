import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-9-20261118.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-nine-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-nine-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('explicit conjunctions, solitude, brightness and transformations retain all required qualifiers', context => {
  const { catalog, report, matches } = setup(context);
  assert.equal(batch.changes.length, 11);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.equal(row.reason, undefined, id);
    assert.ok(row.inputs?.length, id);
    for (const input of row.inputs) {
      assert.ok(matches(id, input.required), id + ': every alternative');
      for (const fact of input.required) {
        if (fact.kind === 'palace_relation') continue;
        assert.equal(matches(id, input.required.filter(other => other !== fact)), false, id + ': missing ' + fact.kind);
      }
    }
    assert.equal(matches(id, []), false, id + ': unknown facts');
    assert.ok(buildReportMaterials(report([query(row.inputs[0].required)])).includes(row.claim.evidence.original_text), id);
  }
  const shift = (facts, palace) => facts.map(fact => fact.palace && fact.kind !== 'palace_branch' ? { ...fact, palace } : fact);
  for (const [id, palace] of [
    ['ziwei-v3-xingjue-052-p675-001', '疾厄'],
    ['ziwei-v3-xingjue-055-p708-001', '官禄'],
  ]) {
    const facts = catalog.get(id).inputs[0].required;
    assert.ok(facts.filter(fact => fact.kind === 'palace_star').every(fact => fact.palace === palace), id);
    assert.equal(matches(id, shift(facts, '命宫')), false, id + ': a conjunction in another palace is insufficient');
    assert.equal(matches(id, facts.map(fact => fact.kind === 'palace_branch' ? { ...fact, branch: '子' } : fact)), false, id + ': wrong branch');
  }
  const bright = 'ziwei-v4-jielan-157-p001-001';
  const moon = catalog.get(bright).inputs[0].required;
  assert.ok(moon.every(fact => !fact.palace || fact.palace === '命宫'));
  assert.equal(matches(bright, shift(moon, '兄弟')), false, '入命 chapter cannot activate from another palace');
  assert.equal(matches(bright, moon.map(fact => fact.kind === 'star_mutagen' ? { ...fact, palace: '兄弟' } : fact)), false);
  assert.equal(matches(bright, moon.map(fact => fact.kind === 'palace_brightness' ? { ...fact, star: '天机' } : fact)), false);
  assert.equal(matches(bright, moon.map(fact => fact.kind === 'palace_brightness' ? { ...fact, brightness: '陷' } : fact)), false);
  const solo = 'ziwei-v3-xingjue-051-p662-001';
  assert.equal(matches(solo, catalog.get(solo).inputs[0].required.map(fact => fact.kind === 'palace_main_count' ? { ...fact, count: 2 } : fact)), false);
  const same = 'ziwei-v1-zhuxing-wenda-p122000-007';
  assert.equal(matches(same, catalog.get(same).inputs[0].required.map((fact, index) => index ? { ...fact, palace: '兄弟' } : fact)), false);
  const opposite = 'ziwei-v1-zhuxing-wenda-p127000-010';
  assert.equal(matches(opposite, [{ kind: 'palace_star', palace: '官禄', star: '天梁', scope: 'origin' }]), false);
  for (const id of batch.deferred) assert.equal(catalog.get(id).inputs, undefined, id + ': unresolved source constraints remain pending');
});

test('all eleven records reach SQLite and report materials from real birth-chart calculations', context => {
  const { catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-9-witnesses.json', import.meta.url)));
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  assert.equal(witnesses.profile, batch.profile);
  for (const { profile, timeIndex, ids } of witnesses.witnesses) {
    const facts = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
    const result = report([query(facts)]);
    const materials = buildReportMaterials(result);
    for (const id of ids) {
      assert.ok(matches(id, facts), id + ': real chart reaches SQLite');
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), id + ': real chart reaches report materials');
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.map(row => row.id).sort());
});
