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
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-194-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-seasonal-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function nativeQueries(birthTime, timeKnown = true, pillars) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000);
  const { year, month, day, hour } = chart;
  if (pillars) assert.deepEqual({ year, month, day, hour }, pillars);
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: chartFacts.bazi(chart) }], { timeKnown });
  assert.ok(queries);
  return queries;
}

function context([query]) {
  return chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
}

test('all seven source records reach SQLite, explanations and report materials from nine native charts', () => {
  const ids = new Set(witnesses.map(item => item.id));
  assert.equal(ids.size, 7);
  assert.equal(witnesses.length, 9);
  let groupCount = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    groupCount += row.inputs?.length ?? row.branches.reduce((total, branch) => total + branch.inputs.length, 0);
  }
  assert.equal(groupCount, witnesses.length);

  for (const { id, birthTime, pillars, text } of witnesses) {
    const queries = nativeQueries(birthTime, true, pillars), plain = context(queries);
    const row = catalog.get(id);
    const groups = text ? row.branches.find(branch => branch.text === text)?.inputs : row.inputs;
    assert.equal(groups?.length, 1, id);
    assert.ok(evaluateRule(groups[0], 'natal', claimChartContext('bazi', plain)).matched, id);
    const detail = explainClaim(id, 'bazi', plain, undefined, catalog);
    assert.ok(detail.matched, id);
    assert.equal(explainClaim(id, 'bazi', context(nativeQueries(birthTime, false)), undefined, catalog).matched, false, id);

    const refs = lookup(queries);
    const hit = refs.flatMap(topic => [...topic.personality, ...topic.events]).find(item => item.id === id);
    assert.ok(hit, id);
    const original = row.claim.evidence.original_text, materials = buildReportMaterials(refs);
    assert.ok(materials.includes(text ?? original), id);
    if (text) {
      assert.equal(row.inputs, undefined, id);
      assert.deepEqual(detail.matchedBranches.map(branch => branch.text), [text], id);
      assert.deepEqual(hit.matchedBranches.map(branch => branch.text), [text], id);
      assert.ok(!materials.includes(original), id);
    }
  }
});

test('Ren in the Mao month needs the native blade in addition to a visibly repeated day stem', () => {
  const id = 'qtbj-v6-c097-p004-401';
  const [input] = catalog.get(id).branches[0].inputs;
  const counterexamples = [
    ['1904-03-08T20:20:00.000Z', { year: '甲辰', month: '丁卯', day: '壬寅', hour: '壬寅' }, 'shen_sha'],
    ['1904-03-19T02:20:00.000Z', { year: '甲辰', month: '丁卯', day: '壬子', hour: '乙巳' }, 'bazi_stem_placement_count'],
  ];
  for (const [birthTime, pillars, missingKind] of counterexamples) {
    const plain = context(nativeQueries(birthTime, true, pillars));
    const simplified = { ...input, anyOf: input.anyOf.map(group => group.filter(fact => fact.kind !== missingKind
      || missingKind === 'bazi_stem_placement_count' && fact.stem !== '壬')) };
    assert.ok(evaluateRule(simplified, 'natal', claimChartContext('bazi', plain)).matched, missingKind);
    assert.equal(explainClaim(id, 'bazi', plain, undefined, catalog).matched, false, missingKind);
  }
});
