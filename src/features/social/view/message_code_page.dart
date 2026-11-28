import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../ui/interface_language.dart';
import '../control/message_experience_media.dart';
import '../control/message_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/social.dart';
import 'message_design.dart';

class MessageCodePage extends StatefulWidget {
  const MessageCodePage({
    super.key,
    required this.workspace,
    this.controller,
    this.uid,
  });

  final MessageWorkspaceController workspace;
  final SocialController? controller;
  final String? uid;

  @override
  State<MessageCodePage> createState() => _MessageCodePageState();
}

class _MessageCodePageState extends State<MessageCodePage> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _read({bool? camera}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final value = camera == null
          ? _code.text.trim()
          : await readMessageQrCode(camera: camera);
      if (!mounted || value == null) return;
      _code.text = value;
      final url = Uri.tryParse(value);
      final segments = url?.pathSegments ?? const [];
      if (url?.scheme == 'jovian' &&
          url?.host == 'demo' &&
          segments.length == 1) {
        if (widget.workspace.conversation(segments.first) case final demo?) {
          Navigator.pop(context, demo);
          return;
        }
      }
      final uid =
          url?.scheme == 'jovian' &&
              url?.host == 'contact' &&
              segments.length == 1
          ? segments.first
          : value;
      if (!socialUid.hasMatch(uid))
        throw const SocialInputError('请使用木星环名片二维码或完整 UID。');
      final controller = widget.controller;
      if (controller == null) throw const SocialInputError('登录后可添加账号联系人。');
      final contacts = await controller.findChatContacts(uid);
      if (contacts.isEmpty) throw const SocialInputError('找不到这位用户。');
      if (!mounted) return;
      final person = contacts.first;
      final ok = await showDialog<bool>(
        context: context,
        useRootNavigator: false,
        builder: (context) => AlertDialog(
          title: const UiText('打开名片'),
          content: Text(person.displayName ?? 'UID $uid'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const UiText('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const UiText('发私信'),
            ),
          ],
        ),
      );
      if (!mounted || ok != true) return;
      final thread = await controller.openDirectChat(person);
      if (mounted) Navigator.pop(context, thread);
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '二维码识别失败，请重试。'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = widget.uid;
    final data = uid == null
        ? 'jovian://demo/demo-cen'
        : 'jovian://contact/$uid';
    return Scaffold(
      backgroundColor: messagePaper,
      appBar: AppBar(title: const UiText('扫一扫'), backgroundColor: messagePaper),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                UiText(
                  uid == null ? '示例名片' : '我的消息名片',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                QrImageView(
                  data: data,
                  size: 168,
                  backgroundColor: Colors.white,
                ),
                if (uid != null) Text('UID $uid'),
                TextButton.icon(
                  onPressed: () => Clipboard.setData(ClipboardData(text: data)),
                  icon: const Icon(Icons.copy_rounded, size: 15),
                  label: const UiText('复制名片'),
                ),
                if (uid == null)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () {
                            _code.text = data;
                            _read();
                          },
                    child: const UiText('打开示例名片'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 9,
            runSpacing: 7,
            children: [
              FilledButton.tonalIcon(
                onPressed: _busy ? null : () => _read(camera: false),
                icon: const Icon(Icons.photo_outlined),
                label: const UiText('从相册识别'),
              ),
              if (canCaptureMessagePhoto)
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _read(camera: true),
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const UiText('拍照识别'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            decoration: InputDecoration(
              labelText: context.uiLabel('粘贴名片或输入 UID'),
              suffixIcon: IconButton(
                onPressed: _busy ? null : () => _read(),
                tooltip: context.uiLabel('识别'),
                icon: const Icon(Icons.arrow_forward_rounded),
              ),
            ),
            onSubmitted: (_) => _read(),
          ),
          if (_busy) const LinearProgressIndicator(),
          if (_error case final error?)
            Padding(
              padding: const EdgeInsets.all(10),
              child: UiText(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }
}
