import 'package:jovian_fortune/jovian_fortune.dart';

import '../../../shared/local_compute/local_compute.dart';
import '../../account/account.dart';

typedef LocalFortunePreview = ({FortunePreview preview, AlmanacDay? almanac});

class FortuneLocal {
  const FortuneLocal({this.compute = const LocalCompute()});

  final LocalCompute compute;

  Future<LocalFortunePreview> preview(
    int asOf,
    FortunePeriod period,
    String zone,
    ArchivedDestinyCharts? archive,
    Future<void> cancel,
  ) async {
    final natal = archive?.natalDays;
    final output = await compute.previewFortune(
      asOf,
      period.name,
      zone,
      // Only the day rows and candidate day pillars are needed for preview.
      archive: archive == null
          ? null
          : {
              'timeKnown': archive.timeKnown,
              'charts': [
                {
                  'method': 'bazi',
                  'rows': [
                    for (final row
                        in archive.charts[ArchivedChartMethod.bazi]!.rows)
                      if (row.label == '日柱')
                        {'label': row.label, 'value': row.value},
                  ],
                },
              ],
              if (natal != null)
                'chartSnapshot': {
                  'timeKnown': natal.timeKnown,
                  'bazi': {
                    'rawResult': [
                      for (final candidate in natal.candidates)
                        if (candidate != null) {'day': candidate} else null,
                    ],
                  },
                },
            },
      cancel: cancel,
    );
    final data = output['preview'] as Map<String, Object?>;
    final window = data['window'] as Map<String, Object?>;
    final almanac = output['almanac'] as Map<String, Object?>?;
    return (
      preview: FortunePreview(
        DisplayWindow(window['start'] as int, window['end'] as int),
        _event(data['current'] as Map<String, Object?>),
        (data['events'] as List)
            .cast<Map<String, Object?>>()
            .map(_event)
            .toList(),
      ),
      almanac: almanac == null
          ? null
          : AlmanacDay(
              date: almanac['date'] as String,
              lunarDate: almanac['lunarDate'] as String,
              dayPillar: almanac['dayPillar'] as String,
              solarTerm: almanac['solarTerm'] as String?,
              officer: almanac['officer'] as String,
              yi: (almanac['yi'] as List).cast<String>(),
              ji: (almanac['ji'] as List).cast<String>(),
            ),
    );
  }

  Future<FortuneCalendar?> queryCalendar(
    FortuneReference reference,
    Future<void> cancel,
  ) async {
    final output = await compute.queryFortuneCalendar(
      reference.toJson(),
      cancel: cancel,
    );
    final calendar = output['calendar'] as Map<String, Object?>?;
    if (calendar == null) return null;
    return FortuneCalendar(
      (calendar['referencePillars'] as Map).cast<String, String>(),
      (calendar['actionPillars'] as Map).cast<String, String>(),
      [
        for (final value in (calendar['windows'] as List))
          FortuneWindow(
            value['period'] as String,
            value['periodStart'] as int,
            value['start'] as int,
            value['end'] as int,
          ),
      ],
    );
  }
}

FortuneEvent _event(Map<String, Object?> value) => FortuneEvent(
  at: value['at'] as int,
  reason: value['reason'] as String,
  year: value['year'] as String,
  month: value['month'] as String,
  day: value['day'] as String,
  tenGod: value['tenGod'] as String?,
);
