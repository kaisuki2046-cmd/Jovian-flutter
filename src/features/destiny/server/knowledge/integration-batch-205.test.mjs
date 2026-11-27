import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFriendsProfile } from './lilly-friends.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-friend-strength-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const dates = [
  '1924-01-01T00:15Z', '1924-01-08T18:15Z', '1924-01-13T22:15Z', '1924-01-17T19:15Z',
  '1924-01-22T23:15Z', '1924-01-28T03:15Z', '1924-02-04T21:15Z', '1924-03-08T04:15Z',
  '1924-03-21T02:15Z', '1924-03-28T20:15Z', '1924-04-09T11:15Z', '1924-04-27T13:15Z',
  '1924-05-04T00:15Z', '1924-06-16T22:15Z', '1924-06-20T19:15Z', '1924-07-25T16:15Z',
  '1924-11-18T22:15Z', '1924-11-24T02:15Z', '1924-12-19T22:15Z', '1924-12-25T02:15Z',
  '1925-01-25T02:15Z', '1925-02-10T21:15Z', '1925-03-10T00:15Z', '1925-03-15T04:15Z',
  '1926-08-15T03:15Z', '1927-07-16T23:15Z', '1937-07-24T13:15Z', '1937-07-29T17:15Z',
];
const idFor = number => `astro-lilly-v3-friends-p${number}-001`;
const sourceIds = new Set(['002', '011', '014', '015', '016', '017'].map(idFor));
const conditionKind = 'western_lilly_friend_condition';
const native = date => chartFacts.western(calculateWestern(Date.parse(date), { latitude: 31.23, longitude: 121.47 }));
const key = (id, facts) => JSON.stringify([id, facts]);
const hitGroups = ({ required, alternatives }) => alternatives.length ? alternatives : [required];

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, chart: chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

function explain(number, facts, timeKnown) {
  return explainClaim(idFor(number), 'western', request(facts, timeKnown).chart, undefined, catalog);
}

test('native charts cover 38 friend testimony groups through SQLite, explanation and report materials', () => {
  const expected = new Set(), seen = new Set();
  for (const id of sourceIds) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyFriendsProfile);
    assert.equal(row.remainingAlternatives, id === idFor('002') ? 4 : 1);
    const changed = structuredClone(row.claim);
    changed.evidence.context = '另一本';
    assert.equal(compileWesternClaim(changed).reason, 'source_review_required', id);
    for (const input of row.inputs) {
      const condition = input.required.find(fact => fact.kind === conditionKind);
      const house = input.required.find(fact => fact.kind === 'western_lilly_planet_house');
      assert.equal(condition.planet, house.planet, id);
      expected.add(key(id, input.required));
    }
  }
  assert.equal(expected.size, 38);

  for (const date of dates) {
    const { queries, chart } = request(native(date));
    const references = lookup(queries);
    for (const hit of references.flatMap(topic => [...topic.personality, ...topic.events]).filter(hit => sourceIds.has(hit.id))) {
      const groups = hitGroups(hit.matchedConditions).map(facts => key(hit.id, facts));
      assert.ok(groups.every(group => expected.has(group)), hit.id);
      if (groups.every(group => seen.has(group))) continue;
      const proof = explainClaim(hit.id, 'western', chart, undefined, catalog);
      assert.ok(proof.matched, hit.id);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions, hit.id);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
      assert.match(proof.calculationNote, /同一颗行星/u);
      for (const group of groups) seen.add(group);
    }
  }
  assert.deepEqual(seen, expected);
});

test('a hostile contact uses one orb table and the actual first or eleventh house occupant', () => {
  const facts = native('1924-02-04T21:15Z');
  const proof = explain('017', facts);
  assert.ok(proof.matched);
  assert.deepEqual(hitGroups(proof.matchedConditions).flat().filter(fact => fact.kind === conditionKind)
    .map(({ planet, table }) => [planet, table]), [['Sun', 'main']]);
  assert.equal(explain('017', facts.filter(fact => !(fact.kind === 'planet_longitude' && fact.planet === 'Saturn'))).matched, false);
  assert.equal(explain('017', facts, false).matched, false);

  const movedOutside = native('1924-02-05T00:15Z');
  assert.equal(explain('017', movedOutside).matched, false);
  assert.equal(explain('017', [...movedOutside,
    { kind: conditionKind, planet: 'Sun', condition: 'afflicted', table: 'main' },
    { kind: 'western_lilly_planet_house', planet: 'Sun', house: 1 },
  ]).matched, false);
});
