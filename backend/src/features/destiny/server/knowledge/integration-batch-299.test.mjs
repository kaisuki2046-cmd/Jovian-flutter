import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { analyzeBaZi } from '../../control/bazi-analysis.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileYuanhaiNatalPassages, yuanhaiNatalPassagesProfile } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-wealth-vaults-and-phases-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const male = { kind: 'natal_gender', gender: '男' };
const witnesses = [
  [[1879, 1, 1, 6], 'v3-c002-p002-002/0/0'],
  [[1879, 1, 5, 4], 'v3-c002-p002-003/0/0'],
  [[1879, 1, 9, 2], 'v3-c002-p002-003/0/1'],
  [[1879, 1, 13, 0], 'v3-c004-p002-002/0/0', 'v3-c114-p007-002/0/1'],
  [[1879, 2, 1, 10], 'v1-c333-p016-001/0/0'],
  [[1879, 4, 1, 2], 'v3-c018-p002-001/0/0', 'v3-c087-p004-002/0/0'],
  [[1879, 1, 1, 2], 'v3-c114-p007-002/0/3'],
  [[1879, 1, 17, 14], 'v3-c137-p006-001/0/0'],
  [[1879, 3, 17, 0], 'v3-c114-p007-002/0/2'],
  [[1879, 4, 25, 2], 'v3-c114-p007-002/0/0'],
  [[1881, 1, 21, 0], 'v3-c105-p004-001/0/3'],
  [[1881, 4, 5, 0], 'v3-c105-p004-001/0/2', 'v3-c105-p004-101/0/0', 'v3-c146-p002-002/0/0'],
  [[1881, 9, 21, 4], 'v3-c087-p005-001/0/0', 'v3-c137-p006-001/1/0'],
  [[1898, 2, 21, 0], 'v3-c105-p004-001/0/0'],
  [[1898, 4, 1, 0], 'v3-c105-p004-001/0/1'],
  [[1879, 1, 1, 20], 'v3-c045-p002-001/0/0'],
  [[1879, 1, 21, 2], 'v3-c045-p002-001/2/0'],
  [[1879, 1, 28, 0], 'v3-c135-p002-003/0/0'],
  [[1879, 2, 5, 0], 'v3-c045-p002-001/1/0'],
  [[1879, 2, 5, 10], 'v3-c045-p002-002/0/0'],
  [[1879, 2, 17, 0], 'v3-c045-p002-003/2/0'],
  [[1879, 8, 9, 12], 'v3-c045-p002-003/0/0'],
  [[1879, 9, 17, 16], 'v3-c045-p002-003/1/0'],
  [[1833, 1, 16, 14], 'v2-c373-p003-002/0/0'],
];

function natalFacts([year, month, day, hour]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall);
  const { method, indicators } = analyzeBaZi(chart).L2.assessments.fiveElementStrength.temperament;
  return [...chartFacts.bazi(chart), male, ...indicators.map(({ element, classification }) =>
    ({ kind: 'bazi_element_temperament', element, classification, profile: method }))];
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

test('Yuanhai branches reach SQLite with native chart, temperament, phase and placement evidence', () => {
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
      assert.doesNotMatch(materials, /嗣必絶|謹守貲財|難爲兄弟|尅妻妾及父|子少之斷/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [17, 29, 24]);
  assert.deepEqual(verified, new Set(groups.keys()));
  assert.equal(states.get(claimId('v3-c022-p002-003')), 'unmapped');
});

test('historical gender criteria, month-branch harms and full vault evidence are enforced', () => {
  for (const key of ['v1-c333-p016-001/0/0', 'v3-c105-p004-101/0/0', 'v3-c146-p002-002/0/0']) {
    const [id] = key.split('/');
    const maleFacts = native(key);
    assert.equal(explain(id, maleFacts).matched, true);
    const femaleFacts = maleFacts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '女' } : fact);
    assert.equal(explain(id, femaleFacts).matched, false, key);
  }
  for (const key of ['v2-c373-p003-002/0/0', 'v3-c114-p007-002/0/0']) {
    const [id] = key.split('/');
    assert.equal(explain(id, native(key), false).matched, false, key);
  }
});

test('unique temperament indications select their respective source passages', () => {
  const id = 'v3-c045-p002-001';
  for (const [index, text] of [[0, '木盛'], [1, '太過'], [2, '不及']]) {
    assert.deepEqual(explain(id, native(id + '/' + index + '/0')).matchedBranches.map(branch => branch.text), [text]);
  }
});
