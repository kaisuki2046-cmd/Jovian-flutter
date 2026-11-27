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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-107-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b107-'));
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

test('Lu and Quan need verified star brightness and a complete four-sector comparison', () => {
  const facts = witness('010');
  assert.equal(explain('010', facts).matched, true);
  const withoutQuanHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '权');
  assert.equal(explain('010', withoutQuanHost).matched, false);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count');
  const fakeCounts = [{ kind: 'palace_sector_benefic_count', palace: '命宫', count: 6 },
    { kind: 'palace_sector_six_malefic_count', palace: '命宫', count: 0 }];
  assert.equal(explain('010', [...incomplete, ...fakeCounts]).matched, false);
});

test('the expanded malefic count includes Void stars that the four-star count excludes', () => {
  const facts = native({ profile: { date: { year: 1924, month: 2, day: 9 }, gender: 'male' }, timeIndex: 3 });
  const derived = claimChartContext('ziwei', context(query(facts))).present;
  const expanded = derived.filter(fact => fact.kind === 'palace_sector_six_malefic_count');
  assert.equal(expanded.length, 12);
  assert.ok(expanded.some(fact => fact.count === 2 + derived.find(base =>
    base.kind === 'palace_sector_malefic_count' && base.palace === fact.palace).count));
});

test('the supported Qisha passage needs all six named benefics', () => {
  const facts = witness('017');
  assert.equal(explain('017', facts).matched, true);
  const withoutYue = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天钺');
  assert.equal(explain('017', withoutYue).matched, false);
});

test('the chosen luminary must itself bear a favorable natal transformation', () => {
  const facts = witness('034');
  assert.equal(explain('034', facts).matched, true);
  const withoutHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.palace !== '命宫');
  assert.equal(explain('034', withoutHost).matched, false);
});

test('Jumen hidden or flanking Lu requires actual Lu Cun in You', () => {
  const facts = witness('075');
  assert.equal(explain('075', facts).matched, true);
  const withoutLuCun = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '禄存');
  assert.equal(explain('075', withoutLuCun).matched, false);
});

test('both Lu and Quan records remain queryable and shared branches appear once across topics', () => {
  const facts = witness('102');
  const original = explain('010', facts), repeated = explain('102', facts);
  assert.ok(original.matched && repeated.matched);
  assert.deepEqual(original.matchedBranches, repeated.matchedBranches);
  const refs = lookup(query(facts));
  const originalTopic = refs.find(({ events }) => events.some(rule => rule.id === prefix + '010'))?.topic;
  const repeatedTopic = refs.find(({ events }) => events.some(rule => rule.id === prefix + '102'))?.topic;
  assert.ok(originalTopic && repeatedTopic);
  assert.notEqual(originalTopic, repeatedTopic);
  const material = buildReportMaterials(refs);
  for (const { text } of repeated.matchedBranches) assert.equal(material.split(text).length - 1, 1);
});
