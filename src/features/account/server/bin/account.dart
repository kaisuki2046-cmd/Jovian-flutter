import 'dart:convert';
import 'dart:io';

import 'package:jovian_account_server/jovian_account_server.dart';

Future<void> main() async {
  final env = Platform.environment;
  final port = int.parse(env['APP_ACCOUNT_PORT'] ?? '8787');
  final host = env['APP_ACCOUNT_HOST'] ?? '127.0.0.1';
  final web = Uri.parse(env['APP_WEB_ORIGIN'] ?? 'http://localhost:8114');
  final database = File(
    env['APP_ACCOUNT_DB'] ??
        File.fromUri(
          Directory.systemTemp.uri.resolve('jovian-dart-account-$port.sqlite'),
        ).path,
  );
  final agreementsPath = env['APP_AGREEMENTS_FILE']?.trim();
  final published = agreementsPath == null || agreementsPath.isEmpty
      ? null
      : jsonDecode(await File(agreementsPath).readAsString())
            as Map<String, Object?>;
  await database.parent.create(recursive: true);
  final server = await serveAccount(
    databasePath: database.path,
    webOrigin: web,
    bindAddress: host,
    port: port,
    allowUnverifiedRegistration:
        env['NODE_ENV'] != 'production' && host == '127.0.0.1',
    isolateLocalSession: env['APP_ACCOUNT_ISOLATE_WEB_SESSION'] == '1',
    publishedAgreements: published,
  );
  stdout.writeln('Account service listening on http://$host:${server.port}');
}
