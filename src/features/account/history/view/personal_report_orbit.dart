part of 'personal_report_page.dart';

const _orbitTurn = math.pi * 2;
// Rotation (.09 rad/s) and twinkle (1.5 rad/s) both wrap at this period.
const _orbitPeriod = Duration(microseconds: 209439510);
typedef _OrbitSector = ({double start, double sweep});

_OrbitSector _placementSector(int? index) {
  if (index == null) return (start: 0, sweep: 0);
  final firstThree = index < 3;
  return (
    start: (firstThree ? index * 2 / 15 : .4 + (index - 3) * .1) * _orbitTurn,
    sweep: (firstThree ? 2 / 15 : .1) * _orbitTurn,
  );
}

class _ReportOrbit extends StatefulWidget {
  const _ReportOrbit({required this.placements, this.selected});

  final List<_Placement> placements;
  final int? selected;

  @override
  State<_ReportOrbit> createState() => _ReportOrbitState();
}

class _ReportOrbitState extends State<_ReportOrbit>
    with TickerProviderStateMixin {
  late final _phase = AnimationController(vsync: this, duration: _orbitPeriod);
  late final _selection = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 460),
    value: 1,
  );
  late _OrbitSector _target = _placementSector(widget.selected);
  late _OrbitSector _start = _target;
  bool _motion = false;

  _OrbitSector _sector() {
    final t = Curves.easeOutExpo.transform(_selection.value);
    final turn =
        (_target.start - _start.start + math.pi) % _orbitTurn - math.pi;
    return (
      start: _start.start + turn * t,
      sweep: ui.lerpDouble(_start.sweep, _target.sweep, t)!,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final motion =
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (motion == _motion) return;
    _motion = motion;
    if (motion) {
      _phase.repeat();
    } else {
      _phase.stop();
      _selection.value = 1;
    }
  }

  @override
  void didUpdateWidget(covariant _ReportOrbit oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selected == widget.selected) return;
    final current = _sector();
    _start = current;
    _target = _placementSector(widget.selected);
    if (_motion) {
      _selection.forward(from: 0);
    } else {
      _selection.value = 1;
    }
  }

  @override
  void dispose() {
    _phase.dispose();
    _selection.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final selected = widget.selected;
    final placement = widget.placements[selected ?? 0];
    final caption = placement.sign.isEmpty
        ? '${context.uiLabel(placement.prefix)} · ${context.uiLabel('未提供')}'
        : [
            context.uiLabel(placement.prefix),
            context.uiLabel(placement.sign),
          ].join(context.uiLanguage == InterfaceLanguage.chinese ? '' : ' in ');
    return LayoutBuilder(
      builder: (context, bounds) {
        final diameter = bounds.biggest.shortestSide;
        return Stack(
          fit: StackFit.expand,
          children: [
            RepaintBoundary(
              child: CustomPaint(
                willChange: _motion,
                painter: _OrbitPainter(
                  clock: _phase,
                  selection: _selection,
                  sector: _sector,
                  accent: selected == null ? null : placement.color,
                  light: colors.brightness == Brightness.light,
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                spacing: math.min(8, diameter * .035),
                children: [
                  _ZodiacSymbol(
                    placement.glyph,
                    size: selected == null
                        ? diameter * .35
                        : math.min(48, diameter * .23),
                    color: colors.onSurface,
                  ),
                  if (selected != null)
                    Semantics(
                      liveRegion: true,
                      child: SizedBox(
                        width: diameter * .47,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            caption,
                            style: TextStyle(
                              fontSize: math.min(14, diameter * .075),
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

typedef _OrbitParticle = ({
  double radius,
  double angle,
  double variation,
  double phase,
});

final _orbitParticles = _makeOrbitParticles();

List<_OrbitParticle> _makeOrbitParticles() {
  final particles = <_OrbitParticle>[];
  for (var row = 0; row < 6; row++) {
    final radius = 65 + row * 6.6;
    final count = (_orbitTurn * radius / 10).round();
    for (var index = 0; index < count; index++) {
      final variation = .5 + .5 * math.sin(index * 12.9 + row * 9.2);
      particles.add((
        radius: radius,
        angle: index / count * _orbitTurn + row * .053 + (variation - .5) * .07,
        variation: variation,
        phase: index * 1.7 + row * 3.1,
      ));
    }
  }
  return particles;
}

class _OrbitPainter extends CustomPainter {
  _OrbitPainter({
    required this.clock,
    required Animation<double> selection,
    required this.sector,
    required this.accent,
    required this.light,
  }) : super(repaint: Listenable.merge([clock, selection]));

  final Animation<double> clock;
  final _OrbitSector Function() sector;
  final Color? accent;
  final bool light;

  final _baseHalo = _OrbitHalos();
  final _baseDots = _OrbitDots();
  final _accentHalo = _OrbitHalos();
  final _accentDots = _OrbitDots();

  @override
  void paint(Canvas canvas, Size size) {
    final tone = accent;
    final overview = tone == null;
    final plain = light && !overview;
    final (start: start, sweep: sweep) = sector();
    final feather = math.min(.06, sweep * .2);
    final time =
        clock.value *
        _orbitPeriod.inMicroseconds /
        Duration.microsecondsPerSecond;
    final core = light ? Colors.white : Color.lerp(tone, Colors.white, .58)!;
    final neutral = light ? const Color(0xff7d7e82) : const Color(0xfff5f8ff);
    _baseHalo.clear();
    _baseDots.clear();
    _accentHalo.clear();
    _accentDots.clear();

    for (final particle in _orbitParticles) {
      final angle = particle.angle + time * .09;
      final position = (angle + math.pi / 2 - start) % _orbitTurn;
      final lightAt = feather == 0
          ? 0.0
          : math
                .min(position / feather, (sweep - position) / feather)
                .clamp(0.0, 1.0);
      final twinkle = .78 + .22 * math.sin(time * 1.5 + particle.phase);
      final brightness = lightAt * (.65 + particle.variation * .35) * twinkle;
      final opacity = math.min(
        1.0,
        (.22 + particle.variation * .43) * twinkle * 3,
      );
      final dotRadius = .4 + particle.variation * .85;
      final radius = particle.radius * (1 + lightAt * .08);
      final x = math.cos(angle) * radius;
      final y = math.sin(angle) * radius;
      if (plain) {
        if (brightness < .13) {
          _baseDots.add(x, y, dotRadius, Colors.black, opacity * .54);
        }
      } else {
        _baseHalo.add(x, y, 3 + dotRadius * 2, neutral, opacity * .22);
        _baseDots.add(x, y, dotRadius, neutral, opacity);
      }
      final raised = 1 + lightAt * .15;
      if (tone != null && brightness >= .13) {
        _accentHalo.add(
          x,
          y,
          (10 + brightness * 13) * raised,
          tone,
          brightness * .95,
        );
      }
      if (plain ? brightness >= .13 : brightness > 0) {
        _accentDots.add(
          x,
          y,
          (dotRadius + brightness * 1.45) * raised,
          core,
          light ? 1 : brightness,
        );
      }
    }

    final center = size.center(Offset.zero);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    final scale = size.shortestSide / (overview ? 208 : 256);
    canvas.scale(scale);
    _baseHalo.draw(canvas);
    if (!plain) _baseDots.draw(canvas);
    _accentHalo.draw(canvas);
    if (plain) _baseDots.draw(canvas);
    _accentDots.draw(canvas);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_OrbitPainter oldDelegate) =>
      accent != oldDelegate.accent || light != oldDelegate.light;
}

int _orbitArgb(Color color, double opacity) =>
    (color.toARGB32() & 0xffffff) | ((opacity * 255).round() << 24);

class _OrbitDots {
  final _circles = Float32List(_orbitParticles.length * 3);
  final _colors = Int32List(_orbitParticles.length);
  final _paint = Paint();
  int _count = 0;

  void clear() => _count = 0;

  void add(double x, double y, double radius, Color color, double opacity) {
    final slot = _count * 3;
    _circles[slot] = x;
    _circles[slot + 1] = y;
    _circles[slot + 2] = radius;
    _colors[_count++] = _orbitArgb(color, opacity);
  }

  void draw(Canvas canvas) {
    for (var index = 0; index < _count; index++) {
      final slot = index * 3;
      canvas.drawCircle(
        Offset(_circles[slot], _circles[slot + 1]),
        _circles[slot + 2],
        _paint..color = Color(_colors[index]),
      );
    }
  }
}

// Cache the glow sprite so each halo layer paints in one call.
final _orbitHalo = _makeOrbitHalo();

ui.Image _makeOrbitHalo() {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(
    const Rect.fromLTWH(0, 0, 64, 64),
    Paint()
      ..shader = ui.Gradient.radial(
        const Offset(32, 32),
        32,
        const [
          Color(0xf2ffffff),
          Color(0xccffffff),
          Color(0x6bffffff),
          Color(0x21ffffff),
          Color(0x00ffffff),
        ],
        const [0, .16, .35, .60, 1],
      ),
  );
  final picture = recorder.endRecording();
  final image = picture.toImageSync(64, 64);
  picture.dispose();
  return image;
}

class _OrbitHalos {
  static final _rects = Float32List(_orbitParticles.length * 4)
    ..setAll(0, [
      for (final _ in _orbitParticles) ...[0, 0, 64, 64],
    ]);
  final _transforms = Float32List(_orbitParticles.length * 4);
  final _colors = Int32List(_orbitParticles.length);
  final _paint = Paint()..filterQuality = FilterQuality.low;
  int _count = 0;

  void clear() => _count = 0;

  void add(double x, double y, double diameter, Color color, double opacity) {
    final slot = _count * 4;
    _transforms[slot] = diameter / 64;
    _transforms[slot + 2] = x - diameter / 2;
    _transforms[slot + 3] = y - diameter / 2;
    _colors[_count++] = _orbitArgb(color, opacity);
  }

  void draw(Canvas canvas) {
    if (_count == 0) return;
    canvas.drawRawAtlas(
      _orbitHalo,
      Float32List.sublistView(_transforms, 0, _count * 4),
      Float32List.sublistView(_rects, 0, _count * 4),
      Int32List.sublistView(_colors, 0, _count),
      BlendMode.modulate,
      null,
      _paint,
    );
  }
}
