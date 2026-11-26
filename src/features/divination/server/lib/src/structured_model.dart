import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

enum ModelProvider { deepseek, openai }

class ModelOutputError implements Exception {
  const ModelOutputError(this.message);

  final String message;

  @override
  String toString() => message;
}

class ModelHttpError implements Exception {
  const ModelHttpError(this.status);

  final int status;

  @override
  String toString() => 'Provider HTTP $status';
}

typedef ModelHttpResponse = ({int status, String body});

typedef ModelTransport =
    Future<ModelHttpResponse> Function(
      Uri uri,
      Map<String, String> headers,
      String body,
      Duration timeout,
    );

const _responseLimitBytes = 16 * 1024 * 1024;

Future<ModelHttpResponse> sendModelHttp(
  Uri uri,
  Map<String, String> headers,
  String body,
  Duration timeout,
) async {
  final client = HttpClient()..connectionTimeout = timeout;
  try {
    return await (() async {
      final request = await client.postUrl(uri);
      request.followRedirects = false;
      headers.forEach(request.headers.set);
      request.add(utf8.encode(body));
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return (status: response.statusCode, body: '');
      }
      final chunks = BytesBuilder(copy: false);
      await for (final chunk in response) {
        if (chunks.length + chunk.length > _responseLimitBytes) {
          throw const ModelOutputError('Provider response exceeds size limit');
        }
        chunks.add(chunk);
      }
      return (
        status: response.statusCode,
        body: utf8.decode(chunks.takeBytes(), allowMalformed: true),
      );
    })().timeout(timeout);
  } finally {
    client.close(force: true);
  }
}

class StructuredModelClient {
  const StructuredModelClient({
    required this.provider,
    required String apiKey,
    required this.model,
    this.transport = sendModelHttp,
  }) : _apiKey = apiKey;

  final ModelProvider provider;
  final String _apiKey;
  final String model;
  final ModelTransport transport;

  Future<Object?> request(
    Object input, {
    required String instructions,
    required int maxOutputTokens,
    required Duration timeout,
    String? modelOverride,
    String? name,
    Map<String, Object>? schema,
    bool chat = false,
    double temperature = 0,
  }) async {
    final deepseek = provider == ModelProvider.deepseek;
    final chatMode = deepseek && chat;
    final endpoint = chatMode
        ? 'https://api.deepseek.com/chat/completions'
        : deepseek
        ? 'https://api.deepseek.com/responses'
        : 'https://api.openai.com/v1/responses';
    final data = jsonEncode(input);
    final modelName = modelOverride ?? model;
    final body = chatMode
        ? {
            'model': modelName,
            'max_tokens': maxOutputTokens,
            'temperature': temperature == temperature.toInt()
                ? temperature.toInt()
                : temperature,
            'stream': false,
            'thinking': {'type': 'disabled'},
            'response_format': {'type': 'json_object'},
            'messages': [
              {'role': 'system', 'content': instructions},
              {'role': 'user', 'content': data},
            ],
          }
        : {
            'model': modelName,
            'max_output_tokens': maxOutputTokens,
            if (deepseek) 'reasoning': {'effort': 'none'} else 'store': false,
            'instructions': instructions,
            'input': data,
            'text': {
              'format': {
                'type': 'json_schema',
                if (name != null) 'name': name,
                if (schema != null) 'schema': schema,
                if (!deepseek) 'strict': true,
              },
            },
          };
    final response = await transport(
      Uri.parse(endpoint),
      {'Authorization': 'Bearer $_apiKey', 'Content-Type': 'application/json'},
      jsonEncode(body),
      timeout,
    );
    if (response.status < 200 || response.status >= 300) {
      throw ModelHttpError(response.status);
    }
    final Object? result;
    try {
      result = jsonDecode(response.body);
    } on FormatException {
      throw const FormatException('Invalid provider response.');
    }
    return chatMode ? _chatOutput(result) : _responsesOutput(result);
  }
}

Object? _chatOutput(Object? result) {
  final choices = result is Map ? result['choices'] : null;
  final choice = choices is List && choices.isNotEmpty ? choices.first : null;
  if (choice is Map && choice['finish_reason'] == 'length') {
    throw const ModelOutputError('Output token limit reached');
  }
  if (choice is! Map || choice['finish_reason'] != 'stop') {
    throw const ModelOutputError('Model did not complete');
  }
  final message = choice['message'];
  final content = message is Map ? message['content'] : null;
  if (content is! String || content.trim().isEmpty) {
    throw const ModelOutputError('Model returned empty content');
  }
  try {
    return jsonDecode(content);
  } on FormatException {
    throw const ModelOutputError('Model returned invalid JSON');
  }
}

Object? _responsesOutput(Object? result) {
  if (result is! Map ||
      result['status'] != 'completed' ||
      result['output'] is! List) {
    throw const ModelOutputError('Incomplete model response.');
  }
  final content = StringBuffer();
  for (final item in result['output'] as List) {
    if (item is! Map ||
        item['type'] != 'message' ||
        item['role'] != 'assistant')
      continue;
    final parts = item['content'];
    if (parts is! List) continue;
    for (final part in parts.whereType<Map>()) {
      if (part['type'] == 'refusal')
        throw const ModelOutputError('Model declined.');
      if (part['text'] case final String text
          when part['type'] == 'output_text') {
        content.write(text);
      }
    }
  }
  try {
    return jsonDecode(content.toString());
  } on FormatException {
    throw const ModelOutputError('Model returned invalid JSON');
  }
}
