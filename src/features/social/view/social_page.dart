import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../account/account.dart';
import '../control/social_controller.dart';
import '../model/social.dart';
import 'social_profile.dart';
import 'social_records.dart';

class SocialPage extends StatelessWidget {
  const SocialPage({
    super.key,
    this.account,
    this.openAccount,
    this.active = true,
  });

  final AccountController? account;
  final VoidCallback? openAccount;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final current = account;
    if (current == null) {
      return const _UnavailableMessages('账号服务暂不可用。');
    }
    return ListenableBuilder(
      key: ObjectKey(current),
      listenable: current,
      builder: (context, _) {
        final memberId = current.socialMemberId;
        if (memberId != null) {
          return TickerMode(
            enabled: active,
            child: _MemberNavigator(
              key: ValueKey(memberId),
              page: _MessagesHome(
                controller: SocialController.forMember(current, memberId),
              ),
              active: active,
            ),
          );
        }
        final awaitingAccount = current.busy && !current.restored;
        final changingAccount = current.sessionChanging;
        final needsAgreement =
            current.session?.kind.name == 'member' &&
            current.authorizedSession == null;
        if (awaitingAccount || changingAccount) {
          return const _UnavailableMessages('正在确认当前账号…');
        }
        if (needsAgreement) {
          return _UnavailableMessages(
            '请阅读并确认当前的《用户服务协议》和《隐私政策》后继续。',
            openAccount: openAccount,
            action: '阅读并确认协议',
          );
        }

        Widget signInPage(String title, String message) => _UnavailableMessages(
          message,
          title: title,
          openAccount: openAccount,
        );

        const memberMessages = '登录后查看当前账户的消息';
        return _UnavailableMessages(
          '登录后可按 UID 或昵称找用户，并查看新增粉丝提醒。',
          openAccount: openAccount,
          onFindUser: () => AccountSectionLinks.openPage(
            context,
            AccountSection.findUser,
            () => signInPage('找用户', '登录后可按 UID 或昵称找用户。'),
          ),
          shortcuts: _MessageShortcuts(
            openFollowers: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => signInPage('新增粉丝', memberMessages),
              ),
            ),
            openReports: () => AccountSectionLinks.openPage(
              context,
              AccountSection.socialReports,
              () => signInPage('我的举报', memberMessages),
            ),
          ),
        );
      },
    );
  }
}

class _UnavailableMessages extends StatelessWidget {
  const _UnavailableMessages(
    this.message, {
    this.title = '消息',
    this.openAccount,
    this.action = '前往登录',
    this.onFindUser,
    this.shortcuts,
  });

  final String message;
  final String title;
  final VoidCallback? openAccount;
  final String action;
  final VoidCallback? onFindUser;
  final Widget? shortcuts;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: UiText(title),
      actions: _messageHeaderActions(context, onFindUser),
    ),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (shortcuts case final entries?) entries,
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
            child: Column(
              children: [
                Icon(
                  Icons.notifications_none_rounded,
                  color: Theme.of(context).colorScheme.primary,
                  size: 32,
                ),
                const SizedBox(height: 12),
                UiText(message, textAlign: TextAlign.center),
                if (openAccount != null) ...[
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: openAccount,
                    child: UiText(action),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

List<Widget> _messageHeaderActions(
  BuildContext context,
  VoidCallback? findUser,
) {
  if (findUser == null) return const [];
  return [
    IconButton(
      tooltip: context.uiLabel('找用户'),
      onPressed: findUser,
      icon: const Icon(Icons.person_search_outlined),
    ),
    PopupMenuButton<VoidCallback>(
      tooltip: context.uiLabel('更多操作'),
      icon: const Icon(Icons.add_circle_outline),
      position: PopupMenuPosition.under,
      constraints: const BoxConstraints(minWidth: 164, maxWidth: 210),
      onSelected: (action) => action(),
      itemBuilder: (_) => [
        PopupMenuItem(
          value: findUser,
          child: const Row(
            children: [
              Icon(Icons.search),
              SizedBox(width: 12),
              Flexible(child: UiText('找用户')),
            ],
          ),
        ),
      ],
    ),
  ];
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
  const _MemberNavigator({super.key, required this.page, required this.active});

  final Widget page;
  final bool active;

  @override
  State<_MemberNavigator> createState() => _MemberNavigatorState();
}

class _MemberNavigatorState extends State<_MemberNavigator> {
  final _navigation = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) => NavigatorPopHandler<void>(
    enabled: widget.active,
    onPopWithResult: (_) => _navigation.currentState?.maybePop(),
    child: Navigator(
      key: _navigation,
      onGenerateRoute: (_) =>
          MaterialPageRoute<void>(builder: (context) => widget.page),
    ),
  );
}

class _MessagesHome extends StatefulWidget {
  const _MessagesHome({required this.controller});

  final SocialController controller;

  @override
  State<_MessagesHome> createState() => _MessagesHomeState();
}

class _MessagesHomeState extends State<_MessagesHome> {
  Future<SocialInboxSummary>? _summary;
  bool _visible = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The tab and its navigator keep this page mounted when it is covered.
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible && !_visible) _summary = widget.controller.inbox();
    _visible = visible;
  }

  void _refresh() {
    final summary = widget.controller.inbox();
    setState(() {
      _summary = summary;
    });
  }

  void _refreshAfterRead() {
    // The inbox can finish marking a notification after returning here.
    if (mounted && _visible && widget.controller.isCurrentMember) _refresh();
  }

  Future<void> _open(Widget Function() page, {AccountSection? section}) async {
    final before = _summary;
    if (section == null) {
      await Navigator.of(
        context,
      ).push<void>(MaterialPageRoute(builder: (_) => page()));
    } else {
      await AccountSectionLinks.openPage(context, section, page);
    }
    // A quick return can finish before the covering route pauses this page.
    if (mounted && _visible && identical(_summary, before)) _refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const UiText('消息'),
      actions: _messageHeaderActions(
        context,
        () => _open(
          () => SocialSearchPage(controller: widget.controller),
          section: AccountSection.findUser,
        ),
      ),
    ),
    body: FutureBuilder<SocialInboxSummary>(
      future: _summary,
      builder: (context, snapshot) {
        final loading = snapshot.connectionState == ConnectionState.waiting;
        final inbox = loading ? null : snapshot.data;
        final unread = inbox?.unread ?? 0;
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (loading) const LinearProgressIndicator(),
            _MessageShortcuts(
              unread: unread,
              openFollowers: () => _open(
                () => FollowerAlertsPage(
                  controller: widget.controller,
                  onRead: _refreshAfterRead,
                ),
              ),
              openReports: () => _open(
                () => SocialReportsPage(controller: widget.controller),
                section: AccountSection.socialReports,
              ),
              openModeration: inbox?.canModerate == true
                  ? () => _open(
                      () => SocialReportsPage(
                        controller: widget.controller,
                        moderation: true,
                      ),
                      section: AccountSection.socialModeration,
                    )
                  : null,
            ),
            if (!loading && snapshot.hasError)
              ListTile(
                title: UiText(
                  describeSocialError(snapshot.error!, '暂时无法更新未读消息。'),
                ),
                trailing: TextButton(
                  onPressed: _refresh,
                  child: const UiText('重试'),
                ),
              ),
          ],
        );
      },
    ),
  );
}

class _MessageShortcuts extends StatelessWidget {
  const _MessageShortcuts({
    required this.openFollowers,
    required this.openReports,
    this.openModeration,
    this.unread = 0,
  });

  final VoidCallback openFollowers;
  final VoidCallback openReports;
  final VoidCallback? openModeration;
  final int unread;

  @override
  Widget build(BuildContext context) => Card(
    child: Column(
      children: [
        ListTile(
          leading: const Icon(Icons.person_add_alt_1_outlined),
          title: const UiText('新增粉丝'),
          subtitle: unread > 0
              ? Text(
                  context.uiLanguage == InterfaceLanguage.english
                      ? '$unread unread'
                      : '$unread 条未读',
                )
              : const UiText('查看关注提醒'),
          trailing: const Icon(Icons.chevron_right),
          onTap: openFollowers,
        ),
        const Divider(height: 1, indent: 16, endIndent: 16),
        ListTile(
          leading: const Icon(Icons.flag_outlined),
          title: const UiText('我的举报'),
          subtitle: const UiText('查看举报处理进度'),
          trailing: const Icon(Icons.chevron_right),
          onTap: openReports,
        ),
        if (openModeration != null) ...[
          const Divider(height: 1, indent: 16, endIndent: 16),
          ListTile(
            leading: const Icon(Icons.fact_check_outlined),
            title: const UiText('举报处理'),
            subtitle: const UiText('处理待办举报'),
            trailing: const Icon(Icons.chevron_right),
            onTap: openModeration,
          ),
        ],
      ],
    ),
  );
}
