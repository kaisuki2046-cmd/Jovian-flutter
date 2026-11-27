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
import { compileXingjueChildren, xingjueChildrenProfile } from './xingjue-children.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-145-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-050-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-children-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-children-'));
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

test('every reviewed Xingjue children group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueChildrenProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueChildren(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*子息/u);
      const evidence = id === prefix + '640-001'
        ? hits.find(row => row.id === prefix + '633-001').claim.evidence.original_text
        : text ?? hit.claim.evidence.original_text;
      if (id === prefix + '640-001') assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      assert.ok(materials.includes(evidence), id);
      if (text && text !== hit.claim.evidence.original_text) {
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the water bureau requires both named actual placements', () => {
  const id = '1381-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const palace of ['命宫', '子女']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== palace)).matched, false);
  }
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_ziwei_bureau')).matched, false);
});

test('the dragon and tiger need their own cycles and, where flanking, the two actual neighbors', () => {
  const id = '1384-001';
  const rows = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const facts = native(row);
    const dragon = facts.find(fact => fact.kind === 'palace_boshi_star' && fact.star === '青龙');
    const tiger = facts.find(fact => fact.kind === 'palace_suiqian_star' && fact.star === '白虎');
    assert.ok(dragon && tiger && explain(id, facts).matched);
    for (const required of [dragon, tiger]) {
      assert.equal(explain(id, facts.filter(fact => fact !== required)).matched, false);
    }
    if (dragon.palace !== '子女') {
      assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '子女'
        || fact.target !== dragon.palace)).matched, false);
    }
  }
});

test('Lu Cun and the local Ji alternatives use disjoint confirmed chart conditions', () => {
  for (const text of ['子宮三合祿守亦無子', '而子宮若居生旺地則祿存雖臨無妨']) {
    const id = '1377-001';
    const facts = witness(id, text);
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_ziwei_life_phase')).matched, false);
  }
  for (const [id, texts] of [
    ['1393-001', ['寅地子宮巨日有七子', '而化忌同居則有三四子']],
    ['1396-001', ['無殺則有六七八人', '若忌星同居、則忌乃無子、故僅有三四人']],
  ]) {
    for (const text of texts) {
      const facts = witness(id, text);
      assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
      assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌')).matched, false);
    }
  }
});

test('double void and the Sun with Authority use exact natal star identities', () => {
  const double = '1385-001', authority = '1388-001';
  const doubleFacts = witness(double);
  assert.ok(explain(double, doubleFacts).matched);
  assert.equal(explain(double, doubleFacts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '截路')).matched, false);
  assert.equal(explain(double, doubleFacts.filter(fact => fact.kind !== 'natal_year_stem')).matched, false);

  const solar = witness(authority, '死絕鄉則有子一、子亦貴');
  assert.ok(explain(authority, solar).matched);
  assert.equal(explain(authority, solar.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '太阳')).matched, false);
  assert.equal(explain(authority, solar.filter(fact => fact.kind !== 'natal_ziwei_life_phase')).matched, false);
});
