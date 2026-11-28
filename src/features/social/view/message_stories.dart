import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_experience_media.dart';
import '../control/message_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import 'message_design.dart';
import 'message_service_views.dart';

class MessageStoryStrip extends StatefulWidget {
  const MessageStoryStrip({super.key, required this.workspace});

  final MessageWorkspaceController workspace;

  @override
  State<MessageStoryStrip> createState() => _MessageStoryStripState();
}

class _MessageStoryStripState extends State<MessageStoryStrip>
    with SingleTickerProviderStateMixin {
  static const _ownTile = 'own';
  late final _sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 360),
  );
  String? _activeStory;
  bool _opening = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!TickerMode.valuesOf(context).enabled && _opening) _sweep.stop();
  }

  @override
  void dispose() {
    _sweep.dispose();
    super.dispose();
  }

  Future<void> _activate(String id, Future<void> Function() open) async {
    if (_opening || !TickerMode.valuesOf(context).enabled) return;
    _opening = true;
    try {
      if (!MediaQuery.disableAnimationsOf(context)) {
        setState(() => _activeStory = id);
        await _sweep.forward(from: 0).orCancel;
      }
      if (mounted) await open();
    } on TickerCanceled {
      // Leaving Messages cancels a sweep that is still in progress.
    } finally {
      _opening = false;
      if (mounted && _activeStory != null) setState(() => _activeStory = null);
    }
  }

  Future<void> _view(MessageStory story) => Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) =>
          _MessageStoryPage(workspace: widget.workspace, story: story),
    ),
  );

  Future<void> _publish() => publishMessageStory(context, widget.workspace);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.workspace,
    builder: (context, _) {
      final workspace = widget.workspace;
      final own = workspace.ownStory;
      final layout = MessageLayout.of(context);
      final labelHeight = MediaQuery.textScalerOf(context).scale(layout.px(19));
      return Semantics(
        container: true,
        label: context.uiLabel('限时动态'),
        child: SizedBox(
          height: layout.px(121) + labelHeight * 1.22,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.fromLTRB(
              layout.px(9),
              layout.px(8),
              layout.px(9),
              layout.px(8),
            ),
            children: [
              _StoryAvatar(
                author: '我的动态',
                tone: 3,
                image: workspace.avatar,
                asset: messageSelfAvatar,
                icon: Icons.person_outline_rounded,
                highlight: _activeStory == _ownTile ? _sweep : null,
                onTap: () => _activate(
                  _ownTile,
                  own == null ? _publish : () => _view(own),
                ),
                showAdd: true,
                onAdd: own == null ? null : () => _activate(_ownTile, _publish),
              ),
              for (final story in workspace.stories.where(
                (story) => story.contact != null,
              ))
                _StoryAvatar(
                  key: ValueKey(story.id),
                  author: story.author,
                  tone: story.tone,
                  image: story.image,
                  asset: messageDemoAvatar(story.contact),
                  unread: !workspace.sawStory(story.id),
                  highlight: _activeStory == story.id ? _sweep : null,
                  onTap: () => _activate(story.id, () => _view(story)),
                ),
            ],
          ),
        ),
      );
    },
  );
}

class _StoryAvatar extends StatelessWidget {
  const _StoryAvatar({
    super.key,
    required this.author,
    required this.tone,
    required this.onTap,
    this.unread = false,
    this.showAdd = false,
    this.onAdd,
    this.icon,
    this.image,
    this.asset,
    this.highlight,
  });

  final String author;
  final int tone;
  final IconData? icon;
  final Uint8List? image;
  final String? asset;
  final Animation<double>? highlight;
  final bool unread;
  final bool showAdd;
  final VoidCallback onTap;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final layout = MessageLayout.of(context);
    return SizedBox(
      width: layout.px(120),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Semantics(
            button: true,
            label: unread
                ? '${context.uiLabel(author)} · ${context.uiLabel('有新动态')}'
                : null,
            excludeSemantics: unread,
            onTap: unread ? onTap : null,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: onTap,
              child: Column(
                children: [
                  SizedBox.square(
                    dimension: layout.px(96),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        if (highlight case final turns?)
                          Positioned.fill(
                            child: RotationTransition(
                              turns: turns,
                              child: const RepaintBoundary(
                                child: CustomPaint(
                                  painter: _StoryRingPainter(highlight: true),
                                ),
                              ),
                            ),
                          )
                        else if (unread)
                          const Positioned.fill(child: _UnreadStoryRing()),
                        MessageAvatar(
                          name: author,
                          tone: tone,
                          icon: icon,
                          image: image,
                          asset: asset,
                          size: layout.listAvatar,
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: layout.px(6)),
                  Flexible(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: UiText(
                        author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: layout.px(19),
                          height: 1.2,
                          color: colors.onSurface,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (showAdd)
            PositionedDirectional(
              top: layout.px(66),
              end: layout.px(12),
              child: Tooltip(
                message: context.uiLabel('发布限时动态'),
                child: Material(
                  color: colors.primary,
                  shape: CircleBorder(
                    side: BorderSide(
                      color: theme.scaffoldBackgroundColor,
                      width: 1.5,
                    ),
                  ),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: onAdd ?? onTap,
                    child: SizedBox.square(
                      dimension: layout.px(30),
                      child: Icon(
                        Icons.add_rounded,
                        size: layout.px(21),
                        color: colors.onPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _UnreadStoryRing extends StatefulWidget {
  const _UnreadStoryRing();

  @override
  State<_UnreadStoryRing> createState() => _UnreadStoryRingState();
}

class _UnreadStoryRingState extends State<_UnreadStoryRing>
    with SingleTickerProviderStateMixin {
  late final _turn = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) ||
        !TickerMode.valuesOf(context).enabled) {
      _turn.stop();
    } else if (!_turn.isAnimating) {
      _turn.repeat();
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
    turns: _turn,
    child: const RepaintBoundary(
      child: CustomPaint(painter: _StoryRingPainter()),
    ),
  );
}

class _StoryRingPainter extends CustomPainter {
  const _StoryRingPainter({this.highlight = false});

  final bool highlight;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    final radius = size.shortestSide / 2 - 2;
    final spectrum = const SweepGradient(
      colors: [
        Color(0xff36b79a),
        Color(0xff538de1),
        Color(0xff9269d9),
        Color(0xffdb80a2),
        Color(0xffdeaf62),
        Color(0xff36b79a),
      ],
    ).createShader(bounds);
    final gleam = const SweepGradient(
      colors: [
        Color(0x0030bff6),
        Color(0xb64dbfeb),
        Color(0xff82eaff),
        Color(0xfffffbed),
        Color(0xffbd94ff),
        Color(0x00bd94ff),
        Color(0x0030bff6),
      ],
      stops: [0, .09, .16, .195, .222, .26, 1],
    ).createShader(bounds);
    final line = Paint()..style = PaintingStyle.stroke;
    if (highlight) {
      canvas.drawCircle(
        bounds.center,
        radius,
        line
          ..strokeWidth = 6
          ..shader = gleam
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.8),
      );
      line.maskFilter = null;
    }
    canvas.drawCircle(
      bounds.center,
      radius,
      line
        ..strokeWidth = highlight ? 2.65 : 2.1
        ..shader = spectrum,
    );
    canvas.drawCircle(
      bounds.center,
      radius,
      line
        ..strokeWidth = highlight ? 3.7 : 2.25
        ..shader = gleam,
    );
  }

  @override
  bool shouldRepaint(covariant _StoryRingPainter oldDelegate) =>
      oldDelegate.highlight != highlight;
}

Future<void> publishMessageStory(
  BuildContext context,
  MessageWorkspaceController workspace,
) => showDialog<void>(
  context: context,
  useRootNavigator: false,
  builder: (_) => _PublishStoryDialog(workspace: workspace),
);

class _PublishStoryDialog extends StatefulWidget {
  const _PublishStoryDialog({required this.workspace});
  final MessageWorkspaceController workspace;

  @override
  State<_PublishStoryDialog> createState() => _PublishStoryDialogState();
}

class _PublishStoryDialogState extends State<_PublishStoryDialog> {
  final _text = TextEditingController();
  final _place = TextEditingController();
  Uint8List? _image;
  String? _error;
  bool _picking = false;

  @override
  void dispose() {
    _text.dispose();
    _place.dispose();
    super.dispose();
  }

  Future<void> _pick({bool camera = false}) async {
    setState(() => _picking = true);
    try {
      final image = await pickMessageImage(1080, camera: camera);
      if (mounted && image != null)
        setState(() {
          _image = image;
          _error = null;
        });
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '图片载入失败。'));
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const UiText('发布限时动态'),
    scrollable: true,
    content: SizedBox(
      width: 350,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _text,
            decoration: InputDecoration(labelText: context.uiLabel('此刻想分享什么？')),
            minLines: 2,
            maxLines: 3,
            maxLength: 200,
            onChanged: (_) => setState(() {}),
          ),
          TextField(
            controller: _place,
            maxLength: 40,
            decoration: InputDecoration(labelText: context.uiLabel('添加位置')),
          ),
          if (_image case final image?)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.memory(image, height: 112, fit: BoxFit.cover),
            ),
          if (_error case final error?)
            UiText(error, style: const TextStyle(color: Colors.red)),
          Wrap(
            children: [
              TextButton.icon(
                onPressed: _picking ? null : () => _pick(),
                icon: const Icon(Icons.photo_outlined),
                label: const UiText('相册'),
              ),
              if (canCaptureMessagePhoto)
                TextButton.icon(
                  onPressed: _picking ? null : () => _pick(camera: true),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const UiText('拍照'),
                ),
            ],
          ),
          const UiText('体验动态在本设备保留 24 小时。', style: TextStyle(fontSize: 12)),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const UiText('取消'),
      ),
      FilledButton(
        onPressed: _picking || (_text.text.trim().isEmpty && _image == null)
            ? null
            : () {
                final place = _place.text.trim();
                widget.workspace.publishStory(
                  _text.text.trim(),
                  place: place.isEmpty ? null : place,
                  image: _image,
                );
                Navigator.pop(context);
              },
        child: const UiText('发布'),
      ),
    ],
  );
}

class _MessageStoryPage extends StatefulWidget {
  const _MessageStoryPage({required this.workspace, required this.story});
  final MessageWorkspaceController workspace;
  final MessageStory story;

  @override
  State<_MessageStoryPage> createState() => _MessageStoryPageState();
}

class _MessageStoryPageState extends State<_MessageStoryPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress;
  late final List<MessageStory> _stories;
  late int _index;
  MessageStory get _story => _stories[_index];

  @override
  void initState() {
    super.initState();
    final stories = widget.workspace.stories;
    _stories = stories.contains(widget.story)
        ? stories
        : [widget.story, ...stories];
    _index = _stories.indexOf(widget.story);
    _progress =
        AnimationController(vsync: this, duration: const Duration(seconds: 15))
          ..addStatusListener((status) {
            if (status == AnimationStatus.completed) _move(1);
          });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        widget.workspace.openStory(_story.id);
        _progress.forward();
      }
    });
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  void _move(int direction) {
    final step = _index + direction;
    if (step >= _stories.length) {
      Navigator.maybePop(context);
    } else if (step >= 0) {
      setState(() => _index = step);
      widget.workspace.openStory(_story.id);
      _progress.forward(from: 0);
    }
  }

  Future<void> _reply() async {
    final id = _story.contact;
    if (id == null) return;
    var draft = '';
    _progress.stop();
    final body = await showDialog<String>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: const UiText('回复动态'),
        content: TextField(
          onChanged: (value) => draft = value.trim(),
          autofocus: true,
          maxLength: 160,
          decoration: InputDecoration(hintText: context.uiLabel('发消息')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, draft),
            child: const UiText('发送'),
          ),
        ],
      ),
    );
    if (mounted && body != null && body.isNotEmpty) {
      await widget.workspace.sendMessage(
        id,
        body: '回复动态 · $body',
        nonce: newMessageNonce(),
      );
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: UiText('已发送')));
    }
    if (mounted) _progress.forward();
  }

  Future<void> _share() =>
      copyMessageText(context, '${_story.author}\n${_story.text}');

  @override
  Widget build(BuildContext context) {
    final story = _story;
    final tone = messageTones[story.tone];
    final hours = DateTime.now().difference(story.createdAt).inHours;
    final layout = MessageLayout.of(context);
    return Scaffold(
      backgroundColor: messageInk,
      body: SafeArea(
        child: Column(
          children: [
            AnimatedBuilder(
              animation: _progress,
              builder: (context, _) => Padding(
                padding: EdgeInsets.fromLTRB(
                  layout.px(18),
                  layout.px(10),
                  layout.px(18),
                  layout.px(8),
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < _stories.length; i++)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: LinearProgressIndicator(
                              value: i == _index
                                  ? _progress.value
                                  : i < _index
                                  ? 1
                                  : 0,
                              minHeight: 3,
                              color: tone.fill,
                              backgroundColor: Colors.white24,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: layout.px(20)),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: layout.px(109)),
                child: Row(
                  children: [
                    MessageAvatar(
                      name: story.author,
                      tone: story.tone,
                      image: story.contact == null
                          ? widget.workspace.avatar
                          : null,
                      asset: story.contact == null
                          ? messageSelfAvatar
                          : messageDemoAvatar(story.contact),
                      size: layout.chatAvatar,
                    ),
                    SizedBox(width: layout.px(13)),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          UiText(
                            story.author,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: layout.px(23),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            hours == 0
                                ? context.uiLabel('刚刚')
                                : '$hours ${context.uiLabel('小时前')}',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: layout.px(17),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      color: Colors.white,
                      tooltip: context.uiLabel('发布'),
                      icon: const Icon(Icons.camera_alt_outlined),
                      onPressed: () async {
                        _progress.stop();
                        await publishMessageStory(context, widget.workspace);
                        if (mounted) _progress.forward();
                      },
                    ),
                    IconButton(
                      color: Colors.white,
                      tooltip: context.uiLabel('分享动态'),
                      icon: const Icon(Icons.ios_share_rounded),
                      onPressed: _share,
                    ),
                    IconButton(
                      color: Colors.white,
                      tooltip: context.uiLabel('关闭'),
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onLongPressStart: (_) => _progress.stop(),
                onLongPressEnd: (_) => _progress.forward(),
                onHorizontalDragEnd: (details) =>
                    _move((details.primaryVelocity ?? 0) > 0 ? -1 : 1),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    layout.px(20),
                    layout.px(16),
                    layout.px(20),
                    0,
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(23),
                      gradient: LinearGradient(
                        colors: [tone.ink, messageInk],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      image: story.image == null
                          ? null
                          : DecorationImage(
                              image: MemoryImage(story.image!),
                              fit: BoxFit.cover,
                              colorFilter: const ColorFilter.mode(
                                Colors.black38,
                                BlendMode.srcOver,
                              ),
                            ),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        if (story.image == null)
                          Positioned(
                            top: 62,
                            right: 26,
                            child: Icon(
                              Icons.nights_stay_outlined,
                              size: 154,
                              color: tone.fill.withValues(alpha: .20),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 36),
                          child: Text(
                            story.text,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 23,
                              height: 1.55,
                            ),
                          ),
                        ),
                        Positioned(
                          left: 0,
                          child: IconButton(
                            tooltip: context.uiLabel('上一条动态'),
                            color: Colors.white70,
                            onPressed: _index == 0 ? null : () => _move(-1),
                            icon: const Icon(Icons.chevron_left_rounded),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          child: IconButton(
                            tooltip: context.uiLabel('下一条动态'),
                            color: Colors.white70,
                            onPressed: () => _move(1),
                            icon: const Icon(Icons.chevron_right_rounded),
                          ),
                        ),
                        if (story.place case final place?)
                          Positioned(
                            left: 17,
                            right: 17,
                            bottom: 16,
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.place_outlined,
                                  color: Colors.white70,
                                  size: 18,
                                ),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    place,
                                    style: const TextStyle(color: Colors.white),
                                  ),
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
            if (story.contact == null)
              TextButton(
                onPressed: () {
                  widget.workspace.removeOwnStory();
                  Navigator.pop(context);
                },
                style: TextButton.styleFrom(foregroundColor: Colors.white),
                child: const UiText('删除我的动态'),
              )
            else
              Padding(
                padding: EdgeInsets.symmetric(horizontal: layout.px(20)),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: layout.px(78)),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _reply,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                          ),
                          child: const UiText('私信回复'),
                        ),
                      ),
                      for (final symbol in ['♡', '👍', '✨'])
                        IconButton(
                          tooltip: context.uiLabel('回应动态'),
                          onPressed: () => setState(
                            () => widget.workspace.react(story.id, symbol),
                          ),
                          icon: Text(
                            symbol == '♡' &&
                                    widget.workspace.reaction(story.id) ==
                                        symbol
                                ? '♥'
                                : symbol,
                            style: TextStyle(
                              color:
                                  widget.workspace.reaction(story.id) == symbol
                                  ? tone.fill
                                  : Colors.white,
                              fontSize: 22,
                              fontFamilyFallback: const [messageEmojiFamily],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
