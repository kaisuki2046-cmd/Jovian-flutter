import { accountClient, accountRequest } from '../../client';
import { parsePhoneChallenge } from './phone';

type DeletionMethod = 'password' | 'phone' | 'local-social' | 'wechat' | 'qq' | null;
export type DeletionSetup = { receipt: string; method: DeletionMethod };
export type DeletionProof = { password: string } | { challengeId: string; code: string } | { simulateSocial: true };
export type DeletionReceipt = { status: 'pending' | 'completed'; requestedAt: number; completedAt: number | null };

const path = '/account/deletion';

function parseReceipt(value: unknown): DeletionReceipt {
  const receipt = value as Partial<DeletionReceipt> | null;
  if (!receipt || (receipt.status !== 'pending' && receipt.status !== 'completed') ||
      typeof receipt.requestedAt !== 'number' ||
      (receipt.status === 'completed' ? typeof receipt.completedAt !== 'number' : receipt.completedAt !== null)) {
    throw new Error('Invalid deletion receipt');
  }
  return receipt as DeletionReceipt;
}

export function prepareAccountDeletion(signal: AbortSignal) {
  return accountClient.request(path, {
    ...accountRequest(true), signal,
    parse(value: unknown): DeletionSetup {
      const setup = value as Partial<DeletionSetup> | null;
      if (!setup || typeof setup.receipt !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(setup.receipt) ||
          setup.method === undefined || !['password', 'phone', 'local-social', 'wechat', 'qq', null].includes(setup.method)) {
        throw new Error('Invalid deletion setup');
      }
      return { receipt: setup.receipt, method: setup.method };
    },
  });
}

export function requestDeletionCode() {
  return accountClient.request(path + '/code', {
    ...accountRequest(true), method: 'POST', body: {}, parse: parsePhoneChallenge,
  });
}

export function requestAccountDeletion(receipt: string, proof: DeletionProof, legacyReadingTokens: string[]) {
  return accountClient.request(path, {
    ...accountRequest(true), method: 'POST', body: { ...proof, receipt, confirm: true, legacyReadingTokens },
    parse: parseReceipt,
  });
}

export function requestDeletionStatus(receipt: string) {
  return accountClient.request(path + '/status', { ...accountRequest(), method: 'POST', body: { receipt }, parse: parseReceipt });
}
