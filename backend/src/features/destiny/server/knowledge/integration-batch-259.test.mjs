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
import { compileXingjueMigration } from './xingjue-migration.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-migration-review-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = record => 'ziwei-v3-xingjue-053-p' + record;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1934, 3, 15, 1, 'female'], ['689-001/0/0', '1480-001/0/1', '1480-001/0/2']],
  [[1938, 2, 14, 1, 'male'], ['1483-001/0/1', '1483-001/1/1', '1489-001/0/0']],
  [[1995, 4, 4, 11, 'male'], ['692-001/0/0', '1486-001/0/0', '1491-002/0/1']],
  [[1930, 9, 13, 11, 'female'], ['692-001/0/1', '1486-001/0/1']],
  [[1956, 6, 10, 7, 'male'], ['1493-001/0/0', '1501-002/0/0']],
  [[1994, 6, 6, 7, 'male'], ['1503-002/0/0', '1503-002/1/0']],
  [[1930, 9, 10, 1, 'male'], ['693-001/0/0', '1483-001/0/0']],
  [[1930, 1, 1, 0, 'female'], ['688-001/0/0']],
  [[1931, 2, 14, 8, 'male'], ['1501-002/0/1']],
  [[1931, 11, 3, 4, 'female'], ['1482-001/0/0']],
  [[1933, 12, 24, 11, 'male'], ['1503-001/0/0']],
  [[1945, 4, 24, 5, 'male'], ['1491-002/0/0']],
  [[1948, 5, 25, 3, 'female'], ['1480-001/0/0']],
  [[1949, 7, 15, 2, 'female'], ['1478-001/0/1']],
  [[1967, 10, 6, 11, 'male'], ['1478-001/0/0']],
  [[1988, 2, 22, 1, 'male'], ['1483-001/1/0']],
  [[1991, 2, 18, 2, 'male'], ['1482-001/0/1']],
];

function native([year, month, day, hour, gender]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
}

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, tradition: '紫微星诀',
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const sample = key => native(witnesses.find(([, keys]) => keys.includes(key))[0]);
const explain = (record, facts) => explainClaim(idOf(record), 'ziwei', query(facts).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('all reviewed migration groups reach SQLite, explanations and report materials from natal charts', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const record of ids) {
    const id = idOf(record), row = catalog.get(id);
    assert.equal(states.get(id), record === '1486-001' ? 'indexed' : 'branch_indexed', id);
    const passages = row.inputs ? [{ text: row.claim.evidence.original_text, inputs: row.inputs }] : row.branches;
    passages.forEach(({ text, inputs }, passage) => inputs.forEach((input, group) =>
      expected.set([record, passage, group].join('/'), { text, input })));
    const edited = structuredClone(row.claim);
    edited.source.edition = '待校';
    assert.equal(compileXingjueMigration(edited).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size, witnesses.length], [15, 27, 17]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const refs = lookup(queries), material = buildReportMaterials(refs);
    const hits = new Map(refs.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const record = key.split('/')[0], { text, input } = expected.get(key);
      assert.ok(evaluateRule(input, 'natal', chart).matched, key);
      const id = idOf(record);
      const hit = hits.get(id), explanation = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explanation.matched, key);
      assert.deepEqual(quotes(hit), quotes(explanation), key);
      assert.match(hit.calculationNote, /紫微星诀.*迁移/u);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const record of ['684-001', '696-001', '1479-001', '1494-001', '1500-001', '1501-001', '1501-003', '1502-001']) {
    assert.equal(states.get(idOf(record)), 'unmapped', record);
  }
});

test('the growth horse and the pond-gallery flanks require their confirmed placements', () => {
  const horse = sample('1478-001/0/0');
  assert.ok(explain('1478-001', horse).matched);
  assert.equal(explain('1478-001', horse.filter(fact => fact.kind !== 'natal_ziwei_bureau')).matched, false);
  const flanks = sample('1483-001/1/1'), base = '遷宮坐貴向貴';
  assert.deepEqual(quotes(explain('1483-001', flanks)), [base, '又福官貴來會、池閣夾者']);
  assert.deepEqual(quotes(explain('1483-001', flanks.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '仆役' || fact.star !== '龙池'))), [base]);
});

test('the natal Tianji Lu passage requires both actual carriers and the complete six-star exclusion', () => {
  for (const key of ['1491-002/0/0', '1491-002/0/1']) {
    const facts = sample(key);
    assert.deepEqual(quotes(explain('1491-002', facts)), ['化祿者、專作商販之業、江湖生涯']);
    assert.equal(explain('1491-001', facts).matched, false);
    assert.equal(explain('1491-002', facts.filter(fact => fact.kind !== 'star_mutagen'
      || fact.star !== '天机' || fact.change !== '禄')).matched, false);
    assert.equal(explain('1491-002', facts.filter(fact => fact.kind !== 'star_mutagen'
      || fact.star !== '太阴' || fact.change !== '忌')).matched, false);
    assert.equal(explain('1491-002', facts.filter(fact => fact.kind !== 'palace_origin_star_count'
      || fact.palace !== '迁移')).matched, false);
  }
});

test('the fallen Tan and bell passage preserves the source and quotes the confirmed configuration', () => {
  const id = idOf('1501-002'), facts = sample('1501-002/0/0');
  assert.match(catalog.get(id).claim.evidence.original_text, /客死他鄉/u);
  const refs = lookup(query(facts).queries).map(topic => ({
    ...topic,
    personality: topic.personality.filter(hit => hit.id === id),
    events: topic.events.filter(hit => hit.id === id),
  }));
  const material = buildReportMaterials(refs);
  assert.match(material, /遷宮陷地貪星與鈴星相聚者/u);
  assert.doesNotMatch(material, /客死|致殞/u);
  assert.equal(explain('1501-002', facts.filter(fact => fact.kind !== 'palace_brightness'
    || fact.palace !== '迁移' || fact.star !== '贪狼')).matched, false);
});
