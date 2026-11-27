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

const readWitnesses = batch => JSON.parse(readFileSync(new URL(`./claims/integration-batch-${batch}-witnesses.json`, import.meta.url)));
const batch56 = readWitnesses(56);
const batch63 = readWitnesses(63);
const { witnesses } = batch56;
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const keyOf = (id, text, inputDigest) => JSON.stringify([id, text, inputDigest]);
const passages = row => row.inputs ? [{ text: null, inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
const rawAt = instant => chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000));
const raw = witness => rawAt(Date.parse(witness.birthTime));
const ids = {
  mixture: 'qtbj-v4-c045-p001-101',
  yin: 'qtbj-v3-c035-p004-401',
  leanMixture: 'qtbj-v5-c070-p001-101',
  rooted: 'qtbj-v6-c119-p006-101',
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

function verifyWitnesses({ witnesses, alternatives }, { sources, whole, branches, groups }) {
  const rows = new Map([...new Set(witnesses.flatMap(w => w.proofs.map(p => p.id)))].map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, sources);
  assert.equal([...rows.values()].filter(row => row.inputs).length, whole);
  assert.equal([...rows.values()].reduce((sum, row) => sum + row.branches.length, 0), branches);
  const expected = new Map([...rows].flatMap(([id, row]) => passages(row).flatMap(({ text, inputs, conditionCompiler }) => {
    assert.equal(conditionCompiler, qtbjSeasonalPassageProfile);
    if (text) assert.ok(row.claim.evidence.original_text.includes(text));
    return inputs.map(input => [keyOf(id, text, digest(input)), input]);
  })));
  assert.equal(expected.size, groups);
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
}

test('seasonal visibility counts and branch alternatives reach the SQLite catalog, explanation and report materials', () => {
  verifyWitnesses(batch56, { sources: 31, whole: 22, branches: 13, groups: 740 });
});

test('the additional Metal passages each reach SQLite, explanation and report from calculated charts', () => {
  assert.equal(batch63.scanned, 22724);
  assert.equal(batch63.witnesses.length, 116);
  verifyWitnesses(batch63, { sources: 16, whole: 3, branches: 19, groups: 124 });
});

test('the Metal passages require the actual unopposed gui bearer and separate hidden from exposed ren', () => {
  const gui = 'qtbj-v5-c083-p003-301';
  const example = (year, day, hour) => chartFacts.bazi(describeBaZiPillars({ year, month: '丙午', day, hour }));
  assert.ok(explain(gui, example('壬寅', '辛巳', '己丑')).matched);
  assert.equal(explain(gui, example('壬寅', '辛未', '己丑')).matched, false);
  assert.equal(explain(gui, example('壬子', '辛巳', '己亥')).matched, false);
  assert.equal(explain(gui, example('壬寅', '辛巳', '己丑'), { timeKnown: false }).matched, false);

  const winter = 'qtbj-v5-c089-p001-301';
  for (const start of ['壬丙两透', '即壬藏丙透']) {
    const witness = batch63.witnesses.find(row => row.proofs.some(proof => proof.id === winter && proof.text?.startsWith(start)));
    assert.ok(witness, start);
    const matched = explain(winter, raw(witness)).matchedBranches;
    assert.equal(matched.length, 1);
    assert.ok(matched[0].text.startsWith(start));
  }
});

test('the three source variants have different exposed counts and require the other stems to be concealed', () => {
  const variants = ['有甲、丙、癸', '或二透一藏', '二藏一透'];
  for (const [index, excerpt] of variants.entries()) {
    const facts = raw(witnessFor(ids.mixture, excerpt));
    const visible = new Set(facts.filter(fact => fact.kind === 'stem'
      && fact.position !== 'day' && '甲丙癸'.includes(fact.stem)).map(fact => fact.stem));
    assert.equal(visible.size, 3 - index);
    for (const stem of [...'甲丙癸'].filter(stem => !visible.has(stem))) {
      assert.ok(facts.some(fact => fact.kind === 'hidden_ten_god' && fact.stem === stem));
    }
    const match = explain(ids.mixture, facts);
    assert.equal(match.matchedBranches.length, 1);
    assert.ok(match.matchedBranches[0].text.startsWith(excerpt));
    assert.equal(explain(ids.mixture, facts, { timeKnown: false }).matched, false);
  }
  const missingGui = chartFacts.bazi(describeBaZiPillars({ year: '庚午', month: '戊寅', day: '戊戌', hour: '甲寅' }));
  assert.equal(explain(ids.mixture, missingGui).matched, false);
});

test('pure yin requires four confirmed yin branches', () => {
  const sample = witnessFor(ids.yin);
  const facts = raw(sample);
  assert.ok(facts.filter(fact => fact.kind === 'branch').every(fact => '丑卯巳未酉亥'.includes(fact.branch)));
  assert.ok(explain(ids.yin, facts).matched);
  assert.equal(explain(ids.yin, facts, { timeKnown: false }).matched, false);
  const instant = Date.parse(sample.birthTime);
  const otherHour = rawAt(instant + 2 * 3600000);
  assert.ok(otherHour.some(fact => fact.kind === 'branch' && '子寅辰午申戌'.includes(fact.branch)));
  assert.equal(explain(ids.yin, otherHour).matched, false);
});

test('the report sends only the supported combination and never supplies a skipped source variant', async () => {
  const id = ids.leanMixture;
  const { report } = await generateReport({ chartQueries: queries(raw(witnessFor(id))) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /即透一二，亦非白丁/u);
      assert.doesNotMatch(materials, /三者皆全，登科及第/u);
      return '透藏分句验证';
    },
  });
  assert.equal(report, '透藏分句验证');
  const root = explain(ids.rooted, raw(witnessFor(ids.rooted)));
  assert.equal(root.matchedBranches.length, 1);
  assert.match(root.matchedBranches[0].text, /丙透得地/u);
  assert.match(root.reviewNote, /巳支以丙为本气/u);

  for (const id of new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))) {
    const changed = structuredClone(catalog.get(id).claim);
    changed.evidence.context += '异本';
    const unexpectedCompile = () => assert.fail('Changed source reached compiler');
    assert.equal(compileQtbjSeasonalPassages(changed, unexpectedCompile).reason, 'source_review_required', id);
  }
});
