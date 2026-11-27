import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import 'guide_assistant_sprite.dart';

class GuideAssistantWelcomePortrait extends StatefulWidget {
  const GuideAssistantWelcomePortrait({super.key});

  @override
  State<GuideAssistantWelcomePortrait> createState() =>
      _GuideAssistantWelcomePortraitState();
}

class _GuideAssistantWelcomePortraitState
    extends State<GuideAssistantWelcomePortrait>
    with SingleTickerProviderStateMixin {
  int _tapCount = 0;
  late final _reaction = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!guideMotionEnabled(context) && _reaction.isAnimating)
      _reaction.reset();
  }

  @override
  void dispose() {
    _reaction.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    key: _AssistantAnchors.of(context)?.welcome,
    child: Semantics(
      label: context.uiLabel('戴着蓝色耳机的果冻章鱼助手'),
      button: true,
      child: InkWell(
        key: const ValueKey('guide-assistant-welcome'),
        borderRadius: BorderRadius.circular(90),
        hoverColor: Colors.transparent,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        onTap: () {
          if (guideMotionEnabled(context)) {
            setState(() => _tapCount++);
            _reaction.forward(from: 0);
          }
        },
        child: AnimatedBuilder(
          animation: _reaction,
          child: GuideAssistantSprite(
            key: _AssistantAnchors.of(context)?.actor,
            playIntro: true,
            tapCount: _tapCount,
          ),
          builder: (context, child) => Transform.scale(
            key: const ValueKey('guide-assistant-response'),
            scale: 1 + 0.075 * math.sin(math.pi * _reaction.value),
            child: child,
          ),
        ),
      ),
    ),
  );
}

class GuideAssistantComposerPortrait extends StatelessWidget {
  const GuideAssistantComposerPortrait({
    super.key,
    this.listening = false,
    this.dimmed = false,
  });

  final bool listening;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final anchors = _AssistantAnchors.of(context);
    final portrait = SizedBox.square(
      key: anchors?.composer,
      dimension: 48,
      child: anchors?.flying == true
          ? null
          : GuideAssistantSprite(
              key: anchors?.actor,
              playIntro: anchors?.playIntro ?? false,
              listening: listening,
            ),
    );
    return anchors == null
        ? portrait
        : CompositedTransformTarget(
            link: anchors.link,
            child: Opacity(
              key: const ValueKey('guide-assistant-composer'),
              opacity: anchors.flying
                  ? 0
                  : dimmed
                  ? .45
                  : 1,
              child: portrait,
            ),
          );
  }
}

/// Moves the welcome portrait into the actual composer slot as the chat starts.
class GuideAssistantFlight extends StatefulWidget {
  const GuideAssistantFlight({
    super.key,
    required this.welcoming,
    required this.child,
  });

  final bool welcoming;
  final Widget child;

  @override
  State<GuideAssistantFlight> createState() => _GuideAssistantFlightState();
}

class _GuideAssistantFlightState extends State<GuideAssistantFlight>
    with SingleTickerProviderStateMixin {
  final _stage = GlobalKey();
  final _welcome = GlobalKey();
  final _composer = GlobalKey();
  final _link = LayerLink();
  GlobalKey _actor = GlobalKey();
  late bool _playedWelcome = widget.welcoming;
  Rect? _source;
  Rect? _sourceInStage;
  Rect? _destination;
  late final _flight =
      AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 560),
      )..addStatusListener((status) {
        if (status == AnimationStatus.completed) setState(_finish);
      });

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!guideMotionEnabled(context) && _source != null) _finish();
  }

  @override
  void didUpdateWidget(covariant GuideAssistantFlight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.welcoming && !oldWidget.welcoming) {
      _actor = GlobalKey();
      _playedWelcome = true;
    }
    if (widget.welcoming || !guideMotionEnabled(context)) {
      if (_source != null) _finish();
      return;
    }
    if (!oldWidget.welcoming) return;

    final from = _measure(_welcome);
    final stage = _measure(_stage);
    if (from == null || stage == null || !from.overlaps(stage)) return;
    _source = from;
    _sourceInStage = from.shift(-stage.topLeft);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !identical(_source, from)) return;
      final to = _measure(_composer);
      if (to == null || !guideMotionEnabled(context)) {
        setState(_finish);
        return;
      }
      setState(() => _destination = to);
      _flight.forward(from: 0);
    });
  }

  Rect? _measure(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox ||
        !box.attached ||
        !box.hasSize ||
        box.size.isEmpty) {
      return null;
    }
    return box.localToGlobal(Offset.zero) & box.size;
  }

  void _finish() {
    _flight.stop();
    _source = _sourceInStage = _destination = null;
  }

  @override
  void dispose() {
    _flight.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    key: _stage,
    fit: StackFit.expand,
    children: [
      _AssistantAnchors(
        welcome: _welcome,
        composer: _composer,
        link: _link,
        actor: _actor,
        playIntro: _playedWelcome,
        flying: _source != null,
        child: widget.child,
      ),
      if (_source case final source?)
        if (_destination case final destination?)
          Positioned(
            width: destination.width,
            height: destination.height,
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _flight,
                child: GuideAssistantSprite(
                  key: _actor,
                  playIntro: _playedWelcome,
                ),
                builder: (context, child) {
                  final progress = Curves.easeInOutSine.transform(
                    _flight.value,
                  );
                  final distance = source.center - destination.center;
                  final lift = math.min(10.0, distance.dy.abs() * .1);
                  final settle = math.min(4.0, distance.dy.abs() * .04);
                  final size = source.width / destination.width;
                  final tilt = -7 * math.pi / 180 * distance.dx.sign;
                  return CompositedTransformFollower(
                    key: const ValueKey('guide-assistant-flight'),
                    link: _link,
                    showWhenUnlinked: false,
                    targetAnchor: Alignment.center,
                    followerAnchor: Alignment.center,
                    offset: Offset(
                      distance.dx *
                          _flightBlend(progress, const [1, 1, .78, .22, 0, 0]),
                      _flightBlend(progress, [
                        distance.dy,
                        distance.dy - lift,
                        distance.dy * .85,
                        distance.dy * .28,
                        settle,
                        0,
                      ]),
                    ),
                    child: Transform.rotate(
                      angle:
                          tilt *
                          _flightBlend(progress, const [0, .5, 1, 1 / 3, 0, 0]),
                      child: Transform.scale(
                        scale: _flightBlend(progress, [
                          size,
                          size * 1.02,
                          size * .72 + .28,
                          size * .26 + .74,
                          .95,
                          1,
                        ]),
                        child: child,
                      ),
                    ),
                  );
                },
              ),
            ),
          )
        else
          Positioned.fromRect(
            rect: _sourceInStage!,
            child: IgnorePointer(
              child: GuideAssistantSprite(
                key: _actor,
                playIntro: _playedWelcome,
              ),
            ),
          ),
    ],
  );
}

class _AssistantAnchors extends InheritedWidget {
  const _AssistantAnchors({
    required this.welcome,
    required this.composer,
    required this.link,
    required this.actor,
    required this.playIntro,
    required this.flying,
    required super.child,
  });

  final GlobalKey welcome;
  final GlobalKey composer;
  final LayerLink link;
  final GlobalKey actor;
  final bool playIntro;
  final bool flying;

  static _AssistantAnchors? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_AssistantAnchors>();

  @override
  bool updateShouldNotify(_AssistantAnchors oldWidget) =>
      flying != oldWidget.flying ||
      actor != oldWidget.actor ||
      playIntro != oldWidget.playIntro;
}

double _flightBlend(double progress, List<double> values) {
  const stops = [0.0, .13, .38, .72, .9, 1.0];
  final end = stops.indexWhere((stop) => stop >= progress, 1);
  final start = end - 1;
  final mix = (progress - stops[start]) / (stops[end] - stops[start]);
  return values[start] + (values[end] - values[start]) * mix;
}
