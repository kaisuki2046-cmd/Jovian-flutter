import 'dart:math' as math;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

part 'hexagram_ink.dart';

enum HexagramStyle { paper, ripples }

typedef HexagramFigure = ({String label, Hexagram hexagram, List<int> moving});

String _lineDescription(List<bool> lines, List<int> moving) => [
  for (var index = lines.length - 1; index >= 0; index--)
    '第 ${index + 1} 爻${lines[index] ? '阳' : '阴'}'
        '${moving.contains(index + 1) ? '动' : ''}',
].join('、');

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
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final lines = hexagram.yangLines;
    final diagram = Semantics(
      label: _lineDescription(lines, moving),
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
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            diagram,
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

class HexagramGroup extends StatelessWidget {
  const HexagramGroup({super.key, required this.figures, this.style});

  final List<HexagramFigure> figures;
  final HexagramStyle? style;

  @override
  Widget build(BuildContext context) {
    if (style case final style?) {
      return _WaterHexagrams(
        key: ValueKey(style),
        figures: figures,
        style: style,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final figure in figures)
          HexagramCard(
            label: figure.label,
            hexagram: figure.hexagram,
            moving: figure.moving,
          ),
      ],
    );
  }
}

class _WaterHexagrams extends StatefulWidget {
  const _WaterHexagrams({
    super.key,
    required this.figures,
    required this.style,
  });

  final List<HexagramFigure> figures;
  final HexagramStyle style;

  @override
  State<_WaterHexagrams> createState() => _WaterHexagramsState();
}

class _WaterHexagramsState extends State<_WaterHexagrams>
    with SingleTickerProviderStateMixin {
  late final _reveal = AnimationController(
    vsync: this,
    duration: Duration(
      milliseconds: widget.style == HexagramStyle.paper ? 1050 : 1420,
    ),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _reveal.value = 1;
    } else if (_reveal.isDismissed && !_reveal.isAnimating) {
      _reveal.forward();
    }
  }

  @override
  void dispose() {
    _reveal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final figures = widget.figures;
    final paper = widget.style == HexagramStyle.paper;
    return LayoutBuilder(
      builder: (context, constraints) {
        final connect = paper && figures.length == 2;
        final gap = connect ? 6.0 : 8.0;
        final available =
            constraints.maxWidth -
            gap * (figures.length - 1) -
            (connect ? 20 : 0);
        final cards = [
          for (final (index, figure) in figures.indexed)
            _WaterHexagram(
              figure: figure,
              index: index,
              style: widget.style,
              reveal: _reveal,
            ),
        ];
        if (cards.length == 1) {
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 230),
              child: cards.single,
            ),
          );
        }
        if (available <
            figures.length *
                MediaQuery.textScalerOf(context).scale(paper ? 98 : 70)) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 14,
            children: cards,
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: gap,
          children: [
            for (final (index, card) in cards.indexed) ...[
              if (index > 0 && connect)
                Padding(
                  padding: const EdgeInsets.only(top: 58),
                  child: Icon(
                    Icons.east_rounded,
                    size: 14,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              Expanded(child: card),
            ],
          ],
        );
      },
    );
  }
}

class _WaterHexagram extends StatelessWidget {
  const _WaterHexagram({
    required this.figure,
    required this.index,
    required this.style,
    required this.reveal,
  });

  final HexagramFigure figure;
  final int index;
  final HexagramStyle style;
  final Animation<double> reveal;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final dark = theme.brightness == Brightness.dark;
    final paper = style == HexagramStyle.paper;
    final lines = figure.hexagram.yangLines;
    final art = RepaintBoundary(
      child: CustomPaint(
        key: ValueKey(('hexagram-ink', style, index)),
        painter: _HexagramInkPainter(
          style: style,
          index: index,
          pattern: figure.hexagram.pattern,
          moving: figure.moving.fold(
            0,
            (mask, position) => position >= 1 && position <= lines.length
                ? mask | (1 << (position - 1))
                : mask,
          ),
          dark: dark,
          reveal: reveal,
        ),
      ),
    );
    final contents = Column(
      spacing: 4,
      children: [
        UiText(
          figure.label,
          textAlign: TextAlign.center,
          style: text.labelMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        Semantics(
          label: _lineDescription(lines, figure.moving),
          excludeSemantics: true,
          child: paper
              ? SizedBox(width: double.infinity, height: 82, child: art)
              : ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 103),
                  child: AspectRatio(aspectRatio: 1, child: art),
                ),
        ),
        Text(
          figure.hexagram.name,
          textAlign: TextAlign.center,
          style: text.titleSmall,
        ),
        Text(
          figure.hexagram.theme,
          textAlign: TextAlign.center,
          style: text.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            height: 1.45,
          ),
        ),
      ],
    );
    if (!paper) return contents;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: dark ? const Color(0xff5c4c3c) : const Color(0xffddc8a7),
        ),
        borderRadius: BorderRadius.circular(8),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark
              ? const [Color(0xff393027), Color(0xff2b241f)]
              : const [Color(0xfff9f1df), Color(0xffefe1c9)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(8, 9, 8, 10),
      child: contents,
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
