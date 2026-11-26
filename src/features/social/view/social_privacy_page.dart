import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/theme.dart';
import '../control/social_controller.dart';
import '../model/social.dart';

typedef _Privacy = ({bool discoverable, List<BlockedMember> blocks});

class SocialPrivacyPage extends StatefulWidget {
  const SocialPrivacyPage({super.key, required this.controller});
  final SocialController controller;

  @override
  State<SocialPrivacyPage> createState() => _SocialPrivacyPageState();
}

class _SocialPrivacyPageState extends State<SocialPrivacyPage> {
  late Future<_Privacy> _privacy = widget.controller.privacy();
  bool _saving = false;
  String? _notice;

  Future<void> _change(Future<_Privacy> Function() action) async {
    if (_saving || !widget.controller.isCurrentMember) return;
    setState(() {
      _saving = true;
      _notice = null;
    });
    try {
      final result = await action();
      if (mounted && widget.controller.isCurrentMember)
        setState(() => _privacy = Future.value(result));
    } catch (error) {
      if (mounted)
        setState(() => _notice = describeSocialError(error, '未能保存社交隐私设置，请重试。'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('社交隐私')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: widget.controller.sessionChanges,
        builder: (context, _) {
          if (!widget.controller.isCurrentMember)
            return const Padding(
              padding: jovianPagePadding,
              child: UiText('当前会话已变更。'),
            );
          return FutureBuilder<_Privacy>(
            future: _privacy,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done)
                return const LinearProgressIndicator();
              final state = snapshot.data;
              if (state == null)
                return ListView(
                  padding: jovianPagePadding,
                  children: [
                    const Text('暂时无法加载社交隐私设置。'),
                    TextButton(
                      onPressed: () => setState(
                        () => _privacy = widget.controller.privacy(),
                      ),
                      child: const UiText('重新加载'),
                    ),
                  ],
                );
              return ListView(
                padding: jovianPagePadding,
                children: [
                  Card(
                    child: SwitchListTile(
                      title: const UiText('允许其他用户找到我'),
                      subtitle: const Text(
                        '开启后，其他登录用户可按 UID 找到你。昵称设为公开时，也可按昵称搜索。',
                      ),
                      value: state.discoverable,
                      onChanged: _saving
                          ? null
                          : (value) => _change(
                              () async => (
                                discoverable: await widget.controller
                                    .setDiscoverability(value),
                                blocks: state.blocks,
                              ),
                            ),
                    ),
                  ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Semantics(
                            header: true,
                            child: UiText(
                              '已拉黑用户',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          if (state.blocks.isEmpty)
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: UiText('暂无拉黑用户。'),
                            ),
                          for (final item in state.blocks)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: GestureDetector(
                                onLongPress: item.uid == null
                                    ? null
                                    : () async {
                                        await Clipboard.setData(
                                          ClipboardData(text: item.uid!),
                                        );
                                        if (context.mounted)
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            const SnackBar(
                                              content: Text('UID 已复制'),
                                            ),
                                          );
                                      },
                                child: Text(
                                  item.uid == null
                                      ? '已拉黑用户'
                                      : 'UID ${item.uid}',
                                ),
                              ),
                              trailing: TextButton(
                                onPressed: _saving
                                    ? null
                                    : () => _change(() async {
                                        await widget.controller.unblock(
                                          item.id,
                                        );
                                        return (
                                          discoverable: state.discoverable,
                                          blocks: state.blocks
                                              .where(
                                                (entry) => entry.id != item.id,
                                              )
                                              .toList(),
                                        );
                                      }),
                                child: const UiText('解除拉黑'),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (_notice case final message?)
                    Semantics(liveRegion: true, child: Text(message)),
                ],
              );
            },
          );
        },
      ),
    ),
  );
}
