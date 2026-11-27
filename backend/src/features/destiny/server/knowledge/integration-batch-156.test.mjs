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
import { compileXingjueNatalStars, xingjueNatalStarsProfile } from './xingjue-natal-stars.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-156-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v2-xingjue-';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-natal-stars-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-natal-stars-'));
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

function witness(number, text) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof =>
    proof.id === prefix + number && (text === undefined || proof.text === text)));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue natal star chapter group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueNatalStarsProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueNatalStars(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*分星篇/u);
      const original = hit.claim.evidence.original_text;
      const evidence = text ?? original;
      assert.ok(materials.includes(evidence), id);
      const matchedText = detail.matchedBranches?.map(branch => branch.text).join('');
      if (text && text !== original && matchedText !== original) {
        assert.ok(!materials.includes(original), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('an incoming layout marker cannot substitute for the missing natal branch', () => {
  const id = '008-p300-001';
  const facts = witness(id);
  const layout = { kind: 'ziwei_confirmed_natal_layout' };
  const nativeContext = claimChartContext('ziwei', context(queries(facts)));
  assert.ok(nativeContext.presentKeys.has(JSON.stringify(layout)));
  assert.ok(explain(id, facts).matched);

  const unrelatedBranch = facts.find(fact => fact.kind === 'palace_branch' && fact.branch !== '卯');
  assert.ok(unrelatedBranch);
  const shortened = facts.filter(fact => fact !== unrelatedBranch);
  const [parsed] = queries([...shortened, layout]);
  assert.ok(!parsed.confirmedFacts.some(fact => fact.kind === layout.kind));
  const direct = claimChartContext('ziwei', chartContext('ziwei', [...shortened, layout]));
  assert.ok(!direct.presentKeys.has(JSON.stringify(layout)));
  const [absent] = parseChartQueries([{ ...parsed, confirmedAbsentFacts: [layout] }]);
  assert.deepEqual(absent.confirmedAbsentFacts, []);
  assert.equal(explain(id, [...shortened, layout]).matched, false);

  const wrong = { ...unrelatedBranch, branch: '卯' };
  assert.equal(explain(id, [...shortened, wrong, layout]).matched, false);
});

test('natal Lu and the additional horse condition select separate finance and property passages', () => {
  const id = '020-p400-001';
  const ordinary = '兩祿分守田財者大富、不富則大貴';
  const additional = '又兩祿分守田財、而一祿與與馬同居、一祿與權同居者、極貴';
  const complete = witness(id, additional);
  const texts = facts => explain(id, facts).matchedBranches.map(branch => branch.text);
  assert.deepEqual(texts(complete), [ordinary, additional]);
  const withNoHorse = complete.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天马');
  assert.deepEqual(texts(withNoHorse), [ordinary]);
  const refs = lookup(queries(withNoHorse));
  assert.ok(buildReportMaterials(refs).includes(ordinary));
  assert.ok(!buildReportMaterials(refs).includes(additional));
});

test('a contradictory birth hour cannot establish the body palace for alternating natal Lu', () => {
  const id = '020-p1139-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const hour = facts.find(fact => fact.kind === 'natal_ziwei_hour');
  assert.ok(hour);
  const other = hour.branch === '子' ? '午' : '子';
  assert.equal(explain(id, [...facts, { kind: 'natal_ziwei_hour', branch: other }]).matched, false);
});

test('the source wording for Tianyue at Wu remains available for later review', () => {
  const row = catalog.get(prefix + '019-p395-001');
  assert.equal(row.inputs, undefined);
  assert.ok(row.claim.evidence.original_text.includes('午鉞'));
});
