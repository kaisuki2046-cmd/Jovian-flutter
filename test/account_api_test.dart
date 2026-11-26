import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../src/features/account/auth/model/session.dart';
import '../src/features/account/auth/requests/account_api.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/account/settings/requests/agreements_api.dart';
import '../src/shared/http/json_client.dart';

class _TestTokenStore implements NativeSessionStorage {
  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String? token) async => this.token = token;
}

http.Response _json(Object value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);

Map<String, Object?> _document(String id) => {
  'id': id,
  'version': 'v1',
  'hash': 'hash-$id',
  'title': id,
  'state': 'preview',
  'sections': [
    {'title': '用途', 'text': '确认时发送版本号和摘要'},
  ],
};

void main() {
  test('matches the account service identifier rules', () {
    expect(AccountIdentifier.parse(' Test@Example.test ')?.field, 'email');
    expect(
      AccountIdentifier.parse(' Test@Example.test ')?.value,
      'test@example.test',
    );
    expect(AccountIdentifier.parse('138 0013 8001')?.value, '+8613800138001');
    expect(AccountIdentifier.parse('+1 (415) 555-0123')?.field, 'phone');
    expect(AccountIdentifier.parse('123456'), isNull);
  });

  test(
    'stores and revokes native bearer sessions, with signed agreements',
    () async {
      final storage = _TestTokenStore();
      final token = 'a' * 43;
      const user = {'id': 'member-id', 'uid': '12345678', 'displayName': '甲'};
      final routes = <String>[];
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            expect(request.headers['x-app-client'], 'native');
            final route = '${request.method} ${request.url.path}';
            routes.add(route);
            switch (route) {
              case 'GET /account/agreements/catalog':
                expect(request.headers['authorization'], isNull);
                return _json({
                  'documents': [
                    _document('terms'),
                    _document('privacy'),
                    _document('ai'),
                  ],
                });
              case 'POST /account/auth/login':
                expect(request.headers['authorization'], isNull);
                expect(jsonDecode(request.body), {
                  'email': 'a@example.test',
                  'password': 'test-password',
                  'acceptance': {
                    'agreed': true,
                    'agreements': [
                      {
                        'id': 'privacy',
                        'version': 'v1',
                        'hash': 'hash-privacy',
                      },
                      {'id': 'terms', 'version': 'v1', 'hash': 'hash-terms'},
                    ],
                  },
                });
                return _json({'user': user, 'token': token});
              case 'GET /account/session':
                expect(request.headers['authorization'], 'Bearer $token');
                return _json({'user': user});
              case 'POST /account/agreements/permission':
                expect(request.headers['authorization'], 'Bearer $token');
                final payload = jsonDecode(request.body);
                expect(payload, {
                  'version': 'v1',
                  'hash': 'hash-ai',
                  'purpose': 'divination.cloud_assistance',
                  'agreed': true,
                  'source': 'settings',
                });
                return _json({
                  'requiredAccepted': true,
                  'permissions': {
                    for (final purpose in aiPurposes.keys)
                      purpose: purpose == 'divination.cloud_assistance',
                  },
                });
              case 'POST /account/auth/logout':
                expect(request.headers['authorization'], 'Bearer $token');
                return http.Response('', 204);
              default:
                fail('Unexpected request $route');
            }
          }),
        ),
        nativeSession: storage,
      );
      addTearDown(api.close);
      expect(await api.restore(), isNull);
      expect(routes, isEmpty);

      final agreements = AgreementsApi(api);
      final catalog = await agreements.catalog();
      final session = await api.signIn(AuthMethod.password, {
        'email': 'a@example.test',
        'password': 'test-password',
      }, catalog);
      expect(session.uid, '12345678');
      expect(session.scope, 'member:member-id');
      expect(await api.readNativeSession(), token);
      expect((await api.restore())?.scope, session.scope);
      final state = await agreements.choose(
        catalog.ai,
        'divination.cloud_assistance',
        true,
      );
      expect(state.permissions['divination.cloud_assistance'], isTrue);
      expect(state.permissions['destiny.cloud_interpretation'], isFalse);
      await api.signOut();
      expect(await api.readNativeSession(), isNull);
      expect(await api.restore(), isNull);
      expect(routes, [
        'GET /account/agreements/catalog',
        'POST /account/auth/login',
        'GET /account/session',
        'POST /account/agreements/permission',
        'POST /account/auth/logout',
      ]);
    },
  );
}
