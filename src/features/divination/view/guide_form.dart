import 'dart:async';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'cast_content.dart';
import 'guide_composer.dart';
import 'guide_conversation.dart';
import 'liuyao_form.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'ritual/guide_ritual_dialog.dart';
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
  final _questionFocus = FocusNode();
  final _followUp = TextEditingController();
  final _reportScroll = ScrollController();
  final _clock = Stopwatch();
  final _ritualChanges = ValueNotifier(0);
  StreamSubscription<void>? _onlineChanges;
  late String _clockSessionId;
  GuideRitual? _ritual;
  DialogRoute<void>? _ritualRoute;
  GuideRitualPresentation? _presentation;
  final _clarifications = <({String question, String reply})>[];
  final _completed = <OnlineReading>[];
  String? _pendingQuestion;
  bool _showHistory = false;
  OnlineReading? _savedReading;
  bool _showCharts = false;

  @override
  bool get wantKeepAlive => true;

  GuideRitualSnapshot? get _snapshot =>
      widget.online?.reading?.snapshot ?? _ritual?.snapshot;

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
      _ritualChanges.value++;
    });
    unawaited(online.restore());
  }

  @override
  void dispose() {
    unawaited(_onlineChanges?.cancel());
    _removeRitualRoute();
    _ritualChanges.dispose();
    _question.dispose();
    _questionFocus.dispose();
    _followUp.dispose();
    _reportScroll.dispose();
    super.dispose();
  }

  void _start({required bool automatic}) {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    _presentation = null;
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
    if (!automatic) _openRitual();
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
      if (_snapshot?.stage == GuideStage.cast) _openRitual();
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
    _ritualChanges.value++;
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
    _ritualChanges.value++;
  }

  void _openRitual() {
    if (_ritualRoute != null || _snapshot == null) return;
    final presentation = _presentation ??= GuideRitualPresentation();
    final navigator = Navigator.of(context, rootNavigator: true);
    final motionOff =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    late final DialogRoute<void> route;
    route = DialogRoute<void>(
      context: context,
      barrierDismissible: false,
      animationStyle: motionOff ? AnimationStyle.noAnimation : null,
      builder: (_) => GuideRitualDialog(
        presentation: presentation,
        changes: _ritualChanges,
        snapshot: () => mounted ? _snapshot : null,
        busy: () => mounted && (widget.online?.busy ?? false),
        error: () => mounted ? widget.online?.message : null,
        retry: () {
          final online = mounted ? widget.online : null;
          return online?.canRetry == true ? online!.retry : null;
        },
        toss: _toss,
        choose: _choose,
        pause: () {
          if (route.isCurrent) navigator.pop();
        },
      ),
    );
    _ritualRoute = route;
    unawaited(
      navigator.push(route).then((_) {
        if (!mounted || _ritualRoute != route) return;
        setState(() => _ritualRoute = null);
      }),
    );
  }

  void _removeRitualRoute() {
    final route = _ritualRoute;
    if (route == null) return;
    _ritualRoute = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (route.isActive) route.navigator?.removeRoute(route);
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
    _removeRitualRoute();
    _presentation = null;
    _clock.stop();
    _question.clear();
    _followUp.clear();
    _pendingQuestion = null;
    _clarifications.clear();
    _ritual = null;
    _showCharts = false;
  }

  void _setSuggestedQuestion(String question) {
    _question.value = TextEditingValue(
      text: question,
      selection: TextSelection.collapsed(offset: question.length),
    );
    _questionFocus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final online = widget.online;
    final busy = online?.busy ?? false;
    final ritual = _snapshot;
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
      final welcome =
          !busy && _pendingQuestion == null && _clarifications.isEmpty;
      return GuideThread(
        key: const ValueKey('guide-question'),
        headerAction: _historyAction(),
        welcome: welcome ? GuideWelcome(offline: online == null) : null,
        messages: [
          ..._conversation(),
          if (_pendingQuestion case final submitted?) ...[
            GuideQuestionBubble(submitted),
            const SizedBox(height: 12),
          ],
          ..._feedback(),
          if (welcome)
            GuideSuggestions(select: busy ? null : _setSuggestedQuestion),
        ],
        composer: GuideComposer(
          form: _form,
          text: _question,
          focus: _questionFocus,
          label: '你想问哪件事？',
          sendLabel: '发送消息',
          busy: busy,
          send: () => _start(automatic: false),
          suggest: _setSuggestedQuestion,
          actions: [
            guideComposerAction(
              label: '手动起盘',
              action: busy ? null : () => _start(automatic: false),
            ),
            guideComposerAction(
              label: '自动起盘',
              action: busy ? null : () => _start(automatic: true),
            ),
          ],
        ),
      );
    }

    return switch (ritual.stage) {
      GuideStage.cast => _buildRitualPrompt(ritual, '扔六次铜钱'),
      GuideStage.draw => _buildRitualPrompt(ritual, '抽三张塔罗'),
      GuideStage.reading when _presentation?.needsReveal(ritual) == true =>
        _buildRitualPrompt(ritual, '翻开三张塔罗'),
      GuideStage.reading => _buildResult(context, ritual),
    };
  }

  Widget _buildRitualPrompt(GuideRitualSnapshot ritual, String title) =>
      CastContent(
        key: ValueKey(ritual.stage),
        children: [
          _heading(title),
          const SizedBox(height: 8),
          ..._questionContext(ritual),
          ..._feedback(),
          OverflowBar(
            alignment: MainAxisAlignment.start,
            overflowAlignment: OverflowBarAlignment.start,
            spacing: 8,
            overflowSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: _openRitual,
                icon: const Icon(Icons.play_arrow),
                label: const Text('继续本次仪式'),
              ),
              OutlinedButton.icon(
                onPressed: widget.online?.busy == true ? null : _restart,
                icon: const Icon(Icons.add_comment_outlined),
                label: const Text('另问一件事'),
              ),
            ],
          ),
        ],
      );

  Widget _heading(String title) => Row(
    children: [
      Expanded(
        child: Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
        ),
      ),
      if (_historyAction() case final action?) action,
    ],
  );

  Widget? _historyAction() => widget.online == null
      ? null
      : IconButton(
          tooltip: '会话记录',
          onPressed: () => setState(() => _showHistory = true),
          icon: const Icon(Icons.menu_rounded),
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
    final hasReport = reading?.report != null;
    final canFollowUp = hasReport && reading!.followUps.length < 8;
    return GuideThread(
      key: const ValueKey('guide-result'),
      headerAction: _historyAction(),
      scroll: _reportScroll,
      messages: [
        ..._questionContext(ritual),
        if (online == null) ...[
          Text('翻开三张塔罗', style: text.titleMedium),
          const SizedBox(height: 12),
          TarotReveal(draw: chart.tarot),
        ],
        ..._feedback(),
        if (online != null && busy && !hasReport)
          const GuideConversationReply(body: '正在解读…'),
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
          ReadingReportView(report: report),
        ],
        const SizedBox(height: 16),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: OutlinedButton.icon(
            onPressed: () => setState(() => _showCharts = !_showCharts),
            icon: Icon(_showCharts ? Icons.expand_less : Icons.expand_more),
            label: Text(_showCharts ? '收起盘面' : '查看盘面'),
          ),
        ),
        if (_showCharts) ...[
          const SizedBox(height: 20),
          if (online != null) ...[
            Text('翻开三张塔罗', style: text.titleMedium),
            const SizedBox(height: 12),
            TarotReveal(draw: chart.tarot),
            const SizedBox(height: 20),
          ],
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
        if (hasReport) ...[
          const SizedBox(height: 20),
          GuideFollowUpList(followUps: reading!.followUps),
          if (!canFollowUp) const Text('这次算事的追问已达上限，可以另问一件事。'),
        ],
      ],
      composer: canFollowUp
          ? GuideComposer(
              form: _followUpForm,
              text: _followUp,
              label: '基于当前盘面追问',
              sendLabel: '发送追问',
              send: _sendFollowUp,
              busy: busy,
              followUp: true,
              actions: [
                guideComposerAction(
                  label: '另问一件事',
                  action: busy ? null : _restart,
                ),
              ],
            )
          : Align(
              alignment: AlignmentDirectional.centerStart,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
                child: guideComposerAction(
                  label: '另问一件事',
                  action: busy ? null : _restart,
                ),
              ),
            ),
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

  Future<void> _sendFollowUp() async {
    if (_followUpForm.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    final online = widget.online;
    await online?.followUp(_followUp.text.trim());
    if (!mounted || widget.online != online) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_reportScroll.hasClients) return;
      final end = _reportScroll.position.maxScrollExtent;
      if (MediaQuery.disableAnimationsOf(context) ||
          MediaQuery.accessibleNavigationOf(context)) {
        _reportScroll.jumpTo(end);
      } else {
        unawaited(
          _reportScroll.animateTo(
            end,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          ),
        );
      }
    });
  }
}
