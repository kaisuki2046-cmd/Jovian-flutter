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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-illness-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['002-003', 0, 0, 0, [1940, 1, 10, 4]],
  ['002-004', 0, 0, 0, [1940, 1, 10, 4]],
  ['002-005', 0, 0, 0, [1941, 1, 13, 11]],
  ['002-006', 0, 0, 0, [1940, 1, 1, 8]],
  ['004-002', 0, 0, 0, [1944, 2, 11, 2]],
  ['005-005', 0, 0, 0, [1940, 1, 16, 7]],
  ['006-003', 0, 0, 0, [1941, 2, 25, 3]],
  ['007-002', 0, 0, 0, [1940, 6, 28, 5]],
  ['007-002', 0, 1, 0, [1940, 4, 25, 3]],
  ['007-002', 0, 2, 0, [1940, 4, 4, 8]],
  ['007-002', 0, 3, 0, [1940, 5, 10, 4]],
  ['007-002', 0, 4, 0, [1940, 2, 7, 0]],
  ['007-003', 0, 0, 0, [1940, 1, 4, 2]],
  ['007-004', 0, 0, 0, [1940, 1, 7, 0]],
  ['007-004', 0, 1, 0, [1940, 2, 1, 11]],
  ['007-004', 0, 2, 0, [1940, 1, 10, 10]],
  ['009-004', 0, 0, 0, [1940, 5, 13, 5]],
  ['009-004', 0, 1, 0, [1940, 5, 13, 5]],
  ['009-004', 0, 2, 0, [1940, 3, 19, 9]],
  ['009-004', 0, 3, 0, [1940, 3, 19, 9]],
  ['009-004', 0, 4, 0, [1940, 2, 16, 8]],
  ['009-004', 0, 5, 0, [1940, 3, 4, 2]],
  ['009-005', 0, 0, 0, [1940, 5, 7, 11]],
  ['009-006', 0, 0, 0, [1940, 4, 16, 10]],
  ['011-004', 0, 0, 0, [1940, 5, 13, 11]],
  ['011-005', 0, 0, 0, [1940, 5, 13, 11]],
  ['012-004', 0, 0, 0, [1940, 10, 28, 5]],
  ['013-002', 0, 0, 0, [1940, 5, 19, 9]],
  ['013-004', 0, 0, 0, [1940, 1, 7, 0]],
  ['014-004', 0, 0, 0, [1940, 3, 16, 1]],
  ['016-002', 0, 0, 0, [1940, 7, 7, 5]],
  ['016-002', 0, 1, 0, [1940, 3, 10, 3]],
  ['016-002', 0, 2, 0, [1940, 1, 10, 8]],
  ['016-002', 0, 3, 0, [1940, 3, 10, 3]],
  ['017-002', 0, 0, 0, [1940, 5, 10, 5]],
  ['017-002', 0, 1, 0, [1940, 4, 7, 5]],
  ['017-002', 0, 2, 0, [1940, 7, 7, 5]],
  ['017-002', 0, 3, 0, [1940, 11, 28, 5]],
  ['017-002', 0, 4, 0, [1940, 5, 10, 5]],
  ['017-003', 0, 0, 0, [1946, 10, 14, 5]],
  ['019-002', 0, 0, 0, [1940, 6, 7, 5]],
  ['019-002', 0, 1, 0, [1940, 4, 10, 3]],
  ['019-002', 0, 2, 0, [1940, 3, 10, 2]],
  ['019-002', 0, 3, 0, [1940, 1, 10, 2]],
  ['019-004', 0, 0, 0, [1940, 1, 1, 1]],
  ['021-002', 0, 0, 0, [1940, 7, 7, 5]],
  ['021-002', 0, 1, 0, [1940, 3, 10, 1]],
  ['021-002', 0, 2, 0, [1940, 3, 10, 1]],
  ['021-002', 0, 3, 0, [1940, 7, 7, 5]],
  ['022-001', 0, 0, 0, [1940, 1, 1, 7]],
  ['022-001', 0, 1, 0, [1940, 1, 1, 11]],
];

const sourceId = suffix => 'ziwei-v2-c007-p101' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];
const originalFacts = ([year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts, chartScope }] = queries;
  return { queries, chart: chartContext('ziwei', present, confirmedAbsentFacts, chartScope) };
}

test('26 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
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
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [26, 51, 51]);

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
    assert.match(material, /疾厄篇.*只作古籍引证/u);
    verified.add(label);
  }
  assert.equal(dates.size, 40);
  assert.deepEqual(verified, expected);
});

function explain(suffix, raw) {
  return explainClaim(sourceId(suffix), 'ziwei', request(raw).chart, undefined, catalog);
}

test('an asserted Health palace transformation cannot stand in for the natal carrier', () => {
  const id = '004-002';
  const raw = originalFacts([1944, 2, 11, 2]);
  assert.ok(explain(id, raw).matched);
  const incomplete = raw.filter(({ kind, change }) => kind !== 'star_mutagen' || change !== '忌');
  assert.ok(incomplete.length < raw.length);
  assert.equal(explain(id, [...incomplete, { kind: 'palace_sector_mutagen', palace: '疾厄', change: '忌' }]).matched, false);
});

test('empty major-star positions need the full palace origin list', () => {
  const id = '017-002';
  const raw = originalFacts([1940, 5, 10, 5]);
  assert.ok(explain(id, raw).matched);
  assert.ok(raw.some(({ kind, palace, count }) => kind === 'palace_main_count' && palace === '疾厄' && count === 0));
  const incomplete = raw.filter(({ kind, palace }) => kind !== 'palace_origin_star_count' || palace !== '疾厄');
  assert.ok(incomplete.length < raw.length);
  assert.equal(explain(id, incomplete).matched, false);
});

test('the matching excerpt and the alternate star names keep their separate source evidence', () => {
  const id = '022-001';
  const { queries } = request(originalFacts([1940, 1, 1, 7]));
  const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events])
    .find(result => result.id === sourceId(id));
  assert.ok(hit);
  assert.match(hit.claim.evidence.original_text, /羊铃/u);
  assert.deepEqual(hit.matchedBranches.map(({ text }) => text), ['主一生灾少，身体健旺伶俐']);
  assert.match(hit.calculationNote, /参校本作魁钺/u);
});
