import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:jovian_fortune/jovian_fortune.dart' show FortunePeriod;
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
import '../ui/interface_language.dart';
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
  static const _languageKey = 'jovian.ui.language.v1';
  static const _appearance = FlutterSecureStorage();
  late final _legacyPreferences = readLegacyDevicePreferences();
  late final _navigation = JovianRouter(
    shell: _shellPage,
    fortune: _fortunePage,
    fortunePermissions: _fortunePermissionsPage,
  );
  late final _routeInformation = JovianRouteInformationProvider(
    initialRouteInformation: initialJovianRoute(widget.initialTab),
    navigation: _navigation,
  );
  late final _router = RouterConfig<JovianLocation>(
    routeInformationProvider: _routeInformation,
    routeInformationParser: const JovianRouteParser(),
    routerDelegate: _navigation,
    backButtonDispatcher: RootBackButtonDispatcher(),
  );
  late ThemeMode _themeMode = widget.themeMode;
  InterfaceLanguage _language = InterfaceLanguage.chinese;
  bool _appearanceChanged = false;
  bool _languageChanged = false;
  Future<void> _appearanceWrites = Future<void>.value();
  Future<void> _languageWrites = Future<void>.value();

  @override
  void initState() {
    super.initState();
    if (widget.persistTheme) {
      unawaited(_readAppearance());
      unawaited(_readLanguage());
    }
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
      final legacy = savedMode == null
          ? (await _legacyPreferences)?.appearance
          : null;
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

  Future<void> _readLanguage() async {
    try {
      final stored = await _appearance
          .read(key: _languageKey)
          .onError((_, _) => null);
      final language =
          InterfaceLanguage.parse(stored) ??
          InterfaceLanguage.parse((await _legacyPreferences)?.language);
      if (mounted && !_languageChanged && language != null) {
        setState(() => _language = language);
      }
    } catch (_) {
      // The default language remains available without device storage.
    }
  }

  void _changeLanguage(InterfaceLanguage language) {
    if (language == _language) return;
    _languageChanged = true;
    setState(() => _language = language);
    if (!widget.persistTheme) return;
    _languageWrites = _languageWrites.then((_) async {
      try {
        await _appearance.write(key: _languageKey, value: language.code);
      } catch (_) {
        // Keep applying the selected language for this session.
      }
    });
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    onGenerateTitle: (context) => context.uiLabel('木星环'),
    debugShowCheckedModeBanner: false,
    theme: jovianTheme(Brightness.light),
    darkTheme: jovianTheme(Brightness.dark),
    themeMode: _themeMode,
    locale: _language.locale,
    supportedLocales: [
      for (final language in InterfaceLanguage.values) language.locale,
    ],
    localizationsDelegates: const [
      interfaceStringsDelegate,
      ...GlobalMaterialLocalizations.delegates,
    ],
    routerConfig: _router,
    builder: (context, child) {
      final nav = switch (widget.account) {
        final account? => NicknameSetupGate(account: account, child: child!),
        null => child!,
      };
      final viewport = InterfaceLanguageScope(
        onChanged: _changeLanguage,
        child: JovianViewport(child: nav),
      );
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

  Widget _shellPage(JovianLocation location) => _accountEntry(
    AccountSectionLinks(
      open: _navigation.openAccountSection,
      protectFromHistory: _navigation.protectAccountSection,
      child: _AppHome(
        key: ObjectKey(widget.account),
        account: widget.account,
        onlineGuide: widget.onlineGuide,
        tab: location.tab,
        onTabSelected: _navigation.selectTab,
        openFortune: _navigation.openFortune,
        openWelcome: _navigation.openWelcome,
        sectionsFor: _navigation.sectionsFor,
        onSectionPopped: _navigation.accountSectionPopped,
        themeMode: _themeMode,
        onThemeModeChanged: _changeAppearance,
      ),
    ),
    welcome: location.welcome,
  );

  Widget _accountEntry(Widget child, {bool welcome = false}) {
    final account = widget.account;
    if (account == null) return child;
    return ListenableBuilder(
      key: ObjectKey(account),
      listenable: account,
      child: child,
      builder: (context, admitted) {
        final authorized = account.authorizedSession;
        if (authorized != null && !welcome) return admitted!;
        if (welcome && account.memberId != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) _navigation.closeWelcome();
          });
          return admitted!;
        }
        if (!account.restored && account.notice == null) {
          return Scaffold(
            body: Center(
              child: CircularProgressIndicator(
                semanticsLabel: context.uiLabel('正在检查登录状态…'),
              ),
            ),
          );
        }
        return AccountPage(
          account: account,
          standalone: true,
          themeMode: _themeMode,
          onThemeModeChanged: _changeAppearance,
          onWelcomeExit: welcome ? _navigation.closeWelcome : null,
        );
      },
    );
  }

  Widget _fortunePage(String? archiveId, FortunePeriod? period) =>
      _accountEntry(
        FortunePage(
          account: widget.account,
          loadDisplay: loadFortuneDisplay,
          readServerTime: widget.readFortuneTime,
          connectOnline: () => configureFortuneOnline(
            widget.readFortuneTime,
            readNativeSession: widget.account?.readNativeSession,
          ),
          archiveId: archiveId,
          restoredPeriod: period,
          openAiPermissions: _navigation.openFortunePermissions,
        ),
      );

  Widget _fortunePermissionsPage() => _accountEntry(
    AccountSectionPage(
      account: widget.account,
      target: accountDestination(AccountSection.aiPermissions),
      themeMode: _themeMode,
      onThemeModeChanged: _changeAppearance,
      openAccount: _navigation.openWelcome,
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
    required this.openWelcome,
    required this.sectionsFor,
    required this.onSectionPopped,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final AccountController? account;
  final OnlineGuideController? onlineGuide;
  final JovianTab tab;
  final ValueChanged<JovianTab> onTabSelected;
  final ValueChanged<String?> openFortune;
  final VoidCallback openWelcome;
  final List<AccountDestination> Function(JovianTab) sectionsFor;
  final void Function(JovianTab, AccountDestination) onSectionPopped;
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

  Future<void> _openGuidePermissions() async {
    final account = widget.account;
    final scope = _scope;
    if (account == null || scope == null) return;
    await account.initialize();
    if (!mounted || !identical(widget.account, account) || _scope != scope)
      return;
    final links = context.getInheritedWidgetOfExactType<AccountSectionLinks>();
    await links?.open(accountDestination(AccountSection.aiPermissions));
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
        calculateReading: calculateDestinyReading,
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
        openAiPermissions: widget.account == null
            ? null
            : _openGuidePermissions,
        active: active,
      ),
      JovianTab.messages => _sectionNavigator(
        context,
        tab,
        active: active,
        child: SocialPage(
          account: widget.account,
          active: active,
          openAccount: widget.openWelcome,
        ),
      ),
      JovianTab.account => switch (widget.account) {
        final account? => _sectionNavigator(
          context,
          tab,
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

  Widget _sectionNavigator(
    BuildContext context,
    JovianTab tab, {
    required bool active,
    required Widget child,
  }) => JovianTabNavigator(
    active: active,
    sections: widget.sectionsFor(tab),
    buildSection: (target) => AccountSectionPage(
      account: widget.account,
      target: target,
      themeMode: widget.themeMode,
      onThemeModeChanged: widget.onThemeModeChanged,
      openAccount: widget.openWelcome,
    ),
    onSectionPopped: (section) =>
        Router.neglect(context, () => widget.onSectionPopped(tab, section)),
    child: child,
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
