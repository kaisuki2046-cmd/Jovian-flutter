import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTiebanSource, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { chenAnnualProfile, tiebanBookAnnualProfile, tiebanSelector } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-chen-annual-'));
const catalog = historicalTiebanCatalog(directory), lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const read = name => JSON.parse(readFileSync(new URL(`./claims/${name}.json`, import.meta.url), 'utf8'));
const fixture = read('tieban-chen-annual-witnesses');
const annual = (tieban, profile = chenAnnualProfile) => tieban?.additionalCalculations.find(row => row.profile === profile);
const tiebanFor = refs => refs.find(row => row.tieban)?.tieban;

function birth({ birthTime, gender, age }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3600000, gender === '男' ? 'male' : 'female');
  return { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, tiebanBookAnnualAge: age,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }] };
}

function input(query, timeKnown = true) {
  const parsed = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(parsed);
  return parsed;
}

const references = (query, timeKnown = true) => lookup(input(query, timeKnown).chartQueries);
const resultFor = query => annual(tiebanFor(references(query))).results[0];

function withFirstAge(facts, age) {
  const first = facts.find(fact => fact.kind === 'bazi_decadal_range').startAge;
  return facts.map(fact => fact.kind === 'bazi_decadal_range'
    ? { ...fact, startAge: fact.startAge + age - first, endAge: fact.endAge + age - first } : fact);
}

test('Method 14 reproduces the printed windows, paired stems and the documented second-year discrepancy', () => {
  const query = birth(fixture.printed);
  assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), fixture.printed.pillars);
  assert.equal(query.confirmedFacts.find(fact => fact.kind === 'bazi_decadal_range').startAge, fixture.printed.firstAge);
  const run = (age, facts = query.confirmedFacts) => resultFor({ ...query, confirmedFacts: facts, tiebanBookAnnualAge: age });
  const printedRanges = withFirstAge(query.confirmedFacts, 3);
  const rows = [1, 2, 3, 4, 5].map(age => run(age, printedRanges));
  assert.deepEqual(rows.map(({ age, clauseId, annualPeriod }) => [age, clauseId, annualPeriod.ganZhi, annualPeriod.luckPillar]), [
    [1, 4359, '庚戌', undefined], [2, 4353, '辛亥', undefined], [3, 8350, '壬子', '庚寅'],
    [4, 8358, '癸丑', '庚寅'], [5, 5352, '甲寅', '庚寅'],
  ]);
  assert.deepEqual(rows[4].annualPeriod.stemCombination, { monthStem: '己', annualStem: '甲', number: 1 });
  assert.equal(run(1, withFirstAge(query.confirmedFacts, 1)).clauseId, 8359);
  // The same four pillars in the native calendar start at four; confirmed
  // native boundaries must take priority over a printed example's boundary.
  assert.deepEqual(run(3).annualPeriod, { ganZhi: '壬子', beforeFirstLuck: true });
  assert.equal(run(3).clauseId, 4350);
  assert.equal(run(4).clauseId, 8358);
});

test('an absent selection or unknown time suppresses the annual profile, and missing confirmed ranges are explicit', () => {
  const query = birth({ ...fixture.printed, age: 15 });
  assert.equal(annual(tiebanFor(references({ ...query, tiebanBookAnnualAge: undefined }))), undefined);
  assert.equal(annual(tiebanFor(references(query, false))), undefined);
  const missing = query.confirmedFacts.filter(fact => fact.kind !== 'bazi_decadal_range' || fact.startAge !== 14);
  const conflict = { kind: 'bazi_decadal_range', ganZhi: '庚寅', startAge: 5, endAge: 14 };
  const all = query.confirmedFacts.filter(fact => fact.kind !== 'bazi_decadal_range');
  for (const confirmedFacts of [missing, [...query.confirmedFacts, conflict], all]) {
    const tieban = tiebanFor(references({ ...query, confirmedFacts }));
    assert.deepEqual(annual(tieban), { profile: chenAnnualProfile, libraryEdition: 'muxuan-json', status: 'unavailable',
      reason: 'missing_confirmed_decadal_range', results: [] });
  }
});

test('85 native annual matches and version, scope, age and gender misses reach the report lookup', () => {
  const hitIds = new Set();
  for (const sample of [...fixture.witnesses, ...Object.values(fixture.special)]) {
    const refs = references(birth(sample));
    const { libraryEdition, results } = annual(tiebanFor(refs));
    assert.equal(libraryEdition, 'muxuan-json');
    assert.equal(results.length, 1);
    const [result] = results;
    assert.equal(result.axis, 'chen_annual');
    assert.deepEqual([result.age, result.clauseId, result.annualPeriod.ganZhi, result.annualPeriod.luckPillar,
      result.annualPeriod.stemCombination?.number], [sample.age, sample.clauseId, sample.ganZhi, sample.luckPillar, sample.combination]);
    assert.equal(result.annualPeriod.beforeFirstLuck, sample.luckPillar === undefined);
    const materials = buildReportMaterials(refs);
    if (sample.reason) {
      assert.equal(result.status, 'unmatched');
      assert.equal(result.reason, sample.reason);
      assert.equal(result.claim, undefined);
      assert.doesNotMatch(materials, /陈氏第十四法流年编号/u);
    } else {
      assert.equal(result.status, 'matched', sample.claimId);
      assert.equal(result.claim.id, sample.claimId);
      assert.ok(materials.includes(result.claim.evidence.original_text));
      assert.ok(materials.includes(`陈氏第十四法流年编号 ${sample.clauseId}（${sample.age}虚岁，${sample.ganZhi}，`
        + (sample.luckPillar ? '大运' + sample.luckPillar : '尚未交运')));
      hitIds.add(sample.claimId);
    }
  }
  assert.equal(hitIds.size, fixture.reached);
  assert.equal(hitIds.size, 85);
  const db = openKnowledgeReadDatabase(catalog.file);
  try {
    const csvOnly = fixture.special.not_in_catalog_csv.clauseId;
    assert.deepEqual(db.prepare('SELECT library_edition FROM tieban_clause_number WHERE clause_id = ?').all(csvOnly)
      .map(row => row.library_edition), ['muxuan-fourteen-table-csv']);
  } finally { db.close(); }
});

test('58 observed claims fall outside the earlier annual numbering, while overlaps have native evidence', () => {
  const currentIds = new Set(fixture.witnesses.map(row => row.claimId));
  const csvIds = read('tieban-fourteen-witnesses').witnesses.flatMap(row =>
    row.proofs.filter(proof => proof.age !== undefined).map(proof => proof.id));
  const olderIds = new Set([...csvIds, ...read('tieban-book-annual-witnesses').witnesses.map(row => row.claimId)]);
  for (const sample of fixture.earlierMethodWitnesses) {
    const result = annual(tiebanFor(references(birth(sample))), tiebanBookAnnualProfile).results[0];
    assert.equal(result.clauseId, sample.clauseId);
    assert.equal(result.status, 'matched');
    assert.equal(result.claim.id, sample.claimId);
    olderIds.add(sample.claimId);
  }
  // A superset of the earlier SQL-edition numbers ignores date and gender;
  // anything outside it cannot match the old arithmetic in any chart.
  const stem = [3, 4, 6], branch = [1, 2, 3, 4, 5], oldNumbers = new Set();
  for (const month of stem) for (const luck of stem) for (const day of stem) for (const hour of stem)
    for (const year of stem) for (const seat of branch) oldNumbers.add(1000 * (month + luck) + 100 * day + 10 * hour + year + seat);
  const fresh = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8')).filter(row => currentIds.has(row.id) && !csvIds.includes(row.id)
    && tiebanSelector(row).clauseIds.every(number => !oldNumbers.has(number))).map(row => row.id);
  assert.equal(olderIds.size, 62);
  assert.deepEqual(new Set(fresh), new Set([...currentIds].filter(id => !olderIds.has(id))));
  assert.equal(fresh.length, fixture.additionalReach);
});

test('report replies keep the applied stem-pair evidence and separate annual methods', async () => {
  const sample = fixture.special.positive_combination;
  const report = await generateReport(input(birth(sample)), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /流年编号按原表复算，取材限于所选虚岁/u);
      assert.match(materials, /月干己与流年干甲合数1/u);
      return '测试解读';
    },
  });
  assert.ok(annual(report.tieban, tiebanBookAnnualProfile));
  assert.deepEqual(annual(report.tieban).results[0], { axis: 'chen_annual', clauseId: sample.clauseId, status: 'matched',
    age: sample.age, claimId: sample.claimId, annualPeriod: { ganZhi: sample.ganZhi, luckPillar: sample.luckPillar,
      beforeFirstLuck: false, stemCombination: { monthStem: '己', annualStem: '甲', number: 1 } } });
});
