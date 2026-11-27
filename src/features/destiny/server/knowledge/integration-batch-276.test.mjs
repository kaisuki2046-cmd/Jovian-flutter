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
import { xingjuePalaceConfigurationChapter, xingjuePalaceConfigurationProfile } from './xingjue-palace-configurations.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-jumen-xiang-changqu-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 4, 'female'], '014-p1101/0/0'],
  [[1924, 1, 8, 5, 'female'], '014-p340/0/1'],
  [[1924, 1, 8, 9, 'female'], '014-p340/0/0', '014-p346/0/0', '014-p1108/0/0'],
  [[1924, 1, 15, 1, 'female'], '014-p340/0/5'],
  [[1924, 1, 15, 9, 'female'], '013-p337/0/0'],
  [[1924, 1, 22, 3, 'female'], '013-p337/0/1'],
  [[1924, 1, 22, 8, 'female'], '013-p336/0/0'],
  [[1924, 1, 22, 10, 'female'], '014-p340/0/2'],
  [[1924, 2, 1, 5, 'female'], '014-p1108/0/3', '014-p1108/1/3'],
  [[1924, 2, 8, 0, 'female'], '014-p1108/0/2'],
  [[1924, 2, 8, 1, 'female'], '018-p1131/0/0'],
  [[1924, 2, 8, 2, 'female'], '018-p1130/0/0'],
  [[1924, 2, 8, 5, 'female'], '018-p1129/0/0', '018-p1131/0/1'],
  [[1924, 2, 8, 7, 'female'], '018-p1131/0/3'],
  [[1924, 2, 8, 9, 'female'], '018-p1131/0/2'],
  [[1924, 2, 8, 11, 'female'], '018-p390/0/0'],
  [[1924, 2, 15, 2, 'female'], '018-p1132/0/0'],
  [[1924, 3, 1, 4, 'female'], '014-p1108/0/1'],
  [[1924, 3, 1, 9, 'female'], '014-p340/0/3'],
  [[1924, 3, 8, 2, 'female'], '014-p340/0/4'],
  [[1924, 4, 22, 6, 'female'], '018-p389/0/0'],
  [[1924, 5, 22, 5, 'female'], '014-p1108/0/5'],
  [[1924, 5, 22, 11, 'female'], '014-p1108/0/4'],
  [[1924, 6, 8, 1, 'female'], '018-p388/0/1'],
  [[1924, 6, 8, 4, 'female'], '014-p1108/0/7'],
  [[1924, 6, 8, 7, 'female'], '018-p388/0/3'],
  [[1924, 6, 22, 10, 'female'], '014-p1108/0/6'],
  [[1924, 10, 1, 6, 'female'], '017-p376/1/1'],
  [[1924, 10, 8, 2, 'female'], '017-p378/0/0', '017-p1124/0/0'],
  [[1924, 10, 8, 3, 'female'], '017-p377/0/0', '018-p385/0/0'],
  [[1924, 10, 8, 4, 'female'], '017-p1123/0/0'],
  [[1924, 10, 8, 5, 'female'], '018-p388/0/0'],
  [[1924, 10, 8, 8, 'female'], '017-p381/0/0', '017-p1128/0/0', '017-p1128/1/0'],
  [[1924, 10, 8, 9, 'female'], '018-p387/0/1'],
  [[1924, 10, 8, 10, 'female'], '017-p376/1/0', '017-p380/0/0'],
  [[1924, 10, 8, 11, 'female'], '018-p388/0/2'],
  [[1925, 2, 15, 2, 'female'], '014-p1108/0/10'],
  [[1925, 3, 8, 3, 'female'], '014-p1101/1/0'],
  [[1925, 3, 15, 11, 'female'], '014-p344/0/0'],
  [[1925, 4, 8, 4, 'female'], '018-p383/0/0'],
  [[1925, 8, 8, 9, 'female'], '014-p1108/0/8'],
  [[1925, 8, 15, 3, 'female'], '014-p1108/0/9'],
  [[1925, 10, 8, 5, 'female'], '014-p1108/1/0'],
  [[1925, 10, 8, 11, 'female'], '014-p1108/1/1'],
  [[1925, 11, 8, 4, 'female'], '017-p381/0/1'],
  [[1925, 11, 15, 9, 'female'], '017-p376/1/2'],
  [[1926, 2, 15, 5, 'female'], '014-p1106/0/1'],
  [[1926, 3, 8, 3, 'female'], '014-p1106/0/0'],
  [[1926, 4, 1, 5, 'female'], '014-p1102/0/0'],
  [[1926, 4, 15, 10, 'female'], '014-p341/0/1'],
  [[1926, 5, 22, 3, 'female'], '014-p1108/1/2'],
  [[1929, 10, 8, 3, 'female'], '018-p387/0/0'],
  [[1931, 2, 22, 2, 'female'], '013-p335/0/0'],
  [[1931, 3, 15, 4, 'female'], '014-p344/0/1'],
  [[1931, 8, 22, 2, 'female'], '013-p335/0/1'],
  [[1931, 9, 8, 2, 'female'], '014-p1108/0/11'],
  [[1931, 10, 22, 0, 'female'], '017-p381/0/2'],
  [[1932, 6, 1, 5, 'female'], '014-p1108/1/5'],
  [[1932, 8, 22, 8, 'female'], '014-p341/0/0'],
  [[1932, 10, 8, 10, 'female'], '017-p1124/1/0'],
  [[1933, 10, 22, 5, 'female'], '017-p376/0/0'],
  [[1933, 10, 22, 9, 'female'], '018-p384/0/0'],
  [[1934, 5, 15, 11, 'female'], '014-p1108/1/4'],
  [[1934, 8, 15, 8, 'female'], '014-p1108/1/7'],
  [[1934, 9, 22, 5, 'female'], '018-p1133/0/0'],
  [[1935, 10, 15, 11, 'female'], '017-p376/0/1'],
  [[1936, 6, 22, 10, 'female'], '014-p1108/1/6'],
  [[1938, 3, 22, 10, 'female'], '013-p339/0/0'],
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
      assert.doesNotMatch(material, /夭亡|富貴|終令終|發福無災|科與官皆蹭蹬|愚蒙不學|命宮則貧|榮貴/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [32, 77, 68]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('each of the three natal transformations requires its actual carrier', () => {
  const facts = native('013-p335/0/0');
  assert.equal(explain('013-p335', facts).matched, true);
  for (const change of ['科', '权', '禄']) {
    const missing = facts.filter(fact => !(fact.kind === 'star_mutagen' && fact.change === change));
    assert.equal(explain('013-p335', missing).matched, false, change);
  }
});

test('removing one auspicious brightness keeps only the Tianxiang and Zifu base', () => {
  const facts = native('014-p1101/1/0');
  const altered = facts.filter(fact => !(fact.kind === 'palace_brightness' && fact.palace === '迁移' && fact.star === '火星'));
  assert.deepEqual(explain('014-p1101', facts).matchedBranches.map(branch => branch.text),
    ['天相守身命、紫府朝元者', '羊刃火星入廟共會']);
  assert.deepEqual(explain('014-p1101', altered).matchedBranches.map(branch => branch.text), ['天相守身命、紫府朝元者']);
});

test('the Boshi Qinglong and the two distinct void stars require their source facts', () => {
  const facts = native('017-p380/0/0');
  const replacement = facts.map(fact => fact.kind === 'palace_boshi_star' && fact.palace === '命宫'
    ? { ...fact, kind: 'palace_suiqian_star' } : fact);
  assert.equal(explain('017-p380', replacement).matched, false);
  const twoVoids = native('018-p1133/0/0');
  assert.equal(explain('018-p1133', twoVoids).matched, true);
  const oneVoid = twoVoids.filter(fact => !(fact.palace === '官禄' && fact.star === '截路'));
  assert.equal(explain('018-p1133', oneVoid).matched, false);
});

test('the repeated chapter number has distinct volume labels', () => {
  assert.equal(xingjuePalaceConfigurationChapter('ziwei-v1-xingjue-018-p084-001'), '煞曜与长生');
  assert.equal(xingjuePalaceConfigurationChapter(claimId('018-p1133')), '文曲');
});
