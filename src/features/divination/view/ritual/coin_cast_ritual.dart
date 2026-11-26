import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'coin_cast_scene.dart';
import 'coin_feedback.dart'
    if (dart.library.js_interop) 'coin_feedback_web.dart';
import 'coin_toss_motion.dart';

const _lineNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const _shakeX = [0.0, -5.0, 5.0, -5.0, 4.0, -4.0, 3.0, -3.0, 2.0, -1.0, 0.0];
const _shakeY = [
  0.0,
  -2.0,
  -4.0,
  -2.0,
  -4.0,
  -2.0,
  -3.0,
  -1.0,
  -2.0,
  -1.0,
  0.0,
];
const _shakeAngle = [
  0.0,
  -9.0,
  9.0,
  -8.0,
  8.0,
  -6.0,
  6.0,
  -4.0,
  3.0,
  -1.0,
  0.0,
];

/// Presents coin tosses produced by the caller's existing casting flow.
class CoinCastRitual extends StatefulWidget {
  const CoinCastRitual({
    super.key,
    required this.tosses,
    required this.onToss,
    this.onSettled,
    this.pending = false,
    this.active = true,
    this.reducedMotion,
  });

  final List<List<int>> tosses;
  final VoidCallback onToss;
  final ValueChanged<int>? onSettled;
  final bool pending;
  final bool active;
  final bool? reducedMotion;

  @override
  State<CoinCastRitual> createState() => _CoinCastRitualState();
}

class _CoinCastRitualState extends State<CoinCastRitual>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _flight =
      AnimationController(vsync: this, duration: coinTossDuration, value: 1)
        ..addStatusListener(_flightStatus)
        ..addListener(_landingFeedback);
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
    value: 1,
  );
  late final CoinFeedback _feedback;
  late List<List<int>> _recorded;
  late List<List<int>> _visibleTosses;
  var _foreground = true;
  var _tickerEnabled = true;
  var _systemReduced = false;
  var _moving = false;
  var _landingPulsed = false;
  var _requestLatch = false;

  bool get _available => widget.active && _foreground && _tickerEnabled;
  bool get _reduced => widget.reducedMotion ?? _systemReduced;
  bool get _canAnimate => _available && !_reduced;

  @override
  void initState() {
    super.initState();
    _feedback = CoinFeedback();
    _recorded = _snapshot(widget.tosses);
    _visibleTosses = _recorded;
    final binding = WidgetsBinding.instance;
    _foreground =
        binding.lifecycleState == null ||
        binding.lifecycleState == AppLifecycleState.resumed;
    binding.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _systemReduced = MediaQuery.disableAnimationsOf(context);
    _tickerEnabled = TickerMode.valuesOf(context).enabled;
    _applyAvailability();
  }

  @override
  void didUpdateWidget(covariant CoinCastRitual oldWidget) {
    super.didUpdateWidget(oldWidget);
    _receiveTosses();
    _applyAvailability();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_foreground == foreground) return;
    setState(() {
      _foreground = foreground;
      _applyAvailability();
    });
  }

  void _applyAvailability() {
    if (!_canAnimate && _moving) _revealRecorded(notify: true);
    if (!_canAnimate && _shake.isAnimating) {
      _shake.stop();
      _shake.value = 1;
    }
    if (!_available) _feedback.stop();
  }

  void _receiveTosses() {
    final incoming = widget.tosses;
    final previousCount = _recorded.length;
    if (_sameTosses(incoming, _recorded)) return;
    final wasMoving = _moving;
    _recorded = _snapshot(incoming);
    final newCount = _recorded.length;
    if (newCount == previousCount + 1 && !wasMoving && _canAnimate) {
      _moving = true;
      _landingPulsed = false;
      _flight.forward(from: 0);
      _feedback.play(reducedMotion: false);
    } else {
      final advanced =
          newCount > previousCount || (wasMoving && newCount == previousCount);
      _revealRecorded(notify: advanced);
      if (advanced && _available && _reduced)
        _feedback.play(reducedMotion: true);
    }
  }

  void _landingFeedback() {
    if (!_moving || _landingPulsed || _flight.value < coinLandingTimes.first)
      return;
    _landingPulsed = true;
    if (_canAnimate) _feedback.pulse();
  }

  void _flightStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed && _moving && mounted) {
      setState(() => _revealRecorded(notify: true));
    }
  }

  void _revealRecorded({required bool notify}) {
    _moving = false;
    _flight.stop();
    _flight.value = 1;
    _visibleTosses = _recorded;
    _feedback.stop();
    if (!notify) return;
    final settled = _recorded;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && identical(_visibleTosses, settled) && !_moving) {
        widget.onSettled?.call(settled.length);
      }
    });
  }

  void _startToss() {
    if (!_available ||
        _requestLatch ||
        _moving ||
        widget.pending ||
        _recorded.length >= _lineNames.length)
      return;
    setState(() {
      _requestLatch = true;
    });
    _feedback.unlock();
    _feedback.pulse();
    if (_canAnimate) _shake.forward(from: 0);
    widget.onToss();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted)
        setState(() {
          _requestLatch = false;
        });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _feedback.dispose();
    _flight.dispose();
    _shake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ready =
        _available &&
        !_requestLatch &&
        !widget.pending &&
        !_moving &&
        _recorded.length < _lineNames.length;
    final complete = _visibleTosses.length == _lineNames.length;
    final last = _visibleTosses.lastOrNull;
    final values = _visibleTosses.map(_lineValue).toList(growable: false);
    final buttonText = _moving
        ? context.uiLabel('正在投掷…')
        : widget.pending && !complete
        ? context.uiLabel('等待投掷结果…')
        : complete
        ? context.uiLabel('六爻已成')
        : values.isEmpty
        ? context.uiLabel('投三枚铜钱')
        : '${context.uiLabel('投掷第 ')}${values.length + 1}${context.uiLabel(' 次')}';
    final resultText = _moving
        ? context.uiLabel('铜钱翻转，静候落定…')
        : last == null
        ? context.uiLabel('字面记 2，背面记 3')
        : '${context.uiLabel(_lineNames[values.length - 1])} · '
              '${last.map((face) => context.uiLabel(face == 2 ? '字' : '背')).join(' / ')} · ${values.last}';
    final countText =
        '${context.uiLabel('已投 ')}${values.length} / '
        '${_lineNames.length}${context.uiLabel(' 次')}';
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              container: true,
              explicitChildNodes: true,
              label: context.uiLabel('六次投掷'),
              child: _LineProgress(values: values),
            ),
            const SizedBox(height: 10),
            CoinCastScene(
              progress: _flight,
              faces: _moving ? _recorded.lastOrNull : last,
              previous: last,
              values: values,
              moving: _moving,
              reducedMotion: _reduced,
            ),
            const SizedBox(height: 6),
            Center(
              child: Semantics(
                container: true,
                button: true,
                enabled: ready,
                label: buttonText,
                onTap: ready ? _startToss : null,
                excludeSemantics: true,
                child: InkWell(
                  key: const ValueKey('coin-ritual-toss-button'),
                  onTap: ready ? _startToss : null,
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 4,
                      horizontal: 10,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedBuilder(
                          animation: _shake,
                          child: Image.asset(
                            coinShellAsset,
                            fit: BoxFit.contain,
                            width: 156,
                            height: 82,
                            excludeFromSemantics: true,
                            errorBuilder: (_, _, _) => const SizedBox(
                              width: 156,
                              height: 82,
                              child: Icon(Icons.toll_outlined, size: 48),
                            ),
                          ),
                          builder: (context, image) => Transform.translate(
                            offset: Offset(
                              _frame(_shakeX, _shake.value),
                              _frame(_shakeY, _shake.value),
                            ),
                            child: Transform.rotate(
                              angle:
                                  _frame(_shakeAngle, _shake.value) *
                                  math.pi /
                                  180,
                              child: image,
                            ),
                          ),
                        ),
                        Text(
                          buttonText,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: ready
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Semantics(
              container: true,
              liveRegion: true,
              child: Text(
                resultText,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 4),
            Semantics(
              container: true,
              liveRegion: true,
              child: Text(
                countText,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _sameTosses(List<List<int>> incoming, List<List<int>> previous) {
  if (incoming.length != previous.length) return false;
  for (var index = 0; index < incoming.length; index++) {
    if (!listEquals(incoming[index], previous[index])) return false;
  }
  return true;
}

List<List<int>> _snapshot(List<List<int>> tosses) {
  assert(
    tosses.length <= _lineNames.length &&
        tosses.every(
          (toss) =>
              toss.length == 3 && toss.every((face) => face == 2 || face == 3),
        ),
  );
  return List.unmodifiable(tosses.map((toss) => List<int>.unmodifiable(toss)));
}

int _lineValue(List<int> toss) => toss.fold(0, (sum, face) => sum + face);

double _frame(List<double> frames, double progress) {
  final position = progress * (frames.length - 1);
  final start = position.floor();
  final end = math.min(start + 1, frames.length - 1);
  return frames[start] + (frames[end] - frames[start]) * (position - start);
}

class _LineProgress extends StatelessWidget {
  const _LineProgress({required this.values});
  final List<int> values;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gap = 4.0;
    return LayoutBuilder(
      builder: (context, constraints) {
        final count = (constraints.maxWidth / 42).floor().clamp(
          1,
          _lineNames.length,
        );
        final width = (constraints.maxWidth - gap * (count - 1)) / count;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final (index, name) in _lineNames.indexed)
              SizedBox(
                width: width,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: index < values.length
                        ? theme.colorScheme.primaryContainer
                        : theme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      children: [
                        Text(
                          context.uiLabel(name),
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                        Text(
                          index < values.length ? '${values[index]}' : '—',
                          style: theme.textTheme.labelLarge,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
