import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { catalogFile } from './database.mjs';
import { chenHeluoTotalsProfile } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-heluo-totals-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const fixtures = JSON.parse(readFileSync(new URL('./claims/tieban-chen-heluo-totals-witnesses.json', import.meta.url)));
const calculationFor = tieban => tieban?.additionalCalculations.find(row => row.profile === chenHeluoTotalsProfile);

function birth({ birthTime, gender, pillars }, timeKnown = true) {
  const instant = Date.parse(birthTime), wallTime = instant + 8 * 3_600_000;
  const chart = calculateBaZi(instant, wallTime, gender === '男' ? 'male' : 'female');
  const { year, month, day, hour } = chart;
  assert.deepEqual([year, month, day, hour], pillars);
  const input = parseInput({ timeKnown, chartQueries: [{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    birthYear: new Date(wallTime).getUTCFullYear(), confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  }] });
  assert.ok(input);
  return input;
}

test('printed Methods 1 and 2 reproduce 26 and 34 as 2634 and expose a missing number without quoting it', async () => {
  const example = { birthTime: '1968-03-02T16:00:00Z', gender: '男', pillars: ['戊申', '甲寅', '壬申', '庚子'] };
  const report = await generateReport(birth(example), {
    lookup, signal: new AbortController().signal, complete: async ({ materials }) => {
      assert.doesNotMatch(materials, /陈氏河洛天地数编号 2634/u);
      return '测试报告';
    },
  });
  assert.deepEqual(calculationFor(report.tieban), {
    profile: chenHeluoTotalsProfile, libraryEdition: 'muxuan-json', results: [{
      axis: 'chen_heluo_totals', clauseId: 2634, status: 'unmatched', reason: 'not_in_catalog',
      heluoTotals: { heavenTotal: 26, earthTotal: 34 },
    }],
  });
  assert.equal(calculationFor(lookup(birth(example, false).chartQueries)[0].tieban), undefined);
});

test('the raw totals path matches each witnessed source through SQLite and report materials', () => {
  const seen = new Set();
  for (const sample of fixtures) {
    const references = lookup(birth(sample).chartQueries);
    const { tieban } = references[0];
    const calculation = calculationFor(tieban);
    assert.equal(calculation.libraryEdition, 'muxuan-json');
    const [hit] = calculation.results;
    assert.equal(hit.status, 'matched', sample.id);
    assert.equal(hit.claim.id, sample.id);
    assert.equal(hit.clauseId, sample.clauseId);
    assert.deepEqual(hit.heluoTotals, { heavenTotal: sample.heavenTotal, earthTotal: sample.earthTotal });
    assert.equal(hit.age, undefined);
    const earlierPaths = [tieban, ...tieban.additionalCalculations.filter(row => row !== calculation)];
    assert.ok(earlierPaths.every(row => row.results.every(result => result.requiresSelection
      || result.claim?.id !== sample.id)), sample.id);
    const materials = buildReportMaterials(references);
    assert.ok(materials.includes(`陈氏河洛天地数编号 ${sample.clauseId}（天数${sample.heavenTotal}、地数${sample.earthTotal}）`), sample.id);
    assert.ok(materials.includes(hit.claim.evidence.original_text), sample.id);
    assert.match(materials, /天地数编号以奇数合计乘一百加偶数合计/u);
    seen.add(sample.id);
  }
  assert.equal(seen.size, fixtures.length);
  assert.equal(seen.size, 257);
});

test('same-number other editions, annual rows, and the wrong gender remain unmatched', () => {
  for (const [birthTime, gender, pillars, clauseId, reason] of [
    ['1921-03-22T01:00:00Z', '男', ['辛酉', '辛卯', '甲申', '己巳'], 3732, 'not_in_catalog'],
    ['1900-03-15T10:00:00Z', '男', ['庚子', '己卯', '丁亥', '己酉'], 4224, 'scope_mismatch'],
    ['1902-05-23T10:00:00Z', '女', ['壬寅', '乙巳', '丙午', '丁酉'], 3332, 'gender_mismatch'],
  ]) {
    const references = lookup(birth({ birthTime, gender, pillars }).chartQueries);
    const [result] = calculationFor(references[0].tieban).results;
    assert.deepEqual([result.clauseId, result.status, result.reason, result.claim], [clauseId, 'unmatched', reason, undefined]);
    assert.ok(!buildReportMaterials(references).includes(`陈氏河洛天地数编号 ${clauseId}`));
  }
});
