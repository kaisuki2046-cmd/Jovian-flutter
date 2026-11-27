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
import { compileXingjueCareer } from './xingjue-career.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-career-witness-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = passage => 'ziwei-v3-xingjue-055-p' + passage + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1950, 11, 15, 2, 'female'], ['721/0/0', '721/1/0', '728/0/0', '1547/0/0']],
  [[1935, 6, 10, 11, 'male'], ['718/0/0', '722/0/0', '729/0/0']],
  [[1930, 6, 26, 5, 'male'], ['1543/0/1', '1543/0/3']],
  [[1934, 4, 20, 1, 'male'], ['727/0/1', '728/0/1']],
  [[1945, 6, 6, 2, 'male'], ['709/0/0', '709/0/1']],
  [[1924, 9, 29, 0, 'male'], ['712/0/0', '1554/0/0']],
  [[1930, 1, 1, 3, 'female'], ['717/0/0']],
  [[1930, 1, 1, 6, 'female'], ['1543/0/0']],
  [[1930, 2, 6, 5, 'male'], ['727/0/0']],
  [[1930, 2, 6, 11, 'male'], ['726/0/1']],
  [[1930, 4, 16, 1, 'male'], ['1543/0/2']],
  [[1944, 2, 6, 10, 'male'], ['724/0/0']],
  [[1930, 4, 16, 10, 'male'], ['715/0/2']],
  [[1930, 7, 3, 2, 'female'], ['1533/0/0']],
  [[1930, 7, 3, 5, 'female'], ['715/0/1']],
  [[1930, 9, 13, 11, 'female'], ['726/0/0']],
  [[1930, 11, 23, 9, 'female'], ['1519/0/0']],
  [[1931, 5, 1, 0, 'female'], ['1526/0/0']],
  [[1932, 9, 1, 7, 'female'], ['1557/0/0']],
  [[1933, 8, 4, 3, 'male'], ['1515/0/0']],
  [[1934, 3, 15, 2, 'female'], ['1529/0/0']],
  [[1934, 3, 15, 3, 'female'], ['714/0/0']],
  [[1934, 3, 15, 7, 'female'], ['715/0/3']],
  [[1935, 2, 18, 7, 'male'], ['1530/0/0']],
  [[1936, 8, 28, 3, 'male'], ['1558/1/0']],
  [[1936, 8, 28, 10, 'male'], ['1552/0/0']],
  [[1939, 4, 4, 1, 'male'], ['1517/0/0']],
  [[1944, 2, 6, 2, 'male'], ['715/0/0']],
  [[1944, 2, 6, 4, 'male'], ['1539/0/1']],
  [[1944, 3, 11, 5, 'female'], ['1539/0/2']],
  [[1944, 4, 16, 6, 'male'], ['1539/0/0']],
  [[1944, 10, 18, 10, 'male'], ['1540/0/0']],
  [[1946, 3, 27, 8, 'female'], ['722/1/0']],
  [[1948, 2, 10, 1, 'male'], ['713/0/0']],
  [[1961, 10, 14, 10, 'male'], ['1558/0/0']],
  [[1924, 2, 6, 0, 'male'], ['1555/0/0']],
  [[1924, 4, 6, 0, 'male'], ['1559/0/0']],
  [[1930, 6, 12, 4, 'male'], ['720/0/0']],
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

test('the reviewed career passages reach SQLite explanations and reports from actual births', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const statuses = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const passage of ids) {
    const id = idOf(passage), row = catalog.get(id);
    assert.equal(statuses.get(id), 'branch_indexed', id);
    row.branches.forEach(({ text, inputs }, branch) => inputs.forEach((input, group) => {
      expected.set([passage, branch, group].join('/'), { input, text });
    }));
    const revised = structuredClone(row.claim);
    revised.source.edition = '待校';
    assert.equal(compileXingjueCareer(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, expected.size], [32, 47]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const references = lookup(queries), material = buildReportMaterials(references);
    const hits = new Map(references.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const id = idOf(key.split('/')[0]), { input, text } = expected.get(key);
      assert.ok(evaluateRule(input, 'natal', chart).matched, key);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, key);
      assert.match(explained.calculationNote, /紫微星诀.*官禄/u);
      assert.deepEqual(quotes(hit), quotes(explained), key);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the career gallery horse requires a real outer trine and a horse in the career palace', () => {
  const facts = sample('712/0/0');
  assert.ok(explain('712', facts).matched);
  const misplacedGallery = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '凤阁')
    .concat({ kind: 'palace_star', palace: '官禄', star: '凤阁', scope: 'origin' });
  assert.equal(explain('712', misplacedGallery).matched, false);
  assert.equal(explain('712', facts.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '官禄' || fact.star !== '天马')).matched, false);
  const wealth = sample('724/0/0').map(fact => fact.kind === 'palace_star' && fact.star === '武曲'
    ? { ...fact, palace: '官禄' } : fact);
  assert.equal(explain('724', wealth).matched, false);
});

test('the Ox authority and the Hai support are kept separate from the base passages', () => {
  const ox = sample('721/1/0'), main = '丑地官宮日月同守、科祿同居';
  assert.deepEqual(quotes(explain('721', ox)), [main, '化權合者至奇']);
  const noAuthority = ox.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '权');
  assert.deepEqual(quotes(explain('721', noAuthority)), [main]);
  const noKe = ox.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '科');
  assert.equal(explain('721', noKe).matched, false);
  assert.ok(explain('1547', noKe).matched);
  const hai = sample('722/1/0'), noOfficial = hai.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '夫妻' || fact.star !== '天官');
  assert.deepEqual(quotes(explain('722', noOfficial)), ['亥宮貪貞雖是陷地']);
});

test('career flank, body and growth passages require witnesses for each stated relationship', () => {
  const army = sample('1559/0/0');
  assert.equal(explain('1559', army.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '田宅' || fact.star !== '天梁')).matched, false);
  const body = sample('1539/0/0');
  assert.equal(explain('1539', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  const growth = sample('1555/0/0').filter(fact => fact.kind !== 'natal_ziwei_bureau');
  const suppliedPhase = { kind: 'palace_changsheng_phase', palace: '官禄', phase: '帝旺' };
  assert.equal(explain('1555', growth.concat(suppliedPhase)).matched, false);
  const dragon = sample('715/0/0');
  assert.equal(explain('715', dragon.filter(fact => fact.kind !== 'palace_boshi_star'
    || fact.palace !== '官禄' || fact.star !== '青龙')).matched, false);
});
