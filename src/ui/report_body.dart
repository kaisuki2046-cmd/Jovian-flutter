import 'package:material_ui/material_ui.dart';

class ReportBody extends StatelessWidget {
  const ReportBody(this.body, {super.key});
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final headings = RegExp(r'^#{1,6}\s+');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final block in body.split(RegExp(r'\r?\n[ \t]*\r?\n'))) ...[
          const SizedBox(height: 8),
          if (headings.hasMatch(block) && !block.contains('\n'))
            Semantics(
              container: true,
              header: true,
              child: Text(
                block.replaceFirst(headings, ''),
                style: theme.titleMedium,
              ),
            )
          else
            SelectableText(block),
        ],
      ],
    );
  }
}
