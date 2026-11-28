import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_activities.dart';
import 'message_code_page.dart';
import 'message_components.dart';
import 'message_customization_page.dart';
import 'message_design.dart';
import 'message_discovery_page.dart';
import 'message_notices.dart';
import 'message_service_views.dart';
import 'message_stories.dart';
import 'message_thread_page.dart';

class MessageInboxPage extends StatefulWidget {
  const MessageInboxPage({
    super.key,
    required this.scope,
    this.controller,
    this.uid,
    this.followerUnread = 0,
    this.loadingNotifications = false,
    this.notificationError,
    required this.openFollowers,
    required this.openReports,
    required this.openFindUser,
    required this.refreshNotifications,
    this.openAccount,
    this.openModeration,
  });

  final String scope;
  final SocialController? controller;
  final String? uid;
  final int followerUnread;
  final bool loadingNotifications;
  final Object? notificationError;
  final VoidCallback openFollowers;
  final VoidCallback openReports;
  final VoidCallback openFindUser;
  final VoidCallback refreshNotifications;
  final VoidCallback? openAccount;
  final VoidCallback? openModeration;

  @override
  State<MessageInboxPage> createState() => _MessageInboxPageState();
}

class _MessageInboxPageState extends State<MessageInboxPage> {
  final _scaffold = GlobalKey<ScaffoldState>();
  late final _workspace = MessageWorkspaceController(widget.scope);
  SocialPaginator<MessageConversation>? _inbox;
  Timer? _poll;
  bool _visible = false;
  bool _unreadOnly = false;
  bool _opening = false;
  bool _viewingMore = false;

  @override
  void initState() {
    super.initState();
    _bindInbox();
  }

  @override
  void didUpdateWidget(covariant MessageInboxPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller?.memberId != widget.controller?.memberId) {
      _bindInbox();
      if (_visible) unawaited(_inbox?.load());
    }
  }

  void _bindInbox() {
    _inbox?.dispose();
    _inbox = widget.controller?.conversations(unreadOnly: _unreadOnly);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible == _visible) return;
    _visible = visible;
    _poll?.cancel();
    if (visible) {
      if (!_viewingMore) unawaited(_inbox?.load());
      _poll = Timer.periodic(const Duration(seconds: 12), (_) {
        if (!_opening &&
            !_viewingMore &&
            widget.controller?.isCurrentMember == true) {
          unawaited(_inbox?.load());
        }
      });
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _inbox?.dispose();
    _workspace.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    _viewingMore = false;
    widget.refreshNotifications();
    await _inbox?.load();
  }

  void _filter(bool unreadOnly) {
    if (_unreadOnly == unreadOnly) return;
    setState(() {
      _unreadOnly = unreadOnly;
      _viewingMore = false;
      _bindInbox();
    });
    unawaited(_inbox?.load());
  }

  Future<void> _showChat(MessageConversation thread) async {
    final MessageHistory? history = _workspace.isDemo(thread.id)
        ? _workspace
        : widget.controller;
    if (history == null || !history.isCurrentMember) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => MessageThreadPage(
          controller: history,
          thread: thread,
          workspace: _workspace,
          uid: widget.uid,
        ),
      ),
    );
  }

  Future<void> _openChat(MessageConversation thread) =>
      _open(() async => thread);

  Future<void> _open(Future<MessageConversation?> Function() pick) async {
    if (_opening) return;
    _opening = true;
    try {
      final thread = await pick();
      if (mounted && thread != null) await _showChat(thread);
    } finally {
      _opening = false;
      if (mounted) unawaited(_inbox?.load());
    }
  }

  Future<void> _discover(MessageDiscoveryMode mode) => _open(
    () => Navigator.of(context).push<MessageConversation>(
      MaterialPageRoute(
        builder: (_) => MessageDiscoveryPage(
          workspace: _workspace,
          controller: widget.controller,
          mode: mode,
          openAccount: widget.openAccount,
        ),
      ),
    ),
  );

  Future<void> _scan() => _open(
    () => Navigator.of(context).push<MessageConversation>(
      MaterialPageRoute(
        builder: (_) => MessageCodePage(
          workspace: _workspace,
          controller: widget.controller,
          uid: widget.uid,
        ),
      ),
    ),
  );

  Future<void> _notice(MessageNoticeChannel channel) => _open(() {
    _workspace.readNotices(channel);
    return Navigator.of(context).push<MessageConversation>(
      MaterialPageRoute(
        builder: (context) => MessageNoticesPage(
          workspace: _workspace,
          channel: channel,
          followers: widget.openFollowers,
          onOrder: () => openMessageCoupons(context, _workspace),
        ),
      ),
    );
  });

  Future<void> _activity({MessageActivity? activity}) async {
    final invite = await (activity == null
        ? showMessageActivities(context, _workspace)
        : openMessageActivity(context, _workspace, activity));
    if (!mounted || invite == null) return;
    final thread = await showDialog<MessageConversation>(
      context: context,
      useRootNavigator: false,
      builder: (context) => SimpleDialog(
        title: const UiText('选择演示聊天'),
        children: [
          for (final thread in _workspace.conversations())
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, thread),
              child: Text(thread.title ?? ''),
            ),
        ],
      ),
    );
    if (!mounted || thread == null) return;
    await _workspace.sendMessage(
      thread.id,
      body: invite,
      nonce: newMessageNonce(),
    );
    if (mounted) await _openChat(thread);
  }

  @override
  Widget build(BuildContext context) {
    final inbox = _inbox;
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final layout = MessageLayout.of(context);
    final actionWidth = layout.px(72);
    final edge = layout.px(9);
    final iconSize = layout.px(34);
    return Scaffold(
      key: _scaffold,
      drawer: _drawer(),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: layout.toolbarHeight,
        backgroundColor: theme.scaffoldBackgroundColor,
        foregroundColor: colors.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leadingWidth: edge + actionWidth * 2,
        leading: Padding(
          padding: EdgeInsetsDirectional.only(start: edge),
          child: Row(
            children: [
              SizedBox(
                width: actionWidth,
                child: IconButton(
                  tooltip: context.uiLabel('消息菜单'),
                  onPressed: () => _scaffold.currentState?.openDrawer(),
                  icon: Icon(Icons.segment_rounded, size: iconSize),
                ),
              ),
              SizedBox(
                width: actionWidth,
                child: IconButton(
                  tooltip: context.uiLabel('消息装扮'),
                  onPressed: () =>
                      openMessageCustomization(context, _workspace),
                  icon: Icon(Icons.palette_outlined, size: iconSize),
                ),
              ),
            ],
          ),
        ),
        centerTitle: true,
        titleSpacing: 4,
        title: UiText(
          '消息',
          style: TextStyle(
            color: colors.onSurface,
            fontSize: layout.px(26),
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          SizedBox(
            width: actionWidth,
            child: IconButton(
              tooltip: context.uiLabel('搜索消息'),
              onPressed: () => _discover(MessageDiscoveryMode.search),
              icon: Icon(Icons.search_rounded, size: iconSize),
            ),
          ),
          SizedBox(
            width: actionWidth,
            child: PopupMenuButton<VoidCallback>(
              tooltip: context.uiLabel('新建会话'),
              icon: Icon(Icons.add_box_outlined, size: iconSize),
              padding: EdgeInsets.zero,
              position: PopupMenuPosition.under,
              onSelected: (action) => action(),
              itemBuilder: (_) => [
                _menuItem(
                  '发起群聊',
                  Icons.groups_outlined,
                  () => _discover(MessageDiscoveryMode.group),
                ),
                _menuItem(
                  '添加好友',
                  Icons.person_add_alt_outlined,
                  () => _discover(MessageDiscoveryMode.friend),
                ),
                _menuItem('扫一扫', Icons.qr_code_scanner_rounded, _scan),
                _menuItem(
                  '建立星伴关系',
                  Icons.auto_awesome_outlined,
                  () => _discover(MessageDiscoveryMode.companion),
                ),
                const PopupMenuDivider(),
                _menuItem(
                  _unreadOnly ? '全部' : '未读',
                  _unreadOnly
                      ? Icons.inbox_outlined
                      : Icons.mark_chat_unread_outlined,
                  () => _filter(!_unreadOnly),
                ),
              ],
            ),
          ),
          SizedBox(width: edge),
        ],
      ),
      body: ListenableBuilder(
        listenable: Listenable.merge([_workspace, inbox]),
        builder: (context, _) {
          final remote = inbox?.page?.items ?? const <MessageConversation>[];
          final demos = _workspace.conversations(unreadOnly: _unreadOnly);
          final page = inbox?.page;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.only(
                bottom: 24 + MediaQuery.paddingOf(context).bottom,
              ),
              children: [
                if (widget.loadingNotifications ||
                    (inbox?.loading == true && page == null))
                  const LinearProgressIndicator(minHeight: 2),
                if (widget.notificationError case final failure?)
                  MessageStatus(
                    describeSocialError(failure, '暂时无法更新未读消息。'),
                    action: TextButton(
                      onPressed: widget.refreshNotifications,
                      child: const UiText('重试'),
                    ),
                  ),
                if (!_unreadOnly) MessageStoryStrip(workspace: _workspace),
                if (!_unreadOnly ||
                    _workspace.hasNotice(MessageNoticeChannel.activity) ||
                    widget.followerUnread > 0)
                  _noticeRow(
                    MessageNoticeChannel.activity,
                    count: widget.followerUnread,
                  ),
                for (final thread in remote) _conversation(thread),
                if (inbox?.error case final failure?)
                  MessageStatus(
                    describeSocialError(failure, '暂时无法更新会话。'),
                    action: TextButton(
                      onPressed: () => inbox!.load(more: inbox.retryMore),
                      child: const UiText('重试'),
                    ),
                  ),
                if (page?.next != null && inbox?.error == null)
                  TextButton(
                    onPressed: inbox!.loading
                        ? null
                        : () {
                            _viewingMore = true;
                            unawaited(inbox.load(more: true));
                          },
                    child: const UiText('加载更多'),
                  ),
                for (final thread in demos) _conversation(thread),
                if (!_unreadOnly ||
                    _workspace.hasNotice(MessageNoticeChannel.orders))
                  _noticeRow(MessageNoticeChannel.orders),
                if (!_unreadOnly ||
                    _workspace.hasNotice(MessageNoticeChannel.events))
                  _noticeRow(MessageNoticeChannel.events),
                if (_unreadOnly &&
                    remote.isEmpty &&
                    demos.isEmpty &&
                    MessageNoticeChannel.values.every(
                      (c) => !_workspace.hasNotice(c),
                    ) &&
                    widget.followerUnread == 0)
                  const MessageStatus('暂无未读会话。'),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _conversation(MessageConversation thread) => MessageConversationRow(
    thread: thread,
    onTap: () => _openChat(thread),
    streak: _workspace.streak(thread.id),
  );

  Widget _noticeRow(MessageNoticeChannel channel, {int count = 0}) {
    final first = _workspace.notices(channel).first;
    final title = messageNoticeTitle(channel);
    final unread = _workspace.hasNotice(channel);
    final colors = Theme.of(context).colorScheme;
    final layout = MessageLayout.of(context);
    final subtitle = count > 0
        ? context.uiLanguage == InterfaceLanguage.english
              ? '$count unread'
              : '$count 条未读'
        : context.uiLabel(first.title);
    return InkWell(
      onTap: () => _notice(channel),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: layout.px(24),
          vertical: (layout.listRowHeight - layout.listAvatar) / 2,
        ),
        child: Row(
          children: [
            MessageAvatar(
              name: title,
              icon: messageNoticeIcon(channel),
              tone: channel.index,
              size: layout.listAvatar,
            ),
            SizedBox(width: layout.px(20)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  UiText(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: colors.onSurface,
                      fontSize: layout.px(24),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: layout.px(4)),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: colors.onSurfaceVariant,
                      fontSize: layout.px(20),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: layout.px(18)),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                UiText(
                  first.time,
                  style: TextStyle(
                    color: colors.onSurfaceVariant,
                    fontSize: layout.px(16),
                  ),
                ),
                if (count > 0 || unread) ...[
                  const SizedBox(height: 3),
                  Badge.count(
                    count: count > 0 ? count : 1,
                    largeSize: layout.px(26),
                    backgroundColor: colors.primary,
                    textColor: colors.onPrimary,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawer() => Drawer(
    width: MessageLayout.of(context).px(459),
    backgroundColor: messagePaper,
    child: Builder(
      builder: (drawer) {
        final layout = MessageLayout.of(drawer);
        void open(VoidCallback action) {
          Navigator.pop(drawer);
          action();
        }

        Widget link(
          String label,
          IconData icon,
          VoidCallback action,
          int tone, {
          double avatar = 40,
        }) => MessageActionTile(
          label,
          icon,
          () => open(action),
          tone: tone,
          foregroundColor: messageInk,
          avatarSize: layout.px(avatar),
          labelSize: layout.px(18),
        );
        return SafeArea(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 20),
            children: [
              MessageSectionHeading(
                '消息菜单',
                action: IconButton(
                  tooltip: context.uiLabel('消息设置'),
                  onPressed: () =>
                      open(() => openMessageCustomization(context, _workspace)),
                  icon: const Icon(Icons.settings_outlined),
                ),
              ),
              if (widget.openAccount != null)
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const UiText('前往登录'),
                  onTap: () => open(widget.openAccount!),
                ),
              MessageActionGrid(
                rowHeight: layout.px(119),
                children: [
                  link('扫一扫', Icons.qr_code_scanner, _scan, 1),
                  link(
                    '体验出行码',
                    Icons.qr_code_2_rounded,
                    () => openMessageTransitCode(context),
                    2,
                  ),
                  link(
                    '星点钱包',
                    Icons.account_balance_wallet_outlined,
                    () => openMessageWallet(context, _workspace),
                    0,
                  ),
                  link(
                    '券包',
                    Icons.confirmation_number_outlined,
                    () => openMessageCoupons(context, _workspace),
                    3,
                  ),
                ],
              ),
              MessageSectionHeading(
                '通知消息',
                action: TextButton(
                  onPressed: () =>
                      open(() => _notice(MessageNoticeChannel.activity)),
                  child: const UiText('查看互动'),
                ),
              ),
              for (final c in [
                MessageNoticeChannel.orders,
                MessageNoticeChannel.events,
              ])
                ListTile(
                  dense: true,
                  leading: Icon(messageNoticeIcon(c)),
                  title: UiText(messageNoticeTitle(c)),
                  subtitle: UiText(
                    _workspace.notices(c).first.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => open(() => _notice(c)),
                ),
              MessageSectionHeading(
                '常用小应用',
                action: TextButton(
                  onPressed: () => open(_activity),
                  child: const UiText('全部'),
                ),
              ),
              MessageActionGrid(
                columns: 3,
                rowHeight: layout.px(138),
                children: [
                  link(
                    '一起看',
                    Icons.ondemand_video_outlined,
                    () => _activity(activity: MessageActivity.watch),
                    1,
                    avatar: 76,
                  ),
                  link(
                    '一起玩',
                    Icons.extension_outlined,
                    () => _activity(activity: MessageActivity.play),
                    2,
                    avatar: 76,
                  ),
                  link(
                    '一起唱',
                    Icons.mic_none_rounded,
                    () => _activity(activity: MessageActivity.sing),
                    0,
                    avatar: 76,
                  ),
                  link(
                    '一起合拍',
                    Icons.photo_camera_front_outlined,
                    () => _activity(activity: MessageActivity.duet),
                    0,
                    avatar: 76,
                  ),
                  link(
                    '一起攒',
                    Icons.stars_outlined,
                    () => _activity(activity: MessageActivity.exchange),
                    3,
                    avatar: 76,
                  ),
                  link(
                    '日常动态',
                    Icons.auto_awesome_outlined,
                    () => publishMessageStory(context, _workspace),
                    1,
                    avatar: 76,
                  ),
                ],
              ),
              const MessageSectionHeading('常用功能'),
              MessageActionGrid(
                columns: 3,
                rowHeight: layout.px(119),
                children: [
                  for (final (kind, icon) in [
                    (MessageCollection.history, Icons.history_rounded),
                    (MessageCollection.saved, Icons.bookmark_border_rounded),
                    (MessageCollection.later, Icons.watch_later_outlined),
                  ])
                    link(
                      collectionLabel(kind),
                      icon,
                      () => openMessageCollection(context, _workspace, kind),
                      kind.index,
                    ),
                ],
              ),
              ListTile(
                leading: const Icon(Icons.person_add_alt_1_outlined),
                title: const UiText('新增粉丝'),
                onTap: () => open(widget.openFollowers),
              ),
              ListTile(
                leading: const Icon(Icons.person_search_outlined),
                title: const UiText('找用户'),
                onTap: () => open(widget.openFindUser),
              ),
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: const UiText('我的举报'),
                onTap: () => open(widget.openReports),
              ),
              if (widget.openModeration case final moderate?)
                ListTile(
                  leading: const Icon(Icons.fact_check_outlined),
                  title: const UiText('举报处理'),
                  onTap: () => open(moderate),
                ),
            ],
          ),
        );
      },
    ),
  );

  PopupMenuItem<VoidCallback> _menuItem(
    String label,
    IconData icon,
    VoidCallback action,
  ) => PopupMenuItem(
    value: action,
    child: Row(
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: 10),
        Flexible(child: UiText(label)),
      ],
    ),
  );
}
