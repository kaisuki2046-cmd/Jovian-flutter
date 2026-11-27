import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../frontend/control/destiny_birth_controller.dart';
import '../frontend/control/destiny_page_controller.dart';
import '../model/birth_profile_draft.dart';
import '../model/destiny_reading.dart';
import 'birth_display_labels.dart';
import 'birth_profile_confirmation.dart';
import 'birth_profile_editor.dart';
import 'destiny_chart_dialog.dart';
import 'destiny_report_text.dart';
import 'destiny_star_visual.dart';

class DestinyPage extends StatefulWidget {
  const DestinyPage({
    super.key,
    required this.loadPlaces,
    required this.calculateReading,
    this.requestReport,
    this.openFortune,
    this.account,
    this.active = true,
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final Future<DestinyReading> Function(
    BirthProfile,
    Future<void>,
    void Function(String),
  )
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
  late final String? _chartScope;
  BirthProfile? _draft;
  BirthProfileDraft _prefill = const BirthProfileDraft();
  AccountBirthFields? _baseline;
  DialogRoute<BirthProfile>? _confirmation;
  bool _editing = false;
  bool _motionEnabled = true;

  @override
  void initState() {
    super.initState();
    _chartScope = widget.account?.authorizedSession?.scope;
    _controller = DestinyPageController(
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
    if (widget.active && !oldWidget.active) {
      unawaited(_birth.refresh());
      if (!_editing && !_controller.busy && _controller.reading == null) {
        unawaited(_controller.restoreReport());
      }
    }
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
    appBar: AppBar(
      title: const UiText('命理'),
      actions: [
        IconButton(
          isSelected:
              _motionEnabled && !MediaQuery.disableAnimationsOf(context),
          tooltip: context.uiLabel(
            MediaQuery.disableAnimationsOf(context)
                ? '系统已减少动态效果'
                : _motionEnabled
                ? '关闭动效'
                : '开启动效',
          ),
          onPressed: MediaQuery.disableAnimationsOf(context)
              ? null
              : () => setState(() => _motionEnabled = !_motionEnabled),
          icon: const Icon(Icons.play_circle_outline),
          selectedIcon: const Icon(Icons.pause_circle_outline),
        ),
      ],
    ),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([_controller, _birth, widget.account]),
        builder: (context, _) => ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: jovianPagePadding,
          children: [
            if (widget.openFortune case final open?) ...[
              Card(
                child: ListTile(
                  onTap: () => open(null),
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const UiText('周期运势'),
                  subtitle: const UiText('日、周、月、年'),
                  trailing: const Icon(Icons.chevron_right),
                ),
              ),
              const SizedBox(height: 18),
            ],
            if (_controller.archiveLoading) const LinearProgressIndicator(),
            if (_controller.archiveError)
              TextButton(
                onPressed: _controller.restoreReport,
                child: const UiText('已存报告读取失败，点此重试'),
              ),
            if (_controller.stage case final stage? when !_controller.saving)
              _progress(context, stage)
            else if (_editing)
              _editor(context)
            else if (_controller.report case final body?)
              ..._report(context, body)
            else if (_controller.reading case final reading?) ...[
              FilledButton.tonal(
                onPressed: () => _showCharts(context, reading.charts),
                child: const UiText('查看命盘'),
              ),
              ..._reportActions(context),
              TextButton(
                onPressed: _canEdit
                    ? () => _openEditor(useCurrentDraft: true)
                    : null,
                child: const UiText('修改出生资料'),
              ),
            ] else
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
                child: const UiText('重试读取账户出生资料'),
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
                  child: const UiText('重试测算'),
                ),
            if (_controller.reportError case final error?)
              _status(context, error),
            if (_controller.needsSave)
              TextButton(
                onPressed: _controller.saving ? null : _controller.saveReport,
                child: UiText(_controller.saving ? '正在存档…' : '重试存档'),
              ),
            if (_birth.localNotice case final notice?)
              Semantics(liveRegion: true, child: UiText(notice)),
          ],
        ),
      ),
    ),
  );

  List<Widget> _reportActions(BuildContext context) {
    if (widget.requestReport == null) {
      return const [UiText('解读服务暂未配置。')];
    }
    if (_controller.needsReportPermission) {
      final links = context
          .getInheritedWidgetOfExactType<AccountSectionLinks>();
      return [
        const UiText('请在个人中心开启命理在线解读授权。'),
        if (links != null)
          OutlinedButton(
            onPressed: () => unawaited(
              links.open(accountDestination(AccountSection.aiPermissions)),
            ),
            child: const UiText('前往 AI 授权'),
          ),
      ];
    }
    return [
      FilledButton(
        onPressed: _controller.generateReport,
        child: UiText(_controller.reportError == null ? '获取命理解读' : '重试命理解读'),
      ),
    ];
  }

  Widget _entry(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: double.infinity,
              height: 170,
              child: DestinyStarVisual(motion: _motionEnabled && widget.active),
            ),
            Image.asset(
              'src/features/destiny/assets/celestial-orb.png',
              width: 154,
              height: 154,
              excludeFromSemantics: true,
            ),
          ],
        ),
        UiText('星象手记', style: Theme.of(context).textTheme.headlineMedium),
        const UiText('从出生资料展开你的命盘'),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _canEdit ? _openEditor : null,
          child: UiText(
            _birth.current?.fields.hasData == true ||
                    _birth.localProfile != null
                ? '核对资料'
                : '开始解读',
          ),
        ),
      ],
    ),
  );

  Widget _editor(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      UiText('填写出生资料', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      BirthProfileEditor(
        loadPlaces: widget.loadPlaces,
        initialDraft: _prefill,
        submitLabel: '核对出生资料',
        requireKnownTime: true,
        busy: _controller.busy,
        onSubmit: (profile) => _confirm(context, profile),
      ),
      if (_baseline case final fields?
          when fields.birthPlace.isNotEmpty && _prefill.place == null)
        _status(
          context,
          context
              .uiLabel('账户出生地点「{place}」无法唯一匹配，请重新选择。')
              .replaceFirst('{place}', fields.birthPlace),
        ),
      TextButton(
        onPressed: () => setState(() => _editing = false),
        child: const UiText('返回入口'),
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
    final time = birthTimeLabel(context, profile.time);
    final gender = birthGenderLabel(context, fields.gender);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UiText('本机出生资料', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('${fields.birthDate} · $time'),
            Text('${fields.birthPlace} · $gender'),
            const SizedBox(height: 4),
            Wrap(
              children: [
                TextButton(
                  onPressed: _canEdit ? _openEditor : null,
                  child: const UiText('编辑出生资料'),
                ),
                TextButton(
                  onPressed: _birth.localWriting ? null : _confirmLocalDeletion,
                  child: const UiText('删除本机档案'),
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
        title: const UiText('删除本机出生资料？'),
        content: const UiText('这里只删除此设备上的副本。账户出生资料和已归档报告仍可使用。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const UiText('删除'),
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

  Widget _progress(BuildContext context, String stage) {
    final step = switch (stage) {
      'validating' => 1,
      'normalizing' => 2,
      'bazi' => 3,
      'ziwei' => 4,
      'western' => 5,
      _ => 6,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            UiText(
              stage == 'expressing' ? '报告正在成稿' : '星图正在展开',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 150,
              child: DestinyStarVisual(
                motion: _motionEnabled && widget.active,
                step: step,
              ),
            ),
            LinearProgressIndicator(value: (step - 1) / 6),
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: UiText(switch (stage) {
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
              child: const UiText('取消测算'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCharts(BuildContext context, DestinyCharts charts) {
    final account = widget.account;
    unawaited(
      showDestinyCharts(
        context,
        charts,
        access: account == null
            ? null
            : (
                listenable: account,
                isCurrent: () =>
                    _chartScope != null &&
                    !account.sessionChanging &&
                    account.authorizedSession?.scope == _chartScope,
              ),
      ),
    );
  }

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
        Semantics(liveRegion: true, child: const UiText('正在保存本次解读…')),
      ] else if (_controller.summarySaved)
        const UiText('已保存解读和基础盘面，完整盘面暂未归档。')
      else if (fresh && entry != null)
        Semantics(liveRegion: true, child: const UiText('已保存，下次进入命理页可直接查看。')),
      if (charts != null)
        FilledButton.tonal(
          onPressed: () => _showCharts(context, charts),
          child: const UiText('查看命盘'),
        ),
      if ((_controller.fortuneArchiveId, widget.openFortune) case (
        final id?,
        final open?,
      ))
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const UiText('查看此盘的周期运势'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => open(id),
          ),
        ),
      if ((widget.account, entry, _chartScope) case (
        final account?,
        final saved?,
        final scope?,
      ))
        TextButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => ArchivedChartsPage(
                account: account,
                selectedArchive: (id: saved.id, scope: scope),
              ),
            ),
          ),
          child: const UiText('查看命盘记录'),
        ),
      Wrap(
        alignment: WrapAlignment.center,
        children: [
          TextButton(
            onPressed: _canEdit
                ? () => _openEditor(useCurrentDraft: _draft != null)
                : null,
            child: UiText(_draft == null ? '重新测算' : '编辑出生资料'),
          ),
          if (fresh)
            TextButton(
              onPressed: _controller.saving
                  ? null
                  : _controller.returnToArchive,
              child: const UiText('返回入口'),
            ),
        ],
      ),
      if (fresh && _birth.canStoreLocally && _draft != null)
        TextButton(
          onPressed: _birth.localReading || _birth.localWriting
              ? null
              : () => _birth.storeLocal(_draft),
          child: UiText(_birth.localWriting ? '正在保存出生资料…' : '保存出生资料到本机'),
        ),
    ];
  }

  Widget _status(BuildContext context, String error) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: UiText(
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
          UiText(
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
