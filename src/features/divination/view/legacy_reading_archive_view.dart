import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/chat_time_label.dart';
import '../../../ui/interface_language.dart';
import 'guide_conversation.dart';
import 'hexagram_card.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'reading_report_dialog.dart';
import 'tarot_cards.dart';

class LegacyGuideConversationView extends StatelessWidget {
  const LegacyGuideConversationView({
    super.key,
    required this.conversation,
    required this.close,
    this.resume,
    this.busy = false,
    this.resumeError,
  });

  final LegacyGuideConversation conversation;
  final VoidCallback close;
  final ValueChanged<LegacyGuideMessage>? resume;
  final bool busy;
  final String? resumeError;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final stamps = chatTimeLabels(
      conversation.messages.map((message) => message.sentAt),
    );
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: busy ? null : close,
                  icon: const Icon(Icons.arrow_back),
                  label: const UiText('返回当前对话'),
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
                children: [
                  if (conversation.title.isNotEmpty)
                    Semantics(
                      header: true,
                      child: Text(
                        conversation.title,
                        style: theme.textTheme.titleLarge,
                      ),
                    ),
                  if (resume == null || !conversation.messages.any(_unfinished))
                    const UiText('旧版记录仅供回看。'),
                  if (resumeError case final error?)
                    Semantics(liveRegion: true, child: UiText(error)),
                  const SizedBox(height: 16),
                  for (final (index, message)
                      in conversation.messages.indexed) ...[
                    if (stamps[index] case final sentAt?)
                      ChatTimeLabel(sentAt: sentAt),
                    Padding(
                      key: ValueKey(message.id),
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _LegacyMessage(message: message),
                          if (resume case final restore?
                              when _unfinished(message))
                            Align(
                              alignment: AlignmentDirectional.centerStart,
                              child: OutlinedButton(
                                onPressed: busy ? null : () => restore(message),
                                child: const UiText('继续旧版仪式'),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _unfinished(LegacyGuideMessage message) {
  final entry = message.reading;
  if (entry == null) return false;
  final snapshot = entry.reading.snapshot;
  final revealed = entry.revealedTarotSlots;
  return snapshot.stage != GuideStage.reading ||
      (revealed != null && revealed.length < snapshot.selectedSlots.length);
}

class _LegacyMessage extends StatelessWidget {
  const _LegacyMessage({required this.message});

  final LegacyGuideMessage message;

  @override
  Widget build(BuildContext context) => switch (message.kind) {
    LegacyGuideMessageKind.user => GuideQuestionBubble(
      message.text,
      attachmentNames: message.attachmentNames,
    ),
    LegacyGuideMessageKind.assistant => GuideConversationReply(
      body: message.text,
    ),
    LegacyGuideMessageKind.preview => GuideConversationReply(
      heading: context.uiLabel('模拟结果'),
      body: message.text,
    ),
    LegacyGuideMessageKind.question => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        GuideQuestionBubble(message.text),
        if (message.focus case final focus?)
          GuideConversationReply(
            heading: context.uiLabel('确认的关注点'),
            body: focus,
          ),
        if (message.error case final error?)
          GuideConversationReply(body: error),
      ],
    ),
    LegacyGuideMessageKind.reading => _LegacyReading(message: message),
  };
}

class _LegacyReading extends StatelessWidget {
  const _LegacyReading({required this.message});

  final LegacyGuideMessage message;

  @override
  Widget build(BuildContext context) {
    final archive = message.archive;
    final reading = message.reading?.reading;
    if (archive == null && reading == null) {
      return GuideQuestionBubble(message.text);
    }
    final title = switch (archive?.method) {
      LegacyGuideMethod.tarot => '旧版塔罗',
      LegacyGuideMethod.liuyao => '旧版六爻',
      LegacyGuideMethod.meihua => '旧版梅花易数',
      _ => '旧版综合算事',
    };
    return ExpansionTile(
      title: UiText(title),
      subtitle: Text(message.text),
      expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (archive != null)
          _OldReport(archive: archive)
        else if (reading != null)
          _CombinedReport(reading: reading),
      ],
    );
  }
}

class _OldReport extends StatelessWidget {
  const _OldReport({required this.archive});

  final LegacyGuideArchive archive;

  @override
  Widget build(BuildContext context) {
    final source = switch (archive.reportSource) {
      'model' => 'AI 综合解读',
      'local' => '规则解读',
      _ => null,
    };
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        if (archive.focus.trim().isNotEmpty &&
            archive.focus != archive.question)
          GuideConversationReply(
            heading: context.uiLabel('确认的关注点'),
            body: archive.focus,
          ),
        if (archive.report case final report?)
          GuideFollowUpReply(
            followUp: report,
            evidence: archive.evidence,
            label: source,
          ),
        if (archive.tarot case final draw?) ...[
          UiText('塔罗结果', style: theme.textTheme.titleMedium),
          TarotReveal(draw: draw),
        ],
        if (archive.liuyao case final chart?) ...[
          UiText('六爻结果', style: theme.textTheme.titleMedium),
          HexagramCard(
            label: '本卦',
            hexagram: chart.primary,
            moving: chart.moving,
          ),
          HexagramCard(label: '变卦', hexagram: chart.changed),
          if (chart.interpretation case final interpretation?)
            Text(interpretation),
        ],
        if (archive.meihua case final reading?) MeihuaResult(reading: reading),
        if (archive.followUps.isNotEmpty)
          GuideFollowUpList(
            followUps: archive.followUps,
            evidence: archive.evidence,
          ),
      ],
    );
  }
}

class _CombinedReport extends StatelessWidget {
  const _CombinedReport({required this.reading});

  final OnlineReading reading;

  @override
  Widget build(BuildContext context) {
    final snapshot = reading.snapshot;
    final report = reading.report;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        if (snapshot.focus.trim().isNotEmpty &&
            snapshot.focus != snapshot.question)
          GuideConversationReply(
            heading: context.uiLabel('确认的关注点'),
            body: snapshot.focus,
          ),
        if (report != null || snapshot.chart != null)
          ReadingReportEntry(
            label: report != null ? '查看解读报告' : '查看三套盘面',
            onPressed: () => Navigator.of(
              context,
              rootNavigator: true,
            ).push(readingReportRoute(context, reading)),
          ),
        if (reading.followUps.isNotEmpty)
          GuideFollowUpList(
            followUps: reading.followUps,
            evidence: reading.evidence,
          ),
      ],
    );
  }
}
