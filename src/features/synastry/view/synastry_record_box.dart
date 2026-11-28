import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../model/synastry_relationship.dart';
import 'synastry_album_selector.dart';
import 'synastry_cover.dart';

class SynastryRecordBox extends StatelessWidget {
  const SynastryRecordBox({
    super.key,
    required this.edition,
    required this.hasRecord,
    this.progress,
  });

  final SynastryEdition edition;
  final bool hasRecord;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    final neutral = Color.lerp(
      colors.surfaceContainerLow,
      colors.onSurface,
      dark ? .055 : .035,
    )!;
    final wall = Color.lerp(
      neutral,
      SynastryCover.paper(edition),
      dark ? .085 : .34,
    )!;
    final accent = Color.lerp(
      colors.onSurfaceVariant,
      SynastryCover.ink(edition),
      dark ? .56 : .70,
    )!;
    final trim = Color.lerp(wall, accent, dark ? .20 : .29)!;
    Widget scene(double progress) {
      final open = const Interval(
        0,
        .62,
        curve: Curves.easeOutCubic,
      ).transform(progress);
      final lift = const Interval(
        .20,
        1,
        curve: Curves.easeOutQuart,
      ).transform(progress);
      return LayoutBuilder(
        builder: (context, constraints) {
          final unit = constraints.maxWidth / 340;
          final sceneHeight = 196 * unit;
          final sleeve = 102 * unit;
          final front = _RecordBoxInk(
            open,
            wall,
            trim,
            colors.shadow,
            accent,
            edition.relationship,
            front: true,
          );
          return SizedBox(
            height: sceneHeight,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _RecordBoxInk(
                      open,
                      wall,
                      trim,
                      colors.shadow,
                      accent,
                      edition.relationship,
                    ),
                  ),
                ),
                if (hasRecord)
                  Positioned(
                    left: 0,
                    top: 0,
                    width: constraints.maxWidth,
                    height: 119 * unit,
                    child: ClipRect(
                      child: Stack(
                        children: [
                          Positioned(
                            top: (91 - 36 * lift) * unit,
                            left: 94 * unit,
                            child: Transform.rotate(
                              angle: -.21 * lift,
                              child: _BlankJacket(
                                size: sleeve,
                                wall: wall,
                                trim: trim,
                              ),
                            ),
                          ),
                          Positioned(
                            top: (87 - 60 * lift) * unit,
                            left: 154 * unit,
                            child: Transform.rotate(
                              angle: .27 * lift,
                              child: SynastryVinyl(
                                edition: edition,
                                size: sleeve,
                                animated: false,
                              ),
                            ),
                          ),
                          Positioned(
                            top: (86 - 68 * lift) * unit,
                            left: 113 * unit,
                            child: Transform.rotate(
                              angle: .06 - .125 * lift,
                              child: SynastryJacket(
                                edition: edition,
                                size: sleeve,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                Positioned.fill(child: CustomPaint(painter: front)),
              ],
            ),
          );
        },
      );
    }

    return ExcludeSemantics(
      child: progress != null
          ? scene(progress!)
          : TweenAnimationBuilder<double>(
              tween: Tween(begin: reduced ? 1 : 0, end: 1),
              duration: reduced
                  ? Duration.zero
                  : const Duration(milliseconds: 880),
              builder: (_, progress, _) => scene(progress),
            ),
    );
  }
}

class SynastryJacket extends StatelessWidget {
  const SynastryJacket({super.key, required this.edition, required this.size});

  final SynastryEdition edition;
  final double size;

  @override
  Widget build(BuildContext context) {
    final paper = SynastryCover.paper(edition);
    final ink = SynastryCover.ink(edition);
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * .047),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * .031),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(paper, Colors.white, .80)!,
            Color.lerp(paper, ink, .12)!,
          ],
        ),
        border: Border.all(color: ink.withValues(alpha: .19), width: .7),
        boxShadow: [
          BoxShadow(
            color: const Color(0xff1e1420).withValues(alpha: .30),
            offset: Offset(size * .026, size * .05),
            blurRadius: size * .052,
          ),
        ],
      ),
      child: SynastryCover(edition),
    );
  }
}

class _BlankJacket extends StatelessWidget {
  const _BlankJacket({
    required this.size,
    required this.wall,
    required this.trim,
  });

  final double size;
  final Color wall;
  final Color trim;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: wall,
      borderRadius: BorderRadius.circular(3),
      border: Border.all(color: trim),
      boxShadow: const [
        BoxShadow(
          color: Color(0x29000000),
          blurRadius: 6,
          offset: Offset(1, 5),
        ),
      ],
    ),
    alignment: Alignment.topCenter,
    padding: const EdgeInsets.only(top: 8),
    child: Container(
      width: size * .33,
      height: 3,
      decoration: BoxDecoration(
        color: trim,
        borderRadius: BorderRadius.circular(3),
      ),
    ),
  );
}

class _RecordBoxInk extends CustomPainter {
  const _RecordBoxInk(
    this.open,
    this.wall,
    this.trim,
    this.shadow,
    this.accent,
    this.theme, {
    this.front = false,
  });

  final double open;
  final Color wall;
  final Color trim;
  final Color shadow;
  final Color accent;
  final SynastryRelationship theme;
  final bool front;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 340, size.height / 196);
    if (front) {
      final side = Path()
        ..moveTo(254, 116)
        ..lineTo(277, 95)
        ..lineTo(277, 148)
        ..quadraticBezierTo(277, 153, 273, 156)
        ..lineTo(254, 174)
        ..close();
      canvas.drawPath(side, Paint()..color = trim);
      final face = RRect.fromRectAndRadius(
        const Rect.fromLTRB(61, 115, 257, 176),
        const Radius.circular(7),
      );
      canvas.drawRRect(
        face,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color.lerp(wall, Colors.white, .19)!,
              wall,
              Color.lerp(wall, trim, .25)!,
            ],
            stops: const [0, .22, 1],
          ).createShader(face.outerRect),
      );
      canvas.drawRRect(
        face.deflate(.4),
        Paint()
          ..color = trim
          ..style = PaintingStyle.stroke
          ..strokeWidth = .72,
      );
      canvas.save();
      canvas.clipRRect(face);
      _flecks(canvas, const Rect.fromLTRB(61, 115, 257, 176), trim);
      canvas.restore();

      final tab = RRect.fromRectAndRadius(
        const Rect.fromLTRB(132, 133, 189, 160),
        const Radius.circular(3),
      );
      canvas.drawRRect(tab, Paint()..color = trim);
      canvas.drawRRect(tab.deflate(2), Paint()..color = wall);
      _seal(canvas, const Offset(160.5, 146.5), 1, .78);
      _seal(canvas, const Offset(95, 147), .75, .44);
      _seal(canvas, const Offset(226, 147), .75, .44);
      canvas.restore();
      return;
    }

    canvas.drawOval(
      const Rect.fromLTWH(35, 153, 263, 34),
      Paint()
        ..color = shadow.withValues(alpha: .17)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12),
    );
    final inside = Path()
      ..moveTo(63, 117)
      ..lineTo(83, 94)
      ..lineTo(276, 94)
      ..lineTo(255, 117)
      ..close();
    canvas.drawPath(inside, Paint()..color = Color.lerp(trim, shadow, .48)!);
    final top = 104 - 48 * open;
    final edge = 256 + 18 * open;
    final lid = Path()
      ..moveTo(83, 96)
      ..lineTo(72 + 11 * open, top)
      ..quadraticBezierTo(71 + 11 * open, top - 4, 77 + 11 * open, top - 4)
      ..lineTo(edge - 5, top - 4)
      ..quadraticBezierTo(edge, top - 4, edge, top + 2)
      ..lineTo(276, 96)
      ..close();
    canvas.drawPath(lid, Paint()..color = Color.lerp(wall, trim, .24)!);
    canvas.save();
    canvas.clipPath(lid);
    _flecks(canvas, Rect.fromLTRB(74, top - 4, 276, 96), trim);
    _seal(canvas, Offset(107, top + 11), .67, .38);
    canvas.restore();
    canvas.drawPath(
      lid,
      Paint()
        ..color = trim
        ..style = PaintingStyle.stroke
        ..strokeWidth = .9,
    );
    canvas.drawLine(
      const Offset(84, 96),
      const Offset(275, 96),
      Paint()
        ..color = trim
        ..strokeWidth = 2.6
        ..strokeCap = StrokeCap.round,
    );
    canvas.restore();
  }

  void _seal(Canvas canvas, Offset center, double scale, double opacity) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(scale);
    final line = Paint()
      ..color = accent.withValues(alpha: opacity)
      ..strokeWidth = 1.05
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    switch (theme) {
      case SynastryRelationship.family:
        canvas.drawPath(
          Path()
            ..moveTo(-11, 6)
            ..quadraticBezierTo(-2, 2, 9, -7)
            ..moveTo(-4, 2)
            ..quadraticBezierTo(-9, -4, -2, -6)
            ..quadraticBezierTo(3, -2, -4, 2)
            ..moveTo(1, 0)
            ..quadraticBezierTo(6, 5, 11, 0)
            ..quadraticBezierTo(7, -4, 1, 0),
          line,
        );
      case SynastryRelationship.friendship:
        const stars = [
          Offset(-11, 4),
          Offset(-3, -6),
          Offset(3, 1),
          Offset(11, -4),
        ];
        for (var i = 1; i < stars.length; i++) {
          canvas.drawLine(stars[i - 1], stars[i], line);
        }
        line.style = PaintingStyle.fill;
        for (final star in stars) {
          canvas.drawCircle(star, 1.55, line);
        }
      case SynastryRelationship.romance:
        canvas.drawPath(
          Path()
            ..moveTo(0, 7)
            ..cubicTo(-4, 3, -12, -1, -9, -5)
            ..quadraticBezierTo(-6, -9, 0, -4)
            ..quadraticBezierTo(6, -9, 9, -5)
            ..cubicTo(12, -1, 4, 3, 0, 7)
            ..close(),
          line,
        );
      case SynastryRelationship.collaboration:
        for (final x in [-4.0, 4.0]) {
          canvas.drawPath(
            Path()
              ..moveTo(x, -7)
              ..lineTo(x + 6, 0)
              ..lineTo(x, 7)
              ..lineTo(x - 6, 0)
              ..close(),
            line,
          );
        }
    }
    canvas.restore();
  }

  void _flecks(Canvas canvas, Rect area, Color ink) {
    if (area.height <= 0) return;
    final random = math.Random(front ? 312 : 343);
    final paint = Paint()..color = ink.withValues(alpha: .34);
    for (var i = 0; i < 330; i++) {
      canvas.drawCircle(
        Offset(
          area.left + random.nextDouble() * area.width,
          area.top + random.nextDouble() * area.height,
        ),
        .13 + random.nextDouble() * .35,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_RecordBoxInk oldDelegate) =>
      open != oldDelegate.open ||
      wall != oldDelegate.wall ||
      trim != oldDelegate.trim ||
      shadow != oldDelegate.shadow ||
      accent != oldDelegate.accent ||
      theme != oldDelegate.theme;
}

class SynastryReportHeading extends StatelessWidget {
  const SynastryReportHeading({
    super.key,
    required this.edition,
    required this.title,
    this.subtitle,
  });

  final SynastryEdition edition;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      spacing: 14,
      children: [
        SynastryJacket(edition: edition, size: 60),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 3,
            children: [
              Semantics(
                header: true,
                child: UiText(title, style: theme.textTheme.titleLarge),
              ),
              if (subtitle case final text?)
                Text(
                  text,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
