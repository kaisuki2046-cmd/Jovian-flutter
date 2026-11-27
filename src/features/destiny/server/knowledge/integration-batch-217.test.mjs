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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-spouse-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['p003-003', 0, 0, 0, [1940, 2, 17, 9]],
  ['p003-003', 0, 1, 0, [1940, 2, 23, 6]],
  ['p006-002', 0, 0, 0, [1940, 2, 15, 0]],
  ['p006-003', 0, 0, 0, [1940, 2, 25, 9]],
  ['p006-004', 0, 0, 0, [1940, 2, 8, 11]],
  ['p009-002', 0, 0, 0, [1940, 4, 10, 1]],
  ['p101001-003', 0, 0, 0, [1940, 2, 11, 11]],
  ['p101001-004', 0, 0, 0, [1940, 3, 24, 4]],
  ['p101001-004', 0, 0, 1, [1940, 3, 24, 4]],
  ['p101001-004', 0, 0, 2, [1940, 4, 23, 5]],
  ['p101001-004', 0, 0, 3, [1940, 4, 23, 5]],
  ['p101001-004', 0, 0, 4, [1940, 2, 23, 3]],
  ['p101001-004', 0, 0, 5, [1940, 2, 15, 9]],
  ['p101002-001', 0, 0, 0, [1940, 2, 11, 0]],
  ['p101002-002', 0, 0, 0, [1940, 2, 9, 9]],
  ['p101003-001', 0, 0, 0, [1940, 5, 16, 0]],
  ['p101005-001', 0, 0, 0, [1940, 2, 10, 0]],
  ['p101005-002', 0, 0, 0, [1940, 2, 10, 0]],
  ['p101005-002', 0, 0, 1, [1940, 2, 13, 2]],
  ['p101005-002', 0, 0, 2, [1940, 4, 17, 0]],
  ['p101005-002', 0, 0, 3, [1940, 2, 10, 0]],
  ['p101005-002', 0, 0, 4, [1940, 2, 11, 3]],
  ['p101005-002', 0, 0, 5, [1940, 2, 19, 1]],
  ['p101005-005', 0, 0, 0, [1940, 2, 11, 3]],
  ['p101005-006', 0, 0, 0, [1951, 1, 21, 8]],
  ['p101007-004', 0, 0, 0, [1940, 2, 23, 11]],
  ['p101007-005', 0, 0, 0, [1940, 2, 9, 2]],
  ['p101009-002', 0, 0, 0, [1940, 2, 15, 0]],
  ['p101009-003', 0, 0, 0, [1940, 2, 15, 10]],
  ['p101009-003', 0, 1, 0, [1940, 2, 23, 4]],
  ['p101010-001', 0, 0, 0, [1940, 2, 8, 0]],
  ['p101010-002', 0, 0, 0, [1940, 2, 21, 2]],
  ['p101010-004', 0, 0, 0, [1942, 3, 18, 9]],
  ['p101011-001', 0, 0, 0, [1940, 2, 13, 0]],
  ['p101011-004', 0, 0, 0, [1940, 2, 29, 5]],
  ['p101011-005', 0, 0, 0, [1950, 9, 12, 6]],
  ['p101012-001', 0, 0, 0, [1940, 2, 18, 0]],
  ['p101012-004', 0, 0, 0, [1940, 2, 18, 0]],
  ['p101012-005', 0, 0, 0, [1942, 7, 17, 11]],
  ['p101013-001', 0, 0, 0, [1940, 2, 23, 0]],
  ['p101013-003', 0, 0, 0, [1940, 2, 10, 2]],
  ['p101013-004', 0, 0, 0, [1942, 7, 22, 11]],
  ['p101014-005', 0, 0, 0, [1950, 9, 27, 6]],
  ['p101015-004', 0, 0, 0, [1940, 2, 19, 5]],
  ['p101016-001', 0, 0, 0, [1940, 11, 29, 0]],
  ['p101016-003', 0, 0, 0, [1940, 12, 6, 8]],
  ['p101017-002', 0, 0, 0, [1940, 11, 29, 3]],
  ['p101020-002', 0, 0, 0, [1940, 2, 8, 3]],
  ['p101020-002', 1, 0, 0, [1941, 1, 27, 4]],
  ['p101021-001', 0, 0, 0, [1940, 8, 4, 8]],
  ['p101021-001', 0, 1, 0, [1940, 11, 29, 4]],
  ['p101021-001', 0, 2, 0, [1941, 11, 19, 3]],
  ['p101021-001', 0, 3, 0, [1941, 2, 26, 11]],
  ['p101021-001', 1, 0, 0, [1940, 4, 8, 8]],
  ['p101021-001', 1, 1, 0, [1940, 11, 29, 0]],
  ['p101021-001', 1, 2, 0, [1941, 3, 28, 8]],
  ['p101021-001', 1, 3, 0, [1941, 8, 23, 4]],
];

const sourceId = suffix => 'ziwei-v2-fuqigong-' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];
const originalFacts = ([year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts, chartScope }] = queries;
  return { queries, chart: chartContext('ziwei', present, confirmedAbsentFacts, chartScope) };
}

test('37 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
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
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [37, 47, 57]);

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
  assert.equal(dates.size, 49);
  assert.deepEqual(verified, expected);
});

test('conjunction, brightness and actual sector placement cannot be replaced by unrelated facts', () => {
  const cases = [
    ['p009-002', fact => fact.kind === 'palace_star' && fact.star === '文曲',
      { kind: 'palace_sector_star', palace: '夫妻', star: '文曲' }],
    ['p101001-003', fact => fact.kind === 'palace_star' && fact.palace === '夫妻' && fact.star === '破军'],
    ['p101003-001', fact => fact.kind === 'palace_brightness' && fact.palace === '夫妻' && fact.star === '太阳'],
    ['p101009-002', fact => fact.kind === 'palace_star' && fact.palace === '夫妻' && fact.star === '天同',
      { kind: 'palace_star', palace: '福德', star: '天同', scope: 'origin' }],
    ['p101013-004', fact => fact.kind === 'palace_star' && fact.star === '地劫'],
  ];
  for (const [suffix, omitted, forged] of cases) {
    const birth = witnesses.find(([id]) => id === suffix).at(-1);
    const facts = originalFacts(birth);
    assert.ok(facts.some(omitted), suffix);
    const altered = facts.filter(fact => !omitted(fact));
    if (forged) altered.push(forged);
    const { chart } = request(altered);
    assert.equal(explainClaim(sourceId(suffix), 'ziwei', chart, undefined, catalog).matched, false, suffix);
  }
});

test('a matching birth does not put unspecified early or late marriage facts into the report', () => {
  const birth = witnesses.find(([id]) => id === 'p003-003').at(-1);
  const { queries } = request(originalFacts(birth));
  const id = sourceId('p003-003');
  const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(result => result.id === id);
  assert.ok(hit);
  const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
  assert.match(material, /原文\/依据：因妻得贵\n/u);
  assert.doesNotMatch(material, /早娶克|迟娶吉/u);
});

test('the report retains the catalog wording and identifies the alternate edition reading', () => {
  const birth = witnesses.find(([id]) => id === 'p101009-002').at(-1);
  const { queries } = request(originalFacts(birth));
  const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events])
    .find(result => result.id === sourceId('p101009-002'));
  assert.ok(hit);
  const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
  assert.match(material, /原文\/依据：夫同同内助/u);
  assert.match(material, /识典古籍转录作「天同同，内助」/u);
});

test('disputed clauses remain source review even for charts previously accepted under the noble stars reading', () => {
  const { queries, chart } = request(originalFacts([1940, 11, 29, 9]));
  const hitIds = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(result => result.id);
  for (const suffix of ['p101022-002', 'p101022-003']) {
    const id = sourceId(suffix);
    const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
    assert.equal(explanation.matched, false);
    assert.equal(explanation.reason, 'source_review_required');
    assert.match(explanation.reviewNote, /天马/u);
    assert.ok(!hitIds.includes(id));
  }
});
