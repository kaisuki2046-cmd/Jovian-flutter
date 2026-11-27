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
import { compileXingjueMigration, xingjueMigrationProfile } from './xingjue-migration.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-136-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-053-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-migration-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-migration-'));
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

test('every reviewed Xingjue migration group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueMigrationProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueMigration(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*迁移/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the two Lu facing the life palace need the actual opposition and confirmed natal Hua Lu', () => {
  const id = '683-001', facts = witness(id, '雙祿居遷為雙祿朝命格');
  assert.equal(explain(id, facts).matched, true);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '禄')).matched, false);
  assert.equal(explain(id, facts.filter(fact =>
    fact.kind !== 'palace_relation' || fact.anchor !== '迁移' || fact.target !== '命宫')).matched, false);
  const extra = '若得天官天貴同照、能以賤化貴';
  assert.ok(explain(id, witness(id, extra)).matchedBranches.some(branch => branch.text === extra));
  assert.ok(!explain(id, facts).matchedBranches.some(branch => branch.text === extra));
});

test('flanking transformations need two distinct adjacent natal carriers', () => {
  const id = '1496-001', text = '權祿夾右弼於遷宮';
  const examples = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id && proof.text === text));
  assert.equal(examples.length, 2);
  for (const sample of examples) {
    const facts = native(sample);
    const host = facts.find(fact => fact.kind === 'star_mutagen' && fact.change === '权' && fact.scope === 'origin');
    assert.ok(host && ['疾厄', '仆役'].includes(host.palace));
    assert.equal(explain(id, facts.filter(fact => fact !== host)).matched, false);
    assert.equal(explain(id, facts.filter(fact =>
      fact.kind !== 'palace_relation' || fact.anchor !== '迁移' || fact.target !== host.palace)).matched, false);
  }
});

test('unconfirmed star lists or an unconfirmed off-sector Ji cannot prove a clean Tianji palace', () => {
  const id = '1491-001';
  const row = fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === prefix + id));
  assert.ok(row);
  const facts = native(row);
  assert.equal(explain(id, facts).matched, true);
  assert.equal(explain(id, facts.filter(fact =>
    fact.kind !== 'palace_origin_star_count' || fact.palace !== '福德')).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌')).matched, false);
});

test('the Tianxiang and Jumen pairing needs the real adjacent branch and local Jumen', () => {
  const id = '1498-001', text = '遷宮天相與午地巨門合者、為印合土石之格';
  const facts = witness(id, text);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '仆役')).matched, false);
  assert.equal(explain(id, facts.filter(fact =>
    fact.kind !== 'palace_star' || fact.scope !== 'origin' || fact.palace !== '仆役' || fact.star !== '巨门')).matched, false);
});

test('the legacy Fire and Bell conjunction stays in review under the current natal placements', () => {
  const review = explainClaim(prefix + '1501-001', 'ziwei', undefined, undefined, catalog);
  assert.equal(review.matched, false);
  assert.equal(review.reason, 'different_chart_tradition');
  assert.match(review.claim.evidence.original_text, /火鈴守遷宮/u);
  for (let year = 1984; year < 1996; year++) {
    for (let timeIndex = 0; timeIndex < 12; timeIndex++) {
      const profile = { date: { year, month: 7, day: 10 }, gender: 'female' };
      const placements = native({ profile, timeIndex }).filter(fact => fact.kind === 'palace_star'
        && fact.scope === 'origin' && ['火星', '铃星'].includes(fact.star));
      assert.equal(placements.length, 2);
      assert.notEqual(placements[0].palace, placements[1].palace);
    }
  }
});
