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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-102-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b102-'));
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

test('the Tianfu passage requires a named birth stem and a complete four-sector star list', () => {
  const facts = witness('020');
  assert.equal(explain('020', facts).matched, true);
  const wrongStem = facts.map(fact => fact.kind === 'natal_year_stem' ? { ...fact, stem: '乙' } : fact);
  assert.equal(explain('020', wrongStem).matched, false);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain('020', incomplete).matched, false);
});

test('opposite Kui and Yue need another auspicious transformation in the surrounding palaces', () => {
  const facts = witness('025');
  assert.equal(explain('025', facts).matched, true);
  const withoutExternalChange = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change === '忌');
  assert.equal(explain('025', withoutExternalChange).matched, false);
  const withoutYue = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天钺');
  assert.equal(explain('025', withoutYue).matched, false);
});

test('co-seated Zuo and Chang with a trine benefic and malefic remains unresolved', () => {
  for (const [year, month, day, timeIndex, star, malefic] of [
    [1925, 10, 27, 10, '天钺', '擎羊'], [1929, 6, 16, 2, '天魁', '铃星'],
  ]) {
    const facts = native({ profile: { date: { year, month, day }, gender: 'male' }, timeIndex });
    const palace = timeIndex === 10 ? '命宫' : '官禄';
    for (const name of ['左辅', '文昌']) {
      assert.ok(facts.some(fact => fact.kind === 'palace_star' && fact.palace === palace && fact.star === name));
    }
    const trines = claimChartContext('ziwei', context(query(facts))).present;
    for (const name of [star, malefic]) {
      assert.ok(trines.some(fact => fact.kind === 'palace_trine_star' && fact.palace === palace && fact.star === name));
    }
    const detail = explain('027', facts);
    assert.equal(detail.matched, false);
    assert.match(detail.reviewNote, /范围待校/u);
  }
});

test('the Qisha passage needs its own brightness in one of the named life-palace positions', () => {
  const facts = witness('059');
  assert.equal(explain('059', facts).matched, true);
  const unconfirmed = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.star !== '七杀');
  assert.equal(explain('059', unconfirmed).matched, false);
});

test('Chang, Qu and Ke must all be witnessed in the three external palaces', () => {
  const facts = witness('115');
  assert.equal(explain('115', facts).matched, true);
  const withoutQu = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文曲');
  assert.equal(explain('115', withoutQu).matched, false);
  const movedKe = facts.map(fact => fact.kind === 'palace_mutagen' && fact.change === '科'
    ? { ...fact, palace: '命宫' } : fact);
  assert.equal(explain('115', movedKe).matched, false);
});
