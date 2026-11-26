import 'dart:convert';
import 'dart:io';

import 'package:jovian_account_server/jovian_account_server.dart';
import 'package:jovian_compliance_server/jovian_compliance_server.dart';
import 'package:sqlite3/sqlite3.dart';

const _nodeFixture = r'''
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openAccountStore } from './src/features/account/storage/account-store.mjs';
import { createAgreementCatalog } from './src/features/compliance/server-entry.mjs';
const { path, mode, now, nodeSession, dartSession, previousGuest } = JSON.parse(readFileSync(0,'utf8'));
const store = openAccountStore(path);
try {
  if (mode === 'add') {
    const old = store.register({
      id: 'node-member', email: 'ported@example.test', displayName: '原账户',
      salt: '10'.repeat(16), passwordHash: 'fa'.repeat(64),
      tokenHash: nodeSession, expiresAt: now + 70000, now,
    });
    const uid = store.getPublicUid(old.id);
    store.startGuest({ id: 'node-guest', token: previousGuest, expiresAt: now + 70000 });
    const catalog = createAgreementCatalog();
    store.seedAgreements(catalog);
    store.saveAgreementDecisions({ kind: 'member', id: old.id },
      catalog.filter(({ id }) => id !== 'ai').map(document => ({ document, purpose: '', agreed: true })),
      now, 'sign-in');
    process.stdout.write(JSON.stringify({ uid }));
  } else {
    const account = store.getBySession(dartSession, now);
    assert.equal(account.display_name, 'Dart 账户');
    assert.equal(account.email, null);
    assert.equal(store.getByPasswordPhone('+8613800138000').id, account.id);
    assert.equal(store.getGuest(previousGuest, now), undefined);
    const ai = createAgreementCatalog().find(({ id }) => id === 'ai');
    const permission = 'divination.cloud_assistance';
    const identity = { kind: 'member', id: account.id };
    assert.equal(store.hasAgreement(identity, ai, permission), false);
    assert.equal(store.getAgreementHistory(identity).filter(item => item.purpose === permission).length, 2);
    process.stdout.write(JSON.stringify({ uid: store.getPublicUid(account.id) }));
  }
} finally {
  store.close();
}
''';

Future<Map<String, Object?>> _node(Map<String, Object?> values) async {
  final root = Platform.script.resolve('../../../../../../');
  final process = await Process.start('node', [
    '--input-type=module',
    '--eval',
    _nodeFixture,
  ], workingDirectory: root.toFilePath());
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.encoding = utf8;
  process.stdin.write(jsonEncode(values));
  await process.stdin.close();
  final code = await process.exitCode;
  if (code != 0) throw StateError('Node fixture failed: ${await errors}');
  return jsonDecode(await output) as Map<String, Object?>;
}

void _require(bool expression, String reason) {
  if (!expression) throw StateError(reason);
}

Future<void> _testRoundtrip(String path) async {
  final now = DateTime.utc(2026, 11, 1).millisecondsSinceEpoch;
  final nodeSession = sessionHash(createSessionSecret())!;
  final previousGuest = sessionHash(createSessionSecret())!;
  final dartSession = sessionHash(createSessionSecret())!;
  final values = {
    'path': path,
    'mode': 'add',
    'now': now,
    'nodeSession': nodeSession,
    'dartSession': dartSession,
    'previousGuest': previousGuest,
  };
  final seeded = await _node(values);
  final store = AccountAuthStore(path);
  final String dartUid;
  try {
    final member = store.memberBySession(nodeSession, now)!;
    _require(member.id == 'node-member', 'Node session did not resume.');
    _require(
      store.ownerProfile(member)['uid'] == seeded['uid'],
      'UID changed.',
    );
    _require(
      store.guestBySession(previousGuest, now)?.id == 'node-guest',
      'Guest did not resume.',
    );
    final catalog = createAgreementCatalog();
    store.agreements.seed(catalog);
    final nodeOwner = store.ownerBySession(nodeSession, now)!;
    _require(
      catalog
          .where((doc) => doc.id != 'ai')
          .every((doc) => store.agreements.accepted(nodeOwner, doc, '')),
      'Legacy agreement decisions were not restored.',
    );
    final credentials = member.credentials!;
    final dart = store.register(
      id: 'dart-member',
      email: null,
      phone: '+8613800138000',
      displayName: 'Dart 账户',
      credentials: credentials,
      session: dartSession,
      previousSession: previousGuest,
      now: now,
    )!;
    dartUid = store.ownerProfile(dart)['uid'] as String;
    final dartOwner = store.ownerBySession(dartSession, now)!;
    final ai = catalog.singleWhere((doc) => doc.id == 'ai');
    const purpose = 'divination.cloud_assistance';
    bool setAi(bool agreed, String auth) => store.agreements.save(
      owner: dartOwner,
      decisions: [(document: ai, purpose: purpose, agreed: agreed)],
      now: now,
      source: 'settings',
      stillAuthorized: () => store.ownerBySession(auth, now) == dartOwner,
    );
    _require(
      !setAi(true, previousGuest),
      'A revoked guest session saved permission.',
    );
    _require(
      setAi(true, dartSession),
      'Dart owner could not grant permission.',
    );
    _require(
      !store.agreements.accepted(nodeOwner, ai, purpose),
      'Permission was shared across owners.',
    );
    _require(
      store.agreements.accepted(dartOwner, ai, purpose),
      'Granted permission missing.',
    );
    _require(
      setAi(true, dartSession),
      'Repeated identical permission choice failed.',
    );
    _require(setAi(false, dartSession), 'Permission revocation failed.');
    _require(
      !store.agreements.accepted(dartOwner, ai, purpose),
      'Revoked permission remained active.',
    );
    final duplicateName = store.register(
      id: 'another-member',
      email: 'another@example.test',
      phone: null,
      displayName: ' dart 账户 ',
      credentials: credentials,
      session: sessionHash(createSessionSecret())!,
      now: now,
    );
    _require(duplicateName == null, 'Duplicate nickname was accepted.');
    final duplicatePhone = store.register(
      id: 'another-member',
      email: null,
      phone: '+8613800138000',
      displayName: '另一个账号',
      credentials: credentials,
      session: sessionHash(createSessionSecret())!,
      now: now,
    );
    _require(duplicatePhone == null, 'Already registered phone was accepted.');
    _require(
      store.guestBySession(previousGuest, now) == null,
      'Guest token was not revoked.',
    );
    _require(
      store.memberBySession(
            dartSession,
            now + accountSessionTTL.inMilliseconds,
          ) ==
          null,
      'Expired session was accepted.',
    );
    store.revoke(nodeSession);
    _require(
      store.memberBySession(nodeSession, now) == null,
      'Logout did not clear the token.',
    );
  } finally {
    store.close();
  }
  final restored = await _node({...values, 'mode': 'verify'});
  _require(
    restored['uid'] == dartUid,
    'Node could not read the Dart account and UID.',
  );
}

void _testLegacyMigration(String path) {
  final now = DateTime.utc(2026, 11, 1).millisecondsSinceEpoch;
  final old = sqlite3.open(path);
  const uid = '12345678';
  try {
    old.execute('''
      PRAGMA foreign_keys = ON;
      CREATE TABLE account_users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '', password_salt TEXT, password_hash TEXT,
        profile_visibility TEXT
      );
      CREATE TABLE account_public_uids (
        user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
        uid TEXT NOT NULL UNIQUE
      );
      INSERT INTO account_users (id, email, display_name, profile_visibility)
      VALUES ('early-member', 'early@example.test', '旧名字', '{"displayName":true}');
      INSERT INTO account_public_uids VALUES ('early-member', '$uid');
    ''');
  } finally {
    old.close();
  }
  final migrated = AccountAuthStore(path);
  try {
    final member = migrated.byEmail('early@example.test')!;
    final profile = migrated.ownerProfile(member);
    _require(profile['uid'] == uid, 'Legacy migration lost the public UID.');
    _require(
      (profile['visibility'] as Map)['displayName'] == true,
      'Legacy migration lost the visibility setting.',
    );
    final session = sessionHash(createSessionSecret())!;
    final guest = migrated.createGuest('new-guest', session, now);
    _require(
      migrated.guestBySession(session, now) == guest,
      'Guest creation failed.',
    );
    migrated.revoke(session);
    _require(
      migrated.guestBySession(session, now) == null,
      'Guest logout failed.',
    );
  } finally {
    migrated.close();
  }
}

Future<void> main() async {
  final temp = Directory.systemTemp.createTempSync('jovian-dart-account-');
  final roundtrip = File.fromUri(temp.uri.resolve('roundtrip.sqlite'));
  final old = File.fromUri(temp.uri.resolve('legacy.sqlite'));
  try {
    await _testRoundtrip(roundtrip.path);
    _testLegacyMigration(old.path);
    stdout.writeln(
      'Dart and Node share legacy account/session tables, UID and phone registration.',
    );
  } finally {
    for (final file in [roundtrip, old]) {
      if (file.existsSync()) file.deleteSync();
    }
    temp.deleteSync();
  }
}
