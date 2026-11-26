import 'package:jovian_destiny/jovian_destiny.dart';

import '../../account/account.dart';

class BirthProfileDraft {
  const BirthProfileDraft({this.date, this.time, this.place, this.gender});

  final BirthDate? date;
  final BirthTime? time;
  final BirthPlace? place;
  final BirthGender? gender;

  factory BirthProfileDraft.fromProfile(BirthProfile profile) =>
      BirthProfileDraft(
        date: profile.date,
        time: profile.time,
        place: profile.place,
        gender: profile.gender,
      );

  factory BirthProfileDraft.fromAccount(
    AccountBirthFields fields,
    List<BirthPlace> places,
  ) {
    final instant = DateTime.tryParse('${fields.birthDate}T00:00:00Z');
    final date = instant == null
        ? null
        : BirthDate(instant.year, instant.month, instant.day);
    final time = RegExp(
      r'^([01]\d|2[0-3]|\?\?):([0-5]\d|\?\?)$',
    ).firstMatch(fields.birthTime);
    return BirthProfileDraft(
      date:
          date != null &&
              date.isValid() &&
              birthDateText(date) == fields.birthDate
          ? date
          : null,
      time: time == null
          ? null
          : BirthTime(
              hour: int.tryParse(time[1]!),
              minute: int.tryParse(time[2]!),
            ),
      place: _findPlace(fields.birthPlace, places),
      gender: switch (fields.gender) {
        'female' => BirthGender.female,
        'male' => BirthGender.male,
        _ => null,
      },
    );
  }

  BirthProfile? get completeProfile {
    if ((date, time, place, gender) case (
      final date?,
      final time?,
      final place?,
      final gender?,
    ) when time.timeKnown) {
      return BirthProfile(date: date, time: time, place: place, gender: gender);
    }
    return null;
  }
}

String birthDateText(BirthDate date) =>
    date.utcMidnight.toIso8601String().substring(0, 10);

AccountBirthFields accountFieldsFor(BirthProfile profile) {
  final time = profile.time;
  String part(int? value) => value?.toString().padLeft(2, '0') ?? '??';
  return AccountBirthFields(
    birthDate: birthDateText(profile.date),
    birthTime: time.hour == null && time.minute == null
        ? ''
        : '${part(time.hour)}:${part(time.minute)}',
    birthPlace: profile.place.name,
    gender: profile.gender.name,
  );
}

BirthPlace? _findPlace(String value, List<BirthPlace> places) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  final exact = places.where((place) => place.name == trimmed).take(2).toList();
  if (exact.isNotEmpty) return exact.length == 1 ? exact.first : null;

  final separators = RegExp(r'[\s·・/／,，]+');
  String compact(String text) => text.replaceAll(separators, '');
  final input = compact(trimmed);
  if (input.isEmpty) return null;
  final matches = places
      .where((place) {
        final fullPath = [
          place.region,
          if (!place.region.startsWith(place.city) &&
              !place.city.endsWith('行政区划'))
            place.city,
          ?place.district,
        ];
        final candidates = [
          place.name,
          fullPath.join(),
          '${place.country}${fullPath.join()}',
        ];
        if (place.district case final district?) {
          candidates.addAll([
            '${place.region}$district',
            '${place.country}${place.region}$district',
          ]);
        }
        return candidates.any((candidate) => compact(candidate) == input);
      })
      .take(2)
      .toList();
  return matches.length == 1 ? matches.first : null;
}
