import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { EquatorFromVector, Horizon, MakeTime, Observer, RotateVector, Rotation_ECT_EQD, SiderealTime, Vector } from 'astronomy-engine';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyProfessionRising } from './lilly-profession-rising.mjs';
import { compileLillyProfessionSource } from './lilly-profession-sources.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-rising-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-rising-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-165-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-profession-method-p${number}-001`;
const position = sample => calculateWestern(Date.parse(sample.date), sample);
const query = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  tradition: 'Christian Astrology', confirmedFacts,
}], { timeKnown })[0];
const chart = q => chartContext(q.method, q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, parsed) => explainClaim(idOf(number), 'western', chart(parsed), parsed.tradition, catalog);
const planets = ['Mercury', 'Venus', 'Mars'];
const step = planet => ({ kind: 'western_lilly_profession_step', planet, step: 5, state: 'selected' });
const account = (planet, basis) => ({ kind: 'western_lilly_profession_account', planet, basis });
const witnessFor = proof => witnesses.find(sample => sample.proofs.includes(proof));

test('all reviewed rising and midheaven groups reach SQLite, explanation and reports on native charts', () => {
  const expected = new Set(planets.flatMap(planet => [
    ...['005', '020'].map(number => `${number}:${planet}:first_mover`),
    ...['both_lord', 'both_placed'].map(basis => `021:${planet}:${basis}`),
    ...['morning_only', 'midheaven_lord_only', 'midheaven_placed_only'].map(basis => `022:${planet}:${basis}`),
  ]));
  const seen = new Set(), reviewed = new Set();
  assert.equal(witnesses.length, 17);
  for (const sample of witnesses) {
    const parsed = query(chartFacts.western(position(sample)));
    const report = lookup([parsed]);
    const matched = report.flatMap(({ personality, events }) => [...personality, ...events]);
    const materials = buildReportMaterials(report);
    for (const proof of sample.proofs) {
      assert.ok(expected.has(proof) && !seen.has(proof), proof);
      const [number, planet, basis] = proof.split(':');
      const fact = basis === 'first_mover' ? step(planet) : account(planet, basis);
      const detail = explain(number, parsed);
      assert.equal(detail.matched, true, proof);
      const { required, alternatives } = detail.matchedConditions;
      assert.ok([required, ...alternatives].flat().some(actual => JSON.stringify(actual) === JSON.stringify(fact)), proof);
      assert.ok(matched.some(row => row.id === idOf(number)), proof);
      assert.ok(materials.includes(factText(fact)), proof);
      assert.match(detail.calculationNote, basis === 'first_mover' ? /625.*前四步.*东升/u : /626.*七曜.*东升/u, proof);
      const { claim } = catalog.get(idOf(number));
      assert.ok(materials.includes(claim.evidence.original_text), proof);
      if (!reviewed.has(number)) {
        const changed = structuredClone(claim);
        changed.evidence.context += ' 另版';
        assert.equal(compileLillyProfessionSource(changed).reason, 'source_review_required', proof);
        reviewed.add(number);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, expected);
});

test('east crossings agree with the ephemeris horizon around each fixed-position crossing', () => {
  for (const sample of [witnessFor('020:Mars:first_mover'), witnessFor('021:Venus:both_lord')]) {
    const native = position(sample), raw = chartFacts.western(native);
    const rise = lillyProfessionRising(raw, lillyCusps(raw));
    const time = MakeTime(new Date(sample.date));
    const observer = new Observer(sample.latitude, sample.longitude, 0);
    const meridian = SiderealTime(time) * 15 + sample.longitude;
    const radians = Math.PI / 180;
    for (const { planet, longitude, latitude } of native.positions.filter(item => rise.phases.has(item.planet))) {
      const lon = longitude * radians, lat = latitude * radians;
      const vector = new Vector(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), time);
      const { ra, dec } = EquatorFromVector(RotateVector(Rotation_ECT_EQD(time), vector));
      const delta = ((rise.phases.get(planet) - meridian + 540) % 360) - 180;
      const crossing = time.AddDays(delta / 360 * 0.997269566);
      assert.ok(Math.abs(Horizon(crossing, observer, ra, dec).altitude) < 0.002, planet);
      assert.ok(Horizon(crossing.AddDays(-30 / 86400), observer, ra, dec).altitude < 0, planet);
      assert.ok(Horizon(crossing.AddDays(30 / 86400), observer, ra, dec).altitude > 0, planet);
    }
  }
});

test('missing and conflicting geometry cannot complete earlier stages or the account comparison', () => {
  const raw = chartFacts.western(position(witnessFor('020:Mercury:first_mover')));
  assert.equal(explain('020', query(raw)).matched, true);
  assert.equal(explain('020', query(raw, false)).matched, false);
  const withoutMoon = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
  assert.equal(explain('020', query([...withoutMoon, step('Mercury')])).matched, false);
  const latitude = raw.find(fact => fact.kind === 'western_geometry_planet_latitude' && fact.planet === 'Venus');
  assert.equal(explain('020', query([...raw, { ...latitude, latitude: latitude.latitude + 0.01 }])).matched, false);
  const withoutMercuryLatitude = raw.filter(fact => fact.kind !== 'western_geometry_planet_latitude' || fact.planet !== 'Mercury');
  assert.equal(explain('020', query(withoutMercuryLatitude)).matched, false);
  const withoutGeometry = raw.filter(fact => !fact.kind.startsWith('western_geometry_'));
  assert.ok(query(withoutGeometry), 'the previous input format remains valid');
  assert.equal(explain('020', query(withoutGeometry)).matched, false);

  const both = chartFacts.western(position(witnessFor('021:Venus:both_lord')));
  assert.equal(explain('021', query(both)).matched, true);
  assert.equal(explain('022', query(both)).matched, false);
  const incomplete = both.filter(fact => fact.kind !== 'western_geometry_planet_latitude' || fact.planet !== 'Jupiter');
  assert.equal(explain('021', query([...incomplete, account('Venus', 'both_lord')])).matched, false);
  assert.equal(explain('022', query(incomplete)).matched, false);

  const single = chartFacts.western(position(witnessFor('022:Mercury:morning_only')));
  assert.equal(explain('021', query(single)).matched, false);
  assert.equal(explain('022', query(single)).matched, true);
});
