import 'dart:io';

import 'package:jovian_divination_server/jovian_divination_server.dart';

Future<void> main() async {
  final env = Platform.environment;
  final port = int.parse(env['DIVINATION_REPORT_PORT'] ?? '8115');
  final bind = env['DIVINATION_REPORT_BIND'] ?? '127.0.0.1';
  final path =
      env['DIVINATION_REPORT_DB'] ??
      File.fromUri(
        Directory.systemTemp.uri.resolve('jovian-divination-$port.sqlite'),
      ).path;
  final accountUri = Uri(
    scheme: 'http',
    host: '127.0.0.1',
    port: int.parse(env['APP_ACCOUNT_PORT'] ?? '8787'),
  );
  final reader = AccountPermissionReader(accountUri);
  final origins =
      (env['DIVINATION_REPORT_WEB_ORIGIN'] ??
              'http://localhost:8114,http://127.0.0.1:8114')
          .split(',')
          .map((value) => value.trim())
          .toSet();
  final hosts = env['DIVINATION_REPORT_HOSTS']
      ?.split(',')
      .map((value) => value.trim())
      .toSet();
  final server = await serveReading(
    databasePath: path,
    port: port,
    bindAddress: bind,
    allowedOrigins: origins,
    allowedHosts: hosts,
    readPermission: reader.read,
    model: configuredDivinationModel(env),
  );
  stdout.writeln('Divination service listening on http://$bind:${server.port}');
}
