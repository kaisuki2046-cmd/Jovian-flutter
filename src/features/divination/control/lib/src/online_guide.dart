import 'dart:async';
import 'dart:math';

import 'package:jovian_divination_model/iching.dart' show Hexagram;
import 'package:jovian_divination_model/pro_report.dart';

import 'guide_ritual.dart';
import 'guide_transcript.dart';
import 'meihua.dart';
import 'tarot.dart';

typedef ReadingConfirmation = ({
  String focus,
  String clarification,
  String? proof,
  bool chatOnly,
});
typedef OpenedReading = ({String token, OnlineReading reading});
typedef ReadingFollowUp = ({
  String question,
  String answer,
  String? explanation,
  List<String> nextSteps,
  List<String> evidenceIds,
});
typedef ReadingEvidence = ({
  String id,
  String label,
  String plain,
  String source,
  int? catalogVersion,
});

enum LegacyGuideMethod { combined, tarot, liuyao, meihua }

typedef LegacyLiuYaoChart = ({
  Hexagram primary,
  Hexagram changed,
  List<int> moving,
  String? interpretation,
});

typedef LegacyGuideArchive = ({
  String id,
  DateTime updatedAt,
  String question,
  String focus,
  LegacyGuideMethod method,
  ReadingFollowUp? report,
  String? reportSource,
  List<ReadingFollowUp> followUps,
  List<ReadingEvidence> evidence,
  TarotDraw? tarot,
  LegacyLiuYaoChart? liuyao,
  MeihuaReading? meihua,
});

abstract interface class LegacyGuideArchiveStore {
  Future<List<LegacyGuideArchive>> readLegacyArchives();
}

class OnlineReading {
  const OnlineReading(
    this.snapshot, {
    this.report,
    this.followUps = const [],
    this.evidence = const [],
  });
  final GuideRitualSnapshot snapshot;
  final ProReport? report;
  final List<ReadingFollowUp> followUps;
  final List<ReadingEvidence> evidence;

  factory OnlineReading.fromJson(Map<String, Object?> value) {
    final snapshot = parseGuideSnapshot(value);
    final rawReport = value['proReport'];
    final rawFollowUps = value['followUps'] as List;
    final rawEvidence = value['evidence'];
    if (snapshot.stage != GuideStage.reading &&
        (rawReport != null || rawFollowUps.isNotEmpty)) {
      throw const FormatException('Report before reading stage.');
    }
    return OnlineReading(
      snapshot,
      report: rawReport == null ? null : parseSavedProReport(rawReport),
      followUps: List.unmodifiable(
        rawFollowUps.map((item) {
          final entry = item as Map;
          final report = entry['report'] as Map;
          return (
            question: entry['question'] as String,
            answer: report['answer'] as String,
            explanation: switch (report['explanation']) {
              final String text when text.trim().isNotEmpty => text,
              _ => null,
            },
            nextSteps: List<String>.unmodifiable(
              (report['nextSteps'] as List).cast<String>(),
            ),
            evidenceIds: switch (report['evidenceIds']) {
              final List ids => List<String>.unmodifiable(
                ids.whereType<String>(),
              ),
              _ => const <String>[],
            },
          );
        }),
      ),
      evidence: rawEvidence is List
          ? List.unmodifiable([
              for (final item in rawEvidence)
                if (item case {
                  'id': final String id,
                  'label': final String label,
                  'plain': final String plain,
                  'source': final String source,
                })
                  (
                    id: id,
                    label: label,
                    plain: plain,
                    source: source,
                    catalogVersion: switch (item['catalogVersion']) {
                      final int version => version,
                      _ => null,
                    },
                  ),
            ])
          : const [],
    );
  }

  Map<String, Object?> toJson() => {
    ...snapshot.toChartSnapshotJson(),
    if (report case final report?) 'proReport': report.toJson(),
    'followUps': [
      for (final item in followUps)
        {
          'question': item.question,
          'report': {
            'answer': item.answer,
            if (item.explanation case final explanation?)
              'explanation': explanation,
            'nextSteps': item.nextSteps,
            if (item.evidenceIds.isNotEmpty) 'evidenceIds': item.evidenceIds,
          },
        },
    ],
    if (evidence.isNotEmpty)
      'evidence': [
        for (final item in evidence)
          {
            'id': item.id,
            'label': item.label,
            'plain': item.plain,
            'source': item.source,
            if (item.catalogVersion case final version?)
              'catalogVersion': version,
          },
      ],
  };
}

class ReadingConnectionError implements Exception {
  const ReadingConnectionError(this.code, {this.status});
  final String code;
  final int? status;
}

enum GuideAction { toss, pick }

class PendingGuideAction {
  PendingGuideAction(this.action, Map<String, Object?> body)
    : body = Map.unmodifiable(body);
  final GuideAction action;
  final Map<String, Object?> body;
}

class GuideRecovery {
  const GuideRecovery(this.token, [this.pending, this.threadId]);

  factory GuideRecovery.fromJson(Map<String, Object?> value) {
    final token = value['token'];
    if (token is! String || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      throw const FormatException('Invalid reading recovery token.');
    }
    final id = value['threadId'];
    final threadId = id is String && isGuideThreadId(id) ? id : null;
    final pending = value['pending'];
    if (pending == null) return GuideRecovery(token, null, threadId);
    if (pending is! Map || pending['body'] is! Map)
      throw const FormatException('Invalid pending reading action.');
    final action = switch (pending['action']) {
      'toss' => GuideAction.toss,
      'pick' => GuideAction.pick,
      _ => throw const FormatException('Invalid reading action.'),
    };
    return GuideRecovery(
      token,
      PendingGuideAction(action, (pending['body'] as Map).cast()),
      threadId,
    );
  }

  final String token;
  final PendingGuideAction? pending;
  final String? threadId;

  Map<String, Object?> toJson() => {
    'token': token,
    if (threadId != null) 'threadId': threadId,
    if (pending case final pending?)
      'pending': {'action': pending.action.name, 'body': pending.body},
  };
}

abstract interface class GuideRecoveryStore {
  Future<GuideRecovery?> read();
  Future<void> write(GuideRecovery? recovery);
}

bool isGuideThreadId(String id) => RegExp(r'^[a-z0-9-]{1,100}$').hasMatch(id);

typedef GuideHistoryEntry = ({
  String id,
  DateTime updatedAt,
  OnlineReading reading,
});

abstract interface class GuideHistoryStore implements GuideRecoveryStore {
  Future<List<GuideHistoryEntry>> readHistory();
  Future<void> writeHistory(GuideHistoryEntry entry);
  Future<GuideRecovery?> readThread(String id);
  Future<void> writeThread(String id, GuideRecovery? recovery);
}

abstract interface class GuideGateway {
  Future<ReadingConfirmation> understand(
    String question, {
    String? previousQuestion,
    Future<void>? cancel,
  });
  Future<OpenedReading> start(
    String question,
    String focus,
    String proof, {
    required bool automatic,
    String? previousQuestion,
  });
  Future<OnlineReading> get(String token);
  Future<OnlineReading> perform(String token, PendingGuideAction action);
  Future<OnlineReading> report(String token);
  Future<OnlineReading> followUp(String token, int step, String question);
}

class OnlineGuideController {
  OnlineGuideController(
    this._gateway,
    this._recovery, {
    void Function()? onDispose,
  }) : _onDispose = onDispose;

  final GuideGateway _gateway;
  final GuideRecoveryStore _recovery;
  final void Function()? _onDispose;
  final _changes = StreamController<void>.broadcast(sync: true);
  final _clock = Stopwatch()..start();
  final _history = <String, GuideHistoryEntry>{};
  final _transcriptTurns = <String, GuideTranscriptTurn>{};
  String? _conversationId;
  List<LegacyGuideArchive> _legacyArchives = const [];
  final _clockSession = guideEventId();
  String? _token;
  String? _threadId;
  PendingGuideAction? _pending;
  String? _clarificationQuestion;
  String? _previousQuestion;
  Completer<void>? _understanding;
  Future<void> Function()? _retry;
  OnlineReading? _reading;
  bool _busy = false;
  bool _questionStopped = false;
  String? _message;

  Stream<void> get changes => _changes.stream;
  OnlineReading? get reading => _reading;
  String? get activeHistoryId => _threadId;
  String? get previousQuestion => _previousQuestion;
  String? get activeConversationId => _conversationId;
  List<GuideTranscriptTurn> get activeTranscript =>
      _conversationId == null ? const [] : _conversationTurns(_conversationId!);
  List<GuideTranscript> get transcripts {
    final groups = <String, List<GuideTranscriptTurn>>{};
    for (final turn in _transcriptTurns.values) {
      groups.putIfAbsent(turn.conversationId, () => []).add(turn);
    }
    return [
      for (final group in groups.entries)
        (id: group.key, turns: group.value..sort(_compareTurns)),
    ];
  }

  OnlineReading? archivedReading(String id) => _history[id]?.reading;
  bool get canContinue => _token != null;
  List<LegacyGuideArchive> get legacyArchives => _legacyArchives;
  List<GuideHistoryEntry> get history =>
      _history.values.toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  bool get busy => _busy;
  String? get message => _message;
  bool get canRetry => _retry != null;
  bool get canStopUnderstanding => _understanding != null;
  bool get questionStopped => _questionStopped;

  GuideHistoryStore? get _historyStore => switch (_recovery) {
    final GuideHistoryStore store => store,
    _ => null,
  };

  GuideTranscriptStore? get _transcriptStore => switch (_recovery) {
    final GuideTranscriptStore store => store,
    _ => null,
  };

  Future<void> restore() => _run(() async {
    final history = await _historyStore?.readHistory();
    if (history != null)
      _history.addEntries(history.map((entry) => MapEntry(entry.id, entry)));
    if (_recovery case final LegacyGuideArchiveStore store) {
      _legacyArchives = List.unmodifiable(await store.readLegacyArchives());
    }
    final composing = await _restoreTranscript();
    final recovered = await _recovery.read();
    if (recovered == null) {
      if (activeTranscript.lastOrNull?.readingId case final id?
          when !composing) {
        _threadId = id;
        _reading = _history[id]?.reading;
      }
      return;
    }
    _threadId = recovered.threadId ?? guideEventId();
    _conversationId = _conversationForReading(_threadId!) ?? _conversationId;
    _reading = _history[_threadId]?.reading;
    await _resume(recovered);
  }, revisiting: true);

  Future<bool> _restoreTranscript() async {
    final store = _transcriptStore;
    if (store == null) return false;
    for (final turn in await store.readTranscriptTurns()) {
      _transcriptTurns.putIfAbsent(turn.id, () => turn);
    }
    final position = await store.readTranscriptPosition();
    _conversationId = position?.id;
    _previousQuestion = position?.previousQuestion;
    _clarificationQuestion = activeTranscript.lastOrNull?.clarificationQuestion;
    return position?.composing ?? false;
  }

  Future<void> openConversation(String id) => _run(() async {
    final turns = _conversationTurns(id);
    if (id == _conversationId || turns.isEmpty) return;
    _conversationId = id;
    final last = turns.last;
    final readingId = last.readingId;
    if (readingId != null && _history.containsKey(readingId)) {
      _previousQuestion = null;
      await _openSavedReading(readingId);
      return;
    }
    _threadId = null;
    _token = null;
    _pending = null;
    _reading = null;
    _clarificationQuestion = last.clarificationQuestion;
    _previousQuestion = last.previousQuestion;
    await _save();
    await _saveTranscriptPosition();
  }, revisiting: true);

  Future<void> openHistory(String id) => _run(() async {
    if (!_history.containsKey(id) || id == _threadId) return;
    _conversationId = null;
    _previousQuestion = null;
    await _openSavedReading(id);
  }, revisiting: true);

  Future<void> _openSavedReading(String id) async {
    _threadId = id;
    _reading = _history[id]!.reading;
    _token = null;
    _pending = null;
    _previousQuestion = null;
    _clarificationQuestion = null;
    _emit();
    await _saveTranscriptPosition();
    final cache = _historyStore;
    final recovered = cache == null
        ? _memoryRecovery[id]
        : await cache.readThread(id);
    if (recovered == null) {
      _message = '此历史记录可回看，继续算事请开启新对话。';
      await _save();
    } else {
      await _resume(recovered);
    }
  }

  final _memoryRecovery = <String, GuideRecovery>{};

  Future<void> _resume(GuideRecovery recovered) async {
    _token = recovered.token;
    _pending = recovered.pending;
    if (_pending != null) {
      await _sendPending(refresh: true);
    } else {
      _reading = await _gateway.get(recovered.token);
      await _save();
    }
  }

  Future<void> start(String text, {required bool automatic}) {
    final combined = _clarificationQuestion == null
        ? text
        : '$_clarificationQuestion；补充：$text';
    final question = combined.length <= guideQuestionMaxLength
        ? combined
        : text;
    final previous = _previousQuestion;
    GuideTranscriptTurn? pendingTurn;
    return _run(() async {
      final turn = pendingTurn ??= await _recordTurn(text);
      if (_changes.isClosed) return;
      final understood = await _understand(question, previous);
      if (understood == null) {
        _questionStopped = true;
        _message = '已停止，问题已恢复到输入框。';
        return;
      }
      if (understood.clarification.isNotEmpty) {
        _clarificationQuestion = understood.chatOnly ? null : question;
        _message = understood.clarification;
        await _finishTurn(turn, reply: understood.clarification);
        return;
      }
      final proof = understood.proof;
      if (proof == null) throw const ReadingConnectionError('invalid_response');
      final started = await _gateway.start(
        question,
        understood.focus,
        proof,
        automatic: automatic,
        previousQuestion: previous,
      );
      _token = started.token;
      _threadId = guideEventId();
      _pending = null;
      _reading = started.reading;
      _clarificationQuestion = null;
      _previousQuestion = null;
      await _save();
      await _finishTurn(turn, readingId: _threadId);
      _emit();
      await _reportIfReady();
    });
  }

  Future<ReadingConfirmation?> _understand(
    String question,
    String? previous,
  ) async {
    final stopped = Completer<void>();
    _understanding = stopped;
    _emit();
    try {
      final result = await Future.any<ReadingConfirmation?>([
        _gateway.understand(
          question,
          previousQuestion: previous,
          cancel: stopped.future,
        ),
        stopped.future.then((_) => null),
      ]);
      return stopped.isCompleted ? null : result;
    } on ReadingConnectionError {
      if (!stopped.isCompleted) rethrow;
      return null;
    } finally {
      _understanding = null;
      _emit();
    }
  }

  void stopUnderstanding() {
    if (_understanding case final stopped? when !stopped.isCompleted) {
      stopped.complete();
    }
  }

  Future<void> toss() {
    final state = _reading?.snapshot;
    if (_busy || _token == null || state?.stage != GuideStage.cast)
      return Future.value();
    return _act(
      PendingGuideAction(
        GuideAction.toss,
        GuideCoinEvent(
          actionId: guideEventId(),
          step: state!.tosses.length,
        ).toJson(),
      ),
    );
  }

  Future<void> pick(int slot) {
    final state = _reading?.snapshot;
    if (_busy ||
        _token == null ||
        state?.stage != GuideStage.draw ||
        state!.selectedSlots.contains(slot)) {
      return Future.value();
    }
    return _act(
      PendingGuideAction(
        GuideAction.pick,
        GuideCardEvent(
          actionId: guideEventId(),
          step: state.selectedSlots.length,
          slot: slot,
          epochMs: DateTime.now().millisecondsSinceEpoch.toString(),
          monotonicMs: _clock.elapsedMicroseconds / 1000,
          clockSessionId: _clockSession,
        ).toJson(),
      ),
    );
  }

  Future<void> requestReport() => _run(_reportIfReady);

  Future<void> followUp(String question) {
    final step = _reading?.followUps.length;
    final token = _token;
    if (token == null || step == null || _reading?.report == null)
      return Future.value();
    return _run(() async {
      _reading = await _gateway.followUp(token, step, question);
    });
  }

  Future<void> nextQuestion({
    bool carryContext = true,
    bool newConversation = false,
  }) => _run(() async {
    final priorQuestion = _reading?.snapshot.question;
    if (newConversation) {
      _conversationId = null;
    } else if (priorQuestion != null && _threadId != null) {
      _conversationId ??= _conversationForReading(_threadId!);
      if (_conversationId == null) {
        await _recordTurn(priorQuestion, readingId: _threadId);
      }
    }
    _previousQuestion = carryContext && !newConversation ? priorQuestion : null;
    _token = null;
    _threadId = null;
    _pending = null;
    _reading = null;
    _clarificationQuestion = null;
    await _save();
    await _saveTranscriptPosition();
  });

  List<GuideTranscriptTurn> _conversationTurns(String id) =>
      _transcriptTurns.values
          .where((turn) => turn.conversationId == id)
          .toList()
        ..sort(_compareTurns);

  String? _conversationForReading(String id) => _transcriptTurns.values
      .where((turn) => turn.readingId == id)
      .firstOrNull
      ?.conversationId;

  Future<GuideTranscriptTurn> _recordTurn(
    String question, {
    String? readingId,
  }) async {
    final prior = activeTranscript.lastOrNull;
    if (readingId == null &&
        prior != null &&
        prior.reply == null &&
        prior.readingId == null &&
        prior.question == question) {
      return prior;
    }
    final id = _conversationId ??= guideEventId();
    final previousTime = prior?.sentAt;
    final now = DateTime.now();
    final turn = (
      id: guideEventId(),
      conversationId: id,
      sentAt: previousTime != null && !now.isAfter(previousTime)
          ? previousTime.add(const Duration(microseconds: 1))
          : now,
      question: question,
      reply: null,
      clarificationQuestion: readingId == null ? _clarificationQuestion : null,
      previousQuestion: _previousQuestion,
      readingId: readingId,
    );
    await _saveTranscriptTurn(turn);
    return turn;
  }

  Future<void> _finishTurn(
    GuideTranscriptTurn turn, {
    String? reply,
    String? readingId,
  }) => _saveTranscriptTurn((
    id: turn.id,
    conversationId: turn.conversationId,
    sentAt: turn.sentAt,
    question: turn.question,
    reply: reply,
    clarificationQuestion: readingId == null ? _clarificationQuestion : null,
    previousQuestion: turn.previousQuestion,
    readingId: readingId,
  ));

  Future<void> _saveTranscriptTurn(GuideTranscriptTurn turn) async {
    if (_changes.isClosed) return;
    _transcriptTurns[turn.id] = turn;
    await _transcriptStore?.writeTranscriptTurn(turn);
    await _saveTranscriptPosition();
  }

  Future<void> _saveTranscriptPosition() async {
    if (_changes.isClosed) return;
    final id = _conversationId;
    await _transcriptStore?.writeTranscriptPosition(
      id == null
          ? null
          : (
              id: id,
              previousQuestion: _previousQuestion,
              composing: _threadId == null,
            ),
    );
  }

  Future<void> retry() => _retry == null ? Future.value() : _run(_retry!);

  Future<void> _act(PendingGuideAction event) {
    final replay = _pending != null;
    _pending ??= event;
    return _run(() async {
      _retry = () => _sendPending(refresh: true);
      await _sendPending(refresh: replay);
    });
  }

  Future<void> _sendPending({required bool refresh}) async {
    final token = _token!;
    final event = _pending!;
    await _save();
    try {
      final next = await _gateway.perform(token, event);
      _reading = refresh ? await _gateway.get(token) : next;
    } on ReadingConnectionError catch (error) {
      if (error.status != 409) rethrow;
      _reading = await _gateway.get(token);
    }
    _pending = null;
    await _save();
    _emit();
    await _reportIfReady();
  }

  Future<void> _reportIfReady() async {
    if (_token == null ||
        _reading?.snapshot.stage != GuideStage.reading ||
        _reading?.report != null)
      return;
    _retry = _reportIfReady;
    _reading = await _gateway.report(_token!);
  }

  Future<void> _save() async {
    if (_changes.isClosed) return;
    final id = _threadId;
    final record = _token == null ? null : GuideRecovery(_token!, _pending, id);
    await _recovery.write(record);
    if (id == null || _changes.isClosed) return;
    if (_historyStore case final store?) {
      await store.writeThread(id, record);
    } else if (record != null) {
      _memoryRecovery[id] = record;
    } else {
      _memoryRecovery.remove(id);
    }
  }

  Future<void> _run(
    Future<void> Function() action, {
    bool revisiting = false,
  }) async {
    if (_busy || _changes.isClosed) return;
    final previous = _reading;
    _busy = true;
    _questionStopped = false;
    _message = null;
    _retry = action;
    _emit();
    try {
      await action();
      _retry = null;
    } on ReadingConnectionError catch (error) {
      if (error.status == 404 && _token != null) {
        _token = null;
        _pending = null;
        _retry = null;
        await _save();
      }
      _message = _errorMessage(error);
    } finally {
      if (_threadId case final id? when !_changes.isClosed) {
        final reading = _reading;
        if (reading != null && !identical(previous, reading)) {
          final record = (
            id: id,
            updatedAt: revisiting
                ? _history[id]?.updatedAt ?? DateTime.now()
                : DateTime.now(),
            reading: reading,
          );
          _history[id] = record;
          await _historyStore?.writeHistory(record);
        }
      }
      _busy = false;
      _emit();
    }
  }

  void _emit() {
    if (!_changes.isClosed) _changes.add(null);
  }

  void dispose() {
    if (_changes.isClosed) return;
    stopUnderstanding();
    unawaited(_changes.close());
    _onDispose?.call();
  }
}

int _compareTurns(GuideTranscriptTurn a, GuideTranscriptTurn b) {
  final order = a.sentAt.compareTo(b.sentAt);
  return order == 0 ? a.id.compareTo(b.id) : order;
}

String _errorMessage(ReadingConnectionError error) => switch (error.status) {
  400 when error.code == 'question_needs_model_confirmation' =>
    '问题确认已过期，请重试确认。',
  400 => '服务器未接受这次输入，请核对后重试。',
  401 => '当前账号会话无法验证，请重新登录后重试。',
  404 => '这次算事已过期，可以发起新问题。',
  428 => '请在隐私设置中开启 AI 数据共享授权后重试。',
  429 => '操作太频繁，请稍后再试。',
  502 => '解读格式不完整，盘面已保存，可以重试。',
  503 when error.code == 'question_model_unavailable' => '暂时无法理解这条问题，请恢复连接后重试。',
  503 => '解读暂不可用，可以稍后重试。',
  504 => '算事服务响应超时，请重试。',
  _ => error.code == 'timeout' ? '算事服务响应超时，请重试。' : '暂时未能连接算事服务，请重试。',
};

final _secureRandom = Random.secure();

String guideEventId() {
  final bytes = List.generate(16, (_) => _secureRandom.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
