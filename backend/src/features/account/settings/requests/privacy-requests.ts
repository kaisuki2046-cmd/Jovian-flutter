import { accountClient, accountRequest } from '../../client';

export type PrivacyRequestKind = 'access_copy' | 'correction';
export type PrivacyReceipt = { id: string; kind: PrivacyRequestKind; detail: string; createdAt: number;
  reviewedAt: number | null; conclusion: string | null };
type ReviewItem = PrivacyReceipt & { ownerId: string };
const path = '/account/privacy-requests';

function parseReceipt(value: unknown): PrivacyReceipt {
  const item = value as PrivacyReceipt | null;
  if (!item || typeof item.id !== 'string' || (item.kind !== 'access_copy' && item.kind !== 'correction') ||
      typeof item.detail !== 'string' || !Number.isSafeInteger(item.createdAt) ||
      (item.reviewedAt !== null && !Number.isSafeInteger(item.reviewedAt)) ||
      (item.conclusion !== null && typeof item.conclusion !== 'string')) throw new Error('Invalid privacy request');
  return item;
}

export function requestPrivacyPage(review: boolean, before?: string, signal?: AbortSignal) {
  return accountClient.request(path + (review ? '/review' : ''), {
    ...accountRequest(true), signal, query: before ? { before } : undefined,
    parse(value) {
      const page = value as { items?: unknown[]; next?: string; canReview?: boolean } | null;
      if (!Array.isArray(page?.items) || (page.next !== undefined && typeof page.next !== 'string')) throw new Error('Invalid privacy page');
      const items = page.items.map((item): PrivacyReceipt & { ownerId?: string } => {
        const receipt = parseReceipt(item);
        if (!review) return receipt;
        const ownerId = (item as ReviewItem).ownerId;
        if (typeof ownerId !== 'string') throw new Error('Invalid privacy request owner');
        return { ...receipt, ownerId };
      });
      return { items, next: page.next, canReview: page.canReview === true };
    },
  });
}

export function submitPrivacyRequest(kind: PrivacyRequestKind, detail: string) {
  return accountClient.request(path, {
    ...accountRequest(true), method: 'POST', body: { kind, detail }, parse: parseReceipt,
  });
}

export function reviewPrivacyRequest(id: string, conclusion: string) {
  return accountClient.request(path + '/review', {
    ...accountRequest(true), method: 'POST', body: { id, conclusion }, parse: parseReceipt,
  });
}
