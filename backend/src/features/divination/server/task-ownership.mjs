import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function readingDatabasePath(port) {
  return process.env.DIVINATION_REPORT_DB ?? join(tmpdir(), `jovian-divination-${port}.sqlite`);
}

export function installReadingOwners(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS reading_session_owners (
      token_hash TEXT PRIMARY KEY REFERENCES tarot_sessions(token_hash) ON DELETE CASCADE,
      owner_key TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reading_session_owner_lookup ON reading_session_owners(owner_key);
    CREATE TABLE IF NOT EXISTS reading_deleted_owners (owner_key TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
}

export function readingOwnerKey(identity) {
  return createHash('sha256').update(identity.kind + ':' + identity.id).digest('hex');
}

export function eraseDivinationAccount(ownerId, legacyHashes, paths) {
  const databases = paths ?? (process.env.DIVINATION_REPORT_DB ? [process.env.DIVINATION_REPORT_DB] :
    readdirSync(tmpdir()).filter((name) => /^jovian-divination-\d+\.sqlite$/.test(name)).map((name) => join(tmpdir(), name)));
  const owner = readingOwnerKey({ kind: 'member', id: ownerId });
  for (const path of new Set(databases)) {
    if (!existsSync(path)) continue;
    const db = new DatabaseSync(path);
    try {
      db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;');
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tarot_sessions'").get()) continue;
      installReadingOwners(db);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT OR REPLACE INTO reading_deleted_owners VALUES (?, ?)').run(owner, Date.now() + 86_400_000);
        db.prepare(`DELETE FROM tarot_sessions WHERE token_hash IN (
          SELECT token_hash FROM reading_session_owners WHERE owner_key = ?
        )`).run(owner);
        const eraseLegacy = db.prepare(`DELETE FROM tarot_sessions WHERE token_hash = ? AND NOT EXISTS (
          SELECT 1 FROM reading_session_owners WHERE token_hash = tarot_sessions.token_hash
        )`);
        for (const hash of legacyHashes) eraseLegacy.run(hash);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      db.close();
    }
  }
}
