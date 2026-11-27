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
import { quanshuPalaceTextProfile } from './ziwei-source-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-74-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const inputDigest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofKey = (id, text, digest) => JSON.stringify([id, text ?? null, digest]);
const nativeFacts = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));

function queries(facts) {
  const result = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts: facts,
  }]);
  assert.ok(result);
  return result;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts) => explainClaim(id, 'ziwei', context(queries(facts)), undefined, catalog);
const witness = id => nativeFacts(fixture.witnesses.find(row => row.proofs.some(proof => proof.id === id)));

test('reviewed Siblings, Children and Travel conditions reach SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let wholeRecords = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    for (const { text, inputs, conditionCompiler } of row.inputs
      ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, quanshuPalaceTextProfile, id);
      for (const input of inputs) expected.set(proofKey(id, text, inputDigest(input)), input);
    }
  }
  assert.equal(wholeRecords, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(nativeFacts(sample)), chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const key = proofKey(id, text, inputDigest), input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.deepEqual(hit.matchedBranches.map(branch => branch.text), [text], id);
        assert.deepEqual(detail.matchedBranches.map(branch => branch.text), [text], id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('a Sun in the Children palace needs an actual yang branch', () => {
  const id = 'ziwei-v2-c005-p101003-003';
  const facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const missing = facts.filter(f => f.kind !== 'palace_branch' || f.palace !== '子女');
  assert.equal(explain(id, missing).matched, false);
  assert.equal(explain(id, [...missing, { kind: 'palace_branch', palace: '子女', branch: '亥' }]).matched, false);
});

test('the Travel passage with named stars requires all three witnesses in the same four-palace sector', () => {
  const id = 'ziwei-v2-c008-p101014-004';
  const facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const withoutWenQu = facts.filter(f => f.kind !== 'palace_star' || f.star !== '文曲');
  const forged = { kind: 'palace_sector_star', palace: '迁移', star: '文曲' };
  assert.equal(explain(id, [...withoutWenQu, forged]).matched, false);
});
