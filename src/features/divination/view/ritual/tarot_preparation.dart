import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'tarot_deck.dart';

class TarotDeckPreparation extends StatefulWidget {
  const TarotDeckPreparation({
    super.key,
    required this.slotCount,
    required this.cutIndex,
    required this.seed,
    required this.initialProgress,
    required this.active,
    required this.reducedMotion,
    required this.progress,
    required this.finish,
    this.fanExtraHeight = 0,
  });

  final int slotCount;
  final int? cutIndex;
  final int seed;
  final double initialProgress;
  final bool active;
  final bool reducedMotion;
  final ValueChanged<double> progress;
  final VoidCallback finish;
  final double fanExtraHeight;

  @override
  State<TarotDeckPreparation> createState() => _TarotDeckPreparationState();
}

class _TarotDeckPreparationState extends State<TarotDeckPreparation>
    with SingleTickerProviderStateMixin {
  late final _animation = AnimationController(
    vsync: this,
    value: widget.initialProgress,
    duration: Duration(milliseconds: _duration),
  );
  bool _finished = false;
  int get _duration => widget.cutIndex == null ? 3300 : 5700;

  @override
  void initState() {
    super.initState();
    _animation.addListener(() => widget.progress(_animation.value));
    _animation.addStatusListener((status) {
      if (status == AnimationStatus.completed) _finish();
    });
    _updatePlayback();
  }

  @override
  void didUpdateWidget(TarotDeckPreparation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active ||
        oldWidget.reducedMotion != widget.reducedMotion)
      _updatePlayback();
  }

  void _updatePlayback() {
    if (!widget.active) {
      _animation.stop();
    } else if (widget.reducedMotion || _animation.isCompleted) {
      _animation.stop();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _finish();
      });
    } else {
      _animation.forward();
    }
  }

  void _finish() {
    if (_finished || !widget.active) return;
    _finished = true;
    widget.progress(1);
    widget.finish();
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final layout = TarotFanLayout(
        constraints.maxWidth,
        widget.slotCount,
        extraHeight: widget.fanExtraHeight,
      );
      final height = layout.height;
      final (scene, spreadOrder) = _createScene(
        layout,
        widget.cutIndex,
        widget.seed,
      );
      final theme = Theme.of(context);
      final animateBacks = widget.active && !widget.reducedMotion;
      return AnimatedBuilder(
        animation: _animation,
        builder: (context, _) {
          final time = _animation.value * _duration;
          final status = switch (time) {
            >= 5420 => '牌阵已就绪',
            >= 3270 when widget.cutIndex != null => '正在切牌…',
            >= 2360 => '正在铺牌…',
            >= 1800 => '正在整理牌堆…',
            _ => '正在洗牌…',
          };
          final cards = time >= 4730 ? spreadOrder : scene;
          return Column(
            children: [
              SizedBox(
                height: tarotDeckControlHeight,
                child: Center(
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      context.uiLabel(status),
                      key: const ValueKey('tarot-preparation-status'),
                      style: theme.textTheme.titleMedium,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
              ExcludeSemantics(
                child: SizedBox(
                  key: const ValueKey('tarot-preparation-stage'),
                  width: layout.width,
                  height: height,
                  child: ClipRect(
                    child: Stack(
                      children: [
                        for (final card in cards)
                          if (card.slot != widget.cutIndex ||
                              time < 3270 ||
                              time >= 3840)
                            _motionCard(
                              layout,
                              height,
                              card.at(time),
                              animateBack: animateBacks,
                            ),
                        if (time >= 3270 && time < 3840)
                          for (final card in cards)
                            if (card.slot == widget.cutIndex)
                              _motionCard(
                                layout,
                                height,
                                card.at(time),
                                animateBack: animateBacks,
                                marker: theme.colorScheme.primary,
                              ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

Widget _motionCard(
  TarotFanLayout layout,
  double height,
  _Pose pose, {
  required bool animateBack,
  Color? marker,
}) => Positioned(
  left: (layout.width - layout.cardWidth) / 2 + pose.offset.dx,
  top: (height - layout.cardHeight) / 2 + pose.offset.dy,
  width: layout.cardWidth,
  height: layout.cardHeight,
  child: Transform.rotate(
    angle: pose.angle,
    child: Transform.scale(
      scale: pose.scale,
      child: Opacity(
        opacity: pose.opacity,
        child: Material(
          elevation: 3,
          shape: const TarotCardShape(),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              TarotBackArt(animated: animateBack),
              if (marker != null)
                DecoratedBox(
                  key: const ValueKey('tarot-cut-marker'),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.all(
                      TarotCardShape.corner(layout.cardWidth),
                    ),
                    border: Border.all(color: marker, width: 2),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
  ),
);

typedef _Pose = ({Offset offset, double angle, double scale, double opacity});
typedef _Frame = ({double time, _Pose pose});

_Pose _pose(
  double x,
  double y,
  double angle, [
  double scale = 1,
  double opacity = 1,
]) => (offset: Offset(x, y), angle: angle, scale: scale, opacity: opacity);

class _DeckMotion {
  const _DeckMotion(this.slot, this.frames);
  final int slot;
  final List<_Frame> frames;

  _Pose at(double time) {
    for (var i = 1; i < frames.length; i++) {
      final next = frames[i];
      if (time > next.time) continue;
      final former = frames[i - 1];
      final t = (time - former.time) / (next.time - former.time);
      final eased = Curves.easeInOut.transform(t.clamp(0.0, 1.0));
      return (
        offset: Offset.lerp(former.pose.offset, next.pose.offset, eased)!,
        angle:
            former.pose.angle + (next.pose.angle - former.pose.angle) * eased,
        scale:
            former.pose.scale + (next.pose.scale - former.pose.scale) * eased,
        opacity:
            former.pose.opacity +
            (next.pose.opacity - former.pose.opacity) * eased,
      );
    }
    return frames.last.pose;
  }
}

(List<_DeckMotion>, List<_DeckMotion>) _createScene(
  TarotFanLayout layout,
  int? cut,
  int seed,
) {
  final height = layout.height;
  final scroll = layout.maxScroll / 2;
  final spread = <({int slot, _Pose pose})>[
    for (var slot = 0; slot < layout.slotCount; slot++)
      if (layout.pose(slot, scroll) case final arc?)
        (
          slot: slot,
          pose: _pose(
            layout.center(slot) - scroll - layout.width / 2,
            layout.cardTop + layout.cardHeight / 2 - height / 2 + arc.depth,
            arc.angle,
            1,
            arc.opacity,
          ),
        ),
  ];
  if (spread.isEmpty) return (const [], const []);
  final split = cut == null
      ? 0
      : (cut - spread.first.slot)
            .clamp(1, math.max(1, spread.length - 1))
            .toInt();
  final scene = [
    for (var index = 0; index < spread.length; index++)
      _makeCardMotion(layout, height, spread, index, cut, split, seed),
  ];
  return (scene, [...scene.skip(split), ...scene.take(split)]);
}

_DeckMotion _makeCardMotion(
  TarotFanLayout layout,
  double height,
  List<({int slot, _Pose pose})> fan,
  int index,
  int? cut,
  int split,
  int seed,
) {
  final card = fan[index];
  final depth = index - (fan.length - 1) / 2;
  final stack = _pose(depth * 0.23, depth * 0.48, depth * 0.003);
  final rng = math.Random(seed ^ (card.slot * 7919));
  final radius =
      math.sqrt(
        layout.cardWidth * layout.cardWidth +
            layout.cardHeight * layout.cardHeight,
      ) /
      2;
  final x = math.max(0.0, layout.width / 2 - radius - 5);
  final y = math.max(0.0, height / 2 - radius - 6);
  _Pose scatter() => _pose(
    (rng.nextDouble() * 2 - 1) * x,
    (rng.nextDouble() * 2 - 1) * y,
    (rng.nextDouble() * 2 - 1) * 1.8,
    0.94,
  );
  final frames = <_Frame>[
    (time: 0, pose: stack),
    for (final time in const [440, 820, 1190, 1610])
      (time: time + 100 * rng.nextDouble(), pose: scatter()),
    (time: 2200, pose: stack),
    (time: 2360.0 + 310 * index / fan.length, pose: stack),
    (time: 3190, pose: card.pose),
  ];
  if (cut != null) {
    final side = index >= split ? 1 : -1;
    final packet = side * layout.width * 0.23;
    final launch = _pose(packet + depth * 0.4, depth * 0.42, side * 0.08, 0.82);
    frames.addAll([
      (time: 3270, pose: card.pose),
      (
        time: 3480,
        pose: _pose(
          card.pose.offset.dx + side * 8,
          card.pose.offset.dy - (card.slot == cut ? 18 : 0),
          card.pose.angle,
          card.slot == cut ? 1.035 : 1,
        ),
      ),
      (time: 3840, pose: launch),
      (time: 3900, pose: launch),
      (time: 4330, pose: _pose(0, -side * height * 0.225, 0, 0.82)),
      (
        time: 4730,
        pose: _pose(-packet + depth * 0.4, depth * 0.42, -side * 0.08, 0.82),
      ),
      (time: 5420, pose: fan[(index - split) % fan.length].pose),
    ]);
  }
  return _DeckMotion(card.slot, frames);
}
