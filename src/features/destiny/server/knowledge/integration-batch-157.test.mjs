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
import { compileJielanNatalStars, jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-157-witnesses.json', import.meta.url)));
const prefix = 'ziwei-';
const directory = mkdtempSync(join(tmpdir(), 'destiny-ziwei-jielan-natal-stars-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ziwei-jielan-natal-stars-'));
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

test('every reviewed Jielan natal star chapter group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, jielanNatalStarProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微斗数捷览.*分星篇/u);
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

test('empty Life requires a complete origin star list and separates the two trine conclusions', () => {
  const id = 'v5-jielan-244-p002-001';
  const hasGood = '若命无正星，三方有吉会，仍作入格';
  const noGood = '无吉为不入局论。';
  for (const text of [hasGood, noGood]) {
    const facts = witness(id, text);
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    const incompleteLife = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
    assert.equal(explain(id, incompleteLife).matched, false);
  }
  const lifeWithHuaKe = witness(id, noGood);
  assert.ok(lifeWithHuaKe.some(fact => fact.kind === 'palace_mutagen' && fact.palace === '命宫' && fact.change === '科'));
  const incompleteTrine = lifeWithHuaKe.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '财帛');
  const suppliedAbsence = { kind: 'palace_life_without_trine_auspicious_mutagens' };
  assert.ok(!queries([...incompleteTrine, suppliedAbsence])[0].confirmedFacts.some(fact => fact.kind === suppliedAbsence.kind));
  assert.equal(explain(id, [...incompleteTrine, suppliedAbsence]).matched, false);
});

test('Tianji meeting an opposing malefic requires the actual opposite palace relation', () => {
  const id = 'v4-jielan-139-p002-002';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const missingOpposite = facts.filter(fact => fact.kind !== 'palace_relation' || fact.relation !== 'opposite');
  assert.equal(explain(id, missingOpposite).matched, false);
  const tianji = facts.find(fact => fact.kind === 'palace_star' && fact.star === '天机');
  assert.ok(tianji);
  const displaced = { ...tianji, palace: tianji.palace === '命宫' ? '迁移' : '命宫' };
  assert.equal(explain(id, [...facts, displaced]).matched, false);
});

test('the Sun and Moon exceptions require a real natal Ji carrier', () => {
  const id = 'v5-jielan-244-p002-008';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const noCarrier = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain(id, noCarrier).matched, false);
});
