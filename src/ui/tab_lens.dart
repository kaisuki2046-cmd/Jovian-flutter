import 'dart:math' as math;
import 'dart:ui';

class TabLensPose {
  const TabLensPose(this.x, {this.press = 0, this.travel = 0});

  final double x;
  final double press;
  final double travel;

  static TabLensPose lerp(TabLensPose from, TabLensPose to, double t) =>
      TabLensPose(
        lerpDouble(from.x, to.x, t)!,
        press: lerpDouble(from.press, to.press, t)!,
        travel: lerpDouble(from.travel, to.travel, t)!,
      );

  @override
  bool operator ==(Object other) =>
      other is TabLensPose &&
      x == other.x &&
      press == other.press &&
      travel == other.travel;

  @override
  int get hashCode => Object.hash(x, press, travel);
}

class TabLensOutline {
  TabLensOutline._(this.bounds, this.points);

  final Rect bounds;
  final List<Offset> points;
  late final Path _surface = Path()..addPolygon(points, true);

  Path path({double inset = 0}) {
    if (inset == 0) return _surface;
    final scaleX = 1 - 2 * inset / bounds.width;
    final scaleY = 1 - 2 * inset / bounds.height;
    final center = bounds.size.center(Offset.zero);
    return Path()..addPolygon([
      for (final point in points)
        center +
            Offset(
              (point.dx - center.dx) * scaleX,
              (point.dy - center.dy) * scaleY,
            ),
    ], true);
  }
}

TabLensOutline tabLensOutline({
  required TabLensPose pose,
  required Size tray,
  required Size resting,
}) {
  const clearance = 2.0;
  final radius = resting.shortestSide / 2;
  final horizontal = resting.width / 2 - radius;
  final vertical = resting.height / 2 - radius;
  final rim = <Offset>[
    for (var quadrant = 0; quadrant < 4; quadrant++)
      for (var step = 0; step <= 10; step++)
        Offset(
          math.cos((quadrant * 10 + step) * math.pi / 20) * radius +
              (quadrant == 0 || quadrant == 3 ? horizontal : -horizontal),
          math.sin((quadrant * 10 + step) * math.pi / 20) * radius +
              (quadrant < 2 ? vertical : -vertical),
        ),
  ];
  final speed = pose.travel.clamp(-1.0, 1.0);
  final stretch = 1 + lerpDouble(.32, .14, pose.press)! * speed.abs();
  final rx = resting.width * stretch / 2;
  final ry = resting.height / stretch / 2;
  final deformed = rim.map((point) {
    final nx = point.dx * 2 / resting.width;
    final ny = point.dy * 2 / resting.height;
    return Offset(
      rx * (nx - .17 * speed * (1 - nx * nx) - .09 * speed * ny),
      ry * ny * (1 + .19 * speed * nx),
    );
  }).toList();
  final correction = math.sqrt(_area(rim) / _area(deformed));
  final pressWidth = 1 + .24 * pose.press;
  final points = deformed
      .map(
        (point) =>
            Offset(point.dx * correction * pressWidth, point.dy * correction),
      )
      .toList();
  final minX = points.map((point) => point.dx).reduce(math.min);
  final maxX = points.map((point) => point.dx).reduce(math.max);
  final minY = points.map((point) => point.dy).reduce(math.min);
  final maxY = points.map((point) => point.dy).reduce(math.max);
  final width = math.min(maxX - minX, tray.width - 2 * clearance);
  final height = lerpDouble(maxY - minY, resting.height + 20, pose.press)!;
  final left = (pose.x - width / 2).clamp(
    clearance,
    tray.width - clearance - width,
  );
  return TabLensOutline._(
    Rect.fromLTWH(left, (tray.height - height) / 2, width, height),
    [
      for (final point in points)
        Offset(
          (point.dx - minX) * width / (maxX - minX),
          (point.dy - minY) * height / (maxY - minY),
        ),
    ],
  );
}

double _area(List<Offset> points) {
  var twiceArea = 0.0;
  for (var i = 0; i < points.length; i++) {
    final a = points[i];
    final b = points[(i + 1) % points.length];
    twiceArea += a.dx * b.dy - a.dy * b.dx;
  }
  return twiceArea.abs() / 2;
}
