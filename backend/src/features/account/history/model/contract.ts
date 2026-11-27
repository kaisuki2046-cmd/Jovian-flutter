import type { DestinyChartSnapshot } from '../../../destiny';

export type DestinyArchive = {
  version: 1;
  calculatedAt: string;
  timeKnown: boolean;
  mode: 'local' | 'hybrid' | 'deepseek';
  overview: string;
  charts: { method: 'bazi' | 'ziwei' | 'western'; engine: string; note?: string; rows: { label: string; value: string }[] }[];
  chartSnapshot?: DestinyChartSnapshot;
};

export type HistoryEntry = { id: string; savedAt: number; calculatedAt: string; title: string };
export type DestinyArchiveReceipt = HistoryEntry & { chartSnapshotSaved?: true };
export type HistoryPage = { entries: HistoryEntry[]; nextCursor: string | null };
export type HistoryRecord = HistoryEntry & { report: DestinyArchive };
type ChartArchiveReference = { archiveId: string; calculatedAt: string };
export type AccountChartSnapshotResult =
  | { status: 'no_archive' }
  | ({ status: 'missing_snapshot' } & ChartArchiveReference)
  | ({ status: 'available'; chartSnapshot: DestinyChartSnapshot } & ChartArchiveReference);
