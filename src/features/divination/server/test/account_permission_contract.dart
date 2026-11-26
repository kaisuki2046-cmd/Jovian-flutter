import 'dart:convert';
import 'dart:io';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:jovian_divination_server/jovian_divination_server.dart';

const _native = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const _reading = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const _origin = 'http://localhost:8114';
const _member = '00000000-0000-4000-8000-000000000001';
const _guest = '00000000-0000-4000-8000-000000000002';

Future<void> main() async {
  final requests = <Map<String, String?>>[];
  final account = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  account.listen((request) async {
    requests.add({
      'path': request.uri.path,
      'purpose': request.uri.queryParameters['purpose'],
      'origin': request.headers.value('Origin'),
      'cookie': request.headers.value('Cookie'),
      'client': request.headers.value('X-App-Client'),
      'authorization': request.headers.value('Authorization'),
    });
    final response = request.response..headers.contentType = ContentType.json;
    final cookie = request.headers.value('Cookie');
    if (cookie == 'session=expired') {
      response.statusCode = 401;
    } else if (cookie == 'session=redirect') {
      response
        ..statusCode = 302
        ..headers.set('Location', '/account/redirected');
    } else {
      final browser = request.headers.value('Origin') != null;
      response.write(
        jsonEncode({
          'allowed': browser,
          'identity': {
            'kind': browser ? 'member' : 'guest',
            'id': cookie == 'session=invalid'
                ? 'bad-id'
                : browser
                ? _member
                : _guest,
          },
        }),
      );
    }
    await response.close();
  });
  final reader = AccountPermissionReader(
    Uri(scheme: 'http', host: '127.0.0.1', port: account.port),
  );
  final probe = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  probe.listen((request) async {
    try {
      final access = await reader.read(request.headers);
      if (request.uri.path == '/model') await access.requirePermission();
      request.response.write(
        jsonEncode({
          'allowed': access.allowed,
          'kind': access.owner.kind.name,
          'id': access.owner.id,
        }),
      );
    } on GuideRitualError catch (error) {
      request.response.statusCode = error.status;
      request.response.write(jsonEncode({'error': error.code}));
    } finally {
      await request.response.close();
    }
  });

  final client = HttpClient();
  Future<Map<String, Object?>> verify(
    int expected,
    Map<String, String> headers, {
    String path = '/read',
  }) async {
    final request = await client.get('127.0.0.1', probe.port, path);
    headers.forEach(request.headers.set);
    final response = await request.close();
    final body = jsonDecode(await utf8.decoder.bind(response).join());
    if (response.statusCode != expected) {
      throw StateError('Expected $expected, got ${response.statusCode}: $body');
    }
    return (body as Map).cast();
  }

  try {
    final web = await verify(200, {
      'Origin': _origin,
      'Cookie': 'session=browser',
      'Authorization': 'Bearer $_reading',
    });
    if (web['kind'] != 'member' ||
        web['id'] != _member ||
        web['allowed'] != true) {
      throw StateError('Browser account resolution changed.');
    }
    final native = await verify(200, {
      'X-Account-Session': _native,
      'Authorization': 'Bearer $_reading',
    });
    if (native['kind'] != 'guest' ||
        native['id'] != _guest ||
        native['allowed'] != false) {
      throw StateError('Native account resolution changed.');
    }
    await verify(428, {'X-Account-Session': _native}, path: '/model');
    await verify(401, {'Authorization': 'Bearer $_reading'});
    await verify(401, {'Origin': _origin, 'X-Account-Session': _native});
    await verify(401, {'Origin': _origin, 'Cookie': 'session=expired'});
    await verify(503, {'Origin': _origin, 'Cookie': 'session=redirect'});
    await verify(503, {'Origin': _origin, 'Cookie': 'session=invalid'});
    if (requests.length != 6 ||
        requests.any(
          (request) =>
              request['path'] != '/account/agreements/permission' ||
              request['purpose'] != 'divination.cloud_assistance' ||
              request['authorization'] == 'Bearer $_reading',
        )) {
      throw StateError(
        'A credential, permission scope, or redirect was forwarded incorrectly.',
      );
    }
    if (requests.first['authorization'] != null ||
        requests.first['cookie'] != 'session=browser' ||
        requests[1]['authorization'] != 'Bearer $_native' ||
        requests[1]['client'] != 'native' ||
        requests[1]['cookie'] != null) {
      throw StateError('Browser and native credentials were mixed.');
    }
    stdout.writeln(
      'Account permission passed 8 loopback cases for Web and native credentials.',
    );
  } finally {
    client.close(force: true);
    await probe.close(force: true);
    await account.close(force: true);
  }
}
