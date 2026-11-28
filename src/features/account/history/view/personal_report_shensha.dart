part of 'personal_report_page.dart';

typedef _ShenNotes = ({String english, Color tone, _ReportWords reading});

const _shenNotes = <String, _ShenNotes>{
  '天乙贵人': (
    english: 'Heavenly Helper',
    tone: Color(0xffbe9162),
    reading: (
      '遇到转折时，可以先找有经验、愿意给具体意见的人。准备好问题和上下文，比泛泛求助更容易接住支持。',
      'At a turning point, look for experienced people who offer specific advice. A clear question and context make support easier to use.',
    ),
  ),
  '文昌贵人': (
    english: 'Literary Star',
    tone: Color(0xff6c96a2),
    reading: (
      '整理、写作与系统学习是值得培养的方向。把读过的材料写成自己的提纲，再向别人解释一遍。',
      'Writing, organizing ideas and systematic study are worth cultivating. Outline what you read in your own words and explain it to someone.',
    ),
  ),
  '学堂': (
    english: 'Academic Hall',
    tone: Color(0xff6f998a),
    reading: (
      '有清楚的课程脉络时，更容易把零散知识连到一起。先搭一个章节框架，再从习题或案例检验掌握程度。',
      'A coherent course helps connect scattered knowledge. Outline the main sections, then check your understanding through problems or cases.',
    ),
  ),
  '词馆': (
    english: 'Literary Hall',
    tone: Color(0xff8498ae),
    reading: (
      '阅读、写作和复述相互配合时，比较容易吸收新知识。把术语改写成自己的说法，再听一次具体反馈。',
      'Reading, writing and retelling can help new ideas stick. Explain a term in your own words and get one piece of concrete feedback.',
    ),
  ),
  '桃花': (
    english: 'Peach Blossom',
    tone: Color(0xffc2809b),
    reading: (
      '在人群里比较容易被留意，风格与表达能打开相识的机会。判断一段关系时，多观察彼此是否愿意持续投入。',
      'Style and expression can make it easier to be noticed and meet people. Notice whether both sides keep showing up over time.',
    ),
  ),
  '驿马': (
    english: 'Traveling Horse',
    tone: Color(0xff749982),
    reading: (
      '换环境、接触陌生领域时，容易看到新选项。迁动前弄清目标、适应成本，以及哪些事值得带到下一站。',
      'Changing environments can reveal options. Identify your goal, the cost of adapting, and what you want to carry into the next setting.',
    ),
  ),
  '将星': (
    english: 'General Star',
    tone: Color(0xffa99a61),
    reading: (
      '需要定方向或有人站出来承担时，你可以先试着主持一次小范围的协调，把共同目标和分工说清楚。',
      'When a direction or owner is needed, try coordinating a small effort and making the shared goal and roles clear.',
    ),
  ),
  '华盖': (
    english: 'Canopy Star',
    tone: Color(0xff9486b1),
    reading: (
      '独处有助于沉进去思考，也可能让他人猜不出你的状态。给深入研究留时间，同时约一个回到交流中的时点。',
      'Solitude can support deep thought and leave others unsure how you are doing. Set aside focused time and a point to reconnect.',
    ),
  ),
  '禄神': (
    english: 'Prosperity Star',
    tone: Color(0xffb48a61),
    reading: (
      '稳定的技能和可重复的流程有利于积累。看看哪些成果可以通过长期练习和清晰的交付持续变好。',
      'Stable skills and repeatable processes support steady accumulation. Look at what improves with deliberate practice and clear delivery.',
    ),
  ),
  '空亡': (
    english: 'Void',
    tone: Color(0xff898fa8),
    reading: (
      '遇到暂时悬而未定的事，先分清缺少的条件，再决定要等、核实还是换一种做法。',
      'When something is still unsettled, identify what is missing before deciding to wait, check a fact or change approach.',
    ),
  ),
};

String _shenName(BuildContext context, String name) =>
    _reportWords(context, (name, _shenNotes[name]?.english ?? name));

String _pillarName(BuildContext context, Pillar pillar) =>
    context.uiLabel(switch (pillar) {
      Pillar.year => '年柱',
      Pillar.month => '月柱',
      Pillar.day => '日柱',
      Pillar.hour => '时柱',
    });

class _ShenShaDetail extends StatefulWidget {
  const _ShenShaDetail({super.key, required this.data});

  final PersonalReportData data;

  @override
  State<_ShenShaDetail> createState() => _ShenShaDetailState();
}

class _ShenShaDetailState extends State<_ShenShaDetail> {
  static const _copies = 5;
  late int _activePage = _middlePage;
  late final _pages = PageController(
    initialPage: _middlePage,
    keepPage: false,
    viewportFraction: .865,
  );

  int get _count => widget.data.shenSha.length;
  bool get _loops => _count > 1;
  int get _middlePage => _loops ? _count * (_copies ~/ 2) : 0;
  int get _pageCount => _loops ? _count * _copies : _count;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _go(int direction) {
    final next = _activePage + direction;
    if (!_loops || !_pages.hasClients || next < 0 || next >= _pageCount) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _pages.jumpToPage(next);
    } else {
      _pages.animateToPage(
        next,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    }
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    return switch (event.logicalKey) {
      LogicalKeyboardKey.arrowLeft => _moveByKey(-1),
      LogicalKeyboardKey.arrowRight => _moveByKey(1),
      _ => KeyEventResult.ignored,
    };
  }

  KeyEventResult _moveByKey(int direction) {
    _go(direction);
    return KeyEventResult.handled;
  }

  bool _keepLoopCentered(ScrollEndNotification notification) {
    if (!_loops ||
        notification.depth != 0 ||
        notification.metrics is! PageMetrics) {
      return false;
    }
    final page = (notification.metrics as PageMetrics).page?.round();
    if (page == null) return false;
    final centered = _middlePage + page % _count;
    if (centered == page) return false;

    // Recenter between gestures, when the current card and both peeks match.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted &&
          _pages.hasClients &&
          !_pages.position.isScrollingNotifier.value &&
          _pages.page?.round() == page) {
        _pages.jumpToPage(centered);
      }
    });
    return false;
  }

  Widget _buildCard(BuildContext context, int index) {
    final active = _activePage == index;
    return AnimatedBuilder(
      animation: _pages,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        excludeFromSemantics: true,
        onTap: active ? null : () => _go(index - _activePage),
        child: ExcludeSemantics(
          excluding: !active,
          child: IgnorePointer(
            ignoring: !active,
            child: _ShenReadingCard(
              hit: widget.data.shenSha[index % _count],
              partial: widget.data.partial,
            ),
          ),
        ),
      ),
      builder: (context, child) {
        final page = _pages.hasClients && _pages.position.hasContentDimensions
            ? _pages.page ?? _activePage.toDouble()
            : _activePage.toDouble();
        final distance = (index - page).clamp(-1.0, 1.0);
        final depth = distance.abs();
        return Padding(
          padding: const EdgeInsets.fromLTRB(2, 12, 2, 16),
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, -1 / 980)
              ..translateByDouble(-7 * distance, 4 * depth, -24 * depth, 1)
              ..rotateY(distance * .31)
              ..scaleByDouble(1 - .026 * depth, 1 - .13 * depth, 1, 1),
            child: Opacity(opacity: 1 - .49 * depth, child: child),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final hits = widget.data.shenSha;
    final colors = Theme.of(context).colorScheme;
    if (hits.isEmpty) {
      return const Center(child: _ReportGlass(child: UiText('这份命盘暂无可展示的神煞。')));
    }
    final scroll = ScrollConfiguration.of(context);
    return Focus(
      autofocus: true,
      onKeyEvent: _handleKey,
      child: Column(
        children: [
          Expanded(
            child: ScrollConfiguration(
              behavior: scroll.copyWith(
                dragDevices: {...scroll.dragDevices, PointerDeviceKind.mouse},
              ),
              child: NotificationListener<ScrollEndNotification>(
                onNotification: _keepLoopCentered,
                child: PageView.builder(
                  key: const ValueKey('personal-report-shensha-pages'),
                  controller: _pages,
                  itemCount: _pageCount,
                  onPageChanged: (index) => setState(() => _activePage = index),
                  itemBuilder: _buildCard,
                ),
              ),
            ),
          ),
          SizedBox(
            height: 42,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  tooltip: context.uiLabel('上一张神煞'),
                  onPressed: _loops ? () => _go(-1) : null,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    '${_activePage % _count + 1} / $_count',
                    key: const ValueKey('personal-report-shensha-count'),
                    style: TextStyle(
                      fontSize: 12,
                      color: colors.onSurfaceVariant,
                      fontFeatures: const [ui.FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                IconButton(
                  tooltip: context.uiLabel('下一张神煞'),
                  onPressed: _loops ? () => _go(1) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShenReadingCard extends StatelessWidget {
  const _ShenReadingCard({required this.hit, required this.partial});

  final ReportShenSha hit;
  final bool partial;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final note = _shenNotes[hit.name];
    final tone = note?.tone ?? colors.onSurfaceVariant;
    return LayoutBuilder(
      builder: (context, bounds) {
        final artHeight = math.min(
          bounds.maxWidth * .78,
          math.max(62.0, (bounds.maxHeight - 183) * .91),
        );
        return CustomPaint(
          key: ValueKey('personal-report-shensha-card-${hit.name}'),
          painter: _ShenReadingFrame(tone, colors),
          child: SingleChildScrollView(
            padding: EdgeInsets.zero,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: bounds.maxHeight),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 24, 28, 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  spacing: 12,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 7,
                      children: [
                        const _ReportLabel('神煞', Icons.style_outlined),
                        Semantics(
                          header: true,
                          child: Text(
                            _shenName(context, hit.name),
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                        ),
                        if (hit.pillars.isNotEmpty)
                          Wrap(
                            spacing: 6,
                            runSpacing: 5,
                            children: [
                              for (final pillar in hit.pillars)
                                _InsightChip(
                                  text: _pillarName(context, pillar),
                                  tone: tone,
                                ),
                            ],
                          ),
                      ],
                    ),
                    ExcludeSemantics(
                      child: SizedBox(
                        height: artHeight,
                        child: CustomPaint(
                          painter: _ShenReadingEmblem(hit.name, tone, colors),
                        ),
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 8,
                      children: [
                        Divider(height: 1, color: tone.withValues(alpha: .36)),
                        _InsightText(
                          note?.reading ??
                              const (
                                '可以结合上方命中的四柱一起读。',
                                'Read this symbol alongside the pillars shown above.',
                              ),
                        ),
                        if (partial)
                          const UiText(
                            '仅展示所有候选命盘一致的命中。',
                            style: TextStyle(fontSize: 11),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ShenReadingFrame extends CustomPainter {
  const _ShenReadingFrame(this.tone, this.colors);

  final Color tone;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final paper = Path()
      ..moveTo(9, 9)
      ..cubicTo(w * .27, 3, w * .73, 13, w - 9, 7)
      ..quadraticBezierTo(w - 4, 6, w - 4, 13)
      ..cubicTo(w - 8, h * .3, w - 5, h * .65, w - 5, h - 10)
      ..quadraticBezierTo(w - 5, h - 4, w - 12, h - 5)
      ..cubicTo(w * .61, h - 12, w * .32, h - 3, 10, h - 6)
      ..quadraticBezierTo(4, h - 5, 4, h - 13)
      ..cubicTo(8, h * .67, 5, h * .39, 5, 15)
      ..quadraticBezierTo(4, 10, 9, 9)
      ..close();
    canvas.drawShadow(paper, const Color(0x4d000000), 5, false);
    canvas.drawPath(
      paper,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(tone.withValues(alpha: .17), colors.surface),
            Color.alphaBlend(tone.withValues(alpha: .085), colors.surface),
          ],
        ).createShader(Offset.zero & size),
    );
    _inkStroke(
      canvas,
      paper,
      _readableTone(colors, tone).withValues(alpha: .72),
      width: 1.5,
    );
  }

  @override
  bool shouldRepaint(_ShenReadingFrame oldDelegate) =>
      tone != oldDelegate.tone || colors != oldDelegate.colors;
}

class _ShenReadingEmblem extends CustomPainter {
  const _ShenReadingEmblem(this.name, this.tone, this.colors);

  final String name;
  final Color tone;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    final emblem = _shenEmblem(name);
    final ink = _readableTone(colors, tone);
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .44;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = tone.withValues(alpha: .27);
    canvas.drawCircle(center, radius, ring);
    canvas.drawCircle(
      center,
      radius * .89,
      ring..color = tone.withValues(alpha: .16),
    );
    for (final sign in [-1.0, 1.0]) {
      final pivot = center + Offset(sign * radius * .76, -sign * radius * .64);
      final size = radius * .085;
      final fleck = Path()
        ..moveTo(pivot.dx - size, pivot.dy)
        ..lineTo(pivot.dx + size, pivot.dy)
        ..moveTo(pivot.dx, pivot.dy - size)
        ..lineTo(pivot.dx, pivot.dy + size);
      _inkStroke(canvas, fleck, ink.withValues(alpha: .65), width: 1.35);
    }
    final bounds = emblem.getBounds();
    final scale = radius * 1.30 / bounds.longestSide;
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(scale);
    canvas.translate(-bounds.center.dx, -bounds.center.dy);
    _inkStroke(canvas, emblem, ink, width: 1.75);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ShenReadingEmblem oldDelegate) =>
      name != oldDelegate.name ||
      tone != oldDelegate.tone ||
      colors != oldDelegate.colors;
}

final _coverFlow = TweenSequence<double>([
  TweenSequenceItem(tween: ConstantTween<double>(1), weight: 17),
  TweenSequenceItem(
    tween: Tween(
      begin: 1.0,
      end: 2.0,
    ).chain(CurveTween(curve: Curves.easeInOutCubic)),
    weight: 14,
  ),
  TweenSequenceItem(tween: ConstantTween<double>(2), weight: 10),
  TweenSequenceItem(
    tween: Tween(
      begin: 2.0,
      end: 0.0,
    ).chain(CurveTween(curve: Curves.easeInOutCubic)),
    weight: 24,
  ),
  TweenSequenceItem(tween: ConstantTween<double>(0), weight: 12),
  TweenSequenceItem(
    tween: Tween(
      begin: 0.0,
      end: 1.0,
    ).chain(CurveTween(curve: Curves.easeInOutCubic)),
    weight: 13,
  ),
  TweenSequenceItem(tween: ConstantTween<double>(1), weight: 10),
]);

class _ShenShaCoverDeck extends StatefulWidget {
  const _ShenShaCoverDeck({required this.hits});

  final List<ReportShenSha> hits;

  @override
  State<_ShenShaCoverDeck> createState() => _ShenShaCoverDeckState();
}

class _ShenShaCoverDeckState extends State<_ShenShaCoverDeck>
    with SingleTickerProviderStateMixin {
  late final _motion = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 7600),
  );

  void _syncMotion() {
    final play =
        widget.hits.length >= 2 &&
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (play && !_motion.isAnimating) {
      _motion.repeat();
    } else if (!play) {
      _motion.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncMotion();
  }

  @override
  void didUpdateWidget(covariant _ShenShaCoverDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.hits.length != oldWidget.hits.length) _syncMotion();
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  List<ReportShenSha?> get _coverCards => switch (widget.hits) {
    [] => [null, null, null],
    [final first] => [null, first, null],
    [final first, final second] => [null, first, second],
    _ => widget.hits.take(3).toList(),
  };

  @override
  Widget build(BuildContext context) {
    final cards = _coverCards;
    return RepaintBoundary(
      child: IgnorePointer(
        child: ExcludeSemantics(
          child: LayoutBuilder(
            builder: (context, bounds) {
              final width = math.min(95.0, bounds.maxWidth * .62);
              return SizedBox.expand(
                child: ClipRect(
                  child: AnimatedBuilder(
                    animation: _motion,
                    builder: (context, _) {
                      final at = _coverFlow.transform(_motion.value);
                      final positions =
                          [
                            for (final (index, hit) in cards.indexed)
                              (
                                index: index,
                                hit: hit,
                                distance: (index - at + 1.5) % 3 - 1.5,
                              ),
                          ]..sort(
                            (a, b) =>
                                b.distance.abs().compareTo(a.distance.abs()),
                          );
                      return Stack(
                        alignment: Alignment.center,
                        children: [
                          for (final card in positions)
                            _ShenFlowCard(
                              key: ValueKey(card.index),
                              hit: card.hit,
                              distance: card.distance,
                              width: width,
                            ),
                        ],
                      );
                    },
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ShenFlowCard extends StatelessWidget {
  const _ShenFlowCard({
    super.key,
    required this.hit,
    required this.distance,
    required this.width,
  });

  final ReportShenSha? hit;
  final double distance;
  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final depth = distance.abs();
    final travel =
        (math.min(depth, 1) + math.max(0, depth - 1) * .4) *
        width *
        .69 *
        distance.sign;
    final scale = (1 - depth * .10).clamp(.76, 1.0);
    final name = hit?.name;
    return Transform(
      alignment: Alignment.center,
      transform: Matrix4.identity()
        ..setEntry(3, 2, -1 / 660)
        ..translateByDouble(travel, depth * 3, -18 * depth, 1)
        ..rotateY(-distance.sign * math.min(depth, 1) * .92)
        ..scaleByDouble(scale, scale, 1, 1),
      child: Opacity(
        opacity: (1 - depth * .23).clamp(.33, 1.0),
        child: SizedBox(
          width: width,
          height: width * 1.31,
          child: CustomPaint(
            painter: _ShenCardInk(
              name: name,
              colors: colors,
              emphasis: (1 - depth).clamp(0, 1),
            ),
            child: name == null
                ? null
                : Align(
                    alignment: const Alignment(0, .75),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 7),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          _shenName(context, name),
                          maxLines: 1,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

final _shenPaper = Path()
  ..moveTo(9, 8)
  ..quadraticBezierTo(29, 4, 54, 7)
  ..quadraticBezierTo(78, 9, 94, 5)
  ..quadraticBezierTo(89, 34, 92, 63)
  ..quadraticBezierTo(91, 91, 97, 123)
  ..quadraticBezierTo(73, 126, 48, 123)
  ..quadraticBezierTo(28, 122, 6, 126)
  ..quadraticBezierTo(10, 96, 7, 68)
  ..quadraticBezierTo(10, 38, 9, 8)
  ..close();

class _ShenCardInk extends CustomPainter {
  const _ShenCardInk({
    required this.name,
    required this.colors,
    required this.emphasis,
  });

  final String? name;
  final ColorScheme colors;
  final double emphasis;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 102, size.height / 132);
    final tone = _shenNotes[name]?.tone ?? colors.onSurfaceVariant;
    final ink = Color.lerp(colors.onSurface, tone, .26)!;
    final paper = Color.lerp(colors.surface, tone, .086 + emphasis * .07)!;
    canvas.drawShadow(
      _shenPaper,
      const Color(0x72000000),
      4 + emphasis * 4,
      false,
    );
    canvas.drawPath(_shenPaper, Paint()..color = paper);
    _inkStroke(canvas, _shenPaper, ink.withValues(alpha: .78), width: 1.55);
    _inkStroke(
      canvas,
      Path()
        ..moveTo(14, 27)
        ..lineTo(14, 16)
        ..quadraticBezierTo(17, 13, 25, 13)
        ..moveTo(78, 116)
        ..quadraticBezierTo(83, 116, 87, 114)
        ..lineTo(87, 104),
      tone.withValues(alpha: .57),
      width: 1.2,
      echo: false,
    );
    if (name != null) {
      _inkStroke(canvas, _shenEmblem(name!), ink, width: 1.75);
      _inkStroke(
        canvas,
        Path()
          ..moveTo(24, 36)
          ..lineTo(24, 45)
          ..moveTo(20, 40)
          ..lineTo(29, 39)
          ..moveTo(74, 77)
          ..lineTo(74, 84)
          ..moveTo(70, 80)
          ..lineTo(78, 80),
        tone.withValues(alpha: .76),
        width: 1.35,
        echo: false,
      );
    } else {
      _inkStroke(
        canvas,
        Path()
          ..moveTo(51, 41)
          ..quadraticBezierTo(56, 53, 67, 58)
          ..quadraticBezierTo(56, 63, 51, 77)
          ..quadraticBezierTo(47, 64, 35, 59)
          ..quadraticBezierTo(47, 54, 51, 41),
        ink.withValues(alpha: .39),
        width: 1.3,
      );
    }
  }

  @override
  bool shouldRepaint(_ShenCardInk oldDelegate) =>
      name != oldDelegate.name ||
      colors != oldDelegate.colors ||
      emphasis != oldDelegate.emphasis;
}

Path _shenEmblem(String name) {
  final path = Path();
  switch (name) {
    case '天乙贵人':
      path
        ..moveTo(40, 68)
        ..cubicTo(36, 48, 51, 31, 60, 40)
        ..cubicTo(71, 50, 66, 76, 53, 81)
        ..cubicTo(46, 83, 42, 77, 40, 68)
        ..moveTo(59, 39)
        ..cubicTo(57, 29, 68, 28, 66, 36)
        ..quadraticBezierTo(64, 41, 61, 40)
        ..moveTo(42, 51)
        ..quadraticBezierTo(33, 43, 31, 49)
        ..quadraticBezierTo(34, 56, 40, 55)
        ..moveTo(66, 57)
        ..quadraticBezierTo(77, 51, 73, 60)
        ..quadraticBezierTo(70, 65, 65, 65)
        ..moveTo(47, 57)
        ..lineTo(51, 56)
        ..moveTo(55, 55)
        ..lineTo(59, 54)
        ..moveTo(53, 60)
        ..lineTo(49, 63)
        ..lineTo(54, 64)
        ..moveTo(48, 81)
        ..lineTo(46, 89)
        ..lineTo(41, 91)
        ..moveTo(56, 81)
        ..lineTo(59, 89)
        ..lineTo(63, 89);
    case '桃花':
      path.addOval(const Rect.fromLTWH(46, 54, 10, 10));
      for (var index = 0; index < 5; index++) {
        final angle = index * math.pi * 2 / 5 - math.pi / 2;
        final along = Offset(math.cos(angle), math.sin(angle));
        final side = Offset(-along.dy, along.dx);
        final center = const Offset(51, 59);
        final start = center + along * 6;
        final end = center + along * 21;
        path
          ..moveTo(start.dx, start.dy)
          ..quadraticBezierTo(
            (end + side * 11).dx,
            (end + side * 11).dy,
            end.dx,
            end.dy,
          )
          ..quadraticBezierTo(
            (end - side * 11).dx,
            (end - side * 11).dy,
            start.dx,
            start.dy,
          );
      }
    case '文昌贵人':
      path
        ..moveTo(51, 47)
        ..quadraticBezierTo(42, 39, 30, 42)
        ..lineTo(31, 70)
        ..quadraticBezierTo(42, 67, 51, 75)
        ..quadraticBezierTo(59, 67, 72, 70)
        ..lineTo(72, 42)
        ..quadraticBezierTo(61, 39, 51, 47)
        ..lineTo(51, 75)
        ..moveTo(36, 50)
        ..quadraticBezierTo(42, 49, 46, 53)
        ..moveTo(36, 57)
        ..quadraticBezierTo(42, 57, 46, 60)
        ..moveTo(57, 53)
        ..quadraticBezierTo(62, 49, 67, 50)
        ..moveTo(57, 60)
        ..quadraticBezierTo(62, 57, 67, 57);
    case '驿马':
      path
        ..moveTo(26, 66)
        ..quadraticBezierTo(39, 58, 46, 54)
        ..quadraticBezierTo(41, 42, 29, 38)
        ..quadraticBezierTo(47, 36, 56, 50)
        ..quadraticBezierTo(69, 42, 78, 45)
        ..lineTo(83, 49)
        ..lineTo(74, 53)
        ..quadraticBezierTo(67, 65, 53, 67)
        ..quadraticBezierTo(39, 72, 25, 76)
        ..lineTo(32, 69)
        ..lineTo(26, 66);
    case '将星':
      path
        ..moveTo(37, 83)
        ..lineTo(39, 37)
        ..quadraticBezierTo(43, 30, 47, 37)
        ..quadraticBezierTo(52, 42, 70, 39)
        ..lineTo(67, 59)
        ..quadraticBezierTo(48, 64, 40, 58)
        ..moveTo(52, 48)
        ..lineTo(61, 47)
        ..moveTo(51, 53)
        ..lineTo(62, 53);
    case '华盖':
      path
        ..moveTo(27, 56)
        ..quadraticBezierTo(51, 25, 77, 56)
        ..quadraticBezierTo(66, 49, 60, 58)
        ..quadraticBezierTo(52, 48, 44, 58)
        ..quadraticBezierTo(37, 50, 27, 56)
        ..moveTo(52, 56)
        ..lineTo(51, 76)
        ..quadraticBezierTo(52, 87, 59, 80);
    case '禄神':
      path
        ..addOval(const Rect.fromLTWH(31, 39, 41, 41))
        ..addOval(const Rect.fromLTWH(35, 43, 33, 33))
        ..moveTo(46, 54)
        ..lineTo(57, 54)
        ..lineTo(57, 65)
        ..lineTo(46, 65)
        ..close();
    default:
      path
        ..moveTo(57, 37)
        ..cubicTo(34, 32, 26, 68, 48, 77)
        ..quadraticBezierTo(65, 83, 74, 66)
        ..cubicTo(57, 69, 44, 55, 57, 37)
        ..close();
  }
  return path;
}
