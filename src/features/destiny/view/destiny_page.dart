import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../frontend/control/destiny_birth_controller.dart';
import '../frontend/control/destiny_page_controller.dart';
import '../model/birth_profile_draft.dart';
import '../model/destiny_reading.dart';
import 'birth_profile_confirmation.dart';
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
    this.active = true,
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
  final bool active;

  @override
  State<DestinyPage> createState() => _DestinyPageState();
}

class _DestinyPageState extends State<DestinyPage> {
  late final DestinyPageController _controller;
  late final DestinyBirthController _birth;
  BirthProfile? _draft;
  BirthProfileDraft _prefill = const BirthProfileDraft();
  AccountBirthFields? _baseline;
  DialogRoute<BirthProfile>? _confirmation;
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
    _birth = DestinyBirthController(widget.account, widget.loadPlaces);
    if (widget.active) unawaited(_birth.refresh());
    unawaited(_controller.restoreReport());
  }

  @override
  void didUpdateWidget(covariant DestinyPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) unawaited(_birth.refresh());
  }

  @override
  void dispose() {
    if (_confirmation case final route?) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (route.isActive) route.navigator?.removeRoute(route);
      });
    }
    _birth.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('命理')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([_controller, _birth]),
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
            if (widget.calculateReading == null && widget.account == null)
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
                  child: Text(
                    _controller.reportError == null ? '获取命理解读' : '重试命理解读',
                  ),
                )
              else
                const Text('解读服务暂未配置。'),
              TextButton(
                onPressed: _canEdit
                    ? () => _openEditor(useCurrentDraft: true)
                    : null,
                child: const Text('修改出生资料'),
              ),
            ] else if (_controller.chart != null)
              TextButton(
                onPressed: _canEdit
                    ? () => _openEditor(useCurrentDraft: true)
                    : null,
                child: const Text('修改出生资料'),
              )
            else
              _entry(context),
            if (_birth.isCurrent &&
                !_editing &&
                !_controller.busy &&
                _controller.reading == null)
              if (_birth.localProfile case final profile?)
                _localProfileSummary(context, profile),
            if (_birth.loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
            if (_birth.readError case final error?) ...[
              _status(context, error),
              TextButton(
                onPressed: _birth.refresh,
                child: const Text('重试读取账户出生资料'),
              ),
            ],
            if (_controller.calculationError case final error?)
              _status(context, error),
            if (_controller.calculationError != null &&
                !_editing &&
                !_controller.busy)
              if (_draft case final draft?)
                FilledButton.tonal(
                  onPressed: () => _controller.submit(draft),
                  child: const Text('重试测算'),
                ),
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
            if (_birth.localNotice case final notice?)
              Semantics(liveRegion: true, child: Text(notice)),
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
          onPressed: _canEdit ? _openEditor : null,
          child: Text(
            _birth.current?.fields.hasData == true ||
                    _birth.localProfile != null
                ? '核对资料'
                : '开始解读',
          ),
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
        initialDraft: legacy ? _prefill : const BirthProfileDraft(),
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
      if (_baseline case final fields?
          when legacy && fields.birthPlace.isNotEmpty && _prefill.place == null)
        _status(context, '账户出生地点「${fields.birthPlace}」无法唯一匹配，请重新选择。'),
      if (legacy)
        TextButton(
          onPressed: () => setState(() => _editing = false),
          child: const Text('返回入口'),
        ),
    ],
  );

  bool get _canEdit =>
      !_controller.busy &&
      !_birth.localReading &&
      (!_birth.member || (_birth.current != null && !_birth.loading));

  void _openEditor({bool useCurrentDraft = false}) {
    final current = _birth.current;
    final fallback = _birth.localProfile;
    setState(() {
      _baseline = current?.fields;
      _prefill = useCurrentDraft && _draft != null
          ? BirthProfileDraft.fromProfile(_draft!)
          : current?.fields.hasData == true
          ? current!.draft
          : fallback == null
          ? const BirthProfileDraft()
          : BirthProfileDraft.fromProfile(fallback);
      _editing = true;
    });
  }

  Widget _localProfileSummary(BuildContext context, BirthProfile profile) {
    final fields = accountFieldsFor(profile);
    final time = fields.birthTime.isEmpty ? '出生时间未知' : fields.birthTime;
    final gender = switch (profile.gender) {
      BirthGender.female => '女',
      BirthGender.male => '男',
      BirthGender.other => '其他',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('本机出生资料', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('${fields.birthDate} · $time'),
            Text('${fields.birthPlace} · $gender'),
            const SizedBox(height: 4),
            Wrap(
              children: [
                TextButton(
                  onPressed: _canEdit ? _openEditor : null,
                  child: const Text('编辑出生资料'),
                ),
                TextButton(
                  onPressed: _birth.localWriting ? null : _confirmLocalDeletion,
                  child: const Text('删除本机档案'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLocalDeletion() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除本机出生资料？'),
        content: const Text('这里只删除此设备上的副本。账户出生资料和已归档报告仍可使用。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (mounted && accepted == true) await _birth.storeLocal(null);
  }

  Future<void> _confirm(BuildContext context, BirthProfile profile) async {
    if (_confirmation != null || !_birth.isCurrent) return;
    final navigator = Navigator.of(context, rootNavigator: true);
    final entered = accountFieldsFor(profile);
    late final DialogRoute<BirthProfile> route;
    route = DialogRoute<BirthProfile>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ListenableBuilder(
        listenable: _birth,
        builder: (context, _) {
          if (!_birth.isCurrent) return const SizedBox.shrink();
          final latest = _birth.conflict;
          final alternative = latest?.draft.completeProfile;
          return BirthProfileConfirmation(
            entered: entered,
            member: _birth.member,
            saving: _birth.saving,
            latest: latest?.fields,
            message: _birth.saveError,
            useLatest: alternative == null
                ? null
                : () => navigator.pop(alternative),
            confirm: () async {
              if (_birth.member) {
                final expected = latest?.fields ?? _baseline;
                if (expected == null ||
                    !await _birth.confirm(profile, expected))
                  return;
              }
              if (mounted && _birth.isCurrent && route.isCurrent)
                navigator.pop(profile);
            },
          );
        },
      ),
    );
    _confirmation = route;
    final confirmed = await navigator.push(route);
    _confirmation = null;
    if (!mounted || !_birth.isCurrent) return;
    _birth.clearConfirmation();
    if (confirmed == null) return;
    setState(() {
      _draft = confirmed;
      _editing = false;
    });
    await _controller.submit(confirmed);
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
            onPressed: () {
              _controller.cancelTask();
              unawaited(_controller.returnToArchive());
            },
            child: const Text('取消测算'),
          ),
        ],
      ),
    ),
  );

  List<Widget> _report(BuildContext context, String body) {
    final charts = _controller.reading?.charts ?? _controller.archivedCharts;
    final entry = _controller.archiveEntry;
    final fresh = _controller.reading != null;
    return [
      _reportCard(
        context,
        body,
        fresh: fresh,
        calculatedAt: entry?.calculatedAt,
      ),
      if (_controller.saving) ...[
        const LinearProgressIndicator(),
        Semantics(liveRegion: true, child: const Text('正在保存本次解读…')),
      ] else if (_controller.summarySaved)
        const Text('已保存解读和基础盘面，完整盘面暂未归档。')
      else if (fresh && entry != null)
        Semantics(liveRegion: true, child: const Text('已保存，下次进入命理页可直接查看。')),
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
      if (widget.account case final account? when entry != null)
        TextButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => ArchivedChartsPage(account: account),
            ),
          ),
          child: const Text('查看命盘记录'),
        ),
      Wrap(
        alignment: WrapAlignment.center,
        children: [
          TextButton(
            onPressed: _canEdit
                ? () => _openEditor(useCurrentDraft: _draft != null)
                : null,
            child: Text(_draft == null ? '重新测算' : '编辑出生资料'),
          ),
          if (fresh)
            TextButton(
              onPressed: _controller.saving
                  ? null
                  : _controller.returnToArchive,
              child: const Text('返回入口'),
            ),
        ],
      ),
      if (fresh && _birth.canStoreLocally && _draft != null)
        TextButton(
          onPressed: _birth.localReading || _birth.localWriting
              ? null
              : () => _birth.storeLocal(_draft),
          child: Text(_birth.localWriting ? '正在保存出生资料…' : '保存出生资料到本机'),
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
    required bool fresh,
    DateTime? calculatedAt,
  }) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            fresh ? '人生解读' : '上次解读',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (!fresh && calculatedAt != null) ...[
            Text(_archiveTimeLabel(context, calculatedAt)),
            const SizedBox(height: 8),
          ],
          DestinyReportText(body),
        ],
      ),
    ),
  );

  String _archiveTimeLabel(BuildContext context, DateTime instant) {
    final local = instant.toLocal();
    final format = MaterialLocalizations.of(context);
    final date = format.formatCompactDate(local);
    final time = format.formatTimeOfDay(
      TimeOfDay.fromDateTime(local),
      alwaysUse24HourFormat: true,
    );
    return '$date · $time';
  }
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
