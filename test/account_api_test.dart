import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../src/features/account/auth/model/session.dart';
import '../src/features/account/auth/requests/account_api.dart';
import '../src/features/account/profile/model/profile_preview.dart';
import '../src/features/account/reading-profile/model/account_birth_fields.dart';
import '../src/features/account/reading-profile/model/account_reading_profile.dart';
import '../src/features/account/reading-profile/requests/account_birth_api.dart';
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
  test(
    'visitor preview keeps only fields allowed by the public projection',
    () {
      final preview = ProfilePreview.fromResponse({
        'profile': {
          'displayName': '资料主人',
          'bio': '保密简介',
          'email': 'example@example.test',
          'reading': {
            'birthDate': '1990-07-01',
            'birthTime': '12:??',
            'birthPlace': '上海市',
          },
        },
        'visibility': {
          'displayName': true,
          'bio': false,
          'birthDate': false,
          'birthTime': true,
          'birthPlace': true,
          'gender': false,
        },
      });
      expect(preview.profile.displayName, '资料主人');
      expect(preview.profile.bio, isNull);
      expect(preview.profile.reading, {
        ReadingField.birthTime: '12:??',
        ReadingField.birthPlace: '上海市',
      });
      expect(
        ReadingField.birthTime.display(
          preview.profile.reading[ReadingField.birthTime]!,
        ),
        '12:未知',
      );
    },
  );

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
    'birth settings use owner scope and checked updates for visibility',
    () async {
      const fields = AccountBirthFields(
        birthDate: '1990-07-01',
        birthTime: '12:??',
        birthPlace: '上海市',
        gender: 'female',
      );
      final saved = AccountReadingProfile(fields, {
        for (final field in ReadingField.values) field: false,
      });
      final next = saved.withVisibility(ReadingField.birthPlace, true);
      var user = 'owner';
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            switch ('${request.method} ${request.url.path}') {
              case 'GET /account/session':
                return _json({
                  'user': {'id': user},
                });
              case 'GET /account/reading-profile':
                return _json({'reading': saved.toJson()});
              case 'PATCH /account/reading-profile':
                expect(jsonDecode(request.body), {
                  ...next.toJson(),
                  'expectedOwnerId': 'owner',
                  'expectedReading': saved.toJson(),
                });
                return _json({'reading': next.toJson()});
              default:
                fail(
                  'Unexpected request ${request.method} ${request.url.path}',
                );
            }
          }),
        ),
      );
      addTearDown(api.close);
      final birth = AccountBirthApi(api);
      final existing = await birth.readWithVisibility(
        'owner',
        isCurrent: () => true,
      );
      expect(existing.fields.birthTime, '12:??');
      final result = await birth.saveWithVisibility(
        'owner',
        existing,
        next,
        isCurrent: () => true,
      );
      expect(result.isVisible(ReadingField.birthPlace), isTrue);
      expect(result.isVisible(ReadingField.birthDate), isFalse);
      user = 'other';
      await expectLater(
        birth.readWithVisibility('owner', isCurrent: () => true),
        throwsA(
          isA<JsonRequestError>().having(
            (error) => error.code,
            'code',
            'account_changed',
          ),
        ),
      );
    },
  );

  test(
    'stores and revokes native bearer sessions, with signed agreements',
    () async {
      final storage = _TestTokenStore();
      final token = 'a' * 43;
      const user = {'id': 'member-id', 'uid': '12345678', 'displayName': '甲'};
      const birthFields = AccountBirthFields(
        birthDate: '1990-07-01',
        birthTime: '12:??',
        birthPlace: '中国 · 上海市',
        gender: 'female',
      );
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
              case 'GET /account/reading-profile/birth-profile':
                expect(request.headers['authorization'], 'Bearer $token');
                expect(request.url.queryParameters, {
                  'expectedOwnerId': 'member-id',
                  'fields': 'birthDate,birthTime,birthPlace,gender',
                });
                return _json(birthFields.toJson());
              case 'PATCH /account/reading-profile/birth-profile':
                expect(request.headers['authorization'], 'Bearer $token');
                expect(jsonDecode(request.body), {
                  'expectedOwnerId': 'member-id',
                  'expected': birthFields.toJson(),
                  'profile': birthFields.toJson(),
                });
                return _json(birthFields.toJson());
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
      final birth = AccountBirthApi(api);
      final expected = await birth.read(session.id, isCurrent: () => true);
      expect(expected.birthTime, '12:??');
      await expectLater(
        birth.confirm(
          session.id,
          expected,
          birthFields,
          isCurrent: () => false,
        ),
        throwsA(
          isA<JsonRequestError>().having(
            (error) => error.code,
            'code',
            'account_changed',
          ),
        ),
      );
      expect(
        (await birth.confirm(
          session.id,
          expected,
          birthFields,
          isCurrent: () => true,
        )).toJson(),
        birthFields.toJson(),
      );
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
        'GET /account/reading-profile/birth-profile',
        'PATCH /account/reading-profile/birth-profile',
        'POST /account/agreements/permission',
        'POST /account/auth/logout',
      ]);
    },
  );
}
