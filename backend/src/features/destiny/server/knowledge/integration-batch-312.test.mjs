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
import { compileDtsjyReviewedPassage, dtsjyReviewedProfile } from './bazi-dtsjy-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-dtsjy-verified-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `dtsjy-v1-c${key}`;
const witnesses = [
  [[1798, 11, 28, 16, '女'], '005-p017-001/0/0'],
  [[1798, 12, 28, 16, '女'], '005-p017-001/0/1'],
  [[1798, 2, 1, 16, '女'], '005-p017-001/0/2'],
  [[1798, 11, 28, 18, '女'], '005-p017-002/0/0'],
  [[1798, 12, 28, 18, '女'], '005-p017-002/0/1'],
  [[1798, 2, 1, 0, '女'], '005-p017-002/0/2'],
  [[1879, 3, 5, 8, '男'], '009-p005-201/0/0'],
  [[1815, 2, 13, 8, '男'], '009-p005-201/0/1'],
  [[1832, 7, 25, 4, '男'], '009-p005-201/1/0'],
  [[1818, 3, 9, 8, '男'], '009-p005-201/1/1'],
  [[1798, 1, 13, 4, '男'], '016-p002-001/0/0'],
  [[1798, 8, 9, 2, '男'], '017-p002-201/0/0'],
  [[1809, 8, 13, 18, '男'], '017-p002-201/0/1'],
  [[1798, 8, 9, 18, '男'], '017-p002-201/1/0'],
  [[1809, 8, 13, 14, '男'], '017-p002-201/1/1'],
  [[1798, 8, 9, 6, '男'], '017-p002-201/2/0'],
  [[1809, 8, 13, 0, '男'], '017-p002-201/2/1'],
  [[1798, 8, 9, 14, '男'], '017-p002-201/3/0'],
  [[1809, 8, 13, 10, '男'], '017-p002-201/3/1'],
  [[1822, 10, 13, 22, '女'], '024-p001-001/0/0'],
  [[1809, 3, 13, 6, '女'], '024-p001-001/1/0'],
  [[1809, 4, 5, 10, '男'], '028-p002-002/0/0'],
  [[1798, 4, 5, 0, '男'], '030-p001-001/0/0', '044-p003-001/0/0'],
  [[1798, 2, 5, 0, '男'], '030-p001-001/0/1'],
  [[1798, 1, 1, 2, '男'], '031-p003-001/0/0'],
  [[1798, 2, 5, 20, '男'], '037-p019-001/0/0'],
  [[1798, 9, 17, 2, '男'], '037-p021-001/0/0'],
  [[1809, 7, 9, 4, '男'], '037-p023-002/0/0'],
  [[1798, 1, 28, 0, '男'], '041-p002-002/0/0'],
  [[1798, 3, 17, 0, '男'], '041-p002-002/0/1'],
  [[1798, 1, 1, 8, '男'], '041-p002-002/0/2'],
  [[1798, 1, 21, 2, '男'], '041-p002-002/1/0'],
  [[1798, 12, 25, 18, '男'], '041-p008-003/0/0'],
  [[1798, 4, 13, 20, '男'], '041-p008-004/0/0'],
  [[1809, 6, 1, 12, '男'], '041-p008-004/1/0'],
  [[1798, 4, 1, 2, '女'], '041-p010-001/0/0'],
  [[1798, 8, 17, 0, '女'], '041-p010-002/0/0'],
  [[1798, 2, 21, 16, '男'], '044-p001-001/0/0'],
  [[1798, 10, 28, 22, '女'], '044-p002-001/0/0'],
  [[1798, 6, 13, 4, '男'], '044-p003-001/1/0'],
  [[1798, 1, 5, 10, '男'], '044-p005-001/0/0'],
  [[1800, 1, 5, 2, '女'], '044-p006-001/0/0'],
  [[1800, 3, 28, 4, '女'], '044-p006-001/0/1'],
  [[1798, 1, 13, 12, '女'], '044-p006-002/0/0'],
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

test('Ditian Sui passages reach SQLite and reports with observed natal conditions', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, dtsjyReviewedProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileDtsjyReviewedPassage(edited).reason, 'source_review_required', key);
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
      assert.doesNotMatch(materials, /不克亦不和|男女皆貴|決不發福|夫貴而吉|必多子|必多妻妾|必困/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [23, 45, 44]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['009-p007-201', '024-p002-001', '028-p002-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('Seasonal stem, month formation and pure yin claims require their own confirmed evidence', () => {
  const winter = '005-p017-001';
  const winterFacts = native(winter + '/0/0');
  assert.equal(explain(winter, winterFacts).matched, true);
  const male = winterFacts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact);
  assert.equal(explain(winter, male).matched, false);

  const wood = '009-p005-201';
  assert.deepEqual(explain(wood, native(wood + '/0/0')).matchedBranches.map(branch => branch.text), ['遇亥之生']);
  assert.deepEqual(explain(wood, native(wood + '/1/0')).matchedBranches.map(branch => branch.text), ['未之庫']);
  assert.equal(explain(wood, native(wood + '/1/0'), false).matched, false);

  const pureYin = '028-p002-002';
  const yinFacts = native(pureYin + '/0/0');
  assert.equal(explain(pureYin, yinFacts).matched, true);
  assert.equal(explain(pureYin, natalFacts([1809, 4, 5, 12, '男'])).matched, false);
  assert.equal(explain(pureYin, yinFacts, false).matched, false);
});
