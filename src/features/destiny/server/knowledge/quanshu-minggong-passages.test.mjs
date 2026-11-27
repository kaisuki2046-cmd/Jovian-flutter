import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQuanshuMinggongPassage, quanshuMinggongPassageProfile } from './quanshu-minggong-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-minggong-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-80-witnesses.json', import.meta.url)));
const nextBatch = JSON.parse(readFileSync(new URL('./claims/integration-batch-81-witnesses.json', import.meta.url)));
const recentBatch = JSON.parse(readFileSync(new URL('./claims/integration-batch-116-witnesses.json', import.meta.url)));
const trineBatch = JSON.parse(readFileSync(new URL('./claims/integration-batch-117-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v2-minggong-';
const reviewed = new Set(fixture.ids.map(id => prefix + id));
const raw = ([year, month, day, timeIndex, gender]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, timeIndex));
const hitList = references => references.flatMap(({ events, personality }) => [...events, ...personality]);
const key = (id, text, conditions) => JSON.stringify([id, text ?? null, conditions.required]);
const chart = facts => chartContext('ziwei', facts);

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(id, facts, scope = 'natal') {
  return explainClaim(prefix + id, 'ziwei', chartContext('ziwei', facts, [], scope), undefined, catalog);
}

function witness(id, predicate = () => true, batch = fixture) {
  const row = catalog.get(prefix + id);
  const inputs = row.inputs ?? row.branches.flatMap(({ inputs }) => inputs);
  for (const entry of batch.witnesses) {
    const facts = raw(entry);
    if (!predicate(facts)) continue;
    const derived = claimChartContext('ziwei', chart(facts));
    if (inputs.some(input => evaluateRule(input, 'natal', derived).matched)) return facts;
  }
  assert.fail('Missing witness for ' + id);
}

function verifyPassages(batch) {
  const ids = new Set(batch.ids.map(id => prefix + id));
  assert.equal(ids.size, batch.sourceRecords);
  let wholeRecords = 0;
  const expected = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    const candidates = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of candidates) {
      assert.equal(conditionCompiler, quanshuMinggongPassageProfile, id);
      assert.ok(text === undefined || row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.add(key(id, text, input));
    }
  }
  assert.equal(wholeRecords, batch.wholeRecords);
  assert.equal(expected.size, batch.groups);
  const seen = new Set();
  for (const sample of batch.witnesses) {
    const parsed = query(raw(sample));
    const refs = lookup(parsed), materials = buildReportMaterials(refs);
    for (const hit of hitList(refs).filter(hit => ids.has(hit.id))) {
      const parts = hit.matchedBranches ?? [{ matchedConditions: hit.matchedConditions }];
      for (const { text, matchedConditions } of parts) {
        const resolved = key(hit.id, text, matchedConditions);
        assert.ok(expected.has(resolved), hit.id);
        if (seen.has(resolved)) continue;
        const proof = explainClaim(hit.id, 'ziwei', chart(parsed[0].confirmedFacts), undefined, catalog);
        assert.ok(proof.matched, hit.id);
        assert.match(proof.calculationNote, /命宫表和歌诀/u);
        if (text) assert.ok(proof.matchedBranches.some(branch => branch.text === text), hit.id);
        assert.ok(materials.includes(text ?? proof.claim.evidence.original_text), hit.id);
        assert.ok(materials.includes(conditionsText(matchedConditions)), hit.id);
        seen.add(resolved);
      }
    }
  }
  assert.deepEqual(seen, expected);
}

test('all reviewed Minggong alternatives reach SQLite, explanations and report materials', () => {
  verifyPassages(fixture);
  const changed = structuredClone(catalog.get(prefix + 'p110000-007').claim);
  changed.evidence.context += ' changed source';
  assert.equal(compileQuanshuMinggongPassage(changed).reason, 'source_review_required');
  assert.equal(catalog.get(prefix + 'p104000-005').reason, 'unmapped_condition');
  assert.deepEqual(catalog.get(prefix + 'p168000-004').branches[0].inputs.map(input =>
    input.required.find(f => f.kind === 'palace_branch').branch), ['丑', '未']);
});

test('the indicated original-grade passage keeps only the qualifying birth cohort', () => {
  const positive = 'p118000-001', other = 'p118000-002', facts = witness(positive);
  assert.deepEqual(explain(positive, facts).matchedBranches.map(branch => branch.text), ['丁己生人财官格']);
  assert.equal(explain(other, facts).matched, false);
  const conflict = [...facts, { kind: 'natal_year_stem', stem: '丙' }];
  assert.equal(explain(positive, conflict).matched, false);
  assert.equal(explain(other, conflict).matched, false);
  const annual = facts.map(f => f.scope === 'origin' ? { ...f, scope: 'yearly' } : f);
  assert.equal(explain(positive, annual, 'annual').reason, 'calculation_profile');
  assert.ok(!hitList(lookup(query(facts, false))).some(hit => reviewed.has(hit.id)));
});

test('original-table brightness, added stars and verse trines use the same verified natal palace', () => {
  const tableId = 'p193000-006';
  const facts = witness(tableId, chart => chart.some(f => f.kind === 'palace_branch' && f.palace === '命宫' && f.branch === '申'));
  const regraded = facts.map(f => f.kind === 'palace_brightness' && f.palace === '命宫' && f.star === '天梁' ? { ...f, brightness: '庙' } : f);
  assert.ok(explain(tableId, regraded).matchedConditions.required.some(f => f.kind === 'palace_source_brightness'
    && f.branch === '申' && f.star === '天梁' && f.brightness === '陷'));
  const joinedId = 'p150000-006', joined = witness(joinedId);
  const benefics = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const distant = joined.map(f => f.kind === 'palace_star' && f.palace === '命宫' && benefics.has(f.star)
    ? { ...f, palace: '财帛' } : f);
  assert.equal(explain(joinedId, distant).matched, false);
  const trineId = 'p168000-001', trine = witness(trineId);
  const noTrine = trine.map(f => f.kind === 'palace_star' && f.star === '火星' ? { ...f, palace: '命宫' } : f);
  assert.equal(explain(trineId, [...noTrine, { kind: 'palace_trine_star', palace: '命宫', star: '火星' }]).matched, false);
  const mutagenId = 'p128000-001', mutagen = witness(mutagenId);
  const wrongMutagen = [...mutagen, { kind: 'star_mutagen', palace: '命宫', star: '天同', change: '权', scope: 'origin' }];
  assert.equal(explain(mutagenId, wrongMutagen).matched, false);
});

test('body-palace and birth-stem passages reach SQLite, explanations and report materials', () => {
  verifyPassages(nextBatch);
  assert.equal(catalog.get(prefix + 'p177000-001').reason, 'unmapped_condition');
});

test('reviewed natal cohorts, natal carriers and original brightness reach SQLite and report materials', () => {
  assert.equal(recentBatch.sourceRecords, 30);
  verifyPassages(recentBatch);
  const changed = structuredClone(catalog.get(prefix + 'p206002-004').claim);
  changed.evidence.context += ' 异本';
  assert.equal(compileQuanshuMinggongPassage(changed).reason, 'source_review_required');
});

test('the Po Jun Tiger cohort requires a matching natal stem and branch', () => {
  const id = 'p206002-004', facts = witness(id, undefined, recentBatch);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), ['若丙戊寅生人命坐子午宫']);
  const wrongBranch = facts.map(f => f.kind === 'natal_year_branch' ? { ...f, branch: '申' } : f);
  assert.equal(explain(id, wrongBranch).matched, false);
  const wrongStem = facts.map(f => f.kind === 'natal_year_stem' ? { ...f, stem: '庚' } : f);
  assert.equal(explain(id, wrongStem).matched, false);
  const report = buildReportMaterials(lookup(query(facts)));
  assert.ok(!report.includes('则孤单残疾，虽富贵不久、夭折。'));
});

test('the Hidden Jade quotation requires three observed natal transformation carriers', () => {
  const id = 'p173002-001', facts = witness(id, undefined, recentBatch);
  assert.ok(explain(id, facts).matched);
  const incomplete = facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '迁移');
  assert.equal(explain(id, incomplete).matched, false);
  for (const change of ['科', '权', '禄']) {
    const withoutCarrier = facts.filter(f => f.kind !== 'star_mutagen' || f.change !== change);
    assert.ok(withoutCarrier.some(f => f.kind === 'palace_mutagen' && f.change === change));
    const supplied = { kind: 'palace_sector_mutagen', palace: '命宫', change };
    assert.equal(explain(id, [...withoutCarrier, supplied]).matched, false);
  }
});

test('the Tai Yin passage checks the source grade and the star that carries Quan', () => {
  const id = 'p160000-002', facts = witness(id, undefined, recentBatch);
  const line = '太阴入庙化权星，清秀聪明贵无伦';
  const withoutNativeBrightness = facts.filter(f => f.kind !== 'palace_brightness' || f.star !== '太阴');
  const [branch] = explain(id, withoutNativeBrightness).matchedBranches;
  assert.equal(branch.text, line);
  assert.ok(branch.matchedConditions.required.some(f => f.kind === 'palace_source_brightness' && f.star === '太阴' && f.brightness === '庙'));
  const missingCarrier = facts.filter(f => f.kind !== 'star_mutagen' || f.star !== '太阴');
  assert.equal(explain(id, missingCarrier).matched, false);
});

test('reviewed trine, natal transformation and dual-list passages reach SQLite and reports', () => {
  assert.equal(trineBatch.sourceRecords, 32);
  verifyPassages(trineBatch);
  const changed = structuredClone(catalog.get(prefix + 'p162000-001').claim);
  changed.conditions.normalized.push('another edition');
  assert.equal(compileQuanshuMinggongPassage(changed).reason, 'source_review_required');
});

test('the Sun and Moon verse needs trine benefics and a complete six-malefic check', () => {
  const id = 'p162000-001', facts = witness(id, undefined, trineBatch);
  assert.ok(explain(id, facts).matched);
  const benefics = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const moved = facts.map(f => f.kind === 'palace_star' && f.scope === 'origin'
    && ['财帛', '官禄'].includes(f.palace) && benefics.has(f.star) ? { ...f, palace: '迁移' } : f);
  const recounted = moved.map(f => f.kind === 'palace_origin_star_count'
    ? { ...f, count: new Set(moved.filter(star => star.kind === 'palace_star' && star.scope === 'origin'
      && star.palace === f.palace).map(star => star.star)).size }
    : f);
  const synthetic = { kind: 'palace_trine_star', palace: '命宫', star: '天魁' };
  assert.ok(claimChartContext('ziwei', chart(recounted)).present.some(f =>
    f.kind === 'palace_sector_six_malefic_count' && f.palace === '命宫' && f.count === 0));
  assert.equal(explain(id, [...recounted, synthetic]).matched, false);
  const incomplete = facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '财帛');
  assert.equal(explain(id, incomplete).matched, false);
});

test('four tomb birth branches and grouped benefic evidence are required together', () => {
  const id = 'p323001-029', facts = witness(id, undefined, trineBatch);
  assert.ok(explain(id, facts).matched);
  const actual = catalog.get(prefix + id).branches[0];
  for (const { anyOf } of actual.inputs) {
    assert.equal(anyOf.length, 20);
    assert.ok(anyOf.every(group => group.length === 2 && group.some(f => f.kind === 'natal_year_branch')
      && group.some(f => f.kind === 'palace_sector_benefic_count')));
  }
  const incomplete = facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '官禄');
  assert.equal(explain(id, incomplete).matched, false);
  const noBirthBranch = facts.filter(f => f.kind !== 'natal_year_branch');
  assert.equal(explain(id, noBirthBranch).matched, false);
});

test('birth-year transformation verses require a unique natal carrier in the actual life palace', () => {
  for (const [id, change] of [['p302000-001', '禄'], ['p323001-035', '科'], ['p323001-043', '科']]) {
    const facts = witness(id, undefined, trineBatch);
    assert.ok(explain(id, facts).matched);
    const withoutCarrier = facts.filter(f => f.kind !== 'star_mutagen' || f.change !== change);
    assert.ok(withoutCarrier.some(f => f.kind === 'palace_mutagen' && f.palace === '命宫' && f.change === change));
    assert.equal(explain(id, [...withoutCarrier, { kind: 'palace_sector_mutagen', palace: '命宫', change }]).matched, false);
    const noYear = facts.filter(f => f.kind !== 'natal_year_stem');
    assert.equal(explain(id, noYear).matched, false);
  }
});

test('body-only verses require the observed body seat, while trines follow the seat that matched', () => {
  const treasury = 'p154000-001';
  const facts = nextBatch.witnesses.map(raw).find(facts => {
    const body = facts.find(fact => fact.kind === 'body_palace');
    return body && body.palace !== '命宫' && explain(treasury, facts).matchedBranches?.length === 2;
  });
  assert.ok(facts);
  const { palace } = facts.find(fact => fact.kind === 'body_palace');
  const trine = explain(treasury, facts).matchedBranches.find(branch =>
    branch.matchedConditions.required.some(fact => fact.kind === 'palace_trine_star'));
  assert.ok(trine.matchedConditions.required.some(fact => fact.kind === 'palace_confirmed_body_seat' && fact.palace === palace));
  assert.ok(trine.matchedConditions.required.some(fact => fact.kind === 'palace_trine_star' && fact.palace === palace && fact.star === '紫微'));

  const forged = { kind: 'palace_confirmed_body_seat', palace };
  const withoutBody = facts.filter(fact => fact.kind !== 'body_palace');
  assert.equal(explain(treasury, [...withoutBody, forged]).matched, false);
  assert.equal(explain(treasury, [...facts, { kind: 'body_palace', palace: '命宫' }]).matched, false);
  const wrongHour = facts.map(fact => fact.kind === 'natal_ziwei_hour' ? { ...fact, branch: '子' } : fact);
  assert.equal(explain(treasury, [...wrongHour, forged]).matched, false);
  assert.equal(query([...wrongHour, forged])[0].confirmedFacts.some(fact => fact.kind === forged.kind), false);
  const samePalace = facts.map(fact => fact.kind === 'palace_star' && fact.star === '紫微' ? { ...fact, palace } : fact);
  const remaining = explain(treasury, [...samePalace, { kind: 'palace_trine_star', palace, star: '紫微' }]).matchedBranches;
  assert.deepEqual(remaining.map(branch => branch.text), ['女人天府命身宫，性格聪明花样容']);

  const bodyOnly = 'p209000-004';
  const joined = witness(bodyOnly, facts => facts.some(fact => fact.kind === 'body_palace' && fact.palace === '命宫'), nextBatch);
  assert.ok(explain(bodyOnly, joined).matched);
  assert.equal(explain(bodyOnly, joined.filter(fact => fact.kind !== 'body_palace')).matched, false);
});

test('three sectors have no auspicious transformations only after all three natal placements are verified', () => {
  const id = 'p120000-002', facts = witness(id, undefined, nextBatch);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, raw(nextBatch.inTrines)).matched, false);

  const proofKind = 'palace_life_trines_without_auspicious_mutagens';
  const forged = { kind: proofKind };
  const withoutLu = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '禄');
  assert.equal(explain(id, [...withoutLu, forged]).matched, false);
  assert.equal(query([...withoutLu, forged])[0].confirmedFacts.some(fact => fact.kind === proofKind), false);
  const duplicatePalace = { kind: 'palace_mutagen', palace: '财帛', change: '禄', scope: 'origin' };
  assert.equal(explain(id, [...facts, duplicatePalace, forged]).matched, false);
  const wrongStar = facts.map(fact => fact.kind === 'star_mutagen' && fact.change === '禄' ? { ...fact, star: '天府' } : fact);
  assert.equal(explain(id, wrongStar).matched, false);
  const missingRelation = facts.filter(fact => !(fact.kind === 'palace_relation' && fact.anchor === '命宫' && fact.target === '官禄'));
  assert.equal(explain(id, missingRelation).matched, false);
  const annual = facts.map(fact => fact.scope === 'origin' ? { ...fact, scope: 'yearly' } : fact);
  assert.equal(explain(id, annual, 'annual').reason, 'calculation_profile');
});
