import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFamilyAphorismFact } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-family-comparison-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-family-comparison-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-173-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const regularIds = [22, 23, 36, 37].map(idOf);
const historicalIds = [53, 54].map(idOf);
const sampleFor = number => witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number)));
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const query = raw => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}])[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, options) => {
  const q = query(raw);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, options);
};
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputFacts = input => [...input.required, ...input.anyOf.flat()];
const proofFacts = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const without = (raw, planet, kind = 'planet_longitude') => raw.filter(fact => fact.kind !== kind || fact.planet !== planet);

test('native charts cover both tables and all family comparison, motion and historical SQLite groups', () => {
  const expected = new Map();
  for (const id of [...regularIds, ...historicalIds]) {
    const row = catalog.get(id);
    assert.equal(row.remainingAlternatives, 1, id);
    assert.equal(row.matchScope, historicalIds.includes(id) ? 'historical_aphorism' : undefined, id);
    for (const input of row.inputs) {
      assert.equal(new Set(inputFacts(input).map(fact => fact.table).filter(Boolean)).size, 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 14);
  assert.equal(witnesses.length, 7);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const raw = rawOf(sample), q = query(raw);
    const matches = lookup([q]);
    const materials = buildReportMaterials(matches);
    const hits = matches.flatMap(({ personality, events }) => [...personality, ...events]);
    assert.ok(hits.every(hit => !historicalIds.includes(hit.id)));
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = claimChartContext('western', context(q), inputs.flatMap(inputFacts),
      (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const history = chartContext('western', [...chart.present, lillyFamilyAphorismFact]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      const historical = historicalIds.includes(id);
      assert.ok(input && !seen.has(key), key);
      const match = evaluateRule(input, 'natal', historical ? history : chart);
      const detail = explainClaim(id, 'western', context(q), q.tradition, catalog, { historicalAphorism: historical });
      assert.equal(match.matched, true, key);
      assert.equal(detail.matched, true, key);
      if (historical) {
        assert.equal(detail.matchScope, 'historical_aphorism');
        assert.equal(explainClaim(id, 'western', context(q), q.tradition, catalog).matched, false);
      } else {
        assert.ok(hits.some(hit => hit.id === id), key);
        assert.ok(materials.includes(detail.claim.evidence.original_text), key);
        for (const fact of input.required) assert.ok(materials.includes(factText(fact)), key + ':' + factText(fact));
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('parent strengths preserve both cohorts and need complete chart evidence', () => {
  const raw = rawOf(sampleFor(23)), result = explain(23, raw);
  const roles = proofFacts(result).filter(fact => fact.kind === 'western_lilly_family_role');
  const comparison = proofFacts(result).find(fact => fact.kind === 'western_lilly_family_stronger_parent');
  assert.deepEqual(new Set(roles.map(fact => fact.parent)), new Set(['father', 'mother']));
  assert.ok(comparison && roles.some(fact => fact.parent === comparison.parent));
  assert.equal(explain(23, [...without(raw, 'Mars'), comparison]).matched, false);
  const mother = rawOf(sampleFor(22));
  assert.equal(explain(22, mother).matched, true);
  assert.equal(explain(22, without(mother, 'Moon')).matched, false);
});

test('Venus must approach or separate in the measured direction with the appropriate other conditions', () => {
  const entering = sampleFor(36), raw = rawOf(entering);
  const instants = [Date.parse(entering.date), Date.parse(entering.date) + 86_400_000];
  const distance = instants.map(instant => {
    const [sun, venus] = calculateWestern(instant, entering).positions.filter(({ planet }) => ['Sun', 'Venus'].includes(planet));
    assert.equal(Math.floor(sun.longitude / 30), Math.floor(venus.longitude / 30));
    return Math.abs(venus.longitude - sun.longitude);
  });
  assert.ok(distance[0] > 8.5 && distance[1] < 8.5);
  assert.equal(explain(36, without(raw, 'Venus', 'planet_hourly_motion')).matched, false);
  assert.equal(explain(36, raw.filter(fact => fact.kind !== 'western_sect')).matched, false);
  const departing = rawOf(sampleFor(37));
  const reclassified = departing.map(fact => fact.kind === 'planet_motion' && fact.planet === 'Venus'
    ? { ...fact, motion: 'direct' } : fact);
  assert.equal(explain(37, departing).matched, true);
  assert.equal(explain(37, reclassified).matched, false);
  assert.equal(explain(37, without(departing, 'Sun', 'planet_hourly_motion')).matched, false);
});

test('Moon orientation uses the Sun-Moon arc and requires an actual Saturn contact', () => {
  const historical = { historicalAphorism: true };
  for (const [number, opposite] of [[53, 54], [54, 53]]) {
    const raw = rawOf(sampleFor(number));
    assert.equal(explain(number, raw, historical).matched, true);
    assert.equal(explain(opposite, raw, historical).matched, false);
    assert.equal(explain(number, without(raw, 'Saturn'), historical).matched, false);
    assert.equal(explain(number, without(raw, 'Sun'), historical).matched, false);
  }
});
