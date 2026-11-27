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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-fiscal-and-noble-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1810, 1, 1, 0, '男'], 'v1-c153-p002-001/0/7', 'v4-c002-p007-001/0/0', 'v4-c002-p007-001/1/0', 'v3-c151-p004-002/0/0'],
  [[1810, 1, 5, 4, '男'], 'v1-c313-p013-001/0/0'],
  [[1810, 1, 5, 6, '男'], 'v2-c236-p002-001/2/0'],
  [[1810, 1, 5, 18, '男'], 'v1-c153-p002-001/0/5'],
  [[1810, 1, 9, 0, '男'], 'v1-c153-p002-001/0/2'],
  [[1810, 1, 13, 0, '男'], 'v1-c153-p002-001/0/0', 'v2-c236-p002-001/0/0'],
  [[1810, 1, 17, 0, '男'], 'v1-c153-p002-001/0/1'],
  [[1810, 1, 17, 16, '男'], 'v1-c189-p004-001/0/2'],
  [[1810, 1, 28, 0, '男'], 'v1-c153-p002-001/0/4'],
  [[1810, 2, 1, 0, '男'], 'v1-c153-p002-001/0/8', 'v1-c351-p018-001/0/0'],
  [[1810, 2, 5, 18, '男'], 'v1-c153-p002-001/0/6'],
  [[1810, 2, 9, 0, '男'], 'v1-c153-p002-001/0/9'],
  [[1810, 2, 13, 0, '男'], 'v1-c153-p002-001/0/3', 'v5-c455-p003-001/0/2'],
  [[1810, 3, 13, 0, '男'], 'v2-c271-p002-001/0/2'],
  [[1810, 4, 13, 20, '男'], 'v2-c281-p002-001/0/1'],
  [[1810, 5, 13, 10, '男'], 'v2-c002-p142-101/0/0'],
  [[1810, 7, 1, 2, '男'], 'v2-c281-p002-001/0/2'],
  [[1810, 7, 5, 8, '男'], 'v2-c271-p002-001/0/1'],
  [[1810, 7, 13, 6, '男'], 'v2-c244-p002-001/0/0'],
  [[1810, 7, 28, 8, '男'], 'v2-c277-p002-001/0/0'],
  [[1810, 8, 13, 8, '男'], 'v1-c300-p002-001/0/0'],
  [[1826, 8, 17, 4, '男'], 'v1-c189-p004-001/0/1'],
  [[1833, 1, 1, 20, '男'], 'v2-c281-p002-001/0/0'],
  [[1833, 1, 5, 0, '男'], 'v2-c002-p125-001/0/0'],
  [[1833, 5, 21, 10, '男'], 'v2-c271-p002-001/0/0'],
  [[1833, 7, 5, 2, '男'], 'v2-c236-p003-001/0/0'],
  [[1833, 11, 25, 0, '男'], 'v1-c189-p004-001/0/0'],
  [[1869, 7, 5, 2, '男'], 'v2-c271-p002-001/0/3'],
  [[1881, 1, 1, 4, '男'], 'v2-c236-p002-001/1/0'],
  [[1895, 1, 5, 14, '男'], 'v2-c304-p002-001/0/0'],
  [[1810, 1, 1, 20, '男'], 'v4-c053-p006-001/0/3'],
  [[1810, 1, 9, 16, '男'], 'v3-c087-p006-001/0/0'],
  [[1810, 1, 13, 16, '男'], 'v3-c087-p006-001/1/2'],
  [[1810, 1, 21, 8, '男'], 'v3-c087-p006-001/1/4'],
  [[1810, 1, 25, 6, '男'], 'v3-c123-p002-001/0/0'],
  [[1810, 1, 25, 10, '男'], 'v3-c087-p002-101/0/0'],
  [[1810, 2, 1, 16, '男'], 'v3-c002-p002-001/0/0'],
  [[1810, 4, 5, 20, '男'], 'v4-c053-p006-001/0/1'],
  [[1810, 5, 5, 0, '男'], 'v4-c053-p006-001/0/2'],
  [[1810, 6, 5, 8, '男'], 'v2-c310-p002-001/0/0'],
  [[1810, 7, 1, 14, '男'], 'v3-c087-p006-001/1/3', 'v3-c087-p006-001/1/5'],
  [[1810, 7, 5, 14, '男'], 'v4-c002-p006-001/0/0'],
  [[1810, 7, 9, 20, '男'], 'v3-c087-p006-001/1/1'],
  [[1810, 7, 17, 20, '男'], 'v3-c063-p002-001/0/1'],
  [[1810, 8, 1, 10, '男'], 'v3-c063-p002-001/0/0'],
  [[1810, 9, 9, 12, '男'], 'v3-c087-p006-001/1/0'],
  [[1810, 11, 28, 0, '男'], 'v3-c087-p006-101/0/0'],
  [[1826, 5, 21, 0, '男'], 'v4-c053-p006-001/0/0'],
  [[1833, 11, 1, 10, '男'], 'v2-c310-p002-001/1/0'],
  [[1869, 1, 28, 20, '男'], 'v3-c087-p006-101/1/0'],
  [[1810, 1, 5, 8, '男'], 'v5-c455-p003-001/0/3'],
  [[1810, 1, 9, 22, '男'], 'v3-c146-p001-601/0/0'],
  [[1810, 1, 17, 2, '男'], 'v5-c443-p002-001/0/3'],
  [[1810, 3, 1, 22, '男'], 'v5-c431-p002-001/0/0'],
  [[1810, 3, 13, 6, '男'], 'v5-c196-p010-001/0/2'],
  [[1810, 6, 1, 0, '男'], 'v5-c443-p002-001/0/2'],
  [[1810, 6, 1, 12, '男'], 'v5-c349-p007-001/0/0'],
  [[1810, 7, 9, 0, '男'], 'v5-c455-p003-001/0/1'],
  [[1810, 7, 9, 18, '男'], 'v5-c383-p005-001/0/0'],
  [[1826, 7, 28, 0, '男'], 'v5-c443-p002-001/0/1'],
  [[1833, 1, 1, 0, '男'], 'v5-c455-p003-001/0/0'],
  [[1843, 2, 17, 2, '男'], 'v5-c196-p010-001/0/1'],
  [[1843, 11, 13, 8, '男'], 'v5-c196-p010-001/0/0'],
  [[1869, 10, 13, 4, '男'], 'v5-c196-p010-001/1/0'],
  [[1895, 3, 28, 0, '男'], 'v5-c443-p002-001/0/0'],
  [[1901, 6, 5, 4, '男'], 'v5-c196-p010-001/1/2'],
  [[1954, 5, 21, 4, '男'], 'v5-c196-p010-001/1/1'],
  [[1810, 1, 5, 2, '女'], 'v1-c351-p030-001/0/1', 'v3-c151-p004-002/1/0'],
  [[1810, 1, 25, 0, '女'], 'v1-c351-p030-001/0/3'],
  [[1810, 3, 17, 4, '女'], 'v1-c351-p030-001/0/2'],
  [[1810, 4, 17, 0, '女'], 'v3-c039-p002-001/0/3'],
  [[1810, 5, 1, 0, '女'], 'v3-c039-p002-001/0/2'],
  [[1810, 10, 9, 8, '女'], 'v3-c039-p002-001/0/1'],
  [[1826, 1, 21, 2, '女'], 'v1-c351-p030-001/0/0'],
  [[1826, 10, 17, 0, '女'], 'v3-c039-p002-001/0/0'],
  [[1815, 11, 24, 0, '男'], 'v2-c313-p002-101/0/0'],
  [[1810, 7, 25, 10, '男'], 'v4-c155-p002-001/0/0'],
];

function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  const { method, indicators } = analyzeBaZi(chart).L2.assessments.fiveElementStrength.temperament;
  const sect = hour >= 8 && hour <= 16 ? 'day' : hour <= 4 || hour >= 20 ? 'night' : null;
  const daylight = sect ? [{ kind: 'natal_daylight', sect }] : [];
  return [...daylight, ...chartFacts.bazi(chart), { kind: 'natal_gender', gender }, ...indicators.map(({ element, classification }) =>
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

test('Yuanhai confirmed fiscal, noble and tomb evidence reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /定作紫微郎|終身泄氣|少年不發庫中人|早歲父亡|金鑾|腰金衣紫/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [36, 85, 77]);
  assert.deepEqual(verified, new Set(groups.keys()));
});

test('Daytime and nighttime noble days require confirmed daylight facts', () => {
  const id = 'v2-c271-p002-001';
  for (const index of [0, 1, 2, 3]) {
    const facts = native(id + '/0/' + index);
    assert.equal(explain(id, facts).matched, true);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_daylight')).matched, false);
    const opposite = facts.map(fact => fact.kind === 'natal_daylight'
      ? { ...fact, sect: fact.sect === 'day' ? 'night' : 'day' } : fact);
    assert.equal(explain(id, opposite).matched, false);
  }
});

test('The hour tomb and female noble evidence require their corresponding confirmed data', () => {
  const tomb = 'v2-c281-p002-001';
  const facts = native(tomb + '/0/0');
  assert.equal(explain(tomb, facts).matched, true);
  assert.equal(explain(tomb, facts, false).matched, false);

  const noble = 'v1-c351-p030-001';
  const female = native(noble + '/0/0');
  assert.equal(explain(noble, female).matched, true);
  const male = female.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact);
  assert.equal(explain(noble, male).matched, false);
});
