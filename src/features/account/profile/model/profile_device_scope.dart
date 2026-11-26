String profileDeviceKey(String scope, String kind) =>
    'jovian.$kind.v1.${scope.runes.map((value) => value.toRadixString(16)).join('-')}';

final _deviceWrites = <String, Future<void>>{};

Future<void> serializeProfileDeviceWrite(
  String key,
  Future<void> Function(String) write,
) async {
  final previous = _deviceWrites[key];
  final pending = previous == null
      ? write(key)
      : previous.then((_) => write(key), onError: (Object _) => write(key));
  _deviceWrites[key] = pending;
  try {
    await pending;
  } finally {
    if (identical(_deviceWrites[key], pending)) _deviceWrites.remove(key);
  }
}
