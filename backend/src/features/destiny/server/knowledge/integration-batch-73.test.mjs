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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-73-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofKey = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);
const factsAt = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witness = id => factsAt(fixture.witnesses.find(row => row.proofs.some(proof => proof.id === id)));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([query]) => chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'ziwei', context(queries(facts, timeKnown)), undefined, catalog);

test('each reviewed Family and Servants condition reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  const expected = new Map();
  let wholeRecords = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    const branches = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { text, inputs, conditionCompiler } of branches) {
      assert.equal(conditionCompiler, quanshuPalaceTextProfile);
      for (const input of inputs) expected.set(proofKey(id, text, digest(input)), input);
    }
  }
  assert.equal(ids.size, fixture.sourceRecords);
  assert.equal(wholeRecords, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(factsAt(sample));
    const chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const key = proofKey(id, text, inputDigest), input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id);
      const detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.deepEqual(detail.matchedBranches.map(branch => branch.text), [text], id);
        assert.deepEqual(hit.matchedBranches.map(branch => branch.text), [text], id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the Moon passage only uses the matching pair and needs a complete origin palace for exclusions', () => {
  const id = 'ziwei-v2-c013-p101006-003';
  const facts = witness(id);
  const refs = lookup(queries(facts));
  const hit = refs.flatMap(ref => [...ref.personality, ...ref.events]).find(row => row.id === id);
  const materials = buildReportMaterials([{ topic: hit.topic, events: [hit], personality: [] }]);
  assert.match(materials, /太阴同免刑/u);
  assert.doesNotMatch(materials, /天梁同无刑/u);
  const missingListCount = facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '父母');
  assert.equal(explain(id, missingListCount).matched, false);
  assert.equal(explain(id, facts, false).matched, false);
  const addedEarthVoid = [...facts, { kind: 'palace_star', palace: '父母', scope: 'origin', star: '地空' }]
    .map(f => f.kind === 'palace_origin_star_count' && f.palace === '父母' ? { ...f, count: f.count + 1 } : f);
  assert.equal(explain(id, addedEarthVoid).matched, false);
});

test('the spouse passage requires the Moon itself to be exalted at the couple’s shared seat', () => {
  const id = 'ziwei-v2-fuqigong-p101009-001';
  const facts = witness(id);
  assert.ok(facts.some(f => f.kind === 'palace_branch' && f.palace === '夫妻' && f.branch === '丑'));
  assert.equal(explain(id, facts).matched, true);
  const changed = facts.map(f => f.kind === 'palace_brightness' && f.palace === '夫妻' && f.star === '太阴'
    ? { ...f, brightness: '旺' } : f);
  assert.equal(explain(id, changed).matched, false);
});
