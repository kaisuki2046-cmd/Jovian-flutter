import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziDecadalPassageProfile } from './bazi-decadal-passages.mjs';
import { shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-wealth-transform-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'muxuan-v1-' + key + '-001';
const decade = 'bazi_decadal_range';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1960, 1, 1, 0], 'f007-p00067/0/0', 'f007-p00081/0/0'],
  [[1960, 1, 3, 0], 'f007-p00082/0/0', 'f008-p00058/5/0', 'f017-p00040/0/0'],
  [[1960, 1, 13, 18], 'f007-p00094/2/0'],
  [[1960, 1, 5, 0], 'f007-p00069/0/8', 'f007-p00072/0/2', 'f007-p00094/1/0', 'f011-p00050/0/2', 'f018-p00093/0/8'],
  [[1960, 1, 5, 18], 'f007-p00072/0/1', 'f011-p00050/0/1'],
  [[1960, 1, 6, 0], 'f007-p00069/0/9', 'f018-p00093/0/9'],
  [[1960, 1, 6, 10], 'f007-p00072/0/0', 'f011-p00050/0/0'],
  [[1960, 1, 11, 0], 'f007-p00069/0/4', 'f018-p00093/0/4'],
  [[1960, 1, 11, 12], 'f007-p00094/0/0'],
  [[1960, 1, 12, 0], 'f007-p00069/0/5', 'f018-p00093/0/5'],
  [[1960, 1, 12, 2], 'f006-p00076/0/0'],
  [[1960, 1, 12, 14], 'f011-p00051/0/0'],
  [[1960, 1, 13, 8], 'f007-p00069/0/6', 'f018-p00093/0/6'],
  [[1960, 1, 14, 4], 'f007-p00069/0/7', 'f018-p00093/0/7'],
  [[1960, 1, 19, 2], 'f011-p00052/0/0'],
  [[1960, 2, 6, 0], 'f007-p00069/0/0', 'f018-p00093/0/0'],
  [[1960, 2, 6, 2], 'f016-p00100/0/1'],
  [[1960, 2, 6, 18], 'f016-p00100/0/0'],
  [[1960, 2, 7, 4], 'f007-p00069/0/1', 'f018-p00093/0/1'],
  [[1960, 2, 8, 16], 'f007-p00069/0/2', 'f018-p00093/0/2'],
  [[1960, 2, 9, 12], 'f007-p00069/0/3', 'f018-p00093/0/3'],
  [[1960, 2, 11, 16], 'f011-p00053/0/0'],
  [[1960, 3, 17, 6], 'f015-p00061/0/0'],
  [[1960, 3, 17, 10], 'f016-p00100/0/2'],
  [[1960, 3, 28, 0], 'f015-p00061/1/0'],
  [[1960, 4, 6, 10], 'f016-p00060/0/0'],
  [[1960, 4, 9, 0], 'f008-p00058/2/0'],
  [[1960, 6, 25, 0], 'f008-p00058/0/0'],
  [[1960, 7, 15, 10], 'f016-p00060/0/3'],
  [[1960, 10, 13, 10], 'f016-p00060/0/1'],
  [[1960, 11, 9, 0], 'f008-p00058/6/0'],
  [[1961, 1, 11, 2], 'f016-p00060/0/2'],
  [[1961, 8, 14, 2], 'f008-p00058/4/0'],
  [[1961, 9, 12, 0], 'f008-p00058/3/0'],
  [[1961, 10, 14, 4], 'f006-p00082/0/2'],
  [[1961, 10, 15, 0], 'f006-p00082/0/5'],
  [[1962, 3, 15, 0], 'f008-p00058/7/0'],
  [[1962, 7, 27, 4], 'f008-p00058/1/0'],
  [[1962, 8, 10, 4], 'f006-p00082/0/0'],
  [[1962, 8, 11, 0], 'f006-p00082/0/3'],
  [[1962, 9, 9, 4], 'f006-p00082/0/1'],
  [[1962, 9, 10, 0], 'f006-p00082/0/4'],
];

function native([year, month, day, hour]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: '男' }];
}

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(key, [{ confirmedFacts, confirmedAbsentFacts, chartScope }]) {
  const context = chartContext('bazi', confirmedFacts, confirmedAbsentFacts, chartScope);
  return explainClaim(claimId(key), 'bazi', context, '神峰通考', catalog);
}

const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const periodsFor = (facts, { stems, branches }) => facts.filter(({ kind, ganZhi }) => kind === decade
  && (!stems || stems.includes(ganZhi[0])) && (!branches || branches.includes(ganZhi[1])));
const periodProof = ({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge];

test('native charts cover every new source alternative in SQLite and in the default report', () => {
  const records = new Set(witnesses.flatMap(([, ...cases]) => cases.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    const id = claimId(key);
    assert.equal(states.get(id), 'branch_indexed', key);
    catalog.get(id).branches.forEach((branch, index) => {
      branch.inputs.forEach((input, alternative) => expected.set(`${key}/${index}/${alternative}`, { branch, input }));
    });
  }
  const checked = new Set();
  for (const [birth, ...cases] of witnesses) {
    const facts = native(birth), parsed = query(facts), readings = hits(lookup(parsed));
    for (const key of cases) {
      const [record] = key.split('/');
      const hit = readings.find(row => row.id === claimId(record));
      const { branch: { text, decadalAnchor }, input } = expected.get(key);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explain(record, parsed).matchedBranches, key);
      const passage = hit.matchedBranches.find(branch => branch.text === text);
      assert.deepEqual(passage.matchedConditions.required, input.required, key);
      assert.equal(passage.conditionCompiler, decadalAnchor ? baziDecadalPassageProfile : shenfengReviewedProfile, key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /伯道老无儿|早登金紫|伤官见官必祸|万户封侯|行奸弄巧|反多富贵/u, key);
      if (decadalAnchor) {
        const periods = periodsFor(facts, decadalAnchor);
        assert.ok(periods.length, key);
        assert.deepEqual(passage.matchedConditions.decadalPeriods.map(periodProof), periods.map(periodProof), key);
        for (const { ganZhi, startAge, endAge } of periods) {
          assert.ok(materials.includes(`${startAge}至${endAge}虚岁${ganZhi}运限`), key);
        }
      }
      checked.add(key);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [18, 60, 42]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the Geng and Xin autumn examples require earth in several places and transformations need more than a pair', () => {
  const supported = native([1960, 4, 6, 10]);
  const untransformed = native([1960, 1, 7, 0]);
  const asserted = { kind: 'bazi_day_stem_transformation', stem: '甲', partner: '己', element: '土' };
  assert.ok(untransformed.some(fact => fact.kind === 'pillar' && fact.position === 'year' && fact.ganZhi === '己亥'));
  assert.ok(untransformed.some(fact => fact.kind === 'pillar' && fact.position === 'day' && fact.ganZhi === '甲午'));
  assert.equal(explain('f016-p00060', query(supported)).matched, true);
  assert.equal(explain('f016-p00060', query([...untransformed, asserted])).matched, false);
  assert.equal(explain('f016-p00060', query(supported, false)).matched, false);
  assert.equal(explain('f006-p00082', query(native([1962, 8, 10, 4]))).matched, true);
  assert.equal(explain('f006-p00082', query(native([1962, 8, 10, 0]))).matched, false);
});

test('a natal condition cannot stand in for the matching decade or its age range', () => {
  const blade = native([1960, 1, 11, 12]);
  const withoutClash = blade.filter(fact => fact.kind !== decade || fact.ganZhi[1] !== '子');
  assert.equal(explain('f007-p00094', query(blade)).matched, true);
  assert.equal(explain('f007-p00094', query(withoutClash)).matched, false);
  assert.equal(explain('f007-p00094', query(blade, false)).matched, false);
  assert.equal(explain('f007-p00094', query(native([1960, 1, 3, 18]))).matched, false);
  const wood = native([1960, 3, 17, 6]);
  const withoutVault = wood.filter(fact => fact.kind !== decade || fact.ganZhi[1] !== '丑');
  assert.equal(explain('f015-p00060', query(withoutVault)).matched, true);
  assert.equal(explain('f015-p00061', query(withoutVault)).matched, false);
  const falseAges = wood.map(fact => fact.kind === decade && fact.ganZhi[1] === '丑'
    ? { ...fact, startAge: fact.startAge + 1, endAge: fact.endAge + 1 } : fact);
  assert.equal(explain('f015-p00061', query(falseAges)).matched, false);
});
