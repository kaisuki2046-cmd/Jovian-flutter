import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_experience_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import 'message_design.dart';
import 'message_sticker_panel.dart';

Future<void> openMessageCustomization(
  BuildContext context,
  MessageWorkspaceController workspace, {
  String thread = 'default',
}) => Navigator.of(context).push<void>(
  MaterialPageRoute(
    builder: (_) =>
        MessageCustomizationPage(workspace: workspace, thread: thread),
  ),
);

class MessageCustomizationPage extends StatelessWidget {
  const MessageCustomizationPage({
    super.key,
    required this.workspace,
    required this.thread,
  });

  final MessageWorkspaceController workspace;
  final String thread;

  Future<void> _selectImage(
    BuildContext context, {
    required bool avatar,
  }) async {
    try {
      final image = await pickMessageImage(avatar ? 256 : 900);
      if (!context.mounted || image == null) return;
      if (avatar) {
        workspace.setAvatar(image);
      } else {
        final appearance = workspace.appearance(thread);
        workspace.setAppearance(
          thread,
          ChatAppearance(
            theme: appearance.theme,
            bubble: appearance.bubble,
            wallpaper: image,
          ),
        );
      }
    } catch (error) {
      if (context.mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: UiText(describeSocialError(error, '图片载入失败。'))),
        );
    }
  }

  void _inventory(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => SafeArea(
        child: ListenableBuilder(
          listenable: workspace,
          builder: (context, _) {
            final appearance = workspace.appearance(thread);
            return ListView(
              shrinkWrap: true,
              children: [
                const MessageSectionHeading('我的背包'),
                ListTile(
                  leading: const Icon(Icons.color_lens_outlined),
                  title: const UiText('已应用主题'),
                  subtitle: UiText(messageThemeName(appearance.theme)),
                ),
                ListTile(
                  leading: const Icon(Icons.chat_bubble_outline),
                  title: const UiText('已应用气泡'),
                  subtitle: UiText(bubbleName(appearance.bubble)),
                ),
                ListTile(
                  leading: const Icon(Icons.auto_awesome_outlined),
                  title: const UiText('当前星伴'),
                  subtitle: UiText(workspace.companion),
                ),
                ListTile(
                  leading: const Icon(Icons.local_activity_outlined),
                  title: const UiText('主题兑换券'),
                  subtitle: Text(workspace.coupons.length.toString()),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final layout = MessageLayout.of(context);
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: layout.toolbarHeight,
          title: const UiText('消息装扮'),
          actions: [
            TextButton.icon(
              onPressed: () => _inventory(context),
              icon: const Icon(Icons.backpack_outlined, size: 19),
              label: const UiText('背包'),
            ),
            const SizedBox(width: 6),
          ],
          bottom: TabBar(
            tabs: [
              for (final title in ['推荐', '气泡', '贴纸', '星伴'])
                Tab(height: layout.px(68), child: UiText(title)),
            ],
          ),
        ),
        body: ListenableBuilder(
          listenable: workspace,
          builder: (context, _) {
            final appearance = workspace.appearance(thread);
            return TabBarView(
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _preview(context, appearance),
                    const SizedBox(height: 14),
                    RadioGroup<MessageTheme>(
                      groupValue: appearance.theme,
                      onChanged: (value) => workspace.setAppearance(
                        thread,
                        ChatAppearance(
                          theme: value!,
                          bubble: appearance.bubble,
                          wallpaper: appearance.wallpaper,
                        ),
                      ),
                      child: Column(
                        children: [
                          for (final option in MessageTheme.values)
                            RadioListTile<MessageTheme>(
                              title: UiText(messageThemeName(option)),
                              value: option,
                              secondary: CircleAvatar(
                                backgroundColor: chatColors(
                                  Theme.of(context).colorScheme,
                                  option,
                                ).outgoing,
                                radius: 13,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const Divider(),
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                      leading: MessageAvatar(
                        name: '我',
                        image: workspace.avatar,
                        asset: messageSelfAvatar,
                        size: 40,
                      ),
                      title: const UiText('自定义头像'),
                      onTap: () => _selectImage(context, avatar: true),
                      trailing: workspace.avatar == null
                          ? const Icon(Icons.add_photo_alternate_outlined)
                          : IconButton(
                              tooltip: context.uiLabel('移除头像'),
                              onPressed: () => workspace.setAvatar(null),
                              icon: const Icon(Icons.close_rounded),
                            ),
                    ),
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                      leading: const MessageAvatar(
                        name: '背景',
                        icon: Icons.wallpaper_rounded,
                        size: 40,
                      ),
                      title: const UiText('聊天背景'),
                      onTap: () => _selectImage(context, avatar: false),
                      trailing: appearance.wallpaper == null
                          ? const Icon(Icons.add_photo_alternate_outlined)
                          : IconButton(
                              tooltip: context.uiLabel('移除背景'),
                              onPressed: () => workspace.setAppearance(
                                thread,
                                ChatAppearance(
                                  theme: appearance.theme,
                                  bubble: appearance.bubble,
                                ),
                              ),
                              icon: const Icon(Icons.close_rounded),
                            ),
                    ),
                  ],
                ),
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _preview(context, appearance),
                    const SizedBox(height: 14),
                    RadioGroup<MessageBubbleStyle>(
                      groupValue: appearance.bubble,
                      onChanged: (value) => workspace.setAppearance(
                        thread,
                        ChatAppearance(
                          theme: appearance.theme,
                          bubble: value!,
                          wallpaper: appearance.wallpaper,
                        ),
                      ),
                      child: Column(
                        children: [
                          for (final option in MessageBubbleStyle.values)
                            RadioListTile<MessageBubbleStyle>(
                              title: UiText(bubbleName(option)),
                              value: option,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                ListView(
                  children: [
                    const MessageSectionHeading('贴纸收藏'),
                    MessageStickerPanel(workspace: workspace),
                  ],
                ),
                RadioGroup<String>(
                  groupValue: workspace.companion,
                  onChanged: (value) => workspace.dress(value!),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final (name, emoji) in [
                        ('月芽', '🌙'),
                        ('暮光', '✨'),
                        ('苔月', '🌱'),
                      ])
                        RadioListTile<String>(
                          value: name,
                          title: UiText(name),
                          secondary: Text(
                            emoji,
                            style: const TextStyle(fontSize: 28),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _preview(BuildContext context, ChatAppearance look) {
    final theme = Theme.of(context);
    final background = theme.scaffoldBackgroundColor;
    final colors = chatColors(theme.colorScheme, look.theme);
    final layout = MessageLayout.of(context);
    final radius = BorderRadius.circular(
      look.bubble == MessageBubbleStyle.note ? 5 : 16,
    );
    Widget sample(String text, Color fill, Alignment align) => Align(
      alignment: align,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: radius,
          border: look.bubble == MessageBubbleStyle.outlined
              ? Border.all(color: colors.accent)
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 12),
          child: UiText(text),
        ),
      ),
    );
    return Container(
      constraints: BoxConstraints(minHeight: layout.px(296)),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        image: chatWallpaper(background, look.wallpaper),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          sample('今天一起看月亮吗？', colors.incoming, Alignment.centerLeft),
          const SizedBox(height: 10),
          sample('好呀，天台见。', colors.outgoing, Alignment.centerRight),
        ],
      ),
    );
  }
}
