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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-purple-star-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => 'ziwei-v4-jielan-136-p002-' + key;
const witnesses = [
  [[1924, 1, 1, 0, 'male'], '010/0/0'],
  [[1924, 1, 1, 9, 'female'], '011/0/0'],
  [[1924, 1, 1, 10, 'male'], '009/0/0'],
  [[1924, 1, 8, 0, 'male'], '001/1/0', '004/0/0', '005/0/0', '005/1/0'],
  [[1924, 1, 8, 9, 'female'], '002/0/0', '004/0/0', '004/1/0', '006/0/0'],
  [[1924, 1, 15, 4, 'male'], '011/1/0'],
  [[1924, 1, 15, 5, 'female'], '009/1/0'],
  [[1924, 1, 22, 4, 'male'], '012/1/0'],
  [[1924, 1, 22, 5, 'female'], '002/0/1'],
  [[1924, 1, 22, 7, 'female'], '012/0/0'],
  [[1924, 1, 22, 10, 'male'], '014/0/0'],
  [[1924, 2, 8, 5, 'female'], '010/1/0'],
  [[1924, 2, 8, 9, 'female'], '006/1/0', '017/0/0', '018/0/0'],
  [[1924, 2, 15, 0, 'male'], '001/0/0'],
  [[1924, 2, 22, 7, 'female'], '004/0/0', '004/2/0'],
  [[1924, 3, 1, 4, 'male'], '004/0/0'],
  [[1924, 4, 1, 10, 'male'], '001/0/1', '013/0/0'],
  [[1924, 4, 8, 7, 'female'], '013/0/1'],
  [[1924, 4, 15, 1, 'female'], '020/0/0'],
  [[1924, 4, 15, 9, 'female'], '008/0/1'],
  [[1924, 5, 8, 4, 'male'], '015/0/0'],
  [[1924, 5, 15, 3, 'female'], '015/0/1'],
  [[1924, 6, 22, 4, 'male'], '002/1/0', '003/0/0'],
  [[1924, 7, 1, 11, 'female'], '008/0/0'],
  [[1925, 11, 15, 8, 'male'], '002/1/2'],
  [[1927, 10, 8, 10, 'male'], '002/1/1'],
];

const natalFacts = ([year, month, day, hour, gender]) =>
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

const proof = (key, facts) => explainClaim(claimId(key), 'ziwei', query(facts).context, undefined, catalog);

test('every reviewed group reaches the indexed lookup and only matched passages can reach the report', () => {
  const records = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map(), checked = new Set(), poBranches = new Set();
  for (const key of records) {
    assert.equal(inventory.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, group) => expected.set(`${key}/${index}/${group}`, { text, input }));
    });
  }
  for (const [birth, ...keys] of witnesses) {
    const facts = natalFacts(birth);
    const { queries, context } = query(facts);
    const derived = claimChartContext('ziwei', context);
    const matches = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = expected.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = matches.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const material = buildReportMaterials([{ topic: hit.topic, events: [hit], personality: [] }]);
      assert.ok(material.includes(text), key);
      assert.doesNotMatch(material, /鼠窃狗偷群|富贵双全|飘荡落风尘|男主妻贵|晚年发达/u, key);
      if (key === '004/0/0') {
        const po = facts.find(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === '破军');
        poBranches.add(facts.find(fact => fact.kind === 'palace_branch' && fact.palace === po.palace).branch);
      }
      checked.add(key);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [17, 34, 26]);
  assert.deepEqual(checked, new Set(expected.keys()));
  assert.deepEqual(poBranches, new Set('辰戌丑未'));
  for (const key of ['007', '019', '021']) assert.equal(inventory.get(claimId(key)), 'unmapped');
});

test('an incomplete chart cannot prove the absence of aides, and a same-seat star is not an external witness', () => {
  const alone = native('001/1/0');
  assert.ok(proof('001', alone).matchedBranches.some(row => row.text === '无相为孤君'));
  const incomplete = alone.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '官禄');
  assert.ok(proof('001', incomplete).matchedBranches.every(row => row.text !== '无相为孤君'));

  const exterior = native('002/1/0');
  assert.ok(proof('002', exterior).matchedBranches.some(row => row.text === '又得左右昌曲拱冲'));
  const next = exterior.map(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === '左辅'
    ? { ...fact, palace: '命宫' } : fact);
  assert.ok(proof('002', next).matchedBranches.some(row => row.text === '在身命遇天府'));
  assert.ok(proof('002', next).matchedBranches.every(row => row.text !== '又得左右昌曲拱冲'));
});

test('body-only evidence requires the birth hour to confirm the actual Body palace', () => {
  const facts = native('008/0/1');
  assert.equal(proof('008', facts).matched, true);
  assert.equal(proof('008', facts.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
});
