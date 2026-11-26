import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/report_body.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../frontend/control/destiny_page_controller.dart';
import '../model/destiny_reading.dart';
import 'birth_profile_editor.dart';

const _pillarLabels = {
  Pillar.year: '年柱',
  Pillar.month: '月柱',
  Pillar.day: '日柱',
  Pillar.hour: '时柱',
};

class DestinyPage extends StatefulWidget {
  const DestinyPage({
    super.key,
    required this.loadPlaces,
    required this.calculate,
    this.calculateReading,
    this.requestReport,
    this.openFortune,
    this.account,
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final Future<LocalBaZi> Function(BirthProfile) calculate;
  final Future<DestinyReading> Function(BirthProfile, Future<void>)?
  calculateReading;
  final Future<String> Function(Map<String, Object?>)? requestReport;
  final VoidCallback? openFortune;
  final AccountController? account;

  @override
  State<DestinyPage> createState() => _DestinyPageState();
}

class _DestinyPageState extends State<DestinyPage> {
  late final DestinyPageController _controller;

  @override
  void initState() {
    super.initState();
    _controller = DestinyPageController(
      calculate: widget.calculate,
      calculateReading: widget.calculateReading,
      requestReport: widget.requestReport,
      account: widget.account,
    );
    unawaited(_controller.restoreReport());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('命理')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) => ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: jovianPagePadding,
          children: [
            if (widget.openFortune case final open?) ...[
              Card(
                child: ListTile(
                  onTap: open,
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('周期运势'),
                  subtitle: const Text('日、周、月、年'),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ),
              const SizedBox(height: 18),
            ],
            if (_controller.report case final report?
                when _controller.reading == null)
              _reportCard(context, report, saved: true),
            if (_controller.archiveLoading) const LinearProgressIndicator(),
            if (_controller.archiveError)
              TextButton(
                onPressed: _controller.restoreReport,
                child: const Text('已存报告读取失败，点此重试'),
              ),
            Text('出生资料', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            BirthProfileEditor(
              loadPlaces: widget.loadPlaces,
              submitLabel: _controller.calculating
                  ? '正在排盘…'
                  : widget.calculateReading == null
                  ? '计算八字'
                  : '排盘',
              busy: _controller.busy,
              onSubmit: _controller.submit,
            ),
            if (_controller.calculationError case final error?)
              _status(context, error),
            if (_controller.chart case final chart?) ...[
              const SizedBox(height: 16),
              _BaZiResult(chart: chart),
            ],
            if (_controller.reading case final reading?) ...[
              const SizedBox(height: 16),
              for (final preview in reading.charts)
                _LegacyChartCard(preview: preview),
              const SizedBox(height: 12),
              if (_controller.report == null && widget.requestReport != null)
                FilledButton.tonal(
                  onPressed: _controller.busy
                      ? null
                      : _controller.generateReport,
                  child: Text(_controller.generating ? '正在生成解读…' : '获取命理解读'),
                ),
              if (_controller.report case final body?)
                _reportCard(context, body, saved: !_controller.needsSave),
            ],
            if (_controller.reportError case final error?)
              _status(context, error),
            if (_controller.needsSave)
              TextButton(
                onPressed: _controller.saving ? null : _controller.saveReport,
                child: Text(_controller.saving ? '正在存档…' : '重试存档'),
              ),
          ],
        ),
      ),
    ),
  );

  Widget _status(BuildContext context, String error) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        error,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    ),
  );

  Widget _reportCard(
    BuildContext context,
    String body, {
    required bool saved,
  }) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            saved ? '已保存的命理解读' : '命理解读',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          ReportBody(body),
        ],
      ),
    ),
  );
}

class _LegacyChartCard extends StatelessWidget {
  const _LegacyChartCard({required this.preview});

  final DestinyChartPreview preview;

  @override
  Widget build(BuildContext context) => Card(
    child: ExpansionTile(
      title: Text(preview.label),
      subtitle: preview.note == null ? null : Text(preview.note!),
      children: [
        for (final row in preview.rows)
          ListTile(title: Text(row.label), subtitle: Text(row.value)),
      ],
    ),
  );
}

class _BaZiResult extends StatelessWidget {
  const _BaZiResult({required this.chart});

  final LocalBaZi chart;

  @override
  Widget build(BuildContext context) {
    final exact = chart.exactChart;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('八字四柱', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            if (exact == null) const Text('出生时分不完整，有多个可能值时会同时显示。'),
            for (final position in Pillar.values)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_pillarLabels[position]!),
                subtitle: Text(chart.pillars[position]!.join('、')),
              ),
            if (exact?['luckPeriods'] case final List periods
                when periods.isNotEmpty)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('大运'),
                children: [
                  for (final Map period in periods)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(period['ganZhi'] as String),
                      trailing: Text(
                        '${period['startAge']}–${period['endAge']} 岁',
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
