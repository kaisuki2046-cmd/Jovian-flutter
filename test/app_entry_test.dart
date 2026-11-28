import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart'
    show debugDefaultTargetPlatformOverride;
import 'package:flutter/gestures.dart' show PointerDeviceKind;
import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

void main() {
  testWidgets('profile login opens the welcome page and can return as guest', (
    tester,
  ) async {
    final requests = <String>[];
    final account = _account((request) async {
      final route = '${request.method} ${request.url.path}';
      requests.add(route);
      return switch (route) {
        'GET /account/session' => _json({}, 401),
        'GET /account/auth/guest' => _json({
          'id': 'profile-guest',
          'expiresAt': 4102444800000,
        }),
        'GET /account/auth/capabilities' => _json({
          'emailRegistrationAvailable': true,
          'localSocialProviders': ['wechat', 'qq'],
        }),
        'GET /account/agreements/catalog' => _json(_catalog),
        'GET /account/agreements' => _agreementState(true),
        _ => _json({}, 404),
      };
    });
    await tester.pumpWidget(
      JovianApp(account: account, initialTab: JovianTab.account),
    );
    await tester.pumpAndSettle();
    expect(find.text('我的报告'), findsOneWidget);
    await _press(tester, '登录');
    expect(find.text('在这里，慢慢认识自己'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('登录或注册成功后会结束当前游客会话并删除游客档案。'), findsOneWidget);
    await _press(tester, '其他登录方式');
    expect(find.widgetWithText(ListTile, '微信登录'), findsOneWidget);
    expect(find.widgetWithText(ListTile, 'QQ 登录'), findsOneWidget);
    await _press(tester, '邮箱登录');
    await _press(tester, '同意并继续');
    expect(find.widgetWithText(TextField, '邮箱'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('其他登录方式'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('我的报告'), findsOneWidget);
    expect(account.authorizedSession?.scope, 'guest:profile-guest');

    await _press(tester, '登录');
    await _press(tester, '返回游客资料');
    expect(find.text('我的报告'), findsOneWidget);
    expect(account.authorizedSession?.scope, 'guest:profile-guest');
    expect(requests.where((route) => route.startsWith('POST')), isEmpty);
  });

  testWidgets(
    'direct account security requires current consent and preserves the nested back stack',
    (tester) async {
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/account/phone';
      addTearDown(platform.clearDefaultRouteNameTestValue);
      final account = _account(
        (request) async => switch ('${request.method} ${request.url.path}') {
          'GET /account/session' => _json({
            'user': {
              'id': 'member-fixture',
              'displayName': '测试会员',
              'phone': '13800000000',
            },
          }),
          'GET /account/auth/capabilities' => _json({}),
          'GET /account/agreements/catalog' => _json(_catalog),
          'GET /account/agreements' => _agreementState(false),
          'POST /account/agreements/confirmation' => _agreementState(true),
          _ => _json({}, 404),
        },
      );
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '手机号'), findsNothing);
      await _press(tester, '阅读并确认协议');
      await _press(tester, '同意并继续');
      expect(find.widgetWithText(AppBar, '手机号'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '账户与安全'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '设置'), findsOneWidget);
      await tester.binding.handlePushRoute('/account/appearance');
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '外观模式'), findsOneWidget);
      await tester.binding.handlePushRoute('/account');
      await tester.pumpAndSettle();
      expect(find.text('测试会员'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'cold start waits for restore and opens tabs after guest consent',
    (tester) async {
      final restoring = Completer<http.Response>();
      final requests = <String>[];
      final account = _account((request) async {
        final route = '${request.method} ${request.url.path}';
        requests.add(route);
        return switch (route) {
          'GET /account/session' => restoring.future,
          'GET /account/auth/guest' => _json({}, 401),
          'GET /account/auth/capabilities' => _json({}),
          'GET /account/agreements/catalog' => _json(_catalog),
          'POST /account/auth/guest' => _json({
            'id': 'guest-fixture',
            'expiresAt': DateTime.now()
                .add(const Duration(days: 7))
                .millisecondsSinceEpoch,
          }, 201),
          'GET /account/agreements' => _agreementState(true),
          _ => _json({}, 404),
        };
      });
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pump();
      expect(find.bySemanticsLabel('正在检查登录状态…'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      restoring.complete(_json({}, 401));
      await tester.pumpAndSettle();

      expect(find.text('在这里，慢慢认识自己'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await _press(tester, '游客体验');
      expect(requests, isNot(contains('POST /account/auth/guest')));
      await _press(tester, '同意并继续');
      expect(
        requests.where((route) => route == 'POST /account/auth/guest'),
        hasLength(1),
      );
      expect(account.authorizedSession?.scope, 'guest:guest-fixture');
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('在这里，慢慢认识自己'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('the report fits a narrow phone and keeps its zodiac motion', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    tester.view.padding = const FakeViewPadding(top: 24, bottom: 16);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetPadding);
    final platform = tester.binding.platformDispatcher;
    platform.defaultRouteNameTestValue = '/account/reports';
    addTearDown(platform.clearDefaultRouteNameTestValue);
    addTearDown(platform.clearAccessibilityFeaturesTestValue);
    final account = _account(
      (request) async => switch (request.url.path) {
        '/account/session' => _json({
          'user': {'id': 'report-reader', 'displayName': '报告测试'},
        }),
        '/account/auth/capabilities' => _json({}),
        '/account/agreements/catalog' => _json(_catalog),
        '/account/agreements' => _agreementState(true),
        _ => _json({}, 404),
      },
    );
    await tester.pumpWidget(JovianApp(account: account));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    final sheet = find.byKey(const ValueKey('personal-report-sheet'));
    final bounds = tester.getRect(sheet);
    expect(bounds, const Rect.fromLTRB(10, 24, 310, 624));
    expect(find.byType(NavigationBar), findsNothing);
    expect(tester.hasRunningAnimations, isTrue);

    await tester.tap(find.text('星座'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    final previous = find.byTooltip('上一张星座卡');
    expect(previous.hitTestable(), findsOneWidget);
    expect(tester.getRect(sheet), bounds);
    await tester.tap(previous);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2200));
    expect(find.text('天顶金牛'), findsOneWidget);
    expect(tester.hasRunningAnimations, isTrue);

    platform.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
      disableAnimations: true,
    );
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
    await tester.drag(
      find.byKey(const ValueKey('personal-report-zodiac-deck')),
      const Offset(-148, 0),
    );
    await tester.pumpAndSettle();
    expect(find.text('太阳白羊'), findsOneWidget);
    final next = find.byTooltip('下一张星座卡');
    final sampleCards = [
      ('核心性格与自我认同', '从第一步找到自己'),
      ('外在气质与第一印象', '用热情打开场面'),
      ('情绪需求与安全感', '把心安放进日常'),
      ('喜好与表达爱的方式', '温柔地读懂对方'),
      ('动力与行动方式', '好奇心带动行动'),
      ('思考与沟通方式', '先感到整体，再说清细节'),
      ('未来发展方向', '先为自己作决定'),
      ('承诺与长期伴侣关系', '共同养出归属感'),
      ('事业方向与公众形象', '把成果做得经久耐用'),
    ];
    for (final (index, (meaning, focus)) in sampleCards.indexed) {
      if (index > 0) await tester.tap(next);
      await tester.pumpAndSettle();
      expect(find.text('（$meaning）').hitTestable(), findsOneWidget);
      expect(find.text(focus).hitTestable(), findsOneWidget);
    }
    expect(find.text('天顶金牛'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('星座'), findsOneWidget);
    await tester.tap(find.byTooltip('关闭报告'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'report pages follow drags below the pinned topics and accept taps',
    (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.windows;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 680);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/account/reports';
      platform.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
        disableAnimations: true,
      );
      addTearDown(platform.clearDefaultRouteNameTestValue);
      addTearDown(platform.clearAccessibilityFeaturesTestValue);
      final account = _account(
        (request) async => switch (request.url.path) {
          '/account/session' => _json({
            'user': {'id': 'topic-reader', 'displayName': '报告测试'},
          }),
          '/account/auth/capabilities' => _json({}),
          '/account/agreements/catalog' => _json(_catalog),
          '/account/agreements' => _agreementState(true),
          _ => _json({}, 404),
        },
      );
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pumpAndSettle();
      final sheet = find.byKey(const ValueKey('personal-report-sheet'));
      final strip = find.byKey(const ValueKey('personal-report-topic-strip'));
      final thumb = find.byKey(const ValueKey('personal-report-topic-thumb'));
      final pages = find.byKey(const ValueKey('personal-report-topic-content'));
      Finder topicLabel(String name) =>
          find.descendant(of: strip, matching: find.text(name));
      Offset topicCenter(String name) => tester.getCenter(topicLabel(name));

      final initialTop = tester.getTopLeft(strip).dy;
      await tester.dragFrom(const Offset(160, 580), const Offset(0, -880));
      await tester.pumpAndSettle();

      final pinnedTop = tester.getTopLeft(strip).dy;
      expect(pinnedTop, lessThan(initialTop));
      expect(pinnedTop, lessThan(tester.getTopLeft(sheet).dy + 68));
      final overviewTitle = find.text('我的命盘综述');
      final overviewLeft = tester.getTopLeft(overviewTitle).dx;
      final bodyDrag = await tester.startGesture(const Offset(250, 225));
      await bodyDrag.moveBy(const Offset(-110, 0));
      await tester.pump();
      expect(
        tester.getTopLeft(overviewTitle).dx,
        closeTo(overviewLeft - 110, 1),
      );
      expect(find.text('我的恋爱画像'), findsOneWidget);
      expect(tester.getTopLeft(strip).dy, pinnedTop);
      await bodyDrag.up();
      await tester.pumpAndSettle();
      expect(find.text('我的恋爱画像').hitTestable(), findsOneWidget);
      expect(tester.getTopLeft(strip).dy, pinnedTop);
      expect(
        find.descendant(of: sheet, matching: find.byType(Scrollbar)),
        findsNothing,
      );
      expect(
        find.descendant(of: sheet, matching: find.byType(RawScrollbar)),
        findsNothing,
      );
      final radar = find.byKey(
        const ValueKey('personal-report-relationship-radar'),
      );
      expect(radar.hitTestable(), findsOneWidget);
      final dimensions = tester
          .widget<Semantics>(radar)
          .properties
          .label!
          .split(' · ');
      expect(dimensions, hasLength(10));
      expect(dimensions.first, startsWith('冷处理 '));
      expect(dimensions.last, startsWith('专一 '));
      await _press(tester, '十维关系雷达');
      expect(find.text('图上分数用同一个刻度呈现这份命盘中的相对倾向。'), findsOneWidget);
      expect(find.text('通过语气、行动和回应，让对方感到自己被在乎。'), findsOneWidget);
      await _press(tester, '返回上一级报告');
      await _press(tester, '缘分与长期关系');
      expect(find.text('正缘出现的时机'), findsOneWidget);
      expect(find.text('婚姻次数与关系走向'), findsOneWidget);
      expect(find.text('单身与陪伴'), findsOneWidget);
      await _press(tester, '返回上一级报告');

      final loveTitle = find.text('我的恋爱画像');
      final loveLeft = tester.getTopLeft(loveTitle).dx;
      final drag = await tester.startGesture(
        topicCenter('情感'),
        kind: PointerDeviceKind.mouse,
      );
      final midway = Offset.lerp(topicCenter('情感'), topicCenter('财富'), .25)!;
      await drag.moveTo(midway);
      await tester.pump();
      expect(tester.getCenter(thumb).dx, closeTo(midway.dx, 1));
      expect(
        tester.getTopLeft(loveTitle).dx,
        closeTo(loveLeft - tester.getSize(pages).width / 2, 1),
      );
      expect(find.text('我的事业画像'), findsOneWidget);
      expect(tester.getTopLeft(strip).dy, pinnedTop);
      final release = Offset.lerp(topicCenter('财富'), topicCenter('学业'), .2)!;
      await drag.moveTo(release);
      await tester.pump();
      final wealthTitle = find.text('我的财富画像');
      final previewTop = tester.getTopLeft(wealthTitle).dy;
      await drag.up();
      await tester.pumpAndSettle();
      expect(tester.getCenter(thumb).dx, closeTo(topicCenter('财富').dx, 1));
      expect(tester.getTopLeft(wealthTitle).dy, closeTo(previewTop, 1));

      final funnel = find.text('漏斗');
      expect(funnel.hitTestable(), findsOneWidget);
      expect(find.text('容易漏财的地方'), findsNothing);
      for (final label in ['可用资源', '漏财环节', '人情与共同开支']) {
        expect(
          tester.getCenter(find.text(label)).dx,
          closeTo(tester.getCenter(sheet).dx, 1),
        );
      }
      await tester.ensureVisible(funnel);
      await tester.pumpAndSettle();
      final funnelTop = tester.getTopLeft(funnel).dy;
      await _press(tester, '漏斗');
      expect(find.text('如何看漏斗'), findsOneWidget);
      expect(find.text('容易漏财的地方'), findsOneWidget);
      await _press(tester, '返回上一级报告');
      expect(tester.getTopLeft(strip).dy, pinnedTop);
      expect(tester.getTopLeft(funnel).dy, funnelTop);
      await _press(tester, '收入模式与资源来源');
      expect(find.text('工资与稳定收入'), findsOneWidget);
      expect(find.text('家庭资产与共同资源'), findsOneWidget);
      await _press(tester, '返回上一级报告');

      await tester.tap(topicLabel('事业'));
      await tester.pumpAndSettle();
      await _press(tester, '事业阶段趋势');
      expect(find.text('变化明显的阶段'), findsOneWidget);
      expect(find.text('示例流年'), findsOneWidget);
      final year = find.widgetWithText(ChoiceChip, '2024');
      await tester.ensureVisible(year);
      await tester.pump();
      await tester.tap(year);
      await tester.pumpAndSettle();
      expect(find.text('2024 · 甲辰'), findsOneWidget);
      await _press(tester, '返回上一级报告');

      await tester.tap(topicLabel('学业'), kind: PointerDeviceKind.mouse);
      await tester.pumpAndSettle();
      expect(find.text('适合尝试的学习方向'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.home);
      await tester.pumpAndSettle();
      expect(find.text('我的命盘综述'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.end);
      await tester.pumpAndSettle();
      await _press(tester, '学习方式与卡点');
      expect(find.text('学习态度与动力'), findsOneWidget);
      expect(find.text('求学节奏与持续性'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'report uses the latest chart for ten gods and the number of shen sha',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/account/reports';
      platform.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
        disableAnimations: true,
      );
      addTearDown(platform.clearDefaultRouteNameTestValue);
      addTearDown(platform.clearAccessibilityFeaturesTestValue);
      final account = _account((request) async {
        return switch (request.url.path) {
          '/account/session' => _json({
            'user': {'id': 'real-chart-owner', 'displayName': '命盘测试'},
          }),
          '/account/auth/capabilities' => _json({}),
          '/account/agreements/catalog' => _json(_catalog),
          '/account/agreements' => _agreementState(true),
          '/account/destiny-history/latest' => _json({
            'id': 'c' * 64,
            'title': '命理解读',
            'calculatedAt': '2026-11-27T00:00:00Z',
            'savedAt': 1795737600000,
            'report': {
              'version': 1,
              'overview': '已存档的解读。',
              'chartSnapshot': {
                'version': 1,
                'timeKnown': true,
                'western': {
                  'rawResult': [
                    {
                      'positions': [
                        {'planet': 'Sun', 'longitude': 200},
                      ],
                    },
                  ],
                },
                'bazi': {
                  'rawResult': [
                    {
                      'day': '甲子',
                      'analysis': {
                        'L2': {
                          'assessments': {
                            'tenGodStrength': {
                              'scores': [
                                {'name': '正印', 'score': 55},
                                {'name': '正财', 'score': 25},
                                {'name': '比肩', 'score': 20},
                              ],
                            },
                          },
                        },
                      },
                      'shenSha': {
                        'year': [
                          {'name': '桃花'},
                          {'name': '华盖'},
                          {'name': '空亡'},
                          {'name': '禄神'},
                        ],
                        'day': [
                          {'name': '桃花'},
                        ],
                      },
                    },
                  ],
                },
              },
            },
          }),
          _ => _json({}, 404),
        };
      });
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pumpAndSettle();
      expect(find.text('基于最近一次保存的命盘'), findsOneWidget);
      expect(find.text('太阳 天秤  ·  日主 甲木'), findsOneWidget);
      await _press(tester, '十神');
      expect(find.text('55%'), findsOneWidget);
      expect(find.text('40%'), findsNothing);
      await _press(tester, '返回上一级报告');
      await _press(tester, '神煞');
      expect(find.text('1 / 4'), findsOneWidget);
      expect(find.text('年柱').hitTestable(), findsOneWidget);
      expect(find.text('日柱').hitTestable(), findsOneWidget);
      final sheet = tester.getSize(
        find.byKey(const ValueKey('personal-report-sheet')),
      );
      final pages = find.byKey(const ValueKey('personal-report-shensha-pages'));
      final pagesSize = tester.getSize(pages);
      expect(pagesSize.width, greaterThan(sheet.width * .9));
      expect(pagesSize.height, greaterThan(sheet.height * .72));
      final deck = tester.getRect(pages);
      Rect cardBounds(String name) => tester.getRect(
        find.byKey(ValueKey('personal-report-shensha-card-$name')),
      );
      expect(cardBounds('禄神').right, greaterThan(deck.left));
      expect(cardBounds('华盖').left, lessThan(deck.right));
      await tester.drag(pages, const Offset(221, 0));
      await tester.pumpAndSettle();
      expect(find.text('4 / 4'), findsOneWidget);
      expect(find.text('禄神').hitTestable(), findsOneWidget);
      expect(cardBounds('空亡').right, greaterThan(deck.left));
      expect(cardBounds('桃花').left, lessThan(deck.right));
      await tester.drag(pages, const Offset(-221, 0));
      await tester.pumpAndSettle();
      expect(find.text('1 / 4'), findsOneWidget);
      for (var step = 1; step <= 12; step++) {
        await tester.tap(find.byTooltip('上一张神煞'));
        await tester.pumpAndSettle();
        expect(find.text('${1 + (-step % 4)} / 4'), findsOneWidget);
      }
      await tester.drag(pages, const Offset(-221, 0));
      await tester.pumpAndSettle();
      expect(find.text('2 / 4'), findsOneWidget);
      expect(find.text('华盖'), findsOneWidget);
      final front = cardBounds('华盖');
      final left = cardBounds('桃花');
      final right = cardBounds('空亡');
      expect(front.width, inExclusiveRange(deck.width * .82, deck.width * .94));
      expect(left.right, greaterThan(deck.left));
      expect(right.left, lessThan(deck.right));
      expect(left.height, lessThan(front.height));
      expect(right.height, lessThan(front.height));
      await tester.tap(find.byTooltip('下一张神煞'));
      await tester.pumpAndSettle();
      expect(find.text('3 / 4'), findsOneWidget);
      await _press(tester, '返回上一级报告');
      await _press(tester, '星座');
      expect(find.text('太阳天秤'), findsOneWidget);
      expect(find.text('在双方之间找到尺度'), findsOneWidget);
      await tester.tap(find.byTooltip('下一张星座卡'));
      await tester.pumpAndSettle();
      expect(find.text('这份命盘还缺少这个位置的星座资料。'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final resume in [false, true]) {
    testWidgets(
      resume
          ? 'guest archives close at expiry when the app resumes'
          : 'guest archives close at expiry while browsing',
      (tester) async {
        var now = DateTime.utc(2026, 11, 27);
        final expires = now.add(const Duration(minutes: 2));
        final archive = 'a' * 64;
        final record = {
          'id': archive,
          'title': '原游客的报告',
          'calculatedAt': '2026-11-25T12:00:00.000Z',
          'savedAt': now.millisecondsSinceEpoch,
        };
        var entries = 0;
        var signIns = 0;
        final account = _account((request) async {
          final owner = request.url.queryParameters['expectedOwnerId'];
          switch (request.method + ' ' + request.url.path) {
            case 'GET /account/session':
              return _json({}, 401);
            case 'GET /account/auth/guest':
              return _json({
                'id': 'original-guest',
                'expiresAt': expires.millisecondsSinceEpoch,
              });
            case 'GET /account/auth/capabilities':
              return _json({});
            case 'GET /account/agreements/catalog':
              return _json(_catalog);
            case 'GET /account/agreements':
              return _agreementState(true);
            case 'GET /account/destiny-history/latest':
              return _json({}, 404);
            case 'GET /account/destiny-history':
              return _json({
                'entries': owner == 'original-guest' ? [record] : [],
              });
            case final route
                when route == 'GET /account/destiny-history/$archive':
              entries++;
              expect(owner, 'original-guest');
              return _json({
                ...record,
                'report': {'version': 1, 'overview': '旧游客专属的解读。'},
              });
            case 'POST /account/auth/guest':
              signIns++;
              return _json({
                'id': 'next-guest',
                'expiresAt': now
                    .add(const Duration(days: 7))
                    .millisecondsSinceEpoch,
              }, 201);
            default:
              fail('Unexpected request ' + request.url.path);
          }
        }, now: () => now);
        final platform = tester.binding.platformDispatcher;
        platform.defaultRouteNameTestValue = '/account/reports';
        addTearDown(platform.clearDefaultRouteNameTestValue);
        platform.accessibilityFeaturesTestValue =
            const FakeAccessibilityFeatures(disableAnimations: true);
        addTearDown(platform.clearAccessibilityFeaturesTestValue);
        await tester.pumpWidget(JovianApp(account: account));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('已保存的报告'));
        await tester.pumpAndSettle();
        await _press(tester, '原游客的报告');
        expect(find.text('旧游客专属的解读。'), findsOneWidget);

        if (resume) {
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.paused,
          );
        }
        now = expires;
        if (resume) {
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.resumed,
          );
        }
        await tester.pump(resume ? Duration.zero : const Duration(minutes: 2));
        await tester.pumpAndSettle();
        expect(account.session, isNull);
        expect(account.agreementState, isNull);
        expect(find.text('旧游客专属的解读。'), findsNothing);
        expect(find.text('游客会话已到期，请重新进入游客体验或登录。'), findsOneWidget);

        await _press(tester, '游客体验');
        await _press(tester, '同意并继续');
        expect(account.authorizedSession?.scope, 'guest:next-guest');
        expect(find.text('旧游客专属的解读。'), findsNothing);
        expect(entries, 1);
        expect(signIns, 1);
      },
    );
  }

  testWidgets(
    'a late guest agreement response leaves the expired session closed',
    (tester) async {
      var now = DateTime.utc(2026, 11, 27);
      final expires = now.add(const Duration(seconds: 2));
      final pending = Completer<http.Response>();
      var agreementReads = 0;
      final account = _account((request) async {
        switch (request.url.path) {
          case '/account/session':
            return _json({}, 401);
          case '/account/auth/guest':
            return _json({
              'id': 'short-guest',
              'expiresAt': expires.millisecondsSinceEpoch,
            });
          case '/account/auth/capabilities':
            return _json({});
          case '/account/agreements/catalog':
            return _json(_catalog);
          case '/account/agreements':
            agreementReads++;
            return pending.future;
          default:
            fail('Unexpected request ' + request.url.path);
        }
      }, now: () => now);
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pump();
      expect(agreementReads, 1);
      expect(account.session?.scope, 'guest:short-guest');
      now = expires;
      await tester.pump(const Duration(seconds: 2));
      pending.complete(_agreementState(true));
      await tester.pumpAndSettle();
      expect(account.session, isNull);
      expect(account.agreementState, isNull);
      expect(account.authorizedSession, isNull);
      expect(find.byType(NavigationBar), findsNothing);
    },
  );

  testWidgets('welcome chooses a sign-in route and keeps consent on return', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final attempts = <Map<String, Object?>>[];
    final account = _account((request) async {
      switch (request.method + ' ' + request.url.path) {
        case 'GET /account/session':
        case 'GET /account/auth/guest':
          return _json({}, 401);
        case 'GET /account/auth/capabilities':
          return _json({
            'emailRegistrationAvailable': true,
            'phoneCodesAvailable': true,
            'localSocialProviders': ['qq'],
          });
        case 'GET /account/agreements/catalog':
          return _json(_catalog);
        case 'POST /account/auth/login':
          attempts.add(jsonDecode(request.body) as Map<String, Object?>);
          return _json({
            'user': {'id': 'welcome-member', 'displayName': '邮箱会员'},
          });
        case 'GET /account/agreements':
          return _agreementState(true);
        default:
          return _json({}, 404);
      }
    });
    await tester.pumpWidget(JovianApp(account: account));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);
    final wechat = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, '微信登录'),
    );
    expect(wechat.onPressed, isNull);

    await _press(tester, '手机号登录');
    expect(find.byType(TextField), findsNothing);
    await _press(tester, '取消');
    expect(find.text('其他登录方式'), findsOneWidget);
    expect(attempts, isEmpty);
    await _press(tester, '手机号登录');
    await _press(tester, '同意并继续');
    expect(find.widgetWithText(TextField, '手机号'), findsOneWidget);
    expect(find.widgetWithText(TextField, '验证码'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, '手机号'),
      '13800000000',
    );
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('其他登录方式'), findsOneWidget);

    await _press(tester, '注册');
    final registration = find.widgetWithText(TextField, '手机号或邮箱');
    expect(tester.widget<TextField>(registration).controller?.text, isEmpty);
    expect(find.widgetWithText(TextField, '昵称'), findsOneWidget);
    await _press(tester, '返回');

    await _press(tester, '其他登录方式');
    expect(find.text('选择登录方式'), findsOneWidget);
    final qq = tester.widget<ListTile>(find.widgetWithText(ListTile, 'QQ 登录'));
    expect(qq.onTap, isNotNull);
    await _press(tester, '邮箱登录');
    expect(find.text('同意并继续'), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextField, '邮箱'),
      'User@example.test',
    );
    await tester.enterText(
      find.widgetWithText(TextField, '密码'),
      'FixturePassword',
    );
    await _press(tester, '登录');

    expect(attempts, [
      {
        'email': 'user@example.test',
        'password': 'FixturePassword',
        'acceptance': {
          'agreed': true,
          'agreements': [
            for (final id in ['privacy', 'terms'])
              {'id': id, 'version': 'preview-v2', 'hash': 'digest-' + id},
          ],
        },
      },
    ]);
    expect(account.authorizedSession?.scope, 'member:welcome-member');
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a direct fortune link waits for the current agreement version', (
    tester,
  ) async {
    tester.binding.platformDispatcher.defaultRouteNameTestValue =
        '/modules/fortune';
    addTearDown(
      tester.binding.platformDispatcher.clearDefaultRouteNameTestValue,
    );
    final submitted = <Object?>[];
    final account = _account((request) async {
      switch ('${request.method} ${request.url.path}') {
        case 'GET /account/session':
          return _json({
            'user': {'id': 'member-fixture', 'displayName': '测试会员'},
          });
        case 'GET /account/auth/capabilities':
          return _json({});
        case 'GET /account/agreements/catalog':
          return _json(_catalog);
        case 'GET /account/agreements':
          return _agreementState(false);
        case 'POST /account/agreements/confirmation':
          submitted.add(jsonDecode(request.body));
          return _agreementState(true);
        default:
          return _json({}, 404);
      }
    });
    await tester.pumpWidget(JovianApp(account: account));
    await tester.pumpAndSettle();
    expect(find.text('周期运势'), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);
    await _press(tester, '阅读并确认协议');
    expect(submitted, isEmpty);
    await tester.tap(find.text('同意并继续'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(submitted, [
      {
        'agreements': [
          for (final id in ['privacy', 'terms'])
            {'id': id, 'version': 'preview-v2', 'hash': 'digest-$id'},
        ],
        'source': 'sign-in',
      },
    ]);
    expect(find.widgetWithText(AppBar, '周期运势'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

AccountController _account(
  Future<http.Response> Function(http.Request) respond, {
  DateTime Function() now = DateTime.now,
}) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.https('account.example.test'),
      client: MockClient(respond),
    ),
  );
  return AccountController(api, AgreementsApi(api), now: now);
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);

http.Response _agreementState(bool accepted) => _json({
  'requiredAccepted': accepted,
  'permissions': {for (final key in aiPurposes.keys) key: false},
});

Future<void> _press(WidgetTester tester, String label) async {
  final target = find.text(label);
  await tester.ensureVisible(target);
  await tester.pump();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

final _catalog = {
  'documents': [
    for (final id in ['terms', 'privacy', 'ai'])
      {
        'id': id,
        'title': id,
        'state': 'preview',
        'version': 'preview-v2',
        'hash': 'digest-$id',
        'sections': [],
      },
  ],
};
