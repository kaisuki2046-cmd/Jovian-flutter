import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { explainClaim } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { lillyDignityProfile } from './lilly-dignities.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-13-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-13-witnesses.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-thirteen-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-thirteen-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('both new dignity claims reach SQL, explanation and report materials from actual birth-date coordinates', context => {
  const { directory, catalog, report } = setup(context);
  assert.equal(batch.changes.length, 2);
  assert.equal(batch.calculationReferenceSources, 144);
  assert.deepEqual(witnesses.missing, []);
  const seen = new Set();
  for (const witness of witnesses.witnesses) {
    const facts = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
    const parsed = parseChartQueries([query(facts)]);
    assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]);
    const materials = buildReportMaterials(report(parsed));
    for (const id of witness.ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id);
      assert.match(hit.calculationNote, /五项本质尊贵均无/u);
      assert.ok(hit.matchedConditions.required.some(fact => fact.kind === 'western_lilly_dignity' && fact.matches));
      assert.ok(materials.includes(hit.claim.evidence.original_text));
      assert.ok(materials.includes('本质尊贵'));
      assert.equal(explainClaim(id, 'western', chartContext('western', facts, [], 'natal'), undefined, catalog).matched, true);
      seen.add(id);
    }
    const [unknown] = parseChartQueries([query(facts)], { timeKnown: false });
    for (const id of witness.ids) assert.ok(!lookupInterpretations(directory, unknown).some(hit => hit.id === id), 'unknown time cannot retain a time-specific longitude proof');
    assert.ok(!hits.some(hit => /^astro-lilly-v1-dignity-table-/u.test(hit.id)), 'table scope is not silently activated by a birth chart');
  }
  assert.deepEqual([...seen].sort(), batch.changes.map(row => row.id).sort());
});

test('dignity predicates are recalculated, with positive proof and conservative absence rather than trusted flags', context => {
  const { matches, catalog } = setup(context);
  const mercury = 'astro-lilly-v3-wit-p005-001';
  const saturn = 'astro-lilly-v3-health-servants-p011-001';
  const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
  const flag = { kind: 'western_lilly_dignity', planet: 'Mercury', dignity: 'domicile', matches: true, profile: lillyDignityProfile };
  assert.equal(matches(mercury, [tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 60 }]), true);
  assert.equal(matches(mercury, [tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 120 }, flag]), false);
  assert.equal(matches(mercury, [flag]), false);
  assert.equal(matches(mercury, [tropical, { kind: 'planet_longitude', planet: 'Venus', longitude: 60 }]), false, 'wrong body cannot supply the dignity');
  assert.equal(matches(mercury, [tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 60 }, { kind: 'planet_sign', planet: 'Mercury', sign: '狮子座' }]), false);
  assert.equal(matches(mercury, []), false);
  const witness = witnesses.witnesses.find(row => row.ids.includes(saturn));
  const facts = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
  assert.equal(matches(saturn, facts), true);
  assert.equal(matches(saturn, facts.filter(fact => fact.kind !== 'western_profile_cusp_longitude')), false, 'sixth-house proof requires actual cusps');
  const planet = facts.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Saturn');
  assert.equal(matches(saturn, facts.filter(fact => fact !== planet)), false);
  assert.equal(catalog.get(saturn).inputs.length, 6, 'all source alternatives retained, including physically unsatisfied predicates');
  assert.equal(catalog.get(mercury).remainingAlternatives, 0);
  const noEvidence = explainClaim(mercury, 'western', chartContext('western', [flag], [], 'natal'), undefined, catalog);
  assert.equal(noEvidence.matched, false);
  assert.ok(noEvidence.missing.some(fact => fact.kind === 'western_lilly_dignity'));
});
