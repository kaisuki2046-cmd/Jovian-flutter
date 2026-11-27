import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const doubleTiger = 'smth-v8-liuri-01-01-p003-701';
const eastern = 'muxuan-v1-f011-p00115-001';
const southern = 'muxuan-v1-f011-p00219-001';
const witnesses = [
  [doubleTiger, '1914-02-07T00:00:00Z', '男', [['壬申', 60, 69], ['癸酉', 70, 79]]],
  [doubleTiger, '1914-02-07T00:00:00Z', '女', [['辛酉', 41, 50], ['庚申', 51, 60]]],
  [eastern, '1950-01-12T12:00:00Z', '女', [['戊寅', 8, 17], ['己卯', 18, 27]]],
  [southern, '1951-03-24T06:00:00Z', '女', [['癸巳', 15, 24], ['甲午', 25, 34]]],
];

const catalog = catalogForDirectory();
const lookup = createReportLookup();
const explain = (id, facts, absent) => explainClaim(id, 'bazi', chartContext('bazi', facts, absent), undefined, catalog);
const findings = refs => refs.flatMap(({ personality, events }) => [...personality, ...events]);

function factsAt(localTime, gender) {
  const wall = Date.parse(localTime), genderValue = gender === '男' ? 'male' : 'female';
  return [...chartFacts.bazi(calculateBaZi(wall - 8 * 3_600_000, wall, genderValue)), { kind: 'natal_gender', gender }];
}

function query(facts, { timeKnown = true, chartScope = 'natal' } = {}) {
  const parsed = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: facts, chartScope,
  }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

test('three reviewed source passages reach SQLite and report materials with their exact native periods', () => {
  for (const [id, time, gender, expected] of witnesses) {
    const facts = factsAt(time, gender);
    const parsed = query(facts);
    const detail = explain(id, facts);
    const refs = lookup(parsed);
    const hit = findings(refs).find(item => item.id === id);
    assert.equal(detail.matched, true, id);
    assert.equal(detail.matchScope, 'passage_branch', id);
    assert.ok(hit, id);
    assert.deepEqual(hit.matchedBranches, detail.matchedBranches, id);
    const [branch] = detail.matchedBranches;
    assert.equal(branch.conditionCompiler, baziDecadalPassageProfile);
    assert.deepEqual(branch.matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge]), expected);
    const materials = buildReportMaterials(refs);
    assert.equal(materials.split(branch.text).length - 1, 1, id);
    for (const [pillar, startAge, endAge] of expected) {
      assert.ok(materials.includes(`${startAge}至${endAge}虚岁${pillar}运限`), id);
    }
    assert.doesNotMatch(branch.text, /後退財|怕土多|恐入西方/u);

    const edited = structuredClone(detail.claim);
    edited.evidence.original_text += '異本';
    assert.equal(compileBaZiDecadalPassage(edited).reason, 'source_review_required', id);
  }
});

test('a missing, contradictory or unconfirmed period cannot satisfy the double-Tiger passage', () => {
  const facts = factsAt(witnesses[0][1], '男');
  const target = fact => fact.kind === 'bazi_decadal_range' && ['壬申', '癸酉'].includes(fact.ganZhi);
  const noTarget = facts.filter(fact => !target(fact));
  const badRange = facts.map(fact => target(fact) && fact.ganZhi === '壬申'
    ? { ...fact, startAge: fact.startAge + 1, endAge: fact.endAge + 1 } : fact);
  const wrongPillar = facts.map(fact => target(fact) && fact.ganZhi === '壬申'
    ? { ...fact, ganZhi: '甲申' } : fact);
  const missingGender = facts.filter(fact => fact.kind !== 'natal_gender');
  for (const altered of [noTarget, badRange, wrongPillar, missingGender]) assert.equal(explain(doubleTiger, altered).matched, false);
  assert.ok(!findings(lookup(query(facts, { timeKnown: false }))).some(item => item.id === doubleTiger));
  assert.ok(!findings(lookup(query(facts, { chartScope: 'annual' }))).some(item => item.id === doubleTiger));

  const onePeriod = facts.filter(fact => !target(fact) || fact.ganZhi === '癸酉');
  assert.deepEqual(explain(doubleTiger, onePeriod).matchedBranches[0].matchedConditions.decadalPeriods
    .map(period => period.ganZhi), ['癸酉']);
});

test('the southern passage needs a forward sequence and calculated absence of every earth stem', () => {
  const time = witnesses[3][1];
  const backwards = factsAt(time, '男');
  assert.ok(backwards.some(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi[1] === '巳'));
  assert.equal(explain(southern, backwards).matched, false);

  const includedOfficer = factsAt('1951-03-14T06:00:00Z', '女');
  assert.ok(includedOfficer.some(fact => fact.kind === 'pillar' && fact.position === 'day' && fact.ganZhi === '癸丑'));
  assert.equal(explain(southern, includedOfficer, [{ kind: 'bazi_natal_element', element: '土' }]).matched, false);
});

const equalColumns = 'smth-v8-liuri-01-03-p004-701';
const officerJoined = 'smth-v5-officer-p004-601';
const officerLu = 'smth-v11-six-spirit-p035-601';
const dingKillingLuck = 'muxuan-v1-f011-p00120-001';
const furtherWitnesses = [
  [officerJoined, '1923-09-18T01:00:00Z', ['丙辰', 44, 53]],
  [officerJoined, '1923-08-10T01:00:00Z', ['乙卯', 41, 50]],
  [officerLu, '1923-09-18T09:00:00Z', ['甲寅', 64, 73]],
  [officerLu, '1923-08-10T05:00:00Z', ['乙卯', 42, 51]],
  [dingKillingLuck, '1920-06-28T09:00:00Z', ['癸未', 4, 13]],
  [officerLu, '1928-09-11T17:00:00Z', ['丙寅', 50, 59]],
  [officerLu, '1928-08-13T13:00:00Z', ['丁卯', 70, 79]],
  [officerLu, '1923-09-18T07:00:00Z', ['甲寅', 64, 73]],
  [officerLu, '1923-08-10T03:00:00Z', ['乙卯', 42, 51]],
];

test('officer unions, Lu branches and the Ding killing stem reach SQLite only in their native periods', () => {
  const verifiedWealth = new Set();
  for (const [id, time, period] of furtherWitnesses) {
    const facts = factsAt(time, '男');
    const detail = explain(id, facts);
    const hit = findings(lookup(query(facts))).find(item => item.id === id);
    assert.equal(detail.matched, true, id);
    assert.ok(hit, id);
    assert.equal(detail.matchedBranches.length, 1, id);
    assert.deepEqual(detail.matchedBranches, hit.matchedBranches, id);
    const [passage] = hit.matchedBranches;
    if (id === officerLu) {
      const day = passage.matchedConditions.required.find(fact => fact.kind === 'stem' && fact.position === 'day').stem;
      for (const [{ position, stem }] of passage.matchedConditions.alternatives) verifiedWealth.add(`${day}/${position}/${stem}`);
    }
    const ranges = passage.matchedConditions.decadalPeriods.map(({ ganZhi, startAge, endAge }) => [ganZhi, startAge, endAge]);
    assert.deepEqual(ranges, [period]);
    const [pillar, startAge, endAge] = period;
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(passage.text));
    assert.ok(materials.includes(`${startAge}至${endAge}虚岁${pillar}运限`));
    assert.doesNotMatch(materials, /罷職休官|反失俸祿|无水须防寿不全/u);
  }
  assert.deepEqual(verifiedWealth, new Set(['甲', '乙'].flatMap(day => [`${day}/year/戊`, `${day}/hour/戊`, `${day}/hour/己`])));
});

test('hidden stems do not satisfy the exposed luck-stem conditions, and Lu requires natal wealth', () => {
  const jia = factsAt(furtherWitnesses[0][1], '男');
  const ding = factsAt(furtherWitnesses[4][1], '男');
  assert.ok(jia.some(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi === '丁巳'));
  assert.ok(ding.some(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi === '戊子'));
  assert.equal(explain(officerJoined, jia.filter(fact => fact.kind !== 'bazi_decadal_range' || fact.ganZhi[0] !== '丙')).matched, false);
  assert.equal(explain(dingKillingLuck, ding.filter(fact => fact.kind !== 'bazi_decadal_range' || fact.ganZhi[0] !== '癸')).matched, false);

  assert.ok(jia.some(fact => fact.kind === 'bazi_decadal_range' && fact.ganZhi[1] === '寅'));
  assert.equal(explain(officerLu, jia).matched, false);
  const wealth = factsAt(furtherWitnesses[2][1], '男');
  const noLu = wealth.filter(fact => fact.kind !== 'bazi_decadal_range' || fact.ganZhi[1] !== '寅');
  assert.equal(explain(officerLu, noLu).matched, false);
});

test('the year-to-day and month-to-hour passage requires each complete native pillar', () => {
  const facts = factsAt('1924-02-15T04:00:00Z', '男');
  const refs = lookup(query(facts));
  const hit = findings(refs).find(item => item.id === equalColumns);
  const detail = explain(equalColumns, facts);
  assert.equal(detail.matched, true);
  assert.deepEqual(hit?.matchedBranches.map(branch => branch.text), ['若年月與日時同大貴']);
  const proof = detail.matchedBranches[0].matchedConditions;
  assert.equal(proof.required.length, 4);
  assert.equal(proof.decadalPeriods, undefined);

  const missingYearPillar = facts.filter(fact => fact.kind !== 'pillar' || fact.position !== 'year');
  const conflictingMonth = [...facts, { kind: 'pillar', position: 'month', ganZhi: '丁卯' }];
  assert.equal(explain(equalColumns, missingYearPillar).matched, false);
  assert.equal(explain(equalColumns, conflictingMonth).matched, false);
  assert.ok(!findings(lookup(query(facts, { timeKnown: false }))).some(item => item.id === equalColumns));
});
