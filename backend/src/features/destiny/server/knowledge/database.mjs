import { join, resolve } from 'node:path';
import { chartVersions, methods } from './catalog.mjs';
import { createClaimsCatalog, lookupClaims } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { claimCatalogDirectory, claimCatalogFile, openKnowledgeReadDatabase } from './claims-sqlite.mjs';

export const catalogDirectory = claimCatalogDirectory;
export const catalogFile = claimCatalogFile;
const catalogs = new Map();
export function catalogForDirectory(directory = catalogDirectory) {
  const key = resolve(directory);
  if (!catalogs.has(key)) catalogs.set(key, createClaimsCatalog({ directory: key }));
  return catalogs.get(key);
}

export function buildCatalog(directory = catalogDirectory) {
  return catalogForDirectory(directory).build({ refreshLegacy: true }).legacy;
}

export function knowledgeCatalogStatus(directory = catalogDirectory) { return catalogForDirectory(directory).status(); }

export function exportKnowledge(directory = catalogDirectory, { origin, method, search = '' } = {}) {
  catalogForDirectory(directory).ensure();
  const db = openKnowledgeReadDatabase(join(directory, catalogFile));
  try {
    return db.prepare(`SELECT * FROM knowledge_entry WHERE (? IS NULL OR origin = ?) AND (? IS NULL OR method = ?)
      AND (? = '' OR instr(lower(id || ' ' || title || ' ' || source_book || ' ' || reading), lower(?)) > 0)
      ORDER BY origin DESC, id`).all(origin ?? null, origin ?? null, method ?? null, method ?? null, search, search);
  } finally { db.close(); }
}

const select = 'SELECT i.*, r.* FROM interpretation i JOIN rule_provenance r USING (id)';
const lookup = select + `
  WHERE r.method = ? AND r.ruleset_version = ? AND r.chart_scope = ?
    AND NOT EXISTS (
      SELECT value FROM json_each(r.input_json, '$.required') EXCEPT SELECT value FROM json_each(?)
    )
  ORDER BY i.id`;

function readingFromRow(row, input = JSON.parse(row.input_json)) {
  return {
    id: row.id, layer: row.layer, method: row.method, rulesetVersion: row.ruleset_version,
    chartScope: row.chart_scope, input, ...JSON.parse(row.details_json),
    keywords: JSON.parse(row.keywords), reading: row.reading, topic: row.topic,
    source: JSON.parse(row.source_json), basis: row.basis, limit: row.usage_limit, originalTopic: row.original_topic,
  };
}

export function exportCatalog(directory = catalogDirectory) {
  catalogForDirectory(directory).ensure();
  const db = openKnowledgeReadDatabase(join(directory, catalogFile));
  try {
    return db.prepare(select + ' ORDER BY i.id').all().map((row) => readingFromRow(row));
  } finally {
    db.close();
  }
}

export function lookupInterpretations(directory, query, providedCatalog) {
  if (!query || !methods.includes(query.method) || chartVersions[query.method].rulesetVersion !== query.rulesetVersion) return [];
  const { method, rulesetVersion, chartScope = 'natal' } = query;
  const chart = { ...chartContext(method, query.confirmedFacts, query.confirmedAbsentFacts, chartScope),
    ptolemyParentAttendanceText: query.ptolemyParentAttendanceText, lillyParentDerivedFigure: query.lillyParentDerivedFigure };
  const catalog = providedCatalog ?? catalogForDirectory(directory);
  catalog.ensure();
  const db = openKnowledgeReadDatabase(join(directory, catalogFile));
  try {
    db.exec('BEGIN');
    const legacy = db.prepare(lookup).all(method, rulesetVersion, chartScope, JSON.stringify(chart.present)).flatMap((row) => {
      const input = JSON.parse(row.input_json);
      const result = evaluateRule(input, row.chart_scope, chart);
      if (!result.matched) return [];
      const rule = readingFromRow(row, input);
      if (query.tradition && rule.source.tradition !== query.tradition) return [];
      return [{ ...rule, matchedConditions: result.conditions }];
    });
    const matches = [...legacy, ...lookupClaims(method, chart, query.tradition, catalog, db)];
    db.exec('COMMIT');
    return matches;
  } finally {
    db.close();
  }
}
