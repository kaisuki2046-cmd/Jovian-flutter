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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-natal-batch-216-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant, gender if female]
const witnesses = [
  ['v1-c333-p009-001', 0, 0, 0, '1930-01-03T16:15Z'],
  ['v1-c333-p009-001', 0, 0, 1, '1930-01-03T18:15Z'],
  ['v1-c333-p009-001', 0, 0, 2, '1930-03-15T22:15Z'],
  ['v1-c333-p009-001', 1, 0, 0, '1929-12-31T20:15Z'],
  ['v1-c333-p009-001', 1, 0, 1, '1930-01-06T20:15Z'],
  ['v1-c333-p009-001', 1, 0, 2, '1930-01-06T16:15Z'],
  ['v1-c333-p010-001', 0, 0, 0, '1930-01-03T16:15Z'],
  ['v1-c351-p005-001', 0, 0, 0, '1930-02-25T00:15Z'],
  ['v2-c217-p002-001', 0, 0, 0, '1930-01-21T18:15Z'],
  ['v2-c217-p003-001', 0, 0, 0, '1932-07-27T20:15Z'],
  ['v2-c225-p002-001', 0, 0, 0, '1935-02-07T04:15Z'],
  ['v2-c225-p002-001', 0, 0, 1, '1930-03-24T18:15Z'],
  ['v2-c225-p002-001', 0, 0, 2, '1933-03-19T04:15Z'],
  ['v2-c225-p002-001', 0, 0, 3, '1931-02-27T18:15Z'],
  ['v2-c230-p004-001', 0, 0, 0, '1930-02-09T16:15Z'],
  ['v2-c230-p004-001', 1, 0, 0, '1930-01-12T16:15Z'],
  ['v2-c230-p004-001', 2, 0, 0, '1929-12-31T20:15Z'],
  ['v2-c230-p005-001', 0, 0, 0, '1929-12-31T16:15Z'],
  ['v2-c250-p002-001', 0, 0, 0, '1930-01-04T08:15Z'],
  ['v2-c250-p002-001', 0, 1, 0, '1932-06-21T20:15Z'],
  ['v2-c250-p002-001', 0, 2, 0, '1932-02-12T20:15Z'],
  ['v2-c252-p002-001', 0, 0, 0, '1930-01-15T20:15Z'],
  ['v2-c252-p004-001', 0, 0, 0, '1930-11-04T02:15Z'],
  ['v2-c252-p004-001', 0, 0, 1, '1930-11-04T10:15Z'],
  ['v2-c252-p004-001', 0, 0, 2, '1939-03-10T04:15Z'],
  ['v2-c252-p004-001', 0, 0, 3, '1930-05-19T02:15Z'],
  ['v2-c252-p006-002', 0, 0, 0, '1929-12-31T16:15Z'],
  ['v2-c263-p002-001', 0, 0, 0, '1930-01-03T22:15Z'],
  ['v2-c273-p002-001', 0, 0, 0, '1900-02-09T16:15Z'],
  ['v2-c273-p002-001', 0, 0, 1, '1932-05-18T16:15Z'],
  ['v2-c273-p002-001', 0, 0, 2, '1934-08-18T16:15Z'],
  ['v2-c275-p002-001', 0, 0, 0, '1932-08-24T20:15Z'],
  ['v2-c275-p002-001', 0, 0, 1, '1932-08-12T20:15Z'],
  ['v2-c275-p002-001', 0, 0, 2, '1932-08-18T16:15Z'],
  ['v2-c277-p002-002', 0, 0, 0, '1934-11-04T16:15Z'],
  ['v2-c277-p002-002', 0, 0, 1, '1922-03-13T12:15Z'],
  ['v2-c277-p002-002', 0, 0, 2, '1900-11-03T12:15Z'],
  ['v2-c277-p002-002', 0, 1, 0, '1964-04-30T16:15Z'],
  ['v2-c277-p002-002', 0, 2, 0, '1904-05-03T16:15Z'],
  ['v2-c277-p002-002', 0, 2, 1, '1904-03-05T00:15Z'],
  ['v2-c277-p002-002', 0, 2, 2, '1904-05-04T00:15Z'],
  ['v2-c277-p002-002', 0, 3, 0, '1994-11-01T16:15Z'],
  ['v2-c291-p002-001', 0, 0, 0, '1930-02-07T02:15Z'],
  ['v2-c296-p004-001', 0, 0, 0, '1930-01-10T08:15Z'],
  ['v2-c301-p002-001', 0, 0, 0, '1930-01-01T10:15Z'],
  ['v2-c301-p002-001', 1, 0, 0, '1930-01-04T04:15Z'],
  ['v2-c301-p002-001', 1, 0, 1, '1930-01-13T06:15Z'],
  ['v2-c301-p002-001', 1, 0, 2, '1930-08-01T06:15Z'],
  ['v2-c301-p002-002', 0, 0, 0, '1930-01-01T10:15Z'],
  ['v2-c301-p002-002', 1, 0, 0, '1930-01-12T16:15Z'],
  ['v2-c301-p002-002', 1, 0, 1, '1930-01-12T18:15Z'],
  ['v2-c301-p002-002', 1, 0, 2, '1930-07-31T18:15Z'],
  ['v2-c326-p002-001', 0, 0, 0, '1931-04-07T00:15Z'],
  ['v2-c326-p002-001', 1, 0, 0, '1938-02-28T20:15Z'],
  ['v2-c363-p002-001', 0, 0, 0, '1930-02-25T12:15Z'],
  ['v2-c363-p002-001', 0, 0, 1, '1930-02-16T12:15Z'],
  ['v2-c373-p003-001', 0, 0, 0, '1931-04-12T18:15Z'],
  ['v2-c373-p003-001', 0, 0, 1, '1901-04-11T12:15Z'],
  ['v2-c377-p002-001', 0, 0, 0, '1938-03-12T16:15Z'],
  ['v2-c377-p002-001', 0, 0, 1, '1935-08-06T16:15Z'],
  ['v2-c389-p002-001', 0, 0, 0, '1930-03-24T20:15Z'],
  ['v2-c389-p002-001', 0, 0, 1, '1936-02-22T04:15Z'],
  ['v2-c389-p002-001', 0, 1, 0, '1931-06-28T12:15Z'],
  ['v2-c389-p002-001', 0, 2, 0, '1930-10-21T20:15Z'],
  ['v2-c391-p002-001', 0, 0, 0, '1930-02-12T20:15Z'],
  ['v2-c393-p002-001', 0, 0, 0, '1938-12-28T00:15Z'],
  ['v2-c393-p002-001', 0, 0, 1, '1930-01-04T00:15Z'],
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
  assert.deepEqual([sourceIds.length, groups, expected.size], [27, 40, 67]);

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
  assert.equal(charts.size, 62);
  assert.deepEqual(verified, expected);
});

test('a single clash and a supplied derived position cannot satisfy the reviewed clauses', () => {
  const oneClash = native('1934-03-09T16:15Z');
  const fakeSecondClash = { kind: 'bazi_branch_relation', relation: '六冲', first: 'month', second: 'day' };
  assert.equal(explain('v2-c277-p002-002', oneClash).matched, false);
  assert.equal(explain('v2-c277-p002-002', [...oneClash, fakeSecondClash]).matched, false);

  const onlyHiddenWealth = native('1931-01-01T02:15Z');
  const suppliedHourWealth = { kind: 'bazi_natal_configuration', name: '时干偏财' };
  assert.equal(explain('v2-c296-p004-001', [...onlyHiddenWealth, suppliedHourWealth]).matched, false);
});

test('hour-only and repeated killing clauses are independent and need all birth columns', () => {
  const id = 'v2-c301-p002-001';
  const lone = native('1930-01-01T10:15Z'), repeated = native('1930-01-04T04:15Z');
  const misleadingCount = { kind: 'bazi_ten_god_count', tenGod: '七杀', count: 4 };
  assert.deepEqual(explain(id, [...lone, misleadingCount]).matchedBranches.map(({ text }) => text),
    ['夫一位貴者，惟只時上只見一位方爲貴。']);
  assert.deepEqual(explain(id, repeated).matchedBranches.map(({ text }) => text), ['或年月日又有，反爲辛苦勞役之人也。']);
  assert.equal(explain(id, repeated, false).matched, false);
});
