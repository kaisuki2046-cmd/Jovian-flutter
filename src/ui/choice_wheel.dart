import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

class ChoiceWheel extends StatefulWidget {
  const ChoiceWheel({
    super.key,
    required this.label,
    required this.values,
    required this.selected,
    required this.onSelected,
    this.visibleRows = 4,
  });

  final String label;
  final List<String> values;
  final int selected;
  final ValueChanged<int> onSelected;
  final double visibleRows;

  @override
  State<ChoiceWheel> createState() => _ChoiceWheelState();
}

class _ChoiceWheelState extends State<ChoiceWheel> {
  late final _scroll = FixedExtentScrollController(
    initialItem: widget.selected,
    keepScrollOffset: false,
  );
  bool _focused = false;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _select(int index) {
    _scroll.jumpToItem(index.clamp(0, widget.values.length - 1));
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent) return KeyEventResult.ignored;
    final target = switch (event.logicalKey) {
      LogicalKeyboardKey.arrowUp => widget.selected - 1,
      LogicalKeyboardKey.arrowDown => widget.selected + 1,
      LogicalKeyboardKey.home => 0,
      LogicalKeyboardKey.end => widget.values.length - 1,
      _ => null,
    };
    if (target == null) return KeyEventResult.ignored;
    _select(target);
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final itemHeight = MediaQuery.textScalerOf(
      context,
    ).scale(21).clamp(42.0, 84.0);
    final selected = widget.selected;
    final radius = BorderRadius.circular(12);
    return Focus(
      onKeyEvent: _onKey,
      onFocusChange: (focused) => setState(() => _focused = focused),
      child: Column(
        spacing: 6,
        children: [
          Text(widget.label, style: theme.textTheme.labelMedium),
          Semantics(
            label: widget.label,
            value: widget.values[selected],
            increasedValue: widget.values.elementAtOrNull(selected + 1),
            decreasedValue: selected > 0 ? widget.values[selected - 1] : null,
            onIncrease: selected < widget.values.length - 1
                ? () => _select(selected + 1)
                : null,
            onDecrease: selected > 0 ? () => _select(selected - 1) : null,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: radius,
                border: _focused ? Border.all(color: colors.primary) : null,
              ),
              child: SizedBox(
                height: itemHeight * widget.visibleRows,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      height: itemHeight,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.primaryContainer,
                          borderRadius: radius,
                        ),
                      ),
                    ),
                    ListWheelScrollView.useDelegate(
                      controller: _scroll,
                      physics: const FixedExtentScrollPhysics(),
                      itemExtent: itemHeight,
                      onSelectedItemChanged: widget.onSelected,
                      childDelegate: ListWheelChildBuilderDelegate(
                        childCount: widget.values.length,
                        builder: (context, index) => Semantics(
                          selected: index == selected,
                          button: true,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => _select(index),
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                child: Text(
                                  widget.values[index],
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: index == selected
                                        ? colors.onPrimaryContainer
                                        : colors.onSurfaceVariant,
                                    fontWeight: index == selected
                                        ? FontWeight.w700
                                        : FontWeight.w400,
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
            ),
          ),
        ],
      ),
    );
  }
}
