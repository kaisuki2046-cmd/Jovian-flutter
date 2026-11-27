import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { analyzeBaZi } from '../../control/bazi-analysis.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileYuanhaiNatalPassages, yuanhaiNatalPassagesProfile } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-positions-and-phases-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1833, 1, 1, 0, '男'], 'v2-c261-p002-001/1/0'],
  [[1833, 1, 1, 12, '男'], 'v1-c155-p001-001/0/0', 'v3-c131-p002-501/0/0'],
  [[1833, 1, 5, 22, '男'], 'v3-c045-p002-005/0/0', 'v5-c053-p002-001/1/0'],
  [[1833, 1, 9, 0, '男'], 'v3-c045-p002-005/1/0'],
  [[1833, 1, 28, 10, '男'], 'v2-c261-p002-001/0/0'],
  [[1833, 2, 1, 10, '男'], 'v3-c015-p001-101/0/0'],
  [[1833, 2, 5, 6, '男'], 'v1-c351-p022-001/0/0'],
  [[1833, 4, 1, 6, '男'], 'v2-c399-p002-001/0/0', 'v3-c151-p005-002/0/0'],
  [[1833, 4, 9, 12, '男'], 'v3-c087-p005-002/0/0'],
  [[1833, 8, 9, 0, '男'], 'v3-c045-p002-004/0/0'],
  [[1869, 3, 9, 14, '男'], 'v2-c358-p002-101/0/0'],
  [[2016, 9, 7, 14, '男'], 'v1-c333-p014-001/0/3'],
  [[1936, 1, 1, 0, '男'], 'v1-c333-p014-001/0/1'],
  [[1964, 9, 9, 0, '男'], 'v1-c333-p014-001/0/4'],
  [[1833, 1, 5, 0, '男'], 'v4-c002-p003-001/0/0'],
  [[1833, 1, 5, 18, '男'], 'v5-c012-p004-001/0/0'],
  [[1833, 1, 13, 8, '男'], 'v3-c131-p002-003/0/0'],
  [[1833, 2, 5, 8, '男'], 'v4-c081-p022-001/0/1'],
  [[1833, 2, 13, 4, '男'], 'v4-c081-p022-001/1/2'],
  [[1833, 2, 17, 4, '男'], 'v4-c081-p022-001/0/2'],
  [[1833, 2, 21, 8, '男'], 'v4-c081-p022-001/1/1'],
  [[1833, 3, 17, 0, '男'], 'v3-c103-p002-001/0/0'],
  [[1833, 4, 5, 0, '男'], 'v4-c002-p003-001/0/1'],
  [[1833, 4, 17, 0, '男'], 'v4-c081-p022-001/0/0'],
  [[1833, 6, 21, 0, '男'], 'v4-c081-p022-001/1/0'],
  [[1843, 6, 28, 0, '男'], 'v4-c002-p008-001/0/0'],
  [[1847, 7, 21, 12, '男'], 'v4-c002-p005-002/0/3', 'v4-c002-p005-002/0/0'],
  [[1857, 6, 8, 14, '男'], 'v4-c002-p005-002/0/5'],
  [[1907, 1, 9, 0, '男'], 'v4-c186-p012-001/0/0'],
  [[1847, 5, 11, 18, '男'], 'v4-c002-p005-002/0/2'],
  [[1847, 5, 12, 12, '男'], 'v4-c002-p005-002/0/1'],
  [[1936, 11, 17, 4, '男'], 'v4-c081-p039-002/0/0'],
  [[1833, 1, 1, 22, '男'], 'v5-c449-p002-001/0/1'],
  [[1833, 1, 9, 18, '男'], 'v5-c060-p010-001/0/0'],
  [[1833, 2, 1, 6, '男'], 'v5-c449-p002-001/0/2'],
  [[1833, 2, 5, 0, '男'], 'v5-c449-p002-001/0/0'],
  [[1833, 2, 5, 10, '男'], 'v5-c449-p002-001/0/3'],
  [[1833, 2, 17, 20, '男'], 'v5-c315-p007-001/0/0'],
  [[1833, 3, 1, 2, '男'], 'v5-c451-p003-001/0/2'],
  [[1833, 7, 13, 18, '男'], 'v5-c451-p003-001/0/3'],
  [[1810, 12, 25, 2, '男'], 'v5-c071-p003-001/1/0'],
  [[1833, 12, 13, 8, '男'], 'v5-c451-p003-001/0/1'],
  [[1833, 12, 25, 16, '男'], 'v5-c349-p014-001/0/1'],
  [[1843, 2, 9, 8, '男'], 'v5-c293-p004-001/0/0'],
  [[1843, 11, 17, 4, '男'], 'v5-c293-p004-001/1/0'],
  [[1869, 1, 5, 6, '男'], 'v5-c349-p014-001/0/0'],
  [[1810, 2, 21, 8, '男'], 'v5-c071-p003-001/3/0'],
  [[1869, 3, 17, 12, '男'], 'v5-c298-p004-001/0/0'],
  [[1879, 1, 1, 8, '男'], 'v5-c053-p002-001/0/0'],
  [[1879, 2, 5, 10, '男'], 'v5-c451-p003-001/0/0'],
  [[1810, 10, 13, 10, '男'], 'v5-c071-p003-001/0/0'],
  [[1833, 2, 13, 4, '女'], 'v5-c422-p002-001/0/0'],
  [[1866, 9, 8, 6, '男'], 'v1-c333-p014-001/0/0'],
  [[1888, 9, 7, 14, '男'], 'v1-c333-p014-001/0/2'],
  [[1918, 9, 8, 20, '男'], 'v1-c333-p014-001/0/5'],
  [[1847, 7, 22, 10, '男'], 'v4-c002-p005-002/0/4'],
  [[1901, 9, 13, 6, '男'], 'v5-c071-p003-001/2/0'],
  [[1810, 9, 17, 10, '男'], 'v5-c287-p002-001/0/0'],
];

function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  const { method, indicators } = analyzeBaZi(chart).L2.assessments.fiveElementStrength.temperament;
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }, ...indicators.map(({ element, classification }) =>
    ({ kind: 'bazi_element_temperament', element, classification, profile: method }))];
}
const native = key => natalFacts(witnesses.find(([, ...keys]) => keys.includes(key))[0]);

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('bazi', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts, timeKnown) => explainClaim(claimId(key), 'bazi', query(facts, timeKnown).context, undefined, catalog);

test('Yuanhai stem order, Nayin and elemental evidence reach SQLite and report materials', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, yuanhaiNatalPassagesProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileYuanhaiNatalPassages(edited).reason, 'source_review_required', key);
  }

  for (const [birth, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('bazi', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = groups.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'bazi', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /清朝顯代|尅妻害子|一品之尊|富貴全|凶暴之徒|衣食不豊隆/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [32, 62, 58]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v3-c022-p002-003', 'v4-c186-p008-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('alternating stems cannot be satisfied by any two-stem set without alternating positions', () => {
  const positive = native('v2-c399-p002-001/0/0');
  const repeated = natalFacts([1833, 4, 1, 2]);
  assert.equal(new Set(repeated.filter(fact => fact.kind === 'stem').map(fact => fact.stem)).size, 2);
  for (const id of ['v2-c399-p002-001', 'v3-c151-p005-002']) {
    assert.equal(explain(id, positive).matched, true);
    assert.equal(explain(id, repeated).matched, false);
  }
});

test('Wealth and Seal order is exclusive and a changed hour cannot stand in for the native chart', () => {
  const order = 'v4-c081-p022-001';
  for (const [index, text] of [[0, '内財後印'], [1, '先印後財']]) {
    const facts = native(order + '/' + index + '/2');
    assert.deepEqual(explain(order, facts).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explain(order, facts, false).matched, false);
  }
  const female = native('v5-c422-p002-001/0/0');
  assert.equal(explain('v5-c422-p002-001', female.filter(fact => fact.kind !== 'natal_gender')).matched, false);
});
