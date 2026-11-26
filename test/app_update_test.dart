import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/control/app_update_controller.dart'
    show UpdateStatus;
import '../src/shared/http/json_client.dart';

const current = AndroidAppVersion('com.jovian.preview', 1, '0.1.0');
const nextVersion = AndroidAppVersion('com.jovian.preview', 2, '0.2.0');
final updateUrl = Uri.parse(
  'https://updates.example.test/android/wood-star.apk',
);
final release = AndroidRelease(nextVersion, const ['改进窄屏布局'], updateUrl);

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);

void main() {
  test(
    'release for a different application or an older build is never offered',
    () async {
      AndroidRelease? latest = AndroidRelease(
        const AndroidAppVersion('com.other.preview', 9, '0.9'),
        ['另一应用'],
        updateUrl,
      );
      final updates = AppUpdateController(
        readInstalled: () async => current,
        readLatest: () async => latest,
        openDownload: (_) async => true,
      );
      addTearDown(updates.dispose);
      await updates.initialize();
      await updates.check(manual: true);
      expect(updates.manualStatus, UpdateStatus.unpublished);
      expect(updates.offer, isNull);
      latest = AndroidRelease(current, ['当前版本'], updateUrl);
      await updates.check(manual: true);
      expect(updates.manualStatus, UpdateStatus.current);
      expect(updates.offer, isNull);
    },
  );

  test(
    'release feed accepts only well-formed Android releases at the configured origin',
    () {
      const origin = 'https://updates.example.test';
      final candidate = {
        'applicationId': 'com.jovian.preview',
        'versionCode': 2,
        'versionName': ' 0.2.0 ',
        'notes': [' 改进界面 '],
        'downloadUrl': updateUrl.toString(),
      };
      expect(AndroidRelease.trustedDownloadOrigin('$origin/'), origin);
      expect(AndroidRelease.trustedDownloadOrigin('$origin/path'), isNull);
      expect(AndroidRelease.fromResponse({'release': null}, origin), isNull);
      final validated = AndroidRelease.fromResponse({
        'release': candidate,
      }, origin)!;
      expect(validated.version.versionName, '0.2.0');
      expect(validated.notes, ['改进界面']);
      for (final invalid in [
        {'versionCode': 0},
        {'notes': []},
        {
          'notes': [' '],
        },
        {'downloadUrl': 'http://updates.example.test/android.apk'},
        {
          'downloadUrl':
              'https://updates.example.test.attacker.invalid/android.apk',
        },
        {'downloadUrl': 'https://name@updates.example.test/android.apk'},
      ]) {
        expect(
          () => AndroidRelease.fromResponse({
            'release': {...candidate, ...invalid},
          }, origin),
          throwsFormatException,
        );
      }
    },
  );

  test(
    'automatic checks share requests, observe cooldown and offer each build once',
    () async {
      var requests = 0;
      final response = Completer<AndroidRelease?>();
      var now = DateTime.utc(2026, 11, 27);
      final updates = AppUpdateController(
        readInstalled: () async => current,
        readLatest: () async {
          requests++;
          return response.future;
        },
        openDownload: (_) async => true,
        now: () => now,
      );
      addTearDown(updates.dispose);
      await updates.initialize();
      final startup = updates.check(manual: false);
      final manual = updates.check(manual: true);
      expect(requests, 1);
      response.complete(release);
      await Future.wait([startup, manual]);
      expect(updates.offer, same(release));
      expect(updates.manualStatus, UpdateStatus.available);
      updates.dismiss(release);
      await updates.check(manual: false);
      expect(requests, 1);
      now = now.add(const Duration(minutes: 15));
      await updates.check(manual: false);
      expect(requests, 2);
      expect(updates.offer, isNull);
      await updates.check(manual: true);
      expect(updates.offer, same(release));
    },
  );

  testWidgets(
    'About checks the installed build and asks before opening the download',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 760);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      final opened = <Uri>[];
      var requests = 0;
      final updates = AppUpdateController(
        readInstalled: () async => current,
        readLatest: () async => ++requests == 1 ? null : release,
        openDownload: (url) async {
          opened.add(url);
          return opened.length == 2;
        },
      );
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.https('account.example.test'),
          client: MockClient((request) async {
            return switch (request.url.path) {
              '/account/session' => _json({
                'user': {'id': 'update-fixture', 'displayName': '更新验收'},
              }),
              '/account/auth/capabilities' => _json({}),
              '/account/agreements/catalog' => _json({
                'documents': [
                  for (final id in ['terms', 'privacy', 'ai'])
                    {
                      'id': id,
                      'title': id,
                      'version': 'preview',
                      'hash': 'hash-$id',
                      'state': 'preview',
                      'sections': [],
                    },
                ],
              }),
              '/account/agreements' => _json({
                'requiredAccepted': false,
                'permissions': {
                  for (final purpose in [
                    'destiny.cloud_interpretation',
                    'fortune.cloud_interpretation',
                    'synastry.cloud_interpretation',
                    'divination.cloud_assistance',
                  ])
                    purpose: false,
                },
              }),
              _ => _json({}, 404),
            };
          }),
        ),
      );
      await tester.pumpWidget(
        JovianApp(
          account: AccountController(api, AgreementsApi(api)),
          updates: updates,
          initialTab: JovianTab.account,
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('设置'));
      await tester.pumpAndSettle();
      final about = find.text('关于木星环');
      await tester.ensureVisible(about);
      await tester.tap(about);
      await tester.pumpAndSettle();
      expect(find.text('版本 0.1.0'), findsOneWidget);
      await tester.tap(find.text('检查更新'));
      await tester.pumpAndSettle();
      expect(requests, 2);
      expect(find.text('发现新版'), findsOneWidget);
      expect(find.text('• 改进窄屏布局'), findsOneWidget);
      expect(opened, isEmpty);
      await tester.tap(find.text('下载新版'));
      await tester.pumpAndSettle();
      expect(find.text('无法打开下载链接，请重试。'), findsOneWidget);
      await tester.tap(find.text('下载新版'));
      await tester.pumpAndSettle();
      expect(opened, [updateUrl, updateUrl]);
      expect(find.text('发现新版'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
