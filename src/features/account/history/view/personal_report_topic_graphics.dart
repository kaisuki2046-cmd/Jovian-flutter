part of 'personal_report_page.dart';

class _InsightPanel extends StatelessWidget {
  const _InsightPanel(
    this.title,
    this.icon, {
    this.child,
    this.tone,
    this.onOpen,
    this.centerTitle = false,
  });

  final String title;
  final IconData icon;
  final Widget? child;
  final Color? tone;
  final VoidCallback? onOpen;
  final bool centerTitle;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      hint: onOpen == null ? null : context.uiLabel('查看详解'),
      child: _ReportGlass(
        onTap: onOpen,
        padding: const EdgeInsets.fromLTRB(15, 14, 15, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Semantics(
              header: true,
              child: Row(
                children: [
                  if (centerTitle && onOpen != null) const SizedBox(width: 18),
                  Expanded(
                    child: Row(
                      spacing: 7,
                      mainAxisAlignment: centerTitle
                          ? MainAxisAlignment.center
                          : MainAxisAlignment.start,
                      children: [
                        Icon(
                          icon,
                          size: 17,
                          color: tone == null
                              ? colors.onSurface
                              : _readableTone(colors, tone!),
                        ),
                        Flexible(
                          child: UiText(
                            title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (onOpen != null)
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: colors.onSurfaceVariant,
                    ),
                ],
              ),
            ),
            if (child case final preview?) preview,
          ],
        ),
      ),
    );
  }
}

class _InsightText extends StatelessWidget {
  const _InsightText(this.words, {this.small = false, this.maxLines});

  final _ReportWords words;
  final bool small;
  final int? maxLines;

  @override
  Widget build(BuildContext context) => Text(
    _reportWords(context, words),
    maxLines: maxLines,
    overflow: maxLines == null ? null : TextOverflow.ellipsis,
    style: TextStyle(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
      fontSize: small ? 11.5 : 13,
      height: 1.64,
    ),
  );
}

Color _readableTone(ColorScheme colors, Color tone) => Color.lerp(
  tone,
  colors.onSurface,
  colors.brightness == Brightness.dark ? .30 : .32,
)!;

class _InsightChip extends StatelessWidget {
  const _InsightChip({
    required this.text,
    required this.tone,
    this.featured = false,
  });

  final String text;
  final Color tone;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone.withValues(alpha: featured ? .19 : .09),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tone.withValues(alpha: featured ? .29 : .15)),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: featured ? 11 : 9,
          vertical: featured ? 6 : 4,
        ),
        child: Text(
          text,
          style: TextStyle(
            color: _readableTone(colors, tone),
            fontSize: featured ? 14 : 11.5,
            fontWeight: featured ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _InsightCloud extends StatelessWidget {
  const _InsightCloud(this.words, this.tone);

  final List<_ReportWords> words;
  final Color tone;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 7,
    runSpacing: 7,
    children: [
      for (final (index, word) in words.indexed)
        _InsightChip(
          text: _reportWords(context, word),
          tone: tone,
          featured: index == 0,
        ),
    ],
  );
}

class _InsightEntries extends StatelessWidget {
  const _InsightEntries(this.items);

  final List<(String, _ReportWords)> items;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final (index, (label, words)) in items.indexed) ...[
        if (index > 0)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 9),
            child: Divider(height: 1),
          ),
        UiText(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 3),
        _InsightText(words),
      ],
    ],
  );
}

typedef _ChartAxis = ({String label, double value});

List<_ChartAxis> _reportAxes(
  PersonalReportData data,
  Map<String, List<double>> weights,
) {
  final entries = [
    for (final MapEntry(:key, :value) in weights.entries)
      (label: key, value: _weightedFocus(data, value)),
  ];
  final max = entries.map((entry) => entry.value).fold(0.0, math.max);
  return [
    for (final entry in entries)
      (label: entry.label, value: max == 0 ? 0.0 : entry.value / max),
  ];
}

class _ReportRadar extends StatelessWidget {
  const _ReportRadar({
    required this.axes,
    required this.tone,
    this.height = 178,
  });

  final List<_ChartAxis> axes;
  final Color tone;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final translated = [
      for (final axis in axes)
        (label: context.uiLabel(axis.label), value: axis.value),
    ];
    return Semantics(
      label: translated
          .map((axis) => '${axis.label} ${_percent(axis.value * 100)}')
          .join(' · '),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _RadarInk(translated, tone, colors)),
      ),
    );
  }
}

class _RadarInk extends CustomPainter {
  const _RadarInk(this.axes, this.tone, this.colors);

  final List<_ChartAxis> axes;
  final Color tone;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = math.max(
      16.0,
      math.min(size.height * .35, size.width * .25),
    );
    Offset vertex(int index, double fraction) {
      final angle = index * math.pi * 2 / axes.length - math.pi / 2;
      return center +
          Offset(math.cos(angle), math.sin(angle)) * (radius * fraction);
    }

    final grid = Paint()
      ..color = colors.onSurface.withValues(alpha: .13)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final fraction in const [.25, .5, .75, 1.0]) {
      canvas.drawPath(
        Path()..addPolygon([
          for (var i = 0; i < axes.length; i++) vertex(i, fraction),
        ], true),
        grid,
      );
    }
    for (var i = 0; i < axes.length; i++) {
      canvas.drawLine(center, vertex(i, 1), grid);
    }
    final points = [
      for (final (i, axis) in axes.indexed) vertex(i, axis.value),
    ];
    final outline = Path()..addPolygon(points, true);
    canvas.drawPath(outline, Paint()..color = tone.withValues(alpha: .21));
    _inkStroke(canvas, outline, tone, width: 1.85, echo: false);
    final marker = Paint()..color = _readableTone(colors, tone);
    for (final point in points) {
      canvas.drawCircle(point, 2.5, marker);
    }
    for (final (i, axis) in axes.indexed) {
      final point = vertex(i, 1);
      final horizontal = point.dx - center.dx;
      final label = TextPainter(
        text: TextSpan(
          text: axis.label,
          style: TextStyle(
            fontSize: 10,
            fontFamily: 'JovianSansSC',
            color: colors.onSurfaceVariant,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: math.max(34, size.width * .20));
      final x = horizontal.abs() < 6
          ? point.dx - label.width / 2
          : horizontal > 0
          ? point.dx + 9
          : point.dx - label.width - 9;
      final y = horizontal.abs() < 6
          ? (point.dy < center.dy ? point.dy - label.height - 6 : point.dy + 6)
          : point.dy - label.height / 2;
      label.paint(
        canvas,
        Offset(x.clamp(0.0, math.max(0, size.width - label.width)), y),
      );
      label.dispose();
    }
  }

  @override
  bool shouldRepaint(_RadarInk oldDelegate) =>
      axes != oldDelegate.axes ||
      colors != oldDelegate.colors ||
      tone != oldDelegate.tone;
}

class _InsightBar extends StatelessWidget {
  const _InsightBar(this.label, this.value, this.tone, {this.percent = false});

  final String label;
  final double value;
  final Color tone;
  final bool percent;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Column(
      spacing: 5,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (percent)
              Text(
                _percent(value * 100),
                style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
              ),
          ],
        ),
        LinearProgressIndicator(
          minHeight: 5,
          borderRadius: BorderRadius.circular(8),
          value: value.clamp(0, 1),
          color: tone,
          backgroundColor: colors.onSurface.withValues(alpha: .09),
          semanticsLabel: label,
          semanticsValue: percent ? _percent(value * 100) : null,
        ),
      ],
    );
  }
}

class _LifeStageRail extends StatelessWidget {
  const _LifeStageRail({
    required this.ranges,
    required this.current,
    required this.tone,
  });

  final List<String> ranges;
  final int? current;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Row(
      children: [
        for (final (index, range) in ranges.indexed)
          Expanded(
            child: Column(
              spacing: 5,
              children: [
                SizedBox(
                  height: 15,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Row(
                        children: [
                          for (final shown in [
                            index > 0,
                            index + 1 < ranges.length,
                          ])
                            Expanded(
                              child: SizedBox(
                                height: 1,
                                child: ColoredBox(
                                  color: shown
                                      ? tone.withValues(alpha: .36)
                                      : Colors.transparent,
                                ),
                              ),
                            ),
                        ],
                      ),
                      Icon(
                        index == current
                            ? Icons.radio_button_checked_rounded
                            : Icons.circle,
                        size: index == current ? 15 : 6,
                        color: _readableTone(colors, tone),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      range,
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: index == current
                            ? FontWeight.w700
                            : FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _WealthLeakFunnel extends StatelessWidget {
  const _WealthLeakFunnel({required this.risk, required this.tone});

  final _ReportWords risk;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    const leak = Color(0xffbd7182);
    final stages = [tone, leak, const Color(0xff729987)];
    const widths = [.88, .69, .53];
    return Center(
      child: Column(
        spacing: 10,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 284),
            child: SizedBox(
              width: double.infinity,
              height: 112,
              child: CustomPaint(
                painter: _LeakFunnelInk(stages),
                child: Column(
                  children: [
                    for (final (index, name) in const [
                      '可用资源',
                      '支出与承诺',
                      '留下的积累',
                    ].indexed)
                      Expanded(
                        child: FractionallySizedBox(
                          widthFactor: widths[index],
                          child: Center(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: UiText(
                                name,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: _readableTone(colors, stages[index]),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Column(
            spacing: 5,
            children: [
              UiText(
                '漏财环节',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  color: _readableTone(colors, leak),
                  fontWeight: FontWeight.w600,
                ),
              ),
              _InsightChip(
                text: _reportWords(context, risk),
                tone: leak,
                featured: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LeakFunnelInk extends CustomPainter {
  const _LeakFunnelInk(this.stages);

  final List<Color> stages;

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final mid = width / 2;
    final band = size.height / stages.length;
    const edges = [.96, .78, .59, .41];
    for (final (index, tone) in stages.indexed) {
      final top = band * index + 2;
      final bottom = band * (index + 1) - 2;
      final wide = width * edges[index] / 2;
      final narrow = width * edges[index + 1] / 2;
      final shape = Path()
        ..moveTo(mid - wide + 5, top)
        ..quadraticBezierTo(mid - wide, top, mid - wide + 1, top + 4)
        ..lineTo(mid - narrow, bottom - 3)
        ..quadraticBezierTo(mid - narrow + 1, bottom, mid - narrow + 6, bottom)
        ..lineTo(mid + narrow - 6, bottom)
        ..quadraticBezierTo(mid + narrow - 1, bottom, mid + narrow, bottom - 3)
        ..lineTo(mid + wide - 1, top + 4)
        ..quadraticBezierTo(mid + wide, top, mid + wide - 5, top)
        ..close();
      canvas.drawPath(
        shape,
        Paint()..color = tone.withValues(alpha: index == 1 ? .23 : .13),
      );
      _inkStroke(
        canvas,
        shape,
        tone.withValues(alpha: .62),
        width: 1,
        echo: false,
      );
    }
  }

  @override
  bool shouldRepaint(_LeakFunnelInk oldDelegate) =>
      oldDelegate.stages != stages;
}

class _TrendInk extends CustomPainter {
  const _TrendInk({
    required this.values,
    required this.selected,
    required this.tone,
    required this.track,
  });

  final List<double> values;
  final int selected;
  final Color tone;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final points = [
      for (final (index, value) in values.indexed)
        Offset(
          size.width * (index + .5) / values.length,
          size.height * (.9 - value * .77),
        ),
    ];
    final guide = Paint()
      ..color = track
      ..strokeWidth = 1;
    for (final height in const [.24, .60, .92]) {
      canvas.drawLine(
        Offset(0, height * size.height),
        Offset(size.width, height * size.height),
        guide,
      );
    }
    canvas.drawLine(
      Offset(points[selected].dx, 7),
      Offset(points[selected].dx, size.height),
      guide,
    );
    final curve = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final previous = points[i - 1];
      final point = points[i];
      final midpoint = (previous.dx + point.dx) / 2;
      curve.cubicTo(
        midpoint,
        previous.dy,
        midpoint,
        point.dy,
        point.dx,
        point.dy,
      );
    }
    final area = Path.from(curve)
      ..lineTo(points.last.dx, size.height)
      ..lineTo(points.first.dx, size.height)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [tone.withValues(alpha: .32), tone.withValues(alpha: 0)],
        ).createShader(Offset.zero & size),
    );
    _inkStroke(canvas, curve, tone, width: 2.2, echo: false);
    for (final (index, point) in points.indexed) {
      if (index == selected)
        canvas.drawCircle(
          point,
          7,
          Paint()..color = tone.withValues(alpha: .20),
        );
      canvas.drawCircle(
        point,
        index == selected ? 4 : 2.3,
        Paint()..color = tone,
      );
    }
  }

  @override
  bool shouldRepaint(_TrendInk oldDelegate) =>
      values != oldDelegate.values ||
      selected != oldDelegate.selected ||
      tone != oldDelegate.tone ||
      track != oldDelegate.track;
}
