import 'dart:async';

import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../shared/http/json_client.dart';
import '../../../ui/chat_time_label.dart';
import '../../../ui/interface_language.dart';
import '../control/message_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_activities.dart';
import 'message_attachment_view.dart';
import 'message_chat_actions.dart';
import 'message_components.dart';
import 'message_composer.dart';
import 'message_customization_page.dart';
import 'message_design.dart';
import 'message_service_views.dart';

part 'message_group_sections.dart';

class MessageThreadPage extends StatefulWidget {
  const MessageThreadPage({
    super.key,
    required this.controller,
    required this.thread,
    required this.workspace,
    this.uid,
  });

  final MessageHistory controller;
  final MessageConversation thread;
  final MessageWorkspaceController workspace;
  final String? uid;

  @override
  State<MessageThreadPage> createState() => _MessageThreadPageState();
}

enum _ThreadAction { pin, members, refresh, appearance, companion }

enum _BubbleAction { reply, copy, pin, save }

class _MessageThreadPageState extends State<MessageThreadPage> {
  final _scroll = ScrollController();
  final _temporaryFiles = <Future<void> Function()>[];
  List<ConversationMessage> _messages = [];
  ConversationMessage? _reply;
  String? _next;
  Object? _failure;
  Timer? _poll;
  late bool _pinned = widget.thread.pinned;
  late int? _anchor = widget.thread.matchId;
  late Future<List<ConversationMember>> _groupMembers = _controller
      .conversationMembers(_id);
  _GroupSection _groupSection = _GroupSection.chat;
  bool _showGroupNavigation = true;
  bool _pinning = false;
  bool _viewingOlder = false;
  bool _loading = false;
  bool _loaded = false;
  bool _retryOlder = false;
  bool _visible = false;
  bool _accessLost = false;
  int _messageRevision = 0;
  int _readThrough = 0;

  MessageHistory get _controller => widget.controller;
  String get _id => widget.thread.id;
  bool get _isGroup => widget.thread.kind == ConversationKind.group;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = TickerMode.valuesOf(context).enabled;
    if (_visible == visible) return;
    _visible = visible;
    _poll?.cancel();
    if (visible) {
      if (!_viewingOlder) unawaited(_load());
      _poll = Timer.periodic(const Duration(seconds: 9), (_) {
        if (!_viewingOlder && _anchor == null && !_accessLost) {
          unawaited(_load());
        }
      });
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _scroll.dispose();
    for (final release in _temporaryFiles) {
      unawaited(release());
    }
    super.dispose();
  }

  Future<void> _load({bool older = false}) async {
    if (_loading || !_controller.isCurrentMember || (older && _next == null)) {
      return;
    }
    final anchor = _anchor;
    final before = older
        ? _next
        : anchor == null
        ? null
        : '${anchor + 1}';
    final revision = _messageRevision;
    setState(() {
      _loading = true;
      _failure = null;
      _retryOlder = older;
    });
    try {
      final page = await _controller.messages(_id, before: before);
      if (!mounted || revision != _messageRevision) return;
      setState(() {
        _loaded = true;
        _accessLost = false;
        _next = page.next;
        _messages = older ? [..._messages, ...page.items] : page.items;
        if (older) _viewingOlder = true;
      });
      if (before == null &&
          _visible &&
          _groupSection == _GroupSection.chat &&
          page.items.isNotEmpty) {
        final newest = page.items.first.id;
        if (newest > _readThrough) {
          // A failed read receipt can retry on the next refresh.
          unawaited(_markRead(newest));
        }
      }
    } catch (error) {
      if (!mounted || revision != _messageRevision) return;
      setState(() {
        _failure = error;
        if (error case JsonRequestError(status: 401 || 403 || 404 || 428)) {
          _accessLost = true;
          _messages = [];
          _reply = null;
          _next = null;
          _groupSection = _GroupSection.chat;
        }
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        if (revision != _messageRevision) unawaited(_load());
      }
    }
  }

  Future<void> _markRead(int newest) async {
    try {
      await _controller.markConversationRead(_id, newest);
      if (newest > _readThrough) _readThrough = newest;
    } on JsonRequestError {
      // Retry when refreshing the visible conversation.
    }
  }

  void _toLatest() {
    setState(() {
      _messageRevision++;
      _anchor = null;
      _viewingOlder = false;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    unawaited(_load());
  }

  void _selectGroupSection(_GroupSection section) {
    if (section == _groupSection) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _groupSection = section);
    if (section == _GroupSection.chat && !_viewingOlder) unawaited(_load());
  }

  void _showGroupMessage(int id) {
    setState(() {
      _groupSection = _GroupSection.chat;
      _messageRevision++;
      _anchor = id;
      _viewingOlder = false;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    unawaited(_load());
  }

  Future<void> _send(
    String body,
    String nonce,
    int? replyTo,
    OutgoingMessageAttachment? attachment,
  ) async {
    final sent = await _controller.sendMessage(
      _id,
      body: body,
      nonce: nonce,
      replyTo: replyTo,
      attachment: attachment,
    );
    if (!mounted) return;
    widget.workspace.registerExchange(_id);
    setState(() {
      _reply = null;
      _loaded = true;
      if (_anchor == null) {
        _messages = [
          sent,
          ..._messages.where((message) => message.id != sent.id),
        ];
      } else {
        _messages = [sent];
        _next = null;
      }
    });
    _toLatest();
  }

  Future<void> _changePin() async {
    if (_pinning) return;
    _pinning = true;
    final next = !_pinned;
    try {
      await _controller.pinConversation(_id, next);
      if (mounted) setState(() => _pinned = next);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: UiText(describeSocialError(error, '暂时无法更新置顶状态。'))),
        );
      }
    } finally {
      _pinning = false;
    }
  }

  Future<void> _members() {
    final people = _controller.conversationMembers(_id);
    if (_isGroup) setState(() => _groupMembers = people);
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => FutureBuilder<List<ConversationMember>>(
        future: people,
        builder: (context, snapshot) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            children: [
              UiText('会话成员', style: Theme.of(context).textTheme.titleLarge),
              if (snapshot.hasError)
                MessageStatus(describeSocialError(snapshot.error!, '暂时无法查看成员。'))
              else if (snapshot.data case final members?)
                for (final member in members)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(member.name ?? context.uiLabel('木星环用户')),
                    trailing: member.id == _controller.memberId
                        ? const UiText('我')
                        : null,
                  )
              else
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: LinearProgressIndicator(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _messageActions(ConversationMessage message) async {
    final workspace = widget.workspace;
    final isPinned = workspace
        .groupMessageIds(_id, GroupMessageMark.pinned)
        .contains(message.id);
    final isSaved = workspace
        .groupMessageIds(_id, GroupMessageMark.saved)
        .contains(message.id);
    final action = await showModalBottomSheet<_BubbleAction>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply_rounded),
              title: const UiText('引用回复'),
              onTap: () => Navigator.pop(context, _BubbleAction.reply),
            ),
            if (_isGroup) ...[
              ListTile(
                leading: Icon(
                  isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                ),
                title: UiText(isPinned ? '取消置顶消息' : '置顶消息'),
                onTap: () => Navigator.pop(context, _BubbleAction.pin),
              ),
              ListTile(
                leading: Icon(isSaved ? Icons.bookmark : Icons.bookmark_border),
                title: UiText(isSaved ? '取消收藏消息' : '收藏消息'),
                onTap: () => Navigator.pop(context, _BubbleAction.save),
              ),
            ],
            if (message.body.isNotEmpty)
              ListTile(
                leading: const Icon(Icons.copy_outlined),
                title: const UiText('复制文字'),
                onTap: () => Navigator.pop(context, _BubbleAction.copy),
              ),
          ],
        ),
      ),
    );
    if (!mounted || action == null || _accessLost) return;
    if (action == _BubbleAction.copy) {
      try {
        await Clipboard.setData(ClipboardData(text: message.body));
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: UiText('已复制')));
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: UiText('暂时无法复制文字。')));
      }
    } else if (action == _BubbleAction.reply) {
      setState(() => _reply = message);
    } else {
      workspace.toggleGroupMessage(
        _id,
        message.id,
        action == _BubbleAction.pin
            ? GroupMessageMark.pinned
            : GroupMessageMark.saved,
      );
    }
  }

  void _openAttachment(
    ConversationMessage message,
    MessageAttachment attachment,
  ) {
    if (widget.workspace.isDemo(_id) &&
        attachment.name == messageOrbitVideo.name) {
      widget.workspace.addHistory(attachment.name);
    }
    unawaited(
      showDialog<void>(
        context: context,
        useRootNavigator: false,
        builder: (_) => MessageAttachmentView(
          attachment: attachment,
          load: () => _controller.loadMessageAttachment(_id, message),
          onTemporaryFile: _temporaryFiles.add,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.workspace,
    builder: (context, _) => _build(context),
  );

  Future<void> _companion() => openMessageCompanion(
    context,
    widget.workspace,
    _id,
    conversationName(context, widget.thread),
    openWardrobe: () =>
        openMessageCustomization(context, widget.workspace, thread: _id),
  );

  Widget _build(BuildContext context) {
    final theme = Theme.of(context);
    final background = theme.scaffoldBackgroundColor;
    final colors = theme.colorScheme;
    final layout = MessageLayout.of(context);
    final look = widget.workspace.appearance(_id);
    final chat = chatColors(colors, look.theme);
    final name = conversationName(context, widget.thread);
    final threadAvatar = messageDemoAvatar(_id);
    final streak = widget.workspace.streak(_id);
    final chatSelected = _groupSection == _GroupSection.chat;
    final conversation = _conversation(context, look);
    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        toolbarHeight: _isGroup ? 58 : layout.toolbarHeight,
        leadingWidth: _isGroup ? 48 : layout.px(80),
        backgroundColor: background,
        foregroundColor: colors.onSurface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        titleSpacing: 0,
        title: Row(
          children: [
            MessageAvatar(
              name: name,
              asset: threadAvatar,
              size: _isGroup ? 37 : layout.chatAvatar,
              icon: _isGroup ? Icons.groups_outlined : null,
            ),
            SizedBox(width: _isGroup ? 9 : layout.px(14)),
            Flexible(
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.onSurface,
                  fontSize: _isGroup ? 17 : layout.px(24),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (_isGroup && !_accessLost)
              FutureBuilder<List<ConversationMember>>(
                future: _groupMembers,
                builder: (context, snapshot) {
                  final count = snapshot.data?.length;
                  if (count == null || count == 0)
                    return const SizedBox.shrink();
                  return Container(
                    margin: const EdgeInsetsDirectional.only(start: 6),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Semantics(
                      label: '$count ${context.uiLabel('位成员')}',
                      excludeSemantics: true,
                      child: Text(
                        '$count',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  );
                },
              )
            else if (!_isGroup && streak > 0)
              TextButton(
                onPressed: _companion,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  foregroundColor: chat.accent,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.auto_awesome_rounded, size: 13),
                    const SizedBox(width: 3),
                    Text(
                      '$streak',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: context.uiLabel('发起通话'),
            icon: Icon(
              Icons.call_outlined,
              size: _isGroup ? 23 : layout.px(34),
            ),
            onPressed: _accessLost
                ? null
                : () => openMessageCall(context, name, avatar: threadAvatar),
          ),
          if (_isGroup)
            IconButton.filledTonal(
              tooltip: context.uiLabel(
                _showGroupNavigation ? '收起群聊导航' : '展开群聊导航',
              ),
              style: IconButton.styleFrom(
                backgroundColor: colors.surfaceContainerLow,
                foregroundColor: colors.onSurface,
                visualDensity: VisualDensity.compact,
              ),
              onPressed: () =>
                  setState(() => _showGroupNavigation = !_showGroupNavigation),
              icon: Icon(
                _showGroupNavigation
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
              ),
            )
          else
            PopupMenuButton<_ThreadAction>(
              tooltip: context.uiLabel('会话设置'),
              icon: Icon(Icons.more_horiz_rounded, size: layout.px(34)),
              onSelected: (action) => switch (action) {
                _ThreadAction.pin => _changePin(),
                _ThreadAction.members => _members(),
                _ThreadAction.refresh => _toLatest(),
                _ThreadAction.appearance => openMessageCustomization(
                  context,
                  widget.workspace,
                  thread: _id,
                ),
                _ThreadAction.companion => _companion(),
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: _ThreadAction.pin,
                  enabled: !_accessLost && !_pinning,
                  child: UiText(_pinned ? '取消置顶' : '置顶会话'),
                ),
                const PopupMenuItem(
                  value: _ThreadAction.appearance,
                  child: UiText('聊天装扮'),
                ),
                const PopupMenuItem(
                  value: _ThreadAction.companion,
                  child: UiText('星伴关系'),
                ),
                PopupMenuItem(
                  value: _ThreadAction.members,
                  enabled: !_accessLost,
                  child: const UiText('会话成员'),
                ),
                const PopupMenuItem(
                  value: _ThreadAction.refresh,
                  child: UiText('刷新聊天'),
                ),
              ],
            ),
          SizedBox(width: layout.px(9)),
        ],
      ),
      body: !_isGroup
          ? conversation
          : Column(
              children: [
                if (_showGroupNavigation)
                  _GroupSectionBar(
                    selected: _groupSection,
                    onSelected: _accessLost ? null : _selectGroupSection,
                    accent: chat.accent,
                  ),
                const Divider(height: 1),
                Expanded(
                  child: IndexedStack(
                    index: chatSelected ? 0 : 1,
                    sizing: StackFit.expand,
                    children: [
                      ExcludeFocus(
                        excluding: !chatSelected,
                        child: TickerMode(
                          enabled: chatSelected,
                          child: conversation,
                        ),
                      ),
                      if (!chatSelected) _groupPanel(context),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _conversation(BuildContext context, ChatAppearance look) {
    final theme = Theme.of(context);
    final background = _isGroup
        ? groupChatBackground(theme)
        : theme.scaffoldBackgroundColor;
    final layout = MessageLayout.of(context);
    final isDemo = widget.workspace.isDemo(_id);
    final labels = chatTimeLabels(
      _messages.reversed.map((message) => message.sentAt),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        image: chatWallpaper(background, look.wallpaper),
      ),
      child: LayoutBuilder(
        builder: (context, viewport) => Column(
          children: [
            if (!_isGroup) const Divider(height: 1),
            if (_anchor != null || _viewingOlder)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: TextButton.icon(
                    onPressed: _toLatest,
                    icon: const Icon(Icons.arrow_downward_rounded, size: 17),
                    label: const UiText('回到最新'),
                  ),
                ),
              ),
            Expanded(
              child: _messages.isEmpty
                  ? Center(
                      child: _failure != null
                          ? _retry()
                          : _loaded
                          ? const MessageStatus(
                              '还没有聊天消息。',
                              icon: Icons.chat_bubble_outline,
                            )
                          : const CircularProgressIndicator(),
                    )
                  : Align(
                      alignment: Alignment.topCenter,
                      child: ListView.builder(
                        controller: _scroll,
                        reverse: true,
                        shrinkWrap: true,
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: _isGroup
                            ? const EdgeInsets.fromLTRB(12, 10, 12, 16)
                            : EdgeInsets.fromLTRB(
                                layout.px(20),
                                layout.px(20),
                                layout.px(20),
                                layout.px(16),
                              ),
                        itemCount: _messages.length + 1,
                        itemBuilder: (context, index) {
                          if (index == _messages.length) {
                            if (_failure != null) return _retry();
                            if (_next == null) return const SizedBox.shrink();
                            return Center(
                              child: TextButton(
                                onPressed: _loading
                                    ? null
                                    : () => _load(older: true),
                                child: UiText(_loading ? '正在加载…' : '加载更早的消息'),
                              ),
                            );
                          }
                          final message = _messages[index];
                          final time = labels[_messages.length - 1 - index];
                          final own = message.senderId == _controller.memberId;
                          final continuation =
                              _isGroup &&
                              time == null &&
                              index + 1 < _messages.length &&
                              _messages[index + 1].senderId == message.senderId;
                          return Column(
                            key: ValueKey(message.id),
                            children: [
                              if (time != null) ChatTimeLabel(sentAt: time),
                              _MessageBubble(
                                message: message,
                                own: own,
                                group: _isGroup,
                                continuation: continuation,
                                highlighted: message.id == _anchor,
                                appearance: look,
                                avatarImage: own
                                    ? widget.workspace.avatar
                                    : null,
                                avatarAsset: messageDemoAvatar(
                                  isDemo ? message.senderId : null,
                                ),
                                onActions: () => _messageActions(message),
                                onReply: () => setState(() => _reply = message),
                                onLocation: (place) =>
                                    showLocationMessage(context, place),
                                onInvite: (activity) => openMessageActivity(
                                  context,
                                  widget.workspace,
                                  activity,
                                  canInvite: false,
                                ),
                                openAttachment: (attachment) =>
                                    _openAttachment(message, attachment),
                                loadImage: () => _controller
                                    .loadMessageAttachment(_id, message),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
            ),
            if (!_accessLost)
              MessageComposer(
                workspace: widget.workspace,
                conversation: widget.thread,
                availableHeight: viewport.maxHeight,
                uid: widget.uid,
                reply: _reply,
                onCancelReply: () => setState(() => _reply = null),
                onSend: _send,
              ),
          ],
        ),
      ),
    );
  }

  Widget _groupPanel(BuildContext context) => switch (_groupSection) {
    _GroupSection.announcements => _groupAnnouncements(),
    _GroupSection.pinned => _markedMessages(GroupMessageMark.pinned),
    _GroupSection.saved => _markedMessages(GroupMessageMark.saved),
    _GroupSection.settings => _groupSettings(context),
    _GroupSection.chat => const SizedBox.shrink(),
  };

  Widget _groupAnnouncements() {
    final announcement = _id == 'demo-sky'
        ? '周五晚八点在北岸天台集合。'
        : messageRecommendedGroups
              .where((group) => _id == 'demo-${group.id}')
              .firstOrNull
              ?.description;
    if (announcement == null || !widget.workspace.isDemo(_id)) {
      return const Center(
        child: MessageStatus('暂无群公告。', icon: Icons.campaign_outlined),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            leading: const Icon(Icons.campaign_outlined),
            title: UiText(announcement),
          ),
        ),
      ],
    );
  }

  Widget _markedMessages(GroupMessageMark mark) {
    final pinned = mark == GroupMessageMark.pinned;
    final ids = widget.workspace.groupMessageIds(_id, mark).toList()
      ..sort((a, b) => b.compareTo(a));
    if (ids.isEmpty) {
      return Center(
        child: MessageStatus(
          pinned ? '长按聊天消息，即可置顶到这里。' : '长按聊天消息，即可收藏到这里。',
          icon: pinned ? Icons.push_pin_outlined : Icons.bookmark_border,
        ),
      );
    }
    final loaded = {for (final message in _messages) message.id: message};
    return ListView.separated(
      key: ValueKey(mark),
      padding: const EdgeInsets.all(14),
      itemCount: ids.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final id = ids[index];
        return _GroupMarkedMessage(
          key: ValueKey(id),
          message: loaded[id],
          load: () async {
            final page = await _controller.messages(_id, before: '${id + 1}');
            return page.items.where((message) => message.id == id).firstOrNull;
          },
          pinned: pinned,
          open: () => _showGroupMessage(id),
          remove: () => widget.workspace.toggleGroupMessage(_id, id, mark),
        );
      },
    );
  }

  Widget _groupSettings(BuildContext context) => ListView(
    padding: const EdgeInsets.all(14),
    children: [
      Card(
        margin: EdgeInsets.zero,
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.groups_outlined),
              title: const UiText('会话成员'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: _members,
            ),
            SwitchListTile(
              secondary: const Icon(Icons.push_pin_outlined),
              title: const UiText('置顶会话'),
              value: _pinned,
              onChanged: _pinning ? null : (_) => _changePin(),
            ),
            ListTile(
              leading: const Icon(Icons.palette_outlined),
              title: const UiText('聊天装扮'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => openMessageCustomization(
                context,
                widget.workspace,
                thread: _id,
              ),
            ),
            ListTile(
              leading: const Icon(Icons.auto_awesome_outlined),
              title: const UiText('星伴关系'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: _companion,
            ),
            ListTile(
              leading: const Icon(Icons.refresh_rounded),
              title: const UiText('刷新聊天'),
              onTap: () {
                _selectGroupSection(_GroupSection.chat);
                _toLatest();
              },
            ),
          ],
        ),
      ),
    ],
  );

  Widget _retry() => MessageStatus(
    describeSocialError(_failure!, '暂时无法加载聊天。', missing: '该会话已不可用。'),
    action: TextButton(
      onPressed: _loading
          ? null
          : () => _load(older: _retryOlder && _next != null),
      child: const UiText('重试'),
    ),
  );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.own,
    required this.group,
    required this.continuation,
    required this.highlighted,
    required this.appearance,
    required this.avatarImage,
    required this.avatarAsset,
    required this.onActions,
    required this.onReply,
    required this.onLocation,
    required this.onInvite,
    required this.openAttachment,
    required this.loadImage,
  });

  final ConversationMessage message;
  final bool own;
  final bool group;
  final bool continuation;
  final bool highlighted;
  final ChatAppearance appearance;
  final Uint8List? avatarImage;
  final String? avatarAsset;
  final VoidCallback onActions;
  final VoidCallback onReply;
  final ValueChanged<String> onLocation;
  final ValueChanged<MessageActivity> onInvite;
  final ValueChanged<MessageAttachment> openAttachment;
  final Future<Uint8List> Function() loadImage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final layout = MessageLayout.of(context);
    final chat = chatColors(colors, appearance.theme);
    final groupSymbols = group && message.attachment == null
        ? message.body.characters.take(4).toList()
        : const <String>[];
    final sticker =
        messageStickers.any((entry) => entry.symbol == message.body) ||
        (groupSymbols.isNotEmpty &&
            groupSymbols.length < 4 &&
            groupSymbols.every(
              (symbol) =>
                  messageStickers.any((entry) => entry.symbol == symbol),
            ));
    final note = appearance.bubble == MessageBubbleStyle.note;
    final outline = appearance.bubble == MessageBubbleStyle.outlined;
    final attachment = message.attachment;
    final previewImage = group && attachment?.kind == MessageMediaKind.image;
    final bareImage =
        previewImage && message.body.isEmpty && message.reply == null;
    final place = message.body.startsWith('📍 ')
        ? message.body.substring(3)
        : null;
    final invitation = messageInvitation(message.body);
    final avatarSize = group ? 36.0 : layout.chatAvatar;
    final avatarGap = group ? 9.0 : layout.px(20);
    final sender = message.senderName ?? context.uiLabel('木星环用户');
    final avatar = continuation
        ? SizedBox(width: avatarSize)
        : MessageAvatar(
            name: own ? '我' : sender,
            image: avatarImage,
            asset: avatarAsset,
            size: avatarSize,
          );
    final incoming = group && appearance.theme == MessageTheme.paper
        ? colors.surface
        : chat.incoming;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadiusDirectional.only(
        topStart: Radius.circular(note ? 5 : 15),
        topEnd: Radius.circular(note ? 5 : 15),
        bottomStart: Radius.circular(own && !note ? 15 : 5),
        bottomEnd: Radius.circular(!own && !note ? 15 : 5),
      ),
      side: BorderSide(
        color: highlighted || outline
            ? chat.accent
            : sticker
            ? Colors.transparent
            : colors.outlineVariant.withValues(alpha: group ? .68 : 1),
      ),
    );
    final padding = group
        ? (bareImage || sticker
              ? EdgeInsets.all(sticker ? 2 : 4)
              : const EdgeInsets.symmetric(horizontal: 12, vertical: 9))
        : EdgeInsets.symmetric(
            horizontal: layout.px(18),
            vertical: layout.px(13),
          );
    final bubble = Material(
      color: sticker
          ? Colors.transparent
          : own
          ? chat.outgoing
          : incoming,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: place != null
            ? () => onLocation(place)
            : invitation != null
            ? () => onInvite(invitation)
            : previewImage
            ? () => openAttachment(attachment!)
            : attachment == null
            ? onActions
            : null,
        onLongPress: onActions,
        onSecondaryTap: onActions,
        child: Semantics(
          customSemanticsActions: {
            CustomSemanticsAction(label: context.uiLabel('消息操作')): onActions,
          },
          child: Padding(
            padding: padding,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (message.reply case final quote?)
                  Container(
                    margin: const EdgeInsets.only(bottom: 7),
                    padding: const EdgeInsetsDirectional.only(start: 8),
                    decoration: BoxDecoration(
                      border: BorderDirectional(
                        start: BorderSide(color: colors.outline, width: 2),
                      ),
                    ),
                    child: Text(
                      '${quote.name ?? context.uiLabel('木星环用户')} · '
                      '${messageSnippet(context, quote.body, quote.kind)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: own
                            ? colors.onSecondaryContainer
                            : colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                if (message.body.isNotEmpty)
                  Text(
                    message.body,
                    textScaler: sticker ? TextScaler.noScaling : null,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.onSurface,
                      fontSize: sticker
                          ? layout.px(groupSymbols.length > 1 ? 62 : 122)
                          : group
                          ? 15
                          : layout.px(22),
                      height: sticker ? 1.1 : null,
                      fontFamily: sticker ? messageEmojiFamily : null,
                      fontFamilyFallback: [
                        messageEmojiFamily,
                        ...?theme.textTheme.bodyMedium?.fontFamilyFallback,
                      ],
                    ),
                  ),
                if (attachment != null)
                  if (previewImage)
                    _GroupImagePreview(
                      name: attachment.name,
                      size: layout.px(220).clamp(118.0, 176.0),
                      load: loadImage,
                    )
                  else
                    _attachmentTile(context, attachment),
              ],
            ),
          ),
        ),
      ),
    );
    final showReply = group && !own && sticker;
    return LayoutBuilder(
      builder: (context, box) => Align(
        alignment: own
            ? AlignmentDirectional.centerEnd
            : AlignmentDirectional.centerStart,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: box.maxWidth * (group ? .92 : .84),
          ),
          child: Padding(
            padding: group
                ? EdgeInsets.only(top: continuation ? 2 : 9, bottom: 2)
                : EdgeInsets.symmetric(vertical: layout.px(6)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: group
                  ? CrossAxisAlignment.start
                  : CrossAxisAlignment.end,
              children: [
                if (!own) ...[avatar, SizedBox(width: avatarGap)],
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: own
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      if (group && !own && !continuation)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            start: 2,
                            bottom: 4,
                          ),
                          child: Text(
                            sender,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      if (showReply)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(child: bubble),
                            const SizedBox(width: 8),
                            if (MediaQuery.textScalerOf(context).scale(13) >
                                    19 ||
                                box.maxWidth < 280)
                              IconButton.filledTonal(
                                tooltip: context.uiLabel('回复'),
                                onPressed: onReply,
                                icon: const Icon(Icons.reply_rounded, size: 17),
                              )
                            else
                              TextButton.icon(
                                onPressed: onReply,
                                style: TextButton.styleFrom(
                                  backgroundColor: colors.surface,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                  ),
                                ),
                                icon: const Icon(Icons.reply_rounded, size: 16),
                                label: const UiText('回复'),
                              ),
                          ],
                        )
                      else
                        bubble,
                    ],
                  ),
                ),
                if (own) ...[SizedBox(width: avatarGap), avatar],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _attachmentTile(BuildContext context, MessageAttachment attachment) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => openAttachment(attachment),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              mediaIcon(attachment.kind),
              color: theme.colorScheme.primary,
              size: 23,
            ),
            const SizedBox(width: 9),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    attachment.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelLarge,
                  ),
                  Text(
                    '${context.uiLabel(mediaLabel(attachment.kind))} · ${messageSize(attachment.size)}',
                    style: theme.textTheme.labelSmall,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, size: 18),
          ],
        ),
      ),
    );
  }
}
