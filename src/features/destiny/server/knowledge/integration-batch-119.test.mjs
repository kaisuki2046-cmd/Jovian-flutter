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
import { compileXingjueEstate, xingjueEstateProfile } from './xingjue-estate.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-119-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-056-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-estate-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-estate-'));
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
  const row = fixture.witnesses.find(w => w.proofs.some(proof => proof.id === prefix + number && proof.text === text));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue estate group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueEstateProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueEstate(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*田宅/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Lu Cun and Di Jie are compared in the same palace with a complete list for the favorable clause', () => {
  const id = '739-001';
  const clear = '祿居田財極富', challenged = '而地劫同位';
  const clearFacts = witness(id, clear), challengedFacts = witness(id, challenged);
  const palace = clearFacts.find(f => f.kind === 'palace_star' && f.star === '禄存' && f.scope === 'origin').palace;
  assert.deepEqual(explain(id, clearFacts).matchedBranches.map(branch => branch.text), [clear]);
  assert.deepEqual(explain(id, challengedFacts).matchedBranches.map(branch => branch.text), [challenged]);
  const incomplete = clearFacts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== palace);
  assert.equal(explain(id, incomplete).matched, false);
});

test('the Xu estate quotation needs an actual natal Ji carrier in the same palace', () => {
  const id = '736-001', facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const withoutCarrier = facts.filter(f => f.kind !== 'star_mutagen' || f.change !== '忌');
  assert.equal(explain(id, withoutCarrier).matched, false);
});

test('the Chou Sun and Moon quotation distinguishes actual Xun Kong from other void stars', () => {
  const id = '1566-001', text = '而若化忌同居、地刧相會者、貧無田宅';
  const facts = witness(id, text);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
  const wrongVoid = facts.map(f => f.kind === 'palace_star' && f.palace === '田宅' && f.star === '旬空'
    ? { ...f, star: '天空' } : f);
  assert.equal(explain(id, wrongVoid).matched, false);
});

test('the Left and Right Assistants must occupy both confirmed neighbors for the flanking quotation', () => {
  const id = '1577-001', text = '輔弼夾於田宮、富厚', facts = witness(id, text);
  assert.ok(explain(id, facts).matchedBranches.some(branch => branch.text === text));
  const missingLink = facts.filter(f => !(f.kind === 'palace_relation' &&
    f.anchor === '田宅' && f.target === '福德' && f.relation === 'adjacent'));
  assert.ok(!explain(id, missingLink).matchedBranches?.some(branch => branch.text === text));
});
