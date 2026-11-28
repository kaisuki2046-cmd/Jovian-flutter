part of 'personal_report_page.dart';

class _ZodiacCard extends StatefulWidget {
  const _ZodiacCard({
    required this.placement,
    required this.selected,
    required this.onTap,
  });

  final _Placement placement;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_ZodiacCard> createState() => _ZodiacCardState();
}

class _ZodiacCardState extends State<_ZodiacCard>
    with SingleTickerProviderStateMixin {
  late final _light = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..addStatusListener(_advanceLight);
  bool _running = false;
  bool _arriving = false;

  void _advanceLight(AnimationStatus status) {
    if (!_arriving || status != AnimationStatus.completed) return;
    _arriving = false;
    _light.value = 0;
    _light.repeat(reverse: true, period: const Duration(milliseconds: 5600));
  }

  void _syncLight() {
    final run =
        widget.selected &&
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (run == _running) return;
    _running = run;
    _arriving = run;
    if (run) {
      _light.forward(from: 0);
    } else {
      _light.reset();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncLight();
  }

  @override
  void didUpdateWidget(covariant _ZodiacCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selected != widget.selected) _syncLight();
  }

  @override
  void dispose() {
    _light.dispose();
    super.dispose();
  }

  _CardLightFrame _frame() => !_running
      ? _restLight
      : _arriving
      ? _arrivingLight.transform(_light.value)
      : _flowingLight.transform(_light.value);

  double _rim() {
    if (!_arriving) return 0;
    final t = _light.value;
    return Curves.easeInOut.transform(t < .38 ? t / .38 : (1 - t) / .62);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final placement = widget.placement;
    final selected = widget.selected;
    const corners = BorderRadius.all(Radius.circular(27));
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: corners,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: selected ? .25 : .22),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: corners,
        child: Semantics(
          selected: selected,
          child: Stack(
            fit: StackFit.expand,
            children: [
              RepaintBoundary(
                child: CustomPaint(
                  willChange: _running,
                  painter: _CardLightPainter(
                    clock: _light,
                    frame: _frame,
                    rim: _rim,
                    tone: placement.color,
                    surface: Color.alphaBlend(
                      const Color(0x0b7891b4),
                      colors.surface,
                    ),
                    selected: selected,
                  ),
                ),
              ),
              Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: widget.onTap,
                  child: _ZodiacCardFace(
                    placement: placement,
                    selected: selected,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ZodiacCardFace extends StatelessWidget {
  const _ZodiacCardFace({required this.placement, required this.selected});

  final _Placement placement;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final meaning = _reportWords(context, _zodiacMeanings[placement.prefix]!);
    final reading = _zodiacReading(placement.prefix, placement.sign);
    return SingleChildScrollView(
      primary: false,
      padding: const EdgeInsets.fromLTRB(18, 17, 18, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Icon(placement.icon, size: 18, color: colors.onSurface),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    UiText(
                      placement.label,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _reportWords(context, ('（$meaning）', '($meaning)')),
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.4,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (selected) ...[
            const SizedBox(height: 15),
            Divider(height: 1, color: colors.onSurface.withValues(alpha: .15)),
            const SizedBox(height: 12),
            if (reading != null) ...[
              Row(
                spacing: 6,
                children: [
                  _ZodiacSymbol(
                    placement.glyph,
                    size: 15,
                    color: colors.onSurfaceVariant,
                  ),
                  Flexible(
                    child: UiText(
                      '${placement.sign}座',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _reportWords(context, reading.focus),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontSize: 19,
                  height: 1.28,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _reportWords(context, reading.body),
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.55,
                  color: colors.onSurface,
                ),
              ),
            ] else
              const _InsightText((
                '这份命盘还缺少这个位置的星座资料。',
                'This chart is missing the sign for this placement.',
              )),
          ],
        ],
      ),
    );
  }
}

class _CardLightFrame {
  const _CardLightFrame(
    this.x,
    this.y,
    this.rotation,
    this.zoom,
    this.gain, [
    this.opacity = 1,
  ]);

  final double x;
  final double y;
  final double rotation;
  final double zoom;
  final double gain;
  final double opacity;
}

const _restLight = _CardLightFrame(-.05, .24, -6, 1, 1.45);
final _flowingLight = _cardLightTween(
  _restLight,
  const _CardLightFrame(.05, .14, 6, 1.03, 1.60),
);
final _arrivingLight = TweenSequence<_CardLightFrame>([
  TweenSequenceItem(
    tween: _cardLightTween(
      const _CardLightFrame(-.08, .36, -8, .94, 1.25, .70),
      const _CardLightFrame(.03, .10, 5, 1.05, 1.75),
    ),
    weight: 38,
  ),
  TweenSequenceItem(
    tween: _cardLightTween(
      const _CardLightFrame(.03, .10, 5, 1.05, 1.75),
      const _CardLightFrame(.05, .16, 6, 1.03, 1.60),
    ),
    weight: 27,
  ),
  TweenSequenceItem(
    tween: _cardLightTween(
      const _CardLightFrame(.05, .16, 6, 1.03, 1.60),
      _restLight,
    ),
    weight: 35,
  ),
]);

Animatable<_CardLightFrame> _cardLightTween(
  _CardLightFrame from,
  _CardLightFrame to,
) => _CardLightTween(
  begin: from,
  end: to,
).chain(CurveTween(curve: Curves.easeInOut));

class _CardLightTween extends Tween<_CardLightFrame> {
  _CardLightTween({
    required _CardLightFrame super.begin,
    required _CardLightFrame super.end,
  });

  @override
  _CardLightFrame lerp(double t) => _CardLightFrame(
    ui.lerpDouble(begin!.x, end!.x, t)!,
    ui.lerpDouble(begin!.y, end!.y, t)!,
    ui.lerpDouble(begin!.rotation, end!.rotation, t)!,
    ui.lerpDouble(begin!.zoom, end!.zoom, t)!,
    ui.lerpDouble(begin!.gain, end!.gain, t)!,
    ui.lerpDouble(begin!.opacity, end!.opacity, t)!,
  );
}

class _CardLightPainter extends CustomPainter {
  _CardLightPainter({
    required Animation<double> clock,
    required this.frame,
    required this.rim,
    required this.tone,
    required this.surface,
    required this.selected,
  }) : super(repaint: clock);

  final _CardLightFrame Function() frame;
  final double Function() rim;
  final Color tone;
  final Color surface;
  final bool selected;

  Color _expose(Color color, double gain, double alpha) => Color.from(
    alpha: alpha,
    red: math.min(1, color.r * gain),
    green: math.min(1, color.g * gain),
    blue: math.min(1, color.b * gain),
  );

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()..color = surface;
    canvas.drawRect(rect, paint);

    final light = frame();
    final angle = light.rotation * math.pi / 180;
    final pivot = Offset(
      size.width * (.5 + 1.6 * light.x),
      size.height * (.9 + .9 * light.y),
    );
    final falloff = size.height * .45 * light.zoom;
    final opacity = selected ? light.opacity : .11;
    final color = _expose(tone, light.gain, opacity);
    final center = _expose(
      Color.lerp(tone, Colors.white, .5)!,
      light.gain,
      opacity,
    );

    canvas.save();
    canvas.translate(
      pivot.dx - math.sin(angle) * falloff,
      pivot.dy + math.cos(angle) * falloff,
    );
    canvas.rotate(angle);
    canvas.scale(
      size.width * 1.13 * light.zoom,
      size.height * 1.27 * light.zoom,
    );
    paint.shader = ui.Gradient.radial(
      Offset.zero,
      1,
      [center, color, color.withValues(alpha: 0)],
      const [0, .34, .74],
    );
    canvas.drawCircle(Offset.zero, 1, paint);
    canvas.restore();

    final pulse = rim();
    final outline = RRect.fromRectAndRadius(
      rect.deflate(.6),
      const Radius.circular(26.4),
    );
    paint
      ..shader = null
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = selected
          ? Color.lerp(const Color(0xffeff8ff), tone, .22 + pulse * .16)!
          : const Color(0x78e1edff);
    canvas.drawRRect(outline, paint);
    if (pulse > 0) {
      paint
        ..color = tone.withValues(alpha: pulse * .24)
        ..strokeWidth = 2.4
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5);
      canvas.drawRRect(outline.deflate(2), paint);
    }
  }

  @override
  bool shouldRepaint(_CardLightPainter oldDelegate) =>
      selected != oldDelegate.selected ||
      tone != oldDelegate.tone ||
      surface != oldDelegate.surface;
}
