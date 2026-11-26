import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/requests/legacy_reading_archive_codec.dart';
import '../src/features/divination/view/divination_page.dart';
import 'support/divination_service_fixture.dart';

Map<String, Object> _report(String answer) => {
  'schemaVersion': 1,
  'answer': answer,
  'explanation': '历史报告的解释。',
  'nextSteps': ['整理原来的线索。'],
  'evidenceIds': ['legacy:reference'],
  'source': 'local',
};

Map<String, Object> _snapshot(String method, String version, String question) =>
    {
      'method': method,
      'ruleVersion': version,
      'stage': 'reading',
      'question': question,
      'focus': '继续回看原问题的关注点。',
      'report': _report('存档时的判断。'),
      'followUps': [
        {'question': '之前的追问？', 'report': _report('这是已保存的追问答复。')},
      ],
      'evidence': [
        {
          'id': 'legacy:reference',
          'label': '原版引用',
          'plain': '仅展示之前保存的依据。',
          'source': 'https://zh.wikisource.org/wiki/Test',
          'catalogVersion': 1,
        },
      ],
    };

String _history(List<Object> snapshots) => jsonEncode({
  'threads': [
    {
      'id': 'existing-chat',
      'updatedAt': 1700000000000,
      'messages': [
        for (final (index, snapshot) in snapshots.indexed)
          {'id': index + 1, 'kind': 'readingSession', 'snapshot': snapshot},
      ],
    },
  ],
});

class _LegacyRecovery extends DivinationRecoveryFixture
    implements LegacyGuideArchiveStore {
  _LegacyRecovery(this.saved);

  final String saved;

  @override
  Future<List<LegacyGuideArchive>> readLegacyArchives() async =>
      decodeLegacyGuideArchives(saved).toList();
}

void main() {
  testWidgets(
    'opens old combined and standalone readings in a read-only flow',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 640));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final service = DivinationServiceFixture()..failReport = false;
      final guide = service.connect(DivinationRecoveryFixture());
      await guide.start(divinationFixtureDetails, automatic: true);
      final current = guide.reading!;
      final chart = current.snapshot.chart!;
      guide.dispose();

      final oldCombined = _snapshot(
        'combined',
        'tarot-liuyao-meihua-v1',
        '之前的综合算事',
      );
      final original = _history([
        {
          ...oldCombined,
          'draw': chart.tarot.toJson(),
          'results': {
            'liuyao': chart.liuyao.base.toJson(),
            'meihua': chart.meihua.toJson(),
            'meihuaInputSource': 'liuyao-first-three-lines',
          },
        },
        {
          ..._snapshot('tarot', 'rws-three-card-v1', '之前的单项塔罗'),
          'draw': chart.tarot.toJson(),
        },
        {
          ..._snapshot('liuyao', 'three-coin-v1', '之前的单项六爻'),
          'result': chart.liuyao.base.toJson(),
        },
        {
          ..._snapshot('meihua', 'three-number-v1', '之前的单项梅花'),
          'result': chart.meihua.toJson(),
        },
        {...oldCombined, 'method': 'tarot', 'question': '方法与版本不符'},
        {...oldCombined, 'stage': 'cast', 'question': '仍处于启盘阶段'},
        {
          ...oldCombined,
          'results': {
            'meihua': {'invalid': true},
          },
          'question': '坏盘面保留旧报告',
        },
        current.toJson(),
      ]);
      final recovery = _LegacyRecovery(original);
      final archives = await recovery.readLegacyArchives();
      expect(archives.map((archive) => archive.question), [
        '之前的综合算事',
        '之前的单项塔罗',
        '之前的单项六爻',
        '之前的单项梅花',
        '坏盘面保留旧报告',
      ]);
      final combined = archives.first;
      expect(combined.report?.answer, '存档时的判断。');
      expect(combined.followUps.single.answer, '这是已保存的追问答复。');
      expect(combined.tarot?.toJson(), chart.tarot.toJson());
      expect(combined.liuyao?.primary.name, chart.liuyao.base.primary.name);
      expect(combined.meihua?.toJson(), chart.meihua.toJson());
      expect(archives[1].tarot?.toJson(), chart.tarot.toJson());
      expect(archives[2].liuyao?.changed.name, chart.liuyao.base.changed.name);
      expect(archives[3].meihua?.toJson(), chart.meihua.toJson());
      expect(archives.last.meihua, isNull);
      final online = service.connect(recovery);
      await online.start('我想问新的面试准备。', automatic: false);
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(home: DivinationPage(onlineGuide: online)),
      );
      await tester.pumpAndSettle();
      expect(online.history.single.reading.snapshot.question, '我想问新的面试准备。');
      service.calls.clear();
      final historyButton = find.byTooltip('会话历史');
      await tester.tap(historyButton);
      await tester.pumpAndSettle();
      final search = find.widgetWithText(TextField, '搜索对话');
      await tester.enterText(search, '之前的追问');
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ListTile, '我想问新的面试准备。'), findsNothing);
      await tester.tap(find.text('之前的综合算事'));
      await tester.pumpAndSettle();

      expect(find.text('旧版综合算事'), findsOneWidget);
      expect(find.text('存档时的判断。'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.byTooltip('发送追问'), findsNothing);
      expect(find.byKey(const ValueKey('guide-ritual-dialog')), findsNothing);
      expect(service.calls, isEmpty);
      await tester.tap(find.text('返回当前对话'));
      await tester.pumpAndSettle();
      expect(find.text('继续本次仪式'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test('malformed browser history returns no imported records', () {
    expect(decodeLegacyGuideArchives('{'), isEmpty);
    expect(decodeLegacyGuideArchives(null), isEmpty);
  });
}
