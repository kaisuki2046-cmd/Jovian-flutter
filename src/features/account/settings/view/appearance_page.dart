import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';

class AppearancePage extends StatefulWidget {
  const AppearancePage({
    super.key,
    required this.initialMode,
    required this.onChanged,
  });

  final ThemeMode initialMode;
  final ValueChanged<ThemeMode> onChanged;

  @override
  State<AppearancePage> createState() => _AppearancePageState();
}

class _AppearancePageState extends State<AppearancePage> {
  late ThemeMode _mode = widget.initialMode;

  void _choose(ThemeMode? mode) {
    if (mode == null || mode == _mode) return;
    setState(() => _mode = mode);
    widget.onChanged(mode);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.escape): () =>
            Navigator.of(context).maybePop(),
      },
      child: Focus(
        autofocus: true,
        skipTraversal: true,
        child: Scaffold(
          appBar: AppBar(title: const UiText('外观模式')),
          body: SafeArea(
            top: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: jovianPageWidth),
                child: ListView(
                  padding: jovianPagePadding,
                  children: [
                    UiText('选择喜欢的阅读方式', style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 18),
                    RadioGroup<ThemeMode>(
                      groupValue: _mode,
                      onChanged: _choose,
                      child: Column(
                        spacing: 12,
                        children: [
                          for (final (mode, label) in const [
                            (ThemeMode.light, '浅色模式'),
                            (ThemeMode.dark, '深色模式'),
                            (ThemeMode.system, '跟随系统'),
                          ])
                            Card(
                              margin: EdgeInsets.zero,
                              clipBehavior: Clip.antiAlias,
                              child: RadioListTile<ThemeMode>(
                                value: mode,
                                selected: _mode == mode,
                                selectedTileColor:
                                    theme.colorScheme.primaryContainer,
                                controlAffinity:
                                    ListTileControlAffinity.trailing,
                                minTileHeight: 80,
                                horizontalTitleGap: 14,
                                title: UiText(
                                  label,
                                  style: theme.textTheme.titleMedium,
                                ),
                                subtitle: mode == ThemeMode.system
                                    ? const UiText('自动同步设备的浅色或深色模式')
                                    : null,
                                secondary: _ModeSwatch(mode),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ModeSwatch extends StatelessWidget {
  const _ModeSwatch(this.mode);

  static final _light = jovianTheme(Brightness.light).colorScheme;
  static final _dark = jovianTheme(Brightness.dark).colorScheme;

  final ThemeMode mode;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon) = switch (mode) {
      ThemeMode.light => (
        _light.surface,
        _light.onSurface,
        Icons.light_mode_outlined,
      ),
      ThemeMode.dark => (
        _dark.surface,
        _dark.onSurface,
        Icons.dark_mode_outlined,
      ),
      ThemeMode.system => (
        Theme.of(context).colorScheme.primaryContainer,
        Theme.of(context).colorScheme.onPrimaryContainer,
        Icons.brightness_auto_outlined,
      ),
    };
    return ExcludeSemantics(
      child: Container(
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(icon, size: 25, color: foreground),
      ),
    );
  }
}
