import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { util } from 'iztro';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimReviewNotes } from './claim-review-notes.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-10-20261118.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-ten-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-ten-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('explicit two- and three-branch placements preserve year stems, brightness and same-palace companions', context => {
  const { catalog, report, matches } = setup(context);
  assert.equal(batch.changes.length, 31);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.equal(row.reason, undefined, id);
    assert.ok(row.inputs?.length, id);
    const branches = new Set(row.inputs.flatMap(input => input.required.filter(fact => fact.kind === 'palace_branch').map(fact => fact.branch)));
    const stems = new Set(row.inputs.flatMap(input => input.required.filter(fact => fact.kind === 'natal_year_stem').map(fact => fact.stem)));
    const wrongBranch = [...'子丑寅卯辰巳午未申酉戌亥'].find(branch => !branches.has(branch));
    const wrongStem = [...'甲乙丙丁戊己庚辛壬癸'].find(stem => !stems.has(stem));
    for (const { required } of row.inputs) {
      // Derived source brightness is internal to lookup. Mutate the actual
      // input observations, not the derived fact's fixed life-palace schema.
      const observations = required.filter(fact => fact.kind !== 'palace_source_brightness');
      assert.ok(matches(id, observations), id + ': every compiled alternative');
      for (const fact of observations) {
        assert.equal(matches(id, observations.filter(other => other !== fact)), false, id + ': missing ' + fact.kind);
      }
      if (branches.size && wrongBranch) assert.equal(matches(id, observations.map(fact => fact.kind === 'palace_branch' ? { ...fact, branch: wrongBranch } : fact)), false, id + ': wrong branch');
      if (stems.size && wrongStem) assert.equal(matches(id, observations.map(fact => fact.kind === 'natal_year_stem' ? { ...fact, stem: wrongStem } : fact)), false, id + ': wrong year');
      assert.equal(matches(id, observations.map(fact => fact.palace === '命宫' ? { ...fact, palace: '兄弟' } : fact)), false, id + ': wrong palace');
    }
    assert.equal(matches(id, []), false, id + ': unknown facts');
    assert.ok(buildReportMaterials(report([query(row.inputs[0].required)])).includes(row.claim.evidence.original_text), id);
  }
  const together = 'ziwei-v2-minggong-p223000-003';
  const facts = catalog.get(together).inputs[0].required;
  assert.equal(matches(together, facts.map(fact => fact.star === '紫微' ? { ...fact, palace: '兄弟' } : fact)), false);
  const female = 'ziwei-v2-minggong-p179000-002';
  assert.equal(matches(female, catalog.get(female).inputs[0].required.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact)), false);
  for (const { id, reason } of batch.deferred) {
    if (id === 'ziwei-v2-minggong-p193000-004') {
      assert.ok(catalog.get(id).inputs.every(input => input.required.some(fact => fact.kind === 'palace_source_brightness')));
      continue;
    }
    if (id === 'ziwei-v1-guancelu-001-p066-001') {
      const { lookup } = catalog.inventory().find(({ claim }) => claim.id === id);
      assert.equal(lookup.status, 'case_indexed', id);
      const [input] = catalog.get(id).inputs;
      assert.equal(matches(id, input.required), false, id + ': excluded from ordinary interpretations');
      assert.ok(claimReviewNotes[id], id);
      continue;
    }
    assert.equal(catalog.get(id).inputs, undefined, id);
    assert.equal(catalog.get(id).reason, reason, id);
    assert.ok(claimReviewNotes[id], id);
  }
});

test('all thirty-one records reach SQLite and report materials from real calculated birth charts', context => {
  const { catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-10-witnesses.json', import.meta.url)));
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  assert.equal(witnesses.profile, batch.profile);
  for (const { profile, timeIndex, ids } of witnesses.witnesses) {
    const facts = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
    const materials = buildReportMaterials(report([query(facts)]));
    for (const id of ids) {
      assert.ok(matches(id, facts), id + ': real chart reaches SQLite');
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), id + ': real chart reaches report');
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.map(row => row.id).sort());
});

test('the deferred Tianliang entry conflicts with the actual brightness table in both named branches', () => {
  for (const branch of ['丑', '未']) {
    assert.equal(util.getBrightness('天梁', [...'寅卯辰巳午未申酉戌亥子丑'].indexOf(branch)), '旺');
  }
});
