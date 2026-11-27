import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, westernStationaryHourlyLimit } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { lillyFamilyAphorismFact } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-birth-aphorisms-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-birth-aphorisms-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-174-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const numbers = [57, 58, 63];
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const rawQuery = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts, tradition: 'Christian Astrology' });
const query = (raw, timeKnown = true) => parseChartQueries([rawQuery(raw)], { timeKnown })[0];
const chartOf = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', chartOf(q), q.tradition, catalog, { historicalAphorism: true });
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputFacts = input => [...input.required, ...input.anyOf.flat()];
const proofFacts = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();

function fixtureFor(number, predicate) {
  const id = idOf(number);
  const inputs = new Map(catalog.get(id).inputs.map(input => [digest(input), input]));
  return witnesses.find(sample => sample.proofs.some(proof => proof.id === id && predicate(inputs.get(proof.inputDigest))));
}

test('all 75 historical birth conditions have minute-resolution native witnesses through SQLite and explicit explanation', () => {
  const expected = new Map();
  const inventory = new Map(catalog.inventory().map(row => [row.claim.id, row.lookup]));
  for (const number of numbers) {
    const id = idOf(number), row = catalog.get(id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    assert.equal(inventory.get(id).matchScope, 'historical_aphorism', id);
    assert.equal(row.remainingAlternatives, 1, id);
    for (const input of row.inputs) {
      assert.ok(new Set(inputFacts(input).map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + digest(input), input);
    }
  }
  assert.equal(expected.size, 75);
  const seen = new Set();
  let stationGroups = 0;
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60000));
    const raw = rawOf(sample), q = query(raw);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = claimChartContext('western', chartOf(q), inputs.flatMap(inputFacts),
      (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const selected = chartContext('western', [...chart.present, lillyFamilyAphorismFact]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      const result = evaluateRule(input, 'natal', selected);
      assert.equal(result.matched, true, key);
      for (const fact of result.conditions.alternatives.flat().filter(fact => fact.kind === 'western_lilly_family_birth_motion'
        && fact.motion === 'stationary')) {
        const motion = raw.find(row => row.kind === 'planet_hourly_motion' && row.planet === fact.planet);
        assert.ok(Math.abs(motion.signedDegrees) < westernStationaryHourlyLimit, key);
      }
      if (inputFacts(input).some(fact => fact.kind === 'western_lilly_family_birth_motion' && fact.motion === 'stationary')) stationGroups++;
      seen.add(key);
    }
    for (const id of new Set(sample.proofs.map(proof => proof.id))) {
      const result = explainClaim(id, 'western', chartOf(q), q.tradition, catalog, { historicalAphorism: true });
      assert.equal(result.matched, true, id);
      assert.equal(result.matchScope, 'historical_aphorism', id);
      assert.equal(explainClaim(id, 'western', chartOf(q), q.tradition, catalog).matched, false, id);
    }
  }
  assert.equal(stationGroups, 12);
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('ascendant branches require the actual first cusp, the correct ray or the selected true node', () => {
  const raySample = fixtureFor(57, input => input.required.some(fact => fact.kind === 'western_lilly_family_birth_ascendant_ray'));
  const raw = rawOf(raySample).filter(fact => fact.kind !== 'western_true_node_longitude');
  const detail = explain(57, raw);
  const ray = proofFacts(detail).find(fact => fact.kind === 'western_lilly_family_birth_ascendant_ray');
  assert.ok(ray && ['square', 'opposition'].includes(ray.aspect));
  const stripped = raw.filter(fact => fact.kind !== 'planet_longitude' || !['Mars', 'Saturn'].includes(fact.planet));
  assert.equal(explain(57, [...stripped, ray]).matched, false);
  assert.equal(explain(57, raw, false).matched, false);

  const longSigns = new Set(catalog.get(idOf(58)).inputs.flatMap(input => input.anyOf.flat())
    .filter(fact => fact.kind === 'western_lilly_family_birth_ascendant').map(fact => fact.sign));
  assert.deepEqual(longSigns, new Set(['巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座']));
  for (const [number, node, bodies] of [[57, 'south_node', ['Mars', 'Saturn']], [58, 'north_node', ['Venus', 'Jupiter']]]) {
    const sample = fixtureFor(number, input => input.required.some(fact => fact.kind === 'western_lilly_node_house'));
    const facts = rawOf(sample).filter(fact => fact.kind !== 'planet_longitude' || !bodies.includes(fact.planet));
    assert.ok(proofFacts(explain(number, facts)).some(fact => fact.kind === 'western_lilly_node_house' && fact.node === node && fact.house === 1));
    const noNode = facts.filter(fact => fact.kind !== 'western_true_node_longitude');
    assert.equal(explain(number, [...noNode, { kind: 'western_lilly_node_house', node, house: 1 }]).matched, false);
  }
});

test('stationary proof links the actual motion to the Moon companion and remains explicit-only', () => {
  const sample = fixtureFor(63, input => inputFacts(input).some(fact => fact.kind === 'western_lilly_family_birth_motion'
    && fact.motion === 'stationary'));
  const raw = rawOf(sample);
  const actual = proofFacts(explain(63, raw)).find(fact => fact.kind === 'western_lilly_family_birth_motion' && fact.motion === 'stationary');
  assert.ok(actual);
  const pair = raw.filter(fact => (fact.kind !== 'planet_longitude' || ['Moon', actual.planet].includes(fact.planet))
    && (fact.kind !== 'planet_daily_motion' || fact.planet !== actual.planet));
  assert.equal(explain(63, pair).matched, true);
  const forged = [...pair.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== actual.planet), actual];
  assert.equal(explain(63, forged).matched, false);
  assert.ok(lookupInterpretations(directory, rawQuery([...raw, lillyFamilyAphorismFact]), catalog)
    .every(hit => !numbers.map(idOf).includes(hit.id)));
});
