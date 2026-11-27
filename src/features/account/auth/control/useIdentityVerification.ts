import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { requestIdentityVerificationStatus, requestIdentityVerificationSubmission } from '../requests/identity-verification';

export function useIdentityVerificationStatus() {
  const [status, setStatus] = useState<'loading' | 'not_enabled' | 'error'>('loading');
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setStatus('loading');
    void requestIdentityVerificationStatus(controller.signal).then((result) => {
      if (!controller.signal.aborted) setStatus(result.status);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      // Account servers deployed before this endpoint also have verification disabled.
      setStatus(error instanceof RequestError && error.status === 404 ? 'not_enabled' : 'error');
    });
    return () => controller.abort();
  }, [revision]));

  return { status, retry: () => setRevision((value) => value + 1) };
}

export function useIdentityVerificationForm() {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const pending = useRef<AbortController | null>(null);
  const ready = name.trim().length > 0 && /^\d{17}[\dXx]$/.test(idNumber) && agreed;

  useFocusEffect(useCallback(() => () => {
    pending.current?.abort();
    pending.current = null;
    setName('');
    setIdNumber('');
    setAgreed(false);
    setFeedback(undefined);
    setBusy(false);
  }, []));

  async function submit() {
    if (!ready || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFeedback(undefined);
    let unavailable = true;
    try {
      await requestIdentityVerificationSubmission(controller.signal);
    } catch (failure) {
      unavailable = failure instanceof RequestError && (failure.status === 503 || failure.status === 404);
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
        setName('');
        setIdNumber('');
        setFeedback(unavailable ? { text: '实名认证服务暂未接入。' } : { text: '暂时无法提交实名认证，请重试。', error: true });
      }
    }
  }

  return { name, setName, idNumber, setIdNumber, agreed, setAgreed, busy, ready, feedback, submit };
}
