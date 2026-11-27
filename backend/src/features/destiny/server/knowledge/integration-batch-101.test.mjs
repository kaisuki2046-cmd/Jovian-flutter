import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileJielanGusui, jielanGusuiProfile } from './ziwei-jielan-gusui.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-101-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b101-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const prefix = 'ziwei-v3-jielan-123-p001-';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const native = sample => chartFacts.ziwei(calculateZiwei(sample.profile, sample.timeIndex));
const witness = (shortId, match = () => true) =>
  native(fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === prefix + shortId && match(proof))));

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown = true) => explainClaim(prefix + id, 'ziwei', context(query(facts, timeKnown)), undefined, catalog);

test('the reviewed Gusui records reach SQLite, individual explanations and report passages', () => {
  const expected = new Map();
  let whole = 0;
  for (const shortId of fixture.ids) {
    const id = prefix + shortId, row = catalog.get(id);
    if (row.inputs?.length) whole++;
    for (const { text, inputs, conditionCompiler } of row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, jielanGusuiProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
    const revised = structuredClone(row.claim);
    revised.evidence.context += ' revised';
    assert.equal(compileJielanGusui(revised).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.conditionGroups);
  assert.equal(whole, fixture.wholeRecords);

  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(native(sample)), base = context(parsed);
    const derived = claimChartContext('ziwei', base), references = lookup(parsed);
    const hits = references.flatMap(row => [...row.personality, ...row.events]);
    const materials = buildReportMaterials(references);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', base, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.deepEqual(detail.matchedBranches, hit.matchedBranches);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the female Liang and Ma passage needs both the gender and an actual trine', () => {
  const facts = witness('051');
  assert.equal(explain('051', facts).matched, true);
  const wrongGender = facts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact);
  assert.equal(explain('051', wrongGender).matched, false);
  const withoutLiang = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天梁');
  const forgedTrine = { kind: 'palace_trine_star', palace: '命宫', star: '天梁' };
  assert.equal(explain('051', [...withoutLiang, forgedTrine]).matched, false);
});

test('the paired Lu passage requires both distinct kinds in their respective palaces', () => {
  const trine = ({ text }) => text?.includes('禄存与化禄在财官二宫');
  const facts = witness('062', trine);
  const matched = detail => detail.matchedBranches?.some(trine) ?? false;
  assert.ok(matched(explain('062', facts)));
  const withOnlyLuCun = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change !== '禄');
  assert.equal(matched(explain('062', withOnlyLuCun)), false);
  const withOnlyTransmutedLu = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '禄存');
  assert.equal(matched(explain('062', withOnlyTransmutedLu)), false);
});

test('the Li Guang passage reads Lishi from the natal Boshi cycle in the life palace', () => {
  const facts = witness('043');
  assert.equal(explain('043', facts).matched, true);
  const displaced = facts.map(fact => fact.kind === 'palace_boshi_star' && fact.star === '力士'
    ? { ...fact, palace: '福德' } : fact);
  assert.equal(explain('043', displaced).matched, false);
});

test('the three auspicious transformations need the life and both trine palaces', () => {
  const facts = witness('107');
  assert.equal(explain('107', facts).matched, true);
  const displaced = facts.map(fact => fact.kind === 'palace_mutagen' && fact.palace === '财帛'
    ? { ...fact, palace: '官禄' } : fact);
  assert.equal(explain('107', displaced).matched, false);
});

test('Jumen must be fallen and carry the Ji transformation itself', () => {
  const facts = witness('128');
  assert.equal(explain('128', facts).matched, true);
  const noHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '巨门' || fact.change !== '忌');
  assert.equal(explain('128', noHost).matched, false);
  const wrongBrightness = facts.map(fact => fact.kind === 'palace_brightness' && fact.star === '巨门'
    ? { ...fact, brightness: '旺' } : fact);
  assert.equal(explain('128', wrongBrightness).matched, false);
});
