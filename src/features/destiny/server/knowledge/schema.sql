CREATE TABLE IF NOT EXISTS rule_provenance (
  id TEXT PRIMARY KEY NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('bazi', 'ziwei', 'western')),
  ruleset_version TEXT NOT NULL,
  chart_scope TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  basis TEXT NOT NULL,
  usage_limit TEXT NOT NULL,
  original_topic TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS personality_rule (
  id TEXT PRIMARY KEY NOT NULL REFERENCES rule_provenance(id),
  keywords TEXT NOT NULL CHECK (json_valid(keywords) AND json_type(keywords) = 'array' AND json_array_length(keywords) > 0),
  reading TEXT NOT NULL CHECK (length(trim(reading)) > 0),
  topic TEXT NOT NULL CHECK (topic IN ('综合', '事业', '爱情', '学业', '财富'))
) STRICT;

CREATE TABLE IF NOT EXISTS event_rule (
  id TEXT PRIMARY KEY NOT NULL REFERENCES rule_provenance(id),
  keywords TEXT NOT NULL CHECK (json_valid(keywords) AND json_type(keywords) = 'array' AND json_array_length(keywords) > 0),
  reading TEXT NOT NULL CHECK (length(trim(reading)) > 0),
  topic TEXT NOT NULL CHECK (topic IN ('综合', '事业', '爱情', '学业', '财富'))
) STRICT;

CREATE VIEW IF NOT EXISTS interpretation AS
  SELECT 'personality' AS layer, * FROM personality_rule
  UNION ALL
  SELECT 'events' AS layer, * FROM event_rule;

CREATE INDEX IF NOT EXISTS rule_by_chart ON rule_provenance(method, ruleset_version, chart_scope);
