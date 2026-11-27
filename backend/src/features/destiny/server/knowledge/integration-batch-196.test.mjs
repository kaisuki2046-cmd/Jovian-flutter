import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueCareer } from './xingjue-career.mjs';
import { compileXingjueFude } from './xingjue-fude.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-sector-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-196-witnesses.json', import.meta.url)));
const idFor = record => 'ziwei-v3-xingjue-' + record;
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const sampleFor = name => samples.find(sample => sample.name === name);

function query(facts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts: facts }]);
  assert.ok(queries);
  const [q] = queries;
  return { queries, plain: chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope) };
}

function explain(sample, facts = native(sample)) {
  return explainClaim(idFor(sample.record), 'ziwei', query(facts).plain, undefined, catalog);
}

test('eight source records cover eleven condition groups in SQLite explanations and report material', () => {
  const records = new Set(samples.map(sample => sample.record));
  const expected = new Set(), seen = new Set();
  assert.equal(samples.length, 15);
  let whole = 0;
  for (const record of records) {
    const id = idFor(record), row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    groups.forEach(({ inputs }, index) => inputs.forEach((_, position) => expected.add(JSON.stringify([id, index, position]))));
    const changed = structuredClone(row.claim);
    changed.evidence.context = '另一本';
    const compile = record.startsWith('055-') ? compileXingjueCareer : compileXingjueFude;
    assert.equal(compile(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([records.size, whole, expected.size], [8, 2, 11]);

  for (const sample of samples) {
    const { queries, plain } = query(native(sample));
    const derived = claimChartContext('ziwei', plain);
    const id = idFor(sample.record), row = catalog.get(id);
    const groups = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    const references = lookup(queries);
    const hit = references.flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog), material = buildReportMaterials(references);
    assert.ok(hit && detail.matched, sample.name);
    const quotes = [];
    const original = row.claim.evidence.original_text;
    groups.forEach(({ text, inputs }, index) => {
      inputs.forEach((input, position) => {
        if (!evaluateRule(input, 'natal', derived).matched) return;
        if (text) quotes.push(text);
        assert.ok(material.includes(text ?? original), sample.name);
        seen.add(JSON.stringify([id, index, position]));
      });
    });
    if (!row.inputs) {
      assert.deepEqual(new Set(detail.matchedBranches.map(branch => branch.text)), new Set(quotes), sample.name);
      assert.deepEqual(new Set(hit.matchedBranches.map(branch => branch.text)), new Set(quotes), sample.name);
      assert.ok(!material.includes(original), sample.name);
    }
  }
  assert.deepEqual(seen, expected);
});

test('the two bell passages differ by Kui and Yue, and need the actual bell brightness in a trine palace', () => {
  const sample = sampleFor('career-bell-kui'), facts = native(sample);
  const verifiedLevels = samples.filter(item => item.record === sample.record).map(item => {
    const bell = native(item).find(fact => fact.kind === 'palace_brightness' && fact.star === '铃星');
    assert.ok(explain(item).matched, item.name);
    return bell.palace + bell.brightness;
  });
  assert.deepEqual(new Set(verifiedLevels), new Set(['命宫庙', '命宫得', '命宫利', '财帛庙', '财帛得', '财帛利']));
  assert.equal(explain(sample).matchedBranches.length, 2);
  assert.equal(explain(sampleFor('career-bell')).matchedBranches.length, 1);
  const noTianYue = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天钺');
  assert.equal(explain(sample, noTianYue).matchedBranches.length, 1);
  const noBrightness = facts.filter(fact => fact.kind !== 'palace_brightness' || fact.star !== '铃星');
  assert.equal(explain(sample, noBrightness).matched, false);
  const noTrine = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '官禄' || fact.target !== '财帛');
  assert.equal(explain(sample, noTrine).matched, false);
});

test('the sky void, earth void, flank relations and Liang transformation keep their exact evidence', () => {
  for (const [name, requiredFact] of [
    ['career-sky-void', fact => fact.kind === 'palace_star' && fact.palace === '官禄' && fact.star === '天空'],
    ['fude-earth-void', fact => fact.kind === 'palace_star' && fact.palace === '福德' && fact.star === '地空'],
    ['fude-flanks', fact => fact.kind === 'palace_relation' && fact.anchor === '福德' && fact.target === '田宅'],
    ['fude-liang-lu', fact => fact.kind === 'star_mutagen' && fact.palace === '迁移' && fact.star === '天梁' && fact.change === '禄'],
  ]) {
    const sample = sampleFor(name), facts = native(sample);
    assert.ok(facts.some(requiredFact), name);
    assert.equal(explain(sample, facts.filter(fact => !requiredFact(fact))).matched, false, name);
  }
});
