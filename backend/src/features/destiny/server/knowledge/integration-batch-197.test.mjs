import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-197-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-ba-zi-decadal-197-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

function native({ birthTime, gender, pillars }) {
  const instant = Date.parse(birthTime), wall = instant + 8 * 3_600_000;
  const chart = calculateBaZi(instant, wall, gender === '男' ? 'male' : 'female');
  assert.deepEqual([chart.year, chart.month, chart.day, chart.hour], pillars);
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function parsed(facts, { timeKnown = true, chartScope = 'natal' } = {}) {
  const queries = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: facts, chartScope }], { timeKnown });
  assert.ok(queries);
  return queries;
}

function explain(id, [query]) {
  return explainClaim(id, 'bazi', chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope), undefined, catalog);
}

const hits = references => references.flatMap(topic => [...topic.personality, ...topic.events]);
const periodFacts = period => [period.ganZhi, period.startAge, period.endAge];
const periodKind = 'bazi_decadal_range';
const financeId = 'muxuan-v1-f011-p00049-001';

test('eight source passages and all eighteen natal forms match their exact real periods through SQLite and reports', () => {
  const ids = new Set(witnesses.map(sample => sample.id));
  assert.deepEqual([ids.size, witnesses.length], [8, 18]);
  const seen = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    const edited = structuredClone(row.claim);
    edited.evidence.context += ' 异本';
    assert.equal(compileBaZiDecadalPassage(edited).reason, 'source_review_required', id);
  }
  assert.equal([...ids].reduce((total, id) => total + catalog.get(id).branches.length, 0), witnesses.length);

  for (const { id, birthTime, gender, pillars, periods } of witnesses) {
    const queries = parsed(native({ birthTime, gender, pillars }));
    const detail = explain(id, queries), refs = lookup(queries);
    const hit = hits(refs).find(item => item.id === id);
    assert.ok(detail.matched && hit, id);
    assert.equal(detail.matchedBranches.length, 1, id);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, id);
    const [branch] = hit.matchedBranches;
    assert.equal(branch.conditionCompiler, baziDecadalPassageProfile, id);
    assert.deepEqual(branch.matchedConditions.decadalPeriods.map(periodFacts), periods, id);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(branch.text), id);
    assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
    for (const [ganZhi, startAge, endAge] of periods) assert.ok(materials.includes(`${startAge}至${endAge}虚岁${ganZhi}运限`), id);
    const day = branch.matchedConditions.required.find(fact => fact.kind === 'stem' && fact.position === 'day');
    const month = branch.matchedConditions.required.find(fact => fact.kind === 'branch' && fact.position === 'month');
    seen.add(JSON.stringify([id, day.stem, month?.branch]));
  }
  assert.equal(seen.size, witnesses.length);
});

test('wealth periods need verified ranges, and reverse passages reject forward charts with the same transit branches', () => {
  const finance = witnesses.find(sample => sample.id === financeId), facts = native(finance);
  const allowed = new Set(finance.periods.map(period => period[0]));
  const withoutFinance = facts.filter(fact => fact.kind !== periodKind || !allowed.has(fact.ganZhi));
  assert.equal(explain(financeId, parsed(withoutFinance)).matched, false);
  assert.ok(!hits(lookup(parsed(facts, { timeKnown: false }))).some(row => row.id === financeId));
  assert.ok(!hits(lookup(parsed(facts, { chartScope: 'annual' }))).some(row => row.id === financeId));

  const reverse = witnesses.find(sample => sample.id === 'muxuan-v1-f011-p00091-001');
  const forward = native({ ...reverse, gender: reverse.gender === '男' ? '女' : '男' });
  assert.ok(forward.some(fact => fact.kind === periodKind && '申酉巳午'.includes(fact.ganZhi[1])));
  assert.equal(explain(reverse.id, parsed(forward)).matched, false);
});

test('a native chart with three exposed Geng stems and eastern luck still needs all three water branches', () => {
  const id = 'smth-v6-well-p002-701';
  const facts = native({
    birthTime: '1920-08-30T00:20:00Z', gender: '男', pillars: ['庚申', '甲申', '庚申', '庚辰'],
  });
  assert.ok(facts.some(fact => fact.kind === periodKind && fact.ganZhi === '庚寅'));
  const queries = parsed(facts);
  assert.equal(explain(id, queries).matched, false);
  assert.ok(!hits(lookup(queries)).some(row => row.id === id));
});
