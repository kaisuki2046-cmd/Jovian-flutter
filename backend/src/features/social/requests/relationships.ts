import { appSessionRequestOptions, authenticatedAppClient } from '../../account';

export type SocialList = 'following' | 'followers';
export type SocialCounts = Record<SocialList, number>;
export type SocialSummary = SocialCounts & { discoverable: boolean };
export type SocialRelation = { follows: boolean; followedBy: boolean };
export type SocialProfile = SocialCounts & SocialRelation & { id: string; uid?: string; displayName?: string; bio?: string };
export type ReportReason = 'harassment' | 'impersonation' | 'spam' | 'other';
type SocialPage = { items: SocialProfile[]; next?: string };
export type FollowerNotification = { id: string; createdAt: number; readAt: number | null; actor?: SocialProfile };
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type ReportReceipt = { id: string; reason: ReportReason; status: ReportStatus; createdAt: number;
  reviewedAt: number | null; conclusion: string | null };
export type ModerationReport = ReportReceipt & { reporterId: string; targetId: string; detail: string };

export const socialUserId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const socialUid = /^[1-9]\d{7}$/;

function parseCounts(value: unknown): SocialCounts {
  const summary = value as Partial<SocialCounts> | null;
  if (!summary || !Number.isSafeInteger(summary.followers) || !Number.isSafeInteger(summary.following) ||
      summary.followers! < 0 || summary.following! < 0) throw new Error('Invalid relationship counts');
  return { following: summary.following!, followers: summary.followers! };
}

function parseRelation(value: unknown): SocialRelation & SocialCounts {
  const relation = value as Partial<SocialRelation> | null;
  if (typeof relation?.follows !== 'boolean' || typeof relation.followedBy !== 'boolean') throw new Error('Invalid relationship');
  return { ...parseCounts(value), follows: relation.follows, followedBy: relation.followedBy };
}

function parseProfile(value: unknown): SocialProfile {
  const profile = value as Partial<SocialProfile> | null;
  if (typeof profile?.id !== 'string' || !socialUserId.test(profile.id) ||
      (profile.bio !== undefined && typeof profile.bio !== 'string') ||
      (profile.displayName !== undefined && typeof profile.displayName !== 'string')) throw new Error('Invalid social profile');
  return { id: profile.id, uid: profile.uid && socialUid.test(profile.uid) ? profile.uid : undefined,
    displayName: profile.displayName, bio: profile.bio, ...parseRelation(value) };
}

function requestAccountSocial<T>(path: string, parse: (value: unknown) => T, options: {
  signal?: AbortSignal; query?: Record<string, string>; body?: object;
} = {}) {
  const { signal, query, body } = options;
  return authenticatedAppClient.request('/social/' + path, {
    ...appSessionRequestOptions(true), signal, query, parse,
    ...(body ? { method: 'POST', body } : {}),
  });
}

export const requestSocialSummary = (signal?: AbortSignal): Promise<SocialSummary> => requestAccountSocial('me', (value) => {
  const discoverable = (value as { discoverable?: unknown } | null)?.discoverable;
  if (typeof discoverable !== 'boolean') throw new Error('Invalid social visibility');
  return { ...parseCounts(value), discoverable };
}, { signal });

export function requestSocialList(direction: SocialList, before?: string, signal?: AbortSignal): Promise<SocialPage> {
  return requestAccountSocial(direction, (value) => {
    const page = value as Partial<SocialPage> | null;
    if (!page || !Array.isArray(page.items) || (page.next !== undefined && typeof page.next !== 'string')) {
      throw new Error('Invalid relationship list');
    }
    return { items: page.items.map(parseProfile), next: page.next };
  }, { signal, query: before ? { before } : undefined });
}

export function requestSocialSearch(uid: string, signal: AbortSignal) {
  return requestAccountSocial('search', parseProfile, { query: { uid }, signal });
}

export function requestSocialSearchByNickname(nickname: string, signal: AbortSignal) {
  return requestAccountSocial('search', (value) => {
    const items = (value as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) throw new Error('Invalid nickname search result');
    return items.map(parseProfile);
  }, { query: { nickname }, signal });
}

export function requestSocialProfile(id: string, signal?: AbortSignal) {
  return requestAccountSocial('profiles/' + encodeURIComponent(id), parseProfile, { signal });
}

export function setSocialFollow(id: string, active: boolean) {
  return requestAccountSocial('follows', parseRelation, { body: { id, active } });
}

export async function setSocialDiscoverability(allowed: boolean) {
  await requestAccountSocial('discoverability', (value) => {
    if ((value as { discoverable?: boolean } | null)?.discoverable !== allowed) throw new Error('Invalid visibility change');
  }, { body: { allowed } });
}

export function requestSocialBlocks(signal?: AbortSignal) {
  return requestAccountSocial('blocks', (value) => {
    const items = (value as { items?: { id?: unknown; uid?: unknown }[] } | null)?.items;
    if (!Array.isArray(items) || !items.every((item) => typeof item?.id === 'string' && socialUserId.test(item.id))) {
      throw new Error('Invalid block list');
    }
    return items.map((item) => ({ id: item.id as string,
      uid: typeof item.uid === 'string' && socialUid.test(item.uid) ? item.uid : undefined }));
  }, { signal });
}

export async function setSocialBlock(id: string, active: boolean) {
  await requestAccountSocial('blocks', (value) => {
    if ((value as { blocked?: boolean } | null)?.blocked !== active) throw new Error('Invalid block change');
  }, { body: { id, active } });
}

function parseUnread(value: unknown) {
  const unread = (value as { unread?: number } | null)?.unread;
  if (unread === undefined || !Number.isSafeInteger(unread) || unread < 0) throw new Error('Invalid unread count');
  return unread;
}

function parsePage<T>(value: unknown, parse: (item: unknown) => T) {
  const page = value as { items?: unknown[]; next?: string } | null;
  if (!Array.isArray(page?.items) || (page.next !== undefined && typeof page.next !== 'string')) throw new Error('Invalid page');
  return { items: page.items.map(parse), next: page.next };
}

function parseReceipt(value: unknown): ReportReceipt {
  const item = value as ReportReceipt | null;
  if (!item || typeof item.id !== 'string' || !socialUserId.test(item.id) ||
      !['harassment', 'impersonation', 'spam', 'other'].includes(item.reason) ||
      !['pending', 'resolved', 'dismissed'].includes(item.status) || !Number.isSafeInteger(item.createdAt) ||
      (item.reviewedAt !== null && !Number.isSafeInteger(item.reviewedAt)) ||
      (item.conclusion !== null && typeof item.conclusion !== 'string')) throw new Error('Invalid report receipt');
  return item;
}

export function reportSocialUser(id: string, reason: ReportReason, detail: string) {
  return requestAccountSocial('reports', (value) => parseReceipt((value as { report?: unknown } | null)?.report),
    { body: { id, reason, detail } });
}

export function requestSocialInbox(signal?: AbortSignal) {
  return requestAccountSocial('notifications/summary', (value) => ({
    unread: parseUnread(value), canModerate: (value as { canModerate?: unknown }).canModerate === true,
  }), { signal });
}

export function requestFollowerNotifications(before?: string, signal?: AbortSignal) {
  return requestAccountSocial('notifications', (value) => ({
    unread: parseUnread(value),
    ...parsePage(value, (input): FollowerNotification => {
      const item = input as FollowerNotification | null;
      if (!item || typeof item.id !== 'string' || !socialUserId.test(item.id) || !Number.isSafeInteger(item.createdAt) ||
          (item.readAt !== null && !Number.isSafeInteger(item.readAt))) throw new Error('Invalid follower notification');
      return { ...item, actor: item.actor === undefined ? undefined : parseProfile(item.actor) };
    }),
  }), { signal, query: before ? { before } : undefined });
}

export function markFollowerNotificationsRead(id?: string) {
  return requestAccountSocial('notifications/read', parseUnread, { body: id ? { id } : { all: true } });
}

export function requestReportReceipts(before?: string, signal?: AbortSignal) {
  return requestAccountSocial('reports', (value) => parsePage(value, parseReceipt), {
    signal, query: before ? { before } : undefined,
  });
}

export function requestModerationReports(before?: string, signal?: AbortSignal) {
  return requestAccountSocial('moderation/reports', (value) => parsePage(value, (input): ModerationReport => {
    const receipt = parseReceipt(input);
    const { reporterId, targetId, detail } = input as ModerationReport;
    if (typeof reporterId !== 'string' || !socialUserId.test(reporterId) || typeof targetId !== 'string' ||
        !socialUserId.test(targetId) || typeof detail !== 'string') throw new Error('Invalid moderation report');
    return { ...receipt, reporterId, targetId, detail };
  }), { signal, query: before ? { before } : undefined });
}

export function closeModerationReport(id: string, status: Exclude<ReportStatus, 'pending'>, conclusion: string) {
  return requestAccountSocial('moderation/reports', parseReceipt, { body: { id, status, conclusion } });
}
