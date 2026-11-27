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
import { compileQtbjWoodFireEarth, qtbjWoodFireEarthProfile } from './qtbj-wood-fire-earth-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-qiongtong-fire-earth-stems-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `qtbj-${key}`;
const witnesses = [
  [[1810, 5, 25, 0], 'v3-c021-p004-101/0/0'],
  [[1822, 3, 13, 4], 'v3-c018-p001-101/0/0'],
  [[1810, 6, 25, 8], 'v3-c034-p004-101/0/0', 'v3-c034-p004-101/0/1', 'v3-c034-p004-101/0/2', 'v3-c034-p004-101/0/3'],
  [[1879, 5, 5, 0], 'v4-c047-p005-301/0/0'],
  [[2016, 10, 13, 0], 'v4-c053-p003-101/0/0'],
  [[1811, 6, 29, 8], 'v3-c022-p004-101/0/0'],
  [[1812, 10, 3, 0], 'v4-c052-p004-101/0/0'],
  [[1853, 9, 28, 18], 'v4-c052-p003-301/0/0'],
  [[1812, 3, 5, 8], 'v3-c017-p004-101/0/0'],
  [[1812, 7, 13, 4], 'v3-c023-p002-101/0/0'],
  [[1812, 11, 10, 4], 'v3-c027-p003-101/0/0'],
  [[1812, 12, 11, 6], 'v3-c039-p001-101/0/0'],
  [[1815, 4, 11, 6], 'v4-c047-p004-101/0/0'],
  [[1843, 2, 22, 4], 'v3-c030-p003-101/0/0'],
  [[1812, 12, 10, 10], 'v3-c028-p005-401/0/0'],
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

test('Qiongtong fire and earth passages reach SQLite and reports with observed stems, roots and formations', () => {
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
      assert.doesNotMatch(materials, /篌里藏刀|廊庙之客|富贵寿考|妻贤子肖|宦僚|夭折天年/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [15, 18, 15]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v3-c027-p001-101', 'v3-c032-p003-301', 'v3-c035-p003-401', 'v4-c047-p003-101', 'v4-c051-p002-101']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('The Wei-month stems occupy the actual outer seats and the Yin-month union must form', () => {
  const summer = 'v3-c023-p002-101';
  assert.equal(explain(summer, native(summer + '/0/0')).matched, true);
  assert.equal(explain(summer, natalFacts([1812, 7, 13, 6])).matched, false);
  assert.equal(explain(summer, native(summer + '/0/0'), false).matched, false);

  const transformation = 'v3-c030-p003-101';
  assert.equal(explain(transformation, native(transformation + '/0/0')).matched, true);
  assert.equal(explain(transformation, natalFacts([1843, 2, 22, 6])).matched, false);
});

test('The Zi and Hai month passages distinguish an exposed seal from a hidden stem', () => {
  const zi = 'v3-c028-p005-401', hai = 'v3-c027-p003-101';
  assert.equal(explain(zi, native(zi + '/0/0')).matched, true);
  assert.equal(explain(zi, natalFacts([1812, 12, 10, 8])).matched, false);
  const haiFacts = native(hai + '/0/0');
  assert.ok(haiFacts.some(fact => fact.kind === 'hidden_ten_god' && fact.stem === '甲' && fact.position === 'month'));
  assert.equal(explain(hai, haiFacts).matched, true);
});
