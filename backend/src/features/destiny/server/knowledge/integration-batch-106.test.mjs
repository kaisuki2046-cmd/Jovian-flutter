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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-106-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b106-'));
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

test('the Qisha passage requires the confirmed natal Ji to be outside the life palace', () => {
  const facts = witness('030');
  assert.equal(explain('030', facts).matched, true);
  const noHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain('030', noHost).matched, false);
  assert.equal(explain('030', [...noHost, { kind: 'palace_life_without_natal_ji' }]).matched, false);
  const conflict = [...facts, { kind: 'palace_mutagen', palace: '命宫', change: '忌', scope: 'origin' }];
  assert.equal(explain('030', conflict).matched, false);
  const wrongStem = facts.map(fact => fact.kind === 'natal_year_stem'
    ? { ...fact, stem: fact.stem === '甲' ? '乙' : '甲' } : fact);
  assert.equal(explain('030', wrongStem).matched, false);
});

test('Ji Yue Tong Liang requires the four named stars on one three-palace axis', () => {
  const facts = witness('033');
  assert.equal(explain('033', facts).matched, true);
  const withoutLiang = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天梁');
  assert.equal(explain('033', withoutLiang).matched, false);
});

test('Lianzhen and Qisha require the external trine and both Void stars', () => {
  const facts = witness('056');
  assert.equal(explain('056', facts).matched, true);
  const withoutQisha = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '七杀');
  assert.equal(explain('056', withoutQisha).matched, false);
  const withoutVoid = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '地劫');
  assert.equal(explain('056', withoutVoid).matched, false);
});

test('opposed luminaries need an actual favorable change in the trines and full absence evidence', () => {
  const facts = witness('077');
  assert.equal(explain('077', facts).matched, true);
  const withoutChange = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change === '忌');
  assert.equal(explain('077', withoutChange).matched, false);
  const withoutLists = facts.filter(fact => fact.kind !== 'palace_origin_star_count');
  assert.equal(explain('077', withoutLists).matched, false);
});

test('the repeated Kui and Yue passage can be explained by both IDs and is quoted once', () => {
  const facts = witness('090'), original = explain('001', facts), repeated = explain('090', facts);
  assert.ok(original.matched && repeated.matched);
  assert.deepEqual(original.matchedBranches, repeated.matchedBranches);
  const quote = repeated.matchedBranches[0].text;
  const references = lookup(query(facts));
  const originalTopic = references.find(({ events }) => events.some(rule => rule.id === prefix + '001'))?.topic;
  const repeatedTopic = references.find(({ events }) => events.some(rule => rule.id === prefix + '090'))?.topic;
  assert.ok(originalTopic && repeatedTopic);
  assert.notEqual(originalTopic, repeatedTopic);
  assert.equal(buildReportMaterials(references).split(quote).length - 1, 1);
  assert.equal(buildReportMaterials(references.slice().reverse()).split(quote).length - 1, 1);
  const onlyRepeated = references.map(row => ({ ...row,
    personality: row.personality.filter(rule => rule.id !== prefix + '001'),
    events: row.events.filter(rule => rule.id !== prefix + '001') }));
  assert.equal(buildReportMaterials(onlyRepeated).split(quote).length - 1, 1);
});

test('the Chang and Tanlang passage requires a natal change and a same-palace malefic', () => {
  const facts = witness('121');
  assert.equal(explain('121', facts).matched, true);
  const four = new Set(['擎羊', '陀罗', '火星', '铃星']);
  const withoutMalefic = facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '命宫' || !four.has(fact.star));
  assert.equal(explain('121', withoutMalefic).matched, false);
  const withoutJi = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change !== '忌');
  assert.equal(explain('121', withoutJi).matched, false);
});
