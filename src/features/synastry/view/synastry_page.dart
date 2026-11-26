import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

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
    _scroll.dispose();
    _synastry.dispose();
    super.dispose();
  }

  Future<void> _generateSummary() async {
    await _synastry.generateSummary();
    if (!mounted || !_scroll.hasClients || _synastry.report == null) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _scroll.jumpTo(0);
    } else {
      await _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 235),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _edit(SynastrySide side) async {
    final name = side == SynastrySide.a ? 'A 方' : 'B 方';
    final profile = await Navigator.of(context).push<BirthProfile>(
      MaterialPageRoute(
        builder: (context) => Scaffold(
          appBar: AppBar(title: Text('$name出生资料')),
          body: SafeArea(
            top: false,
            child: ListView(
              padding: jovianPagePadding,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                BirthProfileEditor(
                  loadPlaces: widget.loadPlaces,
                  requireKnownTime: true,
                  submitLabel: '确认$name资料',
                  onSubmit: (profile) => Navigator.pop(context, profile),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (mounted && profile != null) await _synastry.setManual(side, profile);
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
        title: const Text('合盘'),
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
        child: ListView(
          controller: _scroll,
          padding: jovianPagePadding,
          children: [
            const Text('从亲情、友情、爱情和合作四个角度看两人的相处。'),
            if (_synastry.busy) ...[
              const SizedBox(height: 10),
              const LinearProgressIndicator(semanticsLabel: '正在处理合盘'),
            ],
            if (_synastry.report case final report?) ...[
              const SizedBox(height: 12),
              _report(context, report),
            ],
            if (!_synastry.canCalculate) ...[
              const SizedBox(height: 12),
              const Text('当前运行环境暂不支持本机合盘。可使用浏览器完成排盘。'),
            ],
            const SizedBox(height: 12),
            _section(context, 'A 方 · 本人盘面', [
              if (_synastry.aFromArchive) const Text('来自最近的命理档案'),
              if (_synastry.a case final chart?) _ChartSummary(chart),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (_synastry.member)
                    OutlinedButton(
                      onPressed: _synastry.busy ? null : _synastry.readOwnChart,
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
                      _synastry.a == null &&
                      widget.openDestiny != null)
                    TextButton(
                      onPressed: widget.openDestiny,
                      child: const Text('前往命理'),
                    ),
                ],
              ),
            ]),
            const SizedBox(height: 10),
            _section(context, 'B 方 · 对方盘面', [
              if (_synastry.b case final chart?) _ChartSummary(chart),
              const Text('盘面在本机计算。生成在线解读时，会发送双方的盘面对照结果。'),
              CheckboxListTile(
                value: _synastry.allowed,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text('我已获准使用 B 方资料进行本次合盘'),
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
              onPressed: _synastry.canCompare ? _synastry.compareCharts : null,
              child: const Text('比较盘面'),
            ),
            if (_synastry.message case final message?)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Semantics(liveRegion: true, child: Text(message)),
              ),
            if (_synastry.result case final result?) ...[
              const SizedBox(height: 12),
              _comparison(context, result),
              if (_synastry.report == null) ...[
                const SizedBox(height: 10),
                _interpretAction(),
              ],
            ],
          ],
        ),
      ),
    ),
  );

  Widget _interpretAction() {
    if (!_synastry.summaryConfigured) return const Text('在线解读服务暂未配置。');
    if (!_synastry.hasSession || _synastry.needsPermission) {
      return OutlinedButton(
        onPressed: widget.openAccount,
        child: Text(_synastry.hasSession ? '前往个人中心开启合盘解读授权' : '登录或进入游客体验后生成解读'),
      );
    }
    return FilledButton(
      onPressed: _synastry.busy ? null : _generateSummary,
      child: const Text('生成合盘解读'),
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
      ReportBody(report),
      if (_synastry.needsSave)
        OutlinedButton(
          onPressed: _synastry.busy ? null : _synastry.retrySave,
          child: const Text('重试存档'),
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
              header: true,
              child: Text(title, style: Theme.of(context).textTheme.titleLarge),
            ),
            ...children,
          ],
        ),
      ),
    );

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
