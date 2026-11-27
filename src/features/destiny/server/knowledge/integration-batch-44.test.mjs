import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { lillyAspectPhase } from './lilly-aspects.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { alternatives, witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-44-witnesses.json', import.meta.url)));
const ids = {
  angular: 'astro-lilly-v3-wealth-duration-p006-001', cadent: 'astro-lilly-v3-wealth-duration-p007-001',
  friends: 'astro-lilly-v3-friends-p020-001', servants: 'astro-lilly-v3-health-servants-p009-001',
  tenth: 'astro-lilly-v3-friends-p043-001', first: 'astro-lilly-v3-friends-p044-001',
};
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));
const isPhase = fact => ['western_lilly_aspect_phase', 'western_lilly_luminary_application'].includes(fact.kind);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();

function hit(id, facts, timeKnown = true) {
  const [parsed] = parseChartQueries([query(facts)], { timeKnown });
  return lookupInterpretations(catalogDirectory, parsed).find(row => row.id === id);
}

test('observed direction distinguishes Lilly application, perfection and departure by at least six minutes', () => {
  const p = (body, longitude, speed) => ({ body, longitude, speed });
  const check = (a, b, phase, table = 'main') => lillyAspectPhase(a, b, phase, table);
  assert.equal(check(p('mercury', 5, 0.06), p('mars', 10, 0.03), 'applying'), true);
  assert.equal(check(p('mercury', 10, -0.06), p('mars', 9, -0.03), 'applying'), true);
  assert.equal(check(p('mercury', 17, -0.04), p('mars', 15, 0.02), 'applying'), true);
  assert.equal(check(p('mars', 15, 0.02), p('mercury', 17, -0.04), 'applying'), true);
  assert.equal(check(p('mercury', 65, 0.06), p('mars', 10, 0.03), 'applying'), true);
  assert.equal(check(p('mercury', 355, 0.06), p('mars', 1, 0.03), 'applying'), true);
  assert.equal(check(p('sun', 9, 0.06), p('mercury', 10, 0.02), 'applying'), false);
  assert.equal(check(p('mercury', 9, 0.02), p('mars', 10, 0.06), 'applying'), false);
  assert.equal(check(p('mercury', 9, 0), p('mars', 10, -0.04), 'applying'), false);
  assert.equal(check(p('mercury', 10, 0.06), p('mars', 10, 0.03), 'applying'), false);
  assert.equal(check(p('mercury', 10, 0.06), p('mars', 10, 0.03), 'separating'), false);
  const saturn = p('saturn', 10 + 25 / 60, 0.005);
  assert.equal(check(p('jupiter', 10 + 30 / 60, 0.01), saturn, 'separating'), false);
  assert.equal(check(p('jupiter', 10 + 31 / 60, 0.01), saturn, 'separating'), true);
  assert.equal(check(p('jupiter', 9, -0.02), saturn, 'retrograde_separating'), true);
  assert.equal(check(p('jupiter', 11, 0.02), saturn, 'retrograde_separating'), false);
  const near = [p('mercury', 12.9, 0.06), p('mars', 20, 0.03)];
  assert.equal(check(...near, 'applying', 'main'), true);
  assert.equal(check(...near, 'applying', 'other'), false);
});

test('the six reviewed records reach SQLite, explanation and reporting under both original tables', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.remainingAlternatives, 0);
    return row.inputs.map(input => {
      assert.equal(new Set(input.required.filter(isPhase).map(fact => fact.table)).size, 1);
      return id + ':' + digest(input);
    });
  }));
  assert.equal(expected.size, 42);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = parseChartQueries([query(rawFacts(witness))]);
    assert.ok(parsed);
    const chart = chartContext('western', parsed[0].confirmedFacts);
    const required = witness.proofs.flatMap(({ id }) => rows.get(id).inputs.flatMap(input => input.required));
    const calculated = claimChartContext('western', chart, required);
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true);
      assert.ok(hits.some(hit => hit.id === id), id);
      assert.ok(explainClaim(id, 'western', chart, undefined, catalog).matched);
      assert.ok(materials.includes(row.claim.evidence.original_text));
      seen.add(id + ':' + inputDigest);
    }
  }
  assert.deepEqual(seen, expected);
});

test('luminary pairs and named palace rulers require observed motion and exact role evidence', () => {
  const raw = rawFacts(witnessFor(ids.angular));
  const original = hit(ids.angular, raw);
  const known = original.matchedConditions.required.filter(isPhase);
  assert.deepEqual(new Set(known.map(fact => fact.luminary)), new Set(['sun', 'moon']));
  assert.ok(known.every(fact => fact.houseClass === 'angular'));
  for (const planet of ['Sun', 'Moon']) {
    const missing = raw.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== planet);
    assert.equal(hit(ids.angular, [...missing, ...known]), undefined);
  }
  const sun = raw.find(fact => fact.kind === 'planet_hourly_motion' && fact.planet === 'Sun');
  assert.equal(hit(ids.angular, [...raw, { ...sun, signedDegrees: -sun.signedDegrees }]), undefined);
  assert.equal(hit(ids.angular, raw, false), undefined);

  const retrograde = rawFacts(witnessFor(ids.first));
  const asserted = hit(ids.first, retrograde).matchedConditions.required.find(isPhase);
  assert.equal(asserted.first, 'house_1_ruler');
  assert.equal(asserted.second, 'house_10_ruler');
  assert.equal(asserted.phase, 'retrograde_separating');
  const natal = retrograde.filter(fact => fact.kind !== 'western_profile_cusp_longitude');
  assert.equal(hit(ids.first, [...natal, asserted]), undefined);
});

test('the report distinguishes current phase from completion and changed originals stop compilation', async () => {
  const id = ids.angular;
  const chartQueries = parseChartQueries([query(rawFacts(witnessFor(id)))]);
  const lookup = queries => reportLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === id),
    events: reference.events.filter(hit => hit.id === id),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /太阳向位于角宫的行星入相/u);
      assert.match(materials, /月亮向位于角宫的行星入相/u);
      assert.match(materials, /未判断之后能否完成相位/u);
      return '入相测试报告';
    },
  });
  assert.equal(report, '入相测试报告');
  for (const reviewedId of Object.values(ids)) {
    const edited = structuredClone(catalog.get(reviewedId).claim);
    edited.conditions.normalized.push('异本条件');
    assert.equal(compileWesternClaim(edited).reason, 'source_review_required');
  }
});
