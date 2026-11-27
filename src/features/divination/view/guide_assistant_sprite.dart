import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

const _assets = 'src/features/divination/assets/assistant';
const _frameExtent = 160.0;
const _columns = 12;
const _introLength = 4000.0;
const _expressionInterval = 15000.0;
const _expressionLength = 5500.0;

bool guideMotionEnabled(BuildContext context) =>
    TickerMode.valuesOf(context).enabled &&
    !MediaQuery.disableAnimationsOf(context);

typedef _Clip = ({String name, int frames, double interval});
typedef _Frame = ({_Clip clip, int index});

const _intro = (name: 'intro', frames: 100, interval: 40.0);
const _idle = (name: 'idle', frames: 188, interval: 50.0);
const _listening = (name: 'listening', frames: 46, interval: 50.0);
const _tap = (name: 'tap', frames: 1, interval: 1000.0);
const _expressions = [
  'laugh',
  'wink',
  'surprise',
  'teary',
  'grumpy',
  'sleepy',
  'puzzled',
  'love',
  'excited',
  'listening',
  'uneven',
];

/// Plays frames rendered from the original RN assistant scene.
class GuideAssistantSprite extends StatefulWidget {
  const GuideAssistantSprite({
    super.key,
    this.playIntro = false,
    this.listening = false,
    this.tapCount = 0,
  });

  final bool playIntro;
  final bool listening;
  final int tapCount;

  @override
  State<GuideAssistantSprite> createState() => _GuideAssistantSpriteState();
}

class _GuideAssistantSpriteState extends State<GuideAssistantSprite>
    with SingleTickerProviderStateMixin {
  final _random = math.Random();
  late final Ticker _ticker = createTicker(_tick);
  late final AppLifecycleListener _lifecycle;
  Duration? _lastTick;
  double _activeMs = 0;
  double _idleMs = 0;
  double _expressionMs = 0;
  double _reactionMs = 0;
  int _lastExpressionCycle = 0;
  int? _expression;
  _Frame? _frame;

  bool get _playingIntro => widget.playIntro && _activeMs < _introLength;

  bool get _running {
    final phase = WidgetsBinding.instance.lifecycleState;
    return phase != AppLifecycleState.paused &&
        phase != AppLifecycleState.hidden &&
        phase != AppLifecycleState.detached &&
        guideMotionEnabled(context);
  }

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onStateChange: (_) {
        if (mounted) setState(_syncTicker);
      },
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _activeMs = math.max(_activeMs, _introLength);
      _reactionMs = 0;
    }
    _syncTicker();
  }

  @override
  void didUpdateWidget(GuideAssistantSprite oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.tapCount > oldWidget.tapCount && !_playingIntro && _running) {
      _reactionMs = 1000;
    }
    _frame = _selectFrame();
  }

  void _syncTicker() {
    if (_running) {
      if (!_ticker.isActive) _ticker.start();
    } else {
      _ticker.stop();
      _lastTick = null;
    }
    _frame = _selectFrame();
  }

  void _tick(Duration elapsed) {
    final previous = _lastTick ?? elapsed;
    _lastTick = elapsed;
    final delta = (elapsed - previous).inMicroseconds / 1000;
    final introRemaining = _playingIntro ? _introLength - _activeMs : 0.0;
    _activeMs += delta;
    final idleDelta = math.max(0.0, delta - introRemaining);
    _idleMs += idleDelta;
    if (!widget.listening && _reactionMs <= 0) _expressionMs += idleDelta;
    _reactionMs = math.max(0.0, _reactionMs - delta);
    final cycle = (_expressionMs / _expressionInterval).floor();
    if (cycle > _lastExpressionCycle) {
      _lastExpressionCycle = cycle;
      final old = _expression;
      final choice = _random.nextInt(
        _expressions.length - (old == null ? 0 : 1),
      );
      _expression = old != null && choice >= old ? choice + 1 : choice;
    }
    final current = _selectFrame();
    if (current != _frame) setState(() => _frame = current);
  }

  _Frame? _selectFrame() {
    if (MediaQuery.disableAnimationsOf(context)) {
      return widget.listening ? (clip: _listening, index: 0) : null;
    }
    if (_playingIntro) return _at(_intro, _activeMs);
    if (_reactionMs > 0) return (clip: _tap, index: 0);
    if (widget.listening) return _at(_listening, _idleMs);
    final expressionTime = _expressionMs % _expressionInterval;
    if (_expression case final index? when expressionTime < _expressionLength) {
      final name = _expressions[index];
      return _at((
        name: 'expression-$name',
        frames: 88,
        interval: 62.5,
      ), expressionTime);
    }
    return _at(_idle, _idleMs);
  }

  _Frame _at(_Clip clip, double milliseconds) =>
      (clip: clip, index: (milliseconds / clip.interval).floor() % clip.frames);

  @override
  void dispose() {
    _ticker.dispose();
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final frame = _frame;
    return frame == null
        ? const GuideAssistantStill()
        : _AssistantFrame(
            key: ValueKey('guide-assistant-clip-' + frame.clip.name),
            frame: frame,
          );
  }
}

class GuideAssistantStill extends StatelessWidget {
  const GuideAssistantStill({super.key, this.intro = false});
  final bool intro;

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 1,
    child: Image.asset(
      intro ? '$_assets/motion/intro-first.webp' : '$_assets/portrait.png',
      fit: BoxFit.contain,
      excludeFromSemantics: true,
    ),
  );
}

class _AssistantFrame extends StatefulWidget {
  const _AssistantFrame({super.key, required this.frame});
  final _Frame frame;

  @override
  State<_AssistantFrame> createState() => _AssistantFrameState();
}

class _AssistantFrameState extends State<_AssistantFrame> {
  ImageStream? _stream;
  ImageInfo? _image;
  late final _listener = ImageStreamListener(_loaded, onError: _failed);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  @override
  void didUpdateWidget(_AssistantFrame oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.frame.clip != oldWidget.frame.clip) _load();
  }

  void _load() {
    final name = widget.frame.clip.name;
    final provider = AssetImage('$_assets/motion/$name.webp');
    final stream = provider.resolve(createLocalImageConfiguration(context));
    if (stream.key == _stream?.key) return;
    _stream?.removeListener(_listener);
    _image?.dispose();
    _image = null;
    _stream = stream;
    stream.addListener(_listener);
  }

  void _loaded(ImageInfo image, bool synchronous) {
    _image?.dispose();
    _image = image;
    if (!synchronous && mounted) setState(() {});
  }

  void _failed(Object error, StackTrace? trace) {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _stream?.removeListener(_listener);
    _image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final image = _image?.image;
    if (image == null)
      return GuideAssistantStill(intro: widget.frame.clip == _intro);
    return AspectRatio(
      aspectRatio: 1,
      child: CustomPaint(
        key: const ValueKey('guide-assistant-sprite'),
        painter: _AssistantPainter(image, widget.frame),
      ),
    );
  }
}

class _AssistantPainter extends CustomPainter {
  const _AssistantPainter(this.image, this.frame);
  final ui.Image image;
  final _Frame frame;

  @override
  void paint(Canvas canvas, Size size) {
    final columns = math.min(_columns, frame.clip.frames);
    final x = (frame.index % columns) * _frameExtent;
    final y = (frame.index ~/ columns) * _frameExtent;
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(x, y, _frameExtent, _frameExtent),
      Offset.zero & size,
      Paint()..filterQuality = FilterQuality.low,
    );
  }

  @override
  bool shouldRepaint(_AssistantPainter old) =>
      image != old.image || frame != old.frame;
}
