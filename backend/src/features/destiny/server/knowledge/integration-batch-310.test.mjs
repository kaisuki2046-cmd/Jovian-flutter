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
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileQtbjMetalWater, qtbjMetalWaterProfile } from './qtbj-metal-water-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-qiongtong-metal-water-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const claimId = key => `qtbj-${key}`;
const witnesses = [
  [[1810, 1, 9, 18], 'v5-c062-p001-102/0/0'],
  [[1810, 10, 17, 12], 'v5-c062-p001-102/0/1'],
  [[1884, 3, 21, 8], 'v5-c068-p004-301/0/0'],
  [[1864, 4, 5, 0], 'v5-c069-p003-101/0/0'],
  [[1810, 8, 17, 4], 'v5-c073-p004-301/0/0'],
  [[1822, 3, 28, 12], 'v5-c080-p001-301/0/0'],
  [[1847, 2, 5, 16], 'v5-c080-p006-301/0/0'],
  [[1822, 3, 28, 16], 'v5-c080-p006-301/0/1'],
  [[1822, 4, 17, 16], 'v5-c080-p006-301/0/2'],
  [[1857, 4, 13, 4], 'v5-c081-p004-401/0/0'],
  [[1892, 5, 9, 18], 'v5-c082-p001-101/0/0'],
  [[1810, 5, 21, 0], 'v6-c099-p003-101/0/0'],
  [[1800, 5, 23, 0], 'v6-c099-p004-301/0/0'],
  [[1818, 6, 28, 12], 'v6-c100-p003-101/0/0'],
  [[1964, 8, 1, 4], 'v6-c101-p002-102/0/0'],
  [[1921, 7, 28, 4], 'v6-c101-p002-102/1/0'],
  [[1822, 7, 17, 18], 'v6-c101-p003-301/0/0'],
  [[1822, 1, 28, 18], 'v6-c107-p005-101/0/0'],
  [[1810, 6, 21, 14], 'v6-c112-p004-101/0/0'],
  [[1822, 7, 8, 4], 'v6-c113-p001-101/0/0'],
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

test('Qiongtong metal and water passages reach SQLite and reports with observed stems, roots and formations', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const ids = new Set(witnesses.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const groups = new Map(), verified = new Set();
  for (const key of ids) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    const row = catalog.get(claimId(key));
    row.branches.forEach(({ text, conditionCompiler, inputs }, branch) => {
      assert.equal(conditionCompiler, qtbjMetalWaterProfile);
      inputs.forEach((input, index) => groups.set(`${key}/${branch}/${index}`, { text, input }));
    });
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异本';
    assert.equal(compileQtbjMetalWater(edited).reason, 'source_review_required', key);
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
      assert.doesNotMatch(materials, /身入玉堂|必为显达|名利双全|富屋贫人|因妻致富|可云富贵/u, key);
      verified.add(key);
    }
  }

  assert.deepEqual([ids.size, groups.size, witnesses.length], [16, 20, 20]);
  assert.deepEqual(verified, new Set(groups.keys()));
  for (const key of ['v5-c067-p003-401', 'v5-c079-p002-401', 'v5-c079-p003-101', 'v6-c108-p004-401']) {
    assert.equal(states.get(claimId(key)), 'unmapped', key);
  }
});

test('The Xin spring context excerpt and the two Ren Wei variants are distinct', () => {
  const spring = 'v5-c080-p001-301';
  const springFacts = native(spring + '/0/0');
  const springRow = catalog.get(claimId(spring));
  assert.equal(springRow.claim.evidence.original_text.includes('得甲制伏'), false);
  assert.ok(springRow.claim.evidence.context.includes('得甲制伏'));
  assert.deepEqual(explain(spring, springFacts).matchedBranches.map(branch => branch.text), ['得甲制伏']);
  assert.equal(explain(spring, springFacts, false).matched, false);

  const ren = 'v6-c101-p002-102';
  assert.deepEqual(explain(ren, native(ren + '/0/0')).matchedBranches.map(branch => branch.text), ['甲壬两透，无伤']);
  assert.deepEqual(explain(ren, native(ren + '/1/0')).matchedBranches.map(branch => branch.text), ['甲藏壬出无破']);
});

test('The Gui Wei passage requires a confirmed first half of the solar month', () => {
  const key = 'v6-c113-p001-101';
  const facts = native(key + '/0/0');
  assert.ok(facts.some(fact => fact.kind === 'bazi_previous_qi' && fact.term === '夏至'));
  assert.equal(explain(key, facts).matched, true);
  const withoutQi = facts.filter(fact => fact.kind !== 'bazi_previous_qi');
  assert.equal(explain(key, withoutQi).matched, false);
  assert.equal(explain(key, [...withoutQi, { kind: 'bazi_previous_qi', term: '大暑' }]).matched, false);
});
