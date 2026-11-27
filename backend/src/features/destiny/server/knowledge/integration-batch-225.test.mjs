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
import { compileBaziClassicalStructures } from './bazi-classical-structures.mjs';
import { compileYuanhaiNatalPassages } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-classical-exclusions-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant]
const witnesses = [
  ['yhzp-v2-c308-p002-001', 0, 0, 0, '1931-06-10T04:15Z'],
  ['yhzp-v2-c308-p002-001', 0, 0, 1, '1938-07-13T04:15Z'],
  ['yhzp-v2-c308-p002-001', 0, 0, 2, '1930-02-25T06:15Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 0, '1926-09-08T00:00Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 1, '1930-08-18T00:00Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 2, '2018-09-05T00:00Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 3, '1932-02-09T00:00Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 4, '1936-06-07T00:15Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 5, '1908-10-12T00:00Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 6, '1940-08-24T20:15Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 7, '1940-08-25T04:15Z'],
  ['yhzp-v2-c329-p002-001', 0, 0, 8, '1940-08-25T12:15Z'],
  ['yhzp-v2-c354-p002-001', 0, 0, 0, '1950-09-23T20:15Z'],
  ['yhzp-v2-c354-p002-001', 0, 0, 1, '1931-12-12T20:15Z'],
  ['yhzp-v5-c250-p004-001', 0, 0, 0, '1939-07-19T06:15Z'],
  ['yhzp-v5-c250-p004-001', 0, 1, 0, '1931-05-04T02:15Z'],
  ['yhzp-v5-c250-p004-001', 0, 2, 0, '1932-09-04T04:15Z'],
  ['yhzp-v5-c250-p004-001', 0, 3, 0, '1925-09-26T14:00Z'],
  ['yhzp-v5-c250-p004-001', 0, 4, 0, '1951-03-23T18:15Z'],
  ['yhzp-v5-c266-p002-001', 0, 0, 0, '1931-12-12T20:15Z'],
  ['yhzp-v5-c422-p007-001', 0, 0, 0, '1933-05-09T20:15Z'],
  ['yhzp-v5-c422-p007-001', 0, 0, 1, '1935-03-06T18:15Z'],
  ['yhzp-v5-c422-p007-001', 0, 0, 2, '1930-07-01T10:15Z'],
  ['yhzp-v5-c422-p007-001', 1, 0, 0, '1935-12-22T00:15Z'],
  ['yhzp-v5-c422-p007-001', 1, 0, 1, '1930-03-27T22:15Z'],
  ['dtsjy-v1-c025-p002-001', 0, 0, 0, '1938-02-15T20:15Z'],
  ['zpzq-v1-c032-p002-001', 0, 0, 0, '1934-02-07T10:15Z'],
  ['zpzq-v1-c042-p015-201', 0, 0, 0, '1968-12-25T18:00Z'],
  ['zpzq-v1-c048-p013-001', 0, 0, 0, '1952-03-06T00:15Z'],
  ['zpzq-v1-c048-p014-201', 0, 0, 0, '2023-03-22T14:00Z'],
  ['qtbj-v2-c004-p007-001', 0, 0, 0, '1930-03-25T02:15Z'],
  ['qtbj-v5-c068-p003-101', 0, 0, 0, '1923-03-08T00:00Z'],
];

const sourceIds = [...new Set(witnesses.map(([id]) => id))];

function native(birthTime, gender = '女') {
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

function explain(id, facts, timeKnown) {
  return explainClaim(id, 'bazi', request(facts, timeKnown).chart, undefined, catalog);
}

test('13 reviewed sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
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
    const compile = id.startsWith('yhzp-') ? compileYuanhaiNatalPassages : compileBaziClassicalStructures;
    assert.equal(compile(altered).reason, 'source_review_required', id);
  }
  assert.deepEqual([sourceIds.length, groups, expected.size], [13, 18, 32]);

  for (const [id, passage, group, choice, date] of witnesses) {
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
  assert.equal(charts.size, 31);
  assert.deepEqual(verified, expected);
});

test('a clash into the empty Lu position and unknown hour defeat the day-hour pattern', () => {
  const id = 'yhzp-v5-c250-p004-001';
  assert.ok(explain(id, native('1939-07-19T06:15Z')).matched);
  assert.equal(explain(id, native('1939-07-19T06:15Z'), false).matched, false);
  const clashing = native('1972-07-25T06:00Z');
  const hasPillar = (position, ganZhi) => clashing.some(f => f.kind === 'pillar' && f.position === position && f.ganZhi === ganZhi);
  assert.ok(hasPillar('year', '壬子') && hasPillar('day', '丁巳') && hasPillar('hour', '丁未'));
  assert.equal(explain(id, clashing).matched, false);
});

test('an exposed seal blocks following, even if Seven Killings remains in all four pillars', () => {
  const id = 'zpzq-v1-c048-p014-201';
  const original = native('2023-03-22T14:00Z');
  assert.ok(explain(id, original).matched);
  const blocked = native('2023-03-21T22:00Z');
  const { present } = claimChartContext('bazi', request(blocked).chart);
  assert.ok(present.some(f => f.kind === 'bazi_ten_god_count' && f.tenGod === '七杀' && f.count === 4));
  assert.ok(present.some(f => f.kind === 'stem_ten_god' && f.position === 'hour' && f.tenGod === '偏印'));
  assert.equal(explain(id, blocked).matched, false);
});

test('the peer branch quotes just its own line and requires the verified peer', () => {
  const id = 'qtbj-v5-c068-p003-101';
  const original = native('1923-03-08T00:00Z');
  assert.deepEqual(explain(id, original).matchedBranches.map(({ text }) => text), ['若见一比，又主孤贫。']);
  assert.equal(explain(id, native('1923-03-08T10:00Z')).matched, false);
});

test('a different gender cannot inherit a gendered same-pillar excerpt', () => {
  const id = 'yhzp-v5-c422-p007-001';
  assert.ok(explain(id, native('1933-05-09T20:15Z')).matched);
  assert.equal(explain(id, native('1933-05-09T20:15Z', '男')).matched, false);
});
