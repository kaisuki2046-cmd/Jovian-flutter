export type ReadingKind = 'fortune' | 'synastry';
export type ReadingArchive = {
  version: 1;
  kind: ReadingKind;
  title: string;
  contextKey: string;
  calculatedAt: string;
  sections: { id: string; title: string; body: string }[];
  context: {
    snapshotId?: string; reportId?: string; calculationRunId?: string;
    periodType?: 'day' | 'week' | 'month' | 'year'; displayTimezone?: string;
    windowStart?: number; windowEnd?: number;
  };
};
export type ReadingHistoryEntry = {
  id: string; savedAt: number; calculatedAt: string; title: string; kind: ReadingKind;
};
export type ReadingHistoryRecord = ReadingHistoryEntry & { report: ReadingArchive };
export type ReadingHistoryPage = { entries: ReadingHistoryEntry[]; nextCursor: string | null };
