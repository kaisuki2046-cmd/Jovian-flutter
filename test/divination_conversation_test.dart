import 'dart:convert';

import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/requests/reading_gateway.dart';
import '../src/features/divination/view/divination_page.dart';
import '../src/shared/http/json_client.dart';

const _question = '这件事如何推进？';
const _details = '我想问这周面试后续会怎样。';
const _explained = '可以补充一下正在考虑的具体事情吗？';
const _concern = '梳理这次面试的后续安排。';
const _followUp = '我接下来该准备什么？';

void main() {
  testWidgets(
    'online conversation uses the existing reading contract at 320 pixels',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 680);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final service = _ReadingService();
      final recovery = _Recovery();
      final online = service.connect(recovery);
      addTearDown(online.dispose);
      await tester.pumpWidget(_app(online));
      await tester.pumpAndSettle();

      expect(find.text('综合起盘'), findsOneWidget);
      expect(find.text('梅花易数'), findsOneWidget);
      expect(find.text('六爻'), findsOneWidget);
      await _tap(tester, '梅花易数');
      expect(find.text('用这三个数起卦'), findsOneWidget);
      await _tap(tester, '六爻');
      expect(find.text('投三枚铜钱'), findsOneWidget);
      await _tap(tester, '综合算事');
      await tester.enterText(find.byType(TextFormField), _question);
      await _tap(tester, '自动起盘');
      expect(find.text(_question), findsOneWidget);
      expect(find.text(_explained), findsOneWidget);
      expect(service.calls, ['POST /reading/understand']);

      await tester.enterText(find.byType(TextFormField), _details);
      await _tap(tester, '自动起盘');
      expect(find.text('确认的关注点'), findsOneWidget);
      expect(find.text(_concern), findsOneWidget);
      expect(find.text('解读暂不可用，可以稍后重试。'), findsOneWidget);
      expect(find.text('翻开三张塔罗'), findsOneWidget);
      await _tap(tester, '重试');
      expect(find.text('综合解读'), findsOneWidget);
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('查看盘面'), findsOneWidget);
      expect(service.understood.last, '$_question；补充：$_details');
      expect(service.calls.where((call) => call == 'POST /reading').length, 1);
      expect(
        service.calls.where((call) => call == 'POST /reading/report').length,
        2,
      );

      final compose = find.byType(TextFormField);
      await tester.ensureVisible(compose);
      await tester.enterText(compose, _followUp);
      await _tap(tester, '发送追问');
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
      expect(find.text('综合起盘'), findsOneWidget);
      expect(find.text(_details), findsNothing);

      await tester.tap(find.byTooltip('会话记录'));
      await tester.pumpAndSettle();
      expect(find.text('本次会话记录'), findsOneWidget);
      await _tap(tester, '$_question；补充：$_details');
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text('先确认后续时间。'), findsOneWidget);
      expect(find.text('发送追问'), findsNothing);
      expect(
        service.calls.where((call) => call == 'POST /reading/follow-up').length,
        1,
      );
      final other = _ReadingService().connect(_Recovery());
      addTearDown(other.dispose);
      await tester.pumpWidget(_app(other));
      await tester.pumpAndSettle();
      expect(find.text('先确认后续时间。'), findsNothing);
      await tester.tap(find.byTooltip('会话记录'));
      await tester.pumpAndSettle();
      expect(find.text('本次会话暂无已完成的解读。'), findsOneWidget);
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

class _Recovery implements GuideRecoveryStore {
  GuideRecovery? state;

  @override
  Future<GuideRecovery?> read() async => state;

  @override
  Future<void> write(GuideRecovery? recovery) async => state = recovery;
}

class _ReadingService {
  String get _token => 'a' * 43;
  bool failReport = true;
  final understood = <String>[];
  final calls = <String>[];
  GuideRitual? _ritual;
  bool _hasReport = false;
  final _followUps = <Map<String, Object?>>[];

  OnlineGuideController connect(_Recovery recovery) {
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
    if (call != 'POST /reading/understand' && call != 'POST /reading') {
      expect(request.headers['Authorization'], 'Bearer $_token');
    }
    switch (call) {
      case 'POST /reading/understand':
        expect(body['requireModel'], true);
        final question = body['question'] as String;
        understood.add(question);
        return _json({
          'source': 'model',
          'focus': _concern,
          'clarification': question == _question ? _explained : '',
          if (question != _question) 'proof': 'accepted-proof',
        });
      case 'POST /reading':
        expect(body['method'], 'combined');
        expect(body['profile'], guideVersion);
        expect(body['focus'], _concern);
        expect(body['proof'], 'accepted-proof');
        expect(body['automatic'], true);
        _ritual = GuideRitual(
          question: body['question'] as String,
          focus: _concern,
          automatic: true,
          random: () => 0.3,
        );
        return _json({'token': _token, 'task': _state()});
      case 'GET /reading':
        return _json(_state());
      case 'POST /reading/report':
        if (failReport) {
          failReport = false;
          return _json({'error': 'pro_model_unavailable'}, status: 503);
        }
        _hasReport = true;
        return _json(_state());
      case 'POST /reading/follow-up':
        expect(body, {'step': 0, 'question': _followUp});
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
