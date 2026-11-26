import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart' show MethodChannel, SystemChannels;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/divination/requests/reading_gateway.dart';
import '../src/features/divination/requests/reading_history_codec.dart';
import '../src/features/divination/requests/reading_recovery.dart';
import '../src/features/divination/view/divination_page.dart';
import '../src/features/divination/view/composer_attachment.dart';
import '../src/features/divination/view/guide_composer.dart';
import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/reading_report.dart';
import '../src/shared/http/json_client.dart';

const _question = '这件事如何推进？';
const _details = '我想问这周面试后续会怎样。';
const _explained = '可以补充一下正在考虑的具体事情吗？';
const _concern = '梳理这次面试的后续安排。';
const _followUp = '我接下来该准备什么？';
const _evidenceUrl = 'https://en.wikisource.org/wiki/Jovian_fixture';

void main() {
  testWidgets('composer keeps selected files local and sends only the caption', (
    tester,
  ) async {
    final service = _ReadingService();
    final online = service.connect(_Recovery());
    addTearDown(online.dispose);
    final picked = <ComposerAttachmentKind>[];
    final image = ComposerAttachment(
      file: XFile.fromData(
        base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/rkAAAAASUVORK5CYII=',
        ),
        mimeType: 'image/png',
        path: 'local-image.png',
        name: 'local-image.png',
      ),
      kind: ComposerAttachmentKind.image,
    );
    final file = ComposerAttachment(
      file: XFile.fromData(
        Uint8List.fromList(utf8.encode('contents must stay local')),
        mimeType: 'text/plain',
        path: 'local-document.txt',
        name: 'local-document.txt',
      ),
      kind: ComposerAttachmentKind.file,
      size: 24,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: GuideForm(
          online: online,
          attachmentPicker: (kind) async {
            picked.add(kind);
            return kind == ComposerAttachmentKind.image
                ? [image, file]
                : [file];
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await _openAttachmentMenu(tester, '添加图片');
    expect(picked, [ComposerAttachmentKind.image]);
    expect(find.text('附件留在本机，AI 仅读取文字。'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('预览图片 local-image.png'));
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
    await _tap(tester, '关闭');
    await tester.tap(find.byTooltip('移除附件 local-document.txt'));
    await tester.pumpAndSettle();
    expect(find.text('local-document.txt'), findsNothing);
    await _send(tester);
    expect(service.calls, isEmpty);
    expect(find.text('local-image.png'), findsOneWidget);
    expect(find.byTooltip('发送消息'), findsNothing);

    await tester.enterText(find.byType(TextFormField), _question);
    await _openAttachmentMenu(tester, '快捷提问');
    await _tap(tester, '算一件事');
    expect(
      tester.widget<TextFormField>(find.byType(TextFormField)).controller?.text,
      _question,
    );
    await _openAttachmentMenu(tester, '添加文件');
    await _send(tester);
    expect(picked, [ComposerAttachmentKind.image, ComposerAttachmentKind.file]);
    expect(service.calls, ['POST /reading/understand']);
    expect(service.understood, [_question]);
    expect(service.transmitted, [
      {'question': _question, 'requireModel': true},
    ]);
    expect(find.text('local-image.png'), findsOneWidget);
    expect(find.text('local-document.txt'), findsOneWidget);
    expect(find.text(_explained), findsOneWidget);
    await tester.tap(find.byTooltip('新对话'));
    await tester.pumpAndSettle();
    expect(find.text('local-image.png'), findsNothing);
    expect(find.text('local-document.txt'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('follow-up keeps the attachment out of the reading request', (
    tester,
  ) async {
    final service = _ReadingService()..failReport = false;
    final recovery = _Recovery();
    final initial = service.connect(recovery);
    await initial.start(_details, automatic: true);
    initial.dispose();
    service.calls.clear();
    service.transmitted.clear();
    final online = service.connect(recovery);
    addTearDown(online.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: GuideForm(
          online: online,
          attachmentPicker: (_) async => [
            ComposerAttachment(
              file: XFile.fromData(
                Uint8List(1),
                path: 'follow-up-only.txt',
                name: 'follow-up-only.txt',
              ),
              kind: ComposerAttachmentKind.file,
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(service.calls, ['GET /reading']);
    await _openAttachmentMenu(tester, '添加文件');
    await _send(tester);
    expect(service.calls, ['GET /reading']);
    expect(find.text('follow-up-only.txt'), findsOneWidget);
    await _openAttachmentMenu(tester, '添加文件');
    await tester.enterText(find.byType(TextFormField), _followUp);
    await _send(tester);
    expect(service.calls, ['GET /reading', 'POST /reading/follow-up']);
    expect(service.transmitted, [
      {},
      {'step': 0, 'question': _followUp},
    ]);
    expect(find.text('follow-up-only.txt'), findsNWidgets(2));
    expect(find.text('先确认后续时间。'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('only clears the deleted member’s native reading storage', () async {
    const prefix = 'jovian.divination.flutter.v1.https://fixture.invalid.';
    final token = 't' * 43;
    final secondToken = 's' * 43;
    final member = <String, String>{
      '${prefix}member:alice.active': jsonEncode(GuideRecovery(token).toJson()),
      '${prefix}member:alice.session.thread-one': jsonEncode(
        GuideRecovery(secondToken).toJson(),
      ),
      '${prefix}member:alice.history.thread-one': 'history',
      '${prefix}member:alice.index': '["thread-one"]',
    };
    final other = <String, String>{
      '${prefix}member:alice-other.active': jsonEncode(
        GuideRecovery('u' * 43).toJson(),
      ),
      '${prefix}guest:alice.history.thread-one': 'guest history',
      'jovian.ui.theme.v1': 'dark',
    };
    FlutterSecureStorage.setMockInitialValues({...member, ...other});
    addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
    expect(
      await memberReadingTokens('alice'),
      unorderedEquals([token, secondToken]),
    );
    final recovery = createReadingRecovery(
      Uri.https('fixture.invalid'),
      ownerScope: 'member:alice',
    );
    await Future.wait([
      recovery.write(GuideRecovery(secondToken)),
      clearMemberReadingData('alice'),
    ]);
    expect(await const FlutterSecureStorage().readAll(), other);
    expect(await memberReadingTokens('alice'), isEmpty);
  });

  testWidgets(
    'online conversation uses the existing reading contract at 320 pixels',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 680);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final service = _ReadingService();
      final recovery = _Recovery();
      final online = service.connect(recovery);
      addTearDown(online.dispose);
      await tester.pumpWidget(_app(online));
      await tester.pumpAndSettle();

      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.byType(TabBar), findsNothing);
      expect(find.byTooltip('发送消息'), findsNothing);
      await _tap(tester, '这次面试会顺利吗？');
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField))
            .controller
            ?.text,
        '这次面试会顺利吗？',
      );
      await tester.enterText(find.byType(TextFormField), _question);
      await _send(tester);
      expect(find.text(_question), findsOneWidget);
      expect(find.text(_explained), findsOneWidget);
      expect(service.calls, ['POST /reading/understand']);

      await tester.enterText(find.byType(TextFormField), _details);
      await _send(tester);
      expect(service.automatic, [false]);
      final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
      for (var index = 0; index < 6; index++) {
        await tester.ensureVisible(toss);
        await tester.tap(toss);
        await tester.pumpAndSettle();
      }
      for (final position in [40, 38, 39]) {
        final card = find.bySemanticsLabel('选取第 $position 张牌');
        tester.widget<Semantics>(card).properties.onTap!();
        await tester.pumpAndSettle();
      }
      await _tap(tester, '一键翻牌');
      await _tap(tester, '查看解读');
      expect(find.text('确认的关注点'), findsOneWidget);
      expect(find.text(_concern), findsOneWidget);
      expect(find.text('解读暂不可用，可以稍后重试。'), findsOneWidget);
      expect(find.text('查看三套盘面'), findsOneWidget);
      await _tap(tester, '重试');
      expect(find.text('塔罗解读'), findsOneWidget);
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('查看三套盘面'), findsOneWidget);
      expect(service.understood.last, '$_question；补充：$_details');
      expect(service.calls.where((call) => call == 'POST /reading').length, 1);
      expect(
        service.calls.where((call) => call == 'POST /reading/report').length,
        2,
      );

      final compose = find.byType(TextFormField);
      await tester.ensureVisible(compose);
      await tester.enterText(compose, _followUp);
      await _send(tester);
      expect(find.text(_followUp), findsOneWidget);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      expect(find.text('• 整理面试问题。'), findsOneWidget);

      final restart = find.text('另问一件事');
      await tester.ensureVisible(restart);
      final paragraph = tester.renderObject<RenderParagraph>(restart);
      expect(
        paragraph.getBoxesForSelection(
          const TextSelection(baseOffset: 0, extentOffset: 5),
        ),
        hasLength(1),
      );
      await _tap(tester, '另问一件事');
      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.text(_details), findsNothing);

      await tester.tap(find.byTooltip('会话历史'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, '搜索对话'), '确认后续');
      await tester.pumpAndSettle();
      await _tap(tester, '$_question；补充：$_details');
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      expect(find.byType(TextFormField), findsOneWidget);
      expect(service.calls.last, 'GET /reading');
      expect(
        service.calls.where((call) => call == 'POST /reading/follow-up').length,
        1,
      );
      final other = _ReadingService().connect(_Recovery());
      addTearDown(other.dispose);
      await tester.pumpWidget(_app(other));
      await tester.pumpAndSettle();
      expect(find.text('先确认后续时间。'), findsNothing);
      await tester.tap(find.byTooltip('会话历史'));
      await tester.pumpAndSettle();
      expect(find.text('暂无历史对话'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('a restored report opens without asking the model again', (
    tester,
  ) async {
    final service = _ReadingService()..failReport = false;
    final recovery = _Recovery();
    final initial = service.connect(recovery);
    await initial.start(_details, automatic: true);
    initial.dispose();
    service.calls.clear();
    final restored = service.connect(recovery);
    addTearDown(restored.dispose);

    await tester.pumpWidget(_app(restored));
    await tester.pumpAndSettle();
    expect(find.text('塔罗对照报告。'), findsOneWidget);
    expect(service.calls, ['GET /reading']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('stopping question analysis restores the original draft', (
    tester,
  ) async {
    final understand = Completer<void>();
    final service = _ReadingService()..understanding = understand.future;
    final online = service.connect(_Recovery());
    addTearDown(online.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: GuideForm(
          online: online,
          attachmentPicker: (_) async => [
            ComposerAttachment(
              file: XFile.fromData(
                Uint8List(1),
                path: 'local-draft.txt',
                name: 'local-draft.txt',
              ),
              kind: ComposerAttachmentKind.file,
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    final composer = find.byType(TextFormField);
    const draft = '  $_details  ';
    await tester.enterText(composer, draft);
    await _openAttachmentMenu(tester, '添加文件');
    await tester.tap(find.byTooltip('发送消息'));
    await tester.pump();

    expect(find.text('正在理解你的问题…'), findsOneWidget);
    expect(service.calls, ['POST /reading/understand']);
    await tester.tap(find.byTooltip('停止'));
    await tester.pumpAndSettle();
    expect(find.text('已停止，问题已恢复到输入框。'), findsOneWidget);
    expect(tester.widget<TextFormField>(composer).controller?.text, draft);
    expect(find.byTooltip('移除附件 local-draft.txt'), findsOneWidget);
    expect(find.byTooltip('停止'), findsNothing);

    // An earlier response arrives after the user stopped waiting.
    understand.complete();
    await tester.pumpAndSettle();
    expect(service.calls, ['POST /reading/understand']);
    expect(online.reading, isNull);
    expect(online.canRetry, isFalse);

    await _send(tester);
    expect(service.calls, [
      'POST /reading/understand',
      'POST /reading/understand',
      'POST /reading',
    ]);
    expect(service.understood, [_details, _details]);
    await tester.tap(find.byTooltip('暂停仪式'));
    await tester.pumpAndSettle();
    expect(find.text('local-draft.txt'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('another question starts without the prior question context', (
    tester,
  ) async {
    final service = _ReadingService()..failReport = false;
    final recovery = _Recovery();
    final initial = service.connect(recovery);
    await initial.start(_details, automatic: true);
    initial.dispose();
    final online = service.connect(recovery);
    addTearDown(online.dispose);
    await tester.pumpWidget(_app(online));
    await tester.pumpAndSettle();
    service.calls.clear();
    service.transmitted.clear();

    await _tap(tester, '另问一件事');
    await tester.enterText(find.byType(TextFormField), '下个月适合搬家吗？');
    await _send(tester);
    expect(service.calls, ['POST /reading/understand', 'POST /reading']);
    for (final request in service.transmitted) {
      expect(request['question'], '下个月适合搬家吗？');
      expect(request.containsKey('previousQuestion'), isFalse);
    }
    await tester.tap(find.byTooltip('暂停仪式'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('return to latest preserves reading position until requested', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 570));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final reply = Completer<void>();
    final service = _ReadingService()
      ..failReport = false
      ..followUpReply = reply.future
      ..longReport = true;
    final recovery = _Recovery();
    final initial = service.connect(recovery);
    await initial.start(_details, automatic: true);
    initial.dispose();
    final online = service.connect(recovery);
    addTearDown(online.dispose);
    await tester.pumpWidget(_app(online));
    await tester.pumpAndSettle();

    final thread = find.descendant(
      of: find.byType(GuideThread),
      matching: find.byType(SingleChildScrollView),
    );
    final position = tester
        .widget<SingleChildScrollView>(thread)
        .controller!
        .position;
    final latest = find.byTooltip('返回最新消息');
    expect(position.pixels, 0);
    expect(latest, findsOneWidget);
    await tester.tap(latest);
    await tester.pumpAndSettle();
    expect(position.extentAfter, closeTo(0, 1));
    expect(latest, findsNothing);

    await tester.enterText(find.byType(TextFormField), _followUp);
    await tester.pump();
    await tester.tap(find.byTooltip('发送消息'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    position.jumpTo(30);
    await tester.pump();
    expect(latest, findsOneWidget);
    reply.complete();
    await tester.pumpAndSettle();
    expect(position.pixels, closeTo(30, 1));

    await tester.tap(latest);
    await tester.pumpAndSettle();
    expect(position.extentAfter, closeTo(0, 1));
    expect(latest, findsNothing);
    expect(find.text('先确认后续时间。').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reading paragraphs expand independently on a narrow screen', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 680));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    const phrase = '可以先核实安排';
    const summary = '目前信息仍少。$phrase。';
    const detail = '先核实是否有下一轮面试。';
    const otherDetail = '把可参加的时间列出来。';
    final report = parseSavedProReport({
      'tarot': [
        {'text': summary, 'detail': detail},
        {'text': '第二张牌显示还有变动。', 'detail': otherDetail},
        {'text': '第三张牌说明可以准备。', 'detail': '整理之前的沟通内容。'},
        {'text': '综述：稳妥推进。'},
      ],
      'meihua': [
        {'text': '本卦说明还需等待。', 'detail': '及时查看新消息。'},
        {'text': '变卦提示干扰。', 'detail': '留出时间处理变动。'},
        {'text': '综述：留出余地。'},
      ],
      'liuyao': [
        {'text': '世爻显示先观察。', 'detail': '了解对方的安排。'},
        {'text': '应爻说明仍需沟通。', 'detail': '确认可参加的时间。'},
        {'text': '综述：主动确认。'},
      ],
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: Scaffold(
          body: SingleChildScrollView(child: ReadingReportView(report: report)),
        ),
      ),
    );
    final styled =
        tester.widget<Text>(find.text(summary)).textSpan! as TextSpan;
    expect(
      (styled.children!.singleWhere((part) => part.toPlainText() == phrase)
              as TextSpan)
          .style
          ?.fontWeight,
      FontWeight.w700,
    );
    await tester.tap(find.text('展开').first);
    await tester.pumpAndSettle();
    expect(find.text(detail), findsOneWidget);
    expect(find.text(otherDetail), findsNothing);
    await tester.tap(find.text('收起'));
    await tester.pumpAndSettle();
    expect(find.text(detail), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('history keeps cached reports after the server task expires', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 680));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    FlutterSecureStorage.setMockInitialValues({});
    addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
    String? copied;
    String? opened;
    const referenceChannel = MethodChannel('jovian/reading_reference');
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(referenceChannel, (call) async {
      expect(call.method, 'open');
      opened = call.arguments as String;
      return true;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(referenceChannel, null),
    );
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copied = (call.arguments as Map)['text'] as String;
      }
      return null;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    final service = _ReadingService()
      ..failReport = false
      ..extendedFollowUp = true;
    final base = Uri.https('fixture.invalid');
    GuideHistoryStore store(String owner) =>
        createReadingRecovery(base, ownerScope: 'member:$owner')
            as GuideHistoryStore;
    final recovery = store('owner');
    final initial = service.connect(recovery);
    await initial.start(_details, automatic: true);
    await initial.followUp(_followUp);
    await initial.nextQuestion();
    initial.dispose();
    final afterRestart = store('owner');
    expect(await afterRestart.read(), isNull);
    expect(await store('other').readHistory(), isEmpty);
    final archived = (await afterRestart.readHistory()).single.reading;
    expect(archived.followUps.single.question, _followUp);
    expect(archived.followUps.single.evidenceIds, ['tarot:v1:reference']);
    expect(archived.evidence.first.catalogVersion, 1);
    service.expired = true;
    service.calls.clear();
    final restored = service.connect(afterRestart);
    addTearDown(restored.dispose);

    await tester.pumpWidget(_app(restored));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('会话历史'));
    await tester.pumpAndSettle();
    await _tap(tester, _details);
    expect(service.calls, ['GET /reading']);
    expect(find.text('塔罗对照报告。'), findsOneWidget);
    expect(find.text('先确认后续时间。'), findsOneWidget);
    expect(find.text('时间参考'), findsOneWidget);
    expect(find.text('根据本次盘面，先跟进日程。'), findsOneWidget);
    expect(find.text('下一步'), findsOneWidget);
    expect(find.text('这次算事已过期，可以发起新问题。'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    await _tap(tester, '查看三套盘面');
    expect(find.text('梅花易数结果'), findsOneWidget);
    await _tap(tester, '收起盘面');
    expect(find.text('梅花易数结果'), findsNothing);
    await _tap(tester, '查看解读依据');
    expect(find.text('本次参考文献'), findsOneWidget);
    expect(find.text('未引用文献'), findsNothing);
    expect(opened, isNull);
    await _tap(tester, '打开参考原文');
    expect(opened, _evidenceUrl);
    await _tap(tester, '复制参考链接');
    expect(copied, _evidenceUrl);
    expect(service.calls, ['GET /reading']);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a question finishing on a different main tab waits in its chat',
    (tester) async {
      final understanding = Completer<void>();
      final online = (_ReadingService()..understanding = understanding.future)
          .connect(_Recovery());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        JovianApp(initialTab: JovianTab.divination, onlineGuide: online),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), _details);
      await tester.pump();
      await tester.tap(find.byTooltip('发送消息'));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey(JovianTab.messages)));
      await tester.pump();

      understanding.complete();
      await tester.pumpAndSettle();
      final coin = find.byKey(const ValueKey('coin-ritual-toss-button'));
      expect(coin, findsNothing);
      await tester.tap(find.byKey(const ValueKey(JovianTab.divination)));
      await tester.pumpAndSettle();
      await _tap(tester, '继续本次仪式');
      expect(coin, findsOneWidget);
      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
    },
  );
}

Widget _app(OnlineGuideController online) => MaterialApp(
  theme: ThemeData.dark(),
  home: DivinationPage(onlineGuide: online),
);

Future<void> _tap(WidgetTester tester, String label) async {
  final button = find.text(label);
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> _send(WidgetTester tester) async {
  await tester.pump();
  await tester.tap(find.byTooltip('发送消息'));
  await tester.pumpAndSettle();
}

Future<void> _openAttachmentMenu(WidgetTester tester, String label) async {
  await tester.tap(find.byTooltip('添加附件或快捷提问'));
  await tester.pumpAndSettle();
  await _tap(tester, label);
}

class _Recovery implements GuideHistoryStore {
  GuideRecovery? state;
  final _reads = <String, String>{};
  final _threads = <String, GuideRecovery?>{};

  @override
  Future<GuideRecovery?> read() async => state;

  @override
  Future<void> write(GuideRecovery? recovery) async => state = recovery;

  @override
  Future<List<GuideHistoryEntry>> readHistory() async => _reads.values
      .map(decodeGuideHistory)
      .whereType<GuideHistoryEntry>()
      .toList();

  @override
  Future<void> writeHistory(GuideHistoryEntry entry) async =>
      _reads[entry.id] = encodeGuideHistory(entry);

  @override
  Future<GuideRecovery?> readThread(String id) async => _threads[id];

  @override
  Future<void> writeThread(String id, GuideRecovery? recovery) async =>
      _threads[id] = recovery;
}

class _ReadingService {
  String get _token => 'a' * 43;
  bool failReport = true;
  bool expired = false;
  bool extendedFollowUp = false;
  bool longReport = false;
  Future<void>? understanding;
  Future<void>? followUpReply;
  final understood = <String>[];
  final calls = <String>[];
  final transmitted = <Map<Object?, Object?>>[];
  final automatic = <bool>[];
  GuideRitual? _ritual;
  bool _hasReport = false;
  final _followUps = <Map<String, Object?>>[];

  OnlineGuideController connect(GuideRecoveryStore recovery) {
    final client = MockClient(_respond);
    return OnlineGuideController(
      HttpGuideGateway(
        JsonHttpClient(base: Uri.https('fixture.invalid'), client: client),
      ),
      recovery,
      onDispose: client.close,
    );
  }

  Future<http.Response> _respond(http.Request request) async {
    final call = '${request.method} ${request.url.path}';
    final body = request.body.isEmpty
        ? const {}
        : jsonDecode(request.body) as Map;
    calls.add(call);
    transmitted.add(body);
    if (call != 'POST /reading/understand' && call != 'POST /reading') {
      expectSync(request.headers['Authorization'], 'Bearer $_token');
    }
    switch (call) {
      case 'POST /reading/understand':
        expectSync(body['requireModel'], true);
        await understanding;
        final question = body['question'] as String;
        understood.add(question);
        return _json({
          'source': 'model',
          'focus': _concern,
          'clarification': question == _question ? _explained : '',
          if (question != _question) 'proof': 'accepted-proof',
        });
      case 'POST /reading':
        expectSync(body['method'], 'combined');
        expectSync(body['profile'], guideVersion);
        expectSync(body['focus'], _concern);
        expectSync(body['proof'], 'accepted-proof');
        automatic.add(body['automatic'] == true);
        _hasReport = false;
        _followUps.clear();
        _ritual = GuideRitual(
          question: body['question'] as String,
          focus: _concern,
          automatic: automatic.last,
          random: () => 0.3,
        );
        return _json({'token': _token, 'task': _state()});
      case 'POST /reading/toss':
        _ritual!.toss(
          GuideCoinEvent(
            actionId: body['actionId'] as String,
            step: body['step'] as int,
          ),
        );
        return _json(_state());
      case 'POST /reading/pick':
        _ritual!.pick(
          GuideCardEvent(
            actionId: body['actionId'] as String,
            step: body['step'] as int,
            slot: body['slot'] as int,
            epochMs: body['epochMs'] as String,
            monotonicMs: body['monotonicMs'] as num,
            clockSessionId: body['clockSessionId'] as String,
          ),
        );
        return _json(_state());
      case 'GET /reading':
        if (expired) return _json({'error': 'not_found'}, status: 404);
        return _json(_state());
      case 'POST /reading/report':
        if (failReport) {
          failReport = false;
          return _json({'error': 'pro_model_unavailable'}, status: 503);
        }
        _hasReport = true;
        return _json(_state());
      case 'POST /reading/follow-up':
        expectSync(body, {'step': 0, 'question': _followUp});
        await followUpReply;
        _followUps.add({
          'question': _followUp,
          'report': {
            'answer': '先确认后续时间。',
            'nextSteps': ['整理面试问题。'],
            if (extendedFollowUp) ...{
              'explanation': '### 时间参考\n\n根据本次盘面，先跟进日程。',
              'evidenceIds': ['tarot:v1:reference'],
            },
          },
        });
        return _json(_state());
      default:
        throw StateError('Unexpected request: $call');
    }
  }

  Map<String, Object?> _state() => {
    ..._ritual!.snapshot.toChartSnapshotJson(),
    'followUps': _followUps,
    if (_hasReport && extendedFollowUp)
      'evidence': [
        {
          'id': 'tarot:v1:reference',
          'label': '本次参考文献',
          'plain': '这是本次报告引用的说明。',
          'source': _evidenceUrl,
          'catalogVersion': 1,
        },
        {
          'id': 'meihua:v1:unrelated',
          'label': '未引用文献',
          'plain': '这是未引用的说明。',
          'source': _evidenceUrl,
          'catalogVersion': 1,
        },
      ],
    if (_hasReport)
      'proReport': {
        'tarot': longReport ? '留意这次面试的后续通知。' * 60 : '塔罗对照报告。',
        'meihua': '梅花对照报告。',
        'liuyao': '六爻对照报告。',
      },
  };

  http.Response _json(Object value, {int status = 200}) => http.Response.bytes(
    utf8.encode(jsonEncode(value)),
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  );
}
