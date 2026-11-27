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
import { compileXingjueSpouse } from './xingjue-spouse.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-spouse-review-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = record => 'ziwei-v3-xingjue-049-p' + record;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1938, 1, 9, 8, 'female'], ['1363-001/0/0', '1363-001/0/3', '1387-001/0/0', '1387-001/0/2']],
  [[1995, 1, 13, 3, 'female'], ['1350-001/0/0', '1390-001/0/2', '1390-001/0/3', '1390-001/0/4']],
  [[1960, 6, 10, 7, 'male'], ['1382-002/0/0', '1382-002/1/0', '1382-002/2/0']],
  [[1972, 12, 28, 8, 'male'], ['1384-002/0/0', '1384-002/1/0', '1384-002/1/2']],
  [[1934, 2, 10, 10, 'male'], ['1385-003/0/0', '1385-003/0/3']],
  [[1935, 1, 18, 3, 'female'], ['629-001/0/0/a1', '1350-001/1/0']],
  [[1958, 1, 25, 10, 'female'], ['620-001/0/1']],
  [[1958, 1, 25, 11, 'female'], ['620-001/0/0']],
  [[1958, 8, 4, 5, 'male'], ['1363-001/0/2']],
  [[1959, 2, 10, 10, 'male'], ['629-001/0/0/a0']],
  [[1924, 11, 27, 0, 'male'], ['1383-003/0/0']],
  [[1938, 1, 2, 3, 'male'], ['1390-001/0/0']],
  [[1938, 6, 12, 0, 'male'], ['1362-001/0/0']],
  [[1933, 4, 12, 10, 'male'], ['629-001/0/0/a2']],
  [[1933, 6, 22, 3, 'male'], ['1390-002/0/2']],
  [[1936, 2, 26, 4, 'male'], ['1391-001/0/0']],
  [[1938, 5, 1, 0, 'female'], ['1382-001/0/0']],
  [[1940, 1, 25, 2, 'female'], ['1350-001/0/1']],
  [[1942, 2, 18, 10, 'male'], ['1387-001/0/1']],
  [[1942, 3, 23, 5, 'female'], ['1363-001/0/1']],
  [[1946, 11, 11, 3, 'female'], ['1390-002/0/0']],
  [[1947, 7, 27, 10, 'female'], ['1385-003/0/1']],
  [[1967, 5, 9, 7, 'female'], ['1390-001/0/1']],
  [[1974, 5, 9, 0, 'female'], ['1390-002/0/1']],
  [[1974, 7, 19, 2, 'female'], ['1385-003/0/2']],
  [[1986, 1, 1, 8, 'female'], ['1384-002/1/1']],
  [[1989, 3, 3, 6, 'female'], ['1379-001/0/1']],
  [[1940, 2, 3, 5, 'female'], ['1379-001/0/0']],
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

test('all reviewed spouse groups reach SQLite, explanations and report materials from natal charts', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  let groups = 0;
  for (const record of ids) {
    const id = idOf(record), row = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', id);
    row.branches.forEach(({ text, inputs }, passage) => inputs.forEach((input, group) => {
      groups += 1;
      const key = [record, passage, group].join('/');
      if (input.anyOf.length) input.anyOf.forEach((alt, index) => expected.set(key + '/a' + index, { text, input, alt }));
      else expected.set(key, { text, input });
    }));
    const edited = structuredClone(row.claim);
    edited.source.edition = '待校';
    assert.equal(compileXingjueSpouse(edited).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, groups, expected.size, witnesses.length], [15, 38, 40, 28]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const refs = lookup(queries), material = buildReportMaterials(refs);
    const hits = new Map(refs.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const record = key.split('/')[0], { text, input, alt } = expected.get(key);
      const match = evaluateRule(input, 'natal', chart);
      assert.ok(match.matched, key);
      if (alt) assert.ok(match.conditions.alternatives.some(value => JSON.stringify(value) === JSON.stringify(alt)), key);
      const id = idOf(record);
      const hit = hits.get(id), explanation = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explanation.matched, key);
      assert.deepEqual(quotes(hit), quotes(explanation), key);
      assert.match(hit.calculationNote, /紫微星诀.*夫妻/u);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const record of ['608-001', '612-001', '618-001', '622-001', '1359-002', '1368-001', '1378-001', '1382-003', '1383-004', '1384-001', '1389-001', '1391-002']) {
    assert.equal(states.get(idOf(record)), 'unmapped', record);
  }
});

test('paired natal transformations and backturned lights require actual carriers and placements', () => {
  for (const [key, palace] of [['620-001/0/0', '夫妻'], ['620-001/0/1', '子女']]) {
    const facts = sample(key);
    const paired = explain('620-001', facts).matchedBranches[0].matchedConditions.required;
    assert.ok(paired.some(fact => fact.kind === 'palace_mutagen' && fact.palace === palace && fact.change === '权'));
    assert.ok(paired.some(fact => fact.kind === 'palace_mutagen' && fact.palace === palace && fact.change === '禄'));
    assert.equal(explain('620-001', facts.filter(fact => fact.kind !== 'star_mutagen'
      || fact.palace !== palace || fact.change !== '权')).matched, false);
  }
  const lights = sample('1362-001/0/0');
  assert.ok(explain('1362-001', lights).matched);
  assert.equal(explain('1362-001', lights.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '官禄' || fact.star !== '太阳')).matched, false);
});

test('the Chen–You meeting and the two flanks have distinct proof', () => {
  const facts = sample('1382-002/2/0');
  const base = '妻宮酉地天同火星', joining = '與貪空相合';
  assert.deepEqual(quotes(explain('1382-002', facts)), [base, joining, '武殺成夾']);
  assert.deepEqual(quotes(explain('1382-002', facts.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '子女' || fact.star !== '七杀'))), [base, joining]);
  assert.deepEqual(quotes(explain('1382-002', facts.filter(fact => fact.kind !== 'palace_branch'
    || fact.palace !== '仆役'))), [base]);
});

test('report material and structured references preserve the Sun Ji configuration', async () => {
  const id = idOf('1383-003'), facts = sample('1383-003/0/0');
  assert.match(catalog.get(id).claim.evidence.original_text, /早剋/u);
  assert.equal(explain('1383-003', facts.filter(fact => fact.kind !== 'star_mutagen'
    || fact.palace !== '夫妻' || fact.star !== '太阳')).matched, false);
  const passageOnly = input => lookup(input).map(topic => ({
    ...topic,
    personality: topic.personality.filter(hit => hit.id === id),
    events: topic.events.filter(hit => hit.id === id),
  }));
  let sent;
  await generateReport({ chartQueries: query(facts).queries }, { lookup: passageOnly, complete: async payload => {
    sent = payload;
    return '报告';
  }, signal: new AbortController().signal });
  const passage = sent.references.flatMap(topic => [...topic.personality, ...topic.events]).find(hit => hit.id === id);
  assert.equal(passage.title, '《紫微星诀》夫妻篇盘面分句');
  assert.equal(passage.evidence.original_text, '戌妻文昌太陽化忌落空');
  assert.deepEqual(passage.interpretation.limitations, []);
  assert.match(sent.materials, /戌妻文昌太陽化忌落空/u);
  assert.doesNotMatch(sent.materials, /早剋|早克/u);
});
