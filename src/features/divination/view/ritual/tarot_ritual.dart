import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import 'tarot_deck.dart';

const _positions = ['现状', '关键影响', '趋势'];
const _approachMs = 400;
const _flashMs = 160;
const _hoverMs = 1000;
const _dropMs = 165;
const _transferMs = _approachMs + _hoverMs + _dropMs;
const _flightCurve = Cubic(.28, .28, .22, 1);
typedef _CardPose = ({
  Rect frame,
  double roll,
  double yaw,
  double opacity,
  double? hoverProgress,
});

class TarotRitualPanel extends StatefulWidget {
  const TarotRitualPanel({
    super.key,
    required this.slotCount,
    required this.selectedSlots,
    required this.draw,
    required this.revealed,
    required this.busy,
    required this.selectionBlocked,
    required this.active,
    required this.reducedMotion,
    required this.choose,
    required this.reveal,
    required this.finish,
    this.finishLabel = '查看解读',
    this.preparation,
    this.cardFlight,
    this.fanExtraHeight = 0,
  });

  final int slotCount;
  final List<int> selectedSlots;
  final TarotDraw? draw;
  final Set<int> revealed;
  final bool busy;
  final bool selectionBlocked;
  final bool active;
  final bool reducedMotion;
  final ValueChanged<int> choose;
  final ValueChanged<int?> reveal;
  final VoidCallback finish;
  final String finishLabel;
  final Widget? preparation;
  final ValueChanged<bool>? cardFlight;
  final double fanExtraHeight;

  @override
  State<TarotRitualPanel> createState() => _TarotRitualPanelState();
}

class _TarotRitualPanelState extends State<TarotRitualPanel>
    with SingleTickerProviderStateMixin {
  final _area = GlobalKey();
  final _targets = List.generate(_positions.length, (_) => GlobalKey());
  late final _motion = AnimationController(vsync: this)
    ..addStatusListener(_motionChanged);
  _CardFlight? _flight;
  Timer? _finalHold;
  ({_CardPose pose, double start})? _returning;
  bool _landed = false;
  bool _preloadedReflection = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_preloadedReflection || widget.reducedMotion) return;
    _preloadedReflection = true;
    unawaited(precacheImage(const AssetImage(tarotHoverLights), context));
  }

  @override
  void didUpdateWidget(TarotRitualPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_flight == null) return;
    if (!widget.active || widget.reducedMotion) {
      _finishFlight();
    } else {
      _syncFlight();
    }
  }

  @override
  void dispose() {
    _finalHold?.cancel();
    _motion.dispose();
    super.dispose();
  }

  void _motionChanged(AnimationStatus status) {
    if (status == AnimationStatus.completed) _syncFlight();
    if (status == AnimationStatus.dismissed && _returning != null) {
      _finishFlight();
    }
  }

  void _syncFlight() {
    final flight = _flight;
    if (flight == null || _returning != null || _landed) return;
    final accepted =
        widget.selectedSlots.elementAtOrNull(flight.index) == flight.slot;
    if (!accepted && !widget.busy) {
      final start = _motion.value;
      _returning = (pose: flight.poseAt(start), start: start);
      _motion.animateBack(
        0,
        duration: const Duration(milliseconds: 230),
        curve: _flightCurve,
      );
    } else if (accepted && _motion.isCompleted) {
      if (flight.index < _positions.length - 1) {
        _finishFlight();
      } else {
        setState(() => _landed = true);
        _finalHold = Timer(const Duration(milliseconds: 140), _finishFlight);
      }
    }
  }

  void _finishFlight() {
    _finalHold?.cancel();
    _finalHold = null;
    _motion.stop();
    setState(() {
      _flight = null;
      _returning = null;
      _landed = false;
    });
    // The controller can finish a transfer while this dialog is rebuilding.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _flight == null) widget.cardFlight?.call(false);
    });
  }

  void _choose(int slot, TarotCardOrigin origin) {
    final index = widget.selectedSlots.length;
    if (widget.busy ||
        widget.selectionBlocked ||
        _flight != null ||
        !widget.active ||
        index >= _positions.length) {
      return;
    }
    final targetContext = _targets[index].currentContext;
    final root = _area.currentContext?.findRenderObject();
    final target = targetContext?.findRenderObject();
    if (!widget.reducedMotion &&
        targetContext != null &&
        root is RenderBox &&
        target is RenderBox) {
      final from = origin.frame.shift(-root.localToGlobal(Offset.zero));
      final to =
          root.globalToLocal(target.localToGlobal(Offset.zero)) & target.size;
      unawaited(
        Scrollable.ensureVisible(
          targetContext,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart,
          duration: const Duration(milliseconds: _approachMs),
          curve: _flightCurve,
        ),
      );
      _motion.value = 0;
      setState(() {
        _flight = _CardFlight(
          slot: slot,
          index: index,
          from: from,
          to: to,
          angle: origin.angle,
          opacity: origin.opacity,
        );
      });
      widget.cardFlight?.call(true);
      _motion.animateTo(1, duration: const Duration(milliseconds: _transferMs));
    }
    widget.choose(slot);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final flight = _flight;
    final draw = widget.draw;
    final revealed =
        draw?.cards.every((card) => widget.revealed.contains(card.slot)) ??
        false;
    final held = widget.selectedSlots
        .take(
          flight == null || _landed
              ? widget.selectedSlots.length
              : flight.index,
        )
        .toList(growable: false);
    return Stack(
      key: _area,
      clipBehavior: Clip.none,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (draw != null) ...[
              UiText(
                '轻触牌面逐张翻开，或一键全翻',
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var index = 0; index < _positions.length; index++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _TarotPosition(
                        frame: _targets[index],
                        label: _positions[index],
                        occupied: index < held.length,
                        card: draw?.cards[index],
                        revealed:
                            draw != null &&
                            widget.revealed.contains(draw.cards[index].slot),
                        animateBack: widget.active && !widget.reducedMotion,
                        reducedMotion: widget.reducedMotion,
                        reveal: widget.reveal,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            if (draw != null) ...[
              FilledButton(
                onPressed: revealed ? widget.finish : () => widget.reveal(null),
                child: UiText(revealed ? widget.finishLabel : '一键翻牌'),
              ),
              if (revealed) ...[
                const SizedBox(height: 14),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Semantics(
                  header: true,
                  child: UiText('三张牌简读', style: theme.textTheme.titleSmall),
                ),
                for (final (index, card) in draw.cards.indexed)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${context.uiLabel(_positions[index])}  ',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          TextSpan(text: card.face.traditionalMeaning),
                        ],
                      ),
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
              ],
            ] else ...[
              Semantics(
                liveRegion: true,
                child: Text(
                  context
                      .uiLabel('已选 {count} / 3 张')
                      .replaceFirst('{count}', held.length.toString()),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 10),
              UiText(
                '左右滑动，凭感觉选出你的牌',
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              widget.preparation ??
                  LayoutBuilder(
                    builder: (context, size) => TarotRitualFan(
                      layout: TarotFanLayout(
                        size.maxWidth,
                        widget.slotCount,
                        extraHeight: widget.fanExtraHeight,
                      ),
                      selectedSlots: {
                        ...widget.selectedSlots,
                        if (flight != null) flight.slot,
                      },
                      busy:
                          widget.busy ||
                          widget.selectionBlocked ||
                          !widget.active ||
                          flight != null,
                      reducedMotion: widget.reducedMotion,
                      animateBacks: widget.active && !widget.reducedMotion,
                      choose: _choose,
                    ),
                  ),
            ],
          ],
        ),
        if (flight != null && !_landed)
          Positioned.fill(
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: AnimatedBuilder(
                  animation: _motion,
                  builder: (context, _) {
                    final flash = _motion.value * _transferMs / _flashMs;
                    final pose = switch (_returning) {
                      final returning? => flight.returnToFan(
                        returning.pose,
                        returning.start == 0
                            ? 1
                            : 1 - _motion.value / returning.start,
                      ),
                      null => flight.poseAt(_motion.value),
                    };
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fromRect(
                          key: const ValueKey('tarot-card-flight'),
                          rect: pose.frame,
                          child: Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()
                              ..setEntry(3, 2, -430 / (980 * pose.frame.width))
                              ..rotateZ(pose.roll)
                              ..rotateY(pose.yaw),
                            child: Opacity(
                              opacity: pose.opacity,
                              child: RepaintBoundary(
                                child: Material(
                                  elevation: 3,
                                  shape: const TarotCardShape(),
                                  clipBehavior: Clip.antiAlias,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      TarotBackArt(
                                        animated: true,
                                        hoverProgress: pose.hoverProgress,
                                      ),
                                      if (_returning == null && flash < 1)
                                        CustomPaint(
                                          key: const ValueKey(
                                            'tarot-card-flash',
                                          ),
                                          painter: _CardFlash(flash),
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
                  },
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _CardFlash extends CustomPainter {
  const _CardFlash(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width, size.height) * (progress * 1.84 - .42);
    final band = Rect.fromCenter(
      center: center,
      width: size.width * .66,
      height: size.height * .52,
    );
    final shader = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0x00ffe0a0),
        Color(0xb8ffdfa0),
        Color(0xfafff4d5),
        Color(0x00ffe0a0),
      ],
      stops: [0, .37, .53, 1],
    ).createShader(band);
    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_CardFlash oldDelegate) =>
      progress != oldDelegate.progress;
}

class _CardFlight {
  const _CardFlight({
    required this.slot,
    required this.index,
    required this.from,
    required this.to,
    required this.angle,
    required this.opacity,
  });

  final int slot;
  final int index;
  final Rect from;
  final Rect to;
  final double angle;
  final double opacity;

  _CardPose returnToFan(_CardPose start, double progress) => (
    frame: Rect.lerp(start.frame, from, progress)!,
    roll: lerpDouble(start.roll, angle, progress)!,
    yaw: start.yaw * (1 - progress),
    opacity: lerpDouble(start.opacity, opacity, progress)!,
    hoverProgress: null,
  );

  _CardPose poseAt(double t) {
    final elapsed = t * _transferMs;
    // Reserve room for the near edge to grow under perspective during the sway.
    final hover = Rect.fromCenter(
      center: to.center - Offset(0, to.height * .014),
      width: to.width * .86,
      height: to.height * .86,
    );
    if (elapsed < _approachMs) {
      final approach = _flightCurve.transform(
        ((elapsed - _flashMs) / (_approachMs - _flashMs)).clamp(0.0, 1.0),
      );
      final bend = approach * (1 - approach);
      final delta = hover.center - from.center;
      return (
        frame: Rect.fromCenter(
          center:
              from.center +
              Offset(
                delta.dx * (approach - .66 * bend),
                delta.dy * (approach + .44 * bend),
              ),
          width: lerpDouble(from.width, hover.width, approach)!,
          height: lerpDouble(from.height, hover.height, approach)!,
        ),
        roll: angle * (1 - approach),
        yaw: 0,
        opacity: lerpDouble(opacity, 1, approach)!,
        hoverProgress: null,
      );
    }
    final hoverProgress = ((elapsed - _approachMs) / _hoverMs).clamp(0.0, 1.0);
    final drop = ((elapsed - _approachMs - _hoverMs) / _dropMs).clamp(0.0, 1.0);
    return (
      frame: Rect.lerp(hover, to, Curves.easeInCubic.transform(drop))!,
      roll: 0,
      // As in the HTML, the yaw is the inverse of the -24° to +24° view angle.
      yaw: math.sin(hoverProgress * 2 * math.pi) * (24 * math.pi / 180),
      opacity: 1,
      hoverProgress: t < 1 ? hoverProgress : null,
    );
  }
}

class _TarotPosition extends StatelessWidget {
  const _TarotPosition({
    required this.frame,
    required this.label,
    required this.occupied,
    required this.card,
    required this.revealed,
    required this.animateBack,
    required this.reducedMotion,
    required this.reveal,
  });
  final GlobalKey frame;
  final String label;
  final bool occupied;
  final TarotDrawnCard? card;
  final bool revealed;
  final bool animateBack;
  final bool reducedMotion;
  final ValueChanged<int> reveal;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final drawn = card;
    final position = context.uiLabel(label);
    final tap = drawn != null && !revealed ? () => reveal(drawn.slot) : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          key: frame,
          aspectRatio: tarotAspectRatio,
          child: Semantics(
            button: tap != null,
            label: revealed && drawn != null
                ? drawn.face.card.name
                : context
                      .uiLabel(
                        tap != null
                            ? '翻开{position}牌'
                            : occupied
                            ? '{position}已选牌'
                            : '{position}空白卡位',
                      )
                      .replaceFirst('{position}', position),
            onTap: tap,
            excludeSemantics: true,
            child: Material(
              color: theme.colorScheme.surfaceContainerHighest,
              shape: const TarotCardShape(),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (drawn != null)
                    TweenAnimationBuilder<double>(
                      tween: Tween<double>(end: revealed ? 1 : 0),
                      duration: reducedMotion
                          ? Duration.zero
                          : const Duration(milliseconds: 330),
                      curve: Curves.easeOutCubic,
                      builder: (context, progress, _) {
                        final turned = progress >= 0.5;
                        return Transform(
                          alignment: Alignment.center,
                          transform: Matrix4.identity()
                            ..setEntry(3, 2, 0.0018)
                            ..rotateY(
                              (turned ? progress - 1 : progress) * math.pi,
                            ),
                          child: IndexedStack(
                            index: turned ? 1 : 0,
                            sizing: StackFit.expand,
                            children: [
                              TarotBackArt(animated: animateBack && !revealed),
                              RotatedBox(
                                quarterTurns:
                                    drawn.face.orientation ==
                                        TarotOrientation.reversed
                                    ? 2
                                    : 0,
                                child: Image.asset(
                                  'src/features/divination/assets/tarot/${drawn.face.card.id}.jpg',
                                  fit: BoxFit.contain,
                                  excludeFromSemantics: true,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  else if (occupied)
                    TarotBackArt(animated: animateBack)
                  else
                    Center(
                      child: Icon(
                        Icons.auto_awesome_outlined,
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  if (tap != null) InkWell(onTap: tap),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          position,
          textAlign: TextAlign.center,
          style: theme.textTheme.labelMedium,
        ),
        if (revealed && drawn != null) ...[
          Text(
            drawn.face.card.name,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
          UiText(
            drawn.face.orientation == TarotOrientation.reversed ? '逆位' : '正位',
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall,
          ),
        ],
      ],
    );
  }
}
