import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileJielanPalacePassages } from './ziwei-source-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-health-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Source suffix, excerpt index, input index, alternative index, local solar birth and hour index.
const witnesses = [
  ['p012-017', 0, 0, 0, [1940, 2, 8, 2, '男']],
  ['p012-017', 1, 0, 0, [1940, 2, 8, 2]],
  ['p012-017', 2, 0, 0, [1952, 12, 21, 6, '男']],
  ['p015-001', 0, 0, 0, [1940, 2, 10, 2]],
  ['p015-001', 1, 0, 0, [1940, 5, 18, 9]],
  ['p015-002', 0, 0, 0, [1940, 2, 8, 1]],
  ['p015-002', 1, 0, 0, [1940, 5, 7, 11]],
  ['p015-002', 2, 0, 0, [1940, 2, 8, 5]],
  ['p015-003', 0, 0, 0, [1940, 2, 9, 1]],
  ['p015-003', 1, 0, 0, [1940, 2, 9, 8]],
  ['p015-003', 2, 0, 0, [1940, 2, 10, 11]],
  ['p015-003', 3, 0, 0, [1940, 2, 23, 4]],
  ['p015-004', 0, 0, 0, [1940, 2, 12, 9]],
  ['p015-004', 0, 0, 1, [1940, 2, 8, 3]],
  ['p015-004', 0, 0, 2, [1940, 3, 9, 4]],
  ['p015-004', 0, 0, 3, [1940, 3, 9, 11]],
  ['p015-004', 0, 0, 4, [1940, 2, 9, 8]],
  ['p015-004', 0, 0, 5, [1940, 2, 8, 10]],
  ['p015-005', 0, 0, 0, [1940, 2, 8, 1]],
  ['p015-005', 1, 0, 0, [1940, 5, 20, 5]],
  ['p015-006', 0, 0, 0, [1940, 2, 8, 8]],
  ['p015-007', 0, 0, 0, [1940, 2, 23, 5]],
  ['p015-007', 0, 0, 1, [1940, 2, 17, 11]],
  ['p015-007', 0, 0, 2, [1940, 3, 10, 4]],
  ['p015-007', 0, 0, 3, [1940, 3, 15, 9]],
  ['p015-007', 0, 0, 4, [1940, 2, 14, 8]],
  ['p015-007', 0, 0, 5, [1940, 2, 16, 2]],
  ['p015-009', 0, 0, 0, [1940, 6, 9, 5]],
  ['p015-009', 0, 0, 1, [1940, 4, 11, 3]],
  ['p015-009', 0, 0, 2, [1940, 3, 12, 2]],
  ['p015-009', 0, 0, 3, [1940, 5, 10, 4]],
  ['p015-009', 0, 0, 4, [1941, 2, 21, 7]],
  ['p015-010', 0, 0, 0, [1940, 2, 9, 5]],
  ['p015-010', 1, 0, 0, [1940, 2, 11, 4]],
  ['p015-010', 2, 0, 0, [1940, 3, 15, 4]],
  ['p015-010', 2, 0, 1, [1940, 5, 20, 1]],
  ['p015-011', 0, 0, 0, [1940, 2, 9, 0]],
  ['p015-012', 0, 0, 0, [1940, 5, 12, 9]],
  ['p015-013', 0, 0, 0, [1940, 2, 19, 6]],
  ['p015-014', 0, 0, 0, [1940, 2, 9, 11]],
  ['p015-014', 1, 0, 0, [1940, 3, 18, 4]],
  ['p015-014', 1, 0, 1, [1940, 6, 1, 1]],
  ['p015-020', 0, 0, 0, [1940, 5, 18, 9]],
  ['p015-021', 0, 0, 0, [1940, 5, 7, 11]],
  ['p015-023', 0, 0, 0, [1940, 2, 9, 8]],
  ['p015-025', 0, 0, 0, [1940, 2, 23, 4]],
  ['p015-026', 0, 0, 0, [1940, 5, 7, 11]],
  ['p016-016', 0, 0, 0, [1940, 2, 8, 4]],
  ['p020-004', 0, 0, 0, [1940, 2, 11, 3]],
  ['p020-004', 0, 1, 0, [1940, 2, 13, 2]],
  ['p020-014', 0, 0, 0, [1940, 2, 8, 0]],
  ['p020-015', 0, 0, 0, [1940, 2, 12, 4]],
  ['p020-015', 1, 0, 0, [1940, 2, 10, 1]],
  ['p020-022', 0, 0, 0, [1940, 9, 2, 0]],
];

const sourceId = suffix => 'ziwei-v2-jielan-101-' + suffix;
const originalFacts = ([year, month, day, hour, gender = '女']) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: gender === '女' ? 'female' : 'male' }, hour));

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, chart: chartContext('ziwei', present, absent, chartScope) };
}

function chartMatches(queries) {
  return new Map(lookup(queries).flatMap(({ personality, events }) => [...personality, ...events].map(hit => [hit.id, hit])));
}

function explanations(suffix, facts, timeKnown = true) {
  return explainClaim(sourceId(suffix), 'ziwei', request(facts, timeKnown).chart, undefined, catalog);
}

function materialFor(...events) {
  return buildReportMaterials([{ topic: events[0].topic, personality: [], events }]);
}

test('the reviewed records and all their alternatives reach SQLite and the report on native charts', () => {
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];
  const expected = new Set(), verified = new Set(), dates = new Map();
  let inputCount = 0;
  for (const id of sourceIds) {
    assert.equal(inventory.get(id), 'branch_indexed', id);
    const { claim, branches } = catalog.get(id);
    branches.forEach(({ inputs }, excerpt) => {
      inputCount += inputs.length;
      inputs.forEach(({ anyOf }, group) => (anyOf.length ? anyOf : [null]).forEach((_, choice) =>
        expected.add([id, excerpt, group, choice].join('/'))));
    });
    const changed = structuredClone(claim);
    changed.evidence.context = '异本';
    assert.equal(compileJielanPalacePassages(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [24, 38, 54]);

  for (const [suffix, excerpt, group, choice, birth] of witnesses) {
    const id = sourceId(suffix), key = birth.join('/');
    if (!dates.has(key)) {
      const { queries, chart } = request(originalFacts(birth));
      dates.set(key, { chart, hits: chartMatches(queries), facts: claimChartContext('ziwei', chart) });
    }
    const { chart, hits, facts } = dates.get(key);
    const { text, inputs } = catalog.get(id).branches[excerpt];
    const input = inputs[group];
    const alternative = input.anyOf.length ? { ...input, anyOf: [input.anyOf[choice]] } : input;
    const label = [id, excerpt, group, choice].join('/');
    assert.ok(evaluateRule(alternative, 'natal', facts).matched, label);
    const hit = hits.get(id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
    assert.ok(hit && detail.matched, label);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, label);
    assert.ok(hit.claim.evidence.original_text.includes(text), label);
    const materials = materialFor(hit);
    const matched = hit.matchedBranches.find(branch => branch.text === text);
    assert.ok(materials.includes(`原文/依据：${text}\n现代解读：${matched.modernInterpretation}`), label);
    verified.add(label);
  }
  assert.equal(dates.size, 47);
  assert.deepEqual(verified, expected);
});

test('incomplete sector lists and unknown birth hours cannot prove a malefic count', () => {
  const observed = originalFacts([1940, 5, 7, 11]);
  const id = 'p015-021';
  assert.ok(explanations(id, observed).matched);
  const incomplete = observed.filter(({ kind, palace }) => kind !== 'palace_origin_star_count' || palace !== '疾厄');
  const claimedCount = { kind: 'palace_sector_malefic_count', palace: '疾厄', count: 4 };
  assert.equal(explanations(id, [...incomplete, claimedCount]).matched, false);
  assert.equal(explanations(id, observed, false).matched, false);
  assert.equal(chartMatches(request(observed, false).queries).has(sourceId(id)), false);
});

test('the Si-palace exception needs female natal scope and both stars in the same position', () => {
  const female = originalFacts([1940, 2, 23, 4]);
  const male = originalFacts([1940, 2, 23, 4, '男']);
  const id = 'p015-025';
  assert.ok(explanations(id, female).matched);
  assert.equal(explanations(id, male).matched, false);
  const moved = female.map(fact => fact.kind === 'palace_star' && fact.palace === '疾厄' && fact.star === '武曲'
    ? { ...fact, palace: '迁移' } : fact);
  assert.equal(explanations(id, moved).matched, false);
});

test('duplicate passages keep independent matches and appear once in report material', () => {
  for (const [primary, duplicate, sentence, birth] of [
    ['p012-017', 'p012-030', '加四杀遇昌，主离', [1952, 12, 21, 6, '男']],
    ['p015-001', 'p015-020', '加七杀四杀，痔疾风疮', [1940, 5, 18, 9]],
    ['p015-002', 'p015-021', '加四杀，寒热气疾', [1940, 5, 7, 11]],
    ['p015-003', 'p015-023', '会贪贞，腰足疾', [1940, 2, 9, 8]],
    ['p015-003', 'p015-025', '女人会武曲巳宫，气蛊疾', [1940, 2, 23, 4]],
  ]) {
    const byId = chartMatches(request(originalFacts(birth)).queries);
    const hits = [byId.get(sourceId(primary)), byId.get(sourceId(duplicate))];
    assert.ok(hits.every(Boolean), duplicate);
    const combined = materialFor(...hits);
    const raw = `原文/依据：${sentence}\n`;
    assert.equal(combined.split(raw).length - 1, 1, duplicate);
    assert.equal(materialFor(hits[1]).split(raw).length - 1, 1, duplicate);
    for (const hit of hits) {
      const branch = hit.matchedBranches.find(branch => branch.text === sentence);
      assert.ok(combined.includes(`现代解读：${branch.modernInterpretation}\n`), duplicate);
    }
    const sourceBoundary = primary.startsWith('p015-') ? /健康与诊疗以专业医学评估为准/u : /报告只讨论相处主题/u;
    assert.match(combined, sourceBoundary);
  }
});
