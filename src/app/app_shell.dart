import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import '../ui/tab_dock.dart';
import '../ui/tab_glyph.dart';

enum JovianTab {
  destiny('命理', TabGlyphShape.chart),
  synastry('合盘', TabGlyphShape.match),
  divination('算事', TabGlyphShape.oracle),
  messages('消息', TabGlyphShape.message),
  account('个人中心', TabGlyphShape.profile);

  const JovianTab(this.label, this.glyph);

  final String label;
  final TabGlyphShape glyph;
}

class JovianShell extends StatefulWidget {
  const JovianShell({
    super.key,
    required this.initialTab,
    required this.buildPage,
  });

  final JovianTab initialTab;
  final Widget Function(
    BuildContext context,
    JovianTab tab,
    bool active,
    ValueChanged<JovianTab> selectTab,
  )
  buildPage;

  @override
  State<JovianShell> createState() => _JovianShellState();
}

class _JovianShellState extends State<JovianShell> {
  late JovianTab _active = widget.initialTab;
  late final Set<JovianTab> _visited = {_active};
  final _dockCollapse = ValueNotifier(0.0);
  double _nextCollapse = 0;
  double _scrollDelta = 0;
  int? _dockFrame;

  void _select(JovianTab next) {
    if (next == _active) return;
    FocusScope.of(context).unfocus();
    _scrollDelta = 0;
    _queueDockCollapse(0);
    setState(() {
      _active = next;
      _visited.add(next);
    });
  }

  bool _trackDockScroll(ScrollUpdateNotification notification) {
    final metrics = notification.metrics;
    final source = notification.context;
    if (notification.depth != 0 ||
        metrics.axis != Axis.vertical ||
        (source != null && Scaffold.maybeOf(source)?.isDrawerOpen == true) ||
        metrics.viewportDimension < MediaQuery.sizeOf(context).height * .35 ||
        metrics.maxScrollExtent - metrics.minScrollExtent < 2)
      return false;
    if (metrics.pixels <= metrics.minScrollExtent + 2) {
      _scrollDelta = 0;
      _queueDockCollapse(0);
    } else if (!metrics.outOfRange) {
      _scrollDelta += notification.scrollDelta ?? 0;
      if (_scrollDelta.abs() >= 2) {
        _queueDockCollapse((_nextCollapse + _scrollDelta / 66).clamp(0.0, 1.0));
        _scrollDelta = 0;
      }
    }
    return false;
  }

  void _queueDockCollapse(double value) {
    if (_nextCollapse == value) return;
    _nextCollapse = value;
    _dockFrame ??= SchedulerBinding.instance.scheduleFrameCallback((_) {
      _dockFrame = null;
      _dockCollapse.value = _nextCollapse;
    });
  }

  @override
  void dispose() {
    if (_dockFrame case final frame?)
      SchedulerBinding.instance.cancelFrameCallbackWithId(frame);
    _dockCollapse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final keyboardVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
      extendBody: !keyboardVisible,
      resizeToAvoidBottomInset: false,
      body: IndexedStack(
        index: _active.index,
        children: [
          for (final tab in JovianTab.values)
            _visited.contains(tab)
                ? TickerMode(
                    enabled: tab == _active,
                    child: ExcludeFocus(
                      excluding: tab != _active,
                      child: NotificationListener<ScrollUpdateNotification>(
                        onNotification: (event) =>
                            tab == _active && _trackDockScroll(event),
                        child: widget.buildPage(
                          context,
                          tab,
                          tab == _active,
                          _select,
                        ),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: keyboardVisible
          ? null
          : ValueListenableBuilder(
              valueListenable: _dockCollapse,
              builder: (context, collapse, _) => JovianTabDock(
                collapse: collapse,
                selected: _active.index,
                select: (index) => _select(JovianTab.values[index]),
                destinations: [
                  for (final tab in JovianTab.values)
                    NavigationDestination(
                      key: ValueKey(tab),
                      label: tab.label,
                      tooltip: tab.label,
                      icon: TabGlyph(tab.glyph),
                      selectedIcon: TabGlyph(tab.glyph, selected: true),
                    ),
                ],
              ),
            ),
    );
  }
}

class JovianViewport extends StatelessWidget {
  const JovianViewport({super.key, required this.child});

  final Widget child;

  static const _maxContentWidth = 720.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ColoredBox(
      color: theme.colorScheme.surfaceContainerHighest,
      child: SafeArea(
        top: false,
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = math.min(_maxContentWidth, constraints.maxWidth);
            final size = Size(width, constraints.maxHeight);
            return Center(
              child: SizedBox.fromSize(
                size: size,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: theme.scaffoldBackgroundColor,
                    boxShadow: constraints.maxWidth > width
                        ? const [
                            BoxShadow(color: Color(0x24190f20), blurRadius: 34),
                          ]
                        : null,
                  ),
                  child: MediaQuery(
                    data: MediaQuery.of(context).copyWith(size: size),
                    child: child,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class JovianTabNavigator extends StatefulWidget {
  const JovianTabNavigator({
    super.key,
    required this.active,
    required this.child,
  });

  final bool active;
  final Widget child;

  @override
  State<JovianTabNavigator> createState() => _JovianTabNavigatorState();
}

class _JovianTabNavigatorState extends State<JovianTabNavigator> {
  final _navigation = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) => NavigatorPopHandler<void>(
    enabled: widget.active,
    onPopWithResult: (_) => _navigation.currentState?.maybePop(),
    child: Navigator(
      key: _navigation,
      pages: [
        MaterialPage<void>(key: const ValueKey('root'), child: widget.child),
      ],
      onDidRemovePage: (_) {},
    ),
  );
}
