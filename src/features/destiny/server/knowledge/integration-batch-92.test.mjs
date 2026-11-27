import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-92-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-bazi-batch-92-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
const localOffset = 8 * 3600000;

function native(birthTime) {
  const instant = Date.parse(birthTime);
  return calculateBaZi(instant, instant + localOffset);
}

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown = true) => explainClaim(id, 'bazi', context(query(facts, timeKnown)), undefined, catalog);
const factsFor = (chart, changes = {}) => chartFacts.bazi(describeBaZiPillars({
  year: chart.year, month: chart.month, day: chart.day, hour: chart.hour, ...changes,
}));

test('every reviewed seasonal and Yuanhai group reaches SQLite, individual explanation and report materials', () => {
  const expected = new Map();
  let whole = 0, partial = 0;
  for (const id of fixture.sourceIds) {
    const row = catalog.get(id);
    if (row.inputs?.length) whole++;
    if (row.branches.length) partial++;
    for (const { text, inputs } of row.inputs ? [{ inputs: row.inputs }] : row.branches) {
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.deepEqual([whole, partial], [3, 6]);
  assert.equal(expected.size, fixture.compiledGroups);

  const seen = new Set(), inBirthDateRange = new Set();
  for (const { birthTime, pillars, proofs } of fixture.witnesses) {
    const chart = native(birthTime);
    assert.deepEqual({ year: chart.year, month: chart.month, day: chart.day, hour: chart.hour }, pillars);
    const local = new Date(Date.parse(birthTime) + localOffset);
    const date = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
    const parsed = query(chartFacts.bazi(chart)), base = context(parsed);
    const derived = claimChartContext('bazi', base);
    const refs = lookup(parsed), matches = hits(refs), materials = buildReportMaterials(refs);
    for (const proof of proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matches.find(row => row.id === id), detail = explainClaim(id, 'bazi', base, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
      if (isBirthDate(date, new Date(2026, 10, 20, 12))) inBirthDateRange.add(proofKey);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.equal(inBirthDateRange.size, fixture.inBirthDateRange);
});

test('two Bing around Ding need the specified month and hour as well as an actual water branch', () => {
  const id = 'qtbj-v3-c036-p001-301';
  const chart = native('1901-09-06T04:00:00Z');
  assert.ok(explain(id, chartFacts.bazi(chart)).matched);
  assert.equal(explain(id, factsFor(chart, { hour: '壬寅' })).matched, false);
  // Chou contains hidden water. This passage requires an actual Hai or Zi.
  assert.equal(explain(id, factsFor(chart, { day: '丁巳' })).matched, false);
  assert.equal(explain(id, chartFacts.bazi(chart), false).matched, false);
});

test('the Hai-month Wu passage distinguishes hidden Geng from fully confirmed absence', () => {
  const id = 'qtbj-v4-c054-p002-301';
  const less = '支见庚金，入泮而已';
  const higher = '或甲得长生，遇支藏得地之水，一丙高透，亦主身贵扬名';
  const noGeng = native('1901-11-16T00:00:00Z'), hiddenGeng = native('1901-11-26T00:00:00Z');
  const branches = facts => explain(id, facts).matchedBranches.map(branch => branch.text);
  assert.deepEqual(branches(chartFacts.bazi(noGeng)), [higher]);
  assert.deepEqual(branches(chartFacts.bazi(hiddenGeng)), [less]);
  assert.equal(explain(id, chartFacts.bazi(noGeng).filter(fact => fact.position !== 'year')).matched, false);
});

test('Yuanhai uses the day stem for the month Lu and needs the named hour for its hour verses', () => {
  const lu = 'yhzp-v4-c081-p008-001', gold = 'yhzp-v5-c109-p007-001', heLu = 'yhzp-v5-c196-p002-001';
  const luChart = native('1900-02-09T16:00:00Z');
  assert.deepEqual(explain(lu, chartFacts.bazi(luChart), false).matchedBranches.map(branch => branch.text), ['月令見禄，不住祖基']);
  assert.equal(explain(lu, factsFor(luChart, { day: '乙卯', hour: '丙子' })).matched, false);
  const goldChart = native('1900-01-01T10:00:00Z');
  assert.ok(explain(gold, chartFacts.bazi(goldChart)).matched);
  assert.equal(explain(gold, chartFacts.bazi(goldChart), false).matched, false);
  const heLuChart = native('1901-01-10T08:00:00Z');
  assert.ok(explain(heLu, chartFacts.bazi(heLuChart)).matched);
  assert.equal(explain(heLu, factsFor(heLuChart, { year: '庚寅' })).matched, false);
  assert.equal(explain(heLu, chartFacts.bazi(heLuChart).filter(fact => fact.position !== 'year')).matched, false);
});
