class AccountFailure implements Exception {
  const AccountFailure(this.status);

  final int status;
}

Never failAccount(int status) => throw AccountFailure(status);
