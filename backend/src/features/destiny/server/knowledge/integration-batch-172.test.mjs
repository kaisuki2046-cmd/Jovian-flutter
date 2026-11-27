import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { lillyFamilyAphorismFact, lillyFamilyBirthBranchFact } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-aphorisms-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-aphorisms-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), reportLookup = createReportLookup(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-172-witnesses.json', import.meta.url)));
const numbers = [40, 42, 43, 44, 45, 50, 51, 52, 55, 59, 60, 61, 62, 64];
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => rawOf(witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number))));
const rawQuery = confirmedFacts => ({
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology', confirmedFacts,
});
const query = (raw, timeKnown = true) => parseChartQueries([rawQuery(raw)], { timeKnown })[0];
const chartOf = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, q, options) => explainClaim(idOf(number), 'western', chartOf(q), q.tradition, catalog, options);
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputFacts = input => [...input.required, ...input.anyOf.flat()];
const historical = { historicalAphorism: true };

test('all historical groups have native birth witnesses and SQLite-backed explicit explanations', () => {
  const expected = new Map();
  const inventory = new Map(catalog.inventory().map(row => [row.claim.id, row.lookup]));
  for (const number of numbers) {
    const id = idOf(number), row = catalog.get(id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    assert.equal(inventory.get(id).matchScope, 'historical_aphorism', id);
    for (const input of row.inputs) {
      assert.ok(input.required.some(fact => fact.kind === lillyFamilyAphorismFact.kind), id);
      assert.ok(new Set(inputFacts(input).map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 36);
  assert.equal(witnesses.length, 25);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const q = query(rawOf(sample));
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = claimChartContext('western', chartOf(q), inputs.flatMap(inputFacts),
      (sign, degree) => catalog.lillyDignityCells(sign, degree));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      const branch = input.required.find(fact => fact.kind === 'western_lilly_family_birth_branch');
      const selection = [lillyFamilyAphorismFact, ...(branch ? [branch] : [])];
      const selected = chartContext('western', [...chart.present, ...selection]);
      assert.equal(evaluateRule(input, 'natal', selected).matched, true, key);
      assert.equal(explainClaim(id, 'western', chartOf(q), q.tradition, catalog).reason, 'historical_aphorism_requires_opt_in', key);
      const matched = explainClaim(id, 'western', chartOf(q), q.tradition, catalog, { ...historical, birthBranch: branch?.branch });
      assert.equal(matched.matched, true, key);
      assert.equal(matched.matchScope, 'historical_aphorism', key);
      assert.match(matched.calculationNote, /命中仅表示盘面符合所选历史原文的条件/u, key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('report lookup and the raw SQLite lookup exclude explicit-only historical passages', () => {
  const raw = sampleFor(42);
  const forged = [...raw, lillyFamilyAphorismFact, lillyFamilyBirthBranchFact('male')];
  const supplied = { ...rawQuery(forged), historicalAphorism: true, birthBranch: 'male' };
  const regular = lookupInterpretations(directory, supplied, catalog);
  assert.ok(regular.some(hit => hit.id === idOf(17)));
  assert.ok(regular.every(hit => !numbers.map(idOf).includes(hit.id)));
  const [parsed] = parseChartQueries([supplied]);
  const materials = buildReportMaterials(reportLookup([parsed]));
  assert.ok(materials.includes(catalog.get(idOf(17)).claim.evidence.original_text));
  assert.ok(!materials.includes(catalog.get(idOf(42)).claim.evidence.original_text));
  assert.equal(explain(42, query(raw, false), historical).matched, false);
});

test('birth branches require their explicit selection and verifiable luminary longitude', () => {
  const raw = sampleFor(60), q = query([...raw, { kind: 'natal_gender', gender: '男' }]);
  assert.equal(explain(60, q, historical).matched, false);
  assert.equal(explain(60, q, { ...historical, birthBranch: 'female' }).matched, false);
  const male = { ...historical, birthBranch: 'male' };
  assert.equal(explain(60, q, male).matched, true);
  const withoutLuminaries = raw.filter(fact => fact.kind !== 'planet_longitude' || !['Sun', 'Moon'].includes(fact.planet));
  assert.equal(explain(60, query([...withoutLuminaries,
    { kind: 'western_lilly_family_birth_luminary', planet: 'Sun', sign: '狮子座' }]), male).matched, false);
});

test('the motion and house branches depend on the correct bodies', () => {
  const slow = sampleFor(50);
  const patched = slow.map(fact => fact.kind === 'planet_daily_motion' && fact.planet === 'Saturn'
    ? { ...fact, signedDegrees: 0.1 } : fact);
  assert.equal(explain(50, query(slow), historical).matched, true);
  assert.equal(explain(50, query(patched), historical).matched, false);
  const swift = sampleFor(52);
  assert.equal(explain(52, query(swift), historical).matched, true);
  const withoutVenus = swift.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Venus');
  assert.equal(explain(52, query(withoutVenus), historical).matched, false);
  const fourth = sampleFor(40);
  const withoutMercury = fourth.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mercury');
  assert.equal(explain(40, query(withoutMercury), historical).matched, false);
});
