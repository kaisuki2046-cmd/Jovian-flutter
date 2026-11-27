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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-exclusions-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant]
const witnesses = [
  ['v2-c230-p004-101', 0, 0, 0, '1930-01-09T16:15Z'],
  ['v2-c269-p002-001', 0, 0, 0, '1943-04-09T22:15Z'],
  ['v2-c269-p002-001', 0, 1, 0, '1936-05-04T06:15Z'],
  ['v2-c269-p002-001', 0, 2, 0, '1947-10-27T18:15Z'],
  ['v2-c269-p002-001', 0, 2, 1, '1939-10-09T18:15Z'],
  ['v2-c269-p002-001', 0, 3, 0, '1937-11-01T10:15Z'],
  ['v2-c269-p002-001', 0, 3, 1, '1939-10-22T06:15Z'],
  ['v2-c269-p002-001', 0, 4, 0, '1947-10-15T20:15Z'],
  ['v2-c269-p002-001', 0, 4, 1, '1935-10-19T02:15Z'],
  ['v2-c395-p002-001', 0, 0, 0, '1930-01-03T16:15Z'],
  ['v3-c016-p002-101', 0, 0, 0, '1930-04-24T20:15Z'],
  ['v5-c002-p010-001', 0, 0, 0, '1987-09-11T16:15Z'],
  ['v5-c002-p010-001', 0, 0, 1, '1951-09-20T16:15Z'],
  ['v5-c002-p010-001', 0, 0, 2, '1951-09-20T22:15Z'],
  ['v5-c002-p010-001', 0, 0, 3, '1937-10-03T22:15Z'],
  ['v5-c002-p010-001', 0, 0, 4, '1951-09-20T22:15Z'],
  ['v5-c002-p010-001', 0, 0, 5, '1951-09-20T22:15Z'],
  ['v5-c153-p002-001', 0, 0, 0, '1930-12-28T08:15Z'],
  ['v5-c187-p006-001', 0, 0, 0, '1935-02-27T16:15Z'],
  ['v5-c206-p003-001', 0, 0, 0, '1938-11-27T16:15Z'],
  ['v5-c227-p007-001', 0, 0, 0, '1940-08-25T08:15Z'],
  ['v5-c227-p007-001', 1, 0, 0, '1932-09-15T16:15Z'],
  ['v5-c302-p006-001', 0, 0, 0, '1936-05-19T10:15Z'],
  ['v5-c302-p006-001', 0, 0, 1, '1937-06-23T10:15Z'],
  ['v5-c302-p006-001', 0, 0, 2, '1933-06-04T08:15Z'],
  ['v5-c302-p006-001', 0, 0, 3, '1937-04-04T02:15Z'],
  ['v5-c302-p006-001', 0, 0, 4, '1933-06-03T16:15Z'],
  ['v5-c302-p006-001', 0, 0, 5, '1936-05-19T10:15Z'],
];

const sourceId = suffix => 'yhzp-' + suffix;
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

test('ten Yuanhai sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
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
  assert.deepEqual([sourceIds.length, groups, expected.size], [10, 15, 28]);

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
  assert.equal(charts.size, 25);
  assert.deepEqual(verified, expected);
});

test('the mouse nobleman excerpt requires both the correct hour and confirmed exclusions', () => {
  const id = 'v5-c187-p006-001';
  const facts = native('1935-02-27T16:15Z');
  assert.deepEqual(explain(id, facts).matchedBranches.map(({ text }) => text), ['若無官殺拜丹墀']);
  assert.equal(explain(id, facts, false).matched, false);

  const excluded = native('1935-02-17T16:15Z');
  assert.ok(excluded.some(f => f.kind === 'pillar' && f.position === 'hour' && f.ganZhi === '丙子'));
  assert.ok(excluded.some(f => f.kind === 'branch' && f.position === 'day' && f.branch === '丑'));
  assert.equal(explain(id, excluded).matched, false);
});

test('the hour switches the water branch formation excerpt and a filled clash blocks it', () => {
  const id = 'v5-c227-p007-001';
  assert.deepEqual(explain(id, native('1940-08-25T08:15Z')).matchedBranches.map(({ text }) => text), ['若是申時歸祿格']);
  assert.deepEqual(explain(id, native('1932-09-15T16:15Z')).matchedBranches.map(({ text }) => text), ['時逢丙子殺神加']);
  assert.equal(explain(id, native('1935-01-04T08:15Z')).matched, false);
});

test('the couple excerpt retains its stated subject and other patterns need their own evidence', () => {
  const facts = native('1930-04-24T20:15Z');
  const id = 'v3-c016-p002-101';
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.map(f => f.kind === 'natal_gender' ? { ...f, gender: '女' } : f)).matched, false);
  for (const id of ['v2-c236-p003-001', 'v2-c246-p002-001']) {
    const detail = explain(id, facts);
    assert.equal(detail.matched, false);
  }
});
