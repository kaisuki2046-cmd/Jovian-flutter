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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-source-coordinates-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1810, 1, 25, 22], 'v3-c022-p006-001/0/0', 'v3-c022-p006-001/1/0'],
  [[1810, 9, 17, 10], 'v3-c151-p003-001/0/0'],
  [[1810, 11, 17, 12], 'v3-c134-p001-001/1/0'],
  [[1822, 8, 17, 16], 'v3-c095-p002-101/0/0'],
  [[1833, 4, 5, 6], 'v3-c095-p002-101/0/1'],
  [[1847, 12, 5, 8], 'v3-c134-p001-001/0/0'],
  [[1810, 1, 1, 8], 'v5-c466-p012-001/0/3'],
  [[1810, 1, 1, 12], 'v4-c053-p009-001/0/2'],
  [[1810, 1, 9, 4], 'v4-c053-p009-001/0/4'],
  [[1810, 2, 5, 18], 'v4-c053-p009-001/0/5'],
  [[1810, 2, 9, 18], 'v4-c053-p009-001/0/3'],
  [[1810, 2, 28, 0], 'v4-c053-p005-001/0/1'],
  [[1810, 2, 28, 4], 'v4-c053-p005-001/0/3'],
  [[1810, 4, 9, 0], 'v4-c053-p005-001/0/2'],
  [[1815, 1, 1, 22], 'v5-c466-p012-001/0/6'],
  [[1815, 2, 5, 0], 'v4-c053-p009-001/0/8'],
  [[1815, 2, 5, 20], 'v5-c466-p012-001/0/7'],
  [[1821, 1, 1, 10], 'v5-c466-p012-001/0/2'],
  [[1843, 1, 1, 2], 'v5-c466-p012-001/0/1'],
  [[1843, 1, 9, 4], 'v4-c053-p009-001/0/0'],
  [[1843, 2, 13, 6], 'v4-c053-p009-001/0/1'],
  [[1847, 2, 5, 16], 'v5-c466-p012-001/0/4'],
  [[1857, 3, 28, 0], 'v4-c053-p005-001/0/0'],
  [[1864, 2, 13, 22], 'v4-c053-p009-001/0/9'],
  [[1877, 2, 5, 0], 'v5-c466-p012-001/0/0'],
  [[1884, 2, 5, 14], 'v5-c466-p012-001/0/5'],
  [[1884, 2, 13, 16], 'v4-c053-p009-001/0/6'],
  [[1921, 2, 9, 18], 'v4-c053-p009-001/0/7'],
  [[1974, 5, 5, 16], 'v4-c081-p029-001/0/0'],
  [[1870, 9, 23, 4], 'v2-c360-p002-001/0/0'],
  [[1815, 11, 24, 0], 'v4-c002-p005-001/0/0'],
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

test('Yuanhai established formations, natal horses and related branch passages reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /主女寡而男孤|骨肉中道分離|名利必重|南啇北旅|必有晚福|青雲得路/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [10, 32, 31]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v4-c081-p037-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('A complete fire trine still needs native strength, and ordered branch seats need the real hour', () => {
  const darkWarrior = 'v2-c360-p002-001';
  assert.equal(explain(darkWarrior, native(darkWarrior + '/0/0')).matched, true);
  const weakTrine = natalFacts([1813, 10, 12, 4]);
  const branches = new Set(weakTrine.filter(fact => fact.kind === 'branch').map(fact => fact.branch));
  assert.ok([...'寅午戌'].every(branch => branches.has(branch)));
  assert.equal(explain(darkWarrior, weakTrine).matched, false);

  const pearls = 'v4-c081-p029-001';
  assert.equal(explain(pearls, native(pearls + '/0/0')).matched, true);
  assert.equal(explain(pearls, natalFacts([1974, 5, 5, 18])).matched, false);
  assert.equal(explain(pearls, native(pearls + '/0/0'), false).matched, false);
});

test('A context-only excerpt retains its day, hour and source requirements', () => {
  const id = 'v3-c022-p006-001';
  const facts = native(id + '/0/0');
  const detail = explain(id, facts);
  assert.deepEqual(detail.matchedBranches.map(branch => branch.text), ['陰差陽錯', '孤鸞之日']);
  for (const { text } of detail.matchedBranches) {
    assert.ok(detail.claim.evidence.context.includes(text));
    assert.ok(!detail.claim.evidence.original_text.includes(text));
  }
  assert.equal(explain(id, facts, false).matched, false);
});

test('Horse passages recompute known natal placements from the four pillars', () => {
  const id = 'v4-c053-p005-001';
  const noHorse = natalFacts([1810, 1, 5, 0, '女']);
  assert.equal(explain(id, noHorse).matched, false);
  const fabricated = ['year', 'month', 'day', 'hour'].map(position => ({ kind: 'shen_sha', position, name: '驿马' }));
  assert.equal(explain(id, [...noHorse, ...fabricated]).matched, false);
  assert.equal(explain(id, native(id + '/0/3')).matched, true);
});
