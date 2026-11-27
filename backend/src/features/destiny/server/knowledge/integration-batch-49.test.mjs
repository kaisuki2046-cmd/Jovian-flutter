import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { earthlyBranches } from './dictionaries.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileJielanPalacePassages, jielanPalacePassageProfile } from './ziwei-source-passages.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-49-witnesses.json', import.meta.url)));
const idFor = suffix => 'ziwei-v2-jielan-101-' + suffix;
const ids = [
  'p011-018', 'p011-028', 'p011-034', 'p011-036',
  'p013-008', 'p013-009', 'p013-012', 'p013-016', 'p013-018', 'p013-028',
  'p018-004', 'p018-007', 'p018-024',
].map(idFor);
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inputsOf = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const factsFor = suffix => raw(witnesses.find(witness => witness.proofs.some(proof => proof.id === idFor(suffix))));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(suffix, facts, timeKnown = true) {
  const [query] = queries(facts, timeKnown);
  return explainClaim(idFor(suffix), 'ziwei', chartContext('ziwei', query.confirmedFacts), undefined, catalog);
}

test('native star placements establish every new group through SQLite and reporting', () => {
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, 13);
  assert.equal([...rows.values()].filter(row => row.compiler === jielanPalacePassageProfile).length, 6);
  const expected = new Set([...rows].flatMap(([id, row]) => inputsOf(row).flatMap(({ text, inputs, conditionCompiler }) => {
    if (text) assert.equal(conditionCompiler, jielanPalacePassageProfile);
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(expected.size, 14);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = chartContext('ziwei', parsed[0].confirmedFacts);
    const calculated = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = inputsOf(row).find(entry => entry.text === text)?.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input, id);
      assert.ok(evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && explanation.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
      seen.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(seen, expected);
});

test('each sector star needs its own natal placement and a confirmed cross-palace relation', () => {
  const suffix = 'p018-024';
  const facts = factsFor(suffix);
  assert.ok(explain(suffix, facts).matched);
  assert.match(explain(suffix, facts).calculationNote, /每颗辅曜均须获得证据/u);
  assert.equal(explain(suffix, facts, false).matched, false);
  const isNatalStar = fact => fact.kind === 'palace_star' && fact.scope === 'origin';
  for (const star of ['左辅', '右弼', '天魁', '天钺']) {
    assert.equal(explain(suffix, facts.filter(fact => !(isNatalStar(fact) && fact.star === star))).matched, false, star);
  }
  const supporter = facts.find(fact => isNatalStar(fact) && fact.star === '天钺' && fact.palace !== '官禄');
  assert.ok(supporter);
  const relation = facts.find(fact => fact.kind === 'palace_relation' && fact.anchor === '官禄' && fact.target === supporter.palace);
  assert.ok(relation);
  assert.ok(['trine', 'opposite'].includes(relation.relation));
  const fabricated = { kind: 'palace_sector_star', palace: '官禄', star: supporter.star };
  assert.equal(explain(suffix, [...facts.filter(fact => fact !== relation), fabricated]).matched, false);

  const position = facts.find(fact => fact.kind === 'palace_branch' && fact.palace === supporter.palace);
  const inconsistent = { ...position, branch: earthlyBranches[(earthlyBranches.indexOf(position.branch) + 1) % 12] };
  assert.equal(explain(suffix, [...facts, inconsistent]).matched, false);
  assert.equal(explain(suffix, facts.map(fact => fact === position ? inconsistent : fact)).matched, false);
});

test('explicit local conjunctions, anchors and the unproved transformation retain separate conditions', () => {
  const local = 'p018-004';
  const facts = factsFor(local);
  assert.ok(explain(local, facts).matched);
  const partner = facts.find(fact => fact.kind === 'palace_star' && fact.palace === '官禄' && fact.star === '太阴');
  const opposition = facts.find(fact => fact.kind === 'palace_relation' && fact.anchor === '官禄' && fact.relation === 'opposite');
  assert.ok(partner && opposition);
  assert.equal(explain(local, facts.map(fact => fact === partner ? { ...fact, palace: opposition.target } : fact)).matched, false);

  const exact = 'p013-028';
  const child = factsFor(exact);
  assert.ok(explain(exact, child).matched);
  assert.equal(explain(exact, child.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '子女')).matched, false);
  const pending = explain('p018-002', factsFor('p018-024'));
  assert.equal(pending.matched, false);
  assert.match(pending.reviewNote, /壬年魁钺在卯、巳/u);
  for (const [suffix, marker] of [['p011-016', /奇偶不同/u], ['p013-030', /相距五宫/u]]) {
    const unresolved = explain(suffix, child);
    assert.equal(unresolved.matched, false);
    assert.match(unresolved.reviewNote, marker);
  }
});

test('the provider materials use the verified sector excerpt and check the source fingerprint', async () => {
  const suffix = 'p011-018';
  const select = parsed => lookup(parsed).map(ref => ({ ...ref,
    personality: ref.personality.filter(hit => hit.id === idFor(suffix)),
    events: ref.events.filter(hit => hit.id === idFor(suffix)),
  }));
  const { report } = await generateReport({ chartQueries: queries(factsFor(suffix)) }, {
    lookup: select, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /加府曲左右，得力/u);
      assert.match(materials, /两处三合宫/u);
      assert.doesNotMatch(materials, /加羊陀，二人/u);
      return '捷览会照证据测试';
    },
  });
  assert.equal(report, '捷览会照证据测试');
  for (const id of ids) {
    const altered = structuredClone(catalog.get(id).claim);
    altered.evidence.context += '异本';
    assert.equal(compileJielanPalacePassages(altered).reason, 'source_review_required');
  }
});

test('all twelve default major-star layouts preserve the three pending sector conflicts', () => {
  const seen = new Set();
  const at = (facts, star) => {
    const placement = facts.find(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === star);
    return earthlyBranches.indexOf(facts.find(fact => fact.kind === 'palace_branch' && fact.palace === placement?.palace)?.branch);
  };
  for (let day = 1; day <= 180 && seen.size < 12; day++) {
    const calendar = new Date(Date.UTC(1992, 2, day));
    const profile = { gender: 'female', date: { year: calendar.getUTCFullYear(), month: calendar.getUTCMonth() + 1, day: calendar.getUTCDate() } };
    const facts = raw({ profile, timeIndex: day % 12 });
    assert.ok(facts.some(fact => fact.kind === 'natal_year_stem' && fact.stem === '壬'));
    const emperor = at(facts, '紫微'), treasury = at(facts, '天府');
    const same = at(facts, '天同'), beam = at(facts, '天梁');
    assert.ok([emperor, treasury, same, beam].every(index => index >= 0));
    assert.notEqual(treasury % 2, same % 2);
    assert.equal((beam - treasury + 12) % 12, 5);
    assert.deepEqual([at(facts, '天魁'), at(facts, '天钺')].map(index => earthlyBranches[index]), ['卯', '巳']);
    assert.ok(facts.some(fact => fact.kind === 'star_mutagen' && fact.star === '天梁' && fact.change === '禄'));
    seen.add(emperor);
  }
  assert.equal(seen.size, 12);
});
