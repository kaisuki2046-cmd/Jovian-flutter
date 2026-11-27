import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { catalogFile } from './database.mjs';
import { chenRangeTrigramProfile, tiebanBaseNumbers, tiebanMissReason, tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-range-trigrams-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const calculation = tieban => tieban?.additionalCalculations.find(row => row.profile === chenRangeTrigramProfile);

function birth(instant, gender) {
  const local = instant + 8 * 3600000;
  const chart = calculateBaZi(instant, local, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
    birthYear: new Date(local).getUTCFullYear() };
}

const pillarsOf = query => query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);

function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}

test('Method 5 reproduces both printed hexagrams, both mutual pairs and all four clause numbers', async () => {
  const query = birth(Date.parse('1865-04-08T20:00:00Z'), '男');
  assert.deepEqual(pillarsOf(query), ['乙丑', '庚辰', '己酉', '丙寅']);
  const rows = calculation(tiebanBaseNumbers(query.confirmedFacts, query.birthYear)).candidates;
  assert.deepEqual(rows.map(({ clauseId, upper, lower, mutualUpper, mutualLower }) =>
    [clauseId, upper, lower, mutualUpper, mutualLower]), [
    [1588, '巽', '坤', undefined, undefined], [1578, '巽', '坤', '艮', '坤'],
    [2696, '坎', '艮', undefined, undefined], [2636, '坎', '艮', '离', '坎'],
  ]);
  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第五法日时干支取号 2696/u);
      assert.match(materials, /分别用年月、日时取卦/u);
      assert.doesNotMatch(materials, /陈氏第五法[^、\n]+ (?:1588|1578|2636)(?!\d)/u);
      return '测试报告';
    },
  });
  assert.equal(calculation(tieban).libraryEdition, 'muxuan-json');
  assert.deepEqual(calculation(tieban).results.map(({ clauseId, status, claimId, reason, age }) => [clauseId, status, claimId ?? reason, age]), [
    [1588, 'unmatched', 'not_in_catalog', undefined], [1578, 'unmatched', 'not_in_catalog', undefined],
    [2696, 'matched', 'tbss-v2-clauses-p02696-001', undefined], [2636, 'unmatched', 'not_in_catalog', undefined],
  ]);
  assert.equal(lookup(parsed(query, false).chartQueries)[0].tieban, undefined);
});

test('the year/month mutual branch also reproduces Method 6 and retains short-number, time and gender misses', () => {
  const sixth = birth(Date.parse('1956-02-11T20:00:00Z'), '男');
  assert.deepEqual(pillarsOf(sixth), ['丙申', '庚寅', '己酉', '丙寅']);
  const references = lookup(parsed(sixth).chartQueries);
  const hit = calculation(references[0].tieban).results[1];
  assert.deepEqual([hit.axis, hit.upper, hit.lower, hit.mutualUpper, hit.mutualLower, hit.clauseId, hit.claim.id],
    ['chen_range_year_month_mutual', '艮', '坎', '坤', '震', 3784, 'tbss-v3-clauses-p03784-001']);
  assert.match(buildReportMaterials(references), /年月互卦也可复算第六法初刻候选号/u);

  for (const [instant, clauseId, reason] of [
    ['1924-03-15T04:00:00Z', 499, 'not_in_catalog'],
    ['1924-05-15T04:00:00Z', 1599, 'scope_mismatch'],
    ['1928-10-15T04:00:00Z', 9355, 'gender_mismatch'],
  ]) {
    const query = birth(Date.parse(instant), '男');
    const row = calculation(lookup(parsed(query).chartQueries)[0].tieban).results[0];
    assert.deepEqual([row.clauseId, row.status, row.reason, row.claim], [clauseId, 'unmatched', reason, undefined]);
  }
});

test('all legal year/month and day/hour pairs verify the formulas and reach every eligible source', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
  const stemValues = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5], branchValues = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
  // Bottom line is the least significant bit. Index zero represents 坤 at 八.
  const lines = [0, 7, 3, 5, 1, 6, 2, 4];
  const trigramNumber = bits => lines.indexOf(bits) || 8;
  const values = ([stem, branch]) => [stemValues[stems.indexOf(stem)], branchValues[branches.indexOf(branch)]];
  const jsonClauses = new Map();
  for (const claim of JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'))) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') {
      for (const number of selector.clauseIds) jsonClauses.set(number, claim);
    }
  }
  const numberSets = Array.from({ length: 4 }, () => new Set());
  const sourceSets = Array.from({ length: 4 }, () => new Set());
  const proofs = new Map();
  const yearMonths = Array.from({ length: 720 }, (_, index) => Date.UTC(1924 + Math.floor(index / 12), index % 12, 15, 12));
  const dayHours = Array.from({ length: 720 }, (_, index) => Date.UTC(1990, 5, 1 + Math.floor(index / 12), 2 * (index % 12)));
  for (const [group, times] of [yearMonths, dayHours].entries()) {
    const pairKeys = new Set();
    for (const wall of times) for (const gender of ['男', '女']) {
      const query = birth(wall - 8 * 3600000, gender);
      const groupStart = 2 * group;
      const pair = pillarsOf(query).slice(groupStart, groupStart + 2);
      pairKeys.add(pair.join(''));
      const [[stem, branch], [secondStem, secondBranch]] = pair.map(values);
      const lower = (stem + branch) % 8, upper = (secondStem + secondBranch) % 8;
      const upperNumber = upper || 8;
      const prefix = 1000 * ((upperNumber + 6) % 10) + 100 * upperNumber;
      const hexagram = 8 * lines[upper] + lines[lower];
      const mutualDigits = 10 * trigramNumber((hexagram >> 2) & 7) + trigramNumber((hexagram >> 1) & 7);
      const raw = tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
      const figures = calculation(raw).candidates.slice(groupStart, groupStart + 2);
      assert.deepEqual(figures.map(row => row.clauseId), [prefix + 10 * stem + branch, prefix + mutualDigits]);
      for (const [offset, { axis, clauseId }] of figures.entries()) {
        numberSets[groupStart + offset].add(clauseId);
        const claim = jsonClauses.get(clauseId);
        if (tiebanMissReason(claim, gender)) continue;
        sourceSets[groupStart + offset].add(claim.id);
        if (!proofs.has(claim.id)) proofs.set(claim.id, { query, axis, clauseId });
      }
    }
    assert.equal(pairKeys.size, 720);
  }
  assert.deepEqual(numberSets.map(set => set.size), [228, 32, 228, 32]);
  assert.deepEqual(sourceSets.map(set => set.size), [80, 12, 82, 12]);
  assert.deepEqual(new Set(proofs.keys()), new Set(sourceSets.flatMap(set => [...set])));
  assert.equal(proofs.size, 91);
  for (const [id, { query, axis, clauseId }] of proofs) {
    const references = lookup(parsed(query).chartQueries);
    const row = calculation(references[0].tieban).results.find(result => result.axis === axis);
    assert.equal(row.status, 'matched', id);
    assert.equal(row.claim.id, id);
    assert.equal(row.clauseId, clauseId, id);
    const materials = buildReportMaterials(references);
    assert.ok(materials.includes(row.claim.evidence.original_text), id);
    assert.match(materials, new RegExp('陈氏第五法[^、\\n]+ ' + clauseId + '(?!\\d)', 'u'), id);
  }
});
