import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFortitudeRanges } from './lilly-fortitudes.mjs';
import { lillyFortune } from './lilly-fortune.mjs';
import { compileLillyWealthDuration, lillyWealthDurationProfile } from './lilly-wealth-duration.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-wealth-strength-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-wealth-strength-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, tiedOccupants } = JSON.parse(readFileSync(new URL('./claims/integration-batch-177-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-wealth-duration-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const query = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog);
};
const cellsAt = (sign, degree) => catalog.lillyDignityCells(sign, degree);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const isPrincipal = f => f.kind === 'western_lilly_wealth_principal';
const isScore = f => f.kind === 'western_lilly_wealth_score';
const sampleFor = number => witnesses.find(sample => sample.proofs.some(row => row.id === idOf(number)));
const second = raw => lillyHouseFacts(raw).filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 2);

test('all wealth strength and selection groups reach the SQLite lookup, explanations and report materials', () => {
  const expected = new Map();
  for (const id of [1, 2, 4, 5, 14, 16].map(idOf)) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyWealthDurationProfile, id);
    assert.equal(row.remainingAlternatives, 1, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyWealthDuration(changed).reason, 'source_review_required');
    for (const input of row.inputs) expected.set(id + ':' + digest(input), input);
  }
  assert.equal(expected.size, 16);
  const rows = catalog.lillyFortitudeRows();
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000), sample.date);
    const raw = rawOf(sample), q = query(raw), base = context(q);
    const chart = claimChartContext('western', base, [], cellsAt, () => rows);
    const references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
      const result = explainClaim(id, 'western', base, q.tradition, catalog);
      assert.equal(result.matched, true, key);
      assert.ok(hits.some(hit => hit.id === id), key);
      assert.ok(materials.includes(result.claim.evidence.original_text), key);
      const facts = proof(result), principal = facts.find(isPrincipal);
      const scores = facts.filter(isScore);
      assert.ok(principal && scores.some(fact => fact.planet === principal.planet), key);
      assert.ok(materials.includes(factText(principal)), key);
      for (const score of scores) assert.ok(materials.includes(factText(score)), key);
      if (principal.basis === 'strongest_occupant') {
        assert.deepEqual(new Set(scores.map(fact => fact.planet)), new Set(second(raw).map(fact => fact.planet)), key);
        const chosen = scores.find(fact => fact.planet === principal.planet);
        assert.ok(scores.every(fact => fact === chosen || chosen.min > fact.max), key);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('no principal is inferred from equal scores, incomplete placements or supplied selector facts', () => {
  const tie = rawOf(tiedOccupants);
  const ranges = lillyFortitudeRanges(tie, cellsAt, catalog.lillyFortitudeRows());
  const ranked = second(tie).map(({ planet }) => ranges.get(planet)).sort((a, b) => b.max - a.max);
  assert.ok(ranked.length > 1);
  assert.equal(ranked[0].min, ranked[0].max);
  assert.equal(ranked[0].min, ranked[1].min);
  assert.equal(ranked[1].min, ranked[1].max);
  assert.equal(explain(14, tie).matched, false);

  const native = rawOf(sampleFor(14)), detail = explain(14, native);
  const principal = proof(detail).find(isPrincipal);
  const challenger = second(native).find(fact => fact.planet !== principal.planet).planet;
  const incomplete = native.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== challenger);
  assert.equal(explain(14, [...incomplete, ...proof(detail)]).matched, false);
  assert.equal(explain(14, native, false).matched, false);
});

test('a balanced shared ruler needs an actually empty second house and confirmed positive and negative factors', () => {
  const raw = rawOf(sampleFor(16)), detail = explain(16, raw);
  const principal = proof(detail).find(isPrincipal), score = proof(detail).find(isScore);
  assert.equal(second(raw).length, 0);
  assert.equal(principal.basis, 'shared_ruler');
  assert.equal(principal.planet, lillyFortune(raw).ruler);
  assert.ok(lillyHouseFacts(raw).some(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 2 && fact.planet === principal.planet));
  assert.deepEqual([score.min, score.max], [0, 0]);
  const { confirmedFactors } = lillyFortitudeRanges(raw, cellsAt, catalog.lillyFortitudeRows()).get(principal.planet);
  assert.ok(confirmedFactors.some(factor => factor.points > 0));
  assert.ok(confirmedFactors.some(factor => factor.points < 0));
  const withoutSecondCusp = raw.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 2);
  assert.equal(explain(16, [...withoutSecondCusp, ...proof(detail)]).matched, false);
});

test('incomplete adverse evidence does not become a confirmed strong placement', () => {
  const raw = rawOf(sampleFor(1)), detail = explain(1, raw);
  assert.equal(detail.matched, true);
  const withoutAlgol = raw.filter(fact => fact.kind !== 'western_fixed_star_longitude' || fact.star !== 'caput_algol');
  assert.equal(explain(1, [...withoutAlgol, ...proof(detail)]).matched, false);
});
