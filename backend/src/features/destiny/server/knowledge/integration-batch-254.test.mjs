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
import { compileGuanceluNatal } from './ziwei-guancelu.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-guancelu-palace-evidence-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = passage => 'ziwei-v1-guancelu-001-p' + passage + '-001';
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1947, 8, 21, 6], ['005/0/0']],
  [[1947, 5, 27, 11], ['006/0/0']],
  [[1949, 12, 27, 10, 'male'], ['008/0/0', '008/0/2', '118/0/0', '151/0/0']],
  [[1952, 5, 25, 5, 'male'], ['131/0/0']],
  [[1938, 8, 15, 8, 'male'], ['008/0/4', '157/0/0']],
  [[1949, 3, 2, 0, 'male'], ['007/0/0', '168/0/0', '168/1/0']],
  [[1930, 1, 19, 5], ['008/0/1']],
  [[1930, 1, 19, 9], ['008/0/3']],
  [[1930, 2, 19, 1], ['007/0/5']],
  [[1930, 2, 19, 7], ['008/0/5']],
  [[1930, 3, 19, 8], ['007/0/4']],
  [[1930, 4, 19, 1], ['118/0/5']],
  [[1930, 4, 19, 2], ['118/0/4']],
  [[1930, 4, 19, 3], ['118/0/3']],
  [[1930, 4, 19, 4], ['118/0/2']],
  [[1930, 4, 19, 5], ['118/0/1']],
  [[1930, 7, 19, 10], ['007/0/2']],
  [[1930, 9, 19, 3], ['007/0/3']],
  [[1930, 10, 19, 0], ['049/0/0']],
  [[1931, 2, 19, 11, 'male'], ['007/0/1']],
  [[1931, 2, 17, 2], ['070/0/0']],
  [[1933, 2, 19, 0, 'male'], ['027/0/1']],
  [[1936, 2, 19, 0], ['027/0/0']],
];

function native([year, month, day, hour, gender = 'female']) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
}

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (passage, facts) => explainClaim(idOf(passage), 'ziwei', query(facts).context, undefined, catalog);
const sample = rule => native(witnesses.find(([, rules]) => rules.includes(rule))[0]);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('the reviewed Guancelu conditions reach SQLite, explanations and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/')[0])));
  const statuses = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const passage of ids) {
    const id = idOf(passage), row = catalog.get(id);
    assert.equal(statuses.get(id), row.inputs?.length ? 'indexed' : 'branch_indexed', id);
    const groups = row.inputs?.length ? [{ inputs: row.inputs, text: row.claim.evidence.original_text }] : row.branches;
    groups.forEach(({ inputs, text }, branch) => inputs.forEach((input, group) => {
      expected.set([passage, branch, group].join('/'), { input, text });
    }));
    const revised = structuredClone(row.claim);
    revised.source.edition = '待复核';
    assert.equal(compileGuanceluNatal(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size], [12, 29]);
  const seen = new Set();
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const derived = claimChartContext('ziwei', context);
    const references = lookup(queries);
    const hits = new Map(references.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    const material = buildReportMaterials(references);
    for (const rule of rules) {
      const passage = rule.split('/')[0], id = idOf(passage), { input, text } = expected.get(rule);
      assert.ok(evaluateRule(input, 'natal', derived).matched, rule);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, rule);
      assert.match(explained.calculationNote, /《斗数观测录》/u, rule);
      assert.deepEqual(quotes(hit), quotes(explained), rule);
      assert.ok(material.includes(text), rule);
      seen.add(rule);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('a lone Lu Cun requires the complete natal list in the specified palace', () => {
  for (const [id, palace] of [['005', '官禄'], ['006', '命宫']]) {
    const facts = sample(id + '/0/0');
    assert.ok(explain(id, facts).matched);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== palace)).matched, false);
    assert.equal(explain(id, facts.concat({ kind: 'palace_star', palace, star: '天虚', scope: 'origin' })).matched, false);
  }
});

test('brightness needs an observed major star at Life or the verified Body seat', () => {
  for (const [rule, state] of [['007/0/1', '陷地'], ['008/0/2', '庙旺']]) {
    const id = rule.split('/')[0], facts = sample(rule);
    const body = facts.find(fact => fact.kind === 'body_palace').palace;
    const bodyBrightness = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.palace === body);
    assert.ok(explain(id, bodyBrightness).matched);
    assert.equal(explain(id, bodyBrightness.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
    const claimedState = facts.filter(fact => fact.kind !== 'palace_brightness')
      .concat({ kind: 'palace_major_state', palace: body, state });
    assert.equal(explain(id, claimedState).matched, false);
  }
});

test('each birth stem uses its own native void marker and can match in all twelve palaces', () => {
  const { inputs } = catalog.get(idOf('027')).branches[0];
  for (const [index, year, marker, other] of [[0, 1936, '空亡', '截路'], [1, 1933, '截路', '空亡']]) {
    const input = inputs[index], placements = new Set();
    for (let hour = 0; hour < 12; hour++) {
      const { context } = query(native([year, 2, 19, hour]));
      const result = evaluateRule(input, 'natal', claimChartContext('ziwei', context));
      assert.ok(result.matched && result.conditions.alternatives.length === 1);
      placements.add(result.conditions.alternatives[0].find(fact => fact.star === marker)?.palace);
    }
    assert.equal(placements.has(undefined), false);
    assert.equal(placements.size, 12);
    const facts = sample('027/0/' + index);
    const lu = facts.find(fact => fact.kind === 'palace_star' && fact.star === '禄存');
    const swapped = facts.map(fact => fact.kind === 'palace_star' && fact.palace === lu.palace && fact.star === marker
      ? { ...fact, star: other } : fact);
    assert.equal(explain('027', swapped).matched, false);
    assert.equal(explain('027', facts.filter(fact => fact.kind !== 'natal_year_stem')).matched, false);
  }
});

test('reports reuse the body Lu quote and separate the career quote from the void reading', () => {
  const lu = sample('131/0/0'), quote = '祿存守身垣。主孤主財。';
  assert.ok(explain('102', lu).matched && explain('131', lu).matched);
  const luMaterial = buildReportMaterials(lookup(query(lu).queries));
  assert.equal(luMaterial.split(quote).length - 1, 1);
  assert.ok(!luMaterial.includes('暗昧不明。'));

  const martial = sample('168/1/0');
  assert.equal(quotes(explain('168', martial)).length, 2);
  const withoutVoid = martial.filter(fact => fact.kind !== 'palace_star' || fact.star !== '旬空');
  assert.deepEqual(quotes(explain('168', withoutVoid)), ['羊刃主武職。武貪亦主武職。']);
  assert.ok(!buildReportMaterials(lookup(query(withoutVoid).queries)).includes('臨於旬空。宜於僧道。'));
});
