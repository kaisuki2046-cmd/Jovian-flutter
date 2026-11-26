import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

const _methodLabels = {'tarot': '塔罗解读', 'meihua': '梅花易数解读', 'liuyao': '六爻解读'};

class ReadingReportView extends StatelessWidget {
  const ReadingReportView({super.key, required this.report});
  final ProReport report;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final current = report;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (current is LegacyProReport) Text(current.opening),
        for (final method in proMethods) ...[
          const SizedBox(height: 14),
          Text(_methodLabels[method]!, style: text.titleLarge),
          const SizedBox(height: 6),
          ...switch (current) {
            ProParagraphReport(:final sections) => [
              for (final paragraph in sections[method]!)
                if (paragraph.detail case final detail?)
                  ExpansionTile(
                    title: _marked(paragraph.text),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: Text(detail),
                      ),
                    ],
                  )
                else
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: _marked(paragraph.text),
                  ),
            ],
            ProTextReport(:final sections) => [_marked(sections[method]!)],
            LegacyProReport(:final sections) => [_archived(sections[method]!)],
          },
        ],
        if (current is LegacyProReport) ...[
          const SizedBox(height: 12),
          Text(current.closing),
        ],
      ],
    );
  }
}

Widget _marked(String text) => _render(splitProText(text));

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
