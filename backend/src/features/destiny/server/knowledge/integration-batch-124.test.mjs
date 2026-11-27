import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-124-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-honour-grading-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-honour-grading-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => fixture.witnesses.find(({ proofs }) => proofs.some(({ id }) => id === prefix + number + '-001'));
const natalFacts = number => nativeFacts(sampleFor(number));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}

const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(prefix + number + '-001', 'western', context(query(facts)), undefined, catalog);
const assertNoMatch = (number, facts, timeKnown = true) => {
  const parsed = query(facts, timeKnown);
  const id = prefix + number + '-001';
  assert.equal(explainClaim(id, 'western', context(parsed), undefined, catalog).matched, false, id);
  assert.ok(hits(lookup([parsed])).every(hit => hit.id !== id), id);
};

test('every verified dignity, exact exaltation and fixed-star group is reachable through a native chart and SQLite report lookup', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyPrefermentProfile, id);
    for (const input of record.inputs) {
      // Batch 125 verifies the four stars added to this shared scoring claim.
      if (id === prefix + '103-001' && input.required.some(fact => fact.kind === 'western_lilly_preferment_royal_contact'
        && !['spica_virgo', 'cor_leonis'].includes(fact.star))) continue;
      assert.ok(new Set(input.required.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(record.claim);
    changed.conditions.original.push('changed');
    assert.equal(compileLillyPrefermentSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(nativeFacts(sample));
    const observed = context(parsed);
    const references = lookup([parsed]);
    const matched = hits(references);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest;
      const input = expected.get(proof);
      assert.ok(input, proof);
      const derived = claimChartContext('western', observed, input.required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.ok(detail.calculationNote, id);
      if (!id.endsWith('p016-001')) {
        const evidence = detail.matchedConditions.measurements.find(fact => fact.kind.startsWith('western_lilly_preferment_'));
        assert.ok(evidence?.planet, id);
        assert.ok(materials.includes(factText(evidence)), id);
      }
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('an unlocated classical body cannot prove no essential reception', () => {
  const complete = natalFacts('014');
  assert.equal(explain('014', complete).matched, true);
  const partial = complete.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mars');
  assertNoMatch('014', [...partial, { kind: 'western_lilly_preferment_grade', table: 'main', dignity: 'detriment' }]);
  assertNoMatch('013', [...partial, { kind: 'western_lilly_preferment_grade', table: 'main', dignity: 'face' }]);
});

test('both exact exaltation degrees and every malefic exclusion must be confirmed', () => {
  const full = natalFacts('016');
  const signOrPosition = (fact, body) => fact.planet === body && ['planet_longitude', 'planet_sign'].includes(fact.kind);
  const sun = full.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Sun').longitude;
  const withMars = longitude => [...full.filter(fact => !signOrPosition(fact, 'Mars')), { kind: 'planet_longitude', planet: 'Mars', longitude }];
  assert.equal(explain('016', full).matched, true);
  assertNoMatch('016', withMars((sun + 90) % 360));
  assertNoMatch('016', full.filter(fact => !signOrPosition(fact, 'Mars')));
  const outside = [...full.filter(fact => !signOrPosition(fact, 'Moon')), { kind: 'planet_longitude', planet: 'Moon', longitude: 34.001 }];
  assertNoMatch('016', outside);
});

test('a fixed star must have one verified longitude and be within five degrees of an actual significator', () => {
  const base = [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
    })),
    { kind: 'planet_longitude', planet: 'Sun', longitude: 359.8 },
  ];
  const star = longitude => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star: 'spica_virgo', longitude });
  const exact = [...base, star(4.8)];
  assert.equal(explain('037', exact).matched, true);
  assert.equal(explain('103', exact).matched, true);
  assert.equal(catalog.get(prefix + '103-001').remainingAlternatives ?? 0, 0);
  assertNoMatch('037', [...base, star(4.8001)]);
  assertNoMatch('037', [...exact, star(5.1)]);
  assertNoMatch('037', exact, false);
  assertNoMatch('037', [...base.filter(fact => fact.planet !== 'Sun'), star(4.8),
    { kind: 'planet_longitude', planet: 'Jupiter', longitude: 4.8 }]);
});
