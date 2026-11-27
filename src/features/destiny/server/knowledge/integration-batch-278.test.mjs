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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-santaisuiqian-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 0, 'female'], '034-p1192/1/3'],
  [[1924, 1, 1, 1, 'female'], '031-p1186/2/0'],
  [[1924, 1, 1, 2, 'female'], '036-p471/0/0'],
  [[1924, 1, 1, 4, 'female'], '036-p469/0/2'],
  [[1924, 1, 1, 11, 'female'], '039-p1200/0/0'],
  [[1924, 1, 8, 0, 'female'], '034-p1191/0/0', '035-p1194/0/0'],
  [[1924, 1, 8, 1, 'female'], '033-p463/0/0', '034-p1192/0/0', '034-p1192/1/2', '034-p1192/1/4', '036-p471/0/1'],
  [[1924, 1, 8, 3, 'female'], '036-p469/0/3'],
  [[1924, 1, 8, 4, 'female'], '039-p1199/0/2'],
  [[1924, 1, 8, 5, 'female'], '050-p1214/0/1'],
  [[1924, 1, 8, 6, 'female'], '035-p467/0/3', '050-p494/0/0', '050-p1213/0/0', '056-p506/0/0'],
  [[1924, 1, 8, 7, 'female'], '036-p470/0/0', '050-p1214/0/0'],
  [[1924, 1, 8, 9, 'female'], '034-p465/0/1', '036-p469/0/0'],
  [[1924, 1, 8, 10, 'female'], '034-p465/0/0'],
  [[1924, 1, 8, 11, 'female'], '033-p463/0/1', '033-p464/0/0'],
  [[1924, 1, 15, 0, 'female'], '039-p1200/0/1'],
  [[1924, 1, 15, 11, 'female'], '039-p1199/0/1'],
  [[1924, 1, 22, 6, 'female'], '039-p1199/0/0', '056-p1220/0/0'],
  [[1924, 2, 8, 0, 'female'], '031-p1186/0/0'],
  [[1924, 2, 8, 1, 'female'], '036-p469/0/5'],
  [[1924, 2, 8, 6, 'female'], '056-p1221/0/0'],
  [[1924, 2, 15, 0, 'female'], '031-p459/0/0'],
  [[1924, 2, 15, 2, 'female'], '031-p456/0/0'],
  [[1924, 2, 15, 4, 'female'], '035-p1193/0/0'],
  [[1924, 2, 22, 2, 'female'], '031-p1185/0/0'],
  [[1924, 2, 22, 6, 'female'], '031-p459/0/1'],
  [[1924, 2, 22, 9, 'female'], '039-p476/0/0'],
  [[1924, 3, 8, 3, 'female'], '034-p1192/1/5'],
  [[1924, 3, 8, 4, 'female'], '050-p1214/0/2'],
  [[1924, 4, 1, 0, 'female'], '021-p1151/0/1'],
  [[1924, 4, 1, 1, 'female'], '021-p1151/0/0'],
  [[1924, 4, 1, 4, 'female'], '021-p1151/0/9'],
  [[1924, 4, 1, 5, 'female'], '021-p1151/0/8'],
  [[1924, 4, 8, 1, 'female'], '031-p1186/1/0', '036-p1195/0/0', '036-p1195/1/0'],
  [[1924, 4, 8, 3, 'female'], '050-p1214/0/3'],
  [[1924, 4, 8, 11, 'female'], '036-p469/0/1'],
  [[1924, 4, 22, 3, 'female'], '039-p1200/1/1'],
  [[1924, 5, 8, 2, 'female'], '050-p1214/0/4'],
  [[1924, 6, 8, 0, 'female'], '031-p456/0/1'],
  [[1924, 6, 8, 1, 'female'], '050-p1214/0/5'],
  [[1924, 7, 8, 8, 'female'], '036-p469/0/4', '039-p1199/0/4'],
  [[1924, 7, 15, 3, 'female'], '039-p1199/0/3'],
  [[1924, 8, 22, 1, 'female'], '039-p475/0/0'],
  [[1924, 10, 1, 1, 'female'], '031-p458/0/0'],
  [[1924, 12, 15, 5, 'female'], '039-p1200/1/0'],
  [[1925, 2, 8, 2, 'male'], '034-p1192/1/0', '034-p1192/1/1'],
  [[1925, 8, 1, 1, 'male'], '039-p1199/0/5'],
  [[1926, 2, 22, 10, 'female'], '035-p467/0/0'],
  [[1927, 3, 22, 0, 'male'], '021-p1151/0/10'],
  [[1927, 3, 22, 4, 'male'], '021-p1151/0/6'],
  [[1927, 3, 22, 5, 'male'], '021-p1151/0/5'],
  [[1927, 5, 8, 0, 'male'], '031-p1188/0/0'],
  [[1927, 7, 8, 5, 'male'], '032-p1190/0/0'],
  [[1927, 9, 8, 2, 'male'], '039-p477/0/0'],
  [[1929, 2, 22, 1, 'male'], '035-p467/0/2'],
  [[1931, 1, 8, 11, 'male'], '021-p410/0/0'],
  [[1931, 1, 22, 11, 'male'], '021-p410/0/1'],
  [[1931, 3, 22, 2, 'male'], '021-p1155/0/8'],
  [[1931, 3, 22, 3, 'male'], '021-p1155/0/7'],
  [[1931, 4, 15, 0, 'male'], '021-p1155/0/10'],
  [[1931, 4, 15, 1, 'male'], '021-p1155/0/9'],
  [[1931, 4, 15, 4, 'male'], '021-p1155/0/6'],
  [[1931, 4, 15, 5, 'male'], '021-p1155/0/5'],
  [[1931, 4, 22, 7, 'male'], '021-p1155/0/4'],
  [[1931, 4, 22, 8, 'male'], '021-p1155/0/3'],
  [[1931, 7, 15, 2, 'male'], '021-p1155/0/0'],
  [[1931, 7, 15, 3, 'male'], '021-p1155/0/11'],
  [[1931, 7, 22, 11, 'male'], '031-p1187/0/0'],
  [[1931, 8, 22, 1, 'male'], '021-p1155/0/2'],
  [[1931, 8, 22, 2, 'male'], '021-p1155/0/1'],
  [[1932, 2, 8, 4, 'female'], '035-p467/0/1'],
  [[1932, 6, 8, 2, 'female'], '031-p457/0/0'],
  [[1932, 10, 22, 4, 'female'], '039-p477/0/1'],
  [[1934, 12, 1, 5, 'female'], '032-p1189/0/0'],
  [[1935, 7, 8, 5, 'male'], '031-p1187/0/1'],
  [[1939, 3, 15, 5, 'female'], '021-p1151/0/4'],
  [[1939, 3, 15, 6, 'female'], '021-p1151/0/3'],
  [[1942, 4, 1, 11, 'female'], '039-p477/0/2'],
  [[1942, 6, 15, 11, 'female'], '021-p1151/0/11'],
  [[1944, 2, 8, 4, 'female'], '056-p1222/0/0'],
  [[1945, 7, 1, 0, 'male'], '021-p1151/0/7'],
  [[1952, 1, 8, 2, 'female'], '056-p504/0/0', '056-p505/0/0'],
  [[1952, 1, 15, 6, 'female'], '021-p1151/0/2'],
  [[1952, 2, 8, 7, 'female'], '050-p1215/0/0'],
  [[1952, 2, 8, 8, 'female'], '050-p1215/0/1'],
  [[1953, 2, 22, 0, 'female'], '050-p1215/0/2'],
  [[1953, 2, 22, 3, 'female'], '050-p1215/0/3'],
  [[1953, 2, 22, 4, 'female'], '050-p1215/0/4'],
  [[1953, 2, 22, 11, 'female'], '050-p1215/0/5'],
  [[1953, 5, 15, 4, 'female'], '032-p462/0/0'],
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
      assert.doesNotMatch(material, /平生有危事|減官落職|主孝服|素帶不離身|出外多構災|男招美妻|黃閣宰相/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [41, 107, 90]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('Changsheng Horse needs the actual opposing year-front White Tiger', () => {
  const facts = native('021-p1151/0/0');
  const removeTiger = facts.filter(fact => !(fact.kind === 'palace_suiqian_star' && fact.palace === '迁移' && fact.star === '白虎'));
  assert.equal(explain('021-p1151', facts).matched, true);
  assert.equal(explain('021-p1151', removeTiger).matched, false);
  const missingOpposition = facts.filter(fact => !(fact.anchor === '命宫' && fact.target === '迁移' && fact.relation === 'opposite'));
  assert.equal(explain('021-p1151', missingOpposition).matched, false);
});

test('the no-major-star passage requires a complete native star list', () => {
  const facts = native('039-p1200/1/0');
  const exact = data => explain('039-p1200', data).matchedBranches.map(branch => branch.text);
  assert.deepEqual(exact(facts), ['兩台夾合於身命', '雖無大星']);
  const partial = facts.filter(fact => !(fact.kind === 'palace_origin_star_count' && fact.palace === '命宫'));
  assert.deepEqual(exact(partial), ['兩台夾合於身命']);
});

test('the same reading distinguishes native Dragon and Tiger cycle roles from other star families', () => {
  const pair = native('056-p505/0/0');
  const wrongDragon = pair.map(fact => fact.kind === 'palace_boshi_star' && fact.palace === '命宫' && fact.star === '青龙'
    ? { ...fact, kind: 'palace_suiqian_star' } : fact);
  assert.equal(explain('056-p505', wrongDragon).matched, false);
  const bothFeilian = native('056-p1221/0/0');
  const onlyBoshi = bothFeilian.filter(fact => !(fact.kind === 'palace_star' && fact.star === '蜚廉'));
  assert.ok(onlyBoshi.some(fact => fact.kind === 'palace_boshi_star' && fact.palace === '命宫' && fact.star === '飞廉'));
  assert.equal(explain('056-p1221', onlyBoshi).matched, false);
});

test('birth Nayin, chart bureau, and aquatic seat are all required for the Longde passage', () => {
  const facts = native('050-p1215/0/0');
  assert.equal(explain('050-p1215', facts).matched, true);
  for (const kind of ['natal_year_nayin_element', 'natal_ziwei_bureau']) {
    assert.equal(explain('050-p1215', facts.filter(fact => fact.kind !== kind)).matched, false);
  }
  const misplaced = facts.map(fact => fact.kind === 'palace_branch' && fact.palace === '官禄' ? { ...fact, branch: '戌' } : fact);
  assert.equal(explain('050-p1215', misplaced).matched, false);
});
