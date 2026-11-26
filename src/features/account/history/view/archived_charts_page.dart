import 'package:jovian_destiny/jovian_destiny.dart'
    show restoreArchivedBaZiRows;
import 'package:material_ui/material_ui.dart';

import '../../../../shared/http/json_client.dart';
import '../../auth/control/account_controller.dart';
import '../model/archived_charts.dart';

class ArchivedChartsPage extends StatelessWidget {
  const ArchivedChartsPage({super.key, required this.account});
  final AccountController account;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('命理档案')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final owner = account.sessionChanging
              ? null
              : account.authorizedSession;
          if (owner == null) {
            return const Center(child: Text('登录或恢复游客会话后，可以查看命理档案。'));
          }
          return _ChartContent(
            key: ValueKey(owner.scope),
            owner: owner.id,
            account: account,
          );
        },
      ),
    ),
  );
}

class _ChartContent extends StatefulWidget {
  const _ChartContent({super.key, required this.owner, required this.account});
  final String owner;
  final AccountController account;

  @override
  State<_ChartContent> createState() => _ChartContentState();
}

class _ChartContentState extends State<_ChartContent> {
  var _method = ArchivedChartMethod.bazi;
  late Future<ArchivedDestinyCharts?> _archive = _read();

  Future<ArchivedDestinyCharts?> _read() async {
    try {
      return await widget.account.reports.latestDestinyCharts(widget.owner);
    } on JsonRequestError catch (error) {
      if (mounted && (error.status == 401 || error.status == 403)) {
        await widget.account.initialize();
      }
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<ArchivedDestinyCharts?>(
    future: _archive,
    builder: (context, state) {
      if (state.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (state.hasError) {
        return Center(
          child: TextButton(
            onPressed: () => setState(() => _archive = _read()),
            child: const Text('暂时无法读取命盘，点击重试'),
          ),
        );
      }
      final archive = state.data;
      if (archive == null) return const Center(child: Text('还没有已保存的盘面。'));
      final chart = archive.charts[_method]!;
      final local = archive.entry.calculatedAt.toLocal();
      final format = MaterialLocalizations.of(context);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(format.formatMediumDate(local)),
          if (!archive.timeKnown) const Text('出生时刻未完全确定。'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final method in ArchivedChartMethod.values)
                ChoiceChip(
                  label: Text(method.label),
                  selected: _method == method,
                  onSelected: (_) => setState(() => _method = method),
                ),
            ],
          ),
          if (chart.note case final note?) Text(note),
          if (chart.rows.isEmpty && chart.note == null)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text('这次记录没有保存该盘面的基础数据。'),
            ),
          if (_method == ArchivedChartMethod.bazi)
            for (final row in restoreArchivedBaZiRows(chart.rows))
              ListTile(
                title: Text('${row.label} ${row.value}'),
                subtitle: row.details.isEmpty
                    ? null
                    : Text(row.details.join('\n')),
              )
          else
            for (final row in chart.rows)
              ListTile(
                title: Text(row.label),
                subtitle: SelectableText(row.value),
              ),
        ],
      );
    },
  );
}
