import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { alternatives, witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-45-witnesses.json', import.meta.url)));
const ids = {
  angular: 'astro-lilly-v3-preferment-p046-001', succedent: 'astro-lilly-v3-preferment-p047-001',
  common: 'astro-lilly-v3-spouse-count-p012-001', fruitful: 'astro-lilly-v3-spouse-count-p013-001',
  seventh: 'astro-lilly-v3-spouse-count-p014-001', doubleBodied: 'astro-lilly-v3-women-marriage-p017-001',
};
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isPhase = fact => fact.kind === 'western_lilly_aspect_phase';
const isSignClass = fact => fact.kind === 'western_lilly_sign_class';
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)),
  { kind: 'natal_gender', gender: witness.gender }];

function queries(facts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: facts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(id, facts, timeKnown = true) {
  const [query] = queries(facts, timeKnown);
  return explainClaim(id, 'western', chartContext('western', query.confirmedFacts), undefined, catalog);
}

test('every reviewed position-and-application group reaches SQLite, explanation and report materials', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.remainingAlternatives, 0);
    return row.inputs.map(input => {
      if (id !== ids.doubleBodied) {
        const [phase] = input.required.filter(isPhase);
        assert.ok(phase);
        assert.equal(phase.phase, 'applying');
        if (id === ids.angular || id === ids.succedent) {
          const exaltation = input.required.find(fact => fact.kind === 'western_lilly_dignity');
          assert.equal(phase.first, 'house_1_ruler');
          assert.equal(exaltation.planet.toLowerCase(), phase.second);
          assert.equal(exaltation.dignity, 'exaltation');
        } else {
          assert.equal(phase.first, 'moon');
          assert.ok(input.required.some(fact => isSignClass(fact) && fact.selector === phase.second));
        }
      }
      return id + ':' + digest(input);
    });
  }));
  assert.equal(expected.size, 66);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(rawFacts(witness));
    const chart = chartContext('western', parsed[0].confirmedFacts);
    const requested = witness.proofs.flatMap(({ id }) => rows.get(id).inputs.flatMap(input => input.required));
    const calculated = claimChartContext('western', chart, requested, (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true, id);
      assert.ok(hits.some(hit => hit.id === id), id);
      assert.ok(explainClaim(id, 'western', chart, undefined, catalog).matched, id);
      assert.ok(materials.includes(row.claim.evidence.original_text), id);
      seen.add(id + ':' + inputDigest);
    }
  }
  assert.deepEqual(seen, expected);
});

test('house class and seventh-cusp evidence must come from the natal chart', () => {
  const angular = rawFacts(witnessFor(ids.angular));
  assert.ok(explain(ids.angular, angular).matched);
  assert.equal(explain(ids.succedent, angular).matched, false);
  assert.equal(explain(ids.angular, angular, false).matched, false);
  const withoutCusps = angular.filter(fact => fact.kind !== 'western_profile_cusp_longitude');
  assert.equal(explain(ids.angular, [...withoutCusps,
    { kind: 'western_lilly_ruler_house_class', house: 1, houseClass: 'angular' }]).matched, false);

  const seventh = rawFacts(witnessFor(ids.seventh));
  assert.ok(explain(ids.seventh, seventh).matched);
  assert.ok(explain(ids.fruitful, seventh).matched);
  const cusp = seventh.find(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 7);
  assert.ok(cusp);
  assert.equal(explain(ids.seventh, [...seventh, { ...cusp, longitude: (cusp.longitude + 15) % 360 }]).matched, false);
  const withoutMoonMotion = seventh.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== 'Moon');
  assert.equal(explain(ids.seventh, withoutMoonMotion).matched, false);
});

test('historical marriage conditions require one confirmed gender and keep the Sun and Mars alternatives independent', () => {
  for (const id of [ids.seventh, ids.doubleBodied]) {
    const raw = rawFacts(witnessFor(id));
    const nongendered = raw.filter(fact => fact.kind !== 'natal_gender');
    const otherGender = id === ids.seventh ? '女' : '男';
    assert.ok(explain(id, raw).matched);
    assert.equal(explain(id, nongendered).matched, false);
    assert.equal(explain(id, [...nongendered, { kind: 'natal_gender', gender: otherGender }]).matched, false);
    assert.equal(explain(id, [...raw, { kind: 'natal_gender', gender: otherGender }]).matched, false);
  }
  const row = catalog.get(ids.doubleBodied);
  for (const input of row.inputs) {
    const ownSelector = input.required.find(isSignClass).selector;
    const otherPlanet = ownSelector === 'sun' ? 'Mars' : 'Sun';
    const witness = witnesses.find(sample => sample.proofs.some(proof => proof.id === ids.doubleBodied && proof.inputDigest === digest(input)));
    const raw = rawFacts(witness).filter(fact => fact.planet !== otherPlanet);
    assert.ok(explain(ids.doubleBodied, raw).matched);
    assert.equal(explain(ids.doubleBodied, raw.filter(fact => fact.planet?.toLowerCase() !== ownSelector)).matched, false);
  }
});

test('reports label historical marriage evidence and changed sources require review', async () => {
  const id = ids.seventh;
  const chartQueries = queries(rawFacts(witnessFor(id)));
  const lookup = value => reportLookup(value).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === id),
    events: reference.events.filter(hit => hit.id === id),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /多产座/u);
      assert.match(materials, /现实婚姻次数以本人经历为准/u);
      assert.match(materials, /未判断之后能否完成相位/u);
      return '婚姻取象测试报告';
    },
  });
  assert.equal(report, '婚姻取象测试报告');
  for (const reviewedId of Object.values(ids)) {
    const claim = structuredClone(catalog.get(reviewedId).claim);
    claim.conditions.normalized.push('异本条件');
    assert.equal(compileWesternClaim(claim).reason, 'source_review_required');
  }
});
