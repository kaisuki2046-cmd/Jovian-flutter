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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-life-and-sun-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function claimId(key) {
  const [chapter, passage] = key.split('-');
  const page = ['137', '140'].includes(chapter) ? 'p001' : 'p002';
  return `ziwei-v4-jielan-${chapter}-${page}-${passage}`;
}

const witnesses = [
  [[1924, 1, 1, 1], '137-003/0/1'],
  [[1924, 1, 1, 2], '142-006/0/0'],
  [[1924, 1, 1, 3], '142-002/0/0'],
  [[1924, 1, 1, 7], '139-006/0/0'],
  [[1924, 1, 1, 9, 'female'], '137-002/0/0', '137-002/1/0'],
  [[1924, 1, 8, 0], '142-011/0/0', '137-003/0/0'],
  [[1924, 1, 8, 9], '137-001/0/0'],
  [[1924, 1, 8, 10], '142-010/1/0'],
  [[1924, 1, 15, 3], '142-012/0/0'],
  [[1924, 1, 22, 1], '142-015/0/0'],
  [[1924, 2, 1, 4], '139-009/0/0', '139-009/1/0'],
  [[1924, 2, 1, 4, 'female'], '141-002/0/0'],
  [[1924, 2, 15, 0], '137-004/0/0'],
  [[1924, 2, 22, 5], '139-001/0/1', '142-010/0/0'],
  [[1924, 4, 1, 9], '142-016/0/0'],
  [[1924, 4, 1, 10], '137-004/0/1'],
  [[1924, 4, 15, 1], '137-001/1/0'],
  [[1924, 4, 15, 2, 'female'], '141-004/0/0'],
  [[1924, 4, 22, 7], '142-012/1/0'],
  [[1924, 5, 8, 0], '142-007/0/1'],
  [[1924, 5, 8, 10], '142-007/0/2'],
  [[1924, 5, 22, 7], '142-008/0/0'],
  [[1924, 6, 1, 10], '142-007/0/3'],
  [[1924, 6, 22, 11], '142-005/0/0'],
  [[1924, 8, 22, 11], '137-006/0/0'],
  [[1924, 11, 1, 2], '142-007/0/0'],
  [[1924, 12, 22, 3, 'female'], '141-002/1/0', '141-005/0/0'],
  [[1925, 2, 8, 6, 'female'], '141-003/0/0'],
  [[1928, 2, 21, 10], '140-001/0/0'],
  [[1930, 5, 9, 4], '139-001/0/0'],
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

test('each reviewed placement reaches the current SQLite lookup and report with the matching subclause', () => {
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, conditionCompiler, inputs }, index) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, alternate) => groups.set(`${key}/${index}/${alternate}`, { text, input }));
    });
  }
  for (const [birth, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = groups.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /血光灾不测|两目少光明|退尽家财|飘蓬僧道|无媒自嫁|只好偏房/u, key);
      verified.add(key);
    }
  }
  assert.deepEqual([ids.size, groups.size, witnesses.length], [23, 35, 30]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const pending of ['137-005', '139-004', '139-008', '139-015']) assert.equal(states.get(claimId(pending)), 'unmapped');
});

test('Tianji needs its own natal Ji, and a Yang clash must come from the opposite palace', () => {
  const idle = native('140-001/0/0');
  assert.equal(explain('140-001', idle).matched, true);
  assert.equal(explain('140-001', idle.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '天机')).matched, false);

  const clash = native('141-002/1/0');
  assert.equal(explain('141-005', clash).matched, true);
  const withoutClash = native('141-002/0/0');
  const branches = explain('141-002', withoutClash).matchedBranches;
  assert.ok(branches.some(row => row.text === '天机巨火来相会'));
  assert.ok(branches.every(row => row.text !== '羊刃冲之'));
  assert.equal(explain('141-005', withoutClash).matched, false);
});

test('an accompanying Moon must actually cast an external witness', () => {
  const sun = native('142-007/0/0');
  assert.equal(explain('142-007', sun).matched, true);
  const sameSeat = sun.map(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === '太阴'
    ? { ...fact, palace: '命宫' } : fact);
  assert.equal(explain('142-007', sameSeat).matched, false);
});
