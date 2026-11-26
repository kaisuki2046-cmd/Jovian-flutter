import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';

const guideTranscriptTurnPrefix = 'transcript.turn.';
const guideTranscriptPositionSuffix = 'transcript.active';

bool isGuideTranscriptKey(String? suffix) =>
    suffix?.startsWith(guideTranscriptTurnPrefix) == true &&
    isGuideThreadId(suffix!.substring(guideTranscriptTurnPrefix.length));

String encodeGuideTranscriptTurn(GuideTranscriptTurn turn) => jsonEncode({
  'id': turn.id,
  'conversationId': turn.conversationId,
  'sentAt': turn.sentAt.microsecondsSinceEpoch,
  'question': turn.question,
  if (turn.reply != null) 'reply': turn.reply,
  if (turn.clarificationQuestion != null)
    'clarificationQuestion': turn.clarificationQuestion,
  if (turn.previousQuestion != null) 'previousQuestion': turn.previousQuestion,
  if (turn.readingId != null) 'readingId': turn.readingId,
});

GuideTranscriptTurn? decodeGuideTranscriptTurn(String? raw) {
  final data = _object(raw);
  if (data
      case {
        'id': final String id,
        'conversationId': final String conversationId,
        'sentAt': final int micros,
        'question': final String question,
      }
      when isGuideThreadId(id) &&
          isGuideThreadId(conversationId) &&
          question.trim().isNotEmpty) {
    final rawReply = data['reply'];
    final rawReadingId = data['readingId'];
    final pending = data['clarificationQuestion'];
    final reply = rawReply is String && rawReply.isNotEmpty ? rawReply : null;
    final readingId = rawReadingId is String && isGuideThreadId(rawReadingId)
        ? rawReadingId
        : null;
    if (reply != null && readingId != null) return null;
    try {
      return (
        id: id,
        conversationId: conversationId,
        sentAt: DateTime.fromMicrosecondsSinceEpoch(micros),
        question: question,
        reply: reply,
        clarificationQuestion: readingId == null && pending is String
            ? pending
            : null,
        previousQuestion: _optionalText(data['previousQuestion']),
        readingId: readingId,
      );
    } on RangeError {
      return null;
    }
  }
  return null;
}

String encodeGuideTranscriptPosition(GuideTranscriptPosition position) =>
    jsonEncode({
      'id': position.id,
      'composing': position.composing,
      if (position.previousQuestion != null)
        'previousQuestion': position.previousQuestion,
    });

GuideTranscriptPosition? decodeGuideTranscriptPosition(String? raw) {
  final data = _object(raw);
  if (data case {'id': final String id} when isGuideThreadId(id)) {
    final previousQuestion = _optionalText(data['previousQuestion']);
    return (
      id: id,
      previousQuestion: previousQuestion,
      composing: data['composing'] == true || previousQuestion != null,
    );
  }
  return null;
}

String? _optionalText(Object? value) =>
    value is String && value.isNotEmpty ? value : null;

Map<String, Object?>? _object(String? raw) {
  if (raw == null) return null;
  try {
    final data = jsonDecode(raw);
    return data is Map<String, Object?> ? data : null;
  } on FormatException {
    return null;
  }
}
