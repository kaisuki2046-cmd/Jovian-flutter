import 'dart:async';
import 'dart:js_interop';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:web/web.dart' as web;

import 'coin_sound_timeline.dart';

typedef _Clip = ({web.AudioBuffer buffer, double offset});
typedef _Sound = ({web.AudioBufferSourceNode source, web.GainNode gain});

class CoinFeedback {
  CoinFeedback() {
    web.document.addEventListener('visibilitychange', _visibility);
  }

  late final JSFunction _visibility = ((web.Event _) {
    if (web.document.hidden) stop();
  }).toJS;
  web.AudioContext? _context;
  web.BiquadFilterNode? _filter;
  Future<List<_Clip>>? _clips;
  final _sounds = <_Sound>{};
  int _generation = 0;
  bool _disposed = false;

  void unlock() => unawaited(_unlock());

  Future<void> _unlock() async {
    final context = await _prepare();
    if (context == null) return;
    try {
      await (_clips ??= _loadClips(context));
    } catch (_) {
      _clips = null;
    }
  }

  Future<web.AudioContext?> _prepare() async {
    if (_disposed || web.document.hidden) return null;
    try {
      final context = _context ??= _createContext();
      if (context.state != 'running') await context.resume().toDart;
      return !_disposed && !web.document.hidden && context.state == 'running'
          ? context
          : null;
    } catch (_) {
      return null;
    }
  }

  web.AudioContext _createContext() {
    final context = web.AudioContext();
    final master = context.createGain()..gain.value = coinSoundMasterVolume;
    master.connect(context.destination);
    _filter = context.createBiquadFilter()
      ..type = 'highpass'
      ..frequency.value = 520
      ..Q.value = 0.65;
    _filter!.connect(master);
    return context;
  }

  Future<List<_Clip>> _loadClips(web.AudioContext context) => Future.wait(
    coinCollisionAssets.map((path) async {
      final bytes = await rootBundle.load(path);
      final copy = Uint8List.fromList(
        bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
      );
      final buffer = await context.decodeAudioData(copy.buffer.toJS).toDart;
      final samples = buffer.getChannelData(0).toDart;
      var peak = 0;
      for (var index = 1; index < samples.length; index++) {
        if (samples[index].abs() > samples[peak].abs()) peak = index;
      }
      return (
        buffer: buffer,
        offset: math.max(0.0, peak / buffer.sampleRate - 0.004),
      );
    }),
  );

  void play({required bool reducedMotion}) => unawaited(_play(reducedMotion));

  Future<void> _play(bool reducedMotion) async {
    stop();
    final generation = _generation;
    final context = await _prepare();
    if (context == null || generation != _generation) return;
    final started = context.currentTime;
    try {
      final clips = await (_clips ??= _loadClips(context));
      if (generation != _generation || web.document.hidden || _disposed) return;
      final start = reducedMotion ? context.currentTime : started;
      final events = reducedMotion ? reducedCoinSoundCues : coinSoundCues;
      for (final event in events) {
        final planned = start + event.at;
        final now = context.currentTime;
        if (planned + 0.09 < now) continue;
        final source = context.createBufferSource();
        final gain = context.createGain();
        final clip = clips[event.variant];
        final at = math.max(planned, now);
        source
          ..buffer = clip.buffer
          ..playbackRate.value = coinSoundRate;
        gain.gain
          ..setValueAtTime(0, at)
          ..linearRampToValueAtTime(event.volume, at + 0.003)
          ..exponentialRampToValueAtTime(event.volume * 0.22, at + 0.025)
          ..exponentialRampToValueAtTime(0.0001, at + 0.085);
        source.connect(gain);
        gain.connect(_filter!);
        final sound = (source: source, gain: gain);
        _sounds.add(sound);
        source.onended = ((web.Event _) => _disconnect(sound)).toJS;
        source.start(at, clip.offset);
        source.stop(at + 0.09);
      }
    } catch (_) {
      _clips = null;
      stop();
    }
  }

  void pulse() {
    if (web.document.hidden || _disposed) return;
    try {
      web.window.navigator.vibrate(6.toJS);
    } catch (_) {
      // Some browsers do not expose the Vibration API.
    }
  }

  void _disconnect(_Sound sound) {
    if (!_sounds.remove(sound)) return;
    sound.source.onended = null;
    sound.source.disconnect();
    sound.gain.disconnect();
  }

  void stop() {
    _generation++;
    for (final sound in _sounds.toList()) {
      try {
        sound.source.stop();
      } catch (_) {
        // The node can already have ended.
      }
      _disconnect(sound);
    }
  }

  void dispose() {
    _disposed = true;
    stop();
    web.document.removeEventListener('visibilitychange', _visibility);
    final context = _context;
    if (context != null) unawaited(_close(context));
  }

  Future<void> _close(web.AudioContext context) async {
    try {
      await context.close().toDart;
    } catch (_) {
      // Closing audio cannot block the ritual from leaving the page.
    }
  }
}
