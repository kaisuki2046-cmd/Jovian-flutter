import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_experience_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_design.dart';

class MessageStickerPanel extends StatefulWidget {
  const MessageStickerPanel({
    super.key,
    required this.workspace,
    this.send,
    this.maxGridHeight = double.infinity,
  });

  final MessageWorkspaceController workspace;
  final ValueChanged<MessageSticker>? send;
  final double maxGridHeight;

  @override
  State<MessageStickerPanel> createState() => _MessageStickerPanelState();
}

class _MessageStickerPanelState extends State<MessageStickerPanel> {
  int _section = 0;
  bool _importing = false;
  bool _searching = false;
  String _query = '';
  String? _error;

  Future<void> _import() async {
    if (_importing) return;
    setState(() => _importing = true);
    try {
      final bytes = await pickMessageImage(192);
      if (!mounted || bytes == null) return;
      widget.workspace.addSticker(
        OutgoingMessageAttachment(
          MessageAttachment(
            kind: MessageMediaKind.image,
            name: 'sticker.jpg',
            type: 'image/jpeg',
            size: bytes.length,
          ),
          bytes,
        ),
      );
      setState(() {
        _section = 2;
        _error = null;
      });
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '贴纸导入失败。'));
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.workspace,
    builder: (context, _) {
      final workspace = widget.workspace;
      final layout = MessageLayout.of(context);
      final thumbnail = layout.px(106);
      final stickers = workspace.stickers.where((item) {
        if (_section == 1 && !workspace.isFavorite(item.id)) return false;
        if (_section == 2 && item.attachment == null) return false;
        return _query.isEmpty ||
            item.id.contains(_query) ||
            item.symbol?.contains(_query) == true;
      }).toList();
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: layout.px(13)),
            child: Row(
              children: [
                IconButton(
                  tooltip: context.uiLabel('搜索贴纸'),
                  onPressed: () => setState(() {
                    _searching = !_searching;
                    if (!_searching) _query = '';
                  }),
                  icon: const Icon(Icons.search_rounded),
                ),
                for (final (i, icon, name) in [
                  (0, Icons.emoji_emotions_outlined, '全部贴纸'),
                  (1, Icons.favorite_border_rounded, '收藏贴纸'),
                  (2, Icons.auto_awesome_outlined, '我的贴纸'),
                ])
                  IconButton(
                    tooltip: context.uiLabel(name),
                    isSelected: _section == i,
                    color: _section == i ? messageAccent : null,
                    onPressed: () => setState(() => _section = i),
                    icon: Icon(icon),
                  ),
                const Spacer(),
                IconButton(
                  tooltip: context.uiLabel('导入贴纸'),
                  onPressed: _importing ? null : _import,
                  icon: const Icon(Icons.add_box_outlined),
                ),
              ],
            ),
          ),
          if (_searching)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: TextField(
                onChanged: (value) =>
                    setState(() => _query = value.trim().toLowerCase()),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: context.uiLabel('输入表情或名称'),
                ),
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(10),
              child: UiText(_error!, style: const TextStyle(color: Colors.red)),
            ),
          if (stickers.isEmpty)
            Padding(
              padding: const EdgeInsets.all(18),
              child: UiText(
                _section == 1
                    ? '长按贴纸可收藏'
                    : _section == 2
                    ? '可以从相册导入贴纸'
                    : '没有匹配的贴纸',
                textAlign: TextAlign.center,
              ),
            )
          else
            SizedBox(
              height: math.min(layout.px(474), widget.maxGridHeight),
              child: GridView.builder(
                padding: EdgeInsets.symmetric(horizontal: layout.px(18)),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisExtent: layout.px(134),
                ),
                itemCount: stickers.length,
                itemBuilder: (context, i) {
                  final sticker = stickers[i];
                  final attachment = sticker.attachment;
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () {
                          final send = widget.send;
                          if (send != null) {
                            send(sticker);
                          } else {
                            workspace.favorite(sticker.id);
                          }
                        },
                        onLongPress: () => workspace.favorite(sticker.id),
                        child: SizedBox.square(
                          dimension: thumbnail,
                          child: Center(
                            child: attachment != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(7),
                                    child: Image.memory(
                                      attachment.bytes,
                                      width: thumbnail,
                                      height: thumbnail,
                                      fit: BoxFit.cover,
                                    ),
                                  )
                                : Text(
                                    sticker.symbol!,
                                    style: TextStyle(
                                      fontSize: thumbnail * .82,
                                      fontFamily: messageEmojiFamily,
                                      height: 1,
                                    ),
                                    textScaler: TextScaler.noScaling,
                                  ),
                          ),
                        ),
                      ),
                      if (workspace.isFavorite(sticker.id))
                        const Positioned(
                          right: 2,
                          bottom: 2,
                          child: Icon(
                            Icons.favorite,
                            size: 11,
                            color: messageAccent,
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
        ],
      );
    },
  );
}
