import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/report_body.dart';
import '../control/fortune_page_controller.dart';
import '../model/online_fortune.dart';
import 'fortune_display_labels.dart';

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
    if (fortune.online == null) {
      return const _FortuneCard(
        title: '运势解读',
        children: [_FortuneStatus('解读服务暂未配置。')],
      );
    }
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
              child: UiText(_showLocation ? '收起太阳回归地点' : '设置太阳回归地点'),
            ),
          ),
        if (locationVisible) ...[
          Text(
            context
                .uiLabel('填写 {date} 太阳回归时的地点。可留空。')
                .replaceFirst('{date}', _returnDate(context, target, fortune)),
          ),
          _coordinates(),
          if (invalidLocation)
            const _FortuneStatus(
              '请填写两项十进制度。纬度须大于 -90 且小于 90，经度可在 -180 到 180 之间。',
            ),
        ],
        if (fortune.loadingReport) const _FortuneStatus('正在读取已存解读…'),
        if (fortune.generating) const _FortuneStatus('正在生成解读…'),
        if (fortune.reportError case final error?) ...[
          _FortuneStatus(error),
          OutlinedButton(
            onPressed: fortune.busy
                ? null
                : () => fortune.readReport(retry: true),
            child: const UiText('重试读取'),
          ),
        ],
        if (fortune.generationError case final error?) _FortuneStatus(error),
        if (fortune.returnLocationRejected && fortune.canGenerate)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: () {
                FocusManager.instance.primaryFocus?.unfocus();
                setState(() {
                  _latitude.clear();
                  _longitude.clear();
                  _showLocation = false;
                });
                fortune.generate();
              },
              child: const UiText('清空地点，生成常规解读'),
            ),
          ),
        if (!fortune.loadingReport &&
            !fortune.generating &&
            (report == null || hasLocation || fortune.generationError != null))
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton(
              onPressed: canGenerate
                  ? () {
                      FocusManager.instance.primaryFocus?.unfocus();
                      fortune.generate(returnLocation: location);
                    }
                  : null,
              child: UiText(fortune.generationError == null ? '解读' : '重试生成'),
            ),
          ),
        if (report != null) ...[
          UiText(
            fortune.reportSaved
                ? '已存档，可随时回看'
                : fortune.saving
                ? '正在存档…'
                : '暂未存档',
          ),
          for (final MapEntry(:key, :value)
              in fortuneSectionTitles.entries) ...[
            const SizedBox(height: 4),
            ReportHeading(context.uiLabel(value)),
            ReportBody(report.sections[key]!),
          ],
          if (fortune.needsSave)
            OutlinedButton(
              onPressed: fortune.busy ? null : fortune.retrySave,
              child: const UiText('重试存档'),
            ),
        ],
      ],
    );
  }

  Widget _coordinates() => LayoutBuilder(
    builder: (context, bounds) {
      final fields = [
        _coordinate(context, _latitude, '纬度', '如 39.90', '北纬', '南纬'),
        _coordinate(context, _longitude, '经度', '如 116.40', '东经', '西经'),
      ];
      return bounds.maxWidth < MediaQuery.textScalerOf(context).scale(300)
          ? Column(spacing: 8, children: fields)
          : Row(
              spacing: 8,
              children: [for (final field in fields) Expanded(child: field)],
            );
    },
  );

  Widget _coordinate(
    BuildContext context,
    TextEditingController controller,
    String label,
    String hint,
    String positive,
    String negative,
  ) {
    final isNegative = controller.text.trim().startsWith('-');
    final nextDirection = context.uiLabel(isNegative ? positive : negative);
    return TextField(
      controller: controller,
      enabled: !widget.fortune.busy,
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: true,
      ),
      decoration: InputDecoration(
        labelText: context.uiLabel(label),
        hintText: context.uiLabel(hint),
        suffixIcon: IconButton(
          tooltip: context
              .uiLabel('切换为{direction}')
              .replaceFirst('{direction}', nextDirection),
          onPressed: widget.fortune.busy
              ? null
              : () {
                  final current = controller.text.trim();
                  final next = isNegative
                      ? current.substring(1)
                      : '-${current.startsWith('+') ? current.substring(1) : current}';
                  setState(() {
                    controller.value = TextEditingValue(
                      text: next,
                      selection: TextSelection.collapsed(offset: next.length),
                    );
                  });
                },
          icon: UiText(isNegative ? negative : positive),
        ),
      ),
      onChanged: (_) => setState(() {}),
    );
  }
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
  final hour = format.formatTimeOfDay(
    TimeOfDay.fromDateTime(wall),
    alwaysUse24HourFormat: true,
  );
  return '${fortuneDateLabel(context, wall)} $hour';
}

class FortuneAdvice extends StatefulWidget {
  const FortuneAdvice({
    super.key,
    required this.onRequest,
    this.groups,
    this.loading = false,
    this.error,
  });

  final VoidCallback? onRequest;
  final List<FortuneAdviceGroup>? groups;
  final bool loading;
  final String? error;

  @override
  State<FortuneAdvice> createState() => _FortuneAdviceState();
}

class _FortuneAdviceState extends State<FortuneAdvice> {
  bool _details = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final english = context.uiLanguage == InterfaceLanguage.english;
    final groups = widget.loading || widget.error != null
        ? null
        : widget.groups;
    final hasEvidence = groups?.any((group) => group.items.isNotEmpty) == true;
    return _FortuneCard(
      title: '提运建议',
      children: [
        const UiText('数字、饰品和颜色供日常象征搭配参考。'),
        OutlinedButton(
          onPressed: widget.loading ? null : widget.onRequest,
          child: UiText(widget.error == null ? '按盘面获取建议' : '重试获取建议'),
        ),
        if (widget.loading) const _FortuneStatus('正在读取提运建议…'),
        if (widget.error case final error?) _FortuneStatus(error),
        if (groups != null) ...[
          if (hasEvidence)
            Semantics(
              expanded: _details,
              child: TextButton(
                onPressed: () => setState(() => _details = !_details),
                child: UiText(_details ? '收起依据' : '查看建议依据'),
              ),
            ),
          for (final group in groups) ...[
            Semantics(
              header: true,
              child: UiText('幸运${group.kind}', style: theme.titleMedium),
            ),
            if (group.items.isEmpty) const UiText('目前没有可确认主题的对应建议。'),
            for (final item in group.items) ...[
              Text(item.options.join(english ? ', ' : '、')),
              Text(
                english
                    ? '${context.uiLabel(_methodLabels[item.method]!)} · ${context.uiLabel('主题')} ${item.theme}'
                    : '${_methodLabels[item.method]} · ${item.theme}主题',
                style: theme.bodySmall,
              ),
              if (_details) ...[
                Text(item.reason),
                Text('${context.uiLabel('来源：')}${item.source}'),
                for (final limit in item.limitations) Text(limit),
              ],
            ],
          ],
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
            child: UiText(title, style: Theme.of(context).textTheme.titleLarge),
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
      Semantics(liveRegion: true, child: UiText(message));
}
