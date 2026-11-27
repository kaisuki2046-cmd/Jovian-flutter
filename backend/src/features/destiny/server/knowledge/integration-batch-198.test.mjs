import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-198-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => rmSync(directory, { recursive: true, force: true }));

const periodKind = 'bazi_decadal_range';
const sourceId = number => `muxuan-v1-f011-p00${number}-001`;
const yinJia = ['1920-02-06T04:20:00Z', ['庚申', '戊寅', '甲午', '庚午']];
const youYi = ['1901-09-13T16:20:00Z', ['辛丑', '丁酉', '乙未', '丙子']];
const chenJi = ['1902-04-06T10:20:00Z', ['壬寅', '甲辰', '己未', '癸酉']];
const wuBing = ['1902-06-12T14:20:00Z', ['壬寅', '丙午', '丙寅', '己亥']];

function native([birthTime, pillars], gender = '男') {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3_600_000, gender === '男' ? 'male' : 'female');
  assert.deepEqual([chart.year, chart.month, chart.day, chart.hour], pillars);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function inspect(number, confirmedFacts) {
  const id = sourceId(number);
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts }], { timeKnown: true });
  assert.ok(queries);
  const [query] = queries;
  const detail = explainClaim(id, 'bazi',
    chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope), undefined, catalog);
  const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(row => row.id === id);
  assert.equal(Boolean(hit), detail.matched, id);
  return { detail, hit };
}

function matched(number, facts, text) {
  const { detail, hit } = inspect(number, facts);
  assert.ok(hit);
  assert.equal(detail.matchedBranches.length, 1);
  assert.deepEqual(hit.matchedBranches, detail.matchedBranches);
  const [branch] = hit.matchedBranches;
  const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
  assert.equal(branch.text, text);
  assert.ok(materials.includes(text));
  assert.ok(!materials.includes(hit.claim.evidence.original_text));
  return { branch, materials };
}

function periodRanges(branch) {
  return branch.matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge]);
}

test('Jia facing plentiful wealth and vigorous killing needs both forward luck and a fire branch', () => {
  const facts = native(yinJia);
  const { branch, materials } = matched('065', facts, '顺行火地难显');
  assert.deepEqual(periodRanges(branch), [['辛巳', 30, 39], ['壬午', 40, 49]]);
  assert.ok(materials.includes('30至39虚岁辛巳运限'));
  const reverse = native(yinJia, '女');
  assert.ok(reverse.some(fact => fact.kind === periodKind && '巳午'.includes(fact.ganZhi[1])));
  assert.equal(inspect('065', reverse).detail.matched, false);
  assert.equal(inspect('065', facts.filter(fact => fact.kind !== periodKind)).detail.matched, false);
});

test('Yi in You with strong killing and southern luck still requires an actual Yi root', () => {
  const { branch } = matched('089', native(youYi), '大运功名佐庙廊');
  assert.deepEqual(periodRanges(branch), [['甲午', 23, 32], ['癸巳', 33, 42]]);
  const withoutRoot = native(['1901-09-23T16:20:00Z', ['辛丑', '丁酉', '乙巳', '丙子']]);
  assert.ok(withoutRoot.some(fact => fact.kind === periodKind && fact.ganZhi === '甲午'));
  assert.equal(inspect('089', withoutRoot).detail.matched, false);
});

test('Ji with configured wealth and officer passes only with a verified forward sequence', () => {
  const facts = native(chenJi);
  const { branch } = matched('152', facts, '喜顺行');
  assert.deepEqual(periodRanges(branch), facts.filter(fact => fact.kind === periodKind)
    .map(({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge]));
  assert.equal(inspect('152', native(chenJi, '女')).detail.matched, false);
  assert.equal(inspect('152', facts.filter(fact => fact.kind !== periodKind)).detail.matched, false);
});

test('Bing in Wu quotes the natal clause with exposed Ji and rooted Ren without requiring luck', () => {
  const facts = native(wuBing).filter(fact => fact.kind !== periodKind);
  const { branch, materials } = matched('103', facts, '有杀当为贵命看');
  assert.equal(branch.matchedConditions.decadalPeriods, undefined);
  assert.ok(!materials.includes('运限'));
  const hiddenOnly = native(['1902-06-12T08:20:00Z', ['壬寅', '丙午', '丙寅', '丙申']]);
  assert.equal(inspect('103', hiddenOnly).detail.matched, false);
});
