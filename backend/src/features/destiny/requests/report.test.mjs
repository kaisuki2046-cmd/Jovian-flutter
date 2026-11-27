import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, chartVersions, isWesternTimeFact } from '../control/charts.ts';
import { parseChartQueries } from '../server/knowledge/report-lookup.mjs';

// Execute the real request builder, resolving its Expo extensionless imports
// for Node without modifying the shared HTTP client or production imports.
const source = readFileSync(new URL('./report.ts', import.meta.url), 'utf8')
  .replace("from '../../../shared/http/client'", `from '${new URL('../../../shared/http/client.ts', import.meta.url).href}'`)
  .replace("from '../control/charts'", `from '${new URL('../control/charts.ts', import.meta.url).href}'`);
const compiled = stripTypeScriptTypes(source, { mode: 'transform' });
const { buildReportRequest } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('the report request sends the confirmed birth year and four pillars with no Tieban question fields', () => {
  const chart = calculateBaZi(Date.UTC(1924, 5, 15, 8), Date.UTC(1924, 5, 15, 16));
  const reading = { profile: { gender: 'male', date: { year: 1924, month: 6, day: 15 }, time: { timeKnown: true }, place: null }, charts: [
    { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, rawResult: [chart] },
    { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, rawResult: [] },
    { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, rawResult: [] },
  ] };
  const request = buildReportRequest(reading);
  assert.deepEqual(Object.keys(request.chartQueries[0]).sort(), ['birthYear', 'confirmedFacts', 'method', 'rulesetVersion']);
  const [bazi] = parseChartQueries(request.chartQueries, request);
  assert.equal(bazi.birthYear, 1924);
  assert.equal(bazi.confirmedFacts.filter(fact => fact.kind === 'pillar').length, 4);
  assert.ok(bazi.confirmedFacts.some(fact => fact.kind === 'natal_gender' && fact.gender === '男'));
  reading.profile.time.timeKnown = false;
  const unknown = buildReportRequest(reading);
  const [partial] = parseChartQueries(unknown.chartQueries, unknown);
  assert.equal(partial.birthYear, undefined);
  assert.ok(partial.confirmedFacts.every(fact => fact.position !== 'hour'));
});

test('the real request builder carries explicit historical gender while unknown time removes both geometric and Lilly facts', () => {
  const chart = calculateWestern(Date.UTC(1990, 0, 1, 8), { latitude: 39.907, longitude: 116.397 });
  for (const [gender, expected] of [['male', '男'], ['female', '女'], ['other', undefined]]) {
    for (const timeKnown of [true, false]) {
      const reading = { profile: { gender, date: { year: 1990, month: 1, day: 1 }, time: { timeKnown }, place: null }, charts: [
        { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, rawResult: [] },
        { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, rawResult: [] },
        { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, rawResult: [chart] },
      ] };
      const request = buildReportRequest(reading);
      const parsed = parseChartQueries(request.chartQueries, request);
      assert.ok(parsed);
      assert.equal(parsed.length, 1);
      const facts = parsed[0].confirmedFacts;
      assert.equal(facts.find(fact => fact.kind === 'natal_gender')?.gender, expected);
      assert.equal(facts.some(fact => fact.kind === 'western_lilly_ruleset'), timeKnown);
      assert.deepEqual(facts.filter(fact => fact.kind === 'western_fixed_star_longitude').map(fact => fact.star).sort(), timeKnown
        ? ['arcturus', 'betelgeuse', 'capella', 'caput_algol', 'cor_leonis', 'cor_scorpii', 'hercules', 'lucida_lancis',
          'oculus_taurus', 'procyon', 'sirius', 'spica_virgo'] : []);
      assert.equal(facts.some(fact => fact.kind === 'western_geometry_obliquity'), timeKnown);
      assert.equal(facts.filter(fact => fact.kind === 'western_geometry_star_latitude').length, timeKnown ? 5 : 0);
      if (!timeKnown) assert.ok(facts.every(fact => !isWesternTimeFact(fact)));
    }
  }
});

test('unknown birth time reports only a principal term shared by all possible time scenarios', () => {
  const boundary = Date.parse('1903-09-24T05:43:41.000Z');
  const baziAt = instant => calculateBaZi(instant, instant + 8 * 3600000);
  const before = baziAt(boundary - 60_000);
  const after = baziAt(boundary + 60_000);
  const later = baziAt(boundary + 120_000);
  for (const [choices, expected] of [[[before, after], undefined], [[after, later], '秋分']]) {
    const reading = { profile: { gender: 'other', time: { timeKnown: false }, place: null }, charts: [
      { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, rawResult: choices },
      { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, rawResult: [] },
      { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, rawResult: [] },
    ] };
    const request = buildReportRequest(reading);
    const [parsed] = parseChartQueries(request.chartQueries, request);
    assert.equal(parsed.confirmedFacts.find(fact => fact.kind === 'bazi_previous_qi')?.term, expected);
    assert.ok(parsed.confirmedFacts.every(fact => fact.position !== 'hour'));
  }
});
