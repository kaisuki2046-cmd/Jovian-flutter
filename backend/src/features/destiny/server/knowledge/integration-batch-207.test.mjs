import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileYuanhaiNatalPassages } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-void-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const wealth = 'yhzp-v2-c244-p002-002';
const monthClash = 'yhzp-v3-c146-p001-002';
const officer = 'yhzp-v4-c002-p014-001';
const dayWidow = 'yhzp-v4-c040-p006-002';
const clashLine = '如遇冲破提綱，定主離於祖業。';
const voidLine = '再見空亡，三番四廢。';

function native(birthTime, gender = 'male') {
  const time = Date.parse(birthTime);
  const chart = calculateBaZi(time, time + 8 * 3_600_000, gender);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: gender === 'female' ? '女' : '男' }];
}

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  const plain = chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
  return { plain, queries };
}

function explain(id, facts, timeKnown) {
  return explainClaim(id, 'bazi', request(facts, timeKnown).plain, undefined, catalog);
}

test('four original records expose the verified void passages through SQLite and report materials', () => {
  const samples = [
    [wealth, '1930-01-07T16:15Z', 0, 0],
    [wealth, '1930-01-01T20:15Z', 0, 1],
    [monthClash, '1930-12-29T16:15Z', 1, 0],
    [monthClash, '1930-01-08T16:15Z', 1, 1],
    [monthClash, '1930-01-04T04:15Z', 1, 2],
    [officer, '1930-01-11T16:15Z', 0, 0],
    [officer, '1930-01-12T22:15Z', 0, 1],
    [dayWidow, '1944-03-08T00:15Z', 0, 0],
  ];
  const ids = new Set(samples.map(([id]) => id));
  const inventory = catalog.inventory().filter(({ claim }) => ids.has(claim.id));
  assert.equal(inventory.length, ids.size);
  assert.ok(inventory.every(({ lookup }) => lookup.status === 'branch_indexed'));
  for (const id of ids) {
    const row = catalog.get(id);
    const editedSource = structuredClone(row.claim);
    editedSource.evidence.original_text += '异本';
    assert.equal(compileYuanhaiNatalPassages(editedSource).reason, 'source_review_required', id);
  }

  for (const [id, time, branch, choice] of samples) {
    const passage = catalog.get(id).branches[branch];
    const [group] = passage.inputs;
    const condition = group.anyOf.length ? { ...group, anyOf: [group.anyOf[choice]] } : passage.inputs[choice];
    const { queries, plain } = request(native(time));
    assert.ok(evaluateRule(condition, 'natal', claimChartContext('bazi', plain)).matched, time);
    const detail = explainClaim(id, 'bazi', plain, undefined, catalog);
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(detail.matched && hit, time);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, time);
    const lines = id === monthClash ? [clashLine, voidLine] : [passage.text];
    assert.deepEqual(hit.matchedBranches.map(({ text }) => text), lines, time);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    for (const { text, modernInterpretation } of hit.matchedBranches) {
      assert.ok(materials.includes(`原文/依据：${text}\n现代解读：${modernInterpretation}\n`), time);
    }
    assert.match(materials, /计算口径：.*空亡/u);
  }
});

test('separate placements, missing birth time and submitted void flags cannot satisfy the passages', () => {
  const separate = native('1930-01-01T00:15Z');
  assert.equal(explain(wealth, [...separate, { kind: 'bazi_natal_configuration', name: '支藏偏财落空亡' }]).matched, false);
  assert.equal(explain(dayWidow, [...separate, { kind: 'shen_sha', name: '寡宿', position: 'day' }]).matched, false);
  assert.equal(explain(dayWidow, native('1944-03-08T00:15Z', 'female')).matched, false);

  const firstOnly = native('1930-01-01T04:15Z');
  const forgedVoid = { kind: 'shen_sha', name: '空亡', position: 'month' };
  assert.deepEqual(explain(monthClash, [...firstOnly, forgedVoid]).matchedBranches.map(({ text }) => text), [clashLine]);
  assert.equal(explain(monthClash, native('1930-01-03T16:15Z')).matched, false);
  assert.equal(explain(monthClash, native('1930-01-04T04:15Z'), false).matched, false);
  assert.equal(explain(officer, [...native('1930-02-02T08:15Z'), forgedVoid]).matched, false);
});
