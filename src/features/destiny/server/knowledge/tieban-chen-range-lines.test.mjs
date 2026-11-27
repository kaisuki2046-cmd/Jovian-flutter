import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { catalogFile } from './database.mjs';
import { chenRangeLineProfile, guanFrontBackProfile, tiebanBaseNumbers, tiebanMissReason, tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-range-lines-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const read = filename => JSON.parse(readFileSync(new URL(`./claims/${filename}.json`, import.meta.url), 'utf8'));
const fixture = read('tieban-chen-range-lines-witnesses');
const tiebanFor = refs => refs.find(ref => ref.tieban)?.tieban;
const rangeLinesOf = tieban => tieban?.additionalCalculations.find(row => row.profile === chenRangeLineProfile);
const utcOffset = 8 * 3600000;

function birth(instant, gender) {
  const wall = instant + utcOffset;
  const chart = calculateBaZi(instant, wall, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    birthYear: new Date(wall).getUTCFullYear(),
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}

const at = sample => birth(Date.parse(sample.birthTime), sample.gender);
const fullMatches = rows => rows.flatMap(row => row.results.filter(result => result.status === 'matched'));

test('Method 7 reproduces all ten printed numbers and uses each number only in the natal JSON edition', async () => {
  const query = at(fixture.printed);
  assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), ['庚戌', '己丑', '丁酉', '庚子']);
  const calculation = rangeLinesOf(tiebanBaseNumbers(query.confirmedFacts, query.birthYear));
  assert.deepEqual(calculation.candidates.filter(row => row.lineTotal).map(({ upper, lower, lineTotal }) => [upper, lower, lineTotal]),
    [['震', '离', 360], ['巽', '离', 390]]);
  assert.deepEqual(calculation.candidates.map(({ clauseId }) => clauseId),
    [3351, 3447, 3543, 3639, 3735, 4381, 4285, 4189, 4093, 3997]);

  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第七法日时减96取号 4285（基数4381减96）/u);
      assert.match(materials, /年月依次加九十六，日时依次减九十六/u);
      assert.doesNotMatch(materials, /陈氏第七法[^、\n]+ (?:3351|3735|3997)(?!\d)/u);
      return '测试报告';
    },
  });
  const result = rangeLinesOf(tieban);
  assert.equal(result.libraryEdition, 'muxuan-json');
  assert.deepEqual(result.results.map(row => row.claimId ?? row.reason), [
    'scope_mismatch', 'not_in_catalog', 'not_in_catalog', 'not_in_catalog', 'gender_mismatch',
    'scope_mismatch', 'tbss-v4-clauses-p04285-001', 'tbss-v4-clauses-p04189-001', 'tbss-v4-clauses-p04093-001', 'not_in_catalog',
  ]);
  assert.ok(result.results.every(row => row.age === undefined));
  assert.equal(tiebanFor(lookup(parsed(query, false).chartQueries)), undefined);
});

test('a pair with an unverified trigram stays unavailable while the other verified pair can still be looked up', () => {
  const unavailable = birth(Date.parse('1924-01-15T04:00:00Z'), '男');
  const partial = birth(Date.parse('1925-01-15T04:00:00Z'), '男');
  const result = query => rangeLinesOf(tiebanFor(lookup(parsed(query).chartQueries)));
  assert.deepEqual(result(unavailable), {
    profile: chenRangeLineProfile, libraryEdition: 'muxuan-json',
    status: 'unavailable', reason: 'unverified_range_trigram', results: [],
  });
  assert.equal(result(partial).status, 'partial');
  assert.equal(result(partial).reason, 'unverified_range_trigram');
  assert.deepEqual(result(partial).results.map(row => row.clauseId), [3351, 3255, 3159, 3063, 2967]);
});

test('every supported chart pair reproduces the source arithmetic and the recorded hits reach SQLite and reports', () => {
  const sources = new Map();
  for (const claim of JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'))) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') {
      for (const number of selector.clauseIds) sources.set(number, claim);
    }
  }
  const years = Array.from({ length: 720 }, (_, i) => Date.UTC(1924 + Math.floor(i / 12), i % 12, 15, 12));
  const days = Array.from({ length: 720 }, (_, i) => Date.UTC(1990, 5, 1 + Math.floor(i / 12), 2 * (i % 12)));
  const values = { 12: [4, '011'], 13: [3, '100'], 17: [9, '101'] };
  const numbers = new Set(), eligible = new Set(), validPairs = new Set();
  let scanned = 0;
  for (const [position, times] of [[0, years], [2, days]]) {
    const pairs = new Set();
    for (const wall of times) for (const gender of ['男', '女']) {
      const query = birth(wall - utcOffset, gender);
      const pillars = query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);
      pairs.add(pillars.slice(position, position + 2).join(''));
      const raw = tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
      const [upSum, downSum] = raw.sums.slice(position, position + 2);
      const axis = position === 0 ? 'year_month' : 'day_hour';
      const candidates = rangeLinesOf(raw).candidates.filter(row => row.axis.includes(axis));
      const upper = values[upSum], lower = values[downSum];
      scanned++;
      if (!upper || !lower) {
        assert.deepEqual(candidates, []);
        continue;
      }
      validPairs.add(`${axis}:${upSum}:${downSum}`);
      const counts = { 0: 0, 1: 0 };
      const lineTotal = Array.from(upper[1] + lower[1]).reduce((sum, line) => sum + 30 * ++counts[line], 0);
      const base = 1000 * upper[0] + lineTotal - lower[0];
      const step = position === 0 ? 96 : -96;
      assert.deepEqual(candidates.map(row => row.clauseId), Array.from({ length: 5 }, (_, index) => base + index * step));
      for (const { clauseId } of candidates) {
        numbers.add(clauseId);
        const claim = sources.get(clauseId);
        if (!tiebanMissReason(claim, gender)) eligible.add(claim.id);
      }
    }
    assert.equal(pairs.size, 720);
  }
  assert.equal(scanned, fixture.scanned);
  assert.equal(validPairs.size, 18);
  assert.equal(numbers.size, fixture.numberCount);
  assert.equal(eligible.size, fixture.matchedSources);

  const observed = new Set(), additional = new Set();
  for (const sample of fixture.witnesses) {
    const refs = lookup(parsed(at(sample)).chartQueries), tieban = tiebanFor(refs), newCalculation = rangeLinesOf(tieban);
    const materials = buildReportMaterials(refs);
    // The fixture records coverage when Method 7 was introduced, before the Guan calculation.
    const earlier = tieban.additionalCalculations.filter(row => row !== newCalculation && row.profile !== guanFrontBackProfile);
    const otherMatches = new Set(fullMatches([tieban, ...earlier]).map(row => row.claim.id));
    for (const { claimId, clauseId, axis } of sample.proofs) {
      const row = newCalculation.results.find(row => row.axis === axis && row.clauseId === clauseId);
      assert.ok(row?.status === 'matched', claimId);
      assert.equal(row.claim.id, claimId);
      assert.ok(materials.includes(row.claim.evidence.original_text), claimId);
      observed.add(claimId);
      if (!otherMatches.has(claimId)) additional.add(claimId);
    }
  }
  assert.deepEqual(observed, eligible);
  assert.equal(additional.size, fixture.additionalOnSameChart);
});
