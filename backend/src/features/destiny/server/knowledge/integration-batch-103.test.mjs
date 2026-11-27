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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-103-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b103-'));
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

test('absence of surrounding benefics requires complete star lists for the linked palaces', () => {
  const facts = witness('007');
  assert.equal(explain('007', facts).matched, true);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count');
  assert.equal(explain('007', incomplete).matched, false);
});

test('fallen Lianzhen in the migration body palace has an actual adjacent benefic', () => {
  const profile = { date: { year: 1924, month: 2, day: 9 }, gender: 'male' };
  const facts = native({ profile, timeIndex: 3 });
  assert.ok(facts.some(fact => fact.kind === 'body_palace' && fact.palace === '迁移'));
  assert.ok(facts.some(fact => fact.kind === 'palace_brightness' && fact.palace === '迁移'
    && fact.star === '廉贞' && fact.brightness === '陷'));
  assert.ok(facts.some(fact => fact.kind === 'palace_star' && fact.palace === '仆役' && fact.star === '左辅'));
  assert.ok(facts.some(fact => fact.kind === 'palace_relation' && fact.anchor === '迁移'
    && fact.target === '仆役' && fact.relation === 'adjacent'));
  assert.equal(explain('007', facts).matched, false);
});

test('Lu and Ma must share the life palace and receive an actual trine transformation', () => {
  const facts = witness('026');
  assert.equal(explain('026', facts).matched, true);
  const movedMa = facts.map(fact => fact.kind === 'palace_star' && fact.star === '天马'
    ? { ...fact, palace: '迁移' } : fact);
  assert.equal(explain('026', movedMa).matched, false);
  const withoutChange = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.change === '忌');
  assert.equal(explain('026', withoutChange).matched, false);
});

test('the Tanlang and Huo passage checks the brightness of both co-seated stars', () => {
  const facts = witness('028');
  assert.equal(explain('028', facts).matched, true);
  const unconfirmed = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.star !== '火星');
  assert.equal(explain('028', unconfirmed).matched, false);
});

test('the two Chang and Qu stars require additional evidence of natal change and an external benefic', () => {
  const facts = witness('060');
  assert.equal(explain('060', facts).matched, true);
  const withoutChange = facts.filter(fact => fact.kind !== 'palace_mutagen' || fact.palace !== '命宫');
  assert.equal(explain('060', withoutChange).matched, false);
  const withoutQu = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文曲');
  assert.equal(explain('060', withoutQu).matched, false);
});

test('the Chen and Xu Ziwei passage uses opposite Po Jun rather than mere co-occurrence', () => {
  const facts = witness('071');
  assert.equal(explain('071', facts).matched, true);
  const colocated = facts.map(fact => fact.kind === 'palace_star' && fact.star === '破军'
    ? { ...fact, palace: '命宫' } : fact);
  assert.equal(explain('071', colocated).matched, false);
});

test('the Ke and Quan passage requires both changes in different external palaces', () => {
  const facts = witness('110');
  assert.equal(explain('110', facts).matched, true);
  const { palace } = facts.find(fact => fact.kind === 'palace_mutagen' && fact.change === '科');
  const colocated = facts.map(fact => fact.kind === 'palace_mutagen' && fact.change === '权'
    ? { ...fact, palace } : fact);
  assert.equal(explain('110', colocated).matched, false);
});
