import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { guanFrontBackProfile, tiebanBaseNumbers, tiebanMissReason, tiebanSelector, tiebanSourceTextConflicts } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-guan-front-back-'));
const catalog = historicalTiebanCatalog(directory);
const lookup = createHistoricalTiebanLookup(directory);
const offset = 8 * 3_600_000;
const frontBack = tieban => tieban?.additionalCalculations.find(row => row.profile === guanFrontBackProfile);
const printed = Date.parse('1942-02-18T16:00:00Z');

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function birth(wall, gender) {
  const chart = calculateBaZi(wall - offset, wall, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, birthYear: new Date(wall).getUTCFullYear(),
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}

const pillars = query => query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);
const calculate = query => tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
const matched = calculation => calculation.results.filter(row => row.status === 'matched');

test('the book example calculates distinct front and back series and the report keeps their bases', async () => {
  const query = birth(printed, '男');
  assert.deepEqual(pillars(query), ['壬午', '壬寅', '壬寅', '戊申']);
  const calculation = calculate(query);
  assert.deepEqual(calculation.sums, [15, 13, 13, 12]);
  const numbers = [7453, 7549, 7645, 7741, 3260, 3164, 3068, 2972];
  assert.deepEqual(frontBack(calculation).candidates.map(row => row.clauseId), numbers);
  const input = parseInput({ timeKnown: true, chartQueries: [query] });
  const result = await generateReport(input, { lookup, signal: new AbortController().signal, complete: async ({ materials }) => {
    assert.match(materials, /关氏前卦加96取号 7741（基数7357加384）/u);
    assert.match(materials, /关氏后卦减96取号 3260（基数3356减96）/u);
    assert.match(materials, /年月加九十六四次，日时减九十六四次/u);
    assert.doesNotMatch(materials, /关氏(?:前卦加|后卦减)96取号 (?:7453|7549|7645|3164|3068)（/u);
    return '测试报告';
  } });
  assert.deepEqual(frontBack(result.tieban).results.map(row => row.claimId ?? row.reason), [
    'not_in_catalog', 'not_in_catalog', 'not_in_catalog', 'tbss-v7-clauses-p07741-001',
    'tbss-v3-clauses-p03260-001', 'scope_mismatch', 'not_in_catalog', 'tbss-v2-clauses-p02972-001',
  ]);
  assert.deepEqual(frontBack(result.tieban).results.map(({ rangeLineBase, lineOffset }) => [rangeLineBase, lineOffset]), [
    [7357, 96], [7357, 192], [7357, 288], [7357, 384],
    [3356, -96], [3356, -192], [3356, -288], [3356, -384],
  ]);
  const unknown = parseInput({ timeKnown: false, chartQueries: [query] });
  assert.equal(lookup(unknown.chartQueries).find(ref => ref.tieban), undefined);
});

test('same numbers from another library and numbers below the catalogue remain misses', () => {
  const outputs = (wall, number) => {
    const query = birth(Date.parse(wall), '男');
    return frontBack(catalog.tiebanMatches(query.confirmedFacts, query.birthYear)).results.find(row => row.clauseId === number);
  };
  assert.deepEqual(outputs('1990-06-08T06:00:00Z', 6380), {
    axis: 'guan_back_hexagram', clauseId: 6380, rangeLineBase: 6476, lineOffset: -96,
    status: 'unmatched', reason: 'not_in_catalog',
  });
  const belowCatalogue = outputs('1990-06-27T00:00:00Z', 969);
  assert.deepEqual([belowCatalogue.clauseId, belowCatalogue.status, belowCatalogue.reason], [969, 'unmatched', 'not_in_catalog']);
});

test('every native pillar pair is covered and each observed source can be queried in SQLite', () => {
  const file = historicalTiebanSource('bazi.json');
  const sources = new Map();
  for (const claim of JSON.parse(readFileSync(file, 'utf8'))) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') for (const number of selector.clauseIds) sources.set(number, claim);
  }
  // Independent reduction table for the ten legal pillar sums.
  const trigramNumber = [1, 2, 3, 4, 3, 6, 7, 8, 9, 8];
  const yangLines = [0, 1, 0, 1, 2, 0, 3, 2, 1, 2];
  const expectedBase = ([upperSum, lowerSum]) => {
    const upper = trigramNumber[upperSum - 9], lower = trigramNumber[lowerSum - 9];
    const yang = yangLines[upper] + yangLines[lower], yin = 6 - yang;
    return upper * 1000 + 15 * (yang * (yang + 1) + yin * (yin + 1)) - lower;
  };
  const months = Array.from({ length: 720 }, (_, index) =>
    Date.UTC(1924 + Math.floor(index / 12), index % 12, 15, 12));
  const hours = Array.from({ length: 720 }, (_, index) =>
    Date.UTC(1990, 5, 1 + Math.floor(index / 12), 2 * (index % 12)));
  const coordinates = [new Set(), new Set()], numbers = new Set();
  const eligible = new Set(), newlyObserved = new Set(), sqlite = new Set(), sqliteNew = new Set();
  for (const wall of [...months, ...hours]) for (const gender of ['男', '女']) {
    const query = birth(wall, gender);
    const chartPillars = pillars(query);
    coordinates[0].add(chartPillars.slice(0, 2).join(''));
    coordinates[1].add(chartPillars.slice(2).join(''));
    const raw = calculate(query), current = frontBack(raw);
    const bases = [expectedBase(raw.sums.slice(0, 2)), expectedBase(raw.sums.slice(2, 4))];
    assert.deepEqual(current.candidates.map(row => row.clauseId),
      [...[96, 192, 288, 384].map(value => bases[0] + value),
        ...[96, 192, 288, 384].map(value => bases[1] - value)]);
    const alternatives = [raw, ...raw.additionalCalculations.filter(row => row !== current)];
    const before = new Set(alternatives.flatMap(({ profile, candidates }) => candidates.flatMap(candidate => {
      const claim = sources.get(candidate.clauseId);
      return !candidate.requiresSelection && !tiebanMissReason(claim, gender, candidate.age)
        && !tiebanSourceTextConflicts(profile, candidate, claim) ? [claim.id] : [];
    })));
    const expected = [];
    for (const row of current.candidates) {
      numbers.add(row.clauseId);
      const claim = sources.get(row.clauseId);
      if (tiebanMissReason(claim, gender)) continue;
      expected.push(claim.id);
      eligible.add(claim.id);
      if (!before.has(claim.id)) newlyObserved.add(claim.id);
    }
    if (!expected.some(id => !sqlite.has(id) || !before.has(id) && !sqliteNew.has(id))) continue;
    const result = catalog.tiebanMatches(query.confirmedFacts, query.birthYear);
    const live = frontBack(result);
    assert.deepEqual(matched(live).map(row => row.claim.id), expected);
    const otherHits = new Set([result, ...result.additionalCalculations.filter(row => row !== live)]
      .flatMap(row => matched(row).filter(hit => !hit.requiresSelection).map(hit => hit.claim.id)));
    for (const id of expected) {
      sqlite.add(id);
      if (!otherHits.has(id)) sqliteNew.add(id);
    }
  }
  assert.deepEqual(coordinates.map(group => group.size), [720, 720]);
  assert.deepEqual([numbers.size, eligible.size, newlyObserved.size], [474, 143, 130]);
  assert.deepEqual(sqlite, eligible);
  assert.deepEqual(sqliteNew, newlyObserved);
});
