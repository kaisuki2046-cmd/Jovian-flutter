import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:jovian_divination/jovian_divination.dart';

import 'account_permission.dart';
import 'legacy_reading_sessions.dart';
import 'question_confirmation.dart';
import 'reading_store.dart';
import 'stored_guide_sessions.dart';
import 'structured_model.dart';

const _maxBodyBytes = 16 * 1024 * 1024;
const _bodyTimeout = Duration(seconds: 10);
const _createWindow = Duration(minutes: 1);
const _routes = {
  '/reading',
  '/reading/understand',
  '/reading/shuffle',
  '/reading/cut',
  '/reading/pick',
  '/reading/toss',
  '/reading/numbers',
  '/reading/report',
  '/reading/follow-up',
};
final _bearer = RegExp(r'^Bearer ([A-Za-z0-9_-]+)$');

typedef ReadingPermission = Future<ReadingAccess> Function(HttpHeaders headers);

class ReadingHttpServer {
  ReadingHttpServer._(this._server, this._store, this._cleanup);

  final HttpServer _server;
  final ReadingSessionStore _store;
  final Timer _cleanup;
  final _inFlight = <Future<void>>{};
  Future<void>? _closing;

  int get port => _server.port;

  Future<void> close() => _closing ??= _close();

  Future<void> _close() async {
    _cleanup.cancel();
    try {
      await _server.close(force: true);
      await Future.wait(_inFlight.toList());
    } finally {
      _store.close();
    }
  }

  void _accept(HttpRequest request, _ReadingRouter router) {
    final pending = router.handle(request);
    _inFlight.add(pending);
    unawaited(pending.whenComplete(() => _inFlight.remove(pending)));
  }
}

Future<ReadingHttpServer> serveReading({
  required String databasePath,
  required ReadingPermission readPermission,
  int port = 8115,
  String bindAddress = '127.0.0.1',
  Set<String>? allowedHosts,
  Set<String> allowedOrigins = const {
    'http://localhost:8114',
    'http://127.0.0.1:8114',
  },
  StructuredModelClient? model,
  DateTime Function()? now,
  double Function()? random,
}) async {
  final clock = now ?? DateTime.now;
  final store = ReadingSessionStore(databasePath, now: clock);
  try {
    final server = await HttpServer.bind(bindAddress, port);
    final router = _ReadingRouter(
      store,
      readPermission: readPermission,
      hosts: Set.unmodifiable(
        allowedHosts ??
            {'localhost:${server.port}', '127.0.0.1:${server.port}'},
      ),
      origins: Set.unmodifiable(allowedOrigins),
      model: model,
      now: clock,
      random: random,
    );
    final reading = ReadingHttpServer._(
      server,
      store,
      Timer.periodic(_createWindow, (_) => router.cleanup()),
    );
    server.listen((request) => reading._accept(request, router));
    return reading;
  } catch (_) {
    store.close();
    rethrow;
  }
}

class _ReadingRouter {
  _ReadingRouter(
    this.store, {
    required this.readPermission,
    required this.hosts,
    required this.origins,
    required this.model,
    required DateTime Function() now,
    required double Function()? random,
  }) : guides = StoredGuideSessions(store, now: now, random: random),
       legacy = LegacyReadingSessions(store, now: now, random: random),
       questions = ReadingQuestions(model, now);

  final ReadingSessionStore store;
  final ReadingPermission readPermission;
  final Set<String> hosts;
  final Set<String> origins;
  final StructuredModelClient? model;
  final StoredGuideSessions guides;
  final LegacyReadingSessions legacy;
  final ReadingQuestions questions;
  final _createCounts = <InternetAddress, int>{};

  void cleanup() {
    _createCounts.clear();
    store.clearExpired();
  }

  Future<void> handle(HttpRequest request) async {
    final response = request.response;
    final ({int status, GuideWire? body}) result;
    try {
      result = await _dispatch(request);
    } on GuideRitualError catch (error) {
      await _send(response, status: error.status, body: {'error': error.code});
      return;
    } catch (_) {
      await _send(
        response,
        status: 500,
        body: {'error': 'reading_service_error'},
      );
      return;
    }
    await _send(response, status: result.status, body: result.body);
  }

  Future<({int status, GuideWire? body})> _dispatch(HttpRequest request) async {
    final host = _singleHeader(request.headers, 'Host');
    if (!hosts.contains(host))
      throw const GuideRitualError(403, 'host_not_allowed');
    final origin = _singleHeader(request.headers, 'Origin');
    if (request.headers['Origin'] != null) {
      if (origin == null || !origins.contains(origin)) {
        throw const GuideRitualError(403, 'origin_not_allowed');
      }
      request.response.headers
        ..set('Access-Control-Allow-Origin', origin)
        ..set('Access-Control-Allow-Credentials', 'true')
        ..set('Vary', 'Origin');
    }
    final path = request.uri.toString();
    if (!_routes.contains(path)) throw const GuideRitualError(404, 'not_found');
    final method = request.method;
    if (method == 'OPTIONS') {
      request.response.headers
        ..set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        ..set(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type, X-Account-Session',
        );
      return (status: 204, body: null);
    }

    final auth = _singleHeader(request.headers, 'Authorization');
    final token = auth == null ? null : _bearer.firstMatch(auth)?.group(1);
    Future<ReadingAccess> access() => readPermission(request.headers);
    ReadingOwner? owner;
    GuideWire? saved;
    if (token != null) {
      owner = (await access()).owner;
      saved = store.get(token, owner);
    }
    if (method == 'GET' && path == '/reading') {
      if (token == null || owner == null)
        throw const GuideRitualError(401, 'invalid_task_token');
      final body = saved?['ruleVersion'] == guideVersion
          ? guides.get(token, owner)
          : legacy.get(token, owner);
      return (status: 200, body: body);
    }
    if (method != 'POST')
      throw const GuideRitualError(405, 'method_not_allowed');
    final body = await _readJson(request);
    if (path == '/reading' || path == '/reading/understand')
      _countCreation(request.connectionInfo?.remoteAddress);
    if (path == '/reading/understand') {
      return (status: 200, body: await questions.understand(body, access));
    }
    if (path == '/reading') {
      final started = _start(body, (await access()).owner);
      return (
        status: 201,
        body: {'token': started.token, 'task': started.task},
      );
    }
    if (token == null || owner == null)
      throw const GuideRitualError(401, 'invalid_task_token');
    final tokenOwner = owner;
    Future<void> permit() async {
      final current = await access();
      if (current.owner.id != tokenOwner.id ||
          current.owner.kind != tokenOwner.kind) {
        throw const GuideRitualError(404, 'task_not_found');
      }
      await current.requirePermission();
    }

    final value = saved?['ruleVersion'] == guideVersion
        ? await _guideAction(path, token, owner, body, permit)
        : _legacyAction(path, token, owner, body);
    return (status: 200, body: value);
  }

  ({String token, GuideWire task}) _start(GuideWire body, ReadingOwner owner) {
    final focus = readingText(body['focus']);
    final method = _wireString(body['method']);
    if (method == 'combined' && body['profile'] == guideVersion) {
      final input = guideQuestion(body);
      if (focus.isEmpty || focus.length > guideQuestionMaxLength) {
        throw const GuideRitualError(400, 'invalid_focus');
      }
      questions.verify(input, focus, body['proof']);
      return guides.start(
        owner: owner,
        question: input.question,
        focus: focus,
        previousQuestion: input.previousQuestion,
        automatic: body['automatic'] == true,
      );
    }
    return legacy.start(
      method: method,
      question: readingText(body['question']),
      focus: focus,
      owner: owner,
    );
  }

  Future<GuideWire> _guideAction(
    String path,
    String token,
    ReadingOwner owner,
    GuideWire body,
    Future<void> Function() permit,
  ) async => switch (path) {
    '/reading/shuffle' => throw const GuideRitualError(
      409,
      'shuffle_out_of_order',
    ),
    '/reading/cut' => _wrongGuideCut(body['point']),
    '/reading/toss' => guides.toss(
      token,
      owner,
      GuideCoinEvent(
        actionId: _wireString(body['actionId']),
        step: _wireInt(body['step'], 'invalid_toss'),
      ),
    ),
    '/reading/pick' => guides.pick(
      token,
      owner,
      GuideCardEvent(
        actionId: _wireString(body['actionId']),
        step: _wireInt(body['step'], 'invalid_selection'),
        slot: _wireInt(body['slot'], 'invalid_selection'),
        epochMs: _wireString(body['epochMs']),
        monotonicMs: body['monotonicMs'] is num
            ? body['monotonicMs'] as num
            : double.nan,
        clockSessionId: _wireString(body['clockSessionId']),
      ),
    ),
    '/reading/numbers' => _wrongGuideNumbers(body['numbers']),
    '/reading/report' => await guides.report(
      token,
      owner,
      model: model,
      requirePermission: permit,
    ),
    '/reading/follow-up' => await guides.followUp(
      token,
      owner,
      step: _wireInt(body['step'], 'invalid_follow_up'),
      question: readingText(body['question']),
      model: model,
      requirePermission: permit,
    ),
    _ => throw const GuideRitualError(404, 'not_found'),
  };

  GuideWire _legacyAction(
    String path,
    String token,
    ReadingOwner owner,
    GuideWire body,
  ) => switch (path) {
    '/reading/shuffle' => legacy.shuffle(token, owner),
    '/reading/cut' => legacy.cut(
      token,
      owner,
      _wireInt(body['point'], 'invalid_cut'),
    ),
    '/reading/toss' => legacy.toss(
      token,
      owner,
      _wireInt(body['step'], 'invalid_toss'),
    ),
    '/reading/pick' => legacy.pick(
      token,
      owner,
      _wireInt(body['step'], 'invalid_selection'),
      _wireInt(body['slot'], 'invalid_selection'),
    ),
    '/reading/numbers' => legacy.numbers(
      token,
      owner,
      _numbers(body['numbers']),
    ),
    '/reading/report' => legacy.report(token, owner),
    '/reading/follow-up' => legacy.followUp(
      token,
      owner,
      _wireInt(body['step'], 'invalid_follow_up'),
      readingText(body['question']),
    ),
    _ => throw const GuideRitualError(404, 'not_found'),
  };

  void _countCreation(InternetAddress? ip) {
    if (ip == null) return;
    final count = _createCounts[ip] ?? 0;
    if (count >= 30) throw const GuideRitualError(429, 'too_many_requests');
    _createCounts[ip] = count + 1;
  }
}

String? _singleHeader(HttpHeaders headers, String name) {
  final values = headers[name];
  return values?.length == 1 ? values!.single : null;
}

String _wireString(Object? value) => value is String ? value : '';

int _wireInt(Object? value, String error) {
  if (value is num && value.isFinite && value == value.toInt())
    return value.toInt();
  throw GuideRitualError(400, error);
}

List<int> _numbers(Object? values) {
  if (values is! List || values.length != 3)
    throw const GuideRitualError(400, 'invalid_numbers');
  return [for (final value in values) _wireInt(value, 'invalid_numbers')];
}

Never _wrongGuideCut(Object? value) {
  if (!tarotCutPoints.contains(_wireInt(value, 'invalid_cut'))) {
    throw const GuideRitualError(400, 'invalid_cut');
  }
  throw const GuideRitualError(409, 'cut_out_of_order');
}

Never _wrongGuideNumbers(Object? value) {
  if (!validMeihuaNumbers(_numbers(value)))
    throw const GuideRitualError(400, 'invalid_numbers');
  throw const GuideRitualError(409, 'wrong_reading_method');
}

Future<GuideWire> _readJson(HttpRequest request) async {
  if (request.headers.contentType?.mimeType != 'application/json') {
    throw const GuideRitualError(415, 'expected_json');
  }
  if (request.contentLength > _maxBodyBytes) {
    throw const GuideRitualError(413, 'body_too_large');
  }
  final buffer = BytesBuilder(copy: false);
  final clock = Stopwatch()..start();
  try {
    await for (final bytes in request.timeout(_bodyTimeout)) {
      if (clock.elapsed > _bodyTimeout)
        throw TimeoutException('request body deadline');
      if (buffer.length + bytes.length > _maxBodyBytes) {
        throw const GuideRitualError(413, 'body_too_large');
      }
      buffer.add(bytes);
    }
    final value = jsonDecode(
      utf8.decode(buffer.takeBytes(), allowMalformed: true),
    );
    return value is Map ? value.cast() : {};
  } on FormatException {
    throw const GuideRitualError(400, 'invalid_json');
  } on TimeoutException {
    throw const GuideRitualError(408, 'request_timeout');
  }
}

Future<void> _send(
  HttpResponse response, {
  required int status,
  required GuideWire? body,
}) async {
  try {
    response.statusCode = status;
    if (body != null) {
      response.headers
        ..contentType = ContentType.json
        ..set('Cache-Control', 'no-store');
      response.write(jsonEncode(body));
    }
    await response.close();
  } on IOException {
    // The caller may disconnect while an authorized model request finishes.
  }
}
