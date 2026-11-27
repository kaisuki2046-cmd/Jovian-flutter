import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { dayHexagramProfile, heluoProfile, huangjiProfile, taiXuanFormsProfile, tiebanBaseNumbers, tiebanBookAnnualProfile,
  tiebanDecadalProfile, tianyuanYearProfile } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-tianyuan-year-'));
const catalog = historicalTiebanCatalog(directory);
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const fixture = JSON.parse(readFileSync(new URL('./claims/tieban-tianyuan-year-witnesses.json', import.meta.url), 'utf8'));
const calculation = result => result?.additionalCalculations.find(row => row.profile === tianyuanYearProfile);

function birth({ birthTime, gender }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3600000, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}

function parsed(query, timeKnown = true) {
  const value = parseInput({ timeKnown, chartQueries: [query] });
  assert.ok(value);
  return value;
}

test('published native chart reproduces the first number and six associated numbers with exact edition checks', async () => {
  const query = birth(fixture.sourceExample);
  assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), fixture.sourceExample.pillars);
  const native = calculation(tiebanBaseNumbers(query.confirmedFacts));
  assert.deepEqual(native.candidates[0], {
    axis: 'tianyuan_year_first', clauseId: 6729, upper: '乾', lower: '离', upperTotal: 450, lowerTotal: 270,
  });
  assert.deepEqual(native.candidates.map(row => row.clauseId), [6729, 6825, 6921, 7017, 7113, 7209, 7305]);
  const input = parsed({ ...query, tiebanBookAnnualAge: 45 });
  const { tieban } = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /田园年柱首号 6729/u);
      assert.match(materials, /田园年柱关联号 7017/u);
      assert.match(materials, /田园年柱的关联号从首号起每次加九十六/u);
      assert.doesNotMatch(materials, /田园年柱关联号 (?:6825|6921|7113|7209|7305)/u);
      return '测试解读';
    },
  });
  const current = calculation(tieban);
  assert.equal(current.libraryEdition, 'muxuan-json');
  assert.deepEqual(current.results.map(({ clauseId, status, reason }) => [clauseId, status, reason]), [
    [6729, 'matched', undefined], [6825, 'unmatched', 'source_text_mismatch'], [6921, 'unmatched', 'not_in_catalog'],
    [7017, 'matched', undefined], [7113, 'unmatched', 'not_in_catalog'], [7209, 'unmatched', 'not_in_catalog'],
    [7305, 'unmatched', 'scope_mismatch'],
  ]);
  assert.equal(current.results[0].claimId, 'tbss-v6-clauses-p06729-001');
  assert.equal(current.results[1].claimId, undefined);
  assert.ok(lookup(parsed(query, false).chartQueries).every(row => !row.tieban));
  assert.ok(lookup(parsed({ ...query, tradition: '三命通会' }).chartQueries).every(row => !row.tieban));
});

test('all legal year pillars reproduce the published arithmetic across both birth genders', () => {
  // Independent line totals obtained from the two triples of branch numbers,
  // indexed by the article's Later Heaven trigram numbers.
  const stems = [6, 2, 8, 7, 1, 9, 3, 4, 6, 2], branches = [1, 2, 3, 6, 7, 9, 9, 8, 8, 6, 4, 1];
  const outer = [0, 360, 360, 450, 270, 0, 450, 450, 270, 360];
  const inner = [0, 270, 270, 180, 360, 0, 180, 180, 360, 270];
  const all = new Set(), first = new Set(), associated = new Set(), years = new Set();
  let combinations = 0;
  for (let cycle = 0; cycle < 60; cycle++) for (const gender of ['男', '女']) {
    const birthTime = new Date(Date.UTC(1924 + cycle, 5, 15, 4)).toISOString();
    const { confirmedFacts } = birth({ birthTime, gender });
    years.add(confirmedFacts.find(fact => fact.kind === 'pillar' && fact.position === 'year').ganZhi);
    const upper = stems[cycle % 10], lower = branches[cycle % 12];
    const number = 1000 * upper + outer[upper] + inner[lower] + lower;
    const expected = [0, 96, 192, 288, 384, 480, 576].map(offset => number + offset);
    const candidates = calculation(tiebanBaseNumbers(confirmedFacts)).candidates;
    assert.deepEqual(candidates.map(row => row.clauseId), expected);
    combinations++;
    first.add(number);
    expected.forEach((id, index) => { all.add(id); if (index) associated.add(id); });
  }
  assert.equal(years.size, 60);
  assert.equal(combinations, fixture.chartCombinations);
  assert.equal(first.size, fixture.firstNumbers);
  assert.equal(associated.size, fixture.associatedNumbers);
  assert.equal(all.size, fixture.distinctNumbers);
});

test('84 distinct clauses gain a native match relative to the pre-Tianyuan natal calculations', () => {
  // These fixtures predate the Chen profiles and use no fourteen-table consultation pillar.
  const priorProfiles = new Set([
    huangjiProfile, dayHexagramProfile, heluoProfile, tiebanDecadalProfile, tiebanBookAnnualProfile, taiXuanFormsProfile,
  ]);
  const hitIds = new Set();
  for (const sample of fixture.witnesses) {
    const query = birth(sample);
    assert.deepEqual(query.confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), sample.pillars);
    const references = lookup(parsed(query).chartQueries);
    const { tieban } = references.find(row => row.tieban);
    const current = calculation(tieban);
    const prior = [tieban, ...tieban.additionalCalculations.filter(row => priorProfiles.has(row.profile))]
      .flatMap(row => row.results).map(row => row.claim?.id);
    const materials = buildReportMaterials(references);
    for (const { clauseId, axis, claimId } of sample.results) {
      const result = current.results.find(row => row.clauseId === clauseId && row.axis === axis);
      assert.equal(result?.status, 'matched', claimId);
      assert.equal(result.claim.id, claimId);
      assert.ok(!prior.includes(claimId), claimId);
      assert.ok(materials.includes(result.claim.evidence.original_text), claimId);
      assert.ok(materials.includes(`${axis === 'tianyuan_year_first' ? '田园年柱首号' : '田园年柱关联号'} ${clauseId}`), claimId);
      hitIds.add(claimId);
    }
  }
  assert.equal(hitIds.size, fixture.reached);
  assert.equal(hitIds.size, 84);
  const coveredEarlier = new Set();
  for (const { claimId, profile, clauseId, ...sample } of fixture.priorWitnesses) {
    const { tieban } = lookup(parsed(birth(sample)).chartQueries).find(row => row.tieban);
    const older = [tieban, ...tieban.additionalCalculations].find(row => row.profile === profile);
    assert.ok(older.results.some(row => row.clauseId === clauseId && row.status === 'matched' && row.claim.id === claimId), claimId);
    assert.ok(hitIds.has(claimId));
    coveredEarlier.add(claimId);
  }
  assert.equal(coveredEarlier.size, 8);
  assert.equal(hitIds.size - coveredEarlier.size, fixture.additionalReach);
});
