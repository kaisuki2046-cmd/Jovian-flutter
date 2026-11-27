import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileJielanPalacePassages, jielanPalacePassageProfile } from './ziwei-source-passages.mjs';

const { alternatives, witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-47-witnesses.json', import.meta.url)));
const sourceId = suffix => 'ziwei-v2-jielan-101-' + suffix;
const ids = [
  'p014-003', 'p014-004', 'p014-005', 'p014-006', 'p014-008', 'p014-009', 'p014-012', 'p014-014', 'p014-015', 'p014-016',
  'p017-003', 'p017-011',
  'p018-001', 'p018-003', 'p018-005', 'p018-008', 'p018-009', 'p018-010', 'p018-011', 'p018-012', 'p018-013', 'p018-014', 'p018-015', 'p018-016', 'p018-019',
  'p019-001', 'p019-002', 'p019-004', 'p019-006', 'p019-008', 'p019-009', 'p019-012', 'p019-013',
].map(sourceId);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const witnessFor = (suffix, text) => witnesses.find(({ proofs }) =>
  proofs.some(proof => proof.id === sourceId(suffix) && (!text || proof.text?.startsWith(text))));
const rawFacts = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(suffix, facts, timeKnown = true) {
  const [query] = queries(facts, timeKnown);
  return explainClaim(sourceId(suffix), 'ziwei', chartContext('ziwei', query.confirmedFacts), undefined, catalog);
}

test('all 33 Jielan records and 51 condition groups reach SQLite, explanation and report materials', () => {
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  const whole = [...rows.values()].filter(row => row.compiler === jielanPalacePassageProfile);
  assert.equal(whole.length, 2);
  assert.equal(rows.size - whole.length, 31);
  const cases = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
  const expected = new Set([...rows].flatMap(([id, row]) => cases(row).flatMap(({ text, inputs, conditionCompiler }) => {
    if (text) assert.equal(conditionCompiler, jielanPalacePassageProfile);
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 51);
  assert.equal(alternatives, expected.size);
  const proved = new Set();
  for (const witness of witnesses) {
    const parsed = queries(rawFacts(witness));
    const chart = chartContext('ziwei', parsed[0].confirmedFacts);
    const calculated = claimChartContext('ziwei', chart);
    const references = lookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const condition = cases(row).find(item => item.text === text && item.inputs.some(input => digest(input) === inputDigest));
      assert.ok(condition, id);
      const input = condition.inputs.find(input => digest(input) === inputDigest);
      assert.ok(evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      assert.ok(hit, id);
      const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(explanation.matched, id);
      if (text) {
        assert.equal(hit.matchScope, 'passage_branch');
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
      proved.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(proved, expected);
});

test('bright and fallen readings stay separate and conflicting or unknown observations cannot establish either', () => {
  const suffix = 'p014-012';
  for (const [start, contradictory] of [['庙旺', '陷'], ['陷地', '庙']]) {
    const facts = rawFacts(witnessFor(suffix, start));
    const result = explain(suffix, facts);
    assert.ok(result.matched);
    assert.equal(result.matchedBranches.length, 1);
    assert.ok(result.matchedBranches[0].text.startsWith(start));
    const isEvidence = fact => fact.kind === 'palace_brightness' && fact.palace === '财帛' && fact.star === '太阴';
    const evidence = facts.find(isEvidence);
    assert.ok(evidence);
    assert.equal(explain(suffix, facts.filter(fact => !isEvidence(fact))).matched, false);
    assert.equal(explain(suffix, [...facts, { ...evidence, brightness: contradictory }]).matched, false);
    assert.equal(explain(suffix, facts, false).matched, false);
  }
});

test('four storage branches and own benefic transformations require the stated palace and actor', () => {
  const greedy = 'p014-004';
  const four = rawFacts(witnessFor(greedy));
  const position = four.find(fact => fact.kind === 'palace_branch' && fact.palace === '财帛');
  assert.ok(explain(greedy, four).matched);
  assert.equal(explain(greedy, [...four, { ...position, branch: '子' }]).matched, false);
  assert.equal(explain(greedy, four.filter(fact => fact !== position)).matched, false);

  const martial = 'p014-003';
  const raw = rawFacts(witnessFor(martial));
  const mutagen = raw.find(fact => fact.kind === 'star_mutagen' && fact.palace === '财帛' && fact.star === '武曲');
  assert.ok(mutagen);
  assert.ok(explain(martial, raw).matched);
  assert.equal(explain(martial, raw.map(fact => fact === mutagen ? { ...fact, star: '天府' } : fact)).matched, false);
  assert.equal(explain(martial, [...raw, { ...mutagen, change: '忌' }]).matched, false);

  const literary = 'p014-016';
  const facts = rawFacts(witnessFor(literary, '入庙'));
  assert.ok(explain(literary, facts).matched);
  assert.match(explain(literary, facts).calculationNote, /明度取本宫文曲/u);
  const replaced = facts.filter(fact => !(fact.kind.startsWith('palace_') && fact.palace === '财帛' && fact.star === '文曲'));
  assert.equal(explain(literary, [...replaced, { kind: 'palace_brightness', palace: '财帛', star: '文昌', scope: 'origin', brightness: '庙' }]).matched, false);
});

test('report requests include only proved excerpts and a changed edition does not compile', async () => {
  const suffix = 'p018-009';
  const references = value => lookup(value).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === sourceId(suffix)),
    events: reference.events.filter(hit => hit.id === sourceId(suffix)),
  }));
  const { report } = await generateReport({ chartQueries: queries(rawFacts(witnessFor(suffix))) }, {
    lookup: references, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /陷，不久/u);
      assert.match(materials, /只使用已命中的分句/u);
      assert.doesNotMatch(materials, /一品大贵|遇左右昌曲月/u);
      return '《捷览》分句测试报告';
    },
  });
  assert.equal(report, '《捷览》分句测试报告');
  for (const id of ids) {
    const revised = structuredClone(catalog.get(id).claim);
    revised.conditions.normalized.push('更改前置条件');
    const result = compileJielanPalacePassages(revised);
    assert.equal(result.reason, 'source_review_required');
    assert.equal(result.branches, undefined);
    assert.equal(result.inputs, undefined);
  }
});
