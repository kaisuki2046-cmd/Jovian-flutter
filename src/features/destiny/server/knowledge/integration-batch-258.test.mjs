import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueHealth } from './xingjue-health.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-health-witness-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = passage => 'ziwei-v3-xingjue-052-p' + passage + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1948, 6, 2, 7, 'male'], ['673/0/0', '1468/0/0', '1468/1/0', '1471/0/0', '1471/1/0']],
  [[1949, 12, 12, 10, 'male'], ['1446/0/0/a1', '1446/0/2/a0', '1462/3/0', '1465/0/0', '1465/1/0']],
  [[1932, 2, 22, 7, 'male'], ['1462/1/0', '1467/0/0', '1472/0/1']],
  [[1930, 8, 8, 3, 'male'], ['673/0/1', '1471/0/1']],
  [[1932, 9, 1, 11, 'female'], ['670/0/0', '1456/0/0']],
  [[1937, 5, 21, 10, 'female'], ['1453/0/0', '1473/0/0']],
  [[1941, 9, 17, 7, 'female'], ['671/0/1', '1461/0/0']],
  [[1943, 12, 20, 0, 'male'], ['680/0/0', '1449/0/0']],
  [[1944, 7, 3, 7, 'female'], ['678/0/0', '678/1/0']],
  [[1945, 10, 26, 0, 'male'], ['1458/0/0', '1458/1/0']],
  [[1953, 12, 16, 9, 'male'], ['1466/0/0', '1466/1/0']],
  [[1958, 5, 21, 5, 'female'], ['1446/0/0/a2', '1446/0/1/a1']],
  [[1968, 7, 27, 8, 'female'], ['674/0/0', '1446/0/4/a0']],
  [[1974, 3, 27, 4, 'female'], ['1451/0/0', '1451/1/0']],
  [[2019, 8, 20, 6, 'male'], ['1463/0/0', '1463/1/0']],
  [[1936, 5, 26, 6, 'male'], ['1448/0/0', '1448/1/0']],
  [[1942, 7, 29, 9, 'male'], ['1446/0/0/a0', '1446/0/3/a2']],
  [[1930, 2, 6, 1, 'male'], ['1462/0/0']],
  [[1930, 3, 11, 11, 'female'], ['1472/0/0']],
  [[1930, 4, 16, 7, 'male'], ['1452/0/0']],
  [[1930, 6, 26, 10, 'male'], ['1462/2/0']],
  [[1930, 10, 18, 6, 'male'], ['1452/0/1']],
  [[1931, 6, 6, 4, 'male'], ['1454/0/0']],
  [[1932, 2, 22, 4, 'male'], ['1446/0/2/a2']],
  [[1932, 6, 14, 8, 'male'], ['1446/0/4/a1']],
  [[1933, 2, 2, 7, 'male'], ['1460/0/0']],
  [[1933, 2, 2, 8, 'male'], ['1464/0/0']],
  [[1933, 4, 12, 1, 'male'], ['679/0/0']],
  [[1935, 6, 10, 5, 'male'], ['1467/1/0']],
  [[1935, 10, 2, 4, 'male'], ['671/0/2']],
  [[1936, 2, 26, 3, 'male'], ['1475/0/0']],
  [[1936, 5, 13, 7, 'female'], ['1447/0/0']],
  [[1937, 11, 23, 0, 'female'], ['676/0/0']],
  [[1938, 4, 24, 4, 'male'], ['1455/0/0']],
  [[1939, 12, 16, 2, 'male'], ['682/0/0']],
  [[1941, 4, 20, 1, 'male'], ['671/0/0']],
  [[1943, 6, 18, 0, 'male'], ['677/0/0']],
  [[1946, 12, 16, 5, 'male'], ['1450/0/0']],
  [[2013, 3, 14, 0, 'male'], ['1459/0/0', '1459/1/0']],
  [[1957, 11, 15, 6, 'female'], ['1456/1/1']],
  [[1958, 2, 6, 11, 'male'], ['671/0/3']],
  [[1970, 9, 25, 9, 'female'], ['1446/0/3/a0']],
  [[1974, 7, 19, 7, 'female'], ['1446/0/5/a0']],
  [[1978, 9, 5, 9, 'female'], ['1446/0/3/a1']],
  [[1979, 9, 13, 6, 'female'], ['1456/1/0']],
  [[1980, 1, 9, 11, 'female'], ['1446/0/1/a0']],
  [[2015, 12, 8, 1, 'male'], ['1453/1/0']],
  [[2026, 10, 2, 7, 'male'], ['1446/0/5/a1']],
  [[1932, 8, 18, 10, 'male'], ['1446/0/2/a1']],
];

function native([year, month, day, hour, gender]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
}

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, tradition: '紫微星诀',
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const sample = key => native(witnesses.find(([, keys]) => keys.includes(key))[0]);
const explain = (passage, facts) => explainClaim(idOf(passage), 'ziwei', query(facts).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('all reviewed health palace conditions and their alternatives have real natal witnesses in SQLite', () => {
  const ids = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  let groups = 0;
  for (const passage of ids) {
    const id = idOf(passage), row = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', id);
    row.branches.forEach(({ text, inputs }, branch) => inputs.forEach((input, group) => {
      groups += 1;
      const key = [passage, branch, group].join('/');
      if (input.anyOf.length) input.anyOf.forEach((alt, index) => expected.set(key + '/a' + index, { input, text, alt }));
      else expected.set(key, { input, text });
    }));
    const revised = structuredClone(row.claim);
    revised.evidence.original_text += '校記';
    assert.equal(compileXingjueHealth(revised).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, groups, expected.size, witnesses.length], [36, 65, 74, 49]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const references = lookup(queries);
    const material = buildReportMaterials(references);
    const hits = new Map(references.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const id = idOf(key.split('/')[0]), { input, text, alt } = expected.get(key);
      const match = evaluateRule(input, 'natal', chart);
      assert.ok(match.matched, key);
      if (alt) assert.ok(match.conditions.alternatives.some(value => JSON.stringify(value) === JSON.stringify(alt)), key);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, key);
      assert.deepEqual(quotes(hit), quotes(explained), key);
      assert.match(explained.calculationNote, /紫微星诀.*疾厄/u);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  for (const passage of ['668', '669', '1457', '1469', '1470']) {
    assert.equal(states.get(idOf(passage)), 'unmapped', passage);
  }
});

test('horse sword and external Lu require separate birth hour and carrier evidence', () => {
  const horse = sample('1448/1/0');
  assert.deepEqual(quotes(explain('1448', horse)), ['厄宮馬頭帶釖', '而若木局人得天同水相救']);
  assert.equal(explain('1448', horse.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  const outsideLu = sample('1458/1/0');
  const base = '巳宮疾、天同單守、申地長生貪狼相合、亥地天梁相照';
  assert.deepEqual(quotes(explain('1458', outsideLu)), [base, '又有祿存化祿間一星來會']);
  assert.deepEqual(quotes(explain('1458', outsideLu.filter(fact => fact.kind !== 'star_mutagen'
    || fact.star !== '天机' || fact.change !== '禄'))), [base]);
  const growth = outsideLu.filter(fact => fact.kind !== 'natal_ziwei_bureau')
    .concat({ kind: 'palace_changsheng_phase', palace: '夫妻', phase: '长生' });
  assert.equal(explain('1458', growth).matched, false);
});

test('confirmed adjacent placements and separate twelve-star cycles are required', () => {
  const flank = sample('1468/1/0');
  assert.deepEqual(quotes(explain('1468', flank)), ['巳疾鈴貪貞同居', '空刧夾者']);
  assert.deepEqual(quotes(explain('1468', flank.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '迁移' || fact.star !== '地空'))), ['巳疾鈴貪貞同居']);
  const costs = sample('1472/0/0');
  assert.ok(explain('1472', costs).matched);
  assert.equal(explain('1472', costs.filter(fact => fact.kind !== 'palace_boshi_star'
    || fact.palace !== '疾厄' || fact.star !== '大耗')).matched, false);
  const related = sample('1459/1/0');
  assert.deepEqual(quotes(explain('1459', related)), ['疾宮刑鈴、水生水局人', '府相合照']);
  assert.deepEqual(quotes(explain('1459', related.filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '田宅' || fact.star !== '天相'))), ['疾宮刑鈴、水生水局人']);
});

test('reports use the matched star configuration while the source retains the historical health claims', async () => {
  const { queries } = query(sample('1448/1/0'));
  const id = idOf('1448');
  const lookupTarget = input => lookup(input).map(topic => ({
    ...topic,
    personality: topic.personality.filter(hit => hit.id === id),
    events: topic.events.filter(hit => hit.id === id),
  }));
  const { claim } = catalog.get(id);
  assert.match(claim.evidence.original_text, /藥效/u);
  assert.ok(claim.interpretation.limitations.some(limit => limit.includes('藥效')));
  let sent;
  await generateReport({ chartQueries: queries }, { lookup: lookupTarget, complete: async payload => {
    sent = payload;
    return '报告';
  }, signal: new AbortController().signal });
  const ref = sent.references.flatMap(topic => topic.events).find(item => item.id === id);
  assert.equal(ref.title, '《紫微星诀》疾厄宫盘面分句');
  assert.equal(ref.evidence.original_text, '厄宮馬頭帶釖。而若木局人得天同水相救');
  assert.deepEqual(ref.interpretation.limitations, []);
  assert.match(sent.materials, /厄宮馬頭帶釖/u);
  assert.doesNotMatch(sent.materials, /藥效|药效|極惡/u);
});
