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

const _legacyMethods = {
  'tarot-liuyao-meihua-v1': LegacyGuideMethod.combined,
  'rws-three-card-v1': LegacyGuideMethod.tarot,
  'three-coin-v1': LegacyGuideMethod.liuyao,
  'three-number-v1': LegacyGuideMethod.meihua,
};

Iterable<GuideHistoryEntry> decodeLegacyGuideHistory(String? saved) sync* {
  for (final reading in _readingSessions(saved)) {
    if (reading.snapshot['ruleVersion'] != guideVersion) continue;
    final entry = decodeGuideHistory(
      jsonEncode({
        'id': reading.id,
        'reading': reading.snapshot,
        'updatedAt': reading.updatedAt,
      }),
    );
    if (entry != null) yield entry;
  }
}

Iterable<LegacyGuideArchive> decodeLegacyGuideArchives(String? saved) sync* {
  for (final reading in _readingSessions(saved)) {
    final archive = _archive(reading.id, reading.snapshot, reading.updatedAt);
    if (archive != null) yield archive;
  }
}

Iterable<({String id, Map<String, Object?> snapshot, int updatedAt})>
_readingSessions(String? saved) sync* {
  if (saved == null) return;
  final Object? data;
  try {
    data = jsonDecode(saved);
  } on FormatException {
    return;
  }
  if (data case {'threads': final List threads}) {
    for (final thread in threads) {
      if (thread case {
        'id': final String chatId,
        'updatedAt': final int updatedAt,
        'messages': final List messages,
      } when isGuideThreadId(chatId)) {
        for (final message in messages) {
          if (message case {
            'id': final int messageId,
            'kind': 'readingSession',
            'snapshot': final Map<String, Object?> snapshot,
          }) {
            yield (
              id: 'rn-$chatId-$messageId',
              snapshot: snapshot,
              updatedAt: message['sentAt'] is int
                  ? message['sentAt'] as int
                  : updatedAt,
            );
          }
        }
      }
    }
  }
}

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
