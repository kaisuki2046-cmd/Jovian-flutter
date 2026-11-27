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
import { compileXingjueLifeBody, xingjueLifeBodyProfile } from './xingjue-life-body.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-146-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-047-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-life-body-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-life-body-'));
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

test('every reviewed Xingjue life and body group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueLifeBodyProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueLifeBody(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*身命/u);
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

test('a body clause requires the actual body seat, the birth hour and its palace branch', () => {
  const id = '582-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const kind of ['natal_ziwei_hour', 'body_palace', 'natal_year_nayin_element', 'natal_ziwei_bureau']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== kind)).matched, false);
  }
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '财帛')).matched, false);
  const withoutSeat = facts.filter(fact => fact.kind !== 'body_palace');
  assert.equal(explain(id, [...withoutSeat, { kind: 'body_palace', palace: '迁移' }]).matched, false);
});

test('the double-Lu passage keeps one life anchor and the actual body anchor', () => {
  const id = '1297-001', base = '命宮雙祿同守、身宮日月同居、千百中難得';
  const extension = '況日月台座同宮、加有台甫來會、必入黃閣調元';
  const facts = witness(id, extension);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [base, extension]);
  assert.deepEqual(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '福德'
    || fact.target !== '财帛')).matchedBranches.map(branch => branch.text), [base]);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen'
    || fact.palace !== '命宫' || fact.change !== '禄')).matched, false);
});

test('the three transformations retain exact carriers in the named set of three palaces', () => {
  const id = '1304-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const change of ['禄', '权', '科']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== change)).matched, false);
  }
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '命宫'
    || fact.target !== '财帛')).matched, false);
});

test('flanking Jumen requires Lianzhen and Tianyao in the actual adjacent palaces of the matched anchor', () => {
  const id = '1313-001';
  const rows = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  const matchedSeats = new Set();
  for (const row of rows) {
    const facts = native(row);
    const jumen = facts.find(fact => fact.kind === 'palace_star' && fact.star === '巨门' && fact.scope === 'origin');
    const tianyao = facts.find(fact => fact.kind === 'palace_star' && fact.star === '天姚' && fact.scope === 'origin');
    assert.ok(jumen && tianyao && explain(id, facts).matched);
    matchedSeats.add(jumen.palace);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== jumen.palace
      || fact.target !== tianyao.palace)).matched, false);
  }
  assert.deepEqual(matchedSeats, new Set(['命宫', '财帛']));
});
