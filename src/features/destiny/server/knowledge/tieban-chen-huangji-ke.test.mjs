import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { catalogFile } from './database.mjs';
import { chenHuangjiKeProfile, tiebanBaseNumbers } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-huangji-ke-'));
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const catalog = historicalTiebanCatalog(directory);
const lookup = createHistoricalTiebanLookup(directory);
const calculation = tieban => tieban?.additionalCalculations.find(row => row.profile === chenHuangjiKeProfile);
const example = '1955-03-11T12:00:00Z';

function natal(wallDate = example, gender = '男') {
  const local = Date.parse(wallDate);
  const chart = calculateBaZi(local - 8 * 3_600_000, local, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    birthYear: new Date(local).getUTCFullYear(),
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}

function parse(query, timeKnown = true) {
  return parseInput({ timeKnown, chartQueries: [query] });
}

test('Method 4(2) reproduces the two printed series and reduces only numbers above 13000', () => {
  const { confirmedFacts, birthYear } = natal();
  assert.deepEqual(confirmedFacts.filter(f => f.kind === 'pillar').map(f => f.ganZhi), ['乙未', '己卯', '辛未', '甲午']);
  const numbers = steps => calculation(tiebanBaseNumbers(confirmedFacts, birthYear, undefined, steps));
  assert.equal(numbers(undefined), undefined);
  const { candidates } = numbers({ yearMonth: 1, dayHour: 0 });
  assert.deepEqual(candidates.map(row => row.rawClauseId), [
    9645, 10545, 10245, 9723, 9732, 9741, 13181, 14081, 13781, 13259, 13268, 13277,
  ]);
  assert.deepEqual(candidates.map(row => row.clauseId), [
    9645, 10545, 10245, 9723, 9732, 9741, 1181, 2081, 1781, 1259, 1268, 1277,
  ]);
  assert.deepEqual(candidates.map(row => row.calculationStep), [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
  assert.ok(candidates.every((row, index) => row.requiresSelection
    && row.initialNumber === (index < 6 ? 9615 : 13181) && row.keSteps === (index < 6 ? 1 : 0)));
  const first = numbers({ dayHour: 399 }).candidates[0];
  assert.equal(first.rawClauseId, 25151);
  assert.equal(first.clauseId, 1151);

  const boundary = natal('2000-01-04T14:00:00Z');
  const edge = calculation(tiebanBaseNumbers(boundary.confirmedFacts, boundary.birthYear, undefined, { yearMonth: 80, dayHour: 28 }));
  assert.equal(edge.candidates.find(row => row.rawClauseId === 13000)?.clauseId, 13000);
  assert.equal(edge.candidates.find(row => row.rawClauseId === 13001)?.clauseId, 1001);
});

test('ke inputs have two independent axes and require complete natal facts', () => {
  const query = natal();
  for (const bad of [null, [], {}, { yearMonth: -1 }, { yearMonth: 400 }, { dayHour: '0' },
    { dayHour: 0.5 }, { yearMonth: 0, step: 1 }]) {
    assert.equal(parse({ ...query, tiebanChenHuangjiKe: bad }), null);
  }
  assert.equal(parse({ ...query, chartScope: 'annual', tiebanChenHuangjiKe: { dayHour: 0 } }), null);
  const pending = { ...query, tiebanChenHuangjiKe: { dayHour: 0 } };
  const input = parse(pending);
  assert.deepEqual(input.chartQueries[0].tiebanChenHuangjiKe, { dayHour: 0 });
  const partial = parse(pending, false);
  assert.equal(partial.chartQueries[0].tiebanChenHuangjiKe, undefined);
  assert.equal(tiebanBaseNumbers(partial.chartQueries[0].confirmedFacts, query.birthYear, undefined, { dayHour: 0 }), null);
  const numbers = tiebanBaseNumbers(query.confirmedFacts, query.birthYear, undefined, { dayHour: 0 });
  assert.ok(calculation(numbers).candidates.every(row => row.axis === 'chen_huangji_ke_day_hour'));
});

test('SQLite resolves the folded numbers and the report keeps candidate evidence out of the model', async () => {
  const query = natal();
  const input = parse({ ...query, tiebanChenHuangjiKe: { yearMonth: 1, dayHour: 0 } });
  const signal = new AbortController().signal;
  let received;
  const complete = ({ materials }) => {
    received = materials;
    return '测试报告';
  };
  await generateReport(parse(query), { lookup, complete, signal });
  const original = received;
  const output = await generateReport(input, { lookup, complete, signal });
  assert.equal(received, original);
  const ke = calculation(output.tieban);
  assert.equal(ke.libraryEdition, 'muxuan-json');
  const rows = new Map(ke.results.map(row => [row.clauseId, row]));
  assert.equal(rows.get(10545).claimId, 'tbss-v10-clauses-p10545-001');
  assert.equal(rows.get(10545).status, 'matched');
  assert.deepEqual(rows.get(1181), {
    axis: 'chen_huangji_ke_day_hour', clauseId: 1181, status: 'unmatched', reason: 'not_in_catalog',
    calculationStep: 1, keSteps: 0, initialNumber: 13181, rawClauseId: 13181, requiresSelection: true,
  });
  assert.equal(rows.get(9645).reason, 'scope_mismatch');
  assert.ok(ke.results.every(row => row.requiresSelection && !Object.hasOwn(row, 'claim')));
  const same = calculation(catalog.tiebanMatches(query.confirmedFacts, query.birthYear, undefined, undefined, { yearMonth: 1 }));
  assert.equal(same.results.length, 6);
  assert.equal(same.results.find(row => row.clauseId === 10545).claim.id, rows.get(10545).claimId);
});

test('a number available only in the CSV edition and a sex-restricted clause remain unmatched', () => {
  const { confirmedFacts, birthYear } = natal();
  const results = steps =>
    calculation(catalog.tiebanMatches(confirmedFacts, birthYear, undefined, undefined, { yearMonth: steps, dayHour: steps })).results;
  assert.equal(results(3).find(row => row.clauseId === 9783)?.reason, 'not_in_catalog');
  assert.equal(results(5).find(row => row.clauseId === 10665)?.reason, 'gender_mismatch');
  const db = openKnowledgeReadDatabase(join(directory, catalogFile));
  try {
    const editions = db.prepare('SELECT library_edition FROM tieban_clause_number WHERE clause_id = ?').all(9783);
    assert.deepEqual(editions.map(row => row.library_edition), ['muxuan-fourteen-table-csv']);
  } finally {
    db.close();
  }
});
