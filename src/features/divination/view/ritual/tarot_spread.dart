import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import 'tarot_deck.dart';

typedef _PlacedCard = ({int slot, Offset center, double angle});
typedef _CardSpacing = ({double gap, double skew, double offset});

/// The packet follows the pointer and leaves one real slot at each interval.
class TarotSpread {
  TarotSpread(this.slotCount, {required int seed}) {
    final random = math.Random(seed);
    _spacing = List.generate(
      slotCount,
      (_) => (
        gap: 2.6 + 4.0 * math.pow(random.nextDouble(), 1.4),
        skew: (random.nextDouble() - .5) * .072,
        offset: (random.nextDouble() - .5) * 2.4,
      ),
    );
  }

  final int slotCount;
  late final List<_CardSpacing> _spacing;
  final _placed = <_PlacedCard>[];
  int _nextSlot = 0;
  double _distance = 0;
  Offset _center = TarotTableLayout.initialPile;
  double _angle = TarotTableLayout.initialAngle;

  int _remaining(Set<int> held) =>
      slotCount -
      _nextSlot -
      held.where((slot) => slot >= _nextSlot && slot < slotCount).length;

  void _push(TarotTableLayout layout, Offset target, Set<int> held) {
    final start = layout.cardCenter(_center);
    final destination = layout.normalizeCenter(target);
    final delta = layout.cardCenter(destination) - start;
    final travel = delta.distance;
    if (travel == 0) return;

    final heading = delta.direction;
    final tangent =
        math.atan2(math.sin(2 * heading), math.cos(2 * heading)) / 2;
    final angle = lerpDouble(_angle, tangent * .24, (travel / 18).clamp(0, 1))!;
    final direction = delta / travel;
    final normal = Offset(-direction.dy, direction.dx);
    var traversed = 0.0;
    while (_nextSlot < slotCount) {
      if (held.contains(_nextSlot)) {
        _nextSlot++;
        continue;
      }
      final spacing = _spacing[_nextSlot];
      final untilDrop = spacing.gap - _distance;
      if (traversed + untilDrop > travel) break;
      traversed += untilDrop;
      _distance = 0;
      _placed.add((
        slot: _nextSlot++,
        center: layout.normalizeCenter(
          start + direction * traversed + normal * spacing.offset,
        ),
        angle: lerpDouble(_angle, angle, traversed / travel)! + spacing.skew,
      ));
    }
    _distance += travel - traversed;
    _center = destination;
    _angle = angle;
  }
}

class TarotSpreadTable extends StatefulWidget {
  const TarotSpreadTable({
    super.key,
    required this.layout,
    required this.spread,
    required this.held,
    required this.busy,
    required this.reducedMotion,
    required this.animateBacks,
    required this.choose,
  });

  final TarotTableLayout layout;
  final TarotSpread spread;
  final Set<int> held;
  final bool busy;
  final bool reducedMotion;
  final bool animateBacks;
  final void Function(int slot, TarotCardOrigin origin) choose;

  @override
  State<TarotSpreadTable> createState() => _TarotSpreadTableState();
}

class _TarotSpreadTableState extends State<TarotSpreadTable> {
  final _table = GlobalKey();
  int? _pointer;
  int? _previewSlot;
  Offset _grip = Offset.zero;
  bool _focused = false;
  int _keyboardDirection = 1;

  TarotTableLayout get _layout => widget.layout;
  TarotSpread get _spread => widget.spread;
  Offset get _pileCenter => _layout.cardCenter(_spread._center);
  int get _remaining => _spread._remaining(widget.held);
  bool get _available => !widget.busy && _remaining > 0;

  @override
  void didUpdateWidget(TarotSpreadTable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_available ||
        oldWidget.spread != _spread ||
        oldWidget.layout.centerBounds != _layout.centerBounds) {
      _pointer = null;
    }
    if (oldWidget.spread != _spread || widget.held.contains(_previewSlot)) {
      _previewSlot = null;
    }
  }

  Offset _local(Offset global) =>
      (_table.currentContext!.findRenderObject()! as RenderBox).globalToLocal(
        global,
      );

  void _hold(PointerDownEvent event) {
    if (!_available || _pointer != null || event.buttons != kPrimaryButton)
      return;
    setState(() {
      _pointer = event.pointer;
      _grip = _local(event.position) - _pileCenter;
      _previewSlot = null;
    });
  }

  void _move(PointerMoveEvent event) {
    if (!_available || event.pointer != _pointer) return;
    _push(_local(event.position) - _grip);
  }

  void _release(PointerEvent event) {
    if (event.pointer == _pointer) setState(() => _pointer = null);
  }

  void _push(Offset target) {
    if (_layout.normalizeCenter(target) == _spread._center) return;
    setState(() {
      _previewSlot = null;
      _spread._push(_layout, target, widget.held);
      if (_remaining == 0) _pointer = null;
    });
  }

  void _advance() {
    if (!_available || _pointer != null) return;
    final bounds = _layout.centerBounds;
    final center = _pileCenter;
    final atEdge = _keyboardDirection > 0
        ? center.dx >= bounds.right - 1
        : center.dx <= bounds.left + 1;
    if (atEdge) {
      _keyboardDirection = -_keyboardDirection;
      final lift = bounds.height * .28;
      _push(center + Offset(0, center.dy - lift >= bounds.top ? -lift : lift));
      return;
    }
    _push(center + Offset(42.0 * _keyboardDirection, 0));
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (!_available ||
        _pointer != null ||
        (event is! KeyDownEvent && event is! KeyRepeatEvent)) {
      return KeyEventResult.ignored;
    }
    final direction = switch (event.logicalKey) {
      LogicalKeyboardKey.arrowLeft => const Offset(-36, 0),
      LogicalKeyboardKey.arrowRight => const Offset(36, 0),
      LogicalKeyboardKey.arrowUp => const Offset(0, -36),
      LogicalKeyboardKey.arrowDown => const Offset(0, 36),
      _ => null,
    };
    if (direction != null) {
      _push(_pileCenter + direction);
    } else if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.space) {
      _advance();
    } else {
      return KeyEventResult.ignored;
    }
    return KeyEventResult.handled;
  }

  void _pick(_PlacedCard card, BuildContext context) {
    if (widget.busy || _pointer != null || widget.held.contains(card.slot))
      return;
    if (_previewSlot != card.slot) {
      setState(() => _previewSlot = card.slot);
      return;
    }
    final box = context.findRenderObject()! as RenderBox;
    setState(() => _previewSlot = null);
    widget.choose(card.slot, (
      frame: Rect.fromCenter(
        center: box.localToGlobal(box.size.center(Offset.zero)),
        width: box.size.width,
        height: box.size.height,
      ),
      angle: card.angle,
      opacity: 1,
    ));
  }

  Widget _card(_PlacedCard card, bool highlighted) {
    final rect = _layout.cardSize;
    final center = _layout.cardCenter(card.center);
    final enabled = !widget.busy && _pointer == null;
    return Positioned(
      key: ValueKey('tarot-slot-${card.slot}'),
      left: center.dx - rect.width / 2,
      top: center.dy - rect.height / 2,
      width: rect.width,
      height: rect.height,
      child: Transform.rotate(
        angle: card.angle,
        child: Builder(
          builder: (context) {
            final tap = enabled ? () => _pick(card, context) : null;
            return Semantics(
              button: true,
              enabled: enabled,
              selected: highlighted,
              label: context
                  .uiLabel('选取第 {index} 张牌')
                  .replaceFirst('{index}', '${card.slot + 1}'),
              hint: highlighted ? context.uiLabel('再点同一张牌放入卡槽') : null,
              onTap: tap,
              excludeSemantics: true,
              child: Material(
                elevation: highlighted ? 3 : 1,
                shape: const TarotCardShape(),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    TarotBackArt(animated: highlighted && widget.animateBacks),
                    if (highlighted)
                      TweenAnimationBuilder<double>(
                        key: const ValueKey('tarot-preview-light'),
                        tween: Tween(begin: 0, end: 1),
                        duration: widget.reducedMotion
                            ? Duration.zero
                            : const Duration(milliseconds: 330),
                        builder: (_, phase, _) =>
                            CustomPaint(painter: _GoldSweep(phase)),
                      ),
                    InkWell(onTap: tap, splashFactory: NoSplash.splashFactory),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _packet(ColorScheme colors) => Positioned(
    key: const ValueKey('tarot-packet'),
    left: _pileCenter.dx - _layout.cardWidth / 2,
    top: _pileCenter.dy - _layout.cardHeight / 2,
    width: _layout.cardWidth,
    height: _layout.cardHeight,
    child: Transform.rotate(
      angle: _spread._angle,
      child: Focus(
        canRequestFocus: _available,
        onFocusChange: (value) {
          if (mounted) setState(() => _focused = value);
        },
        onKeyEvent: _handleKey,
        child: Semantics(
          container: true,
          button: true,
          enabled: _available,
          label: context.uiLabel('推开牌堆'),
          hint: context.uiLabel('按住牌堆，沿任意方向推开'),
          onTap: _available ? _advance : null,
          child: MouseRegion(
            cursor: !_available
                ? MouseCursor.defer
                : _pointer == null
                ? SystemMouseCursors.grab
                : SystemMouseCursors.grabbing,
            child: Listener(
              onPointerDown: _hold,
              onPointerMove: _move,
              onPointerUp: _release,
              onPointerCancel: _release,
              child: RawGestureDetector(
                behavior: HitTestBehavior.opaque,
                gestures: _available
                    ? <Type, GestureRecognizerFactory>{
                        EagerGestureRecognizer:
                            GestureRecognizerFactoryWithHandlers<
                              EagerGestureRecognizer
                            >(
                              () => EagerGestureRecognizer(
                                allowedButtonsFilter: (buttons) =>
                                    buttons == kPrimaryButton,
                              ),
                              (_) {},
                            ),
                      }
                    : const <Type, GestureRecognizerFactory>{},
                child: DecoratedBox(
                  position: DecorationPosition.foreground,
                  decoration: BoxDecoration(
                    border: _focused
                        ? Border.all(color: colors.primary, width: 2)
                        : null,
                    borderRadius: BorderRadius.all(
                      TarotCardShape.corner(_layout.cardWidth),
                    ),
                  ),
                  child: TarotPileArt(
                    count: _remaining,
                    cardWidth: _layout.cardWidth,
                    animated: widget.animateBacks,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final available = [
      for (final card in _spread._placed)
        if (!widget.held.contains(card.slot)) card,
    ];
    final highlighted = available
        .where((card) => card.slot == _previewSlot)
        .firstOrNull;
    final instruction = highlighted != null
        ? '再点同一张牌放入卡槽'
        : available.isEmpty
        ? '按住牌堆，沿任意方向推开'
        : '点一张摊开的牌预选';
    return Column(
      children: [
        SizedBox(
          height: tarotDeckControlHeight,
          child: Center(
            child: Semantics(
              liveRegion: true,
              child: UiText(
                instruction,
                maxLines: 2,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium,
              ),
            ),
          ),
        ),
        Semantics(
          label: context
              .uiLabel('{count} 张塔罗牌阵')
              .replaceFirst('{count}', '${_spread.slotCount}'),
          container: true,
          explicitChildNodes: true,
          child: SizedBox(
            key: const ValueKey('tarot-spread-stage'),
            width: _layout.width,
            height: _layout.height,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: RepaintBoundary(
                child: DecoratedBox(
                  key: _table,
                  decoration: BoxDecoration(
                    color: colors.surfaceContainerLow.withValues(alpha: .64),
                    border: Border.all(color: colors.outlineVariant),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    children: [
                      for (final card in available)
                        if (card.slot != _previewSlot) _card(card, false),
                      if (highlighted != null) _card(highlighted, true),
                      if (_remaining > 0) _packet(colors),
                      if (_remaining > 0)
                        PositionedDirectional(
                          bottom: 10,
                          end: 12,
                          child: IgnorePointer(
                            child: Text(
                              context
                                  .uiLabel('牌堆还剩 {count} 张')
                                  .replaceFirst('{count}', '$_remaining'),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: colors.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GoldSweep extends CustomPainter {
  const _GoldSweep(this.phase);

  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    if (phase < 1) {
      final center = Offset(size.width, size.height) * (-.48 + phase * 1.96);
      final shader =
          const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0x00ffe0a2),
              Color(0x9cffe0a2),
              Color(0xeefef2cf),
              Color(0x00ffe0a2),
            ],
            stops: [0, .40, .53, 1],
          ).createShader(
            Rect.fromCenter(
              center: center,
              width: size.width * .68,
              height: size.height * .52,
            ),
          );
      canvas.drawRect(bounds, Paint()..shader = shader);
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        bounds.deflate(1),
        TarotCardShape.corner(size.width),
      ),
      Paint()
        ..color = const Color(0xffd6a850)
        ..strokeWidth = 1.8
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_GoldSweep oldDelegate) => oldDelegate.phase != phase;
}
