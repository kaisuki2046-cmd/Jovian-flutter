import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { lillyProfessionFacts, lillyProfessionProfile } from './lilly-profession.mjs';
import { compileLillyDignityCells } from './lilly-dignities.mjs';
import { westernClaimCondition } from './western-claims.mjs';
import { normalizeFacts } from './catalog.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compileLillyDignityCells(sources);
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-20-20261118.json', import.meta.url)));
const ids = new Set(batch.changes.map(row => row.id));
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
function facts(asc, positions, sect = 'day') {
  return [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (asc + 30 * i) % 360 })),
    ...Object.entries(positions).map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude })),
    ...(sect ? [{ kind: 'western_sect', sect }] : [])];
}
const states = input => Object.fromEntries(lillyProfessionFacts(input, at).map(fact => [fact.planet + ':' + fact.role, fact.matches]));
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('p.625 first instruction retains co-significators and proves a sole ruler separately', () => {
  const mercury = states(facts(60, { Mercury: 61, Venus: 30, Mars: 120, Sun: 90 }));
  assert.equal(mercury['Mercury:member'], true); assert.equal(mercury['Mercury:sole'], true);
  const pair = states(facts(60, { Mercury: 61, Venus: 57, Mars: 120, Sun: 90 }));
  assert.equal(pair['Mercury:member'], true); assert.equal(pair['Venus:member'], true);
  assert.equal(pair['Mars:member'], false);
  for (const planet of ['Mercury', 'Venus', 'Mars']) assert.equal(pair[planet + ':sole'], false);
  const incomplete = states(facts(60, { Mercury: 61, Sun: 90 }));
  assert.equal(incomplete['Mercury:member'], true);
  assert.equal(incomplete['Mercury:sole'], undefined, 'missing candidates cannot establish uniqueness');
  assert.equal(incomplete['Venus:member'], undefined);
  assert.equal(incomplete['Venus:sole'], false, 'a confirmed other member precludes sole rulership');
});

test('second instruction requires all first-stage candidates false, and does not import their solar restriction', () => {
  const input = facts(90, { Mercury: 110, Venus: 140, Mars: 275, Sun: 275 });
  assert.equal(states(input)['Mars:sole'], true, 'dignified non-fallen MC lord qualifies at step two even near Sun');
  assert.deepEqual(states(input.filter(fact => fact.planet !== 'Mercury')), {}, 'an unknown first-stage candidate prevents fallback');
  assert.deepEqual(states(facts(90, { Mercury: 140, Venus: 160, Mars: 100, Sun: 100 })), {}, 'fall disqualifies the second-stage lord despite a triplicity dignity');
  assert.deepEqual(states(facts(0, { Mercury: 100, Venus: 140, Mars: 130, Sun: 100 })), {}, 'a Saturn MC lord leaves later instructions pending');
});

test('solar clearance uses full seventeen degrees with wraparound and retains the historical five-degree cusp rule', () => {
  const venus = sun => states(facts(30, { Venus: 30, Sun: sun }))['Venus:member'];
  assert.equal(venus(47), true); assert.equal(venus(46.999999), undefined);
  assert.equal(venus(30.1), undefined, 'no invented cazimi override of the clearance instruction');
  assert.equal(states(facts(350, { Venus: 358, Sun: 15 }))['Venus:member'], true);
  assert.equal(states(facts(350, { Venus: 358, Sun: 14.999999 }))['Venus:member'], undefined);
  assert.equal(states(facts(0, { Venus: 355, Sun: 320 }))['Venus:member'], true, 'five degrees before cusp is included');
  assert.equal(states(facts(0, { Venus: 354.999999, Sun: 320 }))['Venus:member'], undefined);
});

test('unknown sect compares complete selection paths; conflicting or invalid inputs cannot manufacture proof', () => {
  const input = facts(170, { Venus: 170, Mercury: 200, Mars: 230, Sun: 195 }, null);
  assert.equal(states([...input, { kind: 'western_sect', sect: 'day' }])['Venus:sole'], true);
  assert.equal(states([...input, { kind: 'western_sect', sect: 'night' }])['Mercury:sole'], true);
  const unknown = states(input);
  assert.equal(unknown['Venus:member'], undefined); assert.equal(unknown['Mercury:member'], undefined);
  assert.equal(unknown['Mars:member'], false);
  assert.deepEqual(states([...input, { kind: 'western_sect', sect: 'day' }, { kind: 'western_sect', sect: 'night' }]), {});
  const good = facts(60, { Mercury: 61, Sun: 90 });
  assert.equal(states([...good, { kind: 'planet_longitude', planet: 'Mercury', longitude: 62 }])['Mercury:member'], undefined);
  assert.equal(states([...good, { kind: 'planet_sign', planet: 'Mercury', sign: '白羊座' }])['Mercury:member'], undefined);
  assert.deepEqual(states(good.filter(fact => fact.kind !== 'western_profile_cusp_longitude')), {});
  assert.deepEqual(states([...good, { kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: 1, longitude: 61 }]), {});
  assert.deepEqual(lillyProfessionFacts(good, undefined), []);
});

test('profession facts have a strict historical contract, Chinese wording and source-specific compilation', () => {
  const fact = { kind: 'western_lilly_profession_ruler', planet: 'Mercury', role: 'member', matches: true, profile: lillyProfessionProfile };
  assert.deepEqual(normalizeFacts('western', [fact]), [fact]);
  for (const invalid of [{ planet: 'Jupiter' }, { role: 'best' }, { matches: 1 }, { profile: 'modern' }]) {
    assert.throws(() => normalizeFacts('western', [{ ...fact, ...invalid }]), /Invalid/u);
  }
  assert.match(factText(fact), /水星.*职业指征之一/u); assert.ok(!factText(fact).includes(lillyProfessionProfile));
  assert.deepEqual(westernClaimCondition({ fact: 'profiles.lilly.profession_rulers.mercury', equals: true }, 'whole_sign', 'lilly'), fact);
  assert.equal(westernClaimCondition({ fact: 'profiles.lilly.profession_rulers.mercury', equals: true }, 'whole_sign', 'geometric'), null);
  const schema = JSON.parse(readFileSync(new URL('./schema/fact.schema.json', import.meta.url))).oneOf.find(row => row.properties.kind.const === fact.kind);
  assert.equal(schema.properties.profile.const, lillyProfessionProfile);
  assert.deepEqual(schema.properties.planet.enum, ['Mercury', 'Venus', 'Mars']);
});

test('all thirty new alternatives reach SQLite, explanations and report material from native birth charts', context => {
  const directory = temporary(context); const catalog = catalogForDirectory(directory); const report = createReportLookup(directory);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-20-witnesses.json', import.meta.url)));
  assert.equal(batch.changes.length, 11); assert.equal(batch.actualNewUniqueAlternatives, 30);
  assert.deepEqual(witnesses.missing, []); assert.equal(witnesses.targetAlternatives, 30);
  const expected = new Set(batch.changes.flatMap(row => row.addedInputDigests.map(digest => row.id + ':' + digest)));
  const seen = new Set(); catalog.ensure();
  const db = new DatabaseSync(catalog.file);
  const selectors = catalog.factsByKind('western_lilly_aspect', db);
  try { for (const witness of witnesses.witnesses) {
    const input = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
    const [parsed] = parseChartQueries([query(input)]); assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed); const references = report([parsed]);
    const materials = buildReportMaterials(references);
    const chart = claimChartContext('western', chartContext('western', parsed.confirmedFacts, [], 'natal'), selectors,
      (sign, degree) => catalog.lillyDignityCells(sign, degree, db));
    for (const proof of witness.proofs) {
      const hit = hits.find(row => row.id === proof.id); assert.ok(hit, proof.id);
      const rule = catalog.get(proof.id).inputs.find(input => hash(input) === proof.inputDigest); assert.ok(rule);
      assert.equal(evaluateRule(rule, 'natal', chart).matched, true);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', parsed.confirmedFacts, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(references.some(row => [...row.personality, ...row.events].some(hit => hit.id === proof.id)));
      assert.match(hit.calculationNote, /前两步/u); assert.ok(materials.includes(hit.claim.evidence.original_text));
      const original = sources.find(row => row.id === proof.id);
      assert.deepEqual(hit.claim.evidence, original.evidence); assert.deepEqual(hit.claim.interpretation.limitations, original.interpretation.limitations);
      seen.add(proof.id + ':' + proof.inputDigest);
    }
    const [unknown] = parseChartQueries([query(input)], { timeKnown: false });
    assert.ok(lookupInterpretations(directory, unknown).every(hit => !ids.has(hit.id)), 'unknown birth time cannot retain the timed profession proof');
  } } finally { db.close(); }
  assert.deepEqual([...seen].sort(), [...expected].sort());
  assert.equal(batch.previousQueryableEntriesUnchanged, 2739);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  const pending = pendingClaimConditions({ catalog });
  for (const id of ids) assert.ok(!pending.some(row => row.id === id));
  assert.ok(pending.some(row => row.id === 'astro-lilly-v3-profession-p003-001' && row.status === 'indexed'),
    'source review retains additional strength configurations after the verified branch is indexed');
});

test('runtime queries reject forged flags and read their rule/dignity dependencies from SQLite without JSON scanning', context => {
  const directory = temporary(context); const catalog = catalogForDirectory(directory); catalog.ensure();
  const forged = { kind: 'western_lilly_profession_ruler', planet: 'Venus', role: 'sole', matches: true, profile: lillyProfessionProfile };
  assert.ok(lookupInterpretations(directory, query([forged])).every(hit => !ids.has(hit.id)));
  const witness = JSON.parse(readFileSync(new URL('./claims/integration-batch-20-witnesses.json', import.meta.url))).witnesses[0];
  const input = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
  const stripped = input.filter(fact => fact.kind !== 'western_profile_cusp_longitude');
  assert.ok(lookupInterpretations(directory, { ...query([...stripped, forged]), confirmedAbsentFacts: [{ ...forged, matches: false }] }).every(hit => !ids.has(hit.id)));
  const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try {
    const fresh = createClaimsCatalog({ directory });
    const hits = lookupInterpretations(directory, query(input), fresh);
    for (const proof of witness.proofs) assert.ok(hits.some(hit => hit.id === proof.id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('report generation receives the historical selection limit through Chinese materials without a real model call', async context => {
  const directory = temporary(context);
  const witness = JSON.parse(readFileSync(new URL('./claims/integration-batch-20-witnesses.json', import.meta.url))).witnesses.find(row => row.proofs.some(proof => proof.id === 'astro-lilly-v3-profession-p002-001'));
  assert.ok(witness);
  const input = chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
  const queries = parseChartQueries([query(input)]); let calls = 0;
  const result = await generateReport({ chartQueries: queries }, { lookup: createReportLookup(directory), signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /职业指征.*前两步/u);
      assert.match(request.materials, /第三、第四步另列月亮见证/u);
      assert.match(request.materials, /唯一状态限于初始选星/u); assert.match(request.materials, /强相位移交和性质混合仍需另判/u);
      assert.ok(!request.materials.includes(lillyProfessionProfile)); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
