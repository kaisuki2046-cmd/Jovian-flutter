import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyAspectAngles } from './lilly-aspects.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compilePtolemyFortune, ptolemyFortuneProfile } from './ptolemy-fortune.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-fortune-inheritance-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-fortune-inheritance-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, followingOnly, incompleteUpperPair } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-181-witnesses.json', import.meta.url)));
const idOf = number => `astro-ptolemy-v4-fortune-p${String(number).padStart(3, '0')}-001`;
const historical = new Set([12, 16, 47, 48, 49].map(idOf));
const chartOf = sample => calculateWestern(Date.parse(sample.date), sample);
const rawOf = sample => chartFacts.western(chartOf(sample));
const associated = number => witnesses.find(row => row.proofs.some(proof => proof.id === idOf(number)));
const query = raw => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Tetrabiblos',
}], { timeKnown: true })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, useHistorical = historical.has(idOf(number))) => {
  const q = query(raw);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, { historicalAphorism: useHistorical });
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const factsOf = (facts, kind) => facts.filter(fact => fact.kind === 'western_ptolemy_fortune_' + kind);
const longitudeOf = (raw, planet) => raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet).longitude;
const signOf = (raw, planet) => Math.floor(longitudeOf(raw, planet) / 30);
const isFollowing = input => input.anyOf.flat().some(fact => fact.kind === 'western_ptolemy_fortune_following');
const cellsAt = (sign, degree, sect) => catalog.ptolemyFortuneDignities(sign, degree, sect);

test('all 11 added conditions reach their intended SQLite and query paths from native charts', () => {
  const expected = new Map();
  for (const id of [9, 10, 12, 13, 15, 16, 47, 48, 49].map(idOf)) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyFortuneProfile, id);
    assert.equal(row.matchScope, historical.has(id) ? 'historical_aphorism' : undefined, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compilePtolemyFortune(changed).reason, 'source_review_required');
    for (const input of row.inputs.filter(input => id !== idOf(9) || isFollowing(input))) {
      expected.set(id + ':' + digest(input), input);
    }
  }
  assert.equal(expected.size, 11);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000));
    const q = query(rawOf(sample)), base = context(q);
    const derived = claimChartContext('western', base, [], undefined, undefined, { ptolemyDignitiesAt: cellsAt });
    const report = lookup([q]).flatMap(({ personality, events }) => [...personality, ...events]);
    assert.ok(report.every(hit => !historical.has(hit.id)));
    assert.ok(catalog.candidates('western', derived.presentKeys, q.tradition).every(row => !historical.has(row.claim.id)));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const historicalAphorism = historical.has(id);
      const detail = explainClaim(id, 'western', base, q.tradition, catalog, { historicalAphorism });
      assert.equal(detail.matched, true, key);
      assert.ok(factsOf(proof(detail), 'governor').length, key);
      if (historicalAphorism) {
        assert.equal(explainClaim(id, 'western', base, q.tradition, catalog).reason, 'historical_aphorism_requires_opt_in');
      } else {
        assert.ok(report.some(hit => hit.id === id), key);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the following relation measures the adjacent sign, independently of overcoming', () => {
  const raw = rawOf(followingOnly), detail = explain(15, raw), facts = proof(detail);
  const lord = factsOf(facts, 'governor')[0].planet;
  const sects = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };
  const sectOf = planet => sects[planet] ?? ((longitudeOf(raw, 'Mercury') - longitudeOf(raw, 'Sun') + 360) % 360 > 180 ? 'day' : 'night');
  for (const { planet } of factsOf(facts, 'following')) {
    assert.equal((signOf(raw, planet) - signOf(raw, lord) + 12) % 12, 1);
    assert.notEqual(sectOf(planet), sectOf(lord));
  }
  assert.equal(explain(9, raw).matched, true);
  assert.equal(explain(14, raw).matched, false);
});

test('the two angle readings keep their specific physical points and require additional evidence where stated', () => {
  for (const sample of witnesses.filter(row => row.proofs.some(proof => proof.id === idOf(10)))) {
    const chart = chartOf(sample), raw = chartFacts.western(chart);
    const detail = explain(10, raw), placements = factsOf(proof(detail), 'angle');
    assert.deepEqual(new Set(placements.map(fact => fact.angle)), new Set(['ascendant', 'mc']));
    for (const { planet, angle } of placements) {
      const value = angle === 'mc' ? chart.midheaven : chart.ascendant;
      assert.equal(signOf(raw, planet), Math.floor(value / 30));
    }
    const older = raw.filter(fact => !['western_geometry_ascendant', 'western_geometry_midheaven'].includes(fact.kind));
    if (chart.regiomontanus) assert.equal(explain(10, older).matched, true);
  }
  const raw = rawOf(associated(16)), inherited = proof(explain(16, raw));
  assert.ok(factsOf(inherited, 'angle').some(fact => fact.planet === 'Saturn' && fact.angle === 'mc'));
  assert.ok(factsOf(inherited, 'angle').some(fact => fact.planet === 'Jupiter' && fact.angle === 'descendant'));
  assert.ok([2, 5, 8, 11].includes(signOf(raw, 'Jupiter')));
  assert.equal(explain(10, raw).matched, false);
  const insufficient = rawOf(incompleteUpperPair);
  assert.equal(explain(2, insufficient).matched, true);
  assert.equal(explain(10, insufficient).matched, false);
  assert.equal(explain(13, insufficient).matched, false);
});

test('Cardano approach and separation require the actual Moon–Jupiter ray and verified motion', () => {
  for (const [number, phase] of [[48, 'applying'], [49, 'separating']]) {
    const raw = rawOf(associated(number)), evidence = proof(explain(number, raw));
    const [ray] = factsOf(evidence, 'moon_ray');
    assert.equal(ray.phase, phase);
    const exact = lillyAspectAngles[ray.aspect], turn = longitudeOf(raw, 'Moon') - longitudeOf(raw, 'Jupiter');
    const differences = [exact, 360 - exact].map(value => ((turn - value + 180) % 360 + 360) % 360 - 180);
    assert.ok(differences.some(gap => Math.abs(gap) <= 3 && (phase === 'applying' ? gap < 0 : gap > 0)));
    assert.ok(factText(ray).includes('3°'));
    assert.equal(explain(phase === 'applying' ? 49 : 48, raw).matched, false);
    const missing = raw.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== 'Jupiter');
    assert.equal(explain(number, [...missing, ...evidence]).matched, false);
    assert.equal(explain(47, missing).matched, true);
  }
});

test('the historical assessment needs the complete chart even when the lot formula still works', () => {
  const raw = rawOf(associated(12)), found = explain(12, raw);
  assert.equal(found.matched, true);
  const incomplete = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Venus');
  assert.equal(explain(58, incomplete, true).matched, true);
  assert.equal(explain(12, [...incomplete, ...proof(found)]).matched, false);
});
