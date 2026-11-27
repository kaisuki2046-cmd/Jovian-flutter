import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillySiblingsProfile } from './lilly-siblings.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-siblings-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const place = { latitude: 31.23, longitude: 121.47 };
const witnesses = [
  ['1993-12-23T18:15:00Z', [3, 13, 19, 20, 21, 24, 25, 27, 29, 30, 37]],
  ['1992-07-28T20:15:00Z', [14, 15, 16, 17, 24, 27, 30, 32, 38]],
  ['1992-04-24T20:15:00Z', [12, 14, 22, 23, 27, 28, 30]],
  ['1992-05-13T10:15:00Z', [12, 18, 21, 22, 26, 27, 30]],
];
const id = number => 'astro-lilly-v3-siblings-p' + String(number).padStart(3, '0') + '-001';
const reviewed = new Set([3, ...Array.from({ length: 19 }, (_, index) => 12 + index), 32, 37, 38].map(id));
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(number, facts, scope = 'natal') {
  return explainClaim(id(number), 'western', chartContext('western', facts, [], scope), undefined, catalog);
}

test('all 23 reviewed sibling conditions reach SQLite, explanations and report materials', () => {
  const seen = new Set();
  for (const [instant, numbers] of witnesses) {
    const parsed = query(raw(instant));
    const refs = lookup(parsed);
    const matched = hits(refs).filter(hit => reviewed.has(hit.id));
    assert.deepEqual(matched.map(hit => hit.id).sort(), numbers.map(id).sort(), instant);
    const materials = buildReportMaterials(refs);
    for (const number of numbers) {
      const row = catalog.get(id(number));
      const proof = explain(number, parsed[0].confirmedFacts);
      assert.equal(row.compiler, lillySiblingsProfile);
      assert.equal(row.inputs.length, 1);
      assert.equal(row.remainingAlternatives, 0);
      assert.ok(proof.matched, id(number));
      assert.deepEqual(proof.matchedConditions.required, row.inputs[0].required);
      assert.match(proof.calculationNote, /手足篇/u);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), id(number));
      assert.ok(materials.includes(row.claim.evidence.original_text), id(number));
      seen.add(id(number));
    }
    assert.doesNotMatch(materials, /western_lilly_siblings|lilly-1647-siblings-testimonies-v1/u);
  }
  assert.deepEqual(seen, reviewed);
  const changed = structuredClone(catalog.get(id(3)).claim);
  changed.evidence.context += ' Changed source context.';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  assert.equal(catalog.get(id(31)).reason, 'unsupported_calculation_profile');
});

test('joint conditions need both verified signs and the natal Regiomontanus cusps', () => {
  const fruitful = raw(witnesses[0][0]);
  const cuspOnly = fruitful.filter(fact => !(['planet_longitude', 'planet_sign'].includes(fact.kind) && fact.planet === 'Jupiter'));
  const proof = explain(3, cuspOnly);
  assert.equal(proof.matched, false);
  assert.deepEqual(proof.missing, [{ kind: 'western_lilly_siblings', selector: 'house_3_ruler_prolific' }]);
  const conflict = [...fruitful, { kind: 'planet_sign', planet: 'Jupiter', sign: '白羊座' }];
  assert.equal(explain(3, conflict).matched, false);
  assert.equal(explain(3, fruitful, 'annual').matched, false);
  assert.equal(explain(32, raw(witnesses[2][0])).matched, false, 'Aries is only inclined to barrenness');
  assert.ok(!hits(lookup(query(fruitful, false))).some(hit => reviewed.has(hit.id)));
  const missingCusp = fruitful.filter(fact => !(fact.kind === 'western_profile_cusp_longitude' && fact.house === 3));
  const forged = [...missingCusp, { kind: 'western_lilly_siblings', selector: 'house_3_cusp_prolific' },
    { kind: 'western_lilly_siblings', selector: 'house_3_ruler_prolific' }];
  assert.ok(!hits(lookup(query(forged))).some(hit => reviewed.has(hit.id)));
  assert.equal(explain(3, forged).matched, false);
});

test('South Node enters the chapter at the five-degree boundary, and angular dignity needs both facts', () => {
  const nodeChart = raw(witnesses[2][0]);
  const boundary = lillyCusps(nodeChart)[2] - 5;
  const moveSouthNode = longitude => nodeChart.map(fact => fact.kind === 'western_true_node_longitude'
    ? { ...fact, longitude: (longitude + 180) % 360 } : fact);
  assert.equal(explain(28, moveSouthNode(boundary - 0.01)).matched, false);
  assert.equal(explain(28, moveSouthNode(boundary + 0.01)).matched, true);
  assert.equal(explain(28, nodeChart.filter(fact => fact.kind !== 'western_true_node_longitude')).matched, false);
  const saturnChart = raw(witnesses[0][0]);
  const missingSaturn = saturnChart.filter(fact => !(fact.kind === 'planet_longitude' && fact.planet === 'Saturn'));
  assert.equal(explain(37, missingSaturn).matched, false);
  assert.equal(explain(38, saturnChart).matched, false);
});
