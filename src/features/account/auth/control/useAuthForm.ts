import { useEffect, useRef, useState } from 'react';
import { RequestError } from '../../../../shared/http/client';
import { accountError } from '../../control/account-error';
import { useAccountSession } from './SessionProvider';
import { clearNativeToken } from '../model/session-token';
import { maxPasswordLength as maxPassword, minPasswordLength as minPassword } from '../model/password-policy.mjs';
import { normalizeEmail, normalizePhone } from '../model/credential-identifier.mjs';
import type { PhoneChallenge, PhoneProof } from '../requests/phone';
import { requestRegistrationCode } from '../requests/registration';
import { requestAuthCapabilities, type AuthCapabilities, type SocialProvider } from '../requests/session';
import { signInAcceptance, type AgreementVersion, type SignInAcceptance } from '../../settings/model/agreements';
import { useAgreementState } from '../../settings/control/useAgreementState';

export { minPassword, maxPassword };
export type AuthPage = 'welcome' | 'phone' | 'register' | 'existing-email';
type AgreementAction = (acceptance: SignInAcceptance) => void;
export type WithAgreement = (action: AgreementAction) => void;

export function useAuthForm(accountServiceReady: boolean, onAgreementOutdated: () => void, aiConsent?: AgreementVersion) {
  const { authenticate, phoneLogin, socialLogin, busy, archiveIdentity } = useAccountSession();
  const [page, setPage] = useState<AuthPage>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMethod, setPhoneMethod] = useState<'code' | 'password'>('code');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailChallenge, setEmailChallenge] = useState<PhoneChallenge>();
  const [emailCode, setEmailCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const emailRequest = useRef(false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [authCapabilities, setAuthCapabilities] = useState<AuthCapabilities | 'legacy'>();
  const capabilities = accountServiceReady ? authCapabilities : undefined;
  const localSocialProviders = capabilities === 'legacy' ? capabilities : capabilities?.localSocialProviders;
  const registering = page === 'register';
  const address = identifier.trim();
  const email = normalizeEmail(address);
  const phone = normalizePhone(address);
  const canRegisterEmail = capabilities === 'legacy' || capabilities?.emailRegistrationAvailable === true;
  const canUsePhoneCode = capabilities === 'legacy' || capabilities?.phoneCodesAvailable === true;
  const canRegisterPhone = canUsePhoneCode || capabilities?.phoneRegistrationWithoutCode === true;
  const canRegister = canRegisterEmail || canRegisterPhone;
  const registrationUnavailable = registering && (phone ? !canRegisterPhone : email ? !canRegisterEmail : !canRegister);
  const verifyPhoneForRegistration = registering && Boolean(phone) && canRegisterPhone
    && (capabilities === 'legacy' || capabilities?.phoneRegistrationWithoutCode !== true);
  const showEmailRegistrationCode = registering && !phone && canRegisterEmail
    && (capabilities === 'legacy' || capabilities?.emailRegistrationCodeRequired !== false);
  const usingPhone = page === 'phone';
  const usingCode = usingPhone && phoneMethod === 'code' && canUsePhoneCode;
  const pending = busy || phoneBusy || sendingEmail;

  useEffect(() => {
    if (!accountServiceReady) {
      setAuthCapabilities(undefined);
      return;
    }
    const controller = new AbortController();
    void requestAuthCapabilities(controller.signal).then((resolved) => {
      if (!controller.signal.aborted) setAuthCapabilities(resolved);
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return;
      // Older account servers enforce availability on the sign-in route itself.
      setAuthCapabilities(failure instanceof RequestError && failure.status === 404
        ? 'legacy' : { localSocialProviders: [], emailRegistrationCodeRequired: true, phoneRegistrationWithoutCode: false,
          emailRegistrationAvailable: false, phoneCodesAvailable: false });
    });
    return () => controller.abort();
  }, [accountServiceReady]);

  async function sendEmailCode() {
    if (!showEmailRegistrationCode || pending || emailRequest.current) return;
    if (!email) return setError('请输入有效的邮箱。');
    emailRequest.current = true;
    setSendingEmail(true);
    setError('');
    try {
      setEmailChallenge(await requestRegistrationCode(email));
      setEmailCode('');
    } catch (failure) {
      setError(accountError(failure, '无法获取邮箱验证码，请重试。'));
    } finally {
      emailRequest.current = false;
      setSendingEmail(false);
    }
  }

  function canSignInWith(provider: SocialProvider) {
    return accountServiceReady && (localSocialProviders === 'legacy' || localSocialProviders?.includes(provider) === true);
  }

  async function signInWith(provider: SocialProvider, acceptance: SignInAcceptance) {
    if (pending || emailRequest.current || !canSignInWith(provider)) return;
    setError('');
    try {
      await socialLogin(provider, acceptance, undefined, aiConsent);
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 412) return onAgreementOutdated();
      setError(accountError(failure, '第三方登录失败，请重试。'));
    }
  }

  async function submit(acceptance: SignInAcceptance) {
    if (pending || emailRequest.current || page === 'welcome' || usingCode) return;
    if (registrationUnavailable) return;
    if (verifyPhoneForRegistration) {
      changePage('phone', address);
      return;
    }
    if (registering ? !phone && !email : usingPhone ? !phone : !email) {
      return setError(registering ? '请输入有效的手机号或邮箱。' : usingPhone ? '请输入有效的手机号。' : '请输入有效的邮箱。');
    }
    if (!password) return setError('请输入密码。');
    const proof = showEmailRegistrationCode && emailChallenge && /^\d{6}$/.test(emailCode)
      ? { challengeId: emailChallenge.challengeId, code: emailCode } : undefined;
    if (registering) {
      if (!displayName.trim()) return setError('请输入昵称。');
      if (Array.from(password).length < minPassword) return setError(`密码至少需要 ${minPassword} 个字符。`);
      if (password !== confirm) return setError('两次输入的密码不一致。');
      if (showEmailRegistrationCode && !proof) return setError('请获取并填写六位邮箱验证码。');
    }
    setError('');
    try {
      if (registering) {
        const credentials = phone ? { phone } : { email: address, ...proof };
        await authenticate('register', { ...credentials, password, displayName }, acceptance, aiConsent);
      } else {
        await authenticate('login', usingPhone ? { phone: address, password } : { email: address, password }, acceptance, aiConsent);
      }
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 412) return onAgreementOutdated();
      if (registering && failure instanceof RequestError) {
        if (failure.status === 409) {
          setEmailChallenge(undefined);
          setEmailCode('');
          return setError(showEmailRegistrationCode ? '昵称或邮箱已被使用。更换后请重新获取邮箱验证码。'
            : phone ? '昵称或手机号已被使用，请修改后再试。' : '昵称或邮箱已被使用，请修改后再试。');
        }
        if (failure.status === 410) {
          setEmailChallenge(undefined);
          setEmailCode('');
          return setError('邮箱验证码已失效，请重新获取。');
        }
        if (failure.status === 422) return setError('邮箱验证码不正确，请检查后重试。');
      }
      setError(accountError(failure, registering ? '注册失败，请重试。' : usingPhone
        ? '手机号或密码不正确。首次登录可使用验证码，再到账户与安全设置密码。' : '邮箱或密码不正确，或登录暂时不可用。'));
    }
  }

  function changePage(next: AuthPage, nextIdentifier = '') {
    if (next === page || pending) return;
    setPage(next);
    setIdentifier(nextIdentifier);
    setPhoneMethod('code');
    setPassword('');
    setConfirm('');
    setEmailChallenge(undefined);
    setEmailCode('');
    setError('');
    setRecovery(false);
    setRecovered(false);
  }

  const changeIdentifier = (value: string) => {
    setIdentifier(value);
    setEmailChallenge(undefined);
    setEmailCode('');
    setError('');
  };
  const changePhoneMethod = (next: typeof phoneMethod) => {
    if (next === phoneMethod) return;
    setPhoneMethod(next);
    setPassword('');
    setError('');
  };
  const openRecovery = () => {
    if (pending || !canUsePhoneCode) return;
    if (!phone) return setError('请输入有效的手机号。');
    setError('');
    setRecovered(false);
    setRecovery(true);
  };
  const finishRecovery = async () => {
    if (archiveIdentity?.kind !== 'guest') await clearNativeToken().catch(() => {});
    setRecovery(false);
    setPhoneMethod('password');
    setPassword('');
    setError('');
    setRecovered(true);
  };
  const confirmPhoneLogin = async (proof: PhoneProof, acceptance: SignInAcceptance) => {
    try { await phoneLogin(proof, acceptance, aiConsent); }
    catch (failure) {
      if (failure instanceof RequestError && failure.status === 412) onAgreementOutdated();
      throw failure;
    }
  };

  const closeRecovery = () => setRecovery(false);
  return {
    page, displayName, setDisplayName, identifier, setPhoneBusy, phoneMethod, password, setPassword, confirm, setConfirm, emailChallenge, emailCode,
    setEmailCode, sendingEmail, error, recovery, recovered, registering, address, usingCode, pending, busy,
    sendEmailCode, signInWith, submit, changePage, changeIdentifier, changePhoneMethod, openRecovery, closeRecovery, finishRecovery, confirmPhoneLogin,
    canSignInWith, localSocialProviders, showEmailRegistrationCode, verifyPhoneForRegistration,
    canRegister, canRegisterEmail, canRegisterPhone, canUsePhoneCode, registrationUnavailable,
    hasGuestArchive: archiveIdentity?.kind === 'guest',
  };
}

export function useWelcomeAccess() {
  const { session, reload, guestAccess, enterAsGuest, resumeAgreement, busy } = useAccountSession();
  const agreement = useAgreementState(false);
  const [checked, setChecked] = useState(false);
  const [aiSelection, setAiSelection] = useState<AgreementVersion>();
  const currentAi = agreement.catalog?.ai;
  const aiConsent = currentAi && aiSelection?.hash === currentAi.hash && aiSelection.version === currentAi.version ? currentAi : undefined;
  const [continuing, setContinuing] = useState(false);
  const [agreementError, setAgreementError] = useState('');
  const [pendingAction, setPendingAction] = useState<AgreementAction>();

  const withAgreement: WithAgreement = (action) => {
    if (busy) return;
    if (checked && agreement.catalog) action(signInAcceptance(agreement.catalog));
    else setPendingAction(() => action);
  };

  function confirmAgreement() {
    if (busy || !agreement.catalog || !pendingAction) return;
    setChecked(true);
    setPendingAction(undefined);
    pendingAction(signInAcceptance(agreement.catalog));
  }

  function reloadAgreement() {
    setChecked(false);
    setAiSelection(undefined);
    setAgreementError('');
    agreement.reload();
  }

  function outdatedAgreement() {
    reloadAgreement();
    setAgreementError('请阅读并重新勾选当前协议。');
  }

  async function continueAccess(acceptance: SignInAcceptance) {
    if (busy || !agreement.catalog) return;
    setAgreementError('');
    try {
      if (session.status === 'guest' && session.pendingAgreement) await resumeAgreement(agreement.catalog);
      else await enterAsGuest(acceptance, aiConsent);
      setContinuing(true);
    } catch (error) {
      if (error instanceof RequestError && (error.status === 409 || error.status === 412)) outdatedAgreement();
      else setAgreementError('暂时无法继续，请重试。');
    }
  }

  return { session, reload, continueAccess, busy, goHome: continuing && guestAccess, checked, setChecked,
    aiConsent, toggleAiConsent: () => setAiSelection(aiConsent ? undefined : currentAi),
    catalog: agreement.catalog, catalogError: agreement.error, agreementError, reloadAgreement, outdatedAgreement,
    withAgreement, agreementPrompt: Boolean(pendingAction), confirmAgreement, cancelAgreement: () => setPendingAction(undefined) };
}
