import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { confirmAccountBirthProfile, requestAccountBirthProfile, type AccountBirthProfile } from '../../account';
import { RequestError } from '../../../shared/http/client';
import { accountBirthFields, accountBirthProfileFromDraft } from '../model/account-birth-profile';
import type { BirthProfile } from '../model/birth-profile';

type AccountProfileState =
  | { status: 'loading' | 'failed' }
  | { status: 'ready'; profile: AccountBirthProfile };

type ProfileSave =
  | { status: 'idle' | 'saving' | 'failed' }
  | { status: 'conflict'; latest: AccountBirthProfile };

export function useAccountBirthProfile(ownerId: string | null) {
  const [account, setAccount] = useState<AccountProfileState>({ status: 'loading' });
  const [save, setSave] = useState<ProfileSave>({ status: 'idle' });
  const [revision, setRevision] = useState(0);
  const pendingSave = useRef<AbortController | null>(null);

  useFocusEffect(useCallback(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    setAccount({ status: 'loading' });
    void requestAccountBirthProfile(ownerId, accountBirthFields, controller.signal).then((profile) => {
      if (!controller.signal.aborted) setAccount({ status: 'ready', profile });
    }).catch(() => {
      if (!controller.signal.aborted) setAccount({ status: 'failed' });
    });
    return () => {
      controller.abort();
      pendingSave.current?.abort();
      pendingSave.current = null;
      setSave({ status: 'idle' });
    };
  }, [ownerId, revision]));

  async function confirm(profile: BirthProfile, baseline: AccountBirthProfile) {
    if (!ownerId || pendingSave.current) return false;
    const controller = new AbortController();
    const { signal } = controller;
    pendingSave.current = controller;
    setSave({ status: 'saving' });
    try {
      const saved = await confirmAccountBirthProfile(ownerId, baseline, accountBirthProfileFromDraft(profile), signal);
      if (signal.aborted) return false;
      setAccount({ status: 'ready', profile: saved });
      setSave({ status: 'idle' });
      return true;
    } catch (error) {
      if (signal.aborted) return false;
      if (error instanceof RequestError && error.status === 409) {
        try {
          const latest = await requestAccountBirthProfile(ownerId, accountBirthFields, signal);
          if (!signal.aborted) {
            setAccount({ status: 'ready', profile: latest });
            setSave({ status: 'conflict', latest });
          }
        } catch {
          if (!signal.aborted) setSave({ status: 'failed' });
        }
      } else {
        setSave({ status: 'failed' });
      }
      return false;
    } finally {
      if (pendingSave.current === controller) pendingSave.current = null;
    }
  }

  return {
    account, save, confirm,
    retryRead: () => setRevision((current) => current + 1),
    clearSave: () => setSave({ status: 'idle' }),
  };
}
