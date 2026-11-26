import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'cast_content.dart';
import 'reading_report.dart';

class GuideQuestionBubble extends StatelessWidget {
  const GuideQuestionBubble(this.question, {super.key});

  final String question;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: FractionallySizedBox(
        widthFactor: 0.88,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.primaryContainer,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Text(
              question,
              style: TextStyle(color: colors.onPrimaryContainer),
            ),
          ),
        ),
      ),
    );
  }
}

class GuideConversationReply extends StatelessWidget {
  const GuideConversationReply({
    super.key,
    this.heading,
    required this.body,
    this.steps = const [],
  });

  final String? heading;
  final String body;
  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (heading case final label?) ...[
              Text(label, style: theme.textTheme.titleSmall),
              const SizedBox(height: 6),
            ],
            Text(body, style: theme.textTheme.bodyMedium),
            for (final step in steps)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('• $step'),
              ),
          ],
        ),
      ),
    );
  }
}

class GuideFollowUpList extends StatelessWidget {
  const GuideFollowUpList({super.key, required this.followUps});

  final List<ReadingFollowUp> followUps;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final item in followUps)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GuideQuestionBubble(item.question),
              const SizedBox(height: 8),
              GuideConversationReply(body: item.answer, steps: item.nextSteps),
            ],
          ),
        ),
    ],
  );
}

class GuideConversationHistory extends StatelessWidget {
  const GuideConversationHistory({
    super.key,
    required this.readings,
    required this.open,
    required this.back,
  });

  final List<OnlineReading> readings;
  final ValueChanged<OnlineReading> open;
  final VoidCallback back;

  @override
  Widget build(BuildContext context) => CastContent(
    children: [
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          icon: const Icon(Icons.arrow_back),
          label: const Text('返回对话'),
          onPressed: back,
        ),
      ),
      Text('本次会话记录', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 12),
      if (readings.isEmpty) const Text('本次会话暂无已完成的解读。'),
      for (final reading in readings)
        Card(
          child: ListTile(
            leading: const Icon(Icons.history),
            title: Text(
              reading.snapshot.question,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => open(reading),
          ),
        ),
    ],
  );
}

class GuideSavedConversation extends StatelessWidget {
  const GuideSavedConversation({
    super.key,
    required this.reading,
    required this.back,
  });

  final OnlineReading reading;
  final VoidCallback back;

  @override
  Widget build(BuildContext context) => CastContent(
    children: [
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          icon: const Icon(Icons.arrow_back),
          label: const Text('返回会话记录'),
          onPressed: back,
        ),
      ),
      Text('算事记录', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 12),
      GuideQuestionBubble(reading.snapshot.question),
      const SizedBox(height: 12),
      ReadingReportView(report: reading.report!),
      const SizedBox(height: 12),
      GuideFollowUpList(followUps: reading.followUps),
    ],
  );
}
