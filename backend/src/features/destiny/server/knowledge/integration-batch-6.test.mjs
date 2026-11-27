import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, isWesternTimeFact } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildChartFactsText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { compileWesternClaim } from './western-claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { claimChartContext } from './claims.mjs';
import { westernFactsForInput } from './testing/western-fixtures.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-6-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-6-witnesses.json', import.meta.url)));
const query = facts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts });

test('all newly supported alternatives need observable cusps and planet degrees; historical gender branches stay mandatory', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-six-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  const report = createReportLookup(directory);
  const matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  assert.equal(batch.changes.length, 32);
  assert.equal(batch.corrected.length, 35);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    for (const input of row.inputs) {
      const facts = westernFactsForInput(input);
      assert.ok(matches(id, facts), id);
      assert.ok(buildReportMaterials(report([query(facts)])).includes(row.claim.evidence.original_text), id);
      assert.equal(matches(id, input.required), false, id + ': derived flags alone are not proof');
      assert.equal(matches(id, facts.filter(fact => fact.kind !== 'western_profile_cusp_longitude')), false, id + ': old geometric fields alone');
      assert.equal(matches(id, facts.filter(fact => fact.kind !== 'western_profile_system')), false, id + ': missing profile');
      const gender = facts.find(fact => fact.kind === 'natal_gender');
      if (gender) {
        const without = facts.filter(fact => fact.kind !== 'natal_gender');
        const opposite = { ...gender, gender: gender.gender === '男' ? '女' : '男' };
        assert.equal(matches(id, without), false, id + ': unknown gender');
        assert.equal(matches(id, [...without, opposite]), false, id + ': other branch');
        assert.equal(matches(id, [...facts, opposite]), false, id + ': contradictory gender');
      }
    }
    assert.equal(matches(id, []), false, id + ': no default prediction');
  }
  assert.equal(catalog.get('astro-lilly-v3-travel-p001-001').remainingAlternatives, 0);
  const spouse = catalog.get('astro-lilly-v3-spouse-description-p051-001');
  assert.equal(spouse.remainingAlternatives, 1, 'common Saturn-term conjunction evidence does not resolve the original attachment scope');
  assert.ok(spouse.inputs.some(input => input.required.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 7).length === 2), 'the original Saturn/Mars seventh-house branch is preserved');
});

test('all 32 new and 35 corrected records reach actual report materials from physical charts with explicit convention labels', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-six-real-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const report = createReportLookup(directory);
  const seen = new Set();
  assert.deepEqual(witnesses.missing, []);
  for (const { date, latitude, longitude, gender, ids } of witnesses.witnesses) {
    const chart = calculateWestern(Date.parse(date), { latitude, longitude });
    const facts = [...chartFacts.western(chart), { kind: 'natal_gender', gender }];
    assert.ok(facts.length <= 256);
    const parsed = parseChartQueries([query(facts)]);
    assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]);
    const materials = buildReportMaterials(report(parsed));
    const text = buildChartFactsText(parsed);
    assert.match(text, /莉莉本命宫位与宫主判读/u);
    assert.match(text, /宫头前五度/u);
    assert.doesNotMatch(text, /[A-Za-z_{}\[\]]|undefined/u);
    for (const id of ids) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(id);
    }
    const unknown = parseChartQueries([query(facts)], { timeKnown: false });
    assert.ok(unknown[0].confirmedFacts.every(fact => !isWesternTimeFact(fact)));
    assert.ok(!lookupInterpretations(directory, unknown[0]).some(hit => ids.includes(hit.id)));
    const oldFacts = facts.filter(fact => !fact.kind.startsWith('western_lilly_') && fact.kind !== 'western_profile_cusp_longitude' && fact.kind !== 'planet_longitude');
    assert.ok(!lookupInterpretations(directory, query(oldFacts)).some(hit => ids.includes(hit.id)));
  }
  assert.deepEqual([...seen].sort(), [...batch.changes, ...batch.corrected].map(row => row.id).sort());
});

test('historical exclusions need independently calculated absence; geometric and user-asserted absence cannot substitute', () => {
  const atom = (fact, equals) => ({ fact, equals });
  const compiled = compileWesternClaim({ source: { book: 'Christian Astrology' }, conditions: { excluded: [], match: { status: 'ready',
    include: [[atom('chart.house_system', 'regiomontanus'), atom('chart.planets.sun.house', 11)]],
    exclude: [[atom('chart.planets.moon.house', 1)]] } } });
  const base = westernFactsForInput(compiled.inputs[0]);
  const matches = (facts, absent = []) => compiled.inputs.some(input => evaluateRule(input, 'natal', claimChartContext('western', chartContext('western', facts, absent))).matched);
  assert.equal(matches(base), false);
  assert.equal(matches([...base, { kind: 'planet_house', planet: 'Moon', house: 3 }]), false);
  assert.equal(matches([...base, { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: 'Moon', house: 3 }]), false);
  const forgedAbsent = [{ kind: 'western_lilly_planet_house', planet: 'Moon', house: 1 }];
  assert.equal(matches(base, forgedAbsent), false);
  assert.equal(matches([...base, { kind: 'planet_longitude', planet: 'Moon', longitude: 55 }]), true);
  assert.equal(matches([...base, { kind: 'planet_longitude', planet: 'Moon', longitude: 0 }], forgedAbsent), false);
  const forgedQuery = { ...query(base), confirmedFacts: [...base, { kind: 'western_lilly_planet_house', planet: 'Moon', house: 11 }], confirmedAbsentFacts: forgedAbsent };
  const parsed = parseChartQueries([forgedQuery]);
  assert.ok(!parsed[0].confirmedFacts.some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === 'Moon'));
  assert.deepEqual(parsed[0].confirmedAbsentFacts, []);
});
