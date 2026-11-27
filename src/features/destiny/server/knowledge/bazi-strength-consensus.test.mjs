import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateBaZi, chartFacts } from '../../control/charts.ts';
import { analyzeBaZi } from '../../control/bazi-analysis.ts';
import { baziDayMasterStrengthConsensus } from './bazi-claim-facts.mjs';
import { claimChartContext } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { chartVersions } from './catalog.mjs';

test('unknown-time strength agrees with all twelve real engine hour pillars; disagreement remains unknown', () => {
  let stable = false, variable = false;
  for (let month = 1; month <= 12; month++) {
    const charts = Array.from({ length: 12 }, (_, index) => {
      const wall = Date.UTC(1990, month - 1, 15, index * 2);
      return calculateBaZi(wall - 8 * 3600000, wall);
    });
    const known = chartFacts.bazi(charts[0]).filter(fact => fact.kind === 'pillar' && fact.position !== 'hour');
    assert.ok(charts.every(chart => known.every(fact => chart[fact.position] === fact.ganZhi)));
    const results = new Set(charts.map(chart => analyzeBaZi(chart).L2.assessments.dayMasterStrength.result));
    const expected = results.size === 1 ? [{ kind: 'day_master_strength', result: [...results][0], profile: 'monthly-weighted-strength-v1' }] : [];
    assert.deepEqual(baziDayMasterStrengthConsensus(known), expected, 'month ' + month);
    const forged = { kind: 'day_master_strength', result: [...results][0] === '偏强' ? '偏弱' : '偏强', profile: 'monthly-weighted-strength-v1' };
    const context = claimChartContext('bazi', chartContext('bazi', [...known, forged]));
    assert.deepEqual(context.present.filter(fact => fact.kind === 'day_master_strength'), expected);
    const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
      confirmedFacts: [...chartFacts.bazi(charts[0]), forged] }], { timeKnown: false });
    assert.ok(parsed);
    assert.ok(parsed[0].confirmedFacts.every(fact => fact.position !== 'hour'));
    assert.deepEqual(parsed[0].confirmedFacts.filter(fact => fact.kind === 'day_master_strength'), expected,
      'the model receives the consensus, never a single sampled hour');
    if (results.size === 1) stable = true; else variable = true;
    if (stable && variable) break;
  }
  assert.ok(stable && variable, 'the sample must exercise both stable and ambiguous days');
});

test('full strength is recalculated, and incomplete or contradictory pillars cannot establish it', () => {
  const wall = Date.UTC(1990, 0, 15, 8);
  const chart = calculateBaZi(wall - 8 * 3600000, wall);
  const expected = analyzeBaZi(chart).L2.assessments.dayMasterStrength;
  const facts = chartFacts.bazi(chart);
  const wrong = { kind: 'day_master_strength', result: expected.result === '偏强' ? '偏弱' : '偏强', profile: expected.method };
  const context = claimChartContext('bazi', chartContext('bazi', [...facts, wrong]));
  assert.deepEqual(context.present.filter(fact => fact.kind === 'day_master_strength'),
    [{ kind: 'day_master_strength', result: expected.result, profile: expected.method }]);
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: [...facts, wrong] }]);
  assert.deepEqual(parsed[0].confirmedFacts.filter(fact => fact.kind === 'day_master_strength'),
    [{ kind: 'day_master_strength', result: expected.result, profile: expected.method }]);
  const pillars = facts.filter(fact => fact.kind === 'pillar');
  assert.deepEqual(baziDayMasterStrengthConsensus(pillars.slice(0, 2)), []);
  assert.deepEqual(baziDayMasterStrengthConsensus([...pillars.slice(0, 3), { ...pillars[3], ganZhi: '甲子' }, { ...pillars[3], ganZhi: '丙子' }]), []);
});

test('all three methods treat contradictory gender as unknown, both for matching and model input', () => {
  for (const method of ['bazi', 'ziwei', 'western']) {
    const confirmedFacts = [{ kind: 'natal_gender', gender: '男' }, { kind: 'natal_gender', gender: '女' }];
    assert.ok(!claimChartContext(method, chartContext(method, confirmedFacts)).present.some(fact => fact.kind === 'natal_gender'));
    const parsed = parseChartQueries([{ method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts }]);
    assert.ok(parsed);
    assert.ok(!parsed[0].confirmedFacts.some(fact => fact.kind === 'natal_gender'));
  }
});
