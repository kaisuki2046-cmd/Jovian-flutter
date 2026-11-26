import 'dart:math' as math;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

const _assistantPortrait =
    'src/features/divination/assets/assistant/portrait.png';
const guideSuggestedQuestions = ['这次面试会顺利吗？', '这段感情接下来会怎么发展？', '最近什么时候适合搬家？'];

class GuideWelcome extends StatelessWidget {
  const GuideWelcome({super.key, this.offline = false});

  final bool offline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 12),
      child: Column(
        children: [
          DecoratedBox(
            decoration: ShapeDecoration(
              color: colors.surfaceContainerLow,
              shape: StadiumBorder(
                side: BorderSide(color: colors.outlineVariant),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              child: Text(
                '有什么事情想知道吗？',
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium,
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
                  color: colors.surfaceContainerLow,
                  border: Border(
                    right: BorderSide(color: colors.outlineVariant),
                    bottom: BorderSide(color: colors.outlineVariant),
                  ),
                ),
              ),
            ),
          ),
          FractionallySizedBox(
            widthFactor: .55,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 204),
                child: const GuideAssistantPortrait(accessible: true),
              ),
            ),
          ),
          if (offline)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '本机起盘 · 六爻、塔罗和梅花易数',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }
}

class GuideAssistantPortrait extends StatelessWidget {
  const GuideAssistantPortrait({super.key, this.accessible = false});

  final bool accessible;

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 1,
    child: Image.asset(
      _assistantPortrait,
      fit: BoxFit.contain,
      semanticLabel: accessible ? '戴着蓝色耳机的果冻章鱼助手' : null,
      excludeFromSemantics: !accessible,
    ),
  );
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
          child: Text(
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
              onPressed: select == null ? null : () => select!(question),
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
              child: Text(question, textAlign: TextAlign.start),
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
    required this.label,
    required this.sendLabel,
    required this.send,
    required this.busy,
    this.focus,
    this.suggest,
    this.actions = const [],
    this.followUp = false,
  });

  final GlobalKey<FormState> form;
  final TextEditingController text;
  final FocusNode? focus;
  final String label;
  final String sendLabel;
  final VoidCallback send;
  final bool busy;
  final bool followUp;
  final ValueChanged<String>? suggest;
  final List<Widget> actions;

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
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (suggest case final pick?)
                PopupMenuButton<String>(
                  tooltip: '快捷提问',
                  enabled: !busy,
                  onSelected: pick,
                  icon: const Icon(Icons.add_rounded),
                  iconSize: 24,
                  itemBuilder: (_) => [
                    for (final question in guideSuggestedQuestions)
                      PopupMenuItem(value: question, child: Text(question)),
                  ],
                  style: IconButton.styleFrom(
                    minimumSize: const Size(44, 52),
                    backgroundColor: colors.surfaceContainerLow,
                    foregroundColor: colors.onSurface,
                  ),
                )
              else if (followUp)
                const SizedBox(
                  width: 48,
                  height: 56,
                  child: Padding(
                    padding: EdgeInsets.all(2),
                    child: GuideAssistantPortrait(),
                  ),
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
                            child: TextFormField(
                              controller: text,
                              focusNode: focus,
                              enabled: !busy,
                              style: inputText,
                              decoration: InputDecoration(
                                labelText: label,
                                floatingLabelBehavior:
                                    FloatingLabelBehavior.never,
                                labelStyle: TextStyle(
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
                              onFieldSubmitted: busy ? null : (_) => send(),
                            ),
                          ),
                        ),
                        IconButton.filled(
                          tooltip: sendLabel,
                          onPressed: busy ? null : send,
                          style: IconButton.styleFrom(
                            backgroundColor: colors.onSurface,
                            foregroundColor: colors.surface,
                          ),
                          icon: const Icon(Icons.arrow_upward_rounded),
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

class GuideThread extends StatelessWidget {
  const GuideThread({
    super.key,
    required this.messages,
    this.composer,
    this.welcome,
    this.headerAction,
    this.scroll,
  });

  final List<Widget> messages;
  final Widget? composer;
  final GuideWelcome? welcome;
  final Widget? headerAction;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (headerAction case final action?)
            Align(alignment: AlignmentDirectional.centerEnd, child: action),
          Expanded(
            child: LayoutBuilder(
              builder: (context, viewport) => SingleChildScrollView(
                controller: scroll,
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
                    mainAxisAlignment: welcome == null
                        ? MainAxisAlignment.start
                        : MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (welcome case final stage?) stage,
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: messages,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (composer case final footer?) footer,
        ],
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
                Text(
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
