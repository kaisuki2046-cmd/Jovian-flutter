import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

const tarotAspectRatio = 2 / 3;
const tarotDeckControlHeight = 48.0;
const _backAssets = 'src/features/divination/assets/tarot';
const tarotBack = '$_backAssets/star-trail-static.webp';
const tarotHoverLights = '$_backAssets/star-trail-hover.webp';

class TarotTableLayout {
  TarotTableLayout(this.width, this.slotCount, {this.extraHeight = 0})
    : cardWidth = (width / 3).clamp(74.0, 132.0);

  final double width;
  final int slotCount;
  final double cardWidth;
  final double extraHeight;

  double get cardHeight => cardWidth / tarotAspectRatio;
  double get step => math.max(22.0, cardWidth * 0.30);
  double get span => math.max(0, slotCount - 1) * step;
  double get reach =>
      (cardWidth * math.cos(math.pi / 5) + cardHeight * math.sin(math.pi / 5)) /
      2;
  double get arcDepth => cardHeight * 0.29 + extraHeight * 0.5;
  double get cardTop => 10 + extraHeight * 0.25;
  double get trackWidth => math.max(width, span + 2 * reach.ceil());
  double get maxScroll => trackWidth - width;
  double get height => cardHeight + arcDepth + 24 + extraHeight * 0.5;
  Size get cardSize => Size(cardWidth, cardHeight);

  // Store card centers in this range so a paused spread can resize with the table.
  Rect get centerBounds {
    final insetX = math.min(width * .40, cardWidth * .70);
    final insetY = math.min(height * .40, cardHeight * .59);
    return Rect.fromLTRB(insetX, insetY, width - insetX, height - insetY);
  }

  Offset cardCenter(Offset normalized) {
    final bounds = centerBounds;
    return bounds.topLeft +
        Offset(bounds.width * normalized.dx, bounds.height * normalized.dy);
  }

  Offset normalizeCenter(Offset point) {
    final bounds = centerBounds;
    return Offset(
      ((point.dx - bounds.left) / math.max(bounds.width, 1)).clamp(0, 1),
      ((point.dy - bounds.top) / math.max(bounds.height, 1)).clamp(0, 1),
    );
  }

  static const initialPile = Offset(.19, .62);
  static const initialAngle = -.09;

  double center(int slot) => (trackWidth - span) / 2 + slot * step;

  ({double angle, double depth, double opacity})? pose(
    int slot,
    double scroll,
  ) {
    final distance = center(slot) - scroll - width / 2;
    final visible = width / 2 + reach - distance.abs();
    if (visible <= 0) return null;
    final ratio = (2 * distance / width).clamp(-1.0, 1.0);
    return (
      angle: ratio * math.pi / 5,
      depth: arcDepth * (1 - math.cos(ratio * math.pi / 2)),
      opacity: (visible / math.min(24.0, cardWidth * 0.22)).clamp(0.0, 1.0),
    );
  }
}

class TarotCardShape extends ShapeBorder {
  const TarotCardShape();

  static Radius corner(double width) => Radius.circular(width * .041);

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      Path()..addRRect(RRect.fromRectAndRadius(rect, corner(rect.width)));

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      getOuterPath(rect, textDirection: textDirection);

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {}

  @override
  ShapeBorder scale(double t) => this;
}

class TarotBackArt extends StatelessWidget {
  const TarotBackArt({super.key, this.animated = true, this.hoverProgress});

  final bool animated;
  final double? hoverProgress;

  @override
  Widget build(BuildContext context) {
    if (!animated || MediaQuery.disableAnimationsOf(context)) {
      return _image(tarotBack);
    }
    final hover = hoverProgress;
    return Stack(
      fit: StackFit.expand,
      children: [
        _image('$_backAssets/star-trail-base.webp'),
        if (hover == null)
          _image(
            '$_backAssets/star-trail-lights.webp',
            key: const ValueKey('tarot-back-lights'),
          )
        else
          _HoverReflection(progress: hover),
      ],
    );
  }

  Widget _image(String asset, {Key? key}) => Image.asset(
    asset,
    key: key,
    fit: BoxFit.contain,
    filterQuality: FilterQuality.medium,
    excludeFromSemantics: true,
  );
}

class _HoverReflection extends StatelessWidget {
  const _HoverReflection({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      // The atlas samples the HTML's angle-dependent foil and stars at 32
      // points along the same left-to-right turn as the Flutter card.
      const columns = 8;
      const rows = 4;
      final frame = (progress * (columns * rows - 1)).round();
      final width = constraints.maxWidth;
      final height = constraints.maxHeight;
      return ClipRect(
        child: OverflowBox(
          alignment: Alignment.topLeft,
          minWidth: width * columns,
          maxWidth: width * columns,
          minHeight: height * rows,
          maxHeight: height * rows,
          child: Transform.translate(
            offset: Offset(
              -(frame % columns) * width,
              -(frame ~/ columns) * height,
            ),
            child: Image.asset(
              tarotHoverLights,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
              excludeFromSemantics: true,
            ),
          ),
        ),
      );
    },
  );
}

typedef TarotCardOrigin = ({Rect frame, double angle, double opacity});

class TarotPileArt extends StatelessWidget {
  const TarotPileArt({
    super.key,
    required this.count,
    required this.cardWidth,
    this.animated = false,
  });

  final int count;
  final double cardWidth;
  final bool animated;

  @override
  Widget build(BuildContext context) {
    final layers = math.min(count - 1, 5);
    final depth = (count - 1) * .10;
    final colors = Theme.of(context).colorScheme;
    return Stack(
      fit: StackFit.expand,
      clipBehavior: Clip.none,
      children: [
        for (var layer = layers; layer > 0; layer--)
          Transform.translate(
            offset: Offset(.35, .94) * (depth * layer / layers),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.all(
                  TarotCardShape.corner(cardWidth),
                ),
                border: Border.all(color: colors.outline.withValues(alpha: .7)),
                color: colors.surfaceContainerHighest,
              ),
            ),
          ),
        Material(
          elevation: 2,
          shape: const TarotCardShape(),
          clipBehavior: Clip.antiAlias,
          child: TarotBackArt(animated: animated),
        ),
      ],
    );
  }
}
