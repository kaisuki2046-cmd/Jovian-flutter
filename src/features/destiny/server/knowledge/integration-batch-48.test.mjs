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

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-48-witnesses.json', import.meta.url)));
const sourceId = suffix => 'ziwei-v2-jielan-101-' + suffix;
const ids = [
  'p010-004', 'p010-008', 'p010-020', 'p010-022', 'p010-023', 'p010-025', 'p010-026', 'p010-031', 'p010-032', 'p010-039', 'p010-041',
  'p011-002', 'p011-007', 'p011-008', 'p011-009', 'p011-011', 'p011-012', 'p011-030', 'p011-035',
  'p012-005',
  'p013-010', 'p013-011',
  'p016-003', 'p016-004', 'p016-025',
  'p017-015',
  'p021-001', 'p021-006', 'p021-011', 'p021-016', 'p021-028',
].map(sourceId);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const witnessFor = (suffix, text) => witnesses.find(witness => witness.proofs.some(proof =>
  proof.id === sourceId(suffix) && (!text || proof.text?.startsWith(text))));
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const cases = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(suffix, facts, timeKnown = true) {
  const [parsed] = queries(facts, timeKnown);
  return explainClaim(sourceId(suffix), 'ziwei', chartContext('ziwei', parsed.confirmedFacts), undefined, catalog);
}

test('all new whole sources and excerpts keep their native condition groups through SQLite and report lookup', () => {
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 31);
  assert.equal([...rows.values()].filter(row => row.compiler === jielanPalacePassageProfile).length, 5);
  const expected = new Set([...rows].flatMap(([id, row]) => cases(row).flatMap(({ text, inputs, conditionCompiler }) => {
    if (text) assert.equal(conditionCompiler, jielanPalacePassageProfile);
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 76);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = chartContext('ziwei', parsed[0].confirmedFacts);
    const calculated = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = cases(row).find(entry => entry.text === text)?.inputs.find(input => digest(input) === inputDigest);
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

test('unnamed migration transformations require a real host in the same natal palace', () => {
  const subjects = {
    禄: '廉贞 天机 天同 太阴 贪狼 武曲 太阳 巨门 天梁 破军',
    权: '破军 天梁 天机 天同 太阴 贪狼 武曲 太阳 紫微 巨门',
  };
  for (const [suffix, change] of [['p016-003', '禄'], ['p016-004', '权']]) {
    const row = catalog.get(sourceId(suffix));
    const actors = row.inputs.map(({ required }) => {
      const [role] = required.filter(fact => fact.kind === 'star_mutagen');
      const [anchor] = required.filter(fact => fact.kind === 'palace_star');
      assert.equal(role.palace, '迁移');
      assert.equal(role.change, change);
      assert.equal(role.star, anchor.star);
      assert.equal(role.palace, anchor.palace);
      return role.star;
    });
    assert.deepEqual(new Set(actors), new Set(subjects[change].split(' ')));
    const facts = raw(witnessFor(suffix));
    const role = facts.find(fact => fact.kind === 'star_mutagen' && fact.change === change && fact.palace === '迁移');
    assert.ok(role && explain(suffix, facts).matched);
    assert.ok(facts.some(fact => fact.kind === 'palace_mutagen' && fact.change === change && fact.palace === '迁移'));
    assert.equal(explain(suffix, facts.filter(fact => fact !== role)).matched, false);
    assert.equal(explain(suffix, facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== role.star || fact.palace !== '迁移')).matched, false);
    assert.equal(explain(suffix, [...facts, { ...role, star: '天府' }]).matched, false);
    assert.equal(explain(suffix, facts, false).matched, false);
  }
});

test('explicit auxiliaries share the natal palace while an either-or group remains independent', () => {
  const brother = 'p011-030';
  const facts = raw(witnessFor(brother));
  assert.ok(explain(brother, facts).matched);
  for (const star of ['左辅', '右弼', '文曲']) {
    const moved = facts.map(fact => fact.kind === 'palace_star' && fact.palace === '兄弟' && fact.star === star
      ? { ...fact, palace: '夫妻' } : fact);
    assert.equal(explain(brother, moved).matched, false);
  }
  const support = 'p017-015';
  const row = catalog.get(sourceId(support));
  assert.deepEqual(new Set(row.inputs.map(input => input.required[0].star)), new Set(['左辅', '右弼']));
  for (const input of row.inputs) {
    const { star } = input.required[0];
    const witness = witnesses.find(witness => witness.proofs.some(proof =>
      proof.id === sourceId(support) && proof.inputDigest === digest(input)));
    const facts = raw(witness).filter(fact => fact.kind !== 'palace_star' || fact.palace !== '仆役' || !['左辅', '右弼'].includes(fact.star) || fact.star === star);
    assert.ok(explain(support, facts).matched);
  }
});

test('reports use the proved branch and changed sources require review', async () => {
  const suffix = 'p010-008';
  const facts = raw(witnessFor(suffix, '庙旺')).filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '天机');
  const select = parsed => lookup(parsed).map(ref => ({ ...ref,
    personality: ref.personality.filter(hit => hit.id === sourceId(suffix)), events: ref.events.filter(hit => hit.id === sourceId(suffix)),
  }));
  const { report } = await generateReport({ chartQueries: queries(facts) }, {
    lookup: select, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /庙旺，主人性急好善/u);
      assert.doesNotMatch(materials, /如化吉，富贵|陷地，多奸诈/u);
      return '捷览本命证据测试';
    },
  });
  assert.equal(report, '捷览本命证据测试');
  for (const id of ids) {
    const altered = structuredClone(catalog.get(id).claim);
    altered.evidence.context += '异本';
    assert.equal(compileJielanPalacePassages(altered).reason, 'source_review_required');
  }
});
