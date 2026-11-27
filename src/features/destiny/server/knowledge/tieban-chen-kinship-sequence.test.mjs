import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { chenKinshipSequenceProfile, parseChenKinshipSequence } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-kinship-sequence-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const first = {
  series: 1,
  baseStep: 0,
  steps: [
    { offset: 1327, multiplier: 1 },
    { offset: 1327, multiplier: 1 },
    { offset: -1543, multiplier: 3, age: 35 },
    { offset: 133, multiplier: 4 },
    { offset: -97, multiplier: 7, age: 42 },
    { offset: 23, multiplier: 2 },
    { offset: -41, multiplier: 4, age: 50 },
  ],
};
const second = {
  series: 2,
  baseStep: 0,
  steps: [
    { offset: 1327, multiplier: 6, age: 7 },
    { offset: -1543, multiplier: 6 },
    { offset: 5017, multiplier: 1 },
    { offset: 133, multiplier: 4 },
    { offset: -97, multiplier: 20, age: 19 },
    { offset: 23, multiplier: 40, age: 21 },
    { offset: -41, multiplier: 64, age: 24 },
    { offset: -463, multiplier: 5, age: 31 },
    { offset: 1713, multiplier: 2, age: 35 },
    { offset: 1147, multiplier: 2, age: 37 },
    { offset: -2237, multiplier: 1, age: 39 },
  ],
};

const firstTime = '1956-02-11T20:20:00Z';
const secondTime = '1985-03-22T00:20:00Z';
const sequenceFor = tieban => tieban?.additionalCalculations.find(({ profile }) => profile === chenKinshipSequenceProfile);
const request = (query, timeKnown = true) => parseInput({ timeKnown, chartQueries: [query] });

function birth(time, selection, gender = '男') {
  const instant = Date.parse(time);
  const local = instant + 8 * 3_600_000;
  const chart = calculateBaZi(instant, local, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    birthYear: new Date(local).getUTCFullYear(),
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
    ...(selection && { tiebanChenKinshipSequence: selection }),
  };
}

function result(query, timeKnown = true) {
  return sequenceFor(lookup(request(query, timeKnown).chartQueries)[0].tieban);
}

test('both printed charts reproduce every cumulative step and check the exact SQLite edition and scope', () => {
  const witnesses = [
    [firstTime, first, 3784, ['丙申', '庚寅', '己酉', '丙寅'],
      [5111, 6438, 1809, 2341, 1662, 1708, 1544], [5111, 1809, 1544]],
    [secondTime, second, 3788, ['乙丑', '己卯', '庚申', '庚辰'],
      [11750, 2492, 7509, 8041, 6101, 7021, 4397, 2082, 5508, 7802, 5565], [6101, 5508, 7802]],
  ];
  const matchedIds = new Set();
  let annualMatches = 0;
  for (const [time, selection, base, pillars, numbers, missing] of witnesses) {
    const query = birth(time, selection);
    assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), pillars);
    const { libraryEdition, results } = result(query);
    assert.equal(libraryEdition, 'muxuan-json');
    assert.deepEqual(results.map(row => row.clauseId), numbers);
    for (const [index, row] of results.entries()) {
      const { offset, multiplier, age } = selection.steps[index];
      assert.deepEqual(row.kinshipSequence, { series: selection.series, baseStep: 0, baseClauseId: base,
        step: index + 1, previousClauseId: index ? numbers[index - 1] : base, offset, multiplier });
      assert.equal(row.age, age);
      assert.equal(row.requiresSelection, true);
      if (missing.includes(row.clauseId)) {
        assert.deepEqual([row.status, row.reason, row.claim], ['unmatched', 'not_in_catalog', undefined]);
      } else {
        assert.equal(row.status, 'matched');
        assert.equal(row.claim.conditions.match.selector.libraryEdition, libraryEdition);
        assert.equal(row.claim.conditions.match.chartScope, age === undefined ? 'natal' : 'annual');
        if (age !== undefined) {
          assert.ok(row.claim.conditions.match.selector.ages.includes(age));
          annualMatches++;
        }
        matchedIds.add(row.claim.id);
      }
    }
  }
  assert.equal(matchedIds.size, 12);
  assert.equal(annualMatches, 6);
});

test('the user must choose the table, base and ordered multipliers and must provide confirmed birth time', () => {
  const step = { offset: 1327, multiplier: 1 };
  for (const selection of [
    { ...first, series: '1' }, { ...first, baseStep: 7 }, { ...first, steps: [] },
    { ...first, steps: [{ ...step, multiplier: 1.5 }] }, { ...first, steps: [{ ...step, multiplier: 0 }] },
    { ...first, steps: [{ ...step, multiplier: Number.MAX_SAFE_INTEGER }] },
    { ...first, steps: [{ ...step, age: 0 }] }, { ...first, steps: [{ ...step, offset: -463 }] },
    { ...second, steps: [{ ...step, offset: 571 }] },
    { ...first, steps: [{ ...step, offset: -97 }, step] }, { ...first, clauseId: 3784 },
  ]) {
    assert.equal(parseChenKinshipSequence(selection), null);
    assert.equal(request(birth(firstTime, selection)), null);
  }
  const query = birth(firstTime, first);
  assert.equal(request({ ...query, chartScope: 'annual' }), null);
  assert.equal(request(query, false).chartQueries[0].tiebanChenKinshipSequence, undefined);
  assert.equal(result(query, false), undefined);
  assert.equal(result(birth(firstTime, first, '女')), undefined);
  assert.equal(result(birth(firstTime)), undefined);
  const { results } = result(birth(firstTime, { ...first, baseStep: 6, steps: [{ ...step, multiplier: 10 }] }));
  assert.deepEqual([results[0].kinshipSequence.baseClauseId, results[0].clauseId, results[0].reason],
    [11746, 25016, 'not_in_catalog']);
  const firstOnly = { ...first, steps: [{ offset: 571, multiplier: 1 }] };
  assert.equal(result(birth(firstTime, firstOnly)).results[0].clauseId, 4355);
});

test('a selected age is checked per step and report diagnostics do not feed the examples to the model', async () => {
  const edited = structuredClone(second);
  edited.steps[0].age = 8;
  delete edited.steps[5].age;
  const mismatched = result(birth(secondTime, edited)).results;
  assert.deepEqual([mismatched[0].clauseId, mismatched[0].reason], [11750, 'age_mismatch']);
  assert.deepEqual([mismatched[5].clauseId, mismatched[5].reason], [7021, 'scope_mismatch']);

  const normal = request(birth(secondTime)), selected = request(birth(secondTime, second));
  const baseline = buildReportMaterials(lookup(normal.chartQueries));
  assert.equal(buildReportMaterials(lookup(selected.chartQueries)), baseline);
  const report = await generateReport(selected, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.doesNotMatch(materials, /十岁欠三春/u);
      return '测试报告';
    },
  });
  assert.deepEqual(sequenceFor(report.tieban).results[0], {
    axis: 'chen_kinship_sequence', clauseId: 11750, age: 7, status: 'matched', requiresSelection: true,
    claimId: 'tbss-v11-clauses-p11750-001',
    kinshipSequence: { series: 2, baseStep: 0, baseClauseId: 3788, step: 1, previousClauseId: 3788, offset: 1327, multiplier: 6 },
  });
});
