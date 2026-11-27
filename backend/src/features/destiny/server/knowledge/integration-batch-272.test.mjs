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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-natal-seats-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v3-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 3, 8, 5, 'female'], '050-p631/0/0'],
  [[1926, 7, 15, 8, 'male'], '050-p631/0/1'],
  [[1924, 1, 1, 7, 'female'], '050-p641/0/0'],
  [[1924, 1, 8, 9, 'female'], '050-p643/0/0'],
  [[1924, 2, 15, 10, 'female'], '050-p643/0/1', '050-p643/0/4'],
  [[1924, 3, 15, 11, 'female'], '050-p643/0/2'],
  [[1924, 7, 8, 9, 'female'], '050-p643/0/3'],
  [[1924, 6, 8, 8, 'female'], '050-p643/0/5'],
  [[1924, 9, 8, 3, 'female'], '050-p1397/0/0'],
  [[1932, 9, 15, 3, 'female'], '050-p1397/1/0'],
  [[1924, 1, 1, 9, 'female'], '057-p1590/0/0'],
  [[1924, 1, 15, 4, 'female'], '057-p1590/0/1'],
  [[1924, 1, 15, 10, 'female'], '057-p1619/0/0'],
  [[1924, 6, 1, 6, 'female'], '057-p1627/0/0'],
  [[1924, 7, 1, 1, 'female'], '057-p1627/0/1'],
  [[1924, 2, 8, 11, 'female'], '058-p1637/0/0'],
  [[1924, 3, 1, 5, 'female'], '058-p1637/0/1'],
  [[1924, 1, 1, 3, 'male'], '058-p1660/0/0'],
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
      assert.doesNotMatch(material, /無子|子貴繁衍|多子且貴|救其厄|享壽福|一生福祿|早喪怙恃|先克母/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [9, 19, 18]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the birth-hour phase is derived and no major star requires the full native star list', () => {
  const facts = native('050-p631/0/0');
  assert.equal(explain('050-p631', facts).matched, true);
  assert.equal(explain('050-p631', facts, false).matched, false);
  const missingHour = facts.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('050-p631', [...missingHour, { kind: 'natal_ziwei_hour_phase', phase: '绝' }]).matched, false);
  const conflictingHour = [...facts, { kind: 'natal_ziwei_hour', branch: '子' }];
  assert.equal(explain('050-p631', conflictingHour).matched, false);
  const incompleteStars = facts.filter(fact => !(fact.palace === '子女' && fact.kind === 'palace_origin_star_count'));
  assert.equal(explain('050-p631', incompleteStars).matched, false);
  assert.equal(explain('050-p631', factsFor([1924, 3, 15, 5, 'female'])).matched, false);
});

test('the Mao hour and the natal Children palace branch must both be confirmed', () => {
  const facts = native('050-p1397/0/0');
  const wrongHour = facts.map(fact => fact.kind === 'natal_ziwei_hour' ? { ...fact, branch: '辰' } : fact);
  assert.equal(explain('050-p1397', wrongHour).matched, false);
  const unplaced = facts.filter(fact => !(fact.palace === '子女' && fact.kind === 'palace_branch'));
  assert.equal(explain('050-p1397', unplaced).matched, false);
  const receiving = native('050-p1397/1/0');
  const missingMoon = receiving.filter(fact => !(fact.palace === '田宅' && fact.star === '太阴'));
  assert.deepEqual(explain('050-p1397', receiving).matchedBranches.map(branch => branch.text),
    ['卯時子宮在卯地', '祿弼魁得太陰昌曲來照者']);
  assert.deepEqual(explain('050-p1397', missingMoon).matchedBranches.map(branch => branch.text), ['卯時子宮在卯地']);
});

test('the Parents palace needs both supporting stars and uses the Boshi Qinglong', () => {
  const supporting = native('058-p1637/0/0');
  assert.equal(explain('058-p1637', supporting.filter(fact => fact.star !== '右弼')).matched, false);
  const qinglong = native('058-p1660/0/0');
  assert.equal(explain('058-p1660', qinglong.map(fact => fact.kind === 'palace_boshi_star' && fact.palace === '父母'
    ? { ...fact, kind: 'palace_suiqian_star' } : fact)).matched, false);
});
