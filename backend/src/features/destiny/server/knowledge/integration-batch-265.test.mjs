import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { blindPalaceProfile, compileBlindPalace } from './bazi-blind-palace.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-blind-palace-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = number => 'muxuan-v1-f002-p000' + number + '-001';
const tradition = '盲派命理经典';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1984,1,11,0], ['33/0','48/1','52/0','70/0']],
  [[1984,1,11,2], ['70/1']],
  [[1984,1,11,4], ['68/0']],
  [[1984,1,11,6], ['69/0']],
  [[1984,1,11,10], ['62/0']],
  [[1984,1,11,12], ['65/0','80/0']],
  [[1984,1,11,14], ['64/0']],
  [[1984,1,11,16], ['67/0']],
  [[1984,1,23,0], ['31/0']],
  [[1984,2,11,0], ['37/1','47/0','55/0']],
  [[1984,2,23,0], ['53/0']],
  [[1984,3,11,0], ['37/0']],
  [[1984,4,11,0], ['40/0']],
  [[1984,5,11,0], ['41/0','58/0']],
  [[1984,5,23,0], ['46/0','59/0']],
  [[1984,6,23,0], ['32/0','51/0']],
  [[1984,8,11,0], ['42/0']],
  [[1984,9,23,0], ['30/0']],
  [[1984,10,11,0], ['43/0']],
  [[1984,11,23,0], ['29/0']],
  [[1984,12,11,0], ['54/0']],
  [[1985,1,11,0], ['56/0']],
  [[1985,1,23,0], ['35/0']],
  [[1985,3,11,0], ['48/0']],
  [[1985,3,23,0], ['45/0']],
  [[1985,4,23,0], ['36/0']],
  [[1987,4,23,0], ['77/0']],
  [[1997,3,11,0], ['76/0']],
  [[1971,4,11,0], ['75/0']],
];

function native([year, month, day, hour]) {
  const local = Date.UTC(year, month - 1, day, hour);
  return chartFacts.bazi(calculateBaZi(local - 8 * 3_600_000, local, 'male'));
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, tradition, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('bazi', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const sample = key => native(witnesses.find(([, keys]) => keys.includes(key))[0]);
const explain = (number, facts, timeKnown) => explainClaim(idOf(number), 'bazi', query(facts, timeKnown).context, tradition, catalog);

test('each reviewed palace placement reaches SQLite and report materials from a native chart', () => {
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  const numbers = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  for (const number of numbers) {
    assert.equal(states.get(idOf(number)), 'branch_indexed', number);
    const { claim, branches } = catalog.get(idOf(number));
    assert.equal(branches.length, 1);
    assert.equal(branches[0].conditionCompiler, blindPalaceProfile);
    branches[0].inputs.forEach((input, idx) => expected.set(number + '/' + idx, { input, text: branches[0].text }));
    const changed = structuredClone(claim);
    changed.conditions.match.selector.text += '改版';
    assert.equal(compileBlindPalace(changed).reason, 'source_review_required', number);
  }
  assert.deepEqual([numbers.size, expected.size, witnesses.length], [35, 38, 29]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const refs = lookup(queries);
    const material = buildReportMaterials(refs);
    const hits = new Map(refs.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const number = key.split('/')[0], id = idOf(number), { input, text } = expected.get(key);
      const hit = hits.get(id), evidence = explainClaim(id, 'bazi', context, tradition, catalog);
      assert.ok(hit && evidence?.matched, key);
      assert.deepEqual(hit.matchedBranches, evidence.matchedBranches, key);
      assert.deepEqual(evidence.matchedBranches[0].matchedConditions.required, input.required, key);
      assert.deepEqual(evidence.matchedBranches[0].matchedConditions.absent, input.mustBeAbsent, key);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const number of ['78', '79']) assert.equal(states.get(idOf(number)), 'unmapped', number);
});

test('the year stem and branch main qi must be on the same verified pillar', () => {
  const otherMain = sample('77/0');
  assert.equal(explain('75', otherMain).matched, false);
  const forged = otherMain.map(fact => fact.kind === 'branch_main_ten_god' && fact.position === 'year'
    ? { ...fact, tenGod: '七杀' } : fact);
  assert.equal(explain('75', forged).matched, false);
  const nativeYear = sample('75/0');
  assert.equal(explain('75', nativeYear.filter(fact => !(fact.kind === 'pillar' && fact.position === 'year'))).matched, false);
  assert.equal(explain('75', nativeYear, false).matched, true);
});

test('main qi, exposed stars and confirmed single killing stay distinct', () => {
  const hour = sample('65/0');
  assert.equal(explain('80', hour).matched, true);
  assert.equal(explain('65', hour, false).matched, false);
  assert.equal(explain('80', hour, false).matched, false);
  const day = sample('54/0');
  assert.equal(explain('54', day, false).matched, false);
  assert.equal(explain('54', day.filter(fact => fact.kind !== 'branch_main_ten_god' || fact.position !== 'day')).matched, false);
  const otherDay = sample('51/0');
  const mereHidden = otherDay.filter(fact => fact.kind !== 'branch_main_ten_god' || fact.position !== 'day');
  assert.ok(mereHidden.some(fact => fact.kind === 'branch_ten_god' && fact.position === 'day' && fact.tenGod === '正财'));
  assert.equal(explain('51', mereHidden).matched, false);
});

test('report quotes confirmed placements and leaves the rest of the supplied text at the source', async () => {
  const { queries } = query(sample('75/0'));
  const id = idOf('75');
  const selection = input => lookup(input).map(group => ({
    ...group, personality: group.personality.filter(hit => hit.id === id), events: group.events.filter(hit => hit.id === id),
  }));
  const fullText = catalog.get(id).claim.evidence.original_text;
  assert.match(fullText, /祖上刚强有名望/u);
  const output = await generateReport({ chartQueries: queries }, {
    lookup: selection, signal: new AbortController().signal,
    complete: async ({ references, materials }) => {
      const hit = references.flatMap(ref => [...ref.personality, ...ref.events]).find(ref => ref.id === id);
      assert.equal(hit.title, '盲派宫星定位盘面分句');
      assert.equal(hit.evidence.context, null);
      assert.match(materials, /年上正财（天干）\+ 年支七杀/u);
      assert.doesNotMatch(materials, /祖上刚强有名望|盲派断语不是无条件成立/u);
      return '验证报告';
    },
  });
  assert.equal(output.report, '验证报告');
});
