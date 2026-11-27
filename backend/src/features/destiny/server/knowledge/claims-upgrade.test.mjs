import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, calculateZiwei, chartFacts } from '../../control/charts.ts';
import { claimCatalogDigest, claimContextText, isClaimContext, compileBaziMachineMatch } from './claim-compat.mjs';
import { claimChartContext, claimForPrompt, claimInventory, explainClaim, lookupClaims, pendingClaimConditions } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileWesternClaim, westernClaimCondition } from './western-claims.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { chartVersions } from './catalog.mjs';
import { tiebanNeedsExtraFacts } from './tieban.mjs';

test('the imported catalogs match the upgrade manifest and keep globally unique IDs', () => {
  const manifest = JSON.parse(readFileSync(new URL('./claims/upgrade-manifest.json', import.meta.url)));
  const ids = new Set();
  for (const [method, expected] of Object.entries(manifest.catalogs)) {
    const raw = readFileSync(new URL(`./claims/${method}.json`, import.meta.url));
    assert.equal(claimCatalogDigest(raw), expected.sha256);
    const claims = JSON.parse(raw);
    assert.equal(claims.length, expected.count);
    assert.equal(expected.previousCount + expected.added - expected.removed, expected.count);
    for (const claim of claims) { assert.ok(!ids.has(claim.id), claim.id); ids.add(claim.id); }
  }
  assert.equal(ids.size, 11162);
  assert.equal(claimInventory().length, ids.size);
});

test('catalog digests remain stable across Git LF/CRLF checkouts and UTF-8 BOM', () => {
  const text = '[\n  {"title":"紫微"}\n]\n';
  assert.equal(claimCatalogDigest(text), claimCatalogDigest(Buffer.from('\uFEFF' + text.replace(/\n/gu, '\r\n'))));
  assert.notEqual(claimCatalogDigest(text), claimCatalogDigest(text.replace('紫微', '八字')));
});

test('structured Ziwei evidence and supplied local BaZi citations remain readable without leaking source chapters into prompts', () => {
  const context = { sections: [{ text: '核对原段' }, { text: '另一分句' }] };
  assert.ok(isClaimContext(context));
  assert.equal(claimContextText(context), '核对原段\n另一分句');
  assert.equal(isClaimContext({ sections: [{}] }), false);
  const inventory = claimInventory();
  const ziwei = inventory.find(row => row.method === 'ziwei');
  const structured = { ...ziwei, claim: { ...ziwei.claim, evidence: { ...ziwei.claim.evidence, context } } };
  const local = inventory.find(row => row.claim.source.url === null);
  assert.ok(structured);
  assert.ok(local.claim.source.local_path);
  for (const row of [structured, local]) {
    const prompt = claimForPrompt({ claim: row.claim, method: row.method, matchedConditions: { required: [] } });
    assert.equal(prompt.evidence.context, null);
    assert.equal(prompt.evidence.original_text, row.claim.evidence.original_text);
    assert.equal(prompt.conditions.match, undefined);
  }
});

test('embedded BaZi conditions preserve alternatives, exclusions and additional calculation requirements', () => {
  const day = { kind: 'pillar', position: 'day', ganZhi: '庚辰' };
  const month = { kind: 'branch', position: 'month', branch: '午' };
  const match = { version: 'destiny-experience-v1', status: 'ready', recordType: 'general_rule', chartScope: 'natal',
    triggerInputs: [], requirements: [], natalInputs: [{ required: [day], mustBeAbsent: [month] }] };
  const compiled = compileBaziMachineMatch(match);
  assert.equal(evaluateRule(compiled.inputs[0], 'natal', chartContext('bazi', [day])).matched, false);
  assert.equal(evaluateRule(compiled.inputs[0], 'natal', chartContext('bazi', [day], [month])).matched, true);
  assert.equal(compileBaziMachineMatch({ ...match, chartScope: 'annual' }).inputs, undefined);
  assert.equal(compileBaziMachineMatch({ ...match, requirements: ['requires_more_facts'] }).inputs, undefined);
  assert.equal(compileBaziMachineMatch({ ...match, natalInputs: [{ required: [{ kind: 'unknown' }] }] }).inputs, undefined);
  const rows = claimInventory();
  const ready = rows.filter(row => row.method === 'bazi' && row.claim.conditions.match?.status === 'ready');
  assert.equal(ready.length, 153);
  const general = ready.filter(row => row.claim.conditions.match.recordType === 'general_rule');
  assert.equal(general.filter(row => row.lookup.status === 'indexed').length, 134);
  assert.deepEqual(general.filter(row => row.lookup.status === 'branch_indexed').map(row => row.claim.id), ['qtbj-v3-c034-p003-701']);
  const cases = ready.filter(row => row.claim.conditions.match.recordType === 'case');
  assert.equal(cases.filter(row => row.lookup.status === 'case_indexed').length, 18);
  assert.ok(cases.every(row => row.lookup.reason !== 'historical_case'));
  const tieban = rows.filter(row => row.claim.conditions.match?.system === 'tieban');
  assert.equal(tieban.length, 3319);
  assert.ok(tieban.every(row => row.lookup.reason === 'different_calculation_system' && row.lookup.status === 'unmapped'));
  for (const { claim } of tieban) {
    const { chartScope, selector } = claim.conditions.match;
    assert.equal(chartScope, 'natal', claim.id);
    assert.equal(selector.libraryEdition, 'muxuan-json', claim.id);
    assert.equal(selector.ages.length, 0, claim.id);
    assert.equal(tiebanNeedsExtraFacts(claim.evidence.original_text), false, claim.id);
  }
});

const atom = (fact, equals) => ({ fact, equals });
const westernClaim = (include, exclude = []) => ({ conditions: {
  excluded: [], match: { version: 1, status: 'ready', include, exclude, reason: null },
} });

test('Western exclusion groups require proven absence, preserve AND/OR, and never equate unknown facts with absence', () => {
  const sun = atom('chart.planets.sun.sign', 'aries');
  const moon = atom('chart.planets.moon.sign', 'taurus');
  const motion = atom('chart.planets.mercury.motion', 'retrograde');
  const compiled = compileWesternClaim(westernClaim([[sun]], [[moon, motion]]));
  const matches = facts => compiled.inputs.some(input => evaluateRule(input, 'natal',
    claimChartContext('western', chartContext('western', facts))).matched);
  const facts = atoms => atoms.map(westernClaimCondition);
  assert.equal(matches(facts([sun])), false);
  assert.equal(matches(facts([sun, moon, motion])), false);
  assert.equal(matches(facts([sun, atom('chart.planets.moon.sign', 'gemini')])), true);
  assert.equal(matches(facts([sun, atom('chart.planets.mercury.motion', 'direct')])), true);
  assert.equal(matches(facts([sun, moon, atom('chart.planets.moon.sign', 'gemini')])), false);
  const withTwoGroups = compileWesternClaim(westernClaim([[sun]], [[moon], [motion]]));
  const chart = claimChartContext('western', chartContext('western', facts([sun, atom('chart.planets.moon.sign', 'gemini')])));
  assert.ok(withTwoGroups.inputs.every(input => !evaluateRule(input, 'natal', chart).matched));
  assert.deepEqual(compileWesternClaim(westernClaim([[atom('chart.house_system', 'regiomontanus')]])).inputs[0].required,
    [{ kind: 'western_profile_system', profile: 'regiomontanus' }]);
  assert.equal(compileWesternClaim(westernClaim([[atom('chart.house_system', 'placidus')]])).reason, 'unsupported_calculation_profile');
  assert.equal(compileWesternClaim(westernClaim([[sun]], [[atom('profiles.lilly.unknown', true)]])).reason, 'unmapped_exclusions');
});

test('Western motion is computed across circular longitude and new timed facts are removed when birth time is unknown', () => {
  const instant = Date.UTC(2024, 2, 20, 3, 6);
  const place = { latitude: 39.907, longitude: 116.397 };
  const chart = calculateWestern(instant, place);
  const before = calculateWestern(instant - 12 * 3600000, place);
  const after = calculateWestern(instant + 12 * 3600000, place);
  for (const motion of chart.motion) {
    const a = before.positions.find(p => p.planet === motion.planet).longitude;
    const b = after.positions.find(p => p.planet === motion.planet).longitude;
    const delta = ((b - a + 540) % 360) - 180;
    assert.equal(motion.motion, delta < 0 ? 'retrograde' : 'direct');
    assert.ok(Math.abs(motion.degreesPerDay - delta) < 0.03);
  }
  const facts = chartFacts.western(chart);
  assert.equal(facts.filter(f => f.kind === 'house_sign').length, 12);
  assert.equal(facts.filter(f => f.kind === 'planet_motion').length, 10);
  const asc = facts.find(f => f.kind === 'angle_sign' && f.angle === 'ascendant');
  assert.deepEqual(westernClaimCondition(atom('chart.angles.asc.sign',
    ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'][Math.floor(chart.ascendant / 30)])), asc);
  const [unknown] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: facts }], { timeKnown: false });
  assert.ok(!unknown.confirmedFacts.some(f => ['angle_sign', 'house_sign', 'planet_house', 'western_sect'].includes(f.kind)));
  const archived = { ...chart }; delete archived.motion;
  assert.ok(!chartFacts.western(archived).some(f => f.kind === 'planet_motion'));
});

test('new source conditions retire old multi-sentence mappings and new records match only their own evidence', () => {
  const id = 'ziwei-v2-fuqigong-p101003-001';
  const star = (palace, name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const staleFacts = [star('夫妻', '太阳'), star('夫妻', '巨门'), { kind: 'palace_origin_star_count', palace: '夫妻', count: 2 }];
  assert.equal(explainClaim(id, 'ziwei', chartContext('ziwei', staleFacts)).matched, false);
  const newId = 'ziwei-v2-caibogong-p101007-002';
  const hit = lookupClaims('ziwei', chartContext('ziwei', [star('财帛', '天同'), star('财帛', '巨门')])).find(r => r.id === newId);
  assert.ok(hit);
  assert.equal(claimForPrompt(hit).evidence.original_text, '巨门同财气进退');
  assert.equal(claimForPrompt(hit).evidence.context, null);
  assert.equal(lookupClaims('ziwei', chartContext('ziwei', [star('财帛', '天同'), star('迁移', '巨门')])).some(r => r.id === newId), false);
  assert.ok(pendingClaimConditions().some(row => row.revisedConditions));
});

test('real natal charts pass the report contract and reach each imported catalog alongside existing rules', () => {
  const instant = Date.UTC(1990, 0, 1, 8);
  const charts = { bazi: calculateBaZi(instant, Date.UTC(1990, 0, 1, 16)),
    ziwei: calculateZiwei({ date: { year: 1990, month: 1, day: 1 }, gender: 'male' }, 8),
    western: calculateWestern(instant, { latitude: 39.907, longitude: 116.397 }) };
  for (const [method, chart] of Object.entries(charts)) {
    const confirmedFacts = chartFacts[method](chart);
    assert.ok(confirmedFacts.length <= 256);
    assert.ok(parseChartQueries([{ method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts }]));
    const hits = lookupClaims(method, chartContext(method, confirmedFacts));
    assert.ok(hits.length, method);
    assert.ok(hits.every(hit => hit.matchedConditions.required.length));
    assert.ok(hits.every(hit => claimForPrompt(hit).evidence.context === null));
  }
});
