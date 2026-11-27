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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-100-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b100-'));
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

test('the named flanking pair requires both observed neighbors and a complete life-palace list', () => {
  const isSunMoon = ({ text }) => text?.startsWith('如太阳太阴');
  const facts = witness('003', isSunMoon);
  const sunMoon = rows => rows.matchedBranches?.some(isSunMoon) ?? false;
  assert.ok(sunMoon(explain('003', facts)));
  const withoutSun = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '太阳');
  assert.equal(sunMoon(explain('003', withoutSun)), false);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
  assert.equal(sunMoon(explain('003', incomplete)), false);
  assert.equal(explain('003', facts, false).matched, false);
});

test('the body-palace flanking passage requires a body seat confirmed from the natal hour', () => {
  const isSunMoon = ({ text }) => text?.startsWith('如太阳太阴');
  const branch = catalog.get(prefix + '003').branches.find(isSunMoon);
  const bodyGroups = new Set(branch.inputs.filter(input =>
    input.required.some(fact => fact.kind === 'palace_confirmed_body_seat')).map(digest));
  const facts = witness('003', proof => bodyGroups.has(proof.inputDigest));
  assert.ok(explain('003', facts).matchedBranches.some(isSunMoon));
  const { palace } = facts.find(fact => fact.kind === 'body_palace');
  const forged = [...facts.filter(fact => fact.kind !== 'body_palace'), { kind: 'palace_confirmed_body_seat', palace }];
  assert.equal(explain('003', forged).matchedBranches?.some(isSunMoon) ?? false, false);
});

test('the reversed Chang-Qu orientation places Dikong in the flanked life palace', () => {
  const changQu = ({ text }) => text?.startsWith('如昌曲');
  const supported = witness('003', changQu);
  assert.ok(explain('003', supported).matchedBranches.some(changQu));
  for (const timeIndex of [4, 10]) {
    const facts = native({ profile: { date: { year: 1924, month: 10, day: 28 }, gender: 'male' }, timeIndex });
    assert.ok(facts.some(fact => fact.kind === 'palace_star' && fact.palace === '命宫' && fact.star === '地空'));
    assert.ok(facts.some(fact => fact.kind === 'palace_star' && fact.palace === '兄弟' && fact.star === '文昌'));
    assert.ok(facts.some(fact => fact.kind === 'palace_star' && fact.palace === '父母' && fact.star === '文曲'));
    assert.equal(explain('003', facts).matchedBranches?.some(changQu) ?? false, false);
  }
});

test('the Jia-year example remains unresolved under both observed main-star layouts', () => {
  for (const [month, day, timeIndex, luSeat, quanSeat] of [[2, 28, 2, '巳', '丑'], [6, 14, 6, '亥', '未']]) {
    const facts = native({ profile: { date: { year: 1924, month, day }, gender: 'male' }, timeIndex });
    assert.ok(facts.some(fact => fact.kind === 'natal_year_stem' && fact.stem === '甲'));
    assert.ok(facts.some(fact => fact.kind === 'palace_branch' && fact.palace === '命宫' && fact.branch === '子'));
    for (const [star, change, branch] of [['廉贞', '禄', luSeat], ['破军', '权', quanSeat]]) {
      const host = facts.find(fact => fact.kind === 'star_mutagen' && fact.star === star && fact.change === change);
      assert.ok(host);
      assert.ok(facts.some(fact => fact.kind === 'palace_branch' && fact.palace === host.palace && fact.branch === branch));
    }
    const detail = explain('002', facts);
    assert.equal(detail.matched, false);
    assert.match(detail.reviewNote, /组合不可同盘/u);
  }
});

test('the life-palace no-malefics passage needs all four sectors', () => {
  const facts = witness('019');
  assert.ok(explain('019', facts).matched);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '财帛');
  assert.equal(explain('019', incomplete).matched, false);
});

test('trine witnesses must come from actual origin stars', () => {
  const facts = witness('109');
  assert.ok(explain('109', facts).matched);
  const withoutZiwei = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '紫微');
  const forged = { kind: 'palace_trine_star', palace: '命宫', star: '紫微' };
  assert.equal(explain('109', [...withoutZiwei, forged]).matched, false);
  const { palace } = facts.find(fact => fact.kind === 'palace_star' && fact.star === '天府');
  const colocated = [...withoutZiwei, { kind: 'palace_star', palace, star: '紫微', scope: 'origin' }];
  assert.equal(explain('109', colocated).matched, false);
});
