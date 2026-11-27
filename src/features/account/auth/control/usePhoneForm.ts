import { useEffect, useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { accountError } from '../../control/account-error';
import type { SignInAcceptance } from '../../settings/model/agreements';
import { requestBindPhone, requestBoundPhone, requestPhoneCode, type PhoneBindingProof, type PhoneChallenge, type PhoneProof } from '../requests/phone';

export function phoneError(error: unknown) {
  if (error instanceof RequestError) {
    if (error.status === 410) return '这个验证码已失效，请重新获取。';
    if (error.status === 422) return '验证未通过，请检查手机号和刚获取的验证码。';
    if (error.status === 412) return '账户密码不正确。';
    if (error.status === 409) return '这个手机号已绑定到其他账户。';
  }
  return accountError(error, '手机号操作失败，请重试。');
}


function maskedPhone(phone: string) {
  const domestic = /^\+86(1\d{10})$/.exec(phone)?.[1];
  const digits = domestic ?? phone.slice(1);
  return (domestic ? '' : '+') + digits.slice(0, 3) + '*'.repeat(digits.length - 5) + digits.slice(-2);
}


export type PhoneFormProps = {
  purpose: 'login';
  phone: string;
  onBusyChange: (busy: boolean) => void;
  onConfirm: (proof: PhoneProof, acceptance: SignInAcceptance) => Promise<void>;
} | {
  purpose: 'bind';
  title: string;
  description: string;
  currentPhone?: string;
  onBusyChange?: (busy: boolean) => void;
  onConfirm: (proof: PhoneBindingProof) => Promise<void>;
};


export function usePhoneBinding() {
  const [phone, setPhone] = useState<string | null>();
  const [editing, setEditing] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void requestBoundPhone(controller.signal).then((value) => {
      if (!controller.signal.aborted) setPhone(value);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [reload]);

  const toggleEditing = () => {
    setUpdated(false);
    setEditing(!editing);
  };

  const bindPhone = async (proof: PhoneBindingProof) => {
    setPhone(await requestBindPhone(proof));
    setEditing(false);
    setUpdated(true);
  };

  function retry() {
    setFailed(false);
    setReload((value) => value + 1);
  }
  return { phone, masked: phone ? maskedPhone(phone) : undefined, editing, editingBusy, setEditingBusy, updated, failed, retry, toggleEditing, bindPhone };
}

export function usePhoneForm(props: PhoneFormProps) {
  const { purpose } = props;
  const [enteredPhone, setEnteredPhone] = useState('');
  const phone = props.purpose === 'login' ? props.phone : enteredPhone;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge>();
  const [currentChallenge, setCurrentChallenge] = useState<PhoneChallenge>();
  const [currentCode, setCurrentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const binding = purpose === 'bind';
  const currentPhone = props.purpose === 'bind' ? props.currentPhone : undefined;

  function updateBusy(value: boolean) {
    pending.current = value;
    setBusy(value);
    props.onBusyChange?.(value);
  }

  async function sendCode(forCurrent = false) {
    if (pending.current) return;
    const target = forCurrent ? currentPhone : phone.trim();
    if (!target) {
      setNotice({ text: '请输入手机号。', error: true });
      return;
    }
    updateBusy(true);
    setNotice(undefined);
    try {
      const issued = await requestPhoneCode(forCurrent ? 'bind-current' : purpose, target);
      if (forCurrent) {
        setCurrentChallenge(issued);
        setCurrentCode('');
      } else {
        setChallenge(issued);
        setCode('');
      }
    } catch (error) {
      setNotice({ text: phoneError(error), error: true });
    } finally {
      updateBusy(false);
    }
  }

  async function confirm(acceptance?: SignInAcceptance) {
    if (pending.current || (props.purpose === 'login' && !acceptance)) return;
    if (!challenge || !/^\d{6}$/.test(code) ||
        (currentPhone ? !currentChallenge || !/^\d{6}$/.test(currentCode) : binding && !password)) {
      setNotice({ text: currentPhone ? '请输入原手机号和新手机号的六位验证码。' :
        binding ? '请输入六位验证码和账户密码。' : '请输入六位验证码。', error: true });
      return;
    }
    updateBusy(true);
    setNotice(undefined);
    try {
      const proof = { phone, challengeId: challenge.challengeId, code };
      if (props.purpose === 'login') {
        if (acceptance) await props.onConfirm(proof, acceptance);
      } else if (currentPhone && currentChallenge) {
        await props.onConfirm({ ...proof, currentChallengeId: currentChallenge.challengeId, currentCode });
      } else {
        await props.onConfirm({ ...proof, password });
      }
      setCode('');
      setPassword('');
      setChallenge(undefined);
      setCurrentChallenge(undefined);
      setCurrentCode('');
    } catch (error) {
      if (error instanceof RequestError && error.status === 410) {
        setChallenge(undefined);
        setCode('');
        setCurrentChallenge(undefined);
        setCurrentCode('');
      }
      const message = props.purpose === 'login' && error instanceof RequestError && error.status === 409
        ? '此手机号尚未绑定验证，请选择使用密码登录。' : phoneError(error);
      setNotice({ text: message, error: true });
    } finally {
      updateBusy(false);
    }
  }

  const changePhone = (value: string) => {
    setEnteredPhone(value);
    setChallenge(undefined);
    setCode('');
    setNotice(undefined);
  };

  return {
    phone, password, setPassword, code, setCode, challenge, currentChallenge, currentCode, setCurrentCode,
    busy, notice, binding, currentPhone, sendCode, confirm, changePhone,
  };
}
