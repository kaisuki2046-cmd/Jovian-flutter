import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../../ui/report_body.dart';
import '../../../../ui/theme.dart';
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
    appBar: AppBar(title: const Text('我的报告')),
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
                    Text(
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
                        child: const Text('重新连接'),
                      ),
                  ],
                ),
              ),
            );
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Wrap(
                  spacing: 8,
                  children: [
                    for (final kind in ReportKind.values)
                      ChoiceChip(
                        label: Text(kind.label),
                        selected: kind == _kind,
                        onSelected: (_) => setState(() => _kind = kind),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: _Category(
                  key: ValueKey('${owner.scope}:${_kind.name}'),
                  account: account,
                  owner: owner.id,
                  scope: owner.scope,
                  kind: _kind,
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

class _Category extends StatefulWidget {
  const _Category({
    super.key,
    required this.account,
    required this.owner,
    required this.scope,
    required this.kind,
  });
  final AccountController account;
  final String owner;
  final String scope;
  final ReportKind kind;

  @override
  State<_Category> createState() => _CategoryState();
}

class _CategoryState extends State<_Category> {
  late final _history = ReportHistoryController(
    widget.account.reports,
    widget.owner,
    widget.kind,
    widget.account.initialize,
  );

  @override
  void dispose() {
    _history.dispose();
    super.dispose();
  }

  Future<void> _read(ReportEntry entry) async {
    if (_history.selected != null) return;
    unawaited(_history.select(entry.id));
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _ReportReader(
          account: widget.account,
          scope: widget.scope,
          history: _history,
          entry: entry,
        ),
      ),
    );
    if (mounted) _history.closeDetail();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _history,
    builder: (context, _) {
      if (_history.locked) {
        return Center(
          child: TextButton(
            onPressed: _history.refresh,
            child: const Text('会话已变化，重新读取'),
          ),
        );
      }
      return RefreshIndicator(
        onRefresh: _history.refresh,
        child: ListView(
          padding: jovianPagePadding,
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (_history.loading) const LinearProgressIndicator(),
            if (_history.listError case final error?)
              ListTile(
                title: Text(error),
                trailing: TextButton(
                  onPressed: _history.refresh,
                  child: const Text('重试'),
                ),
              ),
            if (_history.page case final page?) ...[
              if (page.entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('暂无已保存的报告。'),
                ),
              for (final entry in page.entries)
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: Text(entry.title),
                    subtitle: Text(_date(context, entry.savedAt)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _read(entry),
                  ),
                ),
              if (page.nextCursor != null)
                TextButton(
                  onPressed: _history.loading ? null : _history.more,
                  child: const Text('加载更多'),
                ),
              TextButton(
                onPressed: _history.loading ? null : _history.refresh,
                child: const Text('刷新报告'),
              ),
            ],
          ],
        ),
      );
    },
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
    appBar: AppBar(title: const Text('报告详情')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          if (account.sessionChanging ||
              account.authorizedSession?.scope != scope ||
              history.disposed) {
            return const Center(child: Text('会话已变化，请返回后重新读取。'));
          }
          return ListenableBuilder(
            listenable: history,
            builder: (context, _) {
              if (history.locked) {
                return const Center(child: Text('会话已变化，请返回后重新读取。'));
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
                    ReportBody(report.body)
                  else if (history.detailError case final error?)
                    ListTile(
                      title: Text(error),
                      trailing: TextButton(
                        onPressed: () => history.select(entry.id),
                        child: const Text('重试读取'),
                      ),
                    )
                  else
                    Semantics(liveRegion: true, child: const Text('正在读取报告…')),
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
