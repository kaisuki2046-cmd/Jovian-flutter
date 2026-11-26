import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/rendering.dart';
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
import '../src/features/divination/view/guide_form.dart';
import '../src/shared/http/json_client.dart';

const _question = '这件事如何推进？';
const _details = '我想问这周面试后续会怎样。';
const _explained = '可以补充一下正在考虑的具体事情吗？';
const _concern = '梳理这次面试的后续安排。';
const _followUp = '我接下来该准备什么？';

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

  testWidgets('history keeps cached reports after the server task expires', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
    final service = _ReadingService()..failReport = false;
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
    expect(
      (await afterRestart.readHistory())
          .single
          .reading
          .followUps
          .single
          .question,
      _followUp,
    );
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
    expect(find.text('这次算事已过期，可以发起新问题。'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
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
  Future<void>? understanding;
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
        _followUps.add({
          'question': _followUp,
          'report': {
            'answer': '先确认后续时间。',
            'nextSteps': ['整理面试问题。'],
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
    if (_hasReport)
      'proReport': {
        'tarot': '塔罗对照报告。',
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
