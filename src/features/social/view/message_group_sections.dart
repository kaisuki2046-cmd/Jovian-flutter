part of 'message_thread_page.dart';

enum _GroupSection {
  chat('聊天'),
  announcements('公告'),
  pinned('置顶'),
  saved('收藏'),
  settings('设置');

  const _GroupSection(this.label);
  final String label;
}

class _GroupSectionBar extends StatelessWidget {
  const _GroupSectionBar({
    required this.selected,
    required this.onSelected,
    required this.accent,
  });

  final _GroupSection selected;
  final ValueChanged<_GroupSection>? onSelected;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final activeFill = Color.alphaBlend(
      accent.withValues(alpha: .12),
      theme.scaffoldBackgroundColor,
    );
    final border = BorderRadius.circular(13);
    return Material(
      color: theme.scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 2, 12, 8),
        child: Row(
          spacing: 5,
          children: [
            for (final section in _GroupSection.values)
              Expanded(
                child: Semantics(
                  button: true,
                  selected: selected == section,
                  child: Ink(
                    decoration: BoxDecoration(
                      borderRadius: border,
                      color: selected == section
                          ? activeFill
                          : Colors.transparent,
                    ),
                    child: InkWell(
                      borderRadius: border,
                      onTap: onSelected == null
                          ? null
                          : () => onSelected!(section),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 40),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 2,
                            vertical: 8,
                          ),
                          child: Center(
                            child: UiText(
                              section.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelLarge?.copyWith(
                                fontSize: 13,
                                fontWeight: selected == section
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: selected == section
                                    ? colors.onSurface
                                    : colors.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _GroupMarkedMessage extends StatefulWidget {
  const _GroupMarkedMessage({
    super.key,
    required this.message,
    required this.load,
    required this.pinned,
    required this.open,
    required this.remove,
  });

  final ConversationMessage? message;
  final Future<ConversationMessage?> Function() load;
  final bool pinned;
  final VoidCallback open;
  final VoidCallback remove;

  @override
  State<_GroupMarkedMessage> createState() => _GroupMarkedMessageState();
}

class _GroupMarkedMessageState extends State<_GroupMarkedMessage> {
  late final _message = widget.load();

  @override
  Widget build(BuildContext context) {
    if (widget.message case final message?) return _item(context, message);
    return FutureBuilder<ConversationMessage?>(
      future: _message,
      builder: (context, snapshot) =>
          snapshot.connectionState == ConnectionState.done
          ? _item(context, snapshot.data)
          : const LinearProgressIndicator(minHeight: 2),
    );
  }

  Widget _item(BuildContext context, ConversationMessage? message) => Card(
    margin: EdgeInsets.zero,
    child: ListTile(
      leading: Icon(
        widget.pinned ? Icons.push_pin_outlined : Icons.bookmark_border,
      ),
      title: message == null
          ? const UiText('该消息暂不可查看。')
          : Text(
              messageSnippet(context, message.body, message.attachment?.kind),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
      subtitle: message?.senderName == null ? null : Text(message!.senderName!),
      trailing: IconButton(
        tooltip: context.uiLabel(widget.pinned ? '取消置顶消息' : '取消收藏消息'),
        onPressed: widget.remove,
        icon: const Icon(Icons.close_rounded, size: 18),
      ),
      onTap: message == null ? null : widget.open,
    ),
  );
}

class _GroupImagePreview extends StatefulWidget {
  const _GroupImagePreview({
    required this.name,
    required this.size,
    required this.load,
  });

  final String name;
  final double size;
  final Future<Uint8List> Function() load;

  @override
  State<_GroupImagePreview> createState() => _GroupImagePreviewState();
}

class _GroupImagePreviewState extends State<_GroupImagePreview> {
  late final _bytes = widget.load();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final placeholder = Center(
      child: Icon(Icons.photo_outlined, color: colors.onSurfaceVariant),
    );
    return SizedBox.square(
      dimension: widget.size,
      child: FutureBuilder<Uint8List>(
        future: _bytes,
        builder: (context, snapshot) {
          final bytes = snapshot.data;
          if (bytes == null) return placeholder;
          return Image.memory(
            bytes,
            fit: BoxFit.contain,
            semanticLabel: widget.name,
            cacheWidth: (widget.size * MediaQuery.devicePixelRatioOf(context))
                .ceil(),
            errorBuilder: (_, _, _) => placeholder,
          );
        },
      ),
    );
  }
}
