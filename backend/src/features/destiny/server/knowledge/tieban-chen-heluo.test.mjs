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
import { chenHeluoLinesProfile, chenHeluoNajiaProfile, heluoProfile, tiebanBaseNumbers, tiebanMissReason,
  tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-heluo-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const claims = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'));
const profiles = [chenHeluoLinesProfile, chenHeluoNajiaProfile];
const calculation = (tieban, profile) => tieban?.additionalCalculations.find(row => row.profile === profile);
const newCalculations = tieban => tieban.additionalCalculations.filter(row => profiles.includes(row.profile));

function birth(instant, gender) {
  const local = instant + 8 * 3600000;
  const chart = calculateBaZi(instant, local, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
    birthYear: new Date(local).getUTCFullYear() };
}

function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}

test('Methods 1 and 2 reproduce the printed Heluo figures and use the checked arithmetic for the offset', async () => {
  const query = birth(Date.parse('1968-03-02T16:00:00Z'), '男');
  assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi),
    ['戊申', '甲寅', '壬申', '庚子']);
  const [lineNumbers, najiaNumbers] = newCalculations(tiebanBaseNumbers(query.confirmedFacts, query.birthYear));
  assert.deepEqual(lineNumbers.candidates.map(({ clauseId, upper, lower, lineTotal, yuanTangLine }) =>
    [clauseId, upper, lower, lineTotal, yuanTangLine]), [
    [1356, '坎', '巽', 360, undefined], [1452, '坎', '巽', 360, undefined],
    [8389, '艮', '坎', 390, 2], [8293, '艮', '坎', 390, 2],
  ]);
  assert.deepEqual(najiaNumbers.candidates.map(({ clauseId, upperTotal, lowerTotal }) =>
    [clauseId, upperTotal, lowerTotal]), [[2639, 26, 39], [2735, 26, 39], [2543, 26, 39],
    [4226, 42, 26], [4322, 42, 26], [4130, 42, 26]]);

  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第二法先天卦纳甲 2639/u);
      assert.match(materials, /陈氏第二法先天卦纳甲减取号 2543/u);
      assert.match(materials, /河洛爻数和纳甲编号按已确认的元堂化后天卦计算/u);
      assert.doesNotMatch(materials, /陈氏第一法|陈氏第二法后天卦|陈氏第二法先天卦纳甲加取号 2735/u);
      return '测试报告';
    },
  });
  const [lineResults, najiaResults] = newCalculations(tieban);
  assert.ok([lineResults, najiaResults].every(row => row.libraryEdition === 'muxuan-json'
    && row.results.every(result => result.age === undefined)));
  assert.deepEqual(lineResults.results.map(({ status, reason, yuanTangLine }) => [status, reason, yuanTangLine]), [
    ['unmatched', 'not_in_catalog', undefined], ['unmatched', 'scope_mismatch', undefined],
    ['unmatched', 'not_in_catalog', 2], ['unmatched', 'scope_mismatch', 2],
  ]);
  assert.deepEqual(najiaResults.results.map(({ clauseId, status, claimId, reason }) => [clauseId, status, claimId ?? reason]), [
    [2639, 'matched', 'tbss-v2-clauses-p02639-001'], [2735, 'unmatched', 'not_in_catalog'],
    [2543, 'matched', 'tbss-v2-clauses-p02543-001'], [4226, 'unmatched', 'not_in_catalog'],
    [4322, 'unmatched', 'not_in_catalog'], [4130, 'unmatched', 'scope_mismatch'],
  ]);
  assert.equal(lookup(parsed(query, false).chartQueries)[0].tieban, undefined);
});

test('other-edition clauses and unconfirmed transformation inputs do not reach the report', () => {
  const otherEdition = claims.map(tiebanSelector).filter(selector => selector?.clauseIds.includes(6380));
  assert.deepEqual(otherEdition.map(selector => selector.libraryEdition), ['muxuan-fourteen-table-csv']);
  const chart = birth(Date.parse('1900-02-08T05:00:00Z'), '男');
  const references = lookup(parsed(chart).chartQueries);
  const hit = calculation(references[0].tieban, chenHeluoLinesProfile).results.find(row => row.clauseId === 6380);
  assert.deepEqual([hit.status, hit.reason, hit.claim], ['unmatched', 'not_in_catalog', undefined]);
  assert.doesNotMatch(buildReportMaterials(references), /陈氏第一法后天卦爻数减取号 6380/u);

  const restricted = birth(Date.parse('1900-01-01T00:00:00Z'), '女');
  const restrictedResults = calculation(lookup(parsed(restricted).chartQueries)[0].tieban, chenHeluoNajiaProfile).results;
  assert.equal(restrictedResults.find(row => row.clauseId === 3348)?.reason, 'gender_mismatch');

  const partial = birth(Date.parse('1900-03-15T10:00:00Z'), '男');
  const partialTieban = lookup(parsed(partial).chartQueries)[0].tieban;
  assert.deepEqual(newCalculations(partialTieban).map(row => [row.status, row.reason, row.results.length]),
    [['partial', 'yuantang_unconfirmed', 2], ['partial', 'yuantang_unconfirmed', 3]]);
  assert.ok(newCalculations(partialTieban).every(row => row.results.every(result => result.axis.includes('_earlier'))));

  const { center: [center] } = JSON.parse(readFileSync(new URL('./claims/tieban-heluo-witnesses.json', import.meta.url), 'utf8'));
  const centered = birth(Date.parse(center.birthTime), center.gender);
  assert.equal(newCalculations(tiebanBaseNumbers(centered.confirmedFacts, center.birthYear)).length, 2);
  assert.equal(newCalculations(tiebanBaseNumbers(centered.confirmedFacts)).length, 0);
  assert.equal(newCalculations(tiebanBaseNumbers(centered.confirmedFacts, 1985)).length, 0);
});

test('native charts verify both algorithms and each covered source record reaches SQLite and report materials', () => {
  const order = ' 坎坤震巽 乾兑艮离';
  const outer = [null, 26, 33, 45, 39, null, 39, 26, 42, 45];
  const inner = [null, 26, 42, 45, 39, null, 48, 26, 42, 45];
  const yang = [null, 1, 0, 1, 2, null, 3, 2, 1, 2];
  const lineTotals = [630, 480, 390, 360, 390, 480, 630];
  const jsonClauses = new Map();
  for (const claim of claims) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') {
      for (const clauseId of selector.clauseIds) jsonClauses.set(clauseId, claim);
    }
  }
  const numbers = profiles.map(() => new Set());
  const covered = profiles.map(() => new Set());
  const pairs = [new Set(), new Set()];
  const witnesses = new Map();
  for (let year = 1900; year < 2020; year++) for (let month = 0; month < 12; month++) {
    const index = (year - 1900) * 12 + month;
    const instant = Date.UTC(year, month, 1 + (7 * index + 11 * (year - 1900)) % 28,
      (5 * index + 7 * (year - 1900)) % 24);
    for (const gender of ['男', '女']) {
      const query = birth(instant, gender);
      const raw = tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
      const heluo = calculation(raw, heluoProfile);
      const newResults = newCalculations(raw);
      if (!heluo) {
        assert.deepEqual(newResults, []);
        continue;
      }
      const expected = [[], []];
      for (const [stage, { upper, lower }] of heluo.candidates.entries()) {
        pairs[stage].add(upper + lower);
        const u = order.indexOf(upper), l = order.indexOf(lower);
        const line = 1000 * u + lineTotals[yang[u] + yang[l]] - l;
        const najia = 100 * outer[u] + inner[l];
        expected[0].push(line, line + (stage === 0 ? 96 : -96));
        expected[1].push(najia, najia + 96, najia - 96);
      }
      assert.deepEqual(newResults.map(row => row.candidates.map(candidate => candidate.clauseId)), expected);
      const previous = new Set([raw, ...raw.additionalCalculations.filter(row => !profiles.includes(row.profile))]
        .filter(row => row.libraryEdition === 'muxuan-json')
        .flatMap(row => row.candidates.filter(candidate => candidate.age === undefined).map(candidate => candidate.clauseId)));
      for (const [method, { candidates }] of newResults.entries()) {
        for (const { axis, clauseId } of candidates) {
          numbers[method].add(clauseId);
          const claim = jsonClauses.get(clauseId);
          if (tiebanMissReason(claim, gender)) continue;
          covered[method].add(claim.id);
          if (!witnesses.has(claim.id) && !tiebanSelector(claim).clauseIds.some(id => previous.has(id))) {
            witnesses.set(claim.id, { query, method, axis, clauseId });
          }
        }
      }
    }
  }
  assert.deepEqual(pairs.map(set => set.size), [60, 64]);
  assert.deepEqual(numbers.map(set => set.size), [178, 75]);
  assert.deepEqual(covered.map(set => set.size), [50, 24]);
  assert.deepEqual(new Set(witnesses.keys()), new Set(covered.flatMap(set => [...set])));
  const seen = new Set();
  for (const [id, { query, method, axis, clauseId }] of witnesses) {
    const references = lookup(parsed(query).chartQueries);
    const { tieban } = references[0];
    const hit = calculation(tieban, profiles[method]).results.find(row => row.axis === axis);
    assert.equal(hit.status, 'matched', id);
    assert.equal(hit.clauseId, clauseId, id);
    assert.equal(hit.claim.id, id);
    const previous = [tieban, ...tieban.additionalCalculations.filter(row => !profiles.includes(row.profile))];
    assert.ok(previous.every(row => row.results.every(result => result.claim?.id !== id)), id);
    const materials = buildReportMaterials(references);
    assert.ok(materials.includes(hit.claim.evidence.original_text), id);
    assert.match(materials, new RegExp('陈氏第' + (method === 0 ? '一' : '二') + '法[^、\\n]+ ' + clauseId + '(?!\\d)', 'u'), id);
    seen.add(id);
  }
  assert.equal(seen.size, 74);
});
