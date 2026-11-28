import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../../destiny/destiny.dart';
import '../control/synastry_page_controller.dart';
import '../model/synastry_relationship.dart';
import 'synastry_album_selector.dart';
import 'synastry_pair_header.dart';
import 'synastry_record_studio.dart';
import 'synastry_report_page.dart';

const _systems = {'bazi': '八字', 'ziwei': '紫微斗数', 'western': '西方星盘'};

enum _PersonAction { add, edit, own, destiny }

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
  var _edition = SynastryEdition.family;
  Route<dynamic>? _entryRoute;
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
    final route = _entryRoute;
    if (route != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (route.isActive) route.navigator?.removeRoute(route);
      });
    }
    _synastry.dispose();
    super.dispose();
  }

  Future<void> _openRecords({bool library = false, bool start = false}) async {
    if (_entryRoute != null || (start && !_synastry.canCompare)) return;
    if (library) {
      _synastry.openHistory();
      _synastry.history?.closeDetail();
    }
    final links = context.getInheritedWidgetOfExactType<AccountSectionLinks>();
    final edition = _edition;
    final navigator = Navigator.of(context);
    late final TransitionRoute<void> route;

    Future<void> compare() async {
      await _synastry.compareCharts();
      if (mounted &&
          route.isCurrent &&
          _synastry.result != null &&
          _synastry.canGenerateSummary) {
        await _synastry.generateSummary(edition: edition);
      }
    }

    final reading = SynastryCurrentReading(
      controller: _synastry,
      edition: edition,
      comparison: _comparison,
      retryComparison: start ? compare : null,
      openAccount: widget.openAccount == null
          ? null
          : () {
              if (route.isCurrent) navigator.pop();
              widget.openAccount!();
            },
      openPermissions: links == null
          ? null
          : () => unawaited(
              links.open(accountDestination(AccountSection.aiPermissions)),
            ),
    );
    route = library
        ? MaterialPageRoute(
            builder: (_) => SynastryRecordStudio(
              controller: _synastry,
              edition: edition,
              currentReading: reading,
            ),
          )
        : synastryReportRoute(context, edition: edition, content: reading);
    _entryRoute = route;
    final closed = navigator.push<void>(route);
    if (start) unawaited(compare());
    await closed;
    await route.completed;
    if (mounted) _entryRoute = null;
  }

  Future<void> _selectPerson(SynastrySide side) async {
    if (_entryRoute != null || _synastry.busy) return;
    final selectingA = side == SynastrySide.a;
    final navigator = Navigator.of(context);
    final route = ModalBottomSheetRoute<_PersonAction>(
      capturedThemes: InheritedTheme.capture(
        from: context,
        to: navigator.context,
      ),
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      constraints: const BoxConstraints(maxWidth: jovianPageWidth),
      builder: (sheetContext) => ListenableBuilder(
        listenable: _synastry,
        builder: (context, _) {
          final current = _synastry.manualProfile(side);
          final isOwner = selectingA && _synastry.aIsOwner;
          final chart = selectingA ? _synastry.a : _synastry.b;
          final canEdit =
              (selectingA || _synastry.allowed) &&
              _synastry.canCalculate &&
              !_synastry.busy;
          return SafeArea(
            top: false,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(sheetContext).height * .78,
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  spacing: 10,
                  children: [
                    Semantics(
                      header: true,
                      child: UiText(
                        selectingA ? '选择 A 方' : '选择 B 方',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    if (selectingA)
                      _personOption(
                        context,
                        selected: isOwner,
                        title: Text(_ownerName(context)),
                        onTap: isOwner || _synastry.busy
                            ? null
                            : () {
                                _synastry.selectOwner();
                                if (_synastry.a != null) navigator.pop();
                              },
                      ),
                    for (final person in _synastry.people(side))
                      _personOption(
                        context,
                        selected: identical(person, current),
                        title: Text(_personName(side, person)),
                        subtitle: _ManualProfileSummary(person),
                        onTap: !canEdit
                            ? null
                            : () {
                                _synastry.selectPerson(side, person);
                                navigator.pop();
                              },
                      ),
                    if (!selectingA) ...[
                      const UiText('盘面在本机计算。生成在线解读时，会发送双方的盘面对照结果。'),
                      CheckboxListTile(
                        value: _synastry.allowed,
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: const UiText('我已获准使用 B 方资料进行本次合盘'),
                        onChanged: (value) =>
                            _synastry.confirmConsent(value == true),
                      ),
                    ],
                    if (isOwner) ...[
                      if (_synastry.member) _ownChartStatus(context),
                      if (current != null) _ManualProfileSummary(current),
                      if (_synastry.member)
                        OutlinedButton(
                          onPressed: _synastry.busy
                              ? null
                              : _synastry.readOwnChart,
                          child: UiText(
                            _synastry.aFromArchive ? '重新读取本人盘面' : '读取本人盘面',
                          ),
                        ),
                      if (_synastry.member &&
                          _offersDestiny &&
                          widget.openDestiny != null)
                        TextButton(
                          onPressed: () => navigator.pop(_PersonAction.destiny),
                          child: const UiText('前往命理'),
                        ),
                      OutlinedButton(
                        onPressed: canEdit
                            ? () => navigator.pop(_PersonAction.own)
                            : null,
                        child: UiText(
                          current == null ? '手动填写 A 方资料' : '修改 A 方资料',
                        ),
                      ),
                    ],
                    if (chart != null) _ChartSummary(chart),
                    FilledButton.icon(
                      onPressed: canEdit
                          ? () => navigator.pop(_PersonAction.add)
                          : null,
                      icon: const Icon(
                        Icons.person_add_alt_1_outlined,
                        size: 18,
                      ),
                      label: UiText(selectingA ? '添加其他人' : '添加对象'),
                    ),
                    if (!isOwner && current != null)
                      TextButton(
                        onPressed: canEdit
                            ? () => navigator.pop(_PersonAction.edit)
                            : null,
                        child: UiText(selectingA ? '修改 A 方资料' : '修改 B 方资料'),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
    _entryRoute = route;
    final action = await navigator.push(route);
    if (!mounted) return;
    _entryRoute = null;
    if (action == _PersonAction.destiny) {
      widget.openDestiny?.call();
    } else if (action != null) {
      await _edit(side, action);
    }
  }

  Widget _personOption(
    BuildContext context, {
    required bool selected,
    required Widget title,
    Widget? subtitle,
    VoidCallback? onTap,
  }) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    selected: selected,
    selectedTileColor: Theme.of(context).colorScheme.primaryContainer,
    leading: const Icon(Icons.person_outline_rounded),
    title: title,
    subtitle: subtitle,
    trailing: Icon(
      selected ? Icons.check_rounded : Icons.chevron_right_rounded,
    ),
    onTap: onTap,
  );

  String _ownerName(BuildContext context) {
    final name = _synastry.ownerName;
    return name.isEmpty ? context.uiLabel('本人') : name;
  }

  String _personName(SynastrySide side, BirthProfile profile) {
    final name = _synastry.personName(side, profile);
    return name.isEmpty ? profile.place.name : name;
  }

  Future<void> _edit(SynastrySide side, _PersonAction action) async {
    final isA = side == SynastrySide.a;
    final owner = action == _PersonAction.own;
    final addPerson = action == _PersonAction.add;
    final current = addPerson ? null : _synastry.manualProfile(side);
    final initial = current == null
        ? const BirthProfileDraft()
        : BirthProfileDraft.fromProfile(current);
    var name = current == null ? '' : _synastry.personName(side, current);
    var submitted = false;
    late final MaterialPageRoute<void> route;
    route = MaterialPageRoute<void>(
      builder: (context) => ListenableBuilder(
        listenable: _synastry,
        builder: (context, _) => Scaffold(
          appBar: AppBar(title: UiText(isA ? 'A 方出生资料' : 'B 方出生资料')),
          body: SafeArea(
            top: false,
            child: ListView(
              padding: jovianPagePadding,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                const UiText('资料在本机排盘，用于本次合盘。'),
                if (isA && !owner) const UiText('请确认已获准使用对方资料。'),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: name,
                  maxLength: 24,
                  enabled: !_synastry.busy,
                  decoration: InputDecoration(
                    labelText: context.uiLabel('称呼（选填）'),
                    counterText: '',
                  ),
                  onChanged: (value) => name = value,
                ),
                const SizedBox(height: 12),
                BirthProfileEditor(
                  loadPlaces: widget.loadPlaces,
                  initialDraft: initial,
                  requireKnownTime: true,
                  busy: _synastry.busy,
                  submitLabel: isA ? '确认A 方资料' : '确认B 方资料',
                  onSubmit: (profile) async {
                    submitted = true;
                    final saved = await _synastry.setManual(
                      side,
                      profile,
                      addPerson: addPerson,
                      asOwner: owner,
                      name: name,
                    );
                    if (saved && route.isCurrent) route.navigator?.pop();
                  },
                ),
                if (_synastry.busy)
                  LinearProgressIndicator(
                    semanticsLabel: context.uiLabel('正在计算盘面'),
                  ),
                if (_synastry.message case final String error when submitted)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Semantics(liveRegion: true, child: UiText(error)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    _entryRoute = route;
    await Navigator.of(context).push(route);
    if (!mounted) return;
    _entryRoute = null;
    if (submitted) _synastry.cancelManualCalculation();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([_synastry, widget.account]),
    builder: (context, _) {
      final first = _synastry.manualProfile(SynastrySide.a);
      final second = _synastry.manualProfile(SynastrySide.b);
      final stageScale = (MediaQuery.sizeOf(context).height / 780).clamp(
        1.025,
        1.10,
      );
      return Scaffold(
        appBar: AppBar(
          title: const UiText('合盘'),
          centerTitle: true,
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                onPressed: () => _openRecords(library: true),
                icon: const Icon(Icons.inventory_2_outlined, size: 19),
                label: const UiText('唱片盒'),
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: LayoutBuilder(
            builder: (context, viewport) => SingleChildScrollView(
              padding: jovianPagePadding,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SynastryPairHeader(
                        stageScale: stageScale,
                        owner: _synastry.aIsOwner || first == null
                            ? _ownerName(context)
                            : _personName(SynastrySide.a, first),
                        partner: second == null
                            ? null
                            : _personName(SynastrySide.b, second),
                        onOwnerPressed: _synastry.busy
                            ? null
                            : () => _selectPerson(SynastrySide.a),
                        onPartnerPressed: _synastry.busy
                            ? null
                            : () => _selectPerson(SynastrySide.b),
                      ),
                      SizedBox(height: 12 * stageScale),
                      SynastryAlbumSelector(
                        selected: _edition,
                        maxRecordSize:
                            (viewport.maxHeight * .43).clamp(150.0, 302.0) *
                            stageScale,
                        onSelected: (edition) {
                          if (edition != _edition)
                            setState(() => _edition = edition);
                        },
                      ),
                      const SizedBox(height: 9),
                      FilledButton.icon(
                        onPressed: _synastry.canCompare
                            ? () => _openRecords(start: true)
                            : null,
                        icon: const Icon(Icons.play_arrow_rounded, size: 21),
                        label: const UiText('开始合盘'),
                      ),
                      if (_synastry.report != null || _synastry.result != null)
                        TextButton(
                          onPressed: _synastry.busy ? null : _openRecords,
                          child: const UiText('查看最近报告'),
                        ),
                      if (_synastry.latestRestoreFailed)
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Semantics(
                              liveRegion: true,
                              child: const UiText('暂时无法读取已存合盘。'),
                            ),
                            TextButton(
                              onPressed: _synastry.busy
                                  ? null
                                  : _synastry.restoreLatest,
                              child: const UiText('重试读取'),
                            ),
                          ],
                        ),
                      if (!_synastry.canCalculate)
                        const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: UiText('当前运行环境暂不支持本机合盘。可使用浏览器完成排盘。'),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
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
        dateText == null ? '已读取最近的命理档案。' : '已读取 {date} 的命理档案。',
      OwnSynastryChartStatus.noArchive => '还没有个人命理档案，可以先测算或手动填写。',
      OwnSynastryChartStatus.missingSnapshot => '最近的命理档案没有结构化盘面，请回命理重新测算。',
      OwnSynastryChartStatus.unknownTime => '最近的命理档案缺少出生时间，请回命理补齐。',
      OwnSynastryChartStatus.failed => '暂时无法读取本人盘面，请重试。',
    };
    return message == null
        ? const SizedBox.shrink()
        : Semantics(
            liveRegion: true,
            child: Text(
              context.uiLabel(message).replaceFirst('{date}', dateText ?? ''),
            ),
          );
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
              context,
              _systems[system]!,
              coverage,
              section['limitation'],
              evidence,
            ),
    ]);
  }

  Widget _comparisonSection(
    BuildContext context,
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
      key: PageStorageKey(name),
      tilePadding: EdgeInsets.zero,
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      title: Text(
        '${context.uiLabel(name)} · ${context.uiLabel(_coverage(coverage))}',
      ),
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

Widget _section(
  BuildContext context,
  String title,
  List<Widget> children, {
  Key? headingKey,
}) => Card(
  margin: EdgeInsets.zero,
  child: Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Semantics(
          key: headingKey,
          container: true,
          header: true,
          child: UiText(title, style: Theme.of(context).textTheme.titleLarge),
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
          Text(
            '${context.uiLabel(value)} ${context.uiLabel(_coverage(status))}',
          ),
    ],
  );
}
