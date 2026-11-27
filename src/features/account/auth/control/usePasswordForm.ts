import { useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { accountError } from '../../control/account-error';
import { phoneError } from './usePhoneForm';
import { requestPasswordSetupCode, type PhoneChallenge } from '../requests/phone';
import { useAccountSession } from './SessionProvider';
import { minPasswordLength } from '../model/password-policy.mjs';

export function usePasswordForm(hasPassword: boolean) {
  const { changePassword, setupPassword, busy } = useAccountSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge>();
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const pending = busy || requesting;

  async function sendCode() {
    setRequesting(true);
    setMessage(undefined);
    try {
      setChallenge(await requestPasswordSetupCode());
      setCode('');
    } catch (error) {
      setMessage({ text: phoneError(error), error: true });
    } finally {
      setRequesting(false);
    }
  }

  async function save() {
    if (Array.from(next).length < minPasswordLength || next !== confirm) {
      setMessage({ text: `请输入两次相同的新密码，至少 ${minPasswordLength} 个字符。`, error: true });
      return;
    }
    if (hasPassword && (!current || next === current)) {
      setMessage({ text: '请输入当前密码，并使用与当前密码不同的新密码。', error: true });
      return;
    }
    if (!hasPassword && (!challenge || !/^\d{6}$/.test(code))) {
      setMessage({ text: '请输入绑定手机号收到的六位验证码。', error: true });
      return;
    }
    setMessage(undefined);
    try {
      if (hasPassword) {
        await changePassword(current, next);
      } else if (challenge) {
        await setupPassword({ challengeId: challenge.challengeId, code, newPassword: next });
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setChallenge(undefined);
      setCode('');
      setMessage({ text: hasPassword ? '密码已更新，其他设备的会话已退出。' : '密码已设置，现在可以用手机号和密码登录。' });
    } catch (error) {
      if (!hasPassword && error instanceof RequestError && error.status === 410) {
        setChallenge(undefined);
        setCode('');
      }
      setMessage({ text: hasPassword ? accountError(error, '无法更新密码，请重试。') : phoneError(error), error: true });
    }
  }

  return { current, setCurrent, next, setNext, confirm, setConfirm, challenge, code, setCode, message, pending, sendCode, save };
}
