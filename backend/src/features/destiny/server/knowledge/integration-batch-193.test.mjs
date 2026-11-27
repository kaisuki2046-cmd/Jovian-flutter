import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjMetalWater } from './qtbj-metal-water-passages.mjs';
import { compileQtbjWoodFireEarth } from './qtbj-wood-fire-earth-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-193-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-counted-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function replay({ birthTime, pillars }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000);
  const { year, month, day, hour } = chart;
  assert.deepEqual({ year, month, day, hour }, pillars);
  return chartFacts.bazi(chart);
}

function parse(facts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: facts }], { timeKnown });
  assert.ok(queries);
  return queries;
}

function context([query]) {
  return chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
}

test('all twelve counted passages replay from native pillars through SQLite and report materials', () => {
  assert.equal(witnesses.length, 12);
  assert.equal(witnesses.filter(row => row.text).length, 5);
  for (const witness of witnesses) {
    const { id, text } = witness, facts = replay(witness), queries = parse(facts);
    const row = catalog.get(id);
    const groups = text ? row.branches.find(branch => branch.text === text)?.inputs : row.inputs;
    assert.equal(groups?.length, 1, id);
    if (text) assert.equal(row.inputs, undefined, id);
    assert.ok(evaluateRule(groups[0], 'natal', claimChartContext('bazi', context(queries))).matched, id);
    const detail = explainClaim(id, 'bazi', context(queries), undefined, catalog);
    assert.ok(detail.matched, id);
    assert.equal(explainClaim(id, 'bazi', context(parse(facts, false)), undefined, catalog).matched, false, id);
    const refs = lookup(queries);
    const hit = refs.flatMap(topic => [...topic.personality, ...topic.events]).find(item => item.id === id);
    assert.ok(hit, id);
    const materials = buildReportMaterials(refs);
    assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
    if (text) {
      assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      assert.ok(!materials.includes(row.claim.evidence.original_text), id);
    }
    const edited = structuredClone(row.claim);
    edited.evidence.context = '另一版本';
    const compile = id.startsWith('qtbj-v4-') ? compileQtbjWoodFireEarth : compileQtbjMetalWater;
    assert.equal(compile(edited).reason, 'source_review_required', id);
  }
});

test('visible and hidden counts stay distinct in three native charts', () => {
  for (const [suffix, stem, visible, hidden] of [
    ['v5-c072-p004-301', '丁', 2, 2],
    ['v6-c102-p003-101', '庚', 0, 2],
    ['v6-c103-p002-301', '戊', 0, 2],
  ]) {
    const facts = replay(witnesses.find(row => row.id === 'qtbj-' + suffix));
    const derived = claimChartContext('bazi', context(parse(facts)));
    const count = placement => derived.present.find(fact => fact.kind === 'bazi_stem_placement_count'
      && fact.stem === stem && fact.placement === placement)?.count;
    assert.deepEqual([count('visible'), count('hidden')], [visible, hidden], suffix);
  }
});

test('a nearby Geng day with Bing and Ren exposed still requires all three fire branches', () => {
  const id = 'qtbj-v5-c069-p005-401';
  const instant = Date.parse('1902-04-27T12:20:00.000Z');
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000);
  assert.deepEqual([chart.year, chart.month, chart.day, chart.hour], ['壬寅', '甲辰', '庚辰', '丙戌']);
  const queries = parse(chartFacts.bazi(chart));
  assert.equal(explainClaim(id, 'bazi', context(queries), undefined, catalog).matched, false);
});
