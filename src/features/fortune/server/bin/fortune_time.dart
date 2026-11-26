import 'dart:io';

import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';

import '../lib/fortune_time.dart';

Future<void> main() async {
  final environment = Platform.environment;
  final port = int.parse(environment['FORTUNE_TIME_PORT'] ?? '8791');
  final webOrigin = Uri.parse(
    environment['APP_WEB_ORIGIN'] ?? 'http://localhost:8081',
  ).origin;
  final catalog = openFortuneKnowledgeDatabase(
    ensureFortuneKnowledgeDatabase(
      manifest: File.fromUri(
        Platform.script.resolve('../../model/knowledge/fortune_knowledge.json'),
      ),
      directory: Directory.fromUri(
        Platform.script.resolve('../../storage/knowledge/.local/'),
      ),
    ),
  );
  final HttpServer server;
  try {
    server = await serveFortuneTime(
      port: port,
      webOrigin: webOrigin,
      knowledge: catalog,
    );
  } catch (_) {
    catalog.close();
    rethrow;
  }
  stdout.writeln(
    'Fortune time listening on http://127.0.0.1:${server.port}/fortune/time',
  );
}
