import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-34-20261119.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-34-witnesses.json', import.meta.url)));
const soloId = 'ziwei-v2-xingjue-026-p438-001';
const bells = ['ziwei-v1-zhuxing-wenda-p168000-001', 'ziwei-v4-jielan-222-p001-001'];
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const rawFacts = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const catalog = catalogForDirectory(catalogDirectory);

test('all 19 live alternatives reach the SQLite query, explanation and report from native birth charts', () => {
  const lookup = createReportLookup();
  const seen = new Set();
  assert.equal(witnesses.targetAlternatives, 19);
  assert.deepEqual(witnesses.missing, []);
  for (const witness of witnesses.witnesses) {
    const [parsed] = parseChartQueries([query(rawFacts(witness))]);
    const context = chartContext('ziwei', parsed.confirmedFacts, [], 'natal');
    const derived = claimChartContext('ziwei', context);
    const references = lookup([parsed]);
    const hits = references.flatMap(row => [...row.personality, ...row.events]);
    const materials = buildReportMaterials(references);
    for (const proof of witness.proofs) {
      assert.ok(hits.some(hit => hit.id === proof.id), proof.id);
      const row = catalog.get(proof.id);
      const input = row.inputs.find(item => digest(item) === proof.inputDigest);
      assert.ok(input);
      assert.ok(evaluateRule(input, 'natal', derived).matched);
      assert.ok(explainClaim(proof.id, 'ziwei', context, undefined, catalog).matched);
      assert.ok(materials.includes(row.claim.evidence.original_text));
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.flatMap(row => row.inputs.map(input => row.id + ':' + input.digest)).sort());
});

test('the shared life/body position always has earth robbery alongside earth void and remains in the review list', () => {
  const row = catalog.get(soloId);
  assert.equal(row.inputs.length, 5);
  assert.equal(row.remainingAlternatives, 1);
  assert.deepEqual(row.inputs.map(input => input.required.find(fact => fact.kind === 'body_palace').palace).sort(),
    ['夫妻', '财帛', '迁移', '官禄', '福德'].sort());
  const pending = pendingClaimConditions({ catalog }).find(item => item.id === soloId);
  assert.match(pending.reviewNote, /地空与地劫必同宫/u);
  for (const timeIndex of [0, 6, 12]) {
    for (let month = 1; month <= 12; month++) {
      const chart = calculateZiwei({ date: { year: 1984, month, day: 15 }, gender: 'female' }, timeIndex);
      assert.equal(chart.palaces.find(palace => palace.isBodyPalace).name, '命宫');
      const earthVoid = chart.palaces.find(palace => palace.minorStars.some(star => star.name === '地空'));
      assert.ok(earthVoid.minorStars.some(star => star.name === '地劫'));
    }
  }
});

test('missing palace evidence, misplaced body and unknown birth time do not manufacture a single seat', () => {
  const witness = witnesses.witnesses.find(row => row.proofs.some(proof => proof.id === soloId));
  const facts = rawFacts(witness);
  const bodyPalace = facts.find(fact => fact.kind === 'body_palace').palace;
  const matches = values => lookupInterpretations(catalogDirectory, query(values)).some(hit => hit.id === soloId);
  assert.ok(matches(facts));
  const incomplete = facts.filter(fact => !(fact.kind === 'palace_origin_star_count' && fact.palace === bodyPalace));
  assert.ok(!matches([...incomplete, { kind: 'palace_core_star_count', count: 1, palace: bodyPalace }]));
  assert.ok(!matches(facts.map(fact => fact.kind === 'body_palace' ? { ...fact, palace: '兄弟' } : fact)));
  const [unknownTime] = parseChartQueries([query(facts)], { timeKnown: false });
  assert.ok(!matches(unknownTime.confirmedFacts));
});

test('bell sources retain separate IDs and require an actual life or body palace', () => {
  const witness = witnesses.witnesses.find(row => row.proofs.some(proof => proof.id === bells[0]));
  const facts = rawFacts(witness);
  const both = lookupInterpretations(catalogDirectory, query(facts)).filter(hit => bells.includes(hit.id));
  assert.deepEqual(both.map(hit => hit.id).sort(), [...bells].sort());
  assert.ok(both.every(hit => !hit.matchedBranches?.length));
  const otherPalace = [{ kind: 'palace_star', palace: '兄弟', star: '铃星', scope: 'origin' }];
  assert.ok(lookupInterpretations(catalogDirectory, query(otherPalace)).every(hit => !bells.includes(hit.id)));
});
