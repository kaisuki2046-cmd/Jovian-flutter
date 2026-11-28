import 'package:material_ui/material_ui.dart';

import '../../../ui/chat_time_label.dart';
import '../../../ui/interface_language.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_design.dart';

String conversationName(BuildContext context, MessageConversation thread) =>
    thread.title ??
    context.uiLabel(thread.kind == ConversationKind.group ? '群聊' : '木星环用户');

String mediaLabel(MessageMediaKind kind) => switch (kind) {
  MessageMediaKind.image => '图片',
  MessageMediaKind.audio => '语音',
  MessageMediaKind.video => '视频',
  MessageMediaKind.file => '文件',
};

IconData mediaIcon(MessageMediaKind kind) => switch (kind) {
  MessageMediaKind.image => Icons.photo_outlined,
  MessageMediaKind.audio => Icons.graphic_eq_rounded,
  MessageMediaKind.video => Icons.play_circle_outline_rounded,
  MessageMediaKind.file => Icons.description_outlined,
};

String messageSnippet(
  BuildContext context,
  String? text,
  MessageMediaKind? media,
) {
  if (text != null && messageStickers.any((item) => item.symbol == text)) {
    return '[${context.uiLabel('贴纸')}]';
  }
  if (text != null && text.isNotEmpty) return text;
  if (media != null) return '[${context.uiLabel(mediaLabel(media))}]';
  return context.uiLabel('暂无消息');
}

class MessageConversationRow extends StatelessWidget {
  const MessageConversationRow({
    super.key,
    required this.thread,
    required this.onTap,
    this.searchResult = false,
    this.streak = 0,
  });

  final MessageConversation thread;
  final VoidCallback onTap;
  final bool searchResult;
  final int streak;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final name = conversationName(context, thread);
    final layout = MessageLayout.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: layout.px(24),
          vertical: (layout.listRowHeight - layout.listAvatar) / 2,
        ),
        child: Row(
          children: [
            MessageAvatar(
              name: name,
              asset: messageDemoAvatar(thread.id),
              size: layout.listAvatar,
              icon: thread.kind == ConversationKind.group
                  ? Icons.groups_outlined
                  : null,
            ),
            SizedBox(width: layout.px(20)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (thread.pinned) ...[
                        Icon(
                          Icons.push_pin_outlined,
                          size: 16,
                          color: colors.onSurfaceVariant,
                        ),
                        const SizedBox(width: 6),
                      ],
                      Flexible(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: colors.onSurface,
                            fontSize: layout.px(24),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (streak > 0) ...[
                        const SizedBox(width: 6),
                        Icon(
                          Icons.auto_awesome_rounded,
                          size: 12,
                          color: colors.primary,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          '$streak',
                          style: TextStyle(
                            color: colors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                  SizedBox(height: layout.px(4)),
                  Text(
                    messageSnippet(
                      context,
                      searchResult
                          ? thread.matchText ?? thread.preview
                          : thread.preview,
                      thread.previewKind,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
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
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  formatChatTime(
                    thread.updatedAt,
                    DateTime.now(),
                    context.uiLanguage,
                  ),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colors.onSurfaceVariant,
                    fontSize: layout.px(16),
                  ),
                ),
                if (thread.unread > 0) ...[
                  const SizedBox(height: 3),
                  Semantics(
                    label: '${thread.unread} ${context.uiLabel('条未读')}',
                    excludeSemantics: true,
                    child: Badge.count(
                      count: thread.unread,
                      largeSize: layout.px(26),
                      backgroundColor: colors.primary,
                      textColor: colors.onPrimary,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class MessageStatus extends StatelessWidget {
  const MessageStatus(this.message, {super.key, this.icon, this.action});

  final String message;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 27, color: colors.onSurfaceVariant),
            const SizedBox(height: 9),
          ],
          UiText(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
          ),
          if (action != null) ...[const SizedBox(height: 10), action!],
        ],
      ),
    );
  }
}
