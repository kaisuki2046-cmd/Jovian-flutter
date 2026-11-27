import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileQuanshuPalaceText, quanshuPalaceTextProfile } from './ziwei-source-passages.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-46-witnesses.json', import.meta.url), 'utf8'));
const sourceId = id => 'ziwei-v2-' + id;
const ids = [
  'c005-p101004-002',
  'c005-p101004-003',
  'c005-p101007-002',
  'c005-p101008-004',
  'c005-p101009-001',
  'c005-p101009-004',
  'c005-p101010-004',
  'c005-p101010-006',
  'c005-p101012-003',
  'c005-p101014-007',
  'c005-p101017-001',
  'c008-p101003-003',
  'c008-p101004-001',
  'c008-p101004-003',
  'c008-p101007-003',
  'c008-p101020-003',
  'c009-p101005-002',
  'c009-p101007-002',
  'c009-p101013-003',
  'guanlugong-p101003-002',
  'guanlugong-p101006-002',
  'guanlugong-p101006-005',
  'guanlugong-p101007-004',
  'guanlugong-p101008-002',
  'guanlugong-p101018-002',
].map(sourceId);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === sourceId(id)));

function factsFor({ profile, timeIndex, daylightPlace }) {
  const raw = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
  if (daylightPlace) {
    const { year, month, day } = profile.date;
    const utc = Date.UTC(year, month - 1, day, timeIndex * 2 - 8); // Beijing local time, UTC+8 for this date range.
    raw.push({ kind: 'natal_daylight', sect: calculateWestern(utc, daylightPlace).sect });
  }
  return raw;
}

function chartQueries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(id, facts, timeKnown = true) {
  const [query] = chartQueries(facts, timeKnown);
  return explainClaim(sourceId(id), 'ziwei', chartContext('ziwei', query.confirmedFacts), undefined, catalog);
}

test('all 25 Volume II passages reach SQLite, explanation and report materials through 31 proved inputs', () => {
  assert.equal(ids.length, 25);
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.compiler, quanshuPalaceTextProfile);
    assert.deepEqual(row.branches, []);
    return row.inputs.map(input => id + ':' + digest(input));
  }));
  assert.equal(expected.size, 31);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = chartQueries(factsFor(witness));
    const chart = chartContext('ziwei', parsed[0].confirmedFacts);
    const calculated = claimChartContext('ziwei', chart);
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true, id);
      assert.ok(hits.some(hit => hit.id === id), id);
      assert.equal(explainClaim(id, 'ziwei', chart, undefined, catalog).matched, true, id);
      assert.ok(materials.includes(row.claim.evidence.original_text), id);
      seen.add(id + ':' + inputDigest);
    }
  }
  assert.deepEqual(seen, expected);
});

test('same-palace alternatives and exact branch and brightness evidence keep their scope', () => {
  const travel = 'c008-p101004-003';
  const row = catalog.get(sourceId(travel));
  assert.deepEqual(row.inputs.map(({ required }) => required.map(fact => fact.star).sort()),
    [['七杀', '武曲'], ['武曲', '破军']]);
  for (const input of row.inputs) {
    const sample = witnesses.find(witness => witness.proofs.some(proof => proof.id === sourceId(travel) && proof.inputDigest === digest(input)));
    const companion = input.required.find(fact => fact.star !== '武曲').star;
    const raw = factsFor(sample);
    assert.ok(explain(travel, raw).matched);
    const wrongPalace = raw.map(fact => fact.kind === 'palace_star' && fact.palace === '迁移' && fact.star === companion
      ? { ...fact, palace: '命宫' } : fact);
    assert.equal(explain(travel, wrongPalace).matched, false);
  }

  const children = 'c005-p101010-004';
  const raw = factsFor(witnessFor(children));
  assert.ok(explain(children, raw).matched);
  for (const kind of ['palace_branch', 'palace_brightness']) {
    const missing = raw.filter(fact => fact.palace !== '子女' || fact.kind !== kind);
    assert.equal(explain(children, missing).matched, false);
  }
  assert.equal(explain(children, raw, false).matched, false);
});

test('career exclusions require proven absence and the luminary pairs require observed daylight', () => {
  const career = 'guanlugong-p101003-002';
  const data = factsFor(witnessFor(career));
  assert.ok(explain(career, data).matched);
  assert.equal(explain(career, data.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '官禄')).matched, false);
  for (const star of ['擎羊', '陀罗', '火星', '铃星']) {
    assert.equal(explain(career, [...data, { kind: 'palace_star', palace: '官禄', star, scope: 'origin' }]).matched, false);
  }
  for (const [id, sect] of [['c005-p101004-002', 'day'], ['c005-p101004-003', 'night']]) {
    const raw = factsFor(witnessFor(id));
    const opposite = { kind: 'natal_daylight', sect: sect === 'day' ? 'night' : 'day' };
    const unknown = raw.filter(fact => fact.kind !== 'natal_daylight');
    assert.ok(explain(id, raw).matched);
    assert.equal(explain(id, unknown).matched, false);
    assert.equal(explain(id, [...unknown, opposite]).matched, false);
    assert.equal(explain(id, [...raw, opposite]).matched, false);
    assert.equal(explain(id, raw, false).matched, false);
  }
});

test('report states the matched daylight branch and retains source review and unresolved placements', async () => {
  const daytime = 'c005-p101004-002';
  const parsed = chartQueries(factsFor(witnessFor(daytime)));
  const lookup = queries => reportLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === sourceId(daytime)),
    events: reference.events.filter(hit => hit.id === sourceId(daytime)),
  }));
  const { report } = await generateReport({ chartQueries: parsed }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /日盘/u);
      assert.match(materials, /只引用已命中的昼生或夜生条件/u);
      assert.match(materials, /子息数等只作古籍取象/u);
      return '卷二昼夜测试报告';
    },
  });
  assert.equal(report, '卷二昼夜测试报告');
  for (const id of ids) {
    const edited = structuredClone(catalog.get(id).claim);
    edited.evidence.context += '异本';
    assert.equal(compileQuanshuPalaceText(edited).reason, 'source_review_required');
  }
  for (const id of ['c005-p101014-008', 'guanlugong-p101019-002']) {
    const pending = catalog.get(sourceId(id));
    assert.equal(pending.inputs, undefined);
    assert.deepEqual(pending.branches, []);
  }
});
