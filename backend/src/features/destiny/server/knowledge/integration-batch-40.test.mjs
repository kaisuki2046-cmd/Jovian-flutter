import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { qtbjTermProfile } from './bazi-literal-passages.mjs';
import { claimChartContext, compileClaimSources, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const { witnesses, alternatives, edges } = JSON.parse(readFileSync(new URL('./claims/integration-batch-40-witnesses.json', import.meta.url), 'utf8'));
const ids = {
  both: 'qtbj-v2-c013-p006-001', either: 'qtbj-v2-c013-p008-001',
  columns: 'qtbj-v2-c013-p009-301', winter: 'qtbj-v2-c014-p008-001',
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();
const qi = term => ({ kind: 'bazi_previous_qi', term });
const pillarsAt = raw => raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi);
const rawAt = instant => chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000));
const withoutQi = raw => raw.filter(fact => fact.kind !== 'bazi_previous_qi');
const witnessFor = (id, text = null) => witnesses.find(w => w.proofs.some(proof => proof.id === id && proof.text === text));
const native = witness => rawAt(Date.parse(witness.birthTime));

function match(id, raw, timeKnown = true) {
  const [parsed] = parseChartQueries([query(raw)], { timeKnown });
  return lookupInterpretations(catalogDirectory, parsed).find(hit => hit.id === id);
}

function declared(term, year, month, day, hour) {
  return [...chartFacts.bazi(describeBaZiPillars({ year, month, day, hour })), qi(term)];
}

test('all seasonal alternatives work through the SQLite report and explanation', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.compiler ?? row.branches[0]?.conditionCompiler, qtbjTermProfile);
    const groups = row.inputs ? [{ inputs: row.inputs, text: null }] : row.branches;
    return groups.flatMap(({ inputs, text }) => inputs.map(input => [id, text, digest(input)].join(':')));
  }));
  assert.equal([...rows.values()].filter(row => row.inputs).length, 3);
  assert.equal(rows.get(ids.either).branches.length, 2);
  assert.equal(expected.size, 27);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const raw = native(witness);
    assert.deepEqual(pillarsAt(raw), witness.pillars);
    const parsed = parseChartQueries([query(raw)]);
    const chart = chartContext('bazi', parsed[0].confirmedFacts);
    const calculated = claimChartContext('bazi', chart);
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, text, digest: inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = (row.inputs ?? row.branches.find(branch => branch.text === text).inputs).find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true);
      const hit = hits.find(hit => hit.id === id);
      assert.ok(hit, id);
      const explanation = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.equal(explanation.matched, true);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text));
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text));
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text));
      seen.add([id, text, inputDigest].join(':'));
    }
  }
  assert.deepEqual(seen, expected);
});

test('the exact term instant, missing or conflicting terms, and a different month are distinct', () => {
  const autumn = Date.parse(edges.秋分.birthTime);
  const before = rawAt(autumn - 1000);
  const at = rawAt(autumn);
  assert.deepEqual(pillarsAt(before), pillarsAt(at));
  assert.ok(before.some(fact => fact.kind === 'bazi_previous_qi' && fact.term === '处暑'));
  assert.ok(at.some(fact => fact.kind === 'bazi_previous_qi' && fact.term === '秋分'));
  for (const id of edges.秋分.ids) {
    assert.ok(match(id, at));
    for (const facts of [before, withoutQi(at), [...at, qi('处暑')]]) assert.equal(match(id, facts), undefined);
  }
  const solstice = Date.parse(edges.冬至.birthTime);
  for (const [instant, term] of [[solstice - 1000, '小雪'], [solstice, '冬至']]) {
    assert.ok(rawAt(instant).some(fact => fact.kind === 'bazi_previous_qi' && fact.term === term));
  }
  assert.equal(match(ids.both, declared('秋分', '癸卯', '丙辰', '乙卯', '丙子')), undefined);
});

test('positions, hidden stems, complete exclusions and three-branch wood assembly are required', () => {
  const raw = native(witnessFor(ids.columns));
  assert.ok(match(ids.columns, raw));
  assert.equal(match(ids.columns, raw, false), undefined);
  const wrongColumn = declared('秋分', '丙午', '丁酉', '乙亥', '癸未');
  assert.ok(match(ids.both, wrongColumn));
  assert.equal(match(ids.columns, wrongColumn), undefined);

  const hiddenBing = '生秋分後，有丙无癸，亦略富贵。';
  const hiddenGui = '若有癸无丙，名利虚花。';
  for (const text of [hiddenBing, hiddenGui]) {
    const hidden = native(witnessFor(ids.either, text));
    assert.deepEqual(match(ids.either, hidden).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(match(ids.either, hidden, false), undefined);
  }
  assert.equal(match(ids.either, declared('秋分', '壬寅', '己酉', '乙卯', '庚辰')), undefined);
  assert.equal(match(ids.either, declared('秋分', '辛丑', '丁酉', '乙卯', '戊寅')), undefined);

  const winter = native(witnessFor(ids.winter));
  assert.ok(match(ids.winter, winter));
  assert.equal(match(ids.winter, winter, false), undefined);
  assert.equal(match(ids.winter, [...withoutQi(winter), qi('小雪')]), undefined);
  assert.equal(match(ids.winter, declared('冬至', '己未', '丙子', '乙酉', '丁亥')), undefined);
});

test('report generation quotes the active seasonal branch and the fixed source guard rejects edited originals', async context => {
  const branch = '若有癸无丙，名利虚花。';
  const chartQueries = parseChartQueries([query(native(witnessFor(ids.either, branch)))]);
  const lookup = queries => reportLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === ids.either),
    events: reference.events.filter(hit => hit.id === ids.either),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.ok(materials.includes(branch));
      assert.doesNotMatch(materials, /亦略富贵/u);
      assert.match(materials, /实际交接时刻/u);
      return '节气测试报告';
    },
  });
  assert.equal(report, '节气测试报告');

  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch40-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const method of ['ziwei', 'western']) writeFileSync(join(directory, method + '.json'), '[]');
  writeFileSync(join(directory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const edited = Object.values(ids).map(id => {
    const source = structuredClone(catalog.get(id).claim);
    source.conditions.normalized = ['乙日'];
    return source;
  });
  writeFileSync(join(directory, 'bazi.json'), JSON.stringify(edited));
  for (const row of compileClaimSources(directory)) {
    assert.equal(row.reason, 'source_review_required');
    assert.equal(row.inputs, undefined);
    assert.deepEqual(row.branches, []);
  }
});
