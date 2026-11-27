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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-child-parent-opposite-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['c005-p101028-001', 0, 0, 0, [1940, 2, 8, 2]],
  ['c005-p101028-001', 1, 0, 0, [1941, 1, 27, 3]],
  ['c005-p101028-002', 0, 0, 0, [1941, 8, 23, 7]],
  ['c005-p101028-002', 0, 1, 0, [1941, 1, 27, 1]],
  ['c005-p101028-002', 0, 2, 0, [1942, 1, 17, 0]],
  ['c005-p101028-002', 0, 3, 0, [1941, 6, 25, 6]],
  ['c005-p101028-002', 1, 0, 0, [1940, 5, 7, 7]],
  ['c005-p101028-002', 1, 1, 0, [1940, 5, 7, 7]],
  ['c005-p101028-002', 1, 2, 0, [1940, 12, 29, 3]],
  ['c005-p101028-002', 1, 3, 0, [1940, 12, 29, 3]],
  ['c005-p101028-003', 0, 0, 0, [1940, 7, 5, 9]],
  ['c005-p101029-002', 0, 0, 0, [1942, 2, 15, 11]],
  ['c005-p101029-002', 0, 1, 0, [1941, 3, 28, 5]],
  ['c005-p101030-003', 0, 0, 0, [1940, 7, 5, 3]],
  ['c013-p101008-004', 0, 0, 0, [1941, 1, 29, 2]],
  ['c013-p101016-003', 0, 0, 0, [1940, 2, 10, 0]],
  ['c013-p101027-003', 0, 0, 0, [1943, 3, 6, 3]],
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

test('8 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
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
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [8, 17, 17]);

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
  assert.equal(dates.size, 15);
  assert.deepEqual(verified, expected);
});

test('opposite counts need the six-branch relation and the complete opposite star list', () => {
  const suffix = 'c005-p101028-003';
  const birth = witnesses.find(([id]) => id === suffix).at(-1);
  const native = originalFacts(birth);
  const fabricatedCounts = [
    { kind: 'palace_opposite_benefic_count', palace: '子女', count: 3 },
    { kind: 'palace_opposite_six_malefic_count', palace: '子女', count: 0 },
  ];
  const changes = [
    facts => facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '田宅'),
    facts => facts.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '田宅'),
    facts => facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '子女' || fact.target !== '田宅'),
    facts => facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '田宅' || fact.star !== '文昌'),
  ];
  for (const change of changes) {
    const altered = change(native);
    assert.ok(altered.length < native.length);
    const { chart } = request([...altered, ...fabricatedCounts]);
    assert.equal(explainClaim(sourceId(suffix), 'ziwei', chart, undefined, catalog).matched, false);
  }
  const { queries } = request(native);
  const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events])
    .find(result => result.id === sourceId(suffix));
  const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
  assert.match(material, /子女宫对宫有3颗六吉星/u);
  assert.match(material, /子女宫对宫有0颗六煞星/u);
});

test('a missing four-sector star list cannot prove absence of the two malefics', () => {
  const suffix = 'c013-p101008-004';
  const birth = witnesses.find(([id]) => id === suffix).at(-1);
  const native = originalFacts(birth);
  const incomplete = native.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '子女');
  const fabricatedAbsences = ['擎羊', '陀罗'].map(star => ({ kind: 'palace_sector_star', palace: '父母', star }));
  const query = { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts: incomplete, confirmedAbsentFacts: fabricatedAbsences };
  const [parsed] = parseChartQueries([query]);
  const chart = chartContext('ziwei', parsed.confirmedFacts, parsed.confirmedAbsentFacts, parsed.chartScope);
  assert.equal(explainClaim(sourceId(suffix), 'ziwei', chart, undefined, catalog).matched, false);
  const disputed = explainClaim(sourceId('c005-p101023-003'), 'ziwei', chart, undefined, catalog);
  assert.equal(disputed.reason, 'source_review_required');
  assert.match(disputed.reviewNote, /武杀/u);
});
