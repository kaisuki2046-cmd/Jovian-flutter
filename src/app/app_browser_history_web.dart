import 'dart:ui_web' as ui_web;

Object? _flutterEntry() => ui_web.urlStrategy?.getState();

Object? currentBrowserRouteState() {
  final entry = _flutterEntry();
  final state = entry is Map && entry['serialCount'] is num
      ? entry['state']
      : entry;
  return state is Map && state['jovianEntry'] is num
      ? state['routeState']
      : state;
}

int? currentBrowserEntry() {
  final entry = _flutterEntry();
  if (entry is! Map || entry['serialCount'] is! num) return null;
  final state = entry['state'];
  final appEntry = state is Map ? state['jovianEntry'] : null;
  if (appEntry is num) return appEntry.toInt();
  // Entries from a prior version of the app only have Flutter's position.
  return (entry['serialCount'] as num).toInt();
}

Future<void> moveBrowserHistory(int offset) async {
  await ui_web.urlStrategy?.go(offset);
}
