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
import { compileXingjueSiblings, xingjueSiblingsProfile } from './xingjue-siblings.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-144-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-048-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-siblings-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-siblings-'));
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

function witness(number, text = null) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof => proof.id === prefix + number && proof.text === text));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue siblings group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueSiblingsProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueSiblings(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*兄弟/u);
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

test('Wuqu and Qisha must come together from the actual external sector', () => {
  const id = '603-001';
  const rows = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  const from = new Set();
  for (const row of rows) {
    const facts = native(row);
    const wuqu = facts.find(fact => fact.kind === 'palace_star' && fact.star === '武曲' && fact.scope === 'origin');
    assert.ok(wuqu && explain(id, facts).matched);
    from.add(wuqu.palace);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation'
      || fact.anchor !== '兄弟' || fact.target !== wuqu.palace)).matched, false);
  }
  assert.deepEqual(from, new Set(['仆役', '田宅', '疾厄']));
});

test('a Changqu exception needs a complete local star list and Tiantong selects its own fragment', () => {
  const id = '594-001', tiantong = '1322-001';
  const original = witness(id);
  assert.ok(explain(id, original).matched);
  assert.equal(explain(id, original.filter(fact => fact.kind !== 'palace_origin_star_count'
    || fact.palace !== '兄弟')).matched, false);
  for (const text of ['兄弟宮天同主五人', '陀羅同位尅、二人']) {
    const detail = explain(tiantong, witness(tiantong, text));
    assert.deepEqual(detail.matchedBranches.map(branch => branch.text), [text]);
  }
});

test('both outward transformations and the natal Ji carrier have to be confirmed', () => {
  const id = '1334-001', warning = '605-001';
  const facts = witness(id), warningFacts = witness(warning);
  assert.ok(explain(id, facts).matched);
  for (const change of ['禄', '权']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== change)).matched, false);
  }
  assert.ok(explain(warning, warningFacts).matched);
  assert.equal(explain(warning, warningFacts.filter(fact => fact.kind !== 'star_mutagen'
    || fact.palace !== '兄弟' || fact.change !== '忌')).matched, false);
});

test('the noble pair requires the opposing palace in addition to flanking luminaries', () => {
  const id = '1321-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const target of ['仆役', '命宫', '夫妻']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '兄弟'
      || fact.target !== target)).matched, false);
  }
});
