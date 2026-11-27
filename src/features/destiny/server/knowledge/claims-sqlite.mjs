import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { isHistoricalClaimCompiler } from './claim-compat.mjs';
import { compileLillyAspectReferences, lillyAspectReferenceProfile, lillyAspectReferences } from './lilly-aspect-references.mjs';
import { compileLillyDignityCells, lillyDignityProfile } from './lilly-dignities.mjs';
import { compileLillyPrintedDignities, lillyPrintedDignityProfile, lillyPrintedDignityReferences } from './lilly-dignity-references.mjs';
import { compileLillyFortitudeRows, lillyFortitudeProfile, lillyFortitudeReferences } from './lilly-fortitudes.mjs';
import { compilePtolemyTermCells, ptolemyTermProfile, ptolemyTermReferences } from './ptolemy-terms.mjs';
import { compilePtolemyClassifications, ptolemyClassificationSourceIds, ptolemyClassificationReferences } from './ptolemy-classifications.mjs';
import { tiebanBaseNumbers, tiebanMissReason, tiebanNeedsExtraFacts, tiebanSelector, tiebanSourceTextConflicts } from './tieban.mjs';
import { tiebanFourteenTableSource, tiebanTableCalculations, writeTiebanTableCells } from './tieban-fourteen-tables.mjs';
import { branchInterpretation, claimEvidence } from './report-evidence.mjs';
import { readReportKnowledge, reportKnowledgeFiles, reportTiebanClaim } from './report-knowledge-source.mjs';

export const claimCatalogDirectory = fileURLToPath(new URL('./.local/interpretations/', import.meta.url));
export const claimSourceDirectory = fileURLToPath(new URL('./claims/', import.meta.url));
export const claimCatalogFile = 'destiny-knowledge.sqlite';
const schemaVersion = 10;
const knowledgeDirectory = fileURLToPath(new URL('.', import.meta.url));

export function openKnowledgeReadDatabase(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    // Match the build connection's wait policy: an atomic replacement can hold
    // an exclusive lock briefly while a parallel report opens its read view.
    db.exec('PRAGMA busy_timeout = 60000');
    return db;
  } catch (error) { db.close(); throw error; }
}

function compilerFiles() {
  return [
    ...readdirSync(knowledgeDirectory).filter(name => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
      .map(name => join(knowledgeDirectory, name)),
    fileURLToPath(new URL('./claims-schema.sql', import.meta.url)),
    fileURLToPath(new URL('./schema.sql', import.meta.url)),
    fileURLToPath(new URL('./unified-schema.sql', import.meta.url)),
    fileURLToPath(new URL('../chart-facts-text.mjs', import.meta.url)),
    fileURLToPath(tiebanFourteenTableSource),
    ...['rules', 'sources'].flatMap(directory => readdirSync(join(knowledgeDirectory, directory))
      .filter(name => name.endsWith('.mjs')).map(name => join(knowledgeDirectory, directory, name))),
    ...['charts.ts', 'bazi-analysis.ts', 'regiomontanus.mjs', 'lilly-houses.mjs', 'western-fixed-stars.mjs']
      .map(name => fileURLToPath(new URL('../../control/' + name, import.meta.url))),
  ].sort();
}

function fileStamp(files) {
  return JSON.stringify(files.map(file => {
    const stat = statSync(file);
    return [file, stat.size, stat.mtimeMs, stat.ctimeMs];
  }));
}

const loadedCompilerStamp = fileStamp(compilerFiles());

function sourceVersion(sourceDirectory, includeLegacy, useReportKnowledge) {
  const code = compilerFiles();
  if (fileStamp(code) !== loadedCompilerStamp) throw new Error('Claim matching code changed; restart the destiny service before rebuilding SQLite.');
  const interpretations = join(sourceDirectory, 'branch-interpretations.json');
  const files = [...code, ...['bazi.json', 'ziwei.json', 'western.json', 'upgrade-manifest.json'].map(name => join(sourceDirectory, name)),
    ...(useReportKnowledge ? reportKnowledgeFiles.map(name => join(sourceDirectory, name)) : []),
    ...(existsSync(interpretations) ? [interpretations] : [])].sort();
  return { files, stamp: JSON.stringify({ includeLegacy, files: fileStamp(files) }) };
}

function contentDigest(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    const content = readFileSync(file, 'utf8').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n');
    hash.update(JSON.stringify([file.split(/[\\/]/u).at(-1), content]));
  }
  return hash.digest('hex');
}

function readMetadata(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'claim_catalog_meta'").get()) return null;
  return db.prepare('SELECT * FROM claim_catalog_meta WHERE id = 1').get() ?? null;
}

function status(db, file) {
  const { source_stamp, id, ...metadata } = readMetadata(db);
  const legacy = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'view' AND name = 'interpretation'").get()
    ? db.prepare('SELECT layer, topic, count(*) AS records FROM interpretation GROUP BY layer, topic ORDER BY layer, topic').all() : [];
  return { file, ...metadata, legacy,
    totalRecords: db.prepare('SELECT count(*) AS count FROM claim_entry').get().count + legacy.reduce((sum, row) => sum + row.records, 0),
    counts: db.prepare("SELECT method, json_extract(lookup_json, '$.status') AS status, count(*) AS records FROM claim_entry GROUP BY method, status ORDER BY method, status").all(),
    rules: db.prepare('SELECT count(*) AS count FROM claim_rule').get().count,
    alternatives: db.prepare('SELECT count(*) AS count FROM claim_alternative').get().count };
}

function lookupStatus({ inputs, branches, reason, condition, remainingAlternatives, reviewNote, compiler, matchScope }) {
  return inputs ? { status: isHistoricalClaimCompiler(compiler) ? 'case_indexed' : 'indexed',
    alternatives: inputs.length, ...(remainingAlternatives && { remainingAlternatives }), ...(matchScope && { matchScope }) }
    : { status: reason === 'user_requested_skip' ? 'skipped' : branches.length ? 'branch_indexed' : 'unmapped', reason,
      ...(reviewNote && { reviewNote }),
      ...(condition && { condition }), ...(branches.length && { branches: branches.map(({ text, inputs, decadalAnchor }) =>
        ({ text, alternatives: inputs.length, ...(decadalAnchor && { decadalAnchor }) })) }) };
}

function importRows(db, rows, useReportKnowledge) {
  const dignityCells = compileLillyDignityCells(rows.map(row => row.claim));
  const termCells = compilePtolemyTermCells(rows.map(row => row.claim));
  const classifications = compilePtolemyClassifications(rows.map(row => row.claim));
  const fortitudes = compileLillyFortitudeRows(rows.map(row => row.claim));
  const aspects = compileLillyAspectReferences(rows.map(row => row.claim));
  const printedDignities = compileLillyPrintedDignities(rows.map(row => row.claim), dignityCells);
  const termReferences = new Map();
  for (const cell of termCells) {
    const prior = termReferences.get(cell.sourceId);
    termReferences.set(cell.sourceId, { role: 'term_ruler_table', profile: ptolemyTermProfile,
      system: cell.system, cells: (prior?.cells ?? 0) + 1 });
  }
  const referenceCounts = new Map();
  for (const cell of dignityCells) referenceCounts.set(cell.sourceId, (referenceCounts.get(cell.sourceId) ?? 0) + 1);
  const addEntry = db.prepare('INSERT INTO claim_entry VALUES (?, ?, ?, ?, ?, ?, ?)');
  const addTiebanNumber = db.prepare('INSERT INTO tieban_clause_number VALUES (?, ?, ?)');
  const addBranch = db.prepare('INSERT INTO claim_branch VALUES (?, ?, ?)');
  const addRule = db.prepare('INSERT INTO claim_rule VALUES (?, ?, ?, ?, ?)');
  const addFact = db.prepare('INSERT INTO claim_fact VALUES (?, ?)');
  const addRequired = db.prepare('INSERT INTO claim_required VALUES (?, ?)');
  const addAlternative = db.prepare('INSERT INTO claim_alternative VALUES (?, ?, ?, ?)');
  const ruleIds = new Map();
  const factIds = new Map();
  let ordinal = 0;
  for (const row of rows) {
    const { claim, method, inputs, branches, ...metadata } = row;
    const calculationReference = referenceCounts.has(claim.id)
      ? { role: 'essential_dignity_table', profile: lillyDignityProfile, cells: referenceCounts.get(claim.id) }
      : termReferences.get(claim.id) ?? classifications.get(claim.id) ?? fortitudes.get(claim.id) ?? aspects.get(claim.id)
        ?? printedDignities.get(claim.id);
    addEntry.run(claim.id, method, row.reportTradition ?? claim.source.book, ordinal++, JSON.stringify(claim), JSON.stringify({ ...lookupStatus(row),
      ...(calculationReference && { calculationReference }),
      revisedConditions: row.revisedConditions ?? false, revisedEvidence: row.revisedEvidence ?? false }),
      JSON.stringify({ ...metadata, ...(calculationReference && { calculationReference }), hasInputs: Boolean(inputs) }));
    const selector = row.tiebanMatch ? tiebanSelector(reportTiebanClaim(claim, row.tiebanMatch))
      : useReportKnowledge ? null : tiebanSelector(claim);
    if (selector) for (const clauseId of selector.clauseIds) {
      addTiebanNumber.run(selector.libraryEdition, clauseId, claim.id);
    }
    const addInputs = (inputs, branchOrdinal) => {
      for (const [index, input] of inputs.entries()) {
        const inputJson = JSON.stringify(input);
        const digest = createHash('sha256').update(inputJson).digest('hex');
        const key = method + ':' + digest;
        let id = ruleIds.get(key);
        if (!id) {
          id = ruleIds.size + 1;
          ruleIds.set(key, id);
          const required = [...new Set(input.required.map(fact => JSON.stringify(fact)))];
          addRule.run(id, method, digest, inputJson, required.length);
          for (const fact of required) {
            let factId = factIds.get(fact);
            if (!factId) { factId = factIds.size + 1; factIds.set(fact, factId); addFact.run(factId, fact); }
            addRequired.run(id, factId);
          }
          // Derived predicates may appear only in exclusions or anyOf groups;
          // they still need a runtime calculation, but are not SQL prerequisites.
          for (const fact of [...input.mustBeAbsent, ...input.anyOf.flat()].map(fact => JSON.stringify(fact))) {
            if (!factIds.has(fact)) { const factId = factIds.size + 1; factIds.set(fact, factId); addFact.run(factId, fact); }
          }
        }
        addAlternative.run(claim.id, branchOrdinal, index, id);
      }
    };
    if (inputs) addInputs(inputs, -1);
    for (const [index, { inputs: branchInputs, ...branch }] of branches.entries()) {
      const recorded = Object.hasOwn(branch, 'modernInterpretation') ? branch : { ...branch, ...branchInterpretation(claim, branch) };
      addBranch.run(claim.id, index, JSON.stringify(recorded));
      addInputs(branchInputs, index);
    }
  }
  const addCell = db.prepare('INSERT INTO lilly_dignity_cell VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const cell of dignityCells) addCell.run(cell.sourceId, cell.dimension, cell.sign, cell.body, cell.sect, cell.start, cell.end);
  const addTerm = db.prepare('INSERT INTO ptolemy_term_cell VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const cell of termCells) addTerm.run(cell.sourceId, cell.system, cell.sign, cell.body, cell.sect, cell.start, cell.end);
}

const alternativesSelect = `SELECT a.claim_id, a.branch_ordinal, a.ordinal, r.input_json, b.branch_json
  FROM claim_alternative a JOIN claim_rule r ON r.id = a.rule_id
  LEFT JOIN claim_branch b ON b.claim_id = a.claim_id AND b.ordinal = a.branch_ordinal`;

const candidatesSelect = `WITH eligible AS (
  SELECT f.rule_id
  FROM json_each(?) p JOIN claim_fact d ON d.fact_key = p.value
  JOIN claim_required f INDEXED BY claim_required_by_fact ON f.fact_id = d.id
  JOIN claim_rule r ON r.id = f.rule_id
  WHERE r.method = ?
  GROUP BY f.rule_id HAVING count(*) = max(r.required_count)
)
SELECT a.claim_id, a.branch_ordinal, a.ordinal, r.input_json, b.branch_json
FROM eligible q JOIN claim_alternative a ON a.rule_id = q.rule_id
JOIN claim_rule r ON r.id = a.rule_id JOIN claim_entry e ON e.id = a.claim_id
LEFT JOIN claim_branch b ON b.claim_id = a.claim_id AND b.ordinal = a.branch_ordinal
WHERE (? IS NULL OR e.source_book = ?)
  AND (json_extract(e.lookup_json, '$.status') = 'case_indexed') = ?
  AND json_extract(e.lookup_json, '$.matchScope') IS NOT 'historical_aphorism'
ORDER BY e.ordinal, a.branch_ordinal, a.ordinal`;

function hydrate(entry, alternatives) {
  const { hasInputs, reviewedOriginalText, ...metadata } = JSON.parse(entry.metadata_json);
  const claim = JSON.parse(entry.claim_json);
  if (reviewedOriginalText) claim.evidence.original_text = reviewedOriginalText;
  const row = { method: entry.method, claim, ...metadata, ...(hasInputs && { inputs: [] }), branches: [] };
  const branches = new Map();
  for (const value of alternatives) {
    const input = JSON.parse(value.input_json);
    if (value.branch_ordinal === -1) row.inputs.push(input);
    else {
      if (!branches.has(value.branch_ordinal)) {
        const branch = { ...JSON.parse(value.branch_json), inputs: [] };
        branches.set(value.branch_ordinal, branch);
        row.branches.push(branch);
      }
      branches.get(value.branch_ordinal).inputs.push(input);
    }
  }
  return row;
}

// The compiler is injected to keep JSON import/build separate from runtime SQL reads.
export function createClaimSqliteStore({
  directory = claimCatalogDirectory, sourceDirectory = claimSourceDirectory, compile, augment,
  useReportKnowledge = resolve(sourceDirectory) === resolve(claimSourceDirectory)
    || existsSync(join(sourceDirectory, reportKnowledgeFiles[0])),
}) {
  let calculationDigest = null;
  const calculationFacts = new Map();
  const file = join(resolve(directory), claimCatalogFile);
  let checkedStamp;
  let checkedDatabaseStamp;
  const databaseStamp = () => { const stat = statSync(file); return [stat.size, stat.mtimeMs, stat.ctimeMs].join(':'); };

  const includeLegacy = Boolean(augment);
  const versionOfSources = () => sourceVersion(sourceDirectory, includeLegacy, useReportKnowledge);
  function build({ force = false, refreshLegacy = false, version = versionOfSources() } = {}) {
    mkdirSync(directory, { recursive: true });
    const db = new DatabaseSync(file);
    db.exec('PRAGMA busy_timeout = 60000');
    try {
      db.exec('BEGIN IMMEDIATE');
      const metadata = readMetadata(db);
      // A different process may have completed the same build while we waited.
      const digest = !force && metadata?.schema_version === schemaVersion && metadata.source_stamp === version.stamp
        ? metadata.source_digest : contentDigest(version.files) + (includeLegacy ? ':unified' : ':claims');
      const rebuild = force || metadata?.schema_version !== schemaVersion || metadata.source_digest !== digest
        || Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'rule_review'").get());
      const rebuildLegacy = includeLegacy && (rebuild || (refreshLegacy && !useReportKnowledge));
      if (rebuild || rebuildLegacy) {
        // Older rule tables can reference rule_review, so drop the dependents first.
        db.exec(`DROP VIEW IF EXISTS knowledge_entry; DROP VIEW IF EXISTS interpretation;
          DROP TABLE IF EXISTS personality_rule; DROP TABLE IF EXISTS event_rule;
          DROP TABLE IF EXISTS rule_review; DROP TABLE IF EXISTS rule_provenance;`);
      }
      let knowledge;
      if (rebuild) {
        db.exec(`DROP TABLE IF EXISTS ptolemy_term_cell; DROP TABLE IF EXISTS lilly_dignity_cell; DROP TABLE IF EXISTS claim_alternative; DROP TABLE IF EXISTS claim_required; DROP TABLE IF EXISTS claim_fact;
          DROP TABLE IF EXISTS claim_branch; DROP TABLE IF EXISTS claim_rule; DROP TABLE IF EXISTS tieban_clause_number; DROP TABLE IF EXISTS tieban_calculation_cell;
          DROP TABLE IF EXISTS report_knowledge_id; DROP TABLE IF EXISTS claim_entry; DROP TABLE IF EXISTS claim_catalog_meta;`);
        db.exec(readFileSync(new URL('./claims-schema.sql', import.meta.url), 'utf8'));
        knowledge = useReportKnowledge ? readReportKnowledge(sourceDirectory) : null;
        if (knowledge) {
          const register = db.prepare('INSERT INTO report_knowledge_id VALUES (?, ?, ?, ?)');
          for (const [sourceId, entries] of knowledge) {
            for (const { id, key, matchConditions } of entries) register.run(id, key, sourceId, Number(matchConditions.status));
          }
        }
        importRows(db, compile(sourceDirectory, knowledge), useReportKnowledge);
        writeTiebanTableCells(db);
        // Refuse a partial generation if a source changed while it was imported.
        if (versionOfSources().stamp !== version.stamp) throw new Error('Claim sources changed during SQLite build; retry.');
        db.prepare('INSERT INTO claim_catalog_meta VALUES (1, ?, ?, ?, ?)')
          .run(schemaVersion, version.stamp, digest, new Date().toISOString());
      } else {
        db.prepare('UPDATE claim_catalog_meta SET source_stamp = ? WHERE id = 1').run(version.stamp);
      }
      if (rebuildLegacy) augment(db, knowledge);
      if (versionOfSources().stamp !== version.stamp) throw new Error('Knowledge sources changed during SQLite build; retry.');
      db.exec('COMMIT');
      checkedStamp = version.stamp;
      checkedDatabaseStamp = databaseStamp();
      return status(db, file);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* BEGIN may itself have failed. */ }
      throw error;
    } finally { db.close(); }
  }

  function ensure() {
    const version = versionOfSources();
    if (existsSync(file)) {
      if (checkedStamp === version.stamp && checkedDatabaseStamp === databaseStamp()) return;
      const db = openKnowledgeReadDatabase(file);
      try {
        const metadata = readMetadata(db);
        if (metadata?.schema_version === schemaVersion && metadata.source_stamp === version.stamp) {
          checkedStamp = version.stamp;
          checkedDatabaseStamp = databaseStamp();
          return;
        }
      } finally { db.close(); }
    }
    build({ version });
  }

  function open() { ensure(); return openKnowledgeReadDatabase(file); }
  function matchTieban(calculation, facts, fourteenTableRequest, birthOnly = false) {
    if (!calculation) return null;
    const { gender, sums, additionalCalculations } = calculation;
    const db = open();
    try {
      db.exec('BEGIN');
      const clause = db.prepare(`SELECT e.claim_json, json_extract(e.metadata_json, '$.promptEvidence') AS prompt_json,
        json_extract(e.metadata_json, '$.tiebanMatch') AS match_json FROM tieban_clause_number n
        JOIN claim_entry e ON e.id = n.claim_id WHERE n.library_edition = ? AND n.clause_id = ?`);
      const matchCalculation = ({ profile, libraryEdition, candidates, status, reason }) => ({
        profile, libraryEdition, ...(status && { status, reason }),
        results: (birthOnly ? candidates.filter(candidate => !candidate.requiresSelection && candidate.age === undefined) : candidates).map(({ annualLookupAge, ...candidate }) => {
          const row = clause.get(libraryEdition, candidate.clauseId);
          const claim = row ? JSON.parse(row.claim_json) : null;
          const matchClaim = row?.match_json ? reportTiebanClaim(claim, JSON.parse(row.match_json)) : claim;
          const age = candidate.age ?? (!birthOnly && matchClaim?.conditions.match.chartScope === 'annual' ? annualLookupAge : undefined);
          const result = { ...candidate, ...(age !== undefined && { age }) };
          const miss = tiebanMissReason(matchClaim, gender, age)
            ?? (birthOnly && tiebanNeedsExtraFacts(claim.evidence.original_text) ? 'source_requirements' : null)
            ?? (tiebanSourceTextConflicts(profile, candidate, matchClaim) ? 'source_text_mismatch' : null);
          return miss ? { ...result, status: 'unmatched', reason: miss }
            : { ...result, status: 'matched', claim, ...(row.prompt_json && { promptEvidence: JSON.parse(row.prompt_json) }) };
        }),
      });
      const fourteenTables = tiebanTableCalculations(db, facts, fourteenTableRequest);
      const additional = [...additionalCalculations, ...fourteenTables].map(matchCalculation);
      const result = { ...matchCalculation(calculation), sums,
        additionalCalculations: birthOnly ? additional.filter(row => row.results.length) : additional };
      db.exec('COMMIT');
      return result;
    } finally { db.close(); }
  }
  return {
    file, build, ensure,
    tiebanMatches(facts, birthYear, fourteenTableRequest, bookAnnualAge, chenKeSteps, chenKinshipSequence, kunjiFacts) {
      const calculation = tiebanBaseNumbers(facts, birthYear, bookAnnualAge, chenKeSteps, chenKinshipSequence, kunjiFacts);
      return matchTieban(calculation, facts, fourteenTableRequest);
    },
    tiebanBirthMatches(facts, birthYear) {
      return matchTieban(tiebanBaseNumbers(facts, birthYear), facts, undefined, true);
    },
    lillyFortitudeRows(connection) {
      const db = connection ?? open();
      try {
        const fortitudes = db.prepare(`SELECT id AS sourceId, claim_json, json_extract(lookup_json, '$.calculationReference') AS row_json
          FROM claim_entry WHERE id GLOB 'astro-lilly-v1-strength-table-p*'
          AND json_extract(lookup_json, '$.calculationReference.profile') = ? ORDER BY id`).all(lillyFortitudeProfile);
        return fortitudes.map(({ sourceId, claim_json, row_json }) => {
          const claim = JSON.parse(claim_json);
          const { checks, points, label } = JSON.parse(row_json);
          const source = { ...claim.source, original: claim.conditions.original, limitations: claim.interpretation.limitations };
          return { sourceId, checks, points, label, source };
        });
      } finally { if (!connection) db.close(); }
    },
    calculationReferences(facts, tradition) {
      const db = open();
      try {
        db.exec('BEGIN');
        const lillyTables = !tradition || tradition === 'Christian Astrology'
          ? db.prepare(`SELECT id AS sourceId, json_extract(claim_json, '$.source') AS source_json,
            json_extract(lookup_json, '$.calculationReference') AS row_json
            FROM claim_entry WHERE id GLOB 'astro-lilly-v1-*'
            AND json_extract(lookup_json, '$.calculationReference.profile') IN (?, ?) ORDER BY id`)
            .all(lillyAspectReferenceProfile, lillyPrintedDignityProfile)
            .map(({ sourceId, source_json, row_json }) => ({ sourceId, source: JSON.parse(source_json), ...JSON.parse(row_json) }))
          : [];
        const references = [...this.ptolemyTermReferences(facts, db), ...this.ptolemyClassificationReferences(facts, db),
          ...lillyFortitudeReferences(facts, (sign, degree) => this.lillyDignityCells(sign, degree, db), this.lillyFortitudeRows(db)),
          ...lillyAspectReferences(facts, lillyTables.filter(row => row.profile === lillyAspectReferenceProfile)),
          ...lillyPrintedDignityReferences(facts, lillyTables.filter(row => row.profile === lillyPrintedDignityProfile))];
        const idsByReference = references.map(reference => new Set([
          ...(reference.sources ?? []), ...(reference.factors ?? []).map(factor => ({ id: factor.sourceId })),
          reference.source, reference.method, ...(reference.columns ?? []).flatMap(column => column.sources ?? []),
        ].map(source => source?.id).filter(Boolean)));
        const allIds = new Set(idsByReference.flatMap(ids => [...ids]));
        const materials = new Map(db.prepare(`SELECT id, claim_json FROM claim_entry
          WHERE id IN (SELECT value FROM json_each(?))`).all(JSON.stringify([...allIds]))
          .map(({ id, claim_json }) => [id, { id, ...claimEvidence(JSON.parse(claim_json)) }]));
        return references.map((reference, index) => ({ ...reference,
          reportEvidence: [...idsByReference[index]].map(id => materials.get(id)).filter(Boolean) }));
      }
      finally { db.exec('ROLLBACK'); db.close(); }
    },
    ptolemyClassificationReferences(facts, connection) {
      const db = connection ?? open();
      let transaction = false;
      try {
        if (!connection) { db.exec('BEGIN'); transaction = true; }
        const statement = db.prepare(`SELECT e.id AS sourceId, e.claim_json, json_extract(c.value, '$.dimension') AS dimension,
          json_extract(c.value, '$.values') AS values_json, json_extract(c.value, '$.sect') AS sect,
          json_extract(c.value, '$.target') AS target, json_extract(c.value, '$.key') AS key
          FROM claim_entry e JOIN json_each(e.lookup_json, '$.calculationReference.entries') c
          WHERE e.id IN (${ptolemyClassificationSourceIds.map(() => '?').join(',')})
          AND ((json_extract(c.value, '$.target') = 'planet' AND json_extract(c.value, '$.key') = ?)
            OR (json_extract(c.value, '$.target') = 'sign' AND json_extract(c.value, '$.key') = ?))
          AND (json_extract(c.value, '$.sect') = 'both' OR json_extract(c.value, '$.sect') = ?)
          ORDER BY dimension, sourceId`);
        return ptolemyClassificationReferences(facts, (planet, sign, sect) => statement.all(...ptolemyClassificationSourceIds, planet, sign, sect)
          .map(({ claim_json, values_json, ...row }) => {
            const claim = JSON.parse(claim_json);
            return { ...row, values: JSON.parse(values_json), source: { ...claim.source, original: claim.evidence.original_text,
              limitations: claim.interpretation.limitations } };
          }));
      } finally { if (transaction) db.exec('ROLLBACK'); if (!connection) db.close(); }
    },
    ptolemyTermReferences(facts, connection) {
      const db = connection ?? open();
      let transaction = false;
      try {
        if (!connection) { db.exec('BEGIN'); transaction = true; }
        const statement = db.prepare(`SELECT p.source_id AS sourceId, p.term_system AS system, p.sign, p.body, p.sect,
          p.start_degree AS start, p.end_degree AS end, e.claim_json
          FROM ptolemy_term_cell p INDEXED BY ptolemy_terms_by_position JOIN claim_entry e ON e.id = p.source_id
          WHERE p.sign = ? AND p.start_degree <= ? AND p.end_degree > ? ORDER BY p.term_system, p.sect, p.start_degree`);
        const sources = new Map();
        return ptolemyTermReferences(facts, (sign, degree) => statement.all(sign, degree, degree).map(({ claim_json, ...cell }) => {
          if (!sources.has(cell.sourceId)) {
            const claim = JSON.parse(claim_json);
            sources.set(cell.sourceId, { ...claim.source, original: claim.conditions.original,
              context: claim.evidence.context, limitations: claim.interpretation.limitations });
          }
          return { ...cell, source: sources.get(cell.sourceId) };
        }));
      } finally {
        if (transaction) db.exec('ROLLBACK');
        if (!connection) db.close();
      }
    },
    lillyDignityCells(sign, degree, connection) {
      const db = connection ?? open();
      try {
        return db.prepare(`SELECT source_id AS sourceId, dimension, sign, body, sect, start_degree AS start, end_degree AS end
          FROM lilly_dignity_cell INDEXED BY lilly_dignity_by_position
          WHERE sign = ? AND start_degree <= ? AND end_degree > ? ORDER BY source_id`).all(sign, degree, degree);
      } finally { if (!connection) db.close(); }
    },
    ptolemyFortuneDignities(sign, degree, sect, connection) {
      const db = connection ?? open();
      try {
        const terms = db.prepare(`SELECT body FROM ptolemy_term_cell INDEXED BY ptolemy_terms_by_position
          WHERE term_system = 'ptolemy_manuscript' AND sign = ? AND sect = 'both'
          AND start_degree <= ? AND end_degree > ?`).all(sign, degree, degree);
        const trines = db.prepare(`SELECT json_extract(c.value, '$.values') AS bodies FROM claim_entry e
          JOIN json_each(e.lookup_json, '$.calculationReference.entries') c
          WHERE e.id GLOB 'astro-ptolemy-v1-chapter-18-p*'
          AND json_extract(c.value, '$.dimension') = 'triplicity_rulers'
          AND json_extract(c.value, '$.key') = ? AND json_extract(c.value, '$.sect') = ?`).all(sign, sect);
        return { term: terms.length === 1 ? terms[0].body : null, triplicity: trines.flatMap(({ bodies }) => JSON.parse(bodies)) };
      } finally { if (!connection) db.close(); }
    },
    factsByKind(kind, connection) {
      if (!/^[a-z][a-z0-9_]+$/u.test(kind)) throw new TypeError('Invalid fact kind.');
      const db = connection ?? open();
      try {
        const digest = readMetadata(db).source_digest;
        if (digest !== calculationDigest) { calculationDigest = digest; calculationFacts.clear(); }
        if (!calculationFacts.has(kind)) {
          const prefix = JSON.stringify({ kind }).slice(0, -1) + ',*';
          calculationFacts.set(kind, db.prepare('SELECT fact_key FROM claim_fact WHERE fact_key GLOB ? OR fact_key = ? ORDER BY fact_key').all(prefix, JSON.stringify({ kind }))
            .map(row => JSON.parse(row.fact_key)));
        }
        return calculationFacts.get(kind);
      } finally { if (!connection) db.close(); }
    },
    status() { const db = open(); try { return status(db, file); } finally { db.close(); } },
    inventory() {
      const db = open();
      try { return db.prepare('SELECT method, claim_json, lookup_json FROM claim_entry ORDER BY ordinal').all()
        .map(row => ({ method: row.method, claim: JSON.parse(row.claim_json), lookup: JSON.parse(row.lookup_json) })); }
      finally { db.close(); }
    },
    get(id) {
      const db = open();
      try {
        const alias = /^\d+$/u.test(id) ? db.prepare('SELECT id, source_id, enabled FROM report_knowledge_id WHERE id = ?').get(id) : null;
        const sourceId = alias?.source_id ?? id;
        const entry = db.prepare('SELECT * FROM claim_entry WHERE id = ?').get(sourceId);
        if (!entry) return null;
        const row = hydrate(entry, db.prepare(alternativesSelect + ' WHERE a.claim_id = ? ORDER BY a.branch_ordinal, a.ordinal').all(sourceId));
        if (alias) {
          row.branches = row.branches.filter(branch => branch.promptEvidence?.knowledgeId === alias.id);
          if (row.promptEvidence?.knowledgeId !== alias.id) delete row.inputs;
          if (!alias.enabled) row.reason ??= 'report_knowledge_disabled';
        }
        return row;
      } finally { db.close(); }
    },
    candidates(method, presentKeys, tradition, connection, { caseReferences = false } = {}) {
      const db = connection ?? open();
      try {
        const rows = db.prepare(candidatesSelect).all(JSON.stringify([...presentKeys]), method, tradition ?? null, tradition ?? null,
          Number(caseReferences));
        const groups = new Map();
        for (const row of rows) {
          if (!groups.has(row.claim_id)) groups.set(row.claim_id, []);
          groups.get(row.claim_id).push(row);
        }
        const entry = db.prepare('SELECT * FROM claim_entry WHERE id = ?');
        return [...groups].map(([id, alternatives]) => hydrate(entry.get(id), alternatives));
      } finally { if (!connection) db.close(); }
    },
    *compiledEntries() {
      const db = open();
      try {
        const alternatives = db.prepare(alternativesSelect + ' WHERE a.claim_id = ? ORDER BY a.branch_ordinal, a.ordinal');
        for (const entry of db.prepare('SELECT * FROM claim_entry ORDER BY ordinal').iterate()) {
          yield hydrate(entry, alternatives.all(entry.id));
        }
      } finally { db.close(); }
    },
  };
}
