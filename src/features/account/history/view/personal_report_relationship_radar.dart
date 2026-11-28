part of 'personal_report_page.dart';

typedef _RelationshipDimension = ({
  _ReportWords label,
  _ReportWords meaning,
  List<double> weights,
});

// Clockwise from the top. Each half uses the same scale and has its own area.
const _relationshipDimensions = <_RelationshipDimension>[
  (
    label: ('冷处理', 'Withdrawing'),
    meaning: (
      '有分歧时，暂时不回应或用沉默来拉开距离的倾向。',
      'Pulling back or going quiet when a disagreement comes up.',
    ),
    weights: [1.30, .62, .82, 1.12, .91],
  ),
  (
    label: ('翻旧账', 'Old arguments'),
    meaning: (
      '在眼下的争执中，想起或提到还没谈开的问题。',
      'Bringing unresolved issues into a current disagreement.',
    ),
    weights: [.63, .54, .95, 1.28, 1.02],
  ),
  (
    label: ('拐弯表达', 'Unsaid needs'),
    meaning: (
      '用暗示表达不满，期待对方猜出自己在意什么。',
      'Hinting at what bothers you and hoping the other person will pick up on it.',
    ),
    weights: [.68, .90, .72, .83, 1.13],
  ),
  (
    label: ('情感疏离', 'Distance'),
    meaning: (
      '日常来往变少后，分享感受或主动联系也随之减少。',
      'Sharing less or reaching out less as everyday contact fades.',
    ),
    weights: [.84, 1.17, .73, .77, 1.10],
  ),
  (
    label: ('边界压力', 'Boundaries'),
    meaning: (
      '各自的空间、对外来往和共同承担的事需要协商时，容易感觉到的压力。',
      'Tension around personal space, outside relationships and shared responsibilities.',
    ),
    weights: [1.08, .64, 1.28, 1.14, .76],
  ),
  (
    label: ('温暖', 'Warmth'),
    meaning: (
      '通过语气、行动和回应，让对方感到自己被在乎。',
      'Showing someone they matter through your words, actions and responses.',
    ),
    weights: [.66, 1.29, .64, .50, 1.18],
  ),
  (
    label: ('理解', 'Understanding'),
    meaning: (
      '愿意先听完，再试着从对方的处境理解这件事。',
      'Listening first and considering the issue from the other person’s perspective.',
    ),
    weights: [.56, .95, .67, .66, 1.32],
  ),
  (
    label: ('引导', 'Starting a talk'),
    meaning: (
      '察觉对方需要支持时，愿意主动开启对话或一起找办法。',
      'Starting a conversation or looking for a way forward when someone needs support.',
    ),
    weights: [1.05, .97, 1.15, .89, .65],
  ),
  (
    label: ('陪伴', 'Companionship'),
    meaning: (
      '愿意留出时间一起经历日常，也能在对方需要时在场。',
      'Making time to share daily life and being present when it matters.',
    ),
    weights: [.92, .78, .82, 1.06, 1.25],
  ),
  (
    label: ('专一', 'Commitment'),
    meaning: (
      '把亲密关系里的约定当回事，愿意持续投入。',
      'Taking shared commitments seriously and putting steady effort into the relationship.',
    ),
    weights: [.82, .55, 1.20, 1.29, .74],
  ),
];

const _relationshipHalf = 5;
const _drainTone = Color(0xff638bc3);
const _careLegend = '正向滋养';
const _drainLegend = '负面消耗';

class _RelationshipRadar extends StatelessWidget {
  const _RelationshipRadar({required this.data, this.showDetails = false});

  final PersonalReportData data;
  final bool showDetails;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final careTone = _ReportTopic.love.tone;
    // Apply a common ceiling to the weighted shares of the Ten Gods present.
    final ceiling = data.gods.fold(0.0, (sum, item) => sum + item.share) * 1.35;
    final axes = [
      for (final item in _relationshipDimensions)
        (
          label: _reportWords(context, item.label),
          value: ceiling == 0
              ? 0.0
              : (_weightedFocus(data, item.weights) / ceiling).clamp(0.0, 1.0),
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Semantics(
          key: const ValueKey('personal-report-relationship-radar'),
          label: axes
              .map((axis) => '${axis.label} ${(axis.value * 100).round()}')
              .join(' · '),
          child: SizedBox(
            height: 223,
            child: CustomPaint(
              painter: _RelationshipRadarInk(axes, careTone, colors),
            ),
          ),
        ),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 18,
          runSpacing: 5,
          children: [
            _RelationshipLegend(_careLegend, careTone),
            const _RelationshipLegend(_drainLegend, _drainTone),
          ],
        ),
        if (showDetails) ...[
          const _InsightText((
            '图上分数用同一个刻度呈现这份命盘中的相对倾向。',
            'All ten scores share one scale and describe relative patterns in this chart.',
          ), small: true),
          for (final (title, start) in const [
            (_careLegend, _relationshipHalf),
            (_drainLegend, 0),
          ]) ...[
            _ReportLabel(title, Icons.circle_outlined),
            _InsightEntries([
              for (var i = start; i < start + _relationshipHalf; i++)
                (
                  '${axes[i].label} · ${(axes[i].value * 100).round()}',
                  _relationshipDimensions[i].meaning,
                ),
            ]),
          ],
        ],
      ],
    );
  }
}

class _RelationshipLegend extends StatelessWidget {
  const _RelationshipLegend(this.label, this.tone);

  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    spacing: 5,
    children: [
      Icon(Icons.circle, size: 7, color: tone),
      UiText(
        label,
        style: TextStyle(
          fontSize: 11,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    ],
  );
}

class _RelationshipRadarInk extends CustomPainter {
  const _RelationshipRadarInk(this.axes, this.careTone, this.colors);

  final List<_ChartAxis> axes;
  final Color careTone;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = math.min(size.height * .346, size.width * .30);
    final spokes = [
      for (var i = 0; i < axes.length; i++)
        Offset(
              math.cos(i * math.pi * 2 / axes.length - math.pi / 2),
              math.sin(i * math.pi * 2 / axes.length - math.pi / 2),
            ) *
            radius,
    ];
    final grid = Paint()
      ..color = colors.onSurface.withValues(alpha: .13)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final level in const [.25, .5, .75, 1.0]) {
      canvas.drawPath(
        Path()..addPolygon([
          for (final spoke in spokes) center + spoke * level,
        ], true),
        grid,
      );
    }
    for (final spoke in spokes) {
      canvas.drawLine(center, center + spoke, grid);
    }
    for (final (start, tone) in [
      (0, _drainTone),
      (_relationshipHalf, careTone),
    ]) {
      final points = [
        for (var i = start; i < start + _relationshipHalf; i++)
          center + spokes[i] * axes[i].value,
      ];
      final area = Path()..addPolygon([center, ...points], true);
      canvas.drawPath(area, Paint()..color = tone.withValues(alpha: .22));
      _inkStroke(
        canvas,
        area,
        tone.withValues(alpha: .93),
        width: 1.45,
        echo: false,
      );
      final marker = Paint()..color = _readableTone(colors, tone);
      for (final point in points) {
        canvas.drawCircle(point, 2.15, marker);
      }
    }
    for (final (i, axis) in axes.indexed) {
      final direction = spokes[i];
      final anchor = center + direction;
      final vertical = i == 0 || i == _relationshipHalf;
      final ink = _readableTone(
        colors,
        i < _relationshipHalf ? _drainTone : careTone,
      );
      final label = TextPainter(
        text: TextSpan(
          text: '${axis.label}\n${(axis.value * 100).round()}',
          style: TextStyle(
            fontFamily: 'JovianSansSC',
            fontSize: 10.5,
            height: 1.15,
            color: ink,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: vertical
            ? TextAlign.center
            : direction.dx > 0
            ? TextAlign.left
            : TextAlign.right,
        maxLines: 3,
      )..layout(maxWidth: size.width * .225);
      final x = vertical
          ? anchor.dx - label.width / 2
          : direction.dx > 0
          ? anchor.dx + 6
          : anchor.dx - label.width - 6;
      final y = vertical
          ? (i == 0 ? anchor.dy - label.height - 6 : anchor.dy + 6)
          : anchor.dy - label.height / 2;
      label.paint(
        canvas,
        Offset(x.clamp(0.0, math.max(0.0, size.width - label.width)), y),
      );
      label.dispose();
    }
  }

  @override
  bool shouldRepaint(_RelationshipRadarInk oldDelegate) =>
      oldDelegate.axes != axes ||
      oldDelegate.colors != colors ||
      oldDelegate.careTone != careTone;
}
