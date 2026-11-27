import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziDecadalPassageProfile } from './bazi-decadal-passages.mjs';
import { shenfengRepeatedPassages, shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-officer-output-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const source = '神峰通考';
const claimId = key => 'muxuan-v1-' + key + '-001';
const periodKind = 'bazi_decadal_range';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1960, 1, 1, 6, "男"], "f020-p00046/0/0", "f020-p00066/1/0"],
  [[1960, 1, 2, 2, "男"], "f020-p00066/0/0"],
  [[1960, 1, 3, 0, "男"], "f015-p00100/0/0", "f015-p00113/0/0", "f015-p00136/0/0"],
  [[1960, 1, 3, 0, "女"], "f015-p00106/0/0", "f015-p00137/0/0"],
  [[1960, 1, 3, 16, "女"], "f015-p00114/0/0", "f015-p00137/1/0"],
  [[1960, 1, 5, 16, "男"], "f018-p00072/0/0"],
  [[1960, 1, 6, 0, "男"], "f018-p00118/0/0"],
  [[1960, 1, 13, 2, "男"], "f019-p00059/0/0", "f019-p00104/6/0"],
  [[1960, 1, 14, 4, "男"], "f019-p00104/7/0"],
  [[1960, 2, 6, 4, "男"], "f015-p00063/0/0"],
  [[1960, 2, 8, 8, "男"], "f015-p00092/0/1"],
  [[1960, 2, 16, 6, "男"], "f020-p00067/0/0"],
  [[1960, 2, 18, 8, "男"], "f015-p00092/0/0"],
  [[1960, 3, 17, 6, "男"], "f015-p00060/0/0"],
  [[1960, 3, 25, 6, "男"], "f015-p00117/0/0"],
  [[1960, 5, 17, 0, "男"], "f020-p00044/0/2"],
  [[1960, 8, 12, 2, "男"], "f019-p00104/8/0"],
  [[1960, 8, 13, 2, "男"], "f019-p00104/9/0"],
  [[1960, 11, 12, 2, "男"], "f019-p00104/0/0"],
  [[1960, 11, 13, 0, "男"], "f019-p00104/1/0"],
  [[1960, 12, 14, 0, "男"], "f020-p00044/0/3"],
  [[1961, 8, 20, 2, "男"], "f020-p00044/0/1"],
  [[1961, 9, 18, 2, "男"], "f020-p00044/0/0"],
  [[1962, 2, 7, 4, "男"], "f019-p00104/2/0"],
  [[1962, 2, 8, 4, "男"], "f019-p00104/3/0"],
  [[1962, 5, 10, 4, "男"], "f019-p00104/4/0"],
  [[1962, 5, 11, 4, "男"], "f019-p00104/5/0"],
  [[1963, 11, 20, 2, "男"], "f020-p00044/0/4"],
];

function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const natal = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '男' ? 'male' : 'female');
  return [...chartFacts.bazi(natal), { kind: 'natal_gender', gender }];
}

function queries(facts, timeKnown = true) {
  const value = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: facts,
  }], { timeKnown });
  assert.ok(value);
  return value;
}

function explain(key, [{ confirmedFacts, confirmedAbsentFacts, chartScope }]) {
  return explainClaim(claimId(key), 'bazi', chartContext('bazi', confirmedFacts, confirmedAbsentFacts, chartScope), source, catalog);
}

const readings = groups => groups.flatMap(group => [...group.events, ...group.personality]);
const periodFacts = ({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge];

test('each reviewed placement and luck condition reaches SQLite, the default lookup and report materials', () => {
  const keys = new Set(witnesses.flatMap(([, ...conditions]) => conditions.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of keys) {
    const id = claimId(key);
    assert.equal(states.get(id), 'branch_indexed', key);
    catalog.get(id).branches.forEach((branch, index) => {
      branch.inputs.forEach(({ required }, alternative) => {
        expected.set(`${key}/${index}/${alternative}`, { ...branch, required });
      });
    });
  }
  const checked = new Set();
  for (const [birth, ...conditions] of witnesses) {
    const native = natalFacts(birth);
    const parsed = queries(native);
    const hits = readings(lookup(parsed));
    for (const condition of conditions) {
      const [key] = condition.split('/'), id = claimId(key);
      const { text, required, decadalAnchor, conditionCompiler } = expected.get(condition);
      const hit = hits.find(item => item.id === id);
      assert.ok(hit, condition);
      assert.deepEqual(hit.matchedBranches, explain(key, parsed).matchedBranches, condition);
      const branch = hit.matchedBranches.find(branch => branch.text === text);
      assert.deepEqual(branch?.matchedConditions.required, required, condition);
      assert.equal(conditionCompiler, decadalAnchor ? baziDecadalPassageProfile : shenfengReviewedProfile);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), condition);
      assert.doesNotMatch(materials, /多无祖屋|反为贞洁|多荣显|早登金紫|夫荣子贵|以杀论|宜刑夫/u);
      if (decadalAnchor) {
        const { stems, branches } = decadalAnchor;
        const periods = native.filter(({ kind, ganZhi }) => kind === periodKind
          && (!stems || stems.includes(ganZhi[0])) && (!branches || branches.includes(ganZhi[1])));
        assert.ok(periods.length, condition);
        assert.deepEqual(branch.matchedConditions.decadalPeriods.map(periodFacts), periods.map(periodFacts), condition);
        for (const { ganZhi, startAge, endAge } of periods) {
          assert.ok(materials.includes(`${startAge}至${endAge}虚岁${ganZhi}运限`), condition);
        }
      }
      checked.add(condition);
    }
  }
  assert.deepEqual([keys.size, expected.size, witnesses.length], [18, 34, 28]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('month officer, hour officer and gender require the circumstances named by the passages', () => {
  const forged = { kind: 'bazi_natal_configuration', name: '月令见正官且四支无冲刑破害' };
  assert.equal(explain('f020-p00044', queries([...natalFacts([1960, 9, 13, 0]), forged])).matched, false);
  assert.equal(explain('f020-p00046', queries(natalFacts([1960, 1, 1, 8]))).matched, false);
  assert.equal(explain('f020-p00046', queries(natalFacts([1960, 1, 1, 6]), false)).matched, false);
  assert.equal(explain('f015-p00106', queries(natalFacts([1960, 1, 3, 0, '男']))).matched, false);
  assert.equal(explain('f015-p00113', queries(natalFacts([1960, 1, 3, 0, '女']))).matched, false);
});

test('a natal configuration does not supply missing or inconsistent luck periods', () => {
  const native = natalFacts([1960, 3, 17, 6]);
  const isSouthernPeriod = fact => fact.kind === periodKind && '巳午'.includes(fact.ganZhi[1]);
  const missing = native.filter(fact => !isSouthernPeriod(fact));
  assert.equal(explain('f015-p00063', queries(missing)).matched, true);
  assert.equal(explain('f015-p00060', queries(missing)).matched, false);
  const wrongAge = native.map(fact => isSouthernPeriod(fact)
    ? { ...fact, startAge: fact.startAge + 1, endAge: fact.endAge + 1 } : fact);
  assert.equal(explain('f015-p00060', queries(wrongAge)).matched, false);
  assert.equal(explain('f015-p00060', queries(native, false)).matched, false);
});

test('duplicate source IDs remain searchable but identical officer evidence is cited once', () => {
  const query = queries(natalFacts([1960, 1, 2, 2]));
  const alias = claimId('f020-p00066');
  const original = shenfengRepeatedPassages.get(alias).id;
  const hits = readings(lookup(query)).filter(({ id }) => [alias, original].includes(id));
  assert.deepEqual(new Set(hits.map(hit => hit.id)), new Set([alias, original]));
  const materials = buildReportMaterials([{ topic: hits[0].topic, personality: [], events: hits }]);
  assert.equal((materials.match(/原文\/依据：露杀藏官/gu) ?? []).length, 1);
});
