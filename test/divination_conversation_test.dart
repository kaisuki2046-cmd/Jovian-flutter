import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart'
    show MethodCall, MethodChannel, SystemChannels;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/divination/requests/reading_history_codec.dart';
import '../src/features/divination/requests/reading_recovery.dart';
import '../src/features/divination/view/divination_page.dart';
import '../src/features/divination/view/composer_attachment.dart';
import '../src/features/divination/view/composer_attachment_view.dart';
import '../src/features/divination/view/guide_composer.dart';
import '../src/features/divination/view/guide_conversation.dart';
import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/reading_report.dart';
import '../src/ui/chat_time_label.dart';
import '../src/ui/interface_language.dart';

import 'support/divination_service_fixture.dart';

void main() {
  final dispatcher =
      TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher;
  setUp(() {
    dispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
      disableAnimations: true,
    );
  });
  tearDown(dispatcher.clearAccessibilityFeaturesTestValue);
  test(
    'a stored reading preserves the published chart and its server hash',
    () async {
      final service = DivinationServiceFixture()..failReport = false;
      final recovery = DivinationRecoveryFixture();
      final online = service.connect(recovery);
      addTearDown(online.dispose);
      await online.start(divinationFixtureDetails, automatic: true);

      final wire =
          jsonDecode(jsonEncode(online.reading!.toJson()))
              as Map<String, Object?>;
      final cast = wire['castResult'] as Map<String, Object?>;
      final results = wire['results'] as Map<String, Object?>;
      final meihua = results['meihua'] as Map<String, Object?>;
      (cast['calendar'] as Map<String, Object?>)['day'] = '甲子';
      (cast['primary'] as Map<String, Object?>)['theme'] = '服务端发布的卦意。';
      results['liuyao'] = cast;
      meihua['interpretation'] = '服务端发布的体用解读。';
      meihua['inputs'] = [1, 2, 3];
      final serverHash = 'f' * 64;
      wire['chartHash'] = serverHash;

      final snapshot = OnlineReading.fromJson(wire);
      final chart = snapshot.snapshot.chart!;
      expect(chart.liuyao.calendar.day, '甲子');
      expect(chart.liuyao.base.primary.theme, '服务端发布的卦意。');
      expect(chart.meihua.inputs, [1, 2, 3]);
      expect(chart.meihua.interpretation, '服务端发布的体用解读。');
      expect(chart.chartHash, serverHash);

      final restored = decodeGuideHistory(
        encodeGuideHistory(
          GuideHistoryEntry(
            id: 'published-chart',
            updatedAt: DateTime.utc(2026),
            reading: snapshot,
          ),
        ),
      );
      expect(restored?.reading.toJson(), wire);
      expect(
        () => OnlineReading.fromJson({...wire, 'chartHash': 'invalid'}),
        throwsFormatException,
      );
      expect(
        () => OnlineReading.fromJson({
          ...wire,
          'castResult': {...cast, 'lines': []},
        }),
        throwsFormatException,
      );
    },
  );

  testWidgets(
    'permission recovery retries the same question without duplication',
    (tester) async {
      final service = DivinationServiceFixture()
        ..denyUnderstandingPermission = true;
      final online = service.connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      var opened = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: DivinationPage(
            onlineGuide: online,
            openAiPermissions: () {
              opened++;
              service.denyUnderstandingPermission = false;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureQuestion,
      );
      await _send(tester);
      expect(online.needsAiPermission, isTrue);
      expect(
        online.activeTranscript.single.question,
        divinationFixtureQuestion,
      );
      expect(online.activeTranscript.single.reply, isNull);
      final conversation = online.activeConversationId;
      await _tap(tester, '前往 AI 授权');
      expect(opened, 1);
      expect(service.understood, [divinationFixtureQuestion]);

      await _tap(tester, '重试');
      expect(online.needsAiPermission, isFalse);
      expect(online.activeConversationId, conversation);
      expect(
        online.activeTranscript.single.question,
        divinationFixtureQuestion,
      );
      expect(
        online.activeTranscript.single.reply,
        divinationFixtureClarification,
      );
      expect(service.understood, [
        divinationFixtureQuestion,
        divinationFixtureQuestion,
      ]);
      expect(find.text('前往 AI 授权'), findsNothing);
    },
  );

  testWidgets('composer sends only the caption and restores attachment names', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
    final service = DivinationServiceFixture();
    GuideRecoveryStore store() => createReadingRecovery(
      Uri.https('fixture.invalid'),
      ownerScope: 'member:attachment-owner',
    );
    final online = service.connect(store());
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

    await tester.enterText(
      find.byType(TextFormField),
      divinationFixtureQuestion,
    );
    await _openAttachmentMenu(tester, '快捷提问');
    await _tap(tester, '算一件事');
    expect(
      tester.widget<TextFormField>(find.byType(TextFormField)).controller?.text,
      divinationFixtureQuestion,
    );
    await _openAttachmentMenu(tester, '添加文件');
    await _send(tester);
    expect(picked, [ComposerAttachmentKind.image, ComposerAttachmentKind.file]);
    expect(service.calls, ['POST /reading/understand']);
    expect(service.understood, [divinationFixtureQuestion]);
    expect(service.transmitted, [
      {'question': divinationFixtureQuestion, 'requireModel': true},
    ]);
    expect(find.text('local-image.png'), findsOneWidget);
    expect(find.text('local-document.txt'), findsOneWidget);
    expect(find.text(divinationFixtureClarification), findsOneWidget);
    await tester.tap(find.byTooltip('新对话'));
    await tester.pumpAndSettle();
    expect(find.text('local-image.png'), findsNothing);
    expect(find.text('local-document.txt'), findsNothing);

    final stored = (await const FlutterSecureStorage().readAll()).values.join();
    expect(stored, contains('local-image.png'));
    expect(stored, contains('local-document.txt'));
    expect(stored, isNot(contains('contents must stay local')));
    expect(stored, isNot(contains('iVBORw0KGgo')));
    final restored = service.connect(store());
    addTearDown(restored.dispose);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(MaterialApp(home: GuideForm(online: restored)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('会话历史'));
    await tester.pumpAndSettle();
    final search = find.widgetWithText(TextField, '搜索对话');
    await tester.enterText(search, 'local-document');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'local-image.png'));
    await tester.pumpAndSettle();
    expect(find.text('local-image.png'), findsOneWidget);
    expect(find.text('local-document.txt'), findsOneWidget);
    expect(find.byType(ComposerAttachmentTile), findsNothing);
    expect(service.calls, ['POST /reading/understand']);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'mobile files open through the platform once, then allow a retry',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 560);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      const channel = MethodChannel('jovian/attachment_preview');
      final messenger = tester.binding.defaultBinaryMessenger;
      final requests = <MethodCall>[];
      final firstAttempt = Completer<bool>();
      final lastAttempt = Completer<bool>();
      messenger.setMockMethodCallHandler(channel, (call) async {
        requests.add(call);
        if (requests.length == 1) return firstAttempt.future;
        if (requests.length == 3) return lastAttempt.future;
        return true;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(channel, null));

      final selectedPath = Uri.parse(
        'file:///C:/system-picker/example.pdf',
      ).toFilePath();
      final attachment = ComposerAttachment(
        file: XFile.fromData(
          Uint8List(16),
          path: selectedPath,
          name: 'example.pdf',
          mimeType: 'application/pdf',
        ),
        kind: ComposerAttachmentKind.file,
        size: 16,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: ComposerAttachmentTile(attachment: attachment)),
        ),
      );
      await tester.tap(find.byType(InkWell));
      await tester.pumpAndSettle();
      expect(find.text('保存到本机'), findsNothing);

      final open = find.widgetWithText(TextButton, '用系统应用打开');
      final opening = find.widgetWithText(TextButton, '正在打开…');
      final error = find.text('此设备暂时无法打开这个文件，请重试。');
      await tester.tap(open);
      await tester.tap(open);
      await tester.pump();
      expect(requests, hasLength(1));
      expect(requests.single.method, 'open');
      expect(requests.single.arguments, {
        'path': selectedPath,
        'name': 'example.pdf',
        'mimeType': 'application/pdf',
      });
      expect(tester.widget<TextButton>(opening).onPressed, isNull);

      firstAttempt.complete(false);
      await tester.pumpAndSettle();
      expect(error, findsOneWidget);
      await tester.tap(open);
      await tester.pumpAndSettle();
      expect(requests, hasLength(2));
      expect(error, findsNothing);

      await tester.tap(open);
      await tester.pump();
      expect(requests, hasLength(3));
      await tester.tap(find.widgetWithText(TextButton, '关闭'));
      await tester.pumpAndSettle();
      lastAttempt.complete(false);
      await tester.pumpAndSettle();
      expect(find.byType(ComposerAttachmentTile), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
    variant: const TargetPlatformVariant({
      TargetPlatform.android,
      TargetPlatform.iOS,
    }),
  );

  testWidgets('desktop file details do not use the mobile preview channel', (
    tester,
  ) async {
    final attachment = ComposerAttachment(
      file: XFile.fromData(Uint8List(16), name: 'desktop.bin'),
      kind: ComposerAttachmentKind.file,
      size: 16,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ComposerAttachmentTile(attachment: attachment)),
      ),
    );
    await tester.tap(find.byType(InkWell));
    await tester.pumpAndSettle();
    expect(find.text('此附件仅保留在本机。'), findsOneWidget);
    expect(find.text('用系统应用打开'), findsNothing);
    expect(find.text('保存到本机'), findsNothing);
    expect(tester.takeException(), isNull);
  }, variant: const TargetPlatformVariant({TargetPlatform.windows}));

  testWidgets(
    'follow-ups restore local names without adding them to requests',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
      final service = DivinationServiceFixture()..failReport = false;
      GuideRecoveryStore store() => createReadingRecovery(
        Uri.https('fixture.invalid'),
        ownerScope: 'member:follow-up-owner',
      );
      final initial = service.connect(store());
      await initial.start(divinationFixtureDetails, automatic: true);
      initial.dispose();
      service.calls.clear();
      service.transmitted.clear();
      final online = service.connect(store());
      addTearDown(online.dispose);
      var picks = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: GuideForm(
            online: online,
            attachmentPicker: (_) async {
              final name = picks++ == 0
                  ? 'follow-up-only.txt'
                  : 'follow-up-context.txt';
              return [
                ComposerAttachment(
                  file: XFile.fromData(
                    Uint8List(1),
                    path: 'local-only-path${Platform.pathSeparator}$name',
                    name: name,
                  ),
                  kind: ComposerAttachmentKind.file,
                ),
              ];
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(service.calls, ['GET /reading']);
      await _openAttachmentMenu(tester, '添加文件');
      await _send(tester, label: '发送追问');
      expect(service.calls, ['GET /reading']);
      expect(find.text('follow-up-only.txt'), findsOneWidget);
      await _openAttachmentMenu(tester, '添加文件');
      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureFollowUp,
      );
      await _send(tester, label: '发送追问');
      expect(service.calls, ['GET /reading', 'POST /reading/follow-up']);
      expect(service.transmitted, [
        {},
        {'step': 0, 'question': divinationFixtureFollowUp},
      ]);
      expect(find.text('follow-up-only.txt'), findsOneWidget);
      expect(find.text('follow-up-context.txt'), findsOneWidget);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      final cached = (await const FlutterSecureStorage().readAll()).values
          .join();
      expect(cached, isNot(contains('local-only-path')));

      final restored = service.connect(store());
      addTearDown(restored.dispose);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(MaterialApp(home: GuideForm(online: restored)));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('会话历史'));
      await tester.pumpAndSettle();
      final search = find.widgetWithText(TextField, '搜索对话');
      await tester.enterText(search, 'follow-up-context.txt');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, divinationFixtureDetails));
      await tester.pumpAndSettle();
      expect(find.text('follow-up-only.txt'), findsOneWidget);
      expect(find.text('follow-up-context.txt'), findsOneWidget);
      expect(find.byType(ComposerAttachmentTile), findsNothing);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

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
      final service = DivinationServiceFixture();
      final recovery = DivinationRecoveryFixture();
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
      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureQuestion,
      );
      await _send(tester);
      expect(find.text(divinationFixtureQuestion), findsOneWidget);
      expect(find.text(divinationFixtureClarification), findsOneWidget);
      expect(service.calls, ['POST /reading/understand']);

      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureDetails,
      );
      await _send(tester);
      expect(service.automatic, [false]);
      for (final position in [40, 38, 39]) {
        final card = find.bySemanticsLabel('选取第 $position 张牌');
        tester.widget<Semantics>(card).properties.onTap!();
        await tester.pumpAndSettle();
      }
      await _tap(tester, '一键翻牌');
      await _tap(tester, '继续六爻起卦');
      final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
      for (var index = 0; index < 6; index++) {
        await tester.ensureVisible(toss);
        await tester.tap(toss);
        await tester.pumpAndSettle();
      }
      expect(find.text('确认的关注点'), findsOneWidget);
      expect(find.text(divinationFixtureFocus), findsOneWidget);
      expect(find.text('解读暂不可用，可以稍后重试。'), findsOneWidget);
      expect(find.text('查看三套盘面'), findsOneWidget);
      await _tap(tester, '重试');
      expect(find.text('塔罗解读'), findsOneWidget);
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('查看三套盘面'), findsOneWidget);
      expect(
        service.understood.last,
        '$divinationFixtureQuestion；补充：$divinationFixtureDetails',
      );
      expect(service.calls.where((call) => call == 'POST /reading').length, 1);
      expect(
        service.calls.where((call) => call == 'POST /reading/report').length,
        2,
      );

      final compose = find.byType(TextFormField);
      await tester.ensureVisible(compose);
      await tester.enterText(compose, divinationFixtureFollowUp);
      await _send(tester, label: '发送追问');
      expect(find.text(divinationFixtureFollowUp), findsOneWidget);
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
      expect(find.text('查看此前解读'), findsOneWidget);
      expect(find.byType(TextFormField), findsOneWidget);
      await tester.tap(find.byTooltip('新对话'));
      await tester.pumpAndSettle();
      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.text(divinationFixtureDetails), findsNothing);

      await tester.tap(find.byTooltip('会话历史'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, '搜索对话'), '确认后续');
      await tester.pumpAndSettle();
      await _tap(tester, divinationFixtureQuestion);
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      expect(find.byType(TextFormField), findsOneWidget);
      expect(service.calls.last, 'GET /reading');
      expect(
        service.calls.where((call) => call == 'POST /reading/follow-up').length,
        1,
      );
      final other = DivinationServiceFixture().connect(
        DivinationRecoveryFixture(),
      );
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
    final service = DivinationServiceFixture()..failReport = false;
    final recovery = DivinationRecoveryFixture();
    final initial = service.connect(recovery);
    await initial.start(divinationFixtureDetails, automatic: true);
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

  testWidgets('retrying a failed reading start reuses the confirmed question', (
    tester,
  ) async {
    final service = DivinationServiceFixture()
      ..startFailures.add((status: 503, code: 'unavailable'));
    final online = service.connect(DivinationRecoveryFixture());
    addTearDown(online.dispose);
    await tester.pumpWidget(_app(online));
    await tester.pumpAndSettle();
    final composer = find.byType(TextFormField);

    await tester.enterText(composer, divinationFixtureQuestion);
    await _send(tester);
    expect(find.text(divinationFixtureClarification), findsOneWidget);
    await tester.enterText(composer, divinationFixtureDetails);
    await _send(tester);
    expect(find.text('AI 辅助确认'), findsOneWidget);
    expect(find.text(divinationFixtureFocus), findsOneWidget);
    expect(find.text('暂时无法开始算事，请稍后重试。'), findsOneWidget);
    expect(find.text('修改问题'), findsOneWidget);
    expect(service.understood, hasLength(2));
    expect(
      service.understood.last,
      '$divinationFixtureQuestion；补充：$divinationFixtureDetails',
    );
    final firstStart = service.transmitted.last;

    await _tap(tester, '重试算事');
    expect(service.calls, [
      'POST /reading/understand',
      'POST /reading/understand',
      'POST /reading',
      'POST /reading',
    ]);
    expect(service.transmitted.last, firstStart);
    expect(online.activeTranscript, hasLength(2));
    expect(online.activeTranscript.last.question, divinationFixtureDetails);
    expect(find.text('第 1 步 · 塔罗选牌'), findsOneWidget);
  });

  testWidgets(
    'editing a failed reading keeps the draft and local attachments',
    (tester) async {
      final service = DivinationServiceFixture()
        ..startFailures.add((status: 503, code: 'unavailable'));
      final online = service.connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: GuideForm(
            online: online,
            attachmentPicker: (_) async => [
              ComposerAttachment(
                file: XFile.fromData(
                  Uint8List(1),
                  path: 'reading-notes.txt',
                  name: 'reading-notes.txt',
                ),
                kind: ComposerAttachmentKind.file,
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();
      final composer = find.byType(TextFormField);
      const draft = '  $divinationFixtureDetails  ';
      await tester.enterText(composer, draft);
      await _openAttachmentMenu(tester, '添加文件');
      await _send(tester);
      await _tap(tester, '修改问题');

      final field = find.byType(EditableText);
      expect(tester.widget<EditableText>(field).focusNode.hasFocus, isTrue);
      expect(tester.widget<TextFormField>(composer).controller?.text, draft);
      expect(find.byTooltip('移除附件 reading-notes.txt'), findsOneWidget);
      expect(find.text('重试算事'), findsNothing);
      expect(online.canRetry, isFalse);
      expect(service.calls, ['POST /reading/understand', 'POST /reading']);

      const edited = '我想问下周另一场面试的准备。';
      await tester.enterText(composer, edited);
      await _send(tester);
      expect(service.understood, [divinationFixtureDetails, edited]);
      expect(service.transmitted.last['question'], edited);
      expect(
        service.transmitted.last.values,
        isNot(contains('reading-notes.txt')),
      );
      expect(online.activeTranscript.map((turn) => turn.question), [
        divinationFixtureDetails,
        edited,
      ]);
    },
  );

  testWidgets('an expired proof is renewed only after the server rejects it', (
    tester,
  ) async {
    final service = DivinationServiceFixture()
      ..startFailures.addAll([
        (status: 503, code: 'unavailable'),
        (status: 400, code: 'question_needs_model_confirmation'),
      ]);
    final online = service.connect(DivinationRecoveryFixture());
    addTearDown(online.dispose);
    await tester.pumpWidget(_app(online));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField),
      divinationFixtureDetails,
    );
    await _send(tester);

    await _tap(tester, '重试算事');
    expect(service.understood, hasLength(1));
    expect(find.text('问题确认已过期，请重试确认。'), findsOneWidget);
    await _tap(tester, '重试算事');
    expect(service.calls, [
      'POST /reading/understand',
      'POST /reading',
      'POST /reading',
      'POST /reading/understand',
      'POST /reading',
    ]);
    expect(online.activeTranscript, hasLength(1));
    expect(find.text('第 1 步 · 塔罗选牌'), findsOneWidget);
  });

  testWidgets('stopping question analysis restores the original draft', (
    tester,
  ) async {
    final understand = Completer<void>();
    final service = DivinationServiceFixture()
      ..understanding = understand.future;
    final recovery = DivinationRecoveryFixture();
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
    const draft = '  $divinationFixtureDetails  ';
    await tester.enterText(composer, draft);
    await _openAttachmentMenu(tester, '添加文件');
    await tester.tap(find.byTooltip('发送消息'));
    await tester.pump();

    expect(find.text('正在理解你的问题…'), findsOneWidget);
    expect(
      tester.widget<ChatTimeLabel>(find.byType(ChatTimeLabel)).sentAt,
      online.activeTranscript.single.sentAt,
    );
    final pendingBubble = find.widgetWithText(
      GuideQuestionBubble,
      divinationFixtureDetails,
    );
    expect(pendingBubble, findsOneWidget);
    expect(
      tester.getBottomLeft(find.byType(ChatTimeLabel)).dy,
      lessThanOrEqualTo(tester.getTopLeft(pendingBubble).dy),
    );
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
    final stoppedTurn = online.activeTranscript.single;
    expect(stoppedTurn.question, divinationFixtureDetails);
    expect(stoppedTurn.reply, isNull);
    expect((await recovery.readTranscriptTurns()).single.id, stoppedTurn.id);

    await _send(tester);
    expect(online.activeTranscript.single.id, stoppedTurn.id);
    expect(service.calls, [
      'POST /reading/understand',
      'POST /reading/understand',
      'POST /reading',
    ]);
    expect(service.understood, [
      divinationFixtureDetails,
      divinationFixtureDetails,
    ]);
    await tester.tap(find.byTooltip('暂停仪式'));
    await tester.pumpAndSettle();
    expect(find.text('local-draft.txt'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test(
    'closing an owner before the transcript write completes cancels model work',
    () async {
      final service = DivinationServiceFixture();
      final releaseWrite = Completer<void>();
      final writing = Completer<void>();
      final recovery = _PausedTranscriptWrite(writing, releaseWrite.future);
      final online = service.connect(recovery);
      final request = online.start(divinationFixtureQuestion, automatic: false);
      await writing.future;
      online.dispose();
      releaseWrite.complete();
      await request;

      expect(service.calls, isEmpty);
      expect(await recovery.readTranscriptPosition(), isNull);
    },
  );

  testWidgets(
    'history places a continued reading under Today and searches each turn field',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 760);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final now = DateTime.now();
      DateTime daysAgo(int days) =>
          DateTime(now.year, now.month, now.day - days, 12);
      final setup = (DivinationServiceFixture()..failReport = false).connect(
        DivinationRecoveryFixture(),
      );
      addTearDown(setup.dispose);
      await setup.start(divinationFixtureDetails, automatic: true);
      final original = setup.reading!;
      final recovery = DivinationRecoveryFixture();
      await recovery.writeHistory(
        GuideHistoryEntry(
          id: 'old-reading',
          updatedAt: daysAgo(0),
          reading: OnlineReading(
            original.snapshot,
            report: original.report,
            followUps: [
              (
                question: '刚补问的内容',
                answer: '新的追问答复',
                explanation: null,
                nextSteps: [],
                evidenceIds: [],
              ),
            ],
          ),
        ),
      );
      for (final (id, question, age) in const [
        ('active-chat', '最早的会话原文', 65),
        ('yesterday', '昨天的提问原文', 1),
        ('last-week', '六天前的提问原文', 6),
        ('last-month', '七天前的提问原文', 7),
        ('older', '更早的提问原文', 33),
      ]) {
        await recovery.writeTranscriptTurn((
          id: '$id-turn',
          conversationId: id,
          sentAt: daysAgo(age),
          question: question,
          reply: id == 'active-chat' ? '前面的助手回复' : null,
          clarificationQuestion: id == 'active-chat' ? '请补充具体事件' : null,
          previousQuestion: null,
          attachmentNames: const [],
          readingId: null,
        ));
      }

      await recovery.writeTranscriptTurn((
        id: 'active-chat-reading',
        conversationId: 'active-chat',
        sentAt: daysAgo(64),
        question: '随后确认的问题',
        reply: null,
        clarificationQuestion: null,
        previousQuestion: null,
        attachmentNames: const [],
        readingId: 'old-reading',
      ));

      final service = DivinationServiceFixture();
      final online = service.connect(recovery);
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [interfaceStringsDelegate],
          home: DivinationPage(onlineGuide: online),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Chat history'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Close chat history'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Yesterday'), findsOneWidget);
      expect(find.text('Last 7 days'), findsOneWidget);
      expect(find.text('Last 30 days'), findsOneWidget);
      final root = tester.element(find.byType(Drawer));
      expect(
        find.text(MaterialLocalizations.of(root).formatMonthYear(daysAgo(33))),
        findsOneWidget,
      );
      final rows = find.descendant(
        of: find.byType(Drawer),
        matching: find.byType(ListTile),
      );
      expect(
        tester
            .widgetList<ListTile>(rows)
            .map((row) => (row.title! as Text).data),
        ['最早的会话原文', '昨天的提问原文', '六天前的提问原文', '七天前的提问原文', '更早的提问原文'],
      );

      final search = find.descendant(
        of: find.byType(Drawer),
        matching: find.byType(TextField),
      );
      for (final query in ['具体事件', original.snapshot.focus, '追问答复']) {
        await tester.enterText(search, query);
        await tester.pumpAndSettle();
        expect(rows, findsOneWidget);
        expect(find.widgetWithText(ListTile, '最早的会话原文'), findsOneWidget);
      }
      await tester.enterText(search, '找不到的字');
      await tester.pumpAndSettle();
      expect(find.text('No matching chats'), findsOneWidget);
      await tester.tap(find.byTooltip('Clear search'));
      await tester.pumpAndSettle();
      expect(rows, findsNWidgets(5));

      await tester.tap(find.widgetWithText(ListTile, '最早的会话原文'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Close chat history'), findsNothing);
      expect(online.activeConversationId, 'active-chat');
      expect(service.calls, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'a clarification-only conversation survives restart and continues',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
      final base = Uri.https('fixture.invalid');
      GuideRecoveryStore store() =>
          createReadingRecovery(base, ownerScope: 'member:clarification-owner');
      final service = DivinationServiceFixture();
      final initial = service.connect(store());
      await tester.pumpWidget(_app(initial));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureQuestion,
      );
      await _send(tester);
      expect(find.text(divinationFixtureClarification), findsOneWidget);
      final conversation = initial.activeConversationId;
      expect(conversation, isNotNull);
      expect(initial.history, isEmpty);
      final sentAt = initial.activeTranscript.single.sentAt;
      expect(
        tester.widget<ChatTimeLabel>(find.byType(ChatTimeLabel)).sentAt,
        sentAt,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      initial.dispose();

      service.calls.clear();
      final restored = service.connect(store());
      addTearDown(restored.dispose);
      await tester.pumpWidget(_app(restored));
      await tester.pumpAndSettle();
      expect(restored.activeConversationId, conversation);
      expect(
        tester.widget<ChatTimeLabel>(find.byType(ChatTimeLabel)).sentAt,
        sentAt,
      );
      expect(find.text(divinationFixtureQuestion), findsOneWidget);
      expect(find.text(divinationFixtureClarification), findsOneWidget);
      expect(service.calls, isEmpty);
      await tester.tap(find.byTooltip('新对话'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('会话历史'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, '搜索对话'), '具体事情');
      await tester.pumpAndSettle();
      await _tap(tester, divinationFixtureQuestion);
      expect(restored.activeConversationId, conversation);
      expect(find.text(divinationFixtureClarification), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureDetails,
      );
      await _send(tester);
      expect(
        service.understood.last,
        '$divinationFixtureQuestion；补充：$divinationFixtureDetails',
      );
      expect(restored.transcripts.single.id, conversation);
      expect(restored.transcripts.single.turns.map((turn) => turn.question), [
        divinationFixtureQuestion,
        divinationFixtureDetails,
      ]);
      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      expect(find.text(divinationFixtureClarification), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'a restored earlier reading keeps its time next to its question',
    (tester) async {
      final service = DivinationServiceFixture()..failReport = false;
      final recovery = DivinationRecoveryFixture();
      final initial = service.connect(recovery);
      const earlier = '原来这个面试还有下一轮吗？';
      const later = '大概要等多久才有消息？';
      await initial.start(earlier, automatic: true);
      final earlierRecovery = (await recovery.read())!;
      await initial.nextQuestion();
      await initial.start(later, automatic: false);
      final started = DateTime(2026, 11, 27, 11, 20);
      for (final (index, turn) in initial.activeTranscript.indexed) {
        await recovery.writeTranscriptTurn((
          id: turn.id,
          conversationId: turn.conversationId,
          sentAt: started.add(Duration(minutes: index * 2)),
          question: turn.question,
          attachmentNames: turn.attachmentNames,
          reply: turn.reply,
          clarificationQuestion: turn.clarificationQuestion,
          previousQuestion: turn.previousQuestion,
          readingId: turn.readingId,
        ));
      }
      await recovery.write(earlierRecovery);
      initial.dispose();
      service.expired = true;
      final restored = service.connect(recovery);
      addTearDown(restored.dispose);
      await tester.pumpWidget(_app(restored));
      await tester.pumpAndSettle();

      expect(restored.reading?.snapshot.question, earlier);
      final stamp = find.byType(ChatTimeLabel);
      expect(tester.widget<ChatTimeLabel>(stamp).sentAt, started);
      final earlierBubble = find.widgetWithText(GuideQuestionBubble, earlier);
      final laterBubble = find.widgetWithText(GuideQuestionBubble, later);
      expect(
        tester.getTopLeft(stamp).dy,
        greaterThan(tester.getBottomLeft(laterBubble).dy),
      );
      expect(
        tester.getBottomLeft(stamp).dy,
        lessThanOrEqualTo(tester.getTopLeft(earlierBubble).dy),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('continuing the previous question starts a contextual reading', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 570));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final service = DivinationServiceFixture()..failReport = false;
    final recovery = DivinationRecoveryFixture();
    final initial = service.connect(recovery);
    await initial.start(divinationFixtureDetails, automatic: true);
    initial.dispose();
    final online = service.connect(recovery);
    addTearDown(online.dispose);
    await tester.pumpWidget(_app(online));
    await tester.pumpAndSettle();
    service.calls.clear();
    service.transmitted.clear();
    final firstReading = online.activeHistoryId;
    final firstConversation = online.activeConversationId;
    expect(firstConversation, isNotNull);

    expect(find.text('围绕这次结果继续问'), findsOneWidget);
    await _tap(tester, '接着上一题问');
    expect(find.text('接着上一题问'), findsOneWidget);
    expect(find.text(divinationFixtureDetails), findsOneWidget);

    const nextQuestion = '后续大概几天会有消息？';
    await tester.enterText(find.byType(TextFormField), nextQuestion);
    await _send(tester);
    expect(service.calls, ['POST /reading/understand', 'POST /reading']);
    for (final request in service.transmitted) {
      expect(request['question'], nextQuestion);
      expect(request['previousQuestion'], divinationFixtureDetails);
    }
    expect(online.activeHistoryId, isNot(firstReading));
    expect(online.history.map((entry) => entry.id), contains(firstReading));
    expect(online.activeConversationId, firstConversation);
    expect(online.transcripts.single.turns.map((turn) => turn.question), [
      divinationFixtureDetails,
      nextQuestion,
    ]);
    await tester.tap(find.byTooltip('暂停仪式'));
    await tester.pumpAndSettle();
    await _tap(tester, '查看此前解读');
    expect(find.text('塔罗对照报告。'), findsOneWidget);

    await tester.tap(find.byTooltip('新对话'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('会话历史'));
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsOneWidget);
    await _tap(tester, divinationFixtureDetails);
    expect(online.activeConversationId, firstConversation);
    expect(find.text(nextQuestion), findsOneWidget);
    expect(find.text('查看此前解读'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'an unrelated question stays in the conversation but starts without prior context',
    (tester) async {
      final service = DivinationServiceFixture()..failReport = false;
      final recovery = DivinationRecoveryFixture();
      final online = service.connect(recovery);
      addTearDown(online.dispose);
      await online.start(divinationFixtureDetails, automatic: true);
      await tester.pumpWidget(_app(online));
      await tester.pumpAndSettle();
      service.calls.clear();
      service.transmitted.clear();

      final originalConversation = online.activeConversationId;
      await _tap(tester, '另问一件事');
      expect(online.activeConversationId, originalConversation);
      expect(online.previousQuestion, isNull);
      expect(find.text('查看此前解读'), findsOneWidget);

      final restored = service.connect(recovery);
      addTearDown(restored.dispose);
      await tester.pumpWidget(_app(restored));
      await tester.pumpAndSettle();
      expect(service.calls, isEmpty);
      expect(restored.activeConversationId, originalConversation);
      expect(restored.previousQuestion, isNull);
      expect(find.byType(TextFormField), findsOneWidget);
      expect(find.text('查看此前解读'), findsOneWidget);

      const unrelatedQuestion = '下个月适合搬家吗？';
      await tester.enterText(find.byType(TextFormField), unrelatedQuestion);
      await _send(tester);
      expect(service.calls, ['POST /reading/understand', 'POST /reading']);
      for (final request in service.transmitted) {
        expect(request['question'], unrelatedQuestion);
        expect(request.containsKey('previousQuestion'), isFalse);
      }
      expect(restored.transcripts.single.id, originalConversation);
      expect(restored.transcripts.single.turns.map((turn) => turn.question), [
        divinationFixtureDetails,
        unrelatedQuestion,
      ]);
      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('新对话'));
      await tester.pumpAndSettle();
      expect(restored.activeConversationId, isNull);
      expect(find.text(unrelatedQuestion), findsNothing);
      const independentQuestion = '项目啥时候可以启动？';
      await tester.enterText(find.byType(TextFormField), independentQuestion);
      await _send(tester);
      expect(restored.transcripts, hasLength(2));
      expect(restored.activeConversationId, isNot(originalConversation));
      expect(restored.activeTranscript.single.question, independentQuestion);
      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('return to latest preserves reading position until requested', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 570));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final reply = Completer<void>();
    final service = DivinationServiceFixture()
      ..failReport = false
      ..followUpReply = reply.future
      ..longReport = true;
    final recovery = DivinationRecoveryFixture();
    final initial = service.connect(recovery);
    await initial.start(divinationFixtureDetails, automatic: true);
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

    await tester.enterText(
      find.byType(TextFormField),
      divinationFixtureFollowUp,
    );
    await tester.pump();
    await tester.tap(find.byTooltip('发送追问'));
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
    final service = DivinationServiceFixture()
      ..failReport = false
      ..extendedFollowUp = true;
    final base = Uri.https('fixture.invalid');
    GuideHistoryStore store(String owner) =>
        createReadingRecovery(base, ownerScope: 'member:$owner')
            as GuideHistoryStore;
    final recovery = store('owner');
    final initial = service.connect(recovery);
    await initial.start(divinationFixtureDetails, automatic: true);
    await initial.followUp(divinationFixtureFollowUp);
    await initial.nextQuestion(carryContext: false, newConversation: true);
    initial.dispose();
    final afterRestart = store('owner');
    expect(await afterRestart.read(), isNull);
    expect(await store('other').readHistory(), isEmpty);
    final archived = (await afterRestart.readHistory()).single.reading;
    expect(archived.followUps.single.question, divinationFixtureFollowUp);
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
    await _tap(tester, divinationFixtureDetails);
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
    expect(opened, divinationFixtureEvidenceUrl);
    await _tap(tester, '复制参考链接');
    expect(copied, divinationFixtureEvidenceUrl);
    expect(service.calls, ['GET /reading']);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a question finishing on a different main tab waits in its chat',
    (tester) async {
      final understanding = Completer<void>();
      final online =
          (DivinationServiceFixture()..understanding = understanding.future)
              .connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        JovianApp(initialTab: JovianTab.divination, onlineGuide: online),
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField),
        divinationFixtureDetails,
      );
      await tester.pump();
      await tester.tap(find.byTooltip('发送消息'));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey(JovianTab.messages)));
      await tester.pump();

      understanding.complete();
      await tester.pumpAndSettle();
      final tarot = find.text('第 1 步 · 塔罗选牌');
      expect(tarot, findsNothing);
      await tester.tap(find.byKey(const ValueKey(JovianTab.divination)));
      await tester.pumpAndSettle();
      await _tap(tester, '继续本次仪式');
      expect(tarot, findsOneWidget);
      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
    },
  );
}

class _PausedTranscriptWrite extends DivinationRecoveryFixture {
  _PausedTranscriptWrite(this.writing, this.release);

  final Completer<void> writing;
  final Future<void> release;

  @override
  Future<void> writeTranscriptTurn(GuideTranscriptTurn turn) async {
    writing.complete();
    await release;
    await super.writeTranscriptTurn(turn);
  }
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

Future<void> _send(WidgetTester tester, {String label = '发送消息'}) async {
  await tester.pump();
  await tester.tap(find.byTooltip(label));
  await tester.pumpAndSettle();
}

Future<void> _openAttachmentMenu(WidgetTester tester, String label) async {
  await tester.tap(find.byTooltip('添加附件或快捷提问'));
  await tester.pumpAndSettle();
  await _tap(tester, label);
}
