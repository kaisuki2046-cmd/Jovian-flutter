import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { generateReport } from '../report.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { compileBaziHistoricalCase } from './claim-compat.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const witnesses = [
  ['smth-v3-palaces-meng-p047-601', '1945-07-20T16:00:00', '女'],
  ['yhzp-v3-c041-p002-601', '1933-11-19T22:00:00', '男'],
  ['smth-v3-palaces-zhong-p040-601', '1901-01-13T00:00:00', '男'],
  ['smth-v3-palaces-zhong-p040-602', '1971-04-06T08:00:00', '男'],
  ['smth-v7-female-discourse-p040-601', '1994-11-25T22:00:00', '女'],
  ['smth-v3-palaces-meng-p049-602', '1978-11-27T10:00:00', '男'],
  ['smth-v3-palaces-meng-p069-601', '1959-11-11T18:00:00', '男'],
  ['smth-v3-crossing-p053-601', '1978-10-28T22:00:00', '男'],
  ['smth-v6-wealth-officer-p002-601', '2026-06-17T12:00:00', '男'],
  ['yhzp-v2-c230-p006-701', '1939-03-20T08:00:00', '男'],
  ['zpzq-v1-c034-p014-701', '1984-07-26T08:00:00', '男'],
  ['zpzq-v1-c034-p020-701', '1626-05-06T20:00:00', '男'],
  ['zpzq-v1-c036-p007-701', '1958-03-30T22:00:00', '男'],
  ['zpzq-v1-c038-p002-701', '1907-03-15T02:00:00', '男'],
  ['zpzq-v1-c038-p011-701', '2018-10-11T20:00:00', '男'],
  ['zpzq-v1-c038-p013-701', '2007-12-13T18:00:00', '男'],
  ['zpzq-v1-c042-p018-701', '1656-11-12T22:00:00', '男'],
  ['zpzq-v1-c042-p020-701', '1984-09-02T14:00:00', '男'],
  ['zpzq-v1-c046-p003-701', '1970-12-19T22:00:00', '男'],
  ['zpzq-v1-c048-p012-701', '1909-07-22T16:00:00', '男'],
];
const lookup = createReportLookup();
const catalog = catalogForDirectory();

function natalFacts(localTime, gender = '男') {
  const wallTime = Date.parse(localTime + 'Z');
  const chart = calculateBaZi(wallTime - 8 * 3_600_000, wallTime, gender === '女' ? 'female' : 'male');
  return [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }];
}

function query(facts, options, fields = {}) {
  const queries = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts: facts, ...fields,
  }], options);
  assert.ok(queries);
  return queries;
}

const cases = references => references.flatMap(topic => topic.caseReferences ?? []);
const findings = references => references.flatMap(topic => [...topic.personality, ...topic.events]);
const explain = (id, facts) => explainClaim(id, 'bazi', chartContext('bazi', facts), undefined, catalog);

test('attested Zhenquan variants match their own pillars and keep the original transcription for review', () => {
  for (const [id, original, position, corrected] of [
    ['zpzq-v1-c036-p007-701', '乙亥', 'hour', '己亥'],
    ['zpzq-v1-c048-p012-701', '癸未', 'month', '辛未'],
  ]) {
    const [, date, gender] = witnesses.find(([key]) => key === id);
    const facts = natalFacts(date, gender);
    const result = explain(id, facts);
    const report = lookup(query(facts));
    const citation = cases(report).find(entry => entry.id === id);
    assert.ok(result.matched);
    assert.ok(result.claim.evidence.original_text.includes(original));
    assert.match(citation.source.edition, /国家图书馆藏/u);
    assert.deepEqual(citation.source, result.comparisonSource);
    assert.match(result.comparisonNote, new RegExp(corrected, 'u'));
    assert.equal(citation.matchedConditions.required.find(f => f.position === position).ganZhi, corrected);
    assert.ok(buildReportMaterials(report).includes('按所引国家图书馆藏本的异文'));
    const wrongPillar = facts.map(f => f.kind === 'pillar' && f.position === position ? { ...f, ganZhi: original } : f);
    assert.equal(explain(id, wrongPillar).matched, false);
    assert.ok(!cases(lookup(query(facts, { timeKnown: false }))).some(entry => entry.id === id));
    const revisedClaim = structuredClone(result.claim);
    revisedClaim.evidence.context += '异文';
    assert.equal(compileBaziHistoricalCase(revisedClaim).reason, 'source_review_required');
  }
});

test('the exact case path verifies each indexed case against a native birth chart and keeps cases out of predictions', () => {
  const indexed = catalog.inventory().filter(row => row.method === 'bazi' && row.lookup.status === 'case_indexed');
  assert.deepEqual(new Set(indexed.map(row => row.claim.id)), new Set(witnesses.map(([id]) => id)));
  for (const [id, localTime, gender] of witnesses) {
    const facts = natalFacts(localTime, gender);
    const report = lookup(query(facts));
    const hit = cases(report).find(row => row.id === id);
    assert.ok(hit, id);
    assert.equal(hit.matchedConditions.required.filter(f => f.kind === 'pillar').length, 4, id);
    const detail = explain(id, facts);
    assert.equal(detail.matched, true, id);
    assert.equal(detail.matchScope, 'historical_case', id);
    assert.deepEqual(hit.matchedConditions, detail.matchedConditions, id);
    assert.equal(findings(report).some(row => row.id === id), false, id);
    const materials = buildReportMaterials(report);
    assert.ok(materials.includes('古籍四柱对照'), id);
    assert.ok(materials.includes('原文/依据：' + detail.claim.evidence.original_text), id);
    assert.ok(materials.includes('现代解读：' + detail.claim.interpretation.classical_meaning), id);
  }
});

test('incomplete and conflicting charts cannot reproduce a case, and source qualifiers are preserved', () => {
  const [id, localTime, gender] = witnesses[0];
  const facts = natalFacts(localTime, gender);
  const wrongGender = facts.map(f => f.kind === 'natal_gender' ? { ...f, gender: '男' } : f);
  const missingGender = facts.filter(f => f.kind !== 'natal_gender');
  const wrongYear = [...facts, { kind: 'pillar', position: 'year', ganZhi: '甲子' }];
  for (const supplied of [wrongGender, missingGender, wrongYear]) {
    assert.equal(explain(id, supplied).matched, false);
    assert.ok(!cases(lookup(query(supplied))).some(row => row.id === id));
  }
  assert.ok(!cases(lookup(query(facts, { timeKnown: false }))).some(row => row.id === id));
  assert.ok(!cases(lookup(query(facts, undefined, { chartScope: 'annual' }))).some(row => row.id === id));
  assert.ok(!cases(lookup(query(facts, undefined, { tradition: '子平真诠' }))).some(row => row.id === id));

  const source = structuredClone(explain(id, facts).claim);
  source.conditions.match.natalInputs[0].required = source.conditions.match.natalInputs[0].required
    .filter(f => f.kind !== 'pillar' || f.position !== 'hour');
  assert.equal(compileBaziHistoricalCase(source).reason, 'historical_case');

  const held = 'smth-v3-palaces-meng-p049-601';
  const withUnverifiedFetalMonth = natalFacts('1738-11-25T04:00:00')
    .filter(f => f.kind !== 'bazi_fetal_month').concat({ kind: 'bazi_fetal_month', ganZhi: '甲寅' });
  assert.equal(explain(held, withUnverifiedFetalMonth), null);
  assert.ok(!cases(lookup(query(withUnverifiedFetalMonth))).some(row => row.id === held));
});

test('report generation cites the original and modern explanation only as historical case evidence', async () => {
  const [id, localTime, gender] = witnesses[0];
  const facts = natalFacts(localTime, gender);
  const claim = explain(id, facts).claim;
  const generated = await generateReport({ chartQueries: query(facts), timeKnown: true }, {
    lookup, signal: new AbortController().signal, complete: async ({ materials, references }) => {
      assert.ok(materials.includes('古籍四柱对照'));
      assert.doesNotMatch(materials, /^(?:出处|复排出处)：/mu);
      assert.ok(materials.includes(`原文/依据：${claim.evidence.original_text}\n现代解读：${claim.interpretation.classical_meaning}`));
      const caseReferences = cases(references);
      const entry = caseReferences.find(row => row.id === id);
      assert.ok(entry);
      assert.deepEqual(entry.reportEvidence.source, claim.source);
      assert.ok(!JSON.stringify(entry).includes(claim.title));
      assert.ok(!findings(references).some(row => row.id === id));
      return '测试报告';
    },
  });
  assert.equal(generated.report, '测试报告');
});

test('the new Qiong Tong Bao Jian general rule quotes only the year-Zi clause', () => {
  const id = 'qtbj-v3-c034-p003-701';
  const facts = natalFacts('1852-06-14T12:00:00');
  const expected = '若年支见子，虽不科甲，亦有衣衿。';
  const hit = findings(lookup(query(facts))).find(row => row.id === id);
  assert.deepEqual(hit?.matchedBranches.map(branch => branch.text), [expected]);
  const reportText = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
  assert.ok(reportText.includes(expected));
  assert.ok(!reportText.includes('必主僧道'));
  const noYear = facts.filter(fact => fact.position !== 'year');
  assert.equal(explain(id, noYear).matched, false);
});
