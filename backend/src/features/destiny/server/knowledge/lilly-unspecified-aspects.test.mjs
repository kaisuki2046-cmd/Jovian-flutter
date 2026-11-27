import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { lillyAspect, lillyAspectFacts } from './lilly-aspects.mjs';
import { createClaimsCatalog, explainClaim, lookupClaims } from './claims.mjs';
import { compileWesternClaim } from './western-claims.mjs';
import { normalizeFacts } from './catalog.mjs';
import { chartContext } from './matching.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const positions = entries => [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...entries.map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
const atom = (first, second, equals = true) => ({ fact: `profiles.lilly.aspects.${first}.${second}.any`, equals });
const predicate = (first, second, matches = true, table = 'main') => ({ kind: 'western_lilly_aspect', table, first, second, aspect: 'any', matches });
const cusps = [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: i * 30 }))];

function fixture(context, cases) {
  const root = mkdtempSync(join(tmpdir(), 'destiny-unspecified-aspect-'));
  context.after(() => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'destiny-unspecified-aspect-')); rmSync(root, { recursive: true, force: true }); });
  const sourceDirectory = join(root, 'sources'), directory = join(root, 'runtime'); mkdirSync(sourceDirectory);
  const template = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)))[0];
  const rows = cases.map((value, index) => ({ ...template, id: 'test-unspecified-' + index, source: { ...template.source, book: 'Christian Astrology' },
    conditions: { ...template.conditions, excluded: [], match: { version: 1, status: 'ready', reason: null, ...value } } }));
  writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify(rows));
  for (const method of ['bazi', 'ziwei']) writeFileSync(join(sourceDirectory, method + '.json'), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  return createClaimsCatalog({ sourceDirectory, directory, includeLegacy: false });
}

test('the four printed rays and both moiety tables give common positive evidence, with all conjunction boundaries left unknown', () => {
  for (const [table, bound] of [['main', 9], ['other', 8]]) {
    for (const angle of [60, 90, 120, 180]) {
      assert.equal(lillyAspect(0, angle, 'venus', 'saturn', 'any', table), true);
      assert.equal(lillyAspect(0, angle === 180 ? angle - bound : angle + bound, 'venus', 'saturn', 'any', table), true);
    }
    for (const angle of [0, bound, 360 - bound, 359]) assert.equal(lillyAspect(0, angle, 'venus', 'saturn', 'any', table), null);
    for (const angle of [bound + 0.000001, 30, 360 - bound - 0.000001]) assert.equal(lillyAspect(0, angle, 'venus', 'saturn', 'any', table), false);
  }
  assert.equal(lillyAspect(100, 168.5, 'venus', 'saturn', 'any', 'main'), true);
  assert.equal(lillyAspect(100, 168.5, 'venus', 'saturn', 'any', 'other'), false);
  assert.equal(lillyAspect(15, 15, 'mars', 'mars', 'any', 'main'), null);
  assert.equal(lillyAspect(0, 90, 'sun', 'moon', 'partile_square', 'main'), null);
});

test('contradictory zodiac, sign or ruler inputs cannot become unspecified-aspect absences', () => {
  const facts = positions([['Sun', 0], ['Moon', 30]]), request = [predicate('sun', 'moon')];
  assert.equal(lillyAspectFacts(facts, request)[0].matches, false);
  for (const raw of [facts.filter(f => f.planet !== 'Moon'), [...facts, { kind: 'planet_longitude', planet: 'Moon', longitude: 60 }],
    [...facts, { kind: 'western_zodiac', zodiac: 'sidereal' }], [...facts, { kind: 'planet_sign', planet: 'Moon', sign: '白羊座' }]]) assert.deepEqual(lillyAspectFacts(raw, request), []);
  const roleRequest = [predicate('house_1_ruler', 'house_3_ruler')];
  assert.equal(lillyAspectFacts([...positions([['Mars', 0], ['Mercury', 30]]), ...cusps], roleRequest)[0].matches, false);
  assert.deepEqual(lillyAspectFacts([...positions([['Mars', 0], ['Mercury', 30]]), ...cusps.filter(f => f.house !== 12)], roleRequest), []);
  const same = [predicate('house_1_ruler', 'house_8_ruler')]; // Aries and Scorpio both resolve to Mars.
  assert.deepEqual(lillyAspectFacts([...positions([['Mars', 0]]), ...cusps], same), []);
});

test('actual SQL differentiates a confirmed absence from missing data and conjunction ambiguity', context => {
  const catalog = fixture(context, [{ include: [[atom('sun', 'moon')]], exclude: [] }, { include: [[atom('sun', 'moon', false)]], exclude: [] }]);
  const hits = entries => lookupClaims('western', chartContext('western', positions(entries)), undefined, catalog).map(row => row.id);
  assert.deepEqual(hits([['Sun', 0], ['Moon', 90]]), ['test-unspecified-0']);
  assert.deepEqual(hits([['Sun', 0], ['Moon', 30]]), ['test-unspecified-1']);
  assert.deepEqual(hits([['Sun', 0], ['Moon', 0]]), []); assert.deepEqual(hits([['Sun', 0]]), []);
  const forged = [...positions([['Sun', 0]]), predicate('sun', 'moon', false)];
  assert.deepEqual(lookupClaims('western', chartContext('western', forged), undefined, catalog), []);
  const report = explainClaim('test-unspecified-1', 'western', chartContext('western', positions([['Sun', 0], ['Moon', 30]])), undefined, catalog);
  assert.match(report.calculationNote, /合相/u); assert.match(report.calculationNote, /不自动肯定或否定/u);
});

test('an exclusion-only pair requires real evidence and a complete rule uses one orb table throughout', context => {
  const catalog = fixture(context, [{ include: [[atom('venus', 'saturn')]], exclude: [[atom('sun', 'moon')]] }]);
  const hit = entries => lookupClaims('western', chartContext('western', positions(entries)), undefined, catalog);
  assert.deepEqual(hit([['Venus', 100], ['Saturn', 168.5], ['Sun', 0], ['Moon', 74]]), [], 'main gives both aspects; other gives neither, so the positive and absence cannot be mixed');
  assert.deepEqual(hit([['Venus', 100], ['Saturn', 160]]), [], 'the excluded pair is unknown');
  assert.deepEqual(hit([['Venus', 100], ['Saturn', 160], ['Sun', 0], ['Moon', 0]]), [], 'ambiguous conjunction does not disprove an exclusion');
  const matches = hit([['Venus', 100], ['Saturn', 160], ['Sun', 0], ['Moon', 30]]); assert.equal(matches.length, 1);
  assert.match(buildReportMaterials([{ topic: '测试', personality: matches, events: [] }]), /合相/u);
  assert.ok(catalog.factsByKind('western_lilly_aspect').some(f => f.first === 'moon' || f.second === 'moon'));
});

test('the extension stays within Lilly, validates its exact enum and preserves explicit conjunction independently', () => {
  const source = book => ({ source: { book }, conditions: { excluded: [], match: { status: 'ready', include: [[atom('sun', 'moon')]], exclude: [] } } });
  assert.equal(compileWesternClaim(source('Christian Astrology')).inputs.length, 2);
  assert.equal(compileWesternClaim(source('Tetrabiblos')).reason, 'unsupported_calculation_profile');
  normalizeFacts('western', [predicate('sun', 'moon')]);
  for (const invalid of [{ ...predicate('sun', 'moon'), table: 'mixed' }, { ...predicate('sun', 'moon'), aspect: 'all' }, { ...predicate('sun', 'moon'), first: 'ascendant' }]) assert.throws(() => normalizeFacts('western', [invalid]));
  assert.equal(lillyAspect(0, 0, 'sun', 'moon', 'conjunction', 'main'), true);
  assert.equal(lillyAspect(0, 0, 'sun', 'moon', 'friendly', 'main'), false);
});
