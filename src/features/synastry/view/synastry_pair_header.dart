import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

class SynastryPairHeader extends StatelessWidget {
  const SynastryPairHeader({
    super.key,
    required this.owner,
    required this.partner,
    required this.onOwnerPressed,
    required this.onPartnerPressed,
    this.stageScale = 1,
  });

  final String owner;
  final String? partner;
  final VoidCallback? onOwnerPressed;
  final VoidCallback? onPartnerPressed;
  final double stageScale;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final diameter =
            (constraints.maxWidth * .22).clamp(52.0, 88.0) * stageScale;
        final tileWidth = diameter + 18 * stageScale;
        final gap =
            (constraints.maxWidth * .055).clamp(12.0, 24.0) * stageScale;
        return Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: _PairOrnaments(
                    diameter: diameter,
                    spacing: tileWidth + gap,
                    line: colors.onSurfaceVariant,
                    tint: colors.primaryContainer,
                  ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: gap,
              children: [
                _PersonBadge(
                  width: tileWidth,
                  diameter: diameter,
                  role: 'A 方',
                  name: owner,
                  icon: Icons.person_outline_rounded,
                  tooltip: '选择 A 方',
                  onPressed: onOwnerPressed,
                ),
                _PersonBadge(
                  width: tileWidth,
                  diameter: diameter,
                  role: 'B 方',
                  name: partner ?? context.uiLabel('选择对象'),
                  icon: partner == null
                      ? Icons.add_rounded
                      : Icons.person_outline_rounded,
                  tooltip: '选择 B 方',
                  onPressed: onPartnerPressed,
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _PersonBadge extends StatelessWidget {
  const _PersonBadge({
    required this.width,
    required this.diameter,
    required this.role,
    required this.name,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final double width;
  final double diameter;
  final String role;
  final String name;
  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final isEmptyPartner = icon == Icons.add_rounded;
    return SizedBox(
      width: width,
      child: Tooltip(
        message: context.uiLabel(tooltip),
        excludeFromSemantics: true,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: diameter,
                    height: diameter,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: colors.outline.withValues(alpha: .48),
                      ),
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.outlineVariant),
                        gradient: RadialGradient(
                          center: const Alignment(-.45, -.45),
                          radius: 1.2,
                          colors: [
                            colors.surface,
                            Color.lerp(
                              colors.primaryContainer,
                              colors.onSurface,
                              isEmptyPartner ? .04 : .13,
                            )!,
                          ],
                        ),
                      ),
                      child: Icon(
                        icon,
                        size: diameter * .45,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(height: 7),
                  UiText(
                    role,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colors.onSurfaceVariant,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PairOrnaments extends CustomPainter {
  const _PairOrnaments({
    required this.diameter,
    required this.spacing,
    required this.line,
    required this.tint,
  });

  final double diameter;
  final double spacing;
  final Color line;
  final Color tint;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.width / 2;
    final left = center - spacing / 2;
    final right = center + spacing / 2;
    final radius = diameter / 2;
    final mid = 7 + radius;
    final ink = Paint()
      ..color = line.withValues(alpha: .34)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final wire = Path()
      ..moveTo(left + radius * .82, mid + radius * .54)
      ..quadraticBezierTo(center - 11, mid + radius * .89, center, mid + 2)
      ..quadraticBezierTo(
        center + 11,
        mid + radius * .89,
        right - radius * .82,
        mid + radius * .54,
      );
    canvas.drawPath(wire, ink);
    canvas.drawPath(
      Path()
        ..moveTo(center, mid - 3)
        ..lineTo(center + 4, mid + 2)
        ..lineTo(center, mid + 7)
        ..lineTo(center - 4, mid + 2)
        ..close(),
      ink,
    );

    final wingWidth = math.min(62.0, left - radius - 15);
    if (wingWidth < 14) return;
    final wingHeight = wingWidth * .77;
    for (final side in [-1.0, 1.0]) {
      final join = center + side * (spacing / 2 + radius + 5);
      canvas.save();
      canvas.translate(join, mid);
      canvas.scale(side * wingWidth, wingHeight);
      final outline = Path()
        ..moveTo(.00, .19)
        ..cubicTo(.18, -.27, .58, -.02, .91, -.49)
        ..cubicTo(1.08, -.57, .99, -.15, .79, .03)
        ..cubicTo(.88, -.01, .94, .08, .76, .22)
        ..cubicTo(.79, .21, .79, .34, .61, .40)
        ..cubicTo(.65, .46, .42, .57, .27, .48)
        ..cubicTo(.04, .43, -.07, .31, .00, .19)
        ..close();
      canvas.drawPath(
        outline,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [line.withValues(alpha: .22), tint.withValues(alpha: .66)],
          ).createShader(const Rect.fromLTRB(0, -.55, 1, .55)),
      );
      final featherInk = Paint()
        ..color = line.withValues(alpha: .32)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1 / wingWidth;
      canvas.drawPath(outline, featherInk);
      canvas.drawPath(
        Path()
          ..moveTo(.16, .29)
          ..cubicTo(.41, .36, .69, .11, .79, .03)
          ..moveTo(.28, .36)
          ..quadraticBezierTo(.52, .42, .76, .22),
        featherInk,
      );
      canvas.restore();

      final star = Offset(
        join + side * wingWidth * .59,
        mid - wingHeight * .65,
      );
      canvas.drawLine(star.translate(0, -3), star.translate(0, 3), ink);
      canvas.drawLine(star.translate(-3, 0), star.translate(3, 0), ink);
    }
  }

  @override
  bool shouldRepaint(_PairOrnaments oldDelegate) =>
      diameter != oldDelegate.diameter ||
      spacing != oldDelegate.spacing ||
      line != oldDelegate.line ||
      tint != oldDelegate.tint;
}
