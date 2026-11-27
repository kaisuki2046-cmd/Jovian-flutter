import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-joined-columns-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant, gender if female]
const witnesses = [
  ['v2-c265-p002-001', 0, 0, 0, '1936-03-06T16:15Z'],
  ['v2-c265-p002-001', 0, 1, 0, '1936-03-09T16:15Z'],
  ['v2-c265-p002-001', 0, 2, 0, '1936-02-18T22:15Z'],
  ['v2-c265-p002-001', 0, 3, 0, '1930-12-18T16:15Z'],
  ['v2-c265-p002-001', 0, 4, 0, '1929-12-31T22:15Z'],
  ['v2-c265-p002-001', 0, 5, 0, '1930-07-24T22:15Z'],
  ['v2-c356-p002-001', 0, 0, 0, '1983-12-01T16:15Z'],
  ['v2-c356-p002-001', 0, 0, 1, '1911-12-20T14:15Z'],
  ['v2-c356-p002-001', 0, 0, 2, '1903-12-02T14:15Z'],
  ['v2-c366-p002-001', 0, 0, 0, '1932-08-19T00:15Z'],
  ['v2-c366-p002-001', 0, 0, 1, '1936-12-16T00:15Z'],
  ['v2-c366-p002-001', 0, 0, 2, '1932-12-28T00:15Z'],
  ['v2-c366-p002-001', 0, 0, 3, '1932-12-28T00:15Z'],
  ['v2-c366-p002-001', 0, 1, 0, '1934-12-06T18:15Z'],
  ['v2-c366-p002-001', 0, 1, 1, '1935-12-21T18:15Z'],
  ['v2-c366-p002-001', 0, 1, 2, '1932-12-27T18:15Z'],
  ['v2-c366-p002-001', 0, 1, 3, '1932-12-27T18:15Z'],
  ['v3-c016-p002-002', 0, 0, 0, '1930-01-01T04:15Z'],
  ['v3-c016-p002-002', 0, 0, 1, '1930-01-12T20:15Z'],
  ['v3-c016-p002-002', 0, 0, 2, '1930-01-06T16:15Z'],
  ['v3-c016-p002-003', 0, 0, 0, '1930-01-04T00:15Z'],
  ['v3-c045-p002-006', 0, 0, 0, '1929-12-31T16:15Z'],
  ['v3-c045-p002-006', 1, 0, 0, '1930-01-03T16:15Z'],
  ['v3-c087-p006-002', 0, 0, 0, '1930-03-07T00:15Z'],
  ['v3-c087-p006-002', 1, 0, 0, '1930-03-01T12:15Z'],
  ['v3-c105-p009-001', 0, 0, 0, '1930-01-03T16:15Z'],
  ['v3-c114-p005-001', 0, 0, 0, '1929-12-31T16:15Z'],
  ['v3-c114-p005-001', 0, 0, 1, '1930-01-09T18:15Z'],
  ['v3-c114-p005-001', 0, 0, 2, '1930-04-13T02:15Z'],
  ['v3-c114-p007-001', 0, 0, 0, '1930-11-27T16:15Z'],
  ['v3-c114-p007-001', 0, 0, 1, '1930-12-27T16:15Z'],
  ['v3-c114-p007-001', 0, 0, 2, '1930-09-09T16:15Z'],
  ['v3-c114-p007-001', 0, 0, 3, '1930-11-18T16:15Z'],
  ['v3-c135-p002-001', 0, 0, 0, '1930-01-21T16:15Z'],
  ['v3-c135-p002-002', 0, 0, 0, '1930-01-12T22:15Z'],
  ['v3-c135-p002-101', 0, 0, 0, '1930-01-09T16:15Z'],
  ['v3-c135-p002-102', 0, 0, 0, '1930-01-01T04:15Z'],
  ['v3-c135-p002-104', 0, 0, 0, '1983-12-01T16:15Z'],
  ['v3-c135-p002-104', 0, 0, 1, '1911-12-20T14:15Z'],
  ['v3-c135-p002-104', 0, 0, 2, '1903-12-02T14:15Z'],
  ['v3-c151-p004-001', 0, 0, 0, '1930-09-24T20:15Z'],
  ['v4-c068-p002-001', 0, 0, 0, '1930-01-01T10:15Z'],
  ['v4-c068-p008-001', 0, 0, 0, '1930-01-01T10:15Z'],
  ['v4-c068-p008-002', 0, 0, 0, '1930-01-01T04:15Z'],
  ['v5-c002-p002-001', 0, 0, 0, '1930-01-21T16:15Z'],
  ['v5-c002-p004-001', 0, 0, 0, '1930-01-21T16:15Z'],
  ['v5-c012-p003-001', 0, 0, 0, '1930-02-07T02:15Z'],
  ['v5-c024-p008-001', 0, 0, 0, '1930-01-19T04:15Z'],
  ['v5-c024-p008-001', 0, 0, 1, '1930-01-19T02:15Z'],
  ['v5-c024-p008-001', 0, 0, 2, '1930-07-07T02:15Z'],
  ['v5-c053-p005-001', 0, 0, 0, '1930-11-21T16:15Z'],
  ['v5-c053-p005-001', 0, 1, 0, '1930-01-25T08:15Z'],
  ['v5-c053-p005-001', 0, 2, 0, '1930-09-27T16:15Z'],
  ['v5-c053-p005-001', 0, 3, 0, '1930-01-12T16:15Z'],
  ['v5-c053-p005-001', 0, 4, 0, '1930-01-27T16:15Z'],
  ['v5-c053-p005-001', 0, 5, 0, '1930-01-15T20:15Z'],
  ['v5-c071-p010-001', 0, 0, 0, '1931-07-09T20:15Z'],
  ['v5-c375-p002-101', 0, 0, 0, '1930-02-25T08:15Z'],
];

const sourceId = suffix => 'yhzp-' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];

function native(birthTime, gender = '男') {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts, chartScope }] = queries;
  return { queries, chart: chartContext('bazi', present, confirmedAbsentFacts, chartScope) };
}

function explain(suffix, facts, timeKnown) {
  return explainClaim(sourceId(suffix), 'bazi', request(facts, timeKnown).chart, undefined, catalog);
}

test('26 Yuanhai sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
  const inventory = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const expected = new Set(), verified = new Set(), charts = new Map();
  let groups = 0;
  for (const id of sourceIds) {
    assert.equal(inventory.get(id), 'branch_indexed', id);
    const { claim, branches } = catalog.get(id);
    branches.forEach(({ inputs }, passage) => {
      groups += inputs.length;
      inputs.forEach(({ anyOf }, group) => (anyOf.length ? anyOf : [null]).forEach((_, choice) =>
        expected.add([id, passage, group, choice].join('/'))));
    });
    const altered = structuredClone(claim);
    altered.evidence.context += '异本';
    assert.equal(compileYuanhaiNatalPassages(altered).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, groups, expected.size], [26, 39, 58]);

  for (const [suffix, passage, group, choice, date, gender = '男'] of witnesses) {
    const id = sourceId(suffix), key = date + '/' + gender;
    if (!charts.has(key)) {
      const { chart, queries } = request(native(date, gender));
      const hits = new Map(lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(hit => [hit.id, hit]));
      charts.set(key, { chart, facts: claimChartContext('bazi', chart), hits });
    }
    const { chart, facts, hits } = charts.get(key);
    const { text, inputs } = catalog.get(id).branches[passage];
    const input = inputs[group], label = [id, passage, group, choice].join('/');
    const single = input.anyOf.length ? { ...input, anyOf: [input.anyOf[choice]] } : input;
    assert.ok(evaluateRule(single, 'natal', facts).matched, label);
    const detail = explainClaim(id, 'bazi', chart, undefined, catalog), hit = hits.get(id);
    assert.ok(detail.matched && hit, label);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, label);
    const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(material.includes(text), label);
    assert.doesNotMatch(material, /现代释义：/u);
    verified.add(label);
  }
  assert.equal(charts.size, 46);
  assert.deepEqual(verified, expected);
});

test('disjoint punishment and combination do not satisfy the same-pair rule', () => {
  const chart = native('1930-01-05T00:15Z');
  const id = 'v2-c265-p002-001';
  const { present } = claimChartContext('bazi', request(chart).chart);
  assert.ok(present.some(fact => fact.kind === 'bazi_branch_relation' && fact.relation === '相刑'
    && fact.first === 'month' && fact.second === 'day'));
  assert.ok(present.some(fact => fact.kind === 'bazi_stem_combination' && fact.first === 'day' && fact.second === 'hour'));
  const supplied = { kind: 'bazi_stem_combination', first: 'month', second: 'day' };
  assert.equal(explain(id, chart).matched, false);
  assert.equal(explain(id, [...chart, supplied]).matched, false);
});

test('repeated Hai and water groups need full natal pillars, and wife passages retain their stated subject', () => {
  const hai = native('1983-12-01T16:15Z');
  assert.ok(explain('v2-c356-p002-001', hai).matched);
  assert.equal(explain('v2-c356-p002-001', hai, false).matched, false);
  const water = native('1932-08-19T00:15Z');
  const waterFlag = { kind: 'bazi_natal_configuration', name: '申子辰三支齐见' };
  assert.ok(explain('v2-c366-p002-001', water).matched);
  assert.equal(explain('v2-c366-p002-001', [...water, waterFlag], false).matched, false);
  const id = 'v3-c016-p002-002';
  assert.ok(explain(id, native('1930-01-01T04:15Z', '男')).matched);
  assert.equal(explain(id, native('1930-01-01T04:15Z', '女')).matched, false);
});

test('secondary hidden Hurting Officer does not satisfy a main-month condition', () => {
  const cases = [
    ['v3-c151-p004-001', '1930-10-14T22:15Z', '财星'],
    ['v5-c071-p010-001', '1930-10-14T16:15Z', '官杀'],
  ];
  for (const [id, birth, absentGod] of cases) {
    const raw = native(birth);
    const { present } = claimChartContext('bazi', request(raw).chart);
    assert.ok(present.some(f => f.kind === 'branch_ten_god' && f.position === 'month' && f.tenGod === '伤官'));
    assert.ok(!present.some(f => f.kind === 'branch_main_ten_god' && f.position === 'month' && f.tenGod === '伤官'));
    assert.ok(present.some(f => f.kind === 'bazi_ten_god_count' && f.tenGod === absentGod && f.count === 0));
    assert.equal(explain(id, raw).matched, false, id);
  }
});
