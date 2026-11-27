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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-wealth-career-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const samples = [
  ['caibogong-p101005-001', 1940, 1, 1, 0, 0, 0],
  ['caibogong-p101005-001', 1940, 2, 22, 1, 0, 1],
  ['caibogong-p101005-001', 1944, 2, 15, 2, 0, 2],
  ['caibogong-p101005-005', 1940, 1, 1, 0],
  ['caibogong-p101018-003', 1940, 3, 8, 7],
  ['caibogong-p101022-002', 1941, 8, 8, 6, 0],
  ['caibogong-p101022-002', 1941, 2, 1, 0, 1],
  ['caibogong-p101024-003', 1940, 2, 8, 1],
  ['caibogong-p101026-003', 1940, 1, 15, 6, 0],
  ['caibogong-p101026-003', 1942, 5, 15, 6, 1],
  ['caibogong-p101026-003', 1940, 2, 8, 4, 2],
  ['caibogong-p101026-003', 1940, 4, 8, 11, 3],
  ['caibogong-p101026-003', 1940, 4, 8, 5, 4],
  ['caibogong-p101028-001', 1940, 1, 1, 8, 0],
  ['caibogong-p101028-001', 1940, 1, 1, 0, 1],
  ['guanlugong-p101020-002', 1940, 2, 8, 2, 0, 0],
  ['guanlugong-p101020-002', 1940, 1, 1, 2, 0, 1],
  ['guanlugong-p101020-002', 1941, 8, 8, 2, 0, 2],
  ['guanlugong-p101020-002', 1941, 8, 8, 2, 0, 3],
];

const idFor = record => 'ziwei-v2-' + record;
const native = ([, year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));
const sampleFor = record => samples.find(([id]) => id === record);

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [query] = queries;
  const plain = chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
  return { queries, plain };
}

function explain(record, facts) {
  return explainClaim(idFor(record), 'ziwei', request(facts).plain, undefined, catalog);
}

test('eight source records and 19 alternatives reach SQLite, explanation and report materials', () => {
  const expected = new Set(), proved = new Set();
  const records = new Set(samples.map(([record]) => record));
  let conditions = 0;
  for (const record of records) {
    const row = catalog.get(idFor(record));
    const inputGroups = row.inputs ?? row.branches[0].inputs;
    conditions += inputGroups.length;
    inputGroups.forEach(({ anyOf }, group) => (anyOf.length ? anyOf : [null])
      .forEach((_, alternative) => expected.add(JSON.stringify([record, group, alternative]))));
    const revised = structuredClone(row.claim);
    revised.evidence.context = '异本';
    assert.equal(compileQuanshuPalaceText(revised).reason, 'source_review_required');
  }
  assert.deepEqual([records.size, conditions, expected.size], [8, 14, 19]);

  for (const sample of samples) {
    const [record, , , , , group = 0, alternative = 0] = sample, id = idFor(record);
    const row = catalog.get(id), passage = row.inputs ? row : row.branches[0];
    const input = passage.inputs[group];
    const selected = input.anyOf.length ? { ...input, anyOf: [input.anyOf[alternative]] } : input;
    const { queries, plain } = request(native(sample));
    assert.ok(evaluateRule(selected, 'natal', claimChartContext('ziwei', plain)).matched, JSON.stringify(sample));
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(detail.matched && hit, record);
    const original = row.claim.evidence.original_text;
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(passage.text ?? original), record);
    if (passage.text) {
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, record);
      assert.deepEqual(detail.matchedBranches.map(({ text }) => text), [passage.text]);
      assert.ok(!materials.includes('现代释义：'), record);
    }
    proved.add(JSON.stringify([record, group, alternative]));
  }
  assert.deepEqual(proved, expected);
});

test('Wuqu transformation must have a verified carrier and a compatible birth-year stem', () => {
  const record = 'caibogong-p101005-001';
  const facts = native(sampleFor(record));
  const actual = facts.find(fact => fact.kind === 'star_mutagen' && fact.palace === '财帛' && fact.star === '武曲');
  assert.equal(actual?.change, '禄');
  assert.equal(explain(record, facts.filter(fact => fact !== actual)).matched, false);
  assert.equal(explain(record, facts.map(fact => {
    if (fact.kind === 'natal_year_stem') return { ...fact, stem: '庚' };
    return fact;
  })).matched, false);
});

test('external support, brightness and accompanying star facts cannot be supplied by other palaces', () => {
  const record = 'caibogong-p101022-002';
  const facts = native(sampleFor(record));
  const noTrines = facts.filter(fact => !(fact.kind === 'palace_relation' && fact.anchor === '财帛' && fact.relation === 'trine'));
  assert.equal(explain(record, [...noTrines, ...['天魁', '天钺'].map(star =>
    ({ kind: 'palace_trine_star', palace: '财帛', star }))]).matched, false);
  for (const [id, criterion] of [
    ['caibogong-p101018-003', fact => fact.kind === 'palace_brightness' && fact.palace === '财帛' && fact.star === '破军'],
    ['caibogong-p101005-005', fact => fact.kind === 'palace_star' && fact.palace === '财帛' && fact.star === '天钺'],
  ]) {
    const actual = native(sampleFor(id));
    assert.ok(actual.some(criterion), id);
    assert.equal(explain(id, actual.map(fact => criterion(fact) ? { ...fact, palace: '官禄' } : fact)).matched, false, id);
  }
});
