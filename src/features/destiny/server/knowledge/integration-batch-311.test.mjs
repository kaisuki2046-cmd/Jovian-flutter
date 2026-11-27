import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileQtbjWoodFireEarth, qtbjWoodFireEarthProfile } from './qtbj-wood-fire-earth-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-qiongtong-wood-verified-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `qtbj-${key}`;
const witnesses = [
  [[1729, 2, 26, 16], 'v2-c004-p002-001/0/0'],
  [[1729, 3, 8, 20], 'v2-c004-p002-001/0/1'],
  [[1843, 7, 19, 0], 'v2-c005-p015-301/0/0'],
  [[1798, 8, 23, 16], 'v2-c006-p003-001/0/0'],
  [[2002, 9, 13, 10], 'v2-c006-p003-001/0/1'],
  [[1822, 10, 17, 16], 'v2-c006-p003-001/0/2'],
  [[1979, 8, 25, 8], 'v2-c006-p005-001/0/0', 'v2-c006-p005-002/0/0'],
  [[1798, 10, 12, 4], 'v2-c007-p013-301/0/0'],
  [[1884, 2, 5, 14], 'v2-c009-p001-001/0/0'],
  [[1847, 3, 11, 0], 'v2-c009-p001-001/0/1'],
  [[1833, 4, 13, 0], 'v2-c009-p001-001/0/2'],
  [[1776, 4, 21, 4], 'v2-c010-p012-301/0/0'],
  [[1798, 7, 5, 10], 'v2-c012-p009-001/0/0'],
  [[1809, 8, 17, 8], 'v2-c013-p004-301/0/0'],
  [[1798, 10, 13, 14], 'v2-c013-p015-401/0/0'],
];

const decadalWitnesses = [
  [0, [1798, 8, 13, 0], [['甲子', 40, 49], ['乙丑', 50, 59]]],
  [1, [1809, 9, 15, 0], [['乙丑', 73, 82], ['甲子', 83, 92]]],
  [2, [1809, 10, 15, 0], [['乙丑', 83, 92], ['甲子', 93, 102]]],
  [3, [1809, 8, 17, 18], [['乙丑', 64, 73], ['甲子', 74, 83]]],
  [4, [1798, 9, 13, 18], [['甲子', 29, 38], ['乙丑', 39, 48]]],
  [5, [1798, 10, 13, 18], [['甲子', 20, 29], ['乙丑', 30, 39]]],
];

function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
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

test('Qiongtong wood passages reach SQLite and reports with observed stems, roots and formations', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, qtbjWoodFireEarthProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileQtbjWoodFireEarth(edited).reason, 'source_review_required', key);
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
      assert.doesNotMatch(materials, /技艺之流|反主富贵|好讼争非|自然登科|畏妻子|又可云科甲|因贪致祸/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [11, 16, 15]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v2-c004-p011-001', 'v2-c007-p009-001', 'v2-c007-p017-701', 'v2-c010-p009-002',
    'v2-c012-p003-001', 'v2-c012-p007-001', 'v2-c012-p012-301', 'v2-c014-p006-301']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('The verified seasonal meeting, Water trine and stem transformation require their actual hour', () => {
  for (const [key, branch, differentHour] of [
    ['v2-c004-p002-001', 0, [1729, 2, 26, 18]],
    ['v2-c006-p005-001', 0, [1979, 8, 25, 10]],
    ['v2-c006-p005-002', 0, [1979, 8, 25, 10]],
    ['v2-c013-p004-301', 0, [1809, 8, 17, 10]],
  ]) {
    const facts = native(`${key}/${branch}/0`);
    assert.equal(explain(key, facts).matched, true, key);
    assert.equal(explain(key, natalFacts(differentHour)).matched, false, key);
    assert.equal(explain(key, facts, false).matched, false, key);
  }
});

test('The Wood peers passage requires a genuine decadal sequence and reports its matching periods', () => {
  const key = 'v2-c007-p018-601', id = claimId(key);
  const row = catalog.get(id);
  const inventory = catalog.inventory().find(({ claim }) => claim.id === id);
  assert.equal(inventory.lookup.status, 'branch_indexed');
  assert.equal(row.branches.length, decadalWitnesses.length);
  const edited = structuredClone(row.claim);
  edited.evidence.context += '异本';
  assert.equal(compileBaZiDecadalPassage(edited).reason, 'source_review_required');

  for (const [branch, birth, expected] of decadalWitnesses) {
    const spec = row.branches[branch];
    assert.equal(spec.conditionCompiler, baziDecadalPassageProfile);
    assert.deepEqual(spec.decadalAnchor.stems, ['甲', '乙']);
    const facts = natalFacts(birth);
    const { queries } = query(facts);
    const hits = lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);
    const hit = hits.find(item => item.id === id);
    assert.ok(hit, branch);
    assert.equal(hit.matchedBranches.length, 1);
    assert.deepEqual(hit.matchedBranches, explain(key, facts).matchedBranches);
    const [{ text, matchedConditions }] = hit.matchedBranches;
    assert.equal(text, '甲乙比肩，又逢比劫运');
    assert.deepEqual(matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) =>
      [ganZhi, startAge, endAge]), expected);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(text));
    for (const [pillar, from, to] of expected) {
      assert.ok(materials.includes(`${from}至${to}虚岁${pillar}运限`));
    }
    assert.doesNotMatch(materials, /主兄弟劫财争讼|刑妻损子/u);

    const withoutPeriods = facts.filter(fact => fact.kind !== 'bazi_decadal_range');
    assert.equal(explain(key, withoutPeriods).matched, false);
    const [pillar] = expected[0];
    const conflictingPeriods = [...facts, ...facts.filter(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi === pillar)
      .map(fact => ({ ...fact, startAge: fact.startAge + 1, endAge: fact.endAge + 1 }))];
    assert.equal(explain(key, conflictingPeriods).matched, false);
  }
});
