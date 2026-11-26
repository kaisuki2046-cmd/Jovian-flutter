import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';

String? memberReadingKeySuffix(String key, String prefix, String owner) {
  if (!key.startsWith(prefix)) return null;
  final member = '.member:$owner';
  if (key.endsWith(member)) return '';
  final marker = '$member.';
  final index = key.lastIndexOf(marker);
  if (index < prefix.length) return null;
  return key.substring(index + marker.length);
}

GuideHistoryEntry? decodeGuideHistory(String? text) {
  if (text == null) return null;
  try {
    if (jsonDecode(text)
        case {
              'id': final String id,
              'updatedAt': final int updated,
              'reading': final Map<String, Object?> reading,
            } &&
            final Map value when isGuideThreadId(id)) {
      final saved = OnlineReading.fromJson(reading);
      return GuideHistoryEntry(
        id: id,
        updatedAt: DateTime.fromMillisecondsSinceEpoch(updated),
        reading: saved,
        revealedTarotSlots: _readRevealedSlots(
          saved.snapshot,
          value['revealedTarotSlots'],
        ),
      );
    }
  } on FormatException {
    return null;
  } on TypeError {
    return null;
  } on RangeError {
    return null;
  }
  return null;
}

String encodeGuideHistory(GuideHistoryEntry entry) => jsonEncode({
  'id': entry.id,
  'updatedAt': entry.updatedAt.millisecondsSinceEpoch,
  'reading': entry.reading.toJson(),
  if (entry.revealedTarotSlots case final slots?)
    'revealedTarotSlots': slots.toList(),
});

Set<int>? _readRevealedSlots(GuideRitualSnapshot snapshot, Object? value) {
  if (snapshot.chart == null ||
      snapshot.automatic ||
      value is! List ||
      value.length > snapshot.selectedSlots.length ||
      value.any(
        (slot) => slot is! int || !snapshot.selectedSlots.contains(slot),
      ))
    return null;
  return Set<int>.unmodifiable(value.cast<int>());
}

GuideRecovery? decodeGuideRecovery(String? text) {
  if (text == null) return null;
  try {
    if (jsonDecode(text) case final Map<String, Object?> value) {
      return GuideRecovery.fromJson(value);
    }
  } on FormatException {
    return null;
  }
  return null;
}
