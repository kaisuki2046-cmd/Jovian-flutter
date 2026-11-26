import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/report_body.dart';
import '../../../../ui/theme.dart';
import '../../../destiny/destiny.dart' show DestinyReportText;
import '../../auth/control/account_controller.dart';
import '../control/report_history_controller.dart';
import '../model/report_history.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({
    super.key,
    required this.account,
    this.initialKind = ReportKind.destiny,
  });
  final AccountController account;
  final ReportKind initialKind;

  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  late var _kind = widget.initialKind;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('我的报告')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: widget.account,
        builder: (context, _) {
          final account = widget.account;
          final owner = account.sessionChanging
              ? null
              : account.authorizedSession;
          if (owner == null) {
            return Center(
              child: Padding(
                padding: jovianPagePadding,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    UiText(
                      account.busy
                          ? '正在恢复归档身份…'
                          : account.notice != null
                          ? '暂时无法恢复归档身份。'
                          : '登录或恢复游客会话后，可以查看报告。',
                      textAlign: TextAlign.center,
                    ),
                    if (!account.busy && account.notice != null)
                      TextButton(
                        onPressed: account.initialize,
                        child: const UiText('重新连接'),
                      ),
                  ],
                ),
              ),
            );
          }
          return _ReportCategories(
            key: ValueKey((account, owner.scope)),
            account: account,
            owner: owner.id,
            scope: owner.scope,
            kind: _kind,
            onSelected: (kind) => setState(() => _kind = kind),
          );
        },
      ),
    ),
  );
}

class _ReportCategories extends StatefulWidget {
  const _ReportCategories({
    super.key,
    required this.account,
    required this.owner,
    required this.scope,
    required this.kind,
    required this.onSelected,
  });

  final AccountController account;
  final String owner;
  final String scope;
  final ReportKind kind;
  final ValueChanged<ReportKind> onSelected;

  @override
  State<_ReportCategories> createState() => _ReportCategoriesState();
}

class _ReportCategoriesState extends State<_ReportCategories> {
  final _histories = <ReportKind, ReportHistoryController>{};

  @override
  void initState() {
    super.initState();
    _openSelectedCategory();
  }

  @override
  void didUpdateWidget(covariant _ReportCategories oldWidget) {
    super.didUpdateWidget(oldWidget);
    _openSelectedCategory();
  }

  void _openSelectedCategory() {
    _histories.putIfAbsent(
      widget.kind,
      () => ReportHistoryController(
        widget.account.reports,
        widget.owner,
        widget.kind,
        _recheckAccount,
      ),
    );
  }

  Future<void> _recheckAccount() {
    for (final history in _histories.values) {
      history.lock();
    }
    return widget.account.initialize();
  }

  @override
  void dispose() {
    for (final history in _histories.values) {
      history.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Wrap(
          spacing: 8,
          children: [
            for (final kind in ReportKind.values)
              ChoiceChip(
                label: UiText(kind.label),
                selected: kind == widget.kind,
                onSelected: (selected) {
                  if (selected) widget.onSelected(kind);
                },
              ),
          ],
        ),
      ),
      Expanded(
        child: IndexedStack(
          index: widget.kind.index,
          children: [
            for (final kind in ReportKind.values)
              if (_histories[kind] case final history?)
                TickerMode(
                  enabled: kind == widget.kind,
                  child: ExcludeFocus(
                    excluding: kind != widget.kind,
                    child: _Category(
                      account: widget.account,
                      scope: widget.scope,
                      history: history,
                    ),
                  ),
                )
              else
                const SizedBox.shrink(),
          ],
        ),
      ),
    ],
  );
}

class _Category extends StatelessWidget {
  const _Category({
    required this.account,
    required this.scope,
    required this.history,
  });

  final AccountController account;
  final String scope;
  final ReportHistoryController history;

  Future<void> _read(BuildContext context, ReportEntry entry) async {
    if (history.locked || history.selected != null) return;
    unawaited(history.select(entry.id));
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _ReportReader(
          account: account,
          scope: scope,
          history: history,
          entry: entry,
        ),
      ),
    );
    if (context.mounted && !history.disposed) history.closeDetail();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: history,
    builder: (context, _) {
      if (history.locked) {
        return Center(
          child: TextButton(
            onPressed: history.refresh,
            child: const UiText('会话已变化，重新读取'),
          ),
        );
      }
      final page = history.page;
      final error = history.listError;
      return RefreshIndicator(
        onRefresh: history.refresh,
        child: ListView(
          primary: false,
          padding: jovianPagePadding,
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (page == null)
              if (error != null)
                _ReportListError(message: error, retry: history.refresh)
              else
                const LinearProgressIndicator(),
            if (page != null) ...[
              if (page.entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: UiText('暂无已保存的报告。'),
                ),
              for (final entry in page.entries)
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: Text(entry.title),
                    subtitle: Text(_date(context, entry.savedAt)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _read(context, entry),
                  ),
                ),
              if (history.loading)
                const LinearProgressIndicator()
              else if (error != null)
                _ReportListError(message: error, retry: history.more)
              else if (page.nextCursor != null)
                TextButton(
                  onPressed: history.more,
                  child: const UiText('加载更多'),
                ),
              TextButton(
                onPressed: history.loading ? null : history.refresh,
                child: const UiText('刷新报告'),
              ),
            ],
          ],
        ),
      );
    },
  );
}

class _ReportListError extends StatelessWidget {
  const _ReportListError({required this.message, required this.retry});

  final String message;
  final VoidCallback retry;

  @override
  Widget build(BuildContext context) => ListTile(
    title: UiText(message),
    trailing: TextButton(onPressed: retry, child: const UiText('重试')),
  );
}

class _ReportReader extends StatelessWidget {
  const _ReportReader({
    required this.account,
    required this.scope,
    required this.history,
    required this.entry,
  });

  final AccountController account;
  final String scope;
  final ReportHistoryController history;
  final ReportEntry entry;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('报告详情')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          if (account.sessionChanging ||
              account.authorizedSession?.scope != scope ||
              history.disposed) {
            return const Center(child: UiText('会话已变化，请返回后重新读取。'));
          }
          return ListenableBuilder(
            listenable: history,
            builder: (context, _) {
              if (history.locked) {
                return const Center(child: UiText('会话已变化，请返回后重新读取。'));
              }
              final report = history.report;
              final header = report?.entry ?? entry;
              return ListView(
                padding: jovianPagePadding,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      header.title,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  Text(_date(context, header.calculatedAt)),
                  const SizedBox(height: 12),
                  if (report != null)
                    history.kind == ReportKind.destiny
                        ? DestinyReportText(report.body)
                        : ReportBody(report.body)
                  else if (history.detailError case final error?)
                    ListTile(
                      title: UiText(error),
                      trailing: TextButton(
                        onPressed: () => history.select(entry.id),
                        child: const UiText('重试读取'),
                      ),
                    )
                  else
                    Semantics(liveRegion: true, child: const UiText('正在读取报告…')),
                ],
              );
            },
          );
        },
      ),
    ),
  );
}

String _date(BuildContext context, DateTime time) {
  final local = time.toLocal();
  final format = MaterialLocalizations.of(context);
  return '${format.formatMediumDate(local)} ${format.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}
