import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { Body, Ecliptic, GeoVector, MakeTime } from 'astronomy-engine';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { longitudeHouse } from '../../control/regiomontanus.mjs';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compilePtolemyTravel, ptolemyTravelFacts, ptolemyTravelProfile } from './ptolemy-travel.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-travel-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-travel-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-188-witnesses.json', import.meta.url)));
const numbers = [1, 2, 3, 4, 5, 6, 7, 10, 11, 28, 29, 30, 31, 32, 33, 34, 35, 36];
const idOf = number => `astro-ptolemy-v4-travel-p${String(number).padStart(3, '0')}-001`;
const ids = new Set(numbers.map(idOf));
const sampleOf = witness => samples.find(sample => sample.witnesses.includes(witness));
const chartOf = sample => calculateWestern(Date.parse(sample.date), sample);
const rawOf = sample => chartFacts.western(chartOf(sample));
const parse = (raw, timeKnown = true) => parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts: raw, tradition: 'Tetrabiblos' }], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const query = parse(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(query), query.tradition, catalog, { historicalAphorism: true });
};
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const profile = { kind: 'western_profile_system', profile: 'regiomontanus' };
const longitude = (planet, degrees) => ({ kind: 'planet_longitude', planet, longitude: degrees });
const house = (planet, number) => ({ kind: 'western_profile_planet_house', profile: 'regiomontanus', planet, house: number });

test('all 18 source IDs and 34 conditions query the SQLite index from native charts', () => {
  const fixtures = samples.map(sample => {
    const query = parse(rawOf(sample)), base = context(query);
    return { sample, query, base, derived: claimChartContext('western', base, [], undefined, undefined, { ptolemyTravel: true }) };
  });
  const witnesses = new Set();
  for (const number of numbers) {
    const id = idOf(number), row = catalog.get(id);
    assert.equal(row.compiler, ptolemyTravelProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += '异文';
    assert.equal(compilePtolemyTravel(changed).reason, 'source_review_required', id);
    for (const input of row.inputs) {
      const { witness } = input.required.find(fact => fact.kind === 'western_ptolemy_travel_selector');
      const { sample, base, derived } = fixtures.find(({ sample }) => sample.witnesses.includes(witness));
      witnesses.add(witness);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, witness);
      assert.equal(explainClaim(id, 'western', base, 'Tetrabiblos', catalog).reason, 'historical_aphorism_requires_opt_in');
      const result = explain(number, rawOf(sample));
      assert.equal(result.matched, true, witness);
      assert.ok(proof(result).some(fact => fact.witness === witness));
      assert.match(result.calculationNote, /Robbins|Cardano|相位|双体|远行/u);
      for (const fact of proof(result)) assert.doesNotMatch(factText(fact), /undefined/u);
    }
  }
  assert.equal(witnesses.size, 34);
  assert.ok(catalog.candidates('western', fixtures[0].derived.presentKeys, 'Tetrabiblos').every(row => !ids.has(row.claim.id)));
  const normal = createReportLookup(directory)([fixtures[0].query]);
  assert.ok(normal.flatMap(({ personality, events }) => [...personality, ...events]).every(hit => !ids.has(hit.id)));
});

test('Mars needs both its own house and a hard aspect, and the two editions retain separate house options', () => {
  const sample = [tropical, profile, longitude('Sun', 5), longitude('Moon', 155), longitude('Mars', 95),
    house('Sun', 12), house('Moon', 4), house('Mars', 9)];
  assert.equal(explain(3, sample).matched, true);
  assert.equal(explain(28, sample).matched, true);
  assert.equal(explain(30, sample).matched, true);
  assert.equal(explain(1, sample).matched, false);
  const otherHouse = sample.filter(fact => fact.kind !== 'western_profile_planet_house' || fact.planet !== 'Mars');
  assert.equal(explain(3, [...otherHouse, house('Mars', 12)]).matched, false);
  assert.equal(explain(28, [...otherHouse, house('Mars', 7)]).matched, false);
  const noHardAspect = sample.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mars');
  assert.equal(explain(3, [...noHardAspect, longitude('Mars', 35)]).matched, false);
  const noProfile = sample.filter(fact => fact !== profile);
  assert.equal(explain(3, noProfile).matched, false);
  const noActualTravel = [tropical, profile, longitude('Moon', 1), longitude('Venus', 61), house('Moon', 4)];
  assert.equal(explain(2, noActualTravel).matched, false);
  for (const fact of ptolemyTravelFacts(noActualTravel)) assert.doesNotMatch(fact.witness, /robbins_benefic/u);
});

test('Fortune uses the actual ascendant and light longitudes, matched cusp signs and Cardano same-house contacts', () => {
  const robbins = rawOf(sampleOf('robbins_fortune'));
  assert.equal(explain(4, robbins).matched, true);
  assert.equal(explain(4, robbins.filter(fact => fact.kind !== 'western_profile_cusp_longitude')).matched, false);
  const noAscendant = robbins.filter(fact => fact.kind !== 'western_geometry_ascendant'
    && (fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 1));
  assert.equal(explain(4, noAscendant).matched, false);
  for (const witness of ['cardano_lot_moon_7', 'cardano_lot_mars_7', 'cardano_lot_moon_9', 'cardano_lot_mars_9']) {
    const sample = sampleOf(witness), chart = chartOf(sample), raw = chartFacts.western(chart);
    const planet = witness.includes('_moon_') ? 'Moon' : 'Mars', expectedHouse = Number(witness.at(-1));
    const natal = name => chart.positions.find(position => position.planet === name).longitude;
    const lot = (chart.ascendant + natal('Moon') - natal('Sun') + 360) % 360;
    const result = explain(31, raw), evidence = proof(result);
    assert.equal(evidence.find(fact => fact.kind === 'western_ptolemy_fortune_point').longitude, lot);
    assert.equal(longitudeHouse(lot, chart.regiomontanus.houses), expectedHouse);
    assert.equal(chart.regiomontanus.positions.find(body => body.planet === planet).house, expectedHouse);
    const actual = evidence.find(fact => fact.kind === 'western_ptolemy_travel_fortune_contact' && fact.body === planet);
    assert.ok(Math.abs(actual.distance - Math.abs(((natal(planet) - lot + 540) % 360) - 180)) < 1e-9);
    assert.ok(actual.distance <= 3);
  }
});

test('Cardano latitude and change in latitude are independent measured facts, with time and conflicts checked', () => {
  const sample = sampleOf('cardano_mars_descending'), raw = rawOf(sample), time = Date.parse(sample.date);
  const geocentricLatitude = offset => Ecliptic(GeoVector(Body.Mars, MakeTime(new Date(time + offset)), true)).elat;
  const latitude = geocentricLatitude(0), change = geocentricLatitude(1_800_000) - geocentricLatitude(-1_800_000);
  assert.ok(latitude > 0 && change < 0);
  const north = proof(explain(33, raw)).find(fact => fact.kind === 'western_geometry_planet_latitude' && fact.planet === 'Mars');
  const descent = proof(explain(36, raw)).find(fact => fact.kind === 'western_geometry_planet_latitude_motion' && fact.planet === 'Mars');
  assert.equal(north.latitude, latitude);
  assert.equal(descent.signedDegrees, change);
  const older = raw.filter(fact => fact.kind !== 'western_geometry_planet_latitude_motion');
  assert.equal(explain(33, older).matched, true);
  assert.equal(explain(36, older).matched, false);
  const withoutMoon = raw.filter(fact => fact.kind !== 'western_geometry_planet_latitude_motion' || fact.planet !== 'Moon');
  assert.equal(explain(36, [...withoutMoon, { ...descent, signedDegrees: -descent.signedDegrees }]).matched, false);
  assert.equal(explain(36, raw, false).matched, false);
  const supplied = { kind: 'western_ptolemy_travel_selector', witness: 'cardano_mars_descending' };
  assert.ok(!parse([...older, supplied]).confirmedFacts.some(fact => fact.kind === supplied.kind));
  assert.equal(explain(36, [...older, supplied]).matched, false);
});
