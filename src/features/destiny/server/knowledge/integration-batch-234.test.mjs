import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyBookThreeRoles, lillyBookThreeRolesProfile } from './lilly-book-three-roles.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-book-three-roles-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const tradition = 'Christian Astrology';
const location = { latitude: 31.23, longitude: 121.47 };
const idOf = passage => 'astro-lilly-v3-' + passage + '-001';
const native = date => chartFacts.western(calculateWestern(Date.parse(date), location));

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, chart: chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}
const explain = (passage, raw, historicalAphorism = false, timeKnown = true) =>
  explainClaim(idOf(passage), 'western', request(raw, timeKnown).chart, tradition, catalog, { historicalAphorism });
const evidenceOf = result => result.matchedConditions.required;

const witnesses = [
  ['1980-01-01T00:00Z', ['enemies-p019'],
    ['enemies-p147', 'enemies-p148', 'enemies-p149', 'enemies-p150', 'enemies-p152', 'enemies-p158']],
  ['1980-01-03T01:00Z', ['enemies-p006', 'health-servants-p002'], ['enemies-p153']],
  ['1980-01-07T03:00Z', ['health-servants-p003', 'health-servants-p005'], []],
  ['1980-01-29T14:00Z', [], ['enemies-p156']],
  ['1980-07-01T19:00Z', ['health-servants-p008'], []],
  ['1981-03-08T00:00Z', [], ['enemies-p157']],
  ['1983-04-15T00:00Z', ['health-servants-p007'], []],
  ['1983-06-04T01:00Z', ['enemies-p020'], []],
  ['1984-01-18T19:00Z', [], ['enemies-p155']],
];

test('all sources use native chart evidence and ordinary reports only include eligible records', () => {
  const ordinary = new Set(witnesses.flatMap(([, reports]) => reports.map(idOf)));
  const historical = new Set(witnesses.flatMap(([, , references]) => references.map(idOf)));
  assert.deepEqual([ordinary.size, historical.size], [8, 10]);
  for (const [date, reports, references] of witnesses) {
    const raw = native(date);
    const report = new Map(lookup(request(raw).queries).flatMap(({ events, personality }) =>
      [...events, ...personality].map(hit => [hit.id, hit])));
    assert.ok([...report].every(([id]) => !historical.has(id)));
    for (const passage of [...reports, ...references]) {
      const id = idOf(passage);
      const row = catalog.get(id);
      assert.equal(row.compiler, lillyBookThreeRolesProfile, id);
      assert.equal(row.inputs.length, 1, id);
      const changed = structuredClone(row.claim);
      changed.evidence.context += '异本文字';
      assert.equal(compileLillyBookThreeRoles(changed).reason, 'source_review_required', id);
      const result = explain(passage, raw, historical.has(id));
      assert.ok(result.matched, id);
      assert.ok(evidenceOf(result).length > 2, id);
      for (const fact of evidenceOf(result)) assert.doesNotMatch(factText(fact), /undefined|NaN/u, id);
      if (historical.has(id)) {
        assert.equal(row.matchScope, 'historical_aphorism', id);
        assert.equal(explain(passage, raw).reason, 'historical_aphorism_requires_opt_in', id);
      } else {
        const hit = report.get(id);
        assert.ok(hit, id);
        assert.deepEqual(hit.matchedConditions, result.matchedConditions, id);
        const material = buildReportMaterials([{ topic: hit.topic, events: [hit], personality: [] }]);
        assert.ok(material.includes(row.claim.evidence.original_text), id);
      }
    }
  }
});

test('source alternatives retain their planet roles and both chapters return matching evidence', () => {
  const first = evidenceOf(explain('enemies-p019', native('1980-01-01T00:00Z')));
  assert.ok(first.some(f => f.kind === 'western_lilly_reception' && f.first === 'mars' && f.reception === 'exaltation'));
  const mutual = evidenceOf(explain('enemies-p019', native('1980-04-02T22:00Z')));
  assert.ok(mutual.some(f => f.kind === 'western_lilly_reception' && f.reception === 'mutual_domicile'));
  const opposition = evidenceOf(explain('enemies-p149', native('1980-01-01T00:00Z'), true));
  assert.ok(opposition.some(f => f.kind === 'western_lilly_aspect' && f.aspect === 'opposition'));
  const seventh = evidenceOf(explain('enemies-p149', native('1980-01-03T01:00Z'), true));
  assert.ok(seventh.some(f => f.kind === 'western_lilly_planet_house' && f.house === 7));
  for (const [date, marsHouse] of [['1981-03-08T00:00Z', 12], ['1981-03-30T11:00Z', 6]]) {
    const houses = evidenceOf(explain('enemies-p157', native(date), true)).filter(f => f.kind === 'western_lilly_planet_house');
    assert.equal(houses.find(f => f.planet === 'Mars').house, marsHouse);
    assert.equal(houses.find(f => f.planet === 'Saturn').house, 18 - marsHouse);
  }
  for (const [date, sign] of [['1982-08-14T22:00Z', 4], ['1980-01-01T00:00Z', 8]]) {
    const cusp = evidenceOf(explain('enemies-p158', native(date), true))
      .find(f => f.kind === 'western_profile_cusp_longitude' && f.house === 12);
    assert.equal(Math.floor(cusp.longitude / 30), sign);
  }
});

test('strength and population require confirmed coordinates while historical witnesses require known houses', () => {
  const weakest = native('1980-01-29T14:00Z');
  const highest = native('1984-01-18T19:00Z');
  assert.equal(explain('enemies-p155', weakest, true).matched, false);
  assert.equal(explain('enemies-p156', highest, true).matched, false);
  assert.equal(explain('enemies-p155', highest, true, false).matched, false);

  const mars = native('1983-06-04T01:00Z');
  const ranking = evidenceOf(explain('enemies-p020', mars)).filter(f => f.kind === 'western_lilly_wealth_score');
  assert.equal(ranking.length, 7);
  assert.ok(ranking.filter(f => f.planet !== 'Mars').every(f => f.max < ranking.find(row => row.planet === 'Mars').min));
  assert.equal(explain('enemies-p020', mars.filter(f => f.kind !== 'planet_longitude' || f.planet !== 'Saturn')).matched, false);
  const household = native('1980-01-03T01:00Z');
  assert.equal(explain('health-servants-p002', household.filter(f => f.kind !== 'planet_longitude' || f.planet !== 'Venus')).matched, false);
  const mercury = native('1980-01-07T03:00Z');
  assert.equal(explain('health-servants-p005', mercury.filter(f => f.kind !== 'planet_hourly_motion' || f.planet !== 'Mercury')).matched, false);
});
