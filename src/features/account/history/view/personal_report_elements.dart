part of 'personal_report_page.dart';

const _elementTones = {
  '金': Color(0xffdfce52),
  '木': Color(0xff47bd77),
  '水': Color(0xff6483e4),
  '火': Color(0xffd9475a),
  '土': Color(0xffd48b45),
};

class _ElementScale extends StatelessWidget {
  const _ElementScale({required this.elements});

  final List<ReportElement> elements;

  @override
  Widget build(BuildContext context) {
    if (elements.isEmpty)
      return const UiText('未提供', style: TextStyle(fontSize: 11));
    return Semantics(
      label: [
        for (final element in elements)
          '${context.uiLabel(element.name)} ${_percent(element.share)}',
      ].join(' · '),
      excludeSemantics: true,
      child: Row(
        spacing: 4,
        children: [
          for (final element in elements)
            if (element.share > 0)
              Expanded(
                flex: math.max(1, (element.share * 100).round()),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: _elementTones[element.name],
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: const SizedBox(height: 4),
                ),
              ),
        ],
      ),
    );
  }
}

class _ElementDetail extends StatelessWidget {
  const _ElementDetail({required this.data});

  final PersonalReportData data;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const _ReportDetailHeading('五行比例', '金、木、水、火、土在这份命盘里的相对占比。'),
      if (data.elements.isEmpty)
        const _ReportGlass(child: UiText('这份命盘的五行资料不足。'))
      else
        _ReportGlass(
          padding: const EdgeInsets.fromLTRB(14, 20, 14, 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final entry in data.elements)
                Expanded(
                  child: Column(
                    spacing: 8,
                    children: [
                      Text(
                        _percent(entry.share),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      SizedBox(
                        width: 13,
                        height: 112,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: FractionallySizedBox(
                            heightFactor: (entry.share / 100).clamp(0, 1),
                            alignment: Alignment.bottomCenter,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: _elementTones[entry.name],
                                borderRadius: BorderRadius.circular(7),
                              ),
                            ),
                          ),
                        ),
                      ),
                      UiText(
                        entry.name,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
    ],
  );
}
