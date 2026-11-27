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
import { compileXingjueFude } from './xingjue-fude.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-fude-witness-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = passage => 'ziwei-v3-xingjue-057-p' + passage + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1930, 1, 1, 8, "female"], ["1628/0/0", "1628/0/5"]],
  [[1934, 3, 15, 4, "female"], ["758/0/0", "1603/0/0", "1628/0/1"]],
  [[1930, 1, 1, 0, "female"], ["1628/0/2"]],
  [[1930, 10, 18, 0, "male"], ["1628/0/4", "1628/0/5"]],
  [[1934, 8, 12, 7, "male"], ["1596/0/0", "1596/1/0", "1628/0/0"]],
  [[1930, 5, 21, 8, "female"], ["1628/0/3"]],
  [[1930, 1, 1, 2, "female"], ["751/0/0", "1628/0/5"]],
  [[1930, 12, 28, 10, "male"], ["749/0/1", "764/0/0"]],
  [[1964, 2, 26, 2, "male"], ["749/0/2", "759/0/0", "1603/0/0"]],
  [[1974, 5, 9, 6, "female"], ["763/0/0", "1628/0/1"]],
  [[1930, 1, 1, 10, "female"], ["1628/0/1"]],
  [[1930, 3, 11, 1, "female"], ["1628/0/3"]],
  [[1930, 4, 16, 6, "male"], ["749/0/0"]],
  [[1930, 6, 26, 10, "male"], ["1614/0/0", "1628/0/2"]],
  [[1930, 8, 8, 5, "male"], ["1620/0/0", "1628/0/5"]],
  [[1931, 1, 9, 6, "female"], ["1599/0/0"]],
  [[1931, 8, 16, 10, "male"], ["1636/0/0"]],
  [[1933, 9, 9, 4, "female"], ["1613/0/0"]],
  [[1934, 9, 17, 6, "female"], ["1609/0/0", "1628/0/4", "1628/0/5"]],
  [[1934, 12, 4, 2, "male"], ["750/0/0"]],
  [[1935, 8, 20, 5, "male"], ["749/0/3"]],
  [[1935, 12, 12, 5, "male"], ["760/0/0"]],
  [[1936, 4, 8, 9, "male"], ["749/0/4"]],
  [[1938, 8, 16, 3, "male"], ["1635/0/0"]],
  [[1939, 7, 19, 10, "female"], ["761/0/0"]],
  [[1942, 8, 20, 7, "male"], ["749/0/5"]],
  [[1944, 10, 18, 7, "male"], ["1611/0/0", "1628/0/3"]],
  [[1951, 5, 21, 0, "female"], ["765/0/0"]],
  [[1954, 4, 12, 8, "male"], ["1587/0/0"]],
  [[1924, 2, 5, 0, "female"], ["751/0/0", "755/0/0"]],
  [[1930, 3, 11, 2, "female"], ["1628/0/2"]],
  [[1930, 6, 26, 9, "male"], ["764/0/0", "1628/0/3"]],
  [[1930, 10, 18, 1, "male"], ["1628/0/4"]],
  [[1930, 10, 18, 2, "male"], ["1628/0/0", "1628/0/4"]],
];

function native([year, month, day, hour, gender]) {
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

const sample = rule => native(witnesses.find(([, rules]) => rules.includes(rule))[0]);
const explain = (passage, facts) => explainClaim(idOf(passage), 'ziwei', query(facts).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('the reviewed Fude rules reach SQLite and reports with every observed alternative', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(key => key.split('/')[0])));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map(), expectedAlternatives = new Set();
  for (const passage of ids) {
    const id = idOf(passage), row = catalog.get(id);
    assert.equal(inventory.get(id), row.inputs?.length ? 'indexed' : 'branch_indexed', id);
    const branches = row.inputs?.length ? [{ inputs: row.inputs, text: row.claim.evidence.original_text }] : row.branches;
    branches.forEach(({ inputs, text }, branch) => inputs.forEach((input, group) => {
      const key = [passage, branch, group].join('/');
      expected.set(key, { input, text });
      input.anyOf.forEach((_, index) => expectedAlternatives.add(key + '/' + index));
    }));
    const revised = structuredClone(row.claim);
    revised.source.edition = '待校';
    assert.equal(compileXingjueFude(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size, expectedAlternatives.size], [23, 34, 30]);
  const seen = new Set(), alternatives = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const derived = claimChartContext('ziwei', context);
    for (const key of keys) {
      const { input } = expected.get(key);
      const result = evaluateRule(input, 'natal', derived);
      assert.ok(result.matched, key);
      for (const choice of result.conditions.alternatives) alternatives.add(key + '/' + input.anyOf.indexOf(choice));
    }
    const newKeys = keys.filter(key => !seen.has(key));
    if (!newKeys.length) continue;
    const references = lookup(queries), material = buildReportMaterials(references);
    const hits = new Map(references.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of newKeys) {
      const id = idOf(key.split('/')[0]);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, key);
      assert.match(explained.calculationNote, /紫微星诀.*福德/u);
      assert.deepEqual(quotes(hit), quotes(explained), key);
      assert.ok(material.includes(expected.get(key).text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.deepEqual(alternatives, expectedAlternatives);
});

test('verified body and complete sector evidence are required for Fude without afflictions', () => {
  const facts = sample('749/0/2');
  assert.ok(explain('749', facts).matched);
  const noHour = facts.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('749', noHour).matched, false);
  const noWholeSector = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain('749', noWholeSector).matched, false);
  const fakeClear = noWholeSector.concat({ kind: 'palace_sector_six_malefic_count', palace: '福德', count: 0 });
  assert.equal(explain('749', fakeClear).matched, false);
});

test('the Fude solo and calendar conditions use their own witnesses', () => {
  const terrace = sample('761/0/0');
  const tooMany = terrace.concat({ kind: 'palace_star', palace: '福德', star: '天虚', scope: 'origin' });
  assert.ok(explain('761', terrace).matched);
  assert.equal(explain('761', tooMany).matched, false);
  const seals = sample('1587/0/0');
  const reversed = seals.map(fact => {
    if (fact.palace !== '福德') return fact;
    if (fact.kind === 'palace_suiqian_star') return { ...fact, star: '病符' };
    if (fact.kind === 'palace_boshi_star') return { ...fact, star: '官符' };
    return fact;
  });
  assert.ok(explain('1587', seals).matched);
  assert.equal(explain('1587', reversed).matched, false);
});

test('the cited water and transformation clauses keep their extra evidence', () => {
  const body = sample('1596/1/0');
  assert.equal(quotes(explain('1596', body)).length, 2);
  const noBureau = body.filter(fact => fact.kind !== 'natal_ziwei_bureau');
  assert.deepEqual(quotes(explain('1596', noBureau)), ['卯地身福宮羊昌天刑甚不宜']);
  assert.equal(explain('1596', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  for (const id of ['750', '763', '1609']) {
    const facts = sample(id + '/0/0');
    const noCarrier = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
    assert.ok(explain(id, facts).matched);
    assert.equal(explain(id, noCarrier).matched, false);
  }
  for (const id of ['762', '1622', '1623']) {
    const row = catalog.get(idOf(id));
    assert.equal(row.inputs, undefined, id);
    assert.equal(row.branches.length, 0, id);
  }
});
