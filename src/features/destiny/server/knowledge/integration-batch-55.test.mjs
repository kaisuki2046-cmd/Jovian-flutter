import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjSeasonalPassages, qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-55-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const keyOf = (id, text, inputDigest) => JSON.stringify([id, text, inputDigest]);
const passages = row => row.inputs ? [{ text: null, inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
const rawAt = instant => chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000));
const raw = witness => rawAt(Date.parse(witness.birthTime));
const ids = {
  fourTombs: 'qtbj-v4-c060-p004-101',
  incompleteTrine: 'qtbj-v5-c076-p002-101',
  rootedStem: 'qtbj-v5-c067-p004-101',
  partial: 'qtbj-v4-c047-p002-101',
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

test('seasonal exposure, trine and tomb alternatives reach the SQLite catalog, explanation and report materials', () => {
  const rows = new Map([...new Set(witnesses.flatMap(w => w.proofs.map(p => p.id)))].map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 45);
  assert.equal([...rows.values()].filter(row => row.inputs).length, 15);
  assert.equal([...rows.values()].reduce((sum, row) => sum + row.branches.length, 0), 54);
  const expected = new Map([...rows].flatMap(([id, row]) => passages(row).flatMap(({ text, inputs, conditionCompiler }) => {
    assert.equal(conditionCompiler, qtbjSeasonalPassageProfile);
    if (text) assert.ok(row.claim.evidence.original_text.includes(text));
    return inputs.map(input => [keyOf(id, text, digest(input)), input]);
  })));
  assert.equal(expected.size, 753);
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

test('four distinct branch positions are needed for the four tombs', () => {
  const facts = raw(witnessFor(ids.fourTombs, '或支四库'));
  assert.deepEqual(new Set(facts.filter(fact => fact.kind === 'branch').map(fact => fact.branch)), new Set('辰戌丑未'));
  assert.ok(explain(ids.fourTombs, facts).matched);
  assert.equal(explain(ids.fourTombs, facts, { timeKnown: false }).matched, false);
  const withoutJia = explain(ids.fourTombs, raw(witnessFor(ids.fourTombs, '乏甲者')));
  assert.deepEqual(withoutJia.matchedBranches.map(branch => branch.text), ['乏甲者孤贫']);
});

test('a proven incomplete trine differs from a full trine or a chart with unknown time', () => {
  const facts = raw(witnessFor(ids.incompleteTrine));
  assert.ok(explain(ids.incompleteTrine, facts).matched);
  assert.equal(explain(ids.incompleteTrine, facts, { timeKnown: false }).matched, false);
  const fullTrine = chartFacts.bazi(describeBaZiPillars({ year: '甲辰', month: '丁亥', day: '庚申', hour: '丙子' }));
  assert.equal(explain(ids.incompleteTrine, fullTrine).matched, false);
});

test('a visible 壬 with a hidden 壬 and confirmed zero hidden 壬 have separate excerpts', () => {
  const rooted = raw(witnessFor(ids.rootedStem, '或支成炎局'));
  const unrooted = raw(witnessFor(ids.rootedStem, '无根者'));
  assert.ok(rooted.some(fact => fact.kind === 'hidden_ten_god' && fact.stem === '壬'));
  assert.ok(unrooted.every(fact => fact.kind !== 'hidden_ten_god' || fact.stem !== '壬'));
  assert.deepEqual(explain(ids.rootedStem, rooted).matchedBranches.map(branch => branch.text), ['或支成炎局，壬透，有根者，大富贵']);
  assert.deepEqual(explain(ids.rootedStem, unrooted).matchedBranches.map(branch => branch.text), ['无根者，小富贵']);
  assert.ok(!explain(ids.rootedStem, unrooted, { timeKnown: false }).matchedBranches?.some(branch => branch.text.startsWith('无根')));
});

test('the provider receives the matched excerpt and compiler rejects changed source text', async () => {
  const id = ids.partial;
  const { report } = await generateReport({ chartQueries: queries(raw(witnessFor(id, '壬透'))) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /壬透富贵辛苦/u);
      assert.doesNotMatch(materials, /癸透/u);
      return '三合与透干分句取材测试';
    },
  });
  assert.equal(report, '三合与透干分句取材测试');
  for (const id of new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))) {
    const changed = structuredClone(catalog.get(id).claim);
    changed.evidence.context += '异本';
    const unexpectedCompile = () => assert.fail('Changed source reached compiler');
    assert.equal(compileQtbjSeasonalPassages(changed, unexpectedCompile).reason, 'source_review_required', id);
  }
});
