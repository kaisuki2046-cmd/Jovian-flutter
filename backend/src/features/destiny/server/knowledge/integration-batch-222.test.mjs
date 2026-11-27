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

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-month-root-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// [source suffix, passage, input group, alternative, instant, gender if female]
const witnesses = [
  ['v4-c081-p007-001', 0, 0, 0, '1930-01-06T16:15Z'],
  ['v4-c081-p020-001', 0, 0, 0, '1930-01-13T06:15Z'],
  ['v4-c121-p002-001', 0, 0, 0, '1931-01-19T04:15Z'],
  ['v4-c121-p002-001', 0, 0, 1, '1922-01-06T04:15Z'],
  ['v4-c121-p002-001', 1, 0, 0, '1931-01-10T02:15Z'],
  ['v4-c121-p002-001', 1, 0, 1, '1942-02-01T02:15Z'],
  ['v4-c123-p003-001', 0, 0, 0, '1932-05-06T16:15Z'],
  ['v4-c126-p006-001', 0, 0, 0, '1932-02-07T00:15Z'],
  ['v4-c126-p006-001', 0, 0, 1, '1931-02-22T00:15Z'],
  ['v4-c126-p006-001', 0, 0, 2, '1939-02-09T20:15Z'],
  ['v4-c132-p007-001', 0, 0, 0, '1931-03-15T16:15Z'],
  ['v4-c132-p007-001', 0, 0, 1, '1931-03-15T22:15Z'],
  ['v4-c132-p007-001', 0, 1, 0, '1930-03-21T16:15Z'],
  ['v4-c132-p007-001', 0, 1, 1, '1930-03-21T22:15Z'],
  ['v4-c132-p008-001', 0, 0, 0, '1931-03-18T20:15Z'],
  ['v4-c162-p004-001', 0, 0, 0, '1933-09-24T16:15Z'],
  ['v4-c162-p004-001', 0, 0, 1, '1930-09-30T16:15Z'],
  ['v4-c162-p004-001', 0, 0, 2, '1930-09-30T18:15Z'],
  ['v4-c162-p004-001', 0, 1, 0, '1948-10-06T16:15Z'],
  ['v4-c162-p004-001', 0, 1, 1, '1933-09-15T16:15Z'],
  ['v4-c162-p004-001', 0, 1, 2, '1933-09-15T18:15Z'],
  ['v4-c162-p006-001', 0, 0, 0, '1997-09-24T16:15Z'],
  ['v4-c162-p006-001', 0, 0, 1, '1936-09-24T18:15Z'],
  ['v4-c162-p006-001', 0, 1, 0, '1936-09-16T04:15Z'],
  ['v4-c162-p006-001', 0, 1, 1, '1906-09-13T18:15Z'],
  ['v4-c168-p003-001', 0, 0, 0, '1940-10-28T04:15Z'],
  ['v4-c168-p003-001', 0, 0, 1, '1932-10-09T16:15Z'],
  ['v4-c168-p003-001', 0, 0, 2, '1932-10-10T04:15Z'],
  ['v4-c168-p003-001', 0, 0, 3, '1941-10-13T06:15Z'],
  ['v4-c168-p003-001', 0, 0, 4, '1932-10-10T06:15Z'],
  ['v4-c168-p003-001', 0, 1, 0, '1930-10-22T00:15Z'],
  ['v4-c168-p003-001', 0, 1, 1, '1937-10-24T20:15Z'],
  ['v4-c168-p003-001', 0, 1, 2, '1930-10-22T00:15Z'],
  ['v4-c168-p003-001', 0, 1, 3, '1901-10-14T00:15Z'],
  ['v4-c168-p003-001', 0, 1, 4, '1930-11-01T02:15Z'],
  ['v4-c180-p006-001', 0, 0, 0, '1930-01-01T04:15Z'],
  ['v4-c186-p006-001', 0, 0, 0, '1913-01-07T10:15Z'],
  ['v5-c136-p005-001', 0, 0, 0, '1933-04-10T04:15Z'],
  ['v5-c136-p005-001', 0, 0, 1, '1930-04-13T04:15Z'],
  ['v5-c136-p005-001', 0, 1, 0, '1938-04-18T16:15Z'],
  ['v5-c136-p005-001', 0, 1, 1, '1939-05-03T16:15Z'],
  ['v5-c136-p005-001', 0, 1, 2, '1930-04-30T16:15Z'],
  ['v5-c136-p005-001', 0, 2, 0, '1938-04-27T16:15Z'],
  ['v5-c136-p005-001', 0, 2, 1, '1939-04-12T16:15Z'],
  ['v5-c136-p005-001', 0, 2, 2, '1930-04-09T20:15Z'],
  ['v5-c136-p005-001', 0, 3, 0, '1935-05-03T18:15Z'],
  ['v5-c136-p005-001', 0, 3, 1, '1934-05-04T00:15Z'],
  ['v5-c136-p005-001', 0, 3, 2, '1930-04-24T20:15Z'],
  ['v5-c136-p005-001', 0, 4, 0, '1933-04-12T16:15Z'],
  ['v5-c136-p005-001', 0, 4, 1, '1934-04-13T06:15Z'],
  ['v5-c136-p005-001', 0, 4, 2, '1931-04-19T00:15Z'],
  ['v5-c136-p005-001', 0, 5, 0, '1937-10-09T18:15Z'],
  ['v5-c136-p005-001', 0, 5, 1, '1931-10-24T16:15Z'],
  ['v5-c136-p005-001', 0, 5, 2, '1930-10-10T04:15Z'],
  ['v5-c136-p005-001', 0, 6, 0, '1937-10-27T20:15Z'],
  ['v5-c136-p005-001', 0, 6, 1, '1931-10-12T16:15Z'],
  ['v5-c136-p005-001', 0, 6, 2, '1930-10-25T02:15Z'],
  ['v5-c136-p005-001', 0, 7, 0, '1937-10-18T16:15Z'],
  ['v5-c136-p005-001', 0, 7, 1, '1931-10-21T16:15Z'],
  ['v5-c136-p005-001', 0, 7, 2, '1930-10-15T22:15Z'],
  ['v5-c136-p005-001', 0, 8, 0, '1937-10-22T10:15Z'],
  ['v5-c136-p005-001', 0, 8, 1, '1936-10-10T00:15Z'],
  ['v5-c136-p005-001', 0, 8, 2, '1930-10-21T20:15Z'],
  ['v5-c136-p005-001', 0, 9, 0, '1937-10-12T16:15Z'],
  ['v5-c136-p005-001', 0, 9, 1, '1931-10-15T16:15Z'],
  ['v5-c136-p005-001', 0, 9, 2, '1930-10-10T02:15Z'],
  ['v5-c136-p005-001', 0, 10, 0, '1930-01-21T16:15Z'],
  ['v5-c136-p005-001', 0, 10, 1, '1931-01-06T16:15Z'],
  ['v5-c136-p005-001', 0, 10, 2, '1931-01-07T10:15Z'],
  ['v5-c136-p005-001', 0, 11, 0, '1930-01-09T16:15Z'],
  ['v5-c136-p005-001', 0, 11, 1, '1931-01-24T16:15Z'],
  ['v5-c136-p005-001', 0, 11, 2, '1930-01-09T22:15Z'],
  ['v5-c136-p005-001', 0, 12, 0, '1932-01-12T16:15Z'],
  ['v5-c136-p005-001', 0, 12, 1, '1931-01-15T16:15Z'],
  ['v5-c136-p005-001', 0, 12, 2, '1931-01-15T18:15Z'],
  ['v5-c136-p005-001', 0, 13, 0, '1934-01-06T16:15Z'],
  ['v5-c136-p005-001', 0, 13, 1, '1931-01-19T06:15Z'],
  ['v5-c136-p005-001', 0, 13, 2, '1934-01-06T18:15Z'],
  ['v5-c136-p005-001', 0, 14, 0, '1930-01-25T00:15Z'],
  ['v5-c136-p005-001', 0, 14, 1, '1931-01-09T16:15Z'],
  ['v5-c136-p005-001', 0, 14, 2, '1931-01-09T22:15Z'],
  ['v5-c136-p005-001', 0, 15, 0, '1937-07-21T18:15Z'],
  ['v5-c136-p005-001', 0, 15, 1, '1932-07-27T18:15Z'],
  ['v5-c136-p005-001', 0, 15, 2, '1932-07-27T18:15Z'],
  ['v5-c136-p005-001', 0, 16, 0, '1935-07-18T16:15Z'],
  ['v5-c136-p005-001', 0, 16, 1, '1933-07-12T16:15Z'],
  ['v5-c136-p005-001', 0, 16, 2, '1930-07-18T22:15Z'],
  ['v5-c136-p005-001', 0, 17, 0, '1935-07-09T20:15Z'],
  ['v5-c136-p005-001', 0, 17, 1, '1938-07-27T16:15Z'],
  ['v5-c136-p005-001', 0, 17, 2, '1930-07-09T18:15Z'],
  ['v5-c136-p005-001', 0, 18, 0, '1939-07-15T16:15Z'],
  ['v5-c136-p005-001', 0, 18, 1, '1932-07-09T16:15Z'],
  ['v5-c136-p005-001', 0, 18, 2, '1931-07-16T06:15Z'],
  ['v5-c136-p005-001', 0, 19, 0, '1937-07-25T04:15Z'],
  ['v5-c136-p005-001', 0, 19, 1, '1931-07-25T08:15Z'],
  ['v5-c136-p005-001', 0, 19, 2, '1936-07-28T06:15Z'],
  ['v5-c147-p002-001', 0, 0, 0, '1931-03-31T20:15Z'],
  ['v5-c153-p009-001', 0, 0, 0, '1930-07-10T10:15Z'],
  ['v5-c243-p004-001', 0, 0, 0, '1931-04-15T16:15Z'],
  ['v5-c243-p004-001', 0, 0, 1, '1930-11-06T16:15Z'],
  ['v5-c243-p004-001', 0, 0, 2, '1931-01-15T16:15Z'],
  ['v5-c243-p004-001', 0, 0, 3, '1930-07-09T16:15Z'],
  ['v5-c243-p004-001', 0, 0, 4, '1930-08-18T16:15Z'],
  ['v5-c243-p004-001', 0, 0, 5, '1930-09-27T16:15Z'],
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

test('16 Yuanhai sources and every reviewed alternative reach the production SQLite lookup and report materials', () => {
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
  assert.deepEqual([sourceIds.length, groups, expected.size], [16, 40, 104]);

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
  assert.equal(charts.size, 101);
  assert.deepEqual(verified, expected);
});

test('a root of the same element and different polarity defeats the no-root branch', () => {
  const id = 'v4-c132-p008-001';
  const date = witnesses.find(([suffix]) => suffix === id).at(-1);
  assert.ok(explain(id, native(date)).matched);
  assert.equal(explain(id, native(date), false).matched, false);

  const rooted = native('1930-03-13T20:15Z');
  const { present } = claimChartContext('bazi', request(rooted).chart);
  const hiddenWater = (stem, count) => present.some(f => f.kind === 'bazi_stem_placement_count'
    && f.stem === stem && f.placement === 'hidden' && f.count === count);
  assert.ok(hiddenWater('壬', 1) && hiddenWater('癸', 0));
  const supplied = { kind: 'bazi_stem_placement_count', stem: '壬', placement: 'hidden', count: 0 };
  assert.equal(explain(id, [...rooted, supplied]).matched, false);
});

test('unsupported source excerpts do not match on a subset of their premises', () => {
  const date = witnesses.find(([suffix]) => suffix === 'v4-c121-p002-001').at(-1);
  const detail = explain('v4-c121-p002-001', native(date));
  assert.ok(detail.matched);
  assert.deepEqual(detail.matchedBranches.map(({ text }) => text), ['金多則折']);
  const impossible = explain('v4-c140-p003-001', native(date));
  assert.equal(impossible.matched, false);
  assert.match(impossible.reviewNote, /均含戊/u);
});
