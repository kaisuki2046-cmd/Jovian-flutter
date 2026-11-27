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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-month-command-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1879, 1, 1, 10, '男'], 'v1-c333-p015-001/0/0', 'v3-c146-p002-001/0/0'],
  [[1879, 1, 9, 2, '男'], 'v1-c294-p002-003/0/1'],
  [[1879, 1, 21, 14, '男'], 'v2-c214-p003-101/0/0'],
  [[1879, 2, 5, 0, '男'], 'v1-c294-p002-003/0/0'],
  [[1879, 2, 5, 4, '男'], 'v1-c294-p002-003/2/0'],
  [[1879, 2, 13, 4, '男'], 'v2-c230-p002-001/0/0'],
  [[1879, 2, 17, 0, '男'], 'v2-c002-p116-101/0/0'],
  [[1879, 3, 25, 4, '男'], 'v1-c294-p002-003/0/2', 'v2-c230-p002-001/0/1'],
  [[1879, 4, 13, 8, '男'], 'v1-c351-p032-001/0/0'],
  [[1879, 5, 1, 4, '男'], 'v3-c125-p002-001/0/0'],
  [[1879, 11, 5, 18, '男'], 'v2-c220-p002-001/0/0'],
  [[1881, 1, 1, 4, '男'], 'v2-c214-p003-101/1/0'],
  [[1881, 2, 9, 2, '男'], 'v3-c018-p002-002/0/0'],
  [[1881, 7, 17, 0, '男'], 'v1-c294-p002-003/1/0'],
  [[1898, 7, 5, 10, '男'], 'v1-c351-p027-001/0/0'],
  [[1879, 1, 5, 0, '男'], 'v4-c025-p012-001/0/0'],
  [[1879, 1, 5, 8, '男'], 'v4-c077-p004-002/0/0'],
  [[1879, 1, 9, 6, '男'], 'v4-c068-p007-001/0/0'],
  [[1879, 1, 9, 20, '男'], 'v4-c047-p003-001/0/0'],
  [[1879, 2, 13, 0, '男'], 'v4-c002-p011-001/0/0'],
  [[1879, 4, 1, 2, '男'], 'v4-c053-p006-002/0/0'],
  [[1879, 8, 9, 16, '男'], 'v4-c040-p005-001/1/0'],
  [[1879, 8, 17, 8, '男'], 'v4-c081-p039-001/0/0'],
  [[1879, 8, 25, 8, '男'], 'v4-c025-p005-002/0/0'],
  [[1881, 8, 17, 10, '男'], 'v4-c081-p039-001/1/0'],
  [[1881, 10, 9, 0, '男'], 'v4-c040-p005-001/0/0'],
  [[1879, 1, 1, 14, '女'], 'v3-c029-p002-002/0/0'],
  [[1879, 1, 5, 6, '女'], 'v3-c105-p006-001/0/0'],
  [[1833, 4, 21, 6, '女'], 'v3-c029-p002-001/0/0'],
  [[1836, 12, 24, 16, '男'], 'v4-c121-p002-002/0/0'],
  [[1843, 9, 26, 0, '男'], 'v3-c137-p002-001/0/0'],
  [[1833, 5, 9, 0, '男'], 'v3-c105-p003-001/0/0'],
  [[1833, 6, 5, 12, '男'], 'v3-c095-p004-101/0/0'],
  [[1833, 11, 17, 0, '女'], 'v3-c029-p002-001/1/0'],
];

function natalFacts([year, month, day, hour, gender]) {
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

test('Yuanhai month command, exposure and strength passages reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /朝廷之用|半路抛離|壯歲登科甲|孤窮下賤|其人必難發/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [27, 36, 34]);
  assert.deepEqual(verified, new Set(groups.keys()));
  assert.equal(states.get(claimId('v3-c022-p002-003')), 'unmapped');
});

test('female spouse and child indications and year-hour Wealth strength keep distinct passages', () => {
  for (const [id, texts] of [
    ['v3-c029-p002-001', ['夫榮子旺', '子死夫哀']],
    ['v2-c214-p003-101', ['身衰財旺', '身旺財多，財亦旺']],
  ]) {
    texts.forEach((text, index) => {
      const facts = native(id + '/' + index + '/0');
      assert.deepEqual(explain(id, facts).matchedBranches.map(hit => hit.text), [text]);
      if (id === 'v3-c029-p002-001') {
        const maleFacts = facts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact);
        assert.equal(explain(id, maleFacts).matched, false);
      }
    });
  }
});

test('unknown hour cannot establish all-column absence or a year-hour Wealth and Officer pairing', () => {
  for (const key of ['v1-c351-p027-001/0/0', 'v2-c214-p003-101/0/0', 'v4-c121-p002-002/0/0']) {
    const [id] = key.split('/');
    assert.equal(explain(id, native(key), false).matched, false, key);
  }
});
