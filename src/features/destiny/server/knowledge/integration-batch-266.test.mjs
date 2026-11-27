import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { compileShenfengReviewed, shenfengRepeatedPassages, shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-reviewed-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const source = '神峰通考';
const idOf = id => 'muxuan-v1-' + id + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1984,1,8,4], ['f007-p00056/0/3']],
  [[1984,1,8,6], ['f007-p00056/0/4']],
  [[1984,1,8,18], ['f009-p00081/0/0','f013-p00050/0/0','f013-p00054/0/1','f013-p00077/0/0']],
  [[1984,1,12,0], ['f007-p00066/0/0','f009-p00123/0/0']],
  [[1984,1,12,2], ['f009-p00072/0/0']],
  [[1984,1,12,4], ['f007-p00070/0/0']],
  [[1984,1,12,6], ['f007-p00059/0/0']],
  [[1984,1,16,0], ['f007-p00056/0/16']],
  [[1984,1,16,22], ['f007-p00056/0/15']],
  [[1984,1,20,10], ['f007-p00056/0/7']],
  [[1984,1,20,12], ['f007-p00056/0/8']],
  [[1984,1,24,16], ['f007-p00056/0/11']],
  [[1984,1,24,18], ['f007-p00056/0/12']],
  [[1984,1,28,18], ['f013-p00054/0/0']],
  [[1984,2,8,10], ['f007-p00056/0/5']],
  [[1984,2,8,12], ['f007-p00056/0/6']],
  [[1984,2,12,2], ['f007-p00050/0/0','f009-p00125/0/0']],
  [[1984,2,12,16], ['f007-p00056/0/9']],
  [[1984,2,12,18], ['f007-p00056/0/10']],
  [[1984,2,16,4], ['f007-p00056/0/1']],
  [[1984,2,16,6], ['f007-p00056/0/2']],
  [[1984,2,20,10], ['f007-p00056/0/0']],
  [[1984,2,24,0], ['f007-p00056/0/14']],
  [[1984,2,24,22], ['f007-p00056/0/13']],
  [[1984,3,24,0], ['f007-p00050/0/1','f009-p00125/0/1']],
  [[1984,4,16,22], ['f007-p00048/0/0']],
  [[1984,5,20,0], ['f007-p00071/0/0']],
  [[1984,6,28,0], ['f007-p00058/0/1']],
  [[1984,7,20,0], ['f007-p00071/0/1']],
  [[1984,8,16,0], ['f007-p00058/0/0','f007-p00058/1/0']],
  [[1984,11,16,0], ['f009-p00083/0/0','f009-p00094/0/0']],
  [[1985,12,20,0], ['f007-p00058/1/7']],
  [[1987,8,12,0], ['f007-p00058/1/4']],
  [[1988,9,24,0], ['f007-p00058/1/1']],
  [[1990,11,24,0], ['f007-p00058/1/6']],
  [[1991,9,20,0], ['f007-p00058/1/5']],
  [[1991,11,8,8], ['f007-p00058/1/2']],
  [[2003,11,16,6], ['f007-p00058/2/1']],
  [[2005,12,24,0], ['f007-p00058/1/3']],
  [[2023,11,20,14], ['f007-p00058/2/0']],
  [[1984,3,27,0], ['f007-p00044/0/6']],
  [[1984,5,21,0], ['f007-p00044/0/1']],
  [[1984,5,29,0], ['f007-p00044/0/9']],
  [[1984,9,9,0], ['f007-p00044/0/2']],
  [[1985,11,26,0], ['f007-p00044/0/5']],
  [[1986,7,7,0], ['f007-p00044/0/8']],
  [[1988,6,28,0], ['f007-p00044/0/0']],
  [[1988,8,30,0], ['f007-p00044/0/3']],
  [[1988,12,29,0], ['f007-p00044/0/4']],
  [[1989,3,2,0], ['f007-p00044/0/7']],
];

function native([year, month, day, hour]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  return chartFacts.bazi(calculateBaZi(wall - 8 * 3_600_000, wall, 'male'));
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, tradition: source, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('bazi', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const sample = key => native(witnesses.find(([, keys]) => keys.includes(key))[0]);
const explain = (id, facts, timeKnown) => explainClaim(idOf(id), 'bazi', query(facts, timeKnown).context, source, catalog);

test('each rechecked configuration reaches SQLite and report materials from a native chart', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const records = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const expected = new Map();
  for (const record of records) {
    const id = idOf(record), { claim, branches } = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', record);
    branches.forEach(({ text, inputs, conditionCompiler }, branchIndex) => {
      assert.equal(conditionCompiler, shenfengReviewedProfile, id);
      inputs.forEach((input, index) => expected.set([record, branchIndex, index].join('/'), { text, input }));
    });
    const changed = structuredClone(claim);
    changed.source.edition += '改版';
    assert.equal(compileShenfengReviewed(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [18, 58, 50]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const refs = lookup(queries), material = buildReportMaterials(refs);
    const hits = new Map(refs.flatMap(({ personality, events }) => [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const [record] = key.split('/'), id = idOf(record), { text, input } = expected.get(key);
      const hit = hits.get(id), evidence = explainClaim(id, 'bazi', context, source, catalog);
      assert.ok(hit && evidence.matched, key);
      assert.deepEqual(hit.matchedBranches, evidence.matchedBranches, key);
      const proof = evidence.matchedBranches.find(branch => branch.text === text);
      assert.deepEqual(proof?.matchedConditions.required, input.required, key);
      const selected = hits.get(shenfengRepeatedPassages.get(id)?.id) ?? hit;
      assert.ok(material.includes(selected.matchedBranches.some(branch => branch.text === text)
        ? text : selected.matchedBranches[0].text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('treasury wealth needs the same stem exposed and hidden in its actual month', () => {
  const same = native([1984, 1, 12, 6]);
  assert.equal(explain('f007-p00059', same).matched, true);
  const different = native([1984, 1, 12, 4]);
  assert.ok(different.some(fact => fact.kind === 'hidden_ten_god' && fact.position === 'month' && fact.stem === '己'));
  assert.ok(different.some(fact => fact.kind === 'stem_ten_god' && fact.position === 'hour' && fact.tenGod === '正财'));
  assert.equal(explain('f007-p00059', different).matched, false);
  const forged = { kind: 'bazi_natal_configuration', name: '四库月藏财同干透出' };
  assert.equal(explain('f007-p00059', [...different, forged]).matched, false);
  assert.equal(explain('f007-p00059', same, false).matched, false);
});

test('dedicated wealth, autumn and winter, and the Hai triple retain their own scope', () => {
  assert.equal(explain('f007-p00056', sample('f007-p00056/0/0'), false).matched, false);
  const hai = sample('f007-p00058/2/1');
  const lostHour = native([2003, 11, 16, 8]);
  const excerpts = facts => explain('f007-p00058', facts).matchedBranches.map(branch => branch.text);
  assert.ok(excerpts(hai).includes('生亥月最喜亥卯未伤官木局'));
  assert.deepEqual(excerpts(lostHour), ['壬午癸巳二日', '喜生秋冬通金水月气']);
  assert.equal(explain('f013-p00077', sample('f013-p00077/0/0'), false).matched, false);
});

test('repeated material is quoted once and former judgments stay at the source', async () => {
  const { queries } = query(sample('f007-p00066/0/0'));
  const canonical = idOf('f007-p00066'), alias = idOf('f009-p00123');
  const lookupPair = input => lookup(input).map(group => ({
    ...group,
    personality: group.personality.filter(hit => [canonical, alias].includes(hit.id)),
    events: group.events.filter(hit => [canonical, alias].includes(hit.id)),
  }));
  assert.match(catalog.get(canonical).claim.evidence.original_text, /富屋贫人/u);
  const result = await generateReport({ chartQueries: queries }, {
    lookup: lookupPair, signal: new AbortController().signal,
    complete: async ({ materials, references }) => {
      assert.equal((materials.match(/原文\/依据：财旺而日主弱/gu) ?? []).length, 1);
      assert.doesNotMatch(materials, /富屋贫人|财反为害命之物/u);
      const hit = references.flatMap(ref => [...ref.personality, ...ref.events]).find(ref => ref.id === canonical);
      assert.equal(hit.title, '《神峰通考》本命盘面分句');
      return '验证报告';
    },
  });
  assert.equal(result.report, '验证报告');
});
