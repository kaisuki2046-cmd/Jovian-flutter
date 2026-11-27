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

const positions = entries => [{ kind: 'western_zodiac', zodiac: 'tropical' },
  ...entries.map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
const atom = (first, second, aspect, equals = true) => ({ fact: `profiles.lilly.aspects.${first}.${second}.${aspect}`, equals });

test('the printed Venus/Saturn example and both moiety boundaries use the two original tables', () => {
  assert.equal(lillyAspect(40, 168, 'venus', 'saturn', 'trine', 'main'), true);
  assert.equal(lillyAspect(40, 168, 'venus', 'saturn', 'trine', 'other'), true);
  assert.equal(lillyAspect(40, 168.5, 'venus', 'saturn', 'trine', 'main'), true);
  assert.equal(lillyAspect(40, 168.5, 'venus', 'saturn', 'trine', 'other'), false);
  for (const [table, bound] of [['main', 9], ['other', 8]]) {
    for (const [aspect, angle] of [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]]) {
      const direction = angle === 180 ? -1 : 1;
      assert.equal(lillyAspect(0, angle + direction * bound, 'venus', 'saturn', aspect, table), true);
      assert.equal(lillyAspect(0, angle + direction * (bound + 1e-6), 'venus', 'saturn', aspect, table), false);
    }
  }
  assert.equal(lillyAspect(359, 1, 'sun', 'moon', 'conjunction', 'main'), true);
  assert.equal(lillyAspect(0, 0, 'venus', 'saturn', 'friendly', 'main'), false);
  assert.equal(lillyAspect(0, 60, 'venus', 'saturn', 'friendly', 'main'), true);
  assert.equal(lillyAspect(0, 120, 'venus', 'saturn', 'friendly', 'main'), true);
  assert.equal(lillyAspect(0, 90, 'venus', 'saturn', 'friendly', 'main'), false);
});

test('missing or contradictory coordinates are unknown; house roles are resolved from the same verified cusps', () => {
  const predicate = normalizeFacts('western', [{ kind: 'western_lilly_aspect', table: 'main', first: 'sun', second: 'moon', aspect: 'square', matches: true }]);
  assert.deepEqual(lillyAspectFacts(positions([['Sun', 0]]), predicate), []);
  assert.deepEqual(lillyAspectFacts(positions([['Sun', 0], ['Sun', 30], ['Moon', 90]]), predicate), []);
  assert.equal(lillyAspectFacts(positions([['Sun', 0], ['Moon', 180]]), predicate)[0].matches, false);
  const roles = normalizeFacts('western', [{ kind: 'western_lilly_aspect', table: 'main', first: 'house_1_ruler', second: 'house_9_ruler', aspect: 'conjunction', matches: true }]);
  const raw = [...positions([['Mars', 15], ['Jupiter', 15]]), { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30 }))];
  assert.equal(lillyAspectFacts(raw, roles)[0].matches, true);
  assert.deepEqual(lillyAspectFacts(raw.filter(fact => fact.house !== 12), roles), []);
  assert.equal(lillyAspect(15, 15, 'mars', 'mars', 'conjunction', 'main'), false);
  assert.equal(compileWesternClaim({ source: { book: 'Christian Astrology' }, conditions: { excluded: [], match: {
    status: 'ready', include: [[{ fact: 'chart.house_system', equals: 'whole_sign' }, atom('house_1_ruler', 'house_9_ruler', 'conjunction')]], exclude: [],
  } } }).reason, 'unsupported_calculation_profile', 'a whole-sign marker cannot silently select Regiomontanus house lords');
  for (const aspect of ['partile_conjunction', 'partile_trine']) {
    assert.equal(lillyAspect(0, 0, 'sun', 'moon', aspect, 'main'), null);
    assert.equal(compileWesternClaim({ source: { book: 'Christian Astrology' }, conditions: { excluded: [], match: {
      status: 'ready', include: [[atom('sun', 'moon', aspect)]], exclude: [],
    } } }).reason, 'unsupported_calculation_profile');
  }
});

function fixture(context, cases) {
  const root = mkdtempSync(join(tmpdir(), 'destiny-aspect-sqlite-'));
  context.after(() => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'destiny-aspect-sqlite-'));
    rmSync(root, { recursive: true, force: true });
  });
  const sourceDirectory = join(root, 'sources'), directory = join(root, 'runtime');
  mkdirSync(sourceDirectory);
  const template = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)))[0];
  const rows = cases.map((value, index) => ({ ...template, id: 'test-aspect-' + index, source: { ...template.source, book: 'Christian Astrology' },
    conditions: { ...template.conditions, excluded: [], match: { version: 1, status: 'ready', reason: null, ...value } } }));
  const write = () => writeFileSync(join(sourceDirectory, 'western.json'), JSON.stringify(rows));
  write();
  for (const method of ['bazi', 'ziwei']) writeFileSync(join(sourceDirectory, method + '.json'), '[]');
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ sourceDirectory, directory, includeLegacy: false });
  return { catalog, directory, rows, write };
}

test('SQLite computes exclusion-only selectors, rejects mixed tables and preserves version-dependent proof in report materials', context => {
  const { catalog, directory } = fixture(context, [
    { include: [[atom('sun', 'jupiter', 'conjunction')]], exclude: [] },
    { include: [[atom('sun', 'jupiter', 'conjunction'), atom('venus', 'saturn', 'trine', false)]], exclude: [] },
    { include: [[atom('sun', 'jupiter', 'conjunction')]], exclude: [[atom('moon', 'mars', 'trine')]] },
  ]);
  const matches = facts => lookupClaims('western', chartContext('western', facts), undefined, catalog);
  const raw = positions([['Sun', 0], ['Jupiter', 12.5], ['Venus', 40], ['Saturn', 168.5]]);
  const hits = matches(raw);
  assert.ok(hits.some(hit => hit.id === 'test-aspect-0'));
  assert.ok(!hits.some(hit => hit.id === 'test-aspect-1'), 'one table cannot supply the positive and another the negative');
  assert.ok(!hits.some(hit => hit.id === 'test-aspect-2'), 'unknown excluded pair cannot prove absence');
  assert.match(hits.find(hit => hit.id === 'test-aspect-0').calculationNote, /首列/u);
  assert.match(buildReportMaterials([{ topic: '测试', personality: hits, events: [] }]), /另一套表未满足/u);
  assert.match(explainClaim('test-aspect-0', 'western', chartContext('western', raw), undefined, catalog).calculationNote, /首列/u);
  assert.ok(catalog.factsByKind('western_lilly_aspect').some(fact => [fact.first, fact.second].includes('moon')),
    'an exclusion-only predicate is in the SQLite dictionary');
  assert.ok(matches([...raw, ...positions([['Moon', 0], ['Mars', 90]])]).some(hit => hit.id === 'test-aspect-2'));
  const forged = [...positions([['Sun', 0], ['Jupiter', 180]]), ...catalog.get('test-aspect-0').inputs[0].required];
  assert.deepEqual(matches(forged), [], 'client assertions cannot replace coordinates');
});

test('derived selector caches refresh after source rebuilds in the same SQLite store', context => {
  const { catalog, rows, write } = fixture(context, [{ include: [[atom('sun', 'jupiter', 'conjunction')]], exclude: [] }]);
  assert.ok(catalog.factsByKind('western_lilly_aspect').every(fact => fact.aspect === 'conjunction'));
  rows[0].conditions.match.include = [[atom('sun', 'jupiter', 'square')]];
  write();
  assert.ok(catalog.factsByKind('western_lilly_aspect').every(fact => fact.aspect === 'square'));
  assert.throws(() => catalog.factsByKind('*'), /Invalid fact kind/u);
});
