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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-occupation-wealth-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const ziweiSnares = 'caibogong-p101001-002';
const sunJumen = 'caibogong-p101013-003';
const wupo = 'guanlugong-p101017-002';
const lianzhenTianxiang = 'guanlugong-p101013-007';
const tuoluo = 'guanlugong-p101024-002';
const lingxing = 'guanlugong-p101026-003';
const verse = 'guanlugong-p107000-002';
const samples = [
  [ziweiSnares, [1942, 9, 19, 11]],
  ['caibogong-p101010-002', [1946, 9, 1, 5]],
  [sunJumen, [1940, 1, 16, 7]],
  [sunJumen, [1940, 1, 28, 1]],
  ['caibogong-p101013-006', [1946, 9, 7, 5]],
  ['guanlugong-p001-002', [1940, 5, 1, 7]],
  ['guanlugong-p101001-002', [1940, 2, 7, 1]],
  ['guanlugong-p101010-004', [1940, 2, 7, 6]],
  [lianzhenTianxiang, [1947, 1, 19, 5]],
  [wupo, [1944, 2, 7, 7]],
  ['guanlugong-p101017-003', [1940, 5, 1, 7]],
  [tuoluo, [1940, 5, 7, 2], 0],
  [tuoluo, [1940, 5, 7, 2], 1],
  [tuoluo, [1940, 6, 13, 3], 2],
  [tuoluo, [1940, 6, 13, 3], 3],
  [tuoluo, [1944, 1, 25, 5], 4],
  [tuoluo, [1940, 2, 10, 11], 5],
  [lingxing, [1940, 2, 10, 4]],
  [verse, [1945, 1, 4, 6]],
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

test('13 Quanshu excerpts cover all 18 new SQLite input groups and reach the report', () => {
  const ids = new Set(samples.map(([record]) => idFor(record)));
  const rows = catalog.inventory().filter(({ claim }) => ids.has(claim.id));
  assert.equal(rows.length, 13);
  assert.ok(rows.every(({ lookup }) => lookup.status === 'branch_indexed'));
  const expected = new Set(), proved = new Set();
  for (const id of ids) {
    const { claim, branches } = catalog.get(id);
    assert.equal(branches.length, 1, id);
    branches[0].inputs.forEach((_, index) => expected.add(id + '/' + index));
    const otherSource = structuredClone(claim);
    otherSource.evidence.context = '异本';
    assert.equal(compileQuanshuPalaceText(otherSource).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, 18);

  for (const [record, birth, group = 0] of samples) {
    const id = idFor(record), [passage] = catalog.get(id).branches;
    const { queries, plain } = request(native(birth));
    assert.ok(evaluateRule(passage.inputs[group], 'natal', claimChartContext('ziwei', plain)).matched, `${record}/${group}`);
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(detail.matched && hit, record);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, record);
    assert.deepEqual(hit.matchedBranches.map(({ text }) => text), [passage.text], record);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes('原文/依据：' + passage.text + '\n'), record);
    assert.doesNotMatch(materials, /现代释义：/u);
    if ([wupo, verse].includes(record)) assert.match(materials, /生年干、实际承载星/u);
    proved.add(id + '/' + group);
  }
  assert.deepEqual(proved, expected);
});

test('partial star lists and invented four-sector changes do not qualify', () => {
  const star = name => fact => fact.kind === 'palace_star' && fact.star === name;
  const requiredFacts = [
    [ziweiSnares, star('地劫')],
    [lingxing, star('文曲')],
    [lianzhenTianxiang, star('廉贞')],
    [sunJumen, fact => fact.kind === 'palace_brightness' && fact.palace === '财帛' && fact.star === '巨门'],
  ];
  for (const [record, remove] of requiredFacts) {
    const facts = sampleFor(record);
    assert.ok(facts.some(remove), record);
    assert.equal(explain(record, facts.filter(fact => !remove(fact))).matched, false, record);
  }

  const hasMajor = native([1940, 2, 13, 11]);
  assert.ok(hasMajor.some(fact => fact.kind === 'palace_star' && fact.palace === '官禄' && fact.star === '陀罗'));
  assert.equal(explain(tuoluo, hasMajor).matched, false);

  for (const record of [wupo, verse]) {
    const facts = sampleFor(record);
    const absentHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '权');
    const forged = { kind: 'palace_sector_mutagen', palace: '官禄', change: '权' };
    assert.equal(explain(record, [...absentHost, forged]).matched, false, record);
    assert.equal(explain(record, facts.filter(fact => fact.kind !== 'natal_year_stem')).matched, false, record);
  }
});
