import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../src/bootstrap/synastry.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/synastry/control/synastry_page_controller.dart';
import '../src/features/synastry/model/synastry_relationship.dart';
import '../src/features/synastry/synastry.dart';
import '../src/features/synastry/view/synastry_record_box.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/interface_language.dart';
import 'support/birth_picker_fixture.dart';

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
  testWidgets('record dots, swipes and the long-press grid select a cover', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          extendBody: true,
          bottomNavigationBar: const SizedBox(height: 90),
          body: SynastryPage(loadPlaces: () async => [_place]),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.getRect(find.text('开始合盘')).bottom, lessThan(590));
    expect(
      tester.getCenter(find.text('A 方')).dx,
      lessThan(tester.getCenter(find.text('B 方')).dx),
    );
    final dots = find.byKey(const ValueKey('synastry-record-dots'));
    final track = tester.getRect(dots);
    Offset dot(SynastryEdition edition) => Offset(
      track.left +
          track.width * (edition.index + .5) / SynastryEdition.values.length,
      track.center.dy,
    );
    Finder cover(SynastryEdition edition) => find.byKey(ValueKey(edition));
    expect(cover(SynastryEdition.family), findsOneWidget);
    await tester.tapAt(dot(SynastryEdition.friend));
    await tester.pumpAndSettle();
    expect(cover(SynastryEdition.friend), findsOneWidget);

    await tester.drag(
      find.byKey(const ValueKey('synastry-record')),
      const Offset(-110, 0),
    );
    await tester.pumpAndSettle();
    expect(cover(SynastryEdition.classmate), findsOneWidget);
    await tester.dragFrom(
      dot(SynastryEdition.classmate),
      dot(SynastryEdition.client) - dot(SynastryEdition.classmate),
    );
    await tester.pumpAndSettle();
    expect(cover(SynastryEdition.client), findsOneWidget);
    await tester.longPress(dots);
    await tester.pumpAndSettle();
    expect(find.text('选择关系'), findsOneWidget);
    expect(find.byType(OutlinedButton), findsNWidgets(22));
    await _tap(tester, '恋人');
    expect(cover(SynastryEdition.lover), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('both participants switch between locally entered choices', (
    tester,
  ) async {
    var calculations = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: SynastryPage(
          loadPlaces: () async => [_place],
          calculate: (profile, _) async {
            calculations++;
            return _chart(profile.date.utcMidnight.toIso8601String());
          },
          compare: (_, _, _) async => _comparison,
        ),
      ),
    );
    await tester.pumpAndSettle();

    Future<void> openPartner() async {
      final button = find.text('B 方');
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    Finder inSheet(String label) => find.descendant(
      of: find.byType(BottomSheet),
      matching: find.text(label),
    );

    Future<void> tapSheet(String label) async {
      final target = inSheet(label);
      await tester.ensureVisible(target);
      await tester.tap(target);
      await tester.pumpAndSettle();
    }

    const consent = '我已获准使用 B 方资料进行本次合盘';
    const first = '1992-07-02 09:20 · 杭州市';
    const second = '1994-03-06 09:20 · 杭州市';
    await openPartner();
    final add = find.ancestor(
      of: inSheet('添加对象'),
      matching: find.byWidgetPredicate((widget) => widget is FilledButton),
    );
    expect(tester.widget<FilledButton>(add).onPressed, isNull);
    await tapSheet(consent);
    await tapSheet('添加对象');
    await _fillProfile(tester, '1992-07-02');
    await _tap(tester, '确认B 方资料');

    await openPartner();
    await tapSheet('添加对象');
    await _fillProfile(tester, '1994-03-06');
    await _tap(tester, '确认B 方资料');

    await openPartner();
    expect(inSheet(first), findsOneWidget);
    expect(inSheet(second), findsOneWidget);
    await tapSheet(first);
    await openPartner();
    final firstTile = find.ancestor(
      of: inSheet(first),
      matching: find.byType(ListTile),
    );
    expect(tester.widget<ListTile>(firstTile).selected, isTrue);
    expect(inSheet(second), findsOneWidget);
    expect(calculations, 2);

    await tapSheet(consent);
    expect(inSheet(first), findsNothing);
    expect(inSheet(second), findsNothing);
    await _back(tester);

    await _tap(tester, 'A 方');
    await _tap(tester, '手动填写 A 方资料');
    await _fillProfile(tester, '1990-06-01');
    await _tap(tester, '确认A 方资料');
    await _tap(tester, 'A 方');
    await _tap(tester, '添加其他人');
    await tester.enterText(find.byType(TextField).first, '小林');
    await _fillProfile(tester, '1993-04-04');
    await _tap(tester, '确认A 方资料');
    expect(find.text('小林'), findsOneWidget);
    await _tap(tester, 'A 方');
    await tapSheet('本人');
    expect(find.text('本人'), findsOneWidget);
    await _tap(tester, 'A 方');
    await tapSheet('小林');
    expect(find.text('小林'), findsOneWidget);
    expect(calculations, 4);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a slow archive read does not block a fresh local comparison', (
    tester,
  ) async {
    final pending = Completer<http.Response>();
    var latestReads = 0;
    var comparisons = 0;
    final account = await _fixtureAccount((request) {
      expect(request.url.path, '/account/reading-history/latest');
      latestReads++;
      return pending.future;
    });
    await tester.pumpWidget(
      MaterialApp(
        home: SynastryPage(
          loadPlaces: () async => [_place],
          account: account,
          calculate: (profile, _) async =>
              _chart(profile.date.utcMidnight.toIso8601String()),
          compare: (_, _, _) async {
            comparisons++;
            return _comparison;
          },
        ),
      ),
    );
    await tester.pump();
    expect(latestReads, 1);
    await _tap(tester, 'A 方');
    final start = find.widgetWithText(OutlinedButton, '手动填写 A 方资料');
    expect(tester.widget<OutlinedButton>(start).onPressed, isNotNull);
    await tester.ensureVisible(start);
    await tester.tap(start);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await _fillProfile(tester, '1990-06-01');
    await _tap(tester, '确认A 方资料');

    pending.complete(_json(_archived('a' * 64, '过期返回')));
    await tester.pumpAndSettle();
    expect(find.text('查看最近报告'), findsNothing);
    await _tap(tester, 'A 方');
    expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);
    await _back(tester);

    await _tap(tester, 'B 方');
    await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
    await _tap(tester, '添加对象');
    await _fillProfile(tester, '1992-07-02');
    await _tap(tester, '确认B 方资料');
    await _tap(tester, '开始合盘');
    expect(find.text('合盘报告'), findsOneWidget);
    expect(find.text('双人盘面对照'), findsOneWidget);
    expect(comparisons, 1);
    final overlay = tester.element(find.text('合盘报告'));
    expect(ModalRoute.of(overlay), isA<RawDialogRoute<void>>());
    await tester.tap(find.byTooltip('收进唱片盒'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 680));
    expect(find.byType(SynastryRecordBox), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('合盘报告'), findsNothing);
    expect(find.text('开始合盘').hitTestable(), findsOneWidget);
  });

  testWidgets('can retry the latest report without entering birth details', (
    tester,
  ) async {
    var latestReads = 0;
    final account = await _fixtureAccount((request) {
      expect(request.url.path, '/account/reading-history/latest');
      return ++latestReads == 1
          ? _json({'error': 'unavailable'}, 503)
          : _json(_archived('a' * 64, '恢复后'));
    });
    await tester.pumpWidget(
      MaterialApp(
        home: SynastryPage(loadPlaces: () async => [_place], account: account),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('暂时无法读取已存合盘。'), findsOneWidget);
    await _tap(tester, '重试读取');
    await _tap(tester, '查看最近报告');
    expect(find.text('恢复后亲情正文'), findsOneWidget);
    expect(find.text('暂时无法读取已存合盘。'), findsNothing);
    expect(latestReads, 2);
  });

  testWidgets(
    'English comparison and a long report keep their layout on a narrow page',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final result = Completer<Map<String, String>>();
      final account = await _fixtureAccount(
        (request) {
          if (request.method == 'POST' &&
              request.url.path == '/account/reading-history') {
            final report = (jsonDecode(request.body) as Map)['report'] as Map;
            expect((report['sections'] as List).first['title'], '亲情');
            expect(report['title'], '合盘 · 家人 · Avery & Riley');
            return _json(_entry('a' * 64, '四类关系归档'));
          }
          return _json(null);
        },
        share: true,
        member: true,
      );
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [interfaceStringsDelegate],
          home: SynastryPage(
            loadPlaces: () async => [_place],
            account: account,
            calculate: (profile, _) async =>
                _chart(profile.date.utcMidnight.toIso8601String()),
            compare: (_, __, ___) async => _comparison,
            summarize: (_, __, ___) => result.future,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Person A'), findsOneWidget);
      await _tap(tester, 'Person A');
      await _tap(tester, 'Enter person A manually');
      expect(find.text('Person A’s birth details'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, 'Avery');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, 'Confirm person A’s details');
      await _tap(tester, 'Person B');
      await _tap(
        tester,
        'I have permission to use person B’s details for this comparison',
      );
      await _tap(tester, 'Add a person');
      expect(find.text('Person B’s birth details'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, 'Riley');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, 'Confirm person B’s details');
      final start = find.text('Start comparison');
      await tester.ensureVisible(start);
      await tester.tap(start);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Compatibility report'), findsOneWidget);
      final panel = tester.getRect(
        find.byKey(const ValueKey('synastry-report-panel')),
      );
      expect(panel, const Rect.fromLTWH(8, 8, 304, 684));
      result.complete({
        for (final key in ['family', 'friendship', 'romance', 'collaboration'])
          key: List.filled(30, '保存在同一份合盘报告中的段落。').join('\n\n'),
      });
      await tester.pumpAndSettle();

      expect(find.text('Compatibility reading').hitTestable(), findsOneWidget);
      final collaboration = find.widgetWithText(ChoiceChip, 'Collaboration');
      await tester.ensureVisible(collaboration);
      await tester.tap(collaboration);
      await tester.pumpAndSettle();
      expect(tester.widget<ChoiceChip>(collaboration).selected, isTrue);
      await _tap(tester, 'BaZi · Available');
      expect(find.text('八字真实对照事实'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

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
            summarize: (request, _, _) async {
              onlineCalls++;
              return {};
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _tap(tester, 'B 方');
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '添加对象'))
            .onPressed,
        isNull,
      );
      await _back(tester);

      await _tap(tester, 'A 方');
      await _tap(tester, '手动填写 A 方资料');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, '确认A 方资料');
      await _tap(tester, 'A 方');
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);
      await _back(tester);

      await _tap(tester, 'B 方');
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '添加对象');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, 'B 方');
      await _tap(tester, '修改 B 方资料');
      expect(
        find.widgetWithText(OutlinedButton, '1992 年 7 月 2 日'),
        findsOneWidget,
      );
      expect(find.widgetWithText(OutlinedButton, '09:20'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '杭州市'), findsOneWidget);
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '女'))
            .selected,
        isTrue,
      );
      await selectBirthDate(tester, '1992-07-03');
      await _tap(tester, '确认B 方资料');
      expect(find.text('排盘失败，请核对出生资料后重试。'), findsOneWidget);
      expect(
        find.widgetWithText(OutlinedButton, '1992 年 7 月 3 日'),
        findsOneWidget,
      );
      await selectBirthDate(tester, '1992-07-04');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, 'B 方');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsOneWidget);
      await _back(tester);

      await _tap(tester, '开始合盘');
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

      await _back(tester);
      await _tap(tester, 'A 方');
      await _tap(tester, '修改 A 方资料');
      await selectBirthDate(tester, '1990-06-05');
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
      await _tap(tester, 'A 方');
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);
      expect(find.text('1990-06-05 09:20 · 杭州市'), findsNothing);
      await _back(tester);

      await _tap(tester, 'B 方');
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsNothing);
      expect(find.text('双人盘面对照'), findsNothing);
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '添加对象');
      expect(find.widgetWithText(OutlinedButton, '选择出生年月日'), findsOneWidget);
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
      final romance = 'c' * 64;
      final requests = <String>[];
      final contexts = <String?>[];
      final destinations = <AccountDestination>[];
      final account = await _fixtureAccount((request) {
        final path = request.url.path;
        expect(request.method, 'GET');
        expect(request.url.queryParameters['expectedOwnerId'], 'guest-fixture');
        expect(request.url.queryParameters['kind'], 'synastry');
        requests.add(path);
        return switch (path) {
          '/account/reading-history' => _json({
            'entries': [
              _entry(
                latest,
                SynastryEdition.friend.archiveTitleForPair('小满', '林舟'),
              ),
              _entry(
                older,
                SynastryEdition.friend.archiveTitleForPair('若宁', '许川'),
              ),
              _entry(
                romance,
                SynastryEdition.lover.archiveTitleForPair('青禾', '小远'),
              ),
            ],
            'nextCursor': null,
          }),
          '/account/reading-history/latest' => () {
            final context = request.url.queryParameters['contextKey'];
            contexts.add(context);
            return context == null
                ? _json(_archived(latest, '最近'))
                : _json(_archived(older, '匹配'));
          }(),
          _ when path.endsWith(older) => _json(_archived(older, '早期')),
          _ => throw StateError('Unexpected path $path'),
        };
      });
      expect(account.authorizedSession?.id, 'guest-fixture');
      await tester.pumpWidget(
        MaterialApp(
          builder: _reducedMotion,
          home: AccountSectionLinks(
            open: (destination) async => destinations.add(destination),
            child: SynastryPage(
              loadPlaces: () async => [_place],
              account: account,
              calculate: (profile, _) async =>
                  _chart(profile.date.utcMidnight.toIso8601String()),
              compare: (a, b, _) async => _comparison,
              summarize: (request, isCurrent, cancel) async =>
                  throw StateError('Reading an archive must not send evidence'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _tap(tester, '查看最近报告');
      expect(find.text('从合盘存档读取'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, '亲情'), findsOneWidget);
      expect(find.text('读取本人盘面'), findsNothing);
      await _back(tester);
      await _tap(tester, '唱片盒');
      expect(find.text('合盘记录'), findsOneWidget);
      expect(find.text('小满 & 林舟'), findsOneWidget);
      await _tap(tester, '恋人');
      expect(find.text('青禾 & 小远'), findsOneWidget);
      expect(find.text('小满 & 林舟'), findsNothing);
      await _tap(tester, '朋友');
      await _nextRecord(tester);
      await _tap(tester, '若宁 & 许川');
      await tester.pumpAndSettle();
      final collaboration = find.widgetWithText(ChoiceChip, '合作');
      expect(collaboration, findsOneWidget);
      await tester.ensureVisible(collaboration);
      await tester.tap(collaboration);
      await tester.pumpAndSettle();
      expect(find.text('早期合作正文'), findsOneWidget);
      expect(find.text('最近合作正文'), findsNothing);
      expect(
        requests,
        containsAll([
          '/account/reading-history/latest',
          '/account/reading-history',
          '/account/reading-history/$older',
        ]),
      );
      await _back(tester);
      await _back(tester);
      await _tap(tester, 'A 方');
      await _tap(tester, '手动填写 A 方资料');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, '确认A 方资料');
      await _tap(tester, 'B 方');
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '添加对象');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, '开始合盘');
      await _tap(tester, '前往 AI 授权');
      expect(destinations, [accountDestination(AccountSection.aiPermissions)]);
      await _tap(tester, '查看此组合已存解读');
      expect(find.text('从合盘存档读取'), findsOneWidget);
      expect(find.text('匹配亲情正文'), findsOneWidget);
      expect(contexts, [
        null,
        '["1990-06-01T00:00:00.000Z","1992-07-02T00:00:00.000Z"]',
      ]);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('flips through saved records and retries the same older cursor', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    final cursor = 'd' * 64;
    final older = 'e' * 64;
    final cursors = <String?>[];
    var olderReads = 0;
    final account = await _fixtureAccount((request) {
      expect(request.url.queryParameters['expectedOwnerId'], 'guest-fixture');
      expect(request.url.queryParameters['kind'], 'synastry');
      final path = request.url.path;
      if (path == '/account/reading-history/latest') return _json({}, 404);
      if (path.endsWith(older)) {
        olderReads++;
        return _json(_archived(older, '第二页'));
      }
      expect(path, '/account/reading-history');
      final before = request.url.queryParameters['before'];
      cursors.add(before);
      if (before == null) {
        return _json({
          'entries': [
            _entry('a' * 64, '第一页第一篇'),
            _entry('b' * 64, '第一页第二篇'),
            _entry('c' * 64, '第一页第三篇'),
            _entry(cursor, '第一页第四篇'),
          ],
          'nextCursor': cursor,
        });
      }
      expect(before, cursor);
      if (cursors.length == 2) return _json({}, 503);
      return _json({
        'entries': [_entry(older, '第二页合盘')],
        'nextCursor': null,
      });
    });

    await tester.pumpWidget(
      MaterialApp(
        builder: _reducedMotion,
        home: SynastryPage(loadPlaces: () async => [_place], account: account),
      ),
    );
    await tester.pumpAndSettle();
    await _tap(tester, '唱片盒');
    expect(find.text('第一页第一篇'), findsOneWidget);
    expect(cursors, [null]);

    await _tap(tester, '加载更多');
    expect(find.text('暂时无法读取存档。'), findsOneWidget);
    expect(find.text('第一页第一篇'), findsOneWidget);
    await _tap(tester, '加载更多');
    expect(cursors, [null, cursor, cursor]);

    for (var index = 0; index < 4; index++) {
      await _nextRecord(tester);
    }
    await _tap(tester, '第二页合盘');
    expect(find.text('第二页亲情正文'), findsOneWidget);
    expect(olderReads, 1);
    expect(cursors, [null, cursor, cursor]);

    await _back(tester);
    expect(find.text('第二页合盘'), findsOneWidget);
    expect(cursors, [null, cursor, cursor]);
    await _tap(tester, '刷新报告');
    expect(cursors, [null, cursor, cursor, null]);
    expect(find.text('第二页合盘'), findsNothing);
    expect(find.text('第一页第一篇'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final kind in [
    'B-side consent',
    'AI authorization',
    'archived A account session',
  ]) {
    final revokeAi = kind == 'AI authorization';
    final archiveA = kind == 'archived A account session';
    test('withdrawing $kind aborts the actual model request', () async {
      final requestArrived = Completer<void>();
      final disconnected = Completer<void>();
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      Socket? connection;
      addTearDown(() async {
        connection?.destroy();
        await server.close(force: true);
      });
      server.listen((request) async {
        expect(request.method, 'POST');
        expect(request.uri.path, '/synastry/summary');
        expect(
          jsonDecode(await utf8.decoder.bind(request).join()),
          _comparison['summaryRequest'],
        );
        final socket = await request.response.detachSocket(writeHeaders: false);
        connection = socket;
        socket.listen(
          (_) {},
          onDone: () => disconnected.complete(),
          onError: (Object _) {
            if (!disconnected.isCompleted) disconnected.complete();
          },
          cancelOnError: true,
        );
        requestArrived.complete();
      });
      final account = await _fixtureAccount(
        (request) {
          expect(request.method, 'GET');
          return switch (request.url.path) {
            '/account/synastry-chart-snapshots/latest' when archiveA => _json(
              _snapshot(_ownedChart()),
            ),
            '/account/reading-history/latest' => _json(null),
            _ => fail('Unexpected archive request: $request'),
          };
        },
        share: true,
        member: archiveA,
      );
      final controller = SynastryPageController(
        account: account,
        calculate: (profile, _) async =>
            _chart(profile.date.utcMidnight.toIso8601String()),
        compare: (a, b, _) async => _comparison,
        summarize: configureSynastrySummary(
          value: Uri.http('127.0.0.1:' + server.port.toString()).toString(),
        ),
      );
      addTearDown(controller.dispose);
      await _prepareComparison(controller, archiveA: archiveA);
      final response = HttpOverrides.runWithHttpOverrides(
        controller.generateSummary,
        _LoopbackHttpOverrides(),
      );
      await requestArrived.future.timeout(const Duration(seconds: 5));
      if (revokeAi) {
        await account.choose(account.catalog!.ai, _permission, false);
      } else if (archiveA) {
        await account.signOut();
      } else {
        controller.confirmConsent(false);
      }
      await disconnected.future.timeout(const Duration(seconds: 5));
      await response;
      expect(controller.report, isNull);
      expect(controller.needsSave, isFalse);
      expect(controller.busy, isFalse);
      if (revokeAi) {
        expect(controller.result, _comparison);
        expect(controller.needsPermission, isTrue);
      } else if (archiveA) {
        expect(account.authorizedSession, isNull);
      } else {
        expect(controller.b, isNull);
        expect(controller.result, isNull);
      }
    });
  }

  test(
    'reloading archived A discards stale data and rejects invalid projections',
    () async {
      var response = _json(_snapshot(_ownedChart()));
      final account = await _fixtureAccount((request) {
        expect(request.url.path, '/account/synastry-chart-snapshots/latest');
        expect(request.url.queryParameters, {
          'expectedOwnerId': 'member-fixture',
        });
        return response;
      }, member: true);
      var comparisons = 0;
      final controller = SynastryPageController(
        account: account,
        calculate: (profile, _) async =>
            _chart(profile.date.utcMidnight.toIso8601String()),
        compare: (a, b, _) async {
          comparisons++;
          expect(a['mode'], 'account_owner');
          expect(a['chart'], _ownedChart());
          return _comparison;
        },
      );
      addTearDown(controller.dispose);

      await _prepareComparison(controller, archiveA: true);
      expect(controller.ownChartStatus, OwnSynastryChartStatus.available);
      response = _json({}, 403);
      final refresh = controller.readOwnChart();
      expect(controller.a, isNull);
      expect(controller.result, isNull);
      await refresh;
      expect(controller.ownChartStatus, OwnSynastryChartStatus.failed);
      expect(controller.canCompare, isFalse);
      expect(controller.aFromArchive, isFalse);
      expect(controller.b, isNotNull);

      response = _json(_snapshot({..._ownedChart(), 'snapshotId': 'b' * 64}));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.failed);
      expect(controller.canCompare, isFalse);

      response = _json({
        'status': 'missing_snapshot',
        'archiveId': 'a' * 64,
        'calculatedAt': '2026-10-20T09:00:00.000Z',
      });
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.missingSnapshot);
      expect(controller.a, isNull);

      response = _json(_snapshot({..._ownedChart(), 'timeKnown': false}));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.unknownTime);
      expect(controller.a, isNull);
      expect(comparisons, 1);

      response = _json(_snapshot(_ownedChart()));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.available);
      expect(controller.canCompare, isTrue);
    },
  );

  test('an unknown chart version cannot open or generate a report', () async {
    final account = await _fixtureAccount(
      (request) => throw StateError('Unexpected archive request'),
      share: true,
    );
    final controller = SynastryPageController(
      account: account,
      calculate: (profile, _) async => _chart('not-a-date'),
      compare: (a, b, _) async => _comparison,
      summarize: (_, _, _) async => throw StateError('Unexpected model call'),
    );
    addTearDown(controller.dispose);
    await _prepareComparison(controller);
    await controller.restoreComparedReport();
    expect(controller.report, isNull);
    expect(controller.message, '暂时无法确认双方盘面版本，请重新排盘。');
    await controller.generateSummary();
    expect(controller.report, isNull);
    expect(controller.message, '暂时无法确认双方盘面版本，请重新排盘。');
  });
}

const _permission = 'synastry.cloud_interpretation';

class _LoopbackHttpOverrides extends HttpOverrides {}

Future<AccountController> _fixtureAccount(
  FutureOr<http.Response> Function(http.Request) readArchives, {
  bool share = false,
  bool member = false,
}) async {
  Map<String, Object?> agreements(bool shared) => {
    'requiredAccepted': true,
    'permissions': {
      for (final purpose in aiPurposes.keys)
        purpose: shared && purpose == _permission,
    },
  };
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.https('fixture.invalid'),
      client: MockClient(
        (request) async => switch (request.url.path) {
          '/account/session' =>
            member
                ? _json({
                    'user': {'id': 'member-fixture', 'displayName': '测试会员'},
                  })
                : _json({}, 401),
          '/account/auth/logout' => http.Response('', 204),
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
          '/account/agreements' => _json(agreements(share)),
          '/account/agreements/permission' => _json(agreements(false)),
          final path
              when path.startsWith('/account/reading-history') ||
                  path == '/account/synastry-chart-snapshots/latest' =>
            readArchives(request),
          final path => throw StateError('Unexpected path $path'),
        },
      ),
    ),
  );
  final account = AccountController(api, AgreementsApi(api));
  addTearDown(account.dispose);
  await account.initialize();
  return account;
}

Future<void> _prepareComparison(
  SynastryPageController controller, {
  bool archiveA = false,
}) async {
  BirthProfile profile(int day) => BirthProfile(
    date: BirthDate(1990, 6, day),
    time: const BirthTime(hour: 9, minute: 20),
    place: _place,
    gender: BirthGender.female,
  );
  controller.confirmConsent(true);
  if (archiveA) {
    await controller.readOwnChart();
    expect(controller.aFromArchive, isTrue);
  } else {
    expect(await controller.setManual(SynastrySide.a, profile(1)), isTrue);
  }
  expect(await controller.setManual(SynastrySide.b, profile(2)), isTrue);
  await controller.compareCharts();
  expect(controller.result, _comparison);
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

Map<String, Object?> _ownedChart() => {
  ..._chart('2026-10-20T09:00:00.000Z'),
  'schemaVersion': 1,
  'snapshotId': 'a' * 64,
  'archiveId': 'a' * 64,
  'timeKnown': true,
  'ziwei': {'status': 'unavailable', 'reason': 'calculation_failed'},
};

Map<String, Object?> _snapshot(Map<String, Object?> chart) => {
  'status': 'available',
  'snapshot': chart,
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

Future<void> _fillProfile(WidgetTester tester, String date) async {
  await selectBirthDate(tester, date);
  await selectBirthTime(tester, 9, 20);
  await openBirthPicker(tester, '选择出生地点');
  final context = tester.element(find.byType(TextField).last);
  final search = find.widgetWithText(TextField, context.uiLabel('搜索城市或区县'));
  await tester.enterText(search, '杭州');
  await tester.pumpAndSettle();
  await _tap(tester, '杭州市');
  final gender = context.uiLabel('女');
  await confirmBirthPicker(tester);
  await _tap(tester, gender);
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

Future<void> _back(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await tester.pumpAndSettle();
}

Widget _reducedMotion(BuildContext context, Widget? child) => MediaQuery(
  data: MediaQuery.of(context).copyWith(disableAnimations: true),
  child: child!,
);

Future<void> _nextRecord(WidgetTester tester) async {
  final next = find.byTooltip('下一张唱片');
  await tester.ensureVisible(next);
  await tester.pumpAndSettle();
  await tester.tap(next);
  await tester.pumpAndSettle();
}
