import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import 'app_shell.dart';

typedef JovianLocation = ({
  JovianTab tab,
  String? fortunePath,
  String? archiveId,
});

const _fortunePaths = {'/fortune', '/modules/fortune'};
final _archiveId = RegExp(r'^[a-f0-9]{64}$');

JovianLocation _tabLocation(JovianTab tab) =>
    (tab: tab, fortunePath: null, archiveId: null);

String _routePath(Uri uri) {
  final path = uri.path;
  return path.length > 1 && path.endsWith('/')
      ? path.substring(0, path.length - 1)
      : path;
}

RouteInformation initialJovianRoute(JovianTab fallback) {
  final platformRoute = Uri.tryParse(
    WidgetsBinding.instance.platformDispatcher.defaultRouteName,
  );
  if (platformRoute != null && platformRoute.path != '/') {
    return RouteInformation(uri: platformRoute);
  }
  if (kIsWeb && Uri.base.fragment.isEmpty) {
    final path = _routePath(Uri.base);
    if (path != '/' &&
        (_fortunePaths.contains(path) ||
            path == '/destiny' ||
            JovianTab.values.any((tab) => tab.path == path))) {
      return RouteInformation(uri: Uri(path: path));
    }
  }
  return RouteInformation(uri: Uri(path: fallback.path));
}

class JovianRouteParser extends RouteInformationParser<JovianLocation> {
  const JovianRouteParser();

  @override
  Future<JovianLocation> parseRouteInformation(RouteInformation information) {
    final path = _routePath(information.uri);
    final state = information.state;
    return SynchronousFuture(
      _fortunePaths.contains(path)
          ? (
              tab: JovianTab.destiny,
              fortunePath: path,
              archiveId: state is String && _archiveId.hasMatch(state)
                  ? state
                  : null,
            )
          : _tabLocation(
              JovianTab.values.where((tab) => tab.path == path).firstOrNull ??
                  JovianTab.destiny,
            ),
    );
  }

  @override
  RouteInformation restoreRouteInformation(JovianLocation configuration) =>
      RouteInformation(
        uri: Uri(path: configuration.fortunePath ?? configuration.tab.path),
        state: configuration.archiveId,
      );
}

class JovianRouter extends RouterDelegate<JovianLocation>
    with ChangeNotifier, PopNavigatorRouterDelegateMixin<JovianLocation> {
  JovianRouter({required this.shell, required this.fortune});

  final Widget Function(JovianTab) shell;
  final Widget Function(String?) fortune;

  static const _fortuneKey = ValueKey('jovian-fortune');

  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  JovianLocation _location = _tabLocation(JovianTab.destiny);

  @override
  JovianLocation get currentConfiguration => _location;

  void selectTab(JovianTab tab) => _navigate(_tabLocation(tab));

  void openFortune(String? archiveId) => _navigate((
    tab: JovianTab.destiny,
    fortunePath: '/fortune',
    archiveId: archiveId,
  ));

  void _navigate(JovianLocation next) {
    if (_location == next) return;
    _location = next;
    notifyListeners();
  }

  @override
  Future<void> setNewRoutePath(JovianLocation configuration) {
    if (_location != configuration) {
      navigatorKey.currentState?.popUntil((route) => route.settings is Page);
      _location = configuration;
    }
    return SynchronousFuture(null);
  }

  @override
  Future<bool> popRoute() async {
    if (await super.popRoute()) return true;
    if (_location.tab == JovianTab.destiny) return false;
    selectTab(JovianTab.destiny);
    return true;
  }

  @override
  Widget build(BuildContext context) => Navigator(
    key: navigatorKey,
    pages: [
      MaterialPage<void>(
        key: const ValueKey('jovian-home'),
        name: _location.tab.path,
        child: shell(_location.tab),
      ),
      if (_location.fortunePath case final path?)
        MaterialPage<void>(
          key: _fortuneKey,
          name: path,
          child: fortune(_location.archiveId),
        ),
    ],
    onDidRemovePage: (page) {
      if (page.key == _fortuneKey && _location.fortunePath != null) {
        Router.neglect(context, () => selectTab(JovianTab.destiny));
      }
    },
  );
}
