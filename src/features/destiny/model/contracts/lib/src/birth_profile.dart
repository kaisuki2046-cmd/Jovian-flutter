const firstBirthYear = 1900;

enum BirthGender { female, male, other }

class BirthDate {
  const BirthDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  DateTime get utcMidnight => DateTime.utc(year, month, day);

  bool isValid({DateTime? today}) {
    final current = today ?? DateTime.now();
    if (year < firstBirthYear ||
        year > current.year ||
        month < 1 ||
        month > 12 ||
        day < 1) {
      return false;
    }
    final date = utcMidnight;
    if (date.month != month || date.day != day) return false;
    return !date.isAfter(
      DateTime.utc(current.year, current.month, current.day),
    );
  }
}

class BirthTime {
  const BirthTime({this.hour, this.minute});

  final int? hour;
  final int? minute;

  bool get timeKnown => hour != null && minute != null;
  bool get isValid =>
      (hour == null || (hour! >= 0 && hour! < 24)) &&
      (minute == null || (minute! >= 0 && minute! < 60));
}

class BirthPlace {
  const BirthPlace({
    required this.id,
    required this.name,
    required this.countryCode,
    required this.country,
    required this.region,
    required this.city,
    this.district,
    this.adminCode,
    required this.latitude,
    required this.longitude,
    required this.timeZone,
  });

  final String id;
  final String name;
  final String countryCode;
  final String country;
  final String region;
  final String city;
  final String? district;
  final String? adminCode;
  final double latitude;
  final double longitude;
  final String timeZone;

  factory BirthPlace.fromJson(Map<String, Object?> json) => BirthPlace(
    id: json['id'] as String,
    name: json['name'] as String,
    countryCode: json['countryCode'] as String,
    country: json['country'] as String,
    region: json['region'] as String,
    city: json['city'] as String,
    district: json['district'] as String?,
    adminCode: json['adminCode'] as String?,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    timeZone: json['timeZone'] as String,
  );
}

class BirthProfile {
  const BirthProfile({
    required this.date,
    required this.time,
    required this.place,
    required this.gender,
  });

  final BirthDate date;
  final BirthTime time;
  final BirthPlace place;
  final BirthGender gender;

  Map<String, Object?> toJson() => {
    'date': {'year': date.year, 'month': date.month, 'day': date.day},
    'time': {
      'timeKnown': time.timeKnown,
      'hour': time.hour,
      'minute': time.minute,
    },
    'gender': gender.name,
    'place': {
      'id': place.id,
      'name': place.name,
      'countryCode': place.countryCode,
      'country': place.country,
      'region': place.region,
      'city': place.city,
      if (place.district != null) 'district': place.district,
      if (place.adminCode != null) 'adminCode': place.adminCode,
      'latitude': place.latitude,
      'longitude': place.longitude,
      'timeZone': place.timeZone,
    },
  };
}
