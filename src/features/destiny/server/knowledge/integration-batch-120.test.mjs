import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyAspectPhase } from './lilly-aspects.mjs';
import { compileLillyProfessionSource, lillyProfessionSourcesProfile } from './lilly-profession-sources.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-120-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-profession-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-configurations-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-configurations-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = (id, input) => id + ':' + hash(input);
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}
const refs = parsed => lookup([parsed]).flatMap(ref => [...ref.personality, ...ref.events]);
const explain = (n, facts) => explainClaim(prefix + n, 'western', context(query(facts)), undefined, catalog);
const sampleFor = n => fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === prefix + n));

test('all reviewed career configurations reach SQLite, explanation and reports from native charts', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyProfessionSourcesProfile, id);
    for (const input of row.inputs) {
      const all = [...input.required, ...input.anyOf.flat()];
      assert.ok(new Set(all.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.original_text += ' changed';
    assert.equal(compileLillyProfessionSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(nativeFacts(sample)), observed = context(parsed);
    const reference = lookup([parsed]);
    const hits = reference.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(reference);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest, input = expected.get(proof);
      assert.ok(input, proof);
      const hit = hits.find(row => row.id === id);
      const requests = [...input.required, ...input.anyOf.flat()];
      const chart = claimChartContext('western', observed, requests, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /职业篇由前两步/u);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.ok(refs(query(nativeFacts(fixture.witnesses[0]), false)).every(row => !ids.has(row.id)));
});

test('Jupiter must testify to both professional planets in the same orb table', () => {
  const n = '012-001', facts = nativeFacts(sampleFor(n));
  const detail = explain(n, facts);
  assert.equal(detail.matched, true);
  const alternatives = detail.matchedConditions.alternatives;
  assert.ok(alternatives.some(group => group.filter(fact => fact.first === 'jupiter' && fact.aspect === 'friendly').length === 2));
  const missing = facts.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Jupiter');
  assert.equal(explain(n, missing).matched, false);
  assert.ok(refs(query(missing)).every(hit => hit.id !== prefix + n));
});

test('a good lunar application uses its own phase, sign and genuine motions', () => {
  const n = '044-001', facts = nativeFacts(sampleFor(n));
  const detail = explain(n, facts);
  assert.equal(detail.matched, true);
  const phase = detail.matchedConditions.required.find(fact => fact.kind === 'western_lilly_aspect_phase');
  assert.match(factText(phase), /月亮向水星入合相、六合或三合/u);
  const missingMoonMotion = facts.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== 'Moon');
  assert.equal(explain(n, [...missingMoonMotion, phase]).matched, false);
  assert.ok(refs(query([...missingMoonMotion, phase])).every(hit => hit.id !== prefix + n));
  const target = { body: 'mercury', longitude: 30, speed: 0.05 };
  const closingSquare = { body: 'moon', longitude: 116, speed: 0.54 };
  const closingSextile = { ...closingSquare, longitude: 86 };
  const phaseName = 'applying_friendly_or_conjunction';
  assert.equal(lillyAspectPhase(closingSquare, target, 'applying', 'main'), true);
  assert.equal(lillyAspectPhase(closingSquare, target, phaseName, 'main'), false);
  assert.equal(lillyAspectPhase(closingSextile, target, phaseName, 'main'), true);
  assert.equal(lillyAspectPhase({ ...closingSextile, longitude: 94 }, target, phaseName, 'main'), false);
});

test('the same-sign conjunction requires an unambiguous retrograde Mercury', () => {
  const n = '064-001', facts = nativeFacts(sampleFor(n));
  assert.equal(explain(n, facts).matched, true);
  const both = [...facts, { kind: 'planet_motion', planet: 'Mercury', motion: 'direct' }];
  assert.equal(explain(n, both).matched, false);
  assert.ok(refs(query(both)).every(hit => hit.id !== prefix + n));
});
