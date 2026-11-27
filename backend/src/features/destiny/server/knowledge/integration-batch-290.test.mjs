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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-sun-and-wu-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `ziwei-v4-jielan-${key.replace('-', '-p002-')}`;
const witnesses = [
  [[1924, 1, 1, 2], '143-002/0', '143-003/0'],
  [[1924, 1, 1, 2, 'female'], '144-001/0', '144-003/0', '144-005/0'],
  [[1924, 1, 1, 4], '145-001/0'],
  [[1924, 1, 1, 7], '142-009/0'],
  [[1924, 1, 1, 7, 'female'], '142-009/2'],
  [[1924, 1, 1, 11], '145-005/0', '145-005/1', '145-007/0', '145-015/0'],
  [[1924, 1, 8, 2, 'female'], '144-001/1', '144-005/1'],
  [[1924, 1, 15, 2, 'female'], '142-017/0/1', '142-018/0/1'],
  [[1924, 1, 15, 10, 'female'], '142-017/0/0', '142-018/0/0'],
  [[1924, 2, 8, 2], '143-002/1'],
  [[1924, 2, 8, 10], '142-009/1'],
  [[1924, 6, 8, 5], '143-001/0'],
  [[1924, 8, 8, 5], '145-012/0'],
  [[1926, 4, 1, 2], '143-001/1'],
  [[1928, 3, 1, 0, 'female'], '144-002/0', '144-002/1'],
  [[1930, 2, 22, 0], '142-004/0/0'],
  [[1930, 3, 15, 11], '142-004/0/1'],
  [[1931, 2, 22, 2, 'female'], '142-017/1/1'],
  [[1931, 3, 1, 6], '143-003/1'],
  [[1931, 3, 1, 10, 'female'], '142-017/1/0'],
  [[1931, 5, 1, 2], '143-003/2'],
  [[1934, 12, 1, 1], '142-020/0'],
  [[1946, 5, 15, 4], '143-001/2'],
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

test('the reviewed solar and Wu Qu passages are available through the indexed report lookup', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const keys = new Set(witnesses.flatMap(([, ...expected]) => expected.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of keys) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, conditionCompiler, inputs }, index) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, alternate) => groups.set(`${key}/${index}/${alternate}`, { text, input }));
    });
  }

  for (const [birth, ...expected] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of expected) {
      const [id, branch, group = '0'] = key.split('/');
      const groupKey = `${id}/${branch}/${group}`;
      const hit = hits.find(row => row.id === claimId(id));
      assert.ok(hit, key);
      const { text, input } = groups.get(groupKey);
      const audited = explainClaim(hit.id, 'ziwei', context, undefined, catalog);
      assert.deepEqual(hit.matchedBranches, audited.matchedBranches, key);
      assert.ok(hit.matchedBranches.some(row => row.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /先克其父|一生穷|寿不长|木压雷惊|因色破家|富贵极品/u, key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      verified.add(groupKey);
    }
  }

  assert.deepEqual([keys.size, groups.size, witnesses.length], [17, 33, 23]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['142-019', '145-006', '145-008', '145-009', '145-027']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('an absent or unconfirmed natal carrier cannot satisfy the solar transformation passages', () => {
  const clearSun = native('142-004/0/0');
  assert.equal(explain('142-004', clearSun).matched, true);
  assert.equal(explain('142-004', clearSun.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '太阳')).matched, false);

  const doubleLuminary = native('143-001/1');
  assert.ok(explain('143-001', doubleLuminary).matchedBranches.some(({ text }) => text === '三方无化'));
  const partial = doubleLuminary.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.deepEqual(explain('143-001', partial).matchedBranches.map(({ text }) => text), ['日月丑未命中逢']);
});

test('a confirmed Body seat and the proper original void star are required', () => {
  const body = native('144-002/0');
  assert.equal(explain('144-002', body).matched, true);
  assert.equal(explain('144-002', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);

  const wu = native('145-007/0');
  const named = ['旬空', '截路', '空亡'];
  const otherVoid = wu.filter(fact => fact.kind !== 'palace_star' || !named.includes(fact.star));
  assert.equal(explain('145-007', wu).matched, true);
  assert.equal(explain('145-007', otherVoid).matched, false);
});
