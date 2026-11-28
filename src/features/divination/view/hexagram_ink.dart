part of 'hexagram_card.dart';

class _HexagramInkPainter extends CustomPainter {
  _HexagramInkPainter({
    required this.style,
    required this.index,
    required this.pattern,
    required this.moving,
    required this.dark,
    required this.reveal,
  }) : super(repaint: reveal);

  final HexagramStyle style;
  final int index;
  final int pattern;
  final int moving;
  final bool dark;
  final Animation<double> reveal;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final delay = index * (style == HexagramStyle.paper ? .10 : .12);
    final progress = _interval(reveal.value, delay, 1 - delay);
    switch (style) {
      case HexagramStyle.paper:
        _paintPaper(canvas, size, progress);
      case HexagramStyle.ripples:
        _paintRipples(canvas, size, progress);
    }
  }

  void _paintPaper(Canvas canvas, Size size, double progress) {
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    final center = size.center(Offset.zero);
    final width = math.min(size.width * .73, 76.0);
    final left = center.dx - width / 2;
    final ink = dark ? const Color(0xffe2cbae) : const Color(0xff45382c);
    final cinnabar = dark ? const Color(0xffe9a782) : const Color(0xff974728);
    final wash = Rect.fromCenter(
      center: center.translate(-width * .14, 0),
      width: width * 1.5,
      height: size.height,
    );
    canvas.drawRect(
      wash,
      Paint()
        ..shader = RadialGradient(
          colors: [
            (dark ? const Color(0xffb68c59) : const Color(0xffb48553))
                .withValues(alpha: .15),
            const Color(0x00b48553),
          ],
        ).createShader(wash),
    );

    final random = math.Random(82 + index);
    final fibers = Path();
    for (var fiber = 0; fiber < 52; fiber++) {
      final x = random.nextDouble() * size.width;
      final y = random.nextDouble() * size.height;
      fibers
        ..moveTo(x, y)
        ..relativeLineTo(1 + random.nextDouble() * 1.7, -.4);
    }
    canvas.drawPath(
      fibers,
      Paint()
        ..strokeWidth = .65
        ..style = PaintingStyle.stroke
        ..color = ink.withValues(alpha: .12),
    );

    for (var line = 0; line < 6; line++) {
      final wet = _interval(progress, line * .075, .57);
      if (wet == 0) continue;
      final reach = Curves.easeOutCubic.transform(wet);
      final y = center.dy + (2.5 - line) * 11.2;
      final isMoving = moving & (1 << line) != 0;
      final color = isMoving ? cinnabar : ink;
      final yang = pattern & (1 << line) != 0;
      for (final (start, end) in _segments(yang)) {
        final right = left + width * math.min(reach, end);
        final startX = left + width * start;
        if (right - startX < .5) continue;
        final stroke = _brushStroke(startX, right, y, line + index);
        canvas.drawPath(
          stroke,
          Paint()
            ..color = color.withValues(alpha: .24)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.3),
        );
        canvas.drawPath(stroke, Paint()..color = color);
      }
      if (wet < 1) {
        final damp = Rect.fromCenter(
          center: Offset(left + width * reach, y),
          width: 17,
          height: 10,
        );
        canvas.drawRect(
          damp,
          Paint()
            ..shader = RadialGradient(
              colors: [
                color.withValues(alpha: .42 * math.sin(math.pi * wet)),
                color.withValues(alpha: 0),
              ],
            ).createShader(damp),
        );
      }
      if (isMoving && wet > .74) {
        final mark = Offset(left + width + 6, y);
        canvas.drawCircle(
          mark,
          1.65,
          Paint()..color = cinnabar.withValues(alpha: _interval(wet, .74, .26)),
        );
      }
    }
    canvas.restore();
  }

  void _paintRipples(Canvas canvas, Size size, double progress) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .458;
    final pool = Rect.fromCircle(center: center, radius: radius);
    final green = dark ? const Color(0xff89b9ae) : const Color(0xff447c73);
    final ink = dark ? const Color(0xffc1e8df) : const Color(0xff234f4c);
    final cinnabar = dark ? const Color(0xfff6ae8f) : const Color(0xff9b5142);
    final waterEdge = Path()
      ..addPolygon([
        for (var side = 0; side < 64; side++)
          _waterPoint(center, radius, side * math.pi / 32, index),
      ], true);
    canvas.drawPath(
      waterEdge,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-.25, -.30),
          radius: .84,
          colors: dark
              ? const [Color(0xff344f49), Color(0xff2b403b), Color(0xff24312e)]
              : const [Color(0xfff4f6e9), Color(0xffdcebe0), Color(0xffb9d3c8)],
          stops: const [0, .52, 1],
        ).createShader(pool),
    );
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = .85;
    canvas.drawPath(waterEdge, rim..color = green.withValues(alpha: .50));
    canvas.drawArc(
      pool.deflate(radius * .10),
      math.pi * 1.05,
      math.pi * .96,
      false,
      rim
        ..color = (dark ? const Color(0xffc2e7d8) : Colors.white).withValues(
          alpha: .68,
        ),
    );
    canvas.drawArc(
      pool.deflate(radius * .10),
      .16,
      math.pi * .70,
      false,
      rim..color = green.withValues(alpha: .25),
    );
    canvas.drawArc(
      pool.deflate(radius * .19),
      math.pi * 1.52,
      math.pi * 1.15,
      false,
      rim..color = green.withValues(alpha: .16),
    );

    final wave = _interval(progress, .15, .69);
    if (progress < .15) {
      final falling = _interval(progress, 0, .15);
      final drop = center.translate(0, -radius * .46 * (1 - falling * falling));
      canvas.drawOval(
        Rect.fromCenter(
          center: drop,
          width: radius * .13,
          height: radius * .18,
        ),
        Paint()..color = green.withValues(alpha: .75),
      );
      canvas.drawCircle(
        drop.translate(-1, -1.3),
        .85,
        Paint()..color = Colors.white70,
      );
    }
    if (wave <= 0) return;

    final bloom = Curves.easeOutCubic.transform(wave);
    final reach = radius * .94 * bloom;
    if (wave < 1) {
      final opacity = .55 * math.sin(math.pi * wave);
      canvas.drawCircle(
        center,
        reach,
        rim..color = green.withValues(alpha: opacity),
      );
      canvas.drawCircle(
        center,
        reach * .70,
        rim..color = green.withValues(alpha: opacity * .55),
      );
    }

    canvas.save();
    if (wave < 1) {
      canvas.clipPath(
        Path()..addOval(Rect.fromCircle(center: center, radius: reach)),
      );
    }
    final lineWidth = radius * 1.22;
    final left = center.dx - lineWidth / 2;
    final weight = math.max(2.6, radius * .091);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = weight
      ..strokeCap = StrokeCap.round;
    for (var line = 0; line < 6; line++) {
      final y = center.dy + (2.5 - line) * radius * .229;
      final isMoving = moving & (1 << line) != 0;
      stroke.color = isMoving ? cinnabar : ink;
      for (final (start, end) in _segments(pattern & (1 << line) != 0)) {
        canvas.drawLine(
          Offset(left + lineWidth * start + weight / 2, y),
          Offset(left + lineWidth * end - weight / 2, y),
          stroke,
        );
      }
      if (isMoving) {
        canvas.drawCircle(
          Offset(left + lineWidth + radius * .13, y),
          weight * .37,
          Paint()..color = cinnabar,
        );
      }
    }
    canvas.restore();
  }

  static double _interval(double value, double start, double span) =>
      ((value - start) / span).clamp(0.0, 1.0);

  static List<(double, double)> _segments(bool yang) =>
      yang ? const [(0, 1)] : const [(0, .42), (.58, 1)];

  static Path _brushStroke(double left, double right, double y, int seed) {
    final length = right - left;
    final edge = math.sin(seed * 3.1) * .48;
    return Path()
      ..moveTo(left, y - 1.4)
      ..quadraticBezierTo(
        left + length * .17,
        y - 2.8,
        left + length * .51,
        y - 2.3 + edge,
      )
      ..lineTo(left + length * .79, y - 2.45)
      ..quadraticBezierTo(right, y - 2.25, right, y + 1.1)
      ..lineTo(left + length * .80, y + 1.9)
      ..quadraticBezierTo(
        left + length * .43,
        y + 2.75 - edge,
        left + length * .11,
        y + 1.9,
      )
      ..quadraticBezierTo(left, y + 1.3, left, y - 1.4)
      ..close();
  }

  static Offset _waterPoint(
    Offset center,
    double radius,
    double angle,
    int seed,
  ) {
    final offset =
        math.sin(angle * 4 + seed) * .029 + math.sin(angle * 10) * .015;
    return center +
        Offset(math.cos(angle), math.sin(angle)) * radius * (1 + offset);
  }

  @override
  bool shouldRepaint(_HexagramInkPainter old) =>
      style != old.style ||
      index != old.index ||
      pattern != old.pattern ||
      moving != old.moving ||
      dark != old.dark ||
      reveal != old.reveal;
}
