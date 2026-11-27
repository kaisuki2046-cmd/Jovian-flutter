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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-natal-batch-215-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant, gender if female]
const witnesses = [
  ['v3-c004-p002-001', 0, 0, 0, '1929-04-30T20:15Z'],
  ['v3-c004-p002-001', 0, 1, 0, '1929-05-02T16:15Z'],
  ['v3-c004-p002-001', 0, 2, 0, '1929-05-02T20:15Z'],
  ['v3-c031-p002-002', 0, 0, 0, '1929-05-01T04:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 0, '1940-10-08T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 1, '1940-03-31T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 2, '1940-04-01T12:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 3, '1934-04-06T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 4, '1929-05-04T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 5, '1929-05-01T12:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 6, '1934-03-09T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 7, '1945-10-13T16:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 8, '1929-05-11T12:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 9, '1934-02-07T00:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 10, '1945-10-09T00:15Z', '女'],
  ['v3-c039-p002-002', 0, 0, 11, '1929-05-05T00:15Z', '女'],
  ['v3-c105-p004-002', 0, 0, 0, '1932-11-13T02:15Z'],
  ['v3-c125-p002-002', 0, 0, 0, '1929-05-06T16:15Z'],
  ['v3-c131-p002-002', 0, 0, 0, '1929-05-05T08:15Z'],
  ['v3-c137-p009-001', 0, 0, 0, '1929-05-04T18:15Z'],
  ['v3-c151-p005-001', 0, 0, 0, '1929-05-02T04:15Z'],
  ['v3-c151-p005-001', 0, 0, 1, '1929-05-01T02:15Z'],
  ['v3-c151-p005-001', 0, 0, 2, '1929-05-09T22:15Z'],
  ['v3-c151-p005-001', 0, 0, 3, '1929-05-08T20:15Z'],
  ['v3-c151-p005-001', 1, 0, 0, '1929-05-13T02:15Z'],
  ['v4-c040-p003-001', 0, 0, 0, '1929-05-04T18:15Z'],
  ['v4-c047-p004-002', 0, 0, 0, '1929-04-30T20:15Z'],
  ['v4-c053-p004-002', 0, 0, 0, '1929-05-01T00:15Z'],
  ['v4-c068-p008-003', 0, 0, 0, '1929-05-08T18:15Z'],
  ['v4-c077-p004-001', 0, 0, 0, '1989-05-03T16:15Z'],
  ['v4-c081-p017-001', 0, 0, 0, '1929-06-28T06:15Z'],
  ['v4-c081-p017-001', 0, 0, 1, '1929-06-28T16:15Z'],
  ['v4-c081-p017-001', 0, 0, 2, '1929-06-20T02:15Z'],
  ['v4-c081-p017-001', 0, 0, 3, '1929-06-10T20:15Z'],
  ['v4-c081-p017-001', 0, 0, 4, '1945-09-25T16:15Z'],
  ['v4-c081-p017-001', 0, 0, 5, '1956-09-10T08:15Z'],
  ['v4-c081-p017-001', 0, 0, 6, '1929-06-05T04:15Z'],
  ['v4-c081-p017-001', 0, 0, 7, '1929-05-26T16:15Z'],
  ['v4-c081-p017-001', 0, 0, 8, '1929-05-18T04:15Z'],
  ['v5-c002-p007-001', 0, 0, 0, '1930-02-10T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 0, '1956-08-09T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 1, '1956-09-08T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 2, '1945-10-16T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 3, '1930-12-04T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 4, '1931-12-19T08:15Z'],
  ['v5-c060-p011-001', 0, 0, 5, '1930-01-28T08:15Z'],
  ['v5-c071-p006-001', 0, 0, 0, '1956-08-12T00:15Z'],
  ['v5-c071-p006-001', 0, 0, 1, '1956-09-11T00:15Z'],
  ['v5-c071-p006-001', 0, 0, 2, '1945-10-09T00:15Z'],
  ['v5-c071-p006-001', 0, 0, 3, '1930-12-07T00:15Z'],
  ['v5-c071-p006-001', 0, 0, 4, '1930-01-01T00:15Z'],
  ['v5-c071-p006-001', 0, 0, 5, '1931-01-16T00:15Z'],
  ['v5-c071-p006-001', 1, 0, 0, '1989-05-01T00:15Z'],
  ['v5-c071-p006-001', 1, 0, 1, '1945-10-09T00:15Z'],
  ['v5-c071-p006-001', 1, 0, 2, '1931-01-16T00:15Z'],
  ['v5-c071-p006-001', 1, 0, 3, '1956-08-02T00:15Z'],
  ['v5-c196-p003-001', 0, 0, 0, '1956-08-14T08:15Z'],
  ['v5-c196-p003-001', 0, 0, 1, '1956-09-13T08:15Z'],
  ['v5-c196-p003-001', 0, 0, 2, '1945-10-11T08:15Z'],
  ['v5-c196-p003-001', 0, 0, 3, '1930-11-19T08:15Z'],
  ['v5-c196-p003-001', 0, 0, 4, '1930-12-19T08:15Z'],
  ['v5-c196-p003-001', 0, 0, 5, '1930-01-13T08:15Z'],
  ['v5-c218-p007-001', 0, 0, 0, '1940-04-19T00:15Z'],
  ['v5-c218-p007-001', 1, 0, 0, '1938-03-01T00:15Z'],
  ['v5-c218-p007-001', 1, 0, 1, '1938-03-01T00:15Z'],
  ['v5-c236-p002-001', 0, 0, 0, '1929-05-05T08:15Z'],
  ['v5-c236-p007-001', 0, 0, 0, '1929-05-12T04:15Z'],
  ['v5-c302-p002-001', 0, 0, 0, '1929-05-03T18:15Z'],
  ['v5-c302-p003-001', 0, 0, 0, '1930-01-07T10:15Z'],
  ['v5-c302-p008-001', 0, 0, 0, '1933-08-06T18:15Z'],
  ['v5-c333-p007-001', 0, 0, 0, '1929-05-24T02:15Z'],
  ['v5-c333-p011-001', 0, 0, 0, '1945-09-13T10:15Z'],
  ['v5-c422-p003-001', 0, 0, 0, '1952-04-26T16:15Z', '女'],
  ['v5-c422-p003-001', 0, 0, 1, '1952-04-27T14:15Z', '女'],
  ['v5-c422-p003-001', 0, 0, 2, '1964-05-02T22:15Z', '女'],
  ['v5-c422-p003-001', 0, 0, 3, '1952-04-15T22:15Z', '女'],
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

test('27 Yuanhai sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
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
  assert.deepEqual([sourceIds.length, groups, expected.size], [27, 32, 76]);

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
  assert.equal(charts.size, 70);
  assert.deepEqual(verified, expected);
});

test('wrong columns, secondary hidden wealth, and an excluded natal branch fail closed', () => {
  const partialWealth = native('1931-01-01T02:15Z');
  const forgedWealth = { kind: 'bazi_natal_configuration', name: '时干或时支本气见偏财' };
  assert.equal(explain('v4-c047-p004-002', [...partialWealth, forgedWealth]).matched, false);
  assert.equal(explain('v4-c047-p004-002', native('1931-01-09T16:15Z')).matched, false);

  const separateSeal = native('1930-12-31T16:15Z');
  const forgedClash = { kind: 'bazi_natal_configuration', name: '正印所在柱受刑或冲' };
  assert.equal(explain('v4-c053-p004-002', [...separateSeal, forgedClash]).matched, false);
  const tigerYear = native('1938-08-09T08:15Z');
  assert.equal(explain('v5-c196-p003-001', tigerYear).matched, false);
});

test('day prosperity at the hour distinguishes present from proved absent wealth', () => {
  const id = 'v3-c151-p005-001';
  const dateFor = passage => witnesses.find(([suffix, index]) => suffix === id && index === passage)[4];
  const present = native(dateFor(0)), absent = native(dateFor(1));
  assert.deepEqual(explain(id, present).matchedBranches.map(({ text }) => text), ['歸祿有財而獲福']);
  assert.deepEqual(explain(id, absent).matchedBranches.map(({ text }) => text), ['無財歸祿必須貧']);
  assert.equal(explain(id, absent, false).matched, false);
});
