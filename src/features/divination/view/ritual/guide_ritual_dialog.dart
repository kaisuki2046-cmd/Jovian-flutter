import 'dart:math' as math;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'coin_cast_ritual.dart';
import 'tarot_preparation.dart';
import 'tarot_ritual.dart';

class GuideRitualPresentation {
  final seed = math.Random().nextInt(1 << 30);
  final revealed = <int>{};
  double preparation = 0;
}

class GuideRitualDialog extends StatefulWidget {
  const GuideRitualDialog({
    super.key,
    required this.presentation,
    required this.changes,
    required this.snapshot,
    required this.busy,
    required this.error,
    required this.retry,
    required this.toss,
    required this.choose,
    required this.pause,
    this.onRevealChanged,
    this.openAiPermissions,
  });

  final GuideRitualPresentation presentation;
  final Listenable changes;
  final GuideRitualSnapshot? Function() snapshot;
  final bool Function() busy;
  final String? Function() error;
  final VoidCallback? Function() retry;
  final VoidCallback? Function()? openAiPermissions;
  final VoidCallback toss;
  final ValueChanged<int> choose;
  final VoidCallback pause;
  final ValueChanged<Set<int>>? onRevealChanged;

  @override
  State<GuideRitualDialog> createState() => _GuideRitualDialogState();
}

class _GuideRitualDialogState extends State<GuideRitualDialog>
    with WidgetsBindingObserver {
  late int _settled;
  bool _active = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    _active = state == null || state == AppLifecycleState.resumed;
    _settled = widget.snapshot()?.tosses.length ?? 0;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    setState(() => _active = state == AppLifecycleState.resumed);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _settle(int count) {
    if (mounted && _settled != count) setState(() => _settled = count);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.changes,
    builder: (context, _) => _dialog(context),
  );

  Widget _dialog(BuildContext context) {
    final theme = Theme.of(context);
    final motionOff =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    final snapshot = widget.snapshot();
    final presentation = widget.presentation;
    if (motionOff && snapshot?.stage == GuideStage.draw) {
      presentation.preparation = 1;
    }
    final casting =
        snapshot != null &&
        (snapshot.stage == GuideStage.cast ||
            snapshot.tosses.length > _settled);
    final preparing =
        !casting &&
        !motionOff &&
        snapshot?.stage == GuideStage.draw &&
        snapshot!.selectedSlots.isEmpty &&
        presentation.preparation < 1;
    final flipping = !casting && snapshot?.stage == GuideStage.reading;
    final title = casting
        ? '投三枚铜钱'
        : flipping
        ? '翻开三张塔罗牌'
        : preparing
        ? (snapshot.tarotCutIndex == null ? '准备塔罗牌' : '洗牌与切牌')
        : '选择三张塔罗牌';
    final step = casting
        ? '第 1 步 · 六爻起卦'
        : flipping
        ? '第 2 步 · 塔罗翻牌'
        : preparing
        ? '第 2 步 · 塔罗准备'
        : '第 2 步 · 塔罗选牌';
    final busy = widget.busy();
    final error = widget.error();
    final retry = widget.retry();
    final permission = widget.openAiPermissions?.call();
    return Dialog(
      key: const ValueKey('guide-ritual-dialog'),
      insetPadding: const EdgeInsets.all(12),
      constraints: const BoxConstraints(maxWidth: 460),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(18, 16, 10, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      UiText(step, style: theme.textTheme.labelMedium),
                      const SizedBox(height: 4),
                      Semantics(
                        container: true,
                        header: true,
                        child: UiText(
                          title,
                          style: theme.textTheme.headlineSmall,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: context.uiLabel('暂停仪式'),
                  icon: const Icon(Icons.close),
                  onPressed: widget.pause,
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: SingleChildScrollView(
              key: ValueKey(
                casting
                    ? 'cast'
                    : preparing
                    ? 'prepare'
                    : 'cards',
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (error != null && !flipping)
                    Semantics(
                      liveRegion: true,
                      child: UiText(
                        error,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ),
                  if (!busy && permission != null && !flipping)
                    OutlinedButton(
                      onPressed: permission,
                      child: const UiText('前往 AI 授权'),
                    ),
                  if (!busy && retry != null && !flipping)
                    TextButton(onPressed: retry, child: const UiText('重试仪式同步')),
                  if (snapshot == null)
                    const UiText('这次算事的进度暂时无法读取。')
                  else if (casting)
                    CoinCastRitual(
                      tosses: snapshot.tosses,
                      pending: busy,
                      active: _active,
                      reducedMotion: motionOff,
                      onToss: widget.toss,
                      onSettled: _settle,
                    )
                  else ...[
                    if (snapshot.castResult case final result?) ...[
                      Text(
                        context
                            .uiLabel('六爻卜卦结果：{result}')
                            .replaceFirst('{result}', result.base.primary.name),
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                    ],
                    Material(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                        side: BorderSide(
                          color: theme.colorScheme.outlineVariant,
                        ),
                      ),
                      color: theme.colorScheme.surface,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: preparing
                            ? TarotDeckPreparation(
                                slotCount: snapshot.slotCount,
                                cutIndex: snapshot.tarotCutIndex,
                                initialProgress: presentation.preparation,
                                seed: presentation.seed,
                                active: _active,
                                reducedMotion: motionOff,
                                progress: (value) =>
                                    presentation.preparation = value,
                                finish: () => setState(
                                  () => presentation.preparation = 1,
                                ),
                              )
                            : TarotRitualPanel(
                                slotCount: snapshot.slotCount,
                                selectedSlots: snapshot.selectedSlots,
                                draw: snapshot.chart?.tarot,
                                revealed: presentation.revealed,
                                busy: busy,
                                selectionBlocked: retry != null && !flipping,
                                active: _active,
                                reducedMotion: motionOff,
                                choose: widget.choose,
                                reveal: (slot) {
                                  setState(() {
                                    if (slot == null) {
                                      presentation.revealed.addAll(
                                        snapshot.selectedSlots,
                                      );
                                    } else {
                                      presentation.revealed.add(slot);
                                    }
                                  });
                                  widget.onRevealChanged?.call(
                                    Set.unmodifiable(presentation.revealed),
                                  );
                                },
                                finish: widget.pause,
                              ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton(
              onPressed: widget.pause,
              child: const UiText('暂停'),
            ),
          ),
        ],
      ),
    );
  }
}
