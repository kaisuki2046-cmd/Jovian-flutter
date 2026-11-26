import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:jovian_compliance_server/jovian_compliance_server.dart';

import 'account_failure.dart';
import 'account_limits.dart';
import 'agreements_control.dart';
import 'auth/auth_control.dart';
import 'auth/session_secret.dart';
import 'history/archive_model.dart' show reportBodyLimit;
import 'history/history_control.dart';
import 'storage/account_auth_store.dart';

class AccountServer {
  AccountServer._(this._http, this._store, this._requests);

  final HttpServer _http;
  final AccountAuthStore _store;
  final Set<Future<void>> _requests;

  int get port => _http.port;

  Future<void> close() async {
    await _http.close(force: true);
    try {
      await Future.wait(_requests.toList());
    } finally {
      _store.close();
    }
  }
}

Future<AccountServer> serveAccount({
  required String databasePath,
  required Uri webOrigin,
  String bindAddress = '127.0.0.1',
  int port = 8787,
  bool isolateLocalSession = false,
  bool allowUnverifiedRegistration = false,
  Map<String, Object?>? publishedAgreements,
  DateTime Function()? now,
}) async {
  final origin = webOrigin.origin;
  final secure = webOrigin.scheme == 'https';
  final localWeb =
      webOrigin.scheme == 'http' &&
      const ['127.0.0.1', 'localhost', '::1'].contains(webOrigin.host);
  final localBind = const [
    '127.0.0.1',
    'localhost',
    '::1',
  ].contains(bindAddress);
  final cookie = secure
      ? '__Host-app_session'
      : isolateLocalSession &&
            webOrigin.host == 'localhost' &&
            webOrigin.hasPort
      ? 'app_session_${webOrigin.port}'
      : 'app_session';
  final documents = createAgreementCatalog(published: publishedAgreements);
  final store = AccountAuthStore(databasePath);
  int timestamp() =>
      (now == null ? DateTime.now() : now()).millisecondsSinceEpoch;
  final limits = AccountLimits();
  try {
    final agreements = AgreementControl(store, limits, timestamp, documents);
    final auth = AuthControl(
      store,
      limits,
      timestamp,
      localRegistration: localWeb && localBind && allowUnverifiedRegistration,
    );
    final handler = _Handler(
      auth,
      agreements,
      AccountHistoryControl(store, limits, timestamp),
      origin: origin,
      cookie: cookie,
      secure: secure,
    );
    final server = await HttpServer.bind(bindAddress, port);
    server.idleTimeout = const Duration(seconds: 15);
    final pending = <Future<void>>{};
    server.listen((request) {
      late final Future<void> active;
      active = handler
          .handle(request)
          .whenComplete(() => pending.remove(active));
      pending.add(active);
    });
    return AccountServer._(server, store, pending);
  } catch (_) {
    store.close();
    rethrow;
  }
}

class _Handler {
  _Handler(
    this._auth,
    this._agreements,
    this._history, {
    required this.origin,
    required this.cookie,
    required this.secure,
  });

  final AuthControl _auth;
  final AgreementControl _agreements;
  final AccountHistoryControl _history;
  final String origin;
  final String cookie;
  final bool secure;

  Future<void> handle(HttpRequest request) async {
    final response = request.response;
    response.headers
      ..set('Cache-Control', 'no-store')
      ..set('Vary', 'Origin')
      ..set('X-Content-Type-Options', 'nosniff');
    try {
      final origins = request.headers['origin'];
      final requestOrigin = origins?.singleOrNull;
      if (origins != null && requestOrigin != origin) failAccount(403);
      if (requestOrigin == origin) {
        response.headers
          ..set('Access-Control-Allow-Origin', origin)
          ..set('Access-Control-Allow-Credentials', 'true');
        if (request.method == 'OPTIONS') {
          response.headers
            ..set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
            ..set('Access-Control-Allow-Headers', 'Content-Type');
          _reply(response, 204, null);
          return;
        }
      }
      final native =
          requestOrigin == null &&
          request.headers['x-app-client']?.singleOrNull == 'native';
      if (!native && requestOrigin == null && request.method != 'GET')
        failAccount(403);
      final session = sessionHash(_secret(request, native));
      final route = '${request.method} ${request.uri.path}';
      final ip = request.connectionInfo?.remoteAddress.address ?? '';
      switch (route) {
        case 'POST /account/reading-history' || 'POST /account/destiny-history':
          final result = await _history.save(
            session,
            destiny: route.endsWith('/destiny-history'),
            read: () => _readBody(request, limit: reportBodyLimit),
          );
          _reply(response, 200, result);
        case 'GET /account/auth/capabilities':
          _reply(response, 200, _auth.capabilities);
        case 'GET /account/agreements/catalog':
          _reply(response, 200, _agreements.catalog);
        case 'GET /account/agreements':
          _reply(response, 200, _agreements.state(session));
        case 'GET /account/agreements/permission':
          _reply(
            response,
            200,
            _agreements.permission(
              session,
              request.uri.queryParameters['purpose'],
            ),
          );
        case 'POST /account/agreements/confirmation':
          _reply(
            response,
            200,
            _agreements.confirmRequired(session, await _readBody(request)),
          );
        case 'POST /account/agreements/permission':
          _reply(
            response,
            200,
            _agreements.choosePermission(session, await _readBody(request)),
          );
        case 'GET /account/session':
          _reply(response, 200, _auth.memberProfile(session));
        case 'PATCH /account/profile':
          _reply(
            response,
            200,
            _auth.updateProfile(session, await _readBody(request)),
          );
        case 'POST /account/auth/password':
          await _auth.changePassword(session, await _readBody(request));
          _reply(response, 204, null);
        case 'GET /account/auth/guest':
          _reply(response, 200, _auth.restoreGuest(session));
        case 'POST /account/auth/register' ||
            'POST /account/auth/login' ||
            'POST /account/auth/guest':
          final input = await _readBody(request);
          final accepted = _agreements.signInAcceptance(input['acceptance']);
          final result = route.endsWith('/guest')
              ? _auth.startGuest(session, ip)
              : await _auth.authenticate(
                  registering: route.endsWith('/register'),
                  previous: session,
                  ip: ip,
                  input: input,
                );
          final secret = result.secret;
          final next = secret == null ? session : sessionHash(secret);
          try {
            _agreements.recordSignIn(next, accepted);
          } catch (_) {
            if (secret != null) _auth.signOut(next);
            rethrow;
          }
          if (secret != null && !native)
            _setCookie(response, secret, accountSessionTTL.inSeconds);
          _reply(
            response,
            result.status,
            secret != null && native
                ? {...result.body!, 'token': secret}
                : result.body,
          );
        case 'POST /account/auth/logout':
          _auth.signOut(session);
          if (!native) _setCookie(response, '', 0);
          _reply(response, 204, null);
        case 'POST /account/auth/register/code':
        case 'POST /account/auth/phone/login/code':
        case 'POST /account/auth/phone/login':
          failAccount(503);
        case 'GET /account/auth/identity-verification':
          _auth.memberProfile(session);
          _reply(response, 200, {'status': 'not_enabled'});
        case 'POST /account/auth/identity-verification':
          _auth.memberProfile(session);
          _reply(response, 503, {'code': 'IDENTITY_VERIFICATION_NOT_ENABLED'});
        default:
          final archive = _historyRoute.firstMatch(route);
          if (archive != null) {
            if (archive[2] == null &&
                (archive[1] == 'chart-snapshots' ||
                    archive[1] == 'synastry-chart-snapshots')) {
              failAccount(404);
            }
            final query = {
              for (final entry in request.uri.queryParametersAll.entries)
                entry.key: entry.value.first,
            };
            final result = switch (archive[1]) {
              'chart-snapshots' => _history.chartSnapshot(
                session,
                query['expectedOwnerId'],
                archive[2] ?? '',
              ),
              'synastry-chart-snapshots' => _history.synastrySnapshot(
                session,
                query['expectedOwnerId'],
                archive[2] ?? '',
                query['calculationContext'] == '1',
              ),
              _ => _history.get(
                session,
                query,
                destiny: archive[1] == 'destiny-history',
                id: archive[2],
              ),
            };
            _reply(response, 200, result, jsonNull: true);
            return;
          }
          final version = _versionRoute.firstMatch(route);
          if (version == null) failAccount(404);
          _reply(
            response,
            200,
            _agreements.version(session, version[1]!, version[2]!),
          );
      }
    } on AccountFailure catch (error) {
      if (error.status == 413 || error.status == 408)
        response.persistentConnection = false;
      _reply(response, error.status, {
        'status': error.status,
        if (error.status == 503) 'code': 'AUTH_PROVIDER_UNAVAILABLE',
      });
    } catch (error) {
      stderr.writeln('Account request failed (${error.runtimeType}).');
      _reply(response, 500, {'status': 500});
    } finally {
      try {
        await response.close();
      } on HttpException {
        // The client can disconnect while an isolated password check finishes.
      } on SocketException {
        // The response is no longer writable.
      }
    }
  }

  String? _secret(HttpRequest request, bool native) {
    if (native) {
      final bearer = request.headers['authorization']?.singleOrNull;
      return bearer != null && bearer.startsWith('Bearer ')
          ? bearer.substring(7)
          : null;
    }
    for (final entry in request.cookies) {
      if (entry.name == cookie) return entry.value;
    }
    return null;
  }

  void _setCookie(HttpResponse response, String secret, int seconds) {
    final secureFlag = secure ? '; Secure' : '';
    response.headers.add(
      HttpHeaders.setCookieHeader,
      '$cookie=$secret; Path=/; HttpOnly; SameSite=Strict; Max-Age=$seconds$secureFlag',
    );
  }
}

final _versionRoute = RegExp(
  r'^GET /account/agreements/(terms|privacy|ai)/([A-Za-z0-9.-]{1,50})$',
);
final _historyRoute = RegExp(
  r'^GET /account/(destiny-history|reading-history|chart-snapshots|synastry-chart-snapshots)(?:/([^/]*))?$',
);

void _reply(
  HttpResponse response,
  int status,
  Map<String, Object?>? body, {
  bool jsonNull = false,
}) {
  response.statusCode = status;
  if (body != null || jsonNull) {
    response.headers.contentType = ContentType.json;
    response.write(jsonEncode(body));
  }
}

Future<Map<String, Object?>> _readBody(
  HttpRequest request, {
  int limit = 4096,
}) async {
  if (request.headers.contentType?.mimeType != 'application/json')
    failAccount(415);
  if (request.contentLength > limit) failAccount(413);
  final data = BytesBuilder(copy: false);
  try {
    await for (final chunk in request.timeout(const Duration(seconds: 15))) {
      if (data.length + chunk.length > limit) failAccount(413);
      data.add(chunk);
    }
  } on TimeoutException {
    failAccount(408);
  }
  try {
    final parsed = jsonDecode(utf8.decode(data.takeBytes()));
    if (parsed is Map<String, Object?>) return parsed;
  } on FormatException {
    failAccount(400);
  }
  failAccount(400);
}
