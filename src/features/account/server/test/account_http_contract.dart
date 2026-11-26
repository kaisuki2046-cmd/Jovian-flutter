import 'dart:convert';
import 'dart:io';

import 'package:jovian_account_server/jovian_account_server.dart';

typedef Reply = ({
  int status,
  Map<String, Object?> body,
  String? cookie,
  String? allowOrigin,
});

Future<void> main() async {
  final web = Uri.parse('http://localhost:8114');
  var now = DateTime.utc(2026, 11, 1);
  final service = await serveAccount(
    databasePath: ':memory:',
    webOrigin: web,
    port: 0,
    allowUnverifiedRegistration: true,
    isolateLocalSession: true,
    now: () => now,
  );
  final client = HttpClient();
  Future<Reply> send(
    String method,
    String path, {
    Map<String, Object?>? body,
    String? origin,
    String? cookie,
    String? token,
    bool native = false,
  }) async {
    final base = Uri.parse('http://127.0.0.1:${service.port}');
    final request = await client.openUrl(method, base.resolve(path));
    if (origin != null) request.headers.set('Origin', origin);
    if (cookie != null) request.headers.set('Cookie', cookie);
    if (native) request.headers.set('X-App-Client', 'native');
    if (token != null) request.headers.set('Authorization', 'Bearer $token');
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    final response = await request.close();
    final value = await utf8.decoder.bind(response).join();
    return (
      status: response.statusCode,
      body: value.isEmpty
          ? const <String, Object?>{}
          : jsonDecode(value) as Map<String, Object?>,
      cookie: response.headers.value('set-cookie'),
      allowOrigin: response.headers.value('access-control-allow-origin'),
    );
  }

  const permission = 'divination.cloud_assistance';
  const permissionPath = '/account/agreements/permission';
  const guestPath = '/account/auth/guest';
  const memberPath = '/account/session';
  const login = '/account/auth/login';
  const register = '/account/auth/register';
  const logout = '/account/auth/logout';
  try {
    final forbidden = await send(
      'OPTIONS',
      guestPath,
      origin: 'https://other.example.test',
    );
    _check(
      forbidden.status == 403 && forbidden.allowOrigin == null,
      'Foreign origin was allowed.',
    );
    final preflight = await send('OPTIONS', guestPath, origin: web.origin);
    _check(
      preflight.status == 204 && preflight.allowOrigin == web.origin,
      'Preflight failed.',
    );
    final capability = await send('GET', '/account/auth/capabilities');
    _check(
      capability.body['phoneRegistrationWithoutCode'] == true &&
          capability.body['phoneCodesAvailable'] == false,
      'Capabilities differ.',
    );
    final catalog = await send('GET', '/account/agreements/catalog');
    final documents = (catalog.body['documents'] as List)
        .cast<Map<String, Object?>>();
    final acceptance = {
      'agreed': true,
      'agreements': [
        for (final doc in documents.where((doc) => doc['id'] != 'ai'))
          {
            for (final key in ['id', 'version', 'hash']) key: doc[key],
          },
      ],
    };
    final ai = documents.singleWhere((doc) => doc['id'] == 'ai');
    Map<String, Object?> choice(bool agreed) => {
      'agreed': agreed,
      'source': 'settings',
      'purpose': permission,
      'version': ai['version'],
      'hash': ai['hash'],
    };

    final missing = await send('POST', guestPath, origin: web.origin, body: {});
    _check(missing.status == 428, 'Guest started without agreement.');
    final guest = await send(
      'POST',
      guestPath,
      origin: web.origin,
      body: {'acceptance': acceptance},
    );
    final webCookie = guest.cookie?.split(';').first;
    _check(
      guest.status == 201 && !guest.body.containsKey('token'),
      'Invalid guest response.',
    );
    _check(
      webCookie?.startsWith('app_session_8114=') == true &&
          guest.cookie!.contains('HttpOnly; SameSite=Strict'),
      'Browser cookie policy differs.',
    );
    final denied = await send(
      'GET',
      '$permissionPath?purpose=$permission',
      origin: web.origin,
      cookie: webCookie,
    );
    _check(
      denied.body['allowed'] == false &&
          (denied.body['identity'] as Map)['kind'] == 'guest',
      'Consent was implied.',
    );
    final granted = await send(
      'POST',
      permissionPath,
      origin: web.origin,
      cookie: webCookie,
      body: choice(true),
    );
    _check(
      (granted.body['permissions'] as Map)[permission] == true,
      'Consent could not be granted.',
    );
    final revoked = await send(
      'POST',
      permissionPath,
      origin: web.origin,
      cookie: webCookie,
      body: choice(false),
    );
    _check(
      (revoked.body['permissions'] as Map)[permission] == false,
      'Consent could not be revoked.',
    );

    final passwordBody = {
      'phone': '13800138000',
      'password': 'offline-password-88',
      'acceptance': acceptance,
    };
    final signedUp = await send(
      'POST',
      register,
      origin: web.origin,
      cookie: webCookie,
      body: {...passwordBody, 'displayName': 'Dart 账户'},
    );
    final memberCookie = signedUp.cookie?.split(';').first;
    _check(
      signedUp.status == 201 && memberCookie != webCookie,
      'Upgrade did not rotate the session.',
    );
    final invalidGuest = await send(
      'GET',
      guestPath,
      origin: web.origin,
      cookie: webCookie,
    );
    _check(invalidGuest.status == 401, 'Previous guest token still works.');
    final member = await send(
      'GET',
      memberPath,
      origin: web.origin,
      cookie: memberCookie,
    );
    final user = member.body['user'] as Map;
    final uid = user['uid'] as String;
    _check(
      RegExp(r'^[1-9]\d{7}$').hasMatch(uid) && user['displayName'] == 'Dart 账户',
      'Invalid member profile.',
    );
    const profile = {
      'displayName': '更新后的昵称',
      'bio': '本机验证',
      'visibility': {'displayName': true, 'bio': false},
    };
    final forged = await send(
      'PATCH',
      '/account/profile',
      origin: web.origin,
      cookie: memberCookie,
      body: {...profile, 'expectedOwnerId': 'different-owner'},
    );
    _check(
      forged.status == 403,
      'A profile could be modified by a different owner.',
    );
    final updated = await send(
      'PATCH',
      '/account/profile',
      origin: web.origin,
      cookie: memberCookie,
      body: {...profile, 'expectedOwnerId': user['id']},
    );
    final updatedUser = updated.body['user'] as Map;
    _check(
      updatedUser['uid'] == uid &&
          updatedUser['displayName'] == profile['displayName'] &&
          (updatedUser['visibility'] as Map)['bio'] == false,
      'Profile update failed.',
    );

    final native = await send('POST', login, native: true, body: passwordBody);
    final token = native.body['token'] as String?;
    _check(
      native.status == 200 && token?.length == 43 && native.cookie == null,
      'Native bearer token missing.',
    );
    final nativeMember = await send(
      'GET',
      memberPath,
      native: true,
      token: token,
    );
    _check(
      (nativeMember.body['user'] as Map)['uid'] == uid,
      'Native and browser identity differ.',
    );
    const nextPassword = 'next-offline-password-99';
    final change = await send(
      'POST',
      '/account/auth/password',
      native: true,
      token: token,
      body: {
        'currentPassword': passwordBody['password'],
        'newPassword': nextPassword,
      },
    );
    _check(change.status == 204, 'Password change failed.');
    final invalidated = await send(
      'GET',
      memberPath,
      origin: web.origin,
      cookie: memberCookie,
    );
    _check(
      invalidated.status == 401,
      'An old browser session survived password rotation.',
    );
    final expiredPassword = await send(
      'POST',
      login,
      native: true,
      body: passwordBody,
    );
    _check(expiredPassword.status == 401, 'Old password still works.');
    final newBrowser = await send(
      'POST',
      login,
      origin: web.origin,
      body: {...passwordBody, 'password': nextPassword},
    );
    _check(newBrowser.status == 200, 'New password failed to sign in.');
    final loggedOut = await send('POST', logout, native: true, token: token);
    _check(
      loggedOut.status == 204 &&
          (await send('GET', memberPath, native: true, token: token)).status ==
              401,
      'Native session remained active.',
    );
    now = now.add(accountSessionTTL);
    _check(
      (await send(
            'GET',
            memberPath,
            origin: web.origin,
            cookie: newBrowser.cookie?.split(';').first,
          )).status ==
          401,
      'Web session did not expire.',
    );
    stdout.writeln(
      'Dart account HTTP passed browser/native authentication, agreement, grant, revoke and expiry.',
    );
  } finally {
    client.close(force: true);
    await service.close();
  }
}

void _check(bool result, String description) {
  if (!result) throw StateError(description);
}
