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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-transformations-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1833, 1, 5, 16], 'v3-c105-p005-002/0/0', 'v3-c151-p004-003/1/0'],
  [[1833, 1, 13, 2], 'v1-c311-p002-001/0/0'],
  [[1833, 1, 25, 18], 'v3-c151-p004-003/0/0'],
  [[1833, 7, 5, 0], 'v4-c002-p018-001/0/0'],
  [[1833, 8, 9, 10], 'v4-c158-p002-001/0/0'],
  [[1869, 6, 28, 16], 'v1-c157-p003-001/0/0'],
  [[1881, 4, 6, 0], 'v4-c140-p002-001/1/0'],
  [[1833, 5, 2, 12], 'v4-c140-p002-001/0/0'],
  [[1833, 1, 5, 8], 'v5-c024-p009-001/0/0'],
  [[1833, 1, 12, 0], 'v5-c047-p002-001/1/0'],
  [[1819, 1, 12, 8], 'v5-c126-p003-001/0/0'],
  [[1833, 2, 1, 4], 'v5-c060-p008-001/0/0'],
  [[1833, 5, 16, 14], 'v5-c047-p002-001/2/0'],
  [[1859, 10, 9, 20], 'v5-c126-p003-001/1/0'],
  [[1843, 2, 9, 4], 'v5-c117-p008-001/0/0'],
  [[1843, 3, 1, 6], 'v5-c081-p009-001/0/0'],
  [[1869, 2, 5, 12], 'v5-c024-p018-001/0/0'],
  [[1879, 6, 5, 2], 'v5-c024-p018-001/1/0'],
  [[1964, 5, 1, 0], 'v5-c126-p003-001/1/1'],
  [[1964, 8, 17, 8], 'v5-c126-p003-001/1/2'],
  [[1833, 1, 1, 0], 'v5-c466-p008-002/0/0'],
  [[1833, 1, 1, 12], 'v5-c349-p020-001/0/1'],
  [[1833, 1, 1, 16], 'v5-c280-p007-001/0/0'],
  [[1833, 2, 5, 2], 'v5-c349-p020-001/0/0'],
  [[1833, 2, 9, 14], 'v5-c349-p011-001/0/1'],
  [[1833, 2, 25, 6], 'v5-c269-p007-001/0/0'],
  [[1833, 4, 5, 4], 'v5-c349-p011-001/0/0'],
  [[1833, 4, 9, 2], 'v5-c287-p003-001/0/0'],
  [[1833, 4, 21, 12], 'v5-c277-p003-001/0/0'],
  [[1952, 3, 6, 8], 'v3-c151-p006-001/0/0'],
  [[2023, 3, 22, 22], 'v3-c151-p006-001/0/1'],
  [[1895, 4, 23, 22], 'v5-c047-p002-001/0/0'],
  [[1994, 11, 2, 0], 'v5-c126-p003-001/1/3'],
  [[1826, 10, 27, 20], 'v2-c383-p002-001/0/0'],
];

function natalFacts([year, month, day, hour]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: '男' }];
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

test('Yuanhai following, transformation and verified pillar relations supply only matched passages', () => {
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
      assert.doesNotMatch(materials, /少年登第|顯逹功名|侯封萬户|徹骨貧窮|朝中一棟梁/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [23, 35, 34]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v3-c022-p002-003', 'v4-c186-p008-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('selection between Officer and Killing and the three Wealth classes never lends the neighboring judgment', () => {
  for (const [id, labels] of [
    ['v3-c151-p004-003', ['去殺留官', '去官留殺']],
    ['v5-c047-p002-001', ['正財無破乃生官，身旺', '身弱財多', '輕財分奪']],
  ]) {
    labels.forEach((label, branch) => {
      const row = explain(id, native(id + '/' + branch + '/0'));
      assert.deepEqual(row.matchedBranches.map(hit => hit.text), [label]);
    });
  }
});

test('following and exact transformation evidence are withheld when the hour is unavailable', () => {
  for (const key of ['v2-c383-p002-001/0/0', 'v3-c151-p006-001/0/0', 'v5-c349-p011-001/0/0', 'v5-c349-p020-001/0/1']) {
    const [id] = key.split('/');
    const facts = native(key);
    assert.equal(explain(id, facts).matched, true, key);
    assert.equal(explain(id, facts, false).matched, false, key);
  }
});
