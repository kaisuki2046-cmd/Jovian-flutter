import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { jielanPalacePassageProfile } from './ziwei-source-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-75-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const nativeFacts = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const prefix = 'ziwei-v2-jielan-101-';
const witness = (id, predicate = () => true) => nativeFacts(fixture.witnesses.find(row =>
  predicate(row) && row.proofs.some(proof => proof.id === prefix + id)));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(prefix + id, 'ziwei', context(queries(facts, timeKnown)), undefined, catalog);

test('all reviewed Jielan passages reach SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  const expected = new Map();
  let wholeRecords = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    for (const { text, inputs, conditionCompiler } of row.inputs
      ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, jielanPalacePassageProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.equal(ids.size, fixture.sourceRecords);
  assert.equal(wholeRecords, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(nativeFacts(sample)), chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, input = expected.get(key(proof));
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(key(proof));
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the two spouse passages require the indicated gender and a confirmed palace', () => {
  const id = 'p012-001';
  for (const [gender, text] of [['male', '男主妻小，性刚早婚'], ['female', '女主夫长']]) {
    const facts = witness(id, row => row.profile.gender === gender);
    assert.deepEqual(explain(id, facts).matchedBranches.map(row => row.text), [text]);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_gender')).matched, false);
    assert.equal(explain(id, facts, false).matched, false);
  }
});

test('a trine benefic cannot be supplied by the anchor palace or by a caller-provided derived fact', () => {
  const id = 'p010-009', facts = witness(id);
  const benefics = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  assert.equal(explain(id, facts).matched, true);
  const onlyAtAnchor = facts.map(fact =>
    fact.kind === 'palace_star' && ['官禄', '财帛'].includes(fact.palace) && benefics.has(fact.star)
      ? { ...fact, palace: '命宫' } : fact);
  const forged = { kind: 'palace_trine_star', palace: '命宫', star: '左辅' };
  assert.equal(explain(id, [...onlyAtAnchor, forged]).matched, false);
  const missingBranch = facts.filter(fact =>
    fact.kind !== 'palace_branch' || !['官禄', '财帛'].includes(fact.palace));
  assert.equal(explain(id, missingBranch).matched, false);
});

test('a clear spouse sector requires a complete star list in each of its four palaces', () => {
  const id = 'p012-003', facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '官禄');
  const forged = { kind: 'palace_sector_malefic_count', palace: '夫妻', count: 0 };
  assert.equal(explain(id, [...incomplete, forged]).matched, false);
});
