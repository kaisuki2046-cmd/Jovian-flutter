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
import { compileXingjueTianji, xingjueTianjiProfile } from './xingjue-tianji.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-147-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v2-xingjue-006-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-tianji-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-tianji-'));
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

test('every reviewed Xingjue Tianji group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueTianjiProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueTianji(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*天机/u);
      const evidence = id.endsWith('-p260-001') ? '天機無惡虐之心、有機變之謀'
        : text ?? hit.claim.evidence.original_text;
      assert.ok(materials.includes(evidence), id);
      if (text && text !== hit.claim.evidence.original_text) {
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});


test('same-page duplicate IDs are independently searchable and quoted once in the report', () => {
  const facts = witness('1074-001');
  assert.ok(explain('260-001', facts).matched);
  assert.ok(explain('1074-001', facts).matched);
  const materials = buildReportMaterials(lookup(queries(facts)));
  assert.match(materials, /天機無惡虐之心、有機變之謀/u);
  assert.equal(materials.split('有機變之謀').length, 2);
});

test('body-only Tianji needs the actual birth-hour seat', () => {
  const sample = fixture.witnesses.find(row => {
    const facts = native(row);
    return facts.some(f => f.kind === 'body_palace' && f.palace !== '命宫'
      && facts.some(star => star.kind === 'palace_star' && star.scope === 'origin' && star.palace === f.palace && star.star === '天机'));
  });
  assert.ok(sample);
  const facts = native(sample);
  assert.ok(explain('1074-001', facts).matched);
  for (const kind of ['body_palace', 'natal_ziwei_hour']) {
    assert.equal(explain('1074-001', facts.filter(f => f.kind !== kind)).matched, false);
  }
});

test('in the Lu and Quan passage, both natal changes need their actual carriers', () => {
  const facts = witness('267-001');
  assert.ok(explain('267-001', facts).matched);
  for (const change of ['禄', '权']) {
    assert.equal(explain('267-001', facts.filter(f => f.kind !== 'star_mutagen' || f.change !== change)).matched, false);
  }
});

test('the doubled flank uses both actual adjacent palaces', () => {
  const id = '807-001', facts = witness(id);
  const tianji = facts.find(f => f.kind === 'palace_star' && f.scope === 'origin' && f.star === '天机');
  const ziwei = facts.find(f => f.kind === 'palace_star' && f.scope === 'origin' && f.star === '紫微');
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(f => f.kind !== 'palace_relation' || f.anchor !== tianji.palace
    || f.target !== ziwei.palace)).matched, false);
});

test('Qinglong in the Chen Tianji and Tianliang passage refers to the natal Boshi group', () => {
  const id = '810-001', facts = witness(id, '辰上機梁遇青龍極吉');
  const qinglong = facts.find(f => f.kind === 'palace_boshi_star' && f.star === '青龙');
  assert.ok(qinglong && explain(id, facts).matched);
  const withoutBoshi = facts.filter(f => f !== qinglong);
  assert.equal(explain(id, [...withoutBoshi,
    { kind: 'palace_star', palace: qinglong.palace, star: '青龙', scope: 'origin' },
  ]).matched, false);
});

test('transcription conflicts and unreproduced layouts do not use an adjacent paragraph', () => {
  const facts = witness('1074-001');
  for (const id of ['264-001', '266-001', '269-001']) {
    const row = catalog.get(prefix + id);
    assert.ok(row, id);
    assert.equal(explain(id, facts).matched, false, id);
    assert.equal(row.inputs, undefined, id);
  }
});
