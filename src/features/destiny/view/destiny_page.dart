import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../frontend/control/destiny_page_controller.dart';
import '../model/destiny_reading.dart';
import 'birth_profile_editor.dart';
import 'destiny_chart_dialog.dart';
import 'destiny_report_text.dart';

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
  final Future<DestinyReading> Function(
    BirthProfile,
    Future<void>,
    void Function(String),
  )?
  calculateReading;
  final Future<String> Function(Map<String, Object?>, Future<void>)?
  requestReport;
  final void Function(String? archiveId)? openFortune;
  final AccountController? account;

  @override
  State<DestinyPage> createState() => _DestinyPageState();
}

class _DestinyPageState extends State<DestinyPage> {
  late final DestinyPageController _controller;
  BirthProfile? _draft;
  bool _editing = false;

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
                  onTap: () => open(null),
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('周期运势'),
                  subtitle: const Text('日、周、月、年'),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ),
              const SizedBox(height: 18),
            ],
            if (_controller.archiveLoading) const LinearProgressIndicator(),
            if (_controller.archiveError)
              TextButton(
                onPressed: _controller.restoreReport,
                child: const Text('已存报告读取失败，点此重试'),
              ),
            if (widget.calculateReading == null)
              _editor(context, legacy: false)
            else if (_controller.stage case final stage?
                when !_controller.saving)
              _progress(context, stage)
            else if (_editing)
              _editor(context, legacy: true)
            else if (_controller.report case final body?)
              ..._report(context, body)
            else if (_controller.reading case final reading?) ...[
              FilledButton.tonal(
                onPressed: () => showDestinyCharts(context, reading.charts),
                child: const Text('查看命盘'),
              ),
              if (widget.requestReport != null)
                FilledButton(
                  onPressed: _controller.generateReport,
                  child: const Text('获取命理解读'),
                )
              else
                const Text('解读服务暂未配置。'),
              TextButton(
                onPressed: () => setState(() => _editing = true),
                child: const Text('修改出生资料'),
              ),
            ] else
              _entry(context),
            if (_controller.calculationError case final error?)
              _status(context, error),
            if (_controller.chart case final chart?) ...[
              const SizedBox(height: 16),
              _BaZiResult(chart: chart),
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

  Widget _entry(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      children: [
        Image.asset(
          'src/features/destiny/assets/celestial-orb.png',
          width: 154,
          height: 154,
          excludeFromSemantics: true,
        ),
        Text('星象手记', style: Theme.of(context).textTheme.headlineMedium),
        const Text('从出生资料展开你的命盘'),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => setState(() => _editing = true),
          child: const Text('开始解读'),
        ),
      ],
    ),
  );

  Widget _editor(BuildContext context, {required bool legacy}) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        legacy ? '填写出生资料' : '出生资料',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 12),
      BirthProfileEditor(
        loadPlaces: widget.loadPlaces,
        initialProfile: legacy ? _draft : null,
        submitLabel: legacy
            ? '核对出生资料'
            : _controller.calculating
            ? '正在排盘…'
            : '计算八字',
        busy: _controller.busy,
        onSubmit: legacy
            ? (profile) => _confirm(context, profile)
            : _controller.submit,
      ),
      if (legacy)
        TextButton(
          onPressed: () => setState(() => _editing = false),
          child: const Text('返回入口'),
        ),
    ],
  );

  Future<void> _confirm(BuildContext context, BirthProfile profile) async {
    final time = profile.time;
    final clock = time.timeKnown
        ? '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}'
        : '时刻未完全确定';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('核对出生资料'),
        content: Text(
          '${profile.date.utcMidnight.toIso8601String().substring(0, 10)} · $clock\n${profile.place.name} · ${switch (profile.gender) {
            BirthGender.female => '女',
            BirthGender.male => '男',
            BirthGender.other => '其他',
          }}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('返回修改'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确认测算'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    setState(() {
      _draft = profile;
      _editing = false;
    });
    await _controller.submit(profile);
  }

  Widget _progress(BuildContext context, String stage) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Text(
            stage == 'expressing' ? '报告正在成稿' : '星图正在展开',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          const LinearProgressIndicator(),
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Text(switch (stage) {
              'validating' => '核对出生资料',
              'normalizing' => '定位出生地的当地时间',
              'bazi' => '计算八字四柱',
              'ziwei' => '计算紫微斗数',
              'western' => '计算西方星盘',
              _ => '检索解读素材并整理报告',
            }),
          ),
          TextButton(
            onPressed: _controller.cancelTask,
            child: const Text('取消测算'),
          ),
        ],
      ),
    ),
  );

  List<Widget> _report(BuildContext context, String body) {
    final charts = _controller.reading?.charts ?? _controller.archivedCharts;
    return [
      _reportCard(context, body, saved: _controller.reading == null),
      if (_controller.saving) const LinearProgressIndicator(),
      if (_controller.summarySaved) const Text('已保存解读和基础盘面。'),
      if (charts != null)
        FilledButton.tonal(
          onPressed: () => showDestinyCharts(context, charts),
          child: const Text('查看命盘'),
        ),
      if ((_controller.fortuneArchiveId, widget.openFortune) case (
        final id?,
        final open?,
      ))
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const Text('查看此盘的周期运势'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => open(id),
          ),
        ),
      if (widget.account case final account?
          when _controller.fortuneArchiveId != null ||
              _controller.summarySaved ||
              _controller.archivedCharts != null)
        TextButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => ReportsPage(account: account),
            ),
          ),
          child: const Text('查看命盘记录'),
        ),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TextButton(
            onPressed: _controller.saving
                ? null
                : () => setState(() => _editing = true),
            child: Text(_draft == null ? '重新测算' : '编辑出生资料'),
          ),
          if (_controller.reading != null)
            TextButton(
              onPressed: _controller.saving
                  ? null
                  : _controller.returnToArchive,
              child: const Text('返回入口'),
            ),
        ],
      ),
    ];
  }

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
            saved ? '上次解读' : '人生解读',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          DestinyReportText(body),
        ],
      ),
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
