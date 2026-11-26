import 'package:material_ui/material_ui.dart';

import '../control/fortune_page_controller.dart';
import '../model/online_fortune.dart';

class FortuneInterpretation extends StatefulWidget {
  const FortuneInterpretation({super.key, required this.fortune});

  final FortunePageController fortune;

  @override
  State<FortuneInterpretation> createState() => _FortuneInterpretationState();
}

class _FortuneInterpretationState extends State<FortuneInterpretation> {
  final _latitude = TextEditingController();
  final _longitude = TextEditingController();
  bool _showLocation = false;

  @override
  void dispose() {
    _latitude.dispose();
    _longitude.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fortune = widget.fortune;
    final report = fortune.published;
    final target = fortune.archivedWindow == null
        ? fortune.prepared?.returnAt
        : null;
    final locationVisible = target != null && _showLocation;
    final latitude = _latitude.text.trim();
    final longitude = _longitude.text.trim();
    final hasLocation =
        locationVisible && (latitude.isNotEmpty || longitude.isNotEmpty);
    final location = hasLocation
        ? _parseLocation(target, latitude, longitude)
        : null;
    final invalidLocation = hasLocation && location == null;
    final canGenerate =
        fortune.canGenerate &&
        !invalidLocation &&
        (report == null || hasLocation || fortune.generationError != null);

    return _FortuneCard(
      title: '运势解读',
      children: [
        if (target != null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: fortune.busy
                  ? null
                  : () => setState(() => _showLocation = !_showLocation),
              child: Text(_showLocation ? '收起太阳回归地点' : '设置太阳回归地点'),
            ),
          ),
        if (locationVisible) ...[
          Text('填写 ${_returnDate(context, target, fortune)} 太阳回归时的地点。可留空。'),
          Row(
            spacing: 8,
            children: [
              Expanded(child: _coordinate(_latitude, '纬度', '如 39.90')),
              Expanded(child: _coordinate(_longitude, '经度', '如 116.40')),
            ],
          ),
          if (invalidLocation)
            const Text('请填写两项十进制度。纬度须大于 -90 且小于 90，经度可在 -180 到 180 之间。'),
        ],
        if (fortune.loadingReport) const _FortuneStatus('正在读取已存解读…'),
        if (fortune.generating) const _FortuneStatus('正在生成解读…'),
        if (fortune.reportError case final error?) ...[
          _FortuneStatus(error),
          OutlinedButton(
            onPressed: fortune.busy
                ? null
                : () => fortune.readReport(retry: true),
            child: const Text('重试读取'),
          ),
        ],
        if (fortune.generationError case final error?) _FortuneStatus(error),
        if (!fortune.loadingReport &&
            !fortune.generating &&
            (report == null || hasLocation || fortune.generationError != null))
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton(
              onPressed: canGenerate
                  ? () => fortune.generate(returnLocation: location)
                  : null,
              child: Text(fortune.generationError == null ? '解读' : '重试生成'),
            ),
          ),
        if (report != null) ...[
          Text(
            fortune.reportSaved
                ? '已存档，可随时回看'
                : fortune.saving
                ? '正在存档…'
                : '暂未存档',
          ),
          for (final MapEntry(:key, :value)
              in fortuneSectionTitles.entries) ...[
            const SizedBox(height: 4),
            Semantics(
              header: true,
              child: Text(
                value,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Text(report.sections[key]!),
          ],
          if (fortune.needsSave)
            OutlinedButton(
              onPressed: fortune.busy ? null : fortune.retrySave,
              child: const Text('重试存档'),
            ),
        ],
      ],
    );
  }

  Widget _coordinate(
    TextEditingController controller,
    String label,
    String hint,
  ) => TextField(
    controller: controller,
    enabled: !widget.fortune.busy,
    keyboardType: const TextInputType.numberWithOptions(
      decimal: true,
      signed: true,
    ),
    decoration: InputDecoration(labelText: label, hintText: hint),
    onChanged: (_) => setState(() {}),
  );
}

final _decimal = RegExp(r'^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$');

Map<String, Object?>? _parseLocation(int at, String lat, String lon) {
  if (!_decimal.hasMatch(lat) || !_decimal.hasMatch(lon)) return null;
  final latitude = double.parse(lat);
  final longitude = double.parse(lon);
  if (latitude.abs() >= 90 || longitude.abs() > 180) return null;
  return {'returnAt': at, 'latitude': latitude, 'longitude': longitude};
}

String _returnDate(
  BuildContext context,
  int at,
  FortunePageController fortune,
) {
  final wall = DateTime.fromMillisecondsSinceEpoch(
    fortune.display!.clock(at),
    isUtc: true,
  );
  final format = MaterialLocalizations.of(context);
  return '${wall.year}年${wall.month}月${wall.day}日 ${format.formatTimeOfDay(TimeOfDay.fromDateTime(wall))}';
}

class FortuneAdvice extends StatefulWidget {
  const FortuneAdvice({super.key, required this.fortune});

  final FortunePageController fortune;

  @override
  State<FortuneAdvice> createState() => _FortuneAdviceState();
}

class _FortuneAdviceState extends State<FortuneAdvice> {
  bool _details = false;

  @override
  Widget build(BuildContext context) {
    final fortune = widget.fortune;
    final theme = Theme.of(context).textTheme;
    return _FortuneCard(
      title: '提运建议',
      children: [
        const Text('数字、饰品和颜色供日常象征搭配参考。'),
        OutlinedButton(
          onPressed:
              fortune.busy ||
                  (!fortune.canGenerate && fortune.published == null)
              ? null
              : fortune.getAdvice,
          child: Text(fortune.adviceError == null ? '按盘面获取建议' : '重试获取建议'),
        ),
        if (fortune.loadingAdvice) const _FortuneStatus('正在读取提运建议…'),
        if (fortune.adviceError case final error?) _FortuneStatus(error),
        if (fortune.advice case final groups?) ...[
          for (final group in groups) ...[
            Semantics(
              header: true,
              child: Text('幸运${group.kind}', style: theme.titleMedium),
            ),
            if (group.items.isEmpty) const Text('目前没有可确认主题的对应建议。'),
            for (final item in group.items) ...[
              Text(item.options.join('、')),
              Text(
                '${_methodLabels[item.method]} · ${item.theme}主题',
                style: theme.bodySmall,
              ),
              if (_details) ...[
                Text(item.reason),
                Text('来源：${item.source}'),
                for (final limit in item.limitations) Text(limit),
              ],
            ],
          ],
          TextButton(
            onPressed: () => setState(() => _details = !_details),
            child: Text(_details ? '收起依据' : '查看建议依据'),
          ),
        ],
      ],
    );
  }
}

const _methodLabels = {'bazi': '八字', 'ziwei': '紫微', 'western': '西方星盘'};

class _FortuneCard extends StatelessWidget {
  const _FortuneCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Semantics(
            header: true,
            child: Text(title, style: Theme.of(context).textTheme.titleLarge),
          ),
          ...children,
        ],
      ),
    ),
  );
}

class _FortuneStatus extends StatelessWidget {
  const _FortuneStatus(this.message);

  final String message;

  @override
  Widget build(BuildContext context) =>
      Semantics(liveRegion: true, child: Text(message));
}
