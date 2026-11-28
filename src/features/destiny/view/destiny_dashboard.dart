import 'dart:math' as math;

import 'package:flutter/gestures.dart' show PointerDeviceKind;
import 'package:jovian_fortune/jovian_fortune.dart' show FortunePeriod;
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/theme.dart';

const _forecasts = [
  (period: FortunePeriod.day, label: '日运', icon: Icons.light_mode_outlined),
  (period: FortunePeriod.week, label: '周运', icon: Icons.view_week_outlined),
  (
    period: FortunePeriod.month,
    label: '月运',
    icon: Icons.calendar_month_outlined,
  ),
  (period: FortunePeriod.year, label: '年运', icon: Icons.date_range_outlined),
];

typedef _CardFace = ({
  String? section,
  String title,
  String action,
  IconData icon,
  VoidCallback? open,
});

class DestinyDashboard extends StatelessWidget {
  const DestinyDashboard({
    super.key,
    required this.motion,
    required this.chartAction,
    required this.onOpenChart,
    required this.hasBirthDetails,
    required this.onEditBirthDetails,
    required this.onOpenFortune,
    required this.onOpenPeriod,
  });

  final bool motion;
  final String chartAction;
  final VoidCallback? onOpenChart;
  final bool hasBirthDetails;
  final VoidCallback? onEditBirthDetails;
  final VoidCallback? onOpenFortune;
  final ValueChanged<FortunePeriod>? onOpenPeriod;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final openPeriod = onOpenPeriod;
    final chartFaces = <_CardFace>[
      (
        section: null,
        title: '本命命盘',
        action: chartAction,
        icon: Icons.donut_large_rounded,
        open: onOpenChart,
      ),
      (
        section: null,
        title: '出生资料',
        action: hasBirthDetails ? '核对出生资料' : '填写出生资料',
        icon: Icons.badge_outlined,
        open: onEditBirthDetails,
      ),
    ];
    final forecastFaces = <_CardFace>[
      if (openPeriod != null)
        for (final forecast in _forecasts)
          (
            section: '周期运势',
            title: forecast.period.label,
            action: '查看运势',
            icon: forecast.icon,
            open: () => openPeriod(forecast.period),
          )
      else if (onOpenFortune != null)
        (
          section: '周期运势',
          title: '日、周、月、年',
          action: '查看运势',
          icon: Icons.calendar_month_outlined,
          open: onOpenFortune,
        ),
    ];
    final today = DateUtils.dateOnly(DateTime.now());
    final scaledText = MediaQuery.textScalerOf(context).scale(16);
    const gap = 12.0;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: jovianPageWidth),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            final paired =
                forecastFaces.isNotEmpty && width >= 260 && scaledText <= 21;
            final cardWidth = paired ? (width - gap) / 2 : width;
            final cardHeight = math.max(
              cardWidth.clamp(150.0, 190.0).toDouble(),
              160 + math.max(0.0, scaledText - 16) * 6,
            );
            final rowHeight = (width * .20).clamp(59.0, 78.0).toDouble();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    SizedBox(
                      width: cardWidth,
                      height: cardHeight,
                      child: _CardStack(
                        faces: chartFaces,
                        switchLabel: '切换命盘卡片',
                        motion: motion,
                        fill: dark
                            ? const Color(0xff2c2822)
                            : const Color(0xfff1ece2),
                        accent: dark
                            ? const Color(0xffdfc7a6)
                            : const Color(0xff6d5336),
                      ),
                    ),
                    if (forecastFaces.isNotEmpty)
                      SizedBox(
                        width: cardWidth,
                        height: cardHeight,
                        child: _CardStack(
                          faces: forecastFaces,
                          switchLabel: '切换运势卡片',
                          motion: motion,
                          fill: dark
                              ? const Color(0xff26322d)
                              : const Color(0xffe7eeea),
                          accent: dark
                              ? const Color(0xffbdd3c7)
                              : const Color(0xff3b5b4f),
                        ),
                      ),
                  ],
                ),
                if (openPeriod != null) ...[
                  const SizedBox(height: 16),
                  for (final (index, forecast) in _forecasts.indexed)
                    Padding(
                      padding: EdgeInsets.only(top: index == 0 ? 0 : 8),
                      child: _ForecastRow(
                        label: forecast.label,
                        date: _periodDate(context, today, forecast.period),
                        icon: forecast.icon,
                        minHeight: rowHeight,
                        emphasized: forecast.period == FortunePeriod.day,
                        open: () => openPeriod(forecast.period),
                      ),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  String _periodDate(
    BuildContext context,
    DateTime today,
    FortunePeriod period,
  ) {
    final format = MaterialLocalizations.of(context);
    final monday = DateUtils.addDaysToDate(
      today,
      DateTime.monday - today.weekday,
    );
    String numericDay(DateTime date) => '${date.month}.${date.day}';
    return switch (period) {
      FortunePeriod.day => numericDay(today),
      FortunePeriod.week =>
        '${numericDay(monday)}–${numericDay(DateUtils.addDaysToDate(monday, 6))}',
      FortunePeriod.month => format.formatMonthYear(today),
      FortunePeriod.year => format.formatYear(today),
    };
  }
}

class _CardStack extends StatefulWidget {
  const _CardStack({
    required this.faces,
    required this.switchLabel,
    required this.motion,
    required this.fill,
    required this.accent,
  });

  final List<_CardFace> faces;
  final String switchLabel;
  final bool motion;
  final Color fill;
  final Color accent;

  @override
  State<_CardStack> createState() => _CardStackState();
}

class _CardStackState extends State<_CardStack> {
  final _pages = PageController(keepPage: false);
  var _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _advance() {
    if (!_pages.hasClients) return;
    final next = (_index + 1) % widget.faces.length;
    if (!widget.motion || MediaQuery.disableAnimationsOf(context)) {
      _pages.jumpToPage(next);
    } else {
      _pages.animateToPage(
        next,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final scrolling = ScrollConfiguration.of(context);
    final multiple = widget.faces.length > 1;
    return Material(
      color: widget.fill,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: widget.accent.withValues(alpha: .18)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ScrollConfiguration(
            behavior: scrolling.copyWith(
              scrollbars: false,
              dragDevices: {...scrolling.dragDevices, PointerDeviceKind.mouse},
            ),
            child: PageView.builder(
              controller: _pages,
              scrollDirection: Axis.vertical,
              itemCount: widget.faces.length,
              onPageChanged: (index) => setState(() => _index = index),
              itemBuilder: (context, index) => _Cover(
                face: widget.faces[index],
                accent: widget.accent,
                hasSwitch: multiple,
              ),
            ),
          ),
          if (multiple)
            PositionedDirectional(
              top: 4,
              end: 4,
              child: IconButton(
                tooltip: context.uiLabel(widget.switchLabel),
                onPressed: _advance,
                style: IconButton.styleFrom(
                  foregroundColor: widget.accent,
                  minimumSize: const Size.square(40),
                  padding: EdgeInsets.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.unfold_more_rounded, size: 20),
              ),
            ),
        ],
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({
    required this.face,
    required this.accent,
    required this.hasSwitch,
  });

  final _CardFace face;
  final Color accent;
  final bool hasSwitch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsetsDirectional.only(end: hasSwitch ? 24 : 0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 28),
              child: Row(
                children: [
                  Icon(face.icon, size: 19, color: accent),
                  if (face.section case final section?) ...[
                    const SizedBox(width: 6),
                    Flexible(
                      child: UiText(
                        section,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          UiText(
            face.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleLarge?.copyWith(
              color: theme.colorScheme.onSurface,
              fontSize: 23,
              height: 1.18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: face.open,
            style: FilledButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: theme.colorScheme.surface,
              minimumSize: const Size(44, 44),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                height: 1.25,
              ),
            ),
            child: UiText(
              face.action,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class _ForecastRow extends StatelessWidget {
  const _ForecastRow({
    required this.label,
    required this.date,
    required this.icon,
    required this.minHeight,
    required this.emphasized,
    required this.open,
  });

  final String label;
  final String date;
  final IconData icon;
  final double minHeight;
  final bool emphasized;
  final VoidCallback open;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final narrow = MediaQuery.sizeOf(context).width < 360;
    final surface = emphasized
        ? const Color(0xff263c34)
        : colors.surfaceContainerLow;
    final ink = emphasized ? const Color(0xfff8f4ea) : colors.onSurface;
    final strip = emphasized
        ? const Color(0xff385449)
        : colors.primaryContainer;
    final leadingWidth = narrow ? 48.0 : 56.0;

    return Material(
      color: surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
        side: BorderSide(
          color: emphasized ? const Color(0xff3f5b50) : colors.outlineVariant,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          PositionedDirectional(
            start: 0,
            top: 0,
            bottom: 0,
            width: leadingWidth,
            child: Ink(
              color: strip,
              child: Center(
                child: Icon(
                  icon,
                  size: 23,
                  color: emphasized
                      ? const Color(0xffedc993)
                      : colors.onPrimaryContainer,
                ),
              ),
            ),
          ),
          InkWell(
            onTap: open,
            focusColor: ink.withValues(alpha: .12),
            hoverColor: ink.withValues(alpha: .07),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: minHeight),
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  leadingWidth + 12,
                  8,
                  10,
                  8,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 2,
                        children: [
                          UiText(
                            label,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: ink,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            date,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: ink,
                              fontSize: narrow ? 20 : 24,
                              height: 1.1,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -.4,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 7),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: ink.withValues(alpha: .70),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
