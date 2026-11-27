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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-children-parents-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, excerpt, input group, alternative, solar birth with local hour index]
const witnesses = [
  ['c005-p101005-002', 0, 0, 0, [1940, 5, 9, 1]],
  ['c005-p101005-002', 0, 1, 0, [1940, 5, 8, 3]],
  ['c005-p101005-003', 0, 0, 0, [1942, 8, 12, 11]],
  ['c005-p101005-003', 0, 1, 0, [1950, 2, 22, 8]],
  ['c005-p101005-007', 0, 0, 0, [1940, 8, 10, 5]],
  ['c005-p101008-005', 0, 0, 0, [1946, 8, 2, 5]],
  ['c005-p101012-004', 0, 0, 0, [1950, 3, 10, 8]],
  ['c005-p101012-004', 0, 1, 0, [1950, 11, 1, 6]],
  ['c005-p101014-009', 0, 0, 0, [1942, 8, 13, 11]],
  ['c005-p101017-006', 0, 0, 0, [1940, 2, 14, 2]],
  ['c005-p101018-002', 0, 0, 0, [1940, 2, 10, 2]],
  ['c005-p101018-002', 0, 1, 0, [1940, 2, 11, 4]],
  ['c005-p101018-002', 0, 2, 0, [1940, 3, 12, 5]],
  ['c005-p101018-002', 0, 3, 0, [1940, 3, 24, 1]],
  ['c005-p101020-002', 0, 0, 0, [1942, 8, 21, 11]],
  ['c005-p101020-002', 0, 1, 0, [1950, 10, 28, 6]],
  ['c005-p101022-003', 0, 0, 0, [1940, 5, 16, 3]],
  ['c005-p101023-002', 0, 0, 0, [1940, 2, 8, 7]],
  ['c005-p101023-002', 0, 0, 1, [1940, 5, 10, 7]],
  ['c005-p101023-002', 0, 0, 2, [1940, 3, 16, 7]],
  ['c005-p101023-002', 0, 0, 3, [1940, 3, 16, 7]],
  ['c005-p101023-002', 0, 0, 4, [1940, 5, 10, 7]],
  ['c005-p101027-001', 0, 0, 0, [1940, 2, 8, 3]],
  ['c013-p101006-002', 0, 0, 0, [1950, 6, 20, 6]],
  ['c013-p101006-005', 0, 0, 0, [1941, 2, 5, 1]],
  ['c013-p101006-005', 0, 0, 1, [1941, 2, 5, 1]],
  ['c013-p101006-005', 0, 0, 2, [1940, 5, 18, 4]],
  ['c013-p101006-005', 0, 0, 3, [1940, 5, 18, 4]],
  ['c013-p101006-005', 0, 1, 0, [1941, 1, 29, 5]],
  ['c013-p101006-005', 0, 1, 1, [1941, 1, 30, 11]],
  ['c013-p101006-005', 0, 1, 2, [1940, 5, 14, 2]],
  ['c013-p101006-005', 0, 1, 3, [1940, 3, 16, 0]],
  ['c013-p101008-003', 0, 0, 0, [1946, 4, 7, 5]],
  ['c013-p101012-001', 0, 0, 0, [1940, 2, 9, 0]],
  ['c013-p101012-006', 0, 0, 0, [1950, 10, 12, 8]],
  ['c013-p101013-003', 0, 0, 0, [1940, 2, 17, 5]],
  ['c013-p101013-003', 1, 0, 0, [1940, 2, 10, 3]],
  ['c013-p101013-003', 1, 1, 0, [1940, 3, 4, 9]],
  ['c013-p101013-004', 0, 0, 0, [1942, 4, 21, 11]],
  ['c013-p101014-002', 0, 0, 0, [1940, 3, 12, 3]],
  ['c013-p101015-001', 0, 0, 0, [1940, 2, 13, 4]],
  ['c013-p101016-004', 0, 0, 0, [1940, 2, 9, 2]],
  ['c013-p101016-005', 0, 0, 0, [1950, 6, 16, 6]],
  ['c013-p101017-004', 0, 0, 0, [1942, 4, 20, 11]],
  ['c013-p101018-006', 0, 0, 0, [1950, 10, 11, 8]],
  ['c013-p101021-001', 0, 0, 0, [1940, 2, 9, 0]],
  ['c013-p101024-003', 0, 0, 0, [1940, 9, 7, 11]],
  ['c013-p101024-004', 0, 0, 0, [1940, 10, 31, 11]],
  ['c013-p101025-003', 0, 0, 0, [1940, 10, 31, 11]],
  ['c013-p101031-001', 0, 0, 0, [1940, 2, 8, 2]],
  ['c013-p101031-001', 0, 1, 0, [1940, 2, 8, 8]],
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

test('30 original records and all their reviewed alternatives reach SQLite and the report through real charts', () => {
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
  assert.deepEqual([sourceIds.length, inputCount, expected.size], [30, 41, 51]);

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
    const matched = hit.matchedBranches.find(branch => branch.text === text);
    assert.ok(material.includes(`原文/依据：${text}\n现代解读：${matched.modernInterpretation}`), label);
    verified.add(label);
  }
  assert.equal(dates.size, 45);
  assert.deepEqual(verified, expected);
});

test('a missing sector member, missing brightness, and a displaced companion cannot satisfy the corresponding passages', () => {
  const cases = [
    ['c005-p101005-002', fact => fact.kind === 'palace_star' && fact.star === '文曲',
      { kind: 'palace_sector_star', palace: '子女', star: '文曲' }],
    ['c013-p101006-002', fact => fact.kind === 'palace_brightness' && fact.palace === '父母' && fact.star === '天机'],
    ['c013-p101024-003', fact => fact.kind === 'palace_star' && fact.palace === '父母' && fact.star === '文昌'],
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
