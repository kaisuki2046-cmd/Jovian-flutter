import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { chenKinshipKeProfile, tiebanBaseNumbers } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-kinship-ke-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const method = tieban => tieban?.additionalCalculations.find(row => row.profile === chenKinshipKeProfile);
const printedFirst = Date.parse('1956-02-11T20:20:00Z');
const printedSecond = Date.parse('1985-03-22T00:20:00Z');

function birth(local, gender = '男') {
  const chart = calculateBaZi(local - 8 * 3_600_000, local, gender === '男' ? 'male' : 'female');
  return {
    chart,
    query: {
      method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, birthYear: new Date(local).getUTCFullYear(),
      confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
    },
  };
}

function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}

test('the published male charts reproduce both original bases, mutual trigrams, and the sixth additions', () => {
  for (const [instant, pillars, base, trigrams, finalNumber] of [
    [printedFirst, ['丙申', '庚寅', '己酉', '丙寅'], 3784, ['艮', '坎', '坤', '震'], 11746],
    [printedSecond, ['乙丑', '己卯', '庚申', '庚辰'], 3788, ['艮', '坤', '坤', '坤'], 11750],
  ]) {
    const { chart, query } = birth(instant + 8 * 3_600_000);
    assert.deepEqual([chart.year, chart.month, chart.day, chart.hour], pillars);
    const calculation = method(tiebanBaseNumbers(query.confirmedFacts, query.birthYear));
    assert.deepEqual(calculation.candidates.map(({ clauseId }) => clauseId),
      [base, base + 1327, base + 2654, base + 3981, base + 5308, base + 6635, finalNumber]);
    assert.deepEqual(calculation.candidates.map(({ additionStep }) => additionStep), [0, 1, 2, 3, 4, 5, 6]);
    for (const { upper, lower, mutualUpper, mutualLower, requiresSelection } of calculation.candidates) {
      assert.deepEqual([upper, lower, mutualUpper, mutualLower], trigrams);
      assert.equal(requiresSelection, true);
    }
  }
});

test('report API carries matched and missing calibration numbers without feeding candidates to the model', async () => {
  const { query } = birth(Date.UTC(1959, 9, 18, 12, 20));
  const input = parsed(query);
  const references = lookup(input.chartQueries);
  const calculation = method(references[0].tieban);
  const hit = calculation.results.find(row => row.clauseId === 5286);
  assert.equal(hit.claim.id, 'tbss-v5-clauses-p05286-001');
  const printed = birth(printedFirst + 8 * 3_600_000).query;
  const missing = method(lookup(parsed(printed).chartQueries)[0].tieban).results[1];
  assert.deepEqual([missing.clauseId, missing.status, missing.reason], [5111, 'unmatched', 'not_in_catalog']);
  assert.ok(!buildReportMaterials(references).includes(hit.claim.evidence.original_text));
  const report = await generateReport(input, {
    lookup, signal: new AbortController().signal, complete: async ({ materials }) => {
      assert.ok(!materials.includes(hit.claim.evidence.original_text));
      return '测试报告';
    },
  });
  const result = method(report.tieban).results.find(row => row.clauseId === 5286);
  assert.deepEqual(result, { axis: 'chen_kinship_ke', clauseId: 5286, status: 'matched', additionStep: 2,
    requiresSelection: true, claimId: hit.claim.id });
  assert.equal(method(lookup(parsed(query, false).chartQueries)[0].tieban), undefined);
  const female = birth(Date.UTC(1959, 9, 18, 12, 20), '女').query;
  assert.equal(method(lookup(parsed(female).chartQueries)[0].tieban), undefined);
});

test('same-edition lookup covers all 720 year-month pairs and preserves rejected or out-of-range numbers', () => {
  const pairs = new Set(), numbers = new Set(), ids = new Set(), additionalPaths = new Set();
  const rejected = new Map();
  for (let year = 1900; year < 1960; year++) {
    for (let month = 0; month < 12; month++) {
      const { chart, query } = birth(Date.UTC(year, month, 18, 12, 20));
      const pair = chart.year + chart.month;
      assert.ok(!pairs.has(pair), pair);
      pairs.add(pair);
      const tieban = catalog.tiebanMatches(query.confirmedFacts, query.birthYear);
      const calculation = method(tieban);
      assert.equal(calculation.libraryEdition, 'muxuan-json');
      const previous = new Set([tieban, ...tieban.additionalCalculations.filter(row => row !== calculation)]
        .flatMap(row => row.results.flatMap(result => result.claim ? [result.claim.id] : [])));
      for (const { clauseId, additionStep, status, claim, reason, requiresSelection } of calculation.results) {
        numbers.add(clauseId);
        assert.equal(requiresSelection, true);
        if (status === 'matched') {
          const { match } = claim.conditions;
          assert.equal(match.chartScope, 'natal');
          assert.ok(match.selector.clauseIds.includes(clauseId));
          assert.ok([0, 1].includes(match.selector.genderCode));
          ids.add(claim.id);
          if (!previous.has(claim.id)) {
            assert.ok(additionStep > 0, 'the base is also the Method 5 mutual-trigram number');
            additionalPaths.add(claim.id);
          }
        } else {
          assert.equal(claim, undefined);
          rejected.set(clauseId, reason);
        }
      }
    }
  }
  assert.deepEqual([pairs.size, numbers.size, ids.size, additionalPaths.size], [720, 224, 65, 54]);
  for (const [clauseId, reason] of [[3959, 'not_in_catalog'], [9267, 'scope_mismatch'],
    [9325, 'gender_mismatch'], [13302, 'not_in_catalog']]) {
    assert.equal(rejected.get(clauseId), reason);
  }
});
