import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../account/account.dart';
import '../control/social_controller.dart';
import '../model/social.dart';
import 'message_inbox_page.dart';
import 'social_profile.dart';
import 'social_records.dart';

class SocialPage extends StatelessWidget {
  const SocialPage({
    super.key,
    this.account,
    this.openAccount,
    this.active = true,
    this.followerAlertReads,
    this.onDetailVisibilityChanged,
  });

  final AccountController? account;
  final VoidCallback? openAccount;
  final bool active;
  final Listenable? followerAlertReads;
  final ValueChanged<bool>? onDetailVisibilityChanged;

  @override
  Widget build(BuildContext context) {
    final current = account;
    if (current == null) return _workspace();
    return ListenableBuilder(
      key: ObjectKey(current),
      listenable: current,
      builder: (context, _) {
        final memberId = current.socialMemberId;
        return _workspace(
          controller: memberId == null
              ? null
              : SocialController.forMember(current, memberId),
          uid: memberId == null ? null : current.session?.uid,
          agreementNeeded:
              current.session?.kind.name == 'member' &&
              current.authorizedSession == null,
        );
      },
    );
  }

  Widget _workspace({
    SocialController? controller,
    String? uid,
    bool agreementNeeded = false,
  }) {
    final scope = controller?.memberId ?? 'preview';
    return TickerMode(
      enabled: active,
      child: _MemberNavigator(
        key: ValueKey(scope),
        active: active,
        onDetailVisibilityChanged: onDetailVisibilityChanged,
        page: _MessagesHome(
          scope: scope,
          controller: controller,
          uid: uid,
          followerAlertReads: followerAlertReads,
          openAccount: controller == null ? openAccount : null,
          agreementNeeded: agreementNeeded,
        ),
      ),
    );
  }
}

class _MessageSignIn extends StatelessWidget {
  const _MessageSignIn(
    this.title, {
    required this.openAccount,
    required this.agreementNeeded,
  });

  final String title;
  final VoidCallback? openAccount;
  final bool agreementNeeded;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: UiText(title)),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline_rounded),
            const SizedBox(height: 8),
            UiText(
              agreementNeeded ? '请阅读并确认当前的《用户服务协议》和《隐私政策》后继续。' : '登录后查看当前账户的消息',
              textAlign: TextAlign.center,
            ),
            if (openAccount != null)
              TextButton(
                onPressed: openAccount,
                child: UiText(agreementNeeded ? '阅读并确认协议' : '前往登录'),
              ),
          ],
        ),
      ),
    ),
  );
}

class SocialConnectionsPage extends StatelessWidget {
  const SocialConnectionsPage({
    super.key,
    required this.account,
    required this.direction,
  });

  final AccountController account;
  final SocialList direction;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: account,
    builder: (context, _) {
      final memberId = account.socialMemberId;
      if (memberId == null) {
        return Scaffold(
          appBar: AppBar(
            title: UiText(direction == SocialList.followers ? '粉丝' : '关注'),
          ),
          body: const Center(child: UiText('登录后可以查看关注与粉丝。')),
        );
      }
      return _MemberNavigator(
        key: ValueKey((account, memberId, direction)),
        active: true,
        page: SocialConnectionsPanel(
          controller: SocialController.forMember(account, memberId),
          direction: direction,
          onBack: () => Navigator.of(context).maybePop(),
        ),
      );
    },
  );
}

class _MemberNavigator extends StatefulWidget {
  const _MemberNavigator({
    super.key,
    required this.page,
    required this.active,
    this.onDetailVisibilityChanged,
  });

  final Widget page;
  final bool active;
  final ValueChanged<bool>? onDetailVisibilityChanged;

  @override
  State<_MemberNavigator> createState() => _MemberNavigatorState();
}

class _MemberNavigatorState extends State<_MemberNavigator> {
  final _navigation = GlobalKey<NavigatorState>();
  late final _observer = _MessagePageObserver((hasDetail) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onDetailVisibilityChanged?.call(hasDetail);
    });
  });

  @override
  Widget build(BuildContext context) => NavigatorPopHandler<void>(
    enabled: widget.active,
    onPopWithResult: (_) => _navigation.currentState?.maybePop(),
    child: Navigator(
      key: _navigation,
      observers: [if (widget.onDetailVisibilityChanged != null) _observer],
      onGenerateRoute: (_) =>
          MaterialPageRoute<void>(builder: (context) => widget.page),
    ),
  );
}

class _MessagePageObserver extends NavigatorObserver {
  _MessagePageObserver(this.onDetailVisibilityChanged);

  final ValueChanged<bool> onDetailVisibilityChanged;

  @override
  void didChangeTop(Route<dynamic> topRoute, Route<dynamic>? previousTopRoute) {
    if (topRoute is PageRoute<dynamic>) {
      onDetailVisibilityChanged(!topRoute.isFirst);
    }
  }
}

class _MessagesHome extends StatefulWidget {
  const _MessagesHome({
    required this.scope,
    required this.controller,
    required this.uid,
    required this.followerAlertReads,
    required this.openAccount,
    required this.agreementNeeded,
  });

  final String scope;
  final SocialController? controller;
  final String? uid;
  final Listenable? followerAlertReads;
  final VoidCallback? openAccount;
  final bool agreementNeeded;

  @override
  State<_MessagesHome> createState() => _MessagesHomeState();
}

class _MessagesHomeState extends State<_MessagesHome> {
  Future<SocialInboxSummary>? _summary;
  SocialInboxSummary? _lastSummary;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    widget.followerAlertReads?.addListener(_refreshAfterRead);
  }

  @override
  void didUpdateWidget(covariant _MessagesHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.followerAlertReads != widget.followerAlertReads) {
      oldWidget.followerAlertReads?.removeListener(_refreshAfterRead);
      widget.followerAlertReads?.addListener(_refreshAfterRead);
    }
  }

  @override
  void dispose() {
    widget.followerAlertReads?.removeListener(_refreshAfterRead);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible && !_visible) _summary = widget.controller?.inbox();
    _visible = visible;
  }

  void _refresh() {
    final controller = widget.controller;
    if (controller == null) return;
    final summary = controller.inbox();
    setState(() {
      _summary = summary;
    });
  }

  void _refreshAfterRead() {
    if (mounted && _visible && widget.controller?.isCurrentMember == true)
      _refresh();
  }

  Future<void> _open(
    AccountSection section,
    Widget Function(SocialController) page,
    String title,
  ) async {
    final before = _summary;
    final controller = widget.controller;
    await AccountSectionLinks.openPage(
      context,
      section,
      () => controller == null
          ? _MessageSignIn(
              title,
              openAccount: widget.openAccount,
              agreementNeeded: widget.agreementNeeded,
            )
          : page(controller),
    );
    if (mounted && _visible && identical(_summary, before)) _refresh();
  }

  void _followers() => _open(
    AccountSection.newFollowers,
    (controller) =>
        FollowerAlertsPage(controller: controller, onRead: _refreshAfterRead),
    '新增粉丝',
  );

  void _reports() => _open(
    AccountSection.socialReports,
    (controller) => SocialReportsPage(controller: controller),
    '我的举报',
  );

  void _findUser() => _open(
    AccountSection.findUser,
    (controller) => SocialSearchPage(controller: controller),
    '找用户',
  );

  void _moderation() => _open(
    AccountSection.socialModeration,
    (controller) => SocialReportsPage(controller: controller, moderation: true),
    '举报处理',
  );

  @override
  Widget build(BuildContext context) => FutureBuilder<SocialInboxSummary>(
    future: _summary,
    builder: (context, snapshot) {
      if (snapshot.data case final summary?) _lastSummary = summary;
      final lastSummary = _lastSummary;
      final waiting = snapshot.connectionState == ConnectionState.waiting;
      final notifications = waiting || snapshot.hasError ? null : snapshot.data;
      // Keep the same inbox while checking whether an older server supports chat.
      return MessageInboxPage(
        scope: widget.scope,
        controller: lastSummary?.conversationsEnabled == true
            ? widget.controller
            : null,
        uid: widget.uid,
        followerUnread: notifications?.unread ?? 0,
        loadingNotifications: waiting,
        notificationError: snapshot.error,
        openFollowers: _followers,
        openReports: _reports,
        openFindUser: _findUser,
        openModeration: notifications?.canModerate == true ? _moderation : null,
        refreshNotifications: _refresh,
        openAccount: widget.openAccount,
      );
    },
  );
}
