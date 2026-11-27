import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';

import 'reading_history_codec.dart';

const legacyGuideHistoryPrefix = 'jovian.divination.history.v2.';

String? legacyGuideOwner(String? scope) {
  if (scope == null) return null;
  final separator = scope.indexOf(':');
  if (separator <= 0 || separator == scope.length - 1) return null;
  final kind = scope.substring(0, separator);
  if (kind != 'member' && kind != 'guest') return null;
  final id = scope.substring(separator + 1);
  return '$kind.${id.runes.map((rune) => rune.toRadixString(16)).join('_')}';
}

GuideRecovery? decodeLegacyGuideRecovery(
  String? recovery,
  String? pending,
  int messageId,
) {
  final saved = _read(() => jsonDecode(recovery ?? 'null'));
  if (saved is! Map || saved['tokens'] is! Map) return null;
  final token = (saved['tokens'] as Map)['$messageId'];
  if (token is! String || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
    return null;
  }
  final event = _read(() => jsonDecode(pending ?? 'null'));
  if (event is! Map || event['token'] != token || event['action'] is! Map) {
    return GuideRecovery(token);
  }
  final action = event['action'] as Map;
  final body = action.length == 1 ? action.values.single : null;
  final replay = switch ((action.keys.firstOrNull, body)) {
    ('toss', {'actionId': final String id, 'step': final int step})
        when isGuideThreadId(id) && step >= 0 && step < 6 =>
      PendingGuideAction(GuideAction.toss, body as Map<String, Object?>),
    (
      'pick',
      {
        'actionId': final String id,
        'step': final int step,
        'slot': final int slot,
        'epochMs': String _,
        'monotonicMs': num _,
        'clockSessionId': final String clock,
      },
    )
        when isGuideThreadId(id) &&
            isGuideThreadId(clock) &&
            step >= 0 &&
            step < 3 &&
            slot >= 0 &&
            slot < 78 =>
      PendingGuideAction(GuideAction.pick, body as Map<String, Object?>),
    _ => null,
  };
  return GuideRecovery(token, replay);
}

const _legacyMethods = {
  'tarot-liuyao-meihua-v1': LegacyGuideMethod.combined,
  'rws-three-card-v1': LegacyGuideMethod.tarot,
  'three-coin-v1': LegacyGuideMethod.liuyao,
  'three-number-v1': LegacyGuideMethod.meihua,
};

// RN limits each saved conversation to the newest 40 messages.
const _legacyMessageLimit = 40;
const _largestSafeInteger = 9007199254740991;

Iterable<LegacyGuideConversation> decodeLegacyGuideConversations(
  String? saved,
) sync* {
  if (saved == null) return;
  final data = _read(() => jsonDecode(saved));
  if (data case {'threads': final List threads}) {
    final threadIds = <String>{};
    for (final thread in threads) {
      if (thread case {
        'id': final String chatId,
        'updatedAt': final num updatedAt,
        'messages': final List rawMessages,
      } when isGuideThreadId(chatId) && threadIds.add(chatId)) {
        final time = _milliseconds(updatedAt);
        if (time == null) continue;
        final messages = <LegacyGuideMessage>[];
        final messageIds = <int>{};
        final start = rawMessages.length > _legacyMessageLimit
            ? rawMessages.length - _legacyMessageLimit
            : 0;
        for (final raw in rawMessages.skip(start)) {
          if (raw is! Map<String, Object?>) continue;
          if (raw case {
            'id': final int id,
          } when id.abs() <= _largestSafeInteger && messageIds.add(id)) {
            if (_message(chatId, id, raw, time) case final entry?) {
              messages.add(entry);
            }
          }
        }
        if (messages.isNotEmpty) {
          yield (
            id: 'rn-$chatId',
            title: _title(thread['title'], messages),
            updatedAt: time,
            messages: List.unmodifiable(messages),
          );
        }
      }
    }
  }
}

LegacyGuideMessage? _message(
  String chatId,
  int id,
  Map<String, Object?> raw,
  DateTime threadTime,
) {
  final kind = switch (raw['kind']) {
    'user' => LegacyGuideMessageKind.user,
    'guidance' || 'prompt' => LegacyGuideMessageKind.assistant,
    'preview' => LegacyGuideMessageKind.preview,
    'readingQuestion' => LegacyGuideMessageKind.question,
    'readingSession' => LegacyGuideMessageKind.reading,
    _ => null,
  };
  if (kind == null) return null;
  final sentAt = _milliseconds(raw['sentAt']);

  String? focus;
  String? error;
  final names = <String>[];
  GuideHistoryEntry? reading;
  LegacyGuideArchive? archive;
  final String? text;

  switch (kind) {
    case LegacyGuideMessageKind.user:
      text = raw['text'] is String ? raw['text'] as String : null;
      for (final item in _list(raw['attachments'])) {
        if (item case {
          'kind': 'file' || 'image',
          'name': final String name,
        } when name.trim().isNotEmpty) {
          names.add(name);
        }
      }
    case LegacyGuideMessageKind.assistant || LegacyGuideMessageKind.preview:
      text = _nonEmpty(raw['text']);
    case LegacyGuideMessageKind.question:
      text = _nonEmpty(raw['question']);
      focus = switch (raw['understanding']) {
        {'focus': final String value} => _nonEmpty(value),
        _ => null,
      };
      error = _nonEmpty(raw['error']);
    case LegacyGuideMessageKind.reading:
      final snapshot = raw['snapshot'];
      if (snapshot is! Map<String, Object?>) return null;
      text = _nonEmpty(snapshot['question']);
      final version = snapshot['ruleVersion'];
      final snapshotId = 'rn-$chatId-$id';
      final time = sentAt ?? threadTime;
      if (version == guideVersion && snapshot['method'] == 'combined') {
        reading = decodeGuideHistory(
          jsonEncode({
            'id': snapshotId,
            'reading': snapshot,
            'updatedAt': time.millisecondsSinceEpoch,
            'revealedTarotSlots': raw['revealedTarotSlots'],
          }),
        );
      } else {
        final method = _legacyMethods[version];
        if (method == null || snapshot['method'] != method.name) return null;
        archive = _archive(snapshotId, snapshot, time.millisecondsSinceEpoch);
      }
  }

  if (text == null || (text.trim().isEmpty && names.isEmpty)) return null;
  return (
    id: id,
    kind: kind,
    sentAt: sentAt,
    text: text,
    focus: focus,
    error: error,
    attachmentNames: List.unmodifiable(names),
    reading: reading,
    archive: archive,
  );
}

String _title(Object? saved, List<LegacyGuideMessage> messages) {
  if (_nonEmpty(saved) case final title?) return title;
  for (final message in messages) {
    if (message.kind != LegacyGuideMessageKind.user &&
        message.kind != LegacyGuideMessageKind.reading) {
      continue;
    }
    final candidate =
        _nonEmpty(message.text) ?? message.attachmentNames.firstOrNull;
    if (candidate != null) {
      return String.fromCharCodes(
        candidate.trim().replaceAll(RegExp(r'\s+'), ' ').runes.take(60),
      );
    }
  }
  return '';
}

String? _nonEmpty(Object? value) =>
    value is String && value.trim().isNotEmpty ? value : null;

DateTime? _milliseconds(Object? value) => value is num && value.isFinite
    ? _read(() => DateTime.fromMillisecondsSinceEpoch(value.toInt()))
    : null;

LegacyGuideArchive? _archive(
  String id,
  Map<String, Object?> snapshot,
  int time,
) {
  final method = _legacyMethods[snapshot['ruleVersion']];
  final question = snapshot['question'];
  final focus = snapshot['focus'];
  final updatedAt = _read(() => DateTime.fromMillisecondsSinceEpoch(time));
  if (!isGuideThreadId(id) ||
      method == null ||
      snapshot['method'] != method.name ||
      snapshot['stage'] != 'reading' ||
      question is! String ||
      question.trim().isEmpty ||
      focus is! String ||
      updatedAt == null) {
    return null;
  }
  final data = snapshot['results'];
  final solo = snapshot['result'];
  final results = data is Map<String, Object?> ? data : const {};
  final tarot = _readChart(snapshot['draw'], TarotDraw.fromJson);
  final liuyao = _readChart(
    method == LegacyGuideMethod.liuyao ? solo : results['liuyao'],
    _liuYaoChart,
  );
  final meihua = _readChart(
    method == LegacyGuideMethod.meihua ? solo : results['meihua'],
    MeihuaReading.fromJson,
  );
  final report = _reply(question, snapshot['report']);
  final followUps = [
    for (final item in _list(snapshot['followUps']))
      if (item case {
        'question': final String text,
        'report': final Object report,
      })
        if (_reply(text, report) case final reply?) reply,
  ];
  if (report == null &&
      followUps.isEmpty &&
      tarot == null &&
      liuyao == null &&
      meihua == null) {
    return null;
  }

  return (
    id: id,
    updatedAt: updatedAt,
    method: method,
    question: question,
    focus: focus,
    report: report,
    reportSource: switch (snapshot['report']) {
      {'source': 'local'} => 'local',
      {'source': 'model'} => 'model',
      _ => null,
    },
    followUps: List.unmodifiable(followUps),
    evidence: List.unmodifiable([
      for (final item in _list(snapshot['evidence']))
        if (item case {
          'id': final String id,
          'label': final String label,
          'plain': final String plain,
          'source': final String source,
          'catalogVersion': final int catalogVersion,
        })
          (
            id: id,
            label: label,
            plain: plain,
            source: source,
            catalogVersion: catalogVersion,
          ),
    ]),
    tarot: tarot,
    liuyao: liuyao,
    meihua: meihua,
  );
}

LegacyLiuYaoChart _liuYaoChart(Map<String, Object?> value) => (
  primary: Hexagram.fromJson(value['primary'] as Map<String, Object?>),
  changed: Hexagram.fromJson(value['changed'] as Map<String, Object?>),
  moving: List.unmodifiable(
    (value['moving'] as List).cast<int>().where(
      (line) => line >= 1 && line <= 6,
    ),
  ),
  interpretation: value['interpretation'] as String?,
);

ReadingFollowUp? _reply(String question, Object? value) {
  if (value is! Map<String, Object?> || value['schemaVersion'] != 1)
    return null;
  final answer = value['answer'];
  if (answer is! String || answer.trim().isEmpty) return null;
  return (
    question: question,
    answer: answer,
    explanation: switch (value['explanation']) {
      final String explanation when explanation.trim().isNotEmpty =>
        explanation,
      _ => null,
    },
    nextSteps: _strings(value['nextSteps']),
    evidenceIds: _strings(value['evidenceIds']),
  );
}

List<Object?> _list(Object? value) => value is List<Object?> ? value : const [];

List<String> _strings(Object? value) =>
    List.unmodifiable(_list(value).whereType<String>());

T? _readChart<T>(Object? value, T Function(Map<String, Object?>) decode) =>
    value is Map<String, Object?> ? _read(() => decode(value)) : null;

T? _read<T>(T Function() decode) {
  try {
    return decode();
  } on FormatException {
    return null;
  } on TypeError {
    return null;
  } on ArgumentError {
    return null;
  } on StateError {
    return null;
  }
}
