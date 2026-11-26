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
import 'fortune_interpretation.dart';
import 'fortune_report_history.dart';

class FortunePage extends StatelessWidget {
  const FortunePage({
    super.key,
    required this.loadDisplay,
    this.readServerTime,
    this.account,
    this.archiveId,
    this.connectOnline,
    this.local = const FortuneLocal(),
  });

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? archiveId;
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
    archiveId: archiveId,
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
    required this.archiveId,
    required this.connectOnline,
    required this.local,
  });

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? ownerId;
  final String? archiveId;
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
      online: widget.connectOnline?.call(),
      local: widget.local,
    )..initialize();
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
          TextButton(
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
            child: const UiText('历法查询'),
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
              Row(
                spacing: 4,
                children: [
                  for (final (index, period) in FortunePeriod.values.indexed)
                    Expanded(
                      child: ChoiceChip(
                        showCheckmark: false,
                        label: Text(const ['今日', '本周', '本月', '本年'][index]),
                        selected: _fortune.displayedPeriod == period,
                        onSelected: (_) => _fortune.selectPeriod(period),
                      ),
                    ),
                ],
              ),
              if (_fortune.syncingTime || _fortune.loadingPreview)
                const LinearProgressIndicator(),
              _dateControls(context),
              if (_fortune.ownerId != null) ...[
                _archives(context),
                if (_fortune.online != null && _fortune.hasChart)
                  FortuneInterpretation(
                    key: ValueKey((
                      FortuneInterpretation,
                      _fortune.displayedWindow?.contextKey,
                    )),
                    fortune: _fortune,
                  ),
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
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton(
                    onPressed: _openHistory,
                    child: const UiText('运势报告历史'),
                  ),
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

  void _openHistory() {
    final account = widget.account!;
    final session = account.authorizedSession;
    if (account.sessionChanging ||
        session == null ||
        session.id != widget.ownerId)
      return;
    Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => FortuneReportHistory(
          account: account,
          owner: session.id,
          scope: session.scope,
          fortune: _fortune,
        ),
      ),
    );
  }

  Widget _dateControls(BuildContext context) {
    final window = _fortune.preview?.window;
    final display = _fortune.display;
    final prepared = _fortune.displayedWindow;
    final start = prepared == null
        ? (window == null ? null : _date(display!.clock(window.start)))
        : _date(
            DateTime.parse(
              '${prepared.firstDate}T00:00:00Z',
            ).millisecondsSinceEpoch,
          );
    final end = prepared == null
        ? (window == null ? null : _date(display!.clock(window.end - 1)))
        : _date(
            DateTime.parse(
              '${prepared.lastDate}T00:00:00Z',
            ).millisecondsSinceEpoch,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (start != null)
          Text(
            start == end ? start : '$start 至 $end',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        if (display != null)
          Text(
            '日期时区 ${_fortune.displayedZone}${_fortune.usingFallbackTime ? ' · 暂用设备时间' : ''}',
          ),
        if (_fortune.clockError case final error?) Text(error),
        if (_fortune.previewError case final error?)
          Semantics(liveRegion: true, child: Text(error)),
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
              Semantics(liveRegion: true, child: Text(error)),
              if (_fortune.selectedArchiveMissing && Navigator.canPop(context))
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const UiText('返回命理'),
                ),
              if (!_fortune.selectedArchiveMissing)
                TextButton(
                  onPressed: _fortune.readArchive,
                  child: const Text('重新读取'),
                ),
            ],
          ),
        if (_fortune.loadingReport && !_fortune.hasChart)
          const Text('正在读取已保存的报告…'),
        if (_fortune.reportError case final error?
            when _fortune.online == null || !_fortune.hasChart)
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(error),
              TextButton(
                onPressed: () => _fortune.readReport(retry: true),
                child: const Text('重试报告'),
              ),
            ],
          ),
        if (_fortune.savedReport case final saved?)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    saved.entry.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const UiText('已存档'),
                  ReportBody(saved.body),
                ],
              ),
            ),
          ),
      ],
    );
  }
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
            Text('${current.year}年 · ${current.month}月 · ${current.day}日'),
            if (current.tenGod case final god?) Text('与本命日干的关系 $god'),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const UiText('查看周期变化'),
              children: [
                for (final event in preview.events)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(event.reason),
                    subtitle: Text(
                      '${_date(clock(event.at))} ${_clock(clock(event.at))} · ${event.year}年 ${event.month}月 ${event.day}日',
                    ),
                    trailing: event.tenGod == null ? null : Text(event.tenGod!),
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
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UiText('黄历', style: Theme.of(context).textTheme.titleMedium),
          Text('${day.date} 北京时间 · ${day.lunarDate} · ${day.dayPillar}日'),
          Text(
            '值日 ${day.officer}${day.solarTerm == null ? '' : ' · ${day.solarTerm}'}',
          ),
          if (day.yi.isNotEmpty) Text('宜 ${day.yi.join('、')}'),
          if (day.ji.isNotEmpty) Text('忌 ${day.ji.join('、')}'),
        ],
      ),
    ),
  );
}

String _date(int wall) {
  final d = DateTime.fromMillisecondsSinceEpoch(wall, isUtc: true);
  return '${d.year}年${d.month}月${d.day}日';
}

String _clock(int wall) {
  final d = DateTime.fromMillisecondsSinceEpoch(wall, isUtc: true);
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(d.hour)}:${two(d.minute)}';
}
