import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { longitudeHouse } from '../../control/regiomontanus.mjs';
import { factText } from '../chart-facts-text.mjs';
import { cardanoFortuneProfile, compileCardanoFortune } from './cardano-fortune.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-cardano-lot-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-cardano-lot-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), reportLookup = createReportLookup(directory);
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-183-witnesses.json', import.meta.url)));
const idOf = number => `astro-ptolemy-v4-fortune-p${String(number).padStart(3, '0')}-001`;
const numbers = [27, 28, 29, 32, 33, 34, 36, 37, 39, 40, 41, 42];
const ids = new Set(numbers.map(idOf));
const chartOf = key => calculateWestern(Date.parse(witnesses[key].date), witnesses[key]);
const rawOf = key => chartFacts.western(chartOf(key));
const parse = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Tetrabiblos',
}], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const query = parse(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(query), query.tradition, catalog, { historicalAphorism: true });
};
const proof = result => result.matchedConditions.required;
const lotProof = (result, type) => proof(result).find(fact => fact.kind === 'western_cardano_fortune_lot_' + type);
const coordinate = (result, body) => proof(result).find(fact => fact.kind === 'western_cardano_fortune_longitude' && fact.body === body).longitude;
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
function actualLot(chart) {
  const { longitude: sun } = chart.positions.find(position => position.planet === 'Sun');
  const { longitude: moon } = chart.positions.find(position => position.planet === 'Moon');
  return { sun, moon, lot: (chart.ascendant + moon - sun + 360) % 360 };
}

test('twelve reviewed records reach their SQLite rules and explicit historical explanations', () => {
  const sects = new Set();
  for (const number of numbers) {
    const id = idOf(number), chart = chartOf(number), raw = chartFacts.western(chart);
    const query = parse(raw), base = context(query);
    sects.add(raw.find(fact => fact.kind === 'western_sect').sect);
    const row = catalog.get(id);
    assert.equal(row.compiler, cardanoFortuneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    assert.equal(row.inputs.length, 1, id);
    const altered = structuredClone(row.claim);
    altered.conditions.original.push('另一校读');
    assert.equal(compileCardanoFortune(altered).reason, 'source_review_required', id);

    const derived = claimChartContext('western', base, [], undefined, undefined, { cardanoFortune: true });
    assert.equal(evaluateRule(row.inputs[0], 'natal', derived).matched, true, id);
    assert.ok(catalog.candidates('western', derived.presentKeys, query.tradition).every(entry => !ids.has(entry.claim.id)), id);
    assert.equal(explainClaim(id, 'western', base, query.tradition, catalog).reason, 'historical_aphorism_requires_opt_in', id);
    const result = explain(number, raw);
    assert.equal(result.matched, true, id);
    assert.equal(result.matchScope, 'historical_aphorism', id);
    assert.match(result.calculationNote, /第 42[68] 页/u);
    for (const fact of proof(result)) assert.doesNotMatch(factText(fact), /undefined/u);
    assert.equal(coordinate(result, 'fortune'), actualLot(chart).lot);
    assert.equal(coordinate(result, 'ascendant'), chart.ascendant);
    const placement = lotProof(result, 'house');
    if (placement) assert.equal(placement.house, longitudeHouse(actualLot(chart).lot, chart.regiomontanus.houses));
  }
  assert.deepEqual(sects, new Set(['day', 'night']));
  assert.ok(reportLookup([parse(rawOf(41))]).flatMap(({ personality, events }) =>
    [...personality, ...events]).every(hit => !ids.has(hit.id)));
});

test('explanations distinguish the four angle centers, two dignities and both friendly rays', () => {
  for (const [sample, angle] of [[33, 'mc'], ['33-ascendant', 'ascendant'], ['33-descendant', 'descendant'], ['33-ic', 'ic']]) {
    const result = explain(33, rawOf(sample));
    const ruler = lotProof(result, 'ruler').planet;
    const center = coordinate(result, angle), chart = chartOf(sample);
    const expected = { mc: chart.midheaven, ascendant: chart.ascendant,
      descendant: (chart.ascendant + 180) % 360, ic: (chart.midheaven + 180) % 360 };
    assert.equal(center, expected[angle]);
    assert.ok(distance(coordinate(result, ruler), center) <= 1);
  }
  assert.equal(lotProof(explain(34, rawOf(34)), 'dignity').dignity, 'domicile');
  assert.equal(lotProof(explain(34, rawOf('34-exaltation')), 'dignity').dignity, 'exaltation');
  for (const [number, body] of [[36, 'Sun'], [37, 'Moon']]) {
    for (const [sample, aspect, degrees] of [[number, 'sextile', 60], [number + '-trine', 'trine', 120]]) {
      const result = explain(number, rawOf(sample));
      const ruler = lotProof(result, 'ruler').planet;
      assert.notEqual(ruler, body);
      assert.equal(lotProof(result, 'ray').aspect, aspect);
      assert.ok(Math.abs(distance(coordinate(result, ruler), coordinate(result, body)) - degrees) <= 3);
    }
  }
});

test('real house placement, the named light, and timed geometry cannot be substituted', () => {
  const solar = chartOf('unsupportedSolarHouse'), solarLot = actualLot(solar);
  assert.ok(distance(solarLot.lot, solarLot.sun) <= 3);
  assert.ok(![1, 4, 7, 9, 10, 11].includes(longitudeHouse(solarLot.lot, solar.regiomontanus.houses)));
  assert.equal(explain(39, chartFacts.western(solar)).matched, false);
  const nearMoon = chartOf('sunOutsideRise'), lunarLot = actualLot(nearMoon);
  assert.ok(distance(lunarLot.lot, lunarLot.moon) <= 3);
  assert.ok(distance(nearMoon.ascendant, lunarLot.sun) > 1);
  assert.equal(explain(40, chartFacts.western(nearMoon)).matched, false);
  assert.equal(explain(42, rawOf(41)).matched, false);
  assert.equal(explain(28, rawOf(29)).matched, false);
  assert.equal(explain(29, rawOf(28)).matched, false);
  const raw = rawOf(28), prior = explain(28, raw);
  const withoutCusps = raw.filter(fact => fact.kind !== 'western_profile_cusp_longitude');
  assert.equal(explain(28, [...withoutCusps, ...proof(prior)]).matched, false);
  const older = raw.filter(fact => !['western_geometry_ascendant', 'western_geometry_midheaven'].includes(fact.kind));
  assert.equal(explain(28, older).matched, true);
  assert.equal(explain(28, raw, false).matched, false);
});
