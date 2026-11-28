import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../model/synastry_relationship.dart';
import 'synastry_album_selector.dart';

class SynastryTurntable extends StatelessWidget {
  const SynastryTurntable({
    super.key,
    required this.platterKey,
    required this.rotation,
    required this.edition,
  });

  final GlobalKey platterKey;
  final Animation<double> rotation;
  final SynastryEdition? edition;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final surface = dark ? const Color(0xff363432) : const Color(0xffdedad0);
    final frame = Color.lerp(surface, colors.onSurface, dark ? .03 : .18)!;
    final reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    return AspectRatio(
      aspectRatio: 1.36,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final unit = width / 360;
          final disc = 208 * unit;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(21),
                    boxShadow: [
                      BoxShadow(
                        color: colors.shadow.withValues(
                          alpha: dark ? .44 : .17,
                        ),
                        blurRadius: 24,
                        offset: const Offset(0, 13),
                        spreadRadius: -6,
                      ),
                    ],
                    border: Border.all(color: frame),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color.lerp(surface, Colors.white, dark ? .12 : .48)!,
                        surface,
                        Color.lerp(surface, colors.shadow, .24)!,
                      ],
                      stops: const [0, .42, 1],
                    ),
                  ),
                  child: CustomPaint(painter: _DeckDetail(frame, dark)),
                ),
              ),
              Positioned(
                left: 23 * unit,
                top: 18 * unit,
                width: disc,
                height: disc,
                child: SizedBox.expand(
                  key: platterKey,
                  child: edition == null
                      ? CustomPaint(painter: _EmptyPlatter(dark))
                      : RotationTransition(
                          turns: rotation,
                          child: SynastryVinyl(
                            edition: edition!,
                            size: disc,
                            animated: false,
                          ),
                        ),
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: edition == null ? 0 : 1),
                    duration: reduced
                        ? Duration.zero
                        : const Duration(milliseconds: 520),
                    curve: Curves.easeInOutCubic,
                    builder: (context, pivot, _) => CustomPaint(
                      painter: _ToneArm(pivot: pivot, dark: dark, frame: frame),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DeckDetail extends CustomPainter {
  const _DeckDetail(this.frame, this.dark);

  final Color frame;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 360, size.height / (360 / 1.36));
    final rim = RRect.fromRectAndRadius(
      const Rect.fromLTRB(5, 5, 355, 257),
      const Radius.circular(16),
    );
    canvas.drawRRect(
      rim,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = .65
        ..color = Colors.white.withValues(alpha: dark ? .13 : .50),
    );
    final grain = Paint()
      ..color = frame.withValues(alpha: .20)
      ..strokeWidth = .7;
    for (var line = 0; line < 6; line++) {
      final y = 203.0 + line * 4;
      canvas.drawLine(Offset(273, y), Offset(330 - line * 1.7, y), grain);
    }
    final led = Paint()..color = const Color(0xffab7454);
    canvas.drawCircle(const Offset(294, 239), 2.3, led);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTRB(303, 235, 331, 242),
        const Radius.circular(3),
      ),
      Paint()..color = frame,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_DeckDetail oldDelegate) =>
      frame != oldDelegate.frame || dark != oldDelegate.dark;
}

class _EmptyPlatter extends CustomPainter {
  const _EmptyPlatter(this.dark);

  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2;
    final bounds = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xff4c4845), Color(0xff373332), Color(0xff23201e)],
          stops: [0, .90, 1],
        ).createShader(bounds),
    );
    final groove = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .8
      ..color = Colors.white.withValues(alpha: dark ? .12 : .095);
    for (final fraction in [.19, .32, .45, .57, .69, .80, .89, .94]) {
      canvas.drawCircle(center, radius * fraction, groove);
    }
    canvas.drawCircle(
      center,
      radius * .032,
      Paint()..color = const Color(0xff161411),
    );
    canvas.drawCircle(
      center.translate(-.3, -1.4),
      radius * .021,
      Paint()..color = const Color(0xffded0bd),
    );
  }

  @override
  bool shouldRepaint(_EmptyPlatter oldDelegate) => dark != oldDelegate.dark;
}

class _ToneArm extends CustomPainter {
  const _ToneArm({
    required this.pivot,
    required this.dark,
    required this.frame,
  });

  final double pivot;
  final bool dark;
  final Color frame;

  @override
  void paint(Canvas canvas, Size size) {
    final unit = size.width / 360;
    canvas.save();
    canvas.scale(unit);
    const knob = Offset(302, 51);
    canvas.drawCircle(
      knob.translate(0, 3),
      26,
      Paint()..color = Colors.black26,
    );
    canvas.drawCircle(
      knob,
      25,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Color.lerp(frame, Colors.white, .20)!,
            frame,
            Color.lerp(frame, Colors.black, .40)!,
          ],
          stops: const [.08, .73, 1],
        ).createShader(Rect.fromCircle(center: knob, radius: 26)),
    );
    canvas.drawCircle(
      knob,
      6.2,
      Paint()..color = Color.lerp(frame, Colors.white, .53)!,
    );

    canvas.translate(knob.dx, knob.dy);
    canvas.rotate(pivot * math.pi * .214);
    final arm = Path()
      ..moveTo(0, 1)
      ..lineTo(0, 72)
      ..quadraticBezierTo(0, 93, -12, 112)
      ..lineTo(-18, 124);
    canvas.drawPath(
      arm.shift(const Offset(2, 3)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 7
        ..color = Colors.black26,
    );
    final metal = dark ? const Color(0xffb8aaa0) : const Color(0xff877b6c);
    canvas.drawPath(
      arm,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = metal,
    );
    canvas.drawPath(
      arm.shift(const Offset(-1.3, 0)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.05
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: .51),
    );
    canvas.translate(-18, 124);
    canvas.rotate(.43);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-5.5, -2.5, 11, 22),
        const Radius.circular(2.5),
      ),
      Paint()..color = const Color(0xff4c4036),
    );
    canvas.drawRect(
      const Rect.fromLTWH(-4, 12, 8, 3.2),
      Paint()..color = const Color(0xffa6735b),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ToneArm oldDelegate) =>
      pivot != oldDelegate.pivot ||
      frame != oldDelegate.frame ||
      dark != oldDelegate.dark;
}
