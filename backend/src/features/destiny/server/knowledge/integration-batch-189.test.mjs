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
import { compilePtolemyTravel, ptolemyTravelFacts, ptolemyTravelProfile } from './ptolemy-travel.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const prefix = 'destiny-ptolemy-travel-governance-';
const directory = mkdtempSync(join(tmpdir(), prefix));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-189-witnesses.json', import.meta.url)));
const idOf = number => 'astro-ptolemy-v4-travel-p' + String(number).padStart(3, '0') + '-001';
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => rawOf(samples.find(sample => sample.numbers.includes(number)));
const cellsAt = (sign, degree, sect) => catalog.ptolemyFortuneDignities(sign, degree, sect);
const context = (facts, timeKnown = true) => {
  const [query] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: facts, tradition: 'Tetrabiblos' }], { timeKnown });
  return chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
};
const explain = (number, facts, { timeKnown = true, historicalAphorism = true } = {}) =>
  explainClaim(idOf(number), 'western', context(facts, timeKnown), 'Tetrabiblos', catalog, { historicalAphorism });
const detail = result => result.matchedConditions.required;
const ofKind = (facts, name) => facts.filter(fact => fact.kind === 'western_ptolemy_travel_' + name);

test('fourteen immutable source IDs query SQLite with actual chart evidence and explicit historical opt-in', () => {
  const checked = new Set();
  for (const sample of samples) {
    const facts = rawOf(sample);
    for (const number of sample.numbers) {
      const id = idOf(number), row = catalog.get(id);
      assert.equal(row.compiler, ptolemyTravelProfile, id);
      assert.equal(row.matchScope, 'historical_aphorism', id);
      assert.equal(row.remainingAlternatives, 1, id);
      const altered = structuredClone(row.claim);
      altered.evidence.context += '异文';
      assert.equal(compilePtolemyTravel(altered).reason, 'source_review_required', id);
      assert.equal(explain(number, facts, { historicalAphorism: false }).reason, 'historical_aphorism_requires_opt_in');
      const result = explain(number, facts);
      assert.equal(result.matched, true, id);
      assert.ok(ofKind(detail(result), 'governance').length >= 2, id);
      assert.ok(detail(result).some(fact => fact.kind === 'western_sect'), id);
      for (const fact of detail(result)) assert.doesNotMatch(factText(fact), /undefined/u);
      const evidence = ofKind(detail(result), 'governance');
      assert.deepEqual(normalizeFacts('western', evidence), evidence);
      checked.add(id);
    }
    const derived = claimChartContext('western', context(facts), [], undefined, undefined,
      { ptolemyTravel: true, ptolemyTravelDignitiesAt: cellsAt });
    for (const number of sample.numbers) {
      assert.ok(catalog.candidates('western', derived.presentKeys, 'Tetrabiblos').every(row => row.claim.id !== idOf(number)));
    }
  }
  assert.equal(checked.size, 14);
});

test('coexisting aspects are compared on the same travel point, with observed houses and the winning witness', () => {
  const facts = sampleFor(24);
  const benefic = detail(explain(25, facts)), malefic = detail(explain(26, facts));
  for (const evidence of [benefic, malefic]) {
    const comparison = ofKind(evidence, 'comparison');
    const winners = ofKind(evidence, 'dominance');
    assert.ok(winners.length > 0);
    for (const { planet, body } of winners) {
      const atPoint = comparison.filter(row => row.body === body);
      const victor = atPoint.find(row => row.planet === planet);
      assert.ok(atPoint.some(row => ['Jupiter', 'Venus'].includes(row.planet)));
      assert.ok(atPoint.some(row => ['Saturn', 'Mars'].includes(row.planet)));
      for (const rival of atPoint.filter(row => row.planet !== planet)) {
        assert.ok(victor.claims > rival.claims && victor.own >= rival.own && victor.houseRank >= rival.houseRank);
        assert.ok(ofKind(evidence, 'aspect').some(fact => fact.first === rival.planet && fact.second === body));
      }
    }
  }
  assert.ok(ofKind(benefic, 'dominance').every(row => ['Jupiter', 'Venus'].includes(row.planet)));
  assert.ok(ofKind(malefic, 'dominance').every(row => ['Saturn', 'Mars'].includes(row.planet)));
  const firstBody = ofKind(benefic, 'dominance')[0].body;
  assert.ok(ofKind(malefic, 'dominance').every(row => row.body !== firstBody));
  const withoutWitnessHouses = facts.filter(fact => fact.kind !== 'western_profile_planet_house'
    || !['Jupiter', 'Venus', 'Saturn'].includes(fact.planet));
  assert.equal(explain(24, withoutWitnessHouses).matched, false);
});

test('light rulers, active travel points and Mercury contacts remain distinct from mere presence', () => {
  const pairOnly = sampleFor(8), mercury = sampleFor(17);
  assert.equal(explain(17, pairOnly).matched, false);
  const joined = ofKind(detail(explain(17, mercury)), 'aspect').filter(fact => fact.first === 'Mercury');
  assert.deepEqual(new Set(joined.map(fact => fact.second)), new Set(['Jupiter', 'Venus']));
  const { second } = joined.find(fact => fact.aspect === 'conjunction');
  const longitude = planet => mercury.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet).longitude;
  assert.ok(Math.abs(longitude(second) - longitude('Mercury')) <= 3);
  const watery = sampleFor(12);
  assert.equal(explain(18, watery).matched, false);
  assert.equal(explain(52, watery).matched, true);
  const property = detail(explain(21, sampleFor(21)));
  const [{ planet }] = ofKind(property, 'ruler');
  assert.ok(ofKind(property, 'governance').filter(fact => fact.planet === planet && fact.body === planet).length >= 2);
  assert.ok(ofKind(property, 'governance').some(fact => fact.planet === planet && ['Moon', 'Mars'].includes(fact.body)));
});

test('missing or conflicting observations and supplied selectors cannot replace calculated evidence', () => {
  const facts = sampleFor(17);
  const selector = catalog.get(idOf(17)).inputs[0].required.find(fact => fact.witness);
  const missingSect = facts.filter(fact => fact.kind !== 'western_sect');
  assert.equal(explain(17, [...missingSect, selector]).matched, false);
  assert.equal(explain(17, [...facts, { kind: 'western_sect', sect: 'day' }, { kind: 'western_sect', sect: 'night' }]).matched, false);
  assert.equal(explain(17, facts, { timeKnown: false }).matched, false);
  const noMercury = facts.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mercury');
  assert.equal(explain(8, noMercury).matched, false);
  assert.ok(!ptolemyTravelFacts(facts, () => ({ term: null, triplicity: [] })).some(fact => fact.witness === selector.witness));
});
