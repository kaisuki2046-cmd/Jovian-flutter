import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-fu-yin-and-followups-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `ziwei-v4-jielan-${key.replace('-', '-p001-')}`;
const witnesses = [
  [[1924, 1, 1, 3], '156-006/0/0', '162-014/0/0', '166-004/0/0', '166-016/0/0'],
  [[1924, 1, 1, 4, 'female'], '155-002/0/1', '155-002/1/1'],
  [[1924, 1, 1, 4], '154-003/0/1', '164-003/0/0'],
  [[1924, 1, 1, 6], '162-003/0/0', '156-020/0/0'],
  [[1924, 1, 1, 9, 'female'], '155-002/0/0'],
  [[1924, 1, 1, 9], '155-001/0/0', '154-004/0/0', '155-003/0/0'],
  [[1924, 1, 1, 10, 'female'], '156-027/0/0'],
  [[1924, 1, 1, 11], '160-001/0/0'],
  [[1924, 1, 8, 0], '156-010/0/0'],
  [[1924, 1, 8, 6], '159-017/0/0'],
  [[1924, 1, 15, 3, 'female'], '155-002/1/0'],
  [[1924, 1, 15, 4], '154-003/0/0'],
  [[1924, 1, 22, 0], '154-003/1/0'],
  [[1924, 1, 22, 8], '162-009/0/0'],
  [[1924, 2, 15, 3], '156-024/0/0'],
  [[1924, 2, 22, 7], '154-003/1/1'],
  [[1924, 3, 8, 8], '165-002/0/0'],
  [[1924, 4, 1, 10], '159-013/0/0'],
  [[1924, 4, 8, 7, 'female'], '166-014/0/0'],
  [[1924, 10, 5, 4], '159-006/0/0'],
  [[1930, 3, 15, 4], '164-001/0/0'],
];

const natalFacts = ([year, month, day, hour, gender = 'male']) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const native = key => natalFacts(witnesses.find(([, ...keys]) => keys.includes(key))[0]);

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts) => explainClaim(claimId(key), 'ziwei', query(facts).context, undefined, catalog);

test('each reviewed condition is matched by the SQLite-backed lookup and supplies the exact passage to the report', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const inputsByKey = new Map(), verified = new Set();
  for (const id of ids) {
    assert.equal(states.get(claimId(id)), 'branch_indexed', id);
    catalog.get(claimId(id)).branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, index) => inputsByKey.set(`${id}/${branch}/${index}`, { text, input }));
    });
  }

  for (const [birth, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = inputsByKey.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /武曲禄存同会|左右禄存同宫|金冠霞帔|生离死别|口舌官灾/u, key);
      verified.add(key);
    }
  }
  assert.deepEqual([ids.size, inputsByKey.size, witnesses.length], [23, 29, 21]);
  assert.deepEqual(verified, new Set(inputsByKey.keys()));
});

test('the Body palace requires a birth hour and unverified continuations remain outside the matches', () => {
  const body = native('154-003/0/1');
  assert.equal(explain('154-003', body).matched, true);
  assert.equal(explain('154-003', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);

  for (const [key, fixture, matching] of [
    ['155-001', '155-001/0/0', '天府之星守命宫'],
    ['156-006', '156-006/0/0', '在财帛为庙乐'],
    ['156-010', '156-010/0/0', '在田宅为入庙'],
  ]) {
    assert.deepEqual(explain(key, native(fixture)).matchedBranches.map(({ text }) => text), [matching]);
  }

  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  for (const key of ['154-001', '156-007', '156-011', '156-013', '162-002', '162-007']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('the Fire star and the actual natal Ji carrier must have chart evidence', () => {
  const tan = native('159-006/0/0');
  assert.equal(explain('159-006', tan).matched, true);
  assert.equal(explain('159-006', tan.filter(fact => fact.kind !== 'palace_brightness' || fact.star !== '火星')).matched, false);

  const liang = native('166-014/0/0');
  assert.equal(explain('166-014', liang).matched, true);
  assert.equal(explain('166-014', liang.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌')).matched, false);
});
