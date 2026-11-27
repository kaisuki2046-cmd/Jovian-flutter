import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials, renderReportMaterials } from '../report-materials.mjs';
import { selectPromptMaterials } from '../report.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { compileShenfengReviewed, shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-decadal-source-age-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const natalWitnesses = [
  ['f011-p00090-001/0/0', [1798, 10, 13, 10]],
  ['f011-p00142-001/0/0', [1852, 11, 12, 4]],
  ['f011-p00142-001/0/1', [1854, 11, 12, 0]],
  ['f011-p00155-001/0/0', [1936, 8, 5, 22]],
  ['f011-p00223-001/0/0', [1798, 7, 13, 0]],
];

const decadalWitnesses = [
  ['f001-p00049-001/0/0', [1798, 5, 25, 0], [['庚申', 25, 34, 25, 29]]],
  ['f001-p00049-001/1/0', [1798, 2, 5, 0], [['丙辰', 20, 29, 20, 29]]],
  ['f001-p00049-001/2/0', [1798, 1, 17, 0], [['辛亥', 14, 23, 14, 23]]],
  ['f001-p00049-001/3/0', [1798, 1, 28, 0], [['辛亥', 18, 27, 18, 27]]],
  ['f001-p00049-001/4/0', [1798, 1, 9, 0], [['辛亥', 12, 21, 12, 21]]],
  ['f001-p00049-001/5/0', [1798, 6, 9, 0], [['己未', 10, 19, 10, 19]]],
  ['f001-p00049-001/6/0', [1798, 1, 1, 0], [['庚戌', 19, 28, 19, 28]]],
  ['f001-p00049-001/7/0', [1798, 2, 1, 0], [['庚戌', 29, 38, 29, 29]]],
  ['f001-p00049-001/8/0', [1798, 4, 13, 0], [['丁巳', 8, 17, 8, 17]]],
  ['f001-p00049-001/9/0', [1798, 2, 13, 0], [['丁巳', 27, 36, 27, 29]]],
  ['f004-p00034-001/0/0', [1790, 12, 3, 10, '女'], [['丙戌', 10, 19], ['丁丑', 100, 109]]],
  ['f004-p00034-001/1/0', [1800, 12, 11, 10, '女'], [['丙戌', 13, 22]]],
  ['f004-p00034-001/2/0', [1798, 1, 5, 10, '女'], [['丙辰', 30, 39], ['戊午', 50, 59]]],
  ['f004-p00034-001/3/0', [1857, 11, 13, 10, '女'], [['丙辰', 49, 58], ['戊午', 69, 78]]],
  ['f004-p00034-001/4/0', [1809, 12, 15, 10, '女'], [['丁丑', 9, 18], ['丙戌', 99, 108]]],
  ['f004-p00034-001/5/0', [1809, 1, 9, 0, '女'], [['戊午', 62, 71], ['丙辰', 82, 91]]],
  ['f004-p00041-001/0/0', [1864, 11, 7, 16, '女'], [['壬申', 21, 30]]],
  ['f004-p00041-001/1/0', [1832, 12, 15, 0, '女'], [['辛亥', 4, 13]]],
  ['f004-p00041-001/2/0', [1815, 1, 9, 0, '女'], [['壬申', 41, 50]]],
  ['f004-p00041-001/3/0', [1833, 11, 11, 0, '女'], [['癸酉', 100, 109]]],
  ['f004-p00041-001/4/0', [1833, 12, 11, 0, '女'], [['癸酉', 90, 99]]],
  ['f004-p00041-001/5/0', [1847, 2, 1, 0, '女'], [['庚子', 9, 18]]],
  ['f004-p00055-001/0/0', [1864, 12, 1, 6], [['己卯', 33, 42], ['庚辰', 43, 52]]],
  ['f004-p00055-001/1/0', [1800, 12, 17, 6], [['己丑', 8, 17], ['壬辰', 38, 47]]],
  ['f004-p00055-001/2/0', [1821, 1, 21, 6], [['壬辰', 25, 34], ['己亥', 95, 104]]],
  ['f004-p00055-001/3/0', [1843, 11, 13, 0], [['癸丑', 93, 102]]],
  ['f004-p00055-001/4/0', [1800, 12, 28, 0], [['己丑', 5, 14], ['壬辰', 35, 44]]],
  ['f004-p00055-001/5/0', [1809, 1, 25, 0], [['戊辰', 24, 33]]],
  ['f008-p00098-001/0/0', [1798, 1, 5, 8], [['己酉', 30, 39], ['戊申', 40, 49]]],
  ['f008-p00098-001/1/0', [1809, 11, 25, 0], [['己巳', 57, 66], ['戊辰', 67, 76]]],
  ['f008-p00098-001/2/0', [1798, 3, 28, 4], [['庚申', 43, 52], ['辛酉', 53, 62]]],
  ['f008-p00098-001/3/0', [1798, 2, 17, 0], [['庚申', 56, 65], ['辛酉', 66, 75]]],
  ['f008-p00098-001/4/0', [1798, 5, 9, 0], [['壬戌', 50, 59], ['癸亥', 60, 69]]],
  ['f008-p00098-001/5/0', [1798, 6, 9, 16], [['壬戌', 40, 49], ['癸亥', 50, 59]]],
  ['f008-p00098-001/6/0', [1798, 1, 21, 16], [['乙巳', 76, 85], ['甲辰', 86, 95]]],
  ['f008-p00098-001/7/0', [1798, 2, 1, 12], [['乙巳', 80, 89], ['甲辰', 90, 99]]],
  ['f008-p00098-001/8/0', [1798, 8, 21, 12], [['丙寅', 57, 66], ['丁卯', 67, 76]]],
  ['f008-p00098-001/9/0', [1798, 9, 1, 8], [['丙寅', 53, 62], ['丁卯', 63, 72]]],
  ['f009-p00048-001/0/0', [1818, 9, 28, 6, '女'], [['庚申', 8, 17]]],
  ['f009-p00048-001/1/0', [1798, 9, 13, 8, '女'], [['庚申', 3, 12]]],
  ['f009-p00048-001/2/0', [1864, 8, 9, 8, '女'], [['癸亥', 82, 91]]],
  ['f009-p00048-001/3/0', [1809, 1, 1, 0, '女'], [['癸亥', 9, 18]]],
  ['f009-p00048-001/4/0', [1798, 12, 25, 4, '女'], [['乙卯', 87, 96], ['甲寅', 97, 106]]],
  ['f009-p00048-001/5/0', [1798, 3, 21, 0, '女'], [['甲寅', 6, 15]]],
  ['f009-p00048-001/6/0', [1847, 5, 25, 0, '女'], [['丙午', 5, 14]]],
  ['f009-p00048-001/7/0', [1847, 6, 5, 4, '女'], [['丙午', 1, 10]]],
  ['f009-p00048-001/8/0', [1798, 1, 13, 2, '女'], [['戊午', 48, 57]]],
  ['f009-p00048-001/9/0', [1798, 7, 13, 0, '女'], [['戊午', 3, 12]]],
  ['f018-p00081-001/0/0', [1798, 11, 21, 6], [['丁卯', 37, 46]]],
  ['f018-p00081-001/1/0', [1798, 3, 28, 4], [['戊午', 23, 32]]],
  ['f018-p00081-001/2/0', [1798, 1, 9, 12], [['丙午', 62, 71]]],
  ['f018-p00081-001/3/0', [1821, 1, 21, 18], [['丁酉', 75, 84]]],
  ['f018-p00081-001/4/0', [1800, 4, 13, 0], [['戊子', 78, 87]]],
  ['f020-p00096-001/0/0', [1818, 9, 28, 12, '女'], [['庚申', 8, 17]]],
  ['f020-p00096-001/1/0', [1798, 9, 13, 8, '女'], [['庚申', 3, 12]]],
  ['f020-p00096-001/2/0', [1864, 8, 9, 8, '女'], [['癸亥', 82, 91]]],
  ['f020-p00096-001/3/0', [1864, 9, 9, 6, '女'], [['癸亥', 92, 101]]],
  ['f020-p00096-001/4/0', [1798, 12, 25, 4, '女'], [['乙卯', 87, 96], ['甲寅', 97, 106]]],
  ['f020-p00096-001/5/0', [1798, 3, 21, 0, '女'], [['甲寅', 6, 15]]],
  ['f020-p00096-001/6/0', [1847, 5, 25, 0, '女'], [['丙午', 5, 14]]],
  ['f020-p00096-001/7/0', [1847, 6, 5, 4, '女'], [['丙午', 1, 10]]],
  ['f020-p00096-001/8/0', [1798, 1, 13, 2, '女'], [['戊午', 48, 57]]],
  ['f020-p00096-001/9/0', [1798, 7, 13, 0, '女'], [['戊午', 3, 12]]],
];

const claimId = suffix => 'muxuan-v1-' + suffix;
function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function query(confirmedFacts, { timeKnown = true, chartScope = 'natal' } = {}) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts, chartScope,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('bazi', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const hits = queries => lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (id, facts, options) => explainClaim(id, 'bazi', query(facts, options).context, undefined, catalog);
const periodProof = ({ ganZhi, startAge, endAge, applicableAgeRange }) =>
  applicableAgeRange ? [ganZhi, startAge, endAge, applicableAgeRange.startAge, applicableAgeRange.endAge]
    : [ganZhi, startAge, endAge];

test('Reviewed decadal and natal passages reach SQLite and reports from native chart evidence', () => {
  const expected = new Map();
  const statuses = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const natalIds = new Set(natalWitnesses.map(([key]) => key.split('/')[0]));
  const temporalIds = new Set(decadalWitnesses.map(([key]) => key.split('/')[0]));
  const verified = new Set();
  const chartCache = new Map();

  for (const suffix of [...natalIds, ...temporalIds]) {
    const id = claimId(suffix);
    assert.equal(statuses.get(id), 'branch_indexed', id);
    const entry = catalog.get(id);
    const temporal = temporalIds.has(suffix);
    for (const [index, { text, inputs, conditionCompiler }] of entry.branches.entries()) {
      assert.equal(conditionCompiler, temporal ? baziDecadalPassageProfile : shenfengReviewedProfile, id);
      inputs.forEach((input, group) => expected.set(`${suffix}/${index}/${group}`, { text, input }));
    }
    const edited = structuredClone(entry.claim);
    edited.evidence.context += '异本';
    assert.equal((temporal ? compileBaZiDecadalPassage : compileShenfengReviewed)(edited).reason,
      'source_review_required', id);
  }

  for (const [key, birth, periods] of [...natalWitnesses, ...decadalWitnesses]) {
    const id = claimId(key.split('/')[0]);
    const birthKey = JSON.stringify(birth);
    if (!chartCache.has(birthKey)) {
      const { queries, context } = query(natalFacts(birth));
      chartCache.set(birthKey, { chart: claimChartContext('bazi', context), context, findings: hits(queries) });
    }
    const { chart, context, findings } = chartCache.get(birthKey);
    const { text, input } = expected.get(key);
    assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
    const hit = findings.find(row => row.id === id);
    assert.ok(hit, key);
    assert.deepEqual(hit.matchedBranches, explainClaim(id, 'bazi', context, undefined, catalog).matchedBranches, key);
    const [matched] = hit.matchedBranches;
    assert.equal(hit.matchedBranches.length, 1, key);
    assert.equal(matched.text, text, key);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(text), key);
    assert.doesNotMatch(materials, /祖业破败|刑冲见阎王|入黄泉|一世贫|克子夫淫贱|更超群|中年发达/u, key);
    if (periods) {
      assert.deepEqual(matched.matchedConditions.decadalPeriods.map(periodProof), periods, key);
      for (const [stemBranch, from, to, appliedStart = from, appliedEnd = to] of periods) {
        const age = appliedStart === appliedEnd ? appliedStart : `${appliedStart}至${appliedEnd}`;
        assert.ok(materials.includes(`${age}虚岁${stemBranch}运限`), key);
      }
    }
    verified.add(key);
  }

  assert.deepEqual(verified, new Set(expected.keys()));
  assert.deepEqual([natalIds.size, temporalIds.size, expected.size, chartCache.size],
    [4, 8, 68, 59]);
  for (const suffix of ['f006-p00095-001', 'f008-p00074-001', 'f008-p00082-001']) {
    assert.equal(statuses.get(claimId(suffix)), 'unmapped', suffix);
  }
});

test('An age limit clips the reported evidence and preserves the original ten-year period', () => {
  const id = claimId('f001-p00049-001');
  const facts = natalFacts([1798, 5, 25, 0]);
  const found = hits(query(facts).queries).find(row => row.id === id);
  assert.ok(found);
  assert.deepEqual(found.matchedBranches[0].matchedConditions.decadalPeriods.map(periodProof),
    [['庚申', 25, 34, 25, 29]]);
  const materials = buildReportMaterials([{ topic: found.topic, personality: [], events: [found] }]);
  assert.match(materials, /适用25至29虚岁庚申运限/u);
  assert.doesNotMatch(materials, /25至34虚岁/u);
  const prompt = renderReportMaterials(selectPromptMaterials([{ topic: found.topic, personality: [], events: [found] }]));
  assert.match(prompt, /原文：怕衰、绝运/u);
  assert.match(prompt, /命中条件：日柱天干为甲/u);
  assert.match(prompt, /原条目适用范围：仅适用于所匹配的大运阶段/u);
  assert.doesNotMatch(prompt, /祖业破败|庚申|25至29|使用边界/u);
  const later = natalFacts([1798, 1, 1, 0]);
  assert.ok(later.some(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi[1] === '寅' && fact.startAge >= 30));
  assert.equal(explain(id, later.filter(fact => fact.kind !== 'bazi_decadal_range' || fact.startAge >= 30)).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'bazi_decadal_range')).matched, false);
  const wrongAge = facts.map(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi === '庚申'
    ? { ...fact, startAge: 26, endAge: 35 } : fact);
  assert.equal(explain(id, wrongAge).matched, false);
  assert.equal(explain(id, facts, { timeKnown: false }).matched, false);
  assert.equal(explain(id, facts, { chartScope: 'annual' }).matched, false);
});

test('Two cataloged passages with the same officer-luck excerpt appear once in report materials', () => {
  const evidence = natalFacts([1798, 3, 21, 0, '女']);
  const ids = new Set(['f009-p00048-001', 'f020-p00096-001'].map(claimId));
  const eligible = hits(query(evidence).queries).filter(row => ids.has(row.id));
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(hit => hit.matchedBranches[0].matchedConditions.decadalPeriods.map(periodProof)),
    [[['甲寅', 6, 15]], [['甲寅', 6, 15]]]);
  const reports = eligible.map(hit => ({ topic: hit.topic, personality: [], events: [hit] }));
  const materials = buildReportMaterials(reports);
  assert.equal([...materials.matchAll(/原文\/依据：运入官杀旺地/gu)].length, 1);
});
