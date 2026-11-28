import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import 'cast_content.dart';
import 'hexagram_card.dart';
import 'ritual/coin_cast_ritual.dart';

const _lineNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

class LiuYaoForm extends StatefulWidget {
  const LiuYaoForm({super.key, this.active = true});

  final bool active;

  @override
  State<LiuYaoForm> createState() => _LiuYaoFormState();
}

class _LiuYaoFormState extends State<LiuYaoForm>
    with AutomaticKeepAliveClientMixin {
  final _tosses = <List<int>>[];
  DateTime? _castStartedAt;
  JingfangReading? _reading;

  @override
  bool get wantKeepAlive => true;

  void _toss() {
    if (_tosses.length == _lineNames.length) return;
    setState(() {
      _castStartedAt ??= DateTime.now();
      _tosses.add(rollLiuYaoLine());
    });
  }

  void _settle(int count) {
    if (count != _lineNames.length ||
        _tosses.length != count ||
        _reading != null)
      return;
    setState(
      () => _reading = readJingfang(_tosses, castCalendar(_castStartedAt!)),
    );
  }

  void _restart() {
    setState(() {
      _tosses.clear();
      _castStartedAt = null;
      _reading = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final text = Theme.of(context).textTheme;
    return CastContent(
      children: [
        Text('六爻起卦', style: text.headlineMedium),
        const SizedBox(height: 8),
        const Text('每次投三枚铜钱，字面记 2，背面记 3。初爻在最下方，按投掷顺序向上排。'),
        const SizedBox(height: 16),
        if (_reading case final reading?) ...[
          CoinCastProgress(tosses: _tosses),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _restart, child: const Text('重新起卦')),
          const SizedBox(height: 16),
          JingfangResult(reading: reading),
        ] else
          CoinCastRitual(
            tosses: _tosses,
            onToss: _toss,
            onSettled: _settle,
            active: widget.active,
          ),
      ],
    );
  }
}

class CoinCastProgress extends StatelessWidget {
  const CoinCastProgress({super.key, required this.tosses});

  final List<List<int>> tosses;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        liveRegion: true,
        child: Text('已投 ${tosses.length} / ${_lineNames.length} 次'),
      ),
      if (tosses.isNotEmpty) ...[
        const SizedBox(height: 4),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: [
            for (var index = 0; index < tosses.length; index++)
              Text('${_lineNames[index]} ${coinTossValue(tosses[index])}'),
          ],
        ),
        Text('最近一次：${tosses.last.join(' + ')}'),
      ],
    ],
  );
}

class JingfangResult extends StatelessWidget {
  const JingfangResult({
    super.key,
    required this.reading,
    this.compact = false,
  });

  final JingfangReading reading;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final base = reading.base;
    final theme = Theme.of(context);
    final caption = compact
        ? theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          )
        : null;
    final figures = <HexagramFigure>[
      (label: '本卦', hexagram: base.primary, moving: base.moving),
      if (base.moving.isNotEmpty)
        (label: '变卦', hexagram: base.changed, moving: const []),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!compact)
          Semantics(
            header: true,
            child: UiText('六爻结果', style: theme.textTheme.titleLarge),
          ),
        Text(
          '${base.palace.name}宫 · 世在${_lineNames[base.shi - 1]} · 应在${_lineNames[base.ying - 1]}',
          style: caption,
          textAlign: compact ? TextAlign.center : TextAlign.start,
        ),
        SizedBox(height: compact ? 14 : 8),
        HexagramGroup(
          figures: figures,
          style: compact ? HexagramStyle.paper : null,
        ),
        if (compact) ...[const SizedBox(height: 12), const Divider(height: 1)],
        ExpansionTile(
          key: compact ? const PageStorageKey('report-jingfang-chart') : null,
          title: const UiText('查看京房排盘'),
          tilePadding: compact ? EdgeInsets.zero : null,
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          childrenPadding: EdgeInsets.fromLTRB(
            compact ? 0 : 16,
            0,
            compact ? 0 : 16,
            12,
          ),
          children: [
            Text(
              '月柱 ${reading.calendar.month} · 日辰 ${reading.calendar.day}'
              ' · 旬空 ${reading.voidBranches.join('、')}',
            ),
            for (final line in base.lines.reversed)
              _JingfangLineView(
                line: line,
                original: reading.originalLines[line.position - 1],
                changed: reading.changedLines[line.position - 1],
                coins: base.tosses[line.position - 1],
              ),
            for (final hidden in reading.hiddenSpirits)
              Text(
                '${_lineNames[hidden.position - 1]}伏神 ${hidden.stem}${hidden.branch}'
                ' ${hidden.relative} · 飞神 '
                '${reading.originalLines[hidden.position - 1].stem}'
                '${reading.originalLines[hidden.position - 1].branch}',
              ),
          ],
        ),
        if (!compact) ...[const SizedBox(height: 6), Text(base.interpretation)],
      ],
    );
  }
}

class _JingfangLineView extends StatelessWidget {
  const _JingfangLineView({
    required this.line,
    required this.original,
    required this.changed,
    required this.coins,
  });

  final LiuYaoLine line;
  final JingfangLine original;
  final JingfangLine changed;
  final List<int> coins;

  @override
  Widget build(BuildContext context) {
    final facts = [
      '${original.stem}${line.branch}${line.element}',
      line.relative,
      original.spirit,
      if (original.isVoid) '旬空',
      if (original.monthOpposed) '月冲',
      '投掷 ${coins.join(' + ')}',
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            [
              _lineNames[line.position - 1],
              '${line.kind} ${line.value}',
              if (line.moving) '动',
              if (line.role case final role?) role,
            ].join(' · '),
          ),
          Text(facts.join(' · ')),
          if (line.moving)
            Text('化 ${changed.stem}${changed.branch} · ${changed.relative}'),
        ],
      ),
    );
  }
}
