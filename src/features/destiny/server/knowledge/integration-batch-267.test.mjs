import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-shenfeng-killing-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const source = '神峰通考';
const claimId = key => 'muxuan-v1-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1970, 1, 1, 12], 'f013-p00108/1/0'],
  [[1970, 1, 1, 18], 'f009-p00080/0/0'],
  [[1970, 1, 3, 4], 'f013-p00108/0/0'],
  [[1970, 1, 4, 12], 'f013-p00078/0/0'],
  [[1970, 1, 9, 2], 'f013-p00153/0/1'],
  [[1970, 1, 11, 10], 'f013-p00051/0/0'],
  [[1970, 1, 20, 0], 'f013-p00081/0/0'],
  [[1970, 2, 13, 6], 'f013-p00069/0/0', 'f013-p00109/0/0'],
  [[1970, 2, 19, 0], 'f013-p00081/1/0'],
  [[1970, 3, 15, 12], 'f009-p00080/0/1'],
  [[1970, 4, 6, 8], 'f013-p00153/0/0'],
  [[1970, 7, 11, 16], 'f013-p00069/0/1'],
];

function query([year, month, day, hour], { timeKnown = true, extra = [] } = {}) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const natal = calculateBaZi(wall - 8 * 3_600_000, wall, 'male');
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...chartFacts.bazi(natal), ...extra],
  }], { timeKnown });
  assert.ok(queries);
  return queries;
}

function explain(key, birth, options) {
  const [{ confirmedFacts, confirmedAbsentFacts, chartScope }] = query(birth, options);
  return explainClaim(claimId(key), 'bazi', chartContext('bazi', confirmedFacts, confirmedAbsentFacts, chartScope), source, catalog);
}

test('all reviewed alternatives match from natal charts through SQLite and the default report lookup', () => {
  const records = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    const id = claimId(key);
    const { branches } = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', key);
    branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, shenfengReviewedProfile, key);
      inputs.forEach(({ required }, index) => expected.set(`${key}/${branch}/${index}`, { text, required }));
    });
  }
  const checked = new Set();
  for (const [birth, ...keys] of witnesses) {
    const references = lookup(query(birth));
    for (const key of keys) {
      const [record] = key.split('/');
      const id = claimId(record);
      const group = references.find(group => [...group.personality, ...group.events].some(hit => hit.id === id));
      assert.ok(group, key);
      const hit = [...group.personality, ...group.events].find(hit => hit.id === id);
      const { text, required } = expected.get(key);
      const branch = hit.matchedBranches.find(match => match.text === text);
      assert.deepEqual(branch?.matchedConditions.required, required, key);
      assert.deepEqual(hit.matchedBranches, explain(record, birth).matchedBranches, key);
      const report = buildReportMaterials([{ ...group, personality: [], events: [hit] }]);
      assert.ok(report.includes(text), key);
      assert.doesNotMatch(report, /贫贱无子|功名大用|权贵之象|主掌兵权/u);
      checked.add(key);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [8, 13, 12]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the two officer and killing placements cannot be inferred from two exposed or two concealed stars', () => {
  const bothShown = [1970, 1, 1, 18];
  const bothHidden = [1970, 1, 4, 0];
  const forged = { kind: 'bazi_natal_configuration', name: '七杀透干而正官只藏支' };
  assert.equal(explain('f013-p00108', bothShown).matched, false);
  assert.equal(explain('f013-p00108', bothHidden, { extra: [forged] }).matched, false);
  assert.equal(explain('f013-p00108', [1970, 1, 3, 4], { timeKnown: false }).matched, false);
});

test('the hour, blade, roots and wealth each constrain the cited passage', () => {
  assert.equal(explain('f013-p00078', [1970, 1, 3, 4]).matched, false);
  assert.equal(explain('f013-p00069', [1970, 1, 4, 12]).matched, false);
  assert.equal(explain('f013-p00109', [1970, 3, 15, 12]).matched, false);
  const rooted = explain('f013-p00081', [1970, 2, 19, 0]);
  assert.deepEqual(rooted.matchedBranches.map(branch => branch.text), ['时杀多根']);
  const rootless = explain('f013-p00081', [1970, 1, 20, 0]);
  assert.deepEqual(rootless.matchedBranches.map(branch => branch.text), ['时杀虚露无根、无财生']);
  assert.equal(explain('f013-p00081', [1970, 1, 10, 0]).matched, false);
  assert.equal(explain('f013-p00081', [1971, 3, 16, 0]).matched, false);
});
