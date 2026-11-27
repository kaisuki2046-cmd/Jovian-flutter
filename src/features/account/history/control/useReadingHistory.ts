import { useCallback, useEffect, useRef, useState } from 'react';
import { listReadingHistory, requestLatestReadingArchive, requestReadingArchive, saveReadingArchive } from '../requests/reading-history';
import type { ReadingArchive, ReadingHistoryPage, ReadingKind } from '../model/reading-archive';

export function useReadingHistory(kind: ReadingKind, ownerId?: string) {
  const identity = kind + ':' + (ownerId ?? '');
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [page, setPage] = useState<ReadingHistoryPage & { identity: string }>({ entries: [], nextCursor: null, identity });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    setPage({ entries: [], nextCursor: null, identity });
    if (!ownerId) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    void listReadingHistory(ownerId, kind, undefined, controller.signal).then(result => {
      if (!controller.signal.aborted && currentIdentity.current === identity) setPage({ ...result, identity });
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ownerId, kind, identity, revision]);
  const latest = useCallback((contextKey?: string, signal?: AbortSignal) => {
    if (!ownerId) return Promise.resolve(null);
    return requestLatestReadingArchive(ownerId, kind, contextKey, signal);
  }, [ownerId, kind]);
  const read = useCallback((id: string, signal?: AbortSignal) => {
    if (!ownerId) throw new Error('No archive identity');
    return requestReadingArchive(ownerId, kind, id, signal);
  }, [ownerId, kind]);
  const save = useCallback(async (report: ReadingArchive, signal?: AbortSignal) => {
    if (!ownerId || report.kind !== kind) throw new Error('Invalid archive identity or kind');
    const record = await saveReadingArchive(ownerId, report, signal);
    if (currentIdentity.current === identity) refresh();
    return record;
  }, [ownerId, kind, identity, refresh]);
  async function loadMore() {
    if (!ownerId || !page.nextCursor || pending.current) return;
    pending.current = true; setLoading(true); setError(false);
    try {
      const result = await listReadingHistory(ownerId, kind, page.nextCursor);
      if (currentIdentity.current !== identity) return;
      setPage(current => ({ entries: [...current.entries, ...result.entries.filter(row => !current.entries.some(old => old.id === row.id))],
        nextCursor: result.nextCursor, identity }));
    } catch { setError(true); } finally { pending.current = false; setLoading(false); }
  }
  return { entries: page.identity === identity ? page.entries : [], hasMore: page.identity === identity && page.nextCursor !== null,
    loading, error, refresh, loadMore, latest, read, save };
}
