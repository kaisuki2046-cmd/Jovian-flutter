import 'package:material_ui/material_ui.dart';

class DestinyReportText extends StatelessWidget {
  const DestinyReportText(this.body, {super.key});

  final String body;

  static const _titles = {
    '综合': '综合',
    '整体': '综合',
    '事业': '事业',
    '爱情': '爱情',
    '感情': '爱情',
    '学业': '学业',
    '财富': '财富',
    '财运': '财富',
  };
  static final _heading = RegExp(
    r'^(?:#{1,6}\s*)?(?:[一二三四五1-5][、.．)）]\s*)?'
    r'(?:\*\*|__|【|\[)?(综合|整体|事业|爱情|感情|学业|财富|财运)(?:解读)?'
    r'(?:\*\*|__|】|\])?\s*(?:[：:]\s*(.*?))?(?:\s+#+)?$',
  );
  static final _emphasis = RegExp(r'\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`');
  static final _paragraphs = RegExp(r'\n\s*\n');

  Iterable<({String? title, String text})> _sections() sync* {
    String? title;
    var lines = <String>[];
    for (final line in body.replaceAll(RegExp(r'\r\n?'), '\n').split('\n')) {
      final heading = _heading.firstMatch(line.trim());
      if (heading == null) {
        lines.add(line);
        continue;
      }
      final text = lines.join('\n').trim();
      if (title != null || text.isNotEmpty) yield (title: title, text: text);
      title = _titles[heading[1]];
      lines = [if (heading[2] case final inline?) inline];
    }
    final text = lines.join('\n').trim();
    if (title != null || text.isNotEmpty) yield (title: title, text: text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SelectionArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final section in _sections()) ...[
            const SizedBox(height: 16),
            if (section.title case final title?)
              Semantics(
                header: true,
                child: Row(
                  children: [
                    Container(
                      width: 3,
                      height: 17,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(title, style: theme.textTheme.titleMedium),
                    ),
                  ],
                ),
              ),
            for (final paragraph
                in section.text
                    .split(_paragraphs)
                    .where((value) => value.isNotEmpty)) ...[
              const SizedBox(height: 10),
              Text.rich(
                TextSpan(children: _spans(paragraph)),
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 15,
                  height: 1.7,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  static List<InlineSpan> _spans(String text) {
    var end = 0;
    final spans = <InlineSpan>[];
    for (final match in _emphasis.allMatches(text)) {
      spans.add(TextSpan(text: text.substring(end, match.start)));
      spans.add(
        TextSpan(
          text: match[1] ?? match[2] ?? match[3],
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      );
      end = match.end;
    }
    spans.add(TextSpan(text: text.substring(end)));
    return spans;
  }
}
