import 'package:material_ui/material_ui.dart';

import '../../../../ui/report_body.dart';
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
                padding: const EdgeInsets.all(24),
                child: Text(account.busy ? '正在恢复归档身份…' : '登录或恢复游客会话后，可以查看报告。'),
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
    required this.kind,
  });
  final AccountController account;
  final String owner;
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
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
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
                padding: EdgeInsets.all(16),
                child: Text('暂无已保存的报告。'),
              ),
            for (final entry in page.entries)
              ListTile(
                title: Text(entry.title),
                subtitle: Text(_date(context, entry.calculatedAt)),
                selected: _history.selected == entry.id,
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _history.select(entry.id),
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
          if (_history.selected case final selected?) ...[
            const Divider(),
            if (_history.report case final report?)
              ..._detail(context, report)
            else if (_history.detailError case final error?)
              ListTile(
                title: Text(error),
                trailing: TextButton(
                  onPressed: () => _history.select(selected),
                  child: const Text('重试读取'),
                ),
              )
            else
              const Text('正在读取报告…'),
          ],
        ],
      );
    },
  );

  List<Widget> _detail(BuildContext context, ArchivedReport report) {
    final theme = Theme.of(context).textTheme;
    return [
      Text(report.entry.title, style: theme.headlineSmall),
      Text(_date(context, report.entry.calculatedAt)),
      ReportBody(report.body),
    ];
  }
}

String _date(BuildContext context, DateTime time) {
  final local = time.toLocal();
  final format = MaterialLocalizations.of(context);
  return '${format.formatMediumDate(local)} ${format.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}
