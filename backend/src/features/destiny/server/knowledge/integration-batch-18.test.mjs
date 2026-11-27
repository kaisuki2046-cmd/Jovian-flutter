import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { claimChartContext, createClaimsCatalog, explainClaim, lookupClaims, pendingClaimConditions } from './claims.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-18-20261118.json', import.meta.url)));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const stem = (position, stem) => ({ kind: 'stem', position, stem });
const branch = (position, branch) => ({ kind: 'branch', position, branch });
const observed = pillars => chartFacts.bazi(describeBaZiPillars(pillars));
function temporary(context, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
function fixture(context, expressions, extra = []) {
  const directory = temporary(context, 'destiny-counted-literal-');
  const sourceDirectory = join(directory, 'sources'); mkdirSync(sourceDirectory);
  const base = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url))).find(row => row.id === 'qtbj-v4-c058-p001-101');
  const rows = expressions.map((normalized, index) => ({ ...structuredClone(base), id: 'fixture-count-' + index,
    conditions: { original: normalized, normalized, uncertain: [], excluded: [] } }));
  for (const [method, claims] of Object.entries({ bazi: [...rows, ...extra], ziwei: [], western: [] })) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(claims));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false });
  return { catalog, matches: (index, facts) => lookupClaims('bazi', chartContext('bazi', facts, [], 'natal'), undefined, catalog)
    .some(hit => hit.id === 'fixture-count-' + index) };
}

test('repeated shown stems occupy distinct non-day slots, preserving minimum and explicit exact cardinality with unknown slots', context => {
  const { catalog, matches } = fixture(context, [['两庚透干'], ['至少两庚透干'], ['仅两庚透干'], ['丙癸甲三者同透'],
    ['丙癸三者同透'], ['丙丙甲三者同透'], ['一庚'], ['支中藏庚火'], ['至少四庚透干']]);
  const positions = ['year', 'month', 'hour'];
  for (let count = 0; count <= 3; count++) {
    const facts = positions.map((position, index) => stem(position, index < count ? '庚' : '丙'));
    for (const index of [0, 1]) assert.equal(matches(index, facts), count >= 2, 'minimum ' + count);
    assert.equal(matches(2, facts), count === 2, 'explicit exact ' + count);
  }
  assert.ok(matches(0, [stem('year', '庚'), stem('month', '庚')]));
  assert.equal(matches(2, [stem('year', '庚'), stem('month', '庚')]), false, 'unknown hour cannot prove exact count');
  assert.equal(matches(0, [stem('day', '庚'), stem('year', '庚'), stem('month', '乙'), stem('hour', '丙')]), false, 'day master is not a second shown slot');
  assert.ok(matches(3, [stem('year', '丙'), stem('month', '癸'), stem('hour', '甲')]));
  for (const index of [4, 5, 6, 7, 8]) assert.equal(catalog.get('fixture-count-' + index).inputs, undefined, 'unknown or inconsistent quantity ' + index);
});

test('upper bounds on concealed pillars require actual negative evidence and separated shown stems retain four-pillar order', context => {
  const { matches } = fixture(context, [['一丙藏', '至多二支藏丙'], ['丙与辛隔位同透']]);
  const positions = ['year', 'month', 'day', 'hour'];
  for (let count = 0; count <= 4; count++) {
    const facts = positions.map((position, index) => branch(position, index < count ? '寅' : '申'));
    assert.equal(matches(0, facts), count >= 1 && count <= 2, 'hidden pillar count ' + count);
  }
  assert.equal(matches(0, [branch('year', '寅'), branch('month', '寅')]), false, 'two remaining unknown pillars could exceed the upper bound');
  assert.ok(matches(0, [branch('year', '寅'), branch('month', '申'), branch('day', '申')]), 'one unknown slot cannot make the count exceed two');
  assert.equal(matches(1, [stem('year', '丙'), stem('month', '辛')]), false, 'adjacent year and month');
  assert.ok(matches(1, [stem('year', '丙'), stem('hour', '辛')]));
  assert.ok(matches(1, [stem('month', '丙'), stem('hour', '辛')]), 'the actual day position separates month and hour');
  assert.equal(matches(1, [stem('day', '丙'), stem('hour', '辛')]), false, 'day master is not counted as shown');
});

test('pinned source bounds and passage bindings cannot survive silently added prerequisites or changed quotations', context => {
  const original = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)));
  const modified = original.filter(row => ['qtbj-v3-c017-p002-101', 'qtbj-v4-c061-p002-101', 'qtbj-v6-c099-p002-101'].includes(row.id))
    .map(row => ({ ...row, conditions: { ...row.conditions, original: [...row.conditions.original, '额外需要制化得宜'] } }));
  const { catalog } = fixture(context, [], modified);
  for (const { id } of modified) {
    assert.equal(catalog.get(id).inputs, undefined, id);
    assert.deepEqual(catalog.get(id).branches, [], id);
  }
});

test('all 99 new alternatives reach native birth calculations, SQL and explanation without importing unmatched passage conclusions', context => {
  const directory = temporary(context, 'destiny-batch-eighteen-');
  const catalog = catalogForDirectory(directory);
  const report = createReportLookup(directory);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-18-witnesses.json', import.meta.url)));
  assert.equal(batch.changes.length, 8);
  assert.equal(batch.targetAlternatives, 99);
  assert.equal(witnesses.targetAlternatives, 99);
  assert.deepEqual(witnesses.missing, []);
  const seen = new Set();
  for (const witness of witnesses.witnesses) {
    assert.equal(Date.parse(witness.localDate) - Date.parse(witness.date), witness.timezoneOffsetHours * 3600000);
    const facts = chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate)));
    const parsed = parseChartQueries([query(facts)]); assert.ok(parsed);
    const chart = claimChartContext('bazi', chartContext('bazi', parsed[0].confirmedFacts, [], 'natal'));
    const hits = lookupInterpretations(directory, parsed[0]);
    const material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id);
      const target = proof.branchIndex === -1 ? row.inputs : row.branches[proof.branchIndex].inputs;
      const input = target.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof.id);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit);
      const explained = explainClaim(proof.id, 'bazi', chartContext('bazi', facts, [], 'natal'), undefined, catalog);
      assert.equal(explained.matched, true);
      if (proof.branchIndex === -1) assert.ok(material.includes(row.claim.evidence.original_text));
      else {
        assert.equal(hit.matchScope, 'passage_branch');
        const text = row.branches[proof.branchIndex].text;
        assert.ok(hit.matchedBranches.some(branch => branch.text === text));
        assert.ok(material.includes(text));
        assert.match(hit.calculationNote, /只引用已满足条件的独立原句/u);
        for (const other of row.branches.filter(branch => !hit.matchedBranches.some(matched => matched.text === branch.text))) {
          assert.equal(hit.reading.includes(other.text), false, proof.id + ': unconfirmed branch');
        }
      }
      seen.add(proof.id + ':' + proof.branchIndex + ':' + proof.inputDigest);
    }
  }
  const expected = batch.changes.flatMap(row => (row.inputDigests ? [{ index: -1, inputDigests: row.inputDigests }] : row.branches)
    .flatMap(branch => branch.inputDigests.map(hash => row.id + ':' + branch.index + ':' + hash)));
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('original concealed-count limits, source branch isolation and year/month columns remain effective', context => {
  const directory = temporary(context, 'destiny-source-count-');
  const catalog = catalogForDirectory(directory);
  const matches = (id, facts) => lookupInterpretations(directory, query(facts)).find(hit => hit.id === id);
  const id = 'qtbj-v3-c017-p002-101';
  assert.ok(matches(id, observed({ year: '庚申', month: '戊寅', day: '丙申', hour: '庚寅' })));
  assert.equal(matches(id, observed({ year: '庚寅', month: '戊寅', day: '丙申', hour: '庚寅' })), undefined, 'three pillars conceal 丙');
  const annual = matches('yhzp-v2-c252-p006-001', [stem('day', '甲'), { kind: 'stem_ten_god', position: 'year', tenGod: '伤官' }]);
  assert.equal(annual.matchedBranches.length, 1);
  assert.equal(annual.reading, '年帶傷官，父母不全');
  assert.equal(annual.reading.includes('兄弟不完'), false);
  const winter = catalog.get('qtbj-v4-c061-p002-101');
  assert.equal(winter.inputs, undefined);
  assert.equal(winter.branches.length, 1);
  assert.equal(winter.branches[0].text.includes('无制'), false);
  const pending = pendingClaimConditions({ catalog });
  assert.match(pending.find(row => row.id === winter.claim.id).reviewNote, /无制/u);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
});
