import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjuePalaceConfiguration } from './xingjue-palace-configurations.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-palace-configurations-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = record => 'ziwei-v3-xingjue-' + record + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1925, 1, 27, 3, 'male'], ['050-p1389/0/0']],
  [[1925, 2, 8, 4, 'male'], ['050-p1398/0/0']],
  [[1925, 4, 8, 6, 'male'], ['050-p1398/0/1']],
  [[1927, 2, 22, 0, 'male'], ['050-p1407/0/0']],
  [[1928, 2, 22, 7, 'male'], ['057-p772/0/0']],
  [[1924, 2, 22, 10, 'male'], ['057-p1610/0/0', '057-p1610/1/0']],
  [[1929, 8, 8, 4, 'male'], ['057-p1617/0/0', '057-p1617/1/0', '057-p1617/2/0']],
  [[1924, 2, 8, 3, 'male'], ['057-p1618/0/0']],
  [[1924, 3, 2, 9, 'male'], ['057-p1618/0/1']],
  [[1926, 4, 15, 11, 'male'], ['057-p1631/0/0']],
  [[1927, 10, 22, 0, 'male'], ['058-p775/0/0']],
  [[1926, 2, 27, 5, 'male'], ['058-p776/0/0', '058-p1642/0/0']],
  [[1932, 2, 8, 11, 'male'], ['058-p776/0/1']],
  [[1924, 6, 8, 11, 'male'], ['058-p819/0/0']],
  [[1925, 3, 2, 11, 'male'], ['058-p819/0/1']],
  [[1925, 2, 15, 3, 'female'], ['058-p819/0/2']],
  [[1925, 3, 22, 9, 'male'], ['058-p819/0/3']],
  [[1934, 6, 27, 11, 'male'], ['058-p1645/0/0']],
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
const explain = (record, facts) => explainClaim(idOf(record), 'ziwei', query(facts).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('each confirmed palace group reaches SQLite and the report from an actual natal chart', () => {
  const records = new Set(witnesses.flatMap(([, keys]) => keys.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup }) => [claim.id, lookup.status]));
  const expected = new Map();
  for (const record of records) {
    const id = idOf(record), entry = catalog.get(id);
    assert.equal(states.get(id), 'branch_indexed', id);
    entry.branches.forEach(({ text, inputs }, branch) => inputs.forEach((input, index) => {
      expected.set([record, branch, index].join('/'), { text, input });
    }));
    const changed = structuredClone(entry.claim);
    changed.source.edition += '改版';
    assert.equal(compileXingjuePalaceConfiguration(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [13, 22, 18]);
  const seen = new Set();
  for (const [birth, keys] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const refs = lookup(queries), material = buildReportMaterials(refs);
    const hits = new Map(refs.flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const key of keys) {
      const record = key.split('/')[0], { text, input } = expected.get(key);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
      const id = idOf(record), hit = hits.get(id);
      const explanation = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explanation.matched, key);
      assert.deepEqual(quotes(hit), quotes(explanation), key);
      assert.ok(material.includes(text), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('star cycles, opposite locations and source-specific aliases are verified separately', () => {
  const tiger = sample('058-p776/0/0');
  const wrongTigerCycle = tiger.map(fact => fact.kind === 'palace_suiqian_star' && fact.star === '白虎'
    ? { ...fact, kind: 'palace_boshi_star', star: '喜神' } : fact);
  assert.equal(explain('058-p776', wrongTigerCycle).matched, false);
  assert.equal(explain('058-p1642', wrongTigerCycle).matched, true);
  const missingMoon = tiger.filter(fact => !(fact.palace === '疾厄' && fact.star === '太阴'));
  assert.equal(explain('058-p776', missingMoon).matched, false);
  assert.equal(explain('058-p1642', missingMoon).matched, false);

  const peach = sample('058-p775/0/0');
  const otherPeachStar = peach.map(fact => fact.palace === '父母' && fact.star === '贪狼' ? { ...fact, star: '咸池' } : fact);
  assert.equal(explain('058-p775', otherPeachStar).matched, false);

  const fude = sample('057-p772/0/0');
  assert.equal(explain('057-p772', fude.filter(fact => fact.star !== '天姚')).matched, false);
});

test('flanks and the noon Fude extensions require their actual positions', () => {
  const withFudeExtensions = sample('057-p1617/2/0');
  const missingFire = withFudeExtensions.filter(fact => !(fact.palace === '田宅' && fact.star === '火星'));
  assert.deepEqual(quotes(explain('057-p1617', missingFire)), ['午福雖得祿存']);
  const flank = sample('050-p1398/0/0');
  const lostSeal = flank.filter(fact => !(fact.palace === '财帛' && fact.star === '封诰'));
  assert.equal(explain('050-p1398', lostSeal).matched, false);
});

test('the two voids require both distinct stars and the confirmed birth-year stem', () => {
  const facts = sample('058-p1645/0/0');
  for (const lost of ['旬空', '截路']) {
    assert.equal(explain('058-p1645', facts.filter(fact => !(fact.palace === '父母' && fact.star === lost))).matched, false);
  }
  assert.equal(explain('058-p1645', facts.filter(fact => fact.kind !== 'natal_year_stem')).matched, false);
});

test('older readings remain in the source while prompt materials use the confirmed star placement', () => {
  const facts = sample('050-p1407/0/0');
  const { queries } = query(facts);
  const id = idOf('050-p1407'), only = refs => refs.map(group => ({
    ...group, personality: group.personality.filter(hit => hit.id === id), events: group.events.filter(hit => hit.id === id),
  }));
  assert.match(catalog.get(id).claim.evidence.original_text, /必無子女/u);
  const material = buildReportMaterials(only(lookup(queries)));
  assert.match(material, /子宮天同與空刧/u);
  assert.doesNotMatch(material, /必無子女|原資料使用邊界/u);
});
