import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart' show KeyDownEvent, LogicalKeyboardKey;
import 'package:jovian_destiny/jovian_destiny.dart'
    show Pillar, baziAnnualPillar, detailsFromKnownBaZiPillars;
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import '../../../../ui/theme.dart';
import '../../../destiny/view/destiny_report_text.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../control/personal_report_loader.dart';
import '../model/personal_report_data.dart';
import 'reports_page.dart';

part 'personal_report_bottle.dart';
part 'personal_report_chapters.dart';
part 'personal_report_chapter_copy.dart';
part 'personal_report_elements.dart';
part 'personal_report_orbit.dart';
part 'personal_report_relationship_radar.dart';
part 'personal_report_shensha.dart';
part 'personal_report_topics.dart';
part 'personal_report_topic_graphics.dart';
part 'personal_report_topic_copy.dart';
part 'personal_report_timeline.dart';
part 'personal_report_zodiac.dart';
part 'personal_report_zodiac_card.dart';
part 'personal_report_zodiac_copy.dart';

PageRoute<void> personalReportRoute(
  BuildContext context,
  Widget child, {
  RouteSettings? settings,
}) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  final reduced = MediaQuery.disableAnimationsOf(context);
  return PageRouteBuilder<void>(
    settings: settings,
    opaque: false,
    barrierDismissible: true,
    barrierColor: dark ? const Color(0x7d000000) : const Color(0x421a1917),
    barrierLabel: context.uiLabel('关闭报告'),
    transitionDuration: reduced
        ? Duration.zero
        : const Duration(milliseconds: 360),
    reverseTransitionDuration: reduced
        ? Duration.zero
        : const Duration(milliseconds: 240),
    pageBuilder: (_, _, _) => child,
    transitionsBuilder: (_, animation, _, child) => SlideTransition(
      position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
        CurvedAnimation(
          parent: animation,
          curve: const Cubic(.21, .77, .28, 1),
        ),
      ),
      child: child,
    ),
  );
}

enum _ReportView { elements, zodiac, tenGods, shenSha, chapter }

class PersonalReportPage extends StatelessWidget {
  const PersonalReportPage({super.key, required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: account,
    builder: (context, _) {
      final owner = account.sessionChanging ? null : account.authorizedSession;
      return ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: _PersonalReportSheet(
          key: ValueKey((account, owner?.scope)),
          account: account,
          owner: owner,
        ),
      );
    },
  );
}

class _PersonalReportSheet extends StatefulWidget {
  const _PersonalReportSheet({
    super.key,
    required this.account,
    required this.owner,
  });

  final AccountController account;
  final AccountSession? owner;

  @override
  State<_PersonalReportSheet> createState() => _PersonalReportSheetState();
}

class _PersonalReportSheetState extends State<_PersonalReportSheet> {
  final _closed = Completer<void>();
  late final _reading = switch (widget.owner) {
    final owner? => loadPersonalReport(widget.account, owner, _closed.future),
    null => null,
  };
  _ReportView? _detail;
  _ReportChapterTarget? _chapter;
  int _zodiacIndex = 0;
  double _drag = 0;
  bool _dragging = false;

  @override
  void dispose() {
    _closed.complete();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop();

  void _openArchive() => Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => ReportsPage(account: widget.account)),
  );

  void _open(_ReportView view) => setState(() => _detail = view);

  void _openChapter(_ReportChapterTarget chapter) => setState(() {
    _chapter = chapter;
    _detail = _ReportView.chapter;
  });

  void _back() => setState(() {
    _chapter = null;
    _detail = null;
  });

  void _finishDrag({double velocity = 0}) {
    final dismiss = _drag >= 110 || (_drag >= 46 && velocity >= 650);
    if (dismiss) {
      _close();
    } else {
      setState(() {
        _drag = 0;
        _dragging = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<PersonalReportData?>(
    future: _reading,
    builder: (context, snapshot) => _buildReport(
      context,
      snapshot.data ?? PersonalReportData.sample,
      snapshot.connectionState == ConnectionState.waiting,
    ),
  );

  Widget _buildReport(
    BuildContext context,
    PersonalReportData data,
    bool loading,
  ) {
    final colors = Theme.of(context).colorScheme;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final current = _detail;
    return PopScope<void>(
      canPop: current == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _detail != null) _back();
      },
      child: SafeArea(
        minimum: const EdgeInsets.all(10),
        child: LayoutBuilder(
          builder: (context, bounds) {
            return Align(
              child: AnimatedSlide(
                duration: reduced || _dragging
                    ? Duration.zero
                    : const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                offset: Offset(0, _drag / math.max(1, bounds.maxHeight)),
                child: SizedBox(
                  key: const ValueKey('personal-report-sheet'),
                  width: math.min(bounds.maxWidth, jovianPageWidth),
                  height: bounds.maxHeight,
                  child: Material(
                    color: colors.surface,
                    elevation: 12,
                    borderRadius: const BorderRadius.all(Radius.circular(25)),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        SizedBox(
                          height: 54,
                          child: Stack(
                            children: [
                              Positioned.fill(
                                child: GestureDetector(
                                  behavior: HitTestBehavior.opaque,
                                  onVerticalDragStart: (_) =>
                                      setState(() => _dragging = true),
                                  onVerticalDragUpdate: (details) =>
                                      setState(() {
                                        _drag = math.max(
                                          0,
                                          _drag + details.delta.dy,
                                        );
                                      }),
                                  onVerticalDragEnd: (details) => _finishDrag(
                                    velocity: details.primaryVelocity ?? 0,
                                  ),
                                  onVerticalDragCancel: _finishDrag,
                                  child: Column(
                                    children: [
                                      const SizedBox(height: 6),
                                      DecoratedBox(
                                        decoration: BoxDecoration(
                                          color: colors.outline,
                                          borderRadius: BorderRadius.circular(
                                            2,
                                          ),
                                        ),
                                        child: const SizedBox(
                                          width: 28,
                                          height: 4,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Semantics(
                                        header: true,
                                        child: const UiText(
                                          '我的报告',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              PositionedDirectional(
                                start: 8,
                                top: 3,
                                child: _ReportSheetAction(
                                  label: '已保存的报告',
                                  icon: Icons.folder_open_rounded,
                                  onPressed: _openArchive,
                                ),
                              ),
                              PositionedDirectional(
                                end: 8,
                                top: 3,
                                child: _ReportSheetAction(
                                  label: '关闭报告',
                                  icon: Icons.close_rounded,
                                  onPressed: _close,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Offstage(
                                offstage: current != null,
                                child: TickerMode(
                                  enabled: current == null,
                                  child: ExcludeFocus(
                                    excluding: current != null,
                                    child: _ReportOverview(
                                      data: data,
                                      loading: loading,
                                      name: data.example
                                          ? '一束'
                                          : widget.owner?.displayName,
                                      onOpen: _open,
                                      onOpenChapter: _openChapter,
                                    ),
                                  ),
                                ),
                              ),
                              if (current != null)
                                _PersonalReportDetail(
                                  key: ValueKey(current),
                                  view: current,
                                  data: data,
                                  back: _back,
                                  chapter: _chapter,
                                  zodiacIndex: _zodiacIndex,
                                  onZodiacChanged: (index) =>
                                      _zodiacIndex = index,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ReportSheetAction extends StatelessWidget {
  const _ReportSheetAction({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: context.uiLabel(label),
      onPressed: onPressed,
      icon: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: colors.onSurface.withValues(alpha: .095),
        ),
        child: SizedBox(width: 24, height: 24, child: Icon(icon, size: 15)),
      ),
    );
  }
}

class _ReportOverview extends StatefulWidget {
  const _ReportOverview({
    required this.data,
    required this.loading,
    required this.name,
    required this.onOpen,
    required this.onOpenChapter,
  });

  final PersonalReportData data;
  final bool loading;
  final String? name;
  final ValueChanged<_ReportView> onOpen;
  final ValueChanged<_ReportChapterTarget> onOpenChapter;

  @override
  State<_ReportOverview> createState() => _ReportOverviewState();
}

class _ReportOverviewState extends State<_ReportOverview>
    with SingleTickerProviderStateMixin {
  final _scroll = ScrollController(keepScrollOffset: false);
  final _introKey = GlobalKey();
  late final _topicPosition = AnimationController.unbounded(vsync: this);
  _ReportTopic _topic = _ReportTopic.overview;
  double? _introHeightAtTransition;

  @override
  void dispose() {
    _topicPosition.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _moveTopics(double position) {
    _introHeightAtTransition = _introKey.currentContext?.size?.height;
    _topicPosition.value = position.clamp(
      0.0,
      _ReportTopic.values.length - 1.0,
    );
  }

  void _choose(_ReportTopic topic) {
    _introHeightAtTransition = _introKey.currentContext?.size?.height;
    final index = topic.index.toDouble();
    final distance = (_topicPosition.value - index).abs();
    if (MediaQuery.disableAnimationsOf(context) || distance < .001) {
      _topicPosition.value = index;
      _commitTopic(topic);
      return;
    }
    _topicPosition
        .animateTo(
          index,
          duration: Duration(
            milliseconds: 180 + (distance * 55).clamp(0, 170).round(),
          ),
          curve: Curves.easeOutCubic,
        )
        .then((_) {
          if (mounted) _commitTopic(topic);
        });
  }

  double _topicScrollOffset() {
    final introHeight = _introHeightAtTransition;
    return _scroll.hasClients && introHeight != null
        ? math.max(0, _scroll.offset - introHeight)
        : 0;
  }

  void _commitTopic(_ReportTopic topic) {
    if (topic == _topic) return;
    final introHeight = _introKey.currentContext?.size?.height;
    if (introHeight != null &&
        _scroll.hasClients &&
        _scroll.offset > introHeight) {
      // Keep the strip pinned while revealing the first card of the new topic.
      _scroll.jumpTo(introHeight);
    }
    setState(() => _topic = topic);
  }

  void _step(int direction) {
    final index = (_topicPosition.value.round() + direction).clamp(
      0,
      _ReportTopic.values.length - 1,
    );
    _choose(_ReportTopic.values[index]);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final muted = colors.onSurfaceVariant;
    final data = widget.data;
    final name = widget.name;
    final placements = _reportPlacements(data);
    final sun = data.zodiacSigns['Sun'];
    final dayMaster = data.dayMaster;
    final headline = [
      if (sun != null) '${context.uiLabel('太阳')} ${context.uiLabel(sun)}',
      if (dayMaster != null)
        '${context.uiLabel('日主')} ${_dayMasterText(context, dayMaster)}',
    ].join('  ·  ');
    final source = switch (data.origin) {
      PersonalReportOrigin.example =>
        widget.loading ? '正在读取命盘 · 下方为示例' : '示例报告 · 命盘与解读为示例',
      PersonalReportOrigin.archive => '基于最近一次保存的命盘',
      PersonalReportOrigin.birthProfile => '基于你的出生资料',
    };
    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 350;
        final inset = narrow ? 12.0 : 18.0;
        final gap = narrow ? 8.0 : 10.0;
        final stripHeight = _ReportTopicStrip.heightOf(context);
        return CustomScrollView(
          key: const ValueKey('personal-report-overview'),
          controller: _scroll,
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                key: _introKey,
                padding: EdgeInsets.fromLTRB(inset, 16, inset, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Column(
                      children: [
                        UiText(
                          '我的报告：',
                          style: TextStyle(fontSize: 12, color: muted),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          name?.trim().isNotEmpty == true
                              ? name!
                              : context.uiLabel('访客'),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 34,
                            height: 1.2,
                            letterSpacing: -1.4,
                          ),
                        ),
                        const SizedBox(height: 5),
                        if (headline.isNotEmpty)
                          Text(
                            headline,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 17, color: muted),
                          ),
                        const SizedBox(height: 10),
                        UiText(
                          source,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11, color: muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    _ReportGlass(
                      radius: 18,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      onTap: () => widget.onOpen(_ReportView.elements),
                      child: Row(
                        spacing: 14,
                        children: [
                          const _ReportLabel('五行', Icons.grain_rounded),
                          Expanded(
                            child: _ElementScale(elements: data.elements),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: gap),
                    _ReportGlass(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                      onTap: () => widget.onOpen(_ReportView.zodiac),
                      child: _ZodiacSummary(placements: placements),
                    ),
                    SizedBox(height: gap),
                    SizedBox(
                      height: narrow ? 168 : 188,
                      child: Row(
                        spacing: gap,
                        children: [
                          Expanded(
                            child: _SymbolCover(
                              title: '十神',
                              icon: Icons.science_outlined,
                              onTap: () => widget.onOpen(_ReportView.tenGods),
                              child: _TenGodBottle(gods: data.gods),
                            ),
                          ),
                          Expanded(
                            child: _SymbolCover(
                              title: '神煞',
                              icon: Icons.style_outlined,
                              onTap: () => widget.onOpen(_ReportView.shenSha),
                              child: _ShenShaCoverDeck(hits: data.shenSha),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            PinnedHeaderSliver(
              child: ColoredBox(
                color: colors.surface,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(inset, 6, inset, 9),
                  child: _ReportTopicStrip(
                    height: stripHeight,
                    selected: _topic,
                    position: _topicPosition,
                    onMove: _moveTopics,
                    onChoose: _choose,
                    onStep: _step,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _ReportTopicPages(
                selected: _topic,
                position: _topicPosition,
                scrollPastStrip: _topicScrollOffset,
                onMove: _moveTopics,
                onChoose: _choose,
                padding: EdgeInsets.fromLTRB(inset, 7, inset, 24),
                minimumHeight: math.max(
                  0.0,
                  constraints.maxHeight - stripHeight - 46,
                ),
                data: data,
                onOpen: widget.onOpenChapter,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ReportGlass extends StatelessWidget {
  const _ReportGlass({
    required this.child,
    this.radius = 21,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    this.onTap,
  });

  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final dark = colors.brightness == Brightness.dark;
    final corners = BorderRadius.circular(radius);
    final edge = dark ? const Color(0x69d2d2d2) : const Color(0xe6ffffff);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: corners,
        boxShadow: [
          BoxShadow(
            color: dark ? const Color(0x56000000) : const Color(0x30050c1b),
            blurRadius: 20,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Material(
        color: Color.alphaBlend(
          colors.onSurface.withValues(alpha: dark ? .035 : .055),
          colors.surface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: corners,
          side: BorderSide(color: edge),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

class _ReportLabel extends StatelessWidget {
  const _ReportLabel(this.label, this.icon);

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 5,
      children: [
        Icon(icon, size: 15, color: ink),
        Flexible(
          child: UiText(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: ink,
            ),
          ),
        ),
      ],
    );
  }
}

class _PersonalReportDetail extends StatelessWidget {
  const _PersonalReportDetail({
    super.key,
    required this.view,
    required this.data,
    required this.back,
    required this.chapter,
    required this.zodiacIndex,
    required this.onZodiacChanged,
  });

  final _ReportView view;
  final PersonalReportData data;
  final VoidCallback back;
  final _ReportChapterTarget? chapter;
  final int zodiacIndex;
  final ValueChanged<int> onZodiacChanged;

  @override
  Widget build(BuildContext context) {
    final inset = switch (view) {
      _ReportView.zodiac || _ReportView.shenSha => 12.0,
      _ => 22.0,
    };
    const top = 8.0;
    const bottom = 18.0;
    const backHeight = 42.0;
    final header = Align(
      alignment: AlignmentDirectional.centerStart,
      child: SizedBox(
        height: backHeight,
        child: TextButton.icon(
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 2),
          ),
          onPressed: back,
          icon: const Icon(Icons.chevron_left_rounded, size: 18),
          label: const UiText('返回上一级报告'),
        ),
      ),
    );
    return LayoutBuilder(
      builder: (context, bounds) {
        final body = switch (view) {
          _ReportView.zodiac => _ZodiacExplorer(
            placements: _reportPlacements(data),
            initialIndex: zodiacIndex,
            onChanged: onZodiacChanged,
            availableHeight: bounds.maxHeight - top - backHeight - bottom,
          ),
          _ReportView.elements => _ElementDetail(data: data),
          _ReportView.tenGods => _TenGodDetail(data: data),
          _ReportView.shenSha => _ShenShaDetail(
            key: ValueKey((data.origin, data.shenSha.length)),
            data: data,
          ),
          _ReportView.chapter => _ReportChapterReader(
            data: data,
            target: chapter!,
          ),
        };
        final fullCard = view == _ReportView.shenSha;
        return Padding(
          padding: EdgeInsets.fromLTRB(
            inset,
            fullCard ? 0 : top,
            inset,
            fullCard ? 6 : 0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              header,
              Expanded(
                child: fullCard
                    ? body
                    : ListView(
                        padding: const EdgeInsets.only(bottom: bottom),
                        children: [body],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
