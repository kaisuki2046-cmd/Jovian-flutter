import 'dart:convert';
import 'dart:io';

import '../lib/jovian_divination.dart';

const _question = '这次面试后续会怎样？';
final _token = 'a' * 43;

class _Recovery implements GuideRecoveryStore {
  String? _value;

  @override
  Future<GuideRecovery?> read() async => _value == null
      ? null
      : GuideRecovery.fromJson((jsonDecode(_value!) as Map).cast());

  @override
  Future<void> write(GuideRecovery? recovery) async =>
      _value = recovery == null ? null : jsonEncode(recovery.toJson());
}

class _MockGateway implements GuideGateway {
  GuideRitual? ritual;
  var failToss = false;
  var failReport = false;
  var starts = 0;
  var reports = 0;
  final actions = <String>[];
  ProReport? savedReport;

  OnlineReading _snapshot() => OnlineReading(
    parseGuideSnapshot(
      (jsonDecode(jsonEncode(ritual!.snapshot.toChartSnapshotJson())) as Map)
          .cast(),
    ),
    report: savedReport,
  );

  @override
  Future<ReadingConfirmation> understand(
    String question, {
    String? previousQuestion,
    Future<void>? cancel,
  }) async =>
      (focus: '面试后续', clarification: '', proof: 'verified', chatOnly: false);

  @override
  Future<OpenedReading> start(
    String question,
    String focus,
    String proof, {
    required bool automatic,
    String? previousQuestion,
  }) async {
    starts++;
    ritual = GuideRitual(
      question: question,
      focus: focus,
      automatic: automatic,
      random: () => 0.3,
    );
    return (token: _token, reading: _snapshot());
  }

  @override
  Future<OnlineReading> get(String token) async => _snapshot();

  @override
  Future<OnlineReading> perform(String token, PendingGuideAction action) async {
    final body = action.body;
    final id = body['actionId'] as String;
    actions.add(id);
    final snapshot = ritual!.toss(
      GuideCoinEvent(actionId: id, step: body['step'] as int),
    );
    if (failToss) {
      failToss = false;
      throw const ReadingConnectionError('network');
    }
    return OnlineReading(snapshot);
  }

  @override
  Future<OnlineReading> report(String token) async {
    reports++;
    if (failReport) {
      failReport = false;
      throw const ReadingConnectionError(
        'pro_model_invalid_output',
        status: 502,
      );
    }
    savedReport = parseSavedProReport({
      'tarot': '塔罗报告。',
      'meihua': '梅花易数报告。',
      'liuyao': '六爻报告。',
    });
    return _snapshot();
  }

  @override
  Future<OnlineReading> followUp(String token, int step, String question) =>
      throw StateError('Unexpected follow-up in this test.');
}

void check(bool value, String text) {
  if (!value) throw StateError(text);
}

Future<void> main() async {
  final storage = _Recovery();
  final gateway = _MockGateway()..failToss = true;
  final first = OnlineGuideController(gateway, storage);
  await first.start(_question, automatic: false);
  await first.toss();
  check(
    first.canRetry && first.reading!.snapshot.tosses.isEmpty,
    'Lost response was not recoverable.',
  );
  final pending = (await storage.read())?.pending;
  check(
    pending?.body['actionId'] == gateway.actions.single,
    'The pending action was not saved before sending.',
  );
  first.dispose();
  final restored = OnlineGuideController(gateway, storage);
  try {
    await restored.restore();
    check(
      gateway.actions.length == 2 &&
          gateway.actions.first == gateway.actions.last,
      'Restoration changed the action ID.',
    );
    check(
      restored.reading!.snapshot.tosses.length == 1 &&
          (await storage.read())?.pending == null,
      'Restoration repeated the toss or retained the completed action.',
    );
  } finally {
    restored.dispose();
  }

  final automatic = _MockGateway()..failReport = true;
  final online = OnlineGuideController(automatic, _Recovery());
  try {
    await online.start(_question, automatic: true);
    check(
      automatic.starts == 1 &&
          automatic.reports == 1 &&
          online.canRetry &&
          online.reading?.snapshot.stage == GuideStage.reading,
      'Model failure discarded the finished chart.',
    );
    final hash = online.reading!.snapshot.chart!.chartHash;
    await online.retry();
    check(
      automatic.starts == 1 &&
          automatic.reports == 2 &&
          online.reading?.report != null &&
          online.reading?.snapshot.chart?.chartHash == hash,
      'Report retry created another reading.',
    );
  } finally {
    online.dispose();
  }
  stdout.writeln(
    'Online controller passed lost-response recovery and report retry without recasting.',
  );
}
