import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

class HexagramCard extends StatelessWidget {
  const HexagramCard({
    super.key,
    required this.label,
    required this.hexagram,
    this.moving = const [],
  });

  final String label;
  final Hexagram hexagram;
  final List<int> moving;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final lines = hexagram.yangLines;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Semantics(
              label: [
                for (var index = lines.length - 1; index >= 0; index--)
                  '第 ${index + 1} 爻${lines[index] ? '阳' : '阴'}'
                      '${moving.contains(index + 1) ? '动' : ''}',
              ].join('、'),
              excludeSemantics: true,
              child: SizedBox(
                width: 48,
                child: Column(
                  children: [
                    for (var index = lines.length - 1; index >= 0; index--)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: _HexagramLine(
                          yang: lines[index],
                          color: moving.contains(index + 1)
                              ? colors.primary
                              : colors.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$label · ${hexagram.name}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(hexagram.theme),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HexagramLine extends StatelessWidget {
  const _HexagramLine({required this.yang, required this.color});

  final bool yang;
  final Color color;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    height: 4,
    child: yang
        ? ColoredBox(color: color)
        : Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: ColoredBox(color: color)),
              const SizedBox(width: 7),
              Expanded(child: ColoredBox(color: color)),
            ],
          ),
  );
}
