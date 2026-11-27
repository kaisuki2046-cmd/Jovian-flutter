const receiptLifetime = 7 * 24 * 60 * 60 * 1000;

export function createDeletionStore(db, transaction, getArchiveIdentity) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_deletion_receipts (
      receipt_hash TEXT PRIMARY KEY,
      pending_owner TEXT,
      legacy_reading_tokens TEXT NOT NULL,
      requested_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);
  const insert = db.prepare('INSERT INTO account_deletion_receipts VALUES (?, ?, ?, ?, NULL)');
  const removeUser = db.prepare('DELETE FROM account_users WHERE id = ?');
  const find = db.prepare(`SELECT receipt_hash AS receiptHash, pending_owner AS ownerId, legacy_reading_tokens AS tokens,
    requested_at AS requestedAt, completed_at AS completedAt FROM account_deletion_receipts WHERE receipt_hash = ?`);
  const finish = db.prepare(`UPDATE account_deletion_receipts SET pending_owner = NULL, legacy_reading_tokens = '[]',
    completed_at = ? WHERE receipt_hash = ? AND completed_at IS NULL`);
  const pending = db.prepare(`SELECT receipt_hash AS receiptHash, pending_owner AS ownerId, legacy_reading_tokens AS tokens
    FROM account_deletion_receipts WHERE completed_at IS NULL ORDER BY requested_at`);
  const purge = db.prepare('DELETE FROM account_deletion_receipts WHERE completed_at <= ?');

  return {
    beginDeletion(userId, session, receiptHash, tokens, now) {
      return transaction(() => {
        const identity = getArchiveIdentity(session, now);
        if (identity?.kind !== 'member' || identity.id !== userId) return false;
        insert.run(receiptHash, userId, JSON.stringify(tokens), now);
        return removeUser.run(userId).changes === 1;
      });
    },
    getDeletionReceipt: (hash) => find.get(hash),
    completeDeletion: (hash, now) => finish.run(now, hash),
    getPendingDeletions: () => pending.all(),
    purgeDeletionReceipts: (now) => purge.run(now - receiptLifetime),
  };
}
