import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { cardanoDignityFacts, cardanoDignityProfile } from './cardano-dignity.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const sun = 'astro-ptolemy-v4-dignity-p033-001';
const moon = 'astro-ptolemy-v4-dignity-p034-001';
const place = { latitude: 31.23, longitude: 121.47 };
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const native = (day, hour, month = 2) => chartFacts.western(calculateWestern(Date.UTC(1990, month, day, hour, 15), place));

function query(confirmedFacts, options = {}) {
  const result = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts, chartScope: options.scope }], { timeKnown: options.timeKnown });
  assert.ok(result);
  return result;
}

function explain(id, facts, options) {
  const [parsed] = query(facts, options);
  return explainClaim(id, 'western', chartContext('western', parsed.confirmedFacts, [], parsed.chartScope), undefined, catalog);
}

function findMatches(references) {
  return references.flatMap(ref => [...ref.events, ...ref.personality]).filter(hit => [sun, moon].includes(hit.id));
}

test('both of Cardano’s fourth-state variants match the 3D Regiomontanus chart in SQLite and report text', () => {
  const examples = [
    { id: sun, facts: native(28, 14), houses: [4, 5], phrase: 'in signo masculino et in angulo', labels: /太阳居角.*月亮离角/su },
    { id: moon, facts: native(28, 16), houses: [3, 4], phrase: 'paulo debilius', labels: /月亮居角.*太阳离角/su },
  ];
  for (const { id, facts, houses, phrase, labels } of examples) {
    const actual = ['Sun', 'Moon'].map(planet => facts.find(f => f.kind === 'western_profile_planet_house' && f.planet === planet).house);
    assert.deepEqual(actual, houses);
    assert.ok(facts.filter(fact => fact.kind === 'planet_house' && ['Sun', 'Moon'].includes(fact.planet))
      .every(fact => ![1, 4, 7, 10].includes(fact.house)), 'the whole-sign houses would miss both variants');
    const refs = lookup(query(facts));
    assert.deepEqual(findMatches(refs).map(hit => hit.id), [id]);
    const explanation = explain(id, facts);
    assert.ok(explanation.matched);
    assert.match(explanation.calculationNote, labels);
    const material = buildReportMaterials(refs);
    assert.ok(material.includes(phrase));
    assert.match(material, labels);
    assert.doesNotMatch(material, /western_cardano_dignity/u);
    const row = catalog.get(id);
    assert.equal(row.compiler, cardanoDignityProfile);
    const changedSource = structuredClone(row.claim);
    changedSource.evidence.context += '另一版本';
    assert.equal(compileWesternClaim(changedSource).reason, 'source_review_required');
  }
});

test('one confirmed angular luminary with the stated sign pair is required', () => {
  const facts = native(28, 14);
  const missingMoonHouse = facts.filter(f => !(f.kind === 'western_profile_planet_house' && f.planet === 'Moon'));
  const mixedHouse = [...facts, { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: 'Moon', house: 7 }];
  const mixedSign = [...facts, { kind: 'planet_sign', planet: 'Moon', sign: '双子座' }];
  const noRegio = facts.filter(f => f.kind !== 'western_profile_system');
  const falseDerived = [...missingMoonHouse, ...cardanoDignityFacts(facts)];
  for (const input of [native(28, 12), native(1, 20, 3), missingMoonHouse, mixedHouse, mixedSign, noRegio, falseDerived]) {
    assert.deepEqual(findMatches(lookup(query(input))), []);
    assert.equal(explain(sun, input).matched, false);
    assert.equal(explain(moon, input).matched, false);
  }
  for (const options of [{ timeKnown: false }, { scope: 'annual' }]) {
    assert.deepEqual(findMatches(lookup(query(facts, options))), []);
    assert.equal(explain(sun, facts, options).matched, false);
  }
  // Remove all derived caller input before exposing confirmed facts to report text.
  assert.ok(query(falseDerived)[0].confirmedFacts.every(f => f.kind !== 'western_cardano_dignity'));
});
