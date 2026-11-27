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

const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-wealth-and-killing-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `zpzq-v1-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1924, 1, 9, 0], 'c038-p016-001/0/0'],
  [[1924, 1, 9, 4], 'c040-p013-001/0/0'],
  [[1924, 1, 13, 6], 'c036-p013-201/0/0'],
  [[1924, 1, 17, 0], 'c034-p007-001/0/0'],
  [[1924, 1, 17, 10], 'c034-p018-001/0/0'],
  [[1924, 2, 9, 0], 'c040-p008-001/0/0'],
  [[1924, 2, 21, 12], 'c034-p015-001/0/0'],
  [[1924, 3, 13, 0], 'c034-p018-201/0/0'],
  [[1924, 4, 28, 6], 'c042-p008-001/0/0'],
  [[1924, 6, 5, 12], 'c042-p001-001/0/0'],
  [[1924, 6, 28, 6], 'c036-p017-001/0/0'],
  [[1924, 8, 21, 12], 'c036-p014-001/0/0'],
  [[1924, 11, 28, 16], 'c042-p001-001/1/0'],
  [[1928, 3, 13, 0], 'c042-p013-201/0/0'],
  [[1928, 9, 1, 4], 'c040-p004-001/0/0'],
  [[1911, 11, 25, 6], 'c034-p010-001/0/0'],
  [[1970, 1, 5, 20], 'c036-p007-201/0/0'],
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
      assert.doesNotMatch(materials, /贵格|贫贱之局|寒贫之局/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [16, 17, 17]);
  assert.deepEqual(verified, new Set(groups.keys()));
  assert.equal(states.get(claimId('c040-p002-001')), 'unmapped');
});

test('killing and wealth absence checks require known hour, and the unsupported dark killing branch stays unavailable', () => {
  const wealthFirst = explain('c040-p004-001', native('c040-p004-001/0/0'));
  assert.deepEqual(wealthFirst.matchedBranches.map(branch => branch.text), ['财先食后，财生煞而食以制之']);
  const noVisibleWealth = native('c040-p013-001/0/0');
  assert.equal(explain('c040-p013-001', noVisibleWealth).matched, true);
  assert.equal(explain('c040-p013-001', noVisibleWealth, false).matched, false);
  const noWealth = native('c042-p013-201/0/0');
  assert.equal(explain('c042-p013-201', noWealth).matched, true);
  assert.equal(explain('c042-p013-201', noWealth, false).matched, false);
});
