import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { accountError } from '../../control/account-error';
import { readingFields, type ReadingProfile } from '../model/reading-profile';
import { requestReadingProfile, saveReadingProfile } from '../requests/reading-profile';

export function useReadingProfileDraft(ownerId: string) {
  const [baseline, setBaseline] = useState<ReadingProfile>();
  const [data, setData] = useState<ReadingProfile>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const saveGeneration = useRef(0);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const dirty = Boolean(data && baseline && readingFields.some(({ key }) =>
    data[key].trim() !== baseline[key].trim() || data.visibility[key] !== baseline.visibility[key]));
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useFocusEffect(useCallback(() => {
    if (dirtyRef.current || pending.current) return;
    const controller = new AbortController();
    const generation = saveGeneration.current;
    const canRefresh = () => !controller.signal.aborted && !dirtyRef.current
      && generation === saveGeneration.current;
    void requestReadingProfile(controller.signal).then(({ reading }) => {
      if (!canRefresh()) return;
      setBaseline(reading);
      setData(reading);
      setError('');
    }).catch((failure) => {
      if (canRefresh()) setError(accountError(failure, '暂时无法读取出生资料。'));
    });
    return () => controller.abort();
  }, [revision, ownerId]));

  async function save() {
    if (!data || !baseline || pending.current || conflict) return false;
    pending.current = true;
    saveGeneration.current++;
    setSaving(true);
    setNotice(undefined);
    try {
      const result = await saveReadingProfile(ownerId, baseline, data);
      setBaseline(result.reading);
      setData(result.reading);
      setNotice({ text: '出生资料和可见性已保存。' });
      return true;
    } catch (failure) {
      const stale = failure instanceof RequestError && failure.status === 409;
      setConflict(stale);
      setNotice({ text: stale ? '出生资料已在别处更新。请加载最新资料后重新核对。'
        : accountError(failure, '无法保存出生资料，请重试。'), error: true });
      return false;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  function changeField(key: keyof ReadingProfile['visibility'], value: string) {
    setData((current) => current && { ...current, [key]: value });
  }

  function changeVisibility(key: keyof ReadingProfile['visibility'], value: boolean) {
    setData((current) => current && { ...current, visibility: { ...current.visibility, [key]: value } });
  }

  return { data, dirty, error, notice, save, saving, conflict, changeField, changeVisibility,
    discard: () => setData(baseline),
    retry: () => { setError(''); setRevision((value) => value + 1); },
    reloadAfterConflict: () => {
      setData(undefined);
      setBaseline(undefined);
      setConflict(false);
      setNotice(undefined);
      setRevision((value) => value + 1);
    },
  };
}
