part of 'personal_report_page.dart';

class _ReportPeriods extends StatefulWidget {
  const _ReportPeriods({
    required this.data,
    required this.topic,
    this.preview = false,
  });

  final PersonalReportData data;
  final _ReportTopic topic;
  final bool preview;

  @override
  State<_ReportPeriods> createState() => _ReportPeriodsState();
}

class _ReportPeriodsState extends State<_ReportPeriods> {
  int? _selected;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final topic = widget.topic;
    final readings = _periodReadings(data);
    if (readings.isEmpty) {
      return const _InsightText((
        '有确认过出生时刻的大运资料后，可以查看各阶段的侧重和变化。',
        'Verified birth time and luck-cycle data make it possible to compare life phases.',
      ));
    }
    final colors = Theme.of(context).colorScheme;
    final current = data.currentPeriod;
    final selected = (_selected ?? current ?? 0).clamp(0, readings.length - 1);
    final detail = readings[selected];
    final isOverview = topic == _ReportTopic.overview;
    final count = math.min(readings.length, 6);
    final first = (selected - 2).clamp(0, readings.length - count);
    final window = readings.skip(first).take(count).toList();
    final peak = _strongestPeriod(readings, topic);
    final labels = [for (final item in window) _ageRange(item.period)];
    final focus = _phaseFocus(topic, detail.theme);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        if (isOverview)
          _LifeStageRail(
            ranges: labels,
            current: selected - first,
            tone: topic.tone,
          )
        else
          _ReportTrend(
            values: [for (final item in window) item.weightFor(topic)],
            labels: labels,
            selected: selected - first,
            tone: topic.tone,
          ),
        if (current != null && current < readings.length)
          Text(
            _reportWords(context, (
              '${data.example ? '示例当前' : '当前'} · ${_ageRange(readings[current].period)} 岁',
              '${data.example ? 'Example current phase' : 'Current phase'} · ages ${_ageRange(readings[current].period)}',
            )),
            style: TextStyle(
              fontSize: 11.5,
              color: _readableTone(colors, topic.tone),
              fontWeight: FontWeight.w600,
            ),
          ),
        if (widget.preview && isOverview && current != null && focus != null)
          _InsightText(focus, small: true, maxLines: 2),
        if (widget.preview && !isOverview && peak != null)
          _InsightText((
            '${_periodPeakLabel(topic).$1} · ${_ageRange(peak.period)} 岁',
            '${_periodPeakLabel(topic).$2} · ages ${_ageRange(peak.period)}',
          ), small: true),
        if (!widget.preview) ...[
          Wrap(
            spacing: 5,
            runSpacing: 4,
            children: [
              for (final (index, item) in readings.indexed)
                ChoiceChip(
                  label: Text(_ageRange(item.period)),
                  selected: selected == index,
                  onSelected: (_) => setState(() => _selected = index),
                  showCheckmark: false,
                  labelStyle: const TextStyle(fontSize: 11),
                  visualDensity: VisualDensity.compact,
                  selectedColor: topic.tone.withValues(alpha: .20),
                  side: BorderSide(color: topic.tone.withValues(alpha: .22)),
                ),
            ],
          ),
          Text(
            '${_phaseLabel(context, detail.period)} · ${detail.period.pillar}',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          if (focus != null)
            _InsightEntries([
              ('这一阶段的侧重', focus),
              ('这段时间留意什么', _phaseWatch(topic, detail.theme!)),
            ]),
          if (!isOverview && peak != null)
            _PeriodTurns(readings: readings, topic: topic, peak: peak),
          _AnnualTimeline(
            key: ValueKey(detail.period),
            data: data,
            stage: detail,
            topic: topic,
          ),
        ],
      ],
    );
  }
}

String _ageRange(ReportLuckPeriod stage) => '${stage.startAge}–${stage.endAge}';

String _phaseLabel(BuildContext context, ReportLuckPeriod stage) {
  final start = stage.start;
  final end = stage.end;
  final ages = _reportWords(context, (
    '${_ageRange(stage)} 岁',
    'Ages ${_ageRange(stage)}',
  ));
  return start == null || end == null
      ? ages
      : '$ages · ${_reportYear(start)}–${_reportYear(end)}';
}

_PeriodReading? _strongestPeriod(
  List<_PeriodReading> readings,
  _ReportTopic topic,
) => readings.isEmpty
    ? null
    : readings.reduce(
        (left, right) =>
            left.weightFor(topic) >= right.weightFor(topic) ? left : right,
      );

_ReportWords _periodPeakLabel(_ReportTopic topic) => switch (topic) {
  _ReportTopic.love => ('关系议题较集中', 'Stronger relationship emphasis'),
  _ReportTopic.work => ('事业发力窗口', 'Career growth window'),
  _ReportTopic.wealth => ('积累机会较集中', 'Stronger window for building resources'),
  _ReportTopic.study => ('学习投入较集中的阶段', 'Stronger learning phase'),
  _ReportTopic.overview => ('阶段侧重', 'Phase emphasis'),
};

_ReportWords? _phaseFocus(_ReportTopic topic, ReportGodGroup? group) {
  if (group == null) return null;
  return switch (topic) {
    _ReportTopic.overview => _periodThemes[group]!,
    _ReportTopic.love => _loveLenses[group]!.give,
    _ReportTopic.work => _workLenses[group]!.wants,
    _ReportTopic.wealth => _wealthLenses[group]!.earning,
    _ReportTopic.study => _studyPersonalities[group]!.mode,
  };
}

_ReportWords _phaseWatch(_ReportTopic topic, ReportGodGroup group) =>
    switch (topic) {
      _ReportTopic.overview => _profileLenses[group]!.friction,
      _ReportTopic.love => _loveLenses[group]!.tension,
      _ReportTopic.work => _workLenses[group]!.block,
      _ReportTopic.wealth => _wealthLenses[group]!.guard,
      _ReportTopic.study => _studyPersonalities[group]!.challenge,
    };

class _PeriodTurns extends StatelessWidget {
  const _PeriodTurns({
    required this.readings,
    required this.topic,
    required this.peak,
  });

  final List<_PeriodReading> readings;
  final _ReportTopic topic;
  final _PeriodReading peak;

  @override
  Widget build(BuildContext context) {
    final quiet = readings.reduce(
      (left, right) =>
          left.weightFor(topic) <= right.weightFor(topic) ? left : right,
    );
    var transition = 0;
    var change = 0.0;
    for (var i = 1; i < readings.length; i++) {
      final delta =
          (readings[i].weightFor(topic) - readings[i - 1].weightFor(topic))
              .abs();
      if (delta > change) {
        transition = i;
        change = delta;
      }
    }
    final from = _phaseLabel(context, peak.period);
    final quietLabel = _phaseLabel(context, quiet.period);
    final next = _phaseLabel(context, readings[transition].period);
    final contextHint = switch (topic) {
      _ReportTopic.love => (
        '适合增加相处机会，认真观察来往是否稳定。',
        'Make time to meet people and watch how reliably interest is returned.',
      ),
      _ReportTopic.work => (
        '适合争取可主导的任务，积累能展示的交付成果。',
        'Seek a task you can lead and make the results visible.',
      ),
      _ReportTopic.wealth => (
        '适合盘点手里的技能和渠道，看看哪项可以持续积累。',
        'Review which skills and channels can build value consistently.',
      ),
      _ReportTopic.study => (
        '适合集中学一项基础能力，再用项目检验掌握程度。',
        'Focus on one foundation skill and check it through a project.',
      ),
      _ReportTopic.overview => (
        '给这一阶段的重点留出时间。',
        'Make room for this phase’s priorities.',
      ),
    };
    return _InsightEntries([
      ('机会较集中的阶段', ('$from。 ${contextHint.$1}', '$from. ${contextHint.$2}')),
      if (change > .001)
        (
          '变化明显的阶段',
          (
            '进入 $next 后侧重变化较大。切换节奏时，先给已有安排留出交接时间。',
            'The emphasis changes as you enter $next. Leave room to hand over existing commitments.',
          ),
        ),
      if (quiet.weightFor(topic) < peak.weightFor(topic))
        (
          '适合打基础的阶段',
          (
            '$quietLabel 的侧重较低，适合整理、练习和补齐还缺的条件。',
            '$quietLabel has less emphasis. Use it to practice, reflect and fill gaps.',
          ),
        ),
    ]);
  }
}

class _ReportTrend extends StatelessWidget {
  const _ReportTrend({
    required this.values,
    required this.labels,
    required this.selected,
    required this.tone,
  });

  final List<double> values;
  final List<String> labels;
  final int selected;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Column(
      spacing: 5,
      children: [
        SizedBox(
          height: 78,
          width: double.infinity,
          child: CustomPaint(
            painter: _TrendInk(
              values: [
                for (final value in values)
                  ((value - .55) / .90).clamp(.10, .93),
              ],
              selected: selected,
              tone: tone,
              track: muted.withValues(alpha: .18),
            ),
          ),
        ),
        Row(
          children: [
            for (final label in labels)
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    label,
                    style: TextStyle(fontSize: 9, color: muted),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

int _reportYear(DateTime date) =>
    date.toUtc().add(const Duration(hours: 8)).year;

typedef _AnnualReading = ({
  int year,
  String pillar,
  ReportGodGroup? theme,
  double weight,
});

List<_AnnualReading> _annualReadings(
  PersonalReportData data,
  _PeriodReading stage,
  _ReportTopic topic,
) {
  final day = data.dayPillar;
  final start = stage.period.start;
  if (day == null || (start == null && !data.example)) return const [];
  final year = start == null
      ? 2000 + stage.period.startAge - 8
      : _reportYear(start);
  return List.generate(10, (i) {
    final pillar = baziAnnualPillar(year + i);
    final reading = _PeriodReading(stage.period, _periodGroups(day, pillar));
    return (
      year: year + i,
      pillar: pillar,
      theme: reading.theme,
      weight: stage.weightFor(topic) * .55 + reading.weightFor(topic) * .45,
    );
  });
}

class _AnnualTimeline extends StatefulWidget {
  const _AnnualTimeline({
    super.key,
    required this.data,
    required this.stage,
    required this.topic,
  });

  final PersonalReportData data;
  final _PeriodReading stage;
  final _ReportTopic topic;

  @override
  State<_AnnualTimeline> createState() => _AnnualTimelineState();
}

class _AnnualTimelineState extends State<_AnnualTimeline> {
  int? _chosenYear;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final stage = widget.stage;
    final topic = widget.topic;
    final years = _annualReadings(data, stage, topic);
    if (years.isEmpty) {
      return const _InsightText((
        '有起运年份后，可在这里查看逐年的变化。',
        'A dated start for this cycle makes a year-by-year view available.',
      ), small: true);
    }
    final now = _chosenYear ?? _reportYear(DateTime.now());
    final selected = (now - years.first.year).clamp(0, years.length - 1);
    final entry = years[selected];
    final isStudy = topic == _ReportTopic.study;
    final hasChart = topic != _ReportTopic.overview;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        const Divider(height: 1),
        UiText(
          data.example ? '示例流年' : '流年变化',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        if (hasChart)
          _ReportTrend(
            values: [for (final year in years) year.weight],
            labels: [
              for (final (offset, year) in years.indexed)
                isStudy ? '${stage.period.startAge + offset}' : '${year.year}',
            ],
            selected: selected,
            tone: topic.tone,
          ),
        Wrap(
          spacing: 5,
          runSpacing: 4,
          children: [
            for (final year in years)
              ChoiceChip(
                label: Text('${year.year}'),
                labelStyle: const TextStyle(fontSize: 11),
                selected: entry.year == year.year,
                showCheckmark: false,
                selectedColor: topic.tone.withValues(alpha: .20),
                side: BorderSide(color: topic.tone.withValues(alpha: .22)),
                onSelected: (_) => setState(() => _chosenYear = year.year),
                visualDensity: VisualDensity.compact,
              ),
          ],
        ),
        if (_phaseFocus(topic, entry.theme) case final focus?)
          _InsightEntries([
            ('${entry.year} · ${entry.pillar}', focus),
            ('这段时间留意什么', _phaseWatch(topic, entry.theme!)),
          ]),
        if (hasChart)
          const _InsightText((
            '曲线体现大运和流年在这个主题的相对侧重，年份按立春干支对照。',
            'The curve compares how much this theme stands out within the decade and solar-year cycles.',
          ), small: true),
      ],
    );
  }
}
