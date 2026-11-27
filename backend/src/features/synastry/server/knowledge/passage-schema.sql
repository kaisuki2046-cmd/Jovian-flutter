CREATE TABLE claim_catalog_meta (
  id INTEGER PRIMARY KEY CHECK(id = 1), version TEXT NOT NULL, fingerprint TEXT NOT NULL
) STRICT;
CREATE TABLE claim_entry (
  id INTEGER PRIMARY KEY CHECK(id > 0), method TEXT NOT NULL CHECK(method IN ('bazi', 'ziwei', 'western')),
  source_book TEXT NOT NULL, claim_json TEXT NOT NULL CHECK(json_valid(claim_json)
    AND json_type(claim_json, '$.id') IS 'integer' AND json_extract(claim_json, '$.id') = id
    AND json_extract(claim_json, '$.category.method') IS method
    AND json_extract(claim_json, '$.source.book') IS source_book
    AND json_type(claim_json, '$.matchConditions.original') IS 'array'
    AND json_type(claim_json, '$.matchConditions.formatted') IS 'object')
) STRICT;
CREATE INDEX claim_entry_by_method ON claim_entry(method, source_book);
CREATE TABLE claim_rule (
  id INTEGER PRIMARY KEY, required_count INTEGER NOT NULL CHECK(required_count > 0),
  input_json TEXT NOT NULL CHECK(json_valid(input_json))
) STRICT;
CREATE TABLE claim_required (
  rule_id INTEGER NOT NULL REFERENCES claim_rule(id), fact_key TEXT NOT NULL, PRIMARY KEY(fact_key, rule_id)
) STRICT;
CREATE TABLE claim_alternative (
  ordinal INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES claim_entry(id),
  condition_index INTEGER NOT NULL CHECK(condition_index >= 0), rule_id INTEGER NOT NULL REFERENCES claim_rule(id),
  UNIQUE(entry_id, condition_index)
) STRICT;
CREATE INDEX claim_alternative_by_rule ON claim_alternative(rule_id, entry_id);
