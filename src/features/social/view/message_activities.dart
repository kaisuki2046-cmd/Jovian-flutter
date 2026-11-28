import 'dart:math' as math;
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_experience_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import 'message_design.dart';
import 'message_service_views.dart';

const _activityOptions = [
  (MessageActivity.watch, '一起看', Icons.ondemand_video_outlined, '分享原创星轨短片'),
  (MessageActivity.play, '一起玩', Icons.extension_outlined, '做一道星图小测'),
  (
    MessageActivity.duet,
    '一起合拍',
    Icons.photo_camera_front_outlined,
    '选一张照片生成双人邀请',
  ),
  (MessageActivity.sing, '一起唱', Icons.mic_none_rounded, '发出合唱邀请'),
  (MessageActivity.exchange, '一起攒', Icons.auto_awesome_outlined, '收集演示星点'),
];

MessageActivity? messageInvitation(String body) => _activityOptions
    .where((option) => body.startsWith('✦ ${option.$2} · '))
    .firstOrNull
    ?.$1;

Future<String?> showMessageActivities(
  BuildContext context,
  MessageWorkspaceController workspace, {
  String? thread,
  String? title,
}) async {
  final layout = MessageLayout.of(context);
  final selected = await showModalBottomSheet<MessageActivity>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: SizedBox(
        height: math.min(
          layout.px(762),
          MediaQuery.sizeOf(context).height * .70,
        ),
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            layout.px(20),
            layout.px(8),
            layout.px(20),
            layout.px(25),
          ),
          children: [
            Material(
              color: messageInk,
              borderRadius: BorderRadius.circular(17),
              child: ListTile(
                minTileHeight: layout.px(208),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 17,
                  vertical: 10,
                ),
                leading: Icon(
                  Icons.nights_stay_outlined,
                  size: layout.px(58),
                  color: const Color(0xfff4d6a6),
                ),
                title: const UiText(
                  '星空放映室',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const UiText(
                  '打开星轨短片',
                  style: TextStyle(color: Colors.white70),
                ),
                trailing: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
                onTap: () => Navigator.pop(context, MessageActivity.watch),
              ),
            ),
            const MessageSectionHeading(
              '一起互动',
              padding: EdgeInsets.only(top: 17, bottom: 5),
            ),
            SizedBox(
              height: layout.px(192),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _activityOptions.length,
                separatorBuilder: (_, _) => SizedBox(width: layout.px(10)),
                itemBuilder: (context, index) {
                  final (activity, label, icon, _) = _activityOptions[index];
                  return SizedBox(
                    width: layout.px(156),
                    child: MessageActionTile(
                      label,
                      icon,
                      () => Navigator.pop(context, activity),
                      tone: activity.index,
                      avatarSize: layout.px(86),
                      labelSize: layout.px(21),
                    ),
                  );
                },
              ),
            ),
            if (thread != null)
              ListTile(
                leading: const MessageAvatar(
                  name: '星伴',
                  tone: 1,
                  size: 39,
                  icon: Icons.auto_awesome_outlined,
                ),
                title: const UiText('星伴关系'),
                subtitle: const UiText('每天交流积累关系进度'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => openMessageCompanion(
                  context,
                  workspace,
                  thread,
                  title ?? '',
                ),
              ),
          ],
        ),
      ),
    ),
  );
  if (!context.mounted || selected == null) return null;
  return openMessageActivity(context, workspace, selected);
}

Future<String?> openMessageActivity(
  BuildContext context,
  MessageWorkspaceController workspace,
  MessageActivity activity, {
  bool canInvite = true,
}) => Navigator.of(context).push<String>(
  MaterialPageRoute(
    builder: (_) => _MessageActivityPage(
      workspace: workspace,
      activity: activity,
      canInvite: canInvite,
    ),
  ),
);

class _MessageActivityPage extends StatefulWidget {
  const _MessageActivityPage({
    required this.workspace,
    required this.activity,
    required this.canInvite,
  });
  final MessageWorkspaceController workspace;
  final MessageActivity activity;
  final bool canInvite;

  @override
  State<_MessageActivityPage> createState() => _MessageActivityPageState();
}

class _MessageActivityPageState extends State<_MessageActivityPage> {
  static const _questions = [
    ('哪个方向能找到北极星？', ['正北', '正南', '正东'], 0),
    ('哪一颗行星有显眼的环？', ['火星', '土星', '金星'], 1),
    ('月球本身会发出可见光吗？', ['不会', '会'], 0),
  ];
  Uint8List? _photo;
  String? _error;
  int _question = 0;
  int? _answer;

  Future<void> _pick() async {
    try {
      final photo = await pickMessageImage(640);
      if (mounted && photo != null)
        setState(() {
          _photo = photo;
          _error = null;
        });
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '图片载入失败。'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final (activity, title, icon, subtitle) = _activityOptions.firstWhere(
      (option) => option.$1 == widget.activity,
    );
    final workspace = widget.workspace;
    return Scaffold(
      backgroundColor: messagePaper,
      appBar: AppBar(title: UiText(title), backgroundColor: messagePaper),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: messageTones[activity.index % messageTones.length].fill,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: messageAccent, size: 32),
                const SizedBox(height: 10),
                UiText(
                  subtitle,
                  style: const TextStyle(
                    color: messageInk,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ...switch (activity) {
            MessageActivity.watch => [
              FilledButton.icon(
                onPressed: () => previewOrbit(context, workspace),
                icon: const Icon(Icons.play_arrow_rounded),
                label: const UiText('播放星轨短片'),
              ),
              ListenableBuilder(
                listenable: workspace,
                builder: (context, _) => Column(
                  children: [
                    for (final kind in [
                      MessageCollection.saved,
                      MessageCollection.later,
                    ])
                      CheckboxListTile(
                        title: UiText(collectionLabel(kind)),
                        value: workspace
                            .collection(kind)
                            .contains(messageOrbitVideo.name),
                        onChanged: (_) => workspace.toggleCollection(
                          kind,
                          messageOrbitVideo.name,
                        ),
                      ),
                  ],
                ),
              ),
            ],
            MessageActivity.play => _quiz(),
            MessageActivity.duet => [
              if (_photo case final photo?)
                ClipRRect(
                  borderRadius: BorderRadius.circular(15),
                  child: Image.memory(photo, height: 160, fit: BoxFit.cover),
                ),
              FilledButton.tonalIcon(
                onPressed: _pick,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: const UiText('选择合拍图片'),
              ),
              if (_error case final error?) UiText(error),
            ],
            MessageActivity.sing => const [
              ListTile(
                leading: Icon(Icons.music_note_rounded),
                title: UiText('晚风合唱'),
              ),
              ListTile(
                leading: Icon(Icons.mic_none_rounded),
                title: UiText('发送邀请后可在聊天中录一段声音。'),
              ),
            ],
            MessageActivity.exchange => [
              ListenableBuilder(
                listenable: workspace,
                builder: (context, _) => ListTile(
                  leading: const Icon(Icons.stars_outlined),
                  title: UiText('${workspace.points} 星点'),
                  subtitle: const UiText('演示星点可用来发送红包或兑换券。'),
                  trailing: TextButton(
                    onPressed: () => openMessageCoupons(context, workspace),
                    child: const UiText('券包'),
                  ),
                ),
              ),
            ],
          },
          const SizedBox(height: 8),
          if (widget.canInvite)
            FilledButton.tonalIcon(
              onPressed: () => Navigator.pop(context, '✦ $title · $subtitle'),
              icon: const Icon(Icons.send_outlined, size: 17),
              label: const UiText('发送邀请'),
            ),
        ],
      ),
    );
  }

  List<Widget> _quiz() {
    final (prompt, options, correct) = _questions[_question];
    return [
      ListTile(
        title: UiText(
          prompt,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      for (var i = 0; i < options.length; i++)
        OutlinedButton(
          onPressed: _answer == null ? () => setState(() => _answer = i) : null,
          child: UiText(options[i]),
        ),
      if (_answer != null) ...[
        ListTile(
          title: UiText(
            _answer == correct ? '回答正确' : '正确答案是 ${options[correct]}',
          ),
        ),
        TextButton(
          onPressed: () => setState(() {
            _question = (_question + 1) % _questions.length;
            _answer = null;
          }),
          child: const UiText('下一题'),
        ),
      ],
    ];
  }
}
