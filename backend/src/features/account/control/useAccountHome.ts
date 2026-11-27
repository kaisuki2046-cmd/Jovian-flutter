import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAccountSession } from '../auth/control/SessionProvider';
import { accountSections } from '../model/sections';
import { accountError } from './account-error';

export function useAccountHome() {
  const { session, reload, openLogin } = useAccountAccess();
  const { archiveIdentity } = useAccountSession();
  const entries = accountSections.filter(({ id }) => id !== 'reports' && id !== 'auth');
  return {
    session, reload, openLogin, entries,
    profileId: session.status === 'member' ? session.profile.id : archiveIdentity?.id,
  };
}

export function useAccountExit() {
  const { session, guestAccess, archiveIdentity, busy, logout } = useAccountSession();
  const [confirmExit, setConfirmExit] = useState(false);
  const [exitError, setExitError] = useState('');
  const isMember = session.status === 'member';
  const isGuest = guestAccess && !isMember;

  async function exit() {
    setExitError('');
    try {
      await logout();
      setConfirmExit(false);
    } catch (error) {
      setExitError(accountError(error, isMember ? '无法退出登录，请重试。' : '无法结束游客会话，请重试。'));
    }
  }

  function cancelExit() {
    if (busy) return;
    setConfirmExit(false);
    setExitError('');
  }

  return {
    isMember, isGuest, busy, confirmExit, exitError, exit, cancelExit,
    hasGuestArchive: archiveIdentity?.kind === 'guest',
    requestExit: () => { if (isMember) void exit(); else setConfirmExit(true); },
  };
}

export function useAccountAccess() {
  const router = useRouter();
  const { session, reload } = useAccountSession();
  return { session, reload, openLogin: () => router.push('/welcome') };
}
