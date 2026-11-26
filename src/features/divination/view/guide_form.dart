import 'dart:async';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'cast_content.dart';
import 'guide_conversation.dart';
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
  final _followUpForm = GlobalKey<FormState>();
  final _question = TextEditingController();
  final _followUp = TextEditingController();
  final _clock = Stopwatch();
  StreamSubscription<void>? _onlineChanges;
  late String _clockSessionId;
  GuideRitual? _ritual;
  final _clarifications = <({String question, String reply})>[];
  final _completed = <OnlineReading>[];
  String? _pendingQuestion;
  bool _showHistory = false;
  OnlineReading? _savedReading;
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
      _onlineChanges = null;
      _clearDraft();
      _completed.clear();
      _showHistory = false;
      _savedReading = null;
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
      setState(() => _pendingQuestion = question);
      unawaited(_startOnline(online, question, automatic));
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

  Future<void> _startOnline(
    OnlineGuideController online,
    String question,
    bool automatic,
  ) async {
    await online.start(question, automatic: automatic);
    _finishQuestion(online);
  }

  void _finishQuestion(OnlineGuideController online) {
    if (!mounted || widget.online != online || _pendingQuestion == null) return;
    if (online.reading != null) {
      setState(() {
        _pendingQuestion = null;
        _question.clear();
      });
    } else if (online.message case final reply? when !online.canRetry) {
      setState(() {
        _clarifications.add((question: _pendingQuestion!, reply: reply));
        _pendingQuestion = null;
        _question.clear();
      });
    }
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
    final online = widget.online;
    final completed = online?.reading;
    setState(() {
      if (completed?.report != null) _completed.add(completed!);
      _clearDraft();
    });
    unawaited(online?.nextQuestion());
  }

  void _clearDraft() {
    _clock.stop();
    _question.clear();
    _followUp.clear();
    _pendingQuestion = null;
    _clarifications.clear();
    _ritual = null;
    _showCharts = false;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final text = Theme.of(context).textTheme;
    final online = widget.online;
    final busy = online?.busy ?? false;
    final ritual = online?.reading?.snapshot ?? _ritual?.snapshot;
    if (_savedReading case final saved?) {
      return GuideSavedConversation(
        key: const ValueKey('guide-saved-conversation'),
        reading: saved,
        back: () => setState(() => _savedReading = null),
      );
    }
    if (_showHistory) {
      return GuideConversationHistory(
        key: const ValueKey('guide-conversation-history'),
        readings: [
          if (online?.reading case final active? when active.report != null)
            active,
          ..._completed.reversed,
        ],
        open: (reading) => setState(() => _savedReading = reading),
        back: () => setState(() => _showHistory = false),
      );
    }
    if (ritual == null) {
      return CastContent(
        key: const ValueKey('guide-question'),
        children: [
          _heading('综合起盘'),
          const SizedBox(height: 8),
          Text(
            online == null ? '在本机生成六爻、塔罗和梅花易数盘面。' : '输入一件想问的事，起盘后可以继续追问。',
            style: text.bodyMedium,
          ),
          const SizedBox(height: 16),
          ..._conversation(),
          if (_pendingQuestion case final submitted?) ...[
            GuideQuestionBubble(submitted),
            const SizedBox(height: 12),
          ],
          ..._feedback(),
          Form(
            key: _form,
            child: TextFormField(
              controller: _question,
              enabled: !busy,
              decoration: const InputDecoration(labelText: '你想问哪件事？'),
              minLines: 2,
              maxLines: 4,
              maxLength: guideQuestionMaxLength,
              validator: (input) => validateGuideQuestion(input ?? ''),
            ),
          ),
          OverflowBar(
            alignment: MainAxisAlignment.start,
            overflowAlignment: OverflowBarAlignment.start,
            spacing: 8,
            overflowSpacing: 8,
            children: [
              FilledButton(
                onPressed: busy ? null : () => _start(automatic: false),
                child: const Text('手动起盘'),
              ),
              OutlinedButton(
                onPressed: busy ? null : () => _start(automatic: true),
                child: const Text('自动起盘'),
              ),
            ],
          ),
        ],
      );
    }

    return switch (ritual.stage) {
      GuideStage.cast => CastContent(
        key: const ValueKey(GuideStage.cast),
        children: [
          _heading('扔六次铜钱'),
          const SizedBox(height: 8),
          const Text('每次投三枚，从初爻起向上记录。'),
          const SizedBox(height: 12),
          if (online != null) ..._questionContext(ritual),
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
          _heading('抽三张塔罗'),
          if (online != null) ..._questionContext(ritual),
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

  Widget _heading(String title) => Row(
    children: [
      Expanded(
        child: Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
        ),
      ),
      if (widget.online != null)
        IconButton(
          tooltip: '会话记录',
          onPressed: () => setState(() => _showHistory = true),
          icon: const Icon(Icons.history),
        ),
    ],
  );

  List<Widget> _conversation() => [
    for (final turn in _clarifications) ...[
      GuideQuestionBubble(turn.question),
      const SizedBox(height: 8),
      GuideConversationReply(body: turn.reply),
      const SizedBox(height: 12),
    ],
  ];

  List<Widget> _questionContext(GuideRitualSnapshot ritual) => [
    GuideQuestionBubble(ritual.question),
    if (ritual.focus.trim().isNotEmpty && ritual.focus != ritual.question) ...[
      const SizedBox(height: 8),
      GuideConversationReply(heading: '确认的关注点', body: ritual.focus),
    ],
    const SizedBox(height: 16),
  ];

  Widget _buildResult(BuildContext context, GuideRitualSnapshot ritual) {
    final text = Theme.of(context).textTheme;
    final chart = ritual.chart!;
    final online = widget.online;
    final reading = online?.reading;
    final busy = online?.busy ?? false;
    return CastContent(
      key: const ValueKey('guide-result'),
      children: [
        _heading(_showCharts ? '综合盘面' : '翻开三张塔罗'),
        const SizedBox(height: 8),
        ..._questionContext(ritual),
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
        if (reading?.report case final report?) ...[
          const SizedBox(height: 20),
          Text('综合解读', style: text.titleLarge),
          const SizedBox(height: 8),
          ReadingReportView(report: report),
        ],
        const SizedBox(height: 16),
        OverflowBar(
          alignment: MainAxisAlignment.start,
          overflowAlignment: OverflowBarAlignment.start,
          spacing: 8,
          overflowSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: () => setState(() => _showCharts = !_showCharts),
              icon: Icon(_showCharts ? Icons.expand_less : Icons.expand_more),
              label: Text(_showCharts ? '收起盘面' : '查看盘面'),
            ),
            OutlinedButton.icon(
              onPressed: busy ? null : _restart,
              icon: const Icon(Icons.add_comment_outlined),
              label: const Text('另问一件事'),
            ),
          ],
        ),
        if (_showCharts) ...[
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
        ],
        if (reading?.report != null) ...[
          const SizedBox(height: 20),
          ..._followUps(reading!, busy),
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
      if (online.message case final message?
          when online.canRetry || _clarifications.lastOrNull?.reply != message)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Semantics(
            liveRegion: true,
            child: GuideConversationReply(body: message),
          ),
        ),
      if (online.canRetry && !online.busy)
        OutlinedButton(
          onPressed: () async {
            await online.retry();
            _finishQuestion(online);
          },
          child: const Text('重试'),
        ),
    ];
  }

  List<Widget> _followUps(OnlineReading reading, bool busy) => [
    GuideFollowUpList(followUps: reading.followUps),
    if (reading.followUps.length < 8) ...[
      Form(
        key: _followUpForm,
        child: TextFormField(
          controller: _followUp,
          enabled: !busy,
          maxLength: guideQuestionMaxLength,
          minLines: 1,
          maxLines: 4,
          textInputAction: TextInputAction.send,
          decoration: const InputDecoration(labelText: '基于当前盘面追问'),
          validator: (input) => validateGuideQuestion(input ?? ''),
          onFieldSubmitted: busy ? null : (_) => _sendFollowUp(),
        ),
      ),
      Align(
        alignment: AlignmentDirectional.centerEnd,
        child: FilledButton.icon(
          onPressed: busy ? null : _sendFollowUp,
          icon: const Icon(Icons.send_outlined),
          label: const Text('发送追问'),
        ),
      ),
    ] else
      const Text('这次算事的追问已达上限，可以另问一件事。'),
  ];

  Future<void> _sendFollowUp() async {
    if (_followUpForm.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    await widget.online?.followUp(_followUp.text.trim());
  }
}
