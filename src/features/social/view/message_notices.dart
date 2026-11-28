import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_workspace_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_design.dart';

String messageNoticeTitle(MessageNoticeChannel channel) => switch (channel) {
  MessageNoticeChannel.activity => '互动消息',
  MessageNoticeChannel.orders => '订单通知',
  MessageNoticeChannel.events => '活动通知',
};

IconData messageNoticeIcon(MessageNoticeChannel channel) => switch (channel) {
  MessageNoticeChannel.activity => Icons.bolt_rounded,
  MessageNoticeChannel.orders => Icons.shopping_bag_outlined,
  MessageNoticeChannel.events => Icons.event_available_outlined,
};

class MessageNoticesPage extends StatelessWidget {
  const MessageNoticesPage({
    super.key,
    required this.workspace,
    required this.channel,
    this.followers,
    this.onOrder,
  });

  final MessageWorkspaceController workspace;
  final MessageNoticeChannel channel;
  final VoidCallback? followers;
  final VoidCallback? onOrder;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: messagePaper,
    appBar: AppBar(
      title: UiText(messageNoticeTitle(channel)),
      backgroundColor: messagePaper,
      actions: [
        if (channel == MessageNoticeChannel.activity && followers != null)
          TextButton(onPressed: followers, child: const UiText('新增粉丝')),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const MessageSectionHeading(
          '演示通知',
          padding: EdgeInsets.only(bottom: 8),
        ),
        for (final notice in workspace.notices(channel)) ...[
          ListTile(
            contentPadding: const EdgeInsets.symmetric(
              vertical: 3,
              horizontal: 5,
            ),
            leading: MessageAvatar(
              name: notice.title,
              icon: messageNoticeIcon(channel),
              size: 42,
              tone: channel.index,
            ),
            title: UiText(notice.title),
            subtitle: UiText(notice.detail),
            trailing: UiText(notice.time, style: const TextStyle(fontSize: 11)),
            onTap: notice.conversation != null
                ? () => Navigator.pop<MessageConversation>(
                    context,
                    workspace.conversation(notice.conversation!),
                  )
                : onOrder,
          ),
          const Divider(color: messageDivider, height: 1),
        ],
      ],
    ),
  );
}
