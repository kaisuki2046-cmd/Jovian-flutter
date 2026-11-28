import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../model/synastry_relationship.dart';
import 'synastry_cover.dart';

part 'synastry_album_art.dart';

class SynastryAlbumSelector extends StatefulWidget {
  const SynastryAlbumSelector({
    super.key,
    required this.selected,
    required this.onSelected,
    required this.maxRecordSize,
  });

  final SynastryEdition selected;
  final ValueChanged<SynastryEdition> onSelected;
  final double maxRecordSize;

  @override
  State<SynastryAlbumSelector> createState() => _SynastryAlbumSelectorState();
}

class _SynastryAlbumSelectorState extends State<SynastryAlbumSelector> {
  double _drag = 0;

  SynastryEdition _neighbor(int step) {
    final editions = SynastryEdition.values;
    return editions[(widget.selected.index + step) % editions.length];
  }

  Future<void> _pick() async {
    final selected = await showGeneralDialog<SynastryEdition>(
      context: context,
      barrierDismissible: true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: Theme.of(context).colorScheme.shadow.withValues(alpha: .28),
      transitionDuration: _motion(context, const Duration(milliseconds: 230)),
      pageBuilder: (context, _, _) => _RelationshipPicker(widget.selected),
      transitionBuilder: (context, animation, _, child) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(
            begin: .965,
            end: 1,
          ).animate(animation.drive(CurveTween(curve: Curves.easeOutCubic))),
          child: child,
        ),
      ),
    );
    if (mounted && selected != null) widget.onSelected(selected);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final selected = widget.selected;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final size = math.min(
              constraints.maxWidth * .90,
              widget.maxRecordSize,
            );
            return CustomPaint(
              painter: _RecordSurround(
                line: colors.onSurfaceVariant,
                dark: dark,
              ),
              child: Center(
                child: Semantics(
                  label: context.uiLabel('切换关系'),
                  value: context.uiLabel(selected.label),
                  increasedValue: context.uiLabel(_neighbor(1).label),
                  decreasedValue: context.uiLabel(_neighbor(-1).label),
                  onIncrease: () => widget.onSelected(_neighbor(1)),
                  onDecrease: () => widget.onSelected(_neighbor(-1)),
                  child: GestureDetector(
                    key: const ValueKey('synastry-record'),
                    behavior: HitTestBehavior.opaque,
                    onHorizontalDragStart: (_) => _drag = 0,
                    onHorizontalDragUpdate: (details) =>
                        _drag += details.delta.dx,
                    onHorizontalDragEnd: (details) {
                      final velocity = details.primaryVelocity ?? 0;
                      if (_drag.abs() >= 26 || velocity.abs() > 240) {
                        final direction = _drag.abs() >= 26 ? _drag : velocity;
                        widget.onSelected(_neighbor(direction < 0 ? 1 : -1));
                      }
                    },
                    child: SynastryVinyl(
                      edition: selected,
                      size: size,
                      sheen: true,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 6),
        TextButton(
          key: const ValueKey('synastry-choose-relationship'),
          style: TextButton.styleFrom(foregroundColor: colors.onSurface),
          onPressed: _pick,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: 6,
            children: [
              Flexible(
                child: UiText(
                  selected.label,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Icon(
                Icons.expand_more_rounded,
                size: 16,
                color: colors.onSurfaceVariant,
              ),
            ],
          ),
        ),
        FocusableActionDetector(
          shortcuts: const {
            SingleActivator(LogicalKeyboardKey.arrowLeft): _StepRelationship(
              -1,
            ),
            SingleActivator(LogicalKeyboardKey.arrowRight): _StepRelationship(
              1,
            ),
          },
          actions: {
            _StepRelationship: CallbackAction<_StepRelationship>(
              onInvoke: (intent) =>
                  widget.onSelected(_neighbor(intent.direction)),
            ),
          },
          child: Semantics(
            label: context.uiLabel('关系唱片'),
            value: context.uiLabel(selected.label),
            increasedValue: context.uiLabel(_neighbor(1).label),
            decreasedValue: context.uiLabel(_neighbor(-1).label),
            onLongPress: _pick,
            onIncrease: () => widget.onSelected(_neighbor(1)),
            onDecrease: () => widget.onSelected(_neighbor(-1)),
            child: SizedBox(
              height: 44,
              width: 280,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final editions = SynastryEdition.values;
                  void selectAt(Offset point) {
                    final index =
                        (point.dx * editions.length / constraints.maxWidth)
                            .floor()
                            .clamp(0, editions.length - 1);
                    widget.onSelected(editions[index]);
                  }

                  return GestureDetector(
                    key: const ValueKey('synastry-record-dots'),
                    behavior: HitTestBehavior.opaque,
                    excludeFromSemantics: true,
                    onTapUp: (details) => selectAt(details.localPosition),
                    onHorizontalDragStart: (details) =>
                        selectAt(details.localPosition),
                    onHorizontalDragUpdate: (details) =>
                        selectAt(details.localPosition),
                    onLongPress: _pick,
                    child: Row(
                      children: [
                        for (final edition in editions)
                          Expanded(
                            child: Center(
                              child: AnimatedContainer(
                                duration: _motion(
                                  context,
                                  const Duration(milliseconds: 180),
                                ),
                                width: edition == selected ? 9 : 4,
                                height: edition == selected ? 9 : 4,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: edition == selected
                                      ? Color.lerp(
                                          colors.primary,
                                          SynastryCover.ink(edition),
                                          dark ? .35 : .64,
                                        )
                                      : colors.onSurfaceVariant.withValues(
                                          alpha: .31,
                                        ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StepRelationship extends Intent {
  const _StepRelationship(this.direction);

  final int direction;
}

class SynastryVinyl extends StatelessWidget {
  const SynastryVinyl({
    super.key,
    required this.edition,
    required this.size,
    this.animated = true,
    this.sheen = false,
  });

  final SynastryEdition edition;
  final double size;
  final bool animated;
  final bool sheen;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final colors = Theme.of(context).colorScheme;
    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: colors.shadow.withValues(alpha: dark ? .4 : .21),
                    blurRadius: size * .072,
                    spreadRadius: -size * .025,
                    offset: Offset(0, size * .048),
                  ),
                ],
              ),
              child: RepaintBoundary(
                child: CustomPaint(painter: _VinylGrooves(dark: dark)),
              ),
            ),
          ),
          SizedBox.square(
            dimension: size * .70,
            child: ClipOval(
              child: AnimatedSwitcher(
                duration: animated
                    ? _motion(context, const Duration(milliseconds: 255))
                    : Duration.zero,
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: RotationTransition(
                    turns: Tween<double>(
                      begin: .036,
                      end: 0,
                    ).animate(animation),
                    child: child,
                  ),
                ),
                child: SizedBox.expand(
                  key: ValueKey(edition),
                  child: SynastryCover(edition),
                ),
              ),
            ),
          ),
          if (sheen &&
              _motion(context, const Duration(seconds: 1)) != Duration.zero)
            Positioned.fill(
              child: IgnorePointer(
                child: TweenAnimationBuilder<double>(
                  key: ValueKey(('sheen', edition)),
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 1580),
                  builder: (_, sweep, _) =>
                      CustomPaint(painter: _VinylSheen(sweep, dark: dark)),
                ),
              ),
            ),
          Container(
            width: (size * .019).clamp(2, 6),
            height: (size * .019).clamp(2, 6),
            decoration: BoxDecoration(
              color: const Color(0xff292531),
              border: Border.all(color: Colors.white54, width: .8),
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }
}

class _RelationshipPicker extends StatelessWidget {
  const _RelationshipPicker(this.selected);

  final SynastryEdition selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final edge = BorderRadius.circular(26);
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 30),
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 414),
        child: ClipRRect(
          borderRadius: edge,
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: edge,
                color: colors.surface.withValues(alpha: dark ? .85 : .73),
                border: Border.all(
                  color: colors.onSurface.withValues(alpha: .10),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 8,
                  children: [
                    Row(
                      children: [
                        const SizedBox(width: 44),
                        Expanded(
                          child: Semantics(
                            header: true,
                            child: UiText(
                              '选择关系',
                              textAlign: TextAlign.center,
                              style: theme.textTheme.titleLarge,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: MaterialLocalizations.of(
                            context,
                          ).closeButtonTooltip,
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.close_rounded, size: 20),
                        ),
                      ],
                    ),
                    Flexible(
                      child: SingleChildScrollView(
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final width = (constraints.maxWidth - 14) / 3;
                            return Wrap(
                              spacing: 7,
                              runSpacing: 7,
                              children: [
                                for (final edition in SynastryEdition.values)
                                  _RelationshipOption(
                                    edition: edition,
                                    width: width,
                                    selected: selected == edition,
                                  ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RelationshipOption extends StatelessWidget {
  const _RelationshipOption({
    required this.edition,
    required this.width,
    required this.selected,
  });

  final SynastryEdition edition;
  final double width;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final edge = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: BorderSide(
        color: selected
            ? SynastryCover.ink(edition).withValues(alpha: .32)
            : colors.outlineVariant,
      ),
    );
    return SizedBox(
      width: width,
      child: Semantics(
        selected: selected,
        child: OutlinedButton(
          style: OutlinedButton.styleFrom(
            foregroundColor: selected
                ? SynastryCover.ink(edition)
                : colors.onSurface,
            backgroundColor: selected
                ? SynastryCover.paper(edition)
                : colors.surfaceContainerLow.withValues(alpha: .60),
            side: edge.side,
            shape: edge,
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 9),
            minimumSize: Size(0, 48),
          ),
          onPressed: () => Navigator.of(context).pop(edition),
          child: UiText(edition.label, textAlign: TextAlign.center),
        ),
      ),
    );
  }
}

Duration _motion(BuildContext context, Duration duration) =>
    MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context)
    ? Duration.zero
    : duration;
