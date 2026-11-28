import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'coin_toss_motion.dart';

const coinFrontAsset =
    'src/features/divination/assets/coins/qianlong-front.png';
const coinBackAsset = 'src/features/divination/assets/coins/qianlong-back.png';
const coinCastLineNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const _brass = Color(0xffb38b45);
const _floorCenter = Offset(160, 160);
const _lineHeight = 4.0;
const _lineSpacing = 10.5;

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
    required this.stageHeadroom,
  });

  final Animation<double> progress;
  final List<int>? faces;
  final List<int>? previous;
  final List<int> values;
  final bool moving;
  final bool tossing;
  final bool flowing;
  final double stageHeightLimit;
  final double stageHeadroom;

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
    final values = widget.values;
    final pulse = widget.flowing && values.length < coinCastLineNames.length
        ? _gold
        : null;
    final lineSummary = [
      for (final (index, value) in values.indexed)
        '${context.uiLabel(coinCastLineNames[index])} $value',
    ].join(context.uiLabel('；'));
    return Semantics(
      container: true,
      explicitChildNodes: true,
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
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = math.min(560.0, constraints.maxWidth);
          final heightLimit = widget.stageHeightLimit;
          final headroom = widget.stageHeadroom;
          final layout = coinStageLayout(
            width,
            heightLimit: heightLimit,
            headroom: headroom,
          );
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
                        child: CustomPaint(
                          painter: _CastingPlate(layout.baseHeight),
                        ),
                      ),
                      if (widget.flowing)
                        RepaintBoundary(
                          key: const ValueKey('coin-ritual-gold'),
                          child: CustomPaint(
                            painter: _CastingFlow(
                              _gold,
                              tossing: widget.tossing,
                              baseHeight: layout.baseHeight,
                            ),
                          ),
                        ),
                      Positioned(
                        top: layout.baseHeight * 0.12 - _lineHeight / 2,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Semantics(
                            container: true,
                            label: context.uiLabel('六次投掷'),
                            value: lineSummary,
                            child: RepaintBoundary(
                              child: CustomPaint(
                                key: const ValueKey('coin-ritual-lines'),
                                size: Size(
                                  64,
                                  (coinCastLineNames.length - 1) *
                                          _lineSpacing +
                                      _lineHeight,
                                ),
                                painter: _HexagramLines(
                                  colors: colors,
                                  values: values,
                                  pulse: pulse,
                                ),
                              ),
                            ),
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
                                  headroom: headroom,
                                ),
                            ];
                            return Stack(
                              fit: StackFit.expand,
                              children: [
                                CustomPaint(
                                  painter: _TossDetails(
                                    progress: time,
                                    poses: poses,
                                    moving: widget.moving,
                                    coinSize: layout.coinSize,
                                    baseHeight: layout.baseHeight,
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

const _rimRise = 22.0;
final _rimCorners = _octagonCorners(146, _rimRise);
final _footCorners = _octagonCorners(130, -5);
final _rim = _roundedPolygon(_rimCorners);
final _foot = _roundedPolygon(_footCorners);
// The raised rim hides the rear half of the plate's foot.
final _plateBody = _roundedPolygon([
  ..._rimCorners.take(4),
  ..._footCorners.getRange(3, 6),
  ..._rimCorners.skip(5),
]);
final _rimCrest = _octagon(143, rise: _rimRise);
final _opening = _octagon(135, rise: _rimRise);
final _basin = _octagon(110);
final _rimTrack = _rimCrest.computeMetrics().single;
final _goldRing = Rect.fromCircle(center: _floorCenter, radius: 82);
final _rings = _octagon(106)
  ..addOval(_goldRing)
  ..addOval(Rect.fromCircle(center: _floorCenter, radius: 70));
final _trigrams = _engravedTrigrams();

List<Offset> _octagonCorners(double radius, double rise) => [
  for (var index = 0; index < 8; index++)
    _floorCenter +
        Offset(
          radius * math.sin(index * math.pi / 4),
          -radius * math.cos(index * math.pi / 4) - rise,
        ),
];

Path _octagon(double radius, {double rise = 0}) =>
    _roundedPolygon(_octagonCorners(radius, rise));

Path _roundedPolygon(List<Offset> corners) {
  final path = Path();
  const inset = 5.0;
  for (var index = 0; index < corners.length; index++) {
    final corner = corners[index];
    final before = corners[(index + corners.length - 1) % corners.length];
    final after = corners[(index + 1) % corners.length];
    final entry =
        corner + (before - corner) * (inset / (before - corner).distance);
    final exit =
        corner + (after - corner) * (inset / (after - corner).distance);
    if (index == 0) {
      path.moveTo(entry.dx, entry.dy);
    } else {
      path.lineTo(entry.dx, entry.dy);
    }
    path.quadraticBezierTo(corner.dx, corner.dy, exit.dx, exit.dy);
  }
  return path..close();
}

Path _engravedTrigrams() {
  final path = Path();
  for (var index = 0; index < 8; index++) {
    final angle = index * math.pi / 4;
    final across = Offset(math.cos(angle), math.sin(angle));
    final outward = Offset(math.sin(angle), -math.cos(angle));
    for (var line = 0; line < 3; line++) {
      final center = _floorCenter + outward * (100 - line * 6);
      path.moveTo(center.dx - 10 * across.dx, center.dy - 10 * across.dy);
      if ((index >> line) & 1 == 0) {
        path.relativeLineTo(8 * across.dx, 8 * across.dy);
        path.relativeMoveTo(4 * across.dx, 4 * across.dy);
        path.relativeLineTo(8 * across.dx, 8 * across.dy);
      } else {
        path.relativeLineTo(20 * across.dx, 20 * across.dy);
      }
    }
  }
  return path;
}

void _placeFloor(Canvas canvas, Size size, double baseHeight) {
  canvas.translate(0, size.height - baseHeight * 0.50);
  canvas.scale(size.width / 320, baseHeight * 0.48 / 320);
}

class _CastingPlate extends CustomPainter {
  const _CastingPlate(this.baseHeight);

  final double baseHeight;
  static final _bounds = _plateBody.getBounds();
  static final _grain = _metalGrain();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _placeFloor(canvas, size, baseHeight);
    canvas.drawPath(
      _foot.shift(const Offset(2, 9)),
      Paint()
        ..color = const Color(0x78412a18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 9),
    );
    canvas.drawPath(
      _plateBody,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xff93683b), Color(0xffac7d4a), Color(0xff664224)],
          stops: [0, 0.42, 1],
        ).createShader(_bounds),
    );
    canvas.drawPath(
      _rim,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xffc09961),
            Color(0xffedd0a1),
            Color(0xffbd935d),
            Color(0xffd2a774),
            Color(0xff9b6c3f),
          ],
          stops: [0, 0.23, 0.53, 0.78, 1],
        ).createShader(_bounds),
    );
    canvas.drawPath(
      _opening,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xff6c4629),
            Color(0xff966b42),
            Color(0xffba8e5c),
            Color(0xffd8ae75),
          ],
          stops: [0, 0.26, 0.62, 1],
        ).createShader(_bounds),
    );
    canvas.drawPath(
      _basin,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomRight,
          colors: [
            Color(0xffa57a4c),
            Color(0xffbd955f),
            Color(0xffc6a16c),
            Color(0xffa47a4b),
          ],
          stops: [0, 0.33, 0.68, 1],
        ).createShader(_basin.getBounds()),
    );
    canvas.drawPath(
      _rimCrest,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xaaffebbf), Color(0x38fff1ce), Color(0x68ffdda5)],
        ).createShader(_bounds),
    );

    canvas.save();
    canvas.clipPath(_plateBody);
    canvas.drawRect(
      _bounds,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.38, -0.46),
          radius: 0.65,
          colors: [Color(0x26fff0c3), Color(0x00fff0c3)],
        ).createShader(_bounds),
    );
    final (pits, flecks) = _grain;
    canvas.drawPath(pits, Paint()..color = const Color(0x70482514));
    canvas.drawPath(flecks, Paint()..color = const Color(0x68ffe5a8));
    canvas.restore();

    _engrave(canvas, _rings, 1.4);
    _engrave(canvas, _trigrams, 2.6);
    canvas.restore();
  }

  static (Path, Path) _metalGrain() {
    final random = math.Random(35);
    final pits = Path();
    final flecks = Path();
    for (var index = 0; index < 3400; index++) {
      final point = Offset(
        _bounds.left + random.nextDouble() * _bounds.width,
        _bounds.top + random.nextDouble() * _bounds.height,
      );
      final width = 0.25 + random.nextDouble() * 1.05;
      final spot = Rect.fromCenter(
        center: point,
        width: index % 13 == 0 ? width * 2.7 : width,
        height: 0.35 + random.nextDouble() * 1.2,
      );
      pits.addOval(spot);
      flecks.addOval(spot.shift(const Offset(.42, .85)).deflate(.12));
    }
    return (pits, flecks);
  }

  static void _engrave(Canvas canvas, Path shape, double width) {
    final groove = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = width;
    canvas.drawPath(
      shape.shift(const Offset(.45, 1.45)),
      groove..color = const Color(0xaaf7d397),
    );
    canvas.drawPath(shape, groove..color = const Color(0xc65b391f));
  }

  @override
  bool shouldRepaint(_CastingPlate old) => baseHeight != old.baseHeight;
}

class _CastingFlow extends CustomPainter {
  _CastingFlow(this.flow, {required this.tossing, required this.baseHeight})
    : super(repaint: flow);

  final Animation<double> flow;
  final bool tossing;
  final double baseHeight;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _placeFloor(canvas, size, baseHeight);
    final progress = flow.value;
    final brightness = tossing ? 1.0 : 0.72;
    const reflection = Color(0xffffe5ad);
    final ink = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final half in [0.0, 0.5]) {
      final from = (progress + half) * 2 * math.pi;
      final start = ((1 - progress + half) % 1) * _rimTrack.length;
      for (final (weight, alpha, length) in const [
        (3.4, 0.15, 104.0),
        (1.4, 0.46, 70.0),
      ]) {
        ink
          ..color = reflection.withValues(alpha: alpha * brightness)
          ..strokeWidth = weight;
        canvas.drawArc(_goldRing, from, length / 82, false, ink);
      }
      for (final (weight, alpha, length) in const [
        (3.8, 0.14, 164.0),
        (1.6, 0.45, 108.0),
      ]) {
        ink
          ..color = reflection.withValues(alpha: alpha * brightness)
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
      tossing != old.tossing ||
      baseHeight != old.baseHeight ||
      flow != old.flow;
}

class _HexagramLines extends CustomPainter {
  _HexagramLines({
    required this.colors,
    required this.values,
    required this.pulse,
  }) : super(repaint: pulse);

  final ColorScheme colors;
  final List<int> values;
  final Animation<double>? pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final phase = pulse?.value;
    final glow = phase == null ? 0.5 : (1 - math.cos(phase * 6 * math.pi)) / 2;
    final recorded = Paint()
      ..color = colors.primary
      ..strokeCap = StrokeCap.round
      ..strokeWidth = _lineHeight;
    final empty = Paint()
      ..color = Color.lerp(
        colors.outlineVariant,
        colors.primary,
        0.10 + 0.48 * glow,
      )!
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    final center = size.width / 2;
    for (var index = 0; index < coinCastLineNames.length; index++) {
      final y = _lineHeight / 2 + index * _lineSpacing;
      final line = coinCastLineNames.length - 1 - index;
      final left = Offset(_lineHeight / 2, y);
      final right = Offset(size.width - _lineHeight / 2, y);
      if (line >= values.length) {
        canvas.drawLine(left, right, empty);
      } else if (values[line].isEven) {
        canvas.drawLine(left, Offset(center - 5, y), recorded);
        canvas.drawLine(Offset(center + 5, y), right, recorded);
      } else {
        canvas.drawLine(left, right, recorded);
      }
    }
  }

  @override
  bool shouldRepaint(_HexagramLines old) =>
      colors != old.colors ||
      pulse != old.pulse ||
      !listEquals(values, old.values);
}

class _TossDetails extends CustomPainter {
  const _TossDetails({
    required this.progress,
    required this.poses,
    required this.moving,
    required this.coinSize,
    required this.baseHeight,
  });

  final double progress;
  final List<CoinPose> poses;
  final bool moving;
  final double coinSize;
  final double baseHeight;

  @override
  void paint(Canvas canvas, Size size) {
    _shadows(canvas, size);
    if (moving && progress > 0.78) _sparks(canvas, size);
  }

  void _shadows(Canvas canvas, Size size) {
    for (final (index, pose) in poses.indexed) {
      final ground = coinRestingPosition(
        size.width,
        index,
        heightLimit: baseHeight,
        headroom: size.height - baseHeight,
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
      final y =
          size.height - baseHeight * (0.21 + age * (0.53 + index % 3 * 0.035));
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
