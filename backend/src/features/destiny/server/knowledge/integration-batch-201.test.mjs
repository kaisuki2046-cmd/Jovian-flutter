import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileYuanhaiNatalPassages } from './yuanhai-natal-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-transformation-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-201-witnesses.json', import.meta.url)));
const splitPlacements = new Set(['yhzp-v3-c065-p002-001', 'yhzp-v3-c065-p005-001']);
const dayTransformationKind = 'bazi_day_stem_transformation';

function native({ birthTime, pillars }) {
  const instant = Date.parse(birthTime), wall = instant + 8 * 3_600_000;
  const chart = calculateBaZi(instant, wall, 'male');
  assert.deepEqual([chart.year, chart.month, chart.day, chart.hour], pillars);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender: '男' }];
}

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

const detailFor = (id, plain) => explainClaim(id, 'bazi', plain, undefined, catalog);
const findHit = (queries, id) => lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(item => item.id === id);

test('eighteen original records match their complete source conditions through SQLite and report materials', () => {
  const ids = new Set(witnesses.map(sample => sample.id));
  const expected = new Set(), confirmed = new Set();
  let whole = 0, groups = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const passages = row.inputs ? [row] : row.branches;
    passages.forEach(({ inputs }, branch) => inputs.forEach((input, group) => {
      groups++;
      const alternatives = splitPlacements.has(id) ? input.anyOf : [undefined];
      alternatives.forEach((_, index) => expected.add(JSON.stringify([id, branch, group, index])));
    }));
    const revised = structuredClone(row.claim);
    revised.evidence.context = '另一本';
    assert.equal(compileYuanhaiNatalPassages(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, groups, expected.size, witnesses.length], [18, 15, 29, 33, 33]);

  for (const sample of witnesses) {
    const { id, branch, group, alternative } = sample;
    const row = catalog.get(id), passage = row.inputs ? row : row.branches[branch];
    const input = passage.inputs[group];
    const condition = splitPlacements.has(id) ? { ...input, anyOf: [input.anyOf[alternative]] } : input;
    const { queries, plain } = request(native(sample));
    assert.ok(evaluateRule(condition, 'natal', claimChartContext('bazi', plain)).matched, JSON.stringify(sample));
    const detail = detailFor(id, plain), hit = findHit(queries, id);
    assert.ok(detail.matched && hit, id);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(passage.text ?? row.claim.evidence.original_text), id);
    if (passage.text) {
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, id);
      assert.ok(hit.matchedBranches.some(item => item.text === passage.text), id);
      assert.ok(!materials.includes(row.claim.evidence.original_text), id);
    }
    if (input.required.some(fact => fact.kind === dayTransformationKind)) {
      assert.match(materials, /日干[甲丙丁戊庚辛壬癸]与.满足合化.的排盘条件/u);
    }
    confirmed.add(JSON.stringify([id, branch, group, alternative]));
  }
  assert.deepEqual(confirmed, expected);
});

test('ordinary combination evidence, missing time, and forged day transformations cannot trigger a transformation clause', () => {
  const combinationId = 'yhzp-v3-c065-p002-001', transformedId = 'yhzp-v3-c065-p002-002';
  const ordinary = native({ birthTime: '1905-02-14T02:20:00Z', pillars: ['乙巳', '戊寅', '甲申', '己巳'] });
  const { plain } = request(ordinary);
  assert.ok(detailFor(combinationId, plain).matched);
  assert.equal(detailFor(transformedId, plain).matched, false);
  const forged = { kind: dayTransformationKind, stem: '甲', partner: '己', element: '土' };
  const withForgery = request([...ordinary, forged]);
  assert.equal(detailFor(transformedId, withForgery.plain).matched, false);
  assert.equal(findHit(withForgery.queries, transformedId), undefined);

  const positive = witnesses.find(sample => sample.id === transformedId);
  const noHour = request(native(positive), false);
  assert.equal(detailFor(transformedId, noHour.plain).matched, false);
  assert.equal(findHit(noHour.queries, transformedId), undefined);
});

test('a supported year-month transformation stays available without being assigned to the day stem', () => {
  const facts = native({ birthTime: '1910-09-09T16:20:00Z', pillars: ['庚戌', '乙酉', '戊寅', '壬子'] });
  const { plain } = request(facts);
  const chart = claimChartContext('bazi', plain);
  assert.ok(chart.present.some(fact => fact.kind === 'bazi_stem_transformation' && fact.pair === '庚乙' && fact.element === '金'));
  assert.ok(!chart.present.some(fact => fact.kind === dayTransformationKind));
  assert.equal(detailFor('yhzp-v3-c065-p004-001', plain).matched, false);
});

test('the distinct Ren, Gui, Yi and Ding evidence selects the corresponding individual clauses', () => {
  for (const id of ['yhzp-v3-c065-p004-001', 'yhzp-v3-c065-p006-001']) {
    const row = catalog.get(id);
    for (const sample of witnesses.filter(item => item.id === id)) {
      const detail = detailFor(id, request(native(sample)).plain);
      assert.deepEqual(detail.matchedBranches.map(({ text }) => text), [row.branches[sample.branch].text], id);
    }
  }
});
