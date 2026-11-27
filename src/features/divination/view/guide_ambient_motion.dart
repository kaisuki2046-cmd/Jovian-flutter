import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import 'guide_assistant_sprite.dart';

class GuideAssistantGreeting extends StatelessWidget {
  const GuideAssistantGreeting({
    super.key,
    required this.text,
    required this.style,
  });

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    if (!guideMotionEnabled(context))
      return Text(text, textAlign: TextAlign.center, style: style);
    final words = text.contains(' ')
        ? RegExp(r'\S+\s*').allMatches(text).map((word) => word.group(0)!)
        : text.runes.map(String.fromCharCode);
    var index = 0;
    final lines = [
      for (final word in words)
        [
          for (final rune in word.runes)
            (
              index: index++,
              character: rune == 32 ? '\u00a0' : String.fromCharCode(rune),
            ),
        ],
    ];
    final entrance = math.max(0, index - 1) * 40 + 220;
    final wave = math.max(3900, 300 + index * 120 + 720 + 850);
    return Semantics(
      label: text,
      child: ExcludeSemantics(
        child: _GuideMotionClock(
          builder: (context, ms, _) => Wrap(
            alignment: WrapAlignment.center,
            children: [
              for (final word in lines)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final glyph in word)
                      _GreetingGlyph(
                        elapsed: ms - glyph.index * 40,
                        waveElapsed: ms < entrance
                            ? -1
                            : (ms - entrance) % wave - 300 - glyph.index * 120,
                        child: Text(glyph.character, style: style),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GreetingGlyph extends StatelessWidget {
  const _GreetingGlyph({
    required this.elapsed,
    required this.waveElapsed,
    required this.child,
  });

  final double elapsed;
  final double waveElapsed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final visible = (elapsed / 85).clamp(0.0, 1.0);
    final entrance = elapsed < 105
        ? 5 - 6.4 * (elapsed / 105).clamp(0.0, 1.0)
        : -1.4 * (1 - ((elapsed - 105) / 115).clamp(0.0, 1.0));
    final wave = waveElapsed < 0 || waveElapsed >= 720
        ? 0.0
        : -2.0 * math.pow(math.sin(math.pi * waveElapsed / 720), 2);
    return Transform.translate(
      offset: Offset(0, entrance + wave),
      child: visible == 1 ? child : Opacity(opacity: visible, child: child),
    );
  }
}

class GuideSpeechDrift extends StatelessWidget {
  const GuideSpeechDrift({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => _GuideMotionClock(
    child: child,
    builder: (context, ms, child) => Transform.translate(
      key: const ValueKey('guide-speech-drift'),
      offset: Offset(0, -2.7 * math.sin(ms * math.pi * 2 / 5400)),
      child: child,
    ),
  );
}

class GuideDivinationAtmosphere extends StatelessWidget {
  const GuideDivinationAtmosphere({super.key});

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: ExcludeSemantics(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'src/features/divination/assets/assistant/antique-gold-dust.png',
            fit: BoxFit.fill,
            opacity: const AlwaysStoppedAnimation(0.1),
            excludeFromSemantics: true,
          ),
          if (guideMotionEnabled(context))
            _GuideMotionClock(
              builder: (context, ms, _) => RepaintBoundary(
                child: CustomPaint(
                  key: const ValueKey('guide-gold-flecks'),
                  painter: _GoldFlecks(ms / 21000),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _GuideMotionClock extends StatefulWidget {
  const _GuideMotionClock({required this.builder, this.child});
  final Widget Function(BuildContext, double, Widget?) builder;
  final Widget? child;

  @override
  State<_GuideMotionClock> createState() => _GuideMotionClockState();
}

class _GuideMotionClockState extends State<_GuideMotionClock>
    with SingleTickerProviderStateMixin {
  final _time = ValueNotifier(0.0);
  late final Ticker _ticker = createTicker((elapsed) {
    _time.value = _base + elapsed.inMicroseconds / 1000;
  });
  late final AppLifecycleListener _lifecycle;
  double _base = 0;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: (_) => _sync());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  void _sync() {
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    final move =
        guideMotionEnabled(context) &&
        lifecycle != AppLifecycleState.hidden &&
        lifecycle != AppLifecycleState.paused &&
        lifecycle != AppLifecycleState.detached;
    if (move) {
      if (!_ticker.isActive) {
        _base = _time.value;
        _ticker.start();
      }
    } else {
      _ticker.stop();
    }
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _ticker.dispose();
    _time.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => guideMotionEnabled(context)
      ? ValueListenableBuilder<double>(
          valueListenable: _time,
          child: widget.child,
          builder: widget.builder,
        )
      : widget.builder(context, 0, widget.child);
}

const _mainStroke = [
  Offset(-.08, 1.03),
  Offset(.16, .86),
  Offset(.08, .73),
  Offset(.23, .62),
  Offset(.55, .54),
  Offset(.61, .47),
  Offset(.88, .35),
  Offset(.89, .27),
  Offset(.65, .21),
  Offset(.73, .14),
  Offset(1.02, -.04),
];
const _returnCurl = [
  Offset(.18, .64),
  Offset(.38, .53),
  Offset(.47, .42),
  Offset(.58, .33),
  Offset(.73, .30),
  Offset(.71, .36),
  Offset(.54, .43),
  Offset(.64, .47),
  Offset(.84, .32),
];
const _gold = [
  Color(0xff988848),
  Color(0xffa89858),
  Color(0xffb8a858),
  Color(0xffbaaa68),
  Color(0xffc8b878),
  Color(0xffd5c487),
];

double _grain(int index, int channel) {
  final noise = math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return noise - noise.floor();
}

final _flecks = [
  for (var i = 0; i < 40; i++)
    (
      path: i % 4 == 0 ? _returnCurl : _mainStroke,
      offset: _grain(i, 1),
      drift: Offset((_grain(i, 2) - .5) * .18, (_grain(i, 3) - .5) * .10),
      size: i % 7 == 0
          ? 2.3 + _grain(i, 4) * 2
          : .55 + math.pow(_grain(i, 4), 1.6) * 1.35,
      thickness: .40 + _grain(i, 5) * .44,
      tilt: _grain(i, 7) * math.pi,
      color: _gold[i % _gold.length],
    ),
];

class _GoldFlecks extends CustomPainter {
  const _GoldFlecks(this.phase);

  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (final fleck in _flecks) {
      final travel = (phase + fleck.offset) % 1;
      final sample = _sample(fleck.path, travel) + fleck.drift;
      final sideways = .014 * math.sin(fleck.offset * 7 + travel * 11);
      final width = fleck.size.toDouble();
      final height = width * fleck.thickness;
      final opacity =
          math.min(travel / .14, (1 - travel) / .16).clamp(0.0, 1.0) * .6;
      canvas.save();
      canvas.translate(
        size.width * (sample.dx + sideways),
        size.height * sample.dy,
      );
      canvas.rotate(fleck.tilt);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(0, 0, width, height),
          Radius.circular(width * .18),
        ),
        paint..color = fleck.color.withValues(alpha: opacity),
      );
      canvas.restore();
    }
  }

  Offset _sample(List<Offset> points, double progress) {
    final step = progress * (points.length - 1);
    final i = math.min(step.floor(), points.length - 2);
    final t = step - i;
    final start = points[i];
    final end = points[i + 1];
    final startSlope = (end - points[math.max(i - 1, 0)]) / 2;
    final endSlope = (points[math.min(i + 2, points.length - 1)] - start) / 2;
    final span = end - start;
    return start +
        (startSlope +
                (span * 3 -
                        startSlope * 2 -
                        endSlope +
                        (span * -2 + startSlope + endSlope) * t) *
                    t) *
            t;
  }

  @override
  bool shouldRepaint(_GoldFlecks old) => old.phase != phase;
}
