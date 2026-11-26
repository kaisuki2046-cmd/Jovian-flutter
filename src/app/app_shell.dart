import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../ui/theme.dart';

enum JovianTab {
  destiny('命理', Icons.auto_awesome_outlined, Icons.auto_awesome),
  synastry('合盘', Icons.favorite_border, Icons.favorite),
  divination('算事', Icons.explore_outlined, Icons.explore),
  messages('消息', Icons.chat_bubble_outline, Icons.chat_bubble),
  account('个人中心', Icons.person_outline, Icons.person);

  const JovianTab(this.label, this.icon, this.activeIcon);

  final String label;
  final IconData icon;
  final IconData activeIcon;
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

  void _select(JovianTab next) {
    if (next == _active) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _active = next;
      _visited.add(next);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final keyboardVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
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
                      child: widget.buildPage(
                        context,
                        tab,
                        tab == _active,
                        _select,
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: keyboardVisible
          ? null
          : DecoratedBox(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: colors.outlineVariant)),
              ),
              child: NavigationBar(
                height: 65,
                selectedIndex: _active.index,
                onDestinationSelected: (index) =>
                    _select(JovianTab.values[index]),
                destinations: [
                  for (final tab in JovianTab.values)
                    NavigationDestination(
                      key: ValueKey(tab),
                      label: tab.label,
                      tooltip: tab.label,
                      icon: Icon(tab.icon),
                      selectedIcon: Icon(tab.activeIcon),
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

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final theme = Theme.of(context);
      final width = math.min(jovianPageWidth, constraints.maxWidth);
      final size = Size(width, constraints.maxHeight);
      return ColoredBox(
        color: theme.colorScheme.surfaceContainerHighest,
        child: Center(
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
        ),
      );
    },
  );
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
