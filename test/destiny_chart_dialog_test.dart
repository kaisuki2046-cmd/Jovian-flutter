import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/destiny/control/destiny_chart_presentation.dart';
import '../src/features/destiny/model/destiny_reading.dart';
import '../src/features/destiny/view/birth_profile_confirmation.dart';
import '../src/features/destiny/view/destiny_chart_dialog.dart';
import '../src/ui/interface_language.dart';

void main() {
  testWidgets(
    'opens older pillars with details on a narrow large-text layout',
    (tester) async {
      _narrow(tester);
      await _showCharts(
        tester,
        DestinyCharts.fromArchive(_archive(timeKnown: false)),
        textScale: 1.6,
      );
      expect(find.text('已保存的基础盘面'), findsOneWidget);
      expect(find.text('出生时刻未完全确定'), findsOneWidget);
      final year = find.byKey(const ValueKey(('destiny-pillar', '年柱')));
      final month = find.byKey(const ValueKey(('destiny-pillar', '月柱')));
      final day = find.byKey(const ValueKey(('destiny-pillar', '日柱')));
      expect(tester.getTopLeft(year).dy, tester.getTopLeft(month).dy);
      expect(
        tester.getTopLeft(day).dy,
        greaterThan(tester.getTopLeft(year).dy),
      );
      expect(find.text('天干十神 比肩'), findsWidgets);
      expect(find.text('藏干十神 原样保存的条目'), findsOneWidget);
      await tester.tap(find.text('紫微斗数'));
      await tester.pumpAndSettle();
      expect(find.text('未确定时刻的归档说明'), findsOneWidget);
      expect(find.text('紫微 · 十二宫'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'reads live palace details and switches to the exact western wheel',
    (tester) async {
      _narrow(tester);
      await _showCharts(
        tester,
        DestinyCharts.fromArchive(
          _archive(timeKnown: true),
          presentation: _live,
        ),
        textScale: 1.3,
      );
      expect(find.text('本次排盘'), findsOneWidget);
      expect(find.text('八字本命结构'), findsOneWidget);
      await tester.tap(find.text('紫微斗数'));
      await tester.pumpAndSettle();
      expect(find.text('命宫 · 甲子'), findsOneWidget);
      final palace = find.text('父母');
      await tester.ensureVisible(palace);
      await tester.pumpAndSettle();
      await tester.tap(palace);
      await tester.pumpAndSettle();
      final selected = find.text('父母 · 乙丑');
      expect(selected, findsOneWidget);
      expect(tester.getCenter(selected).dy, lessThan(650));
      expect(find.text('文曲化科'), findsOneWidget);
      expect(find.text('天福'), findsOneWidget);
      await tester.tap(find.text('西方星盘'));
      await tester.pumpAndSettle();
      expect(find.text('本命星图'), findsOneWidget);
      expect(find.text('金牛座 1.0°'), findsOneWidget);
      expect(find.text('天体位置'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭命盘'));
      await tester.pumpAndSettle();
      expect(find.text('命盘结果'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('reopens stored charts and masks them when the account changes', (
    tester,
  ) async {
    _narrow(tester);
    final authorized = ValueNotifier(true);
    addTearDown(authorized.dispose);
    final storedFacts = <String, Object?>{'version': 1, 'timeKnown': true};
    var restored = 0;
    var cancelled = false;
    await _showCharts(
      tester,
      DestinyCharts.fromArchive({
        ..._archive(timeKnown: true),
        'chartSnapshot': storedFacts,
      }),
      textScale: 1.3,
      access: (listenable: authorized, isCurrent: () => authorized.value),
      restore: (snapshot, cancel) async {
        restored++;
        expect(snapshot, same(storedFacts));
        unawaited(cancel.then((_) => cancelled = true));
        return _live;
      },
    );
    expect(restored, 1);
    expect(find.text('已保存的盘面'), findsOneWidget);
    expect(find.text('藏干十神 原样保存的条目'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('八字本命结构'),
      220,
      scrollable: find.descendant(
        of: find.byType(Dialog),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.text('八字本命结构'), findsOneWidget);
    await tester.tap(find.text('紫微斗数'));
    await tester.pumpAndSettle();
    expect(find.text('命宫 · 甲子'), findsOneWidget);
    final palace = find.text('父母');
    await tester.ensureVisible(palace);
    await tester.tap(palace);
    await tester.pumpAndSettle();
    expect(find.text('父母 · 乙丑'), findsOneWidget);
    await tester.tap(find.text('西方星盘'));
    await tester.pumpAndSettle();
    expect(find.text('本命星图'), findsOneWidget);
    expect(restored, 1);

    authorized.value = false;
    await tester.pumpAndSettle();
    expect(cancelled, isTrue);
    expect(find.text('本命星图'), findsNothing);
    expect(find.text('会话已变化，请返回后重新读取。'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'retains saved rows when the archived projection is unavailable',
    (tester) async {
      _narrow(tester);
      final charts = DestinyCharts.fromArchive({
        ..._archive(timeKnown: true),
        'chartSnapshot': {'version': 1, 'timeKnown': true},
      });
      await _showCharts(
        tester,
        charts,
        textScale: 1,
        restore: (_, _) async => throw const FormatException('fixture'),
      );
      expect(find.text('已保存的基础盘面'), findsOneWidget);
      await tester.tap(find.text('西方星盘'));
      await tester.pumpAndSettle();
      expect(find.text('金牛座'), findsOneWidget);
      expect(find.text('本命星图'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('English chart controls preserve the original chart data', (
    tester,
  ) async {
    _narrow(tester);
    await _showCharts(
      tester,
      DestinyCharts.fromArchive(_archive(timeKnown: true), presentation: _live),
      textScale: 1.6,
      english: true,
    );
    expect(find.text('Chart results'), findsOneWidget);
    expect(find.text('Current chart'), findsOneWidget);
    expect(find.text('Year pillar'), findsWidgets);
    expect(find.text('藏干十神 原样保存的条目'), findsOneWidget);
    await tester.tap(find.text('Zi Wei Dou Shu'));
    await tester.pumpAndSettle();
    expect(find.text('Zi Wei · Twelve palaces'), findsOneWidget);
    final scrollable = find.descendant(
      of: find.byType(Dialog),
      matching: find.byType(Scrollable),
    );
    final palace = find.text('Parents');
    await tester.scrollUntilVisible(palace, 180, scrollable: scrollable);
    await tester.pumpAndSettle();
    await tester.tap(palace);
    await tester.pumpAndSettle();
    expect(find.text('Parents · 乙丑'), findsOneWidget);
    expect(find.text('文曲化科'), findsOneWidget);
    await tester.tap(find.text('Western chart'));
    await tester.pumpAndSettle();
    expect(find.text('Natal chart'), findsOneWidget);
    final positions = find.text('Planetary placements');
    await tester.scrollUntilVisible(positions, 150, scrollable: scrollable);
    expect(find.text('金牛座 1.0°'), findsOneWidget);
    expect(positions, findsOneWidget);
    await tester.tap(find.byTooltip('Close chart'));
    await tester.pumpAndSettle();
    expect(find.text('Chart results'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('English confirmation translates the conflict and partial time', (
    tester,
  ) async {
    var confirmed = false;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        home: Scaffold(
          body: BirthProfileConfirmation(
            entered: const AccountBirthFields(
              birthDate: '1990-06-12',
              birthTime: '08:??',
              birthPlace: '杭州市 西湖区',
              gender: 'female',
            ),
            latest: const AccountBirthFields(
              birthDate: '1990-06-13',
              birthTime: '??:25',
              birthPlace: '',
              gender: '',
            ),
            member: true,
            saving: false,
            message: '暂时无法同步出生资料，请重试。',
            confirm: () => confirmed = true,
          ),
        ),
      ),
    );
    expect(find.text('Account birth details have changed'), findsOneWidget);
    expect(find.text('Date of birth · 1990-06-12'), findsOneWidget);
    expect(find.text('Time of birth · 8 h · Minute unknown'), findsOneWidget);
    expect(find.text('Time of birth · Hour unknown · 25 min'), findsOneWidget);
    expect(find.text('Birth location · 杭州市 西湖区'), findsOneWidget);
    expect(find.text('Birth location · Not set'), findsOneWidget);
    expect(find.text('Gender · Female'), findsOneWidget);
    expect(
      find.text('Could not sync birth details. Try again.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Sync these details and calculate'));
    expect(confirmed, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'confirmation names fields and distinguishes partial birth time',
    (tester) async {
      var confirmed = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BirthProfileConfirmation(
              entered: const AccountBirthFields(
                birthDate: '1990-06-12',
                birthTime: '08:??',
                birthPlace: '杭州市',
                gender: 'female',
              ),
              latest: const AccountBirthFields(
                birthDate: '1990-06-13',
                birthTime: '??:25',
                birthPlace: '',
                gender: '',
              ),
              member: true,
              saving: false,
              confirm: () => confirmed = true,
            ),
          ),
        ),
      );
      expect(find.text('出生日期 · 1990-06-12'), findsOneWidget);
      expect(find.text('出生时间 · 8 时 · 分钟未知'), findsOneWidget);
      expect(find.text('出生时间 · 小时未知 · 25 分'), findsOneWidget);
      expect(find.text('出生地点 · 未填写'), findsOneWidget);
      expect(find.text('性别 · 女'), findsOneWidget);
      await tester.tap(find.text('同步本次填写并测算'));
      expect(confirmed, isTrue);
      expect(tester.takeException(), isNull);
    },
  );
}

void _narrow(WidgetTester tester) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 650);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
}

Future<void> _showCharts(
  WidgetTester tester,
  DestinyCharts charts, {
  required double textScale,
  bool english = false,
  RestoreDestinyPresentation restore = restoreDestinyPresentation,
  ({Listenable listenable, bool Function() isCurrent})? access,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: english ? const Locale('en') : null,
      localizationsDelegates: english ? const [interfaceStringsDelegate] : null,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(textScale),
          disableAnimations: true,
        ),
        child: child!,
      ),
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showDestinyCharts(
              context,
              charts,
              restore: restore,
              access: access,
            ),
            child: const Text('查看命盘'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('查看命盘'));
  await tester.pumpAndSettle();
}

Map<String, Object?> _archive({required bool timeKnown}) => {
  'timeKnown': timeKnown,
  'charts': [
    {
      'method': 'bazi',
      'rows': [
        {'label': '年柱', 'value': '甲子'},
        {'label': '月柱', 'value': '乙丑\n藏干十神 原样保存的条目'},
        {'label': '日柱', 'value': '甲寅'},
        {'label': '时柱', 'value': timeKnown ? '丁丑' : '随时刻变化'},
      ],
    },
    {
      'method': 'ziwei',
      if (!timeKnown) 'note': '未确定时刻的归档说明',
      'rows': [
        {'label': '生年纳音', 'value': '甲子 · 海中金'},
      ],
    },
    {
      'method': 'western',
      'rows': [
        {'label': '太阳', 'value': '金牛座'},
      ],
    },
  ],
};

final _live = <String, Object?>{
  'bazi': [
    {'label': '日主与月令', 'value': '甲木'},
  ],
  'ziwei': {
    'className': '水二局',
    'lunarDate': '正月初六',
    'scenarioCount': 1,
    'palaces': [
      {
        'name': '命宫',
        'stem': '甲',
        'branch': '子',
        'body': true,
        'major': '天机',
        'minor': '',
        'others': '',
      },
      {
        'name': '父母',
        'stem': '乙',
        'branch': '丑',
        'body': false,
        'major': '紫微、天府',
        'minor': '文曲化科',
        'others': '天福',
      },
    ],
  },
  'western': {
    'positions': [
      {
        'planet': 'Sun',
        'label': '太阳',
        'value': '金牛座 1.0° · 第1宫',
        'longitude': 31,
      },
    ],
    'wheel': {
      'ascendant': 31,
      'midheaven': 300,
      'angles': [
        {'label': '上升', 'value': '金牛座 1.0°'},
        {'label': '天顶', 'value': '水瓶座 0.0°'},
      ],
      'houses': [
        for (var index = 0; index < 12; index++)
          {'label': '金牛座', 'longitude': index * 30},
      ],
      'aspects': [],
    },
  },
};
