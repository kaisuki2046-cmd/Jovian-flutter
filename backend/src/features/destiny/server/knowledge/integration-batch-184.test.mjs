import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { longitudeHouse } from '../../control/regiomontanus.mjs';
import { factText } from '../chart-facts-text.mjs';
import { cardanoFortuneProfile, compileCardanoFortune } from './cardano-fortune.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-cardano-wealth-cases-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-cardano-wealth-cases-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-184-witnesses.json', import.meta.url)));
const previous = JSON.parse(readFileSync(new URL('./claims/integration-batch-183-witnesses.json', import.meta.url)));
const idOf = number => `astro-ptolemy-v4-fortune-p${String(number).padStart(3, '0')}-001`;
const ids = new Set([38, 50, 53, 54, 55, 56].map(idOf));
const replacements = { 50: 11, 55: 9, 56: 8 };
const phases = ['bicorporeal', 'applying', 'separating'];
const nativeChart = sample => calculateWestern(Date.parse(sample.date), sample);
const rawOf = key => chartFacts.western(nativeChart(witnesses[key]));
const context = (raw, timeKnown = true) => {
  const [query] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: raw, tradition: 'Tetrabiblos' }], { timeKnown });
  return chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
};
const explain = (number, raw, timeKnown = true) => explainClaim(idOf(number), 'western', context(raw, timeKnown), 'Tetrabiblos',
  catalog, { historicalAphorism: true });
const proof = result => result.matchedConditions.required;
const kind = (result, name) => proof(result).filter(fact => fact.kind === name);
const cardanoKind = (result, name) => kind(result, 'western_cardano_fortune_' + name);
const coordinate = (result, body) => cardanoKind(result, 'longitude').find(fact => fact.body === body).longitude;
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('six source IDs and twelve native charts reach the intended historical SQLite path', () => {
  assert.deepEqual(new Set(Object.keys(witnesses).map(key => idOf(key.split('-')[0]))), ids);
  for (const [key, sample] of Object.entries(witnesses)) {
    const number = key.split('-')[0], id = idOf(number);
    assert.ok(Number.isInteger(Date.parse(sample.date) / 60_000));
    const raw = rawOf(key), base = context(raw);
    const row = catalog.get(id);
    assert.equal(row.compiler, cardanoFortuneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    assert.equal(row.inputs.length, 1, id);
    const revised = structuredClone(row.claim);
    revised.evidence.context += '异文';
    assert.equal(compileCardanoFortune(revised).reason, 'source_review_required', id);
    const calculated = claimChartContext('western', base, [], undefined, undefined, { cardanoFortune: true });
    assert.equal(evaluateRule(row.inputs[0], 'natal', calculated).matched, true, key);
    assert.ok(catalog.candidates('western', calculated.presentKeys, 'Tetrabiblos').every(entry => !ids.has(entry.claim.id)), key);
    assert.equal(explainClaim(id, 'western', base, 'Tetrabiblos', catalog).reason, 'historical_aphorism_requires_opt_in');
    const result = explain(number, raw);
    assert.equal(result.matched, true, key);
    assert.match(result.calculationNote, /第 4(?:2[78]|30) 页/u);
    for (const fact of proof(result)) assert.doesNotMatch(factText(fact), /undefined/u);
  }
});

test('the three substitutions keep their own Saturn house and all three independent Jupiter or lunar witnesses', () => {
  for (const [number, house] of Object.entries(replacements)) {
    for (const phase of phases) {
      const key = number + '-' + phase;
      const raw = rawOf(key), result = explain(number, raw);
      const chart = nativeChart(witnesses[key]);
      assert.equal(lillyDomicileRuler(coordinate(result, 'fortune')), 'Saturn');
      for (const [planet, expected] of [['Saturn', house], ['Jupiter', 7]]) {
        assert.equal(chart.regiomontanus.positions.find(body => body.planet === planet).house, expected);
        assert.equal(cardanoKind(result, 'body_house').find(fact => fact.planet === planet).house, expected);
      }
      assert.equal(Math.floor(coordinate(result, 'Jupiter') / 30), Math.floor(coordinate(result, 'descendant') / 30));
      assert.notEqual(Math.floor(coordinate(result, 'Saturn') / 30), Math.floor(chart.midheaven / 30));
      assert.equal(kind(result, 'western_ptolemy_fortune_witness').length, 1);
      const rays = kind(result, 'western_ptolemy_fortune_moon_ray');
      assert.deepEqual(rays.map(ray => ray.phase), phase === 'bicorporeal' ? [] : [phase]);
      const bicorporeal = [2, 5, 8, 11].includes(Math.floor(coordinate(result, 'Jupiter') / 30));
      assert.equal(cardanoKind(result, 'jupiter_bicorporeal').length, bicorporeal ? 1 : 0);
      const withoutSpeeds = raw.filter(fact => fact.kind !== 'planet_hourly_motion');
      assert.equal(explain(number, withoutSpeeds).matched, bicorporeal, key);
      const other = Object.keys(replacements).find(id => id !== number);
      assert.equal(explain(other, raw).matched, false, key);
    }
  }
});

test('native case witnesses keep the actual rulers, all paired distances and geometric membership', () => {
  const first = explain(53, rawOf(53));
  assert.equal(lillyDomicileRuler(coordinate(first, 'fortune')), 'Mercury');
  assert.equal(lillyDomicileRuler(coordinate(first, 'second_cusp')), 'Jupiter');
  assert.deepEqual(cardanoKind(first, 'body_house').map(fact => [fact.planet, fact.house]), [['Jupiter', 2]]);
  assert.ok(distance(coordinate(first, 'Jupiter'), coordinate(first, 'Mercury')) <= 3);

  const second = explain(54, rawOf(54)), chart = nativeChart(witnesses[54]);
  const house = longitudeHouse(coordinate(second, 'fortune'), chart.regiomontanus.houses);
  assert.ok([1, 4, 7, 10].includes(house));
  assert.deepEqual(cardanoKind(second, 'body_house').map(fact => fact.house), [house, house]);
  const [lot, venus, mercury] = ['fortune', 'Venus', 'Mercury'].map(body => coordinate(second, body));
  assert.ok([distance(lot, venus), distance(lot, mercury), distance(venus, mercury)].every(gap => gap <= 3));
  for (const [number, planet, forged] of [[53, 'Jupiter', first], [54, 'Venus', second]]) {
    const missing = rawOf(number).filter(fact => fact.kind !== 'western_profile_planet_house' || fact.planet !== planet);
    assert.equal(explain(number, [...missing, ...proof(forged)]).matched, false);
  }
  assert.equal(explain(54, rawOf(54), false).matched, false);
});

test('a comparison requires the same ruler to have a verified center and its own dignity', () => {
  const result = explain(38, rawOf(38)), compared = cardanoKind(result, 'lot_ruler')[0].planet;
  assert.ok(cardanoKind(result, 'lot_dignity').length > 0);
  const nearAngles = cardanoKind(result, 'longitude').filter(fact =>
    ['ascendant', 'descendant', 'mc', 'ic'].includes(fact.body)
    && distance(coordinate(result, compared), fact.longitude) <= 1);
  assert.ok(nearAngles.length > 0);
  const candidates = [33, '33-descendant', '33-ic', '34-exaltation'];
  const oneSide = candidates.map(key => chartFacts.western(nativeChart(previous[key])))
    .filter(raw => explain(33, raw).matched !== explain(34, raw).matched);
  assert.ok(oneSide.length >= 2);
  for (const raw of oneSide) assert.equal(explain(38, [...raw, ...proof(result)]).matched, false);
});
