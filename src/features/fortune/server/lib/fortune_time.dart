import 'dart:convert';
import 'dart:io';

import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';

import 'fortune_advice.dart';

/// The caller owns the optional catalog and closes it after stopping the server.
Future<HttpServer> serveFortuneTime({
  int port = 8791,
  String webOrigin = 'http://localhost:8081',
  DateTime Function() now = DateTime.now,
  FortuneKnowledgeCatalog? knowledge,
}) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  server.listen((request) async {
    final origin = request.headers['origin']?.join(', ');
    final response = request.response;

    response.headers.set('cache-control', 'no-store');
    response.headers.set('vary', 'Origin');
    if (origin != null && origin.isNotEmpty && origin != webOrigin) {
      response.statusCode = HttpStatus.forbidden;
      await response.close();
      return;
    }
    if (origin != null && origin.isNotEmpty) {
      response.headers.set('access-control-allow-origin', origin);
    }
    if (knowledge != null && handleFortuneAdvice(request, knowledge)) {
      await response.close();
      return;
    }
    if (request.uri.toString() != '/fortune/time') {
      response.statusCode = HttpStatus.notFound;
    } else if (request.method != 'GET') {
      response.statusCode = HttpStatus.methodNotAllowed;
      response.headers.set('allow', 'GET');
    } else {
      final clock = DateTime.fromMillisecondsSinceEpoch(
        now().millisecondsSinceEpoch,
        isUtc: true,
      );
      response.headers.contentType = ContentType.json;
      response.write(jsonEncode({'asOfUtc': clock.toIso8601String()}));
    }
    await response.close();
  });
  return server;
}
