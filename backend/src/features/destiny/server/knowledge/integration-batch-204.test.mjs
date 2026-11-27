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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-pillar-groups-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const samples = [
  ['3-c022-p002-001', '1930-01-01T04:15Z', 'female'],
  ['3-c022-p002-002', '1930-01-01T00:15Z', 'female'],
  ['3-c087-p003-001', '1930-01-08T00:15Z', 'male'],
  ['3-c087-p003-002', '1930-01-22T00:15Z', 'male'],
  ['3-c105-p002-002', '1930-08-22T16:15Z', 'male'],
  ['3-c105-p002-002', '1945-11-01T00:15Z', 'male', 0, 1],
  ['3-c105-p005-001', '1930-03-08T20:15Z', 'male'],
  ['3-c146-p001-001', '1930-12-08T00:15Z', 'male'],
  ['3-c146-p001-002', '1930-12-07T20:15Z', 'male', 0, 0, 0],
  ['3-c146-p001-002', '1930-01-20T16:15Z', 'male', 0, 0, 1],
  ['3-c146-p001-002', '1930-01-01T04:15Z', 'male', 0, 0, 2],
  ['3-c146-p002-101', '1930-01-01T00:15Z', 'male'],
  ['4-c081-p012-001', '1930-03-15T10:15Z', 'male'],
  ['4-c081-p012-001', '1930-03-15T10:15Z', 'female', 1],
];
const idFor = record => 'yhzp-v' + record;
const splitMonthClash = '3-c146-p001-002';
const sampleFor = record => samples.find(([candidate]) => record === candidate);

function native([, birthTime, gender]) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000, gender);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: gender === 'female' ? '女' : '男' }];
}

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

function explain(record, facts, timeKnown) {
  return explainClaim(idFor(record), 'bazi', request(facts, timeKnown).plain, undefined, catalog);
}

test('ten sources match through real BaZi charts, SQLite and report materials', () => {
  const expected = new Set(), proved = new Set();
  for (const record of new Set(samples.map(([record]) => record))) {
    const row = catalog.get(idFor(record));
    (row.inputs ? [row] : row.branches).forEach(({ inputs }, branch) => {
      if (record === splitMonthClash && branch !== 0) return;
      inputs.forEach((input, group) => (record === splitMonthClash ? input.anyOf : [null])
        .forEach((_, alternative) => expected.add(JSON.stringify([record, branch, group, alternative]))));
    });
    const otherEdition = structuredClone(row.claim);
    otherEdition.source.edition = '另一本';
    assert.equal(compileYuanhaiNatalPassages(otherEdition).reason, 'source_review_required', record);
  }
  assert.equal(expected.size, 14);

  for (const sample of samples) {
    const [record, , , branch = 0, group = 0, alternative = 0] = sample, id = idFor(record);
    const row = catalog.get(id), passage = row.inputs ? row : row.branches[branch];
    const input = passage.inputs[group];
    const condition = record === splitMonthClash ? { ...input, anyOf: [input.anyOf[alternative]] } : input;
    const { queries, plain } = request(native(sample));
    assert.ok(evaluateRule(condition, 'natal', claimChartContext('bazi', plain)).matched, JSON.stringify(sample));
    const detail = explainClaim(id, 'bazi', plain, undefined, catalog);
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(detail.matched && hit, record);
    const original = row.claim.evidence.original_text;
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(passage.text ?? original), record);
    if (passage.text) {
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, record);
      assert.deepEqual(detail.matchedBranches.map(({ text }) => text), [passage.text], record);
      assert.ok(!materials.includes(original), record);
    }
    if (record === '3-c087-p003-002') assert.match(materials, /作劫财核对/u);
    proved.add(JSON.stringify([record, branch, group, alternative]));
  }
  assert.deepEqual(proved, expected);
});

test('reversing the pillar groups or supplying a derived configuration does not fulfill a passage', () => {
  const earlyLoss = native(sampleFor('3-c087-p003-001'));
  const lateLoss = native(sampleFor('3-c087-p003-002'));
  assert.equal(explain('3-c087-p003-001', lateLoss).matched, false);
  assert.equal(explain('3-c087-p003-002', earlyLoss).matched, false);
  const fakeGroups = catalog.get(idFor('3-c087-p003-002')).inputs[0].required;
  assert.equal(explain('3-c087-p003-002', [...earlyLoss, ...fakeGroups]).matched, false);
  const wrongMonth = native(['', '1930-08-22T14:15Z', 'male']);
  const fakeDayWealth = catalog.get(idFor('3-c105-p002-002')).inputs[0].required;
  assert.equal(explain('3-c105-p002-002', [...wrongMonth, ...fakeDayWealth]).matched, false);
});

test('hidden wealth, unknown time and missing sex retain their own boundaries', () => {
  const record = '3-c105-p005-001';
  const withHiddenWealth = native(['', '1930-01-01T10:15Z', 'male']);
  assert.ok(withHiddenWealth.some(fact => fact.kind === 'hidden_ten_god' && ['正财', '偏财'].includes(fact.tenGod)));
  assert.ok(withHiddenWealth.every(fact => fact.kind !== 'stem_ten_god' || !['正财', '偏财'].includes(fact.tenGod)));
  assert.equal(explain(record, withHiddenWealth).matched, false);
  assert.equal(explain(record, native(sampleFor(record)), false).matched, false);
  for (const restricted of ['3-c022-p002-001', '3-c146-p001-001', '4-c081-p012-001']) {
    const raw = native(sampleFor(restricted));
    assert.equal(explain(restricted, raw.filter(fact => fact.kind !== 'natal_gender')).matched, false, restricted);
  }
});
