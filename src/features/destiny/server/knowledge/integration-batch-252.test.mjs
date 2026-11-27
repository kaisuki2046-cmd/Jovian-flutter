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
import { compileXingjueNatalStars } from './xingjue-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-purple-and-treasury-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix = '001') => `ziwei-v2-xingjue-004-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, then source passage, suffix, text and condition group.
const witnesses = [
  [[1930, 8, 19, 10], ['239/001/0/0', '243/001/0/0', '249/001/0/0', '251/001/0/0', '252/001/1/0', '1061/001/0/0', '1066/001/0/0']],
  [[1975, 10, 19, 2, 'male'], ['247/001/0/0', '1059/001/0/0', '1060/001/1/0']],
  [[1934, 9, 6, 0], ['1060/001/0/0', '1064/001/0/0', '1071/001/0/0']],
  [[1948, 2, 19, 4], ['1061/001/1/0', '1069/001/1/0']],
  [[1930, 2, 19, 4], ['242/001/0/0']],
  [[1930, 2, 19, 6], ['250/001/0/0']],
  [[1930, 3, 19, 8], ['252/001/0/0']],
  [[1930, 12, 19, 6], ['245/001/0/0']],
  [[1931, 3, 19, 6, 'male'], ['1070/001/0/0']],
  [[1932, 1, 19, 0], ['1058/001/0/0']],
  [[1932, 6, 19, 9], ['1070/001/1/0']],
  [[1932, 10, 19, 0], ['1069/001/3/0']],
  [[1934, 2, 19, 7], ['1066/001/1/0']],
  [[1934, 12, 19, 6], ['248/001/0/0']],
  [[1938, 2, 19, 7], ['240/001/0/0']],
  [[1945, 12, 19, 11, 'male'], ['1057/001/0/0']],
  [[1959, 8, 19, 10, 'male'], ['1069/001/0/0']],
  [[1931, 1, 19, 3, 'male'], ['1069/001/2/0']],
  [[1948, 2, 16, 8], ['251/001/0/1']],
];

function native([year, month, day, hour, gender = 'female']) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, context: chartContext('ziwei', present, absent, chartScope) };
}

const explain = (passage, facts, known) => explainClaim(idOf(passage), 'ziwei', query(facts, known).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('the Purple Emperor and Treasury passages reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();

  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    assert.equal(inventory.get(id), 'branch_indexed', id);
    assert.ok(row.branches.length, id);
    row.branches.forEach(({ inputs }, branch) => {
      inputs.forEach((_, group) => expected.add([key, branch, group].join('/')));
    });
    const changedSource = structuredClone(row.claim);
    changedSource.source.edition = '校勘待核';
    assert.equal(compileXingjueNatalStars(changedSource).reason, 'source_review_required', id);
  }

  assert.deepEqual([ids.size, expected.size], [21, 30]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [passage, suffix, branch, group] = rule.split('/'), id = idOf(passage, suffix);
      const { inputs, text } = catalog.get(id).branches[branch];
      assert.ok(evaluateRule(inputs[group], 'natal', chart).matched, rule);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, rule);
      assert.match(explained.calculationNote, /紫微星诀.*论紫府/u, rule);
      assert.ok(quotes(hit).includes(text), rule);
      assert.deepEqual(quotes(hit), quotes(explained), rule);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), rule);
      assert.doesNotMatch(material, /现代释义：/u, rule);
      seen.add(rule);
    }
  }
  assert.deepEqual(seen, expected);
});



test('verified Body placement and Hua Ke distinguish the two Xu Treasury passages', () => {
  const paired = native([1948, 2, 19, 4]);
  assert.equal(quotes(explain('1061', paired)).length, 2);
  assert.equal(explain('1061', paired, false).matched, false);
  const missingKe = paired.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '科');
  assert.deepEqual(quotes(explain('1061', missingKe)), ['戌府守命、午紫守身是謂紫府迭守']);
});

test('left and right flanks cannot replace complete proof of the other stars being absent', () => {
  const flanks = native([1945, 12, 19, 11, 'male']);
  assert.ok(explain('1057', flanks).matched);
  const incomplete = flanks.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain('1057', incomplete).matched, false);
  const missingFlank = flanks.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '命宫' || fact.target !== '兄弟' || fact.relation !== 'adjacent');
  assert.equal(explain('1057', missingFlank).matched, false);
});

test('the unfavorable and favorable Xu Treasury readings use independently confirmed facts', () => {
  const moderate = native([1931, 1, 19, 3, 'male']);
  assert.deepEqual(quotes(explain('1069', moderate)), ['不逢左右魁鉞科祿者、中平']);
  const missingKe = moderate.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '科');
  assert.equal(explain('1069', missingKe).matched, false);
  const affliction = native([1932, 10, 19, 0]);
  assert.deepEqual(quotes(explain('1069', affliction)), ['加殺者非']);
});

test('an attained Wuqu and a void Treasury do not substitute for the two sources of Lu', () => {
  const chart = native([1934, 9, 6, 0]);
  assert.ok(explain('1071', chart).matched);
  const noTransformedLu = chart.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '禄');
  assert.equal(explain('1071', noTransformedLu).matched, false);
  const noLuCun = chart.filter(fact => fact.kind !== 'palace_star' || fact.star !== '禄存');
  assert.equal(explain('1071', noLuCun).matched, false);
});
