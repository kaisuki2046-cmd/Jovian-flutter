import 'package:material_ui/material_ui.dart';

typedef ReportTopicReader =
    ({String title, String text})? Function(String line);

final _lineBreak = RegExp(r'\r\n?');
final _divider = RegExp(r'^(?:-{3,}|\*{3,}|_{3,})$');
final _heading = RegExp(r'^#{1,6}\s+(.+?)(?:\s+#+)?$');
final _boldHeading = RegExp(r'^\*\*([^*]+)\*\*[:：]?$');
final _namedHeading = RegExp(
  r'^(综合(?:解读)?|事业|爱情|感情|学业|财富|财运|整体(?:来看|解读)?|总结)[:：]?$',
);
final _listItem = RegExp(r'^(?:[-*+]|([0-9]+[.)、]))\s+(.+)$');
final _emphasis = RegExp(
  r'\*\*([^*\n]+)\*\*|__([^_\n]+)__|\x60([^\x60\n]+)\x60',
);

enum _ReportBlockKind { heading, paragraph, item, divider }

typedef _ReportBlock = ({_ReportBlockKind kind, String text, String? marker});

List<_ReportBlock> _readBlocks(String body, ReportTopicReader? topicHeading) {
  final blocks = <_ReportBlock>[];
  final lines = <String>[];
  void flush() {
    if (lines.isEmpty) return;
    blocks.add((
      kind: _ReportBlockKind.paragraph,
      text: lines.join('\n'),
      marker: null,
    ));
    lines.clear();
  }

  for (final raw in body.replaceAll(_lineBreak, '\n').split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) {
      flush();
      continue;
    }
    final topic = topicHeading?.call(line);
    final title =
        topic?.title ??
        _heading.firstMatch(line)?[1] ??
        _boldHeading.firstMatch(line)?[1] ??
        _namedHeading.firstMatch(line)?[1];
    if (title != null) {
      flush();
      blocks.add((kind: _ReportBlockKind.heading, text: title, marker: null));
      if (topic case final value? when value.text.isNotEmpty) {
        lines.add(value.text);
      }
    } else if (_divider.hasMatch(line)) {
      flush();
      blocks.add((kind: _ReportBlockKind.divider, text: '', marker: null));
    } else if (_listItem.firstMatch(line) case final item?) {
      flush();
      blocks.add((
        kind: _ReportBlockKind.item,
        text: item[2]!,
        marker: item[1] ?? '•',
      ));
    } else {
      lines.add(line);
    }
  }
  flush();
  return blocks;
}

class ReportBody extends StatelessWidget {
  const ReportBody(
    this.body, {
    super.key,
    this.topicHeading,
    this.chat = false,
  });

  final String body;
  final ReportTopicReader? topicHeading;
  final bool chat;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textStyle = theme.textTheme.bodyMedium?.copyWith(
      fontSize: chat ? 17 : 15,
      color: theme.colorScheme.onSurface,
      height: chat ? 27 / 17 : 1.75,
    );
    final accent = theme.colorScheme.primary;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: chat ? 10 : 12,
      children: [
        for (final block in _readBlocks(body, topicHeading))
          switch (block.kind) {
            _ReportBlockKind.heading => ReportHeading(block.text, chat: chat),
            _ReportBlockKind.paragraph => Semantics(
              container: true,
              child: _reportText(block.text, textStyle, chat ? null : accent),
            ),
            _ReportBlockKind.item => Semantics(
              container: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 72),
                    child: Text(
                      block.marker!,
                      style: textStyle?.copyWith(color: chat ? null : accent),
                    ),
                  ),
                  Expanded(
                    child: _reportText(
                      block.text,
                      textStyle,
                      chat ? null : accent,
                    ),
                  ),
                ],
              ),
            ),
            _ReportBlockKind.divider => Divider(
              height: 9,
              color: theme.colorScheme.outlineVariant,
            ),
          },
      ],
    );
    return SelectionContainer.maybeOf(context) == null
        ? SelectionArea(child: content)
        : content;
  }
}

class ReportHeading extends StatelessWidget {
  const ReportHeading(this.title, {super.key, this.chat = false});

  final String title;
  final bool chat;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;
    final heading = _reportText(
      title,
      theme.textTheme.titleMedium?.copyWith(
        fontSize: chat ? 19 : 18,
        height: 1.4,
        fontWeight: chat ? FontWeight.w700 : FontWeight.w600,
      ),
      chat ? null : accent,
    );
    return Semantics(
      container: true,
      header: true,
      child: chat
          ? heading
          : Row(
              spacing: 9,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: const SizedBox(width: 3, height: 17),
                ),
                Expanded(child: heading),
              ],
            ),
    );
  }
}

Text _reportText(String text, TextStyle? style, Color? accent) {
  final spans = <TextSpan>[];
  var end = 0;
  for (final match in _emphasis.allMatches(text)) {
    if (match.start > end)
      spans.add(TextSpan(text: text.substring(end, match.start)));
    spans.add(
      TextSpan(
        text: match[1] ?? match[2] ?? match[3],
        style: TextStyle(color: accent, fontWeight: FontWeight.w600),
      ),
    );
    end = match.end;
  }
  if (spans.isEmpty) return Text(text, style: style);
  if (end < text.length) spans.add(TextSpan(text: text.substring(end)));
  return Text.rich(TextSpan(children: spans), style: style);
}
