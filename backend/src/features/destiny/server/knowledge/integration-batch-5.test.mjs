import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { util } from 'iztro';
import { calculateZiwei } from '../../control/charts.ts';
import { chartVersions, chartFacts } from './catalog.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimReviewNotes } from './claim-review-notes.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-5-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-5-witnesses.json', import.meta.url)));
const query = facts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts: facts });

test('explicit alternatives, brightness and solitude retain every necessary qualifier through SQLite lookup', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-five-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  const report = createReportLookup(directory);
  const matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  assert.equal(batch.changes.length, 17);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.equal(row.reason, undefined, id);
    assert.ok(row.inputs.length, id);
    for (const { required } of row.inputs) {
      const counts = required.filter(fact => fact.kind === 'palace_core_star_count').map(fact => ({
        kind: 'palace_origin_star_count', palace: fact.palace,
        count: required.filter(other => other.kind === 'palace_star' && other.palace === fact.palace).length,
      }));
      const facts = [...required, ...counts];
      assert.ok(matches(id, facts), id + ': positive alternative');
      for (const fact of required) {
        const missing = facts.filter(other => other !== fact
          && !(fact.kind === 'palace_core_star_count' && other.kind === 'palace_origin_star_count'));
        assert.equal(matches(id, missing), false, id + ': missing ' + fact.kind);
        if (fact.kind === 'palace_brightness') {
          assert.equal(matches(id, facts.map(other => other === fact ? { ...fact, brightness: '陷' } : other)), false, id + ': wrong brightness');
        }
        if (fact.kind === 'palace_branch') {
          assert.equal(matches(id, facts.map(other => other === fact ? { ...fact, branch: '巳' } : other)), false, id + ': wrong branch');
        }
      }
      assert.ok(buildReportMaterials(report([query(facts)])).includes(row.claim.evidence.original_text), id);
    }
    assert.equal(matches(id, []), false, id + ': unknown');
  }
  for (const { id } of batch.deferred) {
    const row = catalog.get(id);
    if (id === 'ziwei-v4-jielan-176-p001-001') assert.equal(row.inputs.length, 1, id);
    else assert.equal(row, null, id);
    assert.match(claimReviewNotes[id], /iztro 2\.6\.5/u);
  }
  assert.equal(catalog.get('ziwei-v2-jielan-101-p020-023'), null);
  assert.equal(catalog.get('ziwei-v5-jielan-238-p001-004').inputs.length, 1);
});

test('all 17 new records have real birth-chart witnesses that reach report materials', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-five-charts-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const report = createReportLookup(directory);
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  assert.deepEqual([...witnesses.deferred].sort(), batch.deferred.map(row => row.id).sort());
  for (const { profile, timeIndex, ids } of witnesses.witnesses) {
    const facts = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
    const request = query(facts);
    const hits = lookupInterpretations(directory, request);
    const materials = buildReportMaterials(report([request]));
    for (const id of ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id + ': real chart');
      assert.ok(materials.includes(hit.claim.evidence.original_text), id + ': report evidence');
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.map(row => row.id).sort());
});

test('brightness profile review is grounded in all twelve sectors, not an unsuccessful random search', () => {
  for (const star of ['文昌', '铃星']) {
    assert.ok(Array.from({ length: 12 }, (_, index) => util.getBrightness(star, index)).every(level => level !== '旺'), star);
  }
  const branches = [...'寅卯辰巳午未申酉戌亥子丑'];
  assert.deepEqual(branches.filter((_, index) => util.getBrightness('武曲', index) === '旺').sort(), ['午', '子']);
  // The production arrangement covers each of the twelve possible 紫微 starts;
  // every corresponding 旺 武曲 is accompanied by another major star (天府).
  const configurations = new Map();
  for (let month = 1; month <= 12; month++) for (let day = 1; day <= 28; day++) {
    const chart = calculateZiwei({ date: { year: 1990, month, day }, gender: 'female' }, 3);
    const emperor = chart.palaces.find(palace => palace.majorStars.some(star => star.name === '紫微'));
    configurations.set(emperor.earthlyBranch, chart);
  }
  assert.equal(configurations.size, 12);
  let checked = 0;
  for (const chart of configurations.values()) for (const palace of chart.palaces) {
    if (!palace.majorStars.some(star => star.name === '武曲' && star.brightness === '旺')) continue;
    checked++;
    assert.ok(palace.majorStars.some(star => star.name === '天府'));
    assert.ok(palace.majorStars.length > 1);
  }
  assert.equal(checked, 2);
});
