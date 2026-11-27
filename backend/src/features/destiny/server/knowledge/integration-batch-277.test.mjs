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
import { xingjuePalaceConfigurationProfile } from './xingjue-palace-configurations.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-luma-mutagens-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 0, 'female'], '021-p1150/0/0'],
  [[1924, 1, 1, 7, 'female'], '024-p1161/1/0'],
  [[1924, 1, 8, 0, 'female'], '022-p418/0/2', '022-p1157/0/0', '024-p424/0/0'],
  [[1924, 1, 8, 1, 'female'], '021-p407/0/0'],
  [[1924, 1, 8, 3, 'female'], '024-p423/0/1', '024-p1163/0/1'],
  [[1924, 1, 8, 4, 'female'], '024-p1161/0/0'],
  [[1924, 1, 8, 5, 'female'], '022-p1157/0/1', '024-p423/0/2', '024-p1163/0/0'],
  [[1924, 1, 8, 8, 'female'], '022-p418/0/1'],
  [[1924, 1, 15, 4, 'female'], '022-p418/0/3'],
  [[1924, 1, 15, 6, 'female'], '024-p1164/0/7'],
  [[1924, 1, 15, 7, 'female'], '024-p1164/0/6'],
  [[1924, 1, 22, 3, 'female'], '023-p1160/0/0', '024-p423/0/0'],
  [[1924, 1, 22, 5, 'female'], '020-p1140/0/0'],
  [[1924, 2, 1, 4, 'female'], '022-p418/0/0'],
  [[1924, 2, 8, 0, 'female'], '021-p405/0/0', '021-p408/0/0', '021-p1154/0/0', '021-p1154/1/0'],
  [[1924, 2, 8, 1, 'female'], '021-p405/0/11'],
  [[1924, 2, 8, 2, 'female'], '021-p405/0/10'],
  [[1924, 2, 8, 3, 'female'], '021-p405/0/9'],
  [[1924, 2, 8, 4, 'female'], '021-p405/0/8', '021-p408/1/0'],
  [[1924, 2, 8, 5, 'female'], '021-p405/0/7'],
  [[1924, 2, 8, 6, 'female'], '021-p405/0/6'],
  [[1924, 2, 8, 7, 'female'], '021-p405/0/5'],
  [[1924, 2, 8, 8, 'female'], '021-p405/0/4'],
  [[1924, 2, 8, 9, 'female'], '021-p405/0/3', '024-p425/0/0'],
  [[1924, 2, 8, 10, 'female'], '021-p405/0/2'],
  [[1924, 2, 8, 11, 'female'], '021-p405/0/1'],
  [[1924, 2, 15, 1, 'female'], '024-p1164/0/11'],
  [[1924, 2, 15, 2, 'female'], '024-p1164/0/10'],
  [[1924, 2, 15, 4, 'female'], '023-p420/0/0'],
  [[1924, 2, 15, 9, 'female'], '023-p1159/0/0', '023-p1159/1/0'],
  [[1924, 3, 1, 0, 'female'], '021-p412/0/0'],
  [[1924, 3, 1, 7, 'female'], '024-p421/0/0'],
  [[1924, 3, 1, 9, 'female'], '024-p1164/0/0'],
  [[1924, 4, 1, 10, 'female'], '022-p1158/0/0'],
  [[1924, 4, 8, 0, 'female'], '023-p420/0/1'],
  [[1924, 4, 8, 6, 'female'], '022-p416/0/5'],
  [[1924, 4, 8, 9, 'female'], '024-p1164/0/9'],
  [[1924, 4, 8, 10, 'female'], '024-p1164/0/8'],
  [[1924, 4, 22, 5, 'female'], '023-p1159/0/1'],
  [[1924, 4, 22, 10, 'female'], '020-p402/0/0'],
  [[1924, 5, 8, 3, 'female'], '021-p413/0/0', '021-p1148/0/1'],
  [[1924, 5, 8, 4, 'female'], '024-p1164/0/2'],
  [[1924, 5, 8, 5, 'female'], '024-p1164/0/1'],
  [[1924, 5, 8, 6, 'female'], '022-p416/0/6'],
  [[1924, 6, 8, 1, 'female'], '024-p1164/0/3'],
  [[1924, 6, 8, 6, 'female'], '020-p402/0/1'],
  [[1924, 6, 15, 11, 'female'], '019-p394/0/0'],
  [[1924, 7, 1, 0, 'female'], '022-p416/0/7'],
  [[1924, 7, 8, 9, 'female'], '021-p1149/0/2'],
  [[1924, 8, 1, 6, 'female'], '021-p411/0/0'],
  [[1924, 8, 15, 6, 'female'], '022-p416/0/9'],
  [[1924, 9, 22, 0, 'female'], '022-p416/0/10'],
  [[1924, 11, 8, 9, 'female'], '021-p1148/0/0'],
  [[1924, 11, 22, 9, 'female'], '021-p1149/0/0'],
  [[1924, 12, 8, 0, 'female'], '022-p416/0/1'],
  [[1924, 12, 8, 7, 'female'], '024-p1164/0/4'],
  [[1924, 12, 22, 10, 'female'], '020-p397/0/0'],
  [[1925, 2, 1, 7, 'male'], '021-p1149/0/1'],
  [[1925, 2, 1, 8, 'male'], '021-p1149/0/3'],
  [[1925, 2, 8, 3, 'male'], '021-p415/0/0'],
  [[1925, 2, 8, 10, 'male'], '019-p393/0/0'],
  [[1925, 3, 8, 0, 'male'], '020-p403/0/0'],
  [[1925, 3, 22, 2, 'male'], '024-p1164/0/5'],
  [[1926, 3, 22, 0, 'female'], '020-p1145/0/2'],
  [[1926, 4, 15, 7, 'female'], '020-p1145/0/0', '020-p1145/0/1'],
  [[1927, 2, 8, 6, 'male'], '022-p416/0/3'],
  [[1927, 3, 8, 2, 'male'], '024-p422/0/0'],
  [[1929, 1, 15, 6, 'male'], '022-p416/0/2'],
  [[1929, 1, 22, 10, 'male'], '020-p1145/0/3'],
  [[1929, 11, 8, 5, 'male'], '020-p401/0/0'],
  [[1932, 1, 8, 0, 'female'], '020-p399/0/0'],
  [[1932, 2, 22, 8, 'female'], '021-p1147/0/0'],
  [[1932, 4, 1, 0, 'female'], '022-p416/0/4'],
  [[1932, 7, 22, 0, 'female'], '022-p416/0/8'],
  [[1932, 10, 22, 6, 'female'], '022-p416/0/11'],
  [[1932, 11, 1, 6, 'female'], '022-p416/0/0'],
  [[1934, 3, 8, 8, 'female'], '021-p1149/0/4'],
];

const factsFor = ([year, month, day, hour, gender]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const native = key => factsFor(witnesses.find(([, ...cases]) => cases.includes(key))[0]);

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts, timeKnown) => explainClaim(claimId(key), 'ziwei',
  query(facts, timeKnown).context, '紫微星诀', catalog);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);

test('each reviewed natal placement reaches SQLite and the default report', () => {
  const records = new Set(witnesses.flatMap(([, ...cases]) => cases.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, xingjuePalaceConfigurationProfile);
      inputs.forEach((input, alternative) => expected.set(`${key}/${index}/${alternative}`, { text, input }));
    });
  }
  const checked = new Set();
  for (const [birth, ...cases] of witnesses) {
    const { queries, context } = query(factsFor(birth)), derived = claimChartContext('ziwei', context);
    const results = hits(lookup(queries));
    for (const condition of cases) {
      const key = condition.split('/')[0], { text, input } = expected.get(condition);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, condition);
      const hit = results.find(row => row.id === claimId(key));
      const proof = explainClaim(claimId(key), 'ziwei', context, undefined, catalog);
      assert.ok(hit && proof.matched, condition);
      assert.deepEqual(hit.matchedBranches, proof.matchedBranches, condition);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), condition);
      assert.doesNotMatch(material, /富貴早發|終身不第|功名不成|流丐|生殺之威|功名蹭蹬|一生甚危/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [36, 91, 77]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('a natal transformation branch is derived from its birth-year carrier and actual palace', () => {
  const facts = native('022-p418/0/0');
  assert.equal(explain('022-p418', facts).matched, true);
  const missingLu = facts.filter(fact => !(fact.kind === 'star_mutagen' && fact.change === '禄'));
  assert.equal(explain('022-p418', [...missingLu, { kind: 'natal_ziwei_mutagen_branch', change: '禄', branch: '辰' }]).matched, false);
  const wrongStem = facts.map(fact => fact.kind === 'natal_year_stem' ? { ...fact, stem: '壬' } : fact);
  assert.equal(explain('022-p418', wrongStem).matched, false);
});

test('absence of empty stars or a horse requires a complete relevant chart', () => {
  const withLuMa = native('021-p412/0/0');
  assert.equal(explain('021-p412', withLuMa).matched, true);
  const withoutOriginCount = (facts, palace) =>
    facts.filter(fact => !(fact.kind === 'palace_origin_star_count' && fact.palace === palace));
  assert.equal(explain('021-p412', withoutOriginCount(withLuMa, '命宫')).matched, false);
  const noHorse = native('021-p407/0/0');
  assert.equal(explain('021-p407', noHorse).matched, true);
  assert.equal(explain('021-p407', withoutOriginCount(noHorse, '官禄')).matched, false);
});

test('career flanks require both relations and the luminary branch is independent', () => {
  const facts = native('023-p1159/1/0');
  const texts = data => explain('023-p1159', data).matchedBranches.map(branch => branch.text);
  assert.deepEqual(texts(facts), ['權祿夾官', '得日月照者']);
  const noMoon = facts.filter(fact => !(fact.kind === 'palace_star' && fact.star === '太阴'));
  assert.deepEqual(texts(noMoon), ['權祿夾官']);
  const oneFlank = facts.filter(fact => !(fact.anchor === '官禄' && fact.target === '田宅' && fact.relation === 'adjacent'));
  assert.equal(explain('023-p1159', oneFlank).matched, false);
});

test('falling brightness follows the actual Lu or Ke carrier', () => {
  const lu = native('022-p416/0/0');
  const ke = native('024-p1163/0/0');
  assert.equal(explain('022-p416', lu).matched, true);
  assert.equal(explain('024-p1163', ke).matched, true);
  const stripBrightness = (facts, palace) =>
    facts.filter(fact => !(fact.kind === 'palace_brightness' && fact.palace === palace));
  assert.equal(explain('022-p416', stripBrightness(lu, '命宫')).matched, false);
  assert.equal(explain('024-p1163', stripBrightness(ke, '疾厄')).matched, false);
});
