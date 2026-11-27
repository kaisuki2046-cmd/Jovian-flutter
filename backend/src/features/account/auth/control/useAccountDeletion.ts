import { useEffect, useState } from 'react';
import { listDeletionReadingTokens } from '../../../divination';
import { RequestError } from '../../../../shared/http/client';
import { useAccountSession } from './SessionProvider';
import { saveDeletion } from './deletion-device';
import { prepareAccountDeletion, requestAccountDeletion, requestDeletionCode, requestDeletionStatus,
  type DeletionProof, type DeletionSetup } from '../requests/deletion';
import type { PhoneChallenge } from '../requests/phone';

export function useAccountDeletion(ownerId: string) {
  const { finishDeletion } = useAccountSession();
  const [setup, setSetup] = useState<DeletionSetup>();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void prepareAccountDeletion(controller.signal).then((data) => {
      if (!controller.signal.aborted) setSetup(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('暂时无法准备注销，请重试。');
    });
    return () => controller.abort();
  }, [revision]);

  async function sendCode() {
    setError('');
    setBusy(true);
    try {
      setChallenge(await requestDeletionCode());
      setCode('');
    } catch {
      setError('无法发送注销验证码，请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  const proof: DeletionProof | undefined =
    setup?.method === 'password' && password ? { password }
    : setup?.method === 'phone' && challenge && /^\d{6}$/.test(code) ? { challengeId: challenge.challengeId, code }
    : setup?.method === 'local-social' ? { simulateSocial: true }
    : undefined;
  const canSubmit = Boolean(proof && confirmed && !busy);

  async function submit() {
    if (!setup || !proof || !canSubmit) return;
    setBusy(true);
    setError('');
    const { receipt } = setup;
    try {
      const legacyReadingTokens = await listDeletionReadingTokens(ownerId);
      await saveDeletion({ receipt, ownerId });
      try {
        await requestAccountDeletion(receipt, proof, legacyReadingTokens);
      } catch (failure) {
        const status = failure instanceof RequestError ? failure.status : undefined;
        if (status !== undefined && status < 500 && status !== 401 && status !== 409) {
          throw failure;
        }
        await requestDeletionStatus(receipt);
      }
      setPassword('');
      setCode('');
      await finishDeletion();
    } catch (failure) {
      setError(failure instanceof RequestError && failure.status === 422 ? '身份验证失败，请核对密码或验证码。'
        : failure instanceof RequestError && failure.status === 410 ? '验证码已失效，请重新获取。'
        : '注销结果暂时无法确认。请重试，或在登录页查看最近一次注销结果。');
    } finally {
      setBusy(false);
    }
  }

  return { setup, password, setPassword, code, setCode, challenge, confirmed, setConfirmed, busy, error, canSubmit,
    sendCode, submit, reload: () => setRevision((value) => value + 1) };
}
