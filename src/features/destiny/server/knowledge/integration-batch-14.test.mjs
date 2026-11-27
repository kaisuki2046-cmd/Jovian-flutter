import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { lillyDignityProfile } from './lilly-dignities.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-14-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-14-witnesses.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-fourteen-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-fourteen-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, catalog: catalogForDirectory(directory), report: createReportLookup(directory) };
}

test('every new reception or aggregate alternative reaches SQLite, explanation and report materials from computed birth charts', context => {
  const { directory, catalog, report } = setup(context);
  assert.equal(batch.changes.length, 5);
  assert.equal(batch.extended.length, 1);
  assert.equal(batch.actualNewUniqueAlternatives, 18);
  assert.equal(witnesses.targetAlternatives, 18);
  assert.deepEqual(witnesses.missing, []);
  const expected = new Set([...batch.changes, ...batch.extended].flatMap(row => row.addedInputDigests.map(digest => row.id + ':' + digest)));
  const selectors = [...catalog.factsByKind('western_lilly_aspect'), ...catalog.factsByKind('western_lilly_reception')];
  const witnessed = new Set();
  for (const witness of witnesses.witnesses) {
    const inputFacts = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
    const [parsed] = parseChartQueries([query(inputFacts)]);
    const hits = lookupInterpretations(directory, parsed);
    const material = buildReportMaterials(report([parsed]));
    const chart = claimChartContext('western', chartContext('western', parsed.confirmedFacts, [], 'natal'), selectors,
      (sign, degree) => catalog.lillyDignityCells(sign, degree));
    for (const proof of witness.proofs) {
      const hit = hits.find(hit => hit.id === proof.id);
      assert.ok(hit, proof.id);
      const rule = catalog.get(proof.id).inputs.find(input => hash(input) === proof.inputDigest);
      assert.ok(rule, 'witness digest refers to a current compiled alternative');
      assert.equal(evaluateRule(rule, 'natal', chart).matched, true, proof.id + ': exact new alternative');
      assert.ok(material.includes(hit.claim.evidence.original_text), proof.id);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', parsed.confirmedFacts, [], 'natal'), undefined, catalog).matched, true);
      witnessed.add(proof.id + ':' + proof.inputDigest);
    }
    const [unknown] = parseChartQueries([query(inputFacts)], { timeKnown: false });
    const unknownIds = new Set(lookupInterpretations(directory, unknown).map(hit => hit.id));
    const signSupports = (id, facts) => id === 'astro-lilly-v3-wit-p006-001'
      ? facts.some(f => f.kind === 'planet_sign' && f.planet === 'Mercury' && f.sign === '巨蟹座')
      : id === 'astro-lilly-v3-travel-p007-001' && facts.some(f => f.kind === 'planet_sign' && f.planet === 'Sun' && ['巨蟹座', '双子座', '处女座'].includes(f.sign));
    for (const id of witness.ids) assert.equal(unknownIds.has(id), signSupports(id, unknown.confirmedFacts), id + ': known domicile signs survive while timed conjunction and house facts do not');
    const missing = inputFacts.filter(fact => fact.kind !== 'planet_longitude');
    const missingIds = new Set(lookupInterpretations(directory, query(missing)).map(hit => hit.id));
    for (const id of witness.ids) assert.equal(missingIds.has(id), signSupports(id, missing), id + ': only a confirmed domicile sign can replace an unnecessary degree measurement');
  }
  assert.deepEqual([...witnessed].sort(), [...expected].sort());
  assert.equal(catalog.get('astro-lilly-v3-travel-p002-001').remainingAlternatives, 0, 'former partial record now covers its mutual-reception branch');
});

test('pending and structured mapping audits use the actual convention, profile and source OR expansion', context => {
  const { catalog } = setup(context);
  const pending = pendingClaimConditions({ catalog });
  for (const id of ['astro-lilly-v3-travel-p007-001', 'astro-lilly-v3-family-p009-001']) {
    const item = pending.find(row => row.id === id);
    assert.ok(item);
    assert.equal(catalog.get(id).remainingAlternatives, 1);
    assert.ok(item.recognized.length);
    assert.deepEqual([...new Set(item.unresolved)], [id.includes('travel')
      ? 'profiles.lilly.travel.sun_to_moon_or_mercury.reception = true'
      : 'profiles.lilly.family.house_4_and_ascendant_rulers.reception = true']);
  }
  for (const item of [...batch.changes, ...batch.extended].filter(row => row.remainingAlternatives === 0)) {
    assert.equal(pending.some(row => row.id === item.id), false, item.id + ': complete alternatives no longer falsely pending');
  }
  const allMappings = [...structuredClaimMappings(catalog)];
  const mine = allMappings.find(row => row.id === 'astro-lilly-v3-mines-p002-001');
  assert.equal(mine.sourceConditions.include[0][1].expandedGroups.length, 4);
  assert.ok(mine.sourceConditions.include[0][1].expandedGroups.flat().every(fact => fact.kind === 'western_lilly_reception'));
  assert.equal(mine.sourceConditions.include[0][1].fact, 'profiles.lilly.mines.house_4_ruler_mutually_received_by_light_or_its_dispositor');
  const original = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
  for (const item of [...batch.changes, ...batch.extended]) {
    assert.deepEqual(catalog.get(item.id).claim, original.find(row => row.id === item.id), item.id + ': source survives SQL unchanged');
  }
  const deferred = catalog.get('astro-lilly-v3-spouse-description-p051-001');
  assert.equal(deferred.remainingAlternatives, 1, 'the new common-positive term witness does not settle the original scope');
  assert.match(pending.find(row => row.id === deferred.claim.id).reviewNote, /修饰范围尚待核定/u);
});

test('forged reception flags cannot produce matches or eliminate a separately required application', context => {
  const { directory } = setup(context);
  const flag = { kind: 'western_lilly_reception', first: 'moon', second: 'mercury', reception: 'domicile', matches: true, profile: lillyDignityProfile };
  const mercury = 'astro-lilly-v3-wit-p006-001';
  const ids = facts => new Set(lookupInterpretations(directory, query(facts)).map(hit => hit.id));
  const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
  assert.equal(ids([flag]).has(mercury), false);
  assert.equal(ids([tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 125 }, flag]).has(mercury), false);
  assert.equal(ids([tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 95 }]).has(mercury), true);
  const aries = [tropical, { kind: 'planet_longitude', planet: 'Mercury', longitude: 5 }, { kind: 'planet_sign', planet: 'Mercury', sign: '白羊座' }];
  assert.equal(ids(aries).has('astro-lilly-v3-wit-p002-001'), false, 'Mars receives Aries Mercury, but the separately required application is still unsupported');
  const partial = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url))).find(row => row.id === 'astro-lilly-v3-wit-p002-001');
  assert.ok(partial.conditions.match.include[0].some(condition => condition.fact === 'profiles.lilly.applications.mercury.mars'));
});
