import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyEnemiesProfile } from './lilly-enemies.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-enemies-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const place = { latitude: 31.23, longitude: 121.47 };
const witnesses = [
  '1989-01-01T00:15:00Z',
  '1989-01-02T07:15:00Z',
  '1989-01-03T14:15:00Z',
  '1989-01-04T21:15:00Z',
  '1989-01-06T04:15:00Z',
  '1989-06-20T12:15:00Z',
  '1989-06-21T19:15:00Z',
  '1990-12-18T21:15:00Z',
  '1993-03-06T11:15:00Z',
];
const id = number => 'astro-lilly-v3-enemies-p' + String(number).padStart(3, '0') + '-001';
const reviewed = new Set([4, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18].map(id));
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const motion = (planet, motion) => ({ kind: 'planet_motion', planet, motion });
const proofKey = (id, required) => JSON.stringify([id, required]);
const testimony = (selector, table = 'main') => ({ kind: 'western_lilly_enemies', table, selector });
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(number, facts) {
  return explainClaim(id(number), 'western', chartContext('western', facts), undefined, catalog);
}

test('all 12 reviewed records and their 21 alternatives reach SQLite and the report from native charts', () => {
  const expected = new Set();
  for (const sourceId of reviewed) {
    const row = catalog.get(sourceId);
    assert.equal(row.compiler, lillyEnemiesProfile);
    assert.equal(row.remainingAlternatives, sourceId === id(9) ? 1 : 0);
    for (const input of row.inputs) expected.add(proofKey(sourceId, input.required));
  }
  assert.equal(expected.size, 21);
  const seen = new Set();
  for (const instant of witnesses) {
    const parsed = query(raw(instant));
    const references = lookup(parsed);
    const materials = buildReportMaterials(references);
    for (const hit of hits(references).filter(hit => reviewed.has(hit.id))) {
      const { required, alternatives } = hit.matchedConditions;
      const keys = (alternatives.length ? alternatives : [required]).map(group => proofKey(hit.id, group));
      assert.ok(keys.every(key => expected.has(key)), hit.id);
      if (keys.every(key => seen.has(key))) continue;
      const proof = explainClaim(hit.id, 'western', chartContext('western', parsed[0].confirmedFacts), undefined, catalog);
      assert.ok(proof.matched, hit.id);
      assert.match(proof.calculationNote, /莉莉卷三对立关系篇/u);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
      for (const key of keys) seen.add(key);
    }
  }
  assert.deepEqual(seen, expected);
  const changed = structuredClone(catalog.get(id(8)).claim);
  changed.evidence.context += ' revised';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  const pairedChartSource = catalog.get(id(24));
  assert.equal(pairedChartSource.reason, 'unsupported_calculation_profile');
});

test('empty houses require all classical positions and are never inferred or accepted from injected facts', () => {
  const complete = raw(witnesses[2]);
  assert.ok(explain(10, complete).matched);
  const removeMercury = complete.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mercury');
  const injected = removeMercury.concat(testimony('seventh_empty'), testimony('twelfth_empty'));
  assert.equal(explain(10, injected).matched, false);
  assert.equal(query(injected)[0].confirmedFacts.some(fact => fact.kind === 'western_lilly_enemies'), false);
  assert.equal(hits(lookup(query(complete, false))).some(hit => hit.id === id(10)), false);
  assert.equal(explain(10, complete.filter(fact => fact.kind !== 'western_profile_cusp_longitude')).matched, false);
});

test('one opposition between the luminaries alone never proves two oppositions to other bodies', () => {
  const cusps = raw(witnesses[0]).filter(fact => ['western_zodiac', 'western_profile_system', 'western_profile_cusp_longitude'].includes(fact.kind));
  const onlyLights = cusps.concat(longitude('Sun', 15), longitude('Moon', 195));
  assert.equal(explain(9, onlyLights).matched, false);
  assert.ok(explain(9, onlyLights.concat(longitude('Mars', 195), longitude('Jupiter', 15))).matched);
  const wide = explain(9, raw(witnesses[5]));
  assert.ok(wide.matched);
  assert.ok(wide.matchedConditions.required.some(fact => fact.kind === 'western_lilly_enemies' && fact.table === 'main'));
  assert.match(wide.calculationNote, /另一套表未满足/u);
});

test('absence of aspect needs two distinct known rulers and does not assume conjunction is absence', () => {
  const cusps = Array.from({ length: 12 }, (_, index) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: 10 + index * 30,
  }));
  const base = [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' }, ...cusps];
  const mars = longitude('Mars', 10);
  assert.ok(explain(4, base.concat(mars, longitude('Jupiter', 48))).matched);
  assert.equal(explain(4, base.concat(mars)).matched, false);
  assert.equal(explain(4, base.concat(mars, longitude('Jupiter', 10))).matched, false);
  assert.equal(explain(4, base.concat(mars, longitude('Jupiter', 190))).matched, false);
  const shared = base.map(f => f.house === 12 ? { ...f, longitude: 3 } : f);
  assert.equal(explain(4, shared.concat(mars, longitude('Jupiter', 48))).matched, false);
});

test('twelfth-house retrograde testimony requires the actual cusp lord’s motion, debility and house', () => {
  const complete = raw(witnesses[7]);
  const lord = lillyHouseFacts(complete).find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 12).planet;
  assert.ok(explain(18, complete).matched);
  const noMotion = complete.filter(fact => fact.kind !== 'planet_motion' || fact.planet !== lord);
  assert.equal(explain(18, noMotion.concat(motion(lord === 'Mars' ? 'Jupiter' : 'Mars', 'retrograde'))).matched, false);
  assert.equal(explain(18, complete.concat(motion(lord, 'direct'))).matched, false);
  assert.equal(explain(18, noMotion.concat(motion(lord, 'retrograde'))
    .filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== lord)).matched, false);
});
