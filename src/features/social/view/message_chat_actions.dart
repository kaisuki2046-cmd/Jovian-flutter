import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_workspace_controller.dart';
import 'message_design.dart';
import 'message_service_views.dart';

Future<void> openMessageCall(
  BuildContext context,
  String name, {
  String? avatar,
}) async {
  final video = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const MessageSectionHeading('发起通话'),
          ListTile(
            leading: const Icon(Icons.call_outlined),
            title: const UiText('语音通话'),
            onTap: () => Navigator.pop(context, false),
          ),
          ListTile(
            leading: const Icon(Icons.videocam_outlined),
            title: const UiText('视频通话'),
            onTap: () => Navigator.pop(context, true),
          ),
        ],
      ),
    ),
  );
  if (!context.mounted || video == null) return;
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) =>
          _MessageCallDemo(name: name, video: video, avatar: avatar),
    ),
  );
}

class _MessageCallDemo extends StatefulWidget {
  const _MessageCallDemo({
    required this.name,
    required this.video,
    this.avatar,
  });
  final String name;
  final bool video;
  final String? avatar;

  @override
  State<_MessageCallDemo> createState() => _MessageCallDemoState();
}

class _MessageCallDemoState extends State<_MessageCallDemo> {
  Timer? _clock;
  int _seconds = 0;
  bool _connected = false;
  bool _microphone = true;
  bool _camera = true;
  bool _speaker = false;

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  void _connect() {
    setState(() => _connected = true);
    _clock = Timer.periodic(
      const Duration(seconds: 1),
      (_) => setState(() => _seconds++),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: messageInk,
    appBar: AppBar(
      backgroundColor: messageInk,
      foregroundColor: Colors.white,
      title: UiText(
        widget.video ? '视频通话演示' : '语音通话演示',
        style: const TextStyle(color: Colors.white),
      ),
    ),
    body: SafeArea(
      child: Column(
        children: [
          const Spacer(),
          MessageAvatar(name: widget.name, asset: widget.avatar, size: 88),
          const SizedBox(height: 16),
          Text(
            widget.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 5),
          if (_connected)
            Text(
              '${(_seconds ~/ 60).toString().padLeft(2, '0')}:${(_seconds % 60).toString().padLeft(2, '0')}',
              style: const TextStyle(color: Colors.white70),
            )
          else
            const UiText('等待接听演示', style: TextStyle(color: Colors.white70)),
          if (_connected && widget.video)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Icon(
                _camera ? Icons.videocam_outlined : Icons.videocam_off_outlined,
                size: 34,
                color: Colors.white70,
              ),
            ),
          const Spacer(),
          if (_connected)
            Wrap(
              spacing: 8,
              children: [
                IconButton.filledTonal(
                  tooltip: context.uiLabel(_microphone ? '静音' : '打开麦克风'),
                  onPressed: () => setState(() => _microphone = !_microphone),
                  icon: Icon(_microphone ? Icons.mic_none : Icons.mic_off),
                ),
                if (widget.video)
                  IconButton.filledTonal(
                    tooltip: context.uiLabel(_camera ? '关闭摄像头' : '打开摄像头'),
                    onPressed: () => setState(() => _camera = !_camera),
                    icon: Icon(
                      _camera
                          ? Icons.videocam_outlined
                          : Icons.videocam_off_outlined,
                    ),
                  ),
                IconButton.filledTonal(
                  tooltip: context.uiLabel(_speaker ? '关闭扬声器' : '扬声器'),
                  onPressed: () => setState(() => _speaker = !_speaker),
                  icon: Icon(
                    _speaker
                        ? Icons.volume_up_rounded
                        : Icons.volume_down_outlined,
                  ),
                ),
              ],
            )
          else
            FilledButton.tonalIcon(
              onPressed: _connect,
              icon: const Icon(Icons.call),
              label: const UiText('模拟接听'),
            ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xffa63852),
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.call_end_rounded),
            label: const UiText('挂断'),
          ),
          const SizedBox(height: 22),
        ],
      ),
    ),
  );
}

Future<String?> promptMessageLocation(BuildContext context) {
  var place = '';
  return showDialog<String>(
    context: context,
    useRootNavigator: false,
    builder: (context) => AlertDialog(
      title: const UiText('发送位置'),
      content: TextField(
        autofocus: true,
        maxLength: 120,
        onChanged: (value) => place = value.trim(),
        decoration: InputDecoration(
          hintText: context.uiLabel('输入地点名称或地址'),
          prefixIcon: const Icon(Icons.place_outlined),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const UiText('取消'),
        ),
        FilledButton(
          onPressed: () {
            if (place.isNotEmpty) Navigator.pop(context, '📍 $place');
          },
          child: const UiText('发送'),
        ),
      ],
    ),
  );
}

Future<int?> promptMessagePoints(
  BuildContext context,
  MessageWorkspaceController workspace, {
  required bool gift,
}) {
  String amount = '';
  return showDialog<int>(
    context: context,
    useRootNavigator: false,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) {
        final number = int.tryParse(amount);
        return AlertDialog(
          title: UiText(gift ? '星点红包' : '星点转账'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${context.uiLabel('本地演示星点')} · ${workspace.points}'),
              const SizedBox(height: 9),
              TextField(
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 4,
                onChanged: (value) => setState(() => amount = value.trim()),
                decoration: InputDecoration(labelText: context.uiLabel('星点数量')),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const UiText('取消'),
            ),
            FilledButton(
              onPressed:
                  number != null && number > 0 && number <= workspace.points
                  ? () => Navigator.pop(context, number)
                  : null,
              child: const UiText('发送'),
            ),
          ],
        );
      },
    ),
  );
}

Future<String?> promptDemoContact(
  BuildContext context,
  MessageWorkspaceController workspace, {
  String? uid,
}) {
  return showDialog<String>(
    context: context,
    useRootNavigator: false,
    builder: (context) => SimpleDialog(
      title: const UiText('分享联系人'),
      children: [
        if (uid != null)
          SimpleDialogOption(
            onPressed: () =>
                Navigator.pop(context, '名片 · jovian://contact/$uid'),
            child: const UiText('我的消息名片'),
          ),
        for (final thread in workspace.conversations())
          if (workspace.isFriend(thread.id))
            SimpleDialogOption(
              onPressed: () => Navigator.pop(
                context,
                '名片 · ${thread.title} · jovian://demo/${thread.id}',
              ),
              child: Text(thread.title ?? ''),
            ),
      ],
    ),
  );
}

Future<void> showLocationMessage(BuildContext context, String place) =>
    showDialog<void>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: const UiText('共享位置'),
        content: Row(
          children: [
            const Icon(Icons.place_outlined, color: messageAccent),
            const SizedBox(width: 8),
            Flexible(child: Text(place)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => copyMessageText(context, place),
            child: const UiText('复制文字'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('关闭'),
          ),
        ],
      ),
    );
