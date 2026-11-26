import 'dart:async';
import 'dart:math' as math;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import 'composer_attachment.dart';
import 'composer_attachment_view.dart';
import 'guide_assistant.dart';

const guideSuggestedQuestions = ['这次面试会顺利吗？', '这段感情接下来会怎么发展？', '最近什么时候适合搬家？'];

class GuideWelcome extends StatelessWidget {
  const GuideWelcome({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final viewport = MediaQuery.sizeOf(context);
    final portraitSize = math.min(
      204.0,
      math.min((viewport.width - 36) * .55, viewport.height * .34),
    );
    final welcomeInset = (viewport.height / 3 - 104 - portraitSize / 2).clamp(
      14.0,
      84.0,
    );
    final bubbleColor = theme.brightness == Brightness.dark
        ? const Color(0xffdddfdc)
        : colors.surfaceContainerLow;
    const bubbleLine = Color(0xffdfddd4);
    return Padding(
      padding: EdgeInsets.only(top: welcomeInset, bottom: 12),
      child: Column(
        children: [
          DecoratedBox(
            decoration: ShapeDecoration(
              color: bubbleColor,
              shape: const StadiumBorder(side: BorderSide(color: bubbleLine)),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              child: UiText(
                '有什么事情想知道吗？',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: const Color(0xff292824),
                  fontSize: 18,
                ),
              ),
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -5),
            child: Transform.rotate(
              angle: math.pi / 4,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: bubbleColor,
                  border: const Border(
                    right: BorderSide(color: bubbleLine),
                    bottom: BorderSide(color: bubbleLine),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(
            width: portraitSize,
            child: const GuideAssistantWelcomePortrait(),
          ),
        ],
      ),
    );
  }
}

class GuideSuggestions extends StatelessWidget {
  const GuideSuggestions({super.key, required this.select});

  final ValueChanged<String>? select;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: UiText(
            '为你推荐',
            style: theme.textTheme.labelMedium?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(height: 5),
        for (final question in guideSuggestedQuestions)
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: OutlinedButton(
              onPressed: select == null
                  ? null
                  : () => select!(context.uiLabel(question)),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.onSurface,
                backgroundColor: colors.surfaceContainerLow.withValues(
                  alpha: .78,
                ),
                minimumSize: const Size(44, 40),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                side: BorderSide(color: colors.outlineVariant),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: UiText(question, textAlign: TextAlign.start),
            ),
          ),
      ],
    );
  }
}

class GuideComposer extends StatelessWidget {
  const GuideComposer({
    super.key,
    required this.form,
    required this.text,
    required this.hint,
    required this.sendLabel,
    required this.send,
    required this.busy,
    required this.attachments,
    required this.addAttachment,
    required this.removeAttachment,
    required this.suggest,
    required this.startQuestion,
    this.focus,
    this.stop,
    this.openSynastry,
    this.attachmentError,
    this.actions = const [],
    this.showAssistant = false,
    this.textSendingAvailable = true,
  });

  final GlobalKey<FormState> form;
  final TextEditingController text;
  final FocusNode? focus;
  final String hint;
  final String sendLabel;
  final VoidCallback send;
  final bool textSendingAvailable;
  final VoidCallback? stop;
  final bool busy;
  final bool showAssistant;
  final ValueChanged<String> suggest;
  final VoidCallback startQuestion;
  final VoidCallback? openSynastry;
  final List<ComposerAttachment> attachments;
  final ValueChanged<ComposerAttachmentKind> addAttachment;
  final ValueChanged<ComposerAttachment> removeAttachment;
  final String? attachmentError;
  final List<Widget> actions;

  bool _canSend(String value) =>
      !busy &&
      (value.trim().isEmpty ? attachments.isNotEmpty : textSendingAvailable);

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final inputText = Theme.of(context).textTheme.bodyLarge;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 5, 14, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (actions.isNotEmpty)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Wrap(spacing: 6, runSpacing: 4, children: actions),
            ),
          if (attachmentError case final message?)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Semantics(
                liveRegion: true,
                child: Text(message, style: TextStyle(color: colors.error)),
              ),
            ),
          if (attachments.isNotEmpty)
            ComposerAttachmentTray(
              attachments: attachments,
              remove: busy ? null : removeAttachment,
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _GuideComposerMenu(
                busy: busy,
                showAssistant: showAssistant,
                addAttachment: addAttachment,
                startQuestion: startQuestion,
                openSynastry: openSynastry,
                suggest: suggest,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: colors.outlineVariant),
                  ),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(14, 2, 5, 2),
                    child: Row(
                      children: [
                        Expanded(
                          child: Form(
                            key: form,
                            child: Semantics(
                              label: context.uiLabel('你的问题'),
                              child: TextFormField(
                                controller: text,
                                focusNode: focus,
                                enabled: !busy,
                                style: inputText,
                                decoration: InputDecoration(
                                  hintText: context.uiLabel(hint),
                                  hintStyle: TextStyle(
                                    color: colors.onSurfaceVariant,
                                  ),
                                  filled: false,
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  disabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  errorBorder: InputBorder.none,
                                  focusedErrorBorder: InputBorder.none,
                                  errorMaxLines: 3,
                                  counterText: '',
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                ),
                                minLines: 1,
                                maxLines: 4,
                                maxLength: guideQuestionMaxLength,
                                textInputAction: TextInputAction.send,
                                validator: (input) =>
                                    validateGuideQuestion(input ?? ''),
                                onFieldSubmitted: (value) {
                                  if (_canSend(value)) send();
                                },
                              ),
                            ),
                          ),
                        ),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: text,
                          builder: (context, draft, _) {
                            if (stop == null &&
                                draft.text.trim().isEmpty &&
                                attachments.isEmpty) {
                              return const SizedBox(width: 8);
                            }
                            return IconButton.filled(
                              tooltip: context.uiLabel(
                                stop == null ? sendLabel : '停止',
                              ),
                              onPressed:
                                  stop ?? (_canSend(draft.text) ? send : null),
                              style: IconButton.styleFrom(
                                backgroundColor: colors.onSurface,
                                foregroundColor: colors.surface,
                              ),
                              icon: Icon(
                                stop == null
                                    ? Icons.arrow_upward_rounded
                                    : Icons.stop_rounded,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GuideComposerMenu extends StatefulWidget {
  const _GuideComposerMenu({
    required this.busy,
    required this.showAssistant,
    required this.addAttachment,
    required this.startQuestion,
    required this.openSynastry,
    required this.suggest,
  });

  final bool busy;
  final bool showAssistant;
  final ValueChanged<ComposerAttachmentKind> addAttachment;
  final VoidCallback startQuestion;
  final VoidCallback? openSynastry;
  final ValueChanged<String> suggest;

  @override
  State<_GuideComposerMenu> createState() => _GuideComposerMenuState();
}

class _GuideComposerMenuState extends State<_GuideComposerMenu> {
  bool _shortcuts = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return MenuAnchor(
      onClose: () {
        if (_shortcuts) setState(() => _shortcuts = false);
      },
      menuChildren: _shortcuts
          ? [
              MenuItemButton(
                closeOnActivate: false,
                leadingIcon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _shortcuts = false),
                child: const UiText('返回'),
              ),
              MenuItemButton(
                onPressed: widget.startQuestion,
                child: const UiText('算一件事'),
              ),
              if (widget.openSynastry case final open?)
                MenuItemButton(onPressed: open, child: const UiText('看合盘')),
              MenuItemButton(
                onPressed: () => widget.suggest(context.uiLabel('帮我看看最近的整体运势')),
                child: const UiText('帮我看看最近的整体运势'),
              ),
            ]
          : [
              MenuItemButton(
                leadingIcon: const Icon(Icons.photo_outlined),
                onPressed: () =>
                    widget.addAttachment(ComposerAttachmentKind.image),
                child: const UiText('添加图片'),
              ),
              MenuItemButton(
                leadingIcon: const Icon(Icons.insert_drive_file_outlined),
                onPressed: () =>
                    widget.addAttachment(ComposerAttachmentKind.file),
                child: const UiText('添加文件'),
              ),
              MenuItemButton(
                closeOnActivate: false,
                leadingIcon: const Icon(Icons.bolt_outlined),
                onPressed: () => setState(() => _shortcuts = true),
                child: const UiText('快捷提问'),
              ),
            ],
      builder: (context, menu, _) => IconButton(
        tooltip: context.uiLabel('添加附件或快捷提问'),
        onPressed: widget.busy
            ? null
            : () {
                if (menu.isOpen) {
                  menu.close();
                } else {
                  FocusScope.of(context).unfocus();
                  menu.open();
                }
              },
        style: IconButton.styleFrom(
          minimumSize: const Size.square(44),
          backgroundColor: widget.showAssistant
              ? null
              : colors.surfaceContainerLow,
          foregroundColor: colors.onSurface,
        ),
        icon: widget.showAssistant
            ? const GuideAssistantComposerPortrait()
            : const Icon(Icons.add_rounded),
      ),
    );
  }
}

class GuideThread extends StatefulWidget {
  const GuideThread({
    super.key,
    required this.messages,
    required this.latestMessage,
    required this.sentRevision,
    this.composer,
    this.welcome,
  });

  final List<Widget> messages;
  final Object latestMessage;
  final int sentRevision;
  final Widget? composer;
  final GuideWelcome? welcome;

  @override
  State<GuideThread> createState() => _GuideThreadState();
}

class _GuideThreadState extends State<GuideThread> {
  final _scroll = ScrollController();
  bool _showLatest = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_updateLatestButton);
  }

  @override
  void didUpdateWidget(GuideThread oldWidget) {
    super.didUpdateWidget(oldWidget);
    final welcoming = widget.welcome != null;
    final shouldScroll = welcoming
        ? oldWidget.welcome == null
        : widget.sentRevision != oldWidget.sentRevision ||
              (widget.latestMessage != oldWidget.latestMessage && !_showLatest);
    if (shouldScroll) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scroll.hasClients) return;
        final position = _scroll.position;
        _scroll.jumpTo(
          widget.welcome == null
              ? position.maxScrollExtent
              : position.minScrollExtent,
        );
      });
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _updateLatestButton() {
    if (!_scroll.hasClients || !_scroll.position.hasContentDimensions) return;
    final show = _scroll.position.extentAfter > 80;
    if (show != _showLatest) setState(() => _showLatest = show);
  }

  void _goToLatest() {
    final end = _scroll.position.maxScrollExtent;
    if (MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context)) {
      _scroll.jumpTo(end);
    } else {
      unawaited(
        _scroll.animateTo(
          end,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => GuideAssistantFlight(
    welcoming: widget.welcome != null,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: NotificationListener<ScrollMetricsNotification>(
                      onNotification: (_) {
                        _updateLatestButton();
                        return false;
                      },
                      child: LayoutBuilder(
                        builder: (context, viewport) => SingleChildScrollView(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: (viewport.maxHeight - 16).clamp(
                                0,
                                double.infinity,
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: widget.welcome == null
                                  ? MainAxisAlignment.start
                                  : MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (widget.welcome case final stage?) stage,
                                Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: widget.messages,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_showLatest && widget.welcome == null)
                    PositionedDirectional(
                      end: 16,
                      bottom: 8,
                      child: IconButton.filledTonal(
                        tooltip: '返回最新消息',
                        onPressed: _goToLatest,
                        icon: const Icon(Icons.arrow_downward_rounded),
                      ),
                    ),
                ],
              ),
            ),
            if (widget.composer case final footer?) footer,
          ],
        ),
      ),
    ),
  );
}

Widget guideComposerAction({
  required String label,
  required VoidCallback? action,
}) => TextButton(
  onPressed: action,
  style: TextButton.styleFrom(
    minimumSize: const Size(44, 40),
    padding: const EdgeInsets.symmetric(horizontal: 12),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  ),
  child: Text(label),
);

class GuideAssistantMessage extends StatelessWidget {
  const GuideAssistantMessage({super.key, required this.content});

  final Widget content;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: FractionallySizedBox(
        widthFactor: .96,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surfaceContainerLow,
            border: Border.all(color: colors.outlineVariant),
            borderRadius: const BorderRadiusDirectional.only(
              topStart: Radius.circular(18),
              topEnd: Radius.circular(18),
              bottomStart: Radius.circular(6),
              bottomEnd: Radius.circular(18),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                UiText(
                  'AI 助手',
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 10),
                content,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
