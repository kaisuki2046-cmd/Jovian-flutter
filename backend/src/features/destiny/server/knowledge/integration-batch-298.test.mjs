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

const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-month-pattern-and-transformation-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `zpzq-v1-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1881, 1, 1, 4], 'c025-p006-002/1/0'],
  [[1881, 1, 5, 0], 'c025-p001-001/0/2'],
  [[1881, 1, 9, 0], 'c025-p001-001/0/7'],
  [[1881, 1, 13, 0], 'c025-p001-001/0/3'],
  [[1881, 1, 17, 0], 'c025-p001-001/0/6'],
  [[1881, 1, 17, 12], 'c025-p006-002/0/0'],
  [[1881, 1, 28, 0], 'c025-p001-001/0/0'],
  [[1881, 2, 1, 0], 'c025-p001-001/0/4'],
  [[1881, 3, 17, 2], 'c025-p001-001/0/1'],
  [[1881, 4, 17, 0], 'c025-p001-001/0/5'],
  [[1881, 11, 9, 0], 'c025-p001-001/1/0'],
  [[1881, 11, 21, 0], 'c025-p001-001/1/1'],
  [[1907, 6, 9, 12], 'c013-p006-002/0/0', 'c042-p009-201/0/0'],
  [[1855, 11, 26, 20], 'c032-p005-001/0/0'],
  [[1919, 12, 5, 16], 'c042-p017-001/0/0'],
  [[1854, 11, 10, 4], 'c040-p011-201/0/0'],
  [[1854, 1, 8, 10], 'c042-p002-001/0/0'],
  [[1895, 4, 23, 22], 'c034-p004-001/0/0'],
  [[1895, 4, 13, 12], 'c034-p005-201/0/0'],
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

test('Zhenquan month patterns and transformation passages reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /父母双全|难为子息|无所望|大贵之格|贫穷之格/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [10, 20, 19]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['c013-p003-001', 'c016-p004-001', 'c038-p017-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('month support and the year-stem passage apply without imposing the adjacent gender-specific reading', () => {
  for (const index of ['0/0', '1/0', '1/1']) {
    const key = 'c025-p001-001';
    const facts = native(key + '/' + index).filter(fact => fact.kind !== 'natal_gender');
    assert.equal(explain(key, facts).matched, true, index);
  }
  const facts = native('c025-p006-002/0/0').filter(fact => fact.kind !== 'natal_gender');
  assert.equal(explain('c025-p006-002', facts).matched, false);
});

test('the month pattern and cited transformations require observed roots, stems and full branch evidence', () => {
  for (const key of ['c032-p005-001/0/0', 'c034-p004-001/0/0', 'c040-p011-201/0/0', 'c042-p017-001/0/0']) {
    const [id] = key.split('/');
    assert.equal(explain(id, native(key), false).matched, false, key);
  }
  assert.equal(explain('c042-p017-001', natalFacts([1919, 12, 5, 14])).matched, false);
  assert.equal(explain('c032-p005-001', natalFacts([1855, 11, 26, 18])).matched, false);
});
