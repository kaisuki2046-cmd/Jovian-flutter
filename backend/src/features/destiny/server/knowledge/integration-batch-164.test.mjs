import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyProfessionSource } from './lilly-profession-sources.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-lunar-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-lunar-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-164-witnesses.json', import.meta.url)));
const idOf = suffix => `astro-lilly-v3-profession-${suffix}-001`;
const planets = ['Mercury', 'Venus', 'Mars'];
const step = (planet, state) => ({ kind: 'western_lilly_profession_step', planet, step: 4, state });
const placement = placedIn => ({ kind: 'western_lilly_ruler_house', house: 10, placedIn });
const rawNative = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (confirmedFacts, { timeKnown = true, chartScope = 'natal' } = {}) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology',
  confirmedFacts, chartScope,
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (suffix, raw, options) => explainClaim(idOf(suffix), 'western', context(parse(raw, options)), undefined, catalog);
const body = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });

test('all added career witnesses reach SQLite, explanation and report materials from native charts', () => {
  const expected = new Set([
    ...['method-p005', 'method-p018', 'method-p019', 'p078'].flatMap(suffix => planets.map(planet => suffix + ':' + planet)),
    ...Array.from({ length: 12 }, (_, index) => 'method-p006:' + (index + 1)),
  ]);
  const seen = new Set();
  const reviewed = new Set();
  assert.equal(witnesses.length, 16);
  for (const sample of witnesses) {
    const query = parse(rawNative(sample));
    const report = lookup([query]);
    const readings = report.flatMap(({ personality, events }) => [...personality, ...events]);
    const materials = buildReportMaterials(report);
    for (const proof of sample.proofs) {
      assert.ok(expected.has(proof) && !seen.has(proof), proof);
      const [suffix, value] = proof.split(':');
      const id = idOf(suffix);
      const detail = explainClaim(id, 'western', context(query), query.tradition, catalog);
      assert.equal(detail.matched, true, proof);
      assert.ok(readings.some(row => row.id === id), proof);
      const { required, alternatives } = detail.matchedConditions;
      let fact;
      if (suffix === 'method-p006') {
        fact = alternatives.flat().find(f => f.kind === 'western_lilly_ruler_house');
        assert.deepEqual(fact, placement(Number(value)));
        assert.match(detail.calculationNote, /626.*落座、落宫/u);
      } else if (suffix === 'p078') {
        fact = required.find(f => f.kind === 'western_lilly_profession_ruler');
        assert.equal(fact.planet, value);
        assert.equal(fact.role, 'sole');
        assert.equal(required.filter(f => f.kind === 'western_lilly_aspect' && f.matches === false).length, 4);
        assert.match(detail.calculationNote, /两张容许度表均证实/u);
      } else {
        fact = [...required, ...alternatives.flat()].find(f => f.kind === 'western_lilly_profession_step' && f.planet === value);
        const state = { 'method-p005': 'selected', 'method-p018': 'qualifies', 'method-p019': 'afflicted' }[suffix];
        assert.deepEqual(fact, step(value, state));
      }
      const { claim } = catalog.get(id);
      assert.ok(materials.includes(factText(fact)), proof);
      assert.ok(materials.includes(claim.evidence.original_text), proof);
      if (!reviewed.has(id)) {
        const changed = structuredClone(claim);
        changed.evidence.context += ' 修订本';
        assert.equal(compileLillyProfessionSource(changed).reason, 'source_review_required', id);
        reviewed.add(id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, expected);
  assert.equal(catalog.get(idOf('method-p005')).remainingAlternatives, undefined);
  assert.equal(catalog.get(idOf('p078')).remainingAlternatives, 3);
});

const base = (overrides = {}) => [
  { kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'western_sect', sect: 'day' },
  { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...Array.from({ length: 12 }, (_, index) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
  })),
  ...Object.entries({ Sun: 25, Moon: 101.5, Mercury: 38, Venus: 52, Mars: 252, Saturn: 290, ...overrides })
    .filter(([, longitude]) => longitude !== null).map(([planet, longitude]) => body(planet, longitude)),
];

test('the fourth step respects earlier selection, both Moon limits and actual malefic contacts', () => {
  const verified = explain('method-p018', base());
  assert.ok(verified.matchedConditions.required.some(fact => fact.kind === 'western_lilly_profession_step'
    && fact.state === 'qualifies' && fact.planet === 'Mercury'));
  assert.equal(explain('method-p005', base()).matched, true);
  assert.equal(explain('method-p018', base({ Moon: 104 })).matched, true);
  assert.equal(explain('method-p018', base({ Moon: 104.2 })).matched, false);
  assert.equal(explain('method-p019', base({ Saturn: 128 })).matched, true);
  assert.equal(explain('method-p018', base({ Saturn: 128 })).matched, false);
  assert.equal(explain('method-p019', base({ Saturn: 136.2 })).matched, false);
  assert.equal(explain('method-p005', base({ Saturn: 136.2 })).matched, false);
  assert.equal(explain('method-p018', base({ Saturn: 136.2 })).matched, false);
  assert.equal(explain('method-p018', base({ Moon: 98.5 })).matched, false);
  assert.equal(explain('method-p017', base({ Moon: 98.5 })).matched, false); // One partile candidate suffices to stop step four.
  assert.equal(explain('method-p005', base({ Moon: 98.5 })).matchedConditions.required.some(fact => fact.step === 3), true);
  assert.equal(explain('method-p018', base({ Venus: 47 })).matched, true);
  assert.equal(explain('method-p005', base({ Venus: 47 })).matched, false);
});

test('unknown time, absent or conflicting facts and forged derivations do not qualify', () => {
  assert.equal(explain('method-p018', base(), { timeKnown: false }).matched, false);
  assert.equal(explain('method-p006', base(), { timeKnown: false }).matched, false);
  assert.equal(explain('method-p018', base(), { chartScope: 'annual' }).matched, false);
  assert.equal(explain('method-p018', [...base({ Saturn: null }), step('Mercury', 'qualifies')]).matched, false);
  assert.equal(explain('method-p018', [...base(), body('Saturn', 291)]).matched, false);
  assert.equal(explain('method-p018', base({ Venus: null })).matched, false);
  assert.equal(explain('method-p006', [...base({ Saturn: null }), { kind: 'western_lilly_profession_tenth_house' }]).matched, false);
  assert.equal(explain('method-p006', [...base(), { kind: 'planet_sign', planet: 'Saturn', sign: '金牛座' }]).matched, false);

  const alone = rawNative(witnesses.find(sample => sample.proofs.includes('p078:Mars')));
  assert.equal(explain('p078', alone).matched, true);
  assert.equal(explain('p078', alone.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mercury')).matched, false);
  assert.equal(explain('method-p020', base()).matched, false);
});
