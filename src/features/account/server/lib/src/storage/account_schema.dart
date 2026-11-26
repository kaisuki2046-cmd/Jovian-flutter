import 'package:sqlite3/sqlite3.dart';

const _users = '''
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  profile_visibility TEXT,
  nickname_pending INTEGER NOT NULL DEFAULT 0 CHECK (nickname_pending IN (0, 1)),
  password_salt TEXT,
  password_hash TEXT
''';

T accountTransaction<T>(Database db, T Function() work) {
  db.execute('BEGIN IMMEDIATE');
  try {
    final result = work();
    db.execute('COMMIT');
    return result;
  } catch (_) {
    db.execute('ROLLBACK');
    rethrow;
  }
}

void prepareAccountSchema(Database db) {
  db.execute('''
    PRAGMA busy_timeout = 3000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS account_users ($_users);
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
    CREATE TABLE IF NOT EXISTS account_public_uids (
      user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
      uid TEXT NOT NULL UNIQUE CHECK (length(uid) = 8 AND uid NOT GLOB '*[^0-9]*' AND substr(uid, 1, 1) <> '0')
    );
  ''');
  _allowPhoneOnlyUsers(db);
  accountTransaction(db, () {
    final columns = db
        .select('PRAGMA table_info(account_users)')
        .map((row) => row['name'])
        .toSet();
    if (!columns.contains('profile_visibility')) {
      db.execute(
        'ALTER TABLE account_users ADD COLUMN profile_visibility TEXT',
      );
    }
    if (!columns.contains('nickname_pending')) {
      db.execute('''
        ALTER TABLE account_users ADD COLUMN nickname_pending INTEGER NOT NULL
        DEFAULT 0 CHECK (nickname_pending IN (0, 1))
      ''');
    }
    db.execute('''
      CREATE INDEX IF NOT EXISTS account_nickname_lookup ON account_users(lower(trim(display_name)));
      CREATE TRIGGER IF NOT EXISTS account_nickname_on_insert BEFORE INSERT ON account_users
      WHEN EXISTS (SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(NEW.display_name)))
      BEGIN SELECT RAISE(ABORT, 'Account nickname already taken'); END;
      CREATE TRIGGER IF NOT EXISTS account_nickname_on_change BEFORE UPDATE OF display_name ON account_users
      WHEN NEW.display_name <> OLD.display_name AND EXISTS (
        SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(NEW.display_name)) AND id <> OLD.id
      )
      BEGIN SELECT RAISE(ABORT, 'Account nickname already taken'); END;
    ''');
  });
}

void _allowPhoneOnlyUsers(Database db) {
  bool requiresEmail() =>
      db
          .select(
            'SELECT "notnull" FROM pragma_table_info(\'account_users\') WHERE name = \'email\'',
          )
          .single['notnull'] ==
      1;
  if (!requiresEmail()) return;
  db.execute('PRAGMA foreign_keys = OFF');
  try {
    accountTransaction(db, () {
      if (!requiresEmail()) return;
      final columns = db
          .select('PRAGMA table_info(account_users)')
          .map((row) => row['name'])
          .toSet();
      final profile = columns.contains('profile_visibility')
          ? 'profile_visibility'
          : 'NULL';
      final pending = columns.contains('nickname_pending')
          ? 'nickname_pending'
          : '0';
      db.execute('''
        CREATE TABLE account_users_next ($_users);
        INSERT INTO account_users_next
          (id, email, display_name, bio, profile_visibility, nickname_pending, password_salt, password_hash)
        SELECT id, email, display_name, bio, $profile, $pending, password_salt, password_hash FROM account_users;
        DROP TABLE account_users;
        ALTER TABLE account_users_next RENAME TO account_users;
      ''');
      if (db.select('PRAGMA foreign_key_check').isNotEmpty) {
        throw StateError('Account migration failed foreign key validation.');
      }
    });
  } finally {
    db.execute('PRAGMA foreign_keys = ON');
  }
}
