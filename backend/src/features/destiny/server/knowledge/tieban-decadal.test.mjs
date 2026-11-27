import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalTiebanLookup, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { tiebanBaseNumbers, tiebanDecadalProfile } from './tieban.mjs';

const sample = JSON.parse(readFileSync(new URL('./claims/tieban-decadal-witnesses.json', import.meta.url)));
const lookup = createHistoricalTiebanLookup();
const decadal = calculations => calculations.find(row => row.profile === tiebanDecadalProfile);
const hourMs = 3600000;

function birthQuery({ birthTime, gender }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * hourMs, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function queryReferences(example) {
  const input = parseInput({ timeKnown: true, chartQueries: [birthQuery(example)] });
  assert.ok(input);
  return lookup(input.chartQueries);
}

function summarized({ clauseId, decadalPeriod, status, claim, reason }) {
  return { clauseId, decadalPeriod, ...(status === 'matched' ? { claimId: claim.id } : { reason }) };
}

test('the witness list covers the full legal stem and branch space for this numbering formula', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  const cycle = Array.from({ length: 60 }, (_, index) => [stems[index % 10], branches[index % 12]]);
  const stemNumbers = { 甲: 4, 乙: 4, 丙: 6, 丁: 3, 戊: 3, 己: 4, 庚: 4, 辛: 6, 壬: 3, 癸: 3 };
  const branchNumbers = { 子: 1, 丑: 5, 寅: 3, 卯: 3, 辰: 5, 巳: 2, 午: 2, 未: 5, 申: 4, 酉: 4, 戌: 5, 亥: 1 };
  const numbers = { 1: new Set(), 2: new Set() };
  let combinations = 0;
  for (const [yearIndex, [year]] of cycle.entries()) {
    // 寅月 stems start at 丙 for 甲/己 years, then move two places per year stem.
    const tigerStem = (yearIndex % 5 * 2 + 2) % 10;
    const tigerMonth = cycle.findIndex(([stem, branch]) => stem === stems[tigerStem] && branch === '寅');
    for (let monthShift = 0; monthShift < 12; monthShift++) {
      const monthIndex = (tigerMonth + monthShift) % 60;
      const [month] = cycle[monthIndex];
      for (const [dayIndex, day] of [...stems].entries()) for (let hourBranch = 0; hourBranch < 12; hourBranch++) {
        const hour = stems[(2 * dayIndex + hourBranch) % 10];
        for (const genderCode of [1, 2]) {
          const forward = (yearIndex % 2 === 0) === (genderCode === 1);
          combinations++;
          for (let step = 1; step <= 10; step++) {
            const [stem, branch] = cycle[(60 + monthIndex + (forward ? step : -step)) % 60];
            const number = (stemNumbers[month] + stemNumbers[stem]) * 1000 + stemNumbers[day] * 100
              + stemNumbers[hour] * 10 + stemNumbers[year] + branchNumbers[branch];
            numbers[genderCode].add(number);
          }
        }
      }
    }
  }
  assert.equal(combinations, sample.chartCombinations);
  const anyGender = new Set([...numbers[1], ...numbers[2]]);
  assert.equal(anyGender.size, sample.potentialNumbers);
  const source = JSON.parse(readFileSync(historicalTiebanSource('bazi.json')));
  const eligible = source.filter(({ conditions }) => {
    const match = conditions.match;
    const selector = match?.selector;
    if (selector?.libraryEdition !== 'muxuan-json' || match.chartScope !== 'natal' || match.recordType !== 'general_rule'
      || selector.ages.length || conditions.excluded.length || conditions.uncertain.length
      || [...match.natalInputs, ...match.triggerInputs].some(input => Object.values(input).some(values => values.length))) return false;
    return selector.clauseIds.some(id => (numbers[selector.genderCode] ?? anyGender).has(id));
  });
  assert.deepEqual(new Set(sample.witnesses.map(row => row.claimId)), new Set(eligible.map(claim => claim.id)));
});

test('the book example preserves all confirmed periods, decimal carry and separate miss reasons', () => {
  const known = [
    ['乙酉', 8648], ['丙戌', 10649], ['丁亥', 7645], ['戊子', 7645], ['己丑', 8649],
    ['庚寅', 8647], ['辛卯', 10647], ['壬辰', 7649],
  ];
  for (const { pillars, results } of [sample.printed, sample.reverse]) {
    const example = results[0];
    const { confirmedFacts } = birthQuery(example);
    assert.deepEqual(confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), pillars);
    const run = decadal(queryReferences(example)[0].tieban.additionalCalculations);
    assert.equal(run.libraryEdition, 'muxuan-json');
    assert.deepEqual(run.results.map(summarized), results.map(({ birthTime, gender, ...rest }) => rest));
    if (example.gender === '男') {
      assert.deepEqual(run.results.slice(0, 8).map(row => [row.decadalPeriod.ganZhi, row.clauseId]), known);
      assert.equal(run.results[2].reason, 'not_in_catalog');
      assert.equal(run.results[5].reason, 'scope_mismatch');
    } else {
      assert.deepEqual(run.results[0].decadalPeriod, { ganZhi: '癸未', startAge: 12, endAge: 21, ageBasis: '虚岁' });
    }
  }
});

test('every reachable number-only JSON source has a native chart, SQLite result and report citation', () => {
  assert.equal(sample.chartCombinations, 172800);
  assert.equal(sample.potentialNumbers, 432);
  assert.equal(sample.priorReach, 143);
  assert.equal(sample.reached, 176);
  assert.equal(sample.additionalReach, 169);
  assert.equal(new Set(sample.witnesses.map(witness => witness.claimId)).size, sample.reached);
  assert.equal(sample.witnesses.filter(witness => !witness.previouslyReachable).length, sample.additionalReach);
  const charts = new Map();
  for (const witness of sample.witnesses) {
    const key = JSON.stringify([witness.birthTime, witness.gender]);
    if (!charts.has(key)) {
      const refs = queryReferences(witness);
      charts.set(key, {
        results: decadal(refs[0].tieban.additionalCalculations).results,
        materials: buildReportMaterials(refs),
      });
    }
    const { results, materials } = charts.get(key);
    const match = results.find(row => row.clauseId === witness.clauseId
      && row.decadalPeriod.ganZhi === witness.decadalPeriod.ganZhi);
    const { claimId, clauseId, decadalPeriod } = witness;
    assert.ok(match, claimId);
    assert.deepEqual(summarized(match), { claimId, clauseId, decadalPeriod }, claimId);
    assert.ok(materials.includes(`大运基数 ${clauseId}（${decadalPeriod.ganZhi}运，排盘${decadalPeriod.startAge}–${decadalPeriod.endAge}虚岁）`), claimId);
    assert.ok(materials.includes(match.claim.evidence.original_text), claimId);
  }
});

test('missing or inconsistent period facts never generate decade results', () => {
  const query = birthQuery(sample.printed.results[0]);
  const ranges = query.confirmedFacts.filter(fact => fact.kind === 'bazi_decadal_range');
  const other = query.confirmedFacts.filter(fact => fact.kind !== 'bazi_decadal_range');
  const numbers = facts => decadal(tiebanBaseNumbers(facts).additionalCalculations);
  assert.equal(numbers(other), undefined);
  const sparse = numbers([...other, ranges[5]]);
  assert.deepEqual(sparse.candidates.map(row => row.decadalPeriod.ganZhi), ['庚寅']);
  const shifted = { ...ranges[1], startAge: ranges[1].startAge + 1, endAge: ranges[1].endAge + 1 };
  assert.equal(numbers([...other, ranges[0], shifted]), undefined);
  const reversed = { ...ranges[0], ganZhi: sample.reverse.results[0].decadalPeriod.ganZhi };
  assert.equal(numbers([...other, reversed]), undefined);
  const unknown = parseInput({ timeKnown: false, chartQueries: [query] });
  assert.ok(lookup(unknown.chartQueries).every(row => !row.tieban));
});

test('report response retains the window for hits and misses, while materials omit unmatched and annual entries', async () => {
  const input = parseInput({ timeKnown: true, chartQueries: [birthQuery(sample.printed.results[0])] });
  const result = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /大运基数 8648（乙酉运，排盘1–10虚岁）/u);
      assert.match(materials, /所引 JSON 条文没有逐岁标注/u);
      assert.doesNotMatch(materials, /大运基数 (?:7645|8647|10649)/u);
      return '大运编号取材验证';
    },
  });
  assert.equal(result.report, '大运编号取材验证');
  const values = decadal(result.tieban.additionalCalculations).results;
  assert.deepEqual(values[2], { axis: 'decadal', clauseId: 7645, status: 'unmatched', reason: 'not_in_catalog',
    decadalPeriod: { ganZhi: '丁亥', startAge: 21, endAge: 30, ageBasis: '虚岁' } });
  assert.equal(values[5].reason, 'scope_mismatch');
  assert.equal(values[0].claimId, 'tbss-v8-clauses-p08648-001');
});
