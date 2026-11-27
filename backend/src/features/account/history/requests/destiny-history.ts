import { accountClient, accountRequest } from '../../client';
import { parseDestinyArchive } from '../model/destiny-archive.mjs';
import { parseChartSnapshot } from '../model/chart-snapshot.mjs';
import type { AccountChartSnapshotResult, DestinyArchive, DestinyArchiveReceipt, HistoryEntry, HistoryPage, HistoryRecord } from '../model/contract';
import type { SynastrySnapshotResult } from '../model/synastry-snapshot';
const path = '/account/destiny-history';
const chartPath = '/account/chart-snapshots/';
const synastryPath = '/account/synastry-chart-snapshots/';
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{64}$/u.test(value);

function parseEntry(value: unknown): HistoryEntry {
  const entry = value as Partial<HistoryEntry> | null;
  if (!entry || !validId(entry.id) || typeof entry.savedAt !== 'number'
    || typeof entry.calculatedAt !== 'string' || typeof entry.title !== 'string') throw new Error('Invalid archive entry.');
  return { id: entry.id, savedAt: entry.savedAt, calculatedAt: entry.calculatedAt, title: entry.title };
}

function parseRecord(value: unknown): HistoryRecord {
  const entry = parseEntry(value);
  const report = parseDestinyArchive((value as Partial<HistoryRecord>).report, { readingHistory: true });
  if (!report) throw new Error('Invalid archived report.');
  return { ...entry, report: report as DestinyArchive };
}

function parseReceipt(value: unknown): DestinyArchiveReceipt {
  const entry = parseEntry(value);
  return (value as Partial<DestinyArchiveReceipt>).chartSnapshotSaved === true
    ? { ...entry, chartSnapshotSaved: true }
    : entry;
}

export function archiveDestinyReport(expectedOwnerId: string, report: DestinyArchive, signal?: AbortSignal) {
  return accountClient.request(path, { ...accountRequest(true), method: 'POST', body: { expectedOwnerId, report }, signal,
    parse: parseReceipt });
}

export function listDestinyHistory(expectedOwnerId: string, before?: string, signal?: AbortSignal) {
  return accountClient.request(path, { ...accountRequest(true), query: { expectedOwnerId, before }, signal,
    parse(value: unknown): HistoryPage {
      const page = value as Partial<HistoryPage> | null;
      if (!page || !Array.isArray(page.entries) || page.nextCursor !== null && !validId(page.nextCursor)) {
        throw new Error('Invalid archive page.');
      }
      return { entries: page.entries.map(parseEntry), nextCursor: page.nextCursor };
    },
  });
}

export function requestDestinyHistoryRecord(expectedOwnerId: string, id: string, signal?: AbortSignal) {
  if (!validId(id)) throw new Error('Invalid archive ID.');
  return accountClient.request(path + '/' + id, {
    ...accountRequest(true), query: { expectedOwnerId }, signal, parse: parseRecord,
  });
}

export function requestLatestDestinyArchive(expectedOwnerId: string, signal?: AbortSignal) {
  return accountClient.request(path + '/latest', {
    ...accountRequest(true), query: { expectedOwnerId }, signal,
    parse: (value) => value === null ? null : parseRecord(value),
  });
}

function parseAccountChartSnapshot(value: unknown): AccountChartSnapshotResult {
  const result = value as AccountChartSnapshotResult | null;
  if (result?.status === 'no_archive') return { status: 'no_archive' };
  if ((result?.status === 'missing_snapshot' || result?.status === 'available')
    && validId(result.archiveId) && typeof result.calculatedAt === 'string') {
    const { archiveId, calculatedAt } = result;
    if (result.status === 'missing_snapshot') return { status: result.status, archiveId, calculatedAt };
    if (result.status === 'available' && typeof result.chartSnapshot?.timeKnown === 'boolean') {
      const snapshot = parseChartSnapshot(result.chartSnapshot, result.chartSnapshot.timeKnown);
      if (snapshot) return { status: result.status, archiveId, calculatedAt, chartSnapshot: snapshot as NonNullable<DestinyArchive['chartSnapshot']> };
    }
  }
  throw new Error('Invalid account chart snapshot.');
}

export function requestLatestAccountChartSnapshot(expectedOwnerId: string, signal?: AbortSignal) {
  return accountClient.request(chartPath + 'latest', {
    ...accountRequest(true), query: { expectedOwnerId }, signal, parse: parseAccountChartSnapshot,
  });
}

export function requestAccountChartSnapshot(expectedOwnerId: string, archiveId: string, signal?: AbortSignal) {
  if (!validId(archiveId)) throw new Error('Invalid archive ID.');
  return accountClient.request(chartPath + archiveId, {
    ...accountRequest(true), query: { expectedOwnerId }, signal, parse: parseAccountChartSnapshot,
  });
}

function parseSynastrySnapshot(value: unknown): SynastrySnapshotResult {
  const result = value as SynastrySnapshotResult | null;
  if (result?.status === 'no_archive') return { status: 'no_archive' };
  if (result?.status === 'missing_snapshot' && validId(result.archiveId) && typeof result.calculatedAt === 'string') {
    return { status: result.status, archiveId: result.archiveId, calculatedAt: result.calculatedAt };
  }
  if (result?.status === 'available' && result.snapshot?.schemaVersion === 1
    && validId(result.snapshot.snapshotId) && result.snapshot.archiveId === result.snapshot.snapshotId
    && typeof result.snapshot.calculatedAt === 'string' && typeof result.snapshot.timeKnown === 'boolean'
    && result.snapshot.bazi && result.snapshot.ziwei && result.snapshot.western) return result;
  throw new Error('Invalid synastry chart snapshot.');
}

export function requestLatestSynastrySnapshot(expectedOwnerId: string, signal?: AbortSignal, includeCalculationContext = false) {
  return accountClient.request(synastryPath + 'latest', {
    ...accountRequest(true), query: { expectedOwnerId, ...(includeCalculationContext && { calculationContext: '1' }) },
    signal, parse: parseSynastrySnapshot,
  });
}

export function requestSynastrySnapshot(expectedOwnerId: string, snapshotId: string, signal?: AbortSignal, includeCalculationContext = false) {
  if (!validId(snapshotId)) throw new Error('Invalid snapshot ID.');
  return accountClient.request(synastryPath + snapshotId, {
    ...accountRequest(true), query: { expectedOwnerId, ...(includeCalculationContext && { calculationContext: '1' }) },
    signal, parse: parseSynastrySnapshot,
  });
}
