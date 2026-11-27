import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { tiebanBookAnnualProfile } from './tieban.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/tieban-book-annual-witnesses.json', import.meta.url)));
const lookup = createHistoricalTiebanLookup();
const annual = tieban => tieban?.additionalCalculations.find(row => row.profile === tiebanBookAnnualProfile);
const sample = { birthTime: '1950-09-08T04:00:00.000Z', gender: '男' };

function query({ birthTime, gender, age }) {
  const time = Date.parse(birthTime);
  const chart = calculateBaZi(time, time + 8 * 3600000, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, tiebanBookAnnualAge: age,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function inputFor(value, timeKnown = true) {
  return parseInput({ timeKnown, chartQueries: [value] });
}

function references(value, timeKnown = true) {
  const parsed = inputFor(value, timeKnown);
  assert.ok(parsed);
  return lookup(parsed.chartQueries);
}

const resultFor = (age, gender = '男') => annual(references(query({ ...sample, age, gender }))[0].tieban).results[0];

test('the reconstructed annual arithmetic uses the selected year, the actual luck interval and standard decimal carry', () => {
  const first = resultFor(10), next = resultFor(11), carry = resultFor(57);
  assert.deepEqual([first, next, carry].map(({ clauseId, annualPeriod }) => [clauseId, annualPeriod.ganZhi, annualPeriod.luckPillar]),
    [[8645, '己亥', '乙酉'], [10645, '庚子', '丙戌'], [8651, '丙戌', '庚寅']]);
  assert.equal(resultFor(61).annualPeriod.ganZhi, '庚寅');
  assert.deepEqual(resultFor(11, '女').annualPeriod, { ganZhi: '庚子', luckPillar: '甲申', beforeFirstLuck: true });
  assert.deepEqual(resultFor(12, '女').annualPeriod, { ganZhi: '辛丑', luckPillar: '癸未', beforeFirstLuck: false });
});

test('the selected age, calculation scope and corresponding confirmed luck range are required', () => {
  const base = query({ ...sample, age: 24 });
  assert.equal(annual(references(query(sample))[0].tieban), undefined);
  assert.equal(annual(references(base, false)[0].tieban), undefined);
  for (const age of [0, 101, 2.5, '24']) assert.equal(inputFor({ ...base, tiebanBookAnnualAge: age }), null);
  assert.equal(inputFor({ ...base, chartScope: 'annual' }), null);
  const missing = base.confirmedFacts.filter(row => row.kind !== 'bazi_decadal_range' || row.startAge !== 21);
  const unavailable = { profile: tiebanBookAnnualProfile, libraryEdition: 'muxuan-json',
    status: 'unavailable', reason: 'missing_confirmed_decadal_range', results: [] };
  assert.deepEqual(annual(references({ ...base, confirmedFacts: missing })[0].tieban), unavailable);
  assert.deepEqual(annual(references({ ...base, confirmedFacts: base.confirmedFacts.filter(row => row.kind !== 'bazi_decadal_range') })[0].tieban), unavailable);
  const conflict = { kind: 'bazi_decadal_range', ganZhi: '丁亥', startAge: 22, endAge: 31 };
  assert.deepEqual(annual(references({ ...base, confirmedFacts: [...base.confirmedFacts, conflict] })[0].tieban), unavailable);
});

test('native witnesses cover each observed annual claim and each version, scope, age or gender miss', () => {
  assert.equal(fixture.scanned, 12055);
  assert.equal(new Set(fixture.witnesses.map(witness => witness.claimId)).size, 47);
  assert.deepEqual(new Set(fixture.miss.map(witness => witness.reason)),
    new Set(['not_in_catalog', 'scope_mismatch', 'age_mismatch', 'gender_mismatch']));
  for (const witness of [...fixture.witnesses, ...fixture.miss]) {
    const refs = references(query(witness));
    const calculation = annual(refs[0].tieban);
    assert.equal(calculation.libraryEdition, 'muxuan-json');
    assert.equal(calculation.results.length, 1);
    const result = calculation.results[0];
    assert.deepEqual([result.clauseId, result.age, result.annualPeriod.ganZhi, result.annualPeriod.luckPillar],
      [witness.clauseId, witness.age, witness.annual, witness.luck]);
    const materials = buildReportMaterials(refs);
    if (witness.reason) {
      assert.equal(result.status, 'unmatched');
      assert.equal(result.reason, witness.reason);
      assert.equal(result.claim, undefined);
      assert.doesNotMatch(materials, /书传流年推算编号/u);
    } else {
      assert.equal(result.status, 'matched');
      assert.equal(result.claim.id, witness.claimId);
      assert.ok(materials.includes(result.claim.evidence.original_text));
      assert.ok(materials.includes(`书传流年推算编号 ${witness.clauseId}（${witness.age}虚岁，${witness.annual}`));
      assert.match(materials, /流年编号采用复原口径，千位保留大运天干/u);
    }
  }
  const csvOnly = resultFor(21);
  assert.equal(csvOnly.clauseId, 7649);
  assert.equal(csvOnly.reason, 'not_in_catalog');
  const db = openKnowledgeReadDatabase(historicalTiebanCatalog().file);
  try {
    const editions = db.prepare('SELECT library_edition FROM tieban_clause_number WHERE clause_id = ?').all(csvOnly.clauseId);
    assert.deepEqual(editions.map(item => item.library_edition), ['muxuan-fourteen-table-csv']);
  } finally { db.close(); }
});

test('a report can carry a book annual result and the separate fourteen-table request', async () => {
  const parsed = inputFor({ ...query({ ...sample, age: 24 }),
    tiebanFourteenTable: { lunarMonth: 7, lunarDay: 26, leap: false, queryTimePillar: '己巳', age: 20 } });
  assert.ok(parsed);
  const result = await generateReport(parsed, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /书传流年推算编号 7648（24虚岁，癸丑，大运丁亥）/u);
      assert.match(materials, /流年编号采用复原口径，千位保留大运天干/u);
      assert.doesNotMatch(materials, /^出处：|《乾集》第27节/mu);
      return '测试报告';
    },
  });
  assert.equal(result.report, '测试报告');
  assert.deepEqual(annual(result.tieban).results, [{ axis: 'book_annual', clauseId: 7648, age: 24,
    status: 'matched', claimId: 'tbss-v7-clauses-p07648-001',
    annualPeriod: { ganZhi: '癸丑', luckPillar: '丁亥', beforeFirstLuck: false } }]);
  assert.ok(result.tieban.additionalCalculations.some(row => row.libraryEdition === 'muxuan-fourteen-table-csv'));
});
