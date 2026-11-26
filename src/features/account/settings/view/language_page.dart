import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import '../../../../ui/theme.dart';

class LanguagePage extends StatelessWidget {
  const LanguagePage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final change = InterfaceLanguageScope.onChangedOf(context);
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.escape): () =>
            Navigator.of(context).maybePop(),
      },
      child: Focus(
        autofocus: true,
        skipTraversal: true,
        child: Scaffold(
          appBar: AppBar(title: const UiText('语言')),
          body: SafeArea(
            top: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: jovianPageWidth),
                child: ListView(
                  padding: jovianPagePadding,
                  children: [
                    const UiText('选择界面语言'),
                    const SizedBox(height: 4),
                    const UiText('修改后即时生效，并保留你的选择。'),
                    const SizedBox(height: 18),
                    RadioGroup<InterfaceLanguage>(
                      groupValue: context.uiLanguage,
                      onChanged: (language) {
                        if (language != null) change?.call(language);
                      },
                      child: Column(
                        spacing: 12,
                        children: [
                          for (final language in InterfaceLanguage.values)
                            Card(
                              margin: EdgeInsets.zero,
                              clipBehavior: Clip.antiAlias,
                              child: RadioListTile<InterfaceLanguage>(
                                enabled: change != null,
                                value: language,
                                selected: context.uiLanguage == language,
                                minTileHeight: 76,
                                controlAffinity:
                                    ListTileControlAffinity.trailing,
                                title: Text(language.displayName),
                                secondary: ExcludeSemantics(
                                  child: CircleAvatar(
                                    backgroundColor: colors.primaryContainer,
                                    foregroundColor: colors.onPrimaryContainer,
                                    child: Text(language.mark),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    const UiText('用户输入和生成的报告保留原文。'),
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
