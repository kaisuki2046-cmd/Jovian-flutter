import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../features/account/account.dart';
import 'app_shell.dart';

class JovianLocation {
  const JovianLocation(
    this.tab, {
    this.fortunePath,
    this.archiveId,
    this.legacyFortuneLink = false,
    this.welcome = false,
    this.sections = const [],
  });

  final JovianTab tab;
  final String? fortunePath;
  final String? archiveId;
  final bool legacyFortuneLink;
  final bool welcome;
  final List<AccountDestination> sections;

  @override
  bool operator ==(Object other) =>
      other is JovianLocation &&
      tab == other.tab &&
      fortunePath == other.fortunePath &&
      archiveId == other.archiveId &&
      legacyFortuneLink == other.legacyFortuneLink &&
      welcome == other.welcome &&
      listEquals(sections, other.sections);

  @override
  int get hashCode => Object.hash(
    tab,
    fortunePath,
    archiveId,
    legacyFortuneLink,
    welcome,
    Object.hashAll(sections),
  );
}

const _fortunePaths = {'/fortune', '/modules/fortune'};
const _tabAliases = {
  '/destiny': JovianTab.destiny,
  '/modules/destiny': JovianTab.destiny,
  '/modules/divination': JovianTab.divination,
  '/modules/social': JovianTab.messages,
  '/modules/account': JovianTab.account,
  '/account/new-followers': JovianTab.account,
};
final _archiveId = RegExp(r'^[a-f0-9]{64}$');
final _profileId = RegExp(r'^[A-Za-z0-9_-]{1,128}$');
final _sections = {
  for (final section in AccountSection.values) section.slug: section,
};

String _routePath(Uri uri) {
  final path = uri.path;
  return path.length > 1 && path.endsWith('/')
      ? path.substring(0, path.length - 1)
      : path;
}

String? _readFortuneArchive(RouteInformation information) {
  final requested = information.uri.queryParametersAll['snapshotId'];
  if (requested != null) {
    final id = requested.singleOrNull;
    // Keep invalid explicit selections in the existing missing-chart state.
    return id != null && _archiveId.hasMatch(id) ? id : '';
  }
  final state = information.state;
  return state is String && (state.isEmpty || _archiveId.hasMatch(state))
      ? state
      : null;
}

AccountSection? _accountSection(String path) => path.startsWith('/account/')
    ? _sections[path.substring('/account/'.length)]
    : null;

JovianTab _sectionTab(AccountSection section) => switch (section) {
  AccountSection.findUser ||
  AccountSection.socialReports ||
  AccountSection.socialModeration => JovianTab.messages,
  _ => JovianTab.account,
};

List<AccountDestination> _defaultTrail(AccountSection section) {
  final parent = switch (section) {
    AccountSection.phone ||
    AccountSection.password ||
    AccountSection.identity ||
    AccountSection.deletion => AccountSection.security,
    AccountSection.security ||
    AccountSection.privacy ||
    AccountSection.agreements ||
    AccountSection.appearance ||
    AccountSection.language ||
    AccountSection.about => AccountSection.settings,
    AccountSection.aiPermissions ||
    AccountSection.privacyRights ||
    AccountSection.profilePreview ||
    AccountSection.socialPrivacy => AccountSection.privacy,
    _ => null,
  };
  return parent == null
      ? const []
      : [..._defaultTrail(parent), accountDestination(parent)];
}

RouteInformation initialJovianRoute(JovianTab fallback) {
  final platformRoute = Uri.tryParse(
    WidgetsBinding.instance.platformDispatcher.defaultRouteName,
  );
  if (platformRoute != null && platformRoute.path != '/') {
    return RouteInformation(uri: platformRoute);
  }
  if (kIsWeb && Uri.base.fragment.isEmpty) {
    final base = Uri.base;
    final path = _routePath(base);
    if (path != '/' &&
        (_fortunePaths.contains(path) ||
            path == '/welcome' ||
            _tabAliases.containsKey(path) ||
            path.startsWith('/account/') ||
            JovianTab.values.any((tab) => tab.path == path))) {
      return RouteInformation(
        uri: Uri(
          path: path,
          queryParameters: base.hasQuery ? base.queryParametersAll : null,
        ),
      );
    }
  }
  return RouteInformation(uri: Uri(path: fallback.path));
}

class JovianRouteParser extends RouteInformationParser<JovianLocation> {
  const JovianRouteParser();

  @override
  Future<JovianLocation> parseRouteInformation(RouteInformation information) =>
      SynchronousFuture(_read(information));

  JovianLocation _read(RouteInformation information) {
    final path = _routePath(information.uri);
    final state = information.state;
    if (_fortunePaths.contains(path)) {
      return JovianLocation(
        JovianTab.destiny,
        fortunePath: path,
        archiveId: _readFortuneArchive(information),
        legacyFortuneLink: information.uri.queryParameters.containsKey(
          'snapshotId',
        ),
      );
    }
    if (path == '/welcome')
      return const JovianLocation(JovianTab.destiny, welcome: true);
    final section = _accountSection(path);
    if (section == AccountSection.socialProfile) {
      final query = information.uri.queryParameters;
      final from = switch (_sections[query['from']]) {
        AccountSection.followers => AccountSection.followers,
        AccountSection.following => AccountSection.following,
        _ => AccountSection.findUser,
      };
      final id = query['id'];
      return JovianLocation(
        _sectionTab(from),
        sections: [
          accountDestination(from),
          if (id != null && _profileId.hasMatch(id))
            accountDestination(section!, profileId: id),
        ],
      );
    }
    if (section != null) {
      final tab = _sectionTab(section);
      final trail =
          _restoreTrail(state, section, tab) ?? _defaultTrail(section);
      return JovianLocation(
        tab,
        sections: [...trail, accountDestination(section)],
      );
    }
    if (path.startsWith('/account/'))
      return const JovianLocation(JovianTab.account);
    return JovianLocation(
      _tabAliases[path] ??
          JovianTab.values.where((tab) => tab.path == path).firstOrNull ??
          JovianTab.destiny,
    );
  }

  List<AccountDestination>? _restoreTrail(
    Object? state,
    AccountSection current,
    JovianTab tab,
  ) {
    if (state is! List || state.length > 4) return null;
    final sections = <AccountDestination>[];
    for (final slug in state) {
      final section = _sections[slug];
      if (section == null ||
          section == current ||
          section == AccountSection.socialProfile ||
          _sectionTab(section) != tab) {
        return null;
      }
      final destination = accountDestination(section);
      if (sections.contains(destination)) return null;
      sections.add(destination);
    }
    return sections;
  }

  @override
  RouteInformation restoreRouteInformation(JovianLocation configuration) {
    final sections = configuration.sections;
    if (sections.isNotEmpty) {
      final target = sections.last;
      final id = target.profileId;
      return RouteInformation(
        uri: Uri(
          path: '/account/${target.section.slug}',
          queryParameters: id == null
              ? null
              : {
                  'id': id,
                  'from': sections.length == 1
                      ? 'find-user'
                      : sections[sections.length - 2].section.slug,
                },
        ),
        state: [
          for (final parent in sections.take(sections.length - 1))
            parent.section.slug,
        ],
      );
    }
    return RouteInformation(
      uri: Uri(
        path:
            configuration.fortunePath ??
            (configuration.welcome ? '/welcome' : configuration.tab.path),
        queryParameters: configuration.legacyFortuneLink
            ? {'snapshotId': configuration.archiveId}
            : null,
      ),
      state: configuration.archiveId,
    );
  }
}

class JovianRouter extends RouterDelegate<JovianLocation>
    with ChangeNotifier, PopNavigatorRouterDelegateMixin<JovianLocation> {
  JovianRouter({required this.shell, required this.fortune});

  final Widget Function(JovianLocation) shell;
  final Widget Function(String?) fortune;

  static const _fortuneKey = ValueKey('jovian-fortune');

  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  JovianLocation _location = const JovianLocation(JovianTab.destiny);
  JovianLocation? _welcomeOrigin;
  final _sectionsByTab = <JovianTab, List<AccountDestination>>{};
  final _pendingSections = <(JovianTab, AccountDestination), Completer<void>>{};

  @override
  JovianLocation get currentConfiguration => _location;

  List<AccountDestination> sectionsFor(JovianTab tab) =>
      _sectionsByTab[tab] ?? const [];

  void selectTab(JovianTab tab) =>
      _navigate(JovianLocation(tab, sections: sectionsFor(tab)));

  void openFortune(String? archiveId) => _navigate(
    JovianLocation(
      JovianTab.destiny,
      fortunePath: '/fortune',
      archiveId: archiveId,
    ),
  );

  void closeWelcome() {
    if (!_location.welcome) return;
    _navigate(_welcomeOrigin ?? const JovianLocation(JovianTab.destiny));
  }

  void openWelcome() {
    if (_location.welcome) return;
    _welcomeOrigin = _location;
    _navigate(const JovianLocation(JovianTab.destiny, welcome: true));
  }

  Future<void> openAccountSection(AccountDestination section) {
    final tab = section.section == AccountSection.socialProfile
        ? _location.tab
        : _sectionTab(section.section);
    final sections = sectionsFor(tab);
    final previous = sections.indexOf(section);
    final completion = _pendingSections.putIfAbsent((
      tab,
      section,
    ), Completer<void>.new);
    _navigate(
      JovianLocation(
        tab,
        sections: previous < 0
            ? [...sections, section]
            : sections.sublist(0, previous + 1),
      ),
    );
    return completion.future;
  }

  void accountSectionPopped(JovianTab tab, AccountDestination section) {
    final sections = sectionsFor(tab);
    if (_location.tab == tab && sections.lastOrNull == section) {
      _navigate(
        JovianLocation(tab, sections: sections.sublist(0, sections.length - 1)),
      );
    }
  }

  void _storeLocation(JovianLocation next) {
    if (!next.welcome) _welcomeOrigin = null;
    final tab = next.tab;
    _location = next;
    _sectionsByTab[tab] = next.sections;
    final removed = [
      for (final key in _pendingSections.keys)
        if (key.$1 == tab && !next.sections.contains(key.$2)) key,
    ];
    for (final key in removed) {
      _pendingSections.remove(key)!.complete();
    }
  }

  void _navigate(JovianLocation next) {
    if (_location == next) return;
    _storeLocation(next);
    notifyListeners();
  }

  @override
  Future<void> setNewRoutePath(JovianLocation configuration) {
    if (_location != configuration) {
      navigatorKey.currentState?.popUntil((route) => route.settings is Page);
      _storeLocation(configuration);
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
  void dispose() {
    for (final section in _pendingSections.values) {
      section.complete();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Navigator(
    key: navigatorKey,
    pages: [
      MaterialPage<void>(
        key: const ValueKey('jovian-home'),
        name: _location.tab.path,
        child: shell(_location),
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
