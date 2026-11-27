import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { tiebanKunjiParentSeriesProfile, tiebanKunjiProfile } from './tieban-kunji.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-kunji-kinship-'));
const catalog = historicalTiebanCatalog(directory);
const lookup = createHistoricalTiebanLookup(directory);
const current = tieban => tieban?.additionalCalculations.find(({ profile }) => profile === tiebanKunjiProfile);
const parentSeries = tieban => tieban?.additionalCalculations.find(({ profile }) => profile === tiebanKunjiParentSeriesProfile);
const slot = (calculation, table) => calculation.results.find(({ kinshipFact }) => kinshipFact.table === table);

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function birth(year, gender) {
  const local = Date.UTC(year, 5, 15, 10);
  const chart = calculateBaZi(local - 8 * 3_600_000, local, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, birthYear: year,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}

const runTieban = (query, kunjiFacts) => catalog.tiebanMatches(query.confirmedFacts, query.birthYear,
  undefined, undefined, undefined, undefined, kunjiFacts);
const trial = (query, kunjiFacts) => current(runTieban(query, kunjiFacts));

test('the supplied tables reproduce corrected numbers and exact same-edition misses', () => {
  const query = birth(1984, '男');
  const calc = trial(query, {
    fatherBranch: '卯', motherBranch: '卯', sonBranches: ['亥'],
    daughterBranches: ['丑', '丑'], brotherCount: 1, teacherPillar: '甲子',
    marriages: [{ order: 1, pillar: '乙酉' }, { order: 3, pillar: '甲申' }],
  });
  assert.equal(calc.libraryEdition, 'muxuan-json');
  assert.deepEqual(calc.results.map(({ kinshipFact, clauseId, status, reason }) =>
    [kinshipFact.table, clauseId, status, reason]), [
    ['father', 9163, 'matched', undefined],
    ['mother', 9755, 'matched', undefined],
    ['same_parents', 9384, 'matched', undefined],
    ['son', 12233, 'matched', undefined],
    ['daughter', 12253, 'matched', undefined],
    ['brothers', 9863, 'unmatched', 'not_in_catalog'],
    ['teacher', 11045, 'unmatched', 'not_in_catalog'],
    ['wife', 10217, 'unmatched', 'source_text_mismatch'],
    ['third_wife', 10702, 'matched', undefined],
  ]);
  assert.equal(slot(calc, 'father').claim.id, 'tbss-v9-clauses-p09163-001');
  assert.equal(slot(calc, 'wife').claim, undefined);

  const female = birth(1984, '女');
  const cases = [
    ['乙丑', 12456, 'matched', undefined],
    ['丙子', 12406, 'matched', undefined],
    ['甲子', 12396, 'unmatched', 'source_text_mismatch'],
    ['戊午', 12726, 'unmatched', 'gender_mismatch'],
    ['癸亥', 12996, 'matched', undefined],
  ];
  for (const [pillar, number, status, reason] of cases) {
    const result = trial(female, { marriages: [{ order: 2, pillar }, { order: 4, pillar: '辛酉' }] });
    assert.deepEqual([result.status, result.reason], ['partial', 'kinship_table_unavailable']);
    assert.deepEqual(result.results.map(({ clauseId, status, reason }) => [clauseId, status, reason]), [[number, status, reason]]);
  }
  const mother = trial(query, { motherBranch: '亥' });
  assert.equal(mother.results[0].clauseId, 10175);
  assert.equal(mother.results[0].status, 'matched');
});

test('the opt-in input is validated and requires confirmed natal data', () => {
  const query = birth(1984, '男');
  const input = tiebanKunjiFacts => parseInput({ timeKnown: true, chartQueries: [{ ...query, tiebanKunjiFacts }] });
  const correct = { fatherBranch: '子', marriages: [{ order: 1, pillar: '甲子' }] };
  assert.deepEqual(input(correct).chartQueries[0].tiebanKunjiFacts, correct);
  for (const invalid of [null, {}, { fatherBranch: '虎' }, { fatherBranch: '' }, { brotherCount: 13 },
    { sonBranches: [] }, { teacherPillar: '甲丑' }, { clauseId: 9003 },
    { marriages: [{ order: 1, pillar: '甲子' }, { order: 1, pillar: '丙子' }] },
    { marriages: [{ order: 1, pillar: '甲子', ignored: true }] }]) assert.equal(input(invalid), null);
  assert.equal(parseInput({ timeKnown: true, chartQueries: [{ ...query, chartScope: 'annual', tiebanKunjiFacts: correct }] }), null);
  const unknown = parseInput({ timeKnown: false, chartQueries: [{ ...query, tiebanKunjiFacts: correct }] });
  assert.equal(unknown.chartQueries[0].tiebanKunjiFacts, undefined);
  assert.equal(lookup(unknown.chartQueries)[0].tieban, undefined);
  assert.equal(trial({ ...query, confirmedFacts: [...query.confirmedFacts, { kind: 'natal_gender', gender: '女' }] }, correct), undefined);
  assert.equal(trial(query, undefined), undefined);
});

test('the report exposes the check result while keeping confirmed relatives out of model materials', async () => {
  const query = birth(1984, '男');
  const input = tiebanKunjiFacts => parseInput({ timeKnown: true, chartQueries: [{ ...query, tiebanKunjiFacts }] });
  let baseline;
  const signal = new AbortController().signal;
  const plain = await generateReport(input(undefined), { lookup, signal, complete: async payload => {
    baseline = payload;
    return '验证报告';
  } });
  assert.equal(current(plain.tieban), undefined);
  const result = await generateReport(input({
    fatherBranch: '卯', brotherCount: 1, marriages: [{ order: 1, pillar: '甲子' }],
  }), { lookup, signal, complete: async payload => {
    assert.deepEqual(payload, baseline);
    return '验证报告';
  } });
  assert.deepEqual(slot(current(result.tieban), 'father'), {
    axis: 'kunji_known_kinship', clauseId: 9163, status: 'matched', requiresSelection: true,
    kinshipFact: { table: 'father', key: '卯' }, claimId: 'tbss-v9-clauses-p09163-001',
  });
  assert.deepEqual(parentSeries(result.tieban).results[0], {
    axis: 'kunji_parent_series', clauseId: 9259, status: 'unmatched', reason: 'not_in_catalog', requiresSelection: true,
    parentSeries: { table: 'father', key: '卯', baseClauseId: 9163, step: 1 },
  });
  const sameCouple = slot(current(result.tieban), 'same_couple');
  assert.equal(sameCouple.clauseId, 11003);
  assert.equal(sameCouple.status, 'matched');
  const unrelated = trial(query, { marriages: [{ order: 1, pillar: '丙子' }] });
  assert.equal(slot(unrelated, 'same_couple'), undefined);
});

test('all fifteen tables can be queried through SQLite from a complete sexagenary cycle', () => {
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  const slots = new Map(), sourceIds = new Set();
  for (let year = 1984; year < 2044; year += 1) {
    for (const gender of ['男', '女']) {
      const query = birth(year, gender);
      const pillar = query.confirmedFacts.find(fact => fact.kind === 'pillar' && fact.position === 'year').ganZhi;
      const branch = pillar[1];
      const calc = trial(query, {
        fatherBranch: branch, motherBranch: branch, sonBranches: [branch], daughterBranches: [branch],
        brotherCount: branches.indexOf(branch) + 1, teacherPillar: pillar,
        marriages: [1, 2, 3, 4].map(order => ({ order, pillar })),
      });
      for (const { kinshipFact: { table, key }, clauseId, status, claim, requiresSelection } of calc.results) {
        assert.ok(requiresSelection);
        if (!slots.has(table)) slots.set(table, new Map());
        const keys = slots.get(table);
        if (keys.has(key)) assert.equal(keys.get(key), clauseId);
        keys.set(key, clauseId);
        if (status === 'matched') {
          assert.ok(claim.conditions.match.selector.clauseIds.includes(clauseId));
          assert.equal(claim.conditions.match.selector.libraryEdition, 'muxuan-json');
          sourceIds.add(claim.id);
        } else assert.equal(claim, undefined);
      }
    }
  }
  assert.deepEqual([...slots.values()].map(keys => keys.size).sort((a, b) => a - b),
    [...Array(7).fill(12), ...Array(8).fill(60)]);
  assert.equal(sourceIds.size, 518);
});

test('the two printed parent sequences use separate bases and keep explicit age and edition gates', () => {
  const query = birth(1984, '男');
  const parents = { fatherBranch: '酉', motherBranch: '寅' };
  const lookupWith = facts => parentSeries(runTieban(query, facts));
  const initial = lookupWith(parents);
  assert.equal(initial.libraryEdition, 'muxuan-json');
  assert.deepEqual(initial.results.map(({ clauseId, parentSeries: source }) => [clauseId, source.baseClauseId, source.step]), [
    [9549, 9453, 1], [9645, 9453, 2], [9741, 9453, 3], [9837, 9453, 4],
    [9801, 9705, 1], [9897, 9705, 2], [9993, 9705, 3], [10089, 9705, 4],
  ]);
  const trialAt = (age, clauseId) => lookupWith({ ...parents, calibrationAge: age }).results.find(row => row.clauseId === clauseId);
  assert.equal(initial.results[0].reason, 'scope_mismatch');
  assert.equal(initial.results[2].reason, 'not_in_catalog');
  assert.equal(trialAt(61, 9549).claim.id, 'tbss-v9-clauses-p09549-001');
  assert.equal(trialAt(60, 9549).reason, 'age_mismatch');
  assert.equal(trialAt(81, 9645).reason, 'source_text_mismatch');
  assert.equal(trialAt(48, 10089).claim.id, 'tbss-v10-clauses-p10089-001');
  assert.equal(trialAt(61, 9837).age, undefined);
  assert.equal(trialAt(61, 9837).status, 'matched');
  assert.equal(lookupWith({ brotherCount: 2 }), undefined);

  const crossEdition = lookupWith({ motherBranch: '卯', calibrationAge: 61 }).results.find(row => row.clauseId === 10043);
  assert.equal(crossEdition.reason, 'not_in_catalog');
  assert.equal(crossEdition.claim, undefined);
  const agedEntry = lookupWith({ fatherBranch: '未', calibrationAge: 101 }).results.find(row => row.clauseId === 9449);
  assert.equal(agedEntry.claim.id, 'tbss-v9-clauses-p09449-001');
  assert.ok(initial.results.every(row => row.requiresSelection));
});

test('parent-series age input belongs to a confirmed natal parent lookup', () => {
  const query = birth(1984, '男');
  const parse = (tiebanKunjiFacts, timeKnown = true) => parseInput({ timeKnown, chartQueries: [{ ...query, tiebanKunjiFacts }] });
  const accepted = { motherBranch: '寅', calibrationAge: 48 };
  assert.deepEqual(parse(accepted).chartQueries[0].tiebanKunjiFacts, accepted);
  assert.equal(parse(accepted, false).chartQueries[0].tiebanKunjiFacts, undefined);
  for (const calibrationAge of [null, '48', 0, Number.MAX_SAFE_INTEGER + 1, 48.5]) {
    assert.equal(parse({ motherBranch: '寅', calibrationAge }), null);
  }
  assert.equal(parse({ brotherCount: 2, calibrationAge: 48 }), null);
});

test('all parent-series coordinates reach same-edition SQLite matching', () => {
  catalog.ensure();
  const db = openKnowledgeReadDatabase(catalog.file);
  const numbers = new Set(), natal = new Set(), annual = new Set();
  try {
    const tables = db.prepare(`SELECT e.claim_json
      FROM tieban_clause_number n JOIN claim_entry e ON e.id = n.claim_id
      WHERE n.library_edition = 'muxuan-json' AND n.clause_id = ?`);
    for (const gender of ['男', '女']) {
      const query = birth(1984, gender);
      for (const branch of '子丑寅卯辰巳午未申酉戌亥') {
        const input = { fatherBranch: branch, motherBranch: branch };
        const candidates = parentSeries(runTieban(query, input)).results;
        const ages = new Set();
        for (const row of candidates) {
          numbers.add(row.clauseId);
          assert.ok(row.requiresSelection);
          if (row.status === 'matched') natal.add(row.claim.id);
          const stored = tables.get(row.clauseId);
          const claim = stored && JSON.parse(stored.claim_json);
          if (claim?.conditions.match.chartScope === 'annual') ages.add(claim.conditions.match.selector.ages[0]);
        }
        for (const calibrationAge of ages) {
          const results = parentSeries(runTieban(query, { ...input, calibrationAge })).results;
          for (const row of results) if (row.status === 'matched' && row.age !== undefined) {
            assert.ok(row.claim.conditions.match.selector.ages.includes(calibrationAge));
            annual.add(row.claim.id);
          }
        }
      }
    }
  } finally {
    db.close();
  }
  assert.deepEqual([numbers.size, natal.size, annual.size], [96, 45, 20]);
});
