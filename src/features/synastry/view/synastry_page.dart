import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/report_body.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../../destiny/destiny.dart';
import '../control/synastry_page_controller.dart';

const _systems = {'bazi': '八字', 'ziwei': '紫微斗数', 'western': '西方星盘'};

class SynastryPage extends StatefulWidget {
  const SynastryPage({
    super.key,
    required this.loadPlaces,
    this.account,
    this.calculate,
    this.compare,
    this.summarize,
    this.openAccount,
    this.openDestiny,
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final AccountController? account;
  final SynastryChartReader? calculate;
  final SynastryComparisonReader? compare;
  final SynastrySummaryReader? summarize;
  final VoidCallback? openAccount;
  final VoidCallback? openDestiny;

  @override
  State<SynastryPage> createState() => _SynastryPageState();
}

class _SynastryPageState extends State<SynastryPage> {
  final _scroll = ScrollController();
  bool _historyExpanded = false;
  MaterialPageRoute<void>? _editorRoute;
  late final _synastry = SynastryPageController(
    account: widget.account,
    calculate: widget.calculate,
    compare: widget.compare,
    summarize: widget.summarize,
  );

  @override
  void initState() {
    super.initState();
    unawaited(_synastry.restoreLatest());
  }

  @override
  void dispose() {
    final editor = _editorRoute;
    if (editor != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (editor.isActive) editor.navigator?.removeRoute(editor);
      });
    }
    _scroll.dispose();
    _synastry.dispose();
    super.dispose();
  }

  Future<void> _generateSummary() async {
    FocusManager.instance.primaryFocus?.unfocus();
    await _synastry.generateSummary();
    if (!mounted || _synastry.report == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) _scroll.jumpTo(0);
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _restoreComparedReport() async {
    await _synastry.restoreComparedReport();
    if (_synastry.report != null) _scrollAfterLayout(bottom: false);
  }

  Future<void> _compare() async {
    await _synastry.compareCharts();
    if (_synastry.result != null) _scrollAfterLayout(bottom: true);
  }

  Future<void> _openSaved(String id) async {
    await _synastry.openSaved(id);
    if (!mounted || _synastry.message != null) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _historyExpanded = false);
    _scrollAfterLayout(bottom: false);
  }

  void _scrollAfterLayout({required bool bottom}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final target = bottom ? _scroll.position.maxScrollExtent : 0.0;
      if (MediaQuery.disableAnimationsOf(context) ||
          MediaQuery.accessibleNavigationOf(context)) {
        _scroll.jumpTo(target);
      } else {
        unawaited(
          _scroll.animateTo(
            target,
            duration: const Duration(milliseconds: 235),
            curve: Curves.easeOutCubic,
          ),
        );
      }
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _edit(SynastrySide side) async {
    final name = side == SynastrySide.a ? 'A 方' : 'B 方';
    final current = _synastry.manualProfile(side);
    final initial = current == null
        ? const BirthProfileDraft()
        : BirthProfileDraft.fromProfile(current);
    var submitted = false;
    late final MaterialPageRoute<void> route;
    route = MaterialPageRoute<void>(
      builder: (context) => ListenableBuilder(
        listenable: _synastry,
        builder: (context, _) => Scaffold(
          appBar: AppBar(title: Text('$name出生资料')),
          body: SafeArea(
            top: false,
            child: ListView(
              padding: jovianPagePadding,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                const UiText('资料在本机排盘，用于本次合盘。'),
                const SizedBox(height: 12),
                BirthProfileEditor(
                  loadPlaces: widget.loadPlaces,
                  initialDraft: initial,
                  requireKnownTime: true,
                  busy: _synastry.busy,
                  submitLabel: '确认$name资料',
                  onSubmit: (profile) async {
                    submitted = true;
                    final saved = await _synastry.setManual(side, profile);
                    if (saved && route.isCurrent) route.navigator?.pop();
                  },
                ),
                if (_synastry.busy)
                  const LinearProgressIndicator(semanticsLabel: '正在计算盘面'),
                if (_synastry.message case final String error when submitted)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Semantics(liveRegion: true, child: Text(error)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    _editorRoute = route;
    await Navigator.of(context).push(route);
    if (!mounted) return;
    _editorRoute = null;
    if (submitted) _synastry.cancelManualCalculation();
  }

  void _history() {
    final account = widget.account;
    if (account == null) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) =>
            ReportsPage(account: account, initialKind: ReportKind.synastry),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([_synastry, widget.account]),
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        title: const UiText('合盘'),
        actions: [
          if (_synastry.hasSession)
            IconButton(
              tooltip: '合盘报告历史',
              onPressed: _history,
              icon: const Icon(Icons.history),
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          controller: _scroll,
          padding: jovianPagePadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const UiText('从亲情、友情、爱情和合作四个角度看两人的相处。'),
              if (_synastry.hasSession && !_synastry.member)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: UiText('访客可手动填写双方资料，报告保留在当前游客会话。'),
                ),
              if (_synastry.busy) ...[
                const SizedBox(height: 10),
                const LinearProgressIndicator(semanticsLabel: '正在处理合盘'),
              ],
              if (_synastry.report case final report?) ...[
                const SizedBox(height: 12),
                _report(context, report),
              ],
              if (_synastry.hasSession) ...[
                const SizedBox(height: 12),
                _savedReports(),
              ],
              if (!_synastry.canCalculate) ...[
                const SizedBox(height: 12),
                const Text('当前运行环境暂不支持本机合盘。可使用浏览器完成排盘。'),
              ],
              const SizedBox(height: 12),
              _section(context, 'A 方 · 本人盘面', [
                if (_synastry.member) _ownChartStatus(context),
                if (_synastry.manualProfile(SynastrySide.a) case final profile?)
                  _ManualProfileSummary(profile),
                if (_synastry.a case final chart?) _ChartSummary(chart),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (_synastry.member)
                      OutlinedButton(
                        onPressed: _synastry.busy
                            ? null
                            : _synastry.readOwnChart,
                        child: Text(
                          _synastry.aFromArchive ? '重新读取本人盘面' : '读取本人盘面',
                        ),
                      ),
                    OutlinedButton(
                      onPressed: !_synastry.canCalculate || _synastry.busy
                          ? null
                          : () => _edit(SynastrySide.a),
                      child: Text(
                        _synastry.a == null ? '手动填写 A 方资料' : '修改 A 方资料',
                      ),
                    ),
                    if (_synastry.member &&
                        _offersDestiny &&
                        widget.openDestiny != null)
                      TextButton(
                        onPressed: widget.openDestiny,
                        child: const UiText('前往命理'),
                      ),
                  ],
                ),
              ]),
              const SizedBox(height: 10),
              _section(context, 'B 方 · 对方盘面', [
                if (_synastry.manualProfile(SynastrySide.b) case final profile?)
                  _ManualProfileSummary(profile),
                if (_synastry.b case final chart?) _ChartSummary(chart),
                const UiText('盘面在本机计算。生成在线解读时，会发送双方的盘面对照结果。'),
                CheckboxListTile(
                  value: _synastry.allowed,
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const UiText('我已获准使用 B 方资料进行本次合盘'),
                  onChanged: (value) => _synastry.confirmConsent(value == true),
                ),
                OutlinedButton(
                  onPressed:
                      !_synastry.allowed ||
                          !_synastry.canCalculate ||
                          _synastry.busy
                      ? null
                      : () => _edit(SynastrySide.b),
                  child: Text(_synastry.b == null ? '手动填写 B 方资料' : '修改 B 方资料'),
                ),
              ]),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _synastry.canCompare ? _compare : null,
                child: const UiText('比较盘面'),
              ),
              if (_synastry.result case final result?) ...[
                const SizedBox(height: 12),
                _comparison(context, result),
                if (_synastry.report == null) ...[
                  const SizedBox(height: 10),
                  _interpretAction(context),
                ],
              ],
              if (_synastry.message case final message?)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Semantics(liveRegion: true, child: Text(message)),
                ),
            ],
          ),
        ),
      ),
    ),
  );

  bool get _offersDestiny => switch (_synastry.ownChartStatus) {
    OwnSynastryChartStatus.noArchive ||
    OwnSynastryChartStatus.missingSnapshot ||
    OwnSynastryChartStatus.unknownTime => true,
    _ => false,
  };

  Widget _ownChartStatus(BuildContext context) {
    final dateText = _formattedDate(context, _synastry.a?['calculatedAt']);
    final message = switch (_synastry.ownChartStatus) {
      OwnSynastryChartStatus.idle =>
        _synastry.a == null ? '可读取本人最近一次命理盘面，或手动填写。' : null,
      OwnSynastryChartStatus.loading => '正在读取本人盘面…',
      OwnSynastryChartStatus.available =>
        dateText == null ? '已读取最近的命理档案。' : '已读取 $dateText 的命理档案。',
      OwnSynastryChartStatus.noArchive => '还没有个人命理档案，可以先测算或手动填写。',
      OwnSynastryChartStatus.missingSnapshot => '最近的命理档案没有结构化盘面，请回命理重新测算。',
      OwnSynastryChartStatus.unknownTime => '最近的命理档案缺少出生时间，请回命理补齐。',
      OwnSynastryChartStatus.failed => '暂时无法读取本人盘面，请重试。',
    };
    return message == null
        ? const SizedBox.shrink()
        : Semantics(liveRegion: true, child: Text(message));
  }

  Widget _savedReports() => Card(
    key: const ValueKey('synastry-report-history'),
    margin: EdgeInsets.zero,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          expanded: _historyExpanded,
          child: ListTile(
            title: UiText(_historyExpanded ? '收起已存解读' : '查看已存解读'),
            trailing: Icon(
              _historyExpanded ? Icons.expand_less : Icons.expand_more,
            ),
            onTap: () {
              if (!_historyExpanded) _synastry.openHistory();
              setState(() => _historyExpanded = !_historyExpanded);
            },
          ),
        ),
        if (_synastry.history case final history? when _historyExpanded)
          ListenableBuilder(
            listenable: history,
            builder: (context, _) {
              final page = history.locked ? null : history.page;
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (history.loading)
                      Semantics(
                        liveRegion: true,
                        child: LinearProgressIndicator(
                          semanticsLabel: context.uiLabel('正在读取已存解读…'),
                        ),
                      ),
                    if (history.listError != null || history.locked)
                      Semantics(
                        liveRegion: true,
                        child: const UiText('暂时无法读取存档。'),
                      ),
                    if (page != null) ...[
                      if (page.entries.isEmpty && !history.loading)
                        const UiText('暂无合盘报告。'),
                      for (final entry in page.entries)
                        ListTile(
                          key: ValueKey(entry.id),
                          contentPadding: EdgeInsets.zero,
                          title: Text(entry.title),
                          subtitle: Text(
                            _formattedDate(context, entry.savedAt)!,
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          enabled: !_synastry.busy,
                          onTap: () => _openSaved(entry.id),
                        ),
                    ],
                    Wrap(
                      children: [
                        if (page?.nextCursor != null)
                          TextButton(
                            onPressed: history.loading ? null : history.more,
                            child: const UiText('加载更多'),
                          ),
                        TextButton(
                          onPressed: history.loading ? null : history.refresh,
                          child: const UiText('刷新报告'),
                        ),
                        TextButton(
                          onPressed: _history,
                          child: const UiText('查看全部合盘报告'),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    ),
  );

  Widget _interpretAction(BuildContext context) {
    final links = context.getInheritedWidgetOfExactType<AccountSectionLinks>();
    final hasSession = _synastry.hasSession;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasSession &&
            (!_synastry.summaryConfigured || _synastry.needsPermission))
          OutlinedButton(
            onPressed: _synastry.busy ? null : _restoreComparedReport,
            child: const UiText('查看此组合已存解读'),
          ),
        if (!_synastry.summaryConfigured)
          const UiText('在线解读服务暂未配置。')
        else if (!hasSession || _synastry.needsPermission)
          OutlinedButton(
            onPressed: hasSession && links != null
                ? () => unawaited(
                    links.open(
                      accountDestination(AccountSection.aiPermissions),
                    ),
                  )
                : widget.openAccount,
            child: UiText(hasSession ? '前往 AI 授权' : '登录或进入游客体验后生成解读'),
          )
        else
          FilledButton(
            onPressed: _synastry.busy ? null : _generateSummary,
            child: const UiText('生成合盘解读'),
          ),
      ],
    );
  }

  Widget _report(BuildContext context, String report) {
    final savedAt = _synastry.savedAt?.toLocal();
    final format = MaterialLocalizations.of(context);
    return _section(context, '合盘解读', [
      Text(
        savedAt == null
            ? '本次解读暂未存档'
            : '已存档 · ${format.formatMediumDate(savedAt)}',
      ),
      if (_synastry.reportFromArchive) const Text('从合盘存档读取'),
      _RelationshipReport(key: ValueKey(report), body: report),
      if (_synastry.needsSave)
        OutlinedButton(
          onPressed: _synastry.busy ? null : _synastry.retrySave,
          child: const UiText('重试存档'),
        ),
    ]);
  }

  Widget _comparison(BuildContext context, Map<String, Object?> result) {
    final comparison = result['comparison'];
    final sections = comparison is Map ? comparison['sections'] : null;
    return _section(context, '双人盘面对照', [
      if (sections is List)
        for (final section in sections)
          if (section case {
            'system': final String system,
            'coverage': final String coverage,
            'evidence': final List evidence,
          } when _systems.containsKey(system))
            _comparisonSection(
              _systems[system]!,
              coverage,
              section['limitation'],
              evidence,
            ),
    ]);
  }

  Widget _comparisonSection(
    String name,
    String coverage,
    Object? limitation,
    List evidence,
  ) {
    final observations = {
      for (final fact in evidence)
        if (fact case {'observation': final String observation}) observation,
    };
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      title: Text('$name · ${_coverage(coverage)}'),
      children: [
        if (limitation case final String detail) Text(detail),
        for (final observation in observations)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(observation),
          ),
      ],
    );
  }
}

Widget _section(BuildContext context, String title, List<Widget> children) =>
    Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            Semantics(
              container: true,
              header: true,
              child: Text(title, style: Theme.of(context).textTheme.titleLarge),
            ),
            ...children,
          ],
        ),
      ),
    );

String? _formattedDate(BuildContext context, Object? value) {
  final time = switch (value) {
    final DateTime instant => instant.toLocal(),
    final String text => DateTime.tryParse(text)?.toLocal(),
    _ => null,
  };
  if (time == null) return null;
  final format = MaterialLocalizations.of(context);
  final date = format.formatMediumDate(time);
  final hour = format.formatTimeOfDay(
    TimeOfDay.fromDateTime(time),
    alwaysUse24HourFormat: true,
  );
  return '$date $hour';
}

class _ManualProfileSummary extends StatelessWidget {
  const _ManualProfileSummary(this.profile);

  final BirthProfile profile;

  @override
  Widget build(BuildContext context) {
    final date = profile.date.utcMidnight.toIso8601String().substring(0, 10);
    final hour = profile.time.hour?.toString().padLeft(2, '0');
    final minute = profile.time.minute?.toString().padLeft(2, '0');
    return Text(
      '$date $hour:$minute · ${profile.place.name}',
      style: Theme.of(context).textTheme.bodyMedium,
    );
  }
}

class _RelationshipReport extends StatefulWidget {
  const _RelationshipReport({super.key, required this.body});

  final String body;

  @override
  State<_RelationshipReport> createState() => _RelationshipReportState();
}

class _RelationshipReportState extends State<_RelationshipReport> {
  final _headings = <String, GlobalKey>{};

  static final _sectionHeading = RegExp(
    r'^## (亲情|友情|爱情|合作)[ \t]*\r?$',
    multiLine: true,
  );

  @override
  Widget build(BuildContext context) {
    final body = widget.body;
    final matches = _sectionHeading.allMatches(body).toList(growable: false);
    final names = matches.map((match) => match[1]!).toList(growable: false);
    if (names.isEmpty || names.toSet().length != names.length)
      return ReportBody(body);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            for (final name in names)
              OutlinedButton(
                onPressed: () {
                  final target = _headings[name]?.currentContext;
                  if (target == null) return;
                  final reduced =
                      MediaQuery.disableAnimationsOf(context) ||
                      MediaQuery.accessibleNavigationOf(context);
                  unawaited(
                    Scrollable.ensureVisible(
                      target,
                      alignment: .04,
                      duration: reduced
                          ? Duration.zero
                          : const Duration(milliseconds: 220),
                      curve: Curves.easeOut,
                    ),
                  );
                },
                child: Text(name),
              ),
          ],
        ),
        if (matches.first.start > 0)
          ReportBody(body.substring(0, matches.first.start).trim()),
        for (var index = 0; index < matches.length; index++)
          Padding(
            key: _headings.putIfAbsent(names[index], GlobalKey.new),
            padding: const EdgeInsets.only(top: 14, bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 8,
              children: [
                ReportHeading(names[index]),
                ReportBody(
                  body
                      .substring(
                        matches[index].end,
                        index + 1 < matches.length
                            ? matches[index + 1].start
                            : body.length,
                      )
                      .trim(),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

String _coverage(Object? status) => switch (status) {
  'complete' => '可用',
  'partial' || 'limited' => '部分可用',
  _ => '不可用',
};

class _ChartSummary extends StatelessWidget {
  const _ChartSummary(this.chart);

  final Map<String, Object?> chart;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 4,
    children: [
      for (final MapEntry(:key, :value) in _systems.entries)
        if (chart[key] case {'status': final String status})
          Text('$value ${_coverage(status)}'),
    ],
  );
}
