import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileZpzqCases, zpzqCaseProfile } from './zpzq-natal-cases.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-month-and-exposure-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `zpzq-v1-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1911, 9, 11, 16], 'c013-p002-001/0/0', 'c013-p004-001/0/0'],
  [[1911, 9, 12, 0], 'c013-p005-001/0/0'],
  [[1924, 1, 1, 0], 'c025-p004-201/1/0'],
  [[1924, 1, 1, 2], 'c025-p004-201/2/0'],
  [[1924, 1, 1, 6], 'c025-p004-201/3/0'],
  [[1924, 1, 1, 16], 'c025-p003-004/0/0'],
  [[1924, 1, 1, 22], 'c025-p004-201/0/0'],
  [[1924, 1, 5, 8], 'c015-p005-001/0/0'],
  [[1924, 1, 9, 0], 'c025-p003-001/1/0'],
  [[1924, 1, 13, 0], 'c025-p002-001/0/0', 'c036-p006-201/0/0'],
  [[1924, 1, 13, 16], 'c036-p001-201/0/0'],
  [[1924, 1, 13, 18], 'c036-p011-001/0/0'],
  [[1924, 2, 1, 0], 'c013-p006-001/0/0'],
  [[1924, 3, 1, 16], 'c025-p003-001/0/0'],
  [[1924, 6, 5, 0], 'c015-p006-001/0/0'],
  [[1924, 7, 25, 0], 'c025-p002-002/0/0'],
  [[1924, 11, 21, 4], 'c015-p002-002/0/0'],
  [[1924, 11, 21, 14], 'c015-p002-001/0/0'],
  [[1924, 11, 28, 16], 'c015-p003-001/0/0'],
  [[1924, 11, 28, 18], 'c015-p003-002/0/0'],
  [[1924, 12, 17, 2], 'c025-p002-001/1/0'],
  [[1932, 5, 14, 0], 'c015-p004-001/0/0'],
  [[1954, 6, 17, 4], 'c015-p008-001/0/0'],
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

test('the reviewed Zhenquan conditions select exactly their indexed passages from native charts', () => {
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
      assert.doesNotMatch(materials, /极等之贵|长生四子|沐浴一双|旺中五子|何一夫而多妻/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [20, 25, 23]);
  assert.deepEqual(verified, new Set(groups.keys()));
  assert.equal(states.get(claimId('c013-p003-001')), 'unmapped');
});

test('the You-month Ding Ren condition requires month and hour, and clear Officer requires verified hidden stems', () => {
  const pair = native('c013-p002-001/0/0');
  assert.equal(explain('c013-p002-001', pair).matched, true);
  const distant = chartFacts.bazi(describeBaZiPillars({ year: '壬寅', month: '己酉', day: '甲子', hour: '丁卯' }));
  assert.equal(explain('c013-p002-001', distant).matched, false);

  const seal = native('c036-p001-201/0/0');
  assert.equal(explain('c036-p001-201', seal).matched, true);
  assert.equal(explain('c036-p001-201', seal, false).matched, false);
});

test('the historical hour-branch reading uses the day element and male branch without reporting a count of children', () => {
  const facts = [...chartFacts.bazi(describeBaZiPillars({ year: '甲子', month: '丁卯', day: '甲子', hour: '己巳' })), male];
  assert.deepEqual(explain('c025-p004-201', facts).matchedBranches.map(({ text }) => text), ['长生']);
  const noGender = facts.filter(fact => fact.kind !== 'natal_gender');
  assert.equal(explain('c025-p004-201', noGender).matched, false);
  assert.equal(explain('c025-p004-201', facts, false).matched, false);
});
