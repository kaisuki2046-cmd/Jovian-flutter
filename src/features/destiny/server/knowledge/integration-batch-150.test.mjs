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
import { compileXingjueSpouse, xingjueSpouseProfile } from './xingjue-spouse.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-150-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-049-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-spouse-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-spouse-'));
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

test('every reviewed Xingjue new spouse chapter group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueSpouseProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueSpouse(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*夫妻/u);
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




test('the Hai palace Kong and Jie passage keeps Zi hour and its separate Metal Bureau clause', () => {
  const id = '609-001', clause = '金局人則其禍尤速', facts = witness(id, clause);
  assert.ok(explain(id, facts).matchedBranches.some(branch => branch.text === clause));
  const withoutHour = facts.filter(fact => fact.kind !== 'natal_ziwei_hour');
  const withoutBureau = facts.filter(fact => fact.kind !== 'natal_ziwei_bureau');
  assert.equal(explain(id, withoutHour).matched, false);
  assert.equal(explain(id, withoutBureau).matchedBranches.length, 1);
  assert.ok(!explain(id, withoutBureau).matchedBranches.some(branch => branch.text === clause));
});

test('the two versions of the Metal Bureau outer-aspect passage remain searchable and quote once', () => {
  const facts = witness('613-001');
  assert.ok(explain('613-001', facts).matched);
  assert.ok(explain('1380-001', facts).matched);
  const materials = buildReportMaterials(lookup(queries(facts)));
  assert.equal(materials.split('府朝照則夫婦和合').length, 2);
});

test('the Hai Tianji palace extension needs its own Tianma and both external stars', () => {
  const facts = witness('1359-005');
  assert.ok(explain('1359-001', facts).matched);
  assert.ok(explain('1359-004', facts).matched);
  assert.ok(explain('1359-005', facts).matched);
  const withoutHorse = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天马');
  assert.ok(explain('1359-001', withoutHorse).matched);
  assert.equal(explain('1359-004', withoutHorse).matched, false);
  assert.equal(explain('1359-005', withoutHorse).matched, false);
  const withoutJie = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '地劫');
  assert.equal(explain('1359-005', withoutJie).matched, false);
});

test('the White Tiger passage uses the verified Suiqian group', () => {
  const id = '1381-002', facts = witness(id);
  const tiger = facts.find(fact => fact.kind === 'palace_suiqian_star' && fact.star === '白虎');
  assert.ok(tiger && explain(id, facts).matched);
  assert.equal(explain(id, [...facts.filter(fact => fact !== tiger),
    { kind: 'palace_star', scope: 'origin', palace: tiger.palace, star: '白虎' },
  ]).matched, false);
});

test('the Lianzhen outer malefics need confirmed trines', () => {
  const id = '1386-002', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const withoutTrines = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '夫妻'
    || fact.relation !== 'trine');
  assert.equal(explain(id, withoutTrines).matched, false);
});

test('the flanking exception takes precedence over the earlier examination clause in report materials', () => {
  const id = '1360-001', text = '但貞破夾則晚成多災', facts = witness(id, text);
  const note = '原文后句是前句早科取象的例外';
  assert.ok(explain(id, facts).calculationNote.includes(note));
  assert.ok(buildReportMaterials(lookup(queries(facts))).includes(note));
  const withoutAdjacent = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '夫妻'
    || fact.relation !== 'adjacent');
  const detail = explain(id, withoutAdjacent);
  assert.equal(detail.matchedBranches.length, 1);
  assert.ok(!detail.calculationNote.includes(note));
});
