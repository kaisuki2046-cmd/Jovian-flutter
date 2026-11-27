import { parseDestinyArchive } from '../history/model/destiny-archive.mjs';

export function createDestinyHistoryStore(db, transaction, getArchiveIdentity) {
  function prepareHistory(table, ownerTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        user_id TEXT NOT NULL REFERENCES ${ownerTable}(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        saved_at INTEGER NOT NULL,
        calculated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (user_id, id)
      );
      CREATE INDEX IF NOT EXISTS ${table}_order ON ${table}(user_id, saved_at DESC, id DESC);
    `);
    const entry = 'id, saved_at AS savedAt, calculated_at AS calculatedAt, title';
    const order = 'ORDER BY saved_at DESC, rowid DESC';
    return {
      insert: db.prepare(`
        INSERT INTO ${table} (user_id, id, saved_at, calculated_at, title, data)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO NOTHING
      `),
      byId: db.prepare(`SELECT ${entry}, data FROM ${table} WHERE user_id = ? AND id = ?`),
      cursor: db.prepare(`SELECT saved_at, rowid FROM ${table} WHERE user_id = ? AND id = ?`),
      latest: db.prepare(`SELECT ${entry}, data FROM ${table} WHERE user_id = ? ${order} LIMIT 1`),
      first: db.prepare(`SELECT ${entry} FROM ${table} WHERE user_id = ? ${order} LIMIT 21`),
      next: db.prepare(`
        SELECT ${entry} FROM ${table} WHERE user_id = ? AND (saved_at, rowid) < (?, ?) ${order} LIMIT 21
      `),
    };
  }

  const histories = {
    member: prepareHistory('account_destiny_history', 'account_users'),
    guest: prepareHistory('account_guest_destiny_history', 'account_guest_sessions'),
  };

  function record(row) {
    if (!row) return;
    const { data, ...entry } = row;
    const stored = JSON.parse(data);
    const report = Object.hasOwn(stored, 'sections') ? parseDestinyArchive(stored, { readingHistory: true }) : stored;
    if (!report) throw new Error('Invalid stored destiny archive.');
    return { ...entry, report };
  }

  return {
    saveDestinyArchive(owner, token, now, id, report, serialized) {
      return transaction(() => {
        const active = getArchiveIdentity(token, now);
        if (active?.id !== owner.id || active.kind !== owner.kind) return;
        const history = histories[owner.kind];
        history.insert.run(owner.id, id, now, report.calculatedAt, '命盘记录', serialized);
        const { data, ...entry } = history.byId.get(owner.id, id);
        return entry;
      });
    },
    listDestinyArchives(owner, before) {
      const history = histories[owner.kind];
      if (!before) return history.first.all(owner.id);
      const cursor = history.cursor.get(owner.id, before);
      return cursor ? history.next.all(owner.id, cursor.saved_at, cursor.rowid) : undefined;
    },
    getDestinyArchive(owner, id) {
      return record(histories[owner.kind].byId.get(owner.id, id));
    },
    getLatestDestinyArchive(owner) {
      return record(histories[owner.kind].latest.get(owner.id));
    },
  };
}
