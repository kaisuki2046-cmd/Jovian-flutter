import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { RequestError } from '../../../../shared/http/client';
import { useAccountSession } from '../../auth/control/SessionProvider';
import type { HistoryPage } from '../model/contract';
import type { ReadingKind } from '../model/reading-archive';
import { listDestinyHistory, requestDestinyHistoryRecord } from '../requests/destiny-history';
import { listReadingHistory, requestReadingArchive } from '../requests/reading-history';

export type ReportKind = 'destiny' | ReadingKind;
type ReportDetail = { title: string; calculatedAt: string; body: string };

// The view keys this hook's owner by both archive identity and report category.
export function useReportHistory(ownerId: string, kind: ReportKind) {
  const { reload } = useAccountSession();
  const [page, setPage] = useState<HistoryPage>();
  const [listError, setListError] = useState(false);
  const [paging, setPaging] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<ReportDetail>();
  const [detailError, setDetailError] = useState(false);
  const [listRevision, setListRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const focusRequest = useRef<AbortController | null>(null);
  const pendingPage = useRef<AbortController | null>(null);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof RequestError && (error.kind === 'auth' || error.status === 401 || error.status === 403)) {
      setPage(undefined);
      setSelected(undefined);
      setDetail(undefined);
      reload();
    }
  }, [reload]);

  const list = useCallback((signal: AbortSignal, before?: string): Promise<HistoryPage> => kind === 'destiny'
    ? listDestinyHistory(ownerId, before, signal)
    : listReadingHistory(ownerId, kind, before, signal), [ownerId, kind]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    focusRequest.current = controller;
    setPage(undefined);
    setListError(false);
    setPaging(false);
    setSelected(undefined);
    setDetail(undefined);
    void list(controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(result);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      handleError(error);
      setListError(true);
    });
    return () => {
      controller.abort();
      focusRequest.current = null;
      pendingPage.current = null;
    };
  }, [list, handleError, listRevision]));

  useFocusEffect(useCallback(() => {
    setDetail(undefined);
    setDetailError(false);
    if (!selected) return;
    const controller = new AbortController();
    async function read(): Promise<ReportDetail> {
      if (kind === 'destiny') {
        const record = await requestDestinyHistoryRecord(ownerId, selected!, controller.signal);
        return { title: record.title, calculatedAt: record.calculatedAt,
          body: record.report.overview };
      }
      const record = await requestReadingArchive(ownerId, kind, selected!, controller.signal);
      return { title: record.title, calculatedAt: record.calculatedAt,
        body: record.report.sections.map(section => '## ' + section.title + '\n\n' + section.body).join('\n\n') };
    }
    void read().then(result => {
      if (!controller.signal.aborted) setDetail(result);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      handleError(error);
      setDetailError(true);
    });
    return () => controller.abort();
  }, [ownerId, kind, selected, detailRevision, handleError]));

  async function loadMore() {
    const controller = focusRequest.current;
    const before = page?.nextCursor;
    if (!controller || pendingPage.current || !before) return;
    pendingPage.current = controller;
    setPaging(true);
    setListError(false);
    try {
      const more = await list(controller.signal, before);
      if (!controller.signal.aborted) setPage(current => current && current.nextCursor === before
        ? { entries: [...current.entries, ...more.entries.filter(entry => !current.entries.some(old => old.id === entry.id))],
          nextCursor: more.nextCursor } : current);
    } catch (error) {
      if (!controller.signal.aborted) {
        handleError(error);
        setListError(true);
      }
    } finally {
      if (pendingPage.current === controller) pendingPage.current = null;
      if (!controller.signal.aborted) setPaging(false);
    }
  }

  return { page, listError, paging, selected, detail, detailError, loadMore,
    refresh: () => setListRevision(value => value + 1),
    select: (id?: string) => { setDetail(undefined); setDetailError(false); setSelected(id); },
    retryDetail: () => setDetailRevision(value => value + 1) };
}
