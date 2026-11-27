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
    this.preparedTarot,
    this.showingEarlyTarot,
    this.finishTarot,
    this.onRevealChanged,
    this.openAiPermissions,
  });

  final GuideRitualPresentation presentation;
  final Listenable changes;
  final GuideRitualSnapshot? Function() snapshot;
  final List<int>? Function()? preparedTarot;
  final bool Function()? showingEarlyTarot;
  final VoidCallback? finishTarot;
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
  bool _cardInFlight = false;

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
    if (!mounted || _settled == count) return;
    setState(() => _settled = count);
    final snapshot = widget.snapshot();
    if (snapshot != null &&
        snapshot.tarotFirst &&
        snapshot.stage == GuideStage.reading &&
        count == snapshot.tosses.length) {
      widget.pause();
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.changes,
    builder: (context, _) => _dialog(context),
  );

  Widget _dialog(BuildContext context) {
    final theme = Theme.of(context);
    final motionOff = MediaQuery.disableAnimationsOf(context);
    final snapshot = widget.snapshot();
    final presentation = widget.presentation;
    final preparedTarot = widget.preparedTarot?.call();
    final serverTarotFirst = snapshot?.tarotFirst == true;
    final tarotFirst = preparedTarot != null || serverTarotFirst;
    final earlyTarot = widget.showingEarlyTarot?.call() == true;
    final cardInFlight = _cardInFlight && !motionOff;
    final pickingFirst =
        preparedTarot != null &&
        snapshot?.stage == GuideStage.cast &&
        (preparedTarot.length < TarotPosition.values.length || cardInFlight);
    final casting =
        snapshot != null &&
        !pickingFirst &&
        !earlyTarot &&
        (snapshot.stage == GuideStage.cast ||
            snapshot.tosses.length > _settled ||
            (serverTarotFirst && snapshot.stage == GuideStage.reading) ||
            (preparedTarot != null && snapshot.stage == GuideStage.draw));
    final picking =
        pickingFirst || (!casting && snapshot?.stage == GuideStage.draw);
    final selected = pickingFirst
        ? preparedTarot
        : snapshot?.selectedSlots ?? const <int>[];
    final slotCount = pickingFirst
        ? tarotDeck.length
        : snapshot?.slotCount ?? 0;
    if (motionOff && picking) presentation.preparation = 1;
    final preparing =
        !motionOff &&
        picking &&
        selected.isEmpty &&
        presentation.preparation < 1;
    final flippingEarly = earlyTarot && !cardInFlight;
    final flipping =
        flippingEarly ||
        (!casting &&
            !serverTarotFirst &&
            !cardInFlight &&
            snapshot?.stage == GuideStage.reading);
    final title = casting
        ? '投三枚铜钱'
        : flipping
        ? '翻开三张塔罗牌'
        : '选择三张塔罗牌';
    final step = flippingEarly
        ? '第 1 步 · 塔罗翻牌'
        : switch ((tarotFirst, casting, flipping)) {
            (true, true, _) => '第 2 步 · 六爻起卦',
            (false, true, _) => '第 1 步 · 六爻起卦',
            (true, _, true) => '仪式完成',
            (false, _, true) => '第 2 步 · 塔罗翻牌',
            (true, _, _) => '第 1 步 · 塔罗选牌',
            (false, _, _) => '第 2 步 · 塔罗选牌',
          };
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
              key: ValueKey(casting ? 'cast' : 'cards'),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (error != null && !flipping && !cardInFlight)
                    Semantics(
                      liveRegion: true,
                      child: UiText(
                        error,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ),
                  if (!busy && permission != null && !flipping && !cardInFlight)
                    OutlinedButton(
                      onPressed: permission,
                      child: const UiText('前往 AI 授权'),
                    ),
                  if (!busy && retry != null && !flipping && !cardInFlight)
                    TextButton(onPressed: retry, child: const UiText('重试仪式同步')),
                  if (snapshot == null)
                    const UiText('这次算事的进度暂时无法读取。')
                  else if (casting)
                    CoinCastRitual(
                      tosses: snapshot.tosses,
                      pending: busy,
                      active: _active,
                      reducedMotion: motionOff,
                      stageHeightLimit: math.max(
                        144,
                        MediaQuery.sizeOf(context).height * 0.37,
                      ),
                      onToss: widget.toss,
                      onSettled: _settle,
                    )
                  else
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
                        child: TarotRitualPanel(
                          slotCount: slotCount,
                          selectedSlots: selected,
                          draw: flipping ? snapshot.tarotDraw : null,
                          revealed: presentation.revealed,
                          busy: busy,
                          selectionBlocked: retry != null && !flipping,
                          active: _active,
                          reducedMotion: motionOff,
                          choose: widget.choose,
                          cardFlight: (flying) {
                            if (_cardInFlight != flying) {
                              setState(() => _cardInFlight = flying);
                            }
                          },
                          preparation: preparing
                              ? TarotDeckPreparation(
                                  slotCount: slotCount,
                                  cutIndex:
                                      (pickingFirst
                                          ? null
                                          : snapshot.tarotCutIndex) ??
                                      _presentationCut(
                                        slotCount,
                                        presentation.seed,
                                      ),
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
                              : null,
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
                          finish: flippingEarly
                              ? widget.finishTarot ?? widget.pause
                              : widget.pause,
                          finishLabel: flippingEarly ? '继续六爻起卦' : '查看解读',
                        ),
                      ),
                    ),
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

// For older snapshots the cut is visual only. Keep the same marker when resuming.
int? _presentationCut(int slotCount, int seed) {
  if (slotCount < 2) return null;
  final first = (slotCount * 0.45).ceil().clamp(1, slotCount - 1);
  final last = (slotCount * 0.55).floor().clamp(first, slotCount - 1);
  return first + (seed / (1 << 30) * (last - first + 1)).floor();
}
