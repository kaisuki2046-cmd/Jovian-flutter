import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import 'composer_attachment.dart';
import 'composer_attachment_view.dart';
import 'guide_composer.dart';
import 'reading_report.dart';

class GuideQuestionBubble extends StatelessWidget {
  const GuideQuestionBubble(
    this.question, {
    super.key,
    this.attachments = const [],
  });

  final String question;
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
          Text(body, style: theme.textTheme.bodyMedium),
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
    this.localTurns = const [],
  });

  final List<ReadingFollowUp> followUps;
  final List<ReadingEvidence> evidence;
  final Map<int, List<ComposerAttachment>> attachments;
  final List<ComposerAttachmentTurn> localTurns;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var index = 0; index <= followUps.length; index++) ...[
        for (final turn in localTurns.where((turn) => turn.after == index))
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: GuideQuestionBubble('', attachments: turn.attachments),
          ),
        if (index < followUps.length) ...[
          GuideQuestionBubble(
            followUps[index].question,
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
    required this.activeId,
    required this.open,
    required this.back,
  });

  final List<GuideHistoryEntry> entries;
  final String? activeId;
  final ValueChanged<String>? open;
  final VoidCallback back;

  @override
  State<GuideConversationHistory> createState() =>
      _GuideConversationHistoryState();
}

class _GuideConversationHistoryState extends State<GuideConversationHistory> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final width = (MediaQuery.sizeOf(context).width * .84).clamp(0.0, 320.0);
    final now = DateTime.now();
    final theme = Theme.of(context);
    final groups = <String, List<GuideHistoryEntry>>{};
    for (final entry in widget.entries) {
      if (!_matches(entry.reading)) continue;
      final date = entry.updatedAt.toLocal();
      final label = DateUtils.isSameDay(date, now)
          ? '今天'
          : '${date.year}年${date.month}月';
      groups.putIfAbsent(label, () => []).add(entry);
    }
    return Drawer(
      width: width,
      shape: const RoundedRectangleBorder(),
      semanticLabel: '会话历史',
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
                    tooltip: '关闭会话历史',
                    onPressed: widget.back,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              Semantics(
                label: '搜索对话',
                child: TextField(
                  onChanged: (query) =>
                      setState(() => _query = query.trim().toLowerCase()),
                  decoration: const InputDecoration(
                    hintText: '搜索对话',
                    prefixIcon: Icon(Icons.search),
                    isDense: true,
                  ),
                ),
              ),
              if (groups.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_query.isEmpty ? '暂无历史对话' : '没有找到匹配的对话'),
                )
              else
                Expanded(
                  child: ListView(
                    children: [
                      for (final group in groups.entries) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 14, 8, 4),
                          child: Text(
                            group.key,
                            style: theme.textTheme.labelMedium,
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
                              entry.reading.snapshot.question,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            onTap: widget.open == null
                                ? null
                                : () => widget.open!(entry.id),
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

  bool _matches(OnlineReading reading) =>
      _query.isEmpty ||
      reading.snapshot.question.toLowerCase().contains(_query) ||
      reading.snapshot.focus.toLowerCase().contains(_query) ||
      reading.followUps.any(
        (turn) =>
            turn.question.toLowerCase().contains(_query) ||
            turn.answer.toLowerCase().contains(_query),
      );
}
