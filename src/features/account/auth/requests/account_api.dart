import '../../../../shared/http/json_client.dart';
import '../../settings/model/agreements.dart';
import '../model/password.dart';
import '../model/session.dart';

class AccountApi {
  AccountApi(this._http, {NativeSessionStorage? nativeSession})
    : _nativeSession = nativeSession;

  final JsonHttpClient _http;
  final NativeSessionStorage? _nativeSession;

  Future<String?> readNativeSession() async => _nativeSession?.read();

  Future<void> probeIdentityVerification({
    required bool submit,
    required bool Function() isCurrent,
  }) async {
    await _requestAt(
      ['account', 'auth', 'identity-verification'],
      authenticated: true,
      isCurrent: isCurrent,
      body: submit ? const {} : null,
    );
  }

  Future<AccountSession> updateProfile(
    String memberId,
    Map<String, Object?> profile, {
    required bool Function() isCurrent,
  }) async {
    final response = await _requestAt(
      ['account', 'profile'],
      method: 'PATCH',
      authenticated: true,
      isCurrent: isCurrent,
      body: {...profile, 'expectedOwnerId': memberId},
    );
    if (response == null)
      throw const FormatException('Invalid account profile.');
    return AccountSession.fromMember(response);
  }

  Future<Map<String, Object?>> request(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
    bool Function()? isCurrent,
    Future<void>? cancel,
  }) async =>
      await requestNullable(
        path,
        body: body,
        authenticated: authenticated,
        method: method,
        query: query,
        isCurrent: isCurrent,
        cancel: cancel,
      ) ??
      (throw const JsonRequestError('invalid_response'));

  Future<Map<String, Object?>?> requestNullable(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
    bool Function()? isCurrent,
    Future<void>? cancel,
  }) => _requestAt(
    ['account', ...path],
    body: body,
    authenticated: authenticated,
    method: method,
    query: query,
    isCurrent: isCurrent,
    cancel: cancel,
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

  Future<Map<String, Object?>> readAsMember(
    List<String> path,
    String memberId, {
    required bool Function() isCurrent,
    Future<void>? cancel,
    Map<String, String>? query,
  }) async {
    final result = await request(
      path,
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
      query: query,
    );
    // Older account read responses have no owner ID of their own.
    await _verifyMember(memberId, isCurrent: isCurrent, cancel: cancel);
    return result;
  }

  Future<Map<String, Object?>> writeAsMember(
    List<String> path,
    String memberId, {
    required Map<String, Object?> body,
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async {
    await _verifyMember(memberId, isCurrent: isCurrent, cancel: cancel);
    return request(
      path,
      body: body,
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
    );
  }

  Future<void> _verifyMember(
    String memberId, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async {
    final session = await request(
      ['session'],
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
    );
    if (session['user'] case {'id': final String id} when id == memberId) {
      return;
    }
    throw const JsonRequestError('account_changed', status: 401);
  }

  Future<PasswordSmsChallenge> issuePasswordSetup(
    String memberId, {
    required bool Function() isCurrent,
  }) async {
    await _verifyMember(memberId, isCurrent: isCurrent);
    return _readPasswordChallenge(
      await request(
        ['auth', 'phone', 'password-setup', 'code'],
        body: const {},
        authenticated: true,
        isCurrent: isCurrent,
      ),
    );
  }

  Future<PasswordSmsChallenge> issuePasswordRecovery(
    String phone, {
    required Future<void> cancel,
  }) async => _readPasswordChallenge(
    await request(
      ['auth', 'password-reset', 'code'],
      body: {'phone': phone},
      cancel: cancel,
    ),
  );

  PasswordSmsChallenge _readPasswordChallenge(Map<String, Object?> result) {
    if (result case {'challengeId': final String id} when id.isNotEmpty) {
      return (id: id, localInbox: result['delivery'] == 'local-inbox');
    }
    throw const JsonRequestError('invalid_response');
  }

  Future<String> verifyPasswordRecovery(
    String phone,
    String challenge,
    String code, {
    required Future<void> cancel,
  }) async {
    final result = await request(
      ['auth', 'password-reset', 'verify'],
      body: {'phone': phone, 'challengeId': challenge, 'code': code},
      cancel: cancel,
    );
    if (result['resetToken'] case final String token
        when RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      return token;
    }
    throw const JsonRequestError('invalid_response');
  }

  Future<void> completePasswordRecovery(
    String phone,
    String resetToken,
    String password, {
    required bool keepGuest,
    required Future<void> cancel,
  }) async {
    await request(
      ['auth', 'password-reset', 'complete'],
      body: {'phone': phone, 'resetToken': resetToken, 'newPassword': password},
      authenticated: true,
      cancel: cancel,
    );
    if (!keepGuest) await _nativeSession?.write(null);
  }

  Future<void> changePassword(
    String memberId,
    String current,
    String next, {
    required bool Function() isCurrent,
  }) async {
    await _verifyMember(memberId, isCurrent: isCurrent);
    await request(
      ['auth', 'password'],
      body: {'currentPassword': current, 'newPassword': next},
      authenticated: true,
      isCurrent: isCurrent,
    );
  }

  Future<AccountSession> setupPassword(
    String memberId,
    String challengeId,
    String code,
    String next, {
    required bool Function() isCurrent,
  }) async {
    await _verifyMember(memberId, isCurrent: isCurrent);
    final result = await request(
      ['auth', 'password'],
      body: {'challengeId': challengeId, 'code': code, 'newPassword': next},
      authenticated: true,
      isCurrent: isCurrent,
    );
    final member = AccountSession.fromMember(result);
    if (member.id != memberId) {
      throw const JsonRequestError('account_changed', status: 401);
    }
    if (!member.hasPassword) throw const JsonRequestError('invalid_response');
    return member;
  }

  Future<Map<String, Object?>?> _requestAt(
    List<String> path, {
    Map<String, Object?>? body,
    bool authenticated = false,
    String? method,
    Map<String, String>? query,
    bool Function()? isCurrent,
    Future<void>? cancel,
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
      cancel: cancel,
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
    await clearNativeSession();
  }

  Future<void> clearNativeSession() async => _nativeSession?.write(null);

  void close() => _http.client.close();
}
