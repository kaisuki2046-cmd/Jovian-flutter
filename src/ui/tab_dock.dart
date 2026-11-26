import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

const tabDockMargin = 14.0;
const _trayPadding = 5.0;
const _rowHeight = 56.0;
const _trayHeight = _rowHeight + 2 * _trayPadding;

class JovianTabDock extends StatefulWidget {
  const JovianTabDock({
    super.key,
    required this.selected,
    required this.destinations,
    required this.select,
  });

  final int selected;
  final List<NavigationDestination> destinations;
  final ValueChanged<int> select;

  @override
  State<JovianTabDock> createState() => _JovianTabDockState();
}

class _JovianTabDockState extends State<JovianTabDock> {
  int? _pointer;
  double? _pressX;
  double? _dragX;
  double _travel = 0;
  bool _cancelled = false;

  void _press(PointerDownEvent event) {
    if (_pointer != null) {
      _cancelled = true;
      _clear();
      return;
    }
    _pointer = event.pointer;
    _cancelled = false;
    setState(() => _pressX = event.localPosition.dx);
  }

  void _release(PointerUpEvent event) {
    if (_pointer != event.pointer) return;
    _pointer = null;
    if (_pressX != null) setState(() => _pressX = null);
    _endCancellation();
  }

  void _cancel(PointerCancelEvent event) {
    if (_pointer != event.pointer) return;
    _pointer = null;
    _cancelled = true;
    _clear();
    _endCancellation();
  }

  void _endCancellation() {
    if (!_cancelled) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pointer == null) _cancelled = false;
    });
  }

  void _move(double x) {
    if (_cancelled) return;
    setState(() {
      _travel = (x - (_dragX ?? x)).abs().clamp(0, 12) / 12;
      _dragX = x;
    });
  }

  void _clear() {
    if (_pressX == null && _dragX == null) return;
    setState(() {
      _pressX = null;
      _dragX = null;
      _travel = 0;
    });
  }

  void _select(int index) {
    if (!_cancelled) widget.select(index);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduced = MediaQuery.disableAnimationsOf(context);
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(tabDockMargin, 12, tabDockMargin, 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final dockWidth = constraints.maxWidth;
          final length = widget.destinations.length;
          final slotWidth = (dockWidth - 2 * _trayPadding) / length;
          int slotAt(double x) =>
              ((x - _trayPadding) / slotWidth).floor().clamp(0, length - 1);
          final pointerX = _dragX ?? _pressX;
          final index = pointerX == null ? widget.selected : slotAt(pointerX);
          final raised = pointerX != null && !reduced;
          final baseWidth = (slotWidth - 8).clamp(0.0, slotWidth);
          final baseHeight = (baseWidth / 1.36).clamp(32.0, _rowHeight);
          final lensWidth = raised
              ? baseWidth * (1.24 + 0.12 * _travel)
              : baseWidth;
          final lensHeight = raised ? baseHeight * 1.19 : baseHeight;
          final center = !reduced && _dragX != null
              ? _dragX!
              : _trayPadding + (index + 0.5) * slotWidth;
          final left = (center - lensWidth / 2).clamp(
            2.0,
            dockWidth - lensWidth - 2,
          );

          return Listener(
            onPointerDown: _press,
            onPointerUp: _release,
            onPointerCancel: _cancel,
            child: GestureDetector(
              excludeFromSemantics: true,
              behavior: HitTestBehavior.opaque,
              onHorizontalDragStart: (event) => _move(event.localPosition.dx),
              onHorizontalDragUpdate: (event) => _move(event.localPosition.dx),
              onHorizontalDragEnd: (_) {
                final x = _dragX;
                _clear();
                if (x != null) _select(slotAt(x));
              },
              onHorizontalDragCancel: _clear,
              child: SizedBox(
                height: _trayHeight,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(child: _Tray(dark: dark)),
                    AnimatedPositioned(
                      key: const ValueKey('tab-glass-lens'),
                      duration: Duration(
                        milliseconds: reduced || _dragX != null
                            ? 0
                            : raised
                            ? 108
                            : 235,
                      ),
                      curve: Curves.easeOutCubic,
                      left: left,
                      top: (_trayHeight - lensHeight) / 2,
                      width: lensWidth,
                      height: lensHeight,
                      child: _Lens(dark: dark, raised: raised),
                    ),
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.all(_trayPadding),
                        child: NavigationBar(
                          height: _rowHeight,
                          backgroundColor: Colors.transparent,
                          surfaceTintColor: Colors.transparent,
                          indicatorColor: Colors.transparent,
                          overlayColor: const WidgetStatePropertyAll(
                            Colors.transparent,
                          ),
                          animationDuration: reduced
                              ? Duration.zero
                              : const Duration(milliseconds: 235),
                          selectedIndex: widget.selected,
                          onDestinationSelected: _select,
                          destinations: widget.destinations,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

const _capsule = BorderRadius.all(Radius.circular(999));

class _Tray extends StatelessWidget {
  const _Tray({required this.dark});

  final bool dark;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: _capsule,
      boxShadow: [
        BoxShadow(
          color: dark ? const Color(0x2e000000) : const Color(0x14000000),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: ClipRRect(
      borderRadius: _capsule,
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 11, sigmaY: 11),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: _capsule,
            border: Border.all(
              color: dark ? const Color(0x29ffffff) : const Color(0x9effffff),
            ),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: dark
                  ? const [Color(0xed2b2b2b), Color(0xd9262626)]
                  : const [Color(0xfaffffff), Color(0xd9faf9f6)],
            ),
          ),
        ),
      ),
    ),
  );
}

class _Lens extends StatelessWidget {
  const _Lens({required this.dark, required this.raised});

  final bool dark;
  final bool raised;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: _capsule,
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(
              0,
              0,
              0,
              raised ? (dark ? 0.44 : 0.20) : (dark ? 0.13 : 0.05),
            ),
            blurRadius: raised ? 17 : 6,
            offset: Offset(0, raised ? 7 : 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: _capsule,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: raised ? 0.65 : 4,
            sigmaY: raised ? 0.65 : 4,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: _capsule,
              border: Border.all(
                color: Color.fromRGBO(
                  255,
                  255,
                  255,
                  raised ? (dark ? 0.37 : 0.64) : (dark ? 0.10 : 0.28),
                ),
              ),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: raised
                    ? (dark
                          ? const [Color(0xb0363636), Color(0x99434343)]
                          : const [Color(0xd9ffffff), Color(0x80ffffff)])
                    : (dark
                          ? const [Color(0xfb191919), Color(0xe60c0c0c)]
                          : const [Color(0xffeeeeee), Color(0xd9e8e8e8)]),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
