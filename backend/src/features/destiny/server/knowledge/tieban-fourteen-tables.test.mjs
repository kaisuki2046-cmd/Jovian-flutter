import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions, lunarBirthDate } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { tiebanFourteenEdition } from './tieban.mjs';

const offset = 8 * 3600000;
const catalog = historicalTiebanCatalog();
const lookup = createHistoricalTiebanLookup();
const sourceExample = { birthDate: '1924-06-15T16:00:00.000Z', gender: '男', queryTimePillar: '己巳' };
const fixtures = JSON.parse(readFileSync(new URL('./claims/tieban-fourteen-witnesses.json', import.meta.url), 'utf8'));

function request({ birthDate, gender, queryTimePillar, age } = sourceExample) {
  const date = new Date(birthDate), wallTime = +date;
  const chart = calculateBaZi(wallTime - offset, wallTime);
  const { year, month, day, hour } = chart;
  const confirmedFacts = [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
  const birthYear = date.getUTCFullYear();
  const tiebanFourteenTable = { ...lunarBirthDate({ year: birthYear, month: date.getUTCMonth() + 1, day: date.getUTCDate() }),
    queryTimePillar, ...(age !== undefined && { age }) };
  return { timeKnown: true, chartQueries: [{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts, birthYear, tiebanFourteenTable }], pillars: [year, month, day, hour] };
}

function resolve(input) {
  const parsed = parseInput(input);
  assert.ok(parsed);
  const references = lookup(parsed.chartQueries);
  const calculations = references.find(ref => ref.tieban)?.tieban.additionalCalculations
    .filter(row => row.libraryEdition === tiebanFourteenEdition) ?? [];
  return { references, calculations };
}

test('source example uses the explicit consultation pillar and preserves separate CSV and JSON versions', () => {
  const input = request({ ...sourceExample, age: 1 });
  assert.deepEqual(input.pillars, ['甲子', '庚午', '乙丑', '甲申']);
  assert.deepEqual(input.chartQueries[0].tiebanFourteenTable, { lunarMonth: 5, lunarDay: 14, leap: false, queryTimePillar: '己巳', age: 1 });
  const { calculations, references } = resolve(input);
  assert.equal(calculations.length, 2);
  const [natal, annual] = calculations;
  assert.deepEqual(natal.results.map(({ clauseId }) => clauseId), [9760, 1353, 10606, 1559]);
  assert.equal(natal.results[0].claim.id, 'tbss14-v9-clauses-p09760-001');
  for (const result of natal.results.slice(1)) {
    assert.equal(result.status, 'unmatched');
    assert.equal(result.reason, 'not_in_catalog');
    assert.equal(result.claim, undefined);
  }
  assert.deepEqual(annual.results, [
    { axis: 'fourteen_annual', clauseId: 2408, age: 1, status: 'unmatched', reason: 'not_in_catalog' },
    { axis: 'fourteen_annual_corrected', clauseId: 6539, age: 1, status: 'unmatched', reason: 'not_in_catalog' },
  ]);
  assert.deepEqual(resolve(request({ ...sourceExample, age: 2 })).calculations[1].results.map(result => result.clauseId), [8151, 3274]);
  const materials = buildReportMaterials(references);
  assert.match(materials, /沐玄十四表 CSV 版.*9760/u);
  assert.doesNotMatch(materials, /深谋远虑，多作敢为|财源有分终须有/u);
});

test('all eligible CSV sources have a native birth, consultation input and report material', () => {
  const seen = new Set();
  assert.deepEqual(fixtures.pending, []);
  for (const sample of fixtures.witnesses) {
    const { calculations, references } = resolve(request(sample));
    const materials = buildReportMaterials(references);
    for (const expected of sample.proofs) {
      const hit = calculations.flatMap(row => row.results).find(row => row.axis === expected.axis && row.clauseId === expected.clauseId);
      assert.ok(hit, expected.id);
      assert.equal(hit.claim.id, expected.id);
      assert.equal(hit.status, 'matched');
      assert.equal(hit.age, expected.age);
      assert.ok(materials.includes(hit.claim.evidence.original_text), expected.id);
      seen.add(hit.claim.id);
    }
  }
  assert.equal(seen.size, 21);
  assert.equal(fixtures.witnesses.flatMap(sample => sample.proofs).filter(proof => proof.age === undefined).length, 8);
});

test('consultation input is optional, malformed data is rejected and missing tables stay unavailable', () => {
  const defaultInput = request();
  const { tiebanFourteenTable, ...defaultQuery } = defaultInput.chartQueries[0];
  const without = { ...defaultInput, chartQueries: [defaultQuery] };
  assert.deepEqual(resolve(without).calculations, []);
  assert.equal(resolve(request()).calculations.length, 1);
  assert.deepEqual(resolve({ ...defaultInput, timeKnown: false }).calculations, []);
  for (const changed of [{ queryTimePillar: undefined }, { queryTimePillar: '甲丑' }, { age: 101 }, { age: 0 }, { lunarDay: 31 }]) {
    assert.equal(parseInput({ ...defaultInput, chartQueries: [{ ...defaultQuery, tiebanFourteenTable: { ...tiebanFourteenTable, ...changed } }] }), null);
  }
  const noTone = request({ birthDate: '2000-01-20T00:00:00.000Z', gender: '男', queryTimePillar: '己巳', age: 20 });
  assert.equal(noTone.chartQueries[0].tiebanFourteenTable.lunarMonth, 12);
  assert.deepEqual(resolve(noTone).calculations.map(row => [row.status, row.reason, row.results]), [
    ['unavailable', 'missing_table_cell', []], ['unavailable', 'missing_table_cell', []],
  ]);
});

test('annual sources require the exact table age and successful matches enter the report response', async () => {
  const disagreement = resolve(request(fixtures.mismatch)).calculations[1].results.find(row => row.clauseId === fixtures.mismatch.clauseId);
  assert.equal(disagreement.reason, 'age_mismatch');
  assert.equal(disagreement.claim, undefined);
  const parsed = parseInput(request({ ...sourceExample, age: 20 }));
  const report = await generateReport(parsed, {
    lookup,
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /十四表流年校正号 10043（表列20岁）/u);
      assert.doesNotMatch(materials, /十四表流年原号 7191/u);
      return '十四表取材测试';
    },
  });
  assert.equal(report.report, '十四表取材测试');
  const annual = report.tieban.additionalCalculations.find(row => row.profile === 'muxuan-fourteen-table-annual-v1');
  assert.deepEqual(annual.results, [
    { axis: 'fourteen_annual', clauseId: 7191, age: 20, status: 'unmatched', reason: 'not_in_catalog' },
    { axis: 'fourteen_annual_corrected', clauseId: 10043, age: 20, status: 'matched', claimId: 'tbss14-v10-clauses-p10043-001' },
  ]);
});

test('all reviewed numeric cells are present in the unified SQLite runtime', () => {
  catalog.ensure();
  const db = openKnowledgeReadDatabase(catalog.file);
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM tieban_calculation_cell').get().n, 5824);
    assert.equal(db.prepare("SELECT count(*) AS n FROM tieban_calculation_cell WHERE table_name = 'natal'").get().n, 288);
    assert.equal(db.prepare("SELECT count(*) AS n FROM tieban_calculation_cell WHERE table_name = 'annual_number'").get().n, 2028);
  } finally { db.close(); }
});
