import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

const tarotAspectRatio = 0.58;
const tarotBack = 'src/features/divination/assets/tarot/back.jpg';

class TarotFanLayout {
  TarotFanLayout(this.width, this.slotCount)
    : cardWidth = (width * 0.29).clamp(64.0, 114.0);

  final double width;
  final int slotCount;
  final double cardWidth;

  double get cardHeight => cardWidth / tarotAspectRatio;
  double get step => math.max(22.0, cardWidth * 0.30);
  double get span => math.max(0, slotCount - 1) * step;
  double get reach =>
      (cardWidth * math.cos(math.pi / 5) + cardHeight * math.sin(math.pi / 5)) /
      2;
  double get arcDepth => cardHeight * 0.29;
  double get trackWidth => math.max(width, span + 2 * reach.ceil());
  double get maxScroll => trackWidth - width;
  double get height => cardHeight + arcDepth + 24;
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

class TarotBackArt extends StatelessWidget {
  const TarotBackArt({super.key});

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(6),
    child: Image.asset(
      tarotBack,
      fit: BoxFit.cover,
      excludeFromSemantics: true,
    ),
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
    required this.choose,
  });

  final TarotFanLayout layout;
  final Set<int> selectedSlots;
  final bool busy;
  final bool reducedMotion;
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
        AnimatedBuilder(
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
                                top: 10 + pose.depth,
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
                                            borderRadius: BorderRadius.circular(
                                              6,
                                            ),
                                            clipBehavior: Clip.antiAlias,
                                            child: Stack(
                                              fit: StackFit.expand,
                                              children: [
                                                const TarotBackArt(),
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
