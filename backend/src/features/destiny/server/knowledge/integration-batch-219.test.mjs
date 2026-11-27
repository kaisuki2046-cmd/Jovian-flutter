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
import { compileQuanshuPalaceText } from './ziwei-source-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-siblings-career-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['c003-p101011-001', 0, 0, 0, [1940, 2, 13, 0]],
  ['c003-p101011-002', 0, 0, 0, [1940, 2, 9, 4]],
  ['c003-p101011-002', 0, 1, 0, [1940, 2, 8, 6]],
  ['c003-p101011-002', 0, 2, 0, [1940, 3, 9, 0]],
  ['c003-p101011-002', 0, 3, 0, [1940, 3, 22, 2]],
  ['c003-p101014-002', 0, 0, 0, [1940, 2, 15, 4]],
  ['c003-p101014-002', 0, 1, 0, [1940, 5, 7, 1]],
  ['c003-p101014-002', 0, 2, 0, [1940, 9, 2, 5]],
  ['c003-p101015-003', 0, 0, 0, [1948, 11, 1, 0]],
  ['c003-p101018-002', 0, 0, 0, [1940, 3, 9, 6]],
  ['c003-p101018-002', 0, 1, 0, [1940, 7, 5, 10]],
  ['c003-p101019-001', 0, 0, 0, [1941, 1, 27, 3]],
  ['c003-p101019-001', 1, 0, 0, [1940, 2, 8, 6]],
  ['c003-p101019-002', 0, 0, 0, [1943, 3, 6, 1]],
  ['c003-p101019-002', 1, 0, 0, [1940, 5, 7, 9]],
  ['c003-p101019-003', 0, 0, 0, [1940, 2, 8, 4]],
  ['c003-p101019-003', 1, 0, 0, [1941, 1, 27, 5]],
  ['c003-p101020-002', 0, 0, 0, [1940, 3, 11, 0]],
  ['guanlugong-p004-002', 0, 0, 0, [1944, 1, 30, 5]],
  ['guanlugong-p101017-005', 0, 0, 0, [1940, 2, 9, 3]],
  ['guanlugong-p101018-001', 0, 0, 0, [1941, 6, 5, 5]],
  ['guanlugong-p101020-003', 0, 0, 0, [1954, 6, 30, 2]],
  ['guanlugong-p111001-001', 0, 0, 0, [1940, 2, 13, 3]],
  ['guanlugong-p111001-002', 0, 0, 0, [1940, 5, 12, 2]],
  ['guanlugong-p111001-003', 0, 0, 0, [1940, 6, 6, 9]],
  ['guanlugong-p111001-005', 0, 0, 0, [1949, 11, 22, 2]],
  ['guanlugong-p111001-005', 0, 0, 1, [1941, 11, 23, 2]],
  ['guanlugong-p111001-005', 0, 0, 2, [1946, 10, 29, 2]],
  ['guanlugong-p111001-006', 0, 0, 0, [1943, 6, 3, 9]],
  ['guanlugong-p111001-006', 0, 1, 0, [1940, 6, 6, 3]],
];

const sourceId = suffix => 'ziwei-v2-' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];
const originalFacts = ([year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts, chartScope }] = queries;
  return { queries, chart: chartContext('ziwei', present, confirmedAbsentFacts, chartScope) };
}

test('18 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
  const inventory = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const expected = new Set(), verified = new Set(), dates = new Map();
  let inputCount = 0;
  for (const id of sourceIds) {
    assert.equal(inventory.get(id), 'branch_indexed', id);
    const { claim, branches } = catalog.get(id);
    branches.forEach(({ inputs }, branch) => {
      inputCount += inputs.length;
      inputs.forEach(({ anyOf }, group) => (anyOf.length ? anyOf : [null]).forEach((_, choice) =>
        expected.add([id, branch, group, choice].join('/'))));
    });
    const changed = structuredClone(claim);
    changed.evidence.context = '异本';
    assert.equal(compileQuanshuPalaceText(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [18, 28, 30]);

  for (const [suffix, excerpt, group, choice, birth] of witnesses) {
    const id = sourceId(suffix), key = birth.join('/');
    if (!dates.has(key)) {
      const { queries, chart } = request(originalFacts(birth));
      const hits = new Map(lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(hit => [hit.id, hit]));
      dates.set(key, { chart, facts: claimChartContext('ziwei', chart), hits });
    }
    const { chart, facts, hits } = dates.get(key);
    const { text, inputs } = catalog.get(id).branches[excerpt];
    const input = inputs[group];
    const single = input.anyOf.length ? { ...input, anyOf: [input.anyOf[choice]] } : input;
    const label = [id, excerpt, group, choice].join('/');
    assert.ok(evaluateRule(single, 'natal', facts).matched, label);
    const detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
    const hit = hits.get(id);
    assert.ok(hit && detail.matched, label);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, label);
    const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(material.includes('原文/依据：' + text + '\n'), label);
    assert.doesNotMatch(material, /现代释义：/u);
    verified.add(label);
  }
  assert.equal(dates.size, 29);
  assert.deepEqual(verified, expected);
});

test('all three natal transformations and genuine trine placement must be established', () => {
  const rows = [
    ['guanlugong-p004-002', fact => (fact.kind === 'palace_mutagen' || fact.kind === 'star_mutagen')
      && fact.change === '科', { kind: 'palace_sector_mutagen', palace: '官禄', change: '科' }],
    ['guanlugong-p111001-005', fact => fact.kind === 'palace_star' && fact.star === '空亡',
      { kind: 'palace_star', palace: '夫妻', star: '空亡', scope: 'origin' }],
    ['c003-p101011-001', fact => fact.kind === 'palace_origin_star_count' && fact.palace === '兄弟'],
  ];
  for (const [suffix, omitted, replacement] of rows) {
    const birth = witnesses.find(([id]) => id === suffix).at(-1);
    const native = originalFacts(birth);
    assert.ok(native.some(omitted), suffix);
    const changed = native.filter(fact => !omitted(fact));
    if (replacement) changed.push(replacement);
    const { chart } = request(changed);
    assert.equal(explainClaim(sourceId(suffix), 'ziwei', chart, undefined, catalog).matched, false, suffix);
  }
});

test('copy variants are annotated in matches or held out when they reverse the condition', () => {
  const variantBirth = witnesses.find(([id]) => id === 'c003-p101019-001').at(-1);
  const { queries, chart } = request(originalFacts(variantBirth));
  const hits = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]);
  const sheep = hits.find(hit => hit.id === sourceId('c003-p101019-001'));
  assert.ok(sheep);
  const material = buildReportMaterials([{ topic: sheep.topic, personality: [], events: [sheep] }]);
  assert.match(material, /原文\/依据：羊玲克害入庙一人/u);
  assert.match(material, /「羊玲」处作「羊陀」/u);
  const disputed = sourceId('guanlugong-p101002-003');
  const result = explainClaim(disputed, 'ziwei', chart, undefined, catalog);
  assert.equal(result.reason, 'source_review_required');
  assert.match(result.reviewNote, /不見羊陀火鈴/u);
  assert.ok(!hits.some(hit => hit.id === disputed));
});
