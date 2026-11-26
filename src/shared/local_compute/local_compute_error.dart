class LocalComputeException implements Exception {
  const LocalComputeException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}
