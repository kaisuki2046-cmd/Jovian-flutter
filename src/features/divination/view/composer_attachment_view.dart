import 'dart:async';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import 'composer_attachment.dart';

class ComposerAttachmentTray extends StatelessWidget {
  const ComposerAttachmentTray({
    super.key,
    required this.attachments,
    this.remove,
  });

  final List<ComposerAttachment> attachments;
  final ValueChanged<ComposerAttachment>? remove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
          child: UiText(
            '附件留在本机，AI 仅读取文字。',
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Semantics(
          label: '待发送附件',
          container: true,
          child: SizedBox(
            height: 62,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: attachments.length,
              separatorBuilder: (_, index) => const SizedBox(width: 8),
              itemBuilder: (_, index) {
                final attachment = attachments[index];
                final onRemove = remove;
                return ComposerAttachmentTile(
                  attachment: attachment,
                  remove: onRemove == null ? null : () => onRemove(attachment),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 6),
      ],
    );
  }
}

class ComposerAttachmentTile extends StatefulWidget {
  const ComposerAttachmentTile({
    super.key,
    required this.attachment,
    this.remove,
  });

  final ComposerAttachment attachment;
  final VoidCallback? remove;

  @override
  State<ComposerAttachmentTile> createState() => _ComposerAttachmentTileState();
}

class _ComposerAttachmentTileState extends State<ComposerAttachmentTile> {
  DialogRoute<void>? _preview;

  @override
  void didUpdateWidget(ComposerAttachmentTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.attachment != widget.attachment) _closePreview();
  }

  @override
  void dispose() {
    _closePreview();
    super.dispose();
  }

  void _closePreview() {
    final route = _preview;
    if (route == null) return;
    _preview = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (route.isActive) route.navigator?.removeRoute(route);
    });
  }

  void _openPreview() {
    if (_preview != null) return;
    final attachment = widget.attachment;
    final image = attachment.kind == ComposerAttachmentKind.image;
    Future<Uint8List>? picture;
    final route = DialogRoute<void>(
      context: context,
      builder: (_) => _AttachmentDialog(
        attachment: attachment,
        picture: image ? picture ??= attachment.file.readAsBytes() : null,
      ),
    );
    _preview = route;
    unawaited(
      Navigator.of(context, rootNavigator: true).push(route).whenComplete(() {
        if (_preview == route) _preview = null;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attachment = widget.attachment;
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final image = attachment.kind == ComposerAttachmentKind.image;
    final size = attachment.size;
    final action = image ? '预览图片' : '查看文件信息';
    return Material(
      color: colors.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: colors.outlineVariant),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 216),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Semantics(
                label: '$action ${attachment.name}',
                button: true,
                onTap: _openPreview,
                excludeSemantics: true,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: _openPreview,
                  child: Tooltip(
                    excludeFromSemantics: true,
                    message: '$action ${attachment.name}',
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 7,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            image
                                ? Icons.image_outlined
                                : Icons.insert_drive_file_outlined,
                            size: 20,
                          ),
                          const SizedBox(width: 7),
                          Flexible(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  attachment.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.labelMedium,
                                ),
                                if (size != null)
                                  Text(
                                    formatComposerFileSize(size),
                                    style: theme.textTheme.labelSmall,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (widget.remove case final dismiss?)
              IconButton(
                tooltip: '移除附件 ${attachment.name}',
                onPressed: dismiss,
                icon: const Icon(Icons.close, size: 17),
              ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentDialog extends StatefulWidget {
  const _AttachmentDialog({required this.attachment, this.picture});

  final ComposerAttachment attachment;
  final Future<Uint8List>? picture;

  @override
  State<_AttachmentDialog> createState() => _AttachmentDialogState();
}

class _AttachmentDialogState extends State<_AttachmentDialog> {
  bool _opening = false;
  bool _openFailed = false;

  Future<void> _openWithSystem() async {
    if (_opening) return;
    setState(() {
      _opening = true;
      _openFailed = false;
    });
    final opened = await widget.attachment.openWithSystem();
    if (!mounted) return;
    setState(() {
      _opening = false;
      _openFailed = !opened;
    });
  }

  @override
  Widget build(BuildContext context) {
    final attachment = widget.attachment;
    final size = attachment.size;
    final picture = widget.picture;
    return AlertDialog(
      title: Text(
        attachment.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      content: picture != null
          ? SizedBox(
              width: 480,
              height: MediaQuery.sizeOf(context).height * .45,
              child: FutureBuilder<Uint8List>(
                future: picture,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return const Center(child: UiText('此设备暂时无法预览这张图片。'));
                  }
                  if (snapshot.data case final bytes?) {
                    return InteractiveViewer(
                      child: Image.memory(
                        bytes,
                        semanticLabel: attachment.name,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stack) =>
                            const Center(child: UiText('此设备暂时无法预览这张图片。')),
                      ),
                    );
                  }
                  return const Center(child: CircularProgressIndicator());
                },
              ),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (size != null) Text(formatComposerFileSize(size)),
                if (attachment.mimeType case final mime?) Text(mime),
                const SizedBox(height: 12),
                const UiText('此附件仅保留在本机。'),
                if (_openFailed) ...[
                  const SizedBox(height: 8),
                  Semantics(
                    liveRegion: true,
                    child: UiText(
                      '此设备暂时无法打开这个文件，请重试。',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                ],
              ],
            ),
      actions: [
        if (attachment.canDownload)
          TextButton(
            onPressed: attachment.download,
            child: const UiText('保存到本机'),
          ),
        if (attachment.canOpenWithSystem)
          TextButton(
            onPressed: _opening ? null : _openWithSystem,
            child: UiText(_opening ? '正在打开…' : '用系统应用打开'),
          ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const UiText('关闭'),
        ),
      ],
    );
  }
}
