import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

const _storage = FlutterSecureStorage();
final _changes = <String, Future<void>>{};

String _key(String owner) => 'jovian.destiny.birth-profile.v1.$owner';

Future<void> _change(String owner, Future<void> Function() action) async {
  final previous = _changes[owner];
  final pending = previous == null
      ? action()
      : previous.then((_) => action(), onError: (Object _) => action());
  _changes[owner] = pending;
  try {
    await pending;
  } finally {
    if (identical(_changes[owner], pending)) _changes.remove(owner);
  }
}

Future<void> clearLocalDestinyBirthProfile(String owner) => kIsWeb
    ? Future.value()
    : _change(owner, () => _storage.delete(key: _key(owner)));

Future<void> saveLocalDestinyBirthProfile(
  String owner,
  BirthProfile profile,
  bool Function() isCurrent,
) async {
  if (kIsWeb) return;
  final date = profile.date;
  final time = profile.time;
  await _change(owner, () async {
    if (!isCurrent()) return;
    await _storage.write(
      key: _key(owner),
      value: jsonEncode({
        'year': date.year,
        'month': date.month,
        'day': date.day,
        'hour': time.hour,
        'minute': time.minute,
        'placeId': profile.place.id,
        'gender': profile.gender.name,
      }),
    );
  });
}

Future<BirthProfile?> readLocalDestinyBirthProfile(
  String owner,
  Future<List<BirthPlace>> Function() loadPlaces,
) async {
  if (kIsWeb) return null;
  final raw = await _storage.read(key: _key(owner));
  if (raw == null) return null;
  final Object? values;
  try {
    values = jsonDecode(raw);
  } on FormatException {
    return null;
  }
  if (values case {
    'year': final int year,
    'month': final int month,
    'day': final int day,
    'hour': final int? hour,
    'minute': final int? minute,
    'placeId': final String placeId,
    'gender': final String genderName,
  }) {
    final date = BirthDate(year, month, day);
    final time = BirthTime(hour: hour, minute: minute);
    final gender = BirthGender.values
        .where((v) => v.name == genderName)
        .firstOrNull;
    if (!date.isValid() || !time.isValid || gender == null) return null;
    final place = (await loadPlaces())
        .where((v) => v.id == placeId)
        .firstOrNull;
    if (place != null) {
      return BirthProfile(date: date, time: time, place: place, gender: gender);
    }
  }
  return null;
}
