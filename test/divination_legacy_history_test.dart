import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/requests/legacy_reading_archive_codec.dart';
import '../src/features/divination/view/divination_page.dart';
import '../src/ui/chat_time_label.dart';
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

Map<String, Object> _thread(
  String id,
  List<Map<String, Object>> messages, {
  String? title,
}) => {
  'id': id,
  if (title != null) 'title': title,
  'updatedAt': 1700000000000,
  'messages': messages,
};

Map<String, Object> _reading(
  int id,
  Map<String, Object?> snapshot, {
  int? sentAt,
}) => {
  'id': id,
  'kind': 'readingSession',
  'snapshot': snapshot,
  if (sentAt != null) 'sentAt': sentAt,
};

class _LegacyRecovery extends DivinationRecoveryFixture
    implements LegacyGuideArchiveStore {
  _LegacyRecovery(this.saved);

  final String saved;

  @override
  Future<List<LegacyGuideConversation>> readLegacyConversations() async =>
      decodeLegacyGuideConversations(saved).toList();
}

void main() {
  testWidgets(
    'reads original text and mixed RN Web conversations without resuming them',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 740));
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
      final json = jsonEncode({
        'activeId': 'mixed',
        'threads': [
          _thread('plain', [
            {'id': 5, 'kind': 'user', 'text': '我有个还没有说清楚的问题。'},
            {'id': 6, 'kind': 'guidance', 'text': '可以补充实际遇到的情况吗？'},
          ], title: '旧文字会话'),
          _thread('mixed', [
            {
              'id': 12,
              'kind': 'user',
              'text': '原来问的是工作。',
              'sentAt': 1700000000000,
              'attachments': [
                {
                  'id': 'attachment-one',
                  'name': '旧笔记.txt',
                  'kind': 'file',
                  'uri': 'file:///not-to-be-opened.txt',
                },
              ],
            },
            {'id': 5, 'kind': 'prompt', 'text': '旧助手先请补充细节。'},
            {
              'id': 7,
              'kind': 'readingQuestion',
              'question': '原版确认卡的问题？',
              'sentAt': 1700000240000,
              'understanding': {'focus': '旧提问重点', 'proof': 'do-not-import'},
              'error': '原版记录的确认错误。',
            },
            _reading(3, {
              ..._snapshot('tarot', 'rws-three-card-v1', '之前的单项塔罗'),
              'draw': chart.tarot.toJson(),
            }, sentAt: 1700000540000),
            {'id': 9, 'kind': 'preview', 'text': '原来聊过的模拟结果。'},
            _reading(10, {
              ...oldCombined,
              'draw': chart.tarot.toJson(),
              'results': {
                'liuyao': chart.liuyao.base.toJson(),
                'meihua': chart.meihua.toJson(),
                'meihuaInputSource': 'liuyao-first-three-lines',
              },
            }),
            _reading(11, {
              ..._snapshot('liuyao', 'three-coin-v1', '之前的单项六爻'),
              'result': chart.liuyao.base.toJson(),
            }),
            _reading(13, {
              ..._snapshot('meihua', 'three-number-v1', '之前的单项梅花'),
              'result': chart.meihua.toJson(),
            }),
            _reading(14, {...oldCombined, 'method': 'tarot'}),
            _reading(15, {
              ...oldCombined,
              'results': {
                'meihua': {'invalid': true},
              },
              'question': '坏盘面仍保留旧报告',
            }),
            _reading(16, current.toJson()),
          ], title: '原历史里的会话名'),
        ],
      });
      final recovery = _LegacyRecovery(json);
      final timelines = await recovery.readLegacyConversations();
      final mixed = timelines[1];
      expect(mixed.title, '原历史里的会话名');
      expect(mixed.messages.map((message) => message.id), [
        12,
        5,
        7,
        3,
        9,
        10,
        11,
        13,
        15,
        16,
      ]);
      expect(mixed.messages.first.attachmentNames, ['旧笔记.txt']);
      expect(
        mixed.messages
            .take(4)
            .map((message) => message.sentAt?.millisecondsSinceEpoch),
        [1700000000000, null, 1700000240000, 1700000540000],
      );
      expect(mixed.messages[2].error, '原版记录的确认错误。');
      final combined = mixed.messages[5].archive!;
      expect(combined.report?.answer, '存档时的判断。');
      expect(combined.followUps.single.answer, '这是已保存的追问答复。');
      expect(combined.tarot?.toJson(), chart.tarot.toJson());
      expect(combined.liuyao?.primary.name, chart.liuyao.base.primary.name);
      expect(combined.meihua?.toJson(), chart.meihua.toJson());
      expect(mixed.messages[3].archive?.tarot?.toJson(), chart.tarot.toJson());
      expect(
        mixed.messages[6].archive?.liuyao?.changed.name,
        chart.liuyao.base.changed.name,
      );
      expect(
        mixed.messages[7].archive?.meihua?.toJson(),
        chart.meihua.toJson(),
      );
      expect(mixed.messages[8].archive?.report?.answer, '存档时的判断。');
      expect(mixed.messages[8].archive?.meihua, isNull);
      final previouslyCopied = mixed.messages.last.reading!;
      expect(previouslyCopied.reading.toJson(), current.toJson());
      await recovery.writeHistory(previouslyCopied);

      final online = service.connect(recovery);
      await online.start('我想问新的面试准备。', automatic: false);
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(home: DivinationPage(onlineGuide: online)),
      );
      await tester.pumpAndSettle();
      expect(online.history.single.reading.snapshot.question, '我想问新的面试准备。');
      service.calls.clear();
      final history = find.byTooltip('会话历史');
      await tester.tap(history);
      await tester.pumpAndSettle();
      expect(find.byType(ListTile), findsNWidgets(3));
      final search = find.widgetWithText(TextField, '搜索对话');
      await tester.enterText(search, '旧提问重点');
      await tester.pumpAndSettle();
      expect(find.byType(ListTile), findsOneWidget);
      await tester.tap(find.widgetWithText(ListTile, '原历史里的会话名'));
      await tester.pumpAndSettle();

      expect(find.text('原来问的是工作。'), findsOneWidget);
      expect(
        tester
            .widgetList<ChatTimeLabel>(find.byType(ChatTimeLabel))
            .map((widget) => widget.sentAt.millisecondsSinceEpoch),
        [1700000000000, 1700000540000],
      );
      expect(find.text('旧笔记.txt'), findsOneWidget);
      expect(find.text('file:///not-to-be-opened.txt'), findsNothing);
      expect(find.text('do-not-import'), findsNothing);
      expect(find.text('旧助手先请补充细节。'), findsOneWidget);
      expect(find.text('旧提问重点'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('修改问题'), findsNothing);
      expect(find.byTooltip('发送追问'), findsNothing);
      final standalone = find.text('旧版塔罗');
      await tester.ensureVisible(standalone);
      await tester.tap(standalone);
      await tester.pumpAndSettle();
      expect(find.text('存档时的判断。'), findsOneWidget);
      expect(service.calls, isEmpty);
      final back = find.text('返回当前对话');
      await tester.ensureVisible(back);
      await tester.tap(back);
      await tester.pumpAndSettle();

      await tester.tap(history);
      await tester.pumpAndSettle();
      await tester.enterText(search, '补充实际');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, '旧文字会话'));
      await tester.pumpAndSettle();
      expect(find.text('我有个还没有说清楚的问题。'), findsOneWidget);
      expect(find.text('可以补充实际遇到的情况吗？'), findsOneWidget);
      expect(find.byType(ChatTimeLabel), findsNothing);
      expect(find.byType(TextFormField), findsNothing);
      expect(service.calls, isEmpty);
      await tester.tap(back);
      await tester.pumpAndSettle();
      expect(find.text('继续本次仪式'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test('ignores malformed JSON and retains the original 40-message limit', () {
    expect(decodeLegacyGuideConversations('{'), isEmpty);
    expect(decodeLegacyGuideConversations(null), isEmpty);
    final raw = jsonEncode({
      'activeId': 'original',
      'threads': [
        _thread('original', [
          for (var id = 1; id <= 43; id++)
            {'id': id, 'kind': 'user', 'text': '旧文字 $id'},
        ]),
      ],
    });
    final timeline = decodeLegacyGuideConversations(raw).single;
    expect(timeline.title, '旧文字 4');
    expect(timeline.messages, hasLength(40));
    expect(timeline.messages.first.id, 4);
    expect(timeline.messages.last.id, 43);
  });
}
