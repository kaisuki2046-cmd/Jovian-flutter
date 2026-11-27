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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-qisha-and-star-followups-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function claimId(key) {
  const [chapter, passage] = key.split('-');
  const page = chapter === '178' ? 'p002' : 'p001';
  return `ziwei-v4-jielan-${chapter}-${page}-${passage}`;
}

const witnesses = [
  [[1924, 1, 1, 0], '189-002/0/0'],
  [[1924, 1, 1, 4, 'female'], '178-005/0/0'],
  [[1924, 1, 8, 0], '172-004/0/0'],
  [[1924, 1, 8, 8], '218-002/0/0'],
  [[1924, 1, 8, 11, 'female'], '226-007/0/1'],
  [[1924, 2, 8, 1], '188-001/0/0'],
  [[1924, 2, 8, 11], '178-001/0/0', '178-004/0/0'],
  [[1924, 2, 13, 4], '220-003/0/1'],
  [[1924, 2, 22, 2], '169-006/0/0'],
  [[1924, 3, 1, 5], '218-005/0/0'],
  [[1924, 3, 8, 1], '226-007/0/0'],
  [[1924, 4, 8, 1, 'female'], '178-005/0/1'],
  [[1924, 4, 8, 3], '178-001/0/1', '178-004/0/1'],
  [[1924, 4, 22, 2], '172-014/0/0'],
  [[1924, 4, 22, 7, 'female'], '172-007/0/0'],
  [[1924, 6, 15, 4], '169-005/0/0'],
  [[1924, 10, 1, 1, 'female'], '176-003/0/0'],
  [[1924, 10, 1, 7, 'female'], '172-017/0/0'],
  [[1924, 10, 5, 4], '220-003/0/0'],
  [[1926, 3, 15, 10], '189-002/1/0'],
  [[1932, 10, 1, 4, 'female'], '176-003/1/0'],
  [[1942, 3, 22, 9, 'female'], '169-008/0/0'],
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

test('every reviewed group reaches SQLite and puts only the matched source passage into report materials', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const inputsByKey = new Map(), verified = new Set();
  for (const id of ids) {
    assert.equal(states.get(claimId(id)), 'branch_indexed', id);
    catalog.get(claimId(id)).branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, jielanNatalStarProfile);
      inputs.forEach((input, index) => inputsByKey.set(`${id}/${branch}/${index}`, { text, input }));
    });
  }

  for (const [birth, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = inputsByKey.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'ziwei', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /无媒自嫁|少年恶死|丧命夭年|廉军.*寿夭|中年后始兴|风骚/u, key);
      verified.add(key);
    }
  }
  assert.deepEqual([ids.size, inputsByKey.size, witnesses.length], [17, 24, 22]);
  assert.deepEqual(verified, new Set(inputsByKey.keys()));
  assert.equal(states.has(claimId('170-003')), false);
  assert.equal(states.has(claimId('172-010')), false);
  assert.equal(states.has('ziwei-v4-jielan-179-p002-001'), false);
  for (const id of ['178-001', '178-004']) {
    assert.deepEqual(catalog.get(claimId(id)).branches.map(({ text }) => text), ['居亥卯未旺地']);
  }
});

test('the Po Jun subclause inherits the preceding seat, literary star and benefic condition', () => {
  const base = native('172-017/0/0');
  assert.equal(explain('172-017', base).matched, true);
  const withoutChang = base.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文昌');
  assert.equal(explain('172-017', withoutChang).matched, false);
  assert.equal(explain('172-017', natalFacts([1924, 1, 8, 0, 'female'])).matched, false);
});

test('the space and emptiness clause requires a natal void, and the Body seat requires an actual birth hour', () => {
  const withVoid = native('189-002/1/0');
  assert.ok(explain('189-002', withVoid).matchedBranches.some(({ text }) => text === '更凑火铃空劫'));
  const namedVoidStars = ['旬空', '截路', '空亡'];
  const withoutVoid = withVoid.filter(fact => fact.kind !== 'palace_star' || !namedVoidStars.includes(fact.star));
  assert.equal(explain('189-002', withoutVoid).matched, false);

  const fireInBody = native('220-003/0/1');
  assert.equal(explain('220-003', fireInBody).matched, true);
  assert.equal(explain('220-003', fireInBody.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
});
