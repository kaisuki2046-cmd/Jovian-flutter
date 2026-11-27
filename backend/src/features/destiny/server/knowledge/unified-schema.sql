CREATE VIEW knowledge_entry AS
  SELECT r.id, 'legacy' AS origin, r.method, i.layer, i.topic, 'indexed' AS status,
    i.reading AS title, i.reading, json_extract(r.source_json, '$.title') AS source_book, r.source_json,
    coalesce(nullif(trim(json_extract(r.source_json, '$.excerpt')), ''), r.basis) AS original_text,
    i.reading AS modern_interpretation,
    CASE WHEN nullif(trim(json_extract(r.source_json, '$.excerpt')), '') IS NULL THEN 'rule_basis' ELSE 'source_text' END AS original_kind
  FROM interpretation i JOIN rule_provenance r USING (id)
  UNION ALL
  SELECT c.id, 'claim' AS origin, c.method,
    CASE coalesce(json_extract(c.metadata_json, '$.category.type'), json_extract(c.claim_json, '$.category.type'))
      WHEN '性格' THEN 'personality' ELSE 'events' END AS layer,
    coalesce(json_extract(c.metadata_json, '$.category.topic'), json_extract(c.claim_json, '$.category.topic')) AS topic,
    json_extract(c.lookup_json, '$.status') AS status,
    json_extract(c.claim_json, '$.title') AS title,
    json_extract(c.claim_json, '$.interpretation.classical_meaning') AS reading,
    c.source_book, json_extract(c.claim_json, '$.source'),
    coalesce(json_extract(c.metadata_json, '$.reviewedOriginalText'), json_extract(c.claim_json, '$.evidence.original_text')),
    json_extract(c.claim_json, '$.interpretation.classical_meaning'), 'source_text'
  FROM claim_entry c;
