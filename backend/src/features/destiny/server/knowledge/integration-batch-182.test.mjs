import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { cardanoFortuneProfile, compileCardanoFortune } from './cardano-fortune.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-cardano-fortune-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-cardano-fortune-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, chain } = JSON.parse(readFileSync(new URL('./claims/integration-batch-182-witnesses.json', import.meta.url)));
const idOf = number => `astro-ptolemy-v4-fortune-p${String(number).padStart(3, '0')}-001`;
const chartOf = sample => calculateWestern(Date.parse(sample.date), sample);
const rawOf = sample => chartFacts.western(chartOf(sample));
const query = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Tetrabiblos',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, { historicalAphorism: true });
};
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const coordinates = result => proof(result).filter(fact => fact.kind === 'western_cardano_fortune_longitude');
const distance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const pairDistances = ([a, b, c]) => [distance(a, b), distance(a, c), distance(b, c)];
const longitudeOf = (raw, planet) => raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet).longitude;
const memberSets = {
  18: ['Jupiter', 'Moon', 'Venus'],
  19: ['Jupiter', 'Venus', 'north_node'],
  20: ['Jupiter', 'Moon', 'north_node'],
  21: ['Moon', 'Venus', 'north_node'],
  22: ['Sun', 'descendant'],
  23: ['Venus', 'mc'],
  24: ['Moon', 'ascendant'],
};

test('all seven Cardano conditions have native matches and require an explicit historical lookup', () => {
  const ids = new Set(Object.keys(memberSets).map(idOf));
  assert.deepEqual(new Set(Object.keys(witnesses).map(idOf)), ids);
  for (const [number, sample] of Object.entries(witnesses)) {
    const id = idOf(number), date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000));
    const row = catalog.get(id);
    assert.equal(row.compiler, cardanoFortuneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    assert.equal(row.inputs.length, 1, id);
    assert.equal(row.remainingAlternatives, 1, id);
    const revised = structuredClone(row.claim);
    revised.evidence.context += ' 校订本';
    assert.equal(compileCardanoFortune(revised).reason, 'source_review_required');
    const raw = rawOf(sample), q = query(raw), base = context(q);
    const derived = claimChartContext('western', base, [], undefined, undefined, { cardanoFortune: true });
    assert.equal(evaluateRule(row.inputs[0], 'natal', derived).matched, true, id);
    assert.ok(catalog.candidates('western', derived.presentKeys, q.tradition).every(entry => !ids.has(entry.claim.id)), id);
    assert.ok(lookup([q]).flatMap(({ personality, events }) => [...personality, ...events]).every(hit => !ids.has(hit.id)), id);
    assert.equal(explainClaim(id, 'western', base, q.tradition, catalog).reason, 'historical_aphorism_requires_opt_in', id);
    const result = explain(number, raw);
    assert.equal(result.matched, true, id);
    assert.equal(result.matchScope, 'historical_aphorism', id);
    const points = coordinates(result);
    assert.deepEqual(new Set(points.map(fact => fact.body)), new Set(memberSets[number]), id);
    for (const fact of points) assert.match(factText(fact), /黄经为 \d/);
    const longitudes = points.map(fact => fact.longitude);
    if (points.length === 3) assert.ok(pairDistances(longitudes).every(gap => gap <= 3), id);
    else assert.ok(distance(...longitudes) <= 1, id);
  }
});

test('each north-node substitution uses the actual north node and just the two retained planets', () => {
  for (const [number, replaced] of [[19, 'Moon'], [20, 'Venus'], [21, 'Jupiter']]) {
    const raw = rawOf(witnesses[number]), detail = explain(number, raw);
    const node = raw.find(fact => fact.kind === 'western_true_node_longitude');
    assert.equal(coordinates(detail).find(fact => fact.body === 'north_node').longitude, node.longitude);
    assert.equal(explain(number, raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== replaced)).matched, true);
    const withoutNode = raw.filter(fact => fact !== node);
    assert.equal(explain(number, [...withoutNode, ...proof(detail)]).matched, false);
    const wrong = { ...node, longitude: (node.longitude + 180) % 360 };
    assert.equal(explain(number, [...withoutNode, wrong]).matched, false);
    assert.equal(explain(number, [...raw, wrong]).matched, false);
  }
});

test('all three pair distances must fit, including across the zodiac boundary', () => {
  const raw = rawOf(chain);
  assert.equal(pairDistances(['Jupiter', 'Moon', 'Venus'].map(planet => longitudeOf(raw, planet))).filter(gap => gap <= 3).length, 2);
  assert.equal(explain(18, raw).matched, false);
  const atBoundary = (degree) => [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'planet_longitude', planet: 'Jupiter', longitude: 359 },
    { kind: 'planet_longitude', planet: 'Moon', longitude: 0 },
    { kind: 'planet_longitude', planet: 'Venus', longitude: degree },
  ];
  assert.equal(explain(18, atBoundary(2)).matched, true);
  assert.equal(explain(18, atBoundary(2.01)).matched, false);
  assert.equal(explain(18, rawOf(witnesses[18]), false).matched, false);
});

test('named angle contacts need the correct actual angle and support older cusp-only charts', () => {
  for (const number of [22, 23, 24]) {
    const chart = chartOf(witnesses[number]), raw = chartFacts.western(chart);
    const detail = explain(number, raw), points = coordinates(detail);
    const [planet, angle] = memberSets[number];
    const longitude = angle === 'mc' ? chart.midheaven
      : angle === 'ascendant' ? chart.ascendant : (chart.ascendant + 180) % 360;
    assert.equal(points.find(fact => fact.body === angle).longitude, longitude);
    assert.equal(points.find(fact => fact.body === planet).longitude, longitudeOf(raw, planet));
    const kind = angle === 'mc' ? 'western_geometry_midheaven' : 'western_geometry_ascendant';
    const house = angle === 'mc' ? 10 : 1;
    const older = raw.filter(fact => fact.kind !== kind);
    assert.ok(chart.regiomontanus);
    assert.equal(explain(number, older).matched, true);
    const missing = older.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== house);
    assert.equal(explain(number, [...missing, ...proof(detail)]).matched, false);
    const conflicting = [...raw, { kind, longitude: ((angle === 'mc' ? chart.midheaven : chart.ascendant) + 10) % 360 }];
    assert.equal(explain(number, conflicting).matched, false);
  }
});
