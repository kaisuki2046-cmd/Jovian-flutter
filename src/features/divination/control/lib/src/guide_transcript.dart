typedef GuideTranscriptTurn = ({
  String id,
  String conversationId,
  DateTime sentAt,
  String question,
  List<String> attachmentNames,
  String? reply,
  String? clarificationQuestion,
  String? previousQuestion,
  String? readingId,
});

typedef GuideReadingAttachment = ({String id, int after, List<String> names});

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
