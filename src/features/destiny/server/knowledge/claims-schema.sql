CREATE TABLE claim_catalog_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  source_stamp TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  built_at TEXT NOT NULL
) STRICT;

CREATE TABLE claim_entry (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL CHECK (method IN ('bazi', 'ziwei', 'western')),
  source_book TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  claim_json TEXT NOT NULL CHECK (json_valid(claim_json)),
  lookup_json TEXT NOT NULL CHECK (json_valid(lookup_json)),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json))
) STRICT;
CREATE INDEX claim_entry_by_method ON claim_entry(method, source_book, ordinal);

CREATE TABLE report_knowledge_id (
  id INTEGER PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
) STRICT;

CREATE TABLE tieban_clause_number (
  library_edition TEXT NOT NULL CHECK (library_edition IN ('muxuan-json', 'muxuan-fourteen-table-csv')),
  clause_id INTEGER NOT NULL CHECK (clause_id BETWEEN 1001 AND 13000),
  claim_id TEXT NOT NULL REFERENCES claim_entry(id),
  PRIMARY KEY (library_edition, clause_id)
) STRICT;

CREATE TABLE tieban_calculation_cell (
  table_name TEXT NOT NULL,
  lookup_key TEXT NOT NULL CHECK (json_valid(lookup_key) AND json_type(lookup_key) = 'array'),
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  PRIMARY KEY (table_name, lookup_key)
) STRICT;

CREATE TABLE claim_branch (
  claim_id TEXT NOT NULL REFERENCES claim_entry(id),
  ordinal INTEGER NOT NULL,
  branch_json TEXT NOT NULL CHECK (json_valid(branch_json)
    AND json_type(branch_json, '$.text') IS 'text' AND length(trim(json_extract(branch_json, '$.text'))) > 0
    AND (
      (json_type(branch_json, '$.modernInterpretation') IS 'text'
        AND length(trim(json_extract(branch_json, '$.modernInterpretation'))) > 0
        AND coalesce(json_extract(branch_json, '$.interpretationOrigin'), '') IN ('reviewed', 'source', 'derived'))
      OR (json_type(branch_json, '$.modernInterpretation') IS 'null'
        AND json_extract(branch_json, '$.interpretationOrigin') IS 'untranslated')
    )),
  PRIMARY KEY (claim_id, ordinal)
) STRICT;

CREATE TABLE claim_rule (
  id INTEGER PRIMARY KEY,
  method TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  required_count INTEGER NOT NULL CHECK (required_count > 0),
  UNIQUE (method, input_digest)
) STRICT;

CREATE TABLE claim_fact (
  id INTEGER PRIMARY KEY,
  fact_key TEXT NOT NULL,
  UNIQUE (fact_key)
) STRICT;

CREATE TABLE claim_required (
  rule_id INTEGER NOT NULL REFERENCES claim_rule(id),
  fact_id INTEGER NOT NULL REFERENCES claim_fact(id),
  PRIMARY KEY (rule_id, fact_id)
) STRICT;
CREATE INDEX claim_required_by_fact ON claim_required(fact_id, rule_id);

CREATE TABLE claim_alternative (
  claim_id TEXT NOT NULL REFERENCES claim_entry(id),
  branch_ordinal INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  rule_id INTEGER NOT NULL REFERENCES claim_rule(id),
  PRIMARY KEY (claim_id, branch_ordinal, ordinal)
) STRICT;
CREATE INDEX claim_alternative_by_rule ON claim_alternative(rule_id, claim_id);

CREATE TABLE lilly_dignity_cell (
  source_id TEXT NOT NULL REFERENCES claim_entry(id),
  dimension TEXT NOT NULL,
  sign TEXT NOT NULL,
  body TEXT NOT NULL,
  sect TEXT NOT NULL CHECK (sect IN ('day', 'night', 'both')),
  start_degree INTEGER NOT NULL CHECK (start_degree >= 0),
  end_degree INTEGER NOT NULL CHECK (end_degree <= 30 AND end_degree > start_degree),
  PRIMARY KEY (source_id, sign, sect)
) STRICT;
CREATE INDEX lilly_dignity_by_position ON lilly_dignity_cell(sign, start_degree, end_degree);

CREATE TABLE ptolemy_term_cell (
  source_id TEXT NOT NULL REFERENCES claim_entry(id),
  term_system TEXT NOT NULL CHECK (term_system IN ('egyptian_common', 'ptolemy_manuscript', 'chaldaean')),
  sign TEXT NOT NULL,
  body TEXT NOT NULL,
  sect TEXT NOT NULL CHECK (sect IN ('day', 'night', 'both')),
  start_degree INTEGER NOT NULL CHECK (start_degree >= 0),
  end_degree INTEGER NOT NULL CHECK (end_degree <= 30 AND end_degree > start_degree),
  PRIMARY KEY (source_id, sign, sect)
) STRICT;
CREATE INDEX ptolemy_terms_by_position ON ptolemy_term_cell(sign, start_degree, end_degree, term_system, sect);
