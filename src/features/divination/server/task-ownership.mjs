import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function readingDatabasePath() {
  return process.env.DIVINATION_REPORT_DB?.trim() ||
    fileURLToPath(new URL('../../../../.local/divination.sqlite', import.meta.url));
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
  const databases = paths ?? [readingDatabasePath()];
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
