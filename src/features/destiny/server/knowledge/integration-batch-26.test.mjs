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

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-26-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-26-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)), { kind: 'natal_gender', gender: witness.gender }];
const positions = entries => [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...entries.flatMap(([planet, longitude]) => [
  { kind: 'planet_longitude', planet, longitude }, { kind: 'planet_sign', planet, sign: zodiacNames[Math.floor(longitude / 30)] },
])];
const cusps = [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: i * 30 }))];
const fake = (first, second, matches = true) => ({ kind: 'western_lilly_aspect', table: 'main', first, second, aspect: 'any', matches });
const noFortune = 'astro-lilly-v3-wit-p047-001', relatives = 'astro-lilly-v3-relatives-p004-001';
const watery = positions([['Mercury', 220], ['Venus', 240], ['Jupiter', 250]]);
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-six-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-six-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all 28 new unspecified-aspect alternatives reach SQL, explanations and report material from native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 8); assert.equal(batch.extended.length, 2); assert.equal(batch.newAlternativeCount, 28);
  assert.equal(native.targetAlternatives, 28); assert.deepEqual(native.missing, []);
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
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id);
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id)); seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('the water-sign Mercury source requires both benefic absences with known positions, not one missing aspect or conjunction', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === noFortune);
  assert.equal(matches(watery), true);
  for (const body of ['Venus', 'Jupiter']) {
    assert.equal(matches(watery.filter(f => f.planet !== body)), false);
    assert.equal(matches([...watery.filter(f => f.planet !== body), ...positions([[body, 220]]).filter(f => f.planet)]), false, 'conjunction ambiguity does not prove no aspect');
    assert.equal(matches([...watery.filter(f => f.planet !== body), ...positions([[body, 280]]).filter(f => f.planet)]), false, 'a sextile of either benefic blocks the whole absence group');
  }
  assert.equal(matches([...watery.filter(f => f.planet !== 'Mercury'), ...positions([['Mercury', 200]]).filter(f => f.planet)]), false, 'the actual water sign remains necessary');
  assert.equal(matches([...watery, { kind: 'planet_sign', planet: 'Venus', sign: '白羊座' }]), false);
});

test('a first/third ruler absence needs both actual rulers and a verified full house profile', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === relatives);
  const raw = [...positions([['Mars', 0], ['Mercury', 30]]), ...cusps]; assert.equal(matches(raw), true);
  assert.equal(matches(raw.filter(f => f.planet !== 'Mercury')), false);
  assert.equal(matches(raw.filter(f => f.house !== 12)), false);
  assert.equal(matches([...raw.filter(f => f.planet !== 'Mercury'), ...positions([['Mercury', 0]]).filter(f => f.planet)]), false);
  assert.equal(matches([...raw.filter(f => f.planet !== 'Mercury'), ...positions([['Mercury', 60]]).filter(f => f.planet)]), false);
  assert.equal(matches([...raw.filter(f => f.planet !== 'Mercury'), ...positions([['Venus', 30]]).filter(f => f.planet)]), false, 'another planet cannot replace the third lord');
});

test('older partial records retain their OR inputs and keep unresolved source scopes pending after common-positive extensions', context => {
  const catalog = catalogForDirectory(temporary(context)), pending = pendingClaimConditions({ catalog });
  for (const entry of batch.extended) {
    const row = catalog.get(entry.id), added = new Set(entry.addedInputDigests);
    const former = new Set(entry.inputs.map(row => row.digest)), current = new Set(row.inputs.map(digest));
    assert.equal(row.inputs.filter(input => former.has(digest(input)) && !added.has(digest(input))).length, entry.previousAlternatives);
    const remaining = 1;
    assert.equal(row.remainingAlternatives, remaining); assert.equal(pending.some(item => item.id === entry.id), remaining > 0);
    for (const hash of former) assert.ok(current.has(hash), 'every previously available alternative survives');
  }
  const wife = catalog.get('astro-lilly-v3-spouse-description-p051-001');
  assert.ok(wife.inputs.some(input => input.required.filter(f => f.kind === 'western_lilly_planet_house' && f.house === 7).length === 2));
  const wit = catalog.get('astro-lilly-v3-wit-p033-001');
  for (const aspect of ['square', 'opposition']) assert.equal(wit.inputs.filter(input => input.required.some(f => f.kind === 'western_lilly_aspect' && f.aspect === aspect)).length, 2);
});

test('historical gender and unknown time remain enforced; forged positive or absence flags cannot bypass raw measurements', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory);
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), [unknown] = parseChartQueries([query(raw)], { timeKnown: false });
    const hits = lookupInterpretations(directory, unknown);
    for (const proof of witness.proofs) assert.ok(!hits.some(hit => hit.id === proof.id));
    const gendered = witness.proofs.filter(p => catalog.get(p.id).inputs.some(i => i.required.some(f => f.kind === 'natal_gender')));
    if (gendered.length) for (const facts of [raw.filter(f => f.kind !== 'natal_gender'), [...raw.filter(f => f.kind !== 'natal_gender'), { kind: 'natal_gender', gender: '女' }]]) {
      const changed = lookupInterpretations(directory, query(facts)); for (const proof of gendered) assert.ok(!changed.some(hit => hit.id === proof.id));
    }
  }
  const noPositions = [...positions([['Mercury', 220]]), fake('mercury', 'jupiter', false), fake('mercury', 'venus', false)];
  assert.ok(!lookupInterpretations(directory, query(noPositions)).some(hit => hit.id === noFortune));
  const [parsed] = parseChartQueries([{ ...query(noPositions), confirmedAbsentFacts: [fake('mercury', 'venus')] }]);
  assert.ok(!parsed.confirmedFacts.some(f => f.kind === 'western_lilly_aspect')); assert.ok(!parsed.confirmedAbsentFacts.some(f => f.kind === 'western_lilly_aspect'));
  assert.equal(explainClaim(noFortune, 'western', chartContext('western', noPositions, [fake('mercury', 'venus')], 'natal'), undefined, catalog).matched, false);
});

test('source fingerprints, inventory and mapping audit retain all original conditions and unresolved neighbouring methods', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const row of batch.changes) { const mapping = mappings.get(row.id); assert.equal(mapping.status, 'indexed'); assert.equal(mapping.remainingAlternatives, 0); }
  for (const row of batch.extended) assert.equal(mappings.get(row.id).remainingAlternatives, 1);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2791); assert.equal(batch.previousQueryableInputsPreserved, 2793);
  assert.equal(catalog.get('astro-lilly-v3-merchant-p004-001').inputs.length, 1);
  assert.equal(catalog.get('astro-lilly-v3-wit-p046-001'), null);
  const cusp = catalog.get('astro-lilly-v3-spouse-origin-p005-001');
  assert.equal(cusp.inputs.length, 2); assert.equal(cusp.remainingAlternatives, 1, 'the old conjunction branch remains usable while the seventh-cusp aspect branch stays pending');
  assert.ok(pendingClaimConditions({ catalog }).some(row => row.id === cusp.claim.id));
});

test('a fresh SQLite instance resolves actual unspecified-aspect rules with the source JSON blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }); assert.ok(lookupInterpretations(directory, query(watery), fresh).some(hit => hit.id === noFortune)); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('the report consumes Chinese condition evidence and the explicit ambiguity note through the actual lookup', async context => {
  const actual = createReportLookup(temporary(context)); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === noFortune), events: row.events.filter(hit => hit.id === noFortune) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query(watery)]) }, {
    lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /水星/u); assert.match(request.materials, /金星/u); assert.match(request.materials, /木星/u);
      assert.match(request.materials, /不自动肯定或否定/u); assert.ok(!request.materials.includes('western_lilly_aspect')); return '模型替身报告'; },
  }); assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
