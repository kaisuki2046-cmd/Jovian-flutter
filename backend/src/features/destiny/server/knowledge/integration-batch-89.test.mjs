import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { createReportLookup } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-89-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-seasonal-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => rmSync(directory, { recursive: true, force: true }));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);

function native({ birthTime }) {
  const instant = Date.parse(birthTime);
  return calculateBaZi(instant, instant + 8 * 3600000);
}
function witness(id, text) {
  const sample = fixture.witnesses.find(({ proofs }) => proofs.some(proof => proof.id === id && proof.text === text));
  assert.ok(sample, id);
  return native(sample);
}
function inputFor(confirmedFacts, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }] });
  assert.ok(input);
  return input;
}
const context = ([query]) => chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown = true) =>
  explainClaim(id, 'bazi', context(inputFor(facts, timeKnown).chartQueries), undefined, catalog);

test('every new seasonal condition group reaches SQLite, explanations and report materials from a native chart', () => {
  const expected = new Map();
  let whole = 0, passageRecords = 0;
  for (const id of fixture.sourceIds) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    if (row.branches.length) passageRecords++;
    for (const { text, inputs, conditionCompiler } of row.inputs
      ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, qtbjSeasonalPassageProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.deepEqual([whole, passageRecords], [7, 4]);
  assert.equal(expected.size, fixture.compiledGroups);
  const seen = new Set(), inBirthDateRange = new Set();
  for (const sample of fixture.witnesses) {
    const chart = native(sample), { year, month, day, hour } = chart;
    assert.deepEqual({ year, month, day, hour }, sample.pillars);
    const local = new Date(Date.parse(sample.birthTime) + 8 * 3600000);
    const date = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
    const query = inputFor(chartFacts.bazi(chart)), base = context(query.chartQueries);
    const derived = claimChartContext('bazi', base);
    const refs = lookup(query.chartQueries), matches = hits(refs), materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), expectedInput = expected.get(proofKey);
      assert.ok(expectedInput && evaluateRule(expectedInput, 'natal', derived).matched, id);
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

test('the spring wood trio and directional trio quote only their own sentence and require all hidden seats to be known', async () => {
  const id = 'qtbj-v2-c010-p008-301';
  const sentences = ['亥卯未逢於甲乙，富贵无疑', '木全寅卯辰方，功名有准'];
  for (const [index, text] of sentences.entries()) {
    const facts = chartFacts.bazi(witness(id, text));
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    const incomplete = facts.filter(fact => !['pillar', 'branch'].includes(fact.kind) || fact.position !== 'hour');
    assert.equal(explain(id, incomplete).matched, false);
    const report = await generateReport(inputFor(facts), {
      lookup, signal: new AbortController().signal,
      complete: async ({ materials }) => {
        assert.ok(materials.includes(text));
        assert.ok(!materials.includes(sentences[1 - index]));
        return '测试报告';
      },
    });
    assert.equal(report.report, '测试报告');
  }
});

test('hidden month stems do not substitute for exposure or violate an exposure-only exclusion', () => {
  const ji = 'qtbj-v4-c058-p002-101';
  const proof = witness(ji);
  assert.equal(proof.month[1], '辰');
  assert.equal(explain(ji, chartFacts.bazi(proof)).matched, true);
  const exposedGui = describeBaZiPillars({ year: '癸酉', month: '丙辰', day: '己丑', hour: '甲子' });
  assert.equal(explain(ji, chartFacts.bazi(exposedGui)).matched, false);

  const wu = 'qtbj-v4-c054-p005-301';
  const original = witness(wu);
  const facts = chartFacts.bazi(original);
  assert.equal(explain(wu, facts).matched, true);
  const visible = facts.find(fact => fact.kind === 'stem' && fact.stem === '戊' && fact.position !== 'day');
  assert.ok(visible);
  const dayOnly = facts.filter(fact => fact.position !== visible.position);
  assert.equal(explain(wu, dayOnly).matched, false);
});

test('the water passages require their actual month and hour stems', () => {
  const ren = 'qtbj-v6-c106-p004-401';
  const text = '或比见月时，年见丁火，平常之辈';
  const facts = chartFacts.bazi(witness(ren, text));
  assert.deepEqual(explain(ren, facts).matchedBranches.map(branch => branch.text), [text]);
  assert.equal(explain(ren, facts, false).matched, false);

  const gui = 'qtbj-v6-c109-p003-301';
  assert.equal(explain(gui, chartFacts.bazi(witness(gui))).matched, true);
  const woodOnlyInBranches = describeBaZiPillars({ year: '丁未', month: '癸卯', day: '癸亥', hour: '癸丑' });
  assert.equal(explain(gui, chartFacts.bazi(woodOnlyInBranches)).matched, false);
});
