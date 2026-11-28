import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import 'tab_glyph.dart';
import 'tab_lens.dart';
import 'theme.dart' show jovianPageWidth;

const tabDockMargin = 14.0;
const _trayPadding = 5.0;
const _rowHeight = 56.0;
const _trayHeight = _rowHeight + 2 * _trayPadding;
const _minSlotWidth = 48.0;
const _lensAspectRatio = 1.36;

typedef _LensContact = ({
  double x,
  double travel,
  bool dragging,
  Duration time,
});

class JovianTabDock extends StatefulWidget {
  const JovianTabDock({
    super.key,
    required this.selected,
    required this.destinations,
    required this.select,
    this.collapse = 0,
  });

  final int selected;
  final List<NavigationDestination> destinations;
  final ValueChanged<int> select;
  final double collapse;

  @override
  State<JovianTabDock> createState() => _JovianTabDockState();
}

class _JovianTabDockState extends State<JovianTabDock>
    with SingleTickerProviderStateMixin {
  final _pointers = <int>{};
  final _paintSpace = GlobalKey();
  late List<GlobalKey> _anchors = _makeAnchors();
  final _contact = ValueNotifier<_LensContact?>(null);
  late final _confirmation = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 270),
    value: 1,
  );
  _LensContact? _latest;
  int? _frame;
  Timer? _idle;
  double? _heldCollapse;
  double _downX = 0;
  bool _cancelled = false;
  bool _suppressTap = false;

  List<GlobalKey> _makeAnchors() =>
      List.generate(widget.destinations.length, (_) => GlobalKey());

  bool get _reducedMotion => MediaQuery.disableAnimationsOf(context);

  @override
  void initState() {
    super.initState();
    GestureBinding.instance.pointerRouter.addGlobalRoute(_observePointer);
  }

  @override
  void didUpdateWidget(JovianTabDock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.destinations.length != _anchors.length)
      _anchors = _makeAnchors();
    if (widget.selected != oldWidget.selected && !_reducedMotion) {
      _confirmation.forward(from: 0);
    }
  }

  @override
  void dispose() {
    GestureBinding.instance.pointerRouter.removeGlobalRoute(_observePointer);
    _idle?.cancel();
    if (_frame case final frame?)
      SchedulerBinding.instance.cancelFrameCallbackWithId(frame);
    _confirmation.dispose();
    _contact.dispose();
    super.dispose();
  }

  void _press(PointerDownEvent event) {
    if ((event.buttons & kPrimaryButton) == 0) return;
    _pointers.add(event.pointer);
    if (_pointers.length > 1) {
      _interruptDrag();
      return;
    }
    _cancelled = false;
    _suppressTap = false;
    Tooltip.dismissAllToolTips();
    _heldCollapse = widget.collapse;
    _downX = event.localPosition.dx;
    _latest = (x: _downX, travel: 0, dragging: false, time: event.timeStamp);
    _contact.value = _latest;
  }

  void _observePointer(PointerEvent event) {
    if (event is PointerDownEvent &&
        !_cancelled &&
        _pointers.isNotEmpty &&
        !_pointers.contains(event.pointer)) {
      _interruptDrag();
    }
  }

  void _interruptDrag() {
    _cancelled = true;
    _suppressTap = true;
    _clear();
  }

  void _end(PointerEvent event, int Function(double) slotAt) {
    if (!_pointers.remove(event.pointer)) return;
    final drag = _latest?.dragging == true;
    final confirmed = !_cancelled && drag && event is PointerUpEvent;
    if (event is PointerCancelEvent) _suppressTap = true;
    _clear();
    if (confirmed) _confirmTab(slotAt(event.localPosition.dx));
    if (_pointers.isEmpty) {
      final held = _heldCollapse;
      _heldCollapse = null;
      if (held != widget.collapse) setState(() {});
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pointers.isEmpty) _suppressTap = false;
      });
      SchedulerBinding.instance.ensureVisualUpdate();
    }
  }

  void _move(PointerMoveEvent event) {
    final previous = _latest;
    if (_cancelled || previous == null || !_pointers.contains(event.pointer))
      return;
    final x = event.localPosition.dx;
    if (!previous.dragging && (x - _downX).abs() < 7) return;
    _suppressTap = true;
    final elapsed = ((event.timeStamp - previous.time).inMicroseconds / 1000)
        .clamp(8.0, double.infinity);
    final speed = ((x - previous.x) / elapsed / .75).clamp(-1.0, 1.0);
    _latest = (
      x: x,
      travel: .25 * previous.travel + .75 * speed,
      dragging: true,
      time: event.timeStamp,
    );
    _queuePaint();
    _idle?.cancel();
    _idle = Timer(const Duration(milliseconds: 88), _relax);
  }

  void _relax() {
    final current = _latest;
    if (current == null) return;
    final travel = current.travel.abs() < .02 ? 0.0 : current.travel * .55;
    _latest = (
      x: current.x,
      travel: travel,
      dragging: true,
      time: current.time,
    );
    _queuePaint();
    if (travel != 0) _idle = Timer(const Duration(milliseconds: 24), _relax);
  }

  void _queuePaint() {
    _frame ??= SchedulerBinding.instance.scheduleFrameCallback((_) {
      _frame = null;
      _contact.value = _latest;
    });
  }

  void _clear() {
    _idle?.cancel();
    if (_frame case final frame?)
      SchedulerBinding.instance.cancelFrameCallbackWithId(frame);
    _frame = null;
    _latest = null;
    _contact.value = null;
  }

  void _select(int index) {
    if (!_suppressTap) _confirmTab(index);
  }

  void _confirmTab(int index) {
    if (index != widget.selected && widget.destinations[index].enabled)
      widget.select(index);
  }

  Widget _destination(int index, NavigationDestination item) {
    final destination = item.icon is TabGlyph
        ? NavigationDestination(
            key: item.key,
            label: item.label,
            tooltip: item.tooltip,
            enabled: item.enabled,
            icon: SizedBox.square(key: _anchors[index], dimension: 24),
          )
        : item;
    final fullLabel = item.tooltip;
    if (fullLabel == null || fullLabel == item.label) return destination;

    // Keep the full destination name readable even when the caption is short.
    return Focus(
      canRequestFocus: false,
      includeSemantics: false,
      child: Builder(
        builder: (context) {
          final focus = Focus.of(context);
          return Semantics(
            label: fullLabel,
            button: true,
            enabled: item.enabled,
            focused: item.enabled ? focus.hasFocus : null,
            onFocus: item.enabled
                ? () => focus.traversalDescendants.firstOrNull?.requestFocus()
                : null,
            onTap: item.enabled ? () => _select(index) : null,
            excludeSemantics: true,
            child: destination,
          );
        },
      ),
    );
  }

  double _maxLabelScale(BuildContext context, double slotWidth) {
    final theme = Theme.of(context);
    final style =
        NavigationBarTheme.of(
          context,
        ).labelTextStyle?.resolve({WidgetState.selected}) ??
        theme.textTheme.labelMedium;
    final measure = TextPainter(
      textDirection: Directionality.of(context),
      maxLines: 1,
    );
    var widest = 1.0;
    try {
      for (final item in widget.destinations) {
        measure.text = TextSpan(text: item.label, style: style);
        measure.layout();
        widest = math.max(widest, measure.width);
      }
    } finally {
      measure.dispose();
    }
    return ((slotWidth - 4) / widest).clamp(0.0, 1.3);
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final dark = brightness == Brightness.dark;
    final reduced = _reducedMotion;
    final canCompact =
        !reduced && MediaQuery.textScalerOf(context).scale(12) <= 14;
    final collapse = canCompact
        ? (_heldCollapse ?? widget.collapse).clamp(0.0, 1.0)
        : 0.0;
    final rowHeight = ui.lerpDouble(_rowHeight, 44, collapse)!;
    final trayHeight = rowHeight + 2 * _trayPadding;
    final length = widget.destinations.length;
    final safePadding = MediaQuery.paddingOf(context);
    final frameWidth =
        MediaQuery.sizeOf(context).width - safePadding.horizontal;
    final margin =
        ((frameWidth - 2 * _trayPadding - length * _minSlotWidth) / 2).clamp(
          4.0,
          tabDockMargin,
        );
    return SafeArea(
      top: false,
      minimum: EdgeInsets.fromLTRB(margin, 12, margin, 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final dockWidth = math.min(
            constraints.maxWidth,
            jovianPageWidth - 2 * tabDockMargin,
          );
          final slotWidth = (dockWidth - 2 * _trayPadding) / length;
          final baseWidth = (slotWidth - 8).clamp(
            1.0,
            rowHeight * _lensAspectRatio,
          );
          final resting = Size(
            baseWidth,
            (baseWidth / _lensAspectRatio).clamp(22.0, rowHeight),
          );
          double slotCenter(int index) =>
              _trayPadding + (index + .5) * slotWidth;
          int slotAt(double x) =>
              ((x - _trayPadding) / slotWidth).floor().clamp(0, length - 1);
          return SizedBox(
            height: _trayHeight,
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Listener(
                behavior: HitTestBehavior.opaque,
                onPointerDown: _press,
                onPointerMove: _move,
                onPointerUp: (event) => _end(event, slotAt),
                onPointerCancel: (event) => _end(event, slotAt),
                child: SizedBox(
                  width: dockWidth,
                  height: trayHeight,
                  child: ValueListenableBuilder(
                    valueListenable: _contact,
                    child: Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.all(_trayPadding),
                        child: MediaQuery.withClampedTextScaling(
                          maxScaleFactor: _maxLabelScale(context, slotWidth),
                          child: NavigationBar(
                            height: rowHeight,
                            backgroundColor: Colors.transparent,
                            surfaceTintColor: Colors.transparent,
                            indicatorColor: Colors.transparent,
                            overlayColor: WidgetStateProperty.resolveWith(
                              (states) => states.contains(WidgetState.focused)
                                  ? Theme.of(
                                      context,
                                    ).colorScheme.primary.withValues(alpha: .18)
                                  : Colors.transparent,
                            ),
                            animationDuration: reduced
                                ? Duration.zero
                                : const Duration(milliseconds: 235),
                            selectedIndex: widget.selected,
                            onDestinationSelected: _select,
                            destinations: [
                              for (final (index, item)
                                  in widget.destinations.indexed)
                                _destination(index, item),
                            ],
                          ),
                        ),
                      ),
                    ),
                    builder: (context, contact, navigation) {
                      final dragging = contact?.dragging == true;
                      final index = contact == null
                          ? widget.selected
                          : slotAt(contact.x);
                      final target = TabLensPose(
                        dragging ? contact!.x : slotCenter(index),
                        press: contact == null ? 0 : 1,
                        travel: reduced ? 0 : contact?.travel ?? 0,
                      );
                      return TweenAnimationBuilder<TabLensPose>(
                        tween: _LensPoseTween(target),
                        duration: Duration(
                          milliseconds: reduced || dragging
                              ? 0
                              : contact != null
                              ? 108
                              : 235,
                        ),
                        curve: Curves.easeOutCubic,
                        child: navigation,
                        builder: (context, pose, navigation) {
                          final outline = tabLensOutline(
                            pose: pose,
                            tray: Size(dockWidth, trayHeight),
                            resting: resting,
                          );
                          final raised = pose.press > 0;
                          final lens = Positioned.fromRect(
                            key: const ValueKey('tab-glass-lens'),
                            rect: outline.bounds,
                            child: _Lens(
                              dark: dark,
                              raised: raised,
                              outline: outline,
                            ),
                          );
                          return Stack(
                            key: _paintSpace,
                            clipBehavior: Clip.none,
                            children: [
                              Positioned.fill(
                                child: _Tray(
                                  dark: dark,
                                  aperture: raised ? outline : null,
                                ),
                              ),
                              lens,
                              // Changing tooltip visibility here would remount
                              // the destination while it owns a pending tap.
                              navigation!,
                              Positioned.fill(
                                child: ExcludeSemantics(
                                  child: IgnorePointer(
                                    child: CustomPaint(
                                      painter: _DockArtwork(
                                        paintSpace: _paintSpace,
                                        anchors: _anchors,
                                        items: widget.destinations,
                                        selected: widget.selected,
                                        confirmation: _confirmation,
                                        brightness: brightness,
                                        outline: raised ? outline : null,
                                        lift: pose.press,
                                        reduced: reduced,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LensPoseTween extends Tween<TabLensPose> {
  _LensPoseTween(TabLensPose end) : super(end: end);

  @override
  TabLensPose lerp(double t) => TabLensPose.lerp(begin!, end!, t);
}

class _DockArtwork extends CustomPainter {
  _DockArtwork({
    required this.paintSpace,
    required this.anchors,
    required this.items,
    required this.selected,
    required this.confirmation,
    required this.brightness,
    required this.outline,
    required this.lift,
    required this.reduced,
  }) : super(repaint: confirmation);

  final GlobalKey paintSpace;
  final List<GlobalKey> anchors;
  final List<NavigationDestination> items;
  final int selected;
  final Animation<double> confirmation;
  final Brightness brightness;
  final TabLensOutline? outline;
  final double lift;
  final bool reduced;

  @override
  void paint(Canvas canvas, Size size) {
    final root = paintSpace.currentContext?.findRenderObject();
    if (root is! RenderBox) return;
    final lens = outline;
    final glass = lens?.path().shift(lens.bounds.topLeft);
    final inset = lens == null
        ? 0.0
        : (lens.bounds.shortestSide * .12).clamp(3.0, 7.0);
    final face = lens?.path(inset: inset).shift(lens.bounds.topLeft);
    final rim = glass == null
        ? null
        : Path.combine(PathOperation.difference, glass, face!);
    final exterior = glass == null
        ? null
        : (Path()
            ..fillType = PathFillType.evenOdd
            ..addRect(Offset.zero & size)
            ..addPath(glass, Offset.zero));

    for (final (i, item) in items.indexed) {
      final icon = item.icon;
      final anchor = anchors[i].currentContext?.findRenderObject();
      if (icon is! TabGlyph || anchor is! RenderBox || !anchor.hasSize)
        continue;
      final center = anchor.localToGlobal(
        anchor.size.center(Offset.zero),
        ancestor: root,
      );
      final current = i == selected;
      final selectedGlyph = item.selectedIcon;
      final normal =
          (current && selectedGlyph is TabGlyph ? selectedGlyph : icon).artwork(
            brightness,
            filled: current,
          );
      final phase = reduced || !current ? 1.0 : confirmation.value;
      final scale = phase < .38
          ? ui.lerpDouble(1, 1.17, phase / .38)!
          : phase < .72
          ? ui.lerpDouble(1.17, .97, (phase - .38) / .34)!
          : ui.lerpDouble(.97, 1, (phase - .72) / .28)!;
      final iconCenter = center.translate(0, -math.sin(phase * math.pi) * 2.5);
      final covered =
          lens != null &&
          lens.bounds.overlaps(
            Rect.fromCenter(center: center, width: 36, height: 32),
          );
      if (covered) {
        canvas.save();
        canvas.clipPath(exterior!);
      }
      _drawGlyph(canvas, normal, iconCenter, scale: scale);
      if (!covered) continue;
      canvas.restore();

      final filled = icon.artwork(brightness, filled: true);
      final relative = center - lens.bounds.center;
      canvas.save();
      canvas.clipPath(face!);
      _drawGlyph(canvas, filled, center, scale: 1);
      canvas.restore();

      final nx = relative.dx / lens.bounds.width;
      final ny = relative.dy / lens.bounds.height;
      final distance = math.sqrt(nx * nx + ny * ny);
      final influence = math.max(0.0, 1 - 1.7 * distance);
      final rimCenter =
          center + relative * (.22 * influence * influence * lift);
      final angle = math.atan2(ny, nx);
      final drift = distance > 0 ? 2.8 * lift / distance : 0.0;
      canvas.save();
      canvas.clipPath(rim!);
      canvas.translate(rimCenter.dx - nx * drift, rimCenter.dy - ny * drift);
      canvas.rotate(angle);
      canvas.scale(1 + .52 * lift, 1 - .17 * lift);
      canvas.rotate(-angle);
      _drawGlyph(canvas, filled, Offset.zero, scale: 1 + .24 * lift);
      canvas.restore();
    }
  }

  void _drawGlyph(
    Canvas canvas,
    CustomPainter glyph,
    Offset center, {
    required double scale,
  }) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(scale);
    canvas.translate(-12, -12);
    glyph.paint(canvas, const Size.square(24));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_DockArtwork old) =>
      old.items != items ||
      old.anchors != anchors ||
      old.outline != outline ||
      old.brightness != brightness ||
      old.selected != selected ||
      old.reduced != reduced;
}

const _capsule = BorderRadius.all(Radius.circular(999));

class _Tray extends StatelessWidget {
  const _Tray({required this.dark, this.aperture});

  final bool dark;
  final TabLensOutline? aperture;

  static final _blur = ui.ImageFilter.blur(sigmaX: 11, sigmaY: 11);

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _GlassShadow(
      color: dark ? const Color(0x2e000000) : const Color(0x14000000),
      blur: 14,
      drop: 4,
    ),
    child: ClipRRect(
      borderRadius: _capsule,
      child: Stack(
        fit: StackFit.expand,
        children: [
          BackdropFilter(filter: _blur, child: const SizedBox.expand()),
          ClipPath(
            clipper: _TrayClip(aperture),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: _capsule,
                border: Border.all(
                  color: dark
                      ? const Color(0x29ffffff)
                      : const Color(0x9effffff),
                ),
                color: dark ? const Color(0x94272727) : const Color(0x38ffffff),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _TrayClip extends CustomClipper<Path> {
  const _TrayClip(this.aperture);

  final TabLensOutline? aperture;

  @override
  Path getClip(Size size) {
    final tray = Path()..addRRect(_capsule.toRRect(Offset.zero & size));
    final opening = aperture;
    if (opening == null) return tray;
    return Path.combine(
      PathOperation.difference,
      tray,
      opening.path(inset: .8).shift(opening.bounds.topLeft),
    );
  }

  @override
  bool shouldReclip(_TrayClip oldClipper) => aperture != oldClipper.aperture;
}

class _Lens extends StatelessWidget {
  const _Lens({
    required this.dark,
    required this.raised,
    required this.outline,
  });

  final bool dark;
  final bool raised;
  final TabLensOutline outline;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: CustomPaint(
      painter: _GlassShadow(
        color: Color.fromRGBO(
          0,
          0,
          0,
          raised ? (dark ? 0.40 : 0.13) : (dark ? 0.13 : 0.05),
        ),
        blur: raised ? 17 : 6,
        drop: raised ? 7 : 2,
        outline: outline,
      ),
      // This composited boundary puts the filter's origin at the moving lens,
      // so its magnification follows the rectangle rather than the screen.
      child: RepaintBoundary(
        child: ClipPath(
          clipper: _LensBand(outline: outline),
          child: raised
              ? _RaisedGlass(outline: outline, dark: dark)
              : BackdropFilter(
                  filter: _restingBlur,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: _capsule,
                      border: Border.all(
                        color: dark
                            ? const Color(0x1affffff)
                            : const Color(0x47ffffff),
                      ),
                      color: dark
                          ? const Color(0xe60c0c0c)
                          : const Color(0xd9e8e8e8),
                    ),
                  ),
                ),
        ),
      ),
    ),
  );

  static final _restingBlur = ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4);
}

class _RaisedGlass extends StatelessWidget {
  const _RaisedGlass({required this.outline, required this.dark});

  final TabLensOutline outline;
  final bool dark;
  static final _faceBlur = ui.ImageFilter.blur(sigmaX: .65, sigmaY: .65);
  static final _lightFace = ui.ImageFilter.compose(
    inner: _faceBlur,
    outer: _glassTone(1.04, 0),
  );
  static final _darkFace = ui.ImageFilter.compose(
    inner: _faceBlur,
    outer: _glassTone(1.13, 0),
  );

  @override
  Widget build(BuildContext context) {
    final size = outline.bounds.size;
    final rimWidth = (size.shortestSide * 0.12).clamp(3.0, 6.0);
    final rim = _LensBand(outline: outline, inset: rimWidth, rim: true);
    return Stack(
      fit: StackFit.expand,
      children: [
        // Sample across the whole lens before adding the curved rim. Separate
        // rectangular backdrop regions leave seams in the raised glass.
        BackdropFilter(
          filter: dark ? _darkFace : _lightFace,
          child: const SizedBox.expand(),
        ),
        ClipPath(
          clipper: rim,
          child: BackdropFilter(
            filter: _rimRefraction(size, dark),
            child: const SizedBox.expand(),
          ),
        ),
        CustomPaint(painter: _RaisedRim(dark, outline)),
      ],
    );
  }
}

class _LensBand extends CustomClipper<Path> {
  _LensBand({required this.outline, this.inset = 0, this.rim = false});

  final TabLensOutline outline;
  final double inset;
  final bool rim;

  late final Path _clip = _buildClip();

  Path _buildClip() {
    final face = outline.path(inset: inset);
    return rim
        ? Path.combine(PathOperation.difference, outline.path(), face)
        : face;
  }

  @override
  Path getClip(Size size) => _clip;

  @override
  bool shouldReclip(_LensBand oldClipper) =>
      outline != oldClipper.outline ||
      inset != oldClipper.inset ||
      rim != oldClipper.rim;
}

class _GlassShadow extends CustomPainter {
  const _GlassShadow({
    required this.color,
    required this.blur,
    required this.drop,
    this.outline,
  });

  final Color color;
  final double blur;
  final double drop;
  final TabLensOutline? outline;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    final glass =
        outline?.path() ?? (Path()..addRRect(_capsule.toRRect(bounds)));
    final exterior = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(bounds.inflate(2 * blur + drop))
      ..addPath(glass, Offset.zero);
    // A box shadow's solid centre would darken pixels sampled by the lens.
    canvas.save();
    canvas.clipPath(exterior);
    canvas.drawPath(
      glass.shift(Offset(0, drop)),
      Paint()
        ..color = color
        ..maskFilter = MaskFilter.blur(
          BlurStyle.normal,
          ui.Shadow.convertRadiusToSigma(blur),
        ),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlassShadow oldDelegate) =>
      color != oldDelegate.color ||
      blur != oldDelegate.blur ||
      drop != oldDelegate.drop ||
      outline != oldDelegate.outline;
}

ui.ImageFilter _rimRefraction(Size size, bool dark) {
  const scale = 1.34;
  final center = size.center(Offset.zero);
  final magnify = Matrix4.diagonal3Values(scale, scale, 1)
    ..setTranslationRaw(center.dx * (1 - scale), center.dy * (1 - scale), 0);
  return ui.ImageFilter.compose(
    inner: ui.ImageFilter.matrix(
      magnify.storage,
      filterQuality: FilterQuality.low,
    ),
    outer: ui.ImageFilter.compose(
      inner: ui.ImageFilter.blur(sigmaX: 2, sigmaY: 2),
      outer: _glassTone(dark ? 1.13 : 1.025, dark ? 5.0 : 1.0),
    ),
  );
}

ColorFilter _glassTone(double brightness, double lift) => ColorFilter.matrix([
  brightness * 1.094,
  brightness * -0.086,
  brightness * -0.008,
  0,
  lift,
  brightness * -0.026,
  brightness * 1.034,
  brightness * -0.008,
  0,
  lift,
  brightness * -0.026,
  brightness * -0.086,
  brightness * 1.112,
  0,
  lift,
  0,
  0,
  0,
  1,
  0,
]);

class _RaisedRim extends CustomPainter {
  const _RaisedRim(this.dark, this.outline);

  final bool dark;
  final TabLensOutline outline;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawPath(
      outline.path(),
      Paint()..color = dark ? const Color(0x1affffff) : const Color(0x14ffffff),
    );
    canvas.drawPath(
      outline.path(inset: 1.7),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.1)
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark
              ? const [Color(0x7affffff), Color(0x1bffffff)]
              : const [Color(0x9fffffff), Color(0x364f4f4f)],
        ).createShader(rect),
    );
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.15
      ..color = dark ? const Color(0x5effffff) : const Color(0xa3ffffff);
    canvas.drawPath(outline.path(inset: .65), rim);
    rim
      ..strokeWidth = 2.15
      ..shader = LinearGradient(
        begin: const Alignment(-0.36, -1),
        end: const Alignment(0.36, 1),
        stops: const [0, 0.24, 0.58, 1],
        colors: dark
            ? const [
                Color(0x9effffff),
                Color(0x44ffffff),
                Color(0x00ffffff),
                Color(0x9b000000),
              ]
            : const [
                Color(0xf5ffffff),
                Color(0x9cffffff),
                Color(0x00ffffff),
                Color(0x4d3c392e),
              ],
      ).createShader(rect);
    canvas.drawPath(outline.path(inset: 1.7), rim);
  }

  @override
  bool shouldRepaint(_RaisedRim oldDelegate) =>
      dark != oldDelegate.dark || outline != oldDelegate.outline;
}
