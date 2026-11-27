import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, isWesternTimeFact } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildChartFactsText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { compileWesternClaim } from './western-claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { claimChartContext } from './claims.mjs';
import { westernFactsForInput } from './testing/western-fixtures.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-4-20261118.json', import.meta.url)));
const query = facts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts });
test('all 35 Regiomontanus records reach SQLite and text only with their own house system and house facts', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-regio-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  catalog.ensure();
  const report = createReportLookup(directory);
  const matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  assert.equal(batch.changes.length, 35);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.ok(row.inputs?.length, id);
    for (const input of row.inputs) {
      const facts = westernFactsForInput(input);
      assert.ok(matches(id, facts), id);
      assert.ok(!matches(id, facts.filter(f => f.kind !== 'western_profile_system')), id + ': missing system');
      const mixed = facts.filter(f => f.kind !== 'western_profile_cusp_longitude').map(f => f.kind === 'western_profile_planet_house'
        ? { kind: 'planet_house', planet: f.planet, house: f.house }
        : f.kind === 'western_profile_house_sign' ? { kind: 'house_sign', house: f.house, sign: f.sign } : f);
      assert.ok(!matches(id, mixed), id + ': whole sign cannot replace the historical profile');
    }
    assert.ok(buildReportMaterials(report([query(westernFactsForInput(row.inputs[0]))])).includes(row.claim.evidence.original_text), id);
  }
  const seen = new Set();
  for (let hour = 0; hour < 24; hour += 2) {
    const chart = calculateWestern(Date.UTC(1990, 5, 15, hour), { latitude: 39.907, longitude: 116.397 });
    assert.ok(chart.regiomontanus);
    const facts = chartFacts.western(chart);
    assert.ok(facts.length <= 256);
    const parsed = parseChartQueries([query(facts)], { timeKnown: true });
    assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]);
    for (const hit of hits) if (batch.changes.some(row => row.id === hit.id)) seen.add(hit.id);
    assert.match(buildChartFactsText(parsed), /雷吉奥蒙塔努斯/u);
    const unknown = parseChartQueries([query(facts)], { timeKnown: false });
    assert.ok(unknown[0].confirmedFacts.every(f => !isWesternTimeFact(f)));
    assert.ok(!lookupInterpretations(directory, unknown[0]).some(hit => batch.changes.some(row => row.id === hit.id)));
    const { regiomontanus, ...legacy } = chart;
    assert.ok(!chartFacts.western(legacy).some(f => f.kind.startsWith('western_profile_')));
    assert.deepEqual(legacy.positions, chart.positions);
    assert.deepEqual(legacy.houses, chart.houses);
  }
  assert.ok(seen.size >= 10, 'real charts must reach newly wired records');
  const witnesses = JSON.parse(readFileSync(new URL('./claims/regiomontanus-witnesses.json', import.meta.url)));
  assert.deepEqual(witnesses.missing, []);
  const proven = new Set();
  for (const witness of witnesses.witnesses) {
    const chart = calculateWestern(Date.parse(witness.date), witness);
    const request = query(chartFacts.western(chart));
    assert.ok(parseChartQueries([request], { timeKnown: true }));
    const hits = lookupInterpretations(directory, request);
    const materials = buildReportMaterials(report([request]));
    for (const id of witness.ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id + ': real birth witness');
      assert.ok(materials.includes(hit.claim.evidence.original_text));
      proven.add(id);
    }
  }
  assert.deepEqual([...proven].sort(), batch.changes.map(row => row.id).sort());
});

test('Regiomontanus exclusions require proof within that profile and cannot borrow whole-sign absence', () => {
  const atom = (fact, equals) => ({ fact, equals });
  const compiled = compileWesternClaim({ conditions: { excluded: [], match: { status: 'ready',
    include: [[atom('chart.house_system', 'regiomontanus'), atom('chart.planets.sun.house', 11)]],
    exclude: [[atom('chart.planets.moon.house', 1)]] } } });
  const base = [{ kind: 'western_profile_system', profile: 'regiomontanus' },
    { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: 'Sun', house: 11 }];
  const matches = facts => compiled.inputs.some(input => evaluateRule(input, 'natal', claimChartContext('western', chartContext('western', facts))).matched);
  assert.equal(matches(base), false);
  assert.equal(matches([...base, { kind: 'planet_house', planet: 'Moon', house: 2 }]), false);
  assert.equal(matches([...base, { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: 'Moon', house: 2 }]), true);
  assert.equal(matches([...base, { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: 'Moon', house: 1 }]), false);
});
