import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'coin_toss_motion.dart';

const coinFrontAsset =
    'src/features/divination/assets/coins/qianlong-front.png';
const coinBackAsset = 'src/features/divination/assets/coins/qianlong-back.png';
const coinShellAsset =
    'src/features/divination/assets/ritual/tortoise-shell-side.png';
const _brass = Color(0xffb38b45);
const _floorCenter = Offset(160, 160);

class CoinCastScene extends StatefulWidget {
  const CoinCastScene({
    super.key,
    required this.progress,
    required this.faces,
    required this.previous,
    required this.values,
    required this.moving,
    required this.tossing,
    required this.flowing,
    required this.stageHeightLimit,
  });

  final Animation<double> progress;
  final List<int>? faces;
  final List<int>? previous;
  final List<int> values;
  final bool moving;
  final bool tossing;
  final bool flowing;
  final double stageHeightLimit;

  @override
  State<CoinCastScene> createState() => _CoinCastSceneState();
}

class _CoinCastSceneState extends State<CoinCastScene>
    with SingleTickerProviderStateMixin {
  late final _gold = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4800),
  );

  @override
  void initState() {
    super.initState();
    if (widget.flowing) _gold.repeat();
  }

  @override
  void didUpdateWidget(CoinCastScene oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.flowing == widget.flowing) return;
    if (widget.flowing) {
      _gold.repeat();
    } else {
      _gold.stop();
      _gold.value = 0;
    }
  }

  @override
  void dispose() {
    _gold.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final result = widget.faces;
    return Semantics(
      container: true,
      label: widget.tossing
          ? context.uiLabel('正在投掷三枚铜钱')
          : result == null
          ? context.uiLabel('三枚铜钱，待投掷')
          : [
              for (final (index, face) in result.indexed)
                context
                    .uiLabel('第 {index} 枚铜钱，{face}')
                    .replaceFirst('{index}', '${index + 1}')
                    .replaceFirst(
                      '{face}',
                      context.uiLabel(face == 2 ? '字面' : '背面'),
                    ),
            ].join(context.uiLabel('；')),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = math.min(560.0, constraints.maxWidth);
          final heightLimit = widget.stageHeightLimit;
          final layout = coinStageLayout(width, heightLimit: heightLimit);
          final radius = BorderRadius.circular(18);
          return Center(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: radius,
                border: Border.all(color: colors.outlineVariant),
              ),
              child: ClipRRect(
                borderRadius: radius,
                child: SizedBox(
                  key: const ValueKey('coin-ritual-stage'),
                  width: width,
                  height: layout.height,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      RepaintBoundary(
                        child: CustomPaint(painter: _CastingFloor(colors)),
                      ),
                      if (widget.flowing)
                        RepaintBoundary(
                          key: const ValueKey('coin-ritual-gold'),
                          child: CustomPaint(
                            painter: _CastingFlow(
                              _gold,
                              tossing: widget.tossing,
                            ),
                          ),
                        ),
                      RepaintBoundary(
                        child: AnimatedBuilder(
                          animation: widget.progress,
                          builder: (context, _) {
                            final time = widget.moving
                                ? widget.progress.value
                                : 1.0;
                            final poses = [
                              for (var index = 0; index < 3; index++)
                                coinTossPose(
                                  time,
                                  index,
                                  result?[index] ?? 2,
                                  width,
                                  previous: widget.previous?[index] ?? 2,
                                  heightLimit: heightLimit,
                                ),
                            ];
                            return Stack(
                              fit: StackFit.expand,
                              children: [
                                CustomPaint(
                                  painter: _TossDetails(
                                    progress: time,
                                    values: widget.values,
                                    poses: poses,
                                    colors: colors,
                                    moving: widget.moving,
                                    coinSize: layout.coinSize,
                                  ),
                                ),
                                for (final (index, pose) in poses.indexed)
                                  _Coin(
                                    index: index,
                                    pose: pose,
                                    size: layout.coinSize,
                                    thickness: layout.thickness,
                                  ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Coin extends StatelessWidget {
  const _Coin({
    required this.index,
    required this.pose,
    required this.size,
    required this.thickness,
  });

  final int index;
  final CoinPose pose;
  final double size;
  final double thickness;

  Widget _layer(double depth, Widget child, {bool reverse = false}) =>
      Positioned.fill(
        child: Transform.translate(
          offset: Offset(depth * pose.faceOffsetX, depth * pose.faceOffsetY),
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 1 / 600)
              ..rotateX(pose.tilt)
              ..rotateY(pose.flip + (reverse ? math.pi : 0)),
            child: child,
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final face = visibleCoinFace(pose);
    return Positioned(
      key: ValueKey('coin-ritual-coin-$index'),
      left: pose.x - size / 2,
      top: pose.y - size / 2,
      width: size,
      height: size,
      child: Transform.scale(
        scale: pose.scale,
        child: Transform.rotate(
          angle: pose.spin,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              for (final depth in const [-1.0, 0.0, 1.0])
                _layer(depth, const _CoinArt(front: true, metal: true)),
              Positioned(
                left: size * 0.05,
                right: size * 0.05,
                top: (size - thickness) / 2,
                height: thickness,
                child: Transform.rotate(
                  angle: pose.edgeAngle,
                  child: Opacity(
                    opacity: pose.edgeOpacity,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(thickness / 2),
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Color(0xffb59c72),
                            Color(0xff96805b),
                            Color(0xff63533f),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // Both textures stay mounted and ready while the visible side changes.
              for (final side in const [2, 3])
                _layer(
                  side == 2 ? 1 : -1,
                  Offstage(
                    offstage: face != side,
                    child: _CoinArt(
                      key: ValueKey('coin-ritual-face-$index-$side'),
                      front: side == 2,
                    ),
                  ),
                  reverse: side == 3,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CoinArt extends StatelessWidget {
  const _CoinArt({super.key, required this.front, this.metal = false});

  final bool front;
  final bool metal;

  @override
  Widget build(BuildContext context) => Image.asset(
    front ? coinFrontAsset : coinBackAsset,
    color: metal ? const Color(0xff99805b) : null,
    colorBlendMode: BlendMode.modulate,
    excludeFromSemantics: true,
    fit: BoxFit.contain,
    errorBuilder: (_, _, _) => DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _brass,
        border: Border.all(color: const Color(0xff665034), width: 2),
      ),
    ),
  );
}

final _rim = _octagon(146.0);
final _innerRim = _octagon(117.0);
final _rimTrack = _rim.computeMetrics().single;
final _goldRing = Rect.fromCircle(center: _floorCenter, radius: 82);

Path _octagon(double radius) => Path()
  ..addPolygon([
    for (var index = 0; index < 8; index++)
      _floorCenter +
          Offset(
                math.sin(index * math.pi / 4),
                -math.cos(index * math.pi / 4),
              ) *
              radius,
  ], true);

void _placeFloor(Canvas canvas, Size size) {
  canvas.translate(0, size.height * 0.50);
  canvas.scale(size.width / 320, size.height * 0.48 / 320);
}

class _CastingFloor extends CustomPainter {
  const _CastingFloor(this.colors);

  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _placeFloor(canvas, size);
    final floor = Rect.fromCenter(
      center: _floorCenter,
      width: 320,
      height: 310,
    );
    final cream = RadialGradient(
      colors: [
        colors.primaryContainer.withValues(alpha: 0.85),
        colors.surface.withValues(alpha: 0),
      ],
    );
    canvas.drawOval(floor, Paint()..shader = cream.createShader(floor));
    final outline = Paint()
      ..color = colors.primary.withValues(alpha: 0.32)
      ..strokeWidth = 0.9
      ..style = PaintingStyle.stroke;
    canvas.drawPath(_rim, outline);
    canvas.drawPath(_innerRim, outline);
    canvas.drawCircle(_floorCenter, 82, outline);
    canvas.drawCircle(_floorCenter, 70, outline);

    final bars = Paint()
      ..color = colors.primary.withValues(alpha: 0.32)
      ..strokeWidth = 3;
    for (var index = 0; index < 8; index++) {
      canvas.save();
      canvas.translate(160, 160);
      canvas.rotate(index * math.pi / 4);
      for (var line = 0; line < 3; line++) {
        final y = -121.0 + line * 7;
        if ((index >> line) & 1 != 0) {
          canvas.drawLine(Offset(-14, y), Offset(14, y), bars);
        } else {
          canvas.drawLine(Offset(-14, y), Offset(-3, y), bars);
          canvas.drawLine(Offset(3, y), Offset(14, y), bars);
        }
      }
      canvas.restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CastingFloor old) => colors != old.colors;
}

class _CastingFlow extends CustomPainter {
  _CastingFlow(this.flow, {required this.tossing}) : super(repaint: flow);

  final Animation<double> flow;
  final bool tossing;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _placeFloor(canvas, size);
    final progress = flow.value;
    final brightness = tossing ? 1.0 : 0.90;
    final ink = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final half in [0.0, 0.5]) {
      final from = (progress + half) * 2 * math.pi;
      final start = ((1 - progress + half) % 1) * _rimTrack.length;
      for (final (weight, alpha, length) in const [
        (8.0, 0.16, 104.0),
        (4.4, 0.28, 76.0),
        (2.7, 0.46, 46.0),
      ]) {
        ink
          ..color = _brass.withValues(alpha: alpha * brightness)
          ..strokeWidth = weight;
        canvas.drawArc(_goldRing, from, length / 82, false, ink);
      }
      for (final (weight, alpha, length) in const [
        (8.0, 0.14, 164.0),
        (4.0, 0.30, 124.0),
        (2.2, 0.46, 82.0),
      ]) {
        ink
          ..color = _brass.withValues(alpha: alpha * brightness)
          ..strokeWidth = weight;
        final end = start + length;
        canvas.drawPath(
          _rimTrack.extractPath(start, math.min(end, _rimTrack.length)),
          ink,
        );
        if (end > _rimTrack.length) {
          canvas.drawPath(
            _rimTrack.extractPath(0, end - _rimTrack.length),
            ink,
          );
        }
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CastingFlow old) =>
      tossing != old.tossing || flow != old.flow;
}

class _TossDetails extends CustomPainter {
  const _TossDetails({
    required this.progress,
    required this.values,
    required this.poses,
    required this.colors,
    required this.moving,
    required this.coinSize,
  });

  final double progress;
  final List<int> values;
  final List<CoinPose> poses;
  final ColorScheme colors;
  final bool moving;
  final double coinSize;

  @override
  void paint(Canvas canvas, Size size) {
    _hexagram(canvas, size);
    _shadows(canvas, size);
    if (moving && progress > 0.78) _sparks(canvas, size);
  }

  void _hexagram(Canvas canvas, Size size) {
    final x = size.width / 2;
    final opacity = moving ? ((progress - 0.72) / 0.24).clamp(0.22, 1.0) : 1.0;
    final recorded = Paint()..color = colors.primary.withValues(alpha: opacity);
    final empty = Paint()..color = colors.outlineVariant;
    for (var index = 0; index < 6; index++) {
      final y = size.height * 0.12 + index * 10.5;
      final line = 5 - index;
      if (line >= values.length) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset(x, y), width: 25, height: 2),
            const Radius.circular(1),
          ),
          empty,
        );
      } else if (values[line].isOdd) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset(x, y), width: 42, height: 4),
            const Radius.circular(1),
          ),
          recorded,
        );
      } else {
        for (final offset in [-11.5, 11.5]) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromCenter(
                center: Offset(x + offset, y),
                width: 18,
                height: 4,
              ),
              const Radius.circular(1),
            ),
            recorded,
          );
        }
      }
    }
  }

  void _shadows(Canvas canvas, Size size) {
    for (final (index, pose) in poses.indexed) {
      final ground = coinRestingPosition(
        size.width,
        index,
        heightLimit: size.height,
      );
      final point = Offset(pose.x, ground.y + coinSize * 0.11);
      final width = coinSize * pose.shadowScale * 1.26;
      final height = width * 0.53;
      final shadow = Rect.fromCenter(
        center: Offset.zero,
        width: width,
        height: height,
      );
      canvas.save();
      canvas.translate(point.dx, point.dy);
      canvas.rotate(pose.spin * 0.25);
      canvas.drawOval(
        shadow,
        Paint()
          ..shader = RadialGradient(
            colors: [
              const Color(0xff281e16).withValues(alpha: pose.shadowOpacity),
              const Color(0x00281e16),
            ],
          ).createShader(shadow),
      );
      canvas.restore();
    }
  }

  void _sparks(Canvas canvas, Size size) {
    for (var index = 0; index < 10; index++) {
      final age = ((progress - (0.78 + index * 0.006)) / 0.17).clamp(0.0, 1.0);
      if (age == 0 || age == 1) continue;
      final startX = (index % 3 - 1) * size.width * 0.21;
      final endX = math.sin(index * 2.4) * 32;
      final x = size.width * 0.50 + startX + (endX - startX) * age;
      final y = size.height * (0.79 - age * (0.53 + index % 3 * 0.035));
      canvas.drawCircle(
        Offset(x, y),
        (1 - age) * 1.65,
        Paint()
          ..color = _brass.withValues(alpha: math.sin(age * math.pi) * 0.65),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TossDetails old) => true;
}
