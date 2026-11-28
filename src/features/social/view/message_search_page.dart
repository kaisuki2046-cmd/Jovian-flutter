import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/social_controller.dart';
import '../model/social.dart';
import 'message_components.dart';

enum MessageSearchMode { search, direct, group }

class MessageSearchPage extends StatefulWidget {
  const MessageSearchPage({
    super.key,
    required this.controller,
    required this.mode,
  });

  final SocialController controller;
  final MessageSearchMode mode;

  @override
  State<MessageSearchPage> createState() => _MessageSearchPageState();
}

class _MessageSearchPageState extends State<MessageSearchPage> {
  final _query = TextEditingController();
  final _title = TextEditingController();
  final _selected = <String, SocialProfile>{};
  List<SocialProfile> _contacts = const [];
  List<MessageConversation> _threads = const [];
  String? _next;
  String? _message;
  String? _groupNonce;
  bool _searched = false;
  bool _searching = false;
  bool _creating = false;
  int _searchRevision = 0;

  bool get _group => widget.mode == MessageSearchMode.group;
  bool get _searchMessages => widget.mode == MessageSearchMode.search;
  bool get _hasResults => _contacts.isNotEmpty || _threads.isNotEmpty;

  @override
  void dispose() {
    _query.dispose();
    _title.dispose();
    super.dispose();
  }

  void _queryChanged(String _) {
    setState(() {
      _searchRevision++;
      _searching = false;
      _searched = false;
      _message = null;
      _contacts = const [];
      _threads = const [];
      _next = null;
    });
  }

  Future<void> _search({bool more = false}) async {
    final query = _query.text.trim();
    if (_searching || _creating || query.isEmpty) return;
    if (!more) FocusScope.of(context).unfocus();
    final revision = ++_searchRevision;
    setState(() {
      _searching = true;
      _message = null;
    });
    try {
      final (threads, contacts) = await (
        _searchMessages
            ? widget.controller.searchConversations(
                query,
                before: more ? _next : null,
              )
            : Future.value(
                const SocialResultPage<MessageConversation>([], null),
              ),
        more || (_searchMessages && query.runes.length > 40)
            ? Future.value(_contacts)
            : widget.controller.findChatContacts(query),
      ).wait;
      if (!mounted ||
          revision != _searchRevision ||
          !widget.controller.isCurrentMember)
        return;
      setState(() {
        _threads = more ? [..._threads, ...threads.items] : threads.items;
        _contacts = contacts;
        _next = threads.next;
        _searched = true;
      });
    } catch (failure) {
      if (mounted && revision == _searchRevision) {
        setState(() => _message = describeSocialError(failure, '搜索暂时不可用，请重试。'));
      }
    } finally {
      if (mounted && revision == _searchRevision)
        setState(() => _searching = false);
    }
  }

  Future<void> _create(Future<MessageConversation> Function() open) async {
    if (_creating || !widget.controller.isCurrentMember) return;
    setState(() {
      _creating = true;
      _message = null;
    });
    try {
      final thread = await open();
      if (mounted && widget.controller.isCurrentMember)
        Navigator.pop(context, thread);
    } catch (failure) {
      if (mounted) {
        setState(
          () => _message = describeSocialError(
            failure,
            '暂时无法发起会话，请重试。',
            missing: '对方当前无法接收新会话。',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  void _select(SocialProfile profile) {
    if (_creating) return;
    if (!_group) {
      _create(() => widget.controller.openDirectChat(profile));
      return;
    }
    setState(() {
      _groupNonce = null;
      if (_selected.containsKey(profile.id)) {
        _selected.remove(profile.id);
      } else if (_selected.length < 19) {
        _selected[profile.id] = profile;
      }
    });
  }

  String _name(BuildContext context, SocialProfile profile) =>
      profile.displayName ?? context.uiLabel('木星环用户');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = switch (widget.mode) {
      MessageSearchMode.search => '搜索消息',
      MessageSearchMode.direct => '新建私聊',
      MessageSearchMode.group => '发起群聊',
    };
    return Scaffold(
      appBar: AppBar(title: UiText(title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          if (_group) ...[
            TextField(
              controller: _title,
              enabled: !_creating,
              maxLength: 48,
              onChanged: (_) => setState(() => _groupNonce = null),
              decoration: InputDecoration(labelText: context.uiLabel('群聊名称')),
            ),
            if (_selected.isNotEmpty) ...[
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  for (final profile in _selected.values)
                    InputChip(
                      label: Text(_name(context, profile)),
                      onDeleted: _creating ? null : () => _select(profile),
                    ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ],
          TextField(
            controller: _query,
            enabled: !_creating,
            maxLength: _searchMessages ? 80 : 45,
            textInputAction: TextInputAction.search,
            onChanged: _queryChanged,
            onSubmitted: (_) => _search(),
            decoration: InputDecoration(
              counterText: '',
              labelText: context.uiLabel(
                _searchMessages ? '搜索用户、群聊或消息' : '输入 UID 或昵称',
              ),
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: IconButton(
                tooltip: context.uiLabel('搜索'),
                onPressed: _creating || _searching || _query.text.trim().isEmpty
                    ? null
                    : _search,
                icon: const Icon(Icons.arrow_forward_rounded),
              ),
            ),
          ),
          if (_searching || _creating) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (_message != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(
                liveRegion: true,
                child: UiText(
                  _message!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            ),
          if (_searched && !_searching && !_hasResults)
            const MessageStatus('没有找到匹配的结果。', icon: Icons.search_off_rounded),
          if (_threads.isNotEmpty) ...[
            const SizedBox(height: 18),
            UiText('会话与聊天记录', style: theme.textTheme.titleMedium),
            for (final thread in _threads)
              MessageConversationRow(
                thread: thread,
                searchResult: true,
                onTap: () => Navigator.pop(context, thread),
              ),
            if (_next != null)
              TextButton(
                onPressed: _searching ? null : () => _search(more: true),
                child: const UiText('加载更多'),
              ),
          ],
          if (_contacts.isNotEmpty) ...[
            const SizedBox(height: 18),
            UiText('用户', style: theme.textTheme.titleMedium),
            for (final person in _contacts)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_name(context, person)),
                subtitle: person.uid == null ? null : Text('UID ${person.uid}'),
                trailing: _group
                    ? Checkbox(
                        value: _selected.containsKey(person.id),
                        onChanged: _creating ? null : (_) => _select(person),
                      )
                    : TextButton(
                        onPressed: _creating ? null : () => _select(person),
                        child: const UiText('发消息'),
                      ),
                onTap: _creating ? null : () => _select(person),
              ),
          ],
        ],
      ),
      bottomNavigationBar: _group
          ? SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: FilledButton(
                onPressed:
                    _creating ||
                        _selected.length < 2 ||
                        _title.text.trim().isEmpty
                    ? null
                    : () {
                        final nonce = _groupNonce ??= newMessageNonce();
                        _create(
                          () => widget.controller.createGroup(
                            _title.text,
                            _selected.keys.toList(),
                            nonce,
                          ),
                        );
                      },
                child: const UiText('创建群聊'),
              ),
            )
          : null,
    );
  }
}
