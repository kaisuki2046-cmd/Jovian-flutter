import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileZpzqCases, zpzqCaseProfile } from './zpzq-natal-cases.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-blades-and-roots-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `zpzq-v1-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1921, 3, 12, 0], 'c044-p003-001/0/0'],
  [[1934, 4, 1, 8], 'c048-p004-001/0/1'],
  [[1879, 11, 25, 6], 'c046-p023-201/0/0'],
  [[1907, 6, 17, 2], 'c046-p025-001/0/0'],
  [[1907, 5, 28, 2], 'c046-p025-001/0/1'],
  [[1932, 8, 28, 0], 'c046-p016-001/1/0', 'c046-p016-001/0/0'],
  [[1932, 4, 28, 4], 'c046-p005-001/0/0'],
  [[1928, 3, 28, 4], 'c048-p004-001/0/0'],
  [[1936, 6, 25, 20], 'c044-p010-001/0/0'],
  [[1911, 8, 1, 8], 'c040-p009-001/0/0'],
  [[1901, 7, 21, 0], 'c036-p022-001/0/0'],
  [[1901, 7, 13, 12], 'c032-p010-001/0/0'],
  [[1901, 6, 17, 10], 'c044-p001-001/0/0'],
  [[1901, 6, 17, 8], 'c044-p001-001/1/0'],
  [[1901, 6, 9, 4], 'c044-p003-001/0/1'],
  [[1901, 6, 9, 0], 'c044-p011-001/0/0'],
  [[1901, 4, 28, 10], 'c038-p016-201/0/0'],
  [[1901, 1, 28, 0], 'c025-p002-003/0/0'],
  [[1875, 3, 11, 14], 'c048-p004-001/0/1'],
  [[1971, 3, 23, 4], 'c048-p004-001/0/0'],
  [[1887, 3, 11, 0], 'c046-p016-001/0/0', 'c046-p016-001/1/0'],
];

function natalFacts([year, month, day, hour]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  return [...chartFacts.bazi(calculateBaZi(wall - 8 * 3_600_000, wall)), male];
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

test('Zhenquan blade, peer-month and transformation evidence reach SQLite and report materials', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, zpzqCaseProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileZpzqCases(edited).reason, 'source_review_required', key);
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
      assert.doesNotMatch(materials, /富贵两空|其贵也大|贵多就武|妻必能相关/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [14, 19, 21]);
  assert.deepEqual(verified, new Set(groups.keys()));
  assert.equal(states.get(claimId('c016-p004-001')), 'unmapped');
});

test('shorter charts cannot establish complete exclusions, roots or the full wood formation', () => {
  for (const key of ['c025-p002-003/0/0', 'c046-p023-201/0/0', 'c046-p025-001/0/0', 'c048-p004-001/0/0']) {
    const [id] = key.split('/');
    const facts = native(key);
    assert.equal(explain(id, facts).matched, true, key);
    assert.equal(explain(id, facts, false).matched, false, key);
  }
  const blade = native('c025-p002-003/0/0');
  assert.equal(explain('c025-p002-003', blade.filter(fact => fact.kind !== 'natal_gender')).matched, false);
});

test('a one-stem wealth with many roots requires that same wealth to be the only exposed wealth', () => {
  const unrootedTime = natalFacts([1907, 6, 17, 0]);
  assert.equal(explain('c046-p025-001', unrootedTime).matched, false);
  const adjacentTime = natalFacts([1928, 3, 28, 2]);
  assert.equal(explain('c048-p004-001', adjacentTime).matched, false);
});
