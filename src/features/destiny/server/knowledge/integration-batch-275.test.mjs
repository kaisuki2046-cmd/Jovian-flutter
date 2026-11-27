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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-empty-and-adverse-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + (/^026-p1174-/.test(key) ? key : key + '-001');

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 8, 0, 'female'], '026-p434/0/0', '028-p440/0/0', '028-p441/1/2', '028-p1179/0/0'],
  [[1924, 1, 8, 2, 'female'], '029-p448/0/0'],
  [[1924, 1, 8, 3, 'female'], '025-p1165/0/0'],
  [[1924, 2, 1, 5, 'female'], '025-p426/0/0', '025-p427/0/0'],
  [[1924, 2, 15, 9, 'female'], '026-p1174-002/0/0'],
  [[1924, 2, 22, 6, 'female'], '026-p434/0/1'],
  [[1924, 3, 8, 0, 'female'], '026-p432/0/0', '026-p1174-001/0/0'],
  [[1924, 3, 8, 2, 'female'], '026-p1172/0/0'],
  [[1924, 3, 8, 3, 'female'], '026-p435/0/0'],
  [[1924, 3, 8, 4, 'female'], '026-p432/0/1'],
  [[1924, 4, 8, 3, 'female'], '029-p449/0/0'],
  [[1924, 4, 22, 3, 'female'], '029-p451/0/0'],
  [[1924, 5, 8, 3, 'female'], '026-p1167/0/5'],
  [[1924, 5, 8, 4, 'female'], '026-p435/1/0'],
  [[1924, 7, 8, 0, 'female'], '026-p432/0/2', '026-p1174-001/0/1'],
  [[1924, 7, 8, 2, 'female'], '026-p432/0/3'],
  [[1924, 7, 8, 6, 'female'], '029-p1181/0/0'],
  [[1924, 9, 8, 2, 'female'], '026-p435/1/1'],
  [[1924, 9, 8, 3, 'female'], '026-p435/0/1'],
  [[1924, 11, 8, 0, 'female'], '026-p1169/0/0', '026-p1170/0/0', '026-p1171/0/0', '026-p1173/0/0'],
  [[1924, 11, 8, 1, 'female'], '026-p1167/0/4'],
  [[1924, 11, 8, 2, 'female'], '026-p1167/0/3'],
  [[1924, 11, 8, 3, 'female'], '026-p1167/0/2'],
  [[1924, 11, 8, 4, 'female'], '026-p1167/0/1'],
  [[1924, 11, 8, 5, 'female'], '026-p1167/0/0'],
  [[1924, 11, 8, 6, 'female'], '026-p1170/0/1', '026-p1173/1/0'],
  [[1924, 11, 15, 3, 'female'], '026-p437/0/0'],
  [[1924, 11, 15, 4, 'female'], '026-p437/0/1'],
  [[1924, 11, 22, 0, 'female'], '026-p1170/1/0'],
  [[1925, 5, 1, 1, 'male'], '030-p1183/0/0'],
  [[1926, 1, 8, 8, 'female'], '028-p441/1/0', '028-p446/0/0'],
  [[1926, 6, 22, 0, 'female'], '025-p1166/0/0'],
  [[1926, 11, 8, 7, 'female'], '029-p449/0/1'],
  [[1926, 12, 8, 6, 'female'], '028-p445/0/0'],
  [[1927, 1, 8, 7, 'male'], '028-p1178/0/0'],
  [[1927, 2, 8, 7, 'male'], '028-p441/1/3'],
  [[1927, 5, 8, 10, 'male'], '030-p1184/0/0'],
  [[1929, 11, 1, 6, 'male'], '026-p1170/1/1'],
  [[1930, 5, 8, 10, 'female'], '029-p449/0/2'],
  [[1931, 2, 22, 4, 'female'], '028-p441/1/1'],
  [[1931, 11, 22, 1, 'female'], '030-p452/0/0', '030-p453/0/0', '030-p454/0/0'],
  [[1932, 10, 8, 0, 'female'], '029-p449/0/3'],
  [[1933, 1, 8, 1, 'male'], '028-p444/0/0'],
  [[1933, 2, 8, 1, 'male'], '028-p441/0/0'],
  [[1941, 5, 8, 7, 'female'], '030-p1182/0/0'],
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
      assert.doesNotMatch(material, /夭亡|富貴|困窮|貶流|性度粗暴|早發甲科|為權貴/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [33, 58, 45]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the migration Ji must have an actual natal carrier and opposition', () => {
  const facts = native('025-p1165/0/0');
  assert.equal(explain('025-p1165', facts).matched, true);
  const withoutCarrier = facts.filter(fact => !(fact.kind === 'star_mutagen' && fact.change === '忌'));
  assert.equal(explain('025-p1165', withoutCarrier).matched, false);
  const withoutOpposition = facts.filter(fact => !(fact.anchor === '命宫' && fact.target === '迁移' && fact.relation === 'opposite'));
  assert.equal(explain('025-p1165', withoutOpposition).matched, false);
});

test('both empty stars and a confirmed trine are needed for the wealth or career passage', () => {
  const facts = native('026-p432/0/0');
  assert.equal(explain('026-p432', facts).matched, true);
  const oneStar = facts.filter(fact => !(fact.palace === '财帛' && fact.star === '地劫'));
  assert.equal(explain('026-p432', oneStar).matched, false);
  const missingTrine = facts.filter(fact => !(fact.anchor === '命宫' && fact.target === '财帛' && fact.relation === 'trine'));
  assert.equal(explain('026-p432', missingTrine).matched, false);
});

test('the tenth-month condition has separate natal seat and luminary evidence', () => {
  const facts = native('026-p1170/1/0');
  const texts = data => explain('026-p1170', data).matchedBranches.map(branch => branch.text);
  assert.deepEqual(texts(facts), ['十月生人例得空刧守身命', '而若得日月']);
  assert.deepEqual(texts(facts.filter(fact => !(fact.kind === 'palace_star' && fact.star === '太阴'))), ['十月生人例得空刧守身命']);
  assert.equal(explain('026-p1170', facts.filter(fact => fact.kind !== 'natal_lunar_month')).matched, false);
  assert.equal(explain('026-p1170', facts, false).matched, false);
});

test('a lunar birth hour, a star brightness, and the year Nayin cannot substitute for each other', () => {
  const birth = native('028-p445/0/0');
  assert.equal(explain('028-p445', birth.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  const miao = native('030-p452/0/0');
  assert.equal(explain('030-p452', miao.filter(fact => !(fact.kind === 'palace_brightness' && fact.star === '火星'))).matched, false);
  const fireYear = native('030-p1184/0/0');
  assert.equal(explain('030-p1184', fireYear.filter(fact => fact.kind !== 'natal_year_nayin_element')).matched, false);
});
