import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import 'coin_toss_motion.dart';

const coinFrontAsset =
    'src/features/divination/assets/coins/qianlong-front.png';
const coinBackAsset = 'src/features/divination/assets/coins/qianlong-back.png';
const coinShellAsset =
    'src/features/divination/assets/ritual/tortoise-shell-side.png';
const _brass = Color(0xffb38b45);

class CoinCastScene extends StatelessWidget {
  const CoinCastScene({
    super.key,
    required this.progress,
    required this.faces,
    required this.previous,
    required this.values,
    required this.moving,
    required this.reducedMotion,
  });

  final Animation<double> progress;
  final List<int>? faces;
  final List<int>? previous;
  final List<int> values;
  final bool moving;
  final bool reducedMotion;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final result = faces;
    return Semantics(
      label: moving
          ? '正在投掷三枚铜钱'
          : result == null
          ? '三枚铜钱，待投掷'
          : [
              for (final (index, face) in result.indexed)
                '第 ${index + 1} 枚铜钱，${face == 2 ? '字面' : '背面'}',
            ].join('；'),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = math.min(560.0, constraints.maxWidth);
          final layout = coinStageLayout(width);
          return Center(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: colors.outlineVariant),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  width: width,
                  height: layout.height,
                  child: RepaintBoundary(
                    child: AnimatedBuilder(
                      animation: progress,
                      builder: (context, _) {
                        final t = moving ? progress.value : 1.0;
                        final poses = [
                          for (var index = 0; index < 3; index++)
                            coinTossPose(
                              t,
                              index,
                              faces?[index] ?? 2,
                              width,
                              previous: previous?[index] ?? 2,
                            ),
                        ];
                        return Stack(
                          children: [
                            Positioned.fill(
                              child: CustomPaint(
                                painter: _RitualFloor(
                                  progress: t,
                                  values: values,
                                  poses: poses,
                                  colors: colors,
                                  moving: moving && !reducedMotion,
                                ),
                              ),
                            ),
                            for (final (index, pose) in poses.indexed)
                              ..._coin(
                                index,
                                pose,
                                layout.coinSize,
                                layout.thickness,
                              ),
                          ],
                        );
                      },
                    ),
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

List<Widget> _coin(int index, CoinPose pose, double size, double thickness) {
  final face = visibleCoinFace(pose);
  final direction = face == 2 ? 1 : -1;
  final tilt = Matrix4.identity()
    ..setEntry(3, 2, 1 / 600)
    ..rotateZ(pose.spin)
    ..rotateX(pose.tilt)
    ..rotateY(pose.flip + (face == 3 ? math.pi : 0))
    ..scaleByDouble(pose.scale, pose.scale, 1, 1);
  return [
    if (pose.edgeOpacity > 0)
      Positioned(
        left: pose.x - size * 0.45,
        top: pose.y - thickness / 2,
        width: size * 0.90,
        height: thickness,
        child: Transform.rotate(
          angle: pose.edgeAngle + pose.spin,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(
                0xff96805b,
              ).withValues(alpha: pose.edgeOpacity),
              borderRadius: BorderRadius.circular(thickness / 2),
            ),
          ),
        ),
      ),
    Positioned(
      left: pose.x - size / 2 + direction * pose.faceOffsetX,
      top: pose.y - size / 2 + direction * pose.faceOffsetY,
      width: size,
      height: size,
      child: Transform(
        transform: tilt,
        alignment: Alignment.center,
        child: Image.asset(
          face == 2 ? coinFrontAsset : coinBackAsset,
          key: ValueKey('coin-ritual-face-$index-$face'),
          excludeFromSemantics: true,
          fit: BoxFit.contain,
          gaplessPlayback: true,
          errorBuilder: (_, _, _) => DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _brass,
              border: Border.all(color: const Color(0xff665034), width: 2),
            ),
          ),
        ),
      ),
    ),
  ];
}

class _RitualFloor extends CustomPainter {
  const _RitualFloor({
    required this.progress,
    required this.values,
    required this.poses,
    required this.colors,
    required this.moving,
  });

  final double progress;
  final List<int> values;
  final List<CoinPose> poses;
  final ColorScheme colors;
  final bool moving;

  @override
  void paint(Canvas canvas, Size size) {
    _floor(canvas, size);
    _hexagram(canvas, size);
    _shadows(canvas, size);
    if (moving && progress > 0.78) _sparks(canvas, size);
  }

  void _floor(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate(0, size.height * 0.50);
    canvas.scale(size.width / 320, size.height * 0.48 / 320);
    const center = Offset(160, 160);
    final floor = Rect.fromCenter(center: center, width: 320, height: 310);
    final cream = RadialGradient(
      colors: [
        colors.primaryContainer.withValues(alpha: 0.55),
        colors.surface.withValues(alpha: 0),
      ],
    );
    canvas.drawOval(floor, Paint()..shader = cream.createShader(floor));
    final outline = Paint()
      ..color = colors.onSurfaceVariant.withValues(alpha: 0.34)
      ..strokeWidth = 0.9
      ..style = PaintingStyle.stroke;
    final rim = _octagon(center, 146);
    canvas.drawPath(rim, outline);
    canvas.drawPath(_octagon(center, 117), outline);
    canvas.drawCircle(center, 82, outline);
    canvas.drawCircle(center, 70, outline);

    final bars = Paint()
      ..color = colors.primary.withValues(alpha: 0.40)
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
    if (moving) _flow(canvas, center, rim);
    canvas.restore();
  }

  Path _octagon(Offset center, double radius) => Path()
    ..addPolygon([
      for (var index = 0; index < 8; index++)
        center +
            Offset(
                  math.sin(index * math.pi / 4),
                  -math.cos(index * math.pi / 4),
                ) *
                radius,
    ], true);

  void _flow(Canvas canvas, Offset center, Path rim) {
    final circle = Rect.fromCircle(center: center, radius: 82);
    final perimeter = rim.computeMetrics().single;
    for (final (weight, alpha, sweep) in [
      (7.0, 0.15, 1.16),
      (4.0, 0.30, 0.85),
      (2.3, 0.75, 0.50),
    ]) {
      final ink = Paint()
        ..color = _brass.withValues(alpha: alpha)
        ..strokeWidth = weight
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      for (final half in [0.0, 0.5]) {
        final from = (progress + half) * 2 * math.pi;
        canvas.drawArc(circle, from, sweep, false, ink);
        final start = ((1 - progress + half) % 1) * perimeter.length;
        final end = start + 145 * sweep;
        canvas.drawPath(
          perimeter.extractPath(start, math.min(end, perimeter.length)),
          ink,
        );
        if (end > perimeter.length) {
          canvas.drawPath(
            perimeter.extractPath(0, end - perimeter.length),
            ink,
          );
        }
      }
    }
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
    final layout = coinStageLayout(size.width);
    for (final (index, pose) in poses.indexed) {
      final ground = coinRestingPosition(size.width, index);
      final point = Offset(pose.x, ground.y + layout.coinSize * 0.11);
      final width = layout.coinSize * pose.shadowScale * 1.26;
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
  bool shouldRepaint(covariant _RitualFloor old) => true;
}
