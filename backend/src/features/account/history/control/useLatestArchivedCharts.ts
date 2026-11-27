import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { requestLatestDestinyArchive } from '../requests/destiny-history';

type HistoryRecord = NonNullable<Awaited<ReturnType<typeof requestLatestDestinyArchive>>>;
export type ArchivedBaZiRows = ReturnType<typeof import('../../../destiny').restoreArchivedBaZiRows>;
type ArchivedChartDetail = Pick<HistoryRecord, 'id' | 'calculatedAt'> &
  Pick<HistoryRecord['report'], 'charts' | 'timeKnown'> & { baZiRows: ArchivedBaZiRows };

export function useLatestArchivedCharts(ownerId: string) {
  const [detail, setDetail] = useState<ArchivedChartDetail | null>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setDetail(undefined);
    setError(false);
    void requestLatestDestinyArchive(ownerId, controller.signal).then(async (record) => {
      if (controller.signal.aborted) return;
      if (!record) {
        setDetail(null);
        return;
      }
      const { charts, timeKnown } = record.report;
      const rows = charts.find(({ method }) => method === 'bazi')?.rows;
      let baZiRows: ArchivedBaZiRows = [];
      if (rows?.length) {
        // Defer loading destiny because its screen also imports the account entry point.
        const { restoreArchivedBaZiRows } = await import('../../../destiny');
        baZiRows = restoreArchivedBaZiRows(rows);
      }
      if (!controller.signal.aborted) setDetail({ id: record.id, calculatedAt: record.calculatedAt, charts, timeKnown, baZiRows });
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [ownerId, revision]));

  return { detail, error, retry: () => setRevision((value) => value + 1) };
}
