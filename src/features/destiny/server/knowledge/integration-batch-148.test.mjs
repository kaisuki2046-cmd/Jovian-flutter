import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueSamePalace, xingjueSamePalaceProfile } from './xingjue-same-palace.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-148-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v1-xingjue-044-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-same-palace-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-same-palace-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);

function queries(confirmedFacts) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, facts) => explainClaim(prefix + number, 'ziwei', context(queries(facts)), undefined, catalog);

function witness(number, text) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof =>
    proof.id === prefix + number && (text === undefined || proof.text === text)));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue same-palace chapter group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueSamePalaceProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueSamePalace(changed).reason, 'source_review_required', id);
  }
  assert.equal(whole, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample)), chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const proof = key(id, text, inputDigest), input = expected.get(proof);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.match(detail.calculationNote, /紫微星诀.*诸星同位垣/u);
      const evidence = text ?? hit.claim.evidence.original_text;
      assert.ok(materials.includes(evidence), id);
      if (text && text !== hit.claim.evidence.original_text) {
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});


test('an incomplete fourth-sector star list cannot prove that Zipo has no auspicious companions', () => {
  const id = '172-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '财帛')).matched, false);
});

test('Sun and Moon in Wei must be opposite the actual Chou life seat', () => {
  const id = '178-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const filtered of [
    facts.filter(f => f.kind !== 'palace_relation' || f.anchor !== '命宫' || f.target !== '迁移'),
    facts.filter(f => f.kind !== 'palace_star' || f.scope !== 'origin' || f.palace !== '迁移' || f.star !== '太阴'),
  ]) assert.equal(explain(id, filtered).matched, false);
});

test('the affiliated penalty passage requires Tianxing and a verified natal Ji carrier', () => {
  const id = '176-001', sentence = '加刑忌僧道';
  const facts = witness(id, sentence);
  assert.ok(explain(id, facts).matchedBranches.some(branch => branch.text === sentence));
  for (const filtered of [
    facts.filter(f => f.kind !== 'palace_star' || f.star !== '天刑'),
    facts.filter(f => f.kind !== 'star_mutagen' || f.change !== '忌'),
  ]) {
    assert.ok(!explain(id, filtered).matchedBranches.some(branch => branch.text === sentence));
  }
});

test('the Tianxiang passage uses the actual birth stem and gender', () => {
  const id = '1021-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const kind of ['natal_gender', 'natal_year_stem']) {
    assert.equal(explain(id, facts.filter(f => f.kind !== kind)).matched, false);
  }
});

test('modern local brightness is not used as a substitute for the manuscript branch', () => {
  const id = '180-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(f => f.kind !== 'palace_branch' || f.palace !== '命宫')).matched, false);
});

test('the retold departure condition is never attached to the shape-only Sun and Moon quotation', () => {
  const id = '1028-001', facts = witness(id);
  const detail = explain(id, facts);
  assert.deepEqual(detail.matchedBranches.map(branch => branch.text), ['日戌月辰']);
  const materials = buildReportMaterials(lookup(queries(facts)));
  assert.ok(materials.includes('日戌月辰'));
  assert.ok(!materials.includes('若出外離宗成家必吉、勿概以反背論'));
});
