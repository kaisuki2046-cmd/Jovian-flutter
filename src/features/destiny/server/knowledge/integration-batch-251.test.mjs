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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-sun-and-moon-rest-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix = '001') => `ziwei-v2-xingjue-007-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, then source passage, suffix, text and condition group.
const witnesses = [
  [[1931, 3, 19, 11, 'male'], ['278/001/0/0', '290/001/0/0', '846/001/0/0']],
  [[1930, 6, 19, 5], ['276/001/0/0', '287/001/0/0']],
  [[1932, 7, 13, 0, 'male'], ['277/001/0/0', '281/001/0/0']],
  [[1930, 8, 19, 4], ['845/001/0/0']],
  [[1931, 2, 19, 0, 'male'], ['844/001/0/0']],
  [[1931, 4, 19, 6, 'male'], ['291/001/0/0']],
  [[1932, 10, 19, 2], ['874/001/0/0']],
  [[1935, 1, 19, 3, 'male'], ['289/001/0/0']],
  [[1936, 10, 19, 3], ['850/001/0/0']],
  [[1949, 8, 19, 1, 'male'], ['271/001/0/0']],
  [[1933, 5, 6, 7, 'male'], ['290/001/1/0']],
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

test('the additional Sun and Moon passages reach SQLite and report materials', () => {
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

  assert.deepEqual([ids.size, expected.size], [14, 15]);
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


test('a repeated source can be queried under both records and is cited once', () => {
  for (const [birth, short, full] of [
    [[1949, 8, 19, 1, 'male'], '271', '842'],
    [[1931, 3, 19, 11, 'male'], '278', '846'],
  ]) {
    const { queries } = query(native(birth));
    const hits = lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);
    const shortHit = hits.find(hit => hit.id === idOf(short)), fullHit = hits.find(hit => hit.id === idOf(full));
    assert.ok(shortHit && fullHit);
    const material = buildReportMaterials([{ topic: fullHit.topic, personality: [], events: [shortHit, fullHit] }]);
    assert.equal(material.split('\n').filter(line => line.startsWith('原文/依据：')).length, 1);
    assert.ok(material.includes(fullHit.matchedBranches[0].text));
    assert.notEqual(shortHit.claim.source.passage_id, fullHit.claim.source.passage_id);
  }
});

test('water void requires the Water bureau and a void star with the Hai Moon', () => {
  const facts = native([1932, 7, 13, 0, 'male']);
  assert.ok(explain('281', facts).matched);
  const missingBureau = facts.filter(fact => fact.kind !== 'natal_ziwei_bureau');
  assert.equal(explain('281', missingBureau).matched, false);
  const missingVoid = facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '官禄'
    || !['天空', '地空', '旬空'].includes(fact.star));
  assert.equal(explain('281', missingVoid).matched, false);
});

test('the void warning and a true Body seat have their own requirements', () => {
  const voidChart = native([1933, 5, 6, 7, 'male']);
  assert.equal(quotes(explain('290', voidChart)).length, 2);
  const missingFire = voidChart.filter(fact => fact.kind !== 'palace_star' || fact.star !== '火星');
  assert.deepEqual(quotes(explain('290', missingFire)), ['旬路天地空皆喜逢']);

  const body = native([1936, 10, 19, 3]);
  assert.ok(explain('850', body).matched);
  assert.equal(explain('850', body, false).matched, false);
});
