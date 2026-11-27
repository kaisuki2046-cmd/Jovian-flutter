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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-arched-pillars-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `yhzp-${key}`;
const witnesses = [
  [[1810, 1, 5, 22], 'v4-c047-p004-001/0/2', 'v4-c053-p002-001/0/2'],
  [[1810, 1, 25, 0], 'v3-c016-p002-006/1/0'],
  [[1810, 2, 1, 22], 'v2-c339-p002-001/1/3'],
  [[1810, 2, 5, 14], 'v2-c339-p002-001/0/0'],
  [[1810, 3, 28, 4], 'v4-c047-p004-001/0/1', 'v3-c151-p003-101/0/0'],
  [[1810, 6, 21, 18], 'v4-c040-p003-002/0/5'],
  [[1810, 8, 1, 0], 'v4-c047-p005-001/0/0', 'v3-c016-p002-006/0/0'],
  [[1810, 8, 25, 16], 'v4-c040-p003-002/0/1'],
  [[1810, 10, 5, 10], 'v2-c339-p002-001/0/1'],
  [[1810, 10, 9, 2], 'v2-c339-p002-001/1/4'],
  [[1810, 12, 13, 12], 'v2-c339-p002-001/1/2'],
  [[1815, 3, 5, 0], 'v4-c047-p005-001/0/1'],
  [[1815, 3, 13, 10], 'v2-c339-p002-001/1/1'],
  [[1815, 5, 21, 12], 'v2-c339-p002-001/0/2'],
  [[1815, 7, 9, 14], 'v2-c339-p002-001/1/0'],
  [[1815, 10, 17, 0], 'v4-c040-p003-002/0/2'],
  [[1821, 8, 5, 18], 'v4-c040-p003-002/0/3'],
  [[1822, 3, 28, 0], 'v4-c040-p003-002/0/4'],
  [[1857, 8, 13, 4], 'v4-c047-p004-001/0/0'],
  [[1864, 2, 28, 2], 'v2-c339-p002-001/0/4'],
  [[1864, 4, 5, 0], 'v4-c040-p003-002/0/0'],
  [[1864, 6, 17, 22], 'v2-c339-p002-001/0/3'],
  [[1810, 4, 1, 12], 'v4-c053-p008-001/0/0'],
  [[1810, 7, 13, 18], 'v5-c250-p014-001/1/0'],
  [[1810, 9, 17, 10], 'v4-c077-p003-001/0/0'],
  [[1815, 8, 21, 8], 'v3-c135-p002-103/0/0'],
  [[1815, 9, 1, 0], 'v3-c135-p002-103/1/0'],
  [[1815, 10, 21, 6], 'v5-c250-p014-001/0/0'],
  [[1843, 9, 25, 4], 'v3-c135-p002-103/2/0'],
  [[1877, 10, 17, 2], 'v5-c466-p008-001/0/1'],
  [[1921, 10, 17, 22], 'v5-c466-p008-001/0/0'],
  [[1921, 11, 9, 0], 'v4-c053-p002-001/0/0'],
  [[1864, 12, 13, 4], 'v2-c246-p002-001/0/1'],
  [[1879, 3, 13, 18], 'v2-c246-p002-001/0/0'],
  [[1921, 1, 25, 2], 'v2-c246-p002-001/0/2'],
  [[1810, 1, 1, 0], 'v4-c047-p006-001/0/0'],
  [[1810, 1, 9, 16], 'v4-c047-p006-001/0/3'],
  [[1810, 2, 5, 22], 'v4-c047-p006-001/0/1'],
  [[1810, 4, 28, 18], 'v4-c047-p006-001/0/2'],
  [[1843, 3, 8, 4], 'v4-c053-p002-001/0/1'],
  [[1810, 2, 21, 12, '女'], 'v3-c123-p002-601/0/0'],
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

test('Yuanhai anchored arch, natal star and hidden-stem passages reach SQLite and report materials', () => {
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
      assert.doesNotMatch(materials, /傷夫再嫁|寒房冷娶|回也不愚|才高立解成名|腰金衣紫|位至侯王/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [15, 44, 41]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v4-c081-p037-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('An arched noble seat must stay empty and the original two pillars must be known', () => {
  const noble = 'v5-c250-p014-001';
  const positive = native(noble + '/0/0');
  assert.deepEqual(explain(noble, positive).matchedBranches.map(branch => branch.text), ['㸔來辛丑逢辛卯']);
  assert.equal(explain(noble, positive, false).matched, false);
  const filled = natalFacts([1816, 2, 18, 6]);
  assert.ok(filled.some(fact => fact.kind === 'pillar' && fact.position === 'day' && fact.ganZhi === '辛丑'));
  assert.ok(filled.some(fact => fact.kind === 'pillar' && fact.position === 'hour' && fact.ganZhi === '辛卯'));
  assert.ok(filled.some(fact => fact.kind === 'branch' && fact.position === 'month' && fact.branch === '寅'));
  assert.equal(explain(noble, filled).matched, false);

  const broken = 'v2-c339-p002-001', intact = 'v5-c466-p008-001';
  const virtualSeat = native(intact + '/0/0');
  assert.equal(explain(intact, virtualSeat).matched, true);
  assert.equal(explain(broken, virtualSeat).matched, false);
  const filledLu = native(broken + '/0/3');
  assert.ok(explain(broken, filledLu).matchedBranches.some(branch => branch.text === '忌填實'));
  assert.equal(explain(intact, filledLu).matched, false);
});

test('The contention and Day-branch control passages retain their original subjects', () => {
  const contested = 'v3-c123-p002-601';
  const birth = witnesses.find(([, ...keys]) => keys.includes(contested + '/0/0'))[0];
  assert.equal(explain(contested, natalFacts(birth)).matched, true);
  assert.equal(explain(contested, natalFacts([...birth.slice(0, 4), '男'])).matched, false);
  assert.equal(explain(contested, natalFacts(birth), false).matched, false);

  const control = 'v4-c047-p006-001';
  const facts = native(control + '/0/0');
  assert.equal(explain(control, facts).matched, true);
  assert.equal(explain(control, facts.filter(fact => fact.kind !== 'natal_gender')).matched, false);
});
