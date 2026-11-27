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

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-104-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-b104-'));
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

test('the Sun and Moon must themselves carry the recorded Lu and Ke changes', () => {
  const facts = witness('035');
  assert.equal(explain('035', facts).matched, true);
  const withoutMoonKe = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '太阴' || fact.change !== '科');
  assert.equal(explain('035', withoutMoonKe).matched, false);
});

test('Dikong must be the only core star in the life palace for the solo passage', () => {
  const facts = witness('057');
  assert.equal(explain('057', facts).matched, true);
  const unknownCount = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
  assert.equal(explain('057', unknownCount).matched, false);
});

test('Zuo and You require a named main star carrying the auspicious change', () => {
  const facts = witness('064');
  assert.equal(explain('064', facts).matched, true);
  const noHost = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.palace !== '命宫');
  assert.equal(explain('064', noHost).matched, false);
  const noZuo = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '左辅');
  assert.equal(explain('064', noZuo).matched, false);
});

test('a malefic in the life palace alone cannot prove that it is the actual body palace', () => {
  const facts = witness('089');
  assert.equal(explain('089', facts).matched, true);
  const withoutHour = facts.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('089', withoutHour).matched, false);
});

test('both repeated records support independent explanations and supply one excerpt per report', () => {
  for (const [shortId, original] of [['092', '003'], ['099', '007']]) {
    const facts = witness(shortId), references = lookup(query(facts));
    const hit = references.flatMap(row => [...row.personality, ...row.events]).find(rule => rule.id === prefix + shortId);
    assert.ok(explain(shortId, facts).matched && explain(original, facts).matched);
    assert.ok(hit);
    const quote = hit.matchedBranches?.[0].text ?? hit.claim.evidence.original_text;
    const occurrences = rows => buildReportMaterials(rows).split(quote).length - 1;
    assert.equal(occurrences(references), 1);
    const reversed = references.map(row => ({ ...row, personality: row.personality.slice().reverse(), events: row.events.slice().reverse() }));
    assert.equal(occurrences(reversed), 1);
    const withoutOriginal = references.map(row => ({ ...row,
      personality: row.personality.filter(rule => rule.id !== prefix + original),
      events: row.events.filter(rule => rule.id !== prefix + original) }));
    assert.equal(occurrences(withoutOriginal), 1);
  }
});
