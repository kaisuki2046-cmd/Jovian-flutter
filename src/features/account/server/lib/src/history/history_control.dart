import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../account_failure.dart';
import '../account_limits.dart';
import '../storage/account_agreement_store.dart';
import '../storage/account_auth_store.dart';
import 'archive_model.dart';
import 'synastry_projection.dart';

final _ownerPattern = RegExp(r'^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$');

class AccountHistoryControl {
  AccountHistoryControl(this._store, this._limits, this._now) {
    // Prepare tables at startup so all writes use the same foreign-key graph.
    _store.history;
  }

  final AccountAuthStore _store;
  final AccountLimits _limits;
  final int Function() _now;

  AccountOwner _owner(String? session) =>
      _store.ownerBySession(session, _now()) ?? failAccount(401);

  AccountOwner _checkOwner(String? session, Object? expected, bool destiny) {
    final owner = _owner(session);
    if (destiny && (expected is! String || !_ownerPattern.hasMatch(expected)))
      failAccount(400);
    if (owner.id != expected) failAccount(403);
    return owner;
  }

  Future<Map<String, Object?>> save(
    String? session, {
    required bool destiny,
    required Future<Map<String, Object?>> Function() read,
  }) async {
    final initial = _owner(session);
    if (destiny) _limits.hit('destiny-archive:${initial.id}', 60, _now());
    final body = await read();
    final owner = _checkOwner(session, body['expectedOwnerId'], destiny);
    final input = body['report'];
    final kind = destiny ? 'destiny' : (input is Map ? input['kind'] : null);
    if (kind is! String || (!destiny && !readingKinds.contains(kind)))
      failAccount(400);
    if (!destiny) _limits.hit('reading-archive:${owner.id}', 60, _now());
    final report =
        (destiny ? parseDestinyArchive(input) : parseReadingArchive(input)) ??
        failAccount(400);
    final hashValue = destiny
        ? {
            for (final key in [
              'version',
              'calculatedAt',
              'timeKnown',
              'mode',
              'overview',
            ])
              key: report[key],
            'sections': [],
            'charts': report['charts'],
            if (report.containsKey('chartSnapshot'))
              'chartSnapshot': report['chartSnapshot'],
          }
        : report;
    final serialized = archiveJson(report);
    final id = sha256
        .convert(utf8.encode(destiny ? archiveJson(hashValue) : serialized))
        .toString();
    return _store.history.save(
          owner: owner,
          kind: kind,
          id: id,
          report: report,
          serialized: serialized,
          now: _now(),
          stillAuthorized: () =>
              _store.ownerBySession(session, _now()) == owner,
        ) ??
        failAccount(401);
  }

  Map<String, Object?>? get(
    String? session,
    Map<String, String> query, {
    required bool destiny,
    String? id,
  }) {
    final owner = _checkOwner(session, query['expectedOwnerId'], destiny);
    final kind = destiny ? 'destiny' : query['kind'];
    if (kind == null || (!destiny && !readingKinds.contains(kind)))
      failAccount(400);
    if (id == 'latest') {
      final key = destiny ? null : query['contextKey'];
      if (key != null && !validText(key, 512)) failAccount(400);
      return _store.history.latest(owner, kind, key);
    }
    if (id != null) {
      if (!validArchiveId(id)) failAccount(400);
      return _store.history.detail(owner, kind, id) ?? failAccount(404);
    }
    final before = query['before'];
    if (before != null && !validArchiveId(before)) failAccount(400);
    return _store.history.page(owner, kind, before) ?? failAccount(404);
  }

  Map<String, Object?> chartSnapshot(
    String? session,
    String? expected,
    String id,
  ) {
    final owner = _checkOwner(session, expected, true);
    if (id != 'latest' && !validArchiveId(id)) failAccount(400);
    final record = id == 'latest'
        ? _store.history.latest(owner, 'destiny', null)
        : _store.history.detail(owner, 'destiny', id) ?? failAccount(404);
    if (record == null) return {'status': 'no_archive'};
    final snapshot = (record['report'] as Map)['chartSnapshot'];
    return {
      'status': snapshot == null ? 'missing_snapshot' : 'available',
      'archiveId': record['id'],
      'calculatedAt': record['calculatedAt'],
      if (snapshot != null) 'chartSnapshot': snapshot,
    };
  }

  Map<String, Object?> synastrySnapshot(
    String? session,
    String? expected,
    String id,
    bool calculationContext,
  ) {
    final owner = _checkOwner(session, expected, true);
    if (owner.kind != AccountOwnerKind.member) failAccount(403);
    if (id != 'latest' && !validArchiveId(id)) failAccount(400);
    final record = id == 'latest'
        ? _store.history.latest(owner, 'destiny', null)
        : _store.history.detail(owner, 'destiny', id) ?? failAccount(404);
    return projectSynastry(record, calculationContext);
  }
}
