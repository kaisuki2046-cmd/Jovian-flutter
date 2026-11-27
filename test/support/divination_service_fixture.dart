import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_divination/jovian_divination.dart';

import '../../src/features/divination/requests/reading_gateway.dart';
import '../../src/features/divination/requests/reading_history_codec.dart';
import '../../src/shared/http/json_client.dart';

const divinationFixtureQuestion = '这件事如何推进？';
const divinationFixtureDetails = '我想问这周面试后续会怎样。';
const divinationFixtureClarification = '可以补充一下正在考虑的具体事情吗？';
const divinationFixtureFocus = '梳理这次面试的后续安排。';
const divinationFixtureFollowUp = '我接下来该准备什么？';
const divinationFixtureEvidenceUrl =
    'https://en.wikisource.org/wiki/Jovian_fixture';

class DivinationRecoveryFixture
    implements GuideHistoryStore, GuideTranscriptStore {
  GuideRecovery? state;
  final _reads = <String, String>{};
  final _threads = <String, GuideRecovery?>{};
  final _transcript = <String, GuideTranscriptTurn>{};
  GuideTranscriptPosition? _position;

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

  @override
  Future<List<GuideTranscriptTurn>> readTranscriptTurns() async =>
      _transcript.values.toList();

  @override
  Future<GuideTranscriptPosition?> readTranscriptPosition() async => _position;

  @override
  Future<void> writeTranscriptTurn(GuideTranscriptTurn turn) async =>
      _transcript[turn.id] = turn;

  @override
  Future<void> writeTranscriptPosition(
    GuideTranscriptPosition? position,
  ) async => _position = position;
}

class DivinationServiceFixture {
  String get _token => 'a' * 43;
  bool failReport = true;
  bool supportsTarotFirst = true;
  bool denyUnderstandingPermission = false;
  bool expired = false;
  bool extendedFollowUp = false;
  bool longReport = false;
  Map<String, Object?>? reportPayload;
  int? losePickResponseAtStep;
  Future<void>? understanding;
  Future<void>? followUpReply;
  Future<void>? pickReply;
  bool failNextPick = false;
  final understood = <String>[];
  final calls = <String>[];
  final startFailures = <({int status, String code})>[];
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
        if (denyUnderstandingPermission) {
          return _json({'error': 'ai_permission_required'}, status: 428);
        }
        return _json({
          'source': 'model',
          'focus': divinationFixtureFocus,
          'clarification': question == divinationFixtureQuestion
              ? divinationFixtureClarification
              : '',
          if (question != divinationFixtureQuestion) 'proof': 'accepted-proof',
        });
      case 'POST /reading':
        expectSync(body['method'], 'combined');
        expectSync(body['profile'], guideVersion);
        expectSync(body['focus'], divinationFixtureFocus);
        expectSync(body['proof'], 'accepted-proof');
        if (startFailures.isNotEmpty) {
          final failure = startFailures.removeAt(0);
          return _json({'error': failure.code}, status: failure.status);
        }
        automatic.add(body['automatic'] == true);
        _hasReport = false;
        _followUps.clear();
        _ritual = GuideRitual(
          question: body['question'] as String,
          focus: divinationFixtureFocus,
          automatic: automatic.last,
          tarotFirst: supportsTarotFirst && body['tarotFirst'] == true,
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
        await pickReply;
        if (failNextPick) {
          failNextPick = false;
          return _json({'error': 'timeout'}, status: 504);
        }
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
        if (losePickResponseAtStep == body['step']) {
          losePickResponseAtStep = null;
          return _json({'error': 'report_model_unavailable'}, status: 503);
        }
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
        expectSync(body, {'step': 0, 'question': divinationFixtureFollowUp});
        await followUpReply;
        _followUps.add({
          'question': divinationFixtureFollowUp,
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
          'source': divinationFixtureEvidenceUrl,
          'catalogVersion': 1,
        },
        {
          'id': 'meihua:v1:unrelated',
          'label': '未引用文献',
          'plain': '这是未引用的说明。',
          'source': divinationFixtureEvidenceUrl,
          'catalogVersion': 1,
        },
      ],
    if (_hasReport)
      'proReport':
          reportPayload ??
          {
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
