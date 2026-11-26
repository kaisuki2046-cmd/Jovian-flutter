import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import 'guide_conversation.dart';
import 'hexagram_card.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'tarot_cards.dart';

class LegacyReadingArchiveView extends StatelessWidget {
  const LegacyReadingArchiveView({
    super.key,
    required this.archive,
    required this.close,
  });

  final LegacyGuideArchive archive;
  final VoidCallback close;

  @override
  Widget build(BuildContext context) {
    final title = switch (archive.method) {
      LegacyGuideMethod.combined => '旧版综合算事',
      LegacyGuideMethod.tarot => '旧版塔罗',
      LegacyGuideMethod.liuyao => '旧版六爻',
      LegacyGuideMethod.meihua => '旧版梅花易数',
    };
    final source = switch (archive.reportSource) {
      'model' => 'AI 综合解读',
      'local' => '规则解读',
      _ => null,
    };
    final theme = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: close,
                icon: const Icon(Icons.arrow_back),
                label: const UiText('返回当前对话'),
              ),
            ),
            Semantics(
              header: true,
              child: UiText(title, style: theme.textTheme.titleLarge),
            ),
            const UiText('旧版记录仅供回看。'),
            const SizedBox(height: 16),
            GuideQuestionBubble(archive.question),
            if (archive.focus.trim().isNotEmpty &&
                archive.focus != archive.question) ...[
              const SizedBox(height: 8),
              GuideConversationReply(heading: '确认的关注点', body: archive.focus),
            ],
            if (archive.report case final report?) ...[
              const SizedBox(height: 16),
              GuideFollowUpReply(
                followUp: report,
                evidence: archive.evidence,
                label: source,
              ),
            ],
            if (archive.tarot case final draw?) ...[
              const SizedBox(height: 20),
              UiText('塔罗结果', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              TarotReveal(draw: draw),
            ],
            if (archive.liuyao case final chart?) ...[
              const SizedBox(height: 20),
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
            if (archive.meihua case final reading?) ...[
              const SizedBox(height: 20),
              MeihuaResult(reading: reading),
            ],
            if (archive.followUps.isNotEmpty) ...[
              const SizedBox(height: 20),
              GuideFollowUpList(
                followUps: archive.followUps,
                evidence: archive.evidence,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
