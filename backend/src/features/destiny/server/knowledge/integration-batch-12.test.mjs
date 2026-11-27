import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { util } from 'iztro';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimReviewNotes } from './claim-review-notes.mjs';
import { createClaimsCatalog } from './claims.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-12-20261118.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twelve-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twelve-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('source chapter and explicit gender bind omitted palace context without discarding any primitive qualifier', context => {
  const { catalog, matches } = setup(context);
  assert.equal(batch.changes.length, 10);
  assert.equal(batch.corrected.length, 6);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    for (const { required } of row.inputs) {
      assert.ok(matches(id, required), id + ': each compiled alternative');
      const gender = required.find(fact => fact.kind === 'natal_gender');
      if (gender) assert.equal(matches(id, required.map(fact => fact === gender ? { ...fact, gender: gender.gender === '女' ? '男' : '女' } : fact)), false, id + ': wrong gender');
    }
    // OR branches may have redundant supersets (守命 also satisfies 守身或命
    // when 身命同宫). Check indispensable facts on a minimal alternative.
    const minimal = row.inputs.reduce((a, b) => a.required.length <= b.required.length ? a : b).required;
    for (const fact of minimal) assert.equal(matches(id, minimal.filter(other => other !== fact)), false, id + ': missing ' + fact.kind);
    assert.equal(matches(id, []), false, id + ': unknown facts');
    const [unknown] = parseChartQueries([query(row.inputs[0].required)], { timeKnown: false });
    assert.equal(matches(id, unknown.confirmedFacts), false, id + ': unknown time');
  }
  for (const { id } of batch.corrected) {
    const row = catalog.get(id);
    assert.equal(row.inputs.length, 1, id);
    const facts = row.inputs[0].required;
    assert.equal(matches(id, facts.map(fact => fact.kind === 'palace_star' ? { ...fact, palace: '命宫' } : fact)), false, id + ': conjunction in another palace');
  }
  for (const { id } of [...batch.retired, ...batch.deferred]) {
    const row = catalog.get(id);
    assert.equal(row.inputs, undefined, id);
    assert.deepEqual(row.branches, [], id);
    assert.equal(row.reason, 'different_chart_tradition', id);
    assert.ok(claimReviewNotes[id], id);
  }
  const either = 'ziwei-v2-xingjue-012-p1097-001';
  const body = catalog.get(either).inputs.find(input => input.required.some(fact => fact.kind === 'body_palace' && fact.palace !== '命宫')).required;
  assert.ok(matches(either, body));
  assert.equal(matches(either, body.filter(fact => fact.kind !== 'body_palace')), false, 'non-life body alternative needs its actual body binding');
});

test('explicit placement overrides chapter context and a star-name heading alone supplies no palace', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-chapter-scope-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-chapter-scope-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const claim = (id, chapter, normalized) => ({ id, title: '合成测试', category: { topic: '综合', type: '性格', tags: [] },
    source: { book: '测试资料', author: '测试', edition: '1', volume: '一', chapter, section: null, passage_id: id, url: 'https://example.test/fixture' },
    evidence: { original_text: '仅用于校验上下文绑定', context: '合成语境' },
    conditions: { original: normalized, normalized, uncertain: [], excluded: [] },
    interpretation: { classical_meaning: '仅测试', limitations: ['不是真实古籍资料'] } });
  for (const [method, rows] of Object.entries({ bazi: [], western: [], ziwei: [
    claim('explicit-life', '四子女', ['命宫在辰', '天机与天梁同宫']),
    claim('chapter-child', '子息宮', ['天机']), claim('no-palace', '天机', ['天机']),
  ] })) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(rows));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false });
  assert.ok(catalog.get('explicit-life').inputs.every(input => input.required.every(fact => !fact.palace || fact.palace === '命宫')));
  assert.ok(catalog.get('chapter-child').inputs.every(input => input.required.every(fact => !fact.palace || fact.palace === '子女')));
  assert.equal(catalog.get('no-palace').inputs, undefined);
});

test('all ten new and six corrected entries reach SQLite and report materials from real births with source limits retained', context => {
  const { catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-12-witnesses.json', import.meta.url)));
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  for (const { profile, timeIndex, ids } of witnesses.witnesses) {
    const facts = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
    const materials = buildReportMaterials(report([query(facts)]));
    for (const id of ids) {
      assert.ok(matches(id, facts), id);
      const row = catalog.get(id);
      assert.ok(materials.includes(row.claim.evidence.original_text), id + ': original text');
      for (const limit of row.claim.interpretation.limitations) assert.ok(materials.includes(limit), id + ': source limitation');
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), [...batch.changes, ...batch.corrected].map(row => row.id).sort());
});

test('retired placement and brightness conflicts are proven from all twelve configurations rather than failed sampling', () => {
  const configurations = new Map();
  for (let month = 1; month <= 12; month++) for (let day = 1; day <= 28; day++) {
    const chart = calculateZiwei({ date: { year: 1990, month, day }, gender: 'female' }, 3);
    const emperor = chart.palaces.find(palace => palace.majorStars.some(star => star.name === '紫微'));
    configurations.set(emperor.earthlyBranch, chart);
  }
  assert.equal(configurations.size, 12);
  const together = new Set();
  for (const chart of configurations.values()) for (const palace of chart.palaces) {
    if (['天机', '天梁'].every(name => palace.majorStars.some(star => star.name === name))) together.add(palace.earthlyBranch);
  }
  assert.deepEqual([...together].sort(), ['戌', '辰'].sort());
  for (let index = 0; index < 12; index++) assert.notEqual(util.getBrightness('武曲', index), '陷');
});
