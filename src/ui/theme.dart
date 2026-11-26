import 'package:material_ui/material_ui.dart';

const jovianPageWidth = 460.0;
const jovianPagePadding = EdgeInsets.fromLTRB(16, 12, 16, 24);

ThemeData jovianTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final background = dark ? const Color(0xff191919) : const Color(0xfffdfcf8);
  final surface = dark ? const Color(0xff1e1e1e) : const Color(0xfff3f2ec);
  final canvas = dark ? const Color(0xff111111) : const Color(0xffecebe5);
  final ink = dark ? const Color(0xffe3e0db) : const Color(0xff292824);
  final muted = dark ? const Color(0xffaaa6a0) : const Color(0xff66645d);
  final line = dark ? const Color(0xff3a373b) : const Color(0xffdfddd4);
  final accent = dark ? const Color(0xffded2ed) : const Color(0xff4b4458);
  final tint = dark ? const Color(0xff37303e) : const Color(0xffeae3f0);
  final onAccent = dark ? const Color(0xff261d2c) : Colors.white;
  final scheme = ColorScheme.fromSeed(seedColor: accent, brightness: brightness)
      .copyWith(
        primary: accent,
        onPrimary: onAccent,
        primaryContainer: tint,
        onPrimaryContainer: accent,
        secondary: accent,
        onSecondary: onAccent,
        secondaryContainer: tint,
        onSecondaryContainer: accent,
        surface: background,
        onSurface: ink,
        onSurfaceVariant: muted,
        surfaceContainerLowest: background,
        surfaceContainerLow: surface,
        surfaceContainer: surface,
        surfaceContainerHigh: dark
            ? const Color(0xff262326)
            : const Color(0xffebe9e1),
        surfaceContainerHighest: canvas,
        outlineVariant: line,
        outline: dark ? const Color(0xff858186) : const Color(0xff8e8b82),
        error: dark ? const Color(0xffffadb8) : const Color(0xffa32348),
      );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamilyFallback: const [
      'PingFang SC',
      'Microsoft YaHei',
      'Noto Sans CJK SC',
    ],
  );
  OutlineInputBorder border(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: color, width: width),
      );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  final text = base.textTheme;
  return base.copyWith(
    scaffoldBackgroundColor: background,
    dividerColor: line,
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w600,
      ),
      titleLarge: text.titleLarge?.copyWith(
        fontSize: 21,
        fontWeight: FontWeight.w600,
      ),
      titleMedium: text.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      bodyMedium: text.bodyMedium?.copyWith(fontSize: 14, height: 1.5),
    ),
    appBarTheme: AppBarThemeData(
      backgroundColor: background,
      foregroundColor: ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleSpacing: 16,
      titleTextStyle: text.headlineSmall?.copyWith(
        color: ink,
        fontSize: 25,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: line),
      ),
      margin: const EdgeInsets.symmetric(vertical: 4),
    ),
    inputDecorationTheme: InputDecorationThemeData(
      filled: true,
      fillColor: surface,
      border: border(line),
      enabledBorder: border(line),
      focusedBorder: border(accent, 1.5),
      errorBorder: border(scheme.error),
      focusedErrorBorder: border(scheme.error, 1.5),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 46),
        shape: shape,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 46),
        shape: shape,
        side: BorderSide(color: scheme.outline),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: background,
      surfaceTintColor: Colors.transparent,
      indicatorColor: tint,
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
      ),
      elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          height: 1.2,
          color: states.contains(WidgetState.selected) ? accent : muted,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 23,
          color: states.contains(WidgetState.selected) ? accent : muted,
        ),
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: accent,
      shape: shape,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14),
    ),
  );
}
