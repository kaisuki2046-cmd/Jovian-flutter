import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-officer-seal-food-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'muxuan-v1-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1960, 1, 1, 0, '男'], 'f019-p00058/0/0'],
  [[1960, 1, 1, 2, '男'], 'f009-p00071/3/0'],
  [[1960, 1, 1, 4, '男'], 'f019-p00058/1/0'],
  [[1960, 1, 1, 12, '男'], 'f018-p00059/0/2'],
  [[1960, 1, 1, 14, '男'], 'f009-p00096/0/0'],
  [[1960, 1, 2, 14, '男'], 'f009-p00096/0/1'],
  [[1960, 1, 3, 0, '男'], 'f009-p00071/1/0', 'f009-p00092/0/0', 'f015-p00132/0/0'],
  [[1960, 1, 3, 16, '女'], 'f009-p00049/0/0'],
  [[1960, 1, 3, 18, '男'], 'f018-p00059/0/3'],
  [[1960, 1, 4, 0, '男'], 'f009-p00071/0/0'],
  [[1960, 1, 5, 0, '男'], 'f009-p00071/2/0', 'f016-p00083/0/0', 'f020-p00076/0/2'],
  [[1960, 1, 5, 20, '男'], 'f020-p00076/0/1'],
  [[1960, 1, 7, 6, '男'], 'f018-p00059/0/0'],
  [[1960, 1, 9, 12, '男'], 'f018-p00059/0/1'],
  [[1960, 1, 11, 6, '男'], 'f009-p00091/0/0', 'f009-p00129/0/0'],
  [[1960, 1, 15, 0, '男'], 'f018-p00059/0/4'],
  [[1960, 2, 7, 14, '男'], 'f020-p00076/0/0'],
  [[1960, 3, 24, 8, '男'], 'f009-p00095/0/1'],
  [[1960, 4, 9, 0, '男'], 'f015-p00047/0/1'],
  [[1960, 10, 27, 16, '男'], 'f009-p00095/0/0'],
  [[1960, 11, 13, 12, '男'], 'f009-p00093/0/1'],
  [[1961, 1, 2, 2, '男'], 'f020-p00091/0/0'],
  [[1962, 7, 27, 4, '男'], 'f015-p00047/0/0'],
  [[1962, 7, 27, 12, '男'], 'f009-p00128/0/0'],
  [[1964, 2, 25, 10, '男'], 'f009-p00093/0/0'],
  [[1964, 3, 7, 12, '男'], 'f015-p00087/0/1'],
  [[1965, 12, 16, 4, '男'], 'f015-p00087/0/0'],
  [[1914, 5, 7, 2, '男'], 'f020-p00091/1/0'],
];

function facts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '男' ? 'male' : 'female');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function parsed(birth, { timeKnown = true, extra = [] } = {}) {
  const query = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: [...facts(birth), ...extra],
  }], { timeKnown });
  assert.ok(query);
  return query;
}

function explain(key, [{ confirmedFacts, confirmedAbsentFacts, chartScope }]) {
  return explainClaim(claimId(key), 'bazi', chartContext('bazi', confirmedFacts, confirmedAbsentFacts, chartScope),
    '神峰通考', catalog);
}

const readings = references => references.flatMap(({ personality, events }) => [...personality, ...events]);

test('all newly reviewed clauses match from actual birth data through SQLite and the default report', () => {
  const keys = new Set(witnesses.flatMap(([, ...conditions]) => conditions.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of keys) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs }, index) => inputs.forEach(({ required }, alternative) =>
      expected.set(`${key}/${index}/${alternative}`, { text, required })));
  }
  const checked = new Set();
  for (const [birth, ...conditions] of witnesses) {
    const query = parsed(birth), hits = readings(lookup(query));
    for (const condition of conditions) {
      const [key] = condition.split('/');
      const hit = hits.find(row => row.id === claimId(key));
      assert.ok(hit, condition);
      assert.deepEqual(hit.matchedBranches, explain(key, query).matchedBranches, condition);
      const { text, required } = expected.get(condition), branch = hit.matchedBranches.find(b => b.text === text);
      assert.equal(branch?.conditionCompiler, shenfengReviewedProfile, condition);
      const proof = branch.matchedConditions;
      assert.ok([proof.required, ...proof.alternatives].some(group => isDeepStrictEqual(group, required)), condition);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), condition);
      assert.doesNotMatch(materials, /父母不全|九流之辈|不养母|夫荣子贵|才华出众|封相封王|高傲|格局贵/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([keys.size, expected.size, witnesses.length], [17, 33, 28]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('officer and seal need an unbroken chart, while Kitchen Food God is checked separately for clashes and officer', () => {
  assert.equal(explain('f009-p00091', parsed([1960, 1, 11, 6])).matched, true);
  const forged = { kind: 'bazi_natal_configuration', name: '原局官印无破且四支无冲刑破害' };
  assert.equal(explain('f009-p00091', parsed([1960, 1, 1, 6], { extra: [forged] })).matched, false);
  assert.equal(explain('f015-p00087', parsed([1960, 1, 18, 12])).matched, false);
  assert.equal(explain('f015-p00087', parsed([1964, 3, 7, 12])).matched, true);
});

test('day void matches the officer or killing in the same pillar, and time removal does not preserve it', () => {
  const officer = explain('f009-p00096', parsed([1960, 1, 1, 14]));
  const killing = explain('f009-p00096', parsed([1960, 1, 2, 14]));
  assert.equal(officer.matchedBranches[0].matchedConditions.required[0].name, '正官所在柱落日旬空亡');
  assert.equal(killing.matchedBranches[0].matchedConditions.required[0].name, '七杀所在柱落日旬空亡');
  assert.equal(explain('f009-p00096', parsed([1960, 1, 1, 6])).matched, false);
  assert.equal(explain('f009-p00096', parsed([1960, 1, 1, 14], { timeKnown: false })).matched, false);
});

test('Tiger in the wealth example is a year branch, and fire to earth refers to fire day stems', () => {
  const example = parsed([1914, 5, 7, 2]);
  assert.deepEqual(example[0].confirmedFacts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi),
    ['甲寅', '己巳', '癸巳', '癸丑']);
  assert.ok(explain('f020-p00091', example).matchedBranches.some(branch =>
    branch.text === '癸坐巳为财官逢寅财旺' && branch.matchedConditions.required.some(fact =>
      fact.kind === 'branch' && fact.position === 'year' && fact.branch === '寅')));
  assert.equal(explain('f015-p00047', parsed([1962, 7, 27, 4])).matched, true);
  const otherOutput = parsed([1961, 8, 14, 2]);
  assert.equal(explain('f015-p00132', otherOutput).matched, true);
  assert.equal(explain('f015-p00047', otherOutput).matched, false);
});
