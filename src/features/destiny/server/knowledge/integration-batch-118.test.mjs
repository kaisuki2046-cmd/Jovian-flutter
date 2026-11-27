import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueCareer, xingjueCareerProfile } from './xingjue-career.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-118-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-055-p';
const catalog = catalogForDirectory(), lookup = createReportLookup();
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);
const jiLines = ['官宮居在辰地、貪火同塗者宜發', '而若化忌同宮則不發。'];
const moonLines = ['又得巳地祿存直照者、科慶俱為振耀', '若巳地空刧來沖則不達、只作承蔭末官'];

function queries(confirmedFacts) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, facts) => explainClaim(prefix + number, 'ziwei', context(queries(facts)), undefined, catalog);

function witness(number, text) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof => proof.id === prefix + number && proof.text === text));
  assert.ok(row, number);
  return native(row);
}

test('every reviewed Xingjue career group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueCareerProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueCareer(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*官禄/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Tan Lang and Fire in Chen take only the line supported by the observed Ji carrier', () => {
  const id = '710-001';
  for (const text of jiLines) {
    const facts = witness(id, text);
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    const missing = facts.filter(f => f.kind !== 'star_mutagen' || f.change !== '忌');
    const fabricated = { kind: 'palace_sector_mutagen', palace: '官禄', change: '忌' };
    assert.equal(explain(id, [...missing, fabricated]).matched, false);
  }
});

test('the Hai Moon quoted branches need the verified opposition and complete opposing star list', () => {
  const id = '1514-001';
  for (const text of moonLines) {
    const facts = witness(id, text);
    assert.deepEqual(explain(id, facts).matchedBranches.map(b => b.text), [text]);
    assert.equal(explain(id, facts.filter(f => !(f.kind === 'palace_relation' && f.anchor === '官禄'
      && f.target === '夫妻' && f.relation === 'opposite'))).matched, false);
  }
  const incomplete = witness(id, moonLines[0]).filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '夫妻');
  assert.equal(explain(id, incomplete).matched, false);
});

test('the two Wei flanks keep the Sun and Moon on their recorded sides', () => {
  for (const [id, expected] of [['1553-001', ['太阳', '太阴']], ['1556-001', ['太阴', '太阳']]]) {
    const facts = witness(id);
    assert.ok(explain(id, facts).matched);
    for (const [palace, star] of [['田宅', expected[0]], ['仆役', expected[1]]]) {
      assert.ok(facts.some(f => f.kind === 'palace_star' && f.star === star && f.palace === palace));
      const missing = facts.filter(f => !(f.kind === 'palace_relation' && f.anchor === '官禄' && f.target === palace));
      assert.equal(explain(id, missing).matched, false);
    }
  }
});

test('the Qing Long and Xun Kong quotations require their named cycle and actual star', () => {
  const greenDragon = witness('732-001');
  const differentCycle = greenDragon.map(f => f.kind === 'palace_boshi_star' && f.star === '青龙'
    ? { ...f, kind: 'palace_suiqian_star' } : f);
  assert.equal(explain('732-001', differentCycle).matched, false);

  const clearHorse = witness('1546-001');
  const differentVoid = clearHorse.map(f => f.kind === 'palace_star' && f.star === '旬空' ? { ...f, star: '地空' } : f);
  assert.equal(explain('1546-001', differentVoid).matched, false);
});
