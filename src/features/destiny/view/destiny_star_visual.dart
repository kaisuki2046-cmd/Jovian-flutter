import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

/// Decorative counterpart to the original RN constellation and reading rings.
class DestinyStarVisual extends StatefulWidget {
  const DestinyStarVisual({super.key, required this.motion, this.step});

  final bool motion;
  final int? step;

  @override
  State<DestinyStarVisual> createState() => _DestinyStarVisualState();
}

class _DestinyStarVisualState extends State<DestinyStarVisual>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this);
  late final AppLifecycleListener _lifecycle;
  bool _visible = false;
  bool _reducedMotion = false;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: (_) => _syncAnimation());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _visible = TickerMode.valuesOf(context).enabled;
    _reducedMotion = MediaQuery.disableAnimationsOf(context);
    _syncAnimation();
  }

  @override
  void didUpdateWidget(covariant DestinyStarVisual oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncAnimation();
  }

  void _syncAnimation() {
    final playing =
        widget.motion &&
        _visible &&
        !_reducedMotion &&
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    if (playing) {
      if (!_pulse.isAnimating) {
        _pulse.repeat(
          period: Duration(milliseconds: widget.step == null ? 5000 : 1800),
          reverse: true,
        );
      }
    } else if (_pulse.isAnimating || _pulse.value != 0) {
      _pulse.reset();
    }
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _ConstellationPainter(
            accent: Theme.of(context).colorScheme.primary,
            step: widget.step,
            pulse: _pulse,
          ),
        ),
      ),
    ),
  );
}

class _ConstellationPainter extends CustomPainter {
  _ConstellationPainter({
    required this.accent,
    required this.step,
    required this.pulse,
  }) : super(repaint: pulse);

  static const _center = Offset(180, 118);
  static const _stars = [
    Offset(27, 43),
    Offset(74, 102),
    Offset(118, 64),
    Offset(161, 84),
    Offset(192, 52),
    Offset(253, 22),
    Offset(323, 59),
    Offset(299, 176),
    Offset(46, 203),
    Offset(126, 219),
    Offset(228, 216),
    Offset(335, 228),
  ];

  final Color accent;
  final int? step;
  final Animation<double> pulse;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final ceremony = step != null;
    final progress = step ?? 0;
    final wave = Curves.easeInOutSine.transform(pulse.value);
    final opacity = ceremony ? 0.48 + 0.35 * wave : 0.28 + 0.27 * wave;
    final scale = math.min(size.width / 360, size.height / 240);
    canvas
      ..save()
      ..clipRect(Offset.zero & size)
      ..translate(size.width / 2, size.height / 2)
      ..scale(scale)
      ..rotate((-3 + 8 * wave) * math.pi / 180)
      ..translate(-180, -120);

    final ink = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9;
    Color tint(double strength) => accent.withValues(alpha: opacity * strength);
    canvas.drawOval(
      Rect.fromCenter(center: _center, width: 302, height: 202),
      ink..color = tint(0.4),
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: _center,
        width: 228,
        height: 138 + 8.0 * progress,
      ),
      ink..color = tint(0.6),
    );
    canvas.drawCircle(_center, 47 + 7.0 * progress, ink..color = tint(0.55));
    ink.color = tint(0.55);
    for (var i = 1; i < 8; i++) {
      if (i != 5) canvas.drawLine(_stars[i - 1], _stars[i], ink);
    }
    if (ceremony) {
      for (var i = 0; i < 24; i++) {
        final radial = Offset.fromDirection(i * math.pi / 12);
        canvas.drawLine(_center + radial * 97.5, _center + radial * 93, ink);
      }
      canvas.drawCircle(
        _center,
        4 + progress.toDouble(),
        ink..style = PaintingStyle.fill,
      );
    }
    ink.style = PaintingStyle.fill;
    for (final (i, star) in _stars.indexed) {
      final bright = i % 3 == 0;
      canvas.drawCircle(
        star,
        bright ? 2 : 1.2,
        ink..color = tint(bright ? 0.9 : 0.45),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ConstellationPainter oldDelegate) =>
      accent != oldDelegate.accent ||
      step != oldDelegate.step ||
      pulse != oldDelegate.pulse;
}
