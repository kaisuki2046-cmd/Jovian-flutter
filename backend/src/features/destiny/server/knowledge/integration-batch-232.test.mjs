import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjMetalWater } from './qtbj-metal-water-passages.mjs';
import { compileQtbjWoodFireEarth } from './qtbj-wood-fire-earth-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-qtbj-placements-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = suffix => 'qtbj-' + suffix;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Suffix, passage, input group, birth instant in UTC, reported gender.
const witnesses = [
  ['v2-c004-p012-301', 0, 0, '1903-04-25T18:15Z', '男'],
  ['v2-c004-p012-301', 1, 0, '1903-04-25T18:15Z'],
  ['v2-c013-p005-401', 0, 0, '1900-08-19T16:15Z'],
  ['v2-c013-p005-401', 0, 1, '1918-09-14T16:15Z'],
  ['v2-c013-p005-401', 0, 2, '1901-11-02T16:15Z'],
  ['v2-c013-p014-001', 0, 0, '1901-11-03T08:15Z'],
  ['v3-c015-p003-301', 0, 0, '1900-05-12T16:15Z'],
  ['v3-c015-p003-301', 0, 1, '1902-06-21T18:15Z'],
  ['v3-c015-p003-301', 0, 2, '1901-07-26T16:15Z'],
  ['v3-c015-p003-301', 0, 3, '1900-05-23T16:15Z'],
  ['v3-c015-p003-301', 0, 4, '1902-07-02T16:15Z'],
  ['v3-c015-p003-301', 0, 5, '1901-08-06T16:15Z'],
  ['v3-c015-p003-301', 1, 0, '1900-05-12T16:15Z'],
  ['v3-c015-p003-301', 1, 1, '1902-06-21T16:15Z'],
  ['v3-c015-p003-301', 1, 2, '1901-07-26T16:15Z'],
  ['v3-c015-p003-301', 1, 3, '1900-05-23T16:15Z'],
  ['v3-c015-p003-301', 1, 4, '1902-07-02T16:15Z'],
  ['v3-c015-p003-301', 1, 5, '1901-08-06T16:15Z'],
  ['v3-c026-p003-301', 0, 0, '1902-10-09T16:15Z'],
  ['v3-c037-p001-101', 0, 0, '1909-09-23T18:15Z'],
  ['v4-c057-p004-301', 0, 0, '2023-03-22T14:15Z'],
  ['v4-c061-p004-301', 0, 0, '1933-11-19T02:15Z'],
  ['v4-c061-p004-301', 0, 1, '1901-12-17T02:15Z'],
  ['v5-c067-p006-301', 0, 0, '1919-02-27T12:15Z'],
  ['v6-c101-p004-401', 0, 0, '1903-07-23T14:15Z'],
  ['v6-c101-p004-401', 0, 0, '1947-07-11T22:15Z'],
];

function request(date, gender = '女', timeKnown = true) {
  const instant = Date.parse(date);
  const natal = calculateBaZi(instant, instant + 8 * 3_600_000);
  const confirmedFacts = [...chartFacts.bazi(natal), { kind: 'natal_gender', gender }];
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, chart: chartContext('bazi', present, absent, chartScope) };
}

const explain = (suffix, date, gender, timeKnown) =>
  explainClaim(claimId(suffix), 'bazi', request(date, gender, timeKnown).chart, undefined, catalog);
const report = hit => buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);

test('all reviewed seasonal inputs reach SQLite and report material on native charts', () => {
  const ids = new Set(witnesses.map(([suffix]) => claimId(suffix)));
  const statuses = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), covered = new Set(), charts = new Map();
  for (const id of ids) {
    const { claim, inputs, branches } = catalog.get(id);
    const whole = id.endsWith('c057-p004-301');
    assert.equal(statuses.get(id), whole ? 'indexed' : 'branch_indexed', id);
    const passages = whole ? [{ inputs }] : branches;
    passages.forEach((passage, b) => passage.inputs.forEach((_, g) => expected.add([id, b, g].join('/'))));
    const changed = structuredClone(claim);
    changed.evidence.context += '异本文字';
    const compiled = compileQtbjWoodFireEarth(changed) ?? compileQtbjMetalWater(changed);
    assert.equal(compiled.reason, 'source_review_required', id);
  }
  for (const [suffix, branch, group, date, gender = '女'] of witnesses) {
    const id = claimId(suffix), key = date + gender;
    if (!charts.has(key)) {
      const { queries, chart } = request(date, gender);
      const hits = new Map(lookup(queries).flatMap(({ events, personality }) =>
        [...events, ...personality].map(hit => [hit.id, hit])));
      charts.set(key, { chart, derived: claimChartContext('bazi', chart), hits });
    }
    const { chart, derived, hits } = charts.get(key), hit = hits.get(id);
    const { inputs, branches, claim } = catalog.get(id);
    const selected = branches[branch] ?? { inputs, text: claim.evidence.original_text };
    const label = [id, branch, group].join('/');
    assert.ok(evaluateRule(selected.inputs[group], 'natal', derived).matched, label);
    assert.ok(hit && explainClaim(id, 'bazi', chart, undefined, catalog).matched, label);
    assert.ok(report(hit).includes(selected.text), label);
    covered.add(label);
  }
  assert.deepEqual([ids.size, expected.size, charts.size], [10, 25, 21]);
  assert.deepEqual(covered, expected);
});

test('conditional passages remain independent and uncertain continuations are withheld', () => {
  const date = '1903-04-25T18:15Z';
  const male = explain('v2-c004-p012-301', date, '男');
  const female = explain('v2-c004-p012-301', date, '女');
  assert.deepEqual(male.matchedBranches.map(({ text }) => text), ['此人劳碌到老，无驭内之权。']);
  assert.deepEqual(female.matchedBranches.map(({ text }) => text), ['女命合此，女掌男权，贤能内助']);
  const records = lookup(request('1909-09-23T18:15Z').queries);
  const evidence = records.flatMap(({ events, personality }) => [...events, ...personality])
    .find(hit => hit.id === claimId('v3-c037-p001-101'));
  assert.ok(evidence);
  assert.doesNotMatch(report(evidence), /弃命从才|异途/u);
  assert.equal(explain('v3-c037-p001-101', '1909-09-23T16:15Z').matched, false);
});

test('a known full chart is required for the absence and configuration checks', () => {
  assert.equal(explain('v3-c037-p001-101', '1909-09-23T18:15Z', '女', false).matched, false);
  assert.equal(explain('v4-c057-p004-301', '2023-03-22T14:15Z', '女', false).matched, false);
  assert.equal(explain('v4-c057-p004-301', '2023-03-22T12:15Z').matched, false);
  for (const date of ['1903-07-23T14:15Z', '1947-07-11T22:15Z']) {
    assert.equal(explain('v6-c101-p004-401', date, '女', false).matched, false);
  }
});
