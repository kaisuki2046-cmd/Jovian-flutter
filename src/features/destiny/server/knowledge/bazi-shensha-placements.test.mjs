import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, shenShaFromKnownBaZiPillars, detailsFromKnownBaZiPillars } from '../../control/charts.ts';
import { compileClaimSources, claimChartContext } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { baziShenShaPlacementEvidence, baziShenShaPlacementFacts, shenShaPlacementNames as names } from './bazi-shensha-placements.mjs';
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const pillars = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);
const coordinateFacts = values => Object.entries(values).map(([position, ganZhi]) => ({ kind: 'pillar', position, ganZhi }));
const keys = rows => rows.map(r => r.name + ':' + r.position).sort();
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-29-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)));
const ids = ['yhzp-v3-c131-p002-001', 'yhzp-v3-c131-p002-004', 'yhzp-v3-c137-p009-002', 'yhzp-v4-c040-p006-001'];
function fixture(context, claims) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-shensha-source-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-shensha-source-')); rmSync(directory, { recursive: true, force: true }); });
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(directory, method + '.json'), JSON.stringify(method === 'bazi' ? claims : []));
  writeFileSync(join(directory, 'upgrade-manifest.json'), readFileSync(new URL('./claims/upgrade-manifest.json', import.meta.url)));
  return directory;
}
// Independent sixty-cycle arithmetic and trine lookup, not the implementation's
// named flags or the engine's shenSha list.
function reference(values) {
  const result = [];
  for (const [position, value] of Object.entries(values)) {
    const target = branches.indexOf(value[1]), found = new Set();
    for (const source of ['year', 'day']) {
      if (source === position || !values[source]) continue;
      const index = pillars.indexOf(values[source]), sourceBranch = index % 12, start = (index - index % 10) % 12;
      if ([(start + 10) % 12, (start + 11) % 12].includes(target)) found.add('void');
      if ([2, 11, 8, 5][sourceBranch % 4] === target) found.add('horse');
      if ([4, 1, 10, 7][sourceBranch % 4] === target) found.add('canopy');
    }
    if (found.has('horse') && found.has('void')) result.push({ name: names.horseVoid, position });
    if (found.has('canopy') && found.has('void')) result.push({ name: names.canopyVoid, position });
    if (position === 'day' && found.has('horse')) result.push({ name: names.wifeHorse, position });
  }
  return keys(result);
}

test('10,800 legal year/day/hour combinations agree with independent sixty-cycle void and trine arithmetic', () => {
  for (let y = 0; y < 60; y++) for (let d = 0; d < 60; d++) for (let k = 0; k < 3; k++) {
    const branch = (y * 5 + d * 3 + k * 4) % 12, hour = stems[(d % 10 % 5 * 2 + branch) % 10] + branches[branch];
    const values = { year: pillars[y], day: pillars[d], hour };
    assert.deepEqual(keys(baziShenShaPlacementEvidence(coordinateFacts(values))), reference(values), JSON.stringify(values));
  }
});

test('native witnesses preserve source-pillar provenance and all nine target-position coverage cases', () => {
  assert.equal(native.coverage.length, 9); assert.deepEqual(native.missingCoverage, []);
  for (const witness of native.witnesses) {
    const chart = calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate)); assert.equal(chart.shenShaRulesetVersion, 'natal-shensha-v1');
    const evidence = baziShenShaPlacementEvidence(chartFacts.bazi(chart)); assert.deepEqual(keys(evidence), keys(witness.evidence));
    for (const row of evidence) { assert.deepEqual(row.shenSha, chart.shenSha[row.position]); assert.equal(row.ganZhi, chart[row.position]); }
  }
});

test('partial sources prove positive same-pillar facts without inventing a year, day, month or hour', () => {
  const sample = native.witnesses.find(w => w.evidence.some(e => e.name === names.horseVoid && e.position === 'hour')); assert.ok(sample);
  const chart = calculateBaZi(Date.parse(sample.date), Date.parse(sample.localDate));
  for (const source of ['year', 'day']) {
    const values = { [source]: chart[source], hour: chart.hour };
    assert.deepEqual(keys(baziShenShaPlacementEvidence(coordinateFacts(values))), reference(values));
    const hits = shenShaFromKnownBaZiPillars(values, 'hour'); assert.ok(hits); assert.ok(hits.every(hit => hit.sourcePillars.every(origin => origin === source)));
    assert.equal(shenShaFromKnownBaZiPillars(values, 'month'), undefined);
    assert.equal(detailsFromKnownBaZiPillars(values, 'hour').shenSha, undefined, 'existing complete-source details contract is unchanged');
  }
  assert.deepEqual(baziShenShaPlacementFacts(coordinateFacts({ hour: chart.hour })), []);
  const knownSources = { year: chart.year, day: chart.day };
  const branchOnlyTarget = [...coordinateFacts(knownSources), { kind: 'branch', position: 'hour', branch: chart.hour[1] }];
  assert.deepEqual(keys(baziShenShaPlacementEvidence(branchOnlyTarget)), reference({ ...knownSources, hour: chart.hour }));
  const branchOnlySources = [{ kind: 'branch', position: 'year', branch: '子' }, { kind: 'branch', position: 'day', branch: '寅' }];
  assert.deepEqual(baziShenShaPlacementFacts(branchOnlySources), [{ kind: 'bazi_natal_configuration', name: names.wifeHorse }]);
  assert.ok(!baziShenShaPlacementFacts(branchOnlySources).some(f => f.name === names.horseVoid), 'a source branch cannot invent a sexagenary void');
});

test('conflicting coordinates and illegal year-month or day-hour arrangements cannot supply placement facts', () => {
  const chart = calculateBaZi(Date.parse(native.witnesses[3].date), Date.parse(native.witnesses[3].localDate)), raw = chartFacts.bazi(chart);
  const coordinate = raw.filter(f => ['pillar', 'stem', 'branch'].includes(f.kind));
  const cases = [[...coordinate, { kind: 'stem', position: 'year', stem: chart.year[0] === '甲' ? '乙' : '甲' }],
    [...coordinate, { kind: 'branch', position: 'day', branch: chart.day[1] === '子' ? '丑' : '子' }]];
  for (const values of [{ year: '甲子', month: '丁寅', day: '甲子', hour: '甲子' }, { year: '甲子', day: '甲子', hour: '丙子' }]) cases.push(coordinateFacts(values));
  for (const facts of cases) assert.deepEqual(baziShenShaPlacementFacts(facts), []);
  assert.equal(shenShaFromKnownBaZiPillars({ year: '甲丑', hour: '甲子' }, 'hour'), undefined);
});

test('supplied god labels and configuration flags cannot forge positive or negative placement evidence', () => {
  const fake = Object.values(names).map(name => ({ kind: 'bazi_natal_configuration', name }));
  const labels = [{ kind: 'shen_sha', position: 'hour', name: '驿马' }, { kind: 'shen_sha', position: 'hour', name: '空亡' }];
  assert.deepEqual(baziShenShaPlacementFacts([...fake, ...labels]), []);
  const chart = claimChartContext('bazi', chartContext('bazi', [...fake, ...labels], [], 'natal'));
  assert.ok(!chart.present.some(f => f.kind === 'bazi_natal_configuration'));
  const denied = claimChartContext('bazi', chartContext('bazi', [], fake, 'natal'));
  assert.ok(![...denied.absentKeys].some(key => Object.values(names).includes(JSON.parse(key).name)));
});

test('source, premise and quotation edits fail closed for all four reviewed records without discarding the original source', context => {
  for (const id of ids) for (const field of ['source', 'conditions', 'evidence']) {
    const source = structuredClone(sources.find(row => row.id === id));
    if (field === 'source') source.source.edition += '修订';
    if (field === 'conditions') source.conditions.normalized.push('另须未知救应条件');
    if (field === 'evidence') source.evidence.original_text += '另有前提';
    const [row] = compileClaimSources(fixture(context, [source])); assert.equal(row.reason, 'source_review_required'); assert.ok(!row.inputs?.length); assert.deepEqual(row.branches, []); assert.deepEqual(row.claim, source);
  }
});
