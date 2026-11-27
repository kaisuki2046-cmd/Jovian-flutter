import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { chenStemSequenceProfile, tiebanBaseNumbers, tiebanMissReason, tiebanSelector } from './tieban.mjs';
import { reportTopics } from './topics.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-stem-sequence-'));
const catalog = historicalTiebanCatalog(directory);
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const sourceClaims = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8'));
const calculation = tieban => tieban?.additionalCalculations.find(row => row.profile === chenStemSequenceProfile);
const timeOffset = 8 * 3600000;

function birth(instant, gender) {
  const local = instant + timeOffset;
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
const figures = rows => rows.map(({ clauseId, status, reason }) => [clauseId, status, reason]);

test('Method 12 reproduces all 26 printed numbers without applying the example selection marks', async () => {
  const query = birth(Date.parse('1998-04-20T12:00:00Z'), '男');
  assert.deepEqual(pillarsOf(query), ['戊寅', '丙辰', '丁酉', '庚戌']);
  const { tieban } = await generateReport(parsed({ ...query, tiebanBookAnnualAge: 25 }), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.doesNotMatch(materials, /陈氏第十二法/u);
      return '测试报告';
    },
  });
  const { results, libraryEdition } = calculation(tieban);
  assert.deepEqual(results.slice(0, 2), [
    { axis: 'chen_stem_sequence_base', clauseId: 2743, status: 'unmatched', reason: 'not_in_catalog' },
    { axis: 'chen_stem_sequence_first_addition', clauseId: 2839, status: 'unmatched', reason: 'not_in_catalog' },
  ]);
  assert.deepEqual(results.map(result => result.clauseId), [
    2743, 2839, 2935, 3031, 3127, 3223, 3319, 3415, 3511, 3607, 3703, 3799, 3895, 3991,
    4087, 4183, 4279, 4375, 4471, 4567, 4663, 4759, 4855, 4951, 5047, 5143,
  ]);
  assert.ok(results.slice(2).every((result, index) => result.requiresSelection && result.additionStep === index + 2));
  assert.deepEqual(results.at(-1), {
    axis: 'chen_stem_sequence_further_addition', clauseId: 5143, status: 'unmatched', reason: 'not_in_catalog',
    additionStep: 25, requiresSelection: true,
  });
  assert.equal(libraryEdition, 'muxuan-json');
  assert.equal(lookup(parsed(query, false).chartQueries)[0].tieban, undefined);
});

test('decimal carry, zero stems and the edition, time-layer and sex checks reach the report output', async () => {
  const max = birth(Date.parse('1931-03-16T22:00:00Z'), '男');
  const { tieban } = await generateReport(parsed(max), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陈氏第十二法首个加96候选号 10095/u);
      assert.match(materials, /取用标记随例盘记录/u);
      assert.doesNotMatch(materials, /陈氏第十二法四柱基数 9999/u);
      assert.doesNotMatch(materials, /幼年丧父/u);
      return '测试报告';
    },
  });
  const { results } = calculation(tieban);
  assert.deepEqual(figures(results.slice(0, 2)), [
    [9999, 'unmatched', 'scope_mismatch'], [10095, 'matched', undefined],
  ]);
  assert.deepEqual(figures([results[2], results[4], results[7], results[25]]), [
    [10191, 'unmatched', 'scope_mismatch'], [10383, 'unmatched', 'gender_mismatch'],
    [10671, 'unmatched', 'not_in_catalog'], [12399, 'matched', undefined],
  ]);
  assert.deepEqual(results[25], {
    axis: 'chen_stem_sequence_further_addition', clauseId: 12399, status: 'matched', additionStep: 25,
    requiresSelection: true, claimId: 'tbss-v12-clauses-p12399-001',
  });

  const zero = birth(Date.parse('1933-11-12T18:00:00Z'), '男');
  assert.deepEqual(figures(calculation(lookup(parsed(zero).chartQueries)[0].tieban).results.slice(0, 2)), [
    [0, 'unmatched', 'not_in_catalog'], [96, 'unmatched', 'not_in_catalog'],
  ]);

  const editions = sourceClaims.map(tiebanSelector).filter(selector => selector?.clauseIds.includes(6360));
  assert.deepEqual(editions.map(row => row.libraryEdition), ['muxuan-fourteen-table-csv']);
  const otherEdition = birth(Date.parse('1924-01-09T22:00:00Z'), '男');
  const references = lookup(parsed(otherEdition).chartQueries);
  assert.deepEqual(figures(calculation(references[0].tieban).results.slice(0, 1)), [[6360, 'unmatched', 'not_in_catalog']]);
  assert.doesNotMatch(buildReportMaterials(references), /陈氏第十二法四柱基数 6360/u);

  const restricted = birth(Date.parse('1924-01-10T16:00:00Z'), '男');
  const restrictedResult = calculation(lookup(parsed(restricted).chartQueries)[0].tieban).results[1];
  assert.deepEqual([restrictedResult.clauseId, restrictedResult.status, restrictedResult.reason], [6906, 'unmatched', 'gender_mismatch']);
});

test('all 10,000 digit combinations and every eligible source reach the live versioned lookup', () => {
  const digits = { 甲: 1, 乙: 6, 丙: 2, 丁: 7, 戊: 3, 己: 8, 庚: 4, 辛: 9, 壬: 5, 癸: 0 };
  const instants = new Map();
  for (let year = 1924; year <= 1934; year++) for (let month = 0; month < 12; month++) {
    for (let day = 9; day <= 21; day++) for (let hour = 0; hour < 24; hour += 2) {
      const instant = Date.UTC(year, month, day, hour) - timeOffset;
      const query = birth(instant, '男');
      const [y, m, d, h] = pillarsOf(query).map(([stem]) => digits[stem]);
      const base = 1000 * m + 100 * d + 10 * h + y;
      if (instants.has(base)) continue;
      const raw = calculation(tiebanBaseNumbers(query.confirmedFacts, query.birthYear));
      for (const [step, candidate] of raw.candidates.entries()) {
        assert.equal(candidate.clauseId, base + 96 * step);
        if (step >= 2) assert.equal(candidate.additionStep, step);
      }
      instants.set(base, instant);
    }
  }
  assert.equal(instants.size, 10000);
  assert.ok([...instants.keys()].every(base => base >= 0 && base <= 9999));

  const indexed = new Map();
  for (const claim of sourceClaims) {
    const selector = tiebanSelector(claim);
    if (selector?.libraryEdition === 'muxuan-json') {
      for (const number of selector.clauseIds) indexed.set(number, claim);
    }
  }
  const expected = [new Set(), new Set()];
  const cases = [];
  for (const [base, instant] of instants) for (const gender of ['男', '女']) {
    const matches = [base, base + 96].flatMap((number, axis) => {
      const claim = indexed.get(number);
      if (tiebanMissReason(claim, gender)) return [];
      expected[axis].add(claim.id);
      return [{ axis, number, id: claim.id }];
    });
    if (matches.length) cases.push({ instant, gender, matches });
  }
  assert.deepEqual(expected.map(set => set.size), [2734, 2785]);
  const eligible = new Set([...expected[0], ...expected[1]]);
  assert.equal(eligible.size, 2785);
  const remaining = new Set(eligible);
  // A chart often proves two different source IDs with a single catalog query.
  cases.sort((a, b) => b.matches.length - a.matches.length);
  for (const { instant, gender, matches } of cases) {
    if (!matches.some(({ id }) => remaining.has(id))) continue;
    const query = birth(instant, gender);
    const tieban = catalog.tiebanMatches(query.confirmedFacts, query.birthYear);
    const reference = Object.entries(reportTopics).map(([topicId, topic]) =>
      ({ topic, personality: [], events: [], ...(topicId === 'overall' && { tieban }) }));
    const materials = buildReportMaterials(reference);
    for (const { axis, number, id } of matches) {
      const hit = calculation(tieban).results[axis];
      assert.equal(hit.status, 'matched', id);
      assert.equal(hit.clauseId, number, id);
      assert.equal(hit.claim.id, id);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      const label = axis === 0 ? '四柱基数' : '首个加96候选号';
      assert.match(materials, new RegExp('陈氏第十二法' + label + ' ' + number + '(?!\\d)', 'u'), id);
      remaining.delete(id);
    }
    if (!remaining.size) break;
  }
  assert.deepEqual([...remaining], []);

  const added = new Set();
  const extensionCases = [];
  for (const [base, instant] of instants) {
    if (base + 25 * 96 <= 10095) continue;
    for (const gender of ['男', '女']) {
      const matches = [];
      for (let step = 2; step <= 25; step++) {
        const number = base + 96 * step;
        if (number <= 10095) continue;
        const claim = indexed.get(number);
        if (tiebanMissReason(claim, gender) || eligible.has(claim.id)) continue;
        added.add(claim.id);
        matches.push({ step, number, id: claim.id });
      }
      if (matches.length) extensionCases.push({ instant, gender, matches });
    }
  }
  assert.equal(added.size, 1137);
  extensionCases.sort((a, b) => b.matches.length - a.matches.length);
  for (const { instant, gender, matches } of extensionCases) {
    if (!matches.some(({ id }) => added.has(id))) continue;
    const query = birth(instant, gender);
    const { results } = calculation(catalog.tiebanMatches(query.confirmedFacts, query.birthYear));
    for (const { step, number, id } of matches) {
      const hit = results[step];
      assert.equal(hit.status, 'matched', id);
      assert.equal(hit.clauseId, number, id);
      assert.equal(hit.claim.id, id);
      assert.equal(hit.requiresSelection, true, id);
      added.delete(id);
    }
    if (!added.size) break;
  }
  assert.deepEqual([...added], []);
});
