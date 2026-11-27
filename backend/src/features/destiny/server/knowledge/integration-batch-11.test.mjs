import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { explainClaim } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-11-20261118.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-eleven-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-eleven-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('sixteen new and fifty-nine corrected table entries use computed source brightness with all primitive qualifiers intact', context => {
  const { catalog, report, matches } = setup(context);
  assert.equal(batch.changes.length, 16);
  assert.equal(batch.corrected.length, 59);
  for (const { id } of [...batch.changes, ...batch.corrected]) {
    const row = catalog.get(id);
    assert.ok(row.inputs?.length, id);
    assert.equal(row.reason, undefined, id);
    for (const { required } of row.inputs) {
      assert.ok(required.some(fact => fact.kind === 'palace_source_brightness'), id);
      const observations = required.filter(fact => fact.kind !== 'palace_source_brightness');
      assert.ok(matches(id, observations), id + ': every alternative without supplying the derived value');
    }
    assert.equal(matches(id, []), false, id + ': unknown data');
  }
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    const observations = row.inputs[0].required.filter(fact => fact.kind !== 'palace_source_brightness');
    for (const fact of observations) {
      assert.equal(matches(id, observations.filter(other => other !== fact)), false, id + ': missing ' + fact.kind);
    }
    const forged = row.inputs[0].required.filter(fact => fact.kind === 'palace_source_brightness');
    assert.equal(matches(id, forged), false, id + ': a supplied source brightness alone is insufficient');
    assert.ok(buildReportMaterials(report([query(observations)])).includes(row.claim.evidence.original_text), id);
    const [unknown] = parseChartQueries([query(observations)], { timeKnown: false });
    assert.equal(matches(id, unknown.confirmedFacts), false, id + ': time unknown');
  }
  const jielan = catalog.get('ziwei-v4-jielan-176-p001-001');
  assert.equal(jielan.compiler, jielanNatalStarProfile);
  assert.ok(jielan.inputs.every(({ required }) => required.every(fact => fact.kind !== 'palace_source_brightness')),
    'the Jielan verse uses its own branch evidence');
});

test('all seventy-five entries reach report materials from real births while original and default brightness remain distinguishable', context => {
  const { directory, catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-11-witnesses.json', import.meta.url)));
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  assert.equal(witnesses.profile, batch.profile);
  const special = 'ziwei-v2-minggong-p193000-004';
  let specialChecked = false;
  for (const { profile, timeIndex, ids } of witnesses.witnesses) {
    const chart = calculateZiwei(profile, timeIndex);
    const facts = chartFacts.ziwei(chart);
    const materials = buildReportMaterials(report([query(facts)]));
    for (const id of ids) {
      assert.ok(matches(id, facts), id + ': real birth reaches SQLite');
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), id + ': report source');
      const explanation = explainClaim(id, 'ziwei', chartContext('ziwei', facts), undefined, catalog);
      assert.equal(explanation.matched, true, id);
      assert.match(explanation.calculationNote, /命宫表/u, id);
      seen.add(id);
    }
    if (ids.includes(special)) {
      assert.ok(facts.some(fact => fact.kind === 'palace_brightness' && fact.palace === '命宫' && fact.star === '天梁' && fact.brightness === '旺'));
      assert.match(materials, /天梁位于[丑未]，依《全书》卷二命宫表明度为庙/u);
      assert.match(materials, /与软件默认明度及同卷歌诀分开/u);
      specialChecked = true;
    }
  }
  assert.equal(specialChecked, true);
  assert.deepEqual([...seen].sort(), [...batch.changes, ...batch.corrected].map(row => row.id).sort());
});
