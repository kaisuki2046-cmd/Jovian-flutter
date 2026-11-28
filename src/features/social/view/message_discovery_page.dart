import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_components.dart';
import 'message_design.dart';
import 'message_search_page.dart';

enum MessageDiscoveryMode { search, group, friend, companion }

class MessageDiscoveryPage extends StatefulWidget {
  const MessageDiscoveryPage({
    super.key,
    required this.workspace,
    this.controller,
    required this.mode,
    this.openAccount,
  });

  final MessageWorkspaceController workspace;
  final SocialController? controller;
  final MessageDiscoveryMode mode;
  final VoidCallback? openAccount;

  @override
  State<MessageDiscoveryPage> createState() => _MessageDiscoveryPageState();
}

class _MessageDiscoveryPageState extends State<MessageDiscoveryPage> {
  final _query = TextEditingController();
  final _name = TextEditingController();
  final _members = <String>{};
  List<MessageConversation> _real = [];
  List<SocialProfile> _people = [];
  bool _fullGroups = false;
  bool _searching = false;
  bool _searched = false;
  String? _error;
  int _revision = 0;

  bool get _group => widget.mode == MessageDiscoveryMode.group;
  bool get _friend => widget.mode == MessageDiscoveryMode.friend;
  bool get _companion => widget.mode == MessageDiscoveryMode.companion;

  @override
  void dispose() {
    _query.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _query.text.trim();
    final controller = widget.controller;
    if (query.isEmpty) return;
    FocusScope.of(context).unfocus();
    if (controller == null) {
      setState(() => _searched = true);
      return;
    }
    final revision = ++_revision;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final (page, people) = await (
        _friend
            ? Future.value(
                const SocialResultPage<MessageConversation>([], null),
              )
            : controller.searchConversations(query),
        query.runes.length > 40
            ? Future.value(<SocialProfile>[])
            : controller.findChatContacts(query),
      ).wait;
      if (!mounted || revision != _revision) return;
      setState(() {
        _real = page.items;
        _people = people;
        _searched = true;
      });
    } catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = describeSocialError(error, '搜索暂时不可用，请重试。'));
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _searching = false);
    }
  }

  Future<void> _openContact(SocialProfile person) async {
    final controller = widget.controller;
    if (controller == null || _searching) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final thread = await controller.openDirectChat(person);
      if (mounted) Navigator.pop(context, thread);
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '暂时无法发起会话，请重试。'));
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _follow(SocialProfile person) async {
    final controller = widget.controller;
    if (controller == null || _searching) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final updated = await controller.toggleFollow(person);
      if (mounted)
        setState(
          () => _people = _people
              .map((p) => p.id == updated.id ? updated : p)
              .toList(),
        );
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '关注操作失败，请重试。'));
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _createRealGroup() async {
    final controller = widget.controller;
    if (controller == null) {
      widget.openAccount?.call();
      return;
    }
    final thread = await Navigator.of(context).push<MessageConversation>(
      MaterialPageRoute(
        builder: (_) => MessageSearchPage(
          controller: controller,
          mode: MessageSearchMode.group,
        ),
      ),
    );
    if (mounted && thread != null) Navigator.pop(context, thread);
  }

  Future<void> _join(MessageExperienceGroup group) async {
    final joined = await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: UiText(group.name),
        content: UiText(group.description),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const UiText('加入演示群聊'),
          ),
        ],
      ),
    );
    if (mounted && joined == true)
      Navigator.pop(context, widget.workspace.join(group));
  }

  @override
  Widget build(BuildContext context) {
    final layout = MessageLayout.of(context);
    final theme = Theme.of(context);
    final pageTitle = switch (widget.mode) {
      MessageDiscoveryMode.search => '搜索消息',
      MessageDiscoveryMode.group => '发起群聊',
      MessageDiscoveryMode.friend => '添加好友',
      MessageDiscoveryMode.companion => '建立星伴关系',
    };
    Widget result({
      required String title,
      String? subtitle,
      required MessageAvatar leading,
      required Widget trailing,
      VoidCallback? onTap,
    }) => ListTile(
      contentPadding: EdgeInsets.zero,
      minLeadingWidth: 0,
      minTileHeight: layout.listRowHeight,
      horizontalTitleGap: layout.px(20),
      leading: leading,
      titleTextStyle: theme.textTheme.titleMedium?.copyWith(
        fontSize: layout.px(24),
      ),
      subtitleTextStyle: theme.textTheme.bodySmall?.copyWith(
        fontSize: layout.px(20),
      ),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: subtitle == null
          ? null
          : Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: trailing,
      onTap: onTap,
    );
    final actionStyle = TextButton.styleFrom(
      padding: EdgeInsets.symmetric(horizontal: layout.px(12)),
      minimumSize: Size(layout.px(104), layout.px(40)),
      textStyle: TextStyle(fontSize: layout.px(19)),
    );
    final searchIconSize = layout.px(30);
    final searchIconConstraints = BoxConstraints.tightFor(
      width: layout.px(62),
      height: layout.px(52),
    );
    return Scaffold(
      backgroundColor: messagePaper,
      appBar: AppBar(
        title: UiText(pageTitle),
        toolbarHeight: layout.toolbarHeight,
        backgroundColor: messagePaper,
      ),
      body: ListenableBuilder(
        listenable: widget.workspace,
        builder: (context, _) {
          final workspace = widget.workspace;
          final query = _query.text.trim();
          final demos = workspace
              .search(query)
              .where(
                (thread) =>
                    !_group && !_friend && !_companion ||
                    thread.kind == ConversationKind.direct,
              )
              .toList();
          return ListView(
            padding: EdgeInsets.fromLTRB(
              layout.px(24),
              layout.px(12),
              layout.px(24),
              layout.px(32),
            ),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              if (_group)
                TextField(
                  controller: _name,
                  maxLength: 48,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: context.uiLabel('群聊名称'),
                    prefixIcon: const Icon(Icons.groups_outlined),
                  ),
                ),
              TextField(
                controller: _query,
                maxLength: 80,
                textInputAction: TextInputAction.search,
                onChanged: (_) => setState(() {
                  _revision++;
                  _searching = false;
                  _searched = false;
                  _real = [];
                  _people = [];
                  _error = null;
                }),
                onSubmitted: (_) => _search(),
                decoration: InputDecoration(
                  counterText: '',
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: layout.px(10)),
                  hintText: context.uiLabel(
                    _friend ? '输入 UID 或昵称' : '搜索用户、群聊或消息',
                  ),
                  prefixIconConstraints: searchIconConstraints,
                  suffixIconConstraints: searchIconConstraints,
                  prefixIcon: Icon(Icons.search_rounded, size: searchIconSize),
                  suffixIcon: IconButton(
                    tooltip: context.uiLabel('搜索'),
                    onPressed: query.isEmpty || _searching ? null : _search,
                    icon: Icon(
                      Icons.arrow_forward_rounded,
                      size: searchIconSize,
                    ),
                  ),
                ),
              ),
              if (_searching) const LinearProgressIndicator(),
              if (_error case final error?)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: UiText(
                    error,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (!_group && !_friend && !_companion && query.isEmpty) ...[
                MessageSectionHeading(
                  '推荐群聊',
                  padding: const EdgeInsets.only(top: 12),
                  action: TextButton(
                    onPressed: () => setState(() => _fullGroups = !_fullGroups),
                    child: UiText(_fullGroups ? '收起' : '更多群聊'),
                  ),
                ),
                for (final group in messageRecommendedGroups.take(
                  _fullGroups ? 4 : 3,
                ))
                  result(
                    leading: MessageAvatar(
                      name: group.name,
                      tone: group.tone,
                      icon: Icons.groups_outlined,
                      size: layout.listAvatar,
                    ),
                    title: '${group.name} · ${group.members}',
                    subtitle: context.uiLabel(group.description),
                    trailing: TextButton(
                      style: actionStyle,
                      onPressed: () => _join(group),
                      child: UiText(
                        workspace.isDemo('demo-${group.id}') ? '打开' : '申请加入',
                      ),
                    ),
                    onTap: () => _join(group),
                  ),
              ],
              if (_real.isNotEmpty) ...[
                const MessageSectionHeading(
                  '账号会话',
                  padding: EdgeInsets.only(top: 15, bottom: 6),
                ),
                for (final thread in _real)
                  MessageConversationRow(
                    thread: thread,
                    searchResult: true,
                    onTap: () => Navigator.pop(context, thread),
                  ),
              ],
              if (_people.isNotEmpty) ...[
                const MessageSectionHeading(
                  '用户',
                  padding: EdgeInsets.only(top: 15, bottom: 6),
                ),
                for (final person in _people)
                  result(
                    leading: MessageAvatar(
                      name: person.displayName ?? '·',
                      size: layout.listAvatar,
                    ),
                    title: person.displayName ?? 'UID ${person.uid}',
                    subtitle: person.uid == null ? null : 'UID ${person.uid}',
                    trailing: TextButton(
                      style: actionStyle,
                      onPressed: _searching
                          ? null
                          : _friend
                          ? () => _follow(person)
                          : () => _openContact(person),
                      child: UiText(
                        _friend
                            ? person.relation.follows
                                  ? '已关注'
                                  : '关注'
                            : '发私信',
                      ),
                    ),
                  ),
              ],
              if (demos.isNotEmpty) ...[
                MessageSectionHeading(
                  _group ? '选择演示群成员' : '演示聊天',
                  padding: const EdgeInsets.only(top: 14, bottom: 6),
                ),
                for (final thread in demos)
                  result(
                    leading: MessageAvatar(
                      name: thread.title ?? '·',
                      asset: messageDemoAvatar(thread.id),
                      size: layout.listAvatar,
                      icon: thread.kind == ConversationKind.group
                          ? Icons.groups_outlined
                          : null,
                    ),
                    title: thread.title ?? '',
                    subtitle: messageSnippet(
                      context,
                      thread.matchText ?? thread.preview,
                      thread.previewKind,
                    ),
                    trailing: _group
                        ? Checkbox(
                            value: _members.contains(thread.title),
                            onChanged: (_) => _toggle(thread),
                          )
                        : TextButton(
                            style: actionStyle,
                            onPressed: () => _choose(thread),
                            child: UiText(
                              _friend && !workspace.isFriend(thread.id)
                                  ? '添加'
                                  : _companion &&
                                        workspace.streak(thread.id) == 0
                                  ? '建立关系'
                                  : '发私信',
                            ),
                          ),
                    onTap: () => _choose(thread),
                  ),
              ] else if (query.isNotEmpty &&
                  (_searched || widget.controller == null) &&
                  _real.isEmpty &&
                  _people.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: UiText('没有找到匹配的结果。'),
                ),
              if (_group) ...[
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _members.length < 2 || _name.text.trim().isEmpty
                      ? null
                      : () => Navigator.pop(
                          context,
                          workspace.createGroup(_name.text, _members.toList()),
                        ),
                  child: const UiText('创建演示群聊'),
                ),
                if (widget.controller != null || widget.openAccount != null)
                  TextButton(
                    onPressed: _createRealGroup,
                    child: const UiText('使用账号创建群聊'),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }

  void _toggle(MessageConversation thread) {
    final name = thread.title;
    if (name != null)
      setState(() {
        if (!_members.remove(name)) _members.add(name);
      });
  }

  void _choose(MessageConversation thread) {
    if (_group) {
      _toggle(thread);
      return;
    }
    if (_friend && !widget.workspace.isFriend(thread.id)) {
      widget.workspace.addFriend(thread.id);
      return;
    }
    if (_companion) widget.workspace.connect(thread.id);
    Navigator.pop(context, thread);
  }
}
