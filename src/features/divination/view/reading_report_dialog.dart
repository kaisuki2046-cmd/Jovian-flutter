import 'dart:ui' as ui;

import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import 'liuyao_form.dart';
import 'meihua_page.dart';
import 'reading_report.dart';
import 'tarot_cards.dart';

final _reportBackdrop = ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18);

DialogRoute<void> readingReportRoute(
  BuildContext context,
  OnlineReading reading,
) => DialogRoute<void>(
  context: context,
  barrierLabel: context.uiLabel('关闭报告'),
  barrierColor: Theme.of(context).colorScheme.scrim.withValues(alpha: .42),
  animationStyle: MediaQuery.disableAnimationsOf(context)
      ? AnimationStyle.noAnimation
      : null,
  builder: (_) => Stack(
    fit: StackFit.expand,
    children: [
      IgnorePointer(
        child: ClipRect(
          child: BackdropFilter(
            filter: _reportBackdrop,
            child: const SizedBox.expand(),
          ),
        ),
      ),
      ReadingReportDialog(reading: reading),
    ],
  ),
);

IconData _methodIcon(ReadingReportMethod method) => switch (method) {
  ReadingReportMethod.tarot => Icons.style_outlined,
  ReadingReportMethod.liuyao => Icons.segment_rounded,
  ReadingReportMethod.meihua => Icons.scatter_plot_outlined,
};

class ReadingReportEntry extends StatelessWidget {
  const ReadingReportEntry({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Material(
      color: colors.surfaceContainerLow.withValues(alpha: .92),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: colors.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        onTap: onPressed,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        leading: CircleAvatar(
          backgroundColor: colors.primaryContainer,
          foregroundColor: colors.onPrimaryContainer,
          child: const Icon(Icons.auto_stories_outlined, size: 20),
        ),
        title: UiText(label, style: theme.textTheme.titleMedium),
        subtitle: Text(
          [
            for (final method in ReadingReportMethod.values)
              context.uiLabel(method.label),
          ].join(' · '),
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}

class ReadingReportDialog extends StatelessWidget {
  const ReadingReportDialog({super.key, required this.reading});

  final OnlineReading reading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final snapshot = reading.snapshot;
    final report = reading.report;
    final title = report == null ? '三套盘面' : '解读报告';
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final tabHeight = MediaQuery.textScalerOf(
      context,
    ).scale(32).clamp(46.0, 96.0);
    final dark = theme.brightness == Brightness.dark;
    return DefaultTabController(
      length: ReadingReportMethod.values.length,
      animationDuration: reduceMotion ? Duration.zero : null,
      child: Dialog(
        key: const ValueKey('reading-report-dialog'),
        insetPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 620, maxHeight: 900),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: BorderSide(color: colors.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        backgroundColor: Colors.transparent,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.surface.withValues(alpha: dark ? .90 : .88),
                colors.surfaceContainerLow.withValues(alpha: .98),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(22, 16, 12, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: UiText(
                          title,
                          style: theme.textTheme.headlineMedium,
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: context.uiLabel('关闭报告'),
                      icon: const Icon(Icons.close_rounded),
                      style: IconButton.styleFrom(
                        backgroundColor: colors.surfaceContainerHighest
                            .withValues(alpha: .65),
                        foregroundColor: colors.onSurface,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              if (snapshot.question.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 0, 22, 12),
                  child: Text(
                    snapshot.question,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 9),
                child: LayoutBuilder(
                  builder: (context, bounds) {
                    final showIcons = bounds.maxWidth >= 330 && tabHeight <= 50;
                    final trackRadius = BorderRadius.circular(19);
                    final tabRadius = BorderRadius.circular(16);
                    return DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.surfaceContainerHighest.withValues(
                          alpha: .58,
                        ),
                        borderRadius: trackRadius,
                        border: Border.all(color: colors.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(3),
                        child: TabBar(
                          labelColor: colors.onSurface,
                          unselectedLabelColor: colors.onSurfaceVariant,
                          labelStyle: theme.textTheme.titleSmall,
                          labelPadding: const EdgeInsets.symmetric(
                            horizontal: 3,
                          ),
                          indicatorSize: TabBarIndicatorSize.tab,
                          splashBorderRadius: tabRadius,
                          indicator: BoxDecoration(
                            color: dark
                                ? colors.surfaceContainerHigh
                                : colors.surface,
                            borderRadius: tabRadius,
                            border: Border.all(color: colors.outlineVariant),
                            boxShadow: [
                              BoxShadow(
                                color: colors.shadow.withValues(
                                  alpha: dark ? .21 : .08,
                                ),
                                blurRadius: 7,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          dividerColor: Colors.transparent,
                          tabs: [
                            for (final method in ReadingReportMethod.values)
                              Tab(
                                height: tabHeight,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    if (showIcons) ...[
                                      Icon(_methodIcon(method), size: 16),
                                      const SizedBox(width: 6),
                                    ],
                                    Flexible(
                                      child: UiText(
                                        method.label,
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              Expanded(
                child: SelectionArea(
                  child: TabBarView(
                    children: [
                      for (final method in ReadingReportMethod.values)
                        _ReportPage(
                          method: method,
                          report: report,
                          chart: snapshot.chart,
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReportPage extends StatelessWidget {
  const _ReportPage({
    required this.method,
    required this.report,
    required this.chart,
  });

  final ReadingReportMethod method;
  final ProReport? report;
  final GuideChart? chart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final outline = BorderSide(color: colors.outlineVariant);
    final foldShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: outline,
    );
    final current = report;
    final chartNote = switch (method) {
      ReadingReportMethod.tarot => null,
      ReadingReportMethod.liuyao => chart?.liuyao.base.interpretation,
      ReadingReportMethod.meihua => chart?.meihua.interpretation,
    };
    final details = [
      if (current is ProParagraphReport)
        for (final paragraph in current.sections[method.name]!)
          if (paragraph.detail case final detail?) detail,
      if (chartNote != null && chartNote.trim().isNotEmpty) chartNote,
    ];
    return SingleChildScrollView(
      key: PageStorageKey(('report-page', method)),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (chart case final chart?)
            _ReportFigure(method: method, chart: chart),
          if (current != null) ...[
            if (chart != null) const SizedBox(height: 20),
            DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface.withValues(alpha: .96),
                borderRadius: BorderRadius.circular(22),
                border: Border.fromBorderSide(outline),
                boxShadow: [
                  BoxShadow(
                    color: colors.shadow.withValues(alpha: dark ? .19 : .05),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(17, 17, 17, 19),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      header: true,
                      child: UiText('简要解读', style: theme.textTheme.titleMedium),
                    ),
                    const SizedBox(height: 11),
                    const Divider(height: 1),
                    const SizedBox(height: 13),
                    ReadingReportSection(report: current, method: method),
                  ],
                ),
              ),
            ),
          ],
          if (details.isNotEmpty) ...[
            const SizedBox(height: 18),
            ExpansionTile(
              key: PageStorageKey(('report-details', method)),
              title: UiText('查看详细解释', style: theme.textTheme.titleSmall),
              leading: Icon(
                Icons.notes_rounded,
                size: 20,
                color: colors.primary,
              ),
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              shape: foldShape,
              collapsedShape: foldShape,
              backgroundColor: colors.surface,
              collapsedBackgroundColor: colors.surface.withValues(alpha: .70),
              children: [ReadingReportDetails(paragraphs: details)],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReportFigure extends StatelessWidget {
  const _ReportFigure({required this.method, required this.chart});

  final ReadingReportMethod method;
  final GuideChart chart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final radius = BorderRadius.circular(24);
    final chartContent = switch (method) {
      ReadingReportMethod.tarot => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 382),
          child: TarotReveal(draw: chart.tarot),
        ),
      ),
      ReadingReportMethod.liuyao => JingfangResult(
        reading: chart.liuyao,
        compact: true,
      ),
      ReadingReportMethod.meihua => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MeihuaResult(reading: chart.meihua, compact: true),
          const SizedBox(height: 8),
          UiText(
            chart.meihuaInputSource == MeihuaInputSource.tarotClick
                ? '梅花取数来自三次抽牌的点击时刻。'
                : '梅花取数来自三枚自动生成的数。',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    };
    return Stack(
      clipBehavior: Clip.none,
      children: [
        for (final (inset, bottom, fill) in [
          (25.0, 0.0, colors.surfaceContainerHighest),
          (12.0, 5.0, colors.surfaceContainerHigh),
        ])
          Positioned(
            left: inset,
            right: inset,
            height: 28,
            bottom: bottom,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: fill,
                borderRadius: radius,
                border: Border.all(color: colors.outlineVariant),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 11),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: radius,
              boxShadow: [
                BoxShadow(
                  color: colors.shadow.withValues(alpha: dark ? .28 : .12),
                  blurRadius: 18,
                  offset: const Offset(0, 7),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: radius,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: radius,
                  border: Border.all(
                    color: colors.outline.withValues(alpha: .37),
                  ),
                  gradient: RadialGradient(
                    center: const Alignment(-.64, -.82),
                    radius: 1.32,
                    colors: [colors.surface, colors.surfaceContainerHighest],
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: IgnorePointer(
                        child: CustomPaint(
                          painter: _ReportContours(
                            colors.outline.withValues(alpha: dark ? .13 : .18),
                          ),
                        ),
                      ),
                    ),
                    Material(
                      type: MaterialType.transparency,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          13,
                          method == ReadingReportMethod.tarot ? 18 : 16,
                          13,
                          14,
                        ),
                        child: chartContent,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ReportContours extends CustomPainter {
  const _ReportContours(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final ink = Paint()
      ..color = color
      ..isAntiAlias = true
      ..strokeWidth = .65
      ..style = PaintingStyle.stroke;
    canvas.save();
    canvas.translate(size.width * .73, size.height * .28);
    canvas.rotate(-.36);
    for (var index = 0; index < 7; index++) {
      canvas.drawOval(
        Rect.fromCenter(
          center: const Offset(36, -12),
          width: size.width * (.50 + .18 * index),
          height: size.width * (.21 + .075 * index),
        ),
        ink,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ReportContours oldDelegate) => color != oldDelegate.color;
}
