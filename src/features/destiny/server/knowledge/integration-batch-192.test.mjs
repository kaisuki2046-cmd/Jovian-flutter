import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueCareer, xingjueCareerProfile } from './xingjue-career.mjs';
import { compileXingjueFude, xingjueFudeProfile } from './xingjue-fude.mjs';

const dirPrefix = 'destiny-xingjue-fude-career-';
const directory = mkdtempSync(join(tmpdir(), dirPrefix));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + dirPrefix));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-192-witnesses.json', import.meta.url)));
const idFor = record => 'ziwei-v3-xingjue-' + record;
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const sampleNamed = name => samples.find(sample => sample.name === name);
const rawFor = name => native(sampleNamed(name));
const queries = confirmedFacts => parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
const context = ([query]) => chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (record, facts) => explainClaim(idFor(record), 'ziwei', context(queries(facts)), undefined, catalog);
const allHits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const groupKey = (id, text, group) => JSON.stringify([id, text ?? null, createHash('sha256').update(JSON.stringify(group)).digest('hex')]);

test('six source records and ten condition groups reach normal SQLite lookup, explanation and report materials', () => {
  const expected = new Set(), hitGroups = new Set();
  const records = new Set(samples.map(sample => sample.record));
  assert.equal(records.size, 6);
  for (const record of records) {
    const id = idFor(record), row = catalog.get(id);
    const career = record.startsWith('055');
    assert.equal(Boolean(row.inputs?.length), record === '057-p1589-001', id);
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const branch of groups) {
      assert.equal(branch.conditionCompiler, career ? xingjueCareerProfile : xingjueFudeProfile);
      if (branch.text) assert.ok(row.claim.evidence.original_text.includes(branch.text));
      for (const input of branch.inputs) expected.add(groupKey(id, branch.text, input));
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异文';
    assert.equal((career ? compileXingjueCareer(changed) : compileXingjueFude(changed)).reason, 'source_review_required');
  }
  assert.equal(expected.size, 10);
  for (const sample of samples) {
    const raw = native(sample), parsed = queries(raw), base = context(parsed), derived = claimChartContext('ziwei', base);
    const id = idFor(sample.record), row = catalog.get(id);
    const matches = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    const reference = lookup(parsed), hit = allHits(reference).find(rule => rule.id === id);
    const result = explain(sample.record, raw);
    assert.equal(result.matched, true, sample.name);
    assert.ok(hit, sample.name);
    const material = buildReportMaterials(reference);
    const matchingGroups = matches.flatMap(branch => branch.inputs.flatMap(input =>
      evaluateRule(input, 'natal', derived).matched ? [{ input, text: branch.text }] : []));
    assert.ok(matchingGroups.length, sample.name);
    for (const { text, input } of matchingGroups) {
      hitGroups.add(groupKey(id, text, input));
      if (text) {
        assert.ok(result.matchedBranches.some(branch => branch.text === text));
        assert.ok(hit.matchedBranches.some(branch => branch.text === text));
      }
      assert.ok(material.includes(text ?? hit.claim.evidence.original_text), sample.name);
    }
  }
  assert.deepEqual(hitGroups, expected);
});

test('fude same-palace passages distinguish native earth void, earth robbery and the separate modern Sky Void', () => {
  const replacements = { 地空: '天空', 地劫: '天空' };
  for (const name of ['tong-jie', 'qisha-empties', 'wu-po-si', 'wu-po-hai']) {
    const sample = sampleNamed(name), facts = native(sample);
    const original = explain(sample.record, facts);
    assert.equal(original.matched, true);
    assert.equal(original.matchedBranches.length, 1);
    for (const star of Object.keys(replacements)) {
      if (!facts.some(fact => fact.kind === 'palace_star' && fact.palace === '福德' && fact.star === star)) continue;
      const moved = facts.map(fact => fact.kind === 'palace_star' && fact.palace === '福德' && fact.star === star
        ? { ...fact, star: replacements[star] } : fact);
      assert.equal(explain(sample.record, moved).matched, false, name + ' ' + star);
    }
  }
});

test('empty fude requires both trine sources and both actual adjacent flankers', () => {
  const record = '057-p1589-001', facts = rawFor('empty-fude');
  assert.equal(explain(record, facts).matched, true);
  const withoutCount = facts.filter(fact => fact.kind !== 'palace_main_count' || fact.palace !== '福德');
  assert.equal(explain(record, withoutCount).matched, false);
  for (const target of ['田宅', '父母', '夫妻', '迁移']) {
    const changed = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '福德' || fact.target !== target);
    assert.equal(explain(record, changed).matched, false, target);
  }
});

test('the water bureau and both assistants are required, with a separate actual body-seat check', () => {
  const record = '057-p1595-001', facts = rawFor('water-wealth');
  assert.equal(explain(record, facts).matched, true);
  assert.equal(explain(record, facts.filter(fact => fact.kind !== 'natal_ziwei_bureau')).matched, false);
  assert.equal(explain(record, facts.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  for (const star of ['左辅', '右弼']) {
    const changed = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== star);
    assert.equal(explain(record, changed).matched, false, star);
  }
  assert.equal(explain(record, rawFor('water-fude').filter(fact => fact.kind !== 'body_palace')).matched, true);
});

test('the career enhancement requires the same flank, actual Changsheng stage and natal Lu carrier', () => {
  const record = '055-p1520-001';
  const first = explain(record, rawFor('career-flanks'));
  assert.equal(first.matchedBranches.length, 1);
  assert.doesNotMatch(first.matchedBranches[0].text, /長生/u);
  const stronger = rawFor('career-flanks-with-lu');
  assert.equal(explain(record, stronger).matchedBranches.length, 2);
  const withoutCarrier = stronger.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '天同' || fact.change !== '禄');
  assert.equal(explain(record, withoutCarrier).matchedBranches.length, 1);
  const noBureau = stronger.filter(fact => fact.kind !== 'natal_ziwei_bureau');
  assert.equal(explain(record, noBureau).matchedBranches.length, 1);
  const withoutEnGuang = stronger.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '官禄' || fact.star !== '恩光');
  assert.equal(explain(record, withoutEnGuang).matched, false);
});
