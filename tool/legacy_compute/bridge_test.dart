import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import '../../src/shared/local_compute/local_compute.dart';

@JS('runBrowserComputeTest')
external set _runBrowserComputeTest(JSFunction callback);

@JS('runBrowserFortuneTest')
external set _runBrowserFortuneTest(JSFunction callback);

void main() {
  _runBrowserComputeTest = ((JSString input) => _exercise(input).toJS).toJS;
  _runBrowserFortuneTest = ((JSString input) => _fortune(input).toJS).toJS;
}

Future<JSString> _fortune(JSString input) async {
  const compute = LocalCompute();
  final data = jsonDecode(input.toDart) as Map<String, Object?>;
  final preview = data['preview'] as Map<String, Object?>;
  final reference = (data['reference'] as Map).cast<String, String>();
  return jsonEncode({
    'preview': await compute.previewFortune(
      preview['asOf'] as int,
      preview['period'] as String,
      preview['timeZone'] as String,
      archive: preview['archive'] as Map<String, Object?>,
    ),
    'calendar': await compute.queryFortuneCalendar(reference),
  }).toJS;
}

Future<JSString> _exercise(JSString input) async {
  const compute = LocalCompute();
  final profile = jsonDecode(input.toDart) as Map<String, Object?>;
  final stages = <String>[];
  final result = await compute.calculateDestiny(
    profile,
    onProgress: stages.add,
  );
  final cancel = Completer<void>()..complete();
  String? failure;
  try {
    await compute.calculateDestiny(profile, cancel: cancel.future);
  } on LocalComputeException catch (error) {
    failure = error.code;
  }
  return jsonEncode({
    'available': compute.isAvailable,
    'result': result,
    'stages': stages,
    'cancellation': failure,
  }).toJS;
}
