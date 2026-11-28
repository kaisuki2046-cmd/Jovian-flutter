part of 'personal_report_page.dart';

typedef _Placement = ({
  String label,
  String prefix,
  String sign,
  String glyph,
  Color color,
  IconData icon,
});

const _samplePlacements = <_Placement>[
  (
    label: '太阳星座',
    prefix: '太阳',
    sign: '白羊',
    glyph: '♈',
    color: Color(0xffe5c052),
    icon: Icons.wb_sunny_outlined,
  ),
  (
    label: '上升星座',
    prefix: '上升',
    sign: '狮子',
    glyph: '♌',
    color: Color(0xff54cf85),
    icon: Icons.wb_twilight_outlined,
  ),
  (
    label: '月亮星座',
    prefix: '月亮',
    sign: '处女',
    glyph: '♍',
    color: Color(0xff7793ef),
    icon: Icons.dark_mode_outlined,
  ),
  (
    label: '金星',
    prefix: '金星',
    sign: '双鱼',
    glyph: '♓',
    color: Color(0xffcbd5e1),
    icon: Icons.favorite_border_rounded,
  ),
  (
    label: '火星',
    prefix: '火星',
    sign: '双子',
    glyph: '♊',
    color: Color(0xffe36b5b),
    icon: Icons.local_fire_department_outlined,
  ),
  (
    label: '水星',
    prefix: '水星',
    sign: '双鱼',
    glyph: '♓',
    color: Color(0xff4bc7d8),
    icon: Icons.forum_outlined,
  ),
  (
    label: '北交',
    prefix: '北交',
    sign: '白羊',
    glyph: '♈',
    color: Color(0xffa879e8),
    icon: Icons.hub_outlined,
  ),
  (
    label: '婚神',
    prefix: '婚神',
    sign: '巨蟹',
    glyph: '♋',
    color: Color(0xfff078a0),
    icon: Icons.auto_awesome_outlined,
  ),
  (
    label: '天顶',
    prefix: '天顶',
    sign: '金牛',
    glyph: '♉',
    color: Color(0xff7464e8),
    icon: Icons.terrain_outlined,
  ),
];

List<_Placement> _reportPlacements(PersonalReportData data) {
  if (data.example) return _samplePlacements;
  const names = [
    'Sun',
    'Ascendant',
    'Moon',
    'Venus',
    'Mars',
    'Mercury',
    'NorthNode',
    'Juno',
    'Midheaven',
  ];
  const glyphs = {
    '白羊': '♈',
    '金牛': '♉',
    '双子': '♊',
    '巨蟹': '♋',
    '狮子': '♌',
    '处女': '♍',
    '天秤': '♎',
    '天蝎': '♏',
    '射手': '♐',
    '摩羯': '♑',
    '水瓶': '♒',
    '双鱼': '♓',
  };
  return [
    for (final (index, item) in _samplePlacements.indexed)
      (
        label: item.label,
        prefix: item.prefix,
        sign: data.zodiacSigns[names[index]] ?? '',
        glyph: glyphs[data.zodiacSigns[names[index]]] ?? '–',
        color: item.color,
        icon: item.icon,
      ),
  ];
}

class _ZodiacSummary extends StatelessWidget {
  const _ZodiacSummary({required this.placements});

  final List<_Placement> placements;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _ReportLabel('星座', Icons.star_border_rounded),
        const SizedBox(height: 5),
        Row(
          children: [
            Expanded(
              flex: 44,
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 134),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: _ReportOrbit(placements: placements),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              flex: 56,
              child: Column(
                children: [
                  for (final (index, item) in placements.take(3).indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(
                        spacing: 4,
                        children: [
                          Expanded(
                            child: UiText(
                              item.label,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                          Text(
                            context.uiLabel(
                              item.sign.isEmpty ? '未提供' : '${item.sign}座',
                            ),
                            style: TextStyle(
                              fontSize: 12,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                          if (item.sign.isNotEmpty)
                            _ZodiacSymbol(
                              item.glyph,
                              size: 12,
                              color: colors.onSurfaceVariant,
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ZodiacExplorer extends StatefulWidget {
  const _ZodiacExplorer({
    required this.placements,
    required this.initialIndex,
    required this.onChanged,
    required this.availableHeight,
  });

  final List<_Placement> placements;
  final int initialIndex;
  final ValueChanged<int> onChanged;
  final double availableHeight;

  @override
  State<_ZodiacExplorer> createState() => _ZodiacExplorerState();
}

class _ZodiacExplorerState extends State<_ZodiacExplorer>
    with SingleTickerProviderStateMixin {
  static const _spring = SpringDescription(
    mass: 1,
    stiffness: 190,
    damping: 25,
  );
  late int _destination = widget.initialIndex;
  late int _selected = widget.initialIndex;
  late final _deck = AnimationController.unbounded(
    value: widget.initialIndex.toDouble(),
    vsync: this,
  );
  final _dragTime = Stopwatch();
  double _dragStart = 0;
  bool _reduced = false;

  List<_Placement> get _placements => widget.placements;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = MediaQuery.disableAnimationsOf(context);
    if (_reduced && _deck.isAnimating) _deck.value = _destination.toDouble();
  }

  @override
  void dispose() {
    _deck.dispose();
    super.dispose();
  }

  void _select(int page) {
    final index = page % _placements.length;
    if (index == _selected) return;
    setState(() => _selected = index);
    widget.onChanged(index);
  }

  void _settle(int page) {
    _destination = page;
    _select(page);
    if (_reduced) {
      _deck.value = page.toDouble();
    } else if (_deck.value != page || _deck.isAnimating) {
      _deck.animateWith(
        ScrollSpringSimulation(
          _spring,
          _deck.value,
          page.toDouble(),
          _deck.velocity,
          tolerance: const Tolerance(distance: .0005, velocity: .002),
        ),
      );
    }
  }

  void _pick(int index) {
    final count = _placements.length;
    final distance = (index - _destination) % count;
    _settle(
      _destination + (distance > count ~/ 2 ? distance - count : distance),
    );
  }

  void _startDrag(DragStartDetails _) {
    _dragStart = _deck.value;
    _deck.stop();
    _dragTime
      ..reset()
      ..start();
  }

  void _updateDrag(DragUpdateDetails details, double step) {
    _deck.value -= details.delta.dx / step;
    _select(_deck.value.round());
  }

  void _endDrag() {
    if (!_dragTime.isRunning) return;
    _dragTime.stop();
    final distance = _deck.value - _dragStart;
    final flick = distance.abs() > .18 && _dragTime.elapsedMilliseconds < 400;
    final page = flick
        ? _dragStart.round() + distance.sign.toInt()
        : _deck.value.round();
    _settle(page);
  }

  KeyEventResult _onKey(FocusNode _, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final key = event.logicalKey;
    if (key == LogicalKeyboardKey.arrowLeft) {
      _settle(_destination - 1);
    } else if (key == LogicalKeyboardKey.arrowRight) {
      _settle(_destination + 1);
    } else if (key == LogicalKeyboardKey.home) {
      _pick(0);
    } else if (key == LogicalKeyboardKey.end) {
      _pick(_placements.length - 1);
    } else {
      return KeyEventResult.ignored;
    }
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Focus(
      onKeyEvent: _onKey,
      child: LayoutBuilder(
        builder: (context, bounds) {
          final orbitWidth = math.min(250.0, bounds.maxWidth * .78);
          final cardWidth = math.min(250.0, bounds.maxWidth * .80);
          final cardHeight = math.max(280.0, cardWidth * 4 / 3);
          final hintHeight = MediaQuery.textScalerOf(context).scale(10) * 1.5;
          const deckGutter = 23.0;
          const controlsHeight = 44.0;
          final spaceForOrbit =
              widget.availableHeight -
              cardHeight -
              deckGutter -
              controlsHeight -
              hintHeight;
          final orbitSize = spaceForOrbit.clamp(orbitWidth * .52, orbitWidth);
          final size = Size(cardWidth, cardHeight);
          final step = size.width + 18;
          return Column(
            children: [
              SizedBox.square(
                key: const ValueKey('personal-report-zodiac-orbit'),
                dimension: orbitSize,
                child: _ReportOrbit(
                  placements: _placements,
                  selected: _selected,
                ),
              ),
              GestureDetector(
                key: const ValueKey('personal-report-zodiac-deck'),
                behavior: HitTestBehavior.opaque,
                dragStartBehavior: DragStartBehavior.down,
                onHorizontalDragStart: _startDrag,
                onHorizontalDragUpdate: (details) => _updateDrag(details, step),
                onHorizontalDragEnd: (_) => _endDrag(),
                onHorizontalDragCancel: _endDrag,
                child: SizedBox(
                  height: size.height + deckGutter,
                  width: bounds.maxWidth,
                  child: AnimatedBuilder(
                    animation: _deck,
                    builder: (context, _) {
                      final position = _deck.value;
                      final nearest = position.round();
                      final pages =
                          [
                            for (
                              var page = nearest - 2;
                              page <= nearest + 2;
                              page++
                            )
                              if ((page - position).abs() <= 1.7) page,
                          ]..sort(
                            (left, right) => (right - position).abs().compareTo(
                              (left - position).abs(),
                            ),
                          );
                      return ClipRect(
                        clipper: const _DeckHorizontalClip(),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            for (final page in pages)
                              _buildCard(
                                page: page,
                                distance: page - position,
                                left: (bounds.maxWidth - size.width) / 2,
                                size: size,
                                step: step,
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
              SizedBox(
                height: controlsHeight,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _DeckArrow(
                      back: true,
                      onPressed: () => _settle(_destination - 1),
                    ),
                    Flexible(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 174),
                        child: Row(
                          children: [
                            for (final (index, item) in _placements.indexed)
                              Expanded(
                                child: Tooltip(
                                  message: context.uiLabel(item.label),
                                  child: Semantics(
                                    button: true,
                                    selected: _selected == index,
                                    label: context.uiLabel(item.label),
                                    child: InkResponse(
                                      onTap: () => _pick(index),
                                      radius: 18,
                                      child: SizedBox.expand(
                                        child: Center(
                                          child: AnimatedContainer(
                                            duration: _reduced
                                                ? Duration.zero
                                                : const Duration(
                                                    milliseconds: 220,
                                                  ),
                                            width: _selected == index ? 15 : 4,
                                            height: 4,
                                            decoration: BoxDecoration(
                                              color: _selected == index
                                                  ? colors.onSurface
                                                  : colors.outline,
                                              borderRadius:
                                                  BorderRadius.circular(2),
                                            ),
                                          ),
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
                    _DeckArrow(
                      back: false,
                      onPressed: () => _settle(_destination + 1),
                    ),
                  ],
                ),
              ),
              UiText(
                '左右滑动切换卡片',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: colors.onSurfaceVariant),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCard({
    required int page,
    required double distance,
    required double left,
    required Size size,
    required double step,
  }) {
    final depth = distance.abs();
    final scale = math.max(.72, 1 - depth * .085);
    final transform = Matrix4.identity()
      ..setEntry(3, 2, -1 / 850)
      ..translateByDouble(distance * step, 0, -depth * 42, 1)
      ..rotateY(-distance * 11 * math.pi / 180)
      ..scaleByDouble(scale, scale, 1, 1);
    final index = page % _placements.length;
    return Positioned(
      key: ValueKey(page),
      top: 8,
      left: left,
      width: size.width,
      height: size.height,
      child: Opacity(
        opacity: math.max(0, 1 - depth * .53),
        child: Transform(
          alignment: Alignment.center,
          transform: transform,
          child: _ZodiacCard(
            placement: _placements[index],
            selected: _selected == index,
            onTap: () => _settle(page),
          ),
        ),
      ),
    );
  }
}

class _DeckHorizontalClip extends CustomClipper<Rect> {
  const _DeckHorizontalClip();

  @override
  Rect getClip(Size size) =>
      Rect.fromLTRB(0, -26, size.width, size.height + 40);

  @override
  bool shouldReclip(_DeckHorizontalClip oldClipper) => false;
}

class _DeckArrow extends StatelessWidget {
  const _DeckArrow({required this.back, required this.onPressed});

  final bool back;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: context.uiLabel(back ? '上一张星座卡' : '下一张星座卡'),
    onPressed: onPressed,
    iconSize: 17,
    icon: Icon(back ? Icons.chevron_left_rounded : Icons.chevron_right_rounded),
  );
}

class _ZodiacSymbol extends StatelessWidget {
  const _ZodiacSymbol(this.symbol, {required this.size, required this.color});

  final String symbol;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Text(
      symbol,
      style: TextStyle(
        fontFamily: 'JovianChartSymbols',
        color: color,
        fontSize: size,
        height: 1.12,
      ),
    ),
  );
}
