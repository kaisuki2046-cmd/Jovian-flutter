import { useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { phoneError } from './usePhoneForm';
import type { PhoneChallenge } from '../requests/phone';
import { requestRecoveryCode, resetPassword, verifyRecoveryCode } from '../requests/recovery';
import { minPasswordLength } from '../model/password-policy.mjs';

export function usePasswordRecovery({ phone, onClose, onComplete }: {
  phone: string;
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [challenge, setChallenge] = useState<PhoneChallenge>();
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const digits = phone.replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
  const masked = digits.length >= 8 ? digits.slice(0, 3) + '******' + digits.slice(-2) : '当前输入的号码';

  function close() {
    if (!pending.current) onClose();
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 410) {
        setChallenge(undefined);
        setToken('');
        setCode('');
      }
      setError(phoneError(failure));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const complete = () => {
    if (Array.from(password).length < minPasswordLength || password !== confirm) {
      setError(`请输入两次相同的新密码，至少 ${minPasswordLength} 个字符。`);
      return;
    }
    void run(async () => {
      await resetPassword({ phone, resetToken: token, newPassword: password });
      await onComplete();
    });
  };

  const sendCode = () => void run(async () => {
    setChallenge(await requestRecoveryCode(phone));
    setCode('');
  });

  const verify = () => {
    if (!challenge || !/^\d{6}$/.test(code)) {
      setError('请输入六位验证码。');
      return;
    }
    void run(async () => {
      setToken(await verifyRecoveryCode({ phone, challengeId: challenge.challengeId, code }));
      setCode('');
    });
  };

  const needsNewPassword = Boolean(token);
  return { challenge, code, setCode, needsNewPassword, password, setPassword, confirm, setConfirm, error, busy, masked, close, complete, sendCode, verify };
}
