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
import { compileXingjueEstate } from './xingjue-estate.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-estate-review-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = record => 'ziwei-v3-xingjue-056-p' + record;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1944, 11, 21, 0, 'male'], ['740-001/0/0', '746-001/0/0', '746-001/1/0']],
  [[1964, 3, 3, 0, 'female'], ['738-001/0/0', '1587-001/0/0', '1587-001/1/0']],
  [[1967, 12, 25, 3, 'female'], ['1563-001/0/0', '1563-001/1/0']],
  [[1944, 9, 5, 7, 'male'], ['1565-001/0/0', '1565-001/1/0']],
  [[1933, 9, 9, 0, 'female'], ['748-001/0/4', '748-001/0/5']],
  [[1978, 3, 3, 5, 'female'], ['743-001/0/0', '743-001/1/0']],
  [[2015, 8, 25, 6, 'female'], ['748-001/0/0', '748-001/0/1']],
  [[1933, 4, 27, 1, 'male'], ['1568-001/0/3', '1568-001/1/0']],
  [[1976, 2, 27, 0, 'male'], ['748-001/0/2', '748-001/0/3']],
  [[1930, 5, 21, 2, 'female'], ['734-001/0/1']],
  [[1930, 5, 21, 7, 'female'], ['1576-001/0/0']],
  [[1930, 8, 8, 6, 'male'], ['813-001/0/0']],
  [[1930, 9, 13, 4, 'female'], ['812-001/0/0']],
  [[1930, 9, 13, 5, 'female'], ['745-001/0/0']],
  [[1930, 10, 18, 0, 'male'], ['734-001/0/0']],
  [[1932, 3, 27, 4, 'female'], ['1564-001/0/0']],
  [[1932, 7, 19, 4, 'female'], ['1568-001/0/2']],
  [[1944, 2, 25, 0, 'male'], ['740-001/1/0']],
  [[1952, 3, 19, 7, 'female'], ['1568-001/0/0']],
  [[1953, 2, 22, 5, 'male'], ['1568-001/0/1']],
  [[1946, 8, 18, 0, 'male'], ['748-001/0/6']],
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

test('all reviewed estate groups reach SQLite, explanations and report materials from natal charts', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const record of ids) {
    const id = idOf(record), row = catalog.get(id);
    assert.equal(states.get(id), record === '734-001' ? 'indexed' : 'branch_indexed', id);
    const passages = row.inputs ? [{ text: row.claim.evidence.original_text, inputs: row.inputs }] : row.branches;
    passages.forEach(({ text, inputs }, passage) => inputs.forEach((input, group) =>
      expected.set([record, passage, group].join('/'), { text, input })));
    const edited = structuredClone(row.claim);
    edited.source.edition = '待校';
    assert.equal(compileXingjueEstate(edited).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size, witnesses.length], [15, 32, 21]);
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
      assert.match(hit.calculationNote, /紫微星诀.*田宅/u);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const record of ['1570-001', '1581-001', '1583-001', '1587-002', '1588-002', '1590-001']) {
    assert.equal(states.get(idOf(record)), 'unmapped', record);
  }
});

test('estate Lu passages require their natal carriers and actual relative palaces', () => {
  const purple = sample('740-001/1/0'), first = '田宮紫微祿馬相合';
  assert.deepEqual(quotes(explain('740-001', purple)), [first, '天府貪武化祿相照者田宅盛']);
  assert.deepEqual(quotes(explain('740-001', purple.filter(fact => fact.kind !== 'star_mutagen'
    || fact.palace !== '疾厄' || fact.star !== '廉贞' || fact.change !== '禄'))), [first]);

  const tongYin = sample('1563-001/1/0'), base = '子田天同水、太陰水';
  assert.deepEqual(quotes(explain('1563-001', tongYin)), [base, '化祿土與午地正祿相照']);
  assert.deepEqual(quotes(explain('1563-001', tongYin.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '子女' || fact.star !== '禄存'))), [base]);
});

test('estate Changsheng and water generation are checked as separate birth facts', () => {
  const estate = sample('746-001/1/0');
  assert.ok(explain('746-001', estate).matched);
  assert.equal(explain('746-001', estate.filter(fact => fact.kind !== 'natal_ziwei_bureau')).matched, false);

  const water = sample('1565-001/1/0'), base = '辰地破軍右弼';
  assert.deepEqual(quotes(explain('1565-001', water)), [base, '而水生水局人則有良田美宅']);
  assert.deepEqual(quotes(explain('1565-001', water.filter(fact => fact.kind !== 'natal_year_nayin_element'))), [base]);
  assert.deepEqual(quotes(explain('1565-001', water.filter(fact => fact.kind !== 'natal_ziwei_bureau'))), [base]);
});

test('the opposed void stars govern the supported Wu-Pojun passages', () => {
  const facts = sample('1587-001/1/0'), base = '田宮雖有武曲財星、破軍同居';
  assert.ok(explain('738-001', facts).matched);
  assert.deepEqual(quotes(explain('1587-001', facts)), [base, '空刧值沖貞殺刑陀交沖']);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '子女' || fact.star !== '地空');
  assert.equal(explain('738-001', incomplete).matched, false);
  assert.deepEqual(quotes(explain('1587-001', incomplete)), [base]);
});
