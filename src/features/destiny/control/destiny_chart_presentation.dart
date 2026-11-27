import '../../../shared/local_compute/local_compute.dart';

typedef RestoreDestinyPresentation =
    Future<Map<String, Object?>> Function(
      Map<String, Object?> snapshot,
      Future<void> cancel,
    );

Future<Map<String, Object?>> restoreDestinyPresentation(
  Map<String, Object?> snapshot,
  Future<void> cancel,
) async {
  const compute = LocalCompute();
  if (!compute.isAvailable) return const {};
  return compute.restoreDestinyPresentation(snapshot, cancel: cancel);
}
