const fortuneKnowledgeSchema = r'''PRAGMA foreign_keys = ON;
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
        CREATE TABLE advice_group (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, method TEXT NOT NULL REFERENCES library(method),
      natal_field TEXT, source_order INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE advice_theme (
      id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES advice_group(id), label TEXT NOT NULL,
      natal_value TEXT, source_order INTEGER NOT NULL, UNIQUE(group_id, natal_value)
    ) STRICT;
    CREATE INDEX advice_natal ON advice_theme(natal_value);
    CREATE TABLE advice_theme_entry (
      knowledge_id INTEGER PRIMARY KEY REFERENCES knowledge_entry(id),
      theme_id TEXT NOT NULL REFERENCES advice_theme(id)
    ) STRICT;
    CREATE INDEX advice_lookup ON advice_theme_entry(theme_id);
  ''';

const fortunePredicateEvaluation = r'''
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
  ''';
