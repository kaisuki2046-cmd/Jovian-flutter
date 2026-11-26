import 'dart:async';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'cast_content.dart';
import 'liuyao_form.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'tarot_cards.dart';

class GuideForm extends StatefulWidget {
  const GuideForm({super.key, this.online});

  final OnlineGuideController? online;

  @override
  State<GuideForm> createState() => _GuideFormState();
}

class _GuideFormState extends State<GuideForm>
    with AutomaticKeepAliveClientMixin {
  final _form = GlobalKey<FormState>();
  final _question = TextEditingController();
  final _followUp = TextEditingController();
  final _clock = Stopwatch();
  StreamSubscription<void>? _onlineChanges;
  late String _clockSessionId;
  GuideRitual? _ritual;
  bool _showCharts = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _attachOnline();
  }

  @override
  void didUpdateWidget(GuideForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.online != widget.online) {
      unawaited(_onlineChanges?.cancel());
      _attachOnline();
    }
  }

  void _attachOnline() {
    final online = widget.online;
    if (online == null) return;
    _onlineChanges = online.changes.listen((_) {
      if (!mounted) return;
      final previous = online.reading?.followUps.lastOrNull?.question;
      if (previous != null && previous == _followUp.text.trim())
        _followUp.clear();
      setState(() {});
    });
    unawaited(online.restore());
  }

  @override
  void dispose() {
    unawaited(_onlineChanges?.cancel());
    _question.dispose();
    _followUp.dispose();
    super.dispose();
  }

  void _start({required bool automatic}) {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final question = _question.text.trim();
    if (widget.online case final online?) {
      unawaited(online.start(question, automatic: automatic));
      return;
    }
    setState(() {
      _clock
        ..reset()
        ..start();
      _clockSessionId = guideEventId();
      _ritual = GuideRitual(
        question: question,
        focus: question,
        automatic: automatic,
      );
    });
  }

  void _toss() {
    if (widget.online case final online?) {
      unawaited(online.toss());
      return;
    }
    final ritual = _ritual!;
    if (ritual.snapshot.stage != GuideStage.cast) return;
    setState(() {
      ritual.toss(
        GuideCoinEvent(
          step: ritual.snapshot.tosses.length,
          actionId: guideEventId(),
        ),
      );
    });
  }

  void _choose(int slot) {
    if (widget.online case final online?) {
      unawaited(online.pick(slot));
      return;
    }
    final ritual = _ritual!;
    final state = ritual.snapshot;
    if (state.stage != GuideStage.draw || state.selectedSlots.contains(slot)) {
      return;
    }
    final instant = DateTime.now();
    final elapsed = _clock.elapsedMicroseconds / 1000;
    setState(() {
      ritual.pick(
        GuideCardEvent(
          actionId: guideEventId(),
          step: state.selectedSlots.length,
          slot: slot,
          epochMs: instant.millisecondsSinceEpoch.toString(),
          monotonicMs: elapsed,
          clockSessionId: _clockSessionId,
        ),
      );
    });
  }

  void _restart() {
    unawaited(widget.online?.nextQuestion());
    setState(() {
      _clock.stop();
      _question.clear();
      _followUp.clear();
      _ritual = null;
      _showCharts = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final text = Theme.of(context).textTheme;
    final online = widget.online;
    final busy = online?.busy ?? false;
    final ritual = online?.reading?.snapshot ?? _ritual?.snapshot;
    if (ritual == null) {
      return CastContent(
        key: const ValueKey('guide-question'),
        children: [
          Text('综合起盘', style: text.headlineMedium),
          const SizedBox(height: 8),
          Text(online == null ? '在本机生成六爻、塔罗和梅花易数盘面。' : '输入问题，选择起盘方式。'),
          const SizedBox(height: 16),
          Form(
            key: _form,
            child: TextFormField(
              controller: _question,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: '你想问哪件事？',
                border: OutlineInputBorder(),
              ),
              minLines: 2,
              maxLines: 4,
              maxLength: guideQuestionMaxLength,
              validator: (input) => validateGuideQuestion(input ?? ''),
            ),
          ),
          ..._feedback(),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : () => _start(automatic: false),
            child: const Text('手动起盘'),
          ),
          OutlinedButton(
            onPressed: busy ? null : () => _start(automatic: true),
            child: const Text('自动起盘'),
          ),
        ],
      );
    }

    return switch (ritual.stage) {
      GuideStage.cast => CastContent(
        key: const ValueKey(GuideStage.cast),
        children: [
          Text('扔六次铜钱', style: text.headlineMedium),
          const SizedBox(height: 8),
          const Text('每次投三枚，从初爻起向上记录。'),
          const SizedBox(height: 12),
          CoinCastProgress(tosses: ritual.tosses),
          ..._feedback(),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : _toss,
            child: const Text('投三枚铜钱'),
          ),
        ],
      ),
      GuideStage.draw => CastContent(
        key: const ValueKey(GuideStage.draw),
        children: [
          Text('抽三张塔罗', style: text.headlineMedium),
          ..._feedback(),
          const SizedBox(height: 12),
          TarotGrid(
            slotCount: ritual.slotCount,
            selectedSlots: ritual.selectedSlots,
            choose: _choose,
            busy: busy,
          ),
        ],
      ),
      GuideStage.reading => _buildResult(context, ritual),
    };
  }

  Widget _buildResult(BuildContext context, GuideRitualSnapshot ritual) {
    final text = Theme.of(context).textTheme;
    final chart = ritual.chart!;
    final online = widget.online;
    final reading = online?.reading;
    final busy = online?.busy ?? false;
    return CastContent(
      key: ValueKey(_showCharts ? 'guide-chart' : 'guide-reveal'),
      children: [
        Text(_showCharts ? '综合盘面' : '翻开三张塔罗', style: text.headlineMedium),
        const SizedBox(height: 8),
        Text(ritual.question),
        const SizedBox(height: 16),
        TarotReveal(draw: chart.tarot),
        ..._feedback(),
        if (online != null &&
            !busy &&
            reading?.report == null &&
            !online.canRetry) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: online.requestReport,
            child: const Text('获取解读'),
          ),
        ],
        if (_showCharts) ...[
          if (reading?.report case final report?) ...[
            const SizedBox(height: 16),
            ReadingReportView(report: report),
            ..._followUps(reading!, busy),
          ],
          const SizedBox(height: 20),
          JingfangResult(reading: chart.liuyao),
          const SizedBox(height: 24),
          Text(
            chart.meihuaInputSource == MeihuaInputSource.tarotClick
                ? '梅花取数来自三次抽牌的点击时刻。'
                : '梅花取数来自三枚自动生成的数。',
          ),
          const SizedBox(height: 8),
          MeihuaResult(reading: chart.meihua),
          const SizedBox(height: 20),
          OutlinedButton(
            onPressed: busy ? null : _restart,
            child: const Text('另问一件事'),
          ),
        ] else ...[
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => setState(() => _showCharts = true),
            child: const Text('查看盘面'),
          ),
        ],
      ],
    );
  }

  List<Widget> _feedback() {
    final online = widget.online;
    if (online == null) return const [];
    return [
      if (online.busy)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: LinearProgressIndicator(semanticsLabel: '正在处理算事请求'),
        ),
      if (online.message case final message?)
        Semantics(liveRegion: true, child: Text(message)),
      if (online.canRetry && !online.busy)
        OutlinedButton(onPressed: online.retry, child: const Text('重试')),
    ];
  }

  List<Widget> _followUps(OnlineReading reading, bool busy) => [
    for (final item in reading.followUps)
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.question, style: Theme.of(context).textTheme.titleMedium),
            Text(item.answer),
            for (final step in item.nextSteps) Text(step),
          ],
        ),
      ),
    if (reading.followUps.length < 8) ...[
      const SizedBox(height: 12),
      TextField(
        controller: _followUp,
        enabled: !busy,
        maxLength: guideQuestionMaxLength,
        decoration: const InputDecoration(labelText: '基于当前盘面追问'),
      ),
      OutlinedButton(
        onPressed: busy
            ? null
            : () async {
                final text = _followUp.text.trim();
                if (text.isEmpty) return;
                final online = widget.online!;
                final count = online.reading!.followUps.length;
                await online.followUp(text);
                if (mounted && (online.reading?.followUps.length ?? 0) > count)
                  _followUp.clear();
              },
        child: const Text('发送追问'),
      ),
    ],
  ];
}
