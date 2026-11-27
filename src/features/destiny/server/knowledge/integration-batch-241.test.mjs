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
import { compileJielanNatalStars } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-supplement-and-accompanying-stars-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => {
  const volume = ['233', '234'].includes(chapter) ? 'v5' : 'v4';
  const passage = ['228', '233'].includes(chapter) ? 'p002' : 'p001';
  return `ziwei-${volume}-jielan-${chapter}-${passage}-${suffix}`;
};

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1930, 2, 19, 5], ['225/002/0/0', '225/002/1/0', '234/002/0/0']],
  [[1930, 2, 19, 6], ['233/006/3/0']],
  [[1930, 2, 19, 7], ['225/001/0/1', '225/002/0/1', '225/002/1/1', '228/003/0/0']],
  [[1930, 3, 19, 3], ['233/008/0/0']],
  [[1930, 4, 19, 6], ['234/007/1/0']],
  [[1930, 5, 19, 5], ['225/003/0/0']],
  [[1930, 5, 19, 7], ['225/003/0/1']],
  [[1930, 5, 19, 10], ['233/001/0/0', '234/017/0/0', '234/018/1/0']],
  [[1930, 11, 19, 1], ['228/001/0/0', '226/001/0/0', '226/002/0/0', '226/003/0/0', '226/003/1/0', '234/007/0/0', '226/006/0/0']],
  [[1930, 12, 19, 0], ['233/009/0/0']],
  [[1930, 12, 19, 3], ['233/005/1/0']],
  [[1930, 12, 19, 10], ['233/001/1/0', '234/026/0/0']],
  [[1931, 2, 19, 9], ['233/002/0/0']],
  [[1931, 12, 19, 1], ['226/001/1/0']],
  [[1931, 12, 19, 11], ['226/001/1/1']],
  [[1932, 2, 19, 10], ['233/004/1/0', '233/004/2/0']],
  [[1934, 5, 19, 3], ['233/006/1/0']],
  [[1934, 10, 19, 2], ['233/005/0/0']],
  [[1935, 2, 19, 2], ['228/002/0/1']],
  [[1935, 2, 19, 10], ['228/002/0/0']],
  [[1935, 3, 19, 0], ['233/003/1/0', '233/009/1/0']],
  [[1936, 6, 19, 4], ['234/021/0/0', '234/021/1/0']],
  [[1938, 5, 31, 11], ['226/001/0/1', '226/003/0/1', '226/003/1/1', '233/004/0/0', '234/001/0/0', '226/006/0/1', '234/013/0/0', '234/018/0/0', '234/025/0/0']],
  [[1942, 7, 19, 11], ['226/005/0/0']],
  [[1952, 5, 19, 6], ['233/006/4/0', '234/002/1/0', '234/003/0/0']],
  [[1953, 5, 19, 5], ['228/001/0/1', '233/003/0/0', '225/001/0/0', '233/006/0/0', '234/006/0/0', '234/020/0/0']],
  [[1961, 6, 19, 9], ['233/010/0/0', '233/012/0/0']],
  [[1988, 4, 19, 11], ['226/002/0/1', '233/006/2/0', '234/013/1/0']],
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

const explain = (id, facts, timeKnown) => explainClaim(id, 'ziwei', query(facts, timeKnown).context, undefined, catalog);
const passages = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const quotes = detail => detail.matchedBranches?.map(branch => branch.text) ?? [];

test('all new accompanying-star and supplementary rules reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
  const inventory = new Map(catalog.inventory().map(({claim, lookup: state}) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();
  let whole = 0;
  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    assert.ok(row, id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    passages(row).forEach(({inputs}, passage) => {
      inputs.forEach((_, group) => expected.add([key, passage, group].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [33, 8, 63]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [chapter, suffix, passage, group] = rule.split('/'), id = idOf(chapter, suffix);
      const row = catalog.get(id), { inputs, text } = passages(row)[passage];
      assert.ok(evaluateRule(inputs[group], 'natal', chart).matched, rule);
      const hit = hits.get(id), detail = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && detail.matched, rule);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text ?? row.claim.evidence.original_text), rule);
      if (text) {
        assert.ok(quotes(hit).includes(text), rule);
        assert.deepEqual(quotes(hit), quotes(detail), rule);
        assert.doesNotMatch(material, /现代释义：/u, rule);
      }
      seen.add(rule);
    }
  }
  assert.equal(witnesses.length, 28);
  assert.deepEqual(seen, expected);
});

test('same-palace aides require the named ordinary lunar month and its verified hour', () => {
  const id = idOf('233', '001');
  const cases = [
    [[1930, 5, 19, 10], '未安命，四月生者。'],
    [[1930, 12, 19, 10], '丑安命，十月生者。'],
  ];
  for (const [birth, verse] of cases) {
    const observed = native(birth);
    assert.deepEqual(quotes(explain(id, observed)), [verse]);
    const leap = observed.map(f => f.kind === 'natal_lunar_month' ? { ...f, leap: true } : f);
    assert.equal(explain(id, leap).matched, false);
    assert.equal(explain(id, observed.filter(f => f.kind !== 'natal_ziwei_hour')).matched, false);
  }
});

test('the supplement requires actual Lu and Quan carriers at their stated palaces', () => {
  const id = idOf('233', '006');
  const observed = native([1934, 5, 19, 3]);
  assert.deepEqual(quotes(explain(id, observed)), ['命有禄存，又逢化禄是也。', '甲生人，命里禄存在寅，廉贞亦在寅化禄。']);
  assert.equal(explain(id, observed.filter(f => f.kind !== 'star_mutagen' || f.change !== '禄')).matched, false);
  assert.equal(explain(id, observed.filter(f => f.kind !== 'palace_star' || f.star !== '禄存')).matched, false);

  const sun = idOf('233', '002'), sunObserved = native([1931, 2, 19, 9]);
  assert.ok(explain(sun, sunObserved).matched);
  const withoutSun = sunObserved.filter(f => f.kind !== 'star_mutagen' || f.star !== '太阳');
  assert.equal(explain(sun, withoutSun).matched, false);
});

test('complete absence and the accompanying-star qualifications do not borrow unrelated witnesses', () => {
  const lian = idOf('233', '005'), clean = native([1934, 10, 19, 2]);
  assert.equal(quotes(explain(lian, clean)).length, 1);
  const partial = clean.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '命宫');
  assert.equal(explain(lian, partial).matched, false);
  assert.deepEqual(quotes(explain(lian, native([1930, 12, 19, 3]))), ['加杀平常。']);

  const hongluan = idOf('228', '003'), body = native([1930, 2, 19, 7]);
  assert.ok(explain(hongluan, body).matched);
  assert.equal(explain(hongluan, body.filter(f => f.kind !== 'body_palace')).matched, false);
  const literature = quotes(explain(idOf('233', '004'), native([1938, 5, 31, 11])));
  assert.ok(literature.includes('文曲武曲居庙旺处，将相之材。'));
  assert.ok(!literature.includes('若逢左右，为贵格论。'));
});
