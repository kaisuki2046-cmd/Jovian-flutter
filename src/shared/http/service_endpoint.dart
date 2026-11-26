import 'package:flutter/foundation.dart';

const _loopback = {'localhost', '127.0.0.1', '::1'};

/// Public build values. Flutter names take precedence over existing Expo names.
abstract final class ServiceEnvironment {
  static const account = String.fromEnvironment(
    'ACCOUNT_API_URL',
    defaultValue: String.fromEnvironment('EXPO_PUBLIC_API_BASE_URL'),
  );
  static const divination = String.fromEnvironment(
    'DIVINATION_REPORT_URL',
    defaultValue: String.fromEnvironment('EXPO_PUBLIC_DIVINATION_REPORT_URL'),
  );
  static const destiny = String.fromEnvironment(
    'DESTINY_REPORT_URL',
    defaultValue: String.fromEnvironment('EXPO_PUBLIC_DESTINY_API_BASE_URL'),
  );
  static const synastry = String.fromEnvironment(
    'SYNASTRY_REPORT_URL',
    defaultValue: String.fromEnvironment('EXPO_PUBLIC_SYNASTRY_API_BASE_URL'),
  );
  static const fortune = String.fromEnvironment(
    'FORTUNE_TIME_URL',
    defaultValue: String.fromEnvironment('EXPO_PUBLIC_FORTUNE_TIME_BASE_URL'),
  );
  static const androidDownloadOrigin = String.fromEnvironment(
    'ANDROID_UPDATE_DOWNLOAD_ORIGIN',
    defaultValue: String.fromEnvironment(
      'EXPO_PUBLIC_ANDROID_UPDATE_DOWNLOAD_ORIGIN',
    ),
  );
  static const appUpdates = String.fromEnvironment(
    'APP_UPDATE_API_URL',
    defaultValue: account,
  );
}

Uri? serviceEndpoint(String value, String setting) {
  final input = value.trim();
  if (input.isEmpty) return null;
  final parsed = Uri.tryParse(input);
  final base = kIsWeb && parsed != null ? Uri.base.resolveUri(parsed) : parsed;
  if (base == null ||
      base.host.isEmpty ||
      base.authority.contains('@') ||
      base.hasQuery ||
      base.hasFragment ||
      (base.scheme != 'https' && base.scheme != 'http')) {
    // Never include endpoint values in logs: they may contain credentials.
    debugPrint('Invalid $setting. This service is unavailable.');
    return null;
  }
  if (kIsWeb &&
      _loopback.contains(base.host) &&
      _loopback.contains(Uri.base.host)) {
    return base.replace(host: Uri.base.host);
  }
  return base;
}
