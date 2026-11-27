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
import { compileXingjueFude, xingjueFudeProfile } from './xingjue-fude.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-128-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-057-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-fude-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-fude-'));
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

test('every reviewed Xingjue fude group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueFudeProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueFude(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*福德/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the favorable Lu Ma quotation verifies one palace and excludes the described exception', () => {
  const id = '754-001', facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const withoutHorse = facts.filter(f => !(f.kind === 'palace_star' && f.palace === '福德' && f.star === '天马'));
  assert.equal(explain(id, withoutHorse).matched, false);
  const incomplete = facts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '福德');
  assert.equal(explain(id, incomplete).matched, false);
});

test('natal Lu in the Fude sector requires a real carrier, while Lu Cun works independently', () => {
  const id = '766-001';
  const samples = fixture.witnesses.filter(sample => sample.proofs.some(proof => proof.id === prefix + id)).map(native);
  const withoutLuCun = facts => facts.filter(f => f.kind !== 'palace_star' || f.star !== '禄存');
  const withoutCarrier = facts => facts.filter(f => f.kind !== 'star_mutagen' || f.change !== '禄');
  assert.ok(samples.some(facts => explain(id, withoutCarrier(facts)).matched));
  const transformedLuOnly = samples.map(withoutLuCun).find(facts => explain(id, facts).matched);
  assert.ok(transformedLuOnly);
  assert.equal(explain(id, withoutCarrier(transformedLuOnly)).matched, false);
  const local = witness('1597-001');
  const falseHost = local.map(f => f.kind === 'star_mutagen' && f.change === '禄'
    ? { ...f, star: f.star === '天同' ? '天梁' : '天同' } : f);
  assert.equal(explain('1597-001', falseHost).matched, false);
});

test('the warning and mitigation are matched independently using complete palace evidence', () => {
  const id = '1591-001', warning = '福宮廉貞文昌同守者福薄多厄', mitigation = '而若天相同入者救其危';
  const warningFacts = witness(id, warning), mitigationFacts = witness(id, mitigation);
  assert.deepEqual(explain(id, warningFacts).matchedBranches.map(branch => branch.text), [warning]);
  assert.deepEqual(explain(id, mitigationFacts).matchedBranches.map(branch => branch.text), [mitigation]);
  const incomplete = warningFacts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '福德');
  assert.equal(explain(id, incomplete).matched, false);
});

test('the Ziwei and Tianxiang quotation checks Tian Xing and Tian Ma across the proved sector', () => {
  const id = '1612-001', warning = '若與地刧相會、則為破格', mitigation = '若遇刑刧馬反為吉早發';
  const warningFacts = witness(id, warning), mitigationFacts = witness(id, mitigation);
  assert.deepEqual(explain(id, warningFacts).matchedBranches.map(branch => branch.text), [warning]);
  assert.deepEqual(explain(id, mitigationFacts).matchedBranches.map(branch => branch.text), [mitigation]);
  const incomplete = warningFacts.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '福德');
  assert.equal(explain(id, incomplete).matched, false);
});

test('the Sun and Moon evidence sends the independent quotation without the lifespan passage', () => {
  const id = '1602-001', sun = '太陽坐守入廟、一生榮快', moon = '太陰坐守、其貴如太陽';
  const reference = (facts, text) => {
    const [entry] = lookup(queries(facts));
    const find = rules => rules.filter(row => row.id === prefix + id);
    const materials = buildReportMaterials([{ ...entry, personality: find(entry.personality), events: find(entry.events) }]);
    assert.ok(materials.includes(text));
    assert.doesNotMatch(materials, /壽七十|壽則過於太陽|故利於享壽/u);
  };
  reference(witness(id, sun), sun);
  reference(witness(id, moon), moon);
});

test('the Wei quotation checks both companion stars and the actual natal Ke placement', () => {
  const id = '768-001', facts = witness(id);
  assert.equal(explain(id, facts).matched, true);
  const withoutPavilion = facts.filter(f => !(f.kind === 'palace_star' && f.palace === '福德' && f.star === '凤阁'));
  assert.equal(explain(id, withoutPavilion).matched, false);
  const withoutCarrier = facts.filter(f => f.kind !== 'star_mutagen' || f.change !== '科');
  assert.equal(explain(id, withoutCarrier).matched, false);
});

test('Tai and Zuo occupy the two proved neighbors in the flanking quotation', () => {
  const id = '1632-001', text = '天相輔弼天鉞同居福宮、台座夾之', facts = witness(id, text);
  assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
  const missingLink = facts.filter(f => !(f.kind === 'palace_relation' && f.anchor === '福德'
    && f.target === '父母' && f.relation === 'adjacent'));
  assert.equal(explain(id, missingLink).matched, false);
});
