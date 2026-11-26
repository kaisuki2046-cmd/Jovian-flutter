enum FortunePeriod {
  day('今日'),
  week('本周'),
  month('本月'),
  year('本年');

  const FortunePeriod(this.label);
  final String label;
}

class FortuneReference {
  const FortuneReference(this.date, this.time);

  final String date;
  final String time;

  Map<String, String> toJson() => {'date': date, 'time': time};
}

class DisplayWindow {
  const DisplayWindow(this.start, this.end);
  final int start;
  final int end;

  Map<String, int> toJson() => {'start': start, 'end': end};
}

class FortuneWindow {
  const FortuneWindow(this.period, this.periodStart, this.start, this.end);
  final String period;
  final int periodStart;
  final int start;
  final int end;

  Map<String, Object?> toJson() => {
    'period': period,
    'periodStart': periodStart,
    'start': start,
    'end': end,
  };
}

class FortuneCalendar {
  const FortuneCalendar(
    this.referencePillars,
    this.actionPillars,
    this.windows,
  );

  final Map<String, String> referencePillars;
  final Map<String, String> actionPillars;
  final List<FortuneWindow> windows;

  Map<String, Object?> toJson() => {
    'referencePillars': referencePillars,
    'actionPillars': actionPillars,
    'windows': windows.map((window) => window.toJson()).toList(),
  };
}

class NatalDay {
  const NatalDay(this.pillar, this.timeKnown);
  final String pillar;
  final bool timeKnown;

  Map<String, Object?> toJson() => {'pillar': pillar, 'timeKnown': timeKnown};
}

class FortuneEvent {
  const FortuneEvent({
    required this.at,
    required this.reason,
    required this.year,
    required this.month,
    required this.day,
    this.tenGod,
  });

  final int at;
  final String reason;
  final String year;
  final String month;
  final String day;
  final String? tenGod;

  Map<String, Object?> toJson() => {
    'at': at,
    'reason': reason,
    'year': year,
    'month': month,
    'day': day,
    if (tenGod != null) 'tenGod': tenGod,
  };
}

class FortunePreview {
  const FortunePreview(this.window, this.current, this.events);
  final DisplayWindow window;
  final FortuneEvent current;
  final List<FortuneEvent> events;

  Map<String, Object?> toJson() => {
    'window': window.toJson(),
    'current': current.toJson(),
    'events': events.map((event) => event.toJson()).toList(),
  };
}

class AlmanacDay {
  const AlmanacDay({
    required this.date,
    required this.lunarDate,
    required this.dayPillar,
    required this.solarTerm,
    required this.officer,
    required this.yi,
    required this.ji,
  });

  final String date;
  final String lunarDate;
  final String dayPillar;
  final String? solarTerm;
  final String officer;
  final List<String> yi;
  final List<String> ji;
  bool get complete => yi.isNotEmpty && ji.isNotEmpty;

  Map<String, Object?> toJson() => {
    'date': date,
    'timeZone': 'Asia/Shanghai',
    'lunarDate': lunarDate,
    'dayPillar': dayPillar,
    'solarTerm': solarTerm,
    'officer': officer,
    'yi': yi,
    'ji': ji,
    'source': 'lunar@1.7.9',
    'ruleset': 'fortune-almanac-beijing-noon-v1',
    'completeness': complete ? 'complete' : 'partial',
  };
}
