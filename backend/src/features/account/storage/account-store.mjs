import { DatabaseSync } from 'node:sqlite';
import { randomInt } from 'node:crypto';
import { createDestinyHistoryStore } from './destiny-history-store.mjs';
import { createReadingHistoryStore } from './reading-history-store.mjs';
import { createAgreementStore } from './agreement-store.mjs';
import { createDeletionStore } from './deletion-store.mjs';
import { createPublicUidStore } from './public-uid-store.mjs';
import { createRelationshipStore } from '../../social/server-entry.mjs';
import { createPrivacyRequestStore } from './privacy-request-store.mjs';

const userColumns = `
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  profile_visibility TEXT,
  nickname_pending INTEGER NOT NULL DEFAULT 0 CHECK (nickname_pending IN (0, 1)),
  password_salt TEXT,
  password_hash TEXT
`;

function inTransaction(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function allowPhoneOnlyUsers(db) {
  const requiresEmail = db.prepare("SELECT \"notnull\" FROM pragma_table_info('account_users') WHERE name = 'email'");
  if (!requiresEmail.get().notnull) return;

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    inTransaction(db, () => {
      if (!requiresEmail.get().notnull) return;
      db.exec(`
        CREATE TABLE account_users_next (${userColumns});
        INSERT INTO account_users_next (id, email, display_name, bio, password_salt, password_hash)
        SELECT id, email, display_name, bio, password_salt, password_hash FROM account_users;
        DROP TABLE account_users;
        ALTER TABLE account_users_next RENAME TO account_users;
      `);
      if (db.prepare('PRAGMA foreign_key_check').get()) throw new Error('Account migration failed foreign key validation.');
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function openAccountStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS account_users (${userColumns});
    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS account_sessions_user ON account_sessions(user_id);
    CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS account_guest_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS account_guest_sessions_expiry ON account_guest_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS account_reading_profiles (
      user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_phones (
      user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS account_phone_logins (
      user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS account_social_identities (
      namespace TEXT NOT NULL,
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      user_id TEXT NOT NULL UNIQUE REFERENCES account_users(id) ON DELETE CASCADE,
      PRIMARY KEY (namespace, provider, subject)
    );
  `);
  allowPhoneOnlyUsers(db);
  const hasProfileVisibility = db.prepare("SELECT 1 FROM pragma_table_info('account_users') WHERE name = 'profile_visibility'");
  if (!hasProfileVisibility.get()) {
    inTransaction(db, () => {
      if (!hasProfileVisibility.get()) db.exec('ALTER TABLE account_users ADD COLUMN profile_visibility TEXT');
    });
  }
  const hasNicknamePending = db.prepare("SELECT 1 FROM pragma_table_info('account_users') WHERE name = 'nickname_pending'");
  if (!hasNicknamePending.get()) {
    inTransaction(db, () => {
      if (!hasNicknamePending.get()) db.exec('ALTER TABLE account_users ADD COLUMN nickname_pending INTEGER NOT NULL DEFAULT 0 CHECK (nickname_pending IN (0, 1))');
    });
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS account_nickname_lookup ON account_users(lower(trim(display_name)));
    CREATE TRIGGER IF NOT EXISTS account_nickname_on_insert BEFORE INSERT ON account_users
    WHEN EXISTS (SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(NEW.display_name)))
    BEGIN SELECT RAISE(ABORT, 'Account nickname already taken'); END;
    CREATE TRIGGER IF NOT EXISTS account_nickname_on_change BEFORE UPDATE OF display_name ON account_users
    WHEN NEW.display_name <> OLD.display_name AND EXISTS (
      SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(NEW.display_name)) AND id <> OLD.id
    )
    BEGIN SELECT RAISE(ABORT, 'Account nickname already taken'); END;
  `);

  const insertUser = db.prepare(`
    INSERT INTO account_users (id, email, display_name, password_salt, password_hash, nickname_pending)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
  `);
  const byEmail = db.prepare('SELECT * FROM account_users WHERE email = ?');
  const byNickname = db.prepare('SELECT id FROM account_users WHERE lower(trim(display_name)) = lower(trim(?)) ORDER BY id');
  const conflictingNickname = db.prepare('SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(?)) AND id <> ? LIMIT 1');
  const profileById = db.prepare('SELECT display_name, bio, profile_visibility FROM account_users WHERE id = ?');
  const byToken = db.prepare(`
    SELECT u.* FROM account_users u JOIN account_sessions s ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `);
  const insertSession = db.prepare(`
    INSERT INTO account_sessions (token_hash, user_id, expires_at)
    SELECT ?, id, ? FROM account_users WHERE id = ? AND password_hash IS ?
  `);
  const purgeSessions = db.prepare('DELETE FROM account_sessions WHERE expires_at <= ?');
  const revokeSession = db.prepare('DELETE FROM account_sessions WHERE token_hash = ?');
  const updateProfile = db.prepare(`
    UPDATE account_users SET display_name = ?, bio = ?, profile_visibility = COALESCE(?, profile_visibility), nickname_pending = 0 WHERE id = ?
    AND EXISTS (
      SELECT 1 FROM account_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
    )
    RETURNING id, email, display_name, bio, password_hash, profile_visibility
  `);
  const updatePassword = db.prepare(`
    UPDATE account_users SET password_salt = ?, password_hash = ?
    WHERE id = ? AND password_hash IS ? AND EXISTS (
      SELECT 1 FROM account_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
    )
  `);
  const revokeOtherSessions = db.prepare('DELETE FROM account_sessions WHERE user_id = ? AND token_hash != ?');
  const revokeUserSessions = db.prepare('DELETE FROM account_sessions WHERE user_id = ?');
  const resetPassword = db.prepare(`
    UPDATE account_users SET password_salt = ?, password_hash = ? WHERE id = ? AND password_hash IS ?
    AND EXISTS (SELECT 1 FROM account_phones WHERE user_id = account_users.id AND phone = ?)
  `);
  const readingByUser = db.prepare('SELECT data FROM account_reading_profiles WHERE user_id = ?');
  const saveReading = db.prepare(`
    INSERT INTO account_reading_profiles (user_id, data)
    SELECT user_id, ? FROM account_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `);
  const phoneByUser = db.prepare('SELECT phone FROM account_phones WHERE user_id = ?');
  const byPhone = db.prepare(`
    SELECT u.* FROM account_users u JOIN account_phones p ON p.user_id = u.id WHERE p.phone = ?
  `);
  const byPhoneLogin = db.prepare(`
    SELECT u.* FROM account_users u JOIN account_phone_logins p ON p.user_id = u.id WHERE p.phone = ?
  `);
  const byPasswordPhone = (phone) => byPhone.get(phone) ?? byPhoneLogin.get(phone);
  const insertPhoneLogin = db.prepare('INSERT INTO account_phone_logins (user_id, phone) VALUES (?, ?)');
  const removePhoneLogin = db.prepare('DELETE FROM account_phone_logins WHERE user_id = ?');
  const savePhone = db.prepare(`
    INSERT INTO account_phones (user_id, phone) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET phone = excluded.phone
  `);
  const bySocial = db.prepare(`
    SELECT u.* FROM account_users u JOIN account_social_identities s ON s.user_id = u.id
    WHERE s.namespace = ? AND s.provider = ? AND s.subject = ?
  `);
  const insertSocial = db.prepare('INSERT INTO account_social_identities VALUES (?, ?, ?, ?)');
  const socialByUser = db.prepare('SELECT provider FROM account_social_identities WHERE user_id = ?');
  const hasSocialIdentity = db.prepare(`SELECT 1 FROM account_social_identities
    WHERE user_id = ? AND namespace = ? AND provider = ? AND subject = ?`);

  const transaction = (run) => inTransaction(db, run);
  const guestByToken = db.prepare('SELECT id, expires_at AS expiresAt FROM account_guest_sessions WHERE token_hash = ? AND expires_at > ?');
  const insertGuest = db.prepare('INSERT INTO account_guest_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)');
  const revokeGuest = db.prepare('DELETE FROM account_guest_sessions WHERE token_hash = ?');
  const purgeGuests = db.prepare('DELETE FROM account_guest_sessions WHERE expires_at <= ?');
  const getGuest = (token, now) => token ? guestByToken.get(token, now) : undefined;

  function getArchiveIdentity(token, now) {
    if (!token) return;
    const member = byToken.get(token, now);
    if (member) return { kind: 'member', id: member.id };
    const guest = getGuest(token, now);
    if (guest) return { kind: 'guest', id: guest.id };
  }

  function nicknameTaken(name, owner = '') {
    return Boolean(conflictingNickname.get(name, owner));
  }

  function generatedNickname(preferred) {
    if (!nicknameTaken(preferred)) return preferred;
    const prefix = Array.from(preferred).slice(0, 32).join('');
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = prefix + ' ' + randomInt(1_000_000, 10_000_000);
      if (!nicknameTaken(candidate)) return candidate;
    }
    throw new Error('Cannot allocate a unique nickname');
  }

  return {
    ...createDestinyHistoryStore(db, transaction, getArchiveIdentity),
    ...createReadingHistoryStore(db, transaction, getArchiveIdentity),
    ...createAgreementStore(db, transaction),
    ...createDeletionStore(db, transaction, getArchiveIdentity),
    ...createPublicUidStore(db),
    social: createRelationshipStore(db, transaction),
    privacyRequests: createPrivacyRequestStore(db, transaction),
    matchesSocialIdentity: (userId, namespace, provider, subject) =>
      Boolean(hasSocialIdentity.get(userId, namespace, provider, subject)),
    getArchiveIdentity,
    getGuest,
    startGuest({ id, token, expiresAt }) {
      insertGuest.run(id, token, expiresAt);
      return { id, expiresAt };
    },
    revokeGuest: (token) => revokeGuest.run(token),
    purgeGuests: (now) => purgeGuests.run(now),
    register({ id, email, phone, displayName, salt, passwordHash, tokenHash, expiresAt, now }) {
      return transaction(() => {
        if (nicknameTaken(displayName)) return;
        if (phone && byPasswordPhone(phone)) return;
        if (insertUser.run(id, email, displayName, salt, passwordHash, 0).changes === 0) return;
        if (phone) insertPhoneLogin.run(id, phone);
        purgeSessions.run(now);
        insertSession.run(tokenHash, expiresAt, id, passwordHash);
        return { id, email, display_name: displayName, bio: '', password_hash: passwordHash };
      });
    },
    getByEmail: (email) => byEmail.get(email),
    findUsersByNickname: (nickname) => byNickname.all(nickname).map(({ id }) => id),
    getProfile: (userId) => profileById.get(userId),
    getBySession: (tokenHash, now) => byToken.get(tokenHash, now),
    getByPhone: (phone) => byPhone.get(phone),
    getByPasswordPhone: byPasswordPhone,
    getPhone: (userId) => phoneByUser.get(userId)?.phone ?? null,
    getSocialProvider: (userId) => socialByUser.get(userId)?.provider,
    getReadingProfile(userId) {
      const row = readingByUser.get(userId);
      return row ? JSON.parse(row.data) : undefined;
    },
    updateReadingProfile(userId, tokenHash, now, update) {
      return transaction(() => {
        if (byToken.get(tokenHash, now)?.id !== userId) return;
        const row = readingByUser.get(userId);
        const data = update(row ? JSON.parse(row.data) : undefined);
        if (saveReading.run(JSON.stringify(data), tokenHash, userId, now).changes === 1) return data;
      });
    },
    bindPhone(user, tokenHash, now, phone, currentPhone) {
      return transaction(() => {
        const active = byToken.get(tokenHash, now);
        if (active?.id !== user.id || active.password_hash !== user.password_hash) return 'expired';
        if (user.email === null && (phoneByUser.get(user.id)?.phone ?? null) !== currentPhone) return 'expired';
        const previous = byPhone.get(phone);
        if (previous) return previous.id === user.id ? 'unchanged' : 'taken';
        const phoneLogin = byPhoneLogin.get(phone);
        if (phoneLogin && phoneLogin.id !== user.id) return 'taken';
        savePhone.run(user.id, phone);
        removePhoneLogin.run(user.id);
        revokeOtherSessions.run(user.id, tokenHash);
        return 'saved';
      });
    },
    createSession(user, tokenHash, expiresAt, now, phone) {
      return transaction(() => {
        if (phone && byPasswordPhone(phone)?.id !== user.id) return false;
        purgeSessions.run(now);
        return insertSession.run(tokenHash, expiresAt, user.id, user.password_hash).changes === 1;
      });
    },
    startPhoneSession({ phone, expectedUserId, newId, tokenHash, expiresAt, now }) {
      return transaction(() => {
        let user = byPhone.get(phone);
        if (user?.id !== expectedUserId) return;
        const created = !user;
        if (!user) {
          if (byPhoneLogin.get(phone)) return 'password-required';
          insertUser.run(newId, null, generatedNickname('待设置昵称'), null, null, 1);
          savePhone.run(newId, phone);
          user = byPhone.get(phone);
        }
        purgeSessions.run(now);
        insertSession.run(tokenHash, expiresAt, user.id, user.password_hash);
        return { user, created };
      });
    },
    startSocialSession({ namespace, provider, subject, newId, tokenHash, expiresAt, now }) {
      return transaction(() => {
        let user = bySocial.get(namespace, provider, subject);
        const created = !user;
        if (!user) {
          insertUser.run(newId, null, generatedNickname('待设置昵称'), null, null, 1);
          insertSocial.run(namespace, provider, subject, newId);
          user = bySocial.get(namespace, provider, subject);
        }
        purgeSessions.run(now);
        insertSession.run(tokenHash, expiresAt, user.id, user.password_hash);
        return { user, created };
      });
    },
    revokeSession: (tokenHash) => revokeSession.run(tokenHash),
    updateProfile(userId, tokenHash, now, { displayName, bio, visibility }) {
      return transaction(() => {
        const current = byToken.get(tokenHash, now);
        if (current?.id !== userId) return;
        if (displayName !== current.display_name && nicknameTaken(displayName, userId)) return 'nickname-taken';
        return updateProfile.get(displayName, bio, visibility ? JSON.stringify(visibility) : null, userId, tokenHash, userId, now);
      });
    },
    changePassword(user, tokenHash, now, salt, passwordHash, phone) {
      return transaction(() => {
        if (phone && phoneByUser.get(user.id)?.phone !== phone) return false;
        const changed = updatePassword.run(salt, passwordHash, user.id, user.password_hash, tokenHash, user.id, now);
        if (changed.changes === 0) return false;
        revokeOtherSessions.run(user.id, tokenHash);
        return true;
      });
    },
    resetPassword(user, phone, salt, passwordHash) {
      return transaction(() => {
        if (resetPassword.run(salt, passwordHash, user.id, user.password_hash, phone).changes !== 1) return false;
        revokeUserSessions.run(user.id);
        return true;
      });
    },
    close: () => db.close(),
  };
}
