import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';

GuideHistoryEntry? decodeGuideHistory(String? text) {
  if (text == null) return null;
  try {
    if (jsonDecode(text) case {
      'id': final String id,
      'updatedAt': final int updated,
      'reading': final Map<String, Object?> reading,
    } when isGuideThreadId(id)) {
      return (
        id: id,
        updatedAt: DateTime.fromMillisecondsSinceEpoch(updated),
        reading: OnlineReading.fromJson(reading),
      );
    }
  } on FormatException {
    return null;
  } on TypeError {
    return null;
  }
  return null;
}

String encodeGuideHistory(GuideHistoryEntry entry) => jsonEncode({
  'id': entry.id,
  'updatedAt': entry.updatedAt.millisecondsSinceEpoch,
  'reading': entry.reading.toJson(),
});

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
