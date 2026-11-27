import { accountClient, accountRequest } from '../../client';
import { parseProfile } from '../../profile/model/account-profile';
import { isWeb, readNativeToken, saveNativeToken } from '../model/session-token';
import type { PhoneProof } from './phone';
import type { PasswordRegistration } from './registration';
import type { SignInAcceptance } from '../../settings/model/agreements';

export type SocialProvider = 'wechat' | 'qq';
export type AuthCapabilities = {
  localSocialProviders: SocialProvider[];
  emailRegistrationCodeRequired: boolean;
  phoneRegistrationWithoutCode: boolean;
  emailRegistrationAvailable: boolean;
  phoneCodesAvailable: boolean;
};

export function requestAuthCapabilities(signal: AbortSignal) {
  return accountClient.request('/account/auth/capabilities', {
    signal,
    parse(response): AuthCapabilities {
      const capabilities = response as Partial<Record<keyof AuthCapabilities, unknown>> | null;
      const providers = capabilities?.localSocialProviders;
      const localSocialProviders = Array.isArray(providers)
        ? (['wechat', 'qq'] as const).filter((provider) => providers.includes(provider))
        : [];
      return {
        localSocialProviders,
        emailRegistrationCodeRequired: capabilities?.emailRegistrationCodeRequired !== false,
        phoneRegistrationWithoutCode: capabilities?.phoneRegistrationWithoutCode === true,
        emailRegistrationAvailable: capabilities?.emailRegistrationAvailable !== false,
        phoneCodesAvailable: capabilities?.phoneCodesAvailable !== false,
      };
    },
  });
}

export function requestAuthentication(
  mode: 'login' | 'register',
  body: PasswordRegistration | { email: string; password: string } | { phone: string; password: string },
  acceptance: SignInAcceptance,
) {
  return startSession('/account/auth/' + mode, { ...body, acceptance }).then(({ user }) => user);
}

export function requestPhoneLogin({ phone, challengeId, code }: PhoneProof, acceptance: SignInAcceptance) {
  return startSession('/account/auth/phone/login', { phone, challengeId, code, acceptance });
}

export function requestSocialLogin(provider: SocialProvider, acceptance: SignInAcceptance, authorizationCode?: string) {
  return startSession('/account/auth/social/' + provider, { authorizationCode, acceptance });
}

async function startSession(path: string, body: unknown) {
  const hasToken = !isWeb && Boolean(await readNativeToken());
  const { user, token, created } = await accountClient.request(path, {
    ...accountRequest(hasToken),
    method: 'POST',
    body,
    parse(response) {
      const user = parseProfile(response);
      const { token, result } = response as { token?: unknown; result?: unknown };
      if (!isWeb && (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))) {
        throw new Error('Invalid account session.');
      }
      return { user, token, created: result === 'created' };
    },
  });
  if (!isWeb && typeof token === 'string') await saveNativeToken(token);
  return { user, created };
}

export async function requestSession(signal?: AbortSignal) {
  if (!isWeb && !await readNativeToken()) return null;

  return accountClient.request('/account/session', {
    ...accountRequest(true),
    signal,
    parse: parseProfile,
  });
}

export async function requestLogout() {
  if (!isWeb && !await readNativeToken()) return;

  return accountClient.request('/account/auth/logout', {
    ...accountRequest(true),
    method: 'POST',
    response: 'empty',
  });
}

export function requestPasswordChange(currentPassword: string, newPassword: string) {
  return accountClient.request('/account/auth/password', {
    ...accountRequest(true),
    method: 'POST',
    body: { currentPassword, newPassword },
    response: 'empty',
  });
}

export function requestPasswordSetup(body: { challengeId: string; code: string; newPassword: string }) {
  return accountClient.request('/account/auth/password', {
    ...accountRequest(true),
    method: 'POST',
    body,
    parse: parseProfile,
  });
}
