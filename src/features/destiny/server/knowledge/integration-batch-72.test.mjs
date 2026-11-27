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
import { compileQuanshuPalaceText, quanshuPalaceTextProfile } from './ziwei-source-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-72-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));

function queries(confirmedFacts) {
  const parsed = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(parsed);
  return parsed;
}

function fromQuery([{ confirmedFacts, confirmedAbsentFacts, chartScope }]) {
  return chartContext('ziwei', confirmedFacts, confirmedAbsentFacts, chartScope);
}

const witness = id => raw(fixture.witnesses.find(row => row.proofs.some(proof => proof.id === id)));
const explain = (id, facts) => explainClaim(id, 'ziwei', fromQuery(queries(facts)), undefined, catalog);

test('each reviewed Property and Fortune condition reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let wholeRecords = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    for (const { text, inputs, conditionCompiler } of row.branches?.length
      ? row.branches : [{ inputs: row.inputs, conditionCompiler: row.compiler }]) {
      assert.equal(conditionCompiler, quanshuPalaceTextProfile, id);
      for (const input of inputs) {
        const inputDigest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
        expected.set(key({ id, text, inputDigest }), input);
      }
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += '异本';
    assert.equal(compileQuanshuPalaceText(changed).reason, 'source_review_required', id);
  }
  assert.equal(wholeRecords, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(raw(sample)), chart = fromQuery(parsed), derived = claimChartContext('ziwei', chart);
    const references = lookup(parsed), hits = references.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(references);
    for (const proof of sample.proofs) {
      const { id, text } = proof, condition = expected.get(key(proof));
      assert.ok(condition && evaluateRule(condition, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id);
      const detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
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

test('a benefic in a different palace does not meet the conjunction required by 加吉星', () => {
  const id = 'ziwei-v2-c011-p101003-002';
  const facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const benefics = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const moved = facts.map(fact => fact.kind === 'palace_star' && fact.palace === '田宅' && benefics.has(fact.star)
    ? { ...fact, palace: '兄弟' } : fact);
  assert.equal(explain(id, moved).matched, false);
});

test('the Property passage binds exaltation to the Moon and does not reuse another star’s brightness', () => {
  const id = 'ziwei-v2-c011-p101006-003';
  const facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const altered = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.palace !== '田宅' || fact.star !== '太阴');
  assert.equal(explain(id, altered).matched, false);
});
