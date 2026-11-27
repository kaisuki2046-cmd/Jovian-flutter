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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-minor-stars-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 0, 'female'], '044-p487/0/1', '062-p1226/0/0'],
  [[1924, 1, 1, 1, 'female'], '043-p485/3/0', '048-p1209/0/0'],
  [[1924, 1, 1, 2, 'female'], '062-p1224/0/0'],
  [[1924, 1, 1, 3, 'female'], '040-p480/0/3'],
  [[1924, 1, 1, 4, 'female'], '043-p485/1/0'],
  [[1924, 1, 1, 5, 'female'], '038-p474/0/0', '047-p490/0/0'],
  [[1924, 1, 1, 6, 'female'], '062-p513/0/0', '062-p1225/0/0'],
  [[1924, 1, 1, 7, 'female'], '047-p490/0/5'],
  [[1924, 1, 1, 8, 'female'], '015-p353/0/0', '015-p354/0/0', '016-p1117/0/4'],
  [[1924, 1, 1, 10, 'female'], '062-p1224/0/2'],
  [[1924, 1, 1, 11, 'female'], '062-p513/0/1', '062-p1690/0/0'],
  [[1924, 2, 1, 0, 'female'], '040-p480/0/2'],
  [[1924, 2, 1, 2, 'female'], '042-p1205/0/1'],
  [[1924, 2, 1, 5, 'female'], '042-p1205/0/0'],
  [[1924, 2, 1, 9, 'female'], '016-p1117/0/3', '062-p1224/0/3'],
  [[1924, 2, 1, 11, 'female'], '016-p1117/0/1'],
  [[1924, 3, 1, 0, 'female'], '043-p485/0/0', '043-p1206/0/0', '043-p1207/0/0', '044-p487/1/0'],
  [[1924, 3, 1, 1, 'female'], '043-p485/0/5', '043-p485/2/0', '043-p1206/0/5'],
  [[1924, 3, 1, 2, 'female'], '012-p1095/0/4', '016-p1117/0/0', '043-p485/0/4', '043-p1206/0/4', '047-p490/0/4', '062-p1224/0/4'],
  [[1924, 3, 1, 3, 'female'], '038-p1197/0/1', '040-p480/0/4', '043-p485/0/3', '043-p1206/0/3'],
  [[1924, 3, 1, 4, 'female'], '042-p484/0/2', '043-p485/0/2', '043-p1206/0/2'],
  [[1924, 3, 1, 5, 'female'], '043-p485/0/1', '043-p1206/0/1'],
  [[1924, 3, 1, 6, 'female'], '012-p324/0/0', '012-p1095/0/0'],
  [[1924, 3, 1, 9, 'female'], '038-p1197/0/0'],
  [[1924, 4, 1, 1, 'female'], '062-p1224/0/5'],
  [[1924, 6, 1, 4, 'female'], '048-p1208/0/1'],
  [[1924, 6, 1, 5, 'female'], '048-p1208/0/0'],
  [[1924, 6, 1, 11, 'female'], '015-p353/0/1', '015-p353/1/1', '015-p354/0/1', '047-p490/0/1', '062-p1224/0/1'],
  [[1924, 7, 1, 10, 'female'], '047-p490/0/2'],
  [[1924, 9, 1, 1, 'female'], '040-p480/0/10'],
  [[1924, 10, 1, 1, 'female'], '040-p480/0/11'],
  [[1924, 10, 1, 4, 'female'], '012-p1095/0/8'],
  [[1924, 10, 1, 6, 'female'], '012-p324/0/1', '012-p1095/0/6'],
  [[1924, 10, 1, 10, 'female'], '015-p353/0/2', '015-p354/0/2'],
  [[1924, 10, 8, 10, 'male'], '012-p324/1/0'],
  [[1924, 11, 1, 0, 'female'], '044-p487/0/0'],
  [[1924, 12, 1, 8, 'female'], '015-p353/0/4', '015-p354/0/4'],
  [[1925, 1, 1, 3, 'male'], '047-p490/0/3'],
  [[1925, 1, 1, 8, 'male'], '061-p512/0/0'],
  [[1925, 1, 1, 9, 'male'], '054-p1218/0/0', '054-p1218/1/0'],
  [[1925, 2, 1, 0, 'male'], '042-p484/0/0'],
  [[1925, 2, 1, 1, 'male'], '054-p1217/0/0'],
  [[1925, 2, 1, 5, 'male'], '040-p480/0/9'],
  [[1925, 2, 8, 1, 'female'], '043-p486/0/9'],
  [[1925, 3, 1, 5, 'male'], '015-p353/1/0', '040-p480/1/0'],
  [[1925, 3, 1, 7, 'male'], '016-p1117/0/5'],
  [[1925, 3, 1, 9, 'male'], '012-p1095/0/3'],
  [[1925, 3, 1, 11, 'male'], '012-p331/0/0'],
  [[1925, 5, 1, 1, 'male'], '040-p480/0/0'],
  [[1925, 5, 1, 3, 'male'], '015-p353/0/3', '015-p353/1/2', '015-p354/0/3'],
  [[1925, 6, 22, 10, 'female'], '012-p331/0/1'],
  [[1925, 7, 1, 0, 'male'], '048-p1208/0/5'],
  [[1925, 7, 1, 9, 'male'], '043-p486/0/5'],
  [[1925, 7, 1, 11, 'male'], '048-p1208/0/6'],
  [[1925, 9, 8, 8, 'female'], '012-p331/0/3'],
  [[1925, 9, 22, 7, 'female'], '012-p331/0/4'],
  [[1925, 11, 1, 0, 'male'], '044-p487/0/11'],
  [[1926, 1, 22, 3, 'male'], '012-p331/0/2'],
  [[1926, 3, 1, 3, 'female'], '040-p480/0/1'],
  [[1926, 4, 1, 5, 'female'], '012-p1095/0/7'],
  [[1926, 4, 1, 6, 'female'], '053-p1216/0/0'],
  [[1926, 4, 1, 7, 'female'], '015-p353/0/5', '015-p353/1/3', '015-p354/0/5'],
  [[1926, 4, 8, 5, 'male'], '054-p500/0/1'],
  [[1926, 6, 1, 11, 'female'], '043-p486/0/0'],
  [[1926, 10, 1, 0, 'female'], '044-p487/0/10'],
  [[1927, 1, 1, 0, 'male'], '054-p500/0/2'],
  [[1927, 1, 1, 4, 'male'], '054-p500/0/0'],
  [[1927, 1, 1, 8, 'male'], '054-p500/0/4'],
  [[1927, 2, 1, 7, 'male'], '054-p500/0/5'],
  [[1927, 3, 1, 4, 'male'], '016-p1117/0/2'],
  [[1927, 5, 1, 8, 'male'], '040-p480/0/8'],
  [[1927, 6, 1, 11, 'male'], '038-p1198/0/0'],
  [[1927, 7, 15, 9, 'male'], '043-p486/0/3'],
  [[1927, 8, 1, 0, 'male'], '044-p487/0/9'],
  [[1927, 8, 1, 3, 'male'], '048-p1208/0/2'],
  [[1927, 10, 1, 1, 'male'], '012-p1095/0/11'],
  [[1927, 11, 1, 0, 'male'], '040-p480/0/7'],
  [[1928, 2, 1, 8, 'female'], '042-p484/0/4'],
  [[1928, 8, 1, 0, 'female'], '044-p487/0/8'],
  [[1928, 9, 1, 5, 'female'], '040-p480/0/6'],
  [[1928, 11, 1, 10, 'female'], '012-p1093/0/1'],
  [[1929, 5, 1, 10, 'male'], '043-p486/0/11'],
  [[1929, 7, 1, 0, 'male'], '044-p487/0/7'],
  [[1930, 2, 1, 11, 'female'], '042-p484/0/1'],
  [[1930, 3, 1, 4, 'female'], '040-p480/0/5'],
  [[1930, 4, 1, 11, 'female'], '043-p486/0/8'],
  [[1930, 5, 1, 0, 'female'], '044-p487/0/6'],
  [[1931, 5, 1, 0, 'male'], '044-p487/0/5'],
  [[1931, 11, 1, 5, 'male'], '043-p486/0/7'],
  [[1932, 2, 1, 2, 'female'], '043-p486/0/1'],
  [[1932, 3, 1, 11, 'female'], '012-p1095/0/1'],
  [[1932, 4, 1, 0, 'female'], '044-p487/0/4'],
  [[1932, 4, 1, 1, 'female'], '043-p486/0/2'],
  [[1932, 5, 1, 0, 'female'], '043-p486/0/4'],
  [[1933, 2, 1, 0, 'male'], '044-p487/0/3'],
  [[1933, 2, 1, 1, 'male'], '042-p484/0/5'],
  [[1934, 1, 1, 3, 'female'], '054-p500/0/3'],
  [[1934, 3, 1, 0, 'female'], '044-p487/2/0'],
  [[1934, 4, 1, 8, 'female'], '012-p1095/0/10'],
  [[1935, 2, 1, 0, 'male'], '044-p487/0/2'],
  [[1935, 5, 1, 1, 'male'], '048-p1208/0/4'],
  [[1935, 5, 1, 2, 'male'], '048-p1208/0/3'],
  [[1935, 5, 1, 6, 'male'], '048-p1208/0/11'],
  [[1935, 10, 1, 3, 'male'], '012-p1095/0/9'],
  [[1936, 5, 8, 10, 'male'], '048-p1208/0/7'],
  [[1937, 3, 1, 9, 'male'], '042-p484/0/3'],
  [[1937, 7, 1, 7, 'male'], '048-p1208/0/10'],
  [[1937, 7, 1, 8, 'male'], '048-p1208/0/9'],
  [[1938, 2, 1, 2, 'female'], '043-p486/0/6'],
  [[1938, 4, 15, 0, 'female'], '043-p486/0/10'],
  [[1938, 7, 1, 9, 'female'], '048-p1208/0/8'],
  [[1938, 12, 1, 11, 'female'], '012-p1093/0/0'],
  [[1939, 2, 1, 10, 'male'], '012-p1095/0/2'],
  [[1941, 2, 8, 2, 'female'], '012-p324/1/1'],
  [[1943, 9, 1, 7, 'male'], '012-p1095/0/5'],
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
      assert.doesNotMatch(material, /壽七耋|壽八耋|反哺之誠|黑頭宰相|子宮驚風惡疾|科場官路|吉祥喜事鱗序相接/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [31, 153, 115]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('a lone major star requires the full origin star list', () => {
  const facts = native('015-p353/0/0');
  const partial = facts.filter(fact => !(fact.kind === 'palace_origin_star_count' && fact.palace === '命宫'));
  assert.equal(explain('015-p353', facts).matched, true);
  assert.equal(explain('015-p353', partial).matched, false);
  assert.equal(explain('015-p354', partial).matched, false);
});

test('the Fenggao passage requires the actual annual Ke carrier', () => {
  const facts = native('042-p484/0/0');
  assert.equal(explain('042-p484', facts).matched, true);
  assert.equal(explain('042-p484', facts.filter(fact => fact.kind !== 'star_mutagen')).matched, false);
});

test('a nominal body seat alone does not establish the Zi-year Tienshou passage', () => {
  const facts = native('043-p1206/0/1');
  assert.equal(explain('043-p1206', facts).matched, true);
  assert.equal(explain('043-p1206', facts, false).matched, false);
  assert.equal(explain('043-p1206', facts.filter(fact => fact.kind !== 'natal_year_branch')).matched, false);
});

test('the two dragons must flank the target in their own natal star families', () => {
  const facts = native('054-p500/0/0');
  assert.equal(explain('054-p500', facts).matched, true);
  const mixed = facts.map(fact => fact.kind === 'palace_boshi_star' && fact.star === '青龙'
    ? { ...fact, kind: 'palace_suiqian_star' } : fact);
  assert.equal(explain('054-p500', mixed).matched, false);
  const missingSide = facts.filter(fact => !(fact.kind === 'palace_relation' && fact.anchor === '命宫'
    && fact.target === '父母' && fact.relation === 'adjacent'));
  assert.equal(explain('054-p500', missingSide).matched, false);
});

test('canopy is read from the natal Jiangqian cycle', () => {
  const facts = native('047-p490/0/0');
  assert.equal(explain('047-p490', facts).matched, true);
  const mixed = facts.map(fact => fact.kind === 'palace_jiangqian_star' && fact.star === '华盖'
    ? { ...fact, kind: 'palace_suiqian_star' } : fact);
  assert.equal(explain('047-p490', mixed).matched, false);
});
