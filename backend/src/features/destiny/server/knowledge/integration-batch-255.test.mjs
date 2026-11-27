import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Lunar } from 'lunar-javascript';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileGuanceluHistoricalCase, guanceluCaseProfile } from './ziwei-guancelu-cases.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-guancelu-historical-'));
const catalog = catalogForDirectory(directory);
const report = createReportLookup(directory);
const idOf = passage => 'ziwei-v1-guancelu-001-p' + passage + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Lunar dates in the same stem/branch year. These test dates make no claim
// about the Gregorian birth year of the person in the source.
const witnesses = [
  [[1934, 1, 23, 3, "male"], ["003", "120"]],
  [[1960, 3, 14, 0, "male"], ["026", "123"]],
  [[1944, 5, 13, 7, "male"], ["034"]],
  [[1947, 2, 4, 7, "male"], ["066", "172"]],
  [[1955, 5, 13, 8, "male"], ["078"]],
  [[1971, 12, 10, 5, "female"], ["084", "189"]],
  [[1979, 3, 1, 10, "male"], ["092", "190"]],
  [[1942, 2, 2, 11, "male"], ["094"]],
  [[1979, 11, 15, 9, "male"], ["114", "196"]],
  [[1954, 2, 27, 10, "male"], ["133", "134"]],
  [[1942, 5, 24, 7, "male"], ["138"]],
  [[1949, 11, 8, 10, "male"], ["150"]],
  [[1977, 9, 22, 1, "female"], ["158"]],
  [[1952, 8, 20, 9, "male"], ["164", "165"]],
  [[1979, 12, 5, 2, "male"], ["191", "192", "193", "194"]],
];

function native([year, month, day, hour, gender]) {
  const solar = Lunar.fromYmd(year, month, day).getSolar();
  const date = { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
  return chartFacts.ziwei(calculateZiwei({ date, gender }, hour));
}

const sample = passage => native(witnesses.find(([, ids]) => ids.includes(passage))[0]);

function query(confirmedFacts, { timeKnown = true, tradition } = {}) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, ...(tradition && { tradition }),
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, tradition, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const cases = references => references.flatMap(topic => topic.caseReferences ?? []);
const personallyMatched = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const details = (passage, facts, options) => {
  const { context, tradition } = query(facts, options);
  return explainClaim(idOf(passage), 'ziwei', context, tradition, catalog);
};

test('documented Guancelu births match through the historical SQLite index and the case report section', () => {
  const expected = witnesses.flatMap(([, ids]) => ids.map(idOf)).sort();
  assert.equal(expected.length, 26);
  const indexed = catalog.inventory().filter(({ lookup }) => lookup.status === 'case_indexed')
    .map(({ claim }) => claim.id).filter(id => id.startsWith('ziwei-v1-guancelu-')).sort();
  assert.deepEqual(indexed, expected);
  for (const [birth, passages] of witnesses) {
    const facts = native(birth);
    const references = report(query(facts).queries);
    const byId = new Map(cases(references).map(reference => [reference.id, reference]));
    const material = buildReportMaterials(references);
    assert.deepEqual([...byId.keys()].sort(), passages.map(idOf).sort());
    assert.ok(!personallyMatched(references).some(hit => expected.includes(hit.id)));
    assert.match(material, /古籍紫微命例对照/u);
    assert.match(material, new RegExp('农历' + birth[2] + '日', 'u'));
    for (const passage of passages) {
      const id = idOf(passage);
      const row = catalog.get(id), detail = details(passage, facts);
      assert.equal(row.compiler, guanceluCaseProfile, id);
      assert.equal(detail.matchScope, 'historical_case', id);
      assert.ok(detail.matched, id);
      assert.deepEqual(detail.matchedConditions, byId.get(id).matchedConditions, id);
      assert.ok(!byId.get(id).claim, id);
      assert.equal(byId.get(id).reportEvidence.source.section, row.claim.source.section, id);
      assert.doesNotMatch(material, /^出处：/mu, id);
      assert.ok(material.includes('原文/依据：' + row.claim.evidence.original_text), id);
      assert.ok(material.includes('现代解读：' + row.claim.interpretation.classical_meaning), id);
      const revised = structuredClone(row.claim);
      revised.evidence.original_text += '（待校）';
      assert.equal(compileGuanceluHistoricalCase(revised).reason, 'source_review_required', id);
    }
  }
});

test('historical matches require the day, hour, gender and corroborating natal layout', () => {
  const original = sample('034');
  const incorrect = [
    original.filter(fact => fact.kind !== 'ziwei_daozang_input'),
    original.map(fact => fact.kind === 'ziwei_daozang_input' ? { ...fact, day: fact.day + 1 } : fact),
    original.map(fact => fact.kind === 'ziwei_daozang_input' ? { ...fact, hour: 9 } : fact),
    original.map(fact => fact.kind === 'natal_lunar_month' ? { ...fact, leap: true } : fact),
    original.concat({ kind: 'natal_year_stem', stem: '丙' }),
    original.filter(fact => fact.kind !== 'palace_branch' || fact.palace !== '兄弟'),
    original.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '命宫' || fact.star !== '七杀'),
  ];
  for (const facts of incorrect) {
    assert.equal(details('034', facts).matched, false);
    assert.equal(cases(report(query(facts).queries)).length, 0);
  }
  for (const options of [{ timeKnown: false }, { tradition: '紫微斗数全书' }]) {
    assert.equal(details('034', original, options).matched, false);
    assert.equal(cases(report(query(original, options).queries)).length, 0);
  }
  assert.equal(details('034', native([1944, 5, 13, 7, 'female'])).matched, true);
  const wrongSex = native([1977, 9, 22, 1, 'male']);
  assert.equal(details('158', wrongSex).matched, false);
  assert.equal(cases(report(query(wrongSex).queries)).length, 0);
});

test('case paragraphs keep their own source evidence even when they describe the same birth', () => {
  const tongLiang = sample('066').filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '疾厄' || fact.star !== '天府');
  assert.deepEqual(cases(report(query(tongLiang).queries)).map(row => row.id), [idOf('066')]);
  const cotton = sample('092').filter(fact => fact.kind !== 'palace_star'
    || fact.palace !== '兄弟' || fact.star !== '陀罗');
  assert.deepEqual(cases(report(query(cotton).queries)).map(row => row.id), [idOf('190')]);
  for (const id of ['031', '098', '100', '109', '112', '186', '187']) {
    assert.equal(catalog.get(idOf(id)).inputs, undefined, id);
  }
});
