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
import { compileJielanPalacePassages, jielanPalacePassageProfile } from './ziwei-source-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-93-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b93-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const prefix = 'ziwei-v2-jielan-101-p';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witness = shortId => native(fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === prefix + shortId)));

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (shortId, facts, timeKnown = true) => explainClaim(prefix + shortId, 'ziwei', context(query(facts, timeKnown)), undefined, catalog);

test('the 24 new Jielan records reach SQLite, single-claim explanations and report materials', () => {
  const expected = new Map();
  let whole = 0;
  for (const shortId of fixture.ids) {
    const id = prefix + shortId, row = catalog.get(id);
    if (row.inputs?.length) whole++;
    for (const { text, inputs, conditionCompiler } of row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, jielanPalacePassageProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
    const revised = structuredClone(row.claim);
    revised.evidence.context += ' revised';
    assert.equal(compileJielanPalacePassages(revised).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.conditionGroups);
  assert.equal(whole, fixture.wholeRecords);

  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(native(sample)), base = context(parsed);
    const derived = claimChartContext('ziwei', base), refs = lookup(parsed), matches = hits(refs);
    const materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matches.find(row => row.id === id), detail = explainClaim(id, 'ziwei', base, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
        assert.deepEqual(detail.matchedBranches, hit.matchedBranches);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the sibling passage requires both Chang and Qu in the actual four sectors', () => {
  const id = '011-006', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  for (const removed of ['文昌', '文曲']) {
    const fake = { kind: 'palace_sector_star', palace: '兄弟', star: removed };
    const incomplete = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== removed);
    assert.equal(explain(id, incomplete.concat(fake)).matched, false);
  }
  assert.equal(explain(id, facts, false).matched, false);
});

test('four malefics and the same-palace Chang are independent requirements in the spouse passage', () => {
  const id = '012-030', facts = witness(id);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), ['加四杀遇昌，主离']);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文昌')).matched, false);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '擎羊');
  const forged = { kind: 'palace_sector_malefic_count', palace: '夫妻', count: 4 };
  assert.equal(explain(id, incomplete.concat(forged)).matched, false);
});

test('a property chart can independently satisfy the benefic and malefic passages', () => {
  const facts = witness('019-024');
  const goodId = '019-005', hardId = '019-024';
  assert.deepEqual(explain(goodId, facts).matchedBranches.map(branch => branch.text), ['逢吉，大发']);
  assert.deepEqual(explain(hardId, facts).matchedBranches.map(branch => branch.text), ['逢凶，破耗']);
  const removed = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);
  const noMalefics = facts.filter(fact => fact.kind !== 'palace_star' || !removed.has(fact.star));
  assert.equal(explain(hardId, noMalefics).matched, false);
  assert.ok(explain(goodId, noMalefics).matched);
});
