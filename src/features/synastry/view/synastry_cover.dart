import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../model/synastry_relationship.dart';

class SynastryCover extends StatelessWidget {
  const SynastryCover(this.edition, {super.key});

  final SynastryEdition edition;

  static Color paper(SynastryEdition edition) =>
      Color(_styles[edition.index].paper);
  static Color ink(SynastryEdition edition) =>
      Color(_styles[edition.index].ink);

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: CustomPaint(
        isComplex: true,
        size: const Size.square(120),
        painter: _CoverIllustration(edition),
      ),
    ),
  );
}

enum _Motif {
  heart,
  star,
  moon,
  sun,
  flower,
  kite,
  home,
  cup,
  book,
  plant,
  flag,
  notes,
}

enum _Pose { reach, stride, curl, lift, rest }

typedef _CoverStyle = ({
  int paper,
  int ink,
  int accent,
  int secondary,
  int wash,
  _Motif motif,
  _Pose left,
  _Pose right,
  double tilt,
});

const _styles = <_CoverStyle>[
  (
    paper: 0xffffecf3,
    ink: 0xff684caa,
    accent: 0xffe064a0,
    secondary: 0xff8175d3,
    wash: 0xfff7bdcf,
    motif: _Motif.heart,
    left: _Pose.reach,
    right: _Pose.lift,
    tilt: -.16,
  ),
  (
    paper: 0xfff9e6e7,
    ink: 0xff844665,
    accent: 0xffce6380,
    secondary: 0xffaa86b8,
    wash: 0xffefb3a2,
    motif: _Motif.home,
    left: _Pose.rest,
    right: _Pose.reach,
    tilt: .05,
  ),
  (
    paper: 0xfff0eaf9,
    ink: 0xff52468c,
    accent: 0xffa573b9,
    secondary: 0xff687bbd,
    wash: 0xffc1c5ec,
    motif: _Motif.moon,
    left: _Pose.stride,
    right: _Pose.rest,
    tilt: -.03,
  ),
  (
    paper: 0xffffeee1,
    ink: 0xff8d507c,
    accent: 0xffe07aa0,
    secondary: 0xff8885ce,
    wash: 0xffffcba1,
    motif: _Motif.star,
    left: _Pose.curl,
    right: _Pose.lift,
    tilt: .18,
  ),
  (
    paper: 0xfff3e6fb,
    ink: 0xff6e499a,
    accent: 0xffbf66a5,
    secondary: 0xff688aca,
    wash: 0xffdcb9ec,
    motif: _Motif.flower,
    left: _Pose.lift,
    right: _Pose.stride,
    tilt: -.11,
  ),
  (
    paper: 0xffffefda,
    ink: 0xff704970,
    accent: 0xffde8b51,
    secondary: 0xffaf729f,
    wash: 0xfff3cb92,
    motif: _Motif.sun,
    left: _Pose.rest,
    right: _Pose.reach,
    tilt: -.15,
  ),
  (
    paper: 0xfffff1d4,
    ink: 0xff575195,
    accent: 0xffed9168,
    secondary: 0xff6eb3b5,
    wash: 0xffffcd8e,
    motif: _Motif.kite,
    left: _Pose.stride,
    right: _Pose.lift,
    tilt: .12,
  ),
  (
    paper: 0xffffeddf,
    ink: 0xff7b485e,
    accent: 0xffe78772,
    secondary: 0xff8b81ca,
    wash: 0xfff6be9c,
    motif: _Motif.home,
    left: _Pose.lift,
    right: _Pose.curl,
    tilt: -.10,
  ),
  (
    paper: 0xfff9e8e1,
    ink: 0xff73516c,
    accent: 0xffdb8c6e,
    secondary: 0xff799dab,
    wash: 0xffe8b6b5,
    motif: _Motif.cup,
    left: _Pose.rest,
    right: _Pose.curl,
    tilt: .18,
  ),
  (
    paper: 0xffe4f4ef,
    ink: 0xff376489,
    accent: 0xff53adab,
    secondary: 0xff8179c1,
    wash: 0xff9bd9c4,
    motif: _Motif.star,
    left: _Pose.stride,
    right: _Pose.lift,
    tilt: -.18,
  ),
  (
    paper: 0xffe3eefb,
    ink: 0xff455587,
    accent: 0xff6b97ce,
    secondary: 0xffd280a2,
    wash: 0xffadc9ef,
    motif: _Motif.book,
    left: _Pose.curl,
    right: _Pose.reach,
    tilt: .12,
  ),
  (
    paper: 0xffe9efd7,
    ink: 0xff4e6557,
    accent: 0xff88ad70,
    secondary: 0xffc181a6,
    wash: 0xffcddba4,
    motif: _Motif.book,
    left: _Pose.lift,
    right: _Pose.rest,
    tilt: -.10,
  ),
  (
    paper: 0xfff2f1db,
    ink: 0xff546389,
    accent: 0xff82a46e,
    secondary: 0xff8179c1,
    wash: 0xffcbdc9e,
    motif: _Motif.plant,
    left: _Pose.curl,
    right: _Pose.lift,
    tilt: .15,
  ),
  (
    paper: 0xffeaf1de,
    ink: 0xff376f72,
    accent: 0xff75a782,
    secondary: 0xffc79563,
    wash: 0xffb9d5a8,
    motif: _Motif.cup,
    left: _Pose.reach,
    right: _Pose.curl,
    tilt: -.12,
  ),
  (
    paper: 0xfff1efdb,
    ink: 0xff555872,
    accent: 0xffa4a962,
    secondary: 0xff7e91bb,
    wash: 0xffd3d38c,
    motif: _Motif.flag,
    left: _Pose.lift,
    right: _Pose.reach,
    tilt: .06,
  ),
  (
    paper: 0xffe8f1eb,
    ink: 0xff3c697d,
    accent: 0xff75a49d,
    secondary: 0xffaf80ba,
    wash: 0xffafdbce,
    motif: _Motif.kite,
    left: _Pose.stride,
    right: _Pose.reach,
    tilt: -.18,
  ),
  (
    paper: 0xfff8edd8,
    ink: 0xff566477,
    accent: 0xffce9c5e,
    secondary: 0xff739ea7,
    wash: 0xffecce99,
    motif: _Motif.sun,
    left: _Pose.reach,
    right: _Pose.rest,
    tilt: .08,
  ),
  (
    paper: 0xffecebfa,
    ink: 0xff564d93,
    accent: 0xff987ccc,
    secondary: 0xffda8aa7,
    wash: 0xffc8b6ea,
    motif: _Motif.notes,
    left: _Pose.lift,
    right: _Pose.stride,
    tilt: .12,
  ),
  (
    paper: 0xfff0f1e6,
    ink: 0xff426b7b,
    accent: 0xff77a8b2,
    secondary: 0xffb881aa,
    wash: 0xffb9d6d4,
    motif: _Motif.moon,
    left: _Pose.curl,
    right: _Pose.curl,
    tilt: .08,
  ),
  (
    paper: 0xfffbe8e5,
    ink: 0xff765178,
    accent: 0xffd27691,
    secondary: 0xffd68c53,
    wash: 0xfff5b9a1,
    motif: _Motif.notes,
    left: _Pose.stride,
    right: _Pose.stride,
    tilt: -.10,
  ),
  (
    paper: 0xffe5f3f6,
    ink: 0xff3d588e,
    accent: 0xff659cce,
    secondary: 0xff74b6a6,
    wash: 0xffa7d4e9,
    motif: _Motif.flag,
    left: _Pose.lift,
    right: _Pose.lift,
    tilt: -.07,
  ),
  (
    paper: 0xfff5e9fa,
    ink: 0xff64549a,
    accent: 0xffcb80bd,
    secondary: 0xff6fb3b7,
    wash: 0xffe2bde7,
    motif: _Motif.flower,
    left: _Pose.reach,
    right: _Pose.stride,
    tilt: .16,
  ),
];

class _CoverIllustration extends CustomPainter {
  const _CoverIllustration(this.edition);

  final SynastryEdition edition;

  @override
  void paint(Canvas canvas, Size size) {
    final style = _styles[edition.index];
    final paper = Color(style.paper);
    final ink = Color(style.ink);
    final accent = Color(style.accent);
    final secondary = Color(style.secondary);
    final wash = Color(style.wash);
    const bounds = Rect.fromLTWH(0, 0, 100, 100);
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    canvas.clipRect(bounds);
    canvas.drawRect(bounds, Paint()..color = paper);
    final paint = Paint()..color = wash;
    switch (edition.relationship) {
      case SynastryRelationship.family:
        canvas.drawPath(
          Path()
            ..moveTo(0, 69)
            ..quadraticBezierTo(21, 43, 48, 65)
            ..quadraticBezierTo(81, 87, 100, 52)
            ..lineTo(100, 100)
            ..lineTo(0, 100)
            ..close(),
          paint,
        );
        canvas.drawOval(
          const Rect.fromLTWH(54, 12, 33, 33),
          paint..color = wash.withValues(alpha: .53),
        );
      case SynastryRelationship.friendship:
        canvas.drawPath(
          Path()
            ..moveTo(-5, 88)
            ..cubicTo(23, 79, 23, 96, 53, 67)
            ..cubicTo(81, 39, 83, 48, 109, 24)
            ..lineTo(110, 62)
            ..cubicTo(82, 63, 69, 85, 51, 99)
            ..lineTo(-5, 117)
            ..close(),
          paint,
        );
      case SynastryRelationship.romance:
        canvas.drawOval(const Rect.fromLTWH(10, 17, 63, 74), paint);
        canvas.drawOval(
          const Rect.fromLTWH(39, 30, 58, 71),
          paint..color = accent.withValues(alpha: .23),
        );
      case SynastryRelationship.collaboration:
        canvas.drawPath(
          Path()
            ..moveTo(0, 85)
            ..lineTo(24, 85)
            ..lineTo(24, 74)
            ..lineTo(53, 74)
            ..lineTo(53, 61)
            ..lineTo(73, 61)
            ..lineTo(73, 51)
            ..lineTo(100, 51)
            ..lineTo(100, 100)
            ..lineTo(0, 100)
            ..close(),
          paint,
        );
        canvas.drawCircle(
          const Offset(19, 31),
          14,
          paint..color = wash.withValues(alpha: .5),
        );
    }

    _motif(
      canvas,
      style.motif,
      Offset(50 + style.tilt * 36, 25),
      accent,
      ink,
      13,
    );
    _star(canvas, const Offset(21, 21), 3.4, secondary.withValues(alpha: .74));
    _star(canvas, const Offset(77, 30), 4.4, accent.withValues(alpha: .75));
    _star(canvas, const Offset(62, 84), 2.3, ink.withValues(alpha: .47));
    final arc = Paint()
      ..color = ink.withValues(alpha: .4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .62
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(
      Path()
        ..moveTo(16, 70)
        ..quadraticBezierTo(38, 91, 54, 78)
        ..moveTo(72, 17)
        ..quadraticBezierTo(82, 19, 83, 25),
      arc,
    );

    final smaller =
        edition == SynastryEdition.children ||
        edition == SynastryEdition.parents;
    _figure(
      canvas,
      Offset(32 + style.tilt * 14, smaller ? 59 : 56),
      scale: smaller ? .69 : .88,
      turn: style.tilt - .19,
      reflected: false,
      pose: style.left,
      shirt: accent,
      pants: secondary,
      ink: ink,
      skin: const Color(0xfff4b7ad),
    );
    _figure(
      canvas,
      Offset(68 + style.tilt * 8, 53 + style.tilt * 12),
      scale: .93,
      turn: style.tilt + .19,
      reflected: true,
      pose: style.right,
      shirt: secondary,
      pants: ink,
      ink: ink,
      skin: const Color(0xffe8aa8d),
    );

    // A pair of ink layers gives the cover the irregular speckle of printed paper.
    final random = math.Random(637 + edition.index);
    final light = Path();
    final dark = Path();
    for (var i = 0; i < 2450; i++) {
      final point = Offset(
        random.nextDouble() * 100,
        random.nextDouble() * 100,
      );
      final radius = .06 + random.nextDouble() * .27;
      (i.isEven ? light : dark).addOval(
        Rect.fromCenter(center: point, width: radius * 2.2, height: radius),
      );
    }
    canvas.drawPath(
      light,
      Paint()..color = Colors.white.withValues(alpha: .47),
    );
    canvas.drawPath(dark, Paint()..color = ink.withValues(alpha: .21));
    canvas.restore();
  }

  void _figure(
    Canvas canvas,
    Offset origin, {
    required double scale,
    required double turn,
    required bool reflected,
    required _Pose pose,
    required Color shirt,
    required Color pants,
    required Color ink,
    required Color skin,
  }) {
    canvas.save();
    canvas.translate(origin.dx, origin.dy);
    canvas.rotate(turn);
    canvas.scale(reflected ? -scale : scale, scale);
    final (hand, backLeg, frontLeg) = switch (pose) {
      _Pose.reach => (
        const Offset(20, -23),
        const Offset(-15, 27),
        const Offset(12, 24),
      ),
      _Pose.stride => (
        const Offset(15, -19),
        const Offset(-18, 22),
        const Offset(20, 19),
      ),
      _Pose.curl => (
        const Offset(17, 1),
        const Offset(-13, 18),
        const Offset(15, 23),
      ),
      _Pose.lift => (
        const Offset(13, -31),
        const Offset(-12, 25),
        const Offset(15, 19),
      ),
      _Pose.rest => (
        const Offset(13, 3),
        const Offset(-9, 26),
        const Offset(10, 26),
      ),
    };
    final pen = Paint()
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    void leg(Offset from, Offset knee, Offset foot, Color color) {
      canvas.drawPath(
        Path()
          ..moveTo(from.dx, from.dy)
          ..quadraticBezierTo(knee.dx, knee.dy, foot.dx, foot.dy),
        pen
          ..style = PaintingStyle.stroke
          ..strokeWidth = 7.6
          ..color = color,
      );
      canvas.drawPath(
        Path()
          ..moveTo(foot.dx - 1.8, foot.dy - 1.3)
          ..quadraticBezierTo(
            foot.dx + 1.2,
            foot.dy + 1.8,
            foot.dx + 5.6,
            foot.dy + 1.1,
          ),
        pen
          ..strokeWidth = 4.5
          ..color = ink,
      );
    }

    leg(const Offset(-3, 6), Offset(backLeg.dx + 6, 12), backLeg, pants);
    leg(
      const Offset(4, 6),
      Offset(frontLeg.dx + 2, 10),
      frontLeg,
      Color.lerp(pants, shirt, .22)!,
    );
    canvas.drawPath(
      Path()
        ..moveTo(-5, -12)
        ..quadraticBezierTo(-13, -3, -14, 3)
        ..quadraticBezierTo(-12, 6, -8, 7),
      pen
        ..style = PaintingStyle.stroke
        ..color = skin
        ..strokeWidth = 4.3,
    );
    canvas.drawPath(
      Path()
        ..moveTo(-7, -14)
        ..quadraticBezierTo(-1, -18, 7, -13)
        ..quadraticBezierTo(10, -3, 7, 7)
        ..quadraticBezierTo(0, 11, -7, 6)
        ..quadraticBezierTo(-10, -3, -7, -14)
        ..close(),
      pen
        ..style = PaintingStyle.fill
        ..color = shirt,
    );
    canvas.drawPath(
      Path()
        ..moveTo(6, -12)
        ..quadraticBezierTo(hand.dx - 1, -10, hand.dx, hand.dy),
      pen
        ..style = PaintingStyle.stroke
        ..color = shirt
        ..strokeWidth = 5.4,
    );
    canvas.drawCircle(
      hand,
      3.1,
      pen
        ..style = PaintingStyle.fill
        ..color = skin,
    );
    canvas.drawLine(
      hand.translate(-.55, -.2),
      hand.translate(1.35, -1.14),
      pen
        ..strokeWidth = .7
        ..color = ink,
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-2.7, -19, 5.2, 7),
        const Radius.circular(2),
      ),
      pen..color = skin,
    );
    canvas.drawOval(const Rect.fromLTWH(-6.8, -30, 12, 13.3), pen);
    canvas.drawPath(
      Path()
        ..moveTo(-6.3, -22.2)
        ..cubicTo(-11, -29, -3.4, -34, 4.1, -29)
        ..quadraticBezierTo(7.5, -26, 2.8, -26)
        ..quadraticBezierTo(-1, -28, -1.8, -23)
        ..quadraticBezierTo(-3.7, -20.8, -6.3, -22.2),
      pen..color = ink,
    );
    canvas.drawCircle(const Offset(2.35, -23.9), .8, pen);
    canvas.drawPath(
      Path()
        ..moveTo(4.1, -24.8)
        ..lineTo(6.25, -22.15)
        ..lineTo(4.3, -21.6)
        ..close(),
      pen..color = skin,
    );
    canvas.drawLine(
      const Offset(-2.8, 1.5),
      const Offset(5, 2.6),
      pen
        ..color = ink.withValues(alpha: .28)
        ..strokeWidth = .65,
    );
    canvas.restore();
  }

  void _motif(
    Canvas canvas,
    _Motif motif,
    Offset at,
    Color accent,
    Color ink,
    double radius,
  ) {
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(-.15);
    final pen = Paint()..color = accent;
    final r = radius;
    switch (motif) {
      case _Motif.heart:
        canvas.drawPath(
          Path()
            ..moveTo(0, 9)
            ..cubicTo(-22, -3, -10, -17, 0, -8)
            ..cubicTo(10, -17, 22, -3, 0, 9)
            ..close(),
          pen,
        );
      case _Motif.star:
        _star(canvas, Offset.zero, r, accent);
      case _Motif.moon:
        canvas.drawPath(
          Path()
            ..moveTo(3, -12)
            ..cubicTo(-17, -13, -16, 15, 8, 9)
            ..cubicTo(-3, 9, -6, -4, 3, -12)
            ..close(),
          pen,
        );
      case _Motif.sun:
        _star(canvas, Offset.zero, r, accent, rays: 11);
        canvas.drawCircle(
          Offset.zero,
          5.7,
          pen..color = ink.withValues(alpha: .33),
        );
      case _Motif.flower:
        for (var i = 0; i < 5; i++) {
          final angle = i * math.pi * 2 / 5;
          canvas.drawCircle(
            Offset(math.cos(angle) * 6, math.sin(angle) * 6),
            5.1,
            pen,
          );
        }
        canvas.drawCircle(Offset.zero, 2.9, pen..color = ink);
      case _Motif.kite:
        canvas.drawPath(
          Path()
            ..moveTo(0, -12)
            ..lineTo(10, -2)
            ..lineTo(0, 11)
            ..lineTo(-10, -2)
            ..close(),
          pen,
        );
        canvas.drawPath(
          Path()
            ..moveTo(0, 8)
            ..quadraticBezierTo(5, 13, -2, 16),
          pen
            ..color = ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = .75,
        );
      case _Motif.home:
        canvas.drawPath(
          Path()
            ..moveTo(-12, -1)
            ..lineTo(0, -12)
            ..lineTo(12, -1)
            ..lineTo(9, -1)
            ..lineTo(9, 9)
            ..lineTo(-9, 9)
            ..lineTo(-9, -1)
            ..close(),
          pen,
        );
        canvas.drawRect(const Rect.fromLTWH(-1.7, 3, 3.4, 6), pen..color = ink);
      case _Motif.cup:
        canvas.drawOval(const Rect.fromLTWH(4, -5, 9, 9), pen);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(-10, -6, 19, 15),
            const Radius.circular(3),
          ),
          pen,
        );
        canvas.drawArc(
          const Rect.fromLTWH(-4, -14, 8, 8),
          -.9,
          3.2,
          false,
          pen
            ..color = ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = .9,
        );
      case _Motif.book:
        canvas.drawPath(
          Path()
            ..moveTo(-12, -7)
            ..quadraticBezierTo(-4, -9, 0, -4)
            ..quadraticBezierTo(5, -9, 12, -7)
            ..lineTo(12, 7)
            ..quadraticBezierTo(5, 6, 0, 10)
            ..quadraticBezierTo(-5, 6, -12, 7)
            ..close(),
          pen,
        );
        canvas.drawLine(
          const Offset(0, -4),
          const Offset(0, 9),
          pen
            ..color = ink
            ..strokeWidth = .8,
        );
      case _Motif.plant:
        canvas.drawOval(const Rect.fromLTWH(-10, -6, 13, 6), pen);
        canvas.drawOval(const Rect.fromLTWH(-2, -12, 12, 7), pen);
        canvas.drawLine(
          const Offset(0, -8),
          const Offset(0, 7),
          pen
            ..color = ink
            ..strokeWidth = 1.2,
        );
      case _Motif.flag:
        canvas.drawPath(
          Path()
            ..moveTo(-7, -10)
            ..quadraticBezierTo(3, -8, 11, -10)
            ..lineTo(7, -4)
            ..lineTo(11, 1)
            ..quadraticBezierTo(3, 3, -7, 1)
            ..close(),
          pen,
        );
        canvas.drawLine(
          const Offset(-7, -11),
          const Offset(-7, 11),
          pen
            ..color = ink
            ..strokeWidth = 1.2,
        );
      case _Motif.notes:
        canvas.drawOval(const Rect.fromLTWH(-11, 2, 9, 6), pen);
        canvas.drawOval(const Rect.fromLTWH(2, 0, 9, 6), pen);
        canvas.drawPath(
          Path()
            ..moveTo(-3, 5)
            ..lineTo(-3, -8)
            ..lineTo(10, -11)
            ..lineTo(10, 3),
          pen
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6,
        );
    }
    canvas.restore();
  }

  void _star(
    Canvas canvas,
    Offset at,
    double radius,
    Color color, {
    int rays = 5,
  }) {
    final path = Path();
    for (var i = 0; i < rays * 2; i++) {
      final angle = math.pi * (i / rays - .5);
      final length = i.isEven ? radius : radius * .40;
      final point =
          at + Offset(math.cos(angle) * length, math.sin(angle) * length);
      if (i == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    canvas.drawPath(path..close(), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_CoverIllustration oldDelegate) =>
      edition != oldDelegate.edition;
}
