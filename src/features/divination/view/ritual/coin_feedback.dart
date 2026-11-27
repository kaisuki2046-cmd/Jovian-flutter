import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'coin_sound_timeline.dart';

class CoinFeedback {
  CoinFeedback() {
    unlock();
  }

  static const _audio = MethodChannel('jovian/coin_audio');
  final _timers = <Timer>[];
  bool _playing = false;

  bool get _supported =>
      defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS;

  void unlock() {
    if (_supported) unawaited(_invoke('prepare', coinCollisionAssets));
  }

  void play({required bool reducedMotion}) {
    if (!_supported) return;
    stop();
    _playing = true;
    final cues = reducedMotion ? reducedCoinSoundCues : coinSoundCues;
    for (final cue in cues) {
      void strike() => unawaited(
        _invoke('strike', {
          'variant': cue.variant,
          'volume': cue.volume * coinSoundMasterVolume,
          'rate': 1.0,
        }),
      );

      if (cue.at == 0) {
        strike();
      } else {
        _timers.add(
          Timer(Duration(microseconds: (cue.at * 1e6).round()), strike),
        );
      }
    }
  }

  void stop() {
    if (!_playing) return;
    _playing = false;
    for (final timer in _timers) {
      timer.cancel();
    }
    _timers.clear();
    unawaited(_invoke('stop'));
  }

  void dispose() => stop();

  Future<void> _invoke(String method, [Object? arguments]) async {
    try {
      await _audio.invokeMethod<void>(method, arguments);
    } on PlatformException {
      // Audio availability never controls whether a toss can be recorded.
    } on MissingPluginException {
      // A frontend host without this channel still supports the casting UI.
    }
  }

  void pulse() {
    if (_supported) {
      unawaited(HapticFeedback.selectionClick().catchError((Object _) {}));
    }
  }

  void land({required bool first}) {
    if (!_supported) return;
    final impact = first
        ? HapticFeedback.mediumImpact()
        : HapticFeedback.lightImpact();
    unawaited(impact.catchError((Object _) {}));
  }
}
