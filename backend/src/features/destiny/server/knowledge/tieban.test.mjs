import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createHistoricalTiebanLookup, historicalTiebanCatalog, historicalTiebanSource, historicalTest } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { createClaimsCatalog } from './claims.mjs';
import { dayHexagramProfile, huangjiProfile, tiebanBaseNumbers, tiebanNeedsExtraFacts, tiebanProfile } from './tieban.mjs';

const earlierId = 'tbss-v3-clauses-p03788-001';
const laterId = 'tbss-v2-clauses-p02664-001';
const huangjiExampleId = 'tbss-v6-clauses-p06181-001';
const dayHexagramWitnesses = JSON.parse(readFileSync(new URL('./claims/tieban-day-hexagram-witnesses.json', import.meta.url), 'utf8'));
const hourMs = 3600000;

function nativeFactsAt(instant, gender) {
  const chart = calculateBaZi(instant, instant + 8 * hourMs);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function nativeFacts({ year = 1950, month = 9, day = 8, hour = 12, gender = '男' } = {}) {
  return nativeFactsAt(Date.UTC(year, month - 1, day, hour) - 8 * hourMs, gender);
}

const query = (facts, chartScope = 'natal') => ({
  method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: facts, chartScope,
});

historicalTest('the supplied Tai Xuan example reproduces both base numbers from native chart facts', () => {
  const raw = nativeFacts();
  assert.deepEqual(raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), ['庚寅', '甲申', '丙午', '甲午']);
  const calculation = tiebanBaseNumbers(raw);
  assert.deepEqual(calculation.sums, [15, 16, 16, 18]);
  assert.deepEqual(calculation.candidates, [
    { axis: 'earlier', clauseId: 3788, upper: '艮', lower: '坤', mutualUpper: '坤', mutualLower: '坤' },
    { axis: 'later', clauseId: 2664, upper: '乾', lower: '艮', mutualUpper: '乾', mutualLower: '巽' },
  ]);
  assert.deepEqual(calculation.additionalCalculations[0], { profile: huangjiProfile, libraryEdition: 'muxuan-json',
    candidates: [{ axis: 'yuan_hui', clauseId: 1516 }, { axis: 'yun_shi', clauseId: 6181 }] });
});

historicalTest('explicit contradictory or incomplete coordinates cannot produce Tieban numbers', () => {
  const raw = nativeFacts();
  assert.equal(tiebanBaseNumbers(raw.filter(fact => fact.position !== 'hour')), null);
  assert.equal(tiebanBaseNumbers(raw.filter(fact => fact.kind !== 'natal_gender')), null);
  assert.equal(tiebanBaseNumbers([...raw, { kind: 'natal_gender', gender: '女' }]), null);
  assert.equal(tiebanBaseNumbers([...raw, { kind: 'stem', position: 'month', stem: '戊' }]), null);
  const impossibleHour = raw.filter(fact => fact.position !== 'hour')
    .concat({ kind: 'pillar', position: 'hour', ganZhi: '丙午' });
  assert.equal(tiebanBaseNumbers(impossibleHour), null);
});

test('source calibration text distinguishes missing family facts from ordinary readings', () => {
  for (const text of ['母命癸酉年生方合。', '父猴母羊。', '妻命生于辛未。', '夫妻同庚。', '父大十六岁。', '乙亥金榜提名方合此刻。']) {
    assert.ok(tiebanNeedsExtraFacts(text), text);
  }
  for (const text of ['妻助家业。', '父慈子孝。', '金水之年点翰林。', '此刻注定贵人基，木年水年夫得贵。']) {
    assert.ok(!tiebanNeedsExtraFacts(text), text);
  }
});

historicalTest('the unified report reads native matches from SQLite and returns an uncollected number as unmatched', async () => {
  const lookup = createHistoricalTiebanLookup();
  const refs = lookup([query(nativeFacts())]);
  assert.deepEqual(refs[0].tieban.results.map(row => [row.clauseId, row.status, row.claim?.id]),
    [[3788, 'matched', earlierId], [2664, 'matched', laterId]]);
  assert.ok(refs.every(({ personality, events }) => [...personality, ...events].every(row => row.id !== earlierId && row.id !== laterId)));
  const input = parseInput({ timeKnown: true, chartQueries: [query(nativeFacts({ hour: 14 }))] });
  let modelCalled = false;
  const output = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials, references }) => {
      modelCalled = true;
      assert.match(materials, /铁板神数起数参考（沐玄 JSON 版）：先天基数 3784/u);
      assert.match(materials, /考刻尚未确认/u);
      assert.doesNotMatch(materials, /2666|not_in_catalog/u);
      assert.ok(references.every(row => !('tieban' in row)));
      return '测试解读';
    },
  });
  assert.ok(modelCalled);
  assert.equal(output.report, '测试解读');
  assert.deepEqual(output.tieban.results, [
    { axis: 'earlier', clauseId: 3784, status: 'matched', claimId: 'tbss-v3-clauses-p03784-001' },
    { axis: 'later', clauseId: 2666, status: 'unmatched', reason: 'not_in_catalog' },
  ]);
  const annual = lookup([query(nativeFacts(), 'annual')]);
  assert.ok(annual.every(row => !row.tieban));
  const unknown = parseInput({ timeKnown: false, chartQueries: [query(nativeFacts())] });
  assert.ok(lookup(unknown.chartQueries).every(row => !row.tieban));
  const otherTradition = lookup([{ ...query(nativeFacts()), tradition: '三命通会' }]);
  assert.ok(otherTradition.every(row => !row.tieban));
  const otherRules = lookup([{ ...query(nativeFacts()), rulesetVersion: 'unsupported' }]);
  assert.ok(otherRules.every(row => !row.tieban));

  const annualNumber = lookup([query(nativeFacts({ year: 1980, month: 1, day: 1, hour: 0 }))])[0].tieban.results[1];
  assert.equal(annualNumber.clauseId, 7191);
  assert.equal(annualNumber.reason, 'scope_mismatch');
  const restricted = { year: 1980, month: 1, day: 28, hour: 4 };
  assert.equal(lookup([query(nativeFacts(restricted))])[0].tieban.results[1].reason, 'gender_mismatch');
  const femaleResult = lookup([query(nativeFacts({ ...restricted, gender: '女' }))])[0].tieban.results[1];
  assert.equal(femaleResult.clauseId, 3748);
  assert.equal(femaleResult.status, 'matched');

  const db = openKnowledgeReadDatabase(historicalTiebanCatalog().file);
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM tieban_clause_number').get().n, 7076);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

historicalTest('Huangji preserves printed number, edition and report provenance independently of Tai Xuan', async () => {
  const lookup = createHistoricalTiebanLookup();
  const input = parseInput({ timeKnown: true, chartQueries: [query(nativeFacts())] });
  const output = await generateReport(input, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials, references }) => {
      assert.match(materials, /先天基数 3788（太玄）/u);
      assert.match(materials, /皇极运世基数 6181/u);
      assert.match(materials, /考刻尚未确认/u);
      assert.doesNotMatch(materials, /皇极.*(?:1516|9516|10416)/u);
      assert.ok(references.every(row => !row.tieban && [...row.personality, ...row.events].every(claim => claim.id !== huangjiExampleId)));
      return '测试解读';
    },
  });
  assert.equal(output.report, '测试解读');
  assert.equal(output.tieban.profile, tiebanProfile);
  assert.deepEqual(output.tieban.results.map(row => row.clauseId), [3788, 2664]);
  assert.deepEqual(output.tieban.additionalCalculations[0], { profile: huangjiProfile, libraryEdition: 'muxuan-json',
    results: [{ axis: 'yuan_hui', clauseId: 1516, status: 'unmatched', reason: 'not_in_catalog' },
      { axis: 'yun_shi', clauseId: 6181, status: 'matched', claimId: huangjiExampleId }] });
});

historicalTest('all 48 new Huangji clause IDs reach the real SQLite report from native charts', () => {
  const file = JSON.parse(readFileSync(new URL('./claims/tieban-huangji-witnesses.json', import.meta.url), 'utf8'));
  assert.equal(file.profile, huangjiProfile);
  assert.equal(new Set(file.witnesses.map(row => row.claimId)).size, 48);
  const lookup = createHistoricalTiebanLookup();
  for (const row of file.witnesses) {
    const raw = nativeFactsAt(Date.parse(row.birthTime), row.gender);
    assert.deepEqual(raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), row.pillars, row.claimId);
    const { chartQueries } = parseInput({ timeKnown: true, chartQueries: [query(raw)] });
    const references = lookup(chartQueries);
    const [huangji] = references[0].tieban.additionalCalculations;
    const result = huangji.results.find(candidate => candidate.axis === row.axis);
    assert.equal(huangji.libraryEdition, file.libraryEdition);
    assert.equal(result.clauseId, row.clauseId, row.claimId);
    assert.equal(result.status, 'matched', row.claimId);
    assert.equal(result.claim.id, row.claimId);
    assert.ok(!references.some(topic => [...topic.personality, ...topic.events].some(rule => rule.id === row.claimId)));
    const label = row.axis === 'yuan_hui' ? '皇极元会基数' : '皇极运世基数';
    const materials = buildReportMaterials(references);
    assert.ok(materials.includes(`${label} ${row.clauseId}`));
    assert.ok(materials.includes(result.claim.evidence.original_text));
  }
});

historicalTest('Huangji leaves short, gender-restricted and annual-only candidates unmatched', () => {
  const lookup = createHistoricalTiebanLookup();
  const cases = [
    [{ year: 1983, month: 11, day: 15 }, 0, 909, 'not_in_catalog'],
    [{ year: 1990, month: 1, day: 3, hour: 10 }, 1, 101, 'not_in_catalog'],
    [{ year: 1965, month: 4, day: 15 }, 0, 1213, 'gender_mismatch'],
    [{ year: 1977, month: 5, day: 15 }, 0, 1012, 'scope_mismatch'],
  ];
  for (const [date, index, clauseId, reason] of cases) {
    const result = lookup([query(nativeFacts(date))])[0].tieban.additionalCalculations[0].results[index];
    assert.deepEqual(result, { axis: index === 0 ? 'yuan_hui' : 'yun_shi', clauseId, status: 'unmatched', reason });
  }
});

historicalTest('day hexagram reproduces the direct number and five listed year/month numbers from the source example', async () => {
  const [example] = dayHexagramWitnesses.example;
  const raw = nativeFactsAt(Date.parse(example.birthTime), example.gender);
  assert.deepEqual(raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), ['癸巳', '甲子', '丁酉', '甲辰']);
  const calculated = tiebanBaseNumbers(raw).additionalCalculations.find(row => row.profile === dayHexagramProfile);
  assert.deepEqual(calculated.candidates.map(row => row.clauseId), [3926, 8239, 8226, 8212, 8253, 8221]);
  const output = await generateReport(parseInput({ timeKnown: true, chartQueries: [query(raw)] }), {
    lookup: createHistoricalTiebanLookup(), signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /日柱配卦纳数 3926/u);
      assert.match(materials, /年月变卦·本卦下卦纳数 8226[\s\S]*?原文：兄弟三人，我在空门。/u);
      assert.doesNotMatch(materials, /年月变卦[^\r\n]*(?:8253|8248|8211)/u);
      assert.doesNotMatch(materials, /阴极阳盛，数止于此/u);
      return '测试解读';
    },
  });
  const result = output.tieban.additionalCalculations.find(row => row.profile === dayHexagramProfile);
  assert.equal(result.libraryEdition, 'muxuan-json');
  assert.deepEqual(result.results, dayHexagramWitnesses.example.map(({ axis, clauseId, claimId, reason }) =>
    claimId ? { axis, clauseId, status: 'matched', claimId } : { axis, clauseId, status: 'unmatched', reason }));
});

historicalTest('all 70 additional day hexagram clause IDs reach the live SQLite report from native charts', () => {
  const file = dayHexagramWitnesses;
  const lookup = createHistoricalTiebanLookup();
  assert.equal(file.profile, dayHexagramProfile);
  assert.equal(new Set(file.witnesses.map(row => row.claimId)).size, 70);
  for (const row of file.witnesses) {
    const raw = nativeFactsAt(Date.parse(row.birthTime), row.gender);
    assert.deepEqual(raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), row.pillars);
    const { chartQueries } = parseInput({ timeKnown: true, chartQueries: [query(raw)] });
    const references = lookup(chartQueries);
    const calculation = references[0].tieban.additionalCalculations.find(item => item.profile === dayHexagramProfile);
    const result = calculation.results.find(candidate => candidate.axis === row.axis);
    assert.equal(calculation.libraryEdition, file.libraryEdition);
    assert.equal(result.clauseId, row.clauseId);
    assert.equal(result.status, 'matched', row.claimId);
    assert.equal(result.claim.id, row.claimId);
    const rendered = buildReportMaterials(references);
    assert.ok(rendered.includes(result.claim.evidence.original_text));
    const family = row.axis === 'day_hexagram' ? '日柱配卦' : '年月变卦';
    assert.match(rendered, new RegExp(`${family}[^\\r\\n]* ${row.clauseId}`, 'u'));
  }
});

historicalTest('day hexagram uses the same scope and sex filters as the other numbered profiles', () => {
  const lookup = createHistoricalTiebanLookup();
  const cases = [
    [dayHexagramWitnesses.example[0].birthTime, '女', 'day_hexagram', 3926, 'gender_mismatch'],
    ['1964-01-15T12:00:00+08:00', '男', 'year_month_original', 4838, 'scope_mismatch'],
  ];
  for (const [birthTime, gender, axis, clauseId, reason] of cases) {
    const results = lookup([query(nativeFactsAt(Date.parse(birthTime), gender))])[0].tieban.additionalCalculations
      .find(row => row.profile === dayHexagramProfile).results;
    assert.deepEqual(results.find(row => row.axis === axis), { axis, clauseId, status: 'unmatched', reason });
  }
});

historicalTest('report materials quote a shared Tieban clause once and retain both calculation labels', () => {
  const lookup = createHistoricalTiebanLookup();
  const references = lookup([query(nativeFacts())]);
  const tieban = references[0].tieban;
  const claim = tieban.results[0].claim;
  // A test double for repeated source IDs, regardless of how many editions
  // normalize a given numbered proof to that source.
  tieban.additionalCalculations[0].results[0] = { axis: 'yuan_hui', clauseId: 1516, status: 'matched', claim };
  const materials = buildReportMaterials(references);
  assert.match(materials, /先天基数 3788（太玄）、皇极元会基数 1516/u);
  assert.equal(materials.split(`原文：${claim.evidence.original_text}`).length - 1, 1);
});

historicalTest('an older SQLite database rebuilds the versioned index and never borrows a same-number CSV clause', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-tieban-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const source = JSON.parse(readFileSync(historicalTiebanSource('bazi.json'), 'utf8')).find(row => row.id === earlierId);
  const variant = structuredClone(source);
  variant.id = 'tieban-test-csv';
  Object.assign(variant.conditions.match.selector, { libraryEdition: 'muxuan-fourteen-table-csv', genderCode: null,
    clauseIds: [3788, 2664, 1516, 6181, 3926, 8253] });
  writeFileSync(join(sourceDirectory, 'bazi.json'), JSON.stringify([source, variant]));
  for (const file of ['ziwei.json', 'western.json']) writeFileSync(join(sourceDirectory, file), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), '{"changedConditionIds":{},"changedEvidenceIds":{}}');
  const options = { directory: join(directory, 'db'), sourceDirectory, includeLegacy: false };
  const catalog = createClaimsCatalog(options);
  catalog.build();
  const db = new DatabaseSync(catalog.file);
  try {
    db.exec('DROP TABLE tieban_clause_number; UPDATE claim_catalog_meta SET schema_version = 4');
  } finally { db.close(); }
  const migrated = createClaimsCatalog(options);
  const { results: [earlier, later], additionalCalculations: [huangji] } = migrated.tiebanMatches(nativeFacts());
  assert.equal(earlier.claim.id, earlierId, 'the JSON version wins regardless of the CSV row');
  assert.equal(later.status, 'unmatched');
  assert.equal(later.reason, 'not_in_catalog', 'the number exists only in the other version');
  assert.deepEqual(huangji.results.map(({ clauseId, status, reason }) => [clauseId, status, reason]),
    [[1516, 'unmatched', 'not_in_catalog'], [6181, 'unmatched', 'not_in_catalog']]);
  const sample = nativeFactsAt(Date.parse(dayHexagramWitnesses.example[0].birthTime), '男');
  const dayHexagram = migrated.tiebanMatches(sample).additionalCalculations.find(row => row.profile === dayHexagramProfile);
  assert.ok(dayHexagram.results.every(result => result.status === 'unmatched' && result.reason === 'not_in_catalog'));
  assert.ok(migrated.status().schema_version > 4);
});
