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
import { compileBaziShenShaPlacementSource } from './bazi-shensha-placements.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-family-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const prefix = 'yhzp-v3-';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Suffix, passage, input group, alternative, birth instant in UTC, reported gender.
const witnesses = [
  ["c015-p001-001",0,0,0,"1932-02-13T16:15Z","女"],
  ["c015-p001-001",0,1,0,"1930-03-01T16:15Z","女"],
  ["c015-p001-001",0,2,0,"1930-01-18T20:15Z","女"],
  ["c016-p002-001",0,0,0,"1931-06-06T16:15Z","男"],
  ["c016-p002-001",0,0,1,"1930-06-11T16:15Z","男"],
  ["c016-p002-001",0,0,2,"1931-04-04T16:15Z","男"],
  ["c016-p002-001",0,0,3,"1930-02-08T16:15Z","男"],
  ["c016-p002-004",0,0,1,"1930-02-05T16:15Z","男"],
  ["c016-p002-004",0,0,14,"1930-01-12T16:15Z","男"],
  ["c016-p002-004",0,0,16,"1930-01-07T12:15Z","男"],
  ["c020-p002-003",0,0,0,"1929-12-31T16:15Z","女"],
  ["c022-p003-001",0,0,0,"1930-01-15T16:15Z","女"],
  ["c022-p003-001",0,0,1,"1930-02-02T16:15Z","女"],
  ["c022-p003-001",0,0,2,"1930-01-01T00:15Z","女"],
  ["c022-p004-001",0,0,0,"1930-01-15T20:15Z","女"],
  ["c022-p004-001",0,0,1,"1930-01-03T16:15Z","女"],
  ["c037-p002-001",0,0,11,"1929-12-31T16:15Z","女"],
  ["c087-p006-003",0,0,0,"1938-07-02T16:15Z","女"],
  ["c087-p006-003",0,1,0,"1932-07-03T16:15Z","女"],
  ["c087-p006-003",0,2,0,"1929-07-04T16:15Z","女"],
  ["c087-p006-003",0,3,0,"1935-07-03T16:15Z","女"],
  ["c125-p004-001",0,0,3,"1998-04-03T18:15Z","女"],
  ["c125-p004-001",0,1,1,"1998-05-15T18:15Z","女"],
  ["c125-p004-001",0,2,3,"1998-02-14T18:15Z","女"],
  ["c125-p004-001",0,3,3,"1998-02-14T18:15Z","女"],
  ["c125-p005-101",0,0,0,"1930-01-22T10:15Z","女"],
  ["c125-p005-101",0,1,0,"1930-01-13T04:15Z","女"],
  ["c125-p006-001",0,0,0,"1930-01-12T22:15Z","女"],
  ["c137-p002-101",0,0,0,"1929-12-31T16:15Z","男"],
  ["c137-p002-101",1,0,0,"1929-12-31T16:15Z","女"],
  ["c146-p002-003",0,0,0,"1974-02-11T16:15Z","女"],
  ["c146-p002-003",0,1,0,"1998-02-05T16:15Z","女"],
];

function native(birth, gender) {
  const instant = Date.parse(birth);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, chart: chartContext('bazi', present, absent, chartScope) };
}

const explain = (suffix, facts, timeKnown) =>
  explainClaim(prefix + suffix, 'bazi', request(facts, timeKnown).chart, undefined, catalog);

test('all reviewed Volume Three input groups reach SQLite, explanation and report quotation', () => {
  const ids = new Set(witnesses.map(([suffix]) => prefix + suffix));
  const statuses = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), found = new Set(), charts = new Map();
  for (const id of ids) {
    assert.equal(statuses.get(id), 'branch_indexed', id);
    const { claim, branches } = catalog.get(id);
    branches.forEach(({ inputs }, passage) => inputs.forEach((_, group) =>
      expected.add([id, passage, group].join('/'))));
    const changed = structuredClone(claim);
    changed.evidence.context += '异本文字';
    const compiled = compileYuanhaiNatalPassages(changed) ?? compileBaziShenShaPlacementSource(changed);
    assert.equal(compiled.reason, 'source_review_required');
  }
  assert.deepEqual([ids.size, expected.size], [13, 24]);
  for (const [suffix, passage, group, alternative, date, gender] of witnesses) {
    const id = prefix + suffix, caseKey = date + gender;
    if (!charts.has(caseKey)) {
      const { queries, chart } = request(native(date, gender));
      const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
        [...personality, ...events].map(hit => [hit.id, hit])));
      charts.set(caseKey, { chart, hits, derived: claimChartContext('bazi', chart) });
    }
    const { chart, hits, derived } = charts.get(caseKey);
    const { text, inputs } = catalog.get(id).branches[passage], input = inputs[group];
    const rule = input.anyOf.length ? { ...input, anyOf: [input.anyOf[alternative]] } : input;
    const label = [id, passage, group, alternative].join('/');
    assert.ok(evaluateRule(rule, 'natal', derived).matched, label);
    const detail = explainClaim(id, 'bazi', chart, undefined, catalog), hit = hits.get(id);
    assert.ok(hit && detail.matched, label);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, label);
    const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(hit.claim.evidence.original_text.includes(text) && material.includes(text), label);
    assert.doesNotMatch(material, /现代释义：/u, label);
    found.add([id, passage, group].join('/'));
  }
  assert.equal(charts.size, 29);
  assert.deepEqual(found, expected);
});

test('the hour officer requires the known hour while mutual year and day horses do not', () => {
  const officer = native('1930-01-13T04:15Z', '女');
  const horses = native('1929-12-31T16:15Z', '女');
  assert.ok(explain('c125-p005-101', officer).matched);
  assert.equal(explain('c125-p005-101', officer, false).matched, false);
  assert.ok(explain('c087-p006-003', horses, false).matched);
  const partialReports = lookup(request(horses, false).queries);
  assert.ok(partialReports.flatMap(({ events, personality }) => [...events, ...personality])
    .some(hit => hit.id === prefix + 'c087-p006-003'));
  const withoutYear = horses.filter(fact => fact.position !== 'year');
  assert.equal(explain('c087-p006-003', withoutYear, false).matched, false);
  const contradictory = [...horses, { kind: 'branch', position: 'year', branch: '卯' }];
  assert.equal(explain('c087-p006-003', contradictory, false).matched, false);
});

test('the male and female excerpts stay independent on the same pillars', () => {
  const suffix = 'c137-p002-101', birth = '1929-12-31T16:15Z';
  const female = native(birth, '女');
  const quotes = facts => explain(suffix, facts).matchedBranches?.map(branch => branch.text) ?? [];
  assert.deepEqual(quotes(female), ['女犯傷官偏印']);
  assert.deepEqual(quotes(native(birth, '男')), ['男逢比刼，傷官']);
  assert.deepEqual(quotes(female.filter(fact => fact.kind !== 'natal_gender')), []);
});

test('monthly and daily wealth must both be confirmed on their own branches', () => {
  const facts = native('1930-02-08T16:15Z', '男');
  const suffix = 'c016-p002-001';
  assert.ok(explain(suffix, facts).matched);
  assert.equal(explain(suffix, facts.filter(fact => fact.position !== 'month')).matched, false);
  assert.equal(explain(suffix, facts.filter(fact => fact.position !== 'day')).matched, false);
});
