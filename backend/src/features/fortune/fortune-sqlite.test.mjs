import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { ensureFortuneKnowledgeDatabase, knowledgeMethods, knowledgeSourceDirectory,
  openFortuneKnowledgeDatabase } from './storage/knowledge/database.mjs';
import { auditFortuneKnowledge, groupRemainingFortuneRules } from './storage/knowledge/audit.mjs';
import { knowledgePeriods, parseFortuneKnowledgeManifest, runtimeId } from './storage/knowledge/manifest.mjs';

const sourceName = 'fortune_knowledge.json';
// Semantic snapshots of the imported content, including reviewed explanatory text.
const catalogContentHashes = {
  bazi: '61f6fd64932d888ee56b9922172e1387767f2c01c98a96f3939557f922fea3e4',
  ziwei: 'be98b2ddd86c13ac017a80a18209358067bb9c5c8b228e375f4d4b073ed2b2c0',
  western: '6c4d738029973edcefa3e96bc493285d97b6de8ad6b765874193f49741e3d5ec',
};
const consolidatedRoutes = new Map([
  [99, ['geng-killer', 'xin-repeat']],
  [100, ['branch-root', 'geng-killer', 'xin-repeat', 'xin-new-exposure']],
]);

function contentHash(value) {
  const json = JSON.stringify(value, (_, field) => {
    if (field === null || typeof field !== 'object' || Array.isArray(field)) return field;
    return Object.fromEntries(Object.keys(field).sort().map(key => [key, field[key]]));
  });
  return createHash('sha256').update(json).digest('hex');
}

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'fortune-sqlite-'));
  try {
    const sourceDirectory = join(directory, 'sources');
    mkdirSync(sourceDirectory);
    const source = join(sourceDirectory, sourceName);
    copyFileSync(join(knowledgeSourceDirectory, sourceName), source);
    const readRaw = () => JSON.parse(readFileSync(source, 'utf8'));
    const writeRaw = catalog => writeFileSync(source, JSON.stringify(catalog));
    return run({ sourceDirectory, directory: join(directory, 'database') }, {
      readRaw, writeRaw,
      read: () => parseFortuneKnowledgeManifest(readFileSync(source)),
      write: ({ entries, adviceGroups }) => {
        const collections = Object.fromEntries([...knowledgePeriods, 'advice'].map(key => [key, []]));
        for (const entry of entries) {
          const key = entry.category.contentType === '建议' ? 'advice' : entry.category.period;
          collections[key].push(entry);
        }
        writeRaw({ schemaVersion: 2, ...collections, adviceGroups });
      },
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
const firstBaziInterpretation = catalog => catalog.entries.find(entry =>
  entry.category.method === 'bazi' && entry.category.contentType === '解读');
const printedLuckEntry = catalog => catalog.entries.find(entry => entry.matchConditions.formatted.review?.printedLuck);
const nextId = catalog => Math.max(...catalog.entries.map(entry => entry.id)) + 1;

test('one JSON catalog round-trips through numeric SQLite keys and preserves legacy content and order', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  assert.equal(catalog.schemaVersion, 2);
  const path = ensureFortuneKnowledgeDatabase(options);
  assert.equal(ensureFortuneKnowledgeDatabase(options), path);
  const db = openFortuneKnowledgeDatabase(path);
  try {
    for (const method of knowledgeMethods) {
      const sourceEntries = catalog.entries.filter(entry => entry.category.method === method);
      const entries = db.exportEntries(method);
      assert.deepEqual(entries.map(entry => entry.id), sourceEntries.map(runtimeId));
      const legacyIds = new Set(sourceEntries.map(entry => entry.legacyId).filter(Boolean));
      const migrated = entries.filter(entry => legacyIds.has(entry.id));
      assert.equal(contentHash(migrated.map(({ reportTopic, ...entry }) => entry)), catalogContentHashes[method]);
      assert.deepEqual(db.advice(method), entries.filter(entry => entry.category.kind === '建议'));
      const library = db.library(method);
      assert.deepEqual(library.entries, entries.filter(entry => entry.category.kind === '解读'));
      const interpretations = sourceEntries.filter(entry => entry.category.contentType === '解读');
      const normalizedRules = library.rules.map(({ reportTopic, ...rule }) => ({ ...rule, unless: rule.unless ?? [] }));
      assert.deepEqual(normalizedRules, interpretations.map(entry => ({
        knowledgeId: runtimeId(entry),
        period: entry.category.period,
        ...(entry.matchConditions.status === 'mapped' ? entry.matchConditions.formatted
          : { queries: [], unless: [], unresolved: entry.matchConditions.formatted.unresolved,
            ...(entry.matchConditions.formatted.review && { review: entry.matchConditions.formatted.review }) }),
      })));
      for (const entry of sourceEntries) {
        assert.deepEqual(db.canonicalEntry(entry.id), entry);
        assert.equal(db.entry(runtimeId(entry)).id, runtimeId(entry));
      }
    }
    assert.equal(catalog.entries.length, 2624);
    assert.equal(db.entry('fortune-entry-865').reportTopic, 'wealth');
    assert.equal(db.entry('fortune-entry-866').reportTopic, 'overall');
    assert.equal(db.entry("' OR 1=1 --"), undefined);
    const { summary, byPeriod, advice, entries } = auditFortuneKnowledge(db);
    const interpretations = catalog.entries.filter(entry => entry.category.contentType === '解读');
    const mapped = interpretations.filter(entry => entry.matchConditions.status === 'mapped');
    const complete = mapped.filter(entry => !entry.matchConditions.formatted.unresolved.length).length;
    assert.equal(db.status().reduce((count, row) => count + row.registeredRules, 0), mapped.length);
    assert.deepEqual(summary, { entries: interpretations.length, complete, partial: mapped.length - complete,
      unsupported: interpretations.length - mapped.length });
    const sourceGroups = fixtureSource.readRaw();
    assert.deepEqual(Object.fromEntries(Object.entries(byPeriod).map(([period, counts]) => [period, counts.entries])),
      Object.fromEntries(knowledgePeriods.map(period => [period, sourceGroups[period].length])));
    assert.deepEqual(advice.summary, { entries: 228, available: 228, unsupported: 0 });
    const groups = groupRemainingFortuneRules(entries);
    assert.deepEqual(groups.flatMap(group => group.knowledgeIds).sort(),
      entries.filter(entry => entry.state !== 'complete').map(entry => entry.knowledgeId).sort());
    const batches = groupRemainingFortuneRules(entries, { bySource: true });
    assert.deepEqual(batches.flatMap(batch => batch.knowledgeIds).sort(),
      groups.flatMap(group => group.knowledgeIds).sort());
    const ptolemy = batches.find(batch => batch.rules.some(rule => rule.id === 326));
    assert.ok([323, 324, 325, 327].every(id => ptolemy.rules.some(rule => rule.id === id)));
    assert.ok(ptolemy.rules.every(rule => rule.source.url.startsWith(ptolemy.document) && rule.factTypes.length > 0));
    assert.equal(batches.reduce((count, batch) => count + batch.withoutConfirmedRoute, 0),
      entries.filter(entry => entry.state !== 'complete' && !entry.hasConfirmedRoute).length);
    const queue = groupRemainingFortuneRules(entries, { bySource: true, sameFacts: true });
    assert.deepEqual(queue.flatMap(batch => batch.knowledgeIds).sort(), groups.flatMap(group => group.knowledgeIds).sort());
    for (const { book, document, factTypes, rules } of queue) {
      assert.ok(rules.every(rule => rule.source.book === book && (!rule.source.url || rule.source.url.startsWith(document))));
      for (const rule of rules) assert.deepEqual(rule.factTypes, factTypes);
    }
    assert.ok(groups.every((group, index) => group.count === group.knowledgeIds.length
      && (index === 0 || groups[index - 1].count >= group.count)));
    const entriesById = new Map(entries.map(entry => [entry.knowledgeId, entry]));
    for (const group of groups) {
      assert.deepEqual(group.rules.map(rule => rule.knowledgeId), group.knowledgeIds);
      for (const rule of group.rules) {
        const entry = entriesById.get(rule.knowledgeId);
        const source = db.canonicalEntry(rule.id);
        assert.equal(group.method, entry.method);
        assert.deepEqual(group.factTypes, entry.factTypes.toSorted());
        assert.equal(runtimeId(source), rule.knowledgeId);
        assert.equal(rule.source.book, source.source.book);
        assert.equal(rule.source.locator, source.source.locator);
        assert.equal(rule.period, source.category.period);
        assert.deepEqual(rule.remainingConditions, entry.remainingConditions);
      }
    }
  } finally { db.close(); }
  const readonly = new DatabaseSync(path, { readOnly: true });
  try {
    assert.deepEqual(readonly.prepare('SELECT name FROM source_file').all().map(row => row.name), [sourceName]);
    const storedIds = readonly.prepare('SELECT id, runtime_id, typeof(id) AS storage_type FROM knowledge_entry ORDER BY id').all();
    assert.deepEqual(storedIds.map(row => row.id), catalog.entries.map(entry => entry.id));
    assert.deepEqual(storedIds.map(row => row.runtime_id), catalog.entries.map(runtimeId));
    assert.ok(storedIds.every(row => row.storage_type === 'integer'));
    assert.equal(readonly.prepare('SELECT DISTINCT typeof(knowledge_id) AS type FROM rule_predicate').get().type, 'integer');
    assert.equal(readonly.prepare('SELECT DISTINCT typeof(knowledge_id) AS type FROM advice_theme_entry').get().type, 'integer');
    assert.throws(() => readonly.exec('DELETE FROM knowledge_entry'), /readonly/u);
  }
  finally { readonly.close(); }
}));

test('both Zi Ping officer rules use one confirmed same-stage route fact', () => fixture(options => {
  const db = openFortuneKnowledgeDatabase(ensureFortuneKnowledgeDatabase(options));
  const fact = (fields, scope = 'decadal') => ({
    factType: 'zpqz_month_command', scope, completeness: 'complete',
    normalizedPayload: { profile: 'zpqz-month-command-exposure-atomic-v1', confirmed: true, timeKnown: true,
      jiaYouMonth: true, xinExposed: true, liuSourceOfficerStrong: false, youOfficerSourceBenefitsMetal: false, ...fields },
  });
  try {
    for (const [id, routes] of consolidatedRoutes) {
      const { legacyId } = db.canonicalEntry(id);
      const outcome = facts => db.evaluateRules('bazi', 'year', facts).find(rule => rule.knowledgeId === legacyId).required[0];
      const trueRoutes = routes.map(route => fact({ youOfficerRoutes: [route] }));
      const unrelatedRoute = fact({ youOfficerRoutes: ['unrelated'] });
      const wrongScope = fact({ youOfficerRoutes: [routes[0]] }, 'yearly');
      const wrongMonth = fact({ jiaYouMonth: false, youOfficerRoutes: [routes[0]] });
      const noVerifiedRoute = fact({ youOfficerRoutes: [] });
      assert.deepEqual(outcome([...trueRoutes, unrelatedRoute, wrongScope, wrongMonth]).hits, trueRoutes);
      const rejected = outcome([wrongMonth, noVerifiedRoute]);
      assert.deepEqual(rejected.hits, []);
      assert.equal(rejected.unknown, false);
      const separateFacts = outcome([fact({}), fact({ confirmed: false, youOfficerRoutes: [routes[0]] })]);
      assert.deepEqual(separateFacts.hits, []);
      assert.equal(separateFacts.unknown, true);
      const noNatalXin = fact({ xinExposed: false, youOfficerRoutes: ['geng-killer'] });
      assert.deepEqual(outcome([noNatalXin]).hits, id === 99 ? [] : [noNatalXin]);
      const strongSource = fact({ liuSourceOfficerStrong: true, youOfficerRoutes: ['geng-killer'] });
      assert.deepEqual(outcome([strongSource]).hits, id === 99 ? [] : [strongSource]);
      const unreviewedSource = fact({ liuSourceOfficerStrong: undefined, youOfficerRoutes: ['geng-killer'] });
      assert.equal(outcome([unreviewedSource]).unknown, id === 99);
      const benefitingFromMetal = fact({ youOfficerSourceBenefitsMetal: true, youOfficerRoutes: ['geng-killer'] });
      assert.deepEqual(outcome([benefitingFromMetal]).hits, id === 100 ? [] : [benefitingFromMetal]);
      const missingMetalReview = fact({ youOfficerSourceBenefitsMetal: undefined, youOfficerRoutes: ['geng-killer'] });
      assert.equal(outcome([missingMetalReview]).unknown, id === 100);
    }
  } finally { db.close(); }
}));

test('runtime queries continue with the JSON catalog unavailable and source updates build a new catalog', () => fixture((options, fixtureSource) => {
  const firstPath = ensureFortuneKnowledgeDatabase(options);
  const catalog = fixtureSource.read();
  const entry = firstBaziInterpretation(catalog);
  const reviewed = printedLuckEntry(catalog);
  entry.legacy.title += '（更新测试）';
  fixtureSource.write(catalog);
  const secondPath = ensureFortuneKnowledgeDatabase(options);
  assert.notEqual(secondPath, firstPath);
  renameSync(options.sourceDirectory, options.sourceDirectory + '-unavailable');
  const first = openFortuneKnowledgeDatabase(firstPath), second = openFortuneKnowledgeDatabase(secondPath);
  try {
    assert.notEqual(first.entry(entry.legacyId).title, entry.legacy.title);
    assert.equal(second.entry(entry.legacyId).title, entry.legacy.title);
    assert.notEqual(first.library('bazi').version, second.library('bazi').version);
    assert.equal(first.library('ziwei').version, second.library('ziwei').version);
    assert.equal(second.library('bazi').entries.length, first.library('bazi').entries.length);
    assert.equal(second.advice('western').length, 184);
    assert.deepEqual(second.printedLuck(reviewed.legacyId), reviewed.matchConditions.formatted.review.printedLuck);
    assert.deepEqual(second.printedLuck('unregistered'), []);
    assert.deepEqual(second.matchSelectedAdvice('houtian-kan').map(row => row.entry.interpretation.advice.options), [['1']]);
    assert.deepEqual(second.matchNatalAdvice('element', '水').length, 3);
  } finally { first.close(); second.close(); }
}));

test('the dependency on valid original pillars is checked during SQLite import', () => fixture((options, fixtureSource) => {
  const valid = ensureFortuneKnowledgeDatabase(options);
  const catalog = fixtureSource.read();
  const reviewed = printedLuckEntry(catalog);
  reviewed.matchConditions.formatted.review.printedLuck[0].periods[0].pillars.push('壬亥');
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Invalid printed luck review/u);
  const original = openFortuneKnowledgeDatabase(valid);
  try { assert.ok(original.printedLuck(reviewed.legacyId).length); }
  finally { original.close(); }
}));

test('SQLite resolves each indexed condition, exclusion and confirmation after the JSON catalog is removed', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const entry = firstBaziInterpretation(catalog);
  const rule = entry.matchConditions.formatted;
  const period = entry.category.period;
  const conjunction = { factType: 'test_contact', scope: 'daily', scopes: ['daily', 'natal'],
    where: { enabled: true }, anyOf: [{ members: { includes: 'year' } }, { count: { gte: 2 } }] };
  const companion = { factType: 'test_companion', where: { kind: { oneOf: ['day', 'month'] } } };
  const exclusion = { factType: 'test_exclusion', where: { active: true } };
  const confirmation = { factType: 'test_contact', scope: 'daily', where: { documented: true }, sourceConditions: ['原文明确的条件'] };
  const competing = { ...confirmation, where: { documented: false }, sourceConditions: ['另一个原文明确的条件'] };
  rule.queries = [conjunction, companion];
  rule.unless = [exclusion];
  rule.unresolved = ['confirmed evidence covers one case'];
  rule.confirmedWhen = [confirmation, competing];
  fixtureSource.write(catalog);

  const path = ensureFortuneKnowledgeDatabase(options);
  renameSync(options.sourceDirectory, options.sourceDirectory + '-unavailable');
  const db = openFortuneKnowledgeDatabase(path);
  const fact = (factType, normalizedPayload, scope = 'daily', completeness = 'complete') =>
    ({ factType, scope, completeness, normalizedPayload });
  const members = fact('test_contact', { enabled: true, members: ['year'], count: 0, documented: true });
  const threshold = fact('test_contact', { enabled: true, members: [], count: 2, documented: false });
  const wrongScope = fact('test_contact', { enabled: true, members: ['year'], count: 0 }, 'natal');
  const partial = fact('test_contact', { enabled: true, members: ['year'], count: 2 }, 'daily', 'partial');
  const falseBase = fact('test_contact', { enabled: false, members: ['year'], count: 6 });
  const blocked = fact('test_exclusion', { active: true });
  const wrongCompanion = fact('test_companion', { kind: 'year' });
  const find = (method, period, facts) =>
    db.evaluateRules(method, period, facts).find(item => item.knowledgeId === entry.legacyId);
  try {
    const result = find('bazi', period, [members, wrongScope, wrongCompanion, partial, threshold, falseBase, blocked]);
    assert.deepEqual(result.required, [
      { condition: JSON.stringify(conjunction), hits: [members, threshold], unknown: true },
      { condition: JSON.stringify(companion), hits: [], unknown: false },
    ]);
    assert.deepEqual(result.exclusions, [{ condition: JSON.stringify(exclusion), hits: [blocked], unknown: false }]);
    assert.deepEqual(result.confirmations, [
      { condition: JSON.stringify(confirmation), hits: [members], unknown: true, sourceConditions: confirmation.sourceConditions },
      { condition: JSON.stringify(competing), hits: [threshold], unknown: true, sourceConditions: competing.sourceConditions },
    ]);
    assert.ok(find('bazi', period, []).required.every(result => result.unknown && !result.hits.length));
    assert.deepEqual(find('bazi', period === 'day' ? 'year' : 'day', [members]).required, []);
    assert.equal(find('ziwei', period, [members]), undefined);
  } finally { db.close(); }
}));

test('confirmation excerpts must come from the original or a reviewed excerpt of the same source', () => fixture((_, fixtureSource) => {
  const catalog = fixtureSource.read();
  const entry = firstBaziInterpretation(catalog);
  const rule = entry.matchConditions.formatted;
  const sourceExcerpt = entry.originalText.slice(0, 3);
  const branch = { ...rule.queries[0], sourceConditions: ['已核原文条件'], sourceExcerpt };
  rule.unresolved = ['原文的较宽范围仍待核'];
  const parse = () => parseFortuneKnowledgeManifest(JSON.stringify({ ...catalog, schemaVersion: 1 }));
  rule.confirmedWhen = branch;
  assert.equal(parse().entries.find(row => row.id === entry.id).matchConditions.formatted.confirmedWhen.sourceExcerpt, sourceExcerpt);
  rule.confirmedWhen = [branch, { ...branch, sourceExcerpt: undefined }];
  assert.throws(parse, /Invalid fortune knowledge confirmation excerpt/u);
  rule.confirmedWhen = { ...branch, sourceExcerpt: '来源未包含的任意新内容' };
  assert.throws(parse, /Invalid fortune knowledge confirmation excerpt/u);
  const ptolemy = catalog.entries.find(row => row.id === 326);
  const { review, confirmedWhen } = ptolemy.matchConditions.formatted;
  rule.confirmedWhen = branch;
  const [original, reversal] = confirmedWhen;
  assert.ok(!ptolemy.originalText.includes(reversal.sourceExcerpt));
  assert.equal(original.sourceExcerpt, ptolemy.originalText);
  assert.equal(parse().entries.find(row => row.id === ptolemy.id).matchConditions.formatted.confirmedWhen[1].sourceExcerpt,
    reversal.sourceExcerpt);
  const excerpts = review.additionalSourceExcerpts;
  review.additionalSourceExcerpts = ['完全不同的已核来源短引'];
  assert.throws(parse, /Invalid fortune knowledge confirmation excerpt/u);
  review.additionalSourceExcerpts = excerpts;
  const url = ptolemy.source.url;
  ptolemy.source.url = null;
  assert.throws(parse, /Invalid fortune knowledge additional source excerpts/u);
  ptolemy.source.url = url;
  rule.confirmedWhen = [];
  assert.throws(parse, /Invalid fortune knowledge confirmation/u);
  delete rule.confirmedWhen;
  rule.sourceConditions = ['仅可在完整映射时采用的原文条件'];
  assert.throws(parse, /Invalid fortune knowledge source conditions/u);
}));

test('SQLite isolates traditional shichen, clock-hour, daily and weekly rules', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const firstId = nextId(catalog);
  const additions = [
    { id: firstId, period: 'hour', hourBasis: 'shichen', scope: 'hourly' },
    { id: firstId + 1, period: 'hour', hourBasis: 'clockHour', scope: 'hourly' },
    { id: firstId + 2, period: 'day', scope: 'daily' },
    { id: firstId + 3, period: 'week', scope: 'daily' },
  ].map(({ id, period, hourBasis, scope }) => ({
    id,
    source: { book: '测试来源', locator: '测试周期', url: null },
    category: { method: 'bazi', topic: 'overall', period, contentType: '解读', ...(hourBasis ? { hourBasis } : {}) },
    originalText: '测试引文',
    matchConditions: { status: 'mapped', original: ['测试条件'],
      formatted: { queries: [{ factType: 'test_period', scope, where: { enabled: true } }], unless: [], unresolved: [] } },
    modernInterpretation: '测试释义',
  }));
  catalog.entries.push(...additions);
  fixtureSource.write(catalog);
  const db = openFortuneKnowledgeDatabase(ensureFortuneKnowledgeDatabase(options));
  const hourly = { factType: 'test_period', scope: 'hourly', completeness: 'complete', normalizedPayload: { enabled: true } };
  const daily = { ...hourly, scope: 'daily' };
  const evaluated = (entry, period, facts, basis) => db.evaluateRules('bazi', period, facts, basis)
    .find(rule => rule.knowledgeId === 'fortune-entry-' + entry.id);
  try {
    for (const entry of additions.slice(0, 2)) {
      const { hourBasis } = entry.category;
      const evaluatedHour = evaluated(entry, 'hour', [daily, hourly], hourBasis);
      assert.equal(db.canonicalEntry(entry.id).category.hourBasis, hourBasis);
      assert.equal(evaluatedHour.hourBasis, hourBasis);
      assert.deepEqual(evaluatedHour.required[0].hits, [hourly]);
      const otherBasis = hourBasis === 'shichen' ? 'clockHour' : 'shichen';
      assert.deepEqual(evaluated(entry, 'hour', [hourly], otherBasis).required, []);
      assert.deepEqual(evaluated(entry, 'day', [daily, hourly]).required, []);
    }
    const [, , dayEntry, weekEntry] = additions;
    assert.deepEqual(evaluated(dayEntry, 'hour', [daily, hourly], 'shichen').required, []);
    assert.deepEqual(evaluated(dayEntry, 'day', [daily, hourly]).required[0].hits, [daily]);
    assert.deepEqual(evaluated(weekEntry, 'week', [daily, hourly]).required[0].hits, [daily]);
    assert.deepEqual(evaluated(dayEntry, 'week', [daily, hourly]).required, []);
    assert.deepEqual(evaluated(weekEntry, 'day', [daily, hourly]).required, []);
  } finally { db.close(); }
  delete additions[0].category.hourBasis;
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /hour|knowledge entry/iu);
}));

test('each grouped interpretation must declare the period of its own collection', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.readRaw();
  catalog.week.push(catalog.day.pop());
  fixtureSource.writeRaw(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Invalid fortune knowledge collection: week/u);
}));

test('a duplicate numeric ID is rejected and leaves the previous catalog usable', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const path = ensureFortuneKnowledgeDatabase(options);
  const interpretationCounts = knowledgeMethods.map(method => catalog.entries
    .filter(entry => entry.category.method === method && entry.category.contentType === '解读').length);
  const existing = firstBaziInterpretation(catalog);
  const duplicate = { ...existing, legacyId: existing.legacyId + '-duplicate' };
  catalog.entries.push(duplicate);
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Invalid fortune knowledge entry/u);
  const db = openFortuneKnowledgeDatabase(path);
  try {
    assert.deepEqual(knowledgeMethods.map(method => db.library(method).entries.length), interpretationCounts);
    assert.deepEqual(knowledgeMethods.map(method => db.advice(method).length), [30, 14, 184]);
    assert.deepEqual(db.canonicalEntry(existing.id), existing);
  } finally { db.close(); }
}));

test('the advice index excludes ungrouped entries and rejects invalid references or stale reviews', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const advised = catalog.entries.find(entry => entry.category.method === 'bazi' && entry.category.contentType === '建议');
  const newEntry = structuredClone(advised);
  newEntry.id = nextId(catalog);
  newEntry.legacyId = advised.legacyId + '-ungrouped-fixture';
  delete newEntry.legacy.adviceSourceHash;
  catalog.entries.push(newEntry);
  fixtureSource.write(catalog);
  const built = openFortuneKnowledgeDatabase(ensureFortuneKnowledgeDatabase(options));
  try {
    assert.deepEqual(auditFortuneKnowledge(built).advice.summary, { entries: 229, available: 228, unsupported: 1 });
    assert.ok(built.advice('bazi').some(entry => entry.id === newEntry.legacyId));
    const group = catalog.adviceGroups.find(group => group.method === 'bazi');
    group.themes[0].entryIds.push(firstBaziInterpretation(catalog).id);
    fixtureSource.write(catalog);
    assert.throws(() => ensureFortuneKnowledgeDatabase(options), /advice.*entry/iu);
    group.themes[0].entryIds.pop();
    advised.legacy.normalized.push('新增来源条件');
    fixtureSource.write(catalog);
    assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Fortune advice source review is stale/u);
    assert.equal(built.matchSelectedAdvice('houtian-kan').length, 1);
  } finally { built.close(); }
}));

test('a corrupted existing SQLite artifact fails explicitly without switching business queries back to JSON', () => fixture(options => {
  const path = ensureFortuneKnowledgeDatabase(options);
  writeFileSync(path, 'invalid database');
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /database|SQLite/iu);
}));

test('an unmapped draft is saved but only participates in SQLite matching once mapped', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const query = { factType: 'test_activation', scope: 'yearly', where: { enabled: true } };
  const fact = { factType: query.factType, scope: query.scope, completeness: 'complete', normalizedPayload: { enabled: true } };
  const entry = {
    id: nextId(catalog),
    source: { book: '测试来源', locator: '测试位置', url: null },
    category: { method: 'bazi', topic: 'overall', period: 'year', contentType: '解读' },
    originalText: '尚未审核的引文',
    matchConditions: { status: 'unmapped', original: ['尚未审核的条件'],
      formatted: { queries: [query], unless: [], unresolved: [] } },
    modernInterpretation: null,
  };
  catalog.entries.push(entry);
  fixtureSource.write(catalog);
  const runtimeId = 'fortune-entry-' + entry.id;
  const path = ensureFortuneKnowledgeDatabase(options);
  const db = openFortuneKnowledgeDatabase(path);
  const evaluate = database => database.evaluateRules('bazi', 'year', [fact]).find(rule => rule.knowledgeId === runtimeId);
  const audit = database => auditFortuneKnowledge(database).entries.find(row => row.knowledgeId === runtimeId);
  try {
    const rule = db.library('bazi').rules.find(rule => rule.knowledgeId === runtimeId);
    assert.deepEqual(rule.queries, []);
    assert.ok(rule.unresolved.includes(entry.matchConditions.original[0]));
    assert.equal(evaluate(db).queryCount, 0);
    assert.deepEqual(evaluate(db).required, []);
    assert.equal(audit(db).status, 'unmapped');
    assert.equal(audit(db).state, 'unsupported');
    assert.equal(db.entry(runtimeId).id, runtimeId);
    assert.deepEqual(db.canonicalEntry(entry.id), entry);
  } finally { db.close(); }

  entry.matchConditions.status = 'mapped';
  fixtureSource.write(catalog);
  const mappedPath = ensureFortuneKnowledgeDatabase(options);
  assert.notEqual(mappedPath, path);
  const mapped = openFortuneKnowledgeDatabase(mappedPath);
  try {
    assert.deepEqual(evaluate(mapped).required[0].hits, [fact]);
    assert.equal(audit(mapped).status, 'mapped');
    assert.equal(audit(mapped).state, 'complete');
  } finally { mapped.close(); }

  entry.matchConditions.formatted.queries = [];
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Invalid fortune knowledge rule status/u);
}));

test('an active mapping requires original evidence and detects changes to a reviewed predicate', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const draft = catalog.entries.find(entry => entry.id === 1044);
  draft.matchConditions.status = 'mapped';
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /requires original text and conditions/u);
  draft.matchConditions.status = 'unmapped';
  const reviewed = catalog.entries.find(entry => entry.id === 2229);
  reviewed.matchConditions.formatted.queries[0].where.yearStem = '辛';
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /reviewed rule conditions changed/u);
}));

test('a reviewed mapping must be rechecked when its source conditions or evidence change', () => fixture((options, fixtureSource) => {
  const path = ensureFortuneKnowledgeDatabase(options);
  const catalog = fixtureSource.read();
  const entry = catalog.entries.find(row => row.legacyId.includes('interpretation-expansion-p002-'));
  entry.legacy.normalized.push('新增条件：必须重新审核映射。');
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /source review is stale/u);
  const db = openFortuneKnowledgeDatabase(path);
  try { assert.equal(db.entry(entry.legacyId).conditions.normalized.length, entry.legacy.normalized.length - 1); }
  finally { db.close(); }
}));

test('malformed alternative query groups are rejected before publishing the SQLite runtime catalog', () => fixture((options, fixtureSource) => {
  const catalog = fixtureSource.read();
  const entry = catalog.entries.find(row => row.category.method === 'western' && row.matchConditions.formatted.queries.length);
  entry.matchConditions.formatted.queries[0].anyOf = [];
  fixtureSource.write(catalog);
  assert.throws(() => ensureFortuneKnowledgeDatabase(options), /Invalid fortune knowledge query/u);
}));
