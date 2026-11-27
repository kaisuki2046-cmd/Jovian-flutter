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

const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-officer-and-wealth-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `zpzq-v1-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1901, 1, 17, 0], 'c022-p004-001/0/0', 'c025-p003-003/0/0'],
  [[1901, 1, 25, 8], 'c025-p003-002/1/0'],
  [[1901, 2, 21, 12], 'c025-p006-001/1/0'],
  [[1901, 2, 28, 0], 'c025-p003-002/0/0'],
  [[1901, 6, 21, 18], 'c025-p006-001/0/0'],
  [[1934, 1, 5, 6], 'c008-p005-201/0/0'],
  [[1879, 9, 9, 8], 'c040-p014-001/1/0'],
  [[1898, 11, 25, 12], 'c046-p014-201/0/0'],
  [[1898, 12, 25, 18], 'c046-p019-001/1/0'],
  [[1901, 2, 5, 2], 'c046-p019-001/0/0'],
  [[1936, 9, 25, 12], 'c044-p006-201/2/0'],
  [[1954, 9, 21, 4], 'c044-p006-201/0/0'],
  [[1897, 9, 17, 0], 'c042-p010-001/0/0'],
  [[1922, 9, 27, 10], 'c042-p010-001/1/0'],
  [[1854, 6, 15, 4], 'c044-p006-201/1/0'],
  [[1843, 1, 3, 16], 'c040-p014-001/0/0'],
  [[1919, 3, 5, 4], 'c013-p006-003/0/0'],
  [[1919, 7, 1, 4], 'c038-p007-001/0/0'],
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

test('Zhenquan officer, wealth and stem-order evidence reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /门充驷马|麟儿绕膝|子贵|贵多就武|难偕老|夭或贫/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [12, 19, 18]);
  assert.deepEqual(verified, new Set(groups.keys()));
});

test('unknown birth time prevents an unsupported claim about stem order, hour phases or absence of roots', () => {
  for (const key of ['c013-p006-003/0/0', 'c025-p006-001/0/0', 'c042-p010-001/1/0', 'c046-p014-201/0/0']) {
    const [id] = key.split('/');
    const facts = native(key);
    assert.equal(explain(id, facts).matched, true, key);
    assert.equal(explain(id, facts, false).matched, false, key);
  }
});

test('the two Officer and Killing resolutions and the isolated Wealth and Seal arrangements stay separate', () => {
  for (const [id, cases] of [
    ['c040-p014-001', [['0/0', '或去官'], ['1/0', '或去煞']]],
    ['c042-p010-001', [['0/0', '财太旺而带印'], ['1/0', '印太重而带财']]],
  ]) {
    for (const [index, text] of cases) {
      assert.deepEqual(explain(id, native(id + '/' + index)).matchedBranches.map(branch => branch.text), [text]);
    }
  }
  const noGender = native('c025-p006-001/1/0').filter(fact => fact.kind !== 'natal_gender');
  assert.equal(explain('c025-p006-001', noGender).matched, false);
  assert.equal(explain('c040-p014-001', natalFacts([1911, 5, 10, 2])).matched, false);
});
