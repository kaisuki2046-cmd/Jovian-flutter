import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileZiweiSoloSources, ziweiSoloSourceProfile } from './ziwei-solo-sources.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-51-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const ids = {
  soloMoon: 'ziwei-v2-jielan-101-p013-027',
  soloAuxiliary: 'ziwei-v2-minggong-p242001-003',
  careerHorse: 'ziwei-v2-xingjue-014-p343-001',
  body: 'ziwei-v2-xingjue-016-p362-001',
  coupleMusic: 'ziwei-v3-xingjue-049-p616-001',
  children: 'ziwei-v3-xingjue-050-p644-001',
  wealth: 'ziwei-v3-xingjue-051-p657-001',
  travel: 'ziwei-v3-xingjue-053-p695-001',
  career: 'ziwei-v3-xingjue-055-p716-001',
  home: 'ziwei-v3-xingjue-056-p737-001',
  linked: 'ziwei-v3-xingjue-056-p744-001',
  transformation: 'ziwei-v3-xingjue-056-p816-001',
  life: 'ziwei-v2-xingjue-004-p1063-001',
  absence: 'ziwei-v2-xingjue-004-p1065-001',
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputsOf = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const starFact = (palace, star) => ({ kind: 'palace_star', palace, star, scope: 'origin' });

function queries(confirmedFacts, confirmedAbsentFacts = [], timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts, confirmedAbsentFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context(query) {
  return chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts);
}

function explain(id, facts, absent = [], timeKnown = true) {
  return explainClaim(id, 'ziwei', context(queries(facts, absent, timeKnown)[0]), undefined, catalog);
}

function chartFor(id, qualifies = () => true) {
  const witness = witnesses.find(witness => witness.proofs.some(proof => proof.id === id) && qualifies(raw(witness)));
  assert.ok(witness, id);
  return raw(witness);
}

test('reviewed solo-seat alternatives reach SQLite, explanations and reports from native charts', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  assert.equal([...rows.values()].filter(row => row.compiler === ziweiSoloSourceProfile).length, 8);
  const expected = new Set([...rows].flatMap(([id, row]) => inputsOf(row).flatMap(({ text, inputs, conditionCompiler }) => {
    if (text) {
      assert.equal(conditionCompiler, ziweiSoloSourceProfile);
      assert.ok(row.claim.evidence.original_text.includes(text));
    }
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 22);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = context(parsed[0]);
    const calculated = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = inputsOf(row).find(entry => entry.text === text)?.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input && evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && explanation.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
      assert.match(explanation.calculationNote, /唯一正曜/u);
      seen.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(seen, expected);
});

test('single principal stars require consistent counts and single auxiliary stars require complete origin evidence', () => {
  const facts = chartFor(ids.soloMoon);
  const mainCount = facts.find(fact => fact.kind === 'palace_main_count' && fact.palace === '子女');
  assert.equal(mainCount.count, 1);
  assert.equal(explain(ids.soloMoon, facts.filter(fact => fact !== mainCount)).matched, false);
  assert.equal(explain(ids.soloMoon, [...facts, { ...mainCount, count: 2 }]).matched, false);
  const partial = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '子女');
  assert.equal(explain(ids.soloMoon, [...partial, starFact('子女', '天同')]).matched, false);
  assert.equal(explain(ids.soloMoon, facts, [], false).matched, false);

  const auxiliary = chartFor(ids.soloAuxiliary);
  const seat = auxiliary.find(fact => fact.kind === 'palace_star' && fact.star === '禄存').palace;
  const incomplete = auxiliary.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== seat);
  const forged = { kind: 'palace_core_star_count', palace: seat, count: 1 };
  assert.equal(explain(ids.soloAuxiliary, [...incomplete, forged]).matched, false);
  const pair = auxiliary.map(fact => fact.kind === 'palace_origin_star_count' && fact.palace === seat
    ? { ...fact, count: fact.count + 1 } : fact);
  assert.equal(explain(ids.soloAuxiliary, [...pair, starFact(seat, '文昌')]).matched, false);
});

test('Body binding, designated trine and opposite seats, and the host of a transformation must agree', () => {
  const anchor = '官禄';
  const body = chartFor(ids.body, facts => facts.some(fact => fact.kind === 'body_palace' && fact.palace === anchor)
    && facts.some(fact => fact.kind === 'palace_branch' && fact.palace === anchor && fact.branch === '子'));
  assert.equal(explain(ids.body, body.filter(fact => fact.kind !== 'body_palace')).matched, false);
  assert.equal(explain(ids.body, [...body, { kind: 'body_palace', palace: '命宫' }]).matched, false);

  const linked = chartFor(ids.linked);
  const relation = linked.find(fact => fact.kind === 'palace_relation' && fact.anchor === '田宅' && fact.relation === 'opposite');
  const placement = linked.find(fact => fact.kind === 'palace_branch' && fact.palace === relation.target);
  assert.equal(placement.branch, '亥');
  assert.equal(explain(ids.linked, linked.filter(fact => fact !== relation)).matched, false);
  assert.equal(explain(ids.linked, [...linked, { ...placement, branch: '丑' }]).matched, false);
  const moved = linked.map(fact => fact.kind === 'palace_star' && fact.star === '武曲' && fact.palace === relation.target
    ? { ...fact, palace: '田宅' } : fact);
  assert.equal(explain(ids.linked, moved).matched, false);

  const transformed = chartFor(ids.transformation);
  const mutagen = transformed.find(fact => fact.kind === 'star_mutagen' && fact.palace === '田宅' && fact.star === '贪狼');
  assert.equal(mutagen.change, '忌');
  assert.equal(explain(ids.transformation, transformed.map(fact => fact === mutagen ? { ...fact, star: '武曲' } : fact)).matched, false);
  const contradiction = explain(ids.transformation, [...transformed, { ...mutagen, change: '权' }]);
  assert.equal(contradiction.reason, 'conflicting_natal_year_placement');
});

test('proving the absence of both assistants requires all four original sectors', () => {
  const facts = chartFor(ids.absence);
  const alleged = catalog.get(ids.absence).branches[0].inputs[0].mustBeAbsent;
  const opposite = facts.find(fact => fact.kind === 'palace_relation' && fact.anchor === '命宫' && fact.relation === 'opposite');
  assert.equal(alleged.length, 2);
  const partial = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== opposite.target);
  assert.equal(explain(ids.absence, partial, alleged).matched, false);
  const full = facts.map(fact => fact.kind === 'palace_origin_star_count' && fact.palace === opposite.target
    ? { ...fact, count: fact.count + 1 } : fact);
  for (const { star } of alleged) {
    assert.equal(explain(ids.absence, [...full, starFact(opposite.target, star)], alleged).matched, false);
  }
});

test('only the proved source excerpt reaches the provider and changed source requires review', async () => {
  const id = ids.wealth;
  const { report } = await generateReport({ chartQueries: queries(chartFor(id)) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /午地財七殺單守者財富/u);
      assert.doesNotMatch(materials, /失地爭地/u);
      return '独守分句取材测试';
    },
  });
  assert.equal(report, '独守分句取材测试');
  for (const id of Object.values(ids)) {
    const changed = structuredClone(catalog.get(id).claim);
    changed.evidence.context += '异本';
    assert.equal(compileZiweiSoloSources(changed).reason, 'source_review_required');
  }
});
