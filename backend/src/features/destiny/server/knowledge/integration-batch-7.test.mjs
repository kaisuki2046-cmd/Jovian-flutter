import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartVersions } from './catalog.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimInventory, explainClaim, createClaimsCatalog } from './claims.mjs';
import { chartContext, normalizeRuleInput } from './matching.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-7-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-7-witnesses.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });

test('all six additions and promotions reach SQLite and report materials from real dated charts', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-seven-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const report = createReportLookup(directory);
  const seen = new Set();
  assert.equal(batch.changes.length, 6);
  assert.equal(batch.changes.filter(row => row.previousStatus === 'unmapped').length, 5);
  assert.deepEqual(witnesses.missing, []);
  for (const witness of witnesses.witnesses) {
    const instant = Date.parse(witness.date);
    const facts = [...chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000)), { kind: 'natal_gender', gender: witness.gender }];
    const hits = lookupInterpretations(directory, query(facts));
    const materials = buildReportMaterials(report([query(facts)]));
    for (const id of witness.ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.map(row => row.id).sort());
});

test('both virtues, explicit female gender and complete proof of no Seven Killings are all necessary', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-both-virtues-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  const id = 'yhzp-v2-c002-p118-102';
  const row = catalog.get(id);
  const matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  assert.equal(row.inputs.length, 16);
  for (const input of row.inputs) {
    const positions = input.required.filter(fact => fact.kind === 'shen_sha').map(fact => fact.position);
    // A literal four-pillar fixture for each condition alternative. Real dated
    // evidence is exercised separately above; these are not user birth records.
    const pillars = { year: '甲寅', month: '甲戌', day: '甲寅', hour: '甲寅' };
    for (const position of positions) pillars[position] = position === 'month' ? '丙戌' : '丙寅';
    const facts = [...chartFacts.bazi(describeBaZiPillars(pillars)), { kind: 'natal_gender', gender: '女' }];
    assert.ok(matches(facts), JSON.stringify(positions));
    assert.equal(matches(facts.filter(fact => fact.kind !== 'natal_gender')), false);
    assert.equal(matches(facts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact)), false);
    assert.equal(matches(facts.filter(fact => fact.kind !== 'pillar')), false, 'raw derived virtues are not evidence');
    const free = ['year', 'month', 'hour'].find(position => !positions.includes(position));
    const killer = pillars.day[0] === '甲' ? '庚' : '壬';
    const changed = { ...pillars, [free]: killer + pillars[free][1] };
    assert.equal(matches([...chartFacts.bazi(describeBaZiPillars(changed)), { kind: 'natal_gender', gender: '女' }]), false, 'a real Seven Killing overrides claimed absence');
  }
});

test('unresolved blind-school prerequisites survive SQLite, explain and audit; complete supplied rules retain their inputs', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-source-prereq-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  const inventory = claimInventory(catalog);
  const held = inventory.filter(row => row.claim.source.book === '盲派命理经典' && row.claim.source.chapter === '盲派宫星定位断命法');
  assert.equal(held.length, 37);
  assert.equal(batch.deferred.length, 20);
  for (const { claim, lookup } of held) {
    assert.equal(lookup.status, 'unmapped', claim.id);
    assert.equal(lookup.reason, 'source_review_required', claim.id);
    assert.match(lookup.reviewNote, /宫合/u);
    assert.equal(catalog.get(claim.id).inputs, undefined);
    assert.deepEqual(catalog.get(claim.id).branches, []);
    assert.match(explainClaim(claim.id, 'bazi', chartContext('bazi', []), undefined, catalog).reviewNote, /宫合/u);
  }
  const ready = inventory.filter(row => row.claim.source.book === '盲派命理经典' && row.claim.conditions.match.status === 'ready');
  assert.equal(ready.length, 18);
  for (const { claim, lookup } of ready) {
    assert.equal(lookup.status, 'indexed');
    assert.deepEqual(catalog.get(claim.id).inputs, claim.conditions.match.natalInputs.map(input => normalizeRuleInput('bazi', input)));
  }
});

test('month, day-stem element and season aliases keep both coordinates and reject an inconsistent stem element', context => {
  const root = mkdtempSync(join(tmpdir(), 'destiny-month-alias-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceDirectory = join(root, 'sources');
  mkdirSync(sourceDirectory);
  const template = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)))[0];
  const conditions = ['寅、卯月甲木', '秋令甲日', '木日夏生', '寅月甲火'];
  const rows = conditions.map((text, index) => ({ ...template, id: 'alias-' + index,
    conditions: { original: [text], normalized: [text], uncertain: [], excluded: [] } }));
  writeFileSync(join(sourceDirectory, 'bazi.json'), JSON.stringify(rows));
  for (const method of ['ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ sourceDirectory, directory: join(root, 'runtime'), includeLegacy: false });
  const expected = [2, 3, 6];
  for (let index = 0; index < 3; index++) {
    const row = catalog.get('alias-' + index);
    assert.equal(row.inputs.length, expected[index]);
    for (const input of row.inputs) assert.deepEqual(input.required.map(fact => [fact.kind, fact.position]).sort(), [['branch', 'month'], ['stem', 'day']]);
  }
  assert.equal(catalog.get('alias-3').reason, 'unmapped_condition');
});
