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
import { chartContext, evaluateRule } from './matching.mjs';
import { compilePtolemyFortune, ptolemyFortuneProfile } from './ptolemy-fortune.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-fortune-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-fortune-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, weakRuler, reverseSquare, termAndTrine, polar } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-180-witnesses.json', import.meta.url)));
const idOf = number => `astro-ptolemy-v4-fortune-p${String(number).padStart(3, '0')}-001`;
const chartOf = sample => calculateWestern(Date.parse(sample.date), sample);
const rawOf = sample => chartFacts.western(chartOf(sample));
const query = (raw, timeKnown = true, tradition = 'Tetrabiblos') => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition,
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, { timeKnown = true, historicalAphorism = false } = {}) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, { historicalAphorism });
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const factsOf = (facts, kind) => facts.filter(fact => fact.kind === 'western_ptolemy_fortune_' + kind);
const cellsAt = (sign, degree, sect) => catalog.ptolemyFortuneDignities(sign, degree, sect);
const located = (raw, planet) => raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet).longitude;
const offset = (raw, a, b) => (Math.floor(located(raw, a) / 30) - Math.floor(located(raw, b) / 30) + 12) % 12;

test('all reviewed Fortune groups match in SQLite and the formula requires a historical query', () => {
  const expected = new Map();
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14, 58].map(idOf)) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyFortuneProfile, id);
    if (id !== idOf(58)) assert.equal(row.remainingAlternatives, 1, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compilePtolemyFortune(changed).reason, 'source_review_required');
    for (const input of row.inputs) {
      if (input.anyOf.flat().some(fact => fact.kind === 'western_ptolemy_fortune_following')) continue;
      expected.set(id + ':' + digest(input), input);
    }
  }
  assert.equal(expected.size, 21);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000));
    const q = query(rawOf(sample)), base = context(q);
    const derived = claimChartContext('western', base, [], undefined, undefined, { ptolemyDignitiesAt: cellsAt });
    const references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    assert.ok(hits.every(hit => hit.id !== idOf(58)));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const historicalAphorism = id === idOf(58);
      const result = explainClaim(id, 'western', base, q.tradition, catalog, { historicalAphorism });
      assert.equal(result.matched, true, key);
      const facts = proof(result), [point] = factsOf(facts, 'point');
      assert.ok(Number.isFinite(point?.longitude), key);
      if (!historicalAphorism) {
        assert.ok(factsOf(facts, 'governor')[0], key);
        assert.ok(hits.some(hit => hit.id === id), key);
        assert.ok(materials.includes(result.claim.evidence.original_text), key);
        assert.ok(materials.includes(factText(point)), key);
      } else {
        assert.equal(result.matchScope, 'historical_aphorism');
        assert.equal(explainClaim(id, 'western', base, q.tradition, catalog).reason, 'historical_aphorism_requires_opt_in');
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the day and night formula uses the actual ascendant and accepts older cusp-only inputs', () => {
  const seenSects = new Set();
  for (const sample of witnesses) {
    const chart = chartOf(sample), raw = chartFacts.western(chart);
    if (!chart.sect || seenSects.has(chart.sect) || !chart.regiomontanus) continue;
    seenSects.add(chart.sect);
    const expected = (chart.ascendant + located(raw, 'Moon') - located(raw, 'Sun') + 360) % 360;
    const native = explain(58, raw, { historicalAphorism: true });
    assert.equal(factsOf(proof(native), 'point')[0].longitude, expected);
    const older = raw.filter(fact => fact.kind !== 'western_geometry_ascendant');
    const olderResult = explain(58, older, { historicalAphorism: true });
    assert.ok(Math.abs(factsOf(proof(olderResult), 'point')[0].longitude - expected) < 1e-8);
  }
  assert.deepEqual(seenSects, new Set(['day', 'night']));
  const raw = rawOf(polar);
  assert.ok(!raw.some(fact => fact.kind === 'western_profile_cusp_longitude'));
  const resolved = explain(58, raw, { historicalAphorism: true });
  assert.equal(resolved.matched, true);
  assert.equal(explain(58, raw, { historicalAphorism: true, timeKnown: false }).matched, false);
  const incomplete = raw.filter(fact => fact.kind !== 'western_geometry_ascendant');
  assert.equal(explain(58, [...incomplete, ...proof(resolved)], { historicalAphorism: true }).matched, false);
  const conflicting = [...raw, { kind: 'western_geometry_ascendant', longitude: (chartOf(polar).ascendant + 1) % 360 }];
  assert.equal(explain(58, conflicting, { historicalAphorism: true }).matched, false);
});

test('a named ruler is insufficient without two verified familiarities at its own longitude', () => {
  const weak = rawOf(weakRuler);
  const derived = claimChartContext('western', context(query(weak)), [], undefined, undefined, { ptolemyDignitiesAt: cellsAt });
  assert.deepEqual(factsOf(derived.present, 'governor').map(fact => fact.planet), ['Mars']);
  assert.equal(explain(5, weak).matched, false);
  const raw = rawOf(termAndTrine), matched = explain(1, raw);
  const facts = proof(matched), [ruler] = factsOf(facts, 'governor');
  const familiarities = factsOf(facts, 'affinity');
  assert.deepEqual(new Set(familiarities.map(fact => fact.dignity)), new Set(['term', 'triplicity']));
  assert.ok(familiarities.every(fact => fact.planet === ruler.planet));
  assert.ok(catalog.ptolemyTermReferences(raw).some(row => row.system === 'ptolemy_manuscript'
    && row.planet === ruler.planet && row.ruler === ruler.planet));
  const unknownSect = raw.filter(fact => fact.kind !== 'western_sect');
  assert.equal(explain(1, [...unknownSect, ...familiarities]).matched, false);
});

test('opposite-sect overcoming uses the preceding square while the reverse square stays unmatched', () => {
  const raw = rawOf(witnesses[0]), detail = explain(14, raw), facts = proof(detail);
  assert.equal(detail.matched, true);
  const ruler = factsOf(facts, 'governor')[0].planet;
  for (const { planet, relation, aspect } of factsOf(facts, 'witness')) {
    assert.equal(relation, 'opposite_superior');
    assert.equal(aspect, 'square');
    assert.equal(offset(raw, planet, ruler), 9);
  }
  const wrong = rawOf(reverseSquare), wrongChart = claimChartContext('western', context(query(wrong)));
  const wrongRuler = factsOf(wrongChart.present, 'governor')[0].planet;
  const sects = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };
  assert.ok(sects[wrongRuler]);
  assert.ok(Object.keys(sects).some(planet => sects[planet] !== sects[wrongRuler] && offset(wrong, planet, wrongRuler) === 3));
  assert.equal(explain(14, wrong).matched, false);
  const combined = explain(9, wrong);
  if (combined.matched) {
    assert.ok(factsOf(proof(combined), 'following').length);
    assert.ok(factsOf(proof(combined), 'witness').every(fact => fact.relation !== 'opposite_superior'));
  }
});
