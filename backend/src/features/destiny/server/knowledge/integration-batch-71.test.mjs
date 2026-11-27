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

const { witnesses, alternatives, wholeRecords, sourceRecords } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-71-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const keyOf = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.events, ...ref.personality]);
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));

function queries(confirmedFacts, timeKnown = true) {
  const result = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(result);
  return result;
}

const chartFrom = ([query]) => chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'ziwei', chartFrom(queries(facts, timeKnown)), undefined, catalog);

test('all reviewed Palace of Wealth and Career conditions reach SQLite, explanation and report materials', () => {
  const rows = new Map([...new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))]
    .map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, sourceRecords);
  assert.equal([...rows.values()].filter(row => row.compiler === quanshuPalaceTextProfile).length, wholeRecords);
  const expected = new Map();
  for (const [id, row] of rows) {
    const entries = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { text, inputs, conditionCompiler } of entries) {
      assert.equal(conditionCompiler, quanshuPalaceTextProfile);
      for (const input of inputs) expected.set(keyOf(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += '异本';
    assert.equal(compileQuanshuPalaceText(changed).reason, 'source_review_required');
  }
  assert.equal(expected.size, alternatives);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness)), chart = chartFrom(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), matched = hits(refs), materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const key = keyOf(id, text, inputDigest), input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matched.find(item => item.id === id);
      const detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      assert.match(detail.calculationNote, /紫微斗数全书/u);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? rows.get(id).claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('a same-palace passage keeps the approved excerpt and an actual companion', () => {
  const id = 'ziwei-v2-caibogong-p101013-005';
  const facts = raw(witnessFor(id));
  const result = explain(id, facts);
  assert.deepEqual(result.matchedBranches.map(branch => branch.text), ['天同同白手成家']);
  assert.equal(explain(id, facts, false).matched, false);
  const elsewhere = facts.map(fact => fact.kind === 'palace_star' && fact.palace === '财帛' && fact.star === '天同'
    ? { ...fact, palace: '官禄' } : fact);
  assert.equal(explain(id, elsewhere).matched, false);
  const hit = hits(lookup(queries(facts))).find(hit => hit.id === id);
  assert.doesNotMatch(buildReportMaterials([{ topic: hit.topic, events: [hit], personality: [] }]), /九流人吉/u);
});

test('a named group on the four sectors needs every star and filters fabricated derived evidence', () => {
  const id = 'ziwei-v2-guanlugong-p101019-003';
  const facts = raw(witnessFor(id));
  assert.match(explain(id, facts).calculationNote, /会照核对本宫、对宫与两处三合宫/u);
  const withoutYouBi = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '右弼');
  const forged = { kind: 'palace_sector_star', palace: '官禄', star: '右弼' };
  assert.equal(explain(id, [...withoutYouBi, forged]).matched, false);
});

test('a fabricated zero cannot substitute for four complete origin-palace star lists', () => {
  const id = 'ziwei-v2-caibogong-p101005-002';
  const facts = raw(witnessFor(id));
  assert.match(explain(id, facts).calculationNote, /四处本命星曜资料齐备/u);
  const withoutCount = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
  const forged = { kind: 'palace_sector_benefic_count', palace: '财帛', count: 0 };
  assert.equal(explain(id, [...withoutCount, forged]).matched, false);
});
