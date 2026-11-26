import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../auth/control/account_controller.dart';
import '../control/app_update_controller.dart';
import '../model/android_release.dart';

class AppUpdateScope extends InheritedNotifier<AppUpdateController> {
  const AppUpdateScope({
    super.key,
    required super.notifier,
    required super.child,
  });

  static AppUpdateController? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppUpdateScope>()?.notifier;
}

class AppUpdateHost extends StatefulWidget {
  const AppUpdateHost({
    super.key,
    required this.updates,
    required this.navigator,
    required this.account,
    required this.child,
  });

  final AppUpdateController updates;
  final GlobalKey<NavigatorState> navigator;
  final AccountController? account;
  final Widget child;

  @override
  State<AppUpdateHost> createState() => _AppUpdateHostState();
}

class _AppUpdateHostState extends State<AppUpdateHost>
    with WidgetsBindingObserver {
  bool _presenting = false;

  bool get _ready {
    final account = widget.account;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    return (lifecycle == null || lifecycle == AppLifecycleState.resumed) &&
        (account == null ||
            (!account.busy &&
                account.nicknameSetupMember == null &&
                (account.restored || account.notice != null)));
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.updates.addListener(_scheduleOffer);
    widget.account?.addListener(_scheduleOffer);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await widget.updates.initialize();
      if (mounted) _checkOnResume();
    });
  }

  @override
  void didUpdateWidget(AppUpdateHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.account != widget.account) {
      oldWidget.account?.removeListener(_scheduleOffer);
      widget.account?.addListener(_scheduleOffer);
      _scheduleOffer();
    }
  }

  void _checkOnResume() {
    final state = WidgetsBinding.instance.lifecycleState;
    if (state == null || state == AppLifecycleState.resumed) {
      unawaited(widget.updates.check(manual: false));
      _scheduleOffer();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkOnResume();
  }

  void _scheduleOffer() {
    if (!mounted || _presenting || !_ready || widget.updates.offer == null)
      return;
    _presenting = true;
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => unawaited(_showOffer()),
    );
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _showOffer() async {
    if (!mounted) return;
    final context = widget.navigator.currentState?.overlay?.context;
    final updates = widget.updates;
    final offer = updates.offer;
    if (context == null || offer == null || !_ready) {
      _presenting = false;
      return;
    }
    await showDialog<void>(
      context: context,
      builder: (_) => _UpdateDialog(release: offer, updates: updates),
    );
    if (!mounted) return;
    updates.dismiss(offer);
    _presenting = false;
    _scheduleOffer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.account?.removeListener(_scheduleOffer);
    widget.updates.removeListener(_scheduleOffer);
    widget.updates.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      AppUpdateScope(notifier: widget.updates, child: widget.child);
}

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.release, required this.updates});

  final AndroidRelease release;
  final AppUpdateController updates;

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _opening = false;
  bool _failed = false;

  Future<void> _download() async {
    setState(() {
      _opening = true;
      _failed = false;
    });
    final opened = await widget.updates.open(widget.release);
    if (!mounted) return;
    if (opened) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _opening = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('发现新版'),
    scrollable: true,
    content: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('版本 ${widget.release.version.versionName}'),
        const SizedBox(height: 12),
        Semantics(header: true, child: const Text('更新内容')),
        for (final note in widget.release.notes)
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Text('• $note'),
          ),
        if (_failed)
          Semantics(
            container: true,
            liveRegion: true,
            child: const Text('无法打开下载链接，请重试。'),
          ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: _opening ? null : () => Navigator.of(context).pop(),
        child: const Text('稍后'),
      ),
      FilledButton(
        onPressed: _opening ? null : _download,
        child: const Text('下载新版'),
      ),
    ],
  );
}
