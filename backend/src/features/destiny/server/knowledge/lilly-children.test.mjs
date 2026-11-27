import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyChildrenProfile } from './lilly-children.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-children-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const place = { latitude: 31.23, longitude: 121.47 };
const witnesses = [
  '1994-12-19T02:15:00Z', '1992-10-31T14:15:00Z', '1992-12-27T12:15:00Z', '1993-10-08T22:15:00Z',
  '1994-02-18T02:15:00Z', '1701-06-25T12:00:00Z', '1993-12-04T18:15:00Z', '1994-06-12T16:15:00Z',
];
const id = number => 'astro-lilly-v3-children-p' + String(number).padStart(3, '0') + '-001';
const reviewed = new Set([3, 6, 7, 10, 11, 13, 14, 15, 16, 20, 21, 24, 27, 28, 36, 38, 41, 42, 51].map(id));
const proofKey = (id, required) => JSON.stringify([id, required]);
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(number, facts, scope = 'natal') {
  return explainClaim(id(number), 'western', chartContext('western', facts, [], scope), undefined, catalog);
}

function syntheticCusps(first) {
  return [
    { kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: (first + index * 30) % 360,
    })),
  ];
}

test('all 19 reviewed fifth-house records and 42 groups reach SQLite, explanations and report materials', () => {
  assert.equal(reviewed.size, 19);
  const expected = new Set();
  for (const id of reviewed) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyChildrenProfile);
    assert.equal(row.remainingAlternatives, 0);
    for (const input of row.inputs) expected.add(proofKey(id, input.required));
  }
  assert.equal(expected.size, 42);
  const seen = new Set();
  for (const instant of witnesses) {
    const parsed = query(raw(instant));
    const refs = lookup(parsed);
    const materials = buildReportMaterials(refs);
    for (const hit of hits(refs).filter(hit => reviewed.has(hit.id))) {
      const { required, alternatives } = hit.matchedConditions;
      const keys = (alternatives.length ? alternatives : [required]).map(group => proofKey(hit.id, group));
      assert.ok(keys.every(key => expected.has(key)), hit.id);
      if (keys.every(key => seen.has(key))) continue;
      const proof = explainClaim(hit.id, 'western', chartContext('western', parsed[0].confirmedFacts), undefined, catalog);
      assert.ok(proof.matched, hit.id);
      assert.match(proof.calculationNote, /第五宫篇/u);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
      for (const key of keys) seen.add(key);
    }
    assert.doesNotMatch(materials, /western_lilly_children|lilly-1647-fifth-house-testimonies-v1/u);
  }
  assert.deepEqual(seen, expected);
  const changed = structuredClone(catalog.get(id(13)).claim);
  changed.evidence.context += ' Changed source context.';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  for (const number of [46, 47, 48]) assert.equal(catalog.get(id(number)).reason, 'unsupported_calculation_profile');
});

test('the qualifying star must be the same body, including when nodes or overlapping signs are present', () => {
  const cusps = syntheticCusps(0);
  const split = [...cusps, longitude('Jupiter', 125), longitude('Saturn', 117)];
  assert.equal(explain(6, split).matched, true);
  assert.equal(explain(7, split).matched, true);
  assert.equal(explain(16, split).matched, false);
  assert.equal(explain(16, [...cusps, longitude('Jupiter', 117)]).matched, true);
  const node = { kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude: 117 };
  const chart = [...cusps, node];
  assert.equal(explain(14, chart).matched, true);
  assert.equal(explain(15, chart).matched, true);
  assert.equal(explain(16, chart).matched, true);
  const forged = [...cusps, { kind: 'western_lilly_children', selector: 'body.north_node' }];
  assert.equal(explain(14, forged).matched, false);
  assert.ok(!hits(lookup(query(forged))).some(hit => hit.id === id(14)));
  const pisces = [...syntheticCusps(210), longitude('Jupiter', 335)];
  assert.equal(explain(16, pisces).matched, true);
  assert.equal(explain(41, pisces).matched, false, 'the source group explicitly requires only the common class');
  assert.equal(explain(42, pisces).matched, false, 'the source group explicitly requires only the fruitful class');
});

test('empty houses, whole-chart signs and fifth-ruler retrogradation need complete verified data', () => {
  const fertile = raw(witnesses[5]);
  assert.equal(explain(13, fertile).matched, true);
  assert.equal(explain(28, fertile).matched, true);
  const incomplete = fertile.filter(f => !(f.planet === 'Saturn' && ['planet_longitude', 'planet_sign'].includes(f.kind)));
  assert.equal(explain(13, incomplete).matched, false);
  assert.equal(explain(28, incomplete).matched, false);
  assert.equal(explain(13, fertile, 'annual').matched, false);
  assert.ok(!hits(lookup(query(fertile, false))).some(hit => reviewed.has(hit.id)));
  const retrograde = raw(witnesses[3]);
  const fifthLord = lillyHouseFacts(retrograde).find(f => f.kind === 'western_lilly_house_ruler' && f.house === 5).planet;
  assert.equal(explain(36, retrograde).matched, true);
  assert.equal(explain(36, [...retrograde, { kind: 'planet_motion', planet: fifthLord, motion: 'direct' }]).matched, false);
});
