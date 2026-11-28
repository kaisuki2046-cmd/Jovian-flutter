import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show PointerDeviceKind;

import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../account/account.dart';
import '../control/synastry_music.dart';
import '../control/synastry_page_controller.dart';
import '../model/synastry_relationship.dart';
import 'synastry_album_selector.dart';
import 'synastry_cover.dart';
import 'synastry_record_box.dart';
import 'synastry_report_page.dart';
import 'synastry_turntable.dart';

class SynastryRecordStudio extends StatefulWidget {
  const SynastryRecordStudio({
    super.key,
    required this.controller,
    required this.edition,
    required this.currentReading,
  });

  final SynastryPageController controller;
  final SynastryEdition edition;
  final Widget currentReading;

  @override
  State<SynastryRecordStudio> createState() => _SynastryRecordStudioState();
}

class _SynastryRecordStudioState extends State<SynastryRecordStudio>
    with TickerProviderStateMixin {
  final _stage = GlobalKey();
  final _caseAnchor = GlobalKey();
  final _platterAnchor = GlobalKey();
  final _music = SynastryMusic();
  late final _slide = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 760),
  );
  late final _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3400),
  );
  var _index = 0;
  var _revision = 0;
  SynastryEdition? _selectedBox;
  ReportEntry? _record;
  Rect? _from;
  Rect? _to;
  RawDialogRoute<void>? _reportRoute;
  bool _onDeck = false;
  bool _returning = false;
  bool _muted = false;

  @override
  void dispose() {
    final report = _reportRoute;
    if (report != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (report.isActive) report.navigator?.removeRoute(report);
      });
    }
    _music.stop();
    _slide.dispose();
    _spin.dispose();
    super.dispose();
  }

  Rect? _bounds(GlobalKey key) {
    final render = key.currentContext?.findRenderObject();
    return render is RenderBox && render.attached && render.hasSize
        ? render.localToGlobal(Offset.zero) & render.size
        : null;
  }

  bool get _reduced =>
      MediaQuery.disableAnimationsOf(context) ||
      MediaQuery.accessibleNavigationOf(context);

  Future<void> _play(ReportHistoryController history, ReportEntry entry) async {
    if (_record != null || _reportRoute != null) return;
    final reduced = _reduced;
    final edition = SynastryEdition.fromArchiveTitle(entry.title);
    final saved = history.select(entry.id);
    final shell = _bounds(_stage);
    final box = _bounds(_caseAnchor);
    final platter = _bounds(_platterAnchor);
    final canFly =
        !reduced &&
        shell != null &&
        box != null &&
        platter != null &&
        shell.overlaps(box) &&
        shell.overlaps(platter);
    _slide.reset();
    _spin.reset();
    if (canFly) {
      _from = Rect.fromCenter(
        center:
            Offset(
              box.left + box.width * 194 / 340,
              box.top + box.height * 76 / 196,
            ) -
            shell.topLeft,
        width: box.width * .30,
        height: box.width * .30,
      );
      _to = platter.shift(-shell.topLeft);
    }
    setState(() {
      _record = entry;
      _onDeck = !canFly;
    });

    // Start from the record tap so browsers can authorize the sound.
    unawaited(
      _music.play(volume: _muted || canFly ? 0 : .28).then((ready) {
        if (ready && mounted && _record == entry && _onDeck && !_returning) {
          unawaited(_music.setVolume(_muted ? 0 : .28));
        }
      }),
    );

    try {
      if (canFly) {
        await _slide.forward().orCancel;
        if (!mounted) return;
        setState(() {
          _onDeck = true;
          _from = null;
          _to = null;
        });
      }
      if (!reduced) _spin.repeat();
      unawaited(_music.setVolume(_muted ? 0 : .28));
      await Future.wait([
        saved,
        if (!reduced) Future<void>.delayed(const Duration(milliseconds: 950)),
      ]);
      if (!mounted ||
          widget.controller.history != history ||
          ModalRoute.of(context)?.isCurrent != true) {
        return;
      }
      if (history.report case final archive?) {
        await _show(
          edition,
          SynastryReadingPaper(
            body: archive.body,
            edition: edition,
            savedAt: archive.entry.savedAt,
            fromArchive: true,
          ),
        );
      } else if (history.detailError != null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: const UiText('暂时无法读取这次合盘存档，请重试。')));
      }
    } on TickerCanceled {
      return;
    } finally {
      if (mounted) {
        _music.stop();
        _spin.stop();
        if (widget.controller.history == history) history.closeDetail();
        setState(() {
          _record = null;
          _onDeck = false;
          _returning = false;
          _from = null;
          _to = null;
        });
      }
    }
  }

  Future<void> _show(SynastryEdition edition, Widget content) async {
    final route = synastryReportRoute(
      context,
      edition: edition,
      content: content,
      boxBounds: () => _bounds(_caseAnchor),
      onCollecting: () {
        _spin.stop();
        _music.stop();
        setState(() => _returning = true);
      },
    );
    _reportRoute = route;
    await Navigator.of(context).push(route);
    await route.completed;
    if (mounted) {
      _reportRoute = null;
      if (_record == null) setState(() => _returning = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([
      widget.controller,
      widget.controller.account,
    ]),
    builder: (context, _) {
      final history = widget.controller.history;
      return ListenableBuilder(
        listenable: history ?? const AlwaysStoppedAnimation(0),
        builder: (context, _) => _scaffold(context, history),
      );
    },
  );

  Widget _scaffold(BuildContext context, ReportHistoryController? history) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final boxes = <SynastryEdition, List<ReportEntry>>{};
    for (final entry in history?.page?.entries ?? const <ReportEntry>[]) {
      final edition =
          SynastryEdition.matchArchiveTitle(entry.title) ??
          SynastryEdition.other;
      (boxes[edition] ??= []).add(entry);
    }
    final activeBox = boxes.containsKey(_selectedBox)
        ? _selectedBox
        : boxes.keys.firstOrNull;
    final entries = boxes[activeBox] ?? const <ReportEntry>[];
    final index = entries.isEmpty ? 0 : _index.clamp(0, entries.length - 1);
    final record = _record;
    final playingEdition = record == null
        ? null
        : SynastryEdition.fromArchiveTitle(record.title);
    final boxEdition =
        activeBox ?? widget.controller.reportEdition ?? widget.edition;
    final caseWidth = (MediaQuery.sizeOf(context).height * .41).clamp(
      218.0,
      356.0,
    );
    final desk = Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 6,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SynastryTurntable(
          platterKey: _platterAnchor,
          rotation: _spin,
          edition: _onDeck && !_returning ? playingEdition : null,
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                record == null
                    ? context.uiLabel('从唱片盒选一张唱片')
                    : _archiveLabel(context, record),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall,
              ),
            ),
            IconButton.filledTonal(
              tooltip: context.uiLabel(_muted ? '开启纯音乐' : '关闭纯音乐'),
              onPressed: () {
                setState(() => _muted = !_muted);
                unawaited(_music.setVolume(_muted ? 0 : .28));
              },
              icon: Icon(
                _muted ? Icons.volume_off_outlined : Icons.volume_up_outlined,
              ),
            ),
          ],
        ),
      ],
    );
    final shelf = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Row(
          spacing: 10,
          children: [
            UiText('唱片盒', style: theme.textTheme.titleMedium),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  spacing: 6,
                  children: [
                    for (final edition in boxes.keys)
                      ChoiceChip(
                        key: ValueKey(('synastry-record-box', edition)),
                        label: UiText(edition.label),
                        showCheckmark: false,
                        selected: edition == activeBox,
                        selectedColor: Color.lerp(
                          colors.surfaceContainerHighest,
                          SynastryCover.paper(edition),
                          theme.brightness == Brightness.dark ? .15 : .72,
                        ),
                        onSelected: record != null
                            ? null
                            : (_) {
                                if (edition != activeBox) {
                                  setState(() {
                                    _selectedBox = edition;
                                    _index = 0;
                                  });
                                }
                              },
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            color: Color.lerp(
              colors.surfaceContainerLow,
              SynastryCover.paper(boxEdition),
              theme.brightness == Brightness.dark ? .075 : .22,
            ),
            border: Border.all(color: colors.outlineVariant),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: entries.isEmpty || record != null
                  ? null
                  : () => _play(history!, entries[index]),
              child: Semantics(
                label: context.uiLabel('播放当前唱片'),
                child: Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: caseWidth),
                    child: SynastryRecordBox(
                      key: _caseAnchor,
                      edition: boxEdition,
                      hasRecord: entries.isNotEmpty && record == null,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (entries.isNotEmpty)
          _RecordShelf(
            key: ValueKey((boxEdition, _revision)),
            entries: entries,
            index: index,
            enabled: record == null,
            onChanged: (index) => setState(() => _index = index),
            onPlay: (entry) => _play(history!, entry),
          )
        else if (history?.loading != true && history?.listError == null)
          Center(
            child: UiText(
              widget.controller.hasSession ? '暂无合盘报告。' : '进入游客体验或登录后可查看已存唱片。',
            ),
          ),
        if (history?.loading == true) const LinearProgressIndicator(),
        if (history?.listError != null || history?.locked == true)
          const Center(child: UiText('暂时无法读取存档。')),
        if (history != null)
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            children: [
              if (history.page?.nextCursor != null)
                TextButton(
                  onPressed: history.loading || record != null
                      ? null
                      : history.more,
                  child: const UiText('加载更多'),
                ),
              if (history.listError != null || entries.isNotEmpty)
                TextButton(
                  onPressed: history.loading || record != null
                      ? null
                      : () {
                          setState(() {
                            _index = 0;
                            _revision++;
                          });
                          unawaited(history.refresh());
                        },
                  child: const UiText('刷新报告'),
                ),
            ],
          ),
        if (widget.controller.savedAt == null &&
            (widget.controller.report != null ||
                widget.controller.result != null))
          TextButton(
            onPressed: record != null
                ? null
                : () => _show(
                    widget.controller.reportEdition ?? widget.edition,
                    widget.currentReading,
                  ),
            child: const UiText('本次合盘'),
          ),
      ],
    );
    return Scaffold(
      appBar: AppBar(centerTitle: true, title: const UiText('合盘记录')),
      body: SafeArea(
        top: false,
        child: Stack(
          key: _stage,
          fit: StackFit.expand,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final deckWidth = (constraints.maxHeight * .53).clamp(
                  230.0,
                  380.0,
                );
                return SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 7, 16, 22),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 12,
                        children: [
                          Center(
                            child: ConstrainedBox(
                              constraints: BoxConstraints(maxWidth: deckWidth),
                              child: desk,
                            ),
                          ),
                          shelf,
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
            if (!_onDeck &&
                _from != null &&
                _to != null &&
                playingEdition != null)
              AnimatedBuilder(
                animation: _slide,
                builder: (context, _) {
                  final t = _slide.value;
                  final path = Curves.easeInOutCubic.transform(t);
                  final rect = Rect.lerp(
                    _from,
                    _to,
                    path,
                  )!.shift(Offset(0, -31 * math.sin(t * math.pi)));
                  return Positioned.fromRect(
                    rect: rect,
                    child: IgnorePointer(
                      child: Transform.rotate(
                        angle: -.22 + .22 * path,
                        child: SynastryVinyl(
                          edition: playingEdition,
                          size: rect.width,
                          animated: false,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

String _archiveLabel(BuildContext context, ReportEntry entry) {
  final edition = SynastryEdition.matchArchiveTitle(entry.title);
  if (edition == null) return entry.title;
  return edition.pairFromArchiveTitle(entry.title) ??
      '${context.uiLabel('A 方')} & ${context.uiLabel('B 方')}';
}

class _RecordShelf extends StatefulWidget {
  const _RecordShelf({
    super.key,
    required this.entries,
    required this.index,
    required this.enabled,
    required this.onChanged,
    required this.onPlay,
  });

  final List<ReportEntry> entries;
  final int index;
  final bool enabled;
  final ValueChanged<int> onChanged;
  final ValueChanged<ReportEntry> onPlay;

  @override
  State<_RecordShelf> createState() => _RecordShelfState();
}

class _RecordShelfState extends State<_RecordShelf> {
  late final _pages = PageController(
    keepPage: false,
    initialPage: widget.index,
    viewportFraction: .83,
  );

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _move(int step) {
    final index = (widget.index + step).clamp(0, widget.entries.length - 1);
    if (MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context)) {
      _pages.jumpToPage(index);
    } else {
      unawaited(
        _pages.animateToPage(
          index,
          duration: const Duration(milliseconds: 270),
          curve: Curves.easeOutCubic,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.entries.length;
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        SizedBox(
          height: 88,
          child: PageView.builder(
            controller: _pages,
            scrollBehavior: ScrollConfiguration.of(context).copyWith(
              dragDevices: {
                ...ScrollConfiguration.of(context).dragDevices,
                PointerDeviceKind.mouse,
              },
            ),
            physics: widget.enabled
                ? null
                : const NeverScrollableScrollPhysics(),
            onPageChanged: widget.onChanged,
            itemCount: count,
            itemBuilder: (context, i) {
              final entry = widget.entries[i];
              final edition = SynastryEdition.fromArchiveTitle(entry.title);
              final edge = RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15),
                side: BorderSide(color: colors.outlineVariant),
              );
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Material(
                  color: colors.surfaceContainerLow,
                  shape: edge,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    key: ValueKey(entry.id),
                    onTap: widget.enabled ? () => widget.onPlay(entry) : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      child: Row(
                        spacing: 12,
                        children: [
                          SynastryVinyl(
                            edition: edition,
                            size: 63,
                            animated: false,
                          ),
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              spacing: 3,
                              children: [
                                Text(
                                  _archiveLabel(context, entry),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.titleMedium,
                                ),
                                Text(
                                  MaterialLocalizations.of(
                                    context,
                                  ).formatCompactDate(entry.savedAt.toLocal()),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: colors.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.play_arrow_rounded, size: 20),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (count > 1)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: context.uiLabel('上一张唱片'),
                onPressed: widget.enabled && widget.index > 0
                    ? () => _move(-1)
                    : null,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Text(
                '${widget.index + 1} / $count',
                style: theme.textTheme.labelMedium,
              ),
              IconButton(
                tooltip: context.uiLabel('下一张唱片'),
                onPressed: widget.enabled && widget.index < count - 1
                    ? () => _move(1)
                    : null,
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
      ],
    );
  }
}
