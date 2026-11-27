import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueFemale } from './xingjue-female.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-female-review-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = record => 'ziwei-v3-xingjue-059-p' + record;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1939, 11, 11, 2], ['1664-001/0/15', '1673-001/0/3', '1679-001/0/0', '1684-001/0/4', '1684-001/0/6', '1684-001/0/7']],
  [[1960, 10, 2, 5], ['781-001/0/2', '1665-001/0/1', '1665-001/1/0', '1665-001/1/1']],
  [[1958, 11, 19, 11], ['1663-001/0/0', '1673-001/0/0', '1673-001/1/0']],
  [[1959, 11, 27, 7], ['1671-001/0/5', '1673-001/0/4', '1673-001/1/2']],
  [[1958, 11, 19, 0], ['1684-001/0/0', '1684-001/0/1']],
  [[1959, 6, 2, 3], ['1664-001/0/6', '1673-001/0/5']],
  [[1960, 7, 15, 6], ['781-001/0/3', '1684-001/0/5']],
  [[1934, 11, 27, 10], ['1664-001/0/5', '1673-001/0/1']],
  [[1942, 1, 13, 9], ['1664-001/0/11', '1671-001/0/3']],
  [[1967, 6, 10, 3], ['1684-001/0/2', '1684-001/0/3']],
  [[1930, 1, 1, 8], ['1662-001/0/0']],
  [[1930, 1, 1, 11], ['1666-001/0/0']],
  [[1930, 2, 6, 0], ['781-001/0/0']],
  [[1930, 2, 6, 2], ['781-001/0/1']],
  [[1930, 2, 6, 11], ['1667-001/0/2']],
  [[1930, 4, 16, 3], ['1676-001/1/1']],
  [[1930, 4, 16, 5], ['1662-001/0/1']],
  [[1930, 6, 26, 2], ['782-001/0/0']],
  [[1930, 8, 8, 5], ['779-001/0/0']],
  [[1930, 9, 13, 0], ['1671-001/0/0']],
  [[1930, 11, 23, 3], ['1673-001/0/2']],
  [[1931, 3, 19, 7], ['779-001/0/1']],
  [[1931, 6, 6, 4], ['1671-001/0/2']],
  [[1932, 3, 27, 0], ['1665-001/0/0']],
  [[1932, 8, 24, 4], ['1664-001/0/18']],
  [[1932, 10, 6, 4], ['1664-001/0/3']],
  [[1932, 11, 11, 1], ['1673-001/1/3']],
  [[1932, 12, 16, 4], ['1664-001/0/8']],
  [[1932, 12, 16, 11], ['1671-001/0/1']],
  [[1958, 1, 25, 0], ['1668-001/0/4']],
  [[1958, 2, 2, 4], ['1664-001/0/9']],
  [[1958, 5, 17, 6], ['1664-001/0/14']],
  [[1958, 10, 14, 3], ['1676-001/1/0']],
  [[1958, 10, 14, 9], ['1676-001/0/0']],
  [[1959, 4, 20, 2], ['1664-001/0/10']],
  [[1960, 11, 7, 0], ['1668-001/0/3']],
  [[1933, 3, 7, 3], ['1664-001/0/27']],
  [[1933, 11, 19, 11], ['1673-001/1/1']],
  [[1934, 3, 15, 0], ['1664-001/0/7']],
  [[1934, 7, 7, 8], ['1671-001/0/4']],
  [[1935, 8, 20, 4], ['1664-001/0/12']],
  [[1936, 4, 8, 9], ['1676-001/0/1']],
  [[1936, 6, 18, 0], ['1667-001/0/3']],
  [[1938, 1, 9, 2], ['1668-001/0/7']],
  [[1938, 1, 9, 10], ['1668-001/0/1']],
  [[1938, 7, 11, 8], ['1667-001/0/1']],
  [[1938, 12, 8, 0], ['1664-001/0/17']],
  [[1939, 10, 6, 4], ['1664-001/0/22']],
  [[1941, 12, 4, 10], ['1664-001/0/2']],
  [[1944, 9, 13, 10], ['1664-001/0/16']],
  [[1944, 12, 28, 5], ['1664-001/0/4']],
  [[1947, 3, 7, 2], ['1667-001/0/0']],
  [[1950, 5, 13, 10], ['1668-001/0/0']],
  [[1951, 3, 11, 0], ['1668-001/0/5']],
  [[1951, 3, 11, 10], ['1664-001/0/19']],
  [[1953, 1, 17, 4], ['1664-001/0/13']],
  [[1953, 3, 27, 8], ['1664-001/0/28']],
  [[1954, 9, 9, 10], ['1664-001/0/0']],
  [[1955, 10, 22, 2], ['1668-001/0/6']],
  [[1960, 2, 22, 10], ['1664-001/0/21']],
  [[1971, 10, 10, 10], ['1668-001/0/2']],
  [[1976, 2, 10, 4], ['1664-001/0/23']],
  [[1977, 3, 23, 2], ['1668-001/0/8']],
  [[1980, 11, 3, 10], ['1664-001/0/1']],
  [[1985, 4, 8, 9], ['1664-001/0/26']],
  [[2005, 3, 23, 4], ['1664-001/0/24']],
  [[1988, 2, 18, 9], ['1664-001/0/25']],
  [[1995, 1, 13, 10], ['1664-001/0/20']],
  [[1944, 11, 21, 0], ['788-001/0/0']],
];

function native([year, month, day, hour]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));
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

test('all reviewed female-chapter groups reach SQLite, explanations and report materials from natal charts', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const record of ids) {
    const id = idOf(record), row = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', id);
    row.branches.forEach(({ text, inputs }, passage) => inputs.forEach((input, group) =>
      expected.set([record, passage, group].join('/'), { text, input })));
    const edited = structuredClone(row.claim);
    edited.source.edition = '待校';
    assert.equal(compileXingjueFemale(edited).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size, witnesses.length], [16, 87, 69]);
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
      assert.match(hit.calculationNote, /紫微星诀.*女命/u);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const record of ['777-001', '778-001', '1669-001', '1670-001', '1677-001', '1678-001', '1682-001']) {
    assert.equal(states.get(idOf(record)), 'unmapped', record);
  }
});

test('female-chapter rules require the confirmed female scope and independently verified body seat', () => {
  const life = sample('779-001/0/0');
  assert.ok(explain('779-001', life).matched);
  const unknown = life.filter(fact => fact.kind !== 'natal_gender');
  const male = { kind: 'natal_gender', gender: '男' };
  assert.equal(explain('779-001', unknown).matched, false);
  assert.equal(explain('779-001', unknown.concat(male)).matched, false);
  assert.equal(explain('779-001', life.concat(male)).matched, false);

  const body = sample('1666-001/0/0');
  assert.ok(explain('1666-001', body).matched);
  const unverified = body.filter(fact => fact.kind !== 'natal_ziwei_hour')
    .concat({ kind: 'palace_confirmed_body_seat', palace: '夫妻' });
  assert.equal(explain('1666-001', unverified).matched, false);
});

test('kin-palace and split-void extensions preserve their separate birth conditions', () => {
  const kin = sample('1665-001/1/0'), lights = '夫子二宮、逢日月於生旺地';
  assert.deepEqual(quotes(explain('1665-001', kin)), [lights, '與文星科星相會者']);
  assert.deepEqual(quotes(explain('1665-001', kin.filter(fact => fact.kind !== 'star_mutagen'
    || fact.change !== '科'))), [lights]);

  const voids = sample('1673-001/1/0');
  assert.deepEqual(quotes(explain('1673-001', voids)), ['空刧迭身命', '於衰死鄉']);
  assert.deepEqual(quotes(explain('1673-001', voids.filter(fact => fact.kind !== 'natal_ziwei_bureau'))), ['空刧迭身命']);
});

test('report material and structured references quote the matched configuration', async () => {
  const id = idOf('1663-001');
  const { queries } = query(sample('1663-001/0/0'));
  const row = catalog.get(id);
  assert.match(row.claim.evidence.original_text, /蕩敗家契|貧窮夭折/u);
  const passageOnly = input => lookup(input).map(topic => ({
    ...topic,
    personality: topic.personality.filter(hit => hit.id === id),
    events: topic.events.filter(hit => hit.id === id),
  }));
  let sent;
  await generateReport({ chartQueries: queries }, { lookup: passageOnly, complete: async payload => {
    sent = payload;
    return '报告';
  }, signal: new AbortController().signal });
  const passage = sent.references.flatMap(topic => [...topic.personality, ...topic.events]).find(hit => hit.id === id);
  assert.equal(passage.title, '《紫微星诀》女命篇盘面分句');
  assert.equal(passage.evidence.original_text, '天機巨門天梁太陰');
  assert.deepEqual(passage.interpretation.limitations, []);
  assert.match(sent.materials, /天機巨門天梁太陰/u);
  assert.doesNotMatch(sent.materials, /蕩敗家契|貧窮夭折/u);
});
