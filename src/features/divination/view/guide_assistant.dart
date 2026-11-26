import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

const _portrait = 'src/features/divination/assets/assistant/portrait.png';

bool _canMove(BuildContext context) =>
    TickerMode.valuesOf(context).enabled &&
    !MediaQuery.disableAnimationsOf(context) &&
    !MediaQuery.accessibleNavigationOf(context);

class GuideAssistantWelcomePortrait extends StatefulWidget {
  const GuideAssistantWelcomePortrait({super.key});

  @override
  State<GuideAssistantWelcomePortrait> createState() =>
      _GuideAssistantWelcomePortraitState();
}

class _GuideAssistantWelcomePortraitState
    extends State<GuideAssistantWelcomePortrait>
    with SingleTickerProviderStateMixin {
  late final _reaction = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_canMove(context) && _reaction.isAnimating) _reaction.reset();
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
        onTap: () {
          if (_canMove(context)) _reaction.forward(from: 0);
        },
        child: AnimatedBuilder(
          animation: _reaction,
          child: const _AssistantPortrait(),
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
  const GuideAssistantComposerPortrait({super.key});

  @override
  Widget build(BuildContext context) {
    final anchors = _AssistantAnchors.of(context);
    final portrait = SizedBox.square(
      key: anchors?.composer,
      dimension: 48,
      child: const _AssistantPortrait(),
    );
    return anchors == null
        ? portrait
        : CompositedTransformTarget(
            link: anchors.link,
            child: Opacity(
              key: const ValueKey('guide-assistant-composer'),
              opacity: anchors.flying ? 0 : 1,
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
    if (!_canMove(context) && _source != null) _finish();
  }

  @override
  void didUpdateWidget(covariant GuideAssistantFlight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.welcoming || !_canMove(context)) {
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
      if (to == null || !_canMove(context)) {
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
                child: const _AssistantPortrait(),
                builder: (context, child) {
                  final remaining =
                      1 - Curves.easeInOutSine.transform(_flight.value);
                  final lift = math.sin(math.pi * _flight.value);
                  final distance = source.center - destination.center;
                  return CompositedTransformFollower(
                    key: const ValueKey('guide-assistant-flight'),
                    link: _link,
                    showWhenUnlinked: false,
                    targetAnchor: Alignment.center,
                    followerAnchor: Alignment.center,
                    offset: distance * remaining - Offset(0, 8 * lift),
                    child: Transform.rotate(
                      angle: -0.11 * lift * distance.dx.sign,
                      child: Transform.scale(
                        scale:
                            1 +
                            (source.width / destination.width - 1) * remaining,
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
            child: const IgnorePointer(child: _AssistantPortrait()),
          ),
    ],
  );
}

class _AssistantAnchors extends InheritedWidget {
  const _AssistantAnchors({
    required this.welcome,
    required this.composer,
    required this.link,
    required this.flying,
    required super.child,
  });

  final GlobalKey welcome;
  final GlobalKey composer;
  final LayerLink link;
  final bool flying;

  static _AssistantAnchors? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_AssistantAnchors>();

  @override
  bool updateShouldNotify(_AssistantAnchors oldWidget) =>
      flying != oldWidget.flying;
}

class _AssistantPortrait extends StatelessWidget {
  const _AssistantPortrait();

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 1,
    child: Image.asset(
      _portrait,
      fit: BoxFit.contain,
      excludeFromSemantics: true,
    ),
  );
}
