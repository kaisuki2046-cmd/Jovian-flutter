import 'package:material_ui/material_ui.dart';

ThemeData jovianTheme(Brightness brightness) => ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xff665188),
    brightness: brightness,
  ),
);
