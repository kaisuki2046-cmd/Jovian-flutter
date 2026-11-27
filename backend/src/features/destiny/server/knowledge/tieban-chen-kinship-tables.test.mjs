import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { chenKinshipTablesProfile, tiebanBaseNumbers, tiebanFourteenEdition } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-kinship-tables-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const method = tieban => tieban?.additionalCalculations.find(({ profile }) => profile === chenKinshipTablesProfile);
const published = '1968-03-02T16:00:00Z';

function birth(date, gender = '男') {
  const instant = Date.parse(date);
  const local = instant + 8 * 3_600_000;
  const chart = calculateBaZi(instant, local, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    birthYear: new Date(local).getUTCFullYear(), confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

test('the four printed trigram pairs and all ten row endpoints reproduce from calendar data', () => {
  const { confirmedFacts, birthYear } = birth(published);
  assert.deepEqual(confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi),
    ['戊申', '甲寅', '壬申', '庚子']);
  const calculation = method(tiebanBaseNumbers(confirmedFacts, birthYear));
  assert.equal(calculation.status, undefined);
  assert.equal(calculation.candidates.length, 120);
  for (const [pillar, upper, lower, relative, first, last] of [
    ['year', '坎', '巽', '父', 9003, 9553], ['year', '坎', '巽', '母', 9605, 10155],
    ['month', '巽', '震', '兄', 10340, 10450], ['month', '巽', '震', '弟', 11014, 11124],
    ['month', '巽', '震', '姐', 11164, 11274], ['month', '巽', '震', '妹', 11284, 11394],
    ['day', '坎', '离', '妻', 9767, 10317], ['day', '坎', '离', '夫', 10363, 10913],
    ['hour', '巽', '乾', '子', 12123, 12233], ['hour', '巽', '乾', '女', 12243, 12353],
  ]) {
    const rows = calculation.candidates.filter(candidate => candidate.kinshipTable.relative === relative);
    assert.deepEqual(rows.map(({ kinshipTable, requiresSelection }) =>
      [kinshipTable.pillar, kinshipTable.upper, kinshipTable.lower, kinshipTable.branch, requiresSelection]),
    [...'子丑寅卯辰巳午未申酉戌亥'].map(branch => [pillar, upper, lower, branch, true]));
    assert.equal(rows[0].clauseId, first);
    assert.equal(rows.at(-1).clauseId, last);
  }
  const changed = birth('1968-03-03T16:00:00Z');
  const partial = method(tiebanBaseNumbers(changed.confirmedFacts, changed.birthYear));
  assert.deepEqual([partial.status, partial.reason, partial.candidates.length], ['partial', 'kinship_table_unverified', 72]);
  assert.deepEqual([...new Set(partial.candidates.map(({ kinshipTable }) => kinshipTable.pillar))], ['year', 'month']);
});

test('SQLite verifies relation and branch in the original clauses and applies catalog gender restrictions', () => {
  const verifiedIds = new Set();
  for (const [gender, count, oppositeSpouse] of [['男', 104, 10363], ['女', 106, 9767]]) {
    const { confirmedFacts, birthYear } = birth(published, gender);
    const calculation = method(catalog.tiebanMatches(confirmedFacts, birthYear));
    assert.equal(calculation.libraryEdition, 'muxuan-json');
    const at = number => calculation.results.find(row => row.clauseId === number);
    const matches = calculation.results.filter(row => row.status === 'matched');
    assert.equal(matches.length, count);
    for (const { clauseId, claim, requiresSelection } of matches) {
      assert.ok(requiresSelection);
      assert.ok(claim.conditions.match.selector.clauseIds.includes(clauseId));
      assert.equal(claim.conditions.match.selector.libraryEdition, calculation.libraryEdition);
      verifiedIds.add(claim.id);
    }
    for (const [number, relative, prefix] of [[12123, '子', '子属鼠'], [12243, '女', '女属鼠']]) {
      assert.equal(at(number).kinshipTable.relative, relative);
      assert.ok(at(number).claim.evidence.original_text.startsWith(prefix));
    }
    for (const number of [9153, 10155]) {
      assert.deepEqual([at(number).status, at(number).reason, at(number).claim], ['unmatched', 'source_text_mismatch', undefined]);
    }
    assert.equal(at(oppositeSpouse).reason, 'gender_mismatch');
    assert.equal(at(9163), undefined);
  }
  assert.equal(verifiedIds.size, 118);
});

test('report diagnostics carry the source and table coordinate without promoting a candidate to model evidence', async () => {
  const query = birth(published);
  const input = parseInput({ timeKnown: true, chartQueries: [query] });
  const report = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials, references }) => {
      assert.ok(!materials.includes('父年鼠年方合'));
      assert.ok(!JSON.stringify(references).includes('tbss-v9-clauses-p09003-001'));
      return '测试报告';
    },
  });
  assert.deepEqual(method(report.tieban).results[0], {
    axis: 'chen_kinship_table', clauseId: 9003, status: 'matched', requiresSelection: true,
    claimId: 'tbss-v9-clauses-p09003-001',
    kinshipTable: { pillar: 'year', relative: '父', branch: '子', upper: '坎', lower: '巽' },
  });
  const unknown = parseInput({ timeKnown: false, chartQueries: [query] });
  assert.equal(method(lookup(unknown.chartQueries)[0].tieban), undefined);
});

test('an uncollected primary-edition number stays missing even when another edition has it', () => {
  catalog.ensure();
  const db = new DatabaseSync(catalog.file);
  try {
    assert.ok(db.prepare('SELECT 1 FROM tieban_clause_number WHERE library_edition = ? AND clause_id = 9003').get(tiebanFourteenEdition));
    assert.equal(db.prepare('DELETE FROM tieban_clause_number WHERE library_edition = ? AND clause_id = 9003').run('muxuan-json').changes, 1);
  } finally { db.close(); }
  const { confirmedFacts, birthYear } = birth(published);
  const result = method(catalog.tiebanMatches(confirmedFacts, birthYear)).results[0];
  assert.deepEqual([result.clauseId, result.status, result.reason, result.claim], [9003, 'unmatched', 'not_in_catalog', undefined]);
});
