import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

const tarotAspectRatio = 2 / 3;
const tarotDeckControlHeight = 48.0;
const _backAssets = 'src/features/divination/assets/tarot';
const tarotBack = '$_backAssets/star-trail-static.webp';
const tarotHoverLights = '$_backAssets/star-trail-hover.webp';

class TarotFanLayout {
  TarotFanLayout(this.width, this.slotCount, {this.extraHeight = 0})
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
  double get cardTop => 10 + extraHeight * 0.25;
  double get trackWidth => math.max(width, span + 2 * reach.ceil());
  double get maxScroll => trackWidth - width;
  double get height => cardHeight * 1.29 + 24 + extraHeight;
  double get _radius => width * 0.95 + reach;
  double center(int slot) => (trackWidth - span) / 2 + slot * step;

  ({double angle, double depth, double opacity})? pose(
    int slot,
    double scroll,
  ) {
    final distance = center(slot) - scroll - width / 2;
    final visible = width / 2 + reach - distance.abs();
    if (visible <= 0) return null;
    // A card's center and rotation share the same circle.
    final angle = math.asin(distance / _radius);
    return (
      angle: angle,
      depth: _radius * (1 - math.cos(angle)),
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

class TarotRitualFan extends StatefulWidget {
  const TarotRitualFan({
    super.key,
    required this.layout,
    required this.selectedSlots,
    required this.busy,
    required this.reducedMotion,
    required this.animateBacks,
    required this.choose,
  });

  final TarotFanLayout layout;
  final Set<int> selectedSlots;
  final bool busy;
  final bool reducedMotion;
  final bool animateBacks;
  final void Function(int slot, TarotCardOrigin origin) choose;

  @override
  State<TarotRitualFan> createState() => _TarotRitualFanState();
}

class _TarotRitualFanState extends State<TarotRitualFan> {
  late final _scroll = ScrollController(
    initialScrollOffset: widget.layout.maxScroll / 2,
  );

  @override
  void didUpdateWidget(TarotRitualFan oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_scroll.hasClients ||
        widget.layout.maxScroll == oldWidget.layout.maxScroll)
      return;
    final former = oldWidget.layout.maxScroll;
    final fraction = former == 0
        ? 0.5
        : (_scroll.offset / former).clamp(0.0, 1.0);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients)
        _scroll.jumpTo(fraction * widget.layout.maxScroll);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _shift(int direction) {
    final layout = widget.layout;
    final target = (_scroll.offset + direction * layout.width * 0.72).clamp(
      0.0,
      layout.maxScroll,
    );
    if (widget.reducedMotion) {
      _scroll.jumpTo(target);
    } else {
      _scroll.animateTo(
        target,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final layout = widget.layout;
    return Column(
      children: [
        SizedBox(
          height: tarotDeckControlHeight,
          child: AnimatedBuilder(
            animation: _scroll,
            builder: (context, _) {
              final offset = _scroll.hasClients
                  ? _scroll.offset
                  : layout.maxScroll / 2;
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    tooltip: context.uiLabel('向左浏览牌阵'),
                    onPressed: widget.busy || offset <= 0
                        ? null
                        : () => _shift(-1),
                    icon: const Icon(Icons.chevron_left),
                  ),
                  IconButton(
                    tooltip: context.uiLabel('向右浏览牌阵'),
                    onPressed: widget.busy || offset >= layout.maxScroll
                        ? null
                        : () => _shift(1),
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              );
            },
          ),
        ),
        Semantics(
          container: true,
          label: context
              .uiLabel('{count} 张塔罗牌阵')
              .replaceFirst('{count}', layout.slotCount.toString()),
          child: ScrollConfiguration(
            behavior: ScrollConfiguration.of(context).copyWith(
              dragDevices: const {
                PointerDeviceKind.touch,
                PointerDeviceKind.mouse,
                PointerDeviceKind.trackpad,
                PointerDeviceKind.stylus,
              },
            ),
            child: SingleChildScrollView(
              key: const ValueKey('tarot-fan-scroll'),
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              physics: widget.busy
                  ? const NeverScrollableScrollPhysics()
                  : null,
              child: SizedBox(
                width: layout.trackWidth,
                height: layout.height,
                child: AnimatedBuilder(
                  animation: _scroll,
                  builder: (context, _) {
                    final offset = _scroll.hasClients
                        ? _scroll.offset
                        : layout.maxScroll / 2;
                    return Stack(
                      children: [
                        for (var slot = 0; slot < layout.slotCount; slot++)
                          if (!widget.selectedSlots.contains(slot))
                            if (layout.pose(slot, offset) case final pose?)
                              Positioned(
                                key: ValueKey('tarot-slot-$slot'),
                                left:
                                    layout.center(slot) - layout.cardWidth / 2,
                                top: layout.cardTop + pose.depth,
                                width: layout.cardWidth,
                                height: layout.cardHeight,
                                child: Transform.rotate(
                                  angle: pose.angle,
                                  child: Opacity(
                                    opacity: pose.opacity,
                                    child: Builder(
                                      builder: (cardContext) {
                                        void pick() {
                                          final box =
                                              cardContext.findRenderObject()!
                                                  as RenderBox;
                                          widget.choose(slot, (
                                            frame: Rect.fromCenter(
                                              center: box.localToGlobal(
                                                box.size.center(Offset.zero),
                                              ),
                                              width: box.size.width,
                                              height: box.size.height,
                                            ),
                                            angle: pose.angle,
                                            opacity: pose.opacity,
                                          ));
                                        }

                                        return Semantics(
                                          button: true,
                                          label: context
                                              .uiLabel('选取第 {index} 张牌')
                                              .replaceFirst(
                                                '{index}',
                                                (slot + 1).toString(),
                                              ),
                                          enabled: !widget.busy,
                                          onTap: widget.busy ? null : pick,
                                          excludeSemantics: true,
                                          child: Material(
                                            elevation: 3,
                                            shape: const TarotCardShape(),
                                            clipBehavior: Clip.antiAlias,
                                            child: Stack(
                                              fit: StackFit.expand,
                                              children: [
                                                TarotBackArt(
                                                  animated: widget.animateBacks,
                                                ),
                                                InkWell(
                                                  onTap: widget.busy
                                                      ? null
                                                      : pick,
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
