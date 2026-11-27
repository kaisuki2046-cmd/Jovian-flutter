import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { archiveDestinyReport, requestLatestDestinyArchive, type HistoryRecord } from '../../account';
import { RequestError } from '../../../shared/http/client';
import { saveDestinyArchive } from '../requests/archive';
import type { DestinyArchiveWithSnapshot } from './account-report';

type Latest =
  | { status: 'loading' | 'failed' }
  | { status: 'ready'; record: HistoryRecord | null };
type SaveAttempt = { report: DestinyArchiveWithSnapshot; revision: number;
  status: 'saving' | 'saved' | 'summary' | 'failed' | 'rejected' };

function isIdentityError(error: unknown) {
  return error instanceof RequestError && (error.kind === 'auth' || error.status === 401 || error.status === 403);
}

// The screen remounts this hook for each account archive identity.
export function useDestinyArchive(ownerId: string | undefined, report: DestinyArchiveWithSnapshot | null, recheckIdentity: () => void) {
  const [latest, setLatest] = useState<Latest>({ status: 'loading' });
  const [latestRevision, setLatestRevision] = useState(0);
  const [saveRevision, setSaveRevision] = useState(0);
  const [save, setSave] = useState<SaveAttempt>();
  const lastAttempt = useRef<SaveAttempt | undefined>(undefined);
  const completedSaves = useRef(0);
  const invalidated = useRef(false);

  const invalidate = useCallback(() => {
    if (invalidated.current) return;
    invalidated.current = true;
    setLatest({ status: 'failed' });
    recheckIdentity();
  }, [recheckIdentity]);

  const refreshLatest = useCallback(() => setLatestRevision((revision) => revision + 1), []);

  useFocusEffect(useCallback(() => {
    if (!ownerId || invalidated.current) return;
    const controller = new AbortController();
    const saveCount = completedSaves.current;
    setLatest((current) => current.status === 'ready' && current.record ? current : { status: 'loading' });
    void requestLatestDestinyArchive(ownerId, controller.signal).then((record) => {
      if (!controller.signal.aborted && !invalidated.current && completedSaves.current === saveCount) {
        setLatest({ status: 'ready', record });
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted || invalidated.current) return;
      if (isIdentityError(error)) invalidate();
      else if (completedSaves.current === saveCount) {
        setLatest((current) => current.status === 'ready' && current.record ? current : { status: 'failed' });
      }
    });
    return () => controller.abort();
  }, [ownerId, latestRevision, invalidate]));

  useFocusEffect(useCallback(() => {
    if (!ownerId || !report || invalidated.current) return;
    const previous = lastAttempt.current;
    if (previous?.report === report && previous.revision === saveRevision && previous.status !== 'saving') return;

    const controller = new AbortController();
    const mark = (status: SaveAttempt['status']) => {
      const attempt = { report, revision: saveRevision, status };
      lastAttempt.current = attempt;
      setSave(attempt);
    };
    mark('saving');
    void saveDestinyArchive(archiveDestinyReport, ownerId, report, controller.signal).then(({ record, snapshotSaved }) => {
      if (controller.signal.aborted || invalidated.current) return;
      completedSaves.current++;
      setLatest({ status: 'ready', record });
      mark(snapshotSaved ? 'saved' : 'summary');
    }).catch((error: unknown) => {
      if (controller.signal.aborted || invalidated.current) return;
      if (isIdentityError(error)) invalidate();
      else if (error instanceof RequestError && (error.status === 400 || error.status === 413)) mark('rejected');
      else mark('failed');
    });
    return () => controller.abort();
  }, [ownerId, report, saveRevision, invalidate]));

  return {
    latest,
    refreshLatest,
    identityInvalid: invalidated.current,
    saveStatus: ownerId ? (save && save.report === report ? save.status : 'saving') : 'unavailable',
    retryArchive: () => setSaveRevision((revision) => revision + 1),
  } as const;
}
