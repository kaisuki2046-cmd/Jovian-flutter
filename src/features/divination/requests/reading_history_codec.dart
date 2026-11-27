import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';

import 'reading_transcript_codec.dart';

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
        followUpAttachmentNames: _readFollowUpAttachments(
          value['followUpAttachments'],
          saved.followUps.length,
        ),
        localAttachments: _readLocalAttachments(
          value['localAttachments'],
          saved.followUps.length,
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
  if (entry.followUpAttachmentNames.isNotEmpty)
    'followUpAttachments': {
      for (final item in entry.followUpAttachmentNames.entries)
        '${item.key}': item.value,
    },
  if (entry.localAttachments.isNotEmpty)
    'localAttachments': [
      for (final note in entry.localAttachments)
        {'id': note.id, 'after': note.after, 'names': note.names},
    ],
});

Map<int, List<String>> _readFollowUpAttachments(Object? raw, int followUps) {
  if (raw is! Map<String, Object?>) return const {};
  final namesByStep = <int, List<String>>{};
  for (final item in raw.entries) {
    final step = int.tryParse(item.key);
    if (step == null || step < 0 || step >= followUps) continue;
    final names = decodeGuideAttachmentNames(item.value);
    if (names.isNotEmpty) namesByStep[step] = names;
  }
  return Map.unmodifiable(namesByStep);
}

List<GuideReadingAttachment> _readLocalAttachments(Object? raw, int followUps) {
  if (raw is! List) return const [];
  final notes = <GuideReadingAttachment>[];
  for (final item in raw) {
    if (item case {
      'id': final String id,
      'after': final int after,
      'names': final rawNames,
    } when isGuideThreadId(id) && after >= 0 && after <= followUps) {
      final names = decodeGuideAttachmentNames(rawNames);
      if (names.isNotEmpty) notes.add((id: id, after: after, names: names));
    }
  }
  return List.unmodifiable(notes);
}

Set<int>? _readRevealedSlots(GuideRitualSnapshot snapshot, Object? value) {
  if (snapshot.tarotDraw == null ||
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
