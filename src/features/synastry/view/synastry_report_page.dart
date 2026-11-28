import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/report_body.dart';
import '../control/synastry_page_controller.dart';
import '../model/synastry_relationship.dart';
import 'synastry_record_box.dart';

RawDialogRoute<void> synastryReportRoute(
  BuildContext context, {
  required SynastryEdition edition,
  required Widget content,
  Rect? Function()? boxBounds,
  VoidCallback? onCollecting,
}) {
  final navigator = Navigator.of(context);
  final themes = InheritedTheme.capture(from: context, to: navigator.context);
  return RawDialogRoute<void>(
    barrierDismissible: false,
    barrierColor: Theme.of(context).colorScheme.shadow.withValues(alpha: .32),
    transitionDuration: _reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 250),
    pageBuilder: (_, _, _) => themes.wrap(
      _ReportDialog(
        edition: edition,
        boxBounds: boxBounds,
        onCollecting: onCollecting,
        content: content,
      ),
    ),
    transitionBuilder: (_, animation, _, child) => FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: animation.drive(
          Tween(
            begin: const Offset(0, .022),
            end: Offset.zero,
          ).chain(CurveTween(curve: Curves.easeOutCubic)),
        ),
        child: child,
      ),
    ),
  );
}

bool _reduceMotion(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context) ||
    MediaQuery.accessibleNavigationOf(context);

class _ReportDialog extends StatefulWidget {
  const _ReportDialog({
    required this.edition,
    required this.content,
    this.boxBounds,
    this.onCollecting,
  });

  final SynastryEdition edition;
  final Widget content;
  final Rect? Function()? boxBounds;
  final VoidCallback? onCollecting;

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog>
    with SingleTickerProviderStateMixin {
  final _sceneKey = GlobalKey();
  final _paperKey = GlobalKey();
  late final _collect = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  );
  Rect? _paper;
  Rect? _case;
  bool _closing = false;

  @override
  void dispose() {
    _collect.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    if (_closing || ModalRoute.of(context)?.isCurrent != true) return;
    _closing = true;
    final scene = _sceneKey.currentContext?.findRenderObject();
    final paper = _paperKey.currentContext?.findRenderObject();
    widget.onCollecting?.call();
    if (!_reduceMotion(context) && scene is RenderBox && paper is RenderBox) {
      final origin = scene.localToGlobal(Offset.zero);
      final size = scene.size;
      final available = widget.boxBounds?.call()?.shift(-origin);
      final width = math.min(245.0, size.width * .72);
      final fallback = Rect.fromLTWH(
        size.width - width - 15,
        size.height * .12,
        width,
        width * 196 / 340,
      );
      _case =
          available != null &&
              available.top >= 4 &&
              available.bottom <= size.height
          ? available
          : fallback;
      _paper = paper.localToGlobal(Offset.zero) - origin & paper.size;
      try {
        await _collect.forward().orCancel;
      } on TickerCanceled {
        return;
      }
    }
    if (mounted && ModalRoute.of(context)?.isCurrent == true) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final radius = BorderRadius.circular(24);
    final paper = LayoutBuilder(
      builder: (context, constraints) => Center(
        child: Semantics(
          scopesRoute: true,
          namesRoute: true,
          explicitChildNodes: true,
          label: context.uiLabel('合盘报告'),
          child: SizedBox(
            key: _paperKey,
            width: math.min(640.0, math.max(0.0, constraints.maxWidth - 16)),
            height: constraints.maxWidth < 600
                ? math.max(0.0, constraints.maxHeight - 16)
                : math.min(790.0, math.max(0.0, constraints.maxHeight - 24)),
            child: Material(
              key: const ValueKey('synastry-report-panel'),
              color: colors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: radius,
                side: BorderSide(color: colors.outlineVariant),
              ),
              elevation: 16,
              shadowColor: colors.shadow.withValues(alpha: .36),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 9, 9, 7),
                    child: Row(
                      children: [
                        Expanded(
                          child: UiText(
                            '合盘报告',
                            style: theme.textTheme.titleLarge,
                          ),
                        ),
                        IconButton(
                          key: const ValueKey('synastry-collect-report'),
                          tooltip: context.uiLabel('收进唱片盒'),
                          onPressed: _close,
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  Expanded(
                    child: SingleChildScrollView(
                      key: const PageStorageKey('synastry-report-paper'),
                      padding: const EdgeInsets.fromLTRB(13, 14, 13, 18),
                      child: widget.content,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Shortcuts(
        shortcuts: const {
          SingleActivator(LogicalKeyboardKey.escape): DismissIntent(),
        },
        child: Actions(
          actions: {
            DismissIntent: CallbackAction<DismissIntent>(
              onInvoke: (_) => _close(),
            ),
          },
          child: SafeArea(
            child: AnimatedBuilder(
              animation: _collect,
              child: paper,
              builder: (context, child) {
                final t = _collect.value;
                final collapse = _phase(t, 0, .34);
                return Stack(
                  key: _sceneKey,
                  fit: StackFit.expand,
                  children: [
                    Positioned.fill(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        excludeFromSemantics: true,
                        onTap: _close,
                        child: t == 0 && !_reduceMotion(context)
                            ? BackdropFilter(
                                filter: ImageFilter.blur(
                                  sigmaX: 3.5,
                                  sigmaY: 3.5,
                                ),
                                child: const SizedBox.expand(),
                              )
                            : const SizedBox.expand(),
                      ),
                    ),
                    if (t < .34)
                      IgnorePointer(
                        ignoring: t > 0,
                        child: Opacity(
                          opacity: 1 - collapse,
                          child: Transform.scale(
                            scale: 1 - .51 * collapse,
                            alignment: Alignment.center,
                            child: child,
                          ),
                        ),
                      ),
                    if (_case case final recordCase? when t > 0)
                      ..._putAway(recordCase, t),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _putAway(Rect recordCase, double t) {
    final paper = _paper!;
    final travel = _phase(t, .28, .66);
    final insert = _phase(t, .64, .89);
    final lid = _phase(t, .86, 1);
    final slot = Offset(
      recordCase.left + recordCase.width * 159 / 340,
      recordCase.top + recordCase.height * 115 / 196,
    );
    final width = recordCase.width * 102 / 340;
    final initialWidth = math.min(166.0, paper.width * .49);
    final jacketSize = initialWidth + (width - initialWidth) * travel;
    final atLip = slot.translate(0, -width * .52);
    final location = Offset.lerp(
      paper.center,
      atLip,
      travel,
    )!.translate(0, width * 1.20 * insert);
    final rect = Rect.fromCenter(
      center: location,
      width: jacketSize,
      height: jacketSize,
    );
    final visibleHeight = insert == 0
        ? rect.height
        : math.min(rect.height, math.max(0.0, slot.dy - rect.top));
    return [
      if (t > .3)
        Positioned.fromRect(
          rect: recordCase,
          child: IgnorePointer(
            child: Opacity(
              opacity: _phase(t, .30, .48) * (1 - _phase(t, .94, 1)),
              child: SynastryRecordBox(
                edition: widget.edition,
                hasRecord: false,
                progress: 1 - lid,
              ),
            ),
          ),
        ),
      if (visibleHeight > 0)
        Positioned(
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: visibleHeight,
          child: IgnorePointer(
            child: Opacity(
              opacity: _phase(t, .10, .33),
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.topCenter,
                  minHeight: jacketSize,
                  maxHeight: jacketSize,
                  child: Transform.rotate(
                    angle: -.16 * travel * (1 - insert),
                    child: SynastryJacket(
                      edition: widget.edition,
                      size: jacketSize,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    ];
  }
}

double _phase(double time, double start, double end) =>
    Interval(start, end, curve: Curves.easeInOutCubic).transform(time);

class SynastryCurrentReading extends StatelessWidget {
  const SynastryCurrentReading({
    super.key,
    required this.controller,
    required this.edition,
    required this.comparison,
    this.retryComparison,
    this.openAccount,
    this.openPermissions,
  });

  final SynastryPageController controller;
  final SynastryEdition edition;
  final Widget Function(BuildContext, Map<String, Object?>) comparison;
  final VoidCallback? retryComparison;
  final VoidCallback? openAccount;
  final VoidCallback? openPermissions;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([controller, controller.account]),
    builder: (context, _) {
      final report = controller.report;
      final chart = controller.result;
      final hasSession = controller.hasSession;
      final needsPermission = controller.needsPermission;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          if (controller.busy || controller.restoringLatest)
            LinearProgressIndicator(semanticsLabel: context.uiLabel('正在处理合盘')),
          if (controller.message case final message?) _Notice(message),
          if (report != null) ...[
            SynastryReadingPaper(
              key: ObjectKey(report),
              body: report,
              edition: retryComparison != null
                  ? edition
                  : controller.reportEdition ?? edition,
              savedAt: controller.savedAt,
              fromArchive: controller.reportFromArchive,
            ),
            if (controller.needsSave)
              TextButton(
                onPressed: controller.busy ? null : controller.retrySave,
                child: const UiText('重试存档'),
              ),
          ],
          if (chart != null) ...[
            if (report == null) ...[
              if (hasSession &&
                  (!controller.summaryConfigured || needsPermission))
                OutlinedButton(
                  onPressed: controller.busy
                      ? null
                      : controller.restoreComparedReport,
                  child: const UiText('查看此组合已存解读'),
                ),
              if (!controller.summaryConfigured)
                const _Notice('在线解读服务暂未配置。')
              else if (!hasSession || needsPermission)
                OutlinedButton(
                  onPressed: hasSession
                      ? openPermissions ?? openAccount
                      : openAccount,
                  child: UiText(hasSession ? '前往 AI 授权' : '登录或进入游客体验后生成解读'),
                )
              else
                FilledButton(
                  onPressed: controller.busy
                      ? null
                      : () => controller.generateSummary(edition: edition),
                  child: const UiText('生成合盘解读'),
                ),
            ],
            comparison(context, chart),
          ] else if (!controller.busy &&
              !controller.restoringLatest &&
              report == null) ...[
            if (controller.latestRestoreFailed) const _Notice('暂时无法读取已存合盘。'),
            if (retryComparison case final retry?)
              OutlinedButton(
                onPressed: controller.canCompare ? retry : null,
                child: const UiText('重新合盘'),
              )
            else
              TextButton(
                onPressed: controller.restoreLatest,
                child: const UiText('重试读取'),
              ),
          ],
        ],
      );
    },
  );
}

class SynastryReadingPaper extends StatefulWidget {
  const SynastryReadingPaper({
    super.key,
    required this.body,
    required this.edition,
    required this.savedAt,
    required this.fromArchive,
  });

  final String body;
  final SynastryEdition edition;
  final DateTime? savedAt;
  final bool fromArchive;

  @override
  State<SynastryReadingPaper> createState() => _ReadingPaperState();
}

class _ReadingPaperState extends State<SynastryReadingPaper> {
  static final _relationshipsByLabel = {
    for (final relationship in SynastryRelationship.values)
      relationship.label: relationship,
  };
  static final _headings = RegExp(
    '^## (${_relationshipsByLabel.keys.map(RegExp.escape).join('|')})'
    r'[ \t]*\r?$',
    multiLine: true,
  );

  late SynastryRelationship _selected = widget.edition.relationship;
  late final _sections = _split(widget.body);

  Map<SynastryRelationship, String> _split(String body) {
    final matches = _headings.allMatches(body).toList(growable: false);
    if (matches.isEmpty ||
        body.substring(0, matches.first.start).trim().isNotEmpty) {
      return {};
    }
    final results = <SynastryRelationship, String>{};
    for (var index = 0; index < matches.length; index++) {
      final match = matches[index];
      final relationship = _relationshipsByLabel[match[1]]!;
      if (results.containsKey(relationship)) return {};
      results[relationship] = body
          .substring(
            match.end,
            index + 1 < matches.length ? matches[index + 1].start : body.length,
          )
          .trim();
    }
    return results;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final date = widget.savedAt?.toLocal();
    final subtitle = date == null
        ? context.uiLabel('本次解读暂未存档')
        : '${context.uiLabel('已存档 · ')}${MaterialLocalizations.of(context).formatMediumDate(date)}';
    final section = _sections.containsKey(_selected)
        ? _selected
        : _sections.keys.firstOrNull;
    return Material(
      color: colors.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 11,
          children: [
            SynastryReportHeading(
              edition: widget.edition,
              title: '合盘解读',
              subtitle: subtitle,
            ),
            if (widget.fromArchive)
              UiText(
                '从合盘存档读取',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
            if (_sections.length > 1)
              Wrap(
                spacing: 6,
                runSpacing: 2,
                children: [
                  for (final relationship in _sections.keys)
                    ChoiceChip(
                      label: UiText(relationship.label),
                      selected: relationship == section,
                      showCheckmark: false,
                      onSelected: (_) =>
                          setState(() => _selected = relationship),
                    ),
                ],
              ),
            const Divider(height: 1),
            if (section != null) ReportHeading(context.uiLabel(section.label)),
            ReportBody(section == null ? widget.body : _sections[section]!),
          ],
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Semantics(
      liveRegion: true,
      child: UiText(text, textAlign: TextAlign.center),
    ),
  );
}
