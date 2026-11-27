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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-twelve-palaces-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['p010-005', 0, 0, 0, [1940, 10, 31, 0]],
  ['p010-005', 1, 0, 0, [1940, 10, 31, 4]],
  ['p010-006', 0, 0, 0, [1940, 2, 12, 0]],
  ['p010-016', 0, 0, 0, [1941, 2, 11, 4]],
  ['p010-016', 0, 0, 1, [1942, 3, 8, 4]],
  ['p010-016', 0, 0, 2, [1940, 6, 13, 2]],
  ['p010-016', 0, 0, 3, [1940, 10, 16, 0]],
  ['p010-043', 0, 0, 0, [1940, 10, 31, 0]],
  ['p010-043', 1, 0, 0, [1940, 10, 31, 4]],
  ['p011-017', 0, 0, 0, [1940, 5, 10, 9]],
  ['p011-021', 0, 0, 0, [1940, 2, 12, 4]],
  ['p011-022', 0, 0, 0, [1940, 2, 8, 0]],
  ['p011-022', 0, 1, 0, [1940, 2, 8, 4]],
  ['p011-023', 0, 0, 0, [1940, 11, 29, 0]],
  ['p011-023', 1, 0, 0, [1949, 12, 20, 3]],
  ['p011-024', 0, 0, 0, [1941, 2, 28, 8]],
  ['p011-024', 0, 1, 0, [1941, 4, 27, 2]],
  ['p011-025', 0, 0, 0, [1940, 2, 8, 5]],
  ['p011-027', 0, 0, 0, [1940, 3, 19, 0]],
  ['p011-027', 0, 1, 0, [1940, 3, 15, 0]],
  ['p011-031', 0, 0, 0, [1940, 2, 11, 1]],
  ['p011-033', 0, 0, 0, [1940, 2, 15, 2]],
  ['p011-037', 0, 0, 0, [1949, 12, 20, 3]],
  ['p012-023', 0, 0, 0, [1941, 1, 27, 6, '男']],
  ['p012-023', 0, 1, 0, [1941, 1, 27, 10, '男']],
  ['p012-023', 1, 0, 0, [1941, 1, 27, 6]],
  ['p012-023', 1, 1, 0, [1941, 1, 27, 10]],
  ['p012-024', 0, 0, 0, [1940, 4, 21, 0]],
  ['p012-025', 0, 0, 0, [1940, 2, 19, 1]],
  ['p012-025', 0, 1, 0, [1940, 2, 15, 1]],
  ['p013-013', 0, 0, 0, [1940, 3, 12, 9]],
  ['p013-017', 0, 0, 0, [1940, 11, 2, 7]],
  ['p013-021', 0, 0, 0, [1940, 2, 8, 2]],
  ['p013-021', 0, 1, 0, [1940, 2, 8, 4]],
  ['p013-022', 0, 0, 0, [1940, 2, 10, 0]],
  ['p013-023', 0, 0, 0, [1941, 2, 26, 6]],
  ['p013-023', 0, 1, 0, [1941, 2, 26, 10]],
  ['p013-026', 0, 0, 0, [1940, 3, 11, 0]],
  ['p013-029', 0, 0, 0, [1940, 2, 17, 0]],
  ['p013-032', 0, 0, 0, [1940, 2, 8, 3]],
  ['p013-032', 0, 1, 0, [1940, 2, 9, 0]],
  ['p014-019', 0, 0, 0, [1941, 12, 19, 2]],
  ['p014-019', 0, 1, 0, [1941, 3, 28, 10]],
  ['p018-018', 0, 0, 0, [1940, 10, 5, 0]],
  ['p018-021', 0, 0, 0, [1941, 3, 29, 2]],
  ['p018-021', 0, 1, 0, [1941, 1, 28, 4]],
  ['p019-021', 0, 0, 0, [1940, 5, 7, 9]],
  ['p019-021', 0, 0, 1, [1940, 5, 7, 9]],
  ['p019-021', 0, 0, 2, [1940, 3, 9, 2]],
  ['p019-021', 0, 0, 3, [1940, 5, 7, 3]],
  ['p019-021', 0, 0, 4, [1940, 5, 7, 9]],
  ['p019-021', 0, 1, 0, [1940, 5, 7, 5]],
  ['p019-021', 0, 1, 1, [1940, 5, 7, 5]],
  ['p019-021', 0, 1, 2, [1940, 3, 9, 4]],
  ['p019-021', 0, 1, 3, [1940, 3, 9, 4]],
  ['p019-021', 0, 1, 4, [1940, 5, 7, 11]],
  ['p019-021', 0, 1, 5, [1940, 5, 7, 5]],
  ['p019-022', 0, 0, 0, [1940, 4, 8, 5]],
  ['p020-016', 0, 0, 0, [1940, 5, 7, 0]],
  ['p021-017', 0, 0, 0, [1941, 9, 21, 1]],
  ['p021-022', 0, 0, 0, [1940, 10, 1, 0]],
  ['p021-023', 0, 0, 0, [1940, 2, 9, 6]],
  ['p021-024', 0, 0, 0, [1941, 2, 26, 10]],
  ['p021-024', 0, 1, 0, [1941, 2, 27, 2]],
  ['p021-026', 0, 0, 0, [1940, 2, 8, 6]],
  ['p021-026', 0, 0, 1, [1940, 2, 29, 8]],
  ['p021-029', 0, 0, 0, [1940, 3, 29, 0]],
  ['p021-030', 0, 0, 0, [1940, 2, 27, 6]],
  ['p021-030', 0, 0, 1, [1940, 2, 9, 8]],
  ['p021-030', 0, 0, 2, [1940, 3, 16, 1]],
  ['p021-030', 0, 0, 3, [1940, 3, 16, 3]],
  ['p023-001', 0, 0, 0, [1940, 2, 8, 8]],
  ['p023-001', 0, 1, 0, [1940, 2, 8, 10]],
];

const sourceId = suffix => 'ziwei-v2-jielan-101-' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];
const originalFacts = ([year, month, day, hour, gender = '女']) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: gender === '女' ? 'female' : 'male' }, hour));

function request(confirmedFacts, confirmedAbsentFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, confirmedAbsentFacts }]);
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, chart: chartContext('ziwei', present, absent, chartScope) };
}

test('39 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
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
    assert.equal(compileJielanPalacePassages(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [39, 57, 73]);

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
    assert.ok(hit.claim.evidence.original_text.includes(text), label);
    verified.add(label);
  }
  assert.equal(dates.size, 63);
  assert.deepEqual(verified, expected);
});

function explain(suffix, raw, absent) {
  return explainClaim(sourceId(suffix), 'ziwei', request(raw, absent).chart, undefined, catalog);
}

test('the inheritance exception and ordinary clause each need a complete four-palace comparison', () => {
  const id = 'p010-005';
  const favorable = originalFacts([1940, 10, 31, 4]);
  const ordinary = originalFacts([1940, 10, 31, 0]);
  assert.deepEqual(explain(id, favorable).matchedBranches.map(({ text }) => text), ['吉多亦平']);
  assert.deepEqual(explain(id, ordinary).matchedBranches.map(({ text }) => text), ['难为祖业']);

  const lackOppositeList = facts => facts.filter(({ kind, palace }) => kind !== 'palace_origin_star_count' || palace !== '迁移');
  const reported = { kind: 'palace_sector_benefic_majority', palace: '命宫' };
  assert.equal(explain(id, [...lackOppositeList(favorable), reported]).matched, false);
  assert.equal(explain(id, lackOppositeList(ordinary), [reported]).matched, false);
});

test('the clear natal carrier is required for a same-palace transformation', () => {
  const id = 'p011-021';
  const observed = originalFacts([1940, 2, 12, 4]);
  assert.ok(explain(id, observed).matched);
  const incomplete = observed.filter(({ kind, change }) => kind !== 'star_mutagen' || change !== '忌');
  assert.ok(incomplete.length < observed.length);
  const supplied = { kind: 'palace_sector_mutagen', palace: '兄弟', change: '忌' };
  assert.equal(explain(id, [...incomplete, supplied]).matched, false);
});

test('reprints keep independent explanations and contribute one excerpt to the report', () => {
  for (const [primary, reprint, text, birth] of [
    ['p010-005', 'p010-043', '吉多亦平', [1940, 10, 31, 4]],
    ['p011-023', 'p011-037', '加吉多，一人', [1949, 12, 20, 3]],
    ['p013-009', 'p013-026', '加七杀曲，主二人，宜庶出', [1940, 3, 11, 0]],
  ]) {
    const raw = originalFacts(birth);
    assert.ok(explain(primary, raw).matched && explain(reprint, raw).matched);
    const { queries } = request(raw);
    const results = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    const hits = [results.get(sourceId(primary)), results.get(sourceId(reprint))];
    assert.ok(hits.every(Boolean));
    const material = events => buildReportMaterials([{ topic: hits[0].topic, personality: [], events }]);
    assert.equal(material(hits).split(text).length - 1, 1);
    assert.equal(material(hits.slice(1)).split(text).length - 1, 1);
  }
});
