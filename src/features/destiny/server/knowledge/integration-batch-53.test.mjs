import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjSeasonalPassages, qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-53-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const keyOf = (id, text, inputDigest) => JSON.stringify([id, text, inputDigest]);
const passages = row => row.inputs ? [{ text: null, inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
const rawAt = instant => chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000));
const raw = witness => rawAt(Date.parse(witness.birthTime));
const ids = {
  doubleFire: 'qtbj-v2-c004-p010-001',
  noFire: 'qtbj-v2-c013-p003-301',
  fixedPillars: 'qtbj-v3-c018-p005-301',
  variants: 'qtbj-v3-c019-p001-101',
  metalTrine: 'qtbj-v4-c060-p006-401',
  pairedStemBranch: 'qtbj-v6-c096-p001-101',
};

function queries(confirmedFacts, { timeKnown = true, confirmedAbsentFacts = [] } = {}) {
  const result = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts, confirmedAbsentFacts }], { timeKnown });
  assert.ok(result);
  return result;
}

function context(query) {
  return chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts);
}

function explain(id, facts, options) {
  return explainClaim(id, 'bazi', context(queries(facts, options)[0]), undefined, catalog);
}

const allHits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
function witnessFor(id, excerpt = '') {
  const witness = witnesses.find(witness => witness.proofs.some(proof => proof.id === id && (proof.text ?? '').startsWith(excerpt)));
  assert.ok(witness, id);
  return witness;
}

test('all seasonal pillar alternatives reach the SQLite catalog, explanation and report materials', () => {
  const rows = new Map([...new Set(witnesses.flatMap(w => w.proofs.map(p => p.id)))].map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 32);
  assert.equal([...rows.values()].filter(row => row.inputs).length, 8);
  assert.equal([...rows.values()].reduce((sum, row) => sum + row.branches.length, 0), 42);
  const expected = new Map([...rows].flatMap(([id, row]) => passages(row).flatMap(({ text, inputs, conditionCompiler }) => {
    assert.equal(conditionCompiler, qtbjSeasonalPassageProfile);
    if (text) assert.ok(row.claim.evidence.original_text.includes(text));
    return inputs.map(input => [keyOf(id, text, digest(input)), input]);
  })));
  assert.equal(expected.size, 443);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = context(parsed[0]);
    const calculated = claimChartContext('bazi', chart);
    const refs = lookup(parsed);
    const hits = allHits(refs);
    const materials = buildReportMaterials(refs);
    for (const { id, text, digest: inputDigest } of witness.proofs) {
      const key = keyOf(id, text, inputDigest);
      const input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      const explanation = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.ok(hit && explanation.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? rows.get(id).claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('hiding a stem is distinct from absence everywhere and unknown hours cannot prove the latter', () => {
  const trine = raw(witnessFor(ids.metalTrine));
  assert.ok(trine.some(fact => fact.kind === 'hidden_ten_god' && fact.stem === '丙'));
  assert.ok(trine.filter(fact => fact.kind === 'stem' && fact.position !== 'day').every(fact => !'丙丁'.includes(fact.stem)));
  assert.ok(explain(ids.metalTrine, trine).matched);
  const missingBranch = trine.find(fact => fact.kind === 'branch' && fact.branch === '巳').position;
  assert.equal(explain(ids.metalTrine, trine.filter(fact => fact.position !== missingBranch)).matched, false);

  const absent = raw(witnessFor(ids.noFire));
  assert.ok(explain(ids.noFire, absent).matched);
  assert.equal(explain(ids.noFire, absent, { timeKnown: false }).matched, false);
  const yearStem = absent.find(fact => fact.kind === 'stem' && fact.position === 'year');
  const declared = absent.filter(fact => fact !== yearStem);
  assert.equal(explain(ids.noFire, declared, { confirmedAbsentFacts: [yearStem] }).reason, 'conflicting_pillars');
});

test('counted exposure and fixed pillars use their actual positions and reject conflicting observations', () => {
  const repeated = raw(witnessFor(ids.doubleFire));
  const exposure = repeated.filter(fact => fact.kind === 'stem' && fact.stem === '丙' && fact.position !== 'day');
  assert.equal(exposure.length, 2);
  assert.equal(explain(ids.doubleFire, repeated.filter(fact => fact.position !== exposure[0].position)).matched, false);

  const example = witnessFor(ids.fixedPillars);
  const exact = raw(example);
  assert.ok(explain(ids.fixedPillars, exact).matched);
  assert.equal(explain(ids.fixedPillars, rawAt(Date.parse(example.birthTime) + 2 * 3600000)).matched, false);
  const conflicting = [...exact, { kind: 'stem', position: 'year', stem: '丁' }];
  assert.equal(explain(ids.fixedPillars, conflicting).reason, 'conflicting_pillars');
  assert.ok(!allHits(lookup(queries(conflicting))).some(hit => hit.id === ids.fixedPillars));
});

test('丙坐寅 requires the full pillar with the stem and branch in the same column', () => {
  const facts = raw(witnessFor(ids.pairedStemBranch, '或庚戊藏支'));
  const samePillar = facts.find(fact => fact.kind === 'pillar' && fact.ganZhi === '丙寅');
  assert.ok(samePillar);
  const changed = facts.filter(fact => fact.kind !== 'pillar' || fact.ganZhi !== '丙寅');
  const matches = explain(ids.pairedStemBranch, changed).matchedBranches;
  assert.ok(!matches.some(branch => branch.text.startsWith('或庚戊藏支')));
});

test('only the matching variant reaches the provider and changed primary text requires source review', async () => {
  const id = ids.variants;
  const { report } = await generateReport({ chartQueries: queries(raw(witnessFor(id, '壬透甲藏'))) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /壬透甲藏，富大贵小/u);
      assert.doesNotMatch(materials, /有甲无壬，劳碌浊富|壬藏无甲，一介寒儒/u);
      return '透藏分句取材测试';
    },
  });
  assert.equal(report, '透藏分句取材测试');
  for (const id of new Set(witnesses.flatMap(w => w.proofs.map(p => p.id)))) {
    const changed = structuredClone(catalog.get(id).claim);
    changed.evidence.context += '异本';
    const unexpectedCompile = () => assert.fail('Changed source reached compiler');
    assert.equal(compileQtbjSeasonalPassages(changed, unexpectedCompile).reason, 'source_review_required', id);
  }
});
