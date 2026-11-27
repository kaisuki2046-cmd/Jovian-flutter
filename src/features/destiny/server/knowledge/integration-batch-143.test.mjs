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
import { compileXingjueParents, xingjueParentsProfile } from './xingjue-parents.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-143-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-058-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-parents-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-parents-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);

function queries(confirmedFacts) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, facts) => explainClaim(prefix + number, 'ziwei', context(queries(facts)), undefined, catalog);

function witness(number, text = null) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof => proof.id === prefix + number && proof.text === text));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue parents group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueParentsProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueParents(changed).reason, 'source_review_required', id);
  }
  assert.equal(whole, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample)), chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const proof = key(id, text, inputDigest), input = expected.get(proof);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.match(detail.calculationNote, /紫微星诀.*父母/u);
      const evidence = text ?? hit.claim.evidence.original_text;
      assert.ok(materials.includes(evidence), id);
      if (text && text !== hit.claim.evidence.original_text) {
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Wei parent double void exclusions need a complete local star list', () => {
  const id = '1638-001';
  const facts = witness(id, '未地父母宮地空陀羅、若不落旬路空、則反不克親');
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_origin_star_count'
    || fact.palace !== '父母')).matched, false);
  for (const star of ['旬空', '截路']) {
    assert.equal(explain(id, [...facts, { kind: 'palace_star', palace: '父母', star, scope: 'origin' }]).matched, false);
  }
});

test('the Sun and Moon need actual external placements and their own brightness', () => {
  const id = '825-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '父母')).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_brightness'
    || fact.star !== '太阳')).matched, false);
});

test('each parent flanking pattern preserves both adjacent houses and its own prerequisites', () => {
  for (const id of ['826-001', '1652-001']) {
    const charts = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
    assert.equal(charts.length, 2);
    for (const sample of charts) {
      const facts = native(sample);
      assert.ok(explain(id, facts).matched);
      for (const target of ['命宫', '福德']) {
        assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '父母'
          || fact.target !== target)).matched, false);
      }
      if (id === '826-001') {
        assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_ziwei_life_phase')).matched, false);
      }
    }
  }
});

test('the orphan-star fragment uses Tianliang as the only major star in the Jue phase', () => {
  const id = '818-001';
  const facts = witness(id, '孤辰同居則先剋父');
  const detail = explain(id, facts);
  assert.deepEqual(detail.matchedBranches.map(branch => branch.text), ['孤辰同居則先剋父']);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_main_count' || fact.palace !== '父母')).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_ziwei_life_phase')).matched, false);
});
