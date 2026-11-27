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
import { compileZiweiGusuiSources, ziweiGusuiProfile } from './ziwei-gusui-sources.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-52-witnesses.json', import.meta.url)));
const idOf = number => 'ziwei-v3-jielan-123-p001-' + String(number).padStart(3, '0');
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputsOf = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const matchesFact = (facts, pattern) => facts.some(fact => Object.entries(pattern).every(([key, value]) => fact[key] === value));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context(query) {
  return chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts);
}

function explain(number, facts, timeKnown = true) {
  return explainClaim(idOf(number), 'ziwei', context(queries(facts, timeKnown)[0]), undefined, catalog);
}

function chartFor(number, pattern = {}) {
  const witness = witnesses.find(witness => witness.proofs.some(proof => proof.id === idOf(number)) && matchesFact(raw(witness), pattern));
  assert.ok(witness, idOf(number));
  return raw(witness);
}

test('all reviewed Bone Marrow Ode alternatives reach SQLite and report materials from actual charts', () => {
  const rows = new Map([...new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))]
    .map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 23);
  assert.equal([...rows.values()].filter(row => row.compiler === ziweiGusuiProfile).length, 9);
  const expected = new Set([...rows].flatMap(([id, row]) => inputsOf(row).flatMap(({ text, inputs, conditionCompiler }) => {
    assert.equal(conditionCompiler ?? row.compiler, ziweiGusuiProfile);
    if (text) assert.ok(row.claim.evidence.original_text.includes(text));
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 85);
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
      assert.match(explanation.calculationNote, /斗数骨髓赋注解/u);
      seen.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(seen, expected);
  for (const row of rows.values()) {
    const altered = structuredClone(row.claim);
    altered.evidence.context += '异本';
    assert.equal(compileZiweiGusuiSources(altered).reason, 'source_review_required');
  }
});

test('the Sun and Moon must occupy their stated branches and verified trines', () => {
  const facts = chartFor(31);
  const sun = facts.find(fact => fact.kind === 'palace_star' && fact.star === '太阳' && fact.scope === 'origin');
  const moon = facts.find(fact => fact.kind === 'palace_star' && fact.star === '太阴' && fact.scope === 'origin');
  assert.equal(sun.palace, '官禄');
  assert.equal(moon.palace, '财帛');
  const switched = facts.map(fact => fact === sun ? { ...fact, palace: moon.palace } : fact === moon ? { ...fact, palace: sun.palace } : fact);
  assert.equal(explain(31, switched).matched, false);
  const missingRelation = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '命宫' || fact.target !== '财帛');
  assert.equal(explain(31, missingRelation).matched, false);
  assert.equal(explain(31, facts, false).matched, false);
});

test('a flanking pair requires both adjacent seats and proven absence in the natal Life palace', () => {
  const facts = chartFor(93);
  const adjacent = facts.find(fact => fact.kind === 'palace_relation' && fact.anchor === '命宫' && fact.target === '兄弟');
  assert.ok(explain(93, facts).matched);
  assert.equal(explain(93, facts.filter(fact => fact !== adjacent)).matched, false);
  const incomplete = facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
  assert.equal(explain(93, incomplete).matched, false);
  const contradicted = [...facts, { kind: 'palace_star', palace: '命宫', star: '擎羊', scope: 'origin' }];
  assert.equal(explain(93, contradicted).matched, false);
});

test('the 寅亥 concordance binds the correct transformation host and preserves the impossible historical example', () => {
  const concordance = chartFor(108);
  const lu = concordance.find(fact => fact.kind === 'palace_star' && fact.star === '禄存');
  const change = concordance.find(fact => fact.kind === 'star_mutagen' && fact.star === '武曲' && fact.change === '科');
  assert.equal(lu.palace, '田宅');
  assert.match(explain(108, concordance).calculationNote, /寅亥合/u);
  assert.equal(explain(108, concordance.map(fact => fact === lu ? { ...fact, palace: '命宫' } : fact)).matched, false);
  assert.equal(explain(108, concordance.map(fact => fact === change ? { ...fact, palace: '田宅' } : fact)).matched, false);
  assert.equal(explain(108, [...concordance, { kind: 'natal_year_stem', stem: '丁' }]).reason, 'conflicting_natal_year_placement');
  const unproved = explain(91, concordance);
  assert.equal(unproved.matched, false);
  assert.match(unproved.reviewNote, /廉贞在亥时破军落未/u);
});

test('the Earth Void examples require one confirmed birth hour', () => {
  const facts = chartFor(119, { kind: 'natal_ziwei_hour', branch: '子' });
  assert.ok(explain(119, facts).matched);
  assert.equal(explain(119, facts.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  assert.equal(explain(119, [...facts, { kind: 'natal_ziwei_hour', branch: '午' }]).matched, false);
});

test('one confirmed birth stem sends only its named grade to the provider', async () => {
  const id = idOf(40);
  const facts = chartFor(40, { kind: 'natal_year_stem', stem: '己' });
  const { report } = await generateReport({ chartQueries: queries(facts) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === id), events: ref.events.filter(hit => hit.id === id),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /己生人次之/u);
      assert.doesNotMatch(materials, /丁生人上格|癸生人主富/u);
      return '天梁生年分句测试';
    },
  });
  assert.equal(report, '天梁生年分句测试');
});
