import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim, lookupWesternHistoricalCases } from './claims.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { compileLillyMerchantCase, lillyMerchantCaseId, lillyMerchantCaseProfile, lillyMerchantPrintedChartFacts } from './lilly-merchant-case.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-merchant-case-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-merchant-case-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const prefix = 'astro-lilly-v3-merchant-p';
const idOf = number => prefix + String(number).padStart(3, '0') + '-001';

// Absolute arcminutes from the 1647 diagram on p.742. The fifth and
// eleventh cusps are the numeric boundary of the 30° printed labels.
const original = [
  { kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...[16597, 19410, 1114, 2679, 3600, 4489, 5797, 8610, 11914, 13479, 14400, 15289]
    .map((minutes, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: minutes / 60 })),
  ...Object.entries({ Sun: 11197, Moon: 3704, Mercury: 11034, Venus: 11214, Mars: 7254, Jupiter: 15715, Saturn: 2342 })
    .map(([planet, minutes]) => ({ kind: 'planet_longitude', planet, longitude: minutes / 60 })),
];
const printedTablesAndEarlyNarrative = [1, 2, 3, 4, 7, 10, 11, ...Array.from({ length: 15 }, (_, i) => 25 + i), 79, 80, 83,
  ...Array.from({ length: 18 }, (_, i) => 86 + i), 104, 106, 134, ...Array.from({ length: 13 }, (_, i) => 139 + i), 153];
const laterNarrativeAndCrosschecks = [
  5, 6, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 40,
  42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 56, 57, 58, 59,
  61, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 81, 82, 84, 85, 105,
  107, 108, 109, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 155, 156, 157, 158, 160, 161, 163, 165, 166, 169, 170, 181,
  190,
];
const finalChapterRecords = [23, 63, 64, 65, 66, 73, 138, 183, 186, 187];
const expected = new Set([...printedTablesAndEarlyNarrative, ...laterNarrativeAndCrosschecks, ...finalChapterRecords].map(idOf));

function queries(facts = original, fields = {}, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts, ...fields,
  }], { timeKnown });
  assert.equal(parsed.length, 1);
  return parsed;
}
const context = ([q]) => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const references = report => report.flatMap(topic => topic.caseReferences ?? []);
const readings = report => report.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts = original) => explainClaim(idOf(number), 'western', context(queries(facts)), undefined, catalog);
const proofMap = record => Object.fromEntries(record.matchedConditions.required.map(({ selector, value }) => [selector, value]));

test('all reviewed records reach SQLite, explanation and report under the same printed case', () => {
  assert.deepEqual(lillyMerchantPrintedChartFacts(), original);
  assert.equal(printedTablesAndEarlyNarrative.length, 60);
  assert.equal(laterNarrativeAndCrosschecks.length, 86);
  assert.equal(expected.size, 156);
  const indexed = catalog.inventory().filter(row => row.method === 'western' && row.lookup.status === 'case_indexed');
  assert.deepEqual(new Set(indexed.map(({ claim }) => claim.id)), expected);
  const parsed = queries();
  const report = lookup(parsed);
  const material = buildReportMaterials(report);
  assert.deepEqual(new Set(references(report).map(row => row.id)), expected);
  assert.deepEqual(new Set(lookupWesternHistoricalCases(context(parsed), 'Christian Astrology', catalog).map(row => row.id)), expected);
  assert.ok(readings(report).every(row => !expected.has(row.id)));
  assert.ok(lookupInterpretations(directory, parsed[0], catalog).every(row => !expected.has(row.id)));
  for (const ref of references(report)) {
    const row = catalog.get(ref.id);
    const match = explainClaim(ref.id, 'western', context(parsed), undefined, catalog);
    assert.equal(row.compiler, lillyMerchantCaseProfile);
    assert.equal(row.inputs.length, 1, ref.id);
    assert.equal(match.matched, true, ref.id);
    assert.equal(match.matchScope, 'historical_case', ref.id);
    assert.equal(proofMap(match)['context.historical_case'], lillyMerchantCaseId);
    assert.match(match.calculationNote, /第 742 页印盘/);
    assert.ok(material.includes('古籍印盘对照·' + row.claim.title), ref.id);
    assert.ok(material.includes(row.claim.evidence.original_text), ref.id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 另版';
    assert.equal(compileLillyMerchantCase(changed).reason, 'source_review_required', ref.id);
  }
});

test('later chapters retain printed counts and openly compare their two source readings', () => {
  const field = name => 'profiles.lilly.merchant_case.' + name;
  assert.match(explain(9).comparisonNote, /六合.*116°39′/u);
  assert.match(explain(14).comparisonNote, /整度合相.*60 角分/u);
  assert.match(explain(125).comparisonNote, /临中天.*294 角分/u);
  const child = proofMap(explain(75));
  assert.deepEqual(['bicorporeal_printed', 'moon_printed', 'aspected_planets_printed', 'probability_printed']
    .map(name => child[field('children_count_table.' + name)]), [2, 1, 4, 4]);
  assert.equal(explain(55).matched, false);
  assert.equal(explain(55).reason, 'source_review_required');
  const strengthAntiscion = proofMap(explain(74));
  assert.equal(strengthAntiscion[field('printed_longitude.mercury.arcminutes_in_sign')], 214);
  assert.equal(strengthAntiscion[field('recomputed_antiscia.mercury.arcminutes_in_sign')], 1586);
  assert.equal(strengthAntiscion[field('recomputed_contra_antiscia.mercury.arcminutes_in_sign')], 1586);
  const siblings = proofMap(explain(107));
  assert.deepEqual(['reported_brothers', 'jupiter_count', 'mars_count', 'implied_remainder']
    .map(name => siblings[field('siblings_p751.' + name)]), [7, 2, 1, 4]);
  const trips = proofMap(explain(118));
  assert.deepEqual(['reported_overseas_trips', 'reported_barbary_trips', 'reported_holland_trips']
    .map(name => trips[field('travel_p758.' + name)]), [3, 2, 1]);
  const material = buildReportMaterials(lookup(queries()));
  assert.match(material, /第 751 页正文称木星六合第三宫头。按第 742 页印盘，木星与该宫头的较短黄经距离为 116°39′/u);
  assert.match(material, /结论栏也印作可能 4/u);
  assert.ok(material.includes(catalog.get(idOf(75)).claim.interpretation.limitations[0]));
});

test('the figure, strength table, antiscia and zodiac-boundary printings retain their own values', () => {
  const field = name => 'profiles.lilly.merchant_case.' + name;
  assert.equal(proofMap(explain(94))[field('printed_diagram_longitude.mercury.arcminutes_in_sign')], 234);
  assert.equal(proofMap(explain(94))[field('printed_antiscia.mercury.arcminutes_in_sign')], 1566);
  assert.equal(proofMap(explain(101))[field('printed_strength_table.longitude.mercury.arcminutes_in_sign')], 214);
  assert.equal(proofMap(explain(95))[field('printed_strength_table.venus.cazimi_points')], 5);
  assert.equal(proofMap(explain(93))[field('printed_house_cusps.house_11.sign')], 'scorpio');
  assert.equal(proofMap(explain(93))[field('printed_house_cusps.house_11.arcminutes_in_sign')], 1800);
  assert.equal(proofMap(explain(93))[field('children_count_table.eleventh_judgment_sign')], 'sagittarius');
  const total = proofMap(explain(38));
  assert.deepEqual(['hot', 'moist', 'cold', 'dry'].map(quality => total[field('temperament_table.totals.' + quality)]), [7, 6, 6, 7]);
});

test('regional headings and late-chapter judgments are limited to the source case', () => {
  const region = [63, 64, 65, 66].map(number => proofMap(explain(number))['context.lilly_legacy_region_sign']);
  assert.deepEqual(region, ['capricorn', 'pisces', 'libra', 'sagittarius']);
  assert.match(explain(23).comparisonNote, /白羊.*狮子/u);
  assert.match(explain(73).comparisonNote, /公共境况.*643/u);
  assert.match(explain(183).comparisonNote, /金星和木星.*日、金、水/u);
  const field = name => 'profiles.lilly.merchant_case.death.' + name;
  assert.equal(proofMap(explain(186))[field('intercepted_virgo_in_eighth')], true);
  assert.equal(proofMap(explain(187))[field('venus_regulates_mercury')], true);
  const pending = explain(62);
  assert.equal(pending.matched, false);
  assert.equal(pending.reason, 'unsupported_calculation_profile');
});

test('same signs, a partial figure and injected case facts cannot match the archive', () => {
  const marker = { kind: 'western_lilly_merchant_case', selector: 'context.historical_case', value: lillyMerchantCaseId };
  const bad = [
    [marker],
    original.filter(fact => fact.planet !== 'Mercury'),
    original.filter(fact => fact.house !== 12),
    original.map(fact => fact.planet === 'Mercury' ? { ...fact, longitude: 183.5 } : fact),
    [...original, { kind: 'planet_longitude', planet: 'Mercury', longitude: 183.5 }],
    [...original, { kind: 'planet_sign', planet: 'Mercury', sign: '处女座' }],
  ];
  for (const facts of bad) {
    assert.equal(explain(94, facts).matched, false);
    assert.deepEqual(references(lookup(queries(facts))), []);
  }
  const roundedSame = original.map(fact => fact.planet === 'Sun' ? { ...fact, longitude: fact.longitude + 0.25 / 60 } : fact);
  assert.equal(explain(94, roundedSame).matched, true);
  const differentMinute = original.map(fact => fact.planet === 'Sun' ? { ...fact, longitude: fact.longitude + 0.75 / 60 } : fact);
  assert.equal(explain(94, differentMinute).matched, false);
});

test('case lookup honors natal scope, confirmed time and tradition', () => {
  assert.deepEqual(references(lookup(queries(original, {}, false))), []);
  assert.deepEqual(references(lookup(queries(original, { chartScope: 'annual' }))), []);
  assert.deepEqual(references(lookup(queries(original, { tradition: 'Tetrabiblos' }))), []);
  assert.equal(references(lookup(queries(original, { tradition: 'Christian Astrology' }))).length, expected.size);
  const unparsed = [{ ...queries()[0], rulesetVersion: 'different-version' }];
  assert.deepEqual(references(lookup(unparsed)), []);
});
