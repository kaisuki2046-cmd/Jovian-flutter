import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import '../typescript-imports.mjs';
import { sourceEntries, validateEntries } from './entries.mjs';
import { createEntryScoring } from '../evidence-scores.mjs';

const { claimIndexKeys } = await import('../../control/claim-matching.ts');
const { compileEntryPrograms } = await import('../matching/compile-claims.mjs');

const schema = readFileSync(new URL('./passage-schema.sql', import.meta.url), 'utf8');
const version = '7.0.0';
const cleanup = `
  DROP TABLE IF EXISTS claim_alternative; DROP TABLE IF EXISTS claim_rule_required;
  DROP TABLE IF EXISTS claim_required; DROP TABLE IF EXISTS claim_rule; DROP TABLE IF EXISTS claim_branch;
  DROP TABLE IF EXISTS claim_scene_lookup; DROP TABLE IF EXISTS claim_application; DROP TABLE IF EXISTS claim_entry;
  DROP TABLE IF EXISTS claim_inputs; DROP TABLE IF EXISTS variant_sources; DROP TABLE IF EXISTS atom_sources;
  DROP TABLE IF EXISTS variants; DROP TABLE IF EXISTS atoms; DROP TABLE IF EXISTS sources;
  DROP TABLE IF EXISTS combinations; DROP TABLE IF EXISTS catalog; DROP TABLE IF EXISTS claim_catalog_meta;
`;

function synchronize(db, entries, programs) {
  const fingerprint = createHash('sha256').update(schema).update(JSON.stringify([version, entries, programs])).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    const hasCatalog = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'claim_catalog_meta'").get();
    if (!hasCatalog) {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
      if (tables.length && (!tables.some(({ name }) => name === 'catalog')
        || !db.prepare('SELECT version FROM catalog WHERE slot = 1').get()?.version?.startsWith('synastry-knowledge-'))) {
        throw new Error('Expected an empty database or a synastry knowledge cache.');
      }
    }
    if (!hasCatalog || db.prepare('SELECT fingerprint FROM claim_catalog_meta WHERE id = 1').get()?.fingerprint !== fingerprint) {
      db.exec(cleanup);
      db.exec(schema);
      const putClaim = db.prepare('INSERT INTO claim_entry VALUES (?, ?, ?, ?)');
      for (const entry of entries) putClaim.run(entry.id, entry.category.method, entry.source.book, JSON.stringify(entry));
      const putRule = db.prepare('INSERT INTO claim_rule VALUES (?, ?, ?)');
      const putKey = db.prepare('INSERT INTO claim_required VALUES (?, ?)');
      const putAlternative = db.prepare('INSERT INTO claim_alternative VALUES (?, ?, ?, ?)');
      const ruleIds = new Map();
      for (const [index, { entryId, conditionIndex, program }] of programs.entries()) {
        const payload = JSON.stringify(program);
        let ruleId = ruleIds.get(payload);
        if (ruleId === undefined) {
          ruleId = ruleIds.size + 1;
          ruleIds.set(payload, ruleId);
          const keys = claimIndexKeys(program);
          putRule.run(ruleId, keys.length, payload);
          for (const key of keys) putKey.run(ruleId, key);
        }
        putAlternative.run(index, entryId, conditionIndex, ruleId);
      }
      db.prepare('INSERT INTO claim_catalog_meta VALUES (1, ?, ?)').run(version, fingerprint);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openPassageCatalog(path, { entries = sourceEntries } = {}) {
  validateEntries(entries);
  const { programs, unresolved } = compileEntryPrograms(entries);
  const scoring = createEntryScoring({ entries, programs });
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    synchronize(db, entries, programs);
  } catch (error) {
    db.close();
    throw error;
  }
  const passage = db.prepare('SELECT claim_json FROM claim_entry WHERE id = ?');
  const candidates = db.prepare(`
    WITH eligible AS (
      SELECT k.rule_id FROM json_each(?) f JOIN claim_required k ON k.fact_key = f.value
      JOIN claim_rule r ON r.id = k.rule_id GROUP BY k.rule_id HAVING count(*) = max(r.required_count)
    )
    SELECT a.entry_id, a.condition_index, r.input_json FROM eligible e JOIN claim_alternative a ON a.rule_id = e.rule_id
    JOIN claim_rule r ON r.id = e.rule_id ORDER BY a.ordinal
  `);
  return {
    version, entries, programs, scoring,
    candidatePrograms(keys) {
      return candidates.all(JSON.stringify(keys)).map(({ entry_id, condition_index, input_json }) =>
        ({ entryId: entry_id, conditionIndex: condition_index, program: JSON.parse(input_json) }));
    },
    getClaim(id) {
      const row = Number.isSafeInteger(id) ? passage.get(id) : undefined;
      return row && JSON.parse(row.claim_json);
    },
    stats() {
      return { version, entries: db.prepare('SELECT count(*) AS total FROM claim_entry').get().total,
        ready: entries.length - unresolved.length,
        indexedRules: db.prepare('SELECT count(*) AS total FROM claim_rule').get().total,
        conditionAlternatives: programs.length, unresolved };
    },
    close() { db.close(); },
  };
}
