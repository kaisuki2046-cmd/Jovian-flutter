import { randomUUID } from 'node:crypto';

const pageSize = 30;

export function createPrivacyRequestStore(db, transaction) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_privacy_requests (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('access_copy', 'correction')),
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewer_id TEXT REFERENCES account_users(id) ON DELETE SET NULL,
    conclusion TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS account_pending_privacy_request
    ON account_privacy_requests(owner_id, kind) WHERE reviewed_at IS NULL;
  CREATE INDEX IF NOT EXISTS account_privacy_request_pages
    ON account_privacy_requests(owner_id, created_at, id);
  CREATE INDEX IF NOT EXISTS account_privacy_request_queue
    ON account_privacy_requests(created_at, id) WHERE reviewed_at IS NULL;`);
  const columns = `SELECT id, owner_id AS ownerId, kind, detail, created_at AS createdAt,
    reviewed_at AS reviewedAt, conclusion FROM account_privacy_requests`;
  const existing = db.prepare(columns + ' WHERE owner_id = ? AND kind = ? AND reviewed_at IS NULL');
  const byId = db.prepare(columns + ' WHERE id = ?');
  const insert = db.prepare('INSERT INTO account_privacy_requests (id, owner_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)');
  const update = db.prepare(`UPDATE account_privacy_requests SET reviewed_at = ?, reviewer_id = ?, conclusion = ?
    WHERE id = ? AND reviewed_at IS NULL AND owner_id <> ?`);
  const page = (where) => db.prepare(columns + ` WHERE ${where} AND (created_at, id) < (?, ?)
    ORDER BY created_at DESC, id DESC LIMIT ${pageSize + 1}`);
  const owned = page('owner_id = ?');
  const queue = page('reviewed_at IS NULL');
  function paginate(items) {
    const rows = items.slice(0, pageSize);
    const last = rows.at(-1);
    return { items: rows, next: items.length > pageSize ? `${last.createdAt}.${last.id}` : undefined };
  }
  return {
    list: (ownerId, beforeTime, beforeId) => paginate(owned.all(ownerId, beforeTime, beforeId)),
    queue: (beforeTime, beforeId) => paginate(queue.all(beforeTime, beforeId)),
    submit(ownerId, kind, detail, now) {
      return transaction(() => {
        const pending = existing.get(ownerId, kind);
        if (pending) return pending;
        const id = randomUUID();
        insert.run(id, ownerId, kind, detail, now);
        return byId.get(id);
      });
    },
    review(id, reviewerId, conclusion, now) {
      return transaction(() => {
        const item = byId.get(id);
        if (!item) return;
        if (item.ownerId === reviewerId) return false;
        if (!update.run(now, reviewerId, conclusion, id, reviewerId).changes) return null;
        return byId.get(id);
      });
    },
  };
}
