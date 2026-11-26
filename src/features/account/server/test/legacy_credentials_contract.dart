import 'dart:convert';
import 'dart:io';

import 'package:jovian_account_server/jovian_account_server.dart';

const _legacy = r'''
import { readFileSync } from 'node:fs';
import { hashPassword, verifyPassword } from './src/features/account/auth/model/password.mjs';
import { tokenHash } from './src/features/account/auth/model/session-secret.mjs';
const { password, token, salt, hash } = JSON.parse(readFileSync(0, 'utf8'));
const legacy = await hashPassword(password);
const recognized = await verifyPassword(password, { password_salt: salt, password_hash: hash });
process.stdout.write(JSON.stringify({ legacy, recognized, token: tokenHash(token) }));
''';

Future<void> main() async {
  final root = Platform.script.resolve('../../../../../../');
  final passwords = AccountPasswords();
  const sample = '离线测试Password8';
  final generated = await passwords.hash(sample);
  final token = createSessionSecret();
  final node = await Process.start('node', [
    '--input-type=module',
    '--eval',
    _legacy,
  ], workingDirectory: root.toFilePath());
  final output = utf8.decoder.bind(node.stdout).join();
  final errors = utf8.decoder.bind(node.stderr).join();
  node.stdin.encoding = utf8;
  node.stdin.write(
    jsonEncode({
      'password': sample,
      'salt': generated.salt,
      'hash': generated.hash,
      'token': token,
    }),
  );
  await node.stdin.close();
  final code = await node.exitCode;
  if (code != 0) throw StateError('Legacy credentials failed: ${await errors}');
  final result = jsonDecode(await output) as Map<String, Object?>;
  final legacy = result['legacy'] as Map<String, Object?>;
  final stored = (
    salt: legacy['salt'] as String,
    hash: legacy['passwordHash'] as String,
  );
  if (result['recognized'] != true ||
      result['token'] != sessionHash(token) ||
      sessionHash('$token\n') != null ||
      !await passwords.verify(sample, stored) ||
      await passwords.verify('incorrect-password', stored) ||
      await passwords.verify(sample, null)) {
    throw StateError('Dart and Node credentials did not match.');
  }
  stdout.writeln(
    'Node and Dart matched for password verification and session hashing.',
  );
}
