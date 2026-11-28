part of 'synastry_album_selector.dart';

class _VinylSheen extends CustomPainter {
  const _VinylSheen(this.progress, {required this.dark});

  final double progress;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final strength = math.sin(progress * math.pi) * (dark ? .16 : .22);
    if (strength < .002) return;
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .49;
    final bounds = Rect.fromCircle(center: center, radius: radius);
    final rotation = -2.35 + progress * 2.3;
    final glow = const Color(0xffffe4c9).withValues(alpha: strength);
    final shader = SweepGradient(
      transform: GradientRotation(rotation),
      colors: [
        Colors.transparent,
        glow,
        Colors.transparent,
        Colors.transparent,
      ],
      stops: const [0, .09, .22, 1],
    ).createShader(bounds);
    final ink = Paint()
      ..style = PaintingStyle.stroke
      ..shader = shader;
    canvas.drawCircle(center, radius * .962, ink..strokeWidth = radius * .017);
    canvas.drawCircle(center, radius * .903, ink..strokeWidth = radius * .024);
    canvas.drawCircle(center, radius * .854, ink..strokeWidth = radius * .013);
  }

  @override
  bool shouldRepaint(_VinylSheen oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.dark != dark;
}

class _RecordSurround extends CustomPainter {
  const _RecordSurround({required this.line, required this.dark});

  final Color line;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final orbit = Rect.fromCenter(
      center: center,
      width: size.width * .96,
      height: size.height * .63,
    );
    final pen = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .7
      ..color = line.withValues(alpha: dark ? .24 : .22);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(-.23);
    canvas.translate(-center.dx, -center.dy);
    canvas.drawOval(orbit, pen);
    canvas.drawOval(orbit.deflate(6), pen..color = line.withValues(alpha: .11));
    canvas.restore();

    for (final (x, y, radius) in const [
      (.09, .26, 1.3),
      (.04, .62, 1.0),
      (.945, .35, 1.2),
      (.90, .75, 1.7),
      (.14, .81, .8),
      (.87, .19, .9),
    ]) {
      canvas.drawCircle(
        Offset(x * size.width, y * size.height),
        radius,
        Paint()..color = line.withValues(alpha: .35),
      );
    }
  }

  @override
  bool shouldRepaint(_RecordSurround oldDelegate) =>
      line != oldDelegate.line || dark != oldDelegate.dark;
}

class _VinylGrooves extends CustomPainter {
  const _VinylGrooves({required this.dark});

  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .49;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final rim = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0xff302a29), Color(0xff282423), Color(0xff161515)],
        stops: [0, .93, 1],
      ).createShader(rect);
    canvas.drawCircle(center, radius, rim);
    canvas.drawCircle(
      center,
      radius * .975,
      Paint()
        ..shader = const SweepGradient(
          transform: GradientRotation(-.48),
          colors: [
            Color(0xff3e3734),
            Color(0xff201e1d),
            Color(0xff151415),
            Color(0xff38312f),
            Color(0xff221f20),
            Color(0xff161516),
            Color(0xff3e3734),
          ],
          stops: [0, .13, .3, .52, .68, .83, 1],
        ).createShader(rect),
    );

    final groove = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .55;
    for (var index = 0; index < 43; index++) {
      final distance = radius * (.718 + .0056 * index);
      groove.color = index % 8 == 0
          ? const Color(0x7d0d0c0d)
          : (index.isEven ? const Color(0x45141213) : const Color(0x20b09c86));
      canvas.drawCircle(center, distance, groove);
    }
    canvas.drawArc(
      rect.deflate(radius * .028),
      -2.7,
      1.6,
      false,
      groove
        ..strokeWidth = .85
        ..color = const Color(0x6aa09180),
    );
    canvas.drawCircle(
      center,
      radius * .711,
      groove
        ..strokeWidth = 1.25
        ..color = const Color(0xff151415),
    );
    canvas.drawCircle(
      center,
      radius,
      groove
        ..strokeWidth = .9
        ..color = dark ? const Color(0xff59504b) : const Color(0xff736758),
    );
  }

  @override
  bool shouldRepaint(_VinylGrooves oldDelegate) => dark != oldDelegate.dark;
}
