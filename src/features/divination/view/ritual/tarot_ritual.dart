import 'dart:math' as math;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import 'tarot_deck.dart';

const _positions = ['现状', '关键影响', '趋势'];

class TarotRitualPanel extends StatefulWidget {
  const TarotRitualPanel({
    super.key,
    required this.slotCount,
    required this.selectedSlots,
    required this.draw,
    required this.revealed,
    required this.busy,
    required this.selectionBlocked,
    required this.active,
    required this.reducedMotion,
    required this.choose,
    required this.reveal,
    required this.finish,
    this.finishLabel = '查看解读',
    this.preparation,
    this.cardFlight,
  });

  final int slotCount;
  final List<int> selectedSlots;
  final TarotDraw? draw;
  final Set<int> revealed;
  final bool busy;
  final bool selectionBlocked;
  final bool active;
  final bool reducedMotion;
  final ValueChanged<int> choose;
  final ValueChanged<int?> reveal;
  final VoidCallback finish;
  final String finishLabel;
  final Widget? preparation;
  final ValueChanged<bool>? cardFlight;

  @override
  State<TarotRitualPanel> createState() => _TarotRitualPanelState();
}

class _TarotRitualPanelState extends State<TarotRitualPanel> {
  final _area = GlobalKey();
  final _targets = List.generate(_positions.length, (_) => GlobalKey());
  ({int slot, int index, Rect from, Rect to})? _flight;
  bool _arrived = false;

  @override
  void didUpdateWidget(TarotRitualPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.active ||
        widget.reducedMotion ||
        (_arrived && _canFinishFlight)) {
      _clearFlight();
    }
  }

  void _clearFlight() {
    if (_flight == null) return;
    _flight = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _flight == null) widget.cardFlight?.call(false);
    });
  }

  bool get _canFinishFlight {
    final flight = _flight;
    return flight != null &&
        (!widget.busy || widget.selectedSlots.length > flight.index);
  }

  void _choose(int slot, Rect origin) {
    final index = widget.selectedSlots.length;
    if (widget.busy ||
        widget.selectionBlocked ||
        _flight != null ||
        !widget.active ||
        index >= _positions.length)
      return;
    final targetContext = _targets[index].currentContext;
    final root = _area.currentContext?.findRenderObject();
    final target = targetContext?.findRenderObject();
    if (!widget.reducedMotion && root is RenderBox && target is RenderBox) {
      final from = root.globalToLocal(origin.topLeft) & origin.size;
      final to =
          root.globalToLocal(target.localToGlobal(Offset.zero)) & target.size;
      Scrollable.ensureVisible(
        targetContext!,
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart,
      );
      setState(() {
        _flight = (slot: slot, index: index, from: from, to: to);
        _arrived = false;
      });
      widget.cardFlight?.call(true);
    }
    widget.choose(slot);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final flight = _flight;
    final draw = flight == null ? widget.draw : null;
    final revealed =
        draw?.cards.every((card) => widget.revealed.contains(card.slot)) ??
        false;
    final held = widget.selectedSlots
        .take(flight?.index ?? widget.selectedSlots.length)
        .toList(growable: false);
    return Stack(
      key: _area,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (draw != null) ...[
              UiText(
                '轻触牌面逐张翻开，或一键全翻',
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var index = 0; index < _positions.length; index++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _TarotPosition(
                        frame: _targets[index],
                        label: _positions[index],
                        occupied: index < held.length,
                        card: draw?.cards[index],
                        revealed:
                            draw != null &&
                            widget.revealed.contains(draw.cards[index].slot),
                        reducedMotion: widget.reducedMotion,
                        reveal: widget.reveal,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            if (draw != null)
              FilledButton(
                onPressed: revealed ? widget.finish : () => widget.reveal(null),
                child: UiText(revealed ? widget.finishLabel : '一键翻牌'),
              )
            else ...[
              Semantics(
                liveRegion: true,
                child: Text(
                  context
                      .uiLabel('已选 {count} / 3 张')
                      .replaceFirst('{count}', held.length.toString()),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 10),
              UiText(
                '左右滑动，凭感觉选出你的牌',
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              widget.preparation ??
                  LayoutBuilder(
                    builder: (context, size) => TarotRitualFan(
                      layout: TarotFanLayout(size.maxWidth, widget.slotCount),
                      selectedSlots: {
                        ...widget.selectedSlots,
                        if (flight != null) flight.slot,
                      },
                      busy:
                          widget.busy ||
                          widget.selectionBlocked ||
                          !widget.active ||
                          flight != null,
                      reducedMotion: widget.reducedMotion,
                      choose: _choose,
                    ),
                  ),
            ],
          ],
        ),
        if (flight != null)
          Positioned.fill(
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: TweenAnimationBuilder<Rect?>(
                  key: ValueKey(flight.slot),
                  tween: RectTween(begin: flight.from, end: flight.to),
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeInOutCubic,
                  onEnd: () => setState(() {
                    _arrived = true;
                    if (_canFinishFlight) _clearFlight();
                  }),
                  builder: (context, frame, child) => Stack(
                    children: [
                      Positioned.fromRect(rect: frame!, child: child!),
                    ],
                  ),
                  child: const TarotBackArt(),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _TarotPosition extends StatelessWidget {
  const _TarotPosition({
    required this.frame,
    required this.label,
    required this.occupied,
    required this.card,
    required this.revealed,
    required this.reducedMotion,
    required this.reveal,
  });
  final GlobalKey frame;
  final String label;
  final bool occupied;
  final TarotDrawnCard? card;
  final bool revealed;
  final bool reducedMotion;
  final ValueChanged<int> reveal;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final drawn = card;
    final position = context.uiLabel(label);
    final tap = drawn != null && !revealed ? () => reveal(drawn.slot) : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          key: frame,
          aspectRatio: tarotAspectRatio,
          child: Semantics(
            button: tap != null,
            label: revealed && drawn != null
                ? drawn.face.card.name
                : context
                      .uiLabel(
                        tap != null
                            ? '翻开{position}牌'
                            : occupied
                            ? '{position}已选牌'
                            : '{position}空白卡位',
                      )
                      .replaceFirst('{position}', position),
            onTap: tap,
            excludeSemantics: true,
            child: Material(
              color: theme.colorScheme.surfaceContainerHighest,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (drawn != null)
                    TweenAnimationBuilder<double>(
                      tween: Tween<double>(end: revealed ? 1 : 0),
                      duration: reducedMotion
                          ? Duration.zero
                          : const Duration(milliseconds: 330),
                      curve: Curves.easeOutCubic,
                      builder: (context, progress, _) {
                        final turned = progress >= 0.5;
                        return Transform(
                          alignment: Alignment.center,
                          transform: Matrix4.identity()
                            ..setEntry(3, 2, 0.0018)
                            ..rotateY(
                              (turned ? progress - 1 : progress) * math.pi,
                            ),
                          child: IndexedStack(
                            index: turned ? 1 : 0,
                            sizing: StackFit.expand,
                            children: [
                              const TarotBackArt(),
                              RotatedBox(
                                quarterTurns:
                                    drawn.face.orientation ==
                                        TarotOrientation.reversed
                                    ? 2
                                    : 0,
                                child: Image.asset(
                                  'src/features/divination/assets/tarot/${drawn.face.card.id}.jpg',
                                  fit: BoxFit.cover,
                                  excludeFromSemantics: true,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  else if (occupied)
                    const TarotBackArt()
                  else
                    Center(
                      child: Icon(
                        Icons.auto_awesome_outlined,
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  if (tap != null) InkWell(onTap: tap),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          position,
          textAlign: TextAlign.center,
          style: theme.textTheme.labelMedium,
        ),
        if (revealed && drawn != null) ...[
          Text(
            drawn.face.card.name,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
          UiText(
            drawn.face.orientation == TarotOrientation.reversed ? '逆位' : '正位',
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall,
          ),
        ],
      ],
    );
  }
}
