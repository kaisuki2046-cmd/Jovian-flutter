import 'package:jovian_destiny/jovian_destiny.dart';

enum ReportGodGroup { peers, expression, wealth, responsibility, learning }

enum ReportGod {
  peer('比肩', 'Peer', ReportGodGroup.peers),
  rival('劫财', 'Rob Wealth', ReportGodGroup.peers),
  artist('食神', 'Eating God', ReportGodGroup.expression),
  challenger('伤官', 'Hurting Officer', ReportGodGroup.expression),
  opportunity('偏财', 'Indirect Wealth', ReportGodGroup.wealth),
  steward('正财', 'Direct Wealth', ReportGodGroup.wealth),
  protector('七杀', 'Seven Killings', ReportGodGroup.responsibility),
  officer('正官', 'Direct Officer', ReportGodGroup.responsibility),
  explorer('偏印', 'Indirect Resource', ReportGodGroup.learning),
  mentor('正印', 'Direct Resource', ReportGodGroup.learning);

  const ReportGod(this.label, this.english, this.group);

  final String label;
  final String english;
  final ReportGodGroup group;

  static ReportGod? fromLabel(Object? value) =>
      values.where((god) => god.label == value).firstOrNull;
}

typedef ReportGodShare = ({ReportGod god, double share});
typedef ReportElement = ({String name, double share});

class ReportShenSha {
  const ReportShenSha(this.name, this.pillars);

  final String name;
  final List<Pillar> pillars;
}

class ReportLuckPeriod {
  const ReportLuckPeriod(
    this.pillar,
    this.startAge,
    this.endAge, {
    this.start,
    this.end,
  });

  final String pillar;
  final int startAge;
  final int endAge;
  final DateTime? start;
  final DateTime? end;

  bool contains(DateTime time) =>
      start != null &&
      end != null &&
      !time.isBefore(start!) &&
      time.isBefore(end!);
}

enum PersonalReportOrigin { example, archive, birthProfile }

class PersonalReportData {
  const PersonalReportData({
    required this.origin,
    required this.dayPillar,
    required this.gods,
    required this.weighted,
    required this.shenSha,
    required this.elements,
    required this.zodiacSigns,
    required this.periods,
    this.partial = false,
    this.overview,
  });

  final PersonalReportOrigin origin;
  final String? dayPillar;
  final List<ReportGodShare> gods;
  final bool weighted;
  final List<ReportShenSha> shenSha;
  final List<ReportElement> elements;
  final Map<String, String> zodiacSigns;
  final List<ReportLuckPeriod> periods;
  final bool partial;
  final String? overview;

  bool get example => origin == PersonalReportOrigin.example;

  String? get dayMaster {
    final pillar = dayPillar;
    if (pillar == null) return null;
    final stem = pillar[0];
    return '$stem${_stemElement(stem)!}';
  }

  double groupShare(ReportGodGroup group) => gods.fold(
    0,
    (total, entry) => total + (entry.god.group == group ? entry.share : 0),
  );

  int? get currentPeriod {
    if (example) return 2;
    final now = DateTime.now();
    final index = periods.indexWhere((period) => period.contains(now));
    return index < 0 ? null : index;
  }

  static const sample = PersonalReportData(
    origin: PersonalReportOrigin.example,
    dayPillar: '己未',
    weighted: false,
    gods: [
      (god: ReportGod.peer, share: 40),
      (god: ReportGod.artist, share: 24),
      (god: ReportGod.rival, share: 12),
    ],
    shenSha: [
      ReportShenSha('文昌贵人', [Pillar.month]),
      ReportShenSha('天乙贵人', [Pillar.day, Pillar.hour]),
      ReportShenSha('桃花', [Pillar.year, Pillar.hour]),
      ReportShenSha('驿马', [Pillar.year]),
      ReportShenSha('华盖', [Pillar.day]),
    ],
    elements: [
      (name: '金', share: 11),
      (name: '木', share: 5),
      (name: '水', share: 4),
      (name: '火', share: 31),
      (name: '土', share: 49),
    ],
    zodiacSigns: {
      'Sun': '白羊',
      'Ascendant': '狮子',
      'Moon': '处女',
      'Venus': '双鱼',
      'Mars': '双子',
      'Mercury': '双鱼',
      'NorthNode': '白羊',
      'Juno': '巨蟹',
      'Midheaven': '金牛',
    },
    periods: [
      ReportLuckPeriod('辛未', 8, 17),
      ReportLuckPeriod('壬申', 18, 27),
      ReportLuckPeriod('癸酉', 28, 37),
      ReportLuckPeriod('甲戌', 38, 47),
      ReportLuckPeriod('乙亥', 48, 57),
      ReportLuckPeriod('丙子', 58, 67),
    ],
  );

  static PersonalReportData? fromSnapshot(
    Object? snapshot, {
    required PersonalReportOrigin origin,
    String? overview,
  }) {
    if (_field(snapshot, 'version') != 1) return null;
    final bazi = _rows(_field(_field(snapshot, 'bazi'), 'rawResult'));
    if (bazi.isEmpty) return null;
    final exact = _field(snapshot, 'timeKnown') == true && bazi.length == 1;
    final raw = bazi.first;
    final evaluations = exact
        ? _field(_field(_field(raw, 'analysis'), 'L2'), 'assessments')
        : null;
    final weights = <ReportGod, double>{
      for (final row in _rows(
        _field(_field(evaluations, 'tenGodStrength'), 'scores'),
      ))
        if ((
              ReportGod.fromLabel(_field(row, 'name')),
              _points(_field(row, 'score')),
            )
            case (final god?, final score?) when score > 0)
          god: score,
    };
    final weighted = weights.isNotEmpty;
    final godScores = weighted ? weights : _commonGodCounts(bazi);
    final total = godScores.values.fold(0.0, (a, b) => a + b);
    final shares =
        [
          for (final MapEntry(:key, :value) in godScores.entries)
            (god: key, share: value * 100 / total),
        ]..sort((a, b) {
          final rank = b.share.compareTo(a.share);
          return rank == 0 ? a.god.index.compareTo(b.god.index) : rank;
        });
    final day = _same(bazi.map((row) => _field(row, 'day')));
    return PersonalReportData(
      origin: origin,
      dayPillar: day is String && isBaZiPillar(day) ? day : null,
      gods: shares,
      weighted: weighted,
      shenSha: _collectShenSha(bazi),
      elements: _elementShares(bazi, evaluations),
      zodiacSigns: _readZodiac(snapshot, exact),
      periods: exact ? _periods(raw) : const [],
      partial: !exact,
      overview: overview,
    );
  }
}

Object? _field(Object? value, String key) => value is Map ? value[key] : null;

List<Object?> _rows(Object? value) => value is List ? value : const [];

double? _points(Object? value) =>
    value is num && value.isFinite && value >= 0 ? value.toDouble() : null;

T? _same<T>(Iterable<T> values) {
  final first = values.firstOrNull;
  return values.every((value) => value == first) ? first : null;
}

Set<T> _shared<T>(Iterable<Set<T>> groups) =>
    groups.reduce((a, b) => a.intersection(b));

Map<ReportGod, double> _commonGodCounts(List<Object?> rows) {
  final counts = <ReportGod, double>{};
  for (final position in Pillar.values) {
    final entries = rows.map(
      (row) => _field(_field(row, 'tenGods'), position.name),
    );
    final exposed = _same(
      entries.map(
        (entry) => ReportGod.fromLabel(_field(entry, 'heavenlyStem')),
      ),
    );
    if (position != Pillar.day && exposed != null) {
      counts.update(exposed, (count) => count + 1, ifAbsent: () => 1);
    }
    final hidden = _shared(
      entries.map(
        (entry) => {
          for (final row in _rows(_field(entry, 'hiddenStems')))
            if ((
                  _field(row, 'stem'),
                  ReportGod.fromLabel(_field(row, 'tenGod')),
                )
                case (final String stem, final god?))
              (stem, god),
        },
      ),
    );
    for (final (_, god) in hidden) {
      counts.update(god, (count) => count + 1, ifAbsent: () => 1);
    }
  }
  return counts;
}

List<ReportShenSha> _collectShenSha(List<Object?> rows) {
  final matches = <String, List<Pillar>>{};
  for (final position in Pillar.values) {
    final names = _shared(
      rows.map(
        (row) => {
          for (final hit in _rows(
            _field(_field(row, 'shenSha'), position.name),
          ))
            if (_field(hit, 'name') case final String name
                when name.trim().isNotEmpty)
              name,
        },
      ),
    );
    for (final name in names) {
      (matches[name] ??= []).add(position);
    }
  }
  return [
    for (final MapEntry(:key, :value) in matches.entries)
      ReportShenSha(key, value),
  ];
}

const _elementNames = ['金', '木', '水', '火', '土'];

String? _stemElement(String stem) {
  final i = '甲乙丙丁戊己庚辛壬癸'.indexOf(stem);
  return stem.length == 1 && i >= 0 ? '木火土金水'[i ~/ 2] : null;
}

List<ReportElement> _elementShares(List<Object?> rows, Object? evaluations) {
  final counts = <String, double>{
    for (final row in _rows(
      _field(_field(evaluations, 'fiveElementStrength'), 'elements'),
    ))
      if ((_field(row, 'element'), _points(_field(row, 'score'))) case (
        final String name,
        final score?,
      ) when _elementNames.contains(name))
        name: score,
  };
  if (!counts.values.any((value) => value > 0)) {
    const branches = '子丑寅卯辰巳午未申酉戌亥';
    for (final position in Pillar.values) {
      final pillars = rows.map((row) => _field(row, position.name));
      if (!pillars.every((item) => item is String && isBaZiPillar(item)))
        continue;
      final names = pillars.cast<String>();
      final stem = _same(names.map((name) => name[0]));
      final branch = _same(names.map((name) => name[1]));
      for (final element in [
        if (stem != null) _stemElement(stem)!,
        if (branch != null) '水土木木土火火土金金土水'[branches.indexOf(branch)],
      ]) {
        counts.update(element, (count) => count + 1, ifAbsent: () => 1);
      }
    }
  }
  final total = counts.values.fold(0.0, (a, b) => a + b);
  return [
    if (total > 0)
      for (final name in _elementNames)
        (name: name, share: (counts[name] ?? 0) * 100 / total),
  ];
}

String? _sign(Object? longitude) => longitude is num && longitude.isFinite
    ? const [
        '白羊',
        '金牛',
        '双子',
        '巨蟹',
        '狮子',
        '处女',
        '天秤',
        '天蝎',
        '射手',
        '摩羯',
        '水瓶',
        '双鱼',
      ][(longitude % 360) ~/ 30]
    : null;

Map<String, String> _readZodiac(Object? snapshot, bool exact) {
  final rows = _rows(_field(_field(snapshot, 'western'), 'rawResult'));
  return {
    for (final planet in [
      'Sun',
      'Moon',
      'Venus',
      'Mars',
      'Mercury',
      'NorthNode',
      'Juno',
    ])
      if (_same(
            rows.map((row) {
              final bodies = _rows(_field(row, 'positions'));
              final body = bodies
                  .where((item) => _field(item, 'planet') == planet)
                  .firstOrNull;
              return _sign(_field(body, 'longitude'));
            }),
          )
          case final name?)
        planet: name,
    if (exact && rows.length == 1) ...{
      if (_sign(_field(rows.single, 'ascendant')) case final name?)
        'Ascendant': name,
      if (_sign(_field(rows.single, 'midheaven')) case final name?)
        'Midheaven': name,
    },
  };
}

List<ReportLuckPeriod> _periods(Object? raw) {
  final dated = _rows(_field(_field(raw, 'luckContext'), 'periods'));
  return [
    for (final period
        in dated.isNotEmpty ? dated : _rows(_field(raw, 'luckPeriods')))
      if (period case {
        'ganZhi': final String pillar,
        'startAge': final int start,
        'endAge': final int end,
      } when isBaZiPillar(pillar) && start >= 0 && end == start + 9)
        ReportLuckPeriod(
          pillar,
          start,
          end,
          start: DateTime.tryParse(_field(period, 'start')?.toString() ?? ''),
          end: DateTime.tryParse(
            _field(period, 'endExclusive')?.toString() ?? '',
          ),
        ),
  ];
}
