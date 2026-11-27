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
import { compileXingjueFriends, xingjueFriendsProfile } from './xingjue-friends.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-142-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-054-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-friends-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-friends-'));
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

test('every reviewed Xingjue friends group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueFriendsProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueFriends(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*仆役/u);
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

test('the natal transformation and the two external luminaries must all be confirmed', () => {
  const id = '699-001';
  const facts = witness(id);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '仆役')).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'star_mutagen' || fact.palace !== '仆役' || fact.change !== '忌')).matched, false);
});

test('the Xingjue friends fragments keep their own exact host, opposition and star count', () => {
  const lu = '1502-001', opposite = '1503-001';
  const luFacts = witness(lu, '奴宮得天同化祿');
  const oppositeFacts = witness(opposite, '奴宮空虛無正星、對宮日月羊刃');
  assert.ok(explain(lu, luFacts).matched);
  assert.ok(explain(opposite, oppositeFacts).matched);
  assert.equal(explain(lu, luFacts.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '天同')).matched, false);
  assert.equal(explain(opposite, oppositeFacts.filter(fact =>
    fact.kind !== 'palace_main_count' || fact.palace !== '仆役')).matched, false);
  assert.equal(explain(opposite, oppositeFacts.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '仆役' || fact.target !== '兄弟')).matched, false);
});

test('fire Nayin and a fire bureau are distinct requirements, and prosperity uses the palace phase', () => {
  const fire = '1501-001', growth = '1500-001';
  const fireFacts = witness(fire), growthFacts = witness(growth);
  assert.ok(explain(fire, fireFacts).matched);
  assert.ok(explain(growth, growthFacts).matched);
  for (const kind of ['natal_year_nayin_element', 'natal_ziwei_bureau']) {
    assert.equal(explain(fire, fireFacts.filter(fact => fact.kind !== kind)).matched, false);
  }
  assert.equal(explain(growth, growthFacts.filter(fact => fact.kind !== 'natal_ziwei_life_phase')).matched, false);
});

test('both carriers of authority have real charts and the Boshi name cannot substitute for Feilian', () => {
  const id = '1508-001';
  const charts = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  const carriers = new Set();
  for (const sample of charts) {
    const facts = native(sample);
    const host = facts.find(fact => fact.kind === 'star_mutagen' && fact.palace === '仆役' && fact.change === '权');
    assert.ok(host && explain(id, facts).matched);
    carriers.add(host.star);
    assert.equal(explain(id, facts.filter(fact => fact !== host)).matched, false);
  }
  assert.deepEqual(carriers, new Set(['紫微', '破军']));

  const feilian = '1509-001';
  const facts = witness(feilian);
  assert.ok(explain(feilian, facts).matched);
  const withoutOriginalStar = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '蜚廉');
  assert.equal(explain(feilian, [...withoutOriginalStar,
    { kind: 'palace_boshi_star', palace: '仆役', star: '飞廉' }]).matched, false);
});
