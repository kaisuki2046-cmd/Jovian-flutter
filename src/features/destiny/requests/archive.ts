import type { archiveDestinyReport } from '../../account';
import { RequestError } from '../../../shared/http/client';
import type { DestinyArchiveWithSnapshot } from '../control/account-report';

export async function saveDestinyArchive(
  send: typeof archiveDestinyReport,
  ownerId: string,
  report: DestinyArchiveWithSnapshot,
  signal: AbortSignal,
) {
  const { chartSnapshot, ...summary } = report;
  try {
    const entry = await send(ownerId, report, signal);
    const snapshotSaved = 'chartSnapshotSaved' in entry && entry.chartSnapshotSaved === true;
    return { record: { ...entry, report: snapshotSaved ? report : summary }, snapshotSaved };
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 413) throw error;
    if (signal.aborted) throw error;
    // Older account servers reject snapshots larger than the former 64 KiB limit.
    const entry = await send(ownerId, summary, signal);
    return { record: { ...entry, report: summary }, snapshotSaved: false };
  }
}
