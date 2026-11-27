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
import { quanshuZhuxingWendaProfile } from './quanshu-zhuxing-wenda.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-chart-passages-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const sunClaim = 'ziwei-v1-zhuxing-wenda-p110000-013';
const claimId = key => key === 'sun' ? sunClaim : 'ziwei-v3-jielan-135-p001-' + key;
const fixtures = [
  [[1924, 1, 1, 1], '008/0', '030/0'],
  [[1924, 1, 1, 3], '010/0'],
  [[1924, 1, 1, 4], '025/1'],
  [[1924, 1, 1, 5], '029/0/1'],
  [[1924, 1, 1, 11], '029/0'],
  [[1924, 1, 8, 0], '022/0'],
  [[1924, 1, 8, 7], '011/0'],
  [[1924, 1, 8, 9], '012/0', '031/0'],
  [[1924, 2, 8, 9], '025/0', '019/0'],
  [[1924, 3, 1, 0], '009/0'],
  [[1924, 3, 1, 7], '005/0'],
  [[1924, 3, 6, 0], '010/1'],
  [[1924, 4, 1, 4], '018/0'],
  [[1924, 4, 8, 10], '002/0'],
  [[1924, 4, 15, 8], '023/0'],
  [[1924, 5, 15, 9], '009/1'],
  [[1924, 6, 15, 1], '019/1'],
  [[1924, 9, 1, 2], '006/0', '021/0'],
  [[1924, 10, 1, 1], '003/0'],
  [[1924, 12, 1, 0], '016/0'],
  [[1925, 2, 22, 0], '028/0'],
  [[1925, 12, 8, 0], '001/0'],
  [[1926, 3, 1, 3], '026/0'],
  [[1926, 7, 12, 4], '034/0'],
  [[1926, 9, 15, 1], '014/0'],
  [[1926, 11, 8, 10], '027/0'],
  [[1927, 3, 8, 6], '033/0'],
  [[1927, 5, 2, 4], '007/0'],
  [[1927, 9, 8, 8], '006/1'],
  [[1927, 9, 10, 5], '034/0'],
  [[1927, 10, 12, 2], '004/0'],
  [[1928, 4, 8, 11], '023/0'],
  [[1928, 11, 18, 6], '034/0'],
  [[1928, 12, 15, 7], '032/0'],
  [[1930, 1, 1, 7], '034/0'],
  [[1930, 9, 22, 6], 'sun/0'],
  [[1932, 5, 19, 2], '013/0'],
];

function factsFor([year, month, day, hour]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'male' }, hour));
}

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

function factsForPassage(key) {
  return factsFor(fixtures.find(([, ...keys]) => keys.includes(key))[0]);
}

const explain = (key, facts) => explainClaim(claimId(key), 'ziwei', query(facts).context, undefined, catalog);

test('every reviewed passage is reachable from a native chart and feeds the exact matched text to the report', () => {
  const records = new Set(fixtures.flatMap(([, ...cases]) => cases.map(key => key.split('/')[0])));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    assert.equal(inventory.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, key === 'sun' ? quanshuZhuxingWendaProfile : jielanNatalStarProfile);
      inputs.forEach((input, group) => expected.set(group === 0 ? `${key}/${index}` : `${key}/${index}/${group}`, { text, input }));
    });
  }
  const checked = new Set();
  for (const [birth, ...cases] of fixtures) {
    const { queries, context } = query(factsFor(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const passage of cases) {
      const id = claimId(passage.split('/')[0]);
      const { text, input } = expected.get(passage);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, passage);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, passage);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), passage);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), passage);
      assert.doesNotMatch(material, /终主凶亡|祖宗即如帝胄|是为财入财乡|恐.*净身|僧道有師號/u, passage);
      checked.add(passage);
    }
  }
  assert.deepEqual([records.size, expected.size, fixtures.length], [31, 37, 37]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the two chart seats and the actual opposite palace are required', () => {
  const harmony = factsForPassage('001/0');
  assert.equal(explain('001', harmony).matched, true);
  assert.equal(explain('001', harmony.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文曲')).matched, false);

  const reign = factsForPassage('007/0');
  assert.equal(explain('007', reign).matched, true);
  assert.equal(explain('007', reign.map(fact => fact.kind === 'palace_star' && fact.star === '凤阁'
    ? { ...fact, palace: '财帛' } : fact)).matched, false);

  const lifeBody = factsForPassage('011/0');
  assert.equal(explain('011', lifeBody).matched, true);
  assert.equal(explain('011', lifeBody.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
});

test('the Sun passage requires the correct natal Lu carrier and all four malefics', () => {
  const facts = factsForPassage('sun/0');
  assert.equal(explain('sun', facts).matched, true);
  assert.equal(explain('sun', facts.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '太阳')).matched, false);
  assert.equal(explain('sun', facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '铃星')).matched, false);
});

test('the follow-up passages preserve the authentic chart seat, carrier and void family', () => {
  const purpleBody = factsForPassage('013/0');
  assert.equal(explain('013', purpleBody).matched, true);
  assert.equal(explain('013', purpleBody.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);

  const oppositeLu = factsForPassage('023/0');
  assert.equal(explain('023', oppositeLu).matched, true);
  assert.equal(explain('023', oppositeLu.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '禄')).matched, false);
  assert.deepEqual(fixtures.filter(([, ...keys]) => keys.includes('023/0')).map(([birth]) =>
    factsFor(birth).find(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === '禄存').palace), ['迁移', '命宫']);

  const moonAndSkies = factsForPassage('034/0');
  assert.equal(explain('034', moonAndSkies).matched, true);
  assert.equal(explain('034', moonAndSkies.map(fact => fact.kind === 'palace_star' && fact.star === '天空'
    ? { ...fact, star: '地空' } : fact)).matched, false);
  assert.deepEqual(fixtures.filter(([, ...keys]) => keys.includes('034/0')).map(([birth]) =>
    factsFor(birth).find(fact => fact.kind === 'palace_branch' && fact.palace === '命宫').branch), [...'卯辰巳午']);

  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  for (const key of ['015', '017', '020', '024']) assert.equal(inventory.get(claimId(key)), 'unmapped');
});
