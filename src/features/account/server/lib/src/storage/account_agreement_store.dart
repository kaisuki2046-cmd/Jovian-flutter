import 'dart:convert';

import 'package:jovian_compliance_server/jovian_compliance_server.dart';
import 'package:sqlite3/sqlite3.dart';

import 'account_schema.dart';

enum AccountOwnerKind { member, guest }

typedef AccountOwner = ({AccountOwnerKind kind, String id});
typedef ConsentDecision = ({
  AgreementDocument document,
  String purpose,
  bool agreed,
});

class AccountAgreementStore {
  AccountAgreementStore(this._db) {
    _db.execute('''
      CREATE TABLE IF NOT EXISTS account_agreement_versions (
        agreement_id TEXT NOT NULL, version TEXT NOT NULL,
        hash TEXT NOT NULL, document TEXT NOT NULL,
        PRIMARY KEY (agreement_id, version)
      );
      CREATE TABLE IF NOT EXISTS account_agreement_decisions (
        id INTEGER PRIMARY KEY,
        member_id TEXT REFERENCES account_users(id) ON DELETE CASCADE,
        guest_id TEXT REFERENCES account_guest_sessions(id) ON DELETE CASCADE,
        agreement_id TEXT NOT NULL, version TEXT NOT NULL, purpose TEXT NOT NULL,
        agreed INTEGER NOT NULL CHECK (agreed IN (0, 1)),
        decided_at INTEGER NOT NULL, source TEXT NOT NULL,
        CHECK ((member_id IS NULL) <> (guest_id IS NULL)),
        FOREIGN KEY (agreement_id, version) REFERENCES account_agreement_versions(agreement_id, version)
      );
      CREATE INDEX IF NOT EXISTS account_member_agreement_owner ON account_agreement_decisions(member_id, id);
      CREATE INDEX IF NOT EXISTS account_guest_agreement_owner ON account_agreement_decisions(guest_id, id);
    ''');
  }

  final Database _db;

  void seed(List<AgreementDocument> documents) => accountTransaction(_db, () {
    for (final document in documents) {
      final data = document.toJson();
      _db.execute(
        '''
        INSERT INTO account_agreement_versions (agreement_id, version, hash, document)
        VALUES (?, ?, ?, ?) ON CONFLICT(agreement_id, version) DO NOTHING
      ''',
        [document.id, document.version, document.hash, jsonEncode(data)],
      );
      final stored = version(document.id, document.version)!;
      if (stored['hash'] != document.hash || stored['state'] != data['state']) {
        throw StateError(
          'Publish a new agreement version before changing ${document.id}/${document.version}.',
        );
      }
    }
  });

  Map<String, Object?>? version(String id, String version) {
    final rows = _db.select(
      '''
      SELECT document FROM account_agreement_versions WHERE agreement_id = ? AND version = ?
    ''',
      [id, version],
    );
    return rows.isEmpty
        ? null
        : jsonDecode(rows.single['document'] as String) as Map<String, Object?>;
  }

  Iterable<Map<String, Object?>> history(AccountOwner owner) => _db
      .select(
        '''
    SELECT agreement_id AS agreementId, version, purpose, agreed, decided_at AS decidedAt, source
    FROM account_agreement_decisions WHERE ${_ownerColumn(owner)} = ? ORDER BY id DESC
  ''',
        [owner.id],
      )
      .map((row) => {...row, 'agreed': row['agreed'] == 1});

  bool accepted(
    AccountOwner owner,
    AgreementDocument document,
    String purpose,
  ) => _latest(owner, document, purpose) == true;

  bool? _latest(
    AccountOwner owner,
    AgreementDocument document,
    String purpose,
  ) {
    final rows = _db.select(
      '''
      SELECT agreed FROM account_agreement_decisions WHERE ${_ownerColumn(owner)} = ?
      AND agreement_id = ? AND version = ? AND purpose = ? ORDER BY id DESC LIMIT 1
    ''',
      [owner.id, document.id, document.version, purpose],
    );
    return rows.isEmpty ? null : rows.single['agreed'] == 1;
  }

  bool save({
    required AccountOwner owner,
    required List<ConsentDecision> decisions,
    required int now,
    required String source,
    required bool Function() stillAuthorized,
  }) => accountTransaction(_db, () {
    if (!stillAuthorized()) return false;
    for (final decision in decisions) {
      final (:document, :purpose, :agreed) = decision;
      if (_latest(owner, document, purpose) == agreed) continue;
      _db.execute(
        '''
        INSERT INTO account_agreement_decisions
          (member_id, guest_id, agreement_id, version, purpose, agreed, decided_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ''',
        [
          if (owner.kind == AccountOwnerKind.member) owner.id else null,
          if (owner.kind == AccountOwnerKind.guest) owner.id else null,
          document.id,
          document.version,
          purpose,
          agreed ? 1 : 0,
          now,
          source,
        ],
      );
    }
    return true;
  });
}

String _ownerColumn(AccountOwner owner) =>
    owner.kind == AccountOwnerKind.member ? 'member_id' : 'guest_id';
