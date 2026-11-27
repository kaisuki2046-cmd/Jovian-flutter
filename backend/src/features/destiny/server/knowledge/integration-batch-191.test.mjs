import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { normalizeFacts } from './catalog.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { compilePtolemyTravel, ptolemyTravelProfile } from './ptolemy-travel.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const prefix = 'destiny-ptolemy-travel-context-';
const directory = mkdtempSync(join(tmpdir(), prefix));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-191-witnesses.json', import.meta.url)));
const idOf = number => 'astro-ptolemy-v4-travel-p' + String(number).padStart(3, '0') + '-001';
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const rawFor = number => rawOf(samples.find(sample => sample.numbers.includes(number)));
const context = (facts, timeKnown = true) => {
  const [query] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: facts, tradition: 'Tetrabiblos' }], { timeKnown });
  return chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
};
const explain = (number, facts, { timeKnown = true, historicalAphorism = true } = {}) =>
  explainClaim(idOf(number), 'western', context(facts, timeKnown), 'Tetrabiblos', catalog, { historicalAphorism });
const detail = result => result.matchedConditions.required;
const proof = (result, kind) => detail(result).filter(fact => fact.kind === 'western_ptolemy_travel_' + kind);
const normalize = longitude => (longitude % 360 + 360) % 360;
const planetLongitude = (facts, planet) => facts.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet)?.longitude;

test('all five immutable source IDs return SQLite evidence only in historical explanations', () => {
  const checked = new Set();
  for (const sample of samples) {
    const facts = rawOf(sample);
    for (const number of sample.numbers) {
      const id = idOf(number), row = catalog.get(id);
      assert.equal(row.compiler, ptolemyTravelProfile, id);
      assert.equal(row.matchScope, 'historical_aphorism', id);
      assert.equal(row.remainingAlternatives, 1, id);
      const changed = structuredClone(row.claim);
      changed.evidence.context += '异文';
      assert.equal(compilePtolemyTravel(changed).reason, 'source_review_required', id);
      assert.equal(explain(number, facts, { historicalAphorism: false }).reason, 'historical_aphorism_requires_opt_in');
      const result = explain(number, facts);
      assert.equal(result.matched, true, id);
      assert.match(result.calculationNote, /Cardano|IV\.8/u);
      for (const fact of detail(result)) assert.doesNotMatch(factText(fact), /undefined/u);
      for (const kind of ['domain', 'priority', 'governance', 'aspect']) {
        const evidence = proof(result, kind);
        assert.deepEqual(normalizeFacts('western', evidence), evidence);
      }
      checked.add(id);
    }
  }
  assert.equal(checked.size, 5);
  const facts = rawFor(48);
  const derived = claimChartContext('western', context(facts), [], undefined, undefined, { ptolemyTravel: true });
  assert.ok(catalog.candidates('western', derived.presentKeys, 'Tetrabiblos').every(row => !checked.has(row.claim.id)));
});

test('each domain requires its own actual landmarks, with independent travel proof', () => {
  for (const [number, domain, landmarks] of [[20, 'action', ['mc']], [22, 'body', ['ascendant', 'Moon']], [23, 'dignity', ['Sun']]]) {
    const result = explain(number, rawFor(number));
    const connections = proof(result, 'domain'), rulership = proof(result, 'governance');
    assert.ok(connections.length);
    for (const row of connections) {
      assert.equal(row.domain, domain);
      assert.ok(!landmarks.includes(row.body));
      for (const body of [row.body, ...landmarks]) {
        assert.ok(rulership.some(fact => fact.body === body && fact.planet === row.planet), body);
      }
    }
  }
  const action = rawFor(20), mc = action.find(fact => fact.kind === 'western_geometry_midheaven');
  assert.equal(explain(20, [...action, { ...mc, longitude: normalize(mc.longitude + 1) }]).matched, false);
  const body = rawFor(22), asc = body.find(fact => fact.kind === 'western_geometry_ascendant');
  assert.equal(explain(22, [...body, { ...asc, longitude: normalize(asc.longitude + 1) }]).matched, false);
  assert.equal(explain(23, rawFor(23).filter(fact => fact.kind !== 'western_profile_planet_house')).matched, false);
});

test('Cardano compares candidates on the same point and gives separate winners by precision or dignity', () => {
  const facts = rawOf(samples[4]);
  const precise = explain(48, facts), dignified = explain(49, facts);
  const exactAtLot = proof(precise, 'priority').filter(fact => fact.body === 'fortune');
  const dignitiesAtLot = proof(dignified, 'priority').filter(fact => fact.body === 'fortune');
  assert.equal(exactAtLot.find(fact => fact.selected).planet, 'Mercury');
  assert.equal(dignitiesAtLot.find(fact => fact.selected).planet, 'Saturn');
  const exactTargets = { sextile: 60, square: 90, trine: 120, opposition: 180 };
  for (const item of proof(precise, 'priority')) {
    const aspect = proof(precise, 'aspect').find(row => row.first === item.planet && row.second === item.body);
    const center = item.body === 'fortune' ? detail(precise).find(fact => fact.kind === 'western_ptolemy_fortune_point').longitude
      : planetLongitude(facts, item.body);
    const distance = Math.abs(normalize(planetLongitude(facts, item.planet) - center + 180) - 180);
    assert.ok(Math.abs(Math.abs(distance - exactTargets[aspect.aspect]) - item.value) < 1e-10);
  }
  for (const item of proof(dignified, 'priority')) {
    const actual = proof(dignified, 'governance').filter(row => row.planet === item.planet && row.body === item.body && row.basis !== 'aspect');
    assert.equal(item.value, actual.length);
  }
  for (const result of [precise, dignified]) {
    const values = proof(result, 'priority');
    for (const body of new Set(values.map(fact => fact.body))) {
      const inPlace = values.filter(fact => fact.body === body);
      assert.ok(inPlace.length >= 2);
      const winners = inPlace.filter(fact => fact.selected);
      assert.equal(winners.length, 1);
      const [winner] = winners;
      assert.ok(inPlace.every(fact => fact.selected || (winner.method === 'aspect_precision' ? winner.value < fact.value : winner.value > fact.value)));
    }
  }
  const cardanoSun = proof(explain(48, rawFor(48)), 'priority');
  assert.ok(cardanoSun.some(fact => fact.body === 'Sun' && fact.selected));
  assert.equal(explain(48, rawOf(samples[0])).matched, false);
});

test('missing birth time, longitudes and dignity tables cannot be replaced by injected evidence', () => {
  const facts = rawFor(48);
  const degreeFacts = facts.filter(fact => fact.kind !== 'western_sect');
  assert.equal(explain(48, degreeFacts).matched, true);
  assert.equal(explain(49, degreeFacts).matched, false);
  assert.equal(explain(48, facts, { timeKnown: false }).matched, false);
  const selector = catalog.get(idOf(48)).inputs[0].required.find(fact => fact.witness);
  const noOpponent = facts.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Jupiter');
  assert.equal(explain(48, [...noOpponent, selector]).matched, false);
});
