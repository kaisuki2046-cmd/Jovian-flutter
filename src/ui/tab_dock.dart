import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

const tabDockMargin = 14.0;
const _trayPadding = 5.0;
const _rowHeight = 56.0;
const _trayHeight = _rowHeight + 2 * _trayPadding;

typedef _LensContact = ({double x, double travel, bool dragging});

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
  final _contact = ValueNotifier<_LensContact?>(null);
  final _trayBackdrop = BackdropKey();
  bool _cancelled = false;

  @override
  void dispose() {
    _contact.dispose();
    super.dispose();
  }

  void _press(PointerDownEvent event) {
    if (_pointer != null) {
      _cancelled = true;
      _clear();
      return;
    }
    _pointer = event.pointer;
    _cancelled = false;
    _contact.value = (x: event.localPosition.dx, travel: 0, dragging: false);
  }

  void _release(PointerUpEvent event) {
    if (_pointer != event.pointer) return;
    _pointer = null;
    if (_contact.value?.dragging != true) _clear();
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
    final previous = _contact.value;
    final previousX = previous?.dragging == true ? previous!.x : x;
    final travel = (x - previousX).abs().clamp(0, 12) / 12;
    _contact.value = (x: x, travel: travel, dragging: true);
  }

  void _clear() => _contact.value = null;

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
                final contact = _contact.value;
                _clear();
                if (contact?.dragging == true) _select(slotAt(contact!.x));
              },
              onHorizontalDragCancel: _clear,
              child: SizedBox(
                height: _trayHeight,
                child: ValueListenableBuilder(
                  valueListenable: _contact,
                  child: Positioned.fill(
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
                  builder: (context, contact, navigation) {
                    final raised = contact != null && !reduced;
                    final dragging = contact?.dragging == true;
                    final index = contact == null
                        ? widget.selected
                        : slotAt(contact.x);
                    final baseWidth = (slotWidth - 8).clamp(0.0, slotWidth);
                    final baseHeight = (baseWidth / 1.36).clamp(
                      32.0,
                      _rowHeight,
                    );
                    final width = raised
                        ? baseWidth * (1.24 + 0.12 * contact.travel)
                        : baseWidth;
                    final height = raised ? baseHeight * 1.19 : baseHeight;
                    final center = raised && dragging
                        ? contact.x
                        : _trayPadding + (index + 0.5) * slotWidth;
                    final target = Rect.fromLTWH(
                      (center - width / 2).clamp(2.0, dockWidth - width - 2),
                      (_trayHeight - height) / 2,
                      width,
                      height,
                    );
                    // Update the lens and the opening it reveals from the same
                    // rectangle, with the same press and release transitions.
                    return TweenAnimationBuilder<Rect?>(
                      tween: RectTween(end: target),
                      duration: Duration(
                        milliseconds: reduced || dragging
                            ? 0
                            : raised
                            ? 108
                            : 235,
                      ),
                      curve: Curves.easeOutCubic,
                      child: navigation,
                      builder: (context, bounds, navigation) {
                        final rect = bounds!;
                        final lens = Positioned.fromRect(
                          key: const ValueKey('tab-glass-lens'),
                          rect: rect,
                          child: _Lens(
                            dark: dark,
                            raised: raised,
                            size: rect.size,
                          ),
                        );
                        return Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Positioned.fill(
                              child: _Tray(
                                dark: dark,
                                aperture: raised ? rect : null,
                                backdropKey: _trayBackdrop,
                              ),
                            ),
                            if (!raised) lens,
                            navigation!,
                            if (raised) lens,
                          ],
                        );
                      },
                    );
                  },
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
  const _Tray({required this.dark, required this.backdropKey, this.aperture});

  final bool dark;
  final BackdropKey backdropKey;
  final Rect? aperture;

  static final _blur = ui.ImageFilter.blur(sigmaX: 11, sigmaY: 11);

  Widget _background() {
    final sample = BackdropFilter(
      filter: _blur,
      backdropGroupKey: backdropKey,
      child: const SizedBox.expand(),
    );
    final hole = aperture;
    if (hole == null) return sample;
    // Keep the tray's stronger blur out of the reserved lens sample. A path
    // clip alone leaves its full rectangular sample in some web renderers.
    // Inscribe the sample in the capsule so its corners never show through
    // the frosted tray. The bevel softens the sharper sample toward the edge.
    final sampleInset = hole.shortestSide * 0.15;
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final opening = hole.deflate(sampleInset).intersect(Offset.zero & size);
        final regions = [
          Rect.fromLTRB(0, 0, opening.left, size.height),
          Rect.fromLTRB(opening.right, 0, size.width, size.height),
          Rect.fromLTRB(opening.left, 0, opening.right, opening.top),
          Rect.fromLTRB(
            opening.left,
            opening.bottom,
            opening.right,
            size.height,
          ),
        ];
        return Stack(
          children: [
            for (final region in regions)
              if (!region.isEmpty)
                Positioned.fromRect(
                  rect: region,
                  child: ClipRect(child: sample),
                ),
          ],
        );
      },
    );
  }

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
          _background(),
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
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: dark
                      ? const [Color(0xa02f2f2f), Color(0x99272727)]
                      : const [Color(0x9bf8f7f4), Color(0x82f2f0eb)],
                ),
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

  final Rect? aperture;

  @override
  Path getClip(Size size) {
    final tray = Path()..addRRect(_capsule.toRRect(Offset.zero & size));
    final opening = aperture;
    if (opening == null) return tray;
    return Path.combine(
      PathOperation.difference,
      tray,
      Path()..addRRect(_capsule.toRRect(opening.deflate(0.8))),
    );
  }

  @override
  bool shouldReclip(_TrayClip oldClipper) => aperture != oldClipper.aperture;
}

class _Lens extends StatelessWidget {
  const _Lens({required this.dark, required this.raised, required this.size});

  final bool dark;
  final bool raised;
  final Size size;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: CustomPaint(
      painter: _GlassShadow(
        color: Color.fromRGBO(
          0,
          0,
          0,
          raised ? (dark ? 0.44 : 0.20) : (dark ? 0.13 : 0.05),
        ),
        blur: raised ? 17 : 6,
        drop: raised ? 7 : 2,
      ),
      // This composited boundary puts the filter's origin at the moving lens,
      // so its magnification follows the rectangle rather than the screen.
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: _capsule,
          child: raised
              ? _RaisedGlass(size: size, dark: dark)
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
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: dark
                            ? const [Color(0xfb191919), Color(0xe60c0c0c)]
                            : const [Color(0xffeeeeee), Color(0xd9e8e8e8)],
                      ),
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
  const _RaisedGlass({required this.size, required this.dark});

  final Size size;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final rimWidth = (size.shortestSide * 0.12).clamp(3.0, 6.0);
    return Stack(
      fit: StackFit.expand,
      children: [
        // The edge of the glass bends its live sample in much more than the
        // face. Both clip paths follow the same moving capsule.
        ClipPath(
          clipper: _LensBand(rimWidth: rimWidth, rim: true),
          child: BackdropFilter(
            filter: _refraction(size, dark, scale: 1.34, blur: 1.45),
            child: const SizedBox.expand(),
          ),
        ),
        ClipPath(
          clipper: _LensBand(rimWidth: rimWidth, rim: false),
          child: BackdropFilter(
            filter: _refraction(size, dark, scale: 1.07, blur: 0.75),
            child: const SizedBox.expand(),
          ),
        ),
        CustomPaint(painter: _RaisedRim(dark)),
      ],
    );
  }
}

class _LensBand extends CustomClipper<Path> {
  const _LensBand({required this.rimWidth, required this.rim});

  final double rimWidth;
  final bool rim;

  @override
  Path getClip(Size size) {
    final shape = _capsule.toRRect(Offset.zero & size);
    final path = Path()
      ..fillType = PathFillType.evenOdd
      ..addRRect(shape.deflate(rimWidth));
    if (rim) path.addRRect(shape);
    return path;
  }

  @override
  bool shouldReclip(_LensBand oldClipper) =>
      rimWidth != oldClipper.rimWidth || rim != oldClipper.rim;
}

class _GlassShadow extends CustomPainter {
  const _GlassShadow({
    required this.color,
    required this.blur,
    required this.drop,
  });

  final Color color;
  final double blur;
  final double drop;

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    final glass = _capsule.toRRect(bounds);
    final exterior = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(bounds.inflate(2 * blur + drop))
      ..addRRect(glass);
    // A box shadow's solid centre would darken pixels sampled by the lens.
    canvas.save();
    canvas.clipPath(exterior);
    canvas.drawRRect(
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
      drop != oldDelegate.drop;
}

ui.ImageFilter _refraction(
  Size size,
  bool dark, {
  required double scale,
  required double blur,
}) {
  final center = size.center(Offset.zero);
  final magnify = Matrix4.diagonal3Values(scale, scale, 1)
    ..setTranslationRaw(center.dx * (1 - scale), center.dy * (1 - scale), 0);
  final brightness = dark ? 1.13 : 1.025;
  final lift = dark ? 5.0 : 1.0;
  return ui.ImageFilter.compose(
    inner: ui.ImageFilter.matrix(
      magnify.storage,
      filterQuality: FilterQuality.low,
    ),
    outer: ui.ImageFilter.compose(
      inner: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
      outer: ColorFilter.matrix([
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
      ]),
    ),
  );
}

class _RaisedRim extends CustomPainter {
  const _RaisedRim(this.dark);

  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shape = _capsule.toRRect(rect);
    canvas.drawRRect(
      shape,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: dark
              ? const [Color(0x17ffffff), Color(0x0bffffff)]
              : const [Color(0x1affffff), Color(0x06ffffff)],
        ).createShader(rect),
    );
    canvas.drawRRect(
      shape.deflate(1.7),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.1)
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: dark
              ? const [Color(0x8ccee7ff), Color(0x1bffffff)]
              : const [Color(0xbaffffff), Color(0x426378b4)],
        ).createShader(rect),
    );
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.15
      ..color = dark ? const Color(0x5effffff) : const Color(0xa3ffffff);
    canvas.drawRRect(shape.deflate(0.65), rim);
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
    canvas.drawRRect(shape.deflate(1.7), rim);
  }

  @override
  bool shouldRepaint(_RaisedRim oldDelegate) => dark != oldDelegate.dark;
}
