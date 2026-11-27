import assert from 'node:assert/strict';
import fs, { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { claimCatalogDirectory, claimCatalogFile, claimSourceDirectory, createClaimSqliteStore, openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { claimInventory, compileClaimSources, createClaimsCatalog, explainClaim, lookupClaims } from './claims.mjs';
import { chartContext, normalizeRuleInput } from './matching.mjs';

function claim(id, normalized, extra = {}) {
  return { id, title: '迁移测试资料', category: { topic: '综合', type: '性格', tags: [] },
    source: { book: '迁移测试', author: '测试', edition: '1', volume: '一', chapter: '一', section: null, passage_id: id, url: 'https://example.test/source' },
    evidence: { original_text: '测试原文', context: '仅用于测试的来源上下文' },
    conditions: { original: normalized, normalized, uncertain: [], excluded: [], ...extra },
    interpretation: { classical_meaning: '测试解读', limitations: ['仅为测试'] } };
}

const day = { kind: 'stem', position: 'day', stem: '甲' };
const month = { kind: 'branch', position: 'month', branch: '寅' };
const missingHour = { kind: 'branch', position: 'hour', branch: '午' };
const alternative = { kind: 'stem', position: 'year', stem: '乙' };

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'destiny-claims-sqlite-'));
  context.after(() => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'destiny-claims-sqlite-'));
    rmSync(root, { recursive: true, force: true });
  });
  const sourceDirectory = join(root, 'sources');
  mkdirSync(sourceDirectory);
  const data = {
    bazi: [claim('test-bazi', ['测试机器条件'], { match: {
      version: 'destiny-experience-v1', status: 'ready', recordType: 'general_rule', chartScope: 'natal',
      triggerInputs: [], requirements: [], natalInputs: [{ required: [day, month], mustBeAbsent: [missingHour], anyOf: [[alternative]] }],
    } }), claim('test-pending', ['缺少专用算法的条件'])],
    ziwei: [claim('test-ziwei', ['本命财帛宫天同']), claim('ziwei-v1-c017-p101004-001', ['不可作为本命检索'])],
    western: [claim('test-western', ['测试星座'], { match: { version: 1, status: 'ready', reason: null,
      include: [[{ fact: 'chart.zodiac', equals: 'tropical' }, { fact: 'chart.planets.sun.sign', equals: 'aries' }]], exclude: [] } })],
  };
  const write = method => writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(data[method], null, 2));
  for (const method of Object.keys(data)) write(method);
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const options = { directory: join(root, 'runtime'), sourceDirectory, includeLegacy: false };
  return { root, data, write, options, catalog: createClaimsCatalog(options) };
}

test('all 11,162 source records round trip through SQLite with matching counts, inputs and valid indexed references', () => {
  const inventory = claimInventory(); // also proves automatic build when the runtime DB is absent.
  const db = openKnowledgeReadDatabase(join(claimCatalogDirectory, claimCatalogFile));
  try {
    const get = db.prepare('SELECT claim_json FROM claim_entry WHERE id = ?');
    for (const method of ['bazi', 'ziwei', 'western']) {
      const source = JSON.parse(readFileSync(join(claimSourceDirectory, method + '.json'), 'utf8'));
      assert.equal(inventory.filter(row => row.method === method).length, source.length);
      for (const row of source) assert.deepEqual(JSON.parse(get.get(row.id).claim_json), row, row.id);
    }
    assert.equal(inventory.length, 11162);
    assert.equal(db.prepare('SELECT count(*) AS n FROM claim_rule').get().n, 91056);
    assert.equal(db.prepare('SELECT count(*) AS n FROM claim_alternative').get().n, 93525);
    assert.equal(db.prepare(`SELECT count(*) AS n FROM knowledge_entry
      WHERE length(trim(source_book)) > 0 AND length(trim(original_text)) > 0
        AND length(trim(modern_interpretation)) > 0`).get().n, 14257);
    assert.equal(db.prepare(`SELECT count(*) AS n FROM claim_branch
      WHERE length(trim(json_extract(branch_json, '$.text'))) > 0`).get().n, 5136);
    assert.equal(db.prepare(`SELECT count(*) AS n FROM claim_branch
      WHERE json_extract(branch_json, '$.modernInterpretation') LIKE '按这段原文%'`).get().n, 0);
    const separate = db.prepare(`SELECT json_extract(branch_json, '$.text') AS original,
      json_extract(branch_json, '$.modernInterpretation') AS modern
      FROM claim_branch WHERE claim_id = ? ORDER BY ordinal`).all('dtsjy-v1-c044-p003-001');
    assert.deepEqual(separate.map(({ original }) => original), ['財重無官', '官重無印']);
    assert.match(separate[0].modern, /没有官杀/u);
    assert.match(separate[1].modern, /没有正印或偏印/u);
    assert.equal(db.prepare("SELECT count(*) AS n FROM knowledge_entry WHERE original_kind = 'rule_basis'").get().n, 3094);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok');
    assert.ok(db.prepare("SELECT name FROM sqlite_schema WHERE name = 'claim_required_by_fact'").get());
  } finally { db.close(); }
});

test('SQL candidates require all required facts, while full matching preserves exclusions, alternatives and source filters', context => {
  const { catalog } = fixture(context);
  const lookup = (facts, absent = []) => lookupClaims('bazi', chartContext('bazi', facts, absent), undefined, catalog);
  assert.deepEqual(lookup([day], [missingHour]), []);
  assert.deepEqual(lookup([day, month], [missingHour]), []);
  assert.deepEqual(lookup([day, month, alternative]), []);
  const hits = lookup([day, month, alternative], [missingHour]);
  assert.deepEqual(hits.map(row => row.id), ['test-bazi']);
  assert.deepEqual(hits[0].matchedConditions.alternatives, [[alternative]]);
  assert.deepEqual(lookupClaims('bazi', chartContext('bazi', [day, month, alternative], [missingHour]), "x' OR 1=1 --", catalog), []);
  assert.deepEqual(lookupClaims('bazi', chartContext('bazi', [day, month, alternative], [missingHour], 'annual'), undefined, catalog), []);
  assert.equal(explainClaim('test-bazi', 'bazi', chartContext('bazi', [day]), undefined, catalog).reason, 'conditions_not_met');
  assert.equal(explainClaim('test-pending', 'bazi', null, undefined, catalog).reason, 'unmapped_condition');
  assert.equal(catalog.inventory().find(row => row.claim.id === 'ziwei-v1-c017-p101004-001').lookup.status, 'skipped');
  assert.equal(catalog.get("test-bazi'"), null);
});

test('every compiled Claim retains exactly the same full and passage conditions after SQLite migration', () => {
  const sources = new Map(compileClaimSources().map(row => [row.claim.id, row]));
  let checked = 0;
  for (const row of createClaimsCatalog().compiledEntries()) {
    const original = sources.get(row.claim.id);
    for (const field of ['inputs', 'category', 'reason', 'condition', 'remainingAlternatives']) {
      assert.deepEqual(row[field], original[field], row.claim.id + ':' + field);
    }
    const proofs = ({ branches }) => branches.map(({ text, inputs, conditionCompiler, decadalAnchor }) =>
      ({ text, inputs, conditionCompiler, decadalAnchor }));
    assert.deepEqual(proofs(row), proofs(original), row.claim.id + ':branches');
    checked++;
  }
  assert.equal(checked, sources.size);
});

test('a warm database is queried without reading JSON source content, including in a fresh store instance', context => {
  const { catalog, options } = fixture(context);
  catalog.build();
  const db = new DatabaseSync(catalog.file);
  db.prepare("UPDATE claim_entry SET claim_json = json_set(claim_json, '$.interpretation.classical_meaning', ?) WHERE id = ?")
    .run('来自 SQLite 运行库', 'test-ziwei');
  db.close();
  const originalRead = fs.readFileSync;
  fs.readFileSync = function (path, ...args) {
    if (String(path).startsWith(options.sourceDirectory)) throw new Error('Runtime must not parse JSON sources.');
    return originalRead.call(this, path, ...args);
  };
  syncBuiltinESMExports();
  try {
    const reader = createClaimsCatalog(options);
    const chart = chartContext('ziwei', [{ kind: 'palace_star', palace: '财帛', star: '天同', scope: 'origin' }]);
    const [hit] = lookupClaims('ziwei', chart, undefined, reader);
    assert.equal(hit.reading, '来自 SQLite 运行库');
    assert.equal(explainClaim('test-ziwei', 'ziwei', chart, undefined, reader).matched, true);
    assert.equal(reader.inventory().length, 5);
  } finally { fs.readFileSync = originalRead; syncBuiltinESMExports(); }
});

test('source updates rebuild atomically, identical LF/CRLF content reuses compiled rules, and schema upgrades rebuild', context => {
  const { catalog, data, write, options } = fixture(context);
  const first = catalog.build();
  const file = join(options.sourceDirectory, 'ziwei.json');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/\n/gu, '\r\n'));
  assert.equal(catalog.status().source_digest, first.source_digest);
  assert.equal(catalog.status().built_at, first.built_at);
  data.ziwei[0].interpretation.classical_meaning = '已更新的源资料';
  write('ziwei');
  assert.equal(catalog.get('test-ziwei').claim.interpretation.classical_meaning, '已更新的源资料');
  assert.notEqual(catalog.status().source_digest, first.source_digest);
  const db = new DatabaseSync(catalog.file);
  db.exec('UPDATE claim_catalog_meta SET schema_version = 0');
  db.close();
  assert.equal(catalog.status().schema_version, first.schema_version);
  assert.equal(catalog.inventory().length, 5);
});

test('invalid source imports roll back instead of damaging the previous runtime database', context => {
  const { catalog, data, write } = fixture(context);
  const previous = catalog.build();
  const old = new DatabaseSync(catalog.file);
  try {
    old.exec("CREATE TABLE rule_review (id TEXT PRIMARY KEY); INSERT INTO rule_review VALUES ('old-review');");
  } finally { old.close(); }
  data.bazi.push(data.bazi[0]); // duplicate stable ID must fail validation.
  write('bazi');
  assert.throws(() => catalog.inventory(), /Invalid claim/u);
  const db = new DatabaseSync(catalog.file, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM claim_entry').get().n, 5);
    assert.equal(db.prepare('SELECT source_digest FROM claim_catalog_meta').get().source_digest, previous.source_digest);
    assert.equal(db.prepare('SELECT id FROM rule_review').get().id, 'old-review');
    data.bazi.pop(); write('bazi');
    catalog.build({ force: true });
    assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name = 'rule_review'").get(), undefined);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
  assert.equal(catalog.inventory().length, 5);
});

test('SQLite keeps passage order, independent input groups and decadal anchors without importing unmatched outcomes', context => {
  const { options } = fixture(context);
  const origin = claim('branch-test', ['测试分句']);
  const input = normalizeRuleInput('bazi', { required: [day] });
  const period = { kind: 'bazi_decadal_range', ganZhi: '甲子', startAge: 1, endAge: 10 };
  const store = createClaimSqliteStore({ ...options, compile: () => [{ method: 'bazi', claim: origin, reason: 'unmapped_condition',
    branches: [{ text: '命中本命分句', inputs: [input] },
      { text: '只在对应大运分句', inputs: [input], decadalAnchor: { kind: 'bazi_decadal_range', ganZhi: '甲子' } },
      { text: '未命中的条件', inputs: [normalizeRuleInput('bazi', { required: [month] })] }] }] });
  store.build();
  const [plain] = lookupClaims('bazi', chartContext('bazi', [day]), undefined, store);
  assert.deepEqual(plain.matchedBranches.map(branch => branch.text), ['命中本命分句']);
  const [timed] = lookupClaims('bazi', chartContext('bazi', [day, period]), undefined, store);
  assert.deepEqual(timed.matchedBranches.map(branch => branch.text), ['命中本命分句', '只在对应大运分句']);
  assert.deepEqual(timed.matchedBranches[1].matchedConditions.decadalPeriod, { ganZhi: '甲子', startAge: 1, endAge: 10, ageBasis: '虚岁' });
});
