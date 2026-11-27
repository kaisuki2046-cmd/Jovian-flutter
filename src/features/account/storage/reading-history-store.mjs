export function createReadingHistoryStore(db, transaction, getArchiveIdentity) {
  function prepare(table, parent) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
      user_id TEXT NOT NULL REFERENCES ${parent}(id) ON DELETE CASCADE,
      id TEXT NOT NULL, kind TEXT NOT NULL, context_key TEXT NOT NULL, saved_at INTEGER NOT NULL,
      calculated_at TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY (user_id, id));
      CREATE INDEX IF NOT EXISTS ${table}_lookup ON ${table}(user_id, kind, context_key, saved_at DESC);`);
    const fields = 'id, saved_at AS savedAt, calculated_at AS calculatedAt, title, kind';
    return {
      insert: db.prepare(`INSERT INTO ${table} VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO NOTHING`),
      byId: db.prepare(`SELECT ${fields}, data FROM ${table} WHERE user_id = ? AND kind = ? AND id = ?`),
      latest: db.prepare(`SELECT ${fields}, data FROM ${table} WHERE user_id = ? AND kind = ? ORDER BY saved_at DESC, rowid DESC LIMIT 1`),
      matching: db.prepare(`SELECT ${fields}, data FROM ${table} WHERE user_id = ? AND kind = ? AND context_key = ? ORDER BY saved_at DESC, rowid DESC LIMIT 1`),
      cursor: db.prepare(`SELECT saved_at, rowid FROM ${table} WHERE user_id = ? AND kind = ? AND id = ?`),
      first: db.prepare(`SELECT ${fields} FROM ${table} WHERE user_id = ? AND kind = ? ORDER BY saved_at DESC, rowid DESC LIMIT 21`),
      next: db.prepare(`SELECT ${fields} FROM ${table} WHERE user_id = ? AND kind = ? AND (saved_at, rowid) < (?, ?) ORDER BY saved_at DESC, rowid DESC LIMIT 21`),
    };
  }
  const tables = { member: prepare('account_reading_history', 'account_users'),
    guest: prepare('account_guest_reading_history', 'account_guest_sessions') };
  const record = row => {
    if (!row) return;
    const { data, ...entry } = row;
    return { ...entry, report: JSON.parse(data) };
  };
  return {
    saveReadingArchive(owner, token, now, id, report, serialized) {
      return transaction(() => {
        const active = getArchiveIdentity(token, now);
        if (active?.id !== owner.id || active.kind !== owner.kind) return;
        const table = tables[owner.kind];
        table.insert.run(owner.id, id, report.kind, report.contextKey, now, report.calculatedAt, report.title, serialized);
        return record(table.byId.get(owner.id, report.kind, id));
      });
    },
    getReadingArchive(owner, kind, id) { return record(tables[owner.kind].byId.get(owner.id, kind, id)); },
    latestReadingArchive(owner, kind, contextKey) {
      const table = tables[owner.kind];
      return record(contextKey === null ? table.latest.get(owner.id, kind) : table.matching.get(owner.id, kind, contextKey));
    },
    listReadingArchives(owner, kind, before) {
      const table = tables[owner.kind];
      if (!before) return table.first.all(owner.id, kind);
      const cursor = table.cursor.get(owner.id, kind, before);
      return cursor ? table.next.all(owner.id, kind, cursor.saved_at, cursor.rowid) : undefined;
    },
  };
}
