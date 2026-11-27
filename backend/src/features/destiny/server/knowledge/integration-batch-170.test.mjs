import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyFamilySource, lillyFamilyProfile } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-family-roles-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-family-roles-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-170-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, q) => explainClaim(idOf(number), 'western', context(q), q.tradition, catalog);
const derive = (q, requested = []) => claimChartContext('western', context(q), requested, (sign, degree) => catalog.lillyDignityCells(sign, degree));
const sampleFor = n => fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(n)));
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const requestFacts = input => [...input.required, ...input.anyOf.flat()];
const proofFacts = detail => [detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat();
const withoutLongitude = (raw, planet) => raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);

test('the reviewed family conditions match native charts through SQLite, explanation and reports', () => {
  const expected = new Map();
  for (const n of [8, 11, 16, 18, 20, 21, 24, 25, 26, 27, 38, 39, 46]) {
    const id = idOf(n), row = catalog.get(id);
    assert.equal(row.compiler, lillyFamilyProfile);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyFamilySource(changed).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set(requestFacts(input).map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 38);
  assert.equal(fixture.witnesses.length, 13);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const q = parse(rawOf(sample)), references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = derive(q, inputs.flatMap(requestFacts));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
      const detail = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(detail.matched, true, key);
      assert.ok(hits.some(row => row.id === id), key);
      assert.match(detail.calculationNote, /莉莉卷三/u);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of input.required) assert.ok(materials.includes(factText(fact)), key);
      const source = input.required.find(fact => fact.kind === 'western_lilly_family_source');
      if (source) {
        const house = detail.matchedConditions.required.find(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === source.planet);
        assert.ok(house && materials.includes(factText(house)), key);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the confirmed sect chooses the two lights separately and a repeated mother role is counted once', () => {
  const raw = rawOf(fixture.overlap), q = parse(raw), chart = derive(q);
  const type = raw.find(fact => fact.kind === 'western_sect').sect;
  assert.ok(proofFacts(explain(11, q)).some(fact => fact.kind === 'western_lilly_family_role'
    && fact.parent === 'father' && fact.planet === (type === 'day' ? 'Sun' : 'Saturn') && fact.role === 'sect'));
  const light = type === 'day' ? 'Venus' : 'Moon';
  assert.ok(proofFacts(explain(21, q)).some(fact => fact.kind === 'western_lilly_family_role'
    && fact.parent === 'mother' && fact.planet === light && fact.role === 'sect'));
  assert.equal(chart.present.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 10).planet, light);
  const members = explain(46, q).matchedConditions.required.filter(fact => fact.kind === 'western_lilly_family_role');
  assert.equal(members.length, new Set(members.map(fact => fact.planet)).size);
  assert.equal(members.filter(fact => fact.planet === light).length, 1);

  const noSect = parse(raw.filter(fact => fact.kind !== 'western_sect'));
  for (const number of [8, 11, 21, 46]) assert.equal(explain(number, noSect).matched, false);
  assert.equal(explain(46, parse(withoutLongitude(raw, 'Mars'))).matched, false);
  assert.equal(explain(46, parse(raw, false)).matched, false);
});

test('sign boundaries, real node positions and verified source planets are required', () => {
  const solar = rawOf(sampleFor(18)).filter(fact => !['Sun', 'Moon'].includes(fact.planet)
    || !['planet_sign', 'planet_longitude'].includes(fact.kind));
  const boundary = [...solar, { kind: 'planet_longitude', planet: 'Sun', longitude: 29.9 },
    { kind: 'planet_longitude', planet: 'Moon', longitude: 30.1 }];
  const cross = parse([...boundary, { kind: 'western_lilly_family_configuration', selector: 'sun_moon_masculine' }]);
  const first = catalog.get(idOf(18)).inputs[0];
  assert.ok(derive(cross, requestFacts(first)).present.some(fact => fact.kind === 'western_lilly_aspect' && fact.aspect === 'conjunction'));
  assert.equal(explain(18, cross).matched, false);

  const south = rawOf(sampleFor(20));
  assert.equal(explain(20, parse(south)).matched, true);
  assert.equal(explain(20, parse(south.filter(fact => fact.kind !== 'western_true_node_longitude'))).matched, false);
  const sourceRaw = rawOf(sampleFor(24)), source = explain(24, parse(sourceRaw));
  const mark = proofFacts(source).find(fact => fact.kind === 'western_lilly_family_source');
  assert.ok(mark && mark.planet === 'Jupiter');
  assert.equal(explain(24, parse([...withoutLongitude(sourceRaw, 'Jupiter'), mark])).matched, false);
  assert.equal(explain(17, parse(south)).matched, false);
});
