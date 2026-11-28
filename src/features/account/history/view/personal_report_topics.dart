part of 'personal_report_page.dart';

typedef _ReportChapterTarget = ({_ReportTopic topic, String title});

const _topicDragThreshold = 7.0;

class _ReportTopicPages extends StatefulWidget {
  const _ReportTopicPages({
    required this.selected,
    required this.position,
    required this.scrollPastStrip,
    required this.onMove,
    required this.onChoose,
    required this.padding,
    required this.minimumHeight,
    required this.data,
    required this.onOpen,
  });

  final _ReportTopic selected;
  final Animation<double> position;
  final double Function() scrollPastStrip;
  final ValueChanged<double> onMove;
  final ValueChanged<_ReportTopic> onChoose;
  final EdgeInsets padding;
  final double minimumHeight;
  final PersonalReportData data;
  final ValueChanged<_ReportChapterTarget> onOpen;

  @override
  State<_ReportTopicPages> createState() => _ReportTopicPagesState();
}

class _ReportTopicPagesState extends State<_ReportTopicPages> {
  double _startX = 0;
  double _distance = 0;
  double? _startPosition;

  void _track(double x, double width) {
    _distance = x - _startX;
    if (_startPosition == null && _distance.abs() < _topicDragThreshold) {
      return;
    }
    final start = _startPosition ??= widget.position.value;
    widget.onMove(start - _distance / width);
  }

  void _settle(DragEndDetails details) {
    final start = _startPosition;
    if (start == null) return;
    _startPosition = null;
    final from = start.round();
    final velocity = details.primaryVelocity ?? 0;
    var to = widget.position.value.round();
    if (to == from && (_distance.abs() >= 26 || velocity.abs() >= 240)) {
      to -= (_distance.abs() >= 26 ? _distance : velocity).sign.toInt();
    }
    widget.onChoose(
      _ReportTopic.values[to.clamp(0, _ReportTopic.values.length - 1)],
    );
  }

  void _cancel() {
    if (_startPosition == null) return;
    _startPosition = null;
    widget.onChoose(widget.selected);
  }

  @override
  Widget build(BuildContext context) {
    final reports = [
      for (final topic in _ReportTopic.values)
        Padding(
          key: ValueKey(topic),
          padding: widget.padding,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: widget.minimumHeight),
            child: _TopicReport(
              data: widget.data,
              topic: topic,
              onOpen: widget.onOpen,
            ),
          ),
        ),
    ];
    return LayoutBuilder(
      builder: (context, bounds) => GestureDetector(
        key: const ValueKey('personal-report-topic-content'),
        behavior: HitTestBehavior.translucent,
        dragStartBehavior: DragStartBehavior.down,
        onHorizontalDragStart: (details) => _startX = details.localPosition.dx,
        onHorizontalDragUpdate: (details) =>
            _track(details.localPosition.dx, bounds.maxWidth),
        onHorizontalDragEnd: _settle,
        onHorizontalDragCancel: _cancel,
        child: ClipRect(
          child: AnimatedBuilder(
            animation: widget.position,
            builder: (context, _) {
              final position = widget.position.value;
              final current = widget.selected.index;
              final moving = position != current;
              final previews = {position.floor(), position.ceil()}
                ..remove(current);
              // The current page keeps its scroll height until the transition settles.
              final top = previews.isEmpty ? 0.0 : widget.scrollPastStrip();
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Transform.translate(
                    offset: Offset((current - position) * bounds.maxWidth, 0),
                    child: IgnorePointer(
                      ignoring: moving,
                      child: ExcludeSemantics(
                        excluding: moving,
                        child: ExcludeFocus(
                          excluding: moving,
                          child: reports[current],
                        ),
                      ),
                    ),
                  ),
                  for (final index in previews)
                    Positioned(
                      key: ValueKey(('preview', index)),
                      width: bounds.maxWidth,
                      left: (index - position) * bounds.maxWidth,
                      top: top,
                      child: IgnorePointer(
                        child: ExcludeSemantics(
                          child: ExcludeFocus(child: reports[index]),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ReportTopicStrip extends StatefulWidget {
  const _ReportTopicStrip({
    required this.height,
    required this.selected,
    required this.position,
    required this.onMove,
    required this.onChoose,
    required this.onStep,
  });

  static double heightOf(BuildContext context) =>
      math.max(48.0, MediaQuery.textScalerOf(context).scale(12) + 32) + 7;

  final double height;
  final _ReportTopic selected;
  final Animation<double> position;
  final ValueChanged<double> onMove;
  final ValueChanged<_ReportTopic> onChoose;
  final ValueChanged<int> onStep;

  @override
  State<_ReportTopicStrip> createState() => _ReportTopicStripState();
}

class _ReportTopicStripState extends State<_ReportTopicStrip> {
  static const _topics = _ReportTopic.values;
  final _focus = FocusNode();
  double _startX = 0;
  bool _dragging = false;

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  void _track(double x, double slotWidth) {
    if (!_dragging) {
      if ((x - _startX).abs() < _topicDragThreshold) return;
      _focus.requestFocus();
      setState(() => _dragging = true);
    }
    widget.onMove(x / slotWidth - .5);
  }

  void _finish({required bool commit}) {
    if (!_dragging) return;
    setState(() => _dragging = false);
    widget.onChoose(
      commit ? _topics[widget.position.value.round()] : widget.selected,
    );
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent || _dragging) return KeyEventResult.ignored;
    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowLeft:
        widget.onStep(-1);
      case LogicalKeyboardKey.arrowRight:
        widget.onStep(1);
      case LogicalKeyboardKey.home:
        widget.onChoose(_topics.first);
      case LogicalKeyboardKey.end:
        widget.onChoose(_topics.last);
      default:
        return KeyEventResult.ignored;
    }
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final focusOutline =
        _focus.hasFocus &&
        FocusManager.instance.highlightMode == FocusHighlightMode.traditional;
    return Focus(
      focusNode: _focus,
      onFocusChange: (_) => setState(() {}),
      onKeyEvent: _handleKey,
      child: Semantics(
        container: true,
        label: context.uiLabel('报告主题'),
        hint: context.uiLabel('点按或拖动切换主题'),
        child: SizedBox(
          key: const ValueKey('personal-report-topic-strip'),
          height: widget.height,
          child: _ReportGlass(
            radius: 24,
            padding: const EdgeInsets.all(3.5),
            child: LayoutBuilder(
              builder: (context, bounds) {
                final slotWidth = bounds.maxWidth / _topics.length;
                return MouseRegion(
                  cursor: _dragging
                      ? SystemMouseCursors.grabbing
                      : SystemMouseCursors.grab,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    excludeFromSemantics: true,
                    dragStartBehavior: DragStartBehavior.down,
                    onHorizontalDragStart: (details) =>
                        _startX = details.localPosition.dx,
                    onHorizontalDragUpdate: (details) =>
                        _track(details.localPosition.dx, slotWidth),
                    onHorizontalDragEnd: (_) => _finish(commit: true),
                    onHorizontalDragCancel: () => _finish(commit: false),
                    child: CustomPaint(
                      foregroundPainter: _TopicTrackInk(
                        colors.onSurface.withValues(alpha: .21),
                      ),
                      child: AnimatedBuilder(
                        animation: widget.position,
                        builder: (context, _) {
                          final position = widget.position.value;
                          final highlighted = _topics[position.round()];
                          final tone = Color.lerp(
                            _topics[position.floor()].tone,
                            _topics[position.ceil()].tone,
                            position - position.floor(),
                          )!;
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              Align(
                                alignment: Alignment(
                                  2 * position / (_topics.length - 1) - 1,
                                  0,
                                ),
                                child: FractionallySizedBox(
                                  widthFactor: 1 / _topics.length,
                                  heightFactor: 1,
                                  child: DecoratedBox(
                                    key: const ValueKey(
                                      'personal-report-topic-thumb',
                                    ),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(20),
                                      color: tone.withValues(
                                        alpha: _dragging ? .30 : .20,
                                      ),
                                      border: Border.all(
                                        color: tone.withValues(
                                          alpha: focusOutline ? .63 : .29,
                                        ),
                                      ),
                                      boxShadow: _dragging
                                          ? [
                                              BoxShadow(
                                                color: tone.withValues(
                                                  alpha: .28,
                                                ),
                                                blurRadius: 7,
                                                offset: const Offset(0, 2),
                                              ),
                                            ]
                                          : null,
                                    ),
                                  ),
                                ),
                              ),
                              Row(
                                children: [
                                  for (final topic in _topics)
                                    Expanded(
                                      child: Semantics(
                                        selected: widget.selected == topic,
                                        button: true,
                                        child: InkWell(
                                          borderRadius: BorderRadius.circular(
                                            18,
                                          ),
                                          onTap: () {
                                            if (!_focus.hasFocus) {
                                              _focus.requestFocus();
                                            }
                                            widget.onChoose(topic);
                                          },
                                          child: Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            spacing: 3,
                                            children: [
                                              Icon(
                                                topic.icon,
                                                size: 17,
                                                color: topic == highlighted
                                                    ? colors.onSurface
                                                    : colors.onSurfaceVariant,
                                              ),
                                              Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 3,
                                                    ),
                                                child: FittedBox(
                                                  fit: BoxFit.scaleDown,
                                                  child: UiText(
                                                    topic.label,
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          topic == highlighted
                                                          ? FontWeight.w700
                                                          : FontWeight.w500,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _TopicTrackInk extends CustomPainter {
  const _TopicTrackInk(this.ink);

  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final track = Path()
      ..moveTo(22, 2)
      ..cubicTo(w * .28, .7, w * .65, 1.7, w - 25, 2)
      ..quadraticBezierTo(w - 1, 1, w - 1, h / 2)
      ..quadraticBezierTo(w - 1.5, h - 2, w - 25, h - 2)
      ..cubicTo(w * .67, h - 1, w * .22, h - 1.5, 21, h - 2)
      ..quadraticBezierTo(2, h - 1.7, 1, h / 2)
      ..quadraticBezierTo(.9, 3, 22, 2);
    _inkStroke(canvas, track, ink, width: .85);
  }

  @override
  bool shouldRepaint(_TopicTrackInk oldDelegate) => ink != oldDelegate.ink;
}

class _TopicReport extends StatelessWidget {
  const _TopicReport({
    required this.data,
    required this.topic,
    required this.onOpen,
  });

  final PersonalReportData data;
  final _ReportTopic topic;
  final ValueChanged<_ReportChapterTarget> onOpen;

  @override
  Widget build(BuildContext context) {
    final chapters = _ReportChapters(data, topic).build(context);
    return Column(
      key: ValueKey(topic),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        if (chapters.isEmpty)
          const _InsightPanel(
            '命盘资料不足',
            Icons.notes_rounded,
            child: _NoTopicData(),
          ),
        for (final chapter in chapters)
          _InsightPanel(
            chapter.title,
            chapter.icon,
            tone: topic.tone,
            centerTitle: chapter.centerTitle,
            onOpen: () => onOpen((topic: topic, title: chapter.title)),
            child: chapter.cover,
          ),
      ],
    );
  }
}

class _ReportChapterReader extends StatelessWidget {
  const _ReportChapterReader({required this.data, required this.target});

  final PersonalReportData data;
  final _ReportChapterTarget target;

  @override
  Widget build(BuildContext context) {
    final chapter = _ReportChapters(
      data,
      target.topic,
    ).build(context).where((item) => item.title == target.title).firstOrNull;
    final colors = Theme.of(context).colorScheme;
    return Column(
      key: const ValueKey('personal-report-chapter-reader'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(2, 8, 2, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 6,
            children: [
              _ReportLabel(target.topic.label, target.topic.icon),
              Semantics(
                header: true,
                child: UiText(
                  target.title,
                  style: Theme.of(
                    context,
                  ).textTheme.headlineSmall?.copyWith(color: colors.onSurface),
                ),
              ),
            ],
          ),
        ),
        _ReportGlass(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 19),
          child: chapter?.reading ?? const _NoTopicData(),
        ),
      ],
    );
  }
}

class _NoTopicData extends StatelessWidget {
  const _NoTopicData();

  @override
  Widget build(BuildContext context) => const _InsightText((
    '已有资料不足以确定十神分布，这个主题暂时无法解读。',
    'The available chart does not establish a stable Ten Gods distribution for this topic.',
  ));
}
