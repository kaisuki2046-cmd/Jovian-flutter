part of 'personal_report_page.dart';

typedef _ReportWords = (String, String);

String _reportWords(BuildContext context, _ReportWords words) =>
    context.uiLanguage == InterfaceLanguage.english ? words.$2 : words.$1;

String _godName(BuildContext context, ReportGod god) =>
    _reportWords(context, (god.label, god.english));

String _percent(double value) =>
    '${value.toStringAsFixed(1).replaceFirst(RegExp(r'\.0$'), '')}%';

String _dayMasterText(BuildContext context, String value) =>
    _reportWords(context, (value, '${value[0]} ${context.uiLabel(value[1])}'));

class _SymbolCover extends StatelessWidget {
  const _SymbolCover({
    required this.title,
    required this.icon,
    required this.child,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _ReportGlass(
    padding: const EdgeInsets.fromLTRB(12, 11, 12, 8),
    onTap: onTap,
    child: Column(
      children: [
        Row(
          children: [
            Expanded(child: _ReportLabel(title, icon)),
            Icon(
              Icons.chevron_right_rounded,
              size: 15,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ],
        ),
        const SizedBox(height: 5),
        Expanded(child: child),
      ],
    ),
  );
}

class _ReportDetailHeading extends StatelessWidget {
  const _ReportDetailHeading(this.title, this.description);

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(0, 8, 0, 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 6,
      children: [
        Semantics(
          header: true,
          child: UiText(
            title,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ),
        UiText(
          description,
          style: TextStyle(
            fontSize: 12,
            height: 1.5,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    ),
  );
}

const _godColors = <ReportGod, (Color light, Color dark)>{
  ReportGod.peer: (Color(0xff9a6929), Color(0xffe9c573)),
  ReportGod.rival: (Color(0xff2d7e8a), Color(0xff80d5d7)),
  ReportGod.artist: (Color(0xffa94f75), Color(0xffed9ab6)),
  ReportGod.challenger: (Color(0xff9f5143), Color(0xffed9c89)),
  ReportGod.opportunity: (Color(0xff337457), Color(0xff97d1af)),
  ReportGod.steward: (Color(0xff6f7636), Color(0xffc6cd84)),
  ReportGod.protector: (Color(0xff795a9b), Color(0xffc6aadf)),
  ReportGod.officer: (Color(0xff466a9b), Color(0xff9dbce8)),
  ReportGod.explorer: (Color(0xff616493), Color(0xffb0b4df)),
  ReportGod.mentor: (Color(0xff326d66), Color(0xff8ac6ba)),
};

Color _godTone(ColorScheme colors, ReportGod god) {
  final (light, dark) = _godColors[god]!;
  return colors.brightness == Brightness.dark ? dark : light;
}

List<ReportGodShare> _bottleGods(List<ReportGodShare> gods) =>
    gods.take(3).toList();

class _TenGodBottle extends StatefulWidget {
  const _TenGodBottle({required this.gods, this.large = false});

  final List<ReportGodShare> gods;
  final bool large;

  @override
  State<_TenGodBottle> createState() => _TenGodBottleState();
}

class _TenGodBottleState extends State<_TenGodBottle>
    with SingleTickerProviderStateMixin {
  late final _wave = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 5300),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final active =
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (active && !_wave.isAnimating) {
      _wave.repeat();
    } else if (!active) {
      _wave.stop();
    }
  }

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final list = _bottleGods(widget.gods);
    final remainder =
        (100.0 - list.fold(0.0, (total, entry) => total + entry.share)).clamp(
          0.0,
          100.0,
        );
    return Semantics(
      label: list.isEmpty
          ? context.uiLabel('暂无十神占比')
          : [
              for (final entry in list)
                '${_godName(context, entry.god)} ${_percent(entry.share)}',
              if (remainder > .05)
                '${context.uiLabel('其余十神')} ${_percent(remainder)}',
            ].join(' · '),
      child: RepaintBoundary(
        child: CustomPaint(
          key: const ValueKey('personal-report-ten-god-bottle'),
          willChange: _wave.isAnimating,
          painter: _BottlePainter(
            wave: _wave,
            large: widget.large,
            colors: colors,
            bands: [
              for (final entry in list)
                (
                  name: _godName(context, entry.god),
                  share: entry.share,
                  color: _godTone(colors, entry.god),
                ),
            ],
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

typedef _BottleBand = ({String name, double share, Color color});

final _vialShape = Path()
  ..moveTo(29, 23)
  ..cubicTo(42, 9, 113, 9, 144, 19)
  ..cubicTo(160, 26, 152, 34, 137, 34)
  ..cubicTo(122, 36, 116, 44, 118, 55)
  ..cubicTo(118, 69, 137, 72, 150, 85)
  ..cubicTo(170, 107, 164, 158, 149, 173)
  ..cubicTo(139, 186, 61, 187, 40, 177)
  ..cubicTo(20, 172, 16, 152, 17, 124)
  ..cubicTo(17, 102, 26, 83, 45, 75)
  ..cubicTo(61, 66, 67, 55, 59, 45)
  ..cubicTo(53, 36, 23, 40, 22, 31)
  ..quadraticBezierTo(23, 27, 29, 23)
  ..close();

void _inkStroke(
  Canvas canvas,
  Path path,
  Color ink, {
  double width = 2,
  bool echo = true,
}) {
  final brush = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;
  canvas.drawPath(path, brush..color = ink);
  if (echo) {
    canvas.save();
    canvas.translate(-.65, .7);
    canvas.drawPath(
      path,
      brush
        ..color = ink.withValues(alpha: ink.a * .28)
        ..strokeWidth = width * .48,
    );
    canvas.restore();
  }
}

class _BottlePainter extends CustomPainter {
  _BottlePainter({
    required this.wave,
    required this.colors,
    required this.bands,
    required this.large,
  }) : super(repaint: wave);

  final Animation<double> wave;
  final ColorScheme colors;
  final List<_BottleBand> bands;
  final bool large;

  void _label(
    Canvas canvas,
    String text,
    Color color,
    double y,
    double height,
  ) {
    final label = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: math.min(large ? 12.5 : 15, height * .69),
          fontWeight: FontWeight.w600,
          color: color,
          height: 1,
          fontFamily: 'JovianSansSC',
          letterSpacing: .4,
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 1,
      ellipsis: '…',
    )..layout(maxWidth: 90);
    label.paint(canvas, Offset(91 - label.width / 2, y - label.height / 2));
    label.dispose();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / 177, size.height / 193);
    if (scale <= 0) return;
    final ink = colors.onSurface.withValues(alpha: .90);
    final phase = wave.value * math.pi * 2;
    final sway = math.sin(phase);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(scale);
    canvas.rotate(sway * .031);
    canvas.translate(-89, -94);

    canvas.save();
    canvas.clipPath(_vialShape);
    const top = 30.0;
    const bottom = 176.0;
    var floor = bottom;
    for (final (index, band) in bands.reversed.indexed) {
      final thickness = band.share * (bottom - top) / 100;
      final level = floor - thickness;
      final tension = math.min(6, thickness / 3);
      final slope = math.sin(phase - .9 + index * .72) * tension;
      final ripple = math.cos(phase * 2 - index * .88) * tension;
      final line = Path()
        ..moveTo(10, level + slope)
        ..cubicTo(
          36,
          level - ripple - 3,
          59,
          level - ripple * .55 - 2,
          88,
          level,
        )
        ..cubicTo(
          107,
          level + ripple * .55 + 1.5,
          133,
          level - slope * .58 + 2,
          168,
          level - slope,
        );
      _inkStroke(canvas, line, band.color, width: 2.7);
      if (thickness >= 9) {
        final share = large ? ' ${_percent(band.share)}' : '';
        _label(
          canvas,
          '${band.name}$share',
          ink,
          level + thickness * .57,
          thickness,
        );
      }
      floor = level;
    }
    if (bands.isNotEmpty && floor - top >= 6) {
      _label(
        canvas,
        '···',
        ink.withValues(alpha: .63),
        (floor + top) / 2,
        floor - top,
      );
    }
    canvas.restore();

    _inkStroke(canvas, _vialShape, ink, width: 2.4);
    _inkStroke(
      canvas,
      Path()
        ..moveTo(34, 23)
        ..cubicTo(69, 13, 111, 16, 143, 23),
      ink.withValues(alpha: .37),
      width: 1.2,
      echo: false,
    );
    _inkStroke(
      canvas,
      Path()
        ..moveTo(29, 118)
        ..quadraticBezierTo(28, 96, 43, 88)
        ..moveTo(126, 174)
        ..quadraticBezierTo(143, 174, 149, 153),
      ink.withValues(alpha: .29),
      width: 1.05,
      echo: false,
    );
    final fleck = Color.lerp(
      ink,
      bands.firstOrNull?.color ?? ink,
      .7,
    )!.withValues(alpha: .71);
    _inkStroke(
      canvas,
      Path()
        ..moveTo(158, 53)
        ..lineTo(159, 68)
        ..moveTo(152, 61)
        ..lineTo(165, 59)
        ..moveTo(9, 74)
        ..lineTo(10, 83)
        ..moveTo(5, 79)
        ..lineTo(14, 78),
      fleck,
      width: 1.5,
      echo: false,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BottlePainter oldDelegate) =>
      colors != oldDelegate.colors ||
      bands != oldDelegate.bands ||
      large != oldDelegate.large;
}

class _TenGodDetail extends StatelessWidget {
  const _TenGodDetail({required this.data});

  final PersonalReportData data;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final subtitles = data.example
        ? '示例用瓶中波纹展示三种主要十神，省略号代表其余。'
        : data.weighted
        ? '波纹高度按命盘的月令加权占比绘制，省略号代表其余。'
        : '波纹高度按可确认的透干与藏干十神次数绘制，省略号代表其余。';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        _ReportDetailHeading('十神', subtitles),
        Align(
          child: SizedBox(
            width: 264,
            height: 247,
            child: _TenGodBottle(gods: data.gods, large: true),
          ),
        ),
        if (data.gods.isEmpty)
          const _ReportGlass(child: UiText('暂无十神占比'))
        else
          for (final entry in data.gods)
            _ReportGlass(
              padding: const EdgeInsets.fromLTRB(15, 13, 15, 15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  Row(
                    spacing: 9,
                    children: [
                      _TenGodMark(
                        god: entry.god,
                        color: _godTone(colors, entry.god),
                      ),
                      Expanded(
                        child: Text(
                          _godName(context, entry.god),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        _percent(entry.share),
                        style: TextStyle(
                          fontSize: 13,
                          color: _godTone(colors, entry.god),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _reportWords(context, _godNotes[entry.god]!),
                    style: TextStyle(
                      color: colors.onSurfaceVariant,
                      height: 1.65,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

const _godNotes = <ReportGod, _ReportWords>{
  ReportGod.peer: (
    '比肩关乎自主、同伴与平等。你擅长按自己的标准做事，也喜欢坦诚的关系。遇到意见相左时，先把共同目标说清楚，能让坚持成为合作的底气。',
    'Peer points to independence and equality. You may work best by your own standards and value candid relationships. Naming a shared goal helps conviction become an asset to collaboration.',
  ),
  ReportGod.rival: (
    '劫财关注同伴之间的协作与竞争。你能借集体的劲儿把事做起来。涉及资源、利益或时间时，提早讲清分工和边界。',
    'Rob Wealth highlights mutual drive and competition. A group can help you get things moving. Agree on roles, resources and time before commitments grow.',
  ),
  ReportGod.artist: (
    '食神关乎表达、体验与把技能磨成熟。你更容易在感到自在时产出作品。把灵感落实成小成果，让稳定的节奏帮你积累。',
    'Eating God emphasizes expression, experience and craft. You may create more freely with room to breathe. Turn ideas into small finished pieces and let a steady rhythm build skill.',
  ),
  ReportGod.challenger: (
    '伤官看见规则里的缝隙，也乐于提出新做法。把锋利的判断变成可测试的方案，能让别人接住你的创意。',
    'Hurting Officer notices gaps in conventions. Turn sharp observations into testable proposals so other people can build on your ideas.',
  ),
  ReportGod.opportunity: (
    '偏财侧重把分散的人、信息和资源凑成机会。遇到新可能时，先验证边界、成本和承诺，再决定投入多少。',
    'Indirect Wealth emphasizes linking people, information and resources. Check the scope, cost and commitment before deciding how much to put into an opportunity.',
  ),
  ReportGod.steward: (
    '正财重视稳定回报和可预期的积累。明确时间与预算能让你的计划更扎实，也能给探索留出余地。',
    'Direct Wealth values dependable returns and gradual accumulation. Working with a clear time frame and budget gives steady plans room to grow.',
  ),
  ReportGod.protector: (
    '七杀遇到挑战容易进入行动状态。给压力设一个期限，配上清楚的优先级和恢复时间，能避免一直硬扛。',
    'Seven Killings is associated with mobilizing under challenge. Give pressure a deadline and pair it with clear priorities and recovery time.',
  ),
  ReportGod.officer: (
    '正官重视职责、秩序和履约。清晰规则能帮助你发挥，但也需要给协商和试错留出空间。',
    'Direct Officer values responsibility, order and keeping commitments. Clear rules can help you, and room to negotiate and experiment keeps them workable.',
  ),
  ReportGod.explorer: (
    '偏印关乎好奇、独立理解和跨领域联想。把想明白的东西用一次、讲一遍，能检验想法在哪些场景成立。',
    'Indirect Resource emphasizes curiosity and cross-disciplinary connections. Apply or teach what you have learned to find where it holds up.',
  ),
  ReportGod.mentor: (
    '正印关乎吸收信息、持续学习与接受支持。找到可靠资料和愿意反馈的人，比一个人把所有问题想完更有效。',
    'Direct Resource emphasizes learning and receiving support. Reliable materials and people who give feedback can move you forward.',
  ),
};

class _TenGodMark extends StatelessWidget {
  const _TenGodMark({required this.god, required this.color});

  final ReportGod god;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final icon = switch (god.group) {
      ReportGodGroup.peers => Icons.diversity_3_outlined,
      ReportGodGroup.expression => Icons.draw_outlined,
      ReportGodGroup.wealth => Icons.savings_outlined,
      ReportGodGroup.responsibility => Icons.shield_outlined,
      ReportGodGroup.learning => Icons.menu_book_outlined,
    };
    return SizedBox.square(
      dimension: 32,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: .10),
        ),
        child: god == ReportGod.peer
            ? CustomPaint(painter: _PeerMark(color))
            : Icon(icon, size: 17, color: color),
      ),
    );
  }
}

class _PeerMark extends CustomPainter {
  const _PeerMark(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 32;
    canvas.scale(scale);
    _inkStroke(
      canvas,
      Path()
        ..addOval(const Rect.fromLTWH(10, 8, 5.6, 6.2))
        ..addOval(const Rect.fromLTWH(18.8, 9.5, 5.2, 5.8))
        ..moveTo(6.5, 23)
        ..cubicTo(7.8, 16, 16.8, 15.2, 19, 22.8)
        ..moveTo(20, 17.7)
        ..quadraticBezierTo(25.4, 17, 26.2, 23),
      color,
      width: 1.35,
      echo: false,
    );
  }

  @override
  bool shouldRepaint(_PeerMark oldDelegate) => color != oldDelegate.color;
}
