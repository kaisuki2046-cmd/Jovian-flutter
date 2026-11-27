import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { evaluateFortunePredicate } from '../../control/knowledge/predicate.mjs';
import { buildFortuneAdviceIndex, readFortuneAdviceIndex } from './advice-index.mjs';
import { digest, interpretationRule, knowledgeManifestFile, knowledgeMethods, parseFortuneKnowledgeManifest,
  runtimeId, runtimeTopic, toRuntimeKnowledgeEntry } from './manifest.mjs';

export { knowledgeMethods } from './manifest.mjs';
export const knowledgeSourceDirectory = fileURLToPath(new URL('../../model/knowledge/', import.meta.url));
export const knowledgeDatabaseDirectory = fileURLToPath(new URL('./.local/', import.meta.url));
const schemaVersion = 8;

function writeDatabase(path, bytes, manifestHash, sourceHash) {
  const { entries, adviceGroups } = parseFortuneKnowledgeManifest(bytes);
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      BEGIN IMMEDIATE;
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE source_file (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL) STRICT;
      CREATE TABLE library (method TEXT PRIMARY KEY, version TEXT NOT NULL) STRICT;
      CREATE TABLE knowledge_entry (
        id INTEGER PRIMARY KEY, runtime_id TEXT NOT NULL UNIQUE, method TEXT NOT NULL REFERENCES library(method),
        kind TEXT NOT NULL CHECK (kind IN ('解读', '建议')),
        topic TEXT NOT NULL CHECK (topic IN ('overall', 'wealth', 'romance')),
        advice_kind TEXT, source_order INTEGER NOT NULL, payload TEXT NOT NULL CHECK (json_valid(payload)),
        UNIQUE(method, source_order)
      ) STRICT;
      CREATE INDEX entry_lookup ON knowledge_entry(method, kind, advice_kind, source_order);
      CREATE TABLE match_rule (
        knowledge_id INTEGER PRIMARY KEY REFERENCES knowledge_entry(id),
        period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month', 'year', 'hour')),
        hour_basis TEXT,
        mapped INTEGER NOT NULL CHECK (mapped IN (0, 1)), payload TEXT NOT NULL CHECK (json_valid(payload)),
        CHECK ((period = 'hour' AND hour_basis IS NOT NULL AND hour_basis IN ('shichen', 'clockHour'))
          OR (period <> 'hour' AND hour_basis IS NULL))
      ) STRICT;
      CREATE INDEX rule_period ON match_rule(period, hour_basis, mapped);
      CREATE TABLE match_predicate (
        id INTEGER PRIMARY KEY, method TEXT NOT NULL REFERENCES library(method),
        fact_type TEXT NOT NULL, scope TEXT, scopes TEXT, payload TEXT NOT NULL CHECK (json_valid(payload)),
        UNIQUE(method, payload)
      ) STRICT;
      CREATE INDEX predicate_fact ON match_predicate(method, fact_type);
      CREATE TABLE rule_predicate (
        knowledge_id INTEGER NOT NULL REFERENCES match_rule(knowledge_id),
        role INTEGER NOT NULL CHECK (role IN (0, 1, 2)), ordinal INTEGER NOT NULL,
        predicate_id INTEGER NOT NULL REFERENCES match_predicate(id),
        PRIMARY KEY (knowledge_id, role, ordinal)
      ) STRICT;
    `);
    const metadata = db.prepare('INSERT INTO metadata VALUES (?, ?)');
    metadata.run('schema_version', String(schemaVersion));
    metadata.run('source_hash', sourceHash);
    metadata.run('advice_hash', digest(JSON.stringify({
      adviceGroups, entries: entries.filter(entry => entry.category.contentType === '建议'),
    })));
    db.prepare('INSERT INTO source_file VALUES (?, ?)').run(knowledgeManifestFile, manifestHash);
    const library = db.prepare('INSERT INTO library VALUES (?, ?)');
    const entryStatement = db.prepare('INSERT INTO knowledge_entry VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const ruleStatement = db.prepare('INSERT INTO match_rule VALUES (?, ?, ?, ?, ?)');
    const predicateStatement = db.prepare('INSERT INTO match_predicate(method, fact_type, scope, scopes, payload) VALUES (?, ?, ?, ?, ?)');
    const linkStatement = db.prepare('INSERT INTO rule_predicate VALUES (?, ?, ?, ?)');
    for (const method of knowledgeMethods) {
      const methodEntries = entries.filter(entry => entry.category.method === method);
      const versionHash = digest(JSON.stringify(methodEntries.filter(entry => entry.category.contentType === '解读')));
      library.run(method, 'fortune-knowledge-v1-' + versionHash);
      const predicates = new Map();
      methodEntries.forEach((entry, position) => {
        const { contentType, topic, period, hourBasis } = entry.category;
        entryStatement.run(entry.id, runtimeId(entry), method, contentType, topic,
          entry.advice?.kind ?? null, position, JSON.stringify(entry));
        if (contentType !== '解读') return;
        const { mapped, payload: rule } = interpretationRule(entry);
        ruleStatement.run(entry.id, period, hourBasis ?? null, Number(mapped), JSON.stringify(rule));
        const confirmations = Array.isArray(rule.confirmedWhen) ? rule.confirmedWhen : rule.confirmedWhen ? [rule.confirmedWhen] : [];
        for (const [role, queries] of [rule.queries, rule.unless ?? [], confirmations].entries()) {
          for (const [ordinal, query] of queries.entries()) {
            const payload = JSON.stringify(query);
            let predicateId = predicates.get(payload);
            if (predicateId === undefined) {
              predicateId = predicateStatement.run(method, query.factType, query.scope ?? null,
                query.scopes ? JSON.stringify(query.scopes) : null, payload).lastInsertRowid;
              predicates.set(payload, predicateId);
            }
            linkStatement.run(entry.id, role, ordinal, predicateId);
          }
        }
      });
    }
    buildFortuneAdviceIndex(db, adviceGroups, entries);
    db.exec('COMMIT');
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('Fortune SQLite integrity check failed');
    }
  } finally { db.close(); }
}

export function ensureFortuneKnowledgeDatabase({ sourceDirectory = knowledgeSourceDirectory,
  directory = knowledgeDatabaseDirectory } = {}) {
  const bytes = readFileSync(join(sourceDirectory, knowledgeManifestFile));
  const manifestHash = digest(bytes);
  const sourceHash = digest(JSON.stringify({ schemaVersion, manifestHash }));
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `fortune-${sourceHash}.sqlite`);
  if (!existsSync(path)) {
    const temporary = join(directory, `build-${randomUUID()}.sqlite`);
    try {
      writeDatabase(temporary, bytes, manifestHash, sourceHash);
      try { renameSync(temporary, path); }
      catch (error) { if (!existsSync(path)) throw error; }
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
  // A damaged artifact must not silently fall back to JSON.
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (db.prepare('SELECT value FROM metadata WHERE key = ?').get('source_hash')?.value !== sourceHash
      || db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version')?.value !== String(schemaVersion)
      || db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Invalid fortune SQLite catalog');
  } finally { db.close(); }
  return path;
}

export function openFortuneKnowledgeDatabase(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  const selectEntries = db.prepare('SELECT payload FROM knowledge_entry WHERE method = ? AND kind = ? ORDER BY source_order');
  const selectMethodEntries = db.prepare('SELECT payload FROM knowledge_entry WHERE method = ? ORDER BY source_order');
  const selectEntry = db.prepare('SELECT payload FROM knowledge_entry WHERE runtime_id = ?');
  const selectCanonicalEntry = db.prepare('SELECT payload FROM knowledge_entry WHERE id = ?');
  const selectInterpretationSources = db.prepare(`SELECT id, runtime_id, json_extract(payload, '$.source.locator') AS locator
    FROM knowledge_entry WHERE kind = '解读'`);
  const selectRules = db.prepare(`SELECT r.payload FROM match_rule r JOIN knowledge_entry e ON e.id = r.knowledge_id
    WHERE e.method = ? ORDER BY e.source_order`);
  const selectVersion = db.prepare('SELECT version FROM library WHERE method = ?');
  const selectPrintedLuck = db.prepare(`SELECT json_extract(r.payload, '$.review.printedLuck') AS rows
    FROM match_rule r JOIN knowledge_entry e ON e.id = r.knowledge_id WHERE e.runtime_id = ? AND r.mapped = 1`);
  function version(method) {
    const row = selectVersion.get(method);
    if (!row) throw new Error('Unknown fortune knowledge method');
    return row.version;
  }
  const parseRow = row => JSON.parse(row.payload);
  const readEntry = row => toRuntimeKnowledgeEntry(parseRow(row));
  const selectRuleIndex = db.prepare(`SELECT e.runtime_id, e.topic, r.period, r.hour_basis,
    json_extract(e.payload, '$.legacy.topic') AS legacy_topic,
    json_array_length(r.payload, '$.queries') AS query_count,
    json_extract(r.payload, '$.unresolved') AS unresolved,
    json_extract(r.payload, '$.sourceConditions') AS source_conditions
    FROM knowledge_entry e JOIN match_rule r ON r.knowledge_id = e.id
    WHERE e.method = ? ORDER BY e.source_order`);
  const predicates = new Map();
  let activeFacts = [];
  // Node SQLite executes synchronously. The SQL statement only sees fact positions and
  // index keys; the evaluator reads the original typed payload from this request.
  db.function('fortune_predicate', (position, payload) => {
    if (!predicates.has(payload)) predicates.set(payload, JSON.parse(payload));
    const result = evaluateFortunePredicate(activeFacts[position], predicates.get(payload));
    return result === undefined ? null : Number(result);
  });
  const selectEvaluations = db.prepare(`
    WITH current_slots AS MATERIALIZED (
      SELECT e.runtime_id, rp.role, rp.ordinal, rp.predicate_id FROM knowledge_entry e
      JOIN match_rule r ON r.knowledge_id = e.id
      JOIN rule_predicate rp ON rp.knowledge_id = r.knowledge_id
      WHERE e.method = ? AND r.period = ? AND (r.period <> 'hour' OR r.hour_basis = ?)
        AND r.mapped = 1
    ), exclusion_predicates AS MATERIALIZED (
      SELECT DISTINCT predicate_id FROM current_slots WHERE role = 1
    ), tested AS MATERIALIZED (
      SELECT p.id, CAST(f.key AS INTEGER) AS fact_position, fortune_predicate(f.key, p.payload) AS outcome
      FROM json_each(?) f
      CROSS JOIN match_predicate p INDEXED BY predicate_fact
      WHERE p.method = ? AND p.fact_type = json_extract(f.value, '$[0]')
        AND (p.scope IS NULL OR p.scope = json_extract(f.value, '$[1]'))
        AND (p.scopes IS NULL OR EXISTS (
          SELECT 1 FROM json_each(p.scopes) s WHERE s.value = json_extract(f.value, '$[1]')
        ))
        AND p.id IN (SELECT predicate_id FROM current_slots)
    ), outcomes AS (
      SELECT id,
        json_group_array(fact_position ORDER BY fact_position) FILTER (WHERE outcome = 1) AS hits,
        max(outcome IS NULL) AS unknown,
        json_group_array(fact_position ORDER BY fact_position)
          FILTER (WHERE outcome IS NULL AND id IN (SELECT predicate_id FROM exclusion_predicates)) AS uncertain_facts,
        json_group_array(fact_position ORDER BY fact_position)
          FILTER (WHERE outcome = 0 AND id IN (SELECT predicate_id FROM exclusion_predicates)) AS non_excluding_facts
      FROM tested GROUP BY id
    )
    SELECT slot.runtime_id, slot.role, p.payload AS condition,
      coalesce(o.hits, '[]') AS hits, coalesce(o.unknown, 1) AS unknown,
      coalesce(o.uncertain_facts, '[]') AS uncertain_facts, coalesce(o.non_excluding_facts, '[]') AS non_excluding_facts
    FROM current_slots slot JOIN match_predicate p ON p.id = slot.predicate_id
    LEFT JOIN outcomes o ON o.id = p.id
    ORDER BY slot.role, slot.ordinal
  `);
  return {
    ...readFortuneAdviceIndex(db, readEntry),
    version,
    library(method) {
      return { version: version(method), entries: selectEntries.all(method, '解读').map(readEntry), rules: selectRules.all(method).map(parseRow) };
    },
    advice(method) { return selectEntries.all(method, '建议').map(readEntry); },
    entry(id) { const row = selectEntry.get(id); return row ? readEntry(row) : undefined; },
    canonicalEntry(id) { const row = selectCanonicalEntry.get(id); return row ? parseRow(row) : undefined; },
    interpretationSources() {
      return new Map(selectInterpretationSources.all().map(({ runtime_id, id, locator }) => [runtime_id, { id, locator }]));
    },
    printedLuck(id) { const { rows } = selectPrintedLuck.get(id) ?? {}; return rows ? JSON.parse(rows) : []; },
    evaluateRules(method, period, facts, hourBasis) {
      const rules = new Map(selectRuleIndex.all(method).map(row => [row.runtime_id, {
        knowledgeId: row.runtime_id, topic: runtimeTopic(row.topic, row.legacy_topic), reportTopic: row.topic, period: row.period,
        ...(row.hour_basis ? { hourBasis: row.hour_basis } : {}),
        queryCount: row.query_count, unresolved: JSON.parse(row.unresolved), required: [], exclusions: [], confirmations: [],
        ...(row.source_conditions === null ? {} : { sourceConditions: JSON.parse(row.source_conditions) }),
      }]));
      const factKeys = JSON.stringify(facts.map(({ factType, scope }) => [factType, scope]));
      activeFacts = facts;
      try {
        for (const row of selectEvaluations.iterate(method, period, hourBasis ?? null, factKeys, method)) {
          const rule = rules.get(row.runtime_id);
          const evaluation = { condition: row.condition, hits: JSON.parse(row.hits).map(index => facts[index]), unknown: Boolean(row.unknown) };
          if (row.role === 2) {
            const { sourceConditions, sourceExcerpt } = JSON.parse(row.condition);
            rule.confirmations.push({ ...evaluation, sourceConditions, ...(sourceExcerpt !== undefined ? { sourceExcerpt } : {}) });
          } else if (row.role === 1) {
            rule.exclusions.push(evaluation.unknown ? { ...evaluation,
              uncertainFacts: JSON.parse(row.uncertain_facts).map(index => facts[index]),
              nonExcludingFacts: JSON.parse(row.non_excluding_facts).map(index => facts[index]),
            } : evaluation);
          } else rule.required.push(evaluation);
        }
      } finally { activeFacts = []; }
      return [...rules.values()];
    },
    exportEntries(method) { return selectMethodEntries.all(method).map(readEntry); },
    status() { return db.prepare(`SELECT e.method, e.kind, count(*) AS entries,
      sum(CASE WHEN r.mapped = 1 THEN 1 ELSE 0 END) AS registeredRules
      FROM knowledge_entry e LEFT JOIN match_rule r ON r.knowledge_id = e.id GROUP BY e.method, e.kind ORDER BY e.method, e.kind`).all(); },
    close() { db.close(); },
  };
}
