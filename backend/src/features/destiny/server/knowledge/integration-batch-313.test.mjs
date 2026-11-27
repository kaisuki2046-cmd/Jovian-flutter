import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { normalizeFacts } from './catalog.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileDtsjyReviewedPassage, dtsjyReviewedProfile } from './bazi-dtsjy-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-dtsjy-climate-and-flow-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `dtsjy-v1-c${key}`;
const witnesses = [
  [[1800, 4, 5, 16, '男'], '019-p003-201/0/0'],
  [[1815, 7, 21, 4, '男'], '019-p003-201/1/0', '037-p003-001/0/0'],
  [[1800, 2, 24, 16, '男'], '025-p002-002/0/0'],
  [[1798, 5, 9, 16, '男'], '037-p003-001/1/0'],
  [[1798, 12, 9, 0, '男'], '037-p005-001/0/0'],
  [[1800, 9, 1, 0, '男'], '037-p005-001/0/1'],
  [[1798, 1, 1, 0, '男'], '037-p009-001/0/0', '044-p007-001/2/0', '044-p012-001/0/0'],
  [[1798, 11, 28, 0, '男'], '037-p009-001/0/1'],
  [[1798, 3, 28, 0, '男'], '037-p015-001/0/0'],
  [[1921, 11, 17, 20, '男'], '037-p017-001/0/0'],
  [[1884, 12, 1, 20, '男'], '037-p017-001/0/1'],
  [[1798, 6, 28, 0, '男'], '037-p023-001/0/0'],
  [[1798, 1, 1, 16, '男'], '041-p002-003/0/0'],
  [[1798, 7, 8, 0, '男'], '041-p008-001/0/0'],
  [[1822, 7, 27, 6, '男'], '041-p008-001/1/0'],
  [[1800, 7, 22, 2, '男'], '041-p008-002/0/0'],
  [[1800, 10, 5, 4, '男'], '042-p006-001/0/0'],
  [[1821, 10, 21, 8, '男'], '043-p005-001/0/0'],
  [[1798, 1, 5, 10, '男'], '044-p007-001/0/0'],
  [[1798, 2, 9, 0, '男'], '044-p007-001/1/0'],
  [[1798, 1, 1, 18, '男'], '044-p007-001/3/0'],
];

const decadalWitnesses = [
  [0, [1798, 1, 5, 10, '男'], [['丁未', 51, 60], ['丙午', 61, 70], ['乙巳', 71, 80]]],
  [1, [1798, 2, 5, 0, '男'], [['丁巳', 30, 39], ['戊午', 40, 49], ['己未', 50, 59]]],
];

function natalFacts([year, month, day, hour, gender = '男']) {
  const wall = Date.UTC(year, month - 1, day, hour);
  const chart = calculateBaZi(wall - 8 * 3_600_000, wall, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}
const native = key => natalFacts(witnesses.find(([, ...keys]) => keys.includes(key))[0]);

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('bazi', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts, timeKnown) => explainClaim(claimId(key), 'bazi', query(facts, timeKnown).context, undefined, catalog);

test('Ditian Sui climate, flow and relative strength passages reach SQLite and reports', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, dtsjyReviewedProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileDtsjyReviewedPassage(edited).reason, 'source_review_required', key);
  }

  for (const [birth, ...keys] of witnesses) {
    const { queries, context } = query(natalFacts(birth));
    const derived = claimChartContext('bazi', context);
    const hits = lookup(queries).flatMap(ref => [...ref.personality, ...ref.events]);
    for (const key of keys) {
      const id = claimId(key.split('/')[0]);
      const { text, input } = groups.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, key);
      assert.deepEqual(hit.matchedBranches, explainClaim(id, 'bazi', context, undefined, catalog).matchedBranches, key);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), key);
      const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(materials.includes(text), key);
      assert.doesNotMatch(materials, /滯而無成|烈而有禍|怕事|兄弟必貴|多妻妾|碌碌人|燥急不可禦/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [15, 24, 21]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['024-p003-201', '025-p003-001', '037-p023-003', '040-p002-002', '041-p004-001']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('Observed damp and dry branches differ and the measured share has its own fact profile', () => {
  const climate = '019-p003-201';
  const damp = native(climate + '/0/0');
  const dry = native(climate + '/1/0');
  assert.deepEqual(explain(climate, damp).matchedBranches.map(branch => branch.text), ['過於濕者']);
  assert.deepEqual(explain(climate, dry).matchedBranches.map(branch => branch.text), ['過於燥者']);
  assert.equal(explain(climate, dry, false).matched, false);

  const relative = '044-p007-001';
  const row = catalog.get(claimId(relative));
  const lighter = row.branches[0].inputs[0].required.find(fact => fact.strength === '少量');
  assert.equal(lighter.group, '伤官');
  assert.deepEqual(normalizeFacts('bazi', [lighter]), [lighter]);
  assert.throws(() => normalizeFacts('bazi', [{ ...lighter, profile: 'anchored-weighted-ten-god-v1' }]), /Invalid fields/u);
  const genuine = native(relative + '/0/0');
  assert.ok(explain(relative, genuine).matchedBranches.some(branch => branch.text === '傷輕財重'));
  assert.equal(explain(relative, genuine, false).matched, false);
});

test('Southward luck requires a native period and reports its verified age span', () => {
  const key = '037-p007-001', id = claimId(key);
  const row = catalog.get(id);
  const inventory = catalog.inventory().find(({ claim }) => claim.id === id);
  assert.equal(inventory.lookup.status, 'branch_indexed');
  assert.equal(row.branches.length, decadalWitnesses.length);
  const edited = structuredClone(row.claim);
  edited.evidence.context += '异本';
  assert.equal(compileBaZiDecadalPassage(edited).reason, 'source_review_required');

  for (const [index, birth, expected] of decadalWitnesses) {
    const spec = row.branches[index];
    assert.equal(spec.conditionCompiler, baziDecadalPassageProfile);
    assert.deepEqual(spec.decadalAnchor.branches, ['巳', '午', '未']);
    const facts = natalFacts(birth);
    const { queries } = query(facts);
    const hits = lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);
    const hit = hits.find(item => item.id === id);
    assert.ok(hit, index);
    assert.equal(hit.matchedBranches.length, 1);
    assert.deepEqual(hit.matchedBranches, explain(key, facts).matchedBranches);
    const [{ text, matchedConditions }] = hit.matchedBranches;
    assert.equal(text, '奔南');
    assert.deepEqual(matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) =>
      [ganZhi, startAge, endAge]), expected);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    for (const [pillar, from, to] of expected) {
      assert.ok(materials.includes(`${from}至${to}虚岁${pillar}运限`));
    }
    assert.doesNotMatch(materials, /軟怯|姑息/u);
    assert.equal(explain(key, facts.filter(fact => fact.kind !== 'bazi_decadal_range')).matched, false);
    assert.equal(explain(key, facts, false).matched, false);
  }
});
