import 'dart:async';
import 'dart:js_interop';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:web/web.dart' as web;

import 'coin_sound_timeline.dart';

typedef _Sound = ({web.AudioBufferSourceNode source, web.GainNode gain});

class CoinFeedback {
  CoinFeedback() {
    web.document.addEventListener('visibilitychange', _visibility);
  }

  late final JSFunction _visibility = ((web.Event _) {
    if (web.document.hidden) stop();
  }).toJS;
  web.AudioContext? _context;
  late web.GainNode _master;
  Future<List<web.AudioBuffer>>? _clips;
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
    _master = context.createGain()..gain.value = coinSoundMasterVolume;
    _master.connect(context.destination);
    return context;
  }

  Future<List<web.AudioBuffer>> _loadClips(web.AudioContext context) =>
      Future.wait(
        coinCollisionAssets.map((path) async {
          final bytes = await rootBundle.load(path);
          final copy = Uint8List.fromList(
            bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
          );
          return context.decodeAudioData(copy.buffer.toJS).toDart;
        }),
      );

  void play({required bool reducedMotion}) => unawaited(_play(reducedMotion));

  Future<void> _play(bool reducedMotion) async {
    _stopAudio();
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
        final at = math.max(planned, now);
        source.buffer = clips[event.variant];
        gain.gain.value = event.volume;
        source.connect(gain);
        gain.connect(_master);
        final sound = (source: source, gain: gain);
        _sounds.add(sound);
        source.onended = ((web.Event _) => _disconnect(sound)).toJS;
        source.start(at);
      }
    } catch (_) {
      _clips = null;
      stop();
    }
  }

  void pulse() => _vibrate(12);

  void land({required bool first}) => _vibrate(first ? 26 : 13);

  void _vibrate(int milliseconds) {
    if (web.document.hidden || _disposed) return;
    try {
      web.window.navigator.vibrate(milliseconds.toJS);
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
    _stopAudio();
    _vibrate(0);
  }

  void _stopAudio() {
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
    stop();
    _disposed = true;
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
