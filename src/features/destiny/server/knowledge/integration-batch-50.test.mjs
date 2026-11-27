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
import { compileZiweiSourceExclusions, ziweiSourceExclusionProfile } from './ziwei-source-exclusions.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-50-witnesses.json', import.meta.url)));
const jielan = suffix => 'ziwei-v2-jielan-101-' + suffix;
const ids = [
  ...['p010-029', 'p011-020', 'p012-022', 'p014-018', 'p017-019', 'p018-006', 'p018-020', 'p018-026', 'p021-021'].map(jielan),
  'ziwei-v2-fuqigong-p101011-002',
  'ziwei-v2-c013-p101014-003',
  'ziwei-v2-c011-p101013-003',
  'ziwei-v2-guanlugong-p008-002',
  'ziwei-v3-xingjue-032-p1263-001',
  'ziwei-v3-xingjue-049-p621-001',
];
const countId = 'ziwei-v3-xingjue-049-p621-001';
const absenceId = 'ziwei-v2-c011-p101013-003';
const localId = 'ziwei-v3-xingjue-032-p1263-001';
const profiles = [jielanPalacePassageProfile, ziweiSourceExclusionProfile];
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inputsOf = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const witnessFor = (id, text) => witnesses.find(witness => witness.proofs.some(proof =>
  proof.id === id && (!text || proof.text?.startsWith(text))));
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));

function queries(confirmedFacts, confirmedAbsentFacts = [], timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts, confirmedAbsentFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context(query) {
  return chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts);
}

function explain(id, facts, absent = [], timeKnown = true) {
  return explainClaim(id, 'ziwei', context(queries(facts, absent, timeKnown)[0]), undefined, catalog);
}

test('all reviewed source and passage groups reach SQLite, explanation and report from native charts', () => {
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 15);
  assert.equal([...rows.values()].filter(row => profiles.includes(row.compiler)).length, 4);
  const expected = new Set([...rows].flatMap(([id, row]) => inputsOf(row).flatMap(({ text, inputs, conditionCompiler }) => {
    if (text) assert.ok(profiles.includes(conditionCompiler));
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 34);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = context(parsed[0]);
    const calculated = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = inputsOf(row).find(entry => entry.text === text)?.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input, id);
      assert.ok(evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && explanation.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
      seen.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(seen, expected);
});

test('sector-wide exclusions require complete native evidence and reject either excluded pair', () => {
  const facts = raw(witnessFor(absenceId));
  const row = catalog.get(absenceId);
  const exclusions = row.inputs[0].mustBeAbsent;
  assert.equal(exclusions.length, 6);
  const hit = explain(absenceId, facts);
  assert.ok(hit.matched);
  assert.match(hit.calculationNote, /四处本命星曜齐备/u);
  assert.equal(explain(absenceId, facts, [], false).matched, false);
  const opposite = facts.find(fact => fact.kind === 'palace_relation' && fact.anchor === '田宅' && fact.relation === 'opposite');
  assert.ok(opposite);
  const partial = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== opposite.target);
  assert.equal(explain(absenceId, partial, exclusions).matched, false);
  for (const star of ['火星', '地空']) {
    const staged = facts.map(fact => fact.kind === 'palace_origin_star_count' && fact.palace === opposite.target
      ? { ...fact, count: fact.count + 1 } : fact);
    staged.push({ kind: 'palace_star', palace: opposite.target, star, scope: 'origin' });
    assert.equal(explain(absenceId, staged, exclusions).matched, false);
  }
});

test('local exclusions and exactly two stars remain separate from the wider or incomplete chart', () => {
  const local = raw(witnessFor(localId));
  const red = local.find(fact => fact.kind === 'palace_star' && fact.star === '红鸾');
  assert.ok(red && explain(localId, local).matched);
  const changed = local.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== red.palace);
  assert.equal(explain(localId, changed).matched, false);

  const facts = raw(witnessFor(countId, '加四殺'));
  const full = explain(countId, facts);
  assert.ok(full.matchedBranches.some(branch => branch.text.startsWith('加四殺')));
  assert.ok(full.matchedBranches.some(branch => branch.text.startsWith('妻宮')));
  const fakeCount = { kind: 'palace_sector_malefic_count', palace: '夫妻', count: 2 };
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '夫妻');
  const base = explain(countId, [...incomplete, fakeCount]);
  assert.equal(base.matchedBranches.length, 1);
  assert.match(base.matchedBranches[0].text, /^妻宮/u);
  const sector = new Set(['夫妻', ...facts.filter(fact => fact.kind === 'palace_relation' && fact.anchor === '夫妻'
    && ['trine', 'opposite'].includes(fact.relation)).map(fact => fact.target)]);
  const outside = facts.find(fact => fact.kind === 'palace_star' && ['擎羊', '陀罗', '火星', '铃星'].includes(fact.star)
    && !sector.has(fact.palace));
  assert.ok(outside);
  const third = facts.map(fact => {
    if (fact === outside) return { ...fact, palace: '夫妻' };
    if (fact.kind !== 'palace_origin_star_count') return fact;
    if (fact.palace === '夫妻') return { ...fact, count: fact.count + 1 };
    if (fact.palace === outside.palace) return { ...fact, count: fact.count - 1 };
    return fact;
  });
  assert.deepEqual(explain(countId, third).matchedBranches.map(branch => branch.text), base.matchedBranches.map(branch => branch.text));
});

test('a paired label uses the actual star and the actual brightness, and provider excerpts stay separate', async () => {
  const id = jielan('p018-020');
  const facts = raw(witnessFor(id, '庙'));
  const source = explain(id, facts);
  const matched = source.matchedBranches.find(branch => branch.text.startsWith('庙'));
  assert.ok(matched);
  const level = matched.matchedConditions.required.find(fact => fact.kind === 'palace_brightness');
  const other = level.star === '擎羊' ? '陀罗' : '擎羊';
  const without = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.palace !== level.palace || fact.star !== level.star);
  assert.equal(explain(id, [...without, { ...level, star: other }]).matched, false);

  const select = parsed => lookup(parsed).map(ref => ({ ...ref,
    personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
  }));
  const { report } = await generateReport({ chartQueries: queries(facts) }, {
    lookup: select, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /庙，权贵，武职/u);
      assert.doesNotMatch(materials, /奔波度日/u);
      return '四煞分句取材测试';
    },
  });
  assert.equal(report, '四煞分句取材测试');
  for (const sourceId of ids) {
    const altered = structuredClone(catalog.get(sourceId).claim);
    altered.evidence.context += '异本';
    const compiled = compileJielanPalacePassages(altered) ?? compileZiweiSourceExclusions(altered);
    assert.equal(compiled.reason, 'source_review_required');
  }
});
