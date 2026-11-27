import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-125-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-royal-stars-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-royal-stars-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

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

test('every new royal-star configuration and the full set of scoring groups is reachable through a native chart and SQLite report lookup', () => {
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
      const derived = claimChartContext('western', observed, input.required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.ok(detail.calculationNote, id);
      if (input.required.some(fact => fact.kind === 'western_lilly_preferment_royal_contact')) {
        const evidence = detail.matchedConditions.measurements.find(fact => fact.kind.startsWith('western_lilly_preferment_'));
        assert.ok(evidence?.planet, id);
        assert.ok(materials.includes(factText(evidence)), id);
      }
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the four additional Hipparcos identifications reproduce the 1647 printed longitude neighborhood', () => {
  const chart = calculateWestern(Date.parse('1647-07-01T12:00:00.000Z'), { latitude: 0, longitude: 0 });
  const printed = new Map([
    ['oculus_taurus', 64.5], ['hercules', 108], ['lucida_lancis', 219.75], ['cor_scorpii', 244.5],
  ]);
  const calculated = new Map(chart.fixedStarLongitudes.map(({ star, longitude }) => [star, longitude]));
  for (const [star, longitude] of printed) {
    assert.ok(calculated.has(star), star);
    assert.ok(Math.abs(calculated.get(star) - longitude) < 0.5, star);
  }
});

test('the cusp witness and five-degree accompaniment use distinct source conditions', () => {
  const raw = [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
    })),
    { kind: 'planet_longitude', planet: 'Sun', longitude: 0.3 },
  ];
  const star = (key, longitude) => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star: key, longitude });
  const close = [...raw, star('spica_virgo', 0.8)];
  assert.equal(explain('042', close).matched, true);
  const angles = explain('102', close);
  assert.equal(angles.matched, true);
  assert.deepEqual(angles.matchedConditions.required.find(fact => fact.kind === 'western_lilly_preferment_royal_cusp'),
    { kind: 'western_lilly_preferment_royal_cusp', star: 'spica_virgo', house: 1 });
  assert.equal(catalog.get(prefix + '102-001').remainingAlternatives, 1);
  assert.equal(catalog.get(prefix + '042-001').remainingAlternatives, 1);
  assert.equal(catalog.get(prefix + '103-001').remainingAlternatives ?? 0, 0);

  const onlyCompanion = [...raw, star('spica_virgo', 4.8)];
  assert.equal(explain('103', onlyCompanion).matched, true);
  assertNoMatch('102', onlyCompanion);
  assertNoMatch('042', onlyCompanion);
  assertNoMatch('102', close, false);
  assertNoMatch('102', [...raw, star('caput_algol', 0.8)]);
  assertNoMatch('102', [...close, star('spica_virgo', 0.9)]);
  assertNoMatch('102', [...raw, { kind: 'western_lilly_preferment_royal_cusp', star: 'spica_virgo', house: 1 }]);
});
