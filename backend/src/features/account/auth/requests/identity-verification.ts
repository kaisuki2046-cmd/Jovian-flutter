import { accountClient, accountRequest } from '../../client';

const path = '/account/auth/identity-verification';

export function requestIdentityVerificationStatus(signal: AbortSignal) {
  return accountClient.request(path, {
    ...accountRequest(true),
    signal,
    parse(value: unknown) {
      if ((value as { status?: unknown } | null)?.status !== 'not_enabled') {
        throw new Error('Invalid identity verification status.');
      }
      return { status: 'not_enabled' as const };
    },
  });
}

export function requestIdentityVerificationSubmission(signal: AbortSignal) {
  // Until a provider is enabled, the request only checks availability.
  return accountClient.request(path, { ...accountRequest(true), method: 'POST', body: {}, response: 'empty', signal });
}
