export class AccountError extends Error {
  constructor(status) {
    super('Account request failed');
    this.status = status;
  }
}

export function fail(status) {
  throw new AccountError(status);
}
