import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/report_body.dart';
import '../../../ui/theme.dart';
import '../../account/account.dart';
import '../control/fortune_page_controller.dart';
import '../model/online_fortune.dart';
import 'fortune_display_labels.dart';
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
  ReportHistoryController? _history;
  bool _expanded = false;
  bool _readerOpen = false;
  int? _loadedRevision;

  bool get _hasScope => _ownsScope(widget.account, widget.scope);

  @override
  void didUpdateWidget(covariant FortuneReportHistory oldWidget) {
    super.didUpdateWidget(oldWidget);
    _refreshAfterSave();
  }

  void _toggleHistory() => setState(() {
    _expanded = !_expanded;
    if (!_expanded) return;
    if (_history == null) {
      _loadedRevision = widget.fortune.archiveSaveRevision;
      _history = ReportHistoryController(
        widget.account.reports,
        widget.owner,
        ReportKind.fortune,
        widget.account.initialize,
      );
    } else {
      _refreshAfterSave();
    }
  });

  void _refreshAfterSave() {
    final history = _history;
    final revision = widget.fortune.archiveSaveRevision;
    if (!_expanded ||
        _readerOpen ||
        history == null ||
        !_hasScope ||
        _loadedRevision == revision) {
      return;
    }
    _loadedRevision = revision;
    unawaited(history.refresh());
  }

  Future<void> _open(ReportEntry entry, ReportHistoryController history) async {
    if (!_hasScope || history.locked || _readerOpen) return;
    _readerOpen = true;
    unawaited(history.select(entry.id));
    final route = MaterialPageRoute<void>(
      builder: (_) => _reader(entry, history),
    );
    await Navigator.of(context).push(route);
    await route.completed;
    _readerOpen = false;
    if (mounted) {
      history.closeDetail();
      _refreshAfterSave();
    } else {
      history.dispose();
    }
  }

  Widget _reader(ReportEntry entry, ReportHistoryController history) =>
      Scaffold(
        appBar: AppBar(title: const UiText('运势解读')),
        body: SafeArea(
          top: false,
          child: ListenableBuilder(
            listenable: Listenable.merge([widget.account, history]),
            builder: (context, _) {
              if (!_hasScope || history.locked) return _unavailable;
              if (history.detailError case final error?) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      UiText(error),
                      TextButton(
                        onPressed: () => history.select(entry.id),
                        child: const UiText('重试读取'),
                      ),
                    ],
                  ),
                );
              }
              if (history.report case final report?) {
                return _SavedFortuneReport(
                  key: ValueKey(report.entry.id),
                  report: report,
                  fortune: widget.fortune,
                );
              }
              return Center(
                child: CircularProgressIndicator(
                  semanticsLabel: context.uiLabel('正在读取运势报告'),
                ),
              );
            },
          ),
        ),
      );

  @override
  void dispose() {
    // The reader still listens until its route finishes closing.
    if (!_readerOpen) _history?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        expanded: _expanded,
        child: TextButton.icon(
          onPressed: _hasScope ? _toggleHistory : null,
          icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
          label: UiText(_expanded ? '收起已存解读' : '查看已存解读'),
        ),
      ),
      if (_expanded) _entries(_history!),
    ],
  );

  Widget _entries(ReportHistoryController history) => ListenableBuilder(
    listenable: history,
    builder: (context, _) {
      if (!_hasScope) return _unavailable;
      if (history.locked) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const UiText('暂时无法读取存档。'),
            TextButton(onPressed: history.refresh, child: const UiText('重试')),
          ],
        );
      }
      final page = history.page;
      final format = MaterialLocalizations.of(context);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (history.loading)
            LinearProgressIndicator(
              semanticsLabel: context.uiLabel('正在读取运势报告历史'),
            ),
          if (history.listError case final error?)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                UiText(error),
                TextButton(
                  onPressed: history.refresh,
                  child: const UiText('重试'),
                ),
              ],
            ),
          if (page != null) ...[
            if (!history.loading && page.entries.isEmpty)
              const UiText('暂无已保存的运势报告。'),
            for (final entry in page.entries)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.article_outlined),
                  title: Text(entry.title),
                  subtitle: Text(
                    format.formatCompactDate(entry.savedAt.toLocal()) +
                        ' · ' +
                        format.formatTimeOfDay(
                          TimeOfDay.fromDateTime(entry.savedAt.toLocal()),
                          alwaysUse24HourFormat: true,
                        ),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _open(entry, history),
                ),
              ),
            Wrap(
              children: [
                if (page.nextCursor != null)
                  TextButton(
                    onPressed: history.loading ? null : history.more,
                    child: const UiText('加载更多'),
                  ),
                if (history.listError == null)
                  TextButton(
                    onPressed: history.loading ? null : history.refresh,
                    child: const UiText('刷新运势报告'),
                  ),
              ],
            ),
          ],
        ],
      );
    },
  );
}

bool _ownsScope(AccountController account, String scope) =>
    !account.sessionChanging && account.authorizedSession?.scope == scope;

const _unavailable = Center(child: UiText('当前账号会话已变化，请返回周期运势。'));

class FortuneArchiveDates extends StatefulWidget {
  const FortuneArchiveDates({
    super.key,
    required this.report,
    required this.fortune,
  });

  final ArchivedReport report;
  final FortunePageController fortune;

  @override
  State<FortuneArchiveDates> createState() => _FortuneArchiveDatesState();
}

class _FortuneArchiveDatesState extends State<FortuneArchiveDates> {
  late final _window = widget.fortune.archivedDates(widget.report);

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _window,
    builder: (context, snapshot) {
      final dates = snapshot.data;
      if (dates == null) return const SizedBox.shrink();
      final first = fortuneDateLabel(context, dates.first);
      final last = fortuneDateLabel(context, dates.last);
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          '${fortuneDateRange(context, first, last)} · ${dates.zone}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      );
    },
  );
}

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
        FortuneArchiveDates(report: report, fortune: widget.fortune),
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
