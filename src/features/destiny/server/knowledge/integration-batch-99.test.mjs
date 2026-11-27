import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, calculateWestern, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziLiteralPassageDisposition } from './bazi-literal-passages.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-99-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-bazi-batch-99-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const offset = 8 * 3600000;
const dayNoble = 'yhzp-v5-c104-p005-001', interruption = 'yhzp-v1-c211-p002-001', lossDay = 'yhzp-v1-c217-p002-001';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofKey = ({ id, text, inputDigest }) => JSON.stringify([id, text, inputDigest]);

function native(birthTime) {
  const instant = Date.parse(birthTime);
  return calculateBaZi(instant, instant + offset);
}

function factsFor(sample) {
  const facts = chartFacts.bazi(native(sample.birthTime));
  if (sample.proofs.some(proof => proof.id === dayNoble)) {
    const sect = calculateWestern(Date.parse(sample.birthTime), { longitude: 116.4, latitude: 39.9 }).sect;
    assert.ok(sect);
    facts.push({ kind: 'natal_daylight', sect });
  }
  return facts;
}

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'bazi', context(queries(facts, timeKnown)), undefined, catalog);
const exampleFor = id => fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === id));

test('all reviewed source branches reach the live SQLite lookup, explanation and report', () => {
  const expected = new Map();
  for (const id of fixture.sourceIds) {
    const row = catalog.get(id);
    assert.equal(row.inputs, undefined);
    assert.equal(row.branches.length, 1);
    for (const { text, inputs } of row.branches) {
      assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(proofKey({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.equal(expected.size, 128);
  assert.equal(fixture.compiledGroups, expected.size);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const { year, month, day, hour } = native(sample.birthTime);
    assert.deepEqual({ year, month, day, hour }, sample.pillars);
    const parsed = queries(factsFor(sample)), base = context(parsed);
    const confirmed = claimChartContext('bazi', base);
    const references = lookup(parsed);
    const hits = references.flatMap(row => [...row.personality, ...row.events]);
    const materials = buildReportMaterials(references);
    for (const proof of sample.proofs) {
      const { id, text } = proof, key = proofKey(proof), rule = expected.get(key);
      assert.ok(rule && evaluateRule(rule, 'natal', confirmed).matched, id);
      const hit = hits.find(row => row.id === id);
      assert.ok(hit?.matchedBranches.some(branch => branch.text === text), id);
      assert.ok(explainClaim(id, 'bazi', base, undefined, catalog).matchedBranches.some(branch => branch.text === text), id);
      assert.ok(materials.includes(text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Yuanhai keeps the day/hour direction and the edition-specific Wu/Gui pair', () => {
  const sample = fixture.witnesses.find(row => row.pillars.day.startsWith('戊')
    && row.proofs.some(proof => proof.id === interruption));
  assert.ok(sample);
  assert.ok(explain(interruption, factsFor(sample)).matched);
  assert.equal(explain(interruption, factsFor(sample), false).matched, false);
  const haiHour = chartFacts.bazi(describeBaZiPillars({ ...sample.pillars, hour: '癸亥' }));
  assert.equal(explain(interruption, haiHour).matched, false);

  for (const ganZhi of ['乙丑', '己丑']) {
    assert.equal(explain(lossDay, [{ kind: 'pillar', position: 'day', ganZhi }]).matched, false);
  }
  const validDay = factsFor(exampleFor(lossDay));
  assert.ok(explain(lossDay, validDay, false).matched);
});

test('missing time, mismatched daylight and edited source material cannot satisfy the reviewed conditions', () => {
  const clear = factsFor(exampleFor(dayNoble));
  assert.ok(explain(dayNoble, clear).matched);
  assert.equal(explain(dayNoble, clear, false).matched, false);
  assert.equal(explain(dayNoble, clear.map(fact => fact.kind === 'natal_daylight'
    ? { ...fact, sect: fact.sect === 'day' ? 'night' : 'day' } : fact)).matched, false);
  for (const id of ['qtbj-v4-c057-p003-101', 'qtbj-v6-c117-p002-301']) {
    assert.equal(explain(id, factsFor(exampleFor(id)), false).matched, false);
  }
  const changed = structuredClone(catalog.get(interruption).claim);
  changed.conditions.original[4] = '戊癸戌亥';
  assert.equal(baziLiteralPassageDisposition(changed), false);
});

test('two remaining Zi branches cannot satisfy the flying Lu verse after a real clash', () => {
  const id = 'yhzp-v5-c165-p007-001';
  const sample = fixture.witnesses.find(row => Object.values(row.pillars).filter(value => value.endsWith('子')).length === 3
    && row.pillars.day === '庚子' && row.proofs.some(proof => proof.id === id));
  assert.ok(sample);
  assert.ok(explain(id, factsFor(sample)).matched);
  const changed = { ...sample.pillars, hour: '壬午' };
  assert.equal(Object.values(changed).filter(value => value.endsWith('子')).length, 2);
  assert.equal(explain(id, chartFacts.bazi(describeBaZiPillars(changed))).matched, false);
});
