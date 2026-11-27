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
import { compileQtbjMetalWater } from './qtbj-metal-water-passages.mjs';
import { compileQtbjWoodFireEarth } from './qtbj-wood-fire-earth-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-reviewed-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant]
const witnesses = [
  ['v2-c005-p002-001', 0, 0, 0, '1992-05-28T14:15Z'],
  ['v2-c005-p011-001', 0, 0, 0, '1930-06-13T00:15Z'],
  ['v2-c005-p011-001', 0, 1, 0, '1930-07-12T22:15Z'],
  ['v3-c028-p003-301', 0, 0, 0, '1936-12-10T02:15Z'],
  ['v5-c070-p002-101', 0, 0, 0, '1931-05-24T16:15Z'],
  ['v5-c070-p002-101', 0, 0, 1, '1931-06-03T16:15Z'],
  ['v5-c070-p002-101', 0, 0, 2, '1946-05-15T16:15Z'],
  ['v5-c076-p004-401', 0, 0, 0, '1933-11-10T00:15Z'],
  ['v5-c076-p004-401', 0, 0, 1, '1933-11-10T00:15Z'],
  ['v5-c076-p004-401', 0, 1, 0, '1971-12-01T00:15Z'],
  ['v5-c087-p004-301', 0, 0, 0, '1930-11-06T22:15Z'],
  ['v5-c087-p004-301', 1, 0, 0, '1940-10-24T22:15Z'],
  ['v6-c104-p001-101', 0, 0, 0, '1956-10-12T00:15Z'],
  ['v6-c119-p008-301', 0, 0, 0, '1938-12-07T00:15Z'],
  ['v6-c119-p008-301', 0, 0, 1, '1941-12-01T00:15Z'],
  ['v6-c119-p008-301', 0, 0, 2, '1931-12-04T00:15Z'],
  ['v6-c119-p008-301', 0, 0, 3, '1936-12-06T20:15Z'],
  ['v6-c119-p008-301', 0, 0, 4, '1936-12-07T02:15Z'],
  ['v6-c119-p008-301', 0, 1, 0, '1950-12-24T00:15Z'],
  ['v6-c119-p008-301', 0, 1, 1, '1953-12-18T00:15Z'],
  ['v6-c119-p008-301', 0, 1, 2, '1938-01-01T00:15Z'],
  ['v6-c119-p008-301', 0, 1, 3, '1934-12-27T20:15Z'],
  ['v6-c119-p008-301', 0, 1, 4, '1934-12-28T02:15Z'],
  ['v6-c119-p008-301', 0, 2, 0, '1939-01-16T00:15Z'],
  ['v6-c119-p008-301', 0, 2, 1, '1930-01-13T00:15Z'],
  ['v6-c119-p008-301', 0, 2, 2, '1934-01-22T00:15Z'],
  ['v6-c119-p008-301', 0, 2, 3, '1937-01-15T20:15Z'],
  ['v6-c119-p008-301', 0, 2, 4, '1937-01-16T02:15Z'],
];

const sourceId = suffix => 'qtbj-' + suffix;
const sourceIds = [...new Set(witnesses.map(([suffix]) => sourceId(suffix)))];

function native(birthTime) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000, 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: '男' }];
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

test('eight Qiongtong Baojian sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
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
    const compile = id.startsWith('qtbj-v5-') || id.startsWith('qtbj-v6-') ? compileQtbjMetalWater : compileQtbjWoodFireEarth;
    assert.equal(compile(altered).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, groups, expected.size], [8, 13, 28]);

  for (const [suffix, passage, group, choice, date] of witnesses) {
    const id = sourceId(suffix);
    if (!charts.has(date)) {
      const { chart, queries } = request(native(date));
      const hits = new Map(lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).map(hit => [hit.id, hit]));
      charts.set(date, { chart, facts: claimChartContext('bazi', chart), hits });
    }
    const { chart, facts, hits } = charts.get(date);
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
  assert.equal(charts.size, 27);
  assert.deepEqual(verified, expected);
});

test('unknown birth time cannot satisfy stem counts or certify that a stem is absent', () => {
  const id = 'v3-c028-p003-301';
  const facts = native('1936-12-10T02:15Z');
  assert.deepEqual(explain(id, facts).matchedBranches.map(({ text }) => text), ['又有丙透以解冻']);
  assert.equal(explain(id, facts, false).matched, false);
});

test('the 辰 branch and the branch without 辰 return their own excerpts', () => {
  const id = 'v5-c087-p004-301';
  assert.deepEqual(explain(id, native('1930-11-06T22:15Z')).matchedBranches.map(({ text }) => text), ['时月多透丙辛者，略贵']);
  assert.deepEqual(explain(id, native('1940-10-24T22:15Z')).matchedBranches.map(({ text }) => text), ['加以辰字在支，则荣显莫及']);
});

test('the incompatible 申 month prerequisites stay out of the report and keep the review note', () => {
  const detail = explain('v4-c051-p002-101', native('1953-08-19T08:15Z'));
  assert.equal(detail.matched, false);
  assert.match(detail.reviewNote, /无法同时实现三个不同显干/u);
});
