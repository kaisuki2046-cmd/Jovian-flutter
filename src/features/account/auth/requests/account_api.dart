import '../../../../shared/http/json_client.dart';
import '../../settings/model/agreements.dart';
import '../model/session.dart';

class AccountApi {
  AccountApi(this._http, {NativeSessionStorage? nativeSession})
    : _nativeSession = nativeSession;

  final JsonHttpClient _http;
  final NativeSessionStorage? _nativeSession;

  Future<String?> readNativeSession() async => _nativeSession?.read();

  Future<Map<String, Object?>> request(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
  }) async =>
      await requestNullable(
        path,
        body: body,
        authenticated: authenticated,
        method: method,
        query: query,
      ) ??
      (throw const JsonRequestError('invalid_response'));

  Future<Map<String, Object?>?> requestNullable(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
  }) => _requestAt(
    ['account', ...path],
    body: body,
    authenticated: authenticated,
    method: method,
    query: query,
  );

  Future<Map<String, Object?>> requestSocial(
    List<String> path, {
    required bool Function() isCurrent,
    Map<String, Object?>? body,
    Map<String, String>? query,
  }) async =>
      await _requestAt(
        ['social', ...path],
        body: body,
        authenticated: true,
        query: query,
        isCurrent: isCurrent,
      ) ??
      (throw const JsonRequestError('invalid_response'));

  Future<Map<String, Object?>?> _requestAt(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
    bool Function()? isCurrent,
  }) async {
    if (isCurrent?.call() == false) {
      throw const JsonRequestError('account_changed', status: 401);
    }
    final storage = _nativeSession;
    final session = authenticated && storage != null
        ? await storage.read()
        : null;
    if (isCurrent != null &&
        (!isCurrent() || (storage != null && session == null))) {
      throw const JsonRequestError('account_changed', status: 401);
    }
    final result = await _http.requestNullable(
      path,
      body: body,
      method: method,
      query: query,
      headers: {
        if (_nativeSession != null) 'X-App-Client': 'native',
        if (session != null) 'Authorization': 'Bearer $session',
      },
    );
    if (isCurrent?.call() == false) {
      throw const JsonRequestError('account_changed', status: 401);
    }
    return result;
  }

  Future<AuthCapabilities> capabilities() async =>
      AuthCapabilities.fromJson(await request(['auth', 'capabilities']));

  Future<AccountSession?> restore() async {
    if (_nativeSession != null && await readNativeSession() == null)
      return null;
    try {
      return AccountSession.fromMember(
        await request(['session'], authenticated: true),
      );
    } on JsonRequestError catch (error) {
      if (error.status != 401) rethrow;
    }
    try {
      return AccountSession.fromGuest(
        await request(['auth', 'guest'], authenticated: true),
      );
    } on JsonRequestError catch (error) {
      if (error.status != 401) rethrow;
      await _nativeSession?.write(null);
      return null;
    }
  }

  Future<String> sendCode(AccountIdentifier identifier) async {
    final result = await request(
      identifier.isPhone
          ? ['auth', 'phone', 'login', 'code']
          : ['auth', 'register', 'code'],
      body: {identifier.field: identifier.value},
    );
    final challenge = result['challengeId'];
    if (challenge is! String || challenge.isEmpty) {
      throw const FormatException('Invalid account challenge.');
    }
    return challenge;
  }

  Future<AccountSession> signIn(
    AuthMethod method,
    Map<String, Object?> input,
    AgreementCatalog catalog,
  ) async {
    final guest = method == AuthMethod.guest;
    final path = switch (method) {
      AuthMethod.password => ['auth', 'login'],
      AuthMethod.register => ['auth', 'register'],
      AuthMethod.phoneCode => ['auth', 'phone', 'login'],
      AuthMethod.guest => ['auth', 'guest'],
      AuthMethod.wechat || AuthMethod.qq => ['auth', 'social', method.name],
    };
    final result = await request(
      path,
      body: {
        ...input,
        'acceptance': {'agreed': true, 'agreements': catalog.requiredProof},
      },
      authenticated: true,
    );
    final account = guest
        ? AccountSession.fromGuest(result)
        : AccountSession.fromMember(result);
    final storage = _nativeSession;
    if (storage != null) {
      final token = result['token'];
      if (token is String && RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
        await storage.write(token);
      } else if (!guest || await storage.read() == null) {
        throw const FormatException('Invalid account session token.');
      }
    }
    return account;
  }

  Future<void> signOut() async {
    await request(['auth', 'logout'], method: 'POST', authenticated: true);
    await _nativeSession?.write(null);
  }

  void close() => _http.client.close();
}
