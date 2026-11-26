typedef GuideTranscriptTurn = ({
  String id,
  String conversationId,
  DateTime sentAt,
  String question,
  String? reply,
  String? clarificationQuestion,
  String? previousQuestion,
  String? readingId,
});

typedef GuideTranscriptPosition = ({
  String id,
  String? previousQuestion,
  bool composing,
});

typedef GuideTranscript = ({String id, List<GuideTranscriptTurn> turns});

abstract interface class GuideTranscriptStore {
  Future<List<GuideTranscriptTurn>> readTranscriptTurns();
  Future<GuideTranscriptPosition?> readTranscriptPosition();
  Future<void> writeTranscriptTurn(GuideTranscriptTurn turn);
  Future<void> writeTranscriptPosition(GuideTranscriptPosition? position);
}
