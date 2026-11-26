import '../../../shared/http/json_client.dart';

class FortuneTimeApi {
  const FortuneTimeApi(this._http);
  final JsonHttpClient _http;

  Future<DateTime> read() async {
    final response = await _http.request(['fortune', 'time']);
    final value = response['asOfUtc'];
    if (value is String) {
      final parsed = DateTime.tryParse(value);
      if (parsed != null && parsed.isUtc && parsed.toIso8601String() == value) {
        return parsed;
      }
    }
    throw const FormatException('Invalid UTC server time.');
  }
}
