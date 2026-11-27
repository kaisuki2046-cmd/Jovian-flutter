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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-estate-fortune-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const samples = [
  ['c011-p101001-002', [1942, 3, 9, 11]],
  ['c011-p101003-005', [1946, 2, 13, 5]],
  ['c011-p101004-005', [1940, 8, 1, 1]],
  ['c011-p101008-004', [1946, 2, 5, 5]],
  ['c011-p101010-006', [1940, 9, 9, 11]],
  ['c011-p101011-004', [1942, 2, 17, 11]],
  ['c011-p101012-004', [1942, 2, 21, 11]],
  ['c011-p101014-002', [1948, 3, 13, 6]],
  ['c011-p101014-002', [1942, 12, 25, 9], 1],
  ['c011-p101015-001', [1940, 8, 1, 9], 0, 0],
  ['c011-p101016-002', [1940, 4, 1, 1]],
  ['c011-p101016-002', [1940, 8, 1, 3], 1],
  ['c011-p101016-002', [1940, 8, 1, 9], 2],
  ['c011-p101016-002', [1940, 8, 1, 3], 3],
  ['c011-p101019-002', [1942, 2, 17, 5]],
  ['c011-p101020-002', [1940, 6, 1, 1]],
  ['c011-p101020-002', [1940, 6, 1, 1], 1],
  ['c011-p101020-002', [1940, 8, 1, 3], 2],
  ['c011-p101020-002', [1940, 8, 1, 3], 3],
  ['c011-p101020-002', [1944, 9, 1, 10], 4],
  ['c011-p101020-002', [1940, 9, 1, 4], 5],
  ['c011-p101021-003', [1950, 1, 1, 6]],
  ['c011-p101022-002', [1942, 2, 19, 7]],
  ['c011-p101022-002', [1940, 8, 1, 0], 1],
  ['c011-p101022-002', [1941, 11, 19, 8], 2],
  ['c011-p101022-002', [1941, 3, 1, 4], 3],
  ['c011-p101022-003', [1942, 2, 17, 7]],
  ['c012-p101001-004', [1942, 4, 1, 11]],
  ['c012-p101002-005', [1946, 3, 5, 5]],
  ['c012-p101003-005', [1940, 9, 1, 8], 0, 0],
  ['c012-p101003-005', [1940, 4, 13, 2], 0, 1],
  ['c012-p101003-005', [1940, 4, 13, 2], 0, 2],
  ['c012-p101003-005', [1940, 8, 19, 7], 0, 3],
  ['c012-p101003-005', [1940, 3, 1, 11], 0, 4],
  ['c012-p101003-005', [1940, 4, 7, 2], 0, 5],
  ['c012-p101005-007', [1940, 10, 1, 5]],
  ['c012-p101005-008', [1950, 10, 1, 10]],
  ['c012-p101008-005', [1950, 7, 17, 6]],
  ['c012-p101010-005', [1946, 3, 17, 5]],
  ['c012-p101012-005', [1950, 5, 17, 6]],
  ['c012-p101016-005', [1942, 4, 13, 11]],
  ['c012-p101018-002', [1940, 4, 7, 0]],
  ['c012-p101019-003', [1950, 9, 13, 8]],
  ['c012-p101021-001', [1940, 2, 1, 3]],
  ['c012-p101021-001', [1940, 2, 1, 7], 1],
  ['c012-p101022-003', [1940, 8, 1, 0]],
  ['c012-p101022-003', [1940, 4, 1, 8], 1],
  ['c012-p101022-003', [1940, 9, 1, 1], 2],
  ['c012-p101022-003', [1940, 12, 1, 5], 3],
  ['c012-p101022-004', [1940, 4, 13, 9]],
];

const idFor = record => 'ziwei-v2-' + record;
const native = ([year, month, day, hour], gender = 'female') =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const birthFor = record => samples.find(([key]) => key === record)[1];

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

function explain(record, facts) {
  return explainClaim(idFor(record), 'ziwei', request(facts).plain, undefined, catalog);
}

test('29 Quanshu estate and fortune excerpts expose all 50 native alternatives in SQLite and report materials', () => {
  const ids = new Set(samples.map(([record]) => idFor(record)));
  const inventory = catalog.inventory().filter(({ claim }) => ids.has(claim.id));
  assert.equal(inventory.length, 29);
  assert.ok(inventory.every(({ lookup }) => lookup.status === 'branch_indexed'));
  const expected = new Set(), checked = new Set();
  let groups = 0;
  for (const id of ids) {
    const { claim, branches } = catalog.get(id);
    assert.equal(branches.length, 1, id);
    groups += branches[0].inputs.length;
    branches[0].inputs.forEach(({ anyOf }, group) => {
      (anyOf.length ? anyOf : [null]).forEach((_, choice) => expected.add([id, group, choice].join('/')));
    });
    const revised = structuredClone(claim);
    revised.evidence.context = '异本';
    assert.equal(compileQuanshuPalaceText(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([groups, expected.size], [45, 50]);

  const charts = new Map();
  for (const [record, birth, group = 0, choice = 0] of samples) {
    const id = idFor(record), [branch] = catalog.get(id).branches;
    const key = birth.join('/');
    if (!charts.has(key)) {
      const { queries, plain } = request(native(birth));
      const hits = new Map(lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(hit => [hit.id, hit]));
      charts.set(key, { chart: claimChartContext('ziwei', plain), hits, plain });
    }
    const { chart, hits, plain } = charts.get(key);
    const input = branch.inputs[group];
    const selected = input.anyOf.length ? { ...input, anyOf: [input.anyOf[choice]] } : input;
    const fixture = [id, group, choice].join('/');
    assert.ok(evaluateRule(selected, 'natal', chart).matched, fixture);
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    const hit = hits.get(id);
    assert.ok(detail.matched && hit, fixture);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, fixture);
    const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(material.includes('原文/依据：' + branch.text + '\n'), fixture);
    assert.doesNotMatch(material, /现代释义：/u);
    checked.add(fixture);
  }
  assert.deepEqual(checked, expected);
});

test('solo conditions need complete star lists and benefic clauses need the specified location and sex', () => {
  for (const record of ['c011-p101021-003', 'c012-p101018-002', 'c012-p101022-004']) {
    const palace = record.startsWith('c011-') ? '田宅' : '福德';
    const incomplete = native(birthFor(record)).filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== palace);
    const forged = { kind: 'palace_core_star_count', palace, count: 1 };
    assert.equal(explain(record, [...incomplete, forged]).matched, false, record);
  }

  const sun = 'c012-p101003-005';
  assert.equal(explain(sun, native(birthFor(sun), 'male')).matched, false);
  const assistants = 'c011-p101015-001';
  const facts = native(birthFor(assistants));
  const noRightAssistant = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '右弼');
  const forgedTrine = { kind: 'palace_trine_star', palace: '田宅', star: '右弼' };
  assert.equal(explain(assistants, [...noRightAssistant, forgedTrine]).matched, false);

  const fireBell = 'c012-p101005-007';
  const withoutBell = native(birthFor(fireBell)).filter(fact => fact.kind !== 'palace_star' || fact.star !== '铃星');
  assert.equal(explain(fireBell, withoutBell).matched, false);
});
