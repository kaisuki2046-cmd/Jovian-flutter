import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { tiebanBaseNumbers, tianyuanNetworkProfile, tianyuanNetworkRelatedProfile, tianyuanYearProfile } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-tianyuan-network-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const publishedExample = '1955-01-17T10:00:00Z';
const network = value => value.additionalCalculations.find(row => row.profile === tianyuanNetworkProfile);
const related = value => value.additionalCalculations.find(row => row.profile === tianyuanNetworkRelatedProfile);
const yearSeries = value => value.additionalCalculations.find(row => row.profile === tianyuanYearProfile);

function query(birthTime, gender = '男') {
  const utc = Date.parse(birthTime);
  const chart = calculateBaZi(utc, utc + 8 * 3_600_000, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function input(chartQuery, timeKnown = true) {
  const result = parseInput({ timeKnown, chartQueries: [chartQuery] });
  assert.ok(result);
  return result;
}

const axisNames = [
  '田园四干横排号', '田园四支横排号', '田园年月干支横排号', '田园日时干支横排号',
  '田园月柱首号', '田园日柱首号', '田园时柱首号',
];

test('the original chart yields the seven documented roots alongside the existing year series', async () => {
  const birth = query(publishedExample);
  assert.deepEqual(birth.confirmedFacts.filter(f => f.kind === 'pillar').map(f => f.ganZhi), ['甲午', '丁丑', '戊寅', '辛酉']);
  const calculated = tiebanBaseNumbers(birth.confirmedFacts);
  const raw = network(calculated);
  assert.deepEqual(raw.candidates.map(r => r.clauseId), [6714, 9236, 6972, 1346, 7722, 1543, 4456]);
  assert.deepEqual(raw.candidates.slice(0, 4).map(r => r.digits), [[6, 7, 1, 4], [9, 2, 3, 6], [6, 9, 7, 2], [1, 3, 4, 6]]);
  assert.deepEqual(raw.candidates.slice(4).map(({ upperTotal, lowerTotal }) => [upperTotal, lowerTotal]),
    [[450, 270], [360, 180], [270, 180]]);
  assert.deepEqual(yearSeries(calculated).candidates.map(r => r.clauseId), [6729, 6825, 6921, 7017, 7113, 7209, 7305]);

  const { tieban } = await generateReport(input(birth), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /田园年月干支横排号 6972/u);
      assert.match(materials, /田园横排与月、日、时柱首号按配卦和取数次序复算/u);
      assert.doesNotMatch(materials, /田园四支横排号 (?:9236|9238)/u);
      return '测试解读';
    },
  });
  const result = network(tieban);
  assert.equal(result.libraryEdition, 'muxuan-json');
  assert.deepEqual(result.results.map(({ clauseId, status, reason }) => [clauseId, status, reason]), [
    [6714, 'unmatched', 'not_in_catalog'], [9236, 'unmatched', 'not_in_catalog'], [6972, 'matched', undefined],
    [1346, 'unmatched', 'not_in_catalog'], [7722, 'unmatched', 'not_in_catalog'],
    [1543, 'unmatched', 'scope_mismatch'], [4456, 'unmatched', 'scope_mismatch'],
  ]);
  assert.equal(result.results[2].claimId, 'tbss-v6-clauses-p06972-001');
  assert.equal(result.results[1].claimId, undefined);
  assert.ok(lookup(input(birth, false).chartQueries).every(row => !row.tieban));
});

test('gender and exact source edition still govern a calculated number', () => {
  const eligibleTime = '1919-01-07T16:00:00Z';
  const eligible = network(catalog.tiebanMatches(query(eligibleTime, '女').confirmedFacts)).results[0];
  assert.equal(eligible.clauseId, 1238);
  assert.equal(eligible.claim.id, 'tbss-v1-clauses-p01238-001');
  const ineligible = network(catalog.tiebanMatches(query(eligibleTime).confirmedFacts)).results[0];
  assert.equal(ineligible.clauseId, 1238);
  assert.equal(ineligible.reason, 'gender_mismatch');
  assert.equal(ineligible.claim, undefined);

  const csvOnly = network(catalog.tiebanMatches(query('1919-01-12T02:00:00Z').confirmedFacts)).results[6];
  assert.equal(csvOnly.clauseId, 9639);
  assert.equal(csvOnly.status, 'unmatched');
  assert.equal(csvOnly.reason, 'not_in_catalog');
  assert.equal(csvOnly.claim, undefined);
});

test('every new axis can supply an exact SQLite match and its report citation', () => {
  const samples = [
    ['1919-01-07T16:00:00Z', '女', 0, 1238, 'tbss-v1-clauses-p01238-001'],
    ['1919-01-07T16:00:00Z', '男', 1, 9281, 'tbss-v9-clauses-p09281-001'],
    ['1919-02-07T16:00:00Z', '男', 2, 9883, 'tbss-v9-clauses-p09883-001'],
    ['1919-01-07T20:00:00Z', '男', 3, 3813, 'tbss-v3-clauses-p03813-001'],
    ['1919-01-07T16:00:00Z', '男', 4, 2632, 'tbss-v2-clauses-p02632-001'],
    ['1919-01-23T16:00:00Z', '男', 5, 8541, 'tbss-v8-clauses-p08541-001'],
    ['1919-01-07T16:00:00Z', '男', 6, 8541, 'tbss-v8-clauses-p08541-001'],
  ];
  for (const [birthTime, gender, axis, number, id] of samples) {
    const references = lookup(input(query(birthTime, gender)).chartQueries);
    const { tieban } = references.find(row => row.tieban);
    const result = network(tieban).results[axis];
    assert.equal(result.clauseId, number, id);
    assert.equal(result.status, 'matched', id);
    assert.equal(result.claim.id, id);
    const materials = buildReportMaterials(references);
    assert.ok(materials.includes(axisNames[axis] + ' ' + number), id);
    assert.ok(materials.includes(result.claim.evidence.original_text), id);
  }
});

test('the seven roots each produce six separately identified related candidates', () => {
  const calculated = tiebanBaseNumbers(query(publishedExample).confirmedFacts);
  const expected = [
    ['tianyuan_horizontal_stems', 6714, [6810, 6906, 7002, 7098, 7194, 7290]],
    ['tianyuan_horizontal_branches', 9236, [9332, 9428, 9524, 9620, 9716, 9812]],
    ['tianyuan_horizontal_year_month', 6972, [7068, 7164, 7260, 7356, 7452, 7548]],
    ['tianyuan_horizontal_day_hour', 1346, [1442, 1538, 1634, 1730, 1826, 1922]],
    ['tianyuan_month_first', 7722, [7818, 7914, 8010, 8106, 8202, 8298]],
    ['tianyuan_day_first', 1543, [1639, 1735, 1831, 1927, 2023, 2119]],
    ['tianyuan_hour_first', 4456, [4552, 4648, 4744, 4840, 4936, 5032]],
  ];
  assert.deepEqual(related(calculated), {
    profile: tianyuanNetworkRelatedProfile, libraryEdition: 'muxuan-json',
    status: 'partial', reason: 'related_offset_inferred',
    candidates: expected.flatMap(([rootAxis, initialNumber, numbers]) => numbers.map((clauseId, index) => ({
      axis: 'tianyuan_network_related', rootAxis, initialNumber, additionStep: index + 1,
      clauseId, requiresSelection: true,
    }))),
  });
  assert.equal(network(calculated).candidates.length, 7);
  assert.deepEqual(yearSeries(calculated).candidates.map(row => row.clauseId), [6729, 6825, 6921, 7017, 7113, 7209, 7305]);
});

test('number, source edition, time layer and selection state survive report lookup', async () => {
  const parsed = input(query(publishedExample));
  const references = lookup(parsed.chartQueries);
  const calculation = related(references.find(row => row.tieban).tieban);
  const hit = calculation.results.find(row => row.clauseId === 9524);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.claim.id, 'tbss-v9-clauses-p09524-001');
  assert.equal(hit.requiresSelection, true);
  assert.deepEqual(calculation.results.filter(row => [6906, 4840, 5032].includes(row.clauseId))
    .map(({ clauseId, status, reason, claim }) => [clauseId, status, reason, claim]), [
    [6906, 'unmatched', 'gender_mismatch', undefined],
    [4840, 'unmatched', 'scope_mismatch', undefined],
    [5032, 'unmatched', 'not_in_catalog', undefined],
  ]);
  const output = await generateReport(parsed, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.ok(!materials.includes(hit.claim.evidence.original_text));
      assert.match(materials, /田园年月干支横排号 6972/u);
      return '测试解读';
    },
  });
  const summary = related(output.tieban);
  assert.equal(summary.libraryEdition, 'muxuan-json');
  assert.equal(summary.reason, 'related_offset_inferred');
  assert.deepEqual(summary.results.find(row => row.clauseId === 9524), {
    axis: 'tianyuan_network_related', rootAxis: 'tianyuan_horizontal_branches', initialNumber: 9236,
    additionStep: 3, clauseId: 9524, status: 'matched', requiresSelection: true,
    claimId: 'tbss-v9-clauses-p09524-001',
  });
  assert.ok(lookup(input(query(publishedExample), false).chartQueries).every(row => !row.tieban));
});

test('other-edition numbers and a known source-text conflict remain unmatched', () => {
  const csv = catalog.get('tbss14-v9-clauses-p09642-001').claim;
  assert.equal(csv.conditions.match.selector.libraryEdition, 'muxuan-fourteen-table-csv');
  assert.deepEqual(csv.conditions.match.selector.clauseIds, [9642]);
  const csvResult = related(catalog.tiebanMatches(query('1950-01-14T06:00:00Z').confirmedFacts))
    .results.find(row => row.rootAxis === 'tianyuan_day_first' && row.clauseId === 9642);
  assert.equal(csvResult.status, 'unmatched');
  assert.equal(csvResult.reason, 'not_in_catalog');
  assert.equal(csvResult.claim, undefined);

  const conflict = related(catalog.tiebanMatches(query('1950-06-14T04:00:00Z').confirmedFacts))
    .results.find(row => row.rootAxis === 'tianyuan_month_first' && row.clauseId === 6825);
  assert.equal(conflict.status, 'unmatched');
  assert.equal(conflict.reason, 'source_text_mismatch');
  assert.equal(conflict.claim, undefined);
});
