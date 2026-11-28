import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/theme.dart';
import '../model/message_experience.dart';

const messageInk = Color(0xff302346);
const messageAccent = Color(0xff674995);
const messagePaper = Color(0xfff9f6f0);
const messageDivider = Color(0xffebe3dc);
const messageEmojiFamily = 'JovianMessageEmoji';

Color groupChatBackground(ThemeData theme) => Color.alphaBlend(
  theme.colorScheme.outlineVariant.withValues(alpha: .23),
  theme.scaffoldBackgroundColor,
);

class MessageLayout {
  const MessageLayout._(this._scale);

  factory MessageLayout.of(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return MessageLayout._(width.clamp(0, jovianPageWidth) / 576);
  }

  final double _scale;

  // The reference recording is 576 pixels wide. Flutter uses logical pixels.
  double px(double value) => value * _scale;

  double get toolbarHeight => px(64);
  double get listAvatar => px(82);
  double get listRowHeight => px(105);
  double get chatAvatar => px(52);
}

const messageTones = [
  (fill: Color(0xfff3dfd4), ink: Color(0xff8d4d55)),
  (fill: Color(0xffe9def5), ink: Color(0xff604882)),
  (fill: Color(0xffe1ead9), ink: Color(0xff496448)),
  (fill: Color(0xfff3e7ca), ink: Color(0xff7c6232)),
];

String messageThemeName(MessageTheme theme) => switch (theme) {
  MessageTheme.paper => '暖纸',
  MessageTheme.lilac => '暮紫',
  MessageTheme.moss => '苔青',
};

String bubbleName(MessageBubbleStyle style) => switch (style) {
  MessageBubbleStyle.rounded => '柔圆',
  MessageBubbleStyle.outlined => '描边',
  MessageBubbleStyle.note => '信笺',
};

({Color incoming, Color outgoing, Color accent}) chatColors(
  ColorScheme colors,
  MessageTheme theme,
) {
  final dark = colors.brightness == Brightness.dark;
  if (theme == MessageTheme.paper) {
    return (
      incoming: colors.surfaceContainerLow,
      outgoing: colors.secondaryContainer,
      accent: colors.primary,
    );
  }
  final accent = theme == MessageTheme.lilac
      ? (dark ? const Color(0xffc3a6eb) : const Color(0xff7855aa))
      : (dark ? const Color(0xffb3d29b) : const Color(0xff547549));
  return (
    incoming: Color.alphaBlend(
      accent.withValues(alpha: dark ? .10 : .06),
      colors.surfaceContainerLow,
    ),
    outgoing: Color.alphaBlend(
      accent.withValues(alpha: dark ? .25 : .19),
      colors.surfaceContainerLow,
    ),
    accent: accent,
  );
}

DecorationImage? chatWallpaper(Color background, Uint8List? wallpaper) =>
    wallpaper == null
    ? null
    : DecorationImage(
        image: MemoryImage(wallpaper),
        fit: BoxFit.cover,
        colorFilter: ColorFilter.mode(
          background.withValues(alpha: .58),
          BlendMode.srcOver,
        ),
      );

const _messageAvatarDirectory = 'src/features/social/assets/avatars';
const messageSelfAvatar = '$_messageAvatarDirectory/self.jpg';

String? messageDemoAvatar(String? id) => switch (id) {
  'demo-self' => messageSelfAvatar,
  'demo-cen' || '岑宁' => '$_messageAvatarDirectory/cen.jpg',
  'demo-an' || '安澄' => '$_messageAvatarDirectory/an.jpg',
  'demo-qiao' || '乔槐' => '$_messageAvatarDirectory/qiao.jpg',
  'demo-studio' || '星窗工作室' => '$_messageAvatarDirectory/studio.jpg',
  'demo-sky' => '$_messageAvatarDirectory/sky.jpg',
  _ => null,
};

class MessageAvatar extends StatelessWidget {
  const MessageAvatar({
    super.key,
    required this.name,
    this.size = 46,
    this.tone,
    this.icon,
    this.image,
    this.asset,
  });

  final String name;
  final double size;
  final int? tone;
  final IconData? icon;
  final Uint8List? image;
  final String? asset;

  @override
  Widget build(BuildContext context) {
    final color = messageTones[(tone ?? name.hashCode) % messageTones.length];
    final photo = image;
    final file = asset;
    return ClipOval(
      child: SizedBox.square(
        dimension: size,
        child: ColoredBox(
          color: color.fill,
          child: photo != null
              ? Image.memory(
                  photo,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                )
              : file != null
              ? Image.asset(file, fit: BoxFit.cover, excludeFromSemantics: true)
              : Center(
                  child: icon == null
                      ? Text(
                          name.isEmpty ? '·' : name.characters.first,
                          textScaler: TextScaler.noScaling,
                          style: TextStyle(
                            color: color.ink,
                            fontWeight: FontWeight.w700,
                            fontSize: size * .39,
                          ),
                        )
                      : Icon(icon, color: color.ink, size: size * .51),
                ),
        ),
      ),
    );
  }
}

class MessageSectionHeading extends StatelessWidget {
  const MessageSectionHeading(
    this.title, {
    super.key,
    this.action,
    this.padding = const EdgeInsets.fromLTRB(18, 16, 18, 9),
  });

  final String title;
  final Widget? action;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: padding,
    child: Row(
      children: [
        Expanded(
          child: UiText(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: messageInk,
            ),
          ),
        ),
        if (action != null) action!,
      ],
    ),
  );
}

class MessageActionTile extends StatelessWidget {
  const MessageActionTile(
    this.label,
    this.icon,
    this.onTap, {
    super.key,
    this.tone = 1,
    this.foregroundColor,
    this.avatarSize = 39,
    this.labelSize = 12,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final int tone;
  final Color? foregroundColor;
  final double avatarSize;
  final double labelSize;

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(14),
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 2),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          MessageAvatar(name: label, icon: icon, size: avatarSize, tone: tone),
          const SizedBox(height: 7),
          Flexible(
            child: UiText(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: labelSize,
                height: 1.14,
                color:
                    foregroundColor ?? Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class MessageActionGrid extends StatelessWidget {
  const MessageActionGrid({
    super.key,
    required this.children,
    this.columns = 4,
    this.rowHeight,
    this.rowSpacing = 4,
  });

  final List<Widget> children;
  final int columns;
  final double? rowHeight;
  final double rowSpacing;

  @override
  Widget build(BuildContext context) => GridView.count(
    crossAxisCount: columns,
    mainAxisSpacing: rowSpacing,
    crossAxisSpacing: 4,
    mainAxisExtent:
        rowHeight ??
        (57 + MediaQuery.textScalerOf(context).scale(12) * 2.3)
            .clamp(85.0, 118.0)
            .toDouble(),
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    padding: const EdgeInsets.symmetric(horizontal: 12),
    children: children,
  );
}
