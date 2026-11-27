import 'package:flutter/services.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/report_body.dart';
import 'guide_composer.dart';
import 'reading_reference.dart'
    if (dart.library.js_interop) 'reading_reference_web.dart';

const _readingSections = [
  ('tarot', '塔罗解读'),
  ('liuyao', '六爻解读'),
  ('meihua', '梅花易数解读'),
];

class ReadingReportView extends StatelessWidget {
  const ReadingReportView({super.key, required this.report});
  final ProReport report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final body = theme.textTheme.bodyMedium?.copyWith(height: 1.62);
    final heading = theme.textTheme.titleMedium?.copyWith(
      color: theme.colorScheme.primary,
    );
    final current = report;
    return GuideAssistantMessage(
      content: SelectionArea(
        child: DefaultTextStyle.merge(
          style: body,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 28,
            children: [
              if (current is LegacyProReport)
                _render(splitProText(current.opening)),
              for (final (method, label) in _readingSections)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 8,
                  children: [
                    Semantics(
                      header: true,
                      child: UiText(label, style: heading),
                    ),
                    ...switch (current) {
                      ProParagraphReport(:final sections) => [
                        for (final paragraph in sections[method]!)
                          _render(
                            paragraph.detail == null
                                ? splitProText(paragraph.text)
                                : splitProInterpretation(paragraph.text),
                          ),
                      ],
                      ProTextReport(:final sections) => [
                        for (final line in sections[method]!.split('\n'))
                          if (line.trim().isNotEmpty)
                            _render(splitProText(line.trim())),
                      ],
                      LegacyProReport(:final sections) => [
                        _archived(sections[method]!),
                      ],
                    },
                  ],
                ),
              if (current is LegacyProReport)
                _render(splitProText(current.closing)),
            ],
          ),
        ),
      ),
    );
  }
}

class ReadingChartDetails extends StatelessWidget {
  const ReadingChartDetails({
    super.key,
    required this.report,
    required this.method,
  });

  final ProParagraphReport report;
  final String method;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: SelectionArea(
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.62),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 10,
          children: [
            for (final paragraph in report.sections[method]!)
              if (paragraph.detail case final detail?)
                _render(splitProText(detail)),
          ],
        ),
      ),
    ),
  );
}

class GuideFollowUpReply extends StatefulWidget {
  const GuideFollowUpReply({
    super.key,
    required this.followUp,
    required this.evidence,
    this.label,
  });

  final ReadingFollowUp followUp;
  final List<ReadingEvidence> evidence;
  final String? label;

  @override
  State<GuideFollowUpReply> createState() => _GuideFollowUpReplyState();
}

class _GuideFollowUpReplyState extends State<GuideFollowUpReply> {
  bool _showSources = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final turn = widget.followUp;
    final sources = [
      for (final item in widget.evidence)
        if (turn.evidenceIds.contains(item.id)) item,
    ];
    return GuideAssistantMessage(
      content: SelectionArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 10,
          children: [
            if (widget.label case final label?)
              UiText(label, style: theme.textTheme.labelMedium),
            Semantics(
              header: true,
              child: Text(turn.answer, style: theme.textTheme.titleMedium),
            ),
            if (turn.explanation case final explanation?)
              ReportBody(explanation, chat: true),
            if (turn.nextSteps.isNotEmpty) ...[
              const Divider(height: 1),
              Semantics(
                header: true,
                child: UiText('下一步', style: theme.textTheme.titleSmall),
              ),
              for (final step in turn.nextSteps) Text('• $step'),
            ],
            if (sources.isNotEmpty) ...[
              Semantics(
                expanded: _showSources,
                child: TextButton(
                  onPressed: () => setState(() => _showSources = !_showSources),
                  child: Text(_showSources ? '收起解读依据' : '查看解读依据'),
                ),
              ),
              if (_showSources) ...[
                const Divider(height: 1),
                for (final source in sources) _EvidenceSource(source: source),
                UiText(
                  '说明为 Jovian 整理，参考链接指向原文。',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _EvidenceSource extends StatelessWidget {
  const _EvidenceSource({required this.source});

  final ReadingEvidence source;

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(source.source);
    final hasLink =
        uri != null &&
        uri.scheme == 'https' &&
        uri.port == 443 &&
        !uri.authority.contains('@') &&
        const {'zh.wikisource.org', 'en.wikisource.org'}.contains(uri.host) &&
        uri.path.startsWith('/wiki/');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 4,
      children: [
        Text(source.label, style: Theme.of(context).textTheme.titleSmall),
        Text(source.plain),
        if (hasLink) ...[
          Text(source.source, style: Theme.of(context).textTheme.bodySmall),
          Wrap(
            spacing: 6,
            children: [
              TextButton(
                onPressed: () async {
                  final opened = await openReadingReference(uri);
                  if (!opened && context.mounted) {
                    _linkFeedback(context, '暂时无法打开参考链接。');
                  }
                },
                child: const UiText('打开参考原文'),
              ),
              TextButton(
                onPressed: () async {
                  try {
                    await Clipboard.setData(ClipboardData(text: source.source));
                    if (context.mounted) _linkFeedback(context, '已复制参考链接');
                  } on PlatformException {
                    if (context.mounted) {
                      _linkFeedback(context, '无法复制链接，可以长按网址手动复制。');
                    }
                  }
                },
                child: const Text('复制参考链接'),
              ),
            ],
          ),
        ],
      ],
    );
  }

  void _linkFeedback(BuildContext context, String message) =>
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
}

Widget _archived(LegacyProSection section) {
  final offset = highlightOffset(section.text, section.highlight);
  if (offset < 0) return Text(section.text);
  final end = offset + section.highlight.length;
  return _render([
    (text: section.text.substring(0, offset), bold: false),
    (text: section.text.substring(offset, end), bold: true),
    (text: section.text.substring(end), bold: false),
  ]);
}

Widget _render(List<ProTextPart> parts) => Text.rich(
  TextSpan(
    children: [
      for (final part in parts)
        TextSpan(
          text: part.text,
          style: part.bold
              ? const TextStyle(fontWeight: FontWeight.w700)
              : null,
        ),
    ],
  ),
);
