import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-123-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-honour-selection-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-honour-selection-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => fixture.witnesses.find(({ proofs }) => proofs.some(({ id }) => id === prefix + number + '-001'));
const natalFacts = number => nativeFacts(sampleFor(number));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}

const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(prefix + number + '-001', 'western', context(query(facts)), undefined, catalog);
const assertNoMatch = (number, facts, timeKnown = true) => {
  const parsed = query(facts, timeKnown);
  const id = prefix + number + '-001';
  assert.equal(explainClaim(id, 'western', context(parsed), undefined, catalog).matched, false, id);
  assert.ok(hits(lookup([parsed])).every(hit => hit.id !== id), id);
};

test('every chapter selection and north-node group is reachable through a native chart and SQLite report lookup', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyPrefermentProfile, id);
    for (const input of record.inputs) {
      assert.ok(new Set(input.required.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(record.claim);
    changed.conditions.original.push('changed');
    assert.equal(compileLillyPrefermentSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(nativeFacts(sample));
    const observed = context(parsed);
    const references = lookup([parsed]);
    const matched = hits(references);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest;
      const input = expected.get(proof);
      assert.ok(input, proof);
      const derived = claimChartContext('western', observed, input.required);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /莉莉名望篇/u);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the two orb tables independently verify a solar witness and a conjunction is not a ray', () => {
  const base = [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
    })),
    { kind: 'planet_longitude', planet: 'Sun', longitude: 10 },
  ];
  const at = longitude => [...base, { kind: 'planet_longitude', planet: 'Mars', longitude }];
  const threshold = explain('099', at(57.75));
  assert.equal(threshold.matched, true);
  const proof = threshold.matchedConditions.required.find(fact => fact.kind === 'western_lilly_preferment_witness');
  assert.deepEqual(proof, { kind: 'western_lilly_preferment_witness', table: 'main', planet: 'Mars', light: 'Sun' });
  assert.match(threshold.calculationNote, /首列容许度/u);
  assertNoMatch('099', at(57.749));
  assertNoMatch('099', [...at(10.2), proof]);
  assert.match(explain('099', at(59)).calculationNote, /半容许度/u);
});

test('an incomplete seven-body population cannot establish the uniform house distribution', () => {
  for (const [number, group] of [['091', 'angular'], ['092', 'succedent'], ['093', 'eighth_or_cadent']]) {
    const full = natalFacts(number);
    const partial = full.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mars');
    const forged = { kind: 'western_lilly_preferment_distribution', table: 'main', group };
    assert.equal(explain(number, full).matched, true);
    assertNoMatch(number, [...partial, forged]);
  }
});

test('north-node contact requires both real longitudes and the actual tenth cusp', () => {
  for (const [number, planet] of [['059', 'Jupiter'], ['060', 'Moon']]) {
    const sample = sampleFor(number);
    const full = nativeFacts(sample);
    const node = full.find(fact => fact.kind === 'western_true_node_longitude');
    const alternateHorizon = nativeFacts({ ...sample, longitude: sample.longitude - 12 });
    const forged = { kind: 'western_lilly_preferment_node_mc', planet };
    assert.equal(explain(number, full).matched, true);
    assertNoMatch(number, [...full.filter(fact => fact !== node), forged]);
    assertNoMatch(number, [...full, { ...node, longitude: (node.longitude + 0.3) % 360 }]);
    assertNoMatch(number, alternateHorizon);
    assertNoMatch(number, full, false);
  }
});
