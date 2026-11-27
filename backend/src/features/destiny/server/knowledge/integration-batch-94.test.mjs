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
import { compileGuanceluNatal, guanceluNatalProfile } from './ziwei-guancelu.mjs';

const fixtureForBatch = batch => JSON.parse(readFileSync(new URL(`./claims/integration-batch-${batch}-witnesses.json`, import.meta.url), 'utf8'));
const batches = [94, 108, 109, 110, 111].map(batch => [batch, fixtureForBatch(batch)]);
const directory = mkdtempSync(join(tmpdir(), 'destiny-guancelu-b94-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const prefix = 'ziwei-v1-guancelu-001-p';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witness = (shortId, text) => native(batches.flatMap(([, fixture]) => fixture.witnesses)
  .find(sample => sample.proofs.some(proof => proof.id === prefix + shortId && (!text || proof.text === text))));

function query(confirmedFacts, confirmedAbsentFacts = [], timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, confirmedAbsentFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (shortId, facts, absent = []) => explainClaim(prefix + shortId, 'ziwei', context(query(facts, absent)), undefined, catalog);

for (const [batch, fixture] of batches) {
  test(`each of the ${fixture.conditionGroups} Guancelu groups in batch ${batch} reaches SQLite and report materials`, () => {
    verifyWitnesses(fixture);
  });
}

function verifyWitnesses(fixture) {
  const expected = new Map();
  let whole = 0;
  for (const shortId of fixture.ids) {
    const id = prefix + shortId, row = catalog.get(id);
    if (row.inputs?.length) whole++;
    for (const { text, inputs, conditionCompiler } of row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, guanceluNatalProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
    const revised = structuredClone(row.claim);
    revised.evidence.context = ' revised';
    assert.equal(compileGuanceluNatal(revised).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.conditionGroups);
  assert.equal(whole, fixture.wholeRecords);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(native(sample)), base = context(parsed);
    const derived = claimChartContext('ziwei', base), refs = lookup(parsed), matches = hits(refs);
    const materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matches.find(row => row.id === id), detail = explainClaim(id, 'ziwei', base, undefined, catalog);
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
}

test('career Lu Cun needs another observed star, regardless of a supplied total or absence', () => {
  const id = '143-001', chart = witness(id);
  const withoutReportedCount = chart.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '官禄');
  assert.ok(explain(id, withoutReportedCount).matched);
  const lone = chart.filter(f => f.kind !== 'palace_star' || f.palace !== '官禄' || f.star === '禄存');
  assert.equal(explain(id, lone).matched, false);
  const forged = { kind: 'palace_origin_star_count', palace: '官禄', count: 1 };
  assert.equal(explain(id, lone, [forged]).matched, false);
  assert.equal(explain('005-001', chart).matched, false);
});

test('a body-seat claim needs the natal hour and only quotes its general saying', () => {
  const id = '102-001', chart = witness(id);
  const chosen = '祿存守身垣。主孤主財。';
  assert.deepEqual(explain(id, chart).matchedBranches.map(branch => branch.text), [chosen]);
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(materials.includes(chosen));
  assert.ok(!materials.includes('生平即擁有厚金'));
  const fake = { kind: 'palace_confirmed_body_seat', palace: chart.find(f => f.kind === 'body_palace').palace };
  const noHour = chart.filter(f => f.kind !== 'natal_ziwei_hour');
  assert.equal(explain(id, noHour.concat(fake)).matched, false);
  assert.equal(hits(lookup(query(chart, [], false))).some(hit => hit.id === prefix + id), false);
});

test('the three-star pattern needs all three and a native life or body anchor', () => {
  const id = '162-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  const noTanlang = chart.filter(f => f.kind !== 'palace_star' || f.star !== '贪狼');
  for (const palace of ['命宫', '夫妻', '财帛', '迁移', '官禄', '福德']) {
    noTanlang.push({ kind: 'palace_trine_star', palace, star: '贪狼' });
  }
  assert.equal(explain(id, noTanlang).matched, false);
  for (const shortId of ['066-001', '172-001']) assert.equal(explain(shortId, chart).matchScope, 'historical_case');
});

test('Zi-life Ju Men can surface its own line without transferring the second line', () => {
  const id = '058-001';
  const base = '巨門守命垣在子。為石中隱玉格。', additional = '附有擎羊主武職。';
  const chart = witness(id, additional);
  assert.deepEqual(explain(id, chart).matchedBranches.map(({ text }) => text), [base, additional]);
  for (const without of [
    fact => fact.kind !== 'natal_ziwei_hour',
    fact => fact.kind !== 'palace_star' || fact.palace !== '命宫' || fact.star !== '擎羊',
    fact => fact.kind !== 'palace_star' || fact.palace !== '迁移' || fact.star !== '天机',
  ]) {
    const facts = chart.filter(without);
    assert.deepEqual(explain(id, facts).matchedBranches.map(({ text }) => text), [base]);
    const materials = buildReportMaterials(lookup(query(facts)));
    assert.ok(materials.includes(base) && !materials.includes(additional));
  }
});

test('the Si–Hai body-axis clause needs the opposite natal palace and the actual body seat', () => {
  const id = '004-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  const incomplete = chart.filter(f => f.kind !== 'palace_branch' || f.palace !== '迁移');
  assert.equal(explain(id, incomplete).matched, false);
  const noHour = chart.filter(f => f.kind !== 'natal_ziwei_hour');
  assert.equal(explain(id, noHour).matched, false);
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(materials.includes('即巳亥同梁身命互守也。'));
  assert.ok(!materials.includes('其後飄泊。'));
});

test('the Si career clause needs both brightness facts and Tian Yao in the career palace', () => {
  const id = '111-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  for (const fact of [
    { kind: 'palace_brightness', palace: '官禄', scope: 'origin', star: '廉贞', brightness: '陷' },
    { kind: 'palace_brightness', palace: '官禄', scope: 'origin', star: '贪狼', brightness: '陷' },
    { kind: 'palace_star', palace: '官禄', scope: 'origin', star: '天姚' },
  ]) {
    const incomplete = chart.filter(observed => !Object.entries(fact).every(([field, value]) => observed[field] === value));
    assert.equal(explain(id, incomplete).matched, false);
  }
});

test('specific case outcomes stay out of the general natal match', () => {
  const chart = witness('086-001');
  for (const id of ['003-001', '133-001']) {
    const detail = explain(id, chart);
    assert.equal(detail.matchScope, 'historical_case');
    assert.equal(detail.matched, false);
  }
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(materials.includes('巨門在遷移。多招是非。'));
  assert.ok(!materials.includes('火星亦多側目。'));
});

test('the same warrior-body case can be found by either ID and contributes one report quotation', () => {
  const chart = witness('135-001');
  const references = lookup(query(chart)), matched = hits(references);
  const shorter = '七殺守身垣在酉。心性剛強。';
  for (const id of ['022-001', '135-001']) {
    assert.ok(matched.some(hit => hit.id === prefix + id));
    assert.ok(explain(id, chart).matched);
  }
  assert.equal(buildReportMaterials(references).split(shorter).length - 1, 1);
  const withoutLonger = references.map(ref => ({ ...ref,
    personality: ref.personality.filter(row => row.id !== prefix + '135-001'),
    events: ref.events.filter(row => row.id !== prefix + '135-001'),
  }));
  assert.ok(buildReportMaterials(withoutLonger).includes(shorter));
});

test('flanking Kuai and Yue must straddle the actual body palace', () => {
  const id = '175-001', chart = witness(id);
  const kui = chart.find(f => f.kind === 'palace_star' && f.star === '天魁' && f.scope === 'origin');
  const yue = chart.find(f => f.kind === 'palace_star' && f.star === '天钺' && f.scope === 'origin');
  assert.ok(kui && yue && kui.palace !== yue.palace);
  assert.ok(explain(id, chart).matched);
  assert.equal(explain(id, chart.filter(f => f.kind !== 'natal_ziwei_hour')).matched, false);
  assert.equal(explain(id, chart.filter(f => f !== yue).concat({ ...yue, palace: kui.palace })).matched, false);
});

test('Shen life palace Tong and Liang needs each of the three observed natal transformations', () => {
  const id = '171-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  for (const change of ['禄', '权', '科']) {
    const incomplete = chart.filter(f => f.kind !== 'star_mutagen' || f.change !== change);
    assert.equal(explain(id, incomplete).matched, false, change);
  }
});

test('the limited natal passages leave timing and incompatible sourced placements to review', () => {
  const chart = witness('163-001');
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(materials.includes('財宮地空又是身垣。'));
  assert.ok(!materials.includes('在此限內能不毀家。'));
  for (const id of ['019-001', '109-001', '186-001']) {
    const record = explain(id, chart);
    assert.equal(record.matched, false);
    assert.ok(record.reviewNote, id);
  }
});

test('the Wen Chang transformation chooses one of the martial and literary readings', () => {
  const id = '115-001';
  const martial = '羊刃七殺廉貞拱照。武職威勇。', literary = '而昌曲化科則文矣。';
  const bingMartial = batches.find(([batch]) => batch === 110)[1].witnesses
    .filter(sample => sample.proofs.some(proof => proof.id === prefix + id && proof.text === martial))
    .map(native).find(facts => facts.some(fact => fact.kind === 'natal_year_stem' && fact.stem === '丙'));
  const literaryChart = witness(id, literary);
  assert.deepEqual(explain(id, bingMartial).matchedBranches.map(({ text }) => text), [martial]);
  assert.deepEqual(explain(id, literaryChart).matchedBranches.map(({ text }) => text), [literary]);
  assert.equal(explain(id, literaryChart.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  const fabricated = [
    { kind: 'palace_star', palace: '夫妻', star: '文昌', scope: 'origin' },
    { kind: 'star_mutagen', palace: '夫妻', star: '文昌', scope: 'origin', change: '科' },
  ];
  assert.deepEqual(explain(id, literaryChart.concat(fabricated)).matchedBranches.map(({ text }) => text), [literary]);
});

test('the blessing-palace Tian Liang clause requires Tian Ma in the facing palace', () => {
  const id = '160-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  const wrongPlace = chart.map(fact => fact.kind === 'palace_star' && fact.star === '天马' && fact.palace === '财帛'
    ? { ...fact, palace: '福德' } : fact);
  assert.equal(explain(id, wrongPlace).matched, false);
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(materials.includes('天梁合天馬。又是福德宮。'));
  assert.ok(!materials.includes('離京至津。可謂飄泊。'));
});

test('the wealth extract keeps the corroborated transformation apart from the unresolved ending', () => {
  const id = '083-001', chart = witness(id);
  assert.deepEqual(explain(id, chart).matchedBranches.map(({ text }) => text),
    ['命垣化權。財宮祿存。又合化祿。本主財權。']);
  const incomplete = chart.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '巨门');
  assert.equal(explain(id, incomplete).matched, false);
  const materials = buildReportMaterials(lookup(query(chart)));
  assert.ok(!materials.includes('而巨忌擾亂其中。'));
  assert.equal(explain('187-001', chart).matched, false);
});

test('the Purple and Breaker passage needs a verified transformation and each of the two literary stars', () => {
  const id = '108-001', chart = witness(id);
  assert.ok(explain(id, chart).matched);
  const distinctEvidence = [
    fact => fact.kind === 'star_mutagen' && fact.star === '紫微' && fact.change === '权',
    fact => fact.kind === 'palace_star' && fact.palace === '官禄' && fact.star === '文昌',
    fact => fact.kind === 'palace_star' && fact.palace === '财帛' && fact.star === '文曲',
  ];
  for (const isEvidence of distinctEvidence) {
    assert.equal(explain(id, chart.filter(fact => !isEvidence(fact))).matched, false);
  }
});

test('the Lian Zhen quotation needs support from two different stars outside the anchor and a complete sector', () => {
  const id = '182-001', chart = witness(id);
  const anchor = chart.find(fact => fact.kind === 'palace_star' && fact.star === '廉贞').palace;
  const related = chart.find(fact => fact.kind === 'palace_relation' && fact.anchor === anchor && fact.relation === 'opposite').target;
  assert.ok(explain(id, chart).matched);
  const incomplete = chart.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== related);
  const fakeCount = { kind: 'palace_sector_six_malefic_count', palace: anchor, count: 0 };
  assert.equal(explain(id, incomplete.concat(fakeCount)).matched, false);

  const benefics = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const ownPalaceOnly = chart.map(fact => fact.kind === 'palace_star' && benefics.has(fact.star)
    ? { ...fact, palace: anchor } : fact);
  const counts = new Map();
  for (const { kind, palace, scope } of ownPalaceOnly) {
    if (kind === 'palace_star' && scope === 'origin') counts.set(palace, (counts.get(palace) ?? 0) + 1);
  }
  const recounted = ownPalaceOnly.map(fact => fact.kind === 'palace_origin_star_count'
    ? { ...fact, count: counts.get(fact.palace) ?? 0 } : fact);
  const derived = claimChartContext('ziwei', context(query(recounted)));
  assert.ok(derived.present.some(fact => fact.kind === fakeCount.kind && fact.palace === anchor && fact.count === 0));
  assert.equal(explain(id, recounted).matched, false);
});

test('date-specific outcomes and the undefined root of a transformation stay outside report excerpts', () => {
  const marriage = buildReportMaterials(lookup(query(witness('149-001'))));
  assert.ok(marriage.includes('身垣臨於妻宮。羊刃在戌。'));
  assert.ok(!marriage.includes('則元配之妻病故'));
  const wealth = buildReportMaterials(lookup(query(witness('173-001'))));
  assert.ok(wealth.includes('財祿因日月相反。火星地空有亦難存。'));
  assert.ok(!wealth.includes('惟化祿有根。不至缺乏。'));
});
