import 'dart:convert';
import 'dart:math';

import 'package:sqlite3/sqlite3.dart';

import '../auth/password.dart';
import '../auth/session_secret.dart';
import 'account_agreement_store.dart';
import 'account_history_store.dart';
import 'account_schema.dart';

class AccountRecord {
  AccountRecord._(Row row)
    : id = row['id'] as String,
      email = row['email'] as String?,
      displayName = row['display_name'] as String,
      bio = row['bio'] as String,
      nicknamePending = row['nickname_pending'] == 1,
      _salt = row['password_salt'] as String?,
      _hash = row['password_hash'] as String?,
      _visibility = row['profile_visibility'] as String?;

  final String id;
  final String? email;
  final String displayName;
  final String bio;
  final bool nicknamePending;
  final String? _salt;
  final String? _hash;
  final String? _visibility;

  StoredPassword? get credentials =>
      _salt == null || _hash == null ? null : (salt: _salt, hash: _hash);
}

typedef AccountGuest = ({String id, int expiresAt});
typedef ProfileUpdate = ({
  String displayName,
  String bio,
  Map<String, bool>? visibility,
});

class AccountAuthStore {
  AccountAuthStore(String path) : _db = sqlite3.open(path) {
    try {
      prepareAccountSchema(_db);
    } catch (_) {
      _db.close();
      rethrow;
    }
  }

  final Database _db;
  final _random = Random.secure();
  late final agreements = AccountAgreementStore(_db);
  late final history = AccountHistoryStore(_db);

  void close() => _db.close();

  Row? _one(String sql, List<Object?> arguments) {
    final rows = _db.select(sql, arguments);
    return rows.isEmpty ? null : rows.first;
  }

  AccountRecord? _record(String sql, List<Object?> arguments) {
    final row = _one(sql, arguments);
    return row == null ? null : AccountRecord._(row);
  }

  AccountRecord? byEmail(String email) =>
      _record('SELECT * FROM account_users WHERE email = ?', [email]);

  AccountRecord? byPasswordPhone(String phone) =>
      _record(
        '''
        SELECT u.* FROM account_phones p
        JOIN account_users u ON u.id = p.user_id WHERE p.phone = ?
      ''',
        [phone],
      ) ??
      _record(
        '''
        SELECT u.* FROM account_phone_logins p
        JOIN account_users u ON u.id = p.user_id WHERE p.phone = ?
      ''',
        [phone],
      );

  AccountRecord? memberBySession(String? session, int now) => session == null
      ? null
      : _record(
          '''
          SELECT u.* FROM account_sessions s JOIN account_users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ?
        ''',
          [session, now],
        );

  AccountGuest? guestBySession(String? session, int now) {
    if (session == null) return null;
    final row = _one(
      '''
      SELECT id, expires_at FROM account_guest_sessions
      WHERE token_hash = ? AND expires_at > ?
    ''',
      [session, now],
    );
    return row == null
        ? null
        : (id: row['id'] as String, expiresAt: row['expires_at'] as int);
  }

  AccountOwner? ownerBySession(String? session, int now) {
    final member = memberBySession(session, now);
    if (member != null) {
      return (kind: AccountOwnerKind.member, id: member.id);
    }
    final guest = guestBySession(session, now);
    return guest == null ? null : (kind: AccountOwnerKind.guest, id: guest.id);
  }

  AccountGuest createGuest(
    String id,
    String session,
    int now,
  ) => accountTransaction(_db, () {
    _db.execute('DELETE FROM account_guest_sessions WHERE expires_at <= ?', [
      now,
    ]);
    final expires = now + accountSessionTTL.inMilliseconds;
    _db.execute(
      'INSERT INTO account_guest_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)',
      [id, session, expires],
    );
    return (id: id, expiresAt: expires);
  });

  AccountRecord? register({
    required String id,
    required String? email,
    required String? phone,
    required String displayName,
    required StoredPassword credentials,
    required String session,
    required int now,
    String? previousSession,
  }) => accountTransaction(_db, () {
    if ((email == null) == (phone == null)) {
      throw ArgumentError(
        'Password registration requires a single identifier.',
      );
    }
    final nicknameTaken = _one(
      'SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(?)) LIMIT 1',
      [displayName],
    );
    if (nicknameTaken != null ||
        (phone != null && byPasswordPhone(phone) != null)) {
      return null;
    }
    final created = _one(
      '''
      INSERT INTO account_users (id, email, display_name, password_salt, password_hash)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING RETURNING *
    ''',
      [id, email, displayName, credentials.salt, credentials.hash],
    );
    if (created == null) return null;
    if (phone != null) {
      _db.execute(
        'INSERT INTO account_phone_logins (user_id, phone) VALUES (?, ?)',
        [id, phone],
      );
    }
    if (!_rotateAccountSession(
      id,
      credentials.hash,
      session,
      now,
      previousSession,
    )) {
      throw StateError('Could not create the registered account session.');
    }
    return AccountRecord._(created);
  });

  bool createMemberSession({
    required AccountRecord verified,
    required String session,
    required int now,
    String? phone,
    String? previousSession,
  }) => accountTransaction(_db, () {
    if (phone != null && byPasswordPhone(phone)?.id != verified.id) {
      return false;
    }
    return _rotateAccountSession(
      verified.id,
      verified._hash,
      session,
      now,
      previousSession,
    );
  });

  bool _rotateAccountSession(
    String user,
    String? hash,
    String session,
    int now,
    String? previousSession,
  ) {
    _db.execute('DELETE FROM account_sessions WHERE expires_at <= ?', [now]);
    final created = _one(
      '''
      INSERT INTO account_sessions (token_hash, user_id, expires_at)
      SELECT ?, id, ? FROM account_users WHERE id = ? AND password_hash IS ?
      RETURNING token_hash
    ''',
      [session, now + accountSessionTTL.inMilliseconds, user, hash],
    );
    if (created == null) return false;
    _revoke(previousSession);
    return true;
  }

  void revoke(String? session) =>
      accountTransaction(_db, () => _revoke(session));

  void _revoke(String? session) {
    if (session == null) return;
    _db.execute('DELETE FROM account_sessions WHERE token_hash = ?', [session]);
    _db.execute('DELETE FROM account_guest_sessions WHERE token_hash = ?', [
      session,
    ]);
  }

  (AccountRecord?, bool nicknameTaken) updateProfile({
    required AccountRecord owner,
    required String? session,
    required int now,
    required ProfileUpdate update,
  }) => accountTransaction(_db, () {
    final active = memberBySession(session, now);
    if (active == null || active.id != owner.id) return (null, false);
    if (active.displayName != update.displayName &&
        _one(
              'SELECT 1 FROM account_users WHERE lower(trim(display_name)) = lower(trim(?)) AND id <> ? LIMIT 1',
              [update.displayName, owner.id],
            ) !=
            null) {
      return (null, true);
    }
    final visibility = update.visibility;
    final changed = _record(
      '''
      UPDATE account_users SET display_name = ?, bio = ?,
        profile_visibility = COALESCE(?, profile_visibility), nickname_pending = 0
      WHERE id = ? AND EXISTS (
        SELECT 1 FROM account_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
      ) RETURNING *
    ''',
      [
        update.displayName,
        update.bio,
        visibility == null ? null : jsonEncode(visibility),
        owner.id,
        session,
        owner.id,
        now,
      ],
    );
    return (changed, false);
  });

  bool replacePassword({
    required AccountRecord owner,
    required String? session,
    required StoredPassword credentials,
    required int now,
  }) => accountTransaction(_db, () {
    final changed = _one(
      '''
      UPDATE account_users SET password_salt = ?, password_hash = ?
      WHERE id = ? AND password_hash IS ? AND EXISTS (
        SELECT 1 FROM account_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?
      ) RETURNING id
    ''',
      [
        credentials.salt,
        credentials.hash,
        owner.id,
        owner._hash,
        session,
        owner.id,
        now,
      ],
    );
    if (changed == null) return false;
    _db.execute(
      'DELETE FROM account_sessions WHERE user_id = ? AND token_hash != ?',
      [owner.id, session],
    );
    return true;
  });

  Map<String, Object?> ownerProfile(AccountRecord user) {
    final social = _one(
      'SELECT provider FROM account_social_identities WHERE user_id = ?',
      [user.id],
    );
    final visibility = user._visibility == null
        ? null
        : jsonDecode(user._visibility);
    return {
      'id': user.id,
      'email': user.email,
      'displayName': user.displayName,
      'bio': user.bio,
      'hasPassword': user._hash != null && user._hash.isNotEmpty,
      if (visibility is Map)
        'visibility': {
          'displayName': visibility['displayName'] == true,
          'bio': visibility['bio'] == true,
        },
      'uid': _allocateUid(user.id),
      if (social != null) 'socialProvider': social['provider'],
      if (user.nicknamePending) 'nicknameRequired': true,
    };
  }

  String _allocateUid(String user) {
    for (var attempt = 0; attempt < 16; attempt++) {
      final existing = _one(
        'SELECT uid FROM account_public_uids WHERE user_id = ?',
        [user],
      );
      if (existing != null) return existing['uid'] as String;
      final candidate = (10000000 + _random.nextInt(90000000)).toString();
      final created = _one(
        '''
        INSERT INTO account_public_uids (user_id, uid)
        VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING uid
      ''',
        [user, candidate],
      );
      if (created != null) return candidate;
    }
    throw StateError('Cannot allocate a public UID.');
  }
}
