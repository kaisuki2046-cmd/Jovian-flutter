import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../bootstrap/account.dart';
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
import 'app_shell.dart';

export 'app_shell.dart' show JovianTab;

void main() {
  final account = configureAccount();
  runApp(
    JovianApp(
      onlineGuide: account == null ? configureOnlineGuide() : null,
      account: account,
      readFortuneTime: configureFortuneTime(),
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
    this.initialTab = JovianTab.destiny,
    this.themeMode = ThemeMode.system,
    this.persistTheme = false,
  });

  final OnlineGuideController? onlineGuide;
  final AccountController? account;
  final Future<DateTime> Function()? readFortuneTime;
  final JovianTab initialTab;
  final ThemeMode themeMode;
  final bool persistTheme;

  @override
  State<JovianApp> createState() => _JovianAppState();
}

class _JovianAppState extends State<JovianApp> {
  static const _appearanceKey = 'jovian.ui.theme.v1';
  static const _appearance = FlutterSecureStorage();
  late ThemeMode _themeMode = widget.themeMode;
  bool _appearanceChanged = false;
  Future<void> _appearanceWrites = Future<void>.value();

  @override
  void initState() {
    super.initState();
    if (widget.persistTheme) unawaited(_readAppearance());
  }

  Future<void> _readAppearance() async {
    try {
      final stored = await _appearance.read(key: _appearanceKey);
      final mode = ThemeMode.values
          .where((item) => item.name == stored)
          .firstOrNull;
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
  Widget build(BuildContext context) => MaterialApp(
    title: '木星环',
    debugShowCheckedModeBanner: false,
    theme: jovianTheme(Brightness.light),
    darkTheme: jovianTheme(Brightness.dark),
    themeMode: _themeMode,
    builder: (context, child) => JovianViewport(child: child!),
    routes: {
      '/destiny': (context) => _destinyPage(context, account: widget.account),
      '/fortune': _fortunePage,
      '/modules/fortune': _fortunePage,
    },
    home: _AppHome(
      account: widget.account,
      onlineGuide: widget.onlineGuide,
      initialTab: widget.initialTab,
      themeMode: _themeMode,
      onThemeModeChanged: _changeAppearance,
    ),
  );

  Widget _fortunePage(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    return FortunePage(
      account: widget.account,
      loadDisplay: loadFortuneDisplay,
      readServerTime: widget.readFortuneTime,
      archiveId: args is String ? args : null,
    );
  }
}

Widget _destinyPage(
  BuildContext context, {
  Key? key,
  AccountController? account,
}) => DestinyPage(
  key: key,
  loadPlaces: loadBirthPlaces,
  calculate: calculateDestinyBaZi,
  calculateReading: legacyDestinyCalculation(),
  requestReport: configureDestinyReport(
    readNativeSession: account?.readNativeSession,
  ),
  account: account,
  openFortune: () => Navigator.pushNamed(context, '/fortune'),
);

class _AppHome extends StatefulWidget {
  const _AppHome({
    required this.account,
    required this.onlineGuide,
    required this.initialTab,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final AccountController? account;
  final OnlineGuideController? onlineGuide;
  final JovianTab initialTab;
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
      unawaited(account.initialize());
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
    widget.account?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => JovianShell(
    initialTab: widget.initialTab,
    buildPage: (context, tab, active, selectTab) => switch (tab) {
      JovianTab.destiny => _destinyPage(
        context,
        key: ValueKey(_scope),
        account: widget.account,
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
