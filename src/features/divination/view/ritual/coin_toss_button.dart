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
  });

  final String label;
  final VoidCallback? onPressed;
  final Animation<double> shake;
  final bool tossing;

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
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedBuilder(
                  animation: shake,
                  child: Stack(
                    children: [
                      Positioned(
                        left: 10,
                        right: 10,
                        bottom: 11,
                        height: 12,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: const BorderRadius.all(
                              Radius.elliptical(68, 6),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: colors.shadow.withValues(
                                  alpha: dark ? 0.9 : 0.5,
                                ),
                                blurRadius: 12,
                                spreadRadius: 1,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Image.asset(
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
                    ],
                  ),
                  builder: (context, shell) => Transform.translate(
                    offset: Offset(
                      _frame(_shakeX, shake.value),
                      _frame(_shakeY, shake.value),
                    ),
                    child: Transform.rotate(
                      angle: _frame(_shakeAngle, shake.value) * math.pi / 180,
                      child: enabled || tossing
                          ? shell
                          : Opacity(opacity: 0.55, child: shell),
                    ),
                  ),
                ),
                Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: enabled ? colors.primary : colors.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
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
