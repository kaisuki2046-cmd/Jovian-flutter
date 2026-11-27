import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-76-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const offset = 8 * 3600000;
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
const witness = (id, text) => fixture.witnesses.find(row =>
  row.proofs.some(proof => proof.id === id && (text === undefined || proof.text === text)));

function queries(confirmedFacts, timeKnown = true) {
  const result = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(result);
  return result;
}

const context = ([query]) => chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'bazi', context(queries(facts, timeKnown)), undefined, catalog);

function nativeChart({ birthTime }) {
  const instant = Date.parse(birthTime);
  return calculateBaZi(instant, instant + offset);
}

test('reviewed seasonal conditions reach SQLite, explanation and report materials from calculated pillars', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  const expected = new Map();
  let whole = 0, passages = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    passages += row.branches.length;
    for (const { text, inputs, conditionCompiler } of row.inputs
      ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, qtbjSeasonalPassageProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.equal(ids.size, fixture.records);
  assert.equal(whole, fixture.whole);
  assert.equal(passages, fixture.passages);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set(), inRange = new Set();
  for (const sample of fixture.witnesses) {
    const native = nativeChart(sample);
    const { year, month, day, hour } = native;
    assert.deepEqual({ year, month, day, hour }, sample.pillars);
    const parsed = queries(chartFacts.bazi(native)), chart = context(parsed), derived = claimChartContext('bazi', chart);
    const references = lookup(parsed), matched = hits(references), materials = buildReportMaterials(references);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matched.find(row => row.id === id), detail = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
      if (Date.parse(sample.birthTime) + offset >= Date.UTC(1900, 0, 1)) inRange.add(proofKey);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.equal(inRange.size, fixture.inBirthDateRange);
});

test('visible and concealed Ding passages stay separate and visible Gui blocks both', () => {
  const id = 'qtbj-v6-c102-p001-101';
  for (const text of ['戊丁俱透，科甲生员', '戊透天干，丁藏午戌，恩封可待']) {
    const facts = chartFacts.bazi(nativeChart(witness(id, text)));
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explain(id, facts, false).matched, false);
  }
  const guiExposed = describeBaZiPillars({ year: '丁酉', month: '戊申', day: '壬辰', hour: '癸卯' });
  assert.equal(explain(id, chartFacts.bazi(guiExposed)).matched, false);
});

test('winter Wu requires Xin in the year or month and does not borrow it from the hour', () => {
  const id = 'qtbj-v4-c055-p006-301';
  const facts = chartFacts.bazi(nativeChart(witness(id)));
  assert.equal(explain(id, facts).matched, true);
  const onlyHour = describeBaZiPillars({ year: '甲子', month: '丙子', day: '戊辰', hour: '辛酉' });
  assert.equal(explain(id, chartFacts.bazi(onlyHour)).matched, false);
});
