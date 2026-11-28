import 'package:flutter/services.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/report_body.dart';
import 'guide_composer.dart';
import 'reading_reference.dart'
    if (dart.library.js_interop) 'reading_reference_web.dart';

enum ReadingReportMethod {
  tarot('塔罗'),
  liuyao('六爻'),
  meihua('梅花易数');

  const ReadingReportMethod(this.label);
  final String label;
}

final _actionHeading = RegExp(r'(?:^|[。！？!?；;.,，\s])行动建议(?=\s*[·•・:：])');
final _basisHeading = RegExp(
  r'^\s*(?:现状|关键影响|趋势|本卦(?:与体用)?|互卦|变卦|体用|世应|世爻|应爻|动爻(?:与变卦)?)\s*[·•・:：]',
);
final _sentenceEnd = RegExp(r'(?:[。！？!?]+|\.(?=\s|$)|\r?\n)[」』”’）)]*');
final _overviewHeading = RegExp(r'^(综述|小结)(?=\s*[·•・:：])');
final _clause = RegExp(r'[^，,。！？!?；;：:、\r\n]+');
final _sentencePunctuation = RegExp(r'[。！？!?；;\r\n]');
final _clauseLead = RegExp(
  r'^(?:也可以?|仍可以?|或者|或是|但是?|因此|所以|同时|可(?=先|留意|关注|确认|核对))\s*',
);
final _chartClause = RegExp(
  r'^(?:(?:本|变|互|体|用)卦|世[应爻]|应爻|动爻|[初二三四五上]爻|官鬼|妻财|六亲|日辰|月建|空亡)',
);
final _actionCue = RegExp(
  r'^(?:先|再|及时|优先)?(?:留意|关注|观察|核实|核对|确认|补充|准备|询问|整理|主动|检查|约定|避免)',
);
final _readingCue = RegExp(
  r'机会|风险|压力|进展|推进|延迟|推迟|反复|筛选|分工|反馈|沟通|安排|调整|明确|落实|稳定|提高|降低|减少|转折|意向|预期|变动|错失|核实|核对|确认|下一步',
);
final _han = RegExp(r'[\u3400-\u9fff]');
const _boldStyle = TextStyle(fontWeight: FontWeight.w700);

TextStyle? _readingBody(TextTheme theme) => theme.bodyMedium?.copyWith(
  fontSize: (theme.bodyMedium?.fontSize ?? 14) + 1,
  height: 1.62,
);

class ReadingReportSection extends StatelessWidget {
  const ReadingReportSection({
    super.key,
    required this.report,
    required this.method,
  });

  final ProReport report;
  final ReadingReportMethod method;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final basisColor = theme.colorScheme.onSurfaceVariant;
    final bodyColor = theme.brightness == Brightness.dark
        ? const Color(0xffededed)
        : const Color(0xff191814);
    final current = report;
    return DefaultTextStyle.merge(
      style: _readingBody(theme.textTheme)?.copyWith(color: bodyColor),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          if (current is LegacyProReport && method == ReadingReportMethod.tarot)
            _render(splitProText(current.opening)),
          ...switch (current) {
            ProParagraphReport(:final sections) => [
              for (final paragraph in sections[method.name]!)
                ..._readingParagraph(
                  splitProText(paragraph.text),
                  basisColor,
                  hasBasis: paragraph.detail != null,
                ),
            ],
            ProTextReport(:final sections) => [
              for (final line in sections[method.name]!.split('\n'))
                if (line.trim().isNotEmpty)
                  ..._readingParagraph(splitProText(line.trim()), basisColor),
            ],
            LegacyProReport(:final sections) => _readingParagraph(
              _archivedParts(sections[method.name]!),
              basisColor,
            ),
          },
          if (current is LegacyProReport &&
              method == ReadingReportMethod.meihua)
            _render(splitProText(current.closing)),
        ],
      ),
    );
  }
}

class ReadingReportDetails extends StatelessWidget {
  const ReadingReportDetails({super.key, required this.paragraphs});

  final List<String> paragraphs;

  @override
  Widget build(BuildContext context) => DefaultTextStyle.merge(
    style: _readingBody(Theme.of(context).textTheme),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        for (final paragraph in paragraphs)
          _render(splitProText(paragraph), supplementEmphasis: true),
      ],
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

List<Widget> _readingParagraph(
  List<ProTextPart> parts,
  Color basisColor, {
  bool hasBasis = false,
}) {
  final plain = parts.map((part) => part.text).join();
  final action = _actionHeading.firstMatch(plain);
  final actionStart = action == null
      ? plain.length
      : action.end - '行动建议'.length;
  final summary = plain.substring(0, actionStart).trimRight();
  final overview = _overviewHeading.firstMatch(summary);
  final firstSentenceEnd = _sentenceEnd.firstMatch(summary)?.end;
  final basisEnd = _basisHeading.hasMatch(summary)
      ? firstSentenceEnd ?? summary.length
      : hasBasis &&
            firstSentenceEnd != null &&
            firstSentenceEnd < summary.length
      ? firstSentenceEnd
      : 0;
  return [
    if (summary.isNotEmpty)
      Text.rich(
        TextSpan(
          children: [
            if (basisEnd > 0)
              TextSpan(
                text: summary.substring(0, basisEnd),
                style: TextStyle(color: basisColor),
              ),
            if (overview != null)
              ..._overviewSpans(summary, overview.end)
            else
              ..._emphasizedSpans(parts, summary, basisEnd),
          ],
        ),
      ),
    if (action != null)
      Text.rich(
        TextSpan(
          children: _overviewSpans(plain.substring(actionStart), '行动建议'.length),
        ),
      ),
  ];
}

List<TextSpan> _overviewSpans(String text, int labelEnd) {
  final separator = RegExp(
    r'^\s*[·•・:：]\s*',
  ).firstMatch(text.substring(labelEnd));
  final bodyStart = labelEnd + (separator?.end ?? 0);
  return [
    TextSpan(text: text.substring(0, labelEnd), style: _boldStyle),
    TextSpan(text: text.substring(labelEnd, bodyStart)),
    TextSpan(
      text: text.substring(bodyStart),
      style: const TextStyle(decoration: TextDecoration.underline),
    ),
  ];
}

List<TextSpan> _readingSpans(List<ProTextPart> parts, int start, int end) {
  final spans = <TextSpan>[];
  var offset = 0;
  for (final part in parts) {
    final next = offset + part.text.length;
    final from = (start - offset).clamp(0, part.text.length);
    final to = (end - offset).clamp(0, part.text.length);
    if (from < to) {
      spans.add(
        TextSpan(
          text: part.text.substring(from, to),
          style: part.bold ? _boldStyle : null,
        ),
      );
    }
    offset = next;
    if (offset >= end) break;
  }
  return spans;
}

List<TextSpan> _emphasizedSpans(
  List<ProTextPart> parts,
  String text,
  int start,
) {
  final body = text.substring(start);
  final marked = <({int start, int end})>[];
  var offset = 0;
  var boldLength = 0;
  for (final part in parts) {
    final next = offset + part.text.length;
    if (part.bold && next > start) {
      final from = offset.clamp(start, text.length);
      final to = next.clamp(start, text.length);
      marked.add((start: from, end: to));
      boldLength += to - from;
    }
    offset = next;
    if (offset >= text.length) break;
  }
  final missing = (body.length >= 84 ? 3 : 2) - marked.length;
  final budget = (body.length * .42).ceil();
  if (missing <= 0 || boldLength >= budget) {
    return _readingSpans(parts, start, text.length);
  }

  final candidates = <({int start, int end, bool action})>[];
  for (final match in _clause.allMatches(body)) {
    final raw = match.group(0)!;
    final trimmed = raw.trimLeft();
    final lead = _clauseLead.firstMatch(trimmed)?.end ?? 0;
    final phrase = trimmed.substring(lead).trimRight();
    final action = _actionCue.hasMatch(phrase);
    if (phrase.length < 4 ||
        phrase.length > 15 ||
        !_han.hasMatch(phrase) ||
        _chartClause.hasMatch(phrase) ||
        (!action && !_readingCue.hasMatch(phrase))) {
      continue;
    }
    final startsSentence =
        match.start == 0 ||
        _sentencePunctuation.hasMatch(body[match.start - 1]);
    final endsSentence =
        match.end == body.length ||
        _sentencePunctuation.hasMatch(body[match.end]);
    if (lead == 0 && startsSentence && endsSentence) continue;
    final from = start + match.start + raw.length - trimmed.length + lead;
    candidates.add((start: from, end: from + phrase.length, action: action));
  }
  candidates.sort((a, b) {
    if (a.action != b.action) return a.action ? -1 : 1;
    return a.start.compareTo(b.start);
  });

  final added = <({int start, int end})>[];
  for (final candidate in candidates) {
    final length = candidate.end - candidate.start;
    if (boldLength + length > budget ||
        marked.any(
          (range) =>
              candidate.start < range.end + 3 &&
              candidate.end > range.start - 3,
        )) {
      continue;
    }
    final range = (start: candidate.start, end: candidate.end);
    added.add(range);
    marked.add(range);
    boldLength += length;
    if (added.length == missing) break;
  }

  added.sort((a, b) => a.start.compareTo(b.start));
  final spans = <TextSpan>[];
  var cursor = start;
  for (final range in added) {
    spans.addAll(_readingSpans(parts, cursor, range.start));
    spans.add(
      TextSpan(text: text.substring(range.start, range.end), style: _boldStyle),
    );
    cursor = range.end;
  }
  spans.addAll(_readingSpans(parts, cursor, text.length));
  return spans;
}

List<ProTextPart> _archivedParts(LegacyProSection section) {
  final offset = highlightOffset(section.text, section.highlight);
  if (offset < 0) return [(text: section.text, bold: false)];
  final end = offset + section.highlight.length;
  return [
    (text: section.text.substring(0, offset), bold: false),
    (text: section.text.substring(offset, end), bold: true),
    (text: section.text.substring(end), bold: false),
  ];
}

Widget _render(List<ProTextPart> parts, {bool supplementEmphasis = false}) {
  final plain = parts.map((part) => part.text).join();
  return Text.rich(
    TextSpan(
      children: supplementEmphasis
          ? _emphasizedSpans(parts, plain, 0)
          : _readingSpans(parts, 0, plain.length),
    ),
  );
}
