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
import { chenDayLinesProfile, chenDayNajiaProfile, chenHuangjiStemProfile, dayHexagramProfile, huangjiProfile,
  tiebanBaseNumbers, tiebanMissReason, tiebanSelector, tianyuanYearProfile } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-huangji-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});
const claims = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'));
const axes = ['base', 'month', 'day', 'hour', 'day_hour'];
const calculation = tieban => tieban?.additionalCalculations.find(row => row.profile === chenHuangjiStemProfile);
const rareCases = [
  ['1924-03-22T16:00:00Z', '男'],
  ['1924-06-08T18:00:00Z', '女'],
  ['1925-06-07T22:00:00Z', '男'],
  ['1926-05-08T20:00:00Z', '男'],
  ['1927-02-27T22:00:00Z', '男'],
  ['1927-03-10T22:00:00Z', '男'],
  ['1928-05-17T02:00:00Z', '男'],
  ['1928-05-28T02:00:00Z', '男'],
  ['1929-03-06T04:00:00Z', '男'],
  ['1929-03-07T00:00:00Z', '男'],
  ['1934-03-28T22:00:00Z', '男'],
  ['1935-02-06T22:00:00Z', '男'],
  ['1942-03-07T00:00:00Z', '男'],
  ['1947-03-21T18:00:00Z', '男'],
  ['1947-06-06T14:00:00Z', '男'],
  ['1948-12-09T16:00:00Z', '男'],
  ['1950-02-07T22:00:00Z', '男'],
  ['1950-11-08T16:00:00Z', '男'],
];

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

const pillarsOf = query => query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);

function natalNumberBounds() {
  const numbers = new Set();
  const positionProfiles = new Set([huangjiProfile, dayHexagramProfile, tianyuanYearProfile, chenDayLinesProfile, chenDayNajiaProfile]);
  const yearMonths = Array.from({ length: 720 }, (_, index) => Date.UTC(1924 + Math.floor(index / 12), index % 12, 15, 12));
  const dayHours = Array.from({ length: 720 }, (_, index) => Date.UTC(1990, 5, 1 + Math.floor(index / 12), 2 * (index % 12)));
  const pillarPairs = [new Set(), new Set()];
  // These calculations factor by year/month or day/hour. Both genders cover both day-Najia directions.
  for (const [index, times] of [yearMonths, dayHours].entries()) {
    const firstPillar = 2 * index;
    const pairs = pillarPairs[index];
    for (const wallTime of times) for (const gender of ['男', '女']) {
      const query = birth(wallTime - 8 * 3600000, gender);
      pairs.add(pillarsOf(query).slice(firstPillar, firstPillar + 2).join(''));
      for (const row of tiebanBaseNumbers(query.confirmedFacts, query.birthYear).additionalCalculations) {
        if (positionProfiles.has(row.profile)) for (const { clauseId } of row.candidates) numbers.add(clauseId);
      }
    }
    assert.equal(pairs.size, 720);
  }

  // All 64 ordered pairs bound the prior trigram methods, including their
  // transformed and mutual hexagrams, and the pillar line/Najia methods.
  const hex = { 乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000' };
  const names = new Map(Object.entries(hex).map(([name, bits]) => [bits, name]));
  const earlier = ' 乾兑离震巽坎艮坤', later = ' 坎坤震巽 乾兑艮离';
  const outer = [0, 26, 33, 45, 39, 0, 39, 26, 42, 45], inner = [0, 26, 42, 45, 39, 0, 48, 26, 42, 45];
  const totals = [630, 480, 390, 360, 390, 480, 630];
  for (const upper of Object.keys(hex)) for (const lower of Object.keys(hex)) {
    const bits = hex[lower] + hex[upper];
    for (const order of [earlier, later]) {
      const u = order.indexOf(upper);
      const mutualUpper = order.indexOf(names.get(bits.slice(2, 5))), mutualLower = order.indexOf(names.get(bits.slice(1, 4)));
      numbers.add(((u + 6) % 10 || 1) * 1000 + 100 * u + 10 * mutualUpper + mutualLower);
    }
    const u = later.indexOf(upper), l = later.indexOf(lower);
    const line = 1000 * u + totals[bits.replaceAll('0', '').length] - l;
    const najia = 100 * outer[u] + inner[l];
    for (const shift of [-96, 0, 96]) {
      numbers.add(line + shift);
      numbers.add(najia + shift);
    }
  }

  // Bound both prior decadal variants by allowing even combinations that
  // cannot appear together. Annual numbers and the CSV edition cannot reach these natal JSON IDs.
  const stems = [3, 4, 6];
  for (const monthAndLuck of [6, 7, 8, 9, 10, 12]) for (const day of stems) for (const hour of stems) for (const year of stems) {
    for (let branch = 1; branch <= 10; branch++) numbers.add(1000 * monthAndLuck + 100 * day + 10 * hour + year + branch);
  }
  return { numbers, pillarPairs };
}

function* scanBirthInputs() {
  for (let year = 1900; year < 2020; year++) for (let month = 0; month < 12; month++) for (let step = 0; step < 3; step++) {
    const monthIndex = 12 * (year - 1900) + month;
    const instant = Date.UTC(year, month, 1 + (7 * monthIndex + 11 * (year - 1900) + step * 9) % 28,
      (5 * monthIndex + 7 * (year - 1900) + step * 5) % 24);
    for (const gender of ['男', '女']) yield [instant, gender];
  }
  for (const [time, gender] of rareCases) yield [Date.parse(time), gender];
}

test('Method 4(1) reproduces all ten printed figures and keeps unmatched numbers in the API', async () => {
  const query = birth(Date.parse('1865-04-08T20:00:00Z'), '男');
  assert.deepEqual(pillarsOf(query), ['乙丑', '庚辰', '己酉', '丙寅']);
  const raw = tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
  assert.deepEqual(raw.additionalCalculations.find(row => row.profile === huangjiProfile).candidates.map(row => row.clauseId),
    [1613, 5141]);
  const printed = [9613, 10413, 9703, 9620, 9710, 13141, 13941, 13231, 13148, 13238];
  assert.deepEqual(calculation(raw).candidates.map(row => row.clauseId), printed);
  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第四法元会加年干 9613/u);
      assert.match(materials, /陈氏第四法元会加年日干 9703/u);
      assert.match(materials, /元会、运世的天干加数按未考刻的四柱算式取号/u);
      assert.doesNotMatch(materials, /陈氏第四法[^、\n]* (?:10413|9620|9710|13141|13941|13231|13148|13238)(?!\d)/u);
      return '测试报告';
    },
  });
  const results = calculation(tieban);
  assert.equal(results.libraryEdition, 'muxuan-json');
  assert.ok(results.results.every(row => row.age === undefined));
  assert.deepEqual(results.results.map(row => row.clauseId), printed);
  assert.deepEqual(results.results.map(row => row.claimId ?? row.reason), [
    'tbss-v9-clauses-p09613-001', 'gender_mismatch', 'tbss-v9-clauses-p09703-001',
    'scope_mismatch', 'not_in_catalog', ...Array(5).fill('not_in_catalog'),
  ]);
  assert.equal(lookup(parsed(query, false).chartQueries)[0].tieban, undefined);
});

test('Method 4(1) does not substitute a same-number clause from the consultation edition', () => {
  const otherEdition = claims.map(tiebanSelector).filter(selector => selector?.clauseIds.includes(10316));
  assert.deepEqual(otherEdition.map(selector => selector.libraryEdition), ['muxuan-fourteen-table-csv']);
  const query = birth(Date.parse('1900-01-01T00:00:00Z'), '男');
  const references = lookup(parsed(query).chartQueries);
  const hit = calculation(references[0].tieban).results[0];
  assert.deepEqual([hit.clauseId, hit.status, hit.reason, hit.claim], [10316, 'unmatched', 'not_in_catalog', undefined]);
  assert.doesNotMatch(buildReportMaterials(references), /陈氏第四法元会加年干 10316/u);
});

test('all source IDs in the legal Method 4(1) number space reach SQLite and reports in native charts', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  const stemValues = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];
  const branchValues = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
  const stemValue = ([stem]) => stemValues[stems.indexOf(stem)];
  const pillarValue = pillar => stemValue(pillar) + branchValues[branches.indexOf(pillar[1])];
  const reverse = number => Number([...String(number)].reverse().join(''));
  const index = new Map();
  for (const claim of claims) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') {
      for (const number of selector.clauseIds) index.set(number, claim);
    }
  }
  const { numbers: priorBounds, pillarPairs } = natalNumberBounds();
  const [yearMonths, dayHours] = pillarPairs.map(pairs => [...pairs].map(pair => [pair.slice(0, 2), pair.slice(2)]));
  const possible = [new Set(), new Set()];
  // The full product bounds reach even where a pillar pairing cannot occur
  // on a civil date. Real births below prove each eligible ID.
  const dayHourNumbers = dayHours.map(([day, hour]) =>
    [100 * reverse(pillarValue(day)) + reverse(pillarValue(hour)), 10 * stemValue(day), stemValue(hour)]);
  for (const [year, month] of yearMonths) {
    const yearOffset = 1000 * stemValue(year), monthOffset = 100 * stemValue(month);
    const yuan = 100 * pillarValue(year) + pillarValue(month) + yearOffset;
    for (const [yun, day, hour] of dayHourNumbers) {
      for (const offset of [0, monthOffset, day, hour, day + hour]) {
        possible[0].add(yuan + offset);
        possible[1].add(yun + yearOffset + offset);
      }
    }
  }
  const possibleIds = new Set();
  for (const set of possible) for (const number of set) {
    const claim = index.get(number);
    if (['男', '女'].some(gender => !tiebanMissReason(claim, gender))) possibleIds.add(claim.id);
  }
  const numbers = [new Set(), new Set()];
  const eligible = new Set(), outsidePriorBounds = new Set(), samples = [];
  for (const [instant, gender] of scanBirthInputs()) {
    const query = birth(instant, gender);
    const pillars = pillarsOf(query);
    const [y, m, d, h] = pillars.map(stemValue);
    const [yearSum, monthSum, daySum, hourSum] = pillars.map(pillarValue);
    const yearOffset = 1000 * y;
    const bases = [100 * yearSum + monthSum, 100 * reverse(daySum) + reverse(hourSum)];
    const raw = tiebanBaseNumbers(query.confirmedFacts, query.birthYear);
    const actual = calculation(raw).candidates;
    const proofs = new Map();
    for (const [group, base] of bases.entries()) {
      const expected = [0, 100 * m, 10 * d, h, 10 * d + h].map(value => base + yearOffset + value);
      const form = group === 0 ? 'yuan_hui' : 'yun_shi';
      const rows = actual.slice(5 * group, 5 * (group + 1));
      assert.deepEqual(rows, expected.map((clauseId, column) => ({ axis: 'chen_huangji_' + form + '_' + axes[column], clauseId })));
      for (const { axis, clauseId } of rows) {
        numbers[group].add(clauseId);
        const claim = index.get(clauseId);
        if (tiebanMissReason(claim, gender)) continue;
        const aliases = tiebanSelector(claim).clauseIds;
        if (!aliases.some(id => priorBounds.has(id))) outsidePriorBounds.add(claim.id);
        eligible.add(claim.id);
        proofs.set(claim.id, { axis, clauseId });
      }
    }
    if (proofs.size) samples.push({ query, proofs });
  }
  assert.deepEqual(possible.map(set => set.size), [2231, 1825]);
  assert.deepEqual(numbers.map(set => set.size), [2203, 1716]);
  assert.deepEqual(eligible, possibleIds);
  assert.equal(eligible.size, 1272);
  assert.equal(priorBounds.size, 1714);
  assert.equal(outsidePriorBounds.size, 1071);

  // Cover several IDs with one report lookup.
  const remaining = new Set(eligible);
  while (remaining.size) {
    let best, bestCount = 0;
    for (const sample of samples) {
      let count = 0;
      for (const id of sample.proofs.keys()) if (remaining.has(id)) count++;
      if (count > bestCount) { best = sample; bestCount = count; }
    }
    assert.ok(best, 'missing native witness for one or more eligible sources');
    const references = lookup(parsed(best.query).chartQueries);
    const { tieban } = references[0];
    const materials = buildReportMaterials(references);
    for (const [id, { axis, clauseId }] of best.proofs) {
      if (!remaining.has(id)) continue;
      const hit = calculation(tieban).results.find(row => row.axis === axis);
      assert.equal(hit?.status, 'matched', id);
      assert.equal(hit.clauseId, clauseId, id);
      assert.equal(hit.claim.id, id);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      assert.match(materials, new RegExp('陈氏第四法[^、\\n]+ ' + clauseId + '(?!\\d)', 'u'), id);
      remaining.delete(id);
    }
  }
});
