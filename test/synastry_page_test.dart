import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/synastry/synastry.dart';
import '../src/shared/http/json_client.dart';

const _place = BirthPlace(
  id: 'sample',
  name: '杭州市',
  countryCode: 'CN',
  country: '中国',
  region: '浙江省',
  city: '杭州市',
  latitude: 30.27,
  longitude: 120.15,
  timeZone: 'Asia/Shanghai',
);

void main() {
  testWidgets(
    'guest edits both profiles, retries the draft and compares locally',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 700);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final calculations = <BirthProfile>[];
      final inputs = <Map<String, Object?>>[];
      final cancelledResult = Completer<Map<String, Object?>>();
      var cancelSeen = false;
      var onlineCalls = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: SynastryPage(
            loadPlaces: () async => [_place],
            calculate: (profile, cancel) async {
              calculations.add(profile);
              if (profile.date.day == 3)
                throw const FormatException('bad chart');
              if (profile.date.day == 5) {
                unawaited(cancel.then((_) => cancelSeen = true));
                return cancelledResult.future;
              }
              return _chart(profile.date.utcMidnight.toIso8601String());
            },
            compare: (a, b, _) async {
              inputs.addAll([a, b]);
              return _comparison;
            },
            summarize: (request, _) async {
              onlineCalls++;
              return {};
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, '手动填写 B 方资料'),
            )
            .onPressed,
        isNull,
      );

      await _tap(tester, '手动填写 A 方资料');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, '确认A 方资料');
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);

      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '手动填写 B 方资料');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, '修改 B 方资料');
      expect(_input(tester, '出生日期').controller?.text, '1992-07-02');
      expect(_input(tester, '出生小时').controller?.text, '09');
      expect(_input(tester, '出生地').controller?.text, '杭州市');
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '女'))
            .selected,
        isTrue,
      );
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1992-07-03',
      );
      await _tap(tester, '确认B 方资料');
      expect(find.text('排盘失败，请核对出生资料后重试。'), findsOneWidget);
      expect(_input(tester, '出生日期').controller?.text, '1992-07-03');
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1992-07-04',
      );
      await _tap(tester, '确认B 方资料');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsOneWidget);

      await _tap(tester, '比较盘面');
      expect(inputs.map((input) => input['mode']), [
        'manual_subject',
        'manual_subject',
      ]);
      expect(
        (inputs.last['chart'] as Map)['calculatedAt'],
        '1992-07-04T00:00:00.000Z',
      );
      await _tap(tester, '八字 · 可用');
      expect(find.text('八字真实对照事实'), findsOneWidget);
      expect(find.text('登录或进入游客体验后生成解读'), findsOneWidget);
      expect(calculations.map((profile) => profile.date.day), [1, 2, 3, 4]);
      expect(onlineCalls, 0);

      await _tap(tester, '修改 A 方资料');
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1990-06-05',
      );
      final confirm = find.text('确认A 方资料');
      await tester.ensureVisible(confirm);
      await tester.pump();
      await tester.tap(confirm);
      await tester.pump();
      expect(find.bySemanticsLabel('正在计算盘面'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(cancelSeen, isTrue);
      cancelledResult.complete(_chart('1990-06-05T00:00:00.000Z'));
      await tester.pumpAndSettle();
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);
      expect(find.text('1990-06-05 09:20 · 杭州市'), findsNothing);

      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsNothing);
      expect(find.text('双人盘面对照'), findsNothing);
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '手动填写 B 方资料');
      expect(_input(tester, '出生日期').controller?.text, '');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'opens the active guest account archive and keeps interpretation private',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 700);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final latest = 'a' * 64;
      final older = 'b' * 64;
      final requests = <String>[];
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.https('fixture.invalid'),
          client: MockClient((request) async {
            final path = request.url.path;
            if (path.startsWith('/account/reading-history')) {
              expect(request.method, 'GET');
              expect(
                request.url.queryParameters['expectedOwnerId'],
                'guest-fixture',
              );
              expect(request.url.queryParameters['kind'], 'synastry');
              requests.add(path);
            }
            return switch (path) {
              '/account/session' => _json({}, 401),
              '/account/auth/guest' => _json({
                'id': 'guest-fixture',
                'expiresAt': 4102444800000,
              }),
              '/account/auth/capabilities' => _json({}),
              '/account/agreements/catalog' => _json({
                'documents': [
                  for (final id in ['privacy', 'terms', 'ai'])
                    {
                      'id': id,
                      'title': id,
                      'version': '1',
                      'hash': 'sha',
                      'state': 'preview',
                      'sections': [],
                    },
                ],
              }),
              '/account/agreements' => _json({
                'requiredAccepted': true,
                'permissions': {
                  for (final purpose in aiPurposes.keys) purpose: false,
                },
              }),
              '/account/reading-history' => _json({
                'entries': [_entry(latest, '最近合盘'), _entry(older, '早期合盘')],
                'nextCursor': null,
              }),
              '/account/reading-history/latest' => _json(
                _archived(latest, '最近'),
              ),
              _ when path.endsWith(older) => _json(_archived(older, '早期')),
              _ => throw StateError('Unexpected path $path'),
            };
          }),
        ),
      );
      final account = AccountController(api, AgreementsApi(api));
      addTearDown(account.dispose);
      await account.initialize();
      expect(account.authorizedSession?.id, 'guest-fixture');
      await tester.pumpWidget(
        MaterialApp(
          home: SynastryPage(
            loadPlaces: () async => [_place],
            account: account,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('从合盘存档读取'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '亲情'), findsOneWidget);
      expect(find.text('读取本人盘面'), findsNothing);
      await _tap(tester, '查看已存解读');
      await _tap(tester, '早期合盘');
      await tester.pumpAndSettle();
      final collaboration = find.widgetWithText(OutlinedButton, '合作');
      expect(collaboration, findsOneWidget);
      await tester.tap(collaboration);
      await tester.pumpAndSettle();
      expect(find.text('早期合作正文'), findsOneWidget);
      expect(find.text('最近合作正文'), findsNothing);
      expect(tester.getCenter(find.text('早期合作正文')).dy, lessThan(700));
      expect(
        requests,
        containsAll([
          '/account/reading-history/latest',
          '/account/reading-history',
          '/account/reading-history/$older',
        ]),
      );
      expect(tester.takeException(), isNull);
    },
  );
}

const _comparison = <String, Object?>{
  'comparison': {
    'sections': [
      {
        'system': 'bazi',
        'coverage': 'complete',
        'evidence': [
          {'observation': '八字真实对照事实'},
        ],
      },
    ],
  },
  'summaryRequest': {'rulesVersion': 'fixture', 'facts': []},
};

Map<String, Object?> _chart(String calculatedAt) => {
  'calculatedAt': calculatedAt,
  'bazi': {'status': 'complete'},
  'ziwei': {'status': 'complete'},
  'western': {'status': 'complete'},
};

Map<String, Object?> _entry(String id, String title) => {
  'id': id,
  'title': title,
  'calculatedAt': '2026-10-20T09:00:00.000Z',
  'savedAt': 1792490400000,
  'kind': 'synastry',
};

Map<String, Object?> _archived(String id, String prefix) => {
  ..._entry(id, '${prefix}合盘'),
  'report': {
    'version': 1,
    'kind': 'synastry',
    'sections': [
      for (final label in ['亲情', '友情', '爱情', '合作'])
        {'title': label, 'body': '$prefix${label}正文'},
    ],
  },
};

http.Response _json(Object? value, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(value)),
  status,
  headers: {'Content-Type': 'application/json; charset=utf-8'},
);

TextField _input(WidgetTester tester, String label) =>
    tester.widget<TextField>(find.widgetWithText(TextField, label));

Future<void> _fillProfile(WidgetTester tester, String date) async {
  await tester.enterText(find.widgetWithText(TextField, '出生日期'), date);
  await tester.enterText(find.widgetWithText(TextField, '出生小时'), '09');
  await tester.enterText(find.widgetWithText(TextField, '出生分钟'), '20');
  await tester.enterText(find.widgetWithText(TextField, '出生地'), '杭州');
  await tester.pumpAndSettle();
  await _tap(tester, '杭州市');
  await _tap(tester, '女');
}

Future<void> _tap(WidgetTester tester, String label) async {
  final found = find.text(label);
  if (found.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      found,
      180,
      scrollable: find.byType(Scrollable).first,
    );
  }
  await tester.ensureVisible(found);
  await tester.pumpAndSettle();
  await tester.tap(found);
  await tester.pumpAndSettle();
}
