import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/destiny/destiny.dart';
import '../src/features/destiny/control/destiny_device_birth_profile.dart';
import '../src/shared/http/json_client.dart';
import 'support/birth_picker_fixture.dart';

const _member = 'device-fixture-member';
const _other = 'another-member';
const _tokenKey = 'fixture-session';
const _archiveId =
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const _place = BirthPlace(
  id: 'shanghai',
  name: '上海',
  countryCode: 'CN',
  country: '中国',
  region: '上海',
  city: '上海',
  latitude: 31.2,
  longitude: 121.47,
  timeZone: 'Asia/Shanghai',
);
const _birth = BirthProfile(
  date: BirthDate(1998, 8, 9),
  time: BirthTime(hour: 12),
  place: _place,
  gender: BirthGender.female,
);
Future<List<BirthPlace>> _places() async => [_place];
http.Response _json(Object? value) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), 200);

Map<String, Object?> _birthFields([String? date = '1998-08-09']) => {
  'birthDate': date ?? '',
  'birthTime': date == null ? '' : '12:30',
  'birthPlace': date == null ? '' : '上海',
  'gender': date == null ? '' : 'female',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'serializes a write and deletion, keeping each member profile separate',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      await Future.wait([
        saveLocalDestinyBirthProfile(_member, _birth, () => true),
        saveLocalDestinyBirthProfile(_other, _birth, () => true),
        clearLocalDestinyBirthProfile(_member),
      ]);
      expect(await readLocalDestinyBirthProfile(_member, _places), isNull);
      final kept = await readLocalDestinyBirthProfile(_other, _places);
      expect(kept?.place.id, _place.id);
      expect(kept?.time.hour, 12);
      expect(kept?.time.minute, isNull);
      await clearLocalDestinyBirthProfile(_member);
      await saveLocalDestinyBirthProfile(_member, _birth, () => false);
      expect(await readLocalDestinyBirthProfile(_member, _places), isNull);
    },
  );

  testWidgets(
    'destiny authorization preserves the chart and cancels stale reports',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({_tokenKey: 'test-token'});
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(430, 1100);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);

      const purpose = 'destiny.cloud_interpretation';
      const calculatedAt = '2025-08-09T12:00:00Z';
      final firstReport = Completer<String>();
      var allowed = false;
      var cancelled = false;
      var calculations = 0;
      var reportRequests = 0;
      var archiveWrites = 0;
      Map<String, Object?> agreementState() => {
        'requiredAccepted': true,
        'permissions': {
          for (final key in aiPurposes.keys) key: key == purpose && allowed,
        },
      };

      final api = AccountApi(
        JsonHttpClient(
          base: Uri.https('fixture.invalid'),
          client: MockClient((request) async {
            switch ('${request.method} ${request.url.path}') {
              case 'GET /account/session':
                return _json({
                  'user': {'id': _member, 'displayName': '测试会员'},
                });
              case 'GET /account/auth/capabilities':
                return _json({});
              case 'GET /account/agreements/catalog':
                return _json({
                  'documents': [
                    for (final id in ['terms', 'privacy', 'ai'])
                      {
                        'id': id,
                        'title': id,
                        'version': 'v1',
                        'hash': id,
                        'state': 'published',
                        'sections': [],
                      },
                  ],
                });
              case 'GET /account/agreements':
                return _json(agreementState());
              case 'POST /account/agreements/permission':
                final proof = jsonDecode(request.body) as Map<String, Object?>;
                expect(proof['purpose'], purpose);
                allowed = proof['agreed']! as bool;
                return _json(agreementState());
              case 'GET /account/reading-profile/birth-profile':
              case 'PATCH /account/reading-profile/birth-profile':
                return _json(_birthFields());
              case 'GET /account/destiny-history/latest':
                return _json(null);
              case 'POST /account/destiny-history':
                archiveWrites++;
                final body = jsonDecode(request.body) as Map<String, Object?>;
                expect(body['expectedOwnerId'], _member);
                expect(body['report'], containsPair('overview', '最终解读。'));
                return _json({
                  'id': _archiveId,
                  'title': '命盘记录',
                  'calculatedAt': calculatedAt,
                  'savedAt': 1754740800000,
                  'chartSnapshotSaved': true,
                });
              default:
                fail(
                  'Unexpected request ${request.method} ${request.url.path}',
                );
            }
          }),
        ),
        nativeSession: const SecureNativeSession(_tokenKey),
      );
      final account = AccountController(api, AgreementsApi(api));
      addTearDown(account.dispose);
      await account.initialize();

      final navigation = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigation,
          builder: (_, child) => AccountSectionLinks(
            open: (target) async {
              expect(target.section, AccountSection.aiPermissions);
              await navigation.currentState!.push<void>(
                MaterialPageRoute(
                  builder: (_) => AccountSectionPage(
                    account: account,
                    target: target,
                    themeMode: ThemeMode.system,
                    onThemeModeChanged: (_) {},
                    openAccount: () {},
                  ),
                ),
              );
            },
            child: child!,
          ),
          home: DestinyPage(
            account: account,
            loadPlaces: _places,
            calculateReading: (profile, _, _) async {
              calculations++;
              return DestinyReading.fromLegacy({
                'archive': {
                  'version': 1,
                  'calculatedAt': calculatedAt,
                  'timeKnown': profile.time.timeKnown,
                  'chartSnapshot': {},
                  'charts': [
                    for (final method in ['bazi', 'ziwei', 'western'])
                      {'method': method, 'rows': []},
                  ],
                },
                'reportRequest': {'checked': true},
              });
            },
            requestReport: (payload, cancel) async {
              reportRequests++;
              expect(payload, {'checked': true});
              if (!allowed) {
                throw const JsonRequestError(
                  'ai_permission_required',
                  status: 428,
                );
              }
              if (reportRequests == 1) {
                unawaited(cancel.then((_) => cancelled = true));
                return firstReport.future;
              }
              return '最终解读。';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      Future<void> tap(String label) async {
        await tester.tap(find.text(label));
        await tester.pumpAndSettle();
      }

      Future<void> grant() async {
        await tap('前往 AI 授权');
        expect(find.text('AI 数据共享授权'), findsOneWidget);
        await tap('命理在线解读');
        await tap('同意授权');
        await tester.pageBack();
        await tester.pumpAndSettle();
      }

      await tap('核对资料');
      await tap('核对出生资料');
      await tap('确认并同步测算');
      expect(calculations, 1);
      expect(reportRequests, 0);
      expect(find.text('查看命盘'), findsOneWidget);

      await grant();
      await tester.tap(find.text('获取命理解读'));
      await tester.pump();
      expect(reportRequests, 1);
      await account.choose(account.catalog!.ai, purpose, false);
      await tester.pump();
      expect(cancelled, isTrue);
      firstReport.complete('授权撤回后的旧结果。');
      await tester.pumpAndSettle();
      expect(find.text('授权撤回后的旧结果。'), findsNothing);
      expect(archiveWrites, 0);

      await grant();
      allowed = false;
      await tap('获取命理解读');
      expect(reportRequests, 2);
      expect(account.agreementState?.permissions[purpose], isFalse);
      expect(find.text('前往 AI 授权'), findsOneWidget);

      await grant();
      await tap('获取命理解读');
      expect(reportRequests, 3);
      expect(calculations, 1);
      expect(archiveWrites, 1);
      expect(find.text('最终解读。'), findsOneWidget);
    },
  );

  testWidgets(
    'member validates complete time, refreshes archives, and manages the local copy',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({_tokenKey: 'test-token'});
      tester.view.physicalSize = const Size(430, 1150);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      const entry = {
        'id': _archiveId,
        'title': '命盘记录',
        'calculatedAt': '2025-08-09T12:00:00Z',
        'savedAt': 1754740800000,
        'chartSnapshotSaved': true,
      };
      var remoteBirth = {..._birthFields(), 'birthTime': '12:??'};
      Map<String, Object?>? archive;
      var birthUpdates = 0;
      var calculations = 0;
      var latestReads = 0;
      var exactReads = 0;
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://fixture.invalid'),
          client: MockClient((request) async {
            switch ('${request.method} ${request.url.path}') {
              case 'GET /account/session':
                return _json({
                  'user': {'id': _member, 'displayName': '测试会员'},
                });
              case 'GET /account/auth/capabilities':
                return _json({});
              case 'GET /account/agreements/catalog':
                return _json({
                  'documents': [
                    for (final id in ['terms', 'privacy', 'ai'])
                      {
                        'id': id,
                        'title': id,
                        'version': 'v1',
                        'hash': id,
                        'state': 'published',
                        'sections': [],
                      },
                  ],
                });
              case 'GET /account/agreements':
                return _json({
                  'requiredAccepted': true,
                  'permissions': {
                    for (final purpose in aiPurposes.keys) purpose: true,
                  },
                });
              case 'GET /account/reading-profile/birth-profile':
                expect(request.url.queryParameters['expectedOwnerId'], _member);
                return _json(remoteBirth);
              case 'PATCH /account/reading-profile/birth-profile':
                birthUpdates++;
                final body = jsonDecode(request.body) as Map<String, Object?>;
                expect(body['expectedOwnerId'], _member);
                expect(body['expected'], remoteBirth);
                remoteBirth = body['profile'] as Map<String, Object?>;
                return _json(remoteBirth);
              case 'GET /account/destiny-history/latest':
                latestReads++;
                expect(request.url.queryParameters['expectedOwnerId'], _member);
                return _json(archive);
              case 'GET /account/destiny-history/$_archiveId':
                exactReads++;
                expect(request.url.queryParameters['expectedOwnerId'], _member);
                return _json(archive);
              case 'GET /account/destiny-history':
                return _json({
                  'entries': [entry],
                });
              case 'POST /account/destiny-history':
                final body = jsonDecode(request.body) as Map<String, Object?>;
                expect(body['expectedOwnerId'], _member);
                archive = {...entry, 'report': body['report']};
                return _json(entry);
              default:
                fail(
                  'Unexpected request ${request.method} ${request.url.path}',
                );
            }
          }),
        ),
        nativeSession: const SecureNativeSession(_tokenKey),
      );
      final account = AccountController(api, AgreementsApi(api));
      addTearDown(account.dispose);
      await account.initialize();

      Future<void> mount(String key, {bool active = true}) async {
        await tester.pumpWidget(
          MaterialApp(
            home: DestinyPage(
              key: ValueKey(key),
              active: active,
              account: account,
              loadPlaces: _places,
              calculateReading: (profile, _, _) async {
                calculations++;
                expect(profile.time.timeKnown, isTrue);
                return DestinyReading.fromLegacy({
                  'archive': {
                    'version': 1,
                    'calculatedAt': entry['calculatedAt'],
                    'timeKnown': profile.time.timeKnown,
                    'chartSnapshot': {},
                    'charts': [
                      for (final method in ['bazi', 'ziwei', 'western'])
                        {'method': method, 'rows': []},
                    ],
                  },
                  'reportRequest': {'checked': true},
                });
              },
              requestReport: (payload, _) async {
                expect(payload, {'checked': true});
                return '测试解读。';
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      await mount('new-reading');
      await tester.tap(find.text('核对资料'));
      await tester.pumpAndSettle();
      expect(find.text('12 时 · 分钟未知'), findsOneWidget);
      await tester.tap(find.text('核对出生资料'));
      await tester.pumpAndSettle();
      expect(find.text('请填写并核对出生小时和分钟。'), findsOneWidget);
      expect(find.text('确认并同步测算'), findsNothing);
      expect(birthUpdates, 0);
      expect(calculations, 0);
      expect(remoteBirth['birthTime'], '12:??');
      await selectBirthTime(tester, 12, 30);
      await tester.tap(find.text('核对出生资料'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认并同步测算'));
      await tester.pumpAndSettle();
      expect(find.text('已保存，下次进入命理页可直接查看。'), findsOneWidget);
      expect(calculations, 1);
      expect(await readLocalDestinyBirthProfile(_member, _places), isNull);
      await tester.tap(find.text('保存出生资料到本机'));
      await tester.pumpAndSettle();
      expect(find.text('出生资料已保存到本机。'), findsOneWidget);

      remoteBirth = _birthFields(null);
      await mount('restore-device-and-report');
      expect(find.text('上次解读'), findsOneWidget);
      expect(find.text('测试解读。'), findsOneWidget);
      final beforeReturn = latestReads;
      await mount('restore-device-and-report', active: false);
      archive = {
        ...archive!,
        'report': {
          ...archive!['report'] as Map<String, Object?>,
          'overview': '另一台设备保存的解读。',
        },
      };
      expect(latestReads, beforeReturn);
      await mount('restore-device-and-report');
      expect(latestReads, beforeReturn + 1);
      expect(find.text('另一台设备保存的解读。'), findsOneWidget);
      expect(find.text('测试解读。'), findsNothing);
      expect(calculations, 1);
      expect(find.text('本机出生资料'), findsOneWidget);
      await tester.tap(find.text('重新测算'));
      await tester.pumpAndSettle();
      expect(
        find.widgetWithText(OutlinedButton, '1998 年 8 月 9 日'),
        findsOneWidget,
      );

      await selectBirthDate(tester, '1999-06-30');
      await mount('restore-device-and-report', active: false);
      await mount('restore-device-and-report');
      expect(latestReads, beforeReturn + 1);
      expect(
        find.widgetWithText(OutlinedButton, '1999 年 6 月 30 日'),
        findsOneWidget,
      );

      remoteBirth = _birthFields('2000-01-02');
      await mount('restore-remote-precedence');
      await tester.tap(find.text('重新测算'));
      await tester.pumpAndSettle();
      expect(
        find.widgetWithText(OutlinedButton, '2000 年 1 月 2 日'),
        findsOneWidget,
      );
      await tester.tap(find.text('返回入口'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('删除本机档案'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('删除'));
      await tester.pumpAndSettle();
      expect(find.text('已删除本机出生档案。'), findsOneWidget);
      expect(find.text('本机出生资料'), findsNothing);
      expect(find.text('上次解读'), findsOneWidget);
      expect(await readLocalDestinyBirthProfile(_member, _places), isNull);
      expect(archive, isNotNull);
      final previousLatestReads = latestReads;
      final previousExactReads = exactReads;
      await tester.tap(find.text('查看命盘记录'));
      await tester.pumpAndSettle();
      expect(find.byType(ArchivedChartsPage), findsOneWidget);
      expect(exactReads, previousExactReads + 1);
      expect(latestReads, previousLatestReads);
    },
  );
}
