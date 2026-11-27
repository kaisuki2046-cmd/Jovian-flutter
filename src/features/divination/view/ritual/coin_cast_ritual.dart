import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import 'coin_cast_scene.dart';
import 'coin_feedback.dart'
    if (dart.library.js_interop) 'coin_feedback_web.dart';
import 'coin_toss_button.dart';
import 'coin_toss_motion.dart';

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
    this.showFirstTossHint = true,
    this.stageHeightLimit = double.infinity,
    this.stageHeadroom = 0,
  });

  final List<List<int>> tosses;
  final VoidCallback onToss;
  final ValueChanged<int>? onSettled;
  final bool pending;
  final bool active;
  final bool? reducedMotion;
  final bool showFirstTossHint;
  final double stageHeightLimit;
  final double stageHeadroom;

  @override
  State<CoinCastRitual> createState() => _CoinCastRitualState();
}

class _CoinCastRitualState extends State<CoinCastRitual>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _flight =
      AnimationController(vsync: this, duration: coinTossDuration, value: 1)
        ..addStatusListener(_flightStatus)
        ..addListener(_landingFeedback);
  late final AnimationController _shake =
      AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 900),
        value: 1,
      )..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted) setState(() {});
      });
  late final CoinFeedback _feedback;
  late List<List<int>> _recorded;
  late List<List<int>> _visibleTosses;
  var _foreground = true;
  var _tickerEnabled = true;
  var _systemReduced = false;
  var _moving = false;
  var _landingPulses = 0;
  var _requestLatch = false;
  var _tappedShell = false;

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
      _landingPulses = 0;
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
    if (!_moving || !_canAnimate) return;
    final landed =
        coinLandingTimes.lastIndexWhere((time) => time <= _flight.value) + 1;
    if (landed <= _landingPulses) return;
    final first = _landingPulses == 0;
    _landingPulses = landed;
    _feedback.land(first: first);
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
        _shake.isAnimating ||
        widget.pending ||
        _recorded.length >= coinCastLineNames.length)
      return;
    setState(() {
      _requestLatch = true;
      _tappedShell = true;
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
    final complete = _visibleTosses.length == coinCastLineNames.length;
    final tossing = _moving || (widget.pending && !complete);
    final ready =
        _available &&
        !_requestLatch &&
        !tossing &&
        !_shake.isAnimating &&
        _recorded.length < coinCastLineNames.length;
    final last = _visibleTosses.lastOrNull;
    final values = _visibleTosses.map(_lineValue).toList(growable: false);
    final showHint =
        widget.showFirstTossHint && !_tappedShell && _recorded.isEmpty;
    final buttonText = tossing
        ? context.uiLabel('正在投掷…')
        : complete
        ? context.uiLabel('六爻已成')
        : showHint
        ? context.uiLabel('点击龟壳开始投掷')
        : '${context.uiLabel('投掷第 ')}${values.length + 1}${context.uiLabel(' 次')}';
    final resultText = tossing
        ? context.uiLabel('静候落定…')
        : last == null
        ? ''
        : '${context.uiLabel(coinCastLineNames[values.length - 1])} · '
              '${last.map((face) => context.uiLabel(face == 2 ? '字' : '背')).join(' / ')} · ${values.last}';
    final countText = context
        .uiLabel('已完成 {count} / 6 次')
        .replaceFirst('{count}', values.length.toString());
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              container: true,
              header: true,
              child: UiText(
                '静心凝神，每次投掷时想着问题。',
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 6),
            UiText(
              '六爻起卦',
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            CoinCastScene(
              progress: _flight,
              faces: _moving ? _recorded.lastOrNull : last,
              previous: last,
              values: values,
              moving: _moving,
              tossing: tossing,
              flowing: _canAnimate,
              stageHeightLimit: widget.stageHeightLimit,
              stageHeadroom: widget.stageHeadroom,
            ),
            const SizedBox(height: 12),
            Center(
              child: CoinTossButton(
                label: buttonText,
                onPressed: ready ? _startToss : null,
                shake: _shake,
                tossing: tossing,
              ),
            ),
            const SizedBox(height: 6),
            Semantics(
              container: true,
              liveRegion: true,
              child: SizedBox(
                height: last == null && !tossing ? 18 : null,
                child: Text(
                  resultText,
                  textAlign: TextAlign.center,
                  style: tossing
                      ? theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        )
                      : theme.textTheme.bodySmall,
                ),
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
    tosses.length <= coinCastLineNames.length &&
        tosses.every(
          (toss) =>
              toss.length == 3 && toss.every((face) => face == 2 || face == 3),
        ),
  );
  return List.unmodifiable(tosses.map((toss) => List<int>.unmodifiable(toss)));
}

int _lineValue(List<int> toss) => toss.fold(0, (sum, face) => sum + face);
