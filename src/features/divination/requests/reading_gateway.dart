import 'package:jovian_divination/jovian_divination.dart';

import '../../../shared/http/json_client.dart';

class HttpGuideGateway implements GuideGateway {
  const HttpGuideGateway(this._http, {this.readNativeSession});
  final JsonHttpClient _http;
  final Future<String?> Function()? readNativeSession;

  @override
  Future<ReadingConfirmation> understand(
    String question, {
    String? previousQuestion,
    Future<void>? cancel,
  }) async {
    final response = await _request(
      'understand',
      cancel: cancel,
      body: {
        'question': question,
        'requireModel': true,
        if (previousQuestion != null) 'previousQuestion': previousQuestion,
      },
    );
    final focus = response['focus'];
    final clarification = response['clarification'];
    final proof = response['proof'];
    if (focus is! String ||
        clarification is! String ||
        response['source'] != 'model' ||
        (proof != null && proof is! String)) {
      throw const ReadingConnectionError('invalid_response');
    }
    return (
      focus: focus,
      clarification: clarification,
      proof: proof as String?,
      chatOnly: response['intent'] == 'chat_only',
    );
  }

  @override
  Future<OpenedReading> start(
    String question,
    String focus,
    String proof, {
    required bool automatic,
    String? previousQuestion,
  }) async {
    final response = await _request(
      null,
      body: {
        'method': 'combined',
        'profile': guideVersion,
        'question': question,
        'focus': focus,
        'proof': proof,
        if (automatic) 'automatic': true,
        if (previousQuestion != null) 'previousQuestion': previousQuestion,
      },
    );
    final token = response['token'];
    final task = response['task'];
    if (token is! String ||
        !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token) ||
        task is! Map<String, Object?>) {
      throw const ReadingConnectionError('invalid_response');
    }
    return (token: token, reading: _parse(task));
  }

  @override
  Future<OnlineReading> get(String token) async =>
      _parse(await _request(null, token: token));

  @override
  Future<OnlineReading> perform(
    String token,
    PendingGuideAction action,
  ) async => _parse(
    await _request(action.action.name, token: token, body: action.body),
  );

  @override
  Future<OnlineReading> report(String token) async =>
      _parse(await _request('report', token: token, body: {}));

  @override
  Future<OnlineReading> followUp(
    String token,
    int step,
    String question,
  ) async => _parse(
    await _request(
      'follow-up',
      token: token,
      body: {'step': step, 'question': question},
    ),
  );

  Future<Map<String, Object?>> _request(
    String? action, {
    String? token,
    Map<String, Object?>? body,
    Future<void>? cancel,
  }) async {
    final String? native;
    try {
      native = await readNativeSession?.call();
    } catch (_) {
      throw const ReadingConnectionError(
        'account_session_required',
        status: 401,
      );
    }
    try {
      return await _http.request(
        ['reading', if (action != null) action],
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          if (native != null) 'X-Account-Session': native,
        },
        body: body,
        cancel: cancel,
      );
    } on JsonRequestError catch (error) {
      throw ReadingConnectionError(error.code, status: error.status);
    }
  }
}

OnlineReading _parse(Map<String, Object?> value) {
  try {
    return OnlineReading.fromJson(value);
  } on FormatException {
    throw const ReadingConnectionError('invalid_response');
  } on TypeError {
    throw const ReadingConnectionError('invalid_response');
  }
}
