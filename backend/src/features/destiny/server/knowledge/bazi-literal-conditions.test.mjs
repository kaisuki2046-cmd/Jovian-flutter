import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts, chartVersions } from '../../control/charts.ts';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { compileClaimSources, createClaimsCatalog, lookupClaims, claimChartContext } from './claims.mjs';
import { chartContext } from './matching.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-15-20261118.json', import.meta.url)));
const stem = (position, stem) => ({ kind: 'stem', position, stem });
const branch = (position, branch) => ({ kind: 'branch', position, branch });
const observed = pillars => chartFacts.bazi(describeBaZiPillars(pillars));
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
function fixture(context, conditions) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-literal-bazi-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-literal-bazi-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const sourceDirectory = join(directory, 'source');
  mkdirSync(sourceDirectory);
  const original = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)))
    .find(row => row.id === 'qtbj-v2-c005-p004-001');
  const claims = conditions.map((normalized, index) => ({ ...structuredClone(original), id: 'test-literal-' + index,
    conditions: { original: normalized, normalized, uncertain: [], excluded: [] } }));
  writeFileSync(join(sourceDirectory, 'bazi.json'), JSON.stringify(claims));
  for (const method of ['ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false });
  return { catalog, matches: (index, facts) => lookupClaims('bazi', chartContext('bazi', facts, [], 'natal'), undefined, catalog)
    .some(hit => hit.id === claims[index].id) };
}

test('the production literal records retain distinct month OR branches and reject impossible visible-stem placements', () => {
  const rows = new Map(compileClaimSources().map(row => [row.claim.id, row]));
  assert.equal(batch.changes.length, 14);
  assert.ok(batch.changes.every(({ id }) => rows.get(id).inputs?.length));
  const triple = rows.get('qtbj-v2-c005-p004-001').inputs;
  assert.equal(triple.length, 1, 'five-tiger constraints permit only one placement of the three visible stems');
  assert.deepEqual(triple[0].required.filter(fact => fact.kind === 'stem').map(fact => [fact.position, fact.stem]).sort(),
    [['day', '甲'], ['hour', '庚'], ['month', '丁'], ['year', '癸']]);
  const twoMonths = rows.get('qtbj-v2-c005-p008-001').inputs;
  assert.equal(twoMonths.length, 6);
  assert.deepEqual([...new Set(twoMonths.map(input => input.required.find(fact => fact.kind === 'branch' && fact.position === 'month').branch))].sort(), ['午', '未'].sort());
  for (const input of twoMonths) {
    const month = input.required.find(fact => fact.kind === 'branch' && fact.position === 'month').branch;
    assert.deepEqual(input.required.filter(fact => fact.kind === 'stem' && fact.position !== 'day').map(fact => fact.stem).sort(),
      (month === '午' ? ['癸', '庚'] : ['庚', '丁']).sort());
    assert.ok(compatibleBaZiLiteralFacts(input.required, input.mustBeAbsent));
  }
});

test('calendar compatibility admits native engine facts and rejects contradictory pillars and implied forbidden stems', () => {
  let checked = 0;
  for (let year = 1960; year < 2020; year += 5) for (let month = 0; month < 12; month += 2) for (const hour of [0, 6, 12, 18]) {
    const local = Date.UTC(year, month, 17, hour);
    const facts = chartFacts.bazi(calculateBaZi(local - 8 * 3600000, local));
    assert.equal(compatibleBaZiLiteralFacts(facts), true, `${year}/${month}/${hour}`);
    checked++;
  }
  assert.equal(checked, 288);
  assert.equal(compatibleBaZiLiteralFacts([{ kind: 'pillar', position: 'year', ganZhi: '甲子' }, stem('year', '乙')]), false);
  assert.equal(compatibleBaZiLiteralFacts([stem('year', '甲'), branch('year', '丑')]), false);
  assert.equal(compatibleBaZiLiteralFacts([stem('year', '癸'), stem('month', '丁'), branch('month', '巳')]), true);
  assert.equal(compatibleBaZiLiteralFacts([stem('year', '庚'), stem('month', '丁'), branch('month', '巳')]), false);
  assert.equal(compatibleBaZiLiteralFacts([stem('year', '庚'), branch('month', '未')], [stem('month', '癸')]), false, 'month stem is implied even without a positive month-stem fact');
  assert.equal(compatibleBaZiLiteralFacts([stem('day', '甲'), branch('hour', '酉')], [stem('hour', '癸')]), false);
  assert.equal(compatibleBaZiLiteralFacts([{ kind: 'stem_ten_god', position: 'year', tenGod: '正官' }, { kind: 'stem_ten_god', position: 'year', tenGod: '正印' }]), false);
});

test('OR alternatives carry their own exclusions and unshown differs from no visible or concealed occurrence', context => {
  const { catalog, matches } = fixture(context, [
    ['甲日午月透癸且庚不透，或未月透丁且癸不透'],
    ['乙日卯月丙癸同透且庚不透'],
    ['乙日卯月丙癸同透且庚不见'],
  ]);
  const june = observed({ year: '癸卯', month: '戊午', day: '甲寅', hour: '丙寅' });
  const july = observed({ year: '丁卯', month: '丁未', day: '甲寅', hour: '丙寅' });
  assert.equal(matches(0, june), true);
  assert.equal(matches(0, july), true);
  assert.equal(matches(0, observed({ year: '丁卯', month: '丙午', day: '甲寅', hour: '戊辰' })), false, 'do not use the other month\'s visible stem');
  assert.equal(matches(0, observed({ year: '癸卯', month: '戊午', day: '甲寅', hour: '庚午' })), false, 'forbidden visible stem breaks only its own branch');
  const [unknown] = parseChartQueries([query(june)], { timeKnown: false });
  assert.equal(matches(0, unknown.confirmedFacts), false, 'unknown hour cannot prove all three visible slots lack 庚');
  const hidden = observed({ year: '癸酉', month: '乙卯', day: '乙巳', hour: '丙子' });
  assert.equal(matches(1, hidden), true, '庚 hidden in 巳 does not violate 庚不透');
  assert.equal(matches(2, hidden), false, '庚不见 also checks the concealed stem');
  assert.ok(catalog.get('test-literal-2').inputs.every(input => input.mustBeAbsent.some(fact => fact.kind === 'branch' && fact.branch === '巳')));
  assert.equal(matches(2, hidden.filter(fact => fact.kind !== 'branch' && fact.kind !== 'pillar')), false, 'no complete branch observations, no absence proof');
  const contextOnly = claimChartContext('bazi', chartContext('bazi', []));
  assert.equal(contextOnly.absentKeys.size, 0);
});

test('unknown control, strength, bare see and unsupported multiplicity clauses remain pending rather than being dropped', context => {
  const { catalog } = fixture(context, [
    ['巳月甲木癸丁庚都透干，另须未定义的制化'],
    ['巳月甲木见庚丁但癸不透'],
    ['甲日午月透癸，日主有力且制化有情'],
    ['巳月甲木透、'],
    ['巳月甲木庚庚同透'],
    ['巳月甲木庚丁透干又透庚'],
    ['巳月甲木四庚透干'],
  ]);
  for (let i = 0; i < 7; i++) {
    const row = catalog.get('test-literal-' + i);
    assert.equal(row.inputs, undefined, row.claim.id);
    assert.equal(row.reason, 'unmapped_condition');
  }
});
