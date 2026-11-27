import 'dart:math' as math;

const coinTossDuration = Duration(milliseconds: 2800);
const coinLandingTimes = [0.70, 0.75, 0.80];

const _xTurns = [2, 3, 2];
const _yTurns = [3, 2, 4];
const _restingAngles = [-22.0, 24.0, -8.0];
const _restingScales = [0.94, 0.90, 1.08];
const _restingPoints = [(119, 142), (201, 142), (160, 192)];
const _drift = [0.10, -0.09, 0.055];
const _zTurns = [120, -150, 175];
const _degrees = math.pi / 180;
const _gravityPerStageHeight = 11.25;
const _restitution = 0.22;

typedef CoinPose = ({
  double x,
  double y,
  double scale,
  double tilt,
  double flip,
  double spin,
  double edgeAngle,
  double edgeOpacity,
  double faceOffsetX,
  double faceOffsetY,
  double shadowScale,
  double shadowOpacity,
});

({double height, double coinSize, double thickness}) coinStageLayout(
  double width, {
  double heightLimit = double.infinity,
}) {
  final height = math.min((width * 1.24).clamp(300.0, 420.0), heightLimit);
  final coinSize = math.min(math.min(76.0, width * 0.22), height * 0.24);
  return (
    height: height,
    coinSize: coinSize,
    thickness: (coinSize * 0.037).clamp(1.8, 2.8),
  );
}

({double x, double y}) coinRestingPosition(
  double width,
  int index, {
  double heightLimit = double.infinity,
}) {
  final (horizontal, vertical) = _restingPoints[index];
  final height = coinStageLayout(width, heightLimit: heightLimit).height;
  return (
    x: horizontal / 320 * width,
    y: height * (0.50 + 0.48 * vertical / 320),
  );
}

/// Uses the authoritative recorded face to select the final orientation.
CoinPose coinTossPose(
  double progress,
  int index,
  int face,
  double width, {
  int previous = 2,
  double heightLimit = double.infinity,
}) {
  final p = progress.clamp(0.0, 1.0);
  final layout = coinStageLayout(width, heightLimit: heightLimit);
  final rest = coinRestingPosition(width, index, heightLimit: heightLimit);
  final release = 0.08 + index * 0.025;
  final landing = coinLandingTimes[index];
  final airTime = landing - release;
  final elapsed = (p - release).clamp(0.0, airTime);
  final flight = elapsed / airTime;
  final settle = ((p - landing) / (0.96 - landing)).clamp(0.0, 1.0);
  final arc = math.sin(math.pi * flight);
  // Progress advances linearly in time. Both the throw and its smaller bounce
  // use the same constant acceleration within the casting stage.
  final gravity = layout.height * _gravityPerStageHeight;
  final lift = gravity * elapsed * (airTime - elapsed) / 2;
  final bounceTime = airTime * _restitution;
  final bounced = (p - landing).clamp(0.0, bounceTime);
  final rebound = gravity * bounced * (bounceTime - bounced) / 2;
  final decay = p >= landing ? math.exp(-3 * settle) * (1 - settle) : 0.0;
  final rocking = math.sin(settle * math.pi * 5) * decay;
  final initialFace = previous == 3 ? 180 : 0;
  final finalFace = face == 3 ? 180 : 0;
  final ease = flight * flight * (3 - 2 * flight);
  final tilt =
      (58 + 360 * _xTurns[index] * flight - arc * 40 + rocking * 20) * _degrees;
  final flip =
      (initialFace +
          (360 * _yTurns[index] + finalFace - initialFace) * ease +
          rocking * 14) *
      _degrees;
  final normal = math.cos(tilt) * math.cos(flip);
  final elevation = (lift + rebound) / layout.height;
  return (
    x: rest.x + arc * width * _drift[index] + rocking * width * 0.008,
    y: rest.y - lift - rebound,
    scale: _restingScales[index] + arc * 0.13,
    tilt: tilt,
    flip: flip,
    spin:
        (_restingAngles[index] + arc * _zTurns[index] + rocking * 10) *
        _degrees,
    faceOffsetX: math.sin(flip) * layout.thickness / 2,
    faceOffsetY: -math.sin(tilt) * math.cos(flip) * layout.thickness / 2,
    edgeAngle: math.atan2(math.sin(flip), math.sin(tilt) * math.cos(flip)),
    edgeOpacity: (1 - normal.abs() * 7).clamp(0.0, 1.0),
    shadowScale: _restingScales[index] * (1 + elevation * 0.65),
    shadowOpacity: 0.22 * (1 - elevation * 0.95),
  );
}

int visibleCoinFace(CoinPose pose) =>
    math.cos(pose.tilt) * math.cos(pose.flip) >= 0 ? 2 : 3;
