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
import { jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-wu-tong-lian-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `ziwei-v4-jielan-${key.replace('-', '-p001-')}`;
const witnesses = [
  [[1924, 1, 1, 0, 'female'], '149-002/0/0', '149-007/0/1'],
  [[1924, 1, 1, 0], '148-001/0/0', '149-005/0/0', '149-006/0/0', '149-007/0/0'],
  [[1924, 1, 1, 4, 'female'], '146-003/0/0', '152-003/0/1', '152-003/1/1'],
  [[1924, 1, 1, 4], '146-002/0/0', '146-002/1/0'],
  [[1924, 1, 8, 4], '149-001/0/0'],
  [[1924, 1, 15, 3, 'female'], '152-003/0/0'],
  [[1924, 1, 15, 3], '152-001/0/0', '151-005/0/0'],
  [[1924, 1, 15, 9], '148-001/0/1'],
  [[1924, 1, 22, 6, 'female'], '151-016/0/0', '151-016/1/0'],
  [[1924, 1, 22, 6], '151-008/0/0', '151-011/0/0', '151-013/0/0'],
  [[1924, 2, 8, 3, 'female'], '149-002/1/0', '148-004/0/0'],
  [[1924, 3, 1, 0], '151-003/1/0', '151-006/0/0', '151-007/0/0'],
  [[1924, 3, 1, 10], '149-001/2/0', '148-003/0/0'],
  [[1924, 4, 1, 10], '152-002/0/0', '152-002/2/0', '152-005/0/0', '152-006/0/0'],
  [[1924, 4, 15, 8], '151-003/0/0'],
  [[1924, 6, 8, 6, 'female'], '146-003/1/0', '146-003/2/0'],
  [[1924, 6, 15, 11, 'female'], '152-004/0/0', '152-004/1/0'],
  [[1924, 10, 1, 8], '148-003/0/1'],
  [[1924, 12, 1, 6, 'female'], '152-003/1/0'],
  [[1924, 12, 22, 5], '146-002/2/0'],
  [[1926, 2, 1, 2], '148-002/0/0'],
  [[1926, 2, 22, 5], '151-012/0/0'],
  [[1926, 5, 22, 5], '151-015/0/0'],
  [[1926, 7, 15, 9], '149-001/1/0'],
  [[1926, 10, 1, 4], '151-014/0/0'],
  [[1930, 2, 1, 5], '148-002/1/0'],
  [[1930, 2, 8, 1], '146-001/0/0', '146-001/1/0'],
  [[1930, 3, 8, 10], '152-002/1/0'],
];

const natalFacts = ([year, month, day, hour, gender = 'male']) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const native = key => natalFacts(witnesses.find(([, ...keys]) => keys.includes(key))[0]);

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts) => explainClaim(claimId(key), 'ziwei', query(facts).context, undefined, catalog);

test('every reviewed condition reaches SQLite and contributes its matched passage to the report', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const id of ids) {
    assert.equal(states.get(claimId(id)), 'branch_indexed', id);
    catalog.get(claimId(id)).branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, index) => groups.set(`${id}/${branch}/${index}`, { text, input }));
    });
  }

  for (const [dob, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(dob));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = groups.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /刑夫克子|主残疾|刑杖难逃|投河自缢|须防不善终/u, key);
      verified.add(key);
    }
  }
  assert.deepEqual([ids.size, groups.size, witnesses.length], [29, 49, 28]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['148-005', '148-006', '151-001', '151-002']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
  assert.deepEqual(catalog.get(claimId('148-002')).branches.map(({ text }) => text),
    ['喜壬乙生人，巳亥得地', '不宜六庚生人，居酉地']);
});

test('the natal transformation must be carried by Wu Qu and the literary pair must be complete', () => {
  const wu = native('146-001/0/0');
  assert.equal(explain('146-001', wu).matched, true);
  assert.equal(explain('146-001', wu.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '武曲')).matched, false);

  const tong = native('149-002/1/0');
  const oneLiteraryStar = tong.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文昌');
  assert.ok(explain('149-002', tong).matchedBranches.some(({ text }) => text === '昌曲更来相会处'));
  assert.deepEqual(explain('149-002', oneLiteraryStar).matchedBranches.map(({ text }) => text),
    ['天同守命妇人贞，性格聪明伶俐人']);
});

test('an unverified Body palace or incomplete natal palaces cannot establish Lian Zhen with no malefics', () => {
  const body = native('152-003/1/1');
  const missingHour = body.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('152-003', body).matched, true);
  assert.equal(explain('152-003', missingHour).matched, false);

  const life = native('152-003/1/0');
  const unconfirmed = life.filter(fact => fact.kind !== 'palace_origin_star_count');
  assert.ok(explain('152-003', life).matchedBranches.some(({ text }) => text === '诸吉拱朝无杀破'));
  assert.deepEqual(explain('152-003', unconfirmed).matchedBranches.map(({ text }) => text), ['女人身命值廉贞']);
});
