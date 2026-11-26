import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/report_body.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../control/fortune_page_controller.dart';
import '../model/online_fortune.dart';
import 'fortune_interpretation.dart';

class FortuneReportHistory extends StatefulWidget {
  const FortuneReportHistory({
    super.key,
    required this.account,
    required this.owner,
    required this.scope,
    required this.fortune,
  });

  final AccountController account;
  final String owner;
  final String scope;
  final FortunePageController fortune;

  @override
  State<FortuneReportHistory> createState() => _FortuneReportHistoryState();
}

class _FortuneReportHistoryState extends State<FortuneReportHistory> {
  late final _history = ReportHistoryController(
    widget.account.reports,
    widget.owner,
    ReportKind.fortune,
    widget.account.initialize,
  );

  bool get _isCurrent =>
      _ownsScope(widget.account, widget.scope) && !_history.locked;

  Future<void> _open(ReportEntry entry) async {
    if (!_isCurrent || _history.selected != null) return;
    unawaited(_history.select(entry.id));
    await Navigator.of(
      context,
    ).push<void>(MaterialPageRoute(builder: (_) => _reader(entry)));
    if (mounted) _history.closeDetail();
  }

  Widget _reader(ReportEntry entry) => Scaffold(
    appBar: AppBar(title: const UiText('运势解读')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([widget.account, _history]),
        builder: (context, _) {
          if (!_isCurrent) return _unavailable;
          if (_history.detailError case final error?) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error),
                  TextButton(
                    onPressed: () => _history.select(entry.id),
                    child: const UiText('重试读取'),
                  ),
                ],
              ),
            );
          }
          if (_history.report case final report?) {
            return _SavedFortuneReport(
              key: ValueKey(report.entry.id),
              report: report,
              fortune: widget.fortune,
            );
          }
          return const Center(
            child: CircularProgressIndicator(semanticsLabel: '正在读取运势报告'),
          );
        },
      ),
    ),
  );

  @override
  void dispose() {
    _history.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([widget.account, _history]),
    builder: (context, _) {
      final page = _history.page;
      final format = MaterialLocalizations.of(context);
      return Scaffold(
        appBar: AppBar(
          title: const UiText('运势报告历史'),
          actions: [
            IconButton(
              tooltip: '刷新运势报告',
              onPressed:
                  !_ownsScope(widget.account, widget.scope) || _history.loading
                  ? null
                  : _history.refresh,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: !_isCurrent
              ? _unavailable
              : RefreshIndicator(
                  onRefresh: _history.refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: jovianPagePadding,
                    children: [
                      if (_history.loading)
                        const LinearProgressIndicator(
                          semanticsLabel: '正在读取运势报告历史',
                        ),
                      if (_history.listError case final error?)
                        ListTile(
                          title: Text(error),
                          trailing: TextButton(
                            onPressed: _history.refresh,
                            child: const UiText('重试'),
                          ),
                        ),
                      if (page != null) ...[
                        if (page.entries.isEmpty) const Text('暂无已保存的运势报告。'),
                        for (final entry in page.entries)
                          Card(
                            child: ListTile(
                              leading: const Icon(Icons.article_outlined),
                              title: Text(entry.title),
                              subtitle: Text(
                                format.formatCompactDate(
                                      entry.savedAt.toLocal(),
                                    ) +
                                    ' · ' +
                                    format.formatTimeOfDay(
                                      TimeOfDay.fromDateTime(
                                        entry.savedAt.toLocal(),
                                      ),
                                      alwaysUse24HourFormat: true,
                                    ),
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => _open(entry),
                            ),
                          ),
                        if (page.nextCursor != null)
                          TextButton(
                            onPressed: _history.loading ? null : _history.more,
                            child: const UiText('加载更多'),
                          ),
                      ],
                    ],
                  ),
                ),
        ),
      );
    },
  );
}

bool _ownsScope(AccountController account, String scope) =>
    !account.sessionChanging && account.authorizedSession?.scope == scope;

const _unavailable = Center(child: Text('当前账号会话已变化，请返回周期运势。'));

class _SavedFortuneReport extends StatefulWidget {
  const _SavedFortuneReport({
    super.key,
    required this.report,
    required this.fortune,
  });

  final ArchivedReport report;
  final FortunePageController fortune;

  @override
  State<_SavedFortuneReport> createState() => _SavedFortuneReportState();
}

class _SavedFortuneReportState extends State<_SavedFortuneReport> {
  final _cancel = Completer<void>();
  late final _window = widget.fortune.archivedDates(widget.report);
  Future<List<FortuneAdviceGroup>>? _advice;

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }

  void _readAdvice() => setState(() {
    _advice = widget.fortune.readArchivedAdvice(widget.report, _cancel.future);
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final report = widget.report;
    return ListView(
      padding: jovianPagePadding,
      children: [
        Semantics(
          header: true,
          child: Text(report.entry.title, style: theme.titleLarge),
        ),
        FutureBuilder(
          future: _window,
          builder: (context, snapshot) {
            final dates = snapshot.data;
            if (dates == null) return const SizedBox.shrink();
            final first = _date(dates.first);
            final last = _date(dates.last);
            return Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${first == last ? first : '$first 至 $last'} · ${dates.zone}',
                style: theme.bodySmall,
              ),
            );
          },
        ),
        UiText('已存档', style: theme.bodySmall),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: ReportBody(report.body),
          ),
        ),
        if (widget.fortune.canReadArchivedAdvice(report)) ...[
          const SizedBox(height: 12),
          FutureBuilder(
            future: _advice,
            builder: (context, snapshot) => FortuneAdvice(
              onRequest: _readAdvice,
              groups: snapshot.data,
              loading: snapshot.connectionState == ConnectionState.waiting,
              error: snapshot.hasError ? '暂时无法获取这份报告的提运建议。' : null,
            ),
          ),
        ],
      ],
    );
  }
}

String _date(DateTime time) => '${time.year}年${time.month}月${time.day}日';
