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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-105-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b105-'));
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

test('a fallen transformation must come from the actual star that carries Ke', () => {
  const facts = witness('014');
  assert.equal(explain('014', facts).matched, true);
  const host = facts.find(fact => fact.kind === 'star_mutagen' && fact.change === '科');
  assert.ok(host);
  const withoutBrightness = facts.filter(fact => fact.kind !== 'palace_brightness'
    || fact.palace !== host.palace || fact.star !== host.star);
  const injected = { kind: 'palace_mutagen_brightness', palace: host.palace, change: '科', brightness: '陷' };
  assert.equal(explain('014', [...withoutBrightness, injected]).matched, false);
});

test('the fallen Lu passage needs both Void stars with the falling host', () => {
  const facts = witness('016');
  assert.equal(explain('016', facts).matched, true);
  const withoutVoid = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '地空');
  assert.equal(explain('016', withoutVoid).matched, false);
});

test('all four named major stars are needed in the same three-palace axis', () => {
  const facts = witness('082');
  assert.equal(explain('082', facts).matched, true);
  const withoutTanlang = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '贪狼');
  assert.equal(explain('082', withoutTanlang).matched, false);
  const withoutChange = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change === '忌');
  assert.equal(explain('082', withoutChange).matched, false);
});

test('four-direction support requires an observed benefic in each of the four places', () => {
  const facts = witness('125');
  assert.equal(explain('125', facts).matched, true);
  const benefic = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const uncoveredOpposite = facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '迁移' || !benefic.has(fact.star));
  assert.equal(explain('125', uncoveredOpposite).matched, false);
});

test('the repeated Tanlang excerpt appears once and retains limits from both entries', () => {
  const facts = witness('133');
  const alias = explain('133', facts), original = explain('084', facts);
  assert.ok(alias.matched);
  assert.ok(original.matched);
  const quote = alias.matchedBranches[0].text;
  const references = lookup(query(facts));
  const material = buildReportMaterials(references);
  assert.equal(material.split(quote).length - 1, 1);
  const excerpt = material.split('\n\n').find(block => block.includes(quote));
  assert.ok(excerpt);
  for (const limit of [...alias.claim.interpretation.limitations, ...original.claim.interpretation.limitations]) {
    assert.ok(excerpt.includes(limit), limit);
  }
  const onlyAlias = references.map(row => ({ ...row, personality: row.personality.filter(rule => rule.id !== prefix + '084') }));
  assert.equal(buildReportMaterials(onlyAlias).split(quote).length - 1, 1);
});
