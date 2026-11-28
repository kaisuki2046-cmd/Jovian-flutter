import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';

class SynastryMusic {
  static final _music = _pianoLoop();
  AudioPlayer? _player;

  Future<bool> play({required double volume}) async {
    final player = _player ??= AudioPlayer();
    try {
      await player.setReleaseMode(ReleaseMode.loop);
      if (!identical(_player, player)) return false;
      await player.play(
        BytesSource(_music, mimeType: 'audio/wav'),
        volume: volume,
      );
      return identical(_player, player);
    } catch (_) {
      if (identical(_player, player)) stop();
      return false;
    }
  }

  Future<void> setVolume(double volume) async {
    try {
      await _player?.setVolume(volume);
    } catch (_) {
      // The record stays usable when audio cannot be adjusted.
    }
  }

  void stop() {
    final player = _player;
    _player = null;
    if (player != null) unawaited(_release(player));
  }

  Future<void> _release(AudioPlayer player) async {
    try {
      await player.dispose();
    } catch (_) {
      // Audio is optional on platforms without a playback engine.
    }
  }
}

Uint8List _pianoLoop() {
  const rate = 22050;
  const count = rate * 10;
  const chords = [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [48, 55, 59, 64],
    [55, 59, 62, 69],
  ];
  final signal = Float32List(count);

  void note(int midi, double time, double velocity) {
    final start = (time * rate).round();
    final cycles = 2 * math.pi * 440 * math.pow(2, (midi - 69) / 12) / rate;
    for (var i = 0; i < rate * 1.95; i++) {
      final seconds = i / rate;
      final envelope =
          (1 - math.exp(-seconds / .024)) *
          math.exp(-seconds / .56) *
          (1 - math.pow(seconds / 1.95, 5));
      final phase = cycles * i;
      final timbre =
          math.sin(phase) +
          .27 * math.sin(phase * 2.003) +
          .08 * math.sin(phase * 3.009);
      signal[(start + i) % count] += velocity * envelope * timbre;
    }
  }

  for (var bar = 0; bar < chords.length; bar++) {
    final chord = chords[bar];
    final time = bar * 2.5;
    note(chord[0], time, .18);
    note(chord[1], time + .29, .10);
    note(chord[2], time + .68, .135);
    note(chord[3] + 12, time + 1.11, .082);
    note(chord[2] + (bar.isEven ? 12 : 0), time + 1.75, .073);
  }

  final bytes = ByteData(44 + count * 2);
  void label(int start, String value) {
    for (var char = 0; char < value.length; char++) {
      bytes.setUint8(start + char, value.codeUnitAt(char));
    }
  }

  label(0, 'RIFF');
  bytes.setUint32(4, 36 + count * 2, Endian.little);
  label(8, 'WAVE');
  label(12, 'fmt ');
  bytes
    ..setUint32(16, 16, Endian.little)
    ..setUint16(20, 1, Endian.little)
    ..setUint16(22, 1, Endian.little)
    ..setUint32(24, rate, Endian.little)
    ..setUint32(28, rate * 2, Endian.little)
    ..setUint16(32, 2, Endian.little)
    ..setUint16(34, 16, Endian.little);
  label(36, 'data');
  bytes.setUint32(40, count * 2, Endian.little);
  for (var i = 0; i < count; i++) {
    final sample =
        signal[i] +
        .14 * signal[(i - 4013) % count] +
        .075 * signal[(i - 8299) % count];
    bytes.setInt16(
      44 + i * 2,
      (sample.clamp(-1.0, 1.0) * 32767).round(),
      Endian.little,
    );
  }
  return bytes.buffer.asUint8List();
}
