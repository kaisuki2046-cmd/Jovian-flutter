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
import { defaultZiweiMutagens } from './ziwei-mutagen-placement.mjs';
import { ziweiMajorLayout } from './ziwei-relative-profile.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-star-chapters-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => `ziwei-v4-jielan-${chapter}-p001-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1937, 1, 2, 1], ['159/001/0/0', '159/009/0/0', '159/012/0/0', '159/016/0/0', '166/015/0/0']],
  [[1937, 1, 2, 2], ['157/004/0/0']],
  [[1937, 1, 2, 3], ['165/001/1/1']],
  [[1937, 1, 2, 6], ['165/001/1/0']],
  [[1937, 1, 2, 8], ['159/005/1/0']],
  [[1937, 1, 2, 9], ['166/015/0/1']],
  [[1937, 1, 2, 10], ['157/004/0/1', '167/003/0/0']],
  [[1937, 1, 2, 11], ['159/002/0/0', '160/004/0/0']],
  [[1937, 1, 3, 1, 'female'], ['162/001/0/0', '163/004/0/0']],
  [[1937, 1, 3, 2, 'female'], ['159/014/0/0']],
  [[1937, 1, 4, 2], ['166/003/0/0', '167/001/0/0', '167/002/0/0']],
  [[1937, 1, 4, 5], ['165/001/0/1']],
  [[1937, 1, 4, 9], ['165/001/0/0', '167/002/1/0']],
  [[1937, 1, 5, 0, 'female'], ['159/020/0/1', '164/002/0/0', '164/002/0/1']],
  [[1937, 1, 6, 1], ['159/020/0/0']],
  [[1937, 1, 6, 8], ['157/003/0/0']],
  [[1937, 1, 8, 3], ['163/005/0/0']],
  [[1937, 1, 10, 2], ['159/022/0/0']],
  [[1937, 1, 12, 0], ['163/001/0/0']],
  [[1937, 1, 13, 6, 'female'], ['159/007/0/0', '160/002/0/0']],
  [[1937, 1, 19, 10, 'female'], ['166/012/0/0']],
  [[1937, 1, 25, 2, 'female'], ['163/003/0/0']],
  [[1937, 4, 11, 9, 'female'], ['164/002/1/0']],
  [[1937, 4, 18, 2], ['157/002/0/0']],
  [[1937, 4, 20, 2], ['164/004/0/0']],
  [[1937, 4, 24, 2], ['166/005/0/0', '167/004/0/0']],
  [[1937, 4, 26, 8], ['157/002/1/0']],
  [[1937, 5, 7, 2, 'female'], ['166/013/0/0']],
  [[1938, 1, 7, 9, 'female'], ['159/007/1/0']],
  [[1938, 2, 8, 7], ['166/002/0/0']],
  [[1938, 3, 6, 9], ['163/002/0/0']],
  [[1938, 3, 6, 11], ['159/008/0/0']],
  [[1939, 2, 22, 2], ['159/005/0/0']],
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

test('all new star chapter groups reach SQLite and contribute only the matching passages', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
  const inventory = new Map(catalog.inventory().map(({claim, lookup: state}) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();
  let whole = 0;
  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    passages(row).forEach(({inputs}, passage) => {
      inputs.forEach((_, group) => expected.add([key, passage, group].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [35, 14, 47]);
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
  assert.equal(witnesses.length, 33);
  assert.deepEqual(seen, expected);
});

test('closed absence and exception conditions keep alternative reports separate', () => {
  const estate = idOf('159', '005'), quiet = native([1939, 2, 22, 2]);
  assert.deepEqual(quotes(explain(estate, quiet)), ['在田宅，破荡祖业，先富后贫']);
  const incomplete = quiet.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '田宅');
  assert.equal(explain(estate, incomplete).matched, false);
  assert.deepEqual(quotes(explain(estate, native([1937, 1, 2, 8]))), ['逢吉有分']);

  const tianxiang = idOf('164', '002'), opposition = native([1937, 4, 11, 9, 'female']);
  assert.deepEqual(quotes(explain(tianxiang, opposition)), ['若昌曲冲破']);
  const unspecifiedGender = opposition.filter(f => f.kind !== 'natal_gender');
  assert.equal(explain(tianxiang, unspecifiedGender).matched, false);
});

test('an aspect to the body palace needs birth-time confirmation', () => {
  const tianxiang = idOf('165', '001'), body = native([1937, 1, 4, 5]);
  const againstBody = '照人身命喜无垠。';
  assert.ok(quotes(explain(tianxiang, body)).includes(againstBody));
  assert.ok(!quotes(explain(tianxiang, body.filter(f => f.kind !== 'body_palace'))).includes(againstBody));
  assert.equal(explain(tianxiang, body, false).matched, false);
});

test('the Zi-Wu verse does not borrow an impossible triple auspicious transformation', () => {
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  let checked = 0;
  for (const branch of branches) {
    const layout = ziweiMajorLayout(branch);
    if (!'子午'.includes(layout.巨门)) continue;
    const anchor = branches.indexOf(layout.巨门);
    const trines = [branches[(anchor + 4) % 12], branches[(anchor + 8) % 12]];
    for (const carriers of defaultZiweiMutagens) {
      assert.ok(carriers.slice(0, 3).some(star => layout[star] && !trines.includes(layout[star])));
      checked++;
    }
  }
  assert.equal(checked, 20);
  const first = explain(idOf('163', '001'), native([1937, 1, 12, 0]));
  assert.deepEqual(quotes(first), ['巨门子午二宫逢，局中得遇以为荣。']);
  for (const id of [idOf('154', '001'), idOf('159', '011'), idOf('162', '007')]) {
    assert.ok(!catalog.get(id).inputs && !catalog.get(id).branches.length);
  }
});
