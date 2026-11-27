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
import { compileXingjueWealth, xingjueWealthProfile } from './xingjue-wealth.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-140-witnesses.json', import.meta.url)));
const prefix = 'ziwei-v3-xingjue-051-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-wealth-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-wealth-'));
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

test('every reviewed Xingjue wealth group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, xingjueWealthProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileXingjueWealth(changed).reason, 'source_review_required', id);
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
      assert.match(detail.calculationNote, /紫微星诀.*财帛/u);
      const evidence = id === prefix + '1446-001'
        ? hits.find(row => row.id === prefix + '1428-001').claim.evidence.original_text
        : text ?? hit.claim.evidence.original_text;
      assert.ok(materials.includes(evidence), id);
      if (id === prefix + '1446-001') assert.ok(!materials.includes(hit.claim.evidence.original_text));
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Wufu facing Wuqu with authority needs the exact natal carrier and opposite palace', () => {
  const id = '667-001', text = '財宮天府對武權主富';
  const facts = witness(id, text);
  assert.ok(explain(id, facts).matched);
  const host = facts.find(fact => fact.kind === 'star_mutagen' && fact.scope === 'origin'
    && fact.star === '武曲' && fact.change === '权' && fact.palace === '福德');
  assert.ok(host);
  assert.equal(explain(id, facts.filter(fact => fact !== host)).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '财帛' || fact.target !== '福德')).matched, false);
});

test('flanking Tianxing and Dijie must arrive from their two named neighboring palaces', () => {
  const id = '1449-001';
  const examples = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  assert.equal(examples.length, 2);
  for (const sample of examples) {
    const facts = native(sample);
    assert.ok(explain(id, facts).matched);
    const xing = facts.find(fact => fact.kind === 'palace_star' && fact.scope === 'origin' && fact.star === '天刑');
    assert.ok(xing && ['子女', '疾厄'].includes(xing.palace));
    assert.equal(explain(id, facts.filter(fact => fact !== xing)).matched, false);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_relation'
      || fact.anchor !== '财帛' || fact.target !== xing.palace)).matched, false);
  }
});

test('Lu Cun standing alone needs the complete local star list for each surviving source fragment', () => {
  const id = '1444-001';
  const supported = fixture.witnesses.filter(row => row.proofs.some(proof => proof.id === prefix + id));
  for (const example of supported) {
    const facts = native(example);
    assert.ok(explain(id, facts).matched);
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '财帛')).matched, false);
  }
});

test('Gold bureau and current noon placement remain independent requirements', () => {
  const id = '1417-001';
  const text = '金局人財宮坐午地、得天同水、太陰水者、金生水星、財物多自內出外去';
  const facts = witness(id, text);
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_ziwei_bureau')).matched, false);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '财帛')).matched, false);
});

test('wealth double void needs both original stars and the matching born-year stem', () => {
  const id = '1435-001';
  const facts = witness(id, '財宮空虛無正星、落旬路二空、無財且貧');
  assert.ok(explain(id, facts).matched);
  for (const star of ['旬空', '截路']) {
    assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '财帛'
      || fact.scope !== 'origin' || fact.star !== star)).matched, false);
  }
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_year_stem')).matched, false);
});
