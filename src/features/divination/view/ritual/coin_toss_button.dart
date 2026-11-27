import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

const _shellAsset =
    'src/features/divination/assets/ritual/tortoise-shell-side.png';
const _shakeX = [0.0, -5.0, 5.0, -5.0, 4.0, -4.0, 3.0, -3.0, 2.0, -1.0, 0.0];
const _shakeY = [
  0.0,
  -2.0,
  -4.0,
  -2.0,
  -4.0,
  -2.0,
  -3.0,
  -1.0,
  -2.0,
  -1.0,
  0.0,
];
const _shakeAngle = [
  0.0,
  -9.0,
  9.0,
  -8.0,
  8.0,
  -6.0,
  6.0,
  -4.0,
  3.0,
  -1.0,
  0.0,
];

class CoinTossButton extends StatelessWidget {
  const CoinTossButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.shake,
    required this.tossing,
    required this.showHint,
    required this.animateHint,
  });

  final String label;
  final VoidCallback? onPressed;
  final Animation<double> shake;
  final bool tossing;
  final bool showHint;
  final bool animateHint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final enabled = onPressed != null;
    final dark = theme.brightness == Brightness.dark;
    const radius = BorderRadius.all(Radius.circular(21));

    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      label: label,
      onTap: onPressed,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(
              color: dark ? const Color(0x42ffffff) : const Color(0xffcfc7b8),
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              stops: const [0, 0.48, 1],
              colors: dark
                  ? const [
                      Color(0x2effffff),
                      Color(0x11ffffff),
                      Color(0x22000000),
                    ]
                  : const [
                      Color(0xebffffff),
                      Color(0x74fffdf7),
                      Color(0x70cdc1aa),
                    ],
            ),
          ),
          child: InkWell(
            key: const ValueKey('coin-ritual-toss-button'),
            onTap: onPressed,
            borderRadius: radius,
            splashFactory: NoSplash.splashFactory,
            overlayColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.focused) ||
                  states.contains(WidgetState.pressed)) {
                return colors.primary.withValues(alpha: 0.17);
              }
              if (states.contains(WidgetState.hovered)) {
                return colors.primary.withValues(alpha: 0.06);
              }
              return Colors.transparent;
            }),
            child: Padding(
              padding: const EdgeInsets.all(2),
              child: Container(
                constraints: const BoxConstraints(minWidth: 190),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(19),
                  border: Border.all(
                    color: dark
                        ? const Color(0x1fffffff)
                        : const Color(0xbcffffff),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        AnimatedBuilder(
                          animation: shake,
                          child: Image.asset(
                            _shellAsset,
                            fit: BoxFit.contain,
                            width: 156,
                            height: 88,
                            excludeFromSemantics: true,
                            errorBuilder: (_, _, _) => const SizedBox(
                              width: 156,
                              height: 88,
                              child: Icon(Icons.toll_outlined, size: 48),
                            ),
                          ),
                          builder: (context, image) => Transform.translate(
                            offset: Offset(
                              _frame(_shakeX, shake.value),
                              _frame(_shakeY, shake.value),
                            ),
                            child: Transform.rotate(
                              angle:
                                  _frame(_shakeAngle, shake.value) *
                                  math.pi /
                                  180,
                              child: enabled || tossing
                                  ? image
                                  : Opacity(opacity: 0.55, child: image),
                            ),
                          ),
                        ),
                        if (showHint)
                          Positioned(
                            right: -18,
                            bottom: 0,
                            child: _ShellTapGuide(animate: animateHint),
                          ),
                      ],
                    ),
                    Text(
                      label,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: enabled
                            ? colors.primary
                            : colors.onSurfaceVariant,
                      ),
                      textAlign: TextAlign.center,
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

double _frame(List<double> frames, double progress) {
  final position = progress * (frames.length - 1);
  final start = position.floor();
  final end = math.min(start + 1, frames.length - 1);
  return frames[start] + (frames[end] - frames[start]) * (position - start);
}

class _ShellTapGuide extends StatefulWidget {
  const _ShellTapGuide({required this.animate});

  final bool animate;

  @override
  State<_ShellTapGuide> createState() => _ShellTapGuideState();
}

class _ShellTapGuideState extends State<_ShellTapGuide>
    with SingleTickerProviderStateMixin {
  late final _motion = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1700),
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate) _motion.repeat();
  }

  @override
  void didUpdateWidget(_ShellTapGuide oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate == oldWidget.animate) return;
    if (widget.animate) {
      _motion.repeat();
    } else {
      _motion.reset();
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedBuilder(
      animation: _motion,
      child: const CustomPaint(
        key: ValueKey('coin-ritual-tap-guide'),
        size: Size.square(44),
        painter: _TapHand(),
      ),
      builder: (context, hand) {
        final phase = (1 - (_motion.value - 0.18).abs() / 0.18).clamp(0.0, 1.0);
        final tap = Curves.easeInOut.transform(phase);
        return Transform.translate(
          offset: Offset(-4 * tap, -6 * tap),
          child: hand,
        );
      },
    ),
  );
}

class _TapHand extends CustomPainter {
  const _TapHand();

  static final _hand = Path()
    ..moveTo(23.5, 38.5)
    ..cubicTo(21, 38.5, 18.4, 37.3, 16.6, 35.8)
    ..lineTo(11, 31)
    ..cubicTo(8.8, 29.2, 8.1, 26.9, 9.7, 25.5)
    ..cubicTo(11.1, 24.2, 13.2, 24.5, 15.8, 26.4)
    ..lineTo(6.9, 15)
    ..cubicTo(5.4, 13.1, 5.9, 10.9, 7.5, 9.7)
    ..cubicTo(9.2, 8.5, 11.2, 9.1, 12.7, 11)
    ..lineTo(19.7, 19.4)
    ..cubicTo(20.2, 17.9, 22.8, 17, 24.5, 18.7)
    ..cubicTo(26.3, 17.7, 28.6, 18.2, 29.7, 20)
    ..cubicTo(31.6, 19.2, 33.4, 20.2, 34.6, 22.1)
    ..lineTo(36, 24.4)
    ..cubicTo(37.6, 27, 38.5, 29, 38.1, 31.8)
    ..lineTo(40.7, 34.4)
    ..quadraticBezierTo(41.4, 35.4, 40.5, 36.2)
    ..lineTo(33, 42.9)
    ..quadraticBezierTo(31.9, 43.7, 30.9, 42.9)
    ..lineTo(27.6, 38.9)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(_hand, Paint()..color = const Color(0xfffffbf3));
    final stroke = Paint()
      ..color = const Color(0xff51463b)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.9
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(_hand, stroke);
    canvas.drawLine(const Offset(24.5, 18.7), const Offset(26, 21), stroke);
    canvas.drawLine(const Offset(29.7, 20), const Offset(31, 22), stroke);

    stroke
      ..color = const Color(0xff976e44)
      ..strokeWidth = 1.7;
    canvas.drawLine(const Offset(3, 8.2), const Offset(0.9, 6.6), stroke);
    canvas.drawLine(const Offset(8, 5.3), const Offset(7.7, 1.5), stroke);
    canvas.drawLine(const Offset(13, 6.3), const Offset(15.2, 3.7), stroke);
  }

  @override
  bool shouldRepaint(_TapHand oldDelegate) => false;
}
