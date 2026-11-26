import 'package:material_ui/material_ui.dart';

enum TabGlyphShape { chart, match, oracle, message, profile }

class TabGlyph extends StatelessWidget {
  const TabGlyph(this.shape, {super.key, this.selected = false});

  final TabGlyphShape shape;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = selected
        ? (dark ? const Color(0xff73b3ff) : const Color(0xff176ce4))
        : (dark ? const Color(0xffaeb0b7) : const Color(0xff61666c));
    return CustomPaint(
      size: const Size.square(24),
      painter: _TabGlyphPainter(shape, color, selected),
    );
  }
}

class _TabGlyphPainter extends CustomPainter {
  const _TabGlyphPainter(this.shape, this.color, this.selected);

  final TabGlyphShape shape;
  final Color color;
  final bool selected;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);
    final fill = Paint()..color = color;
    final outline = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.65
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final highlight = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final detail = selected ? highlight : outline;
    switch (shape) {
      case TabGlyphShape.chart:
        canvas.drawCircle(
          const Offset(12, 12),
          selected ? 10 : 8.6,
          selected ? fill : outline,
        );
        canvas.drawPath(_spark(12, 12, selected ? 5.8 : 4.4), detail);
        if (!selected) {
          canvas.drawLine(
            const Offset(12, 1.8),
            const Offset(12, 4.6),
            outline,
          );
          canvas.drawLine(
            const Offset(12, 19.4),
            const Offset(12, 22.2),
            outline,
          );
          canvas.drawLine(
            const Offset(1.8, 12),
            const Offset(4.6, 12),
            outline,
          );
          canvas.drawLine(
            const Offset(19.4, 12),
            const Offset(22.2, 12),
            outline,
          );
        }
      case TabGlyphShape.match:
        const left = Offset(9.5, 12);
        const right = Offset(14.5, 12);
        canvas.drawCircle(left, 6.5, selected ? fill : outline);
        canvas.drawCircle(right, 6.5, selected ? fill : outline);
        if (selected) {
          canvas.drawArc(
            Rect.fromCircle(center: right, radius: 6.5),
            1.96,
            2.36,
            false,
            highlight,
          );
        }
      case TabGlyphShape.oracle:
        final body = RRect.fromRectAndRadius(
          selected
              ? const Rect.fromLTRB(4.5, 2, 19.5, 22)
              : const Rect.fromLTRB(5.5, 2.8, 18.5, 21.2),
          Radius.circular(selected ? 2.5 : 2),
        );
        canvas.drawRRect(body, selected ? fill : outline);
        canvas.drawLine(
          const Offset(8.5, 8.4),
          const Offset(15.5, 8.4),
          detail,
        );
        canvas.drawLine(
          const Offset(8.5, 12),
          Offset(selected ? 15.5 : 10.5, 12),
          detail,
        );
        if (!selected)
          canvas.drawLine(
            const Offset(13.5, 12),
            const Offset(15.5, 12),
            detail,
          );
        canvas.drawLine(
          const Offset(8.5, 15.6),
          Offset(selected ? 13.5 : 15.5, 15.6),
          detail,
        );
      case TabGlyphShape.message:
        final bubble = Path()
          ..moveTo(12, 3.4)
          ..cubicTo(16.8, 3.4, 20.6, 6.7, 20.6, 10.9)
          ..cubicTo(20.6, 15.2, 16.7, 18.4, 12, 18.4)
          ..cubicTo(10.9, 18.4, 9.8, 18.2, 8.8, 17.8)
          ..lineTo(4.5, 19.4)
          ..lineTo(5.5, 15.7)
          ..quadraticBezierTo(3.4, 13.6, 3.4, 10.9)
          ..cubicTo(3.4, 6.7, 7.3, 3.4, 12, 3.4)
          ..close();
        canvas.drawPath(bubble, selected ? fill : outline);
        if (selected) {
          for (final x in [8.2, 12.0, 15.8]) {
            canvas.drawLine(Offset(x, 11), Offset(x + 0.1, 11), highlight);
          }
        } else {
          canvas.drawPath(_spark(12, 11, 3.6), outline);
        }
      case TabGlyphShape.profile:
        canvas.drawCircle(
          Offset(selected ? 12 : 10.9, 8.2),
          selected ? 4.1 : 3.6,
          selected ? fill : outline,
        );
        final shoulders = Path()
          ..moveTo(3.6, 20)
          ..cubicTo(4.8, 13.3, 16.4, 10.5, 18.2, 20);
        if (selected) {
          shoulders.reset();
          shoulders.moveTo(3.5, 19.8);
          shoulders.cubicTo(3.5, 16, 7.3, 13.2, 12, 13.2);
          shoulders.cubicTo(16.7, 13.2, 20.5, 16, 20.5, 19.8);
          shoulders.quadraticBezierTo(20.5, 20.9, 19.4, 20.9);
          shoulders.lineTo(4.6, 20.9);
          shoulders.quadraticBezierTo(3.5, 20.9, 3.5, 19.8);
          shoulders.close();
        } else {
          canvas.drawPath(_spark(19.3, 6.2, 3), outline);
        }
        canvas.drawPath(shoulders, selected ? fill : outline);
    }
  }

  Path _spark(double x, double y, double radius) {
    final bend = radius * 0.17;
    return Path()
      ..moveTo(x, y - radius)
      ..quadraticBezierTo(x + bend, y - bend, x + radius, y)
      ..quadraticBezierTo(x + bend, y + bend, x, y + radius)
      ..quadraticBezierTo(x - bend, y + bend, x - radius, y)
      ..quadraticBezierTo(x - bend, y - bend, x, y - radius)
      ..close();
  }

  @override
  bool shouldRepaint(covariant _TabGlyphPainter oldDelegate) =>
      oldDelegate.shape != shape ||
      oldDelegate.color != color ||
      oldDelegate.selected != selected;
}
