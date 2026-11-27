import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/report_body.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../control/fortune_local.dart';
import '../control/fortune_online.dart';
import '../control/fortune_page_controller.dart';
import 'fortune_calendar_page.dart';
import 'fortune_display_labels.dart';
import 'fortune_interpretation.dart';
import 'fortune_report_history.dart';

class FortunePage extends StatelessWidget {
  const FortunePage({
    super.key,
    required this.loadDisplay,
    this.readServerTime,
    this.account,
    this.archiveId,
    this.restoredPeriod,
    this.openAiPermissions,
    this.connectOnline,
    this.local = const FortuneLocal(),
  });

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? archiveId;
  final FortunePeriod? restoredPeriod;
  final ValueChanged<FortunePeriod>? openAiPermissions;
  final FortuneOnline? Function()? connectOnline;
  final FortuneLocal local;

  @override
  Widget build(BuildContext context) {
    final accounts = account;
    if (accounts == null) return _session(null, null);
    return ListenableBuilder(
      listenable: accounts,
      builder: (context, _) {
        final owner = accounts.sessionChanging
            ? null
            : accounts.authorizedSession;
        return _session(owner?.id, owner?.scope);
      },
    );
  }

  Widget _session(String? owner, String? scope) => _FortuneSession(
    key: ValueKey((scope, archiveId)),
    loadDisplay: loadDisplay,
    readServerTime: readServerTime,
    account: account,
    ownerId: owner,
    scope: scope,
    archiveId: archiveId,
    restoredPeriod: restoredPeriod,
    openAiPermissions: openAiPermissions,
    connectOnline: connectOnline,
    local: local,
  );
}

class _FortuneSession extends StatefulWidget {
  const _FortuneSession({
    super.key,
    required this.loadDisplay,
    required this.readServerTime,
    required this.account,
    required this.ownerId,
    required this.scope,
    required this.archiveId,
    required this.restoredPeriod,
    required this.openAiPermissions,
    required this.connectOnline,
    required this.local,
  });

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? ownerId;
  final String? scope;
  final String? archiveId;
  final FortunePeriod? restoredPeriod;
  final ValueChanged<FortunePeriod>? openAiPermissions;
  final FortuneOnline? Function()? connectOnline;
  final FortuneLocal local;

  @override
  State<_FortuneSession> createState() => _FortuneSessionState();
}

class _FortuneSessionState extends State<_FortuneSession> {
  late final FortunePageController _fortune;

  @override
  void initState() {
    super.initState();
    _fortune = FortunePageController(
      loadDisplay: widget.loadDisplay,
      readServerTime: widget.readServerTime,
      account: widget.account,
      ownerId: widget.ownerId,
      archiveId: widget.archiveId,
      initialPeriod: widget.restoredPeriod,
      online: widget.connectOnline?.call(),
      local: widget.local,
    )..initialize();
  }

  @override
  void didUpdateWidget(covariant _FortuneSession oldWidget) {
    super.didUpdateWidget(oldWidget);
    final period = widget.restoredPeriod;
    if (period != null &&
        period != oldWidget.restoredPeriod &&
        period != _fortune.period) {
      _fortune.selectPeriod(period);
    }
  }

  void _openAiPermissions(BuildContext context) {
    if (widget.openAiPermissions case final open?) {
      open(_fortune.period);
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => AccountPrivacyPage(
          account: widget.account!,
          onlyAiPermissions: true,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _fortune.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _fortune,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        title: const UiText('周期运势'),
        actions: [
          IconButton(
            tooltip: context.uiLabel('历法查询'),
            onPressed: () {
              final instant = _fortune.referenceTime ?? DateTime.now();
              Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => FortuneCalendarPage(
                    reference: fortuneReferenceFields(
                      instant.millisecondsSinceEpoch,
                    ),
                    local: widget.local,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.calendar_month_outlined),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: jovianPagePadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final (index, period) in FortunePeriod.values.indexed)
                    ChoiceChip(
                      showCheckmark: false,
                      label: UiText(const ['今日', '本周', '本月', '本年'][index]),
                      selected: _fortune.displayedPeriod == period,
                      onSelected: (_) => _fortune.selectPeriod(period),
                    ),
                ],
              ),
              if (_fortune.syncingTime || _fortune.loadingPreview)
                const LinearProgressIndicator(),
              _dateControls(context),
              if (widget.scope case final scope?) ...[
                _archives(context),
                if (_fortune.hasChart)
                  FortuneInterpretation(
                    key: ValueKey((
                      FortuneInterpretation,
                      _fortune.displayedWindow?.contextKey,
                    )),
                    fortune: _fortune,
                    openAiPermissions: () => _openAiPermissions(context),
                  ),
                if (_fortune.savedReport case final saved?)
                  _savedArchive(context, saved),
                if (_fortune.online != null &&
                    _fortune.hasChart &&
                    _fortune.displayedPeriod == FortunePeriod.day)
                  FortuneAdvice(
                    key: ValueKey((
                      FortuneAdvice,
                      _fortune.published?.runId ??
                          _fortune.displayedWindow?.contextKey,
                    )),
                    onRequest:
                        _fortune.busy ||
                            (!_fortune.canGenerate &&
                                _fortune.published == null)
                        ? null
                        : _fortune.getAdvice,
                    groups: _fortune.advice,
                    loading: _fortune.loadingAdvice,
                    error: _fortune.adviceError,
                  ),
                FortuneReportHistory(
                  account: widget.account!,
                  owner: widget.ownerId!,
                  scope: scope,
                  fortune: _fortune,
                ),
              ] else
                const UiText('登录或进入游客体验后，可以保存并查看运势解读。'),
              if (_fortune.online == null) ...[
                if (_fortune.preview case final preview?)
                  _PreviewCard(
                    preview: preview,
                    clock: _fortune.display!.clock,
                  ),
                if (_fortune.almanac case final day?) _AlmanacCard(day: day),
              ],
            ],
          ),
        ),
      ),
    ),
  );

  Widget _dateControls(BuildContext context) {
    final window = _fortune.preview?.window;
    final display = _fortune.display;
    final prepared = _fortune.displayedWindow;
    final dates = prepared != null
        ? (
            DateTime.parse('${prepared.firstDate}T00:00:00Z'),
            DateTime.parse('${prepared.lastDate}T00:00:00Z'),
          )
        : window != null
        ? (
            _wallDate(display!.clock(window.start)),
            _wallDate(display.clock(window.end - 1)),
          )
        : null;
    final timeZone = [
      '${context.uiLabel('日期时区')} ${_fortune.displayedZone}',
      if (_fortune.usingFallbackTime) context.uiLabel('暂用设备时间'),
    ].join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (dates != null)
          Text(
            fortuneDateRange(
              context,
              fortuneDateLabel(context, dates.$1),
              fortuneDateLabel(context, dates.$2),
            ),
            style: Theme.of(context).textTheme.titleMedium,
          ),
        if (display != null) Text(timeZone),
        if (_fortune.clockError case final error?) UiText(error),
        if (_fortune.previewError case final error?)
          Semantics(liveRegion: true, child: UiText(error)),
        TextButton(
          onPressed: _fortune.syncingTime || _fortune.loadingPreview
              ? null
              : _fortune.refreshTime,
          child: const UiText('刷新日期'),
        ),
      ],
    );
  }

  Widget _archives(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_fortune.loadingArchive) const UiText('正在读取命理档案…'),
        if (_fortune.archiveError case final error?)
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Semantics(liveRegion: true, child: UiText(error)),
              if (_fortune.selectedArchiveMissing && Navigator.canPop(context))
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const UiText('返回命理'),
                ),
              if (!_fortune.selectedArchiveMissing)
                TextButton(
                  onPressed: _fortune.readArchive,
                  child: const UiText('重新读取'),
                ),
            ],
          ),
        if (_fortune.loadingReport && !_fortune.hasChart)
          const UiText('正在读取已保存的报告…'),
        if (_fortune.reportError case final error?
            when _fortune.online == null || !_fortune.hasChart)
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              UiText(error),
              TextButton(
                onPressed: () => _fortune.readReport(retry: true),
                child: const UiText('重试报告'),
              ),
            ],
          ),
      ],
    );
  }

  Widget _savedArchive(BuildContext context, ArchivedReport saved) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(
              saved.entry.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          FortuneArchiveDates(
            key: ValueKey(saved.entry.id),
            report: saved,
            fortune: _fortune,
          ),
          const UiText('已存档'),
          ReportBody(saved.body),
        ],
      ),
    ),
  );
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.preview, required this.clock});
  final FortunePreview preview;
  final int Function(int) clock;

  @override
  Widget build(BuildContext context) {
    final current = preview.current;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UiText('参考干支', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              fortunePillarLabels(
                context,
                current.year,
                current.month,
                current.day,
              ),
            ),
            if (current.tenGod case final god?)
              Text('${context.uiLabel('与本命日干的关系')} $god'),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const UiText('查看周期变化'),
              children: [
                for (final event in preview.events)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(event.reason),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_previewTime(context, _wallDate(clock(event.at)))),
                        Text(
                          fortunePillarLabels(
                            context,
                            event.year,
                            event.month,
                            event.day,
                          ),
                        ),
                        if (event.tenGod case final relation?) Text(relation),
                      ],
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

class _AlmanacCard extends StatelessWidget {
  const _AlmanacCard({required this.day});
  final AlmanacDay day;

  @override
  Widget build(BuildContext context) {
    final separator = context.uiLanguage == InterfaceLanguage.english
        ? ', '
        : '、';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UiText('黄历', style: Theme.of(context).textTheme.titleMedium),
            Text(
              [
                '${day.date} ${context.uiLabel('北京时间')}',
                day.lunarDate,
                context.uiLanguage == InterfaceLanguage.chinese
                    ? '${day.dayPillar}日'
                    : '${context.uiLabel('日柱')} ${day.dayPillar}',
              ].join(' · '),
            ),
            Text(
              '${context.uiLabel('值日')} ${day.officer}${day.solarTerm == null ? '' : ' · ${day.solarTerm}'}',
            ),
            if (day.yi.isNotEmpty)
              Text('${context.uiLabel('宜')} ${day.yi.join(separator)}'),
            if (day.ji.isNotEmpty)
              Text('${context.uiLabel('忌')} ${day.ji.join(separator)}'),
          ],
        ),
      ),
    );
  }
}

DateTime _wallDate(int wall) =>
    DateTime.fromMillisecondsSinceEpoch(wall, isUtc: true);

String _previewTime(BuildContext context, DateTime wall) {
  final time = MaterialLocalizations.of(
    context,
  ).formatTimeOfDay(TimeOfDay.fromDateTime(wall), alwaysUse24HourFormat: true);
  return '${fortuneDateLabel(context, wall)} $time';
}
