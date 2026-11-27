import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileQuanshuPalaceText } from './ziwei-source-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-siblings-travel-helpers-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const samples = [
  ['c003-p101001-005', [1950, 8, 17, 6]],
  ['c003-p101002-006', [1942, 6, 25, 11]],
  ['c003-p101003-005', [1946, 6, 9, 5]],
  ['c003-p101004-006', [1942, 7, 1, 11]],
  ['c003-p101006-006', [1942, 7, 9, 11]],
  ['c003-p101007-004', [1942, 7, 1, 11]],
  ['c003-p101008-005', [1950, 9, 1, 6]],
  ['c003-p101009-005', [1942, 7, 5, 11]],
  ['c003-p101010-006', [1946, 6, 5, 5]],
  ['c003-p101011-006', [1942, 7, 9, 11]],
  ['c003-p101012-005', [1942, 6, 17, 11]],
  ['c003-p101014-007', [1950, 8, 17, 6]],
  ['c003-p101016-003', [1942, 2, 17, 9]],
  ['c003-p101016-004', [1942, 1, 1, 9]],
  ['c003-p101017-003', [1942, 6, 17, 11]],
  ['c003-p101017-004', [1942, 6, 17, 11]],
  ['c008-p101001-005', [1950, 5, 21, 8]],
  ['c008-p101002-005', [1942, 11, 17, 11]],
  ['c008-p101003-004', [1942, 12, 1, 11]],
  ['c008-p101004-004', [1940, 10, 13, 1]],
  ['c008-p101005-005', [1946, 11, 9, 5]],
  ['c008-p101010-002', [1942, 11, 9, 11]],
  ['c008-p101011-004', [1946, 9, 13, 3]],
  ['c008-p101014-003', [1948, 8, 25, 2]],
  ['c008-p101014-003', [1942, 6, 9, 7], 1],
  ['c008-p101017-002', [1948, 9, 1, 4]],
  ['c009-p101001-002', [1942, 9, 1, 9]],
  ['c009-p101001-005', [1942, 10, 21, 11]],
  ['c009-p101002-006', [1942, 12, 17, 11]],
  ['c009-p101003-005', [1942, 10, 25, 9]],
  ['c009-p101005-005', [1942, 7, 5, 7]],
  ['c009-p101005-006', [1942, 10, 21, 5]],
  ['c009-p101006-006', [1946, 6, 9, 1]],
  ['c009-p101007-004', [1946, 11, 25, 5]],
  ['c009-p101008-005', [1946, 12, 9, 5]],
  ['c009-p101011-005', [1946, 12, 21, 5]],
  ['c009-p101013-004', [1950, 3, 5, 6]],
  ['c009-p101014-006', [1950, 2, 17, 6]],
];

const idFor = record => 'ziwei-v2-' + record;
const native = ([year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));
const sampleFor = record => native(samples.find(([candidate]) => candidate === record)[1]);

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

function explain(record, facts) {
  return explainClaim(idFor(record), 'ziwei', request(facts).plain, undefined, catalog);
}

test('37 Quanshu excerpts and all 38 SQLite condition groups match native charts and reach report materials', () => {
  const ids = new Set(samples.map(([record]) => idFor(record)));
  const inventory = catalog.inventory().filter(({ claim }) => ids.has(claim.id));
  assert.equal(inventory.length, 37);
  assert.ok(inventory.every(({ lookup }) => lookup.status === 'branch_indexed'));

  const expected = new Set(), checked = new Set();
  for (const id of ids) {
    const { branches, claim } = catalog.get(id);
    assert.equal(branches.length, 1, id);
    branches[0].inputs.forEach((_, index) => expected.add(id + '/' + index));
    const revised = structuredClone(claim);
    revised.evidence.context = '异本';
    assert.equal(compileQuanshuPalaceText(revised).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, 38);

  const charts = new Map();
  for (const [record, birth, group = 0] of samples) {
    const id = idFor(record), [branch] = catalog.get(id).branches;
    const key = birth.join('/');
    if (!charts.has(key)) {
      const { queries, plain } = request(native(birth));
      const hits = new Map(lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(hit => [hit.id, hit]));
      charts.set(key, { chart: claimChartContext('ziwei', plain), hits, plain });
    }
    const { chart, hits, plain } = charts.get(key);
    const fixture = id + '/' + group;
    assert.ok(evaluateRule(branch.inputs[group], 'natal', chart).matched, fixture);
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    const hit = hits.get(id);
    assert.ok(detail.matched && hit, fixture);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, fixture);
    assert.deepEqual(hit.matchedBranches.map(({ text }) => text), [branch.text], fixture);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes('原文/依据：' + branch.text + '\n'), fixture);
    assert.doesNotMatch(materials, /现代释义：/u, fixture);
    checked.add(fixture);
  }
  assert.deepEqual(checked, expected);
});

test('missing native star positions, brightness and compound placements suppress the matching excerpt', () => {
  const sibling = 'c003-p101016-004';
  const withVoids = sampleFor(sibling);
  const noEarthVoid = withVoids.filter(fact => fact.kind !== 'palace_star' || fact.star !== '地空');
  assert.ok(noEarthVoid.length < withVoids.length);
  const forged = { kind: 'palace_sector_star', palace: '兄弟', star: '地空' };
  assert.equal(explain(sibling, [...noEarthVoid, forged]).matched, false);

  const missing = [
    ['c003-p101003-005', f => f.kind === 'palace_brightness' && f.palace === '兄弟' && f.star === '太阳'],
    ['c008-p101004-004', f => f.kind === 'palace_star' && f.palace === '迁移' && f.star === '七杀'],
    ['c009-p101007-004', f => f.kind === 'palace_star' && f.palace === '仆役' && f.star === '武曲'],
  ];
  for (const [record, criterion] of missing) {
    const facts = sampleFor(record);
    assert.ok(facts.some(criterion));
    assert.equal(explain(record, facts.filter(fact => !criterion(fact))).matched, false, record);
  }
});
