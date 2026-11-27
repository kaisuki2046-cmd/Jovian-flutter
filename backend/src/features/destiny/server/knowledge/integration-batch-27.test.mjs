import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { lillyDignityProfile } from './lilly-dignities.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-27-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-27-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)), { kind: 'natal_gender', gender: witness.gender }];
const coordinates = entries => [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...entries.flatMap(([planet, longitude]) => [
  { kind: 'planet_longitude', planet, longitude }, { kind: 'planet_sign', planet, sign: zodiacNames[Math.floor(longitude / 30)] },
])];
const cusps = (start = 0) => [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (start + i * 30) % 360 }))];
const gender = { kind: 'natal_gender', gender: '男' }, day = { kind: 'western_sect', sect: 'day' };
const base = [['Sun', 255], ['Moon', 155], ['Mercury', 165], ['Venus', 31], ['Mars', 32], ['Jupiter', 75], ['Saturn', 92]];
const replace = (entries, planet, longitude) => entries.map(row => row[0] === planet ? [planet, longitude] : row);
const ids = { count: 'astro-lilly-v3-general-fortune-p001-001', saturn: 'astro-lilly-v3-religion-dreams-p002-001',
  venus: 'astro-lilly-v3-spouse-description-p017-001', terms: 'astro-lilly-v3-spouse-description-p051-001', travel: 'astro-lilly-v3-travel-p008-001' };
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-seven-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-seven-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all nine added dignity alternatives reach actual SQL, explanations and report material from native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 4); assert.equal(batch.extended.length, 1); assert.equal(batch.newAlternativeCount, 9);
  assert.equal(native.targetAlternatives, 9); assert.deepEqual(native.missing, []);
  const expected = [...batch.changes, ...batch.extended].flatMap(row => row.addedInputDigests.map(hash => row.id + ':' + hash)), seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const required = witness.proofs.flatMap(proof => catalog.get(proof.id).inputs.flatMap(input => input.required));
    const chart = claimChartContext('western', chartContext('western', parsed[0].confirmedFacts, [], 'natal'), required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const hits = lookupInterpretations(directory, parsed[0]), material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = row.inputs.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      for (const fact of input.required) assert.equal(evaluateRule(input, 'natal', chartContext('western', chart.present.filter(other => JSON.stringify(other) !== JSON.stringify(fact)), [], 'natal')).matched, false);
      assert.ok(hits.some(hit => hit.id === proof.id), proof.id);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id); assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      if (proof.id === ids.terms) assert.match(material, /修饰范围尚待核定/u, 'the unresolved attachment is visible in actual report material');
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('SQL requires exactly three or four bodies, accepts whole-sect consensus and rejects five or incomplete measurements', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === ids.count);
  const unknownSect = [...coordinates(base), ...cusps()]; assert.equal(matches(unknownSect), true);
  assert.equal(matches([...coordinates(replace(base, 'Moon', 95)), ...cusps(), day]), true);
  assert.equal(matches([...coordinates(replace(replace(base, 'Moon', 95), 'Jupiter', 245)), ...cusps(), day]), false);
  assert.equal(matches([...coordinates(replace(base, 'Moon', 65)), ...cusps()]), false, 'day count 3 and night count 2 cannot be combined');
  for (const body of base.map(row => row[0])) assert.equal(matches(unknownSect.filter(f => f.planet !== body)), false);
  assert.equal(matches(unknownSect.filter(f => f.kind !== 'western_profile_cusp_longitude')), false, 'the source house-profile prerequisite still holds');
  const fake = { kind: 'western_lilly_dignified_count', count: 3, profile: lillyDignityProfile };
  assert.equal(matches([fake, ...cusps(), { kind: 'western_zodiac', zodiac: 'tropical' }]), false);
});

test('any one own dignity suffices, while Venus orientation, benefic aspect and the historical gender remain independent prerequisites', context => {
  const directory = temporary(context), matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  assert.equal(matches(ids.saturn, [...coordinates([['Saturn', 27]]), ...cusps(150)]), true, 'Aries Saturn has own term even though it is also fallen');
  assert.equal(matches(ids.saturn, [...coordinates([['Saturn', 25]]), ...cusps(150)]), false);
  assert.equal(matches(ids.saturn, [...coordinates([['Saturn', 27]]), ...cusps()]), false, 'its own dignity cannot replace ninth-house placement');
  const venus = [...coordinates([['Venus', 31], ['Sun', 40], ['Jupiter', 91]]), gender]; assert.equal(matches(ids.venus, venus), true);
  assert.equal(matches(ids.venus, [...coordinates([['Venus', 31], ['Sun', 20], ['Jupiter', 91]]), gender]), false, 'dignity does not replace orientality');
  assert.equal(matches(ids.venus, [...coordinates([['Venus', 5], ['Sun', 14], ['Jupiter', 65]]), gender]), false, 'orientation does not replace own dignity');
  assert.equal(matches(ids.venus, venus.filter(f => f.planet !== 'Jupiter')), false);
  assert.equal(matches(ids.venus, venus.filter(f => f.kind !== 'natal_gender')), false);
});

test('the common-positive Saturn-term branch binds both bodies and conjunction while keeping scope review and older alternatives', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), row = catalog.get(ids.terms), extension = batch.extended[0];
  const added = new Set(extension.addedInputDigests), inputs = row.inputs.filter(input => added.has(digest(input)));
  const matches = entries => {
    const chart = claimChartContext('western', chartContext('western', [...coordinates(entries), ...cusps(), gender], [], 'natal'), row.inputs.flatMap(i => i.required), (sign, degree) => catalog.lillyDignityCells(sign, degree));
    return inputs.some(input => evaluateRule(input, 'natal', chart).matched);
  };
  assert.equal(inputs.length, 2); assert.equal(matches([['Saturn', 27], ['Venus', 27]]), true);
  assert.equal(matches([['Saturn', 25], ['Venus', 27]]), false, 'Venus being in Saturn terms does not supply Saturn own-term placement');
  assert.equal(matches([['Saturn', 27], ['Venus', 25]]), false);
  assert.equal(matches([['Saturn', 27], ['Venus', 297]]), false, 'two Saturn bounds far apart do not make a conjunction');
  assert.equal(row.inputs.filter(input => !added.has(digest(input))).length, 3); assert.equal(row.remainingAlternatives, 1);
  assert.match(pendingClaimConditions({ catalog }).find(item => item.id === ids.terms).reviewNote, /修饰范围尚待核定/u);
});

test('known domicile signs survive unknown birth time without invented degrees; other new source prerequisites do not', context => {
  const directory = temporary(context);
  for (const witness of native.witnesses) {
    const [unknown] = parseChartQueries([query(rawFacts(witness))], { timeKnown: false });
    const hits = lookupInterpretations(directory, unknown);
    for (const proof of witness.proofs) assert.equal(hits.some(hit => hit.id === proof.id), proof.id === ids.travel);
  }
  const facts = [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet: 'Moon', sign: '双子座' }];
  assert.ok(lookupInterpretations(directory, query(facts)).some(hit => hit.id === ids.travel));
  assert.ok(!facts.some(f => f.kind === 'planet_longitude'));
  const fake = { kind: 'western_lilly_dignified_count', count: 3, profile: lillyDignityProfile };
  const [parsed] = parseChartQueries([{ ...query([...facts, fake]), confirmedAbsentFacts: [{ ...fake, count: 4 }] }]);
  assert.ok(!parsed.confirmedFacts.some(f => f.kind === fake.kind)); assert.ok(!parsed.confirmedAbsentFacts.some(f => f.kind === fake.kind));
});

test('mapping audits retain source hashes, complete the four new records and preserve the unresolved original attachment scope', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const row of batch.changes) { assert.equal(mappings.get(row.id).status, 'indexed'); assert.equal(mappings.get(row.id).remainingAlternatives, 0); }
  assert.equal(mappings.get(ids.terms).remainingAlternatives, 1); assert.match(mappings.get(ids.terms).reviewNote, /单星在界不据此否定/u);
  assert.equal(catalog.get('astro-lilly-v3-wit-p033-001').remainingAlternatives, 1);
  for (const id of ['astro-lilly-v3-wealth-means-p002-001', 'astro-lilly-v3-parents-p004-001']) assert.equal(catalog.get(id), null);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2800); assert.equal(batch.previousQueryableInputsPreserved, 2801);
});

test('fresh SQLite computes whole counts and domicile ownership with source JSON access blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory });
    assert.ok(lookupInterpretations(directory, query([...coordinates(base), ...cusps()]), fresh).some(hit => hit.id === ids.count));
    assert.ok(lookupInterpretations(directory, query([{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet: 'Mercury', sign: '巨蟹座' }]), fresh).some(hit => hit.id === ids.travel));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('the actual report lookup sends Chinese unique-body count and whole-sect explanation to a model double', async context => {
  const actual = createReportLookup(temporary(context)); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === ids.count), events: row.events.filter(hit => hit.id === ids.count) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query([...coordinates(base), ...cusps()])]) }, {
    lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /恰有3颗/u); assert.match(request.materials, /同星只计一次/u); assert.match(request.materials, /分别计算整盘数量/u);
      assert.ok(!request.materials.includes('western_lilly_dignified_count')); assert.ok(!request.materials.includes(lillyDignityProfile)); return '模型替身报告'; },
  }); assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
