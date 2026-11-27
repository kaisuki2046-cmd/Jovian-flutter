import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compilePtolemyFixedStars, ptolemyFixedStarProfile } from './ptolemy-fixed-stars.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-constellation-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-constellation-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-186-witnesses.json', import.meta.url)));
const source = {
  oculus_taurus: 7, hercules: 13, cor_leonis: 20, spica_virgo: 26, cor_scorpii: 31,
  arcturus: 60, capella: 68, betelgeuse: 79, sirius: 84, procyon: 86,
};
const idOf = number => `astro-ptolemy-v1-chapter-9-p${String(number).padStart(3, '0')}-001`;
const ids = new Set(Object.values(source).map(idOf));
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const starAt = (star, longitude) => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star, longitude });
const point = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const native = sample => calculateWestern(Date.parse(sample.date), sample);
const parse = (raw, timeKnown = true) => parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts: raw, tradition: 'Tetrabiblos' }], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const query = parse(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(query), query.tradition, catalog, { historicalAphorism: true });
};
const matched = result => result.matchedConditions.required;
const angleKind = target => target === 'mc' ? 'western_geometry_midheaven' : 'western_geometry_ascendant';
const separation = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('all ten source IDs match native planet and angle positions in SQLite history queries', () => {
  const coverage = new Set();
  for (const sample of samples) {
    const chart = native(sample), raw = chartFacts.western(chart), query = parse(raw);
    const ctx = context(query);
    const derived = claimChartContext('western', ctx, [], undefined, undefined, { ptolemyFixedStars: true });
    assert.ok(catalog.candidates('western', derived.presentKeys, query.tradition).every(row => !ids.has(row.claim.id)));
    for (const { star, target } of sample.contacts) {
      const number = source[star], id = idOf(number);
      const isAngle = ['ascendant', 'mc'].includes(target);
      coverage.add(star + (isAngle ? ':angle' : ':planet'));
      const row = catalog.get(id);
      assert.equal(row.compiler, ptolemyFixedStarProfile, id);
      assert.equal(row.matchScope, 'historical_aphorism', id);
      assert.equal(row.inputs.length, 1, id);
      assert.equal(evaluateRule(row.inputs[0], 'natal', derived).matched, true, id);
      assert.equal(explainClaim(id, 'western', ctx, query.tradition, catalog).reason, 'historical_aphorism_requires_opt_in');
      const result = explain(number, raw);
      assert.equal(result.matched, true, id);
      assert.match(result.calculationNote, /黄道投影尺度/u);
      const facts = matched(result);
      const actual = facts.find(fact => fact.kind === 'western_ptolemy_fixed_star_contact' && fact.target === target);
      const targetPosition = isAngle ? (target === 'mc' ? chart.midheaven : chart.ascendant)
        : chart.positions.find(position => position.planet === target).longitude;
      const starPosition = chart.fixedStarLongitudes.find(position => position.star === star).longitude;
      assert.equal(actual.star, star);
      assert.ok(Math.abs(actual.distance - separation(starPosition, targetPosition)) < 1e-9);
      assert.ok(actual.distance <= 1);
      assert.deepEqual(facts.filter(fact => fact.kind === 'western_fixed_star_longitude'), [starAt(star, starPosition)]);
      assert.ok(facts.some(fact => fact.kind === (isAngle ? angleKind(target) : 'planet_longitude') && fact.longitude === targetPosition));
      for (const fact of facts) assert.doesNotMatch(factText(fact), /undefined/u);
    }
  }
  assert.equal(coverage.size, 20);
  const review = structuredClone(catalog.get(idOf(79)).claim);
  review.evidence.context += '另一种校订';
  assert.equal(compilePtolemyFixedStars(review).reason, 'source_review_required');
  const normal = createReportLookup(directory)([parse(chartFacts.western(native(samples[1])))]);
  assert.ok(normal.flatMap(({ personality, events }) => [...personality, ...events]).every(row => !ids.has(row.id)));
});

test('short arcs, supported star identities and conflicting coordinates are handled independently', () => {
  const alder = starAt('oculus_taurus', 359.5);
  const venus = point('Venus', 0.5);
  assert.equal(explain(7, [tropical, alder, venus]).matched, true);
  assert.equal(explain(7, [tropical, alder, point('Venus', 0.5001)]).matched, false);
  assert.equal(explain(7, [alder, venus]).matched, false);
  const nearOther = [tropical, starAt('cor_leonis', 359.5), venus];
  assert.equal(explain(7, nearOther).matched, false);
  assert.equal(explain(20, nearOther).matched, true);
  assert.equal(explain(7, [tropical, alder, starAt('oculus_taurus', 120), venus]).matched, false);
  assert.equal(explain(7, [tropical, alder, venus, point('Venus', 2)]).matched, false);
  assert.equal(explain(7, [tropical, alder, venus], false).matched, false);
  const forged = matched(explain(7, [tropical, alder, venus])).filter(fact => fact.kind.startsWith('western_ptolemy_fixed_star_'));
  assert.equal(explain(7, [tropical, venus, ...forged]).matched, false);
  assert.ok(parse([tropical, venus, ...forged]).confirmedFacts.every(fact => !fact.kind.startsWith('western_ptolemy_fixed_star_')));
});

test('older charts use the same actual angle from cusps and inconsistent angles withhold selection', () => {
  const { contacts, ...sample } = samples.find(row => row.contacts.some(({ star, target }) => star === 'oculus_taurus' && target === 'ascendant'));
  const chart = native(sample);
  const raw = chartFacts.western(chart);
  const base = raw.filter(fact => fact.kind !== 'planet_longitude' && !fact.kind.startsWith('western_geometry_'));
  const fromCusp = explain(7, base);
  assert.equal(fromCusp.matched, true);
  assert.equal(matched(fromCusp).find(fact => fact.kind === 'western_geometry_ascendant').longitude, chart.ascendant);
  const missing = base.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 1);
  assert.equal(explain(7, missing).matched, false);
  const conflict = { kind: 'western_geometry_ascendant', longitude: (chart.ascendant + 180) % 360 };
  assert.equal(explain(7, [...base, conflict]).matched, false);
});
