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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-literary-and-aides-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => {
  const passage = ['178', '179', '182'].includes(chapter) ? 'p002' : 'p001';
  return `ziwei-v4-jielan-${chapter}-${passage}-${suffix}`;
};

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1932, 2, 19, 4, 'female'], ['175/001/0/1', '175/001/1/1', '181/001/1/1', '181/002/0/1', '175/003/0/1']],
  [[1932, 4, 19, 2, 'female'], ['178/003/0/1', '178/006/0/1']],
  [[1932, 10, 19, 4, 'female'], ['175/001/0/0', '175/001/1/0', '181/001/0/0', '181/001/1/0', '181/002/0/0', '175/003/0/0']],
  [[1933, 1, 29, 2, 'female'], ['173/001/0/0', '173/002/0/0', '182/002/0/1', '172/005/0/0', '172/018/0/0']],
  [[1933, 2, 10, 3], ['172/002/0/1']],
  [[1933, 2, 10, 9], ['172/002/0/0']],
  [[1934, 4, 15, 2, 'female'], ['182/003/0/1']],
  [[1934, 5, 13, 10, 'female'], ['182/002/0/0', '183/001/0/0', '184/001/0/0', '184/001/2/0', '184/002/0/0', '184/002/1/0', '185/001/0/0', '187/003/0/0']],
  [[1936, 2, 19, 8, 'female'], ['184/002/1/1']],
  [[1937, 1, 2, 3], ['172/003/0/0']],
  [[1937, 1, 7, 2, 'female'], ['170/005/0/0']],
  [[1937, 1, 7, 5, 'female'], ['178/002/2/1', '175/002/0/1']],
  [[1937, 1, 15, 11, 'female'], ['172/018/0/1']],
  [[1937, 2, 11, 3, 'female'], ['187/002/1/0']],
  [[1937, 2, 17, 4, 'female'], ['176/002/0/1']],
  [[1937, 4, 11, 4, 'female'], ['181/003/1/1']],
  [[1937, 4, 11, 10, 'female'], ['182/003/0/0']],
  [[1937, 4, 16, 1], ['178/002/0/1', '178/002/1/1']],
  [[1937, 4, 21, 8, 'female'], ['181/001/0/1', '184/001/1/0', '185/001/1/0', '172/021/0/0']],
  [[1937, 5, 10, 8], ['186/001/0/0']],
  [[1937, 5, 13, 10, 'female'], ['186/002/0/0']],
  [[1937, 5, 21, 10, 'female'], ['172/008/0/0', '186/003/0/0']],
  [[1937, 6, 16, 7], ['172/015/0/0']],
  [[1937, 8, 6, 8], ['181/003/1/0']],
  [[1937, 10, 4, 7], ['172/016/0/0']],
  [[1937, 10, 5, 4, 'female'], ['176/002/0/0', '184/001/1/1']],
  [[1937, 10, 5, 5, 'female'], ['176/001/0/0', '175/002/0/0']],
  [[1937, 10, 5, 9, 'female'], ['172/003/1/0']],
  [[1937, 10, 11, 1, 'female'], ['178/002/2/0']],
  [[1937, 11, 3, 2, 'female'], ['184/001/2/1']],
  [[1938, 4, 1, 6, 'female'], ['178/003/0/0', '178/006/0/0']],
  [[1939, 2, 24, 5], ['172/012/0/0']],
  [[1939, 5, 7, 4, 'female'], ['170/001/0/0', '170/001/1/0', '170/002/0/0', '181/003/0/1', '184/001/0/1', '184/002/0/1', '187/001/0/0', '187/002/0/0', '187/003/1/0']],
  [[1940, 2, 15, 5, 'female'], ['173/002/1/0', '178/002/0/0', '178/002/1/0', '179/003/0/0', '181/003/0/0', '172/006/0/0', '173/004/0/0']],
  [[1940, 4, 11, 10, 'female'], ['182/003/1/0']],
];

function native([year, month, day, hour, gender = 'male']) {
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

test('all military, literary and auxiliary star groups reach SQLite and report materials', () => {
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
  assert.deepEqual([ids.size, whole, expected.size], [40, 8, 79]);
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
  assert.equal(witnesses.length, 35);
  assert.deepEqual(seen, expected);
});

test('Pojun mutations and the clean right aide require an actual birth-year carrier', () => {
  const poJun = idOf('173', '002'), valid = native([1933, 1, 28, 1]);
  const transformation = '化为权禄喜非常。';
  assert.ok(quotes(explain(poJun, valid)).includes(transformation));
  const withoutCarrier = valid.filter(f => f.kind !== 'star_mutagen' || f.star !== '破军');
  assert.ok(!quotes(explain(poJun, withoutCarrier)).includes(transformation));
  const fallen = native([1937, 2, 11, 11, 'female']);
  assert.ok(quotes(explain(poJun, fallen)).includes('若还陷地仍加杀'));

  const right = idOf('185', '001'), clean = native([1937, 1, 13, 2, 'female']);
  const favorable = '若无火忌羊陀会，加吉财官冠世英。';
  assert.ok(quotes(explain(right, clean)).includes(favorable));
  const missingJi = clean.filter(f => f.kind !== 'star_mutagen' || f.change !== '忌');
  assert.ok(!quotes(explain(right, missingJi)).includes(favorable));
});

test('companions must be witnessed and Kuai/Yue must actually occupy life and body', () => {
  const lunarPair = idOf('187', '001'), paired = native([1937, 4, 11, 5, 'female']);
  assert.ok(explain(lunarPair, paired).matched);
  assert.equal(explain(lunarPair, paired.filter(f => f.kind !== 'body_palace')).matched, false);
  assert.equal(explain(lunarPair, paired, false).matched, false);

  const qisha = idOf('170', '001'), five = native([1939, 5, 7, 4, 'female']);
  assert.ok(quotes(explain(qisha, five)).some(line => line.startsWith('魁钺左右文昌会')));
  const noLeft = five.filter(f => f.kind !== 'palace_star' || f.star !== '左辅');
  assert.deepEqual(quotes(explain(qisha, noLeft)), ['七杀寅申子午宫，四夷拱手服英雄。']);
});

test('the default natal engine supports neither same-seat Huo/Ling nor Huo in Wenqu’s sector', () => {
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  let checked = 0;
  for (let year = 1930; year < 1942; year++) {
    for (let hour = 0; hour < 12; hour++) {
      const facts = native([year, 7, 19, hour]);
      const at = star => facts.find(f => f.kind === 'palace_star' && f.star === star && f.scope === 'origin').palace;
      const branch = palace => facts.find(f => f.kind === 'palace_branch' && f.palace === palace).branch;
      assert.notEqual(at('火星'), at('铃星'));
      const distance = (12 + branches.indexOf(branch(at('火星'))) - branches.indexOf(branch(at('文曲')))) % 12;
      assert.ok(![0, 4, 6, 8].includes(distance));
      checked++;
    }
  }
  assert.equal(checked, 144);
  for (const id of [idOf('172', '010'), idOf('179', '001')]) {
    assert.ok(!catalog.get(id).inputs && !catalog.get(id).branches.length);
  }
});
