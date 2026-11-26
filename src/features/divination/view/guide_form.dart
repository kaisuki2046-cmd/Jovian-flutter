import 'dart:async';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import 'composer_attachment.dart';
import 'guide_composer.dart';
import 'guide_conversation.dart';
import 'liuyao_form.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'ritual/guide_ritual_dialog.dart';
import 'tarot_cards.dart';

class GuideForm extends StatefulWidget {
  const GuideForm({
    super.key,
    this.online,
    this.openSynastry,
    this.active = true,
    this.attachmentPicker = pickComposerAttachments,
  });

  final OnlineGuideController? online;
  final VoidCallback? openSynastry;
  final bool active;
  final ComposerAttachmentPicker attachmentPicker;

  @override
  State<GuideForm> createState() => _GuideFormState();
}

class _GuideFormState extends State<GuideForm>
    with AutomaticKeepAliveClientMixin {
  final _form = GlobalKey<FormState>();
  final _followUpForm = GlobalKey<FormState>();
  final _scaffold = GlobalKey<ScaffoldState>();
  final _question = TextEditingController();
  final _questionFocus = FocusNode();
  final _followUp = TextEditingController();
  final _followUpFocus = FocusNode();
  final _ritualChanges = ValueNotifier(0);
  StreamSubscription<void>? _onlineChanges;
  DialogRoute<void>? _ritualRoute;
  GuideRitualPresentation? _presentation;
  final _clarifications =
      <
        ({String question, String reply, List<ComposerAttachment> attachments})
      >[];
  ({String text, TextEditingValue draft, List<ComposerAttachment> attachments})?
  _pendingQuestion;
  int _sentRevision = 0;
  bool _showCharts = false;
  final _ownedAttachments = <ComposerAttachment>{};
  final _draftAttachments = <ComposerAttachment>[];
  final _localQuestionTurns = <ComposerAttachmentTurn>[];
  final _localFollowUpTurns = <ComposerAttachmentTurn>[];
  final _sentFollowUpAttachments = <int, List<ComposerAttachment>>{};
  List<ComposerAttachment> _readingAttachments = const [];
  ({int index, String question, List<ComposerAttachment> attachments})?
  _sendingFollowUp;
  Object? _attachmentSelection;
  String? _attachmentError;

  @override
  bool get wantKeepAlive => true;

  GuideRitualSnapshot? get _snapshot => widget.online?.reading?.snapshot;

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
      _attachOnline();
    }
    if (oldWidget.active && !widget.active) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !widget.active) _scaffold.currentState?.closeDrawer();
      });
    }
  }

  void _attachOnline() {
    final online = widget.online;
    if (online == null) return;
    _onlineChanges = online.changes.listen((_) {
      if (!mounted) return;
      setState(() {
        final sent = _sendingFollowUp;
        final followUps = online.reading?.followUps ?? const [];
        if (sent != null && followUps.length > sent.index) {
          if (followUps[sent.index].question == sent.question) {
            _sentFollowUpAttachments[sent.index] = sent.attachments;
            _draftAttachments.removeWhere(sent.attachments.contains);
            if (_followUp.text.trim() == sent.question) _followUp.clear();
          }
          _sendingFollowUp = null;
        }
      });
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
    _followUpFocus.dispose();
    _releaseAttachments();
    super.dispose();
  }

  void _sendQuestion() {
    if (_attachmentSelection != null || widget.online?.busy == true) return;
    final question = _question.text.trim();
    if (question.isEmpty && _draftAttachments.isNotEmpty) {
      _sendLocalAttachments(_localQuestionTurns, _clarifications.length);
      return;
    }
    final online = widget.online;
    if (online == null || _form.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    _presentation = null;
    setState(() {
      _pendingQuestion = (
        text: question,
        draft: _question.value,
        attachments: _takeDraftAttachments(),
      );
      _sentRevision++;
      _question.clear();
    });
    unawaited(_startOnline(online, question));
  }

  Future<void> _startOnline(
    OnlineGuideController online,
    String question,
  ) async {
    await online.start(question, automatic: false);
    _finishQuestion(online);
  }

  void _finishQuestion(OnlineGuideController online) {
    final pending = _pendingQuestion;
    if (!mounted || widget.online != online || pending == null) return;
    if (online.reading != null) {
      setState(() {
        _readingAttachments = _acceptQuestion();
      });
      if (_snapshot?.stage == GuideStage.cast) _openRitual();
    } else if (online.canRetry || online.questionStopped) {
      setState(() {
        if (_question.text.isEmpty) _question.value = pending.draft;
        for (final attachment in pending.attachments) {
          if (!_draftAttachments.contains(attachment)) {
            _draftAttachments.add(attachment);
          }
        }
        if (online.questionStopped) _pendingQuestion = null;
      });
    } else if (online.message case final reply?) {
      setState(() {
        _clarifications.add((
          question: pending.text,
          reply: reply,
          attachments: _acceptQuestion(),
        ));
      });
    }
  }

  List<ComposerAttachment> _takeDraftAttachments() {
    final attachments = List.of(_draftAttachments);
    _draftAttachments.clear();
    _attachmentError = null;
    return attachments;
  }

  List<ComposerAttachment> _acceptQuestion() {
    final pending = _pendingQuestion!;
    _draftAttachments.removeWhere(pending.attachments.contains);
    if (_question.text == pending.draft.text) _question.clear();
    _pendingQuestion = null;
    return pending.attachments;
  }

  void _sendLocalAttachments(List<ComposerAttachmentTurn> turns, int after) {
    FocusScope.of(context).unfocus();
    setState(() {
      turns.add((after: after, attachments: _takeDraftAttachments()));
      _sentRevision++;
    });
  }

  Future<void> _addAttachment(ComposerAttachmentKind kind) async {
    if (_attachmentSelection != null || widget.online?.busy == true) return;
    final attempt = Object();
    setState(() {
      _attachmentSelection = attempt;
      _attachmentError = null;
    });
    try {
      final files = await widget.attachmentPicker(kind);
      if (!mounted || _attachmentSelection != attempt) {
        for (final file in files) {
          file.release();
        }
        return;
      }
      setState(() {
        _ownedAttachments.addAll(files);
        _draftAttachments.addAll(files);
      });
    } catch (_) {
      if (mounted && _attachmentSelection == attempt) {
        setState(() => _attachmentError = '未能读取所选附件，请重新选择。');
      }
    } finally {
      if (mounted && _attachmentSelection == attempt) {
        setState(() => _attachmentSelection = null);
      }
    }
  }

  void _removeAttachment(ComposerAttachment attachment) {
    setState(() {
      _draftAttachments.remove(attachment);
      _attachmentError = null;
      if (_pendingQuestion?.attachments.contains(attachment) != true &&
          _sendingFollowUp?.attachments.contains(attachment) != true) {
        _ownedAttachments.remove(attachment);
        attachment.release();
      }
    });
  }

  void _releaseAttachments() {
    for (final attachment in _ownedAttachments) {
      attachment.release();
    }
    _ownedAttachments.clear();
    _attachmentSelection = null;
  }

  void _openRitual() {
    final online = widget.online;
    if (!widget.active ||
        _ritualRoute != null ||
        _snapshot == null ||
        online == null ||
        !online.canContinue)
      return;
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
        toss: () => unawaited(online.toss()),
        choose: (slot) => unawaited(online.pick(slot)),
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
    FocusScope.of(context).unfocus();
    setState(_clearDraft);
    unawaited(widget.online?.nextQuestion(carryContext: false));
  }

  void _selectHistory(String id) {
    final online = widget.online;
    if (online == null || online.busy) return;
    _closeHistory();
    if (online.activeHistoryId == id) return;
    setState(_clearDraft);
    unawaited(online.openHistory(id));
  }

  void _closeHistory() {
    FocusManager.instance.primaryFocus?.unfocus();
    _scaffold.currentState?.closeDrawer();
  }

  void _clearDraft() {
    _removeRitualRoute();
    _presentation = null;
    _question.clear();
    _followUp.clear();
    _pendingQuestion = null;
    _clarifications.clear();
    _releaseAttachments();
    _draftAttachments.clear();
    _localQuestionTurns.clear();
    _localFollowUpTurns.clear();
    _sentFollowUpAttachments.clear();
    _readingAttachments = const [];
    _sendingFollowUp = null;
    _attachmentError = null;
    _showCharts = false;
  }

  void _setSuggestedQuestion(String question) {
    _fillQuestion(_question, _questionFocus, question);
  }

  void _setSuggestedFollowUp(String question) {
    _fillQuestion(_followUp, _followUpFocus, question);
  }

  void _fillQuestion(
    TextEditingController text,
    FocusNode focus,
    String question,
  ) {
    text.value = TextEditingValue(
      text: question,
      selection: TextSelection.collapsed(offset: question.length),
    );
    focus.requestFocus();
  }

  Object get _latestMessage => (
    _clarifications.length,
    _localQuestionTurns.length,
    _localFollowUpTurns.length,
    _pendingQuestion?.text,
    widget.online?.busy,
    widget.online?.message,
    widget.online?.reading?.report,
    widget.online?.reading?.followUps.length,
  );

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final online = widget.online;
    return Scaffold(
      key: _scaffold,
      drawerEnableOpenDragGesture: false,
      drawer: GuideConversationHistory(
        entries: online?.history ?? const [],
        activeId: online?.activeHistoryId,
        open: online?.busy == true ? null : _selectHistory,
        back: _closeHistory,
      ),
      appBar: AppBar(
        toolbarHeight: 48,
        centerTitle: true,
        titleTextStyle: Theme.of(context).textTheme.titleMedium,
        title: const UiText('对话'),
        leading: IconButton(
          tooltip: '会话历史',
          icon: const Icon(Icons.menu_rounded),
          onPressed: () {
            FocusScope.of(context).unfocus();
            _scaffold.currentState?.openDrawer();
          },
        ),
        actions: [
          IconButton(
            tooltip: '新对话',
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: online?.busy == true ? null : _restart,
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          IgnorePointer(
            child: Image.asset(
              'src/features/divination/assets/assistant/antique-gold-dust.png',
              fit: BoxFit.fill,
              opacity: const AlwaysStoppedAnimation(0.1),
              excludeFromSemantics: true,
            ),
          ),
          SafeArea(top: false, child: _conversationBody(context)),
        ],
      ),
    );
  }

  Widget _conversationBody(BuildContext context) {
    final online = widget.online;
    final busy = online?.busy ?? false;
    final ritual = _snapshot;
    if (ritual == null) {
      final welcome =
          !busy &&
          _pendingQuestion == null &&
          _clarifications.isEmpty &&
          _localQuestionTurns.isEmpty &&
          online?.questionStopped != true;
      return GuideThread(
        key: const ValueKey('guide-question'),
        latestMessage: _latestMessage,
        sentRevision: _sentRevision,
        welcome: welcome ? const GuideWelcome() : null,
        messages: [
          ..._conversation(),
          if (_pendingQuestion case final submitted?) ...[
            GuideQuestionBubble(
              submitted.text,
              attachments: submitted.attachments,
            ),
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
          hint: '输入你想测算的问题…',
          sendLabel: '发送消息',
          busy: busy || _attachmentSelection != null,
          textSendingAvailable: online != null,
          send: _sendQuestion,
          stop: online?.canStopUnderstanding == true
              ? online!.stopUnderstanding
              : null,
          suggest: _setSuggestedQuestion,
          startQuestion: _questionFocus.requestFocus,
          openSynastry: widget.openSynastry,
          showAssistant: !welcome,
          actions: [if (online == null) const UiText('算事服务当前未连接，暂时无法发送问题。')],
          attachments: _draftAttachments,
          addAttachment: _addAttachment,
          removeAttachment: _removeAttachment,
          attachmentError: _attachmentError,
        ),
      );
    }

    return switch (ritual.stage) {
      GuideStage.cast || GuideStage.draw => _buildRitualPrompt(ritual),
      GuideStage.reading when _presentation?.needsReveal(ritual) == true =>
        _buildRitualPrompt(ritual),
      GuideStage.reading => _buildResult(context, ritual),
    };
  }

  Widget _buildRitualPrompt(GuideRitualSnapshot ritual) => GuideThread(
    key: ValueKey(ritual.stage),
    latestMessage: _latestMessage,
    sentRevision: _sentRevision,
    messages: [
      ..._conversation(),
      ..._questionContext(ritual),
      ..._feedback(),
      if (widget.online?.canContinue != false)
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: OutlinedButton(
            onPressed: _openRitual,
            child: const UiText('继续本次仪式'),
          ),
        )
      else
        guideComposerAction(
          label: '另问一件事',
          action: widget.online?.busy == true ? null : _restart,
        ),
    ],
  );

  List<Widget> _conversation() => [
    for (var index = 0; index <= _clarifications.length; index++) ...[
      for (final turn in _localQuestionTurns.where(
        (turn) => turn.after == index,
      )) ...[
        GuideQuestionBubble('', attachments: turn.attachments),
        const SizedBox(height: 12),
      ],
      if (index < _clarifications.length) ...[
        GuideQuestionBubble(
          _clarifications[index].question,
          attachments: _clarifications[index].attachments,
        ),
        const SizedBox(height: 8),
        GuideConversationReply(body: _clarifications[index].reply),
        const SizedBox(height: 12),
      ],
    ],
  ];

  List<Widget> _questionContext(GuideRitualSnapshot ritual) => [
    GuideQuestionBubble(ritual.question, attachments: _readingAttachments),
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
    final live = online?.canContinue == true;
    final canFollowUp = live && hasReport && reading!.followUps.length < 8;
    return GuideThread(
      key: ValueKey(('guide-result', online?.activeHistoryId)),
      latestMessage: _latestMessage,
      sentRevision: _sentRevision,
      messages: [
        ..._conversation(),
        ..._questionContext(ritual),
        if (!hasReport) ..._feedback(),
        if (online != null && busy && !hasReport)
          const GuideConversationReply(body: '正在解读…'),
        if (live &&
            online != null &&
            !busy &&
            reading?.report == null &&
            !online.canRetry) ...[
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: online.requestReport,
            child: const UiText('获取解读'),
          ),
        ],
        if (reading?.report case final report?) ...[
          ReadingReportView(report: report),
        ],
        const SizedBox(height: 16),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Semantics(
            expanded: _showCharts,
            child: OutlinedButton.icon(
              onPressed: () => setState(() => _showCharts = !_showCharts),
              icon: Icon(_showCharts ? Icons.expand_less : Icons.expand_more),
              label: Text(_showCharts ? '收起盘面' : '查看三套盘面'),
            ),
          ),
        ),
        if (_showCharts) ...[
          const SizedBox(height: 20),
          UiText('翻开三张塔罗', style: text.titleMedium),
          const SizedBox(height: 12),
          TarotReveal(draw: chart.tarot),
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
        if (hasReport) ...[
          const SizedBox(height: 20),
          GuideFollowUpList(
            followUps: reading!.followUps,
            evidence: reading.evidence,
            attachments: _sentFollowUpAttachments,
            localTurns: _localFollowUpTurns,
          ),
          ..._feedback(),
          if (live && !canFollowUp) const UiText('这次算事的追问已达上限，可以另问一件事。'),
        ],
      ],
      composer: canFollowUp
          ? GuideComposer(
              form: _followUpForm,
              text: _followUp,
              focus: _followUpFocus,
              hint: '接着上一题问',
              sendLabel: '发送消息',
              send: _sendFollowUp,
              busy: busy || _attachmentSelection != null,
              showAssistant: true,
              suggest: _setSuggestedFollowUp,
              startQuestion: _restart,
              openSynastry: widget.openSynastry,
              attachments: _draftAttachments,
              addAttachment: _addAttachment,
              removeAttachment: _removeAttachment,
              attachmentError: _attachmentError,
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
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: online.canStopUnderstanding
              ? Semantics(liveRegion: true, child: const UiText('正在理解你的问题…'))
              : const LinearProgressIndicator(semanticsLabel: '正在处理算事请求'),
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
          onPressed: _attachmentSelection != null
              ? null
              : () async {
                  await online.retry();
                  _finishQuestion(online);
                },
          child: const UiText('重试'),
        ),
    ];
  }

  Future<void> _sendFollowUp() async {
    final online = widget.online;
    final reading = online?.reading;
    if (_attachmentSelection != null ||
        online == null ||
        online.busy ||
        reading == null)
      return;
    final question = _followUp.text.trim();
    final index = reading.followUps.length;
    if (question.isEmpty && _draftAttachments.isNotEmpty) {
      _sendLocalAttachments(_localFollowUpTurns, index);
      return;
    }
    if (_followUpForm.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    _sendingFollowUp = (
      index: index,
      question: question,
      attachments: List.of(_draftAttachments),
    );
    _sentRevision++;
    await online.followUp(question);
  }
}
