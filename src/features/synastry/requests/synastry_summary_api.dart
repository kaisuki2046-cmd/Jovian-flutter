import '../../../shared/http/json_client.dart';
import '../model/synastry_relationship.dart';

class SynastrySummaryApi {
  const SynastrySummaryApi(this._http, {this.readNativeSession});

  final JsonHttpClient _http;
  final Future<String?> Function()? readNativeSession;

  /// Submits the legacy worker's prepared evidence without transforming it.
  Future<Map<String, String>> summarize(
    Map<String, Object?> summaryRequest, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async {
    _ensureCurrent(isCurrent);
    final readSession = readNativeSession;
    final token = readSession == null ? null : await readSession();
    _ensureCurrent(isCurrent);
    if (readSession != null && token == null) {
      throw const JsonRequestError('account_session_required', status: 401);
    }
    final response = await _http.request(
      ['synastry', 'summary'],
      method: 'POST',
      body: summaryRequest,
      headers: {if (token != null) 'X-Account-Session': token},
      cancel: cancel,
    );
    _ensureCurrent(isCurrent);
    final sections = {
      for (final relationship in SynastryRelationship.values)
        if (response[relationship.name] case final String text
            when text.trim().isNotEmpty)
          relationship.name: text,
    };
    if (sections.isEmpty) throw const JsonRequestError('invalid_response');
    return sections;
  }

  void close() => _http.client.close();
}

void _ensureCurrent(bool Function() isCurrent) {
  if (!isCurrent())
    throw const JsonRequestError('account_changed', status: 401);
}
