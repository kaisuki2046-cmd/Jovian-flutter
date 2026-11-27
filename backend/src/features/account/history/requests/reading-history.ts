import { accountClient, accountRequest } from '../../client';
import { parseReadingArchive } from '../model/reading-archive.mjs';
import type { ReadingArchive, ReadingHistoryEntry, ReadingHistoryPage, ReadingHistoryRecord, ReadingKind } from '../model/reading-archive';

const path = '/account/reading-history';
function entry(value: unknown): ReadingHistoryEntry {
  const result = value as ReadingHistoryEntry | null;
  if (!result || !/^[a-f\d]{64}$/u.test(result.id) || !Number.isFinite(result.savedAt)
    || typeof result.title !== 'string' || typeof result.calculatedAt !== 'string'
    || (result.kind !== 'fortune' && result.kind !== 'synastry')) throw new Error('Invalid reading archive entry');
  return { id: result.id, savedAt: result.savedAt, calculatedAt: result.calculatedAt, title: result.title, kind: result.kind };
}
function record(value: unknown): ReadingHistoryRecord {
  const result = entry(value);
  const report = parseReadingArchive((value as ReadingHistoryRecord).report);
  if (!report || report.kind !== result.kind) throw new Error('Invalid reading archive');
  return { ...result, report: report as ReadingArchive };
}
export function saveReadingArchive(expectedOwnerId: string, report: ReadingArchive, signal?: AbortSignal) {
  return accountClient.request(path, { ...accountRequest(true), method: 'POST', body: { expectedOwnerId, report }, signal, parse: record });
}
export function requestLatestReadingArchive(expectedOwnerId: string, kind: ReadingKind, contextKey?: string, signal?: AbortSignal) {
  return accountClient.request(path + '/latest', { ...accountRequest(true), signal, query: { expectedOwnerId, kind, contextKey },
    parse: value => value === null ? null : record(value) });
}
export function requestReadingArchive(expectedOwnerId: string, kind: ReadingKind, id: string, signal?: AbortSignal) {
  return accountClient.request(path + '/' + id, { ...accountRequest(true), signal, query: { expectedOwnerId, kind }, parse: record });
}
export function listReadingHistory(expectedOwnerId: string, kind: ReadingKind, before?: string, signal?: AbortSignal) {
  return accountClient.request(path, { ...accountRequest(true), signal, query: { expectedOwnerId, kind, before },
    parse(value: unknown): ReadingHistoryPage {
      const page = value as ReadingHistoryPage;
      if (!page || !Array.isArray(page.entries) || (page.nextCursor !== null && !/^[a-f\d]{64}$/u.test(page.nextCursor))) {
        throw new Error('Invalid reading history');
      }
      return { entries: page.entries.map(entry), nextCursor: page.nextCursor };
    } });
}
