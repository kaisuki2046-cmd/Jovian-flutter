import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { birthPlaces, isBirthDate } from '../../model/birth-profile.ts';
import { generateReport, parseInput } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjMetalWater, qtbjMetalWaterProfile } from './qtbj-metal-water-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier.startsWith('.') && ['/local-reading.ts', '/birth-places.ts', '/requests/report.ts']
        .some(file => context.parentURL?.endsWith(file))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);
const { runReading } = await import('../../control/local-reading.ts');
const { buildReportRequest } = await import('../../requests/report.ts');

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-154-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-metal-water-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const daylightId = 'qtbj-v6-c119-p003-401';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);

function replay({ birthTime, pillars, proofs }) {
  const instant = Date.parse(birthTime);
  const local = new Date(instant + 8 * 3_600_000);
  const date = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
  assert.ok(isBirthDate(date, new Date(2026, 10, 21)));
  const chart = calculateBaZi(instant, local.getTime());
  const { year, month, day, hour } = chart;
  assert.deepEqual({ year, month, day, hour }, pillars);
  const facts = chartFacts.bazi(chart);
  if (proofs.some(proof => proof.id === daylightId)) {
    const western = calculateWestern(instant, { latitude: 39.907, longitude: 116.397 });
    facts.push({ kind: 'natal_daylight', sect: western.sect });
  }
  return facts;
}

function queries(facts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: facts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown = true) => explainClaim(id, 'bazi', context(queries(facts, timeKnown)), undefined, catalog);

function witness(id, text) {
  const row = fixture.witnesses.find(row => row.proofs.some(proof =>
    proof.id === id && (text === undefined || proof.text === text)));
  assert.ok(row, id);
  return replay(row);
}

test('all reviewed metal and water conditions reach the SQLite lookup, explanation and report', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, qtbjMetalWaterProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
    const edited = structuredClone(row.claim);
    edited.evidence.context = '另一版本';
    assert.equal(compileQtbjMetalWater(edited).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [fixture.sourceRecords, fixture.wholeRecords, fixture.alternatives]);

  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(replay(sample)), plain = context(parsed), derived = claimChartContext('bazi', plain);
    const refs = lookup(parsed), hits = refs.flatMap(topic => [...topic.personality, ...topic.events]);
    const materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, proofKey = key(proof), input = expected.get(proofKey);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id);
      const detail = explainClaim(id, 'bazi', plain, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      assert.match(detail.calculationNote, /穷通宝鉴.*论金、论水/u);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proofKey);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('stem counts deduplicate visible and hidden evidence in the same pillar', () => {
  const id = 'qtbj-v6-c105-p001-101';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const chart = claimChartContext('bazi', context(queries(facts)));
  const count = (stem, placement) => chart.present.find(f => f.kind === 'bazi_stem_placement_count'
    && f.stem === stem && f.placement === placement)?.count;
  assert.deepEqual([count('戊', 'visible'), count('戊', 'hidden'), count('戊', 'any'), count('戊', 'non_day')], [1, 3, 3, 2]);
  assert.equal(explain(id, facts, false).matched, false);
});

test('raw requests cannot replace recalculated stem counts or establish conditions for a conflicting chart', () => {
  const id = 'qtbj-v5-c086-p003-401', facts = witness(id);
  const forged = { kind: 'bazi_stem_placement_count', stem: '壬', placement: 'any', count: 4 };
  assert.ok(!queries([...facts, forged])[0].confirmedFacts.some(f => f.kind === forged.kind));
  assert.ok(explain(id, [...facts, forged]).matched);
  const year = facts.find(f => f.kind === 'branch' && f.position === 'year');
  assert.ok(year);
  const other = year.branch === '申' ? '午' : '申';
  assert.equal(explain(id, [...facts, { kind: 'branch', position: 'year', branch: other }]).matched, false);
});

test('the normal report sends one Chou Gui clause from the actual birthplace horizon', async () => {
  const signal = new AbortController().signal;
  const place = birthPlaces.find(row => row.id === '1816670');
  for (const text of ['名雪後灯光，夜生者贵', '日生者否']) {
    const row = fixture.witnesses.find(row => row.proofs.some(proof => proof.id === daylightId && proof.text === text));
    assert.ok(row);
    const local = new Date(Date.parse(row.birthTime) + 8 * 3_600_000);
    const profile = {
      date: { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() },
      time: { timeKnown: true, hour: local.getUTCHours(), minute: local.getUTCMinutes() }, place, gender: 'female',
    };
    const reading = await runReading(profile, signal, () => {});
    const parsed = parseInput(buildReportRequest(reading));
    assert.ok(parsed);
    const facts = parsed.chartQueries.find(query => query.method === 'bazi').confirmedFacts;
    assert.deepEqual(explain(daylightId, facts).matchedBranches.map(branch => branch.text), [text]);
    const result = await generateReport(parsed, { lookup, signal, complete({ materials }) {
      assert.ok(materials.includes(text));
      assert.ok(!materials.includes(text === '日生者否' ? '名雪後灯光，夜生者贵' : '日生者否'));
      return '测试报告';
    } });
    assert.equal(result.report, '测试报告');
    const without = facts.filter(f => f.kind !== 'natal_daylight');
    assert.equal(explain(daylightId, without).matched, false);
    const opposite = { kind: 'natal_daylight', sect: text === '日生者否' ? 'night' : 'day' };
    assert.equal(explain(daylightId, [...facts, opposite]).matched, false);
  }
});
