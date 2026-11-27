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
import { quanshuMinggongPassageProfile } from './quanshu-minggong-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-idle-placements-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-minggong-' + key;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 0, 'female'], 'p242001-004/0/0'],
  [[1924, 3, 1, 1, 'female'], 'p109002-001/0/0'],
  [[1924, 4, 8, 7, 'male'], 'p195000-003/1/1'],
  [[1924, 7, 1, 5, 'female'], 'p323001-030/0/0'],
  [[1924, 10, 1, 1, 'female'], 'p219000-002/0/0', 'p323001-037/0/1', 'p323001-037/1/1'],
  [[1924, 10, 1, 5, 'female'], 'p323001-037/0/0', 'p323001-037/1/0'],
  [[1924, 10, 1, 9, 'female'], 'p323001-037/0/2', 'p323001-037/1/2'],
  [[1925, 1, 1, 9, 'male'], 'p201000-002/0/0'],
  [[1925, 6, 8, 0, 'female'], 'p109002-001/1/1'],
  [[1925, 8, 1, 2, 'male'], 'p195000-003/0/0'],
  [[1925, 11, 1, 10, 'male'], 'p109002-001/1/0'],
  [[1926, 3, 1, 7, 'female'], 'p319003-001/0/0'],
  [[1926, 5, 1, 5, 'female'], 'p323001-034/0/0'],
  [[1926, 12, 1, 5, 'female'], 'p109002-001/2/1'],
  [[1927, 3, 1, 2, 'male'], 'p109002-001/3/0'],
  [[1927, 4, 1, 1, 'male'], 'p323001-021/0/0'],
  [[1927, 5, 1, 6, 'male'], 'p201000-002/0/1'],
  [[1927, 9, 8, 3, 'female'], 'p109002-001/3/1'],
  [[1928, 9, 8, 3, 'male'], 'p112000-002/0/0'],
  [[1929, 11, 1, 6, 'male'], 'p195000-003/1/0'],
  [[1930, 7, 1, 6, 'female'], 'p109002-003/0/0'],
  [[1936, 6, 1, 5, 'female'], 'p109002-001/2/0'],
  [[1937, 1, 1, 3, 'male'], 'p195000-003/0/1'],
  [[1945, 11, 8, 1, 'male'], 'p323001-003/0/2'],
  [[1946, 7, 8, 7, 'female'], 'p323001-003/0/0'],
  [[1949, 2, 8, 3, 'male'], 'p323001-003/0/3'],
  [[1950, 6, 8, 4, 'female'], 'p323001-003/0/1'],
];

const factsFor = ([year, month, day, hour, gender]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const native = key => factsFor(witnesses.find(([, ...cases]) => cases.includes(key))[0]);

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts, timeKnown) => explainClaim(claimId(key), 'ziwei',
  query(facts, timeKnown).context, '紫微斗数全书', catalog);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);

test('each reviewed natal placement reaches SQLite and the default report', () => {
  const records = new Set(witnesses.flatMap(([, ...cases]) => cases.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, quanshuMinggongPassageProfile);
      inputs.forEach((input, alternative) => expected.set(`${key}/${index}/${alternative}`, { text, input }));
    });
  }
  const checked = new Set();
  for (const [birth, ...cases] of witnesses) {
    const { queries, context } = query(factsFor(birth)), derived = claimChartContext('ziwei', context);
    const results = hits(lookup(queries));
    for (const condition of cases) {
      const key = condition.split('/')[0], { text, input } = expected.get(condition);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, condition);
      const hit = results.find(row => row.id === claimId(key));
      const proof = explainClaim(claimId(key), 'ziwei', context, undefined, catalog);
      assert.ok(hit && proof.matched, condition);
      assert.deepEqual(hit.matchedBranches, proof.matchedBranches, condition);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), condition);
      assert.doesNotMatch(material, /退尽家财|若不伤肢|下贱淫娼|夕死不耐久|化忌目疾|先贫后富/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [13, 31, 27]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('Tianji idle placement requires its natal Ji, and both are kept separate from brightness', () => {
  const facts = native('p112000-002/0/0');
  const proof = explain('p112000-002', facts);
  assert.equal(proof.matched, true);
  const required = proof.matchedBranches[0].matchedConditions.required;
  assert.ok(required.some(fact => fact.kind === 'palace_branch' && fact.branch === '巳'));
  assert.ok(required.some(fact => fact.kind === 'palace_source_brightness' && fact.brightness === '平'));
  assert.equal(explain('p112000-002', facts.filter(fact => fact.kind !== 'star_mutagen')).matched, false);
});

test('the activated Wen Chang passage follows the source table and keeps the female qualifier', () => {
  const facts = native('p323001-037/0/0');
  assert.equal(explain('p323001-037', facts).matched, true);
  const wrongStar = facts.map(fact => fact.kind === 'palace_star' && fact.palace === '命宫' && fact.star === '文昌'
    ? { ...fact, star: '破军' } : fact);
  assert.equal(explain('p323001-037', wrongStar).matched, false);
  const male = facts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact);
  assert.equal(explain('p323001-037', male).matched, false);
});

test('Wu and Tianxiang in Life require Po actually across the axis', () => {
  const facts = native('p323001-021/0/0');
  assert.equal(explain('p323001-021', facts).matched, true);
  const missingOpposition = facts.filter(fact => !(fact.kind === 'palace_relation' && fact.anchor === '命宫'
    && fact.target === '迁移' && fact.relation === 'opposite'));
  assert.equal(explain('p323001-021', missingOpposition).matched, false);
});

test('the source Sun fall passage requires an opposing malefic', () => {
  const facts = native('p323001-003/0/0');
  assert.equal(explain('p323001-003', facts).matched, true);
  const partial = facts.filter(fact => !(fact.kind === 'palace_star' && fact.palace === '迁移'
    && ['擎羊', '陀罗'].includes(fact.star)));
  assert.equal(explain('p323001-003', partial).matched, false);
});
