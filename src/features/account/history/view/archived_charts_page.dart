import 'package:jovian_destiny/jovian_destiny.dart'
    show RestoredBaZiRow, restoreArchivedBaZiRows;
import 'package:material_ui/material_ui.dart';

import '../../../../shared/http/json_client.dart';
import '../../../../ui/theme.dart';
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
                          : '登录或恢复游客会话后，可以查看命理档案。',
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

  void _reload() {
    final archive = _read();
    setState(() {
      _archive = archive;
    });
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
            onPressed: _reload,
            child: const Text('暂时无法读取命盘，点击重试'),
          ),
        );
      }
      final archive = state.data;
      return ListView(
        padding: jovianPagePadding,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: archive == null
                  ? const _EmptyCharts()
                  : _ChartPanel(
                      archive: archive,
                      method: _method,
                      select: (method) => setState(() => _method = method),
                    ),
            ),
          ),
          TextButton(onPressed: _reload, child: const Text('刷新盘面')),
        ],
      );
    },
  );
}

class _ChartPanel extends StatelessWidget {
  const _ChartPanel({
    required this.archive,
    required this.method,
    required this.select,
  });

  final ArchivedDestinyCharts archive;
  final ArchivedChartMethod method;
  final ValueChanged<ArchivedChartMethod> select;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final chart = archive.charts[method]!;
    final time = archive.entry.calculatedAt.toLocal();
    final format = MaterialLocalizations.of(context);
    final date = format.formatMediumDate(time);
    final clock = format.formatTimeOfDay(TimeOfDay.fromDateTime(time));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        Semantics(
          header: true,
          child: Text('三套盘面', style: theme.textTheme.titleLarge),
        ),
        Text(
          '$date $clock${archive.timeKnown ? '' : ' · 出生时刻未完全确定'}',
          style: theme.textTheme.bodySmall,
        ),
        Wrap(
          spacing: 8,
          children: [
            for (final item in ArchivedChartMethod.values)
              ChoiceChip(
                label: Text(item.label),
                selected: item == method,
                onSelected: (_) => select(item),
              ),
          ],
        ),
        if (chart.note case final note?) Text(note),
        if (chart.rows.isEmpty && chart.note == null)
          const Text('这次记录没有保存该盘面的基础数据。'),
        if (chart.rows.isNotEmpty && method == ArchivedChartMethod.bazi)
          _Pillars(rows: restoreArchivedBaZiRows(chart.rows))
        else
          for (final row in chart.rows)
            _ChartRow(label: row.label, value: row.value),
      ],
    );
  }
}

class _Pillars extends StatelessWidget {
  const _Pillars({required this.rows});

  final List<RestoredBaZiRow> rows;

  @override
  Widget build(BuildContext context) {
    const gap = 6.0;
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final minWidth = MediaQuery.textScalerOf(context).scale(52);
            final capacity = ((constraints.maxWidth + gap) / (minWidth + gap))
                .floor()
                .clamp(1, 4);
            final preferred = rows.length.clamp(1, 4);
            final columns = capacity >= preferred
                ? preferred
                : capacity >= 2
                ? 2
                : 1;
            final width =
                (constraints.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final row in rows)
                  SizedBox(
                    width: width,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.primaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          spacing: 4,
                          children: [
                            Text(
                              row.label,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodySmall,
                            ),
                            Text(
                              row.value,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.titleMedium,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
        for (final row in rows)
          if (row.details.isNotEmpty)
            DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: _ChartRow(
                  label: row.label,
                  value: row.details.join('\n'),
                  endAligned: false,
                ),
              ),
            ),
      ],
    );
  }
}

class _ChartRow extends StatelessWidget {
  const _ChartRow({
    required this.label,
    required this.value,
    this.endAligned = true,
  });

  final String label;
  final String value;
  final bool endAligned;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 12,
    children: [
      Flexible(
        child: Text(label, style: Theme.of(context).textTheme.titleMedium),
      ),
      Expanded(
        flex: 2,
        child: SelectableText(
          value,
          textAlign: endAligned ? TextAlign.end : TextAlign.start,
        ),
      ),
    ],
  );
}

class _EmptyCharts extends StatelessWidget {
  const _EmptyCharts();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 6,
    children: [
      Text('还没有已保存的盘面。', style: Theme.of(context).textTheme.titleMedium),
      const Text('在命理页完成一次测算后，可在这里查看三套盘面的基础数据。'),
    ],
  );
}
