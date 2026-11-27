import { randomInt } from 'node:crypto';

export function createPublicUidStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_public_uids (
    user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
    uid TEXT NOT NULL UNIQUE CHECK (length(uid) = 8 AND uid NOT GLOB '*[^0-9]*' AND substr(uid, 1, 1) <> '0')
  )`);
  const byUser = db.prepare('SELECT uid FROM account_public_uids WHERE user_id = ?');
  const byUid = db.prepare('SELECT user_id FROM account_public_uids WHERE uid = ?');
  const insert = db.prepare(`INSERT INTO account_public_uids (user_id, uid)
    VALUES (?, ?) ON CONFLICT DO NOTHING`);
  return {
    getPublicUid(userId) {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const existing = byUser.get(userId);
        if (existing) return existing.uid;
        const uid = String(randomInt(10_000_000, 100_000_000));
        if (insert.run(userId, uid).changes === 1) return uid;
      }
      throw new Error('Cannot allocate a public UID');
    },
    findUserByUid: (uid) => byUid.get(uid)?.user_id,
  };
}
