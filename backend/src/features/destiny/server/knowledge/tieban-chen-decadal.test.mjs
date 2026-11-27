import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { chenDecadalProfile, tiebanDecadalProfile, tiebanMissReason, tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-decadal-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const readFixture = name => JSON.parse(readFileSync(new URL(`./claims/${name}.json`, import.meta.url), 'utf8'));
const fixture = readFixture('tieban-chen-decadal-witnesses');
const completionAxis = 'chen_decadal_completion';
const growthAxis = 'chen_decadal_growth';
const calculation = (tieban, profile = chenDecadalProfile) => tieban?.additionalCalculations.find(row => row.profile === profile);
const rowFor = references => references.find(row => row.tieban)?.tieban;

function birth({ birthTime, gender }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3600000, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}

test('Method 13 reproduces both printed numbers in each period with version and time-scope checks', async () => {
  const query = birth(fixture.printed);
  assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), fixture.printed.pillars);
  const input = parsed(query), tieban = rowFor(lookup(input.chartQueries));
  const { libraryEdition, results } = calculation(tieban);
  const expected = [
    ['辛巳', 10466, 10471], ['壬午', 7466, 7471], ['癸未', 7469, 7474], ['甲申', 8468, 8473],
    ['乙酉', 8468, 8473], ['丙戌', 10469, 10474], ['丁亥', 7465, 7470],
  ];
  assert.equal(libraryEdition, 'muxuan-json');
  assert.deepEqual(results.slice(0, 14).map(({ decadalPeriod, clauseId, axis }) => [decadalPeriod.ganZhi, clauseId, axis]),
    expected.flatMap(([ganZhi, growth, completion]) => [[ganZhi, growth, growthAxis], [ganZhi, completion, completionAxis]]));
  assert.deepEqual(results.filter(row => row.axis === growthAxis).map(({ axis, ...row }) => row),
    calculation(tieban, tiebanDecadalProfile).results.map(({ axis, ...row }) => row));
  assert.equal(results[1].claim.id, 'tbss-v10-clauses-p10471-001');
  assert.equal(results[2].reason, 'not_in_catalog');
  assert.equal(results[3].reason, 'scope_mismatch');
  assert.equal(results[5].reason, 'not_in_catalog');
  for (const result of results.filter(row => row.status === 'unmatched')) assert.equal(result.claim, undefined);

  const response = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第十三法大运成数 10471（辛巳运，排盘/u);
      assert.match(materials, /大运生数、成数按同一步大运分别计算/u);
      assert.doesNotMatch(materials, /陈氏第十三法大运成数 (?:7471|7474|7470)/u);
      return '测试解读';
    },
  });
  assert.equal(calculation(response.tieban).results[1].claimId, 'tbss-v10-clauses-p10471-001');
  assert.deepEqual(calculation(response.tieban).results[1].decadalPeriod, results[1].decadalPeriod);
});

test('the new calculation needs confirmed and coherent natal luck periods', () => {
  const query = birth(fixture.printed);
  const facts = query.confirmedFacts.filter(fact => fact.kind !== 'bazi_decadal_range');
  assert.equal(calculation(rowFor(lookup(parsed({ ...query, confirmedFacts: facts }).chartQueries))), undefined);
  const conflict = { kind: 'bazi_decadal_range', ganZhi: '癸亥', startAge: 30, endAge: 39 };
  assert.equal(calculation(rowFor(lookup(parsed({ ...query, confirmedFacts: [...query.confirmedFacts, conflict] }).chartQueries))), undefined);
  assert.equal(rowFor(lookup(parsed(query, false).chartQueries)), undefined);
});

test('the complete legal stem and branch domain has a native SQLite witness for every eligible completion clause', () => {
  const stem = [4, 4, 6, 3, 3, 4, 4, 6, 3, 3];
  const completion = [6, 10, 8, 8, 10, 7, 7, 10, 9, 9, 10, 6];
  const numbers = { '男': new Set(), '女': new Set() };
  let combinations = 0;
  for (let year = 0; year < 60; year++) for (let month = 0; month < 12; month++) {
    const monthStem = (2 * (year % 5) + 2 + month) % 10, monthBranch = (month + 2) % 12;
    for (let day = 0; day < 10; day++) for (let hour = 0; hour < 12; hour++) for (const gender of ['男', '女']) {
      const hourStem = (2 * day + hour) % 10;
      const direction = (year % 2 === 0) === (gender === '男') ? 1 : -1;
      combinations++;
      for (let offset = 1; offset <= 10; offset++) {
        const luckStem = (monthStem + direction * offset + 10) % 10;
        const luckBranch = (monthBranch + direction * offset + 12) % 12;
        const number = (stem[monthStem] + stem[luckStem]) * 1000 + stem[day] * 100
          + stem[hourStem] * 10 + stem[year % 10] + completion[luckBranch];
        numbers[gender].add(number);
      }
    }
  }
  assert.equal(combinations, fixture.chartCombinations);
  assert.equal(new Set([...numbers['男'], ...numbers['女']]).size, fixture.completionNumbers);
  const eligible = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8')).filter(claim => {
    const selector = tiebanSelector(claim);
    return selector?.libraryEdition === 'muxuan-json' && ['男', '女'].some(gender =>
      !tiebanMissReason(claim, gender) && selector.clauseIds.some(number => numbers[gender].has(number)));
  });
  const hitIds = new Set();
  for (const sample of fixture.witnesses) {
    const references = lookup(parsed(birth(sample)).chartQueries);
    const results = calculation(rowFor(references)).results;
    const materials = buildReportMaterials(references);
    for (const { clauseId, claimId, ganZhi } of sample.proofs) {
      const hit = results.find(row => row.axis === completionAxis && row.clauseId === clauseId && row.decadalPeriod.ganZhi === ganZhi);
      assert.equal(hit?.status, 'matched', claimId);
      assert.equal(hit.claim.id, claimId);
      assert.ok(materials.includes(`陈氏第十三法大运成数 ${clauseId}（${ganZhi}运`), claimId);
      assert.ok(materials.includes(hit.claim.evidence.original_text), claimId);
      hitIds.add(claimId);
    }
  }
  assert.deepEqual(hitIds, new Set(eligible.map(claim => claim.id)));
  assert.equal(hitIds.size, fixture.reached);

  const previousIds = new Set(['tieban-decadal-witnesses', 'tieban-tianyuan-year-witnesses',
    'tieban-day-hexagram-witnesses', 'tieban-huangji-witnesses', 'tieban-heluo-witnesses', 'tieban-fourteen-witnesses']
    .flatMap(name => readFixture(name).witnesses.flatMap(row => row.claimId ? [row.claimId]
      : row.results?.map(result => result.claimId) ?? row.proofs?.map(proof => proof.id) ?? [])));
  assert.equal([...hitIds].filter(id => !previousIds.has(id)).length, fixture.additionalReach);
});
