import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../bootstrap/account.dart';
import '../bootstrap/app_updates.dart';
import '../bootstrap/destiny.dart';
import '../bootstrap/divination.dart';
import '../bootstrap/fortune.dart';
import '../bootstrap/synastry.dart';
import '../features/account/account.dart';
import '../features/destiny/destiny.dart';
import '../features/divination/divination.dart';
import '../features/fortune/fortune.dart';
import '../features/social/social.dart';
import '../features/synastry/synastry.dart';
import '../ui/tab_glyph.dart';
import '../ui/theme.dart';
import 'app_navigation.dart';
import 'app_shell.dart';

export 'app_shell.dart' show JovianTab;

void main() {
  final account = configureAccount();
  runApp(
    JovianApp(
      onlineGuide: account == null ? configureOnlineGuide() : null,
      account: account,
      readFortuneTime: configureFortuneTime(),
      updates: configureAppUpdates(),
      persistTheme: true,
    ),
  );
}

class JovianApp extends StatefulWidget {
  const JovianApp({
    super.key,
    this.onlineGuide,
    this.account,
    this.readFortuneTime,
    this.updates,
    this.initialTab = JovianTab.destiny,
    this.themeMode = ThemeMode.system,
    this.persistTheme = false,
  });

  final OnlineGuideController? onlineGuide;
  final AccountController? account;
  final Future<DateTime> Function()? readFortuneTime;
  final AppUpdateController? updates;
  final JovianTab initialTab;
  final ThemeMode themeMode;
  final bool persistTheme;

  @override
  State<JovianApp> createState() => _JovianAppState();
}

class _JovianAppState extends State<JovianApp> {
  static const _appearanceKey = 'jovian.ui.theme.v1';
  static const _appearance = FlutterSecureStorage();
  late final _navigation = JovianRouter(
    shell: _shellPage,
    fortune: _fortunePage,
  );
  late final _routeInformation = PlatformRouteInformationProvider(
    initialRouteInformation: initialJovianRoute(widget.initialTab),
  );
  late final _router = RouterConfig<JovianLocation>(
    routeInformationProvider: _routeInformation,
    routeInformationParser: const JovianRouteParser(),
    routerDelegate: _navigation,
    backButtonDispatcher: RootBackButtonDispatcher(),
  );
  late ThemeMode _themeMode = widget.themeMode;
  bool _appearanceChanged = false;
  Future<void> _appearanceWrites = Future<void>.value();

  @override
  void initState() {
    super.initState();
    if (widget.persistTheme) unawaited(_readAppearance());
    _restoreAccount();
  }

  @override
  void didUpdateWidget(covariant JovianApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.account != widget.account) {
      oldWidget.account?.dispose();
      _restoreAccount();
    }
  }

  void _restoreAccount() {
    final account = widget.account;
    if (account == null || account.restored) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && identical(widget.account, account)) {
        unawaited(account.initialize());
      }
    });
  }

  @override
  void dispose() {
    _routeInformation.dispose();
    _navigation.dispose();
    widget.account?.dispose();
    super.dispose();
  }

  Future<void> _readAppearance() async {
    try {
      final stored = await _appearance
          .read(key: _appearanceKey)
          .onError((_, _) => null);
      final savedMode = ThemeMode.values
          .where((item) => item.name == stored)
          .firstOrNull;
      final legacy = savedMode == null ? readLegacyWebAppearance() : null;
      final mode =
          savedMode ??
          ThemeMode.values.where((item) => item.name == legacy).firstOrNull;
      if (mounted && !_appearanceChanged && mode != null) {
        setState(() => _themeMode = mode);
      }
    } catch (_) {
      // The system appearance still works when device storage is unavailable.
    }
  }

  Future<void> _changeAppearance(ThemeMode mode) async {
    _appearanceChanged = true;
    setState(() => _themeMode = mode);
    if (!widget.persistTheme) return;
    _appearanceWrites = _appearanceWrites.then((_) async {
      try {
        await _appearance.write(key: _appearanceKey, value: mode.name);
      } catch (_) {
        // Keep the selected appearance for this session.
      }
    });
    await _appearanceWrites;
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: '木星环',
    debugShowCheckedModeBanner: false,
    theme: jovianTheme(Brightness.light),
    darkTheme: jovianTheme(Brightness.dark),
    themeMode: _themeMode,
    routerConfig: _router,
    builder: (context, child) {
      final nav = switch (widget.account) {
        final account? => NicknameSetupGate(account: account, child: child!),
        null => child!,
      };
      final viewport = JovianViewport(child: nav);
      return switch (widget.updates) {
        final updates? => AppUpdateHost(
          key: ValueKey(updates),
          updates: updates,
          navigator: _navigation.navigatorKey,
          account: widget.account,
          child: viewport,
        ),
        null => viewport,
      };
    },
  );

  Widget _shellPage(JovianTab tab) => _accountEntry(
    _AppHome(
      key: ObjectKey(widget.account),
      account: widget.account,
      onlineGuide: widget.onlineGuide,
      tab: tab,
      onTabSelected: _navigation.selectTab,
      openFortune: _navigation.openFortune,
      themeMode: _themeMode,
      onThemeModeChanged: _changeAppearance,
    ),
  );

  Widget _accountEntry(Widget child) {
    final account = widget.account;
    if (account == null) return child;
    return ListenableBuilder(
      key: ObjectKey(account),
      listenable: account,
      child: child,
      builder: (context, admitted) {
        if (account.authorizedSession != null) return admitted!;
        if (!account.restored && account.notice == null) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(semanticsLabel: '正在检查登录状态'),
            ),
          );
        }
        return AccountPage(
          account: account,
          standalone: true,
          themeMode: _themeMode,
          onThemeModeChanged: _changeAppearance,
        );
      },
    );
  }

  Widget _fortunePage(String? archiveId) => _accountEntry(
    FortunePage(
      account: widget.account,
      loadDisplay: loadFortuneDisplay,
      readServerTime: widget.readFortuneTime,
      connectOnline: () => configureFortuneOnline(
        widget.readFortuneTime,
        readNativeSession: widget.account?.readNativeSession,
      ),
      archiveId: archiveId,
    ),
  );
}

class _AppHome extends StatefulWidget {
  const _AppHome({
    super.key,
    required this.account,
    required this.onlineGuide,
    required this.tab,
    required this.onTabSelected,
    required this.openFortune,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final AccountController? account;
  final OnlineGuideController? onlineGuide;
  final JovianTab tab;
  final ValueChanged<JovianTab> onTabSelected;
  final ValueChanged<String?> openFortune;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  @override
  State<_AppHome> createState() => _AppHomeState();
}

class _AppHomeState extends State<_AppHome> {
  String? _scope;
  OnlineGuideController? _guide;

  @override
  void initState() {
    super.initState();
    if (widget.account case final account?) {
      account.addListener(_updateGuideOwner);
      _updateGuideOwner();
    }
  }

  void _updateGuideOwner() {
    final account = widget.account!;
    final scope = account.sessionChanging
        ? null
        : account.authorizedSession?.scope;
    if (scope == _scope) return;
    _guide?.dispose();
    setState(() {
      _scope = scope;
      _guide = scope == null
          ? null
          : configureOnlineGuide(
              ownerScope: scope,
              readNativeSession: account.readNativeSession,
            );
    });
  }

  @override
  void dispose() {
    widget.account?.removeListener(_updateGuideOwner);
    _guide?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => JovianShell(
    initialTab: widget.tab,
    onTabSelected: widget.onTabSelected,
    buildPage: (context, tab, active, selectTab) => switch (tab) {
      JovianTab.destiny => DestinyPage(
        key: ValueKey(_scope),
        loadPlaces: loadBirthPlaces,
        calculate: calculateDestinyBaZi,
        calculateReading: legacyDestinyCalculation(),
        requestReport: configureDestinyReport(
          readNativeSession: widget.account?.readNativeSession,
        ),
        account: widget.account,
        active: active,
        openFortune: widget.openFortune,
      ),
      JovianTab.synastry => SynastryPage(
        key: ValueKey(_scope),
        loadPlaces: loadBirthPlaces,
        account: widget.account,
        calculate: configureSynastryChart(),
        compare: configureSynastryComparison(),
        summarize: configureSynastrySummary(
          readNativeSession: widget.account?.readNativeSession,
        ),
        openAccount: widget.account == null
            ? null
            : () => selectTab(JovianTab.account),
        openDestiny: () => selectTab(JovianTab.destiny),
      ),
      JovianTab.divination => DivinationPage(
        key: ValueKey(_scope),
        onlineGuide: widget.account == null ? widget.onlineGuide : _guide,
        openSynastry: () => selectTab(JovianTab.synastry),
        active: active,
      ),
      JovianTab.messages => SocialPage(
        account: widget.account,
        active: active,
        openAccount: () => selectTab(JovianTab.account),
      ),
      JovianTab.account => switch (widget.account) {
        final account? => JovianTabNavigator(
          active: active,
          child: AccountPage(
            account: account,
            active: active,
            openMessages: () => selectTab(JovianTab.messages),
            themeMode: widget.themeMode,
            onThemeModeChanged: widget.onThemeModeChanged,
          ),
        ),
        null => const _ModuleStatusPage(
          tab: JovianTab.account,
          message: '连接账号服务后可登录并查看报告。',
        ),
      },
    },
  );
}

class _ModuleStatusPage extends StatelessWidget {
  const _ModuleStatusPage({required this.tab, required this.message});

  final JovianTab tab;
  final String message;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(tab.label)),
    body: SafeArea(
      top: false,
      child: Padding(
        padding: jovianPagePadding,
        child: Card(
          child: ListTile(leading: TabGlyph(tab.glyph), title: Text(message)),
        ),
      ),
    ),
  );
}
