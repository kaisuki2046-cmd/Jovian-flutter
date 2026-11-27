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
import { compileYuanhaiNatalPassages, yuanhaiNatalPassagesProfile } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-seasonal-patterns-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1810, 1, 1, 0, '女'], 'v3-c022-p005-001/1/0'],
  [[1810, 1, 9, 16, '女'], 'v3-c031-p002-001/1/0'],
  [[1810, 2, 9, 20, '女'], 'v3-c031-p002-001/0/0'],
  [[1869, 9, 5, 8, '女'], 'v3-c022-p004-002/0/0'],
  [[1905, 12, 13, 8, '女'], 'v3-c022-p002-004/0/0'],
  [[1810, 1, 5, 0, '女'], 'v3-c022-p005-001/0/0'],
  [[1810, 1, 1, 12], 'v3-c020-p002-001/0/0'],
  [[1810, 5, 13, 2], 'v3-c135-p002-006/0/2'],
  [[1810, 5, 13, 10], 'v3-c135-p002-006/0/1'],
  [[1810, 5, 13, 18], 'v3-c135-p002-006/0/0'],
  [[1810, 6, 13, 0], 'v4-c053-p004-001/0/0'],
  [[1815, 11, 17, 0], 'v4-c175-p004-101/0/0'],
  [[1843, 8, 9, 16], 'v3-c065-p003-001/0/0'],
  [[1810, 1, 1, 0], 'v5-c012-p011-001/0/0'],
  [[1810, 1, 5, 12], 'v5-c434-p004-001/0/3'],
  [[1810, 1, 13, 0], 'v5-c434-p004-001/0/2'],
  [[1810, 1, 13, 12], 'v5-c383-p003-001/0/0'],
  [[1810, 1, 13, 16], 'v5-c012-p011-001/1/0'],
  [[1810, 9, 28, 0], 'v5-c434-p004-001/0/1'],
  [[1810, 10, 17, 10], 'v5-c466-p016-001/0/3'],
  [[1815, 10, 5, 2], 'v5-c466-p016-001/0/0'],
  [[1821, 6, 1, 0], 'v5-c466-p016-001/0/1'],
  [[1847, 10, 13, 0], 'v5-c466-p016-001/0/2'],
  [[1954, 5, 1, 0], 'v5-c434-p004-001/0/0'],
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

test('Yuanhai seasonal, same-column and natal strength passages reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /夫榮子貴|孤尅之命|嫌夫|因親致眷|流而不返|晚年妻離/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [13, 24, 24]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v4-c081-p037-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('Metal Spirit requires the listed hours and actual transformation still needs Jia', () => {
  const metalSpirit = 'v3-c135-p002-006';
  assert.equal(explain(metalSpirit, native(metalSpirit + '/0/0')).matched, true);
  assert.equal(explain(metalSpirit, natalFacts([1810, 5, 13, 4])).matched, false);
  const yiGeng = 'v3-c065-p003-001';
  assert.equal(explain(yiGeng, native(yiGeng + '/0/0')).matched, true);
  assert.equal(explain(yiGeng, natalFacts([1843, 8, 9, 14])).matched, false);
});

test('Double void and seasonal hour evidence need their stated gender and a confirmed hour', () => {
  const doubleVoid = 'v3-c022-p004-002';
  const facts = native(doubleVoid + '/0/0');
  assert.equal(explain(doubleVoid, facts).matched, true);
  assert.equal(explain(doubleVoid, facts, false).matched, false);
  assert.equal(explain(doubleVoid, natalFacts([1869, 9, 5, 8, '男'])).matched, false);
  const hourConflict = 'v5-c383-p003-001';
  assert.equal(explain(hourConflict, native(hourConflict + '/0/0'), false).matched, false);
});

test('Generating stems do not supply the neighboring Wealth vault excerpt by themselves', () => {
  const id = 'v5-c012-p011-001';
  assert.deepEqual(explain(id, native(id + '/0/0')).matchedBranches.map(branch => branch.text), ['上下相生']);
  assert.ok(explain(id, native(id + '/1/0')).matchedBranches.some(branch => branch.text === '四庫坐財'));
});
