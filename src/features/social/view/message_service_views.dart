import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../ui/interface_language.dart';
import '../control/message_workspace_controller.dart';
import '../model/message_experience.dart';
import 'message_attachment_view.dart';
import 'message_design.dart';

Future<void> openMessageService(
  BuildContext context,
  String title,
  Widget child,
) => Navigator.of(context).push<void>(
  MaterialPageRoute(
    builder: (_) => Scaffold(
      backgroundColor: messagePaper,
      appBar: AppBar(title: UiText(title), backgroundColor: messagePaper),
      body: child,
    ),
  ),
);

Future<void> openMessageWallet(
  BuildContext context,
  MessageWorkspaceController workspace,
) => openMessageService(
  context,
  '星点钱包',
  ListenableBuilder(
    listenable: workspace,
    builder: (context, _) => ListView(
      padding: const EdgeInsets.all(17),
      children: [
        Container(
          padding: const EdgeInsets.all(19),
          decoration: BoxDecoration(
            color: messageInk,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const UiText('本地演示星点', style: TextStyle(color: Colors.white70)),
              Text(
                '${workspace.points}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const MessageSectionHeading(
          '星点明细',
          padding: EdgeInsets.only(top: 18, bottom: 8),
        ),
        if (workspace.ledger.isEmpty) const UiText('暂无星点记录。'),
        for (final entry in workspace.ledger)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.auto_awesome_outlined),
            title: Text(entry),
          ),
      ],
    ),
  ),
);

Future<void> openMessageCoupons(
  BuildContext context,
  MessageWorkspaceController workspace,
) => openMessageService(
  context,
  '券包',
  ListenableBuilder(
    listenable: workspace,
    builder: (context, _) => ListView(
      padding: const EdgeInsets.all(15),
      children: [
        const MessageSectionHeading('演示兑换券'),
        if (workspace.coupons.isEmpty) const ListTile(title: UiText('暂无可用券。')),
        for (final coupon in workspace.coupons)
          Card(
            color: const Color(0xfff1e8f6),
            child: ListTile(
              leading: const Icon(Icons.confirmation_number_outlined),
              title: UiText(coupon),
              subtitle: const UiText('兑换 8 星点'),
              trailing: TextButton(
                onPressed: () => workspace.redeem(coupon),
                child: const UiText('兑换'),
              ),
            ),
          ),
      ],
    ),
  ),
);

Future<void> openMessageTransitCode(BuildContext context) =>
    openMessageService(context, '体验出行码', const _MessageTransitCode());

class _MessageTransitCode extends StatefulWidget {
  const _MessageTransitCode();

  @override
  State<_MessageTransitCode> createState() => _MessageTransitCodeState();
}

class _MessageTransitCodeState extends State<_MessageTransitCode> {
  int _issued = DateTime.now().millisecondsSinceEpoch;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Card(
        color: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(19),
          child: Column(
            children: [
              QrImageView(
                data: 'jovian://demo-transit/$_issued',
                size: 185,
                backgroundColor: Colors.white,
              ),
              const UiText('本地演示码，仅供预览'),
              TextButton.icon(
                onPressed: () => setState(
                  () => _issued = DateTime.now().millisecondsSinceEpoch,
                ),
                icon: const Icon(Icons.refresh_rounded),
                label: const UiText('刷新出行码'),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

Future<void> previewOrbit(
  BuildContext context,
  MessageWorkspaceController workspace,
) async {
  workspace.addHistory(messageOrbitVideo.name);
  await showDialog<void>(
    context: context,
    useRootNavigator: false,
    builder: (_) => MessageAttachmentView(
      attachment: messageOrbitVideo,
      load: loadOrbitVideo,
      onTemporaryFile: (release) {
        workspace.retainTemporaryFile(release);
      },
    ),
  );
}

String collectionLabel(MessageCollection kind) => switch (kind) {
  MessageCollection.history => '观看历史',
  MessageCollection.saved => '收藏',
  MessageCollection.later => '稍后再看',
};

Future<void> openMessageCollection(
  BuildContext context,
  MessageWorkspaceController workspace,
  MessageCollection kind,
) => openMessageService(
  context,
  collectionLabel(kind),
  ListenableBuilder(
    listenable: workspace,
    builder: (context, _) {
      final entries = workspace.collection(kind).toList().reversed.toList();
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (entries.isEmpty) ...[
            const ListTile(title: UiText('这个列表还是空的。')),
            ListTile(
              leading: const Icon(Icons.play_circle_outline),
              title: const UiText('打开星轨短片'),
              onTap: () => previewOrbit(context, workspace),
            ),
          ],
          for (final entry in entries)
            ListTile(
              leading: const Icon(Icons.slow_motion_video_rounded),
              title: Text(entry),
              onTap: () => previewOrbit(context, workspace),
              trailing: IconButton(
                tooltip: context.uiLabel('移除'),
                onPressed: () => workspace.toggleCollection(kind, entry),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
        ],
      );
    },
  ),
);

Future<void> openMessageCompanion(
  BuildContext context,
  MessageWorkspaceController workspace,
  String id,
  String name, {
  VoidCallback? openWardrobe,
}) => openMessageService(
  context,
  '星伴关系',
  ListenableBuilder(
    listenable: workspace,
    builder: (context, _) {
      final days = workspace.streak(id);
      final glyph = switch (workspace.companion) {
        '暮光' => '✨',
        '苔月' => '🌱',
        _ => '🌙',
      };
      return ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(19),
              gradient: const LinearGradient(
                colors: [Color(0xff685184), Color(0xff392851)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    MessageAvatar(
                      name: '我',
                      image: workspace.avatar,
                      asset: messageSelfAvatar,
                      size: 35,
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Icon(Icons.bolt_rounded, color: Color(0xfff9d7ab)),
                    ),
                    MessageAvatar(
                      name: name,
                      asset: messageDemoAvatar(id),
                      size: 35,
                    ),
                  ],
                ),
                Text(glyph, style: const TextStyle(fontSize: 86)),
                UiText(
                  workspace.companion,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '$days ${context.uiLabel('天')}',
                  style: const TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 9),
                if (days > 0)
                  LinearProgressIndicator(
                    value: (days % 30) / 30,
                    color: const Color(0xfff9d7ab),
                    backgroundColor: Colors.white24,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 13),
          if (days == 0)
            FilledButton(
              onPressed: () => workspace.connect(id),
              child: const UiText('建立关系'),
            )
          else
            FilledButton.icon(
              onPressed: workspace.claimed(id)
                  ? null
                  : () => workspace.collect(id),
              icon: const Icon(Icons.star_outline_rounded),
              label: UiText(workspace.claimed(id) ? '今日已领取' : '领取 10 星点'),
            ),
          if (openWardrobe != null)
            TextButton(onPressed: openWardrobe, child: const UiText('星伴装扮')),
          TextButton(
            onPressed: () => openMessageWallet(context, workspace),
            child: const UiText('查看星点'),
          ),
        ],
      );
    },
  ),
);

Future<void> copyMessageText(BuildContext context, String text) async {
  try {
    await Clipboard.setData(ClipboardData(text: text));
    if (context.mounted)
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: UiText('已复制')));
  } catch (_) {
    if (context.mounted)
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: UiText('暂时无法复制文字。')));
  }
}
