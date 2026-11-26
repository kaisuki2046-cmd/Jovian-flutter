import 'dart:convert';
import 'dart:io';

import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';

const _optionsPath = '/fortune/advice/options';
final _selectedPath = RegExp(
  r'^/fortune/advice/options/([a-z0-9](?:[a-z0-9-]{0,70}[a-z0-9])?)$',
);

bool handleFortuneAdvice(HttpRequest request, FortuneKnowledgeCatalog catalog) {
  final path = request.uri.path;
  final selected = _selectedPath.firstMatch(path);
  if (path != _optionsPath && selected == null) return false;
  final response = request.response;
  if (request.headers.value('origin')?.isNotEmpty == true) {
    response.headers.set('access-control-allow-credentials', 'true');
  }
  if (request.method == 'OPTIONS') {
    response.statusCode = HttpStatus.noContent;
    response.headers
      ..set('access-control-allow-methods', 'GET')
      ..set('access-control-allow-headers', 'Content-Type, Authorization');
  } else if (request.method != 'GET') {
    response.statusCode = HttpStatus.methodNotAllowed;
    response.headers.set('allow', 'GET');
  } else if (request.uri.query.isNotEmpty) {
    _respond(response, HttpStatus.badRequest, _requestFailure);
  } else {
    try {
      final id = selected?.group(1);
      final body = id == null
          ? catalog.adviceOptions()
          : buildFortuneSelectedAdvice(id, catalog.matchSelectedAdvice(id));
      _respond(
        response,
        body == null ? HttpStatus.notFound : HttpStatus.ok,
        body ?? _requestFailure,
      );
    } on Object {
      _respond(response, HttpStatus.internalServerError, _requestFailure);
    }
  }
  return true;
}

const _requestFailure = {'error': 'fortune_interpretation_failed'};

void _respond(HttpResponse response, int status, Object body) {
  final content = jsonEncode(body);
  response.statusCode = status;
  response.headers.contentType = ContentType.json;
  response.write(content);
}
