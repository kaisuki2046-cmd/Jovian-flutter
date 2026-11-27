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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-malefics-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v1-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1941, 4, 22, 10, 'female'], '010-p041/0/0'],
  [[1924, 9, 1, 6, 'female'], '010-p903/0/0'],
  [[1924, 4, 22, 7, 'female'], '010-p903/0/1'],
  [[1929, 10, 8, 5, 'female'], '010-p912/0/0', '010-p912/1/0'],
  [[1929, 2, 22, 5, 'female'], '010-p912/0/1', '010-p912/1/1'],
  [[1929, 6, 8, 5, 'female'], '010-p912/0/2', '010-p912/1/2'],
  [[1929, 6, 8, 1, 'female'], '010-p912/1/3'],
  [[1929, 10, 8, 1, 'female'], '010-p912/1/4'],
  [[1929, 2, 22, 1, 'female'], '010-p912/1/5'],
  [[1929, 4, 8, 1, 'female'], '010-p913/0/0'],
  [[1926, 11, 8, 9, 'female'], '010-p913/0/1'],
  [[1924, 6, 1, 3, 'female'], '010-p916/0/0'],
  [[1935, 7, 8, 5, 'female'], '010-p916/1/0'],
  [[1924, 1, 1, 0, 'female'], '010-p917/0/0'],
  [[1935, 5, 1, 4, 'female'], '010-p917/1/0'],
  [[1924, 1, 22, 4, 'female'], '018-p084/0/0'],
  [[1925, 2, 15, 7, 'male'], '018-p084/0/1'],
  [[1924, 4, 8, 0, 'male'], '018-p085/0/0'],
  [[1925, 2, 15, 0, 'female'], '018-p089/0/0'],
  [[1924, 11, 8, 6, 'female'], '018-p089/0/1'],
  [[1924, 8, 1, 5, 'female'], '018-p089/0/2'],
  [[1925, 1, 1, 11, 'female'], '018-p089/0/3'],
  [[1924, 9, 22, 4, 'female'], '018-p089/0/4'],
  [[1925, 3, 8, 4, 'female'], '018-p089/0/5'],
  [[1924, 5, 1, 9, 'female'], '018-p089/0/6'],
  [[1925, 5, 1, 3, 'female'], '018-p089/0/7'],
  [[1925, 7, 1, 8, 'female'], '018-p089/0/8'],
  [[1927, 7, 22, 8, 'female'], '018-p089/0/9'],
  [[1927, 4, 1, 1, 'female'], '018-p089/0/10'],
  [[1926, 9, 15, 1, 'female'], '018-p089/0/11'],
  [[1926, 3, 8, 3, 'female'], '018-p942/0/0'],
  [[1926, 4, 15, 11, 'female'], '018-p942/0/1'],
  [[1924, 2, 8, 6, 'female'], '018-p947/0/0'],
  [[1925, 6, 8, 0, 'female'], '018-p947/0/1'],
  [[1929, 12, 8, 1, 'female'], '018-p955/0/0'],
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
      assert.doesNotMatch(material, /短折|必夭折|早夭|奸盜|終不榮|破貴格|雖貴/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [12, 38, 35]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('sole major star requires confirmation that the other major stars are absent', () => {
  const facts = native('018-p084/0/0');
  const missingCount = facts.filter(fact => !(fact.palace === '疾厄' && fact.kind === 'palace_origin_star_count'));
  assert.equal(explain('018-p084', facts).matched, true);
  assert.equal(explain('018-p084', missingCount).matched, false);
  const secondMajor = [...facts, { kind: 'palace_star', palace: '疾厄', star: '天府', scope: 'origin' }];
  assert.equal(explain('018-p084', secondMajor).matched, false);
});

test('a claimed body palace cannot replace the natal hour and birth placements', () => {
  const facts = native('018-p089/0/6');
  const missingHour = facts.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('018-p089', [
    ...missingHour, { kind: 'palace_confirmed_body_seat', palace: '迁移' },
  ]).matched, false);
  assert.equal(explain('018-p089', facts, false).matched, false);
});

test('natal Ji in the same palace must actually belong to Wenqu for the Wenqu passage', () => {
  const facts = native('010-p912/1/0');
  const texts = data => explain('010-p912', data).matchedBranches.map(branch => branch.text);
  assert.deepEqual(texts(facts), ['昌陀同居', '曲忌同居']);
  const otherCarrier = factsFor([1926, 10, 15, 5, 'female']);
  assert.ok(otherCarrier.some(fact => fact.kind === 'star_mutagen' && fact.palace === '官禄'
    && fact.change === '忌' && fact.star === '廉贞'));
  assert.equal(explain('010-p912', otherCarrier).matched, false);
});

test('removing the natal Ji witness retains the base Tong and Moon placement alone', () => {
  const facts = native('010-p917/1/0');
  const removed = facts.filter(fact => !(fact.palace === '命宫' && fact.change === '忌'));
  assert.deepEqual(explain('010-p917', facts).matchedBranches.map(branch => branch.text), ['子地同月', '空忌同居']);
  assert.deepEqual(explain('010-p917', removed).matchedBranches.map(branch => branch.text), ['子地同月']);
});
