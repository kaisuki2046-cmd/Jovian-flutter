import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { buildChartFactsText } from '../chart-facts-text.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyFortitudeRows, lillyFortitudeProfile } from './lilly-fortitudes.mjs';
import { createReportLookup } from './report-lookup.mjs';

const { scanned, witnesses, fixedStarWitnesses, fixedStarReference } = JSON.parse(readFileSync(new URL('./claims/lilly-fortitude-witnesses.json', import.meta.url)));
const source = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const points = [5, 4, 3, 2, 1, -5, -4, -5, 5, 4, 3, 2, 1, -5, -2, 4, -5, 2, -2,
  2, -2, 2, -2, 2, -2, 5, 5, -5, -4, 5, 4, 3, -5, -4, -3, 4, -4, -5, 6, 5, -5];
const idOf = row => 'astro-lilly-v1-strength-table-p' + String(row).padStart(3, '0') + '-001';
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const fixedStar = (star, longitude) => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star, longitude });
const sign = (planet, sign) => ({ kind: 'planet_sign', planet, sign });
const sourceIds = result => new Set(result.map(row => row.sourceId));

function query(facts, timeKnown = true, chartScope = 'natal') {
  const parsed = parseInput({ timeKnown, chartQueries: [{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, chartScope, confirmedFacts: facts,
  }] });
  assert.ok(parsed);
  return parsed;
}

const fortitudes = refs => refs.flatMap(ref => ref.calculationReferences ?? [])
  .filter(reference => reference.role === 'fortitude_lookup' && reference.profile === lillyFortitudeProfile);
const factors = (facts, planet, timeKnown = true) =>
  fortitudes(lookup(query(facts, timeKnown).chartQueries)).find(reference => reference.planet === planet)?.factors ?? [];

test('all 41 signed original rows are stored in SQLite and reach report materials on calculated charts', () => {
  assert.equal(scanned, 8614);
  assert.equal(witnesses.length, 20);
  assert.equal(fixedStarWitnesses.length, 3);
  for (const [index, value] of points.entries()) {
    const id = idOf(index + 1);
    const row = catalog.get(id);
    assert.equal(row.calculationReference.points, value);
    assert.equal(row.calculationReference.profile, lillyFortitudeProfile);
    assert.equal(row.inputs, undefined);
  }
  const found = new Set();
  for (const witness of [...witnesses, ...fixedStarWitnesses]) {
    const facts = chartFacts.western(calculateWestern(Date.parse(witness.birthTime), witness.place));
    const references = lookup(query(facts).chartQueries);
    const scored = fortitudes(references);
    const materials = buildReportMaterials(references);
    for (const { planet, sourceId, points } of witness.proofs) {
      const row = scored.find(ref => ref.planet === planet)?.factors.find(row => row.sourceId === sourceId);
      assert.equal(row?.points, points, sourceId);
      assert.ok(row.source.original.length, sourceId);
      assert.ok(materials.includes(`${row.label} ${points > 0 ? '+' : ''}${points}分`), sourceId);
      assert.ok(references.every(({ personality, events }) => [...personality, ...events].every(rule => rule.id !== sourceId)), sourceId);
      found.add(sourceId);
    }
  }
  assert.deepEqual(found, new Set(points.map((_, index) => idOf(index + 1))));
});

test('modern apparent fixed-star longitudes agree with an independent ephemeris across epochs', () => {
  assert.equal(fixedStarReference.samples.length, 6);
  for (const [utc, longitudes] of fixedStarReference.samples) {
    const chart = calculateWestern(Date.parse(utc), fixedStarWitnesses[0].place);
    const facts = chartFacts.western(chart).filter(fact => fact.kind === 'western_fixed_star_longitude'
      && fixedStarReference.stars.includes(fact.star));
    assert.deepEqual(facts.map(fact => fact.star), fixedStarReference.stars);
    for (const [index, fact] of facts.entries()) {
      assert.ok(Math.abs(fact.longitude - longitudes[index]) * 3600 < 0.2, `${utc} ${fact.star}`);
    }
  }
});

test('fixed-star rows require the correct star and planet positions, with distinct contact limits', async () => {
  const nearSpica = [tropical, fixedStar('spica_virgo', 204.123), longitude('Moon', 204.125)];
  const nextMinute = [tropical, fixedStar('spica_virgo', 204.123), longitude('Moon', 204.137)];
  assert.ok(sourceIds(factors(nearSpica, 'Moon')).has(idOf(40)));
  assert.ok(!sourceIds(factors(nextMinute, 'Moon')).has(idOf(40)));
  assert.ok(!sourceIds(factors(nearSpica, 'Moon', false)).has(idOf(40)));
  assert.ok(!sourceIds(factors([...nearSpica, fixedStar('spica_virgo', 204.12)], 'Moon')).has(idOf(40)));
  assert.ok(!sourceIds(factors(nearSpica.filter(fact => !fact.star), 'Moon')).has(idOf(40)));
  assert.ok(!sourceIds(factors([...nearSpica, sign('Moon', '白羊座')], 'Moon')).has(idOf(40)));
  assert.ok(!query(nearSpica, false).chartQueries[0].confirmedFacts.some(fact => fact.kind === 'western_fixed_star_longitude'));
  const { chartQueries: [base] } = query(nearSpica);
  const invalidStars = [fixedStar('unknown', 204.123), fixedStar(['spica_virgo'], 204.123),
    fixedStar('spica_virgo', 360), { ...nearSpica[1], profile: 'unverified' }];
  for (const invalid of invalidStars) {
    assert.equal(parseInput({ chartQueries: [{ ...base, confirmedFacts: [tropical, invalid] }] }), null);
  }
  const algol = [tropical, fixedStar('caput_algol', 359)];
  assert.ok(sourceIds(factors([...algol, longitude('Mars', 4)], 'Mars')).has(idOf(41)));
  assert.ok(!sourceIds(factors([...algol, longitude('Mars', 4.0001)], 'Mars')).has(idOf(41)));
  const parsed = query(nearSpica);
  assert.match(buildChartFactsText(parsed.chartQueries), /角宿一在该时刻的热带视黄经为204\.123000度/u);
  assert.match(buildReportMaterials(lookup(parsed.chartQueries)), /月亮：[^\n]*合角宿一 \+5分/u);
  const result = await generateReport(parsed, {
    lookup: queries => lookup(queries).map(section => ({ ...section, personality: [], events: [] })),
    signal: new AbortController().signal,
    complete: async () => assert.fail('Fixed-star scores alone do not generate a report.'),
  });
  assert.equal(result.report, null);
});

test('sign-only records can prove domicile or mutual exaltation but do not fill unknown degrees or houses', () => {
  const facts = [tropical, sign('Sun', '摩羯座'), sign('Mars', '白羊座')];
  assert.ok(sourceIds(factors(facts, 'Sun', false)).has(idOf(2)));
  const mars = sourceIds(factors(facts, 'Mars', false));
  assert.deepEqual(mars, new Set([idOf(1), idOf(2)]));
  const conflicting = [...facts, longitude('Mars', 40)];
  assert.deepEqual(factors(conflicting, 'Mars'), []);
  const changedZodiac = [...facts, { ...tropical, zodiac: 'sidereal' }];
  assert.equal(parseInput({ timeKnown: true,
    chartQueries: [{ ...query(facts).chartQueries[0], confirmedFacts: changedZodiac }],
  }), null);
});

test('partile uses degrees and minutes, distinct bodies and one score per source row', () => {
  const exact = [tropical, longitude('Mercury', 15.123), longitude('Jupiter', 135.125), longitude('Venus', 255.125)];
  const credited = factors(exact, 'Mercury').filter(row => row.sourceId === idOf(31));
  assert.equal(credited.length, 1);
  assert.equal(credited[0].points, 4);
  const otherMinute = [tropical, longitude('Mercury', 15.123), longitude('Jupiter', 135.15)];
  assert.ok(!sourceIds(factors(otherMinute, 'Mercury')).has(idOf(31)));
  assert.ok(!sourceIds(factors([tropical, longitude('Jupiter', 135.125)], 'Jupiter')).has(idOf(30)));
  const node = { kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude: 180.127 };
  assert.ok(sourceIds(factors([tropical, node, longitude('Mars', 0.125)], 'Mars')).has(idOf(37)));
  assert.ok(!sourceIds(factors([tropical, node, longitude('Mars', 0.125)], 'Mars')).has(idOf(36)));
});

test('solar states are exclusive and the supported Saturn–Mars enclosure uses the two actual bodies', async () => {
  const solar = value => [tropical, longitude('Sun', 10), longitude('Mercury', value)];
  for (const [degree, expected] of [[10.1, 27], [12, 28], [23, 29], [28, 26]]) {
    const ids = [...sourceIds(factors(solar(degree), 'Mercury'))].filter(id => [26, 27, 28, 29].some(row => id === idOf(row)));
    assert.deepEqual(ids, [idOf(expected)]);
  }
  const enclosure = [tropical, longitude('Saturn', 15), longitude('Mars', 10), longitude('Venus', 13)];
  assert.ok(sourceIds(factors(enclosure, 'Venus')).has(idOf(38)));
  assert.ok(!sourceIds(factors(enclosure, 'Mars')).has(idOf(38)));
  assert.ok(!sourceIds(factors(enclosure.filter(fact => fact.planet !== 'Saturn'), 'Venus')).has(idOf(38)));
  const moon = [tropical, longitude('Sun', 10), longitude('Moon', 40)];
  assert.equal(factors(moon, 'Moon').filter(row => row.sourceId === idOf(24)).length, 1);
  assert.deepEqual(fortitudes(lookup(query(moon, true, 'annual').chartQueries)), []);
  const materials = buildReportMaterials(lookup(query(solar(12)).chartQueries));
  assert.match(materials, /莉莉原表强弱计分[\s\S]*水星：[^\n]*燃烧 -5分/u);
  assert.doesNotMatch(materials, /水星：[^\n]*日光束内 -4分/u);
});

test('changed source rows and incomplete revisions fail closed', () => {
  const rows = source.filter(claim => points.some((_, index) => idOf(index + 1) === claim.id));
  assert.equal(compileLillyFortitudeRows(rows).size, 41);
  assert.throws(() => compileLillyFortitudeRows(rows.slice(1)), /Incomplete/u);
  const amended = structuredClone(rows);
  amended[0].conditions.match.include[0][1].equals = false;
  assert.throws(() => compileLillyFortitudeRows(amended), /Review changed/u);
  assert.equal(compileLillyFortitudeRows([]).size, 0);
});
