import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import 'interface_strings.dart';

enum InterfaceLanguage {
  chinese(Locale('zh', 'CN'), '简体中文', '中'),
  english(Locale('en'), 'English', 'EN');

  const InterfaceLanguage(this.locale, this.displayName, this.mark);

  final Locale locale;
  final String displayName;
  final String mark;
  String get code => locale.languageCode;

  static InterfaceLanguage? parse(String? code) =>
      values.where((language) => language.code == code).firstOrNull;

  String label(String source) =>
      this == english ? englishInterfaceStrings[source] ?? source : source;

  String minimumCharacters(int count) =>
      this == english ? 'At least $count characters' : '至少 $count 个字符';
}

class _InterfaceStringsDelegate
    extends LocalizationsDelegate<InterfaceLanguage> {
  const _InterfaceStringsDelegate();

  @override
  bool isSupported(Locale locale) =>
      InterfaceLanguage.parse(locale.languageCode) != null;

  @override
  Future<InterfaceLanguage> load(Locale locale) => SynchronousFuture(
    InterfaceLanguage.parse(locale.languageCode) ?? InterfaceLanguage.chinese,
  );

  @override
  bool shouldReload(_InterfaceStringsDelegate old) => false;
}

const interfaceStringsDelegate = _InterfaceStringsDelegate();

extension InterfaceTextContext on BuildContext {
  InterfaceLanguage get uiLanguage =>
      Localizations.of<InterfaceLanguage>(this, InterfaceLanguage) ??
      InterfaceLanguage.chinese;

  String uiLabel(String source) => uiLanguage.label(source);
}

/// Translates app-owned UI labels. Display user and report content with [Text].
class UiText extends StatelessWidget {
  const UiText(
    this.source, {
    super.key,
    this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  final String source;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) => Text(
    context.uiLabel(source),
    style: style,
    textAlign: textAlign,
    maxLines: maxLines,
    overflow: overflow,
  );
}

class InterfaceLanguageScope extends InheritedWidget {
  const InterfaceLanguageScope({
    super.key,
    required this.onChanged,
    required super.child,
  });

  final ValueChanged<InterfaceLanguage> onChanged;

  static ValueChanged<InterfaceLanguage>? onChangedOf(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<InterfaceLanguageScope>()
          ?.onChanged;

  @override
  bool updateShouldNotify(InterfaceLanguageScope oldWidget) =>
      onChanged != oldWidget.onChanged;
}
