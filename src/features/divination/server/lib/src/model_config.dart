import 'dart:io';

import 'structured_model.dart';

const guideQuestionModel = 'deepseek-flash';

StructuredModelClient? configuredDivinationModel(
  Map<String, String> environment, {
  ModelTransport transport = sendModelHttp,
}) {
  String value(String key) => environment[key]?.trim() ?? '';
  final openaiKey = value('DIVINATION_OPENAI_API_KEY');
  if (openaiKey.isNotEmpty) {
    final model = value('DIVINATION_OPENAI_MODEL');
    return StructuredModelClient(
      provider: ModelProvider.openai,
      apiKey: openaiKey,
      model: model.isEmpty ? 'gpt-4.1-mini' : model,
      transport: transport,
    );
  }
  var apiKey = value('DEEPSEEK_API_KEY');
  final keyFile = value('DEEPSEEK_API_KEY_FILE');
  if (apiKey.isEmpty && keyFile.isNotEmpty) {
    try {
      apiKey = File(keyFile).readAsStringSync().trim();
    } on IOException {
      throw StateError('Could not read DEEPSEEK_API_KEY_FILE.');
    }
    if (apiKey.isEmpty || RegExp(r'\s').hasMatch(apiKey)) {
      throw StateError('DEEPSEEK_API_KEY_FILE must contain one key.');
    }
  }
  if (apiKey.isEmpty) return null;
  final model = value('DIVINATION_DEEPSEEK_MODEL');
  return StructuredModelClient(
    provider: ModelProvider.deepseek,
    apiKey: apiKey,
    model: model.isEmpty ? guideQuestionModel : model,
    transport: transport,
  );
}
