import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { Horizon, MakeTime, Observer, RotateVector, Rotation_ECT_EQD, SiderealTime, Vector } from 'astronomy-engine';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-126-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-coangles-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-coangles-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}

const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(prefix + number + '-001', 'western', context(query(facts)), undefined, catalog);
const assertNoMatch = (number, facts, timeKnown = true) => {
  const parsed = query(facts, timeKnown);
  const id = prefix + number + '-001';
  assert.equal(explainClaim(id, 'western', context(parsed), undefined, catalog).matched, false, id);
  assert.ok(hits(lookup([parsed])).every(hit => hit.id !== id), id);
};

test('every reviewed rising and transit pair reaches SQLite report lookup from a native chart', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyPrefermentProfile, id);
    for (const input of record.inputs) {
      assert.ok(new Set(input.required.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(record.claim);
    changed.conditions.original.push('changed');
    assert.equal(compileLillyPrefermentSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const chart = calculateWestern(Date.parse(sample.date), sample);
    const parsed = query(chartFacts.western(chart));
    const observed = context(parsed);
    const references = lookup([parsed]);
    const matched = hits(references);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest;
      const input = expected.get(proof);
      assert.ok(input, proof);
      const derived = claimChartContext('western', observed, input.required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.ok(detail.calculationNote, id);
      const pair = input.required.find(fact => fact.kind === 'western_lilly_preferment_coangle');
      assert.ok(pair, proof);
      assert.ok(materials.includes(factText(pair)), id);
      verifyGeometry(chart, sample, pair);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

function verifyGeometry(chart, sample, { star, planet, angle }) {
  const time = MakeTime(new Date(sample.date));
  const observer = new Observer(sample.latitude, sample.longitude, 0);
  const radians = Math.PI / 180;
  const rotation = Rotation_ECT_EQD(time);
  const bodies = [chart.fixedStarLongitudes.find(body => body.star === star), chart.positions.find(body => body.planet === planet)];
  for (const { longitude, latitude } of bodies) {
    const lon = longitude * radians, lat = latitude * radians;
    const equatorial = RotateVector(rotation, new Vector(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), time));
    const ra = (Math.atan2(equatorial.y, equatorial.x) / radians + 360) % 360;
    const dec = Math.atan2(equatorial.z, Math.hypot(equatorial.x, equatorial.y)) / radians;
    const sky = Horizon(time, observer, ra / 15, dec);
    if (angle === 'ascendant') {
      assert.ok(Math.abs(sky.altitude) <= 1, sky.altitude);
      assert.ok(sky.azimuth < 180, sky.azimuth);
    } else {
      const hourAngle = ((SiderealTime(time) * 15 + sample.longitude - ra + 540) % 360) - 180;
      assert.ok(Math.abs(hourAngle) <= 1, hourAngle);
      assert.ok(sky.altitude > 0, sky.altitude);
    }
  }
}

function risingSample() {
  return fixture.witnesses.find(sample => samplePairs(sample).some(pair => pair.angle === 'ascendant'));
}

function samplePairs(sample) {
  return sample.proofs.map(({ id, inputDigest }) => {
    const input = catalog.get(id).inputs.find(group => key(id, group) === id + ':' + inputDigest);
    return input.required.find(fact => fact.kind === 'western_lilly_preferment_coangle');
  });
}

test('changing the horizon can turn a rising sample into a nonmatch while retaining its star longitudes', () => {
  const sample = risingSample();
  const [proof] = sample.proofs;
  const number = proof.id.slice(-7, -4);
  const full = nativeFacts(sample);
  const shifted = nativeFacts({ ...sample, longitude: sample.longitude > 0 ? sample.longitude - 180 : sample.longitude + 180 });
  const coordinates = facts => facts.filter(fact => fact.kind === 'western_fixed_star_longitude');
  assert.deepEqual(coordinates(full), coordinates(shifted));
  assert.equal(explain(number, full).matched, true);
  assertNoMatch(number, shifted);
});

test('coangle matching proves the frame and body coordinates and rejects supplied derived facts', () => {
  const sample = risingSample();
  const number = sample.proofs[0].id.slice(-7, -4);
  const [pair] = samplePairs(sample);
  const full = nativeFacts(sample);
  const starLatitude = full.find(fact => fact.kind === 'western_geometry_star_latitude' && fact.star === pair.star);
  const cusp = full.find(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 4);
  assert.equal(catalog.get(sample.proofs[0].id).remainingAlternatives, 1);
  assertNoMatch(number, [...full.filter(fact => fact !== starLatitude), pair]);
  assertNoMatch(number, [...full, { ...starLatitude, latitude: starLatitude.latitude + 0.5 }]);
  assertNoMatch(number, full.map(fact => fact === cusp ? { ...fact, longitude: (fact.longitude + 0.01) % 360 } : fact));
  assertNoMatch(number, full.filter(fact => !fact.kind.startsWith('western_geometry_')));
  assertNoMatch(number, full, false);
});
