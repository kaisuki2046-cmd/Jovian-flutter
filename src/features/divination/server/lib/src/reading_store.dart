import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:sqlite3/sqlite3.dart';

const readingLifetime = Duration(days: 1);
final _tokenPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');
final _hashPattern = RegExp(r'^[a-f0-9]{64}$');
final _random = Random.secure();

enum ReadingOwnerKind { member, guest }

class ReadingOwner {
  const ReadingOwner(this.kind, this.id);

  final ReadingOwnerKind kind;
  final String id;

  String get _key => _digest('${kind.name}:$id');
}

String _digest(String input) => sha256.convert(utf8.encode(input)).toString();

String _tokenKey(String token) {
  if (!_tokenPattern.hasMatch(token)) {
    throw const GuideRitualError(401, 'invalid_task_token');
  }
  return _digest(token);
}

class ReadingSessionStore {
  ReadingSessionStore(String path, {DateTime Function()? now})
    : _now = now ?? DateTime.now,
      _db = sqlite3.open(path) {
    try {
      _db.execute('''
        PRAGMA busy_timeout = 5000;
        PRAGMA journal_mode = WAL;
        PRAGMA secure_delete = ON;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS tarot_sessions (
          token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tarot_session_expiration ON tarot_sessions(expires);
        CREATE TABLE IF NOT EXISTS reading_session_owners (
          token_hash TEXT PRIMARY KEY REFERENCES tarot_sessions(token_hash) ON DELETE CASCADE,
          owner_key TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS reading_session_owner_lookup ON reading_session_owners(owner_key);
        CREATE TABLE IF NOT EXISTS reading_deleted_owners (
          owner_key TEXT PRIMARY KEY, expires INTEGER NOT NULL
        );
      ''');
    } catch (_) {
      _db.close();
      rethrow;
    }
  }

  final DateTime Function() _now;
  final Database _db;

  void close() => _db.close();

  String create(Map<String, Object?> payload, ReadingOwner? owner) {
    final token = base64Url
        .encode(List.generate(32, (_) => _random.nextInt(256)))
        .replaceAll('=', '');
    final hash = _tokenKey(token);
    final ownerKey = owner?._key;
    _transaction(() {
      if (ownerKey != null &&
          _db.select(
            'SELECT 1 FROM reading_deleted_owners WHERE owner_key = ?',
            [ownerKey],
          ).isNotEmpty) {
        throw const GuideRitualError(401, 'account_session_required');
      }
      _db.execute('INSERT INTO tarot_sessions VALUES (?, ?, ?)', [
        hash,
        _now().add(readingLifetime).millisecondsSinceEpoch,
        jsonEncode(payload),
      ]);
      if (ownerKey != null) {
        _db.execute('INSERT INTO reading_session_owners VALUES (?, ?)', [
          hash,
          ownerKey,
        ]);
      }
    });
    return token;
  }

  Map<String, Object?> get(String token, ReadingOwner? owner) =>
      _load(_tokenKey(token), owner);

  T change<T>(
    String token,
    ReadingOwner? owner,
    ({T result, bool changed}) Function(Map<String, Object?> payload) edit,
  ) {
    final key = _tokenKey(token);
    return _transaction(() {
      final payload = _load(key, owner);
      final editResult = edit(payload);
      if (editResult.changed) {
        _db.execute(
          'UPDATE tarot_sessions SET payload = ? WHERE token_hash = ?',
          [jsonEncode(payload), key],
        );
      }
      return editResult.result;
    });
  }

  void eraseMember(String id, {Iterable<String> legacyHashes = const []}) {
    final ownerKey = ReadingOwner(ReadingOwnerKind.member, id)._key;
    _transaction(() {
      _db.execute(
        'INSERT OR REPLACE INTO reading_deleted_owners VALUES (?, ?)',
        [ownerKey, _now().add(readingLifetime).millisecondsSinceEpoch],
      );
      _db.execute(
        '''
        DELETE FROM tarot_sessions WHERE token_hash IN (
          SELECT token_hash FROM reading_session_owners WHERE owner_key = ?
        )
      ''',
        [ownerKey],
      );
      for (final hash in legacyHashes.toSet()) {
        if (!_hashPattern.hasMatch(hash)) continue;
        _db.execute(
          '''
          DELETE FROM tarot_sessions WHERE token_hash = ? AND NOT EXISTS (
            SELECT 1 FROM reading_session_owners WHERE token_hash = tarot_sessions.token_hash
          )
        ''',
          [hash],
        );
      }
    });
  }

  void clearExpired() {
    final now = _now().millisecondsSinceEpoch;
    _transaction(() {
      _db.execute('DELETE FROM tarot_sessions WHERE expires <= ?', [now]);
      _db.execute('DELETE FROM reading_deleted_owners WHERE expires <= ?', [
        now,
      ]);
    });
  }

  Map<String, Object?> _load(String hash, ReadingOwner? owner) {
    final rows = _db.select(
      '''
      SELECT sessions.payload, owners.owner_key FROM tarot_sessions AS sessions
      LEFT JOIN reading_session_owners AS owners ON owners.token_hash = sessions.token_hash
      WHERE sessions.token_hash = ? AND sessions.expires > ?
    ''',
      [hash, _now().millisecondsSinceEpoch],
    );
    final ownerKey = rows.isEmpty ? null : rows.first['owner_key'];
    if (rows.isEmpty || (ownerKey != null && ownerKey != owner?._key)) {
      throw const GuideRitualError(404, 'task_not_found');
    }
    final value = jsonDecode(rows.first['payload'] as String);
    if (value is! Map<String, Object?>) {
      throw const FormatException('Invalid saved reading session.');
    }
    return value;
  }

  T _transaction<T>(T Function() operation) {
    _db.execute('BEGIN IMMEDIATE');
    try {
      final result = operation();
      _db.execute('COMMIT');
      return result;
    } catch (_) {
      _db.execute('ROLLBACK');
      rethrow;
    }
  }
}
