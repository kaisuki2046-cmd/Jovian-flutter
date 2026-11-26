import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../model/destiny_reading.dart';

const _chartSymbols = 'JovianChartSymbols';
const _chartSymbolFallback = ['JovianSansSC'];

Future<void> showDestinyCharts(BuildContext context, DestinyCharts charts) =>
    showDialog<void>(context: context, builder: (_) => _ChartDialog(charts));

class _ChartDialog extends StatefulWidget {
  const _ChartDialog(this.charts);

  final DestinyCharts charts;

  @override
  State<_ChartDialog> createState() => _ChartDialogState();
}

class _ChartDialogState extends State<_ChartDialog> {
  var _active = DestinyChartMethod.bazi;

  @override
  Widget build(BuildContext context) {
    final charts = widget.charts;
    final preview = charts.previews[_active];
    final scheme = Theme.of(context).colorScheme;
    return Dialog(
      insetPadding: const EdgeInsets.all(12),
      backgroundColor: scheme.surface,
      child: SizedBox(
        width: 500,
        height: math.min(MediaQuery.sizeOf(context).height - 48, 820),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Title('命盘结果'),
                        Text(charts.presentation == null ? '已保存的基础盘面' : '本次排盘'),
                        if (!charts.timeKnown) const Text('出生时刻未完全确定'),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: '关闭命盘',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Row(
                children: [
                  for (final method in DestinyChartMethod.values)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: ChoiceChip(
                          label: Center(child: Text(method.label)),
                          selected: method == _active,
                          showCheckmark: false,
                          onSelected: (_) => setState(() => _active = method),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                key: ValueKey(_active),
                padding: const EdgeInsets.all(12),
                children: [
                  if (preview?.note case final note?) _Note(note),
                  if (preview != null && preview.rows.isNotEmpty)
                    ...switch (_active) {
                      DestinyChartMethod.bazi => [
                        const _Title('四柱、十神与神煞'),
                        _Pillars(preview.rows),
                        if (charts.presentation?['bazi']
                            case final List analysis)
                          _FactsBox('八字本命结构', analysis.map(chartRow)),
                        if (!charts.timeKnown && charts.presentation != null)
                          const _Note('只展示各有效时刻情景一致的干支、十神和神煞。'),
                      ],
                      DestinyChartMethod.ziwei
                          when charts.presentation?['ziwei'] is Map =>
                        [
                          const _Title('紫微 · 十二宫'),
                          _Fact(preview.rows.first),
                          _ZiweiPanel(charts.presentation!['ziwei'] as Map),
                        ],
                      DestinyChartMethod.western
                          when charts.presentation?['western'] is Map =>
                        [_WesternPanel(charts.presentation!['western'] as Map)],
                      _ => preview.rows.map(_Fact.new),
                    }
                  else if (preview?.note == null)
                    const _Note('这次记录没有保存该盘面的基础数据。'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Title extends StatelessWidget {
  const _Title(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Semantics(
      header: true,
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    ),
  );
}

class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Text(text, style: Theme.of(context).textTheme.bodySmall),
  );
}

class _Fact extends StatelessWidget {
  const _Fact(this.row, {this.symbol});
  final ChartRow row;
  final String? symbol;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text.rich(
            TextSpan(
              children: [
                if (symbol case final glyph?)
                  TextSpan(
                    text: '$glyph ',
                    style: const TextStyle(
                      fontFamily: _chartSymbols,
                      fontFamilyFallback: _chartSymbolFallback,
                    ),
                  ),
                TextSpan(text: row.label),
              ],
            ),
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(flex: 3, child: Text(row.value, textAlign: TextAlign.end)),
      ],
    ),
  );
}

class _FactsBox extends StatelessWidget {
  const _FactsBox(this.title, this.rows);
  final String title;
  final Iterable<ChartRow> rows;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [_Title(title), for (final row in rows) _Fact(row)],
      ),
    ),
  );
}

class _Pillars extends StatelessWidget {
  const _Pillars(this.rows);
  final List<ChartRow> rows;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final row in rows)
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 8,
                      horizontal: 2,
                    ),
                    child: Column(
                      children: [
                        Text(row.label, style: theme.textTheme.labelMedium),
                        if (row.value.split('\n').first case final value
                            when value.length == 2) ...[
                          Text(
                            value[0],
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          Text(value[1], style: theme.textTheme.titleLarge),
                        ] else
                          Text(
                            row.value.split('\n').first,
                            textAlign: TextAlign.center,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
        for (final row in rows)
          if (row.value.contains('\n'))
            _Fact((
              label: row.label,
              value: row.value.split('\n').skip(1).join('\n'),
            )),
      ],
    );
  }
}

class _ZiweiPanel extends StatefulWidget {
  const _ZiweiPanel(this.chart);
  final Map chart;
  @override
  State<_ZiweiPanel> createState() => _ZiweiPanelState();
}

class _ZiweiPanelState extends State<_ZiweiPanel> {
  static const _branches = [
    '巳',
    '午',
    '未',
    '申',
    '辰',
    '',
    '',
    '酉',
    '卯',
    '',
    '',
    '戌',
    '寅',
    '丑',
    '子',
    '亥',
  ];
  String? _selected;
  @override
  Widget build(BuildContext context) {
    final chart = widget.chart;
    final palaces = chart['palaces'];
    final calendar = '${chart['className']} · ${chart['lunarDate']}';
    if (palaces is! List || palaces.isEmpty) {
      return _Note('$calendar\n出生时刻未完全确定，保留 ${chart['scenarioCount']} 种时辰情景。');
    }
    final byBranch = {
      for (final Map palace in palaces) palace['branch']: palace,
    };
    final detail =
        byBranch[_selected] ??
        palaces.cast<Map>().firstWhere(
          (palace) => palace['name'] == '命宫',
          orElse: () => palaces.first as Map,
        );
    final theme = Theme.of(context);
    const cellHeight = 80.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: ColoredBox(
            color: theme.colorScheme.surfaceContainer,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 116,
                  child: Text(
                    calendar,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelMedium,
                  ),
                ),
                Column(
                  children: [
                    for (var start = 0; start < _branches.length; start += 4)
                      Row(
                        children: [
                          for (final branch in _branches.skip(start).take(4))
                            Expanded(
                              child: SizedBox(
                                height: cellHeight,
                                child: switch (byBranch[branch]) {
                                  final palace? => Semantics(
                                    button: true,
                                    selected: palace == detail,
                                    child: Material(
                                      color: palace == detail
                                          ? theme.colorScheme.primaryContainer
                                          : theme
                                                .colorScheme
                                                .surfaceContainerHigh,
                                      child: InkWell(
                                        onTap: () =>
                                            setState(() => _selected = branch),
                                        child: Padding(
                                          padding: const EdgeInsets.all(4),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                palace['name'] as String,
                                                style:
                                                    theme.textTheme.labelMedium,
                                              ),
                                              Text(
                                                palace['body'] == true
                                                    ? '$branch · 身宫'
                                                    : branch,
                                                style:
                                                    theme.textTheme.bodySmall,
                                              ),
                                              Flexible(
                                                child: Text(
                                                  palace['major'] as String,
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style:
                                                      theme.textTheme.bodySmall,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  null => const SizedBox(),
                                },
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        _FactsBox('${detail['name']} · ${detail['stem']}${detail['branch']}', [
          for (final (key, label) in const [
            ('major', '主星'),
            ('minor', '辅星'),
            ('others', '杂曜'),
          ])
            if (detail[key] case final String value when value.isNotEmpty)
              (label: label, value: value),
        ]),
        const _Note('点按宫位切换详情。'),
      ],
    );
  }
}

const _glyphs = {
  'Sun': '☉',
  'Moon': '☽',
  'Mercury': '☿',
  'Venus': '♀',
  'Mars': '♂',
  'Jupiter': '♃',
  'Saturn': '♄',
  'Uranus': '♅',
  'Neptune': '♆',
  'Pluto': '♇',
};

class _WesternPanel extends StatelessWidget {
  const _WesternPanel(this.chart);
  final Map chart;
  @override
  Widget build(BuildContext context) {
    final wheel = chart['wheel'] as Map?;
    final positions = (chart['positions'] as List).cast<Map>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Title('本命星图'),
        const _Note('热带黄道 · 整宫制'),
        if (wheel != null) ...[
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 330),
              child: AspectRatio(
                aspectRatio: 1,
                child: CustomPaint(
                  painter: _WesternWheel(
                    wheel,
                    positions,
                    Theme.of(context).colorScheme,
                  ),
                ),
              ),
            ),
          ),
          ...((wheel['angles'] as List).map(chartRow).map(_Fact.new)),
        ] else
          const _Note('出生时刻未完全确定，下方显示天体星座的稳定结果。'),
        const _Title('天体位置'),
        for (final position in positions)
          _Fact((
            label: position['label'] as String,
            value: position['value'] as String,
          ), symbol: _glyphs[position['planet']]),
        if (wheel != null) ...[
          const _Title('十二宫'),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              for (final (index, house) in (wheel['houses'] as List).indexed)
                Chip(
                  label: Text('第${index + 1}宫 · ${(house as Map)['label']}'),
                ),
            ],
          ),
          const _Title('主要相位'),
          if ((wheel['aspects'] as List).isEmpty)
            const _Note('未形成容许度内的主要相位。')
          else
            ...(wheel['aspects'] as List).map(chartRow).map(_Fact.new),
        ],
      ],
    );
  }
}

class _WesternWheel extends CustomPainter {
  _WesternWheel(this.wheel, this.positions, this.colors);
  final Map wheel;
  final List<Map> positions;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    const origin = Offset(150, 150);
    canvas.scale(size.width / 300, size.height / 300);
    final asc = (wheel['ascendant'] as num).toDouble();
    Offset point(num longitude, double radius) {
      final radians = (longitude - asc) * math.pi / 180;
      return origin +
          Offset(-radius * math.cos(radians), radius * math.sin(radians));
    }

    final rim = Paint()
      ..color = colors.outlineVariant
      ..style = PaintingStyle.stroke;
    final accent = Paint()
      ..color = colors.primary
      ..strokeWidth = 1.6;
    canvas.drawCircle(origin, 134, Paint()..color = colors.primaryContainer);
    canvas.drawCircle(origin, 108, Paint()..color = colors.surface);
    for (final radius in [134.0, 108.0, 78.0])
      canvas.drawCircle(origin, radius, rim);
    for (final Map house in wheel['houses'] as List) {
      final longitude = house['longitude'] as num;
      canvas.drawLine(point(longitude, 78), point(longitude, 134), rim);
    }
    for (final longitude in [asc, wheel['midheaven'] as num]) {
      canvas.drawLine(point(longitude, 104), point(longitude, 138), accent);
    }
    void glyph(String text, Offset at, double fontSize) {
      final painter = TextPainter(
        text: TextSpan(
          text: text,
          style: TextStyle(
            fontFamily: _chartSymbols,
            fontFamilyFallback: _chartSymbolFallback,
            fontSize: fontSize,
            color: colors.primary,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      painter.paint(canvas, at - Offset(painter.width / 2, painter.height / 2));
      painter.dispose();
    }

    for (final (index, sign) in '♈♉♊♋♌♍♎♏♐♑♒♓'.split('').indexed) {
      glyph(sign, point(index * 30 + 15, 120), 14);
    }
    final longitudes = {
      for (final position in positions)
        position['planet']: position['longitude'] as num,
    };
    final aspectInk = Paint()..color = colors.primary.withValues(alpha: 0.24);
    for (final Map aspect in wheel['aspects'] as List) {
      final first = longitudes[aspect['first']];
      final second = longitudes[aspect['second']];
      if (first != null && second != null)
        canvas.drawLine(point(first, 78), point(second, 78), aspectInk);
    }
    final drawn = <num>[];
    for (final entry in longitudes.entries) {
      final longitude = entry.value;
      final nearby = drawn.where((other) {
        final gap = (other - longitude).abs();
        return math.min(gap, 360 - gap) < 9;
      }).length;
      canvas.drawCircle(point(longitude, 78), 3, accent);
      glyph(_glyphs[entry.key] ?? '', point(longitude, 91.0 + nearby * 12), 12);
      drawn.add(longitude);
    }
  }

  @override
  bool shouldRepaint(_WesternWheel oldDelegate) =>
      oldDelegate.wheel != wheel ||
      oldDelegate.positions != positions ||
      oldDelegate.colors != colors;
}
