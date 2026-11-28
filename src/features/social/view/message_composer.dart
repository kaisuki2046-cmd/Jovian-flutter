import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../control/message_media.dart';
import '../control/message_workspace_controller.dart';
import '../control/social_controller.dart';
import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_activities.dart';
import 'message_chat_actions.dart';
import 'message_components.dart';
import 'message_design.dart';
import 'message_service_views.dart';
import 'message_sticker_panel.dart';

class MessageComposer extends StatefulWidget {
  const MessageComposer({
    super.key,
    required this.workspace,
    required this.conversation,
    required this.availableHeight,
    this.uid,
    required this.reply,
    required this.onCancelReply,
    required this.onSend,
  });

  final MessageWorkspaceController workspace;
  final MessageConversation conversation;
  final double availableHeight;
  final String? uid;
  final ConversationMessage? reply;
  final VoidCallback onCancelReply;
  final Future<void> Function(
    String body,
    String nonce,
    int? replyTo,
    OutgoingMessageAttachment? attachment,
  )
  onSend;

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

enum _ComposerPanel { stickers, tools }

enum _AttachmentChoice { gallery, camera, file }

const _quickReactions = [
  ('👋', '打招呼'),
  ('🫶', '比心'),
  ('👍', '点赞'),
  ('💫', '送星星'),
  ('🌹', '送花'),
  ('🌙', '晚安'),
];

class _MessageComposerState extends State<MessageComposer>
    with WidgetsBindingObserver {
  final _draft = TextEditingController();
  final _focus = FocusNode();
  MessageVoiceRecorder? _recorder;
  Timer? _recordingLimit;
  OutgoingMessageAttachment? _attachment;
  String? _nonce;
  String? _error;
  bool _working = false;
  bool _sending = false;
  bool _recording = false;
  bool _routeVisible = true;
  bool _appVisible = true;
  bool _holdingMic = false;
  _ComposerPanel? _panel;
  int _toolPage = 0;
  (String, String)? _quickRetry;

  bool get _canRecord => _routeVisible && _appVisible;
  bool get _isGroup => widget.conversation.kind == ConversationKind.group;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _routeVisible = TickerMode.valuesOf(context).enabled;
    _cancelVoiceWhenHidden();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appVisible =
        state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive;
    _cancelVoiceWhenHidden();
  }

  void _cancelVoiceWhenHidden() {
    if (!_canRecord && _recording && !_working) {
      unawaited(_finishVoice(keep: false));
    }
  }

  @override
  void didUpdateWidget(covariant MessageComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reply?.id != widget.reply?.id) _nonce = null;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _recordingLimit?.cancel();
    if (_recorder case final recorder?) unawaited(recorder.dispose());
    _draft.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _edit() {
    setState(() {
      _error = null;
      _nonce = null;
    });
  }

  Future<void> _send() async {
    if (_sending || _working || _recording) return;
    final body = _draft.text.trim();
    final attachment = _attachment;
    if (body.isEmpty && attachment == null) return;
    if (body.runes.length > maxMessageLength) {
      setState(() => _error = '每条消息最多 1500 字。');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.onSend(
        body,
        _nonce ??= newMessageNonce(),
        widget.reply?.id,
        attachment,
      );
      if (!mounted) return;
      _draft.clear();
      setState(() {
        _attachment = null;
        _nonce = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = describeSocialError(
            error,
            '消息发送失败，请重试。',
            missing: '该会话已不可用。',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _withMedia(Future<void> Function() load, String failure) async {
    if (_working || _sending) return;
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      await load();
    } catch (error) {
      if (mounted) setState(() => _error = describeSocialError(error, failure));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  void _setAttachment(OutgoingMessageAttachment? value) {
    setState(() {
      _attachment = value;
      _nonce = null;
      _error = null;
    });
  }

  void _togglePanel(_ComposerPanel panel) {
    _focus.unfocus();
    setState(() => _panel = _panel == panel ? null : panel);
  }

  Future<void> _pickAttachment(_AttachmentChoice choice) async {
    setState(() => _panel = null);
    await _withMedia(() async {
      final attachment = await switch (choice) {
        _AttachmentChoice.gallery => pickMessageAttachment(mediaOnly: true),
        _AttachmentChoice.camera => takeMessagePhoto(),
        _AttachmentChoice.file => pickMessageAttachment(),
      };
      if (mounted && attachment != null) _setAttachment(attachment);
    }, '暂时无法添加这个附件。');
  }

  Future<void> _sendQuick(String body, {VoidCallback? completed}) async {
    if (_sending || _working || _recording) return;
    final previous = _quickRetry;
    final nonce = previous?.$1 == body ? previous!.$2 : newMessageNonce();
    _quickRetry = (body, nonce);
    setState(() {
      _sending = true;
      _error = null;
      _panel = null;
    });
    try {
      await widget.onSend(body, nonce, null, null);
      completed?.call();
      _quickRetry = null;
    } catch (error) {
      if (mounted)
        setState(() => _error = describeSocialError(error, '消息发送失败，请重试。'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openActivities([MessageActivity? activity]) async {
    _focus.unfocus();
    setState(() => _panel = null);
    final invite = await (activity == null
        ? showMessageActivities(
            context,
            widget.workspace,
            thread: widget.conversation.id,
            title: widget.conversation.title,
          )
        : openMessageActivity(context, widget.workspace, activity));
    if (mounted && invite != null) await _sendQuick(invite);
  }

  Future<void> _sendPoints({required bool gift}) async {
    final workspace = widget.workspace;
    final amount = await promptMessagePoints(context, workspace, gift: gift);
    if (!mounted || amount == null) return;
    final label = gift ? '星点红包' : '星点转账';
    if (amount > workspace.points) {
      setState(() => _error = '演示星点余额不足。');
      return;
    }
    await _sendQuick(
      '${gift ? '🧧' : '✧'} $label · $amount ${context.uiLabel('演示星点')}',
      completed: () {
        workspace.usePoints(amount, label);
      },
    );
  }

  void _stageSticker(MessageSticker sticker) {
    setState(() => _panel = null);
    if (sticker.attachment case final attachment?) {
      _setAttachment(attachment);
      return;
    }
    final symbol = sticker.symbol!;
    final text = _draft.text;
    final selection = _draft.selection;
    final start = selection.isValid ? selection.start : text.length;
    final end = selection.isValid ? selection.end : text.length;
    _draft.value = TextEditingValue(
      text: text.replaceRange(start, end, symbol),
      selection: TextSelection.collapsed(offset: start + symbol.length),
    );
    _edit();
  }

  Future<void> _stageOrbit() async {
    setState(() => _panel = null);
    await _withMedia(() async {
      final bytes = await loadOrbitVideo();
      if (mounted)
        _setAttachment(OutgoingMessageAttachment(messageOrbitVideo, bytes));
    }, '暂时无法添加这个附件。');
  }

  Widget _toolPanel(MessageLayout layout) {
    Widget tool(String label, IconData icon, VoidCallback action, int tone) =>
        MessageActionTile(
          label,
          icon,
          action,
          tone: tone,
          avatarSize: layout.px(94),
          labelSize: layout.px(19),
        );
    final workspace = widget.workspace;
    final title = widget.conversation.title ?? context.uiLabel('会话');
    final labelHeight = MediaQuery.textScalerOf(context).scale(layout.px(19));
    final rowHeight = math.max(
      layout.px(158),
      layout.px(115) + 2.3 * labelHeight,
    );
    final rowCount = _toolPage == 0 ? 2 : 1;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: layout.px(20)),
        SizedBox(
          height: math.min(rowHeight * rowCount, widget.availableHeight * .40),
          child: SingleChildScrollView(
            child: MessageActionGrid(
              rowHeight: rowHeight,
              rowSpacing: 0,
              children: _toolPage == 0
                  ? [
                      tool(
                        '图片或视频',
                        Icons.photo_library_outlined,
                        () => _pickAttachment(_AttachmentChoice.gallery),
                        1,
                      ),
                      if (canCaptureMessagePhoto)
                        tool(
                          '拍照',
                          Icons.photo_camera_outlined,
                          () => _pickAttachment(_AttachmentChoice.camera),
                          0,
                        )
                      else
                        tool(
                          '文件',
                          Icons.attach_file_rounded,
                          () => _pickAttachment(_AttachmentChoice.file),
                          0,
                        ),
                      tool(
                        '发起通话',
                        Icons.call_outlined,
                        () => openMessageCall(
                          context,
                          title,
                          avatar: messageDemoAvatar(widget.conversation.id),
                        ),
                        2,
                      ),
                      tool(
                        '一起看',
                        Icons.ondemand_video_outlined,
                        () => _openActivities(MessageActivity.watch),
                        3,
                      ),
                      tool(
                        '红包',
                        Icons.redeem_outlined,
                        () => _sendPoints(gift: true),
                        0,
                      ),
                      tool('位置', Icons.place_outlined, () async {
                        final place = await promptMessageLocation(context);
                        if (mounted && place != null) await _sendQuick(place);
                      }, 2),
                      tool(
                        '转账',
                        Icons.swap_horiz_rounded,
                        () => _sendPoints(gift: false),
                        3,
                      ),
                      tool(
                        '一起玩',
                        Icons.extension_outlined,
                        () => _openActivities(MessageActivity.play),
                        1,
                      ),
                    ]
                  : [
                      tool('联系人', Icons.person_outline, () async {
                        final card = await promptDemoContact(
                          context,
                          workspace,
                          uid: widget.uid,
                        );
                        if (mounted && card != null) await _sendQuick(card);
                      }, 0),
                      tool(
                        '收藏',
                        Icons.bookmark_border_rounded,
                        () => openMessageCollection(
                          context,
                          workspace,
                          MessageCollection.saved,
                        ),
                        1,
                      ),
                      tool(
                        '文件',
                        Icons.folder_outlined,
                        () => _pickAttachment(_AttachmentChoice.file),
                        2,
                      ),
                    ],
            ),
          ),
        ),
        Align(
          alignment: Alignment.center,
          child: TextButton.icon(
            onPressed: () => setState(() => _toolPage = 1 - _toolPage),
            icon: Icon(
              _toolPage == 0
                  ? Icons.chevron_right_rounded
                  : Icons.chevron_left_rounded,
              size: 17,
            ),
            label: UiText(_toolPage == 0 ? '更多工具' : '返回常用工具'),
            style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
          ),
        ),
      ],
    );
  }

  Widget _orbitShortcut(MessageLayout layout) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsetsDirectional.only(
        start: layout.px(13),
        bottom: layout.px(8),
      ),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: SizedBox.square(
          dimension: math.min(layout.px(106), widget.availableHeight * .16),
          child: IconButton(
            tooltip: context.uiLabel('添加星轨短片'),
            style: IconButton.styleFrom(
              backgroundColor: colors.secondaryContainer,
              foregroundColor: colors.onSecondaryContainer,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(layout.px(14)),
              ),
            ),
            onPressed: _stageOrbit,
            icon: Icon(Icons.slow_motion_video_rounded, size: layout.px(44)),
          ),
        ),
      ),
    );
  }

  Future<void> _toggleVoice() {
    if (_recording) return _finishVoice(keep: true);
    _focus.unfocus();
    return _withMedia(() async {
      final recorder = _recorder ??= MessageVoiceRecorder();
      await recorder.start();
      if (!mounted) return;
      if (!_canRecord) {
        await recorder.discard();
        return;
      }
      setState(() {
        _recording = true;
        _panel = null;
      });
      _recordingLimit = Timer(voiceDuration, _toggleVoice);
    }, '暂时无法录音，请检查麦克风权限。');
  }

  Future<void> _holdMicrophone() async {
    if (_recording || _working || _sending) return;
    _holdingMic = true;
    await _toggleVoice();
    if (mounted && !_holdingMic && _recording && !_working) {
      await _finishVoice(keep: _canRecord);
    }
  }

  void _releaseMicrophone() {
    if (!_holdingMic) return;
    _holdingMic = false;
    if (_recording && !_working) unawaited(_finishVoice(keep: _canRecord));
  }

  Future<void> _finishVoice({required bool keep}) {
    _recordingLimit?.cancel();
    final recorder = _recorder!;
    return _withMedia(() async {
      try {
        if (keep) {
          final audio = await recorder.stop();
          if (mounted && audio != null) _setAttachment(audio);
        } else {
          await recorder.discard();
        }
      } finally {
        if (mounted) setState(() => _recording = false);
      }
    }, '录音未能完成，请重试。');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final layout = MessageLayout.of(context);
    final locked = _sending || _working;
    final canCompose = !locked && !_recording;
    final reactionFont = _isGroup ? 13.0 : layout.px(18);
    final reactionHeight = math.max(
      _isGroup ? 35.0 : layout.px(50),
      MediaQuery.textScalerOf(context).scale(reactionFont) + layout.px(18),
    );
    return Material(
      color: _isGroup
          ? groupChatBackground(theme)
          : theme.scaffoldBackgroundColor,
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: widget.availableHeight),
          child: SingleChildScrollView(
            primary: false,
            reverse: true,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!_isGroup) const Divider(height: 1),
                if (!_recording && _panel == null)
                  SizedBox(
                    height: reactionHeight + (_isGroup ? 12 : layout.px(16)),
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: EdgeInsets.symmetric(
                        horizontal: _isGroup ? 10 : layout.px(13),
                        vertical: _isGroup ? 6 : layout.px(8),
                      ),
                      children: [
                        for (final (symbol, label) in _quickReactions)
                          Padding(
                            padding: EdgeInsetsDirectional.only(
                              end: _isGroup ? 8 : layout.px(15),
                            ),
                            child: ActionChip(
                              visualDensity: VisualDensity.compact,
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                              shape: _isGroup
                                  ? RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    )
                                  : null,
                              side: _isGroup
                                  ? BorderSide(color: colors.outlineVariant)
                                  : BorderSide.none,
                              backgroundColor: _isGroup
                                  ? colors.surface
                                  : colors.secondaryContainer,
                              onPressed: canCompose
                                  ? () => _sendQuick(symbol)
                                  : null,
                              label: Text(
                                '$symbol ${context.uiLabel(label)}',
                                style: TextStyle(
                                  color: _isGroup
                                      ? colors.onSurfaceVariant
                                      : colors.onSecondaryContainer,
                                  fontSize: reactionFont,
                                  fontFamilyFallback: const [
                                    messageEmojiFamily,
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (_working) const LinearProgressIndicator(minHeight: 2),
                if (_error case final error?)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: UiText(
                      error,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.error,
                      ),
                    ),
                  ),
                if (widget.reply case final reply?)
                  _draftItem(
                    Icons.reply_rounded,
                    '${reply.senderName ?? context.uiLabel('木星环用户')} · '
                        '${messageSnippet(context, reply.body, reply.attachment?.kind)}',
                    '取消引用',
                    canCompose ? widget.onCancelReply : null,
                  ),
                if (_attachment case final attachment?)
                  _draftItem(
                    mediaIcon(attachment.details.kind),
                    '${attachment.details.name} · ${messageSize(attachment.details.size)}',
                    '移除附件',
                    canCompose ? () => _setAttachment(null) : null,
                  ),
                if (_panel == _ComposerPanel.tools && _toolPage == 0)
                  _orbitShortcut(layout),
                _composerBar(layout, locked: locked, canCompose: canCompose),
                if (_panel == _ComposerPanel.stickers)
                  MessageStickerPanel(
                    workspace: widget.workspace,
                    maxGridHeight: widget.availableHeight * .44,
                    send: _stageSticker,
                  ),
                if (_panel == _ComposerPanel.tools) _toolPanel(layout),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _composerBar(
    MessageLayout layout, {
    required bool locked,
    required bool canCompose,
  }) {
    final colors = Theme.of(context).colorScheme;
    final hasDraft = _draft.text.trim().isNotEmpty || _attachment != null;
    final edge = _isGroup ? 10.0 : layout.px(13);
    final height = _isGroup ? 50.0 : layout.px(64);
    final actionStyle = IconButton.styleFrom(
      fixedSize: Size(_isGroup ? 42 : layout.px(64), height),
      minimumSize: Size.zero,
      padding: EdgeInsets.zero,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      iconSize: _isGroup ? 22 : layout.px(34),
    );
    return Padding(
      padding: EdgeInsets.fromLTRB(
        edge,
        layout.px(4),
        edge,
        _isGroup ? 10 : layout.px(15),
      ),
      child: Material(
        color: _isGroup ? colors.surface : colors.surfaceContainerLow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_isGroup ? 17 : layout.px(26)),
          side: BorderSide(color: colors.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: height),
          child: Row(
            children: [
              IconButton(
                tooltip: context.uiLabel('一起互动'),
                style: actionStyle,
                onPressed: canCompose ? () => _openActivities() : null,
                icon: const Icon(Icons.widgets_outlined),
              ),
              Expanded(
                child: _recording
                    ? const UiText('正在录音，最长 45 秒')
                    : TextField(
                        controller: _draft,
                        focusNode: _focus,
                        readOnly: locked,
                        minLines: 1,
                        maxLines: 3,
                        keyboardType: TextInputType.multiline,
                        textInputAction: TextInputAction.send,
                        style: TextStyle(
                          fontSize: _isGroup ? 15 : layout.px(22),
                          fontFamilyFallback: const [messageEmojiFamily],
                        ),
                        onTap: () {
                          if (_panel != null) setState(() => _panel = null);
                        },
                        onChanged: (_) => _edit(),
                        onSubmitted: (_) => _send(),
                        decoration: InputDecoration(
                          hintText: context.uiLabel(
                            _isGroup ? '发消息或按住说话…' : '发消息',
                          ),
                          hintMaxLines: 1,
                          isDense: true,
                          filled: false,
                          contentPadding: EdgeInsets.symmetric(
                            vertical: layout.px(10),
                          ),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                        ),
                      ),
              ),
              GestureDetector(
                onLongPressStart: (_) => _holdMicrophone(),
                onLongPressEnd: (_) => _releaseMicrophone(),
                onLongPressCancel: _releaseMicrophone,
                child: IconButton(
                  tooltip: context.uiLabel(_recording ? '结束录音' : '录音'),
                  style: actionStyle,
                  onPressed: locked ? null : _toggleVoice,
                  icon: Icon(
                    _recording
                        ? Icons.stop_circle_outlined
                        : Icons.mic_none_rounded,
                  ),
                ),
              ),
              if (_recording)
                TextButton(
                  onPressed: locked ? null : _toggleVoice,
                  child: const UiText('结束'),
                )
              else ...[
                IconButton(
                  tooltip: context.uiLabel('表情'),
                  style: actionStyle,
                  onPressed: canCompose
                      ? () => _togglePanel(_ComposerPanel.stickers)
                      : null,
                  isSelected: _panel == _ComposerPanel.stickers,
                  icon: const Icon(Icons.emoji_emotions_outlined),
                ),
                IconButton(
                  tooltip: context.uiLabel('添加附件'),
                  style: actionStyle,
                  onPressed: canCompose
                      ? () => _togglePanel(_ComposerPanel.tools)
                      : null,
                  icon: Icon(
                    _panel == _ComposerPanel.tools
                        ? Icons.close_rounded
                        : Icons.add_circle_outline_rounded,
                  ),
                ),
                if (hasDraft || _sending)
                  IconButton(
                    tooltip: context.uiLabel('发送'),
                    style: actionStyle.copyWith(
                      foregroundColor: WidgetStatePropertyAll(colors.primary),
                    ),
                    onPressed: canCompose ? _send : null,
                    icon: _sending
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _draftItem(
    IconData icon,
    String text,
    String action,
    VoidCallback? onRemove,
  ) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
      child: Material(
        color: colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsetsDirectional.only(start: 10),
          child: Row(
            children: [
              Icon(icon, size: 18, color: colors.onSurfaceVariant),
              const SizedBox(width: 8),
              Expanded(
                child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              IconButton(
                tooltip: context.uiLabel(action),
                onPressed: onRemove,
                icon: const Icon(Icons.close_rounded, size: 18),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
