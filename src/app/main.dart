import 'dart:async';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../bootstrap/account.dart';
import '../bootstrap/destiny.dart';
import '../bootstrap/divination.dart';
import '../bootstrap/fortune.dart';
import '../features/account/account.dart';
import '../features/destiny/destiny.dart';
import '../features/divination/divination.dart';
import '../features/fortune/fortune.dart';
import '../ui/theme.dart';

void main() {
  final account = configureAccount();
  runApp(
    JovianApp(
      onlineGuide: account == null ? configureOnlineGuide() : null,
      account: account,
      readFortuneTime: configureFortuneTime(),
    ),
  );
}

class JovianApp extends StatelessWidget {
  const JovianApp({
    super.key,
    this.onlineGuide,
    this.account,
    this.readFortuneTime,
  });

  final OnlineGuideController? onlineGuide;
  final AccountController? account;
  final Future<DateTime> Function()? readFortuneTime;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: '木星环',
    debugShowCheckedModeBanner: false,
    theme: jovianTheme(Brightness.light),
    darkTheme: jovianTheme(Brightness.dark),
    routes: {
      '/destiny': (context) => DestinyPage(
        loadPlaces: loadBirthPlaces,
        calculate: calculateDestinyBaZi,
        openFortune: () => Navigator.pushNamed(context, '/fortune'),
      ),
      '/fortune': (context) {
        final args = ModalRoute.of(context)?.settings.arguments;
        return FortunePage(
          account: account,
          loadDisplay: loadFortuneDisplay,
          readServerTime: readFortuneTime,
          archiveId: args is String ? args : null,
        );
      },
    },
    home: account == null
        ? Builder(
            builder: (context) => DivinationPage(
              onlineGuide: onlineGuide,
              openDestiny: () => Navigator.pushNamed(context, '/destiny'),
            ),
          )
        : _AccountHome(account: account!),
  );
}

class _AccountHome extends StatefulWidget {
  const _AccountHome({required this.account});

  final AccountController account;

  @override
  State<_AccountHome> createState() => _AccountHomeState();
}

class _AccountHomeState extends State<_AccountHome> {
  String? _scope;
  OnlineGuideController? _guide;

  @override
  void initState() {
    super.initState();
    widget.account.addListener(_updateGuideOwner);
    unawaited(widget.account.initialize());
  }

  void _updateGuideOwner() {
    final account = widget.account;
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
    widget.account.removeListener(_updateGuideOwner);
    _guide?.dispose();
    widget.account.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DivinationPage(
    onlineGuide: _guide,
    openDestiny: () => Navigator.pushNamed(context, '/destiny'),
    openAccount: () => Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => AccountPage(account: widget.account)),
    ),
  );
}
