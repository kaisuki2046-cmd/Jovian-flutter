import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { chenDayLinesProfile, chenDayNajiaProfile, chenPillarLinesProfile, chenPillarNajiaProfile,
  tiebanBaseNumbers, tiebanMissReason, tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-pillars-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => rmSync(directory, { recursive: true, force: true }));
const read = name => JSON.parse(readFileSync(new URL('./claims/' + name + '.json', import.meta.url), 'utf8'));
const fixture = read('tieban-chen-pillars-witnesses');
const profiles = [chenPillarLinesProfile, chenPillarNajiaProfile, chenDayNajiaProfile];
const calculation = (tieban, profile) => tieban?.additionalCalculations.find(row => row.profile === profile);

function birth({ birthTime, gender }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3600000, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}
const pillarsOf = query => query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);
function parsed(query, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(input);
  return input;
}
const tiebanOf = references => references.find(row => row.tieban)?.tieban;

test('Methods 8 and 10 reproduce all eight printed numbers and preserve missing results in the report API', async () => {
  const query = birth({ birthTime: '1957-04-07T18:00:00Z', gender: '男' });
  assert.deepEqual(pillarsOf(query), ['丁酉', '甲辰', '庚戌', '丁丑']);
  const raw = tiebanBaseNumbers(query.confirmedFacts);
  assert.deepEqual(calculation(raw, chenPillarLinesProfile).candidates.map(({ clauseId, upper, lower, lineTotal }) =>
    [clauseId, upper, lower, lineTotal]), [[7474, '兑', '乾', 480], [6473, '乾', '兑', 480],
    [3356, '震', '巽', 360], [7388, '兑', '坤', 390]]);
  assert.deepEqual(calculation(raw, chenPillarNajiaProfile).candidates.map(({ clauseId, upperTotal, lowerTotal }) =>
    [clauseId, upperTotal, lowerTotal]), [[2648, 26, 48], [3926, 39, 26], [4539, 45, 39], [2642, 26, 42]]);

  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 35 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第十法月柱纳甲 3926/u);
      assert.match(materials, /陈氏第八至十一法分四柱取数/u);
      assert.doesNotMatch(materials, /陈氏第八法[年月日时]柱爻数/u);
      return '测试报告';
    },
  });
  for (const profile of profiles) {
    assert.equal(calculation(tieban, profile).libraryEdition, 'muxuan-json');
    assert.ok(calculation(tieban, profile).results.every(row => row.age === undefined));
  }
  assert.deepEqual(calculation(tieban, chenPillarLinesProfile).results.map(row => [row.clauseId, row.status, row.reason]),
    [7474, 6473, 3356, 7388].map(number => [number, 'unmatched', 'not_in_catalog']));
  assert.deepEqual(calculation(tieban, chenPillarNajiaProfile).results[1], {
    axis: 'chen_pillar_najia_month', clauseId: 3926, status: 'matched', claimId: 'tbss-v3-clauses-p03926-001',
  });
  assert.equal(tiebanOf(lookup(parsed(query, false).chartQueries)), undefined);
});

test('Method 11 reproduces the printed day base, chooses one direction, and checks the natal time layer and gender', () => {
  const birthTime = '1990-06-13T04:00:00Z';
  for (const [gender, axis, number, reason] of [
    ['男', 'chen_day_najia_next', 4644, 'scope_mismatch'],
    ['女', 'chen_day_najia_previous', 4452, 'not_in_catalog'],
  ]) {
    const query = birth({ birthTime, gender });
    assert.deepEqual(pillarsOf(query), ['庚午', '壬午', '己酉', '庚午']);
    const results = calculation(tiebanOf(lookup(parsed(query).chartQueries)), chenDayNajiaProfile).results;
    assert.deepEqual(results.map(({ axis, clauseId, status, reason }) => [axis, clauseId, status, reason]), [
      ['chen_day_najia_base', 4548, 'unmatched', 'not_in_catalog'], [axis, number, 'unmatched', reason],
    ]);
    assert.deepEqual([results[0].upperTotal, results[0].lowerTotal], [45, 48]);
  }
  const restricted = birth({ birthTime: '1934-06-15T04:00:00Z', gender: '男' });
  const match = calculation(tiebanOf(lookup(parsed(restricted).chartQueries)), chenPillarNajiaProfile).results[0];
  assert.deepEqual([match.clauseId, match.status, match.reason], [3939, 'unmatched', 'gender_mismatch']);
});

test('all legal pillars and both offset directions are covered, with a real SQLite and report witness for every eligible claim', () => {
  // Source tables transcribed as Later Heaven indexes and independent totals.
  const stemOrder = '甲乙丙丁戊己庚辛壬癸', branchOrder = '子丑寅卯辰巳午未申酉戌亥';
  const stemTrigram = [6, 2, 8, 7, 1, 9, 3, 4, 6, 2], branchTrigram = [1, 2, 3, 6, 7, 9, 9, 8, 8, 6, 4, 1];
  const outer = [null, 26, 33, 45, 39, null, 39, 26, 42, 45];
  const inner = [null, 26, 42, 45, 39, null, 48, 26, 42, 45];
  const yang = [null, 1, 0, 1, 2, null, 3, 2, 1, 2];
  const lineTotals = [630, 480, 390, 360, 390, 480, 630];
  const byGender = new Map();
  for (const gender of ['男', '女']) {
    const years = new Set(), dayDirections = [new Set(), new Set()];
    const numbers = new Map(profiles.map(profile => [profile, new Set()]));
    const instants = [
      ...Array.from({ length: 60 }, (_, index) => Date.UTC(1924 + index, 5, 15, 4)),
      ...[1990, 1991].flatMap(year => Array.from({ length: 60 }, (_, index) => Date.UTC(year, 5, index + 1, 4))),
    ];
    for (const instant of instants) {
      const query = birth({ birthTime: new Date(instant).toISOString(), gender });
      const pillars = pillarsOf(query);
      const forward = (stemOrder.indexOf(pillars[0][0]) % 2 === 0) === (gender === '男');
      years.add(pillars[0]);
      dayDirections[Number(forward)].add(pillars[2]);
      const trigrams = pillars.map(([stem, branch]) =>
        [stemTrigram[stemOrder.indexOf(stem)], branchTrigram[branchOrder.indexOf(branch)]]);
      const lineNumbers = trigrams.map(([upper, lower]) => upper * 1000 + lineTotals[yang[upper] + yang[lower]] - lower);
      const pairNumbers = trigrams.map(([upper, lower]) => outer[upper] * 100 + inner[lower]);
      const dayNumber = pairNumbers[2];
      const raw = tiebanBaseNumbers(query.confirmedFacts);
      for (const [index, expected] of [lineNumbers, pairNumbers, [dayNumber, dayNumber + (forward ? 96 : -96)]].entries()) {
        assert.deepEqual(calculation(raw, profiles[index]).candidates.map(row => row.clauseId), expected);
        for (const number of expected) numbers.get(profiles[index]).add(number);
      }
    }
    assert.equal(years.size, 60);
    assert.deepEqual(dayDirections.map(set => set.size), [60, 60]);
    byGender.set(gender, numbers);
  }
  const distinct = profiles.map(profile => new Set([...byGender.values()].flatMap(numbers => [...numbers.get(profile)])));
  assert.deepEqual(distinct.map(numbers => numbers.size), [44, 23, 69]);
  assert.equal(new Set(distinct.flatMap(numbers => [...numbers])).size, 113);
  const claims = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'));
  const expected = profiles.map(profile => new Set(claims.filter(claim => {
    const selector = tiebanSelector(claim);
    return selector?.libraryEdition === 'muxuan-json' && [...byGender].some(([gender, numbers]) =>
      !tiebanMissReason(claim, gender) && selector.clauseIds.some(number => numbers.get(profile).has(number)));
  }).map(claim => claim.id)));

  const hits = new Map(profiles.map(profile => [profile, new Set()]));
  for (const sample of fixture.witnesses) {
    const query = birth(sample);
    assert.deepEqual(pillarsOf(query), sample.pillars);
    const references = lookup(parsed(query).chartQueries);
    const materials = buildReportMaterials(references);
    const tieban = tiebanOf(references);
    for (const { profile, axis, clauseId, claimId } of sample.proofs) {
      const hit = calculation(tieban, profile).results.find(row => row.axis === axis && row.clauseId === clauseId);
      assert.equal(hit?.status, 'matched', claimId);
      assert.equal(hit.claim.id, claimId);
      assert.ok(materials.includes(hit.claim.evidence.original_text), claimId);
      assert.match(materials, new RegExp('陈氏第(?:八|十|十一)法[^\\n、]* ' + clauseId + '(?!\\d)', 'u'), claimId);
      hits.get(profile).add(claimId);
    }
  }
  assert.deepEqual([...hits.values()], expected);
  assert.deepEqual([...hits.values()].map(ids => ids.size), [13, 10, 22]);
  const hitIds = new Set([...hits.values()].flatMap(ids => [...ids]));
  assert.equal(hitIds.size, 35);

  const priorIds = new Set();
  for (const { profile, clauseId, claimId, ...sample } of fixture.priorWitnesses) {
    const query = { ...birth(sample), birthYear: new Date(sample.birthTime).getUTCFullYear() };
    const tieban = tiebanOf(lookup(parsed(query).chartQueries));
    const prior = [tieban, ...tieban.additionalCalculations].find(row => row.profile === profile);
    assert.ok(!profiles.includes(profile));
    assert.ok(prior.results.some(row => row.clauseId === clauseId && row.claim?.id === claimId), claimId);
    assert.ok(hitIds.has(claimId), claimId);
    priorIds.add(claimId);
  }
  assert.equal(priorIds.size, 11);
  assert.equal(hitIds.size - priorIds.size, 24);
});

test('Method 9 uses the corrected printed day base and reports four offsets in each direction', async () => {
  const query = birth({ birthTime: '1942-02-18T07:00:00Z', gender: '男' });
  assert.deepEqual(pillarsOf(query), ['壬午', '壬寅', '壬寅', '戊申']);
  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第九法日柱爻数加取号 6483（基数6387加96）/u);
      assert.match(materials, /陈氏第九法日柱爻数减取号 6195（基数6387减192）/u);
      assert.doesNotMatch(materials, /陈氏第九法日柱爻数[加减]取号 (?:6387|6487|6579|6675|6771|6291|6099|6003)/u);
      return '测试报告';
    },
  });
  const series = calculation(tieban, chenDayLinesProfile);
  assert.equal(series.libraryEdition, 'muxuan-json');
  assert.ok(series.results.every(row => row.age === undefined && row.dayLineBase === 6387));
  assert.deepEqual(series.results.map(({ axis, clauseId, lineOffset, status, claimId, reason }) =>
    [axis, clauseId, lineOffset, status, claimId ?? reason]), [
    ['chen_day_lines_plus', 6483, 96, 'matched', 'tbss-v6-clauses-p06483-001'],
    ['chen_day_lines_plus', 6579, 192, 'unmatched', 'not_in_catalog'],
    ['chen_day_lines_plus', 6675, 288, 'unmatched', 'not_in_catalog'],
    ['chen_day_lines_plus', 6771, 384, 'unmatched', 'scope_mismatch'],
    ['chen_day_lines_minus', 6291, -96, 'unmatched', 'not_in_catalog'],
    ['chen_day_lines_minus', 6195, -192, 'matched', 'tbss-v6-clauses-p06195-001'],
    ['chen_day_lines_minus', 6099, -288, 'unmatched', 'not_in_catalog'],
    ['chen_day_lines_minus', 6003, -384, 'unmatched', 'not_in_catalog'],
  ]);
});

test('Method 9 keeps short numbers and other-edition, other-time-layer and other-gender clauses unmatched', () => {
  const otherEdition = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8')).map(tiebanSelector).filter(selector => selector?.clauseIds.includes(7666));
  assert.deepEqual(otherEdition.map(selector => selector.libraryEdition), ['muxuan-fourteen-table-csv']);
  for (const [day, clauseId, reason] of [[1, 7666, 'not_in_catalog'], [2, 972, 'not_in_catalog'],
    [2, 1452, 'scope_mismatch'], [3, 9455, 'gender_mismatch']]) {
    const query = birth({ birthTime: new Date(Date.UTC(1990, 5, day, 4)).toISOString(), gender: '男' });
    const tieban = tiebanOf(lookup(parsed(query).chartQueries));
    const hit = calculation(tieban, chenDayLinesProfile).results.find(row => row.clauseId === clauseId);
    assert.equal(hit.status, 'unmatched');
    assert.equal(hit.reason, reason);
    assert.equal(hit.claim, undefined);
  }
});

test('Method 9 covers all legal day pillars, and every eligible claim reaches SQLite and the report', () => {
  const numbers = new Set(), days = new Set();
  const offsets = [96, 192, 288, 384, -96, -192, -288, -384];
  for (const gender of ['男', '女']) for (let day = 1; day <= 60; day++) {
    const query = birth({ birthTime: new Date(Date.UTC(1990, 5, day, 4)).toISOString(), gender });
    days.add(pillarsOf(query)[2]);
    const raw = tiebanBaseNumbers(query.confirmedFacts);
    const base = calculation(raw, chenPillarLinesProfile).candidates[2].clauseId;
    const series = calculation(raw, chenDayLinesProfile).candidates;
    assert.deepEqual(series.map(row => row.lineOffset), offsets);
    assert.deepEqual(series.map(row => row.clauseId), offsets.map(offset => base + offset));
    for (const row of series) numbers.add(row.clauseId);
  }
  assert.equal(days.size, 60);
  assert.equal(numbers.size, 352);
  const eligible = new Set(JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8')).filter(claim => {
    const selector = tiebanSelector(claim);
    return selector?.libraryEdition === 'muxuan-json' && selector.clauseIds.some(number => numbers.has(number))
      && ['男', '女'].some(gender => !tiebanMissReason(claim, gender));
  }).map(claim => claim.id));

  const dayLines = read('tieban-chen-day-lines-witnesses');
  const hitIds = new Set();
  for (const sample of dayLines.witnesses) {
    const query = birth(sample);
    assert.deepEqual(pillarsOf(query), sample.pillars);
    const references = lookup(parsed(query).chartQueries);
    const materials = buildReportMaterials(references);
    const results = calculation(tiebanOf(references), chenDayLinesProfile).results;
    for (const { axis, clauseId, claimId, lineOffset } of sample.proofs) {
      const hit = results.find(row => row.clauseId === clauseId);
      assert.equal(hit?.status, 'matched', claimId);
      assert.equal(hit.claim.id, claimId);
      assert.equal(hit.lineOffset, lineOffset);
      assert.equal(hit.axis, axis);
      const direction = lineOffset > 0 ? '加' : '减';
      assert.ok(materials.includes('陈氏第九法日柱爻数' + direction + '取号 ' + clauseId
        + '（基数' + hit.dayLineBase + direction + Math.abs(lineOffset) + '）'), claimId);
      assert.ok(materials.includes(hit.claim.evidence.original_text), claimId);
      hitIds.add(claimId);
    }
  }
  assert.deepEqual(hitIds, eligible);
  assert.equal(hitIds.size, 107);

  const olderIds = new Set();
  for (const { profile, clauseId, claimId, ...sample } of dayLines.priorWitnesses) {
    const query = { ...birth(sample), birthYear: new Date(sample.birthTime).getUTCFullYear() };
    const tieban = tiebanOf(lookup(parsed(query).chartQueries));
    const prior = [tieban, ...tieban.additionalCalculations].find(row => row.profile === profile);
    assert.notEqual(profile, chenDayLinesProfile);
    assert.ok(prior.results.some(row => row.clauseId === clauseId && row.claim?.id === claimId), claimId);
    assert.ok(hitIds.has(claimId), claimId);
    olderIds.add(claimId);
  }
  assert.equal(olderIds.size, 19);
  assert.equal(hitIds.size - olderIds.size, 88);
});
