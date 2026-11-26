import 'dart:convert';

import 'package:sqlite3/sqlite3.dart';

import '../history/archive_model.dart';
import 'account_agreement_store.dart';
import 'account_schema.dart';

class AccountHistoryStore {
  AccountHistoryStore(this._db) {
    for (final owner in AccountOwnerKind.values) {
      final parent = owner == AccountOwnerKind.member
          ? 'account_users'
          : 'account_guest_sessions';
      final destiny = _table(owner, 'destiny');
      final reading = _table(owner, 'fortune');
      _db.execute('''
        CREATE TABLE IF NOT EXISTS $destiny (
          user_id TEXT NOT NULL REFERENCES $parent(id) ON DELETE CASCADE,
          id TEXT NOT NULL, saved_at INTEGER NOT NULL,
          calculated_at TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL,
          PRIMARY KEY (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ${destiny}_order ON $destiny(user_id, saved_at DESC, id DESC);
        CREATE TABLE IF NOT EXISTS $reading (
          user_id TEXT NOT NULL REFERENCES $parent(id) ON DELETE CASCADE,
          id TEXT NOT NULL, kind TEXT NOT NULL, context_key TEXT NOT NULL, saved_at INTEGER NOT NULL,
          calculated_at TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL,
          PRIMARY KEY (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ${reading}_lookup ON $reading(user_id, kind, context_key, saved_at DESC);
      ''');
    }
  }

  final Database _db;
  static const _order = 'ORDER BY saved_at DESC, rowid DESC';

  static String _table(AccountOwnerKind owner, String kind) {
    final scope = owner == AccountOwnerKind.guest ? 'guest_' : '';
    return 'account_$scope${kind == 'destiny' ? 'destiny' : 'reading'}_history';
  }

  String _fields(String kind) =>
      'id, saved_at AS savedAt, calculated_at AS calculatedAt, title${kind == 'destiny' ? '' : ', kind'}';

  String _ownerFilter(String kind) =>
      kind == 'destiny' ? 'user_id = ?' : 'user_id = ? AND kind = ?';

  List<Object?> _ownerValues(AccountOwner owner, String kind) => [
    owner.id,
    if (kind != 'destiny') kind,
  ];

  Map<String, Object?>? save({
    required AccountOwner owner,
    required String kind,
    required String id,
    required Map<String, Object?> report,
    required String serialized,
    required int now,
    required bool Function() stillAuthorized,
  }) => accountTransaction(_db, () {
    if (!stillAuthorized()) return null;
    final table = _table(owner.kind, kind);
    final destiny = kind == 'destiny';
    _db.execute(
      destiny
          ? 'INSERT INTO $table (user_id, id, saved_at, calculated_at, title, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO NOTHING'
          : 'INSERT INTO $table (user_id, id, kind, context_key, saved_at, calculated_at, title, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO NOTHING',
      [
        owner.id,
        id,
        if (!destiny) ...[kind, report['contextKey']],
        now,
        report['calculatedAt'],
        destiny ? '命盘记录' : report['title'],
        serialized,
      ],
    );
    if (!destiny) return detail(owner, kind, id);
    final entry = _db.select(
      'SELECT ${_fields(kind)} FROM $table WHERE user_id = ? AND id = ?',
      [owner.id, id],
    ).single;
    return {
      ...entry,
      if (report.containsKey('chartSnapshot')) 'chartSnapshotSaved': true,
    };
  });

  Map<String, Object?>? detail(AccountOwner owner, String kind, String id) {
    final table = _table(owner.kind, kind);
    final rows = _db.select(
      'SELECT ${_fields(kind)}, data FROM $table WHERE ${_ownerFilter(kind)} AND id = ?',
      [..._ownerValues(owner, kind), id],
    );
    return rows.isEmpty ? null : _record(rows.single, kind);
  }

  Map<String, Object?>? latest(
    AccountOwner owner,
    String kind,
    String? contextKey,
  ) {
    final table = _table(owner.kind, kind);
    final byContext = kind != 'destiny' && contextKey != null;
    final filter = byContext ? ' AND context_key = ?' : '';
    final rows = _db.select(
      'SELECT ${_fields(kind)}, data FROM $table WHERE ${_ownerFilter(kind)}$filter $_order LIMIT 1',
      [..._ownerValues(owner, kind), if (byContext) contextKey],
    );
    return rows.isEmpty ? null : _record(rows.single, kind);
  }

  Map<String, Object?>? page(AccountOwner owner, String kind, String? before) {
    final table = _table(owner.kind, kind);
    final filter = _ownerFilter(kind);
    final values = _ownerValues(owner, kind);
    if (before != null) {
      final offsets = _db.select(
        'SELECT saved_at, rowid FROM $table WHERE $filter AND id = ?',
        [...values, before],
      );
      if (offsets.isEmpty) return null;
      final cursor = offsets.single;
      values.addAll([cursor['saved_at'], cursor['rowid']]);
    }
    final extra = before == null ? '' : ' AND (saved_at, rowid) < (?, ?)';
    final rows = _db.select(
      'SELECT ${_fields(kind)} FROM $table WHERE $filter$extra $_order LIMIT 21',
      values,
    );
    return {
      'entries': rows.take(20).map((row) => {...row}).toList(),
      'nextCursor': rows.length > 20 ? rows[19]['id'] : null,
    };
  }

  Map<String, Object?> _record(Row row, String kind) {
    final entry = {...row};
    final stored =
        jsonDecode(entry.remove('data') as String) as Map<String, Object?>;
    if (kind == 'destiny' && stored.containsKey('sections')) {
      final report = parseDestinyArchive(stored, storedLegacy: true);
      if (report == null) throw StateError('Invalid stored destiny archive.');
      return {...entry, 'report': report};
    }
    return {...entry, 'report': stored};
  }
}
