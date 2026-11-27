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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-transformations-and-patterns-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1810, 1, 1, 0], 'v3-c083-p002-001/0/0'],
  [[1810, 1, 1, 16], 'v3-c105-p002-001/0/2'],
  [[1810, 1, 1, 18], 'v3-c105-p002-001/0/4'],
  [[1810, 1, 5, 0], 'v3-c020-p002-002/0/0'],
  [[1810, 1, 9, 0], 'v3-c083-p002-001/1/0'],
  [[1810, 1, 9, 22], 'v3-c105-p002-001/0/5'],
  [[1810, 1, 13, 10], 'v3-c063-p002-101/0/0'],
  [[1810, 1, 28, 0], 'v3-c063-p002-101/0/1'],
  [[1810, 2, 5, 12], 'v3-c083-p002-001/2/0'],
  [[1810, 8, 28, 0], 'v3-c105-p002-001/0/3'],
  [[1810, 10, 13, 4], 'v4-c210-p017-101/0/0'],
  [[1810, 12, 28, 0], 'v3-c105-p002-001/0/0'],
  [[1815, 3, 28, 14], 'v3-c013-p002-001/1/0'],
  [[1815, 10, 1, 0], 'v3-c105-p002-001/0/1'],
  [[1833, 2, 21, 0], 'v3-c013-p002-001/0/0'],
  [[1810, 1, 9, 16], 'v5-c447-p002-001/0/3'],
  [[1810, 2, 5, 10], 'v5-c165-p012-001/0/0'],
  [[1815, 5, 13, 0], 'v5-c447-p002-001/0/2'],
  [[1815, 8, 21, 0], 'v5-c447-p002-001/0/1'],
  [[1815, 9, 1, 0], 'v5-c165-p009-001/0/0'],
  [[1833, 2, 5, 0], 'v5-c447-p002-001/0/0'],
  [[1857, 1, 25, 16], 'v5-c214-p003-001/0/1'],
  [[1884, 4, 21, 2], 'v5-c214-p003-001/0/0'],
  [[1896, 8, 11, 16], 'v5-c333-p010-001/0/0'],
  [[1845, 9, 17, 18], 'v5-c370-p003-001/0/0'],
  [[1832, 7, 11, 20], 'v5-c290-p003-001/0/0'],
  [[1815, 1, 21, 14], 'v5-c290-p003-001/1/0'],
  [[1833, 6, 21, 4], 'v3-c013-p002-002/0/0'],
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

test('Yuanhai verified false transformations and full pillar patterns reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /多尅天|主尅父|孤見異姓|甲第|奪魁權|禍纏/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [14, 28, 28]);
  assert.deepEqual(verified, new Set(groups.keys()));
});

test('False and true transformations are exclusive and a missing hour proves neither', () => {
  const falseId = 'v3-c063-p002-101', trueId = 'v3-c063-p002-001';
  for (const index of [0, 1]) {
    const facts = native(falseId + '/0/' + index);
    assert.equal(explain(falseId, facts).matched, true);
    assert.equal(explain(trueId, facts).matched, false);
    assert.equal(explain(falseId, facts, false).matched, false);
  }
  const transformed = natalFacts([1810, 8, 1, 10]);
  assert.equal(explain(trueId, transformed).matched, true);
  assert.equal(explain(falseId, transformed).matched, false);
});

test('Identical four pillars require the actual hour, and vaults alone do not establish exposed wealth', () => {
  const identical = 'v5-c333-p010-001';
  const facts = native(identical + '/0/0');
  assert.equal(explain(identical, facts).matched, true);
  assert.equal(explain(identical, facts, false).matched, false);
  assert.equal(explain(identical, natalFacts([1896, 8, 11, 18])).matched, false);

  const vaults = 'v5-c290-p003-001';
  const officers = native(vaults + '/1/0');
  assert.deepEqual(explain(vaults, officers).matchedBranches.map(branch => branch.text), ['官殺如臨']);
});
