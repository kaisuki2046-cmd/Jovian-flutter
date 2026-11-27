import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-decadal-passages-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  ['v2-c230-p005-701', '丙', [1869, 4, 5, 0, '男'], [['辛酉', 61, 70], ['庚申', 71, 80]]],
  ['v2-c230-p005-701', '丁', [1869, 2, 5, 0, '男'], [['辛酉', 41, 50], ['庚申', 51, 60]]],
  ['v2-c230-p005-701', '庚', [1822, 10, 13, 4, '男'], [['甲寅', 40, 49], ['乙卯', 50, 59]]],
  ['v2-c230-p005-701', '癸', [1833, 8, 9, 0, '男'], [['丁巳', 21, 30]]],
  ['v2-c230-p005-701', '己', [1833, 5, 17, 4, '男'], [['壬子', 45, 54]]],
  ['v2-c230-p005-701', '甲', [1833, 11, 28, 0, '男'], [['己未', 38, 47]]],
  ['v2-c230-p005-701', '壬', [1833, 8, 28, 0, '男'], [['丁巳', 28, 37]]],
  ['v2-c230-p005-701', '戊', [1822, 6, 13, 0, '男'], [['壬子', 59, 68]]],
  ['v2-c230-p005-701', '辛', [1822, 4, 17, 0, '男'], [['甲寅', 97, 106]]],
  ['v2-c230-p005-701', '乙', [1822, 12, 17, 0, '男'], [['己未', 68, 77]]],
  ['v3-c099-p002-701', '辛', [1918, 6, 13, 20, '男'], [['癸亥', 49, 58]]],
  ['v3-c099-p002-702', '丙', [1810, 1, 5, 0, '男'], [['己巳', 70, 79]]],
  ['v3-c099-p002-702', '癸', [1822, 4, 9, 0, '男'], [['甲寅', 100, 109]]],
  ['v3-c099-p002-702', '甲', [1847, 9, 16, 4, '女'], [['丁巳', 79, 88]]],
  ['v3-c099-p002-702', '壬', [1822, 7, 17, 4, '男'], [['乙卯', 78, 87]]],
  ['v3-c099-p002-703', '庚', [1872, 3, 14, 18, '男'], [['己酉', 58, 67]]],
  ['v3-c099-p002-703', '戊', [1873, 10, 3, 12, '男'], [['戊午', 30, 39]]],
  ['v4-c002-p010-701', '丙', [1822, 11, 28, 0, '男'], [['辛酉', 95, 104]]],
  ['v4-c002-p010-701', '庚', [1822, 6, 5, 0, '男'], [['乙卯', 91, 100]]],
  ['v4-c002-p010-701', '甲', [1810, 4, 13, 0, '男'], [['己丑', 89, 98]]],
  ['v4-c002-p010-701', '壬', [1822, 7, 17, 0, '男'], [['丁巳', 99, 108]]],
  ['v4-c002-p010-701', '戊', [1869, 3, 28, 0, '男'], [['癸亥', 38, 47]]],
];

function natalFacts([year, month, day, hour, gender]) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function query(confirmedFacts, { timeKnown = true, chartScope = 'natal' } = {}) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts, chartScope,
  }], { timeKnown });
  assert.ok(queries);
  return queries;
}

const findings = queries => lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (id, facts) => explainClaim('yhzp-' + id, 'bazi', chartContext('bazi', facts), undefined, catalog);

test('Yuanhai birth and luck evidence reaches SQLite with the original age ranges', () => {
  const status = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const ids = new Set(witnesses.map(([id]) => id));
  const expected = new Set();
  const verified = new Set();
  for (const id of ids) {
    const row = catalog.get('yhzp-' + id);
    assert.equal(status.get(row.claim.id), 'branch_indexed', id);
    for (const { inputs, decadalAnchor, conditionCompiler } of row.branches) {
      assert.equal(conditionCompiler, baziDecadalPassageProfile, id);
      assert.equal(decadalAnchor.kind, 'bazi_decadal_range', id);
      for (const { required } of inputs) {
        const day = required.find(fact => fact.kind === 'stem' && fact.position === 'day');
        expected.add(id + '/' + day.stem);
      }
    }
    const edited = structuredClone(row.claim);
    edited.evidence.context += '異本';
    assert.equal(compileBaZiDecadalPassage(edited).reason, 'source_review_required', id);
  }
  for (const [id, day, birth, periods] of witnesses) {
    const facts = natalFacts(birth);
    const detail = explain(id, facts);
    const hit = findings(query(facts)).find(item => item.id === 'yhzp-' + id);
    assert.ok(hit, id);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, id);
    assert.equal(hit.matchedBranches.length, 1, id);
    const [{ text, matchedConditions }] = hit.matchedBranches;
    assert.deepEqual(matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) =>
      [ganZhi, startAge, endAge]), periods, id);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(text), id);
    for (const [pillar, from, to] of periods) {
      assert.ok(materials.includes(`${from}至${to}虚岁${pillar}运限`), id);
    }
    assert.doesNotMatch(materials, /喪妻尅子|剝職生災|進用朝廷|男兒早娶|財傾福敗|夭其壽/u, id);
    verified.add(id + '/' + day);
  }
  assert.deepEqual([ids.size, expected.size, witnesses.length], [5, 22, 22]);
  assert.deepEqual(verified, expected);
  assert.equal(status.has('yhzp-v4-c053-p004-701'), false);
});

test('Missing births, conflicting ranges and annual-only queries do not match decadal passages', () => {
  for (const id of new Set(witnesses.map(([claim]) => claim))) {
    const [, , birth, periods] = witnesses.find(([claim]) => claim === id);
    const facts = natalFacts(birth);
    const qualifying = new Set(periods.map(([pillar]) => pillar));
    const wrongRange = facts.map(fact => fact.kind === 'bazi_decadal_range' && qualifying.has(fact.ganZhi)
      ? { ...fact, startAge: fact.startAge + 1, endAge: fact.endAge + 1 } : fact);
    const missingRange = facts.filter(fact => fact.kind !== 'bazi_decadal_range' || !qualifying.has(fact.ganZhi));
    assert.equal(explain(id, wrongRange).matched, false, id);
    assert.equal(explain(id, missingRange).matched, false, id);
    for (const options of [{ timeKnown: false }, { chartScope: 'annual' }]) {
      assert.ok(!findings(query(facts, options)).some(hit => hit.id === 'yhzp-' + id), id);
    }
  }
});
