import assert from 'node:assert/strict';
import test from 'node:test';
import '../typescript-imports.mjs';

const { isConsistentWesternFact } = await import('./western-fact-integrity.mjs');

test('western aspect facts require genuine body and axis labels and the produced direction', () => {
  const cross = { rule: 'western-cross-aspect', direction: 'mutual', facts: { aPlanet: 'Sun', bPlanet: 'Moon' } };
  assert.equal(isConsistentWesternFact(cross), true);
  assert.equal(isConsistentWesternFact({ ...cross, direction: 'a_to_b' }), false);
  assert.equal(isConsistentWesternFact({ ...cross, facts: { aPlanet: 'Sun' } }), false);
  const axis = { rule: 'western-axis-aspect', direction: 'mutual', facts: { aAxis: 'MC', bAxis: 'IC' } };
  assert.equal(isConsistentWesternFact(axis), true);
  assert.equal(isConsistentWesternFact({ ...axis, facts: { aAxis: 'MC', bAxis: 'Sun' } }), false);
  const planetAxis = { rule: 'western-planet-to-axis', direction: 'b_to_a', facts: { planet: 'Jupiter', axis: 'ASC' } };
  assert.equal(isConsistentWesternFact(planetAxis), true);
  assert.equal(isConsistentWesternFact({ ...planetAxis, direction: 'mutual' }), false);
  assert.equal(isConsistentWesternFact({ ...planetAxis, facts: { axis: 'ASC' } }), false);
  const distance = { rule: 'western-matching-planet-angle', direction: 'mutual', facts: { planet: 'Saturn' } };
  assert.equal(isConsistentWesternFact(distance), true);
  assert.equal(isConsistentWesternFact({ ...distance, facts: { planet: 'constructor' } }), false);
});

test('western house ruler facts cross-check traditional sign rulers and whole-sign target houses', () => {
  const ruler = { house: 6, sign: 0, ruler: 'Mars', longitude: 359, rulership: 'traditional-domicile-v1' };
  const overlay = { rule: 'western-house-ruler-overlay', direction: 'a_to_b',
    facts: { ...ruler, targetAscendant: 5, targetHouse: 12 } };
  assert.equal(isConsistentWesternFact(overlay), true);
  assert.equal(isConsistentWesternFact({ ...overlay, facts: { ...overlay.facts, targetHouse: 1 } }), false);
  const { targetAscendant, ...withoutAscendant } = overlay.facts;
  assert.equal(isConsistentWesternFact({ ...overlay, facts: withoutAscendant }), false);
  assert.equal(isConsistentWesternFact({ ...overlay, facts: { ...overlay.facts, ruler: 'Venus' } }), false);
  const aspect = { rule: 'western-house-ruler-aspect', direction: 'b_to_a', facts: { ...ruler, targetPlanet: 'Sun' } };
  assert.equal(isConsistentWesternFact(aspect), true);
  assert.equal(isConsistentWesternFact({ ...aspect, facts: { ...aspect.facts, house: 13 } }), false);
  assert.equal(isConsistentWesternFact({ ...aspect, facts: { ...aspect.facts, targetPlanet: 'MC' } }), false);
});

test('archived same-planet angles require the same measurements in a corroborating cross aspect', async () => {
  const { comparisonRulesVersion } = await import('../../model/comparison.ts');
  const { openPassageCatalog } = await import('../knowledge/claims-sqlite.mjs');
  const { collectEntryEvidence } = await import('../match-evidence.mjs');
  const entry = {
    id: 30865,
    source: { book: 'Test fixture', locator: 'Same-planet angle', url: null },
    category: { method: 'western', topic: 'friendship', contentType: 'personality' },
    originalText: 'Same-planet angle',
    matchConditions: {
      original: ['Same Sun in both charts'],
      formatted: { status: 'ready', alternatives: [[{
        factTypeId: 'western:western-matching-planet-angle', direction: 'mutual', equal: { planet: 'Sun' },
      }]] },
    },
    modernInterpretation: 'Interpretation supported by a shared measurement.',
  };
  const common = { system: 'western', direction: 'mutual', observation: '测量记录',
    sources: ['A 方', 'B 方'], chartRulesets: ['tropical-whole-sign-v1', 'tropical-whole-sign-v1'] };
  const main = { ...common, rule: 'western-matching-planet-angle',
    facts: { planet: 'Sun', aLongitude: 14, bLongitude: 104, degrees: 90 } };
  const cross = { ...common, rule: 'western-cross-aspect',
    facts: { aPlanet: 'Sun', bPlanet: 'Sun', aLongitude: 14, bLongitude: 104, degrees: 90, angle: 90, deviation: 0, orb: 5 } };
  const catalog = openPassageCatalog(':memory:', { entries: [entry] });
  try {
    const hits = (...facts) => collectEntryEvidence({ rulesVersion: comparisonRulesVersion, facts }, catalog).hits;
    const [hit] = hits(main, cross);
    assert.equal(hit?.id, entry.id);
    assert.equal(hit.consistentMeasurements, true);
    assert.equal(hit.proofs.length, 2);
    assert.deepEqual(hits(main), []);
    assert.deepEqual(hits(cross), []);
    assert.deepEqual(hits(main, { ...cross, facts: { ...cross.facts, bPlanet: 'Moon' } }), []);
    assert.deepEqual(hits(main, { ...cross, facts: { ...cross.facts, aLongitude: 24, bLongitude: 114 } }), []);
  } finally {
    catalog.close();
  }
});
