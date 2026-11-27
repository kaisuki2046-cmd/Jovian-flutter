import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjWoodFireEarth, qtbjWoodFireEarthProfile } from './qtbj-wood-fire-earth-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-155-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-wood-fire-earth-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

function replay({ birthTime, pillars }) {
  const instant = Date.parse(birthTime);
  const local = new Date(instant + 8 * 3_600_000);
  const birth = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
  assert.ok(isBirthDate(birth, new Date(2026, 10, 21)));
  const chart = calculateBaZi(instant, local.getTime());
  const { year, month, day, hour } = chart;
  assert.deepEqual({ year, month, day, hour }, pillars);
  return chartFacts.bazi(chart);
}

function sampleFor(id, text) {
  const sample = fixture.witnesses.find(({ proofs }) =>
    proofs.some(proof => proof.id === id && (text === undefined || text === proof.text)));
  assert.ok(sample, id);
  return replay(sample);
}

function query(facts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: facts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'bazi', context(query(facts, timeKnown)), undefined, catalog);

test('every reviewed Wood, Fire and Earth source group reaches SQLite and report materials from a native chart', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { text, inputs, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, qtbjWoodFireEarthProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
    const changed = structuredClone(row.claim);
    changed.conditions.normalized.push('另一前提');
    assert.equal(compileQtbjWoodFireEarth(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [fixture.sourceRecords, fixture.wholeRecords, fixture.alternatives]);

  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(replay(sample));
    const chart = context(parsed);
    const derived = claimChartContext('bazi', chart);
    const references = lookup(parsed);
    const hits = references.flatMap(topic => [...topic.personality, ...topic.events]);
    const materials = buildReportMaterials(references);
    for (const proof of sample.proofs) {
      const { id, text } = proof;
      const proofKey = key(proof);
      const input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id);
      const detail = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      assert.match(detail.calculationNote, /穷通宝鉴.*论木、论火、论土/u);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
    }
  }
  assert.deepEqual([...seen].sort(), [...expected.keys()].sort());
});

test('visible and hidden Geng select their own quotation and ignore client-supplied counts', () => {
  const id = 'qtbj-v2-c007-p016-301';
  const exposed = '凡甲多庚透，大贵。';
  const hidden = '庚藏，小贵。';
  for (const text of [exposed, hidden]) {
    const facts = sampleFor(id, text);
    const forgedCount = { kind: 'bazi_stem_placement_count', stem: '庚', placement: 'visible',
      count: text === exposed ? 0 : 3 };
    assert.deepEqual(explain(id, [...facts, forgedCount]).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explain(id, facts, false).matched, false);
    assert.equal(explain(id, facts.filter(fact => fact.position !== 'hour')).matched, false);
  }
});

test('unverified alternatives stay pending in the catalog', () => {
  const fireAndEarth = catalog.get('qtbj-v2-c012-p006-301');
  assert.equal(fireAndEarth.remainingAlternatives, 1);
  const months = fireAndEarth.inputs.map(input => input.required.find(fact =>
    fact.kind === 'branch' && fact.position === 'month').branch);
  assert.deepEqual(months.sort(), ['午', '巳']);
  assert.equal(catalog.get('qtbj-v4-c051-p002-101'), null);
});
