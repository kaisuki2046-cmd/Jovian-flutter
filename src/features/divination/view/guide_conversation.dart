import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/report_body.dart';

import 'composer_attachment.dart';
import 'composer_attachment_view.dart';
import 'guide_composer.dart';
import 'reading_report.dart';

class GuideQuestionBubble extends StatelessWidget {
  const GuideQuestionBubble(
    this.question, {
    super.key,
    this.attachments = const [],
    this.attachmentNames = const [],
  });

  final String question;
  final List<String> attachmentNames;
  final List<ComposerAttachment> attachments;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, viewport) => Align(
      alignment: AlignmentDirectional.centerEnd,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: viewport.maxWidth * .85),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xff087bab),
            borderRadius: BorderRadiusDirectional.only(
              topStart: Radius.circular(22),
              topEnd: Radius.circular(22),
              bottomStart: Radius.circular(22),
              bottomEnd: Radius.circular(6),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (question.isNotEmpty)
                  Text(
                    question,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.white,
                      height: 1.45,
                    ),
                  ),
                if (attachments.isEmpty)
                  for (final name in attachmentNames)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        name,
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                for (final attachment in attachments)
                  Padding(
                    padding: EdgeInsets.only(
                      top:
                          question.isNotEmpty || attachment != attachments.first
                          ? 7
                          : 0,
                    ),
                    child: ComposerAttachmentTile(attachment: attachment),
                  ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class GuideConversationReply extends StatelessWidget {
  const GuideConversationReply({super.key, this.heading, required this.body});

  final String? heading;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GuideAssistantMessage(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (heading case final label?) ...[
            Text(label, style: theme.textTheme.titleSmall),
            const SizedBox(height: 6),
          ],
          ReportBody(body, chat: true),
        ],
      ),
    );
  }
}

class GuideFollowUpList extends StatelessWidget {
  const GuideFollowUpList({
    super.key,
    required this.followUps,
    required this.evidence,
    this.attachments = const {},
    this.history,
    this.noteFiles = const {},
  });

  final List<ReadingFollowUp> followUps;
  final List<ReadingEvidence> evidence;
  final Map<int, List<ComposerAttachment>> attachments;
  final GuideHistoryEntry? history;
  final Map<String, List<ComposerAttachment>> noteFiles;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var index = 0; index <= followUps.length; index++) ...[
        for (final note
            in history?.localAttachments ?? const <GuideReadingAttachment>[])
          if (note.after == index)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: GuideQuestionBubble(
                '',
                attachmentNames: note.names,
                attachments: noteFiles[note.id] ?? const [],
              ),
            ),
        if (index < followUps.length) ...[
          GuideQuestionBubble(
            followUps[index].question,
            attachmentNames:
                history?.followUpAttachmentNames[index] ?? const [],
            attachments: attachments[index] ?? const [],
          ),
          const SizedBox(height: 8),
          GuideFollowUpReply(
            key: ValueKey((index, followUps[index].question)),
            followUp: followUps[index],
            evidence: evidence,
          ),
          const SizedBox(height: 12),
        ],
      ],
    ],
  );
}

class GuideConversationHistory extends StatefulWidget {
  const GuideConversationHistory({
    super.key,
    required this.entries,
    required this.transcripts,
    required this.legacyConversations,
    required this.activeId,
    required this.open,
    required this.openConversation,
    required this.openLegacyConversation,
    required this.back,
  });

  final List<GuideHistoryEntry> entries;
  final List<GuideTranscript> transcripts;
  final List<LegacyGuideConversation> legacyConversations;
  final String? activeId;
  final ValueChanged<String>? open;
  final ValueChanged<String>? openConversation;
  final ValueChanged<LegacyGuideConversation>? openLegacyConversation;
  final VoidCallback back;

  @override
  State<GuideConversationHistory> createState() =>
      _GuideConversationHistoryState();
}

typedef _GuideHistoryRow = ({
  String id,
  String question,
  DateTime updatedAt,
  VoidCallback? open,
});

class _GuideConversationHistoryState extends State<GuideConversationHistory> {
  final _search = TextEditingController();
  final _searchFocus = FocusNode();
  String _query = '';

  void _filter(String query) =>
      setState(() => _query = query.trim().toLowerCase());

  void _clearSearch() {
    _search.clear();
    _filter('');
    _searchFocus.requestFocus();
  }

  @override
  void dispose() {
    _search.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final width = (MediaQuery.sizeOf(context).width * .84).clamp(0.0, 320.0);
    final today = _calendarDay(DateTime.now());
    final theme = Theme.of(context);
    final readings = {for (final entry in widget.entries) entry.id: entry};
    final linkedIds = {
      for (final transcript in widget.transcripts)
        for (final turn in transcript.turns)
          if (turn.readingId case final id?) id,
    };
    final entries = <_GuideHistoryRow>[
      for (final transcript in widget.transcripts)
        if (_matchesTranscript(transcript, readings))
          (
            id: transcript.id,
            question: _historyTitle(transcript.turns.first),
            updatedAt: _latestActivity(transcript, readings),
            open: widget.openConversation == null
                ? null
                : () => widget.openConversation!(transcript.id),
          ),
      for (final entry in widget.entries)
        if (!linkedIds.contains(entry.id) &&
            (_matches(
                  entry.reading.snapshot.question,
                  entry.reading.snapshot.focus,
                  entry.reading.followUps,
                ) ||
                _matchesReadingAttachments(entry)))
          (
            id: entry.id,
            question: entry.reading.snapshot.question,
            updatedAt: entry.updatedAt,
            open: widget.open == null ? null : () => widget.open!(entry.id),
          ),
      for (final conversation in widget.legacyConversations)
        if (_matchesLegacyConversation(conversation))
          (
            id: conversation.id,
            question: conversation.title.isEmpty
                ? context.uiLabel('新对话')
                : conversation.title,
            updatedAt: conversation.updatedAt,
            open: widget.openLegacyConversation == null
                ? null
                : () => widget.openLegacyConversation!(conversation),
          ),
    ]..sort((left, right) => right.updatedAt.compareTo(left.updatedAt));
    final groups = <String, List<_GuideHistoryRow>>{};
    for (final entry in entries) {
      final date = entry.updatedAt.toLocal();
      final age = today.difference(_calendarDay(date)).inDays;
      final label = switch (age) {
        <= 0 => context.uiLabel('今天'),
        1 => context.uiLabel('昨天'),
        < 7 => context.uiLabel('7 天内'),
        < 30 => context.uiLabel('30 天内'),
        _ => MaterialLocalizations.of(context).formatMonthYear(date),
      };
      groups.putIfAbsent(label, () => []).add(entry);
    }
    return Drawer(
      width: width,
      shape: const RoundedRectangleBorder(),
      semanticLabel: context.uiLabel('会话历史'),
      backgroundColor: theme.scaffoldBackgroundColor,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: UiText('会话历史', style: theme.textTheme.titleMedium),
                    ),
                  ),
                  IconButton(
                    tooltip: context.uiLabel('关闭会话历史'),
                    onPressed: widget.back,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              TextField(
                controller: _search,
                focusNode: _searchFocus,
                autocorrect: false,
                textInputAction: TextInputAction.search,
                onChanged: _filter,
                decoration: InputDecoration(
                  labelText: context.uiLabel('搜索对话'),
                  hintText: context.uiLabel('搜索对话内容…'),
                  prefixIcon: const Icon(Icons.search),
                  isDense: true,
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: context.uiLabel('清空搜索'),
                          icon: const Icon(Icons.close),
                          onPressed: _clearSearch,
                        ),
                ),
              ),
              if (groups.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Semantics(
                    liveRegion: true,
                    child: UiText(_query.isEmpty ? '暂无历史对话' : '没有找到匹配的对话'),
                  ),
                )
              else
                Expanded(
                  child: ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      for (final group in groups.entries) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 14, 8, 4),
                          child: Semantics(
                            header: true,
                            child: Text(
                              group.key,
                              style: theme.textTheme.labelMedium,
                            ),
                          ),
                        ),
                        for (final entry in group.value)
                          ListTile(
                            dense: true,
                            selected: entry.id == widget.activeId,
                            selectedTileColor:
                                theme.colorScheme.primaryContainer,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(11),
                            ),
                            title: Text(
                              entry.question,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            onTap: entry.open,
                          ),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  bool _matchesLegacyConversation(LegacyGuideConversation conversation) =>
      conversation.title.toLowerCase().contains(_query) ||
      conversation.messages.any(
        (message) =>
            _matches(
              message.text,
              message.focus ??
                  message.reading?.reading.snapshot.focus ??
                  message.archive?.focus ??
                  '',
              message.reading?.reading.followUps ??
                  message.archive?.followUps ??
                  const [],
            ) ||
            (message.error?.toLowerCase().contains(_query) ?? false) ||
            message.attachmentNames.any(
              (name) => name.toLowerCase().contains(_query),
            ),
      );

  bool _matchesTranscript(
    GuideTranscript transcript,
    Map<String, GuideHistoryEntry> readings,
  ) => transcript.turns.any((turn) {
    final saved = readings[turn.readingId];
    final reading = saved?.reading;
    return turn.attachmentNames.any(_contains) ||
        _contains(turn.reply) ||
        _contains(turn.clarificationQuestion) ||
        (saved != null && _matchesReadingAttachments(saved)) ||
        _matches(
          turn.question,
          reading?.snapshot.focus ?? '',
          reading?.followUps ?? const [],
        );
  });

  bool _matchesReadingAttachments(GuideHistoryEntry entry) =>
      entry.followUpAttachmentNames.values.any(
        (names) => names.any(_contains),
      ) ||
      entry.localAttachments.any((note) => note.names.any(_contains));

  bool _contains(String? text) => text?.toLowerCase().contains(_query) ?? false;

  bool _matches(
    String question,
    String focus,
    List<ReadingFollowUp> followUps,
  ) =>
      _query.isEmpty ||
      _contains(question) ||
      _contains(focus) ||
      followUps.any(
        (turn) => _contains(turn.question) || _contains(turn.answer),
      );
}

String _historyTitle(GuideTranscriptTurn first) =>
    first.question.isEmpty ? first.attachmentNames.first : first.question;

DateTime _latestActivity(
  GuideTranscript transcript,
  Map<String, GuideHistoryEntry> readings,
) {
  var latest = transcript.turns.last.sentAt;
  for (final turn in transcript.turns) {
    final saved = readings[turn.readingId];
    if (saved != null && saved.updatedAt.isAfter(latest))
      latest = saved.updatedAt;
  }
  return latest;
}

// Compare calendar days without the varying length of a local DST day.
DateTime _calendarDay(DateTime local) =>
    DateTime.utc(local.year, local.month, local.day);
